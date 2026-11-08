const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, ITEMS, CAT_BLOCK_MESSAGES, LEVELS, validateCustomLevel } = require('../src/game.js');

const level = (events, extra = {}) => ({
  version: 1, id: 'Item tests', duration: 30, goal: 1000, heartCost: null, brickSet: 1, events,
  ...(events.some(event => event.kind === 'item' && ['cat-block', 'treasure-chest'].includes(event.type)
    || event.kind === 'enemy' && event.carriesCatBlock)
    ? { catBlock: { description: 'Find the Cat Block.', messages: CAT_BLOCK_MESSAGES } } : {}),
  ...extra,
});

function gameWithItem(type, duration = 30) {
  const game = new Game(() => .5, { customLevel: level([{
    time: 0, kind: 'item', type, x: .5, y: .5,
  }]) });
  game.level.duration = duration;
  game.reset();
  game.start();
  return game;
}

test('the original 19 levels retain their item schedules and spawn bricks', () => {
  const removed = new Set(['smiley-cookie', 'stopwatch', 'stopwatch-green', 'stopwatch-blue',
    'battery', 'music-box', 'eggplant', 'saw-blade', 'magic-sunglasses', 'ditto-stamp', 'spooky-mask',
    'cat-shield-red', 'cat-shield-green', 'cat-shield-blue']);
  for (const level of LEVELS.slice(0, 19)) {
    assert.ok((level.items ?? []).every(([, type]) => !removed.has(type)), level.name);
    assert.ok((level.events ?? []).every(event => event.kind !== 'item' || !removed.has(event.type)), level.name);
    assert.ok(level.brickTypes.every(brick => brick.spawner?.kind !== 'item'
      || !removed.has(brick.spawner.type)), level.name);
  }
});

test('all power-up items validate in custom levels and item spawners', () => {
  for (const type of Object.keys(ITEMS)) {
    const custom = level([{ time: 2, kind: 'item', type, x: .25, y: .75,
      ...(type === 'treasure-chest' ? { keysRequired: 1 } : {}) }]);
    assert.deepEqual(validateCustomLevel(custom), custom);
    const game = new Game(() => .5, {
      customLevel: level([], {
        ...(type === 'cat-block' || type === 'treasure-chest'
          ? { catBlock: { description: 'Find the Cat Block.', messages: CAT_BLOCK_MESSAGES } } : {}),
        brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'item', type } }],
      }),
    });
    const brick = game.bricks.find(candidate => candidate.spawner);
    game.spawnFromBrick(brick);
    assert.equal(game.items[0].type, type);
  }
  const timed = new Game(() => .5, {
    customLevel: level([{ time: 2, kind: 'item', type: 'battery', x: .25, y: .75 }]),
  });
  timed.start();
  timed.update(2);
  assert.equal(timed.items.length, 1);
  assert.equal(timed.items[0].type, 'battery');
});

test('smiley cookie draws all present food toward Koshi while he keeps moving, then triggers a lip lick', () => {
  const game = gameWithItem('smiley-cookie');
  const x = game.cat.x, y = game.cat.y;
  game.items = [{ x, y, type: 'smiley-cookie' }];
  game.food = [{ x: x + 120, y, type: 'H', expires: 20 }];
  game.cat.vx = 100;
  game.combat(1 / 120, x, y);
  assert.equal(game.cookieActive, true);
  game.tick(.25);
  game.tick(1 / 120);
  assert.ok(game.cat.x > x, 'Koshi can move during the eating animation');
  assert.equal(game.score, 7, 'attracted food still awards its normal food value');
  assert.equal(game.cookieActive, false);
  assert.ok(game.cookieLickUntil > game.elapsed);
});

test('red, green, and blue stopwatches add their exact bonuses to the active clock', () => {
  for (const [type, seconds] of [['stopwatch', 10], ['stopwatch-green', 30], ['stopwatch-blue', 60]]) {
    const game = gameWithItem(type, 1);
    game.level.duration = 1;
    game.reset();
    game.start();
    game.items = [];
    game.elapsed = .9;
    game.collectItem({ type });
    assert.equal(game.timeLimit, 1 + seconds);
    game.update(.2);
    assert.equal(game.state, 'playing');
    assert.ok(game.elapsed > 1);
    game.collectItem({ type });
    assert.equal(game.timeLimit, 1 + seconds * 2, 'bonuses stack');
    game.pause(); game.update(5);
    assert.equal(game.timeLimit, 1 + seconds * 2);
    game.reset(); assert.equal(game.timeLimit, 1);
  }
});

