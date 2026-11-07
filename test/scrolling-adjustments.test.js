const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game } = require('../src/game.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const level = (events = [], autoscroll = { length: 56, speed: 2, events: [] }) => ({
  version: 1, id: 'Scrolling adjustments', duration: 60, goal: 0, survive: true,
  heartCost: null, brickSet: 1, events, autoscroll,
});
const assertVisible = (game, point, time, radius = 18) => {
  for (const moment of [time, time + 1]) {
    const camera = game.camera(moment);
    assert.ok(point.x - radius >= camera.x - 1e-7 && point.x + radius <= camera.x + camera.width + 1e-7);
    assert.ok(point.y - radius >= camera.y - 1e-7 && point.y + radius <= camera.y + camera.height + 1e-7);
  }
};

test('random pickups, objects, formations and food patterns stay visible for one second at their actual spawn time', () => {
  for (const options of [{}, { portrait: true, scale: .5 }]) {
    const game = new Game(() => 0, { customLevel: level(), ...options });
    game.elapsed = 4;
    for (const event of [
      { kind: 'item', type: 'battery' }, { kind: 'weapon', type: 'wood' },
      { kind: 'food', type: 'H' }, { kind: 'object', type: 'bumper-red' },
      { kind: 'object', type: 'obstruction-circle', width: 160 },
      { kind: 'object', type: 'bubble-blue' }, { kind: 'object', type: 'soccer-ball' },
      { kind: 'food', type: 'H', group: { shape: 'circle', count: 4 } },
      { kind: 'object', type: 'bumper-blue', group: { shape: 'line', count: 3 } },
    ]) {
      const spawn = { ...event, random: true, time: 5 };
      for (const point of game.customEventPoints(spawn)) assertVisible(game, point, 5, game.spawnRadius(spawn));
    }
    assertVisible(game, game.createCollectible(5, 'wood', 10), 5);
    assertVisible(game, game.randomPickupPoint(), 4);
    for (const method of ['S', 'R3', 'L3', 'C3']) {
      for (const point of game.createFood([5, method, 'H', 10])) assertVisible(game, point, 5);
    }
  }
});

test('random spawn clearance integrates speed changes, pauses and the endpoint without changing authored placements', () => {
  const scroll = { length: 56, speed: 0, events: [{ time: 5.5, speed: 3 }, { time: 6, speed: 0 }] };
  const game = new Game(() => 0, { customLevel: level([], scroll) });
  assertVisible(game, game.randomPickupPoint(5), 5);
  game.elapsed = 6;
  const bounds = game.randomSpawnBounds();
  assert.equal(bounds.left, game.camera().x + 18);
  const fixed = { time: 5, kind: 'food', type: 'H', x: 0, y: .5 };
  assert.deepEqual(game.customEventPoints(fixed), [game.campaignEventPoint(0, .5)]);
  const fast = new Game(() => 0, { customLevel: level([], { length: 1000, speed: 100, events: [] }) });
  assert.throws(() => fast.randomPickupPoint(), /remain on screen for one second/);
});

test('bumper warnings use obstruction timing, dotted outlines and matching concentric rings', () => {
  for (const color of ['red', 'green', 'blue']) {
    const game = new Game(() => .5, { customLevel: level([
      { time: 3, kind: 'object', type: `bumper-${color}`, x: .2, y: .2 },
    ], { length: 56, speed: 0, events: [] }) });
    game.start(); game.elapsed = 1; game.prepareSpawns();
    const cue = game.spawnCues[0];
    assert.equal(cue.bumper.type, `bumper-${color}`);
    assert.equal(cue.progress, 0);
    game.elapsed = 2; assert.equal(game.spawnCues[0].progress, .5);
    assert.equal(game.bumpers.length, 0);
    game.elapsed = 3; game.spawnCustomEvents();
    assert.equal(game.bumpers.length, 1);
    const calls = [];
    const ctx = new Proxy({}, { get: (_, name) => name === 'createRadialGradient'
      ? () => ({ addColorStop() {} }) : (...args) => calls.push([name, ...args]) });
    const draw = source.slice(source.indexOf('function drawSpawnCue('), source.indexOf('function drawSword('));
    vm.runInNewContext(`${draw};drawSpawnCue(cue);`, { ctx, cue });
    const rings = calls.filter(([name]) => name === 'arc').slice(0, 4).map(call => call[3]);
    assert.deepEqual(rings, [48, 48 * .72, 48 * .43, 48 * .14]);
    assert.ok(calls.some(([name, dash]) => name === 'setLineDash' && String(dash) === '3,5'));
  }
});

