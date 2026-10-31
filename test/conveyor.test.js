const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, LEVELS, SPEED, CONVEYOR_SPEED, COOLDOWNS, SLIMES, SWORDS, brickRegions, brickEditRegions, brickConveyor, validateCustomLevel } = require('../src/game.js');

const blank = { version: 1, id: 'Conveyors', duration: 120, goal: 1000, heartCost: null, brickSet: 1, events: [] };
function setup(edge = 'top', direction = 'clockwise', options = {}) {
  const base = new Game(() => .99, options);
  const ids = [...brickRegions(base.bricks, base.width, base.height)].filter(([, region]) => region.edge === edge).map(([id]) => id);
  const id = ids[Math.floor(ids.length / 2)];
  const region = brickEditRegions(base.bricks).get(id);
  const game = new Game(() => .99, { ...options, customLevel: {
    ...blank, brickTypes: [{ ...region, kind: 'fast', conveyor: true, conveyorDirection: direction, crumbler: 3 }],
  } });
  game.start();
  return { game, brick: game.bricks[id] };
}
function land(game, brick) {
  const edge = brickRegions(game.bricks, game.width, game.height).get(brick.id).edge;
  const [nx, ny] = { top: [0, 1], bottom: [0, -1], left: [1, 0], right: [-1, 0] }[edge];
  game.cat.x = (nx ? (nx > 0 ? brick.x + brick.w : brick.x) : brick.x + brick.w / 2) + nx * (game.cat.radius + 10);
  game.cat.y = (ny ? (ny > 0 ? brick.y + brick.h : brick.y) : brick.y + brick.h / 2) + ny * (game.cat.radius + 10);
  game.cat.vx = -nx * SPEED; game.cat.vy = -ny * SPEED;
  game.update(.1);
}

test('conveyors validate, round-trip both directions, default clockwise, and replace all other surfaces', () => {
  for (const direction of ['clockwise', 'counterclockwise']) {
    const { game } = setup('top', direction);
    const level = validateCustomLevel(JSON.parse(JSON.stringify(game.customLevel)));
    assert.equal(level.brickTypes[0].conveyorDirection, direction);
    for (const options of [{}, { portrait: true, scale: .31 }]) {
      const restored = new Game(() => .99, { ...options, customLevel: level });
      assert.equal(restored.bricks.filter(brick => brick.conveyor).length, 1);
      assert.equal(restored.bricks.find(brick => brick.conveyor).conveyorDirection, direction);
    }
    const entry = level.brickTypes[0];
    for (const other of ['slimed', 'springs', 'spikes']) {
      assert.throws(() => validateCustomLevel({ ...level, brickTypes: [{ ...entry, [other]: true }] }), /cannot combine/);
      for (const attributes of [[other, 'conveyor'], ['conveyor', other]]) {
        const swapped = new Game(() => .99, { customLevel: {
          ...level, brickTypes: attributes.map(attribute => ({ edge: entry.edge, start: entry.start, end: entry.end, kind: 'fast', [attribute]: true })),
        } });
        const brick = swapped.bricks.find(brick => brick[attributes[1]]);
        assert.equal(brick[attributes[0]], false);
      }
    }
    for (const value of [null, 1, 'true', [], {}]) {
      assert.throws(() => validateCustomLevel({ ...level, brickTypes: [{ ...entry, conveyor: value }] }), TypeError);
    }
    for (const value of [null, 1, '', 'left', [], {}]) {
      assert.throws(() => validateCustomLevel({ ...level, brickTypes: [{ ...entry, conveyorDirection: value }] }), /unknown conveyor direction/);
    }
  }
  const { game, brick } = setup();
  delete brick.conveyorDirection;
  land(game, brick);
  game.update(.05);
  assert.equal(Math.hypot(game.cat.vx, game.cat.vy), CONVEYOR_SPEED);
  for (const level of LEVELS.slice(2)) assert.ok(level.brickTypes.some(entry => entry.conveyor));
  for (const level of LEVELS.slice(0, 2)) assert.ok(!level.brickTypes?.some(entry => entry.conveyor));
});

