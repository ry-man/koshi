const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, CHARACTERS, validateCustomLevel, brickRegions } = require('../src/game.js');
const { Tutorial, LESSONS } = require('../src/learning.js');

const blank = () => ({ version: 1, id: 'Snake test', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [] });
function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: blank() }); game.start(); return game;
}
function snake(game, shield) {
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'snake', x: 1, y: .5, shield })[0];
  game.robots = [enemy]; return enemy;
}
function centerCat(game) { game.cat.x = game.width / 2; game.cat.y = game.height / 2; }
function aim(game, segment) { game.cat.x = segment.x; game.cat.y = segment.y; }

test('snake schemas, scheduled spawns and shields initialize four perimeter segments without changing campaign', () => {
  const customLevel = { ...blank(), events: [{ time: 2, kind: 'enemy', type: 'snake', x: 1, y: .5, shield: 'blue' }],
    brickTypes: [{ edge: 'top', start: .2, end: .3, kind: 'normal', spawner: { kind: 'enemy', type: 'snake', shield: 'red' } }] };
  assert.deepEqual(validateCustomLevel(customLevel), customLevel);
  assert.throws(() => validateCustomLevel({ ...blank(), events: [{ time: 0, kind: 'enemy', type: 'snake', x: .5, y: .5 }] }), /edge/);
  const game = new Game(() => .5, { customLevel }); game.start(); game.update(2);
  assert.equal(game.robots[0].type, 'snake'); assert.equal(game.robots[0].defeatPoints, 4);
  assert.equal(game.snakeSegments(game.robots[0]).length, 4);
  game.spawnFromBrick(game.bricks.find(b => b.spawner));
  assert.equal(game.robots[1].type, 'snake'); assert.equal(game.robots[1].defeatPoints, 2);
  assert.equal(CHARACTERS.snake, 'Robo Snake');
  assert.ok(LEVELS.slice(0, 19).every(l => l.enemies.every(([, type]) => type !== 'snake')));
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  test(`four snake segments follow corners at Wheel speed and stay inside ${JSON.stringify(options)}`, () => {
    const game = arena(options), enemy = snake(game), bounds = game.bounds();
    centerCat(game);
    const initial = enemy.distance;
    game.combat(.1, game.cat.x, game.cat.y);
    assert.ok(Math.abs(enemy.distance - initial - 9.5) < 1e-6);
    for (let i = 0; i < 1200; i++) {
      game.combat(1 / 120, game.cat.x, game.cat.y);
      const segments = game.snakeSegments(enemy);
      assert.equal(segments.length, 4);
      for (const segment of segments) {
        assert.ok(segment.x >= bounds.left && segment.x <= bounds.right);
        assert.ok(segment.y >= bounds.top && segment.y <= bounds.bottom);
        assert.ok(segment.x === bounds.left || segment.x === bounds.right || segment.y === bounds.top || segment.y === bounds.bottom);
        assert.equal(segment.distance, enemy.distance - segment.index * 38);
      }
    }
  });
}

test('only the head can take sword or Boost damage; spiked body hurts even with weapons, fear or sleep', () => {
  for (const status of ['normal', 'fear', 'sleep', 'boost']) {
    const game = arena(), enemy = snake(game, 'blue'), body = game.snakeSegments(enemy)[3];
    aim(game, body); game.weapon = { type: 'silver', uses: 5, expires: Infinity };
    if (status === 'fear') game.collectItem({ type: 'spooky-mask' });
    if (status === 'sleep') game.collectItem({ type: 'music-box' });
    if (status === 'boost') game.boosted = true;
    game.combat(0, game.cat.x, game.cat.y);
    assert.equal(game.hearts, 2, status); assert.equal(enemy.shield, 'blue'); assert.equal(game.enemies, 0);
    assert.equal(game.weapon.uses, 5);
    game.combat(0, game.cat.x, game.cat.y); assert.equal(game.hearts, 2, 'normal immunity prevents repeated damage');
    game.elapsed += 1.01; game.combat(0, game.cat.x, game.cat.y);
    assert.equal(game.hearts, 1, 'body stays hazardous after immunity ends');
  }
  for (const boost of [false, true]) {
    const game = arena(), enemy = snake(game, 'red');
    game.cat.x = enemy.x - 50; game.cat.y = enemy.y;
    game.boosted = boost; game.weapon = { type: 'silver', uses: 5, expires: Infinity };
    game.combat(0, game.cat.x, game.cat.y);
    assert.equal(enemy.shield, null); assert.equal(game.enemies, 0);
    game.elapsed += 1.01; game.combat(0, game.cat.x, game.cat.y);
    assert.equal(game.enemies, 2); assert.equal(game.robots.length, 0);
    assert.equal(game.enemyDeaths[0].segments.length, 4);
    assert.equal(game.weapon.uses, boost ? 5 : 3);
  }
});

test('swept spiked segments catch fast Koshi crossings even while asleep', () => {
  const game = arena(), enemy = snake(game), body = game.snakeSegments(enemy)[3];
  game.collectItem({ type: 'music-box' });
  game.cat.x = body.x + 80; game.cat.y = body.y;
  game.combat(.1, body.x - 80, body.y);
  assert.equal(game.hearts, 2); assert.equal(game.enemies, 0);
});

test('sleep freezes the snake; fear slows it on the border; pause/reset and death preserve expected timing', () => {
  const game = arena(), enemy = snake(game); centerCat(game);
  game.collectItem({ type: 'music-box' }); const distance = enemy.distance;
  game.update(.2); assert.equal(enemy.distance, distance);
  game.enemiesSleepUntil = 0; game.collectItem({ type: 'spooky-mask' });
  game.update(.1); assert.ok(Math.abs(Math.abs(enemy.distance - distance) - 6.4) < 1e-6);
  assert.equal(enemy.afraid, true);
  game.pause(); const segments = game.snakeSegments(enemy);
  game.update(1); assert.deepEqual(game.snakeSegments(enemy), segments);
  game.resume();
  game.cat.x = enemy.x - 50; game.cat.y = enemy.y;
  game.weapon = { type: 'silver', uses: 5, expires: Infinity };
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.enemyDeaths.length, 1);
  game.pause(); game.update(.6); assert.equal(game.enemyDeaths[0].deathProgress, 0);
  game.resume(); game.update(.6); assert.ok(Math.abs(game.enemyDeaths[0].deathProgress - .5) < 1e-6);
  game.update(.61); assert.equal(game.enemyDeaths.length, 0);
  game.reset(); assert.equal(game.robots.length, 0);
});

