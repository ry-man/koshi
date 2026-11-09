const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, validateCustomLevel } = require('../src/game.js');

const blank = () => ({ version: 1, id: 'Koshi start tests', duration: 60, goal: 20, heartCost: null, brickSet: 1, events: [] });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('optional Koshi start coordinates round-trip exactly and are omitted from unchanged levels', () => {
  const original = blank();
  assert.deepEqual(validateCustomLevel(original), original);
  for (const koshiStart of [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: .237654, y: .891234 }, { x: .5, y: .5 }]) {
    const source = { ...original, koshiStart };
    assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(source))), source);
    assert.deepEqual(source.koshiStart, koshiStart);
  }
  for (const koshiStart of [null, [], 'center', 0, {}, { x: .5 }, { x: -1, y: .5 },
    { x: .5, y: 1.01 }, { x: '0.5', y: .5 }, { x: Infinity, y: .5 }, { x: .5, y: NaN }]) {
    assert.throws(() => validateCustomLevel({ ...original, koshiStart }), /Koshi starting/);
  }
  assert.equal(Object.hasOwn(original, 'koshiStart'), false);
});

test('game and editor previews use the exact start on desktop, phone, and scrolling boards and on reset', () => {
  for (const portrait of [false, true]) for (const scale of [1, .6]) for (const scrolling of [false, true]) {
    const source = { ...blank(), koshiStart: { x: .22, y: .31 },
      ...(scrolling ? { autoscroll: { length: 20, speed: 0, events: [] } } : {}) };
    for (const editorPreview of [false, true]) {
      const game = new Game(() => .5, { customLevel: source, portrait, scale, editorPreview });
      const point = game.pointFromRelative(source.koshiStart.x, source.koshiStart.y);
      assert.deepEqual({ x: game.cat.x, y: game.cat.y }, point);
      assert.deepEqual(game.catHistory, [{ time: 0, ...point }]);
      assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0);
      game.start();
      assert.deepEqual({ x: game.cat.x, y: game.cat.y }, point);
      game.cat.x += 50; game.cat.y += 40;
      game.reset();
      assert.deepEqual({ x: game.cat.x, y: game.cat.y }, point);
      assert.deepEqual(source.koshiStart, { x: .22, y: .31 });
    }
  }
});

test('absent start keeps the ordinary center and existing boss and scrolling defaults', () => {
  for (const portrait of [false, true]) {
    const game = new Game(() => .5, { customLevel: blank(), portrait });
    assert.deepEqual([game.cat.x, game.cat.y], [game.width / 2, game.height / 2]);
    const scrolling = new Game(() => .5, { customLevel: { ...blank(),
      autoscroll: { length: 20, speed: 0, events: [] } }, portrait });
    assert.deepEqual([scrolling.cat.x, scrolling.cat.y], [scrolling.viewportWidth / 2, scrolling.viewportHeight / 2]);
    const source = { ...blank(), goal: 0, bossLevel: true,
      events: [{ kind: 'enemy', type: 'boss', time: 0, x: .5, y: .2 }] };
    const boss = new Game(() => .5, { customLevel: source, portrait });
    assert.deepEqual([boss.cat.x, boss.cat.y], [boss.viewportWidth / 2, boss.viewportHeight / 2 + 110]);
    const placed = new Game(() => .5, { customLevel: { ...source, koshiStart: { x: .3, y: .7 } }, portrait });
    assert.deepEqual({ x: placed.cat.x, y: placed.cat.y }, placed.pointFromRelative(.3, .7));
  }
});

function fixture() {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const nodes = new Map(), label = {};
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', style: {}, dataset: {},
      querySelector: () => label, setAttribute(name, value) { this[name] = value; },
      addEventListener(type, handler) { this[type] = handler; }, focus() {} });
    return nodes.get(selector);
  };
  let locked = false, changes = 0;
  const context = vm.createContext({ $, Game, level: blank(), activeCategory: 'koshi',
    gesture: null, readOnly: () => locked, validateDraft: validateCustomLevel,
    markChanged: () => changes++, message() {}, attempt: action => action(),
    showCategory: category => { context.activeCategory = category; }, setSelection() {},
    placementGrid: () => null,
    placementPosition: (x, y) => ({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }),
  });
  context.render = () => {
    context.previewGame = new Game(() => .5, { customLevel: context.level, editorPreview: true });
    context.renderKoshiStart();
  };
  vm.runInContext(source.slice(source.indexOf('function renderKoshiStart('), source.indexOf('function populateTrackForm(')), context);
  context.render();
  return { $, context, source, changes: () => changes, lock: () => { locked = true; } };
}

