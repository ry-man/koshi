const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, LEVELS, CAT_BLOCK_MESSAGES, ITEMS, WEAPONS, validateCustomLevel } = require('../src/game.js');

const catBlock = { description: 'Find the Cat Block.', messages: CAT_BLOCK_MESSAGES };
const level = events => ({
  version: 1, id: 'Cat Block tests', duration: 30, goal: 1, heartCost: null, brickSet: 1, events, catBlock,
});

test('collected campaign Cat Blocks do not reappear as pickups, cues or enemy badges', () => {
  for (let index = 0; index < 10; index++) {
    const game = new Game(() => .5, { level: index, catBlockCollected: true });
    game.start();
    for (const event of game.level.items) {
      game.elapsed = event[0] - .5;
      game.prepareSpawns();
      const pending = game.pendingSpawns.get(event);
      assert.equal(pending.items.some(item => item.type === 'cat-block'), false);
      assert.equal(game.takeSpawn(event, () => { throw new Error('Expected prepared spawn'); }).length,
        event[1] === 'cat-block' ? 0 : 1);
    }
    for (const event of game.level.enemies) {
      const enemies = game.createEnemies(event);
      assert.equal(enemies.length, event[2], 'existing enemy counts stay unchanged');
      assert.equal(enemies.some(enemy => enemy.carriesCatBlock), false);
      for (const enemy of enemies) game.defeatEnemy(enemy);
      assert.equal(game.items.some(item => game.isCatBlockSource(item)), false);
    }
    assert.deepEqual(game.catBlockEvents, []);
    assert.equal(game.catBlockCollected, true);
  }
});

test('collecting a Cat Block removes other sources and suppresses future and pending spawns', () => {
  const events = [
    { time: 1, kind: 'item', type: 'cat-block', x: .3, y: .4 },
    { time: 1, kind: 'item', type: 'treasure-chest', x: .7, y: .4 },
    { time: 1, kind: 'enemy', type: 'mouse', x: .7, y: .7, carriesCatBlock: true },
  ];
  const game = new Game(() => .5, { customLevel: level(events) });
  game.start();
  game.prepareSpawns();
  game.items = [{ type: 'cat-block' }, { type: 'treasure-chest' }, { type: 'key' }];
  game.robots = [{ type: 'mouse', carriesCatBlock: true }];
  game.collectItem({ type: 'cat-block' });
  assert.deepEqual(game.items.map(item => item.type), ['key']);
  assert.equal(game.robots[0].carriesCatBlock, false);
  for (const pending of game.pendingSpawns.values()) {
    assert.equal(pending.items.some(item => game.isCatBlockSource(item) || item.carriesCatBlock), false);
  }
  game.elapsed = 1;
  game.spawnCustomEvents();
  assert.equal(game.robots.length, 2, 'the enemy still appears without its block');
  for (const event of events.slice(0, 2)) {
    assert.deepEqual(game.createCustomSpawn(event), []);
    for (const position of [{}, { x: .3, y: .4 }]) {
      const brick = { spawner: { kind: 'item', type: event.type, ...position } };
      game.spawnFromBrick(brick);
      assert.equal(brick.spawned, true);
    }
  }
  assert.deepEqual(game.items.map(item => item.type), ['key']);
  game.keys = 5;
  assert.equal(game.collectItem({ type: 'treasure-chest', keysRequired: 3 }), false);
  assert.equal(game.keys, 5);
  game.collectItem({ type: 'cat-block' });
  assert.deepEqual(game.catBlockEvents, ['item']);
  game.reset();
  assert.equal(game.catBlockCollected, false, 'resetting before a victory forfeits the discovery');
});

