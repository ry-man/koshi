const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const sync = source.slice(source.indexOf('function syncUI()'), source.indexOf('  const weaponCount ='))
  + '\n}';

function hud(level, customLevel = false) {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      textContent: '', innerHTML: '', attributes: {}, dataset: {},
      style: { setProperty() {} }, classList: { toggle() {} },
      setAttribute(key, value) { this.attributes[key] = value; },
    });
    return nodes.get(selector);
  };
  const context = vm.createContext({
    game: {
      level: { duration: 60, goal: 999, killGoal: 999, heartCost: 999, ...level },
      customLevel, state: 'ready', score: 123, enemies: 456, hearts: 3,
      elapsed: 0, nextHeart: 999, timeLimit: 60,
    },
    WORLDS: [{ id: '1', name: 'World one', theme: 'garden' },
      { id: '3S', name: 'Special world', theme: 'foundry' },
      { id: '2', name: 'Official world', theme: 'official', color: '#f1d65c' }],
    syncLevelRewards() {}, levelObjective: () => '', displayedStuck: false,
    levelInfoReplay: node('#level-info-replay'), document: { querySelector: node },
    timer: node('#timer'), foodCount: node('#food-count'), hearts: node('#hearts'),
    progress: node('#progress'), progressLabel: node('#progress-label'),
  });
  vm.runInContext(source.slice(source.indexOf('function syncTeamScore('), source.indexOf('function syncUI()')), context);
  vm.runInContext(sync, context);
  context.syncUI();
  return { node, context };
}

test('HUD prefixes Official numbers with their world without duplicating Beta world numbers', () => {
  for (const [worldId, number, expected] of [
    ['1', '9', '1-9'], ['1', '1-9', '1-9'], ['3S', '2', '3S-2'], ['3S', '3S-2', '3S-2'],
  ]) {
    const { node } = hud({ worldId, number, id: 'stable-save-id' });
    assert.equal(node('#level-number').textContent, expected);
    assert.equal(node('#level-number').title, expected);
    assert.equal(node('.level-badge strong').textContent, number);
  }
});

test('custom names remain intact for accessible reading and hover even when visually clipped', () => {
  const name = 'A very long custom level name '.repeat(8);
  const { node } = hud({ id: name, worldId: '1' }, true);
  assert.equal(node('#level-number').textContent, name);
  assert.equal(node('#level-number').title, name);
});

test('food and enemy counters retain full three-digit progress and accessible targets', () => {
  const { node, context } = hud({ id: 'test' });
  assert.match(node('#food-count').innerHTML, /class="counter-numerator">123<\/span><span class="counter-denominator">999<\/span>/);
  assert.match(node('#enemy-count').innerHTML, /class="counter-numerator">456<\/span><span class="counter-denominator">999<\/span>/);
  assert.equal(node('#food-count').attributes['aria-label'], '123 of 999 food collected');
  assert.equal(node('#enemy-count').attributes['aria-label'], '456 of 999 enemy points earned');
  assert.equal(node('#heart-cost-numbers').textContent, '123/999');
  assert.equal(node('#heart-cost-meter').attributes['aria-valuenow'], 123);
  context.game.level.survive = true;
  context.syncUI();
  assert.match(node('#food-count').innerHTML, /class="counter-value">123<\/span>/);
  assert.match(node('#enemy-count').innerHTML, /class="counter-value">456<\/span>/);
});

