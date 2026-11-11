const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, LEVELS, OBJECTS, OBSTRUCTION_RADIUS, OBSTRUCTION_PATTERNS, OBSTRUCTION_SIZES, obstructionGeometry,
  obstructionPresetGeometry, obstructionSpikes, obstructionSurface, obstructionVertices, validateCustomLevel,
  snapWheel, brickRegions, brickEditRegions, COOLDOWNS } = require('../src/game.js');
const { drawObstruction, spawnSymbol, spawnColor } = require('../src/brick-visuals.js');

const blank = () => ({ version: 1, id: 'Obstruction tests', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [] });
const placement = (shape = 'circle', extra = {}) => ({ time: 0, kind: 'object', type: `obstruction-${shape}`, x: .5, y: .5, ...extra });
const shapes = ['circle', 'diamond', 'rectangle', 'pentagon', 'hexagon', 'octagon', 'v', 'oval'];
function arena(level = blank()) {
  const game = new Game(() => .5, { customLevel: level });
  game.cat.x = 100; game.cat.y = 100;
  game.start();
  return game;
}

function gap(actor, obstruction) {
  return obstructionSurface(actor.x, actor.y, obstruction).gap - actor.radius;
}

test('one object per shape supports every texture, schedules, spawners, persistence and restart', () => {
  assert.deepEqual(Object.keys(OBJECTS).filter(type => OBJECTS[type].obstruction), shapes.map(shape => `obstruction-${shape}`));
  for (const shape of shapes) for (const pattern of OBSTRUCTION_PATTERNS) {
    const appearance = { color: '#fe107e', patternColor: '#15ffe2', pattern };
    const level = { ...blank(), events: [placement(shape, appearance)],
      brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'object', type: `obstruction-${shape}`, ...appearance } }] };
    assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(level))), level);
    const game = arena(level);
    game.update(.01);
    assert.equal(game.obstructions.length, 1);
    assert.equal(game.soccerBalls.length, 0);
    assert.deepEqual(obstructionGeometry(game.obstructions[0]), obstructionGeometry(placement(shape)));
    for (const field of Object.keys(appearance)) assert.equal(game.obstructions[0][field], appearance[field]);
    game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
    game.update(2);
    assert.equal(game.obstructions.length, 2);
    assert.equal(game.obstructions[1].pattern, pattern);
    assert.equal(game.obstructions[1].color, appearance.color);
    game.pause(); game.update(5);
    assert.equal(game.obstructions.length, 2);
    game.reset();
    assert.equal(game.obstructions.length, 0);
    assert.ok(spawnSymbol(placement(shape)));
    assert.equal(spawnColor(placement(shape, appearance)), appearance.color);
  }
  assert.ok(LEVELS.filter(level => ['1', '2'].includes(level.worldId)).every(level => !(level.events ?? []).some(event => OBJECTS[event.type]?.obstruction)));
});

test('all obstruction shapes offer consistent size presets and independent dimensions except circles', () => {
  assert.deepEqual(Object.keys(OBJECTS).filter(type => OBJECTS[type].obstruction),
    shapes.map(shape => `obstruction-${shape}`));
  for (const shape of shapes) {
    const type = `obstruction-${shape}`;
    const geometry = obstructionGeometry({ type }), preset = obstructionPresetGeometry(type, 'medium');
    assert.deepEqual({ width: geometry.width, height: geometry.height }, preset);
    for (const size of OBSTRUCTION_SIZES) {
      const { width, height } = obstructionPresetGeometry(type, size);
      assert.ok(width > 0 && height > 0);
      if (shape === 'circle') assert.equal(width, height);
    }
    const resized = obstructionGeometry(placement(shape, { width: 231, height: 83 }));
    assert.equal(resized.width, 231);
    assert.equal(resized.height, shape === 'circle' ? 231 : 83);
  }
});

test('new obstruction shapes collide as solid geometry and rotation changes world-space bounds', () => {
  for (const shape of shapes) {
    const game = arena();
    const obstruction = game.createObstruction({ x: 480, y: 300 },
      placement(shape, { width: 140, height: shape === 'circle' ? 140 : 90, rotation: 30 }));
    if (shape === 'v') assert.ok(obstructionVertices(obstruction).length > 7, 'V corners are rounded');
    const point = shape === 'v' ? { x: 480, y: 335 } : { x: 480, y: 300 };
    assert.ok(obstructionSurface(point.x, point.y, obstruction).gap < 0, `${shape} contains its test point`);
  }
  const game = arena();
  const obstruction = game.createObstruction({ x: 480, y: 300 },
    placement('rectangle', { width: 200, height: 40, rotation: 90 }));
  const side = obstructionSurface(510, 300, obstruction);
  assert.equal(side.gap, 10);
  assert.ok(Math.abs(side.nx - 1) < 1e-8);
  assert.ok(Math.abs(side.ny) < 1e-8);
});

test('legacy obstruction IDs normalize to the new shape types with explicit dimensions', () => {
  const legacy = [
    ['obstruction-circle-large', 'obstruction-circle', 192, 192],
    ['obstruction-diamond-large', 'obstruction-diamond', 192, 192],
    ['obstruction-rectangle-horizontal', 'obstruction-rectangle', 192, 48],
    ['obstruction-rectangle-vertical', 'obstruction-rectangle', 48, 192],
    ['obstruction-rectangle-horizontal-large', 'obstruction-rectangle', 384, 96],
    ['obstruction-rectangle-vertical-large', 'obstruction-rectangle', 96, 384],
  ];
  for (const [oldType, type, width, height] of legacy) {
    const source = { ...blank(), events: [{ ...placement(), type: oldType }],
      brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
        spawner: { kind: 'object', type: oldType } }] };
    const normalized = validateCustomLevel(source);
    assert.deepEqual(normalized.events[0], { ...placement(), type, width, height });
    assert.deepEqual(normalized.brickTypes[0].spawner, { kind: 'object', type, width, height });
  }
});

test('custom obstruction dimensions and destructibility round-trip in events and spawners without changing defaults', () => {
  for (const shape of shapes) {
    const rectangle = shape.includes('rectangle');
    const attributes = { width: 150.5, height: rectangle ? 47.25 : 150.5, destructible: true, spiked: true };
    const source = { ...blank(), events: [placement(shape, attributes)],
      brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'object', type: `obstruction-${shape}`, ...attributes } }] };
    const validated = validateCustomLevel(JSON.parse(JSON.stringify(source)));
    assert.deepEqual(validated, source);
    const game = arena(validated);
    game.update(.01);
    game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
    game.update(2);
    assert.equal(game.obstructions.length, 2);
    for (const obstruction of game.obstructions) {
      assert.equal(obstruction.width, 150.5);
      assert.equal(obstruction.height, attributes.height);
      assert.equal(obstruction.destructible, true);
      assert.equal(obstruction.spiked, true);
    }
  }
  assert.deepEqual(obstructionGeometry(placement('diamond', { height: 70 })), { radius: 48, width: 96, height: 70 });
  for (const field of ['width', 'height']) for (const invalid of [0, -1, Infinity, '40', 10001]) {
    assert.throws(() => validateCustomLevel({ ...blank(), events: [placement('circle', { [field]: invalid })] }), /invalid obstruction/);
  }
  assert.throws(() => validateCustomLevel({ ...blank(), events: [placement('circle', { width: 50, height: 60 })] }), /equal width/);
  for (const rotation of [0, 10, 350]) {
    assert.equal(validateCustomLevel({ ...blank(), events: [placement('rectangle', { rotation })] }).events[0].rotation, rotation);
  }
  for (const rotation of [-10, 15, 360, '10']) {
    assert.throws(() => validateCustomLevel({ ...blank(), events: [placement('rectangle', { rotation })] }), /invalid obstruction rotation/);
  }
  assert.throws(() => validateCustomLevel({ ...blank(), events: [placement('circle', { destructible: 'true' })] }), /invalid obstruction/);
  assert.throws(() => validateCustomLevel({ ...blank(), events: [{ ...placement(), type: 'soccer-ball', width: 50 }] }), /only supported/);
  assert.equal(arena().createObstruction({ x: 300, y: 300 }, placement()).destructible, false);
});

