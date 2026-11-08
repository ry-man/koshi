'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mode = require('../src/campaign-mode.js');
const { SaveSlots, SAVE_KEY, RECENT_KEY, levelStats } = require('../src/saves.js');
const engine = require('../src/game.js');
const authored = require('../src/official-levels.generated.js');
const authoredWorlds = new Set(authored.map(entry => entry.worldId));
const officialCount = authored.length + 17 - authoredWorlds.size;
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('game selection is available only on the title screen', () => {
  const html = read('index.html');
  const title = html.slice(html.indexOf('<dialog id="title-screen"'), html.indexOf('<dialog id="level-picker"'));
  assert.equal((html.match(/data-campaign-select/g) ?? []).length, 1);
  assert.match(title, /data-campaign-select/);
  assert.doesNotMatch(read('editor.html'), /data-campaign-select/);
});

test('title notice preserves spacing in both games and startup hides the unfinished gameplay surface', () => {
  const css = read('style.css');
  const html = read('index.html');
  assert.match(css, /#campaign-empty\[hidden\]\s*\{[^}]*display:\s*block;[^}]*visibility:\s*hidden;/);
  assert.match(css, /#campaign-empty\s*\{[^}]*margin:\s*16px 0;/);
  assert.match(html, /<body class="game-loading">/);
  assert.match(css, /\.game-loading main\s*\{[^}]*visibility:\s*hidden;/);
  const app = read('src/app.js');
  assert.ok(app.indexOf("document.body.classList.remove('game-loading')") > app.lastIndexOf('titleScreen.showModal()'));
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[^\n]*animation: none;/);
});

test('Official title shows the unchanged Beta recommendation even when Official has levels', () => {
  const html = read('index.html');
  assert.match(html, /<p id="campaign-empty" hidden>Official game under construction\. Beta game recommended for playtesting at this time\.<\/p>/);
  const app = read('src/app.js');
  const assignment = app.match(/document\.querySelector\('#campaign-empty'\)\.hidden = [^;]+;/);
  assert.ok(assignment);
  for (const [campaignId, expected] of [['official', false], ['beta', true]]) {
    const notice = { hidden: null };
    const document = { querySelector: selector => {
      assert.equal(selector, '#campaign-empty');
      return notice;
    } };
    vm.runInNewContext(assignment[0], { document, campaignId, LEVELS: [{}] });
    assert.equal(notice.hidden, expected, campaignId);
  }
});

function storageFixture() {
  const data = new Map();
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test('Official world color accents stay outside board artwork and at menu edges', () => {
  const css = read('style.css');
  const board = css.match(/\.game-shell\[data-world-theme="official"\] \.board\s*\{([^}]*)\}/)[1];
  assert.match(board, /border-color: var\(--console-color\)/);
  assert.match(board, /box-shadow: 0 0 0 3px/);
  assert.doesNotMatch(board, /inset|background|filter|opacity/);
  assert.match(css, /\.game-shell\[data-world-theme="official"\] \.objective\s*\{[^}]*background-color:[^}]*8%[^}]*box-shadow: inset 0 -3px 0 var\(--console-color\)/);
  assert.match(css, /\.game-shell\[data-world-theme="official"\]\s*\{[^}]*--console-color: color-mix\(in srgb, var\(--level-world-color\) 78%, #111a22\)/);
});

function browserFixture({ search = '?game=official', hash = '', storage = storageFixture() } = {}) {
  const errors = [];
  const location = { search, hash, href: `https://example.test/koshi/index.html${search}${hash}` };
  const context = vm.createContext({
    location, localStorage: storage, URL, URLSearchParams,
    console: { error: (...args) => errors.push(args) },
  });
  vm.runInContext(read('src/campaign-mode.js'), context);
  vm.runInContext(read('src/official-levels.generated.js'), context);
  vm.runInContext(read('src/campaign.js'), context);
  vm.runInContext(read('src/game.js'), context);
  return { context, storage, location, errors };
}

test('selection defaults to Beta regardless of the previously selected game and honors explicit links', () => {
  const storage = storageFixture();
  const resolve = (search = '', hash = '') => mode.resolveCampaign(search, hash, () => storage).id;
  assert.equal(resolve(), 'beta');
  storage.setItem(mode.ACTIVE_KEY, 'official');
  assert.equal(resolve(), 'beta');
  assert.equal(resolve('', '#campaign=1-1'), 'beta');
  assert.equal(resolve('?game=official', '#campaign=1-1'), 'official');
  assert.equal(resolve('?game=beta', '#level=snapshot'), 'beta');
  assert.throws(() => resolve('?game=missing'), /Unknown game/);
  storage.setItem(mode.ACTIVE_KEY, 'missing');
  assert.equal(resolve(), 'beta');
});

test('campaign storage preserves legacy Beta keys and isolates all Official progress', () => {
  assert.equal(mode.storageKey('saves'), SAVE_KEY);
  assert.equal(mode.storageKey('recent'), RECENT_KEY);
  assert.equal(mode.storageKey('draft'), 'koshi-level-editor-v1');
  assert.equal(mode.cutsceneKey('1-1', 'beta', 'slot-a'), 'koshi-beta-cutscene-viewed:slot-a:1-1');
  for (const kind of ['saves', 'recent', 'draft', 'selection']) {
    assert.notEqual(mode.storageKey(kind, 'beta'), mode.storageKey(kind, 'official'));
  }
  assert.notEqual(mode.cutsceneKey('1-1', 'beta', 'slot-a'), mode.cutsceneKey('1-1', 'official', 'slot-a'));
  assert.notEqual(mode.cutsceneKey('1-1', 'beta', 'slot-a'), mode.cutsceneKey('1-1', 'beta', 'slot-b'));
  assert.throws(() => mode.cutsceneKey('1-1'), /save slot/);
  assert.throws(() => mode.storageKey('saves', 'missing'), /Unknown game/);
  assert.equal(mode.gameURL('./index.html', '#campaign=1-1', 'official'), './index.html?game=official#campaign=1-1');
});

test('game startup restores the selected level by stable ID without overriding explicit campaign links', () => {
  const source = read('src/app.js');
  const startup = source.slice(source.indexOf("if (location.hash.startsWith('#level='))"), source.indexOf('function layoutOptions()'));
  const storage = storageFixture();
  storage.setItem(mode.storageKey('selection', 'beta'), engine.LEVELS[61].id);
  const context = vm.createContext({
    location: { hash: '' }, campaignMode: mode, campaignId: 'beta', localStorage: storage,
    LEVELS: engine.LEVELS, customLevel: null, levelSelect: { value: '0' },
    console, reportCampaignError: error => { throw error; },
  });
  vm.runInContext(startup, context);
  assert.equal(context.levelSelect.value, '61');
  context.location.hash = '#campaign=1-1';
  vm.runInContext(startup, context);
  assert.equal(context.levelSelect.value, '0', 'explicit deep link wins over remembered map selection');
});

test('matching future level IDs never mix saves, statistics, collectibles, or recent slots', () => {
  const storage = storageFixture();
  const ids = ['same-id'];
  const beta = new SaveSlots(ids, () => storage, () => 'beta-profile', ids, 'beta');
  const official = new SaveSlots(ids, () => storage, () => 'official-profile', ids, 'official');
  const betaSlot = beta.create(0, 'Beta player');
  const betaResult = { levelId: ids[0], outcome: 'won', time: 10, food: 20, enemy: 1, catBlock: true, damageFree: true };
  beta.record(0, betaSlot.id, 'beta-attempt', betaResult);
  beta.visit(0, betaSlot.id, ids[0]);
  beta.markRecent(0, betaSlot.id);
  const betaSnapshot = storage.getItem(SAVE_KEY);
  assert.deepEqual(official.load(), [null, null, null]);
  const officialSlot = official.create(1, 'Official player');
  official.record(1, officialSlot.id, 'official-attempt', { ...betaResult, outcome: 'lost', catBlock: undefined, damageFree: false });
  official.markRecent(1, officialSlot.id);
  assert.equal(beta.recent().slot.owner, 'Beta player');
  assert.equal(official.recent().slot.owner, 'Official player');
  assert.equal(levelStats(official.load()[1].results, ids[0]).goldStar, false);
  assert.deepEqual(official.load()[1].completed, []);
  assert.equal(official.load()[1].catBlocks, undefined);
  official.remove(1, officialSlot.id);
  assert.equal(storage.getItem(SAVE_KEY), betaSnapshot);
  assert.equal(storage.getItem(RECENT_KEY), betaSlot.id);
});

test('Official can keep profiles before content exists without treating Beta saves as invalid', () => {
  const storage = storageFixture();
  const beta = new SaveSlots(engine.LEVELS.map(level => level.id), () => storage, () => 'beta');
  beta.create(0, 'Existing player');
  const snapshot = storage.getItem(SAVE_KEY);
  const official = new SaveSlots([], () => storage, () => 'official', [], 'official');
  const profile = official.create(0, 'Future player');
  assert.equal(official.resumeLevel(profile), -1);
  assert.equal(official.nextLevel(profile), -1);
  assert.equal(official.load()[0].owner, 'Future player');
  assert.equal(storage.getItem(SAVE_KEY), snapshot);
});

test('classic browser startup selects Official levels and leaves Beta content intact', () => {
  const official = browserFixture();
  assert.equal(official.context.KoshiCampaignMode.active.id, 'official');
  assert.equal(official.context.KoshiCampaign.WORLDS.length, 18);
  assert.equal(official.context.KoshiGame.LEVELS.length, officialCount);
  assert.equal(Object.keys(official.context.KoshiCampaign.OFFICIAL_LEVEL_DATA).length, officialCount);
  assert.equal(official.context.KoshiCampaign.BETA_WORLDS.length, 5);
  assert.equal(official.errors.length, 0);
  const beta = browserFixture({ search: '?game=beta' });
  assert.equal(JSON.stringify(beta.context.KoshiGame.LEVELS), JSON.stringify(engine.LEVELS));
  assert.equal(beta.errors.length, 0);
});

test('remaining Official starters have one time-zero Cat Block and a ten-second survival objective', () => {
  const { OFFICIAL_WORLDS, OFFICIAL_LEVEL_DATA, assembleCampaign } = require('../src/campaign.js');
  const levels = assembleCampaign(OFFICIAL_LEVEL_DATA, OFFICIAL_WORLDS);
  assert.equal(levels.length, officialCount);
  const starters = OFFICIAL_WORLDS.filter(world => !world.mapOnly && !authoredWorlds.has(world.id));
  for (const world of starters) {
    const level = levels.find(entry => entry.worldId === world.id);
    assert.ok(level, `${world.name} has a level`);
    assert.equal(level.number, '1');
    assert.equal(level.duration, 10);
    assert.equal(level.survive, true);
    assert.deepEqual(level.food, []);
    assert.deepEqual(level.enemies, []);
    assert.deepEqual(level.weapons, []);
    assert.deepEqual(level.items, [[0, 'cat-block']]);
  }
  if (starters.length) {
    const first = levels.find(level => level.worldId === starters[0].id);
    const game = new engine.Game(() => .5, { levels, level: levels.indexOf(first) });
    game.start();
    assert.equal(game.pendingSpawns.size, 1);
    assert.equal([...game.pendingSpawns.values()][0].items[0].type, 'cat-block');
    for (let second = 0; second < 10; second++) game.update(1);
    assert.equal(game.state, 'won');
  }
});

test('Official authored levels faithfully import their JSON and manifest identities', () => {
  const manifest = JSON.parse(read('levels/official/campaign.json'));
  const { OFFICIAL_WORLDS, OFFICIAL_LEVEL_DATA, assembleCampaign } = require('../src/campaign.js');
  const levels = assembleCampaign(OFFICIAL_LEVEL_DATA, OFFICIAL_WORLDS);
  const { context } = browserFixture();
  assert.equal(JSON.stringify(context.KoshiGame.LEVELS), JSON.stringify(levels));
  context.Game = context.KoshiGame.Game;
  const editor = read('src/editor.js');
  vm.runInContext(editor.slice(editor.indexOf('function campaignPreview('), editor.indexOf('function syncAccess(')), context);
  for (const entry of manifest.levels) {
    const source = engine.validateCustomLevel(JSON.parse(read(`levels/official/${entry.file}`)));
    const index = levels.findIndex(level => level.id === entry.id);
    assert.ok(index >= 0, entry.file);
    const { name, worldId, number, food, enemies, weapons, items, ...content } = levels[index];
    assert.equal(name, source.id);
    assert.equal(worldId, entry.worldId);
    assert.equal(number, entry.number);
    assert.deepEqual(content, { ...source, id: entry.id, heartCost: source.heartCost ?? Infinity });
    assert.deepEqual([food, enemies, weapons, items], [[], [], [], []]);
    assert.equal(OFFICIAL_WORLDS.find(world => world.id === worldId).levels[number], name);
    const preview = context.campaignPreview(index);
    assert.deepEqual(JSON.parse(JSON.stringify(preview.events)), [...source.events].sort((a, b) => a.time - b.time));
    assert.equal(preview.heartCost, source.heartCost);
    assert.equal(preview.id, entry.id);
    assert.equal(preview.duration, source.duration);
    assert.equal(preview.goal, source.goal);
  }
});

test('Official authored bricks and schedules match custom loading in both orientations', () => {
  const { OFFICIAL_WORLDS, OFFICIAL_LEVEL_DATA, assembleCampaign } = require('../src/campaign.js');
  const levels = assembleCampaign(OFFICIAL_LEVEL_DATA, OFFICIAL_WORLDS);
  for (const entry of authored) {
    const source = entry.level;
    for (const portrait of [false, true]) {
      const game = new engine.Game(() => .5, { levels, level: levels.findIndex(level => level.id === entry.id), portrait });
      const custom = new engine.Game(() => .5, { customLevel: source, portrait });
      assert.deepEqual(game.bricks, custom.bricks);
      assert.deepEqual(game.customEvents, custom.customEvents);
      assert.equal(game.nextHeart, custom.nextHeart);
      assert.equal(game.timeLimit, custom.timeLimit);
      assert.deepEqual(game.level.catBlock, custom.level.catBlock);
    }
  }
});

test('numbered Official starters each have the matching Hello world cutscene', () => {
  const { OFFICIAL_WORLDS, OFFICIAL_LEVEL_DATA, assembleCampaign } = require('../src/campaign.js');
  const themes = ['happy-meadows', 'catnip-beach', 'fuzzy-falls', 'mouser-mesa',
    'alpine-litterbox', 'yarnball-moon', 'hairball-swamp', 'meownt-vesuvius', 'robot-hq'];
  const levels = assembleCampaign(OFFICIAL_LEVEL_DATA, OFFICIAL_WORLDS);
  for (const [index, theme] of themes.entries()) {
    if (authoredWorlds.has(String(index + 1))) continue;
    const level = levels.find(entry => entry.worldId === String(index + 1));
    assert.ok(level);
    assert.deepEqual(level.cutscene, {
      theme, lines: [{ speaker: 'koshi', text: 'Hello world!', actors: [{ character: 'koshi', x: .5, y: .8 }] }],
    });
    assert.deepEqual(engine.validateCutscene(level.cutscene), level.cutscene);
  }
  for (const level of levels.filter(entry => entry.worldId.startsWith('S') && !authoredWorlds.has(entry.worldId))) {
    assert.equal(level.cutscene, undefined);
  }
});

test('Official world mappings cannot accidentally pull levels from the Beta data collection', () => {
  const { context } = browserFixture();
  const campaign = context.KoshiCampaign;
  campaign.OFFICIAL_WORLDS[0].levels = { '1-1': engine.LEVELS[0].name };
  assert.throws(() => campaign.assembleCampaign(campaign.OFFICIAL_LEVEL_DATA), /Unknown level data/);
});

test('Official map keeps the octagon, Cat Town hub, and remaining temporary starters', () => {
  const { OFFICIAL_WORLDS, OFFICIAL_LEVEL_DATA, assembleCampaign } = require('../src/campaign.js');
  const find = id => OFFICIAL_WORLDS.find(world => world.id === id);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} equals ${b}`);
  const center = find('9').mapPosition;
  const names = ['Happy Meadows', 'Catnip Beach', 'Fuzzy Falls', 'Mouser Mesa',
    'Alpine Litterbox', 'Yarnball Moon', 'Hairball Swamp', 'Meownt Vesuvius'];
  assert.equal(OFFICIAL_WORLDS.length, 18);
  const officialLevels = assembleCampaign(OFFICIAL_LEVEL_DATA, OFFICIAL_WORLDS);
  assert.equal(officialLevels.length, officialCount);
  assert.ok(officialLevels.filter(level => !authoredWorlds.has(level.worldId)).every(level => level.number === '1' && level.duration === 10
    && level.survive && level.items.length === 1 && level.items[0][0] === 0
    && level.items[0][1] === 'cat-block'));
  const side = distance(find('1').mapPosition, find('2').mapPosition);
  for (let i = 1; i <= 8; i++) {
    const world = find(String(i)), following = find(String(i % 8 + 1));
    const special = find(`S${i}`);
    assert.equal(world.name, names[i - 1]);
    assert.equal(special.name, `Special ${world.name}`);
    assert.equal(special.color, world.color);
    assert.equal(special.special, true);
    assert.deepEqual(special.next, []);
    assert.deepEqual(world.next, [i === 8 ? '9' : String(i + 1), `S${i}`, ...(i === 1 ? ['C'] : [])]);
    close(distance(world.mapPosition, center), 27);
    close(distance(world.mapPosition, following.mapPosition), side);
    close(distance(special.mapPosition, world.mapPosition), distance(special.mapPosition, following.mapPosition));
    assert.ok(distance(special.mapPosition, center) > 27);
    for (const current of [world, special]) {
      const entries = authored.filter(entry => entry.worldId === current.id);
      assert.deepEqual(current.levels, entries.length
        ? Object.fromEntries(entries.map(entry => [entry.number, entry.level.id]))
        : { '1': `${current.name} Starter` });
    }
  }
  const town = find('C').mapPosition, first = find('1').mapPosition;
  close(first.y, center.y);
  close(town.y, center.y);
  assert.ok(town.x < first.x && first.x < center.x);
  assert.equal(find('9').name, 'Robot HQ');
  assert.equal(find('C').name, 'Cat Town');
  assert.deepEqual(find('C').next, []);
  assert.equal(find('C').mapOnly, true);
  assert.deepEqual(find('C').levels, {});
  const { worldLevels, nextLevelIndex } = require('../src/worlds.js');
  for (const world of OFFICIAL_WORLDS.filter(world => world.id !== 'C')) {
    const level = worldLevels(world, officialLevels).at(-1);
    assert.equal(nextLevelIndex(officialLevels.indexOf(level), OFFICIAL_WORLDS, officialLevels),
      world.id === '1' ? officialLevels.indexOf(worldLevels(find('2'), officialLevels)[0])
        : world.special || world.id === '9' ? -1
          : officialLevels.indexOf(worldLevels(find(String(Number(world.id) + 1)), officialLevels)[0]));
  }
});

test('every shared tutorial step, including the boss, works with Official levels', () => {
  const { context } = browserFixture();
  vm.runInContext(read('src/learning.js'), context);
  const tutorial = new context.KoshiLearning.Tutorial();
  for (let index = 0; index < context.KoshiLearning.LESSONS.length; index++) {
    const game = tutorial.select(index);
    assert.equal(game.state, 'playing');
    game.update(.1);
  }
  assert.equal(context.KoshiGame.LEVELS.length, officialCount);
});

test('switching preserves other query parameters, drops cross-game fragments, and respects cancellation', () => {
  const { context, location, storage } = browserFixture({ search: '?game=beta&debug=1', hash: '#campaign=1-1' });
  let change;
  let destination;
  let allow = false;
  let switched = false;
  const select = { value: '', addEventListener: (type, handler) => { change = handler; } };
  context.document = {
    body: { dataset: {} }, title: "Koshi's Quest",
    querySelectorAll: selector => selector === '[data-campaign-select]' ? [select] : [],
  };
  location.assign = url => { destination = url; };
  context.KoshiCampaignMode.setup({
    beforeSwitch: () => allow,
    onSwitch: () => { switched = true; },
    reportError: error => { throw error; },
  });
  assert.equal(select.value, 'beta');
  select.value = 'official';
  change();
  assert.equal(destination, undefined);
  assert.equal(switched, false);
  assert.equal(select.value, 'beta');
  assert.equal(storage.getItem(mode.ACTIVE_KEY), 'beta');
  allow = true;
  select.value = 'official';
  change();
  assert.equal(destination, 'https://example.test/koshi/index.html?game=official&debug=1');
  assert.equal(storage.getItem(mode.ACTIVE_KEY), 'official');
  assert.equal(switched, true);
});

test('storage failures are reported rather than silently switching or hiding startup errors', () => {
  const storage = { getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Storage blocked'); } };
  const { context, errors, location } = browserFixture({ search: '', storage });
  const reported = [];
  let change;
  let navigated = false;
  let switched = false;
  const select = { value: '', addEventListener: (type, handler) => { change = handler; } };
  context.document = {
    body: { dataset: {} }, title: 'Game',
    querySelectorAll: selector => selector === '[data-campaign-select]' ? [select] : [],
  };
  location.assign = () => { navigated = true; };
  context.KoshiCampaignMode.setup({
    onSwitch: () => { switched = true; },
    reportError: error => reported.push(error.message),
  });
  select.value = 'official';
  change();
  assert.equal(navigated, false);
  assert.equal(switched, false, 'failed selection persistence must not end the active run or discard a draft');
  assert.equal(select.value, 'beta');
  assert.equal(reported.length, 2);
  assert.ok(errors.length >= 2);
  assert.ok(reported.every(message => message === 'Storage blocked'));
});

test('failed final progress writes cancel navigation and restore the active game preference', () => {
  const { context, location, storage } = browserFixture({ search: '?game=beta' });
  let change;
  let navigated = false;
  const select = { value: '', addEventListener: (type, handler) => { change = handler; } };
  context.document = {
    body: { dataset: {} }, title: 'Game',
    querySelectorAll: selector => selector === '[data-campaign-select]' ? [select] : [],
  };
  location.assign = () => { navigated = true; };
  context.KoshiCampaignMode.setup({ onSwitch: () => false, reportError: error => { throw error; } });
  select.value = 'official';
  change();
  assert.equal(navigated, false);
  assert.equal(storage.getItem(mode.ACTIVE_KEY), 'beta');
  assert.equal(select.value, 'beta');
});
