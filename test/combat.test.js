const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, SWORDS } = require('../src/game.js');

function arena(options = {}) {
  const game = new Game(() => .25, { level: 1, ...options });
  game.start();
  return game;
}

function mouse(game, x = game.cat.x, y = game.cat.y) {
  return { type: 'mouse', x, y, radius: 19, phase: 0, age: 4.5, touching: false };
}

function equip(game, type) {
  game.weapons.push({ x: game.cat.x, y: game.cat.y, type });
  game.update(.01);
  assert.equal(game.weapon.type, type);
}

test('level 1-2 has the exact food, robot, weapon timelines and brick mix', () => {
  assert.equal(LEVELS[1].duration, 120);
  assert.equal(LEVELS[1].goal, 20);
  assert.equal(LEVELS[1].heartCost, 10);
  assert.deepEqual(LEVELS[1].food, [[5,'S','S',10],[10,'S','S',10],[15,'S','S',10],[20,'L3','S',10],[25,'L3','S',10],[30,'L3','S',10],[35,'C3','S',10],[40,'C4','S',10],[50,'C5','S',10],[60,'R5','P',15],[80,'R5','P',15],[100,'R5','P',15]]);
  assert.deepEqual(LEVELS[1].enemies, [[10,'mouse',3],[20,'wheel',1],[30,'mouse',3],[40,'wheel',1],[50,'wheel',1],[60,'mouse',3],[70,'mouse',3],[80,'wheel',1],[90,'wheel',1],[100,'mouse',3]]);
  assert.deepEqual(LEVELS[1].weapons, [[5,'wood'],[15,'bronze'],[30,'silver'],[50,'gold'],[70,'silver'],[80,'gold']]);
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = arena(options);
    assert.equal(game.bricks.filter(b => b.kind === 'slow').length, 3);
    assert.equal(game.bricks.filter(b => b.kind === 'fast').length, 3);
  }
  assert.throws(() => new Game(Math.random, { level: 2 }), RangeError);
});

test('all scheduled events fire once, including late events and 120-second timeout', () => {
  const game = arena();
  // Park outside the enemy corridor to exercise the complete timeline.
  game.cat.x = 22; game.cat.y = 22;
  const food = [], robots = [];
  const spawn = game.spawn.bind(game), spawnEnemies = game.spawnEnemies.bind(game);
  game.spawn = event => { food.push(event); spawn(event); };
  game.spawnEnemies = event => { robots.push(event); spawnEnemies(event); };
  game.update(4.99);
  assert.equal(game.weapons.length, 0);
  game.update(.02);
  assert.equal(game.weapons[0].type, 'wood');
  game.update(115);
  assert.equal(game.state, 'lost');
  assert.equal(game.elapsed, 120);
  assert.deepEqual(food, LEVELS[1].food);
  assert.deepEqual(robots, LEVELS[1].enemies);
  assert.deepEqual(game.weapons.map(w => w.type), LEVELS[1].weapons.map(w => w[1]));
  assert.equal(game.robots.length, 20);
});

test('wood, bronze, and silver break at precisely their defeat limits', () => {
  for (const type of ['wood', 'bronze', 'silver']) {
    const game = arena();
    equip(game, type);
    for (let i = 0; i < SWORDS[type].uses; i++) {
      game.robots.push(mouse(game));
      game.update(.01);
      assert.equal(game.enemies, i + 1);
      assert.equal(game.hearts, 3);
      assert.equal(game.robots.length, 0);
    }
    assert.equal(game.weapon, null);
    game.robots.push(mouse(game));
    game.update(.01);
    assert.equal(game.hearts, 2);
  }
});

test('gold has unlimited defeats for 15 seconds and pause freezes its timer', () => {
  const game = arena();
  equip(game, 'gold');
  const expiry = game.weapon.expires;
  game.robots = Array.from({ length: 25 }, () => mouse(game));
  game.update(.01);
  assert.equal(game.enemies, 25);
  assert.equal(game.hearts, 3);
  game.pause();
  game.update(30);
  assert.equal(game.weapon.expires, expiry);
  game.resume();
  // Isolate timed expiry from level events.
  game.nextEnemy = LEVELS[1].enemies.length;
  game.update(14.9);
  assert.equal(game.weapon.type, 'gold');
  game.update(.1);
  assert.equal(game.weapon, null);
});

test('weapons cannot be swapped, and uncollected swords persist', () => {
  const game = arena();
  equip(game, 'wood');
  game.weapons.push({ x: game.cat.x, y: game.cat.y, type: 'silver' });
  game.update(1);
  assert.equal(game.weapon.type, 'wood');
  assert.equal(game.weapons.length, 1);
  game.robots.push(mouse(game));
  game.update(.001);
  assert.equal(game.weapon, null);
  game.update(.001);
  assert.equal(game.weapon.type, 'silver');
  assert.equal(game.weapons.length, 0);
});