test('spiked flags validate strictly for obstruction placements and spawners and default off', () => {
  for (const spiked of [true, false]) {
    const source = { ...blank(), events: [placement('circle', { spiked })],
      brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
        spawner: { kind: 'object', type: 'obstruction-diamond', spiked } }] };
    assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(source))), source);
  }
  for (const spiked of ['true', 1, null, {}]) {
    assert.throws(() => validateCustomLevel({ ...blank(), events: [placement('circle', { spiked })] }), /invalid obstruction spiked/);
    assert.throws(() => validateCustomLevel({ ...blank(), brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'object', type: 'obstruction-circle', spiked } }] }), /invalid obstruction spiked/);
  }
  assert.throws(() => validateCustomLevel({ ...blank(), events: [{ ...placement(), type: 'soccer-ball', spiked: true }] }), /only supported for obstructions/);
  assert.equal(arena().createObstruction({ x: 300, y: 300 }, placement()).spiked, false);
  assert.deepEqual(obstructionSpikes(placement()), []);
});

test('spikes cover every obstruction exterior and damage only on new contact, including resized shapes', () => {
  for (const shape of shapes) for (const size of [undefined, 80]) {
    const game = arena(), obstruction = game.createObstruction({ x: 480, y: 300 },
      placement(shape, { spiked: true, ...(size ? { width: size, height: size } : {}) }));
    game.obstructions.push(obstruction);
    const triangles = obstructionSpikes(obstruction);
    assert.ok(triangles.length >= 3);
    for (const triangle of triangles) {
      game.hearts = 100;
      const [[ax, ay], [tx, ty], [bx, by]] = triangle;
      const mx = (ax + bx) / 2, my = (ay + by) / 2, length = Math.hypot(tx - mx, ty - my);
      assert.ok(length > 0 && length < 16);
      const nx = (tx - mx) / length, ny = (ty - my) / length;
      const far = { x: tx + nx * (game.cat.radius + 40), y: ty + ny * (game.cat.radius + 40) };
      Object.assign(game.cat, far);
      game.obstructionSpikeTouching.clear();
      game.updateObstructionSpikeDamage(far.x, far.y);
      const before = game.hearts;
      Object.assign(game.cat, { x: tx + nx * (game.cat.radius - 1), y: ty + ny * (game.cat.radius - 1) });
      game.obstructionSpikeTouching.clear();
      game.invulnerableUntil = -Infinity;
      game.updateObstructionSpikeDamage(far.x, far.y);
      assert.equal(game.hearts, before - 1, `${shape} exterior tip hurts Koshi`);
      game.hearts = before;
      game.invulnerableUntil = -Infinity;
      game.updateObstructionSpikeDamage(game.cat.x, game.cat.y);
      assert.equal(game.hearts, before, 'resting contact never drains extra hearts');
    }
    game.reset();
    assert.equal(game.obstructionSpikeTouching.size, 0);
  }
});

test('spiked obstructions deal contact damage during gameplay without changing solid movement', () => {
  for (const shape of shapes) for (const spiked of [false, true]) {
    const game = arena();
    const obstruction = game.createObstruction({ x: 480, y: 300 }, placement(shape, { spiked }));
    game.obstructions.push(obstruction);
    Object.assign(game.cat, { x: 100, y: 300, vx: 900, vy: 0 });
    const before = game.hearts;
    for (let frame = 0; frame < 60; frame++) game.update(1 / 120);
    assert.equal(game.hearts, before - Number(spiked), shape);
    assert.equal(game.cat.vx, 900, 'solid contact preserves intended velocity');
    assert.ok(gap(game.cat, obstruction) >= -1e-5);
    game.invulnerableUntil = -Infinity;
    game.update(1 / 120);
    assert.equal(game.hearts, before - Number(spiked));
  }
});

test('spike damage respects shields, invulnerability, pauses and moving obstruction contact', () => {
  const game = arena();
  const obstruction = game.createObstruction({ x: 480, y: 300 }, placement('circle', { spiked: true }));
  game.obstructions.push(obstruction);
  Object.assign(game.cat, { x: 480 - obstruction.radius - game.cat.radius, y: 300 });
  const before = game.hearts;
  game.catShield = 'red';
  game.updateObstructionSpikeDamage(game.cat.x, game.cat.y);
  assert.equal(game.hearts, before); assert.equal(game.catShield, null);
  game.obstructionSpikeTouching.clear();
  game.updateObstructionSpikeDamage(game.cat.x, game.cat.y);
  assert.equal(game.hearts, before, 'invulnerability protects');
  game.invulnerableUntil = -Infinity;
  game.obstructionSpikeTouching.clear();
  game.pause(); game.update(2);
  assert.equal(game.hearts, before, 'pause does not damage');
  game.resume();
  Object.assign(game.cat, { x: 480, y: 200 });
  Object.assign(obstruction, { x: 700, y: 200, previousX: 250, previousY: 200, track: 'moving' });
  game.updateObstructionSpikeDamage(game.cat.x, game.cat.y);
  assert.equal(game.hearts, before - 1, 'a moving spiked solid cannot sweep through Koshi harmlessly');
});

test('resized circle, diamond and rectangle collisions use their exact new dimensions', () => {
  for (const shape of ['circle', 'diamond', 'rectangle']) {
    const game = arena(), rectangle = shape.includes('rectangle');
    const obstruction = game.createObstruction({ x: 480, y: 300 }, placement(shape, { width: 200, height: rectangle ? 60 : 200 }));
    game.obstructions.push(obstruction);
    for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const old = { x: 480 + nx * 250, y: 300 + ny * 250 };
      const actor = { x: 480 - nx * 250, y: 300 - ny * 250, radius: 21, vx: -nx * 1000, vy: -ny * 1000 };
      game.moveAroundObstructions(actor, old);
      assert.ok(Math.abs(gap(actor, obstruction)) < 1e-4);
      assert.equal(actor.vx, -nx * 1000);
      assert.equal(actor.vy, -ny * 1000);
    }
  }
});

test('appearing solids destroy overlapping enemies and collectibles and instantly kill protected Koshi', () => {
  for (const shape of ['circle', 'diamond', 'rectangle']) {
    const game = arena();
    const obstruction = game.createObstruction({ x: 480, y: 300 }, placement(shape, { width: 200, height: shape.includes('rectangle') ? 60 : 200 }));
    const actor = () => ({ x: 490, y: 305, radius: 14, vx: 123, vy: -40, expires: 25 });
    Object.assign(game.cat, actor(), { radius: 21 });
    game.invulnerableUntil = 100;
    game.activeTurret = { type: 'laser' };
    game.robots = [{ ...actor(), type: 'mouse', radius: 19, shield: 'blue' }];
    const safe = { ...actor(), x: 800, y: 500 };
    for (const field of ['food', 'weapons', 'items', 'healing', 'soccerBalls', 'bubbles', 'bumpers']) game[field] = [actor(), safe];
    game.obstructions.push(obstruction);
    game.clearAppearingObstruction(obstruction);
    assert.equal(game.hearts, 0); assert.equal(game.state, 'lost');
    assert.equal(game.tookDamage, true);
    assert.equal(game.cat.x, 490); assert.equal(game.cat.y, 305);
    assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0);
    assert.equal(game.robots.length, 0); assert.equal(game.enemyDeaths.length, 1);
    assert.equal(game.enemies, 0);
    for (const field of ['food', 'weapons', 'items', 'healing', 'soccerBalls', 'bubbles', 'bumpers']) assert.deepEqual(game[field], [safe]);
    game.clearAppearingObstruction(obstruction);
    assert.equal(game.enemyDeaths.length, 1, 'destroyed enemies are processed only once');
  }
});