test('both belt directions carry at exactly belt speed on all four edges and layouts, then stop at the end', () => {
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .65 }]) {
    for (const side of ['top', 'bottom', 'left', 'right']) {
      for (const direction of ['clockwise', 'counterclockwise']) {
        const { game, brick } = setup(side, direction, options);
        game.brickParts = () => [brick];
        brick.readyAt = 50; brick.usesLeft = 0;
        land(game, brick);
        assert.deepEqual(game.conveyorRide, { id: brick.id });
        const edge = game.conveyorEdge(brick.id, [brick]);
        const sign = direction === 'clockwise' ? 1 : -1;
        const { x, y } = game.cat;
        game.update(.1);
        assert.ok(Math.abs(game.cat.x - x - edge.tx * sign * CONVEYOR_SPEED * .1) < 1e-7);
        assert.ok(Math.abs(game.cat.y - y - edge.ty * sign * CONVEYOR_SPEED * .1) < 1e-7);
        assert.equal(brick.readyAt, 50);
        assert.equal(brick.usesLeft, 0);
        game.update(5);
        const along = sign > 0 ? edge.length : 0;
        assert.ok(Math.abs(game.cat.x - (x + edge.tx * (along - edge.along))) < 1e-7);
        assert.ok(Math.abs(game.cat.y - (y + edge.ty * (along - edge.along))) < 1e-7);
        assert.equal(game.conveyorRide, null);
        assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0);
        const stopped = { ...game.cat };
        game.update(1);
        assert.deepEqual(game.cat, stopped);
        assert.equal(game.state, 'playing');
      }
    }
  }
});

test('carrying stops at a swept obstruction before the belt ends without tunneling or auto-restarting', () => {
  for (const attribute of [null, 'springs', 'slimed', 'spikes']) {
    const { game, brick } = setup('top', 'counterclockwise');
    land(game, brick);
    const blocker = game.bricks.find(other => other.id !== brick.id);
    if (attribute) blocker[attribute] = true;
    const wall = { id: blocker.id, x: game.cat.x + game.cat.radius + 8, y: game.cat.y - 40, w: 8, h: 80 };
    game.brickParts = () => [brick, wall];
    // The physical obstruction is enough for this test; spike geometry has its own swept tests.
    game.spikeParts = () => [];
    const x = game.cat.x;
    game.update(.2);
    assert.ok(Math.abs(game.cat.x - x - 8) < 1e-7);
    assert.equal(game.conveyorRide, null);
    assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0);
    if (attribute === 'spikes') assert.equal(game.hearts, 2);
    const stopped = { ...game.cat };
    game.update(1);
    assert.deepEqual(game.cat, stopped);
  }
});

test('riding pauses, resets, allows steering away, and collects items along its swept path', () => {
  const { game, brick } = setup();
  land(game, brick);
  const position = { ...game.cat }, time = game.elapsed;
  game.pause(); game.update(2);
  assert.equal(game.elapsed, time);
  assert.deepEqual(game.cat, position);
  game.resume();
  const edge = game.conveyorEdge(brick.id, game.brickParts());
  const point = { x: game.cat.x + edge.tx * 25, y: game.cat.y + edge.ty * 25 };
  game.food.push({ ...point, id: 0, type: 'S', expires: 100 });
  game.healing.push(point); game.hearts = 2;
  game.weapons.push({ ...point, type: 'bronze' });
  game.update(.2);
  assert.equal(game.score, 1);
  assert.equal(game.hearts, 3);
  assert.equal(game.weapon.type, 'bronze');
  const opposite = game.bricks.find(other => brickRegions(game.bricks, game.width, game.height).get(other.id).edge === 'bottom');
  assert.equal(game.steer(opposite.id, opposite.x + opposite.w / 2, opposite.y + opposite.h / 2), true);
  assert.equal(game.conveyorRide, null);
  assert.ok(game.cat.vy > 0);
  game.reset();
  assert.equal(game.conveyorRide, null);
  assert.equal(game.elapsed, 0);
});

test('warped conveyors carry across absorbed gaps and stop when the supporting member is restored', () => {
  const { game, brick } = setup('top');
  const top = game.bricks.filter(other => brickRegions(game.bricks, game.width, game.height).get(other.id).edge === 'top').sort((a, b) => a.x - b.x);
  const neighbor = top[top.indexOf(brick) + 1];
  neighbor.absorbedBy = brick.id;
  brick.warpUntil = 20;
  land(game, neighbor);
  assert.deepEqual(game.conveyorRide, { id: brick.id });
  const edge = game.conveyorEdge(brick.id, game.brickParts());
  assert.ok(edge.length > brick.w + neighbor.w);
  game.update((neighbor.w / 2 + (neighbor.x - brick.x - brick.w) + 5) / CONVEYOR_SPEED);
  assert.ok(game.cat.x < brick.x + brick.w);
  assert.deepEqual(game.conveyorRide, { id: brick.id });
  // Move onto the absorbed member again, then expire its owner's warp.
  game.cat.x = neighbor.x + neighbor.w / 2;
  brick.warpUntil = game.elapsed;
  game.update(.01);
  assert.equal(neighbor.absorbedBy, null);
  assert.equal(game.conveyorRide, null);
  assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0);
});

