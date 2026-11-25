const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, LEVELS, CHARACTERS, validateCustomLevel } = require('../src/game.js');
const { spawnSymbol, terrainPathData } = require('../src/brick-visuals.js');
const { Tutorial, LESSONS } = require('../src/learning.js');

const water = { id: 'pool', type: 'water', nodes: [
  { x: .2, y: .2 }, { x: .8, y: .2 }, { x: .8, y: .8 }, { x: .2, y: .8 }] };
const level = (events, extra = {}) => ({
  version: 1, id: 'Octopus tests', duration: 60, goal: 1000,
  heartCost: null, brickSet: 1, terrains: [water], events, ...extra,
});
function arena(type = 'robo-octopus-red') {
  const game = new Game(() => .5, { customLevel: level([]) });
  game.start();
  const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .5, y: .5 })[0];
  return { game, enemy };
}

test('Octopus is available in custom placements and spawners, guide and practice, not campaign levels', () => {
  const custom = level(
    [{ time: 0, kind: 'enemy', type: 'robo-octopus-red', x: .5, y: .5, shield: 'green' },
      { time: 1, kind: 'enemy', type: 'robo-octopus-blue', random: true }],
    { brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'enemy', type: 'robo-octopus-blue', shield: 'red' } }] });
  assert.deepEqual(validateCustomLevel(custom), custom);
  assert.equal(CHARACTERS['robo-octopus-red'], 'Red Robo Octopus');
  assert.equal(CHARACTERS['robo-octopus-blue'], 'Blue Robo Octopus');
  assert.ok(spawnSymbol({ kind: 'enemy', type: 'robo-octopus-red' }));
  assert.ok(spawnSymbol({ kind: 'enemy', type: 'robo-octopus-blue' }));
  assert.ok(LEVELS.every(entry => entry.enemies.every(([, type]) => !type.startsWith('robo-octopus'))));
  const game = new Game(() => .5, { customLevel: custom }); game.start();
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  assert.equal(game.robots.at(-1).type, 'robo-octopus-blue');
  assert.equal(game.robots.at(-1).octopusState, 'swim');
  assert.ok(game.inWater(game.robots.at(-1)));
  const tutorial = new Tutorial(); tutorial.select(LESSONS.findIndex(lesson => lesson.id === 'robo-octopus-red'));
  assert.ok(tutorial.game.robots.some(enemy => enemy.type === 'robo-octopus-red'));
  assert.ok(tutorial.game.inWater(tutorial.game.robots.find(enemy => enemy.type === 'robo-octopus-red')));
});

test('octopus placements require water terrain and must be placed inside it', () => {
  const noWater = events => ({ ...level(events), terrains: [] });
  assert.throws(() => validateCustomLevel(noWater([{ time: 0, kind: 'enemy', type: 'robo-octopus-red', x: .5, y: .5 }])),
    /water terrain/);
  assert.throws(() => validateCustomLevel(level([{ time: 0, kind: 'enemy', type: 'robo-octopus-blue', x: .05, y: .05 }])),
    /inside a water terrain/);
  assert.throws(() => validateCustomLevel({ ...level([]), terrains: [],
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'enemy', type: 'robo-octopus-red' } }] }), /water terrain/);
  assert.throws(() => validateCustomLevel({ ...level([]),
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'enemy', type: 'robo-octopus-red', x: .05, y: .05 } }] }), /inside a water terrain/);
  const valid = level([{ time: 0, kind: 'enemy', type: 'robo-octopus-red', random: true }]);
  assert.deepEqual(validateCustomLevel(valid), valid);
});

