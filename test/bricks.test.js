const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, validateCustomLevel, brickEditRegions, brickContact, brickShape, brickRecharge, brickRegions } = require('../src/game.js');

const blank = () => ({ version: 1, id: 'Brick test', duration: 120, goal: 1000, heartCost: null, brickSet: 1, events: [] });
function setup(attributes, options = {}, random = () => .99) {
  const base = new Game(random, options);
  const region = brickEditRegions(base.bricks).get(0);
  const level = { ...blank(), brickTypes: [{ ...region, kind: 'fast', ...attributes }] };
  const game = new Game(random, { ...options, customLevel: level });
  game.start();
  return game;
}
const aim = (game, brick) => game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2);
function recenter(game) {
  game.cat.x = game.width / 2;
  game.cat.y = game.height / 2;
}

test('recharge follows every contiguous perimeter group, including corners, wraparound and the full ring', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = setup({ warped: 100 }, options);
    const regions = brickRegions(game.bricks, game.width, game.height);
    const directions = { top: 'right', right: 'bottom', bottom: 'left', left: 'top' };
    for (let first = 0; first < game.perimeter.length; first++) {
      for (let count = 1; count <= game.perimeter.length; count++) {
        for (const brick of game.bricks) brick.absorbedBy = null;
        const ids = Array.from({ length: count }, (_, i) => game.perimeter[(first + i) % game.perimeter.length]);
        const owner = ids[0];
        for (const id of ids.slice(1)) game.bricks[id].absorbedBy = owner;
        const parts = game.brickParts().filter(part => part.id === owner);
        const segments = brickRecharge(parts, game.bricks, game.perimeter, game.width, game.height);
        assert.equal(segments.length, parts.length);
        assert.equal(segments[0].start, 0);
        const sourceIds = segments.filter(segment => segment.part.sourceId !== undefined).map(segment => segment.part.sourceId);
        assert.deepEqual(sourceIds, count === game.perimeter.length ? game.perimeter : ids);
        let progress = 0;
        for (const segment of segments) {
          assert.ok(Math.abs(segment.start - progress) < 1e-8, 'no gap or overlap in refill timing');
          assert.ok(segment.scale >= 1 && Number.isFinite(segment.scale));
          if (segment.part.sourceId !== undefined) {
            assert.equal(segment.direction, directions[regions.get(segment.part.sourceId).edge]);
          } else {
            const vertical = segment.part.w > segment.part.h;
            // Connecting strips are thin in their travel direction.
            assert.ok((vertical ? ['top', 'bottom'] : ['left', 'right']).includes(segment.direction));
          }
          const midpoint = segment.start + 50 / segment.scale;
          assert.ok(Math.abs((midpoint - segment.start) * segment.scale - 50) < 1e-8);
          progress += 100 / segment.scale;
        }
        assert.ok(Math.abs(progress - 100) < 1e-8);
        assert.ok(segments.every(segment => (0 - segment.start) * segment.scale <= 0));
        assert.ok(segments.every(segment => (100 - segment.start) * segment.scale >= 100 - 1e-8));
      }
    }
  }
});

test('crumbly edges have deep chips with varied widths and depths', () => {
  const shape = brickShape([{ x: 0, y: 0, w: 110, h: 22 }], true);
  const top = [...shape.path.split('L1 0')[0].matchAll(/[ML]([\d.e+-]+) ([\d.e+-]+)/g)]
    .map(([, x, y]) => [Number(x) * 110, Number(y) * 22]);
  const depths = top.filter(([, y]) => y > 0).map(([, y]) => y);
  assert.ok(Math.max(...depths) > 5.5, 'chips should cut through at least a quarter of the brick thickness');
  assert.ok(Math.max(...depths) <= 22 * .3, 'opposing chips must leave a solid center');
  assert.ok(new Set(depths.map(y => y.toFixed(3))).size >= 5);
  const widths = top.slice(1).map(([x], i) => (x - top[i][0]).toFixed(3));
  assert.ok(new Set(widths).size >= 5);
});

