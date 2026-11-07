const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, LEVELS, CHARACTERS, validateCustomLevel, brickRegions } = require('../src/game.js');
const { spawnSymbol, spawnColor } = require('../src/brick-visuals.js');
const { GUIDE } = require('../src/learning.js');
const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const blank = () => ({ version: 1, id: 'Goalie tests', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [] });
function arena(options = {}, edge = 'top') {
  const game = new Game(() => .5, { ...options, customLevel: blank() });
  if (edge) {
    const regions = brickRegions(game.bricks, game.width, game.height);
    for (const brick of game.bricks) if (regions.get(brick.id).edge === edge) brick.kind = 'goal';
  }
  game.start();
  return game;
}
function goalie(game, point = { x: .5, y: .5 }, shield) {
  const enemy = game.createCustomSpawn({ time: 0, kind: 'enemy', type: 'goalie', ...point, shield })[0];
  const area = game.goalieArea(enemy);
  if (area) game.placeGoalie(enemy, area, area.vertical ? enemy.y : enemy.x);
  game.robots.push(enemy);
  return enemy;
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const along = (area, actor) => area.vertical ? actor.y : actor.x;
function shot(game, area, tangent, offset = 150, speed = 400) {
  const ball = game.createSoccerBall({
    x: area.vertical ? area.normal + area.inward * offset : tangent,
    y: area.vertical ? tangent : area.normal + area.inward * offset,
  });
  ball.vx = area.vertical ? -area.inward * speed : 0;
  ball.vy = area.vertical ? 0 : -area.inward * speed;
  game.soccerBalls.push(ball);
  return ball;
}
function parkCat(game) {
  game.cat.x = game.width / 2; game.cat.y = game.height / 2;
  game.cat.vx = 0; game.cat.vy = 0;
}

test('goalie validates placements, shields, spawners, custom cast, preview symbols, and keeps campaign content unchanged', () => {
  const custom = { ...blank(), brickTypes: [
    { edge: 'top', start: .2, end: .4, kind: 'goal' },
    { edge: 'bottom', start: .2, end: .3, kind: 'normal', spawner: { kind: 'enemy', type: 'goalie', shield: 'red' } },
  ], events: [{ time: 2, kind: 'enemy', type: 'goalie', x: .3, y: .5, shield: 'green' }],
  cutscene: { theme: 'workshop', lines: [{ speaker: 'goalie', text: 'Nobody scores past me!',
    actors: [{ character: 'goalie', x: .5, y: .65 }] }] } };
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(custom))), custom);
  const game = new Game(() => .5, { customLevel: custom });
  game.start(); game.update(1.1);
  const reserved = [...game.pendingSpawns.values()].find(spawn => spawn.kind === 'enemy').items[0];
  assert.equal(reserved.type, 'goalie');
  assert.ok(game.goalieArea(reserved));
  game.update(.9); assert.equal(game.robots[0], reserved); assert.equal(reserved.defeatPoints, 3);
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  assert.equal(game.robots[1].type, 'goalie'); assert.equal(game.robots[1].defeatPoints, 2);
  assert.equal(CHARACTERS.goalie, 'Robo Goalie');
  assert.ok(spawnSymbol({ kind: 'enemy', type: 'goalie' }));
  assert.equal(spawnColor({ kind: 'enemy', type: 'goalie' }), '#27a6b0');
  assert.ok(GUIDE.flatMap(chapter => chapter.sections).some(([, , picture]) => picture === 'enemy:goalie'));
  for (const level of LEVELS.filter(level => ['1', '2'].includes(level.worldId))) {
    assert.ok(!level.enemies.some(([, type]) => type === 'goalie'));
    assert.ok(!(level.events ?? []).some(event => event.type === 'goalie'));
    assert.ok(!level.brickTypes.some(brick => brick.spawner?.type === 'goalie'));
    assert.ok(!level.cutscene?.lines.some(line => line.speaker === 'goalie'));
  }
});

