const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { LEVELS } = require('../src/game.js');
const { SaveSlots, SAVE_KEY, SLOT_COUNT, levelStats } = require('../src/saves.js');

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

test('finished attempts persist once, track both outcomes and keep fastest wins and highest point scores', () => {
  const { saves, storage } = fixture(), slot = saves.create(0, 'Player');
  const result = { levelId: levelIds[0], outcome: 'won', time: 12.5, food: 25, enemy: 3, goals: 2, damageFree: true };
  saves.record(0, slot.id, 'first', result);
  saves.record(0, slot.id, 'first', result);
  saves.record(0, slot.id, 'loss', { ...result, outcome: 'lost', time: 2, food: 30, enemy: 1, goals: 1, damageFree: false });
  saves.record(0, slot.id, 'faster', { ...result, time: 10, enemy: 6, goals: 3, damageFree: false });
  const reloaded = new SaveSlots(levelIds, () => storage).load()[0];
  assert.deepEqual(reloaded.completed, [levelIds[0]]);
  assert.deepEqual(levelStats(reloaded.results, levelIds[0]), {
    wins: 2, losses: 1, winPercent: 2 / 3 * 100, lossPercent: 1 / 3 * 100,
    goldStar: true,
    bestTime: 10, fewestMoves: null, mostFood: 30, mostEnemies: 6, mostGoals: 3,
  });
  saves.record(0, slot.id, 'other-loss', { ...result, levelId: levelIds[1], outcome: 'lost', damageFree: false });
  assert.deepEqual(saves.load()[0].completed, [levelIds[0]], 'losses never complete a level');
  assert.equal(levelStats(saves.load()[0].results, levelIds[1]).bestTime, null);
});

test('legacy completions stay valid without fabricated statistics', () => {
  const { saves } = fixture(), slot = saves.create(0, 'Player');
  saves.complete(0, slot.id, levelIds[0]);
  const loaded = saves.load()[0];
  assert.equal(loaded.results, undefined);
  assert.deepEqual(levelStats(loaded.results, levelIds[0]), {
    wins: 0, losses: 0, winPercent: null, lossPercent: null,
    goldStar: false,
    bestTime: null, fewestMoves: null, mostFood: null, mostEnemies: null, mostGoals: null,
  });
  saves.record(0, slot.id, 'new', { levelId: levelIds[0], outcome: 'won', time: 15, food: 20, enemy: 0 });
  assert.deepEqual(saves.load()[0].completed, [levelIds[0]]);
});

test('last played persists at level entry, including abandoned levels, without recording an outcome', () => {
  const { saves, storage, data } = fixture(), slot = saves.create(0, 'Player');
  saves.complete(0, slot.id, levelIds[0]);
  assert.equal(saves.resumeLevel(saves.load()[0]), 1, 'legacy saves fall back to first unfinished');
  saves.visit(0, slot.id, levelIds[20]);
  const loaded = new SaveSlots(levelIds, () => storage).load()[0];
  assert.equal(loaded.lastPlayed, levelIds[20]);
  assert.equal(saves.resumeLevel(loaded), 20);
  assert.deepEqual(loaded.completed, [levelIds[0]]);
  assert.equal(loaded.results, undefined, 'quits have no outcome');
  saves.record(0, slot.id, 'delayed-result', { levelId: levelIds[0], outcome: 'won', time: 12, food: 20, enemy: 0 });
  assert.equal(saves.resumeLevel(saves.load()[0]), 20, 'a retried result cannot overwrite a more recent visit');
  const before = data.get(SAVE_KEY);
  assert.throws(() => saves.visit(0, slot.id, 'custom'), /campaign levels/);
  assert.equal(data.get(SAVE_KEY), before);
  const invalid = JSON.parse(before);
  invalid.slots[0].lastPlayed = 'unknown';
  data.set(SAVE_KEY, JSON.stringify(invalid));
  assert.throws(() => saves.load(), /invalid/);
});

test('fewest moves uses only wins with recorded counts, keeps zero, and survives reloads', () => {
  const { saves, storage } = fixture(), slot = saves.create(0, 'Player');
  const result = { levelId: levelIds[0], outcome: 'won', time: 12, food: 20, enemy: 0 };
  saves.record(0, slot.id, 'legacy', result);
  saves.record(0, slot.id, 'first', { ...result, moves: 8 });
  saves.record(0, slot.id, 'better', { ...result, moves: 5 });
  saves.record(0, slot.id, 'loss', { ...result, outcome: 'lost', moves: 1 });
  const loaded = new SaveSlots(levelIds, () => storage).load()[0];
  assert.equal(levelStats(loaded.results, levelIds[0]).fewestMoves, 5);
  saves.record(0, slot.id, 'zero', { ...result, moves: 0 });
  assert.equal(levelStats(saves.load()[0].results, levelIds[0]).fewestMoves, 0);
  for (const moves of [-1, 1.5, '2', null, Infinity]) {
    assert.throws(() => saves.record(0, slot.id, 'invalid', { ...result, moves }), /Invalid completed/);
  }
  assert.throws(() => saves.record(0, slot.id, 'better', { ...result, moves: 4 }), /different saved result/);
});

