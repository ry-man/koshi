const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const gameApi = require('../src/game.js');
const { Game, validateCustomLevel, snapWheel, brickEditRegions, COOLDOWNS, CONTACT_SURFACES, OBJECTS } = gameApi;

const blank = () => ({ version: 1, id: 'Fixed spawners', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [] });
const region = { edge: 'top', start: 0, end: .1, kind: 'normal' };
const levelFor = spawner => ({ ...blank(), brickTypes: [{ ...region, spawner }] });
const point = item => ({ x: item.x, y: item.y });

test('fixed spawn positions validate, round-trip, and snap boundary enemies without changing random spawners', () => {
  const spawn = { kind: 'item', type: 'smiley-cookie', x: .35, y: .4 };
  assert.deepEqual(validateCustomLevel(levelFor(spawn)), levelFor(spawn));
  for (const invalid of [{ x: .2 }, { y: .2 }, { x: -1, y: .2 }, { x: .2, y: 1.1 },
    { x: '0.2', y: .2 }, { x: NaN, y: .2 }, { x: .2, y: Infinity }]) {
    assert.throws(() => validateCustomLevel(levelFor({ kind: 'item', type: 'smiley-cookie', ...invalid })), /spawn [XY]/);
  }
  for (const type of ['wheel', 'snake', 'robo-cow']) {
    const spawner = validateCustomLevel(levelFor({ kind: 'enemy', type, x: .35, y: .4 })).brickTypes[0].spawner;
    assert.deepEqual(point(spawner), snapWheel(.35, .4));
  }
  const random = { kind: 'item', type: 'smiley-cookie' };
  assert.deepEqual(validateCustomLevel(levelFor(random)).brickTypes[0].spawner, random);
});

test('every fixed-location spawn uses the chosen position and initializes attributes at activation time in both layouts', () => {
  const cases = [
    ['food', 'H', 'food', { lifetime: 15 }],
    ['weapon', 'silver', 'weapons', { lifetime: 10 }],
    ['item', 'smiley-cookie', 'items', {}],
    ['heart', 'heart', 'healing', {}],
    ['enemy', 'mouse', 'robots', { shield: 'blue' }],
    ['enemy', 'wheel', 'robots', {}],
    ['enemy', 'snake', 'robots', {}],
    ['enemy', 'robo-cow', 'robots', {}],
    ['enemy', 'robo-koshi', 'robots', {}],
    ['object', 'soccer-ball', 'soccerBalls', {}],
    ['object', 'bumper-red', 'bumpers', {}],
    ['object', 'bubble-blue', 'bubbles', {}],
    ['object', 'obstruction-diamond', 'obstructions', { width: 140, height: 140, destructible: true }],
  ];
  for (const options of [{}, { portrait: true, scale: .3 }]) for (const [kind, type, field, attributes] of cases) {
    const spawn = { kind, type, x: .35, y: .4, ...attributes };
    const game = new Game(() => .5, { ...options, customLevel: levelFor(spawn) });
    game.start(); game.elapsed = 5;
    const brick = game.bricks.find(brick => brick.spawner);
    const expected = game.pointFromRelative(brick.spawner.x, brick.spawner.y);
    game.spawnFromBrick(brick);
    assert.equal(brick.spawned, true);
    if (field === 'obstructions' || field === 'bumpers') {
      assert.equal(game[field].length, 0);
      assert.deepEqual(point(game.spawnCues[0]), expected);
      game.update(2);
    }
    assert.equal(game[field].length, 1, `${type} ${JSON.stringify(options)}`);
    const item = game[field][0];
    assert.ok(Math.hypot(item.x - expected.x, item.y - expected.y) < 1e-8);
    if (attributes.lifetime) {
      assert.equal(item.born, 5); assert.equal(item.expires, 5 + attributes.lifetime);
    }
    if (attributes.shield) assert.equal(item.shield, attributes.shield);
    if (attributes.width) assert.equal(item.width, attributes.width);
    if (attributes.destructible) assert.equal(item.destructible, true);
    if (type === 'robo-cow') assert.ok(item.cowWalkRemaining > 0);
    game.reset();
    assert.equal(game[field].length, 0);
    assert.deepEqual(point(game.bricks.find(brick => brick.spawner).spawner), point(brick.spawner));
  }
});

test('fixed spawners preserve exact occupied locations and battery reactivation repeats there', () => {
  const game = new Game(() => .5, { customLevel: levelFor({ kind: 'item', type: 'smiley-cookie', x: .5, y: .5, lifetime: 10 }) });
  game.start();
  const brick = game.bricks.find(brick => brick.spawner);
  game.touchSpawner(brick);
  assert.deepEqual(point(game.items[0]), point(game.cat));
  game.spawnerTouching.clear();
  game.batteries = 1; game.elapsed = 7;
  game.touchSpawner(brick);
  assert.equal(game.items.length, 2);
  assert.deepEqual(point(game.items[0]), point(game.items[1]));
  assert.equal(game.items[1].expires, 17);
  assert.equal(game.batteries, 0);
});

