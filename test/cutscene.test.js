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

test('all campaign scenes validate and every story character speaks', () => {
  const speakers = new Set();
  for (const level of LEVELS) {
    assert.deepEqual(validateCutscene(level.cutscene), level.cutscene);
    for (const line of level.cutscene.lines) speakers.add(line.speaker);
  }
  assert.deepEqual([...speakers].sort(), Object.keys(CHARACTERS).sort());
});

test('Tom commands the campaign in every scene and round-trips as a custom speaker and actor', () => {
  assert.equal(CHARACTERS.tom, 'Tom the Duck');
  for (const campaign of LEVELS) {
    assert.ok(campaign.cutscene.lines.some(line => line.speaker === 'tom'));
    for (const line of campaign.cutscene.lines) {
      assert.ok(line.actors.some(actor => actor.character === 'tom'));
      assert.equal(new Set(line.actors.map(actor => actor.x)).size, line.actors.length);
    }
    assert.ok(campaign.enemies.every(([, type]) => type !== 'tom'), 'Tom is a story antagonist, not a new combat enemy');
  }
  const source = { ...level(), cutscene: {
    theme: 'workshop', lines: [{ speaker: 'tom', text: 'My robots guard this pantry!', actors: [
      { character: 'tom', x: .5, y: .6 }, { character: 'koshi', x: .25, y: .65 },
    ] }],
  } };
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(source))), source);
  assert.throws(() => validateCutscene({ ...source.cutscene, lines: [{
    ...source.cutscene.lines[0], actors: [{ character: 'koshi', x: .25, y: .65 }],
  }] }), /speaking character/);
});

test('Tom has a distinct full-body drawing and pixel portrait with animated bill and antenna', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
  const drawing = source.slice(source.indexOf('function drawTom('), source.indexOf('class CutscenePlayer'));
  const operations = [];
  const gradient = { addColorStop(...args) { operations.push(['gradient', ...args]); } };
  const ctx = new Proxy({}, {
    get(target, name) {
      if (name === 'createLinearGradient') return () => gradient;
      return (...args) => operations.push([name, ...args]);
    },
    set(target, name, value) { operations.push([name, value]); return true; },
  });
  const context = vm.createContext({});
  vm.runInContext(drawing, context);
  const draw = (speaking, portrait = false) => {
    operations.length = 0;
    if (portrait) context.drawPortrait(ctx, 'tom', speaking, 0);
    else context.drawTom(ctx, 0, speaking);
    return JSON.stringify(operations);
  };
  const still = draw(false), talking = draw(true);
  assert.notEqual(still, talking);
  assert.match(still, /#95d1c0/);
  assert.match(talking, /#ea7070/);
  assert.match(still, /gradient/);
  assert.notEqual(draw(false, true), draw(true, true));
  assert.match(source, /if \(actor\.character === 'tom'\) drawTom\(ctx, time, speaking\)/);
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

test('cutscene rendering reserves full dialogue and reveals Unicode letters in place', () => {
  const elements = new Map();
  const document = {
    hidden: false,
    createElement() { return { style: {}, textContent: '' }; },
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, {
        addEventListener() {}, showModal() {}, close() {}, focus() {},
        parentElement: { scrollTop: 50 },
        replaceChildren(...children) { this.children = children; },
      });
      return elements.get(selector);
    },
    addEventListener() {},
  };
  const motion = { matches: false };
  const context = vm.createContext({
    KoshiGame: { Cutscene, CHARACTERS }, document, window: { addEventListener() {} },
    matchMedia: () => motion, ResizeObserver: class { observe() {} },
  });
  vm.runInContext(readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8'), context);
  const player = new context.KoshiCutscenePlayer(() => {}, () => {});
  player.draw = () => {};
  const data = scene();
  data.lines[0].text = 'Hi 🐾! A longer word.\nNext row.';
  player.open(data, 1);
  const text = elements.get('#cutscene-text');
  const characters = text.children;
  const visibleText = () => text.children.filter(span => span.style.visibility === 'visible').map(span => span.textContent).join('');
  assert.equal(characters.map(span => span.textContent).join(''), data.lines[0].text);
  assert.equal(characters.length, Array.from(data.lines[0].text).length);
  assert.equal(visibleText(), '');
  assert.equal(text.parentElement.scrollTop, 0);
  assert.equal(elements.get('#cutscene-transcript').textContent, `Koshi: ${data.lines[0].text}`);
  for (let i = 1; i <= characters.length; i++) {
    player.playback.elapsed = i / 30 + .000001;
    player.update(0);
    assert.equal(text.children, characters, 'layout nodes stay unchanged while typing');
    assert.equal(visibleText(), Array.from(data.lines[0].text).slice(0, i).join(''));
  }
  player.advance();
  assert.notEqual(text.children, characters);
  assert.equal(visibleText(), '');
  assert.equal(text.children.map(span => span.textContent).join(''), data.lines[1].text);
  player.advance();
  assert.equal(visibleText(), data.lines[1].text);
  player.open(data, 1);
  motion.matches = true;
  player.update(0);
  assert.equal(visibleText(), data.lines[0].text);
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
