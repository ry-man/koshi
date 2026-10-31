const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, SPEED, PORTALS, FOODS, SWORDS, CONTACT_SURFACES, brickEnabled, brickRegions, brickShape, validateCustomLevel } = require('../src/game.js');
const { Tutorial, LESSONS } = require('../src/learning.js');
const { spawnSymbol, decorateBrick, updateBrick, specialLabel } = require('../src/brick-visuals.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const level = () => ({ version: 1, id: 'Special bricks', duration: 120, goal: 10000, heartCost: null, brickSet: 1, events: [] });
function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: level() });
  game.start();
  return game;
}
function edgeBrick(game, edge) {
  const regions = brickRegions(game.bricks, game.width, game.height);
  return game.bricks.filter(brick => regions.get(brick.id).edge === edge)
    .sort((a, b) => Math.abs((edge === 'left' || edge === 'right' ? a.y + a.h / 2 : a.x + a.w / 2) - (edge === 'left' || edge === 'right' ? game.height : game.width) / 2)
      - Math.abs((edge === 'left' || edge === 'right' ? b.y + b.h / 2 : b.x + b.w / 2) - (edge === 'left' || edge === 'right' ? game.height : game.width) / 2))[0];
}
const aim = (game, brick) => game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2);
function rest(game, brick) {
  const exit = game.portalExit(brick);
  game.cat.x = exit.x - exit.nx * .01; game.cat.y = exit.y - exit.ny * .01;
  game.cat.vx = 0; game.cat.vy = 0;
  return exit;
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test('starting brick groups validate adjacency, ownership and portable membership', () => {
  const game = arena(), ids = game.perimeter.slice(0, 3);
  const source = { ...level(), brickGroups: [{ owner: ids[1], members: [...ids] }] };
  const copy = validateCustomLevel(source);
  source.brickGroups[0].members[0] = 99;
  assert.equal(copy.brickGroups[0].members[0], ids[0]);
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(copy))), copy);
  for (const groups of [
    null, [{}], [{ owner: ids[0], members: [ids[0]] }],
    [{ owner: ids[0], members: [ids[0], ids[0]] }],
    [{ owner: ids[0], members: [ids[0], 26] }],
    [{ owner: ids[2], members: ids.slice(0, 2) }],
    [{ owner: ids[0], members: [ids[0], game.perimeter[3]] }],
    [{ owner: ids[0], members: ids.slice(0, 2) }, { owner: ids[1], members: ids.slice(1) }],
  ]) assert.throws(() => validateCustomLevel({ ...level(), brickGroups: groups }), /group/i);
  assert.doesNotThrow(() => validateCustomLevel({ ...level(), brickGroups: [{ owner: game.perimeter[0], members: [game.perimeter.at(-1), game.perimeter[0]] }] }));
  assert.doesNotThrow(() => validateCustomLevel({ ...level(), brickGroups: [{ owner: 0, members: game.perimeter }] }));
  const cinders = ids.slice(0, 2).map(id => ({ ...game.bricks[id].region, kind: 'cinder' }));
  assert.doesNotThrow(() => validateCustomLevel({ ...level(), brickTypes: cinders, brickGroups: [{ owner: ids[0], members: ids.slice(0, 2) }] }));
  assert.throws(() => validateCustomLevel({ ...level(), brickTypes: cinders.slice(0, 1), brickGroups: [{ owner: ids[0], members: ids.slice(0, 2) }] }), /Cinder/);
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  test(`starting groups share selection and contact effects and survive Warped restoration in ${options.portrait ? 'phone' : 'desktop'}`, () => {
    const base = arena(), ids = base.perimeter.slice(0, 3), ownerId = ids[1], memberId = ids[0];
    const source = { ...level(), brickGroups: [{ owner: ownerId, members: ids }], brickTypes: [
      { ...base.bricks[ownerId].region, kind: 'fast', crumbler: 5, warped: 1, spawner: { kind: 'heart', type: 'heart' } },
      { ...base.bricks[memberId].region, kind: 'slow', toggle: 4, spikes: true },
    ] };
    const game = new Game(() => .5, { ...options, customLevel: source }); game.start();
    const owner = game.bricks[ownerId], member = game.bricks[memberId];
    assert.equal(member.absorbedBy, owner.id);
    assert.equal(game.brickParts().filter(part => ids.includes(part.sourceId)).every(part => part.id === ownerId), true);
    assert.equal(aim(game, member), false, 'hidden members cannot activate their old attributes');
    assert.equal(game.steer(owner.id, member.x + member.w / 2, member.y + member.h / 2), true);
    assert.equal(owner.usesLeft, 4);
    assert.equal(owner.readyAt, 3);
    assert.equal(member.toggleRemaining, 4);
    assert.ok(game.bricks.some(brick => !ids.includes(brick.id) && brick.absorbedBy === owner.id));
    game.elapsed = 1.1; game.restoreWarps();
    for (const brick of game.bricks) assert.equal(brick.absorbedBy, ids.includes(brick.id) && brick.id !== owner.id ? owner.id : null);
    const exit = game.portalExit({ ...member, id: ownerId }, [{ ...member, id: ownerId }]);
    game.cat.x = exit.x - exit.nx * .01; game.cat.y = exit.y - exit.ny * .01;
    game.cat.vx = 0; game.cat.vy = 0;
    game.update(.01);
    assert.equal(game.hearts, 3, 'member Spikes are suppressed');
    assert.equal(game.healing.length, 1, 'owner Spawner applies across the starting group');
    game.reset();
    assert.equal(game.bricks[memberId].absorbedBy, ownerId);
    assert.equal(game.bricks[ownerId].usesLeft, 5);
    assert.equal(game.bricks[ownerId].spawned, false);
  });
}

