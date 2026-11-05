const test = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('../src/game.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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

test('random enemies avoid Koshi, including the entire snake, with constant random sources', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    for (const type of ['mouse', 'wheel', 'ram', 'bucket', 'ball', 'jackolantern', 'snake']) {
      const game = new Game(() => .5, options);
      if (['wheel', 'snake'].includes(type)) {
        const probe = { distance: (game.bounds().right - game.bounds().left + game.bounds().bottom - game.bounds().top) };
        game.placeWheel(probe);
        Object.assign(game.cat, probe);
      }
      const enemies = game.createEnemies([0, type, 3]);
      assert.equal(enemies.length, 3);
      for (const enemy of enemies) {
        const parts = type === 'snake' ? game.snakeSegments(enemy) : [enemy];
        for (const part of parts) assert.ok(Math.hypot(part.x - game.cat.x, part.y - game.cat.y)
          > game.cat.radius + part.radius + (part.index ? 5 : 0), `${type} overlaps Koshi`);
        if (['wheel', 'snake'].includes(type)) {
          const expected = { distance: enemy.distance };
          game.placeWheel(expected);
          assert.deepEqual(point(enemy), point(expected));
        }
      }
    }
  }
});

test('random enemies recheck reserved positions at appearance without moving explicit placements', () => {
  for (const type of ['mouse', 'wheel', 'snake']) {
    const game = new Game(() => .3);
    const event = [2, type, 1];
    const [reserved] = game.createEnemies(event);
    game.pendingSpawns.set(event, { kind: 'enemy', time: 2, items: [reserved] });
    Object.assign(game.cat, point(reserved));
    game.spawnEnemies(event);
    assert.equal(game.robots.length, 1);
    assert.ok(game.enemySpawnClear(game.robots[0]));
    assert.equal(game.pendingSpawns.size, 0);
  }
  const game = new Game(() => .5, { customLevel: custom([
    { time: 0, kind: 'enemy', type: 'mouse', x: .5, y: .5 },
  ]) });
  game.start();
  assert.deepEqual(point(game.robots[0]), point(game.cat));
});

test('enemy spawners avoid Koshi immediately on contact', () => {
  const game = new Game(() => .5);
  const brick = game.bricks[0];
  brick.spawner = { kind: 'enemy', type: 'mouse' };
  game.spawnFromBrick(brick);
  assert.ok(game.enemySpawnClear(game.robots[0]));
  assert.equal(brick.spawned, true);
});

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

test('obstructions warn for two seconds with exact shape geometry without changing scheduled appearance times', () => {
  for (const type of ['obstruction-circle', 'obstruction-diamond', 'obstruction-rectangle-horizontal']) {
    const events = [
      { time: 3, kind: 'object', type, x: .5, y: .5, width: 160, height: type.includes('rectangle') ? 60 : 160 },
      ...placements(3),
    ];
    const game = new Game(() => .3, { customLevel: custom(events) });
    game.start(); game.update(.99);
    assert.equal(game.spawnCues.length, 0);
    game.update(.01);
    assert.equal(game.spawnCues.length, 1);
    const cue = game.spawnCues[0];
    assert.equal(cue.progress, 0);
    assert.equal(cue.obstruction.type, type);
    assert.equal(cue.obstruction.width, 160);
    game.update(1);
    assert.equal(game.spawnCues.length, 5);
    assert.ok(Math.abs(game.spawnCues.find(cue => cue.obstruction).progress - .5) < 1e-8);
    assert.equal(game.obstructions.length, 0);
    game.pause(); game.update(2);
    assert.ok(Math.abs(game.spawnCues.find(cue => cue.obstruction).progress - .5) < 1e-8);
    game.resume(); game.update(1);
    assert.equal(game.obstructions.length, 1);
    assert.equal(game.spawnCues.length, 0);
    assert.ok(Math.abs(game.elapsed - 3) < 1e-8);
  }
});

test('obstruction spawners reserve a position and wait two seconds before becoming solid', () => {
  const game = new Game(() => .5, { customLevel: custom([]) });
  game.start();
  const brick = game.bricks[0];
  brick.spawner = { kind: 'object', type: 'obstruction-diamond', width: 200, height: 200 };
  game.spawnFromBrick(brick);
  assert.equal(game.obstructions.length, 0);
  const cue = game.spawnCues[0];
  assert.equal(cue.obstruction.width, 200);
  game.update(1.99);
  assert.equal(game.obstructions.length, 0);
  game.update(.01);
  assert.equal(game.obstructions.length, 1);
  assert.deepEqual(point(game.obstructions[0]), point(cue));
  assert.equal(game.spawnCues.length, 0);
  assert.equal(game.pendingSpawns.size, 0);
});

test('obstruction warnings trace the actual dotted shape while retaining the twinkling star', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  for (const type of ['obstruction-circle', 'obstruction-diamond', 'obstruction-rectangle-horizontal']) {
    const calls = [], stack = [], gradient = { addColorStop() {} };
    const ctx = new Proxy({ globalAlpha: 1 }, {
      get(target, name) {
        if (name in target) return target[name];
        if (name === 'save') return () => stack.push({ ...target });
        if (name === 'restore') return () => Object.assign(target, stack.pop());
        if (name === 'createRadialGradient') return () => gradient;
        return (...args) => calls.push([name, ...args]);
      },
    });
    const context = vm.createContext({ ctx, KoshiGame: require('../src/game.js') });
    vm.runInContext(source.slice(source.indexOf('function drawSpawnCue('), source.indexOf('function drawSword(')), context);
    context.drawSpawnCue({ kind: 'object', x: 100, y: 200, progress: .5, obstruction: { type, width: 160, height: type.includes('rectangle') ? 60 : 160 } });
    assert.ok(calls.some(([name, dash]) => name === 'setLineDash' && String(dash) === '3,5'));
    if (type.includes('circle')) assert.ok(calls.some(([name, x, y, radius]) => name === 'arc' && radius === 80));
    else if (type.includes('rectangle')) assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['rect', -80, -30, 160, 60])));
    else for (const [x, y] of [[80, 0], [0, 80], [-80, 0]]) {
      assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['lineTo', x, y])));
    }
    assert.ok(calls.some(([name]) => name === 'stroke'));
    assert.ok(calls.some(([name]) => name === 'fill'), 'the star still twinkles');
    assert.equal(stack.length, 0);
  }
});

test('early obstruction warnings are shortened and time-zero solids remain immediate', () => {
  for (const time of [0, .5]) {
    const game = new Game(() => .5, { customLevel: custom([{ time, kind: 'object', type: 'obstruction-circle', x: .2, y: .2 }]) });
    game.start();
    if (time) {
      assert.ok(Math.abs(game.spawnCues[0].progress - .75) < 1e-8);
      assert.equal(game.obstructions.length, 0);
      game.update(time);
    }
    assert.equal(game.obstructions.length, 1);
    assert.equal(game.spawnCues.length, 0);
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
