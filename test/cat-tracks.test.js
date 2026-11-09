const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, validateCustomLevel, validateCatTracks, catTrackPath, catTrackPoint, catTrackProjection } = require('../src/game.js');
const { drawCatTrack } = require('../src/brick-visuals.js');

const blank = () => ({ version: 1, id: 'Cat Tracks', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [] });
const track = (extra = {}) => ({ id: 'track-1', nodes: [{ x: .2, y: .2 }, { x: .8, y: .2 }, { x: .8, y: .8 }],
  speed: 120, closed: false, ...extra });
const object = (type = 'bumper-red', extra = {}) => ({ kind: 'object', type, time: 0, x: .2, y: .2, track: 'track-1', ...extra });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
function arena(source, options = {}) {
  const game = new Game(() => .5, { customLevel: source, ...options });
  Object.assign(game.cat, { x: 100, y: 500, vx: 0, vy: 0 });
  game.start();
  return game;
}

test('Cat Tracks round-trip without modifying authored content or adding fields to old levels', () => {
  assert.deepEqual(validateCustomLevel(blank()), blank());
  const source = { ...blank(), tracks: [track(), track({ id: 'loop', closed: true, power: 'black' })],
    events: [object(), object('obstruction-circle', { x: .8, y: .8, width: 20, height: 20, destructible: true, track: 'loop' })] };
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(source))), source);
  assert.equal(source.events[0].x, .2);
});

test('tracks reject malformed data, duplicate nodes, self-intersections, touching segments and backtracking', () => {
  for (const invalid of [null, {}, Array(101).fill(track()), [null], [track(), track()],
    [track({ speed: -1 })], [track({ speed: Infinity })], [track({ speed: '60' })], [track({ speed: 1001 })],
    [track({ closed: 1 })], [track({ power: 'red' })], [track({ id: '' })], [track({ nodes: [] })],
    [track({ nodes: [{ x: .2, y: .2 }, { x: .2, y: .2 }] })],
    [track({ nodes: [{ x: -1, y: .2 }, { x: .2, y: .2 }] })],
    [track({ nodes: [{ x: .2, y: NaN }, { x: .2, y: .2 }] })],
    [track({ nodes: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }] })],
    [track({ nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: .5, y: 0 }] })],
    [track({ nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: .5, y: 0 }] })],
    [track({ closed: true, nodes: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })],
    [track({ closed: true, nodes: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }] })],
  ]) assert.throws(() => validateCustomLevel({ ...blank(), tracks: invalid }), /Cat Tracks/);
  const straight = track({ nodes: [{ x: 0, y: 0 }, { x: .5, y: 0 }, { x: 1, y: 0 }] });
  assert.doesNotThrow(() => validateCatTracks([straight]));
  assert.doesNotThrow(() => validateCatTracks([track({ nodes: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }),
    track({ id: 'crossing', nodes: [{ x: 0, y: 1 }, { x: 1, y: 0 }] })]));
});

test('only single fixed obstructions and bumpers may reference existing tracks', () => {
  for (const event of [object('soccer-ball'), object('bubble-red'), object('bumper-red', { track: 'missing' }),
    object('bumper-red', { random: true }), object('bumper-red', { group: { shape: 'line', count: 2 } }),
    { ...object(), kind: 'food', type: 'S', lifetime: 5 }]) {
    assert.throws(() => validateCustomLevel({ ...blank(), tracks: [track()], events: [event] }), /Cat Track/);
  }
});

test('distance follows exact segment lengths, reverses on open paths and wraps closed loops', () => {
  const nodes = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }];
  const open = catTrackPath({ nodes, closed: false });
  assert.equal(open.length, 150);
  for (const [distance, x, y] of [[0, 0, 0], [100, 100, 0], [125, 100, 25], [150, 100, 50],
    [175, 100, 25], [225, 75, 0], [300, 0, 0], [9125, 100, 25]]) {
    const point = catTrackPoint(open, distance);
    close(point.x, x); close(point.y, y);
  }
  const loop = catTrackPath({ nodes: [...nodes, { x: 0, y: 50 }], closed: true });
  assert.equal(loop.length, 300);
  assert.deepEqual(catTrackPoint(loop, 275), { x: 0, y: 25 });
  assert.deepEqual(catTrackPoint(loop, 310), { x: 10, y: 0 });
  assert.deepEqual(catTrackProjection(open, { x: 110, y: 25 }), { x: 100, y: 25, distance: 125 });
});

