const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, FOODS, CONTACT_SURFACES, validateCustomLevel, validateCutscene } = require('../src/game.js');
const { WORLDS, nextLevelIndex } = require('../src/worlds.js');

const lessons = LEVELS.filter(level => level.worldId === '5');
const concepts = [
  'anvil', 'robo trash bin', 'battle axe', 'chisel', 'scrambler', 'ice terrain', 'ice skates',
  'rope dart', 'robo sharpshooter', 'lava terrain', 'robo cat lady', 'team goals',
  'exploding soccer balls', 'jumbo soccer balls', 'robo moon', 'water terrain', 'surf board',
];
const arena = (level, options = {}) => new Game(() => .5, { level: LEVELS.indexOf(level), ...options });
const activeBricks = game => game.bricks.filter(brick => brick.absorbedBy == null);
const groupSize = (game, owner) => 1 + game.bricks.filter(part => part.absorbedBy === owner.id).length;
const mechanic = brick => ['cinder', 'goal'].includes(brick.kind) ? brick.kind : brick.hazard ? brick.hazard.type
  : brick.turret ? `turret-${brick.turret}` : ['crumbler', 'warped', 'toggle', 'power', ...CONTACT_SURFACES].find(key => brick[key]);
// Concept introductions, keyed by the event type or terrain that reveals them.
const introductions = [
  ['anvil'], ['robo-trash-bin'], ['axe-silver', 'axe-gold'], ['chisel'], ['scrambler'], ['ice'],
  ['ice-skate-red', 'ice-skate-green', 'ice-skate-blue'], ['rope-dart-bronze', 'rope-dart-silver', 'rope-dart-gold'],
  ['robo-sharpshooter'], ['lava'], ['robo-cat-lady'], ['striker'],
  ['soccer-ball-red', 'soccer-ball-green', 'soccer-ball-blue'], ['soccer-ball-jumbo', 'soccer-ball-jumbo-green'],
  ['robo-moon'], ['water'], ['surf-board-red', 'surf-board-green', 'surf-board-blue'],
];
const conceptIndex = type => introductions.findIndex(types => types.includes(type));

test('World 5 follows World 4 with 17 stable, ordered lessons', () => {
  const world = WORLDS.find(entry => entry.id === '5');
  assert.equal(world.name, 'Feast Frontier');
  assert.deepEqual(WORLDS.find(entry => entry.id === '4').next, ['5']);
  assert.deepEqual(lessons.map(level => level.concept), concepts);
  assert.deepEqual(lessons.map(level => level.number), concepts.map((_, i) => `5-${i + 1}`));
  assert.deepEqual(lessons.map(level => level.id), concepts.map((_, i) => `1-${i + 75}`));
  const first = LEVELS.indexOf(lessons[0]);
  assert.equal(nextLevelIndex(first - 1), first);
  assert.equal(nextLevelIndex(LEVELS.length - 1), -1);
});

test('each lesson introduces exactly its concept, never a later one', () => {
  for (const [i, level] of lessons.entries()) {
    const types = [...level.events.map(event => event.type), ...(level.terrains ?? []).map(region => region.type)];
    const used = new Set(types.map(conceptIndex).filter(index => index >= 0));
    assert.ok(Math.max(...used) === i, `${level.number}: introduces concept ${i} last`);
    assert.ok(used.has(i), level.number);
  }
  for (const [i, type] of [[1, 'robo-trash-bin'], [8, 'robo-sharpshooter'], [10, 'robo-cat-lady'], [14, 'robo-moon']]) {
    assert.ok(lessons.slice(0, i).every(level => !level.events.some(event => event.type === type)));
  }
  assert.ok(lessons.every(level => !level.events.some(event => ['wheel', 'snake', 'robo-cow', 'robo-love-bug', 'robo-fly'].includes(event.type))));
});

test('scenes introduce Tom first, explain the lesson and only cast robots from that level', () => {
  assert.match(lessons[0].cutscene.lines[0].text, /Tom the Duck.+enemy.+conquer the world/);
  const seenEnemies = new Set();
  for (const level of lessons) {
    assert.deepEqual(validateCutscene(level.cutscene), level.cutscene);
    assert.equal(level.cutscene.theme, 'garden');
    const enemies = new Set(level.events.filter(event => event.kind === 'enemy').map(event => event.type));
    for (const line of level.cutscene.lines) for (const actor of line.actors) {
      assert.ok(['koshi', 'tom'].includes(actor.character) || enemies.has(actor.character), `${level.number}: ${actor.character}`);
    }
    for (const type of enemies) seenEnemies.add(type);
    const text = level.cutscene.lines.map(line => line.text).join(' ');
    assert.match(text, /world/i);
    assert.match(text, /food|snack|appetizer|takeout|chop suey|cheese|eggs|ice cream|dessert|noodle|sushi|fondue|latte|cupcake|popcorn|meatball|moon pie|shrimp|feast/i);
    for (const target of [level.goal, level.killGoal, level.goalsGoal, level.teamGoalsGoal].filter(Boolean)) {
      assert.ok(text.includes(String(target)), `${level.number}: states target ${target}`);
    }
    if (level.survive) assert.match(text, /survive for 110 seconds/);
  }
});

