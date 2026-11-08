const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const engine = require('../src/game.js');
const { Game, HAZARDS, hazardEnabled, brickRegions, brickEditRegions, turretGeometry, validateCustomLevel } = engine;

const blank = () => ({ version: 1, id: 'Hazard tests', duration: 120, goal: 1000, heartCost: null, brickSet: 1, events: [] });
function arena(type = 'missile', attributes = {}, options = {}) {
  const base = new Game(() => .5, options);
  const top = base.bricks.filter(brick => brickRegions(base.bricks, base.width, base.height).get(brick.id).edge === 'top')
    .sort((a, b) => Math.abs(a.x + a.w / 2 - base.width / 2) - Math.abs(b.x + b.w / 2 - base.width / 2))[0];
  const customLevel = { ...blank(), brickTypes: [{ ...brickEditRegions(base.bricks).get(top.id), kind: 'normal', hazard: { type, ...attributes } }] };
  const game = new Game(() => .5, { ...options, customLevel });
  game.start();
  return game;
}
const emitter = game => game.bricks.find(brick => brick.hazard);

test('all ten hazards round-trip exact types, intervals, and independent power borders', () => {
  assert.equal(Object.keys(HAZARDS).length, 10);
  for (const type of Object.keys(HAZARDS)) for (const power of [null, 'black', 'yellow']) {
    const hazard = { type, power, ...(HAZARDS[type].interval ? { interval: 2.75 } : {}),
      ...(HAZARDS[type].appearance ? { color: '#fe107e', pattern: 'checkered', patternColor: '#15ffe2' } : {}) };
    const game = arena(type, hazard);
    const level = validateCustomLevel(JSON.parse(JSON.stringify(game.customLevel)));
    assert.deepEqual(level.brickTypes[0].hazard, hazard);
    assert.deepEqual(emitter(new Game(() => .5, { customLevel: level })).hazard, hazard);
  }
  for (const hazard of [false, [], {}, { type: 'unknown' }, { type: ['laser'] }, { type: 'laser', interval: 1 },
    { type: 'flame', power: 'blue' }, ...[0, -.1, 3601, Infinity, '3', null].map(interval => ({ type: 'missile', interval })),
    { type: 'bumper-red', color: '#123456' }, { type: 'laser', pattern: 'stripes' }, { type: 'obstructor', color: 'red' },
    { type: 'obstructor', patternColor: '#123' }, { type: 'obstructor', pattern: 'plaid' }]) {
    assert.throws(() => validateCustomLevel({
      ...blank(), brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', hazard }],
    }), TypeError);
  }
  for (const interval of [.1, 3600]) assert.equal(arena('missile', { interval }).customLevel.brickTypes[0].hazard.interval, interval);
  assert.throws(() => validateCustomLevel({ ...blank(), brickTypes: [
    { edge: 'top', start: 0, end: .1, kind: 'normal', hazard: { type: 'flame' }, spikes: true },
  ] }), /cannot combine contact surfaces/);
});

test('power color gates every hazard while Toggle, cooldown, and exhaustion only affect selection', () => {
  for (const type of Object.keys(HAZARDS)) for (const power of [null, 'black', 'yellow']) {
    const game = arena(type, { power }), brick = emitter(game);
    for (const on of [false, true]) assert.equal(hazardEnabled(brick, on), power === null || (power === 'black') === on);
    brick.toggle = 1; brick.toggleRemaining = 1;
    assert.equal(hazardEnabled(brick, power === 'black'), true);
    brick.toggleRemaining = 0; brick.usesLeft = 0;
    assert.equal(hazardEnabled(brick, power === 'black'), true);
    assert.equal(brick.kind, 'normal');
  }
});