test('appearing bumpers share obstruction overlap rules, preserve themselves, and brick spawners wait two seconds', () => {
  const game = new Game(() => .5, { customLevel: level([], { length: 56, speed: 0, events: [] }) });
  game.start();
  const bumper = game.createBumper({ x: 400, y: 300 }, 'bumper-red');
  game.bumpers = [bumper];
  game.cat.x = 400; game.cat.y = 300;
  game.invulnerableUntil = Infinity;
  game.food = [{ x: 400, y: 300 }];
  game.items = [{ x: 400, y: 300 }];
  game.clearAppearingObstruction(bumper);
  assert.equal(game.state, 'lost');
  assert.equal(game.food.length, 0); assert.equal(game.items.length, 0);
  assert.deepEqual(game.bumpers, [bumper]);
  game.reset(); game.start();
  const brick = game.bricks[0];
  brick.spawner = { kind: 'object', type: 'bumper-blue' };
  game.spawnFromBrick(brick);
  assert.equal(game.bumpers.length, 0);
  const pending = [...game.pendingSpawns.values()][0];
  assert.equal(pending.duration, 2); assert.equal(pending.time, 2);
  assertVisible(game, pending.items[0], 2, 48);
  game.cat.x = game.camera().width - 50; game.cat.y = 300;
  game.update(2);
  assert.equal(game.bumpers.length, 1);
});

test('trajectory stops at the viewport boundary even when an offscreen bumper would reflect it', () => {
  for (const options of [{}, { portrait: true }]) {
    const game = new Game(() => .5, { customLevel: level(), ...options });
    game.elapsed = 5;
    const camera = game.camera();
    game.cat.x = camera.x + camera.width / 2; game.cat.y = camera.y + camera.height / 2;
    game.cat.vx = options.portrait ? 0 : 100; game.cat.vy = options.portrait ? 100 : 0;
    const bumper = game.createBumper({ x: options.portrait ? game.cat.x : camera.x + camera.width + 100,
      y: options.portrait ? camera.y + camera.height + 100 : game.cat.y }, 'bumper-green');
    game.bumpers = [bumper];
    game.target = { x: bumper.x + 100, y: bumper.y + 100 };
    for (const obstacle of [false, true]) {
      game.obstructions = obstacle ? [game.createObstruction({ x: game.cat.x + 200, y: game.cat.y - 200 },
        { type: 'obstruction-circle' })] : [];
      const points = game.trajectory();
      assert.ok(points.length >= 2);
      const end = points.at(-1);
      assert.ok(Math.abs(end[options.portrait ? 1 : 0] - (options.portrait
        ? camera.y + camera.height : camera.x + camera.width)) < 1e-7);
      assert.ok(points.every(([x, y]) => x >= camera.x && x <= camera.x + camera.width
        && y >= camera.y && y <= camera.y + camera.height));
    }
  }
});

test('cookie licking uses a closed red tongue with a rounded curve and survival briefing is spelled correctly', () => {
  const tongue = source.slice(source.indexOf("} else if (expression === 'licking')"), source.indexOf('  for (const sign of [-1, 1])', source.indexOf("} else if (expression === 'licking')")));
  assert.match(tongue, /fillStyle = '#e84b58'/);
  assert.match(tongue, /bezierCurveTo/);
  assert.match(tongue, /closePath\(\); ctx\.fill\(\)/);
  assert.match(source, /Survive Time:/);
  assert.doesNotMatch(source, /Surive/);
});

test('the status row reserves a full line while slime contact clears its text', () => {
  const rule = styles.match(/\.game-status\s*\{([^}]+)\}/)[1];
  const padding = Number(rule.match(/padding:\s*0 20px (\d+)px/)[1]);
  const reservedPadding = Number(rule.match(/min-height:\s*calc\(1lh \+ (\d+)px\)/)[1]);
  assert.equal(reservedPadding, padding, 'reserve a line plus padding to keep the page height stable');
  const sync = source.slice(source.indexOf('function syncUI()'), source.indexOf('  const { goal:', source.indexOf('function syncUI()')));
  const context = {
    game: { state: 'playing', elapsed: 48, stuckUntil: 0 }, displayedStuck: false,
    toast: {}, status: { textContent: 'Click a brick to move. Change course anytime.' },
    performance: { now: () => 0 },
  };
  vm.runInNewContext(`${sync}}`, context);
  context.game.stuckUntil = 49;
  context.syncUI();
  assert.equal(context.status.textContent, '', 'slime still suppresses the status message');
  context.game.elapsed = 49;
  context.syncUI();
  assert.equal(context.status.textContent, 'Free of the slime! Pick a brick to move.');
});
