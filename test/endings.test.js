'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const helpers = source.slice(source.indexOf('function updateEnding('), source.indexOf('function render('));
const transition = source.slice(source.indexOf('  if (ending?.game !== game'), source.indexOf('  if (displayedState === game.state) return;'));
const completionResults = source.slice(source.indexOf('function showCompletionResults('), source.indexOf('function syncUI('));

function fixture(state = 'won') {
  const game = { state, levelIndex: 0, width: 600, height: 960, cat: { x: 100, y: 200 } };
  const overlay = { hidden: false }, status = {}, toast = {}, document = { hidden: false, querySelector: () => null };
  let saves = 0, maps = 0, results = 0;
  const summary = { result: {}, previousStats: {}, newRecords: {} };
  const context = vm.createContext({
    game, ending: null, endingMotion: { matches: false }, tutorial: null,
    displayedState: 'playing', overlay, status, toast, document,
    saveResult: () => { saves++; return summary; },
    showCompletionResults(value) { results++; assert.equal(value, summary); },
    openLevelPicker(options) {
      maps++;
      assert.equal(options.insideWorld, true);
      assert.equal(options.advance, true);
      assert.equal(options.level, game.levelIndex);
    },
  });
  vm.runInContext(`${helpers}\nfunction transition() { ${transition} return true; }`, context);
  return { context, game, overlay, document, get saves() { return saves; }, get maps() { return maps; }, get results() { return results; } };
}

test('endings defer dialogs, freeze gameplay, and record finished results immediately just once', () => {
  for (const state of ['won', 'lost']) {
    const app = fixture(state), c = app.context;
    assert.equal(c.transition(), undefined);
    assert.equal(app.overlay.hidden, true);
    assert.equal(app.saves, 1);
    for (let i = 0; i < 30; i++) c.updateEnding(.1);
    assert.equal(c.transition(), state === 'won' ? undefined : true);
    assert.equal(app.maps, 0);
    assert.equal(app.results, state === 'won' ? 1 : 0);
    c.transition();
    assert.equal(app.maps, 0, 'the map waits until the results popup is continued');
    assert.equal(app.results, state === 'won' ? 1 : 0, 'the victory popup opens once');
    assert.equal(app.saves, 1);
    assert.equal(app.game.state, state);
    assert.deepEqual(app.game.cat, { x: 100, y: 200 });
  }
});

test('victory bounces before approaching the exact board center and growing', () => {
  const { context: c } = fixture();
  c.transition();
  const sequence = c.ending;
  const initial = c.endingPose(sequence, 600, 960);
  assert.equal(initial.x, 100); assert.equal(initial.y, 200); assert.equal(initial.scale, 1);
  sequence.elapsed = .15;
  const bounce = c.endingPose(sequence, 600, 960);
  assert.ok(bounce.y < initial.y); assert.notEqual(bounce.rotation, 0);
  sequence.elapsed = sequence.duration;
  const final = c.endingPose(sequence, 600, 960);
  assert.equal(final.x, 300); assert.equal(final.y, 480);
  assert.equal(final.scale, 3.2); assert.ok(Math.abs(final.rotation) < 1e-9);
});

test('every loss spins twice and keeps even off-board Koshi visible', () => {
  const { context: c, game } = fixture('lost');
  game.cat = { x: -50, y: 1200 };
  c.transition();
  c.ending.elapsed = c.ending.duration;
  const pose = c.endingPose(c.ending, 600, 960);
  assert.equal(pose.x, 40); assert.equal(pose.y, 920);
  assert.equal(pose.rotation, Math.PI * 4);
});

test('menus and hidden pages freeze endings; new attempts discard them; reduced motion skips them', () => {
  const app = fixture(), { context: c, document, game } = app;
  c.transition();
  document.hidden = true; c.updateEnding(.1);
  assert.equal(c.ending.elapsed, 0);
  document.hidden = false; document.querySelector = () => ({ open: true }); c.updateEnding(.1);
  assert.equal(c.ending.elapsed, 0);
  document.querySelector = () => null; c.updateEnding(.1);
  assert.equal(c.ending.elapsed, .1);
  c.endingMotion.matches = true;
  assert.equal(c.transition(), undefined);
  assert.equal(c.transition(), undefined, 'reduced motion presents the result popup once');
  assert.equal(app.results, 1);
  game.state = 'ready';
  assert.equal(c.transition(), true);
  assert.equal(c.ending, null);
});

test('completion popup shows the prior-star note and compares all four records', () => {
  const elements = new Map();
  const node = () => ({
    children: [], hidden: false, textContent: '', className: '', attributes: {},
    append(...children) { this.children.push(...children); },
    insertBefore(child, reference) {
      const index = this.children.indexOf(reference);
      this.children.splice(index < 0 ? 0 : index, 0, child);
    },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name]; },
    showModal() { this.open = true; },
    focus() {},
  });
  const document = {
    createElement: node,
    createTextNode(text) { return { textContent: text }; },
    querySelector(selector) {
      if (selector === '#level-results-rows tbody') {
        if (!elements.has('#level-results-rows')) {
          const table = node(), header = node(), body = node();
          for (const text of ['', 'This Run', 'Record']) {
            const cell = node();
            cell.textContent = text;
            header.append(cell);
          }
          table.append(header, body);
          elements.set('#level-results-rows', table);
        }
        const body = elements.get('#level-results-rows').children[1];
        elements.set(selector, body);
        return body;
      }
      if (!elements.has(selector)) {
        elements.set(selector, node());
      }
      return elements.get(selector);
    },
  };
  const context = vm.createContext({
    document, game: { level: { number: '1-1', id: '1-1' } }, overlay: { hidden: false },
  });
  vm.runInContext(completionResults, context);
  context.showCompletionResults({
    result: { damageFree: true, time: 12.5, food: 25, enemy: 4, goals: 2 },
    previousStats: { goldStar: true, bestTime: 15, mostFood: 20, mostEnemies: 4, mostGoals: 1 },
    newRecords: { time: true, food: true, enemy: false, goals: true },
  });
  assert.equal(elements.get('#level-results').open, true);
  assert.equal(elements.get('#level-results-heading').textContent, 'Level 1-1 complete');
  assert.equal(elements.get('#level-results-star').hidden, false);
  assert.equal(elements.get('#level-results-star-prior').hidden, false);
  assert.deepEqual(elements.get('#level-results-rows').children[0].children.map(cell => cell.textContent),
    ['', 'This Run', 'Record']);
  assert.equal(elements.get('#level-results-rows tbody').children.length, 4);
  assert.deepEqual(Array.from(elements.get('#level-results-rows tbody').children, row => row.className), [
    'level-result-row new-record', 'level-result-row new-record', 'level-result-row',
    'level-result-row new-record',
  ]);
  const rows = elements.get('#level-results-rows tbody').children;
  assert.deepEqual(rows.map(row => row.children.map(cell => String(cell.textContent))), [
    ['🕒', '12.50', '15.00'], ['🍗', '25', '20'], ['👾', '4', '4'], ['⚽', '2', '1'],
  ]);
  assert.deepEqual(rows.map(row => row.children[1].children.map(child => child.textContent)), [
    ['😺'], ['😺'], [], ['😺'],
  ]);
  assert.deepEqual(rows.map(row => row.children[0].children.map(child => child.textContent)), [
    [':'], [':'], [':'], [':'],
  ]);
  assert.deepEqual(rows.map(row => row.children[0].getAttribute('aria-label')),
    ['Completion time', 'Food points', 'Enemy points', 'Soccer goals']);
  assert.equal(elements.get('#level-results-record-legend').hidden, false);
  context.showCompletionResults({
    result: { damageFree: false, time: 20, food: 10, enemy: 1, goals: 0 },
    previousStats: { goldStar: true, bestTime: 15, mostFood: 20, mostEnemies: 4, mostGoals: 1 },
    newRecords: { time: false, food: false, enemy: false, goals: false },
  });
  assert.equal(elements.get('#level-results-star').hidden, true);
  assert.equal(elements.get('#level-results-star-prior').hidden, true);
  assert.equal(elements.get('#level-results-record-legend').hidden, true);
});

