'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'transitions.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(reduced = false) {
  const animations = [], events = [], logged = [];
  const message = { hidden: true };
  const document = {
    activeElement: { isConnected: true, focus() { events.push('focus'); } },
    body: { append() {} },
    querySelector: () => message,
    createElement: () => ({
      style: {}, setAttribute() {}, append() {}, addEventListener() {},
      showModal() { events.push('open'); },
      close() { events.push('close'); },
      animate(frames, options) {
        let resolve;
        const finished = new Promise(done => { resolve = done; });
        const animation = { frames, options, finished, resolve, cancel() { events.push('cancel'); } };
        animations.push(animation);
        return animation;
      },
    }),
  };
  const context = vm.createContext({
    document, window: { matchMedia: () => ({ matches: reduced }) },
    console: { error: (...args) => logged.push(args) },
  });
  vm.runInContext(source, context);
  return { transition: new context.KoshiPhaseTransition(), animations, events, message, logged };
}

test('wipe covers first, changes phase only at full black, reveals afterward, and restores focus', async () => {
  const { transition, animations, events } = fixture();
  const pending = transition.perform(() => events.push('phase'));
  assert.equal(events.includes('phase'), false);
  assert.equal(animations.length, 1);
  assert.equal(animations[0].frames[0].transform, 'translateX(-100%)');
  assert.equal(animations[0].frames[1].transform, 'translateX(0)');
  animations[0].resolve();
  await flush();
  assert.ok(events.includes('phase'));
  assert.equal(transition.cover.style.transform, 'translateX(0)');
  assert.equal(animations.length, 2);
  assert.equal(animations[1].frames[1].transform, 'translateX(100%)');
  assert.equal(animations.reduce((sum, animation) => sum + animation.options.duration, 0), 2100);
  animations[1].resolve();
  await pending;
  assert.deepEqual(events.slice(-2), ['close', 'focus']);
  assert.equal(transition.busy, false);
});

test('rapid repeated requests cannot run competing phase changes', async () => {
  const { transition, animations } = fixture();
  let changes = 0;
  transition.run(() => changes++);
  transition.run(() => changes++);
  assert.equal(transition.busy, true);
  animations[0].resolve(); await flush();
  assert.equal(changes, 1);
  animations[1].resolve(); await flush();
  assert.equal(transition.busy, false);
});

test('reduced motion changes phase synchronously without a wipe', () => {
  const { transition, animations } = fixture(true);
  let changed = false;
  transition.run(() => { changed = true; });
  assert.equal(changed, true);
  assert.equal(animations.length, 0);
  assert.equal(transition.busy, false);
});

test('failed phase actions release input and visibly report errors', async () => {
  const { transition, animations, message, logged } = fixture();
  transition.run(() => { throw new Error('Phase unavailable'); });
  animations[0].resolve();
  await flush();
  assert.equal(transition.busy, false);
  assert.equal(logged.length, 1);
  assert.equal(message.hidden, false);
  assert.match(message.textContent, /Phase unavailable/);
});

test('both wipe edges have alternating sawteeth and extend beyond the viewport at full black', () => {
  const { transition } = fixture();
  const clip = transition.cover.style.clipPath;
  assert.equal(clip.slice(8, -1).split(',').filter(point => point.startsWith('100% ')).length, 12);
  assert.equal((clip.match(/0px /g) ?? []).length, 12);
  assert.match(clip, /calc\(100% - 32px\) 0%/);
  assert.match(clip, /32px 0%\)$/);
});

test('opening fade reaches full black, pauses, swaps the screen, and fades back in', async () => {
  const { transition, animations, events } = fixture();
  transition.run(() => events.push('scene'), { fade: true });
  assert.equal(transition.cover.style.clipPath, 'none');
  assert.equal(animations[0].frames[0].opacity, 0);
  assert.equal(animations[0].frames[1].opacity, 1);
  animations[0].resolve(); await flush();
  assert.equal(events.includes('scene'), false, 'hold black before changing screens');
  assert.equal(animations[1].options.duration, 650);
  assert.ok(animations[1].frames.every(frame => frame.opacity === 1));
  animations[1].resolve(); await flush();
  assert.equal(events.includes('scene'), true);
  assert.equal(animations[2].frames[0].opacity, 1);
  assert.equal(animations[2].frames[1].opacity, 0);
  assert.equal(animations.reduce((sum, animation) => sum + animation.options.duration, 0), 2450);
  animations[2].resolve(); await flush();
  assert.equal(transition.busy, false);
  transition.run(() => {});
  assert.match(transition.cover.style.clipPath, /^polygon/);
  assert.equal(transition.cover.style.opacity, '1', 'subsequent wipes are opaque');
  animations[3].resolve(); await flush();
  animations[4].resolve(); await flush();
});

test('reduced motion skips the opening fades and black hold', () => {
  const { transition, animations } = fixture(true);
  let changed = false;
  transition.run(() => { changed = true; }, { fade: true });
  assert.equal(changed, true);
  assert.equal(animations.length, 0);
});
