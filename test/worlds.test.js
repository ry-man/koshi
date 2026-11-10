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
const { OFFICIAL_WORLDS } = require('../src/campaign.js');
const saveApi = require('../src/saves.js');
const collectibles = require('../src/collectibles.js');

test('World Select shares the bottom action bar and styling with the level menu action', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const picker = html.slice(html.indexOf('<dialog id="level-picker"'), html.indexOf('<dialog id="save-slots"'));
  const actions = picker.slice(picker.indexOf('<div class="save-actions">'));
  assert.doesNotMatch(picker, /Click a world to move Koshi/);
  assert.doesNotMatch(picker, /Waving flags mark completed stops/);
  assert.match(actions, /id="world-map-back" class="title-secondary"[\s\S]*id="level-picker-close" class="title-secondary"/);
  assert.match(actions, /id="world-map-back"[^>]*>World Select<\/button>/);
  assert.match(actions, /id="skip-cutscene-option"[^>]*>[\s\S]*id="skip-cutscene" type="checkbox"[\s\S]*Skip cutscene/);
  assert.doesNotMatch(picker.slice(0, picker.indexOf('</header>')), /world-map-back/);
});

test('world and level maps fill every browser viewport with an opaque backdrop', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const phoneRules = css.slice(css.indexOf('@media (max-width: 760px) {'));
  assert.match(css, /\.world-picker\s*\{[^}]*width:\s*100vw;[^}]*max-width:\s*none;[^}]*height:\s*100dvh;[^}]*max-height:\s*100dvh;[^}]*margin:\s*0;[^}]*inset:\s*0;[^}]*border:\s*0;[^}]*border-radius:\s*0;/);
  assert.doesNotMatch(css, /\.world-picker:has\(.map-layout\[data-view="worlds"\]\)/);
  assert.match(css, /\.world-picker::backdrop\s*\{\s*background:\s*var\(--bg\);/);
  assert.match(css, /body:has\(.world-picker\[open\]\)\s*\{\s*overflow:\s*hidden;/);
  assert.match(phoneRules, /\.map-layout\[data-view="worlds"\]\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);/);
  assert.match(css, /\.world-picker\[open\]\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;/);
});

test('worlds partition all 75 campaign identities into themed groups of 10, 25, 14, 12 and 14', () => {
  assert.deepEqual(WORLDS.map(world => worldLevels(world).length), [10, 25, 14, 12, 14]);
  assert.deepEqual(WORLDS.map(world => world.theme), ['garden', 'workshop', 'foundry', 'foundry', 'workshop']);
  assert.deepEqual(WORLDS.flatMap(world => worldLevels(world)), LEVELS);
  assert.equal(LEVELS[9].number, '1-10');
  assert.equal(LEVELS[10].number, '2-1');
  assert.equal(LEVELS[33].number, '2-24');
  assert.equal(LEVELS[34].number, '2-25');
  assert.equal(LEVELS[35].number, '3-1');
  assert.equal(LEVELS[48].number, '3-14');
  assert.equal(LEVELS[49].number, '3S-1');
  assert.equal(LEVELS[60].number, '3S-12');
  assert.equal(LEVELS[61].number, '4-1');
  assert.equal(LEVELS.at(-1).number, '4-14');
  assert.deepEqual(LEVELS.filter(level => !level.bossLevel).map(level => level.id), Array.from({ length: 74 }, (_, i) => `1-${i + 1}`));
  for (const [i, level] of LEVELS.entries()) {
    assert.equal(nextLevelIndex(i), i === 48 ? 61 : [60, 74].includes(i) ? -1 : i + 1);
    assert.equal(level.cutscene.theme, WORLDS.find(world => world.id === level.worldId).theme);
  }
});

test('every World 1 level offers one Cat Block via a pickup, existing enemy or chest', () => {
  for (const level of LEVELS) {
    const catBlockEvents = level.items.filter(([, type]) => type === 'cat-block');
    const carriers = level.enemies.filter(event => event[4]?.carriesCatBlock);
    const chests = (level.events ?? []).filter(event => event.kind === 'item' && event.type === 'treasure-chest');
    if (level.worldId === '1') {
      assert.equal(catBlockEvents.length + carriers.length + chests.length, 1, `${level.number} has one Cat Block`);
      if (['1-3', '1-6', '1-9'].includes(level.number)) {
        assert.deepEqual(carriers, [level.enemies[0]]);
        assert.match(level.catBlock.description, /Defeat the marked enemy/);
      } else if (level.number === '1-4') {
        assert.equal(chests[0].keysRequired, 3);
        assert.match(level.catBlock.description, /3 keys/);
      } else {
        assert.equal(catBlockEvents[0][0], Math.floor(level.duration / 2));
        assert.match(level.catBlock.description, /random location/);
      }
    } else {
      assert.equal(catBlockEvents.length, 0, `${level.number} remains unchanged`);
      assert.equal(carriers.length, 0);
      assert.equal(level.catBlock, undefined);
    }
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
    assert.ok(features.every(feature => feature.name === feature.name.replace(/\b[a-z]/g, letter => letter.toUpperCase())));
    assert.ok(features.every(feature => !/\bblock\b/i.test(feature.name)));
    assert.equal(features.some(feature => feature.picture === 'item:cat-block'), false);
    for (const [, , type] of level.food) assert.ok(features.some(feature => feature.picture === `food:${type}`));
    for (const [, type] of level.enemies) assert.ok(features.some(feature => feature.picture === `enemy:${type}`));
    for (const entry of level.events ?? []) assert.ok(features.some(feature => feature.picture === `${entry.kind}:${entry.type}`));
    for (const brick of level.brickTypes) if (brick.spawner) {
      assert.ok(features.some(feature => feature.picture === `${brick.spawner.kind}:${brick.spawner.type}`));
    }
    const kinds = [...new Set(new engine.Game(() => .5, { level: LEVELS.indexOf(level) }).bricks
      .filter(brick => brick.absorbedBy == null).map(brick => brick.kind))];
    for (const kind of ['cinder', 'goal']) {
      assert.equal(features.some(feature => feature.picture === `${kind === 'goal' ? 'special' : 'brick'}:${kind}`),
        kinds.includes(kind), `${level.number}: ${kind} previews match actual blocks`);
    }
    assert.equal(features.some(feature => feature.picture === 'brick:normal'),
      kinds.some(kind => ['normal', 'slow', 'fast'].includes(kind)), `${level.number}: steering cooldowns share one preview`);
  }
  const pictures = levelFeatures(LEVELS[33]).map(feature => feature.picture);
  assert.ok(pictures.includes('special:boom-helmet'));
  assert.ok(pictures.includes('brick:conveyor'));
  assert.ok(pictures.includes('brick:warped'));
  const turrets = levelFeatures(LEVELS.find(level => level.concept === 'laser turret')).map(feature => feature.picture);
  assert.ok(turrets.includes('special:turret'));
});

