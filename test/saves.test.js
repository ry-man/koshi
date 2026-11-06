const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { LEVELS } = require('../src/game.js');
const { SaveSlots, SAVE_KEY, RECENT_KEY, SLOT_COUNT, levelStats } = require('../src/saves.js');

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

test('the most recent slot is remembered, with fallback to the first occupied slot', () => {
  const { storage, saves } = fixture();
  assert.equal(saves.recent(), null, 'no saves means no continue option');
  const first = saves.create(0, 'First');
  const third = saves.create(2, 'Third');
  assert.deepEqual(saves.recent(), { index: 0, slot: saves.load()[0] }, 'older saves without a marker use the first slot');
  saves.markRecent(2, third.id);
  assert.equal(storage.getItem(RECENT_KEY), third.id);
  assert.equal(new SaveSlots(levelIds, () => storage).recent().slot.owner, 'Third', 'marker persists across reloads');
  assert.throws(() => saves.markRecent(1, third.id), /changed or was deleted/);
  saves.remove(2, third.id);
  assert.equal(saves.recent().slot.id, first.id, 'deleted recent slot falls back');
  saves.remove(0, first.id);
  assert.equal(saves.recent(), null);
});

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

test('collected Cat Blocks persist by level in their save slot and reject invalid IDs', () => {
  const { storage, saves } = fixture();
  const slot = saves.create(0, 'Player');
  saves.collectCatBlock(0, slot.id, levelIds[2]);
  saves.collectCatBlock(0, slot.id, levelIds[2]);
  assert.deepEqual(new SaveSlots(levelIds, () => storage).load()[0].catBlocks, [levelIds[2]]);
  assert.throws(() => saves.collectCatBlock(0, slot.id, 'custom-level'), /campaign levels/);
  const raw = JSON.parse(storage.getItem(SAVE_KEY));
  raw.slots[0].catBlocks.push(levelIds[2]);
  storage.setItem(SAVE_KEY, JSON.stringify(raw));
  assert.throws(() => saves.load(), /Saved campaign data is invalid/);
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
    wins: 2, losses: 1, quits: 0, winPercent: 2 / 3 * 100, lossPercent: 1 / 3 * 100,
    goldStar: true,
    bestTime: 10, fewestMoves: null, mostFood: 25, mostEnemies: 6, mostGoals: 3,
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
    wins: 0, losses: 0, quits: 0, winPercent: null, lossPercent: null,
    goldStar: false,
    bestTime: null, fewestMoves: null, mostFood: null, mostEnemies: null, mostGoals: null,
  });

  test('all records exclude losses, quits and provisional checkpoints, while attempt statistics retain them', () => {
    const result = { levelId: levelIds[0], time: 10, food: 25, enemy: 3, goals: 2, moves: 8 };
    const failed = {
      loss: { ...result, outcome: 'lost', time: 1, food: 999, enemy: 999, goals: 999, moves: 1 },
      quit: { ...result, outcome: 'quit', time: 2, food: 1000, enemy: 1000, goals: 1000, moves: 0 },
      checkpoint: { ...result, outcome: 'quit', inProgress: true, food: 2000, enemy: 2000, goals: 2000 },
    };
    const stats = levelStats(failed, levelIds[0]);
    for (const metric of ['bestTime', 'mostFood', 'mostEnemies', 'mostGoals', 'fewestMoves']) assert.equal(stats[metric], null);
    assert.equal(stats.losses, 1); assert.equal(stats.quits, 2);
    const won = levelStats({ ...failed, win: { ...result, outcome: 'won' } }, levelIds[0]);
    assert.equal(won.bestTime, 10); assert.equal(won.mostFood, 25);
    assert.equal(won.mostEnemies, 3); assert.equal(won.mostGoals, 2); assert.equal(won.fewestMoves, 8);
    assert.equal(won.winPercent, 25);
    assert.equal(JSON.stringify(failed.checkpoint.food), '2000', 'historical attempts are not rewritten');
  });
  saves.record(0, slot.id, 'new', { levelId: levelIds[0], outcome: 'won', time: 15, food: 20, enemy: 0 });
  assert.deepEqual(saves.load()[0].completed, [levelIds[0]]);
});

