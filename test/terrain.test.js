const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, validateCustomLevel } = require('../src/game.js');
const { drawTerrain, terrainPathData, drawSurfBoard, drawIceSkate, drawWaterSplash } = require('../src/brick-visuals.js');

const blank = () => ({ version: 1, id: 'Terrain', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [] });
const region = (type, left = .4, top = .3, right = .6, bottom = .7, id = `terrain-${type}`) => ({
  id, type, nodes: [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }],
});

function arena(terrains, x = .5, y = .5) {
  const game = new Game(() => .5, { customLevel: { ...blank(), terrains } });
  Object.assign(game.cat, { ...game.pointFromRelative(x, y), vx: 0, vy: 0 });
  game.start();
  return game;
}

function brickToward(game, direction) {
  return game.bricks.filter(brick => direction === 'right' ? brick.x > game.cat.x : brick.x + brick.w < game.cat.x)
    .sort((a, b) => Math.hypot(a.x + a.w / 2 - game.cat.x, a.y + a.h / 2 - game.cat.y)
      - Math.hypot(b.x + b.w / 2 - game.cat.x, b.y + b.h / 2 - game.cat.y))[0];
}

function clickBrick(game, brick) {
  return game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2);
}

test('terrain JSON is optional, round-trips valid polygons and rejects malformed or overlapping regions', () => {
  const oldLevel = blank();
  assert.deepEqual(validateCustomLevel(oldLevel), oldLevel);
  assert.equal(Object.hasOwn(validateCustomLevel(oldLevel), 'terrains'), false);
  const source = { ...blank(), terrains: [region('ice'), region('water', .7, .3, .9, .7)] };
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(source))), source);
  for (const terrains of [
    null,
    [region('mud')],
    [region('ice', .2, .2, .2, .8)],
    [region('ice'), region('water', .6, .3, .8, .7)],
    [region('ice'), region('water', .45, .45, .55, .55)],
    [region('ice', .2, .2, .8, .8, 'same'), region('water', .1, .1, .3, .3, 'same')],
    [{ ...region('ice'), nodes: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }] }],
  ]) assert.throws(() => validateCustomLevel({ ...blank(), terrains }), /Terrain:/);
});

test('terrain coordinates map to the board in landscape and portrait', () => {
  for (const options of [{}, { portrait: true, scale: .5 }]) {
    const game = new Game(() => .5, { customLevel: { ...blank(), terrains: [region('ice')] }, ...options });
    const inside = game.campaignEventPoint(.5, .5);
    const outside = game.campaignEventPoint(.9, .9);
    assert.equal(game.terrainAt(inside.x, inside.y).type, 'ice');
    assert.equal(game.terrainAt(outside.x, outside.y), null);
  }
});

test('ice allows the first steering choice while stopped, then defers new choices until exit', () => {
  const game = arena([region('ice')]);
  const first = brickToward(game, 'right');
  assert.ok(first);
  assert.equal(clickBrick(game, first), true);
  assert.notEqual(game.cat.vx, 0);
  assert.equal(game.iceDirectionLocked, true);

  const previous = { vx: game.cat.vx, vy: game.cat.vy };
  const next = brickToward(game, 'left');
  assert.ok(next);
  assert.equal(clickBrick(game, next), true);
  assert.deepEqual(game.iceSteer, { id: next.id, x: next.x + next.w / 2, y: next.y + next.h / 2 });
  assert.deepEqual({ vx: game.cat.vx, vy: game.cat.vy }, previous);
  assert.equal(game.moves, 1, 'queued choices do not activate a brick before Koshi leaves ice');

  const moving = arena([region('ice')]);
  const target = brickToward(moving, 'right');
  moving.cat.vx = 120;
  moving.iceDirectionLocked = true;
  assert.equal(clickBrick(moving, target), true);
  assert.ok(moving.iceSteer);
  moving.update(1);
  assert.equal(moving.terrainAt(moving.cat.x, moving.cat.y), null);
  assert.equal(moving.iceSteer, null);
  assert.equal(moving.moves, 1, 'the queued choice takes effect as soon as Koshi exits ice');
});

