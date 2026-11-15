const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, WIDTH, HEIGHT, makeBricks, boardDimensions, cameraAt, validateCustomLevel, brickRegions, CAT_BLOCK_TRIGGERS, catBlockDescription, catBlockObjective } = require('../src/game.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const blank = () => ({ version: 1, id: 'Scrolling test', duration: 60, goal: 0, survive: true, heartCost: null, brickSet: 1, events: [] });
const scrolling = () => ({ ...blank(), autoscroll: { length: 24, speed: .25, events: [{ time: 10, speed: 0 }, { time: 15, speed: .5 }] } });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('screen-crossing events round-trip and reject invalid percentages or incompatible placements', () => {
  const placement = { kind: 'food', type: 'S', x: .5, y: .5, lifetime: 5, spawnPercent: 50 };
  const level = { ...scrolling(), events: [placement] };
  const normalized = validateCustomLevel(level);
  assert.deepEqual(normalized.events[0], { ...placement, time: 0 });
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(normalized))), normalized);
  assert.equal(Object.hasOwn(placement, 'time'), false, 'validation does not mutate authored events');
  for (const spawnPercent of [-1, 101, NaN, Infinity, '50', null]) {
    assert.throws(() => validateCustomLevel({ ...level, events: [{ ...placement, spawnPercent }] }), /percentage/);
  }
  assert.throws(() => validateCustomLevel({ ...blank(), events: [placement] }), /autoscrolling/);
  assert.throws(() => validateCustomLevel({ ...level, events: [{ ...placement, random: true }] }), /fixed center/);
  for (const spawnPercent of [0, 100]) {
    assert.equal(validateCustomLevel({ ...level, events: [{ ...placement, spawnPercent }] }).events[0].spawnPercent, spawnPercent);
  }
});

test('screen crossing measures exact center progress in desktop, phone and legacy portrait coordinates', () => {
  for (const options of [{}, { portrait: true, scale: .5 },
    { portrait: true, customCoordinateOrientation: 'viewport', scale: .5 }]) {
    const placement = { kind: 'food', type: 'S', time: 0, x: .5, y: .5, lifetime: 5 };
    const game = new Game(() => .5, { ...options, customLevel: scrolling() });
    for (const spawnPercent of [0, 25, 50, 100]) {
      const event = { ...placement, spawnPercent };
      const time = game.eventAppearanceTime(event);
      const point = game.campaignEventPoint(event.x, event.y), camera = game.camera(time);
      const crossed = game.landscapePortrait ? (point.y - camera.y) / camera.height
        : game.portrait ? 1 - (point.y - camera.y) / camera.height : 1 - (point.x - camera.x) / camera.width;
      close(crossed * 100, spawnPercent);
      assert.equal(game.eventAppearanceTime(placement), 0);
    }
  }
});

test('screen-crossing times include camera stops, restart deterministically, and preserve authored data', () => {
  const game = new Game(() => .5, { customLevel: scrolling() });
  const pitch = boardDimensions().pitch, b = game.bounds();
  const x = (WIDTH + 3 * pitch - b.left) / (b.right - b.left);
  const placement = { kind: 'food', type: 'S', x, y: .5, spawnPercent: 0, lifetime: 5 };
  const level = { ...scrolling(), events: [placement,
    { kind: 'food', type: 'S', x: .95, y: .2, time: 1, lifetime: 10 }] };
  const original = JSON.stringify(level);
  const runtime = new Game(() => .5, { customLevel: level });
  close(runtime.eventAppearanceTime(placement), 16);
  assert.deepEqual(runtime.customEvents.map(event => event.time), [1, 16]);
  runtime.start();
  runtime.elapsed = 15;
  runtime.prepareSpawns();
  runtime.spawnCustomEvents();
  assert.equal(runtime.food.length, 1, 'legacy timed events still appear offscreen at their original time');
  assert.ok(runtime.spawnCues.some(cue => cue.kind === 'food'));
  runtime.elapsed = 16;
  runtime.spawnCustomEvents();
  const food = runtime.food.find(item => item.born === 16);
  assert.ok(food);
  close(food.expires, 21);
  runtime.spawnCustomEvents();
  assert.equal(runtime.food.length, 2, 'crossing spawns once');
  runtime.reset();
  close(runtime.customEvents[1].time, 16);
  assert.equal(runtime.nextCustom, 0);
  assert.equal(JSON.stringify(level), original);
});

