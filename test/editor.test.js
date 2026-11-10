const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, CAT_BLOCK_MESSAGES, CAT_BLOCK_TRIGGERS, catBlockDescription, validateCustomLevel, levelObjective, snapWheel, FOODS, ITEMS, SHIELDS, SWORDS, WEAPONS, OBJECTS, CHARACTERS, brickRegions, brickEditRegions, COOLDOWNS } = require('../src/game.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const blank = () => ({ version: 1, id: 'Designer level', duration: 30, goal: 50, heartCost: null, brickSet: 3, events: [] });
const event = (kind = 'food', type = 'S', time = 2) => ({ kind, type, time, x: .2, y: .7, ...(kind === 'food' ? { lifetime: 5 } : {}) });

test('enemy palette separates bosses without changing category, selection, or read-only controls', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const node = () => ({
    children: [], dataset: {}, attributes: {},
    append(...children) {
      for (const child of children) {
        if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child);
        child.parent = this;
        this.children.push(child);
      }
    },
    replaceChildren(...children) { this.children = []; this.append(...children); },
    setAttribute(name, value) { this.attributes[name] = value; },
  });
  const palette = node();
  const select = { value: 'boss', disabled: false, parentElement: {},
    options: [{ value: 'mouse', textContent: 'Robo Mouse' }, { value: 'boss', textContent: 'Tom the Toaster' }] };
  const entry = { select, palette, signature: null, buttons: [] };
  const context = vm.createContext({
    palettes: new Map([['event-type', entry]]), MIXED: '',
    $: () => ({ value: 'enemy', parentElement: {} }),
    document: { createElement: node, querySelectorAll: () => [] },
    choiceButton: (value, name, control, action) => Object.assign(node(), { action }),
  });
  vm.runInContext(source.slice(source.indexOf('function syncPalettes('), source.indexOf('function message(')), context);
  context.syncPalettes();
  assert.equal(palette.children[0].dataset.value, 'mouse');
  const section = palette.children[1];
  assert.equal(section.attributes['aria-label'], 'Bosses');
  assert.equal(section.children[0].textContent, 'Bosses');
  assert.equal(section.children[1].children[0], entry.buttons[1]);
  assert.equal(entry.buttons[1].attributes['aria-pressed'], 'true');
  assert.equal(select.value, 'boss');
  select.disabled = true;
  context.syncPalettes();
  assert.ok(entry.buttons.every(button => button.disabled));
});

test('event inspector applies edits automatically while preserving validation and selection', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const listeners = {};
  let valid = true, applied = 0, error;
  const context = vm.createContext({
    selectedEvents: new Set([0]), touched: new Set(['#event-x']), readOnly: () => false,
    form: { checkValidity: () => valid, reportValidity() {}, addEventListener: (type, handler) => { listeners[type] = handler; } },
    attempt: action => { try { action(); } catch (failure) { error = failure.message; } },
    applyToSelected: () => { applied++; },
  });
  vm.runInContext(source.slice(source.indexOf('function applyEventChanges('), source.indexOf("$('#new-event').addEventListener")), context);
  listeners.change();
  assert.equal(applied, 1);
  valid = false;
  listeners.change();
  assert.equal(applied, 1);
  assert.match(error, /invalid value/);
  valid = true;
  context.selectedEvents.clear();
  listeners.change();
  assert.equal(applied, 1, 'placement settings never create an event until board placement');
  context.selectedEvents.add(0);
  context.readOnly = () => true;
  listeners.change();
  assert.equal(applied, 1);
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  assert.doesNotMatch(html, /id="apply-event"/);
});

test('Discretize X, Y snaps placements and moves to rendered dot centers without changing existing data', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const checkbox = { checked: false };
  const area = { clientLeft: 1, clientTop: 1, getBoundingClientRect: () => ({ width: 503.5, height: 301.25 }) };
  const level = blank();
  level.events = [event(), event('enemy', 'wheel')];
  const context = vm.createContext({
    $: selector => selector === '#discretize-xy' ? checkbox : area,
    getComputedStyle: () => ({ backgroundSize: '18px 18px' }),
    level, readOnly: () => false, snapWheel,
  });
  vm.runInContext(source.slice(source.indexOf('function placementGrid('), source.indexOf('function pointerPosition(')), context);
  assert.equal(context.placementPosition(.237, .641).x, .237);
  assert.equal(context.placementPosition(.237, .641).y, .641);
  const before = JSON.stringify(level);
  checkbox.checked = true;
  assert.equal(JSON.stringify(level), before);
  for (const dimensions of [{ width: 503.5, height: 301.25 }, { width: 185.75, height: 487.5 }]) {
    area.getBoundingClientRect = () => dimensions;
    for (const [x, y] of [[.237, .641], [0, 0], [1, 1], [-2, 3]]) {
      const point = context.placementPosition(x, y);
      for (const [axis, length] of [['x', dimensions.width], ['y', dimensions.height]]) {
        const dotIndex = (point[axis] * length - 10) / 18;
        assert.ok(Math.abs(dotIndex - Math.round(dotIndex)) < 1e-10);
        assert.ok(point[axis] > 0 && point[axis] < 1);
      }
    }
    const start = context.placementPosition(.237, .641);
    const next = context.placementPosition(start.x + 18 / dimensions.width, start.y);
    assert.ok(Math.abs((next.x - start.x) * dimensions.width - 18) < 1e-10, 'arrow step advances exactly one dot');
    context.moveEvent(0, .237, .641);
    assert.equal(level.events[0].x, start.x);
    assert.equal(level.events[0].y, start.y);
  }
  context.moveEvent(1, .237, .641);
  assert.ok([level.events[1].x, level.events[1].y].some(value => value === 0 || value === 1), 'perimeter enemies keep edge snapping');
  checkbox.checked = false;
  context.moveEvent(0, .237, .641);
  assert.equal(level.events[0].x, .237);
  assert.equal(level.events[0].y, .641);
  const placed = [];
  Object.assign(context, {
    activeCategory: 'food', form: { reportValidity: () => true },
    pointerPosition: () => ({ x: .237, y: .641 }),
    readEvent: () => event(), attempt: action => action(),
    discretePreviewTime: value => Math.round(value),
    validateDraft: candidate => { placed.push(candidate.events.at(-1)); return candidate; },
    markChanged() {}, render() {}, message() {}, description: () => 'food',
  });
  vm.runInContext(source.slice(source.indexOf('function placeAt('), source.indexOf("board.addEventListener('pointerdown'")), context);
  context.$ = selector => selector === '#timeline' ? { value: 7.3 } : selector === '#discretize-xy' ? checkbox : area;
  context.placeAt({});
  assert.equal(placed[0].x, .237);
  assert.equal(placed[0].time, 7);
  checkbox.checked = true;
  context.placeAt({});
  assert.equal(placed[1].x, context.placementPosition(.237, .641).x);
  assert.equal(placed[1].y, context.placementPosition(.237, .641).y);
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  assert.match(html, /<input id="discretize-xy" type="checkbox" checked> Discretize X, Y/);
  assert.match(html, /<option value="1" selected>1s<\/option>/);
});

test('full grid toggle shows alignment guides and highlights markers sharing an axis', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const start = source.indexOf('function alignmentAxes(');
  const end = source.indexOf('\nfunction ', start + 1);
  const context = vm.createContext({});
  vm.runInContext(source.slice(start, end), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.alignmentAxes(
    { x: 100, y: 200 }, [{ x: 101, y: 240 }, { x: 150, y: 201 }], 2, 2))),
  { vertical: true, horizontal: true });
  assert.deepEqual(JSON.parse(JSON.stringify(context.alignmentAxes(
    { x: 100, y: 200 }, [{ x: 104, y: 240 }, { x: 150, y: 204 }], 2, 2))),
  { vertical: false, horizontal: false });
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  const css = readFileSync(path.join(__dirname, '..', 'editor.css'), 'utf8');
  const editor = source.slice(source.indexOf("$('#full-grid').addEventListener"), source.indexOf("new ResizeObserver"));
  assert.match(html, /id="full-grid" type="checkbox"> Full grid lines/);
  assert.match(html, /id="alignment-guides"/);
  assert.match(editor, /renderBoard/);
  assert.match(source, /gesture\?\.type === 'marker' && gesture\.moved/);
  assert.match(source, /marker\.classList\.toggle\('alignment-highlight'/);
  assert.match(css, /data-full-grid="true"\] #playable-area/);
  assert.match(css, /#alignment-guides line\s*\{[^}]*stroke:/);
  assert.match(css, /\.marker\.alignment-highlight\s*\{[^}]*drop-shadow/);
});

test('Print, paste, and open JSON files use validated level import without draft controls', async () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      value: '',
      listeners: {}, addEventListener(type, action) { this.listeners[type] = action; },
      click() { this.clicked = true; },
    });
    return nodes.get(selector);
  };
  const messages = [], errors = [];
  const context = vm.createContext({
    $, level: blank(), validateCustomLevel, cutsceneError: null, trackDrawing: false, selectedEvents: new Set(), touched: new Set(),
    message: (text, error = false) => messages.push({ text, error }),
    console: { error: (...args) => errors.push(args) },
  });
  vm.runInContext(source.slice(source.indexOf('function attempt('), source.indexOf('function markChanged(')), context);
  context.replaceLevel = candidate => { context.level = validateCustomLevel(candidate); };
  vm.runInContext(source.slice(source.indexOf('function validateSavedLevel('), source.indexOf("$('#new-level').addEventListener")), context);
  $('#generate-json').listeners.click();
  assert.equal($('#level-json').value, JSON.stringify(validateCustomLevel(blank()), null, 2));
  const loaded = { ...blank(), id: 'Pasted level', events: [event()] };
  $('#level-json').value = JSON.stringify(loaded);
  $('#import-json').listeners.click();
  assert.deepEqual(JSON.parse(JSON.stringify(context.level)), validateCustomLevel(loaded));
  const fileInput = $('#import-file');
  fileInput.files = [{ name: '1-1.json', text: async () => JSON.stringify(loaded) }];
  await fileInput.listeners.change();
  assert.deepEqual(JSON.parse(JSON.stringify(context.level)), validateCustomLevel(loaded));
  assert.equal($('#level-json').value, JSON.stringify(loaded));
  assert.equal(fileInput.value, '');
  $('#import-file-button').listeners.click();
  assert.equal(fileInput.clicked, true, 'the visible button opens the file picker');
  const before = context.level;
  const invalidFiles = [
    { name: 'invalid.json', text: async () => '{' },
    { name: 'invalid-level.json', text: async () => JSON.stringify({ ...loaded, duration: -1 }) },
  ];
  for (const file of invalidFiles) {
    fileInput.files = [file];
    await fileInput.listeners.change();
    assert.equal(context.level, before, 'invalid files leave the level unchanged');
    assert.equal(fileInput.value, '');
    assert.equal(messages.at(-1).error, true);
  }
  for (const invalid of ['{', JSON.stringify({ ...loaded, duration: -1 })]) {
    $('#level-json').value = invalid;
    $('#import-json').listeners.click();
    assert.equal(context.level, before, 'invalid JSON leaves the level unchanged');
    assert.equal(messages.at(-1).error, true);
  }
  assert.equal(errors.length, 4);
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  const panel = html.slice(html.indexOf('<fieldset id="files-access"'), html.indexOf('</fieldset>', html.indexOf('<fieldset id="files-access"')));
  assert.equal((panel.match(/<button /g) ?? []).length, 3);
  assert.equal((panel.match(/<textarea /g) ?? []).length, 1);
  for (const label of ['Print JSON', 'Load JSON', 'Open JSON file']) assert.ok(panel.includes(`>${label}</button>`));
  assert.match(panel, /id="import-file" type="file" accept="\.json,application\/json"/);
  assert.doesNotMatch(panel, /json-filename|json-directory|save-draft|load-draft|download-json/);
  assert.doesNotMatch(source, /showDirectoryPicker|createWritable|#save-draft|#load-draft|#download-json/);
});

