const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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

test('each bubble pops once at release, freezes on pause, and clears on restart', () => {
  for (const color of ['blue', 'green', 'red']) {
    const game = arena([{ time: 0, kind: 'object', type: `bubble-${color}`, x: .5, y: .5 }]);
    game.update(1 / 120);
    const trap = game.bubbleTrap;
    const lifetime = trap.transition + trap.duration;
    game.update(lifetime - .001);
    assert.ok(game.bubbleTrap, 'bubble remains until the countdown ends');
    assert.equal(game.bubblePops.length, 0);
    game.pause();
    const age = trap.age;
    game.update(2);
    assert.equal(trap.age, age);
    game.resume();
    game.update(.001);
    assert.equal(game.bubbleTrap, null);
    assert.equal(game.bubblePops.length, 1);
    assert.deepEqual(game.bubblePops[0], { x: trap.x, y: trap.y, color, age: 0 });
    game.update(.2);
    assert.equal(game.bubblePops.length, 1);
    game.pause();
    const popAge = game.bubblePops[0].age;
    game.update(2);
    assert.equal(game.bubblePops[0].age, popAge);
    game.resume();
    game.state = 'won';
    game.update(.35);
    assert.equal(game.bubblePops.length, 0, 'pop finishes even if the level ends');
    game.bubblePops.push({ x: trap.x, y: trap.y, color, age: 0 });
    game.reset();
    assert.equal(game.bubblePops.length, 0);
    assert.equal(game.bubbleTrap, null);
  }
});

function bubbleRenderer() {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const calls = [];
  const ctx = { globalAlpha: 1 };
  for (const method of ['save', 'restore', 'translate', 'rotate', 'beginPath', 'arc', 'ellipse', 'fill', 'stroke']) {
    ctx[method] = (...args) => calls.push({ method, args, alpha: ctx.globalAlpha, lineWidth: ctx.lineWidth });
  }
  const context = vm.createContext({ ctx, SLIMES });
  vm.runInContext(source.slice(source.indexOf('function drawBubble('), source.indexOf('function drawObjectLifetime(')), context);
  return { ...context, calls };
}

test('countdown keeps a fixed radius while its arc shrinks continuously from full to zero', () => {
  const { drawBubble, calls } = bubbleRenderer();
  for (const color of ['blue', 'green', 'red']) {
    const lifetime = .18 + SLIMES[color].duration;
    for (const progress of [0, .1, .25, .5, .9, 1]) {
      calls.length = 0;
      drawBubble({ x: 100, y: 100, radius: 24, color, transition: .18,
        duration: SLIMES[color].duration, age: progress * lifetime }, true);
      const ring = calls.find(call => call.method === 'arc' && call.args[2] === 29);
      if (progress === 1) assert.equal(ring, undefined);
      else {
        assert.ok(ring);
        assert.equal(ring.args[3], -Math.PI / 2);
        assert.ok(Math.abs(ring.args[4] - ring.args[3] - Math.PI * 2 * (1 - progress)) < 1e-9);
        assert.equal(calls.at(-2).lineWidth, 1.5);
      }
    }
    calls.length = 0;
    drawBubble({ x: 100, y: 100, radius: 24, color });
    assert.equal(calls.some(call => call.method === 'arc' && call.args[2] === 29), false, 'unused bubbles have no countdown');
  }
});

test('water pop expands broken ripples and droplets, fades, then stops drawing', () => {
  const { drawBubblePop, calls } = bubbleRenderer();
  for (const progress of [0, .5, 1]) {
    calls.length = 0;
    drawBubblePop({ x: 100, y: 100, color: 'blue', age: progress * .55 });
    const ripples = calls.filter(call => call.method === 'arc');
    const droplets = calls.filter(call => call.method === 'ellipse');
    assert.equal(ripples.length, progress === 1 ? 0 : 8);
    assert.equal(droplets.length, progress === 1 ? 0 : 8);
    for (const ripple of ripples) {
      assert.equal(ripple.args[2], 24 + progress * 22);
      assert.equal(ripple.alpha, 1 - progress);
    }
  }
});
