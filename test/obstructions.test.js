const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, LEVELS, OBJECTS, OBSTRUCTION_RADIUS, OBSTRUCTION_PATTERNS, obstructionGeometry, validateCustomLevel, snapWheel, brickRegions, brickEditRegions, COOLDOWNS } = require('../src/game.js');
const { drawObstruction, spawnSymbol, spawnColor } = require('../src/brick-visuals.js');

const blank = () => ({ version: 1, id: 'Obstruction tests', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [] });
const placement = (shape = 'circle', extra = {}) => ({ time: 0, kind: 'object', type: `obstruction-${shape}`, x: .5, y: .5, ...extra });
const shapes = ['circle', 'diamond', 'circle-large', 'diamond-large', 'rectangle-horizontal',
  'rectangle-vertical', 'rectangle-horizontal-large', 'rectangle-vertical-large'];
function arena(level = blank()) {
  const game = new Game(() => .5, { customLevel: level });
  game.start();
  return game;
}

function gap(actor, obstruction) {
  const x = Math.abs(actor.x - obstruction.x), y = Math.abs(actor.y - obstruction.y);
  if (OBJECTS[obstruction.type].obstruction === 'circle') return Math.hypot(x, y) - obstruction.radius - actor.radius;
  if (OBJECTS[obstruction.type].obstruction === 'rectangle') {
    const dx = x - obstruction.width / 2, dy = y - obstruction.height / 2;
    return Math.hypot(Math.max(0, dx), Math.max(0, dy)) + Math.min(0, Math.max(dx, dy)) - actor.radius;
  }
  const half = obstruction.radius / Math.SQRT2;
  const u = (x + y) / Math.SQRT2, v = Math.abs(y - x) / Math.SQRT2;
  const outside = Math.hypot(Math.max(0, u - half), Math.max(0, v - half));
  return (u < half && v < half ? Math.max(u, v) - half : outside) - actor.radius;
}

test('one object per shape supports every texture, schedules, spawners, persistence and restart', () => {
  assert.deepEqual(Object.keys(OBJECTS).filter(type => OBJECTS[type].obstruction), shapes.map(shape => `obstruction-${shape}`));
  for (const shape of shapes) for (const pattern of OBSTRUCTION_PATTERNS) {
    const appearance = { color: '#fe107e', patternColor: '#15ffe2', pattern };
    const level = { ...blank(), events: [placement(shape, appearance)],
      brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'object', type: `obstruction-${shape}`, ...appearance } }] };
    assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(level))), level);
    const game = arena(level);
    game.update(.01);
    assert.equal(game.obstructions.length, 1);
    assert.equal(game.soccerBalls.length, 0);
    assert.deepEqual(obstructionGeometry(game.obstructions[0]), obstructionGeometry(placement(shape)));
    for (const field of Object.keys(appearance)) assert.equal(game.obstructions[0][field], appearance[field]);
    game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
    assert.equal(game.obstructions.length, 2);
    assert.equal(game.obstructions[1].pattern, pattern);
    assert.equal(game.obstructions[1].color, appearance.color);
    game.pause(); game.update(5);
    assert.equal(game.obstructions.length, 2);
    game.reset();
    assert.equal(game.obstructions.length, 0);
    assert.ok(spawnSymbol(placement(shape)));
    assert.equal(spawnColor(placement(shape, appearance)), appearance.color);
  }
  assert.ok(LEVELS.every(level => !(level.events ?? []).some(event => OBJECTS[event.type]?.obstruction)));
});

test('large obstructions double both dimensions and rectangles retain their four-to-one aspect ratio', () => {
  for (const shape of ['circle', 'diamond', 'rectangle-horizontal', 'rectangle-vertical']) {
    const normal = obstructionGeometry(placement(shape)), large = obstructionGeometry(placement(`${shape}-large`));
    assert.equal(large.width, normal.width * 2);
    assert.equal(large.height, normal.height * 2);
    assert.equal(normal.width, shape === 'rectangle-horizontal' ? 192 : shape === 'rectangle-vertical' ? 48 : 96);
    assert.equal(normal.height, shape === 'rectangle-vertical' ? 192 : shape === 'rectangle-horizontal' ? 48 : 96);
    const icon = obstructionGeometry({ ...placement(`${shape}-large`), radius: 32 });
    assert.equal(Math.max(icon.width, icon.height), 64, 'guide illustrations fit without changing aspect ratio');
  }
});

