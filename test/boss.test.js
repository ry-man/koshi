const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, CHARACTERS, validateCustomLevel, brickRegions } = require('../src/game.js');

const placement = { time: 0, kind: 'enemy', type: 'boss', x: .5, y: .5 };
const level = (events = [placement]) => ({
  version: 1, id: 'Boss arena', bossLevel: true, duration: 60,
  goal: 0, heartCost: null, brickSet: 1, events,
});
function arena(options = {}) {
  const game = new Game(() => .5, { customLevel: level(), ...options });
  game.start();
  game.invulnerableUntil = Infinity;
  return game;
}

test('boss levels require exactly one single unshielded boss and allow other enemy placements/spawners', () => {
  assert.equal(CHARACTERS.boss, 'Tom the Toaster');
  const valid = validateCustomLevel(level([placement, { ...placement, type: 'mouse', time: 5 }]));
  assert.equal(valid.bossLevel, true);
  assert.equal(validateCustomLevel(JSON.parse(JSON.stringify(valid))).events.length, 2);
  assert.throws(() => validateCustomLevel(level([])), /exactly one boss/);
  assert.throws(() => validateCustomLevel(level([placement, placement])), /exactly one boss/);
  assert.throws(() => validateCustomLevel({ ...level(), bossLevel: false, goal: 1 }), /Enable Boss/);
  assert.throws(() => validateCustomLevel({ ...level(), bossLevel: 'yes' }), /boolean/);
  assert.throws(() => validateCustomLevel({ ...level(), survive: true }), /survival/);
  assert.throws(() => validateCustomLevel(level([{ ...placement, shield: 'red' }])), /unshielded/);
  assert.throws(() => validateCustomLevel(level([{ ...placement, group: { shape: 'circle', count: 2 } }])), /single/);
  assert.equal(validateCustomLevel(level([]), { allowIncompleteBoss: true }).events.length, 0);
  assert.throws(() => new Game(() => .5, { customLevel: level([]) }), /exactly one boss/);
  const spawner = { edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'enemy', type: 'mouse' } };
  assert.equal(validateCustomLevel({ ...level(), brickTypes: [spawner] }).brickTypes[0].spawner.type, 'mouse');
  assert.throws(() => validateCustomLevel({ ...level(), brickTypes: [{ ...spawner, spawner: { kind: 'enemy', type: 'boss' } }] }), /unknown spawning/);
});

test('World 2 ends with Tom and exactly four Boost and four green slime bricks in both orientations', () => {
  const world = LEVELS.filter(entry => entry.worldId === '2');
  assert.equal(world.at(-1).number, '2-25');
  assert.equal(world.at(-2).number, '2-24');
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const game = new Game(() => .5, { ...options, level: LEVELS.indexOf(world.at(-1)) });
    const regions = brickRegions(game.bricks, game.width, game.height);
    for (const attribute of ['boost', 'slimed']) {
      const bricks = game.bricks.filter(brick => brick[attribute]);
      assert.equal(bricks.length, 4);
      assert.deepEqual(new Set(bricks.map(brick => regions.get(brick.id).edge)), new Set(['top', 'bottom', 'left', 'right']));
      if (attribute === 'slimed') assert.ok(bricks.every(brick => brick.slimeColor === 'green'));
    }
    game.start(); game.update(.01);
    assert.equal(game.robots.filter(enemy => enemy.type === 'boss').length, 1);
    assert.ok(Math.hypot(game.cat.x - game.boss.x, game.cat.y - game.boss.y) > game.cat.radius + game.boss.radius);
  }
});

test('only dizzy Boost hits damage Tom, one hit per opening, and six hits precede victory by his death animation', () => {
  const game = arena(), boss = game.boss;
  assert.equal(boss.health, 6);
  game.damageTurretEnemy(boss);
  game.defeatEnemy(boss);
  assert.equal(game.enemyDeaths.length, 0);
  game.boosted = true;
  assert.equal(game.hitBoss(boss), false);
  boss.state = 'dizzy'; game.boosted = false;
  game.weapon = { type: 'gold', uses: Infinity, expires: Infinity };
  assert.equal(game.hitBoss(boss), false);
  for (let hit = 1; hit <= 6; hit++) {
    boss.state = 'dizzy'; boss.invulnerableUntil = 0; game.boosted = true;
    assert.equal(game.hitBoss(boss), true);
    assert.equal(boss.health, 6 - hit);
    assert.equal(game.hitBoss(boss), false);
    if (hit < 6) assert.equal(game.bossDefeated, false);
  }
  assert.equal(game.enemyDeaths.filter(enemy => enemy.type === 'boss').length, 1);
  assert.equal(game.bossProjectiles.length, 0);
  assert.equal(game.state, 'playing');
  const elapsed = game.elapsed, cat = { ...game.cat };
  game.update(2.39);
  assert.equal(game.state, 'playing');
  assert.equal(game.elapsed, elapsed);
  assert.deepEqual(game.cat, cat);
  game.update(.01);
  assert.equal(game.state, 'won');
  game.reset();
  assert.equal(game.bossDefeated, false);
  assert.equal(game.boss, null);
});

