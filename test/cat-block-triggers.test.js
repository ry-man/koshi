const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, CAT_BLOCK_MESSAGES, CAT_BLOCK_TRIGGERS, CAT_BRICK_TYPES, CHARACTERS,
  catBlockDescription, catBlockObjective, validateCustomLevel } = require('../src/game.js');

const level = trigger => ({
  version: 1, id: 'Cat Brick triggers', duration: 30, goal: 1, heartCost: null,
  brickSet: 1, events: [], catBlock: { description: 'Replaced hint', trigger },
});
const create = trigger => {
  const game = new Game(() => .5, { customLevel: level(trigger) });
  game.start();
  return game;
};
const win = game => {
  game.score = Math.max(1, game.score);
  game.update(.01);
  assert.equal(game.state, 'won');
  return game.catBlockCollected;
};
const triggerFor = type => ({
  type,
  ...(CAT_BLOCK_TRIGGERS[type].amount ? { amount: 2 } : {}),
  ...(CAT_BLOCK_TRIGGERS[type].enemy ? { enemyType: 'mouse' } : {}),
  ...(CAT_BLOCK_TRIGGERS[type].brick ? { brickType: 'slow' } : {}),
});

test('all 17 triggers generate the exact requested language and round-trip their parameters', () => {
  const expected = [
    'Find during gameplay when it spawns.',
    'Defeat the enemy carrying it then collect it.',
    'Collect enough keys to open the treasure chest containing it.',
    'Complete the level in under 2 seconds.',
    'Complete the level with at least 2 food points.',
    'Complete the level with at least 2 enemy points.',
    'Complete the level with at least 2 soccer goals.',
    'Complete the level in at most 2 moves.',
    'Defeat at least 2 of enemy type Robo Mouse.',
    'Defeat no more than 2 of enemy type Robo Mouse.',
    'Defeat no more than 2 enemies.',
    'Complete the level without collecting any swords.',
    'Complete the level without collecting any hearts.',
    'Complete the level with at least 2 distinct bricks of brick type Slow',
    'Complete the level with at most 2 distinct bricks of brick type Slow',
    'Complete the level without selecting any brick of type Slow.',
    'Complete the level without touching any brick of type Slow.',
  ];
  assert.equal(Object.keys(CAT_BLOCK_TRIGGERS).length, 17);
  for (const [index, type] of Object.keys(CAT_BLOCK_TRIGGERS).entries()) {
    const trigger = triggerFor(type);
    const saved = validateCustomLevel(level(trigger));
    assert.deepEqual(saved.catBlock.trigger, trigger);
    assert.equal(saved.catBlock.description, `To earn Cat Brick: ${expected[index]}`);
    assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(saved))), saved);
  }
});

test('invalid trigger types, thresholds and target types are rejected', () => {
  for (const trigger of [
    null, [], {}, { type: 'unknown' }, { type: 'toString' },
    { type: 'time', amount: 0 }, { type: 'time', amount: Infinity },
    { type: 'moves', amount: -1 }, { type: 'food', amount: 1.5 },
    { type: 'goals', amount: '2' }, { type: 'enemyPoints', amount: 100001 },
    { type: 'enemyMin', amount: 1, enemyType: 'tom' },
    { type: 'enemyMax', amount: 1, enemyType: 'koshi' },
    { type: 'enemyMin', amount: 1, enemyType: 'toString' },
    { type: 'noTouch', brickType: 'unknown' },
    { type: 'bricksMin', amount: 1, brickType: 'toString' },
  ]) assert.throws(() => validateCustomLevel(level(trigger)), /Cat Brick/);
  assert.equal(validateCustomLevel(level({ type: 'time', amount: .5 })).catBlock.trigger.amount, .5);
  for (const type of Object.keys(CAT_BLOCK_TRIGGERS).filter(type => CAT_BLOCK_TRIGGERS[type].amount && type !== 'time')) {
    assert.equal(validateCustomLevel(level({ ...triggerFor(type), amount: 0 })).catBlock.trigger.amount, 0);
  }
});

