const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, ITEMS, validateCustomLevel, brickRegions } = require('../src/game.js');
const { spawnSymbol } = require('../src/brick-visuals.js');

const level = events => ({ version: 1, id: 'Ditto tests', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events });
function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: level([]) });
  game.start();
  return game;
}
function edgeBrick(game, edge) {
  const regions = brickRegions(game.bricks, game.width, game.height);
  return game.bricks.filter(brick => regions.get(brick.id).edge === edge)
    .sort((a, b) => Math.hypot(a.x + a.w / 2 - game.width / 2, a.y + a.h / 2 - game.height / 2)
      - Math.hypot(b.x + b.w / 2 - game.width / 2, b.y + b.h / 2 - game.height / 2))[0];
}
function aim(game, brick) {
  assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
}
function land(game) {
  for (let i = 0; i < 400 && (game.cat.vx || game.cat.vy); i++) game.update(.01);
  assert.equal(game.cat.vx, 0);
  assert.equal(game.cat.vy, 0);
}
function depart(game, source, target) {
  Object.assign(game.cat, game.portalExit(source), { vx: 0, vy: 0 });
  // portalExit leaves a small clearance; put Koshi exactly against the surface.
  game.cat.x -= game.cat.nx * .01; game.cat.y -= game.cat.ny * .01;
  if (game.dittoStamp && !game.dittoSource && game.sawStartedAt === null) {
    game.stampBrick(source, game.brickParts());
  }
  aim(game, target);
}

test('random stamps leave two Koshi widths beyond their artwork from every brick part', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const game = arena(options);
    game.bricks[0].warped = 10;
    game.absorbNeighbor(game.bricks[0]);
    game.random = () => 0;
    const check = stamp => {
      for (const part of game.brickParts()) {
        const distance = Math.hypot(stamp.x - Math.max(part.x, Math.min(part.x + part.w, stamp.x)),
          stamp.y - Math.max(part.y, Math.min(part.y + part.h, stamp.y)));
        assert.ok(distance - 27 >= game.cat.radius * 4);
      }
    };
    check(game.createCollectible(2, 'ditto-stamp', 5));
    const brick = game.bricks.find(brick => brick.absorbedBy === null);
    brick.spawner = { kind: 'item', type: 'ditto-stamp', lifetime: 3 };
    game.spawnFromBrick(brick);
    check(game.items[0]);
    assert.equal(game.items[0].expires, game.elapsed + 3);

    const event = [2, 'ditto-stamp', 5];
    const reserved = { ...game.pointFromRelative(0, 0), type: 'ditto-stamp', born: 2, expires: 7, lifetime: 5 };
    game.pendingSpawns.set(event, { kind: 'item', time: 2, items: [reserved] });
    const [stamp] = game.takeSpawn(event, () => assert.fail('must consume the reserved stamp'));
    check(stamp);
    assert.equal(stamp.expires, 7);
    assert.equal(game.pendingSpawns.size, 0);
  }
});

test('explicit Ditto Stamp placements are not relocated away from bricks', () => {
  const game = arena();
  const expected = game.pointFromRelative(0, 0);
  const [stamp] = game.createCustomSpawn({ time: 0, kind: 'item', type: 'ditto-stamp', x: 0, y: 0 });
  assert.deepEqual({ x: stamp.x, y: stamp.y }, expected);
  assert.equal(game.stampSpawnClear(stamp), false);
});

