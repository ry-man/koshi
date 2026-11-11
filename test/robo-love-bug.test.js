const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, LEVELS, CHARACTERS, WEAPONS, validateCustomLevel, brickRegions } = require('../src/game.js');
const { spawnSymbol, spawnColor } = require('../src/brick-visuals.js');
const { GUIDE } = require('../src/learning.js');

const type = 'robo-love-bug';
function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: {
    version: 1, id: 'Love Bug tests', duration: 120, goal: 1000, heartCost: null, brickSet: 1, events: [],
    ...(options.scroll ? { autoscroll: { length: 30, speed: 0, events: [] } } : {}),
  } });
  game.start();
  return game;
}
function bug(game, x = .3, y = .3, extra = {}) {
  const enemy = game.createCustomSpawn({ kind: 'enemy', type, x, y, ...extra })[0];
  enemy.phase = 0;
  return enemy;
}
function pair(game) {
  game.robots = [bug(game), bug(game, .7, .7)];
  return game.robots;
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function middleBrick(game, edge) {
  const regions = brickRegions(game.bricks, game.width, game.height);
  return game.bricks.filter(brick => regions.get(brick.id).edge === edge)
    .sort((a, b) => Math.hypot(a.x + a.w / 2 - game.width / 2, a.y + a.h / 2 - game.height / 2)
      - Math.hypot(b.x + b.w / 2 - game.width / 2, b.y + b.h / 2 - game.height / 2))[0];
}

test('Love Bugs support custom events, groups, spawners, shields, previews, guide and editor without campaign changes', () => {
  assert.equal(CHARACTERS[type], 'Robo Love Bug');
  const game = arena(), custom = { ...game.customLevel,
    events: [{ time: 2, kind: 'enemy', type, x: .3, y: .5, shield: 'green',
      group: { shape: 'line', count: 2, angle: 90, size: .3 } }],
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'enemy', type, shield: 'red' } }],
  };
  assert.deepEqual(validateCustomLevel(custom), custom);
  const preview = new Game(() => .5, { customLevel: custom });
  preview.start(); preview.update(1.1);
  const reserved = [...preview.pendingSpawns.values()].find(pending => pending.kind === 'enemy').items;
  assert.equal(reserved.length, 2);
  assert.ok(reserved.every(enemy => enemy.type === type && enemy.defeatPoints === 3));
  assert.equal(preview.enemyDeaths.length, 0, 'cues are not living bugs');
  preview.update(.9);
  assert.ok(reserved.every(enemy => preview.robots.includes(enemy)));
  preview.spawnFromBrick(preview.bricks.find(brick => brick.spawner));
  assert.equal(preview.robots[2].type, type);
  assert.equal(preview.robots[2].defeatPoints, 2);
  assert.ok(game.createEnemies([0, type, 2]).every(enemy => enemy.type === type));
  assert.match(spawnSymbol({ kind: 'enemy', type }), /^M/);
  assert.equal(spawnColor({ kind: 'enemy', type }), '#f29ac2');
  assert.ok(GUIDE.some(page => page.sections.some(section => section[2] === `enemy:${type}`)));
  assert.ok(LEVELS.every(level => !level.enemies.some(([, enemyType]) => enemyType === type)));
  const editor = fs.readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  assert.match(editor, /'robo-love-bug': \{ name: 'Robo Love Bug' \}/);
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  test(`Love Bugs move and ricochet like balls at 120 units per second ${JSON.stringify(options)}`, () => {
    const game = arena(options), [enemy, other] = pair(game);
    game.cat.x = game.bounds().left; game.cat.y = game.bounds().bottom;
    const { x, y } = enemy;
    game.combat(.1, game.cat.x, game.cat.y);
    near(enemy.x - x, 12); near(enemy.y, y);
    assert.ok(enemy.loveBugStride > 0);
    enemy.x = game.bounds().right - 1; enemy.phase = 0;
    game.combat(.1, game.cat.x, game.cat.y);
    assert.ok(Math.cos(enemy.phase) < 0);
    assert.ok(enemy.x <= game.bounds().right);
    assert.ok(game.robots.includes(other));
    const fence = { x: enemy.x + 25, y: game.bounds().top, w: 4, h: game.bounds().bottom - game.bounds().top };
    enemy.phase = 0;
    game.moveBall(enemy, .2, [fence]);
    assert.ok(Math.cos(enemy.phase) < 0, 'same swept fence bounce as Ball');
  });

  test(`real growing, completed, retracting and T-junction fences determine isolation ${JSON.stringify(options)}`, () => {
    const game = arena(options), [a, b] = pair(game);
    const top = middleBrick(game, 'top');
    top.barrier = true;
    game.barriers.push({ id: top.id, length: 0, extending: true });
    game.updateBarriers(.1);
    assert.equal(game.isolatedLoveBugs(game.barrierParts()).size, 0, 'unfinished fence can be circled');
    game.updateBarriers(100);
    assert.deepEqual(game.isolatedLoveBugs(game.barrierParts()), new Set([a, b]), 'complete divider isolates both bugs');
    b.x = a.x; b.y = a.y + 60;
    assert.equal(game.isolatedLoveBugs(game.barrierParts()).size, 0, 'two bugs in one region are companions');
    const left = middleBrick(game, 'left');
    left.barrier = true;
    game.barriers.push({ id: left.id, length: 0, extending: true });
    game.updateBarriers(100);
    a.y = game.bounds().top + 40; b.y = game.bounds().bottom - 40;
    assert.deepEqual(game.isolatedLoveBugs(game.barrierParts()), new Set([a, b]), 'a T-junction closes two regions');
    const cached = game.loveBugRegions;
    game.isolatedLoveBugs(game.barrierParts());
    assert.equal(game.loveBugRegions, cached, 'static barriers reuse their region labels');
    game.barriers.forEach(fence => { fence.extending = false; });
    game.updateBarriers(.5);
    assert.equal(game.isolatedLoveBugs(game.barrierParts()).size, 0, 'routes reopen when fences retract');
  });
}