test('continuing from completion closes the popup and advances to the campaign map', () => {
  const closed = { value: false }, options = [];
  const context = vm.createContext({
    levelResultsDialog: { close() { closed.value = true; } },
    ending: { game: null, mapReturned: false },
    game: { levelIndex: 4 },
    openLevelPicker(value) { options.push(value); },
  });
  context.ending.game = context.game;
  const handler = source.slice(source.indexOf('function continueFromCompletion('),
    source.indexOf("document.querySelector('#level-results-continue').addEventListener"));
  vm.runInContext(handler, context);
  context.continueFromCompletion();
  assert.equal(closed.value, true);
  assert.equal(context.ending.mapReturned, true);
  assert.deepEqual(JSON.parse(JSON.stringify(options)), [{ insideWorld: true, level: 4, advance: true }]);
});

test('ending faces have smiling open mouths or X eyes with a frown', () => {
  const operations = [];
  const ctx = new Proxy({}, {
    get: (_, name) => (...args) => operations.push([name, ...args]),
    set: () => true,
  });
  const c = vm.createContext({ ctx, game: {} });
  vm.runInContext(source.slice(source.indexOf('function line('), source.indexOf('function updateEnding(')), c);
  c.drawCat(0, 0, 0, null, false, 'lost');
  assert.ok(operations.some(op => op[0] === 'quadraticCurveTo' && op.slice(1).join(',') === '0,7,8,16'));
  assert.equal(operations.filter(op => op[0] === 'lineTo' && op[2] === 1).length, 4, 'two crosses');
  operations.length = 0;
  c.drawCat(0, 0, 0, null, false, 'won');
  assert.ok(operations.some(op => op[0] === 'quadraticCurveTo' && op.slice(1).join(',') === '0,28,-8,10'), 'open cheering smile');
});

test('only the victory smile has a pointed upper fang and a shorter flat-tipped fang clipped inside the mouth', () => {
  const operations = [];
  const ctx = new Proxy({}, {
    get: (_, name) => (...args) => operations.push([name, ...args]),
    set: (_, name, value) => { operations.push(['set', name, value]); return true; },
  });
  const c = vm.createContext({ ctx, game: {} });
  vm.runInContext(source.slice(source.indexOf('function line('), source.indexOf('function updateEnding(')), c);
  for (const expression of [null, 'lost', 'won']) {
    operations.length = 0;
    c.drawCat(0, 0, 0, null, false, expression);
    const clip = operations.findIndex(op => op[0] === 'clip');
    if (expression !== 'won') {
      assert.equal(clip, -1, 'normal and loss faces remain unchanged');
      continue;
    }
    assert.ok(clip > 0);
    assert.equal(operations[clip - 2][0], 'stroke', 'clip the existing smiling mouth path');
    assert.deepEqual(operations.slice(clip + 1, clip + 16), [
      ['set', 'fillStyle', '#eff2ed'],
      ['beginPath'], ['moveTo', -6, 10], ['lineTo', -2, 10], ['lineTo', -4, 19], ['closePath'], ['fill'],
      ['beginPath'], ['moveTo', 2, 10], ['lineTo', 6, 10], ['lineTo', 5, 16], ['lineTo', 3, 16], ['closePath'], ['fill'],
      ['restore'],
    ]);
  }
});