test('every snake segment is blocked by growing fences without leaving the border', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const game = arena(options), enemy = snake(game); centerCat(game);
    const bounds = game.bounds();
    for (const index of [0, 1, 2, 3]) {
      const segment = game.snakeSegments(enemy)[index];
      const fence = { x: bounds.left, y: segment.y - 2, w: bounds.right - bounds.left, h: 4 };
      game.blockSnakeWithBarriers(enemy, { distance: enemy.distance, x: enemy.x, y: enemy.y }, [fence]);
      for (const part of game.snakeSegments(enemy)) {
        assert.ok(part.x >= bounds.left && part.x <= bounds.right && part.y >= bounds.top && part.y <= bounds.bottom);
        const y = Math.max(fence.y, Math.min(fence.y + fence.h, part.y));
        assert.ok(Math.abs(part.y - y) >= part.radius + (part.index ? 5 : 0) - 1e-6);
      }
    }
  }
});

test('fences block a leading body segment during reversal and reversal never flips the body across the head', () => {
  const game = arena(), enemy = snake(game), bounds = game.bounds(); centerCat(game);
  const before = game.snakeSegments(enemy);
  enemy.barrierDirection = -1;
  assert.deepEqual(game.snakeSegments(enemy).map(({ x, y }) => ({ x, y })),
    before.map(({ x, y }) => ({ x, y })));
  const fence = { x: bounds.left, y: before[3].y - 32, w: bounds.right - bounds.left, h: 4 };
  const old = { ...enemy };
  enemy.distance -= 20; game.placeWheel(enemy);
  game.blockSnakeWithBarriers(enemy, old, [fence]);
  assert.equal(enemy.distance, old.distance);
  assert.equal(enemy.barrierDirection, 1);
});