test('game creation uses the selected profile, pending discoveries and guest state without affecting editor playtests', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const context = vm.createContext({
    Game, LEVELS, Math, layoutOptions: () => ({}), levelSelect: { value: '0' },
    activeSave: null, pendingSaves: [], guestProfile: { catBlocks: [LEVELS[0].id] },
    customLevel: level([]),
  });
  vm.runInContext(source.slice(source.indexOf('function createGame('), source.indexOf('function makeAttemptId(')), context);
  assert.equal(context.createGame().catBlockCollected, true);
  context.activeSave = { slot: { id: 'a', catBlocks: [] } };
  assert.equal(context.createGame().catBlockCollected, false, 'guest discoveries do not leak into a save');
  context.activeSave.slot.catBlocks.push(LEVELS[0].id);
  assert.equal(context.createGame().catBlockCollected, true);
  context.activeSave.slot.catBlocks = [];
  context.pendingSaves = [{ id: 'a', result: { outcome: 'won', catBlock: true, levelId: LEVELS[0].id } }];
  assert.equal(context.createGame().catBlockCollected, true, 'failed writes do not respawn the block on retry');
  context.activeSave.slot.id = 'b';
  assert.equal(context.createGame().catBlockCollected, false, 'other saves remain independent');
  context.levelSelect.value = 'custom';
  assert.equal(context.createGame().catBlockCollected, false);
});

test('Cat Block pickups are 25 percent larger and carrier artwork follows fixed coordinates without a frame', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const draws = [];
  const image = { complete: true, naturalWidth: 1280 };
  const context = vm.createContext({
    ctx: {
      save() {}, restore() {}, translate() {},
      drawImage(...args) { draws.push(args); },
    },
    koshiCatBlockArt: image, game: { elapsed: 0 },
  });
  vm.runInContext(source.slice(source.indexOf('function drawGameItem('), source.indexOf('function drawKittyCape(')), context);
  context.drawGameItem({ type: 'cat-block', x: 200, y: 200 });
  assert.deepEqual(draws.pop(), [image, -25, -25, 50, 50]);
  for (const [time, x, y] of [[0, 100, 50], [1, 100, 50], [2, 140, 80]]) {
    context.game.elapsed = time;
    context.drawCatBlockBadge(x, y, 20);
    assert.deepEqual(draws.pop(), [image, x - 10, y - 10, 20, 20]);
  }
  const css = readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.doesNotMatch(css.match(/\.map-node-cat-block-found \{[^}]*\}/)[0], /outline|border|background/);
  assert.doesNotMatch(css.match(/\.map-cat-block-found[^}]*\}/)[0], /box-shadow|border|background/);
});

test('World 1 carriers mark just one existing enemy and drop a collectible Cat Block', () => {
  for (const number of ['1-3', '1-6', '1-9']) {
    const index = LEVELS.findIndex(level => level.number === number);
    const game = new Game(() => .5, { level: index });
    game.start();
    const event = game.level.enemies[0];
    game.elapsed = event[0] - .5;
    game.prepareSpawns();
    const preview = game.pendingSpawns.get(event).items;
    assert.equal(preview.length, event[2]);
    assert.equal(preview.filter(enemy => enemy.carriesCatBlock).length, 1);
    game.elapsed = event[0];
    game.spawnEnemies(event);
    assert.equal(game.robots.length, event[2]);
    const carrier = game.robots.find(enemy => enemy.carriesCatBlock);
    game.defeatEnemy(carrier);
    const drop = game.items.find(item => item.type === 'cat-block');
    assert.deepEqual({ x: drop.x, y: drop.y }, { x: carrier.x, y: carrier.y });
    game.collectItem(drop);
    assert.equal(game.catBlockCollected, true);
    assert.deepEqual(game.catBlockEvents, ['enemy']);
  }
});

