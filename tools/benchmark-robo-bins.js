'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { parseArgs } = require('node:util');

const gameFilename = path.resolve(__dirname, '..', 'src', 'game.js');
const authoredFile = path.join('levels', 'official', 'world-1', '1-16.json');
const authoredLevel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', authoredFile), 'utf8'));
const hz = 60, dt = 1 / hz, frameBudgetMs = 1000 / hz;
const coldSteps = 3;
const episodesPerRepeat = 4;
const metrics = ['combat', 'updateTrashBin', 'findTrashBinPath'];
const phases = ['cold', 'steady'];
const scenarios = [
  { name: 'clear-route', bins: [[325, 280]], targets: 'right edge', obstacles: [] },
  { name: 'rotated-concave', bins: [[280, 145], [280, 220], [280, 305], [280, 385]], targets: 'right edge',
    obstacles: [
      { type: 'obstruction-rectangle', x: 440, y: 170, width: 230, height: 55, rotation: 38 },
      { type: 'obstruction-v', x: 570, y: 355, width: 220, height: 170, rotation: -32 },
    ] },
  { name: 'narrow-passage', bins: [215, 280, 345].flatMap(y => [145, 205, 265, 325].map(x => [x, y])),
    targets: 'right half',
    obstacles: [
      { type: 'obstruction-rectangle', x: 430, y: 143, width: 45, height: 190 },
      { type: 'obstruction-rectangle', x: 430, y: 454, width: 45, height: 236 },
      { type: 'obstruction-rectangle', x: 650, y: 348, width: 45, height: 210, rotation: 20 },
    ] },
  { name: 'no-bins', bins: [], targets: 'right half', obstacles: [] },
  { name: 'official-1-16', authoredFile, title: authoredLevel.id, seconds: authoredLevel.duration },
];

const usage = `Usage: node tools\\benchmark-robo-bins.js [options]
  --baseline PATH   Pre-change src\\game.js snapshot; omit to measure only current
  --output PATH     Also write the JSON report to PATH
  --json            Print JSON instead of the human summary
  --seed N          Unsigned 32-bit seed (default: 314159)
  --repeats N       Alternating before/after repeats (default: 6)
  --seconds N       Simulated seconds per fresh episode (default: 24)
  --help            Print usage`;

function optionsFrom(argv) {
  const { values } = parseArgs({ args: argv, options: {
    baseline: { type: 'string' }, output: { type: 'string' }, json: { type: 'boolean' },
    seed: { type: 'string', default: '314159' }, repeats: { type: 'string', default: '6' },
    seconds: { type: 'string', default: '24' }, help: { type: 'boolean' },
  } });
  if (values.help) return values;
  for (const [key, min, max] of [['seed', 0, 0xffffffff], ['repeats', 1, 100], ['seconds', 1, 60]]) {
    const raw = values[key];
    if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
      throw new Error(`--${key} requires an integer from ${min} to ${max}.`);
    }
    values[key] = Number(raw);
  }
  for (const key of ['baseline', 'output']) {
    if (values[key] !== undefined) {
      if (!values[key].trim()) throw new Error(`--${key} requires a path.`);
      values[key] = path.resolve(values[key]);
    }
  }
  return values;
}

function loadEngine(name, sourcePath) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  // The standalone snapshot still imports campaign.js relative to the original engine location.
  const engineModule = new Module(gameFilename, module);
  engineModule.filename = gameFilename;
  engineModule.paths = Module._nodeModulePaths(path.dirname(gameFilename));
  engineModule._compile(source, gameFilename);
  const { Game } = engineModule.exports;
  assert.equal(typeof Game?.prototype?.combat, 'function', `${sourcePath} must export Game.combat`);
  const routingSearch = typeof Game.prototype.findTrashBinPath === 'function';
  return { name, sourcePath, sha256: createHash('sha256').update(source).digest('hex'),
    Game, routingSearch };
}

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function setup(Game, scenario, seed) {
  const game = new Game(seededRandom(seed), { customLevel: scenario.authoredFile ? authoredLevel : {
    version: 1, id: scenario.name, duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [],
  } });
  game.invulnerableUntil = Infinity;
  game.cat.x = 110;
  game.cat.y = 95;
  game.start();
  if (scenario.authoredFile) return game;
  game.obstructions = scenario.obstacles.map(obstacle => game.createObstruction(obstacle, obstacle));
  game.robots = scenario.bins.map(([x, y]) => {
    const [bin] = game.createCustomEntity({ kind: 'enemy', type: 'robo-trash-bin' }, { x, y });
    bin.binWait = 0;
    return bin;
  });
  for (const brick of game.bricks) {
    const rightEdge = brick.x + brick.w > game.width - 9;
    const rightHalf = brick.x + brick.w / 2 > game.width / 2;
    if (!(scenario.targets === 'right edge' ? rightEdge : rightHalf)) brick.slimed = true;
  }
  if (game.robots.length) assert.ok(game.bricks.some(brick => !brick.slimed), 'No eligible target bricks');
  return game;
}