for (const options of [{}, { portrait: true, scale: .31 }]) {
  for (const edge of ['top', 'bottom', 'left', 'right']) {
    test(`goalie moves at 67.5 units/s, stays at the ${edge} goal, and saves swept shots (${options.portrait ? 'portrait' : 'landscape'})`, () => {
      const game = arena(options, edge), enemy = goalie(game), area = game.goalieArea(enemy);
      parkCat(game);
      game.placeGoalie(enemy, area, (area.start + area.end) / 2);
      const start = along(area, enemy), target = Math.min(area.end, start + 60);
      shot(game, area, target);
      game.moveGoalie(enemy, .1);
      near(along(area, enemy), start + 6.75);
      near(area.vertical ? enemy.x : enemy.y, area.normal);
      assert.ok(along(area, enemy) >= area.start && along(area, enemy) <= area.end);
      game.soccerBalls = [];
      game.moveGoalie(enemy, .1);
      near(along(area, enemy), start + Math.sin(.3) * 5, 'idle sways around center');
      const ball = shot(game, area, start, 70, 500);
      game.update(.3);
      assert.equal(game.goals, 0, 'interception prevents scoring');
      assert.ok((area.vertical ? ball.vx : ball.vy) * area.inward > 0, 'ball rebounds into the arena');
      assert.equal(game.hearts, 3);
      game.weapon = { type: 'wood', uses: 1, expires: Infinity };
      game.cat.x = enemy.x; game.cat.y = enemy.y;
      game.combat(1 / 120, game.cat.x, game.cat.y);
      assert.equal(game.robots.length, 0); assert.equal(game.enemies, 1);
      parkCat(game); game.soccerBalls = [];
      shot(game, area, start, 70, 500);
      game.update(.3);
      assert.equal(game.goals, 1, 'the same shot scores after destroying the goalie');
    });
  }
}

test('goalie chooses nearest goal, guards current merged mouth, and changes goals when its old goal is removed', () => {
  const game = arena({}, 'top'), regions = brickRegions(game.bricks, game.width, game.height);
  for (const brick of game.bricks) if (regions.get(brick.id).edge === 'bottom') brick.kind = 'goal';
  const enemy = goalie(game, { x: .5, y: .9 });
  const bottomArea = game.goalieArea(enemy);
  assert.ok(bottomArea.inward < 0);
  const owner = game.bricks.find(brick => brick.id === enemy.goalId);
  const neighbor = game.bricks.find(brick => brick.id !== owner.id && regions.get(brick.id).edge === 'bottom');
  neighbor.absorbedBy = owner.id;
  const merged = game.goalieArea(enemy);
  assert.ok(merged.end - merged.start >= bottomArea.end - bottomArea.start);
  for (const brick of game.bricks) if (regions.get(brick.id).edge === 'bottom') brick.kind = 'cinder';
  game.moveGoalie(enemy, .01);
  assert.ok(game.goalieArea(enemy).inward > 0);
});

test('custom goalie placements stay at their markers and travel gradually to goals on every edge and layout', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const game = arena(options, edge);
      parkCat(game);
      const point = game.pointFromRelative(.4, .4);
      const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'goalie', x: .4, y: .4 })[0];
      assert.equal(enemy.x, point.x); assert.equal(enemy.y, point.y);
      game.robots.push(enemy);
      const area = game.goalieArea(enemy);
      const gap = () => Math.abs((area.vertical ? enemy.x : enemy.y) - area.normal);
      const before = gap();
      game.update(.1);
      assert.ok(Math.hypot(enemy.x - point.x, enemy.y - point.y) <= 6.75 + 1e-7);
      assert.ok(gap() < before && gap() > 1, 'approaches without snapping to goal');
      const paused = { x: enemy.x, y: enemy.y };
      game.pause(); game.update(10);
      assert.deepEqual({ x: enemy.x, y: enemy.y }, paused);
      game.resume(); game.collectItem({ type: 'music-box' }); game.update(.1);
      assert.deepEqual({ x: enemy.x, y: enemy.y }, paused, 'sleep also freezes travel');
      game.enemiesSleepUntil = 0;
      game.update(25);
      near(gap(), 0);
      assert.ok(along(area, enemy) >= area.start && along(area, enemy) <= area.end);
    }
  }
});

