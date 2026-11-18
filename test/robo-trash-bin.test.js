const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, CHARACTERS, LEVELS, validateCustomLevel, brickRegions, obstructionSurface } = require('../src/game.js');

const level = events => ({
  version: 1, id: 'Trash bin test', duration: 60, goal: 1000,
  heartCost: null, brickSet: 1, events,
});
function arena(random = () => .5) {
  const game = new Game(random, { customLevel: level([]) });
  game.start();
  return game;
}
function bin(game) {
  return game.createCustomSpawn({ kind: 'enemy', type: 'robo-trash-bin', x: .5, y: .5 })[0];
}

test('trash bins are available for custom events and spawners without changing the campaign', () => {
  assert.equal(CHARACTERS['robo-trash-bin'], 'Robo Trash Bin');
  const custom = level([{ time: 0, kind: 'enemy', type: 'robo-trash-bin', x: .5, y: .5 }]);
  custom.brickTypes = [{ edge: 'top', start: 0, end: 1, kind: 'normal', spawner: { kind: 'enemy', type: 'robo-trash-bin' } }];
  const validated = validateCustomLevel(custom);
  assert.equal(validated.events[0].type, 'robo-trash-bin');
  assert.equal(validated.brickTypes[0].spawner.type, 'robo-trash-bin');
  assert.ok(LEVELS.every(entry => !entry.enemies?.some(([, type]) => type === 'robo-trash-bin')));
  const game = arena();
  const brick = game.bricks[0];
  brick.spawner = { kind: 'enemy', type: 'robo-trash-bin' };
  game.spawnFromBrick(brick);
  assert.equal(game.robots[0].binState, 'roam');
});

test('waits 3–5 seconds, selects eligible bricks and uses all three color intervals', () => {
  for (const [roll, color] of [[0, 'red'], [.34, 'green'], [.99, 'blue']]) {
    const game = arena(() => roll), enemy = bin(game);
    assert.ok(enemy.binWait >= 3 && enemy.binWait < 5);
    for (const brick of game.bricks) brick.slimed = true;
    const [target, cinder, goal] = game.bricks;
    target.slimed = false;
    cinder.slimed = false; cinder.kind = 'cinder';
    goal.slimed = false; goal.kind = 'goal';
    enemy.binWait = .1;
    game.updateTrashBin(enemy, .09, game.bounds());
    assert.equal(enemy.binState, 'roam');
    game.updateTrashBin(enemy, .01, game.bounds());
    assert.equal(enemy.binTarget, target.id);
    assert.equal(enemy.binColor, color);
    assert.equal(enemy.binState, 'travel');
  }
});

test('pour takes three seconds at the target, replaces surfaces on the whole group, and fades in', () => {
  const game = arena(), enemy = bin(game), brick = game.bricks[0], member = game.bricks[1];
  member.absorbedBy = brick.id;
  brick.springs = true; member.springs = true;
  brick.barrier = true;
  game.barriers.push({ id: brick.id });
  enemy.binState = 'travel';
  enemy.binTarget = brick.id;
  enemy.binColor = 'blue';
  enemy.binDestination = { x: enemy.x + 75, y: enemy.y };
  enemy.binPourPoint = { x: brick.x, y: brick.y };
  game.updateTrashBin(enemy, 1, game.bounds());
  assert.equal(enemy.binState, 'prepare');
  assert.equal(enemy.binPourTime, 0);
  game.updateTrashBin(enemy, .3, game.bounds());
  assert.equal(enemy.binTilt, .5);
  assert.ok(!brick.slimed);
  game.updateTrashBin(enemy, .3, game.bounds());
  assert.equal(enemy.binState, 'pour');
  assert.equal(enemy.binTilt, 1);
  game.updateTrashBin(enemy, 2.99, game.bounds());
  assert.ok(!brick.slimed);
  game.elapsed = 10;
  game.updateTrashBin(enemy, .01, game.bounds());
  for (const part of [brick, member]) {
    assert.equal(part.slimed, true);
    assert.equal(part.slimeColor, 'blue');
    assert.equal(part.springs, false);
    assert.equal(part.barrier, false);
    assert.equal(part.slimeAppliedAt, 10);
  }
  assert.equal(game.barriers.length, 0);
  assert.equal(game.brickRevision, 1);
  assert.equal(enemy.binState, 'recover');
  assert.ok(Math.abs(enemy.binTilt - 1) < 1e-9);
  game.updateTrashBin(enemy, .3, game.bounds());
  assert.ok(Math.abs(enemy.binTilt - .5) < 1e-9);
  game.updateTrashBin(enemy, .3, game.bounds());
  assert.equal(enemy.binState, 'roam');
  assert.equal(enemy.binTilt, 0);
});

