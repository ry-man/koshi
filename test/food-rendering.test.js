const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FOODS } = require('../src/game.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');

function renderer() {
  const sprites = [], draws = [], listeners = {};
  let fontsReady;
  const context = {
    FOODS, canvas: { width: 1920, height: 1200 }, game: { viewportWidth: 960, viewportHeight: 600 },
    ctx: { drawImage: (...args) => draws.push(args) },
    document: {
      fonts: { ready: { then(callback) { fontsReady = callback; } },
        addEventListener(name, callback) { listeners[name] = callback; } },
      createElement(tag) {
        assert.equal(tag, 'canvas');
        const calls = [];
        const paint = {
          setTransform: (...args) => calls.push(['transform', ...args]),
          beginPath() {}, arc: (...args) => calls.push(['arc', ...args]), fill() {}, stroke() {},
          fillText: (...args) => calls.push(['text', ...args]),
        };
        const sprite = { getContext: () => paint, paint, calls };
        sprites.push(sprite);
        return sprite;
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('const FOOD_COLORS'), source.indexOf('const board =')), context);
  vm.runInContext(source.slice(source.indexOf('function drawFoodBadge('), source.indexOf('function drawWornSunglasses(')), context);
  return { context, sprites, draws, listeners, fontsReady: () => fontsReady() };
}

test('food badges filter once per type and reuse artwork across layers and pickup animations', () => {
  const { context, sprites, draws } = renderer();
  for (const type of Object.keys(FOODS)) {
    context.drawFoodBadge(type);
    context.drawFoodBadge(type);
  }
  assert.equal(sprites.length, Object.keys(FOODS).length);
  for (const [i, type] of Object.keys(FOODS).entries()) {
    const sprite = sprites[i];
    assert.equal(sprite.width, 120, '2x display resolution includes 1.25x pickup magnification');
    assert.equal(sprite.height, 120);
    assert.equal(sprite.paint.filter, 'saturate(1.8) brightness(1.15) contrast(1.1)');
    assert.deepEqual(sprite.calls.find(([name]) => name === 'text'), ['text', FOODS[type].icon, 0, 1]);
    assert.deepEqual(sprite.calls[0], ['transform', 2.5, 0, 0, 2.5, 60, 60]);
    assert.equal(sprite.calls.filter(([name]) => name === 'text').length, 1);
    assert.deepEqual(draws[i * 2], [sprite, -24, -24, 48, 48]);
    assert.equal(draws[i * 2 + 1][0], sprite);
  }
  let actorSprite;
  context.ctx = { drawImage(sprite) { actorSprite = sprite; } };
  context.drawFoodBadge('S');
  assert.equal(actorSprite, sprites[0], 'actor layer shares the board cache');
  assert.equal(context.ctx.filter, undefined, 'live canvas never receives the expensive filter');
});

test('font readiness and later font success or failure invalidate food artwork', () => {
  const { context, sprites, listeners, fontsReady } = renderer();
  context.drawFoodBadge('S');
  for (const invalidate of [fontsReady, listeners.loadingdone, listeners.loadingerror]) {
    const count = sprites.length;
    invalidate();
    context.drawFoodBadge('S');
    assert.equal(sprites.length, count + 1);
    context.drawFoodBadge('S');
    assert.equal(sprites.length, count + 1);
  }
});

test('resize discards cached badges and rebuilds at the new board resolution', () => {
  const { context, sprites } = renderer();
  context.drawFoodBadge('S');
  Object.assign(context, {
    board: { style: { setProperty() {} }, clientWidth: 480, clientHeight: 300 },
    window: { devicePixelRatio: 1 }, actorCanvas: { getContext: () => ({ setTransform() {} }) },
    render() {}, performance: { now: () => 0 },
  });
  context.canvas.getContext = () => ({ setTransform() {} });
  vm.runInContext(source.slice(source.indexOf('function resize('), source.indexOf('function frame(')), context);
  context.resize();
  context.drawFoodBadge('S');
  assert.equal(sprites.length, 2);
  assert.equal(sprites[1].width, 30);
  context.drawFoodBadge('S');
  assert.equal(sprites.length, 2);
});
