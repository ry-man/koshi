const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, CHARACTERS, validateCustomLevel } = require('../src/game.js');

const level = events => ({
  version: 1, id: 'Robo Unicorn tests', duration: 60, goal: 1000,
  heartCost: null, brickSet: 1, events,
});

function arena() {
  const game = new Game(() => .5, { customLevel: level([]) });
  game.start();
  return game;
}

test('Robo Unicorn is available in custom placements and brick spawners, not campaign schedules', () => {
  assert.equal(CHARACTERS['robo-unicorn'], 'Robo Unicorn');
  const placement = { time: 0, kind: 'enemy', type: 'robo-unicorn', x: .5, y: .5 };
  assert.equal(validateCustomLevel(level([placement])).events[0].type, 'robo-unicorn');
  assert.ok(LEVELS.every(campaign => !campaign.enemies.some(([, type]) => type === 'robo-unicorn')));
  const game = arena();
  game.bricks[0].spawner = { kind: 'enemy', type: 'robo-unicorn' };
  game.spawnFromBrick(game.bricks[0]);
  assert.equal(game.robots[0].type, 'robo-unicorn');
});

test('Robo Unicorn roams faster than Robo Mouse and becomes fast and angry without food', () => {
  const game = arena();
  const unicorn = game.createCustomSpawn({ kind: 'enemy', type: 'robo-unicorn', x: .5, y: .5 })[0];
  unicorn.phase = 0;
  const { x, y } = unicorn;
  game.robots.push(unicorn);
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(unicorn.angry, true);
  assert.equal(unicorn.resting, false);
  assert.ok(Math.abs(unicorn.x - x - 15) < 1e-9);
  assert.equal(unicorn.y, y);
});

test('Robo Unicorn pauses, charges open-mouthed at food, and eats food only while charging', () => {
  const game = arena();
  const unicorn = game.createCustomSpawn({ kind: 'enemy', type: 'robo-unicorn', x: .5, y: .5 })[0];
  game.food.push({ x: unicorn.x + 35, y: unicorn.y, type: 'S', id: 1 });
  unicorn.age = 1;
  unicorn.nextRestAt = 1;
  unicorn.phase = 0;
  game.robots.push(unicorn);
  game.combat(.1, game.cat.x, game.cat.y);
  assert.equal(unicorn.unicornState, 'rest');
  assert.equal(unicorn.resting, true);
  assert.equal(game.food.length, 1, 'closed-mouth resting does not eat food');

  unicorn.unicornStateTime = .99;
  game.combat(.02, game.cat.x, game.cat.y);
  game.combat(.2, game.cat.x, game.cat.y);
  assert.equal(unicorn.unicornState, 'roam', 'finishing a charge resets the movement cycle');
  assert.equal(game.food.length, 0);
  assert.equal(unicorn.mouthOpen, false);
});