test('trash bins approach each wall with their wheels facing the brick', () => {
  for (const portrait of [false, true]) for (const edge of ['top', 'bottom', 'left', 'right']) {
    const game = new Game(() => .5, { customLevel: level([]), portrait });
    game.start();
    const enemy = bin(game), regions = brickRegions(game.bricks, game.width, game.height);
    const target = game.bricks.find(brick => regions.get(brick.id).edge === edge);
    for (const brick of game.bricks) brick.slimed = brick !== target;
    enemy.binWait = 0;
    game.updateTrashBin(enemy, .01, game.bounds());
    const expected = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[edge];
    assert.ok(Math.abs(-Math.sin(enemy.binAngle) - expected[0]) < 1e-9, `${edge}: wheel direction x`);
    assert.ok(Math.abs(Math.cos(enemy.binAngle) - expected[1]) < 1e-9, `${edge}: wheel direction y`);
    const openingX = enemy.binDestination.x + 21 * expected[1];
    const openingY = enemy.binDestination.y - 21 * expected[0];
    const dx = enemy.binPourPoint.x - openingX, dy = enemy.binPourPoint.y - openingY;
    assert.ok(dx * expected[0] + dy * expected[1] > 0, `${edge}: brick lies in front of wheels`);
    assert.ok(Math.abs(dx * expected[1] - dy * expected[0]) < 1e-9, `${edge}: pour is perpendicular`);
  }
});

test('bins claim distinct bricks and release claims when canceled, completed, or defeated', () => {
  for (const reason of ['fear', 'invalid', 'complete', 'death']) {
    const game = arena(() => 0), first = bin(game), second = bin(game), third = bin(game);
    game.robots.push(first, second, third);
    for (const brick of game.bricks) brick.slimed = true;
    const [one, two] = game.bricks;
    one.slimed = false; two.slimed = false;
    first.binWait = second.binWait = third.binWait = 0;
    game.updateTrashBin(first, .01, game.bounds());
    game.updateTrashBin(second, .01, game.bounds());
    game.updateTrashBin(third, .01, game.bounds());
    assert.equal(first.binTarget, one.id);
    assert.equal(second.binTarget, two.id);
    assert.equal(third.binTarget, null);
    assert.equal(game.trashBinClaims.size, 2);
    if (reason === 'fear') game.initializeTrashBin(first);
    if (reason === 'invalid') {
      one.kind = 'cinder';
      game.updateTrashBin(first, .01, game.bounds());
      one.kind = 'normal';
    }
    if (reason === 'death') game.defeatEnemy(first);
    if (reason === 'complete') {
      Object.assign(first, { binState: 'pour', x: first.binDestination.x, y: first.binDestination.y, binPourTime: 0 });
      game.updateTrashBin(first, 3, game.bounds());
      one.slimed = false;
    }
    assert.equal(game.trashBinClaims.has(one.id), false, reason);
    third.binWait = 0;
    game.updateTrashBin(third, .01, game.bounds());
    assert.equal(third.binTarget, one.id, reason);
  }
});

test('a newly merged target cannot be claimed even before its original owner updates', () => {
  const game = arena(() => 0), first = bin(game), second = bin(game);
  for (const brick of game.bricks) brick.slimed = true;
  const [owner, member] = game.bricks;
  owner.slimed = true; member.slimed = false;
  first.binWait = 0;
  game.updateTrashBin(first, .01, game.bounds());
  owner.slimed = false; member.absorbedBy = owner.id;
  second.binWait = 0;
  game.updateTrashBin(second, .01, game.bounds());
  assert.equal(second.binTarget, null);
});

