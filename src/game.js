(function () {
'use strict';

const WIDTH = 960;
const HEIGHT = 600;
const DURATION = 60;
const GOAL = 20;
const SPEED = 420;
const COOLDOWNS = { slow: 15, normal: 8, fast: 3 };
const SLIMES = { blue: { duration: 5, color: '#287dcc' }, green: { duration: 3, color: '#399d24' }, red: { duration: 1, color: '#cd4136' } };
const FOODS = {
  S: { icon: '🍓', value: 1, name: 'Strawberry' },
  P: { icon: '🥨', value: 2, name: 'Pretzel' },
  B: { icon: '🍌', value: 3, name: 'Banana' },
  C: { icon: '🧀', value: 4, name: 'Cheese' },
  L: { icon: '🍗', value: 5, name: 'Chicken leg' },
  F: { icon: '🐟', value: 6, name: 'Fish' },
  H: { icon: '🍔', value: 7, name: 'Hamburger' },
};
const SCHEDULE = [
  [2, 'S', 'S', 5], [4, 'S', 'S', 5], [6, 'S', 'S', 5],
  [10, 'L3', 'S', 5], [15, 'L3', 'S', 5], [20, 'L3', 'S', 5],
  [25, 'C3', 'S', 5], [30, 'C4', 'S', 5], [35, 'C5', 'S', 5],
  [35, 'R5', 'P', 3], [45, 'R5', 'P', 3], [55, 'R5', 'P', 3],
];
const SWORDS = {
  wood: { name: 'Wood Sword', color: '#b88b60', uses: 1 },
  bronze: { name: 'Bronze Sword', color: '#d69963', uses: 3 },
  silver: { name: 'Silver Sword', color: '#d5e0ec', uses: 10 },
  gold: { name: 'Gold Sword', color: '#f3d16b', seconds: 15 },
};
const CHARACTERS = { koshi: 'Koshi', mouse: 'Robo Mouse', wheel: 'Robo Wheel' };
const SCENE_THEMES = ['garden', 'workshop'];

function validateCutscene(value) {
  const fail = message => { throw new TypeError(`Cutscene: ${message}`); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('expected an object.');
  if (!SCENE_THEMES.includes(value.theme)) fail('theme must be garden or workshop.');
  if (!Array.isArray(value.lines) || !value.lines.length || value.lines.length > 100) fail('provide 1–100 dialogue lines.');
  return {
    theme: value.theme,
    lines: value.lines.map((line, i) => {
      if (!line || typeof line.speaker !== 'string' || !Object.hasOwn(CHARACTERS, line.speaker)) fail(`line ${i + 1} has an unknown speaker.`);
      if (typeof line.text !== 'string' || !line.text.trim() || Array.from(line.text).length > 240) fail(`line ${i + 1} needs 1–240 characters of dialogue.`);
      if (!Array.isArray(line.actors) || !line.actors.length || line.actors.length > 6) fail(`line ${i + 1} needs 1–6 actors.`);
      const actors = line.actors.map(actor => {
        if (!actor || typeof actor.character !== 'string' || !Object.hasOwn(CHARACTERS, actor.character)) fail(`line ${i + 1} has an unknown actor.`);
        for (const axis of ['x', 'y']) {
          if (typeof actor[axis] !== 'number' || !Number.isFinite(actor[axis]) || actor[axis] < .1 || actor[axis] > .9) fail(`actor ${axis} must be between 0.1 and 0.9.`);
        }
        return { character: actor.character, x: actor.x, y: actor.y };
      });
      if (!actors.some(actor => actor.character === line.speaker)) fail(`line ${i + 1} must include the speaking character on stage.`);
      return { speaker: line.speaker, text: line.text.trim(), actors };
    }),
  };
}

class Cutscene {
  constructor(value, reducedMotion = false) {
    this.scene = validateCutscene(value);
    this.reducedMotion = reducedMotion;
    this.index = 0;
    this.elapsed = 0;
    this.revealed = false;
    this.finished = false;
  }
  get line() { return this.scene.lines[this.index]; }
  get characters() { return Array.from(this.line.text); }
  get visibleCount() { return this.reducedMotion || this.revealed ? this.characters.length : Math.min(this.characters.length, Math.floor(this.elapsed * 30)); }
  get text() { return this.characters.slice(0, this.visibleCount).join(''); }
  get typing() { return !this.finished && this.visibleCount < this.characters.length; }
  update(seconds) {
    if (!this.finished && Number.isFinite(seconds) && seconds > 0) this.elapsed += seconds;
  }
  advance() {
    if (this.finished) return;
    if (this.typing) this.revealed = true;
    else if (this.index + 1 < this.scene.lines.length) { this.index++; this.elapsed = 0; this.revealed = false; }
    else this.finished = true;
  }
  skip() { this.finished = true; }
}

const storyActors = [
  { character: 'koshi', x: .28, y: .65 },
  { character: 'mouse', x: .67, y: .65 },
  { character: 'wheel', x: .82, y: .7 },
];
const story = (theme, dialogue) => ({
  theme, lines: dialogue.map(([speaker, text]) => ({
    speaker, text, actors: storyActors.map(actor => ({
      ...actor, y: actor.y + (actor.character === speaker ? .05 : 0),
    })),
  })),
});
const LEVELS = [
  {
    id: '1-1', duration: 60, goal: 20, heartCost: Infinity, food: SCHEDULE, enemies: [], weapons: [],
    cutscene: story('garden', [
      ['koshi', 'A sunny garden, a quiet path... and not a snack in sight. Something is very wrong.'],
      ['mouse', 'By order of the Clockwork Pantry, all snacks belong to us! Wheels, roll out!'],
      ['wheel', 'BEEP. SNACK DELIVERY IN PROGRESS. NO CATS ALLOWED.'],
      ['koshi', 'Then my adventure starts with breakfast. Those bricks should help me cross the garden!'],
    ]),
  },
  {
    id: '1-2', duration: 120, goal: 20, heartCost: 10,
    cutscene: story('garden', [
      ['mouse', 'You ate our shipment! Patrol units, guard the garden gate!'],
      ['koshi', 'Your shipment? Those strawberries grew here. I am taking the path to the pantry.'],
      ['wheel', 'WARNING: SWORDS DETECTED. KEEP AWAY FROM THE CAT.'],
    ]),
    food: [[5,'S','S',10],[10,'S','S',10],[15,'S','S',10],[20,'L3','S',10],[25,'L3','S',10],[30,'L3','S',10],[35,'C3','S',10],[40,'C4','S',10],[50,'C5','S',10],[60,'R5','P',15],[80,'R5','P',15],[100,'R5','P',15]],
    enemies: [[10,'mouse',3],[20,'wheel',1],[30,'mouse',3],[40,'wheel',1],[50,'wheel',1],[60,'mouse',3],[70,'mouse',3],[80,'wheel',1],[90,'wheel',1],[100,'mouse',3]],
    weapons: [[5,'wood'],[15,'bronze'],[30,'silver'],[50,'gold'],[70,'silver'],[80,'gold']],
  },
  {
    id: '1-3', name: 'Crumb patrol', duration: 120, goal: 20, killGoal: 4, heartCost: 10, brickSet: 3,
    cutscene: story('garden', [
      ['mouse', 'This old garden wall will crumble before you catch our patrol!'],
      ['koshi', 'Then I will choose my steps carefully. And that spring looks useful.'],
      ['wheel', 'GATE LOCK: FOUR PATROL UNITS. FOOD ALONE WILL NOT OPEN IT.'],
    ]),
    food: [[3,'L3','S',15],[15,'C4','S',20],[30,'R5','P',25],[50,'L3','C',25],[75,'R5','P',30],[100,'C4','P',20]],
    enemies: [[10,'mouse',2],[25,'mouse',2],[45,'wheel',1],[65,'mouse',2],[90,'wheel',1]],
    weapons: [[2,'bronze'],[20,'silver'],[50,'bronze'],[80,'silver']],
    brickTypes: [
      { edge: 'top', start: .2, end: .4, kind: 'fast', crumbler: 5 },
      { edge: 'bottom', start: .6, end: .8, kind: 'fast', crumbler: 5 },
      { edge: 'left', start: .25, end: .375, kind: 'normal', slimed: true, slimeColor: 'red' },
      { edge: 'right', start: .625, end: .75, kind: 'normal', springs: true },
    ],
  },
  {
    id: '1-4', name: 'Slime circuit', duration: 150, goal: 25, killGoal: 8, heartCost: 10, brickSet: 3,
    cutscene: story('workshop', [
      ['wheel', 'WELCOME TO THE PANTRY WORKSHOP. PLEASE ENJOY OUR STICKY SECURITY SYSTEM.'],
      ['mouse', 'Blue slime is my finest work. Plenty of time for a little hand polish!'],
      ['koshi', 'Blue holds longest, red lets go quickly. Eight guards between me and those stolen snacks.'],
    ]),
    food: [[3,'C4','S',20],[18,'L3','P',20],[35,'R5','P',25],[55,'C4','C',25],[80,'R5','P',30],[110,'L3','C',30],[135,'C4','P',15]],
    enemies: [[10,'mouse',3],[25,'wheel',1],[40,'mouse',3],[60,'wheel',2],[85,'mouse',3],[110,'wheel',2],[130,'mouse',2]],
    weapons: [[2,'silver'],[30,'bronze'],[55,'gold'],[85,'silver'],[115,'silver']],
    brickTypes: [
      { edge: 'top', start: .8, end: 1, kind: 'fast', warped: 12 },
      { edge: 'bottom', start: 0, end: .2, kind: 'fast', crumbler: 4 },
      { edge: 'left', start: .125, end: .25, kind: 'normal', slimed: true, slimeColor: 'blue' },
      { edge: 'left', start: .5, end: .625, kind: 'fast', slimed: true, slimeColor: 'red' },
      { edge: 'right', start: .25, end: .375, kind: 'normal', slimed: true, slimeColor: 'green' },
      { edge: 'right', start: .75, end: .875, kind: 'normal', springs: true },
    ],
  },
  {
    id: '1-5', name: 'Warped showdown', duration: 180, goal: 30, killGoal: 12, heartCost: 10, brickSet: 3,
    cutscene: story('workshop', [
      ['mouse', 'The pantry vault! These warped walls will swallow your escape routes!'],
      ['wheel', 'TWELVE GUARDS ONLINE. CRUMBLING WALLS ARMED. SNACKS SECURED.'],
      ['koshi', 'Walls can change. Plans can too. I am bringing every last snack back to the garden.'],
    ]),
    food: [[3,'L3','P',20],[20,'C4','P',25],[40,'R5','P',25],[60,'L3','C',30],[85,'C5','P',30],[115,'R5','C',30],[145,'C4','P',30],[165,'L3','C',15]],
    enemies: [[10,'mouse',3],[25,'wheel',2],[40,'mouse',3],[60,'wheel',2],[80,'mouse',4],[105,'wheel',2],[130,'mouse',4],[155,'wheel',2]],
    weapons: [[2,'silver'],[30,'silver'],[55,'gold'],[80,'silver'],[105,'gold'],[135,'silver'],[155,'gold']],
    brickTypes: [
      { edge: 'top', start: .8, end: 1, kind: 'fast', crumbler: 4, warped: 15 },
      { edge: 'bottom', start: 0, end: .2, kind: 'fast', warped: 10 },
      { edge: 'top', start: .2, end: .4, kind: 'normal', crumbler: 3 },
      { edge: 'bottom', start: .6, end: .8, kind: 'normal', crumbler: 3 },
      { edge: 'left', start: .125, end: .25, kind: 'normal', slimed: true, slimeColor: 'blue' },
      { edge: 'right', start: .25, end: .375, kind: 'fast', slimed: true, slimeColor: 'green' },
      { edge: 'left', start: .625, end: .75, kind: 'fast', slimed: true, slimeColor: 'red' },
      { edge: 'right', start: .75, end: .875, kind: 'normal', springs: true },
      { edge: 'bottom', start: .4, end: .6, kind: 'normal', springs: true },
    ],
  },
];

function validateCustomLevel(value) {
  const fail = message => { throw new TypeError(message); };
  const number = (v, min, max, name) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(`${name} must be a number from ${min} to ${max}.`);
    return v;
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Level must be a JSON object.');
  if (value.version !== 1) fail('Unsupported level version. Expected version 1.');
  if (typeof value.id !== 'string' || !value.id.trim() || value.id.length > 60) fail('Level name must contain 1–60 characters.');
  const duration = number(value.duration, 1, 3600, 'Duration');
  const goal = number(value.goal, 1, 100000, 'Food goal');
  if (!Number.isInteger(goal)) fail('Food goal must be a whole number.');
  const heartCost = value.heartCost === null ? null : number(value.heartCost, 1, 100000, 'Heart cost');
  if (heartCost !== null && !Number.isInteger(heartCost)) fail('Heart cost must be a whole number or null.');
  if (![1, 3].includes(value.brickSet)) fail('Brick set must be 1 or 3 (slow and fast bricks each).');
  if (!Array.isArray(value.events) || value.events.length > 2000) fail('Events must be an array of at most 2000 placements.');
  const events = value.events.map((event, i) => {
    const name = `Event ${i + 1}`;
    if (!event || typeof event !== 'object' || Array.isArray(event)) fail(`${name} must be an object.`);
    const time = number(event.time, 0, duration, `${name} time`);
    if (time >= duration) fail(`${name} must appear before the level ends.`);
    const x = number(event.x, 0, 1, `${name} X`), y = number(event.y, 0, 1, `${name} Y`);
    const types = { food: FOODS, enemy: { mouse: true, wheel: true }, weapon: SWORDS };
    if (!Object.hasOwn(types, event.kind) || !Object.hasOwn(types[event.kind], event.type)) fail(`${name} has an unknown category or type.`);
    if (event.kind === 'enemy' && event.type === 'wheel' && x !== 0 && x !== 1 && y !== 0 && y !== 1) fail(`${name}: wheels must start on an edge of the playable area.`);
    const result = { time, kind: event.kind, type: event.type, x, y };
    if (event.kind === 'food') result.lifetime = number(event.lifetime, .1, 3600, `${name} food lifetime`);
    return result;
  });
  const result = { version: 1, id: value.id.trim(), duration, goal, heartCost, brickSet: value.brickSet, events };
  if (value.cutscene !== undefined) result.cutscene = validateCutscene(value.cutscene);
  if (value.brickTypes !== undefined) {
    if (!Array.isArray(value.brickTypes) || value.brickTypes.length > 2000) fail('Brick types must be an array of at most 2000 edge overrides.');
    result.brickTypes = value.brickTypes.map((entry, i) => {
      if (!entry || !['top', 'bottom', 'left', 'right'].includes(entry.edge) || !Object.hasOwn(COOLDOWNS, entry.kind)) fail(`Brick override ${i + 1} has an unknown edge or type.`);
      const start = number(entry.start, 0, 1, `Brick override ${i + 1} start`);
      const end = number(entry.end, 0, 1, `Brick override ${i + 1} end`);
      if (end <= start) fail(`Brick override ${i + 1} must have an end greater than its start.`);
      const override = { edge: entry.edge, start, end, kind: entry.kind };
      if (entry.crumbler !== undefined) {
        override.crumbler = entry.crumbler === null ? null : number(entry.crumbler, 1, 100000, `Brick override ${i + 1} selections`);
        if (override.crumbler !== null && !Number.isInteger(override.crumbler)) fail(`Brick override ${i + 1} selections must be a whole number.`);
      }
      if (entry.warped !== undefined) override.warped = entry.warped === null ? null : number(entry.warped, .1, 3600, `Brick override ${i + 1} warp duration`);
      if (entry.slimeColor !== undefined) {
        if (typeof entry.slimeColor !== 'string' || !Object.hasOwn(SLIMES, entry.slimeColor)) fail(`Brick override ${i + 1} has an unknown slime color.`);
        override.slimeColor = entry.slimeColor;
      }
      for (const attribute of ['slimed', 'springs']) {
        if (entry[attribute] === undefined) continue;
        if (typeof entry[attribute] !== 'boolean') fail(`Brick override ${i + 1} ${attribute} must be a boolean.`);
        override[attribute] = entry[attribute];
      }
      if (override.slimed && override.springs) fail(`Brick override ${i + 1} cannot be both Slimed and Springs.`);
      return override;
    });
  }
  return result;
}

function brickRegions(bricks, width, height) {
  const groups = { top: [], bottom: [], left: [], right: [] };
  for (const brick of bricks) {
    if (brick.region) {
      const edge = width > height
        ? { top: 'right', right: 'bottom', bottom: 'left', left: 'top' }[brick.region.edge]
        : brick.region.edge;
      groups[edge].push(brick);
      continue;
    }
    const distances = [brick.y, height - brick.y - brick.h, brick.x, width - brick.x - brick.w].map(distance => Math.round(distance * 1e6) / 1e6);
    groups[Object.keys(groups)[distances.indexOf(Math.min(...distances))]].push(brick);
  }
  const regions = new Map();
  for (const [edge, group] of Object.entries(groups)) {
    group.sort((a, b) => edge === 'top' || edge === 'bottom' ? a.x - b.x : a.y - b.y);
    group.forEach((brick, i) => regions.set(brick.id, { edge, start: i / group.length, end: (i + 1) / group.length }));
  }
  return regions;
}

function snapWheel(x, y) {
  const distances = [x, 1 - x, y, 1 - y];
  const edge = distances.indexOf(Math.min(...distances));
  return { x: edge === 0 ? 0 : edge === 1 ? 1 : x, y: edge === 2 ? 0 : edge === 3 ? 1 : y };
}

function brickEditRegions(bricks) {
  return new Map(bricks.map(brick => [brick.id, brick.region]));
}

function brickShape(parts, crumbly = false, wear = 0) {
  wear = crumbly ? Math.max(0, Math.min(1, wear)) : 0;
  const coordinates = axis => [...new Set(parts.flatMap(part =>
    [part[axis], part[axis] + part[axis === 'x' ? 'w' : 'h']].map(value => Math.round(value * 1e6) / 1e6)))].sort((a, b) => a - b);
  const xs = coordinates('x'), ys = coordinates('y');
  const x = xs[0], y = ys[0], w = xs.at(-1) - x, h = ys.at(-1) - y;
  const edges = new Map();
  const edge = (a, b) => {
    const reverse = `${b}:${a}`;
    if (edges.has(reverse)) edges.delete(reverse);
    else edges.set(`${a}:${b}`, { a, b });
  };
  // Cancel shared cell edges so the outline contains no seams between absorbed bricks.
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      if (!parts.some(part => cx >= part.x && cx <= part.x + part.w && cy >= part.y && cy <= part.y + part.h)) continue;
      const a = `${i},${j}`, b = `${i + 1},${j}`, c = `${i + 1},${j + 1}`, d = `${i},${j + 1}`;
      edge(a, b); edge(b, c); edge(c, d); edge(d, a);
    }
  }
  const outgoing = new Map([...edges.values()].map(item => [item.a, item.b]));
  const point = key => {
    const [i, j] = key.split(',').map(Number);
    return [xs[i] - x, ys[j] - y];
  };
  let path = '';
  const polygon = [];
  const normalized = ([px, py]) => `${px / w} ${py / h}`;
  while (outgoing.size) {
    const start = outgoing.keys().next().value;
    let current = start;
    const loop = [point(start)];
    do {
      const next = outgoing.get(current);
      outgoing.delete(current);
      if (crumbly) {
        const [ax, ay] = point(current), [bx, by] = point(next);
        const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
        const mx = x + (ax + bx) / 2 - dy / length * .001;
        const my = y + (ay + by) / 2 + dx / length * .001;
        // A merged perimeter can be large while its solid rim stays thin.
        const thickness = Math.min(w, h, Math.max(...parts.filter(part =>
          mx >= part.x && mx <= part.x + part.w && my >= part.y && my <= part.y + part.h)
          .map(part => dx === 0 ? part.w : part.h)));
        const cuts = Math.max(1, Math.floor(length / 12));
        for (let i = 0; i < cuts; i++) {
          const variation = (Math.round(ax * 3 + ay * 5 + bx + by * 7) + i * 17) % 23;
          const depth = Math.min(
            (3.5 + variation % 7 * .85) * (1 + wear * (1.2 + variation % 4 * .6))
              + wear * thickness * (.12 + variation % 4 * .03),
            length / cuts * .48 + wear * thickness * .25,
            thickness * (.3 + wear * .14));
          const start = .04 + variation % 5 * .035;
          const tip = .3 + variation % 6 * .045;
          const end = .78 + variation % 4 * .05;
          const shoulder = depth * wear * (variation % 3) * .12;
          for (const [offset, inset] of [[start, shoulder], [tip, depth], [tip + .16, depth * (.2 + variation % 3 * .2)], [end, shoulder]]) {
            const t = (i + offset) / cuts;
            loop.push([ax + dx * t - dy / length * inset, ay + dy * t + dx / length * inset]);
          }
        }
      }
      loop.push(point(next));
      current = next;
    } while (current !== start);
    path += `M${loop.map(normalized).join('L')}Z`;
    // Double back along the bridge so even-odd clipping preserves holes in a full perimeter.
    if (polygon.length) polygon.push(loop[0]);
    polygon.push(...loop);
    if (polygon.length) polygon.push(polygon[0]);
  }
  let cracks = '';
  if (wear > 0) {
    for (const part of parts) {
      const vertical = part.h > part.w;
      const seed = Math.round(part.x * 3 + part.y * 7) % 11;
      const local = (along, across) => normalized([
        part.x - x + part.w * (vertical ? across : along),
        part.y - y + part.h * (vertical ? along : across),
      ]);
      for (let i = 0; i < 3; i++) {
        const along = .18 + i * .29 + seed * .003;
        const flip = i % 2 ? -1 : 1;
        const across = i % 2 ? 1 : 0;
        cracks += `M${local(along, across)}L${local(along - .06 * wear, across + flip * .28 * wear)}L${local(along + .07 * wear, across + flip * .54 * wear)}L${local(along - .03 * wear, across + flip * .92 * wear)}`;
        cracks += `M${local(along + .07 * wear, across + flip * .54 * wear)}L${local(along + .2 * wear, across + flip * .45 * wear)}L${local(along + .23 * wear, across + flip * .68 * wear)}`;
      }
    }
  }
  const clipPath = `polygon(evenodd, ${polygon.map(([px, py]) => `${px / w * 100}% ${py / h * 100}%`).join(', ')})`;
  return { x, y, w, h, path, clipPath, cracks };
}

function brickSlime(parts, width, height) {
  const shape = brickShape(parts);
  const { x, y, w, h } = shape;
  const point = (px, py) => `${px / w} ${py / h}`;
  let path = '';
  for (const loop of shape.path.split('M').slice(1)) {
    const vertices = loop.replace('Z', '').split('L').map(pair => pair.split(' ').map(Number))
      .map(([px, py]) => [px * w, py * h]);
    for (let i = 0; i < vertices.length - 1; i++) {
      const [ax, ay] = vertices[i], [bx, by] = vertices[i + 1];
      const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
      if (!length) continue;
      const mx = x + (ax + bx) / 2 - dy / length * .001;
      const my = y + (ay + by) / 2 + dx / length * .001;
      const touching = parts.filter(part =>
        mx >= part.x - 1e-6 && mx <= part.x + part.w + 1e-6 && my >= part.y - 1e-6 && my <= part.y + part.h + 1e-6);
      const inner = touching.some(part => {
        const edge = brickRegions([part], width, height).get(part.id).edge;
        return { top: dx < 0 && dy === 0, bottom: dx > 0 && dy === 0,
          left: dy > 0 && dx === 0, right: dy < 0 && dx === 0 }[edge];
      });
      if (!inner) continue;
      const thickness = Math.max(...touching.map(part => dx === 0 ? part.w : part.h));
      const at = (t, inset) => point(ax + dx * t - dy / length * inset, ay + dy * t + dx / length * inset);
      const lobes = Math.max(1, Math.round(length / 28));
      const band = thickness * .08;
      path += `M${at(0, 0)}L${at(1, 0)}L${at(1, band)}`;
      for (let j = lobes - 1; j >= 0; j--) {
        const variation = (Math.round(x + ax + y + ay) + j * 7) % 5;
        const depth = Math.min(thickness * (.22 + variation * .05), length / lobes * .9);
        path += `Q${at((j + .78) / lobes, band)} ${at((j + .65) / lobes, depth)}`;
        path += `Q${at((j + .38) / lobes, depth * 1.15)} ${at((j + .24) / lobes, band)}`;
        path += `Q${at((j + .12) / lobes, band * .6)} ${at(j / lobes, band)}`;
      }
      path += 'Z';
    }
  }
  return path;
}

function brickRecharge(parts, bricks, perimeter, width, height) {
  const regions = brickRegions(bricks, width, height);
  const ids = new Set(parts.filter(part => part.sourceId !== undefined).map(part => part.sourceId));
  const first = perimeter.findIndex((id, i) => ids.has(id) && !ids.has(perimeter[(i + perimeter.length - 1) % perimeter.length]));
  const start = first < 0 ? 0 : first;
  const position = part => {
    const index = perimeter.indexOf(part.sourceId ?? part.afterId);
    return (index - start + perimeter.length) % perimeter.length + (part.sourceId === undefined ? .5 : 0);
  };
  const segments = [...parts].sort((a, b) => position(a) - position(b)).map(part => {
    let edge;
    if (part.sourceId !== undefined) edge = regions.get(part.sourceId).edge;
    else {
      const before = bricks.find(brick => brick.id === part.afterId);
      // Corner connectors run along the side after a horizontal brick, or before it.
      const vertical = part.x >= before.x && part.x + part.w <= before.x + before.w + 1e-6;
      edge = vertical ? (part.x < width / 2 ? 'left' : 'right') : (part.y < height / 2 ? 'top' : 'bottom');
    }
    return { part, direction: { top: 'right', right: 'bottom', bottom: 'left', left: 'top' }[edge],
      length: edge === 'top' || edge === 'bottom' ? part.w : part.h };
  });
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  let distance = 0;
  return segments.map(({ part, direction, length }) => {
    const segment = { part, direction, start: distance / total * 100, scale: total / length };
    distance += length;
    return segment;
  });
}

function makeBricks(portrait = false, scale = 1) {
  const bricks = [];
  const add = (x, y, w, h, kind = 'normal') =>
    bricks.push({ id: bricks.length, x, y, w, h, kind, readyAt: 0 });
  const width = HEIGHT, height = WIDTH;
  const inset = portrait ? 8 : 20, gap = 8, thickness = portrait ? 45 / scale : 22;
  const columns = 5, rows = 8;
  const sideStart = inset + thickness + gap;
  const horizontal = (width - inset * 2 - gap * (columns - 1)) / columns;
  const vertical = (height - sideStart * 2 - gap * (rows - 1)) / rows;
  for (let i = 0; i < columns; i++) {
    add(inset + i * (horizontal + gap), inset, horizontal, thickness, i === 1 ? 'slow' : 'normal');
    add(inset + i * (horizontal + gap), height - inset - thickness, horizontal, thickness);
  }
  for (let i = 0; i < rows; i++) {
    add(inset, sideStart + i * (vertical + gap), thickness, vertical);
    add(width - inset - thickness, sideStart + i * (vertical + gap), thickness, vertical, i === 4 ? 'fast' : 'normal');
  }
  const regions = brickRegions(bricks, width, height);
  for (const brick of bricks) {
    brick.region = regions.get(brick.id);
    if (!portrait) {
      const { x, y, w, h } = brick;
      brick.x = height - y - h;
      brick.y = x;
      brick.w = h;
      brick.h = w;
    }
  }
  return bricks;
}

// Exact swept circle/rectangle contact, including rounded corner contacts.
function brickContact(x, y, dx, dy, radius, brick) {
  const { x: left, y: top, w, h } = brick;
  const right = left + w, bottom = top + h;
  const hits = [];
  const side = (t, position, min, max) => {
    if (t >= -1e-9 && t <= 1 && position >= min && position <= max) hits.push(Math.max(0, t));
  };
  if (dx > 0) { const t = (left - radius - x) / dx; side(t, y + dy * t, top, bottom); }
  if (dx < 0) { const t = (right + radius - x) / dx; side(t, y + dy * t, top, bottom); }
  if (dy > 0) { const t = (top - radius - y) / dy; side(t, x + dx * t, left, right); }
  if (dy < 0) { const t = (bottom + radius - y) / dy; side(t, x + dx * t, left, right); }
  const a = dx * dx + dy * dy;
  if (a > 0) {
    for (const [cx, cy, sx, sy] of [[left, top, -1, -1], [right, top, 1, -1], [left, bottom, -1, 1], [right, bottom, 1, 1]]) {
      const ox = x - cx, oy = y - cy;
      const b = 2 * (ox * dx + oy * dy);
      const c = ox * ox + oy * oy - radius * radius;
      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0 || b >= 0) continue;
      const t = (-b - Math.sqrt(discriminant)) / (2 * a);
      if (t >= -1e-9 && t <= 1 && (x + dx * t - cx) * sx >= -1e-9 && (y + dy * t - cy) * sy >= -1e-9) {
        hits.push(Math.max(0, t));
      }
    }
  }
  return hits.length ? Math.min(...hits) : Infinity;
}

