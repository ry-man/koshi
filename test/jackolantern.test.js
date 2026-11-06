const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, LEVELS, CHARACTERS, OBJECTS, obstructionGeometry, validateCustomLevel } = require('../src/game.js');
const { spawnSymbol, spawnColor } = require('../src/brick-visuals.js');
const { Tutorial, LESSONS } = require('../src/learning.js');

function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: {
    version: 1, id: 'Pumpkin tests', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [],
  } });
  game.start();
  return game;
}
function pumpkin(game) {
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'jackolantern', x: .5, y: .5 })[0];
  game.cat.x = game.bounds().left; game.cat.y = game.bounds().top;
  return enemy;
}
function wave(enemy, radius = 0) {
  const result = { x: enemy.x, y: enemy.y, radius, blocked: [[], [], [], []] };
  enemy.waves.push(result); return result;
}
function advance(game, enemy, dt, parts = []) {
  game.updateJackolantern(enemy, dt, parts, game.cat.x, game.cat.y);
}

test('Jackolantern placements, shields, spawners, previews and guide leave campaign unchanged', () => {
  const game = arena();
  const custom = { ...game.customLevel,
    events: [{ time: 2, kind: 'enemy', type: 'jackolantern', x: .3, y: .7, shield: 'blue' }],
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'enemy', type: 'jackolantern', shield: 'red' } }],
  };
  assert.deepEqual(validateCustomLevel(custom), custom);
  const preview = new Game(() => .5, { customLevel: custom }); preview.start(); preview.update(1.1);
  const reserved = [...preview.pendingSpawns.values()].find(p => p.kind === 'enemy').items[0];
  assert.equal(reserved.stompTimer, 4); assert.deepEqual(reserved.waves, []);
  assert.equal(reserved.defeatPoints, 4);
  preview.update(.9); assert.equal(preview.robots[0], reserved);
  preview.spawnFromBrick(preview.bricks.find(b => b.spawner));
  assert.equal(preview.robots[1].type, 'jackolantern');
  assert.equal(preview.robots[1].defeatPoints, 2);
  assert.equal(CHARACTERS.jackolantern, 'Robo Jackolantern');
  assert.ok(spawnSymbol({ kind: 'enemy', type: 'jackolantern' }));
  assert.equal(spawnColor({ kind: 'enemy', type: 'jackolantern' }), '#ed852e');
  assert.ok(LEVELS.slice(0, 19).every(level => level.enemies.every(([, type]) => type !== 'jackolantern')));
  const tutorial = new Tutorial(); tutorial.select(LESSONS.findIndex(l => l.id === 'jackolantern'));
  assert.ok(tutorial.game.robots.some(enemy => enemy.type === 'jackolantern'));
});

test('wanders slowly, stops for the half-second warning, then stomps every four seconds at its settled center', () => {
  const game = arena(), enemy = pumpkin(game);
  game.robots = [enemy];
  const startX = enemy.x, startY = enemy.y;
  game.combat(.1, game.cat.x, game.cat.y);
  assert.ok(Math.abs(Math.hypot(enemy.x - startX, enemy.y - startY) - 3.2) < 1e-6);
  enemy.stompTimer = .5;
  const position = [enemy.x, enemy.y];
  game.combat(.49, game.cat.x, game.cat.y);
  assert.deepEqual([enemy.x, enemy.y], position); assert.equal(enemy.waves.length, 0);
  game.combat(.01, game.cat.x, game.cat.y);
  assert.equal(enemy.waves.length, 1); assert.equal(enemy.stompAge, 0);
  assert.ok(Math.abs(enemy.stompTimer - 4) < 1e-6);
  assert.deepEqual([enemy.waves[0].x, enemy.waves[0].y], position);
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(enemy.waves[0].radius, 12);
  assert.deepEqual([enemy.waves[0].x, enemy.waves[0].y], position, 'wave stays at the stomp location');
});

test('square waves expand continuously and damage on the ring, not inside the square', () => {
  const game = arena(), enemy = pumpkin(game); enemy.stompTimer = .5;
  const fire = wave(enemy);
  advance(game, enemy, .5);
  assert.equal(fire.radius, 60);
  const segments = game.fireWaveSegments(fire);
  assert.equal(segments.length, 4);
  for (const { from, to } of segments) {
    assert.equal(Math.max(Math.abs(from[0] - fire.x), Math.abs(from[1] - fire.y)), 60);
    assert.equal(Math.hypot(to[0] - from[0], to[1] - from[1]), 120);
  }
  game.cat.x = fire.x; game.cat.y = fire.y;
  advance(game, enemy, .1); assert.equal(game.hearts, 3);
  game.cat.x = fire.x + 100;
  advance(game, enemy, .1); assert.equal(game.hearts, 2);
  advance(game, enemy, .01); assert.equal(game.hearts, 2, 'normal invulnerability applies');
});

