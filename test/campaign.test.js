const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, FOODS, SHIELDS, SWORDS, CONTACT_SURFACES, validateCustomLevel, portalPairIssues } = require('../src/game.js');
const { SaveSlots, SAVE_KEY } = require('../src/saves.js');

const concepts = [
  'normal bricks', 'robo mouse', 'swords', 'hearts and heart cost', 'crumblers',
  'slime', 'enemy shields', 'spikes', 'robo wheels', 'springs', 'conveyers',
  'warped bricks', 'robo rams', 'boost', 'spawners', 'robo buckets', 'cinder',
  'toggles', 'portals',
];
const foodTotal = level => level.food.reduce((sum, [, method, type]) =>
  sum + (method === 'S' ? 1 : Number(method.slice(1))) * FOODS[type].value, 0)
  + level.brickTypes.reduce((sum, brick) => sum + (brick.spawner?.kind === 'food' ? FOODS[brick.spawner.type].value : 0), 0);
const activeBricks = game => game.bricks.filter(brick => brick.absorbedBy === null);
const style = brick => JSON.stringify([
  brick.kind, brick.crumbler, brick.warped, brick.toggle,
  ...CONTACT_SURFACES.map(key => brick[key] || null),
  brick.slimed ? brick.slimeColor : null, brick.conveyor ? brick.conveyorDirection ?? 'clockwise' : null,
]);

test('the replacement campaign introduces exactly one concept in the requested order', () => {
  assert.deepEqual(LEVELS.map(level => level.concept), concepts);
  assert.deepEqual(LEVELS.map(level => level.id), concepts.map((_, index) => `1-${index + 1}`));
  const seen = new Set();
  for (const [index, level] of LEVELS.entries()) {
    const game = new Game(() => .5, { level: index });
    const features = new Set(['normal bricks']);
    for (const [, type, , shield] of level.enemies) {
      features.add({ mouse: 'robo mouse', wheel: 'robo wheels', ram: 'robo rams', bucket: 'robo buckets' }[type]);
      if (shield) features.add('enemy shields');
    }
    if (level.weapons.length) features.add('swords');
    if (Number.isFinite(level.heartCost)) features.add('hearts and heart cost');
    for (const brick of activeBricks(game)) {
      for (const [attribute, concept] of Object.entries({
        crumbler: 'crumblers', slimed: 'slime', spikes: 'spikes', springs: 'springs',
        conveyor: 'conveyers', warped: 'warped bricks', boost: 'boost', spawner: 'spawners',
        toggle: 'toggles', portal: 'portals',
      })) if (brick[attribute]) features.add(concept);
      if (brick.kind === 'cinder') features.add('cinder');
    }
    assert.deepEqual([...features].filter(feature => !seen.has(feature)), [concepts[index]], level.id);
    for (const feature of features) seen.add(feature);
    const enemies = new Set(level.enemies.map(([, type]) => type));
    for (const line of level.cutscene.lines) {
      for (const actor of line.actors) {
        assert.ok(['koshi', 'tom'].includes(actor.character) || enemies.has(actor.character), `${level.id}: ${actor.character}`);
      }
    }
    assert.ok(level.cutscene.lines.some(line => line.speaker === 'koshi'));
    assert.match(level.cutscene.lines.map(line => line.text).join(' '), /food|meal|breakfast|banana|cheese|lunch|picnic|supper|pretzel|burger|bread/i);
  }
  assert.match(LEVELS[0].cutscene.lines[0].text, /Tom the Duck/);
  assert.throws(() => new Game(Math.random, { level: LEVELS.length }), RangeError);
});

test('campaign layouts use few styles and exact infrequent double/triple block ratios in both orientations', () => {
  for (const [index, level] of LEVELS.entries()) {
    validateCustomLevel({ ...level, version: 1, heartCost: Number.isFinite(level.heartCost) ? level.heartCost : null, events: [] });
    for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
      const game = new Game(() => .5, { level: index, ...options });
      const bricks = activeBricks(game);
      assert.equal(game.bricks.length, 26);
      assert.equal(bricks.length, 21);
      for (const kind of ['slow', 'normal', 'fast']) assert.ok(bricks.some(brick => brick.kind === kind), `${level.id}: missing ${kind}`);
      assert.ok(new Set(bricks.map(style)).size <= 6, `${level.id}: too many styles`);
      assert.ok(level.brickTypes.every(entry => bricks.some(brick =>
        brick.region.edge === entry.edge && brick.region.start === entry.start && brick.region.end === entry.end)), `${level.id}: hidden special`);
      const sizes = bricks.map(brick => 1 + game.bricks.filter(part => part.absorbedBy === brick.id).length);
      const frequency = size => sizes.filter(value => value === size).length / sizes.length;
      assert.ok(frequency(1) >= .8);
      assert.ok(frequency(2) >= .1 && frequency(2) <= .15);
      assert.ok(frequency(3) >= .04 && frequency(3) <= .06);
      assert.deepEqual(portalPairIssues(game.bricks), []);
      assert.ok(bricks.some(brick => brick.kind !== 'cinder' && !brick.toggle && !brick.crumbler && !brick.spikes));
      const initial = structuredClone(game.bricks);
      game.start();
      const brick = bricks.find(brick => !brick.toggle && brick.kind !== 'cinder');
      game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2);
      game.reset();
      assert.deepEqual(game.bricks, initial);
    }
  }
});

