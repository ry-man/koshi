const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, SWORDS, SHIELDS } = require('../src/game.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function arena(options = {}) {
  const game = new Game(() => .25, options.level === undefined
    ? { customLevel: { version: 1, id: 'Combat test', duration: 120, goal: 20, heartCost: 10, brickSet: 3, events: [] }, ...options }
    : options);
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

test('new campaign levels require both goals and count the final real sword defeat', () => {
  for (const level of LEVELS.flatMap((entry, index) => entry.goal > 0 && entry.killGoal > 0 ? [index] : [])) {
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

test('all scheduled events fire once, including late events and timeout', () => {
  const game = arena({ level: 2 });
  // Park outside the enemy corridor to exercise the complete timeline.
  game.cat.x = 22; game.cat.y = 22;
  const food = [], robots = [];
  const spawn = game.spawn.bind(game), spawnEnemies = game.spawnEnemies.bind(game);
  game.spawn = event => { food.push(event); spawn(event); };
  game.spawnEnemies = event => { robots.push(event); spawnEnemies(event); };
  game.update(19.99);
  assert.equal(game.weapons.length, 0);
  game.update(.02);
  assert.equal(game.weapons[0].type, 'wood');
  game.update(90);
  assert.equal(game.state, 'lost');
  assert.equal(game.elapsed, 90);
  assert.deepEqual(food, LEVELS[2].food);
  assert.deepEqual(robots, LEVELS[2].enemies);
  assert.deepEqual(game.weapons.map(w => w.type), LEVELS[2].weapons.map(w => w[1]));
  assert.equal(game.robots.length, LEVELS[2].enemies.reduce((sum, [, , count]) => sum + count, 0));
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
    for (const type of ['mouse', 'wheel', 'ram', 'bucket']) {
      const game = arena(options);
      game.cat.x = game.bounds().left; game.cat.y = game.bounds().top;
      game.weapon = { type: 'wood', uses: 1, expires: Infinity };
      const enemy = { ...mouse(game), type, distance: 0 };
      if (type === 'ram') game.initializeRam(enemy);
      if (type === 'bucket') {
        game.initializeBucket(enemy);
        enemy.bombs.push({ x: game.cat.x + 100, y: game.cat.y, state: 'flying', fuse: 1, blastAge: 0, blastRadius: 0 });
      }
      game.robots.push(enemy);
      game.combat(0, game.cat.x, game.cat.y);
      assert.equal(game.robots.length, 0);
      assert.equal(game.enemies, 1);
      assert.equal(game.weapon, null);
      const death = game.enemyDeaths[0];
      assert.notEqual(death, enemy);
      assert.equal(death.type, type);
      assert.equal(death.deathProgress, 0);
      if (type === 'bucket') {
        assert.equal(death.bombs.length, 1);
        assert.notEqual(death.bombs[0], enemy.bombs[0]);
      }
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
      game.update(type === 'mouse' ? .75 : type === 'ram' || type === 'bucket' ? .6 : .35);
      assert.equal(game.enemyDeaths.length, 0);
      game.enemyDeaths.push({ ...death, deathProgress: 0 });
      game.reset();
      assert.equal(game.enemyDeaths.length, 0);
    }
  }
});

test('the final enemy death finishes without advancing completed gameplay', () => {
  const game = arena({ level: 3 });
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

test('sword blades, guards and handles have thin dark outlines and bronze has a green patina', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const strokes = [], fills = [];
  const ctx = new Proxy({ fillStyle: '', strokeStyle: '', lineWidth: 0 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'stroke') return () => strokes.push([target.strokeStyle, target.lineWidth]);
      if (name === 'fill') return () => fills.push(target.fillStyle);
      return () => {};
    },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function line('), source.indexOf('function drawCat('))
    + source.slice(source.indexOf('function drawSword('), source.indexOf('function drawRobot(')), context);
  for (const sword of Object.values(SWORDS)) {
    strokes.length = 0; fills.length = 0;
    context.drawSword(0, 0, sword.color);
    assert.deepEqual(fills, [sword.color]);
    assert.deepEqual(strokes, [['#17212a', 1.5], ['#17212a', 7], ['#8a6953', 5], ['#17212a', 6], [sword.color, 4]]);
  }
  const [red, green, blue] = SWORDS.bronze.color.slice(1).match(/../g).map(component => parseInt(component, 16));
  assert.ok(green > red && green > blue);
  assert.notEqual(SWORDS.bronze.color, SWORDS.wood.color);
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
    set(target, name, value) {
      if (name === 'filter') operations.push(['filter', value]);
      target[name] = value; return true;
    },
  });
  const context = vm.createContext({ ctx, SHIELDS });
  vm.runInContext(source.slice(source.indexOf('function line('), source.indexOf('function drawCat('))
    + source.slice(source.indexOf('function drawRobot('), source.indexOf('function resize(')), context);
  const draw = (type, progress = null) => {
    operations.length = 0;
    const enemy = {
      type, x: 100, y: 100, distance: 0, age: 0, bombs: [{ x: 120, y: 100 }],
      state: type === 'ram' ? 'targeting' : undefined, stateTime: .5, facingAngle: 0, deathProgress: progress,
    };
    if (progress === null) context.drawRobot(enemy);
    else context.drawEnemyDeath(enemy);
    assert.equal(ctx.globalAlpha, 1);
    assert.equal(stack.length, 0);
    return operations.slice();
  };
  const alive = draw('mouse');
  operations.length = 0;
  context.drawRobot({ type: 'mouse', x: 100, y: 100, shield: 'blue', radius: 19 }, null, .25);
  assert.ok(operations.some(op => op[0] === 'arc' && op[3] === 28), 'shield ring surrounds the unchanged enemy');
  for (const type of ['mouse', 'wheel', 'ram', 'bucket']) {
    for (const [damageProgress, color] of [[0, '#dc626b'], [.25, '#f2a0a5']]) {
      operations.length = 0;
      context.drawRobot({ type, x: 100, y: 100, shield: 'blue', radius: 19, age: 0, distance: 0 }, null, damageProgress);
      assert.ok(operations.some(op => op[0] === 'fill' && op.at(-2) === color), `${type} blinks red`);
      assert.ok(!operations.some(op => op[0] === 'filter'), 'damage never applies a canvas filter');
    }
  }
  assert.equal(stack.length, 0);
  assert.ok(alive.some(op => op[0] === 'fillRect' && op.at(-2) === '#d46665'));
  const mouseDeath = draw('mouse', .4);
  assert.ok(mouseDeath.some(op => op[0] === 'translate' && op[1] === -12 && Math.abs(op[2] - 16) < 1e-9));
  assert.ok(mouseDeath.some(op => op[0] === 'fillRect' && op.at(-2) === '#53616b'));
  assert.ok(!mouseDeath.some(op => op[0] === 'fillRect' && op.at(-2) === '#d46665'));
  assert.ok(mouseDeath.some(op => op[0] === 'fill' && op.at(-2) === '#a8b2b9' && op.at(-1) < 1));
  const smoke = draw('mouse', .9);
  assert.ok(smoke.some(op => op[0] === 'fillRect' && op.at(-1) === 0));
  const ramAlive = draw('ram');
  assert.ok(ramAlive.some(op => op[0] === 'bezierCurveTo'));
  assert.ok(ramAlive.some(op => op[0] === 'ellipse' && op[1] === -2.5 && op[2] === 4), 'the ram has nostrils above its mouth');
  const ramTelegraph = draw('ram');
  assert.ok(ramTelegraph.some(op => op[0] === 'fill' && String(op.at(-2)).startsWith('rgba(255,45,48')));
  const ramDeath = draw('ram', .5);
  assert.ok(ramDeath.some(op => op[0] === 'rotate' && Math.abs(op[1]) > 0));
  assert.ok(ramDeath.some(op => op[0] === 'fill' && op.at(-2) === '#d1dce4' && op.at(-1) < 1));
  const bucketAlive = draw('bucket');
  assert.ok(bucketAlive.some(op => op[0] === 'ellipse' && op.at(-2) === '#db4847'));
  assert.ok(bucketAlive.some(op => op[0] === 'quadraticCurveTo' && op[1] === 0 && op[2] === 19 && op[3] === 8 && op[4] === 13),
    'the living bucket smiles with the center of its mouth below the corners');
  const bucketDefeated = draw('bucket', 0);
  assert.ok(bucketDefeated.some(op => op[0] === 'quadraticCurveTo' && op[1] === 0 && op[2] === 11 && op[3] === 8 && op[4] === 15),
    'the bucket frowns immediately upon defeat');
  const bucketArmsFall = draw('bucket', .2);
  assert.ok(bucketArmsFall.some(op => op[0] === 'translate' && Math.abs(op[1]) > 16 && op[2] > -8),
    'the bucket arms fall away from the body');
  const bucketFrown = draw('bucket', .4);
  assert.ok(bucketFrown.some(op => op[0] === 'quadraticCurveTo' && op[1] === 0 && op[2] === 11 && op[3] === 8 && op[4] === 15),
    'the bucket frowns before melting');
  const bucketDeath = draw('bucket', .5);
  assert.ok(bucketDeath.some(op => op[0] === 'arc' && op.at(-2) === '#ff7040'));
  const bucketMelting = draw('bucket', .8);
  assert.ok(bucketMelting.some(op => op[0] === 'scale' && op[1] === 1 && op[2] < .5),
    'the bucket melts away vertically');
  assert.ok(bucketMelting.some(op => op[0] === 'quadraticCurveTo' && op[1] === 0 && op[2] === 11 && op[3] === 8 && op[4] === 15),
    'the frown remains as the bucket melts');
  const smokeIndex = bucketArmsFall.findIndex(op => op[0] === 'fill' && op.at(-2) === '#9aa5a9');
  const bucketBody = bucketArmsFall.findIndex(op => op[0] === 'fill' && op.at(-2) === '#c9bd76');
  assert.ok(smokeIndex >= 0 && bucketBody > smokeIndex, 'smoke appears behind the bucket death animation');
  for (const [fuse, color] of [[3, 'rgb(57,139,214)'], [1.5, 'rgb(145,98,134)'], [0, 'rgb(232,56,54)']]) {
    operations.length = 0;
    context.drawBomb({ x: 100, y: 100, radius: 8, state: 'flying', fuse });
    assert.ok(operations.some(op => op[0] === 'fill' && op.at(-2) === color), `bomb color matches ${fuse} seconds remaining`);
    assert.equal(ctx.globalAlpha, 1);
    assert.equal(stack.length, 0);
  }
  operations.length = 0;
  context.drawRobot({ type: 'ram', x: 100, y: 100, angle: 0, facingAngle: -Math.PI / 2, state: 'charging' });
  assert.ok(operations.some(op => op[0] === 'rotate' && Math.abs(op[1] + Math.PI / 2) < 1e-9));
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

test('each shield tier takes its full hit count, shares Koshi protection timing, and awards points only on defeat', () => {
  for (const type of ['mouse', 'wheel', 'ram', 'bucket']) {
    for (const shield of ['red', 'green', 'blue']) {
      const game = arena();
      const enemy = game.createCustomSpawn({ kind: 'enemy', type, shield, x: .5, y: .5 })[0];
      game.robots = [enemy];
      game.weapon = { type: 'silver', uses: 5, expires: Infinity };
      const initialPoints = SHIELDS[shield].hits;
      for (let hit = 1; hit <= initialPoints; hit++) {
        enemy.x = game.cat.x; enemy.y = game.cat.y;
        game.combat(0, game.cat.x, game.cat.y);
        assert.equal(game.weapon.uses, 5 - hit);
        if (hit === initialPoints) break;
        assert.equal(game.enemies, 0);
        assert.equal(game.enemyDeaths.length, 0);
        assert.equal(enemy.shield, hit === initialPoints - 1 ? null : hit === initialPoints - 2 ? 'red' : 'green');
        assert.equal(game.enemyDamageProgress(enemy), 0);
        game.takeDamage();
        assert.equal(enemy.invulnerableUntil, game.invulnerableUntil);
        const deadline = enemy.invulnerableUntil;
        game.elapsed = deadline - .00001;
        game.combat(0, game.cat.x, game.cat.y);
        assert.equal(game.weapon.uses, 5 - hit, 'protected contacts do not consume sword uses');
        assert.equal(enemy.invulnerableUntil, deadline, 'protected contacts do not extend the timer');
        game.pause();
        const progress = game.enemyDamageProgress(enemy);
        game.update(3);
        assert.equal(game.enemyDamageProgress(enemy), progress);
        game.resume(); game.elapsed = deadline;
        assert.equal(game.enemyDamageProgress(enemy), null);
      }
      assert.equal(game.robots.length, 0);
      assert.equal(game.enemyDeaths.length, 1);
      assert.equal(game.enemies, initialPoints);
      game.reset();
      assert.equal(game.enemies, 0);
      assert.equal(game.enemyDeaths.length, 0);
    }
  }
});

test('shield hits consume wood, boosts respect protection without using swords, and weighted scores meet goals', () => {
  const game = arena();
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'bucket', shield: 'blue', x: .5, y: .5 })[0];
  game.robots = [enemy];
  game.weapon = { type: 'wood', uses: 1, expires: Infinity };
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.weapon, null);
  assert.equal(enemy.shield, 'green');
  game.weapon = { type: 'silver', uses: 5, expires: Infinity };
  game.boosted = true;
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(enemy.shield, 'green');
  for (let i = 0; i < 3; i++) {
    game.elapsed = enemy.invulnerableUntil;
    game.combat(0, game.cat.x, game.cat.y);
  }
  assert.equal(game.weapon.uses, 5);
  assert.equal(game.enemies, 4);
  const goalGame = new Game(() => .5, { customLevel: {
    version: 1, id: 'Shield goal', duration: 10, goal: 0, killGoal: 2, heartCost: null, brickSet: 1,
    events: [{ time: 0, kind: 'enemy', type: 'mouse', shield: 'red', x: .5, y: .5 }],
  } });
  goalGame.start();
  goalGame.weapon = { type: 'silver', uses: 5, expires: Infinity };
  goalGame.update(.01);
  assert.equal(goalGame.state, 'playing');
  const target = goalGame.robots[0];
  goalGame.elapsed = target.invulnerableUntil;
  target.x = goalGame.cat.x; target.y = goalGame.cat.y;
  goalGame.update(.001);
  assert.equal(goalGame.enemies, 2);
  assert.equal(goalGame.state, 'won');
});

test('every sword replaces the current weapon and resets attacks or gold time', () => {
  const game = arena();
  assert.deepEqual(Object.fromEntries(Object.entries(SWORDS).map(([type, sword]) => [type, sword.uses ?? sword.seconds])),
    { wood: 1, bronze: 3, silver: 5, gold: 15 });
  for (const current of Object.keys(SWORDS)) {
    for (const replacement of Object.keys(SWORDS)) {
      equip(game, current);
      if (current !== 'gold') game.weapon.uses = 1;
      else game.weapon.expires = game.elapsed + 2;
      const distant = { x: game.cat.x + 200, y: game.cat.y, type: 'gold' };
      game.weapons.push(distant);
      game.weapons.push({ x: game.cat.x, y: game.cat.y, type: replacement });
      game.combat(0, game.cat.x, game.cat.y);
      assert.equal(game.weapon.type, replacement);
      assert.equal(game.weapon.uses, SWORDS[replacement].uses);
      assert.equal(game.weapon.expires, replacement === 'gold' ? game.elapsed + 15 : Infinity);
      assert.deepEqual(game.weapons, [distant], 'uncollected swords persist');
      game.weapons = [];
    }
  }
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

test('sweeping through multiple swords equips the last encountered, even if weaker', () => {
  for (const direction of [-1, 1]) {
    const game = arena();
    const startX = game.cat.x, startY = game.cat.y;
    game.weapon = { type: 'gold', expires: 15 };
    game.weapons = [
      { x: startX + direction * 180, y: startY, type: 'wood' },
      { x: startX + direction * 80, y: startY, type: 'silver' },
    ];
    game.cat.x += direction * 250;
    game.combat(0, startX, startY);
    assert.equal(game.weapon.type, 'wood');
    assert.equal(game.weapon.uses, 1);
    assert.equal(game.weapon.expires, Infinity);
    assert.equal(game.weapons.length, 0);
  }
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

test('mouse patrols at 75 units per second, pauses to bare teeth, and wheels stay on the perimeter', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = arena(options);
    game.spawnEnemies([0, 'mouse', 1]);
    const enemy = game.robots[0];
    const bounds = game.bounds();
    enemy.x = (bounds.left + bounds.right) / 2;
    enemy.y = (bounds.top + bounds.bottom) / 2;
    enemy.age = 4.6;
    const { x, y } = enemy;
    game.combat(.1, game.cat.x, game.cat.y);
    assert.equal(enemy.resting, true);
    assert.equal(enemy.x, x); assert.equal(enemy.y, y);
    enemy.age = 6;
    game.combat(.1, game.cat.x, game.cat.y);
    assert.notEqual(enemy.x, x);
    assert.ok(Math.abs(Math.hypot(enemy.x - x, enemy.y - y) - 7.5) < 1e-9, 'mouse speed is 75 units/second');
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

test('resting and speaking mice open their mouths with two large teeth; wheels never inherit it', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ fillStyle: '', strokeStyle: '', globalAlpha: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => {
        assert.ok(args.every(value => typeof value !== 'number' || Number.isFinite(value)));
        operations.push([name, ...args, target.fillStyle]);
      };
    },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function line('), source.indexOf('function drawCat('))
    + source.slice(source.indexOf('function drawRobotBody('), source.indexOf('function drawRoboBucket(')), context);
  const draw = (type, attributes = {}, death = null) => {
    operations.length = 0;
    ctx.fillStyle = '';
    context.drawRobotBody({ type, x: 0, y: 0, age: 0, distance: 0, ...attributes }, death);
    return operations.slice();
  };
  for (const attributes of [{ resting: true }, { speaking: true }]) {
    const mouse = draw('mouse', attributes);
    assert.ok(mouse.some(op => op[0] === 'ellipse' && op[1] === 0 && op[2] === 11), 'open mouth');
    assert.deepEqual(mouse.filter(op => op[0] === 'fillRect' && op.at(-1) === '#f2eee0').map(op => op.slice(1, 5)),
      [[-5, 0, 4, 13], [1, 0, 4, 13]], 'teeth extend above the highest mouth opening with unchanged tips');
    const clip = mouse.findIndex(op => op[0] === 'clip');
    assert.ok(clip > mouse.findIndex(op => op[0] === 'ellipse'), 'clip to the animated mouth');
    assert.ok(clip < mouse.findIndex(op => op[0] === 'fillRect' && op.at(-1) === '#f2eee0'), 'hide tooth tops behind the mouth edge');
    assert.ok(!mouse.some(op => op.at(-1) === '#e6a1a1'), 'no pink licking tongue');
    assert.deepEqual(draw('wheel', attributes), draw('wheel'), 'wheel expression does not inherit mouse animation');
    assert.ok(!draw('mouse', attributes, .5).some(op => op.at(-1) === '#f2eee0'), 'no teeth animation while dying');
  }
  assert.ok(!draw('mouse').some(op => op.at(-1) === '#f2eee0'), 'moving silent mouse keeps its closed mouth');
  assert.notDeepEqual(draw('mouse', { speaking: true, age: 0 }), draw('mouse', { speaking: true, age: .1 }), 'mouth animates over time');
});

test('Robo Rams wander, lock onto Koshi, telegraph, and charge toward the saved position', () => {
  const game = arena();
  const ram = game.createCustomSpawn({ kind: 'enemy', type: 'ram', x: .5, y: .5 })[0];
  assert.equal(ram.state, 'wander');
  ram.x = game.width / 2; ram.y = game.height / 2;
  ram.wanderDuration = .1; ram.turnTime = 10;
  game.cat.x = game.bounds().right; game.cat.y = game.bounds().bottom;
  const previousFacingAngle = ram.facingAngle;
  game.updateRam(ram, .1, []);
  assert.equal(ram.state, 'targeting');
  assert.equal(ram.targetX, game.cat.x);
  assert.equal(ram.targetY, game.cat.y);
  const targetAngle = Math.atan2(ram.targetY - ram.y, ram.targetX - ram.x);
  assert.ok(Math.abs(ram.angle - targetAngle) < 1e-9);
  const wrappedDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  assert.ok(Math.abs(wrappedDifference(ram.facingAngle, previousFacingAngle)) <= .45 + 1e-9,
    'the head turns at a capped rate');
  game.cat.x = game.bounds().left;
  game.updateRam(ram, 1.05, []);
  assert.equal(ram.state, 'charging');
  assert.ok(Math.abs(ram.angle - targetAngle) < 1e-9, 'the charge keeps its original target');
  assert.ok(Math.abs(wrappedDifference(ram.facingAngle, ram.angle - Math.PI / 2)) < .1,
    'the top of the head lines up with the charge');
  assert.equal(ram.speed, 520);
  game.updateRam(ram, 1.5, []);
  assert.equal(ram.state, 'wander', 'charges end and return to wandering');
});

test('Robo Rams reflect from bricks and lose speed on each bounce', () => {
  const game = arena();
  const ram = { ...mouse(game, 326, 300), type: 'ram', state: 'charging', stateTime: 0, angle: 0, speed: 200 };
  game.bricks.push({ id: game.bricks.length, x: 350, y: 250, w: 20, h: 100 });
  game.cat.x = 800; game.cat.y = 500;
  game.robots.push(ram);
  game.combat(.1, game.cat.x, game.cat.y);
  assert.ok(Math.abs(ram.speed - 156) < 1e-9);
  assert.ok(Math.cos(ram.angle) < -.999);
  assert.ok(Math.abs(ram.x - 319.3) < .02);
});

test('all enemy types separate, including coincident spawns and wheels at corners', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    for (const typeA of ['mouse', 'wheel', 'ram', 'bucket']) {
      for (const typeB of ['mouse', 'wheel', 'ram', 'bucket']) {
        const game = arena(options);
        const a = game.createCustomSpawn({ kind: 'enemy', type: typeA, x: 0, y: 0 })[0];
        const b = game.createCustomSpawn({ kind: 'enemy', type: typeB, x: 0, y: 0 })[0];
        game.robots = [a, b];
        game.resolveEnemyCollisions(new Map(game.robots.map(enemy => [enemy, { x: enemy.x, y: enemy.y }])));
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius - 1e-6,
          `${typeA}/${typeB} separate at a corner`);
        const bounds = game.bounds();
        for (const enemy of game.robots) {
          assert.ok(enemy.x >= bounds.left - 1e-9 && enemy.x <= bounds.right + 1e-9);
          assert.ok(enemy.y >= bounds.top - 1e-9 && enemy.y <= bounds.bottom + 1e-9);
          if (enemy.type === 'wheel') {
            assert.ok(enemy.x === bounds.left || enemy.x === bounds.right || enemy.y === bounds.top || enemy.y === bounds.bottom);
            const position = { x: enemy.x, y: enemy.y };
            game.placeWheel(enemy);
            assert.deepEqual({ x: enemy.x, y: enemy.y }, position, 'wheel distance matches its boundary position');
          }
        }
      }
    }
  }
});

test('moving enemies turn away and fast Rams cannot pass through other enemies', () => {
  for (const type of ['mouse', 'ram', 'bucket']) {
    const game = arena();
    game.cat.x = 800; game.cat.y = 500;
    const moving = game.createCustomSpawn({ kind: 'enemy', type, x: .5, y: .5 })[0];
    Object.assign(moving, { x: 300, y: 300, phase: 0, age: 0 });
    if (type === 'bucket') moving.shotTimer = 100;
    if (type === 'ram') Object.assign(moving, { state: 'charging', stateTime: 0, angle: 0, speed: 520, facingAngle: -Math.PI / 2 });
    const resting = mouse(game, 339, 300);
    game.robots = [moving, resting];
    game.combat(1 / 120, game.cat.x, game.cat.y);
    // Slower wanderers reach contact over several fixed updates.
    for (let i = 0; i < 8; i++) game.combat(1 / 120, game.cat.x, game.cat.y);
    assert.ok(Math.hypot(moving.x - resting.x, moving.y - resting.y) >= 38 - 1e-6);
    assert.ok(Math.cos(type === 'ram' ? moving.angle : moving.phase) < 0, `${type} turns away`);
    assert.equal(resting.resting, true);
    if (type === 'ram') {
      assert.equal(moving.state, 'charging');
      assert.ok(Math.abs(moving.speed - 520 * .78) < 1e-9, 'one contact loses speed only once');
    }
  }
  const game = arena();
  game.cat.x = 800; game.cat.y = 500;
  const ram = game.createCustomSpawn({ kind: 'enemy', type: 'ram', x: .5, y: .5 })[0];
  Object.assign(ram, { x: 200, y: 300, state: 'charging', stateTime: 0, angle: 0, speed: 520 });
  const resting = mouse(game, 250, 300);
  game.robots = [ram, resting];
  game.combat(.2, game.cat.x, game.cat.y);
  assert.ok(ram.x <= resting.x - 38 + 1e-6, 'swept collision catches a Ram even if it would cross completely');
  assert.ok(Math.cos(ram.angle) < 0);
});

test('wheel collisions preserve the boundary route and targeting Rams keep their aim and timing', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = arena(options), bounds = game.bounds(), w = bounds.right - bounds.left;
    game.cat.x = game.width / 2; game.cat.y = game.height / 2;
    const wheels = [w - 20, w + 20].map(distance => {
      const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'wheel', x: 0, y: 0 })[0];
      enemy.distance = distance; game.placeWheel(enemy);
      return enemy;
    });
    const ram = game.createCustomSpawn({ kind: 'enemy', type: 'ram', x: .5, y: .5 })[0];
    Object.assign(ram, { x: bounds.right - 5, y: bounds.top + 20, state: 'targeting', stateTime: 0,
      angle: 2, targetX: game.cat.x, targetY: game.cat.y });
    game.robots = [...wheels, ram];
    for (let i = 0; i < 60; i++) {
      game.combat(1 / 120, game.cat.x, game.cat.y);
      for (const wheel of wheels) {
        assert.ok(wheel.x === bounds.left || wheel.x === bounds.right || wheel.y === bounds.top || wheel.y === bounds.bottom);
      }
      for (let a = 0; a < game.robots.length; a++) for (let b = a + 1; b < game.robots.length; b++) {
        assert.ok(Math.hypot(game.robots[a].x - game.robots[b].x, game.robots[a].y - game.robots[b].y) >= 38 - 1e-6);
      }
    }
    assert.equal(ram.state, 'targeting');
    assert.equal(ram.angle, 2);
    assert.ok(Math.abs(ram.stateTime - .5) < 1e-9);
    assert.equal(ram.targetX, game.cat.x); assert.equal(ram.targetY, game.cat.y);
    assert.ok(wheels[1].distance > w + 20, 'the front wheel continues its patrol');
  }
});

