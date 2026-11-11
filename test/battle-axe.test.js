const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, WEAPONS, SWORDS, FOODS, SHIELDS, LEVELS, validateCustomLevel } = require('../src/game.js');
const { spawnSymbol, spawnColor } = require('../src/brick-visuals.js');

const axes = [['axe-silver', 6, 'silver'], ['axe-gold', 12, 'gold']];
const level = (events = [], extra = {}) => ({
  version: 1, id: 'Battle axe test', duration: 120, goal: 1000, heartCost: null,
  brickSet: 3, events, ...extra,
});
function arena() {
  const game = new Game(() => .5, { customLevel: level() });
  game.start();
  return game;
}
function equip(game, type) {
  game.weapons.push({ type, x: game.cat.x, y: game.cat.y });
  game.combat(0, game.cat.x, game.cat.y);
}
function mouse(game, shield = null) {
  return { type: 'mouse', x: game.cat.x, y: game.cat.y, radius: 19, phase: 0, age: 4.5, shield,
    defeatPoints: shield ? SHIELDS[shield].hits : 1 };
}

test('only silver and golden battle axes exist and no campaign content uses them', () => {
  assert.deepEqual(Object.keys(WEAPONS).filter(type => WEAPONS[type].axe), axes.map(([type]) => type));
  for (const [type, seconds, sword] of axes) {
    assert.equal(WEAPONS[type].seconds, seconds);
    assert.equal(WEAPONS[type].color, SWORDS[sword].color);
    assert.equal(WEAPONS[type].uses, undefined);
    assert.equal(JSON.stringify(LEVELS).includes(type), false);
  }
});

test('axes allow repeated strikes without spending uses and expire exactly at their deadline', () => {
  for (const [type, seconds] of axes) {
    const game = arena();
    game.elapsed = 12;
    equip(game, type);
    const deadline = 12 + seconds;
    assert.equal(game.weapon.expires, deadline);
    for (let hit = 0; hit < 30; hit++) {
      game.robots.push(mouse(game));
      game.combat(0, game.cat.x, game.cat.y);
      assert.equal(game.enemies, hit + 1);
      assert.equal(game.weapon.type, type);
      assert.equal(game.weapon.expires, deadline);
      assert.equal(game.weapon.uses, undefined);
    }
    game.elapsed = deadline - .001;
    game.combat(0, game.cat.x, game.cat.y);
    assert.equal(game.weapon.type, type);
    game.elapsed = deadline;
    game.robots.push(mouse(game));
    game.combat(0, game.cat.x, game.cat.y);
    assert.equal(game.weapon, null);
    assert.equal(game.enemies, 30);
    assert.equal(game.hearts, 2, 'expiration happens before combat');
  }
});

test('axe timers advance only during gameplay, freeze on pause and clear on reset', () => {
  for (const [type, seconds] of axes) {
    const game = arena();
    equip(game, type);
    game.update(seconds - .1);
    assert.equal(game.weapon.type, type);
    const elapsed = game.elapsed, deadline = game.weapon.expires;
    game.pause(); game.update(100);
    assert.equal(game.elapsed, elapsed);
    assert.equal(game.weapon.expires, deadline);
    game.resume(); game.update(.1);
    assert.equal(game.weapon, null);
    equip(game, type);
    game.reset();
    assert.equal(game.weapon, null);
  }
});

test('axes deal one shield hit per accepted contact and honor enemy damage protection', () => {
  for (const [type] of axes) {
    const game = arena();
    equip(game, type);
    const enemy = mouse(game, 'blue');
    game.robots.push(enemy);
    for (const next of ['green', 'red', null]) {
      enemy.x = game.cat.x; enemy.y = game.cat.y;
      game.combat(0, game.cat.x, game.cat.y);
      assert.equal(enemy.shield, next);
      assert.equal(game.weapon.type, type);
      game.combat(0, game.cat.x, game.cat.y);
      assert.equal(enemy.shield, next, 'protected enemy cannot take another hit');
      game.elapsed = enemy.invulnerableUntil;
    }
    enemy.x = game.cat.x; enemy.y = game.cat.y;
    game.combat(0, game.cat.x, game.cat.y);
    assert.equal(game.robots.length, 0);
    assert.equal(game.enemies, 4);
    assert.equal(game.weapon.type, type);
  }
});

