const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, CHARACTERS, isBossType, validateCustomLevel, levelObjective, SLIMES } = require('../src/game.js');
const { spawnSymbol, spawnColor, drawPaintSplash } = require('../src/brick-visuals.js');

const placement = { time: 0, kind: 'enemy', type: 'tom-frog', x: .5, y: .5 };
const level = events => ({
  version: 1, id: 'Frog arena', bossLevel: true, duration: 60,
  goal: 0, heartCost: null, brickSet: 1, events: events ?? [placement],
});
function arena(options = {}) {
  const game = new Game(() => .5, { customLevel: level(), ...options });
  game.start();
  game.invulnerableUntil = Infinity;
  return game;
}
function fly(x, y) { return { x, y, radius: 13, age: 0, phase: 0 }; }
function swallow(game, count) {
  const boss = game.boss;
  boss.state = 'tongue-retract';
  boss.tongue = { x: boss.x, y: boss.y + 12, length: 0, angle: 0, caught: Array.from({ length: count }, () => fly(boss.x, boss.y)) };
  game.updateFrogTongue(boss, .01, game.cat.x, game.cat.y);
  assert.equal(boss.state, 'lick');
  game.updateFrog(boss, .65);
}

test('frog boss validates, round-trips, has distinct editor art, and shares boss restrictions', () => {
  assert.equal(CHARACTERS['tom-frog'], 'Tom the Frog');
  assert.equal(isBossType('tom-frog'), true);
  assert.deepEqual(validateCustomLevel(level()), level());
  assert.match(levelObjective(level()), /Tom the Frog.*6 sword hits/);
  assert.notEqual(spawnSymbol(placement), spawnSymbol({ ...placement, type: 'boss' }));
  assert.equal(spawnColor(placement), '#879779');
  assert.throws(() => validateCustomLevel({ ...level(), bossLevel: false, goal: 1 }), /Enable Boss/);
  assert.throws(() => validateCustomLevel(level([placement, { ...placement, type: 'boss' }])), /exactly one boss/);
  for (const extra of [{ shield: 'red' }, { random: true, randomCount: 2 }, { group: { shape: 'circle', count: 2 } }]) {
    assert.throws(() => validateCustomLevel(level([{ ...placement, ...extra }])), /single, unshielded/);
  }
  assert.throws(() => validateCustomLevel({ ...level(), brickTypes: [
    { edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'enemy', type: 'tom-frog' } },
  ] }), /unknown spawning/);
  const game = arena();
  assert.equal(game.boss.name, 'Tom the Frog');
  assert.equal(game.boss.health, 6);
  assert.equal(game.timeLimit, Infinity);
  game.reset();
  assert.deepEqual(game.frogFlies, []);
  assert.deepEqual(game.frogEffects, []);
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  test(`jump tracks for exactly two seconds, locks, then damages only the landing (${options.portrait ? 'portrait' : 'landscape'})`, () => {
    const game = arena(options), boss = game.boss;
    game.random = () => 0;
    game.startFrogAttack(boss);
    assert.equal(boss.state, 'jump-up');
    game.invulnerableUntil = 0;
    Object.assign(game.cat, { x: boss.x, y: boss.y });
    game.combatEnemies(.2, game.cat.x, game.cat.y);
    assert.equal(game.hearts, 3, 'airborne frog has no ground collision');
    game.updateFrog(boss, .25);
    assert.equal(boss.state, 'jump-track');
    game.cat.x += 60;
    game.updateFrog(boss, 1.99);
    assert.equal(boss.shadow.x, game.cat.x);
    assert.equal(boss.state, 'jump-track');
    game.updateFrog(boss, .01);
    assert.equal(boss.state, 'jump-fall');
    const target = { ...boss.shadow };
    game.cat.x += 150;
    game.updateFrog(boss, .324);
    assert.deepEqual(boss.shadow, target);
    assert.equal(boss.state, 'jump-fall', 'the locked shadow lasts 30% longer than 0.25 seconds');
    game.updateFrog(boss, .001);
    assert.equal(boss.state, 'slam');
    assert.equal(boss.x, target.x);
    assert.equal(game.hearts, 3, 'dodging the locked shadow avoids the slam');
    assert.equal(game.frogEffects.at(-1).type, 'smoke');
    boss.shadow = { x: game.cat.x, y: game.cat.y };
    boss.state = 'jump-fall'; boss.stateTime = 0;
    game.updateFrog(boss, .325);
    assert.equal(game.hearts, 2);
  });
}

test('tongue warning lasts five blink periods before aiming at current Koshi', () => {
  const game = arena(), boss = game.boss;
  game.frogFlies = [fly(40, 40)];
  game.random = () => .5;
  game.startFrogAttack(boss);
  assert.equal(boss.state, 'tongue-blink');
  game.updateFrog(boss, .99);
  assert.equal(boss.tongue, null);
  game.cat.x = boss.x; game.cat.y = boss.y - 100;
  game.updateFrog(boss, .01);
  assert.equal(boss.state, 'tongue-extend');
  assert.equal(boss.tongue.angle, -Math.PI / 2);
});

