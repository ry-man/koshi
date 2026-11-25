const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, WIDTH, HEIGHT, OBJECTS, makeBricks, boardDimensions, cameraAt, validateCustomLevel, brickRegions, brickPerimeter, obstructionGeometry, obstructionVertices, obstructionSpikes, CAT_BLOCK_TRIGGERS, catBlockDescription, catBlockObjective } = require('../src/game.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const blank = () => ({ version: 1, id: 'Scrolling test', duration: 60, goal: 0, survive: true, heartCost: null, brickSet: 1, events: [] });
const scrolling = () => ({ ...blank(), autoscroll: { length: 24, speed: .25, events: [{ time: 10, speed: 0 }, { time: 15, speed: .5 }] } });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('roaming key carriers steer toward the screen interior in each scrolling orientation', () => {
  for (const options of [{}, { portrait: true, scale: .5 },
    { portrait: true, customCoordinateOrientation: 'viewport', scale: .5 }]) {
    for (const type of ['mouse', 'robo-fly', 'bucket', 'jackolantern', 'ram', 'robo-moon',
      'robo-sharpshooter', 'robo-cat-lady', 'robo-trash-bin', 'robo-unicorn']) {
      const game = new Game(() => .5, { ...options, customLevel: scrolling() });
      game.start(); game.elapsed = 5;
      const camera = game.camera(), direction = game.landscapePortrait ? -1 : 1;
      const start = game.portrait
        ? { x: camera.x + camera.width / 2, y: direction > 0 ? camera.y + camera.height * .1 : camera.y + camera.height * .9 }
        : { x: camera.x + camera.width * .1, y: camera.y + camera.height / 2 };
      Object.assign(game.cat, { x: camera.x + camera.width / 2, y: camera.y + camera.height / 2 });
      const enemy = game.createCustomEntity({ kind: 'enemy', type, time: 0, carriesItem: 'key' }, start)[0];
      const outward = game.portrait ? (direction > 0 ? -Math.PI / 2 : Math.PI / 2) : Math.PI;
      enemy.phase = outward;
      if (type === 'ram') { enemy.angle = outward; enemy.turnTime = 100; }
      if (type === 'robo-trash-bin') enemy.binWait = 100;
      game.robots.push(enemy);
      for (let i = 0; i < 120; i++) game.combatEnemies(1 / 120, game.cat.x, game.cat.y);
      const progress = game.portrait ? (enemy.y - start.y) * direction : enemy.x - start.x;
      assert.ok(progress > 0, `${type} turns inward in ${JSON.stringify(options)}: ${progress}`);
      assert.ok(game.entityVisible(enemy));
    }
  }
});

test('key carrier screen steering preserves non-scrolling enemies, unseen spawns and forced movement', () => {
  const game = new Game(() => .5, { customLevel: scrolling() });
  game.start();
  const camera = game.camera(), point = { x: camera.x + camera.width * .1, y: camera.y + camera.height / 2 };
  for (const type of ['wheel', 'snake', 'robo-cow', 'goalie', 'striker', 'robo-koshi', 'robo-crab', 'ball', 'robo-love-bug']) {
    const enemy = game.createCustomEntity({ kind: 'enemy', type, time: 0, carriesKey: true }, point)[0];
    Object.assign(enemy, point, { phase: Math.PI, asleep: false, afraid: false });
    assert.equal(game.steerKeyCarrierOnScreen(enemy, 1), false, type);
    assert.equal(enemy.phase, Math.PI);
  }
  const enemy = game.createCustomEntity({ kind: 'enemy', type: 'mouse', time: 0, carriesKey: true }, point)[0];
  enemy.phase = Math.PI;
  const noKey = game.createCustomEntity({ kind: 'enemy', type: 'mouse', time: 0 }, point)[0];
  noKey.phase = Math.PI;
  assert.equal(game.steerKeyCarrierOnScreen(noKey, 1), false);
  assert.equal(noKey.phase, Math.PI);
  for (const state of [{ asleep: true }, { afraid: true }]) {
    Object.assign(enemy, { asleep: false, afraid: false }, state);
    assert.equal(game.steerKeyCarrierOnScreen(enemy, 1), false);
    assert.equal(enemy.phase, Math.PI);
  }
  for (const [type, field, state] of [['ram', 'state', 'charging'], ['robo-moon', 'moonState', 'tide'],
    ['robo-sharpshooter', 'sharpshooterState', 'shoot'], ['robo-cat-lady', 'catLadyState', 'aim'],
    ['robo-trash-bin', 'binState', 'travel'], ['robo-unicorn', 'unicornState', 'charge']]) {
    const special = game.createCustomEntity({ kind: 'enemy', type, time: 0, carriesItem: 'key' }, point)[0];
    Object.assign(special, { phase: Math.PI, asleep: false, afraid: false, [field]: state });
    if (type === 'robo-unicorn') special.angry = false;
    assert.equal(game.steerKeyCarrierOnScreen(special, 1), false, `${type} special action`);
    assert.equal(special.phase, Math.PI);
  }
  Object.assign(enemy, { asleep: false, afraid: false, x: camera.x + camera.width + 100, keyCarrierSeenOnScreen: false });
  assert.equal(game.steerKeyCarrierOnScreen(enemy, 1), false, 'future offscreen spawns are not pulled onto the screen');
  const nonScrolling = new Game(() => .5, { customLevel: blank() });
  assert.equal(nonScrolling.steerKeyCarrierOnScreen(enemy, 1), false);
  assert.equal(enemy.phase, Math.PI);
});

test('key carriers actively follow a moving camera during normal gameplay', () => {
  for (const options of [{}, { portrait: true, scale: .5 },
    { portrait: true, customCoordinateOrientation: 'viewport', scale: .5 }]) {
    const game = new Game(() => .5, { ...options, customLevel: scrolling() });
    game.start(); game.elapsed = 5;
    const camera = game.camera(), direction = game.landscapePortrait ? -1 : 1;
    const point = game.portrait
      ? { x: camera.x + camera.width * .35, y: camera.y + camera.height * (direction > 0 ? .12 : .88) }
      : { x: camera.x + camera.width * .12, y: camera.y + camera.height * .35 };
    Object.assign(game.cat, { x: camera.x + camera.width * .75, y: camera.y + camera.height * .5 });
    const enemy = game.createCustomEntity({ kind: 'enemy', type: 'mouse', time: 0, carriesItem: 'key' }, point)[0];
    enemy.phase = game.portrait ? (direction > 0 ? -Math.PI / 2 : Math.PI / 2) : Math.PI;
    game.robots.push(enemy); game.update(3);
    assert.equal(game.state, 'playing');
    assert.ok(game.robots.includes(enemy));
    assert.ok(game.entityVisible(enemy));
    const progress = game.portrait ? (enemy.y - point.y) * direction : enemy.x - point.x;
    assert.ok(progress > 0, `the carrier moves with the camera: ${progress}`);
  }
});

test('appearing obstructions preserve key drops near the closest clear edge only in scrolling levels', () => {
  const { obstructionSurface } = require('../src/game.js');
  for (const options of [{}, { portrait: true, scale: .5 },
    { portrait: true, customCoordinateOrientation: 'viewport', scale: .5 }]) {
    for (const shape of ['circle', 'diamond', 'rectangle', 'v', 'oval']) {
      const game = new Game(() => .5, { ...options, customLevel: scrolling() });
      game.start();
      const camera = game.camera(), center = { x: camera.x + camera.width / 2, y: camera.y + camera.height / 2 };
      Object.assign(game.cat, { x: camera.x + 100, y: camera.y + 100 });
      const obstruction = game.createObstruction(center, { type: `obstruction-${shape}`, width: 120,
        height: shape === 'circle' ? 120 : 80, rotation: 30 });
      const origin = { x: center.x + 8, y: center.y + 3 };
      const enemy = game.createCustomEntity({ kind: 'enemy', type: 'mouse', time: 0, carriesKey: true }, origin)[0];
      game.robots.push(enemy); game.obstructions.push(obstruction);
      const surface = obstructionSurface(origin.x, origin.y, obstruction);
      game.clearAppearingObstruction(obstruction);
      assert.equal(game.robots.length, 0);
      assert.equal(game.items.length, 1, shape);
      const key = game.items[0], drop = 14.01 - surface.gap;
      const nearest = { x: origin.x + surface.nx * drop, y: origin.y + surface.ny * drop };
      if (game.pickupClear(nearest)) {
        close(key.x, nearest.x);
        close(key.y, nearest.y);
      }
      assert.equal(key.type, 'key');
      assert.ok(game.pickupClear(key), shape);
      game.clearBlockedPickups();
      assert.equal(game.items.length, 1);
    }
  }
  const game = new Game(() => .5, { customLevel: blank() });
  game.start(); Object.assign(game.cat, { x: 100, y: 100 });
  const obstacle = game.createObstruction({ x: 480, y: 300 }, { type: 'obstruction-circle' });
  const enemy = game.createCustomEntity({ kind: 'enemy', type: 'mouse', time: 0, carriesItem: 'key' }, { x: 480, y: 300 })[0];
  game.robots.push(enemy); game.obstructions.push(obstacle); game.clearAppearingObstruction(obstacle);
  assert.equal(game.items.length, 0, 'non-scrolling behavior remains unchanged');
});

test('key drops survive overlapping same-tick obstructions and remain collectible', () => {
  const game = new Game(() => .5, { customLevel: scrolling() });
  game.start();
  const camera = game.camera(), origin = { x: camera.x + camera.width / 2, y: camera.y + camera.height / 2 };
  Object.assign(game.cat, { x: camera.x + 100, y: camera.y + 100 });
  const first = game.createObstruction(origin, { type: 'obstruction-circle', width: 120 });
  const enemy = game.createCustomEntity({ kind: 'enemy', type: 'mouse', time: 0, carriesItem: 'key' }, origin)[0];
  game.obstructions.push(first); game.robots.push(enemy); game.clearAppearingObstruction(first);
  const key = game.items[0];
  const second = game.createObstruction({ x: key.x, y: key.y }, { type: 'obstruction-circle', width: 80 });
  game.obstructions.push(second); game.clearAppearingObstruction(second); game.clearBlockedPickups();
  assert.strictEqual(game.items[0], key);
  assert.ok(game.pickupClear(key));
  Object.assign(game.cat, { x: key.x, y: key.y });
  game.combat(0, key.x, key.y);
  assert.equal(game.keys, 1);
  assert.equal(game.items.length, 0);
});

test('brick-spawned obstructions preserve keys from defeated carriers', () => {
  const game = new Game(() => .5, { customLevel: scrolling() });
  game.start();
  const point = game.campaignEventPoint(.2, .5);
  Object.assign(game.cat, { x: 100, y: 100 });
  const enemy = game.createCustomEntity({ kind: 'enemy', type: 'mouse', time: 0, carriesKey: true }, point)[0];
  game.robots.push(enemy); game.enemiesSleepUntil = Infinity;
  game.spawnFromBrick({ spawner: { kind: 'object', type: 'obstruction-circle', x: .2, y: .5 } });
  game.update(2.01);
  assert.equal(game.robots.length, 0);
  assert.equal(game.items.length, 1);
  assert.equal(game.items[0].type, 'key');
  assert.ok(game.pickupClear(game.items[0]));
});

test('scheduled obstruction arrivals preserve key drops through the rest of the tick', () => {
  const event = { kind: 'object', type: 'obstruction-rectangle', time: 1, x: .2, y: .5, width: 100, height: 100 };
  const game = new Game(() => .5, { customLevel: { ...scrolling(), events: [event] } });
  game.start();
  const point = game.campaignEventPoint(event.x, event.y);
  Object.assign(game.cat, { x: 100, y: 100 });
  game.robots.push(game.createCustomEntity({ kind: 'enemy', type: 'mouse', time: 0, carriesItem: 'key' }, point)[0]);
  game.enemiesSleepUntil = Infinity;
  game.update(1.02);
  assert.equal(game.robots.length, 0);
  assert.equal(game.items.length, 1);
  assert.equal(game.items[0].type, 'key');
  assert.ok(game.pickupClear(game.items[0]));
});

test('screen-crossing events round-trip and reject invalid percentages or incompatible placements', () => {
  const placement = { kind: 'food', type: 'S', x: .5, y: .5, lifetime: 5, spawnPercent: 50 };
  const level = { ...scrolling(), events: [placement] };
  const normalized = validateCustomLevel(level);
  assert.deepEqual(normalized.events[0], { ...placement, time: 0 });
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(normalized))), normalized);
  assert.equal(Object.hasOwn(placement, 'time'), false, 'validation does not mutate authored events');
  for (const spawnPercent of [-1, 101, NaN, Infinity, '50', null]) {
    assert.throws(() => validateCustomLevel({ ...level, events: [{ ...placement, spawnPercent }] }), /percentage/);
  }
  assert.throws(() => validateCustomLevel({ ...blank(), events: [placement] }), /autoscrolling/);
  assert.throws(() => validateCustomLevel({ ...level, events: [{ ...placement, random: true }] }), /fixed center/);
  for (const spawnPercent of [0, 100]) {
    assert.equal(validateCustomLevel({ ...level, events: [{ ...placement, spawnPercent }] }).events[0].spawnPercent, spawnPercent);
  }
});