test('blocked bins wander for two seconds before trying other bricks', () => {
  const game = arena(() => 0), enemy = bin(game);
  const targets = game.bricks.slice(0, 3);
  for (const brick of game.bricks) brick.slimed = !targets.includes(brick);
  game.cat.x = game.cat.y = 100;
  game.obstructions.push(game.createObstruction({ x: 400, y: 300 },
    { type: 'obstruction-circle', width: 100 }));
  game.robots.push(enemy);
  const blockRoute = brick => {
    Object.assign(enemy, { x: 331, y: 300, binState: 'travel', binTarget: brick.id,
      binDestination: { x: 650, y: 300 }, binProgressTime: 0, binProgress: 0 });
    game.trashBinClaims.set(brick.id, enemy);
  };
  const step = () => game.combat(.1, game.cat.x, game.cat.y);
  blockRoute(targets[0]);
  for (let i = 0; i < 5; i++) step();
  const progressTime = enemy.binProgressTime;
  game.enemiesSleepUntil = 10;
  for (let i = 0; i < 20; i++) step();
  assert.equal(enemy.binProgressTime, progressTime, 'sleep pauses the stuck timer');
  assert.equal(enemy.binTarget, targets[0].id);
  game.enemiesSleepUntil = 0;
  for (let i = 0; i < 20 && enemy.binState === 'travel'; i++) step();
  assert.equal(enemy.binState, 'escape');
  assert.equal(game.trashBinClaims.has(targets[0].id), false);
  const blocked = { x: enemy.x, y: enemy.y };
  game.enemiesSleepUntil = 10;
  for (let i = 0; i < 10; i++) step();
  assert.equal(enemy.binEscapeTime, 2, 'sleep pauses the escape');
  game.enemiesSleepUntil = 0;
  for (let i = 0; i < 19; i++) step();
  assert.equal(enemy.binState, 'escape');
  assert.equal(enemy.binTarget, null, 'no target is claimed during escape');
  assert.ok(Math.hypot(enemy.x - blocked.x, enemy.y - blocked.y) > 40, 'the bin moves away');
  step();
  assert.equal(enemy.binTarget, targets[1].id);
  blockRoute(targets[1]);
  for (let i = 0; i < 20 && enemy.binState === 'travel'; i++) step();
  assert.equal(enemy.binState, 'escape');
  assert.equal(game.trashBinClaims.has(targets[1].id), false);
  for (let i = 0; i < 20; i++) step();
  assert.equal(enemy.binTarget, targets[2].id);
  Object.assign(enemy, { x: 331, y: 300, binDestination: { x: 100, y: 300 } });
  for (let i = 0; i < 15; i++) step();
  assert.equal(enemy.binTarget, targets[2].id, 'a moving bin keeps its target');
  assert.ok(enemy.x < 250, 'the bin moves away from the obstruction');
  assert.equal(enemy.binBlockedTargets.size, 0, 'progress permits previously blocked bricks again');
});

test('a blocked bin can retry its only eligible brick', () => {
  const game = arena(() => 0), enemy = bin(game), target = game.bricks[0];
  for (const brick of game.bricks) brick.slimed = brick !== target;
  enemy.binBlockedTargets.add(target.id);
  enemy.binLastBlockedTarget = target.id;
  enemy.binWait = 0;
  game.updateTrashBin(enemy, .01, game.bounds());
  assert.equal(enemy.binTarget, target.id);
  assert.equal(game.trashBinClaims.get(target.id), enemy);
});

test('a bin cannot begin pouring when an obstruction blocks its destination', () => {
  const game = arena(), enemy = bin(game), target = game.bricks[0];
  game.cat.x = game.cat.y = 100;
  game.obstructions.push(game.createObstruction({ x: 400, y: 300 },
    { type: 'obstruction-circle', width: 100 }));
  Object.assign(enemy, { x: 331, y: 300, binState: 'travel', binTarget: target.id,
    binDestination: { x: 333, y: 300 } });
  game.trashBinClaims.set(target.id, enemy);
  game.robots.push(enemy);
  for (let i = 0; i < 120; i++) game.combat(1 / 120, game.cat.x, game.cat.y);
  assert.equal(enemy.binState, 'escape');
  assert.equal(enemy.binTarget, null);
  assert.equal(game.trashBinClaims.has(target.id), false);
  assert.ok(!target.slimed);
});

