const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, WEAPONS, SWORDS, LEVELS, validateCustomLevel, brickRegions } = require('../src/game.js');
const { spawnSymbol, spawnColor } = require('../src/brick-visuals.js');
const { Tutorial, LESSONS } = require('../src/learning.js');

const types = ['rope-dart-bronze', 'rope-dart-silver', 'rope-dart-gold'];
const custom = (events = [], extra = {}) => ({ version: 1, id: 'Rope Dart tests', duration: 120,
  goal: 1000, heartCost: null, brickSet: 3, events, ...extra });
function arena(options = {}) {
  const game = new Game(() => .5, { customLevel: custom(), ...options });
  game.start();
  const regions = brickRegions(game.bricks, game.width, game.height);
  const target = game.bricks.filter(brick => regions.get(brick.id).edge === 'right')
    .sort((a, b) => Math.abs(a.y + a.h / 2 - game.cat.y) - Math.abs(b.y + b.h / 2 - game.cat.y))[0];
  game.cat.y = target.y + target.h / 2;
  return { game, target };
}
function equip(game, type = 'rope-dart-silver') {
  game.weapons.push({ type, x: game.cat.x, y: game.cat.y });
  game.combat(0, game.cat.x, game.cat.y);
}
function fire(game, target) {
  return game.steer(target.id, target.x + target.w / 2, target.y + target.h / 2);
}
function until(game, predicate, limit = 5) {
  for (let t = 0; t < limit && !predicate(); t += 1 / 120) game.update(1 / 120);
  assert.ok(predicate(), 'expected state reached within bounded simulation');
}
function enemy(game, x, shield = null, type = 'mouse') {
  const robot = game.createCustomSpawn({ kind: 'enemy', type, x: .6, y: .5, ...(shield ? { shield } : {}) })[0];
  robot.x = x; robot.y = game.cat.y;
  game.robots.push(robot);
  game.enemiesSleepUntil = Infinity;
  return robot;
}

test('three Rope Dart variants use the matching weapon colors and 3/5/10 shots without campaign changes', () => {
  assert.deepEqual(Object.keys(WEAPONS).filter(type => WEAPONS[type].ropeDart), types);
  for (const [index, type] of types.entries()) {
    const metal = ['bronze', 'silver', 'gold'][index];
    assert.equal(WEAPONS[type].color, SWORDS[metal].color);
    assert.equal(WEAPONS[type].uses, SWORDS[metal].uses);
    const level = custom([{ time: 0, kind: 'weapon', type, x: .4, y: .5 },
      { time: 1, kind: 'enemy', type: 'mouse', x: .6, y: .5, carriesItem: type }], {
      brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'weapon', type } }],
    });
    assert.deepEqual(validateCustomLevel(level), level);
    assert.equal(JSON.stringify(LEVELS).includes(type), false);
    assert.equal(spawnColor({ kind: 'weapon', type }), SWORDS[metal].color);
    assert.match(spawnSymbol({ kind: 'weapon', type }), /^M0 -27/);
    const game = new Game(() => .5, { customLevel: level });
    game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
    assert.equal(game.weapons[0].type, type);
  }
});

test('stationary launch spends one shot, pierces multiple enemies and holds Koshi until the dart stops', () => {
  for (const options of [{}, { portrait: true, scale: .5 }]) for (const type of types) {
    const { game, target } = arena(options);
    equip(game, type);
    const start = { x: game.cat.x, y: game.cat.y };
    const distance = target.x - start.x;
    enemy(game, start.x + distance * .35);
    enemy(game, start.x + distance * .7);
    assert.equal(fire(game, target), true);
    assert.equal(game.moves, 1);
    assert.equal(game.weapon.uses, WEAPONS[type].uses - 1);
    assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0);
    assert.equal(game.ropeDart.phase, 'flying');
    assert.equal(fire(game, target), false, 'no second launch while deployed');
    until(game, () => game.ropeDart?.phase === 'pulling');
    assert.deepEqual({ x: game.cat.x, y: game.cat.y }, start);
    assert.equal(game.enemies, 2);
    assert.equal(game.weapon.uses, WEAPONS[type].uses - 1, 'enemies do not spend extra shots');
    until(game, () => !game.ropeDart);
    assert.ok(game.cat.x > start.x);
    assert.equal(game.weapon.type, type);
    until(game, () => !game.cat.vx && !game.cat.vy);
    assert.equal(game.hearts, 3);
    game.elapsed = target.readyAt;
    const left = game.bricks.find(brick => brick.x < game.cat.x && brick.x < 30 && game.brickSelectable(brick));
    assert.equal(fire(game, left), true);
    assert.equal(game.ropeDart.phase, 'flying', 'collected dart can fire again');
  }
});

