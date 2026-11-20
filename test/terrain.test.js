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
  game.update(.001);

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
  moving.update(.001);
  assert.equal(moving.moves, 1, 'the queued choice counts when Koshi moves after leaving ice');
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

test('the ridden Surf Board has a pointed nose, stubby tail and matching darker fin without increasing its size', () => {
  const paths = [], fillColors = [];
  let current = [];
  const ctx = new Proxy({
    beginPath() { current = []; paths.push(current); },
    moveTo(...args) { current.push(['move', ...args]); },
    lineTo(...args) { current.push(['line', ...args]); },
    quadraticCurveTo(...args) { current.push(['curve', ...args]); },
    fill() { fillColors.push(this.fillStyle); },
  }, {
    get(target, key) { return key in target ? target[key] : () => {}; },
  });
  drawSurfBoard(ctx, '#ed5555', 1, '5', true);
  const [fin, hull] = paths;
  assert.ok(fin.some(([method, , , x, y]) => method === 'curve' && x === -29 && y === 7),
    'rear fin projects down beneath the left-hand tail');
  assert.deepEqual(hull[0], ['move', -32, -4]);
  assert.deepEqual(hull.at(-1), ['curve', -20, 4, -32, 1], 'tail has a blunt vertical end');
  assert.ok(hull.some(([method, , , x, y]) => method === 'curve' && x === 32 && y === -8),
    'right-hand nose comes to an upturned point');
  const points = paths.flatMap(commands => commands.flatMap(([, ...coords]) =>
    Array.from({ length: coords.length / 2 }, (_, index) => coords.slice(index * 2, index * 2 + 2))));
  assert.deepEqual([Math.min(...points.map(([x]) => x)), Math.max(...points.map(([x]) => x)),
    Math.min(...points.map(([, y]) => y)), Math.max(...points.map(([, y]) => y))], [-32, 32, -8, 7],
    'hull and fin preserve the original 64-by-15 silhouette bounds');
  for (const color of ['#ed5555', '#63d877', '#519eff']) {
    fillColors.length = 0;
    drawSurfBoard(ctx, color, 1, '5', true);
    const channels = hex => hex.slice(1).match(/../g).map(channel => parseInt(channel, 16));
    const original = channels(color);
    const ratios = channels(fillColors[0]).map((channel, index) => channel / original[index]);
    assert.ok(ratios.every(ratio => ratio > .3 && ratio < .8), 'fin is darker, but not near-black');
    assert.ok(Math.max(...ratios) - Math.min(...ratios) < .02, 'fin preserves its board color hue');
  }
});

test('rides mirror their artwork and keep countdowns upright during the turning animation', () => {
  for (const facing of [1, -1, .3, -.3]) {
    for (const board of [false, true]) {
      let scaleX = 1;
      const stack = [], points = [], labels = [], fills = [];
      const ctx = new Proxy({
        save() { stack.push(scaleX); },
        restore() { scaleX = stack.pop(); },
        scale(x) { scaleX *= x; },
        moveTo(x, y) { points.push([x * scaleX, y]); },
        lineTo(x, y) { points.push([x * scaleX, y]); },
        quadraticCurveTo(_cx, _cy, x, y) { points.push([x * scaleX, y]); },
        fillText(text, x, y) { labels.push([text, x * scaleX, y, scaleX]); },
        fillRect(x, y, width, height) {
          fills.push({ color: this.fillStyle, x: x * scaleX, width: width * scaleX, y, height });
        },
      }, {
        get(target, key) { return key in target ? target[key] : () => {}; },
      });
      if (board) drawSurfBoard(ctx, '#ed5555', .5, '12', true, facing);
      else drawIceSkate(ctx, '#519eff', .5, '12', facing);
      assert.ok(points.some(([x, y]) => x === 32 * facing && y === (board ? -8 : 17)),
        'nose or toe follows the animated facing scale');
      assert.deepEqual(labels, [['12', board ? 0 : -6 * facing, board ? 1 : 12, 1]],
        'countdown follows the item but is never mirrored or squashed');
      if (board) {
        const color = fills.find(fill => fill.color === '#ed5555');
        assert.ok(Math.min(color.x, color.x + color.width) >= 0,
          'board meter still turns white from screen-left to screen-right when facing left');
      }
      assert.equal(scaleX, 1);
      assert.equal(stack.length, 0);
    }
  }
});