test('editor saves, replaces and removes a single independent start without touching events', () => {
  const { $, context, changes, lock } = fixture();
  const events = JSON.stringify(context.level.events);
  assert.equal($('#koshi-start-marker').style.left, '50%');
  assert.equal($('#koshi-start-marker').style.top, '50%');
  assert.equal($('#koshi-reset').disabled, true);
  context.saveKoshiStart({ x: .2, y: .7 });
  close(Number($('#koshi-x').value), 20);
  close(Number($('#koshi-y').value), 70);
  assert.equal($('#koshi-reset').disabled, false);
  context.saveKoshiStart({ x: .4, y: .8 });
  assert.deepEqual({ ...context.level.koshiStart }, { x: .4, y: .8 });
  assert.equal(JSON.stringify(context.level.events), events);
  const before = JSON.stringify(context.level);
  assert.throws(() => context.saveKoshiStart({ x: 2, y: .5 }), /Koshi starting X/);
  assert.equal(JSON.stringify(context.level), before, 'failed validation keeps saved content');
  $('#koshi-reset').click();
  assert.equal(Object.hasOwn(context.level, 'koshiStart'), false);
  assert.equal($('#koshi-start-marker').style.left, '50%');
  assert.equal($('#koshi-start-marker').style.top, '50%');
  assert.equal(changes(), 3);
  lock();
  context.saveKoshiStart({ x: .1, y: .1 });
  assert.equal(Object.hasOwn(context.level, 'koshiStart'), false);
  assert.equal(changes(), 3);
});

test('Koshi category board clicks replace the start rather than creating timed events', () => {
  const { context, source } = fixture();
  context.pointerPosition = event => event;
  vm.runInContext(source.slice(source.indexOf('function placeAt('), source.indexOf("board.addEventListener('pointerdown'")), context);
  context.placeAt({ x: .25, y: .75 });
  assert.deepEqual({ ...context.level.koshiStart }, { x: .25, y: .75 });
  context.placeAt({ x: .65, y: .15 });
  assert.deepEqual({ ...context.level.koshiStart }, { x: .65, y: .15 });
  assert.equal(context.level.events.length, 0);
});

test('exact starting fields, marker arrow keys and Delete work independently of event forms', () => {
  const { $, context, lock } = fixture();
  const event = { preventDefault() {}, stopPropagation() {}, currentTarget: { reportValidity: () => true } };
  $('#koshi-x').value = '23.7654'; $('#koshi-y').value = '89.1234';
  $('#koshi-form').change(event);
  close(context.level.koshiStart.x, .237654); close(context.level.koshiStart.y, .891234);
  $('#koshi-start-marker').keydown({ ...event, key: 'ArrowLeft' });
  close(context.level.koshiStart.x, .227654);
  $('#koshi-start-marker').keydown({ ...event, key: 'Delete' });
  assert.equal(context.level.koshiStart, undefined);
  $('#koshi-x').value = 30; $('#koshi-y').value = 40;
  $('#koshi-form').submit(event);
  close(context.level.koshiStart.x, .3); close(context.level.koshiStart.y, .4);
  lock();
  $('#koshi-start-marker').keydown({ ...event, key: 'Delete' });
  close(context.level.koshiStart.x, .3);
});

test('dragging a start commits once, supports cancel to the implicit default, and cannot edit read-only levels', () => {
  const { $, context, source, changes, lock } = fixture();
  const listeners = new Map();
  Object.assign(context, {
    board: { setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {},
      addEventListener: (type, callback) => listeners.set(type, callback) },
    pointerPosition: event => ({ x: event.clientX / 1000, y: event.clientY / 1000 }),
    isAdditive: () => false, renderBoard: context.render,
  });
  vm.runInContext(source.slice(source.indexOf('function startGesture('), source.indexOf('function boxBounds(')), context);
  vm.runInContext(source.slice(source.indexOf("board.addEventListener('pointermove'"), source.indexOf("board.addEventListener('keydown'")), context);
  const start = () => context.startGesture({ pointerId: 1, clientX: 500, clientY: 500 }, { type: 'koshi' });
  const move = () => listeners.get('pointermove')({ pointerId: 1, clientX: 600, clientY: 700 });
  start(); move();
  close(context.level.koshiStart.x, .6); close(context.level.koshiStart.y, .7);
  listeners.get('pointercancel')();
  assert.equal(Object.hasOwn(context.level, 'koshiStart'), false);
  assert.equal(changes(), 0);
  start(); move(); listeners.get('pointerup')({ pointerId: 1 });
  close(context.level.koshiStart.x, .6); close(context.level.koshiStart.y, .7);
  assert.equal(changes(), 1);
  assert.equal(context.gesture, null);
  start(); move(); listeners.get('pointercancel')();
  close(context.level.koshiStart.x, .6); close(context.level.koshiStart.y, .7);
  lock(); start();
  assert.equal(context.gesture, null);
  assert.equal($('#koshi-start-marker')['aria-pressed'], 'true');
});
