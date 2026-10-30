const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, CHARACTERS, Cutscene, validateCutscene, validateCustomLevel } = require('../src/game.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scene = () => ({
  theme: 'garden',
  lines: [
    { speaker: 'koshi', text: 'Hello, garden!', actors: [{ character: 'koshi', x: .3, y: .6 }] },
    { speaker: 'mouse', text: 'Squeak!', actors: [{ character: 'mouse', x: .7, y: .6 }] },
  ],
});
const level = () => ({ version: 1, id: 'Story test', duration: 30, goal: 20, heartCost: null, brickSet: 1, events: [], cutscene: scene() });

test('all campaign scenes validate and every gameplay character speaks', () => {
  const speakers = new Set();
  for (const level of LEVELS) {
    assert.deepEqual(validateCutscene(level.cutscene), level.cutscene);
    for (const line of level.cutscene.lines) speakers.add(line.speaker);
  }
  assert.deepEqual([...speakers].sort(), Object.keys(CHARACTERS).sort());
});

test('optional cutscenes survive custom-level round trips independently of source data', () => {
  const source = level(), copy = validateCustomLevel(source);
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(copy))), copy);
  source.cutscene.lines[0].actors[0].x = .9;
  assert.equal(copy.cutscene.lines[0].actors[0].x, .3);
  delete source.cutscene;
  assert.equal(Object.hasOwn(validateCustomLevel(source), 'cutscene'), false);
});

test('cutscene validation rejects malformed dialogue, actors, themes, and oversized input', () => {
  const invalid = [null, [], {}, { ...scene(), theme: 'unknown' }, { ...scene(), lines: [] }, { ...scene(), lines: Array(101).fill(scene().lines[0]) }];
  for (const patch of [
    { speaker: '__proto__' }, { speaker: 1 }, { text: '' }, { text: '   ' }, { text: 'x'.repeat(241) },
    { actors: [] }, { actors: Array(7).fill(scene().lines[0].actors[0]) },
    { actors: [{ character: 'wheel', x: .5, y: .5 }] },
    ...[NaN, Infinity, -.1, 0, 1, '0.5', null].map(x => ({ actors: [{ character: 'koshi', x, y: .6 }] })),
    { actors: [{ character: 'other', x: .5, y: .5 }] },
  ]) invalid.push({ ...scene(), lines: [{ ...scene().lines[0], ...patch }] });
  for (const cutscene of invalid) assert.throws(() => validateCustomLevel({ ...level(), cutscene }), /Cutscene:/);
});

test('dialogue types at 30 characters per second and requires explicit advancement', () => {
  const playback = new Cutscene(scene());
  assert.equal(playback.text, '');
  playback.update(.1);
  assert.equal(playback.text, 'Hel');
  assert.equal(playback.typing, true);
  playback.advance();
  assert.equal(playback.text, 'Hello, garden!');
  assert.equal(playback.index, 0);
  playback.advance();
  assert.equal(playback.index, 1);
  assert.equal(playback.text, '');
  playback.update(100);
  assert.equal(playback.text, 'Squeak!');
  assert.equal(playback.finished, false);
  playback.advance();
  assert.equal(playback.finished, true);
  playback.advance();
  assert.equal(playback.index, 1);
});

test('reduced motion, Unicode, skip, and invalid deltas behave predictably', () => {
  const data = scene(); data.lines[0].text = 'Hi 🐾!';
  const playback = new Cutscene(data);
  for (const delta of [NaN, Infinity, -1, 0]) playback.update(delta);
  assert.equal(playback.text, '');
  playback.update(4 / 30);
  assert.equal(playback.text, 'Hi 🐾');
  playback.skip();
  playback.update(5);
  assert.equal(playback.finished, true);
  const reduced = new Cutscene(data, true);
  assert.equal(reduced.text, 'Hi 🐾!');
  assert.equal(reduced.typing, false);
  reduced.advance();
  assert.equal(reduced.index, 1);
});

test('scene playback leaves gameplay ready and time-zero events unspawned until start', () => {
  const game = new Game(() => .5, { customLevel: { ...level(), events: [{ kind: 'weapon', type: 'wood', time: 0, x: .5, y: .5 }] } });
  const playback = new Cutscene(game.level.cutscene);
  playback.update(100);
  game.update(100);
  assert.equal(game.elapsed, 0);
  assert.equal(game.state, 'ready');
  assert.equal(game.weapons.length, 0);
  assert.equal(game.steer(0), false);
  playback.skip(); game.start();
  assert.equal(game.elapsed, 0);
  assert.equal(game.state, 'playing');
  assert.equal(game.weapons.length, 1);
});

test('cutscene controls handle Escape and keyboard reveal without leaking gameplay shortcuts', () => {
  const elements = new Map(), events = new Map();
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, {
        addEventListener(name, callback) { events.set(`${selector}:${name}`, callback); },
        close() {},
      });
      return elements.get(selector);
    },
    addEventListener() {},
  };
  const context = vm.createContext({
    KoshiGame: { Cutscene, CHARACTERS }, document, window: { addEventListener() {} },
    matchMedia: () => ({ matches: false }), ResizeObserver: class { observe() {} },
  });
  vm.runInContext(readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8'), context);
  let finished = 0, advanced = 0;
  const player = new context.KoshiCutscenePlayer(() => {}, () => { finished++; });
  player.playback = new Cutscene(scene());
  player.advance = () => { advanced++; };
  let prevented = 0, stopped = 0;
  const keydown = events.get('#cutscene:keydown');
  const key = (value, tagName) => keydown({
    key: value, target: { tagName },
    preventDefault() { prevented++; }, stopPropagation() { stopped++; },
  });
  key('Enter', 'DIV');
  key(' ', 'DIV');
  key('Enter', 'BUTTON');
  assert.equal(advanced, 2, 'buttons use their native click rather than advancing twice');
  assert.equal(stopped, 3);
  key('Escape', 'BUTTON');
  assert.equal(prevented, 3);
  assert.equal(stopped, 4);
  assert.equal(player.active, false);
  assert.equal(finished, 1);
  player.finish();
  assert.equal(finished, 1, 'completion starts gameplay only once');
});
