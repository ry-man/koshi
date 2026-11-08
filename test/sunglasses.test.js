const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const engine = require('../src/game.js');
const visuals = require('../src/brick-visuals.js');
const { Game, validateCustomLevel } = engine;
const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const level = events => ({ version: 1, id: 'Sunglasses tests', duration: 30, goal: 1000, heartCost: null, brickSet: 1, events });
function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: level([]) });
  game.start();
  return game;
}
const aim = (game, brick) => game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2);

test('sunglasses placements and spawners round-trip with optional lifetime and collect once', () => {
  const event = { time: 0, kind: 'item', type: 'magic-sunglasses', x: .5, y: .5, lifetime: 1 };
  const custom = { ...level([event]), brickTypes: [
    { edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'item', type: 'magic-sunglasses', lifetime: 2 } },
  ] };
  assert.deepEqual(validateCustomLevel(custom), custom);
  const game = new Game(() => .5, { customLevel: custom });
  game.start(); game.update(.01);
  assert.equal(game.sunglassesActive, true);
  assert.equal(game.sunglassesUntil - game.sunglassesStart, 10);
  assert.ok(game.sunglassesPickup);
  const start = game.sunglassesStart;
  game.update(.1);
  assert.equal(game.sunglassesStart, start);
  assert.equal(game.pickups.filter(pickup => pickup.type === 'magic-sunglasses').length, 1);
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  assert.equal(game.items[0].type, 'magic-sunglasses');
  assert.equal(game.items[0].expires, game.elapsed + 2);
  assert.ok(visuals.spawnSymbol({ kind: 'item', type: 'magic-sunglasses' }));
  assert.ok(engine.LEVELS.slice(0, 19).every(level => !level.items.some(([, type]) => type === 'magic-sunglasses')));
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  test(`sunglasses bypass every selection lock without spending uses or changing cooldowns and Toggles in ${options.portrait ? 'portrait' : 'desktop'}`, () => {
    const game = arena(options), [first, second, exhausted, cinder] = game.bricks;
    first.readyAt = 12; first.crumbler = 4; first.usesLeft = 4;
    second.toggle = 2; second.toggleRemaining = 2;
    exhausted.crumbler = 5; exhausted.usesLeft = 0;
    cinder.kind = 'cinder';
    assert.equal(aim(game, first), false);
    assert.equal(aim(game, second), false);
    assert.equal(aim(game, exhausted), false);
    game.collectItem({ type: 'magic-sunglasses' });
    for (const brick of [first, second, exhausted, first, second]) assert.equal(aim(game, brick), true);
    assert.equal(first.readyAt, 12);
    assert.equal(first.usesLeft, 4);
    assert.equal(second.toggleRemaining, 2);
    assert.equal(exhausted.usesLeft, 0);
    assert.equal(aim(game, cinder), false);
    game.cat.vx = 0; game.cat.vy = 0;
    game.update(9.99);
    assert.equal(game.sunglassesActive, true);
    game.update(.01);
    assert.equal(game.sunglassesActive, false, 'effect ends at exactly ten seconds');
    assert.ok(first.readyAt <= game.elapsed + 1e-9, 'remaining cooldown completes at expiry');
    assert.equal(aim(game, second), false);
    assert.equal(aim(game, exhausted), false);
    assert.equal(aim(game, first), true);
    assert.equal(first.usesLeft, 3, 'normal consumption resumes');
    assert.equal(second.toggleRemaining, 1, 'normal toggle counters resume');
  });

  test(`cooldowns finish once at refreshed expiry and new cooldowns remain normal in ${options.portrait ? 'portrait' : 'desktop'}`, () => {
    const game = arena(options);
    for (const brick of game.bricks) brick.readyAt = 25;
    game.bricks[1].absorbedBy = game.bricks[0].id;
    game.collectItem({ type: 'magic-sunglasses' });
    game.update(9);
    game.collectItem({ type: 'magic-sunglasses' });
    game.update(1);
    assert.ok(game.bricks.every(brick => brick.readyAt === 25), 'original deadline must not recharge after refresh');
    game.pause(); game.update(20);
    assert.ok(game.bricks.every(brick => brick.readyAt === 25), 'pause does not complete cooldowns');
    game.resume(); game.update(9);
    assert.equal(game.sunglassesActive, false);
    assert.ok(game.bricks.every(brick => brick.readyAt <= game.elapsed + 1e-9), 'every brick is recharged, even hidden members');
    const brick = game.bricks.find(brick => brick.absorbedBy === null);
    assert.equal(aim(game, brick), true);
    const cooldown = brick.readyAt;
    game.update(.1);
    assert.equal(brick.readyAt, cooldown, 'expiry recharge must not repeat');
    assert.equal(aim(game, brick), false, 'normal cooldown applies after the power');
  });
}

