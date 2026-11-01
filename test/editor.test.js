const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, validateCustomLevel, levelObjective, snapWheel, FOODS, SWORDS, brickRegions, brickEditRegions, COOLDOWNS } = require('../src/game.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const blank = () => ({ version: 1, id: 'Designer level', duration: 30, goal: 50, heartCost: null, brickSet: 3, events: [] });
const event = (kind = 'food', type = 'S', time = 2) => ({ kind, type, time, x: .2, y: .7, ...(kind === 'food' ? { lifetime: 5 } : {}) });

test('campaign editor previews use every real schedule and preserve the original game levels', () => {
  const { LEVELS } = require('../src/game.js');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const before = JSON.stringify(LEVELS);
  const context = vm.createContext({ Game });
  vm.runInContext(source.slice(source.indexOf('function campaignPreview('), source.indexOf('function syncAccess(')), context);
  for (const [index, campaign] of LEVELS.entries()) {
    const preview = context.campaignPreview(index);
    assert.equal(preview.id, campaign.id);
    assert.equal(preview.duration, campaign.duration);
    assert.equal(preview.goal, campaign.goal);
    assert.equal(preview.killGoal, campaign.killGoal);
    assert.equal(preview.survive, campaign.survive);
    assert.equal(preview.goalsGoal, campaign.goalsGoal);
    assert.equal(preview.activationLimit, campaign.activationLimit);
    assert.equal(preview.brickTypes, campaign.brickTypes);
    assert.equal(preview.brickGroups, campaign.brickGroups);
    assert.equal(preview.cutscene, campaign.cutscene);
    assert.equal(preview.events.length,
      campaign.food.reduce((sum, [, method]) => sum + (method === 'S' ? 1 : Number(method.slice(1))), 0)
      + campaign.enemies.reduce((sum, [, , count]) => sum + count, 0)
      + campaign.items.length + campaign.weapons.length + (campaign.events?.length ?? 0));
    for (const event of campaign.events ?? []) assert.ok(preview.events.includes(event));
    validateCustomLevel({ ...preview, version: 1 });
    assert.equal(JSON.stringify(context.campaignPreview(index)), JSON.stringify(preview), 'representative positions stay stable');
    for (const [kind, schedule] of [['food', campaign.food], ['enemy', campaign.enemies], ['item', campaign.items], ['weapon', campaign.weapons]]) {
      for (const [time, typeOrMethod, typeOrCount, lifetimeOrShield] of schedule) {
        const type = kind === 'food' ? typeOrCount : typeOrMethod;
        const matches = preview.events.filter(event => event.kind === kind && event.time === time && event.type === type);
        assert.ok(matches.length);
        if (kind === 'food') assert.ok(matches.every(event => event.lifetime === lifetimeOrShield));
        if (kind === 'enemy' && lifetimeOrShield) assert.ok(matches.every(event => event.shield === lifetimeOrShield));
      }
    }
    assert.ok(preview.events.every(event => Number.isFinite(event.x) && Number.isFinite(event.y)));
  }
  assert.equal(JSON.stringify(LEVELS), before);
});

test('read-only campaign controls lock all write surfaces but leave inspection available', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { disabled: false, hidden: false, setAttribute() {} });
    return nodes.get(selector);
  };
  let locked = true;
  const accessFields = ['#settings-access', '#cutscene-access', '#inspector-access', '#files-access'];
  const writeButtons = ['#place-mode', '#new-level'];
  const board = { dataset: {} };
  const context = vm.createContext({ $, board, accessFields, writeButtons, readOnly: () => locked, level: { id: '1-19', name: 'Finale' } });
  vm.runInContext(source.slice(source.indexOf('function syncAccess('), source.indexOf('function selectEditorLevel(')), context);
  context.syncAccess();
  for (const selector of [...accessFields, ...writeButtons]) assert.equal($(selector).disabled, true);
  for (const selector of accessFields) assert.ok(html.includes(`<fieldset id="${selector.slice(1)}"`));
  assert.equal(board.dataset.readOnly, 'true');
  assert.equal($('#playtest').textContent, 'Play game level →');
  for (const selector of ['#editor-level', '#timeline', '#orientation', '#show-all', '#select-mode']) assert.equal($(selector).disabled, false);
  locked = false; context.syncAccess();
  for (const selector of [...accessFields, ...writeButtons]) assert.equal($(selector).disabled, false);
  assert.equal(board.dataset.readOnly, 'false');
  for (const fn of ['markChanged', 'moveEvent', 'placeAt', 'startPlacement', 'deleteSelected']) {
    assert.match(source.slice(source.indexOf(`function ${fn}(`)), /^function [^{]+\{\s+if \(readOnly\(\)\) return;/);
  }
  assert.ok(source.includes("if (readOnly()) { down.stopPropagation(); return; }"), 'campaign markers cannot be dragged');
});

test('campaign play links choose the original game level and malformed links report an error', () => {
  const { LEVELS } = require('../src/game.js');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const start = source.indexOf("if (location.hash.startsWith('#campaign='))");
  const script = source.slice(start, source.indexOf('function layoutOptions()', start));
  for (const [hash, expected] of [['#campaign=1-19', '18'], ['#campaign=1-34', '33'], ['#campaign=unknown', null], ['#campaign=%', null]]) {
    const levelSelect = { value: '0' }, error = { hidden: true }, failures = [];
    const context = vm.createContext({ location: { hash }, LEVELS, levelSelect,
      document: { querySelector: () => error }, console: { error: (...args) => failures.push(args) } });
    vm.runInContext(script, context);
    if (expected) { assert.equal(levelSelect.value, expected); assert.equal(error.hidden, true); }
    else { assert.equal(error.hidden, false); assert.equal(failures.length, 1); }
  }
});