test('water sinks and reappears outside before damaging; lava sinks before killing', () => {
  const water = arena([region('water', .48, .3, .52, .7)], .47, .5);
  const entryX = water.pointFromRelative(.48, .5).x;
  water.cat.vx = 200;
  water.update(.06);
  assert.equal(water.state, 'playing');
  assert.ok(water.terrainImpact);
  assert.equal(water.hearts, 3);
  assert.ok(water.cat.x >= entryX - 1);
  assert.equal(clickBrick(water, brickToward(water, 'right')), false, 'steering is locked while submerged');
  water.update(.3);
  assert.equal(water.hearts, 3, 'damage waits until Koshi reappears');
  assert.equal(water.terrainImpact.reappeared, false);
  water.update(.12);
  assert.equal(water.terrainImpact.reappeared, true);
  assert.equal(water.hearts, 2);
  assert.ok(water.cat.x < entryX);
  assert.equal(water.terrainAt(water.cat.x, water.cat.y), null);
  assert.equal(water.invulnerable, true, 'invulnerability starts with the reappearance damage');
  water.update(.22);
  assert.equal(water.terrainImpact, null);
  assert.equal(water.state, 'playing');

  const fatalWater = arena([region('water', .48, .3, .52, .7)], .47, .5);
  fatalWater.hearts = 1;
  fatalWater.cat.vx = 200;
  fatalWater.update(.5);
  assert.equal(fatalWater.state, 'lost', 'water damage can trigger the ordinary defeat sequence on reappearance');

  const lava = arena([region('lava', .48, .3, .52, .7)], .4, .5);
  lava.cat.vx = 200;
  lava.update(.5);
  assert.equal(lava.state, 'playing', 'lava waits for the sink animation');
  assert.equal(lava.hearts, 3);
  lava.update(.4);
  assert.equal(lava.state, 'lost');
  assert.equal(lava.hearts, 0);
  assert.equal(lava.tookDamage, true);
});

test('an obstruction stopping Koshi on ice releases steering and applies queued redirects', () => {
  for (const queued of [false, true]) {
    const game = arena([region('ice', .2, .2, .8, .8)]);
    game.obstructions.push({ type: 'obstruction-rectangle', x: game.cat.x + 70,
      y: game.cat.y, width: 30, height: 160 });
    const left = brickToward(game, 'left');
    game.cat.vx = 200;
    game.iceDirectionLocked = true;
    if (queued) assert.equal(clickBrick(game, left), true);
    game.update(.5);
    assert.equal(game.terrainAt(game.cat.x, game.cat.y)?.type, 'ice');
    if (!queued) {
      assert.equal(game.cat.vx, 0, 'fully blocked motion must not leave a stale velocity');
      assert.equal(game.iceDirectionLocked, false);
      assert.equal(clickBrick(game, left), true);
    }
    assert.ok(game.cat.vx < 0, 'Koshi can move away from the obstruction while still on ice');
    assert.equal(game.iceSteer, null);
  }
});

test('Surf Boards cross water safely until their color-specific timer expires, but never protect against lava', () => {
  for (const [type, duration] of [['surf-board-red', 5], ['surf-board-green', 15], ['surf-board-blue', 30]]) {
    const game = arena([region('water', .48, .3, .7, .7)], .47, .5);
    game.collectItem({ type });
    game.cat.vx = 200;
    game.update(.3);
    assert.equal(game.terrainAt(game.cat.x, game.cat.y)?.type, 'water');
    assert.equal(game.hearts, 3);
    assert.equal(game.terrainImpact, null);
    game.cat.vx = 0;
    game.elapsed = duration - .1;
    game.pause();
    game.update(.5);
    assert.equal(game.surfBoardActive, true, 'pause does not spend board time');
    game.resume();
    game.update(.05);
    assert.equal(game.terrainImpact, null);
    game.update(.1);
    assert.equal(game.surfBoardActive, false);
    assert.equal(game.terrainImpact?.type, 'water', 'expiry while on water starts sinking');
  }
  const lava = arena([region('lava')]);
  lava.collectItem({ type: 'surf-board-blue' });
  lava.update(.01);
  assert.equal(lava.terrainImpact?.type, 'lava');
});