test('batteries are stockpiled and recharge one used spawn brick per new touch', () => {
  const game = gameWithItem('battery');
  game.batteries = 2;
  const [first, second] = game.bricks;
  first.spawner = { kind: 'heart', type: 'heart' }; first.spawned = true;
  second.spawner = { kind: 'heart', type: 'heart' }; second.spawned = true;
  game.touchSpawner(first);
  assert.equal(first.spawned, true, 'the recharged brick immediately produces its item and is spent again');
  assert.equal(game.batteries, 1);
  assert.equal(game.healing.length, 1);
  game.touchSpawner(first);
  assert.equal(game.batteries, 1, 'staying on a recharged brick cannot spend more batteries');
  game.spawnerTouching.clear();
  game.touchSpawner(second);
  assert.equal(second.spawned, true);
  assert.equal(game.batteries, 0);
});

test('music box puts current enemies to sleep for exactly ten seconds', () => {
  const game = gameWithItem('music-box');
  game.items = [];
  game.robots.push(...game.createCustomSpawn({ time: 0, kind: 'enemy', type: 'mouse', x: .2, y: .2 }));
  const enemy = game.robots[0], position = { x: enemy.x, y: enemy.y };
  game.collectItem({ type: 'music-box' });
  assert.equal(game.musicStreamStart, game.elapsed);
  assert.equal(game.musicStreamUntil, game.elapsed + 10);
  assert.equal(game.enemiesSleepUntil, game.musicStreamUntil);
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(enemy.asleep, true);
  assert.deepEqual({ x: enemy.x, y: enemy.y }, position);
  game.elapsed = 9.99;
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(enemy.asleep, true);
  game.elapsed = 10;
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(enemy.asleep, false);
});

test('music notation streams behind play objects and reaches its offscreen end at the sleep deadline', () => {
  const { readFileSync } = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1, strokeStyle: '', fillStyle: '', lineWidth: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'save') return () => operations.push(['save']);
      if (name === 'restore') return () => operations.push(['restore']);
      if (name === 'translate') return (...args) => operations.push(['translate', ...args]);
      if (name === 'stroke') return () => operations.push(['stroke', target.globalAlpha]);
      if (name === 'fill') return () => operations.push(['fill', target.globalAlpha]);
      return () => {};
    },
  });
  const context = vm.createContext({ ctx });
  assert.ok(source.indexOf('drawMusicStream(game, streamRows.music);') < source.indexOf('for (const food of game.food)'), 'the score is painted behind the pickups and characters');
  vm.runInContext(source.slice(source.indexOf('function ribbonTransform('), source.indexOf('function drawCapeStream('))
    + source.slice(source.indexOf('function drawMusicStream('), source.indexOf('function drawRobot(')), context);
  const game = { width: 960, height: 600, musicStreamStart: 10, musicStreamUntil: 20, elapsed: 10 };
  context.drawMusicStream(game);
  assert.ok(operations.some(([name, alpha]) => name === 'stroke' && alpha === .25), 'staff is translucent');
  assert.ok(operations.some(([name]) => name === 'fill'), 'notation is drawn on the music staff');
  assert.deepEqual(operations.filter(([name]) => name === 'translate')[0], ['translate', -0, 300]);
  operations.length = 0;
  game.elapsed = 15;
  context.drawMusicStream(game);
  assert.deepEqual(operations.filter(([name]) => name === 'translate')[0], ['translate', -498, 300]);
  operations.length = 0;
  game.elapsed = game.musicStreamUntil;
  context.drawMusicStream(game);
  assert.deepEqual(operations, [], 'the stream disappears exactly when the sleep effect expires');
});