test('a Warped owner absorbs and restores entire permanent groups, including its own starting group', () => {
  const base = arena(), ids = base.perimeter;
  const source = { ...level(), brickGroups: [
    { owner: ids[0], members: ids.slice(0, 2) }, { owner: ids[2], members: ids.slice(2, 5) },
  ], brickTypes: [{ ...base.bricks[ids[0]].region, kind: 'normal', warped: 1 }] };
  const game = new Game(() => 0, { customLevel: source }), owner = game.bricks[ids[0]];
  for (let i = 0; i < 26; i++) game.absorbNeighbor(owner);
  assert.equal(game.bricks.every(brick => brick.id === owner.id || brick.absorbedBy === owner.id), true);
  game.elapsed = 2; game.restoreWarps();
  for (const group of source.brickGroups) {
    for (const id of group.members) assert.equal(game.bricks[id].absorbedBy, id === group.owner ? null : group.owner);
  }
  assert.equal(game.bricks.filter(brick => brick.absorbedBy === null).length, 23);
});

test('portal pairing counts combined endpoints rather than their hidden members', () => {
  const base = arena(), ids = base.perimeter;
  const source = { ...level(), brickGroups: [{ owner: ids[0], members: ids.slice(0, 3) }],
    brickTypes: [...ids.slice(0, 3), ids[5]].map(id => ({ ...base.bricks[id].region, kind: 'normal', portal: 'purple' })) };
  assert.doesNotThrow(() => validateCustomLevel(source));
  assert.throws(() => validateCustomLevel({ ...source, brickGroups: [] }), /exactly two/);
});

test('starting groups fill connecting gaps across every corner without filling the arena', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const base = arena(options), regions = brickRegions(base.bricks, base.width, base.height);
    for (let i = 0; i < base.perimeter.length; i++) {
      const a = base.perimeter[i], b = base.perimeter[(i + 1) % base.perimeter.length];
      if (regions.get(a).edge === regions.get(b).edge) continue;
      const game = new Game(() => .5, { ...options, customLevel: { ...level(), brickGroups: [{ owner: a, members: [a, b] }] } });
      const parts = game.brickParts().filter(part => part.id === a), shape = brickShape(parts);
      assert.ok(parts.some(part => part.sourceId === undefined), 'corner gap is solid');
      assert.equal(parts.some(part => game.touchingPart(part)), false, 'center remains open');
      assert.ok(shape.clipPath.startsWith('polygon(evenodd,'));
      for (const id of [a, b]) assert.equal(parts.find(part => part.sourceId === id).id, a);
    }
    const ring = new Game(() => .5, { ...options, customLevel: { ...level(), brickGroups: [{ owner: 0, members: base.perimeter }] } });
    assert.equal(ring.brickParts().length, 52);
    assert.equal(ring.brickParts().some(part => ring.touchingPart(part)), false);
  }
});

test('Cinder validates and clears inherited effects without accepting new modifiers', () => {
  const region = arena().bricks[0].region;
  const source = { ...level(), brickTypes: [
    { ...region, kind: 'normal', warped: 10, toggle: 2, crumbler: 5, boost: true },
    { ...region, kind: 'cinder' },
  ] };
  const copy = validateCustomLevel(source);
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(copy))), copy);
  const game = new Game(() => .5, { customLevel: copy });
  assert.equal(game.bricks[0].kind, 'cinder');
  for (const attribute of ['crumbler', 'warped', 'toggle', ...CONTACT_SURFACES]) assert.ok(!game.bricks[0][attribute]);
  game.reset();
  assert.equal(game.bricks[0].kind, 'cinder');
  assert.equal(game.bricks[0].absorbedBy, null);
  for (const patch of [
    { crumbler: 5 }, { warped: 10 }, { toggle: 2 },
    ...CONTACT_SURFACES.map(attribute => ({ [attribute]: attribute === 'portal' ? 'red'
      : attribute === 'spawner' ? { kind: 'heart', type: 'heart' } : true })),
  ]) assert.throws(() => validateCustomLevel({ ...level(), brickTypes: [{ ...region, kind: 'cinder', ...patch }] }), /Cinder/);
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  test(`Cinder is inert, stops Koshi, permits departure and blocks absorption in ${options.portrait ? 'phone' : 'desktop'}`, () => {
    const game = arena(options), brick = edgeBrick(game, 'right'), other = edgeBrick(game, 'left');
    brick.kind = 'cinder';
    other.toggle = 2; other.toggleRemaining = 1;
    const before = { ...game.cat };
    assert.equal(aim(game, brick), false);
    assert.deepEqual(game.cat, before);
    assert.equal(other.toggleRemaining, 1);
    assert.equal(brick.readyAt, 0);
    const exit = game.portalExit(brick);
    game.cat.x = exit.x + exit.nx * 60; game.cat.y = exit.y + exit.ny * 60;
    game.cat.vx = -exit.nx * SPEED; game.cat.vy = -exit.ny * SPEED;
    game.update(.5);
    assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0);
    assert.ok(game.touchingPart(brick));
    assert.equal(game.hearts, 3);
    other.toggleRemaining = 0;
    assert.equal(aim(game, other), true);
    assert.equal(other.toggleRemaining, 2);
    const warped = game.bricks.find(candidate => candidate.id !== brick.id && candidate.id !== other.id);
    warped.warped = 10;
    for (let i = 0; i < game.bricks.length * 2; i++) game.absorbNeighbor(warped);
    assert.equal(brick.absorbedBy, null);
    assert.equal(game.brickParts().find(part => part.sourceId === brick.id).id, brick.id);
  });
}

