const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const api = require('../src/game.js');
const { Game, validateCustomLevel, snapWheel } = api;

const blank = events => ({
  version: 1, id: 'Event formations', duration: 30, goal: 1000, heartCost: null, brickSet: 1, events,
});
const event = (kind = 'food', type = 'S', extra = {}) => ({
  time: 5, kind, type, x: .5, y: .5, ...(kind === 'food' ? { lifetime: 10 } : {}), ...extra,
});
const gameFor = (events, options = {}, random = () => .3) => new Game(random, { customLevel: blank(events), ...options });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
const mean = (points, axis) => points.reduce((sum, point) => sum + point[axis], 0) / points.length;

test('random singles and line/circle groups validate and preserve optional fields across JSON round trips', () => {
  for (const [kind, type] of [['food', 'S'], ['enemy', 'mouse'], ['weapon', 'silver'], ['item', 'battery'], ['object', 'soccer-ball']]) {
    for (const random of [false, true]) {
      for (const group of [undefined, { shape: 'line', count: 5, size: .6, angle: 45 }, { shape: 'circle', count: 8 }]) {
        const source = event(kind, type, { ...(random ? { random: true } : {}), ...(group ? { group } : {}) });
        const saved = validateCustomLevel(blank([source]));
        assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(saved))), saved);
        assert.equal(saved.events[0].random, random ? true : undefined);
        if (random) {
          assert.equal(saved.events[0].x, undefined);
          assert.equal(saved.events[0].y, undefined);
        }
        assert.deepEqual(saved.events[0].group, group);
      }
    }
  }
});

test('invalid random flags, group shapes, counts, sizes and angles are rejected with bounded total elements', () => {
  for (const group of [null, [], {}, { shape: 'grid', count: 2 },
    { shape: 'line', count: 1 }, { shape: 'line', count: 101 }, { shape: 'circle', count: 2.5 },
    { shape: 'circle', count: '5' }, { shape: 'line', count: 2, size: 0 },
    { shape: 'line', count: 2, size: 1.01 }, { shape: 'line', count: 2, size: NaN },
    { shape: 'line', count: 2, angle: -1 }, { shape: 'line', count: 2, angle: 361 },
    { shape: 'circle', count: 2, angle: 45 }]) {
    assert.throws(() => validateCustomLevel(blank([event('food', 'S', { group })])), /group|line|angle/);
  }
  assert.throws(() => validateCustomLevel(blank([event('food', 'S', { random: 'true' })])), /random/);
  assert.throws(() => validateCustomLevel(blank([event('food', 'S', { x: undefined })])), /X/);
  for (const [x, y, group] of [[0, .5, { shape: 'circle', count: 5 }],
    [.5, 1, { shape: 'line', count: 5, angle: 90 }],
    [1, .5, { shape: 'line', count: 5 }]]) {
    assert.throws(() => validateCustomLevel(blank([event('food', 'S', { x, y, group })])), /group center/);
  }
  assert.doesNotThrow(() => validateCustomLevel(blank([event('food', 'S', { y: 0, group: { shape: 'line', count: 5 } })])));
  const grouped = event('food', 'S', { group: { shape: 'line', count: 100 } });
  assert.doesNotThrow(() => validateCustomLevel(blank(Array(20).fill(grouped))));
  assert.throws(() => validateCustomLevel(blank(Array(21).fill(grouped))), /2000 game elements/);
});

test('fixed lines honor angle, length, center and equal spacing in desktop and phone layouts', () => {
  for (const options of [{}, { portrait: true }, { portrait: true, scale: .5 }]) {
    for (const angle of [0, 45, 90, 180, 270, 360]) {
      const source = event('food', 'H', { x: .4, y: .6, group: { shape: 'line', count: 5, size: .4, angle } });
      const game = gameFor([source], options);
      const points = game.customEventPoints(source);
      const center = game.pointFromRelative(source.x, source.y), b = game.bounds();
      const length = Math.min(b.right - b.left, b.bottom - b.top) * .4;
      close(mean(points, 'x'), center.x); close(mean(points, 'y'), center.y);
      for (let i = 1; i < points.length; i++) {
        close(points[i].x - points[i - 1].x, Math.cos(angle * Math.PI / 180) * length / 4);
        close(points[i].y - points[i - 1].y, Math.sin(angle * Math.PI / 180) * length / 4);
      }
    }
  }
});