test('screen crossing measures exact center progress in desktop, phone and legacy portrait coordinates', () => {
  for (const options of [{}, { portrait: true, scale: .5 },
    { portrait: true, customCoordinateOrientation: 'viewport', scale: .5 }]) {
    const placement = { kind: 'food', type: 'S', time: 0, x: .5, y: .5, lifetime: 5 };
    const game = new Game(() => .5, { ...options, customLevel: scrolling() });
    for (const spawnPercent of [0, 25, 50, 100]) {
      const event = { ...placement, spawnPercent };
      const time = game.eventAppearanceTime(event);
      const point = game.campaignEventPoint(event.x, event.y), camera = game.camera(time);
      const crossed = game.landscapePortrait ? (point.y - camera.y) / camera.height
        : game.portrait ? 1 - (point.y - camera.y) / camera.height : 1 - (point.x - camera.x) / camera.width;
      close(crossed * 100, spawnPercent);
      assert.equal(game.eventAppearanceTime(placement), 0);
    }
  }
});

test('screen-crossing times include camera stops, restart deterministically, and preserve authored data', () => {
  const game = new Game(() => .5, { customLevel: scrolling() });
  const pitch = boardDimensions().pitch, b = game.bounds();
  const x = (WIDTH + 3 * pitch - b.left) / (b.right - b.left);
  const placement = { kind: 'food', type: 'S', x, y: .5, spawnPercent: 0, lifetime: 5 };
  const level = { ...scrolling(), events: [placement,
    { kind: 'food', type: 'S', x: .95, y: .2, time: 1, lifetime: 10 }] };
  const original = JSON.stringify(level);
  const runtime = new Game(() => .5, { customLevel: level });
  close(runtime.eventAppearanceTime(placement), 16);
  assert.deepEqual(runtime.customEvents.map(event => event.time), [1, 16]);
  runtime.start();
  runtime.elapsed = 15;
  runtime.prepareSpawns();
  runtime.spawnCustomEvents();
  assert.equal(runtime.food.length, 1, 'legacy timed events still appear offscreen at their original time');
  assert.ok(runtime.spawnCues.some(cue => cue.kind === 'food'));
  runtime.elapsed = 16;
  runtime.spawnCustomEvents();
  const food = runtime.food.find(item => item.born === 16);
  assert.ok(food);
  close(food.expires, 21);
  runtime.spawnCustomEvents();
  assert.equal(runtime.food.length, 2, 'crossing spawns once');
  runtime.reset();
  close(runtime.customEvents[1].time, 16);
  assert.equal(runtime.nextCustom, 0);
  assert.equal(JSON.stringify(level), original);
});