function mapFixture(profile = { guest: true, completed: [], results: {} }, custom = null, game = engine, graph = worlds,
  cutsceneViewed = () => false) {
  const elements = new Map();
  const node = () => ({
    children: [], dataset: {}, style: { setProperty(name, value) { this[name] = value; } }, listeners: {}, attributes: {}, hidden: false,
    classList: {
      values: new Set(),
      add(name) { this.values.add(name); },
      remove(name) { this.values.delete(name); },
      contains(name) { return this.values.has(name); },
    },
    append(...children) {
      for (const child of children) Object.defineProperty(child, 'parentElement', { value: this, configurable: true });
      this.children.push(...children);
    },
    prepend(...children) { this.children.unshift(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name]; },
    addEventListener(name, listener) { this.listeners[name] = listener; },
    focus() {}, scrollIntoView() {},
    clientWidth: 0, clientHeight: 0, scrollLeft: 0, scrollTop: 0,
    getBoundingClientRect() {
      return { left: parseFloat(this.style.left ?? '0') * 8, top: parseFloat(this.style.top ?? '0') * 4,
        width: 800, height: 400 };
    },
    setPointerCapture() {},
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
  const motion = { matches: false, addEventListener() {} };
  const context = vm.createContext({
    document, KoshiGame: game, KoshiWorlds: graph, KoshiSaves: saveApi, KoshiCollectibles: collectibles,
    KoshiCatTown: require('../src/cat-town.js'),
    getComputedStyle: node => ({ ...node.style, transform: 'matrix(1, 0, 0, 1, -23, -73)' }), matchMedia: () => motion,
    ResizeObserver: class { observe() {} },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'world-map.js'), 'utf8'), context);
  const selection = { value: '0' };
  const pictures = [];
  const map = new context.KoshiWorldMap({
    selection, profile: () => profile,
    picture(picture, title, fillBrick) { pictures.push({ picture, title, fillBrick }); return node(); },
    custom: () => custom, cutsceneViewed,
  });
  map.map.clientWidth = 800; map.map.clientHeight = 400;
  const text = node => [node.textContent ?? '', ...node.children.map(text)].join(' ');
  return { map, selection, elements, text, motion, pictures, context };
}

test('Official and Beta level selection share map sizing, node rendering, texture, and layout settings', () => {
  const { OFFICIAL_LEVEL_DATA, assembleCampaign } = require('../src/campaign.js');
  const officialLevels = assembleCampaign(OFFICIAL_LEVEL_DATA, OFFICIAL_WORLDS);
  const officialEngine = { ...engine, LEVELS: officialLevels };
  const officialGraph = { ...worlds, WORLDS: OFFICIAL_WORLDS,
    worldLevels: world => worlds.worldLevels(world, officialLevels) };
  const beta = mapFixture();
  const official = mapFixture(undefined, null, officialEngine, officialGraph);
  for (const [fixture, world] of [[beta, WORLDS[0]], [official, OFFICIAL_WORLDS[0]]]) {
    fixture.map.open();
    fixture.map.showWorld(world);
    assert.equal(fixture.map.map.classList.contains('official-world-map'), false);
    assert.equal(fixture.map.map.dataset.view, 'levels');
    assert.equal(fixture.elements.get('#map-layout').dataset.view, 'levels');
    const first = fixture.map.map.querySelectorAll('.map-node')[0];
    assert.equal(first.className, 'map-node');
    assert.equal(first.style.left, '12%');
  }
  const officialRows = Math.ceil(officialGraph.worldLevels(OFFICIAL_WORLDS[0]).length / 4);
  assert.equal(official.map.map.style.height, `${officialRows * 100 + 50}px`);
  for (const world of OFFICIAL_WORLDS.filter(world => !world.mapOnly)) {
    official.map.showWorld(world);
    assert.equal(official.map.map.dataset.theme, 'official');
    assert.equal(official.map.map.style['--world-color'], world.color);
    assert.equal(official.map.map.classList.contains('official-world-map'), false);
  }
  official.map.open();
  assert.equal(official.map.map.classList.contains('official-world-map'), true);
  assert.equal(official.map.map.dataset.view, 'worlds');
  assert.equal(official.map.map.style.height, '900px');
  official.map.showWorld(OFFICIAL_WORLDS[0]);
  assert.equal(official.map.map.classList.contains('official-world-map'), false);
  assert.equal(official.map.map.style.height, `${officialRows * 100 + 50}px`);
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(css, /\.world-map\[data-view="levels"\] \.map-node:not\(\.map-node-boss\)\s*\{[^}]*background-image:[^}]*repeating-linear-gradient[^}]*box-shadow:/);
  assert.match(css, /\.world-map\[data-view="levels"\]\[data-theme="official"\]\s*\{[^}]*var\(--world-color\)/);
  assert.match(css, /\.world-map\[data-view="levels"\]\[data-theme="official"\] \.map-node:not\(\.map-node-boss\)\s*\{[^}]*background-color:[^}]*var\(--world-color\)[^}]*border-color: var\(--world-color\)/);
});

test('world overview fits desktop screens and supports phone panning, anchored pinch zoom, and tap selection', () => {
  const fixture = mapFixture();
  const { map, elements, motion } = fixture;
  const navigation = map.navigation, viewport = elements.get('.map-viewport');
  viewport.clientWidth = 1200; viewport.clientHeight = 700;
  map.open();
  assert.equal(navigation.scale, 1);
  assert.equal(navigation.width, 1200);
  assert.equal(navigation.contentHeight, 700);
  assert.equal(elements.get('#map-controls').hidden, false);
  motion.matches = true;
  viewport.clientWidth = 390; viewport.clientHeight = 600;
  navigation.resize(true);
  assert.equal(navigation.scale, 1);
  assert.equal(elements.get('#map-controls').hidden, false);
  assert.equal(map.layout.dataset.mapTouch, 'true');
  const event = (id, x, y) => ({ pointerId: id, button: 0, clientX: x, clientY: y, preventDefault() {} });
  const left = viewport.scrollLeft;
  navigation.pointerDown(event(1, 200, 200));
  navigation.pointerMove(event(1, 197, 200));
  assert.equal(viewport.scrollLeft, left, 'small tap movements do not pan');
  navigation.pointerMove(event(1, 160, 180));
  assert.equal(viewport.scrollLeft, left + 40);
  assert.equal(viewport.scrollTop, 20);
  navigation.pointerEnd(event(1, 160, 180));
  let suppressed = false;
  viewport.listeners.click({ preventDefault() { suppressed = true; }, stopPropagation() {} });
  assert.equal(suppressed, true, 'drag does not activate a world');
  navigation.suppressClickUntil = 0;
  suppressed = false;
  viewport.listeners.click({ preventDefault() { suppressed = true; }, stopPropagation() {} });
  assert.equal(suppressed, false, 'ordinary taps still select worlds');
  viewport.scrollLeft = 100; viewport.scrollTop = 0;
  navigation.pointerDown(event(1, 100, 200));
  navigation.pointerDown(event(2, 200, 200));
  navigation.pointerMove(event(2, 300, 200));
  assert.equal(navigation.scale, 2);
  assert.equal(viewport.scrollLeft, 300, 'pinch preserves the map point under the moving midpoint');
  navigation.pointerEnd(event(2, 300, 200));
  navigation.pointerMove(event(1, 80, 200));
  assert.equal(viewport.scrollLeft, 320, 'one remaining finger continues panning without jumping');
  navigation.pointerEnd(event(1, 80, 200));
  navigation.zoom(10);
  assert.equal(navigation.scale, 2.5);
  navigation.zoom(.01);
  assert.equal(navigation.scale, navigation.minimum);
  map.showWorld(WORLDS[0]);
  assert.equal(map.map.style.transform, '');
  assert.equal(elements.get('#map-controls').hidden, true);
});