test('moving clicks steer normally without spending shots; Rope Darts never auto-melee', () => {
  const { game, target } = arena();
  equip(game);
  game.cat.vy = 120;
  assert.equal(fire(game, target), true);
  assert.equal(game.ropeDart, null);
  assert.equal(game.weapon.uses, 5);
  assert.ok(game.cat.vx > 0);
  enemy(game, game.cat.x);
  game.enemiesSleepUntil = 0;
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.robots.length, 1);
  assert.equal(game.hearts, 2);
  assert.equal(game.weapon.uses, 5);
});

test('one shot damages each shield once and preserves protected and immune enemies', () => {
  const { game, target } = arena();
  equip(game);
  const start = game.cat.x;
  const shielded = enemy(game, start + 75, 'blue');
  const protectedEnemy = enemy(game, start + 125); protectedEnemy.invulnerableUntil = 10;
  const loveBug = enemy(game, start + 170, null, 'robo-love-bug');
  const boss = enemy(game, start + 220, null, 'boss');
  assert.equal(fire(game, target), true);
  game.updateRopeDart(1, new Map(game.robots.map(robot => [robot, { ...robot }])));
  assert.equal(shielded.shield, 'green');
  assert.ok(game.robots.includes(protectedEnemy));
  assert.ok(game.robots.includes(loveBug));
  assert.ok(game.robots.includes(boss));
  assert.equal(game.weapon.uses, 4);
  game.elapsed = 20;
  game.updateRopeDart(1, new Map());
  assert.equal(shielded.shield, 'green', 'a shot cannot hit the same enemy twice');
});

test('dart collision is swept and stops before enemies beyond bricks, obstructions and bumpers', () => {
  for (const obstacle of ['brick', 'obstruction-circle', 'obstruction-rectangle-vertical', 'obstruction-diamond', 'bumper-green']) {
    const { game, target } = arena();
    equip(game);
    const x = game.cat.x + 120, y = game.cat.y;
    if (obstacle === 'brick') {
      game.bricks.push({ ...target, id: game.bricks.length, x, y: y - 40, w: 20, h: 80 });
    } else {
      const object = game.createCustomSpawn({ kind: 'object', type: obstacle, x: .6, y: .5 })[0];
      object.x = x; object.y = y;
      (obstacle.startsWith('bumper') ? game.bumpers : game.obstructions).push(object);
    }
    const near = enemy(game, game.cat.x + 50), far = enemy(game, x + 80);
    fire(game, target);
    game.updateRopeDart(1, new Map(game.robots.map(robot => [robot, { ...robot }])));
    assert.equal(game.ropeDart.phase, 'pulling');
    assert.ok(game.ropeDart.x < x);
    assert.equal(game.robots.includes(near), false);
    assert.equal(game.robots.includes(far), true);
    until(game, () => !game.ropeDart);
    assert.ok(game.cat.x < x);
  }
});

test('moving enemy crossing the flight path is hit even when its endpoint is outside the dart radius', () => {
  const { game, target } = arena();
  equip(game);
  const robot = enemy(game, game.cat.x + 45);
  const previous = new Map([[robot, { x: robot.x, y: robot.y - 100 }]]);
  robot.y += 100;
  fire(game, target);
  game.updateRopeDart(.1, previous);
  assert.equal(game.robots.length, 0);
});

