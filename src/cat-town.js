(function () {
'use strict';

const LOCATIONS = [
  { id: 'mall', name: 'Cat Mall', x: 50, y: 20, companion: 'Whiskers' },
  { id: 'house', name: "Koshi's House", x: 80, y: 50, companion: null },
  { id: 'tree', name: 'Cat Tree', x: 50, y: 80, companion: 'Bruiser' },
  { id: 'tank', name: 'Fish Tank', x: 20, y: 50, companion: 'Eugene' },
];

const TOWN_ITEMS = [
  { id: 'yarn-basket', name: 'Yarn basket', description: 'A basket of soft yarn in bright colors.', cost: 2 },
  { id: 'catnip-plant', name: 'Catnip plant', description: 'A cheerful potted catnip plant for a sunny corner.', cost: 2 },
  { id: 'star-lamp', name: 'Star lamp', description: 'A little lamp shaped like a shining gold star.', cost: 2 },
  { id: 'mouse-plush', name: 'Mouse plush', description: 'A soft toy mouse with a tiny stitched smile.', cost: 2 },
  { id: 'shell-clock', name: 'Shell clock', description: 'A blue seaside clock with a shell-shaped frame.', cost: 2 },
  { id: 'fish-poster', name: 'Fish poster', description: 'A colorful poster of Cat Town’s favorite fish.', cost: 2 },
  { id: 'scratch-post', name: 'Scratching post', description: 'A sturdy scratching post wrapped in rope.', cost: 2 },
  { id: 'flower-rug', name: 'Flower rug', description: 'A soft rug covered in bright little flowers.', cost: 2 },
];

const FISH_COLORS = [
  ['1', '#76c96a'], ['2', '#f1d65c'], ['3', '#68a9ee'], ['4', '#eea052'],
  ['5', '#eeeeee'], ['6', '#b08ae3'], ['7', '#b58a65'], ['8', '#e66c68'],
];

function townState(profile) {
  const state = profile?.catTown ?? {};
  return {
    spentStars: state.spentStars ?? 0,
    offers: [...(state.offers ?? [])],
    items: [...(state.items ?? [])],
    builtBlocks: state.builtBlocks ?? 0,
  };
}

function earnedGoldStars(profile, levels) {
  return new Set(Object.values(profile?.results ?? {})
    .filter(result => result.outcome === 'won' && result.damageFree === true)
    .map(result => result.levelId).filter(id => levels.some(level => level.id === id))).size;
}

function chooseOffers(items = TOWN_ITEMS, random = Math.random) {
  const choices = [...items];
  if (choices.length < 3) throw new Error('Cat Mall needs at least three items in its catalog.');
  const offers = [];
  while (offers.length < 3) {
    const index = Math.floor(random() * choices.length);
    if (!Number.isInteger(index) || index < 0 || index >= choices.length) {
      throw new Error('The random item selection was outside the catalog.');
    }
    offers.push(choices.splice(index, 1)[0].id);
  }
  return offers;
}

function purchaseItem(state, item, balance) {
  if (!state.offers.includes(item.id) || state.items.some(entry => entry.id === item.id)) {
    throw new Error('That prize is no longer available.');
  }
  if (balance < item.cost) throw new Error(`You need ${item.cost} unspent gold stars to buy this prize.`);
  return {
    ...state, spentStars: state.spentStars + item.cost,
    items: [...state.items, { id: item.id, name: item.name, description: item.description, cost: item.cost }],
  };
}

function buildTree(state, totalBlocks) {
  if (!Number.isSafeInteger(totalBlocks) || totalBlocks < state.builtBlocks) {
    throw new Error('Cat Tree progress cannot go backward.');
  }
  return { ...state, builtBlocks: totalBlocks };
}

function fabledFish(profile, worlds, levels) {
  return FISH_COLORS.flatMap(([id, color]) => {
    const world = worlds.find(entry => entry.id === `S${id}`);
    const worldLevels = levels.filter(level => level.worldId === world?.id);
    return world && worldLevels.length > 0 && worldLevels.every(level => profile?.completed?.includes(level.id))
      ? [{ id, color, world: world.name }] : [];
  });
}

function catPath(ctx, x, y, scale, fur, inner, stripe, glasses = false, white = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#17232c';
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.moveTo(-34, -22); ctx.lineTo(-29, -50); ctx.lineTo(-10, -37);
  ctx.quadraticCurveTo(0, -42, 10, -37); ctx.lineTo(30, -50); ctx.lineTo(34, -20);
  ctx.quadraticCurveTo(44, 0, 29, 22); ctx.quadraticCurveTo(0, 39, -29, 22);
  ctx.quadraticCurveTo(-44, 0, -34, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = inner;
  ctx.beginPath(); ctx.moveTo(-28, -39); ctx.lineTo(-25, -19); ctx.lineTo(-13, -32); ctx.fill();
  ctx.beginPath(); ctx.moveTo(28, -39); ctx.lineTo(25, -19); ctx.lineTo(13, -32); ctx.fill();
  if (white) {
    ctx.fillStyle = '#f1f0e8';
    ctx.beginPath(); ctx.ellipse(0, 20, 19, 12, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (stripe) {
    ctx.strokeStyle = stripe;
    ctx.lineWidth = 4;
    for (const offset of [-16, 0, 16]) {
      ctx.beginPath(); ctx.moveTo(offset - 5, -34); ctx.lineTo(offset, -25); ctx.stroke();
    }
  }
  ctx.fillStyle = '#202b32';
  for (const eye of [-13, 13]) {
    ctx.beginPath(); ctx.ellipse(eye, -2, 3.5, 5, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (glasses) {
    ctx.strokeStyle = '#2c3b48'; ctx.lineWidth = 3;
    for (const eye of [-13, 13]) {
      ctx.beginPath(); ctx.arc(eye, -2, 8, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(5, -2); ctx.stroke();
  }
  ctx.strokeStyle = '#f1f0e8';
  ctx.lineWidth = 2;
  for (const direction of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(direction * 22, 8); ctx.lineTo(direction * 36, 5);
    ctx.moveTo(direction * 23, 12); ctx.lineTo(direction * 38, 13);
    ctx.moveTo(direction * 21, 16); ctx.lineTo(direction * 34, 21);
    ctx.stroke();
  }
  ctx.fillStyle = '#d98e9a';
  ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(4, 8); ctx.lineTo(0, 12); ctx.fill();
  ctx.strokeStyle = '#202b32'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, 16); ctx.moveTo(0, 16); ctx.quadraticCurveTo(-7, 21, -11, 16);
  ctx.moveTo(0, 16); ctx.quadraticCurveTo(7, 21, 11, 16); ctx.stroke();
  ctx.restore();
}

function drawCat(ctx, name, x, y, scale, talking, time) {
  const characters = {
    Koshi: ['#9ca8af', '#d99aa0', '#606d75', true, false],
    Whiskers: ['#191c24', '#583b49', null, false, false, false],
    Bruiser: ['#e88934', '#e9b05d', '#a94f25', false, false, false],
    Eugene: ['#737c82', '#9ba6ab', '#4b555d', false, true],
  };
  const [fur, inner, stripe, white, glasses] = characters[name];
  const bob = talking ? Math.sin(time * 7) * 3 : 0;
  catPath(ctx, x, y + bob, scale, fur, inner, stripe, glasses, white);
}

function drawStageCat(ctx, name, x, y, scale, talking, time, drawKoshi) {
  if (name !== 'Koshi' || !drawKoshi) {
    drawCat(ctx, name, x, y, name === 'Koshi' ? scale : scale * .56, talking, time);
    return;
  }
  ctx.save();
  ctx.translate(x, y + (talking ? Math.sin(time * 6) * 3 : 0));
  ctx.scale(scale, scale);
  drawKoshi(ctx, 'koshi', time, talking);
  ctx.restore();
}

function drawPlant(ctx, x, y, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = '#a86d42'; ctx.fillRect(-15, -3, 30, 20);
  ctx.fillStyle = '#d79560'; ctx.fillRect(-18, -7, 36, 6);
  ctx.strokeStyle = '#43875a'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, -36); ctx.stroke();
  for (const [x1, y1, angle] of [[-11, -29, -.6], [12, -36, .55], [-14, -43, -.5], [14, -20, .5]]) {
    ctx.save(); ctx.translate(x1, y1); ctx.rotate(angle); ctx.fillStyle = '#68aa66';
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

function drawMall(ctx, time, speaker, drawKoshi) {
  const sky = ctx.createLinearGradient(0, 0, 0, 540);
  sky.addColorStop(0, '#c4e7e8'); sky.addColorStop(1, '#f4d8b8');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = '#f1e7d6'; ctx.fillRect(0, 65, 960, 350);
  ctx.fillStyle = '#c9b9a2'; ctx.fillRect(0, 410, 960, 130);
  for (const [x, label, color] of [[70, 'YARN & CO.', '#c47573'], [300, 'CAT COUTURE', '#6f9fa8'], [530, 'SNACKS', '#d6a64c']]) {
    ctx.fillStyle = '#65564d'; ctx.fillRect(x, 170, 190, 220);
    ctx.fillStyle = color; ctx.fillRect(x + 8, 178, 174, 44);
    ctx.fillStyle = '#fff5db'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, x + 95, 207);
    ctx.fillStyle = '#a6d0d5'; ctx.fillRect(x + 18, 236, 154, 120);
    ctx.fillStyle = '#fff9df'; ctx.fillRect(x + 28, 246, 134, 100);
    ctx.strokeStyle = '#947c68'; ctx.lineWidth = 5; ctx.strokeRect(x + 18, 236, 154, 120);
    ctx.fillStyle = '#d2b88e'; ctx.fillRect(x + 8, 360, 174, 22);
  }
  ctx.fillStyle = '#f6f1e6'; ctx.fillRect(0, 65, 960, 32);
  for (let x = 24; x < 960; x += 90) {
    ctx.fillStyle = '#fff7de'; ctx.beginPath(); ctx.ellipse(x, 80, 20, 7, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#7b8b92'; ctx.fillRect(770, 150, 125, 18);
  ctx.fillStyle = '#b7c5c6'; ctx.beginPath(); ctx.moveTo(785, 168); ctx.lineTo(865, 168);
  ctx.lineTo(925, 385); ctx.lineTo(895, 385); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#e9ece5'; ctx.lineWidth = 7;
  for (let y = 185; y < 380; y += 24) { ctx.beginPath(); ctx.moveTo(795, y); ctx.lineTo(900, y); ctx.stroke(); }
  for (const [x, y] of [[48, 390], [710, 390], [915, 405]]) drawPlant(ctx, x, y, .85);
  for (const [x, color] of [[470, '#dfb38c'], [650, '#718d86']]) {
    ctx.fillStyle = color; ctx.fillRect(x - 15, 330, 30, 48);
    ctx.fillStyle = '#f2d2b3'; ctx.beginPath(); ctx.arc(x, 315, 17, 0, Math.PI * 2); ctx.fill();
  }
  drawStageCat(ctx, 'Koshi', 385, 350, 1.18, speaker === 'Koshi', time, drawKoshi);
  drawStageCat(ctx, 'Whiskers', 570, 350, 1.18, speaker === 'Whiskers', time, drawKoshi);
}

function drawHouse(ctx, interior, items, selected, time, drawKoshi) {
  const sky = ctx.createLinearGradient(0, 0, 0, 540);
  sky.addColorStop(0, '#8bd5f1'); sky.addColorStop(1, '#f7e6a4');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = '#75bd69'; ctx.fillRect(0, 355, 960, 185);
  ctx.fillStyle = '#fff5cf'; ctx.beginPath(); ctx.arc(800, 95, 48, 0, Math.PI * 2); ctx.fill();
  if (!interior) {
    ctx.fillStyle = '#d8a66e'; ctx.fillRect(295, 220, 370, 210);
    ctx.fillStyle = '#b9544c'; ctx.beginPath(); ctx.moveTo(265, 225); ctx.lineTo(480, 85);
    ctx.lineTo(695, 225); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8ed0dc'; ctx.fillRect(335, 255, 75, 70); ctx.fillRect(550, 255, 75, 70);
    ctx.strokeStyle = '#fff1c8'; ctx.lineWidth = 7; ctx.strokeRect(335, 255, 75, 70); ctx.strokeRect(550, 255, 75, 70);
    ctx.fillStyle = '#805a47'; ctx.fillRect(440, 310, 80, 120);
    ctx.fillStyle = '#e6c286'; ctx.fillRect(455, 345, 8, 8);
    for (const x of [115, 845]) drawPlant(ctx, x, 415, 1.2);
    drawStageCat(ctx, 'Koshi', 740, 355, 1.3, true, time, drawKoshi);
    ctx.fillStyle = '#fff9df'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText("Home sweet home!", 480, 478);
    return;
  }
  ctx.fillStyle = '#eed8a8'; ctx.fillRect(85, 68, 790, 390);
  ctx.fillStyle = '#b88463'; ctx.fillRect(85, 68, 790, 28);
  ctx.fillStyle = '#8dc9d6'; ctx.fillRect(355, 105, 250, 105);
  ctx.strokeStyle = '#fff0d3'; ctx.lineWidth = 8; ctx.strokeRect(355, 105, 250, 105);
  ctx.beginPath(); ctx.moveTo(480, 105); ctx.lineTo(480, 210); ctx.moveTo(355, 158); ctx.lineTo(605, 158); ctx.stroke();
  ctx.fillStyle = '#bd8b71'; ctx.beginPath(); ctx.ellipse(480, 360, 275, 73, 0, 0, Math.PI * 2); ctx.fill();
  for (const [index, item] of items.entries()) {
    const column = index % 4, row = Math.floor(index / 4);
    const x = 260 + column * 145, y = 300 + row * 95;
    ctx.save();
    if (item.id === 'catnip-plant') drawPlant(ctx, x, y + 22, .7);
    else if (item.id === 'yarn-basket') {
      ctx.fillStyle = '#b88150'; ctx.fillRect(x - 25, y, 50, 36);
      ctx.fillStyle = '#e47977'; ctx.beginPath(); ctx.arc(x - 9, y - 4, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#719ed1'; ctx.beginPath(); ctx.arc(x + 11, y - 8, 15, 0, Math.PI * 2); ctx.fill();
    } else if (item.id === 'star-lamp') {
      ctx.fillStyle = '#f8db71'; ctx.beginPath(); ctx.arc(x, y + 4, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff3a7'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', x, y + 14);
    } else {
      const palette = { 'mouse-plush': '#a77bc1', 'shell-clock': '#78b6d2', 'fish-poster': '#e27c68', 'scratch-post': '#b68058', 'flower-rug': '#d87583' };
      ctx.fillStyle = palette[item.id] ?? '#b68058'; ctx.fillRect(x - 28, y - 20, 56, 48);
      ctx.fillStyle = '#fff0d2'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(({ 'mouse-plush': '●', 'shell-clock': '◷', 'fish-poster': '🐟', 'scratch-post': '║', 'flower-rug': '✿' })[item.id] ?? '★', x, y + 8);
    }
    if (item.id === selected) {
      ctx.strokeStyle = '#ffe26a'; ctx.lineWidth = 5; ctx.strokeRect(x - 36, y - 34, 72, 78);
    }
    ctx.restore();
  }
  ctx.fillStyle = '#26323a'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(items.length ? 'Koshi’s collection' : 'A cozy room, waiting for treasures', 480, 480);
}

function drawCatTree(ctx, time, progress, speaker, drawKoshi) {
  const sky = ctx.createLinearGradient(0, 0, 0, 540);
  sky.addColorStop(0, '#9de0ef'); sky.addColorStop(1, '#dff4bd');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = '#75bf66'; ctx.fillRect(0, 440, 960, 100);
  ctx.fillStyle = '#fff1be'; ctx.beginPath(); ctx.arc(820, 85, 42, 0, Math.PI * 2); ctx.fill();
  const shown = Math.max(0, progress);
  const height = 120 + shown * 36;
  const bottom = 445;
  const top = bottom - height;
  ctx.strokeStyle = '#87969a'; ctx.lineWidth = 12; ctx.lineCap = 'round';
  for (const x of [330, 390, 450, 510, 570, 630]) {
    ctx.beginPath(); ctx.moveTo(x, bottom); ctx.lineTo(x, top); ctx.stroke();
    ctx.strokeStyle = '#a8b2b1'; ctx.lineWidth = 2;
    for (let y = bottom - 12; y > top; y -= 18) {
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y - 9); ctx.stroke();
    }
    ctx.strokeStyle = '#87969a'; ctx.lineWidth = 12;
  }
  for (let level = 0; level <= shown; level++) {
    const y = bottom - 58 - level * 36, built = level < shown;
    const color = built ? '#c69a68' : '#c7d0cf';
    const platforms = level % 2
      ? [[305, 125], [405, 205], [575, 90]]
      : [[305, 90], [385, 205], [550, 125]];
    for (const [x, width] of platforms) {
      ctx.fillStyle = color; ctx.fillRect(x, y, width, 18);
      ctx.strokeStyle = built ? '#805d46' : '#87969a'; ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, 18);
    }
    for (const [x, bed] of [[350, true], [470, false], [625, true]]) {
      ctx.fillStyle = built ? '#dcb58a' : '#d8dfdf';
      ctx.beginPath();
      if (bed) ctx.ellipse(x, y - 9, 34, 17, 0, Math.PI, 0);
      else ctx.rect(x - 24, y - 20, 48, 20);
      ctx.fill();
      ctx.strokeStyle = built ? '#805d46' : '#87969a'; ctx.lineWidth = 3; ctx.stroke();
    }
  }
  for (const x of [330, 630]) {
    ctx.fillStyle = '#a17c5c'; ctx.fillRect(x - 15, bottom - 17, 30, 18);
  }
  if (shown) {
    ctx.fillStyle = '#ffffffcc'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`Cat Tree · ${shown} ${shown === 1 ? 'block' : 'blocks'} built`, 480, 48);
  } else {
    ctx.fillStyle = '#42534a'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('An enormous cat tree is waiting to grow', 480, 48);
  }
  ctx.fillStyle = '#42534a'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('↑', 480, Math.max(35, top - 8));
  drawStageCat(ctx, 'Koshi', 190, 360, 1.1, speaker === 'Koshi', time, drawKoshi);
  drawStageCat(ctx, 'Bruiser', 760, 360, 1.1, speaker === 'Bruiser', time, drawKoshi);
}

function drawTank(ctx, time, fish, speaker, drawKoshi) {
  ctx.fillStyle = '#b8e3ee'; ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = '#527a91'; ctx.fillRect(70, 38, 820, 440);
  const water = ctx.createLinearGradient(0, 55, 0, 465);
  water.addColorStop(0, '#65c9df'); water.addColorStop(1, '#14527a');
  ctx.fillStyle = water; ctx.fillRect(84, 52, 792, 412);
  ctx.strokeStyle = '#d9f4f4'; ctx.lineWidth = 10; ctx.strokeRect(70, 38, 820, 440);
  ctx.fillStyle = '#d6c29a'; ctx.fillRect(84, 410, 792, 54);
  for (const x of [165, 710, 825]) {
    ctx.fillStyle = '#df7968'; ctx.beginPath(); ctx.ellipse(x, 411, 48, 22, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#e69778'; ctx.fillRect(x - 8, 365, 16, 48);
  }
  for (const x of [270, 320, 615]) {
    ctx.strokeStyle = '#56a879'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x, 418);
    ctx.bezierCurveTo(x - 28, 360, x + 25, 318, x, 270); ctx.stroke();
    ctx.fillStyle = '#56a879'; ctx.beginPath(); ctx.ellipse(x - 15, 330, 10, 25, -.5, 0, Math.PI * 2);
    ctx.ellipse(x + 13, 360, 10, 22, .5, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 13; i++) {
    const x = 125 + (i * 73) % 700, y = 400 - (time * 24 + i * 31) % 360;
    ctx.strokeStyle = '#d5faff99'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 4 + i % 4, 0, Math.PI * 2); ctx.stroke();
  }
  const allFish = [{ color: '#ffc85b', name: 'Goldfish', id: 'gold-1' }, { color: '#ff986c', name: 'Goldfish', id: 'gold-2' }, ...fish];
  allFish.forEach((entry, index) => {
    const x = 190 + (index * 173 + Math.sin(time * .7 + index) * 42 + 760) % 650;
    const y = 140 + (index * 71) % 210 + Math.sin(time * 1.5 + index) * 12;
    const scale = index < 2 ? .72 : .95;
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.fillStyle = entry.color; ctx.beginPath(); ctx.ellipse(0, 0, 27, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(-43, -14); ctx.lineTo(-43, 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#203b4d'; ctx.beginPath(); ctx.arc(15, -4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  drawStageCat(ctx, 'Koshi', 145, 360, 1, speaker === 'Koshi', time, drawKoshi);
  drawStageCat(ctx, 'Eugene', 850, 360, .9, speaker === 'Eugene', time, drawKoshi);
}

class CatTown {
  constructor({ profile, saveProfile, levels, worlds, onReturn, drawKoshi }) {
    this.profile = profile;
    this.saveProfile = saveProfile;
    this.levels = levels;
    this.worlds = worlds;
    this.onReturn = onReturn;
    this.drawKoshi = drawKoshi;
    this.dialog = document.querySelector('#cat-town-scene');
    this.canvas = document.querySelector('#cat-town-stage');
    this.ctx = this.canvas.getContext('2d');
    this.portrait = document.querySelector('#cat-town-portrait');
    this.heading = document.querySelector('#cat-town-heading');
    this.speaker = document.querySelector('#cat-town-speaker');
    this.transcript = document.querySelector('#cat-town-transcript');
    this.resources = document.querySelector('#cat-town-resources');
    this.text = document.querySelector('#cat-town-text');
    this.next = document.querySelector('#cat-town-next');
    this.actions = document.querySelector('#cat-town-actions');
    this.menu = document.querySelector('#cat-town-menu');
    this.error = document.querySelector('#cat-town-error');
    this.houseItems = document.querySelector('#cat-town-house-items');
    this.location = null;
    this.menuOpen = false;
    this.houseInterior = false;
    this.selectedItem = null;
    this.dialogueText = '';
    this.dialogueSpeaker = '';
    this.visibleCharacters = 0;
    this.revealed = false;
    this.typingStarted = 0;
    this.treeProgress = 0;
    this.treeAnimation = null;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.leave(); });
    document.querySelector('#cat-town-leave').addEventListener('click', () => this.leave());
    this.next.addEventListener('click', () => {
      this.revealed = true;
      this.visibleCharacters = this.dialogueText.length;
      this.updateDialogue();
    });
    this.canvas.addEventListener('click', event => this.selectCanvasItem(event));
    new ResizeObserver(() => this.draw()).observe(this.canvas);
    document.addEventListener('visibilitychange', () => { if (this.dialog.open) this.draw(); });
    this.frame = this.frame.bind(this);
  }
  get active() { return this.dialog.open; }
  open(locationId) {
    const location = LOCATIONS.find(entry => entry.id === locationId);
    if (!location) throw new Error(`Unknown Cat Town location: ${locationId}`);
    this.location = location;
    this.menuOpen = false;
    this.houseInterior = false;
    this.selectedItem = null;
    this.error.textContent = '';
    this.error.hidden = true;
    this.dialogueText = '';
    this.dialogueSpeaker = '';
    this.revealed = false;
    this.dialog.showModal();
    this.dialog.classList.add('cat-town-active');
    this.prepareLocation();
    this.render();
    this.dialog.querySelector('#cat-town-leave').focus({ preventScroll: true });
    requestAnimationFrame(this.frame);
  }
  leave() {
    if (!this.active) return;
    this.dialog.close();
    this.dialog.classList.remove('cat-town-active');
    this.onReturn();
  }
  state() { return townState(this.profile()); }
  commit(state) {
    try {
      const updated = this.saveProfile(state);
      if (!updated) {
        this.showError('Progress could not be saved. Return to Cat Town and retry before leaving.');
        return false;
      }
      this.error.textContent = '';
      this.error.hidden = true;
      this.render();
      return true;
    } catch (error) {
      console.error('Cat Town progress:', error);
      this.error.textContent = `Progress could not be saved: ${error.message}`;
      this.error.hidden = false;
      return false;
    }
  }
  prepareLocation() {
    const profile = this.profile();
    if (this.location.id === 'mall') {
      let state = townState(profile);
      if (!state.offers.length) {
        state = { ...state, offers: chooseOffers() };
        this.commit(state);
      }
    } else if (this.location.id === 'tree') {
      const state = townState(profile);
      const total = profile?.catBlocks?.length ?? 0;
      this.treeProgress = state.builtBlocks;
      if (total > state.builtBlocks) {
        this.treeAnimation = { from: state.builtBlocks, to: total, start: performance.now() };
        if (this.commit(buildTree(state, total))) this.treeProgress = state.builtBlocks;
      } else {
        this.treeProgress = total;
        this.treeAnimation = null;
      }
    }
  }
  render() {
    const profile = this.profile(), state = townState(profile);
    const stars = earnedGoldStars(profile, this.levels);
    const availableStars = Math.max(0, stars - state.spentStars);
    const unbuiltBlocks = Math.max(0, (profile?.catBlocks?.length ?? 0) - state.builtBlocks);
    this.heading.textContent = this.location.name;
    this.resources.hidden = !['mall', 'tree'].includes(this.location.id);
    this.resources.textContent = this.location.id === 'mall'
      ? `${stars} gold stars earned · ${state.spentStars} spent · ${availableStars} unspent`
      : `${profile?.catBlocks?.length ?? 0} Cat Blocks found · ${state.builtBlocks} built · ${unbuiltBlocks} unbuilt`;
    this.menu.hidden = !this.menuOpen;
    this.error.hidden = this.error.textContent === '';
    this.houseItems.replaceChildren();
    if (this.location.id === 'mall') {
      this.setDialogue(this.menuOpen ? 'Whiskers' : 'Koshi', this.menuOpen
        ? 'Pick a prize for two stars.'
        : 'It’s a lovely day to shop! Whiskers has some prizes to show me.');
      this.renderShop(state, availableStars);
      this.setActions(this.menuOpen ? [] : [['Browse items for sale', () => { this.menuOpen = true; this.render(); }]]);
    } else if (this.location.id === 'house') {
      if (!this.houseInterior) {
        this.setDialogue('Koshi', 'It’s nice to be home! I wonder where my new treasures will fit.');
        this.setActions([['Go inside', () => { this.houseInterior = true; this.selectedItem = null; this.render(); }]]);
      } else {
        const selected = state.items.find(item => item.id === this.selectedItem);
        const text = selected
          ? `${selected.name}: ${selected.description} It cost ${selected.cost} gold stars at the mall.`
          : state.items.length ? 'My collection! Touch or choose an object to see what it is and how many stars it cost.'
            : 'It’s a cozy room, ready for treasures from the Cat Mall.';
        this.setDialogue('Koshi', text);
        this.renderHomeItems(state.items);
        this.setActions([['Step outside', () => { this.houseInterior = false; this.render(); }]]);
      }
    } else if (this.location.id === 'tree') {
      const text = unbuiltBlocks
        ? `Welcome, Koshi! Cat Blocks make the tree grow. I’ve added ${unbuiltBlocks} new ${unbuiltBlocks === 1 ? 'block' : 'blocks'} since your last visit.`
        : `Welcome back, Koshi! Your cat tree has ${state.builtBlocks} ${state.builtBlocks === 1 ? 'block' : 'blocks'} built. New beds will bring new features someday!`;
      this.setDialogue('Bruiser', text);
      this.setActions([]);
    } else {
      const fish = fabledFish(profile, this.worlds, this.levels);
      const text = fish.length
        ? `Welcome! Every Fabled Fish you’ve earned is swimming here. You’ve found ${fish.length} of 8.`
        : 'Welcome! This tank will display the Fabled Fish you earn by completing special worlds.';
      this.setDialogue('Eugene', text);
      this.setActions([]);
    }
    this.draw();
  }
  setDialogue(speaker, text) {
    if (this.dialogueSpeaker !== speaker || this.dialogueText !== text) {
      this.dialogueSpeaker = speaker;
      this.dialogueText = text;
      this.visibleCharacters = 0;
      this.revealed = false;
      this.typingStarted = performance.now();
      this.speaker.textContent = speaker;
      this.transcript.textContent = `${speaker}: ${text}`;
    }
    this.updateDialogue();
  }
  updateDialogue(timestamp = performance.now()) {
    if (!this.revealed && this.visibleCharacters < this.dialogueText.length) {
      this.visibleCharacters = Math.min(this.dialogueText.length,
        Math.floor(Math.max(0, timestamp - this.typingStarted) / 30));
    }
    this.text.textContent = this.dialogueText.slice(0, this.visibleCharacters);
    this.next.textContent = this.visibleCharacters < this.dialogueText.length ? 'Reveal text' : 'Continue';
    const portraits = { Koshi: 'koshi', Whiskers: 'whiskers', Bruiser: 'bruiser', Eugene: 'eugene' };
    globalThis.KoshiCutscenePlayer.drawPortrait(this.portrait.getContext('2d'),
      portraits[this.dialogueSpeaker], this.visibleCharacters < this.dialogueText.length,
      (timestamp - this.typingStarted) / 1000);
  }
  setActions(entries) {
    this.actions.replaceChildren();
    for (const [label, action, className = ''] of entries) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = className; button.textContent = label;
      button.addEventListener('click', action);
      this.actions.append(button);
    }
  }
  renderShop(state, balance) {
    this.menu.replaceChildren();
    if (!this.menuOpen) return;
    const heading = document.createElement('h3');
    heading.textContent = 'Whiskers’ prize counter';
    this.menu.append(heading);
    for (const id of state.offers) {
      const item = TOWN_ITEMS.find(entry => entry.id === id);
      if (!item) continue;
      const owned = state.items.some(entry => entry.id === item.id);
      const row = document.createElement('div'), detail = document.createElement('p'), button = document.createElement('button');
      row.className = 'cat-town-offer';
      detail.textContent = `${item.name} — ${item.description} Cost: ${item.cost} gold stars.`;
      button.type = 'button';
      button.textContent = owned ? 'Purchased' : `Buy · ★ ${item.cost}`;
      button.disabled = owned || balance < item.cost;
      button.setAttribute('aria-label', `${owned ? 'Purchased' : `Buy ${item.name}`} for ${item.cost} gold stars`);
      button.addEventListener('click', () => this.buy(item));
      row.append(detail, button);
      this.menu.append(row);
    }
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'cat-town-menu-close'; close.textContent = 'Close shop menu';
    close.addEventListener('click', () => { this.menuOpen = false; this.render(); });
    this.menu.append(close);
  }
  buy(item) {
    const profile = this.profile(), state = townState(profile);
    const balance = earnedGoldStars(profile, this.levels) - state.spentStars;
    let next;
    try {
      next = purchaseItem(state, item, balance);
    } catch (error) {
      this.showError(error.message);
      return;
    }
    if (this.commit(next)) {
      this.setDialogue('Whiskers', `A fine choice! ${item.name} is ready for Koshi’s house.`);
    }
  }
  renderHomeItems(items) {
    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'cat-town-home-item';
      button.textContent = `${item.name} · ★ ${item.cost}`;
      button.setAttribute('aria-pressed', String(item.id === this.selectedItem));
      button.addEventListener('click', () => { this.selectedItem = item.id; this.render(); });
      this.houseItems.append(button);
    }
  }
  selectCanvasItem(event) {
    if (this.location?.id !== 'house' || !this.houseInterior) return;
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.max(rect.width / 960, rect.height / 540);
    const x = (event.clientX - rect.left - (rect.width - 960 * scale) / 2) / scale;
    const y = (event.clientY - rect.top - (rect.height - 540 * scale) / 2) / scale;
    const items = this.profile()?.catTown?.items ?? [];
    const index = items.findIndex((_, i) => {
      const column = i % 4, row = Math.floor(i / 4), px = 260 + column * 145, py = 300 + row * 95;
      return Math.abs(x - px) < 40 && Math.abs(y - py) < 42;
    });
    if (index >= 0) { this.selectedItem = items[index].id; this.render(); }
  }
  showError(message) {
    this.error.textContent = message;
    this.error.hidden = false;
  }
  frame(timestamp) {
    if (!this.active) return;
    this.updateDialogue(timestamp);
    if (this.treeAnimation) {
      const { from, to, start } = this.treeAnimation;
      const progress = this.reducedMotion.matches ? 1 : Math.min(1, (timestamp - start) / 1800);
      this.treeProgress = from + (to - from) * progress;
      if (progress === 1) this.treeAnimation = null;
    }
    this.draw(timestamp / 1000);
    requestAnimationFrame(this.frame);
  }
  draw(time = performance.now() / 1000) {
    if (!this.active) return;
    const ratio = window.devicePixelRatio || 1, width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height) return;
    const w = Math.round(width * ratio), h = Math.round(height * ratio);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    const backgroundScale = Math.max(w / 960, h / 540);
    this.ctx.setTransform(backgroundScale, 0, 0, backgroundScale,
      (w - 960 * backgroundScale) / 2, (h - 540 * backgroundScale) / 2);
    const state = townState(this.profile()), fish = fabledFish(this.profile(), this.worlds, this.levels);
    if (this.location.id === 'mall') {
      drawMall(this.ctx, time, this.speaker.textContent, this.drawKoshi);
    } else if (this.location.id === 'house') drawHouse(this.ctx, this.houseInterior, state.items, this.selectedItem, time, this.drawKoshi);
    else if (this.location.id === 'tree') drawCatTree(this.ctx, time, this.treeProgress, this.speaker.textContent, this.drawKoshi);
    else drawTank(this.ctx, time, fish, this.speaker.textContent, this.drawKoshi);
  }
}

const api = { CatTown, LOCATIONS, TOWN_ITEMS, townState, earnedGoldStars, chooseOffers, purchaseItem, buildTree, fabledFish };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.KoshiCatTown = api;
})();