function distanceToSegment(px, py, x, y, endX, endY) {
  const dx = endX - x, dy = endY - y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((px - x) * dx + (py - y) * dy) / length)) : 0;
  return Math.hypot(px - x - t * dx, py - y - t * dy);
}

function brickNormal(x, y, brick) {
  const dx = x - Math.max(brick.x, Math.min(brick.x + brick.w, x));
  const dy = y - Math.max(brick.y, Math.min(brick.y + brick.h, y));
  const distance = Math.hypot(dx, dy);
  return distance ? { x: dx / distance, y: dy / distance } : null;
}

class Game {
  constructor(random = Math.random, { portrait = false, scale = 1, level = 0, customLevel = null } = {}) {
    if (customLevel) {
      this.customLevel = validateCustomLevel(customLevel);
      this.levelIndex = -1;
      this.level = { ...this.customLevel, heartCost: this.customLevel.heartCost ?? Infinity, food: [], enemies: [], weapons: [] };
      this.customEvents = [...this.customLevel.events].sort((a, b) => a.time - b.time);
    } else {
      if (!LEVELS[level]) throw new RangeError(`Unknown level: ${level}`);
      this.levelIndex = level;
      this.level = LEVELS[level];
      this.customEvents = [];
    }
    this.random = random;
    this.portrait = portrait;
    this.scale = scale;
    this.width = portrait ? HEIGHT : WIDTH;
    this.height = portrait ? WIDTH : HEIGHT;
    this.reset();
  }