test('already-crossed centers spawn at Start and unreachable centers do not block timed events', () => {
  const level = { ...scrolling(), autoscroll: { length: 24, speed: 0, events: [] }, events: [
    { kind: 'object', type: 'bumper-red', x: .1, y: .2, spawnPercent: 0 },
    { kind: 'object', type: 'bumper-red', x: .8, y: .2, spawnPercent: 50 },
    { kind: 'object', type: 'bumper-red', x: .2, y: .8, time: 2 },
  ] };
  const game = new Game(() => .5, { customLevel: level });
  assert.equal(game.eventAppearanceTime(level.events[0]), 0);
  assert.equal(game.eventAppearanceTime(level.events[1]), Infinity);
  game.start();
  assert.equal(game.bumpers.length, 1);
  game.elapsed = 2; game.prepareSpawns(); game.spawnCustomEvents();
  assert.equal(game.bumpers.length, 2);
  game.elapsed = 1000; game.prepareSpawns(); game.spawnCustomEvents();
  assert.equal(game.bumpers.length, 2);
  const end = new Game(() => .5, { customLevel: { ...level, autoscroll: { length: 24, speed: 10, events: [] } } });
  assert.equal(end.eventAppearanceTime({ ...level.events[1], x: 1, spawnPercent: 100 }), Infinity);
});

test('formations spawn together using their shared center and obstruction warnings use resolved times', () => {
  const event = { kind: 'object', type: 'obstruction-rectangle', x: .5, y: .5,
    spawnPercent: 50, group: { shape: 'line', count: 3, size: .2 } };
  const game = new Game(() => .5, { customLevel: { ...scrolling(), events: [event] } });
  const time = game.eventAppearanceTime(event);
  game.start(); game.elapsed = time - 1;
  game.prepareSpawns();
  assert.equal(game.spawnCues.length, 3);
  game.spawnCues.forEach(cue => close(cue.progress, .5));
  game.elapsed = time - .001; game.spawnCustomEvents();
  assert.equal(game.obstructions.length, 0);
  game.elapsed = time; game.spawnCustomEvents();
  assert.equal(game.obstructions.length, 3);
  const center = game.obstructions.reduce((sum, item) => sum + item.x, 0) / 3;
  close(center, game.camera().x + WIDTH / 2);
});

test('Cat Tracks begin moving at the resolved appearance time in both orientations', () => {
  const placement = { kind: 'object', type: 'bumper-red', x: .5, y: .4, spawnPercent: 50, track: 'rail' };
  const level = { ...scrolling(), events: [placement],
    tracks: [{ id: 'rail', nodes: [{ x: .3, y: .4 }, { x: .7, y: .4 }], speed: 20, closed: false }] };
  for (const portrait of [false, true]) {
    const game = new Game(() => .5, { portrait, customLevel: level });
    const time = game.eventAppearanceTime(placement);
    game.start(); game.elapsed = time; game.prepareSpawns(); game.spawnCustomEvents();
    assert.equal(game.bumpers.length, 1);
    const bumper = game.bumpers[0], initialDistance = bumper.trackDistance;
    close(bumper.trackBorn, time);
    game.elapsed += .5; game.updateCatTracks(.5);
    close(bumper.trackDistance, initialDistance + 10);
    const paused = new Game(() => .5, { portrait, customLevel: {
      ...level, autoscroll: { length: 24, speed: 0, events: [] },
    } });
    const point = paused.trackEventPoint(paused.customEvents[0], 30);
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), 'unreachable track previews stay at their initial center');
  }
});