test('tongue stops at first brick and swings a constant-length 90 degrees in either direction', () => {
  for (const direction of [-1, 1]) {
    const game = arena(), boss = game.boss;
    game.cat.x = game.width + 100; game.cat.y = boss.y + 12;
    game.shootFrogTongue(boss);
    const tongue = boss.tongue;
    assert.equal(tongue.brickHit, true);
    const first = game.brickParts().filter(part => part.x > boss.x && part.y <= tongue.y && part.y + part.h >= tongue.y)
      .sort((a, b) => a.x - b.x)[0];
    assert.ok(Math.abs(tongue.limit - (first.x - boss.x - 5)) < 1e-8);
    game.cat.x = boss.x + 100;
    game.cat.y = boss.y + 12 + direction * 200;
    game.updateFrogTongue(boss, 1, game.cat.x, game.cat.y);
    assert.equal(boss.state, 'tongue-hold');
    const held = { angle: tongue.angle, length: tongue.length };
    game.updateFrog(boss, .99, game.cat.x, game.cat.y);
    assert.equal(boss.state, 'tongue-hold', 'the tongue rests on the brick for a full second');
    assert.deepEqual({ angle: tongue.angle, length: tongue.length }, held);
    game.updateFrog(boss, .01, game.cat.x, game.cat.y);
    assert.equal(boss.state, 'tongue-swing');
    assert.equal(tongue.direction, direction);
    const length = tongue.length;
    game.cat.x = boss.x - 100;
    game.updateFrogTongue(boss, 1, game.cat.x, game.cat.y);
    assert.equal(boss.state, 'tongue-retract');
    assert.equal(tongue.length, length);
    assert.ok(Math.abs(tongue.angle - direction * Math.PI / 2) < 1e-8);
  }
});

test('tongue hits Koshi before the wall, splashes blue saliva, then retracts without repeated hits', () => {
  const game = arena(), boss = game.boss;
  game.invulnerableUntil = 0;
  game.cat.x = boss.x + 140; game.cat.y = boss.y + 12;
  game.shootFrogTongue(boss);
  game.updateFrogTongue(boss, .3, game.cat.x, game.cat.y);
  assert.equal(boss.state, 'tongue-retract');
  assert.equal(game.hearts, 2);
  assert.equal(game.frogEffects[0].type, 'saliva');
  assert.ok(boss.tongue.length < boss.tongue.limit);
  game.updateFrogTongue(boss, 1, game.cat.x, game.cat.y);
  assert.equal(boss.tongue, null);
  assert.equal(game.hearts, 2);
});

test('the tongue shaft catches flies, reels them in, and licks before sleeping', () => {
  const game = arena(), boss = game.boss;
  game.cat.x = boss.x + 200; game.cat.y = boss.y + 12;
  game.shootFrogTongue(boss);
  boss.tongue.length = 180; boss.state = 'tongue-swing'; boss.tongue.direction = 1;
  game.frogFlies = [fly(boss.x + 70, boss.y + 12)];
  game.cat.y -= 200;
  game.updateFrogTongue(boss, .01, game.cat.x, game.cat.y);
  assert.equal(game.frogFlies.length, 0);
  assert.equal(boss.tongue.caught.length, 1);
  assert.equal(boss.state, 'tongue-retract');
  assert.equal(boss.fliesEaten, 0, 'not swallowed until the tongue returns');
  game.updateFrogTongue(boss, 1, game.cat.x, game.cat.y);
  assert.equal(boss.fliesEaten, 1);
  assert.equal(boss.state, 'lick');
  game.updateFrog(boss, .64);
  assert.equal(boss.state, 'lick');
  game.updateFrog(boss, .01);
  assert.equal(boss.state, 'sleep');
});

test('slime attack fires one randomly colored shot at any visible brick and recolors slimed bricks', () => {
  for (const color of ['red', 'green', 'blue']) {
    const game = arena(), boss = game.boss;
    const roll = { red: 0, green: .5, blue: .99 }[color];
    game.random = () => roll;
    game.shootFrogSlime(boss);
    assert.equal(game.bossProjectiles.length, 1);
    const [shot] = game.bossProjectiles;
    assert.equal(shot.color, color);
    const id = shot.targetId, kind = game.bricks[id].kind;
    game.updateBossProjectiles(10, game.cat.x, game.cat.y);
    assert.equal(game.bossProjectiles.length, 0);
    assert.equal(game.bricks[id].slimed, true);
    assert.equal(game.bricks[id].slimeColor, color);
    assert.equal(game.bricks[id].kind, kind);
    assert.equal(game.paintEffects.length, 1);
    assert.ok(game.paintEffects.every(effect => effect.scale === .45 && effect.color === SLIMES[color].color));
    game.updatePaintEffects(1);
    assert.equal(game.paintEffects.length, 0);
  }
  const game = arena();
  game.bricks.forEach(brick => { brick.slimed = true; brick.slimeColor = 'green'; });
  const rolls = [0, .99];
  game.random = () => rolls.shift();
  game.shootFrogSlime(game.boss);
  assert.equal(game.bossProjectiles.length, 1, 'already slimed bricks remain targets');
  const id = game.bossProjectiles[0].targetId;
  game.updateBossProjectiles(10, game.cat.x, game.cat.y);
  assert.equal(game.bricks[id].slimeColor, 'blue', 'new slime replaces the old color');
});