  reset() {
    this.state = 'ready';
    this.elapsed = 0;
    this.score = 0;
    this.enemies = 0;
    this.hearts = 3;
    this.nextEvent = 0;
    this.food = [];
    this.bricks = makeBricks(this.portrait, this.scale);
    this.brickRevision = 0;
    this.cat = { x: this.width / 2, y: this.height / 2, radius: 21, vx: 0, vy: 0 };
    this.target = null;
    this.stuckUntil = 0;
    this.stuckColor = 'green';
    this.releasedAt = null;
    this.pickups = [];
    this.foodId = 0;
    this.robots = [];
    this.weapons = [];
    this.healing = [];
    this.weapon = null;
    this.nextEnemy = 0;
    this.nextWeapon = 0;
    this.nextCustom = 0;
    this.nextHeart = this.level.heartCost;
    if (this.levelIndex === 1 || this.level.brickSet === 3) {
      for (const brick of this.bricks) brick.kind = 'normal';
      for (let i = 0; i < 3; i++) {
        this.bricks[Math.floor(i * this.bricks.length / 3)].kind = 'slow';
        this.bricks[Math.floor((i + .5) * this.bricks.length / 3)].kind = 'fast';
      }
    }
    if (this.level.brickTypes) {
      const regions = brickEditRegions(this.bricks);
      for (const entry of this.level.brickTypes) {
        const edgeBricks = this.bricks.filter(brick => regions.get(brick.id).edge === entry.edge);
        const matching = edgeBricks.filter(brick => {
          const region = regions.get(brick.id), center = (region.start + region.end) / 2;
          return center >= entry.start && center < entry.end;
        });
        if (!matching.length) {
          const position = (entry.start + entry.end) / 2;
          matching.push(edgeBricks.reduce((best, brick) => {
            const center = item => (regions.get(item.id).start + regions.get(item.id).end) / 2;
            return Math.abs(center(brick) - position) < Math.abs(center(best) - position) ? brick : best;
          }));
        }
        for (const brick of matching) {
          brick.kind = entry.kind;
          if (entry.crumbler !== undefined) brick.crumbler = entry.crumbler;
          if (entry.warped !== undefined) brick.warped = entry.warped;
          if (entry.slimeColor !== undefined) brick.slimeColor = entry.slimeColor;
          if (entry.slimed !== undefined) {
            brick.slimed = entry.slimed;
            if (entry.slimed) brick.springs = false;
          }
          if (entry.springs !== undefined) {
            brick.springs = entry.springs;
            if (entry.springs) brick.slimed = false;
          }
        }
      }
    }
    for (const brick of this.bricks) {
      brick.usesLeft = brick.crumbler ?? null;
      brick.absorbedBy = null;
      brick.warpUntil = null;
      brick.hitAt = null;
      brick.hitNormal = null;
      brick.hitPoint = null;
    }
    const regions = brickRegions(this.bricks, this.width, this.height);
    this.perimeter = ['top', 'right', 'bottom', 'left'].flatMap(edge => {
      const group = this.bricks.filter(brick => regions.get(brick.id).edge === edge)
        .sort((a, b) => regions.get(a.id).start - regions.get(b.id).start);
      return (edge === 'bottom' || edge === 'left' ? group.reverse() : group).map(brick => brick.id);
    });
  }

