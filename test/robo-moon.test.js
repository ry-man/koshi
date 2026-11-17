const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, CHARACTERS, INFO_GRAPHICS, validateCustomLevel, brickRegions } = require('../src/game.js');
const { spawnSymbol } = require('../src/brick-visuals.js');
const { GUIDE, LESSONS, Tutorial } = require('../src/learning.js');

const level = events => ({
  version: 1, id: 'Moon test', duration: 60, goal: 1000,
  heartCost: null, brickSet: 1, events,
});
function arena(options = {}) {
  const game = new Game(() => .5, { customLevel: level([]), ...options });
  game.start();
  return game;
}
function moon(game, x = .3, y = .3) {
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'robo-moon', x, y })[0];
  game.robots.push(enemy);
  return enemy;
}
function flood(game, enemy) {
  enemy.moonState = 'wax';
  game.updateRoboMoon(enemy, .8, game.bounds());
  return enemy.moonTide;
}
function stepTide(game, seconds) {
  game.updateMoonTides(seconds, game.cat.x, game.cat.y);
}

test('Robo Moon is accepted in placements, spawners and cutscenes and has guide/practice artwork', () => {
  const data = validateCustomLevel({
    ...level([{ time: 0, kind: 'enemy', type: 'robo-moon', x: .3, y: .3 }]),
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'enemy', type: 'robo-moon' } }],
    cutscene: { theme: 'garden', lines: [{
      speaker: 'robo-moon', text: 'Moonrise!', actors: [{ character: 'robo-moon', x: .5, y: .5 }],
    }] },
  });
  assert.equal(CHARACTERS[data.events[0].type], 'Robo Moon');
  assert.equal(INFO_GRAPHICS['enemy:robo-moon'], 'Robo Moon');
  assert.ok(spawnSymbol(data.events[0]));
  assert.ok(GUIDE.flatMap(chapter => chapter.sections).some(([, , picture]) => picture === 'enemy:robo-moon'));
  const game = arena({ customLevel: data });
  const brick = game.bricks.find(brick => brick.spawner);
  game.spawnFromBrick(brick);
  assert.equal(game.robots[0].moonState, 'wander');
  const tutorial = new Tutorial();
  const practice = tutorial.select(LESSONS.findIndex(lesson => lesson.id === 'robo-moon'));
  assert.equal(practice.robots[0].type, 'robo-moon');
  assert.equal(practice.robots[0].moonFullness, 0);
});

test('moon wanders independently of Koshi, then stops, morphs smoothly and starts a tide', () => {
  const first = arena(), second = arena();
  const a = moon(first), b = moon(second);
  second.cat.x += 200;
  const start = { x: a.x, y: a.y };
  first.combat(.1, first.cat.x, first.cat.y);
  second.combat(.1, second.cat.x, second.cat.y);
  assert.deepEqual([a.x, a.y], [b.x, b.y]);
  assert.ok(Math.hypot(a.x - start.x, a.y - start.y) > 0);
  first.updateRoboMoon(a, 3.9, first.bounds());
  assert.equal(a.moonState, 'wax');
  const stopped = [a.x, a.y];
  first.updateRoboMoon(a, .2, first.bounds());
  assert.ok(a.moonFullness > 0 && a.moonFullness < .5);
  first.updateRoboMoon(a, .2, first.bounds());
  assert.equal(a.moonFullness, .5);
  assert.deepEqual([a.x, a.y], stopped);
  first.updateRoboMoon(a, .4, first.bounds());
  assert.equal(a.moonFullness, 1);
  assert.equal(a.moonGlow, 1);
  assert.equal(a.moonTide.state, 'rise');
  assert.equal(a.moonTide.progress, 0);
});

test('tide covers the perimeter bricks in both orientations without flooding the center', () => {
  for (const portrait of [false, true]) {
    const game = arena({ portrait }), enemy = moon(game), tide = flood(game, enemy);
    stepTide(game, 2);
    assert.equal(tide.progress, 1);
    const regions = brickRegions(game.bricks, game.width, game.height);
    for (const brick of game.bricks) {
      const edge = regions.get(brick.id).edge;
      const inner = edge === 'top' ? brick.y + brick.h : edge === 'bottom' ? game.height - brick.y
        : edge === 'left' ? brick.x + brick.w : game.width - brick.x;
      assert.ok(tide.depths[edge] >= inner + 12 - 1e-9);
    }
    const rects = game.moonWaterRects(tide);
    assert.equal(rects.length, 4);
    assert.ok(rects.every(rect => !(game.width / 2 >= rect.x && game.width / 2 <= rect.x + rect.w
      && game.height / 2 >= rect.y && game.height / 2 <= rect.y + rect.h)));
    assert.equal(game.hearts, 3);
  }
});