function emptyPhase() {
  return { combat: [], updateTrashBin: [], findTrashBinPath: [] };
}

function emptyActivity() {
  return { claims: 0, travelBinSteps: 0, slimes: 0, escapesStarted: 0, escapesCompleted: 0, peakBins: 0 };
}

function instrumentRouting(game, stepSamples, routeCounts) {
  const find = game.findTrashBinPath, clear = game.trashBinRouteClear;
  if (typeof find !== 'function') return;
  let probe;
  if (typeof clear === 'function') game.trashBinRouteClear = function (...args) {
    const result = clear.apply(this, args);
    if (probe) {
      probe.checks++;
      const counts = routeCounts();
      // The planner checks the direct segment and the destination before entering A*.
      if (probe.checks === 1 && result) counts.direct++;
      if (probe.checks === 2 && !result) counts.blockedDestinations++;
      if (probe.checks === 3) {
        counts.gridSearches++;
        if (probe.grid !== probe.navigation.grid) counts.gridBuilds++;
      }
    }
    return result;
  };
  game.findTrashBinPath = function (...args) {
    const outer = probe, navigation = args[2];
    if (typeof clear === 'function') routeCounts()[outer ? 'refinedRetries' : 'requests']++;
    probe = { checks: 0, grid: navigation?.grid, navigation };
    const start = outer ? 0 : performance.now();
    try {
      const result = find.apply(this, args);
      if (!outer) {
        const counts = routeCounts();
        if (result === undefined) counts.deferred++;
        else if (result === null) counts.failed++;
        else counts.successful++;
      }
      return result;
    }
    finally {
      if (!outer) stepSamples().findTrashBinPath.push(performance.now() - start);
      probe = outer;
    }
  };
}

function instrumentBinUpdate(game, stepSamples) {
  const update = game.updateTrashBin;
  game.updateTrashBin = function (...args) {
    const start = performance.now();
    const result = update.apply(this, args);
    stepSamples().updateTrashBin.push(performance.now() - start);
    return result;
  };
}

function runEpisode(engine, scenario, seed, steps, pass, samples, activity, routing) {
  const game = setup(engine.Game, scenario, seed);
  const { x, y } = game.cat;
  const bins = game.robots.slice();
  const previous = new Map();
  let phase = 'cold';
  if (pass === 'diagnostic') {
    instrumentBinUpdate(game, () => samples[phase]);
    instrumentRouting(game, () => samples[phase], () => routing[phase]);
    for (const [method, key] of [['slimeBrick', 'slimes'], ['startTrashBinEscape', 'escapesStarted']]) {
      const original = game[method];
      game[method] = function (...args) {
        activity[phase][key]++;
        return original.apply(this, args);
      };
    }
  }
  for (let frame = 0; frame < steps; frame++) {
    game.elapsed = (frame + 1) * dt;
    phase = !scenario.authoredFile && frame < coldSteps ? 'cold' : 'steady';
    const activeBins = scenario.authoredFile ? (() => {
      game.prepareSpawns();
      game.spawnCustomEvents();
      return game.robots.filter(enemy => enemy.type === 'robo-trash-bin');
    })() : bins;
    if (pass === 'timed' && (!scenario.authoredFile || activeBins.length)) {
      const start = performance.now();
      game.combat(dt, x, y);
      samples[phase].combat.push(performance.now() - start);
    } else {
      const previousGridSearches = pass === 'diagnostic' ? routing[phase].gridSearches : 0;
      game.combat(dt, x, y);
      if (pass !== 'diagnostic') continue;
      routing[phase].maxGridSearchesPerStep = Math.max(routing[phase].maxGridSearchesPerStep,
        routing[phase].gridSearches - previousGridSearches);
      const counts = activity[phase];
      counts.peakBins = Math.max(counts.peakBins, activeBins.length);
      for (const bin of activeBins) {
        const old = previous.get(bin);
        if (bin.binTarget !== null && bin.binTarget !== old?.target) counts.claims++;
        if (bin.binState === 'travel') counts.travelBinSteps++;
        if (old?.state === 'escape' && bin.binState !== 'escape') counts.escapesCompleted++;
        previous.set(bin, { target: bin.binTarget, state: bin.binState });
      }
    }
  }
  if (!scenario.authoredFile) assert.equal(game.robots.length, bins.length, 'Unexpected bin removal changed the workload');
  assert.equal(game.hearts, 3, 'The stationary cat must not take damage');
  return game.brickRevision;
}

