const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, CHARACTERS, COW_EAT_DURATION, brickRegions, validateCustomLevel } = require('../src/game.js');

const level = events => ({
  version: 1, id: 'Robo Cow tests', duration: 60, goal: 1000,
  heartCost: null, brickSet: 1, events,
});

function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: level([]) });
  game.start();
  return game;
}

test('Robo Cow is available in custom placements and brick spawners without campaign placements', () => {
  assert.equal(CHARACTERS['robo-cow'], 'Robo Cow');
  const placement = { time: 0, kind: 'enemy', type: 'robo-cow', x: .5, y: 0 };
  assert.equal(validateCustomLevel(level([placement])).events[0].type, 'robo-cow');
  assert.ok(LEVELS.filter(level => level.worldId !== '3').every(campaign => !campaign.enemies.some(([, type]) => type === 'robo-cow')));

  const game = arena();
  const cow = game.createCustomSpawn(placement)[0];
  const bounds = game.bounds();
  assert.ok(cow.x === bounds.left || cow.x === bounds.right || cow.y === bounds.top || cow.y === bounds.bottom);
  const averageLength = 2 * (bounds.right - bounds.left + bounds.bottom - bounds.top) / game.perimeter.length;
  assert.equal(cow.cowWalkRemaining, 4 * averageLength, 'four average brick lengths is the most likely distance');
  assert.equal(cow.cowTargetId, null, 'the brick is chosen only after walking');
});

test('Robo Cow follows the perimeter at twice Robo Wheel speed', () => {
  const game = arena();
  const cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  cow.cowEating = false;
  cow.cowWalkRemaining = 300;
  const start = cow.distance;
  game.robots.push(cow);
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(cow.distance, start + cow.cowDirection * 19);
  assert.ok(cow.x === game.bounds().left || cow.x === game.bounds().right
    || cow.y === game.bounds().top || cow.y === game.bounds().bottom);
});

test('eating cows cannot be moved by any enemy head or snake body in either collision order', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    for (const type of ['mouse', 'wheel', 'ram', 'bucket', 'ball', 'jackolantern', 'snake', 'goalie', 'robo-koshi', 'robo-snail', 'robo-cow', 'robo-unicorn']) {
      for (const reversed of [false, true]) {
        const game = arena(options);
        const cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .5, y: 0 })[0];
        cow.cowEating = true; cow.cowEatTime = 1;
        const other = game.createCustomSpawn({ kind: 'enemy', type, x: .5, y: 0 })[0];
        if (['wheel', 'snake', 'robo-cow'].includes(type)) {
          other.distance = cow.distance + (type === 'snake' ? 38 : 10);
          game.placeWheel(other);
        } else { other.x = cow.x + 8; other.y = cow.y; }
        game.robots = reversed ? [other, cow] : [cow, other];
        const origin = { x: cow.x, y: cow.y, distance: cow.distance };
        const previous = new Map(game.robots.map(enemy => [enemy, { ...enemy }]));
        game.resolveEnemyCollisions(previous);
        game.resolveSnakeBodyCollisions(previous);
        assert.deepEqual({ x: cow.x, y: cow.y, distance: cow.distance }, origin, `${type}, reversed=${reversed}`);
        game.updateRoboCow(cow, .1);
        assert.deepEqual({ x: cow.x, y: cow.y, distance: cow.distance }, origin);
        game.combat(.1, game.cat.x, game.cat.y);
        assert.deepEqual({ x: cow.x, y: cow.y, distance: cow.distance }, origin, 'full combat also preserves the grass position');
      }
    }
  }
});

test('all Robo Cows travel clockwise like Robo Wheels, regardless of random rolls', () => {
  for (const roll of [0, .1, .49, .5, .99]) {
    const game = arena();
    game.random = () => roll;
    const cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
    const wheel = game.createCustomSpawn({ kind: 'enemy', type: 'wheel', x: .2, y: 0 })[0];
    wheel.distance = cow.distance;
    game.placeWheel(wheel);
    game.robots = [cow];
    const start = cow.distance;
    game.combat(.01, game.cat.x, game.cat.y);
    assert.equal(cow.cowDirection, 1);
    assert.ok(cow.distance > start);
    game.robots = [wheel];
    game.combat(.01, game.cat.x, game.cat.y);
    assert.ok(wheel.distance > start);
  }
});

