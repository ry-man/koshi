const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, ITEMS, LEVELS, COOLDOWNS, validateCustomLevel, brickRegions } = require('../src/game.js');
const { spawnSymbol, spawnColor, drawPaintbrush, drawPaintSplash } = require('../src/brick-visuals.js');
const { GUIDE } = require('../src/learning.js');
const paints = Object.entries(ITEMS).filter(([, item]) => item.paintUses);
const level = events => ({ version: 1, id: 'Paint tests', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events });
function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: level([]) });
  game.start();
  return game;
}
function middle(game, edge) {
  const regions = brickRegions(game.bricks, game.width, game.height);
  return game.bricks.filter(brick => regions.get(brick.id).edge === edge)
    .sort((a, b) => Math.hypot(a.x + a.w / 2 - game.width / 2, a.y + a.h / 2 - game.height / 2)
      - Math.hypot(b.x + b.w / 2 - game.width / 2, b.y + b.h / 2 - game.height / 2))[0];
}
function land(game, brick) {
  brick.readyAt = 0;
  assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
  for (let i = 0; i < 400 && (game.cat.vx || game.cat.vy); i++) game.update(.01);
  assert.equal(game.cat.vx, 0); assert.equal(game.cat.vy, 0);
}

test('all nine brushes support editor placements, spawners, lifetimes, guide pictures and distinct shapes', () => {
  assert.equal(paints.length, 9);
  const symbols = new Set();
  for (const [type, item] of paints) {
    const custom = { ...level([{ time: 0, kind: 'item', type, x: .5, y: .5, lifetime: 2 }]),
      brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'item', type, lifetime: 3 } }] };
    assert.deepEqual(validateCustomLevel(custom), custom);
    const game = new Game(() => .5, { customLevel: custom });
    game.start(); game.update(.01);
    assert.deepEqual(game.paintBrush, { type, uses: item.paintUses });
    assert.equal(game.pickups.filter(pickup => pickup.type === type).length, 1);
    game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
    assert.equal(game.items[0].type, type);
    assert.equal(game.items[0].expires, game.elapsed + 3);
    const symbol = spawnSymbol({ kind: 'item', type });
    assert.ok(symbol); symbols.add(symbol);
    assert.equal(spawnColor({ kind: 'item', type }), item.color);
    assert.ok(GUIDE.flatMap(chapter => chapter.sections).some(([, , picture]) => [picture].flat().includes(`item:${type}`)));
    assert.equal(item.paintKind, { red: 'fast', green: 'normal', blue: 'slow' }[type.split('-').at(-1)]);
    assert.equal(item.paintUses, { pencil: 1, wide: 3, roller: 5 }[item.brush]);
  }
  assert.equal(symbols.size, 3);
  for (const campaign of LEVELS.filter(level => ['1', '2'].includes(level.worldId))) {
    assert.ok(!(campaign.items ?? []).some(([, type]) => ITEMS[type]?.paintUses));
    assert.ok(!(campaign.events ?? []).some(event => ITEMS[event.type]?.paintUses));
    assert.ok(!campaign.brickTypes.some(brick => ITEMS[brick.spawner?.type]?.paintUses));
  }
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  test(`each brush paints exactly its advertised contacts and changes real cooldowns (${options.portrait ? 'portrait' : 'landscape'})`, () => {
    for (const [type, item] of paints) {
      const game = arena(options);
      game.collectItem({ type });
      const targets = ['top', 'bottom', 'top', 'bottom', 'top', 'bottom'].map(edge => middle(game, edge));
      for (let i = 0; i < item.paintUses; i++) {
        const brick = targets[i];
        brick.kind = item.paintKind === 'slow' ? 'fast' : 'slow';
        land(game, brick);
        assert.equal(brick.kind, item.paintKind);
        assert.equal(brick.readyAt, 0, 'painted brick is ready');
        assert.equal(game.paintBrush?.uses ?? 0, item.paintUses - i - 1);
        game.update(.1);
        assert.equal(game.paintBrush?.uses ?? 0, item.paintUses - i - 1, 'rest does not spend more uses');
        Object.assign(game.cat, { x: game.width / 2, y: game.height / 2 });
        assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
        assert.ok(Math.abs(brick.readyAt - game.elapsed - COOLDOWNS[item.paintKind]) < 1e-8);
        game.cat.vx = 0; game.cat.vy = 0;
      }
      const next = targets[item.paintUses];
      next.kind = 'normal';
      land(game, next);
      assert.equal(next.kind, 'normal', 'depleted brush no longer paints');
      game.reset();
      assert.equal(game.paintBrush, null); assert.equal(game.paintTouching.size, 0);
    }
  });

  test(`random brushes use exact Ditto clearance including reserved spawns and merged parts (${options.portrait ? 'portrait' : 'landscape'})`, () => {
    const game = arena(options);
    game.bricks[0].warped = 10; game.absorbNeighbor(game.bricks[0]);
    game.random = () => 0;
    for (const [type] of paints) {
      const brush = game.createCollectible(2, type, 5);
      assert.ok(game.stampSpawnClear(brush));
      for (const part of game.brickParts()) {
        const distance = Math.hypot(brush.x - Math.max(part.x, Math.min(part.x + part.w, brush.x)),
          brush.y - Math.max(part.y, Math.min(part.y + part.h, brush.y)));
        assert.ok(distance >= 27 + game.cat.radius * 4);
      }
      const event = [2, type, 5];
      const reserved = { ...game.pointFromRelative(0, 0), type, expires: 7 };
      game.pendingSpawns.set(event, { kind: 'item', time: 2, items: [reserved] });
      assert.equal(game.takeSpawn(event, () => assert.fail('reserved spawn must be reused'))[0], reserved);
      assert.ok(game.stampSpawnClear(reserved)); assert.equal(reserved.expires, 7);
      const spawner = game.bricks.find(brick => brick.absorbedBy === null);
      spawner.spawner = { kind: 'item', type, lifetime: 3 };
      game.spawnFromBrick(spawner);
      assert.ok(game.stampSpawnClear(game.items.at(-1)));
      const explicit = game.createCustomSpawn({ time: 0, kind: 'item', type, x: 0, y: 0 })[0];
      assert.deepEqual({ x: explicit.x, y: explicit.y }, game.campaignEventPoint(0, 0));
    }
  });
}