function editorFixture(level = levelFor({ kind: 'food', type: 'S', lifetime: 15 })) {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', checked: false, dataset: {},
      children: [], setAttribute(name, value) { this[name] = String(value); },
      append(child) { this.children.push(child); }, replaceChildren() { this.children = []; },
    });
    return nodes.get(selector);
  };
  const regionKey = region => `${region.edge}:${region.start}:${region.end}`;
  let changed = 0;
  const context = vm.createContext({ $, Game, OBJECTS, COOLDOWNS, CONTACT_SURFACES, brickEditRegions, snapWheel,
    regionKey, level, connectingSpawn: null, selectedEvents: new Set(), selectedBricks: new Set(), MIXED: '',
    immutableBrick: kind => ['cinder', 'goal'].includes(kind),
    readOnly: () => false, validateDraft: validateCustomLevel, markChanged: () => changed++,
    attempt: action => action(), message() {}, renderBoard() {},
    document: { createElementNS: () => ({ attributes: {}, setAttribute(name, value) { this.attributes[name] = String(value); } }) },
    setSelection(events, bricks) { context.selectedEvents = new Set(events); context.selectedBricks = new Set(bricks); },
    resetObstructionSize() {},
  });
  context.previewGame = new Game(() => .5, { customLevel: level, editorPreview: true });
  vm.runInContext(source.slice(source.indexOf('function spawnTemplates('), source.indexOf('function moveEvent(')), context);
  vm.runInContext(source.slice(source.indexOf('function brickEntry('), source.indexOf('function combineBricks(')), context);
  const brick = context.previewGame.bricks.find(brick => brick.spawner && brick.absorbedBy === null);
  const key = regionKey(brickEditRegions(context.previewGame.bricks).get(brick.id));
  context.selectedBricks = new Set([key]);
  const refresh = () => { context.previewGame = new Game(() => .5, { customLevel: context.level, editorPreview: true }); };
  const savedSpawn = () => new Game(() => .5, { customLevel: context.level, editorPreview: true }).bricks[brick.id].spawner;
  return { context, $, key, refresh, savedSpawn, source, changed: () => changed };
}

test('connecting converts a placed event into a spawn-only template with every attribute intact', () => {
  const event = { time: 12, kind: 'object', type: 'obstruction-circle', x: .7, y: .6,
    width: 140, height: 140, destructible: true, color: '#123456', pattern: 'stripes', patternColor: '#abcdef' };
  const fixture = editorFixture({ ...levelFor({ kind: 'food', type: 'S', lifetime: 15 }), events: [event] });
  const { context, key, refresh, savedSpawn } = fixture;
  context.connectingSpawn = key;
  context.connectSpawn(0);
  assert.equal(context.level.events.length, 0);
  const { time, ...expected } = event;
  assert.deepEqual({ ...savedSpawn() }, expected);
  assert.equal(context.connectingSpawn, null);
  assert.deepEqual([...context.selectedBricks], [key]);
  refresh();
  const templates = context.spawnTemplates();
  assert.equal(templates.length, 1);
  assert.deepEqual({ ...templates[0].event }, expected);
  const game = new Game(() => .5, { customLevel: JSON.parse(JSON.stringify(context.level)) });
  game.start(); game.update(15);
  assert.equal(game.obstructions.length, 0, 'old event schedule cannot spawn the template');
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  assert.deepEqual(point(game.spawnCues[0]), game.pointFromRelative(.7, .6));
  assert.equal(fixture.changed(), 1);
});

test('fixed coordinates update independently, clear to random, and survive type changes', () => {
  const { context, $, refresh, savedSpawn } = editorFixture();
  $('#brick-spawn-fixed').checked = true;
  $('#brick-spawn-x').value = '30'; $('#brick-spawn-y').value = '70';
  context.saveBrick({ target: { id: 'brick-spawn-fixed' } });
  assert.deepEqual(point(savedSpawn()), { x: .3, y: .7 });
  refresh();
  $('#brick-spawn-x').value = '55';
  context.saveBrick({ target: { id: 'brick-spawn-x' } });
  assert.deepEqual(point(savedSpawn()), { x: .55, y: .7 });
  refresh();
  $('#brick-spawn-item').value = 'enemy:wheel';
  context.saveBrick({ target: { id: 'brick-spawn-item' } });
  assert.deepEqual(point(savedSpawn()), snapWheel(.55, .7));
  refresh();
  $('#brick-spawn-fixed').checked = false;
  context.saveBrick({ target: { id: 'brick-spawn-fixed' } });
  assert.equal(savedSpawn().x, undefined);
  assert.equal(savedSpawn().y, undefined);
});

