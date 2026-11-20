const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { Game, SPEED, CAT_LADY_POINTER, validateCustomLevel } = require('../src/game.js');
const { drawRoboCatLadyDeath } = require('../src/brick-visuals.js');

const type = 'robo-cat-lady';
const placement = { kind: 'enemy', type, x: .5, y: .5, time: 0 };
const level = { version: 1, id: 'Cat Lady test', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [] };
function arena() {
  const game = new Game(() => .5, { customLevel: level });
  game.start();
  const enemy = game.createCustomSpawn(placement)[0];
  game.robots.push(enemy);
  return { game, enemy };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} should be near ${b}`);

test('defeat sends the glasses flying, breaks the body apart, and leaves the hair to land and fade', () => {
  const app = readFileSync(join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const { game, enemy } = arena();
  game.defeatEnemy(enemy);
  const death = game.enemyDeaths[0];
  const draws = [], stack = [];
  let state = { alpha: 1, x: 0, y: 0 };
  const ctx = new Proxy({
    save() { stack.push({ ...state }); },
    restore() { state = stack.pop(); },
    translate(x, y) { state.x += x; state.y += y; },
    get globalAlpha() { return state.alpha; },
    set globalAlpha(value) { state.alpha = value; },
    fillRect() { draws.push({ ...state, color: this.fillStyle }); },
    clip() { draws.push({ ...state, clip: true }); },
    createRadialGradient() { draws.push({ explosion: true }); return { addColorStop() {} }; },
  }, {
    get(target, key, receiver) { return key in target ? Reflect.get(target, key, receiver) : () => {}; },
  });
  const context = vm.createContext({ ctx, drawRoboCatLadyDeath, isBossType: () => false });
  vm.runInContext(app.slice(app.indexOf('function drawRobotExplosion('), app.indexOf('function resize(')), context);
  const frame = advance => {
    game.updateEnemyDeaths(advance);
    draws.length = 0;
    context.drawEnemyDeath(death);
    return [...draws];
  };
  const glasses = items => items.find(item => item.color === '#ff4d50');
  const hair = items => items.find(item => item.color === '#3386d8');

  const first = frame(.3);
  assert.ok(glasses(first).x > enemy.x && glasses(first).y < enemy.y);
  assert.ok(!first.some(item => item.explosion));
  const blast = frame(.6);
  assert.ok(blast.some(item => item.explosion));
  assert.equal(new Set(blast.filter(item => item.clip).map(item => `${item.x}:${item.y}`)).size, 4);
  assert.equal(hair(blast).alpha, 1, 'hair retains its opacity during the explosion');
  const landed = frame(.62);
  assert.ok(!landed.some(item => item.explosion || item.clip));
  assert.equal(glasses(landed), undefined);
  assert.ok(hair(landed).y > enemy.y, 'hair lands below the body');
  near(hair(landed).alpha, 1);
  const fading = frame(.28);
  near(hair(fading).y, hair(landed).y);
  assert.ok(hair(fading).alpha > 0 && hair(fading).alpha < hair(landed).alpha);
  game.updateEnemyDeaths(.2);
  assert.equal(game.enemyDeaths.length, 0);
});

test('Robo Cat Lady can spawn from placed events and from custom bricks', () => {
  const custom = { ...level, events: [placement], brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
    spawner: { kind: 'enemy', type, shield: 'red' } }] };
  assert.deepEqual(validateCustomLevel(custom), custom);
  const game = new Game(() => .5, { customLevel: custom });
  game.start();
  assert.equal(game.robots[0].catLadyState, 'wander');
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  assert.equal(game.robots.at(-1).type, type);
  assert.equal(game.robots.at(-1).catLadyState, 'wander');
});

test('the three-second aim stops wandering, then redirects once without selecting a brick', () => {
  const { game, enemy } = arena();
  Object.assign(game.cat, { x: enemy.x, y: enemy.y + 150, vx: 0, vy: 0 });
  game.random = () => 0;
  const initialX = enemy.x;
  game.update(2.5);
  assert.equal(enemy.catLadyState, 'aim');
  assert.ok(enemy.x < initialX);
  const stopped = { x: enemy.x, y: enemy.y };
  game.update(2.99);
  assert.deepEqual({ x: enemy.x, y: enemy.y }, stopped);
  assert.equal(enemy.catLadyBeam, null);
  assert.equal(game.cat.vx, 0);
  const endpoint = game.catLadyLaser(enemy).end;
  const readyTimes = game.bricks.map(brick => brick.readyAt);
  game.activationsRemaining = 2;
  game.update(.01);
  assert.equal(enemy.catLadyState, 'lit');
  assert.deepEqual(enemy.catLadyBeam.end, endpoint);
  assert.deepEqual(game.target, endpoint);
  const angle = Math.atan2(endpoint.y - game.cat.y, endpoint.x - game.cat.x);
  near(game.cat.vx, Math.cos(angle) * SPEED);
  near(game.cat.vy, Math.sin(angle) * SPEED);
  assert.deepEqual(game.bricks.map(brick => brick.readyAt), readyTimes);
  assert.equal(game.activationsRemaining, 2);
  const beam = enemy.catLadyBeam;
  game.update(.7);
  assert.equal(enemy.catLadyBeam, beam, 'the beam outlasts the old fixed timer');
  assert.deepEqual({ x: enemy.x, y: enemy.y }, stopped);
  while ((game.cat.vx || game.cat.vy) && game.elapsed < 9) game.update(1 / 120);
  assert.equal(game.cat.vx, 0, 'Koshi eventually stops at the wall');
  assert.equal(game.cat.vy, 0);
  assert.equal(enemy.catLadyBeam, null, 'the beam disappears on the stopping frame');
  assert.equal(enemy.catLadyState, 'wander');
  game.update(1 / 120);
  assert.notDeepEqual({ x: enemy.x, y: enemy.y }, stopped);
  assert.ok(game.bricks.some(brick => game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2)),
    'Koshi can select a brick again after stopping');
});

test('brick input cannot redirect Koshi until the firing Cat Lady is defeated', () => {
  const { game, enemy } = arena();
  const other = game.createCustomSpawn({ ...placement, y: .25 })[0];
  game.robots.push(other);
  Object.assign(game.cat, { x: enemy.x, y: enemy.y + 110 });
  Object.assign(enemy, { catLadyState: 'aim', catLadyTime: CAT_LADY_POINTER.charge - .01, aimAngle: 0 });
  game.update(.01);
  const beam = enemy.catLadyBeam;
  assert.ok(beam);
  const { vx, vy } = game.cat;
  const target = game.target;
  const brick = game.bricks.find(brick => game.brickSelectable(brick) && brick.x < game.cat.x / 2);
  const steer = () => game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2);
  const readyAt = brick.readyAt;
  assert.equal(steer(), false);
  assert.equal(brick.readyAt, readyAt);
  assert.equal(game.target, target);
  assert.equal(game.cat.vx, vx);
  assert.equal(game.cat.vy, vy);

  game.defeatEnemy(other);
  assert.equal(steer(), false, 'defeating a different Cat Lady does not unlock steering');
  assert.equal(enemy.catLadyBeam, beam);
  game.defeatEnemy(enemy);
  assert.equal(enemy.catLadyBeam, null);
  assert.equal(steer(), true, 'the same click works immediately after defeating the owner');
  assert.notEqual(game.cat.vx, vx);
});

test('a second laser immediately frees the first Cat Lady and holds the new one still', () => {
  const { game, enemy } = arena();
  const second = game.createCustomSpawn({ ...placement, y: .25 })[0];
  game.robots.push(second);
  Object.assign(game.cat, { x: enemy.x, y: enemy.y + 110 });
  const charge = shooter => Object.assign(shooter, {
    catLadyState: 'aim', catLadyTime: CAT_LADY_POINTER.charge - .01, aimAngle: 0,
  });
  charge(enemy);
  game.update(.01);
  const firstEndpoint = enemy.catLadyBeam.end;
  assert.deepEqual(game.target, firstEndpoint);
  charge(second);
  game.update(.01);
  assert.notDeepEqual(second.catLadyBeam.end, firstEndpoint);
  assert.deepEqual(game.target, second.catLadyBeam.end);
  assert.equal(enemy.catLadyBeam, null);
  assert.equal(enemy.catLadyState, 'wander');
  assert.equal(second.catLadyState, 'lit');
  const brick = game.bricks.find(brick => game.brickSelectable(brick) && brick.x < game.cat.x / 2);
  assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), false,
    'the new shot keeps brick steering locked');
});

test('a bumper bounce does not end the laser while Koshi is still moving', () => {
  const { game, enemy } = arena();
  const y = enemy.y + CAT_LADY_POINTER.y;
  Object.assign(game.cat, { x: enemy.x + 95, y });
  game.bumpers.push(game.createBumper({ x: enemy.x + 210, y }, 'bumper-green'));
  Object.assign(enemy, { catLadyState: 'aim', catLadyTime: CAT_LADY_POINTER.charge - .01, aimAngle: 0 });
  game.update(.01);
  const beam = enemy.catLadyBeam;
  assert.ok(beam);
  while (game.cat.vx > 0 && game.elapsed < .5) game.update(1 / 120);
  assert.ok(game.cat.vx < 0, 'Koshi bounced back');
  assert.equal(game.target, null, 'the bounce clears the original steering target');
  assert.equal(enemy.catLadyBeam, beam, 'the continuing flight still belongs to the laser');
});

test('Koshi stays wide-eyed during laser-driven movement without changing his health mouth', () => {
  const app = readFileSync(join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const { game, enemy } = arena();
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, name) {
      return name in target ? target[name] : (...args) => calls.push([name, ...args]);
    },
  });
  const context = vm.createContext({ game, ctx, line: (...args) => calls.push(['line', ...args]) });
  vm.runInContext(app.slice(app.indexOf('function drawCat('), app.indexOf('function drawCatShield(')), context);
  const draw = (hearts, now = 0, damage = null) => {
    game.hearts = hearts;
    calls.length = 0;
    context.drawCat(game.cat.x, game.cat.y, now, damage);
    const eyes = calls.filter(([op, x]) => op === 'ellipse' && Math.abs(x) === 9);
    const nose = calls.findIndex(([op, x, y]) => op === 'moveTo' && x === -4 && y === 5);
    assert.ok(nose >= 0);
    return {
      eyes,
      mouth: calls.slice(nose),
      brows: calls.filter(([op, points]) => op === 'line' && (points?.[0]?.[0] === -14 || points?.[1]?.[0] === 14)),
    };
  };
  const health = [3, 2, 1];
  const normal = health.map(hearts => draw(hearts));
  const damaged = health.map(hearts => draw(hearts, 0, .2));
  assert.notDeepEqual(normal[1].mouth, normal[2].mouth);
  assert.equal(damaged[0].brows.length, 2, 'hurt brows remain visible without the laser expression');

  Object.assign(game.cat, { x: enemy.x, y: enemy.y + 110 });
  Object.assign(enemy, { catLadyState: 'aim', catLadyTime: CAT_LADY_POINTER.charge - .01, aimAngle: 0 });
  game.update(.01);
  assert.equal(game.catLadyLaserOwner, enemy);
  for (const [i, hearts] of health.entries()) {
    const wide = draw(hearts, 5.4, .2);
    assert.equal(wide.eyes.length, 2);
    assert.equal(wide.brows.length, 0);
    for (const [j, [, , , rx, ry]] of wide.eyes.entries()) {
      assert.ok(rx >= normal[i].eyes[j][3] * 2 && ry >= normal[i].eyes[j][4] * 2);
    }
    assert.deepEqual(wide.mouth, damaged[i].mouth, `mouth at ${hearts} hearts`);
  }
  game.update(3);
  assert.equal(game.catLadyLaserOwner, null);
  assert.deepEqual(draw(1), normal[2]);
});

test('the laser starts at the pointer tip and stops at the nearest blocker', () => {
  const { game, enemy } = arena();
  enemy.pointerX = CAT_LADY_POINTER.x;
  enemy.aimAngle = 0;
  const y = enemy.y + CAT_LADY_POINTER.y, x = enemy.x;
  const wall = game.catLadyLaser(enemy);
  near(wall.start.x, x + CAT_LADY_POINTER.x + CAT_LADY_POINTER.tip);
  near(wall.start.y, y);
  assert.ok(wall.end.x < game.width);
  game.obstructions.push(game.createObstruction({ x: x + 180, y }, { type: 'obstruction-circle' }));
  near(game.catLadyLaser(enemy).end.x, x + 180 - game.obstructions[0].radius);
  game.bumpers.push(game.createBumper({ x: x + 120, y }, 'bumper-red'));
  near(game.catLadyLaser(enemy).end.x, x + 120 - game.bumpers[0].radius);
});

test('aim chooses hazards on the targeted branch and never chooses a gun bubble or itself', () => {
  const { game, enemy } = arena();
  const gunBubble = { x: 200, y: 170, hazardShot: true };
  game.bubbles.push(gunBubble);
  const forcedRoll = (...values) => { game.random = () => values.shift(); };
  forcedRoll(.5);
  assert.equal(game.catLadyTarget(enemy, game.robots), null);
  const staticBubble = { x: 210, y: 180 };
  game.bubbles.push(staticBubble);
  const other = { x: 220, y: 190 };
  const [spikes, slime] = game.brickParts();
  game.bricks[spikes.id].spikes = true;
  game.bricks[slime.id].slimed = true;
  const center = part => ({ x: part.x + part.w / 2, y: part.y + part.h / 2 });
  for (const [roll, expected] of [[0, center(spikes)], [.26, center(slime)], [.51, staticBubble], [.75, other]]) {
    forcedRoll(.5, roll);
    assert.deepEqual(game.catLadyTarget(enemy, [enemy, other]), expected);
  }
  forcedRoll(.499);
  assert.equal(game.catLadyTarget(enemy, [enemy, other]), null);
});

test('the render charges a dotted line, then keeps it with an eight-point star centered at the endpoint', () => {
  const source = readFileSync(join(__dirname, '..', 'src', 'app.js'), 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf('function drawCatLadyLasers(');
  const context = vm.createContext({ CAT_LADY_POINTER });
  vm.runInContext(source.slice(start, source.indexOf('\n}\n', start) + 2), context);
  const { game, enemy } = arena();
  enemy.aimAngle = 0;
  enemy.catLadyState = 'aim';
  const beam = game.catLadyLaser(enemy);
  const { start: muzzle, end } = beam;
  const calls = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {},
    setLineDash(dash) { calls.push(['dash', ...dash]); },
    moveTo(...p) { calls.push(['start', ...p]); }, lineTo(...p) { calls.push(['end', ...p]); },
    stroke() { calls.push(['stroke', this.lineWidth, this.strokeStyle]); },
    closePath() { calls.push(['close']); }, fill() { calls.push(['fill']); },
  };
  context.drawCatLadyLasers(ctx, game);
  assert.deepEqual(calls[0], ['dash', .2, 7]);
  assert.deepEqual(calls[1], ['start', muzzle.x, muzzle.y]);
  assert.deepEqual(calls[2], ['end', end.x, end.y]);
  const [, earlyWidth, earlyColor] = calls[3];
  enemy.catLadyTime = 2.9;
  context.drawCatLadyLasers(ctx, game);
  assert.ok(ctx.lineWidth > earlyWidth);
  assert.ok(parseFloat(ctx.strokeStyle.split(',').at(-1)) > parseFloat(earlyColor.split(',').at(-1)));
  calls.length = 0;
  Object.assign(enemy, { catLadyState: 'lit', catLadyBeam: beam });
  game.bumpers.push(game.createBumper({ x: enemy.x + 120, y: muzzle.y }, 'bumper-red'));
  assert.notDeepEqual(game.catLadyLaser(enemy).end, end, 'a new blocker would change a fresh ray');
  context.drawCatLadyLasers(ctx, game);
  assert.deepEqual(calls[0], ['dash', .2, 7]);
  assert.deepEqual(calls[1], ['start', muzzle.x, muzzle.y]);
  assert.deepEqual(calls[2], ['end', end.x, end.y]);
  const vertices = calls.slice(4, -2);
  assert.deepEqual(calls.slice(-2), [['close'], ['fill']]);
  assert.equal(vertices.length, 16);
  const points = vertices.filter(([, x, y]) => Math.hypot(x - end.x, y - end.y) > 8);
  assert.equal(points.length, 8);
  for (let i = 0; i < 4; i++) {
    near((points[i][1] + points[i + 4][1]) / 2, end.x);
    near((points[i][2] + points[i + 4][2]) / 2, end.y);
  }
});
