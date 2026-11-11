const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, OBJECTS, obstructionGeometry, obstructionVertices, brickContact } = require('../src/game.js');

function arena(scroll = true, portrait = false) {
  const game = new Game(() => .5, { portrait, customLevel: {
    version: 1, id: 'Engine regression', duration: 120, goal: 1000, heartCost: null,
    brickSet: 1, events: [],
    ...(scroll ? { autoscroll: { length: 60, speed: 0, events: [] } } : {}),
  } });
  game.start();
  return game;
}

// Keep the pre-optimization clipping algorithm as an independent numerical oracle.
function referenceBlock(wave, parts, previousRadius, obstructions) {
  function clip(polygon, distance) {
    const result = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const da = distance(a), db = distance(b);
      if (da >= -1e-9) result.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return result;
  }
  const polygons = parts.map(({ x, y, w, h }) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  for (const blocker of obstructions) {
    const { type, x, y, radius } = blocker;
    const shape = OBJECTS[type].bumper ? 'circle' : OBJECTS[type].obstruction;
    const vertices = shape === 'circle' ? Array.from({ length: 128 }, (_, i) =>
      [Math.cos(i * Math.PI / 64) * radius, Math.sin(i * Math.PI / 64) * radius])
      : obstructionVertices(blocker);
    const angle = (blocker.rotation ?? 0) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    polygons.push(vertices.map(([vx, vy]) => [x + vx * cos - vy * sin, y + vx * sin + vy * cos]));
  }
  for (let side = 0; side < 4; side++) {
    const [nx, ny] = [[1, 0], [0, 1], [-1, 0], [0, -1]][side];
    const intervals = [...wave.blocked[side]];
    for (const points of polygons) {
      let polygon = points.map(([x, y]) => [(x - wave.x) * nx + (y - wave.y) * ny,
        -(x - wave.x) * ny + (y - wave.y) * nx]);
      for (const plane of [p => p[0] - p[1], p => p[0] + p[1],
        p => wave.radius + 3 - p[0], p => p[0] - Math.max(0, previousRadius - 3)]) polygon = clip(polygon, plane);
      if (!polygon.length) continue;
      if (polygon.some(([out, along]) => Math.abs(out) < 1e-9 && Math.abs(along) < 1e-9)) {
        intervals.push([-1, 1]); continue;
      }
      const angles = polygon.filter(([out]) => out > 1e-9).map(([out, along]) => along / out);
      if (angles.length) intervals.push([Math.max(-1, Math.min(...angles)), Math.min(1, Math.max(...angles))]);
    }
    const merged = [];
    for (const interval of intervals.sort((a, b) => a[0] - b[0])) {
      const last = merged[merged.length - 1];
      if (last && interval[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], interval[1]);
      else merged.push([...interval]);
    }
    wave.blocked[side] = merged;
  }
}

test('cached fire clipping is exactly equivalent to the original algorithm with changing blockers', () => {
  const game = arena(false);
  const types = Object.keys(OBJECTS).filter(type => OBJECTS[type].obstruction || OBJECTS[type].bumper);
  const objects = types.map((type, i) => ({ type, x: 480 + Math.cos(i * 2.4) * (80 + i * 5),
    y: 300 + Math.sin(i * 2.4) * (80 + i * 5),
    ...(OBJECTS[type].bumper ? { radius: 32 } : obstructionGeometry({ type, width: 42, height: 28 })) }));
  const part = { x: 542, y: 280, w: 4, h: 40 };
  const parts = [part, { x: 2000, y: 0, w: 30, h: 600 }, { x: 440, y: 365, w: 80, h: 4 }];
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'jackolantern', x: .5, y: .5 })[0];
  enemy.afraid = true;
  game.obstructions = objects.filter(object => !OBJECTS[object.type].bumper);
  game.bumpers = objects.filter(object => OBJECTS[object.type].bumper);
  for (const origin of [[480, 300], [542, 280], [5000, 300]]) {
    const fire = { x: origin[0], y: origin[1], radius: 0, blocked: [[], [], [], []] };
    const expected = structuredClone(fire);
    enemy.waves = [fire];
    for (let i = 0; i < 160; i++) {
      const previous = fire.radius, seconds = i % 17 === 0 ? .4 : 1 / 120;
      if (i === 40) { part.x += 70; objects[0].x += 40; objects[0].radius *= .8; }
      if (i === 70) { objects[1].type = 'obstruction-diamond'; objects[1].radius = 30; }
      if (i === 90) { part.w += 40; objects[2].width = 95; objects[2].height = 20; }
      expected.radius += 120 * seconds;
      referenceBlock(expected, parts, previous, [...game.obstructions, ...game.bumpers]);
      // Reinsert extinguished waves to compare all later clipping steps too.
      enemy.waves = [fire];
      game.updateJackolanternWaves(enemy, seconds, parts, game.cat.x, game.cat.y);
      assert.deepEqual(fire, expected, `origin ${origin}, tick ${i}`);
    }
  }
});

