'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { buildOfficialLevels } = require('../tools/build-official-levels.js');
const { createServer } = require('../tools/serve.js');
const { Game, validateCustomLevel } = require('../src/game.js');
const { OFFICIAL_LEVEL_DATA, OFFICIAL_WORLDS, assembleCampaign } = require('../src/campaign.js');

const officialCampaign = assembleCampaign(OFFICIAL_LEVEL_DATA, OFFICIAL_WORLDS);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const relative = (game, point) => {
  const b = game.bounds();
  return { x: (point.x - b.left) / (b.right - b.left), y: (point.y - b.top) / (b.bottom - b.top) };
};

test('all authored Official placements preserve desktop coordinates and rotate with bricks on phones', () => {
  const manifest = require('../levels/official/campaign.json');
  for (const entry of manifest.levels) {
    const source = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'levels', 'official', ...entry.file.split('/')), 'utf8'));
    const before = JSON.stringify(source);
    const level = officialCampaign.findIndex(level => level.id === entry.id);
    const desktop = new Game(() => .5, { levels: officialCampaign, level });
    assert.equal(desktop.level.coordinateOrientation, 'landscape');
    for (const scale of [1, .5, .31]) {
      const phone = new Game(() => .5, { levels: officialCampaign, level, portrait: true, scale });
      const custom = new Game(() => .5, { customLevel: source, portrait: true, scale, editorPreview: true });
      close(phone.width, desktop.height); close(phone.height, desktop.width);
      close(custom.width, phone.width); close(custom.height, phone.height);
      for (const brick of desktop.bricks) {
        for (const rotated of [phone.bricks[brick.id], custom.bricks[brick.id]]) {
          close(rotated.x, brick.y); close(rotated.y, desktop.width - brick.x - brick.w);
          close(rotated.w, brick.h); close(rotated.h, brick.w);
          assert.equal(rotated.kind, brick.kind);
          assert.equal(rotated.absorbedBy, brick.absorbedBy);
          assert.deepEqual(rotated.region, brick.region);
        }
      }
      for (const time of [0, 10, 45, 60, 90, 105, 120, 1000]) {
        desktop.elapsed = phone.elapsed = time;
        const camera = desktop.camera(time), rotated = phone.camera(time);
        close(rotated.x, camera.y); close(rotated.y, desktop.width - camera.x - camera.width);
        assert.deepEqual(custom.camera(time), rotated);
        const bounds = desktop.simulationBounds(), rotatedBounds = phone.simulationBounds();
        close(rotatedBounds.x, bounds.y); close(rotatedBounds.y, desktop.width - bounds.x - bounds.width);
        close(rotatedBounds.width, bounds.height); close(rotatedBounds.height, bounds.width);
      }
      desktop.elapsed = phone.elapsed = 0;
      close(phone.cat.x, desktop.cat.y); close(phone.cat.y, desktop.width - desktop.cat.x);
      close(custom.cat.x, phone.cat.x); close(custom.cat.y, phone.cat.y);
      for (const event of source.events.filter(event => !event.random)) {
        const position = relative(desktop, desktop.campaignEventPoint(event.x, event.y));
        close(position.x, event.x); close(position.y, event.y);
        const rotated = relative(phone, phone.campaignEventPoint(event.x, event.y));
        close(rotated.x, event.y); close(rotated.y, 1 - event.x);
        const points = desktop.customEventPoints(event, { preview: true });
        const rotatedPoints = phone.customEventPoints(event, { preview: true });
        const customPoints = custom.customEventPoints(event, { preview: true });
        assert.equal(points.length, rotatedPoints.length);
        assert.deepEqual(customPoints, rotatedPoints);
        for (let i = 0; i < points.length; i++) {
          const original = relative(desktop, points[i]), rotated = relative(phone, rotatedPoints[i]);
          close(rotated.x, original.y); close(rotated.y, 1 - original.x);
          close(rotatedPoints[i].x, points[i].y);
          close(rotatedPoints[i].y, desktop.width - points[i].x);
        }
        const entities = desktop.createCustomSpawn(event);
        const rotatedEntities = phone.createCustomSpawn(event);
        assert.equal(rotatedEntities.length, entities.length);
        for (let i = 0; i < entities.length; i++) {
          close(rotatedEntities[i].x, entities[i].y);
          close(rotatedEntities[i].y, desktop.width - entities[i].x);
        }
      }
    }
    assert.equal(JSON.stringify(source), before);
  }
});

