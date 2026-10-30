const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, SPEED, brickEditRegions, brickRegions, validateCustomLevel } = require('../src/game.js');

const blank = () => ({ version: 1, id: 'Contact bricks', duration: 120, goal: 1000, heartCost: null, brickSet: 1, events: [] });
function setup(attribute, options = {}, targetId = 0) {
  const base = new Game(() => .99, options);
  const region = brickEditRegions(base.bricks).get(targetId);
  const level = { ...blank(), brickTypes: [{ ...region, kind: 'fast', [attribute]: true }] };
  const game = new Game(() => .99, { ...options, customLevel: level });
  game.start();
  return game;
}
const aim = (game, brick) => game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2);
function approach(game, brick, tangent = 0) {
  const edge = brickRegions(game.bricks, game.width, game.height).get(brick.id).edge;
  const normal = { top: [0, 1], bottom: [0, -1], left: [1, 0], right: [-1, 0] }[edge];
  const [nx, ny] = normal;
  const x = nx ? (nx > 0 ? brick.x + brick.w : brick.x) : brick.x + brick.w / 2;
  const y = ny ? (ny > 0 ? brick.y + brick.h : brick.y) : brick.y + brick.h / 2;
  game.cat.x = x + nx * (game.cat.radius + 10);
  game.cat.y = y + ny * (game.cat.radius + 10);
  const inward = Math.sqrt(SPEED ** 2 - tangent ** 2);
  game.cat.vx = -nx * inward - ny * tangent;
  game.cat.vy = -ny * inward + nx * tangent;
  return { nx, ny, inward };
}

test('Slimed and Springs validate, round-trip and replace overlapping contact attributes', () => {
  for (const attribute of ['slimed', 'springs']) {
    const game = setup(attribute);
    const level = validateCustomLevel(JSON.parse(JSON.stringify(game.customLevel)));
    assert.equal(level.brickTypes[0][attribute], true);
    for (const options of [{}, { portrait: true, scale: .31 }]) {
      const restored = new Game(() => .99, { ...options, customLevel: level });
      assert.deepEqual(restored.bricks.filter(b => b[attribute]).map(b => b.id), [0]);
    }
    for (const value of [null, 1, 'true', [], {}]) {
      assert.throws(() => validateCustomLevel({ ...level, brickTypes: [{ ...level.brickTypes[0], [attribute]: value }] }), TypeError);
    }
    const entry = level.brickTypes[0], other = attribute === 'slimed' ? 'springs' : 'slimed';
    assert.throws(() => validateCustomLevel({ ...level, brickTypes: [{ ...entry, [other]: true }] }), /cannot be both/);
    const swapped = new Game(() => .99, { customLevel: {
      ...level, brickTypes: [entry, { ...entry, [attribute]: false, [other]: true }, { edge: entry.edge, start: entry.start, end: entry.end, kind: 'slow' }],
    } });
    assert.equal(swapped.bricks[0][other], true);
    assert.equal(swapped.bricks[0][attribute], false);
    const implicit = new Game(() => .99, { customLevel: {
      ...level, brickTypes: [entry, { edge: entry.edge, start: entry.start, end: entry.end, kind: 'fast', [other]: true }],
    } });
    assert.equal(implicit.bricks[0][attribute], false);
    assert.equal(implicit.bricks[0][other], true);
  }
});

test('slime locks steering for one exact second, preserves activation state, pauses, and releases without launching', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = setup('slimed', options, 4), brick = game.bricks[4];
    approach(game, brick);
    game.update(.1);
    assert.equal(game.cat.vx, 0);
    assert.equal(game.cat.vy, 0);
    assert.ok(Math.abs(game.stuckUntil - (1 + 10 / SPEED)) < 1e-8);
    const position = { ...game.cat }, bricks = JSON.stringify(game.bricks);
    assert.equal(aim(game, game.bricks[5]), false);
    assert.equal(JSON.stringify(game.bricks), bricks);
    game.pause(); game.update(10);
    assert.ok(Math.abs(game.elapsed - .1) < 1e-8);
    assert.equal(game.releasedAt, null);
    game.resume();
    game.update(game.stuckUntil - game.elapsed - .001);
    assert.equal(aim(game, game.bricks[5]), false);
    const deadline = game.stuckUntil;
    game.update(.001);
    assert.equal(game.stuckUntil, 0);
    assert.equal(game.releasedAt, deadline);
    assert.deepEqual(game.cat, position);
    assert.equal(aim(game, game.bricks[5]), true);
    game.update(.05);
    assert.notDeepEqual(game.cat, position);
    game.reset();
    assert.equal(game.stuckUntil, 0);
    assert.equal(game.releasedAt, null);
  }
});

