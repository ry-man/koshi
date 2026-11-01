const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, validateCustomLevel, brickRegions } = require('../src/game.js');
const { FENCE, drawBarrier, specialLabel } = require('../src/brick-visuals.js');

function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: {
    version: 1, id: 'Fence test', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [],
  } });
  game.start();
  return game;
}
function edge(game, name) {
  const regions = brickRegions(game.bricks, game.width, game.height);
  return game.bricks.filter(b => regions.get(b.id).edge === name)
    .sort((a, b) => Math.hypot(a.x + a.w / 2 - game.width / 2, a.y + a.h / 2 - game.height / 2)
      - Math.hypot(b.x + b.w / 2 - game.width / 2, b.y + b.h / 2 - game.height / 2))[0];
}
function activate(game, brick) {
  brick.barrier = true;
  assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
}

test('Barrier validates, rejects conflicting surfaces, and leaves campaign levels unchanged', () => {
  const game = arena();
  const custom = { ...game.customLevel, brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', barrier: true }] };
  assert.equal(validateCustomLevel(custom).brickTypes[0].barrier, true);
  assert.throws(() => validateCustomLevel({ ...custom, brickTypes: [{ ...custom.brickTypes[0], barrier: 'yes' }] }));
  assert.throws(() => validateCustomLevel({ ...custom, brickTypes: [{ ...custom.brickTypes[0], spikes: true }] }));
  assert.ok(LEVELS.slice(0, 19).every(level => level.brickTypes.every(brick => !brick.barrier)));
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  test(`fences extend perpendicular on all edges, stop at bricks, retract, pause and reset ${JSON.stringify(options)}`, () => {
    for (const name of ['top', 'bottom', 'left', 'right']) {
      const game = arena(options), brick = edge(game, name);
      activate(game, brick);
      game.updateBarriers(.1);
      let fence = game.barrierSegments()[0];
      assert.equal(fence.length, 18);
      assert.equal(fence.nx, name === 'left' ? 1 : name === 'right' ? -1 : 0);
      assert.equal(fence.ny, name === 'top' ? 1 : name === 'bottom' ? -1 : 0);
      game.updateBarriers(10);
      const length = game.barriers[0].length;
      assert.ok(length > 18 && length < Math.hypot(game.width, game.height));
      game.updateBarriers(1); assert.equal(game.barriers[0].length, length);
      assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), false);
      assert.equal(game.barriers[0].extending, true, 'rejected selection does not toggle');
      game.pause(); game.update(1); assert.equal(game.barriers[0].length, length);
      game.resume(); brick.readyAt = 0;
      Object.assign(game.cat, { x: game.width / 2, y: game.height / 2, vx: 0, vy: 0 });
      activate(game, brick);
      assert.equal(game.barriers[0].extending, false);
      game.updateBarriers(.1); assert.equal(game.barriers[0].length, length - 18);
      game.updateBarriers(10); assert.equal(game.barriers[0].length, 0);
      game.reset(); assert.equal(game.barriers.length, 0);
    }
  });
}

test('a perpendicular fence stops at an existing fence and extends after it retracts', () => {
  const game = arena(), top = edge(game, 'top'), left = edge(game, 'left');
  activate(game, top); game.updateBarriers(10);
  left.barrier = true; game.barriers.push({ id: left.id, length: 0, extending: true });
  game.updateBarriers(10);
  const vertical = game.barrierSegments().find(f => f.id === top.id);
  const horizontal = game.barrierSegments().find(f => f.id === left.id);
  assert.ok(Math.abs(horizontal.endX - (vertical.x - 2)) < 1e-6);
  game.barriers.find(f => f.id === top.id).extending = false;
  game.updateBarriers(10); game.updateBarriers(10);
  assert.ok(game.barriers.find(f => f.id === left.id).length > horizontal.length);
});

