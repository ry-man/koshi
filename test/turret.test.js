const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, brickEditRegions, brickRegions, turretGeometry, validateCustomLevel } = require('../src/game.js');

const blank = () => ({ version: 1, id: 'Turret test', duration: 120, goal: 1000, heartCost: null, brickSet: 1, events: [] });

function arena(type = 'laser', options = {}) {
  const base = new Game(() => .5, options);
  const top = base.bricks.filter(brick => brickRegions(base.bricks, base.width, base.height).get(brick.id).edge === 'top')
    .sort((a, b) => Math.abs(a.x + a.w / 2 - base.width / 2) - Math.abs(b.x + b.w / 2 - base.width / 2))[0];
  const region = brickEditRegions(base.bricks).get(top.id);
  const customLevel = { ...blank(), brickTypes: [{ ...region, kind: 'normal', turret: type }] };
  const game = new Game(() => .5, { ...options, customLevel });
  game.start();
  return game;
}

function topTurret(game) {
  return game.bricks.filter(brick => brick.turret)
    .filter(brick => brickRegions(game.bricks, game.width, game.height).get(brick.id).edge === 'top')
    .sort((a, b) => Math.abs(a.x + a.w / 2 - game.width / 2) - Math.abs(b.x + b.w / 2 - game.width / 2))[0];
}

function enter(game, brick = topTurret(game)) {
  game.touchTurret(brick);
  assert.ok(game.activeTurret);
  game.update(.24);
  assert.equal(game.activeTurret.entry, undefined);
  return game.activeTurret;
}

test('turret variants validate, round-trip, and cannot share a contact surface', () => {
  const game = arena('fireball');
  const level = validateCustomLevel(JSON.parse(JSON.stringify(game.customLevel)));
  assert.equal(level.brickTypes[0].turret, 'fireball');
  assert.equal(new Game(() => .5, { customLevel: level }).bricks.find(brick => brick.turret).turret, 'fireball');
  for (const invalid of [true, '', 'plasma', 1, {}]) {
    assert.throws(() => validateCustomLevel({ ...level,
      brickTypes: [{ ...level.brickTypes[0], turret: invalid }] }), TypeError);
  }
  assert.throws(() => validateCustomLevel({ ...level,
    brickTypes: [{ ...level.brickTypes[0], turret: 'laser', spawner: { kind: 'weapon', type: 'silver' } }] }),
  /cannot combine contact surfaces/);
});

test('touching a turret brick enters its dome, protects Koshi, and exits after three shots', () => {
  const game = arena();
  const brick = topTurret(game), geometry = enter(game, brick);
  assert.equal(geometry.type, 'laser');
  assert.deepEqual({ x: game.cat.x, y: game.cat.y }, geometry.center);
  assert.equal(brick.spawned, true);
  assert.equal(game.takeDamage(), false);
  for (let shot = 2; shot >= 0; shot--) {
    assert.equal(game.fireTurretAt(geometry.center.x, geometry.center.y + 120), true);
    if (shot) assert.equal(game.activeTurret.shotsRemaining, shot);
  }
  assert.equal(game.activeTurret, null);
  assert.equal(game.turretFades.length, 1);
  assert.equal(game.takeDamage(), true);
});

test('Koshi moves into the turret, then stays in place as it exits', () => {
  const game = arena(), brick = topTurret(game);
  const geometry = turretGeometry(brick, game.width, game.height);
  game.cat.x = geometry.center.x - geometry.direction.x * 18;
  game.cat.y = geometry.center.y - geometry.direction.y * 18;
  game.touchTurret(brick);
  const start = { x: game.cat.x, y: game.cat.y };
  assert.deepEqual(start, { x: geometry.center.x - geometry.direction.x * 18,
    y: geometry.center.y - geometry.direction.y * 18 });
  game.update(.12);
  assert.ok(Math.hypot(game.cat.x - start.x, game.cat.y - start.y) > 0);
  assert.ok(Math.hypot(game.cat.x - geometry.center.x, game.cat.y - geometry.center.y) > 0);
  game.update(.12);
  assert.ok(Math.abs(game.cat.x - geometry.center.x) < 1e-8);
  assert.ok(Math.abs(game.cat.y - geometry.center.y) < 1e-8);
  const seated = { x: game.cat.x, y: game.cat.y };
  for (let shot = 0; shot < 2; shot++) {
    assert.equal(game.fireTurretAt(geometry.center.x, geometry.center.y + 120), true);
  }
  assert.equal(game.fireTurretAt(brick.x + brick.w / 2, brick.y + brick.h / 2), true);
  assert.equal(game.activeTurret, null);
  assert.deepEqual({ x: game.cat.x, y: game.cat.y }, seated);
  assert.equal(game.target, null);
});

