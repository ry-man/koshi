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
  const originalSpeakers = new Set(LEVELS.slice(0, 19).flatMap(level => level.cutscene.lines.map(line => line.speaker)));
  for (const character of ['ball', 'jackolantern', 'snake']) assert.ok(!originalSpeakers.has(character), 'new actors do not change original campaign scenes');
});

test('Tom commands the campaign in every scene and round-trips as a custom speaker and actor', () => {
  assert.equal(CHARACTERS.tom, 'Tom the Duck');
  for (const campaign of LEVELS) {
    assert.ok(campaign.cutscene.lines.some(line => line.speaker === 'tom'));
    for (const line of campaign.cutscene.lines) {
      assert.ok(line.actors.some(actor => actor.character === 'tom'));
      assert.equal(new Set(line.actors.map(actor => actor.x)).size, line.actors.length);
      assert.ok(line.actors.filter(actor => actor.character !== 'koshi').length <= 3, `${campaign.id}: stage clutter`);
    }
    const cast = new Set(campaign.cutscene.lines.flatMap(line => line.actors.map(actor => actor.character)).filter(character => character !== 'koshi'));
    assert.ok(cast.size <= 3, `${campaign.id}: scene has at most three enemies including Tom`);
    for (const character of cast) assert.ok(character === 'tom' || campaign.enemies.some(([, type]) => type === character), `${campaign.id}: level-appropriate cast`);
    assert.ok(campaign.enemies.every(([, type]) => type !== 'tom'), 'Tom is a story antagonist, not a new combat enemy');
  }
  const source = { ...level(), cutscene: {
    theme: 'workshop', lines: [{ speaker: 'tom', text: 'My robots guard this pantry!', actors: [
      { character: 'tom', x: .5, y: .6 }, { character: 'koshi', x: .25, y: .65 },
    ] }],
  } };
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(source))), source);
  const snakeScene = { theme: 'workshop', lines: [{
    speaker: 'snake', text: 'Sss...', actors: [{ character: 'snake', x: .5, y: .65 }, { character: 'koshi', x: .25, y: .65 }],
  }] };
  assert.deepEqual(validateCustomLevel({ ...level(), cutscene: snakeScene }).cutscene, snakeScene);
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

test('every story character has a distinct animated portrait with finite drawing coordinates', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('function drawPortrait('), source.indexOf('class CutscenePlayer')), context);
  const drawings = [];
  for (const character of Object.keys(CHARACTERS)) {
    const draw = speaking => {
      const operations = [];
      const ctx = new Proxy({}, {
        get: (_, name) => (...args) => {
          assert.ok(args.every(value => typeof value !== 'number' || Number.isFinite(value)));
          operations.push([name, ...args]);
        },
        set: (_, name, value) => { operations.push([name, value]); return true; },
      });
      context.drawPortrait(ctx, character, speaking, 0);
      return JSON.stringify(operations);
    };
    const still = draw(false);
    assert.notEqual(draw(true), still, character);
    drawings.push(still);
  }
  assert.equal(new Set(drawings).size, Object.keys(CHARACTERS).length);
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

test('speaking mouse portraits show two front teeth without giving wheels the same teeth', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
  const operations = [];
  const ctx = {
    clearRect() {},
    fillRect(...args) { operations.push([...args, this.fillStyle]); },
  };
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('function drawPortrait('), source.indexOf('class CutscenePlayer')), context);
  const teeth = (character, speaking) => {
    operations.length = 0;
    context.drawPortrait(ctx, character, speaking, 0);
    return operations.filter(op => op.at(-1) === '#f2eee0');
  };
  assert.deepEqual(teeth('mouse', true), [[12, 22, 3, 5, '#f2eee0'], [17, 22, 3, 5, '#f2eee0']]);
  assert.deepEqual(teeth('mouse', false), []);
  assert.deepEqual(teeth('wheel', true), []);
});

test('stage shadows align with each character base and stay grounded while speakers bob', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
  const loop = source.slice(source.indexOf('    const actorScale ='), source.indexOf('    drawPortrait(this.portrait'));
  const operations = [];
  const ctx = new Proxy({}, { get: (_, name) => (...args) => operations.push([name, ...args]) });
  const context = vm.createContext({
    ctx, width: 390, height: 560, reducedMotion: true, time: .2,
    drawTom: () => operations.push(['draw', 'tom']),
  });
  vm.runInContext(`function stage(line) { ${loop} }`, context);
  const player = {
    positions: new Map(), paused: false,
    drawCharacter: (_, character) => operations.push(['draw', character]),
  };
  for (const [character, base] of Object.entries({ koshi: 23, tom: 46, mouse: 19, wheel: 24, ram: 19, bucket: 21, snake: 19 })) {
    const draw = speaker => {
      operations.length = 0;
      context.stage.call(player, { speaker, actors: [{ character, x: .5, y: .65 }] });
      return operations.slice();
    };
    const silent = draw('other'), speaking = draw(character);
    const shadow = speaking.findIndex(op => op[0] === 'ellipse');
    assert.deepEqual(speaking[shadow].slice(1, 5), [character === 'tom' ? -7 : 0, base, character === 'snake' ? 13 : 30, 7], character);
    assert.deepEqual(speaking.slice(0, shadow + 1), silent.slice(0, shadow + 1), 'shadow does not follow speaking bob');
    const bob = speaking.findIndex((op, i) => i > shadow && op[0] === 'translate');
    assert.ok(bob > shadow && bob < speaking.findIndex(op => op[0] === 'draw'), 'only the character bobs above its shadow');
    assert.ok(speaking[bob][2] > 0);
    if (character === 'snake') {
      assert.ok(speaking.some(([name, angle]) => name === 'rotate' && angle === Math.PI / 2), 'snake stands upright');
      assert.ok(speaking.some(([name, x, y]) => name === 'scale' && x === .32 && y === .32), 'snake fits the other actors');
    }
  }
});

