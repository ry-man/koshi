const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS: CAMPAIGN, FOODS, SHIELDS, SWORDS, CONTACT_SURFACES, validateCustomLevel, portalPairIssues } = require('../src/game.js');
const { SaveSlots, SAVE_KEY } = require('../src/saves.js');
const LEVELS = CAMPAIGN.slice(0, 19);

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
  assert.throws(() => new Game(Math.random, { level: CAMPAIGN.length }), RangeError);
});

test('new brick introductions feature three non-corner instances and 75% of larger bricks', () => {
  const attributes = {
    crumblers: 'crumbler', slime: 'slimed', spikes: 'spikes', springs: 'springs',
    conveyers: 'conveyor', 'warped bricks': 'warped', boost: 'boost',
    spawners: 'spawner', cinder: 'kind', toggles: 'toggle', portals: 'portal',
  };
  for (const [index, level] of LEVELS.entries()) {
    const attribute = attributes[level.concept];
    if (!attribute) continue;
    for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
      const game = new Game(() => .5, { level: index, ...options });
      const matches = brick => attribute === 'kind' ? brick.kind === 'cinder' : Boolean(brick[attribute]);
      const introduced = activeBricks(game).filter(matches);
      assert.ok(introduced.length >= 3, `${level.id}: at least three independent instances`);
      for (const owner of introduced) {
        const parts = game.bricks.filter(brick => brick.id === owner.id || brick.absorbedBy === owner.id);
        assert.ok(parts.every(brick => brick.region.start > 0 && brick.region.end < 1), `${level.id}: no corner segments`);
      }
      const larger = activeBricks(game).filter(owner => game.bricks.some(brick => brick.absorbedBy === owner.id));
      assert.equal(larger.length, 4);
      assert.equal(larger.filter(matches).length, 3, `${level.id}: exactly 75% of larger blocks use the new feature`);
      if (attribute === 'portal') {
        assert.equal(introduced.length, 4);
        const pairs = new Map();
        for (const brick of introduced) pairs.set(brick.portal, (pairs.get(brick.portal) ?? 0) + 1);
        assert.deepEqual([...pairs.values()], [2, 2]);
      }
    }
  }
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
        brick.region.edge === entry.edge && brick.region.start === entry.start && brick.region.end === entry.end)
        || game.bricks.some(brick => brick.kind === 'cinder' && brick.absorbedBy !== null
          && brick.region.edge === entry.edge && brick.region.start === entry.start && brick.region.end === entry.end
          && game.bricks[brick.absorbedBy].kind === 'cinder')), `${level.id}: hidden special`);
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