test('fly intervals are 5–15 seconds, cap is three, contact hurts, and swords destroy them without feeding Tom', () => {
  for (const roll of [0, .5, .999]) {
    const game = arena(), boss = game.boss;
    game.random = () => roll;
    game.initializeFrog(boss);
    assert.ok(Math.abs(boss.nextFlyAt - game.elapsed - (5 + roll * 10)) < 1e-8);
    for (let i = 0; i < 6; i++) {
      game.elapsed = boss.nextFlyAt;
      game.updateFrogFlies(boss, .01, game.cat.x, game.cat.y);
      assert.equal(game.frogFlies.length + game.frogPendingFlies.length, Math.min(3, i + 1));
      assert.ok(Math.abs(boss.nextFlyAt - game.elapsed - (5 + roll * 10)) < 1e-8);
    }
    game.frogPendingFlies = [];
    game.invulnerableUntil = 0;
    game.frogFlies = [fly(game.cat.x, game.cat.y)];
    game.updateFrogFlies(boss, .01, game.cat.x, game.cat.y);
    assert.equal(game.hearts, 2);
    game.weapon = { type: 'bronze', uses: 3 };
    game.updateFrogFlies(boss, .01, game.cat.x, game.cat.y);
    assert.equal(game.frogFlies.length, 0);
    assert.equal(game.weapon.uses, 2);
    assert.equal(boss.fliesEaten, 0);
  }
});

test('flies being reeled in still count toward the three-fly limit', () => {
  const game = arena(), boss = game.boss;
  game.frogFlies = [fly(100, 100), fly(200, 200)];
  boss.tongue = { caught: [fly(300, 300)] };
  game.elapsed = boss.nextFlyAt;
  game.updateFrogFlies(boss, .01, game.cat.x, game.cat.y);
  assert.equal(game.frogFlies.length, 2);
  assert.equal(game.frogPendingFlies.length, 0);
});

test('flies arrive through the standard one-second enemy skull cloud and pending flies count toward the cap', () => {
  const game = arena(), boss = game.boss;
  game.elapsed = boss.nextFlyAt;
  game.updateFrogFlies(boss, .01, game.cat.x, game.cat.y);
  assert.equal(game.frogFlies.length, 0);
  assert.equal(game.frogPendingFlies.length, 1);
  const pending = game.frogPendingFlies[0];
  assert.deepEqual(game.spawnCues.map(({ kind, x, y, progress }) => ({ kind, x, y, progress })),
    [{ kind: 'enemy', x: pending.x, y: pending.y, progress: 0 }]);
  game.elapsed += .5;
  assert.ok(Math.abs(game.spawnCues[0].progress - .5) < 1e-9);
  game.frogFlies = [fly(100, 100), fly(200, 200)];
  boss.nextFlyAt = game.elapsed;
  game.updateFrogFlies(boss, .01, game.cat.x, game.cat.y);
  assert.equal(game.frogPendingFlies.length, 1, 'two flies plus a pending fly already fill the cap');
  game.elapsed += .5;
  game.updateFrogFlies(boss, .01, game.cat.x, game.cat.y);
  assert.equal(game.frogPendingFlies.length, 0);
  assert.equal(game.frogFlies.length, 3);
  assert.ok(Math.hypot(game.frogFlies[2].x - pending.x, game.frogFlies[2].y - pending.y) < 1);
  assert.deepEqual(game.spawnCues, []);
});

test('one in five flies carries a heart that Koshi can free, but Tom eats it with the fly', () => {
  for (const [roll, carries] of [[0, true], [.199999, true], [.2, false], [.9, false]]) {
    const game = arena(), boss = game.boss;
    game.random = () => roll;
    boss.nextFlyAt = game.elapsed;
    game.updateFrogFlies(boss, 0, game.cat.x, game.cat.y);
    assert.equal(game.frogPendingFlies[0].carriesHeart, carries);
    game.elapsed += 1;
    game.updateFrogFlies(boss, 0, game.cat.x, game.cat.y);
    assert.equal(game.frogFlies[0].carriesHeart, carries);
  }
  const game = arena(), boss = game.boss;
  boss.nextFlyAt = Infinity;
  game.weapon = { type: 'bronze', uses: 3 };
  game.frogFlies = [{ ...fly(game.cat.x, game.cat.y), carriesHeart: true }];
  game.updateFrogFlies(boss, 0, game.cat.x, game.cat.y);
  assert.equal(game.frogFlies.length, 0);
  assert.equal(game.healing.length, 1);
  assert.ok(Math.abs(game.healing[0].x - game.cat.x) < 1 && Math.abs(game.healing[0].y - game.cat.y) < 1);
  game.healing = [];
  game.weapon = null;
  game.frogFlies = [{ ...fly(boss.x + 100, boss.y + 12), carriesHeart: true }];
  game.cat.x = boss.x - 300;
  boss.tongue = { x: boss.x, y: boss.y + 12, angle: 0, length: 0, limit: 300, brickHit: false, swept: 0, caught: [], hitCat: false };
  boss.state = 'tongue-extend';
  game.updateFrogTongue(boss, .2, game.cat.x, game.cat.y);
  assert.equal(boss.tongue.caught[0].carriesHeart, true);
  while (boss.tongue) game.updateFrogTongue(boss, .1, game.cat.x, game.cat.y);
  assert.equal(boss.fliesEaten, 1);
  assert.equal(game.healing.length, 0, 'the heart is eaten along with the fly');
});