test('a solid already pushing Koshi does not catch the departing dart, and the pull preview allows departure', () => {
  for (const type of ['obstruction-circle', 'obstruction-diamond', 'obstruction-rectangle-vertical',
    'obstruction-rectangle-horizontal', 'bumper-green']) {
    const { game, target } = arena();
    const object = game.createCustomSpawn({ kind: 'object', type, x: .4, y: .5 })[0];
    const halfWidth = type.includes('rectangle') ? object.width / 2 : object.radius;
    object.x = game.cat.x - halfWidth - game.cat.radius; object.y = game.cat.y;
    (type.startsWith('bumper') ? game.bumpers : game.obstructions).push(object);
    equip(game);
    const startX = game.cat.x, objectX = object.x;
    assert.equal(fire(game, target), true);
    const dart = game.ropeDart;
    assert.ok(dart.launchContacts.has(object));
    // The pushing solid moves over the launch point before the dart's next flight step.
    object.x += game.cat.radius;
    game.updateRopeDart(.04, new Map());
    assert.equal(dart.phase, 'flying');
    assert.equal(dart.x, startX + 36);
    assert.equal(dart.attachment, undefined);
    object.x = objectX;
    game.updateRopeDart(1, new Map());
    assert.equal(dart.launchContacts.has(object), false, 'clearance restores normal collision with the object');
    assert.equal(dart.phase, 'pulling');
    assert.ok(game.trajectory().at(-1)[0] > startX + 100, 'existing contact does not collapse the preview');
    until(game, () => !game.ropeDart);
    assert.ok(game.cat.x > startX + 100, 'Koshi actually pulls away from the existing contact');
    assert.equal(game.weapon.uses, 4);
    assert.equal(game.hearts, 3);
  }
});

test('launch clearance does not ignore new blockers or let Koshi pull through the launch obstruction', () => {
  for (const intoContact of [false, true]) {
    const { game, target } = arena();
    const object = game.createCustomSpawn({ kind: 'object', type: 'obstruction-circle', x: .4, y: .5 })[0];
    const startX = game.cat.x;
    object.x = startX + (intoContact ? 1 : -1) * (object.radius + game.cat.radius);
    object.y = game.cat.y;
    game.obstructions.push(object);
    const blocker = game.createCustomSpawn({ kind: 'object', type: 'obstruction-circle', x: .7, y: .5 })[0];
    blocker.x = startX + 200; blocker.y = game.cat.y;
    game.obstructions.push(blocker);
    equip(game); fire(game, target);
    const dart = game.ropeDart;
    game.updateRopeDart(1, new Map());
    assert.equal(dart.attachment.object, blocker, 'a different solid still catches the dart');
    const points = game.trajectory();
    until(game, () => !game.ropeDart);
    assert.ok(Math.abs(game.cat.x - points.at(-1)[0]) < 1e-6, 'preview matches solid pull clearance');
    if (intoContact) assert.equal(game.cat.x, startX, 'Koshi cannot pass through the touching solid');
    else assert.ok(game.cat.x > startX + 100);
    assert.equal(game.weapon.uses, 4);
  }
});

test('Koshi can rope-dart away while a tracked obstruction pushes him across the launch point', () => {
  for (const type of ['obstruction-circle', 'obstruction-diamond', 'obstruction-rectangle-horizontal']) {
    const { game, target } = arena({ customLevel: custom([
      { kind: 'object', type, time: 0, x: .4, y: .3, track: 'pushing' },
    ], { tracks: [{ id: 'pushing', nodes: [{ x: .4, y: .3 }, { x: .4, y: .7 }],
      speed: 600, closed: false }] }) });
    const object = game.obstructions[0];
    const halfHeight = type.includes('rectangle') ? object.height / 2 : object.radius;
    game.cat.x = object.x; game.cat.y = object.y + halfHeight + game.cat.radius;
    const start = { x: game.cat.x, y: game.cat.y };
    equip(game);
    assert.equal(game.steer(target.id, target.x + target.w / 2, start.y), true);
    const dart = game.ropeDart;
    game.update(.05);
    assert.ok(game.cat.y > start.y + 20, 'the actual tracked solid pushes Koshi during flight');
    assert.equal(dart.phase, 'flying', 'the pushing solid does not catch the dart at its old launch point');
    until(game, () => dart.phase === 'pulling');
    assert.notEqual(dart.attachment?.object, object);
    until(game, () => game.cat.x > start.x + 50);
    assert.equal(game.state, 'playing');
    assert.equal(game.weapon.uses, 4);
  }
});

