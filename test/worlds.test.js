'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const engine = require('../src/game.js');
const { LEVELS } = engine;
const worlds = require('../src/worlds.js');
const { WORLDS, worldLevels, nextLevelIndex, levelFeatures } = worlds;
const saveApi = require('../src/saves.js');

test('All worlds shares the bottom action bar and styling with Back to menu', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const picker = html.slice(html.indexOf('<dialog id="level-picker"'), html.indexOf('<dialog id="save-slots"'));
  const actions = picker.slice(picker.indexOf('<div class="save-actions">'));
  assert.match(actions, /id="world-map-back" class="title-secondary"[\s\S]*id="level-picker-close" class="title-secondary"/);
  assert.doesNotMatch(picker.slice(0, picker.indexOf('</header>')), /world-map-back/);
});

test('worlds partition all 34 unchanged campaign identities into themed groups of 10 and 24', () => {
  assert.deepEqual(WORLDS.map(world => worldLevels(world).length), [10, 24]);
  assert.deepEqual(WORLDS.map(world => world.theme), ['garden', 'workshop']);
  assert.deepEqual(WORLDS.flatMap(world => worldLevels(world)), LEVELS);
  assert.equal(LEVELS[9].number, '1-10');
  assert.equal(LEVELS[10].number, '2-1');
  assert.equal(LEVELS.at(-1).number, '2-24');
  assert.deepEqual(LEVELS.map(level => level.id), LEVELS.map((_, i) => `1-${i + 1}`));
  for (const [i, level] of LEVELS.entries()) {
    assert.equal(nextLevelIndex(i), i === LEVELS.length - 1 ? -1 : i + 1);
    assert.equal(level.cutscene.theme, WORLDS.find(world => world.id === level.worldId).theme);
  }
});

test('special worlds branch optionally, have independent sizes, and rejoin the main path', () => {
  const worlds = [
    { id: '1', special: false, next: ['S2', '2'] },
    { id: '2', special: false, next: ['3'] },
    { id: '3', special: false, next: [] },
    { id: 'S2', special: true, next: ['2'] },
  ];
  const levels = [
    { id: 'a', worldId: '1' }, { id: 'b', worldId: '2' }, { id: 'c', worldId: '2' },
    { id: 'd', worldId: '3' }, { id: 'e', worldId: 'S2' }, { id: 'f', worldId: 'S2' }, { id: 'g', worldId: 'S2' },
  ];
  assert.deepEqual(worlds.map(world => worldLevels(world, levels).length), [1, 2, 1, 3]);
  assert.equal(nextLevelIndex(0, worlds, levels), 1, 'default route does not force special world');
  assert.equal(nextLevelIndex(4, worlds, levels), 5);
  assert.equal(nextLevelIndex(5, worlds, levels), 6);
  assert.equal(nextLevelIndex(6, worlds, levels), 1, 'special route rejoins world 2');
  assert.equal(nextLevelIndex(2, worlds, levels), 3);
  assert.equal(nextLevelIndex(3, worlds, levels), -1);
  const saves = new saveApi.SaveSlots(levels.map(level => level.id), undefined, undefined, ['a', 'b', 'c', 'd']);
  assert.equal(saves.nextLevel({ completed: ['a', 'b', 'c', 'd'] }), 3, 'Continue ignores optional unfinished worlds');
  assert.throws(() => nextLevelIndex(99), /Unknown level/);
  assert.throws(() => nextLevelIndex(0, [{ id: '1', next: ['missing'] }], levels), /Invalid world destination/);
});

test('map icons describe actual schedules, placed events and spawner contents, without duplicates', () => {
  for (const level of LEVELS) {
    const features = levelFeatures(level);
    assert.equal(new Set(features.map(feature => feature.picture)).size, features.length);
    assert.ok(features.every(feature => typeof feature.name === 'string' && feature.name.length));
    for (const [, , type] of level.food) assert.ok(features.some(feature => feature.picture === `food:${type}`));
    for (const [, type] of level.enemies) assert.ok(features.some(feature => feature.picture === `enemy:${type}`));
    for (const entry of level.events ?? []) assert.ok(features.some(feature => feature.picture === `${entry.kind}:${entry.type}`));
    for (const brick of level.brickTypes) if (brick.spawner) {
      assert.ok(features.some(feature => feature.picture === `${brick.spawner.kind}:${brick.spawner.type}`));
    }
    const kinds = [...new Set(new engine.Game(() => .5, { level: LEVELS.indexOf(level) }).bricks
      .filter(brick => brick.absorbedBy == null).map(brick => brick.kind))];
    for (const kind of ['normal', 'slow', 'fast', 'cinder', 'goal']) {
      assert.equal(features.some(feature => feature.picture === `${kind === 'goal' ? 'special' : 'brick'}:${kind}`),
        kinds.includes(kind), `${level.number}: ${kind} previews match actual blocks`);
    }
  }
  const pictures = levelFeatures(LEVELS.at(-1)).map(feature => feature.picture);
  assert.ok(pictures.includes('special:boom-helmet'));
  assert.ok(pictures.includes('brick:conveyor'));
  assert.ok(pictures.includes('brick:warped'));
});