test('only active food, enemy, and soccer objectives render stacked fractions', () => {
  for (const patch of [{}, { survive: true }, { bossLevel: true }, { goal: 0, killGoal: 0, goalsGoal: 0 },
    { goal: Infinity, killGoal: Infinity, goalsGoal: Infinity }]) {
    const { node } = hud({ id: 'fractions', goalsGoal: 999, ...patch });
    const active = Object.keys(patch).length === 0;
    for (const id of ['food', 'enemy', 'goal']) {
      assert.equal(node(`#${id}-count`).innerHTML.includes('counter-fraction'), active);
      assert.equal(node(`#${id}-count`).innerHTML.includes('counter-denominator'), active);
      assert.ok(!node(`#${id}-count`).innerHTML.includes(' / '));
    }
    assert.equal(node('#goal-count').attributes['aria-label'], active ? '0 of 999 goals scored' : '0 goals scored');
  }
  assert.match(styles, /\.hud \.counter-stat \.counter-denominator \{ border-top: 1px solid currentColor;/);
});

test('stacked target scores fit the same counter height as boss scores', () => {
  const lineHeight = Number(styles.match(/\.hud \.counter-stat \.counter-fraction \{[^}]*line-height: ([\d.]+);/)[1]);
  const maximumFont = Number(styles.match(/\.hud \.target-stat strong \{ font-size: clamp\([^;]+, (\d+)px\);/)[1]);
  const counterHeight = Number(styles.match(/\.hud \.counter-stat strong \{[^}]*min-height: (\d+)px;/)[1]);
  const numeratorPadding = Number(styles.match(/\.hud \.counter-stat \.counter-numerator \{ padding-bottom: (\d+)px;/)[1]);
  const denominator = styles.match(/\.hud \.counter-stat \.counter-denominator \{ border-top: (\d+)px[^}]*padding-top: (\d+)px;/);
  assert.ok(maximumFont * lineHeight * 2 + numeratorPadding + Number(denominator[1]) + Number(denominator[2]) <= counterHeight);
});

test('food and enemy values sit beside their icons in a centered responsive row', () => {
  assert.match(styles, /\.hud \.counter-stat strong \{ display: flex; align-items: center; justify-content: center;/);
  assert.match(styles, /\.hud \.counter-stat \.counter-icon \{[^}]*font-size: var\(--counter-icon-size\);/);
  assert.match(styles, /\.hud \.target-stat strong \{ font-size: clamp/);
});

test('all counter icons reserve non-shrinking space and values cannot paint over it', () => {
  assert.match(styles, /\.hud \.counter-stat \.counter-icon \{ flex: 0 0 var\(--counter-icon-slot\);[^}]*overflow: hidden;/);
  assert.match(styles, /\.hud \.counter-stat \.counter-value \{[^}]*min-width: 0; overflow: hidden; text-overflow: ellipsis;/);
  assert.match(styles, /\.hud \.counter-stat strong \{[^}]*gap: var\(--counter-gap\);[^}]*overflow: hidden;/);
});

test('boss meters use the boss name without Health and retain accessible life values', () => {
  const { CHARACTERS, isBossType } = require('../src/game.js');
  const meterSync = source.slice(source.indexOf("  document.querySelector('#boss-health').hidden"),
    source.indexOf('  const gameCanvas ='));
  for (const type of ['boss', 'tom-frog']) {
    const { node, context } = hud({ bossLevel: true, events: [{ type }] });
    Object.assign(context, { CHARACTERS, isBossType });
    vm.runInContext(meterSync, context);
    assert.equal(node('#boss-health').hidden, false);
    assert.equal(node('#boss-health-label').textContent, `${CHARACTERS[type]}: `);
    assert.equal(node('#boss-health-meter').attributes['aria-valuenow'], 6);
    context.game.boss = { name: CHARACTERS[type], health: 2, maxHealth: 6 };
    vm.runInContext(meterSync, context);
    assert.equal(node('#boss-health-meter').attributes['aria-valuenow'], 2);
    assert.equal(node('#boss-health-meter').attributes['aria-valuemax'], 6);
    assert.equal(node('#boss-health-fill').style.width, `${2 / 6 * 100}%`);
    context.game.level.bossLevel = false;
    vm.runInContext(meterSync, context);
    assert.equal(node('#boss-health').hidden, true);
  }
});

test('team scoreboard shows independent soccer scores with accessible updates', () => {
  const { CHARACTERS, isBossType } = require('../src/game.js');
  const meterSync = source.slice(source.indexOf("  document.querySelector('#boss-health').hidden"),
    source.indexOf('  const gameCanvas ='));
  const { node, context } = hud({ teamGoalsGoal: 4 });
  Object.assign(context, { CHARACTERS, isBossType });
  context.game.bricks = [{ kind: 'goal', goalTeam: 'enemy', absorbedBy: null }];
  context.game.teamKoshiGoals = 2; context.game.teamEnemyGoals = 1;
  vm.runInContext(meterSync, context);
  assert.equal(node('#team-scoreboard').hidden, false);
  assert.equal(node('#team-score-description').textContent, 'Koshi: 2; Enemies: 1');
  assert.equal(node('#team-koshi-score').dataset.value, '2');
  assert.equal(node('#team-enemy-score').dataset.value, '1');
  assert.match(node('#team-koshi-score').innerHTML, /viewBox="0 0 44 36"/);
  context.game.teamKoshiGoals = 100000; context.game.teamEnemyGoals = 42;
  vm.runInContext(meterSync, context);
  assert.equal(node('#team-score-description').textContent, 'Koshi: 100000; Enemies: 42');
  assert.match(node('#team-koshi-score').innerHTML, /viewBox="0 0 132 36"/);
  assert.equal((node('#team-koshi-score').innerHTML.match(/<g /g) ?? []).length, 6);
  context.game.teamKoshiGoals = 2;
  context.syncUI();
  assert.equal(node('#progress').style.width, '50%');
  context.game.bricks[0].goalTeam = null;
  vm.runInContext(meterSync, context);
  assert.equal(node('#team-scoreboard').hidden, true);
  context.game.bricks[0].goalTeam = 'koshi'; context.game.level.bossLevel = true;
  vm.runInContext(meterSync, context);
  assert.equal(node('#team-scoreboard').hidden, true);
});

test('scoreboard digits light the correct seven segments for every numeral', () => {
  const { node, context } = hud({ id: 'digits' });
  for (const [digit, expected] of ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg',
    'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'].entries()) {
    context.syncTeamScore(node('#team-koshi-score'), digit);
    const groups = [...node('#team-koshi-score').innerHTML.matchAll(/<g[^>]*>(.*?)<\/g>/g)];
    assert.equal(groups.length, 2);
    const polygons = [...groups[1][1].matchAll(/<polygon class="([^"]+)"/g)];
    assert.equal(polygons.map((match, index) => match[1].includes('is-lit') ? 'abcdefg'[index] : '').join(''), expected);
  }
});

test('scoreboard follows the active world theme and resets for custom levels', () => {
  const { node, context } = hud({ worldId: '2', id: 'theme' });
  assert.equal(node('.game-shell').dataset.scoreTheme, 'official');
  assert.equal(node('.game-shell').dataset.worldTheme, 'official');
  context.game.level.worldId = '3S';
  context.syncUI();
  assert.equal(node('.game-shell').dataset.scoreTheme, 'foundry');
  assert.equal(node('.game-shell').dataset.worldTheme, undefined);
  context.game.level.worldId = 'custom';
  context.syncUI();
  assert.equal(node('.game-shell').dataset.scoreTheme, 'garden');
});

test('phone boss meter is positioned halfway between the HUD and board', () => {
  const positionBossHealth = source.slice(source.indexOf('function positionBossHealth()'), source.indexOf('function frame(timestamp)'));
  const properties = {};
  const hud = {
    getBoundingClientRect: () => ({ bottom: 200 }),
    style: { setProperty: (name, value) => { properties[name] = value; } },
  };
  const board = { getBoundingClientRect: () => ({ top: 250 }) };
  const context = vm.createContext({ board, document: { querySelector: () => hud } });
  vm.runInContext(positionBossHealth, context);
  context.positionBossHealth();
  assert.equal(properties['--boss-health-gap'], '50px');
  board.getBoundingClientRect = () => ({ top: 190 });
  context.positionBossHealth();
  assert.equal(properties['--boss-health-gap'], '0px');
  assert.match(styles, /\.boss-health \{ bottom: calc\(\(var\(--boss-health-gap, 2px\) \+ 10px\) \/ -2\); height: 10px;/);
  assert.match(source, /new ResizeObserver\(positionBossHealth\)/);
});