test('random goalie schedules and spawners retain normal safe random locations instead of goal positions', () => {
  const game = arena();
  Object.assign(game.cat, game.pointFromRelative(.1, .8));
  const area = game.goalieArea({ ...game.cat, radius: 23 });
  const enemies = game.createEnemies([0, 'goalie', 2]);
  for (const enemy of enemies) {
    assert.ok(game.enemySpawnClear(enemy), 'normal random-spawn safety applies');
    assert.ok(Math.abs((area.vertical ? enemy.x : enemy.y) - area.normal) > 1);
  }
  game.robots.push(...enemies);
  const brick = game.bricks.find(brick => brick.kind !== 'goal');
  brick.spawner = { kind: 'enemy', type: 'goalie' };
  game.spawnFromBrick(brick);
  const spawned = game.robots.at(-1);
  assert.equal(spawned.type, 'goalie');
  assert.ok(game.enemySpawnClear(spawned));
  assert.ok(Math.abs((area.vertical ? spawned.x : spawned.y) - area.normal) > 1);
});

test('removing a defended goal makes the goalie travel from its current location to the nearest remaining goal', () => {
  const game = arena({}, 'top'), regions = brickRegions(game.bricks, game.width, game.height);
  for (const brick of game.bricks) if (regions.get(brick.id).edge === 'bottom') brick.kind = 'goal';
  const enemy = goalie(game, { x: .5, y: .1 });
  const oldId = enemy.goalId, position = { x: enemy.x, y: enemy.y };
  for (const brick of game.bricks) if (regions.get(brick.id).edge === 'top') brick.kind = 'cinder';
  const replacement = game.goalieArea(enemy);
  assert.notEqual(replacement.id, oldId);
  game.update(.1);
  assert.equal(enemy.goalId, replacement.id);
  assert.ok(Math.hypot(enemy.x - position.x, enemy.y - position.y) <= 6.75 + 1e-7);
  assert.ok(enemy.y > position.y && enemy.y < replacement.normal - 10);
  game.update(15);
  near(enemy.y, replacement.normal);
  assert.equal(game.enemyDeaths.length, 0, 'survives while another goal exists');
});

test('overlapping live and defeated goalies draw from highest to lowest without changing simulation order', () => {
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('function robotDrawOrder('), source.indexOf('function render(')), context);
  for (const deathProgress of [undefined, .5]) {
    const low = { type: 'goalie', y: 300, deathProgress };
    const high = { type: 'goalie', y: 100, deathProgress };
    const middle = { type: 'goalie', y: 200, deathProgress };
    const mouse = { type: 'mouse', y: 500 };
    const robots = [low, mouse, high, middle];
    const original = [...robots];
    const ordered = context.robotDrawOrder(robots);
    assert.deepEqual(Array.from(ordered), [high, mouse, middle, low]);
    assert.deepEqual(robots, original);
    high.y = 400;
    assert.deepEqual(Array.from(context.robotDrawOrder(robots)), [middle, mouse, low, high], 'order updates as goalies move');
  }
  assert.match(source, /for \(const enemy of robotDrawOrder\(visibleRobots\)\)/);
  assert.match(source, /for \(const enemy of robotDrawOrder\(game\.enemyDeaths\.filter\(visibleRobot\)\)\)/);
  const game = arena({}, null), calls = [];
  game.robots = [
    { type: 'goalie', x: 100, y: 300 }, { type: 'mouse', x: 100, y: 500 },
    { type: 'goalie', x: 100, y: 100 }, { type: 'goalie', x: 100, y: 200 },
  ];
  game.enemyDeaths = game.robots.map(enemy => ({ ...enemy, deathProgress: .5 }));
  const original = [...game.robots], deaths = [...game.enemyDeaths];
  const makeContext = () => new Proxy({}, {
    get(target, property) { return property in target ? target[property] : () => {}; },
  });
  const rendering = vm.createContext({
    game, boardCtx: makeContext(), actorCtx: makeContext(), ctx: null, trail: [], ending: null,
    canvas: { width: game.width, height: game.height }, board: { clientWidth: game.width, clientHeight: game.height },
    document: { querySelector: () => ({ style: {} }) }, buttons: [],
    drawCat() {}, drawWornCape() {}, drawMusicStream() {}, drawSunglassesStream() {}, drawCapeStream() {}, drawMaskStream() {}, line() {},
    drawRobot(enemy) { calls.push(['alive', enemy.y]); },
    drawEnemyDeath(enemy) { calls.push(['dead', enemy.y]); },
  });
  vm.runInContext(source.slice(source.indexOf('function powerupStreamRows('), source.indexOf('\nfunction drawSpawnCue')), rendering);
  rendering.render(0);
  assert.deepEqual(calls, [
    ['alive', 100], ['alive', 500], ['alive', 200], ['alive', 300],
    ['dead', 100], ['dead', 500], ['dead', 200], ['dead', 300],
  ]);
  assert.deepEqual(game.robots, original);
  assert.deepEqual(game.enemyDeaths, deaths);
});

