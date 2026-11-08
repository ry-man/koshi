const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, COOLDOWNS, SPEED, brickEditRegions, validateCustomLevel, INFO_GRAPHICS } = require('../src/game.js');
const { decorateBrick, updateBrick, specialLabel } = require('../src/brick-visuals.js');

const blank = () => ({ version: 1, id: 'Power Blocks', duration: 120, goal: 1000, heartCost: null, brickSet: 1, events: [] });
const aim = (game, brick) => game.steer(brick.id, brick.x + brick.w / 2, brick.y + brick.h / 2);
function setup(kind = 'normal', options = {}, attributes = {}) {
  const base = new Game(() => .5);
  const region = brickEditRegions(base.bricks).get(0);
  const customLevel = { ...blank(), brickTypes: [{ ...region, kind, power: true, ...attributes }] };
  const game = new Game(() => .5, { ...options, customLevel });
  game.start();
  return game;
}

test('Power is a portable independent modifier, not a contact surface or a new steering color', () => {
  const game = setup();
  const source = game.customLevel;
  assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(source))), source);
  assert.equal(INFO_GRAPHICS['special:power'], 'power');
  for (const value of [null, 1, 'true', {}]) {
    assert.throws(() => validateCustomLevel({ ...source, brickTypes: [{ ...source.brickTypes[0], power: value }] }), /power must be a boolean/);
  }
  for (const kind of ['cinder', 'goal']) {
    assert.throws(() => validateCustomLevel({ ...source, brickTypes: [{ ...source.brickTypes[0], kind }] }), /cannot have modifiers/);
  }
  const combined = setup('fast', {}, { crumbler: 5, warped: 15, toggle: 1, spikes: true });
  assert.equal(combined.bricks[0].power, true);
  assert.equal(combined.bricks[0].spikes, true);
});

for (const kind of ['slow', 'normal', 'fast']) {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    test(`${kind} Power Block preserves steering and cooldown in ${options.portrait ? 'portrait' : 'desktop'}`, () => {
      const game = setup(kind, options), brick = game.bricks[0];
      assert.equal(brick.kind, kind);
      assert.equal(brick.powerOn, false);
      assert.equal(aim(game, brick), true);
      assert.equal(brick.powerOn, true);
      assert.equal(brick.readyAt, COOLDOWNS[kind]);
      assert.ok(Math.abs(Math.hypot(game.cat.vx, game.cat.vy) - SPEED) < 1e-6);
      assert.equal(aim(game, brick), false, 'cooling selections do not switch power');
      assert.equal(brick.powerOn, true);
      game.elapsed = COOLDOWNS[kind];
      assert.equal(aim(game, brick), true);
      assert.equal(brick.powerOn, false);
      game.elapsed += COOLDOWNS[kind];
      assert.equal(aim(game, brick), true);
      game.reset();
      assert.equal(game.bricks[0].power, true);
      assert.equal(game.bricks[0].powerOn, false);
    });
  }
}

test('Power only switches on a successful selection of that block, including sunglasses selections', () => {
  const game = setup(), brick = game.bricks[0];
  game.pause();
  assert.equal(aim(game, brick), false);
  assert.equal(brick.powerOn, false);
  game.resume();
  assert.equal(game.steer(brick.id, NaN, brick.y), false);
  assert.equal(game.steer(brick.id, game.width / 2, game.height / 2), false);
  assert.equal(brick.powerOn, false);
  assert.equal(aim(game, game.bricks[1]), true);
  assert.equal(brick.powerOn, false, 'other selections do not switch this block');
  const exit = game.portalExit(brick);
  game.cat.x = exit.x - exit.nx * .01;
  game.cat.y = exit.y - exit.ny * .01;
  game.cat.vx = 0; game.cat.vy = 0;
  game.update(.01);
  assert.equal(brick.powerOn, false, 'physical contact does not switch power');
  game.cat.x = game.width / 2; game.cat.y = game.height / 2;
  brick.toggle = 1; brick.toggleRemaining = 1;
  assert.equal(aim(game, brick), false);
  assert.equal(brick.powerOn, false);
  brick.usesLeft = 0;
  game.sunglassesStart = game.elapsed;
  game.sunglassesUntil = game.elapsed + 10;
  assert.equal(aim(game, brick), true);
  assert.equal(brick.powerOn, true);
  assert.equal(aim(game, brick), true);
  assert.equal(brick.powerOn, false);
  assert.equal(brick.toggleRemaining, 1);
});

