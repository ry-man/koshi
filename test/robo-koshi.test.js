const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, LEVELS, CHARACTERS, validateCustomLevel, validateCutscene, SPEED } = require('../src/game.js');
const { spawnSymbol, spawnColor } = require('../src/brick-visuals.js');

const blank = () => ({ version: 1, id: 'Robo Koshi test', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [] });
function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: blank() });
  game.start();
  return game;
}

test('Robo Koshi is available in custom levels, spawners, the editor and cutscenes without changing Worlds 1-2', () => {
  const type = 'robo-koshi';
  const custom = { ...blank(),
    events: [{ time: 2, kind: 'enemy', type, x: .3, y: .7, shield: 'green' }],
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'enemy', type, shield: 'red' } }],
  };
  assert.deepEqual(validateCustomLevel(custom), custom);
  const preview = new Game(() => .5, { customLevel: custom });
  preview.start(); preview.update(2);
  assert.equal(preview.robots[0].type, type);
  assert.equal(preview.robots[0].defeatPoints, 3);
  preview.spawnFromBrick(preview.bricks.find(brick => brick.spawner));
  assert.equal(preview.robots[1].type, type);
  assert.equal(preview.robots[1].defeatPoints, 2);
  assert.equal(CHARACTERS[type], 'Robo Koshi');
  const cutscene = { theme: 'workshop', lines: [{
    speaker: type, text: 'I remember that path!', actors: [{ character: type, x: .5, y: .65 }],
  }] };
  assert.deepEqual(validateCutscene(cutscene), cutscene);
  assert.ok(spawnSymbol({ kind: 'enemy', type }).includes('M-7 -13'));
  assert.equal(spawnColor({ kind: 'enemy', type }), '#454d52');
  assert.ok(LEVELS.filter(level => ['1', '2'].includes(level.worldId)).every(level => level.enemies.every(([, enemyType]) => enemyType !== type)));

  const editor = fs.readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  assert.match(editor, /\['robo-koshi', 'Robo Koshi'\]/);
  assert.match(editor, /'robo-koshi': \{ name: 'Robo Koshi' \}/);
});

test('Robo Koshi waits one second, approaches at Koshi speed, then replays Koshi with its travel delay', () => {
  const game = arena(), enemy = game.createCustomSpawn({ kind: 'enemy', type: 'robo-koshi', x: .5, y: .5 })[0];
  const origin = { ...enemy.roboOrigin };
  enemy.x = origin.x - 200;
  game.robots = [enemy];
  game.cat.vx = 100;

  game.update(.9);
  assert.equal(enemy.x, origin.x - 200);
  game.update(.1);
  assert.equal(enemy.x, origin.x - 200);
  game.update(.25);
  assert.ok(Math.abs(enemy.x - (origin.x - 200 + SPEED * .25)) < 1e-5);
  assert.equal(enemy.roboPhase, 'approaching');

  game.update(.25);
  assert.equal(enemy.roboPhase, 'following');
  assert.ok(Math.abs(enemy.roboDelay - (1 + 200 / SPEED)) < 1e-6);
  game.update(.1);
  const expected = game.catPositionAt(game.elapsed - enemy.roboDelay);
  assert.ok(Math.abs(enemy.x - expected.x) < 1e-8);
  assert.ok(Math.abs(enemy.y - expected.y) < 1e-8);
  assert.ok(enemy.x < game.cat.x, 'the copied path trails Koshi in time');
});

test('Robo Koshi repeatedly damages Koshi who stays in contact, respecting invulnerability frames', () => {
  const game = arena(), enemy = game.createCustomSpawn({ kind: 'enemy', type: 'robo-koshi', x: .5, y: .5 })[0];
  enemy.x = game.cat.x;
  enemy.y = game.cat.y;
  game.robots = [enemy];

  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.hearts, 2);
  assert.equal(game.invulnerableUntil, 1);
  assert.equal(enemy.touching, true);
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.hearts, 2, 'overlap does not bypass active invulnerability');
  assert.equal(game.invulnerableUntil, 1, 'contact does not extend invulnerability');

  game.elapsed = game.invulnerableUntil;
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.hearts, 1, 'continued overlap hurts again once protection expires');
  assert.equal(game.invulnerableUntil, 2);

  const mouse = { ...enemy, type: 'mouse', touching: true };
  game.robots = [mouse];
  game.elapsed = game.invulnerableUntil;
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.hearts, 1, 'other enemies retain the existing one-hit-per-contact behavior');
});

test('Robo Koshi death lasts 1.1 seconds and draws extra smoke puffs', () => {
  const game = arena();
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'robo-koshi', x: .9, y: .9 })[0];
  game.defeatEnemy(enemy);
  game.updateEnemyDeaths(.55);
  assert.equal(game.enemyDeaths[0].deathProgress, .5);
  game.updateEnemyDeaths(.56);
  assert.equal(game.enemyDeaths.length, 0);

  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => operations.push([key, ...args]);
    },
    set(target, key, value) { operations.push([key, value]); target[key] = value; return true; },
  });
  const context = vm.createContext({ ctx, drawRobot: (enemyArg, progress) => operations.push(['robot', progress]) });
  const visual = vm.createContext({ ctx });
  const visualStart = source.indexOf('function drawRoboKoshi(');
  const visualEnd = source.indexOf('function drawRobotBody(', visualStart);
  vm.runInContext(source.slice(visualStart, visualEnd), visual);
  visual.drawRoboKoshi({});
  assert.ok(operations.some(operation => operation[0] === 'fillStyle' && operation[1] === '#454d52'));
  assert.equal(operations.filter(operation => operation[0] === 'fillRect' && operation[3] === 7).length, 2);
  assert.ok(operations.some(operation => operation[0] === 'lineTo' && operation[1] === 0 && operation[2] === -31));

  operations.length = 0;
  const start = source.indexOf('function drawEnemyDeath(');
  const end = source.indexOf('function resize()', start);
  vm.runInContext(source.slice(start, end), context);
  context.drawEnemyDeath({ type: 'robo-koshi', x: 20, y: 30, deathProgress: .7 });
  assert.ok(operations.some(operation => operation[0] === 'robot' && operation[1] === .7));
  assert.equal(operations.filter(operation => operation[0] === 'arc').length, 9);
});