test('pickup triggers only accept their selected acquisition method; achievements cannot be bypassed by pickups', () => {
  for (const [type, source] of [['spawn', 'item'], ['carrier', 'enemy'], ['chest', 'chest']]) {
    const game = create({ type });
    for (const other of ['item', 'enemy', 'chest'].filter(value => value !== source)) {
      game.collectItem(other === 'chest' ? { type: 'treasure-chest' } : { type: 'cat-block', source: other });
      assert.equal(game.catBlockCollected, false);
    }
    game.keys = 2;
    if (source === 'chest') {
      game.collectItem({ type: 'treasure-chest', keysRequired: 3 });
      assert.equal(game.catBlockCollected, false);
      game.keys++;
    }
    game.collectItem(source === 'chest' ? { type: 'treasure-chest', keysRequired: 3 } : { type: 'cat-block', source });
    assert.equal(game.catBlockCollected, true);
    assert.deepEqual(game.catBlockEvents, [source]);
  }
  const game = create({ type: 'food', amount: 10 });
  game.collectItem({ type: 'cat-block' });
  game.keys = 3;
  game.collectItem({ type: 'treasure-chest' });
  assert.equal(game.catBlockCollected, false);
  assert.equal(game.keys, 3, 'a chest cannot spend keys on an ineligible reward');
});

test('completion thresholds use strict time, inclusive score/goal/move boundaries and only award at victory', () => {
  for (const [type, field, amount, passing, failing] of [
    ['time', 'elapsed', 5, 4.98, 5],
    ['food', 'score', 5, 5, 4],
    ['enemyPoints', 'enemies', 5, 5, 4],
    ['goals', 'goals', 2, 2, 1],
    ['moves', 'moves', 2, 2, 3],
  ]) {
    for (const [value, expected] of [[passing, true], [failing, false]]) {
      const game = create({ type, amount });
      game[field] = value;
      game.checkCatBlockAchievement();
      assert.equal(game.catBlockCollected, false, `${type} must wait for victory`);
      assert.equal(win(game), expected, `${type}: ${value}`);
      if (expected) assert.deepEqual(game.catBlockEvents, ['achievement']);
    }
  }
  const game = create({ type: 'time', amount: 1 });
  game.elapsed = 1 - 1 / 120;
  assert.equal(win(game), false, 'exact time boundary is not under the limit');
});

test('defeat achievements count individuals by type, not shield points, and upper limits wait for victory', () => {
  const enemy = (type = 'mouse') => ({ type, x: 100, y: 100, defeatPoints: 5 });
  const game = create({ type: 'enemyMin', amount: 2, enemyType: 'mouse' });
  game.defeatEnemy(enemy('wheel'));
  game.defeatEnemy(enemy(), false);
  game.defeatEnemy(enemy());
  assert.equal(game.catBlockCollected, false);
  game.defeatEnemy(enemy());
  assert.equal(game.catBlockCollected, true);
  assert.equal(game.enemies, 15);
  game.reset();
  assert.equal(game.catBlockCollected, false);
  assert.deepEqual(game.catBlockProgress.defeated, {});
  for (const type of ['enemyMax', 'enemiesMax']) {
    for (const [count, expected] of [[2, true], [3, false]]) {
      const game = create({ type, amount: 2, ...(type === 'enemyMax' ? { enemyType: 'mouse' } : {}) });
      game.defeatEnemy(enemy(), false);
      if (type === 'enemyMax') game.defeatEnemy(enemy('wheel'));
      for (let i = 0; i < count; i++) game.defeatEnemy(enemy());
      assert.equal(game.catBlockCollected, false);
      assert.equal(win(game), expected);
    }
  }
});

test('no-sword/no-heart achievements track actual pickups, including full health and later exhaustion', () => {
  for (const type of ['noSwords', 'noHearts']) {
    assert.equal(win(create({ type })), true);
    const game = create({ type });
    const point = { x: game.cat.x, y: game.cat.y };
    if (type === 'noSwords') game.weapons = [{ ...point, type: 'wood' }];
    else game.healing = [point];
    game.combat(.01, point.x, point.y);
    assert.equal(game.catBlockProgress[type === 'noSwords' ? 'swords' : 'hearts'], 1);
    game.weapon = null;
    assert.equal(win(game), false);
    game.reset(); game.start();
    assert.equal(win(game), true);
  }
});