test('Robo Cow walks its full distance even when starting at the end of a merged brick', () => {
  const game = arena(), cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  const ids = game.perimeter.slice(2, 8), owner = ids[0];
  for (const id of ids.slice(1)) game.bricks[id].absorbedBy = owner;
  cow.distance = game.perimeterBrickDistance(ids.at(-1));
  game.chooseCowWalkDistance(cow);
  const start = cow.distance, budget = cow.cowWalkRemaining;
  assert.equal(cow.cowDirection, 1);
  game.updateRoboCow(cow, .01);
  assert.equal(cow.cowEating, false);
  assert.ok(Math.abs(cow.distance - start - 1.9) < 1e-9);
  assert.ok(Math.abs(cow.cowWalkRemaining - budget + 1.9) < 1e-9);
});

test('Robo Cow legs face the bricks on every edge, including while eating', () => {
  const game = arena(), cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  const b = game.bounds(), w = b.right - b.left, h = b.bottom - b.top;
  for (const [distance, nx, ny] of [
    [w / 2, 0, -1], [w + h / 2, 1, 0],
    [w + h + w / 2, 0, 1], [2 * w + h + h / 2, -1, 0],
  ]) {
    cow.distance = distance;
    game.initializeRoboCow(cow);
    cow.cowEating = true;
    game.robots = [cow];
    game.combat(.1, game.cat.x, game.cat.y);
    assert.ok(Math.abs(-Math.sin(cow.facingAngle) - nx) < 1e-9);
    assert.ok(Math.abs(Math.cos(cow.facingAngle) - ny) < 1e-9);
    assert.equal(cow.cowEating, true);
  }
});

test('Robo Cow graphics turn smoothly through every corner within 0.12 seconds', () => {
  const game = arena(), cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  const b = game.bounds(), w = b.right - b.left, h = b.bottom - b.top;
  const angleGap = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  for (const corner of [w, w + h, 2 * w + h, 2 * (w + h)]) {
    cow.distance = corner - 1;
    game.initializeRoboCow(cow);
    const before = cow.facingAngle;
    cow.cowWalkRemaining = 300;
    game.robots = [cow];
    game.combat(.02, game.cat.x, game.cat.y);
    const turned = angleGap(cow.facingAngle, before);
    assert.ok(turned > 0 && turned < Math.PI / 2, 'corner rotation is animated, not an instant snap');
    game.combat(.1, game.cat.x, game.cat.y);
    assert.ok(Math.abs(angleGap(cow.facingAngle, before + Math.PI / 2)) < 1e-9);
  }
});

test('Robo Cow death lasts 2.1 seconds and freezes while paused', () => {
  const game = arena(), cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  game.defeatEnemy(cow);
  game.update(.7);
  const death = game.enemyDeaths[0];
  assert.ok(Math.abs(death.deathProgress - 1 / 3) < 1e-9);
  game.pause();
  game.update(5);
  assert.ok(Math.abs(death.deathProgress - 1 / 3) < 1e-9);
  game.resume();
  game.update(1.39);
  assert.equal(game.enemyDeaths.length, 1);
  game.update(.01);
  assert.equal(game.enemyDeaths.length, 0);
});