test('already-crossed centers spawn at Start and unreachable centers do not block timed events', () => {
  const level = { ...scrolling(), autoscroll: { length: 24, speed: 0, events: [] }, events: [
    { kind: 'object', type: 'bumper-red', x: .1, y: .2, spawnPercent: 0 },
    { kind: 'object', type: 'bumper-red', x: .8, y: .2, spawnPercent: 50 },
    { kind: 'object', type: 'bumper-red', x: .2, y: .8, time: 2 },
  ] };
  const game = new Game(() => .5, { customLevel: level });
  assert.equal(game.eventAppearanceTime(level.events[0]), 0);
  assert.equal(game.eventAppearanceTime(level.events[1]), Infinity);
  game.start();
  assert.equal(game.bumpers.length, 1);
  game.elapsed = 2; game.prepareSpawns(); game.spawnCustomEvents();
  assert.equal(game.bumpers.length, 2);
  game.elapsed = 1000; game.prepareSpawns(); game.spawnCustomEvents();
  assert.equal(game.bumpers.length, 2);
  const end = new Game(() => .5, { customLevel: { ...level, autoscroll: { length: 24, speed: 10, events: [] } } });
  assert.equal(end.eventAppearanceTime({ ...level.events[1], x: 1, spawnPercent: 100 }), Infinity);
});

test('formations spawn together using their shared center and obstruction warnings use resolved times', () => {
  const event = { kind: 'object', type: 'obstruction-rectangle', x: .5, y: .5,
    spawnPercent: 50, group: { shape: 'line', count: 3, size: .2 } };
  const game = new Game(() => .5, { customLevel: { ...scrolling(), events: [event] } });
  const time = game.eventAppearanceTime(event);
  game.start(); game.elapsed = time - 1;
  game.prepareSpawns();
  assert.equal(game.spawnCues.length, 3);
  game.spawnCues.forEach(cue => close(cue.progress, .5));
  game.elapsed = time - .001; game.spawnCustomEvents();
  assert.equal(game.obstructions.length, 0);
  game.elapsed = time; game.spawnCustomEvents();
  assert.equal(game.obstructions.length, 3);
  const center = game.obstructions.reduce((sum, item) => sum + item.x, 0) / 3;
  close(center, game.camera().x + WIDTH / 2);
});

test('Cat Tracks begin moving at the resolved appearance time in both orientations', () => {
  const placement = { kind: 'object', type: 'bumper-red', x: .5, y: .4, spawnPercent: 50, track: 'rail' };
  const level = { ...scrolling(), events: [placement],
    tracks: [{ id: 'rail', nodes: [{ x: .3, y: .4 }, { x: .7, y: .4 }], speed: 20, closed: false }] };
  for (const portrait of [false, true]) {
    const game = new Game(() => .5, { portrait, customLevel: level });
    const time = game.eventAppearanceTime(placement);
    game.start(); game.elapsed = time; game.prepareSpawns(); game.spawnCustomEvents();
    assert.equal(game.bumpers.length, 1);
    const bumper = game.bumpers[0], initialDistance = bumper.trackDistance;
    close(bumper.trackBorn, time);
    game.elapsed += .5; game.updateCatTracks(.5);
    close(bumper.trackDistance, initialDistance + 10);
    const paused = new Game(() => .5, { portrait, customLevel: {
      ...level, autoscroll: { length: 24, speed: 0, events: [] },
    } });
    const point = paused.trackEventPoint(paused.customEvents[0], 30);
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), 'unreachable track previews stay at their initial center');
  }
});

