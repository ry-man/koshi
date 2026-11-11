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

test('independent random counts for every category validate, preview separately, and spawn together', () => {
  for (const [kind, type, attributes] of [
    ['enemy', 'mouse', { shield: 'green', carriesItem: 'key' }],
    ['item', 'battery', { lifetime: 12 }],
    ['food', 'S', { lifetime: 10 }],
    ['weapon', 'hammer-silver', { lifetime: 12 }],
    ['object', 'soccer-ball', {}],
    ['object', 'obstruction-circle', {}],
  ]) {
    const source = event(kind, type, { ...attributes, random: true, randomCount: 4 });
    const saved = validateCustomLevel(blank([source]));
    assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(saved))), saved);
    const game = gameFor([source]);
    const points = game.customEventPoints(source);
    assert.equal(points.length, 4);
    assert.equal(new Set(points.map(point => `${point.x},${point.y}`)).size, 4);
    assert.equal(game.customEventPoints(source, { preview: true }).length, 4);
    game.start(); game.elapsed = 4;
    game.prepareSpawns();
    const pending = game.pendingSpawns.get(game.customEvents[0]);
    assert.equal(pending.items.length, 4);
    game.prepareSpawns();
    assert.equal(game.pendingSpawns.get(game.customEvents[0]), pending);
    game.elapsed = 5; game.spawnCustomEvents();
    const spawned = kind === 'enemy' ? game.robots : kind === 'food' ? game.food
      : kind === 'weapon' ? game.weapons : kind === 'item' ? game.items
        : type === 'soccer-ball' ? game.soccerBalls : game.obstructions;
    assert.equal(spawned.length, 4);
    for (const item of spawned) {
      assert.equal(item.type, type);
      if (kind === 'enemy') {
        assert.equal(item.shield, 'green');
        assert.equal(item.carriesKey, true);
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
  for (const invalid of [
    event('enemy', 'mouse', { randomCount: 4 }),
    event('food', 'S', { randomCount: 4 }),
    event('item', 'key', { random: true, randomCount: 1 }),
    event('item', 'key', { random: true, randomCount: 2.5 }),
    event('item', 'key', { random: true, randomCount: 101 }),
    event('item', 'key', { random: true, randomCount: 4, group: { shape: 'line', count: 2 } }),
  ]) assert.throws(() => validateCustomLevel(blank([invalid])), /random|count/);
  assert.throws(() => validateCustomLevel(blank(Array(21).fill(
    event('item', 'key', { random: true, randomCount: 100 })))), /2000 game elements/);
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
    for (const shape of ['line', 'circle', 'single']) {
      for (const options of [{}, { portrait: true, scale: .6 }]) {
        const source = event('item', type, { random: true,
          ...(shape === 'single' ? { randomCount: 8 } : { group: { shape, count: 8, size: 1 } }) });
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

test('independent random counts participate in Cat Brick and key-source limits', () => {
  const catBlock = { description: 'Cat Brick', trigger: { type: 'carrier' } };
  const carrier = event('enemy', 'mouse', { random: true, randomCount: 2, carriesCatBlock: true });
  assert.throws(() => validateCustomLevel({ ...blank([carrier]), catBlock },
    { requireCatBlockConsistency: true }), /only one Cat Brick/);
  const level = { ...blank([
    event('item', 'treasure-chest', { keysRequired: 5 }),
    event('enemy', 'mouse', { random: true, randomCount: 5, carriesKey: true }),
  ]), catBlock: { ...catBlock, trigger: { type: 'chest' } } };
  assert.doesNotThrow(() => validateCustomLevel(level, { requireCatBlockConsistency: true }));
  level.events[1].randomCount = 4;
  assert.throws(() => validateCustomLevel(level, { requireCatBlockConsistency: true }), /more keys/);
});

function editorContext() {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', dataset: {}, listeners: {},
      querySelector: () => null, replaceChildren() {}, prepend() {},
      addEventListener(type, handler) { this.listeners[type] = handler; } });
    return nodes.get(selector);
  };
  const context = vm.createContext({ ...api, $, MIXED: '', selectedEvents: new Set(), selectedBricks: new Set(), placing: false,
    level: blank([]), touched: new Set(), readOnly: () => false,
    common: values => values.every(value => value === values[0]) ? values[0] : '',
    selectedList: () => [...context.selectedEvents], mixedOption() {}, syncPalettes() {},
    validateDraft: validateCustomLevel, markChanged() {}, setSelection() {}, message() {},
    plural: (count, word) => `${count} ${word}`, document: { createElement: () => ({}) } });
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('function typeOptions('), source.indexOf('function description(')), context);
  vm.runInContext(source.slice(source.indexOf('function readEvent('), source.indexOf('function setSelection(')), context);
  vm.runInContext(source.slice(source.indexOf('function applyToSelected('), source.indexOf('function applyEventChanges(')), context);
  vm.runInContext(source.slice(source.indexOf('function placementGrid('), source.indexOf('function pointerPosition(')), context);
  return { context, $ };
}

