const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, LEVELS, CHARACTERS, validateCustomLevel } = require('../src/game.js');
const { spawnSymbol, spawnColor } = require('../src/brick-visuals.js');

function arena(options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: {
    version: 1, id: 'Crab tests', duration: 120, goal: 1000, heartCost: null, brickSet: 1, events: [],
  } });
  game.start();
  return game;
}

function crab(game, axis = 'x') {
  const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'robo-crab', x: .5, y: .5 })[0];
  enemy.crabAxis = axis;
  enemy.phase = axis === 'x' ? 0 : Math.PI / 2;
  return enemy;
}

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test('authored Crab direction round-trips and controls placements, formations, previews and both spawner locations', () => {
  for (const direction of ['horizontal', 'vertical']) {
    const game = arena(), axis = direction === 'horizontal' ? 'x' : 'y';
    const event = { time: 2, kind: 'enemy', type: 'robo-crab', x: .3, y: .5, crabDirection: direction,
      group: { shape: 'line', count: 2, angle: 90, size: .3 } };
    const custom = validateCustomLevel({ ...game.customLevel, events: [event],
      brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
        spawner: { kind: 'enemy', type: 'robo-crab', crabDirection: direction } }],
    });
    assert.equal(custom.events[0].crabDirection, direction);
    assert.equal(custom.brickTypes[0].spawner.crabDirection, direction);
    const preview = new Game(() => .5, { customLevel: JSON.parse(JSON.stringify(custom)) });
    preview.start(); preview.update(1.1);
    const pending = [...preview.pendingSpawns.values()].find(spawn => spawn.kind === 'enemy').items;
    assert.equal(pending.length, 2);
    assert.ok(pending.every(enemy => enemy.crabAxis === axis));
    preview.update(.9);
    assert.ok(pending.every(enemy => preview.robots.includes(enemy) && enemy.crabAxis === axis));
    const brick = preview.bricks.find(brick => brick.spawner);
    preview.spawnFromBrick(brick);
    assert.equal(preview.robots.at(-1).crabAxis, axis, 'random-position spawner respects direction');
    brick.spawner.x = .8; brick.spawner.y = .8;
    preview.spawnFromBrick(brick);
    assert.equal(preview.robots.at(-1).crabAxis, axis, 'fixed-position spawner respects direction');
    const scheduled = game.createEnemies([0, 'robo-crab', 1, null, { crabDirection: direction }])[0];
    assert.equal(scheduled.crabAxis, axis);
    scheduled.x = game.width / 2; scheduled.y = game.height / 2;
    const other = axis === 'x' ? 'y' : 'x', across = scheduled[other];
    game.updateRoboCrab(scheduled, .1, []);
    near(scheduled[other], across);
  }
});

test('Crab direction rejects invalid values and use on other types while omitted direction remains random', () => {
  const game = arena();
  for (const crabDirection of ['diagonal', 'random', 'x', '', null, 1]) {
    const event = { time: 0, kind: 'enemy', type: 'robo-crab', x: .3, y: .3, crabDirection };
    assert.throws(() => validateCustomLevel({ ...game.customLevel, events: [event] }), /invalid Robo Crab direction/);
    assert.throws(() => validateCustomLevel({ ...game.customLevel, brickTypes: [
      { edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'enemy', type: 'robo-crab', crabDirection } },
    ] }), /invalid Robo Crab direction/);
  }
  for (const [kind, type] of [['enemy', 'mouse'], ['item', 'battery']]) {
    assert.throws(() => validateCustomLevel({ ...game.customLevel,
      events: [{ time: 0, kind, type, x: .3, y: .3, crabDirection: 'horizontal' }],
    }), /invalid Robo Crab direction/);
  }
  for (const [random, axis] of [[.25, 'x'], [.75, 'y']]) {
    game.random = () => random;
    assert.equal(game.createCustomSpawn({ kind: 'enemy', type: 'robo-crab', x: .3, y: .3 })[0].crabAxis, axis);
  }
});