test('autoscroll round-trips, sorts independent speed events, and rejects invalid schedules', () => {
  const source = scrolling();
  source.autoscroll.events.reverse();
  const normalized = validateCustomLevel(source);
  assert.deepEqual(normalized, scrolling());
  normalized.autoscroll.events[0].speed = 2;
  assert.equal(source.autoscroll.events[1].speed, 0);
  assert.equal(validateCustomLevel(blank()).autoscroll, undefined);
  for (const scroll of [
    null, true, [], { length: 7, speed: .25, events: [] },
    { length: 8.5, speed: .25, events: [] }, { length: 1001, speed: 0, events: [] },
    { length: 16, speed: -1, events: [] }, { length: 16, speed: Infinity, events: [] },
    { length: 16, speed: 0 }, { length: 16, speed: 0, events: [null] },
    { length: 16, speed: 0, events: [{ time: 60, speed: 1 }] },
    { length: 16, speed: 0, events: [{ time: 10, speed: -1 }] },
    { length: 16, speed: 0, events: [{ time: 10, speed: 1 }, { time: 10, speed: 0 }] },
  ]) assert.throws(() => validateCustomLevel({ ...blank(), autoscroll: scroll }), TypeError);
  assert.ok(LEVELS.filter(level => level.worldId !== '4').every(level => level.autoscroll === undefined));
});

test('long boards add bricks without scaling their geometry, including phone thickness', () => {
  for (const portrait of [false, true]) for (const scale of [1, .5]) {
    const base = makeBricks(portrait, scale), extended = makeBricks(portrait, scale, 24);
    assert.equal(extended.length, 58);
    const dimensions = boardDimensions(portrait, scale, 24);
    const regions = brickRegions(extended, dimensions.width, dimensions.height);
    const counts = { top: 0, bottom: 0, left: 0, right: 0 };
    for (const brick of extended) {
      counts[regions.get(brick.id).edge]++;
      assert.ok(brick.x >= 0 && brick.y >= 0);
      assert.ok(brick.x + brick.w <= dimensions.width && brick.y + brick.h <= dimensions.height);
      const original = base[brick.id < 10 ? brick.id : 10];
      close(brick.w, original.w); close(brick.h, original.h);
    }
    assert.deepEqual(counts, portrait ? { top: 5, bottom: 5, left: 24, right: 24 } : { top: 24, bottom: 24, left: 5, right: 5 });
  }
  assert.deepEqual(makeBricks(false, 1, 8), makeBricks());
  assert.equal(boardDimensions().width, WIDTH);
  assert.equal(boardDimensions().height, HEIGHT);
});

test('camera integrates exact speed boundaries, pauses, resumes, and stops permanently at the far end', () => {
  const scroll = scrolling().autoscroll;
  for (const portrait of [false, true]) {
    const { pitch, width, height } = boardDimensions(portrait, 1, scroll.length);
    const offset = time => cameraAt(scroll, time, portrait)[portrait ? 'y' : 'x'];
    close(offset(0), 0);
    close(offset(10), 2.5 * pitch);
    close(offset(12), offset(10));
    close(offset(15), offset(10));
    close(offset(17), 3.5 * pitch);
    close(offset(1000), portrait ? height - WIDTH : width - WIDTH);
    assert.equal(cameraAt(scroll, 1000, portrait).speed, 0);
    assert.equal(cameraAt(scroll, 12, portrait).speed, 0);
    close(offset(3), .75 * pitch);
  }
  assert.equal(cameraAt({ length: 8, speed: 1, events: [] }, 30).x, 0);
  assert.equal(cameraAt({ length: 24, speed: 0, events: [] }, 30).x, 0);
  close(cameraAt({ length: 24, speed: 1, events: [{ time: 0, speed: .5 }] }, 2).x, boardDimensions().pitch);
});