test('cutscene edits apply automatically and new lines inherit the previous speaker and cast', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  class Node {
    constructor() { this.children = []; this.listeners = {}; this.value = ''; this.checked = false; this.disabled = false; }
    append(...children) { for (const child of children) if (typeof child !== 'string') { child.parent = this; this.children.push(child); } }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    addEventListener(type, handler) { this.listeners[type] = handler; }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
    get lastElementChild() { return this.children.at(-1); }
    querySelector(selector) { return this.querySelectorAll(selector)[0]; }
    querySelectorAll(selector) {
      if (selector.startsWith('.scene-cast ')) return this.querySelector('.scene-cast').querySelectorAll(selector.split(' ')[1]);
      return this.children.flatMap(child => [
        ...(selector.startsWith('.') ? child.className === selector.slice(1) ? [child] : []
          : child.type === 'checkbox' && (selector !== 'input:checked' || child.checked) ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    }
  }
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Node());
    return nodes.get(selector);
  };
  let changes = 0;
  const context = vm.createContext({
    $, level: blank(), CHARACTERS: { koshi: 'Koshi', mouse: 'Mouse', wheel: 'Wheel' },
    document: { createElement: () => new Node() },
    validateDraft: value => validateCustomLevel(value, { allowUnpairedPortals: true, allowIncompleteBoss: true }),
    validateCustomLevel, readOnly: () => false, markChanged: () => changes++, selectedEvents: new Set(), touched: new Set(),
    message: (text, error) => { $('#editor-message').textContent = text; $('#editor-message').error = Boolean(error); },
    console: { error() {} }, dirty: false, trackDrawing: false,
  });
  vm.runInContext(source.slice(source.indexOf('function attempt('), source.indexOf('function markChanged(')), context);
  vm.runInContext(source.slice(source.indexOf('let cutsceneError = null;'), source.indexOf('function addInfoPage(')), context);
  vm.runInContext(source.slice(source.indexOf('function validateSavedLevel('), source.indexOf("$('#generate-json').addEventListener")), context);
  const actors = [{ character: 'mouse', x: .42, y: .7 }, { character: 'mouse', x: .6, y: .8 }, { character: 'koshi', x: .2, y: .5 }];
  context.level = validateCustomLevel({ ...blank(), cutscene: {
    theme: 'garden', lines: [{ speaker: 'mouse', text: 'First line', actors }],
  } });
  context.populateCutscene();
  $('#scene-add-line').listeners.click();
  const row = $('#scene-lines').lastElementChild;
  assert.equal(row.querySelector('.scene-speaker').value, 'mouse');
  assert.equal(row.querySelector('.scene-text').value, '');
  assert.deepEqual(row.querySelectorAll('.scene-cast input:checked').map(input => input.value), ['koshi', 'mouse']);
  assert.equal(row.querySelectorAll('.scene-cast input').find(input => input.value === 'mouse').disabled, true);
  assert.throws(() => context.validateSavedLevel(), /dialogue/);
  row.querySelector('.scene-text').value = 'Next line';
  $('#cutscene-form').listeners.input();
  assert.equal(context.level.cutscene.lines.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(context.level.cutscene.lines[1].actors)), [
    actors[2], actors[0], actors[1],
  ]);
  assert.doesNotThrow(() => context.validateSavedLevel());
  assert.equal($('#scene-lines').lastElementChild, row, 'typing does not rebuild the focused row');
  $('#scene-theme').value = 'workshop';
  $('#cutscene-form').listeners.change();
  assert.equal(context.level.cutscene.theme, 'workshop');
  row.querySelector('.scene-speaker').value = 'wheel';
  row.querySelector('.scene-speaker').listeners.change();
  $('#cutscene-form').listeners.change();
  assert.equal(context.level.cutscene.lines[1].speaker, 'wheel');
  assert.ok(context.level.cutscene.lines[1].actors.some(actor => actor.character === 'wheel'));
  row.children.at(-1).listeners.click();
  assert.equal(context.level.cutscene.lines.length, 1);
  context.readOnly = () => true;
  const before = changes;
  $('#scene-add-line').listeners.click();
  $('#cutscene-form').listeners.input();
  assert.equal(changes, before);
  context.readOnly = () => false;
  $('#scene-enabled').checked = false;
  $('#scene-enabled').listeners.change();
  $('#cutscene-form').listeners.change();
  assert.equal(context.level.cutscene, undefined);
  assert.equal($('#scene-fields').disabled, true);
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  assert.doesNotMatch(html, /Apply cutscene/);
});

test('palette image artwork fits its icon slot in menus, markers, and information previews', () => {
  const css = readFileSync(path.join(__dirname, '..', 'editor.css'), 'utf8');
  assert.match(css, /\.palette-picture > img\s*\{[^}]*display:\s*block;[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*contain;/);
  assert.match(css, /\.palette-picture\s*\{[^}]*width:\s*44px;[^}]*height:\s*28px;/);
  assert.match(css, /\.marker \.palette-picture\s*\{[^}]*width:\s*26px;[^}]*height:\s*26px;/);
  assert.match(css, /\.info-graphics-preview \.palette-picture\s*\{[^}]*width:\s*64px;[^}]*height:\s*52px;/);
});

test('settings and introductions share a collapsible frame, and points sit directly above the board', () => {
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  const settings = html.slice(html.indexOf('<details class="editor-panel level-settings-panel"'), html.indexOf('<div class="editor-workspace">'));
  assert.match(settings, /aria-label="Level settings" open>/);
  for (const id of ['settings-form', 'cutscene-form', 'level-info-form']) assert.ok(settings.includes(`id="${id}"`));
  assert.doesNotMatch(settings, /Apply settings|point-reference/);
  assert.match(html, /id="point-reference-extra"[\s\S]*?<\/section>\s*<div id="editor-board-scroll"/);
  assert.match(html, /id="show-random" type="checkbox" checked/);
});

test('settings changes automatically update the level, report invalid fields, and respect read-only access', () => {
  const nodes = new Map(), messages = [];
  let locked = false, valid = true, reported = 0, changed = 0;
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', listeners: {}, replaceChildren() {},
      checkValidity: () => valid, reportValidity: () => { reported++; },
      addEventListener(type, listener) { this.listeners[type] = listener; } });
    return nodes.get(selector);
  };
  const context = vm.createContext({ $, level: blank(), CAT_BLOCK_TRIGGERS, catBlockDescription,
    validateDraft: validateCustomLevel, readOnly: () => locked,
    attempt: action => { try { action(); } catch (error) { messages.push(error.message); } },
    markChanged() { changed++; }, render() {}, message: text => messages.push(text) });
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf("$('#settings-form').addEventListener"), source.indexOf('function addSceneLine(')), context);
  context.populateSettings();
  assert.equal($('#power-start').value, 'off');
  for (const [selector, value, field, expected] of [
    ['#level-name', 'Renamed', 'id', 'Renamed'], ['#duration', '45', 'duration', 45],
    ['#goal', '10', 'goal', 10], ['#kill-goal', '5', 'killGoal', 5],
    ['#goals-goal', '2', 'goalsGoal', 2], ['#heart-cost', '7', 'heartCost', 7],
    ['#activation-limit', '12', 'activationLimit', 12], ['#activation-limit', '', 'activationLimit', null],
    ['#power-start', 'on', 'powerOn', true], ['#power-start', 'off', 'powerOn', false],
  ]) {
    $(selector).value = value;
    $('#settings-form').listeners.change();
    assert.equal(context.level[field], expected);
    if (field === 'powerOn') assert.equal($('#power-start').value, value);
  }
  $('#autoscroll-enabled').checked = true;
  $('#autoscroll-enabled').listeners.change();
  $('#settings-form').listeners.change();
  assert.equal(context.level.autoscroll.length, 16);
  $('#win-condition').value = 'survive';
  $('#win-condition').listeners.change();
  $('#settings-form').listeners.change();
  assert.equal(context.level.survive, true);
  assert.equal(context.level.goal, 0);
  const before = JSON.stringify(context.level);
  valid = false;
  $('#duration').value = '';
  $('#settings-form').listeners.change();
  assert.equal(reported, 1);
  assert.match(messages.at(-1), /invalid value/);
  assert.equal(JSON.stringify(context.level), before);
  valid = true;
  $('#duration').value = '-1';
  $('#settings-form').listeners.change();
  assert.match(messages.at(-1), /duration/i);
  assert.equal(JSON.stringify(context.level), before);
  locked = true;
  $('#duration').value = '60';
  const previousChanged = changed;
  $('#settings-form').listeners.change();
  assert.equal(changed, previousChanged);
  assert.equal(JSON.stringify(context.level), before);
});

