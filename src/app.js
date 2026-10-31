(function () {
'use strict';

const { Game, LEVELS, SWORDS, COOLDOWNS, SLIMES, SHIELDS, FOODS, CONVEYOR_SPEED, brickEnabled, validateCustomLevel, levelObjective, brickShape, brickRecharge, brickSlime, brickSpring, brickSpikes, brickConveyor } = globalThis.KoshiGame;
const { decorateBrick, updateBrick, exposePortalCloud, exposeBrickInfo, specialLabel, drawBoost } = globalThis.KoshiBrickVisuals;
const { GUIDE, LESSONS, Tutorial } = globalThis.KoshiLearning;
const { SaveSlots } = globalThis.KoshiSaves;

let game;
const canvas = document.querySelector('#canvas');
const actorCanvas = document.querySelector('#actors');
const boardCtx = canvas.getContext('2d');
// Koshi is drawn on a canvas layered above the brick buttons so he is never hidden by them.
const actorCtx = actorCanvas.getContext('2d');
let ctx = boardCtx;
const FOOD_COLORS = { S: '#ff2d55', P: '#ff9f0a', B: '#ffd60a', C: '#ffcc00', L: '#ff6b2c', F: '#0a84ff', H: '#34c759' };
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
for (const [index, level] of LEVELS.entries()) {
  const option = document.createElement('option');
  option.value = String(index);
  option.textContent = `${level.id} · ${level.name}`;
  levelSelect.append(option);
}
const titleScreen = document.querySelector('#title-screen');
const phaseTransition = new globalThis.KoshiPhaseTransition();
const saveDialog = document.querySelector('#save-slots');
const saves = new SaveSlots(LEVELS.map(level => level.id));
let activeSave = null;
let runSave = null;
const pendingSaves = [];
const weaponStatus = document.querySelector('#weapon-status');
const weaponIcon = document.querySelector('#weapon-icon');
const weaponRemaining = document.querySelector('#weapon-remaining');
const colors = { normal: '#83bca1', slow: '#7eacdb', fast: '#df8c81', cinder: '#969b99' };
let lastTime = null;
let displayedState = null;
let ending = null;
const endingMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let toastUntil = 0;
let trail = [];
let buttons = [];
let brickRevision = -1;
let customLevel = null;
let displayedStuck = false;
let tutorial = null;
let guideIndex = 0;
const guide = document.querySelector('#how-to-play');
const cutscene = new globalThis.KoshiCutscenePlayer((context, character, time, speaking) => {
  const previous = ctx;
  ctx = context;
  if (character === 'koshi') drawCat(0, 0, time);
  else drawRobot({ type: character, x: 0, y: 0, age: time, facingAngle: 0, distance: time * 25, speaking });
  ctx = previous;
}, startLevel, action => phaseTransition.run(action));

if (location.hash.startsWith('#level=')) {
  try {
    customLevel = validateCustomLevel(JSON.parse(decodeURIComponent(location.hash.slice(7))));
    const option = document.createElement('option');
    option.value = 'custom';
    option.textContent = `Editor · ${customLevel.id}`;
    levelSelect.append(option);
    levelSelect.value = 'custom';
    document.querySelector('#editor-link').href = `./editor.html${location.hash}`;
    document.querySelector('#dialog-text').textContent = `${levelObjective(customLevel)}. This is your custom level from the editor.`;
  } catch (error) {
    console.error('Custom level could not be loaded:', error);
    const message = document.querySelector('#level-error');
    message.textContent = `Custom level could not be loaded: ${error.message} Open the editor to fix it. The built-in levels are still available.`;
    message.hidden = false;
  }
}

function layoutOptions() {
  const portrait = window.matchMedia('(max-width: 760px) and (orientation: portrait)').matches;
  board.dataset.portrait = String(portrait);
  return { portrait, scale: portrait ? board.clientWidth / 600 : 1 };
}

function createGame() {
  return new Game(Math.random, {
    ...layoutOptions(),
    level: levelSelect.value === 'custom' ? 0 : Number(levelSelect.value),
    customLevel: levelSelect.value === 'custom' ? customLevel : null,
  });
}

function saveError(message) {
  for (const id of ['#save-error', '#save-title-error', '#save-menu-error']) {
    const element = document.querySelector(id);
    element.textContent = message;
    element.hidden = !message;
  }
  for (const id of ['#save-retry', '#save-title-retry', '#save-menu-retry']) {
    document.querySelector(id).hidden = !pendingSaves.length;
  }
  document.querySelector('#save-discard').hidden = !pendingSaves.length;
}

function saveAttempt(action) {
  try {
    action();
    if (!pendingSaves.length) saveError('');
    return true;
  } catch (error) {
    console.error('Campaign save:', error);
    saveError(`${pendingSaves.length ? 'Progress has not been saved. Keep this page open and retry, or discard unsaved wins in Save slots. ' : 'Save action failed. '}${error.message}`);
    return false;
  }
}

function saveProgress(slot) {
  const next = saves.nextLevel(slot);
  return slot.completed.length === LEVELS.length
    ? 'Campaign complete! You can replay the final level.'
    : `${slot.completed.length} / ${LEVELS.length} levels completed. Continue at Level ${LEVELS[next].id}.`;
}

function updateSaveProfile() {
  const text = activeSave
    ? `Save slot ${activeSave.index + 1}: ${activeSave.slot.owner}. ${saveProgress(activeSave.slot)}`
    : 'Guest play - progress is not saved.';
  document.querySelector('#save-profile').textContent = text;
}

function flushSaves() {
  while (pendingSaves.length) {
    const pending = pendingSaves[0];
    const slot = saves.complete(pending.index, pending.id, pending.levelId);
    pendingSaves.shift();
    if (activeSave?.slot.id === slot.id) activeSave.slot = slot;
  }
  updateSaveProfile();
}

function saveVictory() {
  if (!runSave || tutorial || game.customLevel) return;
  if (!pendingSaves.some(pending => pending.id === runSave.id && pending.levelId === game.level.id)) {
    pendingSaves.push({ ...runSave, levelId: game.level.id });
  }
  saveAttempt(flushSaves);
}

function continueSave(index, id) {
  const slots = saves.load(), slot = saves.slot(slots, index, id);
  activeSave = { index, slot };
  levelSelect.value = String(saves.nextLevel(slot));
  begin();
  board.scrollIntoView({ block: 'center' });
}

function renderSaveSlots() {
  const list = document.querySelector('#save-slot-list');
  list.replaceChildren();
  const slots = saves.load();
  if (activeSave) {
    const slot = slots[activeSave.index];
    activeSave = slot?.id === activeSave.slot.id ? { index: activeSave.index, slot } : null;
  }
  updateSaveProfile();
  slots.forEach((slot, index) => {
    const section = document.createElement('section'), heading = document.createElement('h3');
    section.className = 'save-slot';
    heading.textContent = `Slot ${index + 1}${slot ? ` - ${slot.owner}` : ' - Empty'}`;
    section.append(heading);
    if (slot) {
      const progress = document.createElement('p'), actions = document.createElement('div');
      progress.textContent = saveProgress(slot);
      actions.className = 'save-actions';
      const resume = document.createElement('button'), remove = document.createElement('button');
      resume.type = remove.type = 'button';
      resume.className = remove.className = 'title-secondary';
      resume.textContent = slot.completed.length === LEVELS.length ? 'Replay final level' : 'Continue';
      resume.setAttribute('aria-label', `${resume.textContent} for ${slot.owner}, slot ${index + 1}`);
      resume.addEventListener('click', () => saveAttempt(() => continueSave(index, slot.id)));
      remove.textContent = 'Delete save';
      remove.setAttribute('aria-label', `Delete save for ${slot.owner}, slot ${index + 1}`);
      remove.addEventListener('click', () => {
        if (!confirm(`Delete ${slot.owner}'s save in slot ${index + 1}? This erases all progress in this slot.`)) return;
        saveAttempt(() => {
          saves.remove(index, slot.id);
          for (let i = pendingSaves.length - 1; i >= 0; i--) {
            if (pendingSaves[i].id === slot.id) pendingSaves.splice(i, 1);
          }
          if (runSave?.id === slot.id) runSave = null;
          renderSaveSlots();
          document.querySelector('#save-close').focus({ preventScroll: true });
        });
      });
      actions.append(resume, remove);
      section.append(progress, actions);
    }
    const form = document.createElement('form'), label = document.createElement('label');
    const input = document.createElement('input'), submit = document.createElement('button');
    input.id = `save-owner-${index}`;
    input.name = 'owner';
    input.type = 'text';
    input.maxLength = 32;
    input.required = true;
    input.autocomplete = 'off';
    input.value = slot?.owner ?? '';
    label.htmlFor = input.id;
    label.textContent = `Owner name for slot ${index + 1}`;
    label.append(input);
    submit.type = 'submit';
    submit.className = 'title-secondary';
    submit.textContent = slot ? 'Save name' : 'Create & play';
    form.addEventListener('submit', event => {
      event.preventDefault();
      saveAttempt(() => {
        if (slot) {
          saves.rename(index, slot.id, input.value);
          renderSaveSlots();
          document.querySelector(`#save-owner-${index}`).focus({ preventScroll: true });
        } else {
          const created = saves.create(index, input.value);
          continueSave(index, created.id);
        }
      });
    });
    form.append(label, submit);
    section.append(form);
    list.append(section);
  });
}

document.querySelector('#title-saves').addEventListener('click', () => {
  autoPause();
  titleScreen.close();
  saveAttempt(renderSaveSlots);
  saveDialog.showModal();
});
function closeSaves() {
  saveDialog.close();
  titleScreen.showModal();
  document.querySelector('#title-saves').focus({ preventScroll: true });
}
document.querySelector('#save-close').addEventListener('click', closeSaves);
saveDialog.addEventListener('cancel', event => { event.preventDefault(); closeSaves(); });
saveDialog.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeSaves(); }
});
document.querySelector('#save-guest').addEventListener('click', () => {
  activeSave = null;
  runSave = null;
  updateSaveProfile();
  closeSaves();
});
for (const id of ['#save-retry', '#save-title-retry', '#save-menu-retry']) {
  document.querySelector(id).addEventListener('click', () => {
    if (saveAttempt(flushSaves) && saveDialog.open) saveAttempt(renderSaveSlots);
  });
}
document.querySelector('#save-discard').addEventListener('click', () => {
  if (!confirm('Discard all wins that could not be saved? They cannot be recovered. Existing saved progress will not change.')) return;
  pendingSaves.length = 0;
  saveError('');
});