test('autoscroll round-trips, sorts independent speed events, and rejects invalid schedules', () => {
  const source = scrolling();
  source.autoscroll.events.reverse();
  const normalized = validateCustomLevel(source);
  assert.deepEqual(normalized, scrolling());
  normalized.autoscroll.events[0].speed = 2;
  assert.equal(source.autoscroll.events[1].speed, 0);
  assert.equal(validateCustomLevel(blank()).autoscroll, undefined);
  for (const scroll of [
    null, true, [], { length: 7, speed: .25, events: [] },
    { length: 8.5, speed: .25, events: [] }, { length: 1001, speed: 0, events: [] },
    { length: 16, speed: -1, events: [] }, { length: 16, speed: Infinity, events: [] },
    { length: 16, speed: 0 }, { length: 16, speed: 0, events: [null] },
    { length: 16, speed: 0, events: [{ time: 60, speed: 1 }] },
    { length: 16, speed: 0, events: [{ time: 10, speed: -1 }] },
    { length: 16, speed: 0, events: [{ time: 10, speed: 1 }, { time: 10, speed: 0 }] },
  ]) assert.throws(() => validateCustomLevel({ ...blank(), autoscroll: scroll }), TypeError);
  assert.ok(LEVELS.filter(level => !['4', '5'].includes(level.worldId)).every(level => level.autoscroll === undefined));
});

test('long boards add bricks without scaling their geometry, including phone thickness', () => {
  for (const portrait of [false, true]) for (const scale of [1, .5]) {
    const base = makeBricks(portrait, scale), extended = makeBricks(portrait, scale, 24);
    assert.equal(extended.length, 58);
    const dimensions = boardDimensions(portrait, scale, 24);
    const regions = brickRegions(extended, dimensions.width, dimensions.height);
    const counts = { top: 0, bottom: 0, left: 0, right: 0 };
    for (const brick of extended) {
      counts[regions.get(brick.id).edge]++;
      assert.ok(brick.x >= 0 && brick.y >= 0);
      assert.ok(brick.x + brick.w <= dimensions.width && brick.y + brick.h <= dimensions.height);
      const original = base[brick.id < 10 ? brick.id : 10];
      close(brick.w, original.w); close(brick.h, original.h);
    }
    assert.deepEqual(counts, portrait ? { top: 5, bottom: 5, left: 24, right: 24 } : { top: 24, bottom: 24, left: 5, right: 5 });
  }
  assert.deepEqual(makeBricks(false, 1, 8), makeBricks());
  assert.equal(boardDimensions().width, WIDTH);
  assert.equal(boardDimensions().height, HEIGHT);
});

test('camera integrates exact speed boundaries, pauses, resumes, and stops permanently at the far end', () => {
  const scroll = scrolling().autoscroll;
  for (const portrait of [false, true]) {
    const { pitch, width, height } = boardDimensions(portrait, 1, scroll.length);
    const offset = time => cameraAt(scroll, time, portrait)[portrait ? 'y' : 'x'];
    close(offset(0), 0);
    close(offset(10), 2.5 * pitch);
    close(offset(12), offset(10));
    close(offset(15), offset(10));
    close(offset(17), 3.5 * pitch);
    close(offset(1000), portrait ? height - WIDTH : width - WIDTH);
    assert.equal(cameraAt(scroll, 1000, portrait).speed, 0);
    assert.equal(cameraAt(scroll, 12, portrait).speed, 0);
    close(offset(3), .75 * pitch);
  }
  assert.equal(cameraAt({ length: 8, speed: 1, events: [] }, 30).x, 0);
  assert.equal(cameraAt({ length: 24, speed: 0, events: [] }, 30).x, 0);
  close(cameraAt({ length: 24, speed: 1, events: [{ time: 0, speed: .5 }] }, 2).x, boardDimensions().pitch);
});

test('game camera freezes with game time, resets to the first screen, and offscreen events still spawn', () => {
  const level = scrolling();
  level.events = [{ kind: 'food', type: 'S', time: 1, x: .95, y: .5, lifetime: 30 }];
  const game = new Game(() => .5, { customLevel: level });
  assert.deepEqual(game.cat, { x: WIDTH / 2, y: HEIGHT / 2, radius: 21, vx: 0, vy: 0 });
  game.update(1);
  assert.equal(game.camera().x, 0);
  game.start();
  for (let i = 0; i < 120; i++) game.update(1 / 120);
  assert.equal(game.food.length, 1);
  assert.ok(game.food[0].x > game.camera().x + WIDTH);
  const camera = game.camera();
  game.pause(); game.update(1);
  assert.deepEqual(game.camera(), camera);
  game.resume(); game.update(.1);
  assert.ok(game.camera().x > camera.x);
  game.state = 'won';
  const endingCamera = game.camera();
  game.update(1); assert.deepEqual(game.camera(), endingCamera);
  game.reset(); assert.equal(game.camera().x, 0);
});

test('only visible brick targets can be activated, including merged parts', () => {
  const game = new Game(() => .5, { customLevel: scrolling() });
  game.start();
  const far = game.bricks.find(brick => brick.x > WIDTH);
  assert.equal(game.brickVisible(far), false);
  assert.equal(game.steer(far.id, far.x + far.w / 2, far.y + far.h / 2), false);
  assert.equal(game.moves, 0);
  const near = game.bricks.find(brick => brick.x + brick.w / 2 < WIDTH && brick.kind === 'normal');
  assert.equal(game.brickVisible(near), true);
  assert.equal(game.steer(near.id, near.x + near.w / 2, near.y + near.h / 2), true);
  far.absorbedBy = near.id;
  assert.equal(game.brickVisible(near), true);
  assert.equal(game.steer(near.id, far.x + far.w / 2, far.y + far.h / 2), false);
});

test('long-board combined brick IDs beyond a traditional board validate in both layouts', () => {
  const level = scrolling();
  level.brickGroups = [{ owner: 48, members: [48, 50, 52] }];
  const valid = validateCustomLevel(level);
  for (const portrait of [false, true]) {
    const game = new Game(() => .5, { customLevel: valid, portrait });
    assert.equal(game.bricks[50].absorbedBy, 48);
    assert.equal(game.bricks[52].absorbedBy, 48);
  }
});