test('circles are evenly spaced around the fixed center with the chosen diameter', () => {
  for (const count of [2, 3, 5, 8, 100]) {
    const source = event('item', 'key', { group: { shape: 'circle', count, size: .6 } });
    const game = gameFor([source]), points = game.customEventPoints(source), b = game.bounds();
    const center = game.pointFromRelative(.5, .5);
    const radius = Math.min(b.right - b.left, b.bottom - b.top) * .3;
    close(mean(points, 'x'), center.x); close(mean(points, 'y'), center.y);
    for (const [i, point] of points.entries()) {
      close(point.x, center.x + radius * Math.cos(i * Math.PI * 2 / count));
      close(point.y, center.y + radius * Math.sin(i * Math.PI * 2 / count));
    }
  }
});

test('automatic sizes and fixed groups near edges stay inside bounds while retaining their center', () => {
  for (const shape of ['line', 'circle']) {
    const source = event('food', 'S', { x: .05, y: .05, group: { shape, count: 100 } });
    const game = gameFor([source]), points = game.customEventPoints(source), b = game.bounds();
    const center = game.pointFromRelative(source.x, source.y);
    close(mean(points, 'x'), center.x); close(mean(points, 'y'), center.y);
    for (const point of points) {
      assert.ok(point.x >= b.left - 1e-7 && point.x <= b.right + 1e-7);
      assert.ok(point.y >= b.top - 1e-7 && point.y <= b.bottom + 1e-7);
    }
  }
  const source = event('food', 'S', { group: { shape: 'line', count: 3 } });
  const points = gameFor([source]).customEventPoints(source);
  close(points[1].x - points[0].x, 55);
});

test('random locations vary by random source and previews are stable representative formations', () => {
  for (const group of [undefined, { shape: 'line', count: 4, size: .4, angle: 30 }, { shape: 'circle', count: 5, size: .4 }]) {
    const source = event('enemy', 'mouse', { random: true, ...(group ? { group } : {}) });
    const a = gameFor([source], {}, () => .1), b = gameFor([source], {}, () => .9);
    const first = a.customEventPoints(source), second = b.customEventPoints(source);
    assert.notDeepEqual(first, second);
    assert.deepEqual(a.customEventPoints(source, { preview: true }), b.customEventPoints(source, { preview: true }));
    if (group) {
      for (let i = 1; i < first.length; i++) {
        close(first[i].x - first[0].x, second[i].x - second[0].x);
        close(first[i].y - first[0].y, second[i].y - second[0].y);
      }
    }
  }
});

test('every supported category spawns all members with its attributes, timing and one stable warning per member', () => {
  for (const [kind, type, target, attributes] of [
    ['food', 'H', 'food', { lifetime: 10 }],
    ['enemy', 'mouse', 'robots', { shield: 'blue', carriesKey: true }],
    ['weapon', 'silver', 'weapons', { lifetime: 12 }],
    ['item', 'battery', 'items', { lifetime: 12 }],
    ['object', 'soccer-ball', 'soccerBalls', {}],
    ['object', 'bumper-red', 'bumpers', {}],
    ['object', 'bubble-blue', 'bubbles', {}],
    ['object', 'obstruction-circle', 'obstructions', { width: 40, height: 40, color: '#123456', destructible: true }],
  ]) {
    const source = event(kind, type, { ...attributes, random: true, group: { shape: 'circle', count: 4, size: .7 } });
    const game = gameFor([source]); game.start(); game.elapsed = 4;
    game.prepareSpawns();
    const savedEvent = game.customEvents[0];
    const pending = game.pendingSpawns.get(savedEvent);
    assert.equal(pending.items.length, 4);
    const positions = pending.items.map(({ x, y }) => ({ x, y }));
    game.prepareSpawns();
    assert.equal(game.pendingSpawns.get(savedEvent), pending);
    assert.equal(game.spawnCues.length, 4);
    game.elapsed = 5; game.spawnCustomEvents();
    assert.equal(game[target].length, 4, `${kind}:${type}`);
    assert.deepEqual(game[target].map(({ x, y }) => ({ x, y })), positions);
    for (const member of game[target]) {
      assert.equal(member.type, type);
      if (kind === 'enemy') { assert.equal(member.shield, 'blue'); assert.equal(member.carriesKey, true); }
      if (attributes.lifetime) { assert.equal(member.born, 5); assert.equal(member.expires, 5 + attributes.lifetime); }
      if (attributes.color) { assert.equal(member.color, attributes.color); assert.equal(member.destructible, true); }
    }
    assert.equal(game.pendingSpawns.has(savedEvent), false);
  }
});