test('pull trajectories stop at dart contact instead of sliding or forecasting a bumper bounce', () => {
  for (const type of ['obstruction-circle', 'obstruction-diamond', 'obstruction-rectangle-vertical', 'bumper-green']) {
    const { game, target } = arena();
    const object = game.createCustomSpawn({ kind: 'object', type, x: .6, y: .5 })[0];
    object.x = game.cat.x + 170; object.y = game.cat.y + 12;
    (type.startsWith('bumper') ? game.bumpers : game.obstructions).push(object);
    equip(game); fire(game, target);
    assert.deepEqual(game.trajectory(), [], 'Koshi has no movement trajectory during dart flight');
    until(game, () => game.ropeDart.phase === 'pulling');
    const dart = game.ropeDart;
    const position = { x: game.cat.x, y: game.cat.y };
    const points = game.trajectory();
    assert.equal(points.length, 2, 'only the direct pull is shown');
    assert.deepEqual(points[0], [position.x, position.y]);
    assert.ok(points[1][0] < dart.x, 'endpoint stops at Koshi clearance before the dart');
    assert.deepEqual(game.trajectory(), points, 'forecast does not mutate live state');
    until(game, () => !game.ropeDart || game.ropeDart.phase !== 'pulling');
    const tolerance = type.startsWith('bumper') ? .02 : 1e-6;
    assert.ok(Math.hypot(game.cat.x - points[1][0], game.cat.y - points[1][1]) < tolerance,
      'preview endpoint matches actual first contact');
  }
});

test('darts follow the contacted obstruction or bumper as it moves on a track until collection', () => {
  for (const type of ['obstruction-circle', 'obstruction-diamond', 'obstruction-rectangle-vertical', 'bumper-green']) {
    const { game, target } = arena({ customLevel: custom([
      { kind: 'object', type, time: 0, x: .7, y: .5, track: 'moving' },
    ], { tracks: [{ id: 'moving', nodes: [{ x: .7, y: .3 }, { x: .7, y: .7 }],
      speed: 60, closed: false }] }) });
    const object = [...game.obstructions, ...game.bumpers][0];
    game.cat.y = object.y;
    equip(game); fire(game, target);
    until(game, () => game.ropeDart?.phase === 'pulling');
    const dart = game.ropeDart;
    assert.equal(dart.attachment.object, object);
    const offset = { x: dart.x - object.x, y: dart.y - object.y };
    const oldY = object.y;
    for (let tick = 0; tick < 5; tick++) {
      game.update(1 / 120);
      assert.equal(game.ropeDart, dart);
      assert.ok(Math.abs(dart.x - object.x - offset.x) < 1e-6);
      assert.ok(Math.abs(dart.y - object.y - offset.y) < 1e-6);
    }
    assert.notEqual(object.y, oldY);
    const points = game.trajectory();
    const dx = dart.x - game.cat.x, dy = dart.y - game.cat.y;
    const end = points.at(-1);
    assert.ok(Math.abs((end[0] - game.cat.x) * dy - (end[1] - game.cat.y) * dx) < 1e-6,
      'trajectory follows the current moving attachment rather than the original aim');
    game.pause();
    const position = { x: dart.x, y: dart.y };
    game.update(1);
    assert.deepEqual({ x: dart.x, y: dart.y }, position);
    game.resume();
    until(game, () => !game.ropeDart);
    assert.equal(game.weapon.uses, 4);
  }
});