for (const side of [0, 1, 2, 3]) {
  test(`brick and barrier intercept only their portion on square side ${side}`, () => {
    for (const barrier of [false, true]) {
      const game = arena(), enemy = pumpkin(game); enemy.stompTimer = .5;
      const fire = wave(enemy);
      const [nx, ny] = [[1, 0], [0, 1], [-1, 0], [0, -1]][side];
      const obstacle = nx
        ? { x: enemy.x + nx * 50 - 2, y: enemy.y - 20, w: 4, h: 40, barrier }
        : { x: enemy.x - 20, y: enemy.y + ny * 50 - 2, w: 40, h: 4, barrier };
      game.cat.x = enemy.x + nx * 95; game.cat.y = enemy.y + ny * 95;
      advance(game, enemy, .8, [obstacle]);
      assert.equal(game.hearts, 3, 'blocked fire cannot damage behind the obstacle');
      assert.ok(fire.blocked[side].some(([left, right]) => left < 0 && right > 0));
      assert.equal(game.fireWaveSegments(fire).length, 5, 'blocked side splits; other sides survive');
      const blocked = JSON.stringify(fire.blocked);
      advance(game, enemy, .1);
      assert.equal(JSON.stringify(fire.blocked), blocked, 'removing obstacle does not revive extinguished fire');
    }
  });
}

test('only fire reaching an obstacle is blocked; a barrier behind a passed wave cannot stop it', () => {
  const game = arena(), enemy = pumpkin(game);
  const fire = wave(enemy, 100);
  advance(game, enemy, .1, [{ x: enemy.x + 30, y: enemy.y - 30, w: 4, h: 60 }]);
  assert.deepEqual(fire.blocked, [[], [], [], []]);
  advance(game, enemy, .1, [{ x: enemy.x + 300, y: enemy.y - 30, w: 4, h: 60 }]);
  assert.deepEqual(fire.blocked, [[], [], [], []]);
});

test('all obstruction shapes block Jackolantern fire in all four directions', () => {
  for (const [type, definition] of Object.entries(OBJECTS).filter(([, object]) => object.obstruction)) {
    for (const [side, [nx, ny]] of [[1, 0], [0, 1], [-1, 0], [0, -1]].entries()) {
      const game = arena(), enemy = pumpkin(game);
      enemy.stompTimer = .5;
      const fire = wave(enemy);
      game.obstructions = [{
        type, x: enemy.x + nx * 70, y: enemy.y + ny * 70,
        ...obstructionGeometry({ type, width: 30, ...(definition.obstruction === 'rectangle' ? { height: 24 } : {}) }),
      }];
      game.cat.x = enemy.x + nx * 120;
      game.cat.y = enemy.y + ny * 120;
      advance(game, enemy, 1);
      assert.equal(game.hearts, 3, `${type} shields Koshi on side ${side}`);
      assert.ok(fire.blocked[side].some(([left, right]) => left < 0 && right > 0));
      assert.ok(game.fireWaveSegments(fire).length > 4, 'fire outside the obstruction shadow survives');
      const blocked = JSON.stringify(fire.blocked);
      game.obstructions = [];
      advance(game, enemy, .1);
      assert.equal(JSON.stringify(fire.blocked), blocked, 'destroyed obstructions do not revive extinguished fire');
    }
  }
});

test('appearing obstructions block only fire reaching them, not fire already past them', () => {
  const game = arena(), enemy = pumpkin(game), fire = wave(enemy, 100);
  const obstruction = { type: 'obstruction-circle', x: enemy.x + 30, y: enemy.y,
    ...obstructionGeometry({ type: 'obstruction-circle', width: 20 }) };
  game.obstructions = [obstruction];
  advance(game, enemy, .1);
  assert.deepEqual(fire.blocked, [[], [], [], []]);
  obstruction.x = enemy.x + 130;
  advance(game, enemy, .2);
  assert.ok(fire.blocked[0].length);
});