test('octopus swims underwater inside water terrain, surfaces, shoots, pauses 2 seconds and dives', () => {
  const { game, enemy } = arena();
  assert.equal(enemy.octopusState, 'swim');
  assert.equal(enemy.octopusSwimDuration, 3.75);
  const start = { x: enemy.x, y: enemy.y };
  for (let i = 0; i < 75; i++) {
    game.updateOctopus(enemy, .05);
    assert.ok(game.inWater(enemy), 'the shadow stays inside the water region');
  }
  assert.ok(Math.hypot(enemy.x - start.x, enemy.y - start.y) > 10, 'it moves while underwater');
  assert.equal(enemy.octopusState, 'rise');
  const surfaced = { x: enemy.x, y: enemy.y };
  game.updateOctopus(enemy, .45);
  assert.equal(enemy.octopusState, 'aim');
  game.updateOctopus(enemy, .99);
  assert.deepEqual({ x: enemy.x, y: enemy.y }, surfaced, 'it stays still while surfaced');
  assert.equal(game.octopusFireballs.length, 0);
  game.updateOctopus(enemy, .01);
  assert.equal(game.octopusFireballs.length, 1);
  assert.equal(enemy.octopusState, 'pause');
  game.updateOctopus(enemy, 1.99);
  assert.equal(enemy.octopusState, 'pause');
  game.updateOctopus(enemy, .02);
  assert.equal(enemy.octopusState, 'dive');
  game.updateOctopus(enemy, .45);
  assert.equal(enemy.octopusState, 'swim');
  assert.equal(game.octopusFireballs.length, 1, 'only one shot per surfacing');
});

test('octopuses swim away from the shoreline and favor a body-sized margin before surfacing', () => {
  for (const type of ['robo-octopus-red', 'robo-octopus-blue']) {
    const { game, enemy } = arena(type);
    game.terrains = [{ type: 'water', path: { nodes: [
      { x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 500 }, { x: 100, y: 500 },
    ] } }];
    Object.assign(enemy, { x: 102, y: 300, phase: Math.PI, octopusSwimDuration: 2.5 });
    for (let i = 0; i < 50; i++) game.updateOctopus(enemy, .05);
    assert.equal(enemy.octopusState, 'rise');
    assert.ok(Math.min(enemy.x - 100, 500 - enemy.x, enemy.y - 100, 500 - enemy.y) >= 36,
      'the surfaced body has room inside the pool');

    Object.assign(enemy, { x: 138, y: 300, phase: Math.PI, octopusState: 'swim',
      octopusTime: 0, octopusSwimDuration: 2.5 });
    for (let i = 0; i < 50; i++) {
      game.updateOctopus(enemy, .05);
      assert.ok(Math.min(enemy.x - 100, 500 - enemy.x, enemy.y - 100, 500 - enemy.y) >= 36 - 1e-8);
    }
  }
});

test('narrow and concave water regions still allow swimming without crossing land', () => {
  const { game, enemy } = arena();
  game.terrains = [{ type: 'water', path: { nodes: [
    { x: 100, y: 100 }, { x: 130, y: 100 }, { x: 130, y: 400 }, { x: 100, y: 400 },
  ] } }];
  Object.assign(enemy, { x: 115, y: 150, phase: Math.PI / 2, octopusSwimDuration: 2.5 });
  for (let i = 0; i < 50; i++) {
    game.updateOctopus(enemy, .05);
    assert.ok(game.inWater(enemy));
  }
  assert.equal(enemy.octopusState, 'rise', 'a narrow pool does not prevent surfacing');
  assert.ok(enemy.y > 210, 'the octopus still swims in a narrow pool');

  const terrain = { type: 'water', path: { nodes: [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 51, y: 100 },
    { x: 51, y: 40 }, { x: 49, y: 40 }, { x: 49, y: 100 }, { x: 0, y: 100 },
  ] } };
  game.terrains = [terrain];
  Object.assign(enemy, { x: 48, y: 60, phase: 0, octopusState: 'swim',
    octopusTime: 0, octopusSwimDuration: 2.5 });
  const start = { x: enemy.x, y: enemy.y };
  game.updateOctopus(enemy, .05);
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    assert.ok(game.inWater({ x: start.x + (enemy.x - start.x) * t,
      y: start.y + (enemy.y - start.y) * t }), 'the swimming path remains in water');
  }
});