  start() {
    if (this.state === 'ready') {
      this.state = 'playing';
      this.spawnCustomEvents();
    }
  }
  pause() { if (this.state === 'playing') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'playing'; }

  steer(id, x, y) {
    const brick = this.bricks.find(item => item.id === id);
    if (this.state !== 'playing' || this.stuckUntil > this.elapsed + 1e-9 || !brick || brick.absorbedBy !== null || brick.usesLeft === 0 || brick.readyAt > this.elapsed + 1e-9) return false;
    const parts = this.brickParts();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !parts.some(part =>
      part.id === id && x >= part.x && x <= part.x + part.w && y >= part.y && y <= part.y + part.h)) return false;
    const dx = x - this.cat.x, dy = y - this.cat.y;
    const distance = Math.hypot(dx, dy);
    if (!distance) return false;
    const vx = dx / distance * SPEED, vy = dy / distance * SPEED;
    if (parts.some(part => brickContact(this.cat.x, this.cat.y, vx / 120, vy / 120, this.cat.radius, part) <= 1e-9)) return false;
    brick.readyAt = this.elapsed + COOLDOWNS[brick.kind];
    if (brick.usesLeft !== null) brick.usesLeft--;
    if (brick.warped) this.absorbNeighbor(brick);
    this.cat.vx = vx;
    this.cat.vy = vy;
    this.target = { x, y };
    return true;
  }

  brickParts() {
    const owner = brick => brick.absorbedBy ?? brick.id;
    const parts = this.bricks.map(brick => ({ x: brick.x, y: brick.y, w: brick.w, h: brick.h, id: owner(brick), sourceId: brick.id, region: brick.region }));
    for (let i = 0; i < this.perimeter.length; i++) {
      const a = this.bricks[this.perimeter[i]], b = this.bricks[this.perimeter[(i + 1) % this.perimeter.length]];
      if (owner(a) !== owner(b)) continue;
      const left = Math.max(a.x, b.x), right = Math.min(a.x + a.w, b.x + b.w);
      const top = Math.max(a.y, b.y), bottom = Math.min(a.y + a.h, b.y + b.h);
      // Fill only the perimeter gap, preserving an L-shaped union around corners.
      if (right > left) parts.push({ id: owner(a), afterId: a.id, x: left, y: Math.min(a.y + a.h, b.y + b.h), w: right - left, h: top - Math.min(a.y + a.h, b.y + b.h) });
      else if (bottom > top) parts.push({ id: owner(a), afterId: a.id, x: Math.min(a.x + a.w, b.x + b.w), y: top, w: left - Math.min(a.x + a.w, b.x + b.w), h: bottom - top });
    }
    return parts;
  }

  absorbNeighbor(brick) {
    const candidates = new Set();
    for (let i = 0; i < this.perimeter.length; i++) {
      const member = this.bricks[this.perimeter[i]];
      if (member.id !== brick.id && member.absorbedBy !== brick.id) continue;
      for (const offset of [-1, 1]) {
        const neighbor = this.bricks[this.perimeter[(i + offset + this.perimeter.length) % this.perimeter.length]];
        const owner = neighbor.absorbedBy ?? neighbor.id;
        if (owner !== brick.id) candidates.add(owner);
      }
    }
    if (!candidates.size) return;
    const ids = [...candidates];
    const neighbor = this.bricks[ids[Math.floor(this.random() * ids.length)]];
    for (const member of this.bricks) {
      if (member.id === neighbor.id || member.absorbedBy === neighbor.id) member.absorbedBy = brick.id;
    }
    neighbor.warpUntil = null;
    if (brick.warpUntil === null) brick.warpUntil = this.elapsed + brick.warped;
    this.brickRevision++;
  }

  restoreWarps() {
    for (const brick of this.bricks) {
      if (brick.usesLeft === 0 || brick.warpUntil === null || brick.warpUntil > this.elapsed + 1e-9) continue;
      for (const member of this.bricks) if (member.absorbedBy === brick.id) member.absorbedBy = null;
      brick.warpUntil = null;
      this.brickRevision++;
    }
  }

  spawn([time, method, type, lifetime]) {
    const count = method === 'S' ? 1 : Number(method.slice(1));
    const angle = this.random() * Math.PI * 2;
    const margin = this.portrait ? 8 + 45 / this.scale + 35 : 95;
    const center = this.portrait
      ? { x: margin + 88 + this.random() * (this.width - 2 * (margin + 88)), y: margin + 88 + this.random() * (this.height - 2 * (margin + 88)) }
      : { x: 240 + this.random() * 480, y: 205 + this.random() * 190 };
    for (let i = 0; i < count; i++) {
      let x = center.x, y = center.y;
      if (method.startsWith('L')) {
        const offset = (i - (count - 1) / 2) * 55;
        x += Math.cos(angle) * offset;
        y += Math.sin(angle) * offset;
      } else if (method.startsWith('C')) {
        const theta = angle + i * Math.PI * 2 / count;
        x += Math.cos(theta) * 88;
        y += Math.sin(theta) * 88;
      } else if (method.startsWith('R')) {
        x = margin + this.random() * (this.width - margin * 2);
        y = margin + this.random() * (this.height - margin * 2);
      }
      this.food.push({ id: this.foodId++, x, y, type, born: time, expires: time + lifetime, lifetime });
    }
  }

  bounds() {
    const inset = (this.portrait ? 8 + 45 / this.scale : 42) + 25;
    return {
      left: inset, top: inset, right: this.width - inset, bottom: this.height - inset,
    };
  }

  randomPoint() {
    const b = this.bounds();
    return { x: b.left + this.random() * (b.right - b.left), y: b.top + this.random() * (b.bottom - b.top) };
  }

  pointFromRelative(x, y) {
    const b = this.bounds();
    return { x: b.left + x * (b.right - b.left), y: b.top + y * (b.bottom - b.top) };
  }

  spawnCustomEvents() {
    while (this.nextCustom < this.customEvents.length && this.customEvents[this.nextCustom].time <= this.elapsed + 1e-9) {
      const event = this.customEvents[this.nextCustom++];
      const point = this.pointFromRelative(event.x, event.y);
      if (event.kind === 'food') {
        this.food.push({ ...point, id: this.foodId++, type: event.type, born: event.time, expires: event.time + event.lifetime, lifetime: event.lifetime });
      } else if (event.kind === 'weapon') {
        this.weapons.push({ ...point, type: event.type });
      } else {
        const enemy = { ...point, type: event.type, radius: 19, phase: this.random() * Math.PI * 2, age: 0, touching: false, distance: 0 };
        if (event.type === 'wheel') {
          const b = this.bounds(), w = b.right - b.left, h = b.bottom - b.top;
          if (event.y === 0) enemy.distance = event.x * w;
          else if (event.x === 1) enemy.distance = w + event.y * h;
          else if (event.y === 1) enemy.distance = w + h + (1 - event.x) * w;
          else enemy.distance = 2 * w + h + (1 - event.y) * h;
          this.placeWheel(enemy);
        }
        this.robots.push(enemy);
      }
    }
  }

  spawnEnemies([, type, count]) {
    const b = this.bounds(), w = b.right - b.left, h = b.bottom - b.top;
    for (let i = 0; i < count; i++) {
      const enemy = { ...this.randomPoint(), type, radius: 19, phase: this.random() * Math.PI * 2, age: 0, touching: false, distance: this.random() * 2 * (w + h) };
      if (type === 'wheel') this.placeWheel(enemy);
      this.robots.push(enemy);
    }
  }

  placeWheel(enemy) {
    const b = this.bounds(), w = b.right - b.left, h = b.bottom - b.top;
    const d = enemy.distance % (2 * (w + h));
    if (d < w) { enemy.x = b.left + d; enemy.y = b.top; }
    else if (d < w + h) { enemy.x = b.right; enemy.y = b.top + d - w; }
    else if (d < 2 * w + h) { enemy.x = b.right - (d - w - h); enemy.y = b.bottom; }
    else { enemy.x = b.left; enemy.y = b.bottom - (d - 2 * w - h); }
  }

  combat(dt, startX, startY) {
    if (this.weapon && this.weapon.expires <= this.elapsed + 1e-9) this.weapon = null;
    this.weapons = this.weapons.filter(item => {
      if (this.weapon || distanceToSegment(item.x, item.y, startX, startY, this.cat.x, this.cat.y) > this.cat.radius + 14) return true;
      const sword = SWORDS[item.type];
      this.weapon = { type: item.type, uses: sword.uses, expires: sword.seconds ? this.elapsed + sword.seconds : Infinity };
      return false;
    });
    const bounds = this.bounds();
    this.robots = this.robots.filter(enemy => {
      const oldX = enemy.x, oldY = enemy.y;
      enemy.age += dt;
      if (enemy.type === 'wheel') {
        enemy.distance += 95 * dt;
        this.placeWheel(enemy);
      } else {
        enemy.resting = enemy.age % 6 >= 4.5;
        if (!enemy.resting) {
          enemy.phase += Math.sin(enemy.age * 1.7 + enemy.phase) * dt;
          enemy.x += Math.cos(enemy.phase) * 65 * dt;
          enemy.y += Math.sin(enemy.phase) * 65 * dt;
          if (enemy.x < bounds.left || enemy.x > bounds.right) enemy.phase = Math.PI - enemy.phase;
          if (enemy.y < bounds.top || enemy.y > bounds.bottom) enemy.phase = -enemy.phase;
          enemy.x = Math.max(bounds.left, Math.min(bounds.right, enemy.x));
          enemy.y = Math.max(bounds.top, Math.min(bounds.bottom, enemy.y));
        }
      }
      const distance = distanceToSegment(0, 0, startX - oldX, startY - oldY, this.cat.x - enemy.x, this.cat.y - enemy.y);
      if (this.weapon && distance <= this.cat.radius + enemy.radius + 18) {
        this.enemies++;
        if (Number.isFinite(this.weapon.uses) && --this.weapon.uses === 0) this.weapon = null;
        return false;
      }
      const touching = distance <= this.cat.radius + enemy.radius;
      if (touching && !enemy.touching) this.hearts = Math.max(0, this.hearts - 1);
      enemy.touching = Math.hypot(this.cat.x - enemy.x, this.cat.y - enemy.y) <= this.cat.radius + enemy.radius;
      return true;
    });
    if (this.hearts <= 0) return;
    this.healing = this.healing.filter(item => {
      if (distanceToSegment(item.x, item.y, startX, startY, this.cat.x, this.cat.y) > this.cat.radius + 13) return true;
      this.hearts = Math.min(3, this.hearts + 1);
      return false;
    });
  }

  update(seconds) {
    if (this.state !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return;
    let remaining = Math.min(seconds, this.level.duration - this.elapsed);
    while (remaining > 1e-9 && this.state === 'playing') {
      const dt = Math.min(remaining, 1 / 120);
      this.tick(dt);
      remaining -= dt;
    }
  }

  tick(dt) {
    this.elapsed = Math.min(this.level.duration, this.elapsed + dt);
    if (this.stuckUntil && this.stuckUntil <= this.elapsed + 1e-9) {
      this.releasedAt = this.stuckUntil;
      this.stuckUntil = 0;
    }
    this.restoreWarps();
    this.spawnCustomEvents();
    while (this.nextEvent < this.level.food.length && this.level.food[this.nextEvent][0] <= this.elapsed + 1e-9) {
      this.spawn(this.level.food[this.nextEvent++]);
    }
    while (this.nextEnemy < this.level.enemies.length && this.level.enemies[this.nextEnemy][0] <= this.elapsed + 1e-9) this.spawnEnemies(this.level.enemies[this.nextEnemy++]);
    while (this.nextWeapon < this.level.weapons.length && this.level.weapons[this.nextWeapon][0] <= this.elapsed + 1e-9) {
      const [, type] = this.level.weapons[this.nextWeapon++];
      this.weapons.push({ ...this.randomPoint(), type });
    }
    this.food = this.food.filter(item => item.expires > this.elapsed + 1e-9);
    const cat = this.cat;
    const dx = cat.vx * dt, dy = cat.vy * dt;
    let contact = 1;
    let contacts = [];
    if (dx || dy) {
      for (const brick of this.brickParts()) {
        const t = brickContact(cat.x, cat.y, dx, dy, cat.radius, brick);
        if (t < contact - 1e-9) { contact = t; contacts = [brick]; }
        else if (t <= contact + 1e-9 && t <= 1) contacts.push(brick);
      }
    }
    const endX = cat.x + dx * contact, endY = cat.y + dy * contact;
    this.food = this.food.filter(item => {
      if (distanceToSegment(item.x, item.y, cat.x, cat.y, endX, endY) > cat.radius + 12) return true;
      const value = FOODS[item.type].value;
      this.score += value;
      this.pickups.push({ x: item.x, y: item.y, value, time: this.elapsed });
      return false;
    });
    while (this.score >= this.nextHeart) {
      this.healing.push(this.randomPoint());
      this.nextHeart += this.level.heartCost;
    }
    const startX = cat.x, startY = cat.y;
    cat.x = endX; cat.y = endY;
    this.combat(dt, startX, startY);
    if (contacts.length) {
      const solid = contacts.filter(part => !this.bricks[part.id].springs);
      if (solid.length) {
        cat.vx = 0; cat.vy = 0;
        const slimes = solid.map(part => this.bricks[part.id]).filter(brick => brick.slimed)
          .sort((a, b) => SLIMES[b.slimeColor ?? 'green'].duration - SLIMES[a.slimeColor ?? 'green'].duration);
        if (slimes.length) {
          this.stuckColor = slimes[0].slimeColor ?? 'green';
          this.stuckUntil = this.elapsed - dt + dt * contact + SLIMES[this.stuckColor].duration;
          this.releasedAt = null;
        }
      } else {
        for (const part of contacts) {
          const brick = this.bricks[part.id];
          const normal = brickNormal(cat.x, cat.y, part);
          if (!normal) continue;
          const incoming = cat.vx * normal.x + cat.vy * normal.y;
          if (incoming >= 0) continue;
          cat.vx -= 2 * incoming * normal.x;
          cat.vy -= 2 * incoming * normal.y;
          brick.hitAt = this.elapsed;
          brick.hitNormal = normal;
          brick.hitPoint = { x: cat.x - normal.x * cat.radius, y: cat.y - normal.y * cat.radius };
        }
      }
      this.target = null;
    }
    this.pickups = this.pickups.filter(item => this.elapsed - item.time < .8);
    if (cat.x - cat.radius < 0 || cat.x + cat.radius > this.width || cat.y - cat.radius < 0 || cat.y + cat.radius > this.height || this.hearts <= 0) {
      this.state = 'lost';
    } else if (this.score >= this.level.goal && this.enemies >= (this.level.killGoal ?? 0)) {
      this.state = 'won';
    } else if (this.elapsed >= this.level.duration - 1e-9) {
      this.elapsed = this.level.duration;
      this.state = 'lost';
    }
  }
}

// Classic scripts work over file:// as well as HTTP; Node uses the same engine.
const api = { Game, Cutscene, CHARACTERS, SCENE_THEMES, validateCutscene, WIDTH, HEIGHT, DURATION, GOAL, SPEED, COOLDOWNS, SLIMES, FOODS, SCHEDULE, LEVELS, SWORDS, makeBricks, brickContact, validateCustomLevel, snapWheel, brickRegions, brickEditRegions, brickShape, brickRecharge, brickSlime };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
} else {
  globalThis.KoshiGame = api;
}
})();
