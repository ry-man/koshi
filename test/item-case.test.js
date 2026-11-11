const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, ITEMS, WEAPONS, OBJECTS, LEVELS, CAT_BLOCK_MESSAGES, validateCustomLevel } = require('../src/game.js');
const { drawItemCase, drawGlassBreak, spawnSymbol, spawnColor } = require('../src/brick-visuals.js');
const { Tutorial, LESSONS } = require('../src/learning.js');

const placement = (containsItem = 'key', extra = {}) => ({
  time: 0, kind: 'object', type: 'item-case', containsItem, x: .6, y: .5, ...extra,
});
const level = (events = [], extra = {}) => ({
  version: 1, id: 'Item Case tests', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events, ...extra,
});
function arena(events = [], extra = {}) {
  const game = new Game(() => .5, { customLevel: level(events, extra) });
  game.start();
  return game;
}
function equip(game, type = 'silver') {
  game.weapons.push({ x: game.cat.x, y: game.cat.y, type });
  game.combat(0, game.cat.x, game.cat.y);
}
function addCase(game, type = 'key', offset = 60) {
  const item = game.createItemCase({ x: game.cat.x + offset, y: game.cat.y }, { containsItem: type });
  game.itemCases.push(item);
  return item;
}

test('Item Cases validate and preserve every contained item and weapon in placements and spawners', () => {
  for (const containsItem of Object.keys({ ...ITEMS, ...WEAPONS })) {
    const custom = level([placement(containsItem)], {
      catBlock: { description: 'Find the Cat Block.', messages: CAT_BLOCK_MESSAGES },
      brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
        spawner: { kind: 'object', type: 'item-case', containsItem } }],
    });
    assert.deepEqual(validateCustomLevel(custom), custom);
  }
  for (const containsItem of [undefined, '', 'not-an-item', null, 3, {}, 'toString']) {
    assert.throws(() => validateCustomLevel(level([placement(containsItem === undefined ? 'key' : containsItem,
      containsItem === undefined ? { containsItem: undefined } : {})])), /valid item or weapon/);
  }
  assert.throws(() => validateCustomLevel(level([{ ...placement(), type: 'soccer-ball' }])), /only supported for Item Cases/);
  assert.equal(JSON.stringify(LEVELS).includes('"item-case"'), false);
});

test('scheduled, grouped, random, fixed and random brick spawns all create Item Cases rather than soccer balls', () => {
  const game = arena([
    placement('battery'),
    placement('key', { time: 1, group: { shape: 'line', count: 3 } }),
    placement('silver', { time: 2, random: true, randomCount: 2 }),
  ]);
  game.update(2);
  assert.equal(game.itemCases.length, 6);
  assert.equal(game.itemCases.filter(item => item.containsItem === 'key').length, 3);
  assert.equal(game.itemCases.filter(item => item.containsItem === 'silver').length, 2);
  for (const fixed of [false, true]) {
    const brick = game.bricks[0];
    brick.spawner = { kind: 'object', type: 'item-case', containsItem: 'anvil',
      ...(fixed ? { x: .2, y: .2 } : {}) };
    game.spawnFromBrick(brick);
    assert.equal(game.itemCases.at(-1).containsItem, 'anvil');
  }
  assert.equal(game.itemCases.length, 8);
  assert.equal(game.soccerBalls.length, 0);
  game.reset();
  assert.equal(game.itemCases.length, 0);
  assert.equal(game.glassBreaks.length, 0);
});

test('unarmed Koshi, passive power-ups and enemies pass through cases without releasing contents', () => {
  const game = arena();
  const item = addCase(game, 'key', 100);
  game.collectItem({ type: 'cat-shield-blue' });
  game.cat.vx = 180;
  game.enemiesSleepUntil = Infinity;
  game.robots.push(game.createCustomSpawn({ time: 0, kind: 'enemy', type: 'mouse', x: .5, y: .5 })[0]);
  const enemy = game.robots[0];
  enemy.x = item.x; enemy.y = item.y;
  const start = { x: enemy.x, y: enemy.y };
  game.update(1);
  assert.ok(game.cat.x > item.x + item.radius);
  assert.equal(enemy.x, start.x);
  assert.equal(enemy.y, start.y);
  assert.equal(game.itemCases.length, 1);
  assert.equal(game.keys, 0);
  assert.equal(game.items.length, 0);
  assert.equal(game.glassBreaks.length, 0);
});