test('visiting a level persists last played without starting an attempt', () => {
  const { saves, storage, data } = fixture(), slot = saves.create(0, 'Player');
  saves.complete(0, slot.id, levelIds[0]);
  assert.equal(saves.resumeLevel(saves.load()[0]), 1, 'legacy saves fall back to first unfinished');
  saves.visit(0, slot.id, levelIds[20]);
  const loaded = new SaveSlots(levelIds, () => storage).load()[0];
  assert.equal(loaded.lastPlayed, levelIds[20]);
  assert.equal(saves.resumeLevel(loaded), 20);
  assert.deepEqual(loaded.completed, [levelIds[0]]);
  assert.equal(loaded.results, undefined, 'visiting a briefing alone has no outcome');
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
  for (const patch of [{ outcome: 'unknown' }, { time: -1 }, { time: Infinity }, { food: '20' }, { enemy: NaN },
    { inProgress: true }, { inProgress: false }, { outcome: 'quit', damageFree: true },
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
  for (const results of [null, [], { attempt: { levelId: levelIds[0], outcome: 'unknown', time: 0, food: 0, enemy: 0 } }]) {
    const raw = JSON.stringify({ version: 1, slots: [{ ...slot, results }, null, null] });
    data.set(SAVE_KEY, raw);
    assert.throws(() => saves.load());
    assert.equal(data.get(SAVE_KEY), raw);
  }
});

test('provisional quits survive abrupt closure and are replaced, not duplicated, by final outcomes', () => {
  const { saves, storage } = fixture(), slot = saves.create(0, 'Player');
  const pending = { levelId: levelIds[0], outcome: 'quit', time: 0, food: 0, enemy: 0, inProgress: true };
  saves.record(0, slot.id, 'closed', pending);
  const reloaded = new SaveSlots(levelIds, () => storage);
  assert.equal(levelStats(reloaded.load()[0].results, levelIds[0]).quits, 1, 'no shutdown callback is required');
  saves.record(0, slot.id, 'closed', { ...pending, time: 4, food: 8 });
  assert.equal(levelStats(saves.load()[0].results, levelIds[0]).quits, 1, 'checkpointing does not add attempts');
  assert.throws(() => saves.record(0, slot.id, 'closed', { ...pending, levelId: levelIds[1] }), /different saved result/);
  for (const [id, outcome] of [['won', 'won'], ['lost', 'lost'], ['quit', 'quit']]) {
    saves.record(0, slot.id, id, pending);
    const result = { levelId: levelIds[0], outcome, time: 10, food: 20, enemy: 2, moves: 3 };
    saves.record(0, slot.id, id, result);
    saves.record(0, slot.id, id, result);
    assert.throws(() => saves.record(0, slot.id, id, pending), /different saved result/);
  }
  const stats = levelStats(reloaded.load()[0].results, levelIds[0]);
  assert.equal(stats.wins, 1);
  assert.equal(stats.losses, 1);
  assert.equal(stats.quits, 2);
  assert.equal(stats.winPercent, 25);
  assert.equal(stats.lossPercent, 25);
  assert.deepEqual(reloaded.load()[0].completed, [levelIds[0]]);
  assert.equal(levelStats({ win: { levelId: levelIds[0], outcome: 'won', time: 1, food: 0, enemy: 0 } }, levelIds[0]).winPercent, 100);
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
    createElement: node, createElementNS: node,
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, node());
      return elements.get(selector);
    },
  };
  const context = vm.createContext({
    document, saves, LEVELS, levelStats, collectibleTotals: require('../src/collectibles.js').collectibleTotals,
    pendingSaves: [], activeSave: null, runSave: null,
    game: { level: LEVELS[0], state: 'won', elapsed: 10, score: 20, enemies: 2, moves: 4 },
    recordedAttempts: new WeakSet(), attemptId: 'attempt-1',
    guestProfile: { completed: [], catBlocks: [], results: {} },
    tutorial: null, console: { error(...args) { errors.push(args); } },
    CAT_BLOCK_MESSAGES: require('../src/game.js').CAT_BLOCK_MESSAGES,
    toast: node(), toastUntil: 0, performance: { now: () => 0 },
    titleScreen: node(), saveDialog: node(), levelSelect: node(), board: node(),
    openLevelPicker(options) { this.mapOptions = options; }, autoPause() {}, begin() {}, confirm: () => true,
  });
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('function saveError('), source.indexOf('function makeBrickButtons(')), context);
  return { context, elements, saves, storage, data, errors };
}

