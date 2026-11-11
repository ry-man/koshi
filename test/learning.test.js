const test = require('node:test');
const assert = require('node:assert/strict');
const { GUIDE, LESSONS, Tutorial } = require('../src/learning.js');
const { Game, CHARACTERS, ITEMS, OBJECTS, SWORDS, WEAPONS, HAZARDS, PORTALS, LEVELS, CONTACT_SURFACES, brickRegions, levelObjective } = require('../src/game.js');

const indexOf = id => LESSONS.findIndex(lesson => lesson.id === id);
function practice(id, options = {}) {
  const tutorial = new Tutorial();
  tutorial.select(indexOf(id), options);
  return tutorial;
}
function aim(tutorial, brick = tutorial.target) {
  return tutorial.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2);
}
function wait(tutorial, seconds) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 120) {
    tutorial.game.update(1 / 120);
    tutorial.observe();
  }
}
function opposite(tutorial) {
  const game = tutorial.game, regions = brickRegions(game.bricks, game.width, game.height);
  return game.bricks.filter(brick => regions.get(brick.id).edge === 'left')
    .sort((a, b) => Math.abs(a.y + a.h / 2 - tutorial.game.cat.y) - Math.abs(b.y + b.h / 2 - tutorial.game.cat.y))[0];
}

test('guide covers all playable topics and lessons have unique freely selectable IDs', () => {
  assert.equal(GUIDE.length, 10);
  assert.equal(LESSONS.length, 64);
  assert.equal(new Set(LESSONS.map(lesson => lesson.id)).size, LESSONS.length);
  for (const chapter of GUIDE) {
    assert.ok(LESSONS.some(lesson => lesson.id === chapter.practice), `missing practice link for ${chapter.title}`);
  }
  const tutorial = new Tutorial();
  assert.throws(() => tutorial.select(-1), RangeError);
  assert.throws(() => tutorial.select(LESSONS.length), RangeError);
  for (let index = LESSONS.length - 1; index >= 0; index--) {
    tutorial.select(index);
    assert.equal(tutorial.game.state, 'playing');
    assert.equal(tutorial.game.elapsed, 0);
    assert.equal(tutorial.game.level.cutscene, undefined);
    assert.equal(tutorial.observe(), false, `${tutorial.lesson.id} cannot complete just by selecting it`);
    assert.ok(tutorial.lesson.instruction.length > 40);
  }
});

test('guide illustrates every brick, enemy, heart, weapon, and power-up without a story section', () => {
  const pictures = GUIDE.flatMap(chapter => chapter.sections.flatMap(([, , picture]) => picture ? [picture].flat() : []));
  const pictureSet = new Set(pictures);
  for (const type of Object.keys(ITEMS)) assert.ok(pictureSet.has(`item:${type}`), `missing item: ${type}`);
  for (const type of Object.keys(OBJECTS)) assert.ok(pictureSet.has(`object:${type}`), `missing object: ${type}`);
  for (const type of Object.keys(CHARACTERS).filter(type => !['koshi', 'tom'].includes(type))) {
    assert.ok(pictureSet.has(`enemy:${type}`), `missing enemy: ${type}`);
  }
  for (const picture of [
    'brick:slow', 'brick:normal', 'brick:fast', 'brick:crumbler', 'brick:warped',
    'slime:blue', 'slime:green', 'slime:red', 'brick:springs', 'brick:spikes', 'brick:conveyor', 'heart',
    'special:cinder', 'special:goal', 'object:soccer-ball', 'special:spawner', 'special:boost',
    ...Object.keys(PORTALS).map(color => `special:portal:${color}`),
    ...[1, 2, 4].map(count => `special:toggle:${count}`),
    ...['laser', 'fireball'].map(type => `special:turret:${type}`),
    ...Object.keys(HAZARDS).map(type => `special:hazard:${type}`),
    ...Object.keys(HAZARDS).flatMap(type => ['yellow', 'black'].map(power => `special:hazard:${type}:${power}`)),
    'enemy:mouse', 'enemy:wheel', 'enemy:ram', 'enemy:bucket', ...Object.keys(WEAPONS).map(type => `weapon:${type}`),
    'item:smiley-cookie', 'item:stopwatch', 'item:stopwatch-green', 'item:stopwatch-blue', 'item:battery', 'item:music-box', 'item:eggplant', 'item:saw-blade', 'item:magic-sunglasses', 'item:ditto-stamp', 'item:spooky-mask',
  ]) assert.ok(pictures.includes(picture), `missing illustration: ${picture}`);
  assert.equal(new Set(pictures).size, pictures.length);
  for (const chapter of GUIDE) {
    assert.doesNotMatch(chapter.title, /story/i);
    for (const [title, description] of chapter.sections) assert.doesNotMatch(`${title} ${description}`, /story|cutscene/i);
  }
  assert.ok(GUIDE.some(chapter => chapter.title === 'Objectives'));
});

