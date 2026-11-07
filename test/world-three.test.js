'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, FOODS, validateCustomLevel, validateCutscene } = require('../src/game.js');

const world = LEVELS.filter(level => level.worldId === '3');
const earlier = LEVELS.filter(level => ['1', '2'].includes(level.worldId) && !level.bossLevel);
const CONCEPTS = ['robo goalies', 'paint brushes', 'kitty cape', 'laser turret', 'obstructions', 'robo snail', 'bumpers',
  'bubbles', 'fireball turret', 'destructible obstructions', 'appearing obstructions', 'robo cows', 'robo unicorns', 'robo koshi'];
const NEW_ENEMIES = { 'robo goalies': 'goalie', 'robo snail': 'robo-snail', 'robo cows': 'robo-cow', 'robo unicorns': 'robo-unicorn', 'robo koshi': 'robo-koshi' };
const byConcept = concept => world.find(level => level.concept === concept);
const events = (level, kind, test = () => true) => (level.events ?? []).filter(event => event.kind === kind && test(event));
const firstTime = (level, predicate) => Math.min(...[
  ...level.items.filter(([, type]) => predicate('item', type)).map(([time]) => time),
  ...(level.events ?? []).filter(event => predicate(event.kind, event.type)).map(event => event.time),
]);

test('World 3 appends fourteen levels introducing one concept each, in order, after the unchanged campaign', () => {
  assert.equal(earlier.length, 34);
  assert.deepEqual(world.map(level => level.concept), CONCEPTS);
  assert.deepEqual(world.map(level => level.number), CONCEPTS.map((_, i) => `3-${i + 1}`));
  assert.deepEqual(world.map(level => level.id), CONCEPTS.map((_, i) => `1-${35 + i}`));
  for (const level of world) {
    assert.equal(level.cutscene.theme, 'foundry');
    validateCutscene(level.cutscene);
    validateCustomLevel({ ...level, version: 1, events: level.events ?? [] });
  }
});

test('win conditions are food, enemy or goal targets in any combination, or survival', () => {
  const kinds = new Set();
  for (const level of world) {
    const targets = [level.goal > 0 && 'food', level.killGoal > 0 && 'enemy', level.goalsGoal > 0 && 'soccer'].filter(Boolean);
    assert.ok(level.survive ? targets.length === 0 : targets.length > 0, level.number);
    kinds.add(level.survive ? 'survive' : targets.join('+'));
  }
  for (const kind of ['survive', 'food', 'enemy', 'soccer', 'food+enemy']) assert.ok(kinds.has(kind), kind);
});

test('cutscenes introduce Tom first and only show enemies already introduced and present in that level', () => {
  const introduced = new Set(earlier.flatMap(level => level.enemies.map(([, type]) => type)));
  for (const type of Object.values(NEW_ENEMIES)) introduced.delete(type);
  assert.match(world[0].cutscene.lines[0].text, /Tom the Duck/);
  assert.equal(world[0].cutscene.lines[0].speaker, 'tom');
  for (const level of world) {
    if (NEW_ENEMIES[level.concept]) introduced.add(NEW_ENEMIES[level.concept]);
    const present = new Set(level.enemies.map(([, type]) => type));
    for (const type of present) assert.ok(introduced.has(type), `${level.number}: ${type} introduced`);
    const characters = new Set(level.cutscene.lines.flatMap(line => [line.speaker, ...line.actors.map(actor => actor.character)]));
    for (const character of characters) {
      assert.ok(['koshi', 'tom'].includes(character) || present.has(character), `${level.number}: ${character} in level`);
    }
    if (NEW_ENEMIES[level.concept]) assert.ok(characters.has(NEW_ENEMIES[level.concept]), `${level.number} shows its new enemy`);
    assert.ok(level.cutscene.lines.some(line => line.speaker === 'koshi'));
  }
});

test('starting blocks are mostly single size, with about 14% double and 5% triple blocks', () => {
  for (const [i, level] of world.entries()) {
    for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
      const game = new Game(() => .5, { level: LEVELS.indexOf(level), ...options });
      const active = game.bricks.filter(brick => brick.absorbedBy === null);
      const sizes = active.map(owner => 1 + game.bricks.filter(brick => brick.absorbedBy === owner.id).length);
      assert.equal(sizes.filter(size => size === 2).length / sizes.length, 3 / 21, level.number);
      assert.equal(sizes.filter(size => size === 3).length / sizes.length, 1 / 21, level.number);
    }
  }
});

test('shields are infrequent, and stronger shields are rarer', () => {
  const enemies = world.flatMap(level => level.enemies);
  const count = shield => enemies.filter(([, , , value]) => value === shield).reduce((sum, [, , n]) => sum + n, 0);
  const total = enemies.reduce((sum, [, , n]) => sum + n, 0);
  assert.ok(count('red') > count('green') && count('green') > count('blue') && count('blue') > 0);
  assert.ok((count('red') + count('green') + count('blue')) / total < .1);
});

test('heart cost allows at most five hearts even if every food point is collected', () => {
  for (const level of world) {
    const points = level.food.reduce((sum, [, method, type]) => sum + (method === 'S' ? 1 : Number(method.slice(1))) * FOODS[type].value, 0)
      + events(level, 'food').reduce((sum, event) => sum + FOODS[event.type].value, 0)
      + level.brickTypes.reduce((sum, brick) => sum + (brick.spawner?.kind === 'food' ? FOODS[brick.spawner.type].value : 0), 0);
    assert.ok(Number.isFinite(level.heartCost) && Math.floor(points / level.heartCost) <= 5, level.number);
    if (level.goal) assert.ok(points >= level.goal + 10, `${level.number}: reachable food goal`);
  }
});