test('goalie proactively tracks nearby balls but prioritizes the earliest incoming shot', () => {
  const game = arena(), enemy = goalie(game), area = game.goalieArea(enemy);
  const center = (area.start + area.end) / 2;
  game.placeGoalie(enemy, area, center);
  shot(game, area, center - 30, 100, -300);
  shot(game, area, center - 30, 100, 40);
  shot(game, area, area.end + enemy.radius + 20, 100, 400);
  game.moveGoalie(enemy, .1); near(along(area, enemy), center - 6.75);
  game.placeGoalie(enemy, area, center);
  shot(game, area, center - 30, 150, 400);
  shot(game, area, center + 30, 80, 400);
  game.moveGoalie(enemy, .1); near(along(area, enemy), center + 6.75);
});

test('idle goalies continuously sway within five units of center on every goal orientation', () => {
  for (const edge of ['top', 'bottom', 'left', 'right']) {
    const game = arena({}, edge), enemy = goalie(game), area = game.goalieArea(enemy);
    const center = (area.start + area.end) / 2;
    game.placeGoalie(enemy, area, center);
    const positions = [];
    for (let i = 0; i < 720; i++) {
      enemy.age = i / 120;
      const previous = along(area, enemy);
      game.moveGoalie(enemy, 1 / 120);
      const current = along(area, enemy);
      assert.ok(Math.abs(current - previous) > 1e-8, 'idle movement does not stop');
      assert.ok(Math.abs(current - center) <= 5 + 1e-8);
      assert.ok(Math.abs(current - previous) <= 67.5 / 120 + 1e-8);
      positions.push(current);
    }
    assert.ok(Math.max(...positions) > center + 4.9);
    assert.ok(Math.min(...positions) < center - 4.9);
  }
});

test('goalies track stationary nearby balls, lead sideways rolling balls with friction, and ignore distant balls', () => {
  for (const edge of ['top', 'left']) {
    const game = arena({}, edge), enemy = goalie(game), area = game.goalieArea(enemy);
    const center = (area.start + area.end) / 2;
    game.placeGoalie(enemy, area, center);
    const ball = shot(game, area, center + 40, 100, 0);
    game.moveGoalie(enemy, .1);
    near(along(area, enemy), center + 6.75, 'tracks stationary nearby ball');
    game.placeGoalie(enemy, area, center);
    if (area.vertical) { ball.y = center - 10; ball.vy = 100; }
    else { ball.x = center - 10; ball.vx = 100; }
    game.moveGoalie(enemy, .1);
    near(along(area, enemy), center + 6.75, 'moves toward future position rather than current position');
    game.placeGoalie(enemy, area, center);
    if (area.vertical) { ball.x = area.normal + area.inward * 300; ball.y = center + 40; }
    else { ball.y = area.normal + area.inward * 300; ball.x = center + 40; }
    game.moveGoalie(enemy, .1);
    near(along(area, enemy), center + Math.sin(.3) * 5, 'distant sideways ball leaves idle sway');
  }
});

test('goalie contact never hurts Koshi; shields, swords and Boost use normal combat rules', () => {
  for (const attack of ['unarmed', 'sword', 'boost']) {
    const game = arena(), enemy = goalie(game, { x: .5, y: .5 }, attack === 'sword' ? 'red' : null);
    game.cat.x = enemy.x; game.cat.y = enemy.y;
    if (attack === 'sword') game.weapon = { type: 'silver', uses: 5, expires: Infinity };
    if (attack === 'boost') game.boosted = true;
    game.combat(.001, game.cat.x, game.cat.y);
    assert.equal(game.hearts, 3);
    if (attack === 'unarmed') {
      assert.equal(game.robots.length, 1); assert.equal(game.enemies, 0);
    } else if (attack === 'sword') {
      assert.equal(enemy.shield, null); assert.equal(game.weapon.uses, 4);
      game.elapsed = 1.01;
      game.cat.x = enemy.x; game.cat.y = enemy.y;
      game.combat(.001, game.cat.x, game.cat.y);
      assert.equal(game.robots.length, 0); assert.equal(game.enemies, 2);
    } else {
      assert.equal(game.robots.length, 0); assert.equal(game.enemies, 1);
    }
  }
});

