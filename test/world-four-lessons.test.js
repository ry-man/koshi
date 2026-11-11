const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { Game, LEVELS, FOODS, SHIELDS, WEAPONS, CONTACT_SURFACES,
  validateCustomLevel, validateCutscene, hazardEnabled } = require('../src/game.js');
const { nextLevelIndex, levelFeatures } = require('../src/worlds.js');
const { SaveSlots } = require('../src/saves.js');

const lessons = LEVELS.filter(level => level.worldId === '4').slice(1);
const concepts = [
  'fire hazard brick', 'missile hazard brick', 'power brick', 'cat shield', 'robo crab',
  'laser hazard', 'cat circles', 'robo love bugs', 'bubble gun hazard', 'hammer weapon',
  'cat tracks', 'bumper gun hazard', 'powered cat tracks',
];
const activeBricks = game => game.bricks.filter(brick => brick.absorbedBy == null);
const mechanic = brick => brick.kind === 'goal' ? 'goal' : brick.hazard ? brick.hazard.type
  : ['crumbler', 'warped', 'toggle', 'power', ...CONTACT_SURFACES].find(key => brick[key]);
const featured = [
  ['flame'], ['missile'], ['power', 'flame', 'missile'], [], [],
  ['power', 'laser'], [], ['barrier'], ['power', 'bubble-blue'], [], [], ['power', 'bumper-red'], ['power'],
];
const arena = (level, options = {}) => new Game(() => .5, { level: LEVELS.indexOf(level), ...options });

test('13 lessons append stable identities against the current campaign baseline', () => {
  assert.equal(createHash('sha256').update(JSON.stringify(LEVELS.slice(0, 62))).digest('hex'),
    '07a693cf286e89dbcd3ebcb485c95924da73c32ccf9dfc2335b21b502edf5335');
  assert.deepEqual(lessons.map(level => level.concept), concepts);
  assert.deepEqual(lessons.map(level => level.number), concepts.map((_, i) => `4-${i + 2}`));
  assert.deepEqual(lessons.map(level => level.id), concepts.map((_, i) => `1-${i + 62}`));
  for (let i = 61; i < LEVELS.length; i++) {
    assert.equal(nextLevelIndex(i), i === LEVELS.length - 1 ? -1 : i + 1);
  }
  const saves = new SaveSlots(LEVELS.map(level => level.id), () => ({
    getItem: () => null, setItem: () => {},
  }), undefined, LEVELS.filter(level => level.worldId !== '3S').map(level => level.id));
  assert.equal(saves.nextLevel({ completed: LEVELS.slice(0, 62).map(level => level.id) }), 62);
});

test('lessons gate every requested mechanic, pickup, weapon and enemy until its introduction', () => {
  const seen = new Set();
  for (const [i, level] of lessons.entries()) {
    const features = new Set();
    for (const brick of level.brickTypes) {
      if (brick.hazard) features.add({
        flame: 0, missile: 1, laser: 5, 'bubble-blue': 8, 'bumper-red': 11,
      }[brick.hazard.type]);
      if (brick.power) features.add(2);
    }
    for (const event of level.events) {
      if (event.type.startsWith('cat-shield-')) features.add(3);
      if (event.type === 'robo-crab') features.add(4);
      if (event.type === 'cat-circle') features.add(6);
      if (event.type === 'robo-love-bug') features.add(7);
      if (event.type.startsWith('hammer-')) features.add(9);
    }
    for (const track of level.tracks ?? []) features.add(track.power ? 12 : 10);
    assert.ok([...features].every(feature => feature <= i), `${level.number}: no early concepts`);
    assert.deepEqual([...features].filter(feature => !seen.has(feature)), [i], level.number);
    for (const feature of features) seen.add(feature);
    if (i < 2) {
      assert.ok(level.brickTypes.every(brick => !brick.power && !brick.hazard?.power));
    }
  }
  assert.match(lessons[0].cutscene.lines[0].text, /Tom the Duck.+commander.+conquer the world/);
});

test('every scene explains the lesson and objective with only robots present in its level', () => {
  for (const level of lessons) {
    assert.deepEqual(validateCutscene(level.cutscene), level.cutscene);
    const enemies = new Set(level.events.filter(event => event.kind === 'enemy').map(event => event.type));
    for (const line of level.cutscene.lines) {
      for (const actor of line.actors) {
        assert.ok(['koshi', 'tom'].includes(actor.character) || enemies.has(actor.character), level.number);
      }
    }
    const text = level.cutscene.lines.map(line => line.text).join(' ');
    assert.match(text, /food|meal|snack|soup|seafood|lunch|feast|banquet|noodles|pretzels|brunch|roast/i);
    assert.match(text, /world/);
    for (const target of [level.goal, level.killGoal, level.goalsGoal].filter(Boolean)) {
      assert.ok(text.includes(String(target)), `${level.number}: state target ${target}`);
    }
    if (level.survive) assert.match(text, /survive for 110 seconds/);
  }
});

