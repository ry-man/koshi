const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');

function fixture({ duration = 20, time = 2, speed = 1 } = {}) {
  const nodes = new Map(), frames = new Map(), documentListeners = new Map(), windowListeners = new Map();
  let now = 0, nextFrame = 0;
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      value: '', max: duration, style: {}, dataset: {}, listeners: {}, attributes: {}, children: [],
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(type, listener) { this.listeners[type] = listener; },
      querySelectorAll() { return this.children; },
    });
    return nodes.get(selector);
  };
  $('#timeline').value = time;
  $('#preview-speed').value = speed;
  $('#timeline-discretization').value = '0';
  $('#event-time').value = 7;
  $('#show-all').checked = false;
  const markers = [
    { dataset: { previewStart: '0', previewEnd: '3' } },
    { dataset: { previewStart: '3' } },
    { dataset: { previewStart: '3.05', previewEnd: '3.1' } },
  ];
  $('#markers').children = markers;
  markers.forEach((marker, index) => { marker.dataset.index = String(index); marker.style = {}; });
  const cameras = [], level = { duration, events: markers.map(() => ({})), autoscroll: { length: 16, speed: .25 } };
  const context = {
    $, level, connectingSpawn: null, selectedEvents: new Set(),
    board: { clientHeight: 600 },
    previewGame: { width: 1000, height: 600,
      camera(time) { cameras.push(time); return { x: time * 10, y: 0, width: 500, height: 600 }; } },
    performance: { now: () => now },
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    document: { hidden: false, addEventListener(type, listener) { documentListeners.set(type, listener); } },
    window: { addEventListener(type, listener) { windowListeners.set(type, listener); } },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function renderPreviewTime('), source.indexOf('function pointReference(')), context);
  vm.runInContext(source.slice(source.indexOf('let previewPlayback = null;'), source.indexOf("$('#show-all').addEventListener")), context);
  context.renderPreviewTime();
  const tick = timestamp => {
    now = timestamp;
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(timestamp);
  };
  return { $, context, frames, markers, cameras, documentListeners, windowListeners, tick,
    setNow(timestamp) { now = timestamp; },
    play() { $('#preview-play').listeners.click(); },
    speed(value) { $('#preview-speed').value = value; $('#preview-speed').listeners.input(); },
  };
}

test('Dynamic View follows camera position only when enabled for an autoscrolling level', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  assert.match(html, /<input id="dynamic-view" type="checkbox" checked disabled> Dynamic View/);
  const css = fs.readFileSync(path.join(__dirname, '..', 'editor.css'), 'utf8');
  assert.match(css, /#editor-board-scroll\[data-dynamic-view="true"\] \{ overflow: hidden; max-height: none; \}/);
  assert.match(css, /#editor-board-scroll\[data-dynamic-view="true"\]\[data-orientation="portrait"\] \{ width: min\(100%, 340px\);/);
  assert.doesNotMatch(css, /#editor-board-scroll\[data-orientation="portrait"\]\s*\{[^}]*max-height:/);
  const f = fixture();
  const viewport = f.$('#editor-board-scroll');
  Object.assign(viewport, { scrollLeft: 17, scrollTop: 23, clientLeft: 0, clientTop: 0 });
  viewport.getBoundingClientRect = () => ({ left: 100, top: 200 });
  const board = f.context.board;
  Object.assign(board, { clientWidth: 1000, clientHeight: 600, clientLeft: 1, clientTop: 1 });
  board.getBoundingClientRect = () => ({ left: 100 - viewport.scrollLeft, top: 200 - viewport.scrollTop });
  f.context.renderPreviewTime(5);
  assert.equal(viewport.scrollLeft, 17);
  assert.equal(viewport.scrollTop, 23);
  assert.equal(viewport.style.height, '', 'manual view fits the full board height and horizontal scrollbar');
  assert.equal(f.$('#dynamic-view').disabled, false);
  f.$('#dynamic-view').checked = true;
  f.context.renderPreviewTime(5);
  assert.equal(viewport.scrollLeft, 51);
  assert.equal(viewport.scrollTop, 1);
  assert.equal(viewport.style.height, '600px');
  assert.equal(viewport.dataset.dynamicView, 'true');
  f.context.renderPreviewTime(10);
  assert.equal(viewport.scrollLeft, 101);
  f.$('#dynamic-view').checked = false;
  viewport.scrollLeft = 333;
  f.context.renderPreviewTime(12);
  assert.equal(viewport.scrollLeft, 333, 'manual view remains independent of time');
  assert.equal(viewport.style.height, '', 'disabling Dynamic View restores automatic height');
  f.$('#dynamic-view').checked = true;
  f.context.previewGame.camera = () => ({ x: 0, y: 240, width: 1000, height: 300 });
  f.context.renderPreviewTime(12);
  assert.equal(viewport.scrollTop, 241, 'portrait camera follows the vertical axis');
  assert.equal(viewport.style.height, '300px');
  delete f.context.level.autoscroll;
  f.context.renderPreviewTime(12);
  assert.equal(f.$('#dynamic-view').disabled, true);
  assert.equal(viewport.dataset.dynamicView, 'false');
  assert.equal(viewport.style.height, '');
});

test('selection rerenders preserve the view while explicit preview movement resumes camera following', () => {
  const f = fixture({ time: 12 }), viewport = f.$('#editor-board-scroll');
  Object.assign(viewport, { scrollLeft: 333, scrollTop: 240, clientLeft: 0, clientTop: 0 });
  viewport.getBoundingClientRect = () => ({ left: 100, top: 200 });
  Object.assign(f.context.board, { clientWidth: 1000, clientLeft: 1, clientTop: 1 });
  f.context.board.getBoundingClientRect = () => ({ left: 100 - viewport.scrollLeft, top: 200 - viewport.scrollTop });
  f.$('#dynamic-view').checked = true;
  f.context.selectedEvents.add(0);
  f.context.renderPreviewTime(12, false, false);
  assert.equal(viewport.scrollLeft, 333);
  assert.equal(viewport.scrollTop, 240);
  assert.equal(f.$('#timeline').value, 12);
  assert.equal(f.markers[0].hidden, false, 'selected time-zero event remains visible after its lifetime');
  f.context.renderPreviewTime(13, true);
  assert.equal(viewport.scrollLeft, 131);
  assert.equal(viewport.scrollTop, 1);
});

test('preview plays from its current position at exact real-time multiples without changing the level', () => {
  for (const speed of [.25, 1, 4]) {
    const f = fixture({ speed }), before = JSON.stringify(f.context.level);
    f.play();
    assert.equal(f.$('#preview-play').textContent, 'Pause');
    assert.equal(f.$('#preview-play').attributes['aria-pressed'], 'true');
    f.tick(1000);
    assert.equal(f.$('#timeline').value, 2 + speed);
    assert.equal(f.$('#event-time').value, 2 + speed);
    f.tick(2000);
    assert.equal(f.$('#timeline').value, 2 + speed * 2);
    assert.equal(f.frames.size, 1, 'one animation loop runs');
    assert.equal(JSON.stringify(f.context.level), before);
  }
});

test('pause preserves the current time, resume excludes paused time, and scrubbing pauses playback', () => {
  const f = fixture();
  f.play(); f.tick(1000); f.play();
  assert.equal(f.$('#timeline').value, 3);
  assert.equal(f.$('#preview-play').textContent, 'Play');
  assert.equal(f.$('#preview-play').attributes['aria-pressed'], 'false');
  assert.equal(f.frames.size, 0);
  f.tick(6000); f.play(); f.tick(7000);
  assert.equal(f.$('#timeline').value, 4);
  f.$('#timeline').value = 10;
  f.$('#timeline').listeners.input();
  assert.equal(f.frames.size, 0);
  assert.equal(f.$('#time-label').textContent, '10.0s');
  f.play(); f.tick(8000);
  assert.equal(f.$('#timeline').value, 11);
});

test('changing speed mid-play uses the previous speed up to the change without jumping', () => {
  const f = fixture();
  f.play(); f.tick(1000);
  f.setNow(1500); f.speed(4);
  assert.equal(f.$('#timeline').value, 3.5);
  assert.equal(f.$('#preview-speed-label').textContent, '4x');
  f.tick(2000);
  assert.equal(f.$('#timeline').value, 5.5);
  f.speed(.25); f.tick(3000);
  assert.equal(f.$('#timeline').value, 5.75);
  assert.equal(f.frames.size, 1);
});

test('playback never moves backward on its first frame and shortening the level stops it at the new end', () => {
  const f = fixture();
  f.setNow(100); f.play(); f.tick(99);
  assert.equal(f.$('#timeline').value, 2);
  f.tick(1100);
  assert.equal(f.$('#timeline').value, 3);
  f.context.level.duration = 2.75;
  f.context.renderPreviewTime();
  assert.equal(f.$('#timeline').value, 2.75);
  assert.equal(f.$('#preview-play').disabled, true);
  assert.equal(f.frames.size, 0);
});

test('playback clamps to the exact fractional level end, stops, and can restart after scrubbing backward', () => {
  const f = fixture({ duration: 3.05, speed: 4 });
  f.play(); f.tick(1000);
  assert.equal(f.$('#timeline').value, 3.05);
  assert.equal(f.$('#preview-play').disabled, true);
  assert.equal(f.$('#preview-play').textContent, 'Play');
  assert.equal(f.frames.size, 0);
  f.play();
  assert.equal(f.frames.size, 0);
  f.$('#timeline').value = 1;
  f.$('#timeline').listeners.input();
  assert.equal(f.$('#preview-play').disabled, false);
  f.play(); f.tick(1100);
  assert.equal(f.$('#timeline').value, 1.4);
});

test('time-only rendering updates exact spawn and expiration boundaries and camera positions without rebuilding markers', () => {
  const f = fixture();
  const markers = f.$('#markers').children;
  for (const [time, hidden] of [
    [2.99, [false, true, true]], [3, [true, false, true]],
    [3.05, [true, false, false]], [3.1, [true, false, true]],
  ]) {
    f.context.renderPreviewTime(time);
    assert.deepEqual(f.markers.map(marker => marker.hidden), hidden);
    assert.equal(f.cameras.at(-1), time);
    assert.equal(f.$('#markers').children, markers);
  }
  assert.equal(f.$('#event-time').value, 7, 'ordinary board renders preserve the event form value');
  assert.match(f.$('#camera-outline').style.cssText, /left:3.1%;/);
  f.$('#show-all').checked = true;
  f.context.renderPreviewTime(0);
  assert.ok(f.markers.every(marker => !marker.hidden));
  f.$('#show-all').checked = false;
  f.context.connectingSpawn = 'spawn';
  f.context.renderPreviewTime(0);
  assert.ok(f.markers.every(marker => !marker.hidden));
});

test('event timeline outlines follow exact preview time while scrubbing and playing', () => {
  const f = fixture({ time: 0 });
  f.$('#event-timeline-viewport').dataset = { view: 'relative', scale: '100' };
  const entries = [0, 3, 3, 3.05].map(time => ({ dataset: { eventTime: String(time) } }));
  f.$('#event-list').children = entries;
  const reached = () => entries.map(entry => entry.dataset.previewReached);
  f.context.renderPreviewTime(0);
  assert.equal(f.$('#event-timeline-cursor').style.left, '0px');
  assert.deepEqual(reached(), ['true', 'false', 'false', 'false']);
  f.$('#timeline').value = 3;
  f.$('#timeline').listeners.input();
  assert.equal(f.$('#event-timeline-cursor').style.left, '300px');
  assert.deepEqual(reached(), ['true', 'true', 'true', 'false']);
  f.play(); f.tick(50);
  assert.equal(f.$('#event-timeline-cursor').style.left, '305px');
  assert.deepEqual(reached(), ['true', 'true', 'true', 'true']);
  f.play();
  f.$('#timeline').value = 2.99;
  f.$('#timeline').listeners.input();
  assert.equal(f.$('#event-timeline-cursor').style.left, '299px');
  assert.deepEqual(reached(), ['true', 'false', 'false', 'false']);
});

test('event timeline initializes outlines on render in time order', () => {
  const list = { children: [], dataset: {}, style: {}, replaceChildren() { this.children = []; }, append(child) { this.children.push(child); } };
  const nodes = { '#event-list': list, '#event-count': {}, '#timeline': { value: '3' },
    '#event-timeline-view': { value: 'compact' }, '#event-timeline-axis': {}, '#event-timeline-viewport': { dataset: {} },
    '#relative-event-details': {}, '#event-timeline-cursor': { style: {} }, '#event-timeline-plot': { style: {} } };
  const level = { events: [{ time: 4 }, { time: 0 }, { time: 3 }, { time: 3 }] };
  const context = vm.createContext({
    $, level,
    timelineDetailIndex: null, selectedEvents: new Set(), renderTimelineDetails() {},
    document: { createElement: () => ({ dataset: {}, append(child) { this.child = child; } }) },
    plural: count => `${count} events`,
    eventTimelineButton: (event, index) => ({ index }),
  });
  function $(selector) { return nodes[selector]; }
  vm.runInContext(source.slice(source.indexOf('function renderList('), source.indexOf('function overlappingMarkers(')), context);
  context.renderList();
  assert.deepEqual(list.children.map(child => [child.dataset.eventTime, child.dataset.previewReached, child.child.index]),
    [[0, 'true', 1], [3, 'true', 2], [3, 'true', 3], [4, 'false', 0]]);
  const css = fs.readFileSync(path.join(__dirname, '..', 'editor.css'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  assert.match(css, /#event-list > \[data-preview-reached="true"\]\s*\{[^}]*outline: 3px solid #b28b37/);
  assert.doesNotMatch(html, /Gold outlines mark events at or before the preview time/);
});

test('hiding or leaving the page and interacting with the board or inspector pause the preview', () => {
  const f = fixture();
  f.play();
  f.context.document.hidden = true;
  f.documentListeners.get('visibilitychange')();
  assert.equal(f.frames.size, 0);
  f.context.document.hidden = false;
  f.play(); f.windowListeners.get('pagehide')();
  assert.equal(f.frames.size, 0);
  for (const type of ['pointerdown', 'keydown']) {
    f.play();
    f.documentListeners.get(type)({ target: { closest: () => ({}) } });
    assert.equal(f.frames.size, 0);
  }
  f.play();
  f.documentListeners.get('pointerdown')({ target: { closest: () => null } });
  assert.equal(f.frames.size, 1, 'unrelated controls do not stop playback');
});

test('preview controls support quarter to quadruple speed, fractional end times, and campaign inspection', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  assert.match(html, /id="preview-play" type="button" aria-pressed="false">Play/);
  assert.match(html, /id="preview-speed" type="range" min="0.25" max="4" step="0.25" value="1"/);
  assert.match(html, /id="timeline"[^>]*step="any"/);
  assert.match(source, /pausePreview\(\); attempt\(selectEditorLevel\)/);
  assert.match(source, /const candidate = validateDraft\(value\);\s*pausePreview\(\);/);
  assert.match(source, /if \(element.hidden\) return false;/);
});

test('manual timeline scrubbing snaps to the nearest permitted multiple for every discretization setting', () => {
  const f = fixture({ duration: 95.3 });
  const before = JSON.stringify(f.context.level);
  for (const step of [.5, 1, 5, 10, 30]) {
    f.$('#timeline-discretization').value = String(step);
    for (const [input, expected] of [[step * 1.49, step], [step * 1.5, step * 2], [step * 1.51, step * 2], [0, 0],
      [95.3, Math.floor(95.3 / step) * step]]) {
      f.$('#timeline').value = input;
      f.$('#timeline').listeners.input();
      assert.equal(f.$('#timeline').value, expected, `${step}s: ${input}`);
      assert.equal(f.$('#event-time').value, expected);
      assert.equal(f.cameras.at(-1), expected);
    }
  }
  f.$('#timeline-discretization').value = '0';
  f.$('#timeline').value = 12.345;
  f.$('#timeline').listeners.input();
  assert.equal(f.$('#timeline').value, 12.345);
  assert.equal(JSON.stringify(f.context.level), before);
});

test('discretization does not quantize playback and keyboard scrubbing advances to permitted times', () => {
  const f = fixture({ duration: 95.3, time: 12.3 });
  f.$('#timeline-discretization').value = '30';
  f.play(); f.tick(250);
  assert.equal(f.$('#timeline').value, 12.55);
  const key = key => {
    let prevented = false;
    f.$('#timeline').listeners.keydown({ key, preventDefault() { prevented = true; } });
    return prevented;
  };
  assert.equal(key('ArrowRight'), true);
  assert.equal(f.$('#timeline').value, 30);
  assert.equal(f.frames.size, 0);
  key('ArrowUp'); assert.equal(f.$('#timeline').value, 60);
  key('ArrowLeft'); assert.equal(f.$('#timeline').value, 30);
  key('ArrowDown'); assert.equal(f.$('#timeline').value, 0);
  key('End'); assert.equal(f.$('#timeline').value, 90);
  key('ArrowRight'); assert.equal(f.$('#timeline').value, 90);
  key('Home'); assert.equal(f.$('#timeline').value, 0);
  key('PageUp'); assert.equal(f.$('#timeline').value, 90);
  key('PageDown'); assert.equal(f.$('#timeline').value, 0);
  assert.equal(key('Tab'), false);
  f.$('#timeline-discretization').value = '0';
  assert.equal(key('ArrowRight'), false, 'None keeps native keyboard behavior');
  f.$('#timeline-discretization').value = '30';
  f.context.level.duration = 5;
  f.$('#timeline').value = 5;
  f.$('#timeline').listeners.input();
  assert.equal(f.$('#timeline').value, 0, 'an interval longer than the level permits only zero');
});

test('discretization selector offers exactly the requested settings and defaults to 1 second', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  const select = html.match(/<select id="timeline-discretization">([\s\S]*?)<\/select>/)[1];
  assert.deepEqual([...select.matchAll(/<option value="([^"]+)"(?: selected)?>([^<]+)<\/option>/g)].map(match => match.slice(1)),
    [['0', 'None'], ['0.5', '0.5s'], ['1', '1s'], ['5', '5s'], ['10', '10s'], ['30', '30s']]);
  assert.match(select, /<option value="1" selected>1s<\/option>/);
});
