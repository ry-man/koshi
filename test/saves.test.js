const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { LEVELS } = require('../src/game.js');
const { SaveSlots, SAVE_KEY, SLOT_COUNT } = require('../src/saves.js');

const levelIds = LEVELS.map(level => level.id);

function fixture() {
  const data = new Map();
  const storage = {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); },
  };
  let id = 0;
  const saves = new SaveSlots(levelIds, () => storage, () => `profile-${++id}`);
  return { data, storage, saves };
}

test('three named slots persist independently, reject overwriting, and rename without losing progress', () => {
  const { data, storage, saves } = fixture();
  data.set('koshi-level-editor-v1', 'editor draft');
  assert.equal(SLOT_COUNT, 3);
  assert.deepEqual(saves.load(), [null, null, null]);
  const first = saves.create(0, '  First player  ');
  const second = saves.create(1, 'Second player');
  const third = saves.create(2, 'Third player');
  assert.equal(first.owner, 'First player');
  assert.equal(new Set([first.id, second.id, third.id]).size, 3);
  saves.complete(0, first.id, levelIds[0]);
  saves.complete(1, second.id, levelIds[1]);
  saves.rename(0, first.id, 'Renamed');
  const reloaded = new SaveSlots(levelIds, () => storage);
  assert.deepEqual(reloaded.load().map(slot => slot.completed), [[levelIds[0]], [levelIds[1]], []]);
  assert.equal(reloaded.load()[0].owner, 'Renamed');
  assert.throws(() => saves.create(0, 'Replacement'), /occupied/);
  saves.remove(1, second.id);
  assert.equal(saves.load()[1], null);
  assert.deepEqual(saves.load()[0].completed, [levelIds[0]]);
  assert.equal(data.get('koshi-level-editor-v1'), 'editor draft');
});

test('resuming uses the first unfinished level and replaying never regresses progress', () => {
  const { saves } = fixture();
  const slot = saves.create(0, 'Player');
  assert.equal(saves.nextLevel(slot), 0);
  saves.complete(0, slot.id, levelIds[2]);
  assert.equal(saves.nextLevel(saves.load()[0]), 0, 'a later win does not skip unfinished levels');
  saves.complete(0, slot.id, levelIds[0]);
  assert.equal(saves.nextLevel(saves.load()[0]), 1);
  saves.complete(0, slot.id, levelIds[0]);
  assert.equal(saves.load()[0].completed.length, 2);
  for (const id of levelIds) saves.complete(0, slot.id, id);
  assert.equal(saves.load()[0].completed.length, levelIds.length);
  assert.equal(saves.nextLevel(saves.load()[0]), levelIds.length - 1);
  saves.complete(0, slot.id, levelIds[0]);
  assert.equal(saves.nextLevel(saves.load()[0]), levelIds.length - 1);
});

test('invalid names, slots and non-campaign wins cannot change saved data', () => {
  const { data, saves } = fixture();
  const slot = saves.create(0, 'Player');
  const before = data.get(SAVE_KEY);
  for (const name of ['', '  ', null, 5, 'x'.repeat(33)]) {
    assert.throws(() => saves.create(1, name), /owner name/);
    assert.throws(() => saves.rename(0, slot.id, name), /owner name/);
  }
  for (const index of [-1, 3, .5, '0']) {
    assert.throws(() => saves.create(index, 'Player'), /three save slots/);
    assert.throws(() => saves.remove(index, slot.id), /three save slots/);
  }
  assert.throws(() => saves.complete(0, slot.id, 'Custom level'), /campaign levels/);
  assert.equal(data.get(SAVE_KEY), before);
});

test('malformed or unsupported stored data is reported and never overwritten', () => {
  const { data, saves } = fixture();
  const slot = { id: 'id', owner: 'Player', completed: [] };
  for (const raw of [
    '{', 'null', '{}', JSON.stringify({ version: 2, slots: [null, null, null] }),
    ...[[null], [slot, slot, null], [{ ...slot, owner: '' }, null, null],
      [{ ...slot, completed: ['unknown'] }, null, null],
      [{ ...slot, completed: [levelIds[0], levelIds[0]] }, null, null],
      [{ ...slot, id: 42 }, null, null], [false, null, null],
    ].map(slots => JSON.stringify({ version: 1, slots })),
  ]) {
    data.set(SAVE_KEY, raw);
    assert.throws(() => saves.load());
    assert.throws(() => saves.create(1, 'New player'));
    assert.equal(data.get(SAVE_KEY), raw);
  }
});

test('storage failures propagate and stale sessions cannot update a replacement profile', () => {
  const { data, storage, saves } = fixture();
  const first = saves.create(0, 'First');
  const before = data.get(SAVE_KEY);
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('Storage full'); };
  assert.throws(() => saves.complete(0, first.id, levelIds[0]), /Storage full/);
  assert.throws(() => saves.rename(0, first.id, 'Changed'), /Storage full/);
  assert.throws(() => saves.remove(0, first.id), /Storage full/);
  assert.equal(data.get(SAVE_KEY), before);
  storage.setItem = write;
  saves.remove(0, first.id);
  const replacement = saves.create(0, 'Replacement');
  assert.notEqual(replacement.id, first.id);
  for (const action of [
    () => saves.complete(0, first.id, levelIds[0]),
    () => saves.rename(0, first.id, 'Changed'),
    () => saves.remove(0, first.id),
  ]) assert.throws(action, /changed or was deleted/);
  assert.equal(saves.load()[0].owner, 'Replacement');
  const blocked = new SaveSlots(levelIds, () => { throw new Error('Storage blocked'); });
  assert.throws(() => blocked.load(), /Storage blocked/);
});