test('the scrolling phone camera and first screen preserve visibility without reversing brick identity', () => {
  const source = require('../levels/official/world-1/1-7.json');
  const desktop = new Game(() => .5, { customLevel: source });
  const phone = new Game(() => .5, { customLevel: source, portrait: true, scale: .31 });
  const next = game => new Map(game.perimeter.map((id, i) => [id, game.perimeter[(i + 1) % game.perimeter.length]]));
  assert.deepEqual(next(desktop), next(phone));
  for (const time of [0, 10, 45, 60, 90, 105, 120]) {
    desktop.elapsed = phone.elapsed = time;
    for (const brick of desktop.bricks) {
      assert.equal(phone.brickVisible(phone.bricks[brick.id]), desktop.brickVisible(brick));
    }
  }
  assert.ok(phone.camera(10).y < phone.camera(0).y, 'counterclockwise camera scrolls upward');
  phone.reset(); phone.start();
  assert.equal(phone.checkOffscreenDeath(), false, 'the default starting point is on the bottom first screen');
});

test('Official geometry, tracks, starting position and spawning templates use the same phone rotation', () => {
  const source = validateCustomLevel({
    version: 1, id: 'Orientation fixture', duration: 60, goal: 1000, heartCost: null, brickSet: 1,
    koshiStart: { x: .3, y: .6 },
    tracks: [{ id: 'track', nodes: [{ x: .2, y: .3 }, { x: .8, y: .3 }], speed: 30, closed: false }],
    events: [{ time: 0, kind: 'object', type: 'obstruction-rectangle', x: .2, y: .3,
      width: 120, height: 30, rotation: 20, track: 'track' }],
    brickTypes: [{ edge: 'top', start: 0, end: .2, kind: 'normal',
      spawner: { kind: 'weapon', type: 'wood', x: .3, y: .6 } }],
  });
  const before = JSON.stringify(source);
  const levels = [{ ...source, id: 'official-fixture', coordinateOrientation: 'landscape', food: [], enemies: [], weapons: [], items: [] }];
  const desktop = new Game(() => .5, { levels });
  const phone = new Game(() => .5, { levels, portrait: true });
  const event = source.events[0];
  const original = desktop.createCustomSpawn(event)[0], rotated = phone.createCustomSpawn(event)[0];
  assert.equal(original.rotation, 20);
  assert.equal(rotated.rotation, 290);
  assert.equal(rotated.width, 120); assert.equal(rotated.height, 30);
  close(phone.cat.x, phone.campaignEventPoint(.3, .6).x);
  close(phone.cat.y, phone.campaignEventPoint(.3, .6).y);
  close(relative(phone, rotated).x, .3); close(relative(phone, rotated).y, .8);
  close(desktop.catTracks[0].path.length, phone.catTracks[0].path.length);
  const brick = phone.bricks.find(brick => brick.spawner);
  phone.spawnFromBrick(brick);
  close(relative(phone, phone.weapons[0]).x, .6); close(relative(phone, phone.weapons[0]).y, .7);
  const crab = { time: 1, kind: 'enemy', type: 'robo-crab', x: .5, y: .5, crabDirection: 'horizontal' };
  assert.equal(desktop.createCustomSpawn(crab)[0].crabAxis, 'x');
  assert.equal(phone.createCustomSpawn(crab)[0].crabAxis, 'y');
  assert.equal(phone.createEnemies([1, 'robo-crab', 1, null, crab])[0].crabAxis, 'y');
  assert.equal(JSON.stringify(source), before);
});

