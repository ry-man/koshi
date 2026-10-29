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

function makeBricks(portrait = false, scale = 1) {
  const bricks = [];
  const add = (x, y, w, h, kind = 'normal') =>
    bricks.push({ id: bricks.length, x, y, w, h, kind, readyAt: 0 });
  if (portrait) {
    const inset = 8, gap = 8, thickness = 45 / scale;
    const columns = Math.max(2, Math.floor((HEIGHT - inset * 2 + gap) / (thickness + gap)));
    const sideStart = inset + thickness + gap;
    const sideLength = WIDTH - sideStart * 2;
    const rows = Math.max(2, Math.floor((sideLength + gap) / (thickness + gap)));
    const horizontal = (HEIGHT - inset * 2 - gap * (columns - 1)) / columns;
    const vertical = (sideLength - gap * (rows - 1)) / rows;
    for (let i = 0; i < columns; i++) {
      add(inset + i * (horizontal + gap), inset, horizontal, thickness, i === 1 ? 'slow' : 'normal');
      add(inset + i * (horizontal + gap), WIDTH - inset - thickness, horizontal, thickness);
    }
    for (let i = 0; i < rows; i++) {
      add(inset, sideStart + i * (vertical + gap), thickness, vertical);
      add(HEIGHT - inset - thickness, sideStart + i * (vertical + gap), thickness, vertical, i === Math.floor(rows / 2) ? 'fast' : 'normal');
    }
    return bricks;
  }
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
  constructor(random = Math.random, { portrait = false, scale = 1, level = 0 } = {}) {
    if (!LEVELS[level]) throw new RangeError(`Unknown level: ${level}`);
    this.levelIndex = level;
    this.level = LEVELS[level];
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
    this.cat = { x: this.width / 2, y: this.height / 2, radius: 21, vx: 0, vy: 0 };
    this.target = null;
    this.pickups = [];
    this.foodId = 0;
    this.robots = [];
    this.weapons = [];
    this.healing = [];
    this.weapon = null;
    this.nextEnemy = 0;
    this.nextWeapon = 0;
    this.nextHeart = this.level.heartCost;
    if (this.levelIndex === 1) {
      for (const brick of this.bricks) brick.kind = 'normal';
      for (let i = 0; i < 3; i++) {
        this.bricks[Math.floor(i * this.bricks.length / 3)].kind = 'slow';
        this.bricks[Math.floor((i + .5) * this.bricks.length / 3)].kind = 'fast';
      }
    }
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
    while (this.score >= this.nextHeart) {
      this.healing.push(this.randomPoint());
      this.nextHeart += this.level.heartCost;
    }
    const startX = cat.x, startY = cat.y;
    cat.x = endX; cat.y = endY;
    this.combat(dt, startX, startY);
    if (stopped) { cat.vx = 0; cat.vy = 0; this.target = null; }
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
const api = { Game, WIDTH, HEIGHT, DURATION, GOAL, SPEED, COOLDOWNS, FOODS, SCHEDULE, LEVELS, SWORDS, makeBricks, brickContact };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
} else {
  globalThis.KoshiGame = api;
}
})();