test('arrival destruction includes simultaneous custom collectibles and whole boundary enemies', () => {
  for (const shape of ['circle', 'diamond', 'rectangle']) {
    const events = [placement(shape, { time: 1, x: .5, y: 0, width: 200, height: shape.includes('rectangle') ? 60 : 200 }),
      { time: 1, kind: 'item', type: 'smiley-cookie', x: .5, y: 0 }];
    const game = arena({ ...blank(), events });
    for (const type of ['wheel', 'snake', 'robo-cow']) game.robots.push(game.createCustomSpawn({ kind: 'enemy', type, x: .5, y: 0 })[0]);
    game.elapsed = 1; game.spawnCustomEvents();
    assert.equal(game.items.length, 0);
    assert.equal(game.robots.length, 0);
    assert.equal(game.enemyDeaths.length, 3);
    assert.equal(game.state, 'playing');
  }
});

test('scheduled and spawner arrivals end play immediately before movement, healing, or objective checks', () => {
  for (const spawner of [false, true]) for (const options of [{}, { portrait: true, scale: .3 }]) {
    const level = { ...blank(), events: spawner ? [] : [placement('circle', { time: 2 })] };
    const game = new Game(() => .5, { ...options, customLevel: level });
    game.start();
    if (spawner) {
      game.bricks[0].spawner = { kind: 'object', type: 'obstruction-circle' };
      game.spawnFromBrick(game.bricks[0]);
    }
    const cue = game.spawnCues.find(cue => cue.obstruction);
    Object.assign(game.cat, { x: cue.x, y: cue.y });
    game.invulnerableUntil = 100;
    game.score = 0;
    game.update(1.99);
    assert.equal(game.state, 'playing');
    game.elapsed = 2 - 1 / 120;
    Object.assign(game.cat, { vx: 100, vy: 100 });
    game.score = 1000;
    game.healing.push({ x: cue.x, y: cue.y });
    game.update(.02);
    assert.equal(game.hearts, 0);
    assert.equal(game.state, 'lost', 'loss takes priority over completed objectives and nearby healing');
    assert.equal(game.cat.x, cue.x); assert.equal(game.cat.y, cue.y);
    assert.equal(game.tickStart, null);
    game.update(1);
    assert.equal(game.hearts, 0);
    game.reset();
    assert.equal(game.hearts, 3); assert.equal(game.state, 'ready');
  }
});

test('arrival hits use exact shapes and destroy a whole snake when only its tail overlaps', () => {
  const game = arena();
  const snake = game.createCustomSpawn({ kind: 'enemy', type: 'snake', x: .7, y: 0 })[0];
  game.robots.push(snake);
  const tail = game.snakeSegments(snake).at(-1);
  const obstruction = game.createObstruction(tail, placement('circle', { width: 10 }));
  game.obstructions.push(obstruction);
  assert.ok(gap(snake, obstruction) > 0);
  game.clearAppearingObstruction(obstruction);
  assert.equal(game.robots.length, 0); assert.equal(game.enemyDeaths[0].type, 'snake');
  assert.equal(game.enemyDeaths[0].segments.length, 4);
  const diamond = game.createObstruction({ x: 480, y: 300 }, placement('diamond', { width: 200 }));
  const safe = { x: 575, y: 395, radius: 14 };
  game.items.push(safe);
  game.clearAppearingObstruction(diamond);
  assert.ok(game.items.includes(safe), 'empty diamond bounding-box corners do not destroy items');
});
test('fireball damage intersects the full obstruction shape, including tangency, but skips diamond empty corners', () => {
  for (const shape of ['circle', 'diamond', 'rectangle']) {
    const game = arena();
    const obstruction = game.createObstruction({ x: 480, y: 300 }, placement(shape, { width: 240, height: shape.includes('rectangle') ? 60 : 240, destructible: true }));
    game.obstructions.push(obstruction);
    game.detonateTurretFireball({ x: 480 + 120 + 117 + .01, y: 300 });
    assert.equal(game.obstructions.length, 1);
    game.detonateTurretFireball({ x: 480 + 120 + 117, y: 300 });
    assert.equal(game.obstructions.length, 0);
    assert.equal(game.obstructionDestructions.length, 1);
    assert.equal(game.obstructionDestructions[0].width, 240);
    game.detonateTurretFireball({ x: 480, y: 300 });
    assert.equal(game.obstructionDestructions.length, 1, 'never destroy twice');
  }
  const game = arena();
  game.obstructions.push(game.createObstruction({ x: 480, y: 300 }, placement('diamond', { width: 400, destructible: true })));
  game.detonateTurretFireball({ x: 680, y: 500 });
  assert.equal(game.obstructions.length, 1, 'empty bounding-box corners are not diamond material');
  game.detonateTurretFireball({ x: 480, y: 300 });
  assert.equal(game.obstructions.length, 0);
  game.obstructions.push(game.createObstruction({ x: 480, y: 300 }, placement()));
  game.detonateTurretFireball({ x: 480, y: 300 });
  assert.equal(game.obstructions.length, 1, 'default obstructions remain indestructible');
});

test('obstruction destruction animations freeze on pause, finish after victory and clear on reset', () => {
  const game = arena({ ...blank(), events: [placement('circle', { destructible: true })] });
  game.update(.01);
  const obstruction = game.obstructions[0];
  game.detonateTurretFireball(obstruction);
  game.update(.2);
  const effect = game.obstructionDestructions[0], age = effect.age;
  game.pause(); game.update(2);
  assert.equal(effect.age, age);
  game.resume(); game.state = 'won'; game.update(.3);
  assert.ok(effect.age > age);
  game.update(1);
  assert.equal(game.obstructionDestructions.length, 0);
  game.reset(); game.start(); game.update(.01);
  assert.equal(game.obstructions.length, 1);
  game.detonateTurretFireball(game.obstructions[0]);
  game.reset();
  assert.equal(game.obstructionDestructions.length, 0);
});

