const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, WIDTH, HEIGHT, makeBricks, boardDimensions, cameraAt, validateCustomLevel, brickRegions, CAT_BLOCK_TRIGGERS, catBlockDescription, catBlockObjective } = require('../src/game.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const blank = () => ({ version: 1, id: 'Scrolling test', duration: 60, goal: 0, survive: true, heartCost: null, brickSet: 1, events: [] });
const scrolling = () => ({ ...blank(), autoscroll: { length: 24, speed: .25, events: [{ time: 10, speed: 0 }, { time: 15, speed: .5 }] } });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

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
    validateDraft: validateCustomLevel, markChanged() {}, renderBoard() {}, message: text => messages.push(text),
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