test('Cat Blocks are provisional until victory for saved profiles and guests', () => {
  for (const saved of [false, true]) {
    for (const outcome of ['won', 'lost', 'playing', 'paused']) {
      const { context, saves } = uiFixture();
      const slot = saved ? saves.create(0, 'Player') : null;
      if (slot) {
        context.activeSave = { index: 0, slot };
        context.runSave = { index: 0, id: slot.id };
      }
      context.game.state = 'playing';
      context.game.catBlockCollected = true;
      context.game.catBlockEvents = ['item'];
      context.recordCatBlockFinds();
      assert.match(context.toast.textContent, /Complete the level to keep it/);
      assert.deepEqual(saved ? saves.load()[0].catBlocks ?? [] : context.guestProfile.catBlocks ?? [], []);
      context.checkpointAttempt();
      assert.deepEqual(saved ? saves.load()[0].catBlocks ?? [] : context.guestProfile.catBlocks ?? [], [],
        'provisional quit checkpoints never keep a block');
      context.game.state = outcome;
      context.game.tookDamage = true;
      context.saveResult();
      context.saveResult();
      const profile = saved ? saves.load()[0] : context.guestProfile;
      assert.deepEqual(Array.from(profile.catBlocks ?? []), outcome === 'won' ? [levelIds[0]] : []);
      assert.equal(profile.results['attempt-1'].catBlock, outcome === 'won' ? true : undefined);
      assert.equal(profile.results['attempt-1'].damageFree, false, 'taking damage does not prevent keeping a block');
    }
  }
});

test('winning Cat Block results retry atomically with the victory after storage failure', () => {
  const { context, saves, storage } = uiFixture();
  const slot = saves.create(0, 'Player');
  context.activeSave = { index: 0, slot };
  context.runSave = { index: 0, id: slot.id };
  context.game.state = 'playing';
  context.game.catBlockCollected = true;
  context.checkpointAttempt();
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('Storage full'); };
  context.game.state = 'won';
  context.saveResult();
  assert.deepEqual(saves.load()[0].catBlocks ?? [], []);
  assert.deepEqual(saves.load()[0].completed, []);
  assert.equal(context.pendingSaves.length, 1);
  assert.equal(context.pendingSaves[0].result.catBlock, true);
  storage.setItem = write;
  context.flushSaves();
  context.saveResult();
  assert.deepEqual(saves.load()[0].catBlocks, [levelIds[0]]);
  assert.deepEqual(saves.load()[0].completed, [levelIds[0]]);
  assert.equal(levelStats(saves.load()[0].results, levelIds[0]).wins, 1);
});

test('saved results reject Cat Blocks awarded without a victory', () => {
  const { saves } = fixture(), slot = saves.create(0, 'Player');
  for (const outcome of ['lost', 'quit']) {
    assert.throws(() => saves.record(0, slot.id, outcome, {
      levelId: levelIds[0], outcome, time: 10, food: 0, enemy: 0, catBlock: true,
    }), /Invalid completed level result/);
  }
  saves.record(0, slot.id, 'win', {
    levelId: levelIds[0], outcome: 'won', time: 10, food: 20, enemy: 0, catBlock: true,
  });
  assert.throws(() => saves.record(0, slot.id, 'win', {
    levelId: levelIds[0], outcome: 'won', time: 10, food: 20, enemy: 0,
  }), /different saved result/);
});