test('music box artwork includes a winding lever, shaded sides, and a larger outlined note', () => {
  const { readFileSync } = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: '' }, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => operations.push([name, ...args, target.fillStyle, target.strokeStyle, target.lineWidth, target.font]);
    },
    set(target, name, value) { target[name] = value; return true; },
  });
  const context = vm.createContext({ ctx, ITEMS });
  vm.runInContext(source.slice(source.indexOf('function drawCatShield('), source.indexOf('\nfunction updateEnding('))
    + source.slice(source.indexOf('function drawGameItem('), source.indexOf('function drawMusicStream(')), context);
  context.drawGameItem({ x: 0, y: 0, type: 'music-box' });
  assert.ok(operations.some(([name, ...args]) => name === 'fill' && args.includes('#613951')), 'box sides have a deep shadow');
  assert.ok(operations.some(([name, ...args]) => name === 'fill' && args.includes('#955779')), 'the side face is separately shaded');
  assert.ok(operations.some(([name, ...args]) => name === 'lineTo' && args[0] === 26), 'the winding lever protrudes from the box');
  const musicBoxArt = source.slice(source.indexOf("} else if (item.type === 'music-box') {"), source.indexOf("} else if (item.type === 'eggplant') {"));
  assert.match(musicBoxArt, /ctx\.fillStyle = '#fff0b0'; ctx\.strokeStyle = '#603452'; ctx\.lineWidth = 1;[\s\S]*ctx\.font = 'bold 23px serif';[\s\S]*ctx\.strokeText\('♪', -2, 6\); ctx\.fillText\('♪', -2, 6\)/);
});

test('eggplant removes ten food points without making the score negative', () => {
  const game = gameWithItem('eggplant');
  game.score = 27;
  game.collectItem({ type: 'eggplant' });
  assert.equal(game.score, 17);
  game.collectItem({ type: 'eggplant' });
  game.collectItem({ type: 'eggplant' });
  assert.equal(game.score, 0);
});

test('optional item and sword lifetimes round-trip, while invalid supplied durations are rejected', () => {
  for (const [kind, type] of [['item', 'eggplant'], ['weapon', 'gold']]) {
    for (const lifetime of [undefined, null, .1, 12.5, 3600]) {
      const event = { time: 2, kind, type, x: .2, y: .3, ...(lifetime === undefined ? {} : { lifetime }) };
      const spawner = { kind, type, ...(lifetime === undefined ? {} : { lifetime }) };
      const custom = { ...level([event]), brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', spawner }] };
      const normalized = validateCustomLevel(custom);
      assert.equal(normalized.events[0].lifetime, lifetime ?? undefined);
      assert.equal(normalized.brickTypes[0].spawner.lifetime, lifetime ?? undefined);
      assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(normalized))), normalized);
    }
    for (const lifetime of [0, -.1, .09, 3601, NaN, Infinity, '', '5', false, {}]) {
      assert.throws(() => validateCustomLevel(level([{ time: 0, kind, type, x: .2, y: .3, lifetime }])), /lifetime/);
      assert.throws(() => validateCustomLevel({ ...level([]), brickTypes: [
        { edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind, type, lifetime } },
      ] }), /lifetime/);
    }
  }
});

test('timed collectible expiry starts at appearance, survives preview reservation, and freezes on pause', () => {
  for (const [kind, type, collection] of [['item', 'battery', 'items'], ['weapon', 'gold', 'weapons']]) {
    const event = { time: 1, kind, type, x: .1, y: .1, lifetime: .5 };
    const game = new Game(() => .5, { customLevel: level([event]) });
    game.start(); game.update(.5);
    const reserved = [...game.pendingSpawns.values()][0].items[0];
    assert.equal(reserved.born, 1);
    assert.equal(reserved.expires, 1.5);
    assert.equal(game[collection].length, 0);
    game.update(.5);
    assert.equal(game[collection][0], reserved);
    game.update(.49);
    game.pause(); game.update(10);
    assert.equal(game[collection].length, 1);
    game.resume(); game.update(.01);
    assert.equal(game[collection].length, 0, 'expires exactly at the deadline');
    assert.equal(game.pickups.length, 0, 'expiry is not a pickup');
    game.reset();
    assert.equal(game[collection].length, 0);
  }
});

test('expired objects cannot be collected, but ground expiry does not shorten an equipped sword', () => {
  const game = new Game(() => .5, { customLevel: level([]) });
  game.start(); game.elapsed = 1;
  const point = { x: game.cat.x, y: game.cat.y };
  game.items = [game.createCollectible(0, 'battery', 1, point)];
  game.weapons = [game.createCollectible(0, 'gold', 1, point)];
  game.combat(0, point.x, point.y);
  assert.equal(game.batteries, 0);
  assert.equal(game.weapon, null);
  assert.equal(game.pickups.length, 0);
  game.weapons = [game.createCollectible(1, 'gold', .1, point)];
  game.combat(0, point.x, point.y);
  assert.equal(game.weapon.expires, 16, 'gold keeps its fifteen seconds from pickup');
  game.update(.2);
  assert.equal(game.weapon.type, 'gold');
});

