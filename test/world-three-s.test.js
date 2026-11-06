'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, FOODS, OBJECTS, SHIELDS, validateCustomLevel, validateCutscene } = require('../src/game.js');
const { WORLDS, nextLevelIndex } = require('../src/worlds.js');

const world = LEVELS.filter(level => level.worldId === '3S');
const first = LEVELS.indexOf(world[0]);
const events = (level, kind, test = () => true) => (level.events ?? []).filter(event => event.kind === kind && test(event));
const targets = level => [level.goal > 0 && 'food', level.killGoal > 0 && 'enemy', level.goalsGoal > 0 && 'soccer'].filter(Boolean);
const BRICK_KEYS = ['crumbler', 'slimed', 'spikes', 'springs', 'conveyor', 'warped', 'boost', 'spawner', 'toggle', 'portal', 'barrier', 'turret'];
const brickFeatures = level => new Set(level.brickTypes.flatMap(brick => [
  ...(brick.kind === 'goal' ? ['goal'] : []),
  ...BRICK_KEYS.filter(key => brick[key]).map(key => key === 'turret' ? `${brick.turret}-turret` : key),
]));
const thingTypes = level => new Set([...level.items.map(([, type]) => type), ...level.weapons.map(([, type]) => type),
  ...(level.events ?? []).filter(event => ['item', 'object', 'weapon'].includes(event.kind)).map(event => event.type)]);

test('World 3S is an optional twelve-level challenge branch from World 2 appended after World 3', () => {
  assert.equal(world.length, 12);
  assert.equal(first, 48);
  assert.deepEqual(world.map(level => level.number), world.map((_, i) => `3S-${i + 1}`));
  assert.deepEqual(world.map(level => level.id), world.map((_, i) => `1-${49 + i}`));
  const challenge = WORLDS.find(entry => entry.id === '3S');
  assert.equal(challenge.special, true);
  assert.deepEqual(WORLDS.find(entry => entry.id === '2').next, ['3', '3S']);
  assert.equal(nextLevelIndex(33), 34, 'finishing World 2 continues on the main path');
  assert.equal(nextLevelIndex(LEVELS.indexOf(world.at(-1))), -1);
  for (const level of world) {
    assert.equal(level.cutscene.theme, 'foundry');
    validateCutscene(level.cutscene);
    validateCustomLevel({ ...level, version: 1, events: level.events ?? [] });
  }
});

test('food, enemy and soccer objectives are evenly weighted, with soccer used slightly more', () => {
  const count = kind => world.filter(level => targets(level).includes(kind)).length;
  assert.ok(world.every(level => !level.survive && targets(level).length > 0));
  assert.ok(count('soccer') >= count('food') && count('soccer') >= count('enemy'));
  assert.ok(count('soccer') - Math.min(count('food'), count('enemy')) <= 1);
  assert.ok(Math.abs(count('food') - count('enemy')) <= 1);
  assert.ok(new Set(world.map(level => targets(level).join('+'))).size >= 6, 'single and combined objectives both appear');
});

test('robots arrive before every weapon and power-up', () => {
  for (const level of world) {
    const robots = Math.min(...level.enemies.map(([time]) => time));
    const helpers = [...level.weapons, ...level.items].map(([time]) => time)
      .concat((level.events ?? []).filter(event => ['weapon', 'item'].includes(event.kind)).map(event => event.time));
    assert.ok(helpers.length && robots < Math.min(...helpers), level.number);
  }
});

test('soccer balls appear only in goal levels, swords are plentiful, and jackolanterns face a barrier', () => {
  for (const level of world) {
    const balls = events(level, 'object', event => event.type === 'soccer-ball').length;
    assert.equal(balls > 0, level.goalsGoal > 0, level.number);
    assert.ok(level.weapons.length + events(level, 'weapon').length >= 4, level.number);
    if (level.enemies.some(([, type]) => type === 'jackolantern')) {
      assert.ok(level.brickTypes.some(brick => brick.barrier), level.number);
    }
  }
});

test('cutscenes introduce Tom and only show Koshi, Tom and robots that appear in that level', () => {
  assert.equal(world[0].cutscene.lines[0].speaker, 'tom');
  assert.match(world[0].cutscene.lines[0].text, /Tom the Duck/);
  for (const level of world) {
    const present = new Set(level.enemies.map(([, type]) => type));
    const characters = new Set(level.cutscene.lines.flatMap(line => [line.speaker, ...line.actors.map(actor => actor.character)]));
    for (const character of characters) assert.ok(['koshi', 'tom'].includes(character) || present.has(character), `${level.number}: ${character}`);
    assert.ok(level.cutscene.lines.some(line => line.speaker === 'koshi'));
    assert.ok(level.cutscene.lines.some(line => line.speaker === 'tom'));
  }
});

test('every level uses a distinct combination of robots, bricks and items', () => {
  const signatures = world.map(level => JSON.stringify([
    [...new Set(level.enemies.map(([, type]) => type))].sort(), [...brickFeatures(level)].sort(), [...thingTypes(level)].sort()]));
  assert.equal(new Set(signatures).size, world.length);
  for (const level of world) {
    assert.ok(new Set(level.enemies.map(([, type]) => type)).size >= 3, `${level.number}: robot variety`);
    assert.ok(brickFeatures(level).size >= 3, `${level.number}: brick variety`);
    assert.ok(thingTypes(level).size >= 3, `${level.number}: item variety`);
  }
  const enemyTypes = new Set(world.flatMap(level => level.enemies.map(([, type]) => type)));
  for (const type of ['mouse', 'wheel', 'ram', 'bucket', 'ball', 'jackolantern', 'snake', 'goalie', 'robo-koshi', 'robo-snail', 'robo-cow', 'robo-unicorn']) {
    assert.ok(enemyTypes.has(type), type);
  }
});

