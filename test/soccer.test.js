const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, SOCCER_FRICTION, OBJECTS, validateCustomLevel, brickRegions, goalTiles, levelObjective } = require('../src/game.js');
const { spawnSymbol, spawnColor, drawSoccerBall } = require('../src/brick-visuals.js');
const { Tutorial, LESSONS } = require('../src/learning.js');

const blank = () => ({ version: 1, id: 'Soccer test', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [] });
function arena(options = {}, level = blank()) {
  const game = new Game(() => .5, { ...options, customLevel: level });
  game.start(); game.cat.x = 150; game.cat.y = 150;
  return game;
}
function ball(game, x = game.width / 2, y = game.height / 2) {
  const item = game.createSoccerBall({ x, y });
  game.soccerBalls.push(item); return item;
}
function roll(game, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += 1 / 120) {
    game.updateSoccerBalls(Math.min(1 / 120, seconds - t), game.cat.x, game.cat.y,
      new Map(game.robots.map(enemy => [enemy, { x: enemy.x, y: enemy.y }])));
  }
}
function edgeBrick(game, edge) {
  const regions = brickRegions(game.bricks, game.width, game.height);
  return game.bricks.filter(b => regions.get(b.id).edge === edge)
    .sort((a, b) => Math.hypot(a.x + a.w / 2 - game.width / 2, a.y + a.h / 2 - game.height / 2)
      - Math.hypot(b.x + b.w / 2 - game.width / 2, b.y + b.h / 2 - game.height / 2))[0];
}

test('soccer is a persistent neutral object, supports scheduled placements and spawners, and preserves campaigns', () => {
  const level = { ...blank(), goalsGoal: 2,
    events: [{ time: 1, kind: 'object', type: 'soccer-ball', x: .4, y: .6 }],
    brickTypes: [{ edge: 'top', start: .2, end: .3, kind: 'goal' },
      { edge: 'bottom', start: .2, end: .3, kind: 'normal', spawner: { kind: 'object', type: 'soccer-ball' } }],
  };
  assert.deepEqual(validateCustomLevel(level), level);
  const game = arena({}, level);
  assert.equal(game.soccerBalls.length, 0); game.update(1);
  assert.equal(game.soccerBalls.length, 1); assert.equal(game.robots.length, 0);
  assert.equal(game.items.length, 0); assert.equal(game.soccerBalls[0].vx, 0);
  game.spawnFromBrick(game.bricks.find(b => b.spawner));
  assert.equal(game.soccerBalls.length, 2);
  assert.equal(OBJECTS['soccer-ball'].name, 'Soccer Ball');
  assert.ok(spawnSymbol({ kind: 'object', type: 'soccer-ball' }));
  assert.equal(spawnColor({ kind: 'object', type: 'soccer-ball' }), '#f1f3f2');
  assert.ok(LEVELS.slice(0, 19).every(level => !level.goalsGoal && level.brickTypes.every(b => b.kind !== 'goal')));
});

test('soccer targets validate whole counts, combinations, survival exclusion and immutable goal modifiers', () => {
  const solo = { ...blank(), goal: 0, goalsGoal: 2 };
  assert.deepEqual(validateCustomLevel(solo), solo);
  for (const goalsGoal of [-1, .5, 100001, '2', null]) {
    assert.throws(() => validateCustomLevel({ ...solo, goalsGoal }), /Goals required/);
  }
  assert.throws(() => validateCustomLevel({ ...solo, survive: true }), /Survival cannot be combined/);
  for (const modifier of [{ warped: 4 }, { toggle: 1 }, { crumbler: 2 }, { barrier: true }, { springs: true },
    { spawner: { kind: 'object', type: 'soccer-ball' } }]) {
    assert.throws(() => validateCustomLevel({ ...blank(), brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'goal', ...modifier }] }), /Goal bricks cannot/);
  }
  assert.throws(() => validateCustomLevel({ ...blank(), events: [{ time: 0, kind: 'object', type: 'soccer-ball', x: .5, y: .5, shield: 'red' }] }), /shield/);
  assert.throws(() => validateCustomLevel({ ...blank(), events: [{ time: 0, kind: 'object', type: 'soccer-ball', x: .5, y: .5, lifetime: 5 }] }), /persist/);
  assert.match(levelObjective({ ...solo, goal: 10, killGoal: 3 }), /Collect 10 food and earn 3 enemy points and score 2 soccer goals/);
});

