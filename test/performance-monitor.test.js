'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRecorder, summarize } = require('../src/performance.js');
const { optionsFrom, compareBaseline, summaryText } = require('../tools/performance.js');

test('frame summaries use nearest-rank percentiles and strict slow-frame thresholds', () => {
  const summary = summarize([10, 16, 20, 33, 34, 50, 51, 100]);
  assert.equal(summary.median, 33);
  assert.equal(summary.p95, 100);
  assert.equal(summary.p99, 100);
  assert.equal(summary.max, 100);
  assert.equal(summary.overBudget, 6);
  assert.equal(summary.over33, 4);
  assert.equal(summary.over50, 2);
  assert.equal(summarize([]), null);
});

test('bounded frame history stays chronological and reset discards previous samples', () => {
  assert.throws(() => createRecorder(0), /positive integer/);
  const recorder = createRecorder(3);
  for (let i = 1; i <= 5; i++) recorder.add({ timestamp: i, interval: i === 1 ? null : i, work: i });
  const report = recorder.snapshot();
  assert.deepEqual(report.frames.map(frame => frame.timestamp), [3, 4, 5]);
  assert.equal(report.totalFrames, 5);
  assert.equal(report.retainedFrames, 3);
  assert.equal(report.truncated, true);
  assert.equal(report.activeMs, 14);
  assert.equal(report.metrics.interval.mean, 4);
  recorder.reset();
  assert.deepEqual(recorder.progress(), { totalFrames: 0, activeMs: 0 });
  assert.equal(recorder.snapshot().metrics.interval, null);
});

function harness(supported = []) {
  let clock = 0, active = true;
  const visibility = {};
  const overlay = { style: {}, setAttribute() {} };
  const observers = [];
  class Observer {
    static supportedEntryTypes = supported;
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(options) { this.type = options.type; }
    takeRecords() { return []; }
    emit(entries) { this.callback({ getEntries: () => entries }); }
  }
  const context = {
    PerformanceObserver: Observer,
    performance: { now: () => clock++ },
    document: {
      visibilityState: 'visible', createElement: () => overlay,
      body: { append() {} }, addEventListener: (name, fn) => { visibility[name] = fn; },
    },
    module: { exports: {} },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'performance.js'), 'utf8'), context);
  const monitor = context.module.exports.createMonitor({
    isActive: () => active,
    getScene: () => ({ level: 'test', state: active ? 'playing' : 'paused', elapsed: 0, counts: { robots: 1 } }),
  });
  return { monitor, context, visibility, observers, setActive: value => { active = value; } };
}

test('monitor excludes idle, paused, hidden, and stopped periods without accumulating their deltas', () => {
  const h = harness();
  const frame = h.monitor.wrapFrame(() => {});
  frame(100); frame(116);
  h.setActive(false);
  frame(5000);
  h.setActive(true);
  frame(10000); frame(10016);
  h.context.document.visibilityState = 'hidden';
  h.visibility.visibilitychange();
  frame(15000);
  h.context.document.visibilityState = 'visible';
  h.visibility.visibilitychange();
  frame(20000); frame(20016);
  const result = h.monitor.stop();
  assert.equal(result.totalFrames, 6);
  assert.equal(result.activeMs, 48);
  assert.equal(result.metrics.interval.max, 16);
  frame(30000);
  assert.equal(h.monitor.snapshot().totalFrames, 6);
  h.monitor.start();
  frame(40000);
  assert.equal(h.monitor.snapshot().totalFrames, 1);
  assert.equal(h.monitor.snapshot().metrics.interval, null);
});

test('phase wrappers preserve receiver, arguments, return values, and thrown errors', () => {
  const { monitor } = harness();
  const receiver = { n: 7 };
  const phase = monitor.wrapPhase('simulation', function (value) { return this.n + value; });
  assert.equal(phase.call(receiver, 3), 10);
  let result;
  const frame = monitor.wrapFrame(() => { result = phase.call(receiver, 4); });
  frame(100);
  assert.equal(result, 11);
  assert.ok(monitor.snapshot().metrics.simulation.max > 0);
  const error = new Error('test failure');
  const fail = monitor.wrapPhase('ui', () => { throw error; });
  assert.throws(() => monitor.wrapFrame(fail)(116), candidate => candidate === error);
});