test('enemy shields round-trip in placements and spawners and initialize their full score value', () => {
  for (const shield of [null, 'red', 'green', 'blue']) {
    const source = { ...blank(), events: [{ ...event('enemy', 'ram'), shield }],
      brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'enemy', type: 'bucket', shield } }] };
    const normalized = validateCustomLevel(JSON.parse(JSON.stringify(source)));
    assert.deepEqual(normalized.events, source.events);
    assert.deepEqual(normalized.brickTypes, source.brickTypes);
    const game = new Game(() => .5, { customLevel: normalized });
    const enemy = game.createCustomSpawn(normalized.events[0])[0];
    assert.equal(enemy.shield, shield);
    assert.equal(enemy.defeatPoints, shield === 'blue' ? 4 : shield === 'green' ? 3 : shield === 'red' ? 2 : 1);
    const brick = game.bricks.find(brick => brick.spawner);
    game.spawnFromBrick(brick);
    assert.equal(game.robots[0].shield, shield);
    assert.equal(game.robots[0].defeatPoints, enemy.defeatPoints);
  }
  for (const shield of ['yellow', false, 3, {}]) {
    assert.throws(() => validateCustomLevel({ ...blank(), events: [{ ...event('enemy', 'mouse'), shield }] }), /shield/);
  }
  assert.throws(() => validateCustomLevel({ ...blank(), events: [{ ...event(), shield: 'red' }] }), /shield/);
});

test('win conditions validate and round-trip without changing older level JSON', () => {
  for (const patch of [{ goal: 20 }, { goal: 0, killGoal: 30 }, { goal: 20, killGoal: 30 },
    { goal: 0, survive: true }, { goal: 0, killGoal: 0, survive: true }]) {
    const source = { ...blank(), ...patch };
    assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(source))), source);
  }
  for (const patch of [{ goal: 0 }, { goal: 0, killGoal: 0 }, { killGoal: -1 },
    { killGoal: 1.5 }, { killGoal: '30' }, { killGoal: Infinity }, { killGoal: 100001 },
    { survive: 'true' }, { survive: true }, { goal: 0, killGoal: 1, survive: true }]) {
    assert.throws(() => validateCustomLevel({ ...blank(), ...patch }), TypeError);
  }
  assert.deepEqual(validateCustomLevel(blank()), blank());
});

test('food-only, enemy-only, and combined objectives win only when all required scores are met', () => {
  for (const targets of [{ goal: 2 }, { goal: 0, killGoal: 2 }, { goal: 2, killGoal: 2 }]) {
    const game = new Game(() => .5, { customLevel: { ...blank(), ...targets } });
    game.start(); game.update(.01);
    assert.equal(game.state, 'playing');
    game.score = targets.goal;
    if (targets.killGoal) {
      game.update(.01);
      assert.equal(game.state, 'playing', 'food cannot satisfy an enemy objective');
      game.enemies = targets.killGoal;
      if (targets.goal) {
        game.score = 0; game.update(.01);
        assert.equal(game.state, 'playing', 'enemy defeats cannot satisfy a food objective');
        game.score = targets.goal;
      }
    }
    game.update(.01);
    assert.equal(game.state, 'won');
    game.reset(); game.start(); game.update(30);
    assert.equal(game.state, 'lost', 'unmet scores lose at the time limit');
  }
});

test('survival wins exactly at timeout, freezes on pause, resets, and never overrides death', () => {
  const create = () => new Game(() => .5, { customLevel: { ...blank(), duration: 1, goal: 0, survive: true } });
  const game = create(); game.start(); game.update(.5);
  assert.equal(game.state, 'playing');
  game.score = 100; game.enemies = 100;
  game.pause(); game.update(10);
  assert.equal(game.elapsed, .5);
  game.resume(); game.update(.49);
  assert.equal(game.state, 'playing');
  game.update(.01);
  assert.equal(game.state, 'won');
  assert.equal(game.elapsed, 1);
  game.reset();
  assert.equal(game.elapsed, 0);
  assert.equal(game.state, 'ready');
  for (const lose of [g => { g.hearts = 0; }, g => { g.cat.x = -100; }]) {
    const dying = create(); dying.start(); dying.elapsed = 1 - 1 / 120;
    lose(dying); dying.update(1 / 120);
    assert.equal(dying.state, 'lost', 'death at the deadline takes priority over survival');
  }
});

test('briefings clearly state each available win condition', () => {
  assert.equal(levelObjective({ duration: 60, goal: 20 }), 'Collect 20 food before time runs out (60 seconds)');
  assert.equal(levelObjective({ duration: 60, goal: 0, killGoal: 30 }), 'Earn 30 enemy points before time runs out (60 seconds)');
  assert.equal(levelObjective({ duration: 60, goal: 20, killGoal: 30 }), 'Collect 20 food and earn 30 enemy points before time runs out (60 seconds)');
  assert.equal(levelObjective({ duration: 60, goal: 0, survive: true }), 'Survive for 60 seconds until the timer reaches zero');
});