test('slow sliding retargets below 15% of normal speed but not above it', () => {
  for (const fraction of [.14, .16]) {
    const game = arena(() => 0), enemy = bin(game), target = game.bricks[0];
    game.cat.x = game.cat.y = 100;
    game.obstructions.push(game.createObstruction({ x: 400, y: 300 },
      { type: 'obstruction-rectangle', width: 100, height: 400 }));
    Object.assign(enemy, { x: 331, y: 300, binState: 'travel', binTarget: target.id,
      binDestination: { x: 3331, y: 300 + 3000 * fraction / Math.sqrt(1 - fraction ** 2) } });
    game.trashBinClaims.set(target.id, enemy);
    game.robots.push(enemy);
    const startY = enemy.y;
    for (let i = 0; i < 120; i++) game.combat(1 / 120, game.cat.x, game.cat.y);
    const speed = enemy.y - startY;
    assert.ok(speed > 0, 'the bin slides rather than stopping');
    if (fraction < .15) {
      assert.ok(speed < 75 * .15);
      assert.equal(enemy.binTarget, null);
      assert.equal(enemy.binState, 'escape');
      assert.equal(game.trashBinClaims.has(target.id), false);
    } else {
      assert.ok(speed > 75 * .15);
      assert.equal(enemy.binTarget, target.id);
    }
  }
});

test('a blocked escape changes direction and moves away before selecting a brick', () => {
  const game = arena(() => 0), enemy = bin(game);
  game.cat.x = game.cat.y = 100;
  game.obstructions.push(game.createObstruction({ x: 400, y: 300 },
    { type: 'obstruction-rectangle', width: 100, height: 400 }));
  Object.assign(enemy, { x: 331, y: 300, binState: 'escape', binEscapeTime: 2, phase: 0 });
  game.robots.push(enemy);
  for (let i = 0; i < 120; i++) game.combat(1 / 120, game.cat.x, game.cat.y);
  assert.ok(enemy.x < 310, 'the bin turns away from the obstruction');
  assert.equal(enemy.binState, 'escape');
  assert.equal(enemy.binTarget, null);
  for (let i = 0; i < 120; i++) game.combat(1 / 120, game.cat.x, game.cat.y);
  assert.equal(enemy.binState, 'travel');
  assert.notEqual(enemy.binTarget, null);
});

test('a bin stuck while roaming also escapes away from the obstruction', () => {
  const game = arena(() => 0), enemy = bin(game);
  game.cat.x = game.cat.y = 100;
  game.obstructions.push(game.createObstruction({ x: 400, y: 300 },
    { type: 'obstruction-rectangle', width: 100, height: 400 }));
  Object.assign(enemy, { x: 331, y: 300, binState: 'roam', binWait: 50, phase: 0, age: 1.4 });
  game.robots.push(enemy);
  for (let i = 0; i < 120; i++) game.combat(1 / 120, game.cat.x, game.cat.y);
  assert.equal(enemy.binState, 'escape');
  assert.equal(enemy.binTarget, null);
  const stuckX = enemy.x;
  for (let i = 0; i < 120; i++) game.combat(1 / 120, game.cat.x, game.cat.y);
  assert.ok(enemy.x < stuckX - 40, 'the bin moves away during its escape');
});

test('escape direction clears an angled obstruction and the adjacent brick boundary', () => {
  for (const roll of [0, .13, .5, .99]) {
    const game = arena(() => roll), enemy = bin(game);
    game.cat.x = game.cat.y = 100;
    const obstacle = game.createObstruction({ x: 640.57, y: 142.86 },
      { type: 'obstruction-rectangle', width: 192, height: 48, rotation: 45 });
    game.obstructions.push(obstacle);
    Object.assign(enemy, { x: 636.56, y: 78.04 });
    game.robots.push(enemy);
    game.startTrashBinEscape(enemy);
    const { nx, ny, gap } = obstructionSurface(enemy.x, enemy.y, obstacle);
    const dx = Math.cos(enemy.phase), dy = Math.sin(enemy.phase);
    assert.ok(dx * nx + dy * ny > .1, 'direction points away from the obstruction');
    assert.ok(dy > .1, 'direction points away from the top bricks');
    for (let i = 0; i < 120; i++) game.combat(1 / 120, game.cat.x, game.cat.y);
    assert.ok(obstructionSurface(enemy.x, enemy.y, obstacle).gap > gap + 10);
    assert.ok(enemy.y > 88, 'the bin moves away from the boundary');
  }
});

