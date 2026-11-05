const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, FOODS, SWORDS, SHIELDS, CONTACT_SURFACES, validateCutscene, validateCustomLevel, levelObjective } = require('../src/game.js');
const { SaveSlots, SAVE_KEY } = require('../src/saves.js');

const concepts = [
  'robo ball', 'smiley cookie', 'stopwatches', 'battery', 'music box', 'eggplant',
  'saw blade', 'robo snake', 'magical sunglasses', 'soccer goals and balls',
  'ditto stamp', 'spooky mask', 'barrier blocks', 'robo jackolantern', 'boom helmet and boom times',
];
const added = LEVELS.slice(19, 34);
const indexOf = concept => LEVELS.findIndex(level => level.concept === concept);
const itemConcept = type => type.startsWith('stopwatch') ? 'stopwatches'
  : type.startsWith('boom-time') ? 'boom helmet and boom times'
  : type === 'magic-sunglasses' ? 'magical sunglasses' : type.replaceAll('-', ' ');
const style = brick => JSON.stringify([
  brick.kind, brick.crumbler, brick.warped, brick.toggle,
  ...CONTACT_SURFACES.map(key => brick[key] || null),
  brick.slimed ? brick.slimeColor : null, brick.conveyor ? brick.conveyorDirection : null,
]);

test('15 appended lessons introduce each requested element once, with level-appropriate explanatory scenes', () => {
  assert.equal(LEVELS.filter(level => ['1', '2'].includes(level.worldId)).length, 34);
  assert.deepEqual(added.map(level => level.concept), concepts);
  assert.deepEqual(LEVELS.map(level => level.id), LEVELS.map((_, index) => `1-${index + 1}`));
  const seen = new Set();
  for (const level of added) {
    const features = new Set();
    for (const [, type] of level.enemies) {
      if (['ball', 'snake', 'jackolantern'].includes(type)) features.add(`robo ${type}`);
    }
    for (const [, type] of level.items) features.add(itemConcept(type));
    for (const event of level.events ?? []) {
      if (event.kind === 'item') features.add(itemConcept(event.type));
      if (event.kind === 'object') features.add('soccer goals and balls');
    }
    if (level.brickTypes.some(brick => brick.barrier)) features.add('barrier blocks');
    if (level.activationLimit) features.add('boom helmet and boom times');
    assert.deepEqual([...features].filter(feature => !seen.has(feature)), [level.concept], level.id);
    for (const feature of features) seen.add(feature);
    assert.deepEqual(validateCutscene(level.cutscene), level.cutscene);
    const enemies = new Set(level.enemies.map(([, type]) => type));
    for (const line of level.cutscene.lines) {
      for (const actor of line.actors) {
        assert.ok(['koshi', 'tom'].includes(actor.character) || enemies.has(actor.character), level.id);
      }
    }
    const dialogue = level.cutscene.lines.map(line => line.text).join(' ');
    assert.match(dialogue, new RegExp({
      'soccer goals and balls': 'Soccer Ball',
      'boom helmet and boom times': 'Boom Helmet.+Boom Times',
      'barrier blocks': 'Barrier brick',
    }[level.concept] ?? level.concept, 'i'), level.id);
    assert.match(dialogue, /\b\d+\b/, 'explain a measurable rule or objective');
  }
});

test('added layouts have at most five styles and exactly three double/triple bricks in both orientations', () => {
  let triples = 0;
  for (const [offset, level] of added.entries()) {
    validateCustomLevel({ ...level, version: 1, heartCost: Number.isFinite(level.heartCost) ? level.heartCost : null, events: level.events ?? [] });
    for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
      const game = new Game(() => .5, { level: 19 + offset, ...options });
      const active = game.bricks.filter(brick => brick.absorbedBy === null);
      assert.ok(new Set(active.map(style)).size <= 5, level.id);
      const sizes = active.map(owner => 1 + game.bricks.filter(brick => brick.absorbedBy === owner.id).length);
      const larger = sizes.filter(size => size > 1).sort();
      assert.ok(JSON.stringify(larger) === '[2,2,2]' || JSON.stringify(larger) === '[2,2,3]', level.id);
      assert.ok(active.some(brick => brick.kind === 'normal' && !brick.toggle && !brick.crumbler && !brick.boost && !brick.barrier && !brick.spawner));
      const initial = structuredClone(game.bricks);
      game.start();
      game.reset();
      assert.deepEqual(game.bricks, initial);
    }
    if (level.brickGroups.some(group => group.members.length === 3)) triples++;
  }
  assert.ok(triples > 0 && triples < added.length, 'mix doubles-only and triple layouts');
});

