// Roguelike Mode (prototype): a seeded, three-act run of randomized events played
// with generated custom levels. See roguelike.md for the design outline.
(function () {
'use strict';

const KoshiGame = typeof module !== 'undefined' && module.exports ? require('./game.js') : globalThis.KoshiGame;
const { WEAPONS, ITEMS, OBJECTS, FOODS, PORTALS, validateCustomLevel, makeBricks, boardDimensions, brickPerimeter, CHARACTERS } = KoshiGame;

// ---------- Seeded randomness ----------

function hashSeed(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function createRng(seed) {
  let a = hashSeed(String(seed))();
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const rollInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

function shuffled(rng, list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomSeed() {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let seed = '';
  for (let i = 0; i < 8; i++) seed += letters[Math.floor(Math.random() * letters.length)];
  return seed;
}

// ---------- Board model ----------
// The arena ring has 26 bricks with stable IDs matching makeBricks():
// IDs 0-9 alternate top/bottom across 5 columns; IDs 10-25 alternate left/right down 8 rows.

const BRICK_COUNT = 26;

function brickSlot(id) {
  if (id < 10) return { edge: id % 2 === 0 ? 'top' : 'bottom', index: Math.floor(id / 2), count: 5 };
  return { edge: (id - 10) % 2 === 0 ? 'left' : 'right', index: Math.floor((id - 10) / 2), count: 8 };
}

const PERIMETER = (() => {
  const bricks = makeBricks(false, 1, 8);
  const { width, height } = boardDimensions(false, 1, 8);
  return brickPerimeter(bricks, width, height);
})();

function emptyBrick(id) {
  return {
    id, kind: 'normal', crumbler: null, warped: null, toggle: null, power: false,
    slimed: false, slimeColor: null, springs: false, spikes: false, conveyor: false,
    conveyorDirection: null, boost: false, barrier: false, portal: null, turret: null,
    hazard: null, spawner: null,
  };
}

// Type A attributes (warped, crumbler) may coexist with each other and with one
// Type B attribute; Type B attributes are exclusive per brick. See roguelike.md.
const hasTypeA = brick => brick.crumbler !== null || brick.warped !== null;
const hasTypeB = brick => ['cinder', 'goal'].includes(brick.kind) || brick.toggle !== null || brick.power
  || brick.slimed || brick.springs || brick.spikes || brick.conveyor || brick.boost || brick.barrier
  || brick.portal !== null || brick.turret !== null || brick.hazard !== null || brick.spawner !== null;

function clearTypeB(brick) {
  if (['cinder', 'goal'].includes(brick.kind)) brick.kind = 'normal';
  brick.toggle = null; brick.power = false;
  brick.slimed = false; brick.slimeColor = null; brick.springs = false; brick.spikes = false;
  brick.conveyor = false; brick.conveyorDirection = null; brick.boost = false; brick.barrier = false;
  brick.portal = null; brick.turret = null; brick.hazard = null; brick.spawner = null;
}

function clearTypeA(brick) {
  brick.crumbler = null;
  brick.warped = null;
}

function restoreBrick(brick) {
  clearTypeA(brick);
  clearTypeB(brick);
  brick.kind = 'normal';
}

// Eligible placements: a brick without the spell's attribute type; attributes may
// only be overwritten once every brick carries one of that type.
function placementBricks(profile, type) {
  const open = profile.bricks.filter(brick => !['cinder', 'goal'].includes(brick.kind)
    && (type === 'A' ? !hasTypeA(brick) : !hasTypeB(brick)));
  return open.length ? open : profile.bricks.filter(brick => type === 'B' || !['cinder', 'goal'].includes(brick.kind));
}

function assignTypeA(profile, id, assign) {
  const brick = profile.bricks[id];
  if (['cinder', 'goal'].includes(brick.kind)) brick.kind = 'normal';
  Object.assign(brick, assign);
}

function assignTypeB(profile, id, assign) {
  const brick = profile.bricks[id];
  clearTypeB(brick);
  if (assign.kind === 'cinder' || assign.kind === 'goal') clearTypeA(brick);
  Object.assign(brick, assign);
}

function ungroupedAdjacentPairs(profile) {
  const grouped = new Set(profile.brickGroups.flatMap(group => group.members));
  const pairs = [];
  for (let i = 0; i < PERIMETER.length; i++) {
    const a = PERIMETER[i], b = PERIMETER[(i + 1) % PERIMETER.length];
    if (grouped.has(a) || grouped.has(b)) continue;
    const brickA = profile.bricks[a], brickB = profile.bricks[b];
    if ((brickA.kind === 'cinder') !== (brickB.kind === 'cinder')) continue;
    if ((brickA.kind === 'goal') !== (brickB.kind === 'goal')) continue;
    pairs.push([a, b]);
  }
  return pairs;
}

function brickPlaceName(id) {
  const slot = brickSlot(id);
  const edge = slot.edge[0].toUpperCase() + slot.edge.slice(1);
  return `${edge} ${slot.index + 1}`;
}

function brickContentName(brick) {
  const kinds = { slow: 'Slow', normal: 'Normal', fast: 'Fast', cinder: 'Cinder', goal: 'Goal' };
  const parts = [kinds[brick.kind]];
  if (brick.crumbler !== null) parts.push(`Crumbler ${brick.crumbler}`);
  if (brick.warped !== null) parts.push('Warped');
  if (brick.toggle !== null) parts.push(`Toggle ${brick.toggle}`);
  if (brick.power) parts.push('Power');
  if (brick.slimed) parts.push(`${brick.slimeColor ?? 'green'} Slime`);
  if (brick.springs) parts.push('Springs');
  if (brick.spikes) parts.push('Spikes');
  if (brick.conveyor) parts.push('Conveyor');
  if (brick.boost) parts.push('Boost');
  if (brick.barrier) parts.push('Barrier');
  if (brick.portal !== null) parts.push(`${brick.portal} Portal`);
  if (brick.turret !== null) parts.push(`${brick.turret} Turret`);
  if (brick.hazard !== null) parts.push(`${brick.hazard.type} Hazard`);
  if (brick.spawner !== null) parts.push(`Spawner (${brick.spawner.type})`);
  return parts.join(' · ');
}

// Per-brick edge overrides for the custom-level schema; every brick is emitted so
// the engine's default slow/fast bricks are replaced by the profile's state.
function brickTypesFor(profile) {
  return profile.bricks.map(brick => {
    const slot = brickSlot(brick.id);
    const entry = {
      edge: slot.edge, start: slot.index / slot.count, end: (slot.index + 1) / slot.count,
      kind: brick.kind,
    };
    if (['cinder', 'goal'].includes(brick.kind)) return entry;
    return {
      ...entry,
      crumbler: brick.crumbler, warped: brick.warped,
      slimeColor: brick.slimeColor ?? 'green',
      conveyorDirection: brick.conveyorDirection ?? 'clockwise',
      slimed: brick.slimed, springs: brick.springs, spikes: brick.spikes, conveyor: brick.conveyor,
      barrier: brick.barrier, power: brick.power, portal: brick.portal, turret: brick.turret,
      hazard: brick.hazard ? { ...brick.hazard } : null,
      toggle: brick.toggle, boost: brick.boost,
      spawner: brick.spawner ? { ...brick.spawner } : null,
    };
  });
}

// ---------- Weapons ----------
// A run weapon is a family plus a strike count; it spawns as the highest tier
// whose threshold the strikes reach, falling back to a wood sword.

const WEAPON_TIERS = {
  sword: [['wood', 1], ['bronze', 3], ['silver', 5], ['gold', 10]],
  hammer: [['hammer-bronze', 3], ['hammer-silver', 5], ['hammer-gold', 10]],
  axe: [['axe-silver', 6], ['axe-gold', 12]],
  'rope-dart': [['rope-dart-bronze', 3], ['rope-dart-silver', 5], ['rope-dart-gold', 10]],
};
const FAMILY_MAX = { sword: 10, hammer: 10, axe: 12, 'rope-dart': 10 };

function weaponSpawnType(weapon) {
  const tiers = WEAPON_TIERS[weapon.family];
  let type = null;
  for (const [tier, threshold] of tiers) if (weapon.strikes >= threshold) type = tier;
  return type ?? 'wood';
}

function weaponName(weapon) {
  return `${WEAPONS[weaponSpawnType(weapon)].name} (${weapon.strikes})`;
}

function addWeapon(profile, family, strikes) {
  profile.weapons.push({ family, strikes: Math.min(FAMILY_MAX[family], Math.max(1, strikes)), acquired: profile.weaponCounter++ });
}

function adjustStrikes(weapon, delta) {
  weapon.strikes = Math.min(FAMILY_MAX[weapon.family], Math.max(1, weapon.strikes + delta));
}

// ---------- Profile ----------

function initialProfile() {
  const profile = {
    bricks: Array.from({ length: BRICK_COUNT }, (_, id) => emptyBrick(id)),
    brickGroups: [],
    weapons: [],
    items: [],
    balls: ['soccer-ball', 'soccer-ball', 'soccer-ball'],
    powers: {
      weaponPsychic: 0, itemPsychic: 0,
      bubbleImmunity: false, slimeImmunity: false, crumblerImmunity: false, spikeImmunity: false,
      goalBonus: 0, startShield: null,
    },
    attributes: { hearts: 3, maxHearts: 3, weaponInterval: 15, itemInterval: 20, ballInterval: 30 },
    weaponCounter: 0,
  };
  for (let i = 0; i < 3; i++) addWeapon(profile, 'sword', 1);
  return profile;
}

// ---------- Spells ----------
// Target specs: { kind: 'weapon'|'item'|'ball'|'brick'|'group', count?, options(run) }.
// Options are { value, label } pairs; apply(run, targets, rng) receives the values.

const weaponTargets = run => run.profile.weapons.map((weapon, index) => ({ value: index, label: weaponName(weapon) }));
const itemTargets = run => run.profile.items.map((type, index) => ({ value: index, label: ITEMS[type].name }));
const ballTargets = run => run.profile.balls.map((type, index) => ({ value: index, label: OBJECTS[type].name }));
const brickTargets = type => run => placementBricks(run.profile, type)
  .map(brick => ({ value: brick.id, label: `${brickPlaceName(brick.id)} · ${brickContentName(brick)}` }));
const touchedBrickTargets = run => run.profile.bricks
  .filter(brick => hasTypeA(brick) || hasTypeB(brick) || brick.kind !== 'normal')
  .map(brick => ({ value: brick.id, label: `${brickPlaceName(brick.id)} · ${brickContentName(brick)}` }));

const SPELLS = [];
function spell(name, flavor, type, rarity, description, definition = {}) {
  SPELLS.push({ name, flavor, type, rarity, description, ...definition });
}

// --- Soccer ---
for (const [name, rarity, flavor, type, label] of [
  ['New Ball', 'common', '+', 'soccer-ball', 'normal soccer ball'],
  ['New Big Ball', 'uncommon', '+', 'soccer-ball-jumbo', 'jumbo soccer ball'],
  ['New Red Ball', 'rare', '-', 'soccer-ball-red', 'normal sized red explosive soccer ball'],
  ['New Green Ball', 'uncommon', '-', 'soccer-ball-green', 'normal sized green explosive soccer ball'],
  ['New Blue Ball', 'common', '-', 'soccer-ball-blue', 'normal sized blue explosive soccer ball'],
  ['New Big Red Ball', 'rare', '-', 'soccer-ball-jumbo-red', 'jumbo red explosive soccer ball'],
  ['New Big Green Ball', 'uncommon', '-', 'soccer-ball-jumbo-green', 'jumbo green explosive soccer ball'],
  ['New Big Blue Ball', 'common', '-', 'soccer-ball-jumbo-blue', 'jumbo blue explosive soccer ball'],
]) {
  spell(name, flavor, 'soccer', rarity, `Add one ${label}`, {
    apply: run => run.profile.balls.push(type),
  });
}
spell('Deflate', '+', 'soccer', 'common', 'Remove one selected soccer ball', {
  target: { kind: 'ball', options: ballTargets },
  apply: (run, [index]) => run.profile.balls.splice(index, 1),
});
spell('Random Deflate', '-', 'soccer', 'common', 'Remove one random soccer ball', {
  available: run => run.profile.balls.length > 0,
  apply: (run, targets, rng) => run.profile.balls.splice(Math.floor(rng() * run.profile.balls.length), 1),
});

// --- Powers ---
for (const [n, rarity] of [[1, 'common'], [2, 'uncommon'], [3, 'rare']]) {
  spell(`Weapon Psychic ${n}`, '+', 'power', rarity, `Koshi can select the first ${n} weapon${n > 1 ? 's' : ''} to appear regardless of shuffle`, {
    available: run => run.profile.powers.weaponPsychic < n,
    apply: run => { run.profile.powers.weaponPsychic = Math.max(run.profile.powers.weaponPsychic, n); },
  });
  spell(`Item Psychic ${n}`, '+', 'power', rarity, `Koshi can select the first ${n} item${n > 1 ? 's' : ''} to appear regardless of shuffle`, {
    available: run => run.profile.powers.itemPsychic < n,
    apply: run => { run.profile.powers.itemPsychic = Math.max(run.profile.powers.itemPsychic, n); },
  });
}
for (const [name, attribute] of [['Weapon Speed Up', 'weaponInterval'], ['Item Speed Up', 'itemInterval'], ['Soccer Speed Up', 'ballInterval']]) {
  spell(name, '+', 'power', 'uncommon', `${name.replace(' Speed Up', '')} speed up (decreased delay between spawns)`, {
    available: run => run.profile.attributes[attribute] > 5,
    apply: run => {
      const attributes = run.profile.attributes;
      attributes[attribute] = Math.max(5, Math.round(attributes[attribute] * .75));
    },
  });
}
for (const [name, rarity, power, description] of [
  ['Bubble Immunity', 'common', 'bubbleImmunity', 'No longer impacted by bubbles (they just pop on contact)'],
  ['Slime Immunity', 'uncommon', 'slimeImmunity', 'No longer stuck due to slime'],
  ['Crumbler Immunity', 'uncommon', 'crumblerImmunity', 'No longer activates the counter on Crumblers when clicked'],
  ['Spike Immunity', 'rare', 'spikeImmunity', 'No longer takes damage from spike bricks and spiked obstructions'],
]) {
  spell(name, '+', 'power', rarity, description, {
    available: run => !run.profile.powers[power],
    apply: run => { run.profile.powers[power] = true; },
  });
}
spell('Health Bonus', '+', 'power', 'rare', '+1 additional heart (maximum of 6)', {
  available: run => run.profile.attributes.maxHearts < 6,
  apply: run => {
    run.profile.attributes.maxHearts++;
    run.profile.attributes.hearts++;
  },
});
spell('Red Shield', '+', 'power', 'uncommon', 'Start each battle with a red Cat Shield', {
  available: run => run.profile.powers.startShield === null,
  apply: run => { run.profile.powers.startShield = 'red'; },
});
spell('Green Shield', '+', 'power', 'rare', 'Start each battle with a green Cat Shield', {
  available: run => run.profile.powers.startShield !== 'green',
  apply: run => { run.profile.powers.startShield = 'green'; },
});
spell('Power Shot', '+', 'power', 'rare', '+1 point for all soccer goals', {
  apply: run => { run.profile.powers.goalBonus++; },
});

// --- Weapons ---
spell('Super Duper', '+', 'weapon', 'uncommon', 'Duplicate 1 selected weapon', {
  target: { kind: 'weapon', options: weaponTargets },
  apply: (run, [index]) => {
    const weapon = run.profile.weapons[index];
    addWeapon(run.profile, weapon.family, weapon.strikes);
  },
});
spell('Weapon Dumpster', '+', 'weapon', 'uncommon', 'Remove 1 selected weapon', {
  target: { kind: 'weapon', options: weaponTargets },
  apply: (run, [index]) => run.profile.weapons.splice(index, 1),
});
for (const [name, rarity, family, strikes] of [
  ['Wood Sword', 'common', 'sword', 1], ['Bronze Sword', 'common', 'sword', 3],
  ['Silver Sword', 'uncommon', 'sword', 5], ['Gold Sword', 'rare', 'sword', 10],
  ['Bronze Hammer', 'common', 'hammer', 3], ['Silver Hammer', 'uncommon', 'hammer', 5],
  ['Gold Hammer', 'rare', 'hammer', 10],
  ['Silver Axe', 'uncommon', 'axe', 6], ['Gold Axe', 'rare', 'axe', 12],
]) {
  spell(name, '+', 'weapon', rarity, `Add ${name.toLowerCase()} to weapons`, {
    apply: run => addWeapon(run.profile, family, strikes),
  });
}
for (const [name, rarity, flavor, delta, random] of [
  ['Random Lil Smith', 'common', '+', 1, true], ['Lil Smith', 'common', '+', 1, false],
  ['Random Smith', 'uncommon', '+', 2, true], ['Smith', 'uncommon', '+', 2, false],
  ['Random Lil Rust', 'common', '-', -1, true], ['Lil Rust', 'common', '-', -1, false],
  ['Random Rust', 'uncommon', '-', -2, true], ['Rust', 'common', '-', -2, false],
  ['Random Rustier', 'rare', '-', -3, true], ['Rustier', 'uncommon', '-', -3, false],
]) {
  const description = `${delta > 0 ? '+' : ''}${delta} strike${Math.abs(delta) > 1 ? 's' : ''} to one ${random ? 'random' : 'selected'} weapon`;
  spell(name, flavor, 'weapon', rarity, description, random ? {
    available: run => run.profile.weapons.length > 0,
    apply: (run, targets, rng) => adjustStrikes(pick(rng, run.profile.weapons), delta),
  } : {
    target: { kind: 'weapon', options: weaponTargets },
    apply: (run, [index]) => adjustStrikes(run.profile.weapons[index], delta),
  });
}
spell('Systemic Smith', '+', 'weapon', 'rare', '+1 strike to all weapons', {
  available: run => run.profile.weapons.length > 0,
  apply: run => { for (const weapon of run.profile.weapons) adjustStrikes(weapon, 1); },
});
spell('Systemic Rust', '-', 'weapon', 'rare', '-1 strike to all weapons', {
  available: run => run.profile.weapons.length > 0,
  apply: run => { for (const weapon of run.profile.weapons) adjustStrikes(weapon, -1); },
});
spell('Random Weapon Dumpster', '-', 'weapon', 'uncommon', 'Remove 1 weapon at random', {
  available: run => run.profile.weapons.length > 0,
  apply: (run, targets, rng) => run.profile.weapons.splice(Math.floor(rng() * run.profile.weapons.length), 1),
});
spell('Lost Weapon', '-', 'weapon', 'common', 'Replace one selected weapon with a wood sword', {
  target: { kind: 'weapon', options: weaponTargets },
  apply: (run, [index]) => { run.profile.weapons[index] = { family: 'sword', strikes: 1, acquired: run.profile.weaponCounter++ }; },
});
spell('Oops! All Swords', '-', 'weapon', 'uncommon', 'Replace all weapons with swords of matching strike count', {
  available: run => run.profile.weapons.some(weapon => weapon.family !== 'sword'),
  apply: run => { for (const weapon of run.profile.weapons) weapon.family = 'sword'; },
});
spell('Stuper Duper', '-', 'weapon', 'common', 'Copy your weapon with the lowest strike count', {
  available: run => run.profile.weapons.length > 0,
  apply: run => {
    const lowest = run.profile.weapons.reduce((best, weapon) => weapon.strikes < best.strikes ? weapon : best);
    addWeapon(run.profile, lowest.family, lowest.strikes);
  },
});
spell('Downgrade', '-', 'weapon', 'rare', 'Replace your weapon with the highest strike count with a wood sword', {
  available: run => run.profile.weapons.length > 0,
  apply: run => {
    const highest = run.profile.weapons.reduce((best, weapon) => weapon.strikes > best.strikes ? weapon : best);
    highest.family = 'sword';
    highest.strikes = 1;
  },
});
spell("Where'd That Go?", '-', 'weapon', 'uncommon', 'Remove your most recently acquired weapon', {
  available: run => run.profile.weapons.length > 0,
  apply: run => {
    const recent = run.profile.weapons.reduce((best, weapon) => weapon.acquired > best.acquired ? weapon : best);
    run.profile.weapons.splice(run.profile.weapons.indexOf(recent), 1);
  },
});

// --- Items ---
spell('Control C', '+', 'item', 'uncommon', 'Duplicate 1 selected item', {
  target: { kind: 'item', options: itemTargets },
  apply: (run, [index]) => run.profile.items.push(run.profile.items[index]),
});
spell('Control X', '+', 'item', 'uncommon', 'Remove 1 selected item', {
  target: { kind: 'item', options: itemTargets },
  apply: (run, [index]) => run.profile.items.splice(index, 1),
});
for (const [name, rarity, flavor, type] of [
  ['Cat Shield (Red)', 'common', '+', 'cat-shield-red'],
  ['Cat Shield (Green)', 'uncommon', '+', 'cat-shield-green'],
  ['Cat Shield (Blue)', 'rare', '+', 'cat-shield-blue'],
  ['Battery', 'uncommon', '+', 'battery'],
  ['Smiley Cookie', 'common', '+', 'smiley-cookie'],
  ['Anvil', 'common', '+', 'anvil'],
  ['Music Box', 'common', '+', 'music-box'],
  ['Saw Blade', 'uncommon', '-', 'saw-blade'],
  ['Eggplant', 'common', '-', 'eggplant'],
  ['Chisel', 'common', '+', 'chisel'],
  ['Scrambler', 'uncommon', '+', 'scrambler'],
  ['Magical Sunglasses', 'uncommon', '+', 'magic-sunglasses'],
  ['Kitty Cape', 'common', '+', 'kitty-cape'],
  ['Surf Board (Red)', 'common', '+', 'surf-board-red'],
  ['Surf Board (Green)', 'uncommon', '+', 'surf-board-green'],
  ['Surf Board (Blue)', 'rare', '+', 'surf-board-blue'],
  ['Ice Skate (Red)', 'common', '+', 'ice-skate-red'],
  ['Ice Skate (Green)', 'uncommon', '+', 'ice-skate-green'],
  ['Ice Skate (Blue)', 'rare', '+', 'ice-skate-blue'],
  ['Ditto Stamp', 'common', '+', 'ditto-stamp'],
  ['Spooky Mask', 'common', '+', 'spooky-mask'],
  ['Thin Brush (Red)', 'common', '+', 'paint-pencil-red'],
  ['Thin Brush (Green)', 'uncommon', '+', 'paint-pencil-green'],
  ['Thin Brush (Blue)', 'rare', '+', 'paint-pencil-blue'],
  ['Wide Brush (Red)', 'common', '+', 'paint-wide-red'],
  ['Wide Brush (Green)', 'uncommon', '+', 'paint-wide-green'],
  ['Wide Brush (Blue)', 'rare', '+', 'paint-wide-blue'],
  ['Paint Roller (Red)', 'common', '+', 'paint-roller-red'],
  ['Paint Roller (Green)', 'uncommon', '+', 'paint-roller-green'],
  ['Paint Roller (Blue)', 'rare', '+', 'paint-roller-blue'],
]) {
  spell(name, flavor, 'item', rarity, `Add ${ITEMS[type].name} to item inventory`, {
    apply: run => run.profile.items.push(type),
  });
}
for (const [name, rarity, type, random] of [
  ['Random Eggplant Evolution', 'uncommon', 'eggplant', true],
  ['Eggplant Evolution', 'common', 'eggplant', false],
  ['Random Sawblade Evolution', 'uncommon', 'saw-blade', true],
  ['Sawblade Evolution', 'common', 'saw-blade', false],
]) {
  const description = `Convert ${random ? 'a random' : 'a selected'} item to ${ITEMS[type].name}`;
  spell(name, '-', 'item', rarity, description, random ? {
    available: run => run.profile.items.some(item => item !== type),
    apply: (run, targets, rng) => {
      const candidates = run.profile.items.map((item, index) => item === type ? null : index).filter(index => index !== null);
      run.profile.items[pick(rng, candidates)] = type;
    },
  } : {
    target: { kind: 'item', options: itemTargets },
    apply: (run, [index]) => { run.profile.items[index] = type; },
  });
}
spell('Random Remove 1', '-', 'item', 'uncommon', 'Randomly remove one item', {
  available: run => run.profile.items.length > 0,
  apply: (run, targets, rng) => run.profile.items.splice(Math.floor(rng() * run.profile.items.length), 1),
});
spell('Random Remove 2', '-', 'item', 'rare', 'Randomly remove two items', {
  available: run => run.profile.items.length > 0,
  apply: (run, targets, rng) => {
    for (let i = 0; i < 2 && run.profile.items.length; i++) {
      run.profile.items.splice(Math.floor(rng() * run.profile.items.length), 1);
    }
  },
});

// --- Bricks ---
spell('Restore 1', '+', 'brick', 'uncommon', 'Restore one brick to green steering, no attributes', {
  target: { kind: 'brick', options: touchedBrickTargets },
  apply: (run, [id]) => restoreBrick(run.profile.bricks[id]),
});
spell('Restore 2', '+', 'brick', 'rare', 'Restore two bricks to green steering, no attributes', {
  target: { kind: 'brick', count: 2, options: touchedBrickTargets },
  apply: (run, ids) => { for (const id of ids) restoreBrick(run.profile.bricks[id]); },
});
spell('Quicker Cooldown', '+', 'brick', 'common', 'Speed up a selected brick cooldown (blue → green → red)', {
  target: { kind: 'brick', options: run => run.profile.bricks.filter(brick => ['slow', 'normal'].includes(brick.kind))
    .map(brick => ({ value: brick.id, label: `${brickPlaceName(brick.id)} · ${brickContentName(brick)}` })) },
  apply: (run, [id]) => {
    const brick = run.profile.bricks[id];
    brick.kind = brick.kind === 'slow' ? 'normal' : 'fast';
  },
});
spell('Slower Cooldown', '-', 'brick', 'common', 'Slow down a selected brick cooldown (red → green → blue)', {
  target: { kind: 'brick', options: run => run.profile.bricks.filter(brick => ['fast', 'normal'].includes(brick.kind))
    .map(brick => ({ value: brick.id, label: `${brickPlaceName(brick.id)} · ${brickContentName(brick)}` })) },
  apply: (run, [id]) => {
    const brick = run.profile.bricks[id];
    brick.kind = brick.kind === 'fast' ? 'normal' : 'slow';
  },
});
spell('Merge', '-', 'brick', 'common', 'Merge two adjacent selected bricks', {
  target: { kind: 'pair', options: run => ungroupedAdjacentPairs(run.profile)
    .map(pair => ({ value: pair, label: pair.map(brickPlaceName).join(' + ') })) },
  apply: (run, [pair]) => run.profile.brickGroups.push({ owner: pair[0], members: [...pair] }),
});
spell('Random Merge', '-', 'brick', 'uncommon', 'Merge two adjacent random bricks', {
  available: run => ungroupedAdjacentPairs(run.profile).length > 0,
  apply: (run, targets, rng) => {
    const pair = pick(rng, ungroupedAdjacentPairs(run.profile));
    run.profile.brickGroups.push({ owner: pair[0], members: [...pair] });
  },
});
spell('Break Up', '+', 'brick', 'uncommon', 'Unmerge a brick group into individual bricks of matching type', {
  target: { kind: 'group', options: run => run.profile.brickGroups
    .map((group, index) => ({ value: index, label: group.members.map(brickPlaceName).join(' + ') })) },
  apply: (run, [index]) => run.profile.brickGroups.splice(index, 1),
});
function brickConversion(name, flavor, rarity, label, assign) {
  spell(name, flavor, 'brick', rarity, `Convert a brick into ${label}`, {
    target: { kind: 'brick', options: brickTargets('B') },
    apply: (run, [id], rng) => assignTypeB(run.profile, id, typeof assign === 'function' ? assign(rng) : assign),
  });
}
brickConversion('Cinder Brick', '-', 'common', 'a Cinder brick', { kind: 'cinder' });
brickConversion('Goal Brick', '-', 'uncommon', 'a soccer Goal', { kind: 'goal' });
brickConversion('Slime (Red) Brick', '-', 'common', 'red Slime (1s stick)', { slimed: true, slimeColor: 'red' });
brickConversion('Slime (Green) Brick', '-', 'uncommon', 'green Slime (3s stick)', { slimed: true, slimeColor: 'green' });
brickConversion('Slime (Blue) Brick', '-', 'rare', 'blue Slime (5s stick)', { slimed: true, slimeColor: 'blue' });
brickConversion('Spring Brick', '-', 'common', 'Springs', { springs: true });
brickConversion('Spikes Brick', '-', 'common', 'Spikes', { spikes: true });
brickConversion('Conveyor Brick', '-', 'common', 'a Conveyor', rng => ({ conveyor: true, conveyorDirection: pick(rng, ['clockwise', 'counterclockwise']) }));
brickConversion('Boost Brick', '+', 'common', 'a Boost brick', { boost: true });
brickConversion('Barrier Brick', '-', 'uncommon', 'a Barrier brick', { barrier: true });
brickConversion('Turret (Fireball) Brick', '+', 'rare', 'a Fireball Turret', { turret: 'fireball' });
brickConversion('Turret (Laser) Brick', '+', 'uncommon', 'a Laser Turret', { turret: 'laser' });
brickConversion('Toggle (2 step) Brick', '-', 'common', 'a Toggle (1 click to enable)', { toggle: 1 });
brickConversion('Toggle (3 step) Brick', '-', 'uncommon', 'a Toggle (2 clicks to enable)', { toggle: 2 });
brickConversion('Toggle (4 step) Brick', '-', 'rare', 'a Toggle (4 clicks to enable)', { toggle: 4 });
brickConversion('Power Brick', '-', 'uncommon', 'a Power brick', { power: true });
const SPAWNER_ITEM_POOL = ['smiley-cookie', 'battery', 'music-box', 'anvil', 'chisel', 'kitty-cape',
  'spooky-mask', 'cat-shield-red', 'ditto-stamp', 'scrambler', 'magic-sunglasses', 'surf-board-red', 'ice-skate-red'];
brickConversion('Spawner Brick - Item', '+', 'uncommon', 'a Spawner of a random item',
  rng => ({ spawner: { kind: 'item', type: pick(rng, SPAWNER_ITEM_POOL) } }));
brickConversion('Spawner Brick - Wood', '+', 'uncommon', 'a Spawner of wood swords', { spawner: { kind: 'weapon', type: 'wood' } });
brickConversion('Spawner Brick - Bronze', '+', 'uncommon', 'a Spawner of a bronze sword or hammer',
  rng => ({ spawner: { kind: 'weapon', type: pick(rng, ['bronze', 'hammer-bronze']) } }));
brickConversion('Spawner Brick - Silver', '+', 'rare', 'a Spawner of a silver sword or hammer',
  rng => ({ spawner: { kind: 'weapon', type: pick(rng, ['silver', 'hammer-silver']) } }));
brickConversion('Spawner Brick - Gold', '+', 'rare', 'a Spawner of a gold sword or hammer',
  rng => ({ spawner: { kind: 'weapon', type: pick(rng, ['gold', 'hammer-gold']) } }));
const HAZARD_POOL = ['laser', 'flame', 'missile', 'bubble-red', 'bubble-green', 'bubble-blue', 'bumper-red', 'bumper-green', 'bumper-blue'];
spell('Hazard Brick', '-', 'brick', 'uncommon', 'Convert a brick into a Hazard (random type and random yellow/black power). If no Power brick exists yet, one random brick also becomes a Power brick.', {
  target: { kind: 'brick', options: brickTargets('B') },
  apply: (run, [id], rng) => {
    assignTypeB(run.profile, id, { hazard: { type: pick(rng, HAZARD_POOL), power: pick(rng, ['yellow', 'black']) } });
    if (!run.profile.bricks.some(brick => brick.power)) {
      const candidates = placementBricks(run.profile, 'B').filter(brick => brick.id !== id);
      if (candidates.length) assignTypeB(run.profile, pick(rng, candidates).id, { power: true });
    }
  },
});
spell('Portal Brick', '-', 'brick', 'rare', 'Convert 2 bricks into a Portal pair of the same color', {
  target: { kind: 'brick', count: 2, options: brickTargets('B') },
  apply: (run, ids, rng) => {
    const used = new Set(run.profile.bricks.map(brick => brick.portal).filter(Boolean));
    const color = Object.keys(PORTALS).find(color => !used.has(color)) ?? pick(rng, Object.keys(PORTALS));
    for (const id of ids) assignTypeB(run.profile, id, { portal: color });
  },
});
spell('Crumbler Brick', '-', 'brick', 'common', 'Convert a brick into a Crumbler (3 selections)', {
  target: { kind: 'brick', options: brickTargets('A') },
  apply: (run, [id]) => assignTypeA(run.profile, id, { crumbler: 3 }),
});
spell('Warped Brick', '-', 'brick', 'common', 'Convert a brick into a Warped brick', {
  target: { kind: 'brick', options: brickTargets('A') },
  apply: (run, [id]) => assignTypeA(run.profile, id, { warped: 10 }),
});

// ---------- Spell selection ----------

const RARITIES = ['common', 'uncommon', 'rare'];

function rollRarity(rng) {
  const roll = rng();
  return roll < .6 ? 'common' : roll < .9 ? 'uncommon' : 'rare';
}

function spellUsable(run, spell) {
  if (spell.available && !spell.available(run)) return false;
  if (spell.target && spell.target.options(run).length < (spell.target.count ?? 1)) return false;
  return true;
}

// A selection is 3 spells of one flavor and rarity, either all brick spells or all
// non-brick spells. Rarity (then flavor) relaxes only when the pool runs dry.
function spellSet(run, rng, { flavor, rarity, domain = 'any', count = 3 }) {
  const matches = (spell, wantedFlavor, wantedRarity) => spell.flavor === wantedFlavor
    && spell.rarity === wantedRarity
    && (domain === 'any' || (domain === 'brick') === (spell.type === 'brick'))
    && spellUsable(run, spell);
  const chosen = [];
  const fallbacks = [[flavor, rarity],
    ...RARITIES.filter(other => other !== rarity).map(other => [flavor, other]),
    ...RARITIES.map(other => [flavor === '+' ? '-' : '+', other])];
  for (const [wantedFlavor, wantedRarity] of fallbacks) {
    for (const spell of shuffled(rng, SPELLS.filter(spell => matches(spell, wantedFlavor, wantedRarity)))) {
      if (chosen.length < count && !chosen.includes(spell)) chosen.push(spell);
    }
    if (chosen.length >= count) break;
  }
  return chosen;
}

function applySpell(run, spell, targets = [], rng = run.rng) {
  spell.apply(run, targets, rng);
}

function arenaRewards(run, rng = run.rng) {
  const mixedFlavor = rng() < .5 ? '+' : '-';
  const mixedDomain = rng() < .25 ? 'brick' : 'other';
  return [
    { title: 'Pawful brick magic — pick one', set: spellSet(run, rng, { flavor: '-', rarity: rollRarity(rng), domain: 'brick' }) },
    { title: `${mixedFlavor === '+' ? 'Pawsitive' : 'Pawful'} magic — pick one`,
      set: spellSet(run, rng, { flavor: mixedFlavor, rarity: rollRarity(rng), domain: mixedDomain }) },
  ];
}

function shopStock(run, rng = run.rng) {
  const stock = [];
  for (const [rarity, count, min, max] of [['rare', 1, 150, 200], ['uncommon', 3, 80, 120], ['common', 5, 40, 70]]) {
    for (const spell of spellSet(run, rng, { flavor: '+', rarity, domain: 'any', count })) {
      stock.push({ spell, price: rollInt(rng, min, max), sold: false });
    }
  }
  return stock;
}

// ---------- Acts and events ----------

const ACT_COUNT = 3;
const ACT_STEPS = 6;
const ARENA_DURATION = 120;
const ENEMY_POOLS = [
  ['mouse', 'ball', 'bucket', 'wheel'],
  ['mouse', 'ball', 'bucket', 'wheel', 'ram', 'jackolantern', 'snake', 'goalie', 'striker', 'robo-snail'],
  ['mouse', 'ball', 'bucket', 'wheel', 'ram', 'jackolantern', 'snake', 'goalie', 'striker', 'robo-snail',
    'robo-fly', 'robo-cow', 'robo-unicorn', 'robo-crab', 'robo-love-bug', 'robo-trash-bin', 'robo-moon',
    'robo-sharpshooter', 'robo-cat-lady', 'robo-koshi'],
];
const EDGE_START_ENEMIES = ['wheel', 'snake', 'robo-cow'];

function rollObjective(rng) {
  const roll = rng();
  return roll < .6 ? 'enemy' : roll < .9 ? 'food' : 'soccer';
}

function rollArena(rng, act, step) {
  const pool = ENEMY_POOLS[act];
  const count = Math.min(8, 3 + act + Math.floor(step / 2));
  const enemies = Array.from({ length: count }, () => pick(rng, pool));
  return { enemies, objective: rollObjective(rng), act, step };
}

function rollEventOption(rng, act, step, existing) {
  if (step === 0) return { type: 'arena', ...rollArena(rng, act, step) };
  const roll = rng();
  let type = roll < .55 ? 'arena' : roll < .7 ? 'shop' : roll < .85 ? 'catBed' : 'catToy';
  // Two identical non-arena choices would make the step pointless.
  if (type !== 'arena' && existing.some(option => option.type === type)) type = 'arena';
  return type === 'arena' ? { type, ...rollArena(rng, act, step) } : { type, act, step };
}

function generateActs(rng) {
  return Array.from({ length: ACT_COUNT }, (_, act) => ({
    steps: Array.from({ length: ACT_STEPS }, (_, step) => {
      const options = [];
      for (let i = 0; i < 2; i++) options.push(rollEventOption(rng, act, step, options));
      return options;
    }),
    boss: { type: 'boss', act },
  }));
}

// ---------- Level generation ----------

function scheduleCycle(rng, length, firstOrder, startTime, interval, duration, make) {
  const events = [];
  if (!length) return events;
  const indices = Array.from({ length }, (_, index) => index);
  let order = firstOrder ?? shuffled(rng, indices);
  let position = 0;
  for (let time = startTime; time < duration - 5; time += interval) {
    if (position >= order.length) {
      order = shuffled(rng, indices);
      position = 0;
    }
    events.push(make(order[position++], time));
  }
  return events;
}

// A psychic power lets the player fix the first spawns; the rest of the first
// cycle is shuffled behind them.
function psychicOrder(rng, length, picks) {
  if (!picks?.length) return null;
  const rest = shuffled(rng, Array.from({ length }, (_, index) => index).filter(index => !picks.includes(index)));
  return [...picks, ...rest];
}

function scheduleEvents(run, rng, duration, { weaponPicks = null, itemPicks = null } = {}) {
  const profile = run.profile, attributes = profile.attributes;
  const events = [];
  const foodTypes = Object.keys(FOODS);
  for (let time = 2; time < duration - 5; time += 3) {
    events.push({ time, kind: 'food', type: pick(rng, foodTypes), random: true, lifetime: 9 });
  }
  events.push(...scheduleCycle(rng, profile.weapons.length, psychicOrder(rng, profile.weapons.length, weaponPicks),
    1, attributes.weaponInterval, duration,
    (index, time) => ({ time, kind: 'weapon', type: weaponSpawnType(profile.weapons[index]), random: true, lifetime: 15 })));
  events.push(...scheduleCycle(rng, profile.items.length, psychicOrder(rng, profile.items.length, itemPicks),
    attributes.itemInterval / 2, attributes.itemInterval, duration,
    (index, time) => ({ time, kind: 'item', type: profile.items[index], random: true, lifetime: 15 })));
  events.push(...scheduleCycle(rng, profile.balls.length, null, 4, attributes.ballInterval, duration,
    (index, time) => ({ time, kind: 'object', type: profile.balls[index], random: true })));
  return events;
}

function enemyEvent(rng, type, time) {
  if (EDGE_START_ENEMIES.includes(type)) {
    return rng() < .5 ? { time, kind: 'enemy', type, x: rng() < .5 ? 0 : 1, y: rng() }
      : { time, kind: 'enemy', type, x: rng(), y: rng() < .5 ? 0 : 1 };
  }
  return { time, kind: 'enemy', type, random: true };
}

function buildArenaLevel(run, arena, { weaponPicks = null, itemPicks = null } = {}, rng = run.rng) {
  const duration = ARENA_DURATION;
  const events = scheduleEvents(run, rng, duration, { weaponPicks, itemPicks });
  arena.enemies.forEach((type, index) => {
    events.push(enemyEvent(rng, type, 4 + index * (duration * .6 / arena.enemies.length)));
  });
  const level = {
    version: 1, id: `Roguelike ${arena.act + 1}-${arena.step + 1}`, duration,
    goal: 0, heartCost: null, brickSet: 1, events,
    koshiStart: { x: .5, y: .5 },
    brickTypes: brickTypesFor(run.profile),
  };
  if (run.profile.brickGroups.length) {
    level.brickGroups = run.profile.brickGroups.map(group => ({ owner: group.owner, members: [...group.members] }));
  }
  const objective = arena.objective === 'soccer' && !run.profile.balls.length ? 'enemy' : arena.objective;
  if (objective === 'enemy') level.killGoal = Math.max(1, Math.ceil(arena.enemies.length * .7));
  else if (objective === 'food') level.goal = 40 + arena.act * 15;
  else level.goalsGoal = arena.act === 0 ? 1 : 2;
  return level;
}

const BOSS_LEVEL_NAME = 'Tom the Toaster';

function buildBossLevel(run, official, { weaponPicks = null, itemPicks = null } = {}, rng = run.rng) {
  const duration = 150;
  const events = [{ time: 0, kind: 'enemy', type: 'boss', x: .5, y: .5 }];
  events.push(...scheduleEvents(run, rng, duration, { weaponPicks, itemPicks }));
  return {
    version: 1, id: `Roguelike Boss ${run.actIndex + 1}`, duration,
    goal: 0, killGoal: 0, heartCost: 15, brickSet: 1, bossLevel: true, events,
    koshiStart: official?.koshiStart ? { ...official.koshiStart } : { x: .5, y: .88 },
    brickTypes: official?.brickTypes ? JSON.parse(JSON.stringify(official.brickTypes)) : [],
    ...(official?.brickGroups ? { brickGroups: JSON.parse(JSON.stringify(official.brickGroups)) } : {}),
  };
}

// ---------- Runs ----------

function createRun(seed) {
  seed = String(seed ?? randomSeed()).trim() || randomSeed();
  return {
    seed,
    rng: createRng(`${seed}:run`),
    acts: generateActs(createRng(`${seed}:acts`)),
    actIndex: 0,
    stepIndex: 0,
    gold: 0,
    profile: initialProfile(),
    over: false,
    victory: false,
    log: [],
  };
}

function goldFor(result) {
  return (result.food ?? 0) + 10 * (result.enemy ?? 0) + 25 * (result.goals ?? 0);
}

function currentOptions(run) {
  const act = run.acts[run.actIndex];
  return run.stepIndex < act.steps.length ? act.steps[run.stepIndex] : [act.boss];
}

function levelSetup(run) {
  const { attributes, powers } = run.profile;
  return {
    hearts: Math.max(1, Math.min(attributes.maxHearts, attributes.hearts)),
    shield: powers.startShield,
    modifiers: {
      maxHearts: attributes.maxHearts,
      goalBonus: powers.goalBonus,
      bubbleImmunity: powers.bubbleImmunity,
      slimeImmunity: powers.slimeImmunity,
      crumblerImmunity: powers.crumblerImmunity,
      spikeImmunity: powers.spikeImmunity,
    },
  };
}

// Entry rules: a soccer objective needs a goal brick, and Love Bugs need a barrier
// brick, so matching conversion spells are forced before the arena starts.
function forcedSpells(run, arena) {
  const forced = [];
  const objective = arena.objective === 'soccer' && !run.profile.balls.length ? 'enemy' : arena.objective;
  if (objective === 'soccer' && !run.profile.bricks.some(brick => brick.kind === 'goal')) {
    forced.push(SPELLS.find(spell => spell.name === 'Goal Brick'));
  }
  if (arena.enemies?.includes('robo-love-bug') && !run.profile.bricks.some(brick => brick.barrier)) {
    forced.push(SPELLS.find(spell => spell.name === 'Barrier Brick'));
  }
  return forced;
}

// ---------- UI controller ----------

const EVENT_LABELS = {
  arena: 'Arena', shop: 'Shop', catBed: 'Cat Bed', catToy: 'Cat Toy', boss: 'Boss Battle',
};
const OBJECTIVE_LABELS = { enemy: 'Defeat enemies', food: 'Collect food points', soccer: 'Score soccer goals' };
const BRICK_COLORS = { normal: '#83bca1', slow: '#7eacdb', fast: '#df8c81', cinder: '#969b99', goal: '#4d9475' };

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

class RoguelikeController {
  constructor({ dialog, playLevel, onExit, officialLevel }) {
    this.dialog = dialog;
    this.playLevel = playLevel;
    this.onExit = onExit;
    this.officialLevel = officialLevel;
    this.run = null;
    this.view = 'home';
    this.currentEvent = null;
    this.pendingSpell = null;
    this.queue = [];
    this.afterQueue = null;
    this.lastResult = null;
    this.weaponPicks = [];
    this.itemPicks = [];
    this.root = el('div', 'roguelike-root');
    dialog.append(this.root);
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      this.exit();
    });
  }

  get active() {
    return Boolean(this.run && !this.run.over);
  }

  open() {
    if (!this.dialog.open) this.dialog.showModal();
    this.render();
  }

  exit() {
    if (this.dialog.open) this.dialog.close();
    this.onExit();
  }

  log(message) {
    if (this.run) this.run.log.unshift(message);
  }

  render() {
    this.root.replaceChildren();
    const render = {
      home: () => this.renderHome(),
      map: () => this.renderMap(),
      arenaEntry: () => this.renderArenaEntry(),
      shop: () => this.renderShop(),
      catBed: () => this.renderCatBed(),
      catToy: () => this.renderCatToy(),
      spellPick: () => this.renderSpellPick(),
      target: () => this.renderTarget(),
      levelResult: () => this.renderLevelResult(),
      runOver: () => this.renderRunOver(),
    }[this.view];
    render();
  }

  button(label, className, onClick) {
    const button = el('button', className, label);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }

  heading(title, subtitle = '') {
    const header = el('header', 'roguelike-header');
    header.append(el('h2', '', title));
    if (subtitle) header.append(el('p', 'roguelike-subtitle', subtitle));
    return header;
  }

  statusBar() {
    const run = this.run;
    const bar = el('div', 'roguelike-status');
    const { attributes } = run.profile;
    bar.append(
      el('span', '', `Act ${run.actIndex + 1} of ${ACT_COUNT}`),
      el('span', '', `${'♥'.repeat(attributes.hearts)}${'♡'.repeat(Math.max(0, attributes.maxHearts - attributes.hearts))}`),
      el('span', '', `${run.gold} gold`),
      el('span', 'roguelike-seed', `Seed: ${run.seed}`),
    );
    return bar;
  }

  // --- Home ---
  renderHome() {
    this.root.append(this.heading("Roguelike Mode (prototype)",
      'Survive three acts of randomized arenas, shops, cat beds and cat toys, defeating the boss at the end of each act. '
      + 'Spells gained along the way reshape your bricks, weapons, items, soccer balls and powers. No save slot needed — a run lives until you close the page.'));
    if (this.active) {
      this.root.append(this.button('Continue run →', 'primary', () => { this.view = 'map'; this.render(); }));
    }
    const form = el('div', 'roguelike-seed-form');
    const label = el('label', '', 'Seed ');
    const input = el('input');
    input.type = 'text';
    input.value = randomSeed();
    input.maxLength = 40;
    label.append(input);
    form.append(label, this.button(this.active ? 'Abandon and start new run' : 'Start run →', this.active ? 'title-secondary' : 'primary', () => {
      this.startRun(input.value);
    }));
    this.root.append(form);
    this.root.append(this.button('Back to title', 'title-secondary', () => this.exit()));
  }

  startRun(seed) {
    this.run = createRun(seed);
    this.currentEvent = null;
    this.queue = [];
    this.pendingSpell = null;
    this.view = 'map';
    this.render();
  }

  // --- Map ---
  renderMap() {
    const run = this.run;
    this.root.append(this.heading(`Act ${run.actIndex + 1}`,
      run.stepIndex < ACT_STEPS ? `Event ${run.stepIndex + 1} of ${ACT_STEPS} — choose your path` : 'The act boss awaits!'));
    this.root.append(this.statusBar());
    const options = el('div', 'roguelike-options');
    for (const option of currentOptions(run)) {
      const card = this.button('', 'roguelike-option', () => this.chooseOption(option));
      card.append(el('strong', '', EVENT_LABELS[option.type]));
      if (option.type === 'arena') {
        card.append(el('span', '', OBJECTIVE_LABELS[option.objective]));
        card.append(el('span', 'roguelike-muted', option.enemies.map(type => CHARACTERS[type] ?? type).join(', ')));
      } else if (option.type === 'boss') {
        card.append(el('span', '', 'Tom the Toaster'));
      } else {
        card.append(el('span', 'roguelike-muted', {
          shop: 'Spend gold on pawsitive spells.',
          catBed: 'Rest to heal, or smith a weapon (+2 strikes).',
          catToy: 'A treasure: one pawsitive rare spell.',
        }[option.type]));
      }
      options.append(card);
    }
    this.root.append(options);
    if (run.log.length) {
      const log = el('p', 'roguelike-log', run.log[0]);
      this.root.append(log);
    }
    this.root.append(this.renderProfile());
    const actions = el('div', 'roguelike-actions');
    actions.append(
      this.button('Back to title', 'title-secondary', () => this.exit()),
      this.button('Abandon run', 'title-secondary', () => {
        this.run = null;
        this.view = 'home';
        this.render();
      }),
    );
    this.root.append(actions);
  }

  renderProfile(targetMode = null) {
    const run = this.run;
    const panel = el('section', 'roguelike-profile');
    const { weapons, items, balls, powers, attributes } = run.profile;
    const column = (title, lines) => {
      const box = el('div', 'roguelike-profile-box');
      box.append(el('h3', '', title));
      const list = el('ul');
      for (const line of lines.length ? lines : ['—']) {
        const item = el('li');
        if (typeof line === 'string') item.textContent = line;
        else item.append(line);
        list.append(item);
      }
      box.append(list);
      return box;
    };
    const powerLines = [];
    if (powers.weaponPsychic) powerLines.push(`Weapon Psychic ${powers.weaponPsychic}`);
    if (powers.itemPsychic) powerLines.push(`Item Psychic ${powers.itemPsychic}`);
    for (const [key, label] of [['bubbleImmunity', 'Bubble Immunity'], ['slimeImmunity', 'Slime Immunity'],
      ['crumblerImmunity', 'Crumbler Immunity'], ['spikeImmunity', 'Spike Immunity']]) {
      if (powers[key]) powerLines.push(label);
    }
    if (powers.goalBonus) powerLines.push(`Power Shot ×${powers.goalBonus}`);
    if (powers.startShield) powerLines.push(`${powers.startShield === 'green' ? 'Green' : 'Red'} starting shield`);
    panel.append(
      column(`Weapons (every ${attributes.weaponInterval}s)`, weapons.map(weaponName)),
      column(`Items (every ${attributes.itemInterval}s)`, items.map(type => ITEMS[type].name)),
      column(`Soccer balls (every ${attributes.ballInterval}s)`, balls.map(type => OBJECTS[type].name)),
      column('Powers', powerLines),
    );
    panel.append(this.renderBoard(targetMode));
    return panel;
  }

  // The ring preview uses the portrait layout: 5 bricks across the ends, 8 along the sides.
  renderBoard(targetMode = null) {
    const run = this.run;
    const board = el('div', 'roguelike-board');
    const eligible = targetMode ? new Set(targetMode.options.map(option => option.value)) : null;
    for (const brick of run.profile.bricks) {
      const slot = brickSlot(brick.id);
      const cell = targetMode ? this.button('', 'roguelike-brick', () => targetMode.choose(brick.id)) : el('span', 'roguelike-brick');
      cell.style.gridArea = slot.edge === 'top' ? `1 / ${slot.index + 2}`
        : slot.edge === 'bottom' ? `10 / ${slot.index + 2}`
          : slot.edge === 'left' ? `${slot.index + 2} / 1` : `${slot.index + 2} / 7`;
      cell.style.background = BRICK_COLORS[brick.kind];
      const group = run.profile.brickGroups.findIndex(group => group.members.includes(brick.id));
      let marker = '';
      if (brick.crumbler !== null) marker += '◍';
      if (brick.warped !== null) marker += '✦';
      if (brick.toggle !== null) marker += '◐';
      if (brick.power) marker += '⚡';
      if (brick.slimed) marker += '~';
      if (brick.springs) marker += '∿';
      if (brick.spikes) marker += '▲';
      if (brick.conveyor) marker += '≫';
      if (brick.boost) marker += '»';
      if (brick.barrier) marker += '▦';
      if (brick.portal !== null) marker += '◎';
      if (brick.turret !== null) marker += '✇';
      if (brick.hazard !== null) marker += '☄';
      if (brick.spawner !== null) marker += '✱';
      cell.textContent = marker;
      cell.title = `${brickPlaceName(brick.id)} · ${brickContentName(brick)}${group >= 0 ? ' · merged' : ''}`;
      if (group >= 0) cell.classList.add('roguelike-brick-merged');
      if (targetMode) {
        cell.disabled = !eligible.has(brick.id) || targetMode.picked.includes(brick.id);
        cell.classList.toggle('roguelike-brick-eligible', !cell.disabled);
      }
      board.append(cell);
    }
    return board;
  }

  // --- Event selection ---
  chooseOption(option) {
    this.currentEvent = option;
    if (option.type === 'arena' || option.type === 'boss') {
      this.weaponPicks = [];
      this.itemPicks = [];
      this.view = 'arenaEntry';
    } else if (option.type === 'shop') {
      option.stock ??= shopStock(this.run);
      this.view = 'shop';
    } else if (option.type === 'catBed') {
      this.view = 'catBed';
    } else {
      this.view = 'catToy';
    }
    this.render();
  }

  advance() {
    const run = this.run;
    this.currentEvent = null;
    if (run.stepIndex < ACT_STEPS) run.stepIndex++;
    this.view = 'map';
    this.render();
  }

  // --- Arena entry ---
  renderArenaEntry() {
    const run = this.run, event = this.currentEvent;
    const boss = event.type === 'boss';
    this.root.append(this.heading(boss ? 'Boss Battle — Tom the Toaster' : `Arena ${event.act + 1}-${event.step + 1}`,
      boss ? 'Defeat Tom the Toaster in his own arena to finish the act.' : OBJECTIVE_LABELS[event.objective]));
    this.root.append(this.statusBar());
    if (!boss) {
      const list = el('p', '', `Enemies: ${event.enemies.map(type => CHARACTERS[type] ?? type).join(', ')}`);
      this.root.append(list);
      const forced = forcedSpells(run, event);
      if (forced.length) {
        this.root.append(el('p', 'roguelike-forced',
          `Entry requirement: ${forced.map(spell => spell.name).join(' and ')} must be played before this battle.`));
      }
    }
    for (const [power, picks, list, label] of [
      ['weaponPsychic', this.weaponPicks, run.profile.weapons.map(weaponName), 'weapons'],
      ['itemPsychic', this.itemPicks, run.profile.items.map(type => ITEMS[type].name), 'items'],
    ]) {
      const allowed = run.profile.powers[power];
      if (!allowed || list.length < 2) continue;
      const section = el('div', 'roguelike-psychic');
      section.append(el('p', '', `Psychic: pick up to ${allowed} ${label} to spawn first (in order).`));
      list.forEach((name, index) => {
        const chip = this.button(name, 'roguelike-chip', () => {
          const at = picks.indexOf(index);
          if (at >= 0) picks.splice(at, 1);
          else if (picks.length < allowed) picks.push(index);
          this.render();
        });
        const order = picks.indexOf(index);
        if (order >= 0) chip.textContent = `${order + 1}. ${name}`;
        chip.classList.toggle('roguelike-chip-active', order >= 0);
        section.append(chip);
      });
      this.root.append(section);
    }
    this.root.append(this.renderProfile());
    const actions = el('div', 'roguelike-actions');
    actions.append(
      this.button('Enter battle →', 'primary', () => this.enterBattle()),
      this.button('Back', 'title-secondary', () => { this.currentEvent = null; this.view = 'map'; this.render(); }),
    );
    this.root.append(actions);
  }

  enterBattle() {
    const event = this.currentEvent;
    const pending = event.type === 'arena' ? forcedSpells(this.run, event) : [];
    this.queue = pending.map(spell => ({ kind: 'forced', spell }));
    this.afterQueue = () => this.launchLevel();
    this.processQueue();
  }

  launchLevel() {
    const run = this.run, event = this.currentEvent;
    const picks = { weaponPicks: this.weaponPicks, itemPicks: this.itemPicks };
    let definition;
    try {
      definition = event.type === 'boss'
        ? buildBossLevel(run, this.officialLevel(BOSS_LEVEL_NAME), picks)
        : buildArenaLevel(run, event, picks);
      validateCustomLevel(definition);
    } catch (error) {
      console.error('Roguelike level could not be generated:', error);
      this.log(`The battle could not be prepared: ${error.message}`);
      this.view = 'map';
      this.render();
      return;
    }
    if (this.dialog.open) this.dialog.close();
    this.playLevel(definition, levelSetup(run));
  }

  // --- Level results ---
  onLevelEnd(game) {
    if (!this.run || this.run.over) return;
    const run = this.run;
    if (game.state !== 'won') {
      run.over = true;
      run.victory = false;
      this.view = 'runOver';
      this.open();
      return;
    }
    run.profile.attributes.hearts = Math.max(1, Math.min(run.profile.attributes.maxHearts, game.hearts));
    const result = { food: game.score, enemy: game.enemies, goals: game.goals ?? 0 };
    result.gold = goldFor(result);
    run.gold += result.gold;
    this.lastResult = result;
    const boss = this.currentEvent?.type === 'boss';
    if (boss && run.actIndex === ACT_COUNT - 1) {
      run.over = true;
      run.victory = true;
      this.view = 'runOver';
      this.open();
      return;
    }
    this.queue = arenaRewards(run).map(reward => ({ kind: 'spellPick', ...reward }));
    this.afterQueue = () => {
      if (boss) {
        run.actIndex++;
        run.stepIndex = 0;
        this.currentEvent = null;
        this.view = 'map';
        this.render();
      } else this.advance();
    };
    this.view = 'levelResult';
    this.open();
  }

  onLevelAbandoned() {
    if (!this.run || this.run.over) {
      this.open();
      return;
    }
    this.run.over = true;
    this.run.victory = false;
    this.view = 'runOver';
    this.open();
  }

  renderLevelResult() {
    const result = this.lastResult;
    this.root.append(this.heading('Victory!', 'The arena is cleared. Claim your spoils.'));
    this.root.append(this.statusBar());
    const table = el('p', 'roguelike-result',
      `Food ${result.food} + 10 × Enemy ${result.enemy} + 25 × Goals ${result.goals} = ${result.gold} gold`);
    this.root.append(table);
    this.root.append(this.button('Choose spells →', 'primary', () => this.processQueue()));
  }

  // --- Spell queue ---
  processQueue() {
    const next = this.queue.shift();
    if (!next) {
      const done = this.afterQueue;
      this.afterQueue = null;
      if (done) done();
      else {
        this.view = 'map';
        this.render();
      }
      return;
    }
    if (next.kind === 'forced') {
      this.startSpell(next.spell, true);
      return;
    }
    this.currentPick = next;
    this.view = 'spellPick';
    this.render();
  }

  renderSpellPick() {
    const pickSet = this.currentPick;
    this.root.append(this.heading(pickSet.title, 'A spell must always be picked — choose wisely.'));
    this.root.append(this.statusBar());
    const cards = el('div', 'roguelike-options');
    for (const choice of pickSet.set) {
      const card = this.button('', 'roguelike-option', () => this.startSpell(choice, false));
      card.append(el('strong', '', choice.name));
      card.append(el('span', `roguelike-flavor roguelike-flavor-${choice.flavor === '+' ? 'pawsitive' : 'pawful'}`,
        `${choice.flavor === '+' ? 'Pawsitive' : 'Pawful'} · ${choice.rarity} · ${choice.type}`));
      card.append(el('span', 'roguelike-muted', choice.description));
      cards.append(card);
    }
    if (!pickSet.set.length) {
      cards.append(el('p', '', 'No spells could be offered.'));
      this.root.append(cards, this.button('Continue →', 'primary', () => this.processQueue()));
      return;
    }
    this.root.append(cards);
    this.root.append(this.renderProfile());
  }

  startSpell(spell, forced, onDone = null) {
    const finish = onDone ?? (() => this.processQueue());
    if (!spell.target) {
      applySpell(this.run, spell);
      this.log(`${spell.name}: ${spell.description}`);
      finish();
      this.render();
      return;
    }
    this.pendingSpell = { spell, forced, picks: [], finish };
    this.view = 'target';
    this.render();
  }

  renderTarget() {
    const pending = this.pendingSpell;
    const { spell } = pending;
    const count = spell.target.count ?? 1;
    this.root.append(this.heading(spell.name, `${spell.description}. Choose ${count > 1 ? `${count} targets` : 'a target'}.`));
    this.root.append(this.statusBar());
    const options = spell.target.options(this.run)
      .filter(option => !pending.picks.some(picked => JSON.stringify(picked) === JSON.stringify(option.value)));
    const choose = value => {
      pending.picks.push(value);
      if (pending.picks.length >= count) {
        applySpell(this.run, spell, pending.picks);
        this.log(`${spell.name}: ${spell.description}`);
        this.pendingSpell = null;
        pending.finish();
        this.render();
      } else this.render();
    };
    if (spell.target.kind === 'brick') {
      this.root.append(this.renderBoard({ options, picked: pending.picks, choose }));
      this.root.append(el('p', 'roguelike-muted', 'Pick a highlighted brick on the board above.'));
    } else {
      const list = el('div', 'roguelike-target-list');
      for (const option of options) list.append(this.button(option.label, 'roguelike-chip', () => choose(option.value)));
      this.root.append(list);
    }
  }

  // --- Shop ---
  renderShop() {
    const run = this.run, event = this.currentEvent;
    this.root.append(this.heading('Shop', 'Food, enemy and soccer points from arenas become gold: food + 10 × enemy + 25 × goals.'));
    this.root.append(this.statusBar());
    const cards = el('div', 'roguelike-options');
    for (const entry of event.stock) {
      const card = this.button('', 'roguelike-option', () => {
        if (entry.sold || run.gold < entry.price || !spellUsable(run, entry.spell)) return;
        run.gold -= entry.price;
        entry.sold = true;
        this.startSpell(entry.spell, false, () => { this.view = 'shop'; });
      });
      card.append(el('strong', '', `${entry.spell.name} — ${entry.price} gold`));
      card.append(el('span', 'roguelike-flavor roguelike-flavor-pawsitive', `Pawsitive · ${entry.spell.rarity} · ${entry.spell.type}`));
      card.append(el('span', 'roguelike-muted', entry.spell.description));
      if (entry.sold) {
        card.disabled = true;
        card.classList.add('roguelike-sold');
      } else if (run.gold < entry.price || !spellUsable(run, entry.spell)) card.disabled = true;
      cards.append(card);
    }
    this.root.append(cards);
    this.root.append(this.renderProfile());
    this.root.append(this.button('Leave shop →', 'primary', () => this.advance()));
  }

  // --- Cat Bed ---
  renderCatBed() {
    const run = this.run;
    const { attributes } = run.profile;
    this.root.append(this.heading('Cat Bed', 'A cozy rest spot. Pick one.'));
    this.root.append(this.statusBar());
    const cards = el('div', 'roguelike-options');
    const heal = this.button('', 'roguelike-option', () => {
      attributes.hearts = attributes.maxHearts;
      this.log('Cat Bed: Koshi napped back to full health.');
      this.advance();
    });
    heal.append(el('strong', '', 'Heal'), el('span', 'roguelike-muted', 'Recover to full health.'));
    if (attributes.hearts >= attributes.maxHearts) heal.disabled = true;
    const smith = this.button('', 'roguelike-option', () => {
      const targets = weaponTargets(run);
      if (!targets.length) return;
      this.startSpell({
        name: 'Smith', description: '+2 strikes to a selected weapon',
        target: { kind: 'weapon', options: weaponTargets },
        apply: (current, [index]) => adjustStrikes(current.profile.weapons[index], 2),
      }, false, () => this.advance());
    });
    smith.append(el('strong', '', 'Smith'), el('span', 'roguelike-muted', 'Add +2 strikes to any weapon in your weapon list.'));
    if (!run.profile.weapons.length) smith.disabled = true;
    cards.append(heal, smith);
    this.root.append(cards);
    this.root.append(this.renderProfile());
  }

  // --- Cat Toy ---
  renderCatToy() {
    const run = this.run, event = this.currentEvent;
    event.spell ??= spellSet(run, run.rng, { flavor: '+', rarity: 'rare', domain: 'any', count: 1 })[0] ?? null;
    this.root.append(this.heading('Cat Toy', 'Something precious rattles inside this toy!'));
    this.root.append(this.statusBar());
    if (!event.spell) {
      this.root.append(el('p', '', 'The toy was empty. How disappawnting.'));
      this.root.append(this.button('Continue →', 'primary', () => this.advance()));
      return;
    }
    const card = el('div', 'roguelike-option roguelike-option-static');
    card.append(el('strong', '', event.spell.name));
    card.append(el('span', 'roguelike-flavor roguelike-flavor-pawsitive', `Pawsitive · rare · ${event.spell.type}`));
    card.append(el('span', 'roguelike-muted', event.spell.description));
    this.root.append(card);
    this.root.append(this.button('Open it →', 'primary', () => {
      this.startSpell(event.spell, true, () => this.advance());
    }));
  }

  // --- Run over ---
  renderRunOver() {
    const run = this.run;
    this.root.append(this.heading(run.victory ? 'Victory! The run is complete!' : 'The run is over',
      run.victory ? 'Koshi conquered all three acts. Brute kitty force prevails!' : 'Koshi was defeated. Every run teaches a new trick.'));
    this.root.append(el('p', '', `Seed: ${run.seed} — reuse it to replay this exact run.`));
    this.root.append(el('p', 'roguelike-muted', `Reached act ${run.actIndex + 1}, event ${Math.min(run.stepIndex + 1, ACT_STEPS + 1)} · ${run.gold} gold on hand.`));
    const actions = el('div', 'roguelike-actions');
    actions.append(
      this.button('Retry this seed →', 'primary', () => this.startRun(run.seed)),
      this.button('New run', 'title-secondary', () => { this.run = null; this.view = 'home'; this.render(); }),
      this.button('Back to title', 'title-secondary', () => { this.run = null; this.view = 'home'; this.exit(); }),
    );
    this.root.append(actions);
  }
}

// ---------- Exports ----------

const api = {
  createRng, randomSeed, brickSlot, emptyBrick, hasTypeA, hasTypeB, placementBricks,
  brickTypesFor, ungroupedAdjacentPairs, PERIMETER, BRICK_COUNT,
  WEAPON_TIERS, weaponSpawnType, weaponName, addWeapon, adjustStrikes,
  initialProfile, SPELLS, spellUsable, spellSet, applySpell, rollRarity,
  arenaRewards, shopStock, generateActs, rollArena, buildArenaLevel, buildBossLevel,
  createRun, goldFor, currentOptions, levelSetup, forcedSpells,
  ACT_COUNT, ACT_STEPS, BOSS_LEVEL_NAME, RoguelikeController,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.KoshiRoguelike = api;
})();