test('HUD marks only required score targets or the survival timer and tracks objective progress', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const start = source.indexOf('  const { goal: GOAL');
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) {
      const classes = new Set();
      nodes.set(selector, { textContent: '', innerHTML: '', style: {}, attributes: {},
        classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) },
        setAttribute(name, value) { this.attributes[name] = value; } });
    }
    return nodes.get(selector);
  };
  const game = { level: {}, score: 10, enemies: 15, goals: 10, elapsed: 30, timeLimit: 60, hearts: 3, batteries: 0 };
  const context = vm.createContext({ game, levelObjective, document: { querySelector: node },
    timer: node('#timer'), foodCount: node('#food-count'), hearts: node('#hearts'),
    progress: node('#progress'), progressLabel: node('#progress-label') });
  const hud = source.slice(start, source.indexOf('  const weaponCount', start));
  for (const [patch, targets, progress] of [
    [{ goal: 20 }, [false, true, false, false], '50%'],
    [{ goal: 0, killGoal: 30 }, [false, false, true, false], '50%'],
    [{ goal: 20, killGoal: 60 }, [false, true, true, false], '25%'],
    [{ goal: 0, goalsGoal: 20 }, [false, false, false, true], '50%'],
    [{ goal: 20, killGoal: 60, goalsGoal: 40 }, [false, true, true, true], '25%'],
    [{ goal: 0, survive: true }, [true, false, false, false], '50%'],
  ]) {
    game.level = { id: 'HUD preview', duration: 60, ...patch };
    vm.runInContext(`{${hud}}`, context);
    ['#timer', '#food-count', '#enemy-count', '#goal-count'].forEach((id, i) => assert.equal(node(id).classList.contains('win-target'), targets[i]));
    assert.equal(node('#progress').style.width, progress);
    assert.equal(node('#food-count').innerHTML.includes(`/ ${patch.goal}`), targets[1]);
    assert.equal(node('#enemy-count').textContent.includes(`/ ${patch.killGoal}`), targets[2]);
    assert.equal(node('#goal-count').textContent.includes(`/ ${patch.goalsGoal}`), targets[3]);
    if (targets[3]) {
      assert.equal(node('#goal-count').attributes['aria-label'], `${game.goals} of ${patch.goalsGoal} goals scored`);
    }
    assert.equal(node('.objective strong').textContent, levelObjective(game.level));
  }
  game.level = { id: 'Heart progress', duration: 60, goal: 100, heartCost: 10 };
  for (const [score, nextHeart, earned] of [[0, 10, 0], [4, 10, 4], [10, 20, 0], [24, 30, 4]]) {
    game.score = score; game.nextHeart = nextHeart;
    vm.runInContext(`{${hud}}`, context);
    assert.equal(node('#heart-cost').hidden, false);
    assert.equal(node('#heart-cost-numbers').textContent, `${earned}/10`);
    assert.equal(node('#heart-cost-fill').style.width, `${earned * 10}%`);
    assert.equal(node('#heart-cost-meter').attributes['aria-valuenow'], earned);
    assert.equal(node('#heart-cost-meter').attributes['aria-valuemax'], 10);
  }
  for (const heartCost of [null, Infinity]) {
    game.level.heartCost = heartCost;
    vm.runInContext(`{${hud}}`, context);
    assert.equal(node('#heart-cost').hidden, true);
  }
});

test('editor settings select exclusive survival or score targets and preserve imported targets', () => {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', disabled: false, listeners: {},
      addEventListener(type, listener) { this.listeners[type] = listener; } });
    return nodes.get(selector);
  };
  const messages = [];
  const context = vm.createContext({ $, level: blank(), validateDraft: validateCustomLevel,
    attempt: action => action(), markChanged() {}, render() {}, message: text => messages.push(text) });
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf("$('#settings-form').addEventListener"), source.indexOf('function addSceneLine(')), context);
  context.populateSettings();
  const apply = () => $('#settings-form').listeners.submit({ preventDefault() {} });
  $('#win-condition').value = 'survive';
  $('#win-condition').listeners.change();
  assert.equal($('#goal').disabled, true);
  assert.equal($('#kill-goal').disabled, true);
  assert.equal($('#goals-goal').disabled, true);
  apply();
  assert.equal(context.level.survive, true); assert.equal(context.level.goal, 0); assert.equal(context.level.killGoal, 0);
  $('#win-condition').value = 'scores'; $('#win-condition').listeners.change();
  assert.equal($('#goal').disabled, false);
  assert.equal($('#goals-goal').disabled, false);
  $('#kill-goal').value = '30';
  apply();
  assert.equal(context.level.survive, false); assert.equal(context.level.goal, 0); assert.equal(context.level.killGoal, 30);
  context.level = { ...blank(), killGoal: 10, goalsGoal: 3 };
  context.populateSettings();
  assert.equal($('#goal').value, 50); assert.equal($('#kill-goal').value, 10);
  assert.equal($('#goals-goal').value, 3);
  assert.equal($('#win-condition').value, 'scores');
  $('#goal').value = '0'; $('#kill-goal').value = '0'; $('#goals-goal').value = '2';
  apply();
  assert.equal(context.level.goalsGoal, 2);
  assert.equal(context.level.goal, 0);
  assert.equal(context.level.killGoal, 0);
  $('#goals-goal').value = '1.5';
  const saved = JSON.stringify(context.level);
  assert.throws(apply, /soccer|goal/i);
  assert.equal(JSON.stringify(context.level), saved);
  $('#win-condition').value = 'survive';
  apply();
  assert.equal(context.level.goalsGoal, 0);
  assert.equal(context.level.survive, true);
  assert.equal(messages.length, 4);
});

