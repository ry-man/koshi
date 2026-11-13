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
    WORLDS: [{ id: '1', name: 'World one' }, { id: '3S', name: 'Special world' }],
    syncLevelRewards() {}, levelObjective: () => '', displayedStuck: false,
    levelInfoReplay: node('#level-info-replay'), document: { querySelector: node },
    timer: node('#timer'), foodCount: node('#food-count'), hearts: node('#hearts'),
    progress: node('#progress'), progressLabel: node('#progress-label'),
  });
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
  assert.match(node('#food-count').innerHTML, /class="counter-value">123 \/ 999<\/span>/);
  assert.match(node('#enemy-count').innerHTML, /class="counter-value">456 \/ 999<\/span>/);
  assert.equal(node('#food-count').attributes['aria-label'], '123 of 999 food collected');
  assert.equal(node('#enemy-count').attributes['aria-label'], '456 of 999 enemy points earned');
  assert.equal(node('#heart-cost-numbers').textContent, '123/999');
  assert.equal(node('#heart-cost-meter').attributes['aria-valuenow'], 123);
  context.game.level.survive = true;
  context.syncUI();
  assert.match(node('#food-count').innerHTML, /class="counter-value">123<\/span>/);
  assert.match(node('#enemy-count').innerHTML, /class="counter-value">456<\/span>/);
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