test('every melee weapon strikes in range, consumes one use and releases an uncollected pickup', () => {
  for (const [type, definition] of Object.entries(WEAPONS).filter(([, weapon]) => !weapon.ropeDart)) {
    const game = arena();
    equip(game, type);
    const held = { ...game.weapon };
    const item = addCase(game);
    game.combat(0, game.cat.x, game.cat.y);
    assert.equal(game.itemCases.length, 0, type);
    assert.equal(game.keys, 0, 'extended weapon range does not collect the released item');
    assert.deepEqual(game.items[0], { x: item.x, y: item.y, type: 'key' });
    assert.equal(game.weaponAttacks.at(-1).type, type);
    assert.equal(game.glassBreaks.length, 1);
    assert.equal(game.enemies, 0, 'glass is not an enemy or score source');
    if (definition.seconds) assert.deepEqual(game.weapon, held, 'timed weapons retain their deadline');
    else if (definition.uses === 1) assert.equal(game.weapon, null);
    else assert.equal(game.weapon.uses, held.uses - 1);
    game.cat.x = item.x;
    game.combat(0, game.cat.x, game.cat.y);
    assert.equal(game.keys, 1);
    assert.equal(game.items.length, 0);
    assert.equal(game.glassBreaks.length, 1, 'a case shatters only once');
  }
});

test('unarmed and Boost-only contact never breaks glass, and expired weapons cannot strike', () => {
  for (const mode of ['unarmed', 'boost', 'expired', 'rope-dart']) {
    const game = arena();
    addCase(game, 'key', 0);
    if (mode === 'boost') game.boosted = true;
    if (mode === 'expired') game.weapon = { type: 'axe-silver', expires: game.elapsed };
    if (mode === 'rope-dart') equip(game, 'rope-dart-silver');
    game.combat(0, game.cat.x, game.cat.y);
    assert.equal(game.itemCases.length, 1, mode);
    assert.equal(game.keys, 0);
  }
});

test('weapon reach is bounded, swept strikes cannot tunnel, and the final use cannot break a second case', () => {
  const game = arena();
  equip(game, 'wood');
  const reach = game.cat.radius + OBJECTS['item-case'].radius + 18;
  addCase(game, 'key', reach + .01);
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.itemCases.length, 1);
  addCase(game, 'battery', reach + .02);
  const startX = game.cat.x;
  game.cat.x += 200;
  game.combat(0, startX, game.cat.y);
  assert.equal(game.itemCases.length, 1);
  assert.equal(game.itemCases[0].containsItem, 'battery');
  assert.equal(game.weapon, null);
  assert.equal(game.keys, 1);
});

test('released weapons equip normally and items keep their original collection rules', () => {
  for (const type of ['bronze', 'rope-dart-gold', 'battery', 'treasure-chest']) {
    const game = arena();
    equip(game);
    addCase(game, type, 0);
    game.combat(0, game.cat.x, game.cat.y);
    if (Object.hasOwn(WEAPONS, type)) {
      assert.equal(game.weapon.type, type);
      assert.equal(game.weapon.uses, WEAPONS[type].uses);
    } else if (type === 'battery') assert.equal(game.batteries, 1);
    else {
      assert.equal(game.items[0].keysRequired, 1);
      assert.equal(game.catBlockCollected, false, 'a chest still requires its key');
      game.keys = 1;
      game.combat(0, game.cat.x, game.cat.y);
      assert.equal(game.catBlockCollected, true);
    }
  }
});

test('Rope Dart flight strikes glass, does not stop or spend extra shots, and cannot hit through obstacles', () => {
  const game = arena();
  equip(game, 'rope-dart-silver');
  const item = addCase(game, 'key', 100);
  game.ropeDart = { x: game.cat.x, y: game.cat.y, phase: 'flying', direction: { x: 1, y: 0 }, hit: new Set() };
  const uses = game.weapon.uses;
  game.updateRopeDart(.2, new Map());
  assert.equal(game.itemCases.length, 0);
  assert.equal(game.ropeDart.phase, 'flying');
  assert.equal(game.weapon.uses, uses);
  assert.equal(game.items[0].x, item.x);

  const blocked = arena();
  equip(blocked, 'rope-dart-silver');
  addCase(blocked, 'key', 160);
  blocked.obstructions.push(blocked.createObstruction({ x: blocked.cat.x + 70, y: blocked.cat.y },
    { type: 'obstruction-circle' }));
  blocked.ropeDart = { x: blocked.cat.x, y: blocked.cat.y, phase: 'flying', direction: { x: 1, y: 0 }, hit: new Set() };
  blocked.updateRopeDart(.3, new Map());
  assert.equal(blocked.itemCases.length, 1);
  assert.equal(blocked.ropeDart.phase, 'pulling');
});

test('glass fragments animate for .8 seconds, freeze on pause, finish after victory and reset cleanly', () => {
  const game = arena();
  equip(game);
  addCase(game);
  game.combat(0, game.cat.x, game.cat.y);
  game.update(.2);
  const age = game.glassBreaks[0].age;
  assert.ok(Math.abs(age - .2) < 1e-8);
  game.pause(); game.update(10);
  assert.equal(game.glassBreaks[0].age, age);
  game.resume();
  game.state = 'won';
  game.update(.599);
  assert.equal(game.glassBreaks.length, 1);
  game.update(.001);
  assert.equal(game.glassBreaks.length, 0);
  game.reset();
  assert.equal(game.glassBreaks.length, 0);
});

