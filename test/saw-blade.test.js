const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, ITEMS, LEVELS, brickRegions, validateCustomLevel } = require('../src/game.js');
const { traceSawBlade, spawnSymbol } = require('../src/brick-visuals.js');

const level = events => ({ version: 1, id: 'Saw tests', duration: 30, goal: 1000, heartCost: null, brickSet: 1, events });
function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: level([]) });
  game.start();
  return game;
}
function topBrick(game) {
  const regions = brickRegions(game.bricks, game.width, game.height);
  return game.bricks.filter(brick => regions.get(brick.id).edge === 'top')
    .sort((a, b) => Math.abs(a.x + a.w / 2 - game.cat.x) - Math.abs(b.x + b.w / 2 - game.cat.x))[0];
}
function launch(game, brick) {
  assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
  for (let i = 0; i < 200 && (game.cat.vx || game.cat.vy); i++) game.update(.01);
  assert.equal(game.cat.vx, 0);
  assert.equal(game.cat.vy, 0);
}

test('saw placements, spawners, optional expiry, and matching curved artwork are wired without campaign placement', () => {
  const event = { time: 0, kind: 'item', type: 'saw-blade', x: .5, y: .5, lifetime: .1 };
  const custom = { ...level([event]), brickTypes: [
    { edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'item', type: 'saw-blade', lifetime: 2 } },
  ] };
  assert.deepEqual(validateCustomLevel(custom), custom);
  const game = new Game(() => .5, { customLevel: custom });
  game.start(); game.update(.01);
  assert.notEqual(game.sawStartedAt, null);
  assert.ok(game.pickups.some(pickup => pickup.type === 'saw-blade'));
  const spawner = game.bricks.find(brick => brick.spawner);
  game.spawnFromBrick(spawner);
  assert.equal(game.items[0].type, 'saw-blade');
  assert.equal(game.items[0].expires, game.elapsed + 2);
  assert.ok(LEVELS.slice(0, 19).every(level => !level.items.some(([, type]) => type === 'saw-blade')));
  const symbol = spawnSymbol({ kind: 'item', type: 'saw-blade' });
  assert.equal((symbol.match(/Q/g) || []).length, 12, 'twelve curved teeth');
  assert.equal(ITEMS['saw-blade'].name, 'Saw Blade');
});