test('every sword defeats wheels too, and swept motion collects weapons and hearts', () => {
  for (const type of Object.keys(SWORDS)) {
    const game = arena();
    equip(game, type);
    game.spawnEnemies([0, 'wheel', 1]);
    game.cat.x = game.robots[0].x; game.cat.y = game.robots[0].y;
    game.update(.01);
    assert.equal(game.robots.length, 0);
    assert.equal(game.enemies, 1);
    assert.equal(game.hearts, 3);
  }
  const game = arena();
  game.weapons = [{ x: 520, y: 300, type: 'bronze' }];
  game.healing = [{ x: 550, y: 300 }];
  game.hearts = 1;
  game.cat.vx = 420;
  game.update(.2);
  assert.equal(game.weapon.type, 'bronze');
  assert.equal(game.hearts, 2);
  assert.equal(game.healing.length, 0);
});

test('unarmed damage happens once per contact, can recur, and can kill', () => {
  const game = arena();
  const enemy = mouse(game);
  game.robots = [enemy];
  game.update(.2);
  assert.equal(game.hearts, 2);
  game.cat.x += 100; game.update(.01);
  game.cat.x -= 100; game.update(.01);
  assert.equal(game.hearts, 1);
  game.cat.x += 100; game.update(.01);
  game.cat.x -= 100; game.update(.01);
  assert.equal(game.hearts, 0);
  assert.equal(game.state, 'lost');
});

test('food thresholds spawn healing hearts, pickups cap at three, and level 1-1 has none', () => {
  const game = arena();
  game.score = 9;
  game.food = [{ x: game.cat.x, y: game.cat.y, type: 'S', expires: 5 }];
  game.update(.01);
  assert.equal(game.healing.length, 1);
  game.update(.1);
  assert.equal(game.healing.length, 1);
  game.hearts = 1;
  game.cat.x = game.healing[0].x; game.cat.y = game.healing[0].y;
  game.update(.01);
  assert.equal(game.hearts, 2);
  game.healing = [{ x: game.cat.x, y: game.cat.y }, { x: game.cat.x, y: game.cat.y }];
  game.update(.01);
  assert.equal(game.hearts, 3);
  assert.equal(game.healing.length, 0);
  game.score = 19;
  game.food = [{ x: game.cat.x, y: game.cat.y, type: 'S', expires: 5 }];
  game.update(.01);
  assert.equal(game.nextHeart, 30);
  assert.equal(game.state, 'won');
  const first = new Game(); first.start(); first.score = 19; first.update(.01);
  assert.equal(first.healing.length, 0);
});

test('mouse pauses to lick hands and wheels remain on the inner perimeter in both layouts', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = arena(options);
    game.spawnEnemies([0, 'mouse', 1]);
    const enemy = game.robots[0];
    enemy.age = 4.6;
    const { x, y } = enemy;
    game.combat(.1, game.cat.x, game.cat.y);
    assert.equal(enemy.resting, true);
    assert.equal(enemy.x, x); assert.equal(enemy.y, y);
    enemy.age = 6;
    game.combat(.1, game.cat.x, game.cat.y);
    assert.notEqual(enemy.x, x);
    game.spawnEnemies([0, 'wheel', 1]);
    const wheel = game.robots[1], b = game.bounds();
    const distance = wheel.distance;
    for (let i = 0; i < 500; i++) {
      game.combat(.05, game.cat.x, game.cat.y);
      assert.ok(wheel.x >= b.left && wheel.x <= b.right && wheel.y >= b.top && wheel.y <= b.bottom);
      assert.ok(wheel.x === b.left || wheel.x === b.right || wheel.y === b.top || wheel.y === b.bottom);
    }
    assert.ok(wheel.distance > distance);
  }
});

test('new pickups and enemies spawn clear of all bricks, and reset clears combat state', () => {
  for (const random of [() => 0, () => .99999, Math.random]) {
    for (const options of [{}, { portrait: true, scale: .31 }]) {
      const game = new Game(random, { level: 1, ...options });
      for (let i = 0; i < 20; i++) {
        const point = game.randomPoint();
        for (const brick of game.bricks) {
          const x = Math.max(brick.x, Math.min(brick.x + brick.w, point.x));
          const y = Math.max(brick.y, Math.min(brick.y + brick.h, point.y));
          assert.ok(Math.hypot(point.x - x, point.y - y) >= 24.99);
        }
      }
      game.start(); equip(game, 'silver');
      game.healing.push(game.randomPoint()); game.spawnEnemies([0, 'wheel', 1]);
      game.reset();
      assert.equal(game.weapon, null);
      assert.equal(game.robots.length + game.weapons.length + game.healing.length, 0);
      assert.equal(game.nextHeart, 10);
      assert.equal(game.level.id, '1-2');
    }
  }
});