test('desktop rotates phone bricks clockwise with stable IDs, edit slots, attributes, and adjacency', () => {
  const desktop = new Game(Math.random, { customLevel: blank() });
  const expected = brickEditRegions(desktop.bricks);
  const desktopRegions = brickRegions(desktop.bricks, desktop.width, desktop.height);
  const counts = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const region of desktopRegions.values()) counts[region.edge]++;
  assert.deepEqual(counts, { top: 8, bottom: 8, left: 5, right: 5 });
  const rotatedEdges = { top: 'right', right: 'bottom', bottom: 'left', left: 'top' };
  for (const scale of [.31, .36, .46, .57, .64, 1]) {
    const phone = new Game(Math.random, { portrait: true, scale, customLevel: blank() });
    const phoneRegions = brickRegions(phone.bricks, phone.width, phone.height);
    const phoneCounts = { top: 0, bottom: 0, left: 0, right: 0 };
    for (const region of phoneRegions.values()) phoneCounts[region.edge]++;
    assert.deepEqual(phoneCounts, { top: 5, bottom: 5, left: 8, right: 8 });
    assert.equal(phone.bricks.length, 26);
    assert.deepEqual(brickEditRegions(phone.bricks), expected);
    assert.deepEqual(phone.bricks.map(b => b.kind), desktop.bricks.map(b => b.kind));
    for (const [id, region] of phoneRegions) {
      const actual = desktopRegions.get(id);
      assert.equal(actual.edge, rotatedEdges[region.edge]);
      const reversed = region.edge === 'right' || region.edge === 'left';
      assert.ok(Math.abs(actual.start - (reversed ? 1 - region.end : region.start)) < 1e-9);
      assert.ok(Math.abs(actual.end - (reversed ? 1 - region.start : region.end)) < 1e-9);
    }
    const next = game => new Map(game.perimeter.map((id, i) => [id, game.perimeter[(i + 1) % 26]]));
    assert.deepEqual(next(desktop), next(phone));
    for (const brick of desktop.bricks) {
      const level = { ...blank(), brickTypes: [{ ...expected.get(brick.id), kind: 'fast', crumbler: 5, warped: 15 }] };
      const editedDesktop = new Game(Math.random, { customLevel: level });
      const editedPhone = new Game(Math.random, { portrait: true, scale, customLevel: level });
      assert.deepEqual(editedPhone.bricks.map(b => b.kind), editedDesktop.bricks.map(b => b.kind));
      for (const game of [editedDesktop, editedPhone]) {
        assert.deepEqual(game.bricks.filter(b => b.crumbler === 5 && b.warped === 15).map(b => b.id), [brick.id]);
      }
    }
  }
  for (const brick of desktop.bricks) {
    assert.ok(brick.x >= 0 && brick.y >= 0 && brick.w > 0 && brick.h > 0);
    assert.ok(brick.x + brick.w <= desktop.width && brick.y + brick.h <= desktop.height);
  }
  assert.deepEqual(
    (({ x, y, w, h }) => ({ x, y, w, h }))(desktop.bricks[0]),
    { x: 918, y: 20, w: 22, h: (600 - 40 - 32) / 5 },
  );
});

test('individual brick overrides round-trip, affect only their brick, and set real cooldowns', () => {
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
    const base = new Game(Math.random, { ...options, customLevel: blank() });
    const regions = brickEditRegions(base.bricks);
    for (const target of base.bricks) {
      for (const kind of Object.keys(COOLDOWNS)) {
        const level = { ...blank(), brickTypes: [{ ...regions.get(target.id), kind }] };
        const validated = validateCustomLevel(JSON.parse(JSON.stringify(level)));
        assert.deepEqual(validated.brickTypes, level.brickTypes);
        const game = new Game(Math.random, { ...options, customLevel: validated });
        for (const brick of game.bricks) assert.equal(brick.kind, brick.id === target.id ? kind : base.bricks[brick.id].kind);
        game.start();
        const brick = game.bricks[target.id];
        assert.equal(game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2), true);
        assert.equal(brick.readyAt, COOLDOWNS[kind]);
        game.reset();
        assert.equal(game.bricks[target.id].kind, kind);
      }
    }
  }
});

test('brick overrides map across layouts, remain on their edge, and use the latest overlapping edit', () => {
  const level = { ...blank(), brickTypes: [
    { edge: 'top', start: 0, end: 1, kind: 'slow' },
    { edge: 'top', start: .1, end: .101, kind: 'fast' },
  ] };
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
    const base = new Game(Math.random, { ...options, customLevel: blank() });
    const game = new Game(Math.random, { ...options, customLevel: level });
    const regions = brickEditRegions(game.bricks);
    const top = game.bricks.filter(brick => regions.get(brick.id).edge === 'top');
    assert.ok(top.some(brick => brick.kind === 'fast'));
    assert.ok(top.every(brick => ['slow', 'fast'].includes(brick.kind)));
    for (const brick of game.bricks.filter(brick => regions.get(brick.id).edge !== 'top')) assert.equal(brick.kind, base.bricks[brick.id].kind);
  }
});