test('editable JSON uses Official rotation while Beta retains its original orientation', () => {
  for (const portrait of [false, true]) {
    const beta = new Game(() => .5, { portrait });
    assert.deepEqual(beta.campaignEventCoordinates(.2, .3), portrait ? { x: .2, y: .3 } : { x: .7, y: .2 });
    const source = { version: 1, id: 'Custom coordinates', duration: 60, goal: 1000,
      heartCost: null, brickSet: 1, events: [] };
    const custom = new Game(() => .5, { customLevel: source, portrait });
    assert.deepEqual(custom.campaignEventCoordinates(.2, .3), portrait ? { x: .3, y: .8 } : { x: .2, y: .3 });
    assert.deepEqual(custom.campaignSourceCoordinates(.3, .8), portrait ? { x: 1 - .8, y: .3 } : { x: .3, y: .8 });
    const event = { kind: 'object', type: 'obstruction-rectangle', rotation: 20 };
    assert.equal(beta.campaignEventAppearance(event), event);
    assert.deepEqual(custom.campaignEventAppearance(event), portrait ? { ...event, rotation: 290 } : event);
  }
});

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koshi-official-build-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'levels', 'official');
  fs.mkdirSync(directory, { recursive: true });
  fs.mkdirSync(path.join(root, 'src'));
  const write = (file, value) => {
    const filename = path.join(directory, ...file.split('/'));
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, JSON.stringify(value));
  };
  const level = { version: 1, id: 'Fixture breakfast', duration: 50, goal: 20,
    heartCost: null, brickSet: 1, events: [{ time: 15, kind: 'item', type: 'cat-block', random: true }],
    catBlock: { description: 'Find the Cat Block.', trigger: { type: 'spawn' } } };
  const entry = { file: 'world-1/1-1.json', worldId: '1', number: '1', id: 'official-1-1' };
  const manifest = { version: 1, levels: [entry] };
  write(entry.file, level);
  write('campaign.json', manifest);
  const outputPath = path.join(root, 'src', 'official-levels.generated.js');
  const bundle = () => {
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync(outputPath, 'utf8'), context);
    return JSON.parse(JSON.stringify(context.KoshiOfficialLevels));
  };
  return { root, write, level, entry, manifest, outputPath, bundle };
}

test('bundle generation tracks JSON edits and file moves without changing permanent IDs', t => {
  const f = fixture(t);
  const first = buildOfficialLevels(f.root);
  assert.deepEqual(f.bundle(), first);
  const timestamp = fs.statSync(f.outputPath).mtimeMs;
  buildOfficialLevels(f.root);
  assert.equal(fs.statSync(f.outputPath).mtimeMs, timestamp, 'unchanged output is not rewritten');
  f.level.goal = 25;
  f.level.id = 'Renamed breakfast';
  f.write('new-folder/renamed.json', f.level);
  f.entry.file = 'new-folder/renamed.json';
  f.write('campaign.json', f.manifest);
  buildOfficialLevels(f.root);
  assert.equal(f.bundle()[0].id, 'official-1-1');
  assert.equal(f.bundle()[0].level.id, 'Renamed breakfast');
  assert.equal(f.bundle()[0].level.goal, 25);
});

test('only manifest-listed files are published and hundreds of levels can be bundled', t => {
  const f = fixture(t);
  f.write('unfinished.json', { version: 'invalid draft' });
  assert.equal(buildOfficialLevels(f.root).length, 1);
  f.manifest.levels = Array.from({ length: 300 }, (_, index) => {
    const number = String(index + 1), file = `world-1/${number}.json`;
    f.write(file, { ...f.level, id: `Breakfast ${number}` });
    return { file, worldId: '1', number, id: `official-1-${number}` };
  });
  f.write('campaign.json', f.manifest);
  assert.equal(buildOfficialLevels(f.root).length, 300);
  assert.equal(f.bundle().length, 300);
  const context = vm.createContext({ KoshiOfficialLevels: f.bundle() });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'campaign.js'), 'utf8'), context);
  const campaign = context.KoshiCampaign;
  const levels = campaign.assembleCampaign(campaign.OFFICIAL_LEVEL_DATA, campaign.OFFICIAL_WORLDS);
  assert.equal(levels.length, 316, '300 authored levels plus 16 unchanged starters');
  const world = levels.filter(level => level.worldId === '1');
  assert.equal(world[0].number, '1');
  assert.equal(world[299].number, '300');
  assert.equal(world[0].id, 'official-1-1');
});