test('a lone bug dies immediately, other enemies and unspawned previews cannot keep it alive', () => {
  const game = arena(), enemy = bug(game);
  const mouse = game.createCustomSpawn({ kind: 'enemy', type: 'mouse', x: .8, y: .8 })[0];
  game.robots = [enemy, mouse];
  game.pendingSpawns.set('later-bug', { kind: 'enemy', items: [bug(game, .7, .2)] });
  game.combat(0, game.cat.x, game.cat.y);
  assert.deepEqual(game.robots, [mouse]);
  assert.equal(game.enemyDeaths[0].type, type);
  assert.equal(game.enemies, 1);
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.enemyDeaths.length, 1, 'death is awarded only once');
});

test('barrier isolation uses connected regions, not line of sight, including enclosed pockets and intersecting walls', () => {
  const game = arena(), [a, b] = pair(game), bounds = game.bounds();
  a.x = 200; a.y = 200; b.x = 700; b.y = 200;
  assert.equal(game.isolatedLoveBugs([{ x: 400, y: bounds.top, w: 4, h: 250 }]).size, 0,
    'a blocked straight line does not isolate bugs that can go around the end');
  const box = [
    { x: 150, y: 150, w: 150, h: 4 }, { x: 150, y: 300, w: 150, h: 4 },
    { x: 150, y: 150, w: 4, h: 154 }, { x: 300, y: 150, w: 4, h: 154 },
  ];
  assert.deepEqual(game.isolatedLoveBugs(box), new Set([a, b]));
  const c = bug(game); c.x = 230; c.y = 250; game.robots.push(c);
  assert.deepEqual(game.isolatedLoveBugs(box), new Set([b]), 'only the single bug outside the pocket dies');
  assert.equal(game.isolatedLoveBugs(box.slice(1)).size, 0, 'an opening reconnects the pocket');
  const cross = [
    { x: 400, y: bounds.top, w: 4, h: bounds.bottom - bounds.top },
    { x: bounds.left, y: 300, w: bounds.right - bounds.left, h: 4 },
  ];
  a.x = 200; a.y = 200; b.x = 700; b.y = 200; c.x = 200; c.y = 400;
  assert.equal(game.isolatedLoveBugs(cross).size, 3);
});