test('special brick attributes validate, round-trip, copy independently and require exact portal pairs', () => {
  const source = level();
  const bricks = arena().bricks;
  source.brickTypes = [
    ...bricks.slice(0, 2).map(brick => ({ ...brick.region, kind: 'fast', portal: 'purple', toggle: 2 })),
    { ...bricks[2].region, kind: 'normal', spawner: { kind: 'food', type: 'H', lifetime: 9 }, crumbler: 3 },
    { ...bricks[3].region, kind: 'normal', boost: true, warped: 5, toggle: 4 },
  ];
  const copy = validateCustomLevel(source);
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(copy))), copy);
  source.brickTypes[2].spawner.type = 'S';
  assert.equal(copy.brickTypes[2].spawner.type, 'H');
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const game = new Game(() => .5, { ...options, customLevel: copy });
    assert.equal(game.bricks.filter(brick => brick.portal === 'purple').length, 2);
    assert.equal(game.bricks.filter(brick => brick.boost).length, 1);
  }
  for (const patch of [
    { portal: 'pink' }, { portal: true }, { toggle: 3 }, { toggle: '3' }, { boost: 1 },
    { spawner: { kind: 'enemy', type: 'tom' } }, { spawner: { kind: 'food', type: 'S' } },
    { spawner: { kind: 'heart', type: 'S' } }, { spawner: [] },
  ]) assert.throws(() => validateCustomLevel({ ...level(), brickTypes: [{ ...bricks[0].region, kind: 'normal', ...patch }] }));
  for (const count of [1, 3, 4]) {
    assert.throws(() => validateCustomLevel({ ...level(), brickTypes: bricks.slice(0, count).map(brick => ({ ...brick.region, kind: 'normal', portal: 'red' })) }), /exactly two/);
  }
  for (const other of CONTACT_SURFACES.filter(surface => surface !== 'boost')) {
    const value = other === 'portal' ? 'red' : other === 'spawner' ? { kind: 'heart', type: 'heart' } : true;
    assert.throws(() => validateCustomLevel({ ...level(), brickTypes: [{ ...bricks[0].region, kind: 'normal', boost: true, [other]: value }] }), /combine/);
  }
  for (const color of Object.keys(PORTALS)) assert.doesNotThrow(() => validateCustomLevel({ ...level(), brickTypes: bricks.slice(0, 2).map(brick => ({ ...brick.region, kind: 'normal', portal: color })) }));
});