test('each added level uses two to four returning brick mechanics and new brick types have three non-corner copies', () => {
  const introduced = new Map([['soccer goals and balls', 'goal'], ['barrier blocks', 'barrier']]);
  const previous = new Set(['crumbler', 'warped', 'slimed', 'springs', 'spikes', 'conveyor', 'portal', 'spawner', 'boost', 'toggle', 'cinder']);
  for (const [offset, level] of added.entries()) {
    for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
      const game = new Game(() => .5, { level: 19 + offset, ...options });
      const bricks = game.bricks.filter(brick => brick.absorbedBy === null);
      const returning = new Set();
      for (const brick of bricks) {
        for (const attribute of previous) {
          if (['cinder', 'goal'].includes(attribute) ? brick.kind === attribute : brick[attribute]) returning.add(attribute);
        }
      }
      assert.ok(returning.size >= 2 && returning.size <= 4, `${level.id}: ${[...returning]}`);
      const attribute = introduced.get(level.concept);
      if (attribute) {
        const copies = bricks.filter(brick => attribute === 'goal' ? brick.kind === attribute : brick[attribute]);
        assert.ok(copies.length >= 3, `${level.id}: independent copies`);
        assert.ok(copies.some(owner => game.bricks.some(part => part.absorbedBy === owner.id)), `${level.id}: a large copy`);
        for (const owner of copies) {
          const parts = game.bricks.filter(part => part.id === owner.id || part.absorbedBy === owner.id);
          assert.ok(parts.every(part => part.region.start > 0 && part.region.end < 1), `${level.id}: no corner parts`);
        }
      }
    }
    if (level.concept === 'barrier blocks') previous.add('barrier');
    if (level.concept === 'soccer goals and balls') previous.add('goal');
  }
});

test('larger enemy waves precede delayed weapons with enough reserve attacks for every enemy objective', () => {
  const originalCounts = [6,0,6,16,7,0,9,4,0,0,0,8,6,5,0];
  for (const [offset, level] of added.entries()) {
    const count = level.enemies.reduce((sum, [, , count]) => sum + count, 0);
    assert.ok(count >= Math.max(6, Math.ceil(originalCounts[offset] * 1.5)), `${level.id}: more enemies`);
    for (const [time] of level.weapons) assert.ok(time >= level.enemies[0][0] + 10, `${level.id}: initial dodge phase`);
    assert.ok(level.weapons.every(([time], i) => !i || time - level.weapons[i - 1][0] >= 4));
    const game = new Game(() => .25, { level: 19 + offset });
    game.start();
    game.cat.x = 22; game.cat.y = 22;
    game.update(level.enemies[0][0] + .01);
    assert.ok(game.robots.length > 0, `${level.id}: robots arrive first`);
    assert.equal(game.weapons.length, 0);
    assert.equal(game.weapon, null);
    if (!level.killGoal) continue;
    if (level.concept === 'saw blade') {
      assert.deepEqual(level.weapons, []);
      assert.ok(level.brickTypes.some(brick => brick.boost));
      continue;
    }
    let attacks = level.weapons.reduce((sum, [, type]) => sum + SWORDS[type].uses, 0);
    if (level.concept === 'battery') {
      const spawners = level.brickTypes.filter(brick => brick.spawner?.kind === 'weapon');
      const batteries = level.items.filter(([, type]) => type === 'battery').length;
      attacks += spawners.reduce((sum, brick) => sum + SWORDS[brick.spawner.type].uses, 0) * (1 + batteries);
    }
    const unfinishedHits = Math.max(...level.enemies.map(([, , , shield]) => (SHIELDS[shield]?.hits ?? 1) - 1));
    const minimum = level.killGoal + Math.max(5, Math.ceil(level.killGoal / 2)) + unfinishedHits;
    assert.ok(attacks >= minimum, `${level.id}: ${attacks} attacks vs ${minimum} including reserves`);
    assert.ok(attacks < minimum + SWORDS.silver.uses, `${level.id}: bounded spare supply`);
  }
});

