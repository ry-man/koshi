const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, validateCustomLevel, WEAPONS } = require('../src/game.js');
const { OFFICIAL_LEVEL_DATA } = require('../src/campaign.js');
const roguelike = require('../src/roguelike.js');

const aim = (game, brick) => game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2);

test('runs are generated deterministically from their seed', () => {
  const first = roguelike.createRun('PAWS1234');
  const second = roguelike.createRun('PAWS1234');
  const third = roguelike.createRun('OTHERSEED');
  assert.deepEqual(first.acts, second.acts);
  assert.notDeepEqual(first.acts, third.acts);
  const arena = first.acts[0].steps[0][0];
  assert.deepEqual(
    roguelike.buildArenaLevel(first, arena, {}, roguelike.createRng('level')),
    roguelike.buildArenaLevel(second, second.acts[0].steps[0][0], {}, roguelike.createRng('level')),
  );
});

test('acts follow the outline: three acts of events ending in a boss, no survive objectives', () => {
  for (const seed of ['A', 'B', 'C', 'D', 'E']) {
    const acts = roguelike.generateActs(roguelike.createRng(seed));
    assert.equal(acts.length, roguelike.ACT_COUNT);
    for (const act of acts) {
      assert.equal(act.steps.length, roguelike.ACT_STEPS);
      assert.equal(act.boss.type, 'boss');
      for (const options of act.steps) {
        assert.ok(options.length >= 1 && options.length <= 2);
        for (const option of options) {
          assert.ok(['arena', 'shop', 'catBed', 'catToy'].includes(option.type));
          if (option.type === 'arena') {
            assert.ok(['enemy', 'food', 'soccer'].includes(option.objective));
            assert.ok(option.enemies.length > 0);
          }
        }
      }
      // Both options of one step never duplicate the same non-arena event.
      for (const options of act.steps.filter(options => options.length === 2)) {
        if (options[0].type !== 'arena') assert.notEqual(options[0].type, options[1].type);
      }
    }
  }
});

test('generated arena levels pass custom level validation across seeds, acts and evolving profiles', () => {
  for (const seed of ['one', 'two', 'three']) {
    const run = roguelike.createRun(seed);
    // Mutate the profile through a sample of every spell that needs no target.
    for (const spell of roguelike.SPELLS.filter(spell => !spell.target)) {
      if (roguelike.spellUsable(run, spell)) roguelike.applySpell(run, spell);
    }
    for (const [actIndex, act] of run.acts.entries()) {
      run.actIndex = actIndex;
      for (const options of act.steps) {
        for (const arena of options.filter(option => option.type === 'arena')) {
          for (const forced of roguelike.forcedSpells(run, arena)) {
            const target = forced.target.options(run)[0];
            roguelike.applySpell(run, forced, [target.value]);
          }
          const level = roguelike.buildArenaLevel(run, arena);
          const validated = validateCustomLevel(level);
          assert.ok(validated.goal > 0 || validated.killGoal > 0 || validated.goalsGoal > 0);
          assert.ok(!validated.survive);
        }
      }
    }
  }
});

test('profile brick IDs map onto the engine board bricks through generated brick types', () => {
  const run = roguelike.createRun('bricks');
  run.profile.bricks[0].spikes = true;
  run.profile.bricks[9].springs = true;
  run.profile.bricks[10].kind = 'goal';
  run.profile.bricks[25].crumbler = 4;
  run.profile.bricks[14].kind = 'fast';
  run.profile.brickGroups.push({ owner: roguelike.PERIMETER[0], members: [roguelike.PERIMETER[0], roguelike.PERIMETER[1]] });
  const arena = run.acts[0].steps[0][0];
  arena.objective = 'enemy';
  const game = new Game(() => .5, { customLevel: roguelike.buildArenaLevel(run, arena) });
  assert.equal(game.bricks[0].spikes, true);
  assert.equal(game.bricks[9].springs, true);
  assert.equal(game.bricks[10].kind, 'goal');
  assert.equal(game.bricks[25].crumbler, 4);
  assert.equal(game.bricks[14].kind, 'fast');
  // Every other brick is the profile default normal brick, replacing engine defaults.
  for (const brick of game.bricks.filter(brick => ![0, 9, 10, 14, 25].includes(brick.id))) {
    assert.equal(brick.kind, 'normal', `brick ${brick.id}`);
  }
  assert.equal(game.bricks[roguelike.PERIMETER[1]].absorbedBy, roguelike.PERIMETER[0]);
});