test('every obstruction variant blocks swept motion from all four sides without altering velocity', () => {
  for (const shape of shapes) for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const game = arena(), obstruction = game.createObstruction({ x: 480, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    const old = { x: 480 + nx * 280, y: 300 + ny * 280 };
    const actor = { x: 480 - nx * 280, y: 300 - ny * 280, radius: 21, vx: -nx * 5000, vy: -ny * 5000 };
    game.moveAroundObstructions(actor, old, true);
    assert.ok(Math.abs(gap(actor, obstruction)) < 1e-4, `${shape} stops at its actual surface`);
    assert.equal(actor.vx, -nx * 5000); assert.equal(actor.vy, -ny * 5000);
    assert.ok((actor.x - 480) * nx + (actor.y - 300) * ny > 0, 'does not tunnel to the opposite side');
  }
});

test('rectangles slide along faces, collide with rounded actor corners and separate initial overlaps', () => {
  for (const shape of shapes.filter(shape => shape === 'rectangle')) {
    const game = arena(), obstruction = game.createObstruction({ x: 480, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    const left = 480 - obstruction.width / 2, top = 300 - obstruction.height / 2;
    const actor = { x: left + 10, y: top + 60, radius: 10, vx: 30, vy: 60 };
    game.moveAroundObstructions(actor, { x: left - 10, y: top + 20 });
    assert.ok(Math.abs(actor.x - (left - 10)) < 1e-4);
    assert.ok(actor.y > top + 20, 'tangential motion continues');
    const corner = { x: left + 10, y: top + 10, radius: 10 };
    game.moveAroundObstructions(corner, { x: left - 30, y: top - 30 }, true);
    assert.ok(Math.abs(gap(corner, obstruction)) < 1e-4);
    assert.ok(corner.x < left && corner.y < top, 'uses the rounded actor corner rather than an enlarged bounding box');
    const overlap = { x: 480, y: 300, radius: 21, vx: 0, vy: 0 };
    game.moveAroundObstructions(overlap, { x: 480, y: 300 });
    assert.ok(gap(overlap, obstruction) >= -1e-5, 'scheduled overlapping rectangles push to the nearest free face');
    assert.equal(overlap.vx, 0); assert.equal(overlap.vy, 0);
  }
});

function distanceToPath(x, y, points) {
  let distance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    distance = Math.min(distance, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return distance;
}

test('obstruction trajectory follows actual no-click motion for every variant without mutating game state', () => {
  for (const shape of shapes) {
    const game = arena(), obstruction = game.createObstruction({ x: 480, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    Object.assign(game.cat, { x: 200, y: 270, vx: 420, vy: 0 });
    game.target = { x: 900, y: 270 };
    const snapshot = structuredClone({ cat: game.cat, target: game.target, bricks: game.bricks,
      obstructions: game.obstructions, elapsed: game.elapsed });
    const points = game.trajectory();
    assert.deepEqual({ cat: game.cat, target: game.target, bricks: game.bricks,
      obstructions: game.obstructions, elapsed: game.elapsed }, snapshot);
    assert.deepEqual(game.trajectory(), points, 'forecast is deterministic');
    assert.deepEqual(points[0], [200, 270]);
    for (let frame = 0; frame < 1000; frame++) {
      const old = { ...game.cat };
      game.update(1 / 120);
      assert.ok(distanceToPath(game.cat.x, game.cat.y, points) < .6, `${shape} frame ${frame} follows the forecast`);
      if ((!game.cat.vx && !game.cat.vy) || Math.hypot(game.cat.x - old.x, game.cat.y - old.y) < 1e-5) break;
    }
    const end = points.at(-1);
    assert.ok(Math.hypot(end[0] - game.cat.x, end[1] - game.cat.y) < .02, `${shape} ends where Koshi actually stops`);
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i], [beforeX, beforeY] = points[i - 1];
      assert.ok(gap({ x: (x + beforeX) / 2, y: (y + beforeY) / 2, radius: game.cat.radius }, obstruction) >= -.3,
        'forecast segments do not cut through the obstruction');
    }
  }
});

test('head-on forecasts end at the obstruction, not at the original clicked target', () => {
  const game = arena();
  game.obstructions.push(game.createObstruction({ x: 480, y: 300 }, placement()));
  Object.assign(game.cat, { x: 200, y: 300, vx: 420, vy: 0 });
  game.target = { x: 900, y: 300 };
  const points = game.trajectory();
  assert.equal(points.length, 2, 'straight segments stay compact');
  assert.ok(Math.abs(points.at(-1)[0] - (480 - 48 - game.cat.radius)) < 1e-4);
  assert.equal(points.at(-1)[1], 300);
  game.update(1);
  assert.equal(game.cat.vx, 420, 'forecast does not change intended velocity');
  assert.ok(Math.hypot(...points.at(-1).map((value, i) => value - [game.cat.x, game.cat.y][i])) < 1e-4);
});

test('forecast handles a spring bounce followed by an obstruction without drawing through it', () => {
  const game = arena();
  for (const brick of game.bricks) brick.springs = true;
  game.obstructions.push(game.createObstruction({ x: 400, y: 300 }, placement()));
  Object.assign(game.cat, { x: 600, y: 300, vx: 420, vy: 0 });
  game.target = { x: 930, y: 300 };
  const points = game.trajectory();
  assert.equal(points.length, 3);
  assert.ok(points[1][0] > 600);
  assert.ok(Math.abs(points[2][0] - (400 + 48 + game.cat.radius)) < 1e-4);
  for (let frame = 0; frame < 300; frame++) {
    game.update(1 / 120);
    assert.ok(distanceToPath(game.cat.x, game.cat.y, points) < .02);
  }
});

test('diagonal sliding forecasts agree with live motion', () => {
  for (const shape of ['circle', 'diamond', 'rectangle']) {
    const game = arena();
    game.obstructions.push(game.createObstruction({ x: 480, y: 300 }, placement(shape)));
    Object.assign(game.cat, { x: 300, y: 230, vx: 350, vy: 100 });
    const points = game.trajectory();
    assert.ok(points.length > 2, 'the obstruction changes the forecast direction');
    for (let frame = 0; frame < 900; frame++) {
      const old = { ...game.cat };
      game.update(1 / 120);
      assert.ok(distanceToPath(game.cat.x, game.cat.y, points) < .6, `${shape} frame ${frame} follows its diagonal forecast`);
      if ((!game.cat.vx && !game.cat.vy) || Math.hypot(game.cat.x - old.x, game.cat.y - old.y) < 1e-5) break;
    }
    assert.ok(Math.hypot(points.at(-1)[0] - game.cat.x, points.at(-1)[1] - game.cat.y) < .02);
  }
});

test('bumper deflection forecasts continue to the obstruction with the correct no-click endpoint', () => {
  const game = arena();
  game.obstructions.push(game.createObstruction({ x: 400, y: 300 }, placement()));
  game.bumpers.push(game.createBumper({ x: 700, y: 300 }, 'bumper-red'));
  Object.assign(game.cat, { x: 600, y: 300, vx: 420, vy: 0 });
  const snapshot = structuredClone(game.bumpers), points = game.trajectory();
  assert.deepEqual(game.bumpers, snapshot, 'forecast never marks a real bumper as hit');
  for (let frame = 0; frame < 300; frame++) {
    game.update(1 / 120);
    assert.ok(distanceToPath(game.cat.x, game.cat.y, points) < .02);
  }
  assert.ok(Number.isFinite(game.bumpers[0].hitAt), 'actual movement hits the bumper');
  assert.ok(game.cat.vx < 0);
  assert.ok(Math.hypot(points.at(-1)[0] - game.cat.x, points.at(-1)[1] - game.cat.y) < .02);
});

test('bumper forecasts predict one bounce and end at the next spring or bumper, with or without obstructions', () => {
  for (const withObstruction of [false, true]) {
    const game = arena();
    for (const brick of game.bricks) brick.springs = true;
    if (withObstruction) game.obstructions.push(game.createObstruction({ x: 480, y: 120 }, placement()));
    game.bumpers.push(game.createBumper({ x: 700, y: 300 }, 'bumper-red'), game.createBumper({ x: 300, y: 300 }, 'bumper-red'));
    Object.assign(game.cat, { x: 600, y: 300, vx: 420, vy: 0 });
    game.target = { x: 900, y: 300 };
    const points = game.trajectory(), end = points.at(-1);
    assert.ok(points[1][0] < 700 && points[1][0] > 600, 'first segment ends at the bumper');
    assert.ok(Math.abs(end[0] - (300 + game.bumpers[1].radius + game.cat.radius)) < .1, `stops at the second bumper (${withObstruction})`);
    assert.ok(Math.abs(end[1] - 300) < 1e-6);

    // Spring first: forecast ends at the bumper after one reflected segment.
    const spring = arena();
    for (const brick of spring.bricks) brick.springs = true;
    if (withObstruction) spring.obstructions.push(spring.createObstruction({ x: 480, y: 120 }, placement()));
    spring.bumpers.push(spring.createBumper({ x: 300, y: 300 }, 'bumper-red'));
    Object.assign(spring.cat, { x: 600, y: 300, vx: 420, vy: 0 });
    const route = spring.trajectory();
    assert.ok(route[1][0] > 800, 'first segment reaches the right spring');
    assert.ok(Math.abs(route.at(-1)[0] - (300 + spring.bumpers[0].radius + spring.cat.radius)) < .1, 'ends at the bumper');
  }
});

test('invalid obstruction textures fail explicitly instead of being silently dropped', () => {
  for (const extra of [{ color: 'red' }, { color: '#123' }, { patternColor: 10 }, { pattern: 'unknown' }]) {
    assert.throws(() => validateCustomLevel({ ...blank(), events: [placement('circle', extra)] }), /invalid obstruction/);
    assert.throws(() => validateCustomLevel({ ...blank(), brickTypes: [
      { edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'object', type: 'obstruction-circle', ...extra } },
    ] }), /invalid obstruction/);
  }
  assert.throws(() => validateCustomLevel({ ...blank(), events: [placement('circle', { type: 'soccer-ball', pattern: 'solid' })] }), /only supported for obstructions/);
});

test('head-on obstruction contact stops position but preserves Koshi velocity, target and speed', () => {
  for (const shape of ['circle', 'diamond']) {
    const game = arena(), obstruction = game.createObstruction({ x: 400, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    Object.assign(game.cat, { x: 200, y: 300, vx: 420, vy: 0 });
    const target = game.target = { x: 800, y: 300 };
    game.update(1);
    assert.ok(Math.abs(game.cat.x - (400 - OBSTRUCTION_RADIUS - game.cat.radius)) < 1e-4);
    assert.ok(gap(game.cat, obstruction) >= -1e-5);
    assert.equal(game.cat.vx, 420); assert.equal(game.cat.vy, 0);
    assert.equal(game.target, target);
    const x = game.cat.x;
    game.update(.5);
    assert.ok(Math.abs(game.cat.x - x) < 1e-5, 'head-on contact can remain stuck');
    assert.equal(game.cat.vx, 420); assert.equal(game.cat.vy, 0);
    assert.deepEqual({ x: obstruction.x, y: obstruction.y }, { x: 400, y: 300 });
  }
});

test('off-center contact slides around either shape while retaining the exact intended velocity', () => {
  for (const shape of ['circle', 'diamond']) {
    const game = arena(), obstruction = game.createObstruction({ x: 400, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    Object.assign(game.cat, { x: 250, y: 270, vx: 180, vy: 0 });
    for (let frame = 0; frame < 240; frame++) {
      game.update(1 / 120);
      assert.equal(game.cat.vx, 180); assert.equal(game.cat.vy, 0);
      assert.ok(gap(game.cat, obstruction) >= -1e-5, `${shape} frame ${frame} is outside`);
    }
    assert.ok(game.cat.x > obstruction.x + obstruction.radius, 'Koshi passes the obstacle by sliding');
    assert.ok(game.cat.y < 270, 'actual movement is deflected');
  }
});

test('swept collisions prevent tunneling through circles, diamond faces and tips at high speeds', () => {
  for (const shape of ['circle', 'diamond']) for (const y of [300, 270, 245]) {
    const game = arena(), obstruction = game.createObstruction({ x: 400, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    const actor = { x: 750, y, radius: 21, vx: 5000, vy: 0 };
    game.moveAroundObstructions(actor, { x: 150, y });
    assert.ok(gap(actor, obstruction) >= -1e-5);
    assert.equal(actor.vx, 5000); assert.equal(actor.vy, 0);
    if (y === 300) assert.ok(actor.x < 400);
  }
});

test('diagonal contact preserves both velocity components and the original steering target', () => {
  for (const shape of ['circle', 'diamond']) for (const sign of [-1, 1]) {
    const game = arena(), obstruction = game.createObstruction({ x: 450, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    Object.assign(game.cat, { x: 450 - sign * 100, y: 200, vx: sign * 150, vy: 150 });
    const target = game.target = { x: 450 + sign * 200, y: 500 };
    for (let frame = 0; frame < 60; frame++) {
      game.update(1 / 120);
      assert.equal(game.cat.vx, sign * 150); assert.equal(game.cat.vy, 150);
      assert.ok(gap(game.cat, obstruction) >= -1e-5);
      assert.equal(game.target, target);
    }
  }
});

test('diamond empty corners do not act like its bounding box', () => {
  const game = arena(), obstruction = game.createObstruction({ x: 400, y: 300 }, placement('diamond'));
  game.obstructions.push(obstruction);
  const actor = { x: 446, y: 346, radius: 10 };
  game.moveAroundObstructions(actor, { x: 446, y: 380 });
  assert.deepEqual(actor, { x: 446, y: 346, radius: 10 });
});

test('existing obstructions separate an overlapping Koshi without changing his velocity', () => {
  for (const shape of ['circle', 'diamond']) {
    const game = arena({ ...blank(), events: [placement(shape)] });
    game.update(.01);
    assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0);
    assert.ok(gap(game.cat, game.obstructions[0]) >= -1e-5);
    assert.equal(game.hearts, 3);
  }
});

test('all roaming enemy types are blocked, including charging, sleeping and frightened enemies', () => {
  for (const shape of shapes) for (const type of ['mouse', 'ram', 'bucket', 'ball', 'jackolantern', 'goalie', 'robo-koshi', 'robo-snail', 'robo-unicorn']) {
    const game = arena(), obstruction = game.createObstruction({ x: 400, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .2, y: .4 })[0];
    for (const mode of ['moving', 'sleeping', 'afraid']) {
      enemy.x = 460; enemy.y = 300; enemy.asleep = mode === 'sleeping'; enemy.afraid = mode === 'afraid';
      game.blockEnemyWithObstructions(enemy, { x: 300, y: 300 });
      assert.ok(enemy.x < 400, `${type} ${mode} stays on the incoming side`);
      assert.ok(gap(enemy, obstruction) >= -1e-5);
    }
  }
});

test('real combat motion cannot move any roaming robot through an obstruction', () => {
  for (const shape of ['circle', 'diamond']) for (const type of ['mouse', 'ram', 'bucket', 'ball', 'jackolantern', 'robo-koshi', 'robo-snail', 'robo-unicorn']) {
    const game = arena(), obstruction = game.createObstruction({ x: 400, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .2, y: .5 })[0];
    Object.assign(enemy, { x: 330, y: 300, phase: 0, vx: 180, vy: 0, angle: 0 });
    if (type === 'ram') { enemy.state = 'charging'; enemy.speed = 450; }
    if (type === 'robo-unicorn') {
      enemy.unicornState = 'charge'; enemy.chargeAngle = 0; enemy.mouthOpen = true;
      game.food.push({ x: 600, y: 300, type: 'S', expires: 20, lifetime: 20 });
    }
    game.robots = [enemy];
    for (let frame = 0; frame < 12; frame++) {
      game.combat(1 / 120, game.cat.x, game.cat.y);
      assert.ok(gap(enemy, obstruction) >= -1e-5, `${type} remains outside ${shape}`);
    }
  }
});

test('perimeter enemies reverse at obstructions without leaving their boundary routes', () => {
  for (const shape of shapes) for (const type of ['wheel', 'snake', 'robo-cow']) {
    const game = arena(), bounds = game.bounds();
    const obstruction = game.createObstruction({ x: 450, y: bounds.top }, placement(shape));
    game.obstructions.push(obstruction);
    const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .2, y: 0 })[0];
    game.robots = [enemy];
    let reversed = false;
    for (let frame = 0; frame < 360; frame++) {
      game.combat(1 / 120, game.cat.x, game.cat.y);
      reversed ||= (type === 'robo-cow' ? enemy.cowDirection : enemy.barrierDirection) === -1;
      assert.ok(enemy.x === bounds.left || enemy.x === bounds.right || enemy.y === bounds.top || enemy.y === bounds.bottom);
      assert.ok(gap(enemy, obstruction) >= -1e-5);
      if (type === 'snake') for (const segment of game.snakeSegments(enemy)) {
        assert.ok(gap({ ...segment, radius: segment.radius + (segment.index ? 5 : 0) }, obstruction) >= -1e-5);
      }
    }
    assert.equal(reversed, true, `${type} must reverse at ${shape}`);
  }
});

test('perimeter obstruction reversals work in both directions, including fear, without double-reversing a step', () => {
  for (const type of ['wheel', 'snake', 'robo-cow']) for (const direction of [-1, 1]) for (const afraid of [false, true]) {
    const game = arena(), bounds = game.bounds(), w = bounds.right - bounds.left;
    game.obstructions.push(game.createObstruction({ x: bounds.left + w / 2, y: bounds.top }, placement()));
    const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .2, y: 0 })[0];
    enemy.afraid = afraid;
    enemy.distance = w / 2 - direction * 200;
    enemy.cowDirection = enemy.barrierDirection = enemy.fleeDirection = direction;
    game.placeWheel(enemy);
    const old = { x: enemy.x, y: enemy.y, distance: enemy.distance };
    enemy.distance += direction * 190;
    game.placeWheel(enemy);
    game.blockEnemyWithObstructions(enemy, old);
    const activeDirection = () => afraid ? enemy.fleeDirection : type === 'robo-cow' ? enemy.cowDirection : enemy.barrierDirection;
    assert.equal(activeDirection(), -direction, `${type} fear=${afraid}`);
    game.blockEnemyWithObstructions(enemy, old);
    assert.equal(activeDirection(), -direction, 'another collision pass must not cancel the reversal');
    const contact = { x: enemy.x, y: enemy.y, distance: enemy.distance };
    enemy.distance -= direction * 2;
    game.placeWheel(enemy);
    game.blockEnemyWithObstructions(enemy, contact);
    assert.equal(activeDirection(), -direction, 'moving away must not reverse again');
    if (type === 'snake') {
      for (const [index, segment] of game.snakeSegments(enemy).entries()) {
        assert.ok(gap({ ...segment, radius: segment.radius + (index ? 5 : 0) },
          game.obstructions[0]) >= -1e-5);
      }
    } else assert.ok(Math.abs(enemy.distance - contact.distance + direction * 2) < 1e-6);
  }
});

test('perimeter robots and the whole snake body separate from newly overlapping obstructions', () => {
  for (const type of ['wheel', 'snake', 'robo-cow']) {
    const game = arena(), bounds = game.bounds();
    const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .5, y: 0 })[0];
    const obstruction = game.createObstruction({ x: enemy.x, y: bounds.top }, placement());
    game.obstructions.push(obstruction);
    game.blockEnemyWithObstructions(enemy, { x: enemy.x, y: enemy.y, distance: enemy.distance });
    assert.equal(enemy.y, bounds.top);
    const segments = type === 'snake' ? game.snakeSegments(enemy) : [enemy];
    for (const [index, segment] of segments.entries()) {
      assert.ok(gap({ ...segment, radius: segment.radius + (index ? 5 : 0) }, obstruction) >= -1e-5);
    }
  }
});

test('obstructions do not disable real boundary-brick or bumper collision responses', () => {
  const game = arena();
  game.obstructions.push(game.createObstruction({ x: 400, y: 300 }, placement('diamond')));
  Object.assign(game.cat, { x: 150, y: 180, vx: 0, vy: -200 });
  game.update(1);
  assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0, 'bricks still stop Koshi');
  game.bumpers.push(game.createBumper({ x: 300, y: 400 }, 'bumper-red'));
  Object.assign(game.cat, { x: 240, y: 400, vx: 100, vy: 0 });
  game.update(.3);
  assert.equal(game.cat.vx, -125, 'bumpers still reflect and multiply speed');
});

test('obstruction graphics clip every pattern to its shape and use both chosen colors', () => {
  for (const shape of shapes) for (const pattern of OBSTRUCTION_PATTERNS) {
    const calls = [], stack = [], stops = [];
    const gradient = { addColorStop: (...args) => stops.push(args) };
    const ctx = new Proxy({ fillStyle: '', globalAlpha: 1 }, {
      get(target, name) {
        if (name in target) return target[name];
        if (name === 'save') return () => stack.push({ ...target });
        if (name === 'restore') return () => Object.assign(target, stack.pop());
        if (name === 'createLinearGradient') return () => gradient;
        return (...args) => calls.push({ name, args, color: target.fillStyle, stroke: target.strokeStyle, width: target.lineWidth });
      },
    });
    drawObstruction(ctx, { ...placement(shape), x: 100, y: 100, color: '#123456', patternColor: '#abcdef', pattern });
    assert.ok(calls.some(call => call.name === 'fill' && call.color === '#123456'));
    assert.equal(calls.filter(call => call.name === 'clip').length, 1);
    assert.equal(calls.filter(call => call.name === 'stroke').length, 2);
    assert.ok(calls.some(call => call.name === 'stroke' && call.stroke === gradient && call.width === 12), 'clipped boundary shading adds depth');
    assert.equal(stops[0][1], '#ffffff99');
    assert.equal(stops.at(-1)[1], '#00000099');
    assert.equal(stack.length, 0);
    if (pattern !== 'solid') assert.ok(calls.some(call => ['fill', 'fillRect'].includes(call.name) && call.color === '#abcdef'));
  }
});

test('spiked obstruction rendering draws shared collision triangles in the Spikes Brick colors', () => {
  for (const shape of shapes) {
    const calls = [], gradient = { addColorStop() {} };
    const ctx = new Proxy({}, {
      get(target, name) {
        if (name in target) return target[name];
        if (name === 'createLinearGradient') return () => gradient;
        return (...args) => calls.push({ name, args, fill: target.fillStyle, stroke: target.strokeStyle });
      },
    });
    const obstruction = { ...placement(shape, { rotation: 30 }), x: 100, y: 100, spiked: true };
    drawObstruction(ctx, obstruction);
    const firstFill = calls.findIndex(call => call.name === 'fill');
    const vertices = calls.slice(0, firstFill).filter(call => ['moveTo', 'lineTo'].includes(call.name));
    assert.deepEqual(vertices.map(call => call.args), obstructionSpikes({ ...obstruction, x: 0, y: 0, rotation: 0 }).flat());
    assert.equal(calls[firstFill].fill, '#fff');
    assert.equal(calls.find(call => call.name === 'stroke').stroke, '#aab9c5');
  }
});

test('the editor provides the same 100 unique color presets for both colors in placements, spawners, and obstructor guns', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const makeNode = () => ({
    children: [], style: {}, attributes: {}, listeners: {},
    append(...items) { this.children.push(...items); },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(name, callback) { this.listeners[name] = callback; },
  });
  const inputs = new Map(), menus = [];
  for (const prefix of ['event', 'brick-spawn', 'brick-hazard']) for (const field of ['color', 'patternColor']) {
    inputs.set(`#${prefix}-${field}`, { value: '#123456', events: [],
      parentElement: { after: node => menus.push(node) },
      dispatchEvent(event) { this.events.push(event.type); },
    });
  }
  const context = vm.createContext({ $: selector => inputs.get(selector), document: { createElement: makeNode },
    Event: class { constructor(type) { this.type = type; } } });
  const start = source.indexOf('const OBSTRUCTION_COLORS =');
  vm.runInContext(source.slice(start, source.indexOf('\n];', start) + 3), context);
  const setup = source.indexOf('function setupObstructionColors(');
  vm.runInContext(source.slice(setup, source.indexOf('\nfunction ', setup + 1)), context);
  context.setupObstructionColors();
  assert.equal(menus.length, 6);
  const colors = menus[0].children[1].children.map(button => button.style.backgroundColor);
  assert.equal(colors.length, 100);
  assert.equal(new Set(colors).size, 100);
  assert.ok(colors.every(color => /^#[0-9a-f]{6}$/.test(color)));
  assert.ok(colors.includes('#000000') && colors.includes('#ffffff'));
  const saturation = color => {
    const rgb = color.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255);
    return Math.max(...rgb) - Math.min(...rgb);
  };
  assert.ok(colors.filter(color => saturation(color) > .6).length >= 25, 'includes bold colors');
  assert.ok(colors.filter(color => saturation(color) > 0 && saturation(color) < .3).length >= 25, 'includes muted colors');
  for (const [index, input] of [...inputs.values()].entries()) {
    const buttons = menus[index].children[1].children;
    assert.deepEqual(buttons.map(button => button.style.backgroundColor), colors);
    assert.ok(buttons.every(button => button.type === 'button' && button.attributes['aria-label'].includes(button.style.backgroundColor)));
    buttons[27].listeners.click();
    assert.equal(input.value, colors[27]);
    assert.deepEqual(input.events, ['input', 'change'], 'uses existing placement and spawner saving behavior');
    input.value = '#012345';
    assert.equal(input.value, '#012345', 'custom colors are not limited to presets');
  }
});

test('TNT signs are centered fixed-size red rectangles with black-on-white text and disappear during destruction', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'brick-visuals.js'), 'utf8');
  const context = vm.createContext({ KoshiGame: require('../src/game.js') });
  vm.runInContext(source, context);
  const visuals = context.KoshiBrickVisuals;
  for (const shape of shapes) for (const width of [1, 96, 600]) {
    const calls = [], stack = [], gradients = [];
    const ctx = new Proxy({ fillStyle: '', globalAlpha: 1 }, {
      get(target, name) {
        if (name in target) return target[name];
        if (name === 'save') return () => stack.push({ ...target });
        if (name === 'restore') return () => Object.assign(target, stack.pop());
        if (name === 'createLinearGradient') return () => {
          const gradient = { stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); } };
          gradients.push(gradient); return gradient;
        };
        return (...args) => calls.push({ name, args, color: target.fillStyle, stroke: target.strokeStyle, width: target.lineWidth, font: target.font,
          shadow: target.shadowColor, blur: target.shadowBlur, offsetY: target.shadowOffsetY });
      },
    });
    const obstruction = { ...placement(shape, { width, height: shape.includes('rectangle') ? 50 : width, destructible: true }), x: 123, y: 234 };
    visuals.drawObstruction(ctx, obstruction);
    assert.deepEqual(calls.find(call => call.name === 'translate').args, [123, 234]);
    const face = calls.find(call => call.name === 'fillRect' && call.color === gradients[1]);
    assert.deepEqual(face.args, [-18, -13, 36, 26]);
    assert.deepEqual(gradients[1].stops, [[0, '#fff'], [.45, '#f8fafc'], [1, '#b8c1cb']]);
    assert.equal(face.shadow, '#0009'); assert.equal(face.blur, 3); assert.equal(face.offsetY, 2);
    const border = calls.find(call => call.name === 'strokeRect');
    assert.deepEqual(border.args, [-18, -13, 36, 26]);
    assert.equal(border.stroke, gradients[2]); assert.equal(border.width, 3);
    assert.deepEqual(gradients[2].stops, [[0, '#ff8880'], [.35, '#e53632'], [1, '#891e25']]);
    assert.ok(calls.some(call => call.name === 'stroke' && call.stroke === '#ffffffb3'), 'raised top and left edges');
    const text = calls.find(call => call.name === 'fillText');
    assert.deepEqual(text.args, ['TNT', 0, 1, 30]);
    assert.equal(text.color, '#000'); assert.equal(text.font, 'bold 16px sans-serif');
    assert.ok(!calls.some(call => call.name === 'drawImage'));
    assert.equal(stack.length, 0);
    calls.length = 0;
    visuals.drawObstructionDestruction(ctx, { ...obstruction, age: .35, duration: 1.2 });
    assert.ok(calls.some(call => call.name === 'rect'), 'crumbling shape fragments');
    for (const color of ['#92979b', '#ef5633', '#ffb543']) {
      assert.ok(calls.some(call => call.name === 'fill' && call.color === color), color);
    }
    assert.ok(!calls.some(call => call.name === 'fillText'), 'the sign disappears with the destroyed obstruction');
    assert.equal(stack.length, 0);
    assert.equal(ctx.globalAlpha, 1);
  }
});