test('Ditto Stamp placements and spawners support optional lifetimes and shared artwork', () => {
  const custom = { ...level([{ time: 0, kind: 'item', type: 'ditto-stamp', x: .5, y: .5, lifetime: 2 }]),
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'item', type: 'ditto-stamp', lifetime: 3 } }] };
  assert.deepEqual(validateCustomLevel(custom), custom);
  const game = new Game(() => .5, { customLevel: custom });
  game.start(); game.update(.01);
  assert.equal(game.dittoStamp, true);
  assert.equal(game.dittoSource, null);
  assert.ok(game.pickups.some(pickup => pickup.type === 'ditto-stamp'));
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  assert.equal(game.items[0].expires, game.elapsed + 3);
  assert.equal(game.items[0].type, 'ditto-stamp');
  assert.equal(ITEMS['ditto-stamp'].name, 'Ditto Stamp');
  const stampSymbol = spawnSymbol({ kind: 'item', type: 'ditto-stamp' });
  assert.ok(stampSymbol.includes('C-18 -12 -15 -28 0 -28'));
  assert.ok(stampSymbol.includes('M-20 16 H20 V23 H-20 Z'));
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  test(`Ditto copies properties, not geometry or spent state, in ${options.portrait ? 'portrait' : 'desktop'}`, () => {
    const game = arena(options), source = edgeBrick(game, 'bottom'), target = edgeBrick(game, 'top');
    Object.assign(source, { kind: 'fast', crumbler: 7, usesLeft: 2, toggle: 3, toggleRemaining: 1,
      warped: 20, slimed: true, slimeColor: 'red', readyAt: 40, spawned: true });
    Object.assign(target, { kind: 'slow', springs: true, conveyor: true, boost: true,
      spawner: { kind: 'heart', type: 'heart' }, spawned: true });
    const geometry = [target.id, target.x, target.y, target.w, target.h, target.region];
    game.collectItem({ type: 'ditto-stamp' });
    depart(game, source, target);
    source.kind = 'normal'; source.crumbler = 1;
    land(game);
    assert.equal(target.kind, 'fast', 'first-stop snapshot survives source changes');
    assert.equal(target.crumbler, 7); assert.equal(target.usesLeft, 7);
    assert.equal(target.toggle, 3); assert.equal(target.toggleRemaining, 3);
    assert.equal(target.readyAt, 0);
    assert.equal(target.warped, 20); assert.equal(target.warpUntil, null);
    assert.equal(target.slimed, true); assert.equal(target.slimeColor, 'red');
    assert.ok(game.stuckUntil > game.elapsed, 'copied slime applies on the same landing');
    assert.equal(target.springs, undefined); assert.equal(target.spawner, undefined);
    assert.equal(target.conveyor, undefined); assert.equal(target.boost, undefined);
    assert.equal(target.spawned, false); assert.equal(game.healing.length, 0);
    assert.deepEqual([target.id, target.x, target.y, target.w, target.h, target.region], geometry);
    assert.equal(game.dittoStamp, false); assert.equal(game.brickStamps.length, 1);
    game.pause(); const age = game.brickStamps[0].age;
    game.update(2); assert.equal(game.brickStamps[0].age, age);
    game.resume(); game.update(1); assert.equal(game.brickStamps.length, 0);
    game.reset(); assert.equal(game.dittoStamp, false); assert.equal(game.dittoSource, null);
    assert.equal(game.brickStamps.length, 0); assert.notEqual(game.bricks[target.id].crumbler, 7);
  });
}

test('pickup during flight captures the first landing, not the previous departure or a redirected target', () => {
  const game = arena(), source = edgeBrick(game, 'bottom'), target = edgeBrick(game, 'top');
  source.kind = 'fast';
  depart(game, source, target);
  game.update(.15);
  game.collectItem({ type: 'ditto-stamp' });
  const first = edgeBrick(game, 'right');
  first.kind = 'slow';
  aim(game, first);
  assert.equal(game.dittoSource, null);
  land(game);
  assert.equal(first.kind, 'slow');
  assert.equal(game.dittoSource.kind, 'slow');
  assert.equal(game.dittoStamp, true);
  const effect = game.brickStamps[0];
  assert.equal(effect.capturing, true);
  assert.equal(effect.x, first.x + first.w / 2);
  assert.equal(effect.y, first.y + first.h / 2);
  game.collectItem({ type: 'ditto-stamp' });
  first.kind = 'fast';
  const copyTarget = edgeBrick(game, 'left');
  copyTarget.readyAt = 0;
  aim(game, copyTarget); land(game);
  assert.equal(copyTarget.kind, 'slow', 'duplicates and source changes preserve the captured copy');
  assert.equal(game.dittoStamp, false); assert.equal(game.dittoSource, null);
  assert.equal(game.brickStamps[0].capturing, false);
  assert.equal(game.brickStamps[0].x, copyTarget.x + copyTarget.w / 2);
  assert.equal(game.brickStamps[0].y, copyTarget.y + copyTarget.h / 2);
});