test('game camera freezes with game time, resets to the first screen, and offscreen events still spawn', () => {
  const level = scrolling();
  level.events = [{ kind: 'food', type: 'S', time: 1, x: .95, y: .5, lifetime: 30 }];
  const game = new Game(() => .5, { customLevel: level });
  assert.deepEqual(game.cat, { x: WIDTH / 2, y: HEIGHT / 2, radius: 21, vx: 0, vy: 0 });
  game.update(1);
  assert.equal(game.camera().x, 0);
  game.start();
  for (let i = 0; i < 120; i++) game.update(1 / 120);
  assert.equal(game.food.length, 1);
  assert.ok(game.food[0].x > game.camera().x + WIDTH);
  const camera = game.camera();
  game.pause(); game.update(1);
  assert.deepEqual(game.camera(), camera);
  game.resume(); game.update(.1);
  assert.ok(game.camera().x > camera.x);
  game.state = 'won';
  const endingCamera = game.camera();
  game.update(1); assert.deepEqual(game.camera(), endingCamera);
  game.reset(); assert.equal(game.camera().x, 0);
});

test('only visible brick targets can be activated, including merged parts', () => {
  const game = new Game(() => .5, { customLevel: scrolling() });
  game.start();
  const far = game.bricks.find(brick => brick.x > WIDTH);
  assert.equal(game.brickVisible(far), false);
  assert.equal(game.steer(far.id, far.x + far.w / 2, far.y + far.h / 2), false);
  assert.equal(game.moves, 0);
  const near = game.bricks.find(brick => brick.x + brick.w / 2 < WIDTH && brick.kind === 'normal');
  assert.equal(game.brickVisible(near), true);
  assert.equal(game.steer(near.id, near.x + near.w / 2, near.y + near.h / 2), true);
  far.absorbedBy = near.id;
  assert.equal(game.brickVisible(near), true);
  assert.equal(game.steer(near.id, far.x + far.w / 2, far.y + far.h / 2), false);
});

test('long-board combined brick IDs beyond a traditional board validate in both layouts', () => {
  const level = scrolling();
  level.brickGroups = [{ owner: 48, members: [48, 50, 52] }];
  const valid = validateCustomLevel(level);
  for (const portrait of [false, true]) {
    const game = new Game(() => .5, { customLevel: valid, portrait });
    assert.equal(game.bricks[50].absorbedBy, 48);
    assert.equal(game.bricks[52].absorbedBy, 48);
  }
});

test('browser pointer coordinates add the camera offset without shrinking the viewport', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const game = new Game(() => .5, { customLevel: scrolling() });
  game.elapsed = 20;
  const context = vm.createContext({ game, board: { clientLeft: 1, clientTop: 1, clientWidth: 480, clientHeight: 300,
    getBoundingClientRect: () => ({ left: 100, top: 200 }) } });
  vm.runInContext(source.slice(source.indexOf('function boardPoint('), source.indexOf('function makeBrickButtons(')), context);
  const point = context.boardPoint({ clientX: 341, clientY: 351 });
  close(point.x, game.camera().x + WIDTH / 2);
  close(point.y, HEIGHT / 2);
});

test('both canvas layers and brick controls use the same full-scale camera transform', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  for (const portrait of [false, true]) {
    const game = new Game(() => .5, { customLevel: scrolling(), portrait });
    game.elapsed = 20;
    const transforms = [], clears = [];
    const makeContext = () => new Proxy({}, { get(target, name) {
      if (name in target) return target[name];
      if (name === 'setTransform') return (...values) => transforms.push(values);
      if (name === 'clearRect') return (...values) => clears.push(values);
      return () => {};
    } });
    const bricks = { style: {} }, parts = game.brickParts();
    const buttons = game.bricks.map(brick => ({ brick, button: {}, members: parts.filter(part => part.id === brick.id) }));
    const context = vm.createContext({
      game, boardCtx: makeContext(), actorCtx: makeContext(), ctx: null, trail: [], ending: null, buttons,
      canvas: { width: game.viewportWidth / 2, height: game.viewportHeight / 2 },
      board: { clientWidth: game.viewportWidth / 2, clientHeight: game.viewportHeight / 2 },
      document: { querySelector: () => bricks },
      drawCat() {}, drawWornCape() {}, drawMusicStream() {}, drawSunglassesStream() {}, drawCapeStream() {}, drawMaskStream() {}, line() {},
    });
    vm.runInContext(source.slice(source.indexOf('function powerupStreamRows('), source.indexOf('\nfunction drawSpawnCue')), context);
    context.render(0);
    const camera = game.camera();
    assert.deepEqual(transforms, [
      [.5, 0, 0, .5, -camera.x / 2, -camera.y / 2],
      [.5, 0, 0, .5, -camera.x / 2, -camera.y / 2],
    ]);
    assert.deepEqual(clears, [
      [camera.x, camera.y, camera.width, camera.height],
      [camera.x, camera.y, camera.width, camera.height],
    ]);
    assert.equal(bricks.style.width, `${game.width / camera.width * 100}%`);
    assert.equal(bricks.style.height, `${game.height / camera.height * 100}%`);
    assert.ok(buttons.some(item => item.button.inert));
    assert.ok(buttons.some(item => !item.button.inert));
    for (const item of buttons) assert.equal(item.button.inert, !game.brickVisible(item.brick));
  }
});