test('crowded enemy spawns settle without overlap and collisions freeze on pause', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    for (const [x, y] of [[0, 0], [.5, 0], [.5, .5], [1, 1]]) {
      const game = arena(options);
      game.cat.x = game.width / 2; game.cat.y = game.height * .8;
      game.robots = Array.from({ length: 40 }, (_, i) =>
        game.createCustomSpawn({ kind: 'enemy', type: ['mouse', 'wheel', 'ram', 'bucket'][i % 4], x, y })[0]);
      game.combat(1 / 120, game.cat.x, game.cat.y);
      for (let i = 0; i < game.robots.length; i++) for (let j = i + 1; j < game.robots.length; j++) {
        assert.ok(Math.hypot(game.robots[i].x - game.robots[j].x, game.robots[i].y - game.robots[j].y) >= 38 - 1e-6);
      }
      game.pause();
      const snapshot = structuredClone(game.robots);
      game.update(1);
      assert.deepEqual(game.robots, snapshot);
    }
  }
});

test('Robo Buckets fire on randomized intervals and bombs bounce while their fuse counts down', () => {
  const game = arena();
  const bucket = game.createCustomSpawn({ kind: 'enemy', type: 'bucket', x: .5, y: .5 })[0];
  bucket.x = 280; bucket.y = 300; bucket.phase = 0; bucket.shotTimer = .01;
  game.cat.x = 800; game.cat.y = 500;
  game.bricks.push({ id: game.bricks.length, x: 350, y: 250, w: 20, h: 100 });
  game.robots.push(bucket);
  game.combat(.02, game.cat.x, game.cat.y);
  assert.equal(bucket.bombs.length, 1);
  assert.equal(bucket.bombs[0].state, 'flying');
  assert.equal(bucket.bombs[0].radius, 8);
  const bomb = bucket.bombs[0];
  bomb.x = 326; bomb.y = 300; bomb.vx = 200; bomb.vy = 0;
  bomb.fuse = 2.5;
  bucket.shotTimer = 100;
  game.combat(.1, game.cat.x, game.cat.y);
  assert.ok(bomb.vx < 0, 'the bomb reflects from the brick');
  assert.ok(Math.abs(bomb.vx + 176) < 1e-8, 'a bounce loses some speed');
  assert.ok(Math.abs(bomb.fuse - 2.4) < 1e-8);
});

