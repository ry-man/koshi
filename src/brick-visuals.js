(function () {
'use strict';
const engine = typeof module !== 'undefined' && module.exports ? require('./game.js') : globalThis.KoshiGame;
const { PORTALS, FOODS, SWORDS, brickShape, brickEnabled } = engine;
const FLAME = 'M0 20 C-24 16 -22 -6 -10 -12 Q-8 -2 -3 -5 Q7 -14 3 -24 C26 -7 26 16 0 20 Z';
const SYMBOLS = {
  heart: 'M0 16 C-32 -4 -12 -26 0 -12 C12 -26 32 -4 0 16 Z',
  mouse: 'M-12 -10 A7 7 0 1 1 -19 -17 M12 -10 A7 7 0 1 0 19 -17 M16 0 A16 16 0 1 1 -16 0 A16 16 0 1 1 16 0 M-10 -2 H-3 M3 -2 H10 M-6 9 L0 5 L6 9',
  wheel: 'M19 0 A19 19 0 1 1 -19 0 A19 19 0 1 1 19 0 M12 0 A12 12 0 1 1 -12 0 A12 12 0 1 1 12 0 M-10 -2 H-3 M3 -2 H10 M0 -19 V-23 M19 0 H23 M0 19 V23 M-19 0 H-23',
  sword: 'M0 -23 L6 -14 L4 8 H-4 L-6 -14 Z M-10 9 H10 M0 9 V22',
  S: 'M-14 -8 Q-18 7 0 19 Q18 7 14 -8 Z M-14 -8 L-4 -6 L0 -16 L4 -6 L14 -8 M-6 0 L-5 3 M5 4 L4 7',
  P: 'M0 -2 C-20 -32 -30 10 -10 12 C8 16 24 -8 12 -14 C0 -26 -14 6 0 14 C22 26 26 -8 6 -6 M-14 10 L14 -10',
  B: 'M-18 -14 Q-12 22 18 12 L20 4 Q-6 12 -12 -16 Z',
  C: 'M-18 14 V-8 L18 -18 V14 Z M-18 -8 H18 M-9 2 A3 3 0 1 0 -3 2 A3 3 0 1 0 -9 2 M7 6 A3 3 0 1 0 13 6 A3 3 0 1 0 7 6',
  L: 'M-5 4 C-30 0 -10 -28 8 -16 C26 -6 10 14 -5 4 L-12 15 Q-24 12 -18 22 Q-8 27 -7 19 Z',
  F: 'M-16 0 Q0 -20 16 0 Q0 20 -16 0 L-24 -10 V10 Z M8 -1 L8 1',
  H: 'M-20 -2 Q-18 -22 0 -22 Q18 -22 20 -2 Z M-20 4 H20 M-20 10 H20 M-18 16 H18',
};

function spawnSymbol(spawn) { return SYMBOLS[spawn.kind === 'weapon' ? 'sword' : spawn.kind === 'heart' ? 'heart' : spawn.type]; }
function spawnColor(spawn) {
  if (spawn.kind === 'weapon') return SWORDS[spawn.type].color;
  if (spawn.kind === 'heart') return '#e47990';
  if (spawn.kind === 'enemy') return '#a3b3c2';
  return { S: '#db5560', P: '#bd8749', B: '#e6c654', C: '#e8b84e', L: '#c9966c', F: '#73b9cf', H: '#ca9a53' }[spawn.type];
}
function specialLabel(brick) {
  return `${brick.portal ? `, ${brick.portal} portal: paired teleport` : ''}${brick.toggle ? `, Toggle: ${brick.toggle} clicks, ${brick.toggleRemaining} more until enabled` : ''}${brick.spawner ? `, Spawning: ${brick.spawner.kind === 'food' ? FOODS[brick.spawner.type].name : brick.spawner.kind === 'weapon' ? SWORDS[brick.spawner.type].name : brick.spawner.type}${brick.spawned ? ', already used' : ', once on contact'}` : ''}${brick.boost ? ', Boost: double-speed fiery launch from rest' : ''}`;
}
function svgNode(tag, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}
function decorateBrick(button, brick, members) {
  let cloud = null, knob = null, count = null, symbol = null, crumblerCount = null, warpCount = null;
  const shape = brickShape(members, Boolean(brick.crumbler));
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
      concrete.append(svgNode('path', { d: shape.path, fill: '#969b99', stroke: '#404946', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
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
    info.style.cssText = `left:${(brick.x - shape.x) / shape.w * 100}%;top:${(brick.y - shape.y) / shape.h * 100}%;width:${brick.w / shape.w * 100}%;height:${brick.h / shape.h * 100}%;`;
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
  const visual = { button, cloud, knob, count, symbol, vertical, info, crumblerCount, warpCount };
  updateBrick(visual, brick, 0);
  return visual;
}
function updateBrick(visual, brick, elapsed) {
  const enabled = brickEnabled(brick);
  visual.button.dataset.toggleDisabled = String(!enabled);
  if (visual.cloud) {
    visual.cloud.style.opacity = enabled ? '1' : '.2';
    // Moving dashes jump at the closed outline's seam; breathe the fixed mist instead.
    visual.cloud.querySelector('.portal-puffs').style.opacity = String(.7 + Math.sin(elapsed * 1.5) * .1);
  }
  if (visual.knob) {
    const x = enabled ? 62 : 26;
    visual.knob.setAttribute('cx', x);
    visual.count.setAttribute('x', x);
    visual.count.textContent = String(brick.toggleRemaining);
    if (visual.vertical) visual.count.setAttribute('transform', `rotate(-90 ${x} 26)`);
  }
  if (visual.symbol) {
    visual.symbol.dataset.spawnReady = String(Boolean(brick.spawner && !brick.spawned));
    visual.symbol.style.opacity = brick.boost ? enabled ? '.8' : '.2' : enabled ? '1' : '.75';
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
  visual.info.style.cssText = `left:${brick.x / width * 100}%;top:${brick.y / height * 100}%;width:${brick.w / width * 100}%;height:${brick.h / height * 100}%;`;
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
const api = { FLAME, spawnSymbol, spawnColor, specialLabel, decorateBrick, updateBrick, exposePortalCloud, exposeBrickInfo, drawBoost };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.KoshiBrickVisuals = api;
})();
