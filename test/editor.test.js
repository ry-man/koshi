const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, validateCustomLevel, snapWheel, FOODS, SWORDS, brickRegions, brickEditRegions, COOLDOWNS } = require('../src/game.js');

const blank = () => ({ version: 1, id: 'Designer level', duration: 30, goal: 50, heartCost: null, brickSet: 3, events: [] });
const event = (kind = 'food', type = 'S', time = 2) => ({ kind, type, time, x: .2, y: .7, ...(kind === 'food' ? { lifetime: 5 } : {}) });

test('desktop rotates phone bricks clockwise with stable IDs, edit slots, attributes, and adjacency', () => {
  const desktop = new Game(Math.random, { customLevel: blank() });
  const expected = brickEditRegions(desktop.bricks);
  const desktopRegions = brickRegions(desktop.bricks, desktop.width, desktop.height);
  const counts = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const region of desktopRegions.values()) counts[region.edge]++;
  assert.deepEqual(counts, { top: 8, bottom: 8, left: 5, right: 5 });
  const rotatedEdges = { top: 'right', right: 'bottom', bottom: 'left', left: 'top' };
  for (const scale of [.31, .36, .46, .57, .64, 1]) {
    const phone = new Game(Math.random, { portrait: true, scale, customLevel: blank() });
    const phoneRegions = brickRegions(phone.bricks, phone.width, phone.height);
    const phoneCounts = { top: 0, bottom: 0, left: 0, right: 0 };
    for (const region of phoneRegions.values()) phoneCounts[region.edge]++;
    assert.deepEqual(phoneCounts, { top: 5, bottom: 5, left: 8, right: 8 });
    assert.equal(phone.bricks.length, 26);
    assert.deepEqual(brickEditRegions(phone.bricks), expected);
    assert.deepEqual(phone.bricks.map(b => b.kind), desktop.bricks.map(b => b.kind));
    for (const [id, region] of phoneRegions) {
      const actual = desktopRegions.get(id);
      assert.equal(actual.edge, rotatedEdges[region.edge]);
      const reversed = region.edge === 'right' || region.edge === 'left';
      assert.ok(Math.abs(actual.start - (reversed ? 1 - region.end : region.start)) < 1e-9);
      assert.ok(Math.abs(actual.end - (reversed ? 1 - region.start : region.end)) < 1e-9);
    }
    const next = game => new Map(game.perimeter.map((id, i) => [id, game.perimeter[(i + 1) % 26]]));
    assert.deepEqual(next(desktop), next(phone));
    for (const brick of desktop.bricks) {
      const level = { ...blank(), brickTypes: [{ ...expected.get(brick.id), kind: 'fast', crumbler: 5, warped: 15 }] };
      const editedDesktop = new Game(Math.random, { customLevel: level });
      const editedPhone = new Game(Math.random, { portrait: true, scale, customLevel: level });
      assert.deepEqual(editedPhone.bricks.map(b => b.kind), editedDesktop.bricks.map(b => b.kind));
      for (const game of [editedDesktop, editedPhone]) {
        assert.deepEqual(game.bricks.filter(b => b.crumbler === 5 && b.warped === 15).map(b => b.id), [brick.id]);
      }
    }
  }
  for (const brick of desktop.bricks) {
    assert.ok(brick.x >= 0 && brick.y >= 0 && brick.w > 0 && brick.h > 0);
    assert.ok(brick.x + brick.w <= desktop.width && brick.y + brick.h <= desktop.height);
  }
  assert.deepEqual(
    (({ x, y, w, h }) => ({ x, y, w, h }))(desktop.bricks[0]),
    { x: 918, y: 20, w: 22, h: (600 - 40 - 32) / 5 },
  );
});

test('individual brick overrides round-trip, affect only their brick, and set real cooldowns', () => {
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
    const base = new Game(Math.random, { ...options, customLevel: blank() });
    const regions = brickEditRegions(base.bricks);
    for (const target of base.bricks) {
      for (const kind of Object.keys(COOLDOWNS)) {
        const level = { ...blank(), brickTypes: [{ ...regions.get(target.id), kind }] };
        const validated = validateCustomLevel(JSON.parse(JSON.stringify(level)));
        assert.deepEqual(validated.brickTypes, level.brickTypes);
        const game = new Game(Math.random, { ...options, customLevel: validated });
        for (const brick of game.bricks) assert.equal(brick.kind, brick.id === target.id ? kind : base.bricks[brick.id].kind);
        game.start();
        const brick = game.bricks[target.id];
        assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
        assert.equal(brick.readyAt, COOLDOWNS[kind]);
        game.reset();
        assert.equal(game.bricks[target.id].kind, kind);
      }
    }
  }
});