test('distinct brick thresholds inspect the final board and count merged groups once, including modifiers', () => {
  for (const type of ['bricksMin', 'bricksMax']) {
    for (const [amount, expected] of (type === 'bricksMin' ? [[1, true], [2, false]] : [[1, true], [0, false]])) {
      const game = create({ type, amount, brickType: 'spawner' });
      const [owner, member] = game.bricks;
      owner.spawner = member.spawner = { kind: 'food', type: 'S', lifetime: 5 };
      member.absorbedBy = owner.id;
      assert.equal(win(game), expected);
    }
  }
  const game = create({ type: 'bricksMin', amount: 2, brickType: 'fast' });
  game.bricks[0].kind = 'fast';
  game.bricks[1].kind = 'fast';
  game.bricks[0].absorbedBy = game.bricks[1].id;
  for (const brick of game.bricks.slice(2)) brick.kind = 'normal';
  assert.equal(win(game), false, 'merged fast bricks are one distinct brick');
});

test('selection restrictions remember types before a brick changes and ignore unsuccessful selections', () => {
  const game = create({ type: 'noSelect', brickType: 'spawner' });
  const brick = game.bricks.find(brick => brick.kind === 'normal');
  brick.spawner = { kind: 'food', type: 'S', lifetime: 5 };
  assert.equal(game.steer(brick.id, NaN, NaN), false);
  assert.equal(game.catBlockProgress.selected.size, 0);
  assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
  brick.spawner = null;
  game.cat.vx = 0; game.cat.vy = 0;
  assert.equal(win(game), false);
  assert.equal(win(create({ type: 'noSelect', brickType: 'slow' })), true);
});

test('touch restrictions detect unselected bricks in swept collisions and stationary contacts', () => {
  for (const moving of [false, true]) {
    const game = create({ type: 'noTouch', brickType: 'slow' });
    const brick = game.bricks.find(brick => brick.kind === 'slow');
    game.cat.x = brick.x + brick.w / 2;
    game.cat.y = brick.y + brick.h + game.cat.radius + (moving ? 1 : 0);
    game.cat.vy = moving ? -420 : 0;
    assert.equal(win(game), false);
    assert.equal(game.moves, 0);
    assert.equal(game.catBlockProgress.touched.has('slow'), true);
  }
  assert.equal(win(create({ type: 'noTouch', brickType: 'slow' })), true);
  const painted = create({ type: 'noTouch', brickType: 'fast' });
  const brick = painted.bricks.find(brick => brick.kind === 'slow');
  painted.cat.x = brick.x + brick.w / 2;
  painted.cat.y = brick.y + brick.h + painted.cat.radius + 1;
  painted.cat.vy = -420;
  painted.collectItem({ type: 'paint-pencil-red' });
  assert.equal(win(painted), false, 'a brick painted on contact is still being touched at victory');
  assert.equal(brick.kind, 'fast');
});

test('failed runs never earn completion rewards and survival evaluates at timeout', () => {
  const game = create({ type: 'noSwords' });
  game.hearts = 0;
  game.update(.01);
  assert.equal(game.state, 'lost');
  assert.equal(game.catBlockCollected, false);
  const survival = new Game(() => .5, { customLevel: { ...level({ type: 'moves', amount: 0 }), goal: 0, survive: true, duration: 1 } });
  survival.start();
  for (let i = 0; i < 100; i++) survival.update(.01);
  assert.equal(survival.state, 'won');
  assert.equal(survival.catBlockCollected, true);
});

