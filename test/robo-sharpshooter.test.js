const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, LEVELS, CHARACTERS, SHARPSHOOTER_BOW, validateCustomLevel } = require('../src/game.js');
const { spawnSymbol } = require('../src/brick-visuals.js');
const { Tutorial, LESSONS } = require('../src/learning.js');

const level = events => ({
  version: 1, id: 'Sharpshooter tests', duration: 60, goal: 1000,
  heartCost: null, brickSet: 1, events,
});
function arena() {
  const game = new Game(() => .5, { customLevel: level([]) });
  game.start();
  return game;
}
function shooter(game) {
  return game.createCustomSpawn({ kind: 'enemy', type: 'robo-sharpshooter', x: .5, y: .5 })[0];
}

test('Sharpshooter is available in custom placements, spawners, guide and practice, not campaign levels', () => {
  const custom = { ...level([{ time: 0, kind: 'enemy', type: 'robo-sharpshooter', x: .5, y: .5, shield: 'green' }]),
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'enemy', type: 'robo-sharpshooter', shield: 'red' } }] };
  assert.deepEqual(validateCustomLevel(custom), custom);
  assert.equal(CHARACTERS['robo-sharpshooter'], 'Robo Sharpshooter');
  assert.ok(spawnSymbol({ kind: 'enemy', type: 'robo-sharpshooter' }));
  assert.ok(LEVELS.every(entry => entry.enemies.every(([, type]) => type !== 'robo-sharpshooter')));
  const game = new Game(() => .5, { customLevel: custom }); game.start();
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  assert.equal(game.robots.at(-1).type, 'robo-sharpshooter');
  assert.equal(game.robots.at(-1).defeatPoints, 2);
  const tutorial = new Tutorial(); tutorial.select(LESSONS.findIndex(lesson => lesson.id === 'robo-sharpshooter'));
  assert.ok(tutorial.game.robots.some(enemy => enemy.type === 'robo-sharpshooter'));
});

test('wander, pause, one-second glimmer and three independently aimed shots repeat', () => {
  const game = arena(), enemy = shooter(game);
  game.cat.x = enemy.x - 100; game.cat.y = enemy.y + 11;
  game.initializeSharpshooter(enemy);
  const start = enemy.x;
  game.updateSharpshooter(enemy, 2);
  assert.ok(enemy.x > start);
  assert.equal(enemy.sharpshooterState, 'pause');
  const position = [enemy.x, enemy.y];
  game.updateSharpshooter(enemy, .5);
  assert.equal(enemy.sharpshooterState, 'glimmer');
  game.updateSharpshooter(enemy, .99);
  assert.deepEqual([enemy.x, enemy.y], position);
  assert.equal(game.sharpshooterArrows.length, 0);
  game.updateSharpshooter(enemy, .01);
  assert.equal(game.sharpshooterArrows.length, 1);
  assert.ok(Math.abs(game.sharpshooterArrows[0].angle - Math.atan2(game.cat.y - enemy.y - 11, game.cat.x - enemy.x - enemy.bowX)) < 1e-8);
  game.cat.x = enemy.x + 18; game.cat.y = enemy.y + 100;
  game.random = () => 1;
  game.updateSharpshooter(enemy, .3);
  assert.ok(Math.abs(game.sharpshooterArrows[1].angle - (Math.PI / 2 + .08)) < 1e-8);
  game.random = () => 0;
  game.updateSharpshooter(enemy, .3);
  assert.ok(Math.abs(game.sharpshooterArrows[2].angle - (Math.PI / 2 - .08)) < 1e-8);
  assert.equal(enemy.sharpshooterState, 'wander');
  assert.equal(enemy.sharpshooterShots, 0);
  assert.equal(enemy.aimAngle, game.sharpshooterArrows[2].angle);
});

test('arrows emerge from the crossbow tip and aim from the bow in every direction', () => {
  for (const [dx, dy] of [[100, 0], [0, 100], [-100, 0], [0, -100], [100, 100]]) {
    const game = arena(), enemy = shooter(game);
    enemy.bowX = dx < 0 ? -18 : 18;
    const bowX = enemy.x + enemy.bowX, bowY = enemy.y + 11;
    game.cat.x = bowX + dx; game.cat.y = bowY + dy;
    game.random = () => .5;
    enemy.sharpshooterState = 'glimmer'; enemy.sharpshooterTime = .99;
    game.updateSharpshooter(enemy, .01);
    const arrow = game.sharpshooterArrows[0], angle = Math.atan2(dy, dx);
    assert.ok(Math.abs(arrow.angle - angle) < 1e-9);
    assert.ok(Math.abs(arrow.x + 15 * Math.cos(angle) - (bowX + 31 * Math.cos(angle))) < 1e-9);
    assert.ok(Math.abs(arrow.y + 15 * Math.sin(angle) - (bowY + 31 * Math.sin(angle))) < 1e-9);
    assert.equal(enemy.aimAngle, angle);
  }
});