test('invalid brick overrides are rejected and older JSON without overrides is unchanged', () => {
  const valid = { edge: 'top', start: 0, end: .5, kind: 'fast' };
  for (const entry of [null, {}, { ...valid, edge: 'center' }, { ...valid, kind: 'toString' }, { ...valid, start: -.1 }, { ...valid, end: 2 }, { ...valid, end: NaN }, { ...valid, start: .5 }, { ...valid, start: '0' }]) {
    assert.throws(() => validateCustomLevel({ ...blank(), brickTypes: [entry] }), TypeError);
  }
  assert.throws(() => validateCustomLevel({ ...blank(), brickTypes: {} }), TypeError);
  assert.throws(() => validateCustomLevel({ ...blank(), brickTypes: Array(2001).fill(valid) }), TypeError);
  assert.deepEqual(validateCustomLevel(blank()), blank());
});

test('portable level schema round-trips JSON, normalizes input, and keeps source data independent', () => {
  const source = { ...blank(), id: '  Test level  ', events: [event()] };
  const result = validateCustomLevel(JSON.parse(JSON.stringify(source)));
  assert.equal(result.id, 'Test level');
  assert.equal(result.heartCost, null);
  assert.deepEqual(result.events, source.events);
  result.events[0].x = .9;
  assert.equal(source.events[0].x, .2);
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(result))), result);
  const fragment = encodeURIComponent(JSON.stringify(result));
  assert.deepEqual(validateCustomLevel(JSON.parse(decodeURIComponent(fragment))), result);
});

test('invalid settings and placements are rejected explicitly before mutating game state', () => {
  for (const patch of [
    { version: 2 }, { id: '' }, { id: 'x'.repeat(61) }, { duration: 0 }, { duration: Infinity },
    { goal: 0 }, { goal: 1.5 }, { heartCost: 0 }, { heartCost: -1 }, { heartCost: Infinity }, { brickSet: 2 },
    { events: null }, { events: Array.from({ length: 2001 }, () => event()) },
  ]) assert.throws(() => validateCustomLevel({ ...blank(), ...patch }), TypeError);
  for (const patch of [
    { time: -1 }, { time: 30 }, { time: NaN }, { x: -1 }, { x: 1.01 }, { y: undefined }, { x: '0.5' },
    { kind: 'unknown' }, { kind: '__proto__' }, { type: 'toString' }, { lifetime: 0 }, { lifetime: Infinity },
    { kind: 'enemy', type: 'wheel' }, { kind: 'weapon', type: 'banana' },
  ]) assert.throws(() => new Game(Math.random, { customLevel: { ...blank(), events: [{ ...event(), ...patch }] } }), TypeError);
  for (const value of [null, [], 'level']) assert.throws(() => validateCustomLevel(value), TypeError);
});

test('custom events are stable-sorted, spawn once at exact times, and work at time zero', () => {
  const level = { ...blank(), events: [event('food', 'P', 4), event('weapon', 'wood', 0), event('food', 'S', 2), event('weapon', 'silver', 2)] };
  const game = new Game(() => .5, { customLevel: level });
  assert.equal(game.weapons.length, 0);
  game.start();
  assert.equal(game.weapons[0].type, 'wood');
  assert.equal(game.nextCustom, 1);
  game.update(1.99);
  assert.equal(game.food.length, 0);
  game.update(.02);
  assert.deepEqual(game.food.map(f => f.type), ['S']);
  assert.deepEqual(game.weapons.map(w => w.type), ['wood', 'silver']);
  game.update(2);
  assert.deepEqual(game.food.map(f => f.type), ['S', 'P']);
  assert.equal(game.nextCustom, 4);
  game.pause(); game.update(10);
  assert.ok(game.elapsed < 4.1);
  game.resume(); game.update(4);
  assert.deepEqual(game.food.map(f => f.type), ['P']);
  assert.equal(game.weapons.length, 2);
  game.reset(); game.start();
  assert.equal(game.weapons.length, 1);
  assert.equal(game.nextCustom, 1);
  assert.equal(game.level.id, level.id);
  assert.equal(game.levelIndex, -1);
});

test('normalized placements project to the same relative safe-area positions in both orientations', () => {
  for (const options of [{}, { portrait: true, scale: .31 }, { portrait: true, scale: .6 }]) {
    const level = { ...blank(), events: [event('food', 'F', 0), event('weapon', 'gold', 0), event('enemy', 'mouse', 0), event('enemy', 'ram', 0), event('enemy', 'bucket', 0)] };
    const game = new Game(() => .5, { ...options, customLevel: level });
    game.start();
    const b = game.bounds();
    for (const item of [...game.food, ...game.weapons, ...game.robots]) {
      assert.ok(Math.abs((item.x - b.left) / (b.right - b.left) - .2) < 1e-8);
      assert.ok(Math.abs((item.y - b.top) / (b.bottom - b.top) - .7) < 1e-8);
      for (const brick of game.bricks) {
        const x = Math.max(brick.x, Math.min(brick.x + brick.w, item.x));
        const y = Math.max(brick.y, Math.min(brick.y + brick.h, item.y));
        assert.ok(Math.hypot(item.x - x, item.y - y) >= 25);
      }
    }
    assert.equal(game.bricks.filter(b => b.kind === 'slow').length, 3);
    assert.equal(game.bricks.filter(b => b.kind === 'fast').length, 3);
  }
});