test('browser pointer coordinates add the camera offset without shrinking the viewport', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const game = new Game(() => .5, { customLevel: scrolling() });
  game.elapsed = 20;
  const context = vm.createContext({ game, board: { clientLeft: 1, clientTop: 1, clientWidth: 480, clientHeight: 300,
    getBoundingClientRect: () => ({ left: 100, top: 200 }) } });
  vm.runInContext(source.slice(source.indexOf('function boardPoint('), source.indexOf('function makeBrickButtons(')), context);
  const point = context.boardPoint({ clientX: 341, clientY: 351 });
  close(point.x, game.camera().x + WIDTH / 2);
  close(point.y, HEIGHT / 2);
});

test('touch near misses select the nearest visible brick in scrolling and non-scrolling levels', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const handlers = {}, calls = [];
  const bricks = [{ id: 0, kind: 'normal' }, { id: 1, kind: 'normal' }, { id: 2, kind: 'cinder' }];
  const parts = [
    { id: 0, x: 110, y: 210, w: 10, h: 10 },
    { id: 0, x: 120, y: 210, w: 10, h: 10 },
    { id: 1, x: 140, y: 210, w: 10, h: 10 },
    { id: 2, x: 160, y: 210, w: 10, h: 10 },
    { id: 1, x: 301, y: 210, w: 10, h: 10 },
  ];
  const game = {
    state: 'playing', level: { autoscroll: {} }, bricks, activeTurret: null,
    camera: () => ({ x: 100, y: 200, width: 200, height: 100 }),
    brickParts: () => parts,
    steer: (...args) => { calls.push(args); return true; },
    fireTurretAt: (...args) => { calls.push(['turret', ...args]); return true; },
  };
  const board = {
    clientLeft: 0, clientTop: 0, clientWidth: 400, clientHeight: 200,
    getBoundingClientRect: () => ({ left: 30, top: 40 }),
    addEventListener: (type, handler) => { handlers[`board:${type}`] = handler; },
  };
  const document = { addEventListener: (type, handler) => { handlers[`document:${type}`] = handler; } };
  const context = vm.createContext({ game, board, document, tutorial: null, toast: {}, toastUntil: 0,
    performance: { now: () => 0 }, syncUI() { calls.push(['sync']); } });
  vm.runInContext(source.slice(source.indexOf('function boardPoint('), source.indexOf('function makeBrickButtons(')), context);
  vm.runInContext(source.slice(source.indexOf("let boardPointerType ="), source.indexOf('\nfunction syncBrickDestructions(')), context);
  const tap = (x, y, options = {}) => {
    handlers['document:pointerdown']({ pointerType: options.downType ?? 'touch' });
    const event = {
      clientX: 30 + (x - 100) * 2, clientY: 40 + (y - 200) * 2, detail: options.detail ?? 1,
      pointerType: options.pointerType,
      target: { closest: () => options.onBrick ?? null },
      preventDefault() {}, stopImmediatePropagation() {},
    };
    handlers['board:click'](event);
  };

  tap(125, 224); // Eight CSS pixels from the second member of a merged brick.
  assert.deepEqual(calls.pop(), [0, 125, 220]);
  tap(136, 215);
  assert.deepEqual(calls.pop(), [1, 140, 215]);
  tap(125, 225);
  assert.deepEqual(calls.pop(), [0, 125, 220], 'ten CSS pixels is included');
  tap(125, 230);
  assert.deepEqual(calls.pop(), [0, 125, 220], 'twenty CSS pixels is included');
  tap(125, 235);
  assert.deepEqual(calls.pop(), [0, 125, 220], 'thirty CSS pixels is included');
  tap(125, 235.5);
  tap(165, 224); // An unselectable brick must not redirect to another brick.
  tap(300, 215); // A completely offscreen part must not be selected.
  tap(125, 224, { downType: 'mouse' });
  tap(125, 224, { detail: 0 });
  tap(125, 224, { onBrick: {} });
  assert.equal(calls.length, 0);

  parts.splice(0, parts.length, { id: 0, x: 110, y: 210, w: 20, h: 10 });
  for (const [x, y, expectedX, expectedY] of [
    [120, 195, 120, 210], [120, 235, 120, 220], [95, 215, 110, 215], [145, 215, 130, 215],
    [100, 200, 110, 210],
  ]) {
    tap(x, y);
    assert.deepEqual(calls.pop(), [0, expectedX, expectedY], 'the thirty-pixel target expands equally in every direction');
  }
  tap(95, 195);
  assert.equal(calls.length, 0, 'the rounded corner excludes points beyond the thirty-pixel radius');

  parts.splice(0, parts.length,
    { id: 0, x: 110, y: 210, w: 10, h: 10 },
    { id: 0, x: 120, y: 210, w: 10, h: 10 },
    { id: 1, x: 140, y: 210, w: 10, h: 10 },
    { id: 2, x: 160, y: 210, w: 10, h: 10 },
    { id: 1, x: 301, y: 210, w: 10, h: 10 });

  parts.push({ id: 0, x: 295, y: 210, w: 10, h: 10 });
  tap(299, 224);
  assert.deepEqual(calls.pop(), [0, 299, 220], 'partly visible members use their visible portion');
  handlers['document:pointerdown']({ pointerType: 'touch' });
  handlers['document:pointercancel']();
  handlers['board:click']({ clientX: 80, clientY: 88, detail: 1, target: { closest: () => null } });
  assert.equal(calls.length, 0, 'cancelled touches do not enable the margin');

  game.level.autoscroll = null;
  tap(125, 224);
  assert.deepEqual(calls.pop(), [0, 125, 220], 'non-scrolling levels use the same touch margin');
  game.level.autoscroll = {};
  game.state = 'paused';
  tap(125, 224);
  assert.equal(calls.length, 0);

  game.state = 'playing';
  game.activeTurret = {};
  tap(125, 224);
  assert.deepEqual(calls, [['turret', 125, 224], ['sync']]);
});