test('boss fights do not win from score targets or expire, and pause freezes the fight', () => {
  const game = arena();
  game.update(61);
  assert.equal(game.state, 'playing');
  assert.equal(game.timeLimit, Infinity);
  const age = game.boss.age, elapsed = game.elapsed;
  game.pause(); game.update(5);
  assert.equal(game.boss.age, age);
  assert.equal(game.elapsed, elapsed);
  game.resume();
  game.collectItem({ type: 'music-box' });
  game.collectItem({ type: 'spooky-mask' });
  game.update(.01);
  assert.equal(game.boss.asleep, false);
  assert.equal(game.boss.afraid, false);
});

test('Tom randomly selects all attacks and one to four cycles, then returns to center and becomes dizzy', () => {
  for (const roll of [0, .4, .99]) {
    const game = arena(), boss = game.boss;
    game.random = () => roll;
    game.initializeBoss(boss);
    assert.equal(boss.cyclesRemaining, 1 + Math.floor(roll * 4));
    game.startBossAttack(boss);
    assert.equal(boss.attack, 1 + Math.floor(roll * 3));
    assert.equal(boss.direction, roll < .5 ? -1 : 1);
    boss.cyclesRemaining = 1;
    game.finishBossAttack(boss); game.updateBoss(boss, .01);
    assert.equal(boss.state, 'dizzy');
    assert.equal(boss.x, game.width / 2);
    assert.equal(boss.y, game.height / 2);
    game.updateBoss(boss, 5);
    assert.equal(boss.state, 'rest');
  }
});

test('spinning launches straight-line toast, waits for spin-up, and toast hurts Koshi without destroying bricks', () => {
  const game = arena(), boss = game.boss;
  game.random = () => 0; game.startBossAttack(boss);
  game.updateBoss(boss, .9);
  assert.equal(game.bossProjectiles.length, 0);
  game.updateBoss(boss, .1); game.updateBoss(boss, .18);
  assert.ok(game.bossProjectiles.length >= 1);
  const toast = game.bossProjectiles[0], x = toast.x, y = toast.y;
  game.updateBossProjectiles(.1, game.cat.x, game.cat.y);
  assert.ok(Math.abs(toast.x - x - toast.vx * .1) < 1e-8);
  assert.ok(Math.abs(toast.y - y - toast.vy * .1) < 1e-8);
  const bricks = structuredClone(game.bricks);
  game.bossProjectiles = [{ x: game.cat.x - 100, y: game.cat.y, vx: 1000, vy: 0, radius: 12 }];
  game.invulnerableUntil = 0;
  game.updateBossProjectiles(.2, game.cat.x, game.cat.y);
  assert.equal(game.hearts, 2);
  assert.deepEqual(game.bricks, bricks);
  game.updateBossProjectiles(10, game.cat.x, game.cat.y);
  assert.equal(game.bossProjectiles.length, 0);
});

test('bounce cycle moves immediately at 520 units per second in straight lines and reflects off bricks', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const game = arena(options), boss = game.boss;
    game.random = () => .5; game.startBossAttack(boss);
    assert.equal(boss.state, 'bounce');
    assert.equal(boss.target, null);
    boss.phase = .3;
    const start = { x: boss.x, y: boss.y };
    game.updateBoss(boss, .1);
    assert.ok(Math.abs(boss.x - start.x - Math.cos(.3) * 52) < 1e-8);
    assert.ok(Math.abs(boss.y - start.y - Math.sin(.3) * 52) < 1e-8);
    const regions = brickRegions(game.bricks, game.width, game.height);
    const brick = game.brickParts().filter(part => regions.get(part.id).edge === 'right')
      .sort((a, b) => Math.abs(a.y + a.h / 2 - game.height / 2) - Math.abs(b.y + b.h / 2 - game.height / 2))[0];
    boss.x = brick.x - boss.radius - 10;
    boss.y = brick.y + brick.h / 2;
    boss.phase = 0;
    game.updateBoss(boss, .1);
    assert.ok(Math.abs(boss.x - (brick.x - boss.radius - 42.01)) < 1e-7);
    assert.ok(Math.abs(Math.abs(boss.phase) - Math.PI) < 1e-8);
    assert.equal(boss.state, 'bounce');
    game.updateBoss(boss, 3.8);
    assert.equal(boss.state, 'return');
    game.updateBoss(boss, 10);
    assert.equal(boss.x, game.width / 2);
    assert.equal(boss.y, game.height / 2);
  }
});