test('flies steer away from every boundary within two Koshi widths and keep their wandering speed', () => {
  for (const portrait of [false, true]) for (const edge of ['left', 'right', 'top', 'bottom']) {
    const game = arena({ portrait }), boss = game.boss, bounds = game.bounds();
    boss.nextFlyAt = Infinity; boss.nextSwordAt = Infinity;
    const vertical = edge === 'left' || edge === 'right', sign = ['left', 'top'].includes(edge) ? 1 : -1;
    const point = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
    point[vertical ? 'x' : 'y'] = bounds[edge] + sign * 20;
    const insect = { ...fly(point.x, point.y), phase: vertical ? sign > 0 ? Math.PI : 0 : sign > 0 ? -Math.PI / 2 : Math.PI / 2 };
    game.frogFlies = [insect];
    game.updateFrogFlies(boss, .1, game.cat.x, game.cat.y);
    const dx = insect.x - point.x, dy = insect.y - point.y;
    assert.ok((vertical ? dx : dy) * sign > 0, `${portrait ? 'portrait' : 'landscape'} ${edge} fly moves inward`);
    assert.ok(Math.abs(Math.hypot(dx, dy) - 3.2) < 1e-9, 'speed remains 32 units per second');
    for (let frame = 0; frame < 360; frame++) game.updateFrogFlies(boss, 1 / 120, game.cat.x, game.cat.y);
    const gap = Math.min(...game.brickParts().map(part => Math.hypot(
      insect.x - Math.max(part.x, Math.min(part.x + part.w, insect.x)),
      insect.y - Math.max(part.y, Math.min(part.y + part.h, insect.y))))) - insect.radius;
    assert.ok(gap >= game.cat.radius * 4, 'fly leaves at least two Koshi widths behind it');
  }
});

test('fly avoidance starts at the exact two-width gap and handles internal, merged and corner bricks', () => {
  const game = arena(), boss = game.boss;
  boss.nextFlyAt = Infinity; boss.nextSwordAt = Infinity;
  const body = { x: 250, y: 250, w: 100, h: 100 };
  game.brickParts = () => [{ x: 250, y: 250, w: 50, h: 100, collisionBody: body }];
  for (const [gap, avoids] of [[game.cat.radius * 4 - .001, true], [game.cat.radius * 4, false]]) {
    const insect = { ...fly(body.x + body.w + 13 + gap, 300), phase: Math.PI };
    game.frogFlies = [insect];
    game.updateFrogFlies(boss, 0, game.cat.x, game.cat.y);
    assert.equal(Math.cos(insect.phase) > 0, avoids, `gap ${gap}`);
  }
  const corner = { ...fly(370, 370), phase: -Math.PI * .75 };
  game.frogFlies = [corner];
  game.updateFrogFlies(boss, .1, game.cat.x, game.cat.y);
  assert.ok(corner.x > 370 && corner.y > 370, 'rounded corner clearance steers diagonally away');
  const inside = { ...fly(255, 300), phase: 0 };
  game.frogFlies = [inside];
  game.updateFrogFlies(boss, .1, game.cat.x, game.cat.y);
  assert.ok(inside.x < 255, 'an overlapping fly leaves through the nearest brick face');
});

test('flies spawn at least one Tom body width away from his body', () => {
  let seed = 7;
  const game = arena(), boss = game.boss;
  game.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 40; i++) {
    game.frogFlies = []; game.frogPendingFlies = [];
    boss.nextFlyAt = game.elapsed;
    game.updateFrogFlies(boss, 0, game.cat.x, game.cat.y);
    const [pending] = game.frogPendingFlies;
    assert.ok(Math.hypot(pending.x - boss.x, pending.y - boss.y) - boss.radius - 13 >= boss.radius * 2 - 1e-9);
  }
});

test('Tom slowly walks through open floor while resting, then attacks after two seconds', () => {
  const game = arena(), boss = game.boss;
  game.cat.x = boss.x - 250; game.cat.y = boss.y;
  boss.nextFlyAt = Infinity; boss.nextSwordAt = Infinity;
  boss.walkTarget = { x: boss.x + 200, y: boss.y };
  const start = boss.x;
  game.updateFrog(boss, 1);
  assert.equal(boss.state, 'rest');
  assert.equal(boss.walking, true);
  assert.ok(Math.abs(boss.x - start - 32) < 1e-8, 'walks 32 pixels per second');
  assert.ok(boss.walkDistance > 0);
  game.updateFrog(boss, 1);
  assert.notEqual(boss.state, 'rest');
  assert.equal(boss.walking, false);
  boss.state = 'rest'; boss.stateTime = 0;
  boss.walkTarget = { x: game.cat.x, y: game.cat.y };
  boss.x = game.cat.x + game.cat.radius + boss.radius + 6.5;
  const before = boss.x;
  game.updateFrog(boss, .1);
  assert.equal(boss.x, before, 'Tom will not walk into Koshi');
  const part = game.brickParts()[0];
  boss.x = part.x + part.w + boss.radius * .75 + .5; boss.y = part.y + part.h / 2;
  game.cat.x = boss.x + 300; game.cat.y = boss.y;
  boss.walkTarget = { x: part.x, y: boss.y };
  game.updateFrog(boss, .1);
  assert.equal(boss.walkTarget, null, 'Tom will not walk through bricks');
});

test('Tom never starts a tongue attack unless a fly is on the board', () => {
  for (const roll of [0, .34, .5, .67, .999]) {
    const game = arena(), boss = game.boss;
    game.random = () => roll;
    game.frogPendingFlies = [{ x: 50, y: 50, time: game.elapsed + 1 }];
    game.startFrogAttack(boss);
    assert.notEqual(boss.state, 'tongue-blink');
    game.frogFlies = [fly(50, 50)];
    game.startFrogAttack(boss);
    assert.equal(boss.state, ['jump-up', 'tongue-blink', 'slime-charge'][Math.floor(roll * 3)]);
  }
});

