const test = require('node:test');
const assert = require('node:assert/strict');
const { collectibleStats, levelRewardStates, catBlockIcon, goldStarIcon } = require('../src/collectibles.js');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('HUD reuses icons while unchanged and does not turn current-run rewards into previously owned ones', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const node = () => ({ children: [], attributes: {}, setAttribute(k, v) { this.attributes[k] = v; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; this.updates = (this.updates ?? 0) + 1; } });
  const rewards = node();
  const game = { level: { id: 'a', catBlock: {} }, state: 'ready', tookDamage: false,
    catBlockCollected: false, catBlockPreviouslyCollected: false };
  const context = {
    game, activeSave: null, guestProfile: { results: {} }, pendingSaves: [], runSave: null, attemptId: 'current',
    levelRewardStates, displayedLevelRewards: '', levelRewardGame: null, previousLevelRewardResults: {},
    goldStarIcon: owned => ({ owned }), catBlockIcon: owned => ({ owned }),
    document: { createElement: node, querySelector: () => rewards },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function syncLevelRewards('), source.indexOf('\nfunction syncUI(')), context);
  context.syncLevelRewards();
  assert.equal(rewards.children.length, 2);
  assert.equal(rewards.children[0].children[0].owned, false);
  context.syncLevelRewards();
  assert.equal(rewards.updates, 1);
  game.state = 'won'; game.catBlockCollected = true;
  context.guestProfile.results.current = { levelId: 'a', outcome: 'won', damageFree: true };
  context.syncLevelRewards();
  assert.ok(rewards.children.every(badge => badge.className.includes('pending')));
  context.game = { ...game, state: 'ready', catBlockPreviouslyCollected: true };
  context.attemptId = 'next';
  context.syncLevelRewards();
  assert.ok(rewards.children.every(badge => badge.children[0].owned));
  context.game = { ...game, level: { id: 'b' }, state: 'ready' };
  context.syncLevelRewards();
  assert.equal(rewards.children.length, 1);
});

test('level reminders distinguish previously owned rewards from provisional winning-run rewards', () => {
  const game = { level: { id: 'a', catBlock: {} }, state: 'ready',
    tookDamage: false, catBlockCollected: false, catBlockPreviouslyCollected: false };
  const states = (results = {}) => levelRewardStates(game, results, 'current');
  assert.deepEqual(states(), { star: 'uncollected', catBlock: 'uncollected' });
  game.state = 'playing';
  assert.deepEqual(states(), { star: 'pending', catBlock: 'uncollected' });
  game.catBlockCollected = true;
  for (const state of ['playing', 'paused', 'won']) {
    game.state = state;
    assert.deepEqual(states({ current: { levelId: 'a', outcome: 'won', damageFree: true } }),
      { star: 'pending', catBlock: 'pending' });
  }
  game.tookDamage = true;
  assert.deepEqual(states(), { star: 'uncollected', catBlock: 'pending' });
  game.state = 'lost';
  assert.deepEqual(states(), { star: 'uncollected', catBlock: 'uncollected' });
  game.catBlockPreviouslyCollected = true;
  const previous = { earlier: { levelId: 'a', outcome: 'won', damageFree: true } };
  assert.deepEqual(states(previous), { star: 'owned', catBlock: 'owned' });
  assert.equal(states({ other: { levelId: 'b', outcome: 'won', damageFree: true } }).star, 'uncollected');
  assert.equal(states({ failed: { levelId: 'a', outcome: 'lost', damageFree: true } }).star, 'uncollected');
  delete game.level.catBlock;
  assert.equal(states().catBlock, null);
  game.customLevel = {};
  assert.equal(states(previous).star, 'uncollected', 'custom playtests do not inherit campaign stars');
});

const levels = [{ id: 'a', catBlock: {} }, { id: 'b' }, { id: 'c', catBlock: {} }];

test('collectible totals count distinct available levels, not attempts or stale IDs', () => {
  assert.deepEqual(collectibleStats({
    completed: ['a', 'a', 'b', 'c', 'missing'],
    catBlocks: ['a', 'a', 'b', 'missing'],
    results: {
      one: { levelId: 'a', outcome: 'won', damageFree: true },
      repeat: { levelId: 'a', outcome: 'won', damageFree: true },
      damaged: { levelId: 'b', outcome: 'won', damageFree: false },
      lost: { levelId: 'c', outcome: 'lost', damageFree: true },
      stale: { levelId: 'missing', outcome: 'won', damageFree: true },
    },
  }, levels), { flags: 3, totalFlags: 3, stars: 1, totalStars: 3, catBlocks: 1, totalCatBlocks: 2 });
  assert.deepEqual(collectibleStats(null, levels),
    { flags: 0, totalFlags: 3, stars: 0, totalStars: 3, catBlocks: 0, totalCatBlocks: 2 });
  assert.deepEqual(collectibleStats({ completed: ['a'] }, levels),
    { flags: 1, totalFlags: 3, stars: 0, totalStars: 3, catBlocks: 0, totalCatBlocks: 2 });
});

test('collectible states share identical geometry and change only fill or alpha-outline filtering', () => {
  const document = {
    createElementNS(ns, tag) {
      return {
        tag, attributes: {}, children: [],
        setAttribute(name, value) { this.attributes[name] = value; },
        append(...children) { this.children.push(...children); },
      };
    },
  };
  const emptyStar = goldStarIcon(false, document), fullStar = goldStarIcon(true, document);
  assert.deepEqual(emptyStar.attributes, fullStar.attributes);
  assert.deepEqual({ ...emptyStar.children[0].attributes, fill: 'currentColor' }, fullStar.children[0].attributes);
  const emptyBlock = catBlockIcon(false, document), fullBlock = catBlockIcon(true, document);
  assert.deepEqual(emptyBlock.attributes, fullBlock.attributes);
  const { filter, ...emptyImage } = emptyBlock.children[1].attributes;
  assert.deepEqual(emptyImage, fullBlock.children[0].attributes);
  assert.match(filter, /^url\(#cat-block-outline-/);
  const primitives = emptyBlock.children[0].children[0].children;
  assert.deepEqual(primitives.map(node => node.tag), ['feMorphology', 'feComposite', 'feFlood', 'feComposite']);
  assert.equal(primitives[0].attributes.in, 'SourceAlpha');
  assert.equal(primitives[0].attributes.operator, 'erode', 'the outline stays inside the collected silhouette');
  assert.equal(primitives[2].attributes['flood-color'], '#829096', 'map outlines keep their existing color');
  const guiBlock = catBlockIcon(false, document, 'currentColor');
  assert.equal(guiBlock.children[0].children[0].children[2].attributes['flood-color'], 'currentColor',
    'GUI outlines inherit the same neutral or pending gold color as stars');
});