function makeBrickButtons() {
  const container = document.querySelector('#bricks');
  container.replaceChildren();
  brickRevision = game.brickRevision;
  const parts = game.brickParts();
  buttons = game.bricks.filter(brick => brick.absorbedBy === null).map(brick => {
    const members = parts.filter(part => part.id === brick.id);
    const merged = members.length > 1;
    const outlined = merged || brick.crumbler || brick.slimed || brick.springs;
    const part = outlined ? brickShape(members, Boolean(brick.crumbler)) : members[0];
    const recharge = brickRecharge(members, game.bricks, game.perimeter, game.width, game.height);
    const button = document.createElement('button');
    button.className = 'brick';
    button.classList.toggle('cinder', brick.kind === 'cinder');
    button.disabled = brick.kind === 'cinder';
    button.classList.toggle('crumbler', Boolean(brick.crumbler));
    button.classList.toggle('warped', Boolean(brick.warped));
    button.classList.toggle('slimed', Boolean(brick.slimed));
    button.classList.toggle('springs', Boolean(brick.springs));
    button.dataset.id = brick.id;
    button.style.cssText = `left:${part.x / game.width * 100}%;top:${part.y / game.height * 100}%;width:${part.w / game.width * 100}%;height:${part.h / game.height * 100}%;--brick-color:${colors[brick.kind]}`;
    if (brick.crumbler) button.style.clipPath = part.clipPath;
    if (merged) {
      button.classList.add('brick-merged');
      button.style.clipPath = part.roundedClipPath;
      for (const { part: member, direction, start, scale } of recharge) {
        const surface = document.createElement('span');
        surface.className = 'brick-surface';
        surface.setAttribute('aria-hidden', 'true');
        surface.style.cssText = `left:${(member.x - part.x) / part.w * 100}%;top:${(member.y - part.y) / part.h * 100}%;width:${member.w / part.w * 100}%;height:${member.h / part.h * 100}%;--surface-start:${start}%;--surface-scale:${scale};--recharge-direction:to ${direction};--pattern-x:calc(${-member.x}px * var(--board-scale-x));--pattern-y:calc(${-member.y}px * var(--board-scale-y));`;
        button.append(surface);
      }
    } else {
      button.style.setProperty('--recharge-direction', `to ${recharge[0].direction}`);
    }
    if (outlined) {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.classList.add('brick-outline');
      svg.setAttribute('viewBox', '0 0 1 1');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', part.roundedPath);
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.append(path);
      button.append(svg);
      if (brick.springs) {
        const spring = svg.cloneNode(false);
        spring.setAttribute('class', 'brick-spring');
        const geometry = brickSpring(members, game.width, game.height);
        const coils = path.cloneNode();
        coils.setAttribute('class', 'spring-coils');
        coils.setAttribute('d', geometry.coils);
        const platform = path.cloneNode();
        platform.setAttribute('class', 'spring-platform');
        platform.setAttribute('d', geometry.platform);
        spring.append(coils, platform);
        for (const detail of ['grain', 'highlight']) {
          const texture = path.cloneNode();
          texture.setAttribute('class', `spring-${detail}`);
          texture.setAttribute('d', geometry[detail]);
          spring.append(texture);
        }
        button.append(spring);
      }
      if (brick.slimed) {
        const slime = svg.cloneNode(false);
        slime.setAttribute('class', 'brick-slime');
        slime.style.setProperty('--slime-color', SLIMES[brick.slimeColor ?? 'green'].color);
        const icing = path.cloneNode();
        icing.setAttribute('d', brickSlime(members, game.width, game.height));
        slime.append(icing);
        button.append(slime);
      }
      if (brick.crumbler) {
        const cracks = document.createElementNS(ns, 'svg');
        cracks.classList.add('brick-cracks');
        cracks.setAttribute('viewBox', '0 0 1 1');
        cracks.setAttribute('preserveAspectRatio', 'none');
        cracks.setAttribute('aria-hidden', 'true');
        const fissures = document.createElementNS(ns, 'path');
        fissures.setAttribute('vector-effect', 'non-scaling-stroke');
        cracks.append(fissures);
        button.append(cracks);
      }
    }
    button.addEventListener('click', event => {
      if (game.state !== 'playing') return;
      const bounds = board.getBoundingClientRect();
      const x = event.detail === 0 ? brick.x + brick.w / 2 : (event.clientX - bounds.left - board.clientLeft) / board.clientWidth * game.width;
      const y = event.detail === 0 ? brick.y + brick.h / 2 : (event.clientY - bounds.top - board.clientTop) / board.clientHeight * game.height;
      // Include clicks on the button border despite fractional CSS pixel rounding.
      const steering = tutorial ?? game;
      if (!steering.steer(brick.id, Math.max(part.x, Math.min(part.x + part.w, x)), Math.max(part.y, Math.min(part.y + part.h, y)))) {
        toast.textContent = game.stuckUntil > game.elapsed + 1e-9 ? ''
          : !brickEnabled(brick) ? `That toggle needs ${brick.toggleRemaining} more successful clicks of other bricks.`
          : brick.usesLeft === 0 ? 'That Crumbler is permanently deactivated. Pick another!'
          : brick.readyAt > game.elapsed + 1e-9 ? 'That brick is recharging. Pick another!'
          : "Koshi can't move toward that spot. Pick another!";
        toastUntil = performance.now() + 1800;
      }
    });
    container.append(button);
    const spring = button.querySelector('.brick-spring');
    if (spring) {
      spring.style.cssText = `left:${part.x / game.width * 100}%;top:${part.y / game.height * 100}%;width:${part.w / game.width * 100}%;height:${part.h / game.height * 100}%;`;
      container.append(spring);
    }
    if (brick.spikes) {
      const ns = 'http://www.w3.org/2000/svg';
      const spikes = document.createElementNS(ns, 'svg');
      spikes.setAttribute('class', 'brick-spikes');
      spikes.setAttribute('viewBox', '0 0 1 1');
      spikes.setAttribute('preserveAspectRatio', 'none');
      spikes.setAttribute('aria-hidden', 'true');
      spikes.dataset.id = brick.id;
      spikes.style.cssText = `left:${part.x / game.width * 100}%;top:${part.y / game.height * 100}%;width:${part.w / game.width * 100}%;height:${part.h / game.height * 100}%;`;
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', brickSpikes(members, game.width, game.height).path);
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      spikes.append(path);
      container.append(spikes);
    }
    let conveyor = null;
    if (brick.conveyor) {
      const ns = 'http://www.w3.org/2000/svg';
      conveyor = document.createElementNS(ns, 'svg');
      conveyor.setAttribute('class', 'brick-conveyor');
      conveyor.setAttribute('viewBox', '0 0 1 1');
      conveyor.setAttribute('preserveAspectRatio', 'none');
      conveyor.setAttribute('aria-hidden', 'true');
      conveyor.style.cssText = `left:${part.x / game.width * 100}%;top:${part.y / game.height * 100}%;width:${part.w / game.width * 100}%;height:${part.h / game.height * 100}%;`;
      const geometry = brickConveyor(members, game.width, game.height, 0, brick.conveyorDirection);
      for (const detail of ['belt', 'teeth', 'arrows']) {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('class', `conveyor-${detail}`);
        path.setAttribute('d', geometry[detail]);
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        conveyor.append(path);
      }
      container.append(conveyor);
    }
    const special = decorateBrick(button, brick, members);
    exposePortalCloud(special, container);
    exposeBrickInfo(special, container, brick, game.width, game.height);
    return { brick, button, members, spring, conveyor, special, spikes: container.querySelector(`.brick-spikes[data-id="${brick.id}"]`), usesLeft: null };
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
  const stuck = game.stuckUntil > game.elapsed + 1e-9;
  if (stuck !== displayedStuck) {
    displayedStuck = stuck;
    if (game.state === 'playing') {
      toast.textContent = stuck ? '' : 'Free of the slime! Pick a brick to move.';
      toastUntil = performance.now() + 1800;
      status.textContent = stuck ? '' : toast.textContent;
    }
  }
  const { duration: DURATION, goal: GOAL, killGoal = 0, survive = false } = game.level;
  const foodTarget = !survive && GOAL > 0 && Number.isFinite(GOAL);
  const enemyTarget = !survive && killGoal > 0 && Number.isFinite(killGoal);
  const fraction = survive ? Math.min(1, game.elapsed / DURATION)
    : Math.min(1, GOAL > 0 ? game.score / GOAL : 1, killGoal > 0 ? game.enemies / killGoal : 1);
  timer.innerHTML = Number.isFinite(DURATION) ? `◷ ${Math.ceil(Math.max(0, DURATION - game.elapsed - 1e-9))}<span>s</span>` : '◷ ∞';
  foodCount.innerHTML = `🍗 ${game.score}${foodTarget ? ` <span>/ ${GOAL}</span>` : ''}`;
  timer.classList.toggle('win-target', survive);
  foodCount.classList.toggle('win-target', foodTarget);
  foodCount.setAttribute('aria-label', foodTarget ? `${game.score} of ${GOAL} food collected` : `${game.score} food collected`);
  hearts.textContent = '♥ '.repeat(game.hearts).trim() + ' ♡'.repeat(3 - game.hearts);
  hearts.setAttribute('aria-label', `${game.hearts} of 3 hearts`);
  const heartCost = game.level.heartCost;
  const heartSpawning = Number.isFinite(heartCost) && heartCost > 0;
  document.querySelector('#heart-cost').hidden = !heartSpawning;
  if (heartSpawning) {
    const earned = Math.max(0, Math.min(heartCost, game.score - (game.nextHeart - heartCost)));
    document.querySelector('#heart-cost-numbers').textContent = `${earned}/${heartCost}`;
    const meter = document.querySelector('#heart-cost-meter');
    meter.setAttribute('aria-valuemax', heartCost);
    meter.setAttribute('aria-valuenow', earned);
    meter.setAttribute('aria-valuetext', `${earned} of ${heartCost} food toward the next healing heart`);
    document.querySelector('#heart-cost-fill').style.width = `${earned / heartCost * 100}%`;
  }
  progress.style.width = `${fraction * 100}%`;
  progressLabel.textContent = `${Math.round(fraction * 100)}% complete`;
  document.querySelector('#level-number').textContent = game.level.id;
  document.querySelector('.level-badge strong').textContent = game.level.id;
  document.querySelector('.level-badge span').textContent = game.customLevel ? 'CUSTOM LEVEL' : game.level.name?.toUpperCase() ?? (game.levelIndex ? 'ROBO TROUBLE' : 'FIRST STEPS');
  document.querySelector('.objective strong').textContent = levelObjective(game.level);
  const enemyCount = document.querySelector('#enemy-count');
  enemyCount.textContent = `👾 ${game.enemies}${enemyTarget ? ` / ${killGoal}` : ''}`;
  enemyCount.classList.toggle('win-target', enemyTarget);
  enemyCount.setAttribute('aria-label', enemyTarget ? `${game.enemies} of ${killGoal} enemy points earned` : `${game.enemies} enemy points earned`);
  const weaponCount = game.weapon
    ? Number.isFinite(game.weapon.uses) ? game.weapon.uses : Math.ceil(Math.max(0, game.weapon.expires - game.elapsed))
    : null;
  const timedWeapon = game.weapon && !Number.isFinite(game.weapon.uses);
  const weaponText = game.weapon ? `${weaponCount}${timedWeapon ? 's' : ''}` : '—';
  if (weaponRemaining.textContent !== weaponText) weaponRemaining.textContent = weaponText;
  weaponIcon.toggleAttribute('hidden', !game.weapon);
  if (game.weapon) weaponIcon.style.color = SWORDS[game.weapon.type].color;
  const weaponLabel = game.weapon
    ? `Weapon: ${SWORDS[game.weapon.type].name}, ${weaponCount} ${timedWeapon ? 'seconds' : 'attacks'} remaining`
    : 'Weapon: no sword equipped';
  if (weaponStatus.getAttribute('aria-label') !== weaponLabel) weaponStatus.setAttribute('aria-label', weaponLabel);
  if (tutorial) updateTutorial();
  pause.disabled = !['playing', 'paused'].includes(game.state);
  const pauseLabel = game.state === 'paused' ? 'Resume' : 'Pause';
  pause.querySelector('.pause-bars').toggleAttribute('hidden', game.state === 'paused');
  pause.querySelector('.resume-triangle').toggleAttribute('hidden', game.state !== 'paused');
  pause.querySelector('.control-label').textContent = pauseLabel;
  pause.setAttribute('aria-label', pauseLabel);
  pause.title = pauseLabel;
  if (brickRevision !== game.brickRevision) {
    const focusedId = document.activeElement?.closest('.brick')?.dataset.id;
    makeBrickButtons();
    if (focusedId !== undefined) buttons.find(item => String(item.brick.id) === focusedId)?.button.focus({ preventScroll: true });
  }
  for (const item of buttons) {
    const { brick, button, members } = item;
    if (brick.crumbler && item.usesLeft !== brick.usesLeft) {
      item.usesLeft = brick.usesLeft;
      const wear = 1 - brick.usesLeft / brick.crumbler;
      const shape = brickShape(members, true, wear);
      button.style.clipPath = shape.clipPath;
      button.style.setProperty('--crumbler-wear', wear);
      for (const path of button.querySelectorAll('.brick-outline path')) path.setAttribute('d', shape.roundedPath);
      button.querySelector('.brick-cracks path').setAttribute('d', shape.cracks);
    }
    const remaining = Math.max(0, brick.readyAt - game.elapsed);
    const warpSeconds = brick.warpUntil === null || brick.usesLeft === 0 ? null : Math.max(0, Math.ceil(brick.warpUntil - game.elapsed - 1e-9));
    button.setAttribute('aria-disabled', String(brick.kind === 'cinder' || stuck || !brickEnabled(brick) || remaining > 1e-9 || brick.usesLeft === 0));
    if (item.special) updateBrick(item.special, brick, game.elapsed);
    if (item.special?.symbol) item.special.symbol.style.animationPlayState = game.state === 'playing' ? 'running' : 'paused';
    for (const surface of [item.spring, item.conveyor, item.spikes]) {
      if (surface) surface.style.opacity = brickEnabled(brick) ? '1' : '.25';
    }
    if (brick.springs) {
      const age = brick.hitAt === null ? 1 : game.elapsed - brick.hitAt;
      const compression = age > 0 && age < .32 ? Math.sin(Math.PI * age / .32) : 0;
      if (item.springCompression !== compression) {
        item.springCompression = compression;
        const geometry = brickSpring(members, game.width, game.height, compression);
        for (const detail of ['platform', 'coils', 'grain', 'highlight']) {
          item.spring.querySelector(`.spring-${detail}`).setAttribute('d', geometry[detail]);
        }
      }
    }
    if (item.conveyor) {
      const geometry = brickConveyor(members, game.width, game.height, game.elapsed * CONVEYOR_SPEED, brick.conveyorDirection);
      item.conveyor.querySelector('.conveyor-teeth').setAttribute('d', geometry.teeth);
    }
    button.dataset.deactivated = String(brick.usesLeft === 0);
    const label = `${brick.kind} brick ${brick.id + 1}, ${brick.kind === 'cinder' ? 'solid, cannot activate or be absorbed' : `${COOLDOWNS[brick.kind]} second cooldown`}${brick.crumbler ? `, Crumbler: ${brick.usesLeft} selections left${brick.usesLeft === 0 ? ', permanently deactivated' : ''}` : ''}${brick.warped ? `, Warped: ${brick.usesLeft === 0 ? 'frozen until restart or absorption' : warpSeconds === null ? `${brick.warped} second duration` : `${warpSeconds} seconds until restoration`}` : ''}${brick.slimed ? `, ${brick.slimeColor ?? 'green'} slime: sticks for ${SLIMES[brick.slimeColor ?? 'green'].duration} seconds` : ''}${brick.springs ? ', Springs: reflects Koshi' : ''}${brick.spikes ? ', Spikes: loses one heart on contact' : ''}${brick.conveyor ? `, Conveyor: carries Koshi ${brick.conveyorDirection ?? 'clockwise'}` : ''}${specialLabel(brick)}${tutorial?.target.id === brick.id ? ', suggested tutorial target' : ''}`;
    if (button.getAttribute('aria-label') !== label) {
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    button.tabIndex = game.state === 'playing' && brick.kind !== 'cinder' ? 0 : -1;
    button.classList.toggle('tutorial-target', Boolean(tutorial && tutorial.target.id === brick.id));
    button.style.setProperty('--cooldown-fill', `${brick.kind === 'cinder' ? 100 : brick.usesLeft === 0 ? 0 : Math.max(0, 1 - remaining / COOLDOWNS[brick.kind]) * 100}%`);
  }
  if (ending?.game !== game || ending?.state !== game.state) ending = null;
  if (['won', 'lost'].includes(game.state) && !ending) {
    ending = { game, state: game.state, elapsed: 0, duration: game.state === 'won' ? 2.4 : 1.8 };
    if (game.state === 'won' && !tutorial) saveVictory();
    overlay.hidden = true;
    toast.textContent = '';
    status.textContent = game.state === 'won' ? 'Level complete! Koshi is celebrating.' : 'Koshi needs another try.';
  }
  if (ending && !endingMotion.matches && ending.elapsed < ending.duration) return;
  if (displayedState === game.state) return;
  displayedState = game.state;
  if (game.state === 'ready') {
    const description = game.customLevel
      ? `${levelObjective(game.level)}. This is your custom level from the editor.`
      : `Click a brick to send Koshi toward it. ${levelObjective(game.level)}!`;
    showDialog('READY, LITTLE HERO?', 'Follow your appetite.', description, "Let's play →", '🐾');
    status.textContent = 'Your next adventure is one click away.';
  } else if (game.state === 'playing') {
    overlay.hidden = true;
    status.textContent = stuck ? '' : 'Click a brick to move. Change course anytime.';
  } else if (game.state === 'paused') {
    showDialog('TAKE A BREATHER', 'A little catnap.', 'The clock and cooldowns are paused. Your snacks will be right here when you return.', 'Keep exploring →', '☾');
    status.textContent = 'Paused. No snacks lost on our watch.';
  } else if (game.state === 'won') {
    if (tutorial) {
      overlay.hidden = true;
      status.textContent = 'Practice challenge complete. Choose another step or exit to the title.';
      return;
    }
    const hasNext = !game.customLevel && game.levelIndex + 1 < LEVELS.length;
    showDialog(`LEVEL ${game.level.id} COMPLETE`, 'One well-fed hero.', survive
      ? `You survived all ${DURATION} seconds! You gathered ${game.score} food and earned ${game.enemies} enemy points.`
      : `You gathered ${game.score} food and earned ${game.enemies} enemy points with ${Math.ceil(DURATION - game.elapsed)} seconds to spare.`, hasNext ? 'Next level →' : 'Play again →', '🏆');
    status.textContent = hasNext ? `Level complete! Level ${LEVELS[game.levelIndex + 1].id} is next.` : 'Level complete! Replay or choose a level.';
    toast.textContent = 'Level complete!';
  } else if (game.state === 'lost') {
    if (tutorial) {
      showDialog('PRACTICE MAKES PROGRESS', 'Try that step again.', 'Nothing lost! Retry this step, or choose any other topic in the tutorial menu.', 'Retry step →', '🐾');
      return;
    }
    const reason = game.hearts <= 0 ? 'Koshi ran out of hearts.' : game.elapsed >= DURATION ? 'Time ran out.' : 'Koshi slipped off the edge.';
    const result = survive ? ` You survived ${Math.floor(game.elapsed)} of ${DURATION} seconds.`
      : `${foodTarget ? ` You collected ${game.score} of ${GOAL} food.` : ''}${enemyTarget ? ` You earned ${game.enemies} of ${killGoal} enemy points. Pick up a sword before taking on robots!` : ''}`;
    showDialog('ANOTHER TRY, ANOTHER ADVENTURE', 'Still hungry for more?', `${reason}${result}`, 'Try again →', '🐾');
    status.textContent = `${reason} Give it another go.`;
    toast.textContent = 'Try again!';
  }
}

function begin() {
  if (tutorial) { selectTutorial(tutorial.index); return; }
  phaseTransition.run(() => {
    for (const dialog of [titleScreen, saveDialog, levelPicker]) if (dialog.open) dialog.close();
    game = createGame();
    runSave = activeSave && !game.customLevel ? { index: activeSave.index, id: activeSave.slot.id } : null;
    updateSaveProfile();
    makeBrickButtons();
    displayedState = null;
    trail = [];
    toast.textContent = '';
    lastTime = null;
    resize();
    syncUI();
    if (game.level.cutscene) cutscene.open(game.level.cutscene, game.level.id);
    else startLevel();
  });
}

function startLevel() {
  game.start();
  lastTime = null;
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
    if (game.state === 'won' && !game.customLevel && game.levelIndex + 1 < LEVELS.length) levelSelect.value = String(game.levelIndex + 1);
    begin();
  }
});
restart.addEventListener('click', begin);
document.querySelector('#title-start').addEventListener('click', () => {
  begin();
  board.scrollIntoView({ block: 'center' });
});
document.querySelector('#title-levels').addEventListener('click', () => {
  levelBeforePicker = levelSelect.value;
  titleScreen.close();
  levelPicker.showModal();
  levelSelect.focus();
});
const levelPicker = document.querySelector('#level-picker');
let levelBeforePicker = levelSelect.value;
function closeLevelPicker() {
  levelSelect.value = levelBeforePicker;
  levelPicker.close();
  titleScreen.showModal();
  document.querySelector('#title-levels').focus({ preventScroll: true });
}
document.querySelector('#level-picker-close').addEventListener('click', closeLevelPicker);
levelPicker.addEventListener('cancel', event => { event.preventDefault(); closeLevelPicker(); });
levelPicker.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeLevelPicker(); }
});
document.querySelector('#level-picker-play').addEventListener('click', () => {
  begin();
});
function dismissTitle() {
  phaseTransition.run(() => {
    titleScreen.close();
    play.focus({ preventScroll: true });
  });
}
titleScreen.addEventListener('cancel', event => {
  event.preventDefault();
  dismissTitle();
});
function showTitle() {
  autoPause();
  phaseTransition.run(() => {
    if (tutorial) {
      tutorial = null;
      runSave = null;
      document.body.classList.remove('tutorial-active');
      document.querySelector('#tutorial-panel').hidden = true;
      game = createGame();
      makeBrickButtons();
      displayedState = null;
      displayedStuck = false;
      toast.textContent = '';
      trail = [];
      resize();
      syncUI();
    }
    if (!titleScreen.open) titleScreen.showModal();
    updateSaveProfile();
    document.querySelector('#title-tutorial').focus({ preventScroll: true });
  });
}
document.querySelector('#title-menu').addEventListener('click', showTitle);
document.querySelector('#tutorial-exit').addEventListener('click', showTitle);