test('random saw spawns share stamp and brush clearance, while explicit placements stay at their markers', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const game = arena(options);
    game.bricks[0].warped = 10;
    game.absorbNeighbor(game.bricks[0]);
    game.random = () => 0;
    const check = saw => {
      for (const part of game.brickParts()) {
        const distance = Math.hypot(
          saw.x - Math.max(part.x, Math.min(part.x + part.w, saw.x)),
          saw.y - Math.max(part.y, Math.min(part.y + part.h, saw.y)));
        assert.ok(distance >= 27 + game.cat.radius * 4, 'same clearance as stamps and brushes for every brick part');
      }
    };
    check(game.createCollectible(2, 'saw-blade', 5));
    const brick = game.bricks.find(brick => brick.absorbedBy === null);
    brick.spawner = { kind: 'item', type: 'saw-blade', lifetime: 3 };
    game.spawnFromBrick(brick);
    check(game.items[0]);
    assert.equal(game.items[0].expires, game.elapsed + 3);

    const event = [2, 'saw-blade', 5];
    const reserved = { ...game.pointFromRelative(0, 0), type: 'saw-blade', born: 2, expires: 7, lifetime: 5 };
    game.pendingSpawns.set(event, { kind: 'item', time: 2, items: [reserved] });
    assert.equal(game.takeSpawn(event, () => assert.fail('must reuse reserved saw'))[0], reserved);
    check(reserved);
    assert.equal(reserved.expires, 7);
    const safePosition = { x: reserved.x, y: reserved.y };
    game.pendingSpawns.set(event, { kind: 'item', time: 2, items: [reserved] });
    game.random = () => assert.fail('safe reserved positions must not be rerolled');
    game.takeSpawn(event, () => assert.fail('must reuse reserved saw'));
    assert.deepEqual({ x: reserved.x, y: reserved.y }, safePosition);

    const placement = { time: 2, kind: 'item', type: 'saw-blade', x: 0, y: 0 };
    const [explicit] = game.createCustomSpawn(placement);
    game.pendingSpawns.set(placement, { kind: 'item', time: 2, items: [explicit] });
    game.takeSpawn(placement, () => assert.fail('must reuse explicit saw'));
    assert.deepEqual({ x: explicit.x, y: explicit.y }, game.campaignEventPoint(0, 0));
    assert.equal(game.stampSpawnClear(explicit), false);
  }
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  for (const surface of ['plain', 'slimed', 'springs', 'spikes', 'conveyor', 'portal', 'spawner', 'boost']) {
    test(`saw converts ${surface} on first contact without firing its effect in ${options.portrait ? 'portrait' : 'desktop'}`, () => {
      const game = arena(options), brick = topBrick(game);
      if (surface !== 'plain') brick[surface] = surface === 'portal' ? 'red'
        : surface === 'spawner' ? { kind: 'heart', type: 'heart' } : true;
      const partner = game.bricks.find(other => other.id !== brick.id);
      if (surface === 'portal') partner.portal = 'red';
      brick.crumbler = 2; brick.usesLeft = 2; brick.toggle = 2; brick.toggleRemaining = 0;
      game.collectItem({ type: 'saw-blade' });
      const started = game.sawStartedAt;
      game.pause(); game.update(2);
      assert.equal(game.sawStartedAt, started);
      assert.equal(brick.kind, 'normal');
      game.resume();
      launch(game, brick);
      assert.equal(brick.kind, 'cinder');
      assert.equal(game.sawStartedAt, null);
      assert.equal(game.brickDestructions.length, 1);
      assert.equal(game.brickDestructions[0].id, brick.id);
      assert.equal(game.hearts, 3);
      assert.equal(game.portalTrips, 0);
      assert.equal(game.healing.length, 0);
      assert.equal(game.conveyorRide, null);
      assert.equal(game.stuckUntil, 0);
      assert.equal(game.boostReady, false);
      assert.equal(brick.crumbler, null);
      assert.equal(brick.toggle, null);
      assert.equal(brick.portal, null);
      assert.equal(brick.spawner, null);
      if (surface === 'portal') assert.equal(partner.portal, null, 'no stranded Portal endpoint');
      assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), false);
      const parts = game.brickParts().filter(part => part.id === brick.id);
      assert.ok(parts.some(part => game.touchingPart(part)), 'Koshi rests on the concrete body, not former spikes');
      game.reset();
      assert.equal(game.sawStartedAt, null);
      assert.equal(game.brickDestructions.length, 0);
      assert.notEqual(game.bricks[brick.id].kind, 'cinder');
    });
  }
}

test('a saw collected during the landing sweep overrides spikes and lands against the new cinder body', () => {
  const game = arena(), brick = topBrick(game);
  brick.spikes = true;
  const exit = game.portalExit(brick);
  game.cat.x = exit.x; game.cat.y = exit.y + 60;
  game.cat.vx = 0; game.cat.vy = -420;
  game.items = [{ x: exit.x, y: exit.y + 30, type: 'saw-blade' }];
  game.tick(.2);
  assert.equal(brick.kind, 'cinder');
  assert.equal(game.hearts, 3);
  assert.ok(Math.abs(game.cat.y - (brick.y + brick.h + game.cat.radius)) < 1e-6);
});

