const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, validateCustomLevel, validateLevelInfo, INFO_GRAPHICS } = require('../src/game.js');
const campaignMode = require('../src/campaign-mode.js');

const blank = () => ({ version: 1, id: 'Info test', duration: 30, goal: 50, heartCost: null, brickSet: 3, events: [] });
const information = () => ({ pages: [
  { title: 'Spring bricks', text: 'Jump farther.\nPlan your landing!', graphics: ['brick:springs', 'food:S'] },
  { title: 'Pick up a heart', text: 'Hearts restore health.', graphics: ['heart:heart'] },
] });
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');

test('optional information survives JSON round trips and engine construction without changing legacy levels', () => {
  const legacy = validateCustomLevel(blank());
  assert.equal(Object.hasOwn(legacy, 'levelInfo'), false);
  const input = { ...blank(), levelInfo: information() };
  const level = validateCustomLevel(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(level.levelInfo, input.levelInfo);
  assert.deepEqual(new Game(0, { customLevel: level }).level.levelInfo, input.levelInfo);
  const normalized = validateLevelInfo({ pages: [{ title: '  Title  ', text: ' Text\nLine ', graphics: ['food:S'] }] });
  assert.deepEqual(normalized.pages[0], { title: 'Title', text: 'Text\nLine', graphics: ['food:S'] });
  input.levelInfo.pages[0].graphics.push('food:H');
  input.levelInfo.pages[0].title = 'Changed';
  assert.equal(level.levelInfo.pages[0].title, 'Spring bricks');
  assert.equal(level.levelInfo.pages[0].graphics.length, 2);
});

test('information schema checks exact page, text and artwork limits and rejects malformed data', () => {
  const page = { title: 't'.repeat(80), text: 'x'.repeat(2000), graphics: Object.keys(INFO_GRAPHICS).slice(0, 6) };
  assert.equal(validateLevelInfo({ pages: Array.from({ length: 20 }, () => page) }).pages.length, 20);
  assert.deepEqual(validateLevelInfo({ pages: [{ title: 't', text: 'x' }] }).pages[0].graphics, []);
  for (const value of [null, [], {}, { pages: [] }, { pages: Array(21).fill(page) },
    { pages: [null] }, { pages: [[]] }, ...[
      { title: ' ' }, { title: 1 }, { title: 't'.repeat(81) }, { text: '' }, { text: 'x'.repeat(2001) },
      { graphics: 'food:S' }, { graphics: ['no:such-graphic'] }, { graphics: ['__proto__'] },
      { graphics: [null] }, { graphics: Array(7).fill('food:S') },
    ].map(invalid => ({ pages: [{ ...page, ...invalid }] })),
  ]) assert.throws(() => validateLevelInfo(value), /Level information:/);
  assert.throws(() => validateCustomLevel({ ...blank(), levelInfo: { pages: [] } }), /Level information:/);
});

function runtime(custom = false, storage = new Map()) {
  const nodes = new Map();
  function node() {
    return {
      open: false, hidden: false, textContent: '', disabled: false, scrollTop: 0, children: [],
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      focus() { this.focused = true; },
      showModal() { this.open = true; }, close() { this.open = false; },
    };
  }
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, node());
    return nodes.get(selector);
  };
  const calls = [];
  const context = {
    game: { level: { id: 'shared-id', levelInfo: information() }, customLevel: custom },
    validateLevelInfo, INFO_GRAPHICS, campaignMode, campaignId: 'beta', viewedLevelInfo: new Map(),
    infoPages: null, infoPage: 0, lastTime: 100,
    levelInfoDialog: get('#level-info'), overlay: node(), play: node(),
    document: { querySelector: get, createElement: node },
    guidePicture: (id, label) => ({ id, label }),
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    console: { error: (...args) => calls.push(['error', ...args]) },
    showLevelBriefing: () => calls.push(['objectives']),
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function showLevelInformation('), source.indexOf("levelInfoReplay.addEventListener(")), context);
  return { context, get, calls, storage };
}

test('pages render safe text and actual component identifiers, finish before objectives, and permit replay', () => {
  const { context, get, calls } = runtime();
  context.game.level.levelInfo.pages[0].text = '<script>not markup</script>';
  context.showLevelInformation();
  assert.equal(context.levelInfoDialog.open, true);
  assert.equal(context.overlay.hidden, true);
  assert.equal(get('#level-info-text').textContent, '<script>not markup</script>');
  assert.equal(get('#level-info-back').disabled, true);
  assert.equal(get('#level-info-next').disabled, false);
  assert.equal(get('#level-info-page').textContent, '1 / 2');
  assert.equal(get('#level-info-graphics').children[0].children[0].id, 'brick:springs');
  assert.equal(calls.length, 0);
  context.infoPage++;
  context.renderLevelInfoPage();
  assert.equal(get('#level-info-title').textContent, 'Pick up a heart');
  assert.equal(get('#level-info-back').disabled, false);
  assert.equal(get('#level-info-next').disabled, true);
  context.finishLevelInformation();
  assert.equal(context.levelInfoDialog.open, false);
  assert.equal(context.lastTime, null);
  assert.deepEqual(calls, [['objectives']]);
  assert.equal(context.play.focused, true);
  context.showLevelInformation();
  assert.equal(context.levelInfoDialog.open, false);
  context.showLevelInformation(true);
  assert.equal(context.levelInfoDialog.open, true);
  assert.equal(context.infoPage, 0);
});

test('first visits persist across reloads, isolate campaigns, and reappear when content changes', () => {
  const first = runtime();
  first.context.showLevelInformation();
  first.context.finishLevelInformation();
  const repeat = runtime(false, first.storage);
  repeat.context.showLevelInformation();
  assert.equal(repeat.context.levelInfoDialog.open, false);
  repeat.context.game.level.levelInfo.pages[0].text = 'Updated explanation';
  repeat.context.showLevelInformation();
  assert.equal(repeat.context.levelInfoDialog.open, true);
  const official = runtime(false, first.storage);
  official.context.campaignId = 'official';
  official.context.showLevelInformation();
  assert.equal(official.context.levelInfoDialog.open, true);
  assert.notEqual(campaignMode.levelInfoKey('same', 'beta'), campaignMode.levelInfoKey('same', 'official'));
  assert.throws(() => campaignMode.levelInfoKey('same', 'invalid'));
  assert.equal(campaignMode.levelInfoKey('a:b', 'official'), 'koshi-official-level-info-viewed:a%3Ab');
});

test('custom playtests always show information without persisting campaign preferences', () => {
  const { context, storage } = runtime(true);
  context.showLevelInformation(); context.finishLevelInformation();
  context.showLevelInformation();
  assert.equal(context.levelInfoDialog.open, true);
  assert.equal(storage.size, 0);
  delete context.game.level.levelInfo;
  context.levelInfoDialog.close();
  context.showLevelInformation();
  assert.equal(context.levelInfoDialog.open, false);
});

test('arrow navigation stops at page boundaries and only Close or Escape exits the tips dialog', () => {
  const { context, get, calls } = runtime(true);
  const handlers = new Map();
  for (const id of ['#level-info-back', '#level-info-next', '#level-info-close', '#level-info-replay', '#level-info']) {
    get(id).addEventListener = (type, handler) => handlers.set(`${id}:${type}`, handler);
  }
  context.levelInfoReplay = get('#level-info-replay');
  vm.runInContext(source.slice(source.indexOf("levelInfoReplay.addEventListener("), source.indexOf("\nplay.addEventListener('click'")), context);
  context.showLevelInformation();
  handlers.get('#level-info-back:click')();
  assert.equal(context.infoPage, 0);
  handlers.get('#level-info-next:click')();
  handlers.get('#level-info-next:click')();
  assert.equal(context.infoPage, 1);
  assert.equal(context.levelInfoDialog.open, true);
  assert.equal(calls.length, 0);
  handlers.get('#level-info-close:click')();
  assert.equal(context.levelInfoDialog.open, false);
  assert.deepEqual(calls, [['objectives']]);
  handlers.get('#level-info-replay:click')();
  handlers.get('#level-info:keydown')({ key: 'Escape', stopPropagation() {}, preventDefault() {} });
  assert.equal(context.levelInfoDialog.open, false);
});

test('tips layout uses labelled compact arrows, a separate Close button and a green replay shortcut', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.doesNotMatch(html, /level-info-skip|Skip information|View level information/);
  assert.match(html, /id="level-info-replay" class="primary"[^>]*>Tips &amp; Hints/);
  assert.match(html, /<header><p class="eyebrow">Tips &amp; Hints<\/p><\/header>/);
  assert.match(html, /aria-label="Previous page">&#8592;/);
  assert.match(html, /aria-label="Next page">&#8594;/);
  assert.match(html, /id="level-info-close" type="button">Close/);
  assert.match(css, /#level-info-replay \{[^}]*background: #3d5c27; color: #fff;/);
  assert.match(css, /\.level-info-navigation \{ grid-column: 2;/);
  assert.match(css, /#level-info-close \{ grid-column: 3; justify-self: end;/);
});

test('storage failures are reported visibly and do not block objectives or session repeat tracking', () => {
  const { context, get, calls } = runtime();
  context.localStorage = {
    getItem() { throw new Error('Storage unavailable'); },
    setItem() { throw new Error('Storage unavailable'); },
  };
  context.showLevelInformation();
  assert.equal(context.levelInfoDialog.open, true);
  assert.equal(get('#level-info-error').hidden, false);
  assert.match(get('#level-error').textContent, /Storage unavailable/);
  context.finishLevelInformation();
  assert.equal(context.levelInfoDialog.open, false);
  assert.equal(calls.filter(([name]) => name === 'error').length, 2);
  assert.equal(calls.at(-1)[0], 'objectives');
  context.showLevelInformation();
  assert.equal(context.levelInfoDialog.open, false);
});

test('opening order is cutscene, information, objectives and direct links share the introduction', () => {
  const calls = [];
  const context = {
    game: { level: { id: '1', cutscene: {} } }, skipCutscene: { checked: false }, overlay: {},
    cutscene: { open: () => calls.push('cutscene') }, showLevelInformation: () => calls.push('information'),
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function showLevelIntroduction('), source.indexOf('function showLevelInformation(')), context);
  context.showLevelIntroduction();
  assert.deepEqual(calls, ['cutscene']);
  context.skipCutscene.checked = true;
  context.showLevelIntroduction();
  assert.deepEqual(calls, ['cutscene', 'information']);
  delete context.game.level.cutscene;
  context.showLevelIntroduction();
  assert.deepEqual(calls, ['cutscene', 'information', 'information']);
  assert.match(source, /KoshiCutscenePlayer[\s\S]*?showLevelInformation\(\)/);
  assert.match(source.slice(source.indexOf('function begin('), source.indexOf('function startLevel(')), /showLevelIntroduction\(\)/);
  assert.match(source, /if \(game\?\.level\.levelInfo && [^\n]+showLevelIntroduction\(\);/);
});

const editorSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');

test('editor applies validated information, removes it when disabled, and blocks invalid or read-only writes', () => {
  const handlers = new Map();
  const nodes = new Map();
  const fields = {
    '.info-title': { value: ' A concept ' }, '.info-text': { value: ' Explanation ' },
    '.info-graphics-select': { selectedOptions: [{ value: 'brick:springs' }, { value: 'food:S' }] },
  };
  const row = { querySelector: selector => fields[selector] };
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { checked: true, children: [row],
      addEventListener: (type, handler) => handlers.set(`${selector}:${type}`, handler) });
    return nodes.get(selector);
  };
  const messages = [];
  const context = {
    $, level: blank(), readOnly: () => false, validateDraft: validateCustomLevel,
    attempt: action => { try { action(); } catch (error) { messages.push(error.message); } },
    markChanged: () => messages.push('changed'), message: text => messages.push(text),
    populateLevelInfo() {},
  };
  vm.createContext(context);
  vm.runInContext(editorSource.slice(editorSource.indexOf("$('#info-enabled').addEventListener("), editorSource.indexOf('function replaceLevel(')), context);
  const apply = () => handlers.get('#level-info-form:submit')({ preventDefault() {} });
  apply();
  assert.equal(context.level.levelInfo.pages[0].title, 'A concept');
  assert.deepEqual(Array.from(context.level.levelInfo.pages[0].graphics), ['brick:springs', 'food:S']);
  fields['.info-text'].value = '';
  const previous = context.level;
  apply();
  assert.equal(context.level, previous);
  assert.match(messages.at(-1), /Level information:/);
  fields['.info-text'].value = 'Explanation';
  context.readOnly = () => true;
  $('#info-enabled').checked = false;
  apply();
  assert.equal(context.level, previous);
  context.readOnly = () => false;
  apply();
  assert.equal(Object.hasOwn(context.level, 'levelInfo'), false);
});

test('campaign inspection preserves unapplied custom information and every multi-selected graphic', () => {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      id: selector.slice(1), value: '', checked: false, disabled: false, isConnected: true, childNodes: [],
      replaceChildren(...children) { this.childNodes = children; },
    });
    return nodes.get(selector);
  };
  const options = ['food:S', 'enemy:mouse', 'brick:springs'].map(value => ({ value, selected: true }));
  const graphics = { id: '', multiple: true, options, isConnected: true,
    get selectedOptions() { return options.filter(option => option.selected); },
    get value() { return this.selectedOptions[0]?.value ?? ''; },
    set value(value) { for (const option of options) option.selected = option.value === value; },
  };
  $('#info-enabled').checked = true;
  $('#info-fields').disabled = false;
  const originalPages = [{ title: 'Unapplied title' }];
  $('#info-pages').childNodes = originalPages;
  const context = {
    $, document: { querySelectorAll: () => [$('#info-enabled'), graphics] },
    level: blank(), campaignIndex: null, committed: null, dirty: false, placing: true, activeCategory: 'bricks',
    selectedEvents: new Set(), selectedBricks: new Set(), customWorkspace: null, gesture: null,
    readOnly: () => context.campaignIndex !== null, campaignPreview: () => ({ id: 'campaign' }),
    populateLevelInfo() { $('#info-pages').replaceChildren(); $('#info-enabled').checked = false; },
  };
  for (const name of ['populateSettings', 'populateCutscene', 'populateEventForm', 'updatePlaytest',
    'render', 'updateWinCondition', 'syncPalettes', 'showCategory', 'syncAccess', 'message']) context[name] = () => {};
  vm.createContext(context);
  vm.runInContext(editorSource.slice(editorSource.indexOf('function selectEditorLevel('), editorSource.indexOf("$('#editor-level').addEventListener(")), context);
  $('#editor-level').value = '0';
  context.selectEditorLevel();
  assert.equal(context.level.id, 'campaign');
  $('#editor-level').value = 'custom';
  context.selectEditorLevel();
  assert.equal(context.level.id, blank().id);
  assert.equal($('#info-enabled').checked, true);
  assert.equal($('#info-fields').disabled, false);
  assert.equal($('#info-pages').childNodes[0], originalPages[0]);
  assert.deepEqual(graphics.selectedOptions.map(option => option.value), ['food:S', 'enemy:mouse', 'brick:springs']);
});