test('absorbed bricks and slime holds stay unavailable, while old cooldowns can naturally expire during the effect', () => {
  const game = arena(), [first, second] = game.bricks;
  first.readyAt = 2;
  game.collectItem({ type: 'magic-sunglasses' });
  game.stuckUntil = 1;
  assert.equal(aim(game, first), false);
  game.stuckUntil = 0;
  second.absorbedBy = first.id;
  assert.equal(aim(game, second), false);
  game.update(10);
  assert.equal(game.sunglassesActive, false);
  assert.equal(aim(game, first), true, 'elapsed cooldown stays expired');
});

test('sunglasses and music streams remain independent, repeat pickups restart ten seconds, pause freezes, and reset clears', () => {
  const game = arena();
  game.collectItem({ type: 'magic-sunglasses', x: 100, y: 120 });
  game.collectItem({ type: 'music-box' });
  assert.equal(game.sunglassesUntil, 10);
  assert.equal(game.musicStreamUntil, 10);
  game.update(2);
  const age = game.sunglassesPickup.age;
  const elapsed = game.elapsed;
  game.pause(); game.update(10);
  assert.equal(game.sunglassesPickup.age, age);
  assert.equal(game.elapsed, elapsed);
  game.resume(); game.collectItem({ type: 'magic-sunglasses', x: 200, y: 220 });
  assert.equal(game.sunglassesStart, elapsed);
  assert.equal(game.sunglassesUntil, elapsed + 10);
  assert.equal(game.sunglassesPickup.age, 0);
  assert.equal(game.musicStreamUntil, 10, 'refresh does not extend music sleep');
  game.update(10);
  assert.equal(game.sunglassesActive, false);
  assert.ok(game.sunglassesPickup, 'glasses remain briefly to fade out');
  game.update(.51);
  assert.equal(game.sunglassesPickup, null);
  game.reset();
  assert.equal(game.sunglassesStart, null);
  assert.equal(game.sunglassesUntil, 0);
  assert.equal(game.sunglassesActive, false);
});

test('sunglasses visual finishes after gameplay ends without extending completed gameplay', () => {
  const game = arena();
  game.collectItem({ type: 'magic-sunglasses' });
  game.state = 'won'; game.update(10.6);
  assert.equal(game.elapsed, 0);
  assert.equal(game.sunglassesPickup, null);
  const { context, operations } = drawingContext(game);
  context.drawSunglassesStream(game);
  assert.equal(operations.length, 0, 'completed-game banner does not linger after glasses fade');
});

function drawingContext(game = arena()) {
  const operations = [];
  const ctx = new Proxy({ globalAlpha: 1, strokeStyle: '', fillStyle: '' }, {
    get(target, name) {
      if (name in target) return target[name];
      return (...args) => operations.push({ name, args, alpha: target.globalAlpha, color: target.strokeStyle });
    },
  });
  const context = vm.createContext({ ctx, game });
  vm.runInContext(source.slice(source.indexOf('function ribbonTransform('), source.indexOf('function drawCapeStream('))
    + source.slice(source.indexOf('function drawMagicSunglasses('), source.indexOf('function drawRobot(')), context);
  vm.runInContext(source.slice(source.indexOf('function drawWornSunglasses('), source.indexOf('function drawBrickDestructionSmoke(')), context);
  return { context, operations, ctx };
}