test('editor exposes all trigger options, shows only required parameters and preserves them through settings', () => {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', children: [], listeners: {},
      replaceChildren() {}, checkValidity: () => true,
      append(child) { this.children.push(child); },
      addEventListener(type, handler) { this.listeners[type] = handler; } });
    return nodes.get(selector);
  };
  const context = vm.createContext({ $, CAT_BLOCK_MESSAGES, CAT_BLOCK_TRIGGERS, CAT_BRICK_TYPES, CHARACTERS,
    catBlockDescription, catBlockObjective,
    level: { ...level(undefined), catBlock: undefined },
    readOnly: () => false,
    document: { createElement: () => ({}) }, validateDraft: validateCustomLevel,
    attempt: action => action(), markChanged() {}, render() {}, message() {} });
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf("for (const [selector, entries]"), source.indexOf('function addSceneLine(')), context);
  assert.equal($('#cat-block-trigger').children.length, 17);
  assert.equal($('#cat-block-enemy-type').children.length, 13);
  assert.ok($('#cat-block-brick-type').children.some(option => option.value === 'spawner'));
  context.populateSettings();
  $('#cat-block-enabled').checked = true;
  for (const type of Object.keys(CAT_BLOCK_TRIGGERS)) {
    $('#cat-block-trigger').value = type;
    $('#cat-block-amount').value = '2';
    $('#cat-block-enemy-type').value = 'mouse';
    $('#cat-block-brick-type').value = 'slow';
    $('#cat-block-trigger').listeners.change();
    for (const field of ['amount', 'enemy', 'brick']) {
      assert.equal($(`#cat-block-${field}-label`).hidden, !CAT_BLOCK_TRIGGERS[type][field]);
    }
    $('#settings-form').listeners.submit({ preventDefault() {} });
    assert.deepEqual(JSON.parse(JSON.stringify(context.level.catBlock.trigger)), triggerFor(type));
    assert.equal(context.level.catBlock.description, catBlockDescription(triggerFor(type)));
    assert.equal($('#cat-block-objective').textContent, context.level.catBlock.description);
    assert.deepEqual(JSON.parse(JSON.stringify(context.level.catBlock.messages)), CAT_BLOCK_MESSAGES);
  }
  $('#cat-block-trigger').value = 'enemyMin';
  $('#cat-block-amount').value = '9';
  $('#cat-block-amount').listeners.input();
  assert.equal($('#cat-block-objective').textContent,
    catBlockDescription({ type: 'enemyMin', amount: 9, enemyType: 'mouse' }));
  $('#cat-block-enemy-type').value = 'wheel';
  $('#cat-block-enemy-type').listeners.change();
  assert.equal($('#cat-block-objective').textContent,
    catBlockDescription({ type: 'enemyMin', amount: 9, enemyType: 'wheel' }));
  $('#cat-block-trigger').value = 'bricksMax';
  $('#cat-block-brick-type').value = 'fast';
  $('#cat-block-brick-type').listeners.change();
  assert.equal($('#cat-block-objective').textContent,
    catBlockDescription({ type: 'bricksMax', amount: 9, brickType: 'fast' }));
  context.level = { ...level(undefined), catBlock: { description: 'Legacy hint' } };
  context.populateSettings();
  assert.equal($('#cat-block-trigger').value, '');
  $('#settings-form').listeners.submit({ preventDefault() {} });
  assert.equal(context.level.catBlock.description, 'Legacy hint');
  assert.equal($('#cat-block-objective').textContent, 'Legacy hint');
  assert.equal(context.level.catBlock.trigger, undefined);
  context.level.brickSet = 3;
  context.populateSettings();
  $('#settings-form').listeners.submit({ preventDefault() {} });
  assert.equal(context.level.brickSet, 3, 'removing the preset control must not change imported brick layouts');
  $('#cat-block-enabled').checked = false;
  $('#cat-block-enabled').listeners.change();
  assert.equal($('#cat-block-settings').hidden, true);
});

const item = (type, extra = {}) => ({ time: 0, kind: 'item', type, x: .5, y: .5, ...extra });
const carrier = extra => ({ time: 0, kind: 'enemy', type: 'mouse', x: .3, y: .4, ...extra });
const save = value => validateCustomLevel(value, { requireCatBlockConsistency: true });

