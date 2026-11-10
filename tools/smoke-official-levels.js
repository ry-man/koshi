'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { once } = require('node:events');
const { createServer } = require('./serve.js');

function requireChromium() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') throw new Error('Browser dependencies are missing. Run npm ci, then npm run setup:publish.', { cause: error });
    throw error;
  }
  if (!fs.existsSync(chromium.executablePath())) throw new Error('Chromium is missing. Run npm run setup:publish once before publishing.');
  return chromium;
}

async function smokeOfficialLevels(ids, root = path.resolve(__dirname, '..')) {
  const chromium = requireChromium();
  const server = createServer(root);
  let browser;
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      if (message.args().length) errors.push(message.text());
      else console.warn(`Native browser diagnostic (non-fatal): ${message.text()}`);
    });
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.setDefaultTimeout(15000);
    await page.goto(`${url}/?game=official`);
    await page.locator('#title-screen[open]').waitFor();
    assert.equal(await page.locator('[data-campaign-select]').inputValue(), 'official');
    const published = await page.evaluate(() => globalThis.KoshiOfficialLevels);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'levels', 'official', 'campaign.json'), 'utf8'));
    const { validateCustomLevel } = require('../src/game.js');
    const selected = ids ?? published.map(entry => entry.id);
    for (const id of selected) {
      const entry = published.find(level => level.id === id);
      assert.ok(entry, `Missing published level ${id}`);
      const source = manifest.levels.find(level => level.id === id);
      assert.deepEqual(entry.level, validateCustomLevel(JSON.parse(fs.readFileSync(
        path.join(root, 'levels', 'official', ...source.file.split('/')), 'utf8'))), `${id}: bundle differs from JSON`);
      // Changing only the fragment does not reload the app's startup selection.
      await page.goto(`${url}/?game=official&smoke=${encodeURIComponent(id)}#campaign=${encodeURIComponent(id)}`);
      await page.waitForFunction(() => !document.body.classList.contains('game-loading'));
      const index = await page.evaluate(levelId => globalThis.KoshiGame.LEVELS.findIndex(level => level.id === levelId), id);
      assert.notEqual(index, -1, `${id}: missing runtime level`);
      assert.equal(await page.locator('#level-select').inputValue(), String(index));
      assert.equal(await page.locator('#level-error').isVisible(), false);
      if (entry.level.cutscene) {
        await page.locator('#cutscene[open]').waitFor();
        assert.ok((await page.locator('#cutscene-transcript').textContent()).includes(entry.level.cutscene.lines[0].text));
        await page.locator('#cutscene-skip').click();
      }
      if (entry.level.levelInfo) {
        await page.locator('#level-info[open]').waitFor();
        for (const [index, info] of entry.level.levelInfo.pages.entries()) {
          if (index) await page.locator('#level-info-next').click();
          assert.equal(await page.locator('#level-info-title').textContent(), info.title);
          assert.equal(await page.locator('#level-info-text').textContent(), info.text);
        }
        await page.locator('#level-info-close').click();
      }
      await page.locator('#play').click();
      await page.waitForFunction(() => !document.querySelector('#pause').disabled);
      await page.locator('#pause').click();
      await page.goto(`${url}/editor.html?game=official`);
      await page.locator('#editor-level').selectOption(String(index));
      assert.equal(await page.locator('#level-name').inputValue(), entry.number);
      assert.ok((await page.locator('#editor-level option:checked').textContent()).includes(entry.level.id));
      assert.equal(await page.locator('#duration').inputValue(), String(entry.level.duration));
      assert.equal(await page.locator('#goal').inputValue(), String(entry.level.goal));
      assert.equal(await page.locator('#editor-bricks').getAttribute('aria-label'), 'Read-only boundary bricks');
      assert.ok((await page.locator('#playtest').getAttribute('href')).endsWith(`#campaign=${encodeURIComponent(id)}`));
      await page.locator('#preview-play').click();
      assert.equal(await page.locator('#preview-play').getAttribute('aria-pressed'), 'true');
      await page.locator('#preview-play').click();
      assert.deepEqual(errors, [], `${id}: browser errors`);
      console.log(`Browser smoke passed: ${entry.worldId}-${entry.number} (${id})`);
    }
    assert.deepEqual(errors, [], 'Browser errors');
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    }
  }
}

if (require.main === module) {
  smokeOfficialLevels().catch(error => { console.error(error); process.exitCode = 1; });
}

module.exports = { requireChromium, smokeOfficialLevels };