function mapFixture(profile = { guest: true, completed: [], results: {} }, custom = null, game = engine, graph = worlds) {
  const elements = new Map();
  const node = () => ({
    children: [], dataset: {}, style: {}, listeners: {}, attributes: {}, hidden: false,
    classList: { add() {}, remove() {} },
    append(...children) { this.children.push(...children); },
    prepend(...children) { this.children.unshift(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name]; },
    addEventListener(name, listener) { this.listeners[name] = listener; },
    focus() {}, scrollIntoView() {},
    getAnimations() { return []; },
    animate(frames, options) { this.animation = { frames, options }; },
    querySelectorAll(selector) {
      return this.children.filter(child => selector === '.map-node' && child.className === 'map-node');
    },
    querySelector(selector) {
      return this.children.find(child => selector === '.map-koshi' ? child.className === 'map-koshi'
        : child.attributes?.['aria-pressed'] === 'true');
    },
  });
  const document = {
    createElement: node, createElementNS: node,
    querySelector(id) { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); },
  };
  const motion = { matches: false };
  const context = vm.createContext({
    document, KoshiGame: game, KoshiWorlds: graph, KoshiSaves: saveApi,
    getComputedStyle: node => node.style, matchMedia: () => motion,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'world-map.js'), 'utf8'), context);
  const selection = { value: '0' };
  const map = new context.KoshiWorldMap({ selection, profile: () => profile, picture: () => node(), custom: () => custom });
  const text = node => [node.textContent ?? '', ...node.children.map(text)].join(' ');
  return { map, selection, elements, text, motion };
}