test('no goal means immediate visual death without points, shield hits, ball saves or harm', () => {
  const game = arena({}, null), enemy = goalie(game, { x: .5, y: .5 }, 'blue');
  game.weapon = { type: 'wood', uses: 1, expires: Infinity };
  game.update(.01);
  assert.equal(game.robots.length, 0); assert.equal(game.enemyDeaths.length, 1);
  assert.equal(game.enemies, 0); assert.equal(game.hearts, 3); assert.equal(game.weapon.uses, 1);
  assert.equal(game.enemyDeaths[0].shield, enemy.shield);
  const age = game.enemyDeaths[0].deathProgress;
  game.pause(); game.update(10);
  assert.equal(game.enemyDeaths[0].deathProgress, age);
  game.resume(); game.update(1.8);
  assert.equal(game.enemyDeaths.length, 0);
  const another = goalie(game);
  game.update(.01);
  assert.equal(game.enemyDeaths.length, 1); assert.equal(game.enemyDeaths[0].x, another.x);
  game.reset(); assert.equal(game.enemyDeaths.length, 0); assert.equal(game.robots.length, 0);
});

test('sleep freezes defense, fear retreats along the goal, and pause freezes all movement', () => {
  const game = arena(), enemy = goalie(game), area = game.goalieArea(enemy);
  game.placeGoalie(enemy, area, (area.start + area.end) / 2);
  const start = { x: enemy.x, y: enemy.y };
  game.collectItem({ type: 'music-box' });
  game.collectItem({ type: 'spooky-mask' });
  game.update(1);
  assert.deepEqual({ x: enemy.x, y: enemy.y }, start);
  game.enemiesSleepUntil = 0;
  game.cat.x = area.vertical ? game.width / 2 : enemy.x - 50;
  game.cat.y = area.vertical ? enemy.y - 50 : game.height / 2;
  game.update(.1);
  near(along(area, enemy) - along(area, start), 6.4);
  near(area.vertical ? enemy.x : enemy.y, area.normal);
  const position = { x: enemy.x, y: enemy.y };
  game.pause(); game.update(20);
  assert.deepEqual({ x: enemy.x, y: enemy.y }, position);
});

test('scheduled and brick-spawned goalies without goals die on arrival, and removal of the last goal kills its guard', () => {
  const custom = { ...blank(), events: [{ time: 1, kind: 'enemy', type: 'goalie', x: .5, y: .5 }],
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'enemy', type: 'goalie' } }] };
  const game = new Game(() => .5, { customLevel: custom });
  game.start(); game.update(.99);
  assert.equal(game.robots.length, 0); assert.equal(game.enemyDeaths.length, 0);
  game.update(.01);
  assert.equal(game.robots.length, 0); assert.equal(game.enemyDeaths.length, 1);
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  game.update(.01);
  assert.equal(game.robots.length, 0); assert.equal(game.enemyDeaths.length, 2);
  assert.equal(game.enemies, 0);
  const defended = arena(), guard = goalie(defended);
  for (const brick of defended.bricks) if (brick.kind === 'goal') brick.kind = 'cinder';
  defended.update(.01);
  assert.equal(defended.robots.length, 0);
  assert.equal(defended.enemyDeaths[0].goalId, guard.goalId);
  assert.equal(defended.enemies, 0);
});

test('goalie defeat animation continues after victory or loss for its full 1.8 seconds', () => {
  for (const terminal of ['won', 'lost']) {
    const game = arena(), enemy = goalie(game);
    game.defeatEnemy(enemy); game.robots = [];
    game.state = terminal;
    game.update(.54);
    near(game.enemyDeaths[0].deathProgress, .3);
    game.update(.54);
    near(game.enemyDeaths[0].deathProgress, .6);
    game.update(.7);
    assert.equal(game.enemyDeaths.length, 1);
    game.update(.02);
    assert.equal(game.enemyDeaths.length, 0);
    assert.equal(game.elapsed, 0);
  }
});

