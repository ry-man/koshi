const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, validateCustomLevel, brickEditRegions, brickContact, brickShape } = require('../src/game.js');

const blank = () => ({ version: 1, id: 'Brick test', duration: 120, goal: 1000, heartCost: null, brickSet: 1, events: [] });
function setup(attributes, options = {}, random = () => .99) {
  const base = new Game(random, options);
  const region = brickEditRegions(base.bricks).get(0);
  const level = { ...blank(), brickTypes: [{ ...region, kind: 'fast', ...attributes }] };
  const game = new Game(random, { ...options, customLevel: level });
  game.start();
  return game;
}
const aim = (game, brick) => game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2);

test('merged brick outlines cover only the solid union without internal seams', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = setup({ warped: 100 }, options);
    for (let count = 0; count <= 25; count++) {
      const parts = game.brickParts().filter(part => part.id === 0);
      const shape = brickShape(parts);
      assert.ok(shape.w > 0 && shape.h > 0);
      assert.doesNotMatch(shape.path, /NaN|undefined|Infinity/);
      assert.equal((shape.path.match(/M/g) || []).length, count === 25 ? 2 : 1);
      let area = 0;
      for (const loop of shape.path.split('Z').filter(Boolean)) {
        const points = [...loop.matchAll(/[ML]([\d.e+-]+) ([\d.e+-]+)/g)].map(match => [Number(match[1]), Number(match[2])]);
        for (let i = 0; i < points.length - 1; i++) area += (points[i][0] * points[i + 1][1] - points[i + 1][0] * points[i][1]) / 2;
      }
      const expected = parts.reduce((sum, part) => sum + part.w * part.h, 0);
      assert.ok(Math.abs(area * shape.w * shape.h - expected) < .01);
      game.bricks[0].readyAt = 0;
      aim(game, game.bricks[0]);
    }
  }
});

test('brick attributes validate, round-trip, compose, and map identically on phone', () => {
  const desktop = setup({ crumbler: 5, warped: 15 });
  const level = validateCustomLevel(JSON.parse(JSON.stringify(desktop.customLevel)));
  assert.equal(level.brickTypes[0].crumbler, 5);
  assert.equal(level.brickTypes[0].warped, 15);
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .65 }]) {
    const game = new Game(Math.random, { ...options, customLevel: level });
    assert.equal(game.bricks[0].crumbler, 5);
    assert.equal(game.bricks[0].usesLeft, 5);
    assert.equal(game.bricks[0].warped, 15);
    assert.ok(game.bricks.slice(1).every(brick => brick.usesLeft === null && !brick.warped));
  }
  const entry = level.brickTypes[0];
  for (const crumbler of [0, -1, 1.5, '5', Infinity, 100001, false]) {
    assert.throws(() => validateCustomLevel({ ...level, brickTypes: [{ ...entry, crumbler }] }), TypeError);
  }
  for (const warped of [0, -.1, '15', NaN, 3601, false]) {
    assert.throws(() => validateCustomLevel({ ...level, brickTypes: [{ ...entry, warped }] }), TypeError);
  }
  const reset = new Game(Math.random, { customLevel: {
    ...level, brickTypes: [entry, { ...entry, crumbler: null, warped: null }],
  } });
  assert.equal(reset.bricks[0].usesLeft, null);
  assert.equal(reset.bricks[0].warped, null);
});

test('Crumblers decrement only successful selections, stay solid at zero, and reset', () => {
  const game = setup({ crumbler: 2 });
  const brick = game.bricks[0];
  assert.equal(game.steer(0, -1, -1), false);
  assert.equal(brick.usesLeft, 2);
  assert.equal(aim(game, brick), true);
  assert.equal(brick.usesLeft, 1);
  assert.equal(aim(game, brick), false);
  game.pause();
  assert.equal(aim(game, brick), false);
  game.update(5);
  assert.equal(brick.usesLeft, 1);
  game.resume(); game.update(3);
  assert.equal(aim(game, brick), true);
  assert.equal(brick.usesLeft, 0);
  game.update(3);
  assert.equal(aim(game, brick), false);
  game.cat.x = game.width / 2;
  game.cat.y = brick.y + brick.h / 2;
  aim(game, game.bricks[2]);
  // Travel into the exhausted brick to verify it remains a wall.
  game.cat.vx = 420; game.cat.vy = 0;
  game.update(2);
  assert.equal(game.cat.vx, 0);
  assert.ok(Math.abs(game.cat.x - brick.x + game.cat.radius) < 1e-7);
  game.reset();
  assert.equal(game.bricks[0].usesLeft, 2);
  assert.equal(game.bricks[0].readyAt, 0);
});