test('Cat Block, keys, chests and enemy carriers validate as custom-level events', () => {
  for (const event of [
    { time: 0, kind: 'item', type: 'cat-block', x: .5, y: .5 },
    { time: 0, kind: 'item', type: 'key', x: .5, y: .5 },
    { time: 0, kind: 'item', type: 'treasure-chest', x: .5, y: .5, keysRequired: 3 },
    { time: 0, kind: 'enemy', type: 'mouse', x: .5, y: .5, carriesCatBlock: true },
    { time: 0, kind: 'enemy', type: 'mouse', x: .5, y: .5, carriesKey: true },
  ]) assert.deepEqual(validateCustomLevel(level([event])).events[0], event);
  assert.equal(validateCustomLevel(level([{ time: 0, kind: 'item', type: 'treasure-chest', x: .5, y: .5 }])).events[0].keysRequired, 1);
  assert.throws(() => validateCustomLevel({ ...level([{ time: 0, kind: 'item', type: 'treasure-chest', x: .5, y: .5, keysRequired: 0 }]) }), /required keys/);
  assert.throws(() => validateCustomLevel({
    ...level([{ time: 0, kind: 'enemy', type: 'mouse', x: .5, y: .5, carriesCatBlock: true }]), catBlock: undefined,
  }), /Enable Cat Block/);
  assert.throws(() => validateCustomLevel(level([
    { time: 0, kind: 'item', type: 'key', x: .5, y: .5, keysRequired: 2 },
  ])), /keysRequired/);
  for (const event of [
    { time: 0, kind: 'item', type: 'key', x: .5, y: .5, carriesKey: true },
    { time: 0, kind: 'enemy', type: 'mouse', x: .5, y: .5, carriesKey: 2 },
  ]) assert.throws(() => validateCustomLevel(level([event])), /key carrier/);
});

test('enemy weapon drops validate, persist, render badges and equip with their catalog hit capacity', () => {
  for (const type of Object.keys(WEAPONS)) {
    const event = { time: 0, kind: 'enemy', type: 'mouse', x: .6, y: .5, carriesItem: type, shield: 'red' };
    const draft = validateCustomLevel(level([event]));
    assert.equal(draft.events[0].carriesItem, type);
    const game = new Game(() => .5, { customLevel: draft });
    game.start();
    const [enemy] = game.createCustomSpawn(event);
    game.defeatEnemy(enemy);
    assert.equal(game.items.length, 0);
    assert.equal(game.weapons.length, 1);
    const [drop] = game.weapons;
    assert.equal(drop.type, type);
    assert.equal(drop.expires, undefined);
    assert.deepEqual({ x: drop.x, y: drop.y }, { x: enemy.x, y: enemy.y });
    assert.equal(enemy.carriesItem, null);
    game.robots = [];
    game.cat.x = enemy.x; game.cat.y = enemy.y;
    game.combat(0, enemy.x, enemy.y);
    assert.equal(game.weapons.length, 0);
    assert.equal(game.weapon.type, type);
    assert.equal(game.weapon.uses, WEAPONS[type].uses);
  }
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const badgeCode = source.slice(source.indexOf('    const carriedItems = enemy.carriesItem'), source.indexOf('  for (const enemy of visibleRobots) if'));
  const calls = [];
  const context = vm.createContext({
    WEAPONS, enemy: { carriesItem: 'hammer-gold', x: 200, y: 200, radius: 19 },
    ctx: { save() {}, restore() {}, translate() {}, scale() {} },
    drawWeapon: (...args) => calls.push(args),
    drawGameItem: () => assert.fail('weapon badge must use weapon artwork'),
  });
  vm.runInContext(badgeCode.slice(0, badgeCode.lastIndexOf('  }')), context);
  assert.deepEqual(calls, [[0, 0, 'hammer-gold']]);
});

test('enemy spawning bricks preserve and drop carried weapons at fixed and random locations', () => {
  for (const position of [{}, { x: .6, y: .5 }]) {
    const draft = { ...level([]), brickTypes: [{
      edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'enemy', type: 'mouse', carriesItem: 'silver', ...position },
    }] };
    assert.equal(validateCustomLevel(draft).brickTypes[0].spawner.carriesItem, 'silver');
    const game = new Game(() => .5, { customLevel: draft });
    const brick = game.bricks.find(brick => brick.absorbedBy === null && brick.spawner);
    game.spawnFromBrick(brick);
    const enemy = game.robots.at(-1);
    assert.equal(enemy.carriesItem, 'silver');
    game.defeatEnemy(enemy);
    assert.equal(game.weapons.at(-1).type, 'silver');
    draft.brickTypes[0].spawner.carriesItem = 'not-a-weapon';
    assert.throws(() => validateCustomLevel(draft), /invalid carried item/);
    draft.brickTypes[0].spawner = { kind: 'weapon', type: 'silver', carriesItem: 'silver' };
    assert.throws(() => validateCustomLevel(draft), /invalid carried item/);
  }
});