for (const options of [{}, { portrait: true, scale: .5 }, { portrait: true, scale: .3 }]) {
  const layout = options.portrait ? `portrait ${options.scale}` : 'desktop';
  test(`portal travel exits perpendicular at the center on all edges in ${layout}`, () => {
    for (const edge of ['left', 'right', 'top', 'bottom']) {
      const game = arena(options), source = edgeBrick(game, edge), destination = edgeBrick(game, { left: 'top', top: 'right', right: 'bottom', bottom: 'left' }[edge]);
      source.portal = destination.portal = 'blue';
      source.readyAt = destination.readyAt = 100; source.usesLeft = destination.usesLeft = 0;
      const entry = rest(game, source);
      game.cat.x += entry.nx * 8; game.cat.y += entry.ny * 8;
      game.cat.vx = -entry.nx * SPEED; game.cat.vy = -entry.ny * SPEED;
      const exit = game.portalExit(destination);
      const midX = (game.cat.x + exit.x) / 2, midY = (game.cat.y + exit.y) / 2;
      game.food.push({ x: midX, y: midY, type: 'S', expires: 100, lifetime: 100 });
      game.update(.05);
      assert.equal(game.portalTrips, 1);
      near(game.cat.vx, exit.nx * SPEED); near(game.cat.vy, exit.ny * SPEED);
      if (exit.nx) near(game.cat.y, destination.y + destination.h / 2);
      else near(game.cat.x, destination.x + destination.w / 2);
      assert.equal(game.score, 0, 'teleportation must not sweep pickups across the board');
      const snapshot = { ...game.cat };
      game.pause(); game.update(2); assert.deepEqual(game.cat, snapshot);
      game.resume(); game.update(.1);
      assert.equal(game.portalTrips, 1, 'exit does not immediately teleport back');
      game.reset();
      assert.equal(game.portalTrips, 0); assert.equal(game.portalArrival, null);
    }
  });

  test(`toggle cycles count all successful selections including their own in ${layout}`, () => {
    for (const clicks of [1, 2, 4]) {
      const game = arena(options), toggle = edgeBrick(game, 'right');
      toggle.toggle = clicks; toggle.toggleRemaining = clicks;
      const candidates = game.bricks.filter(brick => brick.id !== toggle.id && brick.kind === 'normal');
      assert.equal(aim(game, toggle), false);
      assert.equal(toggle.readyAt, 0);
      assert.equal(game.steer(candidates[0].id, NaN, 0), false);
      assert.equal(toggle.toggleRemaining, clicks);
      for (let i = 0; i < clicks; i++) {
        assert.equal(aim(game, candidates[i]), true);
        assert.equal(toggle.toggleRemaining, clicks - i - 1);
        assert.equal(aim(game, candidates[i]), false, 'cooldown rejects duplicate click');
        assert.equal(toggle.toggleRemaining, clicks - i - 1);
      }
      assert.equal(brickEnabled(toggle), true);
      assert.equal(aim(game, toggle), true);
      assert.equal(toggle.toggleRemaining, clicks, 'own successful selection resets its enabled cycle');
      assert.equal(aim(game, candidates[clicks]), true);
      assert.equal(toggle.toggleRemaining, clicks - 1);
      game.pause(); game.update(30);
      assert.equal(toggle.toggleRemaining, clicks - 1);
    }
  });

  test(`spawning bricks trigger once by contact, never by selection, in ${layout}`, () => {
    for (const spawn of [
      ...Object.keys(FOODS).map(type => ({ kind: 'food', type, lifetime: 10 })),
      ...Object.keys(SWORDS).map(type => ({ kind: 'weapon', type })),
      { kind: 'enemy', type: 'mouse' }, { kind: 'enemy', type: 'wheel' }, { kind: 'enemy', type: 'ram' }, { kind: 'enemy', type: 'bucket' }, { kind: 'heart', type: 'heart' },
    ]) {
      const game = arena(options), brick = edgeBrick(game, 'right');
      brick.spawner = spawn;
      assert.equal(aim(game, brick), true);
      assert.equal(brick.spawned, false);
      game.pause(); game.update(10);
      assert.equal(brick.spawned, false);
      game.resume(); game.update(2);
      assert.equal(brick.spawned, true);
      const target = spawn.kind === 'food' ? game.food : spawn.kind === 'weapon' ? game.weapons : spawn.kind === 'enemy' ? game.robots : game.healing;
      assert.equal(target.length, 1, spawn.kind);
      const count = game.food.length + game.weapons.length + game.robots.length + game.healing.length;
      game.update(.5);
      assert.equal(game.food.length + game.weapons.length + game.robots.length + game.healing.length, count);
      if (spawn.type === 'wheel') {
        const b = game.bounds(), wheel = game.robots[0];
        assert.ok(wheel.x === b.left || wheel.x === b.right || wheel.y === b.top || wheel.y === b.bottom);
      }
      game.reset();
      assert.equal(game.bricks.some(item => item.spawned), false);
    }
  });

  test(`boost requires resting contact, doubles speed and defeats without consuming swords in ${layout}`, () => {
    const game = arena(options), boost = edgeBrick(game, 'right'), other = edgeBrick(game, 'left');
    boost.boost = true;
    boost.toggle = 4; boost.toggleRemaining = 0;
    assert.equal(game.boostReady, false);
    assert.equal(aim(game, boost), true);
    assert.equal(boost.toggleRemaining, 4, 'selecting the enabled Boost Toggle disables selection');
    assert.equal(game.boostReady, false, 'not ready while approaching the boost');
    assert.equal(game.boosted, false, 'clicking a boost destination alone gives no boost');
    game.update(2);
    assert.equal(game.cat.vx, 0);
    assert.equal(game.boostReady, true);
    game.pause(); game.update(10);
    assert.equal(game.boostReady, true, 'ready cue survives pause');
    game.resume();
    assert.equal(brickEnabled(boost), false);
    assert.equal(aim(game, boost), false, 'disabled Toggle still blocks selection');
    assert.equal(game.boostReady, true, 'disabled Boost Toggle still charges a launch');
    assert.equal(aim(game, other), true);
    assert.equal(boost.toggleRemaining, 3, 'departure leaves the Boost Toggle disabled');
    assert.equal(game.boostReady, false, 'launch clears the readiness cue');
    assert.equal(game.boosted, true);
    near(Math.hypot(game.cat.vx, game.cat.vy), SPEED * 2);
    const snapshot = { ...game.cat };
    game.pause(); game.update(10); assert.deepEqual(game.cat, snapshot);
    assert.equal(game.boosted, true);
    game.resume();
    game.weapon = { type: 'wood', uses: 1, expires: Infinity };
    game.robots.push({ type: 'mouse', x: game.cat.x - 55, y: game.cat.y, radius: 19, age: 4.5, phase: 0 });
    game.update(.05);
    assert.equal(game.enemies, 1); assert.equal(game.hearts, 3);
    assert.equal(game.weapon.uses, 1);
    assert.equal(aim(game, other), false);
    assert.equal(game.boosted, true, 'failed selection does not cancel boost');
    const redirect = edgeBrick(game, 'top');
    assert.equal(aim(game, redirect), true);
    assert.equal(game.boosted, false);
    near(Math.hypot(game.cat.vx, game.cat.vy), SPEED);
    game.update(2);
    rest(game, boost); other.readyAt = 0;
    assert.equal(aim(game, other), true);
    game.update(2);
    assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0); assert.equal(game.boosted, false);
    game.reset();
    assert.equal(game.boosted, false);
    assert.equal(game.boostReady, false);
  });
}

test('unfinished portal drafts preserve data but remain invalid for normal gameplay', () => {
  const bricks = arena().bricks;
  for (const count of [1, 3, 4]) {
    const source = { ...level(), brickTypes: bricks.slice(0, count).map(brick => ({ ...brick.region, kind: 'normal', portal: 'blue' })) };
    const draft = validateCustomLevel(source, { allowUnpairedPortals: true });
    assert.equal(draft.brickTypes.length, count);
    assert.throws(() => validateCustomLevel(draft), /exactly two/);
    assert.throws(() => new Game(() => .5, { customLevel: draft }), /exactly two/);
    const preview = new Game(() => .5, { customLevel: draft, editorPreview: true });
    assert.equal(preview.bricks.filter(brick => brick.portal === 'blue').length, count);
    assert.equal(require('../src/game.js').portalPairIssues(preview.bricks).length, 1);
  }
  assert.throws(() => validateCustomLevel({ ...level(), goal: 0 }, { allowUnpairedPortals: true }), /Food goal/);
  assert.throws(() => validateCustomLevel({ ...level(), brickTypes: [{ ...bricks[0].region, kind: 'normal', portal: 'pink' }] }, { allowUnpairedPortals: true }), /unknown portal/);
});