test('isolation deaths use a simultaneous snapshot, ignore shields and drop carried items with normal points', () => {
  const game = arena(), [a, b] = pair(game);
  a.shield = 'blue'; a.defeatPoints = 4; a.carriesItem = 'battery';
  const bounds = game.bounds();
  game.barrierParts = () => [{ x: game.width / 2, y: bounds.top, w: 4, h: bounds.bottom - bounds.top }];
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.robots.length, 0);
  assert.equal(game.enemies, 5);
  assert.equal(game.enemyDeaths.length, 2);
  assert.equal(game.catBlockProgress.defeated[type], 2);
  assert.equal(game.items[0].type, 'battery');
  assert.equal(game.items[0].x, a.x);
  assert.equal(game.enemyDeaths[1].x, b.x);
});

test('all swords, hammers, Boost and turret damage leave bugs and shields unharmed without spending weapon uses', () => {
  for (const weaponType of Object.keys(WEAPONS)) for (const shield of [undefined, 'blue']) {
    const game = arena(), [enemy] = pair(game);
    enemy.x = game.cat.x; enemy.y = game.cat.y; enemy.shield = shield;
    game.weapon = { type: weaponType, uses: WEAPONS[weaponType].uses, expires: Infinity };
    const uses = game.weapon.uses;
    game.combat(0, game.cat.x, game.cat.y);
    assert.equal(game.robots.length, 2);
    assert.equal(enemy.shield, shield);
    assert.equal(game.weapon.uses, uses);
    assert.equal(game.weaponAttacks.length, 0);
    assert.equal(game.hearts, 2, 'attack immunity does not make contact harmless');
    game.boosted = true;
    game.combat(0, game.cat.x, game.cat.y);
    game.damageTurretEnemy(enemy);
    game.detonateTurretFireball(enemy);
    game.defeatEnemy(enemy);
    assert.equal(game.robots.length, 2);
    assert.equal(enemy.shield, shield);
    assert.equal(enemy.invulnerableUntil, 0);
    assert.equal(game.enemies, 0);
    assert.equal(game.enemyDeaths.length, 0);
  }
});

test('appearing solids cannot defeat a Love Bug', () => {
  for (const objectType of ['obstruction-circle', 'bumper-red']) {
    const game = arena(), [enemy] = pair(game);
    const object = objectType === 'bumper-red' ? game.createBumper(enemy, objectType)
      : game.createObstruction(enemy, { type: objectType });
    game.clearAppearingObstruction(object);
    assert.ok(game.robots.includes(enemy));
    assert.equal(game.enemyDeaths.length, 0);
    assert.ok(Math.hypot(enemy.x - object.x, enemy.y - object.y) >= enemy.radius + object.radius);
  }
});

test('sleep and fear affect movement but do not protect isolated bugs; pause freezes death and reset clears it', () => {
  const game = arena(), [enemy] = pair(game);
  game.collectItem({ type: 'music-box' });
  const { x, y } = enemy;
  game.update(.1);
  near(enemy.x, x); near(enemy.y, y);
  game.enemiesSleepUntil = 0; game.collectItem({ type: 'spooky-mask' });
  game.update(.1);
  assert.equal(game.robots.length, 2);
  assert.equal(enemy.afraid, true);
  game.robots = [enemy]; game.enemiesSleepUntil = game.elapsed + 10;
  game.update(.01);
  assert.equal(game.robots.length, 0);
  assert.equal(game.enemyDeaths.length, 1);
  const progress = game.enemyDeaths[0].deathProgress;
  game.pause(); game.update(.5);
  assert.equal(game.enemyDeaths[0].deathProgress, progress);
  game.resume(); game.update(.75);
  near(game.enemyDeaths[0].deathProgress, progress + .5);
  game.update(.76);
  assert.equal(game.enemyDeaths.length, 0);
  game.reset(); assert.equal(game.enemyDeaths.length, 0);
});