test('levels reuse one to four returning brick types and one to two returning items or objects', () => {
  const brickKeys = ['crumbler', 'slimed', 'spikes', 'springs', 'conveyor', 'warped', 'boost', 'spawner', 'toggle', 'portal', 'barrier', 'turret'];
  const conceptItems = { 'paint brushes': /^paint-/, 'kitty cape': /^kitty-cape$/, 'laser turret': /^battery$/,
    obstructions: /^obstruction-/, bumpers: /^bumper-/, bubbles: /^bubble-/, 'fireball turret': /^battery$/,
    'destructible obstructions': /^(obstruction-|battery$)/, 'appearing obstructions': /^obstruction-/,
    'robo goalies': /^soccer-ball$/, 'robo unicorns': /^eggplant$/ };
  for (const level of world) {
    const conceptBrick = { 'robo goalies': 'goal', 'laser turret': 'turret', 'fireball turret': 'turret',
      'destructible obstructions': 'fireball-turret', 'robo cows': 'boost' }[level.concept];
    const bricks = new Set(level.brickTypes.flatMap(brick => brick.kind === 'goal' ? ['goal'] : brickKeys.filter(key => brick[key])));
    bricks.delete(conceptBrick);
    assert.ok(bricks.size >= 1 && bricks.size <= 4, `${level.number}: ${[...bricks]}`);
    const things = new Set([...level.items.map(([, type]) => type),
      ...(level.events ?? []).filter(event => ['item', 'object'].includes(event.kind)).map(event => event.type)]
      .filter(type => !conceptItems[level.concept]?.test(type))
      .map(type => type.replace(/-(red|blue|green)$/, '').replace(/^paint-.*/, 'paintbrush')));
    assert.ok(things.size >= 1 && things.size <= 2, `${level.number}: ${[...things]}`);
  }
});

test('level-specific concept requirements', () => {
  const goalies = byConcept('robo goalies');
  assert.equal(goalies.goalsGoal, 5);
  const balls = events(goalies, 'object', event => event.type === 'soccer-ball');
  assert.ok(balls.length >= 6);
  assert.ok(Math.min(...goalies.enemies.filter(([, type]) => type === 'goalie').map(([time]) => time)) < Math.min(...balls.map(ball => ball.time)));

  const brushes = byConcept('paint brushes');
  const brushTimes = color => brushes.items.filter(([, type]) => type.startsWith('paint-') && type.endsWith(color)).map(([time]) => time);
  assert.ok(brushTimes('blue').length >= 2 && Math.max(...brushTimes('blue')) < Math.min(...brushTimes('red')));

  const laser = byConcept('laser turret');
  assert.ok(laser.brickTypes.some(brick => brick.turret === 'laser'));
  assert.ok(laser.items.filter(([, type]) => type === 'battery').length >= 2);
  assert.ok(laser.enemies.reduce((sum, [, , n]) => sum + n, 0) >= 20);

  const demolition = byConcept('destructible obstructions');
  assert.equal(demolition.brickTypes.filter(brick => brick.turret).length, 1);
  assert.equal(demolition.brickTypes.find(brick => brick.turret).turret, 'fireball');
  assert.ok(firstTime(demolition, (kind, type) => type === 'battery') < Infinity);
  assert.ok(events(demolition, 'item', event => event.type === 'battery').length >= 2);
  assert.ok(events(demolition, 'object', event => event.destructible).length > 0);

  for (const level of LEVELS.slice(0, LEVELS.indexOf(byConcept('appearing obstructions')))) {
    assert.ok(events(level, 'object', event => event.type.startsWith('obstruction-')).every(event => event.time === 0), level.number);
  }
  assert.ok(events(byConcept('appearing obstructions'), 'object', event => event.type.startsWith('obstruction-')).every(event => event.time > 0));

  const cows = byConcept('robo cows');
  const boosts = cows.brickTypes.filter(brick => brick.boost).length;
  assert.ok(boosts >= 2 && boosts <= 3);
  assert.ok(cows.weapons.length <= 1 && cows.killGoal > 0 && !cows.goal);

  const unicorns = byConcept('robo unicorns');
  assert.ok(unicorns.goal > 0 && !unicorns.killGoal);
  const unicornTime = Math.min(...unicorns.enemies.filter(([, type]) => type === 'robo-unicorn').map(([time]) => time));
  assert.ok(unicornTime < Math.min(...unicorns.food.map(([time]) => time)));
  assert.ok(unicorns.items.some(([, type]) => type === 'eggplant'));

  const copycat = byConcept('robo koshi');
  assert.equal(copycat, world.at(-1));
  assert.equal(copycat.enemies[0][1], 'robo-koshi');
  assert.ok(copycat.enemies.filter(([, type]) => type === 'robo-koshi').length >= 2);
});

test('every World 3 level runs and resets cleanly in each orientation', () => {
  for (const [i, level] of world.entries()) {
    for (const options of [{}, { portrait: true, scale: .31 }]) {
      const game = new Game(() => .5, { level: 34 + i, ...options });
      const initial = structuredClone(game.bricks);
      game.start();
      for (let t = 0; t < 30; t += .05) game.update(.05);
      game.reset();
      assert.deepEqual(game.bricks, initial, level.number);
    }
  }
});