test('a Toggle activation advances its counter even when using the last Crumbler charge', () => {
  const game = arena(), brick = edgeBrick(game, 'right');
  brick.toggle = 1; brick.toggleRemaining = 0; brick.crumbler = 1; brick.usesLeft = 1;
  assert.equal(aim(game, brick), true);
  assert.equal(brick.usesLeft, 0);
  assert.equal(brick.toggleRemaining, 1);
  assert.equal(aim(game, brick), false);
  assert.equal(brick.toggleRemaining, 1);
});

test('Toggle state only gates selection and all seven contact surfaces remain active', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    for (const surface of CONTACT_SURFACES) {
      const outcomes = [];
      for (const disabled of [false, true]) {
        const game = arena(options), brick = edgeBrick(game, 'right');
        brick.toggle = 2; brick.toggleRemaining = disabled ? 2 : 0;
        brick[surface] = surface === 'portal' ? 'red' : surface === 'spawner' ? { kind: 'heart', type: 'heart' } : true;
        if (surface === 'portal') {
          const destination = edgeBrick(game, 'left');
          destination.portal = 'red';
          destination.toggle = 2; destination.toggleRemaining = disabled ? 2 : 0;
        }
        const exit = rest(game, brick);
        game.cat.x += exit.nx * 30; game.cat.y += exit.ny * 30;
        game.cat.vx = -exit.nx * SPEED; game.cat.vy = -exit.ny * SPEED;
        const trajectory = game.trajectory();
        game.update(.1);
        outcomes.push({
          cat: { ...game.cat }, hearts: game.hearts, stuckUntil: game.stuckUntil,
          conveyorRide: game.conveyorRide, portalTrips: game.portalTrips,
          healing: game.healing, spawned: brick.spawned, boostReady: game.boostReady, trajectory,
        });
        assert.equal(brick.toggleRemaining, disabled ? 2 : 0, 'contact does not count as selection');
        if (surface === 'slimed') assert.ok(game.stuckUntil > game.elapsed);
        if (surface === 'springs') {
          assert.ok(game.cat.vx < 0, 'spring reflects even while disabled');
          assert.equal(trajectory.length, 3, 'preview includes the reflection');
        }
        if (surface === 'spikes') assert.equal(game.hearts, 2);
        if (surface === 'conveyor') assert.equal(game.conveyorRide.id, brick.id);
        if (surface === 'portal') assert.equal(game.portalTrips, 1);
        if (surface === 'spawner') assert.equal(game.healing.length, 1);
        if (surface === 'boost') assert.equal(game.boostReady, true);
      }
      assert.deepEqual(outcomes[1], outcomes[0], `${surface}: Toggle state cannot change contact behavior`);
    }
    const game = arena(options), brick = edgeBrick(game, 'right');
    brick.toggle = 2; brick.toggleRemaining = 2;
    brick.spawner = { kind: 'heart', type: 'heart' };
    rest(game, brick);
    game.update(.01);
    assert.equal(game.healing.length, 1, 'resting contact also triggers a disabled spawner');
    game.update(.01);
    assert.equal(game.healing.length, 1, 'spawner still fires only once');
  }
});

test('absorbed portal destinations remain unavailable', () => {
  const game = arena(), source = edgeBrick(game, 'right'), dest = edgeBrick(game, 'left');
  source.portal = dest.portal = 'red';
  dest.absorbedBy = game.bricks.find(brick => ![source.id, dest.id].includes(brick.id)).id;
  assert.equal(game.travelPortal(source, game.brickParts()), false);
});

test('boost survives Spring bounces and Portal travel, while Warped exits and spawners stay safe', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const game = arena(options), boost = edgeBrick(game, 'right'), spring = edgeBrick(game, 'left');
    boost.boost = true; spring.springs = true;
    rest(game, boost); assert.equal(aim(game, spring), true);
    game.update((boost.x - spring.x - spring.w - game.cat.radius * 2) / (SPEED * 2) + .01);
    assert.ok(game.cat.vx > 0);
    assert.equal(game.boosted, true);
    near(Math.hypot(game.cat.vx, game.cat.vy), SPEED * 2);

    const portalGame = arena(options), source = edgeBrick(portalGame, 'left'), destination = edgeBrick(portalGame, 'right');
    source.portal = destination.portal = 'green';
    destination.warped = 10;
    portalGame.absorbNeighbor(destination);
    const exit = rest(portalGame, source);
    portalGame.cat.x += exit.nx * 4; portalGame.cat.y += exit.ny * 4;
    portalGame.cat.vx = -exit.nx * SPEED * 2; portalGame.cat.vy = -exit.ny * SPEED * 2;
    portalGame.boosted = true;
    portalGame.update(.02);
    assert.equal(portalGame.portalTrips, 1);
    assert.equal(portalGame.boosted, true);
    near(Math.hypot(portalGame.cat.vx, portalGame.cat.vy), SPEED * 2);
    assert.ok(!portalGame.brickParts().some(part => portalGame.touchingPart(part)), 'exit clears enlarged union');

    const spawning = arena(options), brick = edgeBrick(spawning, 'right');
    brick.spawner = { kind: 'heart', type: 'heart' }; brick.usesLeft = 0; brick.readyAt = 100;
    rest(spawning, brick); spawning.update(.01);
    assert.equal(spawning.healing.length, 1, 'cooling/exhausted spawner works on contact');
    brick.warped = 10; spawning.absorbNeighbor(brick);
    spawning.update(.02);
    assert.equal(spawning.healing.length, 1, 'enlarging cannot refresh a used spawner');
  }
});

