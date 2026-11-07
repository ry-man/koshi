(function () {
'use strict';

function collectibleStats(profile, levels) {
  const earnedStars = new Set(Object.values(profile?.results ?? {})
    .filter(result => result.outcome === 'won' && result.damageFree === true)
    .map(result => result.levelId));
  const foundBlocks = new Set(profile?.catBlocks ?? []);
  const completed = new Set(profile?.completed ?? []);
  return {
    flags: levels.filter(level => completed.has(level.id)).length,
    totalFlags: levels.length,
    stars: levels.filter(level => earnedStars.has(level.id)).length,
    totalStars: levels.length,
    catBlocks: levels.filter(level => level.catBlock && foundBlocks.has(level.id)).length,
    totalCatBlocks: levels.filter(level => level.catBlock).length,
  };
}

let outlineId = 0;

function levelRewardStates(game, results, attemptId) {
  const earnedStar = !game.customLevel && Object.entries(results ?? {}).some(([id, result]) =>
    id !== attemptId && result.levelId === game.level.id && result.outcome === 'won' && result.damageFree === true);
  const eligible = ['playing', 'paused', 'won'].includes(game.state);
  return {
    star: earnedStar ? 'owned' : eligible && !game.tookDamage ? 'pending' : 'uncollected',
    catBlock: !game.level.catBlock ? null : game.catBlockPreviouslyCollected ? 'owned'
      : eligible && game.catBlockCollected ? 'pending' : 'uncollected',
  };
}

function catBlockIcon(found, document, outlineColor = '#829096') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  const image = document.createElementNS(ns, 'image');
  image.setAttribute('href', './icons/cat-building-block.png');
  image.setAttribute('width', '100');
  image.setAttribute('height', '100');
  if (!found) {
    const id = `cat-block-outline-${outlineId++}`;
    const defs = document.createElementNS(ns, 'defs');
    const filter = document.createElementNS(ns, 'filter');
    filter.setAttribute('id', id);
    for (const [tag, attributes] of [
      ['feMorphology', { in: 'SourceAlpha', operator: 'erode', radius: '3', result: 'inside' }],
      ['feComposite', { in: 'SourceAlpha', in2: 'inside', operator: 'out', result: 'outline' }],
      ['feFlood', { 'flood-color': outlineColor }],
      ['feComposite', { in2: 'outline', operator: 'in' }],
    ]) {
      const primitive = document.createElementNS(ns, tag);
      for (const [name, value] of Object.entries(attributes)) primitive.setAttribute(name, value);
      filter.append(primitive);
    }
    defs.append(filter);
    svg.append(defs);
    image.setAttribute('filter', `url(#${id})`);
  }
  svg.append(image);
  return svg;
}

function goldStarIcon(earned, document) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M16 2 20.3 10.7 30 12.1 23 18.9 24.7 28.5 16 24 7.3 28.5 9 18.9 2 12.1 11.7 10.7Z');
  path.setAttribute('fill', earned ? 'currentColor' : 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

function collectibleTotals(profile, levels, document) {
  const stats = collectibleStats(profile, levels);
  const totals = document.createElement('span');
  totals.className = 'collectible-totals';
  totals.setAttribute('role', 'group');
  totals.setAttribute('aria-label', 'Collectible totals');
  for (const [label, collected, available, icon] of [
    ['Flags', stats.flags, stats.totalFlags, 'flag'],
    ['Gold stars', stats.stars, stats.totalStars, 'star'],
    ['Cat Blocks', stats.catBlocks, stats.totalCatBlocks, 'cat-block'],
  ]) {
    const badge = document.createElement('span');
    badge.className = 'collectible-total';
    badge.setAttribute('aria-label', `${label}: ${collected} of ${available}`);
    const graphic = icon === 'cat-block' ? catBlockIcon(true, document) : document.createElement('span');
    if (icon === 'flag') {
      graphic.className = 'collectible-flag';
      const cloth = document.createElement('span');
      cloth.className = 'flag-cloth';
      graphic.append(cloth);
    }
    if (icon === 'star') {
      graphic.className = 'collectible-star';
      graphic.textContent = '\u2605';
    }
    graphic.setAttribute('aria-hidden', 'true');
    const count = document.createElement('strong');
    count.textContent = `${collected}/${available}`;
    badge.append(graphic, count);
    totals.append(badge);
  }
  return totals;
}

const api = { collectibleStats, levelRewardStates, catBlockIcon, goldStarIcon, collectibleTotals };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.KoshiCollectibles = api;
})();
