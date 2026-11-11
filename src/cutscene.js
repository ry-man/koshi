(function () {
'use strict';

const { Cutscene, CHARACTERS } = globalThis.KoshiGame;

const sceneNames = {
  garden: 'The garden path', workshop: 'Clockwork Pantry', foundry: 'Robot Foundry',
  'happy-meadows': 'Happy Meadows', 'catnip-beach': 'Catnip Beach',
  'fuzzy-falls': 'Fuzzy Falls', 'mouser-mesa': 'Mouser Mesa',
  'alpine-litterbox': 'Alpine Litterbox', 'yarnball-moon': 'Yarnball Moon',
  'hairball-swamp': 'Hairball Swamp', 'meownt-vesuvius': 'Meownt Vesuvius',
  'robot-hq': 'Robot HQ',
};

const openingScene = {
  theme: 'garden',
  lines: [
    'The world was once a peaceful place. That was, before the evil AI robots took over.',
    'Human technology advanced too fast, and eventually an evil robot duck named Tom gained sufficient power to topple nations.',
    'The fate of the planet falls to this unassuming cat, named Koshi. Is he a bad enough dude to save the world?',
  ].map(text => ({ speaker: 'koshi', text, actors: [{ character: 'koshi', x: .5, y: .7 }] })),
};

function drawOpeningScene(ctx, index, time) {
  const rect = (color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const ellipse = (color, x, y, rx, ry) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  };
  const shape = (color, points) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.closePath(); ctx.fill();
  };
  if (index < 2) {
    const ruined = index === 1;
    const sky = ctx.createLinearGradient(0, 0, 0, 540);
    sky.addColorStop(0, ruined ? '#30383e' : '#70cbee');
    sky.addColorStop(1, ruined ? '#68726d' : '#e3f6d2');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 960, 540);
    if (!ruined) ellipse('#fff3a0', 760, 92, 48, 48);
    for (let i = 0; i < 6; i++) {
      ellipse(ruined ? '#414a4d' : '#f8fcf0', i * 190 + 20, 72 + i % 2 * 40, 100, ruined ? 37 : 22);
    }
    if (ruined) {
      for (const [x, top, width] of [[60, 120, 90], [240, 65, 110], [410, 145, 80], [590, 95, 120], [805, 55, 100]]) {
        shape('#384145', [[x, 355], [x, top + 23], [x + width * .3, top],
          [x + width * .55, top + 32], [x + width, top + 12], [x + width, 355]]);
        for (let y = top + 50; y < 300; y += 33) {
          for (let dx = 15; dx < width - 10; dx += 25) rect('#52605e', x + dx, y, 9, 14);
        }
      }
    }
    rect(ruined ? '#363d3b' : '#79bb64', 0, 355, 960, 185);
    shape(ruined ? '#555b54' : '#d7bd89', [[400, 355], [550, 355], [740, 540], [200, 540]]);
    for (let i = 0; i < 5; i++) {
      const x = 25 + i * 190, y = 235 - i % 2 * 55;
      rect(ruined ? '#41484a' : ['#f4d197', '#b9dbe0', '#e7afa0'][i % 3], x, y, 150, 135);
      shape(ruined ? '#2b3237' : '#b66554', ruined
        ? [[x - 10, y], [x + 25, y - 45], [x + 55, y - 17], [x + 92, y - 59], [x + 160, y]]
        : [[x - 10, y], [x + 75, y - 65], [x + 160, y]]);
      for (const dx of [22, 98]) {
        rect(ruined ? '#192b2d' : '#fff1ab', x + dx, y + 23, 30, 36);
        rect(ruined ? '#343c3d' : '#fbfaf0', x + dx + 13, y + 23, 4, 36);
      }
      rect(ruined ? '#242c30' : '#7b695a', x + 62, y + 80, 30, 55);
      if (ruined) {
        shape('#242c30', [[x + 40, y], [x + 59, y + 38], [x + 49, y + 65], [x + 83, y + 101], [x + 65, y + 55], [x + 72, y + 29]]);
        for (let j = 0; j < 4; j++) {
          shape('#70736a', [[x + j * 38, 390], [x + j * 38 + 16, 363 - j % 2 * 10], [x + j * 38 + 35, 393]]);
        }
      } else {
        rect('#71573f', x + 8, 320, 9, 69);
        ellipse('#458b55', x + 12, 309, 30, 35);
        for (const dx of [35, 110]) {
          ellipse('#f7d893', x + dx, 415, 8, 8);
          rect(dx === 35 ? '#6d89c5' : '#d2717e', x + dx - 7, 423, 14, 20);
          rect('#665c55', x + dx - 6, 443, 4, 12);
          rect('#665c55', x + dx + 2, 443, 4, 12);
        }
      }
    }
    if (ruined) {
      ctx.save(); ctx.translate(490, 340); ctx.scale(1.7, 1.7); drawTom(ctx, time, false); ctx.restore();
      ctx.strokeStyle = '#9bdf7c99'; ctx.lineWidth = 2;
      for (let i = 0; i < 85; i++) {
        const x = (i * 137 + time * 18) % 1000;
        const y = (i * 83 + time * 125) % 570;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 15); ctx.stroke();
      }
      for (const x of [115, 340, 790]) ellipse('#729c5b88', x, 480, 55, 5);
    } else {
      for (let i = 0; i < 24; i++) {
        const x = i * 43 + 8, y = 480 + i % 3 * 20;
        rect('#437b47', x, y, 2, 12);
        ellipse(i % 2 ? '#f5d477' : '#f5b5c1', x + 1, y, 4, 4);
      }
    }
  } else {
    rect('#e3c9a5', 0, 0, 960, 540);
    for (let x = 0; x < 960; x += 60) rect('#d9bc98', x, 0, 3, 380);
    rect('#a87c59', 0, 380, 960, 160);
    for (let y = 400; y < 540; y += 38) rect('#89634d', 0, y, 960, 2);
    rect('#f6e8ca', 110, 75, 220, 220); rect('#8ecde2', 123, 88, 194, 194);
    ellipse('#ffefa0', 268, 133, 27, 27);
    rect('#f6e8ca', 212, 88, 12, 194); rect('#f6e8ca', 123, 180, 194, 12);
    shape('#9bafa2', [[90, 60], [170, 60], [143, 310], [90, 310]]);
    shape('#9bafa2', [[270, 60], [350, 60], [350, 310], [300, 310]]);
    rect('#795e4b', 720, 210, 135, 170); rect('#96785b', 710, 200, 155, 18);
    for (const y of [228, 300]) {
      rect('#b59975', 735, y, 105, 54); ellipse('#e3c9a5', 787, y + 27, 5, 5);
    }
    ellipse('#775c49', 475, 468, 184, 33);
    ellipse('#829d9b', 475, 420, 170, 70);
    ellipse('#c7d7c1', 475, 407, 143, 48);
    const breath = Math.sin(time * 1.8) * 2;
    ellipse('#abb5bd', 477, 397, 89, 39 + breath);
    ctx.strokeStyle = '#596571'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (const x of [484, 509, 534]) {
      ctx.beginPath(); ctx.moveTo(x, 365 - breath);
      ctx.quadraticCurveTo(x - 7, 375, x - 5, 385); ctx.stroke();
    }
    ctx.strokeStyle = '#abb5bd'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.ellipse(492, 401, 59, 24, .12, -.6, Math.PI * 1.2); ctx.stroke();
    ctx.save(); ctx.translate(424, 388); ctx.scale(1.55, 1.55);
    shape('#abb5bd', [[-20, -8], [-22, -32], [-6, -21], [7, -21], [23, -32], [21, -7]]);
    ellipse('#abb5bd', 0, 0, 23, 23);
    shape('#d6a4a4', [[-18, -15], [-19, -25], [-11, -19]]);
    shape('#d6a4a4', [[13, -19], [20, -25], [18, -14]]);
    ctx.strokeStyle = '#596571'; ctx.lineWidth = 4;
    for (const [x, endX, y] of [[-10, -7, -20], [0, 0, -22], [10, 7, -20]]) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(endX, y + 8); ctx.stroke();
    }
    ctx.lineWidth = 3;
    for (const sign of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sign * 22, -3); ctx.lineTo(sign * 16, 0); ctx.stroke();
    }
    ctx.fillStyle = '#eff2ed';
    ctx.beginPath(); ctx.moveTo(0, -12);
    ctx.quadraticCurveTo(-3, -5, -4, 7); ctx.quadraticCurveTo(0, 12, 4, 7);
    ctx.quadraticCurveTo(3, -5, 0, -12); ctx.fill();
    ctx.strokeStyle = '#26323a'; ctx.lineWidth = 2;
    for (const x of [-9, 9]) {
      ctx.beginPath(); ctx.moveTo(x - 4, -3); ctx.quadraticCurveTo(x, 2, x + 4, -3); ctx.stroke();
    }
    shape('#bd8d93', [[-4, 5], [4, 5], [0, 9]]);
    ctx.strokeStyle = '#34414a'; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(0, 9); ctx.quadraticCurveTo(-4, 16, -8, 11);
    ctx.moveTo(0, 9); ctx.quadraticCurveTo(4, 16, 8, 11); ctx.stroke();
    ctx.strokeStyle = '#d7dfdc'; ctx.lineWidth = 1.2;
    for (const sign of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(sign * 13, 5 + i * 2);
        ctx.lineTo(sign * (34 - Math.abs(i - 1.5)), -2 + i * 7); ctx.stroke();
      }
    }
    ctx.restore();
    ctx.fillStyle = '#725b49'; ctx.font = '24px monospace';
    ctx.fillText('z', 526, 337 - time * 10 % 30);
    ctx.font = '32px monospace'; ctx.fillText('Z', 552, 304 - time * 8 % 30);
    ellipse('#829d9b', 475, 441, 160, 32);
    ellipse('#9bb4ac', 475, 432, 143, 18);
  }
}