test('near-miss touch steering works with real scrolling and stationary games in both orientations', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  for (const customLevel of [blank(), scrolling()]) {
    for (const portrait of [false, true]) {
      const game = new Game(() => .5, { customLevel, portrait, scale: portrait ? .5 : 1 });
      game.start();
      const camera = game.camera(), handlers = {};
      const board = {
        clientLeft: 0, clientTop: 0,
        clientWidth: portrait ? 390 : 624, clientHeight: portrait ? 624 : 390,
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
        addEventListener: (type, handler) => { handlers[`board:${type}`] = handler; },
      };
      const document = { addEventListener: (type, handler) => { handlers[`document:${type}`] = handler; } };
      const context = vm.createContext({ game, board, document, tutorial: null, toast: {}, toastUntil: 0,
        performance: { now: () => 0 }, brickEnabled: () => true });
      vm.runInContext(source.slice(source.indexOf('function boardPoint('), source.indexOf('function makeBrickButtons(')), context);
      vm.runInContext(source.slice(source.indexOf('let boardPointerType ='), source.indexOf('\nfunction syncBrickDestructions(')), context);
      const part = game.brickParts().find(part => game.bricks[part.id].kind === 'normal'
        && part.x >= camera.x && part.x + part.w <= camera.x + camera.width
        && part.y >= camera.y && part.y + part.h <= camera.y + camera.height);
      assert.ok(part);
      let x = part.x + part.w / 2, y = part.y + part.h / 2;
      if (part.w < part.h) {
        x = game.cat.x > x ? part.x + part.w + 5 * camera.width / board.clientWidth
          : part.x - 5 * camera.width / board.clientWidth;
      } else {
        y = game.cat.y > y ? part.y + part.h + 5 * camera.height / board.clientHeight
          : part.y - 5 * camera.height / board.clientHeight;
      }
      handlers['document:pointerdown']({ pointerType: 'touch' });
      handlers['board:click']({
        clientX: (x - camera.x) / camera.width * board.clientWidth,
        clientY: (y - camera.y) / camera.height * board.clientHeight,
        detail: 1, target: { closest: () => null }, preventDefault() {}, stopImmediatePropagation() {},
      });
      assert.equal(game.target.x >= part.x && game.target.x <= part.x + part.w, true);
      assert.equal(game.target.y >= part.y && game.target.y <= part.y + part.h, true);
      game.update(.001);
      assert.equal(game.moves, 1, `${customLevel.autoscroll ? 'scrolling' : 'stationary'}, portrait=${portrait}`);
    }
  }
});

test('both canvas layers and brick controls use the same full-scale camera transform', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  for (const portrait of [false, true]) {
    const game = new Game(() => .5, { customLevel: scrolling(), portrait });
    game.elapsed = 20;
    const transforms = [], clears = [];
    const makeContext = () => new Proxy({}, { get(target, name) {
      if (name in target) return target[name];
      if (name === 'setTransform') return (...values) => transforms.push(values);
      if (name === 'clearRect') return (...values) => clears.push(values);
      return () => {};
    } });
    const bricks = { style: {} }, parts = game.brickParts();
    const buttons = game.bricks.map(brick => ({ brick, button: {}, members: parts.filter(part => part.id === brick.id) }));
    const context = vm.createContext({
      game, boardCtx: makeContext(), actorCtx: makeContext(), ctx: null, trail: [], ending: null, buttons,
      canvas: { width: game.viewportWidth / 2, height: game.viewportHeight / 2 },
      board: { clientWidth: game.viewportWidth / 2, clientHeight: game.viewportHeight / 2 },
      document: { querySelector: () => bricks },
      drawCat() {}, drawWornCape() {}, drawMusicStream() {}, drawSunglassesStream() {}, drawCapeStream() {}, drawMaskStream() {}, line() {},
    });
    vm.runInContext(source.slice(source.indexOf('function powerupStreamRows('), source.indexOf('\nfunction drawSpawnCue')), context);
    context.render(0);
    const camera = game.camera();
    assert.deepEqual(transforms, [
      [.5, 0, 0, .5, -camera.x / 2, -camera.y / 2],
      [.5, 0, 0, .5, -camera.x / 2, -camera.y / 2],
    ]);
    assert.deepEqual(clears, [
      [camera.x, camera.y, camera.width, camera.height],
      [camera.x, camera.y, camera.width, camera.height],
    ]);
    assert.equal(bricks.style.width, `${game.width / camera.width * 100}%`);
    assert.equal(bricks.style.height, `${game.height / camera.height * 100}%`);
    assert.ok(buttons.some(item => item.button.inert));
    assert.ok(buttons.some(item => !item.button.inert));
    for (const item of buttons) assert.equal(item.button.inert, !game.brickVisible(item.brick));
  }
});

test('editor camera timeline adds, edits, sorts and removes changes, restoring invalid inputs', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const node = () => ({ children: [], listeners: {}, value: '',
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(type, handler) { this.listeners[type] = handler; },
  });
  const nodes = new Map(), messages = [];
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, node());
    return nodes.get(selector);
  };
  let locked = false;
  const level = scrolling(), previewGame = new Game(() => .5, { customLevel: level });
  const context = vm.createContext({
    $, level, previewGame, readOnly: () => locked, document: { createElement: node },
    validateDraft: validateCustomLevel, markChanged() {}, render() {}, message: text => messages.push(text),
    attempt(action, onError) { try { action(); } catch (error) { messages.push(error.message); if (onError) onError(); } },
  });
  vm.runInContext(source.slice(source.indexOf('function updateAutoscrollSettings('), source.indexOf('function updateWinCondition(')), context);
  context.renderCameraTimeline();
  assert.equal($('#camera-events').children.length, 2);
  $('#timeline').value = 5;
  $('#add-camera-event').listeners.click();
  assert.deepEqual(Array.from(context.level.autoscroll.events, event => event.time), [5, 10, 15]);
  let row = $('#camera-events').children[0];
  let speed = row.children[1].children[0];
  speed.value = '0'; speed.listeners.change();
  assert.equal(context.level.autoscroll.events[0].speed, 0);
  row = $('#camera-events').children[0];
  const time = row.children[0].children[0];
  time.value = '15'; time.listeners.change();
  assert.equal(time.value, 5);
  assert.match(messages.at(-1), /distinct/);
  speed = row.children[1].children[0];
  speed.value = ''; speed.listeners.change();
  assert.equal(speed.value, 0);
  assert.match(messages.at(-1), /speed/i);
  row.children[2].listeners.click();
  assert.deepEqual(Array.from(context.level.autoscroll.events, event => event.time), [10, 15]);
  locked = true;
  const before = JSON.stringify(context.level);
  $('#add-camera-event').listeners.click();
  assert.equal(JSON.stringify(context.level), before);
  context.renderCameraTimeline();
  assert.equal($('#camera-access').disabled, true);
});