test('fully blocked waves retire, while offscreen waves from dormant enemies continue and can hit Koshi', () => {
  const game = arena(), bounds = game.simulationBounds();
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'jackolantern', x: .8, y: .5 })[0];
  enemy.x = bounds.x + bounds.width + 200;
  enemy.y = game.cat.y;
  const wave = { x: game.cat.x + 121, y: game.cat.y, radius: 120, blocked: [[], [], [], []] };
  enemy.waves = [wave];
  game.robots = [enemy];
  const age = enemy.age, timer = enemy.stompTimer;
  game.update(1 / 120);
  assert.equal(enemy.dormant, true);
  assert.equal(enemy.age, age);
  assert.equal(enemy.stompTimer, timer);
  assert.equal(wave.radius, 121);
  assert.equal(game.hearts, 2, 'a distant dormant emitter does not make its live fire harmless');
  wave.blocked = [[[-1, 1]], [[-1, 1]], [[-1, 1]], [[-1, 1]]];
  game.update(1 / 120);
  assert.deepEqual(enemy.waves, []);
  assert.deepEqual(game.robots, [enemy], 'retiring fire does not defeat its emitter');
});

test('dormancy preserves enemy state and rewards, wakes in the buffer, and leaves global time and expiry running', () => {
  for (const portrait of [false, true]) {
    const game = arena(true, portrait), bounds = game.simulationBounds();
    const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'ram', x: .8, y: .8, carriesKey: true })[0];
    if (portrait) { enemy.x = game.cat.x; enemy.y = bounds.y + bounds.height + 200; }
    else { enemy.x = bounds.x + bounds.width + 200; enemy.y = game.cat.y; }
    game.robots = [enemy];
    const before = structuredClone(enemy);
    game.food = [{ type: 'S', x: enemy.x, y: enemy.y, expires: .05 }];
    game.items = [{ type: 'battery', x: enemy.x, y: enemy.y, expires: .05 }];
    game.customEvents = [{ kind: 'enemy', type: 'mouse', time: .05, x: .95, y: .95 }];
    game.enemiesSleepUntil = .05;
    game.update(.1);
    assert.ok(game.elapsed > .09);
    assert.equal(game.food.length, 0); assert.equal(game.items.length, 0);
    assert.equal(game.robots.length, 2, 'offscreen schedules continue to spawn');
    for (const key of Object.keys(before)) assert.deepEqual(enemy[key], before[key], key);
    assert.equal(enemy.dormant, true);
    assert.equal(game.enemies, 0); assert.equal(game.enemyDeaths.length, 0);
    assert.deepEqual(game.catBlockProgress.defeated, {});
    if (portrait) enemy.y = bounds.y + bounds.height - 100;
    else enemy.x = bounds.x + bounds.width - 100;
    game.update(1 / 120);
    assert.equal(enemy.dormant, false);
    assert.ok(enemy.age > before.age);
    assert.equal(enemy.asleep, false, 'expired global sleep is not resumed on waking');
    assert.ok(enemy.stateTime > before.stateTime);
    assert.equal(enemy.carriesKey, true);
  }
});

test('simulation buffer covers half a screen behind and a screen ahead, including complete snake bodies', () => {
  for (const portrait of [false, true]) {
    const game = arena(true, portrait);
    game.elapsed = 10;
    const camera = game.camera(), bounds = game.simulationBounds();
    assert.equal(bounds[portrait ? 'y' : 'x'], camera[portrait ? 'y' : 'x'] - 480);
    assert.equal(bounds[portrait ? 'height' : 'width'], 2400);
    const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'snake', x: .5, y: .5 })[0];
    if (portrait) enemy.y = bounds.y + bounds.height + 80;
    else enemy.x = bounds.x + bounds.width + 80;
    game.robots = [enemy];
    game.combat(1 / 120, game.cat.x, game.cat.y);
    assert.equal(enemy.dormant, false);
  }
  const game = arena(false);
  assert.deepEqual(game.simulationBounds(), { x: 0, y: 0, width: game.width, height: game.height });
  assert.equal(game.entityVisible({ x: -10000, y: 0 }), true);
});

