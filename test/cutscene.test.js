const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, CHARACTERS, SCENE_THEMES, SCENE_ACCESSORIES, SCENE_ACCESSORY_GROUPS, ITEMS, WEAPONS, Cutscene, validateCutscene, validateCustomLevel } = require('../src/game.js');
const { GUIDE, LESSONS } = require('../src/learning.js');
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
const actorKeys = actors => {
  const counts = new Map();
  return actors.map(actor => {
    const occurrence = counts.get(actor.character) ?? 0;
    counts.set(actor.character, occurrence + 1);
    return `${actor.character}:${occurrence}`;
  });
};

test('editor playtests show cutscenes before briefing and replay them even when skip is checked', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const introduction = source.slice(source.indexOf('function showLevelIntroduction('), source.indexOf('function showLevelInformation('));
  const startup = source.slice(source.indexOf('if (game && (game.level.cutscene || game.level.levelInfo)'), source.indexOf("document.body.classList.remove('game-loading')"));
  assert.ok(startup.length, 'direct editor links initialize cutscenes without requiring level information');
  const calls = [];
  const context = vm.createContext({
    game: { customLevel: true, level: level() },
    runSave: { id: 'slot-a' }, isCutsceneViewed: () => true,
    skipCutscene: { checked: true }, overlay: { hidden: false },
    cutscene: { open: (value, id) => calls.push({ kind: 'scene', value, id }) },
    showLevelInformation: () => calls.push({ kind: 'information' }),
    location: { hash: '#level=custom' },
  });
  vm.runInContext(introduction, context);
  vm.runInContext(startup, context);
  assert.equal(calls[0].kind, 'scene');
  assert.equal(calls[0].value, context.game.level.cutscene);
  assert.equal(context.overlay.hidden, true);
  context.showLevelIntroduction();
  assert.equal(calls[1].kind, 'scene', 'custom restart replays its cutscene');
  context.game.customLevel = false;
  context.showLevelIntroduction();
  assert.equal(calls[2].kind, 'information', 'campaign skip preference is preserved');
  context.skipCutscene.checked = false;
  context.location.hash = '#campaign=1-1';
  vm.runInContext(startup, context);
  assert.equal(calls[3].kind, 'scene', 'campaign editor preview plays its cutscene');
  delete context.game.level.cutscene;
  context.game.customLevel = true;
  context.showLevelIntroduction();
  assert.equal(calls[4].kind, 'information', 'levels without cutscenes retain their introduction flow');
});

test('dialogue portraits use the shared bounded square sizing instead of full-screen canvas sizing', () => {
  const html = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const css = readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  for (const id of ['cutscene-portrait', 'cat-town-portrait']) {
    assert.match(html, new RegExp(`<canvas id="${id}" class="cutscene-portrait" width="32" height="32"`));
  }
  const rule = css.match(/\.cutscene-portrait\s*\{([^}]+)\}/)[1];
  assert.match(rule, /width: clamp\(64px, 17vw, 160px\)/);
  assert.match(rule, /height: auto/);
  assert.match(rule, /aspect-ratio: 1/);
  assert.match(rule, /flex-shrink: 0/);
});

test('Official scene cropping covers the stage and preserves authored actor heights in both orientations', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
  const { OFFICIAL_LEVEL_DATA } = require('../src/campaign.js');
  const classSource = source.slice(source.indexOf('class CutscenePlayer'), source.indexOf('CutscenePlayer.drawPortrait ='));
  let backgroundTransform;
  const context = vm.createContext({
    window: { devicePixelRatio: 1 },
    drawOfficialBackground: ctx => { backgroundTransform = ctx.transform; },
    drawTom() {},
    drawPortrait() {},
  });
  vm.runInContext(`${classSource}\nglobalThis.Player = CutscenePlayer;`, context);
  for (const [width, height] of [[410, 599], [1440, 600], [844, 260], [320, 380]]) {
    for (const campaign of Object.values(OFFICIAL_LEVEL_DATA).filter(level =>
      level.cutscene && !['garden', 'workshop', 'foundry'].includes(level.cutscene.theme))) {
      const shadows = [];
      const ctx = {
        transform: [1, 0, 0, 1, 0, 0],
        setTransform(...values) { this.transform = values; },
        saved: [],
        save() { this.saved.push(this.transform.slice()); },
        restore() { this.transform = this.saved.pop(); },
        rotate() {},
        translate(x, y) { this.transform[4] += x * this.transform[0]; this.transform[5] += y * this.transform[3]; },
        scale(x, y) { this.transform[0] *= x; this.transform[3] *= y; },
        beginPath() {}, fill() {}, fillRect() {},
        ellipse(x, y) { shadows.push(this.transform[5] + y * this.transform[3]); },
      };
      const player = Object.create(context.Player.prototype);
      Object.assign(player, {
        stage: { clientWidth: width, clientHeight: height, getContext: () => ctx },
        portrait: { getContext: () => ({}) }, positions: new Map(), paused: false,
        playback: { scene: campaign.cutscene, line: campaign.cutscene.lines[0], reducedMotion: true, elapsed: 0, typing: false },
        drawCharacter() {},
      });
      player.draw();
      const groundY = backgroundTransform[3] * 390 + backgroundTransform[5];
      assert.ok(Math.abs(groundY / height - 390 / 540) < 1e-9, campaign.id);
      assert.equal(shadows.length, campaign.cutscene.lines[0].actors.length);
      for (const [index, actor] of campaign.cutscene.lines[0].actors.entries()) {
        const base = { koshi: 23, tom: 46, mouse: 19, wheel: 24, ram: 19, bucket: 21, ball: 19,
          jackolantern: 20, snake: 19, goalie: 39, 'robo-koshi': 23, 'robo-snail': 24,
          'robo-cow': 29, 'robo-unicorn': 33, boss: 40, 'tom-frog': 46 }[actor.character];
        assert.ok(base !== undefined, `Expected Official actor: ${actor.character}`);
        const scale = player.positions.get(actorKeys(campaign.cutscene.lines[0].actors)[index]).scale;
        const zoom = scale / Math.min(2.4, width / height * 1.6);
        const expectedY = (390 + (actor.y * 540 - 390) * zoom + base * scale) * height / 540;
        assert.ok(Math.abs(shadows[index] - expectedY) < 1e-9, `${campaign.id}: authored ${actor.character} position is preserved`);
        if (actor.y >= 390 / 540) {
          assert.ok(shadows[index] > groundY, `${campaign.id}: ground-positioned actor stays below the horizon`);
        }
      }
      assert.ok(backgroundTransform[3] > 0, 'the zoomed background has a positive scale');
    }
  }
});

