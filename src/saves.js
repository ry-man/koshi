(function () {
'use strict';

const SAVE_KEY = 'koshi-campaign-saves-v1';
const SLOT_COUNT = 3;

function ownerName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 32) {
    throw new Error('Enter an owner name between 1 and 32 characters.');
  }
  return value.trim();
}

class SaveSlots {
  constructor(levelIds, storage = () => globalThis.localStorage, makeId = () => globalThis.crypto.randomUUID()) {
    this.levelIds = levelIds;
    this.storage = storage;
    this.makeId = makeId;
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
      ids.add(slot.id);
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
  nextLevel(slot) {
    const next = this.levelIds.findIndex(id => !slot.completed.includes(id));
    return next === -1 ? this.levelIds.length - 1 : next;
  }
}

const api = { SaveSlots, SAVE_KEY, SLOT_COUNT };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.KoshiSaves = api;
})();