test('editor permits unfinished portal pairs and edits only selected endpoints', () => {
  const engine = require('../src/game.js');
  const fields = new Map(), errors = [];
  const context = vm.createContext({
    ...engine, level: level(), selectedBricks: new Set(), MIXED: '',
    validateDraft: value => engine.validateCustomLevel(value, { allowUnpairedPortals: true }),
    regionKey: region => `${region.edge}:${region.start}:${region.end}`,
    $: selector => {
      if (!fields.has(selector)) fields.set(selector, { value: '', checked: false });
      return fields.get(selector);
    },
    attempt(action) { try { action(); } catch (error) { errors.push(error.message); } },
    message() {}, markChanged() {},
    setSelection(events, bricks) { context.selectedBricks = new Set(bricks); context.renderBoard(); },
    renderBoard() { context.previewGame = new Game(() => .5, { customLevel: context.level, editorPreview: true }); },
  });
  context.renderBoard();
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const start = source.indexOf('function brickEntry(');
  vm.runInContext(source.slice(start, source.indexOf('\nfor (const selector', start)), context);
  const select = ids => { context.selectedBricks = new Set(ids.map(id => context.regionKey(context.previewGame.bricks[id].region))); };
  const change = (id, value, checked) => {
    const field = context.$(`#${id}`);
    field.value = value; field.checked = checked;
    context.saveBrick({ target: { id } });
  };
  select([0]);
  change('brick-portal', '', true);
  assert.equal(context.previewGame.bricks.filter(brick => brick.portal).length, 1);
  assert.throws(() => validateCustomLevel(context.level), /exactly two/);
  select([0, 1]);
  change('brick-portal-color', 'purple');
  assert.equal(context.previewGame.bricks.filter(brick => brick.portal).length, 2);
  change('brick-toggle-clicks', '2');
  change('brick-crumbler', '', true);
  assert.equal(context.previewGame.bricks[1].toggle, 2);
  assert.equal(context.previewGame.bricks[1].crumbler, 5);
  select([0]);
  context.$('#brick-spawn-item').value = 'weapon:silver';
  change('brick-spawner', '', true);
  assert.equal(context.previewGame.bricks.filter(brick => brick.portal).length, 1);
  assert.equal(context.previewGame.bricks[1].portal, 'purple');
  assert.equal(context.previewGame.bricks[1].toggle, 2);
  assert.equal(context.previewGame.bricks[1].crumbler, 5);
  assert.equal(context.previewGame.bricks[0].spawner.type, 'silver');
  change('brick-boost', '', true);
  assert.equal(context.previewGame.bricks[0].spawner, null);
  assert.equal(context.previewGame.bricks[0].boost, true);
  select([2, 3, 4]);
  change('brick-portal-color', 'orange');
  assert.equal(context.previewGame.bricks.filter(brick => brick.portal === 'orange').length, 3);
  assert.throws(() => validateCustomLevel(context.level), /orange/);
  select([4]);
  change('brick-plain');
  assert.equal(context.previewGame.bricks.filter(brick => brick.portal === 'orange').length, 2);
  select([1]);
  change('brick-portal', '', false);
  assert.doesNotThrow(() => validateCustomLevel(context.level));
  select([0]);
  change('brick-kind', 'cinder');
  assert.equal(context.previewGame.bricks[0].kind, 'cinder');
  assert.equal(context.previewGame.bricks[0].boost, false);
  assert.equal(context.previewGame.bricks[0].crumbler, null);
  assert.equal(context.previewGame.bricks[0].toggle, null);
  assert.doesNotThrow(() => validateCustomLevel(context.level));
  change('brick-kind', 'normal');
  assert.equal(context.previewGame.bricks[0].kind, 'normal');
  assert.equal(context.previewGame.bricks[0].boost, false);
  const ids = context.previewGame.perimeter.slice(0, 3);
  select(ids);
  context.combineOwner = ids[1];
  change('brick-kind', 'fast');
  select([ids[0]]); change('brick-kind', 'slow'); select(ids);
  context.combineBricks();
  assert.equal(context.level.brickGroups.length, 1);
  assert.equal(context.level.brickGroups[0].owner, ids[1]);
  assert.equal(context.previewGame.bricks[ids[0]].absorbedBy, ids[1]);
  assert.equal(context.previewGame.bricks[ids[0]].kind, 'fast', 'chosen owner replaces differing attributes');
  change('brick-kind', 'slow');
  assert.equal(ids.every(id => context.previewGame.bricks[id].kind === 'slow'), true);
  context.splitBricks();
  assert.equal(context.level.brickGroups.length, 0);
  assert.equal(ids.every(id => context.previewGame.bricks[id].absorbedBy === null), true);
  assert.equal(ids.every(id => context.previewGame.bricks[id].kind === 'slow'), true);
  assert.equal(errors.length, 0);
});

test('all new tutorial lessons complete with real movement and selections', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    for (const id of ['portal', 'toggle', 'spawner', 'boost']) {
      const tutorial = new Tutorial(), game = tutorial.select(LESSONS.findIndex(lesson => lesson.id === id), options);
      assert.equal(tutorial.observe(), false);
      if (id === 'toggle') {
        for (const brick of game.bricks.filter(brick => brick.id !== tutorial.target.id).slice(0, 1)) {
          assert.equal(tutorial.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
        }
      } else {
        const brick = id === 'boost' ? edgeBrick(game, 'left') : tutorial.target;
        assert.equal(tutorial.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
        game.update(1);
      }
      assert.equal(tutorial.observe(), true, `${id} completes`);
    }
  }
});

