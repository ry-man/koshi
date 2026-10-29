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

function makeBricks() {
  const bricks = [];
  const add = (x, y, w, h, kind = 'normal') =>
    bricks.push({ id: bricks.length, x, y, w, h, kind, readyAt: 0 });
  for (let i = 0; i < 8; i++) {
    add(20 + i * 116, 20, 108, 22, i === 2 ? 'slow' : 'normal');
    add(20 + i * 116, 558, 108, 22);
  }
  for (let i = 0; i < 5; i++) {
    add(20, 50 + i * 102, 22, 94);
    add(918, 50 + i * 102, 22, 94, i === 2 ? 'fast' : 'normal');
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

class Game {
  constructor(random = Math.random) {
    this.random = random;
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
    this.bricks = makeBricks();
    this.cat = { x: WIDTH / 2, y: HEIGHT / 2, radius: 21, vx: 0, vy: 0 };
    this.target = null;
    this.pickups = [];
    this.foodId = 0;
  }

  start() { if (this.state === 'ready') this.state = 'playing'; }
  pause() { if (this.state === 'playing') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'playing'; }

  steer(id, x, y) {
    const brick = this.bricks.find(item => item.id === id);
    if (this.state !== 'playing' || !brick || brick.readyAt > this.elapsed) return false;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < brick.x || x > brick.x + brick.w || y < brick.y || y > brick.y + brick.h) return false;
    const dx = x - this.cat.x, dy = y - this.cat.y;
    const distance = Math.hypot(dx, dy);
    if (!distance) return false;
    brick.readyAt = this.elapsed + COOLDOWNS[brick.kind];
    this.cat.vx = dx / distance * SPEED;
    this.cat.vy = dy / distance * SPEED;
    this.target = { x, y };
    return true;
  }

  spawn([time, method, type, lifetime]) {
    const count = method === 'S' ? 1 : Number(method.slice(1));
    const angle = this.random() * Math.PI * 2;
    const center = { x: 240 + this.random() * 480, y: 205 + this.random() * 190 };
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
        x = 95 + this.random() * 770;
        y = 95 + this.random() * 410;
      }
      this.food.push({ id: this.foodId++, x, y, type, born: time, expires: time + lifetime, lifetime });
    }
  }

  update(seconds) {
    if (this.state !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return;
    let remaining = Math.min(seconds, DURATION - this.elapsed);
    while (remaining > 1e-9 && this.state === 'playing') {
      const dt = Math.min(remaining, 1 / 120);
      this.tick(dt);
      remaining -= dt;
    }
  }

  tick(dt) {
    this.elapsed = Math.min(DURATION, this.elapsed + dt);
    while (this.nextEvent < SCHEDULE.length && SCHEDULE[this.nextEvent][0] <= this.elapsed + 1e-9) {
      this.spawn(SCHEDULE[this.nextEvent++]);
    }
    this.food = this.food.filter(item => item.expires > this.elapsed + 1e-9);
    const cat = this.cat;
    const dx = cat.vx * dt, dy = cat.vy * dt;
    let contact = 1;
    let stopped = false;
    if (dx || dy) {
      for (const brick of this.bricks) {
        const t = brickContact(cat.x, cat.y, dx, dy, cat.radius, brick);
        if (t <= contact) { contact = t; stopped = true; }
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
    cat.x = endX; cat.y = endY;
    if (stopped) { cat.vx = 0; cat.vy = 0; this.target = null; }
    this.pickups = this.pickups.filter(item => this.elapsed - item.time < .8);
    if (cat.x - cat.radius < 0 || cat.x + cat.radius > WIDTH || cat.y - cat.radius < 0 || cat.y + cat.radius > HEIGHT || this.hearts <= 0) {
      this.state = 'lost';
    } else if (this.score >= GOAL) {
      this.state = 'won';
    } else if (this.elapsed >= DURATION - 1e-9) {
      this.elapsed = DURATION;
      this.state = 'lost';
    }
  }
}

// Classic scripts work over file:// as well as HTTP; Node uses the same engine.
const api = { Game, WIDTH, HEIGHT, DURATION, GOAL, SPEED, COOLDOWNS, FOODS, SCHEDULE, makeBricks, brickContact };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
} else {
  globalThis.KoshiGame = api;
}
})();