test('escape direction accounts for nearby obstructions and other enemies', () => {
  const game = arena(() => 0), enemy = bin(game), other = bin(game);
  game.obstructions.push(game.createObstruction({ x: 400, y: 300 },
    { type: 'obstruction-rectangle', width: 100, height: 400 }));
  Object.assign(enemy, { x: 331, y: 300 });
  Object.assign(other, { x: 331, y: 338 });
  game.robots.push(enemy, other);
  game.chooseTrashBinEscapeDirection(enemy);
  assert.ok(Math.cos(enemy.phase) < -.1, 'points away from the obstruction');
  assert.ok(Math.sin(enemy.phase) < -.1, 'points away from the other enemy');
});

test('a bin at the gap between adjacent circular obstructions moves away from both', () => {
  const game = arena(() => 0), enemy = bin(game);
  game.cat.x = game.cat.y = 100;
  for (let i = 0; i < 6; i++) {
    game.obstructions.push(game.createObstruction({ x: 386.9 + i * 38.89, y: 202.23 + i * 38.89 },
      { type: 'obstruction-circle', width: 48 }));
  }
  const first = game.obstructions[3], second = game.obstructions[4];
  const offset = Math.sqrt((enemy.radius + first.radius + .001) ** 2 / 2 - (38.89 / 2) ** 2);
  Object.assign(enemy, { x: (first.x + second.x) / 2 - offset,
    y: (first.y + second.y) / 2 + offset });
  game.robots.push(enemy);
  game.startTrashBinEscape(enemy);
  for (const obstacle of [first, second]) {
    const { nx, ny } = obstructionSurface(enemy.x, enemy.y, obstacle);
    assert.ok(Math.cos(enemy.phase) * nx + Math.sin(enemy.phase) * ny > .1);
  }
  const start = { x: enemy.x, y: enemy.y };
  for (let i = 0; i < 120; i++) game.combat(1 / 120, game.cat.x, game.cat.y);
  assert.ok(Math.hypot(enemy.x - start.x, enemy.y - start.y) > 60);
});

test('obstructions cannot push bins into boundary bricks in either orientation', () => {
  for (const [portrait, scale] of [[false, 1], [false, 2], [true, 1], [true, 2]]) {
    for (const edge of ['left', 'right', 'top', 'bottom']) {
      const game = new Game(() => 0, { customLevel: level([]), portrait, scale });
      game.start();
      game.cat.x = game.cat.y = 200;
      const enemy = bin(game), bounds = game.trashBinBounds(enemy);
      const center = { x: game.width / 2, y: game.height / 2 };
      const normal = { left: [1, 0], right: [-1, 0], top: [0, 1], bottom: [0, -1] }[edge];
      enemy.x = normal[0] ? bounds[edge] + normal[0] : center.x;
      enemy.y = normal[1] ? bounds[edge] + normal[1] : center.y;
      const obstacle = game.createObstruction({ x: enemy.x + normal[0] * 40, y: enemy.y + normal[1] * 40 },
        { type: 'obstruction-circle', width: 100 });
      game.obstructions.push(obstacle);
      game.robots.push(enemy);
      enemy.binWait = 100;
      for (let frame = 0; frame < 60; frame++) {
        game.combat(1 / 120, game.cat.x, game.cat.y);
        for (const part of game.brickParts()) {
          const x = Math.max(part.x, Math.min(part.x + part.w, enemy.x));
          const y = Math.max(part.y, Math.min(part.y + part.h, enemy.y));
          assert.ok(Math.hypot(enemy.x - x, enemy.y - y) >= enemy.radius - 1e-6,
            `${edge}, portrait=${portrait}, scale=${scale}: bin penetrated brick`);
        }
      }
    }
  }
});

test('bins can still reach and slime every wall with brick containment', () => {
  for (const [portrait, scale] of [[false, 1], [false, 2], [true, 1], [true, 2]]) {
    for (const edge of ['left', 'right', 'top', 'bottom']) {
      const game = new Game(() => 0, { customLevel: level([]), portrait, scale });
      game.start();
      game.cat.x = game.cat.y = 100;
      const regions = brickRegions(game.bricks, game.width, game.height);
      const target = game.bricks.find(brick => regions.get(brick.id).edge === edge);
      for (const brick of game.bricks) brick.slimed = brick !== target;
      const enemy = bin(game);
      enemy.binWait = 0;
      game.robots.push(enemy);
      for (let frame = 0; frame < 900 && !target.slimed; frame++) {
        game.combat(1 / 60, game.cat.x, game.cat.y);
      }
      assert.ok(target.slimed, `${edge}, portrait=${portrait}, scale=${scale}: target was not slimed`);
    }
  }
});

