(function () {
'use strict';

const engine = typeof module !== 'undefined' && module.exports ? require('./game.js') : globalThis.KoshiGame;
const { LEVELS, FOODS, ITEMS, OBJECTS, SWORDS, CHARACTERS } = engine;

const WORLDS = [
  { id: '1', name: 'Garden Path', theme: 'garden', special: false, next: ['2'] },
  { id: '2', name: 'Clockwork Pantry', theme: 'workshop', special: false, next: ['3'] },
  { id: '3', name: 'Robot Foundry', theme: 'foundry', special: false, next: [] },
];

function worldLevels(world, levels = LEVELS) {
  return levels.filter(level => level.worldId === world.id);
}

// Special worlds use IDs such as S2 and branch via next; normal advancement prefers the main path.
function nextLevelIndex(index, worlds = WORLDS, levels = LEVELS) {
  const level = levels[index];
  if (!level) throw new RangeError(`Unknown level: ${index}`);
  const world = worlds.find(entry => entry.id === level.worldId);
  if (!world) throw new Error(`Unknown world: ${level.worldId}`);
  const members = worldLevels(world, levels), position = members.indexOf(level);
  if (position + 1 < members.length) return levels.indexOf(members[position + 1]);
  const destinations = world.next.map(id => {
    const destination = worlds.find(entry => entry.id === id);
    if (!destination || !worldLevels(destination, levels).length) throw new Error(`Invalid world destination: ${id}`);
    return destination;
  });
  const next = destinations.find(entry => !entry.special) ?? destinations[0];
  return next ? levels.indexOf(worldLevels(next, levels)[0]) : -1;
}

function levelFeatures(level) {
  const features = new Map();
  const titleCase = name => String(name).replace(/\b[a-z]/g, letter => letter.toUpperCase());
  const add = (picture, name) => features.set(picture, { picture, name: titleCase(name) });
  const event = (kind, type) => {
    const catalog = { food: FOODS, item: ITEMS, object: OBJECTS, weapon: SWORDS, enemy: CHARACTERS };
    add(`${kind}:${type}`, kind === 'enemy' ? CHARACTERS[type]
      : catalog[kind]?.[type]?.name ?? (type === 'soccer-ball' ? 'Soccer ball' : type));
  };
  for (const kind of ['food', 'enemy', 'weapon', 'item']) {
    const entries = level[{ food: 'food', enemy: 'enemies', weapon: 'weapons', item: 'items' }[kind]] ?? [];
    for (const entry of entries) event(kind, entry[kind === 'food' ? 2 : 1]);
  }
  for (const entry of level.events ?? []) event(entry.kind, entry.type);
  const index = LEVELS.indexOf(level);
  const bricks = index === -1 ? level.brickTypes ?? [] : new engine.Game(() => .5, { level: index }).bricks;
  for (const brick of bricks.filter(brick => brick.absorbedBy == null)) {
    if (brick.kind) {
      const kind = ['normal', 'slow', 'fast'].includes(brick.kind) ? 'normal' : brick.kind;
      add(`${kind === 'goal' ? 'special' : 'brick'}:${kind}`,
        kind === 'normal' ? 'Steering Brick' : `${kind} Brick`);
    }
    for (const key of ['crumbler', 'warped']) if (brick[key]) add(`brick:${key}`, `${key} Brick`);
    for (const key of ['spikes', 'springs', 'conveyor', 'boost', 'toggle', 'portal', 'spawner', 'barrier', 'turret']) {
      if (brick[key]) add(`${['spikes', 'springs', 'conveyor'].includes(key) ? 'brick' : 'special'}:${key}`, `${key} Brick`);
    }
    if (brick.slimed) add('slime:green', 'Slime');
    if (brick.spawner) event(brick.spawner.kind, brick.spawner.type);
  }
  if (Number.isFinite(level.heartCost)) add('heart:heart', 'Healing Heart');
  if (level.activationLimit != null) add('special:boom-helmet', 'Boom Helmet');
  return [...features.values()];
}

const api = { WORLDS, worldLevels, nextLevelIndex, levelFeatures };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.KoshiWorlds = api;
})();