test('multiple attached objects retain offsets and speed through nodes, endpoints and loops', () => {
  for (const closed of [false, true]) {
    const source = { ...blank(), tracks: [track({ closed })],
      events: [object(), object('obstruction-circle', { x: .8, y: .8, width: 20, height: 20 })] };
    const game = arena(source), bumper = game.bumpers[0], solid = game.obstructions[0];
    const start = solid.trackDistance;
    game.update(5);
    assert.equal(game.state, 'playing');
    close(bumper.trackDistance, 600); close(solid.trackDistance, start + 600);
    for (const entity of [bumper, solid]) {
      const expected = catTrackPoint(game.catTracks[0].path, entity.trackDistance);
      close(entity.x, expected.x); close(entity.y, expected.y);
    }
    game.pause(); const x = bumper.x, y = bumper.y;
    game.update(3); close(bumper.x, x); close(bumper.y, y);
    game.resume(); game.update(.1); close(bumper.trackDistance, 612);
    game.reset(); game.start();
    close(game.bumpers[0].trackDistance, 0);
    assert.equal(game.catTracks.length, 1);
  }
});

test('track power follows actual Power Brick color and resumes without resetting or accumulating paused time', () => {
  const source = { ...blank(), tracks: [track({ power: 'black' }), track({ id: 'yellow', power: 'yellow' })],
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', power: true }],
    events: [object(), object('bumper-blue', { x: .8, y: .8, track: 'yellow' })] };
  const game = arena(source), black = game.bumpers[0], yellow = game.bumpers[1];
  const yellowStart = yellow.trackDistance;
  game.update(.5);
  close(black.trackDistance, 0); close(yellow.trackDistance, yellowStart + 60);
  const brick = game.bricks.find(brick => brick.power);
  const toggle = () => {
    brick.readyAt = game.elapsed;
    assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
    game.cat.vx = 0; game.cat.vy = 0;
  };
  toggle(); game.update(.5);
  close(black.trackDistance, 60); close(yellow.trackDistance, yellowStart + 60);
  toggle(); game.update(.5);
  close(black.trackDistance, 60);
  toggle(); game.update(.5);
  close(black.trackDistance, 120);
  const initiallyBlack = arena({ ...source, powerOn: true });
  initiallyBlack.update(.1);
  close(initiallyBlack.bumpers[0].trackDistance, 12);
});

test('scheduled attachments start at the nearest path point at their own spawn time', () => {
  const source = { ...blank(), tracks: [track()],
    events: [object('bumper-green', { time: .253, x: .4, y: .25 })] };
  const game = arena(source);
  game.update(.25); assert.equal(game.bumpers.length, 0);
  game.update(.25); assert.equal(game.bumpers.length, 1);
  const point = game.trackEventPoint(source.events[0], .5);
  close(game.bumpers[0].x, point.x); close(game.bumpers[0].y, point.y);
});

test('preview positions share runtime geometry in portrait, landscape and scrolling arenas', () => {
  for (const options of [{}, { portrait: true, scale: .5 }]) {
    for (const scroll of [false, true]) {
      const source = { ...blank(), tracks: [track()], events: [object()],
        ...(scroll ? { autoscroll: { length: 16, speed: 0, events: [] } } : {}) };
      const game = arena(source, options);
      game.update(.75);
      const expected = game.trackEventPoint(source.events[0], .75);
      close(game.bumpers[0].x, expected.x); close(game.bumpers[0].y, expected.y);
    }
  }
});

test('moving track bumpers hit stationary Koshi and track obstructions push him without leaving their paths', () => {
  for (const type of ['bumper-red', 'obstruction-circle']) {
    const source = { ...blank(), tracks: [track({ nodes: [{ x: .2, y: .5 }, { x: .8, y: .5 }] })],
      events: [object(type, { x: .2, y: .5, ...(type.startsWith('obstruction') ? { width: 20, height: 20 } : {}) })] };
    const game = arena(source);
    Object.assign(game.cat, game.pointFromRelative(.4, .5));
    const old = { ...game.cat };
    game.update(1.25);
    assert.equal(game.state, 'playing');
    assert.ok(game.cat.x > old.x, `${type} must move stationary Koshi`);
    const entity = type.startsWith('bumper') ? game.bumpers[0] : game.obstructions[0];
    const expected = game.trackEventPoint(source.events[0], 1.25);
    close(entity.x, expected.x); close(entity.y, expected.y);
  }
});