test('guide groups variants, separates hazards and turrets, and explains powered tracks', () => {
  const sections = GUIDE.flatMap(chapter => chapter.sections);
  const entry = title => {
    const matches = sections.filter(([name]) => name === title);
    assert.equal(matches.length, 1, `expected one ${title} entry`);
    return matches[0];
  };
  for (const [title, expected] of [
    ['Cat Shields', 3], ['Boom Time', 3], ['Stopwatches', 3],
    ['Thin Paintbrush', 3], ['Wide Paintbrush', 3], ['Paint Roller', 3],
    ['Steering bricks', 3], ['Bumpers', 3], ['Bubbles', 3], ['Slime', 3],
    ['Obstructions', 8], ['Swords', 4], ['Hammers', 3], ['Axes', 2], ['Rope Darts', 3],
    ['Bubble Gun Hazard', 3], ['Bumper Gun Hazard', 3],
    ['Power-linked Hazard Bricks', Object.keys(HAZARDS).length * 2],
  ]) assert.equal(entry(title)[2].length, expected, title);
  for (const title of ['Laser Hazard', 'Flame Hazard', 'Missile Hazard', 'Obstructor Gun Hazard', 'Laser Turret', 'Fireball Turret', 'Destructible obstructions']) entry(title);
  assert.equal(sections.filter(([title]) => /crumbler/i.test(title)).length, 1);
  assert.equal(sections.filter(([title]) => /warped/i.test(title)).length, 1);
  const track = entry('Cat Tracks')[1];
  assert.match(track, /bumper/i);
  assert.match(track, /obstruction/i);
  assert.match(track, /yellow or black/i);
  assert.match(track, /matching color/i);
  assert.match(track, /pauses or resumes/i);
});

test('Item Case is explained in the power-ups guide and has a selectable practice lesson', () => {
  const chapter = GUIDE.find(({ title }) => title === 'Power-ups & risky items');
  const entries = GUIDE.flatMap(({ sections }) => sections).filter(([title]) => title === 'Item Case');
  assert.equal(entries.length, 1);
  assert.ok(chapter.sections.includes(entries[0]));
  assert.equal(entries[0][2], 'object:item-case');
  assert.match(entries[0][1], /sword, hammer or axe/i);
  assert.match(entries[0][1], /Rope Dart/);
  assert.match(entries[0][1], /Tutorial to practice/);
  assert.ok(LESSONS.some(({ id }) => id === 'item-case'));
});