function updateTutorial() {
  const completed = tutorial.observe();
  const result = document.querySelector('#tutorial-result');
  const text = completed ? 'Step complete! Keep practicing or choose another step.' : 'Practice on the board. Jump to any step anytime.';
  if (result.textContent !== text) result.textContent = text;
  document.querySelector('#tutorial-progress').textContent = `${tutorial.completed.size} / ${LESSONS.length} learned`;
  for (const [index, option] of [...document.querySelector('#tutorial-step').options].entries()) {
    const label = `${index + 1}. ${LESSONS[index].title}${tutorial.completed.has(LESSONS[index].id) ? ' (done)' : ''}`;
    if (option.textContent !== label) option.textContent = label;
  }
}

function selectTutorial(index) {
  game = tutorial.select(index, layoutOptions());
  document.querySelector('#tutorial-step').value = String(index);
  document.querySelector('#tutorial-instruction').textContent = tutorial.lesson.instruction;
  document.querySelector('#tutorial-prev').disabled = index === 0;
  document.querySelector('#tutorial-next').textContent = index === LESSONS.length - 1 ? 'Finish tutorial' : 'Next';
  document.querySelector('#tutorial-sword-label').hidden = !['mouse', 'wheel', 'ram', 'bucket', 'objectives'].includes(tutorial.lesson.id);
  makeBrickButtons();
  displayedState = null;
  displayedStuck = false;
  lastTime = null;
  trail = [];
  toast.textContent = '';
  resize();
  syncUI();
}