test('Power state belongs to the combined owner and survives temporary Warped growth', () => {
  const base = setup(), index = base.perimeter.indexOf(0);
  const ids = [0, base.perimeter[(index + 1) % base.perimeter.length]];
  const source = { ...base.customLevel, brickGroups: [{ owner: 0, members: ids }],
    brickTypes: [{ ...base.customLevel.brickTypes[0], warped: 1 }] };
  const game = new Game(() => .5, { customLevel: source }); game.start();
  const owner = game.bricks[0], member = game.bricks[ids[1]];
  assert.equal(game.steer(owner.id, member.x + member.w / 2, member.y + member.h / 2), true);
  assert.equal(owner.powerOn, true);
  assert.equal(aim(game, member), false);
  game.elapsed = 2; game.restoreWarps();
  assert.equal(owner.powerOn, true);
  assert.equal(member.absorbedBy, owner.id);
});

test('Ditto copies the Power modifier using shared state and Cinder conversion removes it', () => {
  const game = setup(), source = game.bricks[0], target = game.bricks[1];
  assert.equal(aim(game, source), true);
  game.dittoStamp = true;
  assert.equal(game.stampBrick(source, game.brickParts()), true);
  assert.equal(game.stampBrick(target, game.brickParts()), true);
  assert.equal(target.power, true);
  assert.equal(target.powerOn, true);
  assert.equal(game.convertBrickToCinder(source, game.brickParts()), true);
  assert.equal(source.power, false);
  assert.equal(source.powerOn, false);
  assert.equal(game.powerOn, true, 'removing a block does not change the shared state');
});

test('shared starting power validates and round-trips without changing legacy levels', () => {
  assert.equal(Object.hasOwn(validateCustomLevel(blank()), 'powerOn'), false);
  for (const powerOn of [false, true]) {
    const level = { ...setup().customLevel, powerOn };
    assert.deepEqual(validateCustomLevel(JSON.parse(JSON.stringify(level))), level);
    const preview = new Game(() => .5, { customLevel: level, editorPreview: true });
    assert.equal(preview.powerOn, powerOn);
    assert.equal(preview.bricks[0].powerOn, powerOn);
  }
  for (const powerOn of [null, 0, 'on', [], {}]) {
    assert.throws(() => validateCustomLevel({ ...blank(), powerOn }), /Starting power must be a boolean/);
  }
});