test('editor Crab direction supports creation, mixed selection, preservation, explicit clearing and type changes', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const inputs = new Map(), engine = require('../src/game.js');
  const $ = selector => {
    if (!inputs.has(selector)) inputs.set(selector, { value: '', dataset: {}, disabled: false,
      querySelector: () => null, replaceChildren() {}, prepend() {} });
    return inputs.get(selector);
  };
  const game = arena();
  const context = vm.createContext({ ...engine, $, MIXED: '', document: { createElement: () => ({}) },
    level: game.customLevel, selectedEvents: new Set(), touched: new Set(),
    common: values => values.every(value => value === values[0]) ? values[0] : '',
    selectedList: () => [...context.selectedEvents], mixedOption: input => { input.value = ''; },
    syncPalettes() {}, readOnly: () => false, validateDraft: validateCustomLevel,
    markChanged() {}, setSelection() {}, message() {}, plural: (count, word) => `${count} ${word}s` });
  vm.runInContext(source.slice(source.indexOf('function typeOptions('), source.indexOf('function description(')), context);
  vm.runInContext(source.slice(source.indexOf('function readEvent('), source.indexOf('function setSelection(')), context);
  vm.runInContext(source.slice(source.indexOf('function applyToSelected('), source.indexOf('function applyEventChanges(')), context);
  $('#event-kind').value = 'enemy'; $('#event-type').value = 'robo-crab';
  $('#event-crab-direction').value = 'vertical'; $('#event-shield').value = 'none';
  $('#event-time').value = '0'; $('#event-x').value = '30'; $('#event-y').value = '30';
  $('#event-location').value = 'fixed'; $('#event-formation').value = 'single';
  assert.equal(context.readEvent().crabDirection, 'vertical');
  context.typeOptions('robo-crab');
  assert.equal($('#crab-direction-label').hidden, false);
  context.level = { ...game.customLevel, events: [
    { time: 0, kind: 'enemy', type: 'robo-crab', x: .3, y: .3, crabDirection: 'vertical' },
    { time: 0, kind: 'enemy', type: 'robo-crab', x: .7, y: .7, crabDirection: 'horizontal' },
  ] };
  context.selectedEvents = new Set([0, 1]); context.populateEventForm();
  assert.equal($('#event-crab-direction').value, '');
  $('#event-time').value = '3'; context.touched.add('#event-time'); context.applyToSelected();
  assert.deepEqual(context.level.events.map(event => event.crabDirection), ['vertical', 'horizontal']);
  context.touched = new Set(['#event-crab-direction']); $('#event-crab-direction').value = 'horizontal';
  context.applyToSelected();
  assert.ok(context.level.events.every(event => event.crabDirection === 'horizontal'));
  $('#event-crab-direction').value = 'random'; context.applyToSelected();
  assert.ok(context.level.events.every(event => !Object.hasOwn(event, 'crabDirection')));
  $('#event-crab-direction').value = 'vertical'; context.applyToSelected();
  context.selectedEvents = new Set([0]); context.populateEventForm();
  assert.equal($('#event-crab-direction').value, 'vertical');
  context.touched = new Set(['#event-type']); $('#event-type').value = 'mouse';
  context.applyToSelected();
  assert.equal(Object.hasOwn(context.level.events[0], 'crabDirection'), false);
  context.typeOptions('mouse');
  assert.equal($('#crab-direction-label').hidden, true);
  assert.equal($('#event-crab-direction').disabled, true);
});

test('Crab supports custom placements, shields, spawners and previews without entering campaign schedules', () => {
  const game = arena();
  const custom = { ...game.customLevel,
    events: [{ time: 2, kind: 'enemy', type: 'robo-crab', x: .3, y: .7, shield: 'green' }],
    brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal',
      spawner: { kind: 'enemy', type: 'robo-crab', shield: 'red' } }],
  };
  assert.deepEqual(validateCustomLevel(custom), custom);
  const preview = new Game(() => .5, { customLevel: custom });
  preview.start(); preview.update(1.1);
  const reserved = [...preview.pendingSpawns.values()].find(p => p.kind === 'enemy').items[0];
  assert.equal(reserved.type, 'robo-crab');
  assert.equal(reserved.defeatPoints, 3);
  assert.equal(reserved.crabSpeedTime, 9);
  preview.update(.9);
  assert.equal(preview.robots[0], reserved);
  preview.spawnFromBrick(preview.bricks.find(b => b.spawner));
  assert.equal(preview.robots[1].type, 'robo-crab');
  assert.equal(preview.robots[1].defeatPoints, 2);
  const scheduled = game.createEnemies([0, 'robo-crab', 1])[0];
  assert.equal(scheduled.crabFast, false);
  assert.equal(scheduled.crabSpeedTime, 9);
  assert.equal(CHARACTERS['robo-crab'], 'Robo Crab');
  assert.match(spawnSymbol({ kind: 'enemy', type: 'robo-crab' }), /^M/);
  assert.equal(spawnColor({ kind: 'enemy', type: 'robo-crab' }), '#929ba1');
  assert.ok(LEVELS.every(level => !level.enemies.some(([, type]) => type === 'robo-crab')));
  const editor = fs.readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  assert.match(editor, /'robo-crab': \{ name: 'Robo Crab' \}/);
  const { GUIDE } = require('../src/learning.js');
  assert.ok(GUIDE.some(page => page.sections.some(section => section[2] === 'enemy:robo-crab')));
});