test('existing cinder contacts keep the saw ready, extra pickups do not stack, and the next ordinary brick consumes it', () => {
  const game = arena(), brick = topBrick(game);
  game.collectItem({ type: 'saw-blade' });
  const started = game.sawStartedAt;
  game.update(.2); game.collectItem({ type: 'saw-blade' });
  assert.equal(game.sawStartedAt, started, 'another saw does not restart the morph');
  assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
  brick.kind = 'cinder';
  game.update(1);
  assert.equal(game.sawStartedAt, started);
  assert.equal(game.brickDestructions.length, 0);
  const regions = brickRegions(game.bricks, game.width, game.height);
  const other = game.bricks.filter(candidate => candidate.id !== brick.id && candidate.kind !== 'cinder'
    && regions.get(candidate.id).edge === 'bottom')
    .sort((a, b) => Math.abs(a.x + a.w / 2 - game.cat.x) - Math.abs(b.x + b.w / 2 - game.cat.x))[0];
  launch(game, other);
  assert.equal(game.sawStartedAt, null);
  assert.equal(other.kind, 'cinder');
  const third = game.bricks.find(candidate => candidate.kind !== 'cinder');
  launch(game, third);
  assert.notEqual(third.kind, 'cinder', 'only one landing is affected');
});

test('the saw permanently converts starting groups and temporarily absorbed corner shapes, including every gap', () => {
  const base = arena(), ids = base.perimeter.slice(0, 3), ownerId = ids[1];
  const custom = { ...level([]), brickGroups: [{ owner: ownerId, members: ids }], brickTypes: [
    { ...base.bricks[ownerId].region, kind: 'normal', warped: .1, crumbler: 5 },
  ] };
  const game = new Game(() => .5, { customLevel: custom });
  game.start();
  const owner = game.bricks[ownerId];
  game.absorbNeighbor(owner);
  const original = game.brickParts().filter(part => part.id === owner.id);
  const convertedIds = original.filter(part => part.sourceId != null).map(part => part.sourceId);
  assert.ok(convertedIds.length > ids.length);
  assert.ok(original.some(part => part.afterId != null), 'the shape includes connecting gaps');
  game.collectItem({ type: 'saw-blade' });
  assert.equal(game.sawBrick(owner, game.brickParts()), true);
  assert.deepEqual(game.brickDestructions[0].members, original);
  const shape = game.brickParts().filter(part => part.id === owner.id);
  assert.deepEqual(shape, original, 'conversion preserves the complete collision shape');
  for (const id of convertedIds) {
    assert.equal(game.bricks[id].kind, 'cinder');
    assert.equal(game.bricks[id].initialOwner, id === owner.id ? null : owner.id);
  }
  game.update(.2); game.restoreWarps();
  assert.deepEqual(game.brickParts().filter(part => part.id === owner.id), shape, 'former warp cannot restore neighbors');
  const neighbor = game.bricks.find(brick => brick.kind !== 'cinder' && brick.absorbedBy === null);
  neighbor.warped = .1; neighbor.warpUntil = null; neighbor.usesLeft = null;
  game.absorbNeighbor(neighbor);
  assert.equal(owner.absorbedBy, null, 'cinder cannot be absorbed again');
  game.reset();
  assert.equal(game.bricks[ownerId].kind, 'normal');
  assert.equal(game.bricks.filter(brick => brick.absorbedBy === ownerId).length, ids.length - 1);
});

test('destruction animations freeze on pause, finish after win/loss without advancing gameplay, and clear on reset', () => {
  for (const state of ['won', 'lost']) {
    const game = arena(), brick = topBrick(game);
    game.collectItem({ type: 'saw-blade' }); game.sawBrick(brick, game.brickParts());
    game.update(.25);
    const effect = game.brickDestructions[0], age = effect.age;
    game.pause(); game.update(10);
    assert.equal(effect.age, age);
    game.resume(); game.state = state;
    const elapsed = game.elapsed;
    game.update(.4);
    assert.ok(effect.age > age);
    assert.equal(game.elapsed, elapsed);
    game.update(.4);
    assert.equal(game.brickDestructions.length, 0);
    assert.equal(brick.kind, 'cinder');
    game.reset();
    assert.equal(game.brickDestructions.length, 0);
  }
});