test('Tom attempts his tongue after at most three other attacks and resets the count on each attempt', () => {
  for (const roll of [0, .999]) {
    const game = arena(), boss = game.boss;
    game.random = () => roll;
    game.frogFlies = [fly(50, 50)];
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let attack = 1; attack <= 3; attack++) {
        game.startFrogAttack(boss);
        assert.equal(boss.state, roll === 0 ? 'jump-up' : 'slime-charge');
        assert.equal(boss.attacksSinceTongue, attack);
      }
      game.startFrogAttack(boss);
      assert.equal(boss.state, 'tongue-blink');
      assert.equal(boss.attacksSinceTongue, 0, 'even a missed tongue attack resets the count');
    }
    game.startFrogAttack(boss);
    game.random = () => .5;
    game.startFrogAttack(boss);
    assert.equal(boss.state, 'tongue-blink', 'random tongue attacks can still happen before the cap');
    assert.equal(boss.attacksSinceTongue, 0);
  }
});

test('a tongue attempt overdue while flies are absent happens as soon as a fly is available', () => {
  const game = arena(), boss = game.boss;
  game.random = () => 0;
  game.frogPendingFlies = [{ x: 50, y: 50, time: 10 }];
  for (let attack = 0; attack < 10; attack++) {
    game.startFrogAttack(boss);
    assert.equal(boss.state, 'jump-up', 'pending flies do not make a tongue attack valid');
  }
  assert.equal(boss.attacksSinceTongue, 3);
  game.frogFlies = [fly(50, 50)];
  game.startFrogAttack(boss);
  assert.equal(boss.state, 'tongue-blink');
});

test('render draws Tom above the bricks, then his tongue and slime, and ignores slime splashes for the paintbrush swing', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const render = source.slice(source.indexOf('function render('));
  const actor = render.indexOf('ctx = actorCtx;');
  const frog = render.indexOf('for (const enemy of frogs) drawRobot(enemy');
  assert.ok(actor > 0 && frog > actor, 'Tom draws on the actor canvas above the brick layer');
  assert.ok(render.indexOf("if (enemy.type === 'tom-frog') continue;") > actor, 'Tom is skipped in the other enemies pass');
  assert.ok(render.indexOf('drawFrogTongue(enemy.tongue)') > frog);
  assert.ok(render.indexOf('drawFrogSlimeBall(toast)') > frog);
  assert.ok(render.indexOf('drawCat(game.cat.x') > frog, 'Koshi stays above Tom');
  const swing = render.match(/const paintSwing = \[\.\.\.game\.paintEffects\]\.reverse\(\)\.find\((.+)\);/)[1];
  const find = vm.runInNewContext(`ITEMS => ${swing}`)({ brush: {} });
  assert.equal(find({ color: '#287dcc', scale: .45, age: 0 }), false);
  assert.equal(find({ type: 'brush', age: 0 }), true);
});

test('bronze swords keep arriving every 10–20 seconds, even while armed, until three are in play', () => {
  for (const roll of [0, .5, .999]) {
    const game = arena(), boss = game.boss;
    game.random = () => roll; game.initializeFrog(boss);
    const delay = 10 + roll * 10;
    assert.ok(Math.abs(boss.nextSwordAt - game.elapsed - delay) < 1e-8);
    boss.nextFlyAt = Infinity;
    game.weapon = { type: 'bronze', uses: 3 };
    game.elapsed = boss.nextSwordAt - .01;
    game.updateFrogFlies(boss, 0, game.cat.x, game.cat.y);
    assert.equal(game.weapons.length, 0);
    game.elapsed += .01;
    game.updateFrogFlies(boss, 0, game.cat.x, game.cat.y);
    assert.equal(game.weapons.length, 1, 'an armed Koshi still receives swords');
    assert.equal(game.weapons[0].type, 'bronze');
    game.updateFrogFlies(boss, 0, game.cat.x, game.cat.y);
    assert.ok(Math.abs(boss.nextSwordAt - game.elapsed - delay) < 1e-8);
    game.elapsed = boss.nextSwordAt;
    game.updateFrogFlies(boss, 0, game.cat.x, game.cat.y);
    assert.equal(game.weapons.length, 2);
    game.elapsed += 100;
    game.updateFrogFlies(boss, 0, game.cat.x, game.cat.y);
    assert.equal(game.weapons.length, 2, 'two arena swords plus Koshi\'s sword fill the cap');
    assert.equal(boss.nextSwordAt, null);
    game.weapon = null;
    game.updateFrogFlies(boss, 0, game.cat.x, game.cat.y);
    assert.ok(Math.abs(boss.nextSwordAt - game.elapsed - delay) < 1e-8);
    game.elapsed = boss.nextSwordAt;
    game.updateFrogFlies(boss, 0, game.cat.x, game.cat.y);
    assert.equal(game.weapons.length, 3);
    game.elapsed += 100;
    game.updateFrogFlies(boss, 0, game.cat.x, game.cat.y);
    assert.equal(game.weapons.length, 3, 'three arena swords fill the cap');
    assert.equal(boss.nextSwordAt, null);
  }
});