test('omitted lifetimes persist through clock extensions and spawn bricks start fresh timers on every spawn', () => {
  const game = new Game(() => .5, { customLevel: { ...level([]), duration: 1 } });
  game.start();
  game.items = [game.createCollectible(0, 'battery', undefined, game.pointFromRelative(.1, .1))];
  game.weapons = [game.createCollectible(0, 'wood', undefined, game.pointFromRelative(.9, .9))];
  game.collectItem({ type: 'stopwatch' });
  game.update(2);
  assert.equal(game.items.length, 1);
  assert.equal(game.weapons.length, 1);
  for (const [kind, type, collection] of [['item', 'battery', 'items'], ['weapon', 'wood', 'weapons']]) {
    const brick = game.bricks[0];
    brick.spawner = { kind, type, lifetime: .5 };
    game.spawnFromBrick(brick);
    assert.equal(game[collection].at(-1).expires, game.elapsed + .5);
    game.elapsed = 3;
    game.batteries = 1; game.spawnerTouching.clear(); game.touchSpawner(brick);
    assert.equal(game[collection].at(-1).born, 3);
    assert.equal(game[collection].at(-1).expires, 3.5);
    game.elapsed = 2;
  }
});

test('campaign collectible tuples also support optional lifetime and preserve reserved positions', () => {
  const game = new Game(() => .2, { customLevel: level([]) });
  game.level.weapons = [[1, 'silver', .25]];
  game.level.items = [[1, 'battery', .25]];
  game.start(); game.update(.5);
  const pending = [...game.pendingSpawns.values()].map(entry => entry.items[0]);
  assert.equal(pending.length, 2);
  game.update(.5);
  assert.equal(game.weapons[0], pending[0]);
  assert.equal(game.items[0], pending[1]);
  game.update(.25);
  assert.equal(game.weapons.length, 0);
  assert.equal(game.items.length, 0);
});

test('food, items, and swords create harmless pickup snapshots which pause, finish after win/loss, and reset', () => {
  for (const terminal of ['won', 'lost']) {
    const game = new Game(() => .5, { customLevel: level([]) });
    game.start();
    const point = { x: game.cat.x, y: game.cat.y };
    const item = { ...point, type: 'battery' };
    game.items = [item]; game.weapons = [{ ...point, type: 'wood' }];
    game.food = [{ ...point, type: 'H', lifetime: 10, expires: 10 }];
    game.update(.01);
    assert.equal(game.score, 7);
    assert.equal(game.batteries, 1);
    assert.deepEqual(game.pickups.map(pickup => pickup.kind).sort(), ['food', 'item', 'weapon']);
    assert.equal(game.pickups.find(pickup => pickup.kind === 'food').value, 7);
    item.x = -999;
    assert.equal(game.pickups.find(pickup => pickup.kind === 'item').x, point.x, 'snapshot does not retain the object');
    game.pause();
    const age = game.pickups[0].age;
    game.update(10); assert.equal(game.pickups[0].age, age);
    game.resume(); game.state = terminal;
    const elapsed = game.elapsed;
    game.update(.4);
    assert.ok(game.pickups[0].age > age);
    assert.equal(game.elapsed, elapsed, 'completed gameplay does not advance');
    assert.equal(game.score, 7); assert.equal(game.batteries, 1);
    game.update(.4);
    assert.equal(game.pickups.length, 0);
    game.recordPickup({ ...point, type: 'battery' }, 'item');
    game.reset(); assert.equal(game.pickups.length, 0);
  }
});

test('eggplant uses depth shading without penalty text, and sparkle pops grow then shrink and fade', () => {
  const { readFileSync } = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'createLinearGradient') return (...args) => {
        operations.push([name, ...args]);
        return { addColorStop: (...stop) => operations.push(['stop', ...stop]) };
      };
      return (...args) => operations.push([name, ...args, target.globalAlpha]);
    },
  });

  const context = vm.createContext({ ctx, ITEMS, FOODS: require('../src/game.js').FOODS, SWORDS: require('../src/game.js').SWORDS,
    FOOD_COLORS: { H: '#f7d26d' },
    drawSword: (...args) => operations.push(['sword', ...args]) });
  vm.runInContext(source.slice(source.indexOf('function drawCatShield('), source.indexOf('\nfunction updateEnding('))
    + source.slice(source.indexOf('function drawGameItem('), source.indexOf('function drawMusicStream(')), context);
  context.drawGameItem({ x: 0, y: 0, type: 'eggplant' });
  assert.equal(operations.filter(([name]) => name === 'stop').length, 4);
  assert.ok(!operations.some(([name]) => name === 'fillText' || name === 'strokeText'));
  vm.runInContext(source.slice(source.indexOf('function drawFoodBadge('), source.indexOf('function drawObjectLifetime(')), context);
  for (const [kind, type] of [['food', 'H'], ['item', 'battery'], ['weapon', 'gold']]) {
    operations.length = 0;
    context.drawPickupPop({ x: 1, y: 2, kind, type, age: .1 });
    const grow = operations.find(([name]) => name === 'scale')[1];
    assert.ok(grow > 1);
    assert.ok(ctx.globalAlpha < 1 && ctx.globalAlpha > 0);
    assert.ok(operations.filter(([name]) => name === 'lineTo').length >= 24, 'eight diamond sparkles');
    operations.length = 0;
    context.drawPickupPop({ x: 1, y: 2, kind, type, age: .4 });
    assert.ok(operations.find(([name]) => name === 'scale')[1] < grow);
    operations.length = 0;
    context.drawPickupPop({ x: 1, y: 2, kind, type, age: .55 });
    assert.equal(operations.length, 0);
  }
});