test('first landing captures, second landing copies, and duplicate pickups do not stack', () => {
  const game = arena(), target = edgeBrick(game, 'top');
  game.collectItem({ type: 'ditto-stamp' }); game.collectItem({ type: 'ditto-stamp' });
  aim(game, target); land(game);
  assert.equal(game.dittoStamp, true);
  assert.equal(game.dittoSource.kind, target.kind);
  assert.equal(game.brickStamps[0].capturing, true);
  const next = edgeBrick(game, 'bottom');
  aim(game, next); land(game);
  assert.equal(game.dittoStamp, false);
  assert.equal(game.brickStamps.length, 1);
});

test('source presses use the center of the complete merged brick and capture without resetting it', () => {
  const game = arena(), source = edgeBrick(game, 'top');
  source.warped = 10; source.kind = 'fast';
  game.absorbNeighbor(source);
  source.readyAt = 40;
  game.collectItem({ type: 'ditto-stamp' });
  const revision = game.brickRevision;
  game.stampBrick(source, game.brickParts());
  const effect = game.brickStamps[0];
  assert.ok(effect.members.length > 1);
  assert.equal(effect.x, (Math.min(...effect.members.map(p => p.x))
    + Math.max(...effect.members.map(p => p.x + p.w))) / 2);
  assert.equal(effect.y, (Math.min(...effect.members.map(p => p.y))
    + Math.max(...effect.members.map(p => p.y + p.h))) / 2);
  assert.equal(effect.angle, Math.PI, 'top-edge press points rubber toward the brick');
  assert.equal(source.readyAt, 40);
  assert.equal(game.brickRevision, revision);
});

test('pickup while resting waits for a new stop; Springs and Portals do not capture a source', () => {
  const game = arena(), resting = edgeBrick(game, 'bottom'), portal = edgeBrick(game, 'top'),
    exit = edgeBrick(game, 'right'), source = edgeBrick(game, 'left');
  depart(game, resting, portal);
  land(game);
  game.collectItem({ type: 'ditto-stamp' });
  game.update(.1);
  assert.equal(game.dittoSource, null);
  portal.portal = exit.portal = 'red';
  assert.equal(game.stampBrick(portal, game.brickParts()), false);
  resting.springs = true;
  assert.equal(game.stampBrick(resting, game.brickParts()), false);
  aim(game, source); land(game);
  assert.equal(game.dittoSource.kind, source.kind);
  assert.equal(game.brickStamps[0].id, source.id);
});

test('Portal entry and exit do not consume or change the departure copy', () => {
  const game = arena(), source = edgeBrick(game, 'bottom'), portal = edgeBrick(game, 'top'), exit = edgeBrick(game, 'right');
  source.kind = 'slow'; portal.portal = exit.portal = 'red';
  game.collectItem({ type: 'ditto-stamp' });
  depart(game, source, portal);
  for (let i = 0; i < 200 && !game.portalTrips; i++) game.update(.01);
  assert.equal(game.portalTrips, 1);
  assert.equal(game.dittoStamp, true);
  assert.equal(portal.kind, 'normal'); assert.equal(exit.kind, 'normal');
  assert.equal(game.dittoSource.kind, 'slow');
  const target = edgeBrick(game, 'left');
  aim(game, target); land(game);
  assert.equal(target.kind, 'slow'); assert.equal(game.dittoStamp, false);
});

test('spawner configuration is independently copied and the fresh destination spawns immediately', () => {
  const game = arena(), source = edgeBrick(game, 'bottom'), target = edgeBrick(game, 'top');
  source.spawner = { kind: 'item', type: 'battery', lifetime: 7 };
  source.spawned = true;
  game.collectItem({ type: 'ditto-stamp' });
  depart(game, source, target); land(game);
  assert.deepEqual(target.spawner, source.spawner);
  assert.notEqual(target.spawner, source.spawner);
  assert.equal(target.spawned, true);
  assert.equal(game.items.length, 1);
  target.spawner.lifetime = 9;
  assert.equal(source.spawner.lifetime, 7);
});