function settingsEditor(level = blank()) {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', dataset: {}, listeners: {}, replaceChildren() {}, checkValidity: () => true,
      addEventListener(type, handler) { this.listeners[type] = handler; } });
    return nodes.get(selector);
  };
  const context = vm.createContext({ $, level, readOnly: () => false, Game, OBJECTS, makeBricks, boardDimensions, brickPerimeter,
    obstructionGeometry, obstructionVertices, obstructionSpikes,
    previewGame: new Game(() => .5, { customLevel: level, editorPreview: true }),
    selectedBricks: new Set(), connectingSpawn: null,
    immutableBrick: kind => ['cinder', 'goal'].includes(kind),
    CAT_BLOCK_TRIGGERS, catBlockDescription, catBlockObjective, validateDraft: validateCustomLevel,
    attempt(action, onError) { try { action(); } catch (error) { if (onError) onError(error); throw error; } }, markChanged() {},
    render() { context.previewGame = new Game(() => .5, { customLevel: context.level, editorPreview: true }); },
    message() {} });
  vm.runInContext(source.slice(source.indexOf('function brickEntry('), source.indexOf('function saveBrick(')), context);
  vm.runInContext(source.slice(source.indexOf("$('#settings-form').addEventListener"), source.indexOf('function addSceneLine(')), context);
  context.populateSettings();
  return { context, $, apply: () => $('#settings-form').listeners.submit({ preventDefault() {} }) };
}

test('editor settings toggle autoscroll and enforce minimum length', () => {
  const { context, $, apply } = settingsEditor();
  assert.equal($('#autoscroll-settings').disabled, true);
  $('#autoscroll-enabled').checked = true;
  $('#autoscroll-enabled').listeners.change();
  assert.equal($('#autoscroll-settings').disabled, false);
  $('#scroll-length').value = 7;
  assert.throws(apply, /length/i);
  assert.equal(context.level.autoscroll, undefined);
  $('#scroll-length').value = 24; $('#scroll-speed').value = 0;
  apply();
  assert.equal(context.level.autoscroll.length, 24);
  assert.equal(context.level.autoscroll.speed, 0);
  $('#scroll-length').value = 8;
  apply();
  assert.equal(new Game(() => .5, { customLevel: context.level }).width, WIDTH);
  $('#autoscroll-enabled').checked = false;
  apply();
  assert.equal(context.level.autoscroll, undefined);
});

test('resizing keeps fixed elements and bricks in place and adds plain bricks at the far end', () => {
  const bricks = makeBricks(false, 1, 16);
  const source = { ...blank(), autoscroll: { length: 16, speed: .5, events: [] },
    events: [
      { kind: 'item', type: 'battery', time: 0, x: .2, y: .5 },
      { kind: 'object', type: 'obstruction-rectangle', time: 0, x: .3, y: .4, width: 90, height: 40, rotation: 30 },
      { kind: 'enemy', type: 'wheel', time: 0, x: 1, y: .5 },
      { kind: 'item', type: 'battery', time: 0, random: true },
      { kind: 'food', type: 'P', time: 0, x: .02, y: .5, lifetime: 10, group: { shape: 'line', count: 4 } },
    ],
    koshiStart: { x: .3, y: .5 },
    tracks: [{ id: 'rail', closed: false, speed: 10, nodes: [{ x: .2, y: .2 }, { x: .4, y: .4 }] }],
    terrains: [{ id: 'ice', type: 'ice', nodes: [{ x: .2, y: .2 }, { x: .3, y: .2 }, { x: .25, y: .3 }] }],
    brickGroups: [{ owner: 32, members: [30, 32] }, { owner: 6, members: [6, 8] }],
    brickTypes: [
      ...[30, 32].map(id => ({ ...bricks[id].region, kind: 'slow', barrier: true })),
      { ...bricks[34].region, kind: 'fast', spawner: { kind: 'item', type: 'battery', x: .35, y: .5 } },
    ] };
  const { context, $, apply } = settingsEditor(source);
  const before = context.previewGame;
  $('#scroll-length').value = 24;
  context.selectedBricks.add('old selection');
  context.connectingSpawn = 'old selection';
  apply();
  const after = context.previewGame;
  for (const index of [0, 1, 4]) {
    const oldPoints = before.customEventPoints(source.events[index]);
    const newPoints = after.customEventPoints(context.level.events[index]);
    oldPoints.forEach((point, i) => { close(newPoints[i].x, point.x); close(newPoints[i].y, point.y); });
  }
  assert.ok(context.level.events[4].group.size < 1, 'a previously compressed formation does not expand');
  assert.equal(context.level.events[2].x, 1);
  close(after.customEventPoints(context.level.events[2])[0].x - before.customEventPoints(source.events[2])[0].x, after.width - before.width);
  assert.equal(context.level.events[3].random, true);
  for (const [oldPoint, newPoint] of [
    [source.koshiStart, context.level.koshiStart],
    [source.tracks[0].nodes[1], context.level.tracks[0].nodes[1]],
    [source.terrains[0].nodes[1], context.level.terrains[0].nodes[1]],
    [source.brickTypes[2].spawner, after.bricks[50].spawner],
  ]) close(before.campaignEventPoint(oldPoint.x, oldPoint.y).x, after.campaignEventPoint(newPoint.x, newPoint.y).x);
  assert.deepEqual(Array.from(context.level.brickGroups[0].members), [46, 48]);
  assert.deepEqual(Array.from(context.level.brickGroups[1].members), [6, 8]);
  assert.equal(after.bricks[48].barrier, true);
  for (const brick of before.bricks) {
    const id = brick.id < 10 ? brick.id : brick.id + 16;
    assert.equal(after.bricks[id].kind, brick.kind);
    if (brick.id >= 10) close(after.bricks[id].x, brick.x);
  }
  for (let id = 10; id < 26; id++) assert.equal(after.bricks[id].kind, 'normal');
  assert.equal(context.selectedBricks.size, 0);
  assert.equal(context.connectingSpawn, null);
  assert.doesNotThrow(() => validateCustomLevel(context.level));
  const portraitBefore = new Game(() => .5, { customLevel: source, portrait: true, scale: .5 });
  const portraitAfter = new Game(() => .5, { customLevel: context.level, portrait: true, scale: .5 });
  const oldPoint = portraitBefore.campaignEventPoint(source.events[0].x, source.events[0].y);
  const newPoint = portraitAfter.campaignEventPoint(context.level.events[0].x, context.level.events[0].y);
  close(oldPoint.x, newPoint.x);
  close(portraitBefore.height - oldPoint.y, portraitAfter.height - newPoint.y);
  $('#scroll-length').value = 16;
  apply();
  close(context.previewGame.campaignEventPoint(context.level.events[0].x, .5).x, before.campaignEventPoint(source.events[0].x, .5).x);
  assert.deepEqual(Array.from(context.level.brickGroups[0].members), [30, 32]);
});