test('crumbly outlines chip only exposed boundaries and preserve merged holes in both layouts', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = setup({ warped: 100, crumbler: 100 }, options);
    for (let count = 0; count <= 25; count++) {
      const parts = game.brickParts().filter(part => part.id === 0);
      const wear = count / 25;
      const smooth = brickShape(parts), chipped = brickShape(parts, true, wear);
      assert.deepEqual(chipped, brickShape(parts, true, wear));
      assert.deepEqual([chipped.x, chipped.y, chipped.w, chipped.h], [smooth.x, smooth.y, smooth.w, smooth.h]);
      assert.doesNotMatch(chipped.path + chipped.clipPath + chipped.cracks, /NaN|undefined|Infinity/);
      assert.equal((chipped.path.match(/M/g) || []).length, count === 25 ? 2 : 1);
      assert.ok(chipped.path.length > smooth.path.length);
      assert.match(chipped.clipPath, /^polygon\(evenodd, /);
      for (const [, x, y] of chipped.path.matchAll(/[ML]([\d.e+-]+) ([\d.e+-]+)/g)) {
        assert.ok(Number(x) >= -1e-8 && Number(x) <= 1 + 1e-8);
        assert.ok(Number(y) >= -1e-8 && Number(y) <= 1 + 1e-8);
      }
      const vertices = [...chipped.clipPath.matchAll(/([\d.e+-]+)% ([\d.e+-]+)%/g)].map(([, x, y]) => [Number(x), Number(y)]);
      let inside = false;
      const px = (game.width / 2 - chipped.x) / chipped.w * 100;
      const py = (game.height / 2 - chipped.y) / chipped.h * 100;
      for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const [ax, ay] = vertices[i], [bx, by] = vertices[j];
        if ((ay > py) !== (by > py) && px < (bx - ax) * (py - ay) / (by - ay) + ax) inside = !inside;
      }
      assert.equal(inside, false, 'the gameplay area stays outside the clipped brick');
      game.bricks[0].readyAt = 0;
      aim(game, game.bricks[0]);
    }
  }
});

test('each successful Crumbler activation erodes its outline and grows cracks until exhaustion, then resets', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    for (const uses of [1, 5]) {
      const game = setup({ crumbler: uses }, options);
      const brick = game.bricks[0];
      const appearance = () => brickShape(game.brickParts().filter(part => part.id === brick.id),
        true, 1 - brick.usesLeft / brick.crumbler);
      const area = shape => {
        const points = [...shape.path.matchAll(/[ML]([\d.e+-]+) ([\d.e+-]+)/g)].map(([, x, y]) => [Number(x), Number(y)]);
        return Math.abs(points.reduce((sum, [x, y], i) => {
          const [nx, ny] = points[(i + 1) % points.length];
          return sum + x * ny - nx * y;
        }, 0)) / 2;
      };
      const crackLength = shape => [...shape.cracks.matchAll(/M([^M]+)/g)].reduce((total, [, segment]) => {
        const points = segment.split('L').map(point => point.split(' ').map(Number));
        return total + points.slice(1).reduce((sum, [x, y], i) =>
          sum + Math.hypot(x - points[i][0], y - points[i][1]), 0);
      }, 0);
      const initial = appearance();
      assert.equal(initial.cracks, '');
      let previous = initial;
      for (let i = 1; i <= uses; i++) {
        recenter(game);
        brick.readyAt = 0;
        assert.equal(aim(game, brick), true);
        const current = appearance();
        assert.notEqual(current.clipPath, previous.clipPath);
        assert.ok(area(current) < area(previous), 'every activation removes more of the visible outline');
        assert.notEqual(current.cracks, previous.cracks);
        assert.ok(crackLength(current) > crackLength(previous), 'cracks lengthen at every activation');
        for (const [, x, y] of current.cracks.matchAll(/[ML]([\d.e+-]+) ([\d.e+-]+)/g)) {
          assert.ok(Number(x) >= 0 && Number(x) <= 1);
          assert.ok(Number(y) >= 0 && Number(y) <= 1);
        }
        assert.equal(aim(game, brick), false);
        assert.deepEqual(appearance(), current, 'rejected selections do not add wear');
        previous = current;
      }
      assert.equal(brick.usesLeft, 0);
      assert.ok(area(previous) < area(initial) * .85, 'exhaustion causes prominent erosion');
      game.reset();
      const restored = game.bricks[0];
      assert.equal(restored.usesLeft, uses);
      assert.deepEqual(brickShape(game.brickParts().filter(part => part.id === restored.id),
        true, 1 - restored.usesLeft / restored.crumbler), initial);
    }
  }
});