test('a concave pool keeps the octopus away from its shoreline in live combat', () => {
  const { game, enemy } = arena();
  const nodes = [
    { x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 200 },
    { x: 200, y: 200 }, { x: 200, y: 400 }, { x: 100, y: 400 },
  ];
  game.terrains = [{ type: 'water', path: { nodes } }];
  Object.assign(enemy, { x: 197, y: 197, phase: Math.PI / 4, octopusSwimDuration: 2.5 });
  game.robots = [enemy];
  for (let i = 0; i < 300; i++) game.combat(1 / 120, game.cat.x, game.cat.y);
  assert.equal(enemy.octopusState, 'rise');
  const clearance = Math.min(...nodes.map((a, i) => {
    const b = nodes[(i + 1) % nodes.length], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((enemy.x - a.x) * dx + (enemy.y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(enemy.x - a.x - t * dx, enemy.y - a.y - t * dy);
  }));
  assert.ok(clearance >= 36, `surface clearance ${clearance}`);
});

test('a collision pushing a rising octopus onto land sends it back underwater', () => {
  const { game, enemy } = arena();
  game.terrains = [{ type: 'water', path: { nodes: [
    { x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 500 }, { x: 100, y: 500 },
  ] } }];
  Object.assign(enemy, { x: 140, y: 300, phase: 0, octopusTime: 2.499, octopusSwimDuration: 2.5 });
  game.robots = [enemy];
  game.blockEnemyWithObstructions = actor => { if (actor === enemy && actor.octopusState === 'rise') actor.x = 99; };
  game.combat(.01, game.cat.x, game.cat.y);
  assert.equal(enemy.octopusState, 'swim');
  assert.equal(game.inWater(enemy), false);
  game.updateOctopus(enemy, .6);
  assert.ok(game.inWater(enemy), 'it returns toward its last underwater position');
});

test('red octopus fires one slow fireball aimed at Koshi', () => {
  const { game, enemy } = arena();
  game.cat.x = enemy.x - 200; game.cat.y = enemy.y;
  enemy.octopusState = 'aim'; enemy.octopusTime = .99;
  game.updateOctopus(enemy, .01);
  const fireball = game.octopusFireballs[0];
  assert.ok(Math.abs(fireball.vx + 95) < 1e-9);
  assert.ok(Math.abs(fireball.vy) < 1e-9);
  assert.equal(fireball.radius, 8);
  assert.ok(Math.abs(fireball.x - (enemy.x - enemy.radius - 8.1)) < 1e-9);
});

test('fireballs stop at Koshi, bricks and obstructions but pass barriers and bumpers', () => {
  const { game } = arena();
  const x = game.cat.x, y = game.cat.y;
  const fireball = () => ({ x: x - 100, y, vx: 95, vy: 0, radius: 8, age: 0 });
  game.octopusFireballs = [fireball()];
  game.updateHazardDamage(2, [], x, y);
  assert.equal(game.hearts, 2, 'a fireball hit costs one heart');
  assert.equal(game.octopusFireballs.length, 0);
  game.octopusFireballs = [fireball()];
  game.updateHazardDamage(2, [{ id: 0, x: x - 60, y: y - 30, w: 4, h: 60 }], x, y);
  assert.equal(game.hearts, 2, 'a brick stops the fireball before Koshi');
  assert.equal(game.octopusFireballs.length, 0);
  game.invulnerableUntil = 0;
  game.octopusFireballs = [fireball()];
  game.obstructions.push(game.createObstruction({ x: x - 60, y }, { type: 'obstruction-circle' }));
  game.updateHazardDamage(2, [], x, y);
  assert.equal(game.hearts, 2, 'an obstruction stops the fireball before Koshi');
  assert.equal(game.octopusFireballs.length, 0);
  game.obstructions = [];
  game.octopusFireballs = [fireball()];
  game.barrierParts = () => [{ x: x - 60, y: y - 30, w: 4, h: 60 }];
  game.bumpers.push(game.createBumper({ x: x - 60, y }, 'bumper-green'));
  game.updateHazardDamage(.3, [], x, y);
  assert.equal(game.octopusFireballs.length, 1, 'barriers and bumpers do not stop fireballs');
  assert.equal(game.hearts, 2);
});

test('blue octopus fires one existing-style bubble of random color at Koshi', () => {
  const { game, enemy } = arena('robo-octopus-blue');
  game.cat.x = enemy.x; game.cat.y = enemy.y + 200;
  for (const [random, color] of [[0, 'green'], [.4, 'red'], [.9, 'blue']]) {
    game.random = () => random;
    enemy.octopusState = 'aim'; enemy.octopusTime = .99;
    game.updateOctopus(enemy, .01);
    const bubble = game.bubbles.at(-1);
    assert.equal(bubble.color, color);
    assert.equal(bubble.radius, 24);
    assert.equal(bubble.hazardShot, true);
    assert.ok(Math.abs(bubble.vy - 120) < 1e-9);
    assert.ok(Math.abs(bubble.vx) < 1e-9);
    assert.equal(enemy.octopusState, 'pause');
  }
  assert.equal(game.bubbles.length, 3);
  assert.equal(game.octopusFireballs.length, 0);
  game.bubbleTrap = { x: 0, y: 0 };
  enemy.octopusState = 'aim'; enemy.octopusTime = .99;
  game.updateOctopus(enemy, .01);
  assert.equal(game.bubbles.length, 3, 'no bubble shot while Koshi is already trapped');
});

test('underwater the octopus cannot be hurt or hurt Koshi; surfaced it can be killed and touched', () => {
  const { game, enemy } = arena();
  game.robots = [enemy];
  game.cat.x = enemy.x; game.cat.y = enemy.y;
  assert.equal(enemy.octopusState, 'swim');
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.hearts, 3, 'the submerged shadow is harmless');
  game.weapon = { type: 'silver', uses: 5, expires: Infinity };
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.enemies, 0, 'weapons cannot reach it underwater');
  assert.equal(game.robots.length, 1);
  game.damageRangedEnemy(enemy);
  assert.equal(game.robots.length, 1, 'turret and rope dart hits also miss underwater');
  enemy.octopusState = 'pause';
  game.damageRangedEnemy(enemy);
  assert.equal(game.robots.length, 0);
  assert.equal(game.enemies, 1);
  assert.equal(game.enemyDeaths[0].type, 'robo-octopus-red');
  const second = arena();
  second.game.robots = [second.enemy];
  second.enemy.octopusState = 'pause';
  second.game.cat.x = second.enemy.x; second.game.cat.y = second.enemy.y;
  second.game.combat(0, second.game.cat.x, second.game.cat.y);
  assert.equal(second.game.hearts, 2, 'touching a surfaced octopus costs a heart');
});