test('editor placement fields serialize random groups and independent random event counts', () => {
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

  $('#event-kind').value = 'enemy'; $('#event-type').value = 'mouse';
  $('#event-location').value = 'random'; $('#event-formation').value = 'single';
  $('#event-random-count').value = '4';
  context.updateEventPlacement();
  assert.equal($('#event-random-count-label').hidden, false);
  assert.equal($('#event-random-count').disabled, false);
  const repeated = validateCustomLevel(blank([context.readEvent()]));
  assert.equal(repeated.events[0].randomCount, 4);
  context.level = repeated; context.selectedEvents = new Set([0]); context.populateEventForm();
  assert.equal($('#event-random-count').value, 4);
  assert.equal($('#event-random-count-label').hidden, false);
  $('#event-random-count').value = '6'; context.touched.add('#event-random-count'); context.applyToSelected();
  assert.equal(context.level.events[0].randomCount, 6);
  context.touched.clear(); context.touched.add('#event-location'); $('#event-location').value = 'fixed';
  context.applyToSelected();
  assert.equal(context.level.events[0].randomCount, undefined);
  assert.equal(context.level.events[0].random, undefined);
});

test('editor exposes independent random counts for every category and preserves them through edits', () => {
  for (const [kind, type] of [['food', 'S'], ['weapon', 'gold'], ['item', 'battery'], ['enemy', 'mouse'], ['object', 'soccer-ball']]) {
    const { context, $ } = editorContext();
    $('#event-kind').value = kind; $('#event-type').value = type;
    $('#event-shield').value = 'none';
    $('#event-time').value = '5'; $('#event-lifetime').value = '10';
    $('#event-location').value = 'random'; $('#event-formation').value = 'single';
    $('#event-random-count').value = '4';
    context.updateEventPlacement();
    assert.equal($('#event-random-count-label').hidden, false, `${kind} count is visible`);
    assert.equal($('#event-random-count').disabled, false);
    assert.equal($('#event-group-options').hidden, true);
    context.level = validateCustomLevel(blank([context.readEvent()]));
    assert.equal(context.level.events[0].randomCount, 4);
    assert.equal(context.level.events[0].group, undefined);
    context.selectedEvents = new Set([0]); context.populateEventForm();
    assert.equal($('#event-random-count').value, 4);
    $('#event-random-count').value = '6'; context.touched.add('#event-random-count');
    context.applyToSelected();
    assert.equal(context.level.events[0].randomCount, 6);
    context.touched.clear(); context.touched.add('#event-time'); $('#event-time').value = '7';
    context.applyToSelected();
    assert.equal(context.level.events[0].randomCount, 6, 'unrelated edits retain the count');
    context.touched.clear(); context.touched.add('#event-random-count'); $('#event-random-count').value = '1';
    context.applyToSelected();
    assert.equal(context.level.events[0].randomCount, undefined);
    context.touched.clear(); context.touched.add('#event-formation'); $('#event-formation').value = 'circle';
    $('#event-count-input').value = '5'; $('#event-group-size').value = '';
    context.applyToSelected(); context.updateEventPlacement();
    assert.equal(context.level.events[0].randomCount, undefined);
    assert.equal(context.level.events[0].group.count, 5);
    assert.equal($('#event-random-count-label').hidden, true);
    $('#event-location').value = 'fixed'; $('#event-formation').value = 'single';
    context.updateEventPlacement();
    assert.equal($('#event-random-count-label').hidden, true);
  }
});

test('dragging independent random events converts them to valid fixed singles', () => {
  const { context } = editorContext();
  context.level = blank([event('food', 'S', { random: true, randomCount: 4 })]);
  context.moveEvent(0, .6, .7);
  const [moved] = validateCustomLevel(context.level).events;
  assert.equal(moved.random, undefined);
  assert.equal(moved.randomCount, undefined);
  assert.equal(moved.x, .6);
  assert.equal(moved.y, .7);
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