test('shared visuals render matching portal colors, countdown switches and grey item outlines', () => {
  const node = () => ({
    attributes: {}, children: [], style: { setProperty(name, value) { this[name] = value; } }, dataset: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    append(...children) { this.children.push(...children); },
    querySelector(selector) { return this.children.find(child => child.attributes.class === selector.slice(1)); },
  });
  const context = vm.createContext({ KoshiGame: require('../src/game.js'), document: { createElementNS: node } });
  vm.runInContext(readFileSync(path.join(__dirname, '..', 'src', 'brick-visuals.js'), 'utf8'), context);
  for (const vertical of [false, true]) {
    const brick = { x: 0, y: 0, w: vertical ? 25 : 100, h: vertical ? 100 : 25, kind: 'cinder' };
    const button = node(), visual = context.KoshiBrickVisuals.decorateBrick(button, brick, [brick]);
    const block = button.children[0];
    assert.equal(visual.info, null);
    assert.equal(block.attributes.class, 'brick-cinder');
    assert.equal(block.attributes.viewBox, vertical ? '0 0 58 100' : '0 0 100 58');
    assert.equal(block.children[0].children.filter(child => child.attributes.fill === '#343d3a').length, 2);
  }
  for (const color of Object.keys(PORTALS)) {
    const brick = { x: 0, y: 0, w: 100, h: 25, portal: color, toggle: 4, toggleRemaining: 4 };
    const visual = context.KoshiBrickVisuals.decorateBrick(node(), brick, [brick]);
    assert.equal(visual.cloud.style.color, PORTALS[color]);
    assert.equal(visual.cloud.attributes.viewBox, '0 0 100 25');
    assert.equal(visual.cloud.querySelector('.portal-haze').attributes.d, 'M0 0L100 0L100 25L0 25L0 0Z');
    const container = node();
    Object.assign(visual.button.style, { left: '10%', top: '20%', width: '30%', height: '5%' });
    context.KoshiBrickVisuals.exposePortalCloud(visual, container);
    assert.equal(container.children[0], visual.cloud);
    for (const property of ['left', 'top', 'width', 'height']) assert.equal(visual.cloud.style[property], visual.button.style[property]);
    assert.equal(visual.knob.attributes.cx, '26');
    assert.equal(visual.count.textContent, '4');
    assert.equal(visual.count.attributes['font-size'], '32');
    const toggle = visual.info.children.find(child => child.attributes.class === 'brick-toggle');
    assert.equal(toggle.children[0].children[0].attributes.stroke, '#19252d');
    assert.equal(toggle.children[0].children[0].attributes['stroke-width'], '5');
    brick.toggleRemaining = 0;
    context.KoshiBrickVisuals.updateBrick(visual, brick, 2);
    assert.equal(visual.knob.attributes.cx, '62');
    assert.equal(visual.count.textContent, '0');
    const puffs = visual.cloud.querySelector('.portal-puffs');
    assert.equal(puffs.attributes['stroke-dashoffset'], undefined);
    assert.ok(Number(puffs.style.opacity) >= .6 && Number(puffs.style.opacity) <= .8);
    const opacity = puffs.style.opacity;
    context.KoshiBrickVisuals.updateBrick(visual, brick, 2);
    assert.equal(puffs.style.opacity, opacity);
    context.KoshiBrickVisuals.updateBrick(visual, brick, 3);
    assert.notEqual(puffs.style.opacity, opacity);
  }
  for (const [clicks, color] of [[1, 'red'], [2, 'green'], [4, 'blue']]) {
    const brick = { x: 0, y: 0, w: 25, h: 100, toggle: clicks, toggleRemaining: clicks };
    const visual = context.KoshiBrickVisuals.decorateBrick(node(), brick, [brick]);
    const toggle = visual.info.children.find(child => child.attributes.class === 'brick-toggle');
    assert.equal(toggle.style.color, PORTALS[color]);
    assert.equal(visual.count.textContent, String(clicks));
    assert.equal(visual.count.attributes.transform, 'rotate(-90 26 26)');
  }
  for (const vertical of [false, true]) {
    for (let mask = 0; mask < 8; mask++) {
      const brick = { id: 0, x: 20, y: 20, w: vertical ? 22 : 110, h: vertical ? 110 : 22,
        crumbler: mask & 1 ? 5 : null, usesLeft: mask & 1 ? 3 : null,
        warped: mask & 2 ? 15 : null, warpUntil: mask & 2 ? 12 : null,
        toggle: mask & 4 ? 4 : null, toggleRemaining: 2 };
      const plain = context.KoshiBrickVisuals.decorateBrick(node(), brick, [brick]);
      const members = [brick, { x: 20, y: 20, w: 800, h: 22 }, { x: 798, y: 20, w: 22, h: 500 }];
      const merged = context.KoshiBrickVisuals.decorateBrick(node(), brick, members);
      assert.equal(merged.vertical, vertical, 'orientation follows original owner, not merged bounding box');
      if (!mask) { assert.equal(merged.info, null); continue; }
      assert.equal(merged.info.attributes.viewBox, plain.info.attributes.viewBox, 'growth never enlarges the information layout');
      assert.equal(merged.info.children.length, [1, 2, 4].filter(bit => mask & bit).length);
      const container = node();
      context.KoshiBrickVisuals.exposeBrickInfo(merged, container, brick, 960, 600);
      const bounds = merged.infoBounds;
      assert.equal(merged.info.style.cssText, `left:${bounds.x / 960 * 100}%;top:${bounds.y / 600 * 100}%;width:${brick.w / 960 * 100}%;height:${brick.h / 600 * 100}%;`);
      context.KoshiBrickVisuals.updateBrick(merged, brick, 4);
      if (mask & 1) assert.equal(merged.crumblerCount.textContent, 'C:3');
      if (mask & 2) assert.equal(merged.warpCount.textContent, 'W:8');
      if (mask & 4) assert.equal(merged.count.textContent, '2');
      if (mask & 1) {
        brick.usesLeft = 0;
        context.KoshiBrickVisuals.updateBrick(merged, brick, 4);
        assert.equal(merged.crumblerCount.textContent, 'C:0');
        if (mask & 2) assert.equal(merged.warpCount.textContent, 'W:X');
      }
    }
  }
  for (const spawn of [
    ...Object.keys(FOODS).map(type => ({ kind: 'food', type })),
    ...Object.keys(SWORDS).map(type => ({ kind: 'weapon', type })),
    { kind: 'enemy', type: 'mouse' }, { kind: 'enemy', type: 'wheel' }, { kind: 'heart', type: 'heart' },
  ]) {
    assert.ok(spawnSymbol(spawn));
    const brick = { x: 0, y: 0, w: 100, h: 25, spawner: spawn };
    const visual = context.KoshiBrickVisuals.decorateBrick(node(), brick, [brick]);
    assert.equal(visual.symbol.style.opacity, '1');
    assert.equal(visual.symbol.dataset.spawnReady, 'true');
    assert.equal(visual.symbol.style['--item-color'], context.KoshiBrickVisuals.spawnColor(spawn));
    if (spawn.kind === 'weapon') assert.equal(visual.symbol.style['--item-color'], SWORDS[spawn.type].color);
    assert.equal(visual.symbol.children[0].attributes.class, 'item-outline');
    assert.equal(visual.symbol.children[1].attributes.class, 'item-color');
    assert.equal(visual.symbol.children[0].attributes.d, visual.symbol.children[1].attributes.d);
    brick.spawned = true;
    context.KoshiBrickVisuals.updateBrick(visual, brick, 0);
    assert.equal(visual.symbol.style.opacity, '1');
    assert.equal(visual.symbol.dataset.spawnReady, 'false');
    brick.spawned = false;
    brick.toggle = 2; brick.toggleRemaining = 2;
    context.KoshiBrickVisuals.updateBrick(visual, brick, 0);
    assert.equal(visual.symbol.dataset.spawnReady, 'true');
    assert.equal(visual.symbol.style.opacity, '1', 'Toggle state does not dim active spawners');
    brick.spawned = true;
    assert.match(specialLabel(brick), /already used/);
  }
  const boost = { x: 0, y: 0, w: 100, h: 25, boost: true };
  const boostVisual = context.KoshiBrickVisuals.decorateBrick(node(), boost, [boost]);
  assert.equal(boostVisual.symbol.attributes.class, 'brick-item-symbol brick-boost-symbol');
  assert.equal(boostVisual.symbol.children[0].attributes.fill, '#f58428');
  assert.equal(boostVisual.symbol.children[0].attributes.stroke, '#17212a');
  assert.equal(boostVisual.symbol.children[0].attributes['stroke-width'], '3');
  assert.equal(boostVisual.symbol.dataset.spawnReady, 'false', 'Boost does not use the spawner rainbow glow');
  boost.toggle = 2; boost.toggleRemaining = 2;
  context.KoshiBrickVisuals.updateBrick(boostVisual, boost, 0);
  assert.equal(boostVisual.symbol.style.opacity, '.8', 'Toggle state does not dim an active Boost surface');
  const compact = { x: 0, y: 0, w: 68, h: 50, crumbler: 5, usesLeft: 5, warped: 15, toggle: 4, toggleRemaining: 4 };
  const compactVisual = context.KoshiBrickVisuals.decorateBrick(node(), compact, [compact]);
  assert.equal(compactVisual.info.attributes.viewBox, '0 0 158 116');
  assert.equal(compactVisual.info.children[0].attributes.y, '0');
  assert.equal(compactVisual.info.children[1].attributes.y, '58');
  assert.equal(compactVisual.info.children[2].attributes.x, '64');
});

