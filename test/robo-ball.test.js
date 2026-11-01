const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, LEVELS, validateCustomLevel, CHARACTERS } = require('../src/game.js');
const { spawnSymbol, spawnColor } = require('../src/brick-visuals.js');
const { Tutorial, LESSONS } = require('../src/learning.js');

function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: {
    version: 1, id: 'Ball tests', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [],
  } });
  game.start();
  return game;
}
function ball(game, x = .5, y = .5) {
  return game.createCustomSpawn({ kind: 'enemy', type: 'ball', x, y })[0];
}

test('Robo Ball supports custom placements, shields, spawners, previews and guide without campaign changes', () => {
  const game = arena();
  const custom = { ...game.customLevel,
    events: [{ time: 2, kind: 'enemy', type: 'ball', x: .3, y: .7, shield: 'green' }],
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'enemy', type: 'ball', shield: 'red' } }],
  };
  assert.deepEqual(validateCustomLevel(custom), custom);
  const preview = new Game(() => .5, { customLevel: custom }); preview.start(); preview.update(1.1);
  const reserved = [...preview.pendingSpawns.values()].find(p => p.kind === 'enemy').items[0];
  assert.equal(reserved.type, 'ball'); assert.equal(reserved.defeatPoints, 3);
  preview.update(.9); assert.equal(preview.robots[0], reserved);
  preview.spawnFromBrick(preview.bricks.find(b => b.spawner));
  assert.equal(preview.robots[1].type, 'ball'); assert.equal(preview.robots[1].defeatPoints, 2);
  assert.equal(CHARACTERS.ball, 'Robo Ball');
  assert.ok(spawnSymbol({ kind: 'enemy', type: 'ball' }));
  assert.equal(spawnColor({ kind: 'enemy', type: 'ball' }), '#ed852e');
  assert.ok(LEVELS.every(level => level.enemies.every(([, type]) => type !== 'ball')));
  const tutorial = new Tutorial(); tutorial.select(LESSONS.findIndex(lesson => lesson.id === 'ball'));
  assert.ok(tutorial.game.robots.some(enemy => enemy.type === 'ball'));
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  test(`Ball moves straight at constant speed and rebounds within bricks ${JSON.stringify(options)}`, () => {
    const game = arena(options), enemy = ball(game); enemy.phase = 0;
    const x = enemy.x; game.moveBall(enemy, .25, game.brickParts());
    assert.ok(Math.abs(enemy.x - x - 30) < 1e-6); assert.equal(enemy.y, game.height / 2);
    const bounds = game.bounds();
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4]) {
      enemy.phase = angle;
      for (let i = 0; i < 300; i++) {
        game.moveBall(enemy, 1 / 120, game.brickParts());
        assert.ok(enemy.x >= bounds.left && enemy.x <= bounds.right);
        assert.ok(enemy.y >= bounds.top && enemy.y <= bounds.bottom);
      }
    }
    enemy.x = bounds.right - 1; enemy.phase = 0;
    game.moveBall(enemy, .1, game.brickParts());
    assert.ok(Math.cos(enemy.phase) < 0, 'right wall reverses the ball');
  });
}

test('Ball ricochets off enemies rather than overlapping or pausing', () => {
  for (const type of ['mouse', 'wheel', 'ram', 'bucket', 'ball', 'jackolantern']) {
    const game = arena(), a = ball(game), b = game.createCustomSpawn({ kind: 'enemy', type, x: 1, y: .5 })[0];
    a.x = b.x - 40; a.y = b.y; a.phase = 0; b.age = 4.6; b.phase = Math.PI;
    if (type === 'ram') { b.state = 'targeting'; b.stateTime = 0; }
    if (type === 'bucket') b.shotTimer = 10;
    game.robots = [a, b]; game.cat.x = game.width / 2; game.cat.y = game.height * .8;
    for (let i = 0; i < 15; i++) game.combat(1 / 120, game.cat.x, game.cat.y);
    assert.ok(Math.cos(a.phase) < 0, `Ball did not bounce off ${type}`);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius - 1e-5);
  }
});