test('unicorn head artwork uses pink skin, a rainbow mane, yellow horn and eye, and grey mechanical teeth', () => {
  const { readFileSync } = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const calls = [], stack = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'save') return () => stack.push({ ...target });
      if (name === 'restore') return () => Object.assign(target, stack.pop());
      return (...args) => calls.push({ name, args, fill: target.fillStyle, stroke: target.strokeStyle });
    },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawRoboUnicorn('), source.indexOf('function drawRobotBody(')), context);
  const draw = (enemy = {}, progress = null, damage = null) => {
    calls.length = 0;
    context.drawRoboUnicorn({ phase: 0, ...enemy }, progress, damage);
    assert.equal(stack.length, 0);
    assert.equal(ctx.globalAlpha, 1);
    assert.ok(calls.every(call => call.args.every(value => typeof value !== 'number' || Number.isFinite(value))));
    return calls.slice();
  };
  const live = draw();
  for (const color of ['#f5b5d3', '#fa596f', '#ffad42', '#ffe65a', '#69d58e', '#53b9f1', '#a77bf0', '#ffd92f', '#535d66', '#c4cdd5']) {
    assert.ok(live.some(call => ['fill', 'fillRect'].includes(call.name) && call.fill === color), `${color} is visible`);
  }
  assert.ok(live.filter(call => call.name === 'bezierCurveTo').length >= 6, 'curved head and neck replace the four-legged body');
  assert.ok(live.filter(call => call.name === 'fill' && call.fill === '#ffd92f').length >= 2, 'horn and eye are both yellow');
  const mouth = frame => frame.find(call => call.name === 'ellipse' && call.fill === '#535d66');
  assert.equal(mouth(live).args[3], 3.5);
  assert.equal(mouth(draw({ mouthOpen: true })).args[3], 8, 'charge opens the grey mechanical mouth');
  const gaping = draw({ resting: true, unicornStateTime: .5 });
  assert.ok(!gaping.some(call => call.name === 'stroke' && call.stroke === '#fff9cf'), 'pause no longer sparkles');
  assert.ok(mouth(gaping).args[2] >= 13 && mouth(gaping).args[3] >= 16, 'pause shows an exaggerated wide-open mouth');
  assert.ok(mouth(draw({ resting: true, unicornStateTime: .05 })).args[3] < mouth(gaping).args[3], 'the gape opens quickly rather than popping');
  assert.ok(draw({ angry: true }).some(call => call.name === 'fill' && call.fill === '#e64b58'), 'foodless anger still turns skin red');
  assert.ok(draw({}, null, '#ffffff').some(call => call.name === 'fill' && call.fill === '#ffffff'), 'damage tint remains visible');
  const rotation = frame => frame.find(call => call.name === 'rotate').args[0];
  assert.equal(rotation(draw({ phase: Math.PI, facingAngle: .4 })), .4, 'artwork follows the smoothed facing angle');
  const death = draw({}, .1);
  assert.ok(death.some(call => call.name === 'fill' && call.fill === '#f5b5d3'), 'death starts from the same head silhouette');
  assert.ok(death.some(call => call.name === 'fill' && call.fill === '#ffd92f'), 'detached yellow horn remains visible');
  const sweeps = [.45, .6, .75, .9].map(progress => draw({}, progress).filter(call => call.name === 'arc'));
  assert.ok(sweeps.slice(0, 3).every(arcs => arcs.length === 6), 'death morphs into a six-band rainbow');
  const span = arcs => arcs[0].args[4] - arcs[0].args[3];
  assert.ok(Math.abs(span(sweeps[0]) - Math.PI) < 1e-9, 'rainbow begins as a 180 degree semicircle');
  assert.ok(span(sweeps[1]) < span(sweeps[0]) && span(sweeps[2]) < span(sweeps[1]), 'arch angle keeps decreasing');
  assert.ok(sweeps.every(arcs => arcs.every(call => Math.abs(call.args[2] - sweeps[0].find(first => first.stroke === call.stroke).args[2]) < 1e-9)),
    'bands keep their radius instead of squashing');
  assert.equal(draw({}, .99).filter(call => call.name === 'arc').length, 0, 'arch recedes to zero degrees');
  assert.ok(!sweeps.flat().some(call => call.name === 'scale'));
  assert.ok(!draw({}, .7).some(call => call.name === 'scale'), 'no horizontal squash');
});

test('Robo Unicorn turns tightly enough to reach food beside it instead of orbiting', () => {
  for (const [dx, dy] of [[0, 45], [0, -60], [-30, 40], [10, 50]]) {
    const game = arena();
    const unicorn = game.createCustomSpawn({ kind: 'enemy', type: 'robo-unicorn', x: .5, y: .5 })[0];
    game.food.push({ x: unicorn.x + dx, y: unicorn.y + dy, type: 'S', id: 1 });
    unicorn.phase = 0;
    unicorn.facingAngle = 0;
    unicorn.unicornState = 'charge';
    unicorn.unicornStateTime = 0;
    game.robots.push(unicorn);
    for (let step = 0; step < 90 && game.food.length; step++) game.combat(1 / 60, game.cat.x, game.cat.y);
    assert.equal(game.food.length, 0, `food at ${dx},${dy} is reached within 1.5 seconds`);
  }
});

test('Robo Unicorn facing rotates gradually through bounces and charge turns', () => {
  const game = arena();
  const unicorn = game.createCustomSpawn({ kind: 'enemy', type: 'robo-unicorn', x: .5, y: .5 })[0];
  unicorn.phase = 0;
  unicorn.facingAngle = 0;
  unicorn.x = game.width;
  game.robots.push(unicorn);
  let facing = unicorn.facingAngle;
  for (let step = 0; step < 60; step++) {
    game.combat(1 / 60, game.cat.x, game.cat.y);
    const change = Math.abs(Math.atan2(Math.sin(unicorn.facingAngle - facing), Math.cos(unicorn.facingAngle - facing)));
    assert.ok(change <= 10 / 60 + 1e-9, `facing turned ${change} radians in one frame`);
    facing = unicorn.facingAngle;
  }
  assert.ok(Math.abs(Math.cos(unicorn.facingAngle) - Math.cos(unicorn.phase)) < .05, 'facing catches up after the wall bounce');
});