test('missiles wait exactly ten visible seconds; intervals, pause, power, and restart are independent', () => {
  const game = arena(), brick = emitter(game);
  game.cat.x = 100; game.cat.y = 300;
  game.update(9.99);
  assert.equal(game.hazardMissiles.length, 0);
  game.pause(); game.update(20);
  assert.equal(game.hazardMissiles.length, 0);
  game.resume(); game.update(.01);
  assert.equal(game.hazardMissiles.length, 1);
  game.reset();
  assert.equal(game.hazardMissiles.length, 0);
  assert.equal(game.hazardTimers.size, 0);
  assert.equal(brick.hazard.type, 'missile');
  const gated = arena('missile', { power: 'black', interval: .5 });
  gated.update(1);
  assert.equal(gated.hazardMissiles.length, 0);
  gated.powerOn = true;
  gated.update(.49); assert.equal(gated.hazardMissiles.length, 0);
  gated.update(.01); assert.equal(gated.hazardMissiles.length, 1);
});

test('laser beams damage Koshi, allow crossing, stop at obstacles, and never harm enemies', () => {
  const game = arena('laser'), brick = emitter(game);
  const { anchor } = turretGeometry(brick, game.width, game.height);
  game.cat.x = anchor.x - 50; game.cat.y = anchor.y + 100;
  game.cat.vx = 300; game.cat.vy = 0;
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'mouse', x: .5, y: .7 })[0];
  game.robots.push(enemy);
  game.update(.4);
  assert.equal(game.hearts, 2);
  assert.ok(game.cat.x > anchor.x + 40);
  assert.ok(game.robots.includes(enemy));
  assert.equal(game.hazardBeams.length, 1);
  game.obstructions.push(game.createObstruction({ x: anchor.x, y: anchor.y + 180 }, { type: 'obstruction-circle' }));
  game.update(.01);
  assert.ok(game.hazardBeams[0].end.y < anchor.y + 180);
});

test('flames damage stationary contact but not a distant Koshi; power immediately removes the fire', () => {
  const game = arena('flame', { power: 'yellow' }), brick = emitter(game);
  const { anchor, direction } = turretGeometry(brick, game.width, game.height);
  game.cat.x = anchor.x + direction.x * game.cat.radius;
  game.cat.y = anchor.y + direction.y * game.cat.radius;
  game.update(.01);
  assert.equal(game.hearts, 2);
  assert.ok(game.hazardFlames.length);
  game.powerOn = true; game.invulnerableUntil = 0; game.update(.01);
  assert.equal(game.hearts, 2);
  assert.equal(game.hazardFlames.length, 0);
});

test('missile homing is capped at 0.65 radians/second and all solid impacts explode without enemy damage', () => {
  const game = arena();
  const missile = { x: 300, y: 250, radius: 9, angle: 0 };
  game.cat.x = 300; game.cat.y = 500;
  game.hazardMissiles.push(missile);
  game.updateHazardDamage(.1, [], game.cat.x, game.cat.y);
  assert.ok(Math.abs(missile.angle - .065) < 1e-9);
  assert.ok(Math.abs(Math.hypot(missile.vx, missile.vy) - 150) < 1e-9);
  for (const obstacle of ['brick', 'obstruction', 'bumper', 'cat']) {
    const victim = arena();
    victim.cat.x = obstacle === 'cat' ? 340 : 500; victim.cat.y = 300;
    const parts = obstacle === 'brick' ? [{ x: 340, y: 270, w: 20, h: 60 }] : [];
    if (obstacle === 'obstruction') victim.obstructions.push(victim.createObstruction({ x: 360, y: 300 }, { type: 'obstruction-circle' }));
    if (obstacle === 'bumper') victim.bumpers.push(victim.createBumper({ x: 390, y: 300 }, 'bumper-red'));
    const enemy = victim.createCustomSpawn({ kind: 'enemy', type: 'mouse', x: .5, y: .5 })[0];
    enemy.x = 320; enemy.y = 300; victim.robots.push(enemy);
    victim.hazardMissiles.push({ x: 300, y: 300, radius: 9, angle: 0 });
    victim.updateHazardDamage(.4, parts, victim.cat.x, victim.cat.y);
    assert.equal(victim.hazardMissiles.length, 0, obstacle);
    assert.equal(victim.hazardExplosions.length, 1, obstacle);
    assert.equal(victim.hearts, obstacle === 'cat' ? 2 : 3);
    assert.ok(victim.robots.includes(enemy));
  }
});