test('battery artwork has a grey positive terminal, shaded yellow top, and dark lower two-thirds without AA text', () => {
  const { readFileSync } = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [], gradients = [];
  const ctx = new Proxy({ fillStyle: '', strokeStyle: '' }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'createLinearGradient') return () => {
        const gradient = { stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); } };
        gradients.push(gradient); return gradient;
      };
      return (...args) => operations.push({ name, args, fill: target.fillStyle });
    },
  });
  const context = vm.createContext({ ctx, ITEMS });
  vm.runInContext(source.slice(source.indexOf('function drawCatShield('), source.indexOf('\nfunction updateEnding('))
    + source.slice(source.indexOf('function drawGameItem('), source.indexOf('function drawMusicStream(')), context);
  context.drawGameItem({ x: 0, y: 0, type: 'battery' });
  assert.equal(gradients.length, 3, 'body and terminal have separate depth gradients');
  assert.ok(gradients[0].stops.some(([, color]) => color === '#ffe66b'));
  assert.ok(gradients[1].stops.every(([, color]) => /^#(?:101216|50545b|272a30|080a0d)$/.test(color)));
  assert.ok(gradients[2].stops.some(([, color]) => color === '#e1e4e8'));
  assert.ok(operations.some(op => op.name === 'clip'), 'two-tone fills stay within the rounded body');
  const fills = operations.filter(op => op.name === 'fillRect');
  assert.deepEqual(fills.map(op => op.args), [[-11, -18, 22, 12], [-11, -6, 22, 24]]);
  assert.equal(fills[0].fill, gradients[0]);
  assert.equal(fills[1].fill, gradients[1]);
  assert.ok(operations.some(op => op.name === 'roundRect' && op.args[1] === -23), 'raised positive terminal');
  assert.ok(!operations.some(op => op.name === 'moveTo' || op.name === 'lineTo'), 'terminal has no plus mark');
  assert.ok(!operations.some(op => op.name === 'fillText' || op.name === 'strokeText'), 'AA label is removed');
});

test('all stopwatch graphics match their bonus and color, with matching editor and spawner symbols', () => {
  const { readFileSync } = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const { spawnSymbol, spawnColor } = require('../src/brick-visuals.js');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ fillStyle: '' }, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => operations.push({ name, args, color: target.fillStyle });
    },
  });
  const context = vm.createContext({ ctx, ITEMS });
  vm.runInContext(source.slice(source.indexOf('function drawCatShield('), source.indexOf('\nfunction updateEnding('))
    + source.slice(source.indexOf('function drawGameItem('), source.indexOf('function drawMusicStream(')), context);
  for (const [type, color, seconds] of [['stopwatch', '#d94a4a', 10], ['stopwatch-green', '#399d4a', 30], ['stopwatch-blue', '#287dcc', 60]]) {
    operations.length = 0;
    context.drawGameItem({ x: 0, y: 0, type });
    assert.ok(operations.some(op => op.name === 'fill' && op.color === color), 'body uses the correct color');
    assert.ok(operations.some(op => op.name === 'fill' && op.color === '#fff7df'), 'eggshell face is preserved');
    assert.ok(operations.some(op => op.name === 'fillText' && op.args[0] === `+${seconds}s`), 'face prints the exact bonus');
    const spawn = { kind: 'item', type };
    assert.equal(spawnColor(spawn), color);
    assert.equal(spawnSymbol(spawn), spawnSymbol({ kind: 'item', type: 'stopwatch' }));
  }
});