test('enemy events accept and drop any catalog item while validating legacy carrier settings', () => {
  for (const type of Object.keys(ITEMS)) {
    const event = { time: 0, kind: 'enemy', type: 'mouse', x: .6, y: .5, carriesItem: type };
    const validated = validateCustomLevel(level([event]));
    assert.equal(validated.events[0].carriesItem, type);
    const game = new Game(() => .5, { customLevel: level([event]) });
    const [enemy] = game.createCustomSpawn(event);
    const position = { x: enemy.x, y: enemy.y };
    game.defeatEnemy(enemy);
    assert.equal(game.items.length, 1, `${type} drops exactly once`);
    assert.equal(game.items[0].type, type);
    assert.deepEqual({ x: game.items[0].x, y: game.items[0].y }, position);
    if (type === 'treasure-chest') assert.equal(game.items[0].keysRequired, 1);
    if (type === 'cat-block') assert.equal(game.items[0].source, 'enemy');
    assert.equal(enemy.carriesItem, null);
  }
  assert.throws(() => validateCustomLevel(level([
    { time: 0, kind: 'enemy', type: 'mouse', x: .5, y: .5, carriesItem: 'not-an-item' },
  ])), /invalid carried item/);
  assert.throws(() => validateCustomLevel(level([
    { time: 0, kind: 'item', type: 'key', x: .5, y: .5, carriesItem: 'battery' },
  ])), /invalid carried item/);
  assert.throws(() => validateCustomLevel(level([
    { time: 0, kind: 'enemy', type: 'mouse', x: .5, y: .5, carriesItem: 'battery', carriesKey: true },
  ])), /conflicting carried items/);
  assert.equal(validateCustomLevel(level([
    { time: 0, kind: 'enemy', type: 'mouse', x: .5, y: .5, carriesItem: 'key' },
  ])).events[0].carriesItem, 'key');
  const legacy = { time: 0, kind: 'enemy', type: 'mouse', x: .6, y: .5, carriesCatBlock: true, carriesKey: true };
  const game = new Game(() => .5, { customLevel: level([legacy]) });
  const [enemy] = game.createCustomSpawn(legacy);
  game.defeatEnemy(enemy);
  assert.deepEqual(game.items.map(item => item.type), ['cat-block', 'key'], 'legacy carriers may retain both items');
});