test('random-spawn visibility filters random groups and campaign examples without changing fixed events or totals', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const start = source.indexOf('  [...level.events.map');
  const pipeline = source.slice(start, source.indexOf('    .forEach(', start));
  const events = [
    event(), { ...event(), random: true },
    { ...event(), random: true, group: { shape: 'line', count: 3, size: .2 } },
    { ...event(), previewRandom: true },
    { ...event(), group: { shape: 'circle', count: 3, size: .2 } },
  ];
  const templates = [{ event: event(), spawnKey: 'fixed-spawner' }];
  const before = JSON.stringify(events);
  let showRandom = true;
  const context = vm.createContext({
    level: { events }, templates, $: () => ({ checked: showRandom }),
    previewGame: { customEventPoints: item => Array(item.group?.count ?? 1).fill({ x: 100, y: 100 }) },
    FOODS, SHIELDS,
  });
  vm.runInContext(source.slice(source.indexOf('function pointReference('), source.indexOf('function render()')), context);
  const totals = JSON.stringify(context.pointReference(events, []));
  assert.equal(vm.runInContext(pipeline, context).length, 10);
  showRandom = false;
  const visible = vm.runInContext(pipeline, context);
  assert.equal(visible.length, 5);
  assert.ok(visible.every(({ event }) => !event.random && !event.previewRandom));
  assert.equal(visible.at(-1).spawnKey, 'fixed-spawner');
  assert.equal(JSON.stringify(events), before);
  assert.equal(JSON.stringify(context.pointReference(events, [])), totals);
});

test('point reference counts event groups, shield values and one spawn per active brick', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const nodes = new Map();
  const context = vm.createContext({ FOODS, SHIELDS, $: selector => {
    if (!nodes.has(selector)) nodes.set(selector, {});
    return nodes.get(selector);
  } });
  vm.runInContext(source.slice(source.indexOf('function pointReference('), source.indexOf('function render()')), context);
  const events = [
    { kind: 'food', type: 'H', group: { count: 3 } },
    { kind: 'food', type: 'S' },
    { kind: 'enemy', type: 'mouse', shield: 'blue', group: { count: 2 } },
    { kind: 'enemy', type: 'boss' },
    { kind: 'object', type: 'soccer-ball', group: { count: 4 } },
    { kind: 'item', type: 'battery' },
  ];
  const bricks = [
    { absorbedBy: null, spawner: { kind: 'food', type: 'L' } },
    { absorbedBy: null, spawner: { kind: 'enemy', type: 'wheel', shield: 'green' } },
    { absorbedBy: null, spawner: { kind: 'object', type: 'soccer-ball' } },
    { absorbedBy: 1, spawner: { kind: 'food', type: 'H' } },
    { absorbedBy: null, spawner: null },
  ];
  context.renderPointReference(events, bricks);
  assert.equal(nodes.get('#available-food').textContent, '27');
  assert.equal(nodes.get('#available-enemy').textContent, '12');
  assert.equal(nodes.get('#available-soccer').textContent, '5');
  assert.equal(nodes.get('#point-reference-extra').hidden, false);
  context.renderPointReference([], []);
  for (const kind of ['food', 'enemy', 'soccer']) assert.equal(nodes.get(`#available-${kind}`).textContent, '0');
  assert.equal(nodes.get('#point-reference-extra').hidden, true);
  context.renderPointReference([{ kind: 'item', type: 'ditto-stamp' }], bricks);
  assert.equal(nodes.get('#point-reference-extra').hidden, false);
  context.renderPointReference([{ kind: 'item', type: 'battery' }], [{ absorbedBy: null, spawner: { kind: 'heart', type: 'heart' } }]);
  assert.equal(nodes.get('#point-reference-extra').hidden, true);
});

test('the event category pane contains its complete form and actions', () => {
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  const pane = html.match(/<section id="event-panel"[\s\S]*?<\/section>/)?.[0];
  assert.ok(pane);
  assert.match(pane, /<\/form>/);
  for (const id of ['new-event', 'duplicate-event', 'delete-event']) {
    assert.ok(pane.includes(`id="${id}"`), `${id} must hide with the event category pane`);
  }
  assert.equal((pane.match(/<details\b/g) ?? []).length, (pane.match(/<\/details>/g) ?? []).length);
});

test('editor category navigation opens bricks or the chosen event menu exclusively', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const categories = ['koshi', 'brick', 'food', 'enemy', 'item', 'object', 'tracks', 'weapon'];
  const buttons = categories.map(category => ({
    dataset: { category }, setAttribute(name, value) { this[name] = value; },
  }));
  const nodes = { '#brick-panel': {}, '#event-panel': {}, '#track-panel': {}, '#koshi-panel': {},
    '#cat-tracks': { dataset: {} }, '#category-palette': { children: buttons } };
  const context = vm.createContext({ $: selector => nodes[selector], activeCategory: 'food', readOnly: () => false });
  vm.runInContext(source.slice(source.indexOf('function showCategory('), source.indexOf('function syncPalettes(')), context);
  for (const category of categories) {
    context.showCategory(category);
    assert.equal(context.activeCategory, category);
    assert.equal(nodes['#brick-panel'].hidden, category !== 'brick');
    assert.equal(nodes['#event-panel'].hidden, ['brick', 'tracks', 'koshi'].includes(category));
    assert.equal(nodes['#track-panel'].hidden, category !== 'tracks');
    assert.equal(nodes['#koshi-panel'].hidden, category !== 'koshi');
    assert.deepEqual(buttons.filter(button => button['aria-pressed'] === 'true').map(button => button.dataset.category), [category]);
  }
});

test('palette choices activate Place mode before applying their action and respect read-only access', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  let locked = false, synced = 0, applied = 0;
  const context = vm.createContext({
    placing: false, readOnly: () => locked, picture: () => ({}),
    syncTool() { synced++; },
    document: { createElement: () => ({
      setAttribute() {}, append() {}, addEventListener(type, handler) { this[type] = handler; },
    }) },
  });
  vm.runInContext(source.slice(source.indexOf('function choiceButton('), source.indexOf('function setupPalettes(')), context);
  const button = context.choiceButton('slow', 'Slow', 'brick-kind', () => {
    assert.equal(context.placing, true);
    applied++;
  });
  button.click({});
  assert.equal(applied, 1);
  assert.equal(synced, 1);
  context.placing = false;
  locked = true;
  button.click({});
  assert.equal(context.placing, false);
  assert.equal(applied, 1);
  assert.equal(synced, 1);
});

test('event palette changes start new placements without modifying selected events', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const nodes = new Map(), draft = { ...blank(), events: [event()] };
  const context = vm.createContext({
    placing: false, selectedEvents: new Set([0]), selectedBricks: new Set(), level: draft,
    touched: new Set(), readOnly: () => false,
    $: selector => {
      if (!nodes.has(selector)) nodes.set(selector, {
        value: '', dataset: { kind: 'food' },
        addEventListener(type, handler) { this[type] = handler; },
        setAttribute(name, value) { this[name] = value; },
      });
      return nodes.get(selector);
    },
    typeOptions() {}, showCategory(category) { context.activeCategory = category; },
    board: { dataset: {} },
    setSelection(events, bricks) {
      context.selectedEvents = new Set(events);
      context.selectedBricks = new Set(bricks);
    },
  });
  vm.runInContext(source.slice(source.indexOf('function resetObstructionSize('), source.indexOf('function populateObstructionFields(')), context);
  vm.runInContext(source.slice(source.indexOf('function startPlacement('), source.indexOf("$('#place-mode').addEventListener")), context);
  vm.runInContext(source.slice(source.indexOf("$('#event-kind').addEventListener('change'"), source.indexOf("for (const field of ['color', 'pattern', 'patternColor']) {", source.indexOf("$('#event-kind').addEventListener('change'"))), context);
  const before = JSON.stringify(draft);
  for (const selector of ['#event-kind', '#event-type']) {
    context.$('#event-width').value = '345'; context.$('#event-height').value = '123';
    context.selectedEvents = new Set([0]);
    context.placing = false;
    nodes.get('#event-kind').value = 'enemy';
    nodes.get(selector).change();
    assert.equal(context.placing, true);
    assert.equal(context.activeCategory, 'enemy');
    assert.equal(context.selectedEvents.size, 0);
    assert.equal(context.$('#event-width').value, '');
    assert.equal(context.$('#event-height').value, '');
    assert.equal(JSON.stringify(draft), before);
  }
  context.placing = false;
  context.selectedEvents = new Set([0]);
  nodes.get('#inspector-access').change();
  assert.equal(context.placing, false, 'editing selected events does not activate Place');
});

test('the Bricks menu never places the previously selected event on the playable area', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  let hint;
  const context = vm.createContext({
    activeCategory: 'brick', readOnly: () => false,
    message(text) { hint = text; },
    pointerPosition() { assert.fail('Brick category must not create an event'); },
  });
  vm.runInContext(source.slice(source.indexOf('function placeAt('), source.indexOf("board.addEventListener('pointerdown'")), context);
  context.placeAt({});
  assert.match(hint, /boundary brick/);
});

test('playtesting preserves the editor snapshot in history before navigating without requiring storage', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const draft = { ...blank(), events: [event()] };
  const href = `./index.html#level=${encodeURIComponent(JSON.stringify(draft))}`;
  let click, prevented = false;
  const calls = [], failures = [];
  const context = vm.createContext({
    level: draft, committed: 'old draft', dirty: true, location: {},
    readOnly: () => false, validateCustomLevel,
    validateSavedLevel: () => validateCustomLevel(draft, { requireCatBlockConsistency: true }),
    $: () => ({ href, addEventListener(type, handler) { assert.equal(type, 'click'); click = handler; } }),
    history: {
      state: { preserved: true },
      replaceState(state, title, url) { calls.push({ state, url }); },
    },
    attempt(action) { try { action(); } catch (error) { failures.push(error); } },
  });
  vm.runInContext(source.slice(source.indexOf("$('#playtest').addEventListener('click'"), source.indexOf("window.addEventListener('beforeunload'")), context);
  click({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(failures.length, 0);
  assert.deepEqual(calls, [{ state: { preserved: true }, url: href.slice('./index.html'.length) }]);
  assert.equal(context.location.href, href);
  assert.equal(context.dirty, false);
  assert.equal(context.committed, JSON.stringify(draft));

  context.dirty = true;
  delete context.location.href;
  context.history.replaceState = () => { throw new Error('History unavailable'); };
  click({ preventDefault() {} });
  assert.match(failures[0].message, /History unavailable/);
  assert.equal(context.location.href, undefined, 'failed snapshot preservation does not abandon the draft');
  assert.equal(context.dirty, true);
});

test('custom playtests expose a toolbar link back to the unchanged editor snapshot', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const hash = `#level=${encodeURIComponent(JSON.stringify({ ...blank(), events: [event()] }))}`;
  const nodes = new Map(), failures = [];
  const context = vm.createContext({
    location: { hash }, customLevel: null, validateCustomLevel, levelObjective,
    campaignMode: require('../src/campaign-mode.js'),
    levelSelect: { append() {} },
    document: {
      createElement: () => ({}),
      querySelector(selector) {
        if (!nodes.has(selector)) nodes.set(selector, { hidden: true });
        return nodes.get(selector);
      },
    },
    console: { error: (...args) => failures.push(args) },
  });
  vm.runInContext(source.slice(source.indexOf('function levelBriefingText('), source.indexOf('\nfunction showDialog(')), context);
  vm.runInContext(source.slice(source.indexOf("if (location.hash.startsWith('#level='))"), source.indexOf("if (location.hash.startsWith('#campaign='))")), context);
  assert.equal(failures.length, 0);
  assert.equal(nodes.get('#back-to-editor').hidden, false);
  assert.equal(nodes.get('#back-to-editor').href, `./editor.html?game=beta${hash}`);
  assert.equal(nodes.get('#editor-link').href, `./editor.html?game=beta${hash}`);
});

