const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, OBJECTS, validateCustomLevel } = require('../src/game.js');
const { drawBumper, spawnColor, spawnSymbol } = require('../src/brick-visuals.js');

const blank = () => ({
  version: 1, id: 'Bumper test', duration: 60, goal: 1000,
  heartCost: null, brickSet: 1, events: [],
});

function arena(level = blank()) {
  const game = new Game(() => .5, { customLevel: level });
  game.start();
  return game;
}

test('bumpers are custom objects with scheduled and brick-spawned placements', () => {
  const level = {
    ...blank(),
    events: ['red', 'green', 'blue'].map((color, index) => ({
      time: 0, kind: 'object', type: `bumper-${color}`, x: .2 + index * .3, y: .5,
    })),
    brickTypes: [{
      edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'object', type: 'bumper-blue' },
    }],
  };
  assert.deepEqual(validateCustomLevel(level), level);
  const game = arena(level);
  game.update(.01);
  assert.deepEqual(game.bumpers.map(bumper => bumper.type), ['bumper-red', 'bumper-green', 'bumper-blue']);
  assert.ok(game.bumpers.every(bumper => bumper.radius === 48), 'bumpers have a 96-unit diameter');
  assert.equal(game.soccerBalls.length, 0);
  const blue = game.bumpers[2];
  const position = { x: blue.x, y: blue.y };
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  assert.equal(game.bumpers.length, 4);
  assert.equal(game.bumpers[3].radius, 48, 'brick spawners use the doubled size');
  assert.deepEqual({ x: blue.x, y: blue.y }, position, 'placed bumpers stay in place');
  assert.ok(['bumper-red', 'bumper-green', 'bumper-blue'].every(type => OBJECTS[type]?.bumper));
  assert.ok(spawnSymbol({ kind: 'object', type: 'bumper-red' }));
  assert.equal(spawnColor({ kind: 'object', type: 'bumper-green' }), OBJECTS['bumper-green'].color);
});

test('Koshi bounces from each bumper color with its specified speed response', () => {
  for (const [type, speed] of [['bumper-red', 125], ['bumper-green', 100], ['bumper-blue', 75]]) {
    const game = arena();
    const bumper = game.createBumper({ x: 350, y: 300 }, type);
    game.bumpers.push(bumper);
    game.cat.x = bumper.x - bumper.radius - game.cat.radius - 5;
    game.cat.y = 300; game.cat.vx = 100; game.cat.vy = 0;
    game.tick(.1);
    assert.ok(game.cat.x < bumper.x, `${type} places Koshi on the incoming side`);
    assert.equal(game.cat.vx, -speed);
    assert.equal(game.cat.vy, 0);
    assert.equal(game.target, null);
    assert.equal(bumper.hitAt, game.elapsed);
    assert.deepEqual(bumper.hitNormal, { x: -1, y: 0 });
  }
});

test('enemies bounce off bumpers and bumpers do not move', () => {
  const game = arena();
  const bumper = game.createBumper({ x: 350, y: 300 }, 'bumper-green');
  game.bumpers.push(bumper);
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'mouse', x: .2, y: .2 })[0];
  enemy.x = bumper.x - bumper.radius - enemy.radius - 5;
  enemy.y = 300; enemy.phase = 0; enemy.age = 0;
  game.robots.push(enemy);
  game.combat(.1, game.cat.x, game.cat.y);
  assert.ok(enemy.x < 310);
  assert.ok(Math.cos(enemy.phase) < 0);
  assert.deepEqual({ x: bumper.x, y: bumper.y }, { x: 350, y: 300 });
});

test('bumper artwork uses its color, concentric rings, and animated compression', () => {
  const calls = [];
  const context = new Proxy({
    createRadialGradient: () => ({ addColorStop() {} }),
  }, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => calls.push([name, ...args]);
    },
    set(target, name, value) { target[name] = value; return true; },
  });
  const bumper = { x: 40, y: 50, type: 'bumper-red', radius: 24, hitAt: 5, hitNormal: { x: 1, y: 0 } };
  drawBumper(context, bumper, 5.02);
  assert.equal(calls.filter(([name]) => name === 'arc').length, 4, 'outer casing plus three white rings');
  assert.ok(calls.some(([name, x, y]) => name === 'translate' && x !== bumper.x && y === bumper.y),
    'impact produces a small directional shake');
  assert.ok(calls.some(([name, x, y]) => name === 'scale' && (x !== 1 || y !== 1)),
    'impact compresses the bumper');
});