test('dormant attack clocks freeze without catch-up while existing bucket projectiles advance', () => {
  const game = arena(), bounds = game.simulationBounds();
  const bucket = game.createCustomSpawn({ kind: 'enemy', type: 'bucket', x: .8, y: .5 })[0];
  bucket.x = bounds.x + bounds.width + 200;
  bucket.shotTimer = .2;
  game.fireBucketBomb(bucket);
  const bomb = structuredClone(bucket.bombs[0]);
  game.robots = [bucket];
  game.update(.5);
  assert.equal(bucket.shotTimer, .2);
  assert.ok(bucket.bombs[0].fuse < bomb.fuse - .49);
  assert.notEqual(bucket.bombs[0].x, bomb.x);
  bucket.x = bounds.x + bounds.width - 100;
  game.update(1 / 120);
  assert.ok(bucket.shotTimer < .2 && bucket.shotTimer > .19);
  assert.equal(bucket.bombs.length, 1, 'missed dormant firing opportunities are not replayed');
  assert.ok(bucket.bombs[0].fuse < bomb.fuse);
});

test('a visible bomb from a dormant owner advances, explodes, damages and expires independently', () => {
  const game = arena(), bounds = game.simulationBounds();
  const bucket = game.createCustomSpawn({ kind: 'enemy', type: 'bucket', x: .8, y: .5 })[0];
  bucket.x = bounds.x + bounds.width + 200;
  game.fireBucketBomb(bucket);
  const bomb = bucket.bombs[0];
  Object.assign(bomb, { x: game.cat.x + 10, y: game.cat.y, vx: 10, vy: 0, fuse: .02 });
  game.robots = [bucket];
  const position = [bucket.x, bucket.y], timer = bucket.shotTimer, age = bucket.age;
  game.update(.1);
  assert.equal(bucket.dormant, true);
  assert.deepEqual([bucket.x, bucket.y], position);
  assert.equal(bucket.age, age);
  assert.equal(bucket.shotTimer, timer);
  assert.equal(bomb.state, 'exploding');
  assert.ok(bomb.blastAge > 0);
  assert.ok(bomb.x > game.cat.x + 10);
  assert.equal(game.hearts, 2);
  game.update(1);
  assert.deepEqual(bucket.bombs, []);
  assert.deepEqual(game.robots, [bucket]);
});

test('fire from dormant owners still clips against blockers outside the simulation buffer', () => {
  const game = arena(), bounds = game.simulationBounds();
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'jackolantern', x: .8, y: .5 })[0];
  enemy.x = bounds.x + bounds.width + 400;
  enemy.y = game.cat.y;
  const wave = { x: enemy.x, y: enemy.y, radius: 0, blocked: [[], [], [], []] };
  enemy.waves = [wave];
  game.robots = [enemy];
  const obstruction = { type: 'obstruction-circle', x: enemy.x + 45, y: enemy.y,
    ...obstructionGeometry({ type: 'obstruction-circle', width: 30 }) };
  game.obstructions = [obstruction];
  game.update(.5);
  assert.equal(enemy.dormant, true);
  const expected = { x: wave.x, y: wave.y, radius: wave.radius, blocked: [[], [], [], []] };
  referenceBlock(expected, game.brickParts(), 0, [obstruction]);
  assert.deepEqual(wave.blocked, expected.blocked);
  assert.ok(wave.blocked[0].some(([left, right]) => left < 0 && right > 0));
});

test('live waves outside the simulation buffer are retained for future camera positions', () => {
  const game = arena(), bounds = game.simulationBounds();
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'jackolantern', x: .8, y: .5 })[0];
  enemy.x = bounds.x + bounds.width + 400;
  const wave = { x: enemy.x, y: enemy.y, radius: 0, blocked: [[], [], [], []] };
  enemy.waves = [wave];
  game.robots = [enemy];
  game.update(.5);
  assert.equal(enemy.dormant, true);
  assert.deepEqual(enemy.waves, [wave]);
  assert.ok(wave.radius > 59);
  assert.ok(game.fireWaveSegments(wave).length);
});