test('blocked selections preserve cooldowns, Crumbler uses, warp geometry, and current motion', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = setup({ crumbler: 3, warped: 15 }, options);
    const brick = game.bricks[0];
    assert.equal(aim(game, brick), true);
    game.update(3);
    assert.equal(game.cat.vx, 0);
    assert.equal(game.cat.vy, 0);
    const snapshot = JSON.stringify({ bricks: game.bricks, revision: game.brickRevision, cat: game.cat, target: game.target });
    assert.equal(aim(game, brick), false);
    assert.equal(JSON.stringify({ bricks: game.bricks, revision: game.brickRevision, cat: game.cat, target: game.target }), snapshot);
    // A different brick on the same wall is also blocked by the current wall.
    const neighbor = game.bricks[2];
    const owner = game.bricks[neighbor.absorbedBy ?? neighbor.id];
    assert.equal(aim(game, owner), false);
    assert.equal(JSON.stringify({ bricks: game.bricks, revision: game.brickRevision, cat: game.cat, target: game.target }), snapshot);
    assert.equal(aim(game, game.bricks[5]), true);
    const motion = { ...game.cat }, target = { ...game.target };
    assert.equal(aim(game, brick), false);
    assert.deepEqual(game.cat, motion);
    assert.deepEqual(game.target, target);
    game.update(.1);
    assert.ok(Math.hypot(game.cat.x - motion.x, game.cat.y - motion.y) > 0);
  }
});

test('rounded-corner contact rejects blocked launches without consuming an activation', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = setup({ crumbler: 2, warped: 15 }, options);
    const brick = game.bricks[0], offset = game.cat.radius / Math.sqrt(2);
    game.cat.x = options.portrait ? brick.x + brick.w + offset : brick.x - offset;
    game.cat.y = brick.y + brick.h + offset;
    assert.equal(aim(game, brick), false);
    assert.equal(brick.readyAt, 0);
    assert.equal(brick.usesLeft, 2);
    assert.equal(brick.warpUntil, null);
    assert.equal(game.brickRevision, 0);
  }
});

test('merged brick outlines cover only the solid union without internal seams', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = setup({ warped: 100 }, options);
    for (let count = 0; count <= 25; count++) {
      const parts = game.brickParts().filter(part => part.id === 0);
      const shape = brickShape(parts);
      assert.ok(shape.w > 0 && shape.h > 0);
      assert.doesNotMatch(shape.path, /NaN|undefined|Infinity/);
      assert.equal((shape.path.match(/M/g) || []).length, count === 25 ? 2 : 1);
      let area = 0;
      for (const loop of shape.path.split('Z').filter(Boolean)) {
        const points = [...loop.matchAll(/[ML]([\d.e+-]+) ([\d.e+-]+)/g)].map(match => [Number(match[1]), Number(match[2])]);
        for (let i = 0; i < points.length - 1; i++) area += (points[i][0] * points[i + 1][1] - points[i + 1][0] * points[i][1]) / 2;
      }
      const expected = parts.reduce((sum, part) => sum + part.w * part.h, 0);
      assert.ok(Math.abs(area * shape.w * shape.h - expected) < .01);
      game.bricks[0].readyAt = 0;
      aim(game, game.bricks[0]);
    }
  }
});

test('brick attributes validate, round-trip, compose, and map identically on phone', () => {
  const desktop = setup({ crumbler: 5, warped: 15 });
  const level = validateCustomLevel(JSON.parse(JSON.stringify(desktop.customLevel)));
  assert.equal(level.brickTypes[0].crumbler, 5);
  assert.equal(level.brickTypes[0].warped, 15);
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .65 }]) {
    const game = new Game(Math.random, { ...options, customLevel: level });
    assert.equal(game.bricks[0].crumbler, 5);
    assert.equal(game.bricks[0].usesLeft, 5);
    assert.equal(game.bricks[0].warped, 15);
    assert.ok(game.bricks.slice(1).every(brick => brick.usesLeft === null && !brick.warped));
  }
  const entry = level.brickTypes[0];
  for (const crumbler of [0, -1, 1.5, '5', Infinity, 100001, false]) {
    assert.throws(() => validateCustomLevel({ ...level, brickTypes: [{ ...entry, crumbler }] }), TypeError);
  }
  for (const warped of [0, -.1, '15', NaN, 3601, false]) {
    assert.throws(() => validateCustomLevel({ ...level, brickTypes: [{ ...entry, warped }] }), TypeError);
  }
  const reset = new Game(Math.random, { customLevel: {
    ...level, brickTypes: [entry, { ...entry, crumbler: null, warped: null }],
  } });
  assert.equal(reset.bricks[0].usesLeft, null);
  assert.equal(reset.bricks[0].warped, null);
});

