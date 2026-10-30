const test = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('../src/game.js');

const custom = events => ({
  version: 1, id: 'Spawn preview', duration: 30, goal: 1000, heartCost: null, brickSet: 1, events,
});
const placements = time => [
  { time, kind: 'food', type: 'S', x: .2, y: .3, lifetime: 5 },
  { time, kind: 'weapon', type: 'silver', x: .7, y: .4 },
  { time, kind: 'enemy', type: 'mouse', x: .8, y: .7 },
  { time, kind: 'enemy', type: 'wheel', x: 1, y: .25 },
];
const point = ({ x, y }) => ({ x, y });

test('custom previews begin exactly one second before spawning and reserve exact positions in both layouts', () => {
  for (const options of [{}, { portrait: true, scale: .4 }]) {
    const game = new Game(() => .3, { ...options, customLevel: custom(placements(2)) });
    assert.deepEqual(game.spawnCues, []);
    game.start();
    game.update(.99);
    assert.deepEqual(game.spawnCues, []);
    game.update(.01);
    assert.equal(game.spawnCues.length, 4);
    for (const cue of game.spawnCues) assert.ok(Math.abs(cue.progress) < 1e-8);
    game.update(.5);
    const cues = game.spawnCues;
    for (const cue of cues) assert.ok(Math.abs(cue.progress - .5) < 1e-8);
    assert.deepEqual(cues.map(point), placements(2).map(event => game.pointFromRelative(event.x, event.y)));
    assert.equal(game.robots.length + game.food.length + game.weapons.length, 0);
    assert.equal(game.score, 0);
    assert.equal(game.hearts, 3);
    assert.equal(game.weapon, null);
    // Isolate appearance positions from the movement/combat that follows spawning.
    game.combat = () => {};
    game.update(.5);
    assert.deepEqual(game.spawnCues, []);
    assert.deepEqual([...game.food, ...game.weapons, ...game.robots].map(point), cues.map(point));
    assert.equal(game.food[0].born, 2);
    assert.equal(game.food[0].expires, 7);
    assert.equal(game.pendingSpawns.size, 0);
  }
});

test('every random food pattern, enemy in a wave, and sword uses its reserved preview location once', () => {
  for (const options of [{}, { portrait: true, scale: .5 }]) {
    let calls = 0;
    const game = new Game(() => (++calls * .137) % 1, options);
    game.level = {
      duration: 30, goal: 1000, heartCost: Infinity,
      food: ['S', 'L3', 'C4', 'R5'].map(method => [3, method, 'P', 5]),
      enemies: [[3, 'mouse', 3], [3, 'wheel', 2]],
      weapons: [[3, 'gold']],
    };
    game.start();
    game.update(2);
    assert.equal(game.spawnCues.length, 19);
    const reserved = game.spawnCues.map(cue => ({ ...cue }));
    const randomCalls = calls;
    game.update(.5);
    assert.equal(calls, randomCalls, 'previews do not reroll positions each frame');
    assert.deepEqual(game.spawnCues.map(point), reserved.map(point));
    for (const cue of reserved.filter(cue => cue.kind === 'enemy').slice(-2)) {
      const b = game.bounds();
      assert.ok(cue.x === b.left || cue.x === b.right || cue.y === b.top || cue.y === b.bottom);
    }
    game.combat = () => {};
    game.update(.5);
    assert.equal(calls, randomCalls, 'appearance consumes the reserved objects');
    assert.deepEqual(game.food.map(point), reserved.filter(cue => cue.kind === 'food').map(point));
    assert.deepEqual(game.robots.map(point), reserved.filter(cue => cue.kind === 'enemy').map(point));
    assert.deepEqual(game.weapons.map(point), reserved.filter(cue => cue.kind === 'weapon').map(point));
    game.update(.1);
    assert.equal(game.food.length, 13);
    assert.equal(game.robots.length, 5);
    assert.equal(game.weapons.length, 1);
  }
});