test('physical contact with the configured brick enters the turret automatically', () => {
  const game = arena(), brick = topTurret(game);
  const geometry = turretGeometry(brick, game.width, game.height);
  assert.equal(Math.hypot(geometry.center.x - geometry.anchor.x, geometry.center.y - geometry.anchor.y), game.cat.radius);
  game.cat.x = geometry.center.x - geometry.direction.x;
  game.cat.y = geometry.center.y - geometry.direction.y;
  game.update(1 / 120);
  assert.equal(game.activeTurret?.brickId, brick.id);
  assert.equal(brick.spawned, true);
});

test('turret exits after ten seconds and a spent turret requires one battery to reuse', () => {
  const game = arena('fireball');
  const brick = topTurret(game);
  const first = enter(game, brick);
  game.update(10);
  assert.equal(game.activeTurret, null);
  assert.equal(game.turretFades.length, 1);

  game.spawnerTouching.clear();
  game.batteries = 1;
  enter(game, brick);
  assert.equal(game.batteries, 0);
  game.spawnerTouching.clear();
  game.exitTurret();
  game.touchTurret(brick);
  assert.equal(game.activeTurret, null, 'the spent turret cannot be reused without another battery');
  game.reset();
  assert.equal(game.bricks[brick.id].spawned, false);
});

test('laser damages every enemy on its line and leaves shielded enemies alive', () => {
  const game = arena('laser'), turret = enter(game);
  const start = { x: turret.center.x + turret.direction.x * 25, y: turret.center.y + turret.direction.y * 25 };
  const enemies = game.createEnemies([0, 'mouse', 3]);
  enemies[0].x = start.x + turret.direction.x * 60;
  enemies[0].y = start.y + turret.direction.y * 60;
  enemies[0].shield = 'green';
  enemies[0].invulnerableUntil = 0;
  enemies[1].x = start.x + turret.direction.x * 130;
  enemies[1].y = start.y + turret.direction.y * 130;
  enemies[1].shield = null;
  enemies[1].invulnerableUntil = 0;
  game.robots.push(...enemies);
  assert.equal(game.fireTurretAt(turret.center.x + turret.direction.x * 250,
    turret.center.y + turret.direction.y * 250), true);
  assert.equal(enemies[0].shield, 'red');
  assert.ok(game.robots.includes(enemies[0]));
  assert.ok(!game.robots.includes(enemies[1]));
  assert.equal(game.enemies, 1);
});

test('fireball blast damages enemies in its area but not pickups', () => {
  const game = arena('fireball'), turret = enter(game);
  const target = { x: turret.center.x + turret.direction.x * 150, y: turret.center.y + turret.direction.y * 150 };
  const enemies = game.createEnemies([0, 'mouse', 3]);
  enemies[0].x = target.x; enemies[0].y = target.y; enemies[0].shield = 'red'; enemies[0].invulnerableUntil = 0;
  enemies[1].x = target.x + 35; enemies[1].y = target.y; enemies[1].shield = null; enemies[1].invulnerableUntil = 0;
  enemies[2].x = target.x + 105; enemies[2].y = target.y; enemies[2].shield = null; enemies[2].invulnerableUntil = 0;
  game.robots.push(...enemies);
  const pickup = { x: target.x, y: target.y, type: 'smiley-cookie', expires: 100 };
  game.items.push(pickup);
  assert.equal(game.fireTurretAt(target.x, target.y), true);
  assert.equal(game.turretProjectiles.length, 1);
  game.updateTurrets(2);
  assert.equal(enemies[0].shield, null);
  assert.ok(game.robots.includes(enemies[0]));
  assert.ok(!game.robots.includes(enemies[1]));
  assert.ok(!game.robots.includes(enemies[2]), 'expanded blast reaches enemies 105 pixels from the impact');
  assert.ok(game.items.includes(pickup));
});

