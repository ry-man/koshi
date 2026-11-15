const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, CHARACTERS, INFO_GRAPHICS, validateCustomLevel } = require('../src/game.js');
const { spawnSymbol, spawnColor } = require('../src/brick-visuals.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const level = events => ({
  version: 1, id: 'Robo Fly tests', duration: 60, goal: 1000,
  heartCost: null, brickSet: 1, events,
});

function arena() {
  const game = new Game(() => .5, { customLevel: level([]) });
  game.start();
  return game;
}

test('Robo Fly is available for custom placements, brick spawners, cutscenes, and editor graphics', () => {
  assert.equal(CHARACTERS['robo-fly'], 'Robo Fly');
  assert.equal(INFO_GRAPHICS['enemy:robo-fly'], 'Robo Fly');
  const custom = validateCustomLevel({
    ...level([{ time: 0, kind: 'enemy', type: 'robo-fly', x: .5, y: .5 }]),
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'enemy', type: 'robo-fly' } }],
    cutscene: { theme: 'garden', lines: [{
      speaker: 'robo-fly', text: 'Buzz.', actors: [{ character: 'robo-fly', x: .5, y: .7 }],
    }] },
  });
  assert.equal(custom.events[0].type, 'robo-fly');
  assert.equal(custom.brickTypes[0].spawner.type, 'robo-fly');
  assert.equal(custom.cutscene.lines[0].actors[0].character, 'robo-fly');
  assert.ok(LEVELS.every(campaign => !campaign.enemies.some(([, type]) => type === 'robo-fly')));

  const editor = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  assert.match(editor, /'robo-fly': \{ name: 'Robo Fly' \}/);
  assert.match(editor, /'robo-snail', 'robo-fly', 'robo-cow'/);
  assert.ok(spawnSymbol({ kind: 'enemy', type: 'robo-fly' }).length > 0);
  assert.equal(spawnColor({ kind: 'enemy', type: 'robo-fly' }), '#82989b');
});

test('Robo Fly continuously flies around the arena as a small enemy', () => {
  const game = arena();
  const fly = game.createCustomSpawn({ kind: 'enemy', type: 'robo-fly', x: .5, y: .5 })[0];
  assert.equal(fly.radius, 15);
  fly.phase = 0;
  fly.age = 0;
  const { x, y } = fly;
  game.robots.push(fly);
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(fly.resting, false);
  assert.ok(Math.abs(Math.hypot(fly.x - x, fly.y - y) - 10.5) < 1e-8);
});

test('gameplay Robo Fly follows the sketch with large dark eyes, antenna tips, white wings and six legs', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, key) { return key in target ? target[key] : (...args) => calls.push([key, ...args]); },
    set(target, key, value) { target[key] = value; calls.push(['set', key, value]); return true; },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawRoboFly('), source.indexOf('function drawRoboCrab(')), context);
  context.drawRoboFly({ age: 0 });
  assert.deepEqual(calls.filter(call => call[0] === 'arc').map(call => call.slice(1, 4)),
    [[2, -24, 2.3], [22, -19, 2.3], [5, -7, 4.2], [13, -2, 4.2]]);
  assert.equal(calls.filter(call => call[0] === 'moveTo' && [-15, -8, -1].includes(call[1]) && call[2] === 7).length, 6);
  assert.equal(calls.filter(call => call[0] === 'ellipse').length, 4, 'body, two wings and large head');
  const colors = calls.filter(call => call[0] === 'set' && call[1] === 'fillStyle').map(call => call[2]);
  for (const color of ['#303d42', '#65757a', '#84969a', '#f2f8f6']) assert.ok(colors.includes(color));
  const rotations = calls.filter(call => call[0] === 'rotate');
  calls.length = 0;
  context.drawRoboFly({ age: .02 });
  assert.notDeepEqual(calls.filter(call => call[0] === 'rotate'), rotations, 'wings flap during flight');
  calls.length = 0;
  context.drawRoboFly({ age: 0, phase: 1 }, null, '#dc626b');
  assert.ok(calls.some(call => call[0] === 'rotate' && call[1] === 1), 'drawing follows the flight direction');
  assert.ok(calls.some(call => call[0] === 'set' && call[1] === 'fillStyle' && call[2] === '#dc626b'), 'damage tint is preserved');
});