function startTutorial(index = 0) {
  phaseTransition.run(() => {
    if (titleScreen.open) titleScreen.close();
    if (guide.open) guide.close();
    tutorial = new Tutorial();
    runSave = null;
    updateSaveProfile();
    document.body.classList.add('tutorial-active');
    document.querySelector('#tutorial-panel').hidden = false;
    document.querySelector('#tutorial-sword').value = tutorial.sword;
    selectTutorial(index);
    document.querySelector('#tutorial-step').focus({ preventScroll: true });
  });
}
for (const [index, lesson] of LESSONS.entries()) {
  const option = document.createElement('option');
  option.value = String(index); option.textContent = `${index + 1}. ${lesson.title}`;
  document.querySelector('#tutorial-step').append(option);
}
document.querySelector('#title-tutorial').addEventListener('click', () => startTutorial());
document.querySelector('#tutorial-step').addEventListener('change', event => selectTutorial(Number(event.target.value)));
document.querySelector('#tutorial-prev').addEventListener('click', () => selectTutorial(tutorial.index - 1));
document.querySelector('#tutorial-retry').addEventListener('click', () => selectTutorial(tutorial.index));
document.querySelector('#tutorial-next').addEventListener('click', () => {
  if (tutorial.index === LESSONS.length - 1) showTitle();
  else selectTutorial(tutorial.index + 1);
});
document.querySelector('#tutorial-sword').addEventListener('change', event => {
  tutorial.sword = event.target.value;
  selectTutorial(tutorial.index);
});