function drawOfficialBackground(ctx, theme) {
  const palettes = {
    'happy-meadows': ['#a4e0e0', '#e7f6ca', '#76c96a', '#397b4e'],
    'catnip-beach': ['#69c7e0', '#def7e5', '#f1d65c', '#d2ad55'],
    'fuzzy-falls': ['#7cbce9', '#d8edfb', '#68a9ee', '#497d94'],
    'mouser-mesa': ['#f5c27e', '#fce4b5', '#eea052', '#9d593c'],
    'alpine-litterbox': ['#91b6d2', '#e8f5fb', '#eeeeee', '#a8bdc8'],
    'yarnball-moon': ['#211b4c', '#67518c', '#b08ae3', '#594578'],
    'hairball-swamp': ['#8ca58a', '#d0c8a4', '#b58a65', '#526d54'],
    'meownt-vesuvius': ['#693e50', '#efaa86', '#e66c68', '#713b3b'],
    'robot-hq': ['#343453', '#b38ba9', '#ed9bc3', '#55465e'],
  };
  const [skyTop, skyBottom, accent, ground] = palettes[theme];
  const sky = ctx.createLinearGradient(0, 0, 0, 540);
  sky.addColorStop(0, skyTop); sky.addColorStop(1, skyBottom);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 960, 540);
  const rect = (color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const circle = (color, x, y, r) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  };
  const shape = (color, points) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.closePath(); ctx.fill();
  };
  if (theme === 'happy-meadows') {
    circle('#fff2a1', 790, 85, 43);
    for (const [x, y, r] of [[60, 410, 210], [370, 430, 250], [790, 420, 230]]) circle('#8bcf83', x, y, r);
    for (const x of [80, 850]) {
      rect('#785844', x - 13, 210, 26, 180);
      circle('#438e59', x, 190, 75); circle('#64b86c', x - 40, 205, 50); circle('#64b86c', x + 40, 205, 50);
    }
  } else if (theme === 'catnip-beach') {
    circle('#fff0a0', 760, 85, 48);
    rect('#64bec9', 0, 250, 960, 145);
    for (const y of [275, 315, 355]) for (let x = (y % 2) * 55; x < 960; x += 150) rect('#c7f1df', x, y, 80, 4);
    for (const x of [105, 850]) {
      shape('#8c6847', [[x - 12, 380], [x + 10, 380], [x + 30, 180], [x + 15, 180]]);
      for (const dx of [-1, 1]) shape('#388b67', [[x + 20, 185], [x + 20 + dx * 110, 150], [x + 20 + dx * 65, 210]]);
    }
  } else if (theme === 'fuzzy-falls') {
    shape('#6d9fac', [[0, 340], [0, 150], [200, 85], [300, 180], [360, 340]]);
    shape('#6d9fac', [[600, 340], [660, 170], [780, 80], [960, 150], [960, 340]]);
    rect('#bceeff', 360, 0, 240, 360);
    for (const x of [390, 445, 520, 570]) rect('#f1fbff', x, 0, 12, 320);
    for (const [x, y, r] of [[365, 365, 43], [450, 350, 48], [545, 355, 52], [610, 370, 38]]) circle('#e6faff', x, y, r);
  } else if (theme === 'mouser-mesa') {
    circle('#ffe2a1', 780, 85, 48);
    for (const [x, y, w] of [[0, 200, 240], [285, 250, 190], [650, 170, 310]]) {
      rect('#b96f4c', x, y, w, 230); rect('#d48655', x - 15, y, w + 30, 22);
      rect('#a35c43', x, y + 75, w, 10);
    }
    for (const x of [115, 840]) {
      rect('#55865b', x, 280, 20, 110); rect('#55865b', x - 25, 315, 70, 14);
      rect('#55865b', x - 25, 290, 14, 35); rect('#55865b', x + 31, 295, 14, 34);
    }
  } else if (theme === 'alpine-litterbox') {
    for (const [x, peak, width] of [[-80, 90, 400], [220, 30, 450], [620, 75, 430]]) {
      shape('#88a4b7', [[x, 380], [x + width / 2, peak], [x + width, 380]]);
      shape('#f6fbfd', [[x + width * .32, peak + 110], [x + width / 2, peak], [x + width * .68, peak + 110], [x + width * .55, peak + 90], [x + width * .48, peak + 115]]);
    }
    for (const x of [70, 160, 800, 900]) {
      rect('#6b6a61', x - 6, 290, 12, 90);
      shape('#668c87', [[x - 45, 320], [x, 190], [x + 45, 320]]);
    }
  } else if (theme === 'yarnball-moon') {
    for (const [x, y] of [[50, 60], [170, 135], [300, 40], [650, 70], [820, 145], [920, 45], [560, 180]]) circle('#f9efc8', x, y, 3);
    circle('#eadbff', 770, 100, 54); circle('#c5aee9', 788, 85, 12); circle('#c5aee9', 750, 115, 9);
    for (const [x, y, r] of [[90, 340, 90], [300, 380, 110], [690, 375, 115], [900, 340, 85]]) circle('#8170af', x, y, r);
    for (const [x, y] of [[120, 310], [850, 300]]) {
      circle('#d3b3ed', x, y, 42);
      ctx.strokeStyle = '#9371ba'; ctx.lineWidth = 5;
      for (const dx of [-20, 0, 20]) { ctx.beginPath(); ctx.moveTo(x + dx - 10, y - 33); ctx.lineTo(x + dx + 10, y + 33); ctx.stroke(); }
    }
  } else if (theme === 'hairball-swamp') {
    for (const x of [80, 220, 740, 890]) {
      rect('#59624b', x - 16, 110, 32, 300);
      shape('#59624b', [[x, 200], [x - 75, 120], [x - 62, 115], [x + 10, 175]]);
      circle('#6d805b', x, 110, 55);
      for (const dx of [-40, 20, 55]) rect('#8caa75', x + dx, 140, 5, 65);
    }
    for (const [x, y] of [[120, 345], [300, 365], [670, 350], [850, 370]]) {
      circle('#85a177', x, y, 38); rect('#b4c888', x - 28, y, 56, 6);
    }
  } else if (theme === 'meownt-vesuvius') {
    circle('#f9bd85', 800, 95, 48);
    shape('#704350', [[100, 390], [380, 115], [580, 115], [860, 390]]);
    shape('#f17b58', [[380, 115], [580, 115], [555, 145], [510, 135], [490, 260], [465, 145], [420, 160]]);
    for (const [x, y, r] of [[410, 80, 40], [470, 55, 55], [540, 75, 40]]) circle('#67515c', x, y, r);
    for (const [x, y] of [[145, 110], [265, 70], [675, 160], [850, 220]]) circle('#ffc078', x, y, 5);
  } else if (theme === 'robot-hq') {
    rect('#474057', 100, 90, 760, 300);
    rect('#66526b', 130, 120, 700, 245);
    for (const x of [155, 745]) {
      rect('#302f49', x, 150, 60, 180); rect('#ed9bc3', x + 10, 165, 40, 18);
      for (const y of [205, 240, 275]) rect('#9ce5df', x + 15, y, 30, 7);
    }
    shape('#302f49', [[340, 330], [340, 170], [370, 170], [385, 135], [415, 170], [545, 170], [575, 135], [590, 170], [620, 170], [620, 330]]);
    rect('#ed9bc3', 385, 220, 65, 25); rect('#ed9bc3', 510, 220, 65, 25);
    rect('#9ce5df', 435, 285, 90, 8);
  }
  rect(ground, 0, 390, 960, 150);
  shape(accent, [[390, 390], [570, 390], [760, 540], [200, 540]]);
  for (let x = 20; x < 960; x += 120) {
    rect(accent, x, 465, 80, 8);
    rect(skyBottom, x + 10, 470, 60, 3);
  }
}

