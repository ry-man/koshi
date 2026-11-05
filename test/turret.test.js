const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, brickEditRegions, brickRegions, turretGeometry, turretSourceBrick, validateCustomLevel } = require('../src/game.js');

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

test('shared turret brick icons have a blue or red closed semicircle and a 45-degree rectangular barrel without interior symbols', () => {
  const node = (_namespace, tag) => ({
    tag, attributes: {}, children: [], dataset: {},
    style: { setProperty(name, value) { this[name] = value; } },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    append(...children) { this.children.push(...children); },
  });
  const context = vm.createContext({ KoshiGame: require('../src/game.js'), document: { createElementNS: node } });
  vm.runInContext(readFileSync(path.join(__dirname, '..', 'src', 'brick-visuals.js'), 'utf8'), context);
  for (const turret of ['laser', 'fireball']) for (const vertical of [false, true]) {
    const brick = { x: 0, y: 0, w: vertical ? 25 : 100, h: vertical ? 100 : 25, turret };
    const visual = context.KoshiBrickVisuals.decorateBrick(node(), brick, [brick]);
    const group = visual.symbol.children[0];
    assert.equal(group.attributes.transform, vertical ? 'rotate(90)' : 'rotate(0)');
    const children = group.children;
    assert.equal(children[0].attributes.d, 'M-24 15 A24 24 0 0 1 24 15 Z');
    const barrel = children.find(child => child.attributes.class === 'turret-barrel');
    assert.equal(barrel.tag, 'rect');
    assert.equal(barrel.attributes.transform, 'rotate(-45)');
    assert.equal(barrel.attributes.width, '24');
    assert.equal(barrel.attributes.height, '8');
    assert.equal(barrel.attributes['stroke-linejoin'], 'miter');
    const fill = children.find(child => child.attributes.class === 'item-color');
    assert.equal(fill.attributes.d, children[0].attributes.d);
    assert.equal(fill.attributes.fill, turret === 'laser' ? '#3b82f6' : '#ef4545');
    assert.ok(!children.some(child => ['turret-type', 'turret-ray'].includes(child.attributes.class)));
    assert.equal(children.some(child => child.attributes.class === 'turret-shot'), false);
  }
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const game = arena('laser', options), regions = brickRegions(game.bricks, game.width, game.height);
    for (const brick of game.bricks) {
      const visual = context.KoshiBrickVisuals.decorateBrick(node(), { ...brick, turret: 'laser' }, [brick], game.width, game.height);
      const rotation = { top: 180, right: -90, bottom: 0, left: 90 }[regions.get(brick.id).edge];
      assert.equal(visual.symbol.children[0].attributes.transform, `rotate(${rotation})`);
    }
  }
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

test('merged turret bricks spawn and draw their icon on the middle sub-brick, rounding clockwise', () => {
  const base = new Game(() => .5), top = base.perimeter.slice(1, 4);
  const node = (_namespace, tag) => ({
    tag, attributes: {}, children: [], dataset: {}, style: { setProperty() {} },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    append(...children) { this.children.push(...children); },
  });
  const context = vm.createContext({ KoshiGame: require('../src/game.js'), document: { createElementNS: node } });
  vm.runInContext(readFileSync(path.join(__dirname, '..', 'src', 'brick-visuals.js'), 'utf8'), context);
  const cases = [[top, top[1]], [top.slice(0, 2), top[1]], [base.perimeter.slice(1, 5), top[2]]];
  const regions = brickRegions(base.bricks, base.width, base.height);
  for (let i = 0; i < base.perimeter.length; i++) {
    const a = base.perimeter[i], b = base.perimeter[(i + 1) % base.perimeter.length];
    if (regions.get(a).edge === regions.get(b).edge) continue;
    cases.push([[a, b], b], [[base.perimeter[(i + base.perimeter.length - 1) % base.perimeter.length],
      a, b, base.perimeter[(i + 2) % base.perimeter.length]], b]);
  }
  for (const [members, middle] of cases) {
    const owner = members[0], region = brickEditRegions(base.bricks).get(owner);
    const customLevel = { ...blank(), brickTypes: [{ ...region, kind: 'normal', turret: 'laser' }], brickGroups: [{ owner, members }] };
    const game = new Game(() => .5, { customLevel });
    game.start();
    const brick = game.bricks[owner], source = turretSourceBrick(brick, game.bricks, game.perimeter);
    assert.equal(source.id, middle);
    game.touchTurret(brick);
    assert.deepEqual(game.activeTurret.anchor, turretGeometry(game.bricks[middle], game.width, game.height).anchor);
    const parts = game.brickParts().filter(part => part.id === owner);
    const visual = context.KoshiBrickVisuals.decorateBrick(node(), brick, parts, game.width, game.height, source);
    assert.deepEqual({ ...visual.infoBounds }, { x: source.x, y: source.y, w: source.w, h: source.h });
  }
});

test('turret brick icons turn grey once the turret is used and regain color when recharged', () => {
  const node = (_namespace, tag) => ({
    tag, attributes: {}, children: [], dataset: {}, style: { setProperty() {} },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    append(...children) { this.children.push(...children); },
  });
  const context = vm.createContext({ KoshiGame: require('../src/game.js'), document: { createElementNS: node } });
  vm.runInContext(readFileSync(path.join(__dirname, '..', 'src', 'brick-visuals.js'), 'utf8'), context);
  const brick = { id: 0, x: 0, y: 0, w: 100, h: 25, turret: 'fireball', spawned: false };
  const visual = context.KoshiBrickVisuals.decorateBrick(node(), brick, [brick]);
  const fill = visual.symbol.children[0].children.find(child => child.attributes.class === 'item-color');
  assert.equal(fill.attributes.fill, '#ef4545');
  brick.spawned = true;
  context.KoshiBrickVisuals.updateBrick(visual, brick, 1);
  assert.equal(fill.attributes.fill, '#8a9399');
  assert.equal(visual.symbol.dataset.turretUsed, 'true');
  brick.spawned = false;
  context.KoshiBrickVisuals.updateBrick(visual, brick, 2);
  assert.equal(fill.attributes.fill, '#ef4545');
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
  const obstruction = game.createObstruction(enemies[1], { type: 'obstruction-circle', destructible: true });
  game.obstructions.push(obstruction);
  assert.equal(game.fireTurretAt(turret.center.x + turret.direction.x * 250,
    turret.center.y + turret.direction.y * 250), true);
  assert.equal(enemies[0].shield, 'red');
  assert.ok(game.robots.includes(enemies[0]));
  assert.ok(!game.robots.includes(enemies[1]));
  assert.equal(game.enemies, 1);
  assert.ok(game.obstructions.includes(obstruction), 'laser damage never destroys a marked obstruction');
  assert.equal(game.obstructionDestructions.length, 0);
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
  const obstruction = game.createObstruction({ x: target.x + 180, y: target.y },
    { type: 'obstruction-circle', width: 160, destructible: true });
  game.obstructions.push(obstruction);
  assert.equal(game.fireTurretAt(target.x, target.y), true);
  assert.equal(game.turretProjectiles.length, 1);
  game.updateTurrets(2);
  assert.equal(enemies[0].shield, null);
  assert.ok(game.robots.includes(enemies[0]));
  assert.ok(!game.robots.includes(enemies[1]));
  assert.ok(!game.robots.includes(enemies[2]), 'expanded blast reaches enemies 105 pixels from the impact');
  assert.ok(game.items.includes(pickup));
  assert.ok(!game.obstructions.includes(obstruction), 'fireball blast destroys an obstruction touched only at its edge');
  assert.equal(game.obstructionDestructions.length, 1);
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
  turret.type = 'laser'; turret.remaining = 5;
  calls.length = 0;
  drawing.drawTurretTimer(context, turret);
  assert.ok(calls.some(([name, value]) => name === 'strokeStyle' && value === '#3b82f6'));
  assert.ok(calls.some(([name, value]) => name === 'shadowColor' && value === '#60a5fa'));
  turret.type = 'fireball'; calls.length = 0;
  drawing.drawTurretTimer(context, turret);
  assert.ok(calls.some(([name, value]) => name === 'strokeStyle' && value === '#ff4545'));
  const html = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /id="turret-status"|id="turret-count"/);
});

test('laser effects use light blue beams and glow with a pale blue core', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const calls = [], ctx = new Proxy({}, {
    get: (target, name) => name in target ? target[name] : () => {},
    set: (target, name, value) => { calls.push([name, value]); target[name] = value; return true; },
  });
  const context = vm.createContext({ ctx, game: { turretProjectiles: [],
    turretEffects: [{ type: 'laser', age: .05, start: { x: 10, y: 20 }, end: { x: 100, y: 150 } }] } });
  vm.runInContext(source.slice(source.indexOf('function drawTurretEffects('), source.indexOf('function render(now)')), context);
  context.drawTurretEffects(ctx);
  assert.ok(calls.some(([name, color]) => name === 'strokeStyle' && color === '#7dd3fc'));
  assert.ok(calls.some(([name, color]) => name === 'strokeStyle' && color === '#e0f2fe'));
  assert.ok(calls.some(([name, color]) => name === 'shadowColor' && color === '#7dd3fc'));
});
