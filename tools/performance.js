'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { once } = require('node:events');
const { createServer } = require('./serve.js');
const { requireChromium } = require('./smoke-official-levels.js');

function optionsFrom(argv) {
  const options = {
    seconds: 30, warmup: 5, repeats: 2, soakSeconds: 120, restarts: 5,
    profileSeconds: null, cpu: 1, headed: false, baseline: null,
    output: path.resolve(__dirname, '..', 'performance-results', new Date().toISOString().replace(/[:.]/g, '-')),
  };
  const numeric = { '--seconds': 'seconds', '--warmup': 'warmup', '--repeats': 'repeats',
    '--soak-seconds': 'soakSeconds', '--restarts': 'restarts', '--profile-seconds': 'profileSeconds', '--cpu': 'cpu' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--headed') options.headed = true;
    else if (numeric[arg]) {
      const value = Number(argv[++i]);
      if (!Number.isFinite(value) || value <= 0) throw new Error(`${arg} requires a positive number.`);
      options[numeric[arg]] = value;
    } else if (arg === '--output' || arg === '--baseline') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a path.`);
      options[arg.slice(2)] = path.resolve(value);
    } else throw new Error(`Unknown performance option: ${arg}`);
  }
  if (options.profileSeconds === null) options.profileSeconds = options.seconds;
  for (const key of ['repeats', 'restarts']) {
    if (!Number.isInteger(options[key])) throw new Error(`${key} must be an integer.`);
  }
  if (options.cpu < 1) throw new Error('--cpu must be at least 1.');
  return options;
}

function compareBaseline(report, baseline) {
  assert.ok(!baseline.error, 'Cannot use a failed run as a performance baseline.');
  assert.equal(baseline.schemaVersion, report.schemaVersion, 'Baseline report format differs.');
  for (const key of ['browser', 'platform', 'arch', 'cpu', 'viewport', 'headless']) {
    assert.deepEqual(baseline.environment[key], report.environment[key], `Baseline environment differs: ${key}`);
  }
  for (const key of ['seconds', 'warmup', 'repeats', 'soakSeconds', 'restarts']) {
    assert.equal(baseline.options[key], report.options[key], `Baseline workload differs: ${key}`);
  }
  return report.runs.filter(run => !run.diagnostic).flatMap(run => {
    const previous = baseline.runs.find(candidate => candidate.name === run.name && !candidate.diagnostic);
    assert.ok(previous, `Baseline has no run named ${run.name}`);
    assert.equal(previous.level, run.level, `Baseline level differs: ${run.name}`);
    return ['interval', 'simulation', 'ui', 'render', 'work'].flatMap(metric => {
      const before = previous.measurement.metrics[metric]?.p95;
      const after = run.measurement.metrics[metric]?.p95;
      assert.ok(Number.isFinite(before) && Number.isFinite(after), `Missing ${metric} samples: ${run.name}`);
      return after > before * 1.2 && after - before > 1
        ? [{ run: run.name, metric, before, after }] : [];
    });
  });
}

async function dismissIntroduction(page) {
  for (let attempt = 0; attempt < 30; attempt++) {
    await page.locator('.phase-transition[open]').waitFor({ state: 'hidden' });
    if (await page.locator('#cutscene[open]').isVisible()) {
      await page.locator('#cutscene-skip').click();
      await page.locator('#cutscene[open]').waitFor({ state: 'hidden' });
    } else if (await page.locator('#level-info[open]').isVisible()) {
      await page.locator('#level-info-close').click();
    } else if (await page.locator('dialog[open]').count() === 0) return;
    await page.waitForTimeout(100);
  }
  throw new Error('Level introduction did not close.');
}

async function ready(page) {
  await page.waitForFunction(() => globalThis.KoshiPerformance && !document.body.classList.contains('game-loading'));
  await dismissIntroduction(page);
  await page.waitForFunction(() => globalThis.KoshiPerformance.state().state === 'ready');
  await page.locator('#play').click();
  await page.waitForFunction(() => globalThis.KoshiPerformance.state().state === 'playing');
}

async function restart(page) {
  await page.locator('#restart').click();
  await ready(page);
}

async function memorySample(cdp, label) {
  const [{ metrics }, heap, dom] = await Promise.all([
    cdp.send('Performance.getMetrics'), cdp.send('Runtime.getHeapUsage'), cdp.send('Memory.getDOMCounters'),
  ]);
  return {
    label, timestamp: Date.now(), heap, dom,
    metrics: Object.fromEntries(metrics.filter(metric => [
      'JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'Documents', 'LayoutCount',
      'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration', 'TaskDuration',
    ].includes(metric.name)).map(metric => [metric.name, metric.value])),
  };
}

async function drive(page, cdp, seconds, memory, run = 'warmup') {
  const initial = await page.evaluate(() => globalThis.KoshiPerformance.progress().activeMs);
  const deadline = Date.now() + seconds * 5000 + 30000;
  let step = 0, inputs = 0, lastMemory = 0, recoveries = 0;
  while (true) {
    const progress = await page.evaluate(() => ({
      ...globalThis.KoshiPerformance.progress(), scene: globalThis.KoshiPerformance.state(),
    }));
    if (progress.activeMs - initial >= seconds * 1000) break;
    if (Date.now() > deadline) throw new Error(`Could not collect ${seconds}s of active gameplay (state: ${progress.scene.state}).`);
    if (progress.scene.state === 'lost' || progress.scene.state === 'won') {
      await restart(page);
      recoveries++;
    }
    // Use real pointer events, not direct engine mutation. The sequence repeats every run.
    const points = await page.locator('#board button.brick').evaluateAll(buttons => buttons
      .filter(button => !button.disabled)
      .map(button => {
        const rect = button.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height };
      }).filter(point => point.width > 0 && point.height > 0 && point.x >= 0
        && point.x < innerWidth && point.y >= 0 && point.y < innerHeight));
    if (points.length) {
      const point = points[(step * 7 + 3) % points.length];
      await page.mouse.click(point.x, point.y);
      inputs++;
    }
    step++;
    if (Date.now() - lastMemory >= 1000) {
      memory.push({ ...await memorySample(cdp, `gameplay-${step}`), run, scene: progress.scene });
      lastMemory = Date.now();
    }
    await page.waitForTimeout(250);
  }
  return { recoveries, inputs };
}

async function captureProfile(cdp, directory, action) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  await cdp.send('Tracing.start', {
    transferMode: 'ReturnAsStream',
    categories: 'devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline,disabled-by-default-v8.gc',
  });
  try { return await action(); }
  finally {
    const { profile } = await cdp.send('Profiler.stop');
    await fs.writeFile(path.join(directory, 'diagnostic.cpuprofile'), JSON.stringify(profile));
    const completed = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end');
    const { stream } = await completed;
    const output = await fs.open(path.join(directory, 'diagnostic-trace.json'), 'w');
    try {
      let eof = false;
      while (!eof) {
        const chunk = await cdp.send('IO.read', { handle: stream });
        await output.write(chunk.base64Encoded ? Buffer.from(chunk.data, 'base64') : chunk.data);
        eof = chunk.eof;
      }
    } finally {
      await output.close();
      await cdp.send('IO.close', { handle: stream });
      await cdp.send('Profiler.disable');
    }
  }
}

function summaryText(report) {
  const lines = [
    'Koshi on-demand performance report', '',
    `Status: ${report.error ? 'FAILED: ' + report.error : report.regressions?.length ? 'REGRESSION' : 'Completed'}`,
    `Browser: ${report.environment?.browser}; CPU throttle: ${report.options.cpu}x`,
    'Times are milliseconds. p95/p99 use retained frame samples; see JSON for truncation and raw context.',
    '60 Hz budget: 16.67 ms; slow-frame thresholds: >33 ms and >50 ms.',
    'Diagnostic replay includes profiler overhead and is NOT used for regression comparisons.', '',
    'Run | frames | interval p95 / p99 / max | >33 / >50 | simulation / UI / render / work p95',
  ];
  for (const run of report.runs) {
    const m = run.measurement.metrics;
    const f = value => value?.toFixed(2) ?? '-';
    lines.push(`${run.name} | ${run.measurement.totalFrames} | ${f(m.interval?.p95)} / ${f(m.interval?.p99)} / ${f(m.interval?.max)} | ${m.interval?.over33 ?? 0} / ${m.interval?.over50 ?? 0} | ${['simulation', 'ui', 'render', 'work'].map(key => f(m[key]?.p95)).join(' / ')}`);
  }
  if (report.retainedMemory.length > 1) {
    const first = report.retainedMemory[0], last = report.retainedMemory.at(-1);
    lines.push('', `Post-GC retained heap change: ${((last.heap.usedSize - first.heap.usedSize) / 1048576).toFixed(2)} MiB`,
      `Post-GC DOM node change: ${last.dom.nodes - first.dom.nodes}`,
      'Growth is a diagnostic signal, not proof of a leak. Inspect the per-restart trend and heap snapshots.');
  }
  for (const regression of report.regressions ?? []) {
    lines.push(`REGRESSION: ${regression.run} ${regression.metric} p95 ${regression.before.toFixed(2)} -> ${regression.after.toFixed(2)}`);
  }
  lines.push('', 'Open diagnostic-trace.json in Chrome DevTools Performance; load diagnostic.cpuprofile in the JavaScript Profiler.',
    'Inspect main-thread flame charts, GC events, style/layout, paint and raster activity.',
    'Use report.json for memory samples, entity counts, slow frames, observer attribution, and workload coverage.');
  return lines.join('\n') + '\n';
}

async function runPerformance(options) {
  const chromium = requireChromium();
  await fs.mkdir(options.output, { recursive: true });
  const report = { schemaVersion: 1, options, runs: [], memory: [], retainedMemory: [], errors: [], diagnostics: [] };
  let browser, server, page;
  try {
    server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: !options.headed });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      globalThis.resetPerformanceSeed = () => {
        let seed = 0x4b4f5348;
        Math.random = () => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return seed / 4294967296;
        };
      };
      globalThis.resetPerformanceSeed();
    });
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      if (message.args().length) report.errors.push(message.text());
      else report.diagnostics.push(message.text());
    });
    page.on('requestfailed', request => report.errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('response', response => {
      if (response.status() >= 400) report.errors.push(`${response.status()}: ${response.url()}`);
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: options.cpu });
    report.environment = {
      browser: browser.version(), platform: process.platform, arch: process.arch,
      cpu: options.cpu, viewport: { width: 1280, height: 900 }, headless: !options.headed,
    };
    // Verify that ordinary play does not load or activate the diagnostics module.
    await page.goto(`${base}/?game=beta`);
    await page.waitForFunction(() => !document.body.classList.contains('game-loading'));
    assert.equal(await page.evaluate(() => Boolean(globalThis.KoshiPerformance)
      || performance.getEntriesByType('resource').some(entry => entry.name.endsWith('/performance.js'))), false,
    'Performance monitoring must be absent in normal play.');
    const beta = await page.evaluate(() => globalThis.KoshiGame.LEVELS.map(level => ({
      id: level.id, scroll: Boolean(level.autoscroll),
      density: (level.events?.length ?? 0) + (level.autoscroll?.events?.length ?? 0)
        + (level.enemies?.length ?? 0) + (level.food?.length ?? 0),
    })));
    const scrolling = beta.filter(level => level.scroll).sort((a, b) => b.density - a.density)[0];
    const busy = beta.filter(level => !level.scroll).sort((a, b) => b.density - a.density)[0];
    assert.ok(scrolling && busy, 'Expected scrolling and busy Beta scenarios.');
    const scenarios = [
      { name: 'official', campaign: 'official', level: 'official-1-2' },
      { name: 'scrolling', campaign: 'beta', level: scrolling.id },
      { name: 'busy', campaign: 'beta', level: busy.id },
    ];
    report.scenarios = scenarios;
    let navigation = 0;
    async function load(scenario) {
      // A fragment-only navigation does not rerun startup campaign selection.
      await page.goto(`${base}/?game=${scenario.campaign}&perf=1&run=${++navigation}#campaign=${encodeURIComponent(scenario.level)}`);
      await ready(page);
      assert.equal(await page.evaluate(() => globalThis.KoshiPerformance.state().level), scenario.level, 'Wrong performance level loaded');
      await page.evaluate(() => globalThis.KoshiPerformance.setOverlay(false));
    }
    async function measure(name, scenario, seconds, diagnostic = false) {
      await page.evaluate(() => globalThis.KoshiPerformance.start());
      const activity = await drive(page, cdp, seconds, report.memory, name);
      const measurement = await page.evaluate(() => globalThis.KoshiPerformance.stop());
      assert.ok(measurement.totalFrames >= 2 && measurement.activeMs >= seconds * 1000, `${name}: insufficient active gameplay`);
      assert.ok(activity.inputs > 0, `${name}: no scripted inputs`);
      const run = { name, level: scenario.level, diagnostic, activity, measurement };
      report.runs.push(run);
      console.log(`${name}: ${measurement.totalFrames} frames, p95 ${measurement.metrics.interval.p95.toFixed(2)} ms`);
      return run;
    }
    for (const scenario of scenarios) {
      for (let repeat = 1; repeat <= options.repeats; repeat++) {
        await load(scenario);
        await drive(page, cdp, options.warmup, []);
        await page.evaluate(() => globalThis.resetPerformanceSeed());
        await restart(page);
        await measure(`${scenario.name}-${repeat}`, scenario, options.seconds);
      }
    }
    const soak = scenarios[2];
    await load(soak);
    await drive(page, cdp, options.warmup, []);
    await page.evaluate(() => globalThis.KoshiPerformance.stop());
    async function retained(label) {
      // Forced GC is only between measured segments, never during frame timing.
      await cdp.send('HeapProfiler.collectGarbage');
      report.retainedMemory.push(await memorySample(cdp, label));
    }
    await restart(page);
    await retained('soak-start');
    for (let cycle = 1; cycle <= options.restarts; cycle++) {
      await measure(`soak-${cycle}`, soak, options.soakSeconds / options.restarts);
      await restart(page);
      await retained(`restart-${cycle}`);
    }
    const worst = report.runs.filter(run => !run.name.startsWith('soak'))
      .sort((a, b) => b.measurement.metrics.interval.p99 - a.measurement.metrics.interval.p99)[0];
    const diagnostic = scenarios.find(scenario => worst.name.startsWith(scenario.name));
    await load(diagnostic);
    await drive(page, cdp, options.warmup, []);
    await page.evaluate(() => globalThis.resetPerformanceSeed());
    await restart(page);
    await captureProfile(cdp, options.output, () => measure('diagnostic-replay', diagnostic, options.profileSeconds, true));
    await page.screenshot({ path: path.join(options.output, 'diagnostic.png') });
    if (options.baseline) report.regressions = compareBaseline(report, JSON.parse(await fs.readFile(options.baseline, 'utf8')));
    assert.deepEqual(report.errors, [], 'Browser errors during performance test');
    assert.equal(report.regressions?.length ?? 0, 0, 'Performance baseline regressions detected');
  } catch (error) {
    report.error = error.stack ?? error.message;
    if (page && !page.isClosed()) {
      try {
        report.failureState = await page.evaluate(() => ({
          scene: globalThis.KoshiPerformance?.state(),
          dialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.id || dialog.className),
          selection: document.querySelector('#level-select')?.value,
        }));
        await page.screenshot({ path: path.join(options.output, 'failure.png') });
      } catch (diagnosticError) {
        report.failureDiagnosticsError = diagnosticError.message;
        console.error('Could not capture browser failure diagnostics:', diagnosticError);
      }
    }
    throw error;
  } finally {
    try {
      await fs.writeFile(path.join(options.output, 'report.json'), JSON.stringify(report, null, 2));
      await fs.writeFile(path.join(options.output, 'summary.txt'), summaryText(report));
      console.log(`Performance artifacts: ${options.output}`);
    } finally {
      try { if (browser) await browser.close(); }
      finally {
        if (server?.listening) await new Promise((resolve, reject) => {
          server.close(error => error ? reject(error) : resolve());
          server.closeAllConnections();
        });
      }
    }
  }
  return report;
}

if (require.main === module) {
  Promise.resolve().then(() => runPerformance(optionsFrom(process.argv.slice(2))))
    .catch(error => { console.error(error); process.exitCode = 1; });
}

module.exports = { optionsFrom, compareBaseline, summaryText, runPerformance };
