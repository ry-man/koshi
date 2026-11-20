const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, CHARACTERS, validateCustomLevel, brickRegions } = require('../src/game.js');
const { spawnSymbol } = require('../src/brick-visuals.js');
const { GUIDE } = require('../src/learning.js');

const blank = () => ({ version: 1, id: 'Striker tests', duration: 60, goal: 1000, heartCost: null, brickSet: 1, events: [] });
function arena(edge = 'top', options = {}) {
  const game = new Game(() => .5, { ...options, customLevel: blank() });
  const regions = brickRegions(game.bricks, game.width, game.height);
  for (const brick of game.bricks) {
    if (regions.get(brick.id).edge === edge) { brick.kind = 'goal'; brick.goalTeam = 'koshi'; }
  }
  game.start();
  return game;
}
function striker(game, x = .5, y = .7) {
  const enemy = game.createCustomSpawn({ time: 0, kind: 'enemy', type: 'striker', x, y })[0];
  game.robots.push(enemy);
  return enemy;
}

test('striker is valid in custom placements, spawners, and cutscenes', () => {
  const level = { ...blank(), events: [{ time: 2, kind: 'enemy', type: 'striker', x: .3, y: .5, shield: 'green' }],
    brickTypes: [{ edge: 'bottom', start: .2, end: .3, kind: 'normal', spawner: { kind: 'enemy', type: 'striker' } }],
    cutscene: { theme: 'workshop', lines: [{ speaker: 'striker', text: 'Goal!', actors: [{ character: 'striker', x: .5, y: .65 }] }] } };
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(level))), level);
  assert.equal(CHARACTERS.striker, 'Robo Striker');
  assert.ok(spawnSymbol({ kind: 'enemy', type: 'striker' }));
  assert.ok(GUIDE.flatMap(chapter => chapter.sections).some(([, , picture]) => picture === 'enemy:striker'));
  const game = new Game(() => .5, { customLevel: level });
  game.start();
  game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
  assert.equal(game.robots[0].type, 'striker');
  assert.equal(game.robots[0].radius, 23);
});

test('striker is harmless, wanders without balls, and dies without a Koshi goal', () => {
  const game = arena(), enemy = striker(game);
  Object.assign(game.cat, { x: enemy.x, y: enemy.y });
  game.update(.1);
  assert.equal(game.hearts, 3);
  assert.ok(enemy.x !== game.cat.x || enemy.y !== game.cat.y);
  for (const brick of game.bricks) if (brick.kind === 'goal') brick.goalTeam = 'enemy';
  game.update(.01);
  assert.equal(game.robots.length, 0);
  assert.equal(game.enemies, 0);
  assert.equal(game.enemyDeaths[0].type, 'striker');
  game.updateEnemyDeaths(.9);
  assert.ok(Math.abs(game.enemyDeaths[0].deathProgress - .5) < .02);
});

test('striker pauses, accelerates into a ball, pauses after impact, and scores for enemy', () => {
  const game = arena();
  const bounds = game.bounds();
  Object.assign(game.cat, { x: bounds.left, y: bounds.bottom });
  const enemy = striker(game, .5, .7);
  const ball = game.createSoccerBall(game.pointFromRelative(.5, .5));
  game.soccerBalls.push(ball);
  const start = { x: enemy.x, y: enemy.y };
  game.update(.3);
  assert.deepEqual({ x: enemy.x, y: enemy.y }, start);
  let speeds = [], impacted = false;
  for (let i = 0; i < 1200 && !impacted; i++) {
    game.update(1 / 120);
    if (enemy.strikerState === 'charge') speeds.push(enemy.strikerSpeed);
    if (Math.hypot(ball.vx, ball.vy) > 1) impacted = true;
  }
  assert.ok(impacted, 'striker reaches the ball');
  assert.ok(speeds.length > 1 && speeds.at(-1) > speeds[0], 'accelerates while approaching');
  assert.equal(enemy.strikerState, 'hit-pause');
  assert.ok(ball.vy < 0, 'ball travels toward the top goal');
  const position = { x: enemy.x, y: enemy.y };
  game.update(.2);
  assert.deepEqual({ x: enemy.x, y: enemy.y }, position);
  game.update(4);
  assert.equal(game.teamEnemyGoals, 1);
});

test('after a hit the striker pauses 1.2 seconds, then wanders five seconds before targeting again', () => {
  const game = arena(), enemy = striker(game);
  Object.assign(game.cat, { x: game.bounds().left, y: game.bounds().bottom });
  const ball = game.createSoccerBall(game.pointFromRelative(.5, .5));
  game.soccerBalls.push(ball);
  for (let i = 0; i < 1200 && enemy.strikerState !== 'hit-pause'; i++) game.update(1 / 120);
  assert.equal(enemy.strikerState, 'hit-pause');
  game.soccerBalls = [];
  const position = { x: enemy.x, y: enemy.y };
  game.update(1.19);
  assert.equal(enemy.strikerState, 'hit-pause');
  assert.deepEqual({ x: enemy.x, y: enemy.y }, position);
  game.enemiesSleepUntil = game.elapsed + 1;
  const remainingPause = enemy.strikerTimer;
  game.update(.5);
  assert.equal(enemy.strikerTimer, remainingPause, 'sleep freezes the pause');
  game.enemiesSleepUntil = 0;
  game.update(.02);
  assert.equal(enemy.strikerState, 'wander');
  game.update(2);
  assert.equal(enemy.strikerState, 'wander', 'wandering continues when the hit ball disappears');
  assert.notDeepEqual({ x: enemy.x, y: enemy.y }, position);
  const remainingWander = enemy.strikerTimer;
  game.enemiesSleepUntil = game.elapsed + 1;
  game.update(.5);
  assert.equal(enemy.strikerTimer, remainingWander, 'sleep freezes the wander');
  game.enemiesSleepUntil = 0;
  const nextBall = game.createSoccerBall(game.pointFromRelative(.9, .1));
  game.soccerBalls.push(nextBall);
  game.update(2.9);
  assert.equal(enemy.strikerState, 'wander', 'a new ball does not end the five-second wander');
  assert.equal(enemy.strikerBall, null);
  game.update(.2);
  assert.equal(enemy.strikerBall, nextBall);
  assert.ok(['position', 'charge'].includes(enemy.strikerState));
});