test('every selectable enemy has a board icon and a palette/spawner graphic', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const { spawnSymbol, spawnColor } = require('../src/brick-visuals.js');
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', dataset: {}, replaceChildren(...options) { this.options = options; } });
    return nodes.get(selector);
  };
  $('#event-kind').value = 'enemy';
  const context = vm.createContext({ $, MIXED: '', selectedEvents: new Set(), OBJECTS, CHARACTERS: require('../src/game.js').CHARACTERS,
    document: { createElement: () => ({}) }, picture: (value, control) => ({ value, control }) });
  vm.runInContext(source.slice(source.indexOf('function typeOptions('), source.indexOf('function readEvent(')), context);
  context.typeOptions();
  const icons = new Map();
  for (const { value: type } of $('#event-type').options) {
    const enemy = { kind: 'enemy', type };
    const icon = context.icon(enemy);
    if (['robo-snail', 'robo-cow', 'robo-unicorn', 'robo-crab', 'robo-love-bug', 'boss'].includes(type)) {
      assert.equal(icon.value, `enemy:${type}`);
      assert.equal(icon.control, 'brick-spawn-item');
    } else {
      assert.equal(typeof icon, 'string', `${type} board icon`);
      assert.ok(icon.length > 0 && !icon.includes('undefined'), `${type} visible board icon`);
    }
    assert.match(spawnSymbol(enemy), /^M/, `${type} palette/spawner SVG path`);
    assert.match(spawnColor(enemy), /^#[0-9a-f]{6}$/i, `${type} graphic color`);
    icons.set(type, icon);
  }
  assert.equal(icons.get('robo-koshi'), '🤖');
  assert.ok(icons.has('robo-snail'));
  assert.ok(icons.has('robo-cow'));
  assert.ok(icons.has('robo-unicorn'));
  assert.ok(icons.has('boss'));
  $('#event-kind').value = 'object';
  context.typeOptions();
  for (const type of ['bubble-blue', 'bubble-green', 'bubble-red']) {
    assert.ok($('#event-type').options.some(option => option.value === type));
    assert.equal(context.icon({ kind: 'object', type }), OBJECTS[type].icon);
  }
});

test('campaign editor previews use every real schedule and preserve the original game levels', () => {
  const { LEVELS } = require('../src/game.js');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const before = JSON.stringify(LEVELS);
  const context = vm.createContext({
    Game, carriedItem: event => event.carriesItem ?? (event.carriesCatBlock ? 'cat-block' : event.carriesKey ? 'key' : ''),
  });
  vm.runInContext(source.slice(source.indexOf('function campaignPreview('), source.indexOf('function syncAccess(')), context);
  for (const [index, campaign] of LEVELS.entries()) {
    const preview = context.campaignPreview(index);
    assert.equal(preview.id, campaign.id);
    assert.equal(preview.duration, campaign.duration);
    assert.equal(preview.goal, campaign.goal);
    assert.equal(preview.killGoal, campaign.killGoal);
    assert.equal(preview.survive, campaign.survive);
    assert.equal(preview.goalsGoal, campaign.goalsGoal);
    assert.equal(preview.activationLimit, campaign.activationLimit);
    assert.equal(preview.brickTypes, campaign.brickTypes);
    assert.equal(preview.brickGroups, campaign.brickGroups);
    assert.equal(preview.cutscene, campaign.cutscene);
    assert.equal(preview.events.length,
      campaign.food.reduce((sum, [, method]) => sum + (method === 'S' ? 1 : Number(method.slice(1))), 0)
      + campaign.enemies.reduce((sum, [, , count]) => sum + count, 0)
      + campaign.items.length + campaign.weapons.length + (campaign.events?.length ?? 0));
    for (const event of campaign.events ?? []) assert.ok(preview.events.includes(event));
    for (const event of preview.events.filter(event => !campaign.events?.includes(event))) {
      assert.equal(event.previewRandom, event.kind !== 'enemy' || event.type !== 'boss');
    }
    assert.equal(preview.events.filter(event => event.carriesItem === 'key').length,
      campaign.enemies.filter(entry => entry[4]?.carriesKey).length);
    assert.equal(preview.events.filter(event => event.carriesItem === 'cat-block').length,
      campaign.enemies.filter(entry => entry[4]?.carriesCatBlock).length);
    validateCustomLevel({ ...preview, version: 1 });
    assert.equal(JSON.stringify(context.campaignPreview(index)), JSON.stringify(preview), 'representative positions stay stable');
    for (const [kind, schedule] of [['food', campaign.food], ['enemy', campaign.enemies], ['item', campaign.items], ['weapon', campaign.weapons]]) {
      for (const [time, typeOrMethod, typeOrCount, lifetimeOrShield] of schedule) {
        const type = kind === 'food' ? typeOrCount : typeOrMethod;
        const matches = preview.events.filter(event => event.kind === kind && event.time === time && event.type === type);
        assert.ok(matches.length);
        if (kind === 'food') assert.ok(matches.every(event => event.lifetime === lifetimeOrShield));
        if (kind === 'enemy' && lifetimeOrShield) assert.ok(matches.every(event => event.shield === lifetimeOrShield));
      }
    }
    assert.ok(preview.events.every(event => Number.isFinite(event.x) && Number.isFinite(event.y)));
  }
  assert.equal(JSON.stringify(LEVELS), before);
});

test('enemy editor exposes one carried-item selector and resolves legacy carrier fields', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  assert.match(html, /id="event-carries-item"/);
  assert.doesNotMatch(html, /event-carries-cat-block|event-carries-key/);
  const options = [];
  const setup = source.slice(source.indexOf("$('#event-carries-item').append"), source.indexOf('let level = blank();'));
  const optionContext = vm.createContext({
    ITEMS, document: { createElement: () => ({}) },
    $: () => ({ append: (...items) => options.push(...items) }),
  });
  vm.runInContext(setup, optionContext);
  assert.deepEqual(options.map(option => option.value), Object.keys(ITEMS));
  assert.match(html, /<option value="">None<\/option>/);
  const context = vm.createContext({});
  vm.runInContext(`${source.slice(source.indexOf('const carriedItem ='), source.indexOf('const board ='))}\nglobalThis.testCarriedItem = carriedItem;`, context);
  assert.equal(context.testCarriedItem({ carriesItem: 'battery', carriesKey: true }), 'battery');
  assert.equal(context.testCarriedItem({ carriesCatBlock: true }), 'cat-block');
  assert.equal(context.testCarriedItem({ carriesKey: true }), 'key');
  assert.equal(context.testCarriedItem({}), '');
});

test('read-only campaign controls lock all write surfaces but leave inspection available', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { disabled: false, hidden: false, setAttribute() {} });
    return nodes.get(selector);
  };
  let locked = true;
  const accessFields = ['#settings-access', '#cutscene-access', '#level-info-access', '#inspector-access', '#files-access'];
  const writeButtons = ['#place-mode', '#new-level'];
  const board = { dataset: {} };
  const context = vm.createContext({ $, board, accessFields, writeButtons, readOnly: () => locked, level: { id: '1-19', name: 'Finale' } });
  vm.runInContext(source.slice(source.indexOf('function syncAccess('), source.indexOf('function selectEditorLevel(')), context);
  context.syncAccess();
  for (const selector of [...accessFields, ...writeButtons]) assert.equal($(selector).disabled, true);
  for (const selector of accessFields) assert.ok(html.includes(`<fieldset id="${selector.slice(1)}"`));
  assert.equal(board.dataset.readOnly, 'true');
  assert.equal($('#playtest').textContent, 'Play game level →');
  for (const selector of ['#editor-level', '#timeline', '#orientation', '#show-all', '#show-random', '#select-mode']) assert.equal($(selector).disabled, false);
  locked = false; context.syncAccess();
  for (const selector of [...accessFields, ...writeButtons]) assert.equal($(selector).disabled, false);
  assert.equal(board.dataset.readOnly, 'false');
  for (const fn of ['markChanged', 'moveEvent', 'placeAt', 'startPlacement', 'deleteSelected']) {
    assert.match(source.slice(source.indexOf(`function ${fn}(`)), /^function [^{]+\{\s+if \(readOnly\(\)\) return;/);
  }
  assert.ok(source.includes("if (readOnly()) { down.stopPropagation(); return; }"), 'campaign markers cannot be dragged');
});

test('campaign play links choose the original game level and malformed links report an error', () => {
  const { LEVELS } = require('../src/game.js');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const start = source.indexOf("if (location.hash.startsWith('#campaign='))");
  const script = source.slice(start, source.indexOf('function layoutOptions()', start));
  for (const [hash, expected] of [
    ['#campaign=1-19', '18'], ['#campaign=1-34', '33'], ['#campaign=2-1', '10'], ['#campaign=2-9', '18'],
    ['#campaign=2-24', '33'], ['#campaign=unknown', null], ['#campaign=%', null],
  ]) {
    const levelSelect = { value: '0' }, error = { hidden: true }, failures = [];
    const context = vm.createContext({ location: { hash }, LEVELS, levelSelect,
      document: { querySelector: () => error }, console: { error: (...args) => failures.push(args) } });
    vm.runInContext(script, context);
    if (expected) { assert.equal(levelSelect.value, expected); assert.equal(error.hidden, true); }
    else { assert.equal(error.hidden, false); assert.equal(failures.length, 1); }
  }
});

test('campaign links prefer fixed IDs when reassignment reuses a former level number', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const start = source.indexOf("if (location.hash.startsWith('#campaign='))");
  const script = source.slice(start, source.indexOf('function layoutOptions()', start));
  const levels = [
    { id: '1-2', number: '1-1', name: 'Moved mouse' },
    { id: '1-1', number: 'bonus-1', name: 'Moved breakfast' },
  ];
  for (const hash of ['#campaign=1-1', '#campaign=bonus-1']) {
    const levelSelect = { value: '0' };
    const context = vm.createContext({ location: { hash }, LEVELS: levels, levelSelect });
    vm.runInContext(script, context);
    assert.equal(levelSelect.value, '1');
  }
  const editor = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  assert.match(editor, /#campaign=\$\{encodeURIComponent\(level\.id\)\}/);
});