test('saw rendering instantly grows twelve matching teeth and spins at full speed, with smoke across full brick extents', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'createLinearGradient') return () => ({ addColorStop() {} });
      return (...args) => operations.push([name, ...args]);
    },
  });
  const game = arena();
  const growths = [];
  const context = vm.createContext({ ctx, game, ITEMS, traceSawBlade(ctx, radius, growth = 1) {
    growths.push(growth);
    traceSawBlade(ctx, radius, growth);
  } });
  vm.runInContext(source.slice(source.indexOf('function line('), source.indexOf('function render(')), context);
  vm.runInContext(source.slice(source.indexOf('function drawGameItem('), source.indexOf('function drawMusicStream(')), context);
  context.drawGameItem({ x: 0, y: 0, type: 'saw-blade' });
  assert.equal(operations.filter(([name]) => name === 'quadraticCurveTo').length, 12);
  game.collectItem({ type: 'saw-blade' });
  const draw = age => {
    operations.length = 0; ctx.globalAlpha = 1;
    context.drawCat(game.cat.x, game.cat.y, age);
    return operations.filter(([name]) => name === 'rotate').at(-1)[1];
  };
  const start = draw(0);
  assert.equal(growths.at(-1), 1, 'fully transformed on the pickup frame');
  const immediate = draw(1 / 60);
  assert.ok(Math.abs(immediate - start - 36 / 60) < 1e-6, 'full-speed spinning starts immediately');
  const spinning = draw(1), next = draw(1.05);
  assert.ok(spinning > start);
  assert.ok(Math.abs(next - spinning - 36 * .05) < 1e-6, 'rotation stays at thirty-six radians per second');
  assert.equal(operations.filter(([name]) => name === 'lineTo').filter(([, x, y]) => Math.hypot(x, y) < 23.001 && Math.hypot(x, y) > 22.999).length, 12);
  vm.runInContext(source.slice(source.indexOf('function drawBrickDestructionSmoke('), source.indexOf('function drawPickupPop(')), context);
  operations.length = 0;
  context.drawBrickDestructionSmoke({ age: .5, members: [{ x: 10, y: 10, w: 140, h: 20 }, { x: 150, y: 10, w: 20, h: 140 }] });
  const clouds = operations.filter(([name]) => name === 'arc');
  assert.equal(clouds.length, 20);
  assert.ok(clouds.some(([, x]) => x < 25));
  assert.ok(clouds.some(([, x, y]) => x > 150 && y > 120), 'smoke follows both sides of a corner');
  assert.ok(ctx.globalAlpha > 0 && ctx.globalAlpha < 1);
});

test('destruction ghost fades smoothly with small high-frequency shake and is removed cleanly', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const game = arena(), brick = topBrick(game);
  game.collectItem({ type: 'saw-blade' }); game.sawBrick(brick, game.brickParts());
  const effect = game.brickDestructions[0];
  const ghost = { style: {}, remove() { this.removed = true; } };
  const button = { style: {} }, destructionVisuals = new Map([[effect, ghost]]);
  const context = vm.createContext({ game, destructionVisuals, buttons: [{ brick, button }] });
  vm.runInContext(source.slice(source.indexOf('function syncBrickDestructions('), source.indexOf('function showDialog(')), context);
  effect.age = .5; context.syncBrickDestructions();
  assert.equal(ghost.style.opacity, '0.5');
  assert.equal(ghost.style.transform, button.style.transform);
  const first = ghost.style.transform;
  effect.age = .51; context.syncBrickDestructions();
  assert.notEqual(ghost.style.transform, first);
  assert.ok(Number(ghost.style.opacity) < .5);
  game.updateBrickDestructions(1);
  context.syncBrickDestructions();
  assert.equal(ghost.removed, true);
  assert.equal(destructionVisuals.size, 0);
  assert.equal(button.style.transform, '');
});