for (const options of [{}, { portrait: true, scale: .3 }]) {
  for (const axis of ['x', 'y']) {
    test(`Crab shuffles on its ${axis} axis and reverses at both walls ${JSON.stringify(options)}`, () => {
      const game = arena(options), enemy = crab(game, axis);
      const other = axis === 'x' ? 'y' : 'x', across = enemy[other], start = enemy[axis];
      game.updateRoboCrab(enemy, .1, []);
      near(enemy[axis] - start, 4.5);
      near(enemy[other], across);
      const bounds = game.bounds();
      const low = axis === 'x' ? bounds.left : bounds.top;
      const high = axis === 'x' ? bounds.right : bounds.bottom;
      for (const [position, direction] of [[high - 1, 1], [low + 1, -1]]) {
        enemy[axis] = position;
        enemy.phase = (axis === 'x' ? 0 : Math.PI / 2) + (direction < 0 ? Math.PI : 0);
        game.updateRoboCrab(enemy, .1, []);
        const velocity = axis === 'x' ? Math.cos(enemy.phase) : Math.sin(enemy.phase);
        assert.ok(velocity * direction < 0, 'wall reverses patrol');
        assert.ok(enemy[axis] >= low && enemy[axis] <= high);
        near(enemy[other], across);
      }
      assert.ok(enemy.crabStride > 0);
      assert.equal(enemy.resting, false);
    });
  }
}

test('Crab alternates exact speeds with independently random 3-to-15-second intervals, including a split tick', () => {
  const game = arena(), enemy = crab(game), x = enemy.x;
  enemy.crabSpeedTime = 3;
  game.random = () => 1;
  game.updateRoboCrab(enemy, 3, []);
  near(enemy.x - x, 45 * 3);
  assert.equal(enemy.crabFast, true);
  assert.equal(enemy.crabSpeedTime, 15);
  const fastX = enemy.x;
  game.updateRoboCrab(enemy, .2, []);
  near(enemy.x - fastX, 30);
  enemy.crabSpeedTime = .1;
  game.random = () => 0;
  const splitX = enemy.x;
  game.updateRoboCrab(enemy, .2, []);
  near(enemy.x - splitX, 150 * .1 + 45 * .1);
  assert.equal(enemy.crabFast, false);
  near(enemy.crabSpeedTime, 2.9);
  for (const value of [0, .25, .75, 1]) {
    game.random = () => value;
    game.initializeRoboCrab(enemy);
    assert.equal(enemy.crabAxis, value < .5 ? 'x' : 'y');
    assert.equal(enemy.crabSpeedTime, 3 + value * 12);
  }
});

test('Crab turns back from fences, bumpers, obstructions and enemy contacts without choosing a diagonal', () => {
  const game = arena(), enemy = crab(game);
  const x = enemy.x, y = enemy.y;
  const fence = { x: x + 24, y: y - 100, w: 4, h: 200 };
  game.updateRoboCrab(enemy, .2, [fence]);
  assert.ok(Math.cos(enemy.phase) < 0); near(enemy.y, y);
  enemy.x = x; enemy.phase = 0;
  game.bumpers.push(game.createBumper({ x: x + 50, y: y + 10 }, 'bumper-red'));
  enemy.x += 20;
  game.blockEnemyWithBumpers(enemy, { x, y });
  assert.ok(Math.cos(enemy.phase) < 0); near(Math.sin(enemy.phase), 0);
  game.bumpers = [];
  enemy.x = x; enemy.y = y; enemy.phase = 0;
  game.obstructions.push(game.createObstruction({ x: x + 100, y: y + 10 }, { type: 'obstruction-circle' }));
  enemy.x += 40;
  game.blockEnemyWithObstructions(enemy, { x, y });
  assert.ok(Math.cos(enemy.phase) < 0); near(enemy.y, y);
  const reversed = enemy.phase;
  game.blockEnemyWithObstructions(enemy, { x, y });
  assert.equal(enemy.phase, reversed, 'repeat collision pass must not undo the turn');
  enemy.phase = 0;
  game.turnEnemyFromContact(enemy, -.6, .8);
  near(Math.cos(enemy.phase), -1); near(Math.sin(enemy.phase), 0);
});