test('win conditions use food, enemy or soccer targets, a team race, or survival', () => {
  for (const level of lessons) {
    const targets = [level.goal, level.killGoal, level.goalsGoal, level.teamGoalsGoal].filter(Boolean).length;
    assert.ok(level.survive ? targets === 0 : targets >= 1, level.number);
  }
  assert.ok(lessons.filter(level => level.survive).length >= 3);
  for (const level of lessons) for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = arena(level, options);
    game.start();
    game.nextCustom = level.events.length;
    if (level.survive) {
      game.elapsed = level.duration - .02;
      game.update(.01);
      assert.equal(game.state, 'playing', level.number);
      game.update(.02);
    } else if (level.teamGoalsGoal) {
      game.teamEnemyGoals = level.teamGoalsGoal - 1;
      game.teamKoshiGoals = level.teamGoalsGoal - 1;
      game.update(.01);
      assert.equal(game.state, 'playing', level.number);
      game.teamKoshiGoals = level.teamGoalsGoal;
      game.teamRaceWinner = 'koshi';
      game.update(.01);
    } else {
      game.score = level.goal; game.enemies = level.killGoal; game.goals = level.goalsGoal;
      for (const [key, target] of [['score', level.goal], ['enemies', level.killGoal], ['goals', level.goalsGoal]]) {
        if (!target) continue;
        game[key]--;
        game.update(.01);
        assert.equal(game.state, 'playing', `${level.number}: must meet ${key}`);
        game[key]++;
      }
      game.update(.01);
    }
    assert.equal(game.state, 'won', level.number);
  }
});

test('layouts validate with mostly standard bricks, and returning mechanics stay within budget', () => {
  for (const [i, level] of lessons.entries()) {
    const validated = validateCustomLevel({ ...level, version: 1 });
    assert.deepEqual(validated.events, level.events);
    if (level.terrains) assert.deepEqual(validated.terrains, level.terrains);
    for (const options of [{}, { portrait: true, scale: .31 }]) {
      const game = arena(level, options), active = activeBricks(game);
      const sizes = active.map(owner => groupSize(game, owner));
      if (!['chisel', 'scrambler'].includes(level.concept)) {
        const doubles = sizes.filter(size => size === 2).length / sizes.length;
        const triples = sizes.filter(size => size === 3).length / sizes.length;
        assert.ok(doubles >= .1 && doubles <= .15, `${level.number}: double frequency`);
        assert.ok(triples >= .04 && triples <= .06, `${level.number}: triple frequency`);
      }
      assert.ok(sizes.filter(size => size === 1).length / sizes.length >= .75, level.number);
      const featured = new Set([...(level.concept === 'robo cat lady' ? ['slimed', 'spikes'] : []),
        ...(level.goalsGoal || level.teamGoalsGoal ? ['goal'] : []), ...(level.concept === 'scrambler' ? ['cinder'] : [])]);
      const returning = new Set(active.map(mechanic).filter(type => type && !featured.has(type)));
      assert.ok(returning.size >= 1 && returning.size <= 4, `${level.number}: ${[...returning]}`);
      assert.ok(active.every(brick => !brick.portal && brick.spawner == null), level.number);
      if (active.some(brick => brick.hazard?.power)) assert.ok(active.some(brick => brick.power), level.number);
      assert.deepEqual(game.customEvents, level.events);
    }
  }
});

test('special layouts provide the requested chisel, scrambler, soccer and cat lady setups', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const chisel = arena(lessons[3], options);
    const quads = activeBricks(chisel).filter(brick => groupSize(chisel, brick) === 4);
    assert.equal(quads.length, 3);
    assert.deepEqual(new Set(quads.map(brick => brick.kind)), new Set(['slow', 'normal', 'fast']));
    assert.ok(lessons[3].events.filter(event => event.type === 'chisel').length >= 3);

    const scrambler = arena(lessons[4], options);
    const cinder = activeBricks(scrambler).filter(brick => brick.kind === 'cinder');
    assert.deepEqual(cinder.map(brick => groupSize(scrambler, brick)), [5]);
    assert.ok(scrambler.brickVisible(cinder[0]));
    const firstScrambler = lessons[4].events.find(event => event.type === 'scrambler');
    assert.ok(firstScrambler.time <= 5);
    assert.ok(lessons[4].events.filter(event => event.type === 'scrambler').length >= 3);
    const shrunk = [0, .25, .99].map(roll => {
      const game = new Game(() => roll, { level: LEVELS.indexOf(lessons[4]), ...options });
      game.start();
      game.startScramblerEffect();
      game.applyScramblerEffect(game.scramblerEffect);
      return groupSize(game, activeBricks(game).find(brick => brick.kind === 'cinder'));
    });
    assert.ok(shrunk.some(size => size < 5), 'the Scrambler can move Cinder onto a smaller group');

    const team = arena(lessons[11], options);
    const goals = activeBricks(team).filter(brick => brick.kind === 'goal');
    assert.deepEqual(goals.map(brick => [brick.goalTeam, groupSize(team, brick)]).sort(), [['enemy', 2], ['koshi', 2]]);
    const catLady = arena(lessons[10], options);
    assert.ok(activeBricks(catLady).some(brick => brick.slimed));
    assert.ok(activeBricks(catLady).some(brick => brick.spikes));
  }
  const team = lessons[11];
  assert.equal(team.teamGoalsGoal, 7);
  assert.equal(team.autoscroll, undefined);
  const goalies = team.events.filter(event => event.type === 'goalie');
  assert.equal(goalies.length, 2);
  assert.notEqual(goalies[0].time, goalies[1].time);
  assert.ok(team.events.some(event => event.type === 'striker'));
  assert.ok(team.events.filter(event => event.type === 'soccer-ball').length >= 15);
  for (const level of lessons.slice(12, 14)) {
    assert.ok(level.goalsGoal > 0, level.number);
    assert.ok(level.events.filter(event => OBJECT_BALL.test(event.type)).length > level.goalsGoal * 2);
    assert.ok(activeBricks(arena(level)).some(brick => brick.kind === 'goal'));
  }
  assert.ok(lessons.every((level, i) => i === 11 || !level.events.some(event => event.type === 'striker')));
  assert.ok(lessons.every(level => level.goalsGoal || level.teamGoalsGoal
    || !level.events.some(event => event.type === 'goalie')));
});
const OBJECT_BALL = /^soccer-ball/;