test('Cat Shield pickups use the cat-face design and matching color in game and editor', () => {
  const { spawnSymbol, spawnColor } = require('../src/brick-visuals.js');
  const { readFileSync } = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [], gradients = [];
  const ctx = new Proxy({ fillStyle: '', strokeStyle: '', globalAlpha: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'createLinearGradient') return (...args) => {
        const gradient = { args, stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); } };
        gradients.push(gradient);
        return gradient;
      };
      return (...args) => operations.push({ name, args, fill: target.fillStyle, stroke: target.strokeStyle });
    },
  });
  const context = vm.createContext({ ctx, ITEMS });
  vm.runInContext(source.slice(source.indexOf('function drawCatShield('), source.indexOf('\nfunction updateEnding('))
    + source.slice(source.indexOf('function drawGameItem('), source.indexOf('function drawMusicStream(')), context);
  for (const [type, color] of [
    ['cat-shield-red', '#ed5555'], ['cat-shield-green', '#63d877'], ['cat-shield-blue', '#519eff'],
  ]) {
    operations.length = 0;
    gradients.length = 0;
    context.drawGameItem({ x: 0, y: 0, type });
    assert.ok(operations.some(op => op.name === 'fill' && op.fill === gradients[0]), `${type} uses its shaded fill`);
    assert.ok(operations.some(op => op.name === 'stroke' && op.stroke === color), `${type} uses its tier color`);
    assert.ok(operations.some(op => op.name === 'stroke' && op.stroke === '#17212a'), 'the cat-face details have a dark outline');
    assert.deepEqual(gradients[0].stops.map(([, shade]) => shade), [
      { '#ed5555': '#ffc2b8', '#63d877': '#d3ffb0', '#519eff': '#c5e8ff' }[color],
      color,
      { '#ed5555': '#a82f3b', '#63d877': '#287b4b', '#519eff': '#2958a2' }[color],
    ], 'the face shield uses graduated shading for depth');
    const spawn = { kind: 'item', type };
    assert.equal(spawnColor(spawn), color);
    assert.equal(spawnSymbol(spawn), spawnSymbol({ kind: 'item', type: 'cat-shield-red' }));
    assert.match(spawnSymbol(spawn), /M-25 -34.*L0 -29 L6 -17/, 'spawner icon has the wider center peak');
    assert.doesNotMatch(spawnSymbol(spawn), /M-16 -27|M16 -27/, 'spawner icon has smooth upper corners');
    assert.match(spawnSymbol(spawn), /M-12 -5 L-8 -10 L-3 -5.*M12 -5 L8 -10 L3 -5/,
      'both eyes use the same dark strokes as the mouth');
    assert.match(spawnSymbol(spawn), /M-11 2 L-21 -3 M-16 8 H-23 M-15 14 L-21 19 M11 2 L21 -3 M16 8 H23 M15 14 L21 19/,
      'the two lower whiskers on each side are shortened at their inner ends');
    assert.ok(operations.filter(op => op.name === 'stroke' && op.stroke === '#17212a').length >= 10,
      'canvas art draws dark eyes, mouth, and whiskers');
  }
});

test('equipped Cat Shield is a plain circular ring in its active color', () => {
  const { readFileSync } = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [];
  const ctx = new Proxy({ fillStyle: '', strokeStyle: '', lineWidth: 0, globalAlpha: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => operations.push({ name, args, fill: target.fillStyle, stroke: target.strokeStyle,
        width: target.lineWidth, alpha: target.globalAlpha });
    },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawEquippedCatShield('), source.indexOf('\nfunction updateEnding(')), context);
  context.drawEquippedCatShield(100, 200, 30, '#519eff');
  assert.ok(operations.some(op => op.name === 'arc' && op.args[0] === 100 && op.args[1] === 200 && op.args[2] === 30));
  assert.ok(operations.some(op => op.name === 'stroke' && op.stroke === '#519eff' && op.width === 4));
  assert.ok(operations.some(op => op.name === 'fill' && op.fill === '#519eff' && op.alpha === .1));
});

test('swept Cat Shield pickups equip and replace Koshi’s shield', () => {
  const game = gameWithItem('cat-shield-blue');
  game.items = [{ x: game.cat.x, y: game.cat.y, type: 'cat-shield-blue' }];
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.catShield, 'blue');
  game.items = [{ x: game.cat.x, y: game.cat.y, type: 'cat-shield-red' }];
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.catShield, 'red');
});
