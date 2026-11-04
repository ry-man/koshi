const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, CHARACTERS, COOLDOWNS, validateCustomLevel } = require('../src/game.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const level = events => ({
  version: 1, id: 'Robo Snail test', duration: 60, goal: 1000,
  heartCost: null, brickSet: 1, events,
});

function arena(events = []) {
  const game = new Game(() => .5, { customLevel: level(events) });
  game.start();
  return game;
}

test('Robo Snail is available in custom placements and the editor, not in campaign schedules', () => {
  assert.equal(CHARACTERS['robo-snail'], 'Robo Snail');
  const custom = validateCustomLevel(level([
    { time: 0, kind: 'enemy', type: 'robo-snail', x: .9, y: .9 },
  ]));
  assert.equal(custom.events[0].type, 'robo-snail');
  assert.ok(LEVELS.every(campaign => !campaign.enemies.some(([, type]) => type === 'robo-snail')));

  const editor = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  assert.match(editor, /\['robo-snail', 'Robo Snail'\]/);
  assert.match(editor, /'robo-snail': \{ name: 'Robo Snail' \}/);
  const game = arena(custom.events);
  game.update(.01);
  assert.equal(game.robots[0].type, 'robo-snail');
});

test('Robo Snail wanders continuously at 85 units per second', () => {
  const game = arena();
  const snail = game.createCustomSpawn({ kind: 'enemy', type: 'robo-snail', x: .2, y: .2 })[0];
  snail.phase = 0;
  snail.age = 4.6;
  const { x, y } = snail;
  game.robots.push(snail);
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(snail.resting, false);
  assert.ok(Math.abs(Math.hypot(snail.x - x, snail.y - y) - 8.5) < 1e-9);
});

test('defeating Robo Snail freezes existing and new brick cooldowns for 20 seconds', () => {
  const game = arena();
  const cooling = game.bricks.find(brick => brick.kind === 'normal');
  const ready = game.bricks.find(brick => brick.id !== cooling.id && brick.kind === 'normal');
  game.elapsed = 2;
  cooling.readyAt = 10;
  ready.readyAt = 0;
  game.defeatEnemy({ type: 'robo-snail', x: 40, y: 40, radius: 19 });
  assert.equal(game.snailCooldownFreezeUntil, 22);
  assert.equal(cooling.readyAt, 30);
  assert.equal(ready.readyAt, 0, 'already-ready bricks remain ready');
  assert.equal(game.snailStreamStart, 2);
  assert.equal(game.snailStreamUntil, 22);

  game.elapsed = 5;
  const part = game.brickParts().find(item => item.id === ready.id);
  assert.equal(game.steer(ready.id, part.x + part.w / 2, part.y + part.h / 2), true);
  assert.equal(ready.readyAt, 22 + COOLDOWNS[ready.kind]);
  game.elapsed = 21;
  assert.equal(game.brickSelectable(cooling), false, 'the prior cooldown has not progressed during the freeze');
  game.elapsed = 22;
  assert.equal(game.brickSelectable(cooling), false);
  game.elapsed = 30;
  assert.equal(game.brickSelectable(cooling), true, 'the prior cooldown resumes after the freeze');
});

test('defeating another Robo Snail extends an active cooldown freeze', () => {
  const game = arena();
  const cooling = game.bricks.find(brick => brick.kind === 'normal');
  game.elapsed = 2;
  cooling.readyAt = 10;
  game.defeatEnemy({ type: 'robo-snail' });
  game.elapsed = 12;
  game.defeatEnemy({ type: 'robo-snail' });
  assert.equal(game.snailCooldownFreezeUntil, 42);
  assert.equal(cooling.readyAt, 50);
  assert.equal(game.snailStreamStart, 12);
});

test('Robo Snail cooldown freeze preserves active cooldowns through a Sunglasses expiry', () => {
  const game = arena();
  const cooling = game.bricks.find(brick => brick.kind === 'normal');
  game.elapsed = 2;
  cooling.readyAt = 10;
  game.sunglassesStart = 0;
  game.sunglassesUntil = 5;
  game.defeatEnemy({ type: 'robo-snail' });
  game.elapsed = 4.99;
  game.update(.02);
  assert.equal(game.sunglassesActive, false);
  assert.equal(cooling.readyAt, 30);
  assert.equal(game.brickSelectable(cooling), false);
});

test('Robo Snail death advances through antenna shrink, retreat, and shell split', () => {
  const game = arena();
  game.defeatEnemy({ type: 'robo-snail' });
  game.updateEnemyDeaths(.216);
  assert.ok(Math.abs(game.enemyDeaths[0].deathProgress - .24) < 1e-9);
  game.updateEnemyDeaths(.252);
  assert.ok(Math.abs(game.enemyDeaths[0].deathProgress - .52) < 1e-9);

  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ fillStyle: '', strokeStyle: '', globalAlpha: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => { operations.push([name, ...args, target.fillStyle]); };
    },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawSnailShell('), source.indexOf('function drawRoboGoalie(')), context);
  const draw = progress => {
    operations.length = 0;
    context.drawRobotBody({ type: 'robo-snail', x: 0, y: 0 }, progress);
    return operations.slice();
  };
  assert.ok(draw(.1).some(operation => operation[0] === 'fillRect' && operation.at(-1) === '#ed3139'));
  assert.ok(!draw(.3).some(operation => operation[0] === 'fillRect' && operation.at(-1) === '#ed3139'));
  assert.equal(draw(.6).filter(operation => operation[0] === 'clip').length, 4,
    'the shell separates into two independently fading halves');
});

test('Robo Snail ribbon shows alternating slugs and turtles and gets its own effect row', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1, strokeStyle: '', fillStyle: '', lineWidth: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => { operations.push([name, ...args]); };
    },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function powerupStreamRows('), source.indexOf('function robotDrawOrder('))
    + source.slice(source.indexOf('function drawSnailStream('), source.indexOf('function drawMusicStream(')), context);
  const game = {
    state: 'playing', height: 600, width: 800, elapsed: 3,
    snailStreamStart: 0, snailStreamUntil: 20, snailStreamAge: 0,
  };
  assert.equal(context.powerupStreamRows(game).snail, 300);
  context.drawSnailStream(game, 300);
  assert.ok(operations.some(operation => operation[0] === 'ellipse'), 'slug bodies and turtle shells are drawn');
  assert.ok(operations.some(operation => operation[0] === 'strokeRect'), 'the scrolling ribbon has a visible frame');
});