test('tutorial covers every contact surface, enemy, and new item mechanic, and uses real campaign objectives', () => {
  for (const surface of CONTACT_SURFACES) {
    const tutorial = practice(surface === 'slimed' ? 'slime-green' : surface);
    assert.ok(tutorial.target[surface], `missing practice surface: ${surface}`);
  }
  for (const id of ['cinder', 'larger', 'crumbler', 'warped', 'warped-crumbler', 'toggle']) {
    assert.ok(LESSONS.some(lesson => lesson.id === id), `missing practice type: ${id}`);
  }
  for (const type of Object.keys(ITEMS)) {
    const id = type.startsWith('cat-shield-') ? 'cat-shield'
      : type.startsWith('stopwatch') ? 'stopwatch'
      : type.startsWith('boom-time') ? 'boom-time'
        : type.startsWith('paint-') ? 'paintbrush'
          : ['smiley-cookie'].includes(type) ? 'cookie'
            : ['key', 'treasure-chest', 'cat-block'].includes(type) ? 'keys' : type;
    assert.ok(LESSONS.some(lesson => lesson.id === id), `missing tutorial for item: ${type}`);
  }
  for (const type of Object.keys(OBJECTS)) {
    const id = type.startsWith('bumper-') ? 'bumper'
      : type.startsWith('bubble-') ? 'bubble'
        : type === 'cat-circle' ? 'cat-circle'
        : type === 'item-case' ? 'item-case'
        : type.startsWith('obstruction-') ? 'obstruction'
          : type === 'soccer-ball' ? 'soccer' : null;
    assert.ok(id && LESSONS.some(lesson => lesson.id === id), `missing tutorial for object: ${type}`);
  }
  for (const id of Object.keys(CHARACTERS).filter(type => !['koshi', 'tom', 'boss'].includes(type))) {
    assert.ok(LESSONS.some(lesson => lesson.id === id), `missing enemy lesson: ${id}`);
  }
  for (const id of [
    'cookie', 'stopwatch', 'boom-time', 'battery', 'cat-shield', 'music-box', 'spooky-mask', 'kitty-cape',
    'magic-sunglasses', 'eggplant', 'saw-blade', 'ditto-stamp', 'paintbrush', 'keys',
  ]) assert.ok(LESSONS.some(lesson => lesson.id === id), `missing item lesson: ${id}`);
  for (const id of ['bumper', 'bubble', 'cat-circle', 'obstruction']) {
    assert.ok(LESSONS.some(lesson => lesson.id === id), `missing object lesson: ${id}`);
  }
  const objectives = GUIDE.find(chapter => chapter.title === 'Objectives');
  for (const level of LEVELS) {
    assert.equal(objectives.sections.find(([title]) => title === `Level ${level.number}`)[1], `${levelObjective(level)}.`);
  }
});

test('Cat Shield tutorial demonstrates a blue shield absorbing damage and stepping down to green', () => {
  for (const options of [{}, { portrait: true, scale: .35 }]) {
    const tutorial = practice('cat-shield', options);
    aim(tutorial);
    wait(tutorial, 2);
    assert.equal(tutorial.game.catShield, 'green');
    assert.equal(tutorial.game.hearts, 3);
    assert.equal(tutorial.game.tookDamage, true);
    assert.equal(tutorial.observe(), true);
  }
});

test('boss tutorial requires six dizzy Boost hits and the completed death animation', () => {
  const tutorial = practice('boss'), game = tutorial.game;
  assert.equal(tutorial.observe(), false);
  game.update(.01);
  for (let hit = 0; hit < 6; hit++) {
    game.boss.state = 'dizzy'; game.boss.invulnerableUntil = 0; game.boosted = true;
    assert.equal(game.hitBoss(game.boss), true);
    assert.equal(tutorial.observe(), false);
  }
  game.update(2.4);
  assert.equal(tutorial.observe(), true);
});

test('tutorial weapon choices match the game catalog', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  for (const [type, weapon] of Object.entries(WEAPONS)) {
    const option = html.match(new RegExp(`<option value="${type}"[^>]*>([^<]+)<`));
    assert.ok(option, `missing ${type} option`);
    const capacity = weapon.seconds ? `${weapon.seconds} seconds` : `${weapon.uses} ${weapon.ropeDart ? 'shot' : 'hit'}`;
    assert.ok(option[1].includes(capacity), `${type} label matches its hit count or timer`);
  }
});

test('Anvil practice restores the selected sword, hammer or axe through a real pickup', () => {
  for (const [type, weapon] of Object.entries(WEAPONS)) {
    const tutorial = new Tutorial();
    tutorial.sword = type;
    tutorial.select(indexOf('anvil'));
    assert.equal(tutorial.observe(), false);
    assert.equal(tutorial.game.weapon.type, type);
    aim(tutorial);
    wait(tutorial, 1);
    assert.equal(tutorial.observe(), true, `${type} can complete Anvil practice`);
    assert.equal(tutorial.game.weapon.uses, weapon.uses);
    if (weapon.seconds) assert.ok(tutorial.game.weapon.expires - tutorial.game.elapsed > weapon.seconds - 1);
  }
});