test('Official backgrounds render distinctly and round-trip through custom levels and the editor', () => {
  const themes = ['happy-meadows', 'catnip-beach', 'fuzzy-falls', 'mouser-mesa',
    'alpine-litterbox', 'yarnball-moon', 'hairball-swamp', 'meownt-vesuvius', 'robot-hq'];
  const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
  const editor = readFileSync(path.join(__dirname, '..', 'editor.html'), 'utf8');
  const context = vm.createContext({ Math });
  vm.runInContext(source.slice(source.indexOf('function drawOfficialBackground('), source.indexOf('function drawTom(')), context);
  const drawings = themes.map(theme => {
    assert.ok(SCENE_THEMES.includes(theme));
    assert.ok(editor.includes(`value="${theme}"`));
    const custom = { ...level(), cutscene: { ...scene(), theme } };
    assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(custom))), custom);
    const operations = [];
    const ctx = new Proxy({}, {
      get(target, key) {
        if (key === 'createLinearGradient') return () => ({ addColorStop: (...args) => operations.push(['color', ...args]) });
        return (...args) => {
          for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${theme}: ${key}`);
          operations.push([key, ...args]);
        };
      },
      set(target, key, value) { operations.push([key, value]); return true; },
    });
    context.drawOfficialBackground(ctx, theme);
    assert.ok(operations.length > 20, theme);
    return JSON.stringify(operations);
  });
  assert.equal(new Set(drawings).size, themes.length);
});

test('cutscenes line up in editor array order regardless of authored x, character, or viewport', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
  const loop = source.slice(source.indexOf('    const mobile ='), source.indexOf('    drawPortrait(this.portrait'));
  const scales = [];
  const ctx = new Proxy({}, {
    get: (_, name) => (...args) => { if (name === 'scale') scales.push(args); },
  });
  const context = vm.createContext({ ctx, time: 0, drawTom() {} });
  vm.runInContext(`function drawBackground() {} function stage(line) { ${loop} }`, context);
  const { OFFICIAL_LEVEL_DATA } = require('../src/campaign.js');
  const lines = [...LEVELS, ...Object.values(OFFICIAL_LEVEL_DATA)]
    .flatMap(level => level.cutscene?.lines ?? []);
  for (let count = 1; count <= 6; count++) {
    for (const koshiIndex of [0, Math.floor(count / 2), count - 1]) {
      const actors = Array.from({ length: count }, (_, i) => ({
        character: i === koshiIndex ? 'koshi' : 'mouse', x: .25 + i * .02, y: .65,
      })).reverse();
      lines.push({ speaker: 'koshi', actors });
    }
  }
  for (const [width, height, mobile] of [
    [320, 380, true], [390, 560, true], [760, 600, true],
    [844, 260, true], [1000, 400, true], [1024, 400, false], [1440, 600, false],
  ]) {
    Object.assign(context, { width, height });
    for (const line of lines) {
      const before = JSON.stringify(line);
      for (const [reducedMotion, paused] of [[true, false], [false, false], [false, true]]) {
        if (!mobile && (!reducedMotion || paused)) continue;
        context.reducedMotion = reducedMotion;
        scales.length = 0;
        const player = {
          positions: new Map(line.actors.map((actor, i) =>
            [actorKeys(line.actors)[i], { x: 480, y: actor.y * 540 }])),
          paused, drawCharacter() {},
        };
        context.stage.call(player, line);
        const zoom = player.actorZoom.target / Math.min(2.4, width / height * 1.6);
        const ordered = line.actors.map((actor, i) => ({
          actor, position: player.positions.get(actorKeys(line.actors)[i]),
        })).sort((a, b) => a.position.x - b.position.x);
        const screenX = position => 480 + (position.x - 480) * zoom;
        const redistributed = ordered.some(({ actor, position }) => Math.abs(screenX(position) - actor.x * 960) > 1e-8);
        assert.deepEqual(ordered.map(entry => entry.actor), line.actors, 'left-to-right order matches editor cards');
        for (const { actor, position } of ordered) {
          assert.equal(position.y, actor.y * 540, 'authored height stays unchanged');
          if (!redistributed) assert.ok(Math.abs(screenX(position) - actor.x * 960) < 1e-8);
        }
        if (redistributed && ordered.length > 1) {
          for (const [i, entry] of ordered.entries()) {
            assert.ok(Math.abs(screenX(entry.position) / 960 - (.16 + .68 * i / (ordered.length - 1))) < 1e-9,
              'crowded cards occupy equally spaced screen positions');
          }
        }
        const expectedScale = Math.min(2.4, width / height * 1.6)
          * (mobile ? Math.min(1, 3 / line.actors.length) : 1);
        assert.ok(player.positions.values().next().value.scale <= expectedScale);
        assert.equal(JSON.stringify(line), before, 'rendering does not modify level content');
      }
    }
  }
});

test('crowded cutscene casts settle into distinct positions across dialogue and resize', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
  const loop = source.slice(source.indexOf('    const mobile ='), source.indexOf('    drawPortrait(this.portrait'));
  const ctx = new Proxy({}, { get: () => () => {} });
  const context = vm.createContext({ ctx, width: 1440, height: 600, time: 0, reducedMotion: false, drawTom() {} });
  vm.runInContext(`function drawBackground() {} function stage(line) { ${loop} }`, context);
  const player = { positions: new Map(), animationTime: 0, drawCharacter() {} };
  const cast = [
    { character: 'koshi', x: .28, y: .65 },
    ...['tom-frog', 'robo-fly', 'robo-fly', 'robo-crab', 'boss']
      .map(character => ({ character, x: .5, y: .65 })),
  ];
  const first = { speaker: 'tom-frog', actors: cast };
  const second = { speaker: 'koshi', actors: cast.map(actor => ({ ...actor })) };
  const before = JSON.stringify([first, second]);
  const check = () => {
    const positions = [...player.positions.values()].sort((a, b) => a.x - b.x);
    const sizes = { koshi: 25, 'tom-frog': 75, 'robo-fly': 32, 'robo-crab': 40, boss: 48 };
    for (let i = 1; i < positions.length; i++) {
      const previous = positions[i - 1], current = positions[i];
      const halfWidths = (sizes[previous.actor.character] + sizes[current.actor.character])
        * current.scale * context.height / context.width * 960 / 540;
      assert.ok(current.x - previous.x >= halfWidths + 8 - 1e-8, 'cast members have room for their artwork');
    }
    assert.ok(positions.every(position => position.x === position.target.x && position.y === .65 * 540));
  };
  context.stage.call(player, first);
  player.animationTime = 2; context.stage.call(player, first); check();
  context.stage.call(player, second);
  player.animationTime = 4; context.stage.call(player, second); check();
  context.width = 390; context.height = 560;
  context.stage.call(player, second);
  player.animationTime = 6; context.stage.call(player, second); check();
  assert.equal(JSON.stringify([first, second]), before);
});

test('cutscene zoom fits six actors and smoothly retargets over one second without advancing on redraw', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
  const loop = source.slice(source.indexOf('    const mobile ='), source.indexOf('    drawPortrait(this.portrait'));
  const ctx = new Proxy({}, { get: () => () => {} });
  const context = vm.createContext({ ctx, time: 0, reducedMotion: false, drawTom() {} });
  vm.runInContext(`function drawBackground() {} function stage(line) { ${loop} }`, context);
  const cast = ['koshi', 'tom-frog', 'boss', 'tom', 'goalie', 'robo-crab']
    .map((character, i) => ({ character, x: .1 + i * .16, y: .65 }));
  const small = { speaker: 'koshi', actors: cast.slice(0, 3) };
  const large = { speaker: 'koshi', actors: cast };
  const before = JSON.stringify([small, large]);
  for (const [width, height] of [[320, 380], [390, 560], [844, 260], [1440, 600]]) {
    Object.assign(context, { width, height, reducedMotion: false });
    const player = { positions: new Map(), animationTime: 0, drawCharacter() {} };
    const render = line => context.stage.call(player, line);
    const scale = () => player.positions.get('koshi:0').scale;
    render(small);
    const close = scale();
    render(large);
    const far = player.actorZoom.target;
    assert.ok(far < close, 'crowded casts need a wider view in both orientations');
    assert.equal(scale(), close, 'joining actors do not snap the zoom');
    render(large);
    assert.equal(scale(), close, 'redrawing without animation time leaves zoom unchanged');
    player.animationTime = .25;
    render(large);
    assert.ok(Math.abs(scale() - (close + (far - close) * .15625)) < 1e-9, 'zoom eases out of its starting scale');
    player.animationTime = .5;
    render(large);
    assert.ok(Math.abs(scale() - (close + far) / 2) < 1e-9, 'zoom is halfway complete after half a second');
    player.animationTime = .999;
    render(large);
    assert.ok(scale() > far, 'zoom is not complete before one second');
    player.animationTime = 1;
    render(large);
    assert.equal(scale(), far, 'zoom completes after exactly one second');
    player.animationTime = 3;
    render(large);
    assert.equal(player.positions.size, 6);
    const widths = { koshi: 25, 'tom-frog': 75, boss: 48, tom: 50, goalie: 42, 'robo-crab': 40 };
    const positions = [...player.positions.values()].sort((a, b) => a.x - b.x);
    for (const [i, position] of positions.entries()) {
      const halfWidth = widths[position.actor.character] * position.scale * height / width * 960 / 540;
      const screenX = 480 + (position.x - 480) * far / Math.min(2.4, width / height * 1.6);
      assert.ok(screenX - halfWidth >= 8 - 1e-9, 'artwork fits the left edge');
      assert.ok(screenX + halfWidth <= 952 + 1e-9, 'artwork fits the right edge');
      assert.equal(position.y, .65 * 540, 'zoom preserves authored heights');
      if (i) {
        const previous = positions[i - 1];
        const previousWidth = widths[previous.actor.character] * previous.scale * height / width * 960 / 540;
        assert.ok((position.x - previous.x) * far / Math.min(2.4, width / height * 1.6)
          >= halfWidth + previousWidth + 8 - 1e-9, 'six large actors do not overlap on screen');
      }
    }
    render(small);
    assert.equal(scale(), far, 'departures do not snap the zoom');
    player.animationTime = 3.5;
    render(small);
    assert.ok(Math.abs(scale() - (close + far) / 2) < 1e-9, 'departures smoothly zoom in');
    const interrupted = scale();
    render(large);
    assert.equal(scale(), interrupted, 'an interrupted zoom starts at its current scale');
    player.animationTime = 4.5;
    render(large);
    assert.equal(scale(), far);
    context.width = 760; context.height = 600;
    render(large);
    assert.equal(scale(), far, 'resizing does not snap the cast scale');
    player.animationTime = 5.5;
    render(large);
    assert.equal(scale(), player.actorZoom.target, 'resizing settles after one second');
    context.reducedMotion = true;
    render(small);
    assert.equal(scale(), player.actorZoom.target, 'reduced motion applies zoom immediately');
    assert.equal(player.positions.size, 3, 'reduced motion removes departing actors immediately');
  }
  assert.equal(JSON.stringify([small, large]), before, 'zoom never changes authored level data');
});

test('the entire background and cast share a smooth camera zoom with a fixed ground anchor', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
  const classSource = source.slice(source.indexOf('class CutscenePlayer'), source.indexOf('CutscenePlayer.drawPortrait ='));
  const context = vm.createContext({
    window: { devicePixelRatio: 2 }, drawOfficialBackground() {}, drawTom() {}, drawPortrait() {},
  });
  vm.runInContext(`${classSource}\nglobalThis.Player = CutscenePlayer;`, context);
  const actors = ['boss', 'mouse', 'koshi', 'tom-frog', 'goalie', 'robo-crab']
    .map((character, i) => ({ character, x: .8 - i * .12, y: .65 }));
  const first = { speaker: 'koshi', actors: actors.slice(0, 3) };
  const second = { speaker: 'koshi', actors };
  for (const theme of ['happy-meadows', 'garden', 'workshop', 'foundry']) {
    for (const [width, height] of [[390, 560], [844, 260], [1440, 600]]) {
      const transforms = [], actorTransforms = [], clears = [];
      const ctx = new Proxy({
        transform: [1, 0, 0, 1, 0, 0], saved: [],
        setTransform(...args) { this.transform = args; transforms.push(args.slice()); },
        save() { this.saved.push(this.transform.slice()); },
        restore() { this.transform = this.saved.pop(); },
        translate(x, y) { this.transform[4] += x * this.transform[0]; this.transform[5] += y * this.transform[3]; },
        scale(x, y) { this.transform[0] *= x; this.transform[3] *= y; },
        createLinearGradient() { return { addColorStop() {} }; },
        fillRect(...args) { if (this.transform[0] === 1 && this.transform[3] === 1) clears.push(args); },
      }, { get: (target, key) => key in target ? target[key] : () => {} });
      const player = Object.create(context.Player.prototype);
      Object.assign(player, {
        stage: { clientWidth: width, clientHeight: height, getContext: () => ctx },
        portrait: { getContext: () => ({}) }, positions: new Map(), animationTime: 0,
        playback: { scene: { theme }, line: first, reducedMotion: false, elapsed: 0, typing: false },
        drawCharacter(_, character) { actorTransforms.push({ character, transform: ctx.transform.slice() }); },
      });
      const render = (line, time) => {
        player.playback.line = line; player.animationTime = time;
        transforms.length = 0; actorTransforms.length = 0; clears.length = 0;
        player.draw();
        const zoom = player.positions.get('koshi:0').scale / Math.min(2.4, width / height * 1.6);
        const background = transforms[1], camera = transforms[2];
        const backgroundBase = Math.max(width * 2 / 960, height * 2 / 540);
        assert.ok(Math.abs(background[0] / backgroundBase - zoom) < 1e-9, 'background zoom matches the cast zoom');
        assert.ok(Math.abs(camera[0] / (width * 2 / 960) - zoom) < 1e-9, 'cast uses the same camera zoom');
        assert.ok(Math.abs(camera[3] * 390 + camera[5] - height * 2 * 390 / 540) < 1e-9,
          'the common camera pivots around the ground line');
        const koshi = actorTransforms.find(entry => entry.character === 'koshi').transform;
        assert.ok(Math.abs(Math.abs(koshi[0]) - Math.abs(koshi[3])) < 1e-9,
          'characters remain undistorted during scene zoom, including when turning to walk');
        assert.deepEqual(clears[0], [0, 0, width * 2, height * 2], 'each frame clears exposed background margins');
        return background[0];
      };
      const close = render(first, 0);
      assert.equal(render(second, 0), close, 'a new cast does not snap the background');
      const middle = render(second, .5);
      const far = render(second, 1);
      assert.ok(far < middle && middle < close, 'the background shrinks smoothly with the cast');
      assert.ok(Math.abs(middle - (close + far) / 2) < 1e-9, 'the background is halfway zoomed after half a second');
      render(second, 3);
      const lineup = actorTransforms.slice().sort((a, b) => a.transform[4] - b.transform[4]);
      assert.deepEqual(lineup.map(entry => entry.character), actors.map(actor => actor.character),
        'rendered positions match editor card order even when Koshi is in the middle');
      assert.equal(render(first, 3), far, 'removing actors does not snap the background');
      assert.equal(render(first, 4), close, 'the full scene zooms back in after one second');
    }
  }
});

test('cutscene Robo Fly draws a clear body, large dark eyes, flapping white wings and six legs', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, key) { return key in target ? target[key] : (...args) => calls.push([key, ...args]); },
    set(target, key, value) { target[key] = value; calls.push(['set', key, value]); return true; },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(source.indexOf('function drawCutsceneRoboFly('), source.indexOf('function drawCutsceneCharacter(')), context);
  context.drawCutsceneRoboFly(0);
  assert.equal(calls.filter(([name, x]) => name === 'moveTo' && Math.abs(x) === 7).length, 6);
  assert.equal(calls.filter(([name]) => name === 'ellipse').length, 4, 'two wings, body and head');
  assert.equal(calls.filter(([name, x, y, radius]) => name === 'arc' && Math.abs(x) === 7 && y === -10 && radius === 5).length, 2);
  assert.ok(calls.some(([name, property, value]) => name === 'set' && property === 'fillStyle' && value === '#f2f8f6'));
  assert.ok(calls.some(([name, property, value]) => name === 'set' && property === 'fillStyle' && value === '#303d42'));
  const first = calls.filter(([name]) => name === 'rotate').map(([, angle]) => angle);
  calls.length = 0; context.drawCutsceneRoboFly(Math.PI / 32);
  assert.notDeepEqual(calls.filter(([name]) => name === 'rotate').map(([, angle]) => angle), first);
  assert.match(source, /character === 'robo-fly'\) drawCutsceneRoboFly\(time\)/);
});

test('all campaign scenes validate and every campaign story character speaks', () => {
  const speakers = new Set();
  for (const level of LEVELS) {
    assert.deepEqual(validateCutscene(level.cutscene), level.cutscene);
    if (level.worldId !== '5') for (const line of level.cutscene.lines) speakers.add(line.speaker);
  }
  assert.deepEqual([...speakers].sort(), Object.keys(CHARACTERS).filter(character => !['striker', 'robo-fly', 'robo-trash-bin', 'robo-moon', 'robo-sharpshooter', 'robo-cat-lady', 'tom-frog'].includes(character)).sort());
  assert.ok(!speakers.has('striker'), 'custom-only enemies do not change campaign scenes');
  assert.ok(!speakers.has('tom-frog'), 'custom-only bosses do not change campaign scenes');
  assert.ok(!speakers.has('robo-fly'), 'custom-only enemies do not change campaign scenes');
  assert.ok(!speakers.has('robo-trash-bin'), 'custom-only enemies do not change campaign scenes');
  assert.ok(!speakers.has('robo-moon'), 'custom-only enemies do not change campaign scenes');
  assert.ok(!speakers.has('robo-sharpshooter'), 'custom-only enemies do not change campaign scenes');
  const beforeWorldFour = new Set(LEVELS.filter(level => !['4', '5'].includes(level.worldId))
    .flatMap(level => level.cutscene.lines.map(line => line.speaker)));
  assert.ok(!beforeWorldFour.has('robo-crab'), 'Crabs do not change earlier campaign scenes');
  assert.ok(!beforeWorldFour.has('robo-love-bug'), 'Love Bugs do not change earlier campaign scenes');
  const earlierSpeakers = new Set(LEVELS.filter(level => ['1', '2'].includes(level.worldId)).flatMap(level => level.cutscene.lines.map(line => line.speaker)));
  for (const character of ['goalie', 'robo-koshi', 'robo-snail', 'robo-cow', 'robo-unicorn']) {
    assert.ok(!earlierSpeakers.has(character), 'World 3 enemies do not change earlier campaign scenes');
  }
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
    for (const character of cast) assert.ok(character === 'tom'
      || campaign.enemies.some(([, type]) => type === character)
      || (campaign.events ?? []).some(event => event.kind === 'enemy' && event.type === character), `${campaign.id}: level-appropriate cast`);
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

test('cutscene accessories validate per actor and survive level round trips', () => {
  const withAccessories = { ...scene(), lines: [{
    speaker: 'koshi', text: 'Ready!', actors: [
      { character: 'koshi', x: .3, y: .6, accessories: ['sunglasses', 'top-hat', 'magic-wand', 'weapon:gold', 'item:battery'] },
      { character: 'mouse', x: .7, y: .6, accessories: ['magic-wand'] },
    ],
  }] };
  assert.deepEqual(validateCutscene(withAccessories), withAccessories);
  assert.deepEqual(validateCustomLevel({ ...level(), cutscene: withAccessories }).cutscene, withAccessories);
  for (const accessories of ['sunglasses', ['unknown'], ['weapon:battery'], ['item:gold'], ['magic-wand', 'magic-wand']]) {
    const invalid = structuredClone(withAccessories);
    invalid.lines[0].actors[0].accessories = accessories;
    assert.throws(() => validateCutscene(invalid), /invalid accessories/);
  }
  assert.deepEqual(validateCutscene(scene()).lines[0].actors[0], scene().lines[0].actors[0],
    'legacy actors keep their existing shape');
});

test('cutscene accessories draw for every supported type and animate the wand', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const start = source.indexOf('function drawCutsceneAccessories(');
  const end = source.indexOf('\nfunction drawCutsceneCharacter(', start);
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, name) => (...args) => calls.push([name, ...args]),
    set: (_, name, value) => { calls.push([name, value]); return true; },
  });
  const context = vm.createContext({ ctx });
  vm.runInContext(source.slice(start, end), context);
  for (const character of Object.keys(CHARACTERS)) {
    calls.length = 0;
    context.drawCutsceneAccessories(character, ['sunglasses', 'top-hat', 'magic-wand'], 1);
    assert.ok(calls.some(([name]) => name === 'roundRect'), `${character} glasses/hat draw`);
    assert.ok(calls.some(([name]) => name === 'closePath'), `${character} wand draws`);
    assert.ok(calls.flat().every(value => typeof value !== 'number' || Number.isFinite(value)), character);
  }
  const rotations = time => {
    calls.length = 0;
    context.drawCutsceneAccessories('bucket', ['magic-wand'], time);
    return calls.filter(([name]) => name === 'rotate').map(([, angle]) => angle);
  };
  assert.notDeepEqual(rotations(0), rotations(1), 'the held wand follows the bucket arm animation');
  assert.deepEqual(Object.keys(SCENE_ACCESSORY_GROUPS), ['Other', 'Weapons', 'Items']);
  assert.deepEqual(Object.keys(SCENE_ACCESSORY_GROUPS.Other), ['sunglasses', 'top-hat', 'magic-wand']);
});

test('all catalog weapons and items are validated and drawn as cutscene props', () => {
  const expected = [
    ...Object.keys(WEAPONS).map(id => `weapon:${id}`),
    ...Object.keys(ITEMS).map(id => `item:${id}`),
  ];
  assert.deepEqual(Object.keys(SCENE_ACCESSORY_GROUPS.Weapons), expected.slice(0, Object.keys(WEAPONS).length));
  assert.deepEqual(Object.keys(SCENE_ACCESSORY_GROUPS.Items), expected.slice(Object.keys(WEAPONS).length));
  assert.ok(expected.every(id => Object.hasOwn(SCENE_ACCESSORIES, id)));
  const withProps = { ...scene(), lines: [{
    speaker: 'koshi', text: 'Ready!', actors: [{ character: 'koshi', x: .3, y: .6, accessories: expected }],
  }] };
  assert.deepEqual(validateCutscene(withProps), withProps);
  assert.deepEqual(validateCustomLevel({ ...level(), cutscene: withProps }).cutscene, withProps);
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const drawn = [], positions = [];
  const context = vm.createContext({
    ctx: { save() {}, restore() {}, translate: (...args) => positions.push(args), scale() {} },
    drawWeapon: (x, y, type) => drawn.push(`weapon:${type}`),
    drawGameItem: item => drawn.push(`item:${item.type}`),
  });
  vm.runInContext(source.slice(source.indexOf('function drawCutsceneAccessories('), source.indexOf('\nfunction drawCutsceneCharacter(')), context);
  context.drawCutsceneAccessories('tom', expected, 0);
  assert.deepEqual(drawn, expected);
  assert.ok(positions.every(position => position[0] === 19 && position[1] === 0));
  for (const character of Object.keys(CHARACTERS)) {
    positions.length = 0;
    context.drawCutsceneAccessories(character, ['weapon:gold', 'item:battery'], 0);
    assert.deepEqual(positions, character === 'snake' ? [[0, -40], [0, -40]] : [[19, 0], [19, 0]], character);
  }
});

test('retained actors slide individual accessories vertically, including interrupted and reduced-motion changes', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
  const loop = source.slice(source.indexOf('    const mobile ='), source.indexOf('    drawPortrait(this.portrait'));
  for (const [width, height] of [[1440, 600], [390, 560]]) {
    let matrix = [1, 0, 0, 1, 0, 0];
    const stack = [], drawings = [];
    const ctx = new Proxy({
      save() { stack.push([...matrix]); },
      restore() { matrix = stack.pop(); },
      translate(x, y) { matrix[4] += matrix[0] * x + matrix[2] * y; matrix[5] += matrix[1] * x + matrix[3] * y; },
      scale(x, y) { matrix[0] *= x; matrix[1] *= x; matrix[2] *= y; matrix[3] *= y; },
      rotate(angle) {
        const [a, b, c, d] = matrix, cos = Math.cos(angle), sin = Math.sin(angle);
        matrix.splice(0, 4, a * cos + c * sin, b * cos + d * sin, c * cos - a * sin, d * cos - b * sin);
      },
    }, { get: (target, key) => target[key] ?? (() => {}) });
    const context = vm.createContext({ ctx, width, height, time: 0, reducedMotion: false, drawTom() {} });
    vm.runInContext(`function drawBackground() {} function stage(line) { ${loop} }`, context);
    const player = {
      positions: new Map(), animationTime: 0,
      drawCharacter(_, character, time, speaking, options) {
        drawings.push({ character, accessory: options?.accessories?.[0], x: matrix[4], y: matrix[5] });
      },
    };
    const line = accessories => ({
      speaker: 'koshi',
      actors: ['koshi', 'tom', 'snake'].map((character, i) => ({ character, x: .2 + i * .3, y: .65, accessories })),
    });
    const first = line(['sunglasses']), second = line(['top-hat', 'magic-wand', 'weapon:gold', 'item:battery']);
    const before = JSON.stringify([first, second]);
    const render = value => { drawings.length = 0; context.stage.call(player, value); };
    render(first);
    assert.ok([...player.positions.values()].every(position => position.accessoryPositions.get('sunglasses').offset === 0),
      'first-line accessories are attached immediately');
    render(second);
    for (const character of ['koshi', 'tom', 'snake']) {
      const state = player.positions.get(`${character}:0`).accessoryPositions;
      assert.equal(state.get('sunglasses').offset, 0, 'removal begins on the actor');
      assert.ok(drawings.find(draw => draw.character === character && draw.accessory === 'top-hat').y < 0);
      assert.ok(drawings.find(draw => draw.character === character && draw.accessory === 'magic-wand').y > 540);
      assert.ok(drawings.find(draw => draw.character === character && draw.accessory === 'weapon:gold').y > 540);
      assert.ok(drawings.find(draw => draw.character === character && draw.accessory === 'item:battery').y > 540);
    }
    const start = structuredClone(drawings);
    render(second);
    assert.deepEqual(drawings, start, 'redraws and paused frames do not advance accessories');
    player.animationTime = .2;
    render(second);
    const middle = structuredClone(drawings);
    for (const draw of middle.filter(draw => draw.accessory)) {
      const previous = start.find(entry => entry.character === draw.character && entry.accessory === draw.accessory);
      assert.equal(draw.x, previous.x, `${draw.character}: no sideways movement, even for the rotated snake`);
      assert.notEqual(draw.y, previous.y);
      assert.equal(draw.y > previous.y, draw.accessory === 'top-hat', 'headwear arrives from above and held props from below');
    }
    const reverse = line(['sunglasses']);
    render(reverse);
    assert.deepEqual(drawings, middle, 'reversing an accessory change starts at its current position');
    player.animationTime = .7;
    render(reverse);
    for (const position of player.positions.values()) {
      assert.deepEqual([...position.accessoryPositions.keys()], ['sunglasses']);
      assert.equal(position.accessoryPositions.get('sunglasses').offset, 0);
    }
    render(second);
    player.animationTime = 1.2;
    render(second);
    for (const position of player.positions.values()) {
      assert.deepEqual([...position.accessoryPositions.keys()], ['top-hat', 'magic-wand', 'weapon:gold', 'item:battery']);
      assert.ok([...position.accessoryPositions.values()].every(movement => movement.offset === 0));
    }
    render(reverse);
    context.reducedMotion = true;
    render(reverse);
    for (const position of player.positions.values()) {
      assert.deepEqual([...position.accessoryPositions.keys()], ['sunglasses']);
      assert.equal(position.accessoryPositions.get('sunglasses').offset, 0);
    }
    assert.equal(JSON.stringify([first, second]), before, 'animation never rewrites authored scenes');
  }
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
  assert.match(source, /if \(actor\.character === 'tom' && !accessory\) drawTom\(ctx, walking \? animationTime : time, speaking, walking\)/);
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
  const context = vm.createContext({ KoshiBrickVisuals: require('../src/brick-visuals.js') });
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

test('Robo Fly dialogue portrait has wings, large dark eyes, and speaking animation', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('function drawPortrait('), source.indexOf('class CutscenePlayer')), context);
  const draw = (character, speaking, time) => {
    const calls = [];
    const ctx = new Proxy({}, {
      get: (_, name) => (...args) => calls.push([name, ...args]),
      set: (_, name, value) => { calls.push([name, value]); return true; },
    });
    context.drawPortrait(ctx, character, speaking, time);
    return calls;
  };
  const fly = draw('robo-fly', true, 0), wheel = draw('wheel', true, 0);
  assert.notDeepEqual(fly, wheel);
  assert.equal(fly.filter(call => call[0] === 'fillRect' && [10, 18].includes(call[1]) && call[2] === 8 && call[3] === 4 && call[4] === 5).length, 2);
  assert.equal(fly.filter(call => call[0] === 'fillRect' && [2, 22].includes(call[1]) && call[2] === 9 && call[3] === 8 && call[4] === 5).length, 2);
  assert.ok(fly.some(call => call[0] === 'fillStyle' && call[1] === '#f2f8f6'));
  assert.notDeepEqual(fly, draw('robo-fly', false, 0));
  assert.notDeepEqual(fly, draw('robo-fly', true, .1), 'wings animate');
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

  test('cast changes walk actors across authored screen edges without replacing retained actors', () => {
    const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
    const loop = source.slice(source.indexOf('    const mobile ='), source.indexOf('    drawPortrait(this.portrait'));
    for (const [width, height] of [[1440, 600], [390, 560]]) {
      const drawings = [];
      const ctx = new Proxy({}, { get: (_, name) => (...args) => drawings.push([name, ...args]) });
      const context = vm.createContext({ ctx, width, height, time: .2, reducedMotion: false, drawTom() {} });
      vm.runInContext(`function drawBackground() {} function stage(line) { ${loop} }`, context);
      const player = {
        positions: new Map(), animationTime: 0, paused: false,
        drawCharacter: (_, character, time, speaking) => drawings.push(['draw', character, speaking]),
      };
      const actor = (character, x, y = .65) => ({ character, x, y });
      const first = { speaker: 'koshi', actors: [actor('mouse', .2), actor('koshi', .5), actor('wheel', .8)] };
      const second = { speaker: 'koshi', actors: [actor('koshi', .5), actor('ram', .8), actor('bucket', .2)] };
      const before = JSON.stringify([first, second]);
      const render = line => { drawings.length = 0; context.stage.call(player, line); };
      render(first);
      const koshiX = player.positions.get('koshi:0').x;
      assert.equal(player.positions.size, 3, 'initial cast is already on stage');
      render(second);
      assert.equal(player.positions.size, 5, 'departures remain visible while walking out');
      assert.equal(player.positions.get('koshi:0').x, koshiX, 'array index changes do not restart retained actors');
      assert.ok(player.positions.get('ram:0').x > 960, 'right-side actor enters from beyond the stage');
      assert.ok(player.positions.get('bucket:0').x > 960, 'enemies enter from the right of Koshi');
      assert.ok(player.positions.get('mouse:0').target.x < 0, 'left-side actors depart to the left regardless of character');
      assert.ok(player.positions.get('wheel:0').target.x > 960);
      assert.ok(drawings.some(op => op[0] === 'draw' && op[1] === 'mouse' && !op[2]),
        'departing characters no longer speak');
      const start = new Map([...player.positions].map(([key, value]) => [key, { x: value.x, y: value.y }]));
      render(second);
      for (const [key, value] of start) {
        assert.equal(player.positions.get(key).x, value.x, 'redraws do not advance movement');
      }
      player.animationTime += .1;
      render(second);
      for (const key of ['ram:0', 'bucket:0']) assert.ok(player.positions.get(key).x < start.get(key).x);
      assert.ok(player.positions.get('mouse:0').x < start.get('mouse:0').x);
      assert.ok(player.positions.get('wheel:0').x > start.get('wheel:0').x);
      for (const [key, value] of start) assert.equal(player.positions.get(key).y, value.y, 'walking preserves authored height');
      assert.ok(drawings.some(op => op[0] === 'rotate' && op[1] !== 0), 'walking has a visible gait');
      const continuing = { ...second, actors: [...second.actors].reverse() };
      const arrivalX = player.positions.get('bucket:0').x;
      render(continuing);
      assert.equal(player.positions.get('bucket:0').x, arrivalX, 'advancing during an arrival does not teleport it');
      assert.equal(player.positions.get('bucket:0').entering, true, 'arrival continues across dialogue lines');
      player.animationTime += 2;
      render(continuing);
      assert.equal(player.positions.size, 3, 'off-screen departures are removed');
      for (const position of player.positions.values()) {
        assert.equal(position.x, position.target.x, 'arrivals settle exactly at their stage positions');
        assert.equal(position.entering, false);
      }
      assert.equal(JSON.stringify([first, second]), before, 'level data stays unchanged');
      render(first);
      context.reducedMotion = true;
      render(first);
      assert.equal(player.positions.size, 3, 'enabling reduced motion removes departures immediately');
      assert.ok([...player.positions.values()].every(position => position.x === position.target.x));
      context.reducedMotion = false;
      render(first);
      assert.ok([...player.positions.values()].every(position => position.x === position.target.x),
        'disabling reduced motion does not rewind completed arrivals');
    }
  });

  test('retained actors reposition at entrance and exit speed without jumping', () => {
    const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
    const loop = source.slice(source.indexOf('    const mobile ='), source.indexOf('    drawPortrait(this.portrait'));
    for (const [width, height] of [[1440, 600], [390, 560]]) {
      const drawings = [];
      const ctx = new Proxy({}, { get: (_, name) => (...args) => drawings.push([name, ...args]) });
      const context = vm.createContext({ ctx, width, height, time: 0, reducedMotion: false, drawTom() {} });
      vm.runInContext(`function drawBackground() {} function stage(line) { ${loop} }`, context);
      const player = { positions: new Map(), animationTime: 0, paused: false, drawCharacter() {} };
      const koshi = { character: 'koshi', x: .3, y: .65 };
      const mouse = { character: 'mouse', x: .8, y: .65 };
      const first = { speaker: 'mouse', actors: [koshi, mouse] };
      const joined = { speaker: 'mouse', actors: [
        { ...koshi, x: .5, y: .9 }, mouse, { character: 'wheel', x: .1, y: .65 },
      ] };
      const before = JSON.stringify([first, joined]);
      const render = line => { drawings.length = 0; context.stage.call(player, line); };
      const point = key => {
        const { x, y } = player.positions.get(key);
        return { x, y };
      };
      const assertSpeed = (key, from) => {
        const to = point(key);
        assert.ok(Math.abs(Math.hypot(to.x - from.x, to.y - from.y) - 72) < 1e-9,
          `${key} moves at 720 stage units per second`);
      };
      render(first);
      const start = point('koshi:0');
      render(joined);
      assert.deepEqual(point('koshi:0'), start, 'joining cast does not teleport retained actors');
      const entering = point('wheel:0');
      player.animationTime += .1;
      render(joined);
      assertSpeed('koshi:0', start);
      assertSpeed('wheel:0', entering);
      assert.ok(drawings.filter(op => op[0] === 'rotate' && op[1] !== 0).length >= 2,
        'retained actors use the same walking gait as arrivals');
      player.animationTime += .1;
      render(joined);
      const interrupted = point('koshi:0');
      render(first);
      assert.deepEqual(point('koshi:0'), interrupted, 'leaving cast retargets from the current position');
      const departing = point('wheel:0');
      const departureTarget = { ...player.positions.get('wheel:0').target };
      player.animationTime += .1;
      render(first);
      assertSpeed('koshi:0', interrupted);
      if (player.positions.has('wheel:0')) assertSpeed('wheel:0', departing);
      else assert.ok(Math.hypot(departureTarget.x - departing.x, departureTarget.y - departing.y) <= 72,
        'an interrupted arrival already near the screen edge can finish departing within this frame');
      const resumed = point('koshi:0');
      render({ ...first });
      assert.deepEqual(point('koshi:0'), resumed, 'a new dialogue line does not jump an unfinished move');
      player.animationTime += .01;
      render(player.actorLine);
      const moved = point('koshi:0');
      assert.ok(Math.abs(Math.hypot(moved.x - resumed.x, moved.y - resumed.y) - 7.2) < 1e-9);
      player.animationTime += 2;
      render(player.actorLine);
      assert.deepEqual(point('koshi:0'), start, 'retained actors settle exactly into the original layout');
      assert.equal(player.positions.size, 2);
      render(joined);
      player.animationTime += 2;
      render(joined);
      const beforeResize = point('wheel:0');
      context.width = width === 390 ? 1440 : 390;
      render(joined);
      assert.deepEqual(point('wheel:0'), beforeResize, 'layout changes retarget without teleporting');
      player.animationTime += .01;
      render(joined);
      const afterResize = point('wheel:0');
      assert.ok(Math.hypot(afterResize.x - beforeResize.x, afterResize.y - beforeResize.y) <= 7.2 + 1e-9,
        'resize repositioning keeps the existing walking speed');
      context.reducedMotion = true;
      render(joined);
      assert.ok([...player.positions.values()].every(position => position.x === position.target.x
        && position.y === position.target.y), 'reduced motion makes all repositioning immediate');
      assert.equal(JSON.stringify([first, joined]), before, 'authored level content stays unchanged');
    }
  });

  test('repeated actors keep occurrence identities and can return during an unfinished exit', () => {
    const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
    const loop = source.slice(source.indexOf('    const mobile ='), source.indexOf('    drawPortrait(this.portrait'));
    const ctx = new Proxy({}, { get: () => () => {} });
    const context = vm.createContext({ ctx, width: 1440, height: 600, time: 0, reducedMotion: false, drawTom() {} });
    vm.runInContext(`function drawBackground() {} function stage(line) { ${loop} }`, context);
    const player = { positions: new Map(), animationTime: 0, paused: false, drawCharacter() {} };
    const first = { speaker: 'koshi', actors: [
      { character: 'mouse', x: .2, y: .6 }, { character: 'koshi', x: .5, y: .65 },
      { character: 'mouse', x: .8, y: .7 },
    ] };
    const second = { speaker: 'koshi', actors: [first.actors[1], first.actors[0]] };
    context.stage.call(player, first);
    context.stage.call(player, second);
    assert.equal(player.positions.get('mouse:0').leaving, false);
    assert.equal(player.positions.get('mouse:1').leaving, true);
    player.animationTime = .1;
    context.stage.call(player, second);
    const exitX = player.positions.get('mouse:1').x;
    context.stage.call(player, first);
    assert.equal(player.positions.get('mouse:1').x, exitX, 'return starts at its current exit position');
    assert.equal(player.positions.get('mouse:1').leaving, false);
    assert.equal(player.positions.size, 3, 'no duplicate or stale actors are created');
    player.animationTime = 2;
    context.stage.call(player, first);
    assert.equal(player.positions.get('mouse:1').x, first.actors[2].x * 960);
  });

test('stage shadows align with each character base and stay grounded while speakers bob', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'cutscene.js'), 'utf8');
  const loop = source.slice(source.indexOf('    const mobile ='), source.indexOf('    drawPortrait(this.portrait'));
  const operations = [];
  const ctx = new Proxy({}, { get: (_, name) => (...args) => operations.push([name, ...args]) });
  const context = vm.createContext({
    ctx, width: 390, height: 560, reducedMotion: true, time: .2,
    drawTom: () => operations.push(['draw', 'tom']),
  });
  vm.runInContext(`function drawBackground() {} function stage(line) { ${loop} }`, context);
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
  assert.match(app, /const id = GUIDE\[guideIndex\]\.practice;/);
  assert.ok(GUIDE.some(chapter => chapter.title === 'Robots & swords' && chapter.practice === 'snake'));
  assert.ok(LESSONS.some(lesson => lesson.id === 'snake'));
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
  player.update(.1);
  const animationTime = player.animationTime;
  player.paused = true;
  player.update(.1);
  assert.equal(player.animationTime, animationTime, 'hidden scenes freeze cast transitions');
  player.paused = false;
  player.update(.1);
  assert.ok(player.animationTime > animationTime, 'cast transitions resume with the scene');
  player.open(data, 1);
  assert.equal(player.animationTime, 0, 'replaying starts with a fresh animation clock');
  motion.matches = true;
  player.update(0);
  assert.equal(visibleText(), data.lines[0].text);
});

test('cutscene scrolling follows newly typed lines without skipping fully revealed text', () => {
  const elements = new Map();
  const scroll = {
    scrollTop: 50, scrollHeight: 80, clientHeight: 40, clientTop: 0,
    getBoundingClientRect: () => ({ top: 100 }),
  };
  const document = {
    hidden: false,
    createElement() {
      return {
        style: {},
        getBoundingClientRect() { return { bottom: 100 + (Math.floor(this.index / 4) + 1) * 20 - scroll.scrollTop }; },
      };
    },
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, {
        addEventListener() {}, showModal() {}, close() {}, focus() {},
        parentElement: scroll,
        replaceChildren(...children) { this.children = children; children.forEach((child, i) => { child.index = i; }); },
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
  data.lines[0].text = 'abcdefghijklmnop';
  player.open(data, 1);
  assert.equal(scroll.scrollTop, 0, 'a new message starts at the top');
  player.update(.1);
  player.update(.1);
  assert.equal(scroll.scrollTop, 0, 'visible lines do not move');
  player.update(.1);
  assert.equal(scroll.scrollTop, 20, 'scroll only enough to show the newly typed line');
  player.update(.1);
  assert.equal(scroll.scrollTop, 20, 'typing within the same line does not scroll');
  player.update(.1);
  assert.equal(scroll.scrollTop, 40);
  player.update(.1);
  scroll.scrollTop = 0;
  player.update(.1);
  assert.equal(scroll.scrollTop, 0, 'finished text can be read from the top');

  player.open(data, 1);
  player.advance();
  assert.equal(scroll.scrollTop, 0, 'Reveal text does not jump past unread text');
  scroll.scrollTop = 40;
  player.advance();
  assert.equal(scroll.scrollTop, 0, 'the next message resets its scroll position');

  motion.matches = true;
  player.open(data, 1);
  assert.equal(scroll.scrollTop, 0, 'reduced-motion messages start at the top');
  player.update(.1);
  assert.equal(scroll.scrollTop, 0);
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