function guidePicture(picture, title) {
  if (picture.startsWith('special:')) {
    const type = picture.slice(8), image = document.createElement('div');
    image.className = 'guide-special-brick';
    image.setAttribute('role', 'img'); image.setAttribute('aria-label', title);
    const brick = { x: 0, y: 0, w: 160, h: 70,
      kind: type === 'cinder' ? 'cinder' : 'normal',
      portal: type === 'portal' ? 'purple' : null, toggle: type === 'toggle' ? 4 : null,
      toggleRemaining: type === 'toggle' ? 4 : 0, boost: type === 'boost',
      spawner: type === 'spawner' ? { kind: 'enemy', type: 'mouse' } : null };
    decorateBrick(image, brick, [brick]);
    return image;
  }
  const image = document.createElement('canvas');
  image.className = 'guide-picture';
  image.width = 320; image.height = 160;
  image.setAttribute('role', 'img');
  image.setAttribute('aria-label', title);
  const previous = ctx;
  ctx = image.getContext('2d');
  ctx.scale(2, 2);
  const [kind, type] = picture.split(':');
  if (kind === 'brick' || kind === 'slime') {
    const crumbler = type.includes('crumbler');
    const warped = type.includes('warped');
    const brick = { id: 0, x: 18, y: 22, w: 124, h: 28, region: { edge: 'top', start: 0, end: 1 } };
    const shape = brickShape([brick], crumbler, crumbler ? .4 : 0);
    ctx.save(); ctx.translate(brick.x, brick.y); ctx.scale(brick.w, brick.h);
    ctx.fillStyle = colors[type] ?? colors.normal;
    ctx.fill(new Path2D(shape.path));
    ctx.restore();
    if (warped) {
      for (let x = 28; x < 140; x += 22) {
        ctx.beginPath();
        for (let i = 0; i <= 36; i++) {
          const angle = i / 36 * Math.PI * 3, radius = 5 * i / 36;
          const px = x + Math.cos(angle) * radius, py = 35 + Math.sin(angle) * radius;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.strokeStyle = '#17232c88'; ctx.lineWidth = 1.2; ctx.stroke();
      }
    }
    const surface = (path, fill, stroke, width = 1.5) => {
      if (!path) return;
      const source = new Path2D(path), transformed = new Path2D();
      transformed.addPath(source, new DOMMatrix([brick.w, 0, 0, brick.h, brick.x, brick.y]));
      if (fill) { ctx.fillStyle = fill; ctx.fill(transformed); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(transformed); }
    };
    if (crumbler) surface(shape.cracks, null, '#080e14');
    if (kind === 'slime') surface(brickSlime([brick], 600, 960), SLIMES[type].color, '#102619');
    if (type === 'spikes') surface(brickSpikes([brick], 600, 960).path, '#fff', '#aab9c5', 1);
    if (type === 'conveyor') {
      const conveyor = brickConveyor([brick], 600, 960);
      surface(conveyor.belt, null, '#303840', 6);
      surface(conveyor.belt, null, '#8e969d', 3);
      surface(conveyor.teeth, '#adb4ba', '#303840', .8);
      surface(conveyor.arrows, '#303840');
    }
    if (type === 'springs') {
      const spring = brickSpring([brick], 600, 960);
      surface(spring.platform, '#a77a52', '#302015');
      surface(spring.grain, null, '#684128', .8);
      surface(spring.highlight, null, '#dfb47d', 1);
    }
    if (crumbler || warped) {
      ctx.fillStyle = '#111d25'; ctx.fillRect(45, 28, 70, 17);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      ctx.fillText([crumbler ? 'C:3' : '', warped ? 'W:12' : ''].filter(Boolean).join(' '), 80, 41);
    }
  } else if (kind === 'enemy') {
    drawRobot({ type, x: 80, y: 42, distance: 0 });
  } else if (kind === 'weapon') {
    ctx.save(); ctx.translate(80, 40); ctx.scale(1.25, 1.25);
    drawSword(0, 0, SWORDS[type].color); ctx.restore();
  } else {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = kind === 'heart' ? '#ef9d9d' : '#000';
    ctx.font = kind === 'heart' ? '42px sans-serif' : '36px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.fillText(kind === 'heart' ? '♥' : FOODS[type].icon, 80, 42);
  }
  ctx = previous;
  return image;
}

function showGuideChapter(index) {
  guideIndex = index;
  const content = document.querySelector('#guide-content');
  const heading = document.createElement('h3');
  heading.id = 'guide-chapter'; heading.textContent = GUIDE[index].title;
  content.replaceChildren(heading);
  for (const [title, description, picture] of GUIDE[index].sections) {
    const section = document.createElement('section'), label = document.createElement('h4'), text = document.createElement('p');
    label.textContent = title; text.textContent = description;
    if (picture) section.append(guidePicture(picture, title));
    section.append(label, text); content.append(section);
  }
  content.scrollTop = 0;
  document.querySelector('#guide-topic').value = String(index);
  document.querySelector('#guide-page').textContent = `${index + 1} / ${GUIDE.length}`;
  document.querySelector('#guide-prev').disabled = index === 0;
  document.querySelector('#guide-next').disabled = index === GUIDE.length - 1;
}
for (const [index, chapter] of GUIDE.entries()) {
  const option = document.createElement('option');
  option.value = String(index); option.textContent = chapter.title;
  document.querySelector('#guide-topic').append(option);
}
document.querySelector('#title-help').addEventListener('click', () => {
  titleScreen.close();
  showGuideChapter(guideIndex);
  guide.showModal();
  document.querySelector('#guide-topic').focus({ preventScroll: true });
});
function closeGuide() {
  guide.close();
  titleScreen.showModal();
  document.querySelector('#title-help').focus({ preventScroll: true });
}
document.querySelector('#guide-close').addEventListener('click', closeGuide);
guide.addEventListener('cancel', event => { event.preventDefault(); closeGuide(); });
guide.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeGuide(); }
});
document.querySelector('#guide-topic').addEventListener('change', event => showGuideChapter(Number(event.target.value)));
document.querySelector('#guide-prev').addEventListener('click', () => showGuideChapter(guideIndex - 1));
document.querySelector('#guide-next').addEventListener('click', () => showGuideChapter(guideIndex + 1));
document.querySelector('#guide-practice').addEventListener('click', () => {
  const id = ['aim', 'cooldown', 'crumbler', 'slime-red', 'food', 'mouse', 'warnings', 'objectives'][guideIndex];
  startTutorial(LESSONS.findIndex(lesson => lesson.id === id));
});
function togglePause() {
  if (game.state === 'playing') game.pause();
  else if (game.state === 'paused') game.resume();
  lastTime = null;
  syncUI();
}
pause.addEventListener('click', togglePause);
document.addEventListener('keydown', event => {
  if (phaseTransition.busy) { event.preventDefault(); return; }
  if (titleScreen.open && event.code === 'Escape') {
    event.preventDefault();
    dismissTitle();
    return;
  }
  if (document.querySelector('dialog[open]')) return;
  if (event.code === 'Escape' || (event.code === 'Space' && !['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName))) {
    event.preventDefault();
    togglePause();
  }
});
function isInstalledApp() {
  return window.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches || navigator.standalone === true;
}
function autoPause() {
  if (cutscene.active) cutscene.paused = true;
  if (game.state === 'playing') { game.pause(); syncUI(); }
  lastTime = null;
}
const installButton = document.getElementById('install-button');
if (installButton) installButton.addEventListener('click', autoPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
window.addEventListener('blur', () => {
  // Android's gesture UI can blur a visible installed app without leaving it.
  if (!isInstalledApp() || document.hidden) autoPause();
});

function installBackNavigation() {
  if (!isInstalledApp()) return;
  function report(error) {
    console.error('Back navigation protection could not be enabled:', error);
    const message = document.querySelector('#level-error');
    message.textContent = `Back navigation protection could not be enabled: ${error.message}. Android Back may close the app.`;
    message.hidden = false;
  }
  function arm() {
    try {
      if (history.state?.koshiBackGuard === true) return;
      // Create the guard during real input so Chromium does not skip it.
      history.replaceState({ ...history.state, koshiBackGuard: false }, '');
      history.pushState({ ...history.state, koshiBackGuard: true }, '');
    } catch (error) {
      report(error);
    }
  }
  let returning = false;
  window.navigation?.addEventListener('navigate', event => {
    if (returning || event.navigationType !== 'traverse' || !event.cancelable || !event.destination.sameDocument) return;
    const current = history.state?.koshiBackGuard;
    if (typeof current !== 'boolean' || event.destination.url !== window.location.href) return;
    // Cancel before history/scroll/focus changes, rather than navigating back
    // and forward through the browser's visual transition.
    event.preventDefault();
  });
  function restore() {
    if (history.state?.koshiBackGuard !== false || returning) return;
    try {
      returning = true;
      // Never push from popstate: Chromium skips entries created after a traversal
      // without fresh user activation. Reuse the original, activated forward entry.
      history.forward();
    } catch (error) {
      returning = false;
      report(error);
    }
  }
  window.addEventListener('popstate', () => {
    if (history.state?.koshiBackGuard === true) returning = false;
    else restore();
  });
  for (const type of ['pointerdown', 'keydown', 'click']) {
    window.addEventListener(type, event => {
      if (!event.isTrusted || returning) return;
      if (history.state?.koshiBackGuard === false) restore();
      else arm();
    }, { capture: true });
  }
  restore();
}

function line(points, color, width = 2) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
}

function drawCat(x, y, now, damageProgress = null, boostReady = false, expression = null) {
  ctx.save();
  ctx.translate(x, y);
  const hurt = damageProgress !== null;
  const darkRed = hurt && Math.floor(damageProgress * 4) % 2 === 0;
  const fur = hurt ? darkRed ? '#dc626b' : '#f2a0a5' : '#abb5bd';
  const stripes = hurt ? '#923c49' : '#596571';
  if (game.weapon && !expression) {
    ctx.strokeStyle = SWORDS[game.weapon.type].color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.shadowColor = '#0008'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.moveTo(-20, -8); ctx.lineTo(-22, -32); ctx.lineTo(-6, -21);
  ctx.lineTo(7, -21); ctx.lineTo(23, -32); ctx.lineTo(21, -7);
  ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = hurt ? '#f6b3b8' : '#d6a4a4';
  ctx.beginPath(); ctx.moveTo(-18, -15); ctx.lineTo(-19, -25); ctx.lineTo(-11, -19); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13, -19); ctx.lineTo(20, -25); ctx.lineTo(18, -14); ctx.fill();
  line([[-10, -20], [-7, -13]], stripes, 4);
  line([[0, -22], [0, -14]], stripes, 4);
  line([[10, -20], [7, -13]], stripes, 4);
  line([[-22, -3], [-16, 0]], stripes, 3);
  line([[22, -3], [16, 0]], stripes, 3);
  ctx.fillStyle = hurt ? darkRed ? '#f2a0a5' : '#ffd3d5' : '#eff2ed';
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(-3, -5, -4, 7); ctx.quadraticCurveTo(0, 12, 4, 7); ctx.quadraticCurveTo(3, -5, 0, -12); ctx.fill();
  ctx.fillStyle = '#26323a';
  const ember = `rgb(236,${Math.round(72 + (Math.sin(now * Math.PI * 2 / 1.8) + 1) * 40)},36)`;
  const blink = !hurt && !boostReady && now % 5.5 > 5.3;
  ctx.save();
  if (boostReady) {
    ctx.fillStyle = ember; ctx.shadowColor = '#ec4824'; ctx.shadowBlur = 12;
  }
  for (const eye of [-9, 9]) {
    if (expression === 'lost') {
      line([[eye - 4, -7], [eye + 4, 1]], '#26323a', 3);
      line([[eye + 4, -7], [eye - 4, 1]], '#26323a', 3);
    } else if (expression === 'won') {
      ctx.beginPath(); ctx.arc(eye, -1, 3.5, Math.PI, Math.PI * 2); ctx.strokeStyle = '#26323a'; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(eye, -3, boostReady ? 3.2 : 2.3, blink ? .7 : boostReady ? 4.2 : 3.2, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  if (hurt) {
    line([[-14, -12], [-6, -8]], '#672c39', 2.5);
    line([[6, -8], [14, -12]], '#672c39', 2.5);
  }
  ctx.fillStyle = hurt ? '#ab4759' : '#bd8d93';
  ctx.beginPath(); ctx.moveTo(-4, 5); ctx.lineTo(4, 5); ctx.lineTo(0, 9); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#34414a'; ctx.lineWidth = 1.7;
  ctx.beginPath();
  if (expression === 'won') {
    ctx.moveTo(-8, 10); ctx.quadraticCurveTo(0, 15, 8, 10);
    ctx.quadraticCurveTo(0, 28 + Math.sin(now * 10) * 2, -8, 10);
    ctx.fillStyle = '#632d38'; ctx.fill();
  } else if (boostReady) {
    ctx.save();
    ctx.fillStyle = '#6b1714'; ctx.strokeStyle = ember;
    ctx.shadowColor = '#ec4824'; ctx.shadowBlur = 14; ctx.lineWidth = 2;
    ctx.ellipse(0, 15, 8, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ember;
    ctx.beginPath(); ctx.ellipse(0, 17, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (hurt || expression === 'lost') {
    ctx.moveTo(-8, 16); ctx.quadraticCurveTo(0, 7, 8, 16);
  } else {
    ctx.moveTo(0, 9); ctx.quadraticCurveTo(-4, 16, -8, 11); ctx.moveTo(0, 9); ctx.quadraticCurveTo(4, 16, 8, 11);
  }
  if (!boostReady) ctx.stroke();
  if (expression === 'won') {
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#eff2ed';
    ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(-2, 10); ctx.lineTo(-4, 19); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, 10); ctx.lineTo(6, 10); ctx.lineTo(5, 16); ctx.lineTo(3, 16); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 4; i++) line([[sign * 13, 5 + i * 2], [sign * (34 - Math.abs(i - 1.5)), -2 + i * 7]], hurt ? '#ffd3d5' : '#d7dfdc', 1.2);
  }
  ctx.restore();
}

function updateEnding(seconds) {
  if (!ending || ending.game !== game || document.hidden || document.querySelector('dialog[open]')) return;
  ending.elapsed = Math.min(ending.duration, ending.elapsed + Math.max(0, Math.min(seconds, .1)));
}

function endingPose(sequence, width, height) {
  const progress = Math.min(1, sequence.elapsed / sequence.duration);
  const startX = Math.max(40, Math.min(width - 40, sequence.game.cat.x));
  const startY = Math.max(40, Math.min(height - 40, sequence.game.cat.y));
  if (sequence.state === 'won') {
    const approach = Math.max(0, (progress - .4) / .6);
    const eased = approach * approach * (3 - 2 * approach);
    const bounce = Math.sin(progress * Math.PI * 8) * (1 - progress);
    return {
      x: startX + (width / 2 - startX) * eased + bounce * 14,
      y: startY + (height / 2 - startY) * eased - Math.abs(bounce) * 22,
      scale: 1 + eased * 2.2, rotation: bounce * .12,
    };
  }
  return { x: startX, y: startY - Math.sin(progress * Math.PI) * 28, scale: 1, rotation: progress * Math.PI * 4 };
}

function drawEnding() {
  const pose = endingPose(ending, game.width, game.height);
  ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(pose.rotation); ctx.scale(pose.scale, pose.scale);
  drawCat(0, 0, ending.elapsed, null, false, ending.state);
  ctx.restore();
}

function render(now) {
  const WIDTH = game.width, HEIGHT = game.height;
  ctx = boardCtx;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#273941';
  for (let x = 60; x < WIDTH; x += 30) for (let y = 60; y < HEIGHT; y += 30) {
    ctx.beginPath(); ctx.arc(x, y, .8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#9dbb9e09'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, 112, 0, Math.PI * 2); ctx.stroke();
  ctx.font = '10px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#79918d44';
  ctx.fillText('K O S H I ’ S   Q U E S T', WIDTH / 2, HEIGHT - 67);
  const trajectory = game.trajectory();
  if (trajectory.length) {
    ctx.setLineDash([5, 7]);
    line(trajectory, '#d3ef8b26', 2.5);
    ctx.setLineDash([]);
  }
  if (game.state === 'playing' && (game.cat.vx || game.cat.vy)) {
    trail.push({ x: game.cat.x, y: game.cat.y, born: now });
  }
  trail = trail.filter(point => now - point.born < .22);
  for (const cue of game.spawnCues) drawSpawnCue(cue);
  for (const food of game.food) {
    const left = Math.max(0, (food.expires - game.elapsed) / food.lifetime);
    ctx.save(); ctx.translate(food.x, food.y);
    ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(0, 17, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff8e6'; ctx.strokeStyle = FOOD_COLORS[food.type]; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Emoji glyphs inherit fillStyle alpha, so draw them with an opaque fill and boosted color.
    ctx.globalAlpha = 1; ctx.fillStyle = '#000';
    ctx.filter = 'saturate(1.8) brightness(1.15) contrast(1.1)';
    ctx.font = '25px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(FOODS[food.type].icon, 0, 1);
    ctx.filter = 'none';
    ctx.fillStyle = '#10191f'; ctx.fillRect(-16, -28, 32, 5);
    ctx.fillStyle = left < .25 ? '#ff5a4a' : '#b8ff3c'; ctx.fillRect(-15, -27, 30 * left, 3);
    ctx.restore();
  }
  for (const heart of game.healing) {
    ctx.fillStyle = '#ef9d9d'; ctx.font = '30px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('♥', heart.x, heart.y + 10);
  }
  for (const item of game.weapons) drawSword(item.x, item.y, SWORDS[item.type].color);
  for (const enemy of game.robots) drawRobot(enemy, null, game.enemyDamageProgress(enemy));
  for (const enemy of game.enemyDeaths) drawEnemyDeath(enemy);
  for (const enemy of game.robots) for (const bomb of enemy.bombs ?? []) drawBomb(bomb);
  for (const pickup of game.pickups) {
    const age = game.elapsed - pickup.time;
    ctx.fillStyle = `rgba(211,239,139,${1 - age / .8})`;
    ctx.font = 'bold 19px "Space Grotesk", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`+${pickup.value}`, pickup.x, pickup.y - 20 - age * 45);
  }
  ctx = actorCtx;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  if (ending?.game === game && ending.state === game.state && !endingMotion.matches) {
    drawEnding();
    ctx = boardCtx;
    return;
  }
  if (game.target) {
    ctx.beginPath();
    ctx.arc(game.target.x, game.target.y, 6, 0, Math.PI * 2);
    ctx.moveTo(game.target.x - 4, game.target.y); ctx.lineTo(game.target.x + 4, game.target.y);
    ctx.moveTo(game.target.x, game.target.y - 4); ctx.lineTo(game.target.x, game.target.y + 4);
    ctx.strokeStyle = '#080e14'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#f05252'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  for (const point of trail) {
    ctx.fillStyle = `rgba(169,189,180,${Math.max(0, .14 * (1 - (now - point.born) / .22))})`;
    ctx.beginPath(); ctx.arc(point.x, point.y, 16, 0, Math.PI * 2); ctx.fill();
  }
  drawCat(game.cat.x, game.cat.y, game.elapsed, game.damageProgress, game.boostReady);
  if (game.boosted) drawBoost(ctx, game.cat.x, game.cat.y, game.elapsed);
  const stuck = game.stuckUntil > game.elapsed + 1e-9;
  const releaseAge = game.releasedAt === null ? 1 : game.elapsed - game.releasedAt;
  if (stuck || releaseAge < .65) {
    ctx.save();
    ctx.strokeStyle = SLIMES[game.stuckColor].color;
    ctx.globalAlpha = stuck ? 1 : 1 - releaseAge / .65;
    ctx.lineWidth = 3;
    const remaining = stuck ? Math.max(0, Math.min(1, (game.stuckUntil - game.elapsed) / SLIMES[game.stuckColor].duration)) : 1;
    ctx.beginPath();
    ctx.arc(game.cat.x, game.cat.y, game.cat.radius + 5 + (stuck ? 0 : releaseAge * 28),
      -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
    ctx.stroke();
    if (!stuck) {
      ctx.fillStyle = '#d3ff9e'; ctx.textAlign = 'center'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText('FREE!', game.cat.x, game.cat.y - game.cat.radius - 14);
    }
    ctx.restore();
  }
  if (game.weapon) drawSword(game.cat.x + 30, game.cat.y - 20, SWORDS[game.weapon.type].color);
  ctx = boardCtx;
}

function drawSpawnCue({ kind, x, y, progress }) {
  ctx.save();
  ctx.translate(x, y);
  const fade = Math.min(1, progress * 5) * Math.min(1, (1 - progress) * 5);
  if (kind === 'enemy' || kind === 'heart') {
    const size = .35 + progress * .65;
    ctx.scale(size, size);
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7 + progress * 1.5;
      const radius = 15 + Math.sin(progress * 7 + i) * 5;
      const cx = Math.cos(angle) * radius, cy = Math.sin(angle) * radius;
      const cloud = ctx.createRadialGradient(cx, cy, 0, cx, cy, 19);
      cloud.addColorStop(0, `rgba(${kind === 'heart' ? '255,135,195' : '174,100,239'},${fade * .6})`);
      cloud.addColorStop(1, kind === 'heart' ? 'rgba(240,90,165,0)' : 'rgba(126,65,191,0)');
      ctx.fillStyle = cloud;
      ctx.fillRect(cx - 19, cy - 19, 38, 38);
    }
    ctx.globalAlpha = fade;
    if (kind === 'heart') {
      ctx.shadowColor = '#ff99cf'; ctx.shadowBlur = 12;
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4 + progress * .8;
        const radius = 12 + (i % 3) * 9;
        const sx = Math.cos(angle) * radius, sy = Math.sin(angle) * radius;
        const sparkle = 2 + 4 * (.5 + .5 * Math.sin(progress * Math.PI * 6 + i * 2));
        ctx.fillStyle = i % 2 ? '#fff5fc' : '#ffd1e9';
        ctx.beginPath();
        ctx.moveTo(sx, sy - sparkle);
        ctx.lineTo(sx + sparkle * .25, sy - sparkle * .25);
        ctx.lineTo(sx + sparkle, sy);
        ctx.lineTo(sx + sparkle * .25, sy + sparkle * .25);
        ctx.lineTo(sx, sy + sparkle);
        ctx.lineTo(sx - sparkle * .25, sy + sparkle * .25);
        ctx.lineTo(sx - sparkle, sy);
        ctx.lineTo(sx - sparkle * .25, sy - sparkle * .25);
        ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.shadowColor = '#bb82ff'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#d4afff';
      ctx.beginPath(); ctx.arc(0, -4, 14, Math.PI, 0);
      ctx.lineTo(13, 7); ctx.lineTo(8, 10); ctx.lineTo(8, 17); ctx.lineTo(-8, 17); ctx.lineTo(-8, 10); ctx.lineTo(-13, 7); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#45245e';
      for (const eye of [-6, 6]) { ctx.beginPath(); ctx.ellipse(eye, -2, 4, 5, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(-3, 8); ctx.lineTo(3, 8); ctx.fill();
      for (const tooth of [-4, 2]) ctx.fillRect(tooth, 12, 2, 5);
    }
  } else if (kind === 'weapon') {
    ctx.globalAlpha = fade;
    ctx.rotate(progress * Math.PI * 3);
    const radius = 1 + progress * 32;
    ctx.shadowColor = '#ffcb52'; ctx.shadowBlur = 10;
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      for (let i = 0; i <= 36; i++) {
        const t = i / 36, angle = arm * Math.PI * 2 / 3 + t * Math.PI * 1.7;
        const px = Math.cos(angle) * t * radius, py = Math.sin(angle) * t * radius;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.strokeStyle = arm === 0 ? '#fff1aa' : '#f7be42';
      ctx.lineWidth = 2.5; ctx.stroke();
    }
  } else {
    const size = 1 + Math.sin(Math.PI * progress) * 25;
    ctx.globalAlpha = fade;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5);
    glow.addColorStop(0, '#fffcebcc'); glow.addColorStop(1, '#fff3bc00');
    ctx.fillStyle = glow; ctx.fillRect(-size * 1.5, -size * 1.5, size * 3, size * 3);
    ctx.rotate(Math.sin(progress * Math.PI * 2) * .15);
    ctx.fillStyle = '#fffde5'; ctx.shadowColor = '#fff4bd'; ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4, radius = i % 2 ? size * .18 : size;
      const px = Math.cos(angle) * radius, py = Math.sin(angle) * radius;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawSword(x, y, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(.5);
  ctx.fillStyle = color; ctx.strokeStyle = '#17212a'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(6, -14); ctx.lineTo(4, 10); ctx.lineTo(-4, 10); ctx.lineTo(-6, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
  line([[0, 12], [0, 22]], '#17212a', 7);
  line([[0, 12], [0, 22]], '#8a6953', 5);
  line([[-10, 10], [10, 10]], '#17212a', 6);
  line([[-10, 10], [10, 10]], color, 4);
  ctx.restore();
}

function drawRobot(enemy, deathProgress = null, damageProgress = null) {
  ctx.save();
  const damageColor = damageProgress === null ? null : Math.floor(damageProgress * 4) % 2 === 0 ? '#dc626b' : '#f2a0a5';
  drawRobotBody(enemy, deathProgress, damageColor);
  if (enemy.shield && deathProgress === null) {
    ctx.strokeStyle = SHIELDS[enemy.shield].color;
    ctx.lineWidth = 3;
    ctx.globalAlpha *= .8;
    ctx.beginPath(); ctx.arc(enemy.x, enemy.y, (enemy.radius ?? 19) + 9, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawRobotBody(enemy, deathProgress = null, damageColor = null) {
  ctx.save(); ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = damageColor ?? '#8898a7'; ctx.strokeStyle = '#d1dce4'; ctx.lineWidth = 2;
  if (enemy.type === 'bucket') {
    drawRoboBucket(enemy, deathProgress, damageColor);
    ctx.restore();
    return;
  }
  if (enemy.type === 'ram') {
    drawRoboRam(enemy, deathProgress, damageColor);
    ctx.restore();
    return;
  }
  if (enemy.type === 'mouse') {
    for (const x of [-15, 15]) {
      ctx.save();
      if (deathProgress !== null) {
        ctx.translate(x * deathProgress * 2, 100 * deathProgress * deathProgress);
        ctx.globalAlpha *= Math.max(0, 1 - deathProgress * 1.5);
      }
      ctx.beginPath(); ctx.arc(x, -15, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (enemy.type === 'wheel') {
    ctx.save(); ctx.rotate(enemy.distance / 19);
    for (let i = 0; i < 10; i++) {
      ctx.rotate(Math.PI / 5); line([[20, 0], [24, 0]], '#596975', 4);
    }
    ctx.restore(); ctx.fillStyle = damageColor ?? '#b2ca75'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  }
  line([[-12,-8],[-4,-4]], '#27353d', 3); line([[12,-8],[4,-4]], '#27353d', 3);
  for (const x of [-8, 8]) {
    ctx.fillStyle = deathProgress === null ? '#d46665' : '#53616b'; ctx.fillRect(x-4,-2,8,6);
    if (enemy.type === 'mouse') for (let i = -3; i <= 3; i += 3) line([[x+i,-2],[x+i,4]], '#27353d', 1);
  }
  if (enemy.type === 'mouse' && (enemy.resting || enemy.speaking) && deathProgress === null) {
    const opening = 6 + (Math.sin(enemy.age * 8) + 1) * 1.5;
    ctx.fillStyle = '#27353d';
    ctx.beginPath(); ctx.ellipse(0, 11, 9, opening, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#f2eee0'; ctx.strokeStyle = '#596975'; ctx.lineWidth = 1;
    for (const x of [-5, 1]) {
      ctx.fillRect(x, 0, 4, 13);
      ctx.strokeRect(x, 0, 4, 13);
    }
    ctx.restore();
  } else line([[-6,11],[0,7],[6,11]], '#27353d', 2);
  ctx.restore();
}

function drawRoboBucket(enemy, deathProgress, damageColor = null) {
  const progress = deathProgress ?? 0;
  const armFall = deathProgress === null ? 0 : Math.min(1, progress / .3);
  const armAlpha = deathProgress === null ? 1 : Math.max(0, 1 - Math.max(0, progress - .3) / .2);
  const melt = deathProgress === null ? 0 : Math.min(1, Math.max(0, (progress - .5) / .5));
  ctx.save();
  ctx.save();
  ctx.globalAlpha *= 1 - melt;
  ctx.strokeStyle = '#737d80'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-15, -12); ctx.bezierCurveTo(-31, -42, 31, -42, 15, -12); ctx.stroke();
  ctx.restore();
  const wave = deathProgress === null ? Math.sin(enemy.age * 5) * .16 : 0;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.globalAlpha *= armAlpha;
    ctx.translate(side * (16 + armFall * 13), -8 + armFall * 20);
    ctx.rotate(side * (wave + armFall * 1.1)); ctx.scale(side, 1);
    ctx.strokeStyle = '#858d90'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(5, -12); ctx.lineTo(4, -25); ctx.stroke();
    ctx.strokeStyle = '#aeb4b6'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(5, -11); ctx.lineTo(4, -23); ctx.stroke();
    ctx.fillStyle = damageColor ?? '#bfc4c5'; ctx.strokeStyle = '#626b6d'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(1, -25); ctx.lineTo(0, -34); ctx.quadraticCurveTo(1, -37, 3, -34);
    ctx.lineTo(4, -29); ctx.lineTo(4, -38); ctx.quadraticCurveTo(6, -40, 7, -37);
    ctx.lineTo(8, -29); ctx.lineTo(9, -36); ctx.quadraticCurveTo(11, -38, 12, -35);
    ctx.lineTo(12, -28); ctx.lineTo(14, -32); ctx.quadraticCurveTo(16, -33, 16, -30);
    ctx.lineTo(14, -23); ctx.quadraticCurveTo(12, -20, 8, -21);
    ctx.lineTo(5, -23); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#e0e2e2'; ctx.lineWidth = 1;
    for (const x of [3, 7, 11]) {
      ctx.beginPath(); ctx.moveTo(x, -35); ctx.lineTo(x, -30); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha *= 1 - melt;
  ctx.scale(1, Math.max(.04, 1 - melt * .96));
  ctx.fillStyle = damageColor ?? '#c9bd76'; ctx.strokeStyle = '#60675f'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-19, -10); ctx.lineTo(19, -10); ctx.lineTo(16, 17);
  ctx.quadraticCurveTo(0, 22, -16, 17); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = damageColor ? '#ffd3d5' : '#e0d59a';
  ctx.beginPath(); ctx.ellipse(0, -10, 19, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#50565a';
  for (const x of [-7, 7]) {
    ctx.beginPath(); ctx.arc(x, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2eee0'; ctx.beginPath(); ctx.arc(x - 1, -1.5, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#50565a';
  }
  ctx.fillStyle = '#db4847'; ctx.strokeStyle = '#843533'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, 7, 4, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#514b42'; ctx.lineWidth = 2;
  ctx.beginPath();
  if (deathProgress === null) {
    ctx.moveTo(-8, 13); ctx.quadraticCurveTo(0, 19, 8, 13);
  } else {
    ctx.moveTo(-8, 15); ctx.quadraticCurveTo(0, 11, 8, 15);
  }
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawBomb(bomb) {
  ctx.save(); ctx.translate(bomb.x, bomb.y);
  if (bomb.state === 'flying') {
    const urgency = Math.max(0, Math.min(1, 1 - bomb.fuse / 3));
    ctx.fillStyle = `rgb(${Math.round(57 + 175 * urgency)},${Math.round(139 - 83 * urgency)},${Math.round(214 - 160 * urgency)})`;
    ctx.strokeStyle = '#173d66'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, bomb.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a9dbff'; ctx.beginPath(); ctx.arc(-2.5, -2.5, 2.4, 0, Math.PI * 2); ctx.fill();
    line([[-1, -7], [2, -11]], '#d5d9c2', 1.8);
  } else {
    const radius = bomb.blastRadius;
    ctx.globalAlpha *= Math.max(0, 1 - bomb.blastAge / .9);
    ctx.fillStyle = '#b92d2b'; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f05232'; ctx.beginPath(); ctx.arc(0, 0, radius * .78, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffae48'; ctx.beginPath(); ctx.arc(0, 0, radius * .42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff08a';
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3 + bomb.blastAge * 3;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * radius * .65, Math.sin(angle) * radius * .65, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawTinyBombExplosion(bomb, progress) {
  if (progress <= 0 || progress >= 1) return;
  ctx.save(); ctx.translate(bomb.x, bomb.y);
  ctx.globalAlpha *= 1 - progress;
  ctx.fillStyle = '#ff7040'; ctx.beginPath(); ctx.arc(0, 0, 2 + progress * 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd36a';
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    ctx.beginPath(); ctx.arc(Math.cos(angle) * progress * 12, Math.sin(angle) * progress * 12,
      1.5 * (1 - progress), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBucketDeathSmoke(enemy, progress) {
  const alpha = Math.max(0, 1 - progress / .8) * .65;
  const puff = Math.min(1, progress / .35);
  if (alpha <= 0) return;
  ctx.save(); ctx.translate(enemy.x, enemy.y);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = '#9aa5a9';
  for (const [x, y, scale] of [[-12, 14, 1], [0, 10, 1.25], [12, 14, 1]]) {
    ctx.beginPath();
    ctx.arc(x + (x < 0 ? -1 : 1) * puff * 5, y - puff * 11,
      (5 + puff * 5) * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRoboRam(enemy, deathProgress, damageColor = null) {
  const progress = deathProgress ?? 0;
  ctx.rotate(enemy.facingAngle ?? (enemy.state === 'charging' ? (enemy.angle ?? 0) - Math.PI / 2 : 0));
  const hornSwing = Math.min(1, progress * 1.7) * 1.15;
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * 12, -9); ctx.scale(side, 1); ctx.rotate(-side * hornSwing);
    ctx.globalAlpha *= Math.max(0, 1 - progress);
    ctx.fillStyle = damageColor ? '#ffd3d5' : '#d6dadd'; ctx.strokeStyle = '#59636a'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(1, -8); ctx.bezierCurveTo(3, -23, 18, -30, 25, -19);
    ctx.bezierCurveTo(30, -10, 25, -2, 18, -3); ctx.bezierCurveTo(12, -4, 14, -11, 19, -11);
    ctx.lineTo(22, -13); ctx.bezierCurveTo(17, -19, 9, -15, 8, -7); ctx.lineTo(7, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    line([[3, -8], [6, -17], [12, -22]], '#f1f2f2', 1.5);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha *= Math.max(0, 1 - progress);
  ctx.scale(Math.max(.01, 1 - progress), Math.max(.01, 1 - progress));
  ctx.fillStyle = damageColor ?? '#aeb9c0'; ctx.strokeStyle = '#394852'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-15, -12); ctx.quadraticCurveTo(-14, -18, -8, -20); ctx.lineTo(8, -20);
  ctx.quadraticCurveTo(14, -18, 15, -12); ctx.lineTo(13, 9);
  ctx.quadraticCurveTo(10, 17, 0, 18); ctx.quadraticCurveTo(-10, 17, -13, 9);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = damageColor ? '#ffd3d5' : '#dce3e6';
  ctx.beginPath(); ctx.moveTo(-9, -17); ctx.lineTo(0, -19); ctx.lineTo(9, -17);
  ctx.lineTo(6, -15); ctx.lineTo(-6, -15); ctx.closePath(); ctx.fill();
  line([[-11, -11], [-12, 6]], '#e4e9eb', 1.5);
  line([[11, -11], [12, 6]], '#7d8c94', 1.5);
  for (const x of [-7, 7]) {
    const aiming = enemy.state === 'targeting' && deathProgress === null;
    const sparkle = aiming ? .65 + .35 * Math.sin(enemy.stateTime * 16) : 0;
    if (aiming) {
      ctx.fillStyle = `rgba(255,45,48,${.35 + sparkle * .25})`;
      ctx.beginPath(); ctx.arc(x, -5, 8 + sparkle * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = aiming ? '#ff3538' : '#e64649';
    if (enemy.state === 'targeting' && deathProgress === null) {
      ctx.shadowColor = '#ff252b'; ctx.shadowBlur = 18 + sparkle * 12;
    }
    ctx.beginPath(); ctx.ellipse(x, -5, 3.8, 4.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff6e8';
    ctx.beginPath(); ctx.arc(x - 1, -6.5, 1.3, 0, Math.PI * 2); ctx.fill();
    if (aiming) {
      ctx.save(); ctx.translate(x + 4, -11); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = `rgba(255,255,235,${.7 + sparkle * .3})`;
      ctx.beginPath(); ctx.moveTo(0, -5 - sparkle * 2); ctx.lineTo(1, -1); ctx.lineTo(5 + sparkle * 2, 0);
      ctx.lineTo(1, 1); ctx.lineTo(0, 5 + sparkle * 2); ctx.lineTo(-1, 1); ctx.lineTo(-5 - sparkle * 2, 0);
      ctx.lineTo(-1, -1); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  ctx.fillStyle = '#c7353b';
  ctx.beginPath(); ctx.moveTo(-7, 7); ctx.lineTo(7, 7); ctx.lineTo(5, 13);
  ctx.lineTo(2, 10); ctx.lineTo(0, 13); ctx.lineTo(-2, 10); ctx.lineTo(-5, 13); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#303d45';
  for (const x of [-2.5, 2.5]) {
    ctx.beginPath(); ctx.ellipse(x, 4, 1.1, 1.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  line([[-12, 1], [-10, 5]], '#aeb5b8', 1.5);
  line([[12, 1], [10, 5]], '#aeb5b8', 1.5);
  ctx.restore();
}

function drawEnemyDeath(enemy) {
  const progress = enemy.deathProgress;
  ctx.save();
  if (enemy.type === 'mouse') {
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, progress - .2) / .5);
    drawRobot(enemy, progress);
    if (progress > .2) {
      const smoke = (progress - .2) / .8;
      ctx.translate(enemy.x, enemy.y);
      ctx.globalAlpha = Math.sin(Math.PI * smoke) * .8;
      for (let i = 0; i < 7; i++) {
        const angle = i * Math.PI * 2 / 7;
        ctx.fillStyle = i % 2 ? '#a8b2b9' : '#d1dce4';
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * smoke * 28, Math.sin(angle) * smoke * 18 - smoke * 24,
          6 + smoke * 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (enemy.type === 'bucket') {
    drawBucketDeathSmoke(enemy, progress);
    drawRobot(enemy, progress);
    for (const [index, bomb] of (enemy.bombs ?? []).entries()) {
      drawTinyBombExplosion(bomb, Math.max(0, Math.min(1, (progress - .18 - index * .08) / .48)));
    }
  } else if (enemy.type === 'ram') {
    drawRobot(enemy, progress);
    if (progress > .18) {
      const smoke = Math.min(1, (progress - .18) / .82);
      ctx.save(); ctx.translate(enemy.x, enemy.y);
      ctx.globalAlpha = Math.sin(Math.PI * smoke) * .75;
      for (let i = 0; i < 7; i++) {
        const angle = i * Math.PI * 2 / 7;
        ctx.fillStyle = i % 2 ? '#a8b2b9' : '#d1dce4';
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * smoke * 24, Math.sin(angle) * smoke * 16 - smoke * 12,
          4 + smoke * 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  } else {
    ctx.translate(enemy.x, enemy.y);
    if (progress < .35) {
      const size = Math.max(.01, 1 - progress / .35);
      ctx.save(); ctx.scale(size, size);
      drawRobot({ ...enemy, x: 0, y: 0 }, progress);
      ctx.restore();
    }
    if (progress >= .25) {
      const blast = (progress - .25) / .75;
      const radius = 3 + Math.sin(Math.PI * blast) * 29;
      ctx.globalAlpha = 1 - blast;
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.8);
      glow.addColorStop(0, '#ffb62dcc'); glow.addColorStop(1, '#ff4b1600');
      ctx.fillStyle = glow;
      ctx.fillRect(-radius * 1.8, -radius * 1.8, radius * 3.6, radius * 3.6);
      for (const [color, size] of [['#e94b25', 1], ['#ffac32', .72], ['#fff2ab', .4]]) {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(0, -blast * 10, radius * size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#ffd46a';
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * blast * 42, Math.sin(angle) * blast * 42,
          2 * (1 - blast), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function resize() {
  board.style.setProperty('--board-scale-x', board.clientWidth / game.width);
  board.style.setProperty('--board-scale-y', board.clientHeight / game.height);
  const ratio = window.devicePixelRatio || 1;
  for (const layer of [canvas, actorCanvas]) {
    layer.width = Math.round(board.clientWidth * ratio);
    layer.height = Math.round(board.clientHeight * ratio);
    layer.getContext('2d').setTransform(layer.width / game.width, 0, 0, layer.height / game.height, 0, 0);
  }
  render(performance.now() / 1000);
}

function frame(timestamp) {
  const seconds = lastTime === null ? 0 : (timestamp - lastTime) / 1000;
  if (!phaseTransition.busy) {
    if (cutscene.active) cutscene.update(seconds);
    else game.update(seconds);
    updateEnding(seconds);
  }
  lastTime = timestamp;
  syncUI();
  render(timestamp / 1000);
  if (timestamp > toastUntil && game.state === 'playing') toast.textContent = '';
  requestAnimationFrame(frame);
}

game = createGame();
saveAttempt(renderSaveSlots);
makeBrickButtons();
syncUI();
if (!location.hash.startsWith('#level=') && location.hash !== '#install') titleScreen.showModal();
installBackNavigation();
new ResizeObserver(resize).observe(board);
requestAnimationFrame(frame);
})();
