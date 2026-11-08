'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { buildOfficialLevels } = require('../tools/build-official-levels.js');
const { createServer } = require('../tools/serve.js');

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
