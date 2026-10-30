const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, COOLDOWNS, FOODS, SCHEDULE, SPEED, brickContact } = require('../src/game.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('direct-file startup uses ordered classic scripts and exposes the browser engine', () => {
  const root = path.resolve(__dirname, '..');
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)><\/script>/g)];
  assert.equal(scripts.length, 5);
  for (const [, attributes] of scripts) {
    assert.match(attributes, /\bdefer\b/);
    assert.doesNotMatch(attributes, /\btype\s*=\s*["']module["']/);
  }
  assert.match(scripts[0][1], /src="\.\/src\/game\.js"/);
  assert.match(scripts[1][1], /src="\.\/src\/cutscene\.js"/);
  assert.match(scripts[2][1], /src="\.\/src\/learning\.js"/);
  assert.match(scripts[3][1], /src="\.\/src\/app\.js"/);
  assert.match(scripts[4][1], /src="\.\/src\/pwa\.js"/);
  const context = vm.createContext({});
  vm.runInContext(readFileSync(path.join(root, 'src', 'game.js'), 'utf8'), context);
  vm.runInContext(readFileSync(path.join(root, 'src', 'learning.js'), 'utf8'), context);
  const tutorial = new context.KoshiLearning.Tutorial();
  assert.equal(tutorial.select(0).state, 'playing');
  const game = new context.KoshiGame.Game();
  game.start();
  game.update(1);
  assert.equal(game.state, 'playing');
  assert.ok(game.elapsed > .99);
});

function playing() { const game = new Game(() => .5); game.start(); return game; }
function aim(game, brick) { return game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2); }

test('title screen provides accessible artwork and explicit game entry without external assets', () => {
  const root = path.resolve(__dirname, '..');
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  const artwork = readFileSync(path.join(root, 'icons', 'title-scene.svg'), 'utf8');
  assert.match(html, /<dialog id="title-screen"[^>]+aria-labelledby="title-heading"[^>]+aria-describedby="title-tagline"/);
  assert.match(html, /id="title-start"[^>]+autofocus/);
  assert.match(html, /id="title-levels"/);
  assert.match(html, /src="\.\/icons\/title-scene\.svg"[^>]+alt="[^"]+Koshi[^"]+Robo Mouse[^"]+Robo Wheel/);
  assert.match(artwork, /<title>.+<\/title>/);
  assert.match(artwork, /<desc>.+<\/desc>/);
  for (const color of ['#83bca1', '#7eacdb', '#df8c81']) assert.ok(artwork.includes(color));
  assert.doesNotMatch(artwork, /<(?:script|image)\b|\bhref=/);
  assert.ok(readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'./icons/title-scene.svg'"));
});

test('level begins with three hearts, no enemies, and correct boundary brick mix', () => {
  const game = new Game();
  assert.equal(game.state, 'ready');
  assert.equal(game.hearts, 3);
  assert.equal(game.enemies, 0);
  assert.equal(game.bricks.length, 26);
  assert.equal(game.bricks.filter(b => b.kind === 'slow').length, 1);
  assert.equal(game.bricks.filter(b => b.kind === 'fast').length, 1);
  assert.equal(game.steer(0, 25, 25), false);
  game.update(5);
  assert.equal(game.elapsed, 0);
});

test('steering targets exact click, redirects in flight, and enforces each cooldown', () => {
  for (const kind of Object.keys(COOLDOWNS)) {
    const game = playing();
    const brick = game.bricks.find(b => b.kind === kind);
    const x = brick.x + 3, y = brick.y + 7;
    assert.equal(game.steer(brick.id, x, y), true);
    assert.deepEqual(game.target, { x, y });
    assert.ok(Math.abs(Math.hypot(game.cat.vx, game.cat.vy) - SPEED) < 1e-8);
    assert.equal(brick.readyAt, COOLDOWNS[kind]);
    assert.equal(aim(game, brick), false);
    assert.equal(aim(game, game.bricks.find(b => b.id !== brick.id)), true);
    game.update(COOLDOWNS[kind] + .01);
    game.cat.x = game.width / 2;
    game.cat.y = game.height / 2;
    assert.equal(aim(game, brick), true);
  }
});