test('Ball bounces from barriers, sleeps, flees harmlessly and pauses', () => {
  const game = arena(), enemy = ball(game), bounds = game.bounds();
  enemy.x = bounds.left + 60; enemy.phase = 0;
  const fence = { x: enemy.x + 25, y: bounds.top, w: 4, h: bounds.bottom - bounds.top };
  game.moveBall(enemy, .2, [fence]);
  assert.ok(Math.cos(enemy.phase) < 0);
  game.robots = [enemy]; game.cat.x = bounds.right; game.cat.y = bounds.bottom;
  game.collectItem({ type: 'music-box' });
  const x = enemy.x, y = enemy.y; game.update(.2);
  assert.equal(enemy.x, x); assert.equal(enemy.y, y);
  game.enemiesSleepUntil = 0; game.collectItem({ type: 'spooky-mask' });
  const distance = Math.hypot(enemy.x - game.cat.x, enemy.y - game.cat.y);
  game.update(.1);
  assert.ok(Math.abs(Math.hypot(enemy.x - game.cat.x, enemy.y - game.cat.y) - distance - 3.2) < .01);
  assert.equal(enemy.afraid, true); assert.equal(enemy.fleeMoving, true);
  game.pause(); const position = [enemy.x, enemy.y]; game.update(1);
  assert.deepEqual([enemy.x, enemy.y], position);
});

test('Ball uses normal contact damage, shield points and 1.1-second paused death animation', () => {
  const game = arena(), enemy = ball(game);
  game.robots = [enemy]; enemy.phase = 0;
  game.combat(0, game.cat.x, game.cat.y); assert.equal(game.hearts, 2);
  game.weapon = { type: 'silver', uses: 5, expires: Infinity };
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.enemies, 1); assert.equal(game.robots.length, 0);
  assert.equal(game.enemyDeaths[0].type, 'ball');
  game.pause(); game.update(.5); assert.equal(game.enemyDeaths[0].deathProgress, 0);
  game.resume(); game.update(.55); assert.ok(Math.abs(game.enemyDeaths[0].deathProgress - .5) < 1e-6);
  game.update(.56); assert.equal(game.enemyDeaths.length, 0);
  game.reset(); assert.equal(game.enemyDeaths.length, 0);
});

test('Ball rendering has orange seams, beady eyes, tooth grate, shrivel, popping eyes and fade', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient') return () => ({ addColorStop: (...args) => operations.push(['stop', ...args]) });
      return (...args) => operations.push([key, ...args]);
    },
    set(target, key, value) { operations.push([key, value]); target[key] = value; return true; },
  });
  const context = vm.createContext({ ctx, drawScaredFace: () => operations.push(['scared']),
    drawRobot: (enemy, progress) => context.drawRoboBall(enemy, progress) });
  vm.runInContext(source.slice(source.indexOf('function drawRoboBall('), source.indexOf('function drawEnemyDeath(')), context);
  context.drawRoboBall({});
  assert.ok(operations.some(op => op[0] === 'stop' && op[2] === '#ed852e'));
  assert.ok(operations.some(op => op[0] === 'strokeStyle' && op[1] === '#383d40'));
  assert.ok(operations.some(op => op[0] === 'strokeRect' && op[3] === 18));
  operations.length = 0; context.drawRoboBall({ afraid: true });
  assert.ok(operations.some(op => op[0] === 'scared'));
  operations.length = 0; context.drawRoboBall({}, .5);
  assert.ok(operations.some(op => op[0] === 'scale' && op[2] < .3));
  const eyes = operations.filter(op => op[0] === 'arc' && op[3] === 3);
  assert.equal(eyes.length, 2); assert.ok(eyes.every(op => op[2] < -30));
  const deathStart = source.indexOf('function drawEnemyDeath(');
  const branchEnd = source.indexOf("} else if (enemy.type === 'mouse')", deathStart);
  vm.runInContext(source.slice(deathStart, branchEnd) + '} ctx.restore(); }', context);
  context.drawEnemyDeath({ type: 'ball', deathProgress: .9 });
  assert.ok(operations.some(op => op[0] === 'globalAlpha' && op[1] < .3));
});
