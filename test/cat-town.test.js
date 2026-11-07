const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LOCATIONS, TOWN_ITEMS, townState, earnedGoldStars, chooseOffers, purchaseItem, buildTree, fabledFish, stageCatPosition,
} = require('../src/cat-town.js');
const { SaveSlots } = require('../src/saves.js');

test('Cat Town actors stay inside the visible stage on phones and wide screens', () => {
  const actors = [[385, 350, 1.18], [570, 350, 1.18], [740, 355, 1.3],
    [190, 360, 1.1], [760, 360, 1.1], [145, 360, 1], [850, 360, .9]];
  for (const [width, height] of [[320, 460], [390, 480], [430, 520], [844, 190], [1280, 530], [960, 540]]) {
    const scale = Math.max(width / 960, height / 540);
    const bounds = { left: (960 - width / scale) / 2, top: (540 - height / scale) / 2,
      width: width / scale, height: height / scale };
    const positions = actors.map(([x, y, size]) => stageCatPosition(x, y, size, bounds));
    for (const actor of positions) {
      const margin = actor.scale * 45 + 6;
      assert.ok(actor.x - margin >= bounds.left - 1e-9);
      assert.ok(actor.x + margin <= bounds.left + bounds.width + 1e-9);
      assert.ok(actor.y - margin >= bounds.top - 1e-9);
      assert.ok(actor.y + margin <= bounds.top + bounds.height + 1e-9);
    }
    for (const [left, right] of [[0, 1], [3, 4], [5, 6]]) {
      assert.ok(positions[right].x - positions[left].x > (positions[left].scale + positions[right].scale) * 45);
    }
  }
});

test('Cat Town has four non-level destinations arranged as a closed loop', () => {
  assert.deepEqual(LOCATIONS.map(location => location.id), ['mall', 'house', 'tree', 'tank']);
  assert.equal(new Set(LOCATIONS.map(location => `${location.x},${location.y}`)).size, 4);
  assert.deepEqual(townState({}), { spentStars: 0, offers: [], items: [], builtBlocks: 0 });
});

test('the mall offers three distinct randomized catalog items at two stars each', () => {
  const offers = chooseOffers(TOWN_ITEMS, () => 0);
  assert.equal(offers.length, 3);
  assert.equal(new Set(offers).size, 3);
  assert.ok(offers.every(id => TOWN_ITEMS.find(item => item.id === id).cost === 2));
  assert.throws(() => chooseOffers([], () => 0), /at least three items/);
});

test('purchases require an offered item and enough unspent stars, and Cat Blocks build the tree once', () => {
  const initial = { spentStars: 0, offers: ['star-lamp'], items: [], builtBlocks: 0 };
  const item = TOWN_ITEMS.find(entry => entry.id === 'star-lamp');
  assert.throws(() => purchaseItem(initial, item, 1), /need 2 unspent gold stars/);
  const bought = purchaseItem(initial, item, 2);
  assert.equal(bought.spentStars, 2);
  assert.equal(bought.items[0].id, 'star-lamp');
  assert.throws(() => purchaseItem(bought, item, 2), /no longer available/);
  assert.deepEqual(buildTree(initial, 3), { ...initial, builtBlocks: 3 });
  assert.throws(() => buildTree({ ...initial, builtBlocks: 3 }, 2), /cannot go backward/);
});

test('gold stars are counted once per level and Fabled Fish unlock after a special world is complete', () => {
  const levels = [
    { id: 's1-a', worldId: 'S1' }, { id: 's1-b', worldId: 'S1' },
    { id: 's2-a', worldId: 'S2' },
  ];
  const profile = {
    results: {
      first: { levelId: 's1-a', outcome: 'won', damageFree: true },
      replay: { levelId: 's1-a', outcome: 'won', damageFree: true },
      second: { levelId: 's1-b', outcome: 'won', damageFree: true },
      lost: { levelId: 's2-a', outcome: 'lost', damageFree: false },
    },
    completed: ['s1-a'],
  };
  assert.equal(earnedGoldStars(profile, levels), 2);
  assert.deepEqual(fabledFish(profile, [{ id: 'S1', name: 'Happy Meadows', color: '#76c96a' }], levels), []);
  profile.completed.push('s1-b');
  assert.deepEqual(fabledFish(profile, [{ id: 'S1', name: 'Happy Meadows', color: '#76c96a' }], levels), [
    { id: '1', color: '#76c96a', world: 'Happy Meadows' },
  ]);
});

test('Cat Town purchases and tree construction persist without allowing unearned spending', () => {
  const data = new Map(), storage = () => ({
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  });
  const saves = new SaveSlots(['level-1', 'level-2'], storage, () => 'profile');
  let slot = saves.create(0, 'Player');
  slot = saves.record(0, slot.id, 'win-1', {
    levelId: 'level-1', outcome: 'won', time: 10, food: 1, enemy: 0, damageFree: true,
  });
  slot = saves.record(0, slot.id, 'win-2', {
    levelId: 'level-2', outcome: 'won', time: 10, food: 1, enemy: 0, damageFree: true,
  });
  slot = saves.collectCatBlock(0, slot.id, 'level-1');
  const state = {
    spentStars: 2, offers: ['star-lamp', 'yarn-basket', 'fish-poster'],
    items: [{ id: 'star-lamp', name: 'Star lamp', description: 'A gold star lamp.', cost: 2 }],
    builtBlocks: 1,
  };
  saves.updateCatTown(0, slot.id, state);
  assert.deepEqual(new SaveSlots(['level-1', 'level-2'], storage).load()[0].catTown, state);
  assert.throws(() => saves.updateCatTown(0, slot.id, { ...state, spentStars: 3 }), /invalid/);
  assert.throws(() => saves.updateCatTown(0, slot.id, { ...state, builtBlocks: 2 }), /invalid/);
  assert.throws(() => saves.updateCatTown(0, slot.id, { ...state, items: [state.items[0], state.items[0]] }), /invalid/);
});