test('all colored guns fire straight inward and bubbles suspend globally until escape', () => {
  for (const [kind, color] of [...['bubble', 'bumper'].flatMap(kind => ['red', 'green', 'blue'].map(color => [kind, color])), ['obstructor', null]]) {
    const type = color ? `${kind}-${color}` : kind, field = color ? `${kind}s` : 'obstructions';
    const game = arena(type, { interval: .5 });
    game.cat.x = 100; game.cat.y = 300;
    game.update(.49);
    assert.equal(game[field].length, 0);
    game.update(.01);
    assert.equal(game[field].length, 1);
    const shot = game[field][0];
    assert.equal(shot.type, color ? type : 'obstruction-circle');
    assert.equal(shot.vx, 0); assert.equal(shot.vy, 120);
    const y = shot.y;
    assert.ok(Math.abs(shot.emerge.dx) < 1e-9); assert.equal(shot.emerge.dy, 1);
    const age = shot.emerge.age;
    game.update(.1); assert.ok(shot.y > y);
    assert.ok(Math.abs(shot.emerge.age - age - .1) < 1e-9);
    assert.ok(shot.emerge.y < shot.y - shot.radius);
    if (kind === 'bubble') {
      game.bubbleTrap = { color: 'blue', fromX: 100, fromY: 300, x: 100, y: 300, age: 0, transition: .18, duration: 5 };
      game.bubbles = [];
      game.update(2);
      assert.equal(game.bubbles.length, 0);
      game.bubbleTrap = null;
      game.update(.49); assert.equal(game.bubbles.length, 0);
      game.update(.01); assert.equal(game.bubbles.length, 1);
    }
  }
});

test('moving bubble captures a stationary Koshi and moving bumper launches him without damage', () => {
  for (const kind of ['bubble', 'bumper']) {
    const game = arena(`${kind}-red`, { interval: .1 }), brick = emitter(game);
    const { anchor } = turretGeometry(brick, game.width, game.height);
    game.cat.x = anchor.x; game.cat.y = anchor.y + 130;
    game.update(.8);
    assert.equal(game.hearts, 3);
    if (kind === 'bubble') assert.equal(game.bubbleTrap.color, 'red');
    else assert.ok(game.cat.vy > 0);
  }
});

test('a bumper shot that forces Koshi into a brick kills him at once', () => {
  for (const options of [{}, { portrait: true }]) for (const offset of [0, 30, -45]) {
    const game = arena('bumper-blue', { interval: 1 }, options), brick = emitter(game);
    const { anchor } = turretGeometry(brick, game.width, game.height);
    const regions = brickRegions(game.bricks, game.width, game.height);
    const floor = Math.min(...game.bricks.filter(part => regions.get(part.id).edge === 'bottom').map(part => part.y));
    game.cat.x = anchor.x + offset; game.cat.y = floor - game.cat.radius;
    let embeddedAlive = false;
    for (let step = 0; step < 900 && game.state === 'playing'; step++) {
      game.update(1 / 60);
      if (game.state === 'playing' && game.catInsideBrick(game.brickParts())) embeddedAlive = true;
    }
    assert.equal(embeddedAlive, false, `${JSON.stringify(options)} offset ${offset}`);
    assert.equal(game.state, 'lost');
    assert.equal(game.hearts, 0);
  }
});