test('wheel and snake placements snap to an edge and begin at that exact perimeter position', () => {
  for (const options of [{}, { portrait: true, scale: .35 }]) {
    for (const type of ['wheel', 'snake']) {
      for (const [x, y] of [[.1, .5], [.9, .5], [.5, .1], [.5, .9], [0,0], [1,1]]) {
        const snapped = snapWheel(x, y);
        const level = { ...blank(), events: [{ ...event('enemy', type, 0), ...snapped }] };
        const game = new Game(() => .5, { ...options, customLevel: level });
        game.start();
        const point = game.pointFromRelative(snapped.x, snapped.y);
        assert.ok(Math.abs(game.robots[0].x - point.x) < 1e-8, type);
        assert.ok(Math.abs(game.robots[0].y - point.y) < 1e-8, type);
        game.update(.1);
        assert.notDeepEqual({ x: game.robots[0].x, y: game.robots[0].y }, point);
      }
    }
  }
});

test('custom objectives, duration, heart costs, and every pickup type use the real engine', () => {
  for (const type of Object.keys(FOODS)) {
    const game = new Game(() => .1, { customLevel: { ...blank(), goal: FOODS[type].value, heartCost: 1, events: [{ ...event('food', type, 0), x: .5, y: .5 }] } });
    game.start(); game.update(.01);
    assert.equal(game.state, 'won');
    assert.equal(game.score, FOODS[type].value);
    assert.equal(game.healing.length, 0);
    assert.equal(game.spawnCues.filter(cue => cue.kind === 'heart').length, FOODS[type].value);
  }
  for (const type of Object.keys(SWORDS)) {
    const game = new Game(() => .1, { customLevel: { ...blank(), events: [{ ...event('weapon', type, 0), x: .5, y: .5 }] } });
    game.start(); game.update(.01);
    assert.equal(game.weapon.type, type);
  }
  const game = new Game(() => .5, { customLevel: { ...blank(), duration: 1.5 } });
  game.start(); game.update(2);
  assert.equal(game.elapsed, 1.5);
  assert.equal(game.state, 'lost');
  assert.equal(game.nextHeart, Infinity);
});

test('editor lifetime fields omit blank values, preserve mixed durations, and explicitly clear optional lifetimes', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const inputs = new Map();
  const $ = selector => {
    if (!inputs.has(selector)) inputs.set(selector, {
      value: '', placeholder: '', disabled: false, required: false,
      dataset: {},
      querySelector: () => null, replaceChildren() {}, prepend() {},
    });
    return inputs.get(selector);
  };
  const context = vm.createContext({
    $, FOODS, SWORDS, ITEMS: require('../src/game.js').ITEMS, OBJECTS: require('../src/game.js').OBJECTS, SHIELDS: {},
    snapWheel,
    document: { createElement: () => ({}) }, MIXED: '',
    level: blank(), selectedEvents: new Set(), touched: new Set(),
    common: values => values.every(value => value === values[0]) ? values[0] : '',
    selectedList: () => [...context.selectedEvents],
    mixedOption: () => {}, syncPalettes() {}, readOnly: () => false,
    validateDraft: validateCustomLevel, markChanged() {}, setSelection() {}, message() {},
    plural: (count, word) => `${count} ${word}s`,
  });
  vm.runInContext(source.slice(source.indexOf('function typeOptions('), source.indexOf('function description(')), context);
  vm.runInContext(source.slice(source.indexOf('function readEvent('), source.indexOf('function setSelection(')), context);
  vm.runInContext(source.slice(source.indexOf('function applyToSelected('), source.indexOf("form.addEventListener('submit'")), context);
  $('#event-time').value = '2'; $('#event-x').value = '20'; $('#event-y').value = '70';
  for (const [kind, type] of [['item', 'battery'], ['weapon', 'gold']]) {
    $('#event-kind').value = kind; context.typeOptions(type);
    $('#event-type').value = type;
    assert.equal($('#event-lifetime').disabled, false);
    assert.equal($('#event-lifetime').required, false);
    assert.ok(!Object.hasOwn(context.readEvent(), 'lifetime'));
    $('#event-lifetime').value = '3.5';
    assert.equal(context.readEvent().lifetime, 3.5);
    context.level = { ...blank(), events: [
      { ...event(kind, type), lifetime: 4 },
      { ...event(kind, type), lifetime: 8 },
    ] };
    context.selectedEvents = new Set([0, 1]);
    context.populateEventForm();
    assert.equal($('#event-lifetime').value, '');
    assert.equal($('#event-lifetime').placeholder, 'Mixed');
    $('#event-x').value = '40'; context.touched.add('#event-x');
    context.applyToSelected();
    assert.deepEqual(Array.from(context.level.events, event => event.lifetime), [4, 8], 'untouched mixed field preserves values');
    context.touched.clear(); context.touched.add('#event-lifetime');
    context.applyToSelected();
    assert.ok(context.level.events.every(event => !Object.hasOwn(event, 'lifetime')), 'touched blank removes optional lifetime');
    context.selectedEvents = new Set([0]); context.populateEventForm();
    assert.equal($('#event-lifetime').value, '', 'single indefinite event must not default to five seconds');
    assert.equal($('#event-lifetime').required, false);
    context.selectedEvents.clear();
  }
  $('#event-kind').value = 'food'; context.typeOptions('S');
  assert.equal($('#event-lifetime').required, true);
  context.level = { ...blank(), events: [event(), event()] };
  context.selectedEvents = new Set([0, 1]); context.touched = new Set(['#event-lifetime']);
  $('#event-lifetime').value = '';
  assert.throws(() => context.applyToSelected(), /Food needs a lifetime/);
  context.selectedEvents.clear();
  $('#event-kind').value = 'object'; context.typeOptions('soccer-ball');
  $('#event-type').value = 'soccer-ball';
  $('#event-lifetime').value = '10'; $('#event-shield').value = 'blue';
  assert.equal($('#event-lifetime').disabled, true);
  assert.equal($('#lifetime-label').hidden, true);
  assert.equal($('#event-shield').disabled, true);
  assert.equal($('#shield-label').hidden, true);
  const ball = context.readEvent();
  assert.equal(ball.kind, 'object');
  assert.equal(ball.type, 'soccer-ball');
  assert.ok(!Object.hasOwn(ball, 'lifetime'));
  assert.ok(!Object.hasOwn(ball, 'shield'));
  context.level = { ...blank(), events: [event(), { ...event('enemy', 'mouse'), shield: 'blue' }] };
  context.selectedEvents = new Set([0, 1]);
  context.touched = new Set(['#event-kind', '#event-type']);
  context.applyToSelected();
  assert.ok(context.level.events.every(event => event.kind === 'object' && event.type === 'soccer-ball'));
  assert.ok(context.level.events.every(event => !Object.hasOwn(event, 'lifetime') && !Object.hasOwn(event, 'shield')));
  context.populateEventForm();
  assert.equal($('#event-lifetime').disabled, true);
  assert.equal($('#event-shield').disabled, true);
});