test('Robo Cow drawing preserves outward legs while mirroring its head into the travel direction', () => {
  const { readFileSync } = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const transforms = [];
  const ctx = new Proxy({}, {
    get(target, name) {
      if (name === 'rotate' || name === 'scale') return (...args) => transforms.push([name, ...args]);
      return () => {};
    },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawRoboCow('), source.indexOf('function drawRoboUnicorn(')), context);
  context.drawRoboCow({ facingAngle: Math.PI, age: 0 });
  assert.deepEqual(transforms.slice(0, 2), [['rotate', Math.PI], ['scale', -1, 1]]);
  transforms.length = 0;
  context.drawRoboCow({ facingAngle: Math.PI, cowDirection: -1, age: 0 });
  assert.deepEqual(transforms.slice(0, 2), [['rotate', Math.PI], ['scale', 1, 1]]);
});

test('cow legs alternate with travel, stop for eating and sleep, and stay independent of death motion', () => {
  const { readFileSync } = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const rotations = [], translations = [];
  const ctx = new Proxy({}, {
    get(target, name) {
      if (name === 'rotate') return angle => rotations.push(angle);
      if (name === 'translate') return (...args) => translations.push(args);
      return () => {};
    },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawRoboCow('), source.indexOf('function drawRoboUnicorn(')), context);
  const draw = (enemy, deathProgress = null) => {
    rotations.length = 0; translations.length = 0;
    context.drawRoboCow({ facingAngle: Math.PI, ...enemy }, deathProgress);
    return { rotations: rotations.slice(1, 5), translations: translations.slice(1, 5) };
  };
  const distance = Math.PI * 6, walking = draw({ distance });
  assert.deepEqual(walking.rotations.map(angle => Math.round(angle * 100)), [-45, 45, 45, -45]);
  assert.notDeepEqual(walking, draw({ distance: distance + Math.PI * 12 }));
  assert.deepEqual(walking, draw({ distance, age: 100 }), 'elapsed idle age cannot move stationary legs');
  for (const state of [{ cowEating: true }, { asleep: true }]) {
    const stopped = draw({ distance, ...state });
    assert.ok(stopped.rotations.every(angle => angle === 0));
    assert.deepEqual(stopped.translations, [[-16, 14], [-16, 14], [13, 14], [13, 14]]);
  }
  assert.deepEqual(walking, draw({ distance, cowEating: true, afraid: true }), 'fleeing overrides eating');
  assert.deepEqual(draw({ distance }, .2), draw({ distance: 0 }, .2), 'walking never affects staged death motion');
});

test('Robo Cow chooses the original section under its feet and resolves its merged owner after walking', () => {
  const game = arena(), cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  const regions = brickRegions(game.bricks, game.width, game.height);
  const ids = game.perimeter.filter(id => regions.get(id).edge === 'top'), owner = ids[0];
  for (const id of ids.slice(1)) game.bricks[id].absorbedBy = owner;
  const targetId = ids[Math.floor(ids.length / 2)];
  cow.distance = game.perimeterBrickDistance(targetId) - 19;
  cow.cowWalkRemaining = 19;
  game.updateRoboCow(cow, .1);
  assert.equal(cow.cowEating, true);
  assert.equal(cow.cowTargetId, owner);
  assert.equal(game.perimeter[cow.cowTargetIndex], targetId);
});

test('cow walking-distance distribution preserves the 2-6 brick-length weights across layouts', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const game = arena(options), bounds = game.bounds();
    const averageLength = 2 * (bounds.right - bounds.left + bounds.bottom - bounds.top) / game.perimeter.length;
    const cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
    const expected = [2, 3, 3, 4, 4, 4, 4, 5, 5, 6];
    for (let index = 0; index < expected.length; index++) {
      game.random = () => (index + .5) / expected.length;
      cow.cowDirection = -1;
      game.chooseCowWalkDistance(cow);
      assert.ok(Math.abs(cow.cowWalkRemaining - expected[index] * averageLength) < 1e-9);
      assert.equal(cow.cowDirection, -1, 'choosing distance never resets direction');
    }
  }
});

test('cows stop at the first original brick center at or after their quota on every edge and layout', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const game = arena(options), regions = brickRegions(game.bricks, game.width, game.height);
    for (const edge of ['top', 'right', 'bottom', 'left']) for (const direction of [-1, 1]) {
      const ids = game.perimeter.filter(id => regions.get(id).edge === edge);
      const id = ids[Math.floor(ids.length / 2)], center = game.perimeterBrickDistance(id);
      for (const quota of [10, 20]) {
        const cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
        cow.distance = center - direction * 20;
        cow.cowDirection = direction;
        cow.cowWalkRemaining = quota;
        game.updateRoboCow(cow, 15 / 190);
        assert.equal(cow.cowEating, false, 'quota alone must not start eating off-center');
        game.updateRoboCow(cow, 1);
        assert.equal(cow.cowEating, true);
        assert.ok(Math.abs(cow.distance - center) < 1e-9);
        assert.equal(game.perimeter[cow.cowTargetIndex], id);
        const brick = game.bricks[id];
        assert.ok(Math.abs((edge === 'top' || edge === 'bottom' ? cow.x - brick.x - brick.w / 2
          : cow.y - brick.y - brick.h / 2)) < 1e-9, 'cow is centered on the original grass section');
      }
    }
  }
});

test('a center passed before the quota cannot trigger eating and the next center is not overshot', () => {
  const game = arena(), regions = brickRegions(game.bricks, game.width, game.height);
  const ids = game.perimeter.filter(id => regions.get(id).edge === 'top');
  for (const direction of [-1, 1]) {
    const index = Math.floor(ids.length / 2), center = game.perimeterBrickDistance(ids[index]);
    const next = game.perimeterBrickDistance(ids[index + direction]);
    const cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
    cow.distance = center - direction * 20;
    cow.cowDirection = direction;
    cow.cowWalkRemaining = 25;
    game.updateRoboCow(cow, 30 / 190);
    assert.equal(cow.cowEating, false);
    assert.equal(cow.cowWalkRemaining, 0);
    game.updateRoboCow(cow, 1);
    assert.equal(cow.cowEating, true);
    assert.ok(Math.abs(cow.distance - next) < 1e-9);
  }
});

test('a fence encountered after quota expiry reverses the cow toward the first reachable center', () => {
  const game = arena(), regions = brickRegions(game.bricks, game.width, game.height);
  const ids = game.perimeter.filter(id => regions.get(id).edge === 'top');
  const id = ids[Math.floor(ids.length / 2)], center = game.perimeterBrickDistance(id), bounds = game.bounds();
  const cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  cow.distance = center + 5;
  cow.cowWalkRemaining = 1;
  game.placeWheel(cow);
  const fence = { barrier: true, x: bounds.left + center + 40, y: bounds.top - 10, w: 4, h: 150 };
  game.barrierParts = () => [fence];
  game.updateRoboCow(cow, .1);
  assert.equal(cow.cowWalkRemaining, 0);
  assert.equal(cow.cowDirection, -1);
  assert.equal(cow.cowEating, false);
  game.updateRoboCow(cow, .1);
  assert.equal(cow.cowEating, true);
  assert.ok(Math.abs(cow.distance - center) < 1e-9);
  assert.equal(cow.cowTargetId, id);
});

test('active Barrier fences turn cows around on every edge in both directions without resetting distance', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    for (const edge of ['top', 'right', 'bottom', 'left']) for (const direction of [-1, 1]) {
      const game = arena(options), regions = brickRegions(game.bricks, game.width, game.height);
      const ids = game.perimeter.filter(id => regions.get(id).edge === edge);
      const id = ids[Math.floor(ids.length / 2)];
      game.bricks[id].barrier = true;
      game.barriers.push({ id, length: 100, extending: true });
      const cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
      cow.cowDirection = direction;
      cow.distance = game.perimeterBrickDistance(id) - direction * (cow.radius + 2 + 10);
      cow.cowWalkRemaining = 1000;
      game.placeWheel(cow);
      game.robots = [cow];
      const start = cow.distance;
      game.combat(.1, game.cat.x, game.cat.y);
      assert.equal(cow.cowDirection, -direction, `${edge}: reverse exactly once`);
      assert.ok(Math.abs(cow.distance - start - direction * 10) < .02, `${edge}: stop at the fence`);
      assert.ok(Math.abs(cow.cowWalkRemaining - 990) < .02, 'only actual travel consumes the budget');
      const contact = cow.distance;
      game.combat(.05, game.cat.x, game.cat.y);
      assert.ok(Math.abs(cow.distance - contact + direction * 9.5) < .02, 'walk away without sticking');
      assert.equal(cow.cowEating, false);
    }
  }
});

test('a cow confined within one original brick eventually eats after enough back-and-forth travel', () => {
  const game = arena(), regions = brickRegions(game.bricks, game.width, game.height);
  const top = game.perimeter.filter(id => regions.get(id).edge === 'top');
  const id = top[Math.floor(top.length / 2)], brick = game.bricks[id], bounds = game.bounds();
  const cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  cow.distance = game.perimeterBrickDistance(id);
  game.placeWheel(cow);
  const x = cow.x, start = cow.distance, budget = cow.cowWalkRemaining;
  const fences = [-40, 40].map(offset => ({
    barrier: true, x: x + offset - 2, y: bounds.top - 10, w: 4, h: 150,
  }));
  game.barrierParts = () => fences;
  game.robots = [cow];
  let walked = 0, reversals = 0;
  for (let tick = 0; tick < 2000 && !cow.cowEating; tick++) {
    const before = cow.distance, direction = cow.cowDirection;
    game.combat(.01, game.cat.x, game.cat.y);
    walked += Math.abs(cow.distance - before);
    if (cow.cowDirection !== direction) reversals++;
    assert.ok(cow.x >= brick.x && cow.x <= brick.x + brick.w);
    assert.equal(cow.y, bounds.top);
    assert.ok(cow.x <= fences[1].x - cow.radius + .02 && cow.x >= fences[0].x + 4 + cow.radius - .02);
  }
  assert.equal(cow.cowEating, true);
  assert.ok(reversals > 2);
  assert.ok(walked >= budget && walked < budget + 24 + .1, `walked ${walked} of ${budget}`);
  assert.ok(Math.abs(cow.distance - start) < 1e-9, 'the cow finishes exactly at the grass center');
  assert.ok(Math.abs(cow.distance - start) < budget / 10, 'net displacement cannot substitute for total travel');
  assert.equal(cow.cowTargetId, id);
  const direction = cow.cowDirection;
  game.updateRoboCow(cow, 5);
  assert.equal(brick.kind, 'cinder');
  assert.equal(cow.cowDirection, direction);
  assert.equal(cow.cowWalkRemaining, budget, 'a new budget starts after eating');
});

test('distance expiry on Cinder or Goal bricks skips eating and retains the reversed direction', () => {
  for (const kind of ['cinder', 'goal']) {
    const game = arena(), cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
    for (const brick of game.bricks) brick.kind = kind;
    cow.cowDirection = -1;
    cow.cowWalkRemaining = 19;
    cow.distance = game.perimeterBrickDistance(game.perimeter[2]) + 19;
    game.updateRoboCow(cow, .1);
    assert.equal(cow.cowEating, false);
    assert.equal(cow.cowDirection, -1);
    assert.ok(cow.cowWalkRemaining > 19);
    assert.equal(cow.cowTargetId, null);
  }
});

test('walking around a corner cannot cut across an active fence or overcount the travel', () => {
  const game = arena(), bounds = game.bounds(), w = bounds.right - bounds.left;
  const regions = brickRegions(game.bricks, game.width, game.height);
  const ids = game.perimeter.filter(id => regions.get(id).edge === 'right');
  const id = ids[Math.floor(ids.length / 2)];
  game.bricks[id].barrier = true;
  game.barriers.push({ id, length: 100, extending: true });
  const cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  cow.distance = w - 5;
  cow.cowWalkRemaining = 2000;
  const start = cow.distance;
  game.placeWheel(cow);
  game.updateRoboCow(cow, 10);
  const contact = game.perimeterBrickDistance(id) - cow.radius - 2;
  assert.ok(Math.abs(cow.distance - contact) < 1e-9);
  assert.equal(cow.cowDirection, -1);
  assert.equal(cow.x, bounds.right);
  assert.ok(Math.abs(cow.cowWalkRemaining - (2000 - contact + start)) < 1e-9);
});

test('a cow blocked by an obstruction reverses and spends only actual forward and backward travel', () => {
  const game = arena(), bounds = game.bounds();
  const cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  const obstruction = game.createObstruction({ x: cow.x + 100, y: bounds.top },
    { kind: 'object', type: 'obstruction-circle', x: .5, y: 0 });
  game.obstructions.push(obstruction);
  game.robots = [cow];
  const start = cow.distance, budget = cow.cowWalkRemaining;
  let walked = 0;
  for (let frame = 0; frame < 100 && cow.cowDirection === 1; frame++) {
    const before = cow.distance;
    game.combat(.01, game.cat.x, game.cat.y);
    walked += Math.abs(cow.distance - before);
  }
  assert.equal(cow.cowEating, false);
  assert.equal(cow.cowDirection, -1);
  assert.ok(cow.distance > start && cow.distance - start < 100);
  assert.ok(Math.abs(cow.cowWalkRemaining - (budget - walked)) < .001);
  const remaining = cow.cowWalkRemaining;
  const contact = cow.distance;
  game.combat(.1, game.cat.x, game.cat.y);
  assert.ok(Math.abs(cow.distance - contact + 19) < 1e-6);
  assert.ok(Math.abs(cow.cowWalkRemaining - remaining + 19) < 1e-6);
});

test('walking budgets freeze during sleep and pause and survive a perimeter wrap', () => {
  const game = arena(), cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  cow.distance = 5;
  cow.cowWalkRemaining = 100;
  cow.cowDirection = -1;
  game.placeWheel(cow);
  game.robots = [cow];
  game.pause();
  game.update(1);
  assert.equal(cow.cowWalkRemaining, 100);
  game.resume();
  game.enemiesSleepUntil = game.elapsed + 10;
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(cow.cowWalkRemaining, 100);
  game.enemiesSleepUntil = 0;
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(cow.cowWalkRemaining, 81);
  assert.equal(cow.distance, -14);
  assert.equal(cow.x, game.bounds().left);
  assert.equal(cow.y, game.bounds().top - cow.distance);
});

test('Robo Cow converts the complete merged brick to cinder after five seconds', () => {
  const game = arena(), cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  const ids = game.perimeter.slice(2, 8), owner = ids[0];
  for (const id of ids) {
    game.bricks[id].absorbedBy = id === owner ? null : owner;
    game.bricks[id].kind = 'normal';
  }
  cow.cowEating = true;
  cow.cowEatTime = 0;
  cow.cowTargetId = owner;
  cow.cowTargetIndex = 5;
  game.updateRoboCow(cow, 4.99);
  assert.ok(ids.every(id => game.bricks[id].kind === 'normal'));
  game.updateRoboCow(cow, .01);
  assert.ok(ids.every(id => game.bricks[id].kind === 'cinder'));
  assert.equal(game.brickDestructions.length, 1);
});

function grassRenderer(game) {
  const { readFileSync } = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [], stack = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'save') return () => stack.push({ ...target });
      if (name === 'restore') return () => Object.assign(target, stack.pop());
      return (...args) => operations.push({ name, args, alpha: target.globalAlpha });
    },
  });
  const context = vm.createContext({ ctx, game, COW_EAT_DURATION, brickRegions });
  vm.runInContext(source.slice(source.indexOf('function drawCowGrass('), source.indexOf('function drawRoboCow(')), context);
  return cow => {
    operations.length = 0;
    context.drawCowGrass(cow);
    assert.equal(stack.length, 0);
    assert.equal(ctx.globalAlpha, 1);
    return operations.slice();
  };
}

