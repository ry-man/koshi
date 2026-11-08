const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, COOLDOWNS, FOODS, SCHEDULE, SPEED, brickContact } = require('../src/game.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Koshi artwork matches his circular collision radius without a weapon halo', () => {
  const app = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const source = app.slice(app.indexOf('function drawCat('), app.indexOf('\nfunction updateEnding('));
  const game = new Game(() => .5);
  let scale = 1;
  const stack = [], circles = [];
  const ctx = new Proxy({
    save() { stack.push(scale); },
    restore() { scale = stack.pop(); },
    scale(x, y) { assert.equal(x, y); scale *= x; },
    arc(_x, _y, radius) { circles.push(radius * scale); },
  }, {
    get(target, key) { return key in target ? target[key] : () => {}; },
  });
  const context = vm.createContext({ game, ctx, line() {}, SWORDS: { wood: { color: '#765432' } } });
  vm.runInContext(source, context);
  for (const hurt of [null, .5]) {
    circles.length = 0;
    game.weapon = { type: 'wood' };
    context.drawCat(game.cat.x, game.cat.y, 0, hurt);
    assert.deepEqual(circles, [game.cat.radius], 'weapon pickups do not draw a circle around Koshi');
    assert.equal(scale, 1, 'drawing restores the canvas scale');
    assert.equal(stack.length, 0);
  }
});

test('direct-file startup uses ordered classic scripts and exposes the browser engine', () => {
  const root = path.resolve(__dirname, '..');
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)><\/script>/g)];
  assert.equal(scripts.length, 15);
  for (const [, attributes] of scripts) {
    assert.match(attributes, /\bdefer\b/);
    assert.doesNotMatch(attributes, /\btype\s*=\s*["']module["']/);
  }
  const ordered = ['campaign-mode', 'official-levels.generated', 'campaign', 'game', 'brick-visuals', 'cutscene', 'learning', 'saves', 'worlds', 'collectibles', 'cat-town', 'world-map', 'transitions', 'app', 'pwa'];
  for (const [index, name] of ordered.entries()) {
    assert.ok(scripts[index][1].includes(`src="./src/${name}.js"`));
  }
  const context = vm.createContext({
    location: { search: '', hash: '' }, localStorage: { getItem: () => null }, URLSearchParams,
  });
  vm.runInContext(readFileSync(path.join(root, 'src', 'campaign-mode.js'), 'utf8'), context);
  vm.runInContext(readFileSync(path.join(root, 'src', 'official-levels.generated.js'), 'utf8'), context);
  vm.runInContext(readFileSync(path.join(root, 'src', 'campaign.js'), 'utf8'), context);
  vm.runInContext(readFileSync(path.join(root, 'src', 'game.js'), 'utf8'), context);
  vm.runInContext(readFileSync(path.join(root, 'src', 'learning.js'), 'utf8'), context);
  const tutorial = new context.KoshiLearning.Tutorial();
  assert.equal(tutorial.select(0).state, 'playing');
  const game = new context.KoshiGame.Game();
  game.start();
  game.update(1);
  assert.equal(game.state, 'playing');
  assert.ok(game.elapsed > .99);
});

function playing() { const game = new Game(() => .5); game.start(); return game; }
function aim(game, brick) { return game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2); }

test('moves count successful steering and mid-flight redirects, not invalid clicks, contacts or passive motion', () => {
  const game = new Game(() => .5);
  assert.equal(game.moves, 0);
  assert.equal(aim(game, game.bricks[0]), false);
  game.start();
  const first = game.bricks.find(brick => aim(game, brick));
  assert.ok(first);
  assert.equal(game.moves, 1);
  assert.equal(aim(game, first), false, 'cooldown failure is not a move');
  assert.equal(game.steer(-1, 0, 0), false);
  assert.equal(game.moves, 1);
  const second = game.bricks.find(brick => brick.id !== first.id && aim(game, brick));
  assert.ok(second, 'redirect while moving');
  assert.equal(game.moves, 2);
  for (let i = 0; i < 200; i++) game.update(.025);
  assert.equal(game.moves, 2, 'movement and brick contact cost no additional moves');
  game.pause();
  const count = game.moves;
  assert.equal(aim(game, game.bricks[5]), false);
  assert.equal(game.moves, count);
  game.reset();
  assert.equal(game.moves, 0);
});

test('weapon status announces remaining attacks or seconds and the sword blade shows the count', () => {
  const { SWORDS, CAT_SHIELDS } = require('../src/game.js');
  const root = path.resolve(__dirname, '..');
  const app = readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
  const body = app.slice(app.indexOf('  const weaponCount ='), app.indexOf('  const batteryLabel ='));
  assert.ok(body.length > 0);
  const display = `{${body}}`;
  const weaponStatus = { textContent: '' }, shieldStatus = { textContent: '' };
  const game = { elapsed: 2, weapon: null };
  const context = vm.createContext({ game, SWORDS, CAT_SHIELDS, weaponStatus, shieldStatus });
  for (const [type, uses] of [['wood', 1], ['bronze', 3], ['silver', 5], ['gold', Infinity]]) {
    game.weapon = { type, uses, expires: 17 };
    vm.runInContext(display, context);
    assert.match(weaponStatus.textContent, new RegExp(`${SWORDS[type].name}, ${type === 'gold' ? '15 seconds' : `${uses} attacks`} remaining`));
  }
  game.elapsed = 5.2;
  vm.runInContext(display, context);
  assert.match(weaponStatus.textContent, /12 seconds remaining/);
  game.weapon = null;
  vm.runInContext(display, context);
  assert.equal(weaponStatus.textContent, 'Weapon: no sword equipped');
  assert.equal(shieldStatus.textContent, 'Cat Shield: none');
  game.catShield = 'blue';
  vm.runInContext(display, context);
  assert.equal(shieldStatus.textContent, 'Cat Shield: blue, 3 hits remaining');
  assert.match(app, /const label = String\(remaining\);[\s\S]*drawSword\(swordX, swordY, color, label\)/);
});

