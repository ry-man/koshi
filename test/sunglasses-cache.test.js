const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, brickShape, brickSpikes } = require('../src/game.js');

const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const glowSource = source.slice(source.indexOf('function syncSunglassesGlow('), source.indexOf('function syncUI('));
const ribbonSource = source.slice(source.indexOf('function ribbonTransform('), source.indexOf('function drawCapeStream('))
  + source.slice(source.indexOf('function sunglassesRibbonPattern('), source.indexOf('function drawMaskStream('));

function surface() {
  const calls = [];
  const paint = new Proxy({ globalAlpha: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createLinearGradient') return (...args) => {
        calls.push([key, ...args]);
        return { addColorStop: (...stop) => calls.push(['colorStop', ...stop]) };
      };
      if (key === 'createPattern') return (...args) => {
        calls.push([key, ...args]);
        return { setTransform: transform => calls.push(['patternTransform', transform]) };
      };
      return (...args) => calls.push([key, ...args]);
    },
  });
  return { width: 0, height: 0, style: {}, calls, paint, getContext: () => paint };
}

function renderer(extra = {}, options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: {
    version: 1, id: 'Cached sunglasses', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [], ...extra,
  } });
  game.start();
  game.collectItem({ type: 'magic-sunglasses' });
  const created = [];
  const overlay = surface();
  const canvas = surface();
  canvas.width = game.viewportWidth; canvas.height = game.viewportHeight;
  const board = { clientWidth: game.viewportWidth, clientHeight: game.viewportHeight };
  const parts = game.brickParts();
  const buttons = game.bricks.filter(brick => brick.absorbedBy === null).map(brick => {
    const members = parts.filter(part => part.id === brick.id);
    const bounds = members.length > 1 ? brickShape(members, Boolean(brick.crumbler)) : members[0];
    return { brick, members, bounds, visible: true, button: {
      dataset: {}, classList: { contains: name => name === 'brick-merged' && members.length > 1 },
    } };
  });
  const context = vm.createContext({
    game, canvas, board, buttons, brickShape, brickSpikes,
    window: { devicePixelRatio: 1 }, sunglassesGlowCanvas: overlay, sunglassesGlowCache: null, sunglassesRibbonCache: null,
    ctx: canvas.paint, Path2D: class { constructor(data) { this.data = data; } },
    document: { createElement(tag) {
      assert.equal(tag, 'canvas');
      const image = surface(); created.push(image); return image;
    } },
  });
  vm.runInContext(glowSource + ribbonSource, context);
  const sync = () => {
    for (const item of context.buttons) if (item.visible) context.syncSunglassesGlow(item);
    context.syncSunglassesOverlay();
  };
  return { context, game, canvas, board, buttons, overlay, created, sync };
}

test('glow details and overlay paint once; only the single overlay tint changes on subsequent frames', () => {
  const { context, game, buttons, overlay, created, sync } = renderer();
  sync();
  assert.equal(created.length, buttons.length);
  assert.equal(overlay.width, game.viewportWidth);
  assert.equal(overlay.height, game.viewportHeight);
  assert.equal(overlay.calls.filter(([name]) => name === 'drawImage').length, buttons.length);
  const detailCalls = created.reduce((sum, image) => sum + image.calls.length, 0);
  for (let frame = 1; frame <= 120; frame++) {
    game.elapsed = frame / 60;
    sync();
  }
  assert.equal(created.length, buttons.length);
  assert.equal(created.reduce((sum, image) => sum + image.calls.length, 0), detailCalls);
  assert.equal(overlay.calls.filter(([name]) => name === 'drawImage').length, buttons.length);
  assert.equal(overlay.style.filter, 'hue-rotate(280deg)');
  assert.ok(buttons.every(item => !('style' in item.button)), 'no per-brick animated style writes');
  const cache = context.sunglassesGlowCache;
  game.pause(); game.update(20); sync();
  assert.equal(context.sunglassesGlowCache, cache);
  assert.equal(overlay.style.filter, 'hue-rotate(280deg)');
  game.resume(); game.update(8); sync();
  assert.equal(overlay.hidden, true);
  game.collectItem({ type: 'magic-sunglasses' }); sync();
  assert.equal(overlay.hidden, false);
  assert.equal(created.length, buttons.length, 'a repeated pickup reuses unchanged geometry');
});

