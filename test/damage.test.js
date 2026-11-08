const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, ITEMS, brickSpikes, SPEED } = require('../src/game.js');

function arena(options = {}) {
  const game = new Game(() => .25, { ...options, customLevel: {
    version: 1, id: 'Damage feedback', duration: 30, goal: 1000, heartCost: null, brickSet: 1, events: [],
    brickTypes: [{ edge: 'top', start: 0, end: .2, kind: 'normal', spikes: true }],
  } });
  game.start();
  return game;
}

function mouse(game) {
  return { type: 'mouse', x: game.cat.x, y: game.cat.y, radius: 19, phase: 0, age: 4.5, touching: false };
}

test('damage feedback and invulnerability share an exact one-second deadline', () => {
  const game = arena();
  assert.equal(game.invulnerable, false);
  assert.equal(game.damageProgress, null);
  assert.equal(game.takeDamage(), true);
  assert.equal(game.hearts, 2);
  assert.equal(game.tookDamage, true);
  assert.equal(game.invulnerableUntil, 1);
  assert.equal(game.damageProgress, 0);
  game.update(.25);
  assert.ok(Math.abs(game.damageProgress - .25) < 1e-8);
  assert.equal(game.takeDamage(), false);
  assert.equal(game.invulnerableUntil, 1, 'blocked damage must not extend protection');
  game.pause();
  const progress = game.damageProgress;
  game.update(5);
  assert.equal(game.damageProgress, progress);
  assert.equal(game.takeDamage(), false);
  game.resume();
  game.update(.749999);
  assert.equal(game.invulnerable, true);
  assert.ok(game.damageProgress > .99999 && game.damageProgress < 1);
  assert.equal(game.takeDamage(), false);
  game.update(.000001);
  assert.ok(Math.abs(game.elapsed - 1) < 1e-8);
  assert.equal(game.invulnerable, false);
  assert.equal(game.damageProgress, null, 'animation ends on the damage eligibility boundary');
  assert.equal(game.takeDamage(), true);
  assert.equal(game.hearts, 1);
  assert.ok(Math.abs(game.invulnerableUntil - 2) < 1e-8);
  game.reset();
  assert.equal(game.invulnerableUntil, 0);
  assert.equal(game.tookDamage, false);
  assert.equal(game.invulnerable, false);
  assert.equal(game.damageProgress, null);
  assert.equal(game.takeDamage(), false, 'ready scenes cannot take damage');
});

test('Cat Shields absorb hits in descending color tiers and new pickups replace the current shield', () => {
  const game = arena();
  for (const [type, start, afterHit] of [
    ['cat-shield-blue', 'blue', 'green'],
    ['cat-shield-green', 'green', 'red'],
    ['cat-shield-red', 'red', null],
  ]) {
    game.collectItem({ type });
    assert.equal(game.catShield, start);
    game.invulnerableUntil = game.elapsed;
    assert.equal(game.takeDamage(), true);
    assert.equal(game.catShield, afterHit);
    assert.equal(game.hearts, 3, 'a shield absorbs the hit instead of removing a heart');
    assert.equal(game.tookDamage, true);
  }
  game.invulnerableUntil = game.elapsed;
  game.collectItem({ type: 'cat-shield-blue' });
  game.collectItem({ type: 'cat-shield-red' });
  assert.equal(game.catShield, 'red', 'a new shield can downgrade the current protection');
  assert.equal(game.takeDamage(), true);
  assert.equal(game.catShield, null);
  assert.equal(game.hearts, 3);
  game.invulnerableUntil = game.elapsed;
  assert.equal(game.takeDamage(), true);
  assert.equal(game.hearts, 2, 'damage reaches hearts after the shield breaks');
  game.reset();
  assert.equal(game.catShield, null, 'restart clears shield protection');
  assert.equal(ITEMS['cat-shield-blue'].catShield, 'blue');
});