test('springs reflect oblique velocity on all four sides in both layouts without consuming cooldowns', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const base = new Game(() => .99, options);
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const edgeIds = [...brickRegions(base.bricks, base.width, base.height)].filter(([, region]) => region.edge === edge).map(([id]) => id);
      const id = edgeIds[Math.floor(edgeIds.length / 2)];
      const game = setup('springs', options, id), brick = game.bricks[id];
      brick.readyAt = 50;
      const { nx, ny, inward } = approach(game, brick, 100);
      game.update(.1);
      assert.ok(Math.abs(game.cat.vx - (nx * inward - ny * 100)) < 1e-7);
      assert.ok(Math.abs(game.cat.vy - (ny * inward + nx * 100)) < 1e-7);
      assert.ok(Math.abs(Math.hypot(game.cat.vx, game.cat.vy) - SPEED) < 1e-7);
      assert.equal(brick.readyAt, 50);
      assert.notEqual(brick.hitAt, null);
      assert.equal(game.stuckUntil, 0);
      assert.equal(game.target, null);
      const hitAt = brick.hitAt;
      game.pause(); game.update(5);
      assert.equal(brick.hitAt, hitAt);
      assert.ok(Math.abs(game.elapsed - .1) < 1e-8);
      game.reset();
      assert.equal(game.bricks[id].hitAt, null);
      assert.equal(game.bricks[id].hitNormal, null);
      assert.equal(game.bricks[id].hitPoint, null);
    }
  }
});

test('spring rounded corners reflect about the corner normal', () => {
  const game = setup('springs'), brick = game.bricks[0];
  game.brickParts = () => [brick];
  const n = Math.SQRT1_2;
  game.cat.x = brick.x - n * (game.cat.radius + 10);
  game.cat.y = brick.y + brick.h + n * (game.cat.radius + 10);
  game.cat.vx = n * SPEED; game.cat.vy = -n * SPEED;
  game.update(.05);
  assert.ok(Math.abs(game.cat.vx + n * SPEED) < 1e-7);
  assert.ok(Math.abs(game.cat.vy - n * SPEED) < 1e-7);
});

test('repeated spring bounces preserve motion and allow mid-flight steering', () => {
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .65 }]) {
    const game = setup('springs', options);
    for (const brick of game.bricks) brick.springs = true;
    game.cat.vx = Math.cos(.37) * SPEED;
    game.cat.vy = Math.sin(.37) * SPEED;
    for (let i = 0; i < 300; i++) {
      game.update(.05);
      assert.equal(game.state, 'playing');
      assert.ok(Math.abs(Math.hypot(game.cat.vx, game.cat.vy) - SPEED) < 1e-7);
    }
    assert.ok(game.bricks.some(brick => brick.hitAt !== null));
    const target = game.bricks.find(brick => aim(game, brick));
    assert.ok(target, 'a bounce does not lock steering');
    assert.deepEqual(game.target, { x: target.x + target.w / 2, y: target.y + target.h / 2 });
  }
});

test('contact effects cover merged connecting gaps without consuming Crumbler uses', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    for (const attribute of ['slimed', 'springs']) {
      const game = setup(attribute, options), owner = game.bricks[0];
      owner.warped = 15; owner.crumbler = 3; owner.usesLeft = 3;
      assert.equal(aim(game, owner), true);
      const deadline = owner.readyAt;
      const bridge = game.brickParts().find(part => part.id === owner.id && part.sourceId === undefined);
      const normal = options.portrait ? [0, 1] : [-1, 0];
      const [nx, ny] = normal;
      game.cat.x = (nx ? bridge.x : bridge.x + bridge.w / 2) + nx * (game.cat.radius + 10);
      game.cat.y = (ny ? bridge.y + bridge.h : bridge.y + bridge.h / 2) + ny * (game.cat.radius + 10);
      game.cat.vx = -nx * SPEED; game.cat.vy = -ny * SPEED;
      game.update(.05);
      if (attribute === 'slimed') assert.ok(game.stuckUntil > game.elapsed);
      else {
        assert.ok(Math.abs(game.cat.vx - nx * SPEED) < 1e-7);
        assert.ok(Math.abs(game.cat.vy - ny * SPEED) < 1e-7);
      }
      assert.equal(owner.usesLeft, 2);
      assert.equal(owner.readyAt, deadline);
      assert.equal(game.bricks.filter(b => b.absorbedBy === 0).length, 1);
    }
  }
});

test('merged groups use owner contact attributes, restore absorbed attributes, and exhausted contacts still work', () => {
  for (const attribute of ['slimed', 'springs']) {
    const game = setup(attribute), owner = game.bricks[0], neighbor = game.bricks[2];
    owner.warped = .2;
    neighbor[attribute === 'slimed' ? 'springs' : 'slimed'] = true;
    assert.equal(aim(game, owner), true);
    assert.equal(neighbor.absorbedBy, 0);
    owner.usesLeft = 0;
    approach(game, neighbor);
    game.update(.1);
    if (attribute === 'slimed') assert.ok(game.stuckUntil > game.elapsed);
    else assert.notEqual(owner.hitAt, null);
    assert.equal(neighbor.absorbedBy, 0);
    owner.usesLeft = null;
    game.update(.2);
    assert.equal(neighbor.absorbedBy, null);
    assert.equal(neighbor[attribute === 'slimed' ? 'springs' : 'slimed'], true);
  }
});
