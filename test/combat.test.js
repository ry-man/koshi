const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, SWORDS } = require('../src/game.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
  assert.throws(() => new Game(Math.random, { level: LEVELS.length }), RangeError);
});

test('new campaign levels have reachable goals, timely supplies, and special bricks in both layouts', () => {
  assert.deepEqual(LEVELS.map(level => level.id), ['1-1', '1-2', '1-3', '1-4', '1-5']);
  const { FOODS, validateCustomLevel } = require('../src/game.js');
  for (const [offset, killGoal] of [4, 8, 12].entries()) {
    const levelIndex = offset + 2, level = LEVELS[levelIndex];
    assert.equal(level.killGoal, killGoal);
    const enemyTotal = level.enemies.reduce((sum, event) => sum + event[2], 0);
    assert.ok(enemyTotal > killGoal);
    const foodTotal = level.food.reduce((sum, [, method, type]) =>
      sum + (method === 'S' ? 1 : Number(method.slice(1))) * FOODS[type].value, 0);
    assert.ok(foodTotal >= level.goal * 2);
    for (const timeline of [level.food, level.enemies, level.weapons]) {
      assert.ok(timeline.every(([time], i) => time >= 0 && time < level.duration && (!i || time >= timeline[i - 1][0])));
    }
    assert.ok(level.weapons[0][0] < level.enemies[0][0]);
    assert.ok(level.weapons.reduce((sum, [, type]) => sum + (SWORDS[type].uses ?? 0), 0) >= killGoal);
    validateCustomLevel({ ...level, version: 1, events: [] });
    for (const options of [{}, { portrait: true, scale: .6 }]) {
      const game = arena({ level: levelIndex, ...options });
      for (const entry of level.brickTypes) {
        const matching = game.bricks.filter(brick => brick.region.edge === entry.edge
          && (brick.region.start + brick.region.end) / 2 >= entry.start
          && (brick.region.start + brick.region.end) / 2 < entry.end);
        assert.ok(matching.length);
        for (const brick of matching) {
          for (const attribute of ['kind', 'crumbler', 'warped', 'slimed', 'slimeColor', 'springs', 'spikes']) {
            if (entry[attribute] !== undefined) assert.equal(brick[attribute], entry[attribute]);
          }
        }
      }
      assert.ok(game.bricks.some(brick => !brick.crumbler && !brick.slimed && !brick.springs && !brick.spikes && !brick.warped));
      assert.equal(game.bricks.filter(brick => brick.spikes).length, levelIndex === 4 ? 2 : 1);
      const snapshot = structuredClone(game.bricks);
      game.steer(game.bricks.find(brick => brick.crumbler).id);
      game.reset();
      assert.deepEqual(game.bricks, snapshot);
      assert.equal(game.enemies, 0);
      assert.equal(game.score, 0);
    }
  }
});

test('new campaign levels require both goals and count the final real sword defeat', () => {
  for (const level of [2, 3, 4]) {
    for (const options of [{}, { portrait: true, scale: .6 }]) {
      const game = arena({ level, ...options });
      game.score = game.level.goal;
      game.enemies = game.level.killGoal - 1;
      equip(game, 'silver');
      assert.equal(game.state, 'playing', 'food alone must not win');
      game.robots.push(mouse(game));
      game.update(.01);
      assert.equal(game.enemies, game.level.killGoal);
      assert.equal(game.state, 'won');

      const hungry = arena({ level, ...options });
      hungry.enemies = hungry.level.killGoal;
      hungry.score = hungry.level.goal - 1;
      hungry.update(.01);
      assert.equal(hungry.state, 'playing', 'defeats alone must not win');
      hungry.food.push({ x: hungry.cat.x, y: hungry.cat.y, type: 'S', expires: 5 });
      hungry.update(.01);
      assert.equal(hungry.state, 'won');

      const timeout = arena({ level, ...options });
      timeout.score = timeout.level.goal;
      timeout.elapsed = timeout.level.duration - .01;
      timeout.nextEnemy = timeout.level.enemies.length;
      timeout.nextWeapon = timeout.level.weapons.length;
      timeout.nextEvent = timeout.level.food.length;
      timeout.update(.02);
      assert.equal(timeout.state, 'lost', 'missing defeats must lose at timeout');
    }
  }
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

test('enemy deaths are harmless snapshots, freeze on pause, expire, and clear on restart', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    for (const type of ['mouse', 'wheel']) {
      const game = arena(options);
      game.cat.x = game.bounds().left; game.cat.y = game.bounds().top;
      game.weapon = { type: 'wood', uses: 1, expires: Infinity };
      const enemy = { ...mouse(game), type, distance: 0 };
      game.robots.push(enemy);
      game.combat(0, game.cat.x, game.cat.y);
      assert.equal(game.robots.length, 0);
      assert.equal(game.enemies, 1);
      assert.equal(game.weapon, null);
      const death = game.enemyDeaths[0];
      assert.notEqual(death, enemy);
      assert.equal(death.type, type);
      assert.equal(death.deathProgress, 0);
      const { x, y } = death;
      game.update(.35);
      assert.ok(death.deathProgress > 0 && death.deathProgress < 1);
      assert.equal(death.x, x); assert.equal(death.y, y);
      assert.equal(game.enemies, 1);
      assert.equal(game.hearts, 3, 'a wreck overlapping an unarmed cat does not hurt');
      const progress = death.deathProgress;
      game.pause();
      for (const seconds of [10, NaN, Infinity, -1, 0]) game.update(seconds);
      assert.equal(death.deathProgress, progress);
      game.resume();
      game.update(type === 'mouse' ? .75 : .35);
      assert.equal(game.enemyDeaths.length, 0);
      game.enemyDeaths.push({ ...death, deathProgress: 0 });
      game.reset();
      assert.equal(game.enemyDeaths.length, 0);
    }
  }
});