test('a wall-constrained bin keeps its previous clear position instead of entering an obstruction', () => {
  const game = arena(), enemy = bin(game), bounds = game.trashBinBounds(enemy);
  const obstacle = game.createObstruction({ x: bounds.left + 60, y: 300 },
    { type: 'obstruction-circle', width: 100 });
  game.obstructions.push(obstacle);
  const old = { x: bounds.left + 10, y: 360 };
  Object.assign(enemy, { x: bounds.left - 10, y: 300 });
  game.containTrashBin(enemy, old);
  assert.deepEqual({ x: enemy.x, y: enemy.y }, old);
  assert.ok(obstructionSurface(enemy.x, enemy.y, obstacle).gap >= enemy.radius - 1e-6);
});

test('random priorities remain stable and higher priority bins push lower priority bins at corners', () => {
  const game = arena(() => .5), leader = bin(game), yielding = bin(game), bounds = game.bounds();
  assert.equal(leader.binPriority, yielding.binPriority);
  assert.ok(leader.binPriorityOrder < yielding.binPriorityOrder);
  Object.assign(leader, { x: bounds.right - 30, y: bounds.top });
  Object.assign(yielding, { x: bounds.right, y: bounds.top });
  const position = { x: leader.x, y: leader.y }, priority = leader.binPriority;
  game.separateEnemyPair(leader, yielding, -1, 0, 8.000001);
  assert.deepEqual({ x: leader.x, y: leader.y }, position);
  assert.ok(Math.hypot(leader.x - yielding.x, leader.y - yielding.y) >= 38 - 1e-7);
  assert.ok(yielding.y > bounds.top);
  game.initializeTrashBin(leader);
  assert.equal(leader.binPriority, priority);
  const higher = bin(game);
  higher.binPriority = .9;
  Object.assign(higher, { x: 200, y: 200 });
  Object.assign(leader, { x: 220, y: 200 });
  const before = { x: higher.x, y: higher.y };
  game.separateEnemyPair(leader, higher, 1, 0, 18.000001);
  assert.deepEqual({ x: higher.x, y: higher.y }, before);
  assert.ok(leader.x > 220);
});

test('bin collision resolution preserves the higher-priority movement step', () => {
  const game = arena(), leader = bin(game), yielding = bin(game);
  leader.binPriority = .9; yielding.binPriority = .1;
  Object.assign(leader, { x: 200, y: 200 });
  Object.assign(yielding, { x: 240, y: 200 });
  game.robots.push(leader, yielding);
  const previous = new Map(game.robots.map(enemy => [enemy, { x: enemy.x, y: enemy.y }]));
  leader.x += 10;
  game.resolveEnemyCollisions(previous);
  assert.equal(leader.x, 210);
  assert.ok(yielding.x > 240);
  assert.ok(Math.hypot(leader.x - yielding.x, leader.y - yielding.y) >= 38 - 1e-7);
});

test('a large update carries time across approach, tilt, pour, and recovery without shortening the pour', () => {
  const game = arena(), enemy = bin(game), brick = game.bricks[0];
  Object.assign(enemy, { binState: 'travel', binTarget: brick.id, binColor: 'red',
    binDestination: { x: enemy.x + 75, y: enemy.y } });
  game.updateTrashBin(enemy, 1 + .6 + 2.9, game.bounds());
  assert.equal(enemy.binState, 'pour');
  assert.ok(Math.abs(enemy.binPourTime - 2.9) < 1e-9);
  assert.ok(!brick.slimed);
  game.updateTrashBin(enemy, .4, game.bounds());
  assert.equal(enemy.binState, 'recover');
  assert.ok(brick.slimed);
  assert.ok(Math.abs(enemy.binTilt - .5) < 1e-9);
  game.updateTrashBin(enemy, .3, game.bounds());
  assert.equal(enemy.binState, 'roam');
});