test('Koshi can steer out of an overlapping bumper on moving, stopped and power-paused tracks', () => {
  for (const extra of [{ speed: 120 }, { speed: 0 }, { power: 'black' }]) {
    const game = arena({ ...blank(), tracks: [track(extra)], events: [object('bumper-green')] });
    const bumper = game.bumpers[0];
    Object.assign(game.cat, { x: bumper.x + bumper.radius + game.cat.radius - 1, y: bumper.y });
    const brick = game.bricks.filter(brick => brick.x > game.cat.x)
      .sort((a, b) => b.x - a.x || Math.abs(a.y + a.h / 2 - game.cat.y) - Math.abs(b.y + b.h / 2 - game.cat.y))[0];
    assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
    const start = game.cat.x, position = { x: bumper.x, y: bumper.y };
    game.update(1 / 120);
    assert.ok(game.cat.x > start + .5, 'an outward click must move Koshi immediately');
    assert.equal(game.state, 'playing');
    close(bumper.x, position.x + (extra.speed === 120 ? 1 : 0)); close(bumper.y, position.y);
  }
});

test('overlapping moving bumpers block only approaching relative motion', () => {
  const game = arena(blank());
  for (const kind of ['track', 'hazardShot']) {
    for (const [shift, dx, expected] of [[0, 2, Infinity], [1, 2, Infinity], [3, 2, 0], [0, -2, 0]]) {
      const bumper = { ...game.createBumper({ x: 300 + shift, y: 300 }, 'bumper-green'),
        [kind]: kind === 'track' ? 'track-1' : true, previousX: 300, previousY: 300, vx: shift * 120, vy: 0 };
      Object.assign(game.cat, { x: 300 + bumper.radius + game.cat.radius - 1, y: 300 });
      assert.equal(game.hazardObjectContact(bumper, dx, 0, 1 / 120), expected,
        `${kind}: object displacement ${shift}, Koshi displacement ${dx}`);
    }
  }
});

test('a moving obstruction resolves adjacent bumper overlaps without changing either path', () => {
  for (const type of ['obstruction-circle', 'obstruction-rectangle-horizontal', 'obstruction-diamond']) {
    const game = arena({ ...blank(), tracks: [track({ nodes: [{ x: .3, y: .5 }, { x: .8, y: .5 }] })],
      events: [object(type, { x: .3, y: .5, width: 40, height: 40 })] });
    const solid = game.obstructions[0], start = { x: solid.x, y: solid.y };
    const bumper = game.createBumper({ x: solid.x + 100, y: solid.y }, 'bumper-green');
    game.bumpers.push(bumper);
    Object.assign(game.cat, { x: solid.x + 30, y: solid.y + 10 });
    game.update(1 / 120);
    assert.equal(game.state, 'playing', type);
    assert.ok(Math.hypot(game.cat.x - bumper.x, game.cat.y - bumper.y)
      >= bumper.radius + game.cat.radius - .001, `${type} must not push Koshi into the bumper`);
    const resolved = { x: game.cat.x, y: game.cat.y, radius: game.cat.radius };
    game.moveAroundObstructions(resolved, game.cat);
    assert.ok(Math.hypot(resolved.x - game.cat.x, resolved.y - game.cat.y) < .001,
      `${type} must not leave Koshi embedded in the obstruction either`);
    close(solid.x, start.x + 1); close(solid.y, start.y);
    close(bumper.x, start.x + 100); close(bumper.y, start.y);
  }
});

test('a closing track obstruction and bumper gap crushes Koshi instead of leaving him wedged', () => {
  const game = arena({ ...blank(), tracks: [track({ nodes: [{ x: .3, y: .5 }, { x: .8, y: .5 }] })],
    events: [object('obstruction-circle', { x: .3, y: .5, width: 40, height: 40 })] });
  const solid = game.obstructions[0];
  game.bumpers.push(game.createBumper({ x: solid.x + 100, y: solid.y }, 'bumper-green'));
  Object.assign(game.cat, { x: solid.x + 35, y: solid.y });
  game.update(1 / 120);
  assert.equal(game.state, 'lost');
  assert.equal(game.hearts, 0);
  assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0);
});