test('the final enemy death finishes without advancing completed gameplay', () => {
  const game = arena({ level: 2 });
  game.score = game.level.goal;
  game.enemies = game.level.killGoal - 1;
  game.weapon = { type: 'wood', uses: 1, expires: Infinity };
  game.robots.push(mouse(game));
  game.update(.01);
  assert.equal(game.state, 'won');
  assert.equal(game.enemyDeaths.length, 1);
  const elapsed = game.elapsed;
  game.update(.5);
  assert.ok(game.enemyDeaths[0].deathProgress > .4);
  assert.equal(game.elapsed, elapsed);
  game.update(.6);
  assert.equal(game.enemyDeaths.length, 0);
  game.state = 'lost';
  game.enemyDeaths.push({ ...mouse(game), deathProgress: 0 });
  game.update(1.1);
  assert.equal(game.enemyDeaths.length, 0);
  assert.equal(game.elapsed, elapsed);
});

test('mouse deaths drop ears and lose eye color; wheel deaths shrink into a fireball', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [], stack = [];
  const gradient = { addColorStop(...args) { operations.push(['colorStop', ...args]); } };
  const ctx = new Proxy({ globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'save') return () => stack.push({ ...target });
      if (name === 'restore') return () => Object.assign(target, stack.pop());
      if (name === 'createRadialGradient') return (...args) => { operations.push([name, ...args]); return gradient; };
      return (...args) => operations.push([name, ...args, target.fillStyle, target.globalAlpha]);
    },
    set(target, name, value) { target[name] = value; return true; },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function line('), source.indexOf('function drawCat('))
    + source.slice(source.indexOf('function drawRobot('), source.indexOf('function resize(')), context);
  const draw = (type, progress = null) => {
    operations.length = 0;
    const enemy = { type, x: 100, y: 100, distance: 0, deathProgress: progress };
    if (progress === null) context.drawRobot(enemy);
    else context.drawEnemyDeath(enemy);
    assert.equal(ctx.globalAlpha, 1);
    assert.equal(stack.length, 0);
    return operations.slice();
  };
  const alive = draw('mouse');
  assert.ok(alive.some(op => op[0] === 'fillRect' && op.at(-2) === '#d46665'));
  const mouseDeath = draw('mouse', .4);
  assert.ok(mouseDeath.some(op => op[0] === 'translate' && op[1] === -12 && Math.abs(op[2] - 16) < 1e-9));
  assert.ok(mouseDeath.some(op => op[0] === 'fillRect' && op.at(-2) === '#53616b'));
  assert.ok(!mouseDeath.some(op => op[0] === 'fillRect' && op.at(-2) === '#d46665'));
  assert.ok(mouseDeath.some(op => op[0] === 'fill' && op.at(-2) === '#a8b2b9' && op.at(-1) < 1));
  const smoke = draw('mouse', .9);
  assert.ok(smoke.some(op => op[0] === 'fillRect' && op.at(-1) === 0));
  const implosion = draw('wheel', .2);
  assert.ok(implosion.some(op => op[0] === 'scale' && op[1] > 0 && op[1] < 1));
  assert.ok(!implosion.some(op => op[0] === 'createRadialGradient'));
  const fireball = draw('wheel', .5);
  for (const color of ['#e94b25', '#ffac32', '#fff2ab']) {
    assert.ok(fireball.some(op => op[0] === 'fill' && op.at(-2) === color));
  }
  assert.ok(!fireball.some(op => op[0] === 'scale'));
  assert.match(source, /for \(const enemy of game\.enemyDeaths\) drawEnemyDeath\(enemy\)/);
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
  game.cat.x += 100; game.update(1);
  game.cat.x = enemy.x; game.cat.y = enemy.y; game.update(.01);
  assert.equal(game.hearts, 1);
  game.cat.x += 100; game.update(1);
  game.cat.x = enemy.x; game.cat.y = enemy.y; game.update(.01);
  assert.equal(game.hearts, 0);
  assert.equal(game.state, 'lost');
});

test('food thresholds spawn healing hearts, pickups cap at three, and level 1-1 has none', () => {
  const game = arena();
  game.score = 9;
  game.food = [{ x: game.cat.x, y: game.cat.y, type: 'S', expires: 5 }];
  game.update(.01);
  assert.equal(game.healing.length, 0);
  assert.equal(game.spawnCues.filter(cue => cue.kind === 'heart').length, 1);
  game.update(.1);
  assert.equal(game.healing.length, 0);
  game.update(1);
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
