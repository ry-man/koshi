'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const helpers = source.slice(source.indexOf('function updateEnding('), source.indexOf('function render('));
const transition = source.slice(source.indexOf('  if (ending?.game !== game'), source.indexOf('  displayedState = game.state;'));

function fixture(state = 'won') {
  const game = { state, width: 600, height: 960, cat: { x: 100, y: 200 } };
  const overlay = { hidden: false }, status = {}, toast = {}, document = { hidden: false, querySelector: () => null };
  let saves = 0;
  const context = vm.createContext({
    game, ending: null, endingMotion: { matches: false }, tutorial: null,
    displayedState: 'playing', overlay, status, toast, document,
    saveVictory: () => { saves++; },
  });
  vm.runInContext(`${helpers}\nfunction transition() { ${transition} return true; }`, context);
  return { context, game, overlay, document, get saves() { return saves; } };
}

test('endings defer results, freeze gameplay, and save wins immediately just once', () => {
  for (const state of ['won', 'lost']) {
    const app = fixture(state), c = app.context;
    assert.equal(c.transition(), undefined);
    assert.equal(app.overlay.hidden, true);
    assert.equal(app.saves, state === 'won' ? 1 : 0);
    for (let i = 0; i < 30; i++) c.updateEnding(.1);
    assert.equal(c.transition(), true);
    assert.equal(app.saves, state === 'won' ? 1 : 0);
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
  const { context: c, document, game } = fixture();
  c.transition();
  document.hidden = true; c.updateEnding(.1);
  assert.equal(c.ending.elapsed, 0);
  document.hidden = false; document.querySelector = () => ({ open: true }); c.updateEnding(.1);
  assert.equal(c.ending.elapsed, 0);
  document.querySelector = () => null; c.updateEnding(.1);
  assert.equal(c.ending.elapsed, .1);
  c.endingMotion.matches = true;
  assert.equal(c.transition(), true);
  game.state = 'ready';
  assert.equal(c.transition(), true);
  assert.equal(c.ending, null);
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
