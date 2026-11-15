const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, CHARACTERS, INFO_GRAPHICS, validateCustomLevel } = require('../src/game.js');
const { spawnSymbol, spawnColor } = require('../src/brick-visuals.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');

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