test('arrows cannot skip Koshi or a barrier between the bow and the spawned projectile', () => {
  for (const blocked of [false, true]) {
    const game = arena(), enemy = shooter(game);
    enemy.bowX = 18;
    const bowX = enemy.x + 18, bowY = enemy.y + 11;
    game.cat.x = bowX + (blocked ? 100 : 10); game.cat.y = bowY;
    if (blocked) game.barrierParts = () => [{ x: bowX + 8, y: bowY - 30, w: 2, h: 60 }];
    enemy.sharpshooterState = 'glimmer'; enemy.sharpshooterTime = .99;
    game.updateSharpshooter(enemy, .01);
    game.updateHazardDamage(.01, [], game.cat.x, game.cat.y);
    assert.equal(game.sharpshooterArrows.length, 0);
    assert.equal(game.hearts, blocked ? 3 : 2);
  }
});

test('crossbow moves smoothly between mirrored sides and fires from its position during a switch', () => {
  const game = arena(), enemy = shooter(game);
  enemy.bowX = 18; enemy.sharpshooterState = 'glimmer'; enemy.sharpshooterTime = 0;
  game.cat.x = enemy.x - 100; game.cat.y = enemy.y + 11;
  game.updateSharpshooter(enemy, .1);
  assert.ok(Math.abs(enemy.bowX - 3.6) < 1e-9);
  game.updateSharpshooter(enemy, .15);
  assert.ok(Math.abs(enemy.bowX + 18) < 1e-9);
  game.cat.x = enemy.x + 100;
  game.updateSharpshooter(enemy, .1);
  assert.ok(Math.abs(enemy.bowX + 3.6) < 1e-9);
  game.updateSharpshooter(enemy, .15);
  assert.ok(Math.abs(enemy.bowX - 18) < 1e-9);

  game.cat.x = enemy.x - 100;
  enemy.sharpshooterState = 'shoot'; enemy.sharpshooterTime = .29; enemy.sharpshooterShots = 2;
  game.updateSharpshooter(enemy, .01);
  const arrow = game.sharpshooterArrows[0];
  assert.ok(enemy.bowX > -18 && enemy.bowX < 18);
  assert.ok(Math.abs(arrow.launchX - enemy.x - enemy.bowX) < 1e-9);
  assert.ok(Math.abs(arrow.x + 15 * Math.cos(arrow.angle) - arrow.launchX - 31 * Math.cos(arrow.angle)) < 1e-9);
  assert.equal(enemy.aimAngle, arrow.angle);
  assert.equal(enemy.sharpshooterState, 'wander');
});

test('arrows use swept collision, stop at obstacles and respect damage protection', () => {
  const game = arena();
  const y = game.cat.y, x = game.cat.x;
  const arrow = () => ({ x: x - 100, y, vx: 260, vy: 0, angle: 0, radius: 3 });
  game.sharpshooterArrows = [arrow()];
  game.updateHazardDamage(.5, [], x, y);
  assert.equal(game.hearts, 2);
  assert.equal(game.sharpshooterArrows.length, 0);
  game.sharpshooterArrows = [arrow()];
  game.updateHazardDamage(.5, [], x, y);
  assert.equal(game.hearts, 2);
  game.sharpshooterArrows = [arrow()];
  game.barrierParts = () => [{ x: x - 50, y: y - 30, w: 4, h: 60 }];
  game.updateHazardDamage(.5, [], x, y);
  assert.equal(game.sharpshooterArrows.length, 0);
  assert.equal(game.hearts, 2);
});