test('corner and non-arena-facing contact do not incorrectly attach to a belt', () => {
  const { game, brick } = setup();
  game.brickParts = () => [brick];
  game.cat.x = brick.x - game.cat.radius - 10;
  game.cat.y = brick.y + brick.h / 2;
  game.cat.vx = SPEED; game.cat.vy = 0;
  game.update(.1);
  assert.equal(game.conveyorRide, null);
  assert.equal(game.cat.vx, 0);
});

test('an absorbed perpendicular brick carries Koshi around a merged corner', () => {
  const { game } = setup('top', 'counterclockwise');
  const regions = brickRegions(game.bricks, game.width, game.height);
  const top = game.bricks.filter(brick => regions.get(brick.id).edge === 'top').sort((a, b) => a.x - b.x);
  const right = game.bricks.filter(brick => regions.get(brick.id).edge === 'right').sort((a, b) => a.y - b.y);
  const brick = top.at(-1), wall = right[0];
  brick.conveyor = true; brick.conveyorDirection = 'counterclockwise';
  wall.absorbedBy = brick.id;
  land(game, brick);
  assert.deepEqual(game.conveyorRide, { id: brick.id });
  const cornerX = wall.x - game.cat.radius, cornerY = brick.y + brick.h + game.cat.radius;
  const time = (cornerX - game.cat.x) / CONVEYOR_SPEED;
  game.update(time + .1);
  assert.ok(Math.abs(game.cat.x - cornerX) < 1e-5);
  assert.ok(Math.abs(game.cat.y - cornerY - CONVEYOR_SPEED * .1) < 1e-5);
  assert.deepEqual(game.conveyorRide, { id: brick.id });
  assert.ok(Math.abs(game.cat.vx) < 1e-7); assert.equal(game.cat.vy, CONVEYOR_SPEED);
});

test('warped conveyors follow all four corners in both directions and layouts without entering bricks', () => {
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .65 }]) {
    for (const [horizontal, vertical, end] of [['top', 'right', 1], ['bottom', 'right', 1], ['bottom', 'left', 0], ['top', 'left', 0]]) {
      for (const direction of ['clockwise', 'counterclockwise']) {
        const { game } = setup('top', direction, options);
        const regions = brickRegions(game.bricks, game.width, game.height);
        const hs = game.bricks.filter(brick => regions.get(brick.id).edge === horizontal).sort((a, b) => a.x - b.x);
        const vs = game.bricks.filter(brick => regions.get(brick.id).edge === vertical).sort((a, b) => a.y - b.y);
        const owner = hs[end ? hs.length - 1 : 0], neighbor = vs[horizontal === 'top' ? 0 : vs.length - 1];
        owner.conveyor = true; owner.conveyorDirection = direction;
        neighbor.absorbedBy = owner.id;
        // Include enough of both sides to leave a clear approach even with thick phone bricks.
        hs[end ? hs.length - 2 : 1].absorbedBy = owner.id;
        vs[horizontal === 'top' ? 1 : vs.length - 2].absorbedBy = owner.id;
        const clockwiseHorizontal = (horizontal === 'top' && vertical === 'left') || (horizontal === 'bottom' && vertical === 'right');
        const onHorizontal = direction === 'clockwise' ? clockwiseHorizontal : !clockwiseHorizontal;
        const start = onHorizontal ? hs[end ? hs.length - 2 : 1] : vs[horizontal === 'top' ? 1 : vs.length - 2];
        land(game, start);
        assert.deepEqual(game.conveyorRide, { id: owner.id }, JSON.stringify({ options, horizontal, vertical, direction }));
        const first = { x: game.cat.x, y: game.cat.y }, velocities = new Set();
        let distance = 0;
        for (let i = 0; i < 1000 && game.conveyorRide; i++) {
          const before = { x: game.cat.x, y: game.cat.y }, time = game.elapsed;
          game.update(1 / 120);
          const moved = Math.abs(game.cat.x - before.x) + Math.abs(game.cat.y - before.y);
          distance += moved;
          if (game.conveyorRide) assert.ok(Math.abs(moved - CONVEYOR_SPEED * (game.elapsed - time)) < 1e-5);
          velocities.add(`${Math.sign(game.cat.vx)},${Math.sign(game.cat.vy)}`);
          for (const part of game.brickParts()) {
            const separation = Math.hypot(game.cat.x - Math.max(part.x, Math.min(part.x + part.w, game.cat.x)),
              game.cat.y - Math.max(part.y, Math.min(part.y + part.h, game.cat.y)));
            assert.ok(separation >= game.cat.radius - 1e-5, 'Koshi must not enter a brick at a corner');
          }
        }
        assert.ok(velocities.size >= 3, 'ride must turn and eventually stop');
        assert.ok(Math.abs(game.cat.x - first.x) > .01 && Math.abs(game.cat.y - first.y) > .01,
          `ride must reach the other side of the corner: ${JSON.stringify({ options, horizontal, vertical, direction, first, cat: game.cat })}`);
        assert.ok(distance > 30);
        assert.equal(game.conveyorRide, null);
        assert.equal(game.state, 'playing');
      }
    }
  }
});