test('observer attribution is feature-detected, bounded, and limited to recorded gameplay', () => {
  const h = harness(['long-animation-frame', 'longtask']);
  const frame = h.monitor.wrapFrame(() => {});
  frame(100);
  assert.equal(h.observers.length, 2);
  const observer = h.observers[0];
  observer.emit([{ startTime: 9999, duration: 100 }]);
  assert.equal(h.monitor.snapshot().observed.length, 0);
  observer.emit(Array.from({ length: 205 }, (_, i) => ({
    startTime: 1, duration: 100 + i, scripts: [{ sourceURL: 'game.js', sourceFunctionName: 'update', duration: 50 }],
  })));
  const result = h.monitor.snapshot();
  assert.equal(result.capabilities.longAnimationFrame, true);
  assert.equal(result.observed.length, 200);
  assert.equal(result.observed[0].duration, 105);
  assert.equal(result.observed[0].scripts[0].sourceFunctionName, 'update');
  h.monitor.stop();
  observer.emit([{ startTime: 1, duration: 100 }]);
  assert.equal(h.monitor.snapshot().observed.length, 200);
  h.monitor.start();
  assert.equal(h.monitor.snapshot().observed.length, 0);
  assert.equal(harness().monitor.snapshot().capabilities.longAnimationFrame, false);
});

test('performance command is explicit-only and rejects invalid options', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.scripts.perf, 'node tools/performance.js');
  for (const [name, command] of Object.entries(pkg.scripts)) {
    if (name !== 'perf') assert.doesNotMatch(command, /tools\/performance\.js|npm run perf/);
  }
  assert.equal(optionsFrom([]).seconds, 30);
  assert.equal(optionsFrom([]).profileSeconds, 30);
  assert.equal(optionsFrom(['--seconds', '5']).profileSeconds, 5);
  assert.equal(optionsFrom(['--seconds', '5', '--profile-seconds', '2']).profileSeconds, 2);
  assert.equal(optionsFrom(['--cpu', '4', '--headed']).cpu, 4);
  assert.equal(optionsFrom(['--headed']).headed, true);
  assert.equal(optionsFrom([]).scenario, 'campaign');
  assert.equal(optionsFrom(['--scenario', 'oval']).scenario, 'oval');
  for (const args of [['--seconds'], ['--warmup', '0'], ['--repeats', '1.5'], ['--cpu', '.5'], ['--output'], ['--bogus'],
    ['--scenario'], ['--scenario', 'unknown']]) {
    assert.throws(() => optionsFrom(args));
  }
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert.match(app, /get\('perf'\) === '1'[\s\S]*?import\('\.\/performance\.js'\)/);
});

test('baseline comparison checks workload, environment, and meaningful p95 regressions', () => {
  const report = {
    schemaVersion: 1, environment: { browser: 'test', cpu: 1 }, options: { seconds: 30 },
    runs: [{ name: 'official-1', level: 'official-1-2', measurement: {
      metrics: Object.fromEntries(['interval', 'simulation', 'ui', 'render', 'work'].map(key => [key, { p95: 10 }])),
    } }],
  };
  const baseline = structuredClone(report);
  assert.deepEqual(compareBaseline(report, baseline), []);
  report.runs[0].measurement.metrics.work.p95 = 13;
  assert.deepEqual(compareBaseline(report, baseline), [{ run: 'official-1', metric: 'work', before: 10, after: 13 }]);
  baseline.environment.cpu = 4;
  assert.throws(() => compareBaseline(report, baseline), /environment differs/);
  baseline.environment.cpu = 1;
  baseline.options.seconds = 5;
  assert.throws(() => compareBaseline(report, baseline), /workload differs/);
  baseline.options.seconds = 30;
  baseline.options.scenario = 'oval';
  assert.throws(() => compareBaseline(report, baseline), /scenario differs/);
  baseline.error = 'Browser failed';
  assert.throws(() => compareBaseline(report, baseline), /failed run/);
});

test('failure summary can be saved before any browser measurements exist', () => {
  const text = summaryText({ options: { cpu: 1 }, runs: [], retainedMemory: [], error: 'launch failed' });
  assert.match(text, /FAILED: launch failed/);
});

test('oval performance summaries include trajectory costs and actual sliding coverage', () => {
  const text = summaryText({ options: { cpu: 1 }, retainedMemory: [], runs: [{
    name: 'oval-1', measurement: { totalFrames: 100, metrics: {} },
    trajectory: { timing: { p95: 2, max: 4 }, curvedFrames: 80, slidingFrames: 20 },
  }] });
  assert.match(text, /Trajectory p95 \/ max: 2.00 \/ 4.00 ms/);
  assert.match(text, /curved previews: 80; sliding frames: 20/);
});