test('every obstruction variant blocks swept motion from all four sides without altering velocity', () => {
  for (const shape of shapes) for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const game = arena(), obstruction = game.createObstruction({ x: 480, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    const old = { x: 480 + nx * 280, y: 300 + ny * 280 };
    const actor = { x: 480 - nx * 280, y: 300 - ny * 280, radius: 21, vx: -nx * 5000, vy: -ny * 5000 };
    game.moveAroundObstructions(actor, old);
    assert.ok(Math.abs(gap(actor, obstruction)) < 1e-4, `${shape} stops at its actual surface`);
    assert.equal(actor.vx, -nx * 5000); assert.equal(actor.vy, -ny * 5000);
    assert.ok((actor.x - 480) * nx + (actor.y - 300) * ny > 0, 'does not tunnel to the opposite side');
  }
});

test('rectangles slide along faces, collide with rounded actor corners and separate initial overlaps', () => {
  for (const shape of shapes.filter(shape => shape.startsWith('rectangle'))) {
    const game = arena(), obstruction = game.createObstruction({ x: 480, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    const left = 480 - obstruction.width / 2, top = 300 - obstruction.height / 2;
    const actor = { x: left + 10, y: top + 60, radius: 10, vx: 30, vy: 60 };
    game.moveAroundObstructions(actor, { x: left - 10, y: top + 20 });
    assert.ok(Math.abs(actor.x - (left - 10)) < 1e-4);
    assert.ok(actor.y > top + 20, 'tangential motion continues');
    const corner = { x: left + 10, y: top + 10, radius: 10 };
    game.moveAroundObstructions(corner, { x: left - 30, y: top - 30 }, true);
    assert.ok(Math.abs(gap(corner, obstruction)) < 1e-4);
    assert.ok(corner.x < left && corner.y < top, 'uses the rounded actor corner rather than an enlarged bounding box');
    const overlap = { x: 480, y: 300, radius: 21, vx: 0, vy: 0 };
    game.moveAroundObstructions(overlap, { x: 480, y: 300 });
    assert.ok(gap(overlap, obstruction) >= -1e-5, 'scheduled overlapping rectangles push to the nearest free face');
    assert.equal(overlap.vx, 0); assert.equal(overlap.vy, 0);
  }
});

function distanceToPath(x, y, points) {
  let distance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    distance = Math.min(distance, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return distance;
}

test('obstruction trajectory follows actual no-click motion for every variant without mutating game state', () => {
  for (const shape of shapes) {
    const game = arena(), obstruction = game.createObstruction({ x: 480, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    Object.assign(game.cat, { x: 200, y: 270, vx: 420, vy: 0 });
    game.target = { x: 900, y: 270 };
    const snapshot = structuredClone({ cat: game.cat, target: game.target, bricks: game.bricks,
      obstructions: game.obstructions, elapsed: game.elapsed });
    const points = game.trajectory();
    assert.deepEqual({ cat: game.cat, target: game.target, bricks: game.bricks,
      obstructions: game.obstructions, elapsed: game.elapsed }, snapshot);
    assert.deepEqual(game.trajectory(), points, 'forecast is deterministic');
    assert.deepEqual(points[0], [200, 270]);
    for (let frame = 0; frame < 1000; frame++) {
      const old = { ...game.cat };
      game.update(1 / 120);
      assert.ok(distanceToPath(game.cat.x, game.cat.y, points) < .02, `${shape} frame ${frame} follows the forecast`);
      if ((!game.cat.vx && !game.cat.vy) || Math.hypot(game.cat.x - old.x, game.cat.y - old.y) < 1e-5) break;
    }
    const end = points.at(-1);
    assert.ok(Math.hypot(end[0] - game.cat.x, end[1] - game.cat.y) < .02, `${shape} ends where Koshi actually stops`);
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i], [beforeX, beforeY] = points[i - 1];
      assert.ok(gap({ x: (x + beforeX) / 2, y: (y + beforeY) / 2, radius: game.cat.radius }, obstruction) >= -.02,
        'forecast segments do not cut through the obstruction');
    }
  }
});

test('head-on forecasts end at the obstruction, not at the original clicked target', () => {
  const game = arena();
  game.obstructions.push(game.createObstruction({ x: 480, y: 300 }, placement()));
  Object.assign(game.cat, { x: 200, y: 300, vx: 420, vy: 0 });
  game.target = { x: 900, y: 300 };
  const points = game.trajectory();
  assert.equal(points.length, 2, 'straight segments stay compact');
  assert.ok(Math.abs(points.at(-1)[0] - (480 - 48 - game.cat.radius)) < 1e-4);
  assert.equal(points.at(-1)[1], 300);
  game.update(1);
  assert.equal(game.cat.vx, 420, 'forecast does not change intended velocity');
  assert.ok(Math.hypot(...points.at(-1).map((value, i) => value - [game.cat.x, game.cat.y][i])) < 1e-4);
});

test('forecast handles a spring bounce followed by an obstruction without drawing through it', () => {
  const game = arena();
  for (const brick of game.bricks) brick.springs = true;
  game.obstructions.push(game.createObstruction({ x: 400, y: 300 }, placement()));
  Object.assign(game.cat, { x: 600, y: 300, vx: 420, vy: 0 });
  game.target = { x: 930, y: 300 };
  const points = game.trajectory();
  assert.equal(points.length, 3);
  assert.ok(points[1][0] > 600);
  assert.ok(Math.abs(points[2][0] - (400 + 48 + game.cat.radius)) < 1e-4);
  for (let frame = 0; frame < 300; frame++) {
    game.update(1 / 120);
    assert.ok(distanceToPath(game.cat.x, game.cat.y, points) < .02);
  }
});

test('diagonal sliding forecasts agree with live motion', () => {
  for (const shape of ['circle', 'diamond', 'rectangle-horizontal']) {
    const game = arena();
    game.obstructions.push(game.createObstruction({ x: 480, y: 300 }, placement(shape)));
    Object.assign(game.cat, { x: 300, y: 230, vx: 350, vy: 100 });
    const points = game.trajectory();
    assert.ok(points.length > 2, 'the obstruction changes the forecast direction');
    for (let frame = 0; frame < 900; frame++) {
      const old = { ...game.cat };
      game.update(1 / 120);
      assert.ok(distanceToPath(game.cat.x, game.cat.y, points) < .02, `${shape} frame ${frame} follows its diagonal forecast`);
      if ((!game.cat.vx && !game.cat.vy) || Math.hypot(game.cat.x - old.x, game.cat.y - old.y) < 1e-5) break;
    }
    assert.ok(Math.hypot(points.at(-1)[0] - game.cat.x, points.at(-1)[1] - game.cat.y) < .02);
  }
});

test('bumper deflection forecasts continue to the obstruction with the correct no-click endpoint', () => {
  const game = arena();
  game.obstructions.push(game.createObstruction({ x: 400, y: 300 }, placement()));
  game.bumpers.push(game.createBumper({ x: 700, y: 300 }, 'bumper-red'));
  Object.assign(game.cat, { x: 600, y: 300, vx: 420, vy: 0 });
  const snapshot = structuredClone(game.bumpers), points = game.trajectory();
  assert.deepEqual(game.bumpers, snapshot, 'forecast never marks a real bumper as hit');
  for (let frame = 0; frame < 300; frame++) {
    game.update(1 / 120);
    assert.ok(distanceToPath(game.cat.x, game.cat.y, points) < .02);
  }
  assert.ok(Number.isFinite(game.bumpers[0].hitAt), 'actual movement hits the bumper');
  assert.ok(game.cat.vx < 0);
  assert.ok(Math.hypot(points.at(-1)[0] - game.cat.x, points.at(-1)[1] - game.cat.y) < .02);
});

test('invalid obstruction textures fail explicitly instead of being silently dropped', () => {
  for (const extra of [{ color: 'red' }, { color: '#123' }, { patternColor: 10 }, { pattern: 'unknown' }]) {
    assert.throws(() => validateCustomLevel({ ...blank(), events: [placement('circle', extra)] }), /invalid obstruction/);
    assert.throws(() => validateCustomLevel({ ...blank(), brickTypes: [
      { edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'object', type: 'obstruction-circle', ...extra } },
    ] }), /invalid obstruction/);
  }
  assert.throws(() => validateCustomLevel({ ...blank(), events: [placement('circle', { type: 'soccer-ball', pattern: 'solid' })] }), /only supported for obstructions/);
});

test('head-on obstruction contact stops position but preserves Koshi velocity, target and speed', () => {
  for (const shape of ['circle', 'diamond']) {
    const game = arena(), obstruction = game.createObstruction({ x: 400, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    Object.assign(game.cat, { x: 200, y: 300, vx: 420, vy: 0 });
    const target = game.target = { x: 800, y: 300 };
    game.update(1);
    assert.ok(Math.abs(game.cat.x - (400 - OBSTRUCTION_RADIUS - game.cat.radius)) < 1e-4);
    assert.ok(gap(game.cat, obstruction) >= -1e-5);
    assert.equal(game.cat.vx, 420); assert.equal(game.cat.vy, 0);
    assert.equal(game.target, target);
    const x = game.cat.x;
    game.update(.5);
    assert.ok(Math.abs(game.cat.x - x) < 1e-5, 'head-on contact can remain stuck');
    assert.equal(game.cat.vx, 420); assert.equal(game.cat.vy, 0);
    assert.deepEqual({ x: obstruction.x, y: obstruction.y }, { x: 400, y: 300 });
  }
});

test('off-center contact slides around either shape while retaining the exact intended velocity', () => {
  for (const shape of ['circle', 'diamond']) {
    const game = arena(), obstruction = game.createObstruction({ x: 400, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    Object.assign(game.cat, { x: 250, y: 270, vx: 180, vy: 0 });
    for (let frame = 0; frame < 240; frame++) {
      game.update(1 / 120);
      assert.equal(game.cat.vx, 180); assert.equal(game.cat.vy, 0);
      assert.ok(gap(game.cat, obstruction) >= -1e-5, `${shape} frame ${frame} is outside`);
    }
    assert.ok(game.cat.x > obstruction.x + obstruction.radius, 'Koshi passes the obstacle by sliding');
    assert.ok(game.cat.y < 270, 'actual movement is deflected');
  }
});

test('swept collisions prevent tunneling through circles, diamond faces and tips at high speeds', () => {
  for (const shape of ['circle', 'diamond']) for (const y of [300, 270, 245]) {
    const game = arena(), obstruction = game.createObstruction({ x: 400, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    const actor = { x: 750, y, radius: 21, vx: 5000, vy: 0 };
    game.moveAroundObstructions(actor, { x: 150, y });
    assert.ok(gap(actor, obstruction) >= -1e-5);
    assert.equal(actor.vx, 5000); assert.equal(actor.vy, 0);
    if (y === 300) assert.ok(actor.x < 400);
  }
});

test('diagonal contact preserves both velocity components and the original steering target', () => {
  for (const shape of ['circle', 'diamond']) for (const sign of [-1, 1]) {
    const game = arena(), obstruction = game.createObstruction({ x: 450, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    Object.assign(game.cat, { x: 450 - sign * 100, y: 200, vx: sign * 150, vy: 150 });
    const target = game.target = { x: 450 + sign * 200, y: 500 };
    for (let frame = 0; frame < 60; frame++) {
      game.update(1 / 120);
      assert.equal(game.cat.vx, sign * 150); assert.equal(game.cat.vy, 150);
      assert.ok(gap(game.cat, obstruction) >= -1e-5);
      assert.equal(game.target, target);
    }
  }
});

test('diamond empty corners do not act like its bounding box', () => {
  const game = arena(), obstruction = game.createObstruction({ x: 400, y: 300 }, placement('diamond'));
  game.obstructions.push(obstruction);
  const actor = { x: 446, y: 346, radius: 10 };
  game.moveAroundObstructions(actor, { x: 446, y: 380 });
  assert.deepEqual(actor, { x: 446, y: 346, radius: 10 });
});

test('scheduled obstructions separate an overlapping Koshi without changing his velocity', () => {
  for (const shape of ['circle', 'diamond']) {
    const game = arena({ ...blank(), events: [placement(shape)] });
    game.update(.01);
    assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0);
    assert.ok(gap(game.cat, game.obstructions[0]) >= -1e-5);
    assert.equal(game.hearts, 3);
  }
});

test('all roaming enemy types are blocked, including charging, sleeping and frightened enemies', () => {
  for (const shape of shapes) for (const type of ['mouse', 'ram', 'bucket', 'ball', 'jackolantern', 'goalie', 'robo-koshi', 'robo-snail', 'robo-unicorn']) {
    const game = arena(), obstruction = game.createObstruction({ x: 400, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .2, y: .4 })[0];
    for (const mode of ['moving', 'sleeping', 'afraid']) {
      enemy.x = 600; enemy.y = 300; enemy.asleep = mode === 'sleeping'; enemy.afraid = mode === 'afraid';
      game.blockEnemyWithObstructions(enemy, { x: 200, y: 300 });
      assert.ok(enemy.x < 400, `${type} ${mode} stays on the incoming side`);
      assert.ok(gap(enemy, obstruction) >= -1e-5);
    }
  }
});

test('real combat motion cannot move any roaming robot through an obstruction', () => {
  for (const shape of ['circle', 'diamond']) for (const type of ['mouse', 'ram', 'bucket', 'ball', 'jackolantern', 'robo-koshi', 'robo-snail', 'robo-unicorn']) {
    const game = arena(), obstruction = game.createObstruction({ x: 400, y: 300 }, placement(shape));
    game.obstructions.push(obstruction);
    const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .2, y: .5 })[0];
    Object.assign(enemy, { x: 330, y: 300, phase: 0, vx: 180, vy: 0, angle: 0 });
    if (type === 'ram') { enemy.state = 'charging'; enemy.speed = 450; }
    if (type === 'robo-unicorn') {
      enemy.unicornState = 'charge'; enemy.chargeAngle = 0; enemy.mouthOpen = true;
      game.food.push({ x: 600, y: 300, type: 'S', expires: 20, lifetime: 20 });
    }
    game.robots = [enemy];
    for (let frame = 0; frame < 12; frame++) {
      game.combat(1 / 120, game.cat.x, game.cat.y);
      assert.ok(gap(enemy, obstruction) >= -1e-5, `${type} remains outside ${shape}`);
    }
  }
});

test('perimeter enemies stop at obstructions without leaving their boundary routes', () => {
  for (const shape of shapes) for (const type of ['wheel', 'snake', 'robo-cow']) {
    const game = arena(), bounds = game.bounds();
    const obstruction = game.createObstruction({ x: 450, y: bounds.top }, placement(shape));
    game.obstructions.push(obstruction);
    const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .2, y: 0 })[0];
    game.robots = [enemy];
    for (let frame = 0; frame < 360; frame++) {
      game.combat(1 / 120, game.cat.x, game.cat.y);
      assert.equal(enemy.y, bounds.top);
      assert.ok(gap(enemy, obstruction) >= -1e-5);
      if (type === 'snake') for (const segment of game.snakeSegments(enemy)) {
        assert.ok(gap({ ...segment, radius: segment.radius + (segment.index ? 5 : 0) }, obstruction) >= -1e-5);
      }
    }
  }
});

test('perimeter robots and the whole snake body separate from newly overlapping obstructions', () => {
  for (const type of ['wheel', 'snake', 'robo-cow']) {
    const game = arena(), bounds = game.bounds();
    const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: .5, y: 0 })[0];
    const obstruction = game.createObstruction({ x: enemy.x, y: bounds.top }, placement());
    game.obstructions.push(obstruction);
    game.blockEnemyWithObstructions(enemy, { x: enemy.x, y: enemy.y, distance: enemy.distance });
    assert.equal(enemy.y, bounds.top);
    const segments = type === 'snake' ? game.snakeSegments(enemy) : [enemy];
    for (const [index, segment] of segments.entries()) {
      assert.ok(gap({ ...segment, radius: segment.radius + (index ? 5 : 0) }, obstruction) >= -1e-5);
    }
  }
});

test('obstructions do not disable real boundary-brick or bumper collision responses', () => {
  const game = arena();
  game.obstructions.push(game.createObstruction({ x: 400, y: 300 }, placement('diamond')));
  Object.assign(game.cat, { x: 150, y: 180, vx: 0, vy: -200 });
  game.update(1);
  assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0, 'bricks still stop Koshi');
  game.bumpers.push(game.createBumper({ x: 300, y: 400 }, 'bumper-red'));
  Object.assign(game.cat, { x: 240, y: 400, vx: 100, vy: 0 });
  game.update(.3);
  assert.equal(game.cat.vx, -125, 'bumpers still reflect and multiply speed');
});

test('obstruction graphics clip every pattern to its shape and use both chosen colors', () => {
  for (const shape of shapes) for (const pattern of OBSTRUCTION_PATTERNS) {
    const calls = [], stack = [], stops = [];
    const gradient = { addColorStop: (...args) => stops.push(args) };
    const ctx = new Proxy({ fillStyle: '', globalAlpha: 1 }, {
      get(target, name) {
        if (name in target) return target[name];
        if (name === 'save') return () => stack.push({ ...target });
        if (name === 'restore') return () => Object.assign(target, stack.pop());
        if (name === 'createLinearGradient') return () => gradient;
        return (...args) => calls.push({ name, args, color: target.fillStyle, stroke: target.strokeStyle, width: target.lineWidth });
      },
    });
    drawObstruction(ctx, { ...placement(shape), x: 100, y: 100, color: '#123456', patternColor: '#abcdef', pattern });
    assert.ok(calls.some(call => call.name === 'fill' && call.color === '#123456'));
    assert.equal(calls.filter(call => call.name === 'clip').length, 1);
    assert.equal(calls.filter(call => call.name === 'stroke').length, 2);
    assert.ok(calls.some(call => call.name === 'stroke' && call.stroke === gradient && call.width === 12), 'clipped boundary shading adds depth');
    assert.equal(stops[0][1], '#ffffff99');
    assert.equal(stops.at(-1)[1], '#00000099');
    assert.equal(stack.length, 0);
    if (pattern !== 'solid') assert.ok(calls.some(call => ['fill', 'fillRect'].includes(call.name) && call.color === '#abcdef'));
  }
});

test('the editor provides the same 100 unique color presets for both colors and both placement methods', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const makeNode = () => ({
    children: [], style: {}, attributes: {}, listeners: {},
    append(...items) { this.children.push(...items); },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(name, callback) { this.listeners[name] = callback; },
  });
  const inputs = new Map(), menus = [];
  for (const prefix of ['event', 'brick-spawn']) for (const field of ['color', 'patternColor']) {
    inputs.set(`#${prefix}-${field}`, { value: '#123456', events: [],
      parentElement: { after: node => menus.push(node) },
      dispatchEvent(event) { this.events.push(event.type); },
    });
  }
  const context = vm.createContext({ $: selector => inputs.get(selector), document: { createElement: makeNode },
    Event: class { constructor(type) { this.type = type; } } });
  const start = source.indexOf('const OBSTRUCTION_COLORS =');
  vm.runInContext(source.slice(start, source.indexOf('\n];', start) + 3), context);
  const setup = source.indexOf('function setupObstructionColors(');
  vm.runInContext(source.slice(setup, source.indexOf('\nfunction ', setup + 1)), context);
  context.setupObstructionColors();
  assert.equal(menus.length, 4);
  const colors = menus[0].children[1].children.map(button => button.style.backgroundColor);
  assert.equal(colors.length, 100);
  assert.equal(new Set(colors).size, 100);
  assert.ok(colors.every(color => /^#[0-9a-f]{6}$/.test(color)));
  assert.ok(colors.includes('#000000') && colors.includes('#ffffff'));
  const saturation = color => {
    const rgb = color.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255);
    return Math.max(...rgb) - Math.min(...rgb);
  };
  assert.ok(colors.filter(color => saturation(color) > .6).length >= 25, 'includes bold colors');
  assert.ok(colors.filter(color => saturation(color) > 0 && saturation(color) < .3).length >= 25, 'includes muted colors');
  for (const [index, input] of [...inputs.values()].entries()) {
    const buttons = menus[index].children[1].children;
    assert.deepEqual(buttons.map(button => button.style.backgroundColor), colors);
    assert.ok(buttons.every(button => button.type === 'button' && button.attributes['aria-label'].includes(button.style.backgroundColor)));
    buttons[27].listeners.click();
    assert.equal(input.value, colors[27]);
    assert.deepEqual(input.events, ['input', 'change'], 'uses existing placement and spawner saving behavior');
    input.value = '#012345';
    assert.equal(input.value, '#012345', 'custom colors are not limited to presets');
  }
});

function editorFixture() {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const nodes = new Map(), $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', dataset: {}, querySelector: () => null,
      replaceChildren() {}, prepend() {}, setAttribute() {} });
    return nodes.get(selector);
  };
  const context = vm.createContext({ $, OBJECTS, Game, snapWheel, brickRegions, brickEditRegions, COOLDOWNS,
    level: blank(), selectedEvents: new Set(), touched: new Set(), MIXED: '',
    common: values => values.every(value => value === values[0]) ? values[0] : '',
    mixedOption: input => { input.value = ''; },
    document: { createElement: () => ({}) }, selectedList: () => [...context.selectedEvents],
    readOnly: () => false, validateDraft: validateCustomLevel, markChanged() {}, setSelection() {},
    syncPalettes() {}, message() {}, plural: (count, word) => `${count} ${word}s`,
  });
  vm.runInContext(source.slice(source.indexOf('function typeOptions('), source.indexOf('function description(')), context);
  vm.runInContext(source.slice(source.indexOf('function readEvent('), source.indexOf('function setSelection(')), context);
  vm.runInContext(source.slice(source.indexOf('function applyToSelected('), source.indexOf("form.addEventListener('submit'")), context);
  return { $, context, source };
}