test('real expanding and fully extended barriers contain all four segments on every board edge', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) for (const name of ['top', 'bottom', 'left', 'right']) {
    const game = arena(options), enemy = snake(game), bounds = game.bounds();
    const regions = brickRegions(game.bricks, game.width, game.height);
    const brick = game.bricks.filter(b => regions.get(b.id).edge === name).sort((a, b) =>
      Math.hypot(a.x + a.w / 2 - game.width / 2, a.y + a.h / 2 - game.height / 2) -
      Math.hypot(b.x + b.w / 2 - game.width / 2, b.y + b.h / 2 - game.height / 2))[0];
    brick.barrier = true; game.barriers.push({ id: brick.id, length: 0, extending: true });
    const w = bounds.right - bounds.left, h = bounds.bottom - bounds.top;
    enemy.distance = name === 'top' ? w / 2 : name === 'right' ? w + h / 2 : name === 'bottom' ? w + h + w / 2 : 2 * w + h + h / 2;
    game.placeWheel(enemy); centerCat(game); game.cat.x += 80; game.cat.y += 60;
    for (let i = 0; i < 240; i++) {
      game.updateBarriers(1 / 60); game.combat(1 / 60, game.cat.x, game.cat.y);
      for (const segment of game.snakeSegments(enemy)) {
        assert.ok(segment.x >= bounds.left && segment.x <= bounds.right && segment.y >= bounds.top && segment.y <= bounds.bottom);
        for (const fence of game.barrierParts()) {
          const x = Math.max(fence.x, Math.min(fence.x + fence.w, segment.x));
          const y = Math.max(fence.y, Math.min(fence.y + fence.h, segment.y));
          assert.ok(Math.hypot(segment.x - x, segment.y - y) >= segment.radius + (segment.index ? 5 : 0) - 1e-6);
        }
      }
    }
  }
});

test('fast Rams cannot tunnel through any of the three body panels', () => {
  for (const index of [1, 2, 3]) {
    const game = arena(), enemy = snake(game), segment = game.snakeSegments(enemy)[index]; centerCat(game);
    const ram = game.createCustomSpawn({ kind: 'enemy', type: 'ram', x: .5, y: .5 })[0];
    ram.x = segment.x - 100; ram.y = segment.y; ram.angle = 0;
    ram.state = 'charging'; ram.speed = 900;
    const previous = new Map([[enemy, { ...enemy }], [ram, { ...ram }]]);
    ram.x = segment.x + 100; game.robots.push(ram);
    game.resolveSnakeBodyCollisions(previous);
    assert.ok(Math.cos(ram.angle) < 0);
    assert.ok(ram.x <= segment.x - ram.radius - segment.radius - 5 + 1e-6);
    assert.ok(ram.speed < 900);
  }
});

test('body spikes remain dangerous during head shield immunity, and sleeping or scared heads are harmless', () => {
  for (const item of ['music-box', 'spooky-mask']) {
    const game = arena(), enemy = snake(game, 'red');
    game.collectItem({ type: item }); game.cat.x = enemy.x - 20; game.cat.y = enemy.y + 25;
    game.combat(0, game.cat.x, game.cat.y); assert.equal(game.hearts, 3);
    enemy.invulnerableUntil = game.elapsed + 1;
    aim(game, game.snakeSegments(enemy)[3]);
    game.combat(0, game.cat.x, game.cat.y); assert.equal(game.hearts, 2);
  }
});

