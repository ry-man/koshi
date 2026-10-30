const test = require('node:test');
const assert = require('node:assert/strict');
const { GUIDE, LESSONS, Tutorial } = require('../src/learning.js');
const { Game, SWORDS, LEVELS, brickRegions } = require('../src/game.js');

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
  assert.equal(GUIDE.length, 8);
  assert.equal(LESSONS.length, 16);
  assert.equal(new Set(LESSONS.map(lesson => lesson.id)).size, LESSONS.length);
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

test('guide illustrates every brick, enemy, heart, and weapon without a story section', () => {
  const pictures = GUIDE.flatMap(chapter => chapter.sections.map(([, , picture]) => picture).filter(Boolean));
  for (const picture of [
    'brick:slow', 'brick:normal', 'brick:fast', 'brick:crumbler', 'brick:warped', 'brick:warped-crumbler',
    'slime:blue', 'slime:green', 'slime:red', 'brick:springs', 'brick:spikes', 'heart',
    'enemy:mouse', 'enemy:wheel', ...Object.keys(SWORDS).map(type => `weapon:${type}`),
  ]) assert.ok(pictures.includes(picture), `missing illustration: ${picture}`);
  assert.equal(new Set(pictures).size, pictures.length);
  for (const chapter of GUIDE) {
    assert.doesNotMatch(chapter.title, /story/i);
    for (const [title, description] of chapter.sections) assert.doesNotMatch(`${title} ${description}`, /story|cutscene/i);
  }
  assert.ok(GUIDE.some(chapter => chapter.title === 'Objectives'));
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

  test(`sword pickups and both enemy intercepts complete without damage on ${layout}`, () => {
    for (const id of ['mouse', 'wheel', 'objectives']) {
      for (const sword of Object.keys(SWORDS)) {
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
