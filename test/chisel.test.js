const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, ITEMS, LEVELS, validateCustomLevel, brickRegions } = require('../src/game.js');
const { spawnSymbol } = require('../src/brick-visuals.js');

const level = (events, extra = {}) => ({
  version: 1, id: 'Chisel tests', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events, ...extra,
});

function arena() {
  const game = new Game(() => .5, { customLevel: level([]) });
  game.start();
  return game;
}

function edgeBrick(game, edge) {
  const regions = brickRegions(game.bricks, game.width, game.height);
  return game.bricks.filter(brick => regions.get(brick.id).edge === edge)
    .sort((a, b) => Math.hypot(a.x + a.w / 2 - game.width / 2, a.y + a.h / 2 - game.height / 2)
      - Math.hypot(b.x + b.w / 2 - game.width / 2, b.y + b.h / 2 - game.height / 2))[0];
}

function mergeNeighbor(game, brick) {
  brick.warped = 10;
  game.absorbNeighbor(brick);
  brick.warped = null;
  return game.bricks.filter(member => member.id === brick.id || member.absorbedBy === brick.id);
}

test('Chisel splits the next merged brick Koshi touches and emits seam smoke', () => {
  const game = arena(), brick = edgeBrick(game, 'top');
  const members = mergeNeighbor(game, brick);
  assert.ok(members.length > 1);
  game.collectItem({ type: 'chisel' });
  assert.equal(game.chisel, true);
  assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
  for (let i = 0; i < 400 && (game.cat.vx || game.cat.vy); i++) game.update(.01);
  assert.equal(game.chisel, false);
  assert.equal(game.equippedItem, null);
  assert.ok(members.every(member => member.absorbedBy === null && member.initialOwner === null));
  assert.ok(game.brickSplits[0].seams.length > 0);
});

test('splitting copies the merged brick attributes and shared state to every piece', () => {
  const game = arena(), brick = edgeBrick(game, 'top');
  const members = mergeNeighbor(game, brick);
  Object.assign(brick, {
    kind: 'fast', crumbler: 3, warped: 10, toggle: 2, power: true,
    slimed: true, slimeColor: 'red', springs: true, spikes: true,
    conveyor: true, conveyorDirection: 'counterclockwise', portal: 'blue',
    spawner: { kind: 'item', type: 'battery' }, readyAt: 6, usesLeft: 1,
    toggleRemaining: 1, powerOn: true, spawned: true,
  });
  Object.assign(members.find(member => member.id !== brick.id), {
    kind: 'slow', slimed: false, spikes: false, spawner: null,
  });
  const expected = {
    kind: 'fast', crumbler: 3, warped: 10, toggle: 2, power: true,
    slimed: true, slimeColor: 'red', springs: true, spikes: true,
    conveyor: true, conveyorDirection: 'counterclockwise', portal: 'blue',
    spawner: { kind: 'item', type: 'battery' }, readyAt: 6, usesLeft: 1,
    toggleRemaining: 1, powerOn: true, spawned: true,
  };
  game.collectItem({ type: 'chisel' });
  assert.equal(game.splitBrick(brick), true);
  for (const member of members) {
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(member[key], value, key);
    assert.equal(member.warpUntil, null);
    assert.equal(member.absorbedBy, null);
    assert.equal(member.initialOwner, null);
  }
  assert.notEqual(members[0].spawner, members[1].spawner);
  assert.equal(game.brickSplits[0].seams.length > 0, true);
});

test('an unmerged touch does not use the Chisel, and an immediate pickup preserves it', () => {
  const game = arena(), brick = edgeBrick(game, 'top');
  game.collectItem({ type: 'chisel' });
  assert.equal(game.splitBrick(brick), false);
  assert.equal(game.chisel, true);
  game.collectItem({ type: 'battery' });
  assert.equal(game.chisel, true);
  assert.equal(game.equippedItem, 'chisel');
  assert.equal(game.batteries, 1);
  game.collectItem({ type: 'ditto-stamp' });
  assert.equal(game.chisel, false);
  assert.equal(game.dittoStamp, true);
  assert.equal(game.equippedItem, 'ditto-stamp');
});

test('Chisel art uses shaded steel and wood, with smoke drawn along split seams', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const gradients = [], calls = [];
  const ctx = new Proxy({ fillStyle: '', globalAlpha: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'createLinearGradient') return () => {
        const stops = [];
        gradients.push(stops);
        return { addColorStop: (...stop) => stops.push(stop) };
      };
      return (...args) => calls.push([name, ...args]);
    },
    set(target, name, value) { target[name] = value; return true; },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawChisel('), source.indexOf('function drawSpookyMask(')), context);
  context.drawChisel();
  assert.equal(gradients.length, 2);
  assert.ok(gradients[0].some(([, color]) => color === '#f4f3ee'));
  assert.ok(gradients[1].some(([, color]) => color === '#bd8550'));
  vm.runInContext(source.slice(source.indexOf('function drawBrickSplitSmoke('), source.indexOf('function drawWeaponDrop(')), context);
  context.drawBrickSplitSmoke({ age: .2, seams: [{ x1: 10, y1: 0, x2: 10, y2: 40 }] });
  assert.ok(calls.some(([name]) => name === 'arc'));
});

test('Chisel artwork, custom placement, and spawner support do not add it to campaign levels', () => {
  const custom = level([{ time: 0, kind: 'item', type: 'chisel', x: .5, y: .5 }]);
  assert.deepEqual(validateCustomLevel(custom), custom);
  const game = new Game(() => .5, {
    customLevel: level([], { brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'item', type: 'chisel' } }] }),
  });
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  assert.equal(game.items[0].type, 'chisel');
  assert.equal(ITEMS.chisel.name, 'Chisel');
  assert.ok(spawnSymbol({ kind: 'item', type: 'chisel' }).includes('M-25 -18'));
  assert.ok(LEVELS.every(campaign => !(campaign.items ?? []).some(([, type]) => type === 'chisel')
    && !(campaign.events ?? []).some(event => event.kind === 'item' && event.type === 'chisel')
    && !campaign.brickTypes.some(brick => brick.spawner?.kind === 'item' && brick.spawner.type === 'chisel')));
});