test('a new Surf Board replaces its own timer, stacks with held gear and resets with the level', () => {
  const game = arena([]);
  game.collectItem({ type: 'chisel' });
  game.weapon = { type: 'gold', uses: 10, expires: Infinity };
  game.collectItem({ type: 'kitty-cape' });
  game.collectItem({ type: 'surf-board-blue' });
  game.update(1);
  game.collectItem({ type: 'surf-board-red' });
  assert.equal(game.surfBoard.type, 'surf-board-red');
  assert.ok(Math.abs(game.surfBoard.expires - game.elapsed - 5) < 1e-9);
  assert.equal(game.equippedItem, 'chisel');
  assert.equal(game.weapon.type, 'gold');
  assert.equal(game.capeActive, true);
  assert.equal(game.timeBonus, 0, 'surf timers do not add time to the level');
  game.reset();
  assert.equal(game.surfBoardActive, false);
  assert.equal(game.surfBoard, null);
});

test('Surf Board color drains continuously along its length to white with an integer label', () => {
  const sample = (fraction, sideView = false) => {
    const fills = [], labels = [];
    const ctx = new Proxy({}, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'fillRect') return (...args) => fills.push([target.fillStyle, ...args]);
        if (key === 'fillText') return (...args) => labels.push(args);
        return () => {};
      },
    });
    drawSurfBoard(ctx, '#ed5555', fraction, '3', sideView);
    return { fills, labels };
  };
  assert.deepEqual(sample(.5).fills, [['#ffffff', -24, -39, 48, 76], ['#ed5555', -24, -1, 48, 38]]);
  assert.equal(sample(.375).fills[1][4], 76 * .375, 'meter uses continuous remaining time, not the rounded label');
  assert.equal(sample(0).fills[1][4], 0, 'no color remains at expiry');
  assert.deepEqual(sample(.5).labels, [['3', 0, 27]]);
  assert.deepEqual(sample(.5, true).fills,
    [['#ffffff', -32, -8, 64, 15], ['#ed5555', 0, -8, 32, 15]],
    'ridden board is a horizontal side-view meter that turns white from left to right');
  assert.equal(sample(.375, true).fills[1][3], 64 * .375, 'side view preserves continuous timer fill');
  assert.equal(sample(0, true).fills[1][3], 0);
  assert.deepEqual(sample(.5, true).labels, [['3', 0, 1]], 'countdown is centered inside the ridden board');
});

test('the ridden Surf Board deck touches the bottom of Koshi at different body sizes', () => {
  const app = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const source = app.slice(app.indexOf('  drawTerrainAffected(() => {'), app.indexOf('  for (const turret of game.turretFades)'));
  const game = arena([]);
  game.collectItem({ type: 'surf-board-red' });
  let offsetY = 0;
  const deckHeights = [];
  const ctx = new Proxy({
    translate(_x, y) { offsetY += y; },
    lineTo(x, y) { if (x === 16 && y === -3) deckHeights.push(offsetY + y); },
  }, {
    get(target, key) { return key in target ? target[key] : () => {}; },
  });
  const context = vm.createContext({
    game, ctx, ITEMS: { 'surf-board-red': { color: '#ed5555', surfSeconds: 5 } },
    drawSurfBoard, drawTerrainAffected: draw => draw(), drawWornCape() {},
  });
  for (const radius of [21, 12]) {
    game.cat.radius = radius;
    offsetY = 0;
    deckHeights.length = 0;
    vm.runInContext(source, context);
    assert.deepEqual(deckHeights, [game.cat.y + radius], 'board deck meets the body without a gap');
  }
});