test('snake event selectors and editor placements use Wheel edge snapping', () => {
  const { spawnSymbol, spawnColor, specialLabel } = require('../src/brick-visuals.js');
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const inputs = new Map();
  const $ = selector => {
    if (!inputs.has(selector)) inputs.set(selector, { value: '', dataset: {}, querySelector: () => null, replaceChildren() {}, prepend() {} });
    return inputs.get(selector);
  };
  const context = vm.createContext({
    $, FOODS, SWORDS, ITEMS: require('../src/game.js').ITEMS, OBJECTS: require('../src/game.js').OBJECTS, SHIELDS: {}, snapWheel,
    document: { createElement: () => ({}) }, MIXED: '', selectedEvents: new Set(), selectedBricks: new Set(),
    touched: new Set(), level: blank(), readOnly: () => false, syncPalettes() {},
  });
  vm.runInContext(source.slice(source.indexOf('function typeOptions('), source.indexOf('function description(')), context);
  vm.runInContext(source.slice(source.indexOf('function readEvent('), source.indexOf('function setSelection(')), context);
  $('#event-kind').value = 'enemy';
  context.typeOptions('snake');
  $('#event-type').value = 'snake';
  $('#event-time').value = '0'; $('#event-x').value = '20'; $('#event-y').value = '70';
  $('#event-shield').value = 'none';
  const placement = context.readEvent();
  assert.deepEqual(JSON.parse(JSON.stringify(placement)), { kind: 'enemy', type: 'snake', time: 0, ...snapWheel(.2, .7), shield: null });
  const snakeSpawner = { kind: 'enemy', type: 'snake' };
  const saved = validateCustomLevel({ ...blank(), events: [placement], brickTypes: [
    { edge: 'top', start: 0, end: .125, kind: 'normal', spawner: snakeSpawner },
  ] });
  assert.deepEqual(saved.brickTypes[0].spawner, snakeSpawner);
  assert.deepEqual(saved.events[0], JSON.parse(JSON.stringify(placement)));
  assert.ok(source.includes("['wheel', 'snake'].includes(event.type)"));
  assert.ok(source.includes("['wheel', 'snake'].includes(item.type)"));
  assert.ok(source.includes("['wheel', 'snake'].includes(next.type)"));
  assert.match(source, /snake: \{ name: 'Robo Snake' \}/);
  assert.match(spawnSymbol({ kind: 'enemy', type: 'snake' }), /M-25 5/);
  assert.equal(spawnColor({ kind: 'enemy', type: 'snake' }), '#bbc5ca');
  assert.match(specialLabel({ spawner: { kind: 'enemy', type: 'snake' } }), /Spawning: Robo Snake/);
});

test('soccer editor drafts round-trip scoring targets, balls, goal bricks and ball spawners', () => {
  const source = { ...blank(), goal: 0, goalsGoal: 2,
    events: [event('object', 'soccer-ball', 0)],
    brickTypes: [
      { edge: 'top', start: 0, end: .125, kind: 'goal' },
      { edge: 'bottom', start: 0, end: .125, kind: 'normal', spawner: { kind: 'object', type: 'soccer-ball' } },
    ] };
  const validateDraft = value => validateCustomLevel(value, { allowUnpairedPortals: true });
  const draft = validateDraft(source);
  assert.deepEqual(draft, source);
  assert.deepEqual(validateDraft(JSON.parse(JSON.stringify(draft))), draft);
  assert.deepEqual(validateDraft(JSON.parse(decodeURIComponent(encodeURIComponent(JSON.stringify(draft))))), draft);
  for (const goalsGoal of [-1, 1.5, '2', Infinity, 100001]) {
    assert.throws(() => validateDraft({ ...source, goalsGoal }), TypeError);
  }
  assert.throws(() => validateDraft({ ...source, survive: true }), TypeError);
  for (const field of [{ lifetime: 5 }, { shield: 'blue' }]) {
    assert.throws(() => validateDraft({ ...source, events: [{ ...source.events[0], ...field }] }), TypeError);
    assert.throws(() => validateDraft({ ...source, brickTypes: [
      { ...source.brickTypes[1], spawner: { ...source.brickTypes[1].spawner, ...field } },
    ] }), TypeError);
  }
  const html = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  const editor = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  assert.match(html, /<option value="object">Object<\/option>/);
  assert.match(html, /<option value="goal">Goal/);
  assert.match(editor, /object: OBJECTS/);
});