test('terrain lessons place their equipment and leave every placement and start on safe ground', () => {
  assert.deepEqual(lessons.map(level => [...new Set((level.terrains ?? []).map(region => region.type))].join()),
    ['', '', '', '', '', 'ice', 'ice', '', '', 'lava', '', '', '', '', '', 'water', 'water']);
  assert.ok(lessons[6].events.some(event => event.type.startsWith('ice-skate-')));
  assert.ok(lessons[16].events.some(event => event.type.startsWith('surf-board-')));
  for (const level of lessons.filter(entry => entry.terrains)) for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = arena(level, options);
    assert.equal(game.terrains.length, level.terrains.length);
    assert.equal(game.terrainAt(game.cat.x, game.cat.y), null, level.number);
    for (const event of level.events) for (const point of game.customEventPoints(event)) {
      assert.equal(game.terrainAt(point.x, point.y), null, `${level.number}: ${event.type}`);
    }
  }
});

test('each lesson adds one or two previously introduced pickup or object types', () => {
  for (const [i, level] of lessons.entries()) {
    const equipment = new Set(introductions[i]);
    const returning = new Set(level.events
      .filter(event => ['object', 'item'].includes(event.kind) && !OBJECT_BALL.test(event.type) && !equipment.has(event.type))
      .map(event => event.type));
    assert.ok(returning.size >= 1 && returning.size <= 2, `${level.number}: ${[...returning]}`);
    for (const type of returning) {
      const index = conceptIndex(type);
      assert.ok(index < i, `${level.number}: ${type} introduced already`);
    }
  }
});

test('all food yields at most five hearts, and shields are rare with stronger shields rarer', () => {
  const totals = { red: 0, green: 0, blue: 0 };
  let enemies = 0;
  for (const level of lessons) {
    const foodPoints = level.events.filter(event => event.kind === 'food')
      .reduce((sum, event) => sum + FOODS[event.type].value, 0);
    assert.ok(foodPoints > level.goal);
    assert.ok(Math.floor(foodPoints / level.heartCost) <= 5, level.number);
    const game = arena(level);
    game.start();
    game.score = foodPoints;
    game.update(.01);
    assert.ok([...game.pendingSpawns.values()].filter(spawn => spawn.kind === 'heart').length <= 5);
    const placed = level.events.filter(event => event.kind === 'enemy');
    const points = placed.reduce((sum, event) => sum + game.createCustomSpawn(event)[0].defeatPoints, 0);
    assert.ok(points >= level.killGoal, level.number);
    enemies += placed.length;
    for (const event of placed.filter(entry => entry.shield)) totals[event.shield]++;
  }
  assert.ok((totals.red + totals.green + totals.blue) / enemies <= .15);
  assert.ok(totals.red > totals.green && totals.green > totals.blue && totals.blue > 0);
});

test('about a quarter of eligible lessons autoscroll, keeping every timed spawn on screen', () => {
  const scrolling = lessons.filter(level => level.autoscroll);
  assert.deepEqual(scrolling.map(level => level.number), ['5-2', '5-3', '5-11', '5-13']);
  assert.equal(scrolling.length / (lessons.length - 1), .25);
  for (const level of scrolling) for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = arena(level, options);
    for (const event of level.events) {
      const camera = game.camera(event.time);
      for (const point of game.customEventPoints(event)) {
        assert.ok(point.x >= camera.x && point.x <= camera.x + camera.width, `${level.number}: ${event.type} x`);
        assert.ok(point.y >= camera.y && point.y <= camera.y + camera.height, `${level.number}: ${event.type} y`);
      }
    }
  }
});