test('UI checkpoints, quits, wins and losses reuse one attempt without counting pauses or ready screens', () => {
  for (const profile of ['saved', 'guest']) {
    for (const outcome of ['won', 'lost', 'quit']) {
      const { context, saves } = uiFixture();
      if (profile === 'saved') {
        const slot = saves.create(0, 'Player');
        context.activeSave = { index: 0, slot };
        context.runSave = { index: 0, id: slot.id };
      }
      const results = () => profile === 'saved' ? saves.load()[0].results : context.guestProfile.results;
      context.game.state = 'ready';
      context.checkpointAttempt(); context.saveResult();
      assert.equal(Object.keys(results() ?? {}).length, 0);
      context.game.state = 'playing';
      context.checkpointAttempt();
      context.game.elapsed = 15;
      context.game.state = 'paused';
      context.checkpointAttempt();
      assert.equal(levelStats(results(), levelIds[0]).quits, 1);
      context.game.state = outcome === 'quit' ? 'paused' : outcome;
      const summary = context.saveResult();
      context.saveResult(); context.checkpointAttempt();
      const stats = levelStats(results(), levelIds[0]);
      assert.equal(Object.keys(results()).length, 1);
      assert.equal(stats.wins, outcome === 'won' ? 1 : 0);
      assert.equal(stats.losses, outcome === 'lost' ? 1 : 0);
      assert.equal(stats.quits, outcome === 'quit' ? 1 : 0);
      assert.equal(stats.winPercent, outcome === 'won' ? 100 : 0);
      assert.equal(results()['attempt-1'].time, 15);
      assert.equal(results()['attempt-1'].inProgress, undefined);
      assert.equal(summary.previousStats.mostFood, null, 'the current checkpoint is not a previous record');
    }
  }
});

test('failed final writes retain the provisional quit and can retry the same outcome exactly once', () => {
  const { context, saves, storage, elements } = uiFixture(), slot = saves.create(0, 'Player');
  context.activeSave = { index: 0, slot };
  context.runSave = { index: 0, id: slot.id };
  context.game.state = 'playing';
  context.checkpointAttempt();
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('Storage full'); };
  context.game.state = 'won';
  context.saveResult();
  assert.equal(levelStats(saves.load()[0].results, levelIds[0]).quits, 1);
  assert.match(elements.get('#save-error').textContent, /Storage full/);
  storage.setItem = write;
  context.flushSaves(); context.saveResult();
  assert.equal(levelStats(saves.load()[0].results, levelIds[0]).wins, 1);
  assert.equal(levelStats(saves.load()[0].results, levelIds[0]).quits, 0);
});

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
  assert.match(elements.get('#save-profile').textContent, /Player.*1 \/ 61.*1-2/);
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

test('failed and quit completion summaries never announce any records, even on a first attempt', () => {
  for (const state of ['lost', 'playing', 'paused']) {
    const { context } = uiFixture();
    Object.assign(context.game, { state, elapsed: 1, score: 999, enemies: 999, goals: 999, moves: 0 });
    const summary = context.saveResult();
    assert.deepEqual({ ...summary.newRecords }, { time: false, food: false, enemy: false, goals: false, moves: false });
    assert.equal(summary.result.outcome, state === 'lost' ? 'lost' : 'quit');
  }
});

test('completion summaries flag Cat Blocks only when newly collected in a winning run', () => {
  for (const [outcome, collected, previouslyCollected, expected] of [
    ['won', true, false, true], ['won', true, true, false],
    ['won', false, false, false], ['lost', true, false, false],
  ]) {
    const { context } = uiFixture();
    Object.assign(context.game, {
      state: outcome, catBlockCollected: collected, catBlockPreviouslyCollected: previouslyCollected,
    });
    assert.equal(context.saveResult().newCatBlock, expected);
  }
});

test('UI records losses once, ignores unstarted attempts, and tracks guest results only for the visit', () => {
  const { context, saves } = uiFixture();
  const slot = saves.create(0, 'Player');
  context.activeSave = { index: 0, slot };
  context.runSave = { index: 0, id: slot.id };
  context.game.state = 'ready';
  context.saveResult();
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
  const startLabel = () => elements.get('#title-start').children[0];
  context.updateSaveProfile();
  assert.equal(startLabel(), 'Start adventure ');
  const slot = saves.create(0, '<b>Player</b>');
  saves.complete(0, slot.id, levelIds[0]);
  context.renderSaveSlots();
  assert.equal(startLabel(), 'Continue as <b>Player</b> ', 'owner name is inserted as plain text');
  const sections = elements.get('#save-slot-list').children;
  assert.equal(sections.length, 3);
  assert.equal(sections[0].children[0].textContent, 'Slot 1 - <b>Player</b>');
  const totals = sections[0].children[0].children[0];
  assert.equal(totals.className, 'collectible-totals');
  assert.deepEqual(Array.from(totals.children, badge => badge['aria-label']),
    ['Flags: 1 of 61', 'Gold stars: 0 of 61', 'Cat Blocks: 0 of 10']);
  assert.equal(sections[1].children[0].children[0].children[2].children[1].textContent, '0/10');
  assert.equal(sections[0].children.length, 3, 'only heading, actions and owner form; no progress paragraph');
  let started = 0, mapOptions;
  context.begin = () => { started++; };
  context.openLevelPicker = options => { mapOptions = options; };
  context.continueSave(0, slot.id);
  assert.equal(mapOptions.level, 1);
  assert.equal(mapOptions.insideWorld, true);
  assert.equal(context.activeSave.slot.id, slot.id);
  assert.equal(started, 0);
  const remove = sections[0].children[1].children[1];
  context.confirm = () => false;
  remove.listeners.click();
  assert.ok(saves.load()[0]);
  context.confirm = () => true;
  remove.listeners.click();
  assert.equal(saves.load()[0], null);
  assert.equal(context.activeSave, null);
  assert.equal(startLabel(), 'Start adventure ', 'deleting the last save restores Start adventure');
});