test('matching-color contacts never activate any brush, refresh cooldowns or spend uses', () => {
  for (const [type, item] of paints) {
    const game = arena(), brick = middle(game, 'top');
    brick.kind = item.paintKind;
    brick.readyAt = 20;
    const before = { ...brick }, revision = game.brickRevision;
    game.collectItem({ type });
    game.paintBricks([brick], false);
    assert.equal(game.paintEffects.length, 0);
    assert.deepEqual(brick, before);
    assert.equal(game.brickRevision, revision);
    assert.deepEqual(game.paintBrush, { type, uses: item.paintUses });
    game.paintTouching.clear();
    brick.readyAt = 0;
    land(game, brick);
    assert.deepEqual(game.paintBrush, { type, uses: item.paintUses });
    const other = middle(game, 'bottom');
    other.kind = item.paintKind === 'slow' ? 'fast' : 'slow';
    land(game, other);
    assert.equal(other.kind, item.paintKind);
    assert.equal(game.paintBrush?.uses ?? 0, item.paintUses - 1);
  }
});

test('all brushes emit matching splashes only on recoloring, including the final use', () => {
  for (const [type, item] of paints) for (const options of [{}, { portrait: true, scale: .3 }]) {
    const game = arena(options), brick = middle(game, 'top');
    brick.kind = item.paintKind === 'slow' ? 'fast' : 'slow';
    game.collectItem({ type });
    game.paintBrush.uses = 1;
    game.paintBricks([brick, brick], false);
    assert.equal(game.paintBrush, null);
    assert.equal(game.paintEffects.length, 1, 'a contact seam produces one splash and one swing');
    const effect = game.paintEffects[0];
    assert.equal(effect.type, type);
    assert.equal(effect.age, 0);
    assert.ok(effect.members.length);
    assert.ok(effect.members.every(part => part.id === brick.id));
    assert.ok(effect.members.some(part => effect.x >= part.x && effect.x <= part.x + part.w
      && effect.y >= part.y && effect.y <= part.y + part.h), 'splash is anchored on the painted brick');
    game.pause(); game.update(.1);
    assert.equal(effect.age, 0, 'pause freezes the animation');
    game.resume(); game.update(.1);
    assert.ok(effect.age > .09);
    game.state = 'won'; game.update(.7);
    assert.equal(game.paintEffects.length, 1, 'the splash remains visible well beyond the old half-second duration');
    game.update(.7);
    assert.equal(game.paintEffects.length, 0, 'animations expire even after winning');
    game.reset();
    assert.equal(game.paintEffects.length, 0);
  }
});