test('a destroyed dart attachment retracts safely instead of retaining a missing object', () => {
  const { game, target } = arena();
  const object = game.createCustomSpawn({ kind: 'object', type: 'obstruction-circle', x: .7, y: .5 })[0];
  object.y = game.cat.y;
  game.obstructions.push(object);
  equip(game); fire(game, target);
  until(game, () => game.ropeDart?.attachment);
  const dart = game.ropeDart;
  game.obstructions = [];
  game.update(1 / 120);
  assert.equal(dart.attachment, undefined);
  assert.equal(dart.phase, 'returning');
  until(game, () => !game.ropeDart);
  assert.equal(game.weapon.uses, 4);
});

test('launch aims at the exact selected point and restart clears the deployed cycle', () => {
  const { game, target } = arena();
  equip(game);
  const x = target.x + 2, y = target.y + target.h / 4;
  const dx = x - game.cat.x, dy = y - game.cat.y, length = Math.hypot(dx, dy);
  assert.equal(game.steer(target.id, x, y), true);
  assert.equal(game.ropeDart.direction.x, dx / length);
  assert.equal(game.ropeDart.direction.y, dy / length);
  game.reset();
  assert.equal(game.ropeDart, null);
  assert.equal(game.weapon, null);
});

test('angled pulls on narrow phone layouts collect the dart and allow another launch', () => {
  for (const fraction of [.1, .75, .9]) for (const uses of [1, 5]) {
    const { game } = arena({ portrait: true, scale: .3 });
    const target = game.bricks[1];
    equip(game);
    game.weapon.uses = uses;
    assert.equal(game.steer(target.id, target.x + target.w * fraction, target.y + target.h * fraction), true);
    until(game, () => !game.ropeDart);
    until(game, () => !game.cat.vx && !game.cat.vy);
    if (uses === 1) {
      assert.equal(game.weapon, null);
      assert.ok(game.weaponDrops.some(drop => drop.expired));
    } else {
      assert.equal(game.weapon.uses, uses - 1);
    }
    const next = game.bricks.find(brick => game.brickSelectable(brick)
      && fire(game, brick));
    assert.ok(next, 'collection restores steering or firing');
    assert.equal(Boolean(game.ropeDart), uses > 1);
  }
});

test('a new blocker reels the distant dart back without remote collection or extra damage', () => {
  const { game, target } = arena();
  equip(game); fire(game, target);
  until(game, () => game.ropeDart.phase === 'pulling');
  const dart = game.ropeDart;
  const obstruction = game.createCustomSpawn({ kind: 'object', type: 'obstruction-circle', x: .6, y: .5 })[0];
  obstruction.x = game.cat.x + 100; obstruction.y = game.cat.y;
  game.obstructions.push(obstruction);
  until(game, () => game.ropeDart?.phase === 'returning');
  assert.equal(game.ropeDart, dart);
  assert.ok(Math.hypot(dart.x - game.cat.x, dart.y - game.cat.y) > game.cat.radius + 8);
  assert.equal(fire(game, target), false);
  const catX = game.cat.x, dartX = dart.x;
  const robot = enemy(game, (catX + dartX) / 2);
  game.pause(); game.update(1);
  assert.equal(dart.x, dartX);
  game.resume();
  game.update(1 / 120);
  assert.ok(dart.x < dartX, 'dart visibly travels back instead of collecting remotely');
  until(game, () => !game.ropeDart);
  assert.equal(game.cat.x, catX, 'Koshi does not pass through the blocker');
  assert.equal(game.cat.vx, 0);
  assert.equal(game.cat.vy, 0);
  assert.equal(game.target, null);
  assert.ok(game.robots.includes(robot), 'retraction does not deal another hit');
  assert.equal(game.weapon.uses, 4);
});