test('viewport and geometry changes repaint the overlay, while each affected brick bitmap is reused or rebuilt in place', () => {
  const { context, game, canvas, board, buttons, overlay, created, sync } = renderer();
  sync();
  const count = created.length;
  const first = buttons[0], image = first.sunglassesGlow;
  first.brick.crumbler = 4; first.brick.usesLeft = 3;
  sync();
  assert.equal(first.sunglassesGlow, image);
  assert.equal(created.length, count);
  assert.equal(first.sunglassesGlowRevision, 2);
  assert.equal(context.sunglassesGlowCache.tiles[0].revision, 2);
  assert.ok(image.calls.some(([name, shape]) => name === 'clip' && shape?.data), 'worn outline clips the glow');
  board.clientWidth /= 2; board.clientHeight /= 2;
  canvas.width /= 2; canvas.height /= 2;
  sync();
  assert.equal(overlay.width, canvas.width);
  assert.equal(overlay.height, canvas.height);
  assert.equal(first.sunglassesGlow.width, Math.ceil(first.bounds.w / 2));
  const cache = context.sunglassesGlowCache;
  game.brickRevision++;
  sync();
  assert.notEqual(context.sunglassesGlowCache, cache);
  buttons[0].visible = false;
  sync();
  assert.equal(context.sunglassesGlowCache.tiles.length, buttons.length - 1);
});

test('merged corner glow clips to its rounded union and preserves separate sub-brick edge highlights', () => {
  const { context, game, buttons, sync } = renderer();
  const brick = buttons[0].brick;
  const members = [{ x: 0, y: 0, w: 120, h: 30 }, { x: 0, y: 30, w: 30, h: 90 }];
  const bounds = brickShape(members);
  const item = { brick, members, bounds, visible: true, button: {
    dataset: {}, classList: { contains: name => name === 'brick-merged' },
  } };
  context.buttons = [item];
  sync();
  const image = item.sunglassesGlow;
  assert.equal(image.calls.find(([name]) => name === 'clip')[1].data, bounds.roundedPath);
  assert.equal(image.calls.filter(([name]) => name === 'createLinearGradient').length, members.length * 4);
  assert.equal(game.sunglassesActive, true);
});

test('scrolling recomposes visible cached tiles in a viewport-sized overlay without allocating a board-sized image', () => {
  const { context, game, canvas, buttons, overlay, sync } = renderer({
    autoscroll: { length: 1000, speed: 10, events: [] },
  });
  for (const item of buttons) item.visible = game.brickVisible(item.brick, item.members);
  sync();
  assert.ok(game.width > canvas.width * 20);
  assert.equal(overlay.width, canvas.width);
  const cache = context.sunglassesGlowCache;
  game.elapsed = 2;
  for (const item of buttons) item.visible = game.brickVisible(item.brick, item.members);
  sync();
  assert.notEqual(context.sunglassesGlowCache, cache);
  assert.equal(context.sunglassesGlowCache.x, game.camera().x);
  assert.equal(overlay.width, canvas.width);
  assert.ok(context.sunglassesGlowCache.tiles.length < 50);
});

test('ribbon draws just one cached star/cat tile, retints without redrawing paths, and freezes on pause', () => {
  const { context, game, canvas, created } = renderer();
  context.drawSunglassesStream(game);
  assert.equal(created.length, 2);
  const [mask, tinted] = created;
  assert.equal(mask.width, 96);
  assert.equal(mask.height, 56);
  assert.equal(mask.calls.filter(([name]) => name === 'lineTo').length, 14);
  const details = mask.calls.length;
  for (let frame = 1; frame <= 60; frame++) {
    game.elapsed = frame / 60;
    context.drawSunglassesStream(game);
  }
  assert.equal(created.length, 2);
  assert.equal(mask.calls.length, details);
  assert.equal(tinted.paint.globalCompositeOperation, 'source-over');
  const tintedCalls = tinted.calls.length;
  game.pause(); game.update(20); context.drawSunglassesStream(game);
  assert.equal(tinted.calls.length, tintedCalls);
  assert.ok(canvas.calls.some(([name, , , width, height]) => name === 'fillRect'
    && width === Math.ceil(game.width / 48) * 48 && height === 56));
  game.resume(); game.update(9);
  const calls = canvas.calls.length;
  context.drawSunglassesStream(game);
  assert.equal(canvas.calls.length, calls, 'the ribbon vanishes at exactly ten seconds');
});

test('ribbon cache respects portrait transforms, display resolution and very long scrolling levels', () => {
  for (const portrait of [false, true]) {
    const { context, game, canvas, created } = renderer({ autoscroll: { length: 1000, speed: 0, events: [] } }, { portrait });
    canvas.width *= 2; canvas.height *= 2;
    context.drawSunglassesStream(game);
    assert.equal(created[0].width, 192);
    assert.equal(created[0].height, 112);
    assert.ok(canvas.calls.some(([name, , , width]) => name === 'fillRect' && width === Math.ceil(Math.max(game.width, game.height) / 48) * 48));
    assert.equal(canvas.calls.some(([name, angle]) => name === 'rotate' && angle === Math.PI / 2), portrait);
    canvas.width /= 2; canvas.height /= 2;
    context.drawSunglassesStream(game);
    assert.equal(created.length, 4);
    assert.equal(created[2].width, 96);
  }
});

test('failed ribbon pattern creation surfaces an explicit error', () => {
  const { context, game } = renderer();
  context.ctx.createPattern = () => null;
  assert.throws(() => context.drawSunglassesStream(game), /Could not create the sunglasses ribbon pattern/);
});