test('Sleep, fear and pause suspend the speed timer; patrol resumes on its original axis', () => {
  const game = arena(), enemy = crab(game);
  game.robots = [enemy]; game.cat.x = game.bounds().right; game.cat.y = game.bounds().bottom;
  game.collectItem({ type: 'music-box' });
  const start = [enemy.x, enemy.y, enemy.crabStride, enemy.crabSpeedTime];
  game.update(.2);
  assert.deepEqual([enemy.x, enemy.y, enemy.crabStride, enemy.crabSpeedTime], start);
  game.enemiesSleepUntil = 0;
  game.collectItem({ type: 'spooky-mask' });
  const distance = Math.hypot(enemy.x - game.cat.x, enemy.y - game.cat.y);
  game.update(.1);
  assert.ok(Math.hypot(enemy.x - game.cat.x, enemy.y - game.cat.y) > distance);
  assert.equal(enemy.crabSpeedTime, start[3]);
  assert.ok(enemy.crabStride > start[2], 'legs still shuffle while fleeing');
  game.pause(); const position = [enemy.x, enemy.y]; game.update(1);
  assert.deepEqual([enemy.x, enemy.y], position);
  game.resume(); game.maskUntil = 0;
  const y = enemy.y;
  game.update(.1);
  near(enemy.y, y);
  near(enemy.crabSpeedTime, start[3] - .1);
});

test('Crab uses normal damage and sword defeats and a paused 1.5-second death', () => {
  const game = arena(), enemy = crab(game);
  game.robots = [enemy];
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.hearts, 2);
  game.weapon = { type: 'silver', uses: 5, expires: Infinity };
  game.combat(0, game.cat.x, game.cat.y);
  assert.equal(game.enemies, 1); assert.equal(game.robots.length, 0);
  assert.equal(game.enemyDeaths[0].type, 'robo-crab');
  game.pause(); game.update(.5);
  assert.equal(game.enemyDeaths[0].deathProgress, 0);
  game.resume(); game.update(.75);
  near(game.enemyDeaths[0].deathProgress, .5);
  game.update(.76);
  assert.equal(game.enemyDeaths.length, 0);
});

test('Crab artwork animates legs, blinking pixel eyes, pincers, both speed warnings and flying death parts with fading smoke', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const calls = [], stack = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'save') return () => stack.push({ ...target });
      if (name === 'restore') return () => Object.assign(target, stack.pop());
      return (...args) => calls.push({ name, args, fill: target.fillStyle, alpha: target.globalAlpha });
    },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawRoboCrab('), source.indexOf('function drawRoboSnail(')), context);
  const draw = (enemy = {}, progress = null, damage = null) => {
    calls.length = 0;
    context.drawRoboCrab({ age: 0, crabStride: 0, crabSpeedTime: 9, ...enemy }, progress, damage);
    assert.equal(stack.length, 0); assert.equal(ctx.globalAlpha, 1);
    assert.ok(calls.every(call => call.args.every(value => typeof value !== 'number' || Number.isFinite(value))));
    return calls.slice();
  };
  const live = draw();
  for (const color of ['#929ba1', '#d33c43', '#79f58a']) {
    assert.ok(live.some(call => ['fill', 'fillRect'].includes(call.name) && call.fill === color));
  }
  const pixels = frame => frame.filter(call => call.name === 'fillRect' && call.fill === '#79f58a').length;
  assert.ok(pixels(draw({ age: 3.9 })) < pixels(live), 'green pixel eyes blink');
  assert.notDeepEqual(draw({ crabStride: 1 }).filter(call => call.name === 'lineTo'), live.filter(call => call.name === 'lineTo'), 'legs shuffle');
  assert.notDeepEqual(draw({ age: .3 }).filter(call => call.name === 'rotate'), live.filter(call => call.name === 'rotate'), 'pincers open and close');
  const gape = frame => frame.filter(call => call.name === 'quadraticCurveTo').length;
  assert.equal(gape(live), 0);
  for (const crabFast of [false, true]) {
    assert.ok(gape(draw({ crabSpeedTime: .64, crabFast })) > 0, 'both speed changes have a warning');
  }
  assert.equal(gape(draw({ crabSpeedTime: .66 })), 0, 'warning does not start early');
  assert.equal(gape(draw({ crabSpeedTime: .5, asleep: true })), 0, 'sleep hides the warning');
  assert.ok(draw({}, null, '#ffffff').some(call => call.name === 'fill' && call.fill === '#ffffff'));
  const early = draw({}, .2), late = draw({}, .9);
  const parts = frame => frame.filter(call => call.name === 'translate');
  assert.notDeepEqual(parts(early), parts(late), 'eyes and pincers fly outward');
  assert.ok(gape(early) > 0, 'death opens a large frown');
  const smoke = frame => frame.filter(call => call.name === 'arc');
  assert.equal(smoke(early).length, 7);
  assert.ok(smoke(late)[0].alpha < smoke(draw({}, .55))[0].alpha, 'smoke fades');
  assert.ok(draw({}, 1).filter(call => call.name === 'fill').every(call => call.alpha < 1e-9), 'nothing remains at death end');
});