test('final shot completes its pull before fading, and pause freezes flight and pull', () => {
  const { game, target } = arena();
  equip(game, 'rope-dart-bronze');
  game.weapon.uses = 1;
  fire(game, target);
  const dart = game.ropeDart;
  game.pause(); game.update(10);
  assert.equal(dart.x, game.cat.x);
  game.resume();
  until(game, () => dart.phase === 'pulling');
  assert.equal(game.weapon.uses, 0);
  assert.equal(game.weaponDrops.length, 0);
  game.pause();
  const position = game.cat.x;
  game.update(10); assert.equal(game.cat.x, position);
  game.resume();
  until(game, () => !game.ropeDart);
  assert.equal(game.weapon, null);
  assert.equal(game.weaponDrops.at(-1).expired, true);
  assert.equal(game.weaponDrops.at(-1).type, 'rope-dart-bronze');
  game.reset(); assert.equal(game.ropeDart, null);
});

test('Anvil refills shots while deployed and weapon replacement cancels the old dart', () => {
  const { game, target } = arena();
  equip(game);
  fire(game, target);
  game.collectItem({ type: 'anvil' });
  assert.equal(game.weapon.uses, 5);
  until(game, () => !game.ropeDart);
  assert.equal(game.weapon.uses, 5);
  until(game, () => !game.cat.vx && !game.cat.vy);
  const left = game.bricks.find(brick => brick.x < 30 && game.brickSelectable(brick));
  fire(game, left);
  assert.ok(game.ropeDart);
  equip(game, 'silver');
  assert.equal(game.ropeDart, null);
  assert.equal(game.weapon.type, 'silver');
});

test('pull arrival triggers normal spike, spring and slime contacts', () => {
  for (const surface of ['spikes', 'springs', 'slimed']) {
    const { game, target } = arena();
    target[surface] = true;
    if (surface === 'slimed') target.slimeColor = 'green';
    equip(game); fire(game, target);
    until(game, () => !game.ropeDart);
    if (surface === 'spikes') until(game, () => game.hearts === 2);
    if (surface === 'springs') until(game, () => game.cat.vx < 0);
    if (surface === 'slimed') until(game, () => game.stuckUntil > game.elapsed);
    assert.equal(game.weapon.type, 'rope-dart-silver');
  }
});

test('retrieving a dart stops pull momentum at a brick, obstruction or open destination', () => {
  for (const destination of ['brick', 'obstruction-circle', 'open']) {
    const { game, target } = arena();
    if (destination === 'obstruction-circle') {
      const object = game.createCustomSpawn({ kind: 'object', type: destination, x: .6, y: .5 })[0];
      object.x = game.cat.x + 170; object.y = game.cat.y;
      game.obstructions.push(object);
    }
    equip(game); fire(game, target);
    until(game, () => game.ropeDart.phase === 'pulling');
    if (destination === 'open') {
      game.ropeDart.x = game.cat.x + 80;
      game.ropeDart.y = game.cat.y;
    }
    until(game, () => !game.ropeDart);
    assert.equal(game.cat.vx, 0);
    assert.equal(game.cat.vy, 0);
    assert.equal(game.target, null);
    const position = { x: game.cat.x, y: game.cat.y };
    game.update(.25);
    assert.deepEqual({ x: game.cat.x, y: game.cat.y }, position);
    assert.ok(game.bricks.some(brick => game.brickSelectable(brick) && fire(game, brick)));
    assert.ok(game.ropeDart, 'resting Koshi can fire again immediately');
  }
});