test('a goalie displaced by other robots moves back toward its goal without teleporting', () => {
  const game = arena(), enemy = goalie(game), area = game.goalieArea(enemy);
  game.robots.push(game.createCustomSpawn({ kind: 'enemy', type: 'mouse', x: .5, y: .5 })[0]);
  Object.assign(game.robots[1], { x: enemy.x, y: enemy.y });
  game.update(.05);
  game.robots = [enemy];
  const start = { x: enemy.x, y: enemy.y };
  const distance = Math.abs((area.vertical ? enemy.x : enemy.y) - area.normal);
  game.moveGoalie(enemy, .1);
  assert.ok(Math.hypot(enemy.x - start.x, enemy.y - start.y) <= 6.75 + 1e-8);
  assert.ok(Math.abs((area.vertical ? enemy.x : enemy.y) - area.normal) < distance);
});

test('crowded goalies yield to a stable leader tracking a nearby ball on every edge and layout', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const game = arena(options, edge);
      const goals = game.bricks.filter(brick => brick.kind === 'goal');
      for (const brick of goals.slice(1)) brick.absorbedBy = goals[0].id;
      const leader = goalie(game, { x: .5, y: .7 });
      const guards = [leader, ...Array.from({ length: 3 }, () => goalie(game, { x: .5, y: .3 }))];
      const area = game.goalieArea(leader), start = area.start + Math.min(35, (area.end - area.start) / 4);
      guards.forEach((guard, index) => game.placeGoalie(guard, area, start + index * 46));
      shot(game, area, start + 170, 100, 0);
      const before = along(area, leader), expected = { ...leader };
      for (let tick = 0; tick < 60; tick++) {
        expected.age += 1 / 120;
        game.moveGoalie(expected, 1 / 120);
      }
      game.update(.5);
      assert.ok(along(area, leader) - before > 1, `${edge}: leader must respond to the nearby ball`);
      near(along(area, leader), along(area, expected), `${edge}: crowd must not cancel the leader's response`);
      game.soccerBalls = [];
      game.update(3);
      for (let i = 0; i < guards.length; i++) {
        for (let j = i + 1; j < guards.length; j++) {
          const separation = Math.hypot(guards[i].x - guards[j].x, guards[i].y - guards[j].y);
          assert.ok(separation >= 46 - 2 * 135 / 120 - 1e-5,
            `${edge}: residual overlap must stay within one tick of bounded separation`);
        }
      }
      assert.ok(game.robots.includes(leader));
      const positions = guards.map(guard => ({ x: guard.x, y: guard.y }));
      game.collectItem({ type: 'music-box' }); game.update(.5);
      assert.deepEqual(guards.map(guard => ({ x: guard.x, y: guard.y })), positions);
    }
  }
});

test('a goalie trapped against the boundary yields inward without moving the higher-priority goalie backward', () => {
  const game = arena({}, 'top'), leader = goalie(game, { x: .5, y: .7 });
  const other = goalie(game, { x: .5, y: .3 }), bounds = game.bounds();
  Object.assign(leader, { x: bounds.right - 40, y: bounds.top });
  Object.assign(other, { x: bounds.right, y: bounds.top });
  const position = { x: leader.x, y: leader.y };
  game.separateEnemyPair(leader, other, -1, 0, 6.0000001);
  assert.deepEqual({ x: leader.x, y: leader.y }, position);
  assert.ok(other.y > bounds.top, 'blocked guard makes room toward the arena');
  assert.ok(Math.hypot(leader.x - other.x, leader.y - other.y) >= 46 - 1e-7);
});

test('equal-depth goalies keep spawn-order push priority and crowded idle guards still sway', () => {
  const game = arena(), guards = Array.from({ length: 4 }, () => goalie(game));
  const leader = guards[0], area = game.goalieArea(leader);
  guards.forEach(guard => game.placeGoalie(guard, area, (area.start + area.end) / 2));
  game.update(.1);
  const before = { x: leader.x, y: leader.y };
  game.update(.3);
  assert.ok(Math.hypot(leader.x - before.x, leader.y - before.y) > 1);
  game.update(3);
  for (const guard of guards.slice(1)) {
    assert.ok(Math.hypot(leader.x - guard.x, leader.y - guard.y) >= 46 - 1e-5);
  }
});

