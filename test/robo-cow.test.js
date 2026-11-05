const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, CHARACTERS, COW_EAT_DURATION, brickRegions, validateCustomLevel } = require('../src/game.js');

const level = events => ({
  version: 1, id: 'Robo Cow tests', duration: 60, goal: 1000,
  heartCost: null, brickSet: 1, events,
});

function arena() {
  const game = new Game(() => .5, { customLevel: level([]) });
  game.start();
  return game;
}

test('Robo Cow is available in custom placements and brick spawners without campaign placements', () => {
  assert.equal(CHARACTERS['robo-cow'], 'Robo Cow');
  const placement = { time: 0, kind: 'enemy', type: 'robo-cow', x: .5, y: 0 };
  assert.equal(validateCustomLevel(level([placement])).events[0].type, 'robo-cow');
  assert.ok(LEVELS.every(campaign => !campaign.enemies.some(([, type]) => type === 'robo-cow')));

  const game = arena();
  const cow = game.createCustomSpawn(placement)[0];
  const bounds = game.bounds();
  assert.ok(cow.x === bounds.left || cow.x === bounds.right || cow.y === bounds.top || cow.y === bounds.bottom);
  const count = (cow.cowTargetIndex - cow.cowBrickIndex + game.perimeter.length) % game.perimeter.length;
  assert.equal(count, 4, 'four is the most likely count');
});

test('Robo Cow follows the perimeter at twice Robo Wheel speed', () => {
  const game = arena();
  const cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  cow.cowEating = false;
  cow.cowTargetDistance = cow.distance + cow.cowDirection * 300;
  const start = cow.distance;
  game.robots.push(cow);
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(cow.distance, start + cow.cowDirection * 19);
  assert.ok(cow.x === game.bounds().left || cow.x === game.bounds().right
    || cow.y === game.bounds().top || cow.y === game.bounds().bottom);
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

test('Robo Cow does not reverse at the end of a merged brick', () => {
  const game = arena(), cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  const ids = game.perimeter.slice(2, 8), owner = ids[0];
  for (const id of ids.slice(1)) game.bricks[id].absorbedBy = owner;
  cow.cowBrickIndex = 7;
  cow.distance = game.perimeterBrickDistance(ids.at(-1));
  game.chooseCowTarget(cow);
  assert.equal(cow.cowDirection, 1);
  assert.equal(cow.cowTargetIndex, 7);
  assert.equal(cow.cowTargetId, owner);
  game.updateRoboCow(cow, .01);
  assert.equal(cow.cowEating, true);
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
    cow.cowTargetDistance = corner + 100;
    cow.cowTargetId = game.perimeter[0];
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

test('Robo Cow targets within a merged brick when spawned on it', () => {
  const game = arena(), cow = game.createCustomSpawn({ kind: 'enemy', type: 'robo-cow', x: .2, y: 0 })[0];
  const start = cow.cowBrickIndex, owner = game.perimeter[start];
  for (let offset = 1; offset < 6; offset++) {
    game.bricks[game.perimeter[(start + offset) % game.perimeter.length]].absorbedBy = owner;
  }
  game.initializeRoboCow(cow);
  const target = game.perimeter[cow.cowTargetIndex];
  assert.equal(cow.cowTargetId, owner);
  assert.ok((cow.cowTargetIndex - cow.cowBrickIndex + game.perimeter.length) % game.perimeter.length <= 5);
  assert.equal(game.bricks[target].absorbedBy ?? target, owner);
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
  cow.cowEating = true;
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