test('brick overrides map across layouts, remain on their edge, and use the latest overlapping edit', () => {
  const level = { ...blank(), brickTypes: [
    { edge: 'top', start: 0, end: 1, kind: 'slow' },
    { edge: 'top', start: .1, end: .101, kind: 'fast' },
  ] };
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
    const base = new Game(Math.random, { ...options, customLevel: blank() });
    const game = new Game(Math.random, { ...options, customLevel: level });
    const regions = brickEditRegions(game.bricks);
    const top = game.bricks.filter(brick => regions.get(brick.id).edge === 'top');
    assert.ok(top.some(brick => brick.kind === 'fast'));
    assert.ok(top.every(brick => ['slow', 'fast'].includes(brick.kind)));
    for (const brick of game.bricks.filter(brick => regions.get(brick.id).edge !== 'top')) assert.equal(brick.kind, base.bricks[brick.id].kind);
  }
});

test('invalid brick overrides are rejected and older JSON without overrides is unchanged', () => {
  const valid = { edge: 'top', start: 0, end: .5, kind: 'fast' };
  for (const entry of [null, {}, { ...valid, edge: 'center' }, { ...valid, kind: 'toString' }, { ...valid, start: -.1 }, { ...valid, end: 2 }, { ...valid, end: NaN }, { ...valid, start: .5 }, { ...valid, start: '0' }]) {
    assert.throws(() => validateCustomLevel({ ...blank(), brickTypes: [entry] }), TypeError);
  }
  assert.throws(() => validateCustomLevel({ ...blank(), brickTypes: {} }), TypeError);
  assert.throws(() => validateCustomLevel({ ...blank(), brickTypes: Array(2001).fill(valid) }), TypeError);
  assert.deepEqual(validateCustomLevel(blank()), blank());
});

test('portable level schema round-trips JSON, normalizes input, and keeps source data independent', () => {
  const source = { ...blank(), id: '  Test level  ', events: [event()] };
  const result = validateCustomLevel(JSON.parse(JSON.stringify(source)));
  assert.equal(result.id, 'Test level');
  assert.equal(result.heartCost, null);
  assert.deepEqual(result.events, source.events);
  result.events[0].x = .9;
  assert.equal(source.events[0].x, .2);
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(result))), result);
  const fragment = encodeURIComponent(JSON.stringify(result));
  assert.deepEqual(validateCustomLevel(JSON.parse(decodeURIComponent(fragment))), result);
});

test('invalid settings and placements are rejected explicitly before mutating game state', () => {
  for (const patch of [
    { version: 2 }, { id: '' }, { id: 'x'.repeat(61) }, { duration: 0 }, { duration: Infinity },
    { goal: 0 }, { goal: 1.5 }, { heartCost: 0 }, { heartCost: -1 }, { heartCost: Infinity }, { brickSet: 2 },
    { events: null }, { events: Array.from({ length: 2001 }, () => event()) },
  ]) assert.throws(() => validateCustomLevel({ ...blank(), ...patch }), TypeError);
  for (const patch of [
    { time: -1 }, { time: 30 }, { time: NaN }, { x: -1 }, { x: 1.01 }, { y: undefined }, { x: '0.5' },
    { kind: 'unknown' }, { kind: '__proto__' }, { type: 'toString' }, { lifetime: 0 }, { lifetime: Infinity },
    { kind: 'enemy', type: 'wheel' }, { kind: 'weapon', type: 'banana' },
  ]) assert.throws(() => new Game(Math.random, { customLevel: { ...blank(), events: [{ ...event(), ...patch }] } }), TypeError);
  for (const value of [null, [], 'level']) assert.throws(() => validateCustomLevel(value), TypeError);
});