test('layouts validate and preserve size, surface and returning-mechanic budgets in desktop and portrait', () => {
  for (const [i, level] of lessons.entries()) {
    const validated = validateCustomLevel({ ...level, version: 1 });
    assert.deepEqual(validated.events, level.events);
    if (level.tracks) assert.deepEqual(validated.tracks, level.tracks);
    for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
      const game = arena(level, options), active = activeBricks(game);
      const sizes = active.map(owner => 1 + game.bricks.filter(part => part.absorbedBy === owner.id).length);
      const doubles = sizes.filter(size => size === 2).length / sizes.length;
      const triples = sizes.filter(size => size === 3).length / sizes.length;
      assert.ok(doubles >= .1 && doubles <= .15, `${level.number}: double frequency`);
      assert.ok(triples >= .04 && triples <= .06, `${level.number}: triple frequency`);
      assert.ok(sizes.filter(size => size === 1).length / sizes.length >= .8);
      const returning = new Set(active.map(mechanic).filter(type => type && !featured[i].includes(type)));
      assert.ok(returning.size >= 1 && returning.size <= 4, `${level.number}: ${[...returning]}`);
      for (const type of featured[i]) {
        assert.ok(active.filter(brick => mechanic(brick) === type).length >= 3, `${level.number}: ${type}`);
      }
      for (const brick of game.bricks) {
        assert.ok(CONTACT_SURFACES.filter(key => brick[key]).length <= 1, `${level.number}: exclusive surfaces`);
      }
      for (const group of level.brickGroups) {
        const owner = game.bricks[group.owner];
        for (const id of group.members) assert.equal(mechanic(game.bricks[id]), mechanic(owner));
      }
      assert.deepEqual(game.customEvents, level.events);
      const before = structuredClone(game.bricks);
      game.start(); game.reset();
      assert.deepEqual(game.bricks, before);
    }
  }
});

test('the seeded autoscroll sample is stable, excludes Love Bugs and keeps every timed spawn on screen', () => {
  assert.deepEqual(lessons.filter(level => level.autoscroll).map(level => level.number), ['4-2', '4-5', '4-10']);
  assert.equal(lessons.filter(level => level.autoscroll).length / (lessons.length - 1), .25);
  assert.equal(lessons[7].autoscroll, undefined);
  for (const level of lessons.filter(level => level.autoscroll)) {
    for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
      const game = arena(level, options);
      for (const event of level.events) {
        const camera = game.camera(event.time);
        for (const point of game.customEventPoints(event)) {
          assert.ok(point.x >= camera.x && point.x <= camera.x + camera.width, `${level.number}: ${event.type} x`);
          assert.ok(point.y >= camera.y && point.y <= camera.y + camera.height, `${level.number}: ${event.type} y`);
        }
      }
    }
  }
});

test('each lesson supplements its featured equipment with one or two previously introduced pickup types', () => {
  const known = new Set(['smiley-cookie', 'music-box', 'magic-sunglasses', 'kitty-cape',
    'paint-pencil-red', 'bumper-green', 'bubble-blue', 'obstruction-circle', 'soccer-ball',
    'bumper-red', 'bumper-blue']);
  for (const [i, level] of lessons.entries()) {
    const equipment = new Set(['soccer-ball', ...(i === 3 ? ['cat-shield-red'] : []),
      ...(i === 6 ? ['cat-circle'] : [])]);
    const returning = new Set(level.events
      .filter(event => ['object', 'item'].includes(event.kind) && !event.track && !equipment.has(event.type))
      .map(event => event.type));
    assert.ok(returning.size >= 1 && returning.size <= 2, level.number);
    for (const type of returning) assert.ok(known.has(type), `${level.number}: ${type} introduced already`);
    if (i === 3) known.add('cat-shield-red');
    if (i === 6) known.add('cat-circle');
  }
});

