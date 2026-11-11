(function () {
'use strict';

const CAPACITY = 18000;
const METRICS = ['interval', 'simulation', 'ui', 'render', 'work'];

function summarize(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = fraction => sorted[Math.ceil(sorted.length * fraction) - 1];
  return {
    count: values.length,
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    median: percentile(.5), p95: percentile(.95), p99: percentile(.99),
    max: sorted[sorted.length - 1],
    overBudget: values.filter(value => value > 1000 / 60).length,
    over33: values.filter(value => value > 33).length,
    over50: values.filter(value => value > 50).length,
  };
}

function createRecorder(capacity = CAPACITY) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Frame capacity must be a positive integer.');
  let frames, cursor, total, activeMs;
  const reset = () => { frames = []; cursor = 0; total = 0; activeMs = 0; };
  reset();
  return {
    reset,
    progress: () => ({ totalFrames: total, activeMs }),
    add(frame) {
      frames[cursor] = frame;
      cursor = (cursor + 1) % capacity;
      total++;
      activeMs += frame.interval ?? 0;
    },
    snapshot() {
      const recent = total < capacity ? [...frames] : [...frames.slice(cursor), ...frames.slice(0, cursor)];
      return {
        totalFrames: total, retainedFrames: recent.length, truncated: total > capacity, activeMs,
        metrics: Object.fromEntries(METRICS.map(key => [key, summarize(recent.map(frame => frame[key]).filter(Number.isFinite))])),
        frames: recent,
      };
    },
  };
}

function createMonitor({ getScene, isActive }) {
  const recorder = createRecorder();
  let recording = true, collecting = false, previous = null, phases = {}, updated = 0;
  let slowFrames = [], observed = [], activeRanges = [], observers = [], startedAt = performance.now();
  const supported = globalThis.PerformanceObserver?.supportedEntryTypes ?? [];
  const overlay = document.createElement('pre');
  overlay.id = 'performance-overlay';
  overlay.setAttribute('aria-label', 'Performance diagnostics');
  overlay.style.cssText = 'position:fixed;top:0;right:0;z-index:2147483647;pointer-events:none;background:#000d;color:#fff;padding:8px;font:12px monospace;margin:0';
  document.body.append(overlay);
  const eligible = () => recording && document.visibilityState === 'visible' && isActive();
  const resetInterval = () => { previous = null; };
  document.addEventListener('visibilitychange', resetInterval);
  function observe(type) {
    if (!supported.includes(type)) return;
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!recording || entry.startTime < startedAt || !activeRanges.some(([start, end]) =>
          entry.startTime <= end && entry.startTime + entry.duration >= start)) continue;
        observed.push({
          type, startTime: entry.startTime, duration: entry.duration,
          blockingDuration: entry.blockingDuration ?? null,
          scripts: Array.from(entry.scripts ?? [], script => ({
            sourceURL: script.sourceURL, sourceFunctionName: script.sourceFunctionName,
            duration: script.duration, forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration,
          })),
        });
        if (observed.length > 200) observed.shift();
      }
    });
    observer.observe({ type, buffered: false });
    observers.push(observer);
  }
  observe('long-animation-frame');
  observe('longtask');
  const monitor = {
    wrapPhase(name, fn) {
      return function (...args) {
        if (!collecting) return fn.apply(this, args);
        const start = performance.now();
        try { return fn.apply(this, args); }
        finally { phases[name] = (phases[name] ?? 0) + performance.now() - start; }
      };
    },
    wrapFrame(fn) {
      return function (timestamp) {
        collecting = eligible();
        phases = { simulation: 0, ui: 0, render: 0 };
        const start = performance.now();
        try { return fn(timestamp); }
        finally {
          if (collecting && eligible()) {
            const interval = previous === null ? null : timestamp - previous;
            const frame = { timestamp, interval, ...phases, work: performance.now() - start, scene: getScene() };
            recorder.add(frame);
            if (interval > 33 || frame.work > 33) {
              slowFrames.push(frame);
              if (slowFrames.length > 200) slowFrames.shift();
            }
            activeRanges.push([start, performance.now()]);
            if (activeRanges.length > 120) activeRanges.shift();
            previous = timestamp;
            if (!overlay.hidden && timestamp - updated > 1000) {
              overlay.textContent = `PERF (60 Hz budget: 16.7 ms)\nFrame: ${interval?.toFixed(1) ?? '-'} ms | work: ${frame.work.toFixed(1)} ms\nSimulation: ${phases.simulation.toFixed(1)} | UI: ${phases.ui.toFixed(1)} | draw: ${phases.render.toFixed(1)} ms\n${frame.scene.level} @ ${frame.scene.elapsed.toFixed(1)}s | enemies: ${frame.scene.counts.robots}\nExport: KoshiPerformance.snapshot()`;
              updated = timestamp;
            }
          } else previous = null;
          collecting = false;
        }
      };
    },
    reset() {
      recorder.reset();
      slowFrames = []; observed = []; activeRanges = []; previous = null;
      startedAt = performance.now();
      for (const observer of observers) observer.takeRecords();
    },
    start() { monitor.reset(); recording = true; },
    stop() { recording = false; previous = null; return monitor.snapshot(); },
    snapshot() {
      return {
        ...recorder.snapshot(), slowFrames: [...slowFrames], observed: [...observed],
        capabilities: { longAnimationFrame: supported.includes('long-animation-frame'), longTask: supported.includes('longtask') },
      };
    },
    state: getScene,
    progress: recorder.progress,
    setOverlay(visible) { overlay.hidden = !visible; },
  };
  return monitor;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { createRecorder, summarize, createMonitor };
else globalThis.KoshiPerformanceTools = { createMonitor };
})();