test('invalid results, conflicting retries and stale profiles fail without modifying saves', () => {
  const { saves, data, storage } = fixture(), slot = saves.create(0, 'Player');
  const result = { levelId: levelIds[0], outcome: 'won', time: 12, food: 20, enemy: 0 };
  saves.record(0, slot.id, 'first', result);
  const before = data.get(SAVE_KEY);
  for (const patch of [{ outcome: 'quit' }, { time: -1 }, { time: Infinity }, { food: '20' }, { enemy: NaN },
    { levelId: 'custom' }, { goals: -1 }, { goals: 1.5 }, { damageFree: 'yes' }, { outcome: 'lost', damageFree: true }]) {
    assert.throws(() => saves.record(0, slot.id, 'bad', { ...result, ...patch }), /Invalid completed/);
  }
  assert.throws(() => saves.record(0, slot.id, 'first', { ...result, time: 10 }), /different saved result/);
  assert.throws(() => saves.record(0, slot.id, '__proto__', result), /attempt ID/);
  assert.equal(data.get(SAVE_KEY), before);
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('Storage full'); };
  assert.throws(() => saves.record(0, slot.id, 'retry', result), /Storage full/);
  assert.equal(data.get(SAVE_KEY), before);
  storage.setItem = write;
  saves.record(0, slot.id, 'retry', result);
  saves.record(0, slot.id, 'retry', result);
  assert.equal(levelStats(saves.load()[0].results, levelIds[0]).wins, 2);
  saves.remove(0, slot.id);
  saves.create(0, 'Replacement');
  assert.throws(() => saves.record(0, slot.id, 'stale', result), /changed or was deleted/);
});

test('malformed saved attempt data is reported and left untouched', () => {
  const { saves, data } = fixture();
  const slot = { id: 'profile', owner: 'Player', completed: [] };
  for (const results of [null, [], { attempt: { levelId: levelIds[0], outcome: 'quit', time: 0, food: 0, enemy: 0 } }]) {
    const raw = JSON.stringify({ version: 1, slots: [{ ...slot, results }, null, null] });
    data.set(SAVE_KEY, raw);
    assert.throws(() => saves.load());
    assert.equal(data.get(SAVE_KEY), raw);
  }
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
    document, saves, LEVELS, levelStats, pendingSaves: [], activeSave: null, runSave: null,
    game: { level: LEVELS[0], state: 'won', elapsed: 10, score: 20, enemies: 2, moves: 4 },
    recordedAttempts: new WeakSet(), attemptId: 'attempt-1',
    guestProfile: { completed: [], results: {} },
    tutorial: null, console: { error(...args) { errors.push(args); } },
    titleScreen: node(), saveDialog: node(), levelSelect: node(), board: node(),
    openLevelPicker(options) { this.mapOptions = options; }, autoPause() {}, begin() {}, confirm: () => true,
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
  context.saveResult();
  assert.equal(context.pendingSaves.length, 1);
  assert.equal(saves.load()[0].completed.length, 0);
  assert.match(elements.get('#save-error').textContent, /Progress has not been saved.*Storage full/);
  assert.equal(elements.get('#save-retry').hidden, false);
  assert.equal(elements.get('#save-menu-retry').hidden, false);
  assert.equal(errors.length, 1);
  storage.setItem = write;
  elements.get('#save-retry').listeners.click();
  assert.deepEqual(saves.load()[0].completed, [levelIds[0]]);
  assert.equal(levelStats(saves.load()[0].results, levelIds[0]).fewestMoves, 4);
  assert.equal(context.pendingSaves.length, 0);
  assert.equal(elements.get('#save-error').hidden, true);
  assert.match(elements.get('#save-profile').textContent, /Player.*1 \/ 47.*1-2/);
  context.game = { level: LEVELS[1], customLevel: {} };
  context.saveResult();
  context.game.customLevel = null; context.tutorial = {};
  context.saveResult();
  context.tutorial = null; context.runSave = null;
  context.saveResult();
  assert.deepEqual(saves.load()[0].completed, [levelIds[0]], 'custom, tutorial and guest wins never save');
});

test('completion summaries compare against prior records without counting the current attempt', () => {
  const { context } = uiFixture();
  context.game.goals = 2;
  context.game.tookDamage = false;
  const first = context.saveResult();
  assert.deepEqual({ ...first.newRecords }, { time: true, food: true, enemy: true, goals: true, moves: true });
  assert.equal(first.result.damageFree, true);
  assert.equal(first.result.goals, 2);
  context.attemptId = 'attempt-2';
  context.game = { ...context.game, elapsed: 9, score: 20, enemies: 2, goals: 3, tookDamage: true };
  const second = context.saveResult();
  assert.deepEqual({ ...second.newRecords }, { time: true, food: false, enemy: false, goals: true, moves: false });
  assert.equal(second.previousStats.goldStar, true);
  assert.equal(second.result.damageFree, false);
});