test('cycle 3 charges then fires blue toast followed by black toast, preserving black destruction rules', () => {
  const game = arena(), boss = game.boss;
  for (const brick of game.bricks) brick.boost = true;
  game.random = () => .99; game.startBossAttack(boss);
  assert.equal(boss.state, 'burn-charge');
  assert.ok(boss.target, 'blue toast can target Boost bricks');
  const blueId = boss.target.id;
  game.updateBoss(boss, 1.2);
  assert.equal(game.bossProjectiles.length, 0);
  game.updateBoss(boss, .1);
  assert.equal(game.bossProjectiles[0].blue, true);
  assert.equal(game.bossProjectiles[0].burnt, false);
  assert.equal(boss.state, 'burn-charge');
  game.updateBossProjectiles(10, game.cat.x, game.cat.y);
  assert.equal(game.bricks[blueId].kind, 'slow');
  assert.equal(game.bricks[blueId].boost, true);
  const brick = game.bricks.find(brick => brick.id !== blueId);
  brick.boost = false;
  game.updateBoss(boss, .34);
  assert.equal(game.bossProjectiles.length, 0);
  game.updateBoss(boss, .01);
  assert.equal(game.bossProjectiles.length, 1);
  assert.equal(game.bossProjectiles[0].burnt, true);
  assert.equal(game.bossProjectiles[0].blue, false);
  assert.equal(game.bossProjectiles[0].targetId, brick.id);
  assert.equal(boss.state, 'return');
  game.updateBossProjectiles(10, game.cat.x, game.cat.y);
  assert.equal(brick.kind, 'cinder');
  assert.equal(game.brickDestructions.at(-1).id, brick.id);
  assert.equal(game.bricks[blueId].boost, true);
  assert.equal(game.bossProjectiles.length, 0);
  for (const brick of game.bricks) brick.boost = true;
  assert.equal(game.bossBrickTarget(true), null);
});

test('blue toast never targets or recolors Cinder and recolors merged bricks without removing their attributes', () => {
  const game = arena(), boss = game.boss;
  for (const brick of game.bricks) brick.kind = 'cinder';
  assert.equal(game.bossBrickTarget(), null);
  const brick = game.bricks[0], member = game.bricks[2];
  brick.kind = 'normal'; brick.boost = true; brick.readyAt = 50;
  member.kind = 'normal'; member.boost = true; member.readyAt = 50; member.absorbedBy = brick.id;
  game.brickRevision++;
  const before = [{ ...brick }, { ...member }];
  const part = game.brickParts().find(part => part.id === brick.id);
  boss.target = { id: brick.id };
  boss.x = part.x + part.w / 2; boss.y = part.y + part.h + 100;
  game.shootBossToast(boss, -Math.PI / 2, false, true);
  const revision = game.brickRevision;
  game.updateBossProjectiles(1, game.cat.x, game.cat.y);
  for (const [index, target] of [brick, member].entries()) {
    assert.deepEqual(target, { ...before[index], kind: 'slow', readyAt: 0 });
  }
  assert.equal(game.brickRevision, revision + 1);
  assert.equal(game.brickDestructions.length, 0);
  brick.kind = 'cinder'; member.kind = 'cinder'; game.brickRevision++;
  game.shootBossToast(boss, -Math.PI / 2, false, true);
  game.updateBossProjectiles(1, game.cat.x, game.cat.y);
  assert.equal(brick.kind, 'cinder');
  assert.equal(game.bossProjectiles.length, 0);
});

test('blue toast retargets a brick destroyed during charge and finishes safely when no targets remain', () => {
  const game = arena(), boss = game.boss;
  game.random = () => .99; game.startBossAttack(boss);
  const original = boss.target.id;
  game.convertBrickToCinder(game.bricks[original], game.brickParts());
  game.updateBoss(boss, 1.3);
  assert.equal(game.bossProjectiles.length, 1);
  assert.equal(game.bossProjectiles[0].blue, true);
  assert.notEqual(game.bossProjectiles[0].targetId, original);
  game.bossProjectiles = [];
  for (const brick of game.bricks) brick.kind = 'cinder';
  game.brickRevision++;
  game.startBossAttack(boss);
  game.updateBoss(boss, 1.65);
  assert.equal(game.bossProjectiles.length, 0);
  assert.equal(boss.state, 'return');
});

test('swept Boost combat defeats Tom only after six separate dizzy openings', () => {
  const game = arena(), boss = game.boss;
  game.cat.x = boss.x - 120; game.cat.y = boss.y;
  game.boosted = true; boss.state = 'dizzy';
  game.combatEnemies(.01, boss.x - 120, boss.y);
  assert.equal(boss.health, 6);
  game.cat.x = boss.x + 120;
  game.combatEnemies(.01, boss.x - 120, boss.y);
  assert.equal(boss.health, 5);
  assert.equal(game.robots.includes(boss), true);
  assert.equal(game.enemyDeaths.length, 0);
});
