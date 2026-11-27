const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, ITEMS, LEVELS, validateCustomLevel, CONTACT_SURFACES } = require('../src/game.js');
const { spawnColor, spawnSymbol } = require('../src/brick-visuals.js');
const { GUIDE } = require('../src/learning.js');

const level = events => ({
  version: 1, id: 'Scrambler tests', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events,
});
const attributes = ['kind', 'crumbler', 'warped', 'toggle', 'power', 'slimeColor', 'conveyorDirection', ...CONTACT_SURFACES];

function arena(random = () => .5) {
  const game = new Game(random, { customLevel: level([]) });
  game.start();
  return game;
}

function members(game, brick) {
  return game.bricks.filter(member => member.id === brick.id || member.absorbedBy === brick.id);
}

function propertyBundle(brick) {
  return Object.fromEntries(attributes.map(attribute => [attribute, brick[attribute]]));
}

function drawScrambler() {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const gradients = [], calls = [];
  const ctx = new Proxy({}, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'createLinearGradient') return (...args) => {
        const stops = [];
        gradients.push({ args, stops });
        return { addColorStop: (...stop) => stops.push(stop) };
      };
      return (...args) => calls.push([name, ...args]);
    },
    set(target, name, value) { target[name] = value; return true; },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawScrambler('), source.indexOf('function drawChisel(')), context);
  context.drawScrambler();
  return { gradients, calls, source };
}

function drawScramblerTransition(effect, camera) {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => calls.push([name, ...args]);
    },
    set(target, name, value) { target[name] = value; return true; },
  });
  const context = vm.createContext({ ctx, Math });
  vm.runInContext(source.slice(source.indexOf('function drawScramblerTransition('),
    source.indexOf('function drawWeaponDrop(')), context);
  context.drawScramblerTransition({ scramblerEffect: effect }, camera);
  return calls;
}

test('Scrambler validates in custom levels and item spawners without campaign placement', () => {
  const custom = {
    ...level([{ time: 0, kind: 'item', type: 'scrambler', x: .5, y: .5 }]),
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'item', type: 'scrambler' } }],
  };
  assert.deepEqual(validateCustomLevel(custom), custom);
  const game = new Game(() => .5, { customLevel: custom });
  game.start();
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  assert.ok(game.items.some(item => item.type === 'scrambler'));
  assert.equal(ITEMS.scrambler.name, 'Scrambler');
  assert.equal(LEVELS.filter(campaign => campaign.worldId !== '5').some(campaign => JSON.stringify(campaign).includes('"scrambler"')), false);
  assert.ok(GUIDE.some(chapter => chapter.sections.some(section => section[2] === 'item:scrambler')));
  assert.ok(spawnSymbol({ kind: 'item', type: 'scrambler' }).includes('M0 -22'));
  assert.equal(spawnColor({ kind: 'item', type: 'scrambler' }), ITEMS.scrambler.color);
});

test('Scrambler shuffles attributes between brick groups while preserving their geometry', () => {
  const game = arena(() => 0);
  const large = game.bricks[0];
  large.warped = 10;
  game.absorbNeighbor(large);
  const groups = game.bricks.filter(brick => brick.absorbedBy === null);
  const first = groups[0], second = groups[1];
  assert.ok(members(game, first).length > 1);
  assert.equal(members(game, second).length, 1);
  const setGroup = (brick, values) => {
    for (const member of members(game, brick)) Object.assign(member, values);
  };
  setGroup(first, { kind: 'fast', crumbler: 2, usesLeft: 0, slimed: true, slimeColor: 'red' });
  setGroup(second, { kind: 'slow', springs: true, toggle: 2, toggleRemaining: 1 });
  const beforeAttributes = groups.map(brick => JSON.stringify(propertyBundle(brick))).sort();
  const geometry = game.bricks.map(({ id, x, y, w, h, absorbedBy }) => ({ id, x, y, w, h, absorbedBy }));
  first.readyAt = 20;
  second.spawned = true;

  game.collectItem({ type: 'chisel' });
  game.collectItem({ type: 'scrambler' });
  assert.equal(game.equippedItem, 'chisel', 'the immediate pickup leaves equipped tools alone');
  const effect = game.scramblerEffect;
  assert.equal(effect.opacity, 0);
  assert.equal(game.scrambleCount, 0);
  game.pause();
  game.update(.2);
  assert.equal(effect.age, 0, 'pausing freezes the fade');
  game.resume();
  game.update(effect.duration / 2);

  assert.equal(game.scrambleCount, 1);
  assert.equal(effect.opacity, 1);
  assert.equal(effect.applied, true);
  assert.equal(effect.smoke.length, 8);
  assert.equal(effect.sparkles.length, 24);
  assert.deepEqual(game.bricks.map(({ id, x, y, w, h, absorbedBy }) => ({ id, x, y, w, h, absorbedBy })), geometry);
  assert.equal(first.kind, 'slow', 'the large group receives a small brick’s attributes');
  assert.equal(first.springs, true);
  assert.ok(members(game, first).every(member => member.kind === 'slow' && member.springs));
  assert.ok(first.readyAt > 0 && first.readyAt <= game.elapsed);
  assert.equal(first.toggleRemaining, first.toggle);
  assert.equal(second.toggleRemaining, second.toggle ?? 0);
  assert.equal(second.spawned, false);
  assert.deepEqual(groups.map(brick => JSON.stringify(propertyBundle(brick))).sort(), beforeAttributes);
  game.update(effect.duration / 2);
  assert.equal(game.scramblerEffect, null);
});

test('Scrambler artwork is a shaded purple egg with a spiral face and cracked seam', () => {
  const { gradients, calls, source } = drawScrambler();
  assert.ok(gradients.some(gradient => gradient.stops.some(([, color]) => color === '#bc83df')
    && gradient.stops.some(([, color]) => color === '#321346')));
  assert.ok(calls.filter(([name]) => name === 'bezierCurveTo').length >= 15);
  assert.ok(calls.some(([name, x]) => name === 'moveTo' && x === -22));
  assert.ok(calls.some(([name]) => name === 'stroke'));
  assert.deepEqual(calls.filter(([name, x, y]) => name === 'translate' && Math.abs(x) === 8 && y === -10)
    .map(([, x]) => x).sort(), [-8, 8]);
  assert.ok(source.includes("ctx.strokeStyle = '#351643'; ctx.lineWidth = 1.4;"));
  assert.ok(source.includes("ctx.scale(.8, .8); drawScrambler();"));
  assert.match(spawnSymbol({ kind: 'item', type: 'scrambler' }), /M-4\.5 -7\.5 C-2\.7 -8\.3 -2\.7 -13\.6/);
});

test('Scrambler fade-in draws smoke, sparkles, and a light wave around the board', () => {
  const calls = drawScramblerTransition({
    duration: .72, age: .54, applied: true,
    smoke: [{ x: 100, y: 120, radius: 16, delay: 0 }],
    sparkles: [{ x: 200, y: 220, size: 3, phase: 0, delay: 0 }],
  }, { x: 0, y: 0, width: 800, height: 500 });
  assert.ok(calls.some(([name]) => name === 'ellipse'), 'smoke puffs are drawn');
  assert.ok(calls.some(([name]) => name === 'closePath'), 'sparkles are drawn');
  assert.ok(calls.some(([name]) => name === 'stroke'), 'the board-wide light wave is drawn');
});