test('cow grass fades in and its straight depletion edge moves at a constant speed on every board edge', () => {
  const game = arena(), draw = grassRenderer(game);
  const regions = brickRegions(game.bricks, game.width, game.height);
  for (const edge of ['top', 'right', 'bottom', 'left']) {
    const brick = game.bricks.find(brick => regions.get(brick.id).edge === edge);
    const cow = { type: 'robo-cow', cowEating: true, cowTargetIndex: game.perimeter.indexOf(brick.id) };
    const horizontal = edge === 'top' || edge === 'bottom';
    const length = horizontal ? brick.w : brick.h, depth = 6;
    const angles = { top: 0, right: Math.PI / 2, bottom: Math.PI, left: -Math.PI / 2 };
    for (const time of [0, .1, .2, 1, 2, 3, 4, 4.99]) {
      cow.cowEatTime = time;
      const operations = draw(cow);
      const wipe = operations.find(operation => operation.name === 'rect');
      assert.equal(operations.find(operation => operation.name === 'rotate').args[0], angles[edge]);
      assert.deepEqual(operations.find(operation => operation.name === 'roundRect').args, [0, 0, length, depth, 3]);
      const positions = {
        top: [brick.x, brick.y + brick.h], right: [brick.x, brick.y],
        bottom: [brick.x + brick.w, brick.y], left: [brick.x + brick.w, brick.y + brick.h],
      };
      assert.deepEqual(operations.find(operation => operation.name === 'translate').args, positions[edge]);
      assert.ok(Math.abs(wipe.args[0] - length * time / 5) < 1e-9);
      assert.ok(Math.abs(wipe.args[2] - length * (1 - time / 5)) < 1e-9);
      assert.equal(wipe.alpha, Math.min(1, time / .2));
      assert.equal(operations.filter(operation => operation.name === 'clip').length, 2);
    }
    cow.cowEatTime = 5;
    assert.equal(draw(cow).length, 0, 'grass is completely gone at destruction time');
  }
});