test('new schedules spawn the advertised items, robots and balls and provide sufficient objective supplies', () => {
  for (const [offset, level] of added.entries()) {
    const food = level.food.reduce((sum, [, method, type]) =>
      sum + (method === 'S' ? 1 : Number(method.slice(1))) * FOODS[type].value, 0);
    const penalties = level.items.filter(([, type]) => type === 'eggplant').length * 10;
    assert.ok(food - penalties >= level.goal, level.id);
    assert.ok(level.enemies.reduce((sum, [, , count]) => sum + count, 0) >= level.killGoal, level.id);
    for (const schedule of [level.food, level.enemies, level.weapons, level.items]) {
      assert.ok(schedule.every(([time], i) => time >= 0 && time < level.duration && (!i || time >= schedule[i - 1][0])), level.id);
    }
    const game = new Game(() => .5, { level: 19 + offset });
    game.start();
    game.cat.x = 22; game.cat.y = 22;
    game.invulnerableUntil = Infinity;
    const times = new Set([...level.enemies, ...level.weapons, ...level.items].map(([time]) => time));
    for (const event of level.events ?? []) times.add(event.time);
    for (const time of [...times].sort((a, b) => a - b)) {
      game.elapsed = time;
      game.update(.001);
      for (const [at, type] of level.items) {
        if (at === time) assert.ok(game.items.some(item => item.type === type), `${level.id}: ${type}`);
      }
      for (const [at, type] of level.enemies) {
        if (at === time) assert.ok(game.robots.some(robot => robot.type === type), `${level.id}: ${type}`);
      }
      for (const event of level.events ?? []) {
        if (event.time !== time) continue;
        if (event.kind === 'item') assert.ok(game.items.some(item => item.type === event.type));
        if (event.kind === 'object') assert.ok(game.soccerBalls.length > 0);
      }
    }
  }
});

test('the low-timer mission collects all three stopwatch bonuses without winning before both targets', () => {
  const game = new Game(() => .5, { level: indexOf('stopwatches') });
  assert.equal(game.level.duration, 18);
  game.start(); game.update(.01);
  assert.equal(game.timeBonus, 10, 'the starting red stopwatch is reachable immediately');
  for (const [time, type, bonus] of [[6,'stopwatch-green',40],[12,'stopwatch-blue',100]]) {
    game.elapsed = time; game.update(.001);
    const item = game.items.find(item => item.type === type);
    assert.ok(item);
    game.cat.x = item.x; game.cat.y = item.y;
    game.combat(0, item.x, item.y);
    assert.equal(game.timeBonus, bonus);
  }
  assert.equal(game.timeLimit, 118);
  game.score = game.level.goal; game.enemies = game.level.killGoal - 1;
  game.update(.001); assert.equal(game.state, 'playing');
  game.enemies++; game.update(.001); assert.equal(game.state, 'won');
});

test('the battery mission must revisit its single sword spawner to achieve the enemy target', () => {
  const game = new Game(() => .5, { level: indexOf('battery') });
  const spawners = game.bricks.filter(brick => brick.absorbedBy === null && brick.spawner);
  assert.equal(spawners.length, 1);
  const spawner = spawners[0];
  assert.equal(spawner.spawner.kind, 'weapon');
  assert.equal(spawner.spawner.type, 'silver');
  assert.ok(SWORDS.silver.uses < game.level.killGoal);
  assert.deepEqual(game.level.weapons, []);
  assert.ok(game.bricks.every(brick => !brick.boost));
  game.start();
  game.cat.x = 22; game.cat.y = 22;
  game.update(.001);
  assert.ok(game.robots.length > 0, 'the starting mice appear before the dispenser can supply a weapon');
  assert.equal(game.weapons.length, 0);
  game.touchSpawner(spawner);
  assert.equal(game.weapons.length, 1);
  game.spawnerTouching.clear(); game.touchSpawner(spawner);
  assert.equal(game.weapons.length, 1, 'without a battery revisits cannot dispense another sword');
  game.collectItem({ type: 'battery' });
  game.spawnerTouching.clear(); game.touchSpawner(spawner);
  assert.equal(game.weapons.length, 2);
  assert.equal(game.batteries, 0);
  game.touchSpawner(spawner); assert.equal(game.weapons.length, 2, 'continuous contact does not dispense again');
  game.collectItem({ type: 'battery' });
  game.spawnerTouching.clear(); game.touchSpawner(spawner);
  assert.equal(game.weapons.length, 3);
  const supply = game.weapons.splice(0);
  game.robots = [];
  for (let defeat = 0; defeat < game.level.killGoal; defeat++) {
    if (!game.weapon) {
      const sword = supply.shift();
      assert.ok(sword, 'recharged dispensers supply enough attacks');
      game.weapons = [sword];
      game.cat.x = sword.x; game.cat.y = sword.y;
      game.combat(0, sword.x, sword.y);
    }
    game.robots = [{ type: 'mouse', x: game.cat.x + 50, y: game.cat.y, radius: 19, phase: 0, age: 4.5, touching: false }];
    game.combat(0, game.cat.x, game.cat.y);
  }
  assert.equal(game.enemies, game.level.killGoal);
  game.update(.001); assert.equal(game.state, 'won');
});