test('editor camera timeline adds, edits, sorts and removes changes, restoring invalid inputs', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const node = () => ({ children: [], listeners: {}, value: '',
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(type, handler) { this.listeners[type] = handler; },
  });
  const nodes = new Map(), messages = [];
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, node());
    return nodes.get(selector);
  };
  let locked = false;
  const level = scrolling(), previewGame = new Game(() => .5, { customLevel: level });
  const context = vm.createContext({
    $, level, previewGame, readOnly: () => locked, document: { createElement: node },
    validateDraft: validateCustomLevel, markChanged() {}, render() {}, message: text => messages.push(text),
    attempt(action, onError) { try { action(); } catch (error) { messages.push(error.message); if (onError) onError(); } },
  });
  vm.runInContext(source.slice(source.indexOf('function updateAutoscrollSettings('), source.indexOf('function updateWinCondition(')), context);
  context.renderCameraTimeline();
  assert.equal($('#camera-events').children.length, 2);
  $('#timeline').value = 5;
  $('#add-camera-event').listeners.click();
  assert.deepEqual(Array.from(context.level.autoscroll.events, event => event.time), [5, 10, 15]);
  let row = $('#camera-events').children[0];
  let speed = row.children[1].children[0];
  speed.value = '0'; speed.listeners.change();
  assert.equal(context.level.autoscroll.events[0].speed, 0);
  row = $('#camera-events').children[0];
  const time = row.children[0].children[0];
  time.value = '15'; time.listeners.change();
  assert.equal(time.value, 5);
  assert.match(messages.at(-1), /distinct/);
  speed = row.children[1].children[0];
  speed.value = ''; speed.listeners.change();
  assert.equal(speed.value, 0);
  assert.match(messages.at(-1), /speed/i);
  row.children[2].listeners.click();
  assert.deepEqual(Array.from(context.level.autoscroll.events, event => event.time), [10, 15]);
  locked = true;
  const before = JSON.stringify(context.level);
  $('#add-camera-event').listeners.click();
  assert.equal(JSON.stringify(context.level), before);
  context.renderCameraTimeline();
  assert.equal($('#camera-access').disabled, true);
});