test('Robo Balls and soccer balls bounce from spiked body segments, not just the head', () => {
  const game = arena(), enemy = snake(game), segment = game.snakeSegments(enemy)[3]; centerCat(game);
  const ball = game.createCustomSpawn({ kind: 'enemy', type: 'ball', x: .5, y: .5 })[0];
  ball.x = segment.x - 45; ball.y = segment.y; ball.phase = 0;
  game.robots.push(ball);
  for (let i = 0; i < 20; i++) game.combat(1 / 120, game.cat.x, game.cat.y);
  assert.ok(Math.cos(ball.phase) < 0); assert.equal(game.enemies, 0);
  const part = game.snakeSegments(enemy)[3];
  const soccer = game.createSoccerBall({ x: part.x - 60, y: part.y }); soccer.vx = 400;
  game.soccerBalls = [soccer];
  for (let i = 0; i < 20; i++) game.updateSoccerBalls(1 / 120, game.cat.x, game.cat.y, new Map([[enemy, { ...enemy }], [ball, { ...ball }]]));
  assert.ok(soccer.vx < 0);
});

test('crowded snakes and Wheels settle without any head or body overlap and remain on the perimeter', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const game = arena(options); centerCat(game);
    game.robots = ['snake', 'snake', 'wheel'].map(type => game.createCustomSpawn({ kind: 'enemy', type, x: 1, y: .5 })[0]);
    for (let i = 0; i < 120; i++) game.combat(1 / 120, game.cat.x, game.cat.y);
    const actors = enemy => enemy.type === 'snake' ? game.snakeSegments(enemy).map(part => ({
      ...part, radius: part.radius + (part.index ? 5 : 0),
    })) : [enemy];
    for (let i = 0; i < game.robots.length; i++) for (let j = i + 1; j < game.robots.length; j++) {
      for (const a of actors(game.robots[i])) for (const b of actors(game.robots[j])) {
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius - 1e-6);
      }
    }
  }
});

test('snake tutorial can defeat the head with real steering in both layouts', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const tutorial = new Tutorial(); tutorial.select(LESSONS.findIndex(l => l.id === 'snake'), options);
    const { game, target } = tutorial;
    tutorial.steer(target.id, target.x + target.w / 2, target.y + target.h / 2);
    for (let i = 0; i < 500; i++) { game.update(1 / 120); tutorial.observe(); }
    assert.equal(tutorial.currentComplete, true);
  }
});

test('snake collision geometry is generated at most once per snake per resolution, even in a crowd', () => {
  const game = arena();
  game.robots = Array.from({ length: 8 }, () => game.createCustomSpawn({ kind: 'enemy', type: 'snake', x: 1, y: .5 })[0]);
  const previous = new Map(game.robots.map(enemy => [enemy, { ...enemy }]));
  const original = game.snakeSegments;
  let queries = 0;
  game.snakeSegments = function(enemy) { queries++; return original.call(this, enemy); };
  game.resolveSnakeBodyCollisions(previous);
  assert.ok(queries <= game.robots.length, `geometry rebuilt ${queries} times for eight snakes`);
  game.robots = [game.robots[0]]; queries = 0;
  game.resolveSnakeBodyCollisions(previous);
  assert.equal(queries, 0, 'a lone snake needs no enemy separation work');
});

test('analytic snake separation matches the existing perimeter solver across edges and corners', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const game = arena(options), bounds = game.bounds();
    const w = bounds.right - bounds.left, h = bounds.bottom - bounds.top;
    for (const corner of [0, w, w + h, 2 * w + h]) for (const offset of [-35, -10, 0, 10, 35]) {
      const a = { type: 'snake', radius: 24, distance: corner + offset };
      const b = { type: 'wheel', radius: 19, distance: a.distance + 15 };
      game.placeWheel(a); game.placeWheel(b);
      const referenceA = { ...a, type: 'wheel' }, referenceB = { ...b };
      const overlap = a.radius + b.radius - Math.hypot(a.x - b.x, a.y - b.y);
      game.separateEnemyPair(referenceA, referenceB, 1, 0, overlap);
      game.separateEnemyPair(a, b, 1, 0, overlap);
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius - 1e-6);
      assert.ok(Math.abs(a.distance - referenceA.distance) < 1e-6);
      assert.ok(Math.abs(b.distance - referenceB.distance) < 1e-6);
    }
  }
});