test('paint splashes use matching paint, large outward droplets and a slower fade', () => {
  for (const [type, item] of paints) {
    const fills = [], clips = [], ellipses = [];
    const stack = [];
    const context = {
      globalAlpha: 1,
      save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle }); },
      restore() { Object.assign(this, stack.pop()); },
      beginPath() {}, arc() {}, stroke() {}, translate() {}, rotate() {}, moveTo() {}, lineTo() {}, closePath() {},
      rect(...args) { clips.push(args); }, clip() {},
      ellipse(...args) { ellipses.push(args); },
      fill() { fills.push({ color: this.fillStyle, alpha: this.globalAlpha }); },
    };
    const members = [{ x: 10, y: 20, w: 40, h: 30 }, { x: 50, y: 20, w: 20, h: 30 }];
    const effect = { type, x: 30, y: 40, nx: 0, ny: 1, duration: 1.4, members };
    drawPaintSplash(context, { ...effect, age: .1 });
    assert.deepEqual(clips, [[10, 20, 40, 30], [50, 20, 20, 30]]);
    assert.ok(fills.some(fill => fill.color === item.color && fill.alpha === 1));
    assert.ok(fills.some(fill => fill.color === '#fff8e6'), 'droplets have contrasting highlights');
    const firstX = ellipses[0][0];
    fills.length = 0; ellipses.length = 0; context.globalAlpha = 1;
    drawPaintSplash(context, { ...effect, age: .8 });
    assert.ok(ellipses[0][0] > firstX, 'droplets expand outward');
    assert.ok(ellipses.some(([x, y]) => Math.hypot(x, y) > 100), 'spray extends over 100 board units');
    assert.ok(fills.every(fill => fill.alpha > .9), 'paint stays bold for more than half a second');
    assert.ok(ellipses.every(([x, y, rx, ry]) => x > 0 && rx >= 7 && ry >= 4), 'large droplets spray outward from the contact face');
    fills.length = 0;
    drawPaintSplash(context, { ...effect, age: 1.25 });
    assert.ok(fills.every(fill => fill.alpha < .5));
    assert.equal(stack.length, 0);
  }
});

test('paint splash origins and normals match the actual contacted face in both orientations', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const game = arena(options), brick = middle(game, edge);
      brick.kind = 'normal';
      game.collectItem({ type: 'paint-pencil-red' });
      land(game, brick);
      const effect = game.paintEffects[0];
      assert.ok(effect, `${edge} landing must splash`);
      const normal = { top: [0, 1], bottom: [0, -1], left: [1, 0], right: [-1, 0] }[edge];
      assert.ok(Math.abs(effect.nx - normal[0]) < 1e-8);
      assert.ok(Math.abs(effect.ny - normal[1]) < 1e-8);
      assert.ok(effect.members.some(part => effect.x >= part.x && effect.x <= part.x + part.w
        && effect.y >= part.y && effect.y <= part.y + part.h));
      assert.ok(Math.abs(Math.hypot(game.cat.x - effect.x, game.cat.y - effect.y) - game.cat.radius) < .1);
      assert.equal(effect.duration, 1.4);
    }
  }
});