test('six single-fly meals provide six sword openings; only sleeping hits count; death finishes before winning', () => {
  const game = arena(), boss = game.boss;
  game.boosted = true;
  game.damageRangedEnemy(boss); game.defeatEnemy(boss);
  assert.equal(boss.health, 6);
  assert.equal(game.enemyDeaths.length, 0);
  for (let hit = 0; hit < 6; hit++) {
    boss.state = 'rest'; boss.invulnerableUntil = 0;
    game.weapon = { type: 'bronze', uses: 3 };
    assert.equal(game.hitFrog(boss), false, 'awake sword hits cannot damage him');
    swallow(game, 1);
    assert.equal(boss.state, 'sleep', `one fly opens hit ${hit + 1}`);
    game.weapon = null;
    assert.equal(game.hitFrog(boss), false, 'Boost alone cannot damage him');
    for (const type of ['hammer-bronze', 'axe-gold', 'rope-dart-gold']) {
      game.weapon = { type, uses: 3 };
      assert.equal(game.hitFrog(boss), false);
    }
    game.weapon = { type: 'bronze', uses: 3 };
    assert.equal(game.hitFrog(boss), true);
    assert.equal(boss.health, 5 - hit);
    assert.equal(game.weapon.uses, 2);
    assert.equal(game.hitFrog(boss), false, 'only one hit per sleep');
  }
  assert.equal(game.bossDefeated, true);
  assert.equal(game.enemyDeaths.length, 1);
  assert.equal(game.state, 'playing');
  assert.deepEqual(game.frogFlies, []);
  game.update(2.39);
  assert.equal(game.state, 'playing');
  game.update(.01);
  assert.equal(game.state, 'won');
});

test('sleep lasts eight seconds, ignores power-up sleep/fear, and pause freezes timers', () => {
  const game = arena(), boss = game.boss;
  swallow(game, 1);
  game.updateFrog(boss, 7.99);
  assert.equal(boss.state, 'sleep');
  game.updateFrog(boss, .01);
  assert.equal(boss.state, 'rest');
  assert.equal(boss.fliesEaten, 0);
  game.enemiesSleepUntil = Infinity;
  game.collectItem({ type: 'spooky-mask' });
  game.combatEnemies(.01, game.cat.x, game.cat.y);
  assert.equal(boss.asleep, false);
  assert.equal(boss.afraid, false);
  const before = [boss.stateTime, boss.nextFlyAt, boss.nextSwordAt, game.elapsed];
  game.pause(); game.update(30);
  assert.deepEqual([boss.stateTime, boss.nextFlyAt, boss.nextSwordAt, game.elapsed], before);
});

test('real swept combat damages only a sleeping frog with a sword and consumes its last use', () => {
  const game = arena(), boss = game.boss;
  boss.state = 'sleep'; boss.stateTime = 0;
  game.cat.x = boss.x + 65; game.cat.y = boss.y;
  game.weapon = { type: 'wood', uses: 1 };
  game.combatEnemies(.01, boss.x - 100, boss.y);
  assert.equal(boss.health, 5);
  assert.equal(game.weapon, null);
  assert.equal(game.weaponAttacks[0].type, 'wood');
});