test('obstructor shots carry their look, shove Koshi without damage, crush him against bricks, and spare enemies', () => {
  const look = { color: '#123456', pattern: 'stripes', patternColor: '#abcdef' };
  for (const options of [{}, { portrait: true }]) {
    const game = arena('obstructor', { interval: 1, ...look }, options), brick = emitter(game);
    const { anchor } = turretGeometry(brick, game.width, game.height);
    game.cat.x = anchor.x; game.cat.y = anchor.y + 260;
    game.update(1);
    const shot = game.obstructions[0];
    assert.deepEqual({ color: shot.color, pattern: shot.pattern, patternColor: shot.patternColor }, look);
    assert.equal(engine.obstructionGeometry(shot).radius, 48);
    game.update(2.2);
    assert.equal(game.state, 'playing'); assert.equal(game.hearts, 3);
    assert.ok(game.cat.y > anchor.y + 260 + 1, 'pushed ahead of the shot');
    assert.ok(Math.hypot(game.cat.x - shot.x, game.cat.y - shot.y) >= game.cat.radius + 48 - .25);
  }
  for (const [offset, crushed] of [[0, true], [20, true], [60, false]]) {
    const game = arena('obstructor', { interval: 1 }), brick = emitter(game);
    const { anchor } = turretGeometry(brick, game.width, game.height);
    const regions = brickRegions(game.bricks, game.width, game.height);
    const floor = Math.min(...game.bricks.filter(part => regions.get(part.id).edge === 'bottom').map(part => part.y));
    game.cat.x = anchor.x + offset; game.cat.y = floor - game.cat.radius;
    for (let step = 0; step < 600 && game.state === 'playing'; step++) {
      game.update(1 / 60);
      if (game.state === 'playing') assert.equal(game.catInsideBrick(game.brickParts(), .25), false);
    }
    assert.equal(game.state, crushed ? 'lost' : 'playing', `offset ${offset}`);
    assert.equal(game.hearts, crushed ? 0 : 3);
  }
  const level = { ...arena('obstructor', { interval: .5 }).customLevel, events: [{ time: 0, kind: 'enemy', type: 'mouse', x: .5, y: .5 }] };
  const game = new Game(() => .5, { customLevel: level });
  game.start(); game.cat.x = 100; game.cat.y = 300;
  game.update(.1);
  assert.equal(game.robots.length, 1);
  game.update(8);
  assert.equal(game.robots.length, 1);
  assert.equal(game.enemies, 0);
  assert.equal(game.enemyDeaths.length, 0);
});

test('gun bubbles pop visibly while bumper and obstructor shots pass through bricks until off the board', () => {
  for (const options of [{}, { portrait: true }]) {
    const game = arena('bubble-green', { interval: 1 }, options);
    game.cat.x = 100; game.cat.y = 300;
    game.update(1);
    const bubble = game.bubbles[0];
    let last;
    while (game.bubbles.includes(bubble)) { last = { x: bubble.x, y: bubble.y }; game.update(1 / 60); }
    assert.equal(game.bubblePops.length, 1);
    const pop = game.bubblePops[0];
    assert.equal(pop.color, 'green');
    assert.ok(pop.y >= last.y && pop.y <= last.y + 2.01 && Math.abs(pop.x - last.x) < 1e-9);
    game.update(.6);
    assert.equal(game.bubblePops.length, 0);
    const trapped = arena('bubble-red', { interval: 1 }, options);
    trapped.cat.x = 100; trapped.cat.y = 300;
    trapped.update(1);
    const shot = trapped.bubbles[0];
    trapped.bubbleTrap = { color: 'blue', fromX: shot.x, fromY: shot.y + 40, x: shot.x, y: shot.y + 40, age: 0, transition: .18, duration: 5 };
    trapped.update(.1);
    assert.deepEqual(trapped.bubblePops.map(pop => pop.color), ['red']);
  }
  for (const options of [{}, { portrait: true }]) for (const type of ['bumper-blue', 'obstructor']) {
    const game = arena(type, { interval: 30 }, options);
    game.cat.x = 100; game.cat.y = 300;
    game.update(30);
    const list = () => type === 'obstructor' ? game.obstructions : game.bumpers, shot = list()[0];
    const radius = shot.radius ?? engine.obstructionGeometry(shot).radius;
    const parts = game.brickParts();
    let crossedBrick = false;
    while (list().includes(shot)) {
      assert.ok(shot.y - radius <= game.height, `${type} stays while any part is on the board`);
      if (parts.some(part => shot.x >= part.x && shot.x <= part.x + part.w && shot.y >= part.y && shot.y <= part.y + part.h)) crossedBrick = true;
      game.update(1 / 60);
    }
    assert.ok(crossedBrick, `${type} moves through the far brick`);
    assert.ok(shot.y - radius > game.height, `${type} leaves only after clearing the board`);
    assert.equal(game.bubblePops.length, 0);
  }
});