test('special graphics center on the full starting or grown brick, including corner unions', () => {
  const { brickInfoBounds } = require('../src/brick-visuals.js');
  for (const vertical of [false, true]) {
    const brick = { x: 20, y: 20, w: vertical ? 22 : 100, h: vertical ? 100 : 22 };
    const members = [brick, { x: vertical ? 20 : 120, y: vertical ? 120 : 20, w: brick.w, h: brick.h }];
    const bounds = brickInfoBounds(brick, members);
    assert.equal(bounds.x + bounds.w / 2, vertical ? 31 : 120);
    assert.equal(bounds.y + bounds.h / 2, vertical ? 120 : 31);
    assert.equal(bounds.w, brick.w);
    assert.equal(bounds.h, brick.h);
  }
  const game = arena(), brick = game.bricks[0];
  brick.warped = 30;
  for (let count = 0; count < 7; count++) game.absorbNeighbor(brick);
  const members = game.brickParts().filter(part => part.id === brick.id);
  const bounds = brickInfoBounds(brick, members);
  const x = bounds.x + bounds.w / 2, y = bounds.y + bounds.h / 2;
  assert.ok(members.some(part => x >= part.x && x <= part.x + part.w && y >= part.y && y <= part.y + part.h),
    'the center marker stays on solid brick, never in the empty center of an L');
  assert.ok(Math.hypot(x - (brick.x + brick.w / 2), y - (brick.y + brick.h / 2)) > 20,
    'growth moves the graphics away from the initial owner');
});