test('editor saves turret variants and preserves contact-surface exclusivity', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', checked: false,
      querySelector: () => null, replaceChildren() {} });
    return nodes.get(selector);
  };
  const regionKey = region => `${region.edge}:${region.start}:${region.end}`;
  const context = vm.createContext({ $, Game, OBJECTS, brickEditRegions, brickRegions, COOLDOWNS, regionKey, combineOwner: null,
    CONTACT_SURFACES: require('../src/game.js').CONTACT_SURFACES, MIXED: '',
    immutableBrick: kind => ['cinder', 'goal'].includes(kind),
    resetObstructionSize() {},
    common: values => values.every(value => value === values[0]) ? values[0] : '',
    validateDraft: value => validateCustomLevel(value, { allowUnpairedPortals: true }),
    attempt: action => action(), markChanged() {}, renderBoard() {}, setSelection() {}, message() {},
  });
  vm.runInContext(source.slice(source.indexOf('function brickEntry('), source.indexOf('function splitBricks(')), context);
  const level = blank(), game = new Game(() => .5, { customLevel: level });
  const brick = game.bricks[0], region = brickEditRegions(game.bricks).get(brick.id);
  context.level = level; context.previewGame = game; context.selectedBricks = new Set([regionKey(region)]);
  $('#brick-turret').checked = true;
  $('#brick-turret-type').value = 'fireball';
  context.saveBrick({ target: { id: 'brick-turret' } });
  assert.equal(context.level.brickTypes[0].turret, 'fireball');
  $('#brick-turret-type').value = 'laser';
  context.saveBrick({ target: { id: 'brick-turret-type' } });
  assert.equal(context.level.brickTypes[0].turret, 'laser');
  $('#brick-springs').checked = true;
  context.saveBrick({ target: { id: 'brick-springs' } });
  assert.equal(context.level.brickTypes[0].turret, null);
  assert.equal(context.level.brickTypes[0].springs, true);
  assert.equal(new Game(() => .5, { customLevel: context.level }).bricks[brick.id].springs, true);
});

test('enemy shields round-trip in placements and spawners and initialize their full score value', () => {
  for (const shield of [null, 'red', 'green', 'blue']) {
    const source = { ...blank(), events: [{ ...event('enemy', 'ram'), shield }],
      brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'enemy', type: 'bucket', shield } }] };
    const normalized = validateCustomLevel(JSON.parse(JSON.stringify(source)));
    assert.deepEqual(normalized.events, source.events);
    assert.deepEqual(normalized.brickTypes, source.brickTypes);
    const game = new Game(() => .5, { customLevel: normalized });
    const enemy = game.createCustomSpawn(normalized.events[0])[0];
    assert.equal(enemy.shield, shield);
    assert.equal(enemy.defeatPoints, shield === 'blue' ? 4 : shield === 'green' ? 3 : shield === 'red' ? 2 : 1);
    const brick = game.bricks.find(brick => brick.spawner);
    game.spawnFromBrick(brick);
    assert.equal(game.robots[0].shield, shield);
    assert.equal(game.robots[0].defeatPoints, enemy.defeatPoints);
  }
  for (const shield of ['yellow', false, 3, {}]) {
    assert.throws(() => validateCustomLevel({ ...blank(), events: [{ ...event('enemy', 'mouse'), shield }] }), /shield/);
  }
  assert.throws(() => validateCustomLevel({ ...blank(), events: [{ ...event(), shield: 'red' }] }), /shield/);
});

test('win conditions validate and round-trip without changing older level JSON', () => {
  for (const patch of [{ goal: 20 }, { goal: 0, killGoal: 30 }, { goal: 20, killGoal: 30 },
    { goal: 0, survive: true }, { goal: 0, killGoal: 0, survive: true }]) {
    const source = { ...blank(), ...patch };
    assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(source))), source);
  }
  for (const patch of [{ goal: 0 }, { goal: 0, killGoal: 0 }, { killGoal: -1 },
    { killGoal: 1.5 }, { killGoal: '30' }, { killGoal: Infinity }, { killGoal: 100001 },
    { survive: 'true' }, { survive: true }, { goal: 0, killGoal: 1, survive: true }]) {
    assert.throws(() => validateCustomLevel({ ...blank(), ...patch }), TypeError);
  }
  assert.deepEqual(validateCustomLevel(blank()), blank());
});

test('food-only, enemy-only, and combined objectives win only when all required scores are met', () => {
  for (const targets of [{ goal: 2 }, { goal: 0, killGoal: 2 }, { goal: 2, killGoal: 2 }]) {
    const game = new Game(() => .5, { customLevel: { ...blank(), ...targets } });
    game.start(); game.update(.01);
    assert.equal(game.state, 'playing');
    game.score = targets.goal;
    if (targets.killGoal) {
      game.update(.01);
      assert.equal(game.state, 'playing', 'food cannot satisfy an enemy objective');
      game.enemies = targets.killGoal;
      if (targets.goal) {
        game.score = 0; game.update(.01);
        assert.equal(game.state, 'playing', 'enemy defeats cannot satisfy a food objective');
        game.score = targets.goal;
      }
    }
    game.update(.01);
    assert.equal(game.state, 'won');
    game.reset(); game.start(); game.update(30);
    assert.equal(game.state, 'lost', 'unmet scores lose at the time limit');
  }
});

test('survival wins exactly at timeout, freezes on pause, resets, and never overrides death', () => {
  const create = () => new Game(() => .5, { customLevel: { ...blank(), duration: 1, goal: 0, survive: true } });
  const game = create(); game.start(); game.update(.5);
  assert.equal(game.state, 'playing');
  game.score = 100; game.enemies = 100;
  game.pause(); game.update(10);
  assert.equal(game.elapsed, .5);
  game.resume(); game.update(.49);
  assert.equal(game.state, 'playing');
  game.update(.01);
  assert.equal(game.state, 'won');
  assert.equal(game.elapsed, 1);
  game.reset();
  assert.equal(game.elapsed, 0);
  assert.equal(game.state, 'ready');
  for (const lose of [g => { g.hearts = 0; }, g => { g.cat.x = -100; }]) {
    const dying = create(); dying.start(); dying.elapsed = 1 - 1 / 120;
    lose(dying); dying.update(1 / 120);
    assert.equal(dying.state, 'lost', 'death at the deadline takes priority over survival');
  }
});

test('briefings clearly state each available win condition', () => {
  assert.equal(levelObjective({ duration: 60, goal: 20 }), 'Collect 20 food before time runs out (60 seconds)');
  assert.equal(levelObjective({ duration: 60, goal: 0, killGoal: 30 }), 'Earn 30 enemy points before time runs out (60 seconds)');
  assert.equal(levelObjective({ duration: 60, goal: 20, killGoal: 30 }), 'Collect 20 food and earn 30 enemy points before time runs out (60 seconds)');
  assert.equal(levelObjective({ duration: 60, goal: 0, survive: true }), 'Survive for 60 seconds until the timer reaches zero');
});

test('HUD marks only required score targets or the survival timer and tracks objective progress', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const start = source.indexOf('  const { goal: GOAL');
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) {
      const classes = new Set();
      nodes.set(selector, { textContent: '', innerHTML: '', style: {}, attributes: {},
        classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) },
        setAttribute(name, value) { this.attributes[name] = value; } });
    }
    return nodes.get(selector);
  };
  const game = { level: {}, score: 10, enemies: 15, goals: 10, elapsed: 30, timeLimit: 60, hearts: 3, batteries: 0 };
  const context = vm.createContext({ game, levelObjective, WORLDS: require('../src/worlds.js').WORLDS, document: { querySelector: node },
    timer: node('#timer'), foodCount: node('#food-count'), hearts: node('#hearts'),
    progress: node('#progress'), progressLabel: node('#progress-label') });
  const hud = source.slice(start, source.indexOf('  const weaponCount', start));
  for (const [patch, targets, progress] of [
    [{ goal: 20 }, [false, true, false, false], '50%'],
    [{ goal: 0, killGoal: 30 }, [false, false, true, false], '50%'],
    [{ goal: 20, killGoal: 60 }, [false, true, true, false], '25%'],
    [{ goal: 0, goalsGoal: 20 }, [false, false, false, true], '50%'],
    [{ goal: 20, killGoal: 60, goalsGoal: 40 }, [false, true, true, true], '25%'],
    [{ goal: 0, survive: true }, [true, false, false, false], '50%'],
  ]) {
    game.level = { id: 'HUD preview', duration: 60, ...patch };
    vm.runInContext(`{${hud}}`, context);
    ['#timer', '#food-count', '#enemy-count', '#goal-count'].forEach((id, i) => assert.equal(node(id).classList.contains('win-target'), targets[i]));
    assert.equal(node('#progress').style.width, progress);
    assert.equal(node('#food-count').innerHTML.includes(`/ ${patch.goal}`), targets[1]);
    assert.equal(node('#enemy-count').textContent.includes(`/ ${patch.killGoal}`), targets[2]);
    assert.equal(node('#goal-count').textContent.includes(`/ ${patch.goalsGoal}`), targets[3]);
    if (targets[3]) {
      assert.equal(node('#goal-count').attributes['aria-label'], `${game.goals} of ${patch.goalsGoal} goals scored`);
    }
    assert.equal(node('.objective strong').textContent, levelObjective(game.level));
  }
  game.level = { id: 'Heart progress', duration: 60, goal: 100, heartCost: 10 };
  for (const [score, nextHeart, earned] of [[0, 10, 0], [4, 10, 4], [10, 20, 0], [24, 30, 4]]) {
    game.score = score; game.nextHeart = nextHeart;
    vm.runInContext(`{${hud}}`, context);
    assert.equal(node('#heart-cost').hidden, false);
    assert.equal(node('#heart-cost-numbers').textContent, `${earned}/10`);
    assert.equal(node('#heart-cost-fill').style.width, `${earned * 10}%`);
    assert.equal(node('#heart-cost-meter').attributes['aria-valuenow'], earned);
    assert.equal(node('#heart-cost-meter').attributes['aria-valuemax'], 10);
  }
  for (const heartCost of [null, Infinity]) {
    game.level.heartCost = heartCost;
    vm.runInContext(`{${hud}}`, context);
    assert.equal(node('#heart-cost').hidden, true);
  }
});