test('portrait emitters point inward and disappear when their hazard surface is removed', () => {
  for (const options of [{}, { portrait: true }, { portrait: true, scale: .5 }]) {
    const game = arena('laser', {}, options), brick = emitter(game);
    game.cat.x = 100; game.cat.y = 300;
    game.update(.01);
    const { anchor, direction } = turretGeometry(brick, game.width, game.height);
    assert.equal(game.hazardBeams[0].start.x, anchor.x + direction.x * .1);
    assert.equal(game.hazardBeams[0].start.y, anchor.y + direction.y * .1);
    brick.hazard = null; game.update(.01);
    assert.equal(game.hazardBeams.length, 0);
  }
});

test('long-board guns wait for actual visibility and reset on leaving the camera', () => {
  const level = { ...blank(), autoscroll: { length: 24, speed: 0, events: [] } };
  const base = new Game(() => .5, { customLevel: level });
  const brick = base.bricks.find(brick => !base.brickVisible(brick)
    && brickRegions(base.bricks, base.width, base.height).get(brick.id).edge === 'top');
  level.brickTypes = [{ ...brick.region, kind: 'normal', hazard: { type: 'missile', interval: .5 } }];
  const game = new Game(() => .5, { customLevel: level });
  game.start();
  const source = emitter(game), parts = game.brickParts();
  game.elapsed = 30;
  game.updateHazardEmitters(30, parts);
  assert.equal(game.hazardTimers.size, 0);
  assert.equal(game.hazardMissiles.length, 0);
  game.camera = () => ({ x: source.x - 100, y: 0, width: game.viewportWidth, height: game.viewportHeight });
  assert.equal(game.brickVisible(source), true);
  game.updateHazardEmitters(.49, parts);
  assert.equal(game.hazardMissiles.length, 0);
  game.updateHazardEmitters(.01, parts);
  assert.equal(game.hazardMissiles.length, 1);
  game.camera = () => ({ x: 0, y: 0, width: game.viewportWidth, height: game.viewportHeight });
  game.updateHazardEmitters(.01, parts);
  assert.equal(game.hazardTimers.size, 0);
});

test('merged hazards emit once from the clockwise middle sub-brick', () => {
  const base = arena('missile', { interval: .5, power: 'yellow' }), brick = emitter(base);
  const index = base.perimeter.indexOf(brick.id), members = base.perimeter.slice(index, index + 3);
  const level = { ...base.customLevel, brickGroups: [{ owner: brick.id, members }] };
  const game = new Game(() => .5, { customLevel: level });
  game.start(); game.cat.x = 100; game.cat.y = 300;
  game.updateHazardEmitters(.5, game.brickParts());
  assert.equal(game.hazardMissiles.length, 1);
  const middle = engine.middleBrickInGroup(emitter(game), game.bricks, game.perimeter);
  const { anchor } = turretGeometry(middle, game.width, game.height);
  assert.equal(game.hazardMissiles[0].x, anchor.x);
  assert.equal(emitter(game).hazard.interval, .5);
  assert.ok(members.filter(id => id !== brick.id).every(id => game.bricks[id].absorbedBy === brick.id));
});