test('attackable enemy lessons require defeating every robot type with a sword', () => {
  for (const id of Object.keys(CHARACTERS).filter(type => !['koshi', 'tom', 'boss', 'robo-love-bug'].includes(type))) {
    const tutorial = practice(id);
    assert.equal(tutorial.observe(), false, `${id} is not complete at start`);
    aim(tutorial); wait(tutorial, 2);
    assert.equal(tutorial.game.enemies, 1, `${id} is defeated`);
    assert.equal(tutorial.observe(), true, `${id} completes after defeat`);
    assert.equal(tutorial.game.hearts, 3, `${id} can be defeated without damage`);
  }
});

test('Love Bug practice teaches barrier isolation instead of sword attacks', () => {
  for (const options of [{}, { portrait: true, scale: .3 }]) {
    const tutorial = practice('robo-love-bug', options);
    assert.equal(tutorial.game.robots.length, 2);
    assert.equal(tutorial.game.weapons.length, 0);
    assert.equal(tutorial.observe(), false);
    aim(tutorial);
    wait(tutorial, 10);
    assert.equal(tutorial.game.enemies, 2);
    assert.equal(tutorial.observe(), true);
    assert.equal(tutorial.game.hearts, 3);
  }
});

test('new item and object lessons complete only after their mechanic is used', () => {
  for (const id of [
    'cookie', 'stopwatch', 'boom-time', 'battery', 'music-box', 'spooky-mask', 'kitty-cape',
    'eggplant', 'saw-blade', 'paintbrush', 'keys',
  ]) {
    const tutorial = practice(id);
    assert.equal(tutorial.observe(), false, `${id} is not complete at start`);
    aim(tutorial); wait(tutorial, id === 'battery' ? 3 : 2);
    assert.equal(tutorial.observe(), true, `${id} completes after use`);
  }
  const bumper = practice('bumper');
  aim(bumper); wait(bumper, 1.2);
  assert.equal(bumper.observe(), true);
  const bubble = practice('bubble');
  aim(bubble); wait(bubble, 6);
  assert.equal(bubble.observe(), true);
  const circle = practice('cat-circle');
  aim(circle); wait(circle, 2);
  assert.equal(circle.game.catCircleTrap, null);
  assert.equal(circle.game.catCircleIgnore, circle.game.catCircles[0]);
  assert.equal(circle.observe(), false, 'must leave the rest spot after arriving');
  assert.equal(aim(circle, opposite(circle)), true);
  wait(circle, .5);
  assert.equal(circle.observe(), true);
  const obstruction = practice('obstruction');
  aim(obstruction); wait(obstruction, 1);
  assert.equal(obstruction.obstructionSeen, true);
  assert.equal(obstruction.observe(), false, 'must steer after hitting the obstruction');
  assert.equal(aim(obstruction, opposite(obstruction)), true);
  assert.equal(obstruction.observe(), true);
  const stamp = practice('ditto-stamp');
  aim(stamp); wait(stamp, 1.5);
  assert.equal(stamp.stampCaptured, true);
  assert.equal(stamp.observe(), false, 'must copy the stamp onto a second landing');
  assert.equal(aim(stamp, opposite(stamp)), true);
  wait(stamp, 3);
  assert.equal(stamp.observe(), true);
  const sunglasses = practice('magic-sunglasses');
  assert.equal(aim(sunglasses), false, 'the outlined brick starts recharging');
  assert.equal(aim(sunglasses, opposite(sunglasses)), true);
  wait(sunglasses, 1.2);
  assert.equal(sunglasses.game.sunglassesActive, true);
  assert.equal(aim(sunglasses), true, 'the glasses allow selecting the cooling brick');
  assert.equal(sunglasses.observe(), true);
  const turret = practice('turret');
  aim(turret); wait(turret, 1);
  assert.ok(turret.game.activeTurret);
  wait(turret, 1);
  assert.equal(turret.game.fireTurretAt(turret.game.width / 2, turret.game.height / 2), true);
  assert.equal(turret.observe(), true);
  const hazard = practice('hazard');
  assert.equal(hazard.observe(), false);
  aim(hazard); wait(hazard, 1.5);
  assert.ok(hazard.game.tookDamage);
  assert.equal(hazard.observe(), false, 'must leave the flame after contact');
  assert.equal(aim(hazard, opposite(hazard)), true);
  assert.equal(hazard.observe(), true);
});