function uiFixture() {
  const { saves, storage, data } = fixture();
  const elements = new Map(), errors = [];
  const node = () => ({
    children: [], listeners: {}, hidden: false, textContent: '', value: '',
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(event, callback) { this.listeners[event] = callback; },
    setAttribute(name, value) { this[name] = value; },
    focus() {}, scrollIntoView() {}, close() { this.open = false; }, showModal() { this.open = true; },
  });
  const document = {
    createElement: node,
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, node());
      return elements.get(selector);
    },
  };
  const context = vm.createContext({
    document, saves, LEVELS, pendingSaves: [], activeSave: null, runSave: null,
    game: { level: LEVELS[0] }, tutorial: null, console: { error(...args) { errors.push(args); } },
    titleScreen: node(), saveDialog: node(), levelSelect: node(), board: node(),
    autoPause() {}, begin() {}, confirm: () => true,
  });
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('function saveError('), source.indexOf('function makeBrickButtons(')), context);
  return { context, elements, saves, storage, data, errors };
}

test('UI autosaves only campaign profiles and exposes failed wins for retry', () => {
  const { context, elements, saves, storage, errors } = uiFixture();
  const slot = saves.create(0, 'Player');
  context.activeSave = { index: 0, slot };
  context.runSave = { index: 0, id: slot.id };
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('Storage full'); };
  context.saveVictory();
  assert.equal(context.pendingSaves.length, 1);
  assert.equal(saves.load()[0].completed.length, 0);
  assert.match(elements.get('#save-error').textContent, /Progress has not been saved.*Storage full/);
  assert.equal(elements.get('#save-retry').hidden, false);
  assert.equal(elements.get('#save-menu-retry').hidden, false);
  assert.equal(errors.length, 1);
  storage.setItem = write;
  elements.get('#save-retry').listeners.click();
  assert.deepEqual(saves.load()[0].completed, [levelIds[0]]);
  assert.equal(context.pendingSaves.length, 0);
  assert.equal(elements.get('#save-error').hidden, true);
  assert.match(elements.get('#save-profile').textContent, /Player.*1 \/ 5.*1-2/);
  context.game = { level: LEVELS[1], customLevel: {} };
  context.saveVictory();
  context.game.customLevel = null; context.tutorial = {};
  context.saveVictory();
  context.tutorial = null; context.runSave = null;
  context.saveVictory();
  assert.deepEqual(saves.load()[0].completed, [levelIds[0]], 'custom, tutorial and guest wins never save');
});

test('slot UI renders owner names as text, resumes saved levels, and confirms deletion', () => {
  const { context, elements, saves } = uiFixture();
  const slot = saves.create(0, '<b>Player</b>');
  saves.complete(0, slot.id, levelIds[0]);
  context.renderSaveSlots();
  const sections = elements.get('#save-slot-list').children;
  assert.equal(sections.length, 3);
  assert.equal(sections[0].children[0].textContent, 'Slot 1 - <b>Player</b>');
  let started = 0;
  context.begin = () => { started++; };
  context.continueSave(0, slot.id);
  assert.equal(context.levelSelect.value, '1');
  assert.equal(context.activeSave.slot.id, slot.id);
  assert.equal(started, 1);
  const remove = sections[0].children[2].children[1];
  context.confirm = () => false;
  remove.listeners.click();
  assert.ok(saves.load()[0]);
  context.confirm = () => true;
  remove.listeners.click();
  assert.equal(saves.load()[0], null);
  assert.equal(context.activeSave, null);
});

test('unrecoverable pending wins can be discarded only with confirmation', () => {
  const { context, elements, saves } = uiFixture();
  const slot = saves.create(0, 'Player');
  saves.complete(0, slot.id, levelIds[0]);
  context.pendingSaves.push({ index: 0, id: slot.id, levelId: levelIds[1] });
  context.saveError('Pending write');
  assert.equal(elements.get('#save-discard').hidden, false);
  context.confirm = () => false;
  elements.get('#save-discard').listeners.click();
  assert.equal(context.pendingSaves.length, 1);
  context.confirm = () => true;
  elements.get('#save-discard').listeners.click();
  assert.equal(context.pendingSaves.length, 0);
  assert.equal(elements.get('#save-discard').hidden, true);
  assert.deepEqual(saves.load()[0].completed, [levelIds[0]]);
});

test('autosaving and profile binding are wired to victory and level start', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const victory = source.slice(source.indexOf("} else if (game.state === 'won')"), source.indexOf("} else if (game.state === 'lost')"));
  assert.match(victory, /saveVictory\(\)/);
  assert.ok(victory.indexOf('if (tutorial)') < victory.indexOf('saveVictory()'));
  const begin = source.slice(source.indexOf('function begin('), source.indexOf('function startLevel('));
  assert.match(begin, /runSave = activeSave && !game\.customLevel/);
  const context = vm.createContext({});
  vm.runInContext(readFileSync(path.join(__dirname, '..', 'src', 'saves.js'), 'utf8'), context);
  assert.equal(typeof context.KoshiSaves.SaveSlots, 'function', 'save script supports direct-file classic startup');
});