for (const copiedSpikes of [false, true]) {
  test(`copied spikes=${copiedSpikes} determine collision and damage, not the destination's old spikes`, () => {
    const game = arena(), source = edgeBrick(game, 'bottom'), target = edgeBrick(game, 'top');
    source.spikes = copiedSpikes; target.spikes = !copiedSpikes;
    game.collectItem({ type: 'ditto-stamp' });
    depart(game, source, target); land(game);
    assert.equal(target.spikes, copiedSpikes);
    assert.equal(game.hearts, copiedSpikes ? 2 : 3);
    if (!copiedSpikes) assert.ok(game.brickParts().some(part => part.id === target.id && game.touchingPart(part)));
  });
}

test('stamping keeps an absorbed union intact but resets its warp timer', () => {
  const game = arena(), source = edgeBrick(game, 'bottom'), target = edgeBrick(game, 'top');
  target.warped = 10; game.absorbNeighbor(target);
  source.kind = 'fast';
  game.collectItem({ type: 'ditto-stamp' });
  depart(game, source, target);
  const before = game.brickParts().filter(part => part.id === target.id);
  land(game);
  assert.deepEqual(game.brickParts().filter(part => part.id === target.id), before);
  game.update(11);
  assert.deepEqual(game.brickParts().filter(part => part.id === target.id), before);
  assert.equal(target.warpUntil, null);
});

test('a saw takes priority and leaves the stamp equipped', () => {
  const game = arena(), source = edgeBrick(game, 'bottom'), target = edgeBrick(game, 'top');
  game.collectItem({ type: 'ditto-stamp' }); game.collectItem({ type: 'saw-blade' });
  depart(game, source, target); land(game);
  assert.equal(target.kind, 'cinder'); assert.equal(game.dittoStamp, true);
  assert.equal(game.brickStamps.length, 0);
});

for (const surface of ['springs', 'conveyor', 'boost']) {
  test(`copied ${surface} replaces the destination's original slime before contact`, () => {
    const game = arena(), source = edgeBrick(game, 'bottom'), target = edgeBrick(game, 'top');
    source[surface] = true;
    if (surface === 'conveyor') source.conveyorDirection = 'counterclockwise';
    target.slimed = true;
    game.collectItem({ type: 'ditto-stamp' });
    if (surface === 'springs') {
      source.springs = false;
      game.stampBrick(source, game.brickParts());
      game.dittoSource.springs = source.springs = true;
    }
    depart(game, source, target);
    for (let i = 0; i < 250 && game.dittoStamp; i++) game.update(.01);
    assert.equal(game.dittoStamp, false);
    assert.equal(game.stuckUntil, 0);
    assert.equal(target[surface], true);
    if (surface === 'springs') {
      assert.ok(game.cat.vy > 0);
      assert.notEqual(target.hitAt, null);
    } else if (surface === 'conveyor') {
      assert.equal(game.conveyorRide.id, target.id);
      assert.equal(target.conveyorDirection, 'counterclockwise');
    } else assert.equal(game.boostReady, true);
  });
}

test('a stamp collected in the landing sweep captures the actual spiked brick without replacing it', () => {
  const game = arena(), source = edgeBrick(game, 'bottom'), target = edgeBrick(game, 'top');
  target.spikes = true; source.kind = 'fast';
  depart(game, source, target);
  const exit = game.portalExit(target);
  Object.assign(game.cat, { x: exit.x, y: exit.y + 60, vx: 0, vy: -420 });
  game.items = [{ x: exit.x, y: exit.y + 30, type: 'ditto-stamp' }];
  game.tick(.2);
  assert.equal(target.kind, 'normal'); assert.equal(target.spikes, true);
  assert.equal(game.hearts, 2);
  assert.equal(game.dittoStamp, true);
  assert.equal(game.dittoSource.spikes, true);
  assert.equal(game.brickStamps[0].capturing, true);
});

test('a stamp beyond the first wall cannot change collision geometry before pickup', () => {
  const game = arena(), source = edgeBrick(game, 'bottom'), target = edgeBrick(game, 'top');
  source.spikes = true;
  depart(game, source, target);
  const exit = game.portalExit(target);
  Object.assign(game.cat, { x: exit.x, y: exit.y + 60, vx: 0, vy: -420 });
  game.items = [{ x: exit.x, y: -100, type: 'ditto-stamp' }];
  game.tick(.5);
  assert.equal(target.spikes, undefined);
  assert.equal(game.hearts, 3);
  assert.equal(game.brickStamps.length, 0);
  assert.equal(game.dittoStamp, false);
  assert.ok(Math.abs(game.cat.y - (target.y + target.h + game.cat.radius)) < 1e-6);
});