test('sunglasses are layered above the spooky mask during gameplay and both endings', () => {
  const render = source.slice(source.indexOf('function render('), source.indexOf('function drawFoodBadge('));
  const layers = render.slice(render.indexOf('  if (game.maskPickup)'), render.indexOf('  if (game.boomHelmet)'));
  const ending = source.slice(source.indexOf('function drawEnding('), source.indexOf('function powerupStreamRows('));
  for (const state of ['playing', 'won', 'lost']) {
    for (const mask of [false, true]) for (const sunglasses of [false, true]) {
      const game = arena();
      if (mask) game.collectItem({ type: 'spooky-mask' });
      if (sunglasses) game.collectItem({ type: 'magic-sunglasses' });
      const calls = [];
      const context = {
        game, ending: { elapsed: 1, state }, ctx: new Proxy({}, { get: () => () => {} }),
        endingPose: () => ({ x: 100, y: 200, rotation: 0, scale: 1 }),
        drawWornCape() {}, drawCat() {}, drawBoomHelmet() {},
        drawWornMask: () => calls.push('mask'),
        drawWornSunglasses: () => calls.push('sunglasses'),
      };
      vm.runInNewContext(state === 'playing' ? layers : `${ending}\ndrawEnding();`, context);
      assert.deepEqual(calls, [...(mask ? ['mask'] : []), ...(sunglasses ? ['sunglasses'] : [])], state);
    }
  }
});

test('sunglasses shimmer, sparkle, fly to the moving face, and fade only after expiry', () => {
  const game = arena(), { context, operations } = drawingContext(game);
  context.drawMagicSunglasses(0);
  const color = operations.find(op => op.name === 'stroke').color;
  assert.equal(operations.filter(op => op.name === 'fill').length, 7, 'two lenses and five twinkling sparkles');
  operations.length = 0; context.drawMagicSunglasses(1);
  assert.notEqual(operations.find(op => op.name === 'stroke').color, color, 'frame color changes');
  game.collectItem({ type: 'magic-sunglasses', x: 100, y: 120 });
  operations.length = 0; context.drawWornSunglasses(game);
  assert.deepEqual(operations.find(op => op.name === 'translate').args, [100, 120]);
  game.sunglassesPickup.age = .25;
  game.cat.x = 500; game.cat.y = 350;
  operations.length = 0; context.drawWornSunglasses(game);
  assert.deepEqual(operations.find(op => op.name === 'translate').args, [500, 346], 'follows Koshi’s moving face');
  assert.equal(operations.find(op => op.name === 'fill').alpha, 1);
  game.sunglassesPickup.age = 10;
  operations.length = 0; context.drawWornSunglasses(game);
  assert.equal(operations.find(op => op.name === 'fill').alpha, 1, 'glasses stay opaque for the full ten seconds');
  game.sunglassesPickup.age = 10.25;
  operations.length = 0; context.drawWornSunglasses(game);
  assert.equal(operations.find(op => op.name === 'fill').alpha, .5);
});

test('rectangular star/cat banner matches music dimensions but exits after ten seconds behind gameplay', () => {
  const game = arena(), { context, operations } = drawingContext(game);
  game.collectItem({ type: 'magic-sunglasses' });
  game.collectItem({ type: 'music-box' });
  assert.ok(source.indexOf('drawSunglassesStream(game, streamRows.sunglasses);') < source.indexOf('for (const food of game.food)'));
  context.drawSunglassesStream(game);
  const frame = operations.find(op => op.name === 'strokeRect');
  assert.deepEqual(frame.args, [-18, -26, game.width + 36, 52]);
  assert.equal(frame.alpha, .25);
  assert.ok(operations.some(op => op.name === 'quadraticCurveTo'), 'cat smiles');
  assert.ok(operations.filter(op => op.name === 'lineTo').length > 40, 'stars and ears');
  operations.length = 0; context.drawMusicStream(game);
  assert.deepEqual(operations.find(op => op.name === 'strokeRect').args, frame.args);
  game.elapsed = 5;
  operations.length = 0; context.drawSunglassesStream(game);
  assert.deepEqual(operations.find(op => op.name === 'translate').args, [-(game.width + 36) / 2, game.height / 2]);
  game.elapsed = 10;
  operations.length = 0; context.drawSunglassesStream(game);
  assert.equal(operations.length, 0, 'banner exits when power ends');
});