test('corner-merged guns and portals launch from the sub-brick whose face is not blocked by the corner', () => {
  for (const options of [{}, { portrait: true }]) {
    const base = new Game(() => .5, options), regions = brickRegions(base.bricks, base.width, base.height);
    const perimeter = base.perimeter, n = perimeter.length;
    let blocked = 0;
    for (let i = 0; i < n; i++) {
      const a = perimeter[i], b = perimeter[(i + 1) % n];
      if (regions.get(a).edge === regions.get(b).edge) continue;
      // Exactly one brick of each corner pair spans the corner; its inward face meets the other wall.
      const faceClear = id => {
        const { center } = turretGeometry(base.bricks[id], base.width, base.height, base.cat.radius);
        return !base.bricks.some(other => other.id !== id && Math.hypot(
          center.x - Math.max(other.x, Math.min(other.x + other.w, center.x)),
          center.y - Math.max(other.y, Math.min(other.y + other.h, center.y))) <= base.cat.radius);
      };
      const expected = faceClear(b) ? b : a;
      if (!faceClear(b)) blocked++;
      assert.ok(faceClear(expected));
      const edit = brickEditRegions(base.bricks);
      const gun = new Game(() => .5, { ...options, customLevel: { ...blank(), brickGroups: [{ owner: a, members: [a, b] }],
        brickTypes: [{ ...edit.get(a), kind: 'normal', hazard: { type: 'bumper-red', interval: .5 } }] } });
      gun.start(); gun.cat.x = gun.width / 2; gun.cat.y = gun.height / 2;
      assert.equal(gun.groupSource(gun.bricks[a]).id, expected);
      gun.updateHazardEmitters(.5, gun.brickParts());
      assert.equal(gun.bumpers.length, 1);
      const { anchor } = turretGeometry(gun.bricks[expected], gun.width, gun.height);
      assert.ok(Math.hypot(gun.bumpers[0].emerge.x - anchor.x, gun.bumpers[0].emerge.y - anchor.y) < 1e-9);
      gun.updateHazardEmitters(.05, gun.brickParts());
      assert.equal(gun.bumpers.length, 1, 'the shot is not swallowed by the perpendicular wall');
      const far = perimeter[(i + Math.floor(n / 2)) % n];
      const portal = new Game(() => .5, { ...options, customLevel: { ...blank(), brickGroups: [{ owner: a, members: [a, b] }],
        brickTypes: [a, far].map(id => ({ ...edit.get(id), kind: 'normal', portal: 'purple' })) } });
      portal.start();
      const exit = portal.portalExit(portal.bricks[a]), center = portal.bricks[expected];
      assert.ok(Math.abs(exit.markerX - (center.x + center.w / 2)) < 1e-9 && Math.abs(exit.markerY - (center.y + center.h / 2)) < 1e-9,
        'the portal marker sits on the clear sub-brick without sliding along the wall');
    }
    assert.equal(blocked, 2);
  }
});