test('axe spawns validate, and on-screen lifetime does not shorten the equipped timer', () => {
  for (const [type, seconds] of axes) {
    const event = { time: 0, kind: 'weapon', type, x: .5, y: .5, lifetime: 1 };
    const custom = level([event], {
      brickTypes: [{ edge: 'top', start: 0, end: .1, kind: 'normal', spawner: { kind: 'weapon', type } }],
    });
    assert.deepEqual(validateCustomLevel(custom), custom);
    const game = new Game(() => .5, { customLevel: custom });
    game.start(); game.update(1 / 120);
    assert.equal(game.weapon.type, type);
    assert.ok(Math.abs(game.weapon.expires - game.elapsed - seconds) < 1e-9);
    game.spawnFromBrick(game.bricks.find(brick => brick.spawner));
    assert.equal(game.weapons[0].type, type);
    game.elapsed += 2;
    equip(game, type);
    assert.equal(game.weapon.expires, game.elapsed + seconds, 'same axe refreshes its full timer');
  }
});

test('editor strike totals handle timed scheduled axes, spawners and enemy drops without NaN', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8');
  const nodes = new Map();
  const context = vm.createContext({ WEAPONS, FOODS, SHIELDS, $: selector => {
    if (!nodes.has(selector)) nodes.set(selector, {});
    return nodes.get(selector);
  } });
  vm.runInContext(source.slice(source.indexOf('function pointReference('), source.indexOf('function render()')), context);
  for (const [type] of axes) {
    for (const [events, bricks] of [
      [[{ kind: 'weapon', type, group: { count: 3 } }], []],
      [[], [{ absorbedBy: null, spawner: { kind: 'weapon', type } }]],
      [[{ kind: 'enemy', type: 'mouse', carriesItem: type }], []],
    ]) {
      const totals = context.pointReference(events, bricks);
      assert.equal(totals.weaponHits, Infinity);
      context.renderPointReference(events, bricks);
      assert.equal(nodes.get('#available-weapon-hits').textContent, 'Unlimited (timed)');
    }
  }
});

test('battle axe art uses a double blade, sword colors and the existing 5px handle with 7px outline', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  const strokes = [], fills = [], labels = [], curves = [];
  const ctx = new Proxy({ strokeStyle: '', fillStyle: '', lineWidth: 0 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'stroke') return () => strokes.push([target.strokeStyle, target.lineWidth]);
      if (name === 'fill') return () => fills.push(target.fillStyle);
      if (name === 'fillText') return (...args) => labels.push(args);
      if (name === 'quadraticCurveTo') return (...args) => curves.push(args);
      return () => {};
    },
  });
  const context = vm.createContext({ ctx, WEAPONS });
  vm.runInContext(source.slice(source.indexOf('function line('), source.indexOf('function drawCat('))
    + source.slice(source.indexOf('function drawSword('), source.indexOf('function drawAttackPop(')), context);
  for (const [type, seconds, sword] of axes) {
    strokes.length = 0; fills.length = 0; curves.length = 0; labels.length = 0;
    context.drawWeapon(0, 0, type, String(seconds));
    assert.deepEqual(strokes, [['#17212a', 7], ['#8a6953', 5], ['#17212a', 1.5]]);
    assert.deepEqual(fills, [SWORDS[sword].color]);
    assert.deepEqual(labels[0], [String(seconds), 0, -10, 16]);
    assert.ok(curves.some(([x, y]) => x === -30 && y === -10));
    assert.ok(curves.some(([x, y]) => x === 30 && y === -10));
    assert.equal(spawnColor({ kind: 'weapon', type }), SWORDS[sword].color);
    assert.match(spawnSymbol({ kind: 'weapon', type }), /Q-30 -10.*Q30 -10/);
    assert.notEqual(spawnSymbol({ kind: 'weapon', type }), spawnSymbol({ kind: 'weapon', type: sword }));
  }
});