test('pause freezes previews, restart clears reservations, and ready scenes do not prepare spawns', () => {
  const game = new Game(() => .3, { customLevel: custom(placements(2)) });
  game.update(10);
  assert.equal(game.pendingSpawns.size, 0);
  game.start(); game.update(1.4);
  const cues = structuredClone(game.spawnCues);
  game.pause(); game.update(10);
  assert.deepEqual(game.spawnCues, cues);
  game.resume(); game.update(.2);
  assert.ok(game.spawnCues[0].progress > cues[0].progress);
  game.reset();
  assert.equal(game.pendingSpawns.size, 0);
  assert.deepEqual(game.spawnCues, []);
  assert.equal(game.nextCustom, 0);
});

test('time-zero spawns keep their timing and early spawns get shortened previews', () => {
  const game = new Game(() => .3, { customLevel: custom([
    ...placements(0), ...placements(.5),
  ]) });
  game.start();
  assert.equal(game.food.length, 1);
  assert.equal(game.weapons.length, 1);
  assert.equal(game.robots.length, 2);
  assert.equal(game.spawnCues.length, 4);
  assert.ok(game.spawnCues.every(cue => cue.progress === .5));
  game.combat = () => {};
  game.update(.5);
  assert.equal(game.food.length, 2);
  assert.equal(game.weapons.length, 2);
  assert.equal(game.robots.length, 4);
  assert.deepEqual(game.spawnCues, []);
});

test('earned hearts preview for exactly one second at their reserved positions in both layouts', () => {
  for (const options of [{}, { portrait: true, scale: .35 }]) {
    let calls = 0;
    const game = new Game(() => (++calls * .137) % 1, {
      ...options, customLevel: { ...custom([]), heartCost: 10 },
    });
    game.start();
    game.score = 9;
    game.hearts = 1;
    game.food.push({ ...point(game.cat), type: 'S', expires: 5 });
    game.update(1 / 120);
    const [cue] = game.spawnCues;
    assert.equal(cue.kind, 'heart');
    assert.ok(Math.abs(cue.progress) < 1e-8);
    const randomCalls = calls;
    game.cat.x = cue.x; game.cat.y = cue.y;
    game.update(.5);
    assert.ok(Math.abs(game.spawnCues[0].progress - .5) < 1e-8);
    assert.equal(game.healing.length, 0);
    assert.equal(game.hearts, 1, 'clouds cannot heal');
    game.cat.x = 22; game.cat.y = 22;
    game.update(.499);
    assert.equal(game.healing.length, 0);
    assert.equal(game.spawnCues.length, 1);
    game.update(.001);
    assert.deepEqual(game.spawnCues, []);
    assert.deepEqual(game.healing, [point(cue)]);
    assert.equal(calls, randomCalls);
    assert.equal(game.pendingSpawns.size, 0);
    game.update(2);
    assert.deepEqual(game.healing, [point(cue)], 'uncollected hearts persist');
  }
});

test('multiple healing thresholds queue independent clouds; pause freezes and restart clears them', () => {
  const game = new Game(() => .25, { customLevel: { ...custom([]), heartCost: 1 } });
  game.start();
  game.food.push({ ...point(game.cat), type: 'P', expires: 5 });
  game.update(.01);
  assert.equal(game.spawnCues.length, 2);
  assert.ok(game.spawnCues.every(cue => cue.kind === 'heart'));
  assert.equal(game.nextHeart, 3);
  game.update(.25);
  const cues = structuredClone(game.spawnCues);
  game.pause(); game.update(10);
  assert.deepEqual(game.spawnCues, cues);
  game.resume(); game.update(.75);
  assert.equal(game.healing.length, 2);
  assert.deepEqual(game.spawnCues, []);
  game.score++;
  game.update(.01);
  assert.equal(game.spawnCues.length, 1);
  game.reset();
  assert.deepEqual(game.spawnCues, []);
  assert.equal(game.pendingSpawns.size, 0);
  assert.equal(game.healing.length, 0);
});