test('peak lasts one second, glow stops on retreat, and moon stays full until water is gone', () => {
  const game = arena(), enemy = moon(game), tide = flood(game, enemy);
  const stopped = [enemy.x, enemy.y];
  stepTide(game, 2);
  stepTide(game, .99);
  assert.equal(tide.state, 'hold');
  assert.equal(tide.progress, 1);
  assert.equal(enemy.moonGlow, 1);
  stepTide(game, .01);
  assert.equal(tide.state, 'retreat');
  assert.equal(enemy.moonGlow, 0);
  stepTide(game, .75);
  game.updateRoboMoon(enemy, .75, game.bounds());
  assert.equal(enemy.moonFullness, 1);
  assert.deepEqual([enemy.x, enemy.y], stopped);
  assert.ok(Math.abs(tide.progress - .5) < 1e-9);
  stepTide(game, .75);
  assert.equal(game.moonTides.length, 0);
  assert.equal(enemy.moonState, 'wane');
  game.updateRoboMoon(enemy, .4, game.bounds());
  assert.equal(enemy.moonFullness, .5);
  game.updateRoboMoon(enemy, .4, game.bounds());
  assert.equal(enemy.moonFullness, 0);
  assert.equal(enemy.moonState, 'wander');
  game.updateRoboMoon(enemy, .1, game.bounds());
  assert.notDeepEqual([enemy.x, enemy.y], stopped);
});

test('all four visible water bands hurt on contact and honor damage invulnerability', () => {
  for (const edge of ['left', 'right', 'top', 'bottom']) {
    const game = arena(), tide = flood(game, moon(game));
    stepTide(game, 2);
    const depth = tide.depths[edge];
    if (edge === 'left') game.cat.x = depth + game.cat.radius - 1;
    if (edge === 'right') game.cat.x = game.width - depth - game.cat.radius + 1;
    if (edge === 'top') game.cat.y = depth + game.cat.radius - 1;
    if (edge === 'bottom') game.cat.y = game.height - depth - game.cat.radius + 1;
    stepTide(game, .01);
    assert.equal(game.hearts, 2, edge);
    stepTide(game, .01);
    assert.equal(game.hearts, 2, `${edge}: invulnerability`);
  }
  const game = arena(), tide = flood(game, moon(game));
  stepTide(game, 2);
  game.cat.x = 40;
  tide.state = 'retreat';
  game.updateMoonTides(.1, game.cat.x, game.cat.y);
  assert.equal(game.hearts, 2, 'retreat remains hazardous');
});

test('swept water collision detects crossings even when Koshi finishes outside it', () => {
  const game = arena(), tide = flood(game, moon(game));
  stepTide(game, 2);
  game.updateMoonTides(.01, 10, game.cat.y);
  assert.equal(game.hearts, 2);
  assert.equal(tide.progress, 1);
});

test('defeating a moon immediately retreats only its own tide, which outlives the moon', () => {
  for (const advance of [.5, 2, 2.5]) {
    const game = arena(), a = moon(game), b = moon(game, .7, .7);
    const first = flood(game, a), second = flood(game, b);
    stepTide(game, advance);
    const peak = first.progress;
    game.cat.x = a.x; game.cat.y = a.y;
    game.weapon = { type: 'wood', uses: 3, expires: Infinity };
    game.combatEnemies(.01, game.cat.x, game.cat.y);
    assert.equal(game.robots.includes(a), false);
    assert.equal(game.enemies, 1);
    assert.equal(first.state, 'retreat');
    assert.equal(first.owner, null);
    assert.equal(first.progress, peak);
    assert.equal(a.moonGlow, 0);
    assert.notEqual(second.state, 'retreat');
    game.updateEnemyDeaths(2);
    assert.equal(game.enemyDeaths.length, 0);
    stepTide(game, .1);
    assert.ok(first.progress < peak);
    stepTide(game, 1.5);
    assert.ok(!game.moonTides.includes(first));
  }
});

