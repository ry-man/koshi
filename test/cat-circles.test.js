const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, OBJECTS, validateCustomLevel } = require('../src/game.js');

const level = events => ({
  version: 1, id: 'Cat Circle tests', duration: 60, goal: 1000,
  heartCost: null, brickSet: 1, events,
});

function arena(events = []) {
  const game = new Game(() => .5, { customLevel: level(events) });
  game.start();
  return game;
}

test('Cat Circles are persistent, placeable custom objects and brick spawns', () => {
  const placement = { time: 0, kind: 'object', type: 'cat-circle', x: .5, y: .5 };
  assert.equal(OBJECTS['cat-circle'].catCircle, true);
  assert.equal(validateCustomLevel(level([placement])).events[0].type, 'cat-circle');
  const game = arena([placement]);
  game.update(1 / 120);
  assert.equal(game.catCircles.length, 1);
  assert.equal(game.catCircles[0].radius, OBJECTS['cat-circle'].radius);

  game.bricks[0].spawner = { kind: 'object', type: 'cat-circle', x: .6, y: .6 };
  game.spawnFromBrick(game.bricks[0]);
  assert.equal(game.catCircles.length, 2);
});

test('Cat Circles pull Koshi to center, allow immediate steering, and remain permanently', () => {
  const game = arena();
  const circle = game.createCatCircle({ x: game.cat.x + 80, y: game.cat.y }, 'cat-circle');
  game.catCircles.push(circle);
  game.cat.vx = 180;
  game.cat.vy = 0;
  game.update(.6);

  assert.equal(circle.radius, 24, 'Cat Circles use bubble-sized geometry');
  assert.equal(game.catCircleTrap, null, 'the center transition ends without a timed hold');
  assert.equal(game.catCircleIgnore, circle, 'Koshi has reached the Cat Circle center');
  assert.equal(game.cat.x, circle.x);
  assert.equal(game.cat.y, circle.y);
  assert.equal(game.cat.vx, 0);
  assert.equal(game.cat.vy, 0);
  game.update(6);
  assert.ok(game.catCircles.includes(circle), 'using a Cat Circle never consumes it');

  const brick = game.bricks.filter(item => item.x < circle.x)
    .sort((a, b) => b.x - a.x)[0];
  const part = game.brickParts().find(item => item.id === brick.id);
  assert.equal(game.steer(brick.id, part.x + part.w / 2, part.y + part.h / 2), true);
  assert.equal(game.catCircleTrap, null);
  game.update(.6);
  assert.equal(game.catCircleIgnore, null, 'leaving the circle rearms its trigger');
  assert.ok(game.catCircles.includes(circle));
});

test('a bumper contact takes priority over a Cat Circle beyond it', () => {
  const game = arena();
  const y = game.cat.y;
  game.cat.x = 100;
  game.cat.vx = 180;
  game.cat.vy = 0;
  game.bumpers.push(game.createBumper({ x: 220, y }, 'bumper-green'));
  game.catCircles.push(game.createCatCircle({ x: 340, y }, 'cat-circle'));

  game.update(.4);
  assert.equal(game.catCircleTrap, null);
  assert.ok(game.cat.vx < 0, 'the bumper redirects Koshi before the circle can catch him');
});