test('save consistency rejects missing and conflicting reward sources, but permits incomplete editing', () => {
  const methods = {
    spawn: item('cat-block'),
    carrier: carrier({ carriesCatBlock: true }),
    chest: item('treasure-chest'),
  };
  for (const [type, source] of Object.entries(methods)) {
    const draft = level({ type });
    assert.doesNotThrow(() => validateCustomLevel(draft), 'editing can temporarily omit a source');
    assert.throws(() => save(draft), /requires a matching/);
    const events = [source, ...(type === 'chest' ? [item('key')] : [])];
    assert.doesNotThrow(() => save({ ...draft, events }));
    for (const [other, conflict] of Object.entries(methods)) {
      if (other !== type) assert.throws(() => save({ ...draft, events: [...events, conflict] }), /do not match/);
    }
    assert.throws(() => save({ ...level({ type: 'noSwords' }), events }), /Achievement/);
    assert.throws(() => save({ ...draft, catBlock: undefined, events }), /Enable Cat Block/);
  }
  assert.doesNotThrow(() => save(level({ type: 'noSwords' })));
  assert.throws(() => save(level(undefined)), /requires a collection trigger/);
  assert.doesNotThrow(() => save({ ...level(undefined), events: [item('cat-block')] }));
});

test('save checks count keys, key carriers and battery-recharged key spawners for chests', () => {
  const draft = { ...level({ type: 'chest' }), events: [item('treasure-chest', { keysRequired: 3 }), item('key')] };
  assert.throws(() => save(draft), /more keys/);
  const withCarriers = { ...draft, events: [...draft.events, carrier({ carriesKey: true }), carrier({ carriesKey: true })] };
  assert.doesNotThrow(() => save(withCarriers));
  const keySpawner = { edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'item', type: 'key' } };
  const withSpawner = { ...draft, brickTypes: [keySpawner] };
  assert.throws(() => save(withSpawner), /more keys/);
  assert.doesNotThrow(() => save({ ...withSpawner, events: [...draft.events, item('battery')] }));
  assert.doesNotThrow(() => save({ ...withSpawner, brickTypes: [keySpawner,
    { edge: 'bottom', start: 0, end: .1, kind: 'normal', spawner: { kind: 'item', type: 'battery' } },
  ] }));
  assert.throws(() => save({ ...withSpawner, events: [
    item('treasure-chest', { keysRequired: 4 }), item('key'),
  ], brickTypes: [keySpawner,
    { edge: 'bottom', start: 0, end: .1, kind: 'normal', spawner: { kind: 'item', type: 'battery' } },
  ] }), /more keys/, 'recharging a battery spawner consumes the battery it replaces');
  assert.throws(() => save({ ...draft, events: [...draft.events, item('battery'), item('battery')] }), /more keys/);
});

test('save consistency permits only one Cat Brick source, including legacy hints and effective spawners', () => {
  const methods = [
    ['spawn', item('cat-block')],
    ['carrier', carrier({ carriesCatBlock: true })],
    ['chest', item('treasure-chest')],
  ];
  for (const [type, source] of methods) {
    for (const trigger of [{ type }, undefined]) {
      const draft = { ...level(trigger), events: [source, source, item('key')] };
      assert.doesNotThrow(() => validateCustomLevel(draft), 'incomplete edits remain possible');
      assert.throws(() => save(draft), /only one Cat Brick source/);
      assert.doesNotThrow(() => save({ ...draft, events: [source, item('key')] }));
    }
  }
  const { brickEditRegions } = require('../src/game.js');
  const game = create({ type: 'spawn' });
  const regions = brickEditRegions(game.bricks);
  const [owner, member] = game.bricks.filter(brick => regions.get(brick.id).edge === 'top')
    .sort((a, b) => regions.get(a.id).start - regions.get(b.id).start);
  const brickTypes = [owner, member].map(brick => ({
    ...regions.get(brick.id), kind: 'normal', spawner: { kind: 'item', type: 'cat-block' },
  }));
  const draft = { ...level({ type: 'spawn' }), brickTypes };
  assert.throws(() => save(draft), /only one Cat Brick source/);
  assert.throws(() => save({ ...draft, brickTypes: [brickTypes[0]], events: [item('cat-block')] }), /only one Cat Brick source/);
  assert.doesNotThrow(() => save({ ...draft, brickGroups: [{ owner: owner.id, members: [owner.id, member.id] }] }),
    'one merged spawning brick counts as one source');
  assert.doesNotThrow(() => save({ ...draft, brickTypes: [brickTypes[0], brickTypes[0]] }),
    'superseded overrides are not additional sources');
});