test('fear sends a surfaced octopus diving and keeps it underwater; sleep and lifecycle integrate', () => {
  const { game, enemy } = arena();
  enemy.octopusState = 'pause'; enemy.octopusTime = 1;
  enemy.afraid = true;
  game.updateOctopus(enemy, .45);
  assert.equal(enemy.octopusState, 'swim');
  game.updateOctopus(enemy, 12);
  assert.equal(enemy.octopusState, 'swim', 'it will not surface while afraid');
  assert.ok(game.inWater(enemy));
  enemy.afraid = false;
  game.updateOctopus(enemy, enemy.octopusSwimDuration - enemy.octopusTime);
  assert.equal(enemy.octopusState, 'rise');
  game.robots = [enemy];
  game.cat.x = game.bounds().left; game.cat.y = game.bounds().top;
  game.collectItem({ type: 'music-box' });
  const frozen = { state: enemy.octopusState, time: enemy.octopusTime };
  game.update(.5);
  assert.equal(enemy.octopusState, frozen.state);
  assert.equal(enemy.octopusTime, frozen.time);
  game.reset();
  assert.equal(game.octopusFireballs.length, 0);
});

test('a running game keeps the octopus alive, in water, and firing at Koshi', () => {
  const custom = level([{ time: 0, kind: 'enemy', type: 'robo-octopus-red', x: .5, y: .5 }]);
  const game = new Game(() => .5, { customLevel: custom });
  game.start();
  game.update(.1);
  const enemy = game.robots.find(robot => robot.type === 'robo-octopus-red');
  assert.ok(enemy);
  let fired = false;
  for (let i = 0; i < 160 && !fired; i++) {
    game.update(.05);
    assert.ok(game.inWater(enemy) || enemy.octopusState !== 'swim');
    fired = game.octopusFireballs.length > 0 || game.hearts < 3 || game.hazardExplosions.length > 0;
  }
  assert.ok(fired, 'the octopus eventually surfaces and shoots');
  assert.ok(game.robots.includes(enemy));
});