test('multiple robots and repeated collisions during protection cannot stack or refresh damage', () => {
  const game = arena();
  game.robots = Array.from({ length: 5 }, () => mouse(game));
  game.update(.01);
  assert.equal(game.hearts, 2);
  const deadline = game.invulnerableUntil;
  game.cat.x += 100; game.update(.1);
  game.cat.x -= 100; game.update(.1);
  assert.equal(game.hearts, 2);
  assert.equal(game.invulnerableUntil, deadline);
  game.update(1);
  assert.equal(game.hearts, 2, 'continuous contact does not cause a delayed hit when protection expires');
  game.robots = [mouse(game)];
  game.update(.01);
  assert.equal(game.hearts, 1);
});

test('spikes and robots share protection in either order while spikes still stop Koshi', () => {
  for (const options of [{}, { portrait: true, scale: .35 }]) {
    for (const robotFirst of [true, false]) {
      const game = arena(options), brick = game.bricks.find(item => item.spikes);
      if (robotFirst) {
        game.robots = [mouse(game)];
        game.update(.01);
        assert.equal(game.hearts, 2);
        game.robots = [];
      }
      const triangle = brickSpikes([brick], game.width, game.height).triangles[2];
      const [a, tip, b] = triangle;
      const dx = tip[0] - (a[0] + b[0]) / 2, dy = tip[1] - (a[1] + b[1]) / 2;
      const length = Math.hypot(dx, dy), nx = dx / length, ny = dy / length;
      game.cat.x = tip[0] + nx * (game.cat.radius + 10);
      game.cat.y = tip[1] + ny * (game.cat.radius + 10);
      game.cat.vx = -nx * SPEED; game.cat.vy = -ny * SPEED;
      if (!robotFirst) {
        const enemy = mouse(game);
        enemy.x = tip[0]; enemy.y = tip[1];
        game.robots = [enemy];
      }
      game.update(.05);
      assert.equal(game.hearts, 2);
      assert.equal(game.cat.vx, 0);
      assert.equal(game.cat.vy, 0);
      const deadline = game.invulnerableUntil;
      game.robots = [mouse(game)];
      game.update(.01);
      assert.equal(game.hearts, 2);
      assert.equal(game.invulnerableUntil, deadline);
      game.healing.push({ x: game.cat.x, y: game.cat.y });
      game.update(.01);
      assert.equal(game.hearts, 3, 'protection does not block healing');
      assert.equal(game.invulnerableUntil, deadline, 'healing does not shorten or refresh protection');
    }
  }
});

test('damage at zero health cannot repeat and leaving the board still loses while protected', () => {
  const game = arena();
  game.hearts = 1;
  game.robots = [mouse(game), mouse(game)];
  game.update(.01);
  assert.equal(game.hearts, 0);
  assert.equal(game.state, 'lost');
  assert.equal(game.takeDamage(), false);
  const outside = arena();
  outside.takeDamage();
  outside.cat.x = 0;
  outside.update(.01);
  assert.equal(outside.state, 'lost');
});

test('Koshi shows red blinking fur and an upset face only while the shared damage timer is active', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const drawing = source.slice(source.indexOf('function line('), source.indexOf('function render('));
  const fills = [], curves = [];
  const ctx = {
    save() {}, restore() {}, translate() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    arc() {}, ellipse() {}, stroke() {}, scale() {},
    fill() { fills.push(this.fillStyle); },
    quadraticCurveTo(...args) { curves.push(args); },
  };
  const game = arena();
  const context = vm.createContext({ ctx, game });
  vm.runInContext(drawing, context);
  const draw = (withFeedback = true) => {
    fills.length = 0; curves.length = 0;
    context.drawCat(0, 0, game.elapsed, withFeedback ? game.damageProgress : null);
    return { fur: fills[0], frown: curves.some(args => args.join(',') === '0,7,8,16') };
  };
  assert.deepEqual(draw(), { fur: '#abb5bd', frown: false });
  game.takeDamage();
  assert.deepEqual(draw(), { fur: '#dc626b', frown: true });
  game.update(.26);
  assert.deepEqual(draw(), { fur: '#f2a0a5', frown: true });
  game.pause();
  game.update(10);
  assert.deepEqual(draw(), { fur: '#f2a0a5', frown: true });
  assert.deepEqual(draw(false), { fur: '#abb5bd', frown: false }, 'story portraits stay unaffected');
  game.resume();
  game.update(.739999);
  assert.equal(draw().frown, true);
  game.update(.000001);
  assert.deepEqual(draw(), { fur: '#abb5bd', frown: false });
  assert.equal(game.takeDamage(), true);
  assert.deepEqual(draw(), { fur: '#dc626b', frown: true });
  game.reset();
  assert.deepEqual(draw(), { fur: '#abb5bd', frown: false });
  assert.match(source, /drawCat\(game\.cat\.x, game\.cat\.y, game\.elapsed, game\.damageProgress, game\.boostReady\)/);
});