function drawTom(ctx, time, speaking) {
  const talking = speaking && Math.floor(time * 8) % 2 === 0;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 2;
  ctx.strokeStyle = '#202c35';
  const metal = ctx.createLinearGradient(-18, 0, 20, 0);
  metal.addColorStop(0, '#748591'); metal.addColorStop(.45, '#c3cdd2'); metal.addColorStop(1, '#84939e');
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.moveTo(12, -2); ctx.lineTo(35, -12); ctx.lineTo(29, -3);
  ctx.lineTo(39, 0); ctx.lineTo(28, 6); ctx.lineTo(34, 12); ctx.lineTo(14, 14);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  for (const x of [-10, 10]) {
    ctx.fillStyle = '#84939e'; ctx.fillRect(x - 3, 20, 6, 17); ctx.strokeRect(x - 3, 20, 6, 17);
    ctx.beginPath();
    ctx.moveTo(x + 5, 34); ctx.lineTo(x - 20, 34); ctx.lineTo(x - 15, 38);
    ctx.lineTo(x - 21, 42); ctx.lineTo(x - 14, 46); ctx.lineTo(x + 6, 44);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.moveTo(-18, -23); ctx.quadraticCurveTo(-18, -46, 0, -46);
  ctx.quadraticCurveTo(19, -46, 20, -23); ctx.lineTo(22, 20);
  ctx.quadraticCurveTo(22, 25, 16, 25); ctx.lineTo(-13, 25);
  ctx.quadraticCurveTo(-18, 25, -18, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#445561'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, -62); ctx.stroke();
  ctx.fillStyle = speaking ? '#ea7070' : '#95d1c0';
  ctx.beginPath(); ctx.arc(0, -65, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = speaking ? '#e5a5a599' : '#9cbab866'; ctx.lineWidth = 1.3;
  for (const radius of [9, 16]) {
    ctx.beginPath(); ctx.arc(0, -65, radius, -.55, .55); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -65, radius, Math.PI - .55, Math.PI + .55); ctx.stroke();
  }
  ctx.fillStyle = '#d1dadf'; ctx.strokeStyle = '#263640'; ctx.lineWidth = 2;
  ctx.fillRect(-18, -30, 33, 10); ctx.strokeRect(-18, -30, 33, 10);
  ctx.fillStyle = '#14232d'; ctx.fillRect(-17, -27, 29, 4);
  ctx.fillStyle = '#d96967'; ctx.fillRect(-15, -26, 24, 1.5);
  ctx.fillStyle = '#b9a887';
  ctx.beginPath();
  ctx.moveTo(-15, -13); ctx.quadraticCurveTo(-30, -15, -52, -6);
  ctx.quadraticCurveTo(-55, -2, -48, 1 + (talking ? 3 : 0));
  ctx.lineTo(-15, 6 + (talking ? 3 : 0)); ctx.quadraticCurveTo(-8, 4, -10, -7);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-50, -3); ctx.lineTo(-19, -3); ctx.lineTo(-18, 1); ctx.stroke();
  ctx.fillStyle = '#9eafb9';
  ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(13, 0); ctx.lineTo(13, 16);
  ctx.lineTo(8, 11); ctx.lineTo(4, 18); ctx.lineTo(0, 12); ctx.lineTo(-3, 17);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#526773';
  for (const y of [-38, 20]) { ctx.beginPath(); ctx.arc(15, y, 1.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawPortrait(ctx, character, speaking, time) {
  const box = (color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  ctx.clearRect(0, 0, 32, 32);
  box('#15232d', 0, 0, 32, 32);
  const blink = time % 4 > 3.8;
  const talking = speaking && Math.floor(time * 8) % 2 === 0;
  if (character === 'koshi') {
    box('#060e16', 3, 3, 7, 17); box('#060e16', 22, 3, 7, 17);
    box('#060e16', 5, 10, 22, 19); box('#060e16', 9, 29, 14, 2);
    box('#abb5bd', 5, 5, 3, 12); box('#abb5bd', 24, 5, 3, 12);
    box('#abb5bd', 7, 9, 18, 19); box('#abb5bd', 10, 28, 12, 1);
    box('#d6a4a4', 6, 8, 2, 6); box('#d6a4a4', 24, 8, 2, 6);
    for (const x of [11, 15, 19]) box('#596571', x, 11, 2, x === 15 ? 5 : 3);
    box('#eff2ed', 14, 17, 4, 9);
    box('#26323a', 9, 18, 3, blink ? 1 : 3); box('#26323a', 20, 18, 3, blink ? 1 : 3);
    box('#bd8d93', 14, 23, 4, 2);
    box('#26323a', 14, 26, 4, talking ? 3 : 1);
    for (const y of [23, 26]) { box('#edf2e8', 2, y, 7, 1); box('#edf2e8', 23, y, 7, 1); }
  } else if (character === 'whiskers' || character === 'bruiser' || character === 'eugene') {
    const palette = character === 'whiskers'
      ? { outline: '#060e16', fur: '#22232b', inner: '#754956', stripe: null }
      : character === 'bruiser'
        ? { outline: '#43271b', fur: '#e88934', inner: '#f0bd79', stripe: '#a94f25' }
        : { outline: '#303b43', fur: '#737c82', inner: '#9ba6ab', stripe: '#4b555d' };
    box(palette.outline, 3, 3, 7, 16); box(palette.outline, 22, 3, 7, 16);
    box(palette.outline, 5, 9, 22, 20); box(palette.outline, 9, 28, 14, 3);
    box(palette.fur, 5, 5, 4, 12); box(palette.fur, 23, 5, 4, 12);
    box(palette.fur, 7, 9, 18, 19); box(palette.fur, 10, 27, 12, 2);
    box(palette.inner, 6, 8, 2, 6); box(palette.inner, 24, 8, 2, 6);
    if (palette.stripe) {
      for (const x of [11, 15, 19]) box(palette.stripe, x, 11, 2, x === 15 ? 5 : 3);
    }
    for (const x of [10, 20]) box('#202b32', x, 18, 3, blink ? 1 : 3);
    box(character === 'bruiser' ? '#43271b' : '#d98e9a', 14, 22, 4, 2);
    box('#26323a', 14, 25, 4, talking ? 3 : 1);
    if (character === 'eugene') {
      for (const x of [8, 18]) {
        ctx.strokeStyle = '#283945'; ctx.lineWidth = 1.5;
        ctx.strokeRect(x, 15, 7, 7);
      }
      ctx.beginPath(); ctx.moveTo(15, 18); ctx.lineTo(18, 18); ctx.stroke();
    }
  } else if (character === 'tom') {
    box('#526773', 19, 1, 1, 6); box(speaking ? '#ea7070' : '#95d1c0', 18, 1, 3, 2);
    box('#060e16', 12, 7, 15, 23);
    box('#a5b4bf', 14, 8, 10, 22); box('#7e929f', 24, 11, 2, 18);
    box('#d1dadf', 12, 13, 13, 6); box('#14232d', 12, 15, 11, 2);
    box('#d96967', 13, 15, 8, blink ? 1 : 2);
    box('#263640', 2, 20, 17, talking ? 8 : 6);
    box('#b9a887', 3, 21, 14, talking ? 6 : 4);
    box('#263640', 3, 23, 12, 1); box('#526773', 21, 25, 2, 4);
  } else if (character === 'ram') {
    for (const x of [1, 23]) {
      box('#060e16', x, 2, 8, 15); box('#d6dadd', x + 1, 3, 6, 12);
      box('#59636a', x + 2, 5, 4, 6); box('#15232d', x + 3, 7, 3, 3);
    }
    box('#394852', 7, 5, 18, 25); box('#aeb9c0', 9, 6, 14, 22);
    box('#dce3e6', 12, 6, 8, 3);
    for (const x of [10, 18]) box('#e64649', x, 13, 4, blink ? 1 : 5);
    box('#303d45', 13, 20, 2, 2); box('#303d45', 17, 20, 2, 2);
    box('#c7353b', 12, 24, 8, talking ? 4 : 2);
  } else if (character === 'jackolantern') {
    box('#818c91', 15, 0, 2, 7); box('#c2c9cd', 14, 0, 4, 3);
    ctx.fillStyle = '#e77d27'; ctx.strokeStyle = '#833719'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(16, 19, 13, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (const x of [9, 21]) box('#b8c1c5', x - 3, 13, 6, blink ? 1 : 4);
    box('#ffd660', 15, 19, 3, 3);
    box('#ffd660', 8, 24, 16, talking ? 5 : 3);
    box('#a4461b', 12, 24, 2, 2); box('#a4461b', 19, 25, 2, 2);
  } else if (character === 'ball') {
    ctx.fillStyle = '#ed852e'; ctx.strokeStyle = '#383d40'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(16, 16, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    box('#383d40', 15, 3, 2, 26); box('#383d40', 3, 15, 26, 2);
    for (const x of [9, 21]) box('#d52932', x, 10, 3, blink ? 1 : 3);
    box('#383d40', 9, 20, 14, talking ? 7 : 5);
    for (const x of [10, 13, 16, 19, 22]) box('#9ba4a7', x, 21, 1, 3);
  } else if (character === 'snake') {
    if (talking || time % 2.2 > 1.82) {
      box('#d93645', 27, 19, 4, 4);
      box('#f0646c', 30, 18, 2, 2);
      box('#f0646c', 30, 22, 2, 2);
    }
    for (const [x, y, w, h] of [[1,16,8,10],[7,14,9,12],[13,13,9,13],[19,12,11,14]]) {
      box('#26343d', x, y, w, h);
      box('#89969d', x + 1, y + 1, w - 2, h - 2);
      box('#c1c9cc', x + 2, y + 1, w - 4, 2);
      box('#59666f', x + 2, y + 3, w - 4, 2);
      box('#59666f', x + 2, y + h - 4, w - 4, 2);
      box('#bd3944', x + 3, y + 3, w - 6, 1);
      box('#bd3944', x + 3, y + h - 3, w - 6, 1);
    }
    box('#cbd2d4', 10, 15, 3, 10); box('#cbd2d4', 7, 18, 9, 3);
    for (const x of [15, 19]) {
      ctx.fillStyle = '#354149'; ctx.beginPath(); ctx.ellipse(x, 19, 1.7, .7, -.2, 0, Math.PI * 2); ctx.fill();
    }
    box('#d23c48', 3, 20, 2, 2); box('#d23c48', 6, 20, 2, 2);
    for (const y of [15, 20]) {
      box('#f4d447', 24, y, 4, blink ? 1 : 4);
      if (!blink) box('#15232d', 25, y, 1, 4);
    }
    box('#a4afb3', 27, 16, 2, 7);
  } else if (character === 'robo-love-bug') {
    for (const x of [3, 26]) for (let i = 0; i < 3; i++) {
      const shuffle = Math.round(Math.sin(time * 14 + i * Math.PI) * 2);
      box('#522631', x - 1 + shuffle, 14 + i * 6, 4, 2);
    }
    box('#743d68', 5, 11, 23, 19); box('#f29ac2', 6, 12, 21, 17);
    box('#743d68', 16, 13, 1, 16);
    for (const [x, y, w, h] of [[9,16,6,5],[18,16,6,5],[11,19,11,4],[13,22,7,3],[15,25,3,2]]) {
      box('#9346b2', x, y, w, h);
    }
    box('#522631', 8, 2, 2, 8); box('#522631', 23, 2, 2, 8);
    box('#722d40', 6, 1, 4, 3); box('#722d40', 24, 1, 4, 3);
    box('#252d33', 6, 8, 21, 7); box('#485158', 7, 7, 19, 7);
    for (const x of [10, 20]) {
      box('#a0a9af', x - 1, 8, 5, 5); box('#ef3646', x, 9, 3, blink ? 1 : 3);
    }
    if (talking) box('#252d33', 14, 12, 5, 2);
  } else if (character === 'robo-crab') {
    for (const side of [-1, 1]) {
      const x = side < 0 ? 2 : 27;
      const step = Math.round(Math.sin(time * 10 + side) * 2);
      box('#737d83', x + step, 24, 3, 5);
      box('#737d83', x + 1 - step, 26, 3, 5);
      box('#d33c43', x, 9, 2, 12); box('#d33c43', x, 19, 6, 2);
      box('#d33c43', x - 1, 4, 6, 5); box('#d33c43', x - 1, 2, 3, 3);
      box('#d33c43', x + 3, time % 1 > .5 ? 2 : 4, 3, 3);
    }
    box('#343e44', 5, 15, 23, 12); box('#929ba1', 6, 14, 21, 12);
    for (const x of [10, 20]) {
      box('#737d83', x, 10, 2, 5); box('#343e44', x - 3, 6, 8, 5);
      for (let column = 0; column < 3; column++) {
        box('#79f58a', x - 2 + column * 2, 7, 1, blink ? 1 : 3);
      }
    }
    box('#202a30', 10, 20, 13, talking ? 5 : 1);
    box('#202a30', 10, 21, 1, 3); box('#202a30', 22, 21, 1, 3);
  } else if (character === 'robo-trash-bin') {
    box('#202b28', 3, 5, 26, 5);
    box('#005b40', 5, 10, 22, 20); box('#008459', 7, 10, 18, 19);
    for (const x of [9, 19]) box('#ffe34c', x, 14, 5, blink ? 1 : 4);
    box('#18352b', 11, 24, 2, 2); box('#18352b', 13, 22, 6, talking ? 4 : 2);
    box('#18352b', 19, 24, 2, 2);
  } else if (character === 'robo-snail') {
    box('#314443', 13, 9, 17, 18); box('#777f80', 15, 8, 14, 17);
    box('#826345', 16, 10, 5, 5); box('#a17a4c', 21, 15, 7, 5);
    box('#404749', 18, 12, 8, 2); box('#404749', 25, 13, 2, 8);
    box('#404749', 18, 20, 8, 2); box('#404749', 17, 14, 2, 6);
    box('#404749', 20, 15, 3, 2); box('#404749', 22, 16, 2, 3);
    box('#4d9658', 3, 21, 17, 7); box('#79c96c', 4, 17, 12, 9);
    for (const [x, y, phase] of [[6, 9, 0], [13, 8, .8]]) {
      const bounce = Math.round(Math.sin(time * 6 + phase));
      box('#47784b', x, y + bounce, 2, 18 - y - bounce);
      box('#355a43', x - 3, y - 2 + bounce, 8, 4);
      box('#ed3139', x - 2, y - 1 + bounce, 6, 2);
    }
    const mouthHeight = talking ? 6 : 2 + Math.round((Math.sin(time * 5) + 1) * 1.5);
    box('#26353d', 7, 26 - mouthHeight, 7, mouthHeight);
    box('#edf2e8', 8, 26 - Math.min(2, mouthHeight - 1), 5, Math.min(2, mouthHeight - 1));
    box('#384044', 10, 26 - Math.min(2, mouthHeight - 1), 1, Math.min(2, mouthHeight - 1));
  } else if (character === 'robo-cow') {
    const bob = Math.round(Math.sin(time * 8) * 1.5);
    box('#49335a', 3, 10 + bob, 26, 17); box('#9451bd', 5, 9 + bob, 22, 16);
    box('#12151a', 7, 11 + bob, 6, 5); box('#12151a', 18, 19 + bob, 7, 4);
    box('#12151a', 21, 10 + bob, 4, 3);
    box('#673b8e', 21, 4 + bob, 9, 12); box('#a663cc', 19, 3 + bob, 9, 11);
    box('#723b94', 19, 2 + bob, 4, 3); box('#723b94', 26, 2 + bob, 4, 3);
    box('#e8d8a2', 20, bob, 3, 5); box('#e8d8a2', 26, bob, 3, 5);
    for (const x of [21, 26]) {
      box('#ffd92f', x, 7 + bob, 3, blink ? 1 : 5);
      if (!blink) box('#352b1a', x + 1, 8 + bob, 1, 3);
    }
    box('#16191d', 25, 16 + bob, 6, talking ? 5 : 2);
    box('#dfa9bd', 26, 16 + bob, 4, talking ? 3 : 1);
    for (const x of [7, 19]) { box('#673b8e', x, 24 + bob, 4, 7); box('#343039', x - 1, 29 + bob, 6, 2); }
  } else if (character === 'robo-unicorn') {
    const bob = Math.round(Math.sin(time * 6) * 1.5);
    box('#71364f', 8, 8 + bob, 17, 18); box('#f5b5d3', 9, 8 + bob, 15, 17);
    box('#f5b5d3', 17, 17 + bob, 11, 8); box('#f5b5d3', 9, 24 + bob, 8, 7);
    box('#f5b5d3', 6, 29 + bob, 9, 2);
    for (const [index, color] of ['#fa596f', '#ffad42', '#ffe65a', '#69d58e', '#53b9f1', '#a77bf0'].entries()) {
      box(color, 2 + index * 2, 6 + bob + index, 3, 21 - index * 2);
    }
    box('#f5b5d3', 13, 3 + bob, 4, 9);
    box('#ffd92f', 21, 4 + bob, 3, 7); box('#ffd92f', 23, 1 + bob, 3, 5);
    box('#ffd92f', 20, 12 + bob, 4, blink ? 1 : 4);
    if (!blink) box('#45381d', 22, 12 + bob, 1, 4);
    if (time % 1 < .5) {
      box('#fff9cf', 21, 6, 2, 1); box('#fff9cf', 21, 4, 2, 5);
    }
    box('#535d66', 23, 21 + bob, 6, talking ? 6 : 3);
    box('#c4cdd5', 24, 21 + bob, 1, 2); box('#c4cdd5', 26, 21 + bob, 1, 2);
    if (talking) { box('#c4cdd5', 24, 25 + bob, 1, 2); box('#c4cdd5', 26, 25 + bob, 1, 2); }
  } else if (character === 'boss') {
    box('#6d7780', 5, 7, 24, 22); box('#abb5bd', 3, 7, 21, 22);
    box('#abb5bd', 6, 4, 15, 4);
    box('#252e34', 8, 5, 12, 1); box('#252e34', 7, 7, 13, 1);
    for (const x of [6, 15]) {
      box('#0b1511', x, 12, 7, 5);
      box('#69ed7a', x + 1, 13, 5, blink ? 1 : 3);
      if (!blink) box('#246f3e', x + 3, 13, 1, 3);
    }
    box('#253037', 26, 12, 1, 13); box('#dc454a', 24, 18, 7, 3);
    box('#20282e', 7, 23, 13, talking ? 4 : 1);
  } else if (character === 'robo-koshi') {
    box('#b3bec3', 3, 3, 7, 15); box('#b3bec3', 22, 3, 7, 15);
    box('#454d52', 4, 5, 5, 11); box('#454d52', 23, 5, 5, 11);
    box('#aab4b9', 15, 0, 2, 6); box('#69747a', 13, 0, 6, 2);
    box('#b3bec3', 5, 7, 22, 23); box('#b3bec3', 8, 5, 16, 26);
    box('#454d52', 7, 8, 18, 21); box('#454d52', 9, 6, 14, 24);
    for (const x of [9, 19]) box(blink ? '#733b3e' : '#f02f39', x, 13, 4, blink ? 1 : 4);
    box('#aab4b9', 14, 20, 4, 2);
    box('#242a2d', 12, 24, 8, talking ? 4 : 1);
  } else if (character === 'goalie') {
    for (const x of [10, 15, 20]) {
      box('#7b8e9c', x, 1, 1, 6); box('#e8c561', x, 0, 2, 2);
    }
    box('#354651', 9, 6, 14, 24); box('#354651', 5, 11, 22, 15);
    box('#c2ced7', 10, 7, 12, 22); box('#a5b5c1', 6, 12, 20, 13);
    box('#27a6b0', 6, 19, 20, 7); box('#27a6b0', 10, 26, 12, 3);
    for (const x of [7, 13, 19]) {
      box('#f5cf5c', x, 19, 2, 8); box('#de5275', x + 2, 19, 2, 8);
    }
    box('#263b61', 6, 18, 20, 2);
    box('#fff0af', 21, 21, 3, 3); box('#263b61', 22, 22, 1, 1);
    for (const x of [10, 20]) box('#26353d', x, 12, 2, blink ? 1 : 3);
    box('#354651', 14, 14, 5, 9); box('#d2dde4', 15, 14, 3, talking ? 9 : 7);
  } else if (character === 'bucket') {
    box('#737d80', 7, 1, 18, 3); box('#737d80', 5, 3, 3, 10); box('#737d80', 24, 3, 3, 10);
    box('#60675f', 4, 11, 24, 5); box('#60675f', 6, 16, 20, 14);
    box('#c9bd76', 7, 15, 18, 13); box('#e0d59a', 5, 12, 22, 3);
    for (const x of [9, 19]) {
      box('#50565a', x, 18, 4, blink ? 1 : 4);
      if (!blink) box('#f2eee0', x, 18, 1, 1);
    }
    box('#db4847', 14, 23, 4, 2); box('#514b42', 11, 26, 10, talking ? 3 : 1);
  } else {
    if (character === 'mouse') {
      for (const x of [2, 22]) {
        box('#060e16', x, 2, 8, 9); box('#8898a7', x + 1, 3, 6, 7); box('#596975', x + 3, 5, 3, 3);
      }
    } else {
      for (const [x, y, w, h] of [[12,1,8,4],[12,27,8,4],[1,12,4,8],[27,12,4,8],[4,4,5,5],[23,4,5,5],[4,23,5,5],[23,23,5,5]]) box('#596975', x, y, w, h);
    }
    box('#060e16', 5, 7, 22, 20); box('#060e16', 8, 4, 16, 26);
    box('#8898a7', 7, 9, 18, 16); box('#8898a7', 10, 6, 12, 22);
    if (character === 'wheel') box('#b2ca75', 9, 9, 14, 16);
    box('#27353d', 9, 12, 5, 2); box('#27353d', 18, 12, 5, 2);
    box('#d46665', 9, 16, 5, blink ? 1 : 4); box('#d46665', 18, 16, 5, blink ? 1 : 4);
    box('#27353d', 12, 23, 8, talking ? 4 : 1);
    if (character === 'mouse' && talking) {
      box('#27353d', 10, 22, 12, 7);
      for (const x of [12, 17]) box('#f2eee0', x, 22, 3, 5);
    }
  }
}

class CutscenePlayer {
  constructor(drawCharacter, onFinish, transition = action => action()) {
    this.transition = transition;
    this.dialog = document.querySelector('#cutscene');
    this.stage = document.querySelector('#cutscene-stage');
    this.portrait = document.querySelector('#cutscene-portrait');
    this.text = document.querySelector('#cutscene-text');
    this.next = document.querySelector('#cutscene-next');
    this.drawCharacter = drawCharacter;
    this.onFinish = onFinish;
    this.playback = null;
    this.paused = false;
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.next.addEventListener('click', () => this.advance());
    document.querySelector('#cutscene-skip').addEventListener('click', () => this.finish());
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.finish(); });
    this.dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.finish();
      } else if (event.key === ' ' || event.key === 'Enter') {
        if (event.target.tagName !== 'BUTTON') { event.preventDefault(); this.advance(); }
        event.stopPropagation();
      }
    });
    new ResizeObserver(() => this.draw()).observe(this.stage);
    window.addEventListener('focus', () => { this.paused = document.hidden; });
    document.addEventListener('visibilitychange', () => { this.paused = document.hidden; });
  }
  get active() { return this.playback !== null; }
  openOpening(onFinish) {
    this.open(openingScene, null, onFinish);
  }
  open(scene, level, openingFinish = null) {
    this.openingFinish = openingFinish;
    this.portrait.hidden = Boolean(openingFinish);
    this.playback = new Cutscene(scene, this.motion.matches);
    this.paused = document.hidden;
    this.positions = new Map();
    this.displayedIndex = -1;
    document.querySelector('#cutscene-heading').textContent = openingFinish ? "Koshi's Quest / Prologue"
      : `Level ${level} / ${sceneNames[scene.theme]}`;
    this.dialog.showModal();
    this.update(0);
    this.next.focus({ preventScroll: true });
  }
  advance() {
    this.playback.advance();
    if (this.playback.finished) this.finish();
    else this.update(0);
  }
  finish() {
    if (!this.active) return;
    this.transition(() => {
      this.playback.skip();
      this.playback = null;
      this.dialog.close();
      const onFinish = this.openingFinish ?? this.onFinish;
      this.openingFinish = null;
      onFinish();
    }, { fade: Boolean(this.openingFinish) });
  }
  update(seconds) {
    if (!this.active) return;
    this.playback.reducedMotion = this.motion.matches;
    if (!this.paused) this.playback.update(Math.min(seconds, .1));
    const { line, index } = this.playback;
    if (index !== this.displayedIndex) {
      this.displayedIndex = index;
      // Hidden letters reserve the complete line's wrapping throughout typing.
      this.textCharacters = this.playback.characters.map(character => {
        const span = document.createElement('span');
        span.textContent = character;
        span.style.visibility = 'hidden';
        return span;
      });
      this.text.replaceChildren(...this.textCharacters);
      this.text.parentElement.scrollTop = 0;
      const speaker = this.openingFinish ? 'Narrator' : CHARACTERS[line.speaker];
      document.querySelector('#cutscene-speaker').textContent = speaker;
      document.querySelector('#cutscene-transcript').textContent = `${speaker}: ${line.text}`;
    }
    const visibleCount = this.playback.visibleCount;
    this.textCharacters.forEach((span, i) => {
      span.style.visibility = i < visibleCount ? 'visible' : 'hidden';
    });
    this.next.textContent = this.playback.typing ? 'Reveal text' : index + 1 === this.playback.scene.lines.length
      ? this.openingFinish ? 'World map' : 'Begin level' : 'Continue';
    document.querySelector('#cutscene-page').textContent = `${index + 1} / ${this.playback.scene.lines.length}`;
    this.draw();
  }
  draw() {
    if (!this.active) return;
    const { line, scene, reducedMotion, elapsed, typing } = this.playback;
    const time = reducedMotion ? 0 : elapsed;
    const ratio = window.devicePixelRatio || 1;
    const width = this.stage.clientWidth, height = this.stage.clientHeight;
    if (!width || !height) return;
    const w = Math.round(width * ratio), h = Math.round(height * ratio);
    if (this.stage.width !== w || this.stage.height !== h) { this.stage.width = w; this.stage.height = h; }
    const ctx = this.stage.getContext('2d');
    if (this.openingFinish) {
      // Letterbox the full illustration so the town and sleeping cat survive portrait layouts.
      const scale = Math.min(w / 960, h / 540);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#10191f'; ctx.fillRect(0, 0, w, h);
      ctx.setTransform(scale, 0, 0, scale, (w - 960 * scale) / 2, (h - 540 * scale) / 2);
      drawOpeningScene(ctx, this.playback.index, time);
      return;
    }
    const backgroundScale = Math.max(w / 960, h / 540);
    const official = !['garden', 'workshop', 'foundry'].includes(scene.theme);
    // Keep the Official ground line at the same stage height when the background is cropped.
    const backgroundY = official ? (h / 540 - backgroundScale) * 390 : (h - 540 * backgroundScale) / 2;
    ctx.setTransform(backgroundScale, 0, 0, backgroundScale, (w - 960 * backgroundScale) / 2, backgroundY);
    if (official) {
      drawOfficialBackground(ctx, scene.theme);
    } else {
      const garden = scene.theme === 'garden', foundry = scene.theme === 'foundry';
      const sky = ctx.createLinearGradient(0, 0, 0, 540);
      sky.addColorStop(0, garden ? '#264e60' : foundry ? '#1d1418' : '#18222f');
      sky.addColorStop(1, garden ? '#a7bc8a' : foundry ? '#8a4a2c' : '#465957');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, 960, 540);
      if (garden) {
        ctx.fillStyle = '#efdea0'; ctx.beginPath(); ctx.arc(780, 95, 48, 0, Math.PI * 2); ctx.fill();
        for (const [x, y, r] of [[100,330,200],[430,360,260],[870,330,230]]) {
          ctx.fillStyle = '#3e7160'; ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.fill();
        }
        for (const x of [75, 885]) {
          ctx.fillStyle = '#675448'; ctx.fillRect(x - 12, 150, 24, 230);
          ctx.fillStyle = '#294f44'; ctx.beginPath(); ctx.arc(x, 160, 85, 0, Math.PI * 2); ctx.fill();
        }
      } else if (foundry) {
        for (const [x, top] of [[90, 70], [240, 120], [720, 100], [870, 60]]) {
          ctx.fillStyle = '#3a2a2a'; ctx.fillRect(x - 28, top, 56, 300 - top);
          ctx.fillStyle = '#e8743a'; ctx.fillRect(x - 28, top, 56, 10);
        }
        ctx.strokeStyle = '#f0a04b88'; ctx.lineWidth = 6;
        for (const x of [330, 630]) {
          ctx.beginPath(); ctx.arc(x, 200, 52, 0, Math.PI * 2); ctx.stroke();
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 52, 200 + Math.sin(a) * 52);
            ctx.lineTo(x + Math.cos(a) * 68, 200 + Math.sin(a) * 68); ctx.stroke();
          }
        }
        ctx.fillStyle = '#f2c46b'; ctx.fillRect(370, 70, 220, 60);
        ctx.fillStyle = '#2b1b1b'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.fillText('ROBOT FOUNDRY', 480, 108);
      } else {
        ctx.strokeStyle = '#819b9855'; ctx.lineWidth = 12;
        for (const x of [110, 475, 850]) { ctx.strokeRect(x, 50, 90, 260); }
        ctx.fillStyle = '#718480';
        for (let x = 30; x < 960; x += 80) { ctx.fillRect(x, 38, 6, 6); ctx.fillRect(x, 285, 6, 6); }
        ctx.fillStyle = '#c9db8d'; ctx.fillRect(370, 85, 220, 60);
        ctx.fillStyle = '#20302e'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.fillText('CLOCKWORK PANTRY', 480, 123);
      }
      ctx.fillStyle = garden ? '#54734b' : foundry ? '#3b2b26' : '#303e43'; ctx.fillRect(0, 375, 960, 165);
      ctx.fillStyle = garden ? '#ad9873' : foundry ? '#6e5146' : '#596465'; ctx.beginPath();
      ctx.moveTo(420, 300); ctx.lineTo(540, 300); ctx.lineTo(800, 540); ctx.lineTo(140, 540); ctx.fill();
      for (let x = 0; x < 960; x += 80) {
        ctx.fillStyle = ['#83bca1', '#7eacdb', '#df8c81'][x / 80 % 3];
        ctx.fillRect(x + 3, 440, 74, 30);
        ctx.strokeStyle = '#192c32'; ctx.lineWidth = 3; ctx.strokeRect(x + 3, 440, 74, 30);
      }
    }
    ctx.setTransform(w / 960, 0, 0, h / 540, 0, 0);
    const mobile = width <= 760 || (width <= 1000 && height <= 500 && width > height);
    const actorScale = Math.min(2.4, width / height * 1.6) * (mobile ? Math.min(1, 4 / line.actors.length) : 1);
    const horizontalPositions = new Map();
    if (mobile && line.actors.length > 1) {
      const ordered = [...line.actors].sort((a, b) => a.x - b.x);
      const gaps = ordered.slice(1).map((actor, i) =>
        actor.character === 'koshi' || ordered[i].character === 'koshi' ? 1.2 : 1);
      const step = .68 * 960 / gaps.reduce((sum, gap) => sum + gap, 0);
      let x = .16 * 960;
      ordered.forEach((actor, i) => {
        if (i) x += gaps[i - 1] * step;
        horizontalPositions.set(actor, x);
      });
    }
    line.actors.forEach((actor, i) => {
      const key = `${actor.character}:${i}`;
      const target = { x: horizontalPositions.get(actor) ?? actor.x * 960, y: actor.y * 540 };
      const previous = this.positions.get(key) ?? target;
      const position = reducedMotion ? target : this.paused ? previous : {
        x: previous.x + (target.x - previous.x) * .12, y: previous.y + (target.y - previous.y) * .12,
      };
      // Apply phone spacing immediately, including when the cast or orientation changes.
      if (mobile) position.x = target.x;
      this.positions.set(key, position);
      const speaking = actor.character === line.speaker;
      const snake = actor.character === 'snake';
      ctx.save();
      ctx.translate(position.x, position.y);
      // Counter the stage's aspect-ratio scaling so gameplay characters stay round.
      ctx.scale(actorScale * height / width * 960 / 540, actorScale);
      const base = { koshi: 23, tom: 46, mouse: 19, wheel: 24, ram: 19, bucket: 21, ball: 19, jackolantern: 20, snake: 19, goalie: 39, 'robo-koshi': 23, 'robo-snail': 24, 'robo-cow': 29, 'robo-unicorn': 33, 'robo-crab': 27, 'robo-love-bug': 25, 'robo-trash-bin': 23, boss: 40 }[actor.character];
      ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.ellipse(actor.character === 'tom' ? -7 : 0,
        base, snake ? 13 : 30, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.translate(0, speaking ? Math.sin(time * 6) * 3 / actorScale : 0);
      if (actor.character === 'tom') drawTom(ctx, time, speaking);
      else if (snake) {
        const scale = .32;
        ctx.save();
        ctx.translate(0, 19 * (1 - scale));
        ctx.rotate(Math.PI / 2);
        ctx.scale(scale, scale);
        this.drawCharacter(ctx, actor.character, time, speaking);
        ctx.restore();
      } else this.drawCharacter(ctx, actor.character, time, speaking);
      ctx.restore();
    });
    drawPortrait(this.portrait.getContext('2d'), line.speaker, typing && !this.paused && !reducedMotion, time);
  }
}

CutscenePlayer.drawPortrait = drawPortrait;
globalThis.KoshiCutscenePlayer = CutscenePlayer;
})();