test('boss levels use the Tom the Toaster arena with the run profile schedules', () => {
  const run = roguelike.createRun('boss');
  const official = OFFICIAL_LEVEL_DATA[roguelike.BOSS_LEVEL_NAME];
  assert.ok(official, 'official boss level data exists');
  const level = roguelike.buildBossLevel(run, official);
  const validated = validateCustomLevel(level);
  assert.equal(validated.bossLevel, true);
  assert.deepEqual(validated.brickTypes, validateCustomLevel({ ...official, cutscene: undefined }).brickTypes);
  assert.equal(validated.events.filter(event => event.kind === 'enemy' && event.type === 'boss').length, 1);
  assert.ok(validated.events.some(event => event.kind === 'weapon'));
  assert.ok(validated.events.some(event => event.kind === 'food'));
});

test('Type B brick attributes are exclusive and only overwritten once all bricks are occupied', () => {
  const run = roguelike.createRun('types');
  const spikes = roguelike.SPELLS.find(spell => spell.name === 'Spikes Brick');
  const springs = roguelike.SPELLS.find(spell => spell.name === 'Spring Brick');
  roguelike.applySpell(run, spikes, [3]);
  // Brick 3 now carries a Type B attribute, so it is not offered again.
  assert.ok(!springs.target.options(run).some(option => option.value === 3));
  for (const brick of run.profile.bricks.filter(brick => brick.id !== 3)) brick.boost = true;
  // All bricks occupied: overwriting becomes legal and clears the old attribute.
  assert.ok(springs.target.options(run).some(option => option.value === 3));
  roguelike.applySpell(run, springs, [3]);
  assert.equal(run.profile.bricks[3].spikes, false);
  assert.equal(run.profile.bricks[3].springs, true);
  // Type A placement ignores Type B occupancy.
  const warped = roguelike.SPELLS.find(spell => spell.name === 'Warped Brick');
  assert.equal(warped.target.options(run).length, roguelike.BRICK_COUNT);
  roguelike.applySpell(run, warped, [3]);
  assert.equal(run.profile.bricks[3].warped, 10);
  assert.equal(run.profile.bricks[3].springs, true);
});

test('weapons smith and rust along tier thresholds and clamp to family bounds', () => {
  const weapon = { family: 'sword', strikes: 1, acquired: 0 };
  assert.equal(roguelike.weaponSpawnType(weapon), 'wood');
  roguelike.adjustStrikes(weapon, 2);
  assert.equal(roguelike.weaponSpawnType(weapon), 'bronze');
  roguelike.adjustStrikes(weapon, 2);
  assert.equal(roguelike.weaponSpawnType(weapon), 'silver');
  roguelike.adjustStrikes(weapon, 99);
  assert.equal(weapon.strikes, 10);
  assert.equal(roguelike.weaponSpawnType(weapon), 'gold');
  roguelike.adjustStrikes(weapon, -99);
  assert.equal(weapon.strikes, 1);
  // A hammer below its lowest tier still spawns as a usable wood sword.
  assert.equal(roguelike.weaponSpawnType({ family: 'hammer', strikes: 1 }), 'wood');
  assert.equal(roguelike.weaponSpawnType({ family: 'axe', strikes: 12 }), 'axe-gold');
  const run = roguelike.createRun('swords');
  roguelike.addWeapon(run.profile, 'hammer', 5);
  roguelike.applySpell(run, roguelike.SPELLS.find(spell => spell.name === 'Oops! All Swords'));
  assert.ok(run.profile.weapons.every(weapon => weapon.family === 'sword'));
  assert.equal(run.profile.weapons.at(-1).strikes, 5);
});

test('spell selections share flavor and rarity and never mix brick with non-brick spells', () => {
  const run = roguelike.createRun('sets');
  const rng = roguelike.createRng('sets');
  for (let i = 0; i < 20; i++) {
    const rarity = roguelike.rollRarity(rng);
    for (const domain of ['brick', 'other']) {
      const set = roguelike.spellSet(run, rng, { flavor: '-', rarity, domain });
      assert.equal(set.length, 3);
      assert.equal(new Set(set).size, 3);
      assert.ok(set.every(spell => spell.flavor === '-'));
      assert.equal(new Set(set.map(spell => spell.rarity)).size, 1);
      assert.ok(set.every(spell => (spell.type === 'brick') === (domain === 'brick')));
    }
    const rewards = roguelike.arenaRewards(run, rng);
    assert.equal(rewards.length, 2);
    assert.ok(rewards[0].set.every(spell => spell.flavor === '-' && spell.type === 'brick'));
    assert.equal(new Set(rewards[1].set.map(spell => spell.flavor)).size, 1);
  }
});