test('friction reduces speed by the exact rate and brings an untouched rolling ball to a complete stop', () => {
  const game = arena(), item = ball(game); item.vx = 100;
  roll(game, .5);
  assert.ok(Math.abs(item.vx - (100 - SOCCER_FRICTION * .5)) < 1e-6);
  assert.ok(Math.abs(item.x - game.width / 2 - 37.5) < 1e-6);
  roll(game, 1);
  assert.equal(item.vx, 0); assert.equal(item.vy, 0);
  const x = item.x; roll(game, 2); assert.equal(item.x, x);
  assert.ok(item.angle > 0);
});

test('moving Koshi kicks rather than picks up or damages a ball, including swept and off-center contact', () => {
  for (const offset of [0, 15, -15]) {
    const game = arena(), item = ball(game, 400, 300 + offset);
    game.cat.x = 480; game.cat.y = 300;
    game.weapon = { type: 'silver', uses: 5, expires: Infinity };
    game.combat(.4, 320, 300);
    assert.equal(game.soccerBalls.length, 1);
    assert.ok(item.vx > 0); assert.ok(item.x > 400);
    assert.equal(Math.sign(item.vy), Math.sign(offset));
    assert.equal(game.hearts, 3); assert.equal(game.score, 0); assert.equal(game.enemies, 0);
    assert.equal(game.weapon.uses, 5); assert.equal(game.pickups.length, 0);
  }
  const game = arena(), item = ball(game, 400, 300);
  game.cat.x = item.x; game.cat.y = item.y;
  roll(game, .2);
  assert.equal(item.vx, 0, 'standing still does not repeatedly launch the ball');
  for (const direction of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const game = arena(), centered = ball(game, 400, 300);
    game.cat.x = 400 + direction[0] * 42; game.cat.y = 300 + direction[1] * 42;
    game.combat(.1, 400, 300);
    assert.ok(centered.vx * direction[0] + centered.vy * direction[1] > 0,
      'moving away from a ball spawned at Koshi’s exact center kicks it along the movement direction');
  }
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  test(`balls bounce from bricks and score through only the board-facing goal mouth ${JSON.stringify(options)}`, () => {
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const game = arena(options), target = edgeBrick(game, edge);
      const [nx, ny] = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[edge];
      const cx = target.x + target.w / 2, cy = target.y + target.h / 2;
      const item = ball(game, cx - nx * 100, cy - ny * 100);
      item.vx = nx * 400; item.vy = ny * 400;
      roll(game, .4);
      assert.equal(game.goals, 0); assert.ok(item.vx * nx + item.vy * ny < 0, `${edge} brick must reflect`);
      target.kind = 'goal';
      item.x = cx - nx * 100; item.y = cy - ny * 100;
      item.vx = nx * 400; item.vy = ny * 400;
      roll(game, .4);
      assert.equal(game.goals, 1, `${edge} mouth should score`);
      assert.equal(game.soccerBalls.length, 0); assert.equal(game.goalEffects.length, 1);
      roll(game, 1); assert.equal(game.goals, 1, 'one ball scores only once');
    }
  });
}

test('goal posts reflect wide shots and merged goal mouths have no invisible seam', () => {
  const game = arena(), target = edgeBrick(game, 'top'); target.kind = 'goal';
  const item = ball(game, target.x + 4, target.y + target.h + 100); item.vy = -400;
  roll(game, .4); assert.equal(game.goals, 0); assert.ok(item.vy > 0, 'post rejects a shot without ball clearance');
  const adjacent = game.bricks.filter(b => b.y === target.y && b.id !== target.id && b.x > target.x)
    .sort((a, b) => a.x - b.x)[0];
  adjacent.kind = 'goal'; adjacent.absorbedBy = target.id;
  adjacent.initialOwner = target.id;
  const tiles = goalTiles(game.brickParts().filter(p => p.id === target.id));
  assert.equal(tiles.length, 1);
  item.x = target.x + target.w + 2; item.y = target.y + target.h + 100; item.vx = 0; item.vy = -400;
  roll(game, .4); assert.equal(game.goals, 1);
});

