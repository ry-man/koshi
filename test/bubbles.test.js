const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, OBJECTS, SLIMES, validateCustomLevel } = require('../src/game.js');

const level = events => ({
  version: 1, id: 'Bubble tests', duration: 60, goal: 1000,
  heartCost: null, brickSet: 1, events,
});

function arena(events = []) {
  const game = new Game(() => .5, { customLevel: level(events) });
  game.start();
  return game;
}

test('colored bubbles are valid custom objects with slime-matched durations', () => {
  for (const [type, color] of [['bubble-blue', 'blue'], ['bubble-green', 'green'], ['bubble-red', 'red']]) {
    assert.equal(OBJECTS[type].bubbleColor, color);
    const placement = { time: 0, kind: 'object', type, x: .5, y: .5 };
    assert.equal(validateCustomLevel(level([placement])).events[0].type, type);
    const game = arena([placement]);
    assert.equal(game.bubbles[0].color, color);
    assert.equal(game.bubbles[0].radius > game.cat.radius, true);
  }
  const game = arena();
  game.bricks[0].spawner = { kind: 'object', type: 'bubble-green' };
  game.spawnFromBrick(game.bricks[0]);
  assert.equal(game.bubbles[0].color, 'green', 'spawn bricks can release bubbles');
});

test('Koshi glides into a bubble center, stays there for the matching duration, then is released', () => {
  const game = arena([{ time: 0, kind: 'object', type: 'bubble-red', x: .55, y: .5 }]);
  const startX = game.cat.x;
  game.update(1 / 120);
  assert.ok(game.bubbleTrap);
  assert.equal(game.bubbleTrap.duration, SLIMES.red.duration);
  assert.equal(game.bubbles.length, 0, 'a used bubble is consumed');
  assert.equal(game.cat.x, startX, 'the capture starts at the contact point');
  assert.equal(game.steer(0, game.bricks[0].x + game.bricks[0].w / 2, game.bricks[0].y + game.bricks[0].h / 2), false);
  game.update(.08);
  assert.ok(game.cat.x > startX && game.cat.x < game.bubbleTrap.x, 'capture smoothly approaches the bubble center');
  game.update(1.2);
  assert.equal(game.bubbleTrap, null);
});

test('bubble confinement does not disable sword damage or enemy contact damage', () => {
  const game = arena();
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'mouse', x: .5, y: .5 })[0];
  game.robots.push(enemy);
  game.bubbleTrap = { color: 'green', fromX: game.cat.x, fromY: game.cat.y,
    x: game.cat.x, y: game.cat.y, age: 0, transition: .18, duration: SLIMES.green.duration };
  game.weapon = { type: 'gold', uses: Infinity, expires: Infinity };
  game.combat(.01, game.cat.x, game.cat.y);
  assert.equal(game.robots.length, 0, 'Koshi can defeat an enemy while held');

  const victim = arena();
  victim.robots.push(victim.createCustomSpawn({ kind: 'enemy', type: 'mouse', x: .5, y: .5 })[0]);
  victim.bubbleTrap = { color: 'red', fromX: victim.cat.x, fromY: victim.cat.y,
    x: victim.cat.x, y: victim.cat.y, age: 0, transition: .18, duration: SLIMES.red.duration };
  victim.combat(.01, victim.cat.x, victim.cat.y);
  assert.equal(victim.hearts, 2, 'enemies can still hurt Koshi inside a bubble');
});