test('grey belt geometry wraps the entire perimeter with fine teeth, changes with time, and reverses', () => {
  const parts = [{ id: 0, x: 20, y: 8, w: 100, h: 30 }];
  const rest = brickConveyor(parts, 600, 960);
  assert.equal(rest.belt, 'M0 0L1 0L1 1L0 1L0 0Z');
  assert.ok(rest.teeth.split('M').length > 30);
  const firstTooth = rest.teeth.split('M')[1].replace('Z', '').split('L').map(point => point.split(' ').map(Number));
  assert.equal(Math.min(...firstTooth.map(([, y]) => y * parts[0].h)), -2);
  assert.equal(Math.max(...firstTooth.map(([, y]) => y * parts[0].h)), 3);
  const stylesheet = readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(stylesheet, /\.conveyor-belt \{[^}]*stroke-width: 5px;/);
  const moving = brickConveyor(parts, 600, 960, 2);
  const reverse = brickConveyor(parts, 600, 960, -2, 'counterclockwise');
  assert.equal(moving.teeth, reverse.teeth);
  assert.notEqual(rest.teeth, moving.teeth);
  assert.notEqual(rest.arrows, reverse.arrows);
  for (const geometry of [rest, moving, reverse]) {
    for (const path of Object.values(geometry)) assert.doesNotMatch(path, /NaN|Infinity/);
  }
});

test('UI updates conveyor teeth without requiring Springs, freezes on pause, and restores on reset', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const start = source.indexOf('function syncUI()');
  const synchronization = source.slice(start, source.indexOf('\nfunction ', start + 1));
  const node = () => ({
    attributes: {}, dataset: {}, style: { setProperty() {} }, classList: { toggle() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name]; },
  });
  for (const direction of ['clockwise', 'counterclockwise']) {
    const { game, brick } = setup('top', direction);
    const teeth = node(), members = game.brickParts().filter(part => part.id === brick.id);
    const context = vm.createContext({
      game, COOLDOWNS, SLIMES, SWORDS, CONVEYOR_SPEED, brickConveyor,
      document: { querySelector: () => node() },
      buttons: [{ brick, members, button: node(), counter: node(), usesLeft: brick.usesLeft, conveyor: { querySelector: () => teeth } }],
      timer: node(), foodCount: node(), hearts: node(), progress: node(), progressLabel: node(), weaponStatus: node(), pause: node(),
      displayedStuck: false, displayedState: 'playing', brickRevision: game.brickRevision, tutorial: null,
    });
    vm.runInContext(synchronization, context);
    context.syncUI();
    const initial = teeth.getAttribute('d');
    game.update(.013);
    context.syncUI();
    assert.notEqual(teeth.getAttribute('d'), initial);
    assert.equal(teeth.getAttribute('d'), brickConveyor(members, game.width, game.height, game.elapsed * CONVEYOR_SPEED, direction).teeth);
    game.pause(); context.displayedState = 'paused';
    const frozen = teeth.getAttribute('d');
    game.update(2); context.syncUI();
    assert.equal(teeth.getAttribute('d'), frozen);
    game.reset(); context.displayedState = 'ready'; context.brickRevision = game.brickRevision;
    context.syncUI();
    assert.equal(teeth.getAttribute('d'), initial);
  }
});