test('spawn template drafts move and restore without saving, and selected spawners alone display links', () => {
  const { context, $, key, refresh, changed } = editorFixture(levelFor({ kind: 'item', type: 'smiley-cookie', x: .2, y: .3 }));
  const origin = context.spawnTemplate(key).event;
  context.updateSpawnTemplateDraft(key, { ...origin, x: .8, y: .7 });
  refresh();
  assert.deepEqual(point(context.spawnTemplate(key).event), { x: .8, y: .7 });
  assert.equal(changed(), 0);
  context.updateSpawnTemplateDraft(key, origin);
  refresh();
  assert.deepEqual(point(context.spawnTemplate(key).event), { x: .2, y: .3 });
  context.renderSpawnLinks(context.spawnTemplates());
  assert.equal($('#spawn-links').children.length, 1);
  const line = $('#spawn-links').children[0], pointAt = context.previewGame.pointFromRelative(.2, .3);
  assert.equal(Number(line.attributes.x2), pointAt.x);
  assert.equal(Number(line.attributes.y2), pointAt.y);
  context.selectedBricks.clear();
  context.renderSpawnLinks(context.spawnTemplates());
  assert.equal($('#spawn-links').children.length, 0);
});

test('spawn template dragging and resizing commit valid attributes but cancellation restores the entire unsaved draft', () => {
  const { context, key, refresh, savedSpawn, source, changed } = editorFixture(levelFor({
    kind: 'object', type: 'obstruction-circle', x: .5, y: .5, width: 100, height: 100, destructible: true,
  }));
  const listeners = new Map();
  Object.assign(context, {
    gesture: null, isAdditive: () => false,
    pointerPosition: event => ({ x: event.clientX / 960, y: event.clientY / 600 }),
    board: { addEventListener(type, handler) { listeners.set(type, handler); },
      setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} },
    renderBoard: refresh, render: refresh, focusSpawnTemplate() {},
    obstructionGeometry: gameApi.obstructionGeometry,
  });
  vm.runInContext(source.slice(source.indexOf('function resizedObstruction('), source.indexOf('function boxBounds(')), context);
  vm.runInContext(source.slice(source.indexOf("board.addEventListener('pointermove'"), source.indexOf("board.addEventListener('keydown'")), context);
  const original = JSON.stringify(context.level);
  const down = { pointerId: 1, clientX: 100, clientY: 100 };
  context.startGesture(down, { type: 'spawn-template', spawnKey: key });
  listeners.get('pointermove')({ pointerId: 1, clientX: 180, clientY: 140 });
  assert.ok(savedSpawn().x > .5);
  listeners.get('pointercancel')({});
  assert.equal(JSON.stringify(context.level), original);
  assert.equal(changed(), 0);
  context.startGesture(down, { type: 'spawn-template', spawnKey: key });
  listeners.get('pointermove')({ pointerId: 1, clientX: 180, clientY: 140 });
  listeners.get('pointerup')({ pointerId: 1 });
  assert.ok(Math.abs(savedSpawn().x - (.5 + 80 / 960)) < 1e-8);
  assert.equal(savedSpawn().destructible, true);
  assert.equal(changed(), 1);
  refresh();
  context.startGesture(down, { type: 'resize', spawnKey: key, handle: 'se' });
  listeners.get('pointermove')({ pointerId: 1, clientX: 180, clientY: 140 });
  listeners.get('pointerup')({ pointerId: 1 });
  assert.equal(savedSpawn().width, savedSpawn().height);
  assert.ok(savedSpawn().width > 100);
  assert.equal(savedSpawn().destructible, true);
  assert.equal(changed(), 2);
});

test('merged spawning bricks share one connected template and render only one link', () => {
  const initial = new Game(() => .5, { customLevel: blank(), editorPreview: true });
  const members = initial.perimeter.slice(0, 2), owner = members[0];
  const regions = brickEditRegions(initial.bricks);
  const level = { ...blank(), brickGroups: [{ owner, members }],
    brickTypes: members.map(id => ({ ...regions.get(id), kind: 'normal', spawner: { kind: 'item', type: 'smiley-cookie' } })),
    events: [{ time: 5, kind: 'enemy', type: 'mouse', x: .4, y: .6, shield: 'green' }],
  };
  const { context, key, refresh, $ } = editorFixture(level);
  context.connectingSpawn = key;
  context.connectSpawn(0); refresh();
  assert.equal(context.level.events.length, 0);
  assert.equal(context.spawnTemplates().length, 1);
  for (const id of members) {
    assert.equal(context.previewGame.bricks[id].spawner.type, 'mouse');
    assert.equal(context.previewGame.bricks[id].spawner.shield, 'green');
    assert.equal(context.previewGame.bricks[id].spawner.x, .4);
  }
  context.renderSpawnLinks(context.spawnTemplates());
  assert.equal($('#spawn-links').children.length, 1);
});

test('invalid template connections are atomic and read-only templates cannot be changed', () => {
  const { context, key, changed } = editorFixture({ ...levelFor({ kind: 'item', type: 'smiley-cookie' }),
    events: [{ time: 1, kind: 'item', type: 'smiley-cookie', x: .5, y: .5 }],
  });
  const before = JSON.stringify(context.level);
  context.connectingSpawn = 'missing';
  assert.throws(() => context.connectSpawn(0), /editable spawning brick/);
  assert.equal(JSON.stringify(context.level), before);
  assert.equal(changed(), 0);
  context.readOnly = () => true;
  context.saveSpawnTemplate(key, { kind: 'item', type: 'smiley-cookie', x: .2, y: .2 });
  assert.equal(JSON.stringify(context.level), before);
  assert.equal(changed(), 0);
});