for (const options of [{}, { portrait: true, scale: .5 }, { portrait: true, scale: .3 }]) {
  const layout = options.portrait ? `phone at scale ${options.scale}` : 'desktop';
  test(`movement, redirection, food, and recharge lessons use real actions on ${layout}`, () => {
    const movement = practice('aim', options);
    assert.equal(aim(movement), true); wait(movement, 2);
    assert.equal(movement.observe(), true);
    const redirect = practice('redirect', options);
    aim(redirect); wait(redirect, .05);
    assert.equal(aim(redirect, redirect.game.bricks[0]), true);
    assert.equal(redirect.observe(), true);
    const food = practice('food', options);
    aim(food); wait(food, 2);
    assert.equal(food.game.score, 3);
    assert.equal(food.observe(), true);
    const cooldown = practice('cooldown', options);
    aim(cooldown); wait(cooldown, 2.9);
    assert.equal(cooldown.observe(), false);
    wait(cooldown, .2);
    assert.equal(cooldown.observe(), true);
  });

  test(`Crumblers, Warped restoration, slime holds, and Springs work on ${layout}`, () => {
    const crumbler = practice('crumbler', options);
    aim(crumbler); wait(crumbler, 1);
    const left = opposite(crumbler);
    assert.ok(left);
    left.kind = 'fast';
    aim(crumbler, left); wait(crumbler, 2.1);
    assert.equal(aim(crumbler), true);
    assert.equal(crumbler.observe(), true);
    assert.equal(crumbler.target.usesLeft, 0);
    assert.equal(aim(crumbler), false);
    const warped = practice('warped', options);
    aim(warped); wait(warped, 1);
    assert.ok(warped.game.bricks.some(brick => brick.absorbedBy !== null));
    assert.equal(warped.observe(), false);
    wait(warped, 7.1);
    assert.equal(warped.observe(), true);
    for (const color of ['red', 'green', 'blue']) {
      const slime = practice(`slime-${color}`, options);
      aim(slime); wait(slime, 1.05);
      assert.equal(slime.held, true);
      assert.equal(slime.observe(), false);
      wait(slime, 6);
      assert.equal(slime.observe(), true);
    }
    const springs = practice('springs', options);
    aim(springs); wait(springs, 1.05);
    assert.notEqual(springs.target.hitAt, null);
    assert.equal(springs.observe(), true);
  });

  test(`Spikes, Conveyors, Cinder, larger bricks, and frozen Warped Crumblers work on ${layout}`, () => {
    const spikes = practice('spikes', options);
    aim(spikes); wait(spikes, 1.05);
    assert.ok(spikes.game.weapon, 'the sword does not protect against spikes');
    assert.equal(spikes.game.hearts, 2);
    assert.equal(spikes.observe(), true);
    wait(spikes, 2);
    assert.equal(spikes.game.hearts, 2, 'resting does not repeat spike damage');
    const conveyor = practice('conveyor', options);
    aim(conveyor); wait(conveyor, 1.05);
    assert.equal(conveyor.rideSeen, true);
    assert.equal(conveyor.observe(), false, 'must steer away, not merely touch');
    assert.equal(aim(conveyor, opposite(conveyor)), true);
    assert.equal(conveyor.observe(), true);
    conveyor.select(indexOf('conveyor'), options);
    assert.equal(conveyor.rideSeen, false, 'retry resets observed riding');
    aim(conveyor); wait(conveyor, 3);
    assert.equal(conveyor.game.conveyorRide, null, 'the belt ends naturally');
    aim(conveyor, opposite(conveyor));
    assert.equal(conveyor.observe(), true, 'short phone belts do not require racing to redirect before the ride ends');
    const cinder = practice('cinder', options);
    const block = cinder.game.bricks.find(brick => brick.kind === 'cinder');
    assert.ok(cinder.game.touchingPart(block), 'start physically resting against Cinder');
    assert.equal(aim(cinder, block), false);
    assert.equal(cinder.actions, 0);
    assert.equal(aim(cinder), true);
    wait(cinder, 2.1);
    assert.equal(cinder.observe(), true);
    assert.equal(cinder.game.hearts, 3);
    const larger = practice('larger', options);
    const member = larger.game.bricks.find(brick => brick.absorbedBy === larger.target.id);
    assert.ok(member);
    assert.equal(larger.steer(larger.target.id, member.x + member.w / 2, member.y + member.h / 2), true);
    assert.equal(larger.target.readyAt, 3);
    wait(larger, 2.1);
    assert.equal(larger.observe(), true);
    assert.equal(member.absorbedBy, larger.target.id);
    const combined = practice('warped-crumbler', options);
    aim(combined); wait(combined, 1.05);
    assert.equal(combined.observe(), false, 'must wait past the restoration time');
    wait(combined, 7.1);
    assert.equal(combined.observe(), true);
    assert.equal(combined.target.usesLeft, 0);
    assert.notEqual(combined.target.warpUntil, null);
    assert.ok(combined.game.bricks.some(brick => brick.absorbedBy === combined.target.id));
    assert.equal(aim(combined), false);
  });

  test(`sword pickups and enemy intercepts complete without damage on ${layout}`, () => {
    for (const id of ['mouse', 'wheel', 'ram', 'bucket', 'objectives']) {
      for (const sword of Object.keys(WEAPONS).filter(type => !WEAPONS[type].ropeDart)) {
        const tutorial = new Tutorial(); tutorial.sword = sword; tutorial.select(indexOf(id), options);
        aim(tutorial); wait(tutorial, .9);
        assert.equal(tutorial.observe(), true, `${id} using ${sword}`);
        assert.equal(tutorial.game.hearts, 3, `${id} using ${sword} must not inflict damage`);
        assert.equal(tutorial.game.enemies, 1);
        if (id === 'objectives') {
          assert.equal(tutorial.game.score, 1);
          assert.equal(tutorial.game.state, 'won');
        }
      }
    }
  });
}