test('sleep pauses tide/cycle, fear retreats it, restart clears it, and dormant moons keep their tides moving', () => {
  const game = arena(), enemy = moon(game), tide = flood(game, enemy);
  stepTide(game, .5);
  game.enemiesSleepUntil = 20;
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(tide.progress, .25);
  assert.equal(enemy.moonFullness, 1);
  game.enemiesSleepUntil = 0;
  game.maskPickup = { x: game.cat.x, y: game.cat.y };
  game.maskUntil = 20;
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(tide.state, 'retreat');
  assert.equal(enemy.moonGlow, 0);
  game.reset();
  assert.equal(game.moonTides.length, 0);

  const scrolling = arena({ customLevel: { ...level([]), autoscroll: { length: 24, speed: .5, events: [] } } });
  const distant = moon(scrolling, .95, .5), distantTide = flood(scrolling, distant);
  scrolling.combat(.1, scrolling.cat.x, scrolling.cat.y);
  assert.equal(distant.dormant, true);
  assert.ok(distantTide.progress > 0);
});

test('moon drawing morphs its silhouette, animates its face and shows an aura only while glowing', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const calls = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient') return () => {
        calls.push(['halo']);
        return { addColorStop() {} };
      };
      return (...args) => calls.push([key, ...args]);
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawRoboMoon('), source.indexOf('function drawRoboTrashBin(')), context);
  const draw = enemy => {
    calls.length = 0;
    context.drawRoboMoon(enemy);
    return calls.map(call => [...call]);
  };
  const crescent = draw({ age: 0, moonFullness: 0 });
  const moving = draw({ age: .2, moonFullness: 0 });
  assert.notDeepEqual(crescent.filter(([name]) => name === 'fillRect'), moving.filter(([name]) => name === 'fillRect'));
  const full = draw({ age: 0, moonFullness: 1, moonGlow: 1 });
  for (const age of [0, .2]) {
    const eyes = draw({ age, moonFullness: 1 }).filter(([name]) => name === 'fillRect');
    const left = eyes.filter(([, x]) => x < 0);
    const right = eyes.filter(([, x]) => x > 0);
    assert.deepEqual(right, left.map(([name, x, y, w, h]) => [name, -x - w, y, w, h]),
      'right eye mirrors the unchanged left eye, including its animated squint');
  }
  assert.notDeepEqual(crescent.filter(([name]) => name === 'bezierCurveTo'), full.filter(([name]) => name === 'bezierCurveTo'));
  assert.ok(full.some(([name]) => name === 'halo'));
  assert.ok(!draw({ age: 0, moonFullness: 1, moonGlow: 0 }).some(([name]) => name === 'halo'));
});

test('purple water has animated ripples along all four surfaces without changing its damage geometry', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const game = arena(), tide = flood(game, moon(game));
  stepTide(game, 2);
  const calls = [];
  const ctx = new Proxy({}, {
    get: (target, key) => key in target ? target[key] : (...args) => calls.push([key, ...args]),
    set(target, key, value) { target[key] = value; return true; },
  });
  const context = vm.createContext({ ctx, game });
  vm.runInContext(source.slice(source.indexOf('function drawMoonWater('), source.indexOf('function render(')), context);
  const draw = time => {
    game.elapsed = time;
    calls.length = 0;
    context.drawMoonWater();
    return calls.map(call => [...call]);
  };
  const first = draw(0), later = draw(.3);
  assert.equal(first.filter(([name]) => name === 'stroke').length, 4);
  assert.deepEqual(first.filter(([name]) => name === 'fillRect').map(call => call.slice(1)),
    game.moonWaterRects(tide).map(({ x, y, w, h }) => [x, y, w, h]));
  const points = calls => calls.filter(([name]) => name === 'lineTo');
  assert.notDeepEqual(points(first), points(later), 'ripples travel with game time');
  assert.deepEqual(draw(.3), later, 'ripples freeze when game time is paused');
  for (const [, x, y] of points(later)) {
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
    assert.ok(x <= tide.depths.left || x >= game.width - tide.depths.right
      || y <= tide.depths.top || y >= game.height - tide.depths.bottom, 'ripple stays in the water');
  }
  tide.progress = 0;
  assert.equal(points(draw(.3)).length, 0, 'no surface ripples after retreat');
});
