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

  test('appearing bumpers remove covered live and queued pickups, but keep safely separated pickups', () => {
    const game = arena({ ...blank(), events: [
      { time: 1, kind: 'object', type: 'bumper-blue', x: .3, y: .5 },
    ] });
    const point = game.pointFromRelative(.3, .5);
    for (const field of ['food', 'items', 'weapons', 'healing']) {
      game[field] = [
        { ...point, type: field === 'food' ? 'S' : field === 'items' ? 'battery' : 'wood', expires: 50 },
        { x: point.x + 61, y: point.y, expires: 50 },
        { x: point.x + 62, y: point.y, expires: 50 },
      ];
    }
    for (const kind of ['food', 'item', 'weapon', 'heart']) {
      game.pendingSpawns.set({}, { kind, time: 10, items: [{ ...point }, { x: point.x + 100, y: point.y }] });
    }
    game.update(1);
    assert.equal(game.bumpers.length, 1);
    for (const field of ['food', 'items', 'weapons', 'healing']) {
      assert.equal(game[field].length, 1, field);
      assert.equal(game[field][0].x, point.x + 62, 'touching but not overlapping is allowed');
    }
    assert.ok([...game.pendingSpawns.values()].every(pending => pending.items.every(item => game.pickupClear(item))));
  });

  test('fixed pickups and brick spawners cannot place pickups under existing bumpers', () => {
    const game = arena({ ...blank(), events: [
      { time: 0, kind: 'object', type: 'bumper-red', x: .3, y: .5 },
      { time: .2, kind: 'food', type: 'S', x: .3, y: .5, lifetime: 10 },
      { time: .2, kind: 'item', type: 'battery', x: .3, y: .5 },
      { time: .2, kind: 'weapon', type: 'silver', x: .3, y: .5 },
    ] });
    game.update(.3);
    for (const field of ['food', 'items', 'weapons']) assert.equal(game[field].length, 0);
    for (const spawn of [
      { kind: 'food', type: 'H', lifetime: 10 }, { kind: 'item', type: 'kitty-cape' },
      { kind: 'weapon', type: 'wood' }, { kind: 'heart', type: 'heart' },
    ]) {
      game.spawnFromBrick({ spawner: { ...spawn, x: .3, y: .5 } });
    }
    for (const field of ['food', 'items', 'weapons', 'healing']) assert.equal(game[field].length, 0);
  });

  test('random pickup placements and formations avoid bumper footprints', () => {
    let seed = 1;
    const game = new Game(() => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296), { customLevel: blank() });
    game.start();
    game.bumpers.push(game.createBumper({ x: 480, y: 300 }, 'bumper-green'));
    for (let i = 0; i < 20; i++) {
      assert.ok(game.pickupClear(game.randomPickupPoint()));
      assert.ok(game.pickupClear(game.createCollectible(0, 'battery')));
      assert.ok(game.pickupClear(game.createCollectible(0, 'ditto-stamp')));
      for (const method of ['S', 'R3', 'L3', 'C3']) {
        assert.ok(game.createFood([0, method, 'S', 10]).every(item => game.pickupClear(item)));
      }
      const grouped = game.createCustomSpawn({ time: 0, kind: 'food', type: 'S', lifetime: 10,
        random: true, group: { shape: 'circle', count: 4, size: .3 } });
      assert.ok(grouped.every(item => game.pickupClear(item)));
    }
  });

  test('enemy drops and pickups already covered by a bumper cannot be collected', () => {
    const game = arena(), bumper = game.createBumper({ x: 350, y: 300 }, 'bumper-green');
    game.bumpers.push(bumper);
    const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'mouse', x: .3, y: .5 })[0];
    Object.assign(enemy, { x: bumper.x, y: bumper.y, carriesKey: true, carriesCatBlock: true });
    game.defeatEnemy(enemy);
    assert.equal(game.items.length, 0);
    game.items.push({ x: bumper.x, y: bumper.y, type: 'battery' });
    game.cat.x = bumper.x; game.cat.y = bumper.y;
    game.combat(.01, game.cat.x, game.cat.y);
    assert.equal(game.batteries, 0);
    assert.equal(game.items.length, 0);
  });
  const bumper = { x: 40, y: 50, type: 'bumper-red', radius: 24, hitAt: 5, hitNormal: { x: 1, y: 0 } };
  drawBumper(context, bumper, 5.02);
  assert.equal(calls.filter(([name]) => name === 'arc').length, 4, 'outer casing plus three white rings');
  assert.ok(calls.some(([name, x, y]) => name === 'translate' && x !== bumper.x && y === bumper.y),
    'impact produces a small directional shake');
  assert.ok(calls.some(([name, x, y]) => name === 'scale' && (x !== 1 || y !== 1)),
    'impact compresses the bumper');
});