test('weapon counts are passed to the equipped sword without a separate badge', () => {
  const { SWORDS } = require('../src/game.js');
  const app = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const start = app.indexOf('  if (game.weapon) {', app.indexOf('function render('));
  const body = app.slice(start, app.indexOf('  drawTurretEffects(ctx', start));
  for (const [type, uses, label] of [['wood', 3, '3'], ['gold', Infinity, '12']]) {
    const arcs = [], texts = [], swords = [];
    const ctx = new Proxy({}, {
      get(target, name) {
        if (name === 'measureText') return () => ({ width: 20 });
        if (name === 'arc') return (...args) => arcs.push(args);
        if (name === 'fillText') return (...args) => texts.push(args);
        return () => {};
      },
    });
    const game = { cat: { x: 400, y: 300 }, elapsed: 5, weapon: { type, uses, expires: 17 } };
    vm.runInNewContext(body, { game, SWORDS, ctx, drawSword: (...args) => swords.push(args) });
    assert.deepEqual(swords[0], [430, 280, SWORDS[type].color, label]);
    assert.deepEqual(texts, []);
    assert.deepEqual(arcs, []);
  }
});

test('aiming draws a subtle transparent dotted line and an exact red outlined target above bricks', () => {
  const app = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const strokes = [], arcs = [], lines = [], dashes = [];
  const makeContext = layer => new Proxy({ strokeStyle: '', lineWidth: 0 }, {
    get(target, property) {
      if (property in target) return target[property];
      if (property === 'stroke') return () => strokes.push([layer, target.strokeStyle, target.lineWidth]);
      if (property === 'arc') return (...args) => arcs.push([layer, ...args]);
      if (property === 'setLineDash') return pattern => dashes.push([...pattern]);
      return () => {};
    },
  });
  const game = playing();
  game.target = { x: 927.25, y: 274.75 };
  const context = vm.createContext({
    game, boardCtx: makeContext('board'), actorCtx: makeContext('actors'), ctx: null, trail: [], ending: null,
    canvas: { width: game.width, height: game.height }, board: { clientWidth: game.width, clientHeight: game.height },
    document: { querySelector: () => ({ style: {} }) }, buttons: [],
    drawCat() {}, drawWornCape() {}, drawMusicStream() {}, drawSunglassesStream() {}, drawCapeStream() {}, drawMaskStream() {},
    line(points, color, width) { lines.push({ points, color, width }); },
  });
  vm.runInContext(app.slice(app.indexOf('function powerupStreamRows('), app.indexOf('\nfunction drawSpawnCue')), context);
  context.render(0);
  assert.deepEqual(dashes, [[5, 7], []]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].width, 2.5);
  assert.equal(lines[0].color, '#d3ef8b26');
  assert.deepEqual([...lines[0].points[1]], [game.target.x, game.target.y]);
  assert.ok(arcs.some(([layer, x, y, radius]) => layer === 'actors' && x === game.target.x && y === game.target.y && radius === 6));
  assert.deepEqual(strokes.filter(([layer]) => layer === 'actors'),
    [['actors', '#080e14', 3], ['actors', '#f05252', 1.5]]);
  const bounced = [[480, 300], [900, 200], [60, 100]];
  game.trajectory = () => bounced;
  lines.length = 0;
  context.render(0);
  assert.deepEqual(lines[0].points, bounced, 'render includes the reflected segment with unchanged styling');
  assert.equal(lines[0].color, '#d3ef8b26');
  assert.equal(lines[0].width, 2.5);
});

test('soccer goal artwork, ball sprites, and score sparks are drawn on the actor canvas', () => {
  const app = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const game = playing();
  const goal = game.bricks.find(brick => brick.absorbedBy === null);
  goal.kind = 'goal';
  game.soccerBalls = [{ x: 120, y: 80, radius: 16, vx: 10, vy: 0, angle: .5 }];
  game.goalEffects = [{ x: 300, y: 120, age: .2, duration: .65 }];
  const makeContext = () => new Proxy({ globalAlpha: 1, filter: '' }, {
    get(target, property) { return property in target ? target[property] : () => {}; },
  });
  const boardCtx = makeContext(), actorCtx = makeContext(), calls = [];
  const context = vm.createContext({
    game, boardCtx, actorCtx, ctx: null, trail: [], ending: null, endingMotion: { matches: true },
    canvas: { width: game.width, height: game.height }, board: { clientWidth: game.width, clientHeight: game.height },
    document: { querySelector: () => ({ style: {} }) }, buttons: [],
    drawCat() {}, drawWornCape() {}, drawMusicStream() {}, drawSunglassesStream() {}, drawCapeStream() {}, drawMaskStream() {}, drawBarrier() {}, line() {},
    drawGoal(ctx, members) { calls.push(['goal', ctx, members.some(part => part.id === goal.id)]); },
    drawSoccerBall(ctx, ball) { calls.push(['ball', ctx, ball]); },
    drawGoalSpark(ctx, effect) { calls.push(['spark', ctx, effect]); },
    drawBrickDestructionSmoke() {}, drawPickupPop() {},
  });
  vm.runInContext(app.slice(app.indexOf('function powerupStreamRows('), app.indexOf('\nfunction drawSpawnCue')), context);
  context.render(0);
  assert.deepEqual(calls.map(([type, layer]) => [type, layer === actorCtx]), [
    ['goal', true], ['ball', true], ['spark', true],
  ]);
  assert.deepEqual(calls[1][2], game.soccerBalls[0]);
  assert.deepEqual(calls[2][2], game.goalEffects[0]);
});

