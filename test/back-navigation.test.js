'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game } = require('../src/game.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const protection = source.slice(source.indexOf('function isInstalledApp()'), source.indexOf('\nfunction line('));

function fixture({ installed = true, entries = [null], index = entries.length - 1, failure = null } = {}) {
  entries = [...entries];
  const listeners = {};
  const documentListeners = {};
  const error = { textContent: '', hidden: true };
  const logged = [];
  let syncs = 0, pushes = 0, forwards = 0;
  let pendingForward = false, activated = false, skippable = false, closed = false;
  const game = new Game();
  game.start();
  const cutscene = { active: false, paused: false };
  const listen = registry => (type, handler) => { (registry[type] ??= []).push(handler); };
  const emit = (registry, type, event = {}) => { for (const handler of registry[type] ?? []) handler(event); };
  const history = {
    get state() { return entries[index]; },
    replaceState(value, title, url) {
      assert.equal(url, undefined, 'keep the URL and custom-level hash unchanged');
      if (failure === 'arm') throw new Error('History unavailable');
      entries[index] = value;
    },
    pushState(value, title, url) {
      assert.equal(url, undefined);
      // Chromium stops honoring prior activation after traversal. A push then
      // makes all entries for this document skippable by system/browser Back.
      if (!activated) skippable = true;
      entries.splice(index + 1);
      entries.push(value);
      index++;
      pushes++;
    },
    forward() {
      if (failure === 'forward') throw new Error('History traversal unavailable');
      pendingForward = true;
      forwards++;
    },
  };
  const document = {
    hidden: false,
    querySelector: () => error,
    getElementById: () => null,
    addEventListener: listen(documentListeners),
  };
  const context = vm.createContext({
    window: { matchMedia: () => ({ matches: installed }), addEventListener: listen(listeners) },
    navigator: {}, history, game, cutscene, document, lastTime: 123,
    syncUI: () => { syncs++; },
    console: { error: (...args) => logged.push(args) },
  });
  vm.runInContext(`${protection}\ninstallBackNavigation();`, context);
  return {
    entries, listeners, game, cutscene, context, document, error, logged,
    get syncs() { return syncs; },
    get pushes() { return pushes; },
    get forwards() { return forwards; },
    get closed() { return closed; },
    input(type = 'pointerdown', isTrusted = true) {
      if (isTrusted) { activated = true; skippable = false; }
      emit(listeners, type, { isTrusted });
    },
    back() {
      activated = false;
      if (skippable || index === 0) { closed = true; return; }
      index--;
      emit(listeners, 'popstate');
    },
    finishForward() {
      assert.equal(pendingForward, true);
      pendingForward = false;
      if (index < entries.length - 1) index++;
      emit(listeners, 'popstate');
    },
    blur() { emit(listeners, 'blur'); },
    hide() { document.hidden = true; emit(documentListeners, 'visibilitychange'); },
    reload() { vm.runInContext('installBackNavigation();', context); },
  };
}

test('guard is created by trusted input, never by startup or synthetic input', () => {
  for (const type of ['pointerdown', 'keydown', 'click']) {
    const app = fixture({ entries: [{ other: 'preserved' }] });
    assert.equal(app.pushes, 0);
    app.input(type, false);
    assert.equal(app.pushes, 0);
    app.input(type);
    assert.equal(app.entries.length, 2);
    assert.equal(app.entries[1].other, 'preserved');
    assert.equal(app.entries[1].koshiBackGuard, true);
    app.input(type);
    assert.equal(app.pushes, 1);
  }
});

test('repeated system Back reuses activated history without pausing or making entries skippable', () => {
  const app = fixture();
  app.input();
  for (let i = 0; i < 20; i++) {
    app.back();
    assert.equal(app.closed, false, `system Back ${i + 1} must not skip the app`);
    assert.equal(app.entries.length, 2);
    assert.equal(app.pushes, 1, 'never push from a traversal');
    assert.equal(app.game.state, 'playing');
    assert.equal(app.context.lastTime, 123);
    app.finishForward();
  }
  assert.equal(app.forwards, 20);
  assert.equal(app.syncs, 0);
  app.game.pause();
  app.back(); app.finishForward();
  assert.equal(app.game.state, 'paused');
});

test('input during asynchronous restoration does not replace or duplicate the forward entry', () => {
  const app = fixture();
  app.input(); app.back();
  app.input('click'); app.input('keydown');
  assert.equal(app.pushes, 1);
  assert.equal(app.forwards, 1);
  app.finishForward();
  app.input();
  assert.equal(app.entries.length, 2);
});

test('reload reuses the existing guard, including restoration interrupted by reload', () => {
  const entries = [{ koshiBackGuard: false }, { koshiBackGuard: true }];
  const app = fixture({ entries });
  app.reload(); app.input();
  assert.equal(app.pushes, 0);
  assert.equal(app.entries.length, 2);
  const returning = fixture({ entries, index: 0 });
  assert.equal(returning.forwards, 1);
  returning.finishForward();
  returning.input();
  assert.equal(returning.pushes, 0);
});

test('browser tabs keep native Back navigation and blur pausing', () => {
  const app = fixture({ installed: false });
  app.input();
  assert.equal(app.entries.length, 1);
  assert.equal(app.listeners.popstate, undefined);
  app.blur();
  assert.equal(app.game.state, 'paused');
});

test('visible installed-app blur does not pause gameplay or cutscenes; hiding still pauses', () => {
  const app = fixture();
  app.cutscene.active = true;
  app.blur();
  assert.equal(app.game.state, 'playing');
  assert.equal(app.cutscene.paused, false);
  assert.equal(app.context.lastTime, 123);
  assert.equal(app.syncs, 0);
  app.hide();
  assert.equal(app.game.state, 'paused');
  assert.equal(app.cutscene.paused, true);
  assert.equal(app.context.lastTime, null);
  assert.equal(app.syncs, 1);
});

test('Back leaves story scenes and ready or completed levels unchanged', () => {
  const app = fixture();
  app.input();
  app.cutscene.active = true;
  for (const state of ['ready', 'won', 'lost']) {
    app.game.state = state;
    app.back(); app.finishForward();
    assert.equal(app.cutscene.paused, false);
    assert.equal(app.game.state, state);
  }
});

test('history creation and traversal failures are logged and shown explicitly', () => {
  for (const failure of ['arm', 'forward']) {
    const app = fixture({ failure });
    app.input();
    if (failure === 'forward') app.back();
    assert.equal(app.logged.length, 1);
    assert.equal(app.error.hidden, false);
    assert.match(app.error.textContent, /History .*unavailable/);
    assert.match(app.error.textContent, /Android Back may close the app/);
  }
});