function editorFixture() {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const nodes = new Map(), $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', checked: false, parentElement: {}, dataset: {}, querySelector: () => null,
      replaceChildren() {}, prepend() {}, setAttribute() {} });
    return nodes.get(selector);
  };
  const context = vm.createContext({ $, OBJECTS, Game, obstructionGeometry, snapWheel, brickRegions, brickEditRegions, COOLDOWNS,
    OBSTRUCTION_SIZES, obstructionPresetGeometry,
    level: blank(), selectedEvents: new Set(), selectedBricks: new Set(), placing: false, touched: new Set(), MIXED: '',
    common: values => values.every(value => value === values[0]) ? values[0] : '',
    mixedOption: input => { input.value = ''; },
    document: { createElement: () => ({}) }, selectedList: () => [...context.selectedEvents],
    readOnly: () => false, validateDraft: validateCustomLevel, markChanged() {}, setSelection() {},
    syncPalettes() {}, message() {}, plural: (count, word) => `${count} ${word}s`,
  });
  vm.runInContext(source.slice(source.indexOf('function typeOptions('), source.indexOf('function description(')), context);
  vm.runInContext(source.slice(source.indexOf('function readEvent('), source.indexOf('function setSelection(')), context);
  vm.runInContext(source.slice(source.indexOf('function applyToSelected('), source.indexOf('function applyEventChanges(')), context);
  return { $, context, source };
}