test('offscreen bugs are dormant companions only when they enter the visible scrolling screen', () => {
  for (const portrait of [false, true]) {
    const game = arena({ scroll: true, portrait }), a = bug(game), b = bug(game);
    const camera = game.camera(), axis = portrait ? 'y' : 'x';
    const other = portrait ? 'x' : 'y', extent = portrait ? camera.height : camera.width;
    const start = camera[axis];
    a[axis] = start + extent * .4;
    b[axis] = portrait ? start - b.radius - 10 : start + extent + b.radius + 10;
    a[other] = b[other] = portrait ? camera.width / 2 : camera.height / 2;
    game.robots = [a, b];
    game.combat(0, game.cat.x, game.cat.y);
    assert.deepEqual(game.robots, [b], 'single visible bug dies; offscreen bug waits');
    b[axis] = start + extent * .8;
    game.combat(0, game.cat.x, game.cat.y);
    assert.equal(game.robots.length, 0, 'offscreen survivor dies when it becomes the lone visible bug');
  }
});

test('Love Bug artwork matches the reference and cries before splitting into head and wings with the shared Wheel explosion', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const calls = [], stack = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'save') return () => stack.push({ ...target });
      if (name === 'restore') return () => Object.assign(target, stack.pop());
      if (name === 'createRadialGradient') return () => ({ addColorStop() {} });
      return (...args) => calls.push({ name, args, fill: target.fillStyle, stroke: target.strokeStyle, alpha: target.globalAlpha });
    },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawRoboLoveBug('), source.indexOf('function drawRoboCrab('))
    + source.slice(source.indexOf('function drawRobotExplosion('), source.indexOf('function resize(')), context);
  context.drawRobot = (enemy, progress) => {
    if (enemy.type === type) context.drawRoboLoveBug(enemy, progress);
  };
  const draw = (progress = null, stride = 0) => {
    calls.length = 0;
    context.drawRoboLoveBug({ phase: -Math.PI / 2, loveBugStride: stride }, progress);
    assert.equal(stack.length, 0); assert.equal(ctx.globalAlpha, 1);
    assert.ok(calls.every(call => call.args.every(value => typeof value !== 'number' || Number.isFinite(value))));
    return calls.slice();
  };
  const alive = draw();
  for (const color of ['#485158', '#ef3646', '#f29ac2', '#9346b2', '#722d40']) {
    assert.ok(alive.some(call => ['fill', 'fillRect'].includes(call.name) && call.fill === color), `${color} visible`);
  }
  assert.equal(alive.filter(call => call.name === 'fillRect' && call.fill === '#ef3646'
    && call.args[2] === call.args[3]).length, 2, 'red square eyes');
  assert.notDeepEqual(draw(null, 1).filter(call => call.name === 'lineTo'), alive.filter(call => call.name === 'lineTo'), 'tiny legs shuffle');
  const tears = frame => frame.filter(call => call.name === 'ellipse' && call.fill === '#55bafa');
  const early = draw(.1), crying = draw(.3), splitting = draw(.65);
  assert.equal(tears(alive).length, 0);
  assert.equal(tears(crying).length, 2);
  assert.ok(tears(crying)[0].args[3] > tears(early)[0].args[3], 'blue tears swell before separation');
  const pieces = frame => frame.filter(call => call.name === 'translate');
  assert.equal(pieces(splitting).length, 3, 'two wings and one head separate');
  assert.ok(pieces(crying).every(call => call.args.every(value => value === 0)));
  assert.ok(pieces(splitting).every(call => call.args.some(value => value !== 0)));
  assert.ok(draw(1).filter(call => call.name === 'fill').every(call => call.alpha === 0));
  for (const enemyType of [type, 'wheel']) {
    calls.length = 0;
    context.drawEnemyDeath({ type: enemyType, x: 0, y: 0, phase: 0, deathProgress: .8 });
    for (const color of ['#e94b25', '#ffac32', '#fff2ab']) {
      assert.ok(calls.some(call => call.name === 'fill' && call.fill === color), `${enemyType} uses Wheel explosion color ${color}`);
    }
    assert.equal(stack.length, 0); assert.equal(ctx.globalAlpha, 1);
  }
});