test('Koshi’s face shows a neutral mouth at two hearts and a frown with eye bags at one', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const drawing = source.slice(source.indexOf('function line('), source.indexOf('function render('));
  const curves = [], lines = [];
  const ctx = {
    save() {}, restore() {}, translate() {}, beginPath() {}, moveTo() {}, closePath() {},
    arc() {}, ellipse() {}, stroke() {}, scale() {},
    fill() {},
    lineTo(...args) { lines.push(args); },
    quadraticCurveTo(...args) { curves.push(args); },
  };
  const game = arena();
  game.cat.x = 0; game.cat.y = 0;
  const context = vm.createContext({ ctx, game });
  vm.runInContext(drawing, context);
  const draw = hearts => {
    game.hearts = hearts;
    curves.length = 0; lines.length = 0;
    context.drawCat(0, 0, game.elapsed);
    return { curves: [...curves], lines: [...lines] };
  };
  const fullHealth = draw(3);
  assert.ok(fullHealth.curves.some(args => args.join(',') === '-4,16,-8,11'), 'three hearts keep the smile');
  const twoHearts = draw(2);
  assert.ok(twoHearts.lines.some(args => args.join(',') === '8,12'), 'two hearts flatten the mouth');
  assert.ok(!twoHearts.curves.some(args => args.join(',') === '-4,16,-8,11'));
  const oneHeart = draw(1);
  assert.ok(oneHeart.curves.some(args => args.join(',') === '0,5,8,12'), 'one heart shows a frown');
  assert.ok(oneHeart.lines.some(args => args.join(',') === '-9,3'), 'eye bags appear under the left eye');
  assert.ok(oneHeart.lines.some(args => args.join(',') === '9,3'), 'eye bags appear under the right eye');
});

test('boost-ready Koshi has a wide glowing mouth and two red glowing eyes without changing fur', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const operations = [], stack = [];
  const ctx = new Proxy({ fillStyle: '', shadowColor: '', shadowBlur: 0 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'save') return () => stack.push({ ...target });
      if (name === 'restore') return () => Object.assign(target, stack.pop());
      return (...args) => operations.push([name, ...args, target.fillStyle, target.shadowColor, target.shadowBlur]);
    },
  });
  const context = vm.createContext({ ctx, game: arena() });
  vm.runInContext(source.slice(source.indexOf('function line('), source.indexOf('function render(')), context);
  const draw = (ready, damage = null, now = 0) => {
    operations.length = 0;
    context.drawCat(0, 0, now, damage, ready);
    assert.equal(stack.length, 0);
    return operations.slice();
  };
  const ready = draw(true);
  assert.equal(ready.find(op => op[0] === 'fill').at(-3), '#abb5bd', 'normal fur remains');
  const eyes = ready.filter(op => op[0] === 'ellipse' && op[2] === -3);
  assert.equal(eyes.length, 2);
  assert.ok(eyes.every(op => op.at(-2) === '#ec4824' && op.at(-1) === 12));
  assert.ok(ready.some(op => op[0] === 'ellipse' && op[1] === 0 && op[2] === 15 && op[3] === 8 && op[4] === 7 && op.at(-1) === 14));
  assert.ok(!draw(false).some(op => op.at(-2) === '#ec4824'), 'no readiness glow during ordinary play or cutscenes');
  assert.notDeepEqual(draw(true, null, 0), draw(true, null, .45), 'red-orange glow pulses');
  assert.equal(draw(true, 0).find(op => op[0] === 'fill').at(-3), '#dc626b', 'damage fur feedback remains');
});