test('obstruction shapes retain fixed defaults after custom edits in either inspector', () => {
  const { $, context } = editorFixture();
  for (const prefix of ['event', 'brick-spawn']) for (const shape of shapes) {
    const type = `obstruction-${shape}`, defaults = obstructionGeometry({ type });
    context.populateObstructionFields(prefix, [placement(shape, { width: 321, height: shape.includes('rectangle') ? 57 : 321 })]);
    assert.equal($(`#${prefix}-width`).value, 321);
    assert.equal($(`#${prefix}-width`).placeholder, String(defaults.width));
    assert.equal($(`#${prefix}-height`).placeholder, String(defaults.height));
    context.resetObstructionSize(prefix);
    assert.equal($(`#${prefix}-width`).value, '');
    assert.equal($(`#${prefix}-height`).value, '');
    assert.deepEqual(obstructionGeometry({ type }), defaults);
  }
});

test('all eight resize handles anchor edges and corners; only circles retain equal dimensions', () => {
  const { context, source } = editorFixture();
  vm.runInContext(source.slice(source.indexOf('function resizedObstruction('), source.indexOf('function startGesture(')), context);
  const bounds = { left: 0, right: 960, top: 0, bottom: 600 };
  for (const shape of ['rectangle', 'circle', 'diamond']) {
    const origin = placement(shape, { x: .5, y: .5, width: 200, height: 200, destructible: true });
    for (const handle of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
      const west = handle.includes('w'), east = handle.includes('e'), north = handle.includes('n'), south = handle.includes('s');
      const next = context.resizedObstruction(origin, handle, west ? -60 : 60, north ? -40 : 40, bounds);
      const square = shape === 'circle';
      const size = west || east ? 260 : 240;
      assert.equal(next.width, square ? size : west || east ? 260 : 200);
      assert.equal(next.height, square ? size : north || south ? 240 : 200);
      if (west || east) {
        const sign = west ? 1 : -1;
        assert.ok(Math.abs(next.x * 960 + sign * next.width / 2 - (origin.x * 960 + sign * 100)) < 1e-8);
      } else assert.equal(next.x, origin.x);
      if (north || south) {
        const sign = north ? 1 : -1;
        assert.ok(Math.abs(next.y * 600 + sign * next.height / 2 - (origin.y * 600 + sign * 100)) < 1e-8);
      } else assert.equal(next.y, origin.y);
      assert.equal(next.destructible, true);
      assert.equal(origin.width, 200, 'never mutate gesture origin');
      validateCustomLevel({ ...blank(), events: [next] });
    }
    const tiny = context.resizedObstruction(origin, 'se', -10000, -10000, bounds);
    assert.equal(tiny.width, 1); assert.equal(tiny.height, 1);
    const huge = context.resizedObstruction(origin, 'nw', -20000, -20000, bounds);
    assert.equal(huge.width, 10000); assert.equal(huge.height, 10000);
    assert.equal(huge.x, 0); assert.equal(huge.y, 0);
  }
});

