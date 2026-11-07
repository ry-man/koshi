const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, SWORDS, SLIMES } = require('../src/game.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const helper = source.slice(source.indexOf('function cameraBoundsVisible('), source.indexOf('function render('));
const { cameraBoundsVisible: visible } = vm.runInNewContext(`${helper}; ({ cameraBoundsVisible });`);

test('open world maps and information pages suspend hidden gameplay work without accumulating a simulation delta', () => {
  const frameSource = source.slice(source.indexOf('function frame('), source.indexOf('function updateBoardVisibility('));
  const calls = [];
  const context = {
    game: { elapsed: 0, state: 'ready', update: seconds => calls.push(['update', seconds]) },
    levelPicker: { open: true }, levelInfoDialog: { open: false }, phaseTransition: { busy: false }, cutscene: { active: false },
    lastTime: 100, toastUntil: 0, toast: {},
    requestAnimationFrame: () => calls.push(['schedule']),
    updateEnding: () => calls.push(['ending']),
    recordCatBlockFinds: () => calls.push(['collectibles']),
    syncUI: () => calls.push(['hud']), render: () => calls.push(['render']),
  };
  vm.createContext(context);
  vm.runInContext(frameSource, context);
  context.frame(200);
  context.frame(5000);
  assert.deepEqual(calls, [['schedule'], ['schedule']]);
  assert.equal(context.lastTime, null);
  calls.length = 0;
  context.levelPicker.open = false;
  context.frame(5100);
  assert.deepEqual(calls[0], ['update', 0]);
  assert.ok(calls.some(([name]) => name === 'render'));
  assert.ok(calls.some(([name]) => name === 'hud'));
  calls.length = 0;
  context.frame(5116);
  assert.deepEqual(calls[0], ['update', .016]);
  calls.length = 0;
  context.levelInfoDialog.open = true;
  context.frame(6000);
  context.frame(9000);
  assert.deepEqual(calls, [['schedule'], ['schedule']]);
  assert.equal(context.lastTime, null);
  calls.length = 0;
  context.levelInfoDialog.open = false;
  context.frame(9100);
  assert.deepEqual(calls[0], ['update', 0]);
});

test('render culling follows the camera in landscape and portrait without losing crossing geometry', () => {
  for (const camera of [{ x: 2000, y: 0, width: 960, height: 600 },
    { x: 0, y: 2000, width: 600, height: 960 }]) {
    assert.equal(visible(camera, camera.x + 20, camera.y + 20), true);
    assert.equal(visible(camera, camera.x - 100, camera.y - 100), false);
    assert.equal(visible(camera, camera.x - 100, camera.y - 100, 0, 0, 100), true);
    assert.equal(visible(camera, camera.x - 200, camera.y + 20, 200, 30), true);
    assert.equal(visible(camera, camera.x + 20, camera.y - 200, 30, 200), true);
    assert.equal(visible(camera, camera.x + camera.width + 101, camera.y, 0, 0, 100), false);
    assert.equal(visible(camera, camera.x, camera.y + camera.height + 101, 0, 0, 100), false);
    assert.equal(visible(camera, camera.x - 5000, camera.y - 5000, 10000, 10000), true);
  }
});

test('renderer culls actors without culling their independently positioned attacks', () => {
  const render = source.slice(source.indexOf('function render('), source.indexOf('function drawFoodBadge('));
  assert.match(render, /robotDrawOrder\(visibleRobots\)/);
  assert.match(render, /game\.enemyDeaths\.filter\(visibleRobot\)/);
  assert.match(render, /for \(const enemy of game\.robots\) \{\s*for \(const wave of enemy\.waves/);
  assert.match(render, /for \(const enemy of game\.robots\) for \(const bomb of enemy\.bombs/);
  assert.match(render, /enemy\.type === 'snake' \? 240 : 96/);
  assert.match(render, /effect\.members\.some/);
});

test('scrolling render skips distant artwork but draws visible attacks from distant enemies', () => {
  const game = new Game(() => .5, { customLevel: {
    version: 1, id: 'Rendering', duration: 60, goal: 0, survive: true,
    heartCost: null, brickSet: 1, events: [], autoscroll: { length: 56, speed: 0, events: [] },
  } });
  const near = { x: 300, y: 300, radius: 20, type: 'mouse' };
  const far = { ...near, x: 3000, waves: [
    { x: 300, y: 300, radius: 100, blocked: [[], [], [], []] },
    { x: 3000, y: 300, radius: 100, blocked: [[], [], [], []] },
  ], bombs: [{ x: 300, y: 300 }, { x: 3000, y: 300 }] };
  game.robots = [near, far];
  game.barrierSegments = () => [
    { x: -1000, y: 300, nx: 1, ny: 0, length: 1500 },
    { x: 3000, y: 300, nx: 1, ny: 0, length: 200 },
  ];
  game.food = [{ x: 300, y: 300, expires: 10, lifetime: 10 }, { x: 3000, y: 300, expires: 10, lifetime: 10 }];
  const render = source.slice(source.indexOf('function render('), source.indexOf('function drawFoodBadge('));
  const calls = new Map();
  const context = {
    game, SWORDS, SLIMES, buttons: [], trail: [], ending: null, colors: {},
    canvas: { width: 960, height: 600 }, board: { clientWidth: 960, clientHeight: 600 },
    document: { querySelector: () => ({ style: {} }) },
    powerupStreamRows: () => ({}), robotDrawOrder: robots => robots, line() {},
  };
  const canvasContext = new Proxy({}, { get: (_, key) => key === 'globalAlpha' ? 1 : () => {} });
  context.ctx = context.boardCtx = context.actorCtx = canvasContext;
  for (const [name] of render.matchAll(/\b(draw[A-Z]\w*)(?=\()/g)) {
    context[name] = (...args) => {
      if (!calls.has(name)) calls.set(name, []);
      calls.get(name).push(args);
    };
  }
  vm.runInNewContext(`${helper}\n${render}\nrender(0);`, context);
  assert.equal(calls.get('drawRobot').length, 1);
  assert.equal(calls.get('drawRobot')[0][0], near);
  assert.equal(calls.get('drawFoodBadge').length, 1);
  assert.equal(calls.get('drawFireWave').length, 1);
  assert.equal(calls.get('drawBomb').length, 1);
  assert.equal(calls.get('drawBarrier').length, 1, 'a fence crossing the viewport remains visible');
  assert.equal(game.robots.length, 2, 'drawing must not discard simulation state');
  delete game.level.autoscroll;
  calls.clear();
  vm.runInNewContext(`${helper}\n${render}\nrender(0);`, context);
  for (const name of ['drawRobot', 'drawFoodBadge', 'drawFireWave', 'drawBomb', 'drawBarrier']) {
    assert.equal(calls.get(name).length, 2, `${name} retains non-scrolling rendering`);
  }
});

test('turret drawing keeps crossing beams and overlapping blasts but skips distant effects', () => {
  const camera = { x: 1000, y: 0, width: 960, height: 600 };
  const arcs = [], lines = [];
  const context = new Proxy({}, { get: (_, key) => {
    if (key === 'globalAlpha') return 1;
    return (...args) => {
      if (key === 'arc') arcs.push(args);
      if (key === 'moveTo') lines.push(args);
    };
  } });
  const game = {
    turretProjectiles: [{ x: 1300, y: 300 }, { x: 300, y: 300 }],
    turretEffects: [
      { type: 'laser', age: 0, start: { x: 0, y: 300 }, end: { x: 1500, y: 300 } },
      { type: 'laser', age: 0, start: { x: 0, y: 300 }, end: { x: 200, y: 300 } },
      { type: 'blast', age: .2, x: 950, y: 300 },
      { type: 'blast', age: .2, x: 300, y: 300 },
    ],
  };
  const effects = source.slice(source.indexOf('function drawTurretEffects('), source.indexOf('function cameraBoundsVisible('));
  vm.runInNewContext(`${helper}\n${effects}\ndrawTurretEffects(context, camera);`, { game, context, camera });
  assert.equal(arcs.length, 4, 'one projectile and one blast each draw two circles');
  assert.equal(lines.length, 2, 'one crossing laser draws its glow and core');
  assert.deepEqual(lines[0], [0, 300]);
});

test('offscreen brick DOM updates sleep and refresh immediately when the camera reaches them', () => {
  const start = source.indexOf('  for (const item of buttons) {', source.indexOf('function syncUI('));
  const loop = source.slice(start, source.indexOf('    button.dataset.sunglassesGlow', start));
  const buttons = [0, 1].map(id => ({ brick: { id }, button: {}, members: [],
    spring: { style: {} }, spikes: { style: {} }, conveyor: { style: {} },
    special: { info: { style: {} }, cloud: { style: {} } } }));
  const game = { level: { autoscroll: {} }, visibleId: 0,
    brickVisible(brick) { return brick.id === this.visibleId; } };
  const updated = [];
  const sync = () => vm.runInNewContext(`${loop} updated.push(brick.id); }`, { game, buttons, updated });
  sync();
  assert.deepEqual(updated, [0]);
  assert.equal(buttons[1].button.hidden, true);
  for (const artwork of [buttons[1].spring, buttons[1].spikes, buttons[1].conveyor, buttons[1].special.info, buttons[1].special.cloud]) {
    assert.equal(artwork.style.visibility, 'hidden');
  }
  game.visibleId = 1;
  sync();
  assert.deepEqual(updated, [0, 1]);
  assert.equal(buttons[0].button.hidden, true);
  assert.equal(buttons[1].button.hidden, false);
  assert.equal(buttons[1].spring.style.visibility, '');
  delete game.level.autoscroll;
  sync();
  assert.deepEqual(updated, [0, 1, 0, 1]);
  assert.ok(buttons.every(item => !item.button.hidden));
});
