(function () {
'use strict';
const engine = typeof module !== 'undefined' && module.exports ? require('./game.js') : globalThis.KoshiGame;
const { PORTALS, FOODS, ITEMS, SWORDS, brickShape, brickEnabled } = engine;
const FLAME = 'M0 20 C-24 16 -22 -6 -10 -12 Q-8 -2 -3 -5 Q7 -14 3 -24 C26 -7 26 16 0 20 Z';
const SAW_TEETH = Array.from({ length: 12 }, (_, i) => {
  const angle = i * Math.PI / 6, step = Math.PI / 6;
  const point = (offset, radius) => [Math.cos(angle + offset * step) * radius, Math.sin(angle + offset * step) * radius];
  return { root: point(0, 1), control: point(.2, 1.05), tip: point(.78, 1.34), end: point(1, 1) };
});
const SAW_BLADE = `M23 0 ${SAW_TEETH.map(({ control, tip, end }) =>
  `Q${control.map(n => n * 23).join(' ')} ${tip.map(n => n * 23).join(' ')} L${end.map(n => n * 23).join(' ')}`).join(' ')} Z`;
function traceSawBlade(ctx, radius, growth = 1) {
  ctx.beginPath(); ctx.moveTo(radius, 0);
  for (const { root, control, tip, end } of SAW_TEETH) {
    ctx.quadraticCurveTo(...control.map((n, i) => (root[i] + (n - root[i]) * growth) * radius),
      ...tip.map((n, i) => (end[i] + (n - end[i]) * growth) * radius));
    ctx.lineTo(...end.map(n => n * radius));
  }
  ctx.closePath();
}
const SYMBOLS = {
  heart: 'M0 16 C-32 -4 -12 -26 0 -12 C12 -26 32 -4 0 16 Z',
  mouse: 'M-12 -10 A7 7 0 1 1 -19 -17 M12 -10 A7 7 0 1 0 19 -17 M16 0 A16 16 0 1 1 -16 0 A16 16 0 1 1 16 0 M-10 -2 H-3 M3 -2 H10 M-6 9 L0 5 L6 9',
  wheel: 'M19 0 A19 19 0 1 1 -19 0 A19 19 0 1 1 19 0 M12 0 A12 12 0 1 1 -12 0 A12 12 0 1 1 12 0 M-10 -2 H-3 M3 -2 H10 M0 -19 V-23 M19 0 H23 M0 19 V23 M-19 0 H-23',
  ram: 'M-12 -7 C-18 -24 -34 -22 -31 -9 C-30 -2 -23 -1 -23 -7 C-23 -13 -17 -14 -15 -7 M12 -7 C18 -24 34 -22 31 -9 C30 -2 23 -1 23 -7 C23 -13 17 -14 15 -7 M-15 -4 A15 15 0 1 1 15 -4 A15 15 0 1 1 -15 -4 M-9 -5 H-4 M4 -5 H9 M-7 6 H7 L4 11 L0 8 L-4 11 Z',
  bucket: 'M-17 -5 H17 L14 16 Q0 20 -14 16 Z M-19 -6 H19 M-13 -6 C-13 -27 13 -27 13 -6 M-10 5 A4 4 0 1 1 -10 4 M10 5 A4 4 0 1 1 10 4 M-3 13 Q0 9 3 13',
  sword: 'M0 -23 L6 -14 L4 8 H-4 L-6 -14 Z M-10 9 H10 M0 9 V22',
  S: 'M-14 -8 Q-18 7 0 19 Q18 7 14 -8 Z M-14 -8 L-4 -6 L0 -16 L4 -6 L14 -8 M-6 0 L-5 3 M5 4 L4 7',
  P: 'M0 -2 C-20 -32 -30 10 -10 12 C8 16 24 -8 12 -14 C0 -26 -14 6 0 14 C22 26 26 -8 6 -6 M-14 10 L14 -10',
  B: 'M-18 -14 Q-12 22 18 12 L20 4 Q-6 12 -12 -16 Z',
  C: 'M-18 14 V-8 L18 -18 V14 Z M-18 -8 H18 M-9 2 A3 3 0 1 0 -3 2 A3 3 0 1 0 -9 2 M7 6 A3 3 0 1 0 13 6 A3 3 0 1 0 7 6',
  L: 'M-5 4 C-30 0 -10 -28 8 -16 C26 -6 10 14 -5 4 L-12 15 Q-24 12 -18 22 Q-8 27 -7 19 Z',
  F: 'M-16 0 Q0 -20 16 0 Q0 20 -16 0 L-24 -10 V10 Z M8 -1 L8 1',
  H: 'M-20 -2 Q-18 -22 0 -22 Q18 -22 20 -2 Z M-20 4 H20 M-20 10 H20 M-18 16 H18',
  'smiley-cookie': 'M0 -21 A21 21 0 1 1 0 21 A21 21 0 1 1 0 -21 M-8 -5 A2 2 0 1 0 -8 -4 M8 -5 A2 2 0 1 0 8 -4 M-10 5 Q0 16 10 5',
  stopwatch: 'M-5 -25 H5 V-19 H-5 Z M-20 -18 H-13 L-9 -14 M20 -18 H13 L9 -14 M0 -20 A20 20 0 1 1 0 20 A20 20 0 1 1 0 -20 M0 -12 V0 L8 5',
  battery: 'M-12 -20 H12 V-16 H16 V17 H-16 V-16 H-12 Z M-7 -8 L0 -1 L-5 5 L7 -5 L1 -6 L5 -12',
  'music-box': 'M-20 -8 H12 L20 -13 V13 L12 18 H-20 Z M-16 -12 H15 V-8 H-16 Z M12 -8 L20 -13 V-10 L12 -5 Z M20 1 H25 M25 -2 A3 3 0 1 1 25 4 M-2 -3 V9 M-2 -3 L7 -6 V5 M-2 2 A5 5 0 1 1 -2 3',
  eggplant: 'M-8 -14 C4 -27 25 -11 18 5 C12 20 -6 22 -17 10 C-28 -3 -17 -19 -7 -16 L-14 -24 L-4 -21 L0 -28 L4 -19 L15 -22 L8 -14',
  'saw-blade': `${SAW_BLADE} M7 0 A7 7 0 1 1 -7 0 A7 7 0 1 1 7 0`,
  'magic-sunglasses': 'M-23 -7 H-4 V2 Q-13 14 -22 2 Z M4 -7 H23 L22 2 Q13 14 4 2 Z M-4 -3 Q0 -7 4 -3 M-23 -7 L-27 -11 M23 -7 L27 -11',
  'ditto-stamp': 'M-20 16 H20 V23 H-20 Z M-20 3 H20 Q22 3 22 5 V14 Q22 16 20 16 H-20 Q-22 16 -22 14 V5 Q-22 3 -20 3 Z M-5 -8 C-18 -12 -15 -28 0 -28 C15 -28 18 -12 5 -8 L8 3 Q0 6 -8 3 Z M-18 9 C-7 5 3 13 18 8 M-15 13 C-6 10 5 15 14 12',
  'spooky-mask': 'M-16 -12 Q-26 -25 -20 -30 L-7 -17 M16 -12 Q26 -25 20 -30 L7 -17 M-16 -8 L-24 -12 Q-25 0 -19 4 Z M16 -8 L24 -12 Q25 0 19 4 Z M-17 -10 Q-23 -5 -20 4 Q-14 23 0 25 Q14 23 20 4 Q23 -5 17 -10 Q0 -25 -17 -10 Z M-15 -8 L-3 -3 L-13 0 Z M15 -8 L3 -3 L13 0 Z M0 -3 L-4 7 L4 7 Z M-13 9 L-9 17 L-5 10 L0 19 L5 10 L9 17 L13 9 Z',
};

function spawnSymbol(spawn) {
  return SYMBOLS[spawn.kind === 'weapon' ? 'sword' : spawn.kind === 'heart' ? 'heart'
    : spawn.kind === 'item' && ITEMS[spawn.type]?.seconds ? 'stopwatch' : spawn.type];
}
function spawnColor(spawn) {
  if (spawn.kind === 'weapon') return SWORDS[spawn.type].color;
  if (spawn.kind === 'heart') return '#e47990';
  if (spawn.kind === 'enemy') return spawn.type === 'bucket' ? '#c9bd76' : '#a3b3c2';
  if (spawn.kind === 'item') return ITEMS[spawn.type].color;
  return { S: '#db5560', P: '#bd8749', B: '#e6c654', C: '#e8b84e', L: '#c9966c', F: '#73b9cf', H: '#ca9a53' }[spawn.type];
}
function specialLabel(brick) {
  const spawn = brick.spawner;
  const spawnName = spawn?.kind === 'food' ? FOODS[spawn.type].name
    : spawn?.kind === 'weapon' ? SWORDS[spawn.type].name
      : spawn?.kind === 'item' ? ITEMS[spawn.type].name
        : spawn?.type;
  return `${brick.portal ? `, ${brick.portal} portal: paired teleport` : ''}${brick.toggle ? `, Toggle: ${brick.toggle} clicks, ${brick.toggleRemaining} more until enabled` : ''}${spawn ? `, Spawning: ${spawnName}${brick.spawned ? ', already used' : ', once on contact'}` : ''}${brick.boost ? ', Boost: double-speed fiery launch from rest' : ''}`;
}
function svgNode(tag, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}
function brickInfoBounds(brick, members) {
  const shape = brickShape(members);
  const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2;
  if (members.some(part => cx >= part.x && cx <= part.x + part.w && cy >= part.y && cy <= part.y + part.h)) {
    return { x: cx - brick.w / 2, y: cy - brick.h / 2, w: brick.w, h: brick.h };
  }
  // A corner union's bounding-box center can be empty arena, not brick.
  const anchors = members.map(part => {
    const inset = Math.min(part.w, part.h) / 2;
    return { x: Math.max(part.x + inset, Math.min(part.x + part.w - inset, cx)),
      y: Math.max(part.y + inset, Math.min(part.y + part.h - inset, cy)) };
  });
  const center = anchors.reduce((best, point) => Math.hypot(point.x - cx, point.y - cy) < Math.hypot(best.x - cx, best.y - cy) ? point : best);
  return { x: center.x - brick.w / 2, y: center.y - brick.h / 2, w: brick.w, h: brick.h };
}
function decorateBrick(button, brick, members) {
  let cloud = null, knob = null, count = null, symbol = null, crumblerCount = null, warpCount = null;
  const shape = brickShape(members, Boolean(brick.crumbler));
  const infoBounds = brickInfoBounds(brick, members);
  const vertical = brick.h > brick.w;
  if (brick.kind === 'cinder') {
    const block = svgNode('svg', { class: 'brick-cinder', viewBox: vertical ? '0 0 58 100' : '0 0 100 58', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    if (members.length > 1) block.style.clipPath = shape.clipPath;
    const face = svgNode('g', vertical ? { transform: 'translate(58 0) rotate(90)' } : {});
    face.append(svgNode('rect', { x: 1, y: 1, width: 98, height: 56, rx: 3, fill: '#969b99', stroke: '#404946', 'stroke-width': 2 }));
    face.append(svgNode('path', { d: 'M4 53 V4 H96 M7 8 H93', fill: 'none', stroke: '#c1c5bf', 'stroke-width': 2 }));
    for (const x of [13, 56]) {
      face.append(svgNode('rect', { x, y: 12, width: 31, height: 33, rx: 2, fill: '#343d3a', stroke: '#717a75', 'stroke-width': 3 }));
      face.append(svgNode('path', { d: `M${x + 3} 42 V16 H${x + 28}`, fill: 'none', stroke: '#202b27', 'stroke-width': 3 }));
    }
    face.append(svgNode('path', { d: 'M7 22h2 M48 16h3 M48 38h2 M89 29h3 M21 51h3 M66 7h2 M74 51h3', fill: 'none', stroke: '#626c65', 'stroke-width': 1.5 }));
    if (members.length > 1) {
      const concrete = svgNode('svg', { class: 'brick-cinder', viewBox: '0 0 1 1', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
      concrete.append(svgNode('path', { d: shape.roundedPath, fill: '#969b99', stroke: '#404946', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
      for (const part of members.filter(part => part.sourceId !== undefined)) {
        const tile = svgNode('svg', { x: (part.x - shape.x) / shape.w, y: (part.y - shape.y) / shape.h,
          width: part.w / shape.w, height: part.h / shape.h, viewBox: part.h > part.w ? '0 0 58 100' : '0 0 100 58', preserveAspectRatio: 'none' });
        const detail = svgNode('g', part.h > part.w ? { transform: 'translate(58 0) rotate(90)' } : {});
        for (const x of [13, 56]) detail.append(svgNode('rect', { x, y: 12, width: 31, height: 33, rx: 2, fill: '#343d3a', stroke: '#717a75', 'stroke-width': 3 }));
        tile.append(detail); concrete.append(tile);
      }
      button.append(concrete);
    } else {
      block.append(face); button.append(block);
    }
  }
  button.dataset.specialVertical = String(vertical);
  const slots = [brick.spawner || brick.boost ? 'symbol' : null, brick.crumbler ? 'crumbler' : null,
    brick.warped ? 'warped' : null, brick.toggle ? 'toggle' : null].filter(Boolean);
  const length = slots.reduce((total, slot) => total + (slot === 'toggle' ? 94 : 64), 0);
  const stacked = !vertical && brick.w / brick.h < 2 && brick.toggle && slots.length > 2;
  const rows = slots.length - 1;
  const info = slots.length ? svgNode('svg', { class: 'brick-info', viewBox: stacked ? `0 0 158 ${58 * rows}` : vertical ? `0 0 58 ${length}` : `0 0 ${length} 58`, 'aria-hidden': 'true' }) : null;
  if (info) {
    info.style.cssText = `left:${(infoBounds.x - shape.x) / shape.w * 100}%;top:${(infoBounds.y - shape.y) / shape.h * 100}%;width:${infoBounds.w / shape.w * 100}%;height:${infoBounds.h / shape.h * 100}%;`;
    button.append(info);
  }
  let offset = 0;
  const place = (node, slot) => {
    const size = slot === 'toggle' ? 94 : 64;
    for (const [name, value] of Object.entries(stacked
      ? slot === 'toggle' ? { x: 64, y: 0, width: 94, height: 58 * rows } : { x: 0, y: offset, width: 64, height: 58 }
      : vertical
      ? { x: 0, y: offset, width: 58, height: size }
      : { x: offset, y: 0, width: size, height: 58 })) node.setAttribute(name, value);
    info.append(node); offset += stacked ? 58 : size;
  };
  if (brick.portal) {
    cloud = svgNode('svg', { class: 'brick-portal-cloud', viewBox: `0 0 ${shape.w} ${shape.h}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    cloud.style.color = PORTALS[brick.portal];
    const path = shape.path.replace(/([ML])([-\d.e+]+) ([-\d.e+]+)/g, (_, command, x, y) =>
      `${command}${Number(x) * shape.w} ${Number(y) * shape.h}`);
    for (const layer of ['haze', 'puffs']) {
      cloud.append(svgNode('path', { class: `portal-${layer}`, d: path, 'vector-effect': 'non-scaling-stroke' }));
    }
    button.append(cloud);
  }
  if (brick.spawner || brick.boost) {
    symbol = svgNode('svg', { class: `brick-item-symbol${brick.boost ? ' brick-boost-symbol' : ''}`, viewBox: '-28 -28 56 56', 'aria-hidden': 'true' });
    const d = brick.boost ? FLAME : spawnSymbol(brick.spawner);
    if (brick.spawner) {
      symbol.style.setProperty('--item-color', spawnColor(brick.spawner));
      symbol.append(svgNode('path', { class: 'item-outline', d }));
    }
    symbol.append(svgNode('path', { class: 'item-color', d, ...(brick.boost ? { fill: '#f58428', stroke: '#17212a', 'stroke-width': 3 } : {}) }));
    place(symbol, 'symbol');
  }
  for (const attribute of ['crumbler', 'warped']) {
    if (!brick[attribute]) continue;
    const badge = svgNode('svg', { class: 'brick-number-badge', viewBox: '0 0 64 58' });
    badge.append(svgNode('rect', { x: 2, y: 7, width: 60, height: 44, rx: 6, fill: '#111d25', 'fill-opacity': .9 }));
    const text = svgNode('text', { x: 32, y: 36, 'text-anchor': 'middle', fill: 'white', 'font-size': 24, 'font-weight': 'bold' });
    badge.append(text); place(badge, attribute);
    if (attribute === 'crumbler') crumblerCount = text; else warpCount = text;
  }
  if (brick.toggle) {
    const toggle = svgNode('svg', { class: 'brick-toggle', viewBox: vertical ? '-3 -3 58 94' : '-3 -3 94 58', 'aria-hidden': 'true' });
    toggle.style.color = { 1: PORTALS.red, 2: PORTALS.green, 4: PORTALS.blue }[brick.toggle];
    const group = svgNode('g', vertical ? { transform: 'translate(52 0) rotate(90)' } : {});
    group.append(svgNode('rect', { x: 0, y: 0, width: 88, height: 52, rx: 26, fill: 'currentColor', stroke: '#19252d', 'stroke-width': 5 }));
    knob = svgNode('circle', { cy: 26, r: 21, fill: 'white' });
    count = svgNode('text', { y: 36, 'text-anchor': 'middle', fill: '#19252d', 'font-size': 32, 'font-weight': 'bold' });
    group.append(knob, count);
    toggle.append(group);
    place(toggle, 'toggle');
  }
  const visual = { button, cloud, knob, count, symbol, vertical, info, infoBounds, crumblerCount, warpCount };
  updateBrick(visual, brick, 0);
  return visual;
}
function updateBrick(visual, brick, elapsed, sunglassesActive = false) {
  const enabled = sunglassesActive || brickEnabled(brick);
  visual.button.dataset.toggleDisabled = String(!enabled);
  if (visual.cloud) {
    // Moving dashes jump at the closed outline's seam; breathe the fixed mist instead.
    visual.cloud.querySelector('.portal-puffs').style.opacity = String(.7 + Math.sin(elapsed * 1.5) * .1);
  }
  if (visual.knob) {
    const x = enabled ? 62 : 26;
    visual.knob.setAttribute('cx', x);
    visual.count.setAttribute('x', x);
    visual.count.textContent = String(sunglassesActive ? 0 : brick.toggleRemaining);
    if (visual.vertical) visual.count.setAttribute('transform', `rotate(-90 ${x} 26)`);
  }
  if (visual.symbol) {
    visual.symbol.dataset.spawnReady = String(Boolean(brick.spawner && !brick.spawned));
    visual.symbol.style.opacity = brick.boost ? '.8' : '1';
    if (brick.spawner?.type === 'magic-sunglasses') visual.symbol.style.setProperty('--item-color', `hsl(${elapsed * 140 % 360}, 85%, 70%)`);
  }
  if (visual.crumblerCount) visual.crumblerCount.textContent = `C:${brick.usesLeft ?? brick.crumbler}`;
  if (visual.warpCount) {
    const seconds = brick.warpUntil == null ? brick.warped : Math.max(0, Math.ceil(brick.warpUntil - elapsed - 1e-9));
    visual.warpCount.textContent = `W:${brick.usesLeft === 0 ? 'X' : seconds}`;
  }
  for (const text of [visual.crumblerCount, visual.warpCount]) {
    if (text) text.setAttribute('font-size', Math.min(28, 120 / text.textContent.length));
  }
}
function exposeBrickInfo(visual, container, brick, width, height) {
  if (!visual.info) return;
  const bounds = visual.infoBounds;
  visual.info.style.cssText = `left:${bounds.x / width * 100}%;top:${bounds.y / height * 100}%;width:${bounds.w / width * 100}%;height:${bounds.h / height * 100}%;`;
  visual.info.dataset.id = brick.id;
  container.append(visual.info);
}
function exposePortalCloud(visual, container) {
  if (!visual.cloud) return;
  for (const property of ['left', 'top', 'width', 'height']) visual.cloud.style[property] = visual.button.style[property];
  visual.cloud.style.right = 'auto'; visual.cloud.style.bottom = 'auto';
  container.append(visual.cloud);
}
function drawBoost(ctx, x, y, time) {
  ctx.save(); ctx.translate(x, y);
  ctx.rotate(Math.sin(time * 14) * .08);
  const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 42);
  glow.addColorStop(0, '#ffe28444'); glow.addColorStop(.6, '#ff813088'); glow.addColorStop(1, '#ff4c1400');
  ctx.fillStyle = glow; ctx.fillRect(-42, -42, 84, 84);
  ctx.strokeStyle = '#ffae44'; ctx.lineWidth = 3;
  ctx.stroke(new Path2D(FLAME));
  ctx.restore();
}
const api = { FLAME, traceSawBlade, spawnSymbol, spawnColor, specialLabel, brickInfoBounds, decorateBrick, updateBrick, exposePortalCloud, exposeBrickInfo, drawBoost };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.KoshiBrickVisuals = api;
})();