test('brick geometry cache invalidates direct edits, grouping, spikes, dimensions, perimeter, and reset', () => {
  const game = arena(false);
  const first = game.brickParts();
  assert.equal(game.brickParts(), first);
  game.bricks[0].readyAt = 10;
  game.bricks[0].kind = 'fast';
  assert.equal(game.brickParts(), first, 'non-geometric state reuses geometry');
  for (const [field, value] of [['x', 12], ['y', 13], ['w', 95], ['h', 39], ['spikes', true],
    ['region', { edge: 'left', start: 0, end: .1 }], ['absorbedBy', 1]]) {
    const previous = game.brickParts();
    game.bricks[0][field] = value;
    const current = game.brickParts();
    assert.notEqual(current, previous, field);
    const part = current.find(part => part.sourceId === 0);
    assert.equal(part.id, game.bricks[0].absorbedBy ?? 0);
    assert.equal(part.x, game.bricks[0].x);
    assert.equal(part.region, game.bricks[0].region);
  }
  const grouped = game.brickParts();
  game.bricks[0].absorbedBy = null;
  assert.notEqual(game.brickParts(), grouped);
  assert.ok(game.brickParts()[0].collisionBody);
  for (const field of ['width', 'height']) {
    const previous = game.brickParts();
    game[field]++;
    assert.notEqual(game.brickParts(), previous, field);
  }
  let previous = game.brickParts();
  game.perimeter.reverse();
  assert.notEqual(game.brickParts(), previous);
  previous = game.brickParts();
  game.bricks = game.bricks.map(brick => ({ ...brick }));
  assert.equal(game.brickParts(), previous, 'equivalent replacements keep the cache valid');
  game.reset();
  assert.notEqual(game.brickParts(), previous);
  assert.equal(game.brickParts()[0].collisionBody, undefined);
});

test('in-place region edits invalidate cached spike collision bodies', () => {
  const game = arena(false), brick = game.bricks[0];
  brick.spikes = true;
  const previous = game.brickParts(), body = previous[0].collisionBody;
  brick.region.edge = brick.region.edge === 'top' ? 'left' : 'top';
  const current = game.brickParts();
  assert.notEqual(current, previous);
  assert.notDeepEqual(current[0].collisionBody, body);
  const cached = current;
  brick.region.start += .01;
  assert.notEqual(game.brickParts(), cached);
});

test('scrolling swept brick broad phase preserves all exact contacts and candidate order', () => {
  const game = arena(), parts = game.brickParts();
  let seed = 41;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 400; i++) {
    const x = random() * game.width, y = random() * game.height;
    const dx = (random() - .5) * 400, dy = (random() - .5) * 400, radius = 8 + random() * 40;
    const candidates = game.collisionCandidates(parts, x, y, dx, dy, radius);
    assert.ok(candidates.length < parts.length);
    assert.deepEqual(candidates, parts.filter(part => candidates.includes(part)));
    const contacts = parts.filter(part => brickContact(x, y, dx, dy, radius, part) <= 1);
    assert.ok(contacts.every(part => candidates.includes(part)), `sweep ${i} excludes no contact`);
  }
  const nonScrolling = arena(false), original = nonScrolling.brickParts();
  assert.equal(nonScrolling.collisionCandidates(original, 480, 300, 10, 10, 21), original);
});

test('scrolling cat, ram, ball and bomb collisions match unfiltered simulation', () => {
  const optimized = arena(), reference = arena();
  reference.collisionCandidates = parts => parts;
  for (const game of [optimized, reference]) {
    game.invulnerableUntil = Infinity;
    Object.assign(game.cat, { x: 400, y: 120, vx: 200, vy: -200 });
    const ram = game.createCustomSpawn({ kind: 'enemy', type: 'ram', x: .1, y: .2 })[0];
    Object.assign(ram, { x: 800, y: 100, state: 'charging', angle: -Math.PI / 2 });
    const ball = game.createCustomSpawn({ kind: 'enemy', type: 'ball', x: .15, y: .2 })[0];
    Object.assign(ball, { x: 1200, y: 100, phase: -Math.PI / 2 });
    const bucket = game.createCustomSpawn({ kind: 'enemy', type: 'bucket', x: .2, y: .2 })[0];
    Object.assign(bucket, { x: 1600, y: 180, shotTimer: 4 });
    game.fireBucketBomb(bucket);
    Object.assign(bucket.bombs[0], { x: 1600, y: 90, vx: 30, vy: -150 });
    game.robots = [ram, ball, bucket];
  }
  for (let i = 0; i < 120; i++) {
    optimized.update(1 / 120); reference.update(1 / 120);
    assert.deepEqual(optimized.cat, reference.cat, `cat tick ${i}`);
    assert.deepEqual(optimized.robots, reference.robots, `enemy tick ${i}`);
    assert.equal(optimized.hearts, reference.hearts);
  }
});