test('the shop sells 1 rare, 3 uncommon and 5 common pawsitive spells at outlined prices', () => {
  const run = roguelike.createRun('shop');
  const stock = roguelike.shopStock(run, roguelike.createRng('stock'));
  const byRarity = rarity => stock.filter(entry => entry.spell.rarity === rarity);
  assert.equal(byRarity('rare').length, 1);
  assert.equal(byRarity('uncommon').length, 3);
  assert.equal(byRarity('common').length, 5);
  assert.ok(stock.every(entry => entry.spell.flavor === '+'));
  for (const [rarity, min, max] of [['rare', 150, 200], ['uncommon', 80, 120], ['common', 40, 70]]) {
    assert.ok(byRarity(rarity).every(entry => entry.price >= min && entry.price <= max));
  }
});

test('gold follows the outlined formula: food + 10 × enemy + 25 × goals', () => {
  assert.equal(roguelike.goldFor({ food: 32, enemy: 4, goals: 2 }), 122);
  assert.equal(roguelike.goldFor({ food: 0, enemy: 0, goals: 0 }), 0);
});

test('soccer objectives force a goal brick and Love Bugs force a barrier brick before entry', () => {
  const run = roguelike.createRun('forced');
  const soccer = { type: 'arena', act: 0, step: 0, objective: 'soccer', enemies: ['mouse', 'robo-love-bug'] };
  let forced = roguelike.forcedSpells(run, soccer);
  assert.deepEqual(forced.map(spell => spell.name), ['Goal Brick', 'Barrier Brick']);
  run.profile.bricks[2].kind = 'goal';
  run.profile.bricks[4].barrier = true;
  assert.deepEqual(roguelike.forcedSpells(run, soccer), []);
  // Without soccer balls the objective falls back to enemies and needs no goal brick.
  const other = roguelike.createRun('forced2');
  other.profile.balls = [];
  assert.deepEqual(roguelike.forcedSpells(other, { ...soccer, enemies: ['mouse'] }), []);
  const level = roguelike.buildArenaLevel(other, { ...soccer, enemies: ['mouse'] });
  assert.ok(level.killGoal > 0);
  assert.equal(level.goalsGoal, undefined);
});

test('roguelike modifiers grant crumbler immunity and survive game start', () => {
  const run = roguelike.createRun('immunity');
  run.profile.bricks[0].crumbler = 3;
  run.profile.powers.crumblerImmunity = true;
  run.profile.attributes.maxHearts = 5;
  run.profile.attributes.hearts = 5;
  const arena = { type: 'arena', act: 0, step: 0, objective: 'enemy', enemies: ['mouse'] };
  const setup = roguelike.levelSetup(run);
  const game = new Game(() => .5, { customLevel: roguelike.buildArenaLevel(run, arena) });
  game.roguelike = setup.modifiers;
  game.hearts = setup.hearts;
  game.start();
  assert.equal(game.hearts, 5);
  const brick = game.bricks[0];
  assert.equal(brick.usesLeft, 3);
  assert.ok(aim(game, brick));
  assert.equal(brick.usesLeft, 3);
  // Without the immunity the same selection consumes a use.
  const plain = new Game(() => .5, { customLevel: roguelike.buildArenaLevel(run, arena) });
  plain.start();
  assert.ok(aim(plain, plain.bricks[0]));
  assert.equal(plain.bricks[0].usesLeft, 2);
});

test('every spells.csv entry is implemented with outline flavor, type and rarity counts', () => {
  assert.equal(roguelike.SPELLS.length, 126);
  const names = new Set(roguelike.SPELLS.map(spell => spell.name));
  assert.equal(names.size, roguelike.SPELLS.length);
  for (const spell of roguelike.SPELLS) {
    assert.ok(['+', '-'].includes(spell.flavor), spell.name);
    assert.ok(['soccer', 'power', 'weapon', 'item', 'brick'].includes(spell.type), spell.name);
    assert.ok(['common', 'uncommon', 'rare'].includes(spell.rarity), spell.name);
    assert.equal(typeof spell.apply, 'function', spell.name);
  }
  // Weapon spells reference real engine weapon types.
  const run = roguelike.createRun('coverage');
  for (const weapon of run.profile.weapons) assert.ok(WEAPONS[roguelike.weaponSpawnType(weapon)]);
});