test('touch capture transfers from map descendants without ending a pan or pinch', () => {
  const { map, elements, motion } = mapFixture();
  const navigation = map.navigation, viewport = elements.get('.map-viewport');
  motion.matches = true;
  viewport.clientWidth = 390; viewport.clientHeight = 400;
  map.open();
  const event = (id, x, y) => ({ pointerId: id, button: 0, clientX: x, clientY: y, preventDefault() {} });
  const left = viewport.scrollLeft, top = viewport.scrollTop;
  viewport.listeners.pointerdown(event(1, 200, 200));
  viewport.listeners.pointermove(event(1, 190, 190));
  viewport.listeners.lostpointercapture({ pointerId: 1, target: map.map });
  viewport.listeners.pointermove(event(1, 150, 140));
  assert.equal(navigation.pointers.size, 1);
  assert.equal(viewport.scrollLeft, left + 50);
  assert.equal(viewport.scrollTop, top + 60);

  viewport.listeners.pointerdown(event(2, 250, 140));
  viewport.listeners.lostpointercapture({ pointerId: 2, target: map.map.querySelectorAll('.map-node')[0] });
  viewport.listeners.pointermove(event(2, 300, 140));
  assert.equal(navigation.pointers.size, 2);
  assert.equal(navigation.scale, 1.5, 'pinch continues after the second touch transfers capture');
  viewport.listeners.pointerup(event(2, 300, 140));
  const pinchLeft = viewport.scrollLeft;
  viewport.listeners.pointermove(event(1, 130, 140));
  assert.equal(viewport.scrollLeft, pinchLeft + 20);
  viewport.listeners.lostpointercapture({ pointerId: 1, target: viewport });
  assert.equal(navigation.pointers.size, 0, 'losing the viewport capture still ends the gesture');
  assert.equal(navigation.gesture, null);
  viewport.listeners.pointermove(event(1, 100, 140));
  assert.equal(viewport.scrollLeft, pinchLeft + 20);

  viewport.listeners.pointerdown(event(3, 200, 200));
  viewport.listeners.pointercancel(event(3, 200, 200));
  assert.equal(navigation.pointers.size, 0, 'canceled touches still end the gesture');
});

test('Official desktop overview scales its complete square inside the available viewport', () => {
  const { OFFICIAL_LEVEL_DATA, assembleCampaign } = require('../src/campaign.js');
  const levels = assembleCampaign(OFFICIAL_LEVEL_DATA, OFFICIAL_WORLDS);
  const fixture = mapFixture(undefined, null, { ...engine, LEVELS: levels },
    { ...worlds, WORLDS: OFFICIAL_WORLDS, worldLevels: world => worlds.worldLevels(world, levels) });
  const viewport = fixture.elements.get('.map-viewport');
  viewport.clientWidth = 1200; viewport.clientHeight = 650;
  fixture.map.open();
  assert.equal(fixture.map.navigation.scale, 650 / 900);
  assert.equal(fixture.elements.get('#map-surface').style.width, '1200px');
  assert.equal(fixture.elements.get('#map-surface').style.height, '650px');
  assert.equal(viewport.scrollLeft, 0);
  assert.equal(viewport.scrollTop, 0);
});