function statistics(samples) {
  const count = samples.length;
  const ordered = [...samples].sort((a, b) => a - b);
  const percentile = p => count ? ordered[Math.ceil(p * count) - 1] : null;
  return { count, median: count ? (ordered[Math.floor((count - 1) / 2)] + ordered[Math.floor(count / 2)]) / 2 : null,
    p95: percentile(.95), p99: percentile(.99), max: percentile(1),
    total: samples.reduce((sum, value) => sum + value, 0),
    ...(count && { over60HzBudget: samples.filter(value => value > frameBudgetMs).length }) };
}

function benchmark(engines, options) {
  const routeCounts = () => ({ requests: 0, successful: 0, failed: 0, deferred: 0, direct: 0,
    blockedDestinations: 0, gridSearches: 0, refinedRetries: 0, gridBuilds: 0, maxGridSearchesPerStep: 0 });
  const results = scenarios.map(scenario => ({
    scenario, steps: (scenario.seconds ?? options.seconds) * hz, runs: engines.map(engine => ({
      engine, samples: { cold: emptyPhase(), steady: emptyPhase() },
      activity: { cold: emptyActivity(), steady: emptyActivity() }, repeats: [],
      routing: { cold: routeCounts(), steady: routeCounts() },
    })),
  }));
  for (const { scenario, runs, steps } of results) {
    for (const { engine } of runs) runEpisode(engine, scenario, (options.seed - 1) >>> 0, steps, 'warmup');
  }
  // Instrumentation replays the same seeded episodes after the unwrapped combat timings.
  for (const pass of ['timed', 'diagnostic']) {
    for (let repeat = 0; repeat < options.repeats; repeat++) {
      for (const { scenario, runs, steps } of results) {
        for (const run of repeat % 2 ? [...runs].reverse() : runs) {
          const start = run.samples.steady.combat.length;
          let brickRevisions = 0;
          for (let episode = 0; episode < episodesPerRepeat; episode++) {
            const seed = (options.seed + repeat * episodesPerRepeat + episode) >>> 0;
            brickRevisions += runEpisode(run.engine, scenario, seed, steps, pass, run.samples, run.activity, run.routing);
          }
          if (pass === 'timed') {
            run.repeats.push({ brickRevisions, steadyCombatMs: statistics(run.samples.steady.combat.slice(start)) });
          } else {
            assert.equal(brickRevisions, run.repeats[repeat].brickRevisions, 'Instrumented replay changed the workload');
          }
        }
      }
    }
  }
  return results.map(({ scenario, runs }) => ({ ...scenario, runs: runs.map(run => {
    if (scenario.authoredFile || scenario.bins.length) {
      assert.ok(run.activity.cold.claims + run.activity.steady.claims > 0 && run.activity.steady.travelBinSteps > 0,
        `${run.engine.name}/${scenario.name}: bin navigation was not exercised`);
    }
    const timingMs = Object.fromEntries(phases.map(phase => [
      phase, Object.fromEntries(metrics.map(metric => [
        metric, metric === 'findTrashBinPath' && !run.engine.routingSearch ? null : statistics(run.samples[phase][metric]),
      ])),
    ]));
    const routing = typeof run.engine.Game.prototype.trashBinRouteClear === 'function' && run.engine.routingSearch
      ? run.routing : null;
    return { engine: run.engine.name, timingMs, activity: run.activity, routing, repeats: run.repeats };
  }) }));
}