test('Boom Time clocks and Boom Helmet render counts, arrival, and the zero-count explosion', () => {
  const app = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const calls = [];
  const makeContext = () => new Proxy({}, {
    get(_target, property) {
      return (...args) => calls.push([property, ...args]);
    },
    set(_target, property, value) { calls.push([property, value]); return true; },
  });
  const context = vm.createContext({ ctx: makeContext(), ITEMS: require('../src/game.js').ITEMS });
  vm.runInContext(app.slice(app.indexOf('function drawGameItem('), app.indexOf('\nfunction drawMagicSunglasses(')), context);
  for (const [type, count, color] of [
    ['boom-time-red', 1, '#d94a4a'], ['boom-time-green', 3, '#399d4a'], ['boom-time-blue', 8, '#287dcc'],
  ]) {
    calls.length = 0;
    context.drawGameItem({ x: 0, y: 0, type });
    assert.ok(calls.some(([name, value]) => name === 'fillStyle' && value === color));
    assert.ok(calls.some(([name, value]) => name === 'fillText' && value === `+${count}`));
    assert.ok(calls.some(([name, ...args]) => name === 'arc' && args[2] === 14), 'clock face is white and outlined');
  }

  vm.runInContext(app.slice(app.indexOf('function drawBoomHelmetArtwork('), app.indexOf('\nfunction drawBrickStamp(')), context);
  calls.length = 0;
  const helmet = { boomHelmet: { age: 0, exploded: false }, activationsRemaining: 5, cat: { x: 120, y: 80 } };
  context.drawBoomHelmet(helmet);
  assert.ok(calls.some(([name, value]) => name === 'fillText' && value === '5'));
  assert.ok(calls.some(([name, x, y]) => name === 'translate' && x === 120 && y === -16), 'helmet falls from above');
  calls.length = 0;
  helmet.boomHelmet.age = .7; helmet.activationsRemaining = 4;
  context.drawBoomHelmet(helmet);
  assert.ok(calls.some(([name, x, y]) => name === 'translate' && x === 120 && y === 80), 'helmet lands on the cat');
  assert.ok(calls.some(([name, value]) => name === 'fillText' && value === '4'));
  calls.length = 0;
  helmet.boomHelmet = { age: 0, exploded: true };
  context.drawBoomHelmet(helmet);
  assert.ok(!calls.some(([name]) => name === 'fillText'), 'an exploded helmet is never drawn as worn');
  assert.ok(calls.some(([name]) => name === 'arc'), 'the helmet explosion draws a cloud');
  assert.ok(calls.some(([name]) => name === 'stroke'), 'the helmet explosion draws sparks');
  assert.ok(calls.some(([name, , , radius]) => name === 'arc' && radius >= 12), 'explosion has large fire clouds');
  for (const color of ['#d93620', '#f05a20', '#ff8c28']) {
    assert.ok(calls.some(([name, value]) => name === 'fillStyle' && value === color));
  }
  calls.length = 0;
  context.game = helmet;
  helmet.camera = () => ({ x: 0, y: 0, width: 960, height: 600 });
  context.ending = { state: 'lost', elapsed: .2 };
  context.endingPose = () => ({ x: 120, y: 70, rotation: 2, scale: 1 });
  context.drawCat = () => calls.push(['cat']);
  vm.runInContext(app.slice(app.indexOf('function drawEnding('), app.indexOf('\nfunction render(')), context);
  context.drawEnding();
  const restored = calls.findIndex(([name]) => name === 'restore');
  const explosion = calls.findIndex(([name, x, y]) => name === 'translate' && x === 120 && y === 58);
  assert.ok(explosion > restored, 'explosion uses world coordinates after restoring the rotating death pose');
  assert.match(app, /if \(game\.boomHelmet\) drawBoomHelmet\(game\);/);
  calls.length = 0;
  const guideContext = makeContext();
  context.document = { createElement() {
    return { getContext: () => guideContext, setAttribute(name, value) { this[name] = value; } };
  } };
  vm.runInContext(app.slice(app.indexOf('function guidePicture('), app.indexOf('\nfunction showGuideChapter(')), context);
  const guideHelmet = context.guidePicture('special:boom-helmet', 'Boom Helmet');
  assert.equal(guideHelmet.role, 'img');
  assert.equal(guideHelmet['aria-label'], 'Boom Helmet');
  assert.ok(calls.some(([name, value]) => name === 'fillText' && value === '5'));
});

