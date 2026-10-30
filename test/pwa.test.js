'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pngSize = file => {
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${file} is a PNG`);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
};

test('manifest meets Android install requirements', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, "Koshi's Quest");
  assert.ok(manifest.short_name.length <= 12);
  assert.equal(manifest.start_url, './index.html');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(root, icon.src)), `${icon.src} exists`);
  const pngs = manifest.icons.filter(icon => icon.type === 'image/png');
  for (const icon of pngs) assert.equal(pngSize(icon.src), icon.sizes, `${icon.src} matches its declared size`);
  assert.ok(pngs.some(icon => icon.sizes === '192x192' && icon.purpose === 'any'));
  assert.ok(pngs.some(icon => icon.sizes === '512x512' && icon.purpose === 'any'));
  assert.ok(pngs.some(icon => icon.purpose === 'maskable'));
  for (const shortcut of manifest.shortcuts) assert.ok(fs.existsSync(path.join(root, shortcut.url)));
});

test('both pages link the manifest and register offline support', () => {
  for (const page of ['index.html', 'editor.html']) {
    const html = read(page);
    assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
    assert.match(html, /src="\.\/src\/pwa\.js"/);
    assert.match(html, /rel="apple-touch-icon" href="\.\/icons\/apple-touch-icon\.png"/);
    assert.doesNotMatch(html, /https?:\/\/(?!www\.w3\.org)/, `${page} has no external dependencies`);
  }
  assert.doesNotMatch(read('style.css'), /fonts\.googleapis|@import/);
});

test('service worker precaches every local asset the pages load', () => {
  const sw = read('sw.js');
  const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  for (const asset of assets) assert.ok(fs.existsSync(path.join(root, asset)), `${asset} exists`);
  const referenced = new Set();
  for (const page of ['index.html', 'editor.html']) {
    for (const [, url] of read(page).matchAll(/(?:href|src)="\.\/([^"#]+\.(?:css|js|webmanifest|png|svg))"/g)) referenced.add(`./${url}`);
  }
  for (const [, url] of read('style.css').matchAll(/url\('\.\/([^']+)'\)/g)) referenced.add(`./${url}`);
  for (const url of referenced) assert.ok(assets.includes(url), `${url} is precached`);
  assert.match(sw, /const VERSION = 'koshi-dev';/);
});

test('Pages workflow deploys and versions the offline app files', () => {
  const workflow = read('.github/workflows/pages.yml');
  for (const file of ['manifest.webmanifest', 'sw.js']) assert.match(workflow, new RegExp(file.replace('.', '\\.')));
  assert.match(workflow, /cp -r src icons fonts _site\//);
  assert.match(workflow, /s\/const VERSION = 'koshi-dev';\/const VERSION = 'koshi-\$\{GITHUB_SHA\}';\//);
});