test('held brushes rotate on use and finish the swing after the last use', () => {
  const app = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const render = app.slice(app.indexOf('  const paintSwing ='), app.indexOf('  if (game.batteries > 0)'));
  for (const [type] of paints) for (const depleted of [false, true]) {
    const rotations = [], drawn = [];
    const ctx = new Proxy({}, { get: (_, key) => (...args) => {
      if (key === 'rotate') rotations.push(args[0]);
    } });
    const game = { paintBrush: depleted ? null : { type, uses: 2 },
      paintEffects: [{ type, age: .09 }], cat: { x: 100, y: 100 }, elapsed: 1 };
    vm.runInNewContext(render, { game, ctx, ITEMS, drawPaintbrush: (ctx, item) => drawn.push(item) });
    assert.equal(drawn[0], ITEMS[type]);
    assert.ok(Math.abs(rotations[0] - (-.3 - Math.PI / 4)) < 1e-9);
    game.paintEffects[0].age = .2;
    drawn.length = 0;
    vm.runInNewContext(render, { game, ctx, ITEMS, drawPaintbrush: (ctx, item) => drawn.push(item) });
    assert.equal(drawn.length, depleted ? 0 : 1);
  }
});

test('painting preserves merged geometry, modifiers and spent state, while counting seams only once', () => {
  const game = arena(), owner = game.bricks[0];
  owner.warped = 10; game.absorbNeighbor(owner);
  Object.assign(owner, { usesLeft: 0, toggle: 3, toggleRemaining: 2, spawned: true,
    slimed: true, slimeColor: 'blue', springs: true, spikes: true, boost: true,
    spawner: { kind: 'item', type: 'battery' }, barrier: true, portal: 'red' });
  const before = game.bricks.map(brick => ({ ...brick }));
  const contacts = game.brickParts().filter(part => part.id === owner.id);
  assert.ok(contacts.length > 1);
  game.collectItem({ type: 'paint-roller-red' });
  game.paintBricks(contacts, false);
  assert.equal(game.paintBrush.uses, 4);
  for (const brick of game.bricks) {
    const expected = before[brick.id];
    if (brick.id === owner.id || brick.absorbedBy === owner.id) {
      expected.kind = 'fast'; expected.readyAt = 0;
    }
    assert.deepEqual(brick, expected);
  }
  game.paintBricks(contacts, false);
  assert.equal(game.paintBrush.uses, 4, 'continuous contact is not a new touch');
});

test('brush replacement, immutable contacts, saw priority, pause and reset preserve uses correctly', () => {
  const game = arena(), [goal, cinder, target] = game.bricks;
  goal.kind = 'goal'; cinder.kind = 'cinder';
  game.collectItem({ type: 'paint-roller-red' });
  game.paintBricks([goal, cinder], false);
  assert.equal(game.paintBrush.uses, 5);
  game.collectItem({ type: 'paint-wide-blue' });
  assert.deepEqual(game.paintBrush, { type: 'paint-wide-blue', uses: 3 });
  game.paintBricks([target], true);
  assert.equal(game.paintBrush.uses, 3);
  game.pause(); game.update(10);
  assert.equal(game.paintBrush.uses, 3);
  game.resume();
  const landing = middle(game, 'bottom');
  game.collectItem({ type: 'saw-blade' }); land(game, landing);
  assert.equal(landing.kind, 'cinder'); assert.equal(game.paintBrush.uses, 3);
  game.reset(); assert.equal(game.paintBrush, null);
});

test('spring contacts paint before bouncing, and a brush picked up during flight paints that landing', () => {
  const game = arena(), brick = middle(game, 'top');
  brick.springs = true;
  assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
  game.update(.1); game.collectItem({ type: 'paint-wide-blue' });
  for (let i = 0; i < 200 && game.paintBrush.uses === 3; i++) game.update(.01);
  assert.equal(brick.kind, 'slow'); assert.equal(game.paintBrush.uses, 2);
  assert.ok(game.cat.vy > 0, 'spring still reflects flight');
});