test('title screen provides accessible artwork and explicit game entry without external assets', () => {
  const root = path.resolve(__dirname, '..');
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  const styles = readFileSync(path.join(root, 'style.css'), 'utf8');
  const artwork = readFileSync(path.join(root, 'icons', 'title-scene.svg'), 'utf8');
  assert.match(html, /<dialog id="title-screen"[^>]+aria-labelledby="title-heading"[^>]+aria-describedby="title-tagline"/);
  assert.match(html, /id="title-start"[^>]+autofocus/);
  assert.doesNotMatch(html, /id="title-levels"|>Choose a level</);
  assert.match(html, /id="title-help"[^>]+>How to play<\/button>/);
  assert.match(html, /<dialog id="how-to-play"/);
  assert.match(html, /id="title-tagline">Save the world from evil robots with brute kitty force!</);
  assert.doesNotMatch(html, /SMALL PAWS\. MIGHTY COURAGE\.|A little cat\. A big appetite\. A world worth saving\./);
  assert.doesNotMatch(html, /field-guide|THE FIELD GUIDE/);
  const controls = html.slice(html.indexOf('<div class="game-controls">'), html.indexOf('<section id="tutorial-panel"'));
  assert.ok(controls, 'game controls share a container');
  for (const id of ['timer', 'level-number', 'exit-level', 'pause', 'restart']) {
    assert.ok(controls.includes(`id="${id}"`), `${id} belongs to the control row`);
  }
  assert.ok(!controls.includes('id="level-select"'), 'level selection is not on the game screen');
  assert.ok(!controls.includes('class="brand"'), 'the timer replaces the game-screen logo');
  const title = html.slice(html.indexOf('<dialog id="title-screen"'), html.indexOf('</dialog>', html.indexOf('<dialog id="title-screen"')));
  assert.ok(!title.includes('id="level-select"'));
  assert.match(html, /<dialog id="level-picker"[^>]+aria-labelledby="level-picker-heading"[\s\S]*?<select id="level-select"[\s\S]*?<\/dialog>/);
  assert.match(html, /class="pause-bars"><rect[^>]+\/><rect[^>]+\/>/);
  const hud = html.slice(html.indexOf('<div class="hud">'), html.indexOf('<div class="objective">'));
  assert.ok(!hud.includes('weapon-status'), 'weapon status is announced without taking up HUD space');
  assert.deepEqual([...hud.matchAll(/<span class="stat-label">([^<]+)<\/span>/g)].map(([, label]) => label),
    ["KOSHI'S HEALTH", 'FOOD', 'ENEMIES', 'GOALS', 'KEYS', 'BATTERIES']);
  assert.match(html, /id="weapon-status" class="visually-hidden"[^>]+role="status"/);
  assert.ok(hud.includes('id="goal-count"'));
  assert.ok(!hud.includes('id="timer"'), 'time is shown in the top-left control row');
  assert.match(styles, /\.hud \{ display: grid; grid-template-columns: repeat\(6, minmax\(0, 1fr\)\);/);
  assert.match(styles, /\.timer-stat \{ padding: 6px 0 0; text-align: center;/);
  assert.match(styles, /\.game-controls \{[^}]*grid-template-columns: calc\(\(100% - 5 \* var\(--hud-gap\)\) \/ 6\)[^}]*padding: 4px var\(--hud-inset\);/);
  assert.match(styles, /\.hud \{[^}]*padding: 22px var\(--hud-inset\); gap: var\(--hud-gap\);/);
  assert.match(styles, /\.tutorial-active \.hud \{ display: grid; grid-template-columns: repeat\(6, minmax\(0, 1fr\)\);/);
  const mobileHud = styles.slice(styles.indexOf('@media (max-width: 760px), (max-width: 1000px) and (max-height: 500px) and (orientation: landscape)'));
  assert.match(mobileHud, /\.stat-label \{ font-size: 8px;/);
  assert.match(mobileHud, /\.stat\.lives \.stat-label \{ max-width: 62px;[\s\S]*?font-size: 8px;[\s\S]*?white-space: normal;/);
  for (const [id, label] of [['exit-level', 'Exit level'], ['pause', 'Pause'], ['restart', 'Restart']]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*aria-label="${label}"`));
  }
  assert.doesNotMatch(controls, /☰/, 'the old menu glyph is gone');
  assert.match(controls, /id="exit-level"[^>]*><svg class="control-icon exit-icon"[^>]*>[\s\S]*?class="exit-door"/);
  assert.match(html, /<dialog id="exit-confirm"[\s\S]*?id="exit-confirm-end"[^>]*>End Level<\/button>[\s\S]*?id="exit-confirm-cancel"[^>]*>Cancel<\/button>[\s\S]*?<\/dialog>/);
  const appSource = readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
  const endHandler = appSource.slice(appSource.indexOf("querySelector('#exit-confirm-end')"));
  assert.match(endHandler.slice(0, endHandler.indexOf('\n});')), /openLevelPicker\(\{ insideWorld: true/);
  assert.match(html, /src="\.\/icons\/title-scene\.svg"[^>]+alt="[^"]+Koshi[^"]+Robo Mouse[^"]+Robo Wheel/);
  assert.match(artwork, /<title>.+<\/title>/);
  assert.match(artwork, /<desc>.+<\/desc>/);
  for (const color of ['#83bca1', '#7eacdb', '#df8c81']) assert.ok(artwork.includes(color));
  assert.doesNotMatch(artwork, /<(?:script|image)\b|\bhref=/);
  assert.ok(readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'./icons/title-scene.svg'"));
});

test('viewed cutscenes persist and restarting the level skips the scene', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const helpers = source.slice(source.indexOf('function reportCutsceneStorageError('), source.indexOf('\nfunction saveAttempt('));
  const stored = new Map(), messages = [];
  const context = vm.createContext({
    viewedCutscenes: new Set(),
    activeSave: { index: 0, slot: { id: 'slot-a' } }, runSave: { id: 'slot-a' }, game: { customLevel: false },
    campaignMode: require('../src/campaign-mode.js'), campaignId: 'beta', LEVELS,
    localStorage: {
      getItem(key) { return stored.get(key) ?? null; },
      setItem(key, value) { stored.set(key, value); },
    },
    document: { querySelector() { return { textContent: '', hidden: true }; } },
    console: { error(...args) { messages.push(args); } },
  });
  vm.runInContext(helpers, context);
  stored.set('koshi-cutscene-viewed:1-1', 'true');
  assert.equal(context.isCutsceneViewed('1-1'), false);
  context.markCutsceneViewed('1-1');
  assert.equal(context.isCutsceneViewed('1-1'), true);
  context.viewedCutscenes.clear();
  assert.equal(context.isCutsceneViewed('1-1'), true, 'the viewed state survives a reload');
  assert.equal(messages.length, 0);
  context.activeSave = { index: 1, slot: { id: 'slot-b' } };
  assert.equal(context.isCutsceneViewed('1-1'), false, 'another slot has not seen the scene');
  context.runSave = { id: 'slot-b' };
  context.markCutsceneViewed('1-1');
  assert.equal(context.isCutsceneViewed('1-1'), true);
  context.activeSave = { index: 0, slot: { id: 'replacement-a' } };
  assert.equal(context.isCutsceneViewed('1-1'), false, 'replacement saves do not inherit viewing');
  context.campaignId = 'official';
  context.activeSave = { index: 0, slot: { id: 'slot-a' } };
  assert.equal(context.isCutsceneViewed('1-1'), false, 'another campaign does not inherit viewing');
  context.campaignId = 'beta';
  context.activeSave = null; context.runSave = null;
  const storedCount = stored.size;
  context.markCutsceneViewed('1-1');
  assert.equal(context.isCutsceneViewed('1-1'), false);
  assert.equal(stored.size, storedCount, 'unsaved viewing is not persisted');
  context.activeSave = { index: 0, slot: { id: 'slot-a' } };
  context.runSave = { id: 'slot-a' };

  const begin = source.slice(source.indexOf('function begin()'), source.indexOf('\nfunction startLevel()'));
  const dialog = () => ({ open: true, close() { this.open = false; } });
  const skipCutscene = { checked: false };
  let opened = 0, briefings = 0;
  Object.assign(context, {
    phaseTransition: { run(action) { action(); } },
    titleScreen: dialog(), saveDialog: dialog(), levelPicker: dialog(),
    skipCutscene, activeSave: { index: 0, slot: { id: 'slot-a' } }, tutorial: null,
    createGame() { return { level: { id: '1-1', number: '1-1', cutscene: {} }, customLevel: false }; },
    makeAttemptId() { return 'attempt'; }, saveResult() {}, updateSaveProfile() {}, makeBrickButtons() {},
    displayedState: null, trail: [], toast: { textContent: '' }, lastTime: null,
    resize() {}, syncUI() {}, overlay: { hidden: false },
    cutscene: { open() { opened++; } }, showLevelBriefing() { briefings++; },
    showLevelInformation() { context.showLevelBriefing(); },
  });
  vm.runInContext(source.slice(source.indexOf('function showLevelIntroduction('),
    source.indexOf('\nfunction showLevelInformation(')), context);
  vm.runInContext(begin, context);
  context.begin();
  assert.equal(opened, 1, 'the first visit opens its cutscene');
  skipCutscene.checked = true;
  context.begin();
  assert.equal(opened, 1, 'the retry does not repeat the viewed cutscene');
  assert.equal(briefings, 1, 'skipping still presents the level briefing');
  context.activeSave = null;
  context.begin();
  assert.equal(opened, 2, 'unsaved retries show the cutscene despite the skip checkbox');
  context.begin();
  assert.equal(opened, 3, 'unsaved viewing never carries into the next attempt');
  context.activeSave = { index: 1, slot: { id: 'new-slot' } };
  context.begin();
  assert.equal(opened, 4, 'switching to an unseen save ignores a stale checked skip checkbox');
});

test('HUD counters follow health, food, enemies, soccer goals, keys, batteries order', () => {
  const html = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const hud = html.slice(html.indexOf('<div class="hud">'), html.indexOf('<div class="objective">'));
  assert.deepEqual([...hud.matchAll(/<strong id="([^"]+)"/g)].map(match => match[1]),
    ['hearts', 'food-count', 'enemy-count', 'goal-count', 'key-count', 'battery-count']);
});

test('Start on a level briefing begins the existing level instead of rebuilding it', () => {
  assert.doesNotMatch(readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), /dialog-note/);
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert.match(source, /showDialog\(`LEVEL \$\{game\.level\.number \?\? game\.level\.id\}`, 'Ready for this level\?', description, 'Start', '🐾'\)/);
  const start = source.indexOf("\nplay.addEventListener('click'") + 1;
  const end = source.indexOf("\nrestart.addEventListener", start);
  const handler = source.slice(start, end);
  const play = { addEventListener(name, callback) { this[name] = callback; } };
  const pause = { focus() {} };
  let started = 0, rebuilt = 0, maps = 0;
  const game = { state: 'ready', levelIndex: 0, customLevel: null, start() { started++; this.state = 'playing'; }, resume() { this.state = 'playing'; } };
  const context = vm.createContext({
    play, pause, game, lastTime: 0, syncUI() {},
    startLevel() { game.start(); },
    begin() { rebuilt++; },
    openLevelPicker({ level, insideWorld, advance }) {
      maps++;
      assert.equal(insideWorld, true);
      assert.equal(advance, true);
      context.levelSelect.value = String(level);
    },
    levelSelect: { value: '0' },
    LEVELS: [{ id: '1–1' }, { id: '1–2' }],
    nextLevelIndex: index => index === 0 ? 1 : -1,
  });

  vm.runInContext(handler, context);
  play.click();
  assert.equal(started, 1);
  assert.equal(rebuilt, 0);

  game.state = 'won';
  play.click();
  assert.equal(rebuilt, 0);
  assert.equal(maps, 1);
  assert.equal(context.levelSelect.value, '0', 'campaign advance starts the map animation at the completed level');
  game.state = 'lost';
  play.click();
  assert.equal(rebuilt, 1, 'retry rebuilds into a fresh briefing');
  game.state = 'won'; game.levelIndex = 1;
  play.click();
  assert.equal(maps, 2, 'final campaign level also returns to selection');
  assert.equal(context.levelSelect.value, '1');
  game.customLevel = {};
  play.click();
  assert.equal(rebuilt, 2, 'custom playtests can replay without campaign maps');
});

test('opening briefings omit the Cat Brick objective and graphic after acquisition', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const node = () => ({
    children: [], textContent: '', attributes: {}, listeners: {},
    append(...children) { for (const child of children) child.parentElement = this; this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, listener) { this.listeners[name] = listener; },
  });
  const context = vm.createContext({
    document: { createElement: node }, KoshiGame: require('../src/game.js'),
    KoshiWorlds: {}, KoshiSaves: {}, KoshiCollectibles: {}, KoshiCatTown: {},
  });
  vm.runInContext(readFileSync(path.join(__dirname, '..', 'src', 'world-map.js'), 'utf8'), context);
  vm.runInContext(source.slice(source.indexOf('function levelBriefingText('), source.indexOf('\nfunction showDialog(')), context);
  for (const [level, expected] of [
    [{ duration: 60, goal: 20 }, 'VICTORY CONDITIONS:\n🍗 Target: 20'],
    [{ duration: 60, goal: 0, killGoal: 5 }, 'VICTORY CONDITIONS:\n👾 Target: 5'],
    [{ duration: 60, goalsGoal: 3 }, 'VICTORY CONDITIONS:\n⚽ Target: 3'],
    [{ duration: 60, goal: 10, killGoal: 5, goalsGoal: 2 }, 'VICTORY CONDITIONS:\n🍗 Target: 10\n👾 Target: 5\n⚽ Target: 2'],
    [{ duration: 90, goal: 0, survive: true }, 'VICTORY CONDITIONS:\n🕒 Survive Time: 90'],
    [{ duration: 60, goal: 0, bossLevel: true }, 'VICTORY CONDITIONS:\nDefeat Tom the Toaster with 6 Boost hits while he is dizzy. No time limit.'],
  ]) {
    assert.equal(context.levelBriefingText(level), expected);
    const container = node();
    context.renderLevelBriefing(container, level, false);
    assert.equal(container.children.length, 1);
    const conditions = container.children[0];
    assert.equal([conditions.children[0].textContent,
      ...conditions.children.slice(1).map(row => row.children[0].textContent)].join('\n'), expected);
    const targets = context.KoshiWorldMap.objectiveTargets(level);
    const labels = level.survive ? targets.slice(0, 1) : level.bossLevel
      ? targets.filter(target => target.value === 'BOSS') : targets.slice(1);
    conditions.children.slice(1).forEach((row, index) => {
      const [button, hint] = row.children;
      assert.equal(button.type, 'button');
      assert.equal(button.attributes['aria-label'], labels[index].label);
      assert.equal(button.attributes['aria-controls'], hint.id);
      assert.equal(hint.textContent, labels[index].label);
      assert.equal(hint.hidden, true);
      button.listeners.click();
      assert.equal(hint.hidden, false);
      button.listeners.keydown({ key: 'Escape' });
      assert.equal(hint.hidden, true);
      button.listeners.focus();
      assert.equal(hint.hidden, false);
      button.listeners.blur();
      assert.equal(hint.hidden, true);
    });
    for (const acquired of [false, true]) {
      const description = 'Defeat the marked enemy in the first patrol.';
      context.renderLevelBriefing(container, { ...level, catBlock: { description } }, acquired);
      assert.equal(container.children.length, acquired ? 1 : 2);
      if (acquired) continue;
      const [image, hint] = container.children[1].children;
      assert.equal(image.src, './icons/cat-building-block.png');
      assert.equal(image.alt, 'Cat Block');
      assert.equal(hint.textContent, description);
    }
    context.renderLevelBriefing(container, level, false);
    assert.equal(container.children.length, 1, 'switching levels removes stale Cat Block sections');
  }
  for (const level of require('../src/game.js').LEVELS.filter(level => level.catBlock)) {
    const container = node();
    context.renderLevelBriefing(container, level);
    assert.equal(container.children[1].children[1].textContent, context.KoshiGame.catBlockObjective(level));
    assert.match(container.children[1].children[1].textContent, /^To earn Cat Brick: /);
  }
  assert.match(source, /renderLevelBriefing\(content, game\.level, game\.catBlockPreviouslyCollected\)/);
});

test('soccer goal and ball guide illustrations use shared artwork', () => {
  const app = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const source = app.slice(app.indexOf('function guidePicture('), app.indexOf('\nfunction showGuideChapter('));
  const calls = [];
  const canvasContext = { scale() {} };
  const document = {
    createElement(tag) {
      return tag === 'canvas'
        ? { getContext: () => canvasContext, setAttribute(name, value) { this[name] = value; } }
        : { setAttribute(name, value) { this[name] = value; } };
    },
  };
  const context = vm.createContext({
    document, ctx: null,
    decorateBrick(_element, brick) { calls.push(['goal', brick.kind]); },
    drawSoccerBall(ctx, ball) { calls.push(['ball', ctx === canvasContext, ball.radius]); },
  });
  vm.runInContext(source, context);
  context.guidePicture('special:goal', 'Soccer goals');
  context.guidePicture('object:soccer-ball', 'Soccer Ball');
  assert.deepEqual(calls, [['goal', 'goal'], ['ball', true, 16]]);

  const makeButtons = app.slice(app.indexOf('function makeBrickButtons('), app.indexOf('\nfunction syncBrickDestructions('));
  assert.match(makeButtons, /button\.disabled = brick\.kind === 'cinder' \|\| brick\.kind === 'goal'/);
  assert.match(makeButtons, /brick\.kind === 'goal' \|\| brick\.kind === 'cinder'/);
  const sync = app.slice(app.indexOf('function syncUI('), app.indexOf('\nfunction begin('));
  assert.match(sync, /scoring goal, cannot be activated or changed, and cannot be absorbed/);
  assert.match(sync, /!\['cinder', 'goal'\]\.includes\(brick\.kind\)/);
});

test('level popup commits only on Play and cancellation restores selection and menu focus', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      open: false, listeners: {},
      addEventListener(name, listener) { this.listeners[name] = listener; },
      showModal() { this.open = true; },
      close() { this.open = false; },
      focus() { this.focused = true; },
    });
    return elements.get(id);
  };
  const titleScreen = element('#title-screen');
  titleScreen.open = true;
  const levelSelect = element('#level-select');
  levelSelect.value = '3';
  let starts = 0;
  const context = vm.createContext({
    document: { querySelector: element }, titleScreen, levelSelect, saveDialog: element('#save-slots'), autoPause() {},
    guidePicture() {}, guestProfile: {}, customLevel: null,
    drawCutsceneCharacter() {},
    isCutsceneViewed() { return false; },
    LEVELS: [], WORLDS: [],
    KoshiWorldMap: class {
      constructor() { this.layout = { dataset: { view: 'worlds' } }; }
      open() {}
    },
    KoshiCatTown: { CatTown: class {} },
    begin() { starts++; element('#level-picker').close(); },
  });
  vm.runInContext(source.slice(source.indexOf('function openLevelPicker('),
    source.indexOf('function dismissTitle()')), context);
  const picker = element('#level-picker');
  const open = () => context.openLevelPicker();
  open();
  assert.equal(picker.open, true);
  assert.equal(titleScreen.open, false);
  assert.equal(element('.map-node[aria-pressed="true"]').focused, true);
  for (const cancel of [
    () => element('#level-picker-close').listeners.click(),
    () => picker.listeners.cancel({ preventDefault() {} }),
    () => picker.listeners.keydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} }),
  ]) {
    levelSelect.value = '18';
    cancel();
    assert.equal(picker.open, false);
    assert.equal(titleScreen.open, true);
    assert.equal(levelSelect.value, '3');
    assert.equal(element('#title-start').focused, true);
    assert.equal(starts, 0);
    open();
  }
  levelSelect.value = 'custom';
  element('#level-picker-play').listeners.click();
  assert.equal(levelSelect.value, 'custom');
  assert.equal(picker.open, false);
  assert.equal(titleScreen.open, false);
  assert.equal(starts, 1);
});

test('the main button continues the most recent save, or starts a guest adventure without saves', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const actions = [], listeners = {};
  let recent = null;
  const context = vm.createContext({
    document: { querySelector: () => ({ addEventListener: (name, listener) => { listeners[name] = listener; } }) },
    openLevelPicker: options => actions.push(options),
    recentSave: () => recent,
    saveAttempt: action => action(),
    continueSave: (index, id) => actions.push(['continue', index, id]),
    game: { customLevel: null },
    phaseTransition: { run: action => action() },
    titleScreen: { close() { actions.push('close'); } },
    play: { focus() { actions.push('focus'); } },
  });
  const start = source.indexOf("document.querySelector('#title-start').addEventListener");
  vm.runInContext(source.slice(start, source.indexOf('function openLevelPicker(', start)), context);
  listeners.click();
  assert.equal(actions[0], undefined, 'guest adventure keeps the restored map selection');
  recent = { index: 2, slot: { id: 'slot-c', owner: 'Mia' } };
  listeners.click();
  assert.deepEqual(actions[1], ['continue', 2, 'slot-c']);
  actions.splice(1);
  const dismiss = source.indexOf('function dismissTitle()');
  vm.runInContext(source.slice(dismiss, source.indexOf("titleScreen.addEventListener('cancel'", dismiss)), context);
  context.dismissTitle();
  assert.equal(actions.length, 2);
  assert.equal(actions[1], undefined, 'Escape opens the map without a level override');
  context.game.customLevel = {};
  context.dismissTitle();
  assert.deepEqual(actions.slice(2), ['close', 'focus'], 'custom editor flow stays unchanged');
});

test('level begins with three hearts, no enemies, and correct boundary brick mix', () => {
  const game = new Game();
  assert.equal(game.state, 'ready');
  assert.equal(game.hearts, 3);
  assert.equal(game.enemies, 0);
  assert.equal(game.bricks.length, 26);
  assert.equal(game.bricks.filter(b => b.kind === 'slow').length, 1);
  assert.equal(game.bricks.filter(b => b.kind === 'fast').length, 1);
  assert.equal(game.steer(0, 25, 25), false);
  game.update(5);
  assert.equal(game.elapsed, 0);
});

test('steering targets exact click, redirects in flight, and enforces each cooldown', () => {
  for (const kind of Object.keys(COOLDOWNS)) {
    const game = playing();
    const brick = game.bricks.find(b => b.kind === kind && b.absorbedBy === null);
    const x = brick.x + 3, y = brick.y + 7;
    assert.equal(game.steer(brick.id, x, y), true);
    assert.deepEqual(game.target, { x, y });
    assert.ok(Math.abs(Math.hypot(game.cat.vx, game.cat.vy) - SPEED) < 1e-8);
    assert.equal(brick.readyAt, COOLDOWNS[kind]);
    assert.equal(aim(game, brick), false);
    assert.equal(aim(game, game.bricks.find(b => b.id !== brick.id && b.absorbedBy === null)), true);
    game.update(COOLDOWNS[kind] + .01);
    game.cat.x = game.width / 2;
    game.cat.y = game.height / 2;
    assert.equal(aim(game, brick), true);
  }
});

test('Koshi stops at first brick and can leave it on his next launch', () => {
  const game = playing();
  aim(game, game.bricks[10]);
  game.update(3);
  assert.equal(game.cat.vx, 0);
  assert.equal(game.cat.vy, 0);
  assert.equal(game.target, null);
  assert.ok(game.cat.y >= 42 + game.cat.radius - 1e-8);
  const oldY = game.cat.y;
  assert.equal(aim(game, game.bricks[11]), true);
  game.update(.1);
  assert.ok(game.cat.y > oldY);
});

test('collision sweep catches walls, rounded corners, and ignores travel away', () => {
  const brick = { x: 100, y: 100, w: 50, h: 20 };
  assert.equal(brickContact(0, 110, 200, 0, 10, brick), .45);
  assert.equal(brickContact(90, 110, -20, 0, 10, brick), Infinity);
  const corner = brickContact(50, 50, 100, 100, 10, brick);
  assert.ok(Math.abs(corner - (50 - 10 / Math.sqrt(2)) / 100) < 1e-8);
  assert.equal(brickContact(50, 50, 0, 0, 10, brick), Infinity);
});

test('the full schedule spawns at prescribed times with exact types and expiry', () => {
  const game = playing();
  const events = [];
  const spawn = game.spawn.bind(game);
  game.spawn = event => {
    const before = game.food.length;
    spawn(event);
    const added = game.food.slice(before);
    events.push(event);
    assert.equal(added.length, event[1] === 'S' ? 1 : Number(event[1].slice(1)));
    for (const food of added) {
      assert.equal(food.type, event[2]);
      assert.equal(food.expires, event[0] + event[3]);
    }
  };
  game.cat.x = 80; game.cat.y = 80;
  game.update(60);
  assert.deepEqual(events, SCHEDULE);
  assert.equal(game.state, 'lost');
  assert.equal(game.elapsed, 60);
  assert.equal(game.food.length, 0);
});

test('food patterns are accessible, lines straight, and circles equally spaced', () => {
  for (const random of [() => 0, () => .99999, Math.random]) {
    for (let attempt = 0; attempt < 30; attempt++) {
      for (const event of SCHEDULE) {
        const game = new Game(random);
        game.spawn(event);
        for (const food of game.food) {
          assert.ok(food.x >= 60 && food.x <= 900 && food.y >= 60 && food.y <= 540);
          for (const brick of game.bricks) {
            const nearestX = Math.max(brick.x, Math.min(brick.x + brick.w, food.x));
            const nearestY = Math.max(brick.y, Math.min(brick.y + brick.h, food.y));
            assert.ok(Math.hypot(food.x - nearestX, food.y - nearestY) > 33);
          }
        }
        if (event[1] === 'L3') {
          const [a, b, c] = game.food;
          assert.ok(Math.abs(a.x + c.x - 2 * b.x) < 1e-8);
          assert.ok(Math.abs(a.y + c.y - 2 * b.y) < 1e-8);
          assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 55) < 1e-8);
        }
        if (event[1].startsWith('C')) {
          const count = game.food.length;
          const cx = game.food.reduce((sum, f) => sum + f.x, 0) / count;
          const cy = game.food.reduce((sum, f) => sum + f.y, 0) / count;
          for (let i = 0; i < count; i++) {
            const a = game.food[i], b = game.food[(i + 1) % count];
            assert.ok(Math.abs(Math.hypot(a.x - cx, a.y - cy) - 88) < 1e-8);
            assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 176 * Math.sin(Math.PI / count)) < 1e-8);
          }
        }
      }
    }
  }
});

test('all seven foods award their documented values, including swept pickups', () => {
  assert.deepEqual(Object.values(FOODS).map(f => f.value), [1, 2, 3, 4, 5, 6, 7]);
  for (const [type, info] of Object.entries(FOODS)) {
    const game = playing();
    game.food = [{ x: 510, y: 300, type, expires: 5 }];
    game.cat.vx = SPEED;
    game.update(.2);
    assert.equal(game.score, info.value);
    assert.equal(game.food.length, 0);
  }
});

test('expired food cannot be collected and food expiry freezes while paused', () => {
  const game = playing();
  game.food = [{ x: 480, y: 300, type: 'H', expires: .001 }];
  game.update(.01);
  assert.equal(game.score, 0);
  game.pause();
  const elapsed = game.elapsed;
  game.update(60);
  assert.equal(game.elapsed, elapsed);
  game.resume();
  game.update(1);
  assert.ok(game.elapsed > elapsed);
});

test('victory, timer loss, edge death, heart death, and reset are persistent states', () => {
  const game = playing();
  game.score = 19;
  game.food = [{ x: 480, y: 300, type: 'S', expires: 5 }];
  game.update(.01);
  assert.equal(game.state, 'won');
  const elapsed = game.elapsed;
  game.update(10);
  assert.equal(game.elapsed, elapsed);
  game.reset(); game.start();
  game.cat.x = 21; game.cat.vx = -SPEED;
  game.update(.01);
  assert.equal(game.state, 'lost');
  game.reset(); game.start(); game.hearts = 0; game.update(.01);
  assert.equal(game.state, 'lost');
  game.reset();
  assert.equal(game.state, 'ready');
  assert.equal(game.score, 0);
  assert.equal(game.hearts, 3);
  assert.ok(game.bricks.every(b => b.readyAt === 0));
});

test('invalid input does not consume cooldowns or corrupt the simulation', () => {
  const game = playing();
  for (const [id, x, y] of [[999, 0, 0], [0, NaN, 20], [0, 480, 300]]) {
    assert.equal(game.steer(id, x, y), false);
  }
  game.update(NaN); game.update(-1); game.update(Infinity);
  assert.equal(game.elapsed, 0);
  assert.equal(game.bricks[0].readyAt, 0);
});

test('portrait boards preserve brick thickness, correct boundaries, and reachable food', () => {
  for (const scale of [.36, .46, .57, .64, 1]) {
    for (const random of [() => 0, () => .5, () => .99999]) {
      const game = new Game(random, { portrait: true, scale });
      assert.equal(game.width, 600);
      assert.equal(game.height, 960);
      assert.deepEqual([game.cat.x, game.cat.y], [300, 480]);
      assert.equal(game.bricks.filter(b => b.kind === 'slow').length, 1);
      assert.equal(game.bricks.filter(b => b.kind === 'fast').length, 1);
      for (const brick of game.bricks) {
        assert.ok(Math.max(brick.w, brick.h) * scale >= 44);
        assert.ok(Math.min(brick.w, brick.h) > 0);
        assert.ok(brick.x >= 0 && brick.y >= 0);
        assert.ok(brick.x + brick.w <= game.width && brick.y + brick.h <= game.height);
      }
      for (const event of SCHEDULE) {
        game.food = [];
        game.spawn(event);
        for (const food of game.food) {
          for (const brick of game.bricks) {
            const x = Math.max(brick.x, Math.min(brick.x + brick.w, food.x));
            const y = Math.max(brick.y, Math.min(brick.y + brick.h, food.y));
            assert.ok(Math.hypot(food.x - x, food.y - y) > 33);
          }
        }
        if (event[1].startsWith('C')) {
          const cx = game.food.reduce((sum, f) => sum + f.x, 0) / game.food.length;
          const cy = game.food.reduce((sum, f) => sum + f.y, 0) / game.food.length;
          for (const food of game.food) assert.ok(Math.abs(Math.hypot(food.x - cx, food.y - cy) - 88) < 1e-8);
        }
      }
      game.food = [];
      game.start();
      aim(game, game.bricks[0]);
      game.update(1.5);
      assert.equal(game.state, 'playing');
      assert.equal(game.cat.vy, 0);
      assert.ok(game.cat.y >= game.bricks[0].y + game.bricks[0].h + game.cat.radius - 1e-8);
      const opposite = game.bricks.reduce((best, brick) =>
        brick.y > best.y || (brick.y === best.y && brick.x > best.x) ? brick : best);
      aim(game, opposite);
      const oldY = game.cat.y;
      game.update(.1);
      assert.ok(game.cat.y > oldY);
      game.reset();
      assert.equal(game.width, 600);
      assert.deepEqual([game.cat.x, game.cat.y], [300, 480]);
      game.start();
      game.cat.x = 600;
      game.update(.01);
      assert.equal(game.state, 'lost');
    }
  }
});