test('bumper rebound push-out also resolves neighboring static obstructions', () => {
  const game = arena(blank());
  const bumper = game.createBumper({ x: 300, y: 300 }, 'bumper-green');
  const solid = game.createCustomSpawn({ kind: 'object', type: 'obstruction-circle',
    time: 0, x: .5, y: .5, width: 40, height: 40 })[0];
  Object.assign(solid, { x: 400, y: 300 });
  game.bumpers.push(bumper); game.obstructions.push(solid);
  Object.assign(game.cat, { x: 350, y: 310, vx: -100, vy: 0 });
  game.update(1 / 120);
  assert.equal(game.state, 'playing');
  assert.equal(bumper.hitAt, game.elapsed);
  assert.ok(Math.hypot(game.cat.x - bumper.x, game.cat.y - bumper.y)
    >= bumper.radius + game.cat.radius - .001);
  assert.ok(Math.hypot(game.cat.x - solid.x, game.cat.y - solid.y)
    >= solid.radius + game.cat.radius - .001);
});

test('track artwork is dotted, translucent, correctly colored and closes only loops', () => {
  for (const power of [undefined, 'yellow', 'black']) for (const closed of [false, true]) {
    const strokes = [], context = { globalAlpha: 1,
      save() {}, restore() {}, setLineDash(dash) { this.dash = dash; }, beginPath() {}, moveTo() {}, lineTo() {},
      closePath() { this.closed = true; },
      stroke() { strokes.push({ color: this.strokeStyle, alpha: this.globalAlpha, width: this.lineWidth }); } };
    const value = track({ power, closed });
    drawCatTrack(context, { ...value, path: catTrackPath(value) });
    assert.deepEqual(context.dash, [1, 8]);
    assert.equal(strokes[0].alpha, .65);
    assert.equal(strokes[0].color, power === 'yellow' ? '#d5b83f' : power === 'black' ? '#41464b' : '#174f36');
    assert.equal(strokes[0].width, 3);
    assert.equal(strokes.length, 1);
    assert.equal(Boolean(context.closed), closed);
  }
});

test('editor authors, attaches, detaches and deletes tracks transactionally, preserving read-only levels', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const nodes = new Map(), errors = [];
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', checked: false, listeners: {},
      addEventListener(type, handler) { this.listeners[type] = handler; } });
    return nodes.get(selector);
  };
  let locked = false;
  const context = vm.createContext({ $, level: { ...blank(), events: [{ ...object(), track: undefined }] },
    selectedTrackId: '', trackDrawing: false, trackDrawNodes: [], selectedEvents: new Set([0]),
    readOnly: () => locked, selectedList: () => [0], validateDraft: validateCustomLevel,
    attempt: action => { try { action(); } catch (error) { errors.push(error.message); } },
    markChanged() {}, render() {}, renderBoard() {}, populateEventForm() {}, message() {},
  });
  vm.runInContext(source.slice(source.indexOf('function populateTrackForm('), source.indexOf('function focusMarker(')), context);
  context.populateTrackForm();
  context.trackDrawNodes = track().nodes;
  $('#track-form').listeners.submit({ preventDefault() {} });
  assert.equal(context.level.tracks[0].id, 'track-1');
  assert.equal(context.level.tracks[0].speed, 60);
  $('#track-attach').listeners.click();
  assert.equal(context.level.events[0].track, 'track-1');
  const snapshot = JSON.stringify(context.level);
  context.trackDrawNodes = [{ x: .2, y: .2 }, { x: .2, y: .2 }];
  $('#track-form').listeners.submit({ preventDefault() {} });
  assert.equal(JSON.stringify(context.level), snapshot);
  assert.match(errors.at(-1), /distinct/);
  locked = true;
  $('#track-delete').listeners.click(); $('#track-detach').listeners.click();
  assert.equal(JSON.stringify(context.level), snapshot);
  locked = false;
  $('#track-detach').listeners.click();
  assert.equal(context.level.events[0].track, undefined);
  $('#track-attach').listeners.click();
  $('#track-delete').listeners.click();
  assert.equal(context.level.tracks.length, 0);
  assert.equal(context.level.events[0].track, undefined);
  assert.equal(context.level.events[0].type, 'bumper-red');
});