test('Portal contacts paint only the entrance and preserve travel, while Ditto captures before painting', () => {
  const game = arena(), source = middle(game, 'top'), destination = middle(game, 'bottom');
  source.portal = 'red'; destination.portal = 'red';
  game.collectItem({ type: 'paint-wide-blue' });
  const prior = destination.kind;
  assert.equal(game.steer(source.id, source.x + source.w / 2, source.y + source.h / 2), true);
  for (let i = 0; i < 200 && game.paintBrush.uses === 3; i++) game.update(.01);
  assert.equal(source.kind, 'slow');
  assert.equal(destination.kind, prior);
  assert.equal(game.paintBrush.uses, 2);
  assert.ok(game.cat.y > game.height / 2, 'Portal still transports Koshi');
  const right = middle(game, 'right');
  right.kind = 'fast';
  game.collectItem({ type: 'ditto-stamp' });
  land(game, right);
  assert.equal(game.dittoSource.kind, 'fast', 'Ditto captured original properties');
  assert.equal(right.kind, 'slow'); assert.equal(game.paintBrush.uses, 1);
  const left = middle(game, 'left');
  left.slimed = true;
  land(game, left);
  assert.equal(game.dittoStamp, false);
  assert.ok(!left.slimed, 'Ditto still copied other properties');
  assert.equal(left.kind, 'slow', 'paint is applied after the Ditto copy');
  assert.equal(game.paintBrush, null);
});

test('paint art distinguishes a thin painted tip, dripping wide brush and soaked dripping roller', () => {
  const app = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  for (const [type, item] of paints) {
    const operations = [], stack = [];
    const ctx = new Proxy({ fillStyle: '', strokeStyle: '' }, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'save') return () => stack.push({ ...target });
        if (key === 'restore') return () => Object.assign(target, stack.pop());
        return (...args) => operations.push([key, ...args, target.fillStyle]);
      },
    });
    drawPaintbrush(ctx, item);
    assert.equal(stack.length, 0);
    assert.ok(operations.some(op => op[0] === 'fill' && op.at(-1) === item.color));
    const curves = operations.filter(op => op[0] === 'quadraticCurveTo');
    assert.equal(curves.length, item.brush === 'roller' ? 4 : 2);
    if (item.brush === 'wide') {
      const tips = operations.filter(op => op[0] === 'lineTo' && op.at(-1) === '#e1c894');
      assert.ok(tips.some(op => op[1] === -14 && op[2] === -25), 'left bristles are longest');
      assert.ok(tips.some(op => op[1] === 14 && op[2] === -15), 'right bristles are shorter');
      assert.ok(operations.some(op => op[0] === 'lineTo' && op[1] === 14 && op[2] === -10
        && op.at(-1) === item.color), 'paint follows the angled tips');
      assert.ok(curves.every(op => op[1] < -12 && op[3] <= -12 && op[4] < -8),
        'one small downward drip hangs from the longest bristles, clear of the handle');
      assert.equal(curves[0][4], -17);
      assert.ok(operations.some(op => op[0] === 'roundRect' && op[2] === -8
        && op.at(-1) === '#c4cdd5'), 'the ferrule next to the handle stays unpainted');
      assert.ok(spawnSymbol({ kind: 'item', type }).includes('V-25 L14 -15'));
      assert.ok(spawnSymbol({ kind: 'item', type }).includes('M-14 -25 Q-19 -21 -17 -17'));
    }
    if (item.brush === 'roller') assert.ok(operations.some(op => op[0] === 'roundRect' && op[3] === 36));
    const context = vm.createContext({ ctx, ITEMS, drawPaintbrush });
    vm.runInContext(app.slice(app.indexOf('function drawGameItem('), app.indexOf('function drawMusicStream(')), context);
    context.drawGameItem({ type, x: 10, y: 20 });
    assert.equal(stack.length, 0, 'pickup rendering uses the same shared brush art');
  }
});