test('ride facing flips smoothly within 140 ms, preserves direction at rest, and freezes on pause', () => {
  const app = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const source = app.slice(app.indexOf('const rideFacingAnimations ='), app.indexOf('function drawWornIceSkate('));
  const context = vm.createContext({});
  vm.runInContext(source, context);
  for (const type of ['surf-board-blue', 'ice-skate-blue']) {
    const game = arena([]);
    game.cat.vx = 120;
    game.collectItem({ type });
    const ride = game.surfBoard ?? game.iceSkate;
    const facing = () => context.rideFacingScale(game, ride);
    assert.equal(facing(), 1);
    game.cat.vx = -120;
    assert.equal(facing(), 1, 'reversal starts without snapping');
    game.elapsed += .035;
    assert.ok(facing() > 0 && facing() < 1);
    game.elapsed += .035;
    assert.ok(Math.abs(facing()) < 1e-9, 'halfway through the flip the item is edge-on');
    game.pause();
    const pausedScale = facing();
    game.update(.5);
    assert.equal(facing(), pausedScale);
    game.resume();
    game.cat.vx = 120;
    assert.equal(facing(), pausedScale, 'reversing mid-animation remains continuous');
    game.elapsed += .14;
    assert.equal(facing(), 1);
    game.cat.vx = -120;
    facing();
    game.elapsed += .14;
    assert.equal(facing(), -1, 'flip reaches the new direction within 140 ms');
    game.cat.vx = 0;
    game.cat.vy = 120;
    assert.equal(facing(), -1, 'vertical travel keeps the previous horizontal direction');
    game.cat.vy = 0;
    assert.equal(facing(), -1, 'stopping keeps the last direction');
    game.reset();
    game.start();
    game.collectItem({ type });
    assert.equal(context.rideFacingScale(game, game.surfBoard ?? game.iceSkate), 1,
      'a fresh ride does not inherit a previous run animation');
  }
});

test('the ridden Surf Board overlays Koshi with its thickness centered on his body bottom', () => {
  const app = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const start = app.indexOf('  drawTerrainAffected(() => {', app.indexOf('  if (game.activeTurret) drawTurretBase'));
  const source = app.slice(start, app.indexOf('  if (game.bubbleTrap)', start));
  const game = arena([]);
  game.collectItem({ type: 'surf-board-red' });
  let offsetY = 0;
  const deckHeights = [], drawOrder = [];
  const ctx = new Proxy({
    globalAlpha: 1,
    translate(_x, y) { offsetY += y; },
    lineTo(x, y) {
      if (x === 16 && y === -3 || x === -8 && y === 7) deckHeights.push(offsetY + y);
    },
    fillText(label) { drawOrder.push(`timer:${label}`); },
  }, {
    get(target, key) { return key in target ? target[key] : () => {}; },
  });
  const context = vm.createContext({
    game, ctx, ITEMS: { 'surf-board-red': { color: '#ed5555', surfSeconds: 5 } },
    drawSurfBoard, drawTerrainAffected: draw => draw(), drawWornIceSkate() {},
    drawCat() { drawOrder.push('cat'); },
  });
  vm.runInContext(app.slice(app.indexOf('const rideFacingAnimations ='), app.indexOf('function drawWornIceSkate(')), context);
  for (const radius of [21, 12]) {
    game.cat.radius = radius;
    offsetY = 0;
    deckHeights.length = 0;
    drawOrder.length = 0;
    vm.runInContext(source, context);
    assert.deepEqual(deckHeights, [game.cat.y + radius - 5, game.cat.y + radius + 5],
      'body bottom lies halfway through the board thickness');
    assert.deepEqual(drawOrder, ['cat', 'timer:5'], 'countdown is drawn over Koshi rather than behind him');
  }
});