test('boundary-only enemy singles and group members snap to the nearest edge', () => {
  for (const type of ['wheel', 'snake', 'robo-cow']) {
    for (const random of [false, true]) {
      for (const group of [{ shape: 'line', count: 5, size: .5, angle: 45 }, { shape: 'circle', count: 8 }]) {
        const source = event('enemy', type, { ...(random ? { random: true } : {}), group });
        const game = gameFor([source]), b = game.bounds();
        const points = game.customEventPoints(source);
        const spawned = game.createCustomSpawn(source);
        assert.equal(spawned.length, group.count);
        for (const point of points) assert.ok(point.x === b.left || point.x === b.right || point.y === b.top || point.y === b.bottom);
        for (const enemy of spawned) assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.y));
      }
    }
    const source = event('enemy', type, { random: true });
    assert.doesNotThrow(() => validateCustomLevel(blank([source])));
    assert.equal(gameFor([source]).createCustomSpawn(source).length, 1);
    assert.throws(() => validateCustomLevel(blank([event('enemy', type)])), /edge/);
  }
});

test('random tools preserve required brick clearance even for maximum-sized formations', () => {
  for (const type of ['saw-blade', 'ditto-stamp', 'paint-pencil-red']) {
    for (const shape of ['line', 'circle']) {
      for (const options of [{}, { portrait: true, scale: .6 }]) {
        const source = event('item', type, { random: true, group: { shape, count: 8, size: 1 } });
        const game = gameFor([source], options);
        const points = game.customEventPoints(source);
        assert.equal(points.length, 8);
        for (const point of points) assert.equal(game.stampSpawnClear(point), true, `${type}:${shape}`);
      }
    }
  }
});

test('group counts participate in Cat Brick source and chest key consistency checks', () => {
  const catBlock = { description: 'Cat Brick', trigger: { type: 'spawn' } };
  for (const source of [event('item', 'cat-block'), event('item', 'treasure-chest'), event('enemy', 'mouse', { carriesCatBlock: true })]) {
    const type = source.kind === 'enemy' ? 'carrier' : source.type === 'treasure-chest' ? 'chest' : 'spawn';
    const level = { ...blank([{ ...source, group: { shape: 'line', count: 2 } }, event('item', 'key')]), catBlock: { ...catBlock, trigger: { type } } };
    assert.throws(() => validateCustomLevel(level, { requireCatBlockConsistency: true }), /only one Cat Brick/);
  }
  const chest = event('item', 'treasure-chest', { keysRequired: 5 });
  for (const source of [event('item', 'key'), event('enemy', 'mouse', { carriesKey: true })]) {
    const level = { ...blank([chest, { ...source, group: { shape: 'circle', count: 5 } }]),
      catBlock: { ...catBlock, trigger: { type: 'chest' } } };
    assert.doesNotThrow(() => validateCustomLevel(level, { requireCatBlockConsistency: true }));
    level.events[1].group.count = 4;
    assert.throws(() => validateCustomLevel(level, { requireCatBlockConsistency: true }), /more keys/);
  }
});