test('finite barriers leave a gap for unblocked fire and fully enclosing bricks extinguish waves', () => {
  const game = arena(), enemy = pumpkin(game), fire = wave(enemy);
  advance(game, enemy, 1, [{ x: enemy.x + 40, y: enemy.y + 10, w: 4, h: 10, barrier: true }]);
  assert.ok(fire.blocked[0][0][0] > 0, 'center remains open around a short fence');
  const enclosed = wave(enemy);
  const x = enemy.x, y = enemy.y;
  advance(game, enemy, 2, [
    { x: x - 100, y: y - 100, w: 200, h: 4 }, { x: x - 100, y: y + 96, w: 200, h: 4 },
    { x: x - 100, y: y - 100, w: 4, h: 200 }, { x: x + 96, y: y - 100, w: 4, h: 200 },
  ]);
  assert.ok(!enemy.waves.includes(enclosed));
});

test('fire damage detects a fast crossing by Koshi, but does not harm other enemies', () => {
  const game = arena(), enemy = pumpkin(game);
  wave(enemy, 80);
  game.cat.x = enemy.x + 120; game.cat.y = enemy.y;
  game.updateJackolantern(enemy, .01, [], enemy.x + 40, enemy.y);
  assert.equal(game.hearts, 2, 'swept crossing of ring costs a heart');
  const mouse = game.createCustomSpawn({ kind: 'enemy', type: 'mouse', x: .5, y: .5 })[0];
  mouse.x = enemy.x + 85; game.robots = [enemy, mouse];
  advance(game, enemy, .05);
  assert.equal(game.robots.length, 2);
});

test('fear suppresses stomps and fire damage; sleep and pause freeze attacks, waves and death', () => {
  const game = arena(), enemy = pumpkin(game); game.robots = [enemy];
  const fire = wave(enemy, 50);
  game.collectItem({ type: 'music-box' });
  game.update(.1); assert.equal(fire.radius, 50); assert.equal(enemy.stompTimer, 4);
  game.enemiesSleepUntil = 0; game.collectItem({ type: 'spooky-mask' });
  game.cat.x = enemy.x + 80; game.cat.y = enemy.y;
  game.update(.1); assert.equal(game.hearts, 3); assert.equal(enemy.stompTimer, 4);
  assert.ok(Math.abs(fire.radius - 62) < 1e-6); assert.equal(enemy.afraid, true);
  game.pause(); const radius = fire.radius; game.update(1); assert.equal(fire.radius, radius);
  game.resume(); game.maskUntil = 0;
  game.cat.x = enemy.x; game.cat.y = enemy.y;
  game.weapon = { type: 'silver', uses: 5, expires: Infinity };
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.robots.length, 0); assert.equal(game.enemyDeaths[0].type, 'jackolantern');
  game.pause(); game.update(.6); assert.equal(game.enemyDeaths[0].deathProgress, 0);
  game.resume(); game.update(.6); assert.ok(Math.abs(game.enemyDeaths[0].deathProgress - .5) < 1e-6);
  game.update(.61); assert.equal(game.enemyDeaths.length, 0);
});

test('Jackolantern artwork dims nose and mouth, snaps the antenna, bursts into pieces and draws square flames', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient') return () => ({ addColorStop: (...args) => operations.push(['stop', ...args]) });
      return (...args) => operations.push([key, ...args]);
    },
    set(target, key, value) { target[key] = value; operations.push([key, value]); return true; },
  });
  const context = vm.createContext({ ctx, drawScaredFace: () => operations.push(['scared']) });
  vm.runInContext(source.slice(source.indexOf('function drawFireWave('), source.indexOf('function drawRoboBall(')), context);
  context.drawRoboJackolantern({ stompTimer: 4, stompAge: null });
  assert.ok(operations.some(op => op[0] === 'fillStyle' && op[1] === '#ffdf60'));
  assert.ok(operations.some(op => op[0] === 'fillStyle' && op[1] === '#adb7bc'));
  operations.length = 0; context.drawRoboJackolantern({}, .2);
  assert.ok(operations.some(op => op[0] === 'fillStyle' && op[1] === '#626970'));
  assert.ok(operations.some(op => op[0] === 'rotate' && op[1] > 0));
  operations.length = 0; context.drawRoboJackolantern({}, .5);
  assert.equal(operations.filter(op => op[0] === 'rotate').length, 9);
  operations.length = 0; context.drawRoboJackolantern({ afraid: true });
  assert.ok(operations.some(op => op[0] === 'scared'));
  operations.length = 0;
  context.drawFireWave([{ from: [0, 0], to: [100, 0] }], 50);
  assert.equal(operations.filter(op => op[0] === 'stroke').length, 3);
  assert.ok(operations.filter(op => op[0] === 'fill').length > 0);
});