test('goals are attainable, schedules ordered, shields rare, and all food generates at most five hearts', () => {
  const shields = { red: 0, green: 0, blue: 0 };
  const objectives = new Set();
  for (const [index, level] of LEVELS.entries()) {
    objectives.add(level.survive ? 'survival' : level.goal && level.killGoal ? 'both' : level.goal ? 'food' : 'enemies');
    assert.ok(foodTotal(level) >= level.goal * 1.4, level.id);
    let enemyPoints = 0, enemyCount = 0, shieldedCount = 0;
    for (const [, , count, shield] of level.enemies) {
      enemyCount += count;
      enemyPoints += count * (shield ? SHIELDS[shield].hits : 1);
      if (shield) { shields[shield] += count; shieldedCount += count; }
    }
    assert.ok(enemyPoints >= level.killGoal, level.id);
    assert.ok(!enemyCount || shieldedCount / enemyCount <= .2, `${level.id}: too many shields`);
    for (const timeline of [level.food, level.enemies, level.weapons]) {
      assert.ok(timeline.every(([time], i) => time >= 0 && time < level.duration && (!i || time >= timeline[i - 1][0])), level.id);
    }
    if (index >= 2) {
      assert.ok(level.weapons[0][0] < level.enemies[0][0]);
      assert.ok(level.weapons.reduce((sum, [, type]) => sum + (SWORDS[type].uses ?? 0), 0) >= level.killGoal);
    }
    const game = new Game(() => .5, { level: index });
    game.start();
    game.score = foodTotal(level);
    game.update(.01);
    const generated = game.healing.length + game.spawnCues.filter(cue => cue.kind === 'heart').length;
    assert.equal(generated, Math.floor(foodTotal(level) / level.heartCost));
    assert.ok(generated <= 5);
    assert.equal(Number.isFinite(level.heartCost), index >= 3);
  }
  assert.deepEqual([...objectives].sort(), ['both', 'enemies', 'food', 'survival']);
  assert.ok(shields.red > shields.green && shields.green > shields.blue);
});

test('survival never wins early, food-only and enemy-only use only their own target', () => {
  for (const [index, level] of LEVELS.entries()) {
    if (level.goal && level.killGoal) continue;
    const game = new Game(() => .5, { level: index });
    game.start();
    game.nextEvent = level.food.length;
    game.nextEnemy = level.enemies.length;
    game.nextWeapon = level.weapons.length;
    if (level.survive) {
      game.score = 1000; game.enemies = 1000;
      game.elapsed = level.duration - .02;
      game.update(.01);
      assert.equal(game.state, 'playing');
      game.update(.02);
      assert.equal(game.state, 'won');
      const dead = new Game(() => .5, { level: index });
      dead.start(); dead.hearts = 0; dead.elapsed = level.duration - .01;
      dead.update(.02);
      assert.equal(dead.state, 'lost');
    } else {
      game.score = level.goal;
      game.enemies = level.killGoal;
      game.update(.01);
      assert.equal(game.state, 'won');
    }
  }
});

test('old campaign completions cannot skip the replacement lessons and old saves remain untouched', () => {
  const old = JSON.stringify({ version: 1, slots: [{ id: 'old', owner: 'Player', completed: ['1-1','1-2','1-3','1-4','1-5'] }, null, null] });
  const data = new Map([['koshi-campaign-saves-v1', old]]);
  const saves = new SaveSlots(LEVELS.map(level => level.id), () => ({
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value),
  }), () => 'new');
  assert.notEqual(SAVE_KEY, 'koshi-campaign-saves-v1');
  assert.deepEqual(saves.load(), [null, null, null]);
  const slot = saves.create(0, 'Player');
  assert.equal(saves.nextLevel(slot), 0);
  assert.equal(data.get('koshi-campaign-saves-v1'), old);
});
