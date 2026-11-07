const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, SPEED, CONVEYOR_SPEED, LEVELS, validateCustomLevel, brickRegions } = require('../src/game.js');
const visuals = require('../src/brick-visuals.js');
const { GUIDE } = require('../src/learning.js');
const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const level = events => ({ version: 1, id: 'Kitty Cape tests', duration: 60, goal: 1000,
  heartCost: null, brickSet: 1, events });
function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: level([]) });
  game.start();
  return game;
}
const aim = (game, brick) => game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2);
const speed = game => Math.hypot(game.cat.vx, game.cat.vy);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test('cape placements and spawners round-trip, collect once, expire on the ground, and leave campaign unchanged', () => {
  const custom = { ...level([{ time: 0, kind: 'item', type: 'kitty-cape', x: .5, y: .5, lifetime: 1 }]),
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'item', type: 'kitty-cape', lifetime: 2 } }] };
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(custom))), custom);
  const game = new Game(() => .5, { customLevel: custom });
  game.start(); game.update(.01);
  assert.equal(game.capeActive, true);
  assert.equal(game.capeUntil - game.capeStart, 10);
  game.update(.1);
  assert.equal(game.pickups.filter(pickup => pickup.type === 'kitty-cape').length, 1);
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  assert.equal(game.items[0].type, 'kitty-cape');
  assert.equal(game.items[0].expires, game.elapsed + 2);
  game.update(2);
  assert.equal(game.items.length, 0);
  assert.equal(game.capeActive, true, 'ground lifetime does not shorten the collected power');
  assert.ok(visuals.spawnSymbol({ kind: 'item', type: 'kitty-cape' }));
  assert.equal(visuals.spawnColor({ kind: 'item', type: 'kitty-cape' }), '#b5d77c');
  assert.ok(GUIDE.flatMap(chapter => chapter.sections).some(([, , picture]) => picture === 'item:kitty-cape'));
  for (const campaign of LEVELS.filter(level => ['1', '2'].includes(level.worldId))) {
    assert.ok(!campaign.items.some(([, type]) => type === 'kitty-cape'));
    assert.ok(!(campaign.events ?? []).some(event => event.type === 'kitty-cape'));
    assert.ok(!campaign.brickTypes.some(brick => brick.spawner?.type === 'kitty-cape'));
  }
});

for (const options of [{}, { portrait: true, scale: .31 }]) {
  test(`cape doubles current flight and redirects without tunneling in ${options.portrait ? 'portrait' : 'landscape'}`, () => {
    const game = arena(options), [first, second] = game.bricks;
    assert.equal(aim(game, first), true);
    const velocity = { x: game.cat.vx, y: game.cat.vy };
    const position = { x: game.cat.x, y: game.cat.y };
    game.collectItem({ type: 'kitty-cape' });
    near(game.cat.vx, velocity.x * 2); near(game.cat.vy, velocity.y * 2);
    game.update(.01);
    near(Math.hypot(game.cat.x - position.x, game.cat.y - position.y), SPEED * 2 * .01);
    assert.equal(aim(game, second), true);
    near(speed(game), SPEED * 2);
    game.update(1);
    near(speed(game), 0);
    assert.equal(game.state, 'playing', 'swept collision still stops at the brick');
  });
}

test('cape lasts exactly ten seconds, refreshes without stacking, freezes on pause, and restores in-flight speed', () => {
  const game = arena();
  game.cat.vx = 3; game.cat.vy = 4;
  game.collectItem({ type: 'kitty-cape' });
  near(speed(game), 10);
  game.update(9);
  game.collectItem({ type: 'kitty-cape' });
  near(speed(game), 10);
  near(game.capeUntil, 19);
  assert.equal(game.capePickup.age, 0);
  game.pause(); game.update(30);
  near(game.elapsed, 9); near(speed(game), 10);
  assert.equal(game.capePickup.age, 0);
  game.resume(); game.update(9.99);
  assert.equal(game.capeActive, true); near(speed(game), 10);
  game.update(.01);
  assert.equal(game.capeActive, false);
  assert.equal(game.capePickup, null);
  near(game.cat.vx, 3); near(game.cat.vy, 4);
  game.reset();
  assert.equal(game.capeStart, null); assert.equal(game.capeUntil, 0);
  assert.equal(game.capePickup, null); assert.equal(game.capeFlightMultiplier, 1);
});

test('cape, music and sunglasses timers remain independent', () => {
  const game = arena();
  game.collectItem({ type: 'music-box' });
  game.collectItem({ type: 'magic-sunglasses' });
  game.update(2);
  game.collectItem({ type: 'kitty-cape' });
  near(game.musicStreamUntil, 10); near(game.sunglassesUntil, 10); near(game.capeUntil, 12);
  game.update(8);
  assert.equal(game.sunglassesActive, false); assert.equal(game.capeActive, true);
  game.update(2); assert.equal(game.capeActive, false);
});

test('cape multiplies Boost launches and expires back to the original boosted speed', () => {
  const game = arena(), brick = game.bricks.find(brick => brickRegions(game.bricks, game.width, game.height).get(brick.id).edge === 'top');
  brick.boost = true;
  game.cat.x = brick.x + brick.w / 2;
  game.cat.y = brick.y + brick.h + game.cat.radius;
  assert.equal(game.boostReady, true);
  game.collectItem({ type: 'kitty-cape' });
  const bottom = game.bricks.find(brick => brickRegions(game.bricks, game.width, game.height).get(brick.id).edge === 'bottom');
  assert.equal(aim(game, bottom), true);
  assert.equal(game.boosted, true); near(speed(game), SPEED * 4);
  game.elapsed = game.capeUntil - .01;
  game.update(.01);
  assert.equal(game.capeActive, false); near(speed(game), SPEED * 2);
});

