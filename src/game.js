(function () {
'use strict';

const WIDTH = 960;
const HEIGHT = 600;
const DURATION = 60;
const GOAL = 20;
const SPEED = 420;
const COOLDOWNS = { slow: 15, normal: 8, fast: 3 };
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
const LEVELS = [
  { id: '1-1', duration: 60, goal: 20, heartCost: Infinity, food: SCHEDULE, enemies: [], weapons: [] },
  {
    id: '1-2', duration: 120, goal: 20, heartCost: 10,
    food: [[5,'S','S',10],[10,'S','S',10],[15,'S','S',10],[20,'L3','S',10],[25,'L3','S',10],[30,'L3','S',10],[35,'C3','S',10],[40,'C4','S',10],[50,'C5','S',10],[60,'R5','P',15],[80,'R5','P',15],[100,'R5','P',15]],
    enemies: [[10,'mouse',3],[20,'wheel',1],[30,'mouse',3],[40,'wheel',1],[50,'wheel',1],[60,'mouse',3],[70,'mouse',3],[80,'wheel',1],[90,'wheel',1],[100,'mouse',3]],
    weapons: [[5,'wood'],[15,'bronze'],[30,'silver'],[50,'gold'],[70,'silver'],[80,'gold']],
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

function brickShape(parts, crumbly = false) {
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
        const cuts = Math.max(1, Math.floor(length / 9));
        for (let i = 0; i < cuts; i++) {
          const variation = (Math.round(ax * 3 + ay * 5 + bx + by * 7) + i * 17) % 23;
          const depth = Math.min(1.7 + variation % 7 * .55, length / cuts * .38, Math.min(w, h) * .18);
          const start = .04 + variation % 5 * .035;
          const tip = .3 + variation % 6 * .045;
          const end = .78 + variation % 4 * .05;
          for (const [offset, inset] of [[start, 0], [tip, depth], [tip + .16, depth * (.2 + variation % 3 * .2)], [end, 0]]) {
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
  const clipPath = `polygon(evenodd, ${polygon.map(([px, py]) => `${px / w * 100}% ${py / h * 100}%`).join(', ')})`;
  return { x, y, w, h, path, clipPath };
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
    if (this.levelIndex === 1 || this.customLevel?.brickSet === 3) {
      for (const brick of this.bricks) brick.kind = 'normal';
      for (let i = 0; i < 3; i++) {
        this.bricks[Math.floor(i * this.bricks.length / 3)].kind = 'slow';
        this.bricks[Math.floor((i + .5) * this.bricks.length / 3)].kind = 'fast';
      }
    }
    if (this.customLevel?.brickTypes) {
      const regions = brickEditRegions(this.bricks);
      for (const entry of this.customLevel.brickTypes) {
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
    const parts = this.bricks.map(brick => ({ x: brick.x, y: brick.y, w: brick.w, h: brick.h, id: owner(brick), sourceId: brick.id }));
    for (let i = 0; i < this.perimeter.length; i++) {
      const a = this.bricks[this.perimeter[i]], b = this.bricks[this.perimeter[(i + 1) % this.perimeter.length]];
      if (owner(a) !== owner(b)) continue;
      const left = Math.max(a.x, b.x), right = Math.min(a.x + a.w, b.x + b.w);
      const top = Math.max(a.y, b.y), bottom = Math.min(a.y + a.h, b.y + b.h);
      // Fill only the perimeter gap, preserving an L-shaped union around corners.
      if (right > left) parts.push({ id: owner(a), x: left, y: Math.min(a.y + a.h, b.y + b.h), w: right - left, h: top - Math.min(a.y + a.h, b.y + b.h) });
      else if (bottom > top) parts.push({ id: owner(a), x: Math.min(a.x + a.w, b.x + b.w), y: top, w: left - Math.min(a.x + a.w, b.x + b.w), h: bottom - top });
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
        if (solid.some(part => this.bricks[part.id].slimed)) {
          this.stuckUntil = this.elapsed - dt + dt * contact + 1;
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
    } else if (this.score >= this.level.goal) {
      this.state = 'won';
    } else if (this.elapsed >= this.level.duration - 1e-9) {
      this.elapsed = this.level.duration;
      this.state = 'lost';
    }
  }
}

// Classic scripts work over file:// as well as HTTP; Node uses the same engine.
const api = { Game, WIDTH, HEIGHT, DURATION, GOAL, SPEED, COOLDOWNS, FOODS, SCHEDULE, LEVELS, SWORDS, makeBricks, brickContact, validateCustomLevel, snapWheel, brickRegions, brickEditRegions, brickShape };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
} else {
  globalThis.KoshiGame = api;
}
})();
