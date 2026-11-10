'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Cutscene, CHARACTERS } = require('../src/game.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const narration = [
  'The world was once a peaceful place. That was, before the evil AI robots took over.',
  'Human technology advanced too fast, and eventually an evil robot duck named Tom gained sufficient power to topple nations.',
  'The fate of the planet falls to this unassuming cat, named Koshi. Is he a bad enough dude to save the world?',
];

function fixture(reduced = false) {
  const elements = new Map(), events = new Map(), drawings = [], transitions = [];
  const context2d = new Proxy({}, {
    get(_, name) {
      if (name === 'createLinearGradient') return () => ({ addColorStop() {} });
      return (...args) => {
        assert.ok(args.every(value => typeof value !== 'number' || Number.isFinite(value)), name);
        drawings.push([name, ...args]);
      };
    },
    set(_, name, value) { drawings.push([name, value]); return true; },
  });
  const document = {
    hidden: false,
    createElement: () => ({ style: {} }),
    addEventListener(name, callback) { events.set(`document:${name}`, callback); },
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, {
        clientWidth: 960, clientHeight: 540,
        parentElement: { scrollTop: 0 },
        getContext: () => context2d,
        replaceChildren(...children) { this.children = children; },
        addEventListener(name, callback) { events.set(`${selector}:${name}`, callback); },
        showModal() { this.open = true; }, close() { this.open = false; }, focus() {},
      });
      return elements.get(selector);
    },
  };
  const context = vm.createContext({
    KoshiGame: { Cutscene, CHARACTERS }, document,
    window: { addEventListener() {}, devicePixelRatio: 1 },
    matchMedia: () => ({ matches: reduced }), ResizeObserver: class { observe() {} },
  });
  vm.runInContext(read('src/cutscene.js'), context);
  let levelFinishes = 0, openingFinishes = 0;
  const player = new context.KoshiCutscenePlayer(() => {}, () => levelFinishes++,
    (action, options) => { transitions.push(options); action(); });
  player.openOpening(() => openingFinishes++);
  return { player, document, elements, events, drawings, transitions,
    counts: () => ({ levelFinishes, openingFinishes }) };
}