test('Koshi stops at first brick and can leave it on his next launch', () => {
  const game = playing();
  aim(game, game.bricks[10]);
  game.update(3);
  assert.equal(game.cat.vx, 0);
  assert.equal(game.cat.vy, 0);
  assert.equal(game.target, null);
  assert.ok(game.cat.y >= 42 + game.cat.radius - 1e-8);
  const oldY = game.cat.y;
  assert.equal(aim(game, game.bricks[11]), true);
  game.update(.1);
  assert.ok(game.cat.y > oldY);
});

test('collision sweep catches walls, rounded corners, and ignores travel away', () => {
  const brick = { x: 100, y: 100, w: 50, h: 20 };
  assert.equal(brickContact(0, 110, 200, 0, 10, brick), .45);
  assert.equal(brickContact(90, 110, -20, 0, 10, brick), Infinity);
  const corner = brickContact(50, 50, 100, 100, 10, brick);
  assert.ok(Math.abs(corner - (50 - 10 / Math.sqrt(2)) / 100) < 1e-8);
  assert.equal(brickContact(50, 50, 0, 0, 10, brick), Infinity);
});

test('the full schedule spawns at prescribed times with exact types and expiry', () => {
  const game = playing();
  const events = [];
  const spawn = game.spawn.bind(game);
  game.spawn = event => {
    const before = game.food.length;
    spawn(event);
    const added = game.food.slice(before);
    events.push(event);
    assert.equal(added.length, event[1] === 'S' ? 1 : Number(event[1].slice(1)));
    for (const food of added) {
      assert.equal(food.type, event[2]);
      assert.equal(food.expires, event[0] + event[3]);
    }
  };
  game.cat.x = 80; game.cat.y = 80;
  game.update(60);
  assert.deepEqual(events, SCHEDULE);
  assert.equal(game.state, 'lost');
  assert.equal(game.elapsed, 60);
  assert.equal(game.food.length, 0);
});

test('food patterns are accessible, lines straight, and circles equally spaced', () => {
  for (const random of [() => 0, () => .99999, Math.random]) {
    for (let attempt = 0; attempt < 30; attempt++) {
      for (const event of SCHEDULE) {
        const game = new Game(random);
        game.spawn(event);
        for (const food of game.food) {
          assert.ok(food.x >= 60 && food.x <= 900 && food.y >= 60 && food.y <= 540);
          for (const brick of game.bricks) {
            const nearestX = Math.max(brick.x, Math.min(brick.x + brick.w, food.x));
            const nearestY = Math.max(brick.y, Math.min(brick.y + brick.h, food.y));
            assert.ok(Math.hypot(food.x - nearestX, food.y - nearestY) > 33);
          }
        }
        if (event[1] === 'L3') {
          const [a, b, c] = game.food;
          assert.ok(Math.abs(a.x + c.x - 2 * b.x) < 1e-8);
          assert.ok(Math.abs(a.y + c.y - 2 * b.y) < 1e-8);
          assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 55) < 1e-8);
        }
        if (event[1].startsWith('C')) {
          const count = game.food.length;
          const cx = game.food.reduce((sum, f) => sum + f.x, 0) / count;
          const cy = game.food.reduce((sum, f) => sum + f.y, 0) / count;
          for (let i = 0; i < count; i++) {
            const a = game.food[i], b = game.food[(i + 1) % count];
            assert.ok(Math.abs(Math.hypot(a.x - cx, a.y - cy) - 88) < 1e-8);
            assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 176 * Math.sin(Math.PI / count)) < 1e-8);
          }
        }
      }
    }
  }
});

test('all seven foods award their documented values, including swept pickups', () => {
  assert.deepEqual(Object.values(FOODS).map(f => f.value), [1, 2, 3, 4, 5, 6, 7]);
  for (const [type, info] of Object.entries(FOODS)) {
    const game = playing();
    game.food = [{ x: 510, y: 300, type, expires: 5 }];
    game.cat.vx = SPEED;
    game.update(.2);
    assert.equal(game.score, info.value);
    assert.equal(game.food.length, 0);
  }
});