test('invalidated targets cancel pours and no eligible bricks are handled', () => {
  const game = arena(), enemy = bin(game);
  for (const brick of game.bricks) brick.slimed = true;
  enemy.binWait = 0;
  game.updateTrashBin(enemy, .1, game.bounds());
  assert.equal(enemy.binState, 'roam');
  assert.ok(enemy.binWait >= 3 && enemy.binWait <= 5);
  const brick = game.bricks[0];
  brick.slimed = false;
  enemy.binState = 'pour'; enemy.binTarget = brick.id; enemy.binPourTime = 2.9;
  brick.kind = 'goal';
  game.updateTrashBin(enemy, .2, game.bounds());
  assert.equal(brick.slimed, false);
  assert.equal(enemy.binState, 'roam');
});

test('converting a portal removes its partner and an occupied turret is exited', () => {
  for (const surface of ['portal', 'turret']) {
    const game = arena(), enemy = bin(game), brick = game.bricks[0], partner = game.bricks[1];
    if (surface === 'portal') { brick.portal = 'red'; partner.portal = 'red'; }
    else {
      brick.turret = 'laser';
      game.touchTurret(brick);
      assert.equal(game.activeTurret.brickId, brick.id);
    }
    Object.assign(enemy, { binState: 'pour', binTarget: brick.id, binColor: 'green',
      binDestination: { x: enemy.x, y: enemy.y }, binPourTime: 0 });
    game.updateTrashBin(enemy, 3, game.bounds());
    assert.equal(brick.slimed, true);
    assert.equal(brick[surface], null);
    if (surface === 'portal') assert.equal(partner.portal, null);
    else assert.equal(game.activeTurret, null);
  }
});

test('scrolling boards target visible bricks and cancel if the target leaves view', () => {
  const custom = level([]);
  custom.autoscroll = { length: 24, speed: .5, events: [] };
  const game = new Game(() => .99, { customLevel: custom });
  game.start();
  const enemy = bin(game);
  enemy.binWait = 0;
  game.updateTrashBin(enemy, .01, game.bounds());
  const brick = game.bricks[enemy.binTarget];
  assert.ok(game.brickVisible(brick));
  game.elapsed = 50;
  assert.equal(game.brickVisible(brick), false);
  game.updateTrashBin(enemy, .01, game.bounds());
  assert.notEqual(enemy.binTarget, brick.id);
  assert.ok(!brick.slimed);
});

test('sleep pauses pouring, fear cancels it, and defeat spills randomized garbage', () => {
  const game = arena(), enemy = bin(game), brick = game.bricks[0];
  game.robots.push(enemy);
  enemy.binState = 'pour'; enemy.binTarget = brick.id; enemy.binColor = 'red';
  enemy.binDestination = { x: enemy.x, y: enemy.y }; enemy.binPourTime = 1;
  game.enemiesSleepUntil = 10;
  game.combat(.5, game.cat.x, game.cat.y);
  assert.equal(enemy.binPourTime, 1);
  game.enemiesSleepUntil = 0;
  game.maskPickup = {}; game.maskUntil = 10;
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(enemy.binState, 'roam');
  assert.equal(enemy.binPourTime, 0);
  game.defeatEnemy(enemy);
  assert.equal(game.enemyDeaths[0].trashPieces.length, 7);
  game.updateEnemyDeaths(1);
  assert.equal(game.enemyDeaths[0].deathProgress, .5);
  game.updateEnemyDeaths(1);
  assert.equal(game.enemyDeaths.length, 0);
});

test('sleep freezes both tilt transitions', () => {
  for (const state of ['prepare', 'recover']) {
    const game = arena(), enemy = bin(game), brick = game.bricks[0];
    Object.assign(enemy, { binState: state, binTarget: brick.id, binAngle: 0, binTilt: .5,
      binPhaseTime: .3, binDestination: { x: enemy.x, y: enemy.y } });
    if (state === 'recover') brick.slimed = true;
    game.robots.push(enemy);
    game.enemiesSleepUntil = 10;
    game.combat(.2, game.cat.x, game.cat.y);
    assert.equal(enemy.binPhaseTime, .3);
    assert.equal(enemy.binTilt, .5);
    game.enemiesSleepUntil = 0;
    game.combat(.1, game.cat.x, game.cat.y);
    assert.ok(state === 'prepare' ? enemy.binTilt > .5 : enemy.binTilt < .5);
  }
});