test('editor settings select exclusive survival or score targets and preserve imported targets', () => {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', disabled: false, listeners: {},
      replaceChildren() {}, checkValidity: () => true,
      addEventListener(type, listener) { this.listeners[type] = listener; } });
    return nodes.get(selector);
  };
  const messages = [];
  const context = vm.createContext({ $, level: blank(), CAT_BLOCK_MESSAGES, CAT_BLOCK_TRIGGERS, catBlockDescription, validateDraft: validateCustomLevel,
    readOnly: () => false,
    attempt: action => action(), markChanged() {}, render() {}, message: text => messages.push(text) });
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf("$('#settings-form').addEventListener"), source.indexOf('function addSceneLine(')), context);
  context.populateSettings();
  const apply = () => $('#settings-form').listeners.submit({ preventDefault() {} });
  $('#win-condition').value = 'survive';
  $('#win-condition').listeners.change();
  assert.equal($('#goal').disabled, true);
  assert.equal($('#kill-goal').disabled, true);
  assert.equal($('#goals-goal').disabled, true);
  apply();
  assert.equal(context.level.survive, true); assert.equal(context.level.goal, 0); assert.equal(context.level.killGoal, 0);
  $('#win-condition').value = 'scores'; $('#win-condition').listeners.change();
  assert.equal($('#goal').disabled, false);
  assert.equal($('#goals-goal').disabled, false);
  $('#kill-goal').value = '30';
  apply();
  assert.equal(context.level.survive, false); assert.equal(context.level.goal, 0); assert.equal(context.level.killGoal, 30);
  context.level = { ...blank(), killGoal: 10, goalsGoal: 3 };
  context.populateSettings();
  assert.equal($('#goal').value, 50); assert.equal($('#kill-goal').value, 10);
  assert.equal($('#goals-goal').value, 3);
  assert.equal($('#win-condition').value, 'scores');
  $('#goal').value = '0'; $('#kill-goal').value = '0'; $('#goals-goal').value = '2';
  apply();
  assert.equal(context.level.goalsGoal, 2);
  assert.equal(context.level.goal, 0);
  assert.equal(context.level.killGoal, 0);
  $('#goals-goal').value = '1.5';
  const saved = JSON.stringify(context.level);
  assert.throws(apply, /soccer|goal/i);
  assert.equal(JSON.stringify(context.level), saved);
  $('#win-condition').value = 'survive';
  apply();
  assert.equal(context.level.goalsGoal, 0);
  assert.equal(context.level.survive, true);
  assert.equal(messages.length, 4);
});

test('desktop rotates phone bricks clockwise with stable IDs, edit slots, attributes, and adjacency', () => {
  const desktop = new Game(Math.random, { customLevel: blank() });
  const expected = brickEditRegions(desktop.bricks);
  const desktopRegions = brickRegions(desktop.bricks, desktop.width, desktop.height);
  const counts = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const region of desktopRegions.values()) counts[region.edge]++;
  assert.deepEqual(counts, { top: 8, bottom: 8, left: 5, right: 5 });
  const rotatedEdges = { top: 'right', right: 'bottom', bottom: 'left', left: 'top' };
  for (const scale of [.31, .36, .46, .57, .64, 1]) {
    const phone = new Game(Math.random, { portrait: true, scale, customLevel: blank() });
    const phoneRegions = brickRegions(phone.bricks, phone.width, phone.height);
    const phoneCounts = { top: 0, bottom: 0, left: 0, right: 0 };
    for (const region of phoneRegions.values()) phoneCounts[region.edge]++;
    assert.deepEqual(phoneCounts, { top: 5, bottom: 5, left: 8, right: 8 });
    assert.equal(phone.bricks.length, 26);
    assert.deepEqual(brickEditRegions(phone.bricks), expected);
    assert.deepEqual(phone.bricks.map(b => b.kind), desktop.bricks.map(b => b.kind));
    for (const [id, region] of phoneRegions) {
      const actual = desktopRegions.get(id);
      assert.equal(actual.edge, rotatedEdges[region.edge]);
      const reversed = region.edge === 'right' || region.edge === 'left';
      assert.ok(Math.abs(actual.start - (reversed ? 1 - region.end : region.start)) < 1e-9);
      assert.ok(Math.abs(actual.end - (reversed ? 1 - region.start : region.end)) < 1e-9);
    }
    const next = game => new Map(game.perimeter.map((id, i) => [id, game.perimeter[(i + 1) % 26]]));
    assert.deepEqual(next(desktop), next(phone));
    for (const brick of desktop.bricks) {
      const level = { ...blank(), brickTypes: [{ ...expected.get(brick.id), kind: 'fast', crumbler: 5, warped: 15 }] };
      const editedDesktop = new Game(Math.random, { customLevel: level });
      const editedPhone = new Game(Math.random, { portrait: true, scale, customLevel: level });
      assert.deepEqual(editedPhone.bricks.map(b => b.kind), editedDesktop.bricks.map(b => b.kind));
      for (const game of [editedDesktop, editedPhone]) {
        assert.deepEqual(game.bricks.filter(b => b.crumbler === 5 && b.warped === 15).map(b => b.id), [brick.id]);
      }
    }
  }
  for (const brick of desktop.bricks) {
    assert.ok(brick.x >= 0 && brick.y >= 0 && brick.w > 0 && brick.h > 0);
    assert.ok(brick.x + brick.w <= desktop.width && brick.y + brick.h <= desktop.height);
  }
  assert.deepEqual(
    (({ x, y, w, h }) => ({ x, y, w, h }))(desktop.bricks[0]),
    { x: 907, y: 8, w: 45, h: (600 - 16 - 32) / 5 },
  );
});

test('individual brick overrides round-trip, affect only their brick, and set real cooldowns', () => {
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
    const base = new Game(Math.random, { ...options, customLevel: blank() });
    const regions = brickEditRegions(base.bricks);
    for (const target of base.bricks) {
      for (const kind of Object.keys(COOLDOWNS)) {
        const level = { ...blank(), brickTypes: [{ ...regions.get(target.id), kind }] };
        const validated = validateCustomLevel(JSON.parse(JSON.stringify(level)));
        assert.deepEqual(validated.brickTypes, level.brickTypes);
        const game = new Game(Math.random, { ...options, customLevel: validated });
        for (const brick of game.bricks) assert.equal(brick.kind, brick.id === target.id ? kind : base.bricks[brick.id].kind);
        game.start();
        const brick = game.bricks[target.id];
        assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
        assert.equal(brick.readyAt, COOLDOWNS[kind]);
        game.reset();
        assert.equal(game.bricks[target.id].kind, kind);
      }
    }
  }
});

test('brick overrides map across layouts, remain on their edge, and use the latest overlapping edit', () => {
  const level = { ...blank(), brickTypes: [
    { edge: 'top', start: 0, end: 1, kind: 'slow' },
    { edge: 'top', start: .1, end: .101, kind: 'fast' },
  ] };
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
    const base = new Game(Math.random, { ...options, customLevel: blank() });
    const game = new Game(Math.random, { ...options, customLevel: level });
    const regions = brickEditRegions(game.bricks);
    const top = game.bricks.filter(brick => regions.get(brick.id).edge === 'top');
    assert.ok(top.some(brick => brick.kind === 'fast'));
    assert.ok(top.every(brick => ['slow', 'fast'].includes(brick.kind)));
    for (const brick of game.bricks.filter(brick => regions.get(brick.id).edge !== 'top')) assert.equal(brick.kind, base.bricks[brick.id].kind);
  }
});

test('invalid brick overrides are rejected and older JSON without overrides is unchanged', () => {
  const valid = { edge: 'top', start: 0, end: .5, kind: 'fast' };
  for (const entry of [null, {}, { ...valid, edge: 'center' }, { ...valid, kind: 'toString' }, { ...valid, start: -.1 }, { ...valid, end: 2 }, { ...valid, end: NaN }, { ...valid, start: .5 }, { ...valid, start: '0' }]) {
    assert.throws(() => validateCustomLevel({ ...blank(), brickTypes: [entry] }), TypeError);
  }
  assert.throws(() => validateCustomLevel({ ...blank(), brickTypes: {} }), TypeError);
  assert.throws(() => validateCustomLevel({ ...blank(), brickTypes: Array(2001).fill(valid) }), TypeError);
  assert.deepEqual(validateCustomLevel(blank()), blank());
});

test('portable level schema round-trips JSON, normalizes input, and keeps source data independent', () => {
  const source = { ...blank(), id: '  Test level  ', events: [event()] };
  const result = validateCustomLevel(JSON.parse(JSON.stringify(source)));
  assert.equal(result.id, 'Test level');
  assert.equal(result.heartCost, null);
  assert.deepEqual(result.events, source.events);
  result.events[0].x = .9;
  assert.equal(source.events[0].x, .2);
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(result))), result);
  const fragment = encodeURIComponent(JSON.stringify(result));
  assert.deepEqual(validateCustomLevel(JSON.parse(decodeURIComponent(fragment))), result);
});

test('invalid settings and placements are rejected explicitly before mutating game state', () => {
  for (const patch of [
    { version: 2 }, { id: '' }, { id: 'x'.repeat(61) }, { duration: 0 }, { duration: Infinity },
    { goal: 0 }, { goal: 1.5 }, { heartCost: 0 }, { heartCost: -1 }, { heartCost: Infinity }, { brickSet: 2 },
    { events: null }, { events: Array.from({ length: 2001 }, () => event()) },
  ]) assert.throws(() => validateCustomLevel({ ...blank(), ...patch }), TypeError);
  for (const patch of [
    { time: -1 }, { time: 30 }, { time: NaN }, { x: -1 }, { x: 1.01 }, { y: undefined }, { x: '0.5' },
    { kind: 'unknown' }, { kind: '__proto__' }, { type: 'toString' }, { lifetime: 0 }, { lifetime: Infinity },
    { kind: 'enemy', type: 'wheel' }, { kind: 'weapon', type: 'banana' },
  ]) assert.throws(() => new Game(Math.random, { customLevel: { ...blank(), events: [{ ...event(), ...patch }] } }), TypeError);
  for (const value of [null, [], 'level']) assert.throws(() => validateCustomLevel(value), TypeError);
});

test('custom events are stable-sorted, spawn once at exact times, and work at time zero', () => {
  const level = { ...blank(), events: [event('food', 'P', 4), event('weapon', 'wood', 0), event('food', 'S', 2), event('weapon', 'silver', 2)] };
  const game = new Game(() => .5, { customLevel: level });
  assert.equal(game.weapons.length, 0);
  game.start();
  assert.equal(game.weapons[0].type, 'wood');
  assert.equal(game.nextCustom, 1);
  game.update(1.99);
  assert.equal(game.food.length, 0);
  game.update(.02);
  assert.deepEqual(game.food.map(f => f.type), ['S']);
  assert.deepEqual(game.weapons.map(w => w.type), ['wood', 'silver']);
  game.update(2);
  assert.deepEqual(game.food.map(f => f.type), ['S', 'P']);
  assert.equal(game.nextCustom, 4);
  game.pause(); game.update(10);
  assert.ok(game.elapsed < 4.1);
  game.resume(); game.update(4);
  assert.deepEqual(game.food.map(f => f.type), ['P']);
  assert.equal(game.weapons.length, 2);
  game.reset(); game.start();
  assert.equal(game.weapons.length, 1);
  assert.equal(game.nextCustom, 1);
  assert.equal(game.level.id, level.id);
  assert.equal(game.levelIndex, -1);
});