test('Koshi crosses fences without a collision or movement change', () => {
  const game = arena(), top = edge(game, 'top'), left = edge(game, 'left');
  activate(game, top); game.updateBarriers(10);
  Object.assign(game.cat, { x: game.width * .75, y: game.height / 2, vx: 0, vy: 0 });
  assert.equal(game.steer(left.id, left.x + left.w / 2, left.y + left.h / 2), true);
  for (let i = 0; i < 300 && (game.cat.vx || game.cat.vy); i++) game.update(.01);
  assert.ok(game.cat.x < game.barrierSegments()[0].x);
  assert.equal(game.cat.vx, 0);
});

test('every enemy is stopped by swept fence collision and Wheels stay on their perimeter', () => {
  const game = arena(), top = edge(game, 'top');
  activate(game, top); game.updateBarriers(10);
  const fence = game.barrierParts()[0];
  for (const type of ['mouse', 'bucket', 'ram', 'wheel']) {
    const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .5, y: .5 })[0];
    const old = { x: fence.x - enemy.radius - 20, y: game.height / 2, distance: enemy.distance };
    enemy.x = fence.x + 50; enemy.y = old.y;
    game.blockEnemyWithBarriers(enemy, old, [fence]);
    if (type === 'wheel') {
      assert.equal(enemy.distance, old.distance);
      assert.equal(enemy.barrierDirection, -1);
      const placed = { ...enemy }; game.placeWheel(placed);
      assert.equal(enemy.x, placed.x); assert.equal(enemy.y, placed.y);
    } else assert.ok(enemy.x < fence.x - enemy.radius);
  }
});

test('Bucket bombs bounce from fences', () => {
  const game = arena(), top = edge(game, 'top');
  activate(game, top); game.updateBarriers(10);
  const fence = game.barrierParts()[0];
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'bucket', x: .5, y: .5 })[0];
  enemy.shotTimer = 10;
  enemy.bombs = [{ x: fence.x - 30, y: game.height / 2, radius: 5, vx: 300, vy: 0, fuse: 3, state: 'flying' }];
  game.updateBucket(enemy, .2, [...game.brickParts(), ...game.barrierParts()]);
  assert.ok(enemy.bombs[0].vx < 0);
  assert.ok(enemy.bombs[0].x < fence.x);
});

test('normal and scared enemies cannot cross fences during real combat updates', () => {
  for (const afraid of [false, true]) {
    for (const type of ['mouse', 'bucket', 'ram', 'wheel']) {
      const game = arena(), brick = edge(game, 'right');
      activate(game, brick); game.updateBarriers(10);
      const fence = game.barrierParts()[0], bounds = game.bounds();
      const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .5, y: .5 })[0];
      enemy.x = type === 'wheel' ? bounds.right : game.width / 2;
      enemy.y = fence.y + fence.h + enemy.radius + 1;
      enemy.phase = enemy.angle = -Math.PI / 2;
      enemy.state = 'charging'; enemy.stateTime = 0; enemy.speed = 520;
      enemy.shotTimer = 10; enemy.barrierDirection = -1; enemy.fleeDirection = -1;
      if (type === 'wheel') enemy.distance = bounds.right - bounds.left + enemy.y - bounds.top;
      game.robots = [enemy];
      Object.assign(game.cat, { x: enemy.x, y: enemy.y + 150, vx: 0, vy: 0 });
      if (afraid) game.collectItem({ type: 'spooky-mask' });
      for (let i = 0; i < 60; i++) game.combat(1 / 120, game.cat.x, game.cat.y);
      assert.ok(enemy.y >= fence.y + fence.h + enemy.radius - .1,
        `${type} ${afraid ? 'afraid' : 'normal'} crossed the fence`);
      if (type === 'wheel') assert.equal(enemy.x, bounds.right);
    }
  }
});

test('growing fences push overlapping enemies and bombs clear without damaging them', () => {
  const game = arena(), top = edge(game, 'top');
  activate(game, top); game.updateBarriers(10);
  const fence = game.barrierParts()[0];
  for (const type of ['mouse', 'bucket', 'ram']) {
    const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .5, y: .5 })[0];
    enemy.x = fence.x + 2; enemy.y = game.height / 2;
    game.clearBarrierOverlap(enemy, [fence]);
    assert.ok(enemy.x <= fence.x - enemy.radius || enemy.x >= fence.x + fence.w + enemy.radius);
  }
  const bomb = { x: fence.x + 1, y: game.height / 2, radius: 5, vx: 100, vy: 0 };
  game.clearBarrierOverlap(bomb, [fence]);
  assert.ok(bomb.x < fence.x - bomb.radius); assert.ok(bomb.vx < 0);
});