test('save-slot collectible totals reflect each profile independently', () => {
  const { context, elements, saves } = uiFixture();
  const first = saves.create(0, 'First'), second = saves.create(1, 'Second');
  saves.collectCatBlock(0, first.id, levelIds[0]);
  saves.record(0, first.id, 'clean', {
    levelId: levelIds[0], outcome: 'won', damageFree: true, time: 20, food: 20, enemy: 0,
  });
  saves.record(0, first.id, 'repeat', {
    levelId: levelIds[0], outcome: 'won', damageFree: true, time: 18, food: 20, enemy: 0,
  });
  saves.collectCatBlock(1, second.id, levelIds[1]);
  saves.collectCatBlock(1, second.id, levelIds[2]);
  context.renderSaveSlots();
  const slots = elements.get('#save-slot-list').children;
  assert.deepEqual(Array.from(slots, slot => Array.from(
    slot.children[0].children[0].children, badge => badge.children[1].textContent)),
  [['1/61', '1/61', '1/10'], ['0/61', '0/61', '2/10'], ['0/61', '0/61', '0/10']]);
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
  assert.equal(saves.recent().slot.id, fresh.id, 'continuing or creating marks the slot most recent');
  context.continueSave(0, slot.id);
  assert.equal(saves.recent().index, 0);
});

test('starting campaign play queues last-played persistence and storage failures can be retried', () => {
  const { context, saves, storage, elements } = uiFixture(), slot = saves.create(0, 'Player');
  context.runSave = { index: 0, id: slot.id };
  context.activeSave = { index: 0, slot };
  context.game = { level: LEVELS[12], state: 'ready', elapsed: 0, score: 0, enemies: 0, moves: 0,
    start() { this.state = 'playing'; } };
  context.pause = { focus() {} };
  context.syncUI = () => {};
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('function startLevel('), source.indexOf('function showLevelBriefing(')), context);
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('Storage full'); };
  context.startLevel();
  assert.equal(context.game.state, 'playing');
  assert.equal(context.pendingSaves.length, 2);
  assert.match(elements.get('#save-error').textContent, /Storage full/);
  storage.setItem = write;
  context.flushSaves();
  assert.equal(context.pendingSaves.length, 0);
  assert.equal(saves.load()[0].lastPlayed, levelIds[12]);
  assert.equal(levelStats(saves.load()[0].results, levelIds[12]).quits, 1);
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
  assert.ok(begin.indexOf('saveResult()') < begin.indexOf('game = createGame()'), 'restarts finish the old attempt first');
  const start = source.slice(source.indexOf('function startLevel('), source.indexOf('function showLevelBriefing('));
  assert.ok(start.indexOf('checkpointAttempt()') > start.indexOf('game.start()'));
  const exit = source.slice(source.indexOf("querySelector('#exit-confirm-end')"), source.indexOf('function updateTutorial('));
  assert.ok(exit.indexOf('saveResult()') < exit.indexOf('resetBoard()'), 'ending a level records its quit before resetting');
  assert.match(source, /window\.addEventListener\('pagehide', checkpointAttempt\)/);
  assert.match(source, /if \(document\.hidden\) \{ autoPause\(\); checkpointAttempt\(\); \}/);
  const context = vm.createContext({});
  vm.runInContext(readFileSync(path.join(__dirname, '..', 'src', 'saves.js'), 'utf8'), context);
  assert.equal(typeof context.KoshiSaves.SaveSlots, 'function', 'save script supports direct-file classic startup');
});