test('resize gestures commit validated dimensions, cancel without altering the draft, and cannot start read-only', () => {
  const { context, source } = editorFixture();
  const listeners = new Map(), original = placement('rectangle');
  let changed = 0, locked = false;
  Object.assign(context, {
    level: { ...blank(), events: [original] }, gesture: null,
    readOnly: () => locked, isAdditive: () => false,
    board: { addEventListener: (type, callback) => listeners.set(type, callback),
      setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} },
    pointerPosition: event => ({ x: event.clientX / 960, y: event.clientY / 600 }),
    previewGame: { bounds: () => ({ left: 0, right: 960, top: 0, bottom: 600 }) },
    renderBoard() {}, render() {}, focusMarker() {},
    markChanged: () => changed++, attempt: action => action(),
  });
  vm.runInContext(source.slice(source.indexOf('function resizedObstruction('), source.indexOf('function boxBounds(')), context);
  vm.runInContext(source.slice(source.indexOf("board.addEventListener('pointermove'"), source.indexOf("board.addEventListener('keydown'")), context);
  const start = () => context.startGesture({ pointerId: 1, clientX: 200, clientY: 200 }, { type: 'resize', index: 0, handle: 'e' });
  const move = () => listeners.get('pointermove')({ pointerId: 1, clientX: 280, clientY: 200 });
  start(); move();
  assert.equal(context.level.events[0].width, 272);
  listeners.get('pointercancel')({});
  assert.deepEqual({ ...context.level.events[0] }, original);
  assert.equal(changed, 0);
  start(); move(); listeners.get('pointerup')({ pointerId: 1 });
  assert.equal(context.level.events[0].width, 272);
  assert.equal(context.level.events[0].height, 48);
  assert.equal(changed, 1);
  assert.equal(context.gesture, null);
  locked = true; start();
  assert.equal(context.gesture, null);
});