test('the saw mission has no weapon alternative and wins with preserved Boost launches', () => {
  const game = new Game(() => .5, { level: indexOf('saw blade') });
  assert.deepEqual(game.level.weapons, []);
  assert.ok(game.level.brickTypes.every(brick => brick.spawner?.kind !== 'weapon'));
  assert.equal(game.bricks.filter(brick => brick.absorbedBy === null && brick.boost).length, 3);
  game.start(); game.collectItem({ type: 'saw-blade' });
  const plain = game.bricks.find(brick => brick.absorbedBy === null && !brick.boost);
  assert.equal(game.sawBrick(plain, game.brickParts()), true);
  assert.equal(game.bricks.filter(brick => brick.absorbedBy === null && brick.boost).length, 3);
  const boost = game.bricks.find(brick => brick.absorbedBy === null && brick.boost);
  const exit = game.portalExit(boost);
  game.cat.x = exit.x - exit.nx * .01; game.cat.y = exit.y - exit.ny * .01;
  assert.equal(game.boostReady, true);
  const target = game.bricks.filter(brick => brick.absorbedBy === null && brick.id !== boost.id && brick.kind === 'normal')
    .sort((a, b) => Math.hypot(b.x - game.cat.x, b.y - game.cat.y) - Math.hypot(a.x - game.cat.x, a.y - game.cat.y))[0];
  assert.equal(game.steer(target.id, target.x + target.w / 2, target.y + target.h / 2), true);
  assert.equal(game.boosted, true);
  for (let i = 0; i < game.level.killGoal; i++) {
    game.robots = [{ type: 'mouse', x: game.cat.x, y: game.cat.y, radius: 19, phase: 0, age: 4.5, touching: false }];
    game.combat(0, game.cat.x, game.cat.y);
  }
  assert.equal(game.enemies, game.level.killGoal);
  assert.equal(game.weapon, null);
  game.update(.001); assert.equal(game.state, 'won');
});

test('the soccer lesson scores actual balls and wins on the third goal in desktop and portrait', () => {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    const game = new Game(() => .5, { level: indexOf('soccer goals and balls'), ...options });
    assert.equal(game.level.goalsGoal, 3);
    assert.equal(game.level.goal, 0); assert.equal(game.level.killGoal, 0);
    assert.equal(game.level.events.length, 5);
    assert.match(levelObjective(game.level), /Score 3 soccer goals/);
    game.start();
    const goal = game.bricks.find(brick => brick.kind === 'goal' && brick.absorbedBy === null);
    assert.equal(game.brickSelectable(goal), false);
    const exit = game.portalExit(goal);
    for (let shot = 1; shot <= 3; shot++) {
      game.soccerBalls = [game.createSoccerBall({ x: exit.x + exit.nx * 90, y: exit.y + exit.ny * 90 })];
      game.cat.x = exit.x + exit.nx * 50; game.cat.y = exit.y + exit.ny * 50;
      game.combat(.1, exit.x + exit.nx * 130, exit.y + exit.ny * 130);
      assert.ok(game.soccerBalls[0].vx * exit.nx + game.soccerBalls[0].vy * exit.ny < 0, 'moving Koshi actually kicks the ball toward the net');
      game.cat.x = 22; game.cat.y = 22;
      game.update(.5);
      assert.equal(game.goals, shot);
      assert.equal(game.state, shot === 3 ? 'won' : 'playing');
    }
  }
});

test('the helmet lesson equips on Start, grants charges rather than seconds, and resets', () => {
  const game = new Game(() => .5, { level: indexOf('boom helmet and boom times') });
  assert.equal(game.activationsRemaining, 6); assert.equal(game.boomHelmet, null);
  game.start(); game.update(.01);
  assert.ok(game.boomHelmet);
  assert.equal(game.activationsRemaining, 14, 'the initial blue Boom Time adds eight charges');
  game.collectItem({ type: 'boom-time-red' }); assert.equal(game.activationsRemaining, 15);
  game.collectItem({ type: 'boom-time-green' }); assert.equal(game.activationsRemaining, 18);
  assert.equal(game.timeBonus, 0);
  game.reset(); assert.equal(game.activationsRemaining, 6); assert.equal(game.boomHelmet, null);
});

test('existing completed 19-level saves resume the appended lessons without losing any wins', () => {
  const completed = LEVELS.slice(0, 19).map(level => level.id);
  const original = JSON.stringify({ version: 1, slots: [{ id: 'old', owner: 'Player', completed }, null, null] });
  const data = new Map([[SAVE_KEY, original]]);
  const saves = new SaveSlots(LEVELS.map(level => level.id), () => ({
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value),
  }));
  assert.deepEqual(saves.load()[0].completed, completed);
  assert.equal(saves.nextLevel(saves.load()[0]), 19);
  saves.complete(0, 'old', '1-20');
  assert.deepEqual(saves.load()[0].completed, [...completed, '1-20']);
  assert.equal(saves.nextLevel(saves.load()[0]), 20);
});
