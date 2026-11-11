const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game } = require('../src/game.js');
const { drawGoal } = require('../src/brick-visuals.js');
const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const types = ['music-box', 'magic-sunglasses', 'kitty-cape', 'spooky-mask'];
const streams = ['music', 'sunglasses', 'cape', 'mask'];
function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: {
    version: 1, id: 'Power-up streams', duration: 60, goal: 1000,
    heartCost: null, brickSet: 1, events: [],
  } });
  game.start();
  return game;
}
function drawingContext() {
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => operations.push({ name: key, args, alpha: target.globalAlpha });
    },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function powerupStreamRows('), source.indexOf('function render(')), context);
  vm.runInContext(source.slice(source.indexOf('function drawKittyCape('), source.indexOf('function drawRobot(')), context);
  context.sunglassesRibbonPattern = () => ({});
  return { context, operations };
}

test('actor-layer goal net and frame glow in the sunglasses color and restore their normal appearance', () => {
  const strokes = [];
  const ctx = { save() {}, restore() {}, fillRect() {}, stroke() {
    strokes.push({ color: this.strokeStyle, glow: this.shadowColor, blur: this.shadowBlur });
  } };
  const previous = globalThis.Path2D;
  globalThis.Path2D = class {};
  try {
    drawGoal(ctx, [{ x: 10, y: 10, w: 40, h: 15 }], 'hsl(120, 85%, 70%)');
    assert.equal(strokes[0].color, 'hsl(120, 85%, 70%)');
    assert.equal(strokes[2].color, 'hsl(120, 85%, 70%)');
    assert.ok(strokes.every(stroke => stroke.glow === 'hsl(120, 85%, 70%)' && stroke.blur === 12));
    strokes.length = 0;
    drawGoal(ctx, [{ x: 10, y: 10, w: 40, h: 15 }]);
    assert.equal(strokes[0].color, '#ffffff');
    assert.equal(strokes[2].color, '#dce4e7');
  } finally {
    if (previous === undefined) delete globalThis.Path2D;
    else globalThis.Path2D = previous;
  }
});

test('all simultaneous power-up combinations use separated rows in landscape and portrait', () => {
  const { context, operations } = drawingContext();
  for (const options of [{}, { portrait: true, scale: .2 }, { portrait: true, scale: .65 }]) {
    for (let mask = 1; mask < 16; mask++) {
      const game = arena(options);
      types.forEach((type, index) => { if (mask & (1 << index)) game.collectItem({ type }); });
      const rows = context.powerupStreamRows(game);
      const positions = Object.values(rows);
      assert.equal(positions.length, types.filter((_, index) => mask & (1 << index)).length);
      for (let i = 0; i < positions.length; i++) {
        assert.ok(positions[i] - 26 > 0 && positions[i] + 26 < Math.min(game.width, game.height));
        if (i) assert.equal(positions[i] - positions[i - 1], 64, '52-unit frames have a 12-unit gap');
      }
      if (positions.length === 1) assert.equal(positions[0], Math.min(game.width, game.height) / 2);
      streams.forEach((stream, index) => {
        if (!(mask & (1 << index))) return;
        operations.length = 0;
        context[`draw${stream[0].toUpperCase()}${stream.slice(1)}Stream`](game, rows[stream]);
        assert.equal(operations.find(op => op.name === 'translate').args[options.portrait ? 0 : 1], rows[stream]);
        assert.deepEqual(operations.find(op => op.name === 'strokeRect').args, [-18, -26, Math.max(game.width, game.height) + 36, 52]);
        assert.equal(operations.some(op => op.name === 'rotate' && op.args[0] === Math.PI / 2), Boolean(options.portrait));
      });

    }
  }
});

test('all five background ribbons run lengthwise along a scrolling board in both orientations', () => {
  const { context, operations } = drawingContext();
  for (const portrait of [false, true]) {
    const game = new Game(() => .5, { portrait, customLevel: {
      version: 1, id: 'Long ribbons', duration: 60, goal: 0, survive: true,
      heartCost: null, brickSet: 1, events: [], autoscroll: { length: 56, speed: .2, events: [] },
    } });
    game.start();
    types.forEach(type => game.collectItem({ type }));
    game.snailStreamStart = 0; game.snailStreamUntil = 20; game.snailStreamAge = 0;
    const rows = context.powerupStreamRows(game);
    for (const type of [...streams, 'snail']) {
      operations.length = 0;
      context[`draw${type[0].toUpperCase()}${type.slice(1)}Stream`](game, rows[type]);
      const frame = operations.find(op => op.name === 'strokeRect');
      assert.equal(frame.args[2], Math.max(game.width, game.height) + 36);
      assert.ok(frame.args[2] > 5000);
      const anchor = operations.find(op => op.name === 'translate');
      assert.equal(anchor.args[portrait ? 0 : 1], rows[type]);
      assert.equal(operations.some(op => op.name === 'rotate' && op.args[0] === Math.PI / 2), portrait);
    }
  }
});

test('mask ghosts and demon heads scroll for ten seconds, refresh, pause, and disappear at expiry', () => {
  const game = arena(), { context, operations } = drawingContext();
  context.drawMaskStream(game); assert.equal(operations.length, 0);
  game.collectItem({ type: 'spooky-mask' });
  context.drawMaskStream(game);
  assert.equal(operations.find(op => op.name === 'strokeRect').alpha, .25);
  assert.ok(operations.some(op => op.name === 'ellipse'), 'ghost eyes and mouth');
  assert.ok(operations.some(op => op.name === 'lineTo' && op.args[0] === -14 && op.args[1] === -20), 'demon horns');
  game.update(5);
  operations.length = 0; context.drawMaskStream(game);
  assert.equal(operations.find(op => op.name === 'translate').args[0], -(game.width + 36) / 2);
  game.pause(); game.update(20);
  operations.length = 0; context.drawMaskStream(game);
  assert.equal(operations.find(op => op.name === 'translate').args[0], -(game.width + 36) / 2);
  game.resume(); game.collectItem({ type: 'spooky-mask' });
  operations.length = 0; context.drawMaskStream(game);
  assert.equal(operations.find(op => op.name === 'translate').args[0], -0);
  game.update(9.99);
  operations.length = 0; context.drawMaskStream(game);
  assert.ok(operations.length > 0);
  game.update(.01);
  operations.length = 0; context.drawMaskStream(game);
  assert.equal(operations.length, 0);
  assert.ok(game.maskPickup, 'worn mask may fade without keeping its banner');
  assert.deepEqual(Object.keys(context.powerupStreamRows(game)), []);
});

test('music sleep and banner refresh together, pause together, and reset together', () => {
  const game = arena();
  game.collectItem({ type: 'music-box' });
  game.update(9.99);
  assert.ok(game.enemiesSleepUntil > game.elapsed);
  assert.ok(game.musicPickup);
  game.collectItem({ type: 'music-box' });
  assert.equal(game.musicPickup.age, 0);
  assert.equal(game.musicStreamUntil, game.elapsed + 10);
  assert.equal(game.enemiesSleepUntil, game.musicStreamUntil);
  game.pause(); game.update(20);
  assert.equal(game.musicPickup.age, 0);
  game.resume(); game.update(10);
  assert.equal(game.musicPickup, null);
  assert.ok(game.enemiesSleepUntil <= game.elapsed + 1e-9);
  game.reset();
  assert.equal(game.musicStreamStart, null); assert.equal(game.musicPickup, null);
});

for (const state of ['won', 'lost']) {
  test(`all banners stay separated and finish after ${state} without advancing gameplay`, () => {
    const game = arena(), { context, operations } = drawingContext();
    types.forEach(type => game.collectItem({ type }));
    game.state = state;
    game.update(5);
    const rows = context.powerupStreamRows(game);
    assert.equal(new Set(Object.values(rows)).size, 4);
    streams.forEach(stream => {
      operations.length = 0;
      context[`draw${stream[0].toUpperCase()}${stream.slice(1)}Stream`](game, rows[stream]);
      assert.equal(operations.find(op => op.name === 'translate').args[0], -(game.width + 36) / 2);
    });
    game.update(5);
    assert.equal(game.elapsed, 0);
    assert.deepEqual(Object.keys(context.powerupStreamRows(game)), []);
    streams.forEach(stream => {
      operations.length = 0;
      context[`draw${stream[0].toUpperCase()}${stream.slice(1)}Stream`](game);
      assert.equal(operations.length, 0);
    });
  });
}