test('expired rides fade out over 400 ms without extending effects or fading Koshi', () => {
  const app = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const start = app.indexOf('  drawTerrainAffected(() => {', app.indexOf('  if (game.activeTurret) drawTurretBase'));
  const render = app.slice(start, app.indexOf('  if (game.bubbleTrap)', start));
  const helpers = app.slice(app.indexOf('const rideFacingAnimations ='), app.indexOf('function drawFoodBadge('));
  for (const type of ['surf-board-red', 'ice-skate-red']) {
    const game = arena([]);
    game.collectItem({ type });
    const ride = game.surfBoard ?? game.iceSkate;
    const draws = [], stack = [];
    const ctx = new Proxy({
      globalAlpha: .6,
      save() { stack.push(this.globalAlpha); },
      restore() { this.globalAlpha = stack.pop(); },
    }, {
      get(target, key) { return key in target ? target[key] : () => {}; },
    });
    const record = (_ctx, _color, fraction, label) => draws.push({ alpha: ctx.globalAlpha, fraction, label });
    const context = vm.createContext({
      game, ctx, ITEMS: {
        'surf-board-red': { color: '#ed5555', surfSeconds: 5 },
        'ice-skate-red': { color: '#ed5555', skateSeconds: 5 },
      },
      drawSurfBoard: record, drawIceSkate: record, drawTerrainAffected: draw => draw(),
      drawCat() { assert.equal(ctx.globalAlpha, .6, 'Koshi keeps his own opacity'); },
    });
    vm.runInContext(helpers, context);
    for (const [age, opacity] of [[-.1, 1], [0, 1], [.2, .5], [.4, 0], [.5, 0]]) {
      game.elapsed = ride.expires + age;
      draws.length = 0;
      vm.runInContext(render, context);
      assert.equal(draws.length, opacity > 0 ? 1 : 0);
      if (opacity > 0) {
        assert.ok(Math.abs(draws[0].alpha - .6 * opacity) < 1e-9);
        if (age >= 0) {
          assert.equal(draws[0].fraction, 0, 'expired item is completely white');
          assert.equal(draws[0].label, '0', 'expired item never shows a negative countdown');
        }
      }
      if (age >= 0) {
        assert.equal(game.surfBoardActive, false);
        assert.equal(game.iceSkateActive, false);
      }
      assert.equal(ctx.globalAlpha, .6, 'ride fade does not leak to other artwork');
      assert.equal(stack.length, 0);
    }
    game.elapsed = ride.expires + .2;
    game.pause();
    const pausedOpacity = context.rideOpacity(ride, game.elapsed);
    game.update(1);
    assert.equal(context.rideOpacity(ride, game.elapsed), pausedOpacity);
    game.resume();
    game.collectItem({ type: type === 'surf-board-red' ? 'ice-skate-red' : 'surf-board-red' });
    assert.equal(game.surfBoard === ride || game.iceSkate === ride, false,
      'replacing a fading ride removes the old visual instead of showing two rides');
    draws.length = 0;
    vm.runInContext(render, context);
    assert.equal(draws.length, 1);
    assert.equal(draws[0].alpha, .6, 'new ride starts fully visible');
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
    assert.equal(game.moves, 0, 'a paused redirect has not moved Koshi yet');
    game.pause();
    game.update(1);
    assert.equal(game.iceSkate.expires, duration);
    assert.equal(game.elapsed, 0);
    game.resume();
    game.elapsed = duration - .02;
    game.update(.04);
    assert.equal(game.moves, 1);
    assert.equal(game.iceSkateActive, false);
    assert.equal(game.iceDirectionLocked, true);
    const velocity = { vx: game.cat.vx, vy: game.cat.vy };
    assert.equal(clickBrick(game, brickToward(game, 'right')), true);
    assert.ok(game.iceSteer, 'after expiry, redirects are queued again');
    assert.deepEqual({ vx: game.cat.vx, vy: game.cat.vy }, velocity);
  }
});

