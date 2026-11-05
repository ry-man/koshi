const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, validateCustomLevel, ITEMS } = require('../src/game.js');
const { spawnSymbol } = require('../src/brick-visuals.js');
const level = events => ({ version: 1, id: 'Mask tests', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events });
function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: level([]) });
  game.start(); return game;
}
function enemyFor(game, type) {
  const enemy = game.createEnemies([0, type, 1])[0];
  Object.assign(enemy, { x: game.width / 2 + 110, y: game.height / 2, phase: 0, angle: 0 });
  game.robots = [enemy];
  return enemy;
}

test('mask placements and spawners round-trip, collect once, and support ground lifetime', () => {
  const custom = { ...level([{ time: 0, kind: 'item', type: 'spooky-mask', x: .5, y: .5, lifetime: 1 }]),
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'item', type: 'spooky-mask', lifetime: 2 } }] };
  assert.deepEqual(validateCustomLevel(custom), custom);
  const game = new Game(() => .5, { customLevel: custom });
  game.start(); game.update(.01);
  assert.equal(game.maskActive, true); assert.ok(Math.abs(game.maskUntil - (10 + 1 / 120)) < 1e-9);
  assert.ok(game.pickups.some(pickup => pickup.type === 'spooky-mask'));
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  assert.equal(game.items[0].type, 'spooky-mask');
  assert.equal(game.items[0].expires, game.elapsed + 2);
  assert.equal(ITEMS['spooky-mask'].name, 'Spooky Mask');
  assert.ok(spawnSymbol({ kind: 'item', type: 'spooky-mask' }).includes('-30'));
});

for (const options of [{}, { portrait: true, scale: .5 }]) {
  for (const type of ['mouse', 'bucket', 'ram']) {
    test(`${type} flees at the shared constant speed within ${options.portrait ? 'portrait' : 'desktop'} bounds`, () => {
      const game = arena(options), enemy = enemyFor(game, type);
      game.collectItem({ type: 'spooky-mask' });
      const initial = Math.hypot(enemy.x - game.cat.x, enemy.y - game.cat.y);
      game.update(.2);
      const moved = Math.hypot(enemy.x - game.cat.x, enemy.y - game.cat.y) - initial;
      assert.ok(Math.abs(moved - .2 * 64) < 1e-6);
      assert.equal(enemy.afraid, true); assert.equal(enemy.fleeMoving, true);
      game.update(8);
      const bounds = game.bounds();
      assert.ok(enemy.x >= bounds.left && enemy.x <= bounds.right && enemy.y >= bounds.top && enemy.y <= bounds.bottom);
    });
  }
}

test('fleeing turns toward Koshi’s changing position rather than keeping the old heading', () => {
  const game = arena(), enemy = enemyFor(game, 'mouse');
  game.collectItem({ type: 'spooky-mask' });
  game.update(.1);
  game.cat.x = enemy.x + 100;
  const before = enemy.x;
  game.update(.9);
  assert.ok(Math.cos(enemy.phase) < -.9);
  assert.ok(enemy.x < before);
});

test('fear overrides Mouse rests and keeps emitting moving sweat', () => {
  const game = arena(), enemy = enemyFor(game, 'mouse');
  enemy.age = 4.5;
  const position = { x: enemy.x, y: enemy.y };
  game.collectItem({ type: 'spooky-mask' });
  game.update(.5);
  assert.equal(enemy.resting, false);
  assert.equal(enemy.fleeMoving, true);
  assert.ok(Math.abs(Math.hypot(enemy.x - position.x, enemy.y - position.y) - 32) < 1e-6);
  game.update(1.1);
  assert.equal(enemy.resting, false); assert.equal(enemy.fleeMoving, true);
});

test('afraid Wheels reverse away from Koshi and remain on the perimeter at the shared fear speed', () => {
  const game = arena(), enemy = enemyFor(game, 'wheel'), bounds = game.bounds();
  enemy.distance = 150; game.placeWheel(enemy);
  game.cat.x = enemy.x + 100; game.cat.y = bounds.top + 80;
  const initialDistance = enemy.distance, separation = Math.hypot(enemy.x - game.cat.x, enemy.y - game.cat.y);
  game.collectItem({ type: 'spooky-mask' }); game.update(.2);
  assert.ok(Math.abs(enemy.distance - (initialDistance - 12.8)) < 1e-6);
  assert.ok(Math.hypot(enemy.x - game.cat.x, enemy.y - game.cat.y) > separation);
  for (let i = 0; i < 100; i++) {
    game.update(.03);
    assert.ok(enemy.x === bounds.left || enemy.x === bounds.right || enemy.y === bounds.top || enemy.y === bounds.bottom);
  }
});