test('custom normalized placements keep the same relative safe-area positions in both orientations', () => {
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
    const level = { ...blank(), events: [event('food', 'F', 0), event('weapon', 'gold', 0), event('enemy', 'mouse', 0), event('enemy', 'ram', 0), event('enemy', 'bucket', 0)] };
    const game = new Game(() => .5, { ...options, customLevel: level });
    game.start();
    const b = game.bounds();
    for (const item of [...game.food, ...game.weapons, ...game.robots]) {
      assert.ok(Math.abs((item.x - b.left) / (b.right - b.left) - .2) < 1e-8);
      assert.ok(Math.abs((item.y - b.top) / (b.bottom - b.top) - .7) < 1e-8);
      for (const brick of game.bricks) {
        const x = Math.max(brick.x, Math.min(brick.x + brick.w, item.x));
        const y = Math.max(brick.y, Math.min(brick.y + brick.h, item.y));
        assert.ok(Math.hypot(item.x - x, item.y - y) >= 25);
      }
    }
    assert.equal(game.bricks.filter(b => b.kind === 'slow').length, 3);
    assert.equal(game.bricks.filter(b => b.kind === 'fast').length, 3);
  }
});

test('fixed campaign placements rotate with the board on desktop', () => {
  const { LEVELS } = require('../src/game.js');
  const levelIndex = LEVELS.findIndex(level => level.name === 'Jackolantern junkyard');
  const positions = [];
  for (const portrait of [true, false]) {
    const game = new Game(() => .5, { level: levelIndex, portrait, scale: .625 });
    game.start();
    const bounds = game.bounds();
    positions.push(new Map(['obstruction-circle-large', 'obstruction-diamond-large'].map(type => {
      const event = game.level.events.find(entry => entry.type === type);
      const obstruction = game.obstructions.find(entry => entry.type === type);
      assert.ok(obstruction, `the time-zero ${type} spawns`);
      return [type, {
        x: (obstruction.x - bounds.left) / (bounds.right - bounds.left),
        y: (obstruction.y - bounds.top) / (bounds.bottom - bounds.top),
        source: [event.x, event.y],
      }];
    })));
  }
  for (const type of ['obstruction-circle-large', 'obstruction-diamond-large']) {
    const phone = positions[0].get(type), desktop = positions[1].get(type);
    assert.ok(Math.abs(phone.x - phone.source[0]) < 1e-8);
    assert.ok(Math.abs(phone.y - phone.source[1]) < 1e-8);
    assert.ok(Math.abs(desktop.x - (1 - phone.source[1])) < 1e-8);
    assert.ok(Math.abs(desktop.y - phone.source[0]) < 1e-8);
  }
});

test('wheel and snake placements snap to an edge and begin at that exact perimeter position', () => {
  for (const options of [{}, { portrait: true, scale: .35 }]) {
    for (const type of ['wheel', 'snake']) {
      for (const [x, y] of [[.1, .5], [.9, .5], [.5, .1], [.5, .9], [0,0], [1,1]]) {
        const snapped = snapWheel(x, y);
        const level = { ...blank(), events: [{ ...event('enemy', type, 0), ...snapped }] };
        const game = new Game(() => .5, { ...options, customLevel: level });
        game.start();
        const point = game.pointFromRelative(snapped.x, snapped.y);
        assert.ok(Math.abs(game.robots[0].x - point.x) < 1e-8, type);
        assert.ok(Math.abs(game.robots[0].y - point.y) < 1e-8, type);
        game.update(.1);
        assert.notDeepEqual({ x: game.robots[0].x, y: game.robots[0].y }, point);
      }
    }
  }
});

test('custom objectives, duration, heart costs, and every pickup type use the real engine', () => {
  for (const type of Object.keys(FOODS)) {
    const game = new Game(() => .1, { customLevel: { ...blank(), goal: FOODS[type].value, heartCost: 1, events: [{ ...event('food', type, 0), x: .5, y: .5 }] } });
    game.start(); game.update(.01);
    assert.equal(game.state, 'won');
    assert.equal(game.score, FOODS[type].value);
    assert.equal(game.healing.length, 0);
    assert.equal(game.spawnCues.filter(cue => cue.kind === 'heart').length, FOODS[type].value);
  }
  for (const type of Object.keys(WEAPONS)) {
    const game = new Game(() => .1, { customLevel: { ...blank(), events: [{ ...event('weapon', type, 0), x: .5, y: .5 }] } });
    game.start(); game.update(.01);
    assert.equal(game.weapon.type, type);
  }
  const game = new Game(() => .5, { customLevel: { ...blank(), duration: 1.5 } });
  game.start(); game.update(2);
  assert.equal(game.elapsed, 1.5);
  assert.equal(game.state, 'lost');
  assert.equal(game.nextHeart, Infinity);
});

test('editor lifetime fields omit blank values, preserve mixed durations, and explicitly clear optional lifetimes', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const inputs = new Map();
  const $ = selector => {
    if (!inputs.has(selector)) inputs.set(selector, {
      value: '', placeholder: '', disabled: false, required: false,
      dataset: {},
      querySelector: () => null, replaceChildren() {}, prepend() {},
    });
    return inputs.get(selector);
  };
  const context = vm.createContext({
    $, FOODS, SWORDS, WEAPONS, ITEMS: require('../src/game.js').ITEMS, OBJECTS: require('../src/game.js').OBJECTS, CHARACTERS, SHIELDS: {},
    carriedItem: event => event.carriesItem ?? (event.carriesCatBlock ? 'cat-block' : event.carriesKey ? 'key' : ''),
    CARRIED_ITEM_MIXED: '__mixed-carried-item__',
    snapWheel,
    document: { createElement: () => ({}) }, MIXED: '',
    level: blank(), selectedEvents: new Set(), touched: new Set(),
    common: values => values.every(value => value === values[0]) ? values[0] : '',
    selectedList: () => [...context.selectedEvents],
    mixedOption: () => {}, syncPalettes() {}, readOnly: () => false,
    validateDraft: validateCustomLevel, markChanged() {}, setSelection() {}, message() {},
    plural: (count, word) => `${count} ${word}s`,
  });
  vm.runInContext(source.slice(source.indexOf('function typeOptions('), source.indexOf('function description(')), context);
  vm.runInContext(source.slice(source.indexOf('function readEvent('), source.indexOf('function setSelection(')), context);
  vm.runInContext(source.slice(source.indexOf('function applyToSelected('), source.indexOf('function applyEventChanges(')), context);
  $('#event-location').value = 'fixed'; $('#event-formation').value = 'single';
  $('#event-time').value = '2'; $('#event-x').value = '20'; $('#event-y').value = '70';
  for (const [kind, type] of [['item', 'battery'], ['weapon', 'gold']]) {
    $('#event-kind').value = kind; context.typeOptions(type);
    $('#event-type').value = type;
    assert.equal($('#event-lifetime').disabled, false);
    assert.equal($('#event-lifetime').required, false);
    assert.ok(!Object.hasOwn(context.readEvent(), 'lifetime'));
    $('#event-lifetime').value = '3.5';
    assert.equal(context.readEvent().lifetime, 3.5);
    context.level = { ...blank(), events: [
      { ...event(kind, type), lifetime: 4 },
      { ...event(kind, type), lifetime: 8 },
    ] };
    context.selectedEvents = new Set([0, 1]);
    context.populateEventForm();
    assert.equal($('#event-lifetime').value, '');
    assert.equal($('#event-lifetime').placeholder, 'Mixed');
    $('#event-x').value = '40'; context.touched.add('#event-x');
    context.applyToSelected();
    assert.deepEqual(Array.from(context.level.events, event => event.lifetime), [4, 8], 'untouched mixed field preserves values');
    context.touched.clear(); context.touched.add('#event-lifetime');
    context.applyToSelected();
    assert.ok(context.level.events.every(event => !Object.hasOwn(event, 'lifetime')), 'touched blank removes optional lifetime');
    context.selectedEvents = new Set([0]); context.populateEventForm();
    assert.equal($('#event-lifetime').value, '', 'single indefinite event must not default to five seconds');
    assert.equal($('#event-lifetime').required, false);
    context.selectedEvents.clear();
  }
  $('#event-kind').value = 'food'; context.typeOptions('S');
  assert.equal($('#event-lifetime').required, true);
  context.level = { ...blank(), events: [event(), event()] };
  context.selectedEvents = new Set([0, 1]); context.touched = new Set(['#event-lifetime']);
  $('#event-lifetime').value = '';
  assert.throws(() => context.applyToSelected(), /Food needs a lifetime/);
  context.selectedEvents.clear();
  $('#event-kind').value = 'object'; context.typeOptions('soccer-ball');
  $('#event-type').value = 'soccer-ball';
  $('#event-lifetime').value = '10'; $('#event-shield').value = 'blue';
  assert.equal($('#event-lifetime').disabled, true);
  assert.equal($('#lifetime-label').hidden, true);
  assert.equal($('#event-shield').disabled, true);
  assert.equal($('#shield-label').hidden, true);
  const ball = context.readEvent();
  assert.equal(ball.kind, 'object');
  assert.equal(ball.type, 'soccer-ball');
  assert.ok(!Object.hasOwn(ball, 'lifetime'));
  assert.ok(!Object.hasOwn(ball, 'shield'));
  context.level = { ...blank(), events: [event(), { ...event('enemy', 'mouse'), shield: 'blue' }] };
  context.selectedEvents = new Set([0, 1]);
  context.touched = new Set(['#event-kind', '#event-type']);
  context.applyToSelected();
  assert.ok(context.level.events.every(event => event.kind === 'object' && event.type === 'soccer-ball'));
  assert.ok(context.level.events.every(event => !Object.hasOwn(event, 'lifetime') && !Object.hasOwn(event, 'shield')));
  context.populateEventForm();
  assert.equal($('#event-lifetime').disabled, true);
  assert.equal($('#event-shield').disabled, true);
  context.level = { ...blank(), events: [
    { ...event('enemy', 'mouse'), carriesItem: 'key' },
    { ...event('enemy', 'mouse'), carriesItem: 'cat-block' },
  ] };
  context.selectedEvents = new Set([0, 1]);
  context.populateEventForm();
  assert.equal($('#event-carries-item').value, '__mixed-carried-item__');
  context.level = { ...blank(), events: [event('enemy', 'mouse')] };
  context.selectedEvents = new Set([0]);
  context.populateEventForm();
  assert.equal($('#event-carries-item').value, '', 'None remains distinct from Mixed');
});

