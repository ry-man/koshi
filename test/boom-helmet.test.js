const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, LEVELS, ITEMS, CAT_BLOCK_MESSAGES, CAT_BLOCK_TRIGGERS, catBlockDescription, validateCustomLevel, levelObjective, brickRegions } = require('../src/game.js');

const blank = () => ({ version: 1, id: 'Boom tests', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [] });
function arena(limit = 4) {
  const game = new Game(() => .5, { customLevel: { ...blank(), activationLimit: limit } });
  game.start(); return game;
}
function aim(game, id) {
  const brick = game.bricks[id];
  return game.steer(id, brick.x + brick.w / 2, brick.y + brick.h / 2);
}

test('optional helmet limits validate, preserve old JSON and campaign content, and explain the fatal boundary', () => {
  assert.deepEqual(validateCustomLevel(blank()), blank());
  for (const activationLimit of [1, 5, 100000, null]) {
    const level = { ...blank(), activationLimit };
    assert.deepEqual(validateCustomLevel(level), level);
  }
  for (const activationLimit of [0, -1, .5, 100001, Infinity, '3', false]) {
    assert.throws(() => validateCustomLevel({ ...blank(), activationLimit }), /Activation limit/);
  }
  assert.match(levelObjective({ ...blank(), activationLimit: 3 }), /Boom Helmet: 3 activations; reaching zero is fatal/);
  assert.match(levelObjective({ ...blank(), goal: 0, survive: true, activationLimit: 3 }), /Survive.+Boom Helmet/);
  assert.ok(LEVELS.slice(0, 19).every(level => level.activationLimit === undefined && level.items.every(([, type]) => !type.startsWith('boom-time'))));
});

test('helmet arrives only after Start, counts only successful activations including redirects and sunglasses, and freezes on pause', () => {
  const game = arena(5);
  game.reset(); assert.equal(game.boomHelmet, null); assert.equal(game.activationsRemaining, 5);
  assert.equal(aim(game, 0), false); assert.equal(game.activationsRemaining, 5);
  game.start(); assert.deepEqual(game.boomHelmet, { age: 0, exploded: false });
  assert.equal(game.steer(0, NaN, 0), false);
  game.bricks[0].kind = 'goal'; assert.equal(aim(game, 0), false);
  game.bricks[1].kind = 'cinder'; assert.equal(aim(game, 1), false);
  assert.equal(aim(game, 2), true); assert.equal(game.activationsRemaining, 4);
  assert.equal(game.moves, 1);
  assert.equal(aim(game, 2), false); assert.equal(game.activationsRemaining, 4);
  assert.equal(aim(game, 3), true); assert.equal(game.activationsRemaining, 3);
  game.collectItem({ type: 'magic-sunglasses' });
  assert.equal(aim(game, 2), true); assert.equal(game.activationsRemaining, 2);
  assert.equal(game.moves, 3, 'redirects and sunglasses selections each add one move');
  game.update(.1);
  const age = game.boomHelmet.age, remaining = game.activationsRemaining;
  game.pause(); game.update(1); assert.equal(aim(game, 4), false);
  assert.equal(game.boomHelmet.age, age); assert.equal(game.activationsRemaining, remaining);
  assert.equal(game.moves, 3, 'pause and rejected selections do not add moves');
  game.resume(); game.update(.1); assert.ok(game.boomHelmet.age > age);
});

test('zero explodes immediately on the last successful activation, bypasses protection and stops gameplay persistently', () => {
  const game = arena(1);
  game.invulnerableUntil = 100;
  game.collectItem({ type: 'magic-sunglasses' });
  assert.equal(aim(game, 0), true);
  assert.equal(game.state, 'lost'); assert.equal(game.activationsRemaining, 0); assert.equal(game.hearts, 0);
  assert.equal(game.moves, 1, 'a successful selection that exhausts the helmet still counts');
  assert.equal(game.boomHelmet.exploded, true); assert.equal(game.boomHelmet.age, 0);
  assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0);
  assert.equal(aim(game, 1), false);
  const elapsed = game.elapsed; game.update(.5);
  assert.equal(game.elapsed, elapsed); assert.equal(game.boomHelmet.age, .5);
  game.collectItem({ type: 'boom-time-blue' }); assert.equal(game.activationsRemaining, 0, 'cannot resurrect an exploded helmet');
  game.reset(); assert.equal(game.activationsRemaining, 1); assert.equal(game.boomHelmet, null); assert.equal(game.hearts, 3);
});