test('UI records losses once, ignores abandoned attempts, and tracks guest results only for the visit', () => {
  const { context, saves } = uiFixture();
  const slot = saves.create(0, 'Player');
  context.activeSave = { index: 0, slot };
  context.runSave = { index: 0, id: slot.id };
  for (const state of ['ready', 'playing', 'paused']) {
    context.game.state = state;
    context.saveResult();
  }
  assert.equal(saves.load()[0].results, undefined);
  context.game.state = 'lost';
  context.saveResult(); context.saveResult();
  assert.equal(levelStats(saves.load()[0].results, levelIds[0]).losses, 1);
  assert.deepEqual(saves.load()[0].completed, []);
  context.game = { level: LEVELS[1], state: 'won', elapsed: 45, score: 12, enemies: 1 };
  context.runSave = null; context.attemptId = 'guest';
  context.saveResult(); context.saveResult();
  assert.equal(levelStats(context.guestProfile.results, levelIds[1]).wins, 1);
  assert.equal(levelStats(saves.load()[0].results, levelIds[1]).wins, 0);
  context.game = { level: LEVELS[1], state: 'won', elapsed: 45, score: 12, enemies: 1, customLevel: {} };
  context.runSave = { index: 0, id: slot.id }; context.attemptId = 'custom';
  context.saveResult();
  context.game.customLevel = null; context.tutorial = {};
  context.saveResult();
  assert.equal(levelStats(saves.load()[0].results, levelIds[1]).wins, 0);
});

test('slot UI renders owner names as text, resumes saved levels, and confirms deletion', () => {
  const { context, elements, saves } = uiFixture();
  const slot = saves.create(0, '<b>Player</b>');
  saves.complete(0, slot.id, levelIds[0]);
  context.renderSaveSlots();
  const sections = elements.get('#save-slot-list').children;
  assert.equal(sections.length, 3);
  assert.equal(sections[0].children[0].textContent, 'Slot 1 - <b>Player</b>');
  let started = 0, mapOptions;
  context.begin = () => { started++; };
  context.openLevelPicker = options => { mapOptions = options; };
  context.continueSave(0, slot.id);
  assert.equal(mapOptions.level, 1);
  assert.equal(mapOptions.insideWorld, true);
  assert.equal(context.activeSave.slot.id, slot.id);
  assert.equal(started, 0);
  const remove = sections[0].children[2].children[1];
  context.confirm = () => false;
  remove.listeners.click();
  assert.ok(saves.load()[0]);
  context.confirm = () => true;
  remove.listeners.click();
  assert.equal(saves.load()[0], null);
  assert.equal(context.activeSave, null);
});

test('loading opens the last-played level map while a newly created slot opens world selection', () => {
  const { context, saves } = uiFixture(), slot = saves.create(0, 'Player');
  saves.visit(0, slot.id, levelIds[20]);
  const openings = [];
  context.openLevelPicker = options => openings.push(options);
  context.begin = () => assert.fail('loading must not start gameplay');
  context.continueSave(0, slot.id);
  assert.equal(openings[0].insideWorld, true);
  assert.equal(openings[0].level, 20);
  const fresh = saves.create(1, 'New player');
  context.continueSave(1, fresh.id, true);
  assert.equal(openings[1].insideWorld, false);
  assert.equal(openings[1].level, 0);
});

test('starting campaign play queues last-played persistence and storage failures can be retried', () => {
  const { context, saves, storage, elements } = uiFixture(), slot = saves.create(0, 'Player');
  context.runSave = { index: 0, id: slot.id };
  context.activeSave = { index: 0, slot };
  context.game = { level: LEVELS[12], state: 'ready', start() { this.state = 'playing'; } };
  context.pause = { focus() {} };
  context.syncUI = () => {};
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('function startLevel('), source.indexOf('function showLevelBriefing(')), context);
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('Storage full'); };
  context.startLevel();
  assert.equal(context.game.state, 'playing');
  assert.equal(context.pendingSaves.length, 1);
  assert.match(elements.get('#save-error').textContent, /Storage full/);
  storage.setItem = write;
  context.flushSaves();
  assert.equal(context.pendingSaves.length, 0);
  assert.equal(saves.load()[0].lastPlayed, levelIds[12]);
  assert.equal(saves.load()[0].results, undefined);
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
  const ending = source.slice(source.indexOf("if (['won', 'lost'].includes(game.state)"), source.indexOf('  if (displayedState === game.state) return;'));
  assert.match(ending, /if \(!tutorial\) ending\.summary = saveResult\(\)/);
  assert.ok(ending.indexOf('saveResult()') < ending.indexOf('ending.elapsed < ending.duration'), 'save before waiting for celebration');
  assert.match(ending, /showCompletionResults\(ending\.summary\)/);
  const begin = source.slice(source.indexOf('function begin('), source.indexOf('function startLevel('));
  assert.match(begin, /runSave = activeSave && !game\.customLevel/);
  const context = vm.createContext({});
  vm.runInContext(readFileSync(path.join(__dirname, '..', 'src', 'saves.js'), 'utf8'), context);
  assert.equal(typeof context.KoshiSaves.SaveSlots, 'function', 'save script supports direct-file classic startup');
});