test('colored stream appears only during the pour and starts at the tilted opening', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, key) { return key in target ? target[key] : (...args) => calls.push([key, ...args]); },
  });
  const enemy = { type: 'robo-trash-bin', x: 100, y: 200, binAngle: 0,
    binColor: 'blue', binPourPoint: { x: 121, y: 240 } };
  const context = vm.createContext({ ctx, visibleRobots: [enemy], robotDrawOrder: items => items,
    drawRobot() {}, game: { enemyDamageProgress() {} }, SLIMES: { blue: { color: '#287dcc' } } });
  const render = source.slice(source.indexOf('  for (const enemy of robotDrawOrder(visibleRobots)) {'),
    source.indexOf('  for (const enemy of robotDrawOrder(game.enemyDeaths'));
  for (const state of ['prepare', 'pour', 'recover']) {
    calls.length = 0;
    enemy.binState = state;
    vm.runInContext(render, context);
    const moves = calls.filter(call => call[0] === 'moveTo');
    if (state === 'pour') {
      assert.equal(moves.length, 1);
      assert.ok(Math.abs(moves[0][1] - 121) < 1e-9);
      assert.ok(Math.abs(moves[0][2] - 200) < 1e-9);
      const end = calls.find(call => call[0] === 'lineTo');
      assert.ok(Math.abs(end[1] - 121) < 1e-9);
      assert.ok(Math.abs(end[2] - 240) < 1e-9);
      assert.equal(calls.filter(call => call[0] === 'arc').length, 10);
      assert.equal(ctx.strokeStyle, '#287dcc');
      assert.equal(ctx.lineWidth, 14);
    } else assert.equal(moves.length, 0);
  }
  for (const [angle, nx, ny] of [[0, 0, 1], [Math.PI, 0, -1], [Math.PI / 2, -1, 0], [-Math.PI / 2, 1, 0]]) {
    calls.length = 0;
    enemy.binAngle = angle;
    enemy.binState = 'pour';
    const openingX = enemy.x + 21 * ny, openingY = enemy.y - 21 * nx;
    enemy.binPourPoint = { x: openingX + 40 * nx, y: openingY + 40 * ny };
    vm.runInContext(render, context);
    const start = calls.find(call => call[0] === 'moveTo'), end = calls.find(call => call[0] === 'lineTo');
    assert.ok(Math.abs(start[1] - openingX) < 1e-9);
    assert.ok(Math.abs(start[2] - openingY) < 1e-9);
    assert.ok(Math.abs(end[1] - enemy.binPourPoint.x) < 1e-9);
    assert.ok(Math.abs(end[2] - enemy.binPourPoint.y) < 1e-9);
  }
});

test('bin artwork renders body, opening lid and spilled shapes', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const calls = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, key) { return key in target ? target[key] : (...args) => calls.push([key, ...args]); },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawRoboTrashBin('), source.indexOf('function drawRoboKoshi(')), context);
  const enemy = { age: 1, trashPieces: [{ angle: 0, speed: 30, size: 4, shape: 0 }] };
  context.drawRoboTrashBin(enemy);
  assert.ok(calls.filter(call => call[0] === 'fillRect').length >= 3);
  calls.length = 0;
  context.drawRoboTrashBin({ age: 1, binState: 'escape', binAngle: Math.PI });
  assert.ok(Math.abs(calls.find(call => call[0] === 'rotate')[1] - Math.sin(3) * .12) < 1e-9);
  calls.length = 0;
  context.drawRoboTrashBin(enemy, .5);
  assert.ok(calls.some(call => call[0] === 'rotate' && call[1] < -1));
  assert.ok(calls.some(call => call[0] === 'fillRect' && call[3] === 8));
  calls.length = 0;
  context.drawRoboTrashBin({ binState: 'prepare', binAngle: Math.PI, binTilt: .5 });
  const rotations = calls.filter(call => call[0] === 'rotate').map(call => call[1]);
  assert.ok(Math.abs(rotations[0] - 1.25 * Math.PI) < 1e-9);
  assert.ok(Math.abs(rotations[1] + .6) < 1e-9);
  for (const [distance, expected] of [[120, 0], [100, 0], [50, Math.PI / 4], [0, Math.PI / 2]]) {
    calls.length = 0;
    context.drawRoboTrashBin({ x: distance, y: 0, age: 0, binState: 'travel',
      binAngle: Math.PI / 2, binDestination: { x: 0, y: 0 }, binTurnDistance: 100 });
    const rotation = calls.find(call => call[0] === 'rotate')[1];
    assert.ok(Math.abs(rotation - expected) < 1e-9);
  }
});