test('gameplay snake spikes are large white triangles with black outlines', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, name) => (...args) => calls.push([name, ...args]),
    set: (_, name, value) => { calls.push([name, value]); return true; },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawSnakeSpikes('), source.indexOf('function drawSnakeTongue')), context);
  context.drawSnakeSpikes(19);
  assert.ok(calls.some(([name, value]) => name === 'fillStyle' && value === '#fff'));
  assert.ok(calls.some(([name, value]) => name === 'strokeStyle' && value === '#000'));
  assert.ok(calls.some(([name, value]) => name === 'lineWidth' && value === 1.5));
  assert.ok(Math.abs(Math.max(...calls.filter(([name]) => name === 'lineTo')
    .map(([, x, y]) => Math.hypot(x, y))) - 28) < 1e-8);
});

test('snake portraits are animated and full-size rendering uses world-space helper segments and death snapshots', () => {
  const cutscene = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
  const app = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert.match(app, /'jackolantern', 'snake', 'objectives'/);
  assert.match(app, /GUIDE\[guideIndex\]\.title === 'Robots & swords'\s*\?\s*'snake'/);
  const portraitContext = vm.createContext({});
  vm.runInContext(cutscene.slice(cutscene.indexOf('function drawPortrait('), cutscene.indexOf('class CutscenePlayer')), portraitContext);
  const portrait = speaking => {
    const calls = [];
    const ctx = new Proxy({}, {
      get: (_, name) => (...args) => calls.push([name, ...args]),
      set: (_, name, value) => { calls.push([name, value]); return true; },
    });
    portraitContext.drawPortrait(ctx, 'snake', speaking, 0);
    return calls;
  };
  const portraitCalls = portrait(false);
  assert.ok(portraitCalls.some(([name, x, y, w, h]) =>
    name === 'fillRect' && x === 24 && [15, 20].includes(y) && w === 4 && h === 4), 'portrait eyes are yellow');
  assert.ok(portraitCalls.some(([name, x, y, w, h]) =>
    name === 'fillRect' && x === 25 && [15, 20].includes(y) && w === 1 && h === 4), 'portrait eyes have slit pupils');
  assert.notDeepEqual(portrait(false), portrait(true));

  const calls = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get: (target, name) => name in target ? target[name] : (...args) => calls.push([name, ...args]),
    set: (target, name, value) => { target[name] = value; calls.push([name, value]); return true; },
  });
  let queries = 0;
  const segments = [0, 1, 2, 3].map(index => ({ x: 100 - index * 38, y: 200, radius: 19, angle: .4, index }));
  const enemy = { type: 'snake', x: 100, y: 200, age: 2, segments: undefined };
  const context = vm.createContext({
    ctx, game: { robots: [enemy], snakeSegments: () => { queries++; return segments; } },
    drawScaredFace() {},
  });
  const start = app.indexOf('function snakeSegmentsForDrawing(');
  vm.runInContext(app.slice(start, app.indexOf('function drawRobot(enemy', start)), context);
  context.drawSnakeRobot(enemy);
  assert.equal(queries, 1);
  assert.ok(calls.some(([name, color]) => name === 'fillStyle' && color === '#f4d447'), 'gameplay eyes are yellow');
  assert.equal(calls.filter(([name, x, y, rx, ry]) =>
    name === 'ellipse' && x === 8 && [-7, 7].includes(y) && rx === 1 && ry === 2.4).length, 2,
  'gameplay eyes have black slit pupils');
  assert.ok(calls.some(([name, x, y]) => name === 'translate' && x === 100 && y === 200));
  assert.ok(!calls.some(([name]) => name === 'fillText'), 'snake panels have no letters or words');
  assert.ok(!calls.some(([name]) => name === 'roundRect'), 'plus marking has no rectangular pad behind it');
  assert.equal(calls.filter(([name, , , rx, ry]) => name === 'ellipse' && rx === 5.5 && ry === 2.5).length, 2,
    'two thin oval buttons');
  for (const y of [-13, 10]) assert.equal(calls.filter(([name, x, py, w, h]) =>
    name === 'fillRect' && x === -7 && py === y && w === 14 && h === 3).length, 4,
  'each segment has large mirrored red stripes');
  const tongue = calls.findIndex(([name, x, y]) => name === 'moveTo' && x === 11 && y === 0);
  const headShell = calls.findIndex(([name, x, y]) => name === 'moveTo' && x === -2 && y === -15);
  assert.ok(tongue >= 0 && tongue < headShell, 'tongue renders underneath the head shell');
  assert.ok(calls.some(([name]) => name === 'lineTo'), 'forked tongue and spiked panels use stroked geometry');

  calls.length = 0;
  const snapshot = { ...enemy, age: 3, segments };
  context.game.robots = [];
  context.game.snakeSegments = () => { throw new Error('death rendering must use frozen segments'); };
  context.drawSnakeRobot(snapshot, .5);
  assert.ok(calls.some(([name, x, y]) => name === 'translate' && x !== 100 && y !== 200));
  assert.match(app, /if \(enemy\.type === 'snake'\) \{\s*ctx\.globalAlpha \*= Math\.max\(0, 1 - progress\);\s*drawRobot\(enemy, progress\);/);
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