test('custom events are stable-sorted, spawn once at exact times, and work at time zero', () => {
  const level = { ...blank(), events: [event('food', 'P', 4), event('weapon', 'wood', 0), event('food', 'S', 2), event('weapon', 'silver', 2)] };
  const game = new Game(() => .5, { customLevel: level });
  assert.equal(game.weapons.length, 0);
  game.start();
  assert.equal(game.weapons[0].type, 'wood');
  assert.equal(game.nextCustom, 1);
  game.update(1.99);
  assert.equal(game.food.length, 0);
  game.update(.02);
  assert.deepEqual(game.food.map(f => f.type), ['S']);
  assert.deepEqual(game.weapons.map(w => w.type), ['wood', 'silver']);
  game.update(2);
  assert.deepEqual(game.food.map(f => f.type), ['S', 'P']);
  assert.equal(game.nextCustom, 4);
  game.pause(); game.update(10);
  assert.ok(game.elapsed < 4.1);
  game.resume(); game.update(4);
  assert.deepEqual(game.food.map(f => f.type), ['P']);
  assert.equal(game.weapons.length, 2);
  game.reset(); game.start();
  assert.equal(game.weapons.length, 1);
  assert.equal(game.nextCustom, 1);
  assert.equal(game.level.id, level.id);
  assert.equal(game.levelIndex, -1);
});

test('normalized placements project to the same relative safe-area positions in both orientations', () => {
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
    const level = { ...blank(), events: [event('food', 'F', 0), event('weapon', 'gold', 0), event('enemy', 'mouse', 0)] };
    const game = new Game(() => .5, { ...options, customLevel: level });
    game.start();
    const b = game.bounds();
    for (const item of [...game.food, ...game.weapons, ...game.robots]) {
      assert.ok(Math.abs((item.x - b.left) / (b.right - b.left) - .2) < 1e-8);
      assert.ok(Math.abs((item.y - b.top) / (b.bottom - b.top) - .7) < 1e-8);
      for (const brick of game.bricks) {
        const x = Math.max(brick.x, Math.min(brick.x + brick.w, item.x));
        const y = Math.max(brick.y, Math.min(brick.y + brick.h, item.y));
        assert.ok(Math.hypot(item.x - x, item.y - y) >= 25);
      }
    }
    assert.equal(game.bricks.filter(b => b.kind === 'slow').length, 3);
    assert.equal(game.bricks.filter(b => b.kind === 'fast').length, 3);
  }
});

test('wheel placements snap to an edge and begin at that exact perimeter position', () => {
  for (const options of [{}, { portrait: true, scale: .35 }]) {
    for (const [x, y] of [[.1, .5], [.9, .5], [.5, .1], [.5, .9], [0,0], [1,1]]) {
      const snapped = snapWheel(x, y);
      const level = { ...blank(), events: [{ ...event('enemy', 'wheel', 0), ...snapped }] };
      const game = new Game(() => .5, { ...options, customLevel: level });
      game.start();
      const point = game.pointFromRelative(snapped.x, snapped.y);
      assert.ok(Math.abs(game.robots[0].x - point.x) < 1e-8);
      assert.ok(Math.abs(game.robots[0].y - point.y) < 1e-8);
      game.update(.1);
      assert.notDeepEqual({ x: game.robots[0].x, y: game.robots[0].y }, point);
    }
  }
});

test('custom objectives, duration, heart costs, and every pickup type use the real engine', () => {
  for (const type of Object.keys(FOODS)) {
    const game = new Game(() => .1, { customLevel: { ...blank(), goal: FOODS[type].value, heartCost: 1, events: [{ ...event('food', type, 0), x: .5, y: .5 }] } });
    game.start(); game.update(.01);
    assert.equal(game.state, 'won');
    assert.equal(game.score, FOODS[type].value);
    assert.equal(game.healing.length, FOODS[type].value);
  }
  for (const type of Object.keys(SWORDS)) {
    const game = new Game(() => .1, { customLevel: { ...blank(), events: [{ ...event('weapon', type, 0), x: .5, y: .5 }] } });
    game.start(); game.update(.01);
    assert.equal(game.weapon.type, type);
  }
  const game = new Game(() => .5, { customLevel: { ...blank(), duration: 1.5 } });
  game.start(); game.update(2);
  assert.equal(game.elapsed, 1.5);
  assert.equal(game.state, 'lost');
  assert.equal(game.nextHeart, Infinity);
});