test('rendering shows only an oval shadow underwater and yellow pixel eyes when surfaced', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient' || key === 'createLinearGradient') {
        return () => ({ addColorStop() {} });
      }
      return (...args) => operations.push([key, ...args]);
    },
    set(target, key, value) { operations.push(['set', key, value]); target[key] = value; return true; },
  });
  const context = vm.createContext({ ctx, drawScaredFace: () => operations.push(['scaredFace']) });
  vm.runInContext(source.slice(source.indexOf('function drawRoboOctopus('), source.indexOf('function drawRobotExplosion(')), context);
  operations.length = 0;
  context.drawRoboOctopus({ type: 'robo-octopus-red', octopusState: 'swim', age: 0, phase: 0 });
  assert.ok(operations.some(op => op[0] === 'ellipse'), 'the shadow is an oval');
  assert.ok(!operations.some(op => op[0] === 'fillRect'), 'no body parts show underwater');
  for (const [type, body] of [['robo-octopus-red', '#d64f43'], ['robo-octopus-blue', '#4f86d6']]) {
    for (const [octopusState, octopusTime] of [['rise', .45], ['aim', 0], ['pause', 0], ['dive', 0]]) {
      operations.length = 0;
      context.drawRoboOctopus({ type, octopusState, octopusTime, age: 0 });
      assert.ok(operations.some(op => op[0] === 'set' && op[1] === 'fillStyle' && op[2] === body), `${type} body color`);
      assert.ok(operations.some(op => op[0] === 'set' && op[1] === 'fillStyle' && op[2] === '#ffdf3d'), 'yellow pixel eyes');
      assert.ok(operations.filter(op => op[0] === 'fillRect').length >= 8, 'pixelated eyes use blocks');
      const tips = operations.filter(op => op[0] === 'bezierCurveTo').map(op => [op[5], op[6]]);
      assert.ok(tips.some(([x, y]) => x <= -35 && y < 8), 'left tentacle curls upward');
      assert.ok(tips.some(([x, y]) => x >= 35 && y < 8), 'right tentacle curls upward');
      assert.ok(tips.filter(([, y]) => y >= 28).length >= 3, 'three lower tentacles are visible');
      assert.deepEqual(operations.filter(op => op[0] === 'scale'), [['scale', .75, .75]],
        'the complete graphic is scaled uniformly');
    }
  }
  operations.length = 0;
  context.drawRoboOctopus({ type: 'robo-octopus-red', octopusState: 'aim', octopusTime: .9, age: 0 });
  assert.ok(operations.some(op => op[0] === 'set' && op[1] === 'fillStyle'
    && String(op[2]).startsWith('rgba(255, 150, 60')), 'the red octopus telegraphs its shot');
});

test('overlapping octopi draw from highest to lowest without changing simulation order', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('function robotDrawOrder('), source.indexOf('function render(')), context);
  const low = { type: 'robo-octopus-red', y: 300 };
  const high = { type: 'robo-octopus-blue', y: 100 };
  const middle = { type: 'robo-octopus-red', y: 200 };
  const mouse = { type: 'mouse', y: 500 };
  const robots = [low, mouse, high, middle];
  const original = [...robots];
  assert.deepEqual(Array.from(context.robotDrawOrder(robots)), [high, mouse, middle, low],
    'the lowest octopus draws last regardless of color');
  assert.deepEqual(robots, original, 'simulation order is unchanged');
  high.y = 400;
  assert.deepEqual(Array.from(context.robotDrawOrder(robots)), [middle, mouse, low, high], 'order updates as octopi move');
});