test('opening preserves all narration verbatim, reveals text, and finishes at the world map instead of a level', () => {
  const { player, elements, transitions, counts } = fixture();
  assert.equal(elements.get('#cutscene-portrait').hidden, true);
  assert.match(read('style.css'), /#cutscene-portrait\[hidden\]\s*\{ display: none; \}/);
  assert.match(elements.get('#cutscene-heading').textContent, /Prologue/);
  for (const [index, text] of narration.entries()) {
    assert.equal(player.playback.index, index);
    assert.equal(player.playback.line.text, text);
    assert.equal(elements.get('#cutscene-speaker').textContent, 'Narrator');
    assert.equal(elements.get('#cutscene-transcript').textContent, `Narrator: ${text}`);
    assert.equal(player.playback.typing, true);
    player.advance();
    assert.equal(player.playback.text, text);
    assert.equal(elements.get('#cutscene-next').textContent, index === 2 ? 'World map' : 'Continue');
    player.advance();
  }
  assert.equal(player.active, false);
  assert.equal(elements.get('#cutscene').open, false);
  assert.equal(transitions[0].fade, true);
  assert.deepEqual(counts(), { levelFinishes: 0, openingFinishes: 1 });
  player.finish();
  assert.equal(counts().openingFinishes, 1);
});

test('skip, Escape and cancel leave the opening through its fade without recording a level cutscene', () => {
  for (const event of ['#cutscene-skip:click', '#cutscene:keydown', '#cutscene:cancel']) {
    const { player, events, transitions, counts } = fixture();
    events.get(event)({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
    assert.equal(player.active, false);
    assert.equal(transitions[0].fade, true);
    assert.deepEqual(counts(), { levelFinishes: 0, openingFinishes: 1 });
  }
});

test('opening artwork is distinct, animated, finite, and fully framed on phones and desktops', () => {
  const { player, drawings } = fixture();
  const scenes = [];
  for (let index = 0; index < 3; index++) {
    player.playback.index = index;
    for (const [width, height] of [[1440, 600], [390, 540], [844, 220]]) {
      player.stage.clientWidth = width; player.stage.clientHeight = height;
      drawings.length = 0; player.draw();
      const transform = drawings.filter(([name]) => name === 'setTransform')[1];
      const [, scaleX, , , scaleY, x, y] = transform;
      assert.equal(scaleX, scaleY);
      assert.ok(x >= 0 && y >= 0);
      assert.ok(x + 960 * scaleX <= width + 1e-8);
      assert.ok(y + 540 * scaleY <= height + 1e-8);
    }
    scenes.push(JSON.stringify(drawings));
  }
  assert.equal(new Set(scenes).size, 3);
  assert.match(scenes[0], /#fff3a0/);
  assert.match(scenes[1], /#9bdf7c99/);
  assert.match(scenes[2], /fillText","Z"/);
  drawings.length = 0;
  player.playback.elapsed = 1; player.draw();
  assert.notEqual(JSON.stringify(drawings), scenes[2]);
});

test('reduced motion shows complete narration and static art; normal level scenes restore their portrait and callback', () => {
  const { player, drawings, elements, counts, transitions } = fixture(true);
  const initial = JSON.stringify(drawings);
  drawings.length = 0;
  player.update(.1);
  assert.equal(player.playback.text, narration[0]);
  assert.equal(JSON.stringify(drawings), initial);
  player.finish();
  player.open({ theme: 'garden', lines: [{
    speaker: 'koshi', text: 'A regular level.', actors: [{ character: 'koshi', x: .5, y: .7 }],
  }] }, '1-1');
  assert.equal(elements.get('#cutscene-portrait').hidden, false);
  assert.equal(elements.get('#cutscene-speaker').textContent, 'Koshi');
  assert.equal(elements.get('#cutscene-next').textContent, 'Begin level');
  player.finish();
  assert.equal(transitions[1].fade, false);
  assert.deepEqual(counts(), { levelFinishes: 1, openingFinishes: 1 });
});

test('sleeping Koshi has the gameplay grey tabby fur, face markings, pink ears and nose, and whiskers', () => {
  const { player, drawings } = fixture();
  player.playback.index = 2;
  drawings.length = 0;
  player.draw();
  const gameplay = read('src/app.js');
  const cat = gameplay.slice(gameplay.indexOf('function drawCat('), gameplay.indexOf('function drawCatShield('));
  for (const color of ['#abb5bd', '#596571', '#d6a4a4', '#eff2ed', '#26323a', '#bd8d93', '#34414a', '#d7dfdc']) {
    assert.ok(cat.includes(color), `${color} matches gameplay Koshi`);
    assert.ok(drawings.some(([name, value]) => ['fillStyle', 'strokeStyle'].includes(name) && value === color),
      `${color} is used in the sleeping illustration`);
  }
  assert.ok(drawings.some(([name, x, y, rx, ry]) =>
    name === 'ellipse' && x === 0 && y === 0 && rx === 23 && ry === 23), 'same round head as gameplay');
  assert.ok(drawings.some(([name, x, y]) => name === 'moveTo' && x === -22 && y === -3),
    'left cheek stripe');
  assert.ok(drawings.some(([name, x, y]) => name === 'moveTo' && x === 22 && y === -3),
    'right cheek stripe');
  assert.ok(drawings.some(([name, x, y]) => name === 'moveTo' && x === 0 && y === -12),
    'white central face blaze');
});

test('new Official save and first guest starts play the opening, but resumes and Beta starts bypass it', () => {
  const app = read('src/app.js');
  const source = app.slice(app.indexOf('function continueSave('), app.indexOf('function renderSaveSlots('));
  for (const campaignId of ['official', 'beta']) {
    const calls = [];
    const slot = { id: 'new-save' };
    const context = vm.createContext({
      campaignId, activeSave: null, guestOpeningViewed: false,
      saves: { load: () => [slot], slot: () => slot, markRecent() {}, resumeLevel: () => 7 },
      updateSaveProfile() {}, autoPause() {},
      titleScreen: { open: true, close() { this.open = false; } },
      saveDialog: { open: true, close() { this.open = false; } },
      phaseTransition: { run(action, options) { calls.push(['transition', options.fade]); action(); } },
      cutscene: { openOpening(callback) { calls.push(['opening']); callback(); } },
      openLevelPicker: options => calls.push(['map', options.insideWorld, options.level]),
    });
    vm.runInContext(source, context);
    context.startAdventure();
    assert.equal(calls.some(([kind]) => kind === 'opening'), campaignId === 'official');
    assert.equal(context.guestOpeningViewed, campaignId === 'official');
    calls.length = 0;
    context.startAdventure();
    assert.deepEqual(calls, [['map', undefined, null]], 'returning guests keep their current selection');
    calls.length = 0;
    context.continueSave(0, slot.id, true);
    assert.equal(calls.some(([kind]) => kind === 'opening'), campaignId === 'official');
    assert.deepEqual(calls.at(-1), ['map', undefined, 0]);
    calls.length = 0;
    context.continueSave(0, slot.id);
    assert.deepEqual(calls, [['map', true, 7]], 'existing saves resume directly in their world');
  }
  assert.match(app, /else startAdventure\(\);/);
  assert.match(app, /#save-guest'[\s\S]*?startAdventure\(\{ level: 0 \}\)/);
});

test('opening frames animate even without a loaded level and never tick gameplay', () => {
  const app = read('src/app.js');
  const source = app.slice(app.indexOf('function frame('), app.indexOf('function updateBoardVisibility('));
  let updates = 0, frames = 0;
  const context = vm.createContext({
    cutscene: { active: true, openingFinish() {}, update: seconds => { updates++; assert.equal(seconds, .05); } },
    phaseTransition: { busy: false }, lastTime: 100,
    requestAnimationFrame: () => frames++,
  });
  vm.runInContext(source, context);
  context.frame(150);
  assert.equal(updates, 1);
  assert.equal(frames, 1);
  context.phaseTransition.busy = true;
  context.frame(200);
  assert.equal(updates, 1, 'text is frozen while the fade covers the screen');
  assert.equal(frames, 2);
});