test('Ice Skates redirect immediately on ice and restore the ice lock at each color deadline', () => {
  for (const [type, duration] of [['ice-skate-red', 5], ['ice-skate-green', 15], ['ice-skate-blue', 30]]) {
    const game = arena([region('ice', .2, .2, .8, .8)]);
    game.cat.vx = 120;
    game.iceDirectionLocked = true;
    game.collectItem({ type });
    const left = brickToward(game, 'left');
    assert.equal(clickBrick(game, left), true);
    assert.ok(game.cat.vx < 0, 'redirect happens immediately rather than queuing on ice');
    assert.equal(game.iceSteer, null);
    assert.equal(game.moves, 1);
    game.pause();
    game.update(1);
    assert.equal(game.iceSkate.expires, duration);
    assert.equal(game.elapsed, 0);
    game.resume();
    game.elapsed = duration - .02;
    game.update(.04);
    assert.equal(game.iceSkateActive, false);
    assert.equal(game.iceDirectionLocked, true);
    const velocity = { vx: game.cat.vx, vy: game.cat.vy };
    assert.equal(clickBrick(game, brickToward(game, 'right')), true);
    assert.ok(game.iceSteer, 'after expiry, redirects are queued again');
    assert.deepEqual({ vx: game.cat.vx, vy: game.cat.vy }, velocity);
  }
});

test('Ice Skates refresh independently of Surf Boards and equipped tools and never protect against water or lava', () => {
  const game = arena([]);
  game.collectItem({ type: 'chisel' });
  game.collectItem({ type: 'surf-board-blue' });
  game.collectItem({ type: 'ice-skate-blue' });
  game.update(1);
  game.collectItem({ type: 'ice-skate-red' });
  assert.equal(game.iceSkate.type, 'ice-skate-red');
  assert.ok(Math.abs(game.iceSkate.expires - game.elapsed - 5) < 1e-9);
  assert.equal(game.surfBoard.type, 'surf-board-blue');
  assert.equal(game.surfBoard.expires, 30);
  assert.equal(game.equippedItem, 'chisel');
  assert.equal(game.timeBonus, 0);
  game.reset();
  assert.equal(game.iceSkate, null);
  assert.equal(game.iceSkateActive, false);
  for (const type of ['water', 'lava']) {
    const hazard = arena([region(type)]);
    hazard.collectItem({ type: 'ice-skate-blue' });
    hazard.update(.01);
    assert.equal(hazard.terrainImpact?.type, type);
  }
});

test('the Ice Skate has a body-width opening and extended toe with a number-only color timer', () => {
  const sample = fraction => {
    const fills = [], labels = [], paths = [];
    const ctx = new Proxy({}, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'fillRect') return (...args) => fills.push([target.fillStyle, ...args]);
        if (key === 'fillText') return (...args) => labels.push(args);
        if (key === 'moveTo' || key === 'lineTo') return (...args) => paths.push(args);
        if (key === 'quadraticCurveTo') return (...args) => {
          paths.push(args.slice(0, 2), args.slice(2));
        };
        return () => {};
      },
    });
    drawIceSkate(ctx, '#519eff', fraction, '12');
    return { fills, labels, paths };
  };
  assert.deepEqual(sample(.5).fills.slice(0, 2),
    [['#ffffff', -22, 2, 55, 18], ['#519eff', -22, 11, 55, 9]]);
  assert.equal(sample(.375).fills[1][4], 18 * .375, 'boot drains using fractional time');
  assert.equal(sample(0).fills[1][4], 0);
  assert.deepEqual(sample(.5).labels, [['12', -6, 12]]);
  const { paths } = sample(1);
  assert.ok(paths.every(([x, y]) => x >= -23 && x <= 34 && y >= 1 && y <= 26),
    'boot and blade stay close to the circular body bottom with room for the toe');
  assert.deepEqual(paths.slice(0, 2), [[-21, 2], [21, 2]],
    'opening matches the body diameter immediately below the eyes');
  assert.ok(paths.some(([x, y]) => x === 32 && y === 17), 'toe projects beyond the body at the bottom');
});

test('water falls throw up a large plume and droplets at the entry point, then fade away', () => {
  const sample = (type, age) => {
    const calls = [];
    const ctx = new Proxy({ globalAlpha: 1 }, {
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => calls.push([key, ...args]);
      },
    });
    drawWaterSplash(ctx, { type, age, x: 120, y: 180 });
    return calls;
  };
  const rising = sample('water', .25);
  assert.ok(rising.some(([method, x, y]) => method === 'translate' && x === 120 && y === 180));
  assert.ok(rising.some(([method, , y]) => method === 'lineTo' && y < -50), 'plume rises above Koshi');
  assert.equal(rising.filter(([method]) => method === 'ellipse').length, 13, 'droplets surround an expanding ripple');
  assert.notDeepEqual(rising, sample('water', .4), 'splash geometry animates');
  assert.deepEqual(sample('water', .6), []);
  assert.deepEqual(sample('lava', .25), [], 'lava does not produce a water splash');
  const game = arena([region('water')]);
  game.update(.1);
  const age = game.terrainImpact.age;
  game.pause();
  game.update(.3);
  assert.equal(game.terrainImpact.age, age, 'pause freezes the splash clock together with sinking');
});

