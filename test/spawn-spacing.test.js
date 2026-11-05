const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, SPAWN_SPACING } = require('../src/game.js');

const seeded = (seed = 7) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const blank = { version: 1, id: 'Spacing test', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [] };
const closest = points => {
  let gap = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) gap = Math.min(gap, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
  }
  return gap;
};

test('random pickups retry until they are spaced from food, items, weapons, hearts and queued spawns', () => {
  for (const portrait of [false, true]) {
    for (let seed = 1; seed <= 20; seed++) {
      const game = new Game(seeded(seed), { customLevel: blank, portrait });
      game.start();
      for (let i = 0; i < 4; i++) game.weapons.push(game.createCollectible(0, 'bronze'));
      for (let i = 0; i < 4; i++) game.items.push(game.createCollectible(0, 'kitty-cape'));
      for (let i = 0; i < 3; i++) game.healing.push(game.randomPickupPoint());
      game.food.push(...game.createFood([0, 'S', 'H', 10]));
      game.food.push(...game.createFood([0, 'R3', 'B', 10]));
      game.pendingSpawns.set({}, { kind: 'item', time: 1, items: [game.createCollectible(1, 'battery')] });
      game.food.push(...game.createFood([0, 'S', 'C', 10]));
      const queued = [...game.pendingSpawns.values()].flatMap(spawn => spawn.items);
      assert.ok(closest([...game.weapons, ...game.items, ...game.healing, ...game.food, ...queued]) >= SPAWN_SPACING,
        `seed ${seed}, portrait ${portrait}`);
    }
  }
});

test('patterned food keeps its shape but the whole pattern avoids other pickups', () => {
  const game = new Game(seeded(3), { customLevel: blank });
  game.start();
  game.items.push(game.createCollectible(0, 'stopwatch'), game.createCollectible(0, 'eggplant'));
  const line = game.createFood([0, 'L3', 'S', 10]);
  assert.ok(Math.abs(Math.hypot(line[0].x - line[1].x, line[0].y - line[1].y) - 55) < 1e-9);
  for (const piece of line) {
    for (const item of game.items) assert.ok(Math.hypot(piece.x - item.x, piece.y - item.y) >= SPAWN_SPACING);
  }
});

test('a crowded or constant random source falls back to the roomiest spot without hanging', () => {
  const game = new Game(() => .5, { customLevel: blank });
  game.start();
  game.items.push(game.createCollectible(0, 'stopwatch'));
  const point = game.createCollectible(0, 'eggplant');
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  assert.equal(game.createFood([0, 'R3', 'S', 10]).length, 3);
});

test('campaign random spawns stay spaced during play; designer-placed spawns keep their positions', () => {
  for (const index of [0, 12, 30, 40, LEVELS.length - 1]) {
    const game = new Game(seeded(index + 1), { level: index });
    const placed = new WeakSet(), create = game.createCustomSpawn.bind(game);
    game.createCustomSpawn = event => { const spawned = create(event); spawned.forEach(entry => placed.add(entry)); return spawned; };
    game.start();
    let worst = Infinity;
    for (let t = 0; t < 40 && game.state === 'playing'; t += 1 / 30) {
      const before = new Set([...game.food, ...game.items, ...game.weapons, ...game.healing]);
      game.update(1 / 30);
      const live = [...game.food, ...game.items, ...game.weapons, ...game.healing];
      for (const fresh of live.filter(entry => !before.has(entry) && !placed.has(entry))) {
        const others = live.filter(entry => entry !== fresh && before.has(entry));
        for (const other of others) worst = Math.min(worst, Math.hypot(fresh.x - other.x, fresh.y - other.y));
      }
    }
    assert.ok(worst >= SPAWN_SPACING - 1e-6 || worst === Infinity, `${LEVELS[index].number}: ${worst}`);
  }
});