test('a spike-tip stop after pickup captures the source and copies it on the next landing', () => {
  const game = arena(), source = edgeBrick(game, 'top'), target = edgeBrick(game, 'bottom');
  source.spikes = true;
  game.collectItem({ type: 'ditto-stamp' });
  aim(game, source); land(game);
  assert.ok(game.spikeTouching.has(source.id));
  aim(game, target);
  assert.equal(game.dittoSource.spikes, true);
  land(game);
  assert.equal(target.spikes, true); assert.equal(game.dittoStamp, false);
});

test('cinder is a copyable property and existing cinder can receive a copy on physical contact', () => {
  for (const sourceCinder of [false, true]) {
    const game = arena(), source = edgeBrick(game, 'bottom'), target = edgeBrick(game, 'top');
    source.kind = sourceCinder ? 'cinder' : 'fast';
    game.collectItem({ type: 'ditto-stamp' }); depart(game, source, target);
    target.kind = 'cinder';
    land(game);
    assert.equal(target.kind, sourceCinder ? 'cinder' : 'fast');
    assert.equal(game.dittoStamp, false);
  }
});

test('stamp artwork has a straight-on wooden handle, even rubber base, grain, no sparkles, press and ripple', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1 }, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'createLinearGradient') return () => ({ addColorStop: (...args) => operations.push(['stop', ...args]) });
    return (...args) => operations.push([key, ...args]);
  } });
  const context = vm.createContext({ ctx, colors: { fast: '#df8c81' } });
  vm.runInContext(source.slice(source.indexOf('function drawDittoStamp('), source.indexOf('function drawBrickDestructionSmoke(')), context);
  context.drawDittoStamp();
  assert.equal(operations.filter(([key]) => key === 'stop').length, 3);
  assert.ok(operations.some(([key]) => key === 'bezierCurveTo'), 'round knob and wood grain');
  assert.ok(operations.some(([key]) => key === 'clip'), 'grain stays inside the handle');
  assert.deepEqual(operations.find(([key]) => key === 'rect'), ['rect', -20, 16, 40, 7],
    'rubber spans the base with a constant seven-unit thickness');
  assert.ok(operations.some(op => op[0] === 'roundRect' && op[1] === -22 && op[2] === 3
    && op[3] === 44 && op[4] === 13), 'wooden base ends exactly at the rubber top');
  assert.ok(!operations.some(([key]) => ['fillRect', 'strokeRect', 'arc', 'rotate'].includes(key)),
    'no background, cast shadow, brick emblem or sparkle stars');
  assert.ok(source.includes("['magic-sunglasses', 'spooky-mask', 'ditto-stamp'].includes(pickup.type)"),
    'stamp pickup does not add sparkle-pop artwork');
  operations.length = 0;
  context.drawBrickStamp({ age: .2, kind: 'fast', x: 100, y: 50, members: [{ x: 80, y: 20, w: 40, h: 20 }] });
  assert.ok(operations.some(([key]) => key === 'clip'));
  assert.ok(operations.some(([key]) => key === 'arc'));
  assert.ok(operations.some(([key]) => key === 'scale'));
  for (const angle of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
    operations.length = 0;
    context.drawBrickStamp({ age: .24, capturing: true, kind: 'fast', angle,
      x: 100, y: 50, fromX: 200, fromY: 200, members: [{ x: 80, y: 40, w: 40, h: 20 }] });
    const [, x, y] = operations.find(([key]) => key === 'translate');
    const [, sx, sy] = operations.find(([key]) => key === 'scale');
    const [, rotation] = operations.find(([key]) => key === 'rotate');
    assert.ok(Math.abs(x - Math.sin(rotation) * 23 * .8 * sy - 100) < 1e-6);
    assert.ok(Math.abs(y + Math.cos(rotation) * 23 * .8 * sy - 50) < 1e-6,
      'rubber underside presses exactly at the brick center on every edge');
    assert.ok(sx > sy, 'impact squashes the stamp');
  }
});
