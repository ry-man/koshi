const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Game, OBJECTS } = require('../src/game.js');
const { drawFlameHazard } = require('../src/brick-visuals.js');

const source = name => readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');
const blank = () => ({ version: 1, id: 'Rendering tests', duration: 60, goal: 20, heartCost: null, brickSet: 1, events: [] });

test('editor bumper artwork matches the actual gameplay diameter in both orientations and for every color', () => {
  const editor = source('editor.js');
  const start = editor.indexOf("    if (event.kind === 'object' && OBJECTS[event.type].bumper) {", editor.indexOf('function renderBoard('));
  const end = editor.indexOf("    } else if (event.kind === 'object' && OBJECTS[event.type].catCircle)", start);
  const branch = editor.slice(start, end) + '\n}';
  for (const portrait of [false, true]) for (const scale of [1, .5]) for (const color of ['red', 'green', 'blue']) {
    const game = new Game(() => .5, { customLevel: blank(), portrait, scale, editorPreview: true });
    const event = { kind: 'object', type: `bumper-${color}`, x: .3, y: .6 };
    const point = game.pointFromRelative(event.x, event.y), drawn = [];
    const marker = { style: {}, classList: { add(name) { marker.className = name; } },
      append(...children) { this.children = children; } };
    const canvas = { setAttribute() {}, getContext: () => ({}) }, label = {};
    vm.runInNewContext(branch, { event, point, OBJECTS, previewGame: game, marker, label,
      document: { createElement: () => canvas }, drawBumper: (ctx, bumper) => drawn.push(bumper) });
    const actual = game.createBumper(point, event.type);
    assert.equal(drawn[0].radius, actual.radius);
    assert.equal(drawn[0].type, actual.type);
    assert.equal(marker.className, 'bumper-marker');
    assert.ok(Math.abs(parseFloat(marker.style.width) / 100 * game.width - (actual.radius * 2 + 4)) < 1e-8);
    assert.ok(Math.abs(parseFloat(marker.style.height) / 100 * game.height - (actual.radius * 2 + 4)) < 1e-8);
    assert.equal(canvas.width, 100); assert.equal(canvas.height, 100);
    assert.deepEqual(marker.children, [canvas, label]);
  }
});

function flameContext() {
  let path = [];
  const strokes = [], flames = [];
  const ctx = {
    save() {}, restore() {}, beginPath() { path = []; },
    moveTo(x, y) { path.push([x, y]); }, lineTo(x, y) { path.push([x, y]); }, closePath() {},
    stroke() { strokes.push(path.map(point => [...point])); },
    fill() { flames.push(path.map(point => [...point])); },
  };
  return { ctx, strokes, flames };
}

test('merged Flame hazard outlines and tongues stay on the union exterior, including corners and holes', () => {
  const groups = [
    [{ x: 100, y: 100, w: 60, h: 40 }],
    [{ x: 100, y: 100, w: 60, h: 40 }, { x: 160, y: 100, w: 60, h: 40 }],
    [{ x: 100, y: 100, w: 40, h: 100 }, { x: 140, y: 160, w: 100, h: 40 }],
    [{ x: 100, y: 100, w: 180, h: 40 }, { x: 100, y: 140, w: 40, h: 100 },
      { x: 240, y: 140, w: 40, h: 100 }, { x: 100, y: 240, w: 180, h: 40 }],
  ];
  for (const parts of groups) {
    const { ctx, strokes, flames } = flameContext();
    drawFlameHazard(ctx, parts, .4);
    const inside = (x, y) => parts.some(part => x > part.x && x < part.x + part.w && y > part.y && y < part.y + part.h);
    const exterior = ([x, y]) => {
      const sides = [[.01, .01], [-.01, .01], [.01, -.01], [-.01, -.01]].map(([dx, dy]) => inside(x + dx, y + dy));
      return sides.some(Boolean) && sides.some(value => !value);
    };
    assert.equal(strokes.length, 2, 'one glow and one core outline per combined shape');
    assert.deepEqual(strokes[0], strokes[1]);
    assert.ok(flames.length);
    for (const [[ax, ay], , [bx, by]] of flames) {
      assert.ok(exterior([(ax + bx) / 2, (ay + by) / 2]), 'flames are anchored on an exposed edge, never a shared seam');
    }
    for (let i = 1; i < strokes[0].length; i++) {
      const [ax, ay] = strokes[0][i - 1], [bx, by] = strokes[0][i];
      if (ax !== bx && ay !== by) continue;
      if (ax === bx && ay === by) continue;
      assert.ok(exterior([(ax + bx) / 2, (ay + by) / 2]), 'no internal stroke segments');
    }
  }
});

test('hazard rendering groups merged parts by owner and culls whole groups without dropping visible members', () => {
  const app = source('app.js'), calls = [];
  const parts = [{ id: 1, x: -40, y: 10, w: 40, h: 40 }, { id: 1, x: 0, y: 10, w: 40, h: 40 },
    { id: 2, x: 70, y: 10, w: 40, h: 40 }, { id: 3, x: 900, y: 10, w: 40, h: 40 }];
  const context = {
    game: { hazardFlames: parts, hazardBeams: [], hazardMissiles: [], hazardExplosions: [], elapsed: .6 },
    drawFlameHazard: (ctx, members, time) => calls.push({ members, time }),
    cameraBoundsVisible: (camera, x, y, w) => x + w > camera.x && x < camera.x + camera.width,
  };
  vm.runInNewContext(app.slice(app.indexOf('function drawHazards('), app.indexOf('function drawTurretEffects(')), context);
  context.drawHazards({}, { x: 0, width: 200 });
  assert.equal(calls.length, 2);
  assert.deepEqual(Array.from(calls[0].members), parts.slice(0, 2), 'offscreen members remain part of the full union');
  assert.deepEqual(Array.from(calls[1].members), [parts[2]], 'different bricks are not merged visually');
  assert.ok(calls.every(call => call.time === .6));
  calls.length = 0;
  context.drawHazards({});
  assert.equal(calls.length, 3, 'all groups draw without scrolling culling');
});
