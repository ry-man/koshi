const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { LEVEL_DATA, LEVELS } = require('../src/game.js');
const { WORLDS, assembleCampaign } = require('../src/campaign.js');
const { worldLevels, nextLevelIndex } = require('../src/worlds.js');
const { SaveSlots } = require('../src/saves.js');

test('named level data contains no world assignments and resolves entirely through world mappings', () => {
  assert.equal(Object.keys(LEVEL_DATA).length, 61);
  assert.deepEqual(assembleCampaign(LEVEL_DATA), LEVELS);
  for (const [name, data] of Object.entries(LEVEL_DATA)) {
    assert.equal(data.name, name);
    assert.equal(Object.hasOwn(data, 'worldId'), false);
    assert.equal(Object.hasOwn(data, 'number'), false);
    const assigned = LEVELS.find(level => level.id === data.id);
    const { worldId, number, ...content } = assigned;
    assert.deepEqual(content, data);
    assert.equal(WORLDS.find(world => world.id === worldId).levels[number], name);
  }
});

test('moving and renumbering a named level changes only its world placement, not content or save identity', () => {
  const before = JSON.stringify(LEVEL_DATA);
  const worlds = structuredClone(WORLDS);
  delete worlds[0].levels['1-10'];
  worlds[3].levels = { '3S-0': 'Pancake trampoline', ...worlds[3].levels };
  const levels = assembleCampaign(LEVEL_DATA, worlds);
  const moved = levels.find(level => level.name === 'Pancake trampoline');
  const { worldId, number, ...content } = moved;
  assert.equal(worldId, '3S');
  assert.equal(number, '3S-0');
  assert.equal(moved.id, '1-10');
  assert.deepEqual(content, LEVEL_DATA['Pancake trampoline']);
  assert.equal(worldLevels(worlds[0], levels).length, 9);
  assert.equal(worldLevels(worlds[3], levels)[0], moved);
  assert.equal(levels[nextLevelIndex(8, worlds, levels)].name, 'Sushi assembly line');
  assert.equal(levels[nextLevelIndex(levels.indexOf(moved), worlds, levels)].name, 'Goalie gauntlet');
  assert.equal(JSON.stringify(LEVEL_DATA), before);

  const stored = new Map();
  const storage = () => ({
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  });
  const originalSaves = new SaveSlots(LEVELS.map(level => level.id), storage, () => 'player');
  const slot = originalSaves.create(0, 'Player');
  originalSaves.record(0, slot.id, 'win', {
    levelId: moved.id, outcome: 'won', time: 30, food: 40, enemy: 1, damageFree: true, catBlock: true,
  });
  originalSaves.visit(0, slot.id, moved.id);
  const saves = new SaveSlots(levels.map(level => level.id), storage);
  const profile = saves.load()[0];
  assert.deepEqual(profile.completed, [moved.id]);
  assert.deepEqual(profile.catBlocks, [moved.id]);
  assert.equal(profile.results.win.damageFree, true);
  assert.equal(saves.resumeLevel(profile), levels.indexOf(moved));
});

test('campaign order is independent of catalog order and unused level data stays unassigned', () => {
  const reversed = Object.fromEntries(Object.entries(LEVEL_DATA).reverse());
  assert.deepEqual(assembleCampaign(reversed), LEVELS);
  const worlds = [{ id: 'bonus', next: [], levels: { 'bonus-7': 'Copycat showdown', 'bonus-2': 'Breakfast rebellion' } }];
  const levels = assembleCampaign(LEVEL_DATA, worlds);
  assert.deepEqual(levels.map(level => level.name), ['Copycat showdown', 'Breakfast rebellion']);
  assert.deepEqual(levels.map(level => level.number), ['bonus-7', 'bonus-2']);
  assert.equal(nextLevelIndex(0, worlds, levels), 1);
  assert.equal(nextLevelIndex(1, worlds, levels), -1);
});

test('invalid world mappings report missing data, duplicate identities and invalid routes', () => {
  const world = { id: 'bonus', next: [], levels: { 'bonus-1': 'Breakfast rebellion' } };
  assert.throws(() => assembleCampaign(LEVEL_DATA, [{ ...world, levels: { 'bonus-1': 'Missing level' } }]), /Unknown level data/);
  assert.throws(() => assembleCampaign(LEVEL_DATA, [{ ...world, levels: {
    'bonus-1': 'Breakfast rebellion', 'bonus-2': 'Breakfast rebellion',
  } }]), /assigned more than once/);
  assert.throws(() => assembleCampaign(LEVEL_DATA, [world, { ...world, id: 'other' }]), /duplicate level number/);
  assert.throws(() => assembleCampaign(LEVEL_DATA, [world, world]), /duplicate world ID/);
  assert.throws(() => assembleCampaign(LEVEL_DATA, [{ ...world, next: ['missing'] }]), /Invalid world destination/);
  assert.throws(() => assembleCampaign(LEVEL_DATA, [{ ...world, levels: [] }]), /map level numbers/);
  assert.throws(() => assembleCampaign({ 'Breakfast rebellion': { name: 'Breakfast rebellion' } }, [world]),
    /Invalid named level data/);
});

test('browser engine uses the supplied world mappings and both entry points load them before game data', () => {
  const root = path.join(__dirname, '..');
  for (const file of ['index.html', 'editor.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(html.indexOf('src="./src/campaign.js"') < html.indexOf('src="./src/game.js"'));
    assert.ok(html.includes('src="./src/campaign.js"'));
  }
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(sw.includes("'./src/campaign.js'"));
  const worlds = [{ id: 'bonus', next: [], levels: { 'bonus-1': 'Pancake trampoline' } }];
  const context = vm.createContext({ KoshiCampaign: {
    assembleCampaign: data => assembleCampaign(data, worlds),
  } });
  vm.runInContext(fs.readFileSync(path.join(root, 'src', 'game.js'), 'utf8'), context);
  const game = new context.KoshiGame.Game();
  assert.equal(game.level.id, '1-10');
  assert.equal(game.level.name, 'Pancake trampoline');
  assert.equal(game.level.number, 'bonus-1');
  assert.equal(game.level.worldId, 'bonus');
  assert.equal(JSON.stringify(game.level.brickTypes), JSON.stringify(LEVEL_DATA['Pancake trampoline'].brickTypes));
});