test('desktop zoom is confined to the overview and modifier-wheel cancels browser zoom', () => {
  const { map, elements } = mapFixture();
  const viewport = elements.get('.map-viewport'), navigation = map.navigation;
  viewport.clientWidth = 1200; viewport.clientHeight = 650;
  map.open();
  assert.equal(elements.get('#map-controls').hidden, false);
  elements.get('#map-zoom-in').listeners.click();
  assert.equal(navigation.scale, 1.25);
  navigation.resize();
  assert.equal(navigation.scale, 1.25, 'resize does not reset desktop zoom');
  let prevented = false;
  const wheel = { ctrlKey: true, deltaY: -20, deltaMode: 0, clientX: 200, clientY: 200,
    preventDefault() { prevented = true; } };
  viewport.listeners.wheel(wheel);
  assert.equal(prevented, true);
  assert.ok(navigation.scale > 1.25);
  prevented = false;
  const scale = navigation.scale;
  viewport.listeners.wheel({ ...wheel, ctrlKey: false });
  assert.equal(prevented, false, 'ordinary wheel scrolling is preserved');
  assert.equal(navigation.scale, scale);
  elements.get('#map-zoom-fit').listeners.click();
  assert.equal(navigation.scale, navigation.minimum);
  map.showWorld(WORLDS[0]);
  viewport.listeners.wheel(wheel);
  assert.equal(prevented, false, 'browser gestures outside the overview are not intercepted');
  assert.equal(map.map.style.transform, '');
  assert.equal(elements.get('#map-surface').style.width, '');
  assert.equal(elements.get('#map-surface').style.height, '');
  map.open();
  assert.equal(navigation.scale, navigation.minimum, 'reopening starts fitted on desktop');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const id of ['map-zoom-in', 'map-zoom-out']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*><svg[^>]*aria-hidden="true"`));
  }
});

test('Cat Town opens four non-level locations with a circular route and a visit action', () => {
  const officialWorlds = { ...worlds, WORLDS: OFFICIAL_WORLDS };
  const { map, text } = mapFixture(undefined, null, { ...engine, LEVELS: [] }, officialWorlds);
  map.open();
  const town = map.map.querySelectorAll('.map-node').find(node => node.dataset.node === 'C');
  town.listeners.click();
  town.listeners.click();
  assert.equal(map.view, 'town');
  const locations = map.map.querySelectorAll('.map-node');
  assert.deepEqual(locations.map(node => node.dataset.node), ['mall', 'house', 'tree', 'tank']);
  assert.equal(map.map.children[0].children.length, 4, 'four routes make a closed loop');
  assert.equal(map.townLocation.id, 'mall');
  assert.equal(map.play.hidden, false);
  assert.equal(map.play.textContent, 'Visit Location');
  assert.ok(text(map.details).includes('Whiskers'));
  locations[2].listeners.click();
  assert.equal(map.townLocation.id, 'tree');
  assert.equal(map.map.querySelectorAll('.map-node').find(node => node.dataset.node === 'tree').getAttribute('aria-pressed'), 'true');
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(css, /\.map-layout:has\(\.cat-town-map\) #map-surface\s*\{[^}]*height: 100%;[^}]*min-height: 0;/);
});

test('Official map draws configured empty worlds and shows a nonplayable empty-world notice', () => {
  const { OFFICIAL_WORLDS } = require('../src/campaign.js');
  const graph = { ...worlds, WORLDS: OFFICIAL_WORLDS,
    worldLevels: world => worlds.worldLevels(world, []) };
  const { map, elements, text } = mapFixture(undefined, null, { ...engine, LEVELS: [] }, graph);
  map.open();
  const buttons = map.map.querySelectorAll('.map-node');
  assert.equal(buttons.length, 18);
  assert.equal(map.map.style.height, '900px');
  for (const world of OFFICIAL_WORLDS.filter(world => world.id !== 'C')) {
    const button = buttons.find(button => button.dataset.node === world.id);
    assert.equal(button.style.left, `${world.mapPosition.x}%`);
    assert.equal(button.style.top, `${world.mapPosition.y}%`);
    assert.equal(button.style['--world-color'], world.color);
    assert.equal(map.completed(world), false);
    button.listeners.click();
    button.listeners.click();
    assert.equal(map.play.hidden, true);
    assert.match(text(map.details), /No levels have been added/);
  }
  assert.equal(elements.get('#level-picker-play').hidden, true);
  const routes = map.map.children[0].children;
  assert.equal(routes.length, 17);
  assert.equal(routes.filter(route => route.attributes.x2 === String(OFFICIAL_WORLDS.find(world => world.id === '9').mapPosition.x)
    && route.attributes.y2 === '50').length, 1);
});

test('skip cutscene starts unchecked and defaults on after the selected scene has been viewed', () => {
  for (const [viewed, expected] of [[false, false], [true, true]]) {
    const { map, elements } = mapFixture(undefined, null, engine, worlds,
      levelId => viewed && levelId === LEVELS[0].id);
    map.open();
    map.showWorld(WORLDS[0]);
    assert.equal(elements.get('#skip-cutscene-option').hidden, false);
    assert.equal(elements.get('#skip-cutscene').checked, expected);
    assert.equal(elements.get('#level-picker-close').hidden, true);
  }
});

test('Back to menu appears only in world overview, even for levels without cutscenes and Cat Town', () => {
  const { map, elements } = mapFixture();
  map.open();
  assert.equal(elements.get('#level-picker-close').hidden, false);
  map.showWorld(WORLDS[0]);
  map.setCutsceneOption({ id: 'no-scene' });
  assert.equal(elements.get('#level-picker-close').hidden, true);
  map.open();
  assert.equal(elements.get('#level-picker-close').hidden, false);
  map.showCatTown(OFFICIAL_WORLDS.find(world => world.id === 'C'));
  assert.equal(elements.get('#level-picker-close').hidden, true);
});

test('Escape from level selection returns to worlds before it can close the picker', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  let opened = 0, closed = 0, title = 0, focused = 0;
  const context = {
    worldMap: { layout: { dataset: { view: 'levels' } }, map: { querySelector: () => ({ focus() { focused++; } }) },
      open() { opened++; this.layout.dataset.view = 'worlds'; } },
    levelSelect: { value: 'new' }, levelBeforePicker: 'old',
    levelPicker: { close() { closed++; } }, titleScreen: { showModal() { title++; } },
    document: { querySelector: () => ({ focus() { focused++; } }) },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function closeLevelPicker('), source.indexOf("document.querySelector('#level-picker-close').addEventListener(")), context);
  context.closeLevelPicker();
  assert.equal(opened, 1);
  assert.equal(closed, 0);
  assert.equal(title, 0);
  assert.equal(context.levelSelect.value, 'new');
  context.closeLevelPicker();
  assert.equal(closed, 1);
  assert.equal(title, 1);
  assert.equal(context.levelSelect.value, 'old');
});

test('world overview hides the text panel and shows aggregate completion icons on centered nodes', () => {
  const { map, elements } = mapFixture();
  map.open();
  assert.equal(map.details.hidden, true);
  assert.equal(elements.get('#map-layout').dataset.view, 'worlds');
  const nodes = map.map.querySelectorAll('.map-node');
  const hasIcon = (node, prefix) => node.children.some(child => typeof child.className === 'string'
    && child.className.startsWith(prefix));
  assert.ok(nodes.every(node => hasIcon(node, 'completion-flag')));
  assert.ok(nodes.every(node => hasIcon(node, 'map-node-star')));
  assert.ok(nodes.every(node => hasIcon(node, 'map-node-cat-block')));
  assert.ok(nodes.every(node => !node.children.some(child => typeof child.className === 'string'
    && (child.className.includes('earned') || child.className.includes('found')))));
  assert.equal(nodes.find(node => node.dataset.node === '2').children
    .find(child => typeof child.className === 'string' && child.className.startsWith('map-node-cat-block')).title,
  '0 of 0 Cat Blocks found');

  const levels = worldLevels(WORLDS[0]);
  const completeProfile = {
    guest: false,
    completed: levels.map(level => level.id),
    results: Object.fromEntries(levels.map((level, index) => [`win-${index}`, {
      levelId: level.id, outcome: 'won', damageFree: true,
    }])),
    catBlocks: levels.filter(level => level.catBlock).map(level => level.id),
  };
  const completedMap = mapFixture(completeProfile).map;
  completedMap.open();
  const garden = completedMap.map.querySelectorAll('.map-node').find(node => node.dataset.node === '1');
  assert.ok(garden.children.some(child => child.className === 'completion-flag completion-flag-earned'));
  assert.ok(garden.children.some(child => child.className === 'map-node-star map-node-star-earned'));
  assert.ok(garden.children.some(child => child.className === 'map-node-cat-block map-node-cat-block-found'));
  assert.match(garden.getAttribute('aria-label'), /all levels completed, 10 of 10 gold stars earned, 10 of 10 Cat Blocks found/);

  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(styles, /\.map-layout\[data-view="worlds"\] \{[^}]*justify-items: center;/);
  assert.match(styles, /\.map-layout\[data-view="worlds"\] \.map-viewport \{ width: 100%; scrollbar-gutter: auto; \}/);
});

test('two-tier map selects worlds separately, moves Koshi, and reveals only that world and its complete level details', () => {
  const fixture = mapFixture();
  const { map, selection, text, pictures } = fixture;
  map.open();
  assert.equal(map.map.querySelectorAll('.map-node').length, 5, 'four main worlds and the World 3S branch');
  assert.equal(map.map.children[0].children.length, 4, 'main path and the World 3S branch are drawn');
  map.selectWorld(WORLDS[1]);
  assert.equal(selection.value, '0', 'world selection alone does not commit a level');
  assert.equal(map.map.querySelector('.map-koshi').style.left, `${15 + 70 / 3}%`);
  assert.equal(map.play.hidden, true);
  map.showWorld(WORLDS[1]);
  assert.equal(map.map.querySelectorAll('.map-node').length, 25);
  assert.equal(selection.value, '10');
  map.selectLevel(LEVELS[33]);
  assert.equal(selection.value, '33');
  const details = text(map.details);
  for (const value of ['2-24', 'The final countdown feast', '35', '🕒 100s', 'Moves to beat',
    '6 activations', 'Best (fastest) win', 'Fewest moves', 'Most food points', 'Most enemy points', 'Wins / losses / quits',
    'Win percentage', 'Level Features', 'Bricks', 'Enemies', 'Food', 'Items / Objects']) assert.ok(details.includes(value), value);
  assert.ok(!details.includes('Time to beat'));
  assert.ok(!details.includes('Guest statistics'));
  assert.ok(!details.includes('Quitting does not count'));
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(styles, /\.map-objectives \{[^}]*flex-wrap: nowrap;/);
  assert.match(styles, /\.map-details dt, \.map-details dd \{ white-space: nowrap; \}/);
  assert.match(styles, /\.map-features \{ display: grid; grid-template-columns: repeat\(auto-fill, minmax\(64px, 1fr\)\);/);
  assert.match(styles, /\.map-feature \{[^}]*width: min\(72px, 100%\);/);
  const featureSection = map.details.children.at(-1);
  assert.equal(featureSection.className, 'map-feature-section');
  assert.ok(pictures.some(picture => picture.picture.startsWith('brick:') && picture.fillBrick));
  assert.ok(pictures.some(picture => picture.picture.startsWith('food:') && !picture.fillBrick));
  assert.deepEqual(featureSection.children[1].children.map(group => group.className), [
    'map-feature-group map-feature-bricks', 'map-feature-group map-feature-enemies',
    'map-feature-group map-feature-food', 'map-feature-group map-feature-items',
  ]);
  assert.equal(map.map.querySelector('.map-koshi').style.left, '12%');
  assert.equal(map.play.hidden, false);
  assert.doesNotMatch(styles, /\.map-feature-bricks \.map-feature(?:s)? \{/);
  assert.match(styles, /\.map-feature \.guide-picture, \.map-feature \.guide-special-brick \{ width: 64px; height: 36px;/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /id="level-picker-play"[^>]*>Play Level<\/button>/);
  fixture.elements.get('#world-map-back').listeners.click();
  map.map.querySelector('[aria-pressed="true"]').listeners.click();
  assert.equal(map.map.querySelectorAll('.map-node').length, 25);
  assert.equal(selection.value, '33', 'back/zoom retains selected level');
});

test('level features merge cooldown colors and slime colors into functional categories', () => {
  const features = levelFeatures({ brickTypes: [
    { kind: 'normal' }, { kind: 'slow' }, { kind: 'fast' },
    { kind: 'normal', slimed: true, slimeColor: 'red' },
    { kind: 'normal', slimed: true, slimeColor: 'blue' },
  ] });
  assert.deepEqual(features.filter(feature => feature.picture.startsWith('brick:')).map(feature => feature.picture),
    ['brick:normal']);
  assert.equal(features.find(feature => feature.picture === 'brick:normal').name, 'Steering Brick');
  assert.deepEqual(features.filter(feature => feature.picture.startsWith('slime:')),
    [{ picture: 'slime:green', name: 'Slime' }]);
});

test('map brick preview fills its picture and omits Crumbler and Warped counters', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const picture = app.slice(app.indexOf('function guidePicture('), app.indexOf('\nfunction showGuideChapter('));
  assert.match(picture, /fillBrick\s*\?[\s\S]*?x: 0, y: 0, w: 160, h: 80/);
  assert.match(picture, /const brickColor = type === 'spikes' \? '#59656a' : colors\[type\] \?\? colors\.normal;/);
  assert.match(picture, /if \(fillBrick\) \{\s*ctx\.fillStyle = brickColor;\s*ctx\.fillRect\(0, 0, 160, 80\);/);
  assert.match(picture, /for \(const x of \[40, 120\]\)/);
  assert.match(picture, /ctx\.lineWidth = 2\.8/);
  assert.match(picture, /surface\(conveyor\.belt, null, '#303840', 12\)/);
  assert.match(picture, /surface\(conveyor\.teeth, '#adb4ba', '#303840', 2\)/);
  assert.match(picture, /brickSpring\(\[brick\], 600, 960, 0, 1\.8\)/);
  assert.match(picture, /if \(!fillBrick && \(crumbler \|\| warped\)\)/);
  const visuals = fs.readFileSync(path.join(__dirname, '..', 'src', 'brick-visuals.js'), 'utf8');
  assert.match(visuals, /fill: '#1b2623'/);
});

test('details show saved outcome statistics, no fabricated legacy bests, and helmet limits only where applicable', () => {
  const result = { levelId: LEVELS[0].id, outcome: 'won', time: 12.25, food: 22, enemy: 3, moves: 7 };
  const { map, text } = mapFixture({
    completed: [LEVELS[0].id, LEVELS[1].id],
    results: { first: result, second: { ...result, outcome: 'lost', food: 25, enemy: 5 },
      third: { ...result, outcome: 'quit' } },
  });
  map.open(); map.showWorld(WORLDS[0]); map.selectLevel(LEVELS[0]);
  let details = text(map.details);
  for (const value of ['12.25 seconds', '25', '5', '1 / 1 / 1', '33.3%']) assert.ok(details.includes(value), value);
  assert.ok(!details.includes('Damage-free gold star'));
  assert.equal(map.details.children[0].children[1].children[0].children[0].getAttribute('fill'), 'none');
  assert.equal(map.details.children[0].children[1].getAttribute('aria-label'), 'Gold star not earned: complete without taking damage');
  assert.doesNotMatch(details, /Win \/ loss percentages|50\.0% \/ /);
  assert.doesNotMatch(details, /Every started attempt|wins divided by all attempts/);
  assert.match(details, /Fewest moves\s+7\b/);
  assert.ok(!details.includes('Moves to beat'));
  map.selectLevel(LEVELS[1]); details = text(map.details);
  assert.ok(details.includes('0 / 0 / 0'));
  assert.match(details, /Win percentage\s+N\/A/);
  assert.ok(details.includes('Not recorded'));

  const earned = mapFixture({
    completed: [LEVELS[0].id],
    results: { first: { ...result, damageFree: true } },
  });
  earned.map.open(); earned.map.showWorld(WORLDS[0]); earned.map.selectLevel(LEVELS[0]);
  assert.equal(earned.map.details.children[0].children[1].children[0].children[0].getAttribute('fill'), 'currentColor');
  assert.equal(earned.map.details.children[0].children[1].className, 'map-star map-star-earned');
  assert.doesNotMatch(earned.text(earned.map.details), /Damage-free gold star/);
});

test('gold stars use matching outlined and filled shapes at the bottom-left of every level node', () => {
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
  const earnedStar = earned.children.find(child => child.className === 'map-node-star map-node-star-earned');
  const unearnedStar = unearned.children.find(child => child.className === 'map-node-star');
  assert.equal(earnedStar.children[0].children[0].getAttribute('fill'), 'currentColor');
  assert.equal(earnedStar.getAttribute('aria-hidden'), 'true');
  assert.match(earned.getAttribute('aria-label'), /gold star earned/);
  assert.equal(unearnedStar.children[0].children[0].getAttribute('fill'), 'none');
  assert.equal(unearnedStar.children[0].children[0].getAttribute('d'), earnedStar.children[0].children[0].getAttribute('d'));
  assert.equal(unearnedStar.children[0].getAttribute('viewBox'), earnedStar.children[0].getAttribute('viewBox'));
  assert.doesNotMatch(unearned.getAttribute('aria-label'), /gold star earned/);
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(styles, /\.map-node-star \{[^}]*left: -8px; bottom: -8px;/);
});

test('Cat Block hints are available beside the star on touch and hover, and the map node marks its discovery', () => {
  const levels = [...LEVELS];
  levels[0] = { ...levels[0], catBlock: { description: 'Find the hidden Cat Block.',
    trigger: { type: 'spawn' } } };
  const graph = { ...worlds, worldLevels: world => worlds.worldLevels(world, levels) };
  const profile = { guest: false, completed: [], catBlocks: [levels[0].id], results: {} };
  const { map, text } = mapFixture(profile, null, { ...engine, LEVELS: levels }, graph);
  map.open();
  map.showWorld(WORLDS[0]);
  const node = map.map.querySelectorAll('.map-node').find(candidate => candidate.dataset.node === levels[0].id);
  assert.ok(node.children.some(child => child.className?.startsWith('map-node-cat-block')));
  assert.match(node.getAttribute('aria-label'), /Cat Block available, found/);
  map.selectLevel(levels[0]);
  const button = map.details.children[0].children[2];
  const information = button;
  const description = map.details.children[0].children[3];
  assert.equal(button.title, 'To earn Cat Brick: Find during gameplay when it spawns.');
  assert.equal(button.type, 'button');
  assert.equal(map.details.children[0].children.length, 5, 'hints overlay the heading without separate information icons');
  assert.equal(information.getAttribute('aria-expanded'), 'false');
  assert.equal(information.getAttribute('aria-controls'), description.id);
  assert.match(information.getAttribute('aria-label'), /Cat Block found/);
  assert.equal(button.children[0].children[0].getAttribute('href'), './icons/cat-building-block.png');
  assert.equal(button.children[0].children[0].getAttribute('filter'), undefined);
  information.listeners.mouseenter();
  assert.equal(description.hidden, false);
  information.listeners.mouseleave();
  assert.equal(description.hidden, true);
  information.listeners.focus();
  assert.equal(description.hidden, false);
  information.listeners.blur();
  assert.equal(description.hidden, true);
  information.listeners.click();
  information.listeners.mouseleave();
  assert.equal(description.hidden, false);
  assert.equal(information.getAttribute('aria-expanded'), 'true');
  assert.equal(description.textContent, button.title, 'map uses the exact acquisition text without a suffix');
  information.listeners.click();
  assert.equal(description.hidden, true);
  const star = map.details.children[0].children[1];
  const starDescription = map.details.children[0].children[4];
  assert.equal(star.type, 'button');
  assert.equal(star.getAttribute('aria-controls'), starDescription.id);
  assert.match(text(starDescription), /completing this level without taking any damage/);
  for (const [action, visible] of [
    ['mouseenter', true], ['mouseleave', false], ['focus', true], ['blur', false],
    ['click', true], ['mouseleave', true], ['click', false],
  ]) {
    star.listeners[action]();
    assert.equal(starDescription.hidden, !visible);
    assert.equal(star.getAttribute('aria-expanded'), String(visible));
  }
  star.listeners.click();
  information.listeners.mouseenter();
  assert.equal(starDescription.hidden, true, 'opening another hint dismisses the previous popup');
  assert.equal(description.hidden, false);
  star.listeners.click();
  star.listeners.keydown({ key: 'Escape' });
  assert.equal(starDescription.hidden, true);
  const objectiveButton = map.details.children[1].children[0].children[0];
  const objectiveDescription = map.details.children[1].children[1];
  star.listeners.click();
  objectiveButton.listeners.click();
  assert.equal(starDescription.hidden, true);
  assert.equal(objectiveDescription.hidden, false);
  information.listeners.focus();
  assert.equal(objectiveDescription.hidden, true);
  map.details.scrollTop = 100;
  map.selectLevel(levels[1]);
  assert.equal(map.details.scrollTop, 0);
});

test('collectible hints float above content and map dialogs override browser width constraints', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(css, /\.map-collectible-description \{[^}]*position: absolute;[^}]*z-index: 5;/);
  assert.match(css, /\.map-level-heading \{[^}]*position: relative;/);
  assert.match(css, /\.world-picker \{[^}]*width: 100vw;[^}]*max-width: none;[^}]*inset: 0;/);
});

test('map Cat Brick hints match generated editor and briefing text for every trigger', () => {
  for (const [type, definition] of Object.entries(engine.CAT_BLOCK_TRIGGERS)) {
    const trigger = { type, ...(definition.amount ? { amount: 7 } : {}),
      ...(definition.enemy ? { enemyType: 'mouse' } : {}),
      ...(definition.brick ? { brickType: 'slow' } : {}) };
    const description = engine.catBlockDescription(trigger);
    const level = { ...LEVELS[0], catBlock: { trigger, description: 'Old hint that must not be displayed.' } };
    const { map } = mapFixture();
    map.open();
    map.showWorld(WORLDS[0]);
    map.selectLevel(level);
    const heading = map.details.children[0];
    assert.equal(heading.children[2].title, description);
    assert.equal(heading.children[3].textContent, description);
    assert.equal(heading.children[2].getAttribute('aria-describedby'), heading.children[3].id);
  }
});

test('campaign Cat Brick hints use editor wording without changing campaign reward data', () => {
  const { map } = mapFixture();
  map.open();
  map.showWorld(WORLDS[0]);
  for (const level of LEVELS.filter(level => level.catBlock)) {
    const original = JSON.stringify(level);
    const type = level.enemies.some(event => event[4]?.carriesCatBlock) ? 'carrier'
      : (level.events ?? []).some(event => event.type === 'treasure-chest') ? 'chest' : 'spawn';
    const expected = engine.catBlockDescription({ type });
    assert.equal(engine.catBlockObjective(level), expected);
    map.selectLevel(level);
    assert.equal(map.details.children[0].children[3].textContent, expected);
    assert.equal(JSON.stringify(level), original);
  }
});

test('uncollected Cat Blocks outline the artwork silhouette in nodes and hints, never feature previews', () => {
  const { map } = mapFixture();
  map.open();
  map.showWorld(WORLDS[0]);
  const node = map.map.querySelectorAll('.map-node')[0];
  const icons = [
    node.children.find(child => child.className === 'map-node-cat-block').children[0],
    map.details.children[0].children[2].children[0],
  ];
  for (const icon of icons) {
    assert.equal(icon.getAttribute('viewBox'), '0 0 100 100');
    assert.equal(icon.children[1].getAttribute('href'), './icons/cat-building-block.png');
    assert.match(icon.children[1].getAttribute('filter'), /^url\(#cat-block-outline-/);
  }
  assert.notEqual(icons[0].children[1].getAttribute('filter'), icons[1].children[1].getAttribute('filter'));
  const featureSection = map.details.children.at(-1);
  assert.equal(JSON.stringify(featureSection).includes('cat-building-block.png'), false);
});

test('Cat Blocks are omitted from feature metadata, schedules, placed events and brick spawners', () => {
  const features = levelFeatures({
    catBlock: { description: 'Find it.' },
    items: [[1, 'cat-block'], [2, 'key']],
    events: [{ kind: 'item', type: 'cat-block' }, { kind: 'item', type: 'treasure-chest' }],
    brickTypes: [{ kind: 'normal', spawner: { kind: 'item', type: 'cat-block' } }],
  });
  assert.equal(features.some(feature => feature.picture === 'item:cat-block'), false);
  assert.ok(features.some(feature => feature.picture === 'item:key'));
  assert.ok(features.some(feature => feature.picture === 'item:treasure-chest'));
});
test('campaign collectible totals stay in the header on world and level maps', () => {
  const { map, text } = mapFixture({
    completed: [], catBlocks: [LEVELS[0].id],
    results: {
      clean: { levelId: LEVELS[0].id, outcome: 'won', damageFree: true },
      repeat: { levelId: LEVELS[0].id, outcome: 'won', damageFree: true },
    },
  });

  test('map header places collection totals beside its title without a game selector', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const header = html.slice(html.indexOf('<dialog id="level-picker"'), html.indexOf('<div id="map-layout"'));
    assert.match(header, /<h2 id="level-picker-heading">World Map<\/h2>/);
    assert.match(header, /id="level-picker-heading"[\s\S]*id="map-collection-totals"[\s\S]*<\/header>/);
    assert.doesNotMatch(header, /data-campaign-select/);
    const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
    assert.match(css, /#map-collection-totals\s*\{[^}]*justify-self:\s*end;/);
    assert.match(css, /#map-collection-totals\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;/);
    assert.doesNotMatch(css, /\.world-map\s*>\s*\.collectible-totals/);
  });
  map.open();
  const totals = map.totals.children[0];
  assert.equal(map.heading.textContent, 'World Map');
  assert.equal(map.map.children.some(child => child.className === 'collectible-totals'), false);
  assert.deepEqual(Array.from(totals.children, child => child.getAttribute('aria-label')),
    ['Flags: 0 of 75', 'Gold stars: 1 of 75', 'Cat Blocks: 1 of 10']);
  assert.equal(text(totals).trim().replace(/\s+/g, ' '), '0/75 ★ 1/75 1/10');
  map.showWorld(WORLDS[0]);
  assert.equal(map.totals.children[0], totals);
  assert.equal(map.map.children.some(child => child.className === 'collectible-totals'), false);
});

test('Official world emblems are distinct pixel silhouettes and S worlds match their primary world', () => {
  const { OFFICIAL_WORLDS } = require('../src/campaign.js');
  const graph = { ...worlds, WORLDS: OFFICIAL_WORLDS,
    worldLevels: world => worlds.worldLevels(world, []) };
  const { map } = mapFixture(undefined, null, { ...engine, LEVELS: [] }, graph);
  map.open();
  const nodes = map.map.querySelectorAll('.map-node');
  const icon = id => nodes.find(node => node.dataset.node === id).children[0];
  const path = id => icon(id).children[0].getAttribute('d');
  const primaryIds = ['C', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  assert.equal(new Set(primaryIds.map(path)).size, 10);
  for (let index = 1; index <= 8; index++) {
    assert.equal(path(`S${index}`), path(String(index)));
  }
  assert.equal(map.totals.children[0].children.length, 3);
  assert.equal(map.map.children.some(child => child.className === 'collectible-totals'), false);
});

test('map objectives provide accessible popovers for every target and survival or boss time', () => {
  const { map, text } = mapFixture();
  for (const [level, labels, display] of [
    [{ goal: 20 }, ['Achieve win objective(s) in 60 seconds', 'Get 20 food points'], '🕒 60s 🍗 20'],
    [{ killGoal: 12 }, ['Achieve win objective(s) in 60 seconds', 'Get 12 enemy points'], '🕒 60s 👾 12'],
    [{ goalsGoal: 3 }, ['Achieve win objective(s) in 60 seconds', 'Get 3 soccer goals'], '🕒 60s ⚽ 3'],
    [{ goal: 5, killGoal: 2, goalsGoal: 1 }, ['Achieve win objective(s) in 60 seconds', 'Get 5 food points', 'Get 2 enemy points', 'Get 1 soccer goals'], '🕒 60s 🍗 5 👾 2 ⚽ 1'],
    [{ survive: true }, ['Survive for 60 seconds'], '🕒 60s'],
    [{ bossLevel: true }, ['No time limit', 'Defeat the boss'], '🕒 ∞ 👾 BOSS'],
  ]) {
    const objective = map.objectives({ duration: 60, goal: 0, killGoal: 0, goalsGoal: 0, ...level });
    assert.equal(objective.getAttribute('aria-label'), 'Time limit and win objectives');
    const badges = objective.children[0].children;
    assert.deepEqual(Array.from(badges, badge => badge.getAttribute('aria-label')), labels);
    assert.equal(text(objective.children[0]).trim().replace(/\s+/g, ' '), display);
    badges.forEach((badge, index) => {
      const description = objective.children[index + 1];
      assert.equal(badge.type, 'button');
      assert.equal(badge.children[0].getAttribute('aria-hidden'), 'true');
      assert.equal(badge.getAttribute('aria-controls'), description.id);
      assert.equal(description.textContent, labels[index]);
      badge.listeners.click();
      assert.equal(description.hidden, false);
      badge.listeners.keydown({ key: 'Escape' });
      assert.equal(description.hidden, true);
    });
  }
});

test('information bubbles anchor to their item and stay within their containing frame', () => {
  const { context } = mapFixture();
  const parent = {
    clientWidth: 600, clientLeft: 1, clientTop: 1, scrollLeft: 0, scrollTop: 0,
    getBoundingClientRect: () => ({ left: 100, top: 200 }),
  };
  const description = { offsetParent: parent, style: {},
    getBoundingClientRect: () => ({ width: 200 }) };
  const button = { getBoundingClientRect: () => ({ left: 120, width: 44, bottom: 244 }) };
  context.KoshiWorldMap.positionHint(button, description);
  assert.equal(description.style.left, '0px', 'leftmost icon is not right-aligned to the frame');
  assert.equal(description.style.top, '49px', 'bubble is six pixels below its icon');
  button.getBoundingClientRect = () => ({ left: 390, width: 44, bottom: 244 });
  context.KoshiWorldMap.positionHint(button, description);
  assert.equal(description.style.left, '211px', 'middle icon centers its bubble');
  button.getBoundingClientRect = () => ({ left: 680, width: 44, bottom: 244 });
  context.KoshiWorldMap.positionHint(button, description);
  assert.equal(description.style.left, '400px', 'rightmost icon is clamped within the frame');
  parent.scrollTop = 50;
  context.KoshiWorldMap.positionHint(button, description);
  assert.equal(description.style.top, '99px', 'coordinates account for scrolling');
});

test('boss levels render a skull stop with an accessible boss label', () => {
  const { map } = mapFixture();
  map.open(); map.showWorld(WORLDS[1]);
  const nodes = map.map.querySelectorAll('.map-node');
  const boss = nodes.find(node => node.dataset.node === LEVELS.find(level => level.bossLevel).id);
  assert.match(boss.getAttribute('aria-label'), /boss level/);
  const skull = boss.children.find(child => child.attributes?.viewBox === '0 0 80 76');
  assert.ok(skull);
  assert.equal(skull.children.length, 3, 'skull has an outline, eyes and nose');
  assert.ok(nodes.filter(node => node !== boss).every(node =>
    !node.children.some(child => child.attributes?.viewBox === '0 0 80 76')));
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
    { ...WORLDS[0], next: ['2', 'S2'] }, { ...WORLDS[1], next: [] },
    { id: 'S2', name: 'Extra challenge', theme: 'workshop', special: true, next: ['2'] },
  ];
  const levels = [...LEVELS.filter(level => ['1', '2'].includes(level.worldId)), { ...LEVELS[0], id: 'special-first', worldId: 'S2', number: 'S2-1' }];
  const { map, selection, text } = mapFixture(undefined, null, { ...engine, LEVELS: levels }, {
    ...worlds, WORLDS: graph, worldLevels: world => worldLevels(world, levels),
  });
  map.open();
  assert.equal(map.map.querySelectorAll('.map-node').length, 3);
  assert.equal(map.map.children[0].children.length, 3, 'main path, branch, and rejoin are all drawn');
  map.selectWorld(graph[2]);
  assert.equal(map.details.hidden, true);
  assert.equal(map.details.children.length, 0);
  map.showWorld(graph[2]);
  assert.equal(map.map.querySelectorAll('.map-node').length, 1);
  assert.equal(selection.value, '35');
  assert.ok(text(map.details).includes('S2-1'));
});

test('Koshi follows intermediate level stops forward and backward, and reduced motion skips movement', () => {
  const { map, motion } = mapFixture();
  map.open(); map.showWorld(WORLDS[0]);
  map.selectLevel(LEVELS[5]);
  const koshi = map.map.querySelector('.map-koshi');
  assert.equal(koshi.animation.frames.length, 6);
  assert.match(koshi.animation.frames[4].transform, /^translate\(200px, 0px\)/, 'the turn follows the path rather than crossing the map');
  assert.match(koshi.animation.frames[5].transform, /^translate\(0px, 0px\)/);
  assert.ok(koshi.animation.frames.every(frame => Object.keys(frame).join() === 'transform'));
  assert.ok(koshi.animation.options.duration <= 1500);
  map.selectLevel(LEVELS[0]);
  assert.equal(koshi.animation.frames.length, 6);
  assert.match(koshi.animation.frames[1].transform, /^translate\(600px,/);
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

test('marker transforms start at the visible interrupted position and end without retaining the previous offset', () => {
  const { map, motion } = mapFixture();
  map.open(); map.showWorld(WORLDS[0]);
  const marker = map.map.querySelector('.map-koshi');
  let moving = true, cancelled = false;
  marker.getBoundingClientRect = () => ({
    left: moving ? 160 : parseFloat(marker.style.left) * 8,
    top: parseFloat(marker.style.top) * 4,
  });
  marker.getAnimations = () => [{ cancel() { moving = false; cancelled = true; } }];
  map.selectLevel(LEVELS[1]);
  assert.equal(cancelled, true);
  assert.equal(marker.animation.frames[0].transform, 'translate(-136px, 0px) matrix(1, 0, 0, 1, -23, -73)');
  assert.equal(marker.animation.frames.at(-1).transform, 'translate(0px, 0px) matrix(1, 0, 0, 1, -23, -73)');
  map.open();
  const worldMarker = map.map.querySelector('.map-koshi');
  map.selectWorld(WORLDS[1]);
  assert.equal(worldMarker.animation.options.duration, 350);
  assert.equal(worldMarker.animation.options.easing, 'ease');
  assert.ok(worldMarker.animation.frames.every(frame => Object.keys(frame).join() === 'transform'));
  motion.matches = true;
  worldMarker.animation = null;
  map.selectWorld(WORLDS[2]);
  assert.equal(worldMarker.animation, null);
});

test('victory map moves from the completed stop to the next, including world boundaries and final victory', () => {
  const { map, selection } = mapFixture({ completed: LEVELS.map(level => level.id), results: {} });
  map.open(); map.advanceFrom(0);
  assert.equal(map.view, 'levels');
  assert.equal(selection.value, '1');
  let marker = map.map.querySelector('.map-koshi');
  assert.match(marker.animation.frames[0].transform, /^translate\(-200px, 0px\)/);
  assert.match(marker.animation.frames[1].transform, /^translate\(0px, 0px\)/);
  assert.ok(marker.animation.options.duration >= 600);
  map.advanceFrom(9);
  assert.equal(map.world.id, '2');
  assert.equal(selection.value, '10');
  assert.equal(map.map.querySelectorAll('.map-node').length, 26);
  assert.equal(map.map.querySelectorAll('.map-node')[0].dataset.node, LEVELS[9].id);
  marker = map.map.querySelector('.map-koshi');
  assert.equal(marker.animation.frames.length, 2);
  map.advanceFrom(34);
  assert.equal(map.world.id, '3');
  assert.equal(selection.value, '35');
  assert.equal(map.map.querySelectorAll('.map-node').length, 15);
  assert.equal(map.map.querySelectorAll('.map-node')[0].dataset.node, LEVELS[34].id);
  map.advanceFrom(48);
  assert.equal(map.world.id, '4');
  assert.equal(selection.value, '61');
  assert.equal(map.map.querySelectorAll('.map-node').length, 15);
  assert.equal(map.map.querySelectorAll('.map-node')[0].dataset.node, LEVELS[48].id);
  assert.equal(map.map.querySelector('.map-koshi').animation.frames.length, 2);
  map.advanceFrom(LEVELS.length - 1);
  assert.equal(map.world.id, '4');
  assert.equal(selection.value, String(LEVELS.length - 1));
  assert.equal(map.map.querySelectorAll('.map-node').length, 14);
  assert.equal(map.map.querySelector('.map-koshi').animation, undefined, 'the last lesson ends the main path');
  map.advanceFrom(60);
  assert.equal(map.world.id, '3S');
  assert.equal(selection.value, '60');
  assert.equal(map.map.querySelectorAll('.map-node').length, 12);
  assert.equal(map.map.querySelector('.map-koshi').animation, undefined, 'the optional World 3S ends without a route onward');
});

test('completed level stops carry flags and world flags remain unfilled until every level is completed', () => {
  const { map } = mapFixture({ completed: LEVELS.slice(0, 10).map(level => level.id), results: {} });
  const flag = node => node.children.find(child => typeof child.className === 'string'
    && child.className.startsWith('completion-flag'));
  map.open();
  const nodes = map.map.querySelectorAll('.map-node');
  assert.equal(flag(nodes[0]).className, 'completion-flag completion-flag-earned');
  assert.equal(flag(nodes[1]).className, 'completion-flag');
  assert.equal(flag(nodes[0]).children[0].className, 'flag-cloth');
  map.showWorld(WORLDS[0]);
  assert.ok(map.map.querySelectorAll('.map-node').every(flag));
  map.showWorld(WORLDS[1]);
  assert.ok(map.map.querySelectorAll('.map-node').every(node => !flag(node)));
});
