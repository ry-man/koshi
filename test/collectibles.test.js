const test = require('node:test');
const assert = require('node:assert/strict');
const { collectibleStats, catBlockIcon, goldStarIcon } = require('../src/collectibles.js');

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
});