test('striker respects sleep and weapons', () => {
  const game = arena(), enemy = striker(game);
  const start = { x: enemy.x, y: enemy.y };
  game.enemiesSleepUntil = 10;
  game.update(.5);
  assert.deepEqual({ x: enemy.x, y: enemy.y }, start);
  game.weapon = { type: 'wood', uses: 1, expires: Infinity };
  Object.assign(game.cat, start);
  game.combat(1 / 120, start.x, start.y);
  assert.equal(game.robots.length, 0);
  assert.equal(game.enemies, 1);
});

test('striker can line up from the goal side and score at each edge in both orientations', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      const game = arena(edge, options);
      const regions = brickRegions(game.bricks, game.width, game.height);
      const goals = game.bricks.filter(brick => brick.kind === 'goal' && regions.get(brick.id).edge === edge);
      for (const brick of goals) if (brick !== goals[Math.floor(goals.length / 2)]) brick.kind = 'normal';
      const start = { top: [.8, .2], bottom: [.2, .8], left: [.2, .8], right: [.8, .2] }[edge];
      striker(game, ...start);
      game.soccerBalls.push(game.createSoccerBall(game.pointFromRelative(.5, .5)));
      Object.assign(game.cat, { x: game.bounds().left, y: game.bounds().top });
      for (let time = 0; time < 30 && !game.teamEnemyGoals; time += .1) game.update(.1);
      assert.equal(game.teamEnemyGoals, 1, `${edge} ${options.portrait ? 'portrait' : 'landscape'}`);
    }
  }
});

test('striker retargets a remaining ball and goal after the originals disappear', () => {
  const game = arena(), enemy = striker(game);
  const regions = brickRegions(game.bricks, game.width, game.height);
  for (const brick of game.bricks) if (regions.get(brick.id).edge === 'bottom') {
    brick.kind = 'goal'; brick.goalTeam = 'koshi';
  }
  const first = game.createSoccerBall(game.pointFromRelative(.5, .4));
  const second = game.createSoccerBall(game.pointFromRelative(.6, .6));
  game.soccerBalls.push(first, second);
  game.update(.7);
  assert.ok(enemy.strikerBall);
  game.soccerBalls = [enemy.strikerBall === first ? second : first];
  for (const brick of game.bricks) if (regions.get(brick.id).edge === 'top') brick.kind = 'normal';
  game.update(.1);
  assert.equal(enemy.strikerBall, game.soccerBalls[0]);
  assert.ok(game.robots.includes(enemy));
});

test('striker artwork shares the jersey and death animation but has a mustache and unibrow', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const draw = progress => {
    const operations = [], colors = [], stack = [];
    const ctx = new Proxy({ globalAlpha: 1, fillStyle: '', strokeStyle: '',
      createLinearGradient: () => ({ addColorStop: (...args) => colors.push(args) }),
      save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); },
    }, { get(target, key) {
      if (key in target) return target[key];
      return (...args) => operations.push({ name: key, args, color: target.fillStyle, stroke: target.strokeStyle, width: target.lineWidth, alpha: target.globalAlpha });
    } });
    const context = vm.createContext({ ctx });
    vm.runInContext(source.slice(source.indexOf('function drawRoboGoalie('), source.indexOf('function drawRoboBucket(')), context);
    context.drawRoboGoalie({ type: 'striker', age: 0 }, progress);
    return { operations, colors };
  };
  const alive = draw(null).operations;
  assert.ok(alive.some(op => op.name === 'lineTo' && op.args[0] === 14 && op.args[1] === -12));
  assert.equal(alive.filter(op => op.name === 'arc' && op.args[2] === 3.5).length, 2);
  assert.ok(alive.some(op => op.name === 'translate' && op.args[0] === 0 && op.args[1] === -5.5 && op.color === '#704122'), 'mustache is raised above the shirt');
  assert.ok(alive.some(op => op.name === 'bezierCurveTo' && op.args[4] === -18 && op.color === '#704122'), 'brown mustache');
  assert.ok(alive.some(op => op.name === 'stroke' && op.color === '#704122' && op.stroke === '#d7a16d' && op.width === 1), 'thin light brown outline');
  assert.ok(alive.some(op => op.name === 'fillRect' && op.color === '#27a6b0'), 'jersey');
  assert.ok(draw(.2).operations.some(op => op.name === 'translate' && op.args[1] > 20));
  assert.ok(draw(.5).colors.some(([, color]) => color === '#e85c9c'));
  assert.ok(draw(.8).operations.some(op => op.name === 'arc' && op.color === '#ffb55c'));
});