function editorContext() {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', dataset: {}, listeners: {},
      querySelector: () => null, replaceChildren() {}, prepend() {},
      addEventListener(type, handler) { this.listeners[type] = handler; } });
    return nodes.get(selector);
  };
  const context = vm.createContext({ ...api, $, MIXED: '', selectedEvents: new Set(), selectedBricks: new Set(),
    level: blank([]), touched: new Set(), readOnly: () => false,
    common: values => values.every(value => value === values[0]) ? values[0] : '',
    selectedList: () => [...context.selectedEvents], mixedOption() {}, syncPalettes() {},
    validateDraft: validateCustomLevel, markChanged() {}, setSelection() {}, message() {},
    plural: (count, word) => `${count} ${word}`, document: { createElement: () => ({}) } });
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('function typeOptions('), source.indexOf('function description(')), context);
  vm.runInContext(source.slice(source.indexOf('function readEvent('), source.indexOf('function setSelection(')), context);
  vm.runInContext(source.slice(source.indexOf('function applyToSelected('), source.indexOf("form.addEventListener('submit'")), context);
  vm.runInContext(source.slice(source.indexOf('function moveEvent('), source.indexOf('function pointerPosition(')), context);
  return { context, $ };
}

test('editor placement fields serialize and round-trip random groups and reveal only relevant options', () => {
  const { context, $ } = editorContext();
  $('#event-time').value = '5'; $('#event-x').value = '50'; $('#event-y').value = '50';
  $('#event-lifetime').value = '10'; $('#event-kind').value = 'food'; $('#event-type').value = 'S';
  $('#event-location').value = 'random'; $('#event-formation').value = 'circle';
  $('#event-count-input').value = '8'; $('#event-group-size').value = '60';
  context.updateEventPlacement();
  assert.equal($('#event-position').hidden, true);
  assert.equal($('#event-x').disabled, true);
  assert.equal($('#event-group-options').hidden, false);
  assert.equal($('#event-group-angle').disabled, true);
  const saved = validateCustomLevel(blank([JSON.parse(JSON.stringify(context.readEvent()))]));
  assert.deepEqual(saved.events[0], { time: 5, kind: 'food', type: 'S', lifetime: 10, random: true, group: { shape: 'circle', count: 8, size: .6 } });
  context.level = saved; context.selectedEvents = new Set([0]); context.populateEventForm();
  assert.equal($('#event-location').value, 'random');
  assert.equal($('#event-formation').value, 'circle');
  assert.equal($('#event-count-input').value, 8);
  assert.equal($('#event-group-size').value, 60);
  $('#event-location').value = 'fixed'; $('#event-formation').value = 'line'; $('#event-group-angle').value = '45';
  context.updateEventPlacement();
  assert.equal($('#event-position').hidden, false);
  assert.equal($('#event-group-angle').disabled, false);
  const fixed = context.readEvent();
  assert.equal(fixed.random, undefined);
  assert.equal(fixed.x, .5); assert.equal(fixed.y, .5);
  assert.equal(fixed.group.angle, 45);
});

test('multi-event edits preserve untouched placement fields and dragging random groups fixes their center', () => {
  const { context, $ } = editorContext();
  context.level = blank([
    event('food', 'S', { random: true, group: { shape: 'circle', count: 8, size: .4 } }),
    event('food', 'H', { group: { shape: 'line', count: 5, angle: 45 } }),
  ]);
  context.selectedEvents = new Set([0, 1]); context.populateEventForm();
  $('#event-time').value = '10'; context.touched.add('#event-time'); context.applyToSelected();
  assert.equal(context.level.events[0].random, true);
  assert.equal(context.level.events[0].group.shape, 'circle');
  assert.equal(context.level.events[1].group.angle, 45);
  context.touched.clear(); context.touched.add('#event-location'); $('#event-location').value = 'random';
  context.applyToSelected();
  assert.equal(context.level.events[1].random, true);
  context.moveEvent(1, .6, .7);
  assert.equal(context.level.events[1].random, undefined);
  assert.equal(context.level.events[1].x, .6);
  assert.equal(context.level.events[1].y, .7);
  assert.equal(context.level.events[1].group.count, 5);
  context.touched.clear(); context.touched.add('#event-formation'); $('#event-formation').value = 'single';
  context.applyToSelected();
  assert.equal(context.level.events[0].group, undefined);
  assert.equal(context.level.events[1].group, undefined);
});
