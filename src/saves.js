(function () {
'use strict';

const SAVE_KEY = 'koshi-campaign-saves-v2';
const RECENT_KEY = 'koshi-campaign-recent-save';
const SLOT_COUNT = 3;

function validateResult(result, levelIds) {
  if (!result || !levelIds.includes(result.levelId) || !['won', 'lost'].includes(result.outcome)
    || !['time', 'food', 'enemy'].every(key => Number.isFinite(result[key]) && result[key] >= 0)
    || (result.moves !== undefined && (!Number.isSafeInteger(result.moves) || result.moves < 0))
    || (result.goals !== undefined && (!Number.isSafeInteger(result.goals) || result.goals < 0))
    || (result.damageFree !== undefined && (typeof result.damageFree !== 'boolean'
      || (result.damageFree && result.outcome !== 'won')))) {
    throw new Error('Invalid completed level result.');
  }
}

function levelStats(results, levelId) {
  const attempts = Object.values(results ?? {}).filter(result => result.levelId === levelId);
  const wins = attempts.filter(result => result.outcome === 'won');
  const moveRecords = wins.filter(result => result.moves !== undefined);
  const goalRecords = attempts.filter(result => result.goals !== undefined);
  return {
    wins: wins.length, losses: attempts.length - wins.length,
    goldStar: wins.some(result => result.damageFree === true),
    winPercent: attempts.length ? wins.length / attempts.length * 100 : null,
    lossPercent: attempts.length ? (attempts.length - wins.length) / attempts.length * 100 : null,
    bestTime: wins.length ? Math.min(...wins.map(result => result.time)) : null,
    fewestMoves: moveRecords.length ? Math.min(...moveRecords.map(result => result.moves)) : null,
    mostFood: attempts.length ? Math.max(...attempts.map(result => result.food)) : null,
    mostEnemies: attempts.length ? Math.max(...attempts.map(result => result.enemy)) : null,
    mostGoals: goalRecords.length ? Math.max(...goalRecords.map(result => result.goals)) : null,
  };
}

function ownerName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 32) {
    throw new Error('Enter an owner name between 1 and 32 characters.');
  }
  return value.trim();
}

class SaveSlots {
  constructor(levelIds, storage = () => globalThis.localStorage, makeId = () => globalThis.crypto.randomUUID(), mainLevelIds = levelIds) {
    this.levelIds = levelIds;
    this.storage = storage;
    this.makeId = makeId;
    this.mainLevelIds = mainLevelIds;
  }
  load() {
    const raw = this.storage().getItem(SAVE_KEY);
    if (raw === null) return Array(SLOT_COUNT).fill(null);
    const data = JSON.parse(raw);
    const invalid = () => { throw new Error('Saved campaign data is invalid. Existing saves have not been changed.'); };
    if (!data || data.version !== 1 || !Array.isArray(data.slots) || data.slots.length !== SLOT_COUNT) invalid();
    const ids = new Set();
    for (const slot of data.slots) {
      if (slot === null) continue;
      if (!slot || typeof slot.id !== 'string' || !slot.id || ids.has(slot.id)
        || ownerName(slot.owner) !== slot.owner || !Array.isArray(slot.completed)
        || slot.completed.some(id => !this.levelIds.includes(id))
        || new Set(slot.completed).size !== slot.completed.length) invalid();
      if (slot.lastPlayed !== undefined && !this.levelIds.includes(slot.lastPlayed)) invalid();
      ids.add(slot.id);
      if (slot.results !== undefined) {
        if (!slot.results || typeof slot.results !== 'object' || Array.isArray(slot.results)) invalid();
        for (const [id, result] of Object.entries(slot.results)) {
          if (!id) invalid();
          validateResult(result, this.levelIds);
        }
      }
    }
    return data.slots;
  }
  write(slots) {
    this.storage().setItem(SAVE_KEY, JSON.stringify({ version: 1, slots }));
  }
  slot(slots, index, id) {
    if (!Number.isInteger(index) || index < 0 || index >= SLOT_COUNT) throw new Error('Choose one of the three save slots.');
    const slot = slots[index];
    if (!slot || slot.id !== id) throw new Error('This save slot changed or was deleted. Choose it again from Save slots.');
    return slot;
  }
  create(index, owner) {
    const name = ownerName(owner), slots = this.load();
    if (!Number.isInteger(index) || index < 0 || index >= SLOT_COUNT) throw new Error('Choose one of the three save slots.');
    if (slots[index]) throw new Error('This slot is already occupied. Choose an empty slot or delete its save first.');
    const slot = { id: this.makeId(), owner: name, completed: [] };
    slots[index] = slot;
    this.write(slots);
    return slot;
  }
  rename(index, id, owner) {
    const name = ownerName(owner), slots = this.load();
    this.slot(slots, index, id).owner = name;
    this.write(slots);
  }
  remove(index, id) {
    const slots = this.load();
    this.slot(slots, index, id);
    slots[index] = null;
    this.write(slots);
  }
  complete(index, id, levelId) {
    if (!this.levelIds.includes(levelId)) throw new Error('Only campaign levels can be saved.');
    const slots = this.load(), slot = this.slot(slots, index, id);
    if (!slot.completed.includes(levelId)) {
      slot.completed.push(levelId);
      this.write(slots);
    }
    return slot;
  }
  record(index, id, attemptId, result) {
    if (typeof attemptId !== 'string' || !attemptId || ['__proto__', 'constructor', 'prototype'].includes(attemptId)) {
      throw new Error('Invalid level attempt ID.');
    }
    validateResult(result, this.levelIds);
    const slots = this.load(), slot = this.slot(slots, index, id);
    slot.results ??= {};
    if (Object.hasOwn(slot.results, attemptId)) {
      const previous = slot.results[attemptId];
      if (['levelId', 'outcome', 'time', 'food', 'enemy', 'moves', 'goals', 'damageFree'].some(key => previous[key] !== result[key])) {
        throw new Error('This attempt already has a different saved result.');
      }
      return slot;
    }
    slot.results[attemptId] = { ...result };
    if (result.outcome === 'won' && !slot.completed.includes(result.levelId)) slot.completed.push(result.levelId);
    this.write(slots);
    return slot;
  }
  visit(index, id, levelId) {
    if (!this.levelIds.includes(levelId)) throw new Error('Only campaign levels can be saved.');
    const slots = this.load(), slot = this.slot(slots, index, id);
    if (slot.lastPlayed !== levelId) {
      slot.lastPlayed = levelId;
      this.write(slots);
    }
    return slot;
  }
  markRecent(index, id) {
    this.slot(this.load(), index, id);
    this.storage().setItem(RECENT_KEY, id);
  }
  // Older saves have no recent marker, and deleted slots leave a stale one; fall back to the first occupied slot.
  recent(slots = this.load()) {
    const id = this.storage().getItem(RECENT_KEY);
    let index = slots.findIndex(slot => slot && slot.id === id);
    if (index < 0) index = slots.findIndex(slot => slot);
    return index < 0 ? null : { index, slot: slots[index] };
  }
  resumeLevel(slot) {
    return slot.lastPlayed === undefined ? this.nextLevel(slot) : this.levelIds.indexOf(slot.lastPlayed);
  }
  nextLevel(slot) {
    const next = this.mainLevelIds.find(id => !slot.completed.includes(id)) ?? this.mainLevelIds.at(-1);
    return this.levelIds.indexOf(next);
  }
}

const api = { SaveSlots, SAVE_KEY, RECENT_KEY, SLOT_COUNT, levelStats };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.KoshiSaves = api;
})();