test('shortening blocks objects, terrain, tracks, spawners and combined bricks without changing the draft', () => {
  const base = { ...blank(), autoscroll: { length: 24, speed: 0, events: [] } }, bricks = makeBricks(false, 1, 24);
  for (const extra of [
    { events: [{ kind: 'item', type: 'battery', time: 0, x: .8, y: .5 }] },
    { events: [{ kind: 'object', type: 'obstruction-rectangle', time: 0, x: .31, y: .5, width: 500, height: 20 }] },
    { koshiStart: { x: .8, y: .5 } },
    { tracks: [{ id: 'rail', closed: false, speed: 0, nodes: [{ x: .1, y: .1 }, { x: .8, y: .2 }] }] },
    { terrains: [{ id: 'ice', type: 'ice', nodes: [{ x: .1, y: .1 }, { x: .8, y: .1 }, { x: .2, y: .3 }] }] },
    { brickTypes: [{ ...bricks[10].region, kind: 'normal', spawner: { kind: 'item', type: 'battery' } }] },
    { brickTypes: [{ ...bricks[50].region, kind: 'normal', spawner: { kind: 'item', type: 'battery', x: .8, y: .5 } }] },
    { brickGroups: [{ owner: 10, members: [10, 12] }] },
  ]) {
    const { context, $, apply } = settingsEditor({ ...base, ...extra });
    const before = JSON.stringify(context.level);
    $('#scroll-length').value = 8;
    assert.throws(apply, /Board resize blocked/);
    assert.equal(JSON.stringify(context.level), before);
    assert.equal($('#scroll-length').value, 24);
    assert.equal($('#editor-message').dataset.resizeWarning, 'true');
  }
});

test('resizing preserves three-brick-set defaults and leaves all added bricks plain', () => {
  const { context, $, apply } = settingsEditor({ ...blank(), brickSet: 3 });
  const before = context.previewGame;
  $('#autoscroll-enabled').checked = true;
  $('#scroll-length').value = 16;
  apply();
  for (const brick of before.bricks) {
    const id = brick.id < 10 ? brick.id : brick.id + 16;
    assert.equal(context.previewGame.bricks[id].kind, brick.kind);
  }
  for (let id = 10; id < 26; id++) assert.equal(context.previewGame.bricks[id].kind, 'normal');
});

test('resizing blocks a combined brick spanning the moving wall and stationary edge', () => {
  const bricks = makeBricks(), dimensions = boardDimensions();
  const perimeter = brickPerimeter(bricks, dimensions.width, dimensions.height);
  const corner = perimeter.findIndex((id, i) => id < 10 && id % 2 === 0 && perimeter[(i + 1) % perimeter.length] >= 10);
  const members = [perimeter[corner], perimeter[(corner + 1) % perimeter.length]];
  const { context, $, apply } = settingsEditor({ ...blank(), brickGroups: [{ owner: members[0], members }] });
  $('#autoscroll-enabled').checked = true;
  $('#scroll-length').value = 16;
  assert.throws(apply, /combined brick would be separated/);
  assert.equal(context.level.autoscroll, undefined);
});

test('scrolling kills only once Koshi is completely offscreen in any direction, bypassing all protection', () => {
  for (const portrait of [false, true]) for (const side of ['left', 'right', 'top', 'bottom']) {
    const game = new Game(() => .5, { customLevel: scrolling(), portrait });
    game.start(); game.elapsed = 20;
    const camera = game.camera(), cat = game.cat, radius = cat.radius;
    cat.x = camera.x + camera.width / 2; cat.y = camera.y + camera.height / 2;
    const axis = ['left', 'right'].includes(side) ? 'x' : 'y';
    const edge = side === 'left' ? camera.x : side === 'right' ? camera.x + camera.width
      : side === 'top' ? camera.y : camera.y + camera.height;
    const sign = ['left', 'top'].includes(side) ? -1 : 1;
    cat[axis] = edge + sign * (radius - .01);
    assert.equal(game.checkOffscreenDeath(), false, 'even a sliver of Koshi still on screen is alive');
    game.invulnerableUntil = Infinity; game.sunglassesUntil = Infinity; game.maskUntil = Infinity;
    game.capeUntil = Infinity;
    cat[axis] = edge + sign * radius;
    cat.vx = 100; cat.vy = 100; game.target = { x: 10, y: 10 };
    assert.equal(game.checkOffscreenDeath(), true);
    assert.equal(game.state, 'lost'); assert.equal(game.hearts, 0);
    assert.equal(game.offscreenDeath, true); assert.equal(game.tookDamage, true);
    assert.equal(cat.vx, 0); assert.equal(cat.vy, 0); assert.equal(game.target, null);
    const frozen = game.camera();
    game.update(1); assert.deepEqual(game.camera(), frozen);
    game.reset(); assert.equal(game.offscreenDeath, false);
  }
});

test('camera motion and Koshi movement trigger offscreen death during gameplay, even during a camera stop', () => {
  const level = { ...blank(), duration: 100, survive: true, goal: 0,
    autoscroll: { length: 24, speed: 1, events: [] } };
  const game = new Game(() => .5, { customLevel: level });
  game.start();
  game.update(10);
  assert.equal(game.state, 'lost');
  assert.equal(game.offscreenDeath, true);
  assert.ok(game.cat.x + game.cat.radius <= game.camera().x);
  assert.ok(game.elapsed < 10, 'camera crossing interrupts the update immediately');
  const stopped = new Game(() => .5, { customLevel: { ...level, autoscroll: { ...level.autoscroll, speed: 0 } } });
  stopped.start(); stopped.cat.x = stopped.viewportWidth - stopped.cat.radius;
  stopped.cat.vx = 600; stopped.cat.vy = 0;
  stopped.update(.1);
  assert.equal(stopped.state, 'lost');
  assert.equal(stopped.offscreenDeath, true);
  const traditional = new Game(() => .5, { customLevel: blank() });
  traditional.start(); traditional.cat.x = -100;
  assert.equal(traditional.checkOffscreenDeath(), false, 'traditional levels keep their existing board-boundary rule');
});