test('afraid Rams move constantly instead of targeting and charging, then resume their cycle at expiry', () => {
  const game = arena(), enemy = enemyFor(game, 'ram');
  enemy.state = 'targeting'; enemy.stateTime = 0; enemy.angle = Math.PI;
  game.collectItem({ type: 'spooky-mask' });
  game.update(.5);
  assert.equal(enemy.state, 'targeting'); assert.equal(enemy.stateTime, 0);
  assert.ok(Math.abs(enemy.x - (game.width / 2 + 142)) < 1e-6);
  game.update(.56);
  assert.equal(enemy.state, 'targeting'); assert.equal(enemy.stateTime, 0);
  const before = { x: enemy.x, y: enemy.y };
  game.update(.02);
  assert.ok(Math.abs(enemy.x - before.x - 1.28) < 1e-6);
  game.cat.y += 80;
  game.update(.02);
  assert.ok(enemy.y < before.y, 'fleeing follows Koshi instead of a locked charge');
  game.robots = [];
  game.update(10);
  game.robots = [enemy]; game.update(.1);
  assert.equal(enemy.afraid, false);
  assert.ok(enemy.stateTime > 0, 'normal targeting resumes after fear');
});

test('a currently charging Ram slows immediately and freezes its charge timer', () => {
  const game = arena(), enemy = enemyFor(game, 'ram');
  enemy.state = 'charging'; enemy.stateTime = .4; enemy.angle = Math.PI; enemy.speed = 300;
  game.collectItem({ type: 'spooky-mask' }); game.update(.02);
  assert.ok(Math.abs(enemy.x - (game.width / 2 + 110 + 1.28)) < 1e-6);
  assert.equal(enemy.speed, 300);
  assert.equal(enemy.stateTime, .4);
});

test('afraid Buckets freeze their throwing timer and resume throwing after expiry', () => {
  const game = arena(), enemy = enemyFor(game, 'bucket');
  enemy.shotTimer = .1;
  game.collectItem({ type: 'spooky-mask' }); game.update(.1);
  assert.equal(enemy.bombs.length, 0); assert.equal(enemy.shotTimer, .1);
  game.update(9.8);
  assert.equal(enemy.bombs.length, 0); assert.equal(enemy.shotTimer, .1);
  game.update(.21);
  assert.ok(enemy.bombs.length > 0);
});

test('all afraid enemies are harmless on contact, and contact damage returns after fear', () => {
  for (const type of ['mouse', 'wheel', 'ram', 'bucket']) {
    const game = arena(), enemy = enemyFor(game, type);
    if (type === 'wheel') game.placeWheel(enemy);
    Object.assign(game.cat, { x: enemy.x, y: enemy.y });
    game.collectItem({ type: 'spooky-mask' });
    game.update(.01);
    assert.equal(game.hearts, 3, `${type} cannot hurt Koshi while afraid`);
    game.maskUntil = game.elapsed;
    enemy.touching = false;
    Object.assign(game.cat, { x: enemy.x, y: enemy.y });
    game.update(.01);
    assert.equal(game.hearts, 2, `${type} contact damage resumes`);
  }
});

test('existing bombs animate but cannot damage Koshi during fear', () => {
  const game = arena(), enemy = enemyFor(game, 'bucket');
  enemy.bombs = [{ x: game.cat.x, y: game.cat.y, state: 'exploding', blastAge: 0, blastRadius: 0, touching: false }];
  game.collectItem({ type: 'spooky-mask' });
  game.update(.1);
  assert.equal(game.hearts, 3);
  assert.ok(enemy.bombs[0].blastAge > 0);
  game.maskUntil = game.elapsed;
  enemy.bombs[0].touching = false;
  game.update(.01);
  assert.equal(game.hearts, 2, 'bomb damage resumes when fear ends');
});

test('sleep takes priority, new spawns fear Koshi, pause freezes, repeat pickups refresh, and expiry resets fear', () => {
  const game = arena(), enemy = enemyFor(game, 'ram');
  enemy.state = 'charging'; enemy.stateTime = .4;
  game.collectItem({ type: 'spooky-mask' }); game.collectItem({ type: 'music-box' });
  const start = { x: enemy.x, y: enemy.y, angle: enemy.angle, stateTime: enemy.stateTime };
  game.update(1);
  assert.deepEqual({ x: enemy.x, y: enemy.y, angle: enemy.angle, stateTime: enemy.stateTime }, start);
  assert.equal(enemy.afraid, true); assert.equal(enemy.fleeMoving, false);
  game.pause(); const pausedAt = game.elapsed;
  game.update(20); assert.equal(game.elapsed, pausedAt);
  game.resume(); game.update(8.99); assert.equal(enemy.asleep, true);
  game.collectItem({ type: 'spooky-mask' });
  game.update(.02); assert.equal(enemy.asleep, false);
  const fresh = game.createEnemies([game.elapsed, 'mouse', 1])[0];
  game.robots = [fresh]; game.update(.01); assert.equal(fresh.afraid, true);
  game.collectItem({ type: 'spooky-mask' });
  game.robots = [];
  game.update(9.9); assert.equal(game.maskActive, true);
  game.update(.1); assert.equal(game.maskActive, false);
  game.robots = [fresh]; game.update(.01); assert.equal(fresh.afraid, false);
  assert.ok(game.maskPickup, 'mask fades after fear expires');
  game.update(.5); assert.equal(game.maskPickup, null);
  game.reset(); assert.equal(game.maskPickup, null); assert.equal(game.maskUntil, 0);
});

