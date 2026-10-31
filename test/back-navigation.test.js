'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game } = require('../src/game.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const protection = source.slice(source.indexOf('function installBackNavigation()'), source.indexOf('\nfunction line('));
const autoPause = source.slice(source.indexOf('function autoPause()'), source.indexOf('\nconst installButton'));

function fixture({ installed = true, state = null, failure = false } = {}) {
  const entries = [state];
  const listeners = {};
  const error = { textContent: '', hidden: true };
  const logged = [];
  let index = 0;
  let syncs = 0;
  const game = new Game();
  game.start();
  const cutscene = { active: false, paused: false };
  const history = {
    get state() { return entries[index]; },
    replaceState(value, title, url) {
      assert.equal(url, undefined, 'keep the URL and custom-level hash unchanged');
      if (failure) throw new Error('History unavailable');
      entries[index] = value;
    },
    pushState(value, title, url) {
      assert.equal(url, undefined);
      entries.splice(index + 1);
      entries.push(value);
      index++;
    },
  };
  const context = vm.createContext({
    window: { matchMedia: () => ({ matches: installed }), addEventListener: (type, handler) => { listeners[type] = handler; } },
    navigator: {},
    history, game, cutscene, lastTime: 123,
    syncUI: () => { syncs++; },
    document: { querySelector: () => error },
    console: { error: (...args) => logged.push(args) },
  });
  vm.runInContext(`${autoPause}\n${protection}\ninstallBackNavigation();`, context);
  return {
    entries, listeners, game, cutscene, context, error, logged,
    get syncs() { return syncs; },
    back() { assert.ok(index > 0); index--; listeners.popstate(); },
    reload() { vm.runInContext('installBackNavigation();', context); },
  };
}

test('installed app Back pauses and re-arms without growing history or resuming play', () => {
  const app = fixture({ state: { other: 'preserved' } });
  assert.equal(app.entries.length, 2);
  assert.equal(app.entries[1].other, 'preserved');
  for (let i = 0; i < 5; i++) {
    app.back();
    assert.equal(app.game.state, 'paused');
    assert.equal(app.entries.length, 2);
    assert.equal(app.entries[1].koshiBackGuard, true);
    assert.equal(app.context.lastTime, null);
  }
  assert.equal(app.syncs, 1);
  app.game.resume();
  app.back();
  assert.equal(app.game.state, 'paused');
  assert.equal(app.syncs, 2);
});

test('reload reuses the existing guard rather than adding another entry', () => {
  const app = fixture({ state: { koshiBackGuard: true } });
  assert.equal(app.entries.length, 1);
  app.reload();
  assert.equal(app.entries.length, 1);
});

test('browser tabs keep native Back navigation', () => {
  const app = fixture({ installed: false });
  assert.equal(app.entries.length, 1);
  assert.equal(app.listeners.popstate, undefined);
  assert.equal(app.game.state, 'playing');
});

test('Back freezes story scenes and never starts a ready or completed level', () => {
  const app = fixture();
  app.cutscene.active = true;
  app.game.state = 'ready';
  app.back();
  assert.equal(app.cutscene.paused, true);
  assert.equal(app.game.state, 'ready');
  for (const state of ['won', 'lost']) {
    app.game.state = state;
    app.back();
    assert.equal(app.game.state, state);
  }
});

test('history failures are logged and shown explicitly', () => {
  const app = fixture({ failure: true });
  assert.equal(app.logged.length, 1);
  assert.equal(app.error.hidden, false);
  assert.match(app.error.textContent, /History unavailable/);
  assert.match(app.error.textContent, /Android Back may close the app/);
});