test('editor moves individual saved nodes transactionally and rejects self-intersections', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const errors = [];
  let changes = 0;
  const context = vm.createContext({
    level: { ...blank(), tracks: [track()], events: [object()] },
    selectedTrackId: 'track-1', selectedTrackNode: -1, trackDrawing: false,
    trackDrawNodes: track().nodes, trackNodeGesture: null,
    validateDraft: validateCustomLevel, markChanged() { changes++; },
    attempt(action) { try { action(); } catch (error) { errors.push(error.message); } },
    readOnly: () => false, activeCategory: 'tracks', gesture: null,
    pausePreview() {}, renderCatTracks() {}, renderBoard() {},
    board: { setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} },
    pointerPosition: event => event.point, placementPosition: (x, y) => ({ x, y }),
    $: () => ({ querySelector: () => ({ focus() {} }) }),
  });
  vm.runInContext(source.slice(source.indexOf('function saveTrackNodeMove('), source.indexOf("$('#track-choice').addEventListener")), context);
  const pointer = (extra = {}) => ({ button: 0, pointerId: 1, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...extra });
  context.startTrackNodeDrag(pointer(), 1);
  context.dragTrackNode(pointer({ point: { x: .6, y: .3 } }));
  assert.equal(context.level.tracks[0].nodes[1].x, .8, 'drag previews do not mutate saved data');
  context.finishTrackNodeDrag(pointer({ type: 'pointerup' }));
  assert.equal(context.level.tracks[0].nodes[1].x, .6);
  assert.equal(context.level.tracks[0].nodes[0].x, .2);
  assert.equal(changes, 1);
  const before = JSON.stringify(context.level);
  context.startTrackNodeDrag(pointer(), 1);
  context.dragTrackNode(pointer({ point: { x: .2, y: .2 } }));
  context.finishTrackNodeDrag(pointer({ type: 'pointerup' }));
  assert.equal(JSON.stringify(context.level), before);
  assert.equal(context.trackDrawNodes[1].x, .6, 'invalid movement restores the visual node');
  assert.match(errors.at(-1), /distinct/);
  context.startTrackNodeDrag(pointer(), 1);
  context.dragTrackNode(pointer({ point: { x: .7, y: .4 } }));
  context.finishTrackNodeDrag(pointer({ type: 'pointercancel' }));
  assert.equal(JSON.stringify(context.level), before);
  context.placementGrid = () => null;
  context.moveTrackNodeWithKeyboard({ key: 'ArrowRight', preventDefault() {}, stopPropagation() {} }, 1);
  close(context.level.tracks[0].nodes[1].x, .61);
  context.readOnly = () => true;
  context.moveTrackNodeWithKeyboard({ key: 'ArrowRight' }, 1);
  close(context.level.tracks[0].nodes[1].x, .61);
  context.startTrackNodeDrag(pointer(), 1);
  assert.equal(context.trackNodeGesture, null);
});

test('Cat Tracks controls have their own Tracks category with no coordinate entry', () => {
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  assert.ok(html.indexOf('id="track-panel"') > html.indexOf('class="editor-panel inspector"'));
  assert.ok(html.indexOf('id="track-panel"') < html.indexOf('id="event-panel"'));
  assert.doesNotMatch(html, /id="track-nodes"|Nodes \(X, Y/);
  assert.doesNotMatch(source, /readTrackNodes|#track-nodes/);
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { dataset: {}, children: [] });
    return nodes.get(selector);
  };
  const context = vm.createContext({ $, activeCategory: 'food', readOnly: () => false });
  vm.runInContext(source.slice(source.indexOf('function showCategory('), source.indexOf('function syncPalettes(')), context);
  context.showCategory('tracks');
  assert.equal($('#track-panel').hidden, false);
  assert.equal($('#cat-tracks').dataset.editable, 'true');
  context.showCategory('food');
  assert.equal($('#track-panel').hidden, true);
  assert.equal($('#cat-tracks').dataset.editable, 'false');
  context.showCategory('object');
  assert.equal($('#track-panel').hidden, true);
});