test('terrain art uses rounded clipped textures and lava waves move at half the water speed', () => {
  const sample = (type, time) => {
    const strokes = [], waves = [], fills = [];
    let clipping = false, currentPath = [];
    const context = {
      globalAlpha: 1, save() {}, restore() {}, beginPath() { currentPath = []; },
      moveTo(x, y) { currentPath.push(['M', x, y]); },
      lineTo(x, y) { currentPath.push(['L', x, y]); },
      quadraticCurveTo(...coordinates) { currentPath.push(['Q', ...coordinates]); },
      closePath() {}, clip() { clipping = true; },
      createLinearGradient() { return { addColorStop() {} }; },
      fill() { fills.push(this.globalAlpha); },
      stroke() {
        strokes.push([this.strokeStyle, this.lineWidth]);
        if (clipping && currentPath.length) waves.push(currentPath);
      },
      arc() {},
    };
    drawTerrain(context, { type, path: { nodes: [
      { x: 10, y: 10 }, { x: 180, y: 10 }, { x: 180, y: 120 }, { x: 10, y: 120 },
    ] } }, time);
    return { strokes, waves, fills };
  };
  const water = sample('water', 1);
  const stillWater = sample('water', 0);
  const halfSpeedLava = sample('lava', 2);
  assert.ok(terrainPathData([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]).includes('Q'));
  assert.ok(water.strokes.length > 1, 'surface texture adds strokes beyond the outline');
  assert.notDeepEqual(water.waves, stillWater.waves, 'water waves animate');
  assert.deepEqual(water.waves, halfSpeedLava.waves, 'lava wave phase advances at half water speed');
  assert.equal(sample('ice', 0).fills[0], .42, 'ice base remains semi-transparent');
});

test('editor exposes Terrain authoring controls and preserves overlap validation', () => {
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  assert.match(html, /id="terrain-panel"/);
  assert.match(html, /id="terrain-choice"/);
  assert.match(html, /id="terrain-type"/);
  assert.match(source, /activeCategory === 'terrain'/);
  assert.match(source, /Terrain vertices inside the playable area/);
  assert.match(source, /terrain-region-texture/);
  assert.match(source, /terrain-pattern-/);

  const nodes = new Map(), errors = [];
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', listeners: {}, addEventListener(type, handler) {
      this.listeners[type] = handler;
    } });
    return nodes.get(selector);
  };
  const context = vm.createContext({
    $, level: blank(), selectedTerrainId: '', terrainDrawing: false,
    terrainDrawNodes: region('ice').nodes, selectedTerrainNode: -1,
    readOnly: () => false, validateDraft: validateCustomLevel,
    attempt: action => { try { action(); } catch (error) { errors.push(error.message); } },
    markChanged() {}, render() {}, renderBoard() {}, message() {},
  });
  vm.runInContext(source.slice(source.indexOf('function populateTerrainForm('), source.indexOf("$('#track-choice').addEventListener")), context);
  $('#terrain-type').value = 'ice';
  $('#terrain-form').listeners.submit({ preventDefault() {} });
  assert.equal(context.level.terrains[0].id, 'terrain-1');
  const before = JSON.stringify(context.level);
  context.selectedTerrainId = '';
  context.terrainDrawNodes = region('water', .5, .4, .7, .6).nodes;
  $('#terrain-form').listeners.submit({ preventDefault() {} });
  assert.equal(JSON.stringify(context.level), before, 'overlapping terrain drafts are rejected without changing the saved level');
  assert.match(errors.at(-1), /cannot overlap or touch/);
});