test('editor placement and multiselection preserve independent obstruction texture fields', () => {
  const { $, context } = editorFixture();
  $('#event-kind').value = 'object'; $('#event-type').value = 'obstruction-diamond';
  $('#event-time').value = '0'; $('#event-x').value = '50'; $('#event-y').value = '50';
  $('#event-location').value = 'fixed'; $('#event-formation').value = 'single';
  $('#event-color').value = '#123456'; $('#event-patternColor').value = '#abcdef'; $('#event-pattern').value = 'stripes';
  $('#event-spiked').checked = true;
  context.typeOptions('obstruction-diamond');
  assert.equal($('#event-obstruction').hidden, false);
  const event = context.readEvent();
  assert.equal(event.color, '#123456'); assert.equal(event.pattern, 'stripes');
  assert.equal(event.spiked, true);
  context.level.events = [event, placement('circle', { color: '#fedcba', pattern: 'polka-dots' })];
  context.selectedEvents = new Set([0, 1]);
  context.populateEventForm();
  assert.match($('#event-color').title, /Mixed/);
  assert.equal($('#event-obstruction').disabled, false);
  assert.equal($('#event-spiked').indeterminate, true);
  $('#event-pattern').value = 'checkered'; context.touched.add('#event-pattern');
  context.applyToSelected();
  assert.ok(context.level.events.every(event => event.pattern === 'checkered'));
  assert.deepEqual(Array.from(context.level.events, event => event.color), ['#123456', '#fedcba']);
  assert.deepEqual(Array.from(context.level.events, event => event.spiked), [true, undefined]);
  context.touched.clear(); context.touched.add('#event-spiked'); $('#event-spiked').checked = true;
  context.applyToSelected();
  assert.ok(context.level.events.every(event => event.spiked === true));
  $('#event-spiked').checked = false;
  context.applyToSelected();
  assert.ok(context.level.events.every(event => event.spiked === false));
  context.touched.clear();
  context.touched.add('#event-type'); $('#event-type').value = 'bumper-green';
  context.applyToSelected();
  assert.ok(context.level.events.every(event => !Object.hasOwn(event, 'color') && !Object.hasOwn(event, 'pattern')));
  assert.ok(context.level.events.every(event => !Object.hasOwn(event, 'spiked')));
});

test('editor obstruction spawners retain appearance when other brick attributes change', () => {
  const { $, context, source } = editorFixture();
  const { CONTACT_SURFACES } = require('../src/game.js');
  Object.assign(context, { CONTACT_SURFACES, immutableBrick: kind => ['cinder', 'goal'].includes(kind),
    regionKey: region => `${region.edge}:${region.start}:${region.end}`, attempt: action => action(), renderBoard() {} });
  context.previewGame = new Game(() => .5, { customLevel: blank(), editorPreview: true });
  const brick = context.previewGame.bricks[context.previewGame.perimeter[0]];
  context.selectedBricks = new Set([context.regionKey(brick.region)]);
  vm.runInContext(source.slice(source.indexOf('function brickEntry('), source.indexOf('function combineBricks(')), context);
  $('#brick-spawn-item').value = 'object:obstruction-circle';
  $('#brick-spawn-color').value = '#654321'; $('#brick-spawn-pattern').value = 'checkered';
  $('#brick-spawn-patternColor').value = '#badfed';
  $('#brick-spawn-spiked').checked = true;
  context.saveBrick({ target: { id: 'brick-spawn-item' } });
  const spawn = context.level.brickTypes[0].spawner;
  assert.equal(spawn.color, '#654321'); assert.equal(spawn.pattern, 'checkered');
  assert.equal(spawn.spiked, true);
  context.previewGame = new Game(() => .5, { customLevel: context.level, editorPreview: true });
  $('#brick-kind').value = 'slow';
  context.saveBrick({ target: { id: 'brick-kind' } });
  assert.equal(context.level.brickTypes[0].spawner.patternColor, '#badfed');
  assert.equal(context.level.brickTypes[0].spawner.spiked, true);
  $('#brick-spawn-spiked').checked = false;
  context.saveBrick({ target: { id: 'brick-spawn-spiked' } });
  assert.equal(context.level.brickTypes[0].spawner.spiked, false);
  $('#brick-spawn-width').value = '123.5';
  context.saveBrick({ target: { id: 'brick-spawn-width' } });
  assert.equal(context.level.brickTypes[0].spawner.width, 123.5);
  assert.equal(context.level.brickTypes[0].spawner.height, 123.5);
  context.previewGame = new Game(() => .5, { customLevel: context.level, editorPreview: true });
  $('#brick-spawn-destructible').checked = true;
  context.saveBrick({ target: { id: 'brick-spawn-destructible' } });
  assert.equal(context.level.brickTypes[0].spawner.destructible, true);
  context.previewGame = new Game(() => .5, { customLevel: context.level, editorPreview: true });
  $('#brick-spawn-width').value = '';
  context.saveBrick({ target: { id: 'brick-spawn-width' } });
  assert.equal(context.level.brickTypes[0].spawner.width, undefined);
  assert.equal(context.level.brickTypes[0].spawner.height, undefined);
  assert.equal(context.level.brickTypes[0].spawner.destructible, true);
  context.previewGame = new Game(() => .5, { customLevel: context.level, editorPreview: true });
  $('#brick-spawn-width').value = '192';
  context.saveBrick({ target: { id: 'brick-spawn-width' } });
  assert.equal(context.level.brickTypes[0].spawner.width, 192);
  assert.equal(context.level.brickTypes[0].spawner.height, 192);
  assert.equal(obstructionGeometry(context.level.brickTypes[0].spawner).width, 192);
});

test('mixed obstruction edits resize only touched dimensions, preserve destructibility and clear defaults', () => {
  const { $, context } = editorFixture();
  context.level.events = [placement('rectangle', { width: 200, height: 50, destructible: true }),
    placement('circle', { width: 100, height: 100 })];
  context.selectedEvents = new Set([0, 1]); context.populateEventForm();
  assert.equal($('#event-destructible').indeterminate, true);
  $('#event-width').value = '75.5'; context.touched.add('#event-width');
  context.applyToSelected();
  assert.equal(context.level.events[0].width, 75.5);
  assert.equal(context.level.events[0].height, 50);
  assert.equal(context.level.events[0].destructible, true);
  assert.equal(context.level.events[1].width, 75.5);
  assert.equal(context.level.events[1].height, 75.5);
  assert.equal(context.level.events[1].destructible, undefined);
  context.touched.clear(); context.touched.add('#event-destructible'); $('#event-destructible').checked = false;
  context.applyToSelected();
  assert.ok(context.level.events.every(event => event.destructible === false));
  context.touched.clear(); context.touched.add('#event-width'); $('#event-width').value = '';
  context.applyToSelected();
  assert.ok(context.level.events.every(event => event.width === undefined));
  assert.equal(context.level.events[0].height, 50);
  assert.equal(context.level.events[1].height, undefined);
});