test('brick UI shows full recharge and unlocked Toggle during power and restores stored indicators on expiry', () => {
  const game = arena(), [brick] = game.bricks;
  brick.crumbler = 4; brick.usesLeft = 0; brick.toggle = 2; brick.toggleRemaining = 2; brick.readyAt = 10;
  const node = () => ({
    attributes: {}, dataset: {}, textContent: '', children: new Map(), classList: { toggle() {} },
    style: { properties: {}, setProperty(key, value) { this.properties[key] = value; } },
    setAttribute(key, value) { this.attributes[key] = value; },
    getAttribute(key) { return this.attributes[key]; },
    toggleAttribute() {},
    querySelector(key) { if (!this.children.has(key)) this.children.set(key, node()); return this.children.get(key); },
  });
  const button = node(), knob = node(), count = node(), cinderButton = node(), goalButton = node();
  const cinder = game.bricks[1], goal = game.bricks[2];
  cinder.kind = 'cinder'; goal.kind = 'goal';
  const special = { button, knob, count };
  const context = vm.createContext({
    ...engine, ...visuals, game, WORLDS: require('../src/worlds.js').WORLDS, document: { querySelector: () => node() },
    buttons: [{ brick, members: game.brickParts().filter(part => part.id === brick.id), button, special, usesLeft: brick.usesLeft },
      { brick: cinder, members: [cinder], button: cinderButton }, { brick: goal, members: [goal], button: goalButton }],
    timer: node(), foodCount: node(), hearts: node(), progress: node(), progressLabel: node(),
    weaponStatus: node(), shieldStatus: node(), weaponRemaining: node(), weaponIcon: node(), pause: node(),
    displayedStuck: false, displayedState: 'playing', displayedTurret: false, brickRevision: game.brickRevision, tutorial: null, ending: null,
    syncBrickDestructions() {}, syncLevelRewards() {}, levelInfoReplay: node(),
    showDialog() {}, status: node(), overlay: node(),
  });
  const start = source.indexOf('function syncUI()');
  vm.runInContext(source.slice(start, source.indexOf('\nfunction ', start + 1)), context);
  game.collectItem({ type: 'magic-sunglasses' });
  context.syncUI();
  assert.equal(button.getAttribute('aria-disabled'), 'false');
  assert.equal(button.dataset.deactivated, 'false');
  assert.equal(button.dataset.toggleDisabled, 'false');
  assert.equal(button.style.properties['--cooldown-fill'], '100%');
  assert.equal(button.dataset.sunglassesGlow, 'true');
  assert.equal(button.style.properties['--sunglasses-color'], 'hsl(0, 85%, 70%)');
  for (const immutable of [cinderButton, goalButton]) {
    assert.equal(immutable.dataset.sunglassesGlow, 'true');
    assert.equal(immutable.getAttribute('aria-disabled'), 'true', 'glow does not make immutable bricks selectable');
  }
  assert.equal(knob.getAttribute('cx'), 62);
  assert.equal(count.textContent, '0');
  game.update(2); context.syncUI();
  for (const glowing of [button, cinderButton, goalButton]) {
    assert.equal(glowing.style.properties['--sunglasses-color'], `hsl(${game.elapsed * 140 % 360}, 85%, 70%)`);
  }
  const pausedColor = button.style.properties['--sunglasses-color'];
  game.pause(); game.update(20); context.syncUI();
  assert.equal(button.style.properties['--sunglasses-color'], pausedColor);
  game.resume();
  game.update(8); context.syncUI();
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  assert.equal(button.dataset.deactivated, 'true');
  assert.equal(button.dataset.toggleDisabled, 'true');
  assert.equal(button.style.properties['--cooldown-fill'], '0%');
  assert.equal(button.dataset.sunglassesGlow, 'false');
  assert.equal(cinderButton.dataset.sunglassesGlow, 'false');
  assert.equal(goalButton.dataset.sunglassesGlow, 'false');
  assert.equal(knob.getAttribute('cx'), 26);
  assert.equal(count.textContent, '2');
});