test('two-tier map selects worlds separately, moves Koshi, and reveals only that world and its complete level details', () => {
  const fixture = mapFixture();
  const { map, selection, text } = fixture;
  map.open();
  assert.equal(map.map.querySelectorAll('.map-node').length, 2);
  map.selectWorld(WORLDS[1]);
  assert.equal(selection.value, '0', 'world selection alone does not commit a level');
  assert.equal(map.map.querySelector('.map-koshi').style.left, '85%');
  assert.equal(map.play.hidden, true);
  map.showWorld(WORLDS[1]);
  assert.equal(map.map.querySelectorAll('.map-node').length, 24);
  assert.equal(selection.value, '10');
  map.selectLevel(LEVELS.at(-1));
  assert.equal(selection.value, '33');
  const details = text(map.details);
  for (const value of ['2-24', 'The final countdown feast', '35', '🕒 100s', 'Moves to beat',
    '6 activations', 'Best (fastest) win', 'Fewest moves', 'Most food points', 'Most enemy points', 'Wins / losses',
    'Win percentage', 'Level Features', 'Bricks', 'Enemies', 'Food', 'Items / Objects']) assert.ok(details.includes(value), value);
  assert.ok(!details.includes('Time to beat'));
  assert.ok(!details.includes('Guest statistics'));
  assert.ok(!details.includes('Quitting does not count'));
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(styles, /\.map-objectives \{[^}]*flex-wrap: nowrap;/);
  assert.match(styles, /\.map-details dt, \.map-details dd \{ white-space: nowrap; \}/);
  assert.match(styles, /\.map-features \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  const featureSection = map.details.children.at(-1);
  assert.equal(featureSection.className, 'map-feature-section');
  assert.deepEqual(featureSection.children[1].children.map(group => group.className), [
    'map-feature-group map-feature-bricks', 'map-feature-group map-feature-enemies',
    'map-feature-group map-feature-food', 'map-feature-group map-feature-items',
  ]);
  assert.equal(map.map.querySelector('.map-koshi').style.left, '12%');
  assert.equal(map.play.hidden, false);
  fixture.elements.get('#world-map-back').listeners.click();
  map.map.querySelector('[aria-pressed="true"]').listeners.click();
  assert.equal(map.map.querySelectorAll('.map-node').length, 24);
  assert.equal(selection.value, '33', 'back/zoom retains selected level');
});

test('details show saved outcome statistics, no fabricated legacy bests, and helmet limits only where applicable', () => {
  const result = { levelId: LEVELS[0].id, outcome: 'won', time: 12.25, food: 22, enemy: 3, moves: 7 };
  const { map, text } = mapFixture({
    completed: [LEVELS[0].id, LEVELS[1].id],
    results: { first: result, second: { ...result, outcome: 'lost', food: 25, enemy: 5 } },
  });
  map.open(); map.showWorld(WORLDS[0]); map.selectLevel(LEVELS[0]);
  let details = text(map.details);
  for (const value of ['12.25 seconds', '25', '5', '1 / 1', '50.0%']) assert.ok(details.includes(value), value);
  assert.ok(!details.includes('Damage-free gold star'));
  assert.equal(map.details.children[0].children[1].textContent, '☆');
  assert.equal(map.details.children[0].children[1].getAttribute('aria-label'), 'Gold star not earned: complete without taking damage');
  assert.doesNotMatch(details, /Win \/ loss percentages|50\.0% \/ /);
  assert.match(details, /Fewest moves\s+7\b/);
  assert.ok(!details.includes('Moves to beat'));
  map.selectLevel(LEVELS[1]); details = text(map.details);
  assert.ok(details.includes('0 / 0'));
  assert.ok(details.includes('Not recorded'));

  const earned = mapFixture({
    completed: [LEVELS[0].id],
    results: { first: { ...result, damageFree: true } },
  });
  earned.map.open(); earned.map.showWorld(WORLDS[0]); earned.map.selectLevel(LEVELS[0]);
  assert.equal(earned.map.details.children[0].children[1].textContent, '★');
  assert.equal(earned.map.details.children[0].children[1].className, 'map-star map-star-earned');
  assert.doesNotMatch(earned.text(earned.map.details), /Damage-free gold star/);
});

test('earned gold stars appear at the bottom-left of only their level-map nodes', () => {
  const { map } = mapFixture({
    completed: [LEVELS[0].id, LEVELS[1].id],
    results: {
      clean: { levelId: LEVELS[0].id, outcome: 'won', time: 12, food: 20, enemy: 0, damageFree: true },
      damaged: { levelId: LEVELS[1].id, outcome: 'won', time: 12, food: 20, enemy: 0, damageFree: false },
    },
  });
  map.open();
  map.showWorld(WORLDS[0]);
  const nodes = map.map.querySelectorAll('.map-node');
  const earned = nodes.find(node => node.dataset.node === LEVELS[0].id);
  const unearned = nodes.find(node => node.dataset.node === LEVELS[1].id);
  assert.equal(earned.children.at(-1).className, 'map-node-star');
  assert.equal(earned.children.at(-1).textContent, '★');
  assert.equal(earned.children.at(-1).getAttribute('aria-hidden'), 'true');
  assert.match(earned.getAttribute('aria-label'), /gold star earned/);
  assert.equal(unearned.children.some(child => child.className === 'map-node-star'), false);
  assert.doesNotMatch(unearned.getAttribute('aria-label'), /gold star earned/);
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(styles, /\.map-node-star \{[^}]*left: -8px; bottom: -8px;/);
});

test('map objectives use accessible icons and positive targets, or only a clock for survival', () => {
  const { map, text } = mapFixture();
  for (const [level, labels, display] of [
    [{ goal: 20 }, ['Time limit: 60s', '20 food points'], '🕒 60s 🍗 20'],
    [{ killGoal: 12 }, ['Time limit: 60s', '12 enemy points'], '🕒 60s 👾 12'],
    [{ goalsGoal: 3 }, ['Time limit: 60s', '3 soccer goals'], '🕒 60s ⚽ 3'],
    [{ goal: 5, killGoal: 2, goalsGoal: 1 }, ['Time limit: 60s', '5 food points', '2 enemy points', '1 soccer goals'], '🕒 60s 🍗 5 👾 2 ⚽ 1'],
    [{ survive: true }, ['Survive for 60s'], '🕒 60s'],
  ]) {
    const objective = map.objectives({ duration: 60, goal: 0, killGoal: 0, goalsGoal: 0, ...level });
    assert.equal(objective.getAttribute('aria-label'), 'Time limit and win objectives');
    assert.deepEqual(Array.from(objective.children, badge => badge.getAttribute('aria-label')), labels);
    assert.equal(text(objective).trim().replace(/\s+/g, ' '), display);
    assert.ok(objective.children.every(badge => badge.children[0].getAttribute('aria-hidden') === 'true'));
  }
});

test('custom editor play remains available outside worlds and switching back restores world controls', () => {
  const { map, selection } = mapFixture(undefined, { id: 'Preview', goal: 20, duration: 30 });
  map.open();
  map.map.children.at(-1).listeners.click();
  assert.equal(selection.value, 'custom');
  assert.equal(map.play.hidden, false);
  map.selectWorld(WORLDS[0]);
  assert.equal(map.play.hidden, true);
});

test('an optional special-world definition appears as a separate branch and opens only its assigned levels', () => {
  const graph = [
    { ...WORLDS[0], next: ['2', 'S2'] }, WORLDS[1],
    { id: 'S2', name: 'Extra challenge', theme: 'workshop', special: true, next: ['2'] },
  ];
  const levels = [...LEVELS, { ...LEVELS[0], id: 'special-first', worldId: 'S2', number: 'S2-1' }];
  const { map, selection, text } = mapFixture(undefined, null, { ...engine, LEVELS: levels }, {
    ...worlds, WORLDS: graph, worldLevels: world => worldLevels(world, levels),
  });
  map.open();
  assert.equal(map.map.querySelectorAll('.map-node').length, 3);
  assert.equal(map.map.children[0].children.length, 3, 'main path, branch, and rejoin are all drawn');
  map.selectWorld(graph[2]);
  assert.ok(text(map.details).includes('Optional extra difficulty'));
  assert.ok(text(map.details).includes('World 2'));
  map.showWorld(graph[2]);
  assert.equal(map.map.querySelectorAll('.map-node').length, 1);
  assert.equal(selection.value, '34');
  assert.ok(text(map.details).includes('S2-1'));
});

test('Koshi follows intermediate level stops forward and backward, and reduced motion skips movement', () => {
  const { map, motion } = mapFixture();
  map.open(); map.showWorld(WORLDS[0]);
  map.selectLevel(LEVELS[5]);
  const koshi = map.map.querySelector('.map-koshi');
  assert.equal(koshi.animation.frames.length, 6);
  assert.equal(koshi.animation.frames[4].left, '87%', 'the turn follows the path rather than crossing the map');
  assert.equal(koshi.animation.frames[5].left, '62%');
  assert.ok(koshi.animation.options.duration <= 1500);
  map.selectLevel(LEVELS[0]);
  assert.equal(koshi.animation.frames.length, 6);
  assert.equal(koshi.animation.frames[1].left, '87%');
  motion.matches = true;
  koshi.animation = null;
  map.selectLevel(LEVELS[9]);
  assert.equal(koshi.animation, null);
  assert.equal(koshi.style.left, '37%');
});

test('world clicks move to a new world and a second click on that world zooms in', () => {
  const { map, selection } = mapFixture();
  map.open();
  const world = map.map.querySelectorAll('.map-node')[1];
  world.listeners.click();
  assert.equal(map.view, 'worlds');
  assert.equal(selection.value, '0');
  assert.equal(world.getAttribute('aria-pressed'), 'true');
  world.listeners.click();
  assert.equal(map.view, 'levels');
  assert.equal(selection.value, '10');
});

test('victory map moves from the completed stop to the next, including world boundaries and final victory', () => {
  const { map, selection } = mapFixture({ completed: LEVELS.map(level => level.id), results: {} });
  map.open(); map.advanceFrom(0);
  assert.equal(map.view, 'levels');
  assert.equal(selection.value, '1');
  let marker = map.map.querySelector('.map-koshi');
  assert.equal(marker.animation.frames[0].left, '12%');
  assert.equal(marker.animation.frames[1].left, '37%');
  assert.ok(marker.animation.options.duration >= 600);
  map.advanceFrom(9);
  assert.equal(map.world.id, '2');
  assert.equal(selection.value, '10');
  assert.equal(map.map.querySelectorAll('.map-node').length, 25);
  assert.equal(map.map.querySelectorAll('.map-node')[0].dataset.node, LEVELS[9].id);
  marker = map.map.querySelector('.map-koshi');
  assert.equal(marker.animation.frames.length, 2);
  map.advanceFrom(33);
  assert.equal(selection.value, '33');
  assert.equal(map.map.querySelectorAll('.map-node').length, 24);
  assert.equal(map.map.querySelector('.map-koshi').animation, undefined, 'no invented level after the finale');
});

test('completed level stops and fully completed worlds carry flags, but partial worlds do not', () => {
  const { map } = mapFixture({ completed: LEVELS.slice(0, 10).map(level => level.id), results: {} });
  const flag = node => node.children.find(child => child.className === 'completion-flag');
  map.open();
  const nodes = map.map.querySelectorAll('.map-node');
  assert.ok(flag(nodes[0]));
  assert.equal(flag(nodes[1]), undefined);
  assert.equal(flag(nodes[0]).children[0].className, 'flag-cloth');
  map.showWorld(WORLDS[0]);
  assert.ok(map.map.querySelectorAll('.map-node').every(flag));
  map.showWorld(WORLDS[1]);
  assert.ok(map.map.querySelectorAll('.map-node').every(node => !flag(node)));
});