test('editor goal bricks clear attributes, reject surface edits, and combine only with goals', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', checked: false,
      querySelector: () => null, replaceChildren() {} });
    return nodes.get(selector);
  };
  const regionKey = region => `${region.edge}:${region.start}:${region.end}`;
  const context = vm.createContext({ $, Game, brickEditRegions, brickRegions, COOLDOWNS, regionKey, combineOwner: null,
    CONTACT_SURFACES: require('../src/game.js').CONTACT_SURFACES, MIXED: '',
    immutableBrick: kind => ['cinder', 'goal'].includes(kind),
    common: values => values.every(value => value === values[0]) ? values[0] : '',
    validateDraft: value => validateCustomLevel(value, { allowUnpairedPortals: true }),
    attempt: action => action(), markChanged() {}, renderBoard() {}, setSelection() {}, message() {},
    choiceButton: () => ({ setAttribute() {} }), specialLabel: () => '', mixedOption() {},
  });
  vm.runInContext(source.slice(source.indexOf('function brickEntry('), source.indexOf('function splitBricks(')), context);
  vm.runInContext(source.slice(source.indexOf('function renderBrickInspector('), source.indexOf('function renderBoard(')), context);
  const setup = custom => {
    context.level = custom;
    context.previewGame = new Game(() => .5, { customLevel: custom, editorPreview: true });
    context.selectedBricks = new Set();
    return context.previewGame;
  };
  let game = setup(blank());
  const target = game.bricks[game.perimeter[0]], region = brickEditRegions(game.bricks).get(target.id);
  target.crumbler = 5; target.warped = 15; target.spawner = { kind: 'food', type: 'S', lifetime: 5 };
  context.selectedBricks.add(regionKey(region));
  $('#brick-kind').value = 'goal';
  context.saveBrick({ target: { id: 'brick-kind' } });
  assert.deepEqual(JSON.parse(JSON.stringify(context.level.brickTypes)), [{ ...region, kind: 'goal' }]);
  game = setup(context.level); context.selectedBricks.add(regionKey(region));
  context.renderBrickInspector(game.bricks);
  assert.equal($('#brick-kind').disabled, false, 'goal type remains editable');
  for (const id of ['crumbler', 'warped', 'springs', 'spikes', 'conveyor', 'portal', 'spawner', 'boost', 'barrier', 'toggle']) {
    assert.equal($(`#brick-${id}`).disabled, true, `${id} is unavailable for goals`);
  }
  const saved = JSON.stringify(context.level);
  assert.throws(() => context.saveBrick({ target: { id: 'brick-springs' } }), /cannot have modifiers or contact surfaces/);
  assert.equal(JSON.stringify(context.level), saved);
  $('#brick-kind').value = 'normal';
  context.saveBrick({ target: { id: 'brick-kind' } });
  assert.equal(context.level.brickTypes[0].kind, 'normal');
  game = setup(context.level); context.selectedBricks.add(regionKey(region));
  $('#brick-spawn-item').value = 'object:soccer-ball';
  $('#brick-spawn-lifetime').value = '10'; $('#brick-spawn-shield').value = 'blue';
  context.saveBrick({ target: { id: 'brick-spawn-item' } });
  assert.deepEqual(JSON.parse(JSON.stringify(context.level.brickTypes[0].spawner)), { kind: 'object', type: 'soccer-ball' });
  game = setup(context.level); context.selectedBricks.add(regionKey(region));
  context.renderBrickInspector(game.bricks);
  assert.equal($('#brick-spawn-item').disabled, false);
  assert.equal($('#brick-spawn-lifetime').disabled, true);
  assert.equal($('#brick-spawn-shield').disabled, true);
  for (const otherKind of ['normal', 'cinder', 'goal']) {
    const base = new Game(() => .5, { customLevel: blank() });
    const ids = base.perimeter.slice(0, 2), regions = brickEditRegions(base.bricks);
    game = setup({ ...blank(), brickTypes: ids.map((id, index) => ({
      ...regions.get(id), kind: index ? otherKind : 'goal',
    })) });
    context.selectedBricks = new Set(ids.map(id => regionKey(regions.get(id))));
    context.combineOwner = ids[0];
    context.renderBrickInspector(game.bricks);
    assert.equal($('#combine-bricks').disabled, otherKind !== 'goal');
    if (otherKind === 'goal') {
      context.combineBricks();
      assert.equal(context.level.brickGroups.length, 1);
      assert.ok(context.level.brickTypes.every(entry => Object.keys(entry).sort().join(',') === 'edge,end,kind,start'));
      assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(context.level))), JSON.parse(JSON.stringify(context.level)));
    } else {
      const before = JSON.stringify(context.level);
      assert.throws(() => context.combineBricks(), /same kind/);
      assert.equal(JSON.stringify(context.level), before);
    }
  }
});
