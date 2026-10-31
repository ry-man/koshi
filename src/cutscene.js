(function () {
'use strict';

const { Cutscene, CHARACTERS } = globalThis.KoshiGame;

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
  } else if (character === 'tom') {
    box('#526773', 19, 1, 1, 6); box(speaking ? '#ea7070' : '#95d1c0', 18, 1, 3, 2);
    box('#060e16', 12, 7, 15, 23);
    box('#a5b4bf', 14, 8, 10, 22); box('#7e929f', 24, 11, 2, 18);
    box('#d1dadf', 12, 13, 13, 6); box('#14232d', 12, 15, 11, 2);
    box('#d96967', 13, 15, 8, blink ? 1 : 2);
    box('#263640', 2, 20, 17, talking ? 8 : 6);
    box('#b9a887', 3, 21, 14, talking ? 6 : 4);
    box('#263640', 3, 23, 12, 1); box('#526773', 21, 25, 2, 4);
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
    if (talking) for (const x of [13, 16, 19]) box('#d1dce4', x, 24, 1, 1);
  }
}

class CutscenePlayer {
  constructor(drawCharacter, onFinish) {
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
  open(scene, level) {
    this.playback = new Cutscene(scene, this.motion.matches);
    this.paused = document.hidden;
    this.positions = new Map();
    this.displayedIndex = -1;
    document.querySelector('#cutscene-heading').textContent = `Level ${level} / ${scene.theme === 'garden' ? 'The garden path' : 'Clockwork Pantry'}`;
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
    this.playback.skip();
    this.playback = null;
    this.dialog.close();
    this.onFinish();
  }
  update(seconds) {
    if (!this.active) return;
    this.playback.reducedMotion = this.motion.matches;
    if (!this.paused) this.playback.update(Math.min(seconds, .1));
    const { line, index } = this.playback;
    if (index !== this.displayedIndex) {
      this.displayedIndex = index;
      this.text.parentElement.scrollTop = 0;
      document.querySelector('#cutscene-speaker').textContent = CHARACTERS[line.speaker];
      document.querySelector('#cutscene-transcript').textContent = `${CHARACTERS[line.speaker]}: ${line.text}`;
    }
    this.text.textContent = this.playback.text;
    this.next.textContent = this.playback.typing ? 'Reveal text' : index + 1 === this.playback.scene.lines.length ? 'Begin level' : 'Continue';
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
    const backgroundScale = Math.max(w / 960, h / 540);
    ctx.setTransform(backgroundScale, 0, 0, backgroundScale, (w - 960 * backgroundScale) / 2, (h - 540 * backgroundScale) / 2);
    const garden = scene.theme === 'garden';
    const sky = ctx.createLinearGradient(0, 0, 0, 540);
    sky.addColorStop(0, garden ? '#264e60' : '#18222f');
    sky.addColorStop(1, garden ? '#a7bc8a' : '#465957');
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
    } else {
      ctx.strokeStyle = '#819b9855'; ctx.lineWidth = 12;
      for (const x of [110, 475, 850]) { ctx.strokeRect(x, 50, 90, 260); }
      ctx.fillStyle = '#718480';
      for (let x = 30; x < 960; x += 80) { ctx.fillRect(x, 38, 6, 6); ctx.fillRect(x, 285, 6, 6); }
      ctx.fillStyle = '#c9db8d'; ctx.fillRect(370, 85, 220, 60);
      ctx.fillStyle = '#20302e'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.fillText('CLOCKWORK PANTRY', 480, 123);
    }
    ctx.fillStyle = garden ? '#54734b' : '#303e43'; ctx.fillRect(0, 375, 960, 165);
    ctx.fillStyle = garden ? '#ad9873' : '#596465'; ctx.beginPath();
    ctx.moveTo(420, 300); ctx.lineTo(540, 300); ctx.lineTo(800, 540); ctx.lineTo(140, 540); ctx.fill();
    for (let x = 0; x < 960; x += 80) {
      ctx.fillStyle = ['#83bca1', '#7eacdb', '#df8c81'][x / 80 % 3];
      ctx.fillRect(x + 3, 440, 74, 30);
      ctx.strokeStyle = '#192c32'; ctx.lineWidth = 3; ctx.strokeRect(x + 3, 440, 74, 30);
    }
    ctx.setTransform(w / 960, 0, 0, h / 540, 0, 0);
    const actorScale = Math.min(2.4, width / height * 1.6);
    line.actors.forEach((actor, i) => {
      const key = `${actor.character}:${i}`;
      const target = { x: actor.x * 960, y: actor.y * 540 };
      const previous = this.positions.get(key) ?? target;
      const position = reducedMotion ? target : this.paused ? previous : {
        x: previous.x + (target.x - previous.x) * .12, y: previous.y + (target.y - previous.y) * .12,
      };
      this.positions.set(key, position);
      const speaking = actor.character === line.speaker;
      ctx.save();
      ctx.translate(position.x, position.y + (speaking ? Math.sin(time * 6) * 3 : 0));
      // Counter the stage's aspect-ratio scaling so gameplay characters stay round.
      ctx.scale(actorScale * height / width * 960 / 540, actorScale);
      ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.ellipse(0, 28, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
      if (actor.character === 'tom') drawTom(ctx, time, speaking);
      else this.drawCharacter(ctx, actor.character, time, speaking);
      ctx.restore();
    });
    drawPortrait(this.portrait.getContext('2d'), line.speaker, typing && !this.paused && !reducedMotion, time);
  }
}

globalThis.KoshiCutscenePlayer = CutscenePlayer;
})();