test('cow grass covers only the original section under the cow on merged bricks and clears on destruction', () => {
  const game = arena(), draw = grassRenderer(game);
  const cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  const ids = game.perimeter.slice(2, 8), owner = ids[0];
  for (const id of ids) {
    game.bricks[id].absorbedBy = id === owner ? null : owner;
    game.bricks[id].kind = 'normal';
  }
  cow.cowTargetIndex = 5;
  cow.cowTargetId = owner;
  cow.cowEating = true;
  cow.cowEatTime = 2.5;
  const brick = game.bricks[game.perimeter[5]];
  const coverage = draw(cow).find(operation => operation.name === 'roundRect').args;
  assert.ok(Math.abs(coverage[2] - Math.max(brick.w, brick.h)) < 1e-9);
  assert.equal(coverage[3], 6);
  game.updateRoboCow(cow, 2.5);
  assert.ok(ids.every(id => game.bricks[id].kind === 'cinder'));
  assert.equal(draw(cow).length, 0);
  cow.cowEating = true;
  cow.cowTargetIndex = 5;
  assert.equal(draw(cow).length, 0, 'stale eating state never covers a destroyed brick');
});

test('cow grass freezes with the eating timer on pause and is absent while walking', () => {
  const game = arena(), draw = grassRenderer(game);
  const cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  assert.equal(draw(cow).length, 0);
  cow.cowWalkRemaining = 0;
  cow.distance = game.perimeterBrickDistance(game.perimeter[2]);
  game.updateRoboCow(cow, 0);
  assert.equal(cow.cowEating, true);
  cow.cowEatTime = 1;
  game.robots = [cow];
  const before = draw(cow);
  game.pause();
  game.update(5);
  assert.deepEqual(draw(cow), before);
  game.resume();
  game.combat(1, game.cat.x, game.cat.y);
  assert.notDeepEqual(draw(cow), before);
});

