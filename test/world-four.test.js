const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, FOODS, ITEMS, CONTACT_SURFACES, validateCustomLevel, portalPairIssues, levelObjective } = require('../src/game.js');
const { WORLDS, worldLevels, nextLevelIndex, levelFeatures } = require('../src/worlds.js');
const { SaveSlots } = require('../src/saves.js');

const world = WORLDS.find(world => world.id === '4');
const level = LEVELS.find(level => level.number === '4-1');
const index = LEVELS.indexOf(level);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('Rolling Road appends 4-1 with a stable new identity and connects only from World 3', () => {
  assert.deepEqual(worldLevels(world), [level]);
  assert.equal(world.name, 'Rolling Road');
  assert.equal(world.special, false);
  assert.deepEqual(WORLDS.find(entry => entry.id === '3').next, ['4']);
  assert.deepEqual(WORLDS.find(entry => entry.id === '3S').next, []);
  assert.deepEqual(world.next, []);
  assert.equal(index, 61);
  assert.equal(level.id, '1-61');
  assert.equal(level.name, 'The rolling buffet');
  assert.equal(nextLevelIndex(48), index);
  assert.equal(nextLevelIndex(60), -1);
  assert.equal(nextLevelIndex(index), -1);
  assert.deepEqual(LEVELS.filter(entry => !entry.bossLevel).slice(0, 60).map(entry => entry.id),
    Array.from({ length: 60 }, (_, i) => `1-${i + 1}`));
  const storage = new Map();
  const saves = new SaveSlots(LEVELS.map(entry => entry.id), () => ({
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  }), undefined, LEVELS.filter(entry => entry.worldId !== '3S').map(entry => entry.id));
  assert.equal(saves.nextLevel({ completed: LEVELS.slice(0, 49).map(entry => entry.id) }), index);
});

test('demo spends 40% stopped, 30% slow and 30% fast, arriving exactly at 180 seconds', () => {
  assert.equal(level.duration, 180);
  assert.equal(level.survive, true);
  assert.equal(level.goal, 0);
  assert.equal(level.killGoal, 0);
  assert.match(levelObjective(level), /Survive for 180 seconds/);
  assert.deepEqual(validateCustomLevel({ ...level, version: 1 }).autoscroll, level.autoscroll);
  assert.equal(level.autoscroll.length, 56);
  const phases = [{ time: 0, speed: level.autoscroll.speed }, ...level.autoscroll.events];
  const seconds = new Map();
  phases.forEach((phase, i) => seconds.set(phase.speed, (seconds.get(phase.speed) ?? 0)
    + (phases[i + 1]?.time ?? level.duration) - phase.time));
  assert.equal(seconds.get(0) / level.duration, .4);
  assert.equal(seconds.get(2 / 9) / level.duration, .3);
  assert.equal(seconds.get(2 / 3) / level.duration, .3);
  for (const options of [{}, { portrait: true }, { portrait: true, scale: .5 }, { portrait: true, scale: .31 }]) {
    const game = new Game(() => .5, { level: index, ...options });
    const axis = options.portrait ? 'y' : 'x';
    const end = options.portrait ? game.height - game.viewportHeight : game.width - game.viewportWidth;
    for (const [time, speed, bricks] of [
      [0, 2 / 9, 0], [18, 0, 4], [42, 2 / 3, 4], [60, 2 / 9, 16],
      [78, 0, 20], [102, 2 / 3, 20], [120, 2 / 9, 32], [138, 0, 36],
      [162, 2 / 3, 36], [180, 0, 48],
    ]) {
      assert.equal(game.camera(time).speed, speed, `speed at ${time}s`);
      close(game.camera(time)[axis], end * bricks / 48);
    }
    for (const time of [18, 78, 138]) assert.deepEqual(game.camera(time + 23), game.camera(time));
    assert.ok(game.camera(179.999)[axis] < end, 'must not arrive early');
    close(game.camera(180)[axis], end);
    assert.deepEqual(game.camera(200), game.camera(180));
  }
});

test('varied foods, enemies, weapons, items and objects populate the entire route within the spawn-time camera', () => {
  const events = level.events;
  assert.equal(events.length, 84);
  assert.ok(events.every((event, i) => event.time < 180 && (!i || event.time >= events[i - 1].time)));
  const ofKind = kind => events.filter(event => event.kind === kind);
  assert.equal(ofKind('food').length, 45);
  assert.deepEqual(new Set(ofKind('food').map(event => event.type)), new Set(Object.keys(FOODS)));
  assert.equal(new Set(ofKind('enemy').map(event => event.type)).size, 12);
  assert.equal(ofKind('enemy').length, 18);
  assert.equal(ofKind('weapon').length, 4);
  assert.equal(ofKind('item').length, 8);
  assert.deepEqual(new Set(ofKind('weapon').map(event => event.type)), new Set(['wood', 'bronze', 'silver']));
  assert.equal(new Set(ofKind('item').map(event => event.type)).size, 8);
  assert.equal(ofKind('object').length, 9);
  assert.ok(ofKind('item').every(event => !ITEMS[event.type].seconds), 'no pickups extend the three-minute trip');
  for (const [start, stop] of [[0, 18], [18, 42], [42, 60], [60, 78], [78, 102],
    [102, 120], [120, 138], [138, 162], [162, 180]]) {
    for (const kind of ['food', 'enemy']) {
      assert.ok(ofKind(kind).some(event => event.time >= start && event.time < stop), `${kind} during ${start}-${stop}s`);
    }
  }
  for (const options of [{}, { portrait: true }, { portrait: true, scale: .5 }, { portrait: true, scale: .31 }]) {
    const game = new Game(() => .5, { level: index, ...options });
    for (const event of events) {
      const camera = game.camera(event.time);
      const points = game.customEventPoints(event);
      for (const point of points) {
        assert.ok(point.x >= camera.x && point.x <= camera.x + camera.width,
          `${event.time}s ${event.type} must spawn within camera X`);
        assert.ok(point.y >= camera.y && point.y <= camera.y + camera.height,
          `${event.time}s ${event.type} must spawn within camera Y`);
      }
    }
  }
});