test('1-4 generates exactly three keys before its permanent three-key chest', () => {
  const index = LEVELS.findIndex(level => level.number === '1-4');
  for (const options of [{}, { portrait: true, scale: .4 }]) {
    const game = new Game(() => .5, { ...options, level: index });
    game.start();
    const chestEvent = game.level.events.find(event => event.type === 'treasure-chest');
    assert.equal(chestEvent.time, 50);
    assert.equal(chestEvent.keysRequired, 3);
    assert.equal(chestEvent.lifetime, undefined);
    assert.equal(game.level.items.some(([, type]) => type === 'cat-block'), false);
    assert.equal(game.level.enemies.some(entry => entry[4]?.carriesCatBlock), false);
    const loose = game.level.items.filter(([, type]) => type === 'key');
    assert.deepEqual(loose, [[20, 'key']]);
    const waves = game.level.enemies.filter(entry => entry[4]?.carriesKey);
    assert.deepEqual(waves.map(entry => entry[0]), [12, 35]);
    for (const wave of waves) {
      assert.ok(wave[0] < chestEvent.time);
      game.elapsed = wave[0] - .5;
      game.prepareSpawns();
      const enemies = game.takeSpawn(wave, entry => game.createEnemies(entry));
      assert.equal(enemies.length, wave[2]);
      assert.equal(enemies.filter(enemy => enemy.carriesKey).length, 1);
      const carrier = enemies.find(enemy => enemy.carriesKey);
      game.elapsed = wave[0];
      game.defeatEnemy(carrier);
      assert.equal(carrier.carriesKey, false);
      const drop = game.items.at(-1);
      assert.equal(drop.type, 'key');
      assert.equal(drop.expires, undefined);
      assert.deepEqual({ x: drop.x, y: drop.y }, { x: carrier.x, y: carrier.y });
      game.collectItem(drop);
    }
    game.collectItem(game.createCollectible(...loose[0]));
    assert.equal(game.keys, 3);
    game.items = [];
    game.elapsed = chestEvent.time;
    game.spawnCustomEvents();
    const chest = game.items.find(item => item.type === 'treasure-chest');
    assert.ok(chest);
    assert.equal(chest.expires, undefined);
    assert.deepEqual({ x: chest.x, y: chest.y }, game.pointFromRelative(.5, .5));
    game.cat.x = game.bounds().left; game.cat.y = game.bounds().top;
    for (const time of [65, 80, 99.9]) {
      game.elapsed = time;
      game.combat(0, game.cat.x, game.cat.y);
      assert.ok(game.items.includes(chest), `chest remains at ${time}s`);
    }
    game.keys = 2;
    game.cat.x = chest.x; game.cat.y = chest.y;
    game.combat(0, chest.x, chest.y);
    assert.ok(game.items.includes(chest));
    assert.equal(game.keys, 2);
    game.keys = 3;
    game.combat(0, chest.x, chest.y);
    assert.equal(game.keys, 0);
    assert.equal(game.items.includes(chest), false);
    assert.equal(game.catBlockCollected, true);
    assert.deepEqual(game.catBlockEvents, ['chest']);
    const replay = new Game(() => .5, { ...options, level: index, catBlockCollected: true });
    assert.deepEqual(replay.createCustomSpawn(chestEvent), []);
  }
});

test('custom key carriers drop persistent keys even when the Cat Block is already acquired', () => {
  const event = { time: 0, kind: 'enemy', type: 'mouse', x: .6, y: .5, carriesItem: 'key' };
  const game = new Game(() => .5, { customLevel: { ...level([event]), catBlock: undefined }, catBlockCollected: true });
  const [enemy] = game.createCustomSpawn(event);
  assert.equal(enemy.carriesKey, true);
  game.defeatEnemy(enemy);
  assert.equal(game.items[0].type, 'key');
  assert.equal(game.items[0].expires, undefined);
});

test('keys increment the HUD count and unlock a chest that awards a Cat Block', () => {
  const game = new Game(() => .5, { customLevel: level([]) });
  game.start();
  const point = { x: game.cat.x, y: game.cat.y };
  game.items = [{ ...point, type: 'treasure-chest', keysRequired: 2 }, { ...point, type: 'key' }];
  game.combat(1 / 120, point.x, point.y);
  assert.equal(game.keys, 1);
  assert.equal(game.items.some(item => item.type === 'treasure-chest'), true, 'the locked chest is passed through');
  game.items.push({ ...point, type: 'key' });
  game.combat(1 / 120, point.x, point.y);
  game.combat(1 / 120, point.x, point.y);
  assert.equal(game.keys, 0, 'opening consumes the required keys');
  assert.equal(game.items.some(item => item.type === 'treasure-chest'), false);
  assert.deepEqual(game.catBlockEvents, ['chest']);
  const animation = game.pickups.find(pickup => pickup.type === 'treasure-chest');
  assert.ok(animation);
  game.updatePickups(.9);
  assert.ok(game.pickups.includes(animation), 'chest animation survives until the block pop starts');
  game.updatePickups(.55);
  assert.ok(game.pickups.includes(animation), 'normal block pop has time to finish');
  game.updatePickups(.15);
  assert.equal(game.pickups.includes(animation), false);
  game.reset();
  assert.deepEqual(game.pickups, [], 'restart clears chest animations');
});