test('mask flight and fade finish after gameplay ends without advancing the game clock', () => {
  const game = arena();
  game.collectItem({ type: 'spooky-mask', x: 100, y: 200 });
  game.state = 'won'; game.update(10.5);
  assert.equal(game.maskPickup, null); assert.equal(game.elapsed, 0);
});

test('mask artwork, moving-face flight, fear expressions and flying sweat are wired for every enemy', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const stack = [];
  const ctx = new Proxy({ globalAlpha: 1 }, { get(target, name) {
    if (name in target) return target[name];
    if (name === 'save') return () => stack.push({ ...target });
    if (name === 'restore') return () => {
      assert.ok(stack.length, 'canvas restore must have a matching save');
      Object.assign(target, stack.pop());
    };
    if (name === 'createLinearGradient') return () => ({ addColorStop: (...args) => operations.push(['stop', ...args]) });
    return (...args) => operations.push([name, ...args, target.globalAlpha]);
  } });
  const line = (...args) => operations.push(['line', ...args]);
  const context = vm.createContext({ ctx, line, SHIELDS: {} });
  vm.runInContext(source.slice(source.indexOf('function drawSpookyMask('), source.indexOf('function drawBrickStamp(')), context);
  vm.runInContext(source.slice(source.indexOf('function drawScaredFace('), source.indexOf('function drawEnemyDeath(')), context);
  context.drawSpookyMask();
  assert.equal(operations.filter(([key]) => key === 'stop').length, 3);
  assert.ok(operations.filter(([key]) => key === 'lineTo').length > 30, 'many sharp teeth');
  for (const type of ['mouse', 'wheel', 'ram', 'bucket']) {
    operations.length = 0;
    context.drawRobot({ type, x: 0, y: 0, afraid: true, fleeMoving: true, age: .3, distance: 10, radius: 19 });
    assert.ok(operations.some(([key, , , rx, ry]) => key === 'ellipse' && rx === 5 && ry === 6), `${type} scared eyes`);
    assert.ok(operations.some(([key]) => key === 'bezierCurveTo'), `${type} sweat drops`);
    assert.equal(stack.length, 0, `${type} canvas state is balanced`);
  }
  operations.length = 0;
  context.drawWornMask({ maskPickup: { x: 0, y: 0, age: .25 }, cat: { x: 100, y: 200 } });
  assert.ok(operations.some(([key, x, y]) => key === 'translate' && x === 100 && y === 198));
  operations.length = 0;
  context.drawWornMask({ maskPickup: { x: 0, y: 0, age: 10.25 }, cat: { x: 100, y: 200 } });
  assert.ok(operations.some(([key, , , alpha]) => key === 'translate' && alpha === .5));
  assert.ok(source.includes('if (game.maskPickup) drawWornMask(game)'));
});

test('sweat drops are half-size, appear twice per second, and keep an independent random direction per drop', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  let randomCalls = 0;
  const math = Object.create(Math);
  math.random = () => (++randomCalls % 4) / 4;
  const ctx = new Proxy({ globalAlpha: 1 }, { get(target, key) {
    if (key in target) return target[key];
    return (...args) => operations.push([key, ...args]);
  } });
  const context = vm.createContext({ ctx, Math: math });
  vm.runInContext(source.slice(source.indexOf('const fearSweatDrops ='), source.indexOf('function drawRobot(')), context);
  const enemy = { x: 100, y: 100, age: .1, radius: 19 };
  context.drawFearSweat(enemy);
  const first = operations.find(([key]) => key === 'rotate')[1];
  assert.ok(operations.some(([key, x, y]) => key === 'moveTo' && x === 0 && y === -2.5));
  operations.length = 0;
  enemy.age = .2; context.drawFearSweat(enemy);
  assert.equal(operations.find(([key]) => key === 'rotate')[1], first);
  assert.equal(randomCalls, 1, 'direction stays stable across frames and pauses');
  operations.length = 0;
  enemy.age = .45; context.drawFearSweat(enemy);
  assert.equal(operations.length, 0, 'gap between drops reduces density');
  enemy.age = .6; context.drawFearSweat(enemy);
  assert.notEqual(operations.find(([key]) => key === 'rotate')[1], first);
  assert.equal(randomCalls, 2);
  context.drawFearSweat({ ...enemy });
  assert.equal(randomCalls, 3, 'each enemy has independent drops');
  for (const age of [1.1, 1.6]) { enemy.age = age; context.drawFearSweat(enemy); }
  assert.equal(randomCalls, 5, 'two new drops per second');
});