test('physical brick contacts cost no charges; blocked same-position launches do not count', () => {
  const game = arena(3), target = game.bricks[0];
  assert.equal(aim(game, 0), true);
  game.update(3);
  assert.equal(game.activationsRemaining, 2);
  assert.equal(aim(game, target.id), false);
  assert.equal(game.activationsRemaining, 2);
  assert.equal(game.moves, 1, 'physical contacts and blocked launches add no moves');
});

test('merged bricks, Barrier toggles, Boost launches and Toggle activations each cost exactly one charge', () => {
  const game = arena(10);
  const first = game.bricks[0], second = game.bricks[1];
  second.absorbedBy = first.id; second.initialOwner = first.id;
  first.barrier = true;
  const part = game.brickParts().find(part => part.sourceId === second.id);
  assert.equal(game.steer(first.id, part.x + part.w / 2, part.y + part.h / 2), true);
  assert.equal(game.activationsRemaining, 9); assert.equal(game.barriers.length, 1);
  game.cat.vx = 0; game.cat.vy = 0;
  game.cat.x = game.width / 2; game.cat.y = game.height / 2;
  const toggle = game.bricks[4]; toggle.toggle = 1; toggle.toggleRemaining = 1;
  assert.equal(aim(game, toggle.id), false); assert.equal(game.activationsRemaining, 9);
  assert.equal(aim(game, 3), true); assert.equal(game.activationsRemaining, 8);
  assert.equal(toggle.toggleRemaining, 0);
  assert.equal(aim(game, toggle.id), true); assert.equal(game.activationsRemaining, 7);
  const regions = brickRegions(game.bricks, game.width, game.height);
  const boost = game.bricks.find(brick => regions.get(brick.id).edge === 'left' && brick.absorbedBy === null); boost.boost = true;
  game.cat.x = boost.x + boost.w + game.cat.radius; game.cat.y = boost.y + boost.h / 2;
  game.cat.vx = 0; game.cat.vy = 0;
  const target = game.bricks.find(brick => regions.get(brick.id).edge === 'right' && game.brickSelectable(brick));
  assert.equal(aim(game, target.id), true); assert.equal(game.activationsRemaining, 6);
});

test('red/green/blue Boom Time add exactly 1/3/8 helmet counts, not seconds or a new helmet', () => {
  const game = arena(2);
  for (const [type, counts] of [['boom-time-red', 1], ['boom-time-green', 3], ['boom-time-blue', 8]]) {
    const before = game.activationsRemaining;
    game.collectItem({ type });
    assert.equal(ITEMS[type].counts, counts); assert.equal(game.activationsRemaining, before + counts);
    assert.equal(game.timeBonus, 0);
    const unlimited = arena(null);
    unlimited.collectItem({ type });
    assert.equal(unlimited.activationsRemaining, null); assert.equal(unlimited.boomHelmet, null);
  }
});

test('Boom Time placements, lifetimes, pickup sweeps and spawners use existing item semantics', () => {
  const events = ['boom-time-red', 'boom-time-green', 'boom-time-blue'].map((type, i) => ({
    time: 0, kind: 'item', type, x: .5, y: .5, lifetime: 10 + i,
  }));
  const customLevel = { ...blank(), activationLimit: 2, events,
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'item', type: 'boom-time-blue', lifetime: 5 } }] };
  assert.deepEqual(validateCustomLevel(customLevel), customLevel);
  const game = new Game(() => .5, { customLevel }); game.start(); game.update(.01);
  assert.equal(game.activationsRemaining, 14); assert.equal(game.pickups.length, 3);
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  assert.equal(game.items[0].type, 'boom-time-blue'); assert.equal(game.items[0].lifetime, 5);
});

test('editor settings round-trip limit, allow clearing it, and keep it independent of survival', () => {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', listeners: {}, replaceChildren() {}, checkValidity: () => true, addEventListener(type, handler) { this.listeners[type] = handler; } });
    return nodes.get(selector);
  };
  const context = vm.createContext({ $, level: { ...blank(), activationLimit: 8 }, CAT_BLOCK_MESSAGES, CAT_BLOCK_TRIGGERS, catBlockDescription, validateDraft: validateCustomLevel,
    readOnly: () => false, attempt: action => action(), markChanged() {}, render() {}, message() {} });
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf("$('#settings-form').addEventListener"), source.indexOf('function addSceneLine(')), context);
  context.populateSettings(); assert.equal($('#activation-limit').value, 8);
  $('#activation-limit').value = '12'; $('#win-condition').value = 'survive';
  $('#settings-form').listeners.submit({ preventDefault() {} });
  assert.equal(context.level.activationLimit, 12); assert.equal(context.level.survive, true);
  $('#activation-limit').value = '';
  $('#settings-form').listeners.submit({ preventDefault() {} });
  assert.equal(context.level.activationLimit, null);
});