test('chest animations open, float the block upward, then reuse the normal Cat Block pop', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const lids = [], blocks = [], itemPops = [], scales = [], sparks = [];
  const context = vm.createContext({
    ctx: {
      globalAlpha: 1, save() {}, restore() {}, translate() {},
      scale(x, y) { scales.push([x, y]); },
      beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
      fill() { sparks.push(true); },
    },
    drawTreasureChest(opening) { lids.push(opening); },
    drawCatBlockArt(...args) { blocks.push(args); },
    drawGameItem(item) { itemPops.push(item.type); },
  });
  vm.runInContext(source.slice(source.indexOf('function drawPickupPop('), source.indexOf('\nfunction drawBubble(')), context);
  const pickup = { type: 'treasure-chest', kind: 'item', x: 200, y: 200, age: 0 };
  context.drawPickupPop(pickup);
  assert.deepEqual(lids, [0]);
  assert.deepEqual(blocks, []);
  context.drawPickupPop({ ...pickup, age: .55 });
  assert.equal(lids.at(-1), 1);
  assert.equal(blocks.at(-1)[0], 200);
  assert.ok(blocks.at(-1)[1] < 200);
  assert.ok(blocks.at(-1)[2] > 0);
  context.drawPickupPop({ ...pickup, age: .89 });
  assert.ok(blocks.at(-1)[1] < blocks[0][1], 'block rises continuously');
  context.drawPickupPop({ ...pickup, age: 1.1 });
  assert.deepEqual(itemPops, ['cat-block']);
  const chestScale = scales.at(-1);
  const chestSparks = sparks.length;
  context.drawPickupPop({ ...pickup, type: 'cat-block', age: 1.1 - .9 });
  assert.deepEqual(scales.at(-1), chestScale);
  assert.equal(sparks.length, chestSparks * 2, 'same sparkle animation as direct pickup');
});

test('key artwork uses solid bright yellow paths without emoji or transparency', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const fills = [], strokes = [];
  const ctx = {
    globalAlpha: 1, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {},
    closePath() {}, arc() {}, fill() { fills.push(this.fillStyle); },
    stroke() { strokes.push(this.strokeStyle); },
  };
  const context = vm.createContext({ ctx });
  const code = source.slice(source.indexOf('function drawKey('), source.indexOf('\nfunction drawTreasureChest('));
  vm.runInContext(code, context);
  context.drawKey();
  assert.deepEqual(fills, ['#ffdf00', '#ffdf00']);
  assert.ok(strokes.includes('#fff59a'));
  assert.equal(ctx.globalAlpha, 1);
  assert.doesNotMatch(code, /globalAlpha|fillText/);
  assert.match(source, /ctx\.scale\(\.72, \.72\);\s*if \(Object\.hasOwn\(WEAPONS, type\)\) drawWeapon\(0, 0, type\);\s*else drawGameItem\(\{ x: 0, y: 0, type, keysRequired: 1 \}\)/,
    'carrier uses the generic item artwork at a larger readable size');
});

test('regular Cat Block pickups and defeated carriers report their acquisition methods', () => {
  const game = new Game(() => .5, { customLevel: level([]) });
  game.start();
  const point = { x: game.cat.x, y: game.cat.y };
  game.items = [{ ...point, type: 'cat-block' }];
  game.combat(1 / 120, point.x, point.y);
  assert.deepEqual(game.catBlockEvents, ['item']);
  game.catBlockEvents.length = 0;
  game.catBlockCollected = false;
  const enemy = { ...point, type: 'mouse', radius: 19, carriesCatBlock: true };
  game.defeatEnemy(enemy);
  assert.equal(game.items.at(-1).source, 'enemy');
  game.combat(1 / 120, point.x, point.y);
  assert.deepEqual(game.catBlockEvents, ['enemy']);
});