test('Crumblers decrement only successful selections, stay solid at zero, and reset', () => {
  const game = setup({ crumbler: 2 });
  const brick = game.bricks[0];
  assert.equal(game.steer(0, -1, -1), false);
  assert.equal(brick.usesLeft, 2);
  assert.equal(aim(game, brick), true);
  assert.equal(brick.usesLeft, 1);
  assert.equal(aim(game, brick), false);
  game.pause();
  assert.equal(aim(game, brick), false);
  game.update(5);
  assert.equal(brick.usesLeft, 1);
  game.resume(); game.update(3);
  recenter(game);
  assert.equal(aim(game, brick), true);
  assert.equal(brick.usesLeft, 0);
  game.update(3);
  assert.equal(aim(game, brick), false);
  game.cat.x = game.width / 2;
  game.cat.y = brick.y + brick.h / 2;
  aim(game, game.bricks[2]);
  // Travel into the exhausted brick to verify it remains a wall.
  game.cat.vx = 420; game.cat.vy = 0;
  game.update(2);
  assert.equal(game.cat.vx, 0);
  assert.ok(Math.abs(game.cat.x - brick.x + game.cat.radius) < 1e-7);
  game.reset();
  assert.equal(game.bricks[0].usesLeft, 2);
  assert.equal(game.bricks[0].readyAt, 0);
});

test('Warped bricks choose either adjacent perimeter neighbor and fill only the connecting gap', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    for (const random of [() => 0, () => .99]) {
      const game = setup({ warped: 15 }, options, random);
      assert.equal(aim(game, game.bricks[0]), true);
      const absorbed = game.bricks.find(brick => brick.absorbedBy === 0);
      assert.ok([10, 2].includes(absorbed.id));
      assert.equal(aim(game, absorbed), false);
      const parts = game.brickParts();
      assert.equal(parts.length, 27);
      assert.equal(parts.filter(part => part.id === 0).length, 3);
      const bridge = parts.find(part => part.sourceId === undefined);
      assert.ok(bridge.w > 0 && bridge.h > 0);
      assert.equal(brickContact(bridge.x + bridge.w / 2, bridge.y + bridge.h + 30, 0, -50, 1, bridge), 29 / 50);
      game.update(3);
      assert.equal(aim(game, absorbed), false);
      recenter(game);
      assert.equal(game.steer(0, bridge.x + bridge.w / 2, bridge.y + bridge.h / 2), true);
      assert.equal(game.bricks.filter(brick => brick.absorbedBy === 0).length, 2);
      game.update(3);
      recenter(game);
      assert.equal(game.steer(0, absorbed.x + absorbed.w / 2, absorbed.y + absorbed.h / 2), true);
      assert.equal(game.bricks.filter(brick => brick.absorbedBy === 0).length, 3);
      assert.equal(game.bricks[0].warpUntil, 15);
      assert.equal(game.steer(0, game.width / 2, game.height / 2), false);
    }
  }
});

test('warps freeze while paused, expire exactly, and preserve absorbed attributes and cooldown state', () => {
  const game = setup({ warped: 15 });
  const neighbor = game.bricks[2];
  neighbor.kind = 'slow'; neighbor.crumbler = 5; neighbor.usesLeft = 4;
  neighbor.warped = 7; neighbor.readyAt = 20;
  const original = { ...neighbor };
  aim(game, game.bricks[0]);
  assert.equal(neighbor.absorbedBy, 0);
  game.update(5);
  game.pause(); game.update(100);
  assert.ok(Math.abs(game.elapsed - 5) < 1e-8);
  assert.equal(neighbor.absorbedBy, 0);
  game.resume(); game.update(9.99);
  assert.equal(neighbor.absorbedBy, 0);
  game.update(.01);
  assert.deepEqual(neighbor, original);
  assert.equal(game.bricks[0].warpUntil, null);
  assert.equal(game.brickParts().length, 26);
  game.reset();
  assert.ok(game.bricks.every(brick => brick.absorbedBy === null && brick.warpUntil === null));
});