test('pull arrival uses portals and bumper bounce normally', () => {
  const { game, target } = arena();
  const partner = game.bricks.find(brick => brick.x < 30 && brick.kind === 'normal');
  target.portal = partner.portal = 'blue';
  equip(game); fire(game, target);
  until(game, () => game.portalArrival === partner.id);
  assert.equal(game.ropeDart, null);
  assert.ok(game.cat.x < game.width / 2);

  const { game: bumperGame, target: bumperTarget } = arena();
  const bumper = bumperGame.createCustomSpawn({ kind: 'object', type: 'bumper-green', x: .6, y: .5 })[0];
  bumper.x = bumperGame.cat.x + 170; bumper.y = bumperGame.cat.y;
  bumperGame.bumpers.push(bumper);
  equip(bumperGame); fire(bumperGame, bumperTarget);
  until(bumperGame, () => !bumperGame.ropeDart);
  assert.ok(bumperGame.cat.vx < 0, 'collection allows the normal bumper rebound in the same tick');
  assert.equal(bumperGame.weapon.uses, 4);
});

test('Rope Dart practice completes a multi-enemy launch and recollection', () => {
  for (const options of [{}, { portrait: true, scale: .5 }]) {
    const tutorial = new Tutorial();
    tutorial.select(LESSONS.findIndex(lesson => lesson.id === 'rope-dart'), options);
    assert.equal(tutorial.observe(), false);
    fire(tutorial, tutorial.target);
    until(tutorial.game, () => tutorial.observe());
    assert.equal(tutorial.game.enemies, 2);
    assert.equal(tutorial.game.weapon.uses, 4);
    assert.equal(tutorial.game.ropeDart, null);
  }
});

test('scrolling arenas retain dormant enemies while the visible dart cycle completes', () => {
  for (const portrait of [false, true]) {
    const game = new Game(() => .5, { portrait, customLevel: custom([], {
      autoscroll: { length: 24, speed: 0, events: [] },
    }) });
    game.start();
    const target = game.bricks.filter(brick => game.brickVisible(brick) && game.brickSelectable(brick))
      .sort((a, b) => Math.hypot(a.x + a.w / 2 - game.cat.x, a.y + a.h / 2 - game.cat.y)
        - Math.hypot(b.x + b.w / 2 - game.cat.x, b.y + b.h / 2 - game.cat.y))[0];
    const robot = enemy(game, (game.cat.x + target.x + target.w / 2) / 2);
    robot.y = (game.cat.y + target.y + target.h / 2) / 2;
    const dormant = enemy(game, portrait ? game.cat.x : game.width - 80);
    if (portrait) dormant.y = game.height - 80;
    equip(game); assert.equal(fire(game, target), true);
    until(game, () => !game.ropeDart);
    assert.equal(game.robots.includes(robot), false);
    assert.ok(game.robots.includes(dormant));
    assert.equal(game.weapon.uses, 4);
  }
});

test('pickup artwork includes grey-white coiled rope; held artwork shows only the wide numbered dart', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ strokeStyle: '', fillStyle: '', lineWidth: 0 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'stroke') return () => operations.push(['stroke', target.strokeStyle, target.lineWidth]);
      return (...args) => operations.push([name, ...args]);
    },
  });
  const context = vm.createContext({ ctx, WEAPONS });
  vm.runInContext(source.slice(source.indexOf('function drawRopeDart('), source.indexOf('function drawAttackPop(')), context);
  for (const type of types) {
    operations.length = 0;
    context.drawRopeDart(0, 0, WEAPONS[type].color, undefined, true);
    assert.ok(operations.some(([name, color]) => name === 'stroke' && color === '#edf0ed'));
    operations.length = 0;
    context.drawWeapon(0, 0, type, String(WEAPONS[type].uses));
    assert.equal(operations.some(([name, color]) => name === 'stroke' && color === '#edf0ed'), false);
    assert.ok(operations.some(([name, label]) => name === 'fillText' && label === String(WEAPONS[type].uses)));
    assert.ok(operations.some(([name, x]) => name === 'lineTo' && x === 11), 'wide dart face');
    operations.length = 0;
    context.drawFlyingRopeDart({ cat: { x: 100, y: 80 }, weapon: { uses: 2 },
      ropeDart: { x: 300, y: 80, direction: { x: 1, y: 0 }, type } });
    assert.ok(operations.some(([name, x, y]) => name === 'lineTo' && x === 300 && y === 80), 'rope joins Koshi to dart');
  }
});