test('Warped bricks choose either adjacent perimeter neighbor and fill only the connecting gap', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    for (const random of [() => 0, () => .99]) {
      const game = setup({ warped: 15 }, options, random);
      assert.equal(aim(game, game.bricks[0]), true);
      const absorbed = game.bricks.find(brick => brick.absorbedBy === 0);
      assert.ok([10, 2].includes(absorbed.id));
      assert.equal(aim(game, absorbed), false);
      const parts = game.brickParts();
      assert.equal(parts.length, 27);
      assert.equal(parts.filter(part => part.id === 0).length, 3);
      const bridge = parts.find(part => part.sourceId === undefined);
      assert.ok(bridge.w > 0 && bridge.h > 0);
      assert.equal(brickContact(bridge.x + bridge.w / 2, bridge.y + bridge.h + 30, 0, -50, 1, bridge), 29 / 50);
      game.update(3);
      assert.equal(aim(game, absorbed), false);
      assert.equal(game.steer(0, bridge.x + bridge.w / 2, bridge.y + bridge.h / 2), true);
      assert.equal(game.bricks.filter(brick => brick.absorbedBy === 0).length, 2);
      game.update(3);
      assert.equal(game.steer(0, absorbed.x + absorbed.w / 2, absorbed.y + absorbed.h / 2), true);
      assert.equal(game.bricks.filter(brick => brick.absorbedBy === 0).length, 3);
      assert.equal(game.bricks[0].warpUntil, 15);
      assert.equal(game.steer(0, game.width / 2, game.height / 2), false);
    }
  }
});

test('warps freeze while paused, expire exactly, and preserve absorbed attributes and cooldown state', () => {
  const game = setup({ warped: 15 });
  const neighbor = game.bricks[2];
  neighbor.kind = 'slow'; neighbor.crumbler = 5; neighbor.usesLeft = 4;
  neighbor.warped = 7; neighbor.readyAt = 20;
  const original = { ...neighbor };
  aim(game, game.bricks[0]);
  assert.equal(neighbor.absorbedBy, 0);
  game.update(5);
  game.pause(); game.update(100);
  assert.ok(Math.abs(game.elapsed - 5) < 1e-8);
  assert.equal(neighbor.absorbedBy, 0);
  game.resume(); game.update(9.99);
  assert.equal(neighbor.absorbedBy, 0);
  game.update(.01);
  assert.deepEqual(neighbor, original);
  assert.equal(game.bricks[0].warpUntil, null);
  assert.equal(game.brickParts().length, 26);
  game.reset();
  assert.ok(game.bricks.every(brick => brick.absorbedBy === null && brick.warpUntil === null));
});

test('exhausted Warped Crumblers permanently freeze their entire enlarged shape until restart', () => {
  for (const options of [{}, { portrait: true, scale: .5 }]) {
    for (const uses of [1, 3]) {
      const game = setup({ crumbler: uses, warped: 15 }, options);
      for (let i = 0; i < uses; i++) {
        assert.equal(aim(game, game.bricks[0]), true);
        game.update(3);
      }
      assert.equal(game.bricks[0].usesLeft, 0);
      assert.equal(game.bricks.filter(brick => brick.absorbedBy === 0).length, uses);
      const shape = game.brickParts();
      game.update(20);
      assert.deepEqual(game.brickParts(), shape);
      for (const brick of game.bricks.filter(b => b.id === 0 || b.absorbedBy === 0)) assert.equal(aim(game, brick), false);
      game.reset();
      assert.equal(game.bricks[0].usesLeft, uses);
      assert.ok(game.bricks.every(brick => brick.absorbedBy === null));
      game.start();
      assert.equal(aim(game, game.bricks[0]), true);
    }
  }
});

test('active warp groups cannot absorb each other and a fully absorbed perimeter is stable', () => {
  const game = setup({ warped: 100 });
  game.bricks[4].warped = 100;
  aim(game, game.bricks[0]);
  aim(game, game.bricks[4]);
  assert.equal(game.bricks[0].absorbedBy, null);
  assert.equal(game.bricks[4].absorbedBy, null);
  game.update(3);
  aim(game, game.bricks[0]);
  assert.equal(game.bricks[4].absorbedBy, null);
  const full = setup({ warped: 100 });
  for (let i = 0; i < 30; i++) {
    full.bricks[0].readyAt = 0;
    assert.equal(aim(full, full.bricks[0]), true);
  }
  assert.equal(full.bricks.filter(brick => brick.absorbedBy === 0).length, 25);
  assert.equal(full.brickParts().length, 52);
  assert.ok(full.brickParts().every(part => part.w > 0 && part.h > 0));
});