test('exhausted Warped Crumblers permanently freeze their entire enlarged shape until restart', () => {
  for (const options of [{}, { portrait: true, scale: .5 }]) {
    for (const uses of [1, 3]) {
      const game = setup({ crumbler: uses, warped: 15 }, options);
      for (let i = 0; i < uses; i++) {
        recenter(game);
        assert.equal(aim(game, game.bricks[0]), true);
        game.update(3);
      }
      assert.equal(game.bricks[0].usesLeft, 0);
      assert.equal(game.bricks.filter(brick => brick.absorbedBy === 0).length, uses);
      const shape = game.brickParts();
      game.update(20);
      assert.deepEqual(game.brickParts(), shape);
      for (const brick of game.bricks.filter(b => b.id === 0 || b.absorbedBy === 0)) assert.equal(aim(game, brick), false);
      game.reset();
      assert.equal(game.bricks[0].usesLeft, uses);
      assert.ok(game.bricks.every(brick => brick.absorbedBy === null));
      game.start();
      assert.equal(aim(game, game.bricks[0]), true);
    }
  }
});

test('Warped bricks absorb active neighboring groups through either their owner or a member', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    for (const throughMember of [false, true]) {
      const game = setup({ warped: 15 }, options);
      const neighbor = game.bricks[4];
      neighbor.warped = 7; neighbor.crumbler = 5; neighbor.usesLeft = 5;
      neighbor.kind = 'slow';
      game.random = () => throughMember ? 0 : .99;
      assert.equal(aim(game, neighbor), true);
      const member = game.bricks.find(brick => brick.absorbedBy === neighbor.id);
      assert.equal(member.id, throughMember ? 2 : 6);
      assert.equal(neighbor.warpUntil, 7);
      const cooldown = neighbor.readyAt, uses = neighbor.usesLeft;
      game.random = () => .99;
      if (!throughMember) {
        assert.equal(aim(game, game.bricks[0]), true);
        game.bricks[0].readyAt = 0;
      }
      assert.equal(aim(game, game.bricks[0]), true);
      assert.equal(neighbor.absorbedBy, 0);
      assert.equal(member.absorbedBy, 0);
      assert.equal(neighbor.warpUntil, null);
      assert.equal(neighbor.readyAt, cooldown);
      assert.equal(neighbor.usesLeft, uses);
      assert.equal(game.bricks[0].warpUntil, 15);
      const parts = game.brickParts();
      game.update(7);
      assert.deepEqual(game.brickParts(), parts);
      game.update(8);
      assert.ok(game.bricks.every(brick => brick.absorbedBy === null && brick.warpUntil === null));
      assert.equal(neighbor.readyAt, cooldown);
      assert.equal(neighbor.usesLeft, uses);
    }
  }
});

test('Warped bricks absorb a neighbor even when both neighboring groups are active and cooling down', () => {
  for (const random of [() => 0, () => .99]) {
    const game = setup({ warped: 15 }, {}, random);
    for (const id of [10, 2]) {
      game.random = () => id === 10 ? 0 : .99;
      game.bricks[id].warped = 7;
      assert.equal(aim(game, game.bricks[id]), true);
    }
    game.random = random;
    assert.equal(aim(game, game.bricks[0]), true);
    assert.ok([10, 2].some(id => game.bricks[id].absorbedBy === 0));
    assert.equal(game.bricks.filter(brick => brick.absorbedBy === 0).length, 2);
  }
});

test('exhausted neighboring warp groups can be absorbed without replenishing their uses', () => {
  const game = setup({ warped: 15 });
  const neighbor = game.bricks[4];
  neighbor.warped = 7; neighbor.crumbler = 1; neighbor.usesLeft = 1;
  assert.equal(aim(game, neighbor), true);
  assert.equal(neighbor.usesLeft, 0);
  assert.equal(game.bricks[6].absorbedBy, 4);
  assert.equal(aim(game, game.bricks[0]), true);
  game.bricks[0].readyAt = 0;
  assert.equal(aim(game, game.bricks[0]), true);
  assert.equal(neighbor.absorbedBy, 0);
  assert.equal(game.bricks[6].absorbedBy, 0);
  game.update(15);
  assert.equal(neighbor.absorbedBy, null);
  assert.equal(neighbor.warpUntil, null);
  assert.equal(neighbor.usesLeft, 0);
  assert.equal(game.bricks[6].absorbedBy, null);
  assert.equal(aim(game, neighbor), false);
});

test('a fully absorbed perimeter remains stable on further successful launches', () => {
  const full = setup({ warped: 100 });
  for (let i = 0; i < 30; i++) {
    full.bricks[0].readyAt = 0;
    assert.equal(aim(full, full.bricks[0]), true);
  }
  assert.equal(full.bricks.filter(brick => brick.absorbedBy === 0).length, 25);
  assert.equal(full.brickParts().length, 52);
  assert.ok(full.brickParts().every(part => part.w > 0 && part.h > 0));
});
