(function () {
'use strict';

const { Game, LEVELS, SWORDS, COOLDOWNS, FOODS } = globalThis.KoshiGame;

let game;
const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');
const board = document.querySelector('#board');
const overlay = document.querySelector('#overlay');
const play = document.querySelector('#play');
const pause = document.querySelector('#pause');
const restart = document.querySelector('#restart');
const timer = document.querySelector('#timer');
const foodCount = document.querySelector('#food-count');
const hearts = document.querySelector('#hearts');
const progress = document.querySelector('#progress');
const progressLabel = document.querySelector('#progress-label');
const status = document.querySelector('#game-status');
const toast = document.querySelector('#toast');
const levelSelect = document.querySelector('#level-select');
const weaponStatus = document.querySelector('#weapon-status');
const colors = { normal: '#83bca1', slow: '#7eacdb', fast: '#df8c81' };
let lastTime = null;
let displayedState = null;
let toastUntil = 0;
let trail = [];
let buttons = [];

function createGame() {
  const portrait = window.matchMedia('(max-width: 760px) and (orientation: portrait)').matches;
  board.dataset.portrait = String(portrait);
  return new Game(Math.random, { portrait, scale: portrait ? board.clientWidth / 600 : 1, level: Number(levelSelect.value) });
}

function makeBrickButtons() {
  const container = document.querySelector('#bricks');
  container.replaceChildren();
  buttons = game.bricks.map(brick => {
    const button = document.createElement('button');
    button.className = 'brick';
    button.style.cssText = `left:${brick.x / game.width * 100}%;top:${brick.y / game.height * 100}%;width:${brick.w / game.width * 100}%;height:${brick.h / game.height * 100}%;--brick-color:${colors[brick.kind]}`;
    button.setAttribute('aria-label', `${brick.kind} brick ${brick.id + 1}, ${COOLDOWNS[brick.kind]} second cooldown`);
    button.title = `${brick.kind} brick · ${COOLDOWNS[brick.kind]}s cooldown`;
    const meter = document.createElement('span');
    meter.className = 'brick-meter';
    button.append(meter);
    button.addEventListener('click', event => {
      if (game.state !== 'playing') return;
      const bounds = board.getBoundingClientRect();
      const x = event.detail === 0 ? brick.x + brick.w / 2 : (event.clientX - bounds.left - board.clientLeft) / board.clientWidth * game.width;
      const y = event.detail === 0 ? brick.y + brick.h / 2 : (event.clientY - bounds.top - board.clientTop) / board.clientHeight * game.height;
      // Include clicks on the button border despite fractional CSS pixel rounding.
      if (!game.steer(brick.id, Math.max(brick.x, Math.min(brick.x + brick.w, x)), Math.max(brick.y, Math.min(brick.y + brick.h, y)))) {
        toast.textContent = 'That brick is recharging. Pick another!';
        toastUntil = performance.now() + 1800;
      }
    });
    container.append(button);
    return { button, meter };
  });
}

function showDialog(kicker, title, text, label, icon) {
  document.querySelector('#dialog-kicker').textContent = kicker;
  document.querySelector('#dialog-title').textContent = title;
  document.querySelector('#dialog-text').textContent = text;
  document.querySelector('#dialog-icon').textContent = icon;
  document.querySelector('#dialog-note').hidden = game.state !== 'ready';
  play.textContent = label;
  overlay.hidden = false;
  play.focus({ preventScroll: true });
}

function syncUI() {
  const { duration: DURATION, goal: GOAL } = game.level;
  const fraction = Math.min(1, game.score / GOAL);
  timer.innerHTML = `◷ ${Math.ceil(Math.max(0, DURATION - game.elapsed - 1e-9))}<span>s</span>`;
  foodCount.innerHTML = `🍗 ${game.score} <span>/ ${GOAL}</span>`;
  hearts.textContent = '♥ '.repeat(game.hearts).trim() + ' ♡'.repeat(3 - game.hearts);
  hearts.setAttribute('aria-label', `${game.hearts} of 3 hearts`);
  progress.style.width = `${fraction * 100}%`;
  progressLabel.textContent = `${Math.round(fraction * 100)}% complete`;
  document.querySelector('#level-number').textContent = game.level.id;
  document.querySelector('.level-badge strong').textContent = game.level.id;
  document.querySelector('.level-badge span').textContent = game.levelIndex ? 'ROBO TROUBLE' : 'FIRST STEPS';
  document.querySelector('#enemy-count').textContent = `👾 ${game.enemies}`;
  const weaponText = game.weapon
    ? `${SWORDS[game.weapon.type].name} · ${Number.isFinite(game.weapon.uses) ? `${game.weapon.uses} hits` : `${Math.ceil(game.weapon.expires - game.elapsed)}s`}`
    : 'No sword equipped';
  if (weaponStatus.textContent !== weaponText) weaponStatus.textContent = weaponText;
  pause.disabled = !['playing', 'paused'].includes(game.state);
  pause.textContent = game.state === 'paused' ? '▶ Resume' : 'Ⅱ Pause';
  for (const [i, brick] of game.bricks.entries()) {
    const remaining = Math.max(0, brick.readyAt - game.elapsed);
    buttons[i].button.setAttribute('aria-disabled', String(remaining > 1e-9));
    buttons[i].button.tabIndex = game.state === 'playing' ? 0 : -1;
    buttons[i].meter.style.transform = `scaleX(${remaining / COOLDOWNS[brick.kind]})`;
  }
  if (displayedState === game.state) return;
  displayedState = game.state;
  if (game.state === 'playing') {
    overlay.hidden = true;
    status.textContent = 'Click a brick to move. Change course anytime.';
  } else if (game.state === 'paused') {
    showDialog('TAKE A BREATHER', 'A little catnap.', 'The clock and cooldowns are paused. Your snacks will be right here when you return.', 'Keep exploring →', '☾');
    status.textContent = 'Paused. No snacks lost on our watch.';
  } else if (game.state === 'won') {
    const hasNext = game.levelIndex + 1 < LEVELS.length;
    showDialog(`LEVEL ${game.level.id} COMPLETE`, 'One well-fed hero.', `You gathered ${game.score} food and defeated ${game.enemies} robots with ${Math.ceil(DURATION - game.elapsed)} seconds to spare.`, hasNext ? 'Next level →' : 'Play again →', '🏆');
    status.textContent = hasNext ? 'Level complete! Robo trouble is next.' : 'Both levels explored! Replay or choose a level.';
    toast.textContent = 'Level complete!';
  } else if (game.state === 'lost') {
    const reason = game.hearts <= 0 ? 'Koshi ran out of hearts.' : game.elapsed >= DURATION ? 'Time ran out.' : 'Koshi slipped off the edge.';
    showDialog('ANOTHER TRY, ANOTHER ADVENTURE', 'Still hungry for more?', `${reason} You collected ${game.score} of ${GOAL} food. Try redirecting mid-flight to catch a whole line of snacks!`, 'Try again →', '🐾');
    status.textContent = `${reason} Give it another go.`;
    toast.textContent = 'Try again!';
  }
}

function begin() {
  game = createGame();
  makeBrickButtons();
  displayedState = null;
  game.start();
  trail = [];
  toast.textContent = '';
  lastTime = null;
  resize();
  syncUI();
  pause.focus({ preventScroll: true });
}

play.addEventListener('click', () => {
  if (game.state === 'paused') {
    game.resume();
    lastTime = null;
    syncUI();
    pause.focus({ preventScroll: true });
  } else {
    if (game.state === 'won' && game.levelIndex + 1 < LEVELS.length) levelSelect.value = String(game.levelIndex + 1);
    begin();
  }
});
restart.addEventListener('click', begin);
levelSelect.addEventListener('change', begin);
function togglePause() {
  if (game.state === 'playing') game.pause();
  else if (game.state === 'paused') game.resume();
  lastTime = null;
  syncUI();
}
pause.addEventListener('click', togglePause);
document.addEventListener('keydown', event => {
  if (event.code === 'Escape' || (event.code === 'Space' && !['BUTTON', 'A', 'INPUT'].includes(event.target.tagName))) {
    event.preventDefault();
    togglePause();
  }
});
function autoPause() {
  if (game.state === 'playing') { game.pause(); syncUI(); }
  lastTime = null;
}
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
window.addEventListener('blur', autoPause);

function line(points, color, width = 2) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
}

function drawCat(x, y, now) {
  ctx.save();
  ctx.translate(x, y);
  if (game.weapon) {
    ctx.strokeStyle = SWORDS[game.weapon.type].color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.shadowColor = '#0008'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#abb5bd';
  ctx.beginPath();
  ctx.moveTo(-20, -8); ctx.lineTo(-22, -32); ctx.lineTo(-6, -21);
  ctx.lineTo(7, -21); ctx.lineTo(23, -32); ctx.lineTo(21, -7);
  ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#d6a4a4';
  ctx.beginPath(); ctx.moveTo(-18, -15); ctx.lineTo(-19, -25); ctx.lineTo(-11, -19); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13, -19); ctx.lineTo(20, -25); ctx.lineTo(18, -14); ctx.fill();
  line([[-10, -20], [-7, -13]], '#596571', 4);
  line([[0, -22], [0, -14]], '#596571', 4);
  line([[10, -20], [7, -13]], '#596571', 4);
  line([[-22, -3], [-16, 0]], '#596571', 3);
  line([[22, -3], [16, 0]], '#596571', 3);
  ctx.fillStyle = '#eff2ed';
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(-3, -5, -4, 7); ctx.quadraticCurveTo(0, 12, 4, 7); ctx.quadraticCurveTo(3, -5, 0, -12); ctx.fill();
  ctx.fillStyle = '#26323a';
  const blink = now % 5.5 > 5.3;
  for (const eye of [-9, 9]) {
    ctx.beginPath(); ctx.ellipse(eye, -3, 2.3, blink ? .7 : 3.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#bd8d93';
  ctx.beginPath(); ctx.moveTo(-4, 5); ctx.lineTo(4, 5); ctx.lineTo(0, 9); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#34414a'; ctx.lineWidth = 1.7;
  ctx.beginPath(); ctx.moveTo(0, 9); ctx.quadraticCurveTo(-4, 16, -8, 11); ctx.moveTo(0, 9); ctx.quadraticCurveTo(4, 16, 8, 11); ctx.stroke();
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 4; i++) line([[sign * 13, 5 + i * 2], [sign * (34 - Math.abs(i - 1.5)), -2 + i * 7]], '#d7dfdc', 1.2);
  }
  ctx.restore();
}

function render(now) {
  const WIDTH = game.width, HEIGHT = game.height;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#273941';
  for (let x = 60; x < WIDTH; x += 30) for (let y = 60; y < HEIGHT; y += 30) {
    ctx.beginPath(); ctx.arc(x, y, .8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#9dbb9e09'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, 112, 0, Math.PI * 2); ctx.stroke();
  ctx.font = '10px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#79918d44';
  ctx.fillText('K O S H I ’ S   Q U E S T', WIDTH / 2, HEIGHT - 67);
  if (game.target) {
    ctx.setLineDash([4, 8]);
    line([[game.cat.x, game.cat.y], [game.target.x, game.target.y]], '#d3ef8b30', 1);
    ctx.setLineDash([]);
    ctx.strokeStyle = '#d3ef8b'; ctx.beginPath(); ctx.arc(game.target.x, game.target.y, 6, 0, Math.PI * 2); ctx.stroke();
  }
  if (game.state === 'playing' && (game.cat.vx || game.cat.vy)) {
    trail.push({ x: game.cat.x, y: game.cat.y, born: now });
  }
  trail = trail.filter(point => now - point.born < .22);
  for (const point of trail) {
    ctx.fillStyle = `rgba(169,189,180,${Math.max(0, .14 * (1 - (now - point.born) / .22))})`;
    ctx.beginPath(); ctx.arc(point.x, point.y, 16, 0, Math.PI * 2); ctx.fill();
  }
  for (const food of game.food) {
    const left = Math.max(0, (food.expires - game.elapsed) / food.lifetime);
    ctx.save(); ctx.translate(food.x, food.y);
    ctx.fillStyle = '#0003'; ctx.beginPath(); ctx.ellipse(0, 13, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.font = '27px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(FOODS[food.type].icon, 0, 0);
    ctx.fillStyle = '#ffffff19'; ctx.fillRect(-15, -25, 30, 3);
    ctx.fillStyle = left < .25 ? '#df8c81' : '#d3ef8b'; ctx.fillRect(-15, -25, 30 * left, 3);
    ctx.restore();
  }
  for (const heart of game.healing) {
    ctx.fillStyle = '#ef9d9d'; ctx.font = '30px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('♥', heart.x, heart.y + 10);
  }
  for (const item of game.weapons) drawSword(item.x, item.y, SWORDS[item.type].color);
  for (const enemy of game.robots) drawRobot(enemy);
  if (game.weapon) drawSword(game.cat.x + 30, game.cat.y - 20, SWORDS[game.weapon.type].color);
  for (const pickup of game.pickups) {
    const age = game.elapsed - pickup.time;
    ctx.fillStyle = `rgba(211,239,139,${1 - age / .8})`;
    ctx.font = 'bold 19px "Space Grotesk", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`+${pickup.value}`, pickup.x, pickup.y - 20 - age * 45);
  }
  drawCat(game.cat.x, game.cat.y, game.elapsed);
}

function drawSword(x, y, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(.5);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(6, -14); ctx.lineTo(4, 10); ctx.lineTo(-4, 10); ctx.lineTo(-6, -14); ctx.closePath(); ctx.fill();
  line([[-10, 10], [10, 10]], color, 4);
  line([[0, 12], [0, 22]], '#8a6953', 5);
  ctx.restore();
}

function drawRobot(enemy) {
  ctx.save(); ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = '#8898a7'; ctx.strokeStyle = '#d1dce4'; ctx.lineWidth = 2;
  if (enemy.type === 'mouse') {
    for (const x of [-15, 15]) { ctx.beginPath(); ctx.arc(x, -15, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
  ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (enemy.type === 'wheel') {
    ctx.save(); ctx.rotate(enemy.distance / 19);
    for (let i = 0; i < 10; i++) {
      ctx.rotate(Math.PI / 5); line([[20, 0], [24, 0]], '#596975', 4);
    }
    ctx.restore(); ctx.fillStyle = '#b2ca75'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  }
  line([[-12,-8],[-4,-4]], '#27353d', 3); line([[12,-8],[4,-4]], '#27353d', 3);
  for (const x of [-8, 8]) {
    ctx.fillStyle = '#d46665'; ctx.fillRect(x-4,-2,8,6);
    if (enemy.type === 'mouse') for (let i = -3; i <= 3; i += 3) line([[x+i,-2],[x+i,4]], '#27353d', 1);
  }
  line([[-6,11],[0,7],[6,11]], '#27353d', 2);
  if (enemy.resting) {
    ctx.fillStyle = '#c9d4db'; ctx.beginPath(); ctx.arc(0, 17, 5, 0, Math.PI * 2); ctx.fill();
    line([[0,10],[3,15]], '#e6a1a1', 3);
  }
  ctx.restore();
}

function resize() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(board.clientWidth * ratio);
  canvas.height = Math.round(board.clientHeight * ratio);
  ctx.setTransform(canvas.width / game.width, 0, 0, canvas.height / game.height, 0, 0);
  render(performance.now() / 1000);
}

function frame(timestamp) {
  if (lastTime !== null) game.update((timestamp - lastTime) / 1000);
  lastTime = timestamp;
  syncUI();
  render(timestamp / 1000);
  if (timestamp > toastUntil && game.state === 'playing') toast.textContent = '';
  requestAnimationFrame(frame);
}

game = createGame();
makeBrickButtons();
syncUI();
new ResizeObserver(resize).observe(board);
requestAnimationFrame(frame);
})();