test('save consistency uses effective spawners rather than overridden or absorbed brick data', () => {
  const spawner = { edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'item', type: 'cat-block' } };
  assert.doesNotThrow(() => save({ ...level({ type: 'spawn' }), brickTypes: [spawner] }));
  assert.throws(() => save({ ...level({ type: 'spawn' }), brickTypes: [spawner, { ...spawner, spawner: null }] }), /requires a matching/);
  const game = create({ type: 'spawn' });
  const { brickEditRegions } = require('../src/game.js');
  const regions = brickEditRegions(game.bricks);
  const [owner, member] = game.bricks.filter(brick => regions.get(brick.id).edge === 'top')
    .sort((a, b) => regions.get(a.id).start - regions.get(b.id).start);
  const draft = { ...level({ type: 'spawn' }),
    brickTypes: [{ ...regions.get(member.id), kind: 'normal', spawner: spawner.spawner }],
    brickGroups: [{ owner: owner.id, members: [owner.id, member.id] }],
  };
  assert.throws(() => save(draft), /requires a matching/);
  const chestSpawner = { ...spawner, spawner: { kind: 'item', type: 'treasure-chest' } };
  assert.throws(() => save({ ...level({ type: 'chest' }), brickTypes: [chestSpawner] }), /more keys/);
  assert.doesNotThrow(() => save({ ...level({ type: 'chest' }), brickTypes: [chestSpawner], events: [item('key')] }));
  assert.throws(() => save({ ...level({ type: 'spawn' }), brickTypes: [chestSpawner], events: [item('cat-block')] }), /do not match/);
});

test('Cat Brick messages are built-in even when imported data supplies overrides', () => {
  const saved = validateCustomLevel({ ...level({ type: 'spawn' }), catBlock: {
    ...level({ type: 'spawn' }).catBlock, messages: { item: 'Override', enemy: 'Override', chest: 'Override', achievement: 'Override' },
  } });
  assert.deepEqual(saved.catBlock.messages, CAT_BLOCK_MESSAGES);
});

test('all persistence and playtest actions reject inconsistent Cat Brick data before writing or navigating', () => {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { listeners: {}, value: '',
      addEventListener(type, handler) { this.listeners[type] = handler; } });
    return nodes.get(selector);
  };
  let writes = 0;
  const context = vm.createContext({ $, level: level({ type: 'spawn' }), validateCustomLevel,
    localStorage: { setItem() { writes++; } }, storageKey: 'test-draft', readOnly: () => false,
    attempt: action => action(), window: { addEventListener() {} }, message() {} });
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('function validateSavedLevel('), source.indexOf('window.addEventListener(\'beforeunload\'')), context);
  for (const selector of ['#save-draft', '#generate-json', '#download-json', '#playtest']) {
    assert.throws(() => $(selector).listeners.click({ preventDefault() {} }), /requires a matching/, selector);
  }
  context.level = { ...level({ type: 'spawn' }), events: [item('cat-block'), item('cat-block')] };
  for (const selector of ['#save-draft', '#generate-json', '#download-json', '#playtest']) {
    assert.throws(() => $(selector).listeners.click({ preventDefault() {} }), /only one Cat Brick source/, selector);
  }
  assert.equal(writes, 0);
  assert.equal($('#level-json').value, '');
  context.level = { ...level({ type: 'spawn' }), events: [item('cat-block')] };
  $('#save-draft').listeners.click();
  assert.equal(writes, 1);
});

test('editor markup has no boundary preset, editable reward messages or helper paragraphs', () => {
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  assert.doesNotMatch(html, /id="brick-set"|id="cat-block-description"|id="cat-block-(?:item|enemy|chest)-message"|editor-help|Awarded automatically/);
  assert.match(html, /<details class="cat-block-section full-width">/);
});