test('sleep, fear, pause and defeat integrate with normal robot lifecycle', () => {
  const game = arena(), enemy = shooter(game);
  game.cat.x = game.bounds().left; game.cat.y = game.bounds().top;
  game.robots = [enemy];
  enemy.bowX = 18;
  enemy.sharpshooterState = 'glimmer'; enemy.sharpshooterTime = .8;
  game.collectItem({ type: 'music-box' }); game.update(.5);
  assert.equal(enemy.sharpshooterTime, .8);
  assert.equal(enemy.bowX, 18);
  game.enemiesSleepUntil = 0;
  game.collectItem({ type: 'spooky-mask' }); game.update(.5);
  assert.equal(game.sharpshooterArrows.length, 0);
  game.pause(); const position = [enemy.x, enemy.y]; game.update(1);
  assert.deepEqual([enemy.x, enemy.y], position);
  assert.equal(enemy.bowX, 18);
  game.resume(); game.maskUntil = game.elapsed;
  game.weapon = { type: 'silver', uses: 5, expires: Infinity };
  game.cat.x = enemy.x; game.cat.y = enemy.y;
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.enemies, 1);
  assert.equal(game.enemyDeaths[0].type, 'robo-sharpshooter');
  game.pause(); game.update(.5); assert.equal(game.enemyDeaths[0].deathProgress, 0);
  game.resume(); game.update(.75);
  assert.ok(Math.abs(game.enemyDeaths[0].deathProgress - .5) < 1e-6);
  game.reset(); assert.equal(game.sharpshooterArrows.length, 0);
});

test('rendering shows glimmer, flying glasses, split body and explosion', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (key === 'createLinearGradient') return (...args) => {
        operations.push(['gradient', ...args]);
        return { addColorStop: (...stop) => operations.push(['stop', ...stop]) };
      };
      return (...args) => operations.push([key, ...args]);
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  const context = vm.createContext({ ctx, SHARPSHOOTER_BOW, isBossType: () => false,
    drawRobot: (enemy, progress) => context.drawRoboSharpshooter(enemy, progress) });
  vm.runInContext(source.slice(source.indexOf('function drawRoboSharpshooter('), source.indexOf('function resize()')), context);
  for (const [bowX, angle] of [[18, 0], [-18, Math.PI], [0, Math.PI / 2], [18, -Math.PI / 2]]) {
    operations.length = 0;
    context.drawRoboSharpshooter({ bowX, aimAngle: angle });
    const anchor = operations.findIndex(op => op[0] === 'translate' && op[1] === bowX && op[2] === 11);
    const circle = operations.findIndex(op => op[0] === 'arc' && op[1] === 0 && op[2] === 4 && op[3] === 4);
    const mouth = operations.findIndex(op => op[0] === 'moveTo' && op[1] === -7 && op[2] === 10);
    assert.ok(mouth >= 0 && anchor > mouth && circle > anchor, 'the bow is drawn in front of the body');
    assert.deepEqual(operations[anchor + 1], ['rotate', angle + Math.PI / 2]);
    assert.deepEqual(operations[anchor + 2], ['translate', 0, -4], 'the yellow circle stays at the anchor as the bow rotates');
    assert.ok(operations.some(op => op[0] === 'moveTo' && op[1] === 0 && op[2] === -27), 'loaded arrow tip lies 31 units from the yellow circle');
  }
  for (const time of [.1, .5, .9]) {
    operations.length = 0;
    context.drawRoboSharpshooter({ sharpshooterState: 'glimmer', sharpshooterTime: time });
    const gradient = operations.find(op => op[0] === 'gradient');
    assert.ok(gradient, 'glimmer uses a gradient');
    assert.ok(gradient[1] < gradient[3] && gradient[2] !== gradient[4], 'the band is diagonal');
    assert.ok(Math.abs((gradient[1] + gradient[3]) / 2 - (-42 + 84 * time)) < 1e-9);
    assert.ok(operations.findIndex(op => op[0] === 'clip') < operations.findIndex(op => op[0] === 'gradient'));
    assert.ok(operations.some(op => op[0] === 'stop' && op[2] === '#ffc4e6ee'));
    assert.ok(operations.some(op => op[0] === 'fillRect' && op[1] === -22 && op[2] === -13 && op[3] === 44 && op[4] === 13));
  }
  for (const enemy of [{ sharpshooterState: 'pause' }, { sharpshooterState: 'glimmer', asleep: true },
    { sharpshooterState: 'glimmer', afraid: true }]) {
    operations.length = 0;
    context.drawRoboSharpshooter(enemy);
    assert.ok(!operations.some(op => op[0] === 'gradient'));
  }
  operations.length = 0;
  context.drawEnemyDeath({ type: 'robo-sharpshooter', deathProgress: .8, x: 0, y: 0 });
  assert.ok(operations.some(op => op[0] === 'clip'));
  assert.ok(operations.findIndex(op => op[0] === 'arc' && op[1] === 0 && op[2] === 4 && op[3] === 4)
    > operations.findIndex(op => op[0] === 'moveTo' && op[1] === -7 && op[2] === 10), 'the bow remains in front during defeat');
  assert.ok(operations.some(op => op[0] === 'translate' && op[1] > 10 && op[2] < -20));
  assert.ok(operations.some(op => op[0] === 'createRadialGradient') || operations.some(op => op[0] === 'fillRect' && op[3] > 50));
});