test('turret drawing faces inward, shows Koshi through blue glass, anchors its barrel, and places counters on the dome', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const visualCode = source.slice(source.indexOf('function turretDomeRotation('), source.indexOf('function drawTurretEffects('));
  const calls = [], paths = [], arcs = [];
  let currentPath = [];
  const context = new Proxy({ globalAlpha: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        calls.push([key, ...args]);
        if (key === 'beginPath') currentPath = [];
        if (key === 'moveTo' || key === 'lineTo') currentPath.push([key, ...args]);
        if (key === 'arc') arcs.push(args);
        if (key === 'stroke') paths.push({ color: target.strokeStyle, path: currentPath });
      };
    },
    set(target, key, value) { target[key] = value; calls.push([key, value]); return true; },
  });
  const drawing = vm.createContext({ Math });
  vm.runInContext(`${visualCode}\nthis.drawTurretBase = drawTurretBase; this.drawTurretTimer = drawTurretTimer; this.drawTurretReadout = drawTurretReadout;`, drawing);
  const game = arena(), turret = {
    ...turretGeometry(topTurret(game), game.width, game.height),
    aim: { x: 0, y: 1 }, shotsRemaining: 2, remaining: 10,
  };
  drawing.drawTurretBase(context, turret);
  assert.ok(calls.some(([name, value]) => name === 'fillStyle' && value === 'rgba(61, 150, 214, .42)'));
  assert.deepEqual(arcs[0].slice(2), [turret.domeRadius, 0, Math.PI]);
  const barrel = paths.find(({ path }) => path.length === 2);
  assert.deepEqual(barrel.path[0].slice(1), [
    turret.anchor.x + turret.direction.x * turret.domeRadius,
    turret.anchor.y + turret.direction.y * turret.domeRadius,
  ], 'barrel begins exactly at the dome apex');
  drawing.drawTurretReadout(context, turret);
  assert.ok(calls.some(([name, value]) => name === 'fillText' && value === '2'));
  const readout = calls.find(([name]) => name === 'fillText');
  const readoutOffset = { x: readout[2] - turret.anchor.x, y: readout[3] - turret.anchor.y };
  const radialDistance = Math.hypot(readoutOffset.x, readoutOffset.y);
  const inwardDistance = readoutOffset.x * turret.direction.x + readoutOffset.y * turret.direction.y;
  assert.ok(radialDistance + 13 <= turret.domeRadius, 'counter badge stays within the curved dome edge');
  assert.ok(inwardDistance >= 13, 'counter badge stays within the flat edge of the dome');
  assert.match(source, /board\.addEventListener\('click', event =>[\s\S]*?event\.stopImmediatePropagation\(\);[\s\S]*?\}, true\);/,
    'turret pointer clicks are consumed before a brick can steer Koshi');
  arcs.length = 0;
  drawing.drawTurretTimer(context, turret);
  assert.equal(arcs.at(-1)[4], Math.PI);
  turret.remaining = 5;
  drawing.drawTurretTimer(context, turret);
  assert.ok(Math.abs(arcs.at(-1)[4] - Math.PI / 2) < 1e-10);
  turret.remaining = 0;
  const arcCount = arcs.length;
  drawing.drawTurretTimer(context, turret);
  assert.equal(arcs.length, arcCount, 'expired timer shrinks to a point');
  const html = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /id="turret-status"|id="turret-count"/);
});