test('goalie total displacement stays below 135 units/s through crowd and boundary pushes', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const game = arena(options, edge), bounds = game.bounds();
      const guards = Array.from({ length: 6 }, () => goalie(game));
      const area = game.goalieArea(guards[0]);
      guards.forEach(guard => game.placeGoalie(guard, area, area.end));
      for (const dt of [1 / 120, 1 / 60, .05]) {
        for (let frame = 0; frame < 20; frame++) {
          const positions = guards.map(guard => ({ x: guard.x, y: guard.y }));
          game.update(dt);
          guards.forEach((guard, index) => {
            const old = positions[index];
            assert.ok(Math.hypot(guard.x - old.x, guard.y - old.y) <= 135 * dt + 1e-7,
              `${edge}: combined motion and pushes must respect the speed cap`);
            assert.ok(guard.x >= bounds.left && guard.x <= bounds.right);
            assert.ok(guard.y >= bounds.top && guard.y <= bounds.bottom);
          });
        }
      }
      game.collectItem({ type: 'music-box' });
      guards.forEach(guard => game.placeGoalie(guard, area, area.start));
      const asleep = guards.map(guard => ({ x: guard.x, y: guard.y }));
      game.update(.1);
      assert.deepEqual(guards.map(guard => ({ x: guard.x, y: guard.y })), asleep);
    }
  }
});

function drawAt(progress) {
  const operations = [], colors = [];
  const stack = [];
  const ctx = new Proxy({ globalAlpha: 1, fillStyle: '', strokeStyle: '',
    createLinearGradient: () => ({ addColorStop: (...args) => colors.push(args) }),
    save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); },
  }, { get(target, key) {
    if (key in target) return target[key];
    return (...args) => operations.push({ name: key, args, alpha: target.globalAlpha, color: target.fillStyle });
  } });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawRoboGoalie('), source.indexOf('function drawRoboBucket(')), context);
  context.drawRoboGoalie({ type: 'goalie', age: 0, x: 0, y: 0 }, progress);
  return { operations, colors };
}

test('goalie artwork has an egg shell, three antenna hairs, a long nose, stripes and badges; death drops jersey then blushes and explodes', () => {
  const alive = drawAt(null);
  assert.equal(alive.operations.filter(op => op.name === 'lineTo' && op.args[1] <= -37).length, 3);
  assert.ok(alive.operations.some(op => op.name === 'bezierCurveTo' && op.args[3] === 7), 'long nose');
  for (const color of ['#27a6b0', '#f5cf5c', '#de5275']) {
    assert.ok(alive.operations.some(op => op.color === color && op.name === 'fillRect'), 'striped jersey');
  }
  assert.ok(alive.operations.some(op => op.name === 'arc' && op.args[2] === 4.5), 'badge');
  const falling = drawAt(.2);
  assert.ok(falling.operations.some(op => op.name === 'translate' && op.args[1] > 20), 'shirt falls down');
  assert.ok(!falling.colors.some(([, color]) => color === '#e85c9c'), 'pink comes after shirt falls');
  const embarrassed = drawAt(.5);
  assert.ok(embarrassed.colors.some(([, color]) => color === '#e85c9c'));
  assert.ok(embarrassed.operations.filter(op => op.color === '#27a6b0').every(op => op.alpha <= 0), 'jersey gone exposes mechanical panels');
  for (const op of embarrassed.operations) assert.ok(op.alpha >= 0 && op.alpha <= 1, 'canvas alpha stays in its valid range');
  assert.ok(embarrassed.operations.some(op => op.name === 'roundRect'), 'plain mechanical shell panel');
  const explosion = drawAt(.8);
  assert.ok(explosion.operations.some(op => op.name === 'arc' && op.color === '#ffb55c'));
  assert.equal(explosion.operations.filter(op => op.name === 'fillRect' && op.args[2] === 6).length, 10, 'robot fragments');
  assert.match(source, /enemy.type === 'goalie'[\s\S]*?drawRoboGoalie/);
  assert.match(source.slice(source.indexOf('function drawEnemyDeath(')), /enemy.type === 'goalie'[\s\S]*?drawRobot\(enemy, progress\)/);
});