test('gun shots slide out of corner pockets on every layout instead of being swallowed by the wall', () => {
  for (const options of [{}, { portrait: true }, { portrait: true, scale: .5 }, { portrait: true, scale: .3 }]) {
    const base = new Game(() => .5, options), edit = brickEditRegions(base.bricks);
    const regions = brickRegions(base.bricks, base.width, base.height), perimeter = base.perimeter, n = perimeter.length;
    const groups = perimeter.map(id => [id]);
    for (let i = 0; i < n; i++) {
      const a = perimeter[i], b = perimeter[(i + 1) % n];
      if (regions.get(a).edge !== regions.get(b).edge) groups.push([a, b]);
    }
    let slid = 0;
    for (const members of groups) for (const type of ['bubble-blue', 'bumper-green', 'missile', 'obstructor']) {
      const game = new Game(() => .5, { ...options, customLevel: { ...blank(),
        brickGroups: members.length > 1 ? [{ owner: members[0], members }] : [],
        brickTypes: [{ ...edit.get(members[0]), kind: 'normal', hazard: { type, interval: .5 } }] } });
      game.start(); game.brickVisible = () => true; game.cat.x = game.cat.y = -9999;
      const parts = game.brickParts();
      game.updateHazardEmitters(.5, parts);
      const list = type === 'missile' ? game.hazardMissiles : type === 'obstructor' ? game.obstructions : type.startsWith('bubble-') ? game.bubbles : game.bumpers;
      assert.equal(list.length, 1, `${JSON.stringify(options)} ${members} ${type} fires`);
      const shot = list[0], radius = shot.radius ?? engine.obstructionGeometry(shot).radius;
      assert.equal(parts.some(part => Math.hypot(shot.x - Math.max(part.x, Math.min(part.x + part.w, shot.x)),
        shot.y - Math.max(part.y, Math.min(part.y + part.h, shot.y))) <= radius), false);
      if (shot.emerge) {
        const { anchor, direction } = turretGeometry(game.groupSource(game.bricks[members[0]]), game.width, game.height);
        // The launch point only moves along the face, toward the board center.
        const along = direction.x ? shot.emerge.y - anchor.y : shot.emerge.x - anchor.x;
        assert.equal(direction.x ? shot.emerge.x : shot.emerge.y, direction.x ? anchor.x : anchor.y);
        assert.ok(along * (direction.x ? game.height / 2 - anchor.y : game.width / 2 - anchor.x) >= 0);
        if (Math.abs(along) > 0) slid++;
      }
      for (let step = 0; step < 6; step++) game.updateHazardEmitters(.05, parts);
      if (type !== 'missile') assert.ok(list.includes(shot), `${JSON.stringify(options)} ${members} ${type} survives`);
    }
    assert.ok(slid > 0, 'corner pockets exist on every layout');
  }
});

test('editor applies only the changed hazard field and preserves intervals, colors, and merged copies', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const game = arena('missile', { interval: 2.75, power: 'black' });
  const regionKey = region => `${region.edge}:${region.start}:${region.end}`;
  const nodes = new Map(), $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', checked: false });
    return nodes.get(selector);
  };
  const context = vm.createContext({
    $, KoshiGame: engine, CONTACT_SURFACES: engine.CONTACT_SURFACES, OBJECTS: engine.OBJECTS, brickEditRegions, MIXED: '',
    level: game.customLevel, previewGame: game, selectedBricks: new Set([regionKey(emitter(game).region)]), regionKey,
    immutableBrick: kind => ['cinder', 'goal'].includes(kind),
    validateDraft: validateCustomLevel, attempt: action => action(), markChanged() {}, message() {}, renderBoard() {},
  });
  vm.runInContext(source.slice(source.indexOf('function brickEntry('), source.indexOf('function combineBricks(')), context);
  const save = (id, value) => {
    $(`#${id}`).value = value;
    context.saveBrick({ target: { id } });
    context.previewGame = new Game(() => .5, { customLevel: context.level });
    return context.level.brickTypes[0].hazard;
  };
  assert.deepEqual(JSON.parse(JSON.stringify(save('brick-hazard-power', 'yellow'))), { type: 'missile', power: 'yellow', interval: 2.75 });
  assert.deepEqual(JSON.parse(JSON.stringify(save('brick-hazard-type', 'bubble-blue'))), { type: 'bubble-blue', power: 'yellow', interval: 2.75 });
  assert.equal(save('brick-hazard-interval', '4.5').interval, 4.5);
  assert.throws(() => save('brick-hazard-interval', ''), /Enter a hazard shot interval/);
  assert.equal(context.level.brickTypes[0].hazard.interval, 4.5);
  assert.deepEqual(JSON.parse(JSON.stringify(save('brick-hazard-type', 'flame'))), { type: 'flame', power: 'yellow' });
  assert.deepEqual(JSON.parse(JSON.stringify(save('brick-hazard-power', 'none'))), { type: 'flame', power: null });
  assert.equal(save('brick-hazard-color', '#123456').color, undefined);
  save('brick-hazard-type', 'obstructor');
  assert.deepEqual(JSON.parse(JSON.stringify(save('brick-hazard-color', '#123456'))), { type: 'obstructor', power: null, color: '#123456' });
  save('brick-hazard-pattern', 'polka-dots');
  assert.deepEqual(JSON.parse(JSON.stringify(save('brick-hazard-patternColor', '#abcdef'))),
    { type: 'obstructor', power: null, color: '#123456', pattern: 'polka-dots', patternColor: '#abcdef' });
  assert.deepEqual(JSON.parse(JSON.stringify(save('brick-hazard-type', 'bumper-red'))), { type: 'bumper-red', power: null });
  save('brick-plain', '');
  assert.equal(context.level.brickTypes[0].hazard, null);
  const owner = emitter(game), index = game.perimeter.indexOf(owner.id), members = game.perimeter.slice(index, index + 2);
  context.level = { ...game.customLevel, brickGroups: [{ owner: owner.id, members }] };
  context.previewGame = new Game(() => .5, { customLevel: context.level });
  context.setSelection = () => {};
  vm.runInContext(source.slice(source.indexOf('function splitBricks('), source.indexOf("for (const selector of ['#brick-kind'", source.indexOf('function splitBricks('))), context);
  context.splitBricks();
  assert.equal(context.level.brickGroups.length, 0);
  assert.equal(context.level.brickTypes.length, 2);
  for (const entry of context.level.brickTypes) assert.deepEqual(JSON.parse(JSON.stringify(entry.hazard)), { type: 'missile', power: 'black', interval: 2.75 });
});