test('invalid published levels stop generation with file-specific errors and preserve the last bundle', t => {
  const f = fixture(t);
  buildOfficialLevels(f.root);
  const before = fs.readFileSync(f.outputPath, 'utf8');
  f.write(f.entry.file, { ...f.level, duration: -1 });
  assert.throws(() => buildOfficialLevels(f.root), /1-1\.json.*Duration/);
  assert.equal(fs.readFileSync(f.outputPath, 'utf8'), before);
  fs.writeFileSync(path.join(f.root, 'levels', 'official', ...f.entry.file.split('/')), '{invalid json');
  assert.throws(() => buildOfficialLevels(f.root), /1-1\.json/);
  f.entry.file = 'missing.json';
  f.write('campaign.json', f.manifest);
  assert.throws(() => buildOfficialLevels(f.root), /missing\.json.*ENOENT/);
});

test('manifest rejects invalid worlds, paths, schema, duplicates, and collisions with remaining starters', t => {
  const f = fixture(t);
  for (const [change, pattern] of [
    [{ worldId: 'C' }, /nonplayable world/],
    [{ worldId: 'missing' }, /nonplayable world/],
    [{ number: 2 }, /number must/],
    [{ id: '' }, /permanent id must/],
    [{ file: '../outside.json' }, /relative JSON path/],
    [{ file: '/absolute.json' }, /relative JSON path/],
    [{ file: 'world-1\\1-1.json' }, /relative JSON path/],
    [{ id: 'official-2-1' }, /duplicate permanent id/],
  ]) {
    f.write('campaign.json', { version: 1, levels: [{ ...f.entry, ...change }] });
    assert.throws(() => buildOfficialLevels(f.root), pattern);
  }
  for (const [change, name, pattern] of [
    [{ id: f.entry.id }, 'Second breakfast', /duplicate permanent id/],
    [{ number: '1' }, 'Second breakfast', /duplicate world\/level number/],
    [{}, f.level.id, /duplicate level name/],
    [{}, 'Catnip Beach Starter', /duplicate level name/],
    [{ file: f.entry.file }, 'Second breakfast', /duplicate source file/],
  ]) {
    f.write('second.json', { ...f.level, id: name });
    f.write('campaign.json', { version: 1, levels: [
      f.entry, { ...f.entry, file: 'second.json', id: 'official-1-2', number: '2', ...change },
    ] });
    assert.throws(() => buildOfficialLevels(f.root), pattern);
  }
  f.write('campaign.json', { version: 2, levels: [] });
  assert.throws(() => buildOfficialLevels(f.root), /campaign\.json.*version 1/);
});

test('local page refresh automatically rebuilds published JSON and reports validation errors', async t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'index.html'), '<html>Fixture game</html>');
  fs.writeFileSync(path.join(f.root, 'editor.html'), '<html>Fixture editor</html>');
  const server = createServer(f.root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  f.level.goal = 26;
  f.write(f.entry.file, f.level);
  assert.equal((await fetch(`${url}/`)).status, 200);
  assert.equal(f.bundle()[0].level.goal, 26);
  f.level.goal = 27;
  f.write(f.entry.file, f.level);
  assert.equal((await fetch(`${url}/editor.html`)).status, 200);
  assert.equal(f.bundle()[0].level.goal, 27);
  f.level.goal = 28;
  f.write(f.entry.file, f.level);
  assert.equal((await fetch(`${url}/src/official-levels.generated.js`)).status, 200);
  assert.equal(f.bundle()[0].level.goal, 28);
  const errors = [];
  t.mock.method(console, 'error', error => errors.push(error));
  f.write(f.entry.file, { ...f.level, goal: -1 });
  assert.equal((await fetch(`${url}/index.html`)).status, 500);
  assert.match(errors[0].message, /1-1\.json/);
  assert.equal(f.bundle()[0].level.goal, 28);
});