function summaryText(report) {
  const { environment: env, workload } = report;
  const fmt = number => number === null ? '-' : number.toFixed(5);
  const lines = [
    `Robo Trash Bin benchmark | ${env.node}, V8 ${env.v8} | ${env.platform} ${env.arch} | ${env.cpu}`,
    `Seed ${workload.seed}; ${workload.repeats} repeats x ${workload.episodesPerRepeat} fresh episodes per arena/engine (${workload.seconds}s synthetic).`,
    `Combat only, 1/${hz}s timestep; synthetic first ${coldSteps} steps cold. Official 1-16 runs ${authoredLevel.duration}s, bins-active frames only.`,
    `60 Hz frame budget: ${frameBudgetMs.toFixed(2)} ms.`,
    'No rendering or FPS claims. Bin update/path time is inclusive per call from a separate replay; do not add it to combat.',
    '', 'Arena | engine | phase | metric (samples) | median / p95 / p99 / worst ms',
  ];
  for (const scenario of report.scenarios) {
    for (const run of scenario.runs) {
      for (const phase of phases) {
        if (scenario.authoredFile && phase === 'cold') continue;
        for (const metric of metrics) {
          const value = run.timingMs[phase][metric];
          lines.push(`${scenario.name} (${run.activity[phase].peakBins} bins peak) | ${run.engine} | ${phase} | ${metric} `
            + (value ? `(${value.count}) | ${[value.median, value.p95, value.p99, value.max].map(fmt).join(' / ')}`
              : '| unavailable'));
        }
        const activity = run.activity[phase];
        lines.push(`  Claims ${activity.claims}, travel bin-steps ${activity.travelBinSteps}, slimes ${activity.slimes}, `
          + `escapes started/completed ${activity.escapesStarted}/${activity.escapesCompleted}; `
          + `combat steps >${frameBudgetMs.toFixed(2)} ms: ${run.timingMs[phase].combat.over60HzBudget}`);
        const route = run.routing?.[phase];
        if (route) lines.push(`  Paths ${route.requests}: ${route.successful} successful, ${route.failed} failed, ${route.deferred} deferred; `
          + `direct ${route.direct}; A* ${route.gridSearches} (max ${route.maxGridSearchesPerStep}/step); `
          + `blocked destinations ${route.blockedDestinations}; refined retries ${route.refinedRetries}; grid builds ${route.gridBuilds}`);
      }
    }
  }
  return lines.join('\n');
}

function main(argv) {
  const options = optionsFrom(argv);
  if (options.help) { console.log(usage); return; }
  if (options.output && [gameFilename, options.baseline].some(source =>
    source && path.relative(source, options.output) === '')) throw new Error('--output must not overwrite an engine source.');
  const engines = [loadEngine('current', gameFilename)];
  if (options.baseline) engines.unshift(loadEngine('baseline', options.baseline));
  const report = {
    schemaVersion: 2,
    environment: { node: process.version, v8: process.versions.v8, platform: process.platform,
      release: os.release(), arch: process.arch, cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length },
    engines: engines.map(({ name, sourcePath, sha256, routingSearch }) => ({ name, sourcePath, sha256, routingSearch })),
    workload: { seed: options.seed, repeats: options.repeats, seconds: options.seconds,
      dt, frameBudgetMs, episodesPerRepeat, coldSteps, warmupEpisodesPerScenario: 1 },
    notes: [
      'Synthetic custom arenas; stationary invulnerable cat; initially ready bins. Fresh game per episode restores bricks and claims outside timing.',
      'Official 1-16 uses the unmodified authored JSON via the custom level loader. Authored spawn preparation and dispatch run outside the combat timer.',
      'Official samples exclude time before the bins spawn and use steady only (natural, staggered initial bin waits).',
      'Combat only: no Game.update loop, player movement, rendering, browser, or FPS claims.',
      'Cold means unpopulated per-episode routing state, not cold Node/JIT. Steady includes natural retargeting and replanning.',
      'Combat and instrumented replays use identical seeds; paired engines may consume RNG differently as their behavior diverges.',
      'Method timings include nested work (and inner instrumentation); a null metric means the method is unavailable.',
      'Path timing and outcomes count top-level requests, including target and yield probes; successful means a path was returned, not that the bin arrived. Refined retries are included in timing.',
      'A* entries and grid builds are classified from clearance checks inside the planner; deferred requests that never enter the grid do not count as searches.',
      'Median uses the middle sample(s); p95 and p99 use nearest rank. Worst samples can include GC or OS interruptions.',
    ],
    scenarios: benchmark(engines, options),
  };
  const json = JSON.stringify(report, null, 2);
  if (options.output) fs.writeFileSync(options.output, `${json}\n`);
  console.log(options.json ? json : summaryText(report));
}

try { main(process.argv.slice(2)); }
catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