test('octopus rises and dives behind a wavy waterline without squashing', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, key) { return key in target ? target[key] : (...args) => operations.push([key, ...args]); },
    set(target, key, value) { operations.push(['set', key, value]); target[key] = value; return true; },
  });
  const context = vm.createContext({ ctx, drawScaredFace() {} });
  vm.runInContext(source.slice(source.indexOf('function drawRoboOctopus('), source.indexOf('function drawRobotExplosion(')), context);
  for (const [state, time, offset] of [
    ['rise', 0, 74], ['rise', .225, 37], ['rise', .45, 0],
    ['dive', 0, 0], ['dive', .225, 37], ['dive', .45, 74],
  ]) {
    operations.length = 0;
    context.drawRoboOctopus({ type: 'robo-octopus-blue', octopusState: state, octopusTime: time, age: 0 });
    assert.deepEqual(operations.filter(op => op[0] === 'scale'), [['scale', .75, .75]]);
    assert.ok(operations.some(op => op[0] === 'set' && op[1] === 'strokeStyle' && op[2] === '#54bde8'));
    assert.ok(operations.some(op => op[0] === 'quadraticCurveTo'), 'water surface has waves');
    const clip = operations.findIndex(op => op[0] === 'clip');
    const translation = operations.findIndex(op => op[0] === 'translate' && op[1] === 0 && op[2] === offset);
    assert.ok(clip >= 0 && translation > clip, 'body moves behind the stationary waterline');
  }
});

test('octopus waterline is clipped to rounded water terrain, not other terrain or its body', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, key) { return key in target ? target[key] : (...args) => operations.push([key, ...args]); },
    set(target, key, value) { operations.push(['set', key, value]); target[key] = value; return true; },
  });
  class Path2D { constructor(data) { this.data = data; } }
  const context = vm.createContext({ ctx, Path2D, terrainPathData, drawScaredFace() {} });
  vm.runInContext(source.slice(source.indexOf('function drawRoboOctopus('), source.indexOf('function drawRobotExplosion(')), context);
  const nodes = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const enemy = { type: 'robo-octopus-red', x: 90, y: 70, octopusState: 'pause', age: 0 };
  const terrain = { type: 'water', path: { nodes } };
  const otherNodes = nodes.map(({ x, y }) => ({ x: x + 120, y }));
  context.drawRoboOctopus(enemy, null, null, [terrain, { ...terrain, type: 'ice' },
    { type: 'water', path: { nodes: otherNodes } }]);
  const terrainClips = operations.filter(op => op[0] === 'clip' && op[1] instanceof Path2D);
  assert.equal(terrainClips.length, 2);
  assert.equal(terrainClips[0][1].data, terrainPathData(nodes));
  assert.equal(terrainClips[1][1].data, terrainPathData(otherNodes));
  const terrainClip = operations.findIndex(op => op === terrainClips[0]);
  const bodyClip = operations.findIndex(op => op[0] === 'clip' && op.length === 1);
  assert.ok(operations.slice(terrainClip + 1, bodyClip).some(op => op[0] === 'stroke'));
  assert.ok(operations.slice(terrainClip + 1, bodyClip).some(op => op[0] === 'restore'),
    'terrain clipping is restored before drawing the body');

  operations.length = 0;
  context.drawRoboOctopus(enemy, null, null, [{ ...terrain, type: 'lava' }]);
  assert.ok(!operations.some(op => op[0] === 'clip' && op[1] instanceof Path2D),
    'non-water terrain does not produce a waterline');
  const outline = operations.findIndex(op => op[0] === 'set' && op[1] === 'strokeStyle' && op[2] === '#6b1f1c');
  assert.ok(!operations.slice(0, outline).some(op => op[0] === 'stroke'),
    'no waterline is stroked without water terrain');
});