test('Robo Bucket bombs are harmless before detonation and flame circles damage on contact', () => {
  const game = arena();
  const bucket = { ...mouse(game, game.cat.x + 180, game.cat.y + 120), type: 'bucket', phase: 0, shotTimer: 100 };
  game.initializeBucket(bucket);
  const bomb = {
    x: game.cat.x, y: game.cat.y, vx: 0, vy: 0, radius: 6,
    fuse: 3, state: 'flying', blastAge: 0, blastRadius: 0, touching: false,
  };
  bucket.bombs = [bomb];
  game.robots.push(bucket);
  game.combat(2.99, game.cat.x, game.cat.y);
  assert.equal(game.hearts, 3);
  assert.equal(bomb.state, 'flying');
  game.combat(.02, game.cat.x, game.cat.y);
  assert.equal(game.hearts, 3, 'a newly detonated bomb starts with a harmless animation frame');
  game.combat(.01, game.cat.x, game.cat.y);
  assert.equal(game.hearts, 2);
  assert.equal(bomb.state, 'exploding');
  assert.ok(bomb.blastRadius > 0);
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(game.hearts, 2, 'one continuous flame contact does not repeatedly damage');
});

test('new pickups and enemies spawn clear of all bricks, and reset clears combat state', () => {
  for (const random of [() => 0, () => .99999, Math.random]) {
    for (const options of [{}, { portrait: true, scale: .31 }]) {
      const game = new Game(random, { level: 3, ...options });
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
      assert.equal(game.nextHeart, game.level.heartCost);
      assert.equal(game.level.id, '1-4');
    }
  }
});