test('Ditto copies the barrier surface without copying a deployed fence', () => {
  const game = arena(), source = edge(game, 'top'), target = edge(game, 'bottom');
  activate(game, source); game.updateBarriers(10);
  game.collectItem({ type: 'ditto-stamp' }); game.stampBrick(source, game.brickParts());
  target.barrier = true; game.barriers.push({ id: target.id, length: 30, extending: true });
  game.stampBrick(target, game.brickParts());
  assert.equal(target.barrier, true);
  assert.ok(!game.barriers.some(fence => fence.id === target.id));
  assert.ok(game.barriers.some(fence => fence.id === source.id));
});

test('fence endpoint push-outs keep every enemy inside the enclosing bricks on both layouts', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    for (const type of ['mouse', 'bucket', 'ram', 'wheel', 'ball', 'jackolantern']) {
      const game = arena(options), bounds = game.bounds();
      for (const side of ['top', 'bottom', 'left', 'right']) {
        const vertical = ['top', 'bottom'].includes(side);
        const fence = vertical
          ? { x: game.width / 2 - 2, y: bounds.top, w: 4, h: bounds.bottom - bounds.top }
          : { x: bounds.left, y: game.height / 2 - 2, w: bounds.right - bounds.left, h: 4 };
        const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .5, y: .5 })[0];
        enemy.x = side === 'left' ? bounds.left : side === 'right' ? bounds.right : game.width / 2;
        enemy.y = side === 'top' ? bounds.top : side === 'bottom' ? bounds.bottom : game.height / 2;
        game.clearBarrierOverlap(enemy, [fence]);
        assert.ok(enemy.x >= bounds.left && enemy.x <= bounds.right, `${type} escaped ${side} horizontally`);
        assert.ok(enemy.y >= bounds.top && enemy.y <= bounds.bottom, `${type} escaped ${side} vertically`);
        const nearestX = Math.max(fence.x, Math.min(fence.x + fence.w, enemy.x));
        const nearestY = Math.max(fence.y, Math.min(fence.y + fence.h, enemy.y));
        assert.ok(Math.hypot(enemy.x - nearestX, enemy.y - nearestY) >= enemy.radius,
          `${type} remains inside the fence at ${side}`);
        if (type === 'wheel') {
          const placed = { ...enemy }; game.placeWheel(placed);
          assert.equal(enemy.x, placed.x); assert.equal(enemy.y, placed.y);
        }
      }
    }
  }
});

test('lost or destroyed barrier surfaces remove fences', () => {
  const game = arena(), brick = edge(game, 'top');
  activate(game, brick); game.updateBarriers(.2);
  brick.barrier = false; game.updateBarriers(.1);
  assert.equal(game.barriers.length, 0);
  brick.barrier = true; game.barriers.push({ id: brick.id, length: 30, extending: true });
  game.collectItem({ type: 'saw-blade' });
  game.sawBrick(brick, game.brickParts()); game.updateBarriers(.1);
  assert.equal(game.barriers.length, 0);
});

test('fence artwork and brick label share the dark green translucent fence style', () => {
  const operations = [], ctx = new Proxy({ globalAlpha: 1 }, {
    get: (target, key) => key in target ? target[key] : (...args) => operations.push([key, ...args]),
    set: (target, key, value) => { operations.push([key, value]); target[key] = value; return true; },
  });
  drawBarrier(ctx, { x: 10, y: 20, nx: 0, ny: 1, length: 100 });
  assert.ok(FENCE.includes('H22'));
  assert.ok(operations.some(op => op[0] === 'strokeStyle' && op[1] === '#174f36'));
  assert.ok(operations.some(op => op[0] === 'globalAlpha' && op[1] === .65));
  assert.ok(operations.filter(op => op[0] === 'lineTo').length > 5);
  assert.match(specialLabel({ barrier: true }), /Barrier/);
});