test('hazard icons, power borders, labels, and dimmed states share the game/editor renderer', () => {
  const node = (_namespace, tag) => ({
    tag, attributes: {}, children: [], dataset: {}, style: { setProperty() {} },
    setAttribute(name, value) { this.attributes[name] = String(value); }, append(...children) { this.children.push(...children); },
  });
  const context = vm.createContext({ KoshiGame: engine, document: { createElementNS: node } });
  vm.runInContext(readFileSync(path.join(__dirname, '..', 'src', 'brick-visuals.js'), 'utf8'), context);
  for (const type of Object.keys(HAZARDS)) for (const power of [null, 'black', 'yellow']) {
    const brick = { id: 0, x: 0, y: 0, w: 100, h: 30, kind: 'normal', hazard: { type, power } }, button = node();
    const visual = context.KoshiBrickVisuals.decorateBrick(button, brick, [brick]);
    assert.ok(visual.symbol.children.length >= 2);
    const border = button.children.find(child => child.attributes.class === 'brick-hazard-border');
    assert.equal(Boolean(border), power !== null);
    if (border) {
      const color = power === 'black' ? '#000000' : '#ffd92f';
      const part = name => border.children.find(child => child.attributes.class === `hazard-border-${name}`);
      assert.equal(border.attributes.viewBox, '0 0 100 30');
      assert.equal(part('band').attributes.fill, color);
      assert.equal(part('plates').attributes.fill, color);
      assert.equal(part('plates').attributes.d.match(/A/g).length, 4);
      assert.ok(part('light').attributes.d && part('dark').attributes.d && part('sheen').attributes.d);
      assert.equal(visual.symbol.attributes.viewBox, '-40 -40 80 80');
    } else assert.equal(visual.symbol.attributes.viewBox, '-28 -28 56 56');
    assert.match(context.KoshiBrickVisuals.specialLabel(brick), /Hazard:/);
    context.KoshiBrickVisuals.updateBrick(visual, brick, 0);
    assert.equal(visual.symbol.style.opacity, power === 'black' ? '.4' : '1');
  }
});