test('food, soccer and attack supplies exceed targets, and all food generates no more than five hearts', () => {
  const totals = new Map([['red', 0], ['green', 0], ['blue', 0]]);
  for (const level of lessons) {
    const foodPoints = level.events.filter(event => event.kind === 'food')
      .reduce((sum, event) => sum + FOODS[event.type].value, 0);
    assert.ok(foodPoints > level.goal);
    assert.ok(Math.floor(foodPoints / level.heartCost) <= 5, level.number);
    assert.ok(level.heartCost >= Math.ceil(foodPoints / 5));
    assert.ok(level.brickTypes.every(brick => brick.spawner?.kind !== 'food'));
    const game = arena(level);
    game.start();
    game.score = foodPoints;
    game.update(.01);
    assert.equal([...game.pendingSpawns.values()].filter(spawn => spawn.kind === 'heart').length,
      Math.floor(foodPoints / level.heartCost));
    const enemies = level.events.filter(event => event.kind === 'enemy');
    const enemyPoints = enemies.reduce((sum, event) => sum + game.createCustomSpawn(event)[0].defeatPoints, 0);
    assert.ok(enemyPoints >= level.killGoal);
    const attacks = level.events.filter(event => event.kind === 'weapon')
      .reduce((sum, event) => sum + WEAPONS[event.type].uses, 0);
    const allHits = enemies.reduce((sum, event) => sum + (event.shield ? SHIELDS[event.shield].hits : 1), 0);
    assert.ok(attacks >= allHits || level.concept === 'robo love bugs', level.number);
    if (level.goalsGoal) {
      assert.ok(activeBricks(game).some(brick => brick.kind === 'goal'));
      assert.ok(level.events.filter(event => event.type === 'soccer-ball').length > level.goalsGoal);
    }
    const shielded = enemies.filter(event => event.shield);
    if (level.concept === 'hammer weapon') {
      assert.ok(shielded.length > enemies.length / 2);
      assert.ok(level.events.some(event => event.type.startsWith('hammer-')));
    } else {
      assert.ok(shielded.length / enemies.length <= .25);
      for (const event of shielded) totals.set(event.shield, totals.get(event.shield) + 1);
    }
  }
  assert.ok(totals.get('red') > totals.get('green'));
  assert.ok(totals.get('green') > totals.get('blue'));
});

test('powered hazards switch, Love Bugs have fences, and loop attachments move and pause with power', () => {
  for (const i of [2, 5, 8, 11]) {
    const game = arena(lessons[i]);
    game.start();
    const emitters = activeBricks(game).filter(brick => brick.hazard?.power);
    const switchBrick = activeBricks(game).find(brick => brick.power && game.brickVisible(brick));
    assert.ok(switchBrick);
    const before = emitters.map(brick => hazardEnabled(brick, game.powerOn));
    assert.equal(game.steer(switchBrick.id, switchBrick.x + switchBrick.w / 2, switchBrick.y + switchBrick.h / 2), true);
    assert.deepEqual(emitters.map(brick => hazardEnabled(brick, game.powerOn)), before.map(enabled => !enabled));
  }
  const love = arena(lessons[7]);
  assert.ok(activeBricks(love).filter(brick => brick.barrier).length >= 3);
  assert.equal(lessons[7].events.filter(event => event.type === 'robo-love-bug' && event.time === 2).length, 4);
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = arena(lessons[7], options);
    game.start();
    game.elapsed = 2;
    game.robots = lessons[7].events.filter(event => event.kind === 'enemy' && event.time === 2)
      .flatMap(event => game.createCustomSpawn(event));
    game.barriers = activeBricks(game).filter(brick => brick.barrier)
      .map(brick => ({ id: brick.id, length: 0, extending: true }));
    game.updateBarriers(100);
    assert.equal(game.isolatedLoveBugs(game.barrierParts()).size, 4, 'authored fences can isolate the opening wave');
  }
  for (const i of [10, 12]) {
    const game = arena(lessons[i]);
    assert.equal(game.catTracks.length, 1);
    assert.equal(game.catTracks[0].closed, true);
    assert.deepEqual(game.catTracks[0].nodes, lessons[i].tracks[0].nodes);
    game.start();
    const objects = i === 10 ? game.bumpers : game.obstructions;
    assert.equal(objects.filter(object => object.track).length, 4);
    const moving = objects.filter(object => object.track);
    const initial = moving.map(object => object.trackDistance);
    game.update(.1);
    assert.ok(moving.every((object, j) => object.trackDistance > initial[j]));
    if (i === 12) {
      assert.ok(moving.every(object => object.spiked));
      game.powerOn = true;
      const stopped = moving.map(object => object.trackDistance);
      game.update(.1);
      assert.deepEqual(moving.map(object => object.trackDistance), stopped);
    } else assert.equal(game.catTracks[0].power, undefined);
    const features = levelFeatures(lessons[i]);
    assert.ok(features.some(feature => feature.picture === `object:${i === 10 ? 'bumper-red' : 'obstruction-circle'}`));
  }
});

test('each lesson requires every target, or survives until the timer, in both orientations', () => {
  for (const level of lessons) for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = arena(level, options);
    game.start();
    game.nextCustom = level.events.length;
    game.score = level.goal; game.enemies = level.killGoal; game.goals = level.goalsGoal;
    if (level.survive) {
      game.elapsed = level.duration - .02;
      game.update(.01);
      assert.equal(game.state, 'playing', level.number);
      game.update(.02);
      assert.equal(game.state, 'won', level.number);
    } else {
      for (const [key, target] of [['score', level.goal], ['enemies', level.killGoal], ['goals', level.goalsGoal]]) {
        if (!target) continue;
        game[key]--;
        game.update(.01);
        assert.equal(game.state, 'playing', `${level.number}: must meet ${key}`);
        game[key]++;
      }
      game.update(.01);
      assert.equal(game.state, 'won', level.number);
    }
  }
});