test('spring bounces and portals retain cape speed, while conveyor rides stay at belt speed', () => {
  const game = arena(), regions = brickRegions(game.bricks, game.width, game.height);
  const top = game.bricks.find(brick => regions.get(brick.id).edge === 'top');
  const bottom = game.bricks.find(brick => regions.get(brick.id).edge === 'bottom');
  top.springs = true;
  game.cat.x = top.x + top.w / 2;
  game.cat.y = top.y + top.h + game.cat.radius + 10;
  game.cat.vy = -SPEED;
  game.collectItem({ type: 'kitty-cape' });
  game.update(.03);
  assert.ok(game.cat.vy > 0); near(speed(game), SPEED * 2);
  top.portal = bottom.portal = 'red';
  assert.equal(game.travelPortal(top, game.brickParts()), true);
  near(speed(game), SPEED * 2);
  top.portal = bottom.portal = null;
  top.springs = false; top.conveyor = true; top.conveyorDirection = 'clockwise';
  game.cat.x = top.x + top.w / 2;
  game.cat.y = top.y + top.h + game.cat.radius + 10;
  game.cat.vx = 0; game.cat.vy = -SPEED * 2;
  game.update(.03);
  assert.deepEqual(game.conveyorRide, { id: top.id });
  near(speed(game), CONVEYOR_SPEED);
  game.collectItem({ type: 'kitty-cape' });
  near(speed(game), CONVEYOR_SPEED);
  top.portal = bottom.portal = 'blue';
  game.portalUntil = 0; game.portalArrival = null;
  assert.equal(game.travelPortal(top, game.brickParts()), true);
  near(speed(game), CONVEYOR_SPEED * 2, 'leaving the belt starts accelerated flight');
  game.elapsed = game.capeUntil - .01;
  game.update(.01);
  near(speed(game), CONVEYOR_SPEED, 'expiry restores the pre-cape launch speed');
});

function drawingContext(game) {
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1, strokeStyle: '', fillStyle: '',
    createLinearGradient: () => ({ addColorStop: (...args) => operations.push({ name: 'colorStop', args }) }) }, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => operations.push({ name, args, alpha: target.globalAlpha });
    },
  });
  const context = vm.createContext({ ctx, game });
  vm.runInContext(source.slice(source.indexOf('function drawKittyCape('), source.indexOf('function drawMagicSunglasses(')), context);
  return { context, operations };
}

test('green cape renders on pickup and behind Koshi; cat/lightning banner scrolls for the full ten seconds in both layouts', () => {
  assert.match(source, /item.type === 'kitty-cape'[\s\S]*?drawKittyCape/);
  assert.ok(source.indexOf('drawCapeStream(game, streamRows.cape);') < source.indexOf('for (const food of game.food)'));
  assert.ok(source.indexOf('drawWornCape(game, game.cat.x, game.cat.y);') < source.indexOf('drawCat(game.cat.x'));
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = arena(options), { context, operations } = drawingContext(game);
    context.drawKittyCape(0);
    assert.deepEqual(operations.filter(op => op.name === 'colorStop').map(op => op.args), [[0, '#b5d77c'], [1, '#45634d']]);
    operations.length = 0; context.drawCapeStream(game);
    assert.equal(operations.length, 0);
    game.collectItem({ type: 'kitty-cape' });
    context.drawWornCape(game, game.cat.x, game.cat.y);
    assert.ok(operations.some(op => op.name === 'fill'));
    operations.length = 0; context.drawCapeStream(game);
    const frame = operations.find(op => op.name === 'strokeRect');
    assert.deepEqual(frame.args, [-18, -26, Math.max(game.width, game.height) + 36, 52]); assert.equal(frame.alpha, .25);
    assert.ok(operations.some(op => op.name === 'quadraticCurveTo'), 'smiling cat heads');
    assert.ok(operations.some(op => op.name === 'lineTo' && op.args[0] === -10 && op.args[1] === 2), 'lightning bolts');
    game.update(5);
    operations.length = 0; context.drawCapeStream(game);
    assert.deepEqual(operations.find(op => op.name === 'translate').args, options.portrait
      ? [game.width / 2, 0] : [-(game.width + 36) / 2, game.height / 2]);
    game.pause(); game.update(3);
    operations.length = 0; context.drawCapeStream(game);
    assert.deepEqual(operations.find(op => op.name === 'translate').args, options.portrait
      ? [game.width / 2, 0] : [-(game.width + 36) / 2, game.height / 2]);
    game.resume(); game.update(5);
    operations.length = 0; context.drawCapeStream(game); context.drawWornCape(game, 0, 0);
    assert.equal(operations.length, 0);
  }
});

for (const terminal of ['won', 'lost']) {
  test(`cape visuals finish after ${terminal} without advancing gameplay`, () => {
    const game = arena(), { context, operations } = drawingContext(game);
    game.collectItem({ type: 'kitty-cape' });
    game.state = terminal; game.update(5);
    context.drawCapeStream(game);
    assert.deepEqual(operations.find(op => op.name === 'translate').args, [-(game.width + 36) / 2, game.height / 2]);
    game.update(5);
    assert.equal(game.elapsed, 0); assert.equal(game.capePickup, null);
    operations.length = 0; context.drawCapeStream(game);
    assert.equal(operations.length, 0);
  });
}