test('expired food cannot be collected and food expiry freezes while paused', () => {
  const game = playing();
  game.food = [{ x: 480, y: 300, type: 'H', expires: .001 }];
  game.update(.01);
  assert.equal(game.score, 0);
  game.pause();
  const elapsed = game.elapsed;
  game.update(60);
  assert.equal(game.elapsed, elapsed);
  game.resume();
  game.update(1);
  assert.ok(game.elapsed > elapsed);
});

test('victory, timer loss, edge death, heart death, and reset are persistent states', () => {
  const game = playing();
  game.score = 19;
  game.food = [{ x: 480, y: 300, type: 'S', expires: 5 }];
  game.update(.01);
  assert.equal(game.state, 'won');
  const elapsed = game.elapsed;
  game.update(10);
  assert.equal(game.elapsed, elapsed);
  game.reset(); game.start();
  game.cat.x = 21; game.cat.vx = -SPEED;
  game.update(.01);
  assert.equal(game.state, 'lost');
  game.reset(); game.start(); game.hearts = 0; game.update(.01);
  assert.equal(game.state, 'lost');
  game.reset();
  assert.equal(game.state, 'ready');
  assert.equal(game.score, 0);
  assert.equal(game.hearts, 3);
  assert.ok(game.bricks.every(b => b.readyAt === 0));
});

test('invalid input does not consume cooldowns or corrupt the simulation', () => {
  const game = playing();
  for (const [id, x, y] of [[999, 0, 0], [0, NaN, 20], [0, 480, 300]]) {
    assert.equal(game.steer(id, x, y), false);
  }
  game.update(NaN); game.update(-1); game.update(Infinity);
  assert.equal(game.elapsed, 0);
  assert.equal(game.bricks[0].readyAt, 0);
});

test('portrait boards preserve brick thickness, correct boundaries, and reachable food', () => {
  for (const scale of [.36, .46, .57, .64, 1]) {
    for (const random of [() => 0, () => .5, () => .99999]) {
      const game = new Game(random, { portrait: true, scale });
      assert.equal(game.width, 600);
      assert.equal(game.height, 960);
      assert.deepEqual([game.cat.x, game.cat.y], [300, 480]);
      assert.equal(game.bricks.filter(b => b.kind === 'slow').length, 1);
      assert.equal(game.bricks.filter(b => b.kind === 'fast').length, 1);
      for (const brick of game.bricks) {
        assert.ok(Math.max(brick.w, brick.h) * scale >= 44);
        assert.ok(Math.min(brick.w, brick.h) > 0);
        assert.ok(brick.x >= 0 && brick.y >= 0);
        assert.ok(brick.x + brick.w <= game.width && brick.y + brick.h <= game.height);
      }
      for (const event of SCHEDULE) {
        game.food = [];
        game.spawn(event);
        for (const food of game.food) {
          for (const brick of game.bricks) {
            const x = Math.max(brick.x, Math.min(brick.x + brick.w, food.x));
            const y = Math.max(brick.y, Math.min(brick.y + brick.h, food.y));
            assert.ok(Math.hypot(food.x - x, food.y - y) > 33);
          }
        }
        if (event[1].startsWith('C')) {
          const cx = game.food.reduce((sum, f) => sum + f.x, 0) / game.food.length;
          const cy = game.food.reduce((sum, f) => sum + f.y, 0) / game.food.length;
          for (const food of game.food) assert.ok(Math.abs(Math.hypot(food.x - cx, food.y - cy) - 88) < 1e-8);
        }
      }
      game.food = [];
      game.start();
      aim(game, game.bricks[0]);
      game.update(1.5);
      assert.equal(game.state, 'playing');
      assert.equal(game.cat.vy, 0);
      assert.ok(game.cat.y >= game.bricks[0].y + game.bricks[0].h + game.cat.radius - 1e-8);
      const opposite = game.bricks.reduce((best, brick) =>
        brick.y > best.y || (brick.y === best.y && brick.x > best.x) ? brick : best);
      aim(game, opposite);
      const oldY = game.cat.y;
      game.update(.1);
      assert.ok(game.cat.y > oldY);
      game.reset();
      assert.equal(game.width, 600);
      assert.deepEqual([game.cat.x, game.cat.y], [300, 480]);
      game.start();
      game.cat.x = 600;
      game.update(.01);
      assert.equal(game.state, 'lost');
    }
  }
});