test('editor settings toggle autoscroll, enforce minimum length, and protect combined brick identities', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', listeners: {}, replaceChildren() {}, checkValidity: () => true,
      addEventListener(type, handler) { this.listeners[type] = handler; } });
    return nodes.get(selector);
  };
  const context = vm.createContext({ $, level: blank(), readOnly: () => false,
    CAT_BLOCK_TRIGGERS, catBlockDescription, catBlockObjective, validateDraft: validateCustomLevel,
    attempt: action => action(), markChanged() {}, render() {}, message() {} });
  vm.runInContext(source.slice(source.indexOf("$('#settings-form').addEventListener"), source.indexOf('function addSceneLine(')), context);
  context.populateSettings();
  assert.equal($('#autoscroll-settings').disabled, true);
  $('#autoscroll-enabled').checked = true;
  $('#autoscroll-enabled').listeners.change();
  assert.equal($('#autoscroll-settings').disabled, false);
  const apply = () => $('#settings-form').listeners.submit({ preventDefault() {} });
  $('#scroll-length').value = 7;
  assert.throws(apply, /length/i);
  assert.equal(context.level.autoscroll, undefined);
  $('#scroll-length').value = 24; $('#scroll-speed').value = 0;
  apply();
  assert.equal(context.level.autoscroll.length, 24);
  assert.equal(context.level.autoscroll.speed, 0);
  context.level.brickGroups = [{ owner: 48, members: [48, 50] }];
  $('#scroll-length').value = 8;
  assert.throws(apply, /Split combined bricks/);
  assert.equal(context.level.autoscroll.length, 24);
  context.level.brickGroups = [];
  apply();
  assert.equal(new Game(() => .5, { customLevel: context.level }).width, WIDTH);
  $('#autoscroll-enabled').checked = false;
  apply();
  assert.equal(context.level.autoscroll, undefined);
});

test('scrolling kills only once Koshi is completely offscreen in any direction, bypassing all protection', () => {
  for (const portrait of [false, true]) for (const side of ['left', 'right', 'top', 'bottom']) {
    const game = new Game(() => .5, { customLevel: scrolling(), portrait });
    game.start(); game.elapsed = 20;
    const camera = game.camera(), cat = game.cat, radius = cat.radius;
    cat.x = camera.x + camera.width / 2; cat.y = camera.y + camera.height / 2;
    const axis = ['left', 'right'].includes(side) ? 'x' : 'y';
    const edge = side === 'left' ? camera.x : side === 'right' ? camera.x + camera.width
      : side === 'top' ? camera.y : camera.y + camera.height;
    const sign = ['left', 'top'].includes(side) ? -1 : 1;
    cat[axis] = edge + sign * (radius - .01);
    assert.equal(game.checkOffscreenDeath(), false, 'even a sliver of Koshi still on screen is alive');
    game.invulnerableUntil = Infinity; game.sunglassesUntil = Infinity; game.maskUntil = Infinity;
    game.capeUntil = Infinity;
    cat[axis] = edge + sign * radius;
    cat.vx = 100; cat.vy = 100; game.target = { x: 10, y: 10 };
    assert.equal(game.checkOffscreenDeath(), true);
    assert.equal(game.state, 'lost'); assert.equal(game.hearts, 0);
    assert.equal(game.offscreenDeath, true); assert.equal(game.tookDamage, true);
    assert.equal(cat.vx, 0); assert.equal(cat.vy, 0); assert.equal(game.target, null);
    const frozen = game.camera();
    game.update(1); assert.deepEqual(game.camera(), frozen);
    game.reset(); assert.equal(game.offscreenDeath, false);
  }
});

test('camera motion and Koshi movement trigger offscreen death during gameplay, even during a camera stop', () => {
  const level = { ...blank(), duration: 100, survive: true, goal: 0,
    autoscroll: { length: 24, speed: 1, events: [] } };
  const game = new Game(() => .5, { customLevel: level });
  game.start();
  game.update(10);
  assert.equal(game.state, 'lost');
  assert.equal(game.offscreenDeath, true);
  assert.ok(game.cat.x + game.cat.radius <= game.camera().x);
  assert.ok(game.elapsed < 10, 'camera crossing interrupts the update immediately');
  const stopped = new Game(() => .5, { customLevel: { ...level, autoscroll: { ...level.autoscroll, speed: 0 } } });
  stopped.start(); stopped.cat.x = stopped.viewportWidth - stopped.cat.radius;
  stopped.cat.vx = 600; stopped.cat.vy = 0;
  stopped.update(.1);
  assert.equal(stopped.state, 'lost');
  assert.equal(stopped.offscreenDeath, true);
  const traditional = new Game(() => .5, { customLevel: blank() });
  traditional.start(); traditional.cat.x = -100;
  assert.equal(traditional.checkOffscreenDeath(), false, 'traditional levels keep their existing board-boundary rule');
});