test('25% of playable bricks are enlarged, one third have extras, and steering colors are equal', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = new Game(() => .5, { level: index, ...options });
    assert.equal(game.bricks.length, 122);
    const active = game.bricks.filter(brick => brick.absorbedBy == null);
    assert.equal(active.length, 96);
    assert.equal(level.brickGroups.length / active.length, .25);
    assert.equal(level.brickGroups.filter(group => group.members.length === 2).length, 22);
    assert.equal(level.brickGroups.filter(group => group.members.length === 3).length, 2);
    for (const kind of ['normal', 'slow', 'fast']) {
      assert.equal(active.filter(brick => brick.kind === kind).length, 32);
    }
    assert.equal(active.filter(brick => ['crumbler', 'warped', 'toggle', ...CONTACT_SURFACES]
      .some(attribute => brick[attribute])).length, 32);
    for (const group of level.brickGroups) {
      for (const id of group.members) assert.equal(game.bricks[id].kind, game.bricks[group.owner].kind);
    }
    assert.ok(game.bricks.every(brick => !brick.hazard), 'new custom hazards do not alter the authored campaign');
    for (const attribute of ['crumbler', 'warped', 'toggle', ...CONTACT_SURFACES.filter(surface => surface !== 'hazard')]) {
      assert.ok(game.bricks.some(brick => brick[attribute]), attribute);
    }
    assert.deepEqual(portalPairIssues(game.bricks), []);
    for (const brick of game.bricks) {
      assert.ok(CONTACT_SURFACES.filter(attribute => brick[attribute]).length <= 1);
    }
    for (const time of [0, 60, 120, 180]) {
      const camera = game.camera(time), axis = options.portrait ? 'y' : 'x';
      const visible = game.bricks.filter(brick => brick[axis] >= camera[axis]
        && brick[axis] < camera[axis] + camera[options.portrait ? 'height' : 'width']
        && brick.absorbedBy == null);
      assert.ok(new Set(visible.map(brick => JSON.stringify([brick.kind,
        brick.crumbler, brick.warped, brick.toggle, ...CONTACT_SURFACES.map(key => brick[key])]))).size >= 4);
    }
  }
  const features = levelFeatures(level);
  for (const picture of ['enemy:robo-koshi', 'food:H', 'special:portal', 'special:turret', 'brick:spikes', 'item:kitty-cape']) {
    assert.ok(features.some(feature => feature.picture === picture), picture);
  }
});

test('three-minute campaign demo runs, freezes, wins at the endpoint, and resets in both layouts', () => {
  for (const options of [{}, { portrait: true, scale: .5 }]) {
    let seed = 41;
    const game = new Game(() => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296),
      { level: index, ...options });
    const original = JSON.stringify(game.bricks);
    game.start();
    // Isolate the survival clock and full spawn schedule from damage while running the real simulation.
    game.hearts = 10000; game.invulnerableUntil = Infinity;
    const advance = () => {
      const camera = game.camera();
      game.cat.x = camera.x + camera.width / 2;
      game.cat.y = camera.y + camera.height / 2;
      game.cat.vx = 0; game.cat.vy = 0;
      game.update(.1);
    };
    for (let i = 0; i < 200; i++) advance();
    const camera = game.camera(), time = game.elapsed;
    game.pause(); game.update(1);
    assert.equal(game.elapsed, time);
    assert.deepEqual(game.camera(), camera);
    game.resume();
    while (game.state === 'playing' && game.elapsed < 179.9 - 1e-8) advance();
    assert.equal(game.state, 'playing');
    assert.equal(game.nextCustom, level.events.length);
    advance();
    assert.equal(game.state, 'won');
    assert.equal(game.elapsed, 180);
    assert.equal(game.camera().speed, 0);
    assert.ok([...game.robots, ...game.food, ...game.items].every(entity => Number.isFinite(entity.x) && Number.isFinite(entity.y)));
    game.reset();
    assert.equal(game.state, 'ready');
    assert.equal(game.camera()[options.portrait ? 'y' : 'x'], 0);
    assert.equal(JSON.stringify(game.bricks), original);
  }
});