test('post-hit contact protection lasts exactly two seconds with normalized damage progress', () => {
  const game = arena(), boss = game.boss;
  game.elapsed = 10;
  boss.state = 'sleep';
  boss.nextFlyAt = Infinity; boss.nextSwordAt = Infinity;
  game.weapon = { type: 'bronze', uses: 3 };
  assert.equal(game.hitFrog(boss), true);
  assert.equal(boss.invulnerableUntil, 12);
  assert.equal(game.enemyDamageProgress(boss), 0);
  assert.equal(game.enemyDamageProgress({ type: 'boss', invulnerableUntil: 11 }), 0,
    'other enemies retain their one-second duration');
  game.weapon = null;
  game.invulnerableUntil = 0;
  game.elapsed = 11;
  game.updateFrog(boss, 1);
  assert.equal(boss.state, 'rest', 'recovery timing is unchanged');
  assert.equal(game.enemyDamageProgress(boss), .5);
  assert.equal(game.enemyDamageProgress({ type: 'boss', invulnerableUntil: 11 }), null);
  for (const elapsed of [11, 11.999, 12]) {
    game.elapsed = elapsed;
    Object.assign(game.cat, { x: boss.x, y: boss.y, vx: 0, vy: 0 });
    game.combatEnemies(0, game.cat.x, game.cat.y);
    assert.equal(game.hearts, elapsed < 12 ? 3 : 2, `contact at ${elapsed - 10} seconds after the hit`);
  }
  assert.equal(game.enemyDamageProgress(boss), null);
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  test(`frog bounces safely away from stationary Koshi near every screen edge (${options.portrait ? 'portrait' : 'landscape'})`, () => {
    const game = arena(options), boss = game.boss;
    const camera = game.camera(), radius = boss.radius;
    const xs = [camera.x + radius, camera.x + camera.width / 2, camera.x + camera.width - radius];
    const ys = [camera.y + radius, camera.y + camera.height / 2, camera.y + camera.height - radius];
    for (const x of xs) for (const y of ys) for (const random of [0, .13, .5, .99])
      for (const [dx, dy] of [[0, 0], [-60, 0], [60, 0], [0, -60], [0, 60]]) {
      const catX = x + dx, catY = y + dy;
      if (catX < camera.x || catX > camera.x + camera.width || catY < camera.y || catY > camera.y + camera.height) continue;
      Object.assign(boss, { x, y, state: 'sleep', stateTime: 0, health: 6, invulnerableUntil: 0 });
      Object.assign(game.cat, { x: catX, y: catY, vx: 0, vy: 0 });
      game.random = () => random;
      game.elapsed = 0; game.hearts = 3; game.invulnerableUntil = 0;
      game.weapon = { type: 'bronze', uses: 3 };
      game.combatEnemies(0, catX, catY);
      assert.equal(boss.health, 5);
      assert.equal(boss.state, 'hurt');
      const target = boss.bounceTarget;
      assert.ok(target.x >= camera.x + 75 && target.x <= camera.x + camera.width - 75);
      assert.ok(target.y >= camera.y + 72 && target.y <= camera.y + camera.height - 54);
      assert.ok(Math.hypot(target.x - x, target.y - y) > radius + game.cat.radius);
      assert.ok(Math.hypot(target.x - catX, target.y - catY) > radius + game.cat.radius);
      game.elapsed = .275;
      game.combatEnemies(.275, catX, catY);
      assert.ok(Math.hypot(boss.x - x, boss.y - y) > 0, 'bounce moves rather than teleporting');
      game.elapsed = 2.01;
      game.combatEnemies(1.735, catX, catY);
      assert.equal(boss.state, 'rest');
      assert.ok(Math.hypot(boss.x - x, boss.y - y) > radius + game.cat.radius);
      assert.equal(game.hearts, 3, 'Koshi remains safe after the invulnerability expires');
    }
  });
}

test('frog bounce chooses randomized directions away from the attacking side', () => {
  const targets = [];
  for (const random of [0, .25, .5, .75]) {
    const game = arena(), boss = game.boss;
    const origin = { x: boss.x, y: boss.y };
    Object.assign(game.cat, { x: origin.x - 50, y: origin.y });
    boss.state = 'sleep'; game.weapon = { type: 'bronze', uses: 3 };
    game.random = () => random;
    assert.equal(game.hitFrog(boss), true);
    assert.ok(boss.bounceTarget.x >= origin.x);
    assert.ok(Math.hypot(boss.bounceTarget.x - game.cat.x, boss.bounceTarget.y - game.cat.y) > boss.radius + game.cat.radius);
    targets.push(`${boss.bounceTarget.x.toFixed(2)},${boss.bounceTarget.y.toFixed(2)}`);
  }
  assert.ok(new Set(targets).size > 1);
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  test(`moving Koshi makes Tom bounce randomly in the opposite half-plane (${options.portrait ? 'portrait' : 'landscape'})`, () => {
    for (const [vx, vy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const targets = new Set();
      for (const random of [0, .13, .5, .75, .999]) {
        const game = arena(options), boss = game.boss, camera = game.camera();
        const origin = { x: camera.x + camera.width / 2, y: camera.y + camera.height / 2 };
        Object.assign(boss, origin, { state: 'sleep' });
        Object.assign(game.cat, { x: origin.x - vx * 50, y: origin.y - vy * 50, vx, vy });
        game.weapon = { type: 'bronze', uses: 3 }; game.random = () => random;
        assert.equal(game.hitFrog(boss), true);
        const target = boss.bounceTarget;
        assert.ok((target.x - origin.x) * vx + (target.y - origin.y) * vy < 0);
        assert.ok(Math.hypot(target.x - game.cat.x, target.y - game.cat.y) >= boss.radius + game.cat.radius + 12);
        assert.ok(target.x >= camera.x + 75 && target.x <= camera.x + camera.width - 75);
        assert.ok(target.y >= camera.y + 72 && target.y <= camera.y + camera.height - 54);
        targets.add(`${target.x.toFixed(2)},${target.y.toFixed(2)}`);
      }
      assert.ok(targets.size > 1, `direction ${vx},${vy} remains randomized`);
    }
  });

  test(`moving Koshi cannot force Tom's bounce offscreen at an edge (${options.portrait ? 'portrait' : 'landscape'})`, () => {
    const game = arena(options), boss = game.boss, camera = game.camera();
    for (const x of [camera.x + 75, camera.x + camera.width - 75])
      for (const y of [camera.y + 72, camera.y + camera.height - 54])
        for (const [vx, vy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]])
          for (const random of [0, .5, .999]) {
      Object.assign(boss, { x, y, state: 'sleep', health: 6, invulnerableUntil: 0 });
      Object.assign(game.cat, { x, y, vx, vy });
      game.weapon = { type: 'bronze', uses: 3 }; game.random = () => random;
      assert.equal(game.hitFrog(boss), true);
      const target = boss.bounceTarget;
      assert.ok(target.x >= camera.x + 75 && target.x <= camera.x + camera.width - 75);
      assert.ok(target.y >= camera.y + 72 && target.y <= camera.y + camera.height - 54);
      assert.ok(Math.hypot(target.x - x, target.y - y) >= boss.radius + game.cat.radius + 12);
      const corners = [[camera.x + 75, camera.y + 72], [camera.x + camera.width - 75, camera.y + 72],
        [camera.x + 75, camera.y + camera.height - 54], [camera.x + camera.width - 75, camera.y + camera.height - 54]];
      if (corners.some(([cx, cy]) => (cx - x) * vx + (cy - y) * vy < 0
        && Math.hypot(cx - x, cy - y) >= boss.radius + game.cat.radius + 12)) {
        assert.ok((target.x - x) * vx + (target.y - y) * vy < 0, 'opposes movement whenever room permits');
      }
    }
  });
}

test('swept sword combat uses Koshi movement during the hit rather than his changed velocity', () => {
  const game = arena(), boss = game.boss;
  const origin = { x: boss.x, y: boss.y };
  boss.state = 'sleep';
  Object.assign(game.cat, { x: origin.x + 50, y: origin.y, vx: -100, vy: 0 });
  game.weapon = { type: 'bronze', uses: 3 };
  game.combatEnemies(0, origin.x - 100, origin.y);
  assert.equal(boss.health, 5);
  assert.ok(boss.bounceTarget.x < origin.x, 'bounce opposes the rightward swept hit');
});

test('frog practice uses the real six-hit boss battle and only completes after victory', () => {
  const { Tutorial, LESSONS } = require('../src/learning.js');
  const tutorial = new Tutorial();
  const game = tutorial.select(LESSONS.findIndex(lesson => lesson.id === 'tom-frog'));
  game.invulnerableUntil = Infinity;
  assert.equal(game.level.bossLevel, true);
  assert.equal(game.boss.type, 'tom-frog');
  assert.equal(tutorial.observe(), false);
  for (let i = 0; i < 6; i++) {
    game.boss.invulnerableUntil = 0;
    game.weapon = { type: 'bronze', uses: 3 };
    swallow(game, 1);
    assert.equal(game.hitFrog(game.boss), true);
    assert.equal(tutorial.observe(), false);
  }
  game.update(2.4);
  assert.equal(tutorial.observe(), true);
});

test('frog artwork renders five blinks, scrolling sleep pixels, captured flies, and smaller shared splashes', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const calls = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, key) { return key in target ? target[key] : (...args) => calls.push([key, ...args]); },
    set(target, key, value) { target[key] = value; calls.push(['set', key, value]); return true; },
  });
  const lines = [];
  const context = vm.createContext({ ctx, line(points, color) { lines.push(color); }, game: { height: 600 }, SLIMES });
  vm.runInContext(source.slice(source.indexOf('function drawFrogFly('), source.indexOf('function drawToasterBoss(')), context);
  const boss = { x: 400, y: 300, state: 'tongue-blink' };
  for (let blink = 0; blink < 5; blink++) {
    for (const [offset, closed] of [[.02, true], [.12, false]]) {
      calls.length = 0;
      context.drawFrogBoss({ ...boss, stateTime: blink * .2 + offset });
      assert.equal(calls.filter(call => call[0] === 'fillRect' && call[3] === 16 && call[4] === 2).length, closed ? 2 : 0);
    }
  }
  calls.length = 0;
  context.drawFrogBoss({ ...boss, state: 'sleep', stateTime: 0 });
  const first = calls.filter(call => call[0] === 'fillRect');
  calls.length = 0;
  context.drawFrogBoss({ ...boss, state: 'sleep', stateTime: .25 });
  assert.notDeepEqual(calls.filter(call => call[0] === 'fillRect'), first);
  const fills = state => {
    calls.length = 0; context.drawFrogBoss({ ...boss, ...state });
    return calls.filter(call => call[0] === 'set' && call[1] === 'fillStyle').map(call => call[2]);
  };
  const sleepShades = new Set([0, .25, .5, .75].map(stateTime => fills({ state: 'sleep', stateTime })[1]));
  assert.equal(sleepShades.size, 4, 'sleeping Tom flashes through four greens');
  assert.ok(!sleepShades.has('#879779'));
  assert.equal(fills({ state: 'rest', stateTime: 0 })[1], '#879779');
  const shape = state => {
    calls.length = 0; context.drawFrogBoss({ ...boss, ...state });
    return calls.filter(call => ['moveTo', 'lineTo'].includes(call[0])).slice(0, 18);
  };
  const standing = shape({ state: 'rest', stateTime: 0 });
  assert.notDeepEqual(shape({ state: 'jump-up', stateTime: .1 }), standing, 'hind legs crouch before the jump');
  assert.notDeepEqual(shape({ state: 'jump-up', stateTime: .3 }), standing, 'hind legs kick out during the jump');
  const fallY = stateTime => {
    calls.length = 0;
    context.drawFrogBoss({ ...boss, state: 'jump-fall', stateTime, shadow: { x: 400, y: 300 } });
    return calls.find(call => call[0] === 'translate')[2];
  };
  assert.ok(fallY(.25) < 300, 'fall animation continues past the old landing time');
  assert.equal(fallY(.325), 300, 'fall animation reaches the shadow at the new landing time');
  const rotations = walkDistance => {
    calls.length = 0; context.drawFrogBoss({ ...boss, state: 'rest', stateTime: 0, walking: true, walkDistance });
    return calls.filter(call => call[0] === 'rotate').map(call => call[1]);
  };
  assert.equal(rotations(0).length, 2);
  assert.notDeepEqual(rotations(3), rotations(9), 'arms swing while walking');
  assert.notDeepEqual(shape({ state: 'rest', stateTime: 0, walking: true, walkDistance: 3 }), standing, 'legs shuffle while walking');
  lines.length = 0;
  context.drawFrogFly(fly(100, 100));
  assert.equal(lines.filter(color => color === '#c3cacc').length, 8, 'legs and antennae are light grey');
  calls.length = 0;
  context.drawFrogFly(fly(100, 100));
  assert.ok(!calls.some(call => call[0] === 'fillText' && call[1] === '♥'));
  context.drawFrogFly({ ...fly(100, 100), carriesHeart: true });
  assert.ok(calls.some(call => call[0] === 'fillText' && call[1] === '♥' && call[2] === 100 && call[3] === 87));
  context.drawFrogTongue({ x: 400, y: 312, length: 100, angle: 0, caught: [{ ...fly(450, 312), along: 50 }] });
  context.drawFrogSlimeBall({ x: 420, y: 320, angle: 0, color: 'green' });
  calls.length = 0;
  drawPaintSplash(ctx, { age: .2, duration: .8, color: '#287dcc', scale: .45,
    x: 100, y: 100, nx: 0, ny: -1, members: [{ x: 90, y: 90, w: 100, h: 20 }] });
  assert.ok(calls.some(call => call[0] === 'scale' && call[1] === .45 && call[2] === .45));
});