test('Ice Skates refresh without replacing equipped tools and never protect against water or lava', () => {
  const game = arena([]);
  game.collectItem({ type: 'chisel' });
  game.collectItem({ type: 'surf-board-blue' });
  game.collectItem({ type: 'ice-skate-blue' });
  game.update(1);
  game.collectItem({ type: 'ice-skate-red' });
  assert.equal(game.iceSkate.type, 'ice-skate-red');
  assert.ok(Math.abs(game.iceSkate.expires - game.elapsed - 5) < 1e-9);
  assert.equal(game.surfBoard, null);
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

test('Surf Boards and Ice Skates replace each other and immediately end the previous ride effect', () => {
  for (const [color, duration] of [['red', 5], ['green', 15], ['blue', 30]]) {
    const game = arena([]);
    game.collectItem({ type: 'ice-skate-blue' });
    game.update(1);
    game.collectItem({ type: `surf-board-${color}` });
    assert.equal(game.iceSkate, null);
    assert.equal(game.iceSkateActive, false);
    assert.equal(game.surfBoardActive, true);
    assert.equal(game.surfBoard.expires, game.elapsed + duration);
    game.update(1);
    game.collectItem({ type: `ice-skate-${color}` });
    assert.equal(game.surfBoard, null);
    assert.equal(game.surfBoardActive, false);
    assert.equal(game.iceSkateActive, true);
    assert.equal(game.iceSkate.expires, game.elapsed + duration);
  }
  const water = arena([region('water')]);
  water.collectItem({ type: 'surf-board-blue' });
  water.collectItem({ type: 'ice-skate-green' });
  water.update(.01);
  assert.equal(water.terrainImpact?.type, 'water', 'switching to a skate removes water protection');

  const ice = arena([region('ice', .2, .2, .8, .8)]);
  ice.cat.vx = 120;
  ice.collectItem({ type: 'ice-skate-blue' });
  ice.collectItem({ type: 'surf-board-green' });
  ice.update(.01);
  assert.equal(ice.iceDirectionLocked, true);
  assert.equal(clickBrick(ice, brickToward(ice, 'left')), true);
  assert.ok(ice.iceSteer, 'switching to a board restores the normal ice direction lock');
  assert.ok(ice.cat.vx > 0);
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

test('guide terrain previews use game artwork and animate only while the guide is open', () => {
  const app = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const source = app.slice(app.indexOf('function guidePicture('), app.indexOf('\nfunction showGuideChapter('));
  const calls = [], images = [];
  const document = {
    createElement() {
      const context = { setTransform() {}, clearRect() {} };
      return { dataset: {}, getContext: () => context, setAttribute(name, value) { this[name] = value; } };
    },
    querySelectorAll() { return images; },
  };
  const guide = { open: false };
  const context = vm.createContext({ document, guide, KoshiBrickVisuals: {
    drawTerrain(_context, terrain, time) { calls.push({ type: terrain.type, nodes: terrain.path.nodes, time }); },
  } });
  vm.runInContext(source, context);
  for (const type of ['ice', 'water', 'lava']) {
    const image = context.guidePicture(`terrain:${type}`, type);
    images.push(image);
    assert.equal(image.width, 440);
    assert.equal(image.height, 220);
    assert.equal(image['aria-label'], `${type} terrain`);
  }
  assert.deepEqual(calls.map(call => call.type), ['ice', 'water', 'lava']);
  assert.equal(calls[0].nodes.length, 4);
  assert.equal(calls[0].nodes[2].x - calls[0].nodes[0].x, 210);
  assert.equal(calls[0].nodes[2].y - calls[0].nodes[0].y, 100);
  context.animateGuideTerrains(2000);
  assert.equal(calls.length, 3);
  guide.open = true;
  context.animateGuideTerrains(2000);
  context.animateGuideTerrains(3000);
  assert.deepEqual(calls.slice(3).map(({ type, time }) => [type, time]),
    [['water', 2], ['lava', 2], ['water', 3], ['lava', 3]]);
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