for (const powerOn of [false, true]) {
  for (const options of [{}, { portrait: true, scale: .31 }]) {
    test(`Power Blocks stay coordinated from ${powerOn ? 'black' : 'yellow'} in ${options.portrait ? 'portrait' : 'desktop'}`, () => {
      const base = setup(), ids = base.perimeter.slice(0, 5);
      const regions = brickEditRegions(base.bricks);
      const level = { ...blank(), powerOn, brickTypes: ids.map((id, index) => ({
        ...regions.get(id), kind: ['slow', 'normal', 'fast'][index % 3], power: true,
        ...(index === 3 ? { toggle: 1 } : {}),
        ...(index === 4 ? { crumbler: 1 } : {}),
      })), brickGroups: [{ owner: ids[0], members: ids.slice(0, 2) }] };
      const game = new Game(() => .5, { ...options, customLevel: level }); game.start();
      const blocks = ids.map(id => game.bricks[id]);
      const check = expected => {
        assert.equal(game.powerOn, expected);
        for (const brick of blocks) assert.equal(brick.powerOn, expected);
      };
      check(powerOn);
      blocks[4].usesLeft = 0;
      blocks[2].readyAt = 50;
      assert.equal(aim(game, blocks[2]), false);
      check(powerOn);
      assert.equal(aim(game, blocks[0]), true);
      check(!powerOn);
      assert.equal(blocks[2].readyAt, 50, 'remote blocks keep their cooldowns');
      assert.equal(blocks[4].usesLeft, 0, 'exhausted blocks still show shared power');
      assert.equal(aim(game, blocks[1]), false, 'hidden members cannot activate');
      check(!powerOn);
      game.elapsed = 50;
      game.cat.x = game.width / 2; game.cat.y = game.height / 2;
      assert.equal(aim(game, blocks[2]), true);
      check(powerOn);
      game.elapsed += COOLDOWNS[blocks[0].kind];
      game.cat.x = game.width / 2; game.cat.y = game.height / 2;
      assert.equal(aim(game, blocks[0]), true);
      check(!powerOn);
      game.reset();
      for (const brick of game.bricks.filter(brick => brick.power)) assert.equal(brick.powerOn, powerOn);
      assert.equal(game.customLevel.powerOn, powerOn, 'play does not mutate saved initial power');
    });
  }
}

test('Power artwork stays circular and upright, swaps exact black/yellow colors, and shares panels with modifiers', () => {
  const previous = global.document;
  const node = () => ({
    attributes: {}, children: [], style: {}, dataset: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    append(...children) { this.children.push(...children); },
  });
  global.document = { createElementNS: node };
  try {
    for (const vertical of [false, true]) {
      for (const modifiers of [{}, { crumbler: 5, warped: 15, toggle: 4, toggleRemaining: 4 }]) {
        const brick = { x: 0, y: 0, w: vertical ? 25 : 100, h: vertical ? 100 : 25,
          power: true, powerOn: false, ...modifiers };
        const visual = decorateBrick(node(), brick, [brick]);
        const icon = visual.info.children.find(child => child.attributes.class === 'brick-power');
        assert.equal(icon.attributes.viewBox, '-29 -29 58 58');
        assert.equal(icon.attributes.preserveAspectRatio, undefined, 'default uniform scaling keeps the disc circular');
        assert.equal(icon.attributes.transform, undefined, 'the power glyph remains upright on either edge');
        assert.equal(visual.powerDisc.attributes.r, '27');
        assert.equal(visual.powerDisc.attributes.fill, '#ffd92f');
        assert.equal(visual.powerMark.attributes.stroke, '#000000');
        const layer = name => icon.children.find(child => child.attributes.class === name);
        assert.equal(layer('power-shadow').attributes.cy, '1.5');
        assert.equal(layer('power-sheen').attributes.fill, '#ffffff');
        assert.equal(layer('power-shade').attributes.fill, '#000000');
        assert.equal(layer('power-bevel-light').attributes.stroke, '#ffffff');
        assert.equal(layer('power-bevel-dark').attributes.stroke, '#000000');
        assert.equal(layer('power-mark-shadow').attributes.d, visual.powerMark.attributes.d);
        assert.equal(icon.children.at(-1), visual.powerMark, 'shading never obscures the power symbol');
        assert.match(visual.powerMark.attributes.d, /A17 17.*M0 -21 V-2/);
        assert.match(specialLabel(brick), /Power: off/);
        brick.powerOn = true;
        updateBrick(visual, brick, 1);
        assert.equal(visual.powerDisc.attributes.fill, '#000000');
        assert.equal(visual.powerMark.attributes.stroke, '#ffd92f');
        assert.match(specialLabel(brick), /Power: on/);
        brick.powerOn = false;
        updateBrick(visual, brick, 2);
        assert.equal(visual.powerDisc.attributes.fill, '#ffd92f');
        assert.equal(visual.powerMark.attributes.stroke, '#000000');
      }
    }
  } finally {
    if (previous === undefined) delete global.document;
    else global.document = previous;
  }
});