test('goals are attainable, schedules ordered, shields escalate, and all food generates at most five hearts', () => {
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
    if (index < 6) assert.equal(shieldedCount, 0, `${level.id}: shields not introduced`);
    else assert.ok(shieldedCount / enemyCount >= .35 && shieldedCount / enemyCount <= .65, `${level.id}: shield pressure`);
    for (const timeline of [level.food, level.enemies, level.weapons]) {
      assert.ok(timeline.every(([time], i) => time >= 0 && time < level.duration && (!i || time >= timeline[i - 1][0])), level.id);
    }
    if (index >= 2 && level.concept !== 'boost') {
      assert.ok(level.weapons[0][0] >= level.enemies[0][0] + 10, `${level.id}: dodge before swords`);
      if (!shieldedCount || !level.killGoal) {
        assert.ok(level.weapons.length <= (index === 2 ? 4 : level.killGoal ? 2 : 1), `${level.id}: introductory sword supply`);
      }
      const mainWeapons = index >= 10 && level.killGoal > 0 ? level.weapons.filter(([, type]) => type !== 'bronze') : level.weapons;
      assert.ok(mainWeapons.every(([time], i) => !i || time - mainWeapons[i - 1][0] >= 16), `${level.id}: space out main swords`);
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

test('shielded enemy objectives have spare attack capacity and timely replacement swords', () => {
  for (const level of LEVELS) {
    if (!level.killGoal || level.concept === 'boost' || !level.enemies.some(([, , , shield]) => shield)) continue;
    const unfinished = Math.max(...level.enemies.map(([, , , shield]) => (SHIELDS[shield]?.hits ?? 1) - 1));
    const minimum = level.killGoal + Math.max(5, Math.ceil(level.killGoal / 2)) + unfinished;
    const mainWeapons = level.weapons.filter(([, type]) => type !== 'bronze');
    const attacks = mainWeapons.reduce((sum, [, type]) => sum + (SWORDS[type].uses ?? 0), 0);
    assert.ok(attacks >= minimum, `${level.id}: target plus spare sword and unfinished shield damage`);
    assert.ok(attacks < minimum + SWORDS.silver.uses * (level.id === '1-17' ? 2 : 1), `${level.id}: bounded reserve including the Cinder extra sword`);
    assert.ok(level.weapons.at(-1)[0] <= level.duration - 25, `${level.id}: time to use the reserve`);
    const earlyAttacks = level.weapons.filter(([time]) => time <= level.duration * .65)
      .reduce((sum, [, type]) => sum + SWORDS[type].uses, 0);
    assert.ok(earlyAttacks >= level.killGoal, `${level.id}: enough attacks before the final third`);
  }
  assert.deepEqual(LEVELS[10].weapons.filter(([, type]) => type === 'silver'), [[24, 'silver'], [60, 'silver'], [95, 'silver']]);
  assert.deepEqual(LEVELS[11].weapons.filter(([, type]) => type === 'silver'), [[24, 'silver'], [48, 'silver'], [71, 'silver'], [95, 'silver']]);
});

test('enemy-goal levels after level 10 without boost bricks supply a pair of spare bronze swords', () => {
  const qualifying = [];
  for (const [index, level] of LEVELS.entries()) {
    const eligible = index >= 10 && level.killGoal > 0 && !level.brickTypes.some(brick => brick.boost);
    if (!eligible) {
      if (index >= 10) assert.equal(level.weapons.filter(([, type]) => type === 'bronze').length, level.survive ? 1 : 0);
      continue;
    }
    qualifying.push(level.id);
    assert.deepEqual(level.weapons.filter(([, type]) => type === 'bronze'), [[40, 'bronze'], [80, 'bronze']]);
    for (const options of [{}, { portrait: true, scale: .31 }]) {
      const game = new Game(() => .5, { level: index, ...options });
      game.start();
      game.cat.x = 22; game.cat.y = 22;
      game.update(80);
      const bronze = game.weapons.filter(item => item.type === 'bronze');
      assert.equal(bronze.length, 2, `${level.id}: both pickups spawn`);
      const bounds = game.bounds();
      for (const sword of bronze) {
        assert.ok(sword.x >= bounds.left && sword.x <= bounds.right);
        assert.ok(sword.y >= bounds.top && sword.y <= bounds.bottom);
      }
    }
  }
  assert.deepEqual(qualifying, ['1-11', '1-12', '1-13']);
});

test('targeted difficulty relief improves Springs and Cinder weapon supply and gives Boost more time', () => {
  assert.deepEqual(LEVELS[9].weapons, [[28, 'silver']]);
  assert.equal(LEVELS[9].goal, 40);
  assert.deepEqual(LEVELS[16].weapons, [[24, 'silver'], [48, 'silver'], [65, 'silver'], [82, 'silver'], [105, 'silver']]);
  assert.equal(LEVELS[16].weapons.reduce((sum, [, type]) => sum + SWORDS[type].uses, 0), 25);
  assert.equal(LEVELS[16].killGoal, 12);
  assert.equal(LEVELS[13].duration, 140);
  assert.equal(LEVELS[13].killGoal, 12);
  assert.deepEqual(LEVELS[13].weapons, []);
});

test('the Boost introduction requires boost defeats and supplies no weapons', () => {
  const index = LEVELS.findIndex(level => level.concept === 'boost');
  const level = LEVELS[index];
  assert.deepEqual(level.weapons, []);
  assert.ok(level.killGoal > 0);
  assert.ok(level.brickTypes.some(brick => brick.boost));
  assert.ok(level.brickTypes.every(brick => brick.spawner?.kind !== 'weapon'));
  assert.match(level.cutscene.lines.map(line => line.text).join(' '), /No swords here/);
  const game = new Game(() => .5, { level: index });
  game.start();
  game.cat.x = 22; game.cat.y = 22;
  game.update(level.duration);
  assert.equal(game.weapons.length, 0);
  assert.equal(game.weapon, null);
  assert.ok(game.spawnCues.every(cue => cue.kind !== 'weapon'));
});

test('enemy pressure increases without advancing enemy or shield introductions', () => {
  const previousCounts = [0, 3, 8, 6, 6, 6, 10, 5, 8, 7, 9, 10, 10, 11, 9, 6, 11, 13, 21];
  for (const [index, level] of LEVELS.entries()) {
    const count = level.enemies.reduce((sum, [, , count]) => sum + count, 0);
    if (index === 0) assert.equal(count, 0);
    else assert.ok(count >= previousCounts[index] * 1.25, `${level.id}: larger waves`);
    for (const [, , , shield] of level.enemies) {
      if (shield === 'green') assert.ok(index >= 11, `${level.id}: green introduced in 1-12`);
      if (shield === 'blue') assert.ok(index >= 17, `${level.id}: blue introduced in 1-18`);
    }
  }
  const shieldHitsPerRobot = levels => {
    let hits = 0, robots = 0;
    for (const level of levels) for (const [, , count, shield] of level.enemies) {
      hits += count * (shield ? SHIELDS[shield].hits : 1);
      robots += count;
    }
    return hits / robots;
  };
  assert.ok(shieldHitsPerRobot(LEVELS.slice(11)) > shieldHitsPerRobot(LEVELS.slice(6, 11)));
  assert.ok(LEVELS[17].enemies.some(([, , count, shield]) => shield === 'blue' && count >= 3));
  assert.ok(LEVELS[18].enemies.some(([, , count, shield]) => shield === 'blue' && count >= 3));
});

test('both final-level portal exits clear every wall in desktop and portrait', () => {
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
    const game = new Game(() => .5, { level: LEVELS.length - 1, ...options });
    game.start();
    const portals = game.bricks.filter(brick => brick.portal && brick.absorbedBy === null);
    assert.equal(portals.length, 4);
    const parts = game.brickParts();
    for (const destination of portals) {
      const source = portals.find(brick => brick !== destination && brick.portal === destination.portal);
      game.portalUntil = 0; game.portalArrival = null;
      assert.equal(game.travelPortal(source, parts), true);
      assert.ok(!parts.some(part => game.touchingPart(part)), 'Koshi emerges clear of all walls');
      const exit = { x: game.cat.x, y: game.cat.y };
      game.update(.05);
      assert.ok(Math.hypot(game.cat.x - exit.x, game.cat.y - exit.y) > 10, 'Koshi moves into the arena instead of sticking');
    }
  }
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