test('healing, warnings, and pause steps require their specific interactions', () => {
  for (const options of [{}, { portrait: true, scale: .35 }]) {
    const healing = practice('healing', options);
    aim(healing); wait(healing, 1.05);
    assert.equal(healing.game.score, 10);
    assert.equal(healing.game.healing.length, 0);
    assert.equal(healing.game.spawnCues.filter(cue => cue.kind === 'heart').length, 1);
    wait(healing, 1);
    assert.equal(healing.game.healing.length, 1);
    assert.equal(healing.observe(), false);
    aim(healing, opposite(healing)); wait(healing, 1);
    assert.equal(healing.observe(), true);
  }
  const warnings = practice('warnings');
  wait(warnings, 2.5);
  assert.equal(warnings.game.spawnCues.length, 3);
  assert.equal(warnings.observe(), false);
  wait(warnings, .6); aim(warnings); wait(warnings, 1);
  assert.equal(warnings.observe(), true);
  const pause = practice('pause');
  pause.game.pause(); pause.observe();
  const time = pause.game.elapsed;
  wait(pause, 2);
  assert.equal(pause.game.elapsed, time);
  assert.equal(pause.observe(), false);
  pause.game.resume();
  assert.equal(pause.observe(), true);
});

test('retry and step switching isolate practice state and preserve completed topics only', () => {
  const tutorial = practice('food');
  aim(tutorial); wait(tutorial, 1);
  assert.equal(tutorial.observe(), true);
  const source = JSON.stringify(LEVELS);
  tutorial.select(indexOf('slime-blue'));
  aim(tutorial); wait(tutorial, 1.05);
  assert.equal(tutorial.held, true);
  tutorial.select(indexOf('food'));
  assert.equal(tutorial.completed.has('food'), true);
  assert.equal(tutorial.observe(), false, 'retry allows the action to be practiced again');
  assert.equal(tutorial.actions, 0);
  assert.equal(tutorial.lastBrick, undefined);
  assert.equal(tutorial.game.stuckUntil, 0);
  assert.equal(tutorial.game.enemies, 0);
  assert.equal(tutorial.game.score, 0);
  assert.equal(tutorial.game.hearts, 3);
  assert.equal(JSON.stringify(LEVELS), source);
  const campaign = new Game();
  assert.equal(campaign.level.id, '1-1');
  assert.equal(campaign.state, 'ready');
});