test('editor placement and multiselection preserve independent obstruction texture fields', () => {
  const { $, context } = editorFixture();
  $('#event-kind').value = 'object'; $('#event-type').value = 'obstruction-diamond';
  $('#event-time').value = '0'; $('#event-x').value = '50'; $('#event-y').value = '50';
  $('#event-color').value = '#123456'; $('#event-patternColor').value = '#abcdef'; $('#event-pattern').value = 'stripes';
  context.typeOptions('obstruction-diamond');
  assert.equal($('#event-obstruction').hidden, false);
  const event = context.readEvent();
  assert.equal(event.color, '#123456'); assert.equal(event.pattern, 'stripes');
  context.level.events = [event, placement('circle', { color: '#fedcba', pattern: 'polka-dots' })];
  context.selectedEvents = new Set([0, 1]);
  context.populateEventForm();
  assert.match($('#event-color').title, /Mixed/);
  assert.equal($('#event-obstruction').disabled, false);
  $('#event-pattern').value = 'checkered'; context.touched.add('#event-pattern');
  context.applyToSelected();
  assert.ok(context.level.events.every(event => event.pattern === 'checkered'));
  assert.deepEqual(Array.from(context.level.events, event => event.color), ['#123456', '#fedcba']);
  context.touched.clear();
  context.touched.add('#event-type'); $('#event-type').value = 'bumper-green';
  context.applyToSelected();
  assert.ok(context.level.events.every(event => !Object.hasOwn(event, 'color') && !Object.hasOwn(event, 'pattern')));
});