test('soccer balls stay inside brick faces at every corner, including escaped balls and collision push-outs', () => {
  for (const options of [{}, { portrait: true, scale: .3 }, { portrait: true, scale: .5 }]) {
    const game = arena(options), regions = brickRegions(game.bricks, game.width, game.height);
    const side = edge => game.bricks.filter(b => regions.get(b.id).edge === edge);
    const faces = {
      left: Math.max(...side('left').map(b => b.x + b.w)),
      right: Math.min(...side('right').map(b => b.x)),
      top: Math.max(...side('top').map(b => b.y + b.h)),
      bottom: Math.min(...side('bottom').map(b => b.y)),
    };
    const inside = item => {
      assert.ok(item.x >= faces.left + item.radius - 1e-6 && item.x <= faces.right - item.radius + 1e-6,
        `horizontal escape: ${JSON.stringify(options)} at ${item.x}, ${item.y}`);
      assert.ok(item.y >= faces.top + item.radius - 1e-6 && item.y <= faces.bottom - item.radius + 1e-6,
        `vertical escape: ${JSON.stringify(options)} at ${item.x}, ${item.y}`);
    };
    for (const [sx, sy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const item = ball(game);
      item.x = sx < 0 ? faces.left + item.radius + 20 : faces.right - item.radius - 20;
      item.y = sy < 0 ? faces.top + item.radius + 20 : faces.bottom - item.radius - 20;
      item.vx = sx * 650; item.vy = sy * 650;
      for (let i = 0; i < 240; i++) { roll(game, 1 / 120); inside(item); }
      item.x = sx < 0 ? 16 : game.width - 16;
      item.y = sy < 0 ? 16 : game.height - 16;
      item.vx = 0; item.vy = 0;
      roll(game, 1 / 120); inside(item);
      // An enemy moving outward from inside the corner cannot shove the ball behind the wall.
      const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'ball', x: .5, y: .5 })[0];
      enemy.x = item.x - sx * 5; enemy.y = item.y - sy * 5;
      game.robots = [enemy];
      game.updateSoccerBalls(.1, game.cat.x, game.cat.y,
        new Map([[enemy, { x: enemy.x - sx * 40, y: enemy.y - sy * 40 }]]));
      inside(item);
      game.robots = []; game.soccerBalls = [];
    }
  }
});

test('Koshi can push stationary balls out of all four corners with real brick steering', () => {
  for (const options of [{}, { portrait: true, scale: .3 }, { portrait: true, scale: .5 }]) {
    for (const [sx, sy, inset] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      .flatMap(([sx, sy]) => [0, 10].map(inset => [sx, sy, inset]))) {
      const game = arena(options);
      const regions = brickRegions(game.bricks, game.width, game.height);
      const side = edge => game.bricks.filter(brick => regions.get(brick.id).edge === edge);
      const faces = {
        left: Math.max(...side('left').map(brick => brick.x + brick.w)),
        right: Math.min(...side('right').map(brick => brick.x)),
        top: Math.max(...side('top').map(brick => brick.y + brick.h)),
        bottom: Math.min(...side('bottom').map(brick => brick.y)),
      };
      const item = ball(game);
      item.x = (sx < 0 ? faces.left : faces.right) - sx * (item.radius + inset);
      item.y = (sy < 0 ? faces.top : faces.bottom) - sy * (item.radius + inset);
      const corner = { x: item.x, y: item.y };
      game.cat.x = item.x - sx * 90; game.cat.y = item.y - sy * 90;
      game.update(.1);
      assert.equal(item.x, corner.x); assert.equal(item.y, corner.y, 'stationary balls do not escape automatically');
      const target = side(sx < 0 ? 'left' : 'right')
        .sort((a, b) => Math.abs(a.y + a.h / 2 - corner.y) - Math.abs(b.y + b.h / 2 - corner.y))[0];
      const aimX = sx < 0 ? target.x + target.w - 1 : target.x + 1;
      const aimY = Math.max(target.y, Math.min(target.y + target.h, corner.y + sy * (item.radius + 1)));
      assert.equal(game.steer(target.id, aimX, aimY), true);
      for (let i = 0; i < 120; i++) {
        game.update(1 / 120);
        assert.ok(item.x >= faces.left + item.radius - 1e-6 && item.x <= faces.right - item.radius + 1e-6);
        assert.ok(item.y >= faces.top + item.radius - 1e-6 && item.y <= faces.bottom - item.radius + 1e-6);
      }
      assert.ok((item.x - corner.x) * -sx > 25 && (item.y - corner.y) * -sy > 25,
        `ball remains stuck: ${JSON.stringify(options)}, corner ${sx},${sy}, ball ${item.x},${item.y}`);
      assert.equal(game.hearts, 3);
      assert.equal(game.goals, 0);
    }
  }
});

test('soccer balls bounce harmlessly from every enemy and Barrier fences', () => {
  for (const type of ['mouse', 'wheel', 'ram', 'bucket', 'ball', 'jackolantern']) {
    const game = arena(), item = ball(game, 400, 300);
    const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .5, y: .5 })[0];
    enemy.x = 470; enemy.y = 300; game.robots = [enemy]; item.vx = 400;
    roll(game, .2);
    assert.ok(item.vx < 0, `ball did not rebound from ${type}`);
    assert.equal(game.enemies, 0); assert.equal(enemy.x, 470); assert.equal(enemy.y, 300);
    assert.equal(enemy.shield, null);
  }
  const game = arena(), target = edgeBrick(game, 'top');
  target.barrier = true; game.barriers.push({ id: target.id, length: 400, extending: true });
  const fence = game.barrierParts()[0], item = ball(game, fence.x - 70, 250);
  item.vx = 400; roll(game, .3);
  assert.ok(item.vx < 0);
});