test('brick sizes and colors vary, and every merged group is a continuous run in both orientations', () => {
  const sizes = new Set(), layouts = new Set(), colors = new Set();
  for (const [i, level] of world.entries()) {
    for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
      const game = new Game(() => .5, { level: first + i, ...options });
      const owners = game.bricks.filter(brick => brick.absorbedBy === null);
      const groupSizes = owners.map(owner => 1 + game.bricks.filter(brick => brick.absorbedBy === owner.id).length);
      assert.ok(groupSizes.filter(size => size === 1).length > owners.length / 2, `${level.number}: mostly single`);
      assert.ok(groupSizes.some(size => size === 2), `${level.number}: has a double`);
      groupSizes.forEach(size => sizes.add(size));
      assert.ok(owners.some(brick => brick.kind === 'slow') && owners.some(brick => brick.kind === 'fast'), level.number);
      for (const { owner, members } of level.brickGroups) {
        const next = id => game.perimeter[(game.perimeter.indexOf(id) + 1) % game.perimeter.length];
        assert.equal(members.filter(id => !members.includes(next(id))).length, 1, `${level.number}: group ${owner}`);
      }
    }
    layouts.add(JSON.stringify(level.brickGroups));
    colors.add(JSON.stringify(level.brickTypes.map(brick => brick.kind)));
  }
  assert.deepEqual([...sizes].sort(), [1, 2, 3, 4]);
  assert.equal(layouts.size, world.length);
  assert.equal(colors.size, world.length);
});

test('shields are tougher than World 3 but stronger shields stay rarer', () => {
  const enemies = world.flatMap(level => level.enemies);
  const count = shield => enemies.filter(([, , , value]) => value === shield).reduce((sum, [, , n]) => sum + n, 0);
  assert.ok(count('red') > count('green') && count('green') > count('blue') && count('blue') > 0);
  assert.ok(enemies.every(([, , , shield]) => shield === undefined || Object.hasOwn(SHIELDS, shield)));
});

test('targets are reachable while hearts stay scarce', () => {
  for (const level of world) {
    const points = level.food.reduce((sum, [, method, type]) => sum + (method === 'S' ? 1 : Number(method.slice(1))) * FOODS[type].value, 0)
      + events(level, 'food').reduce((sum, event) => sum + FOODS[event.type].value, 0)
      + level.brickTypes.reduce((sum, brick) => sum + (brick.spawner?.kind === 'food' ? FOODS[brick.spawner.type].value : 0), 0);
    assert.ok(Math.floor(points / level.heartCost) <= 4, `${level.number}: hearts`);
    if (level.goal) assert.ok(points >= level.goal + 10, `${level.number}: food goal`);
    if (level.killGoal) {
      const robots = level.enemies.filter(([, type]) => type !== 'goalie')
        .reduce((sum, [, , n, shield]) => sum + n * (shield ? SHIELDS[shield].hits : 1), 0);
      assert.ok(robots >= level.killGoal * 1.5, `${level.number}: enemy goal`);
    }
    if (level.goalsGoal) {
      assert.ok(level.brickTypes.some(brick => brick.kind === 'goal'), `${level.number}: goal bricks`);
      assert.ok(events(level, 'object', event => event.type === 'soccer-ball').length >= level.goalsGoal + 2, `${level.number}: balls`);
    }
  }
  const helmet = world.find(level => level.activationLimit);
  assert.ok(events(helmet, 'item', event => event.type.startsWith('boom-time-')).length >= 4);
});

test('placed spawns stay clear of obstructions, and levels with static objects place every spawn', () => {
  for (const level of world) {
    const obstructions = events(level, 'object', event => OBJECTS[event.type].obstruction);
    const objects = events(level, 'object', event => event.type !== 'soccer-ball');
    if (objects.some(event => event.time === 0)) {
      assert.ok(!level.food.length && !level.items.length && !level.weapons.length, `${level.number}: placed spawns`);
    }
    for (const event of (level.events ?? []).filter(event => !OBJECTS[event.type]?.obstruction)) {
      for (const wall of obstructions) {
        const clearance = OBJECTS[wall.type].radius ? .2 : .12;
        assert.ok(Math.hypot(event.x - wall.x, event.y - wall.y) >= clearance, `${level.number}: ${event.type} near ${wall.type}`);
      }
    }
  }
});

test('the Grand Slam needs food, enemy and soccer targets together', () => {
  const index = LEVELS.findIndex(level => level.number === '3S-10');
  assert.deepEqual(targets(LEVELS[index]), ['food', 'enemy', 'soccer']);
  const game = new Game(() => .5, { level: index });
  game.start();
  game.score = game.level.goal;
  game.enemies = game.level.killGoal;
  game.goals = game.level.goalsGoal - 1;
  game.update(.01);
  assert.equal(game.state, 'playing');
  game.goals = game.level.goalsGoal;
  game.update(.01);
  assert.equal(game.state, 'won');
});

test('every World 3S level runs and resets cleanly in each orientation', () => {
  for (const [i, level] of world.entries()) {
    for (const options of [{}, { portrait: true, scale: .31 }]) {
      const game = new Game(() => .5, { level: first + i, ...options });
      const initial = structuredClone(game.bricks);
      game.start();
      for (let t = 0; t < 30; t += .05) game.update(.05);
      game.reset();
      assert.deepEqual(game.bricks, initial, level.number);
    }
  }
});