test('editor obstruction spawners retain appearance when other brick attributes change', () => {
  const { $, context, source } = editorFixture();
  const { CONTACT_SURFACES } = require('../src/game.js');
  Object.assign(context, { CONTACT_SURFACES, immutableBrick: kind => ['cinder', 'goal'].includes(kind),
    regionKey: region => `${region.edge}:${region.start}:${region.end}`, attempt: action => action(), renderBoard() {} });
  context.previewGame = new Game(() => .5, { customLevel: blank(), editorPreview: true });
  const brick = context.previewGame.bricks[context.previewGame.perimeter[0]];
  context.selectedBricks = new Set([context.regionKey(brick.region)]);
  vm.runInContext(source.slice(source.indexOf('function brickEntry('), source.indexOf('function combineBricks(')), context);
  $('#brick-spawn-item').value = 'object:obstruction-circle';
  $('#brick-spawn-color').value = '#654321'; $('#brick-spawn-pattern').value = 'checkered';
  $('#brick-spawn-patternColor').value = '#badfed';
  context.saveBrick({ target: { id: 'brick-spawn-item' } });
  const spawn = context.level.brickTypes[0].spawner;
  assert.equal(spawn.color, '#654321'); assert.equal(spawn.pattern, 'checkered');
  context.previewGame = new Game(() => .5, { customLevel: context.level, editorPreview: true });
  $('#brick-kind').value = 'slow';
  context.saveBrick({ target: { id: 'brick-kind' } });
  assert.equal(context.level.brickTypes[0].spawner.patternColor, '#badfed');
});