test('contained Cat Blocks and chests respect Cat Brick validation and never duplicate collected rewards', () => {
  const options = { requireCatBlockConsistency: true };
  assert.throws(() => validateCustomLevel(level([placement('cat-block')])), /Enable Cat Block/);
  for (const type of ['cat-block', 'treasure-chest']) {
    const custom = level([placement(type), placement('key', { x: .2 })], {
      catBlock: { description: 'Find the Cat Block.', messages: CAT_BLOCK_MESSAGES,
        trigger: { type: type === 'cat-block' ? 'spawn' : 'chest' } },
    });
    assert.equal(validateCustomLevel(custom, options).events[0].containsItem, type);
    const game = arena();
    game.catBlockCollected = true;
    equip(game);
    addCase(game, type);
    game.combat(0, game.cat.x, game.cat.y);
    assert.equal(game.items.length, 0);
    assert.equal(game.catBlockEvents.length, 0);
  }
});

test('shared artwork draws square glass around the selected content and twelve fading chunks', () => {
  const calls = [], alpha = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, key) { return key in target ? target[key] : (...args) => calls.push([key, ...args]); },
    set(target, key, value) { target[key] = value; if (key === 'globalAlpha') alpha.push(value); return true; },
  });
  let content;
  drawItemCase(ctx, { x: 20, y: 30, containsItem: 'battery' }, type => { content = type; });
  assert.equal(content, 'battery');
  assert.ok(calls.some(([name, x, y, w, h]) => name === 'strokeRect' && x === -26 && y === -26 && w === 52 && h === 52));
  calls.length = 0;
  drawGlassBreak(ctx, { x: 20, y: 30, age: .4, duration: .8 });
  assert.equal(alpha.at(-1), .5);
  assert.equal(calls.filter(([name]) => name === 'closePath').length, 12);
  assert.match(spawnSymbol(placement()), /H25 V25/);
  assert.equal(spawnColor(placement()), OBJECTS['item-case'].color);
});

test('editor offers case contents, reads them and applies mixed-selection changes without changing unrelated objects', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  for (const id of ['event-contains-item', 'brick-spawn-contains-item']) assert.ok(html.includes(`id="${id}"`));
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', disabled: false });
    return nodes.get(selector);
  };
  const context = vm.createContext({ $, OBJECTS, MIXED: '', selectedEvents: new Set([0, 1, 2]),
    touched: new Set(['#event-contains-item']), level: level([placement('key'), placement('battery'),
      { ...placement(), type: 'soccer-ball', containsItem: undefined }]),
    validateDraft: validateCustomLevel, markChanged() {}, setSelection() {}, message() {}, plural() {} });
  vm.runInContext(source.slice(source.indexOf('function applyToSelected('), source.indexOf('function applyEventChanges(')), context);
  $('#event-contains-item').value = 'silver';
  context.applyToSelected();
  assert.equal(context.level.events[0].containsItem, 'silver');
  assert.equal(context.level.events[1].containsItem, 'silver');
  assert.equal(context.level.events[2].containsItem, undefined);
  vm.runInContext(source.slice(source.indexOf('function readEvent('), source.indexOf('function updateEventPlacement(')), context);
  for (const [selector, value] of Object.entries({
    '#event-time': '2', '#event-kind': 'object', '#event-type': 'item-case', '#event-x': '40', '#event-y': '60',
    '#event-formation': 'single', '#event-location': 'fixed',
  })) $(selector).value = value;
  assert.deepEqual(JSON.parse(JSON.stringify(context.readEvent())), placement('silver', { time: 2, x: .4, y: .6 }));
});

test('the new standalone practice demonstrates a real strike and key pickup in landscape and portrait', () => {
  for (const portrait of [false, true]) {
    const tutorial = new Tutorial();
    const game = tutorial.select(LESSONS.findIndex(lesson => lesson.id === 'item-case'), { portrait });
    const target = tutorial.target;
    assert.equal(game.itemCases.length, 1);
    assert.equal(tutorial.observe(), false);
    assert.equal(tutorial.steer(target.id, target.x + target.w / 2, target.y + target.h / 2), true);
    for (let t = 0; t < 2; t += 1 / 120) { game.update(1 / 120); tutorial.observe(); }
    assert.equal(game.keys, 1);
    assert.equal(game.itemCases.length, 0);
    assert.ok(tutorial.completed.has('item-case'));
  }
});

test('editor point totals include contained weapons and recharge items from events and spawners', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const context = vm.createContext({ WEAPONS });
  vm.runInContext(source.slice(source.indexOf('function pointReference('), source.indexOf('function renderPointReference(')), context);
  const totals = context.pointReference([
    placement('silver', { group: { shape: 'line', count: 3 } }),
    placement('battery'),
  ], [{ absorbedBy: null, spawner: { kind: 'object', type: 'item-case', containsItem: 'bronze' } }]);
  assert.equal(totals.weapons, 4);
  assert.equal(totals.weaponHits, 18);
  assert.equal(totals.weaponSources.scheduled.count, 3);
  assert.equal(totals.weaponSources.spawner.count, 1);
  assert.equal(totals.extra, true);
});