test('moving enemies ricochet a stationary ball without being displaced or harmed', () => {
  const game = arena(), item = ball(game, 400, 300);
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'ram', x: .5, y: .5 })[0];
  enemy.x = 450; enemy.y = 300; game.robots = [enemy];
  game.updateSoccerBalls(.2, game.cat.x, game.cat.y, new Map([[enemy, { x: 350, y: 300 }]]));
  assert.ok(item.vx > 0); assert.ok(item.x > 400);
  assert.equal(enemy.x, 450); assert.equal(game.enemies, 0); assert.equal(game.hearts, 3);
});

test('goal bricks resist selection, sunglasses, saw, stamp and warped absorption while stopping Koshi', () => {
  const game = arena(), goal = edgeBrick(game, 'right'); goal.kind = 'goal';
  assert.equal(game.brickSelectable(goal), false);
  game.collectItem({ type: 'magic-sunglasses' });
  assert.equal(game.steer(goal.id), false);
  game.collectItem({ type: 'saw-blade' });
  assert.equal(game.sawBrick(goal, game.brickParts()), false); assert.notEqual(game.sawStartedAt, null);
  game.collectItem({ type: 'ditto-stamp' });
  assert.equal(game.stampBrick(goal, game.brickParts()), false); assert.equal(game.dittoSource, null);
  const neighbor = game.bricks[game.perimeter[(game.perimeter.indexOf(goal.id) + 1) % game.perimeter.length]];
  neighbor.warped = 4; game.absorbNeighbor(neighbor);
  assert.equal(goal.absorbedBy, null);
  game.cat.x = goal.x - 60; game.cat.y = goal.y + goal.h / 2; game.cat.vx = 420;
  game.update(.3);
  assert.equal(game.cat.vx, 0); assert.equal(goal.kind, 'goal'); assert.equal(game.goals, 0);
});

test('goals combine with food and enemies, pause/reset, and scoring clouds finish after a win', () => {
  const game = arena({}, { ...blank(), goal: 2, killGoal: 1, goalsGoal: 1 });
  game.score = 2; game.enemies = 1; game.update(.01); assert.equal(game.state, 'playing');
  const goal = edgeBrick(game, 'right'); goal.kind = 'goal';
  const item = ball(game, goal.x - 25, goal.y + goal.h / 2); item.vx = 400;
  game.pause(); game.update(1); assert.equal(item.x, goal.x - 25); assert.equal(game.goals, 0);
  game.resume(); game.update(.1);
  assert.equal(game.state, 'won'); assert.equal(game.goals, 1);
  game.update(.7); assert.equal(game.goalEffects.length, 0);
  game.reset(); assert.equal(game.goals, 0); assert.equal(game.soccerBalls.length, 0);
  const solo = arena({}, { ...blank(), goal: 0, goalsGoal: 1 });
  solo.update(.01); assert.equal(solo.state, 'playing');
  solo.elapsed = solo.timeLimit - .01; solo.update(.02); assert.equal(solo.state, 'lost');
});

test('soccer tutorial can actually score with an off-center bump on desktop and portrait layouts', () => {
  for (const options of [{}, { portrait: true, scale: .3 }, { portrait: true, scale: .5 }]) {
    const tutorial = new Tutorial(); tutorial.select(LESSONS.findIndex(l => l.id === 'soccer'), options);
    const { game, target } = tutorial;
    tutorial.steer(target.id, target.x + target.w / 2, target.y + target.h / 2);
    for (let i = 0; i < 600 && game.state === 'playing'; i++) game.update(1 / 120);
    assert.equal(game.goals, 1, JSON.stringify(options));
    assert.equal(tutorial.observe(), true);
  }
});

test('shared soccer artwork is black and white with pentagonal patches and balanced canvas state', () => {
  const operations = [];
  const ctx = new Proxy({}, { get: (_, key) => key === 'createRadialGradient'
    ? () => ({ addColorStop: (...args) => operations.push(['color', ...args]) })
    : (...args) => operations.push([key, ...args]), set: (_, key, value) => { operations.push([key, value]); return true; } });
  drawSoccerBall(ctx, { x: 10, y: 20, angle: .5, radius: 16 });
  assert.equal(operations.filter(op => op[0] === 'save').length, operations.filter(op => op[0] === 'restore').length);
  assert.ok(operations.some(op => op[0] === 'fillStyle' && op[1] === '#20272e'));
  assert.equal(operations.filter(op => op[0] === 'closePath').length, 6);
  assert.ok(operations.some(op => op[0] === 'rotate' && op[1] === .5));
});