test('cow head and spring pop before body collapse, leg detachment, or explosion', () => {
  const { readFileSync } = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [], stack = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'save') return () => stack.push({ ...target });
      if (name === 'restore') return () => Object.assign(target, stack.pop());
      return (...args) => operations.push({ name, args, alpha: target.globalAlpha, stroke: target.strokeStyle });
    },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawRoboCow('), source.indexOf('function drawRoboUnicorn(')), context);
  for (const progress of [.08, .2, .29]) {
    operations.length = 0;
    context.drawRoboCow({ facingAngle: 0 }, progress);
    const translations = operations.filter(operation => operation.name === 'translate');
    assert.deepEqual(translations[0].args, [0, 0], 'body remains stationary');
    assert.equal(translations[0].alpha, 1);
    assert.deepEqual(translations.slice(1, 5).map(operation => operation.args), [[-16, 14], [-16, 14], [13, 14], [13, 14]]);
    assert.ok(translations[5].args[0] > 13, 'head is already flying away');
    assert.ok(operations.some(operation => operation.name === 'stroke' && operation.stroke === '#d7e2e4'), 'spring is already visible');
  }
  operations.length = 0;
  context.drawRoboCow({ facingAngle: 0 }, .5);
  assert.ok(operations.find(operation => operation.name === 'translate').args[1] > 0);
  assert.equal(stack.length, 0);
  assert.equal(ctx.globalAlpha, 1);
  const death = source.slice(source.indexOf('function drawEnemyDeath('), source.indexOf('function resize('));
  assert.match(death, /enemy\.type === 'robo-cow'[\s\S]*drawRobot/);
  assert.match(death, /blastStart = enemy\.type === 'robo-cow' \? \.65 : \.25/);
});