test('snake event selectors and editor placements use Wheel edge snapping', () => {
  const { spawnSymbol, spawnColor, specialLabel } = require('../src/brick-visuals.js');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const inputs = new Map();
  const $ = selector => {
    if (!inputs.has(selector)) inputs.set(selector, { value: '', dataset: {}, querySelector: () => null, replaceChildren() {}, prepend() {} });
    return inputs.get(selector);
  };
  const context = vm.createContext({
    $, FOODS, SWORDS, WEAPONS, CHARACTERS: require('../src/game.js').CHARACTERS, ITEMS: require('../src/game.js').ITEMS, OBJECTS: require('../src/game.js').OBJECTS, SHIELDS: {}, snapWheel,
    document: { createElement: () => ({}) }, MIXED: '', selectedEvents: new Set(), selectedBricks: new Set(),
    touched: new Set(), level: blank(), readOnly: () => false, syncPalettes() {},
  });
  vm.runInContext(source.slice(source.indexOf('function typeOptions('), source.indexOf('function description(')), context);
  vm.runInContext(source.slice(source.indexOf('function readEvent('), source.indexOf('function setSelection(')), context);
  $('#event-kind').value = 'enemy';
  context.typeOptions('snake');
  $('#event-type').value = 'snake';
  $('#event-time').value = '0'; $('#event-x').value = '20'; $('#event-y').value = '70';
  $('#event-shield').value = 'none';
  $('#event-location').value = 'fixed'; $('#event-formation').value = 'single';
  const placement = context.readEvent();
  assert.deepEqual(JSON.parse(JSON.stringify(placement)), { kind: 'enemy', type: 'snake', time: 0, ...snapWheel(.2, .7), shield: null });
  const snakeSpawner = { kind: 'enemy', type: 'snake' };
  const saved = validateCustomLevel({ ...blank(), events: [placement], brickTypes: [
    { edge: 'top', start: 0, end: .125, kind: 'normal', spawner: snakeSpawner },
  ] });
  assert.deepEqual(saved.brickTypes[0].spawner, snakeSpawner);
  assert.deepEqual(saved.events[0], JSON.parse(JSON.stringify(placement)));
  assert.ok(source.includes("['wheel', 'snake', 'robo-cow'].includes(event.type)"));
  assert.ok(source.includes("['wheel', 'snake', 'robo-cow'].includes(item.type)"));
  assert.ok(source.includes("['wheel', 'snake', 'robo-cow'].includes(next.type)"));
  assert.match(source, /snake: \{ name: 'Robo Snake' \}/);
  assert.match(spawnSymbol({ kind: 'enemy', type: 'snake' }), /M-25 5/);
  assert.equal(spawnColor({ kind: 'enemy', type: 'snake' }), '#bbc5ca');
  assert.match(specialLabel({ spawner: { kind: 'enemy', type: 'snake' } }), /Spawning: Robo Snake/);
});

test('soccer editor drafts round-trip scoring targets, balls, goal bricks and ball spawners', () => {
  const source = { ...blank(), goal: 0, goalsGoal: 2,
    events: [event('object', 'soccer-ball', 0)],
    brickTypes: [
      { edge: 'top', start: 0, end: .125, kind: 'goal' },
      { edge: 'bottom', start: 0, end: .125, kind: 'normal', spawner: { kind: 'object', type: 'soccer-ball' } },
    ] };
  const validateDraft = value => validateCustomLevel(value, { allowUnpairedPortals: true });
  const draft = validateDraft(source);
  assert.deepEqual(draft, source);
  assert.deepEqual(validateDraft(JSON.parse(JSON.stringify(draft))), draft);
  assert.deepEqual(validateDraft(JSON.parse(decodeURIComponent(encodeURIComponent(JSON.stringify(draft))))), draft);
  for (const goalsGoal of [-1, 1.5, '2', Infinity, 100001]) {
    assert.throws(() => validateDraft({ ...source, goalsGoal }), TypeError);
  }
  assert.throws(() => validateDraft({ ...source, survive: true }), TypeError);
  for (const field of [{ lifetime: 5 }, { shield: 'blue' }]) {
    assert.throws(() => validateDraft({ ...source, events: [{ ...source.events[0], ...field }] }), TypeError);
    assert.throws(() => validateDraft({ ...source, brickTypes: [
      { ...source.brickTypes[1], spawner: { ...source.brickTypes[1].spawner, ...field } },
    ] }), TypeError);
  }
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  const editor = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  assert.match(html, /<option value="object">Object<\/option>/);
  assert.match(html, /<option value="goal">Goal/);
  assert.match(editor, /object: OBJECTS/);
});

test('editor goal bricks clear attributes, reject surface edits, and combine only with goals', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', checked: false,
      parentElement: {}, querySelector: () => null, replaceChildren() {}, setAttribute() {} });
    return nodes.get(selector);
  };
  const regionKey = region => `${region.edge}:${region.start}:${region.end}`;
  const context = vm.createContext({ $, Game, OBJECTS, brickEditRegions, brickRegions, COOLDOWNS, regionKey, combineOwner: null, connectingSpawn: null,
    CONTACT_SURFACES: require('../src/game.js').CONTACT_SURFACES, MIXED: '',
    immutableBrick: kind => ['cinder', 'goal'].includes(kind),
    resetObstructionSize() {},
    common: values => values.every(value => value === values[0]) ? values[0] : '',
    validateDraft: value => validateCustomLevel(value, { allowUnpairedPortals: true }),
    attempt: action => action(), markChanged() {}, renderBoard() {}, setSelection() {}, message() {},
    choiceButton: () => ({ setAttribute() {} }), specialLabel: () => '', mixedOption() {},
  });
  vm.runInContext(source.slice(source.indexOf('function brickEntry('), source.indexOf('function splitBricks(')), context);
  vm.runInContext(source.slice(source.indexOf('function renderBrickInspector('), source.indexOf('function renderBoard(')), context);
  const setup = custom => {
    context.level = custom;
    context.previewGame = new Game(() => .5, { customLevel: custom, editorPreview: true });
    context.selectedBricks = new Set();
    return context.previewGame;
  };
  let game = setup(blank());
  const target = game.bricks[game.perimeter[0]], region = brickEditRegions(game.bricks).get(target.id);
  target.crumbler = 5; target.warped = 15; target.power = true; target.spawner = { kind: 'food', type: 'S', lifetime: 5 };
  context.selectedBricks.add(regionKey(region));
  $('#brick-kind').value = 'goal';
  context.saveBrick({ target: { id: 'brick-kind' } });
  assert.deepEqual(JSON.parse(JSON.stringify(context.level.brickTypes)), [{ ...region, kind: 'goal' }]);
  game = setup(context.level); context.selectedBricks.add(regionKey(region));
  context.renderBrickInspector(game.bricks);
  assert.equal($('#brick-kind').disabled, false, 'goal type remains editable');
  for (const id of ['crumbler', 'warped', 'springs', 'spikes', 'conveyor', 'portal', 'spawner', 'boost', 'barrier', 'toggle', 'power']) {
    assert.equal($(`#brick-${id}`).disabled, true, `${id} is unavailable for goals`);
  }
  const saved = JSON.stringify(context.level);
  assert.throws(() => context.saveBrick({ target: { id: 'brick-springs' } }), /cannot have modifiers or contact surfaces/);
  assert.equal(JSON.stringify(context.level), saved);
  $('#brick-kind').value = 'normal';
  context.saveBrick({ target: { id: 'brick-kind' } });
  assert.equal(context.level.brickTypes[0].kind, 'normal');
  game = setup(context.level); context.selectedBricks.add(regionKey(region));
  $('#brick-power').checked = true;
  context.saveBrick({ target: { id: 'brick-power' } });
  assert.equal(context.level.brickTypes[0].power, true);
  game = setup(context.level); context.selectedBricks.add(regionKey(region));
  context.renderBrickInspector(game.bricks);
  assert.equal($('#brick-power').disabled, false);
  assert.equal($('#brick-power').checked, true);
  assert.equal(context.brickEntry(game.bricks[target.id], region).powerOn, undefined, 'runtime state is not exported');
  $('#brick-spawn-item').value = 'object:soccer-ball';
  $('#brick-spawn-lifetime').value = '10'; $('#brick-spawn-shield').value = 'blue';
  context.saveBrick({ target: { id: 'brick-spawn-item' } });
  assert.deepEqual(JSON.parse(JSON.stringify(context.level.brickTypes[0].spawner)), { kind: 'object', type: 'soccer-ball' });
  assert.equal(context.level.brickTypes[0].power, true, 'changing contact surfaces preserves Power');
  game = setup(context.level); context.selectedBricks.add(regionKey(region));
  $('#brick-power').checked = false;
  context.saveBrick({ target: { id: 'brick-power' } });
  assert.equal(context.level.brickTypes[0].power, false);
  assert.equal(context.level.brickTypes[0].spawner.type, 'soccer-ball', 'removing Power preserves contact surfaces');
  game = setup(context.level); context.selectedBricks.add(regionKey(region));
  context.renderBrickInspector(game.bricks);
  assert.equal($('#brick-spawn-item').disabled, false);
  assert.equal($('#brick-spawn-lifetime').disabled, true);
  assert.equal($('#brick-spawn-shield').disabled, true);
  for (const otherKind of ['normal', 'cinder', 'goal']) {
    const base = new Game(() => .5, { customLevel: blank() });
    const ids = base.perimeter.slice(0, 2), regions = brickEditRegions(base.bricks);
    game = setup({ ...blank(), brickTypes: ids.map((id, index) => ({
      ...regions.get(id), kind: index ? otherKind : 'goal',
    })) });
    context.selectedBricks = new Set(ids.map(id => regionKey(regions.get(id))));
    context.combineOwner = ids[0];
    context.renderBrickInspector(game.bricks);
    assert.equal($('#combine-bricks').disabled, otherKind !== 'goal');
    if (otherKind === 'goal') {
      context.combineBricks();
      assert.equal(context.level.brickGroups.length, 1);
      assert.ok(context.level.brickTypes.every(entry => Object.keys(entry).sort().join(',') === 'edge,end,kind,start'));
      assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(context.level))), JSON.parse(JSON.stringify(context.level)));
    } else {
      const before = JSON.stringify(context.level);
      assert.throws(() => context.combineBricks(), /same kind/);
      assert.equal(JSON.stringify(context.level), before);
    }
  }
});
