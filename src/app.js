(function () {
'use strict';

const { Game, LEVELS, CHARACTERS, WEAPONS, ITEMS, CAT_SHIELDS, CAT_BLOCK_MESSAGES, OBJECTS, COOLDOWNS, SLIMES, SHIELDS, FOODS, CONVEYOR_SPEED, COW_EAT_DURATION, brickEnabled, validateCustomLevel, levelObjective, brickRegions, brickShape, brickRecharge, brickSlime, brickSpring, brickSpikes, brickConveyor } = globalThis.KoshiGame;
const { decorateBrick, updateBrick, exposePortalCloud, exposeBrickInfo, specialLabel, drawBoost, traceSawBlade, drawBarrier, drawCatCircle, drawSoccerBall, drawBumper, drawObstruction, drawObstructionDestruction, drawGoal, drawPaintbrush } = globalThis.KoshiBrickVisuals;
const { GUIDE, LESSONS, Tutorial } = globalThis.KoshiLearning;
const { SaveSlots, levelStats } = globalThis.KoshiSaves;
const { collectibleTotals, levelRewardStates, catBlockIcon, goldStarIcon } = globalThis.KoshiCollectibles;
let displayedLevelRewards = '';
let levelRewardGame = null;
let previousLevelRewardResults = {};
const { WORLDS, nextLevelIndex } = globalThis.KoshiWorlds;
const campaignMode = globalThis.KoshiCampaignMode;
const campaignId = campaignMode.active.id;
const { INFO_GRAPHICS, validateLevelInfo } = globalThis.KoshiGame;
const levelInfoDialog = document.querySelector('#level-info');
const levelInfoReplay = document.querySelector('#level-info-replay');
const viewedLevelInfo = new Map();
let infoPages = null;
let infoPage = 0;

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
const skipCutscene = document.querySelector('#skip-cutscene');
const weaponStatus = document.querySelector('#weapon-status');
const shieldStatus = document.querySelector('#shield-status');
const catBlockArt = new Image();
catBlockArt.src = './icons/cat-building-block.png';
globalThis.koshiCatBlockArt = catBlockArt;
for (const [index, level] of LEVELS.entries()) {
  const option = document.createElement('option');
  option.value = String(index);
  option.textContent = `${level.number} · ${level.name}`;
  levelSelect.append(option);
}
const titleScreen = document.querySelector('#title-screen');
const phaseTransition = new globalThis.KoshiPhaseTransition();
const saveDialog = document.querySelector('#save-slots');
const mainLevels = LEVELS.filter(level => !WORLDS.find(world => world.id === level.worldId).special);
const saves = new SaveSlots(LEVELS.map(level => level.id), undefined, undefined, mainLevels.map(level => level.id), campaignId);
let activeSave = null;
let runSave = null;
const pendingSaves = [];
const guestProfile = { guest: true, completed: [], catBlocks: [], results: {} };
const recordedAttempts = new WeakSet();
const viewedCutscenes = new Set();
let attemptId = makeAttemptId();
const colors = { normal: '#83bca1', slow: '#7eacdb', fast: '#df8c81', cinder: '#969b99', goal: '#4d9475' };
let lastTime = null;
let displayedState = null;
let displayedTurret = false;
let ending = null;
const endingMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let toastUntil = 0;
let trail = [];
let buttons = [];
let brickRevision = -1;
const destructionVisuals = new Map();
let customLevel = null;
let displayedStuck = false;
let tutorial = null;
let guideIndex = 0;
const guide = document.querySelector('#how-to-play');
function drawCutsceneCharacter(context, character, time, speaking) {
  const previous = ctx;
  const previousGame = game;
  ctx = context;
  if (character === 'koshi') {
    game = { cat: { radius: 23, x: NaN, y: NaN }, weapon: null, sawStartedAt: null };
    drawCat(0, 0, time, null, false, speaking ? 'won' : null);
  } else drawRobot({ type: character, x: 0, y: 0, age: time, facingAngle: 0, distance: time * 25, speaking });
  ctx = previous;
  game = previousGame;
}
const cutscene = new globalThis.KoshiCutscenePlayer(drawCutsceneCharacter, () => {
  markCutsceneViewed(game.level.id);
  skipCutscene.checked = true;
  showLevelInformation();
}, action => phaseTransition.run(action));

if (location.hash.startsWith('#level=')) {
  try {
    customLevel = validateCustomLevel(JSON.parse(decodeURIComponent(location.hash.slice(7))));
    const option = document.createElement('option');
    option.value = 'custom';
    option.textContent = `Editor · ${customLevel.id}`;
    levelSelect.append(option);
    levelSelect.value = 'custom';
    document.querySelector('#editor-link').href = campaignMode.gameURL('./editor.html', location.hash);
    document.querySelector('#editor-link').textContent = 'BACK TO EDITOR';
    const backToEditor = document.querySelector('#back-to-editor');
    backToEditor.href = campaignMode.gameURL('./editor.html', location.hash);
    backToEditor.hidden = false;
    document.querySelector('#dialog-text').textContent = levelBriefingText(customLevel);
  } catch (error) {
    console.error('Custom level could not be loaded:', error);
    const message = document.querySelector('#level-error');
    message.textContent = `Custom level could not be loaded: ${error.message} Open the editor to fix it. The built-in levels are still available.`;
    message.hidden = false;
    if (!LEVELS.length) reportCampaignError(error);
  }
}
if (location.hash.startsWith('#campaign=')) {
  try {
    const id = decodeURIComponent(location.hash.slice(10));
    const level = LEVELS.find(level => level.id === id) ?? LEVELS.find(level => level.number === id);
    const index = LEVELS.indexOf(level);
    if (index < 0) throw new Error('Game level could not be found.');
    levelSelect.value = String(index);
  } catch (failure) {
    console.error('Campaign level could not be loaded:', failure);
    const error = document.querySelector('#level-error');
    error.textContent = `${failure.message} Choose a built-in level from the menu.`;
    error.hidden = false;
    if (!LEVELS.length) reportCampaignError(failure);
  }
}
if (!location.hash.startsWith('#campaign=') && !customLevel) {
  try {
    const id = localStorage.getItem(campaignMode.storageKey('selection', campaignId));
    const index = LEVELS.findIndex(level => level.id === id);
    if (index >= 0) levelSelect.value = String(index);
  } catch (error) {
    console.error('Map selection could not be restored:', error);
    reportCampaignError(error);
  }
}

function layoutOptions() {
  const portrait = window.matchMedia('(max-width: 760px) and (orientation: portrait)').matches;
  board.dataset.portrait = String(portrait);
  return { portrait, scale: portrait ? board.clientWidth / 600 : 1 };
}

function createGame() {
  if (!LEVELS.length && levelSelect.value !== 'custom') return null;
  const level = LEVELS[Number(levelSelect.value)];
  const profile = activeSave ? activeSave.slot : guestProfile;
  const catBlockCollected = levelSelect.value !== 'custom' && (
    (profile.catBlocks ?? []).includes(level?.id)
    || activeSave && pendingSaves.some(pending => pending.id === activeSave.slot.id
      && pending.result?.outcome === 'won' && pending.result.catBlock
      && pending.result.levelId === level?.id));
  return new Game(Math.random, {
    ...layoutOptions(),
    level: levelSelect.value === 'custom' ? 0 : Number(levelSelect.value),
    customLevel: levelSelect.value === 'custom' ? customLevel : null,
    catBlockCollected: Boolean(catBlockCollected),
  });
}

function makeAttemptId() {
  return Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('');
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

function reportCutsceneStorageError(error) {
  console.error('Viewed cutscenes could not be saved:', error);
  const message = document.querySelector('#level-error');
  message.textContent = `Cutscene preferences could not be saved in this browser: ${error.message}`;
  message.hidden = false;
}

function isCutsceneViewed(levelId, saveId = activeSave?.slot.id) {
  if (!saveId) return false;
  const key = campaignMode.cutsceneKey(levelId, campaignId, saveId);
  if (viewedCutscenes.has(key)) return true;
  try {
    if (localStorage.getItem(key) === 'true') {
      viewedCutscenes.add(key);
    }
  } catch (error) {
    reportCutsceneStorageError(error);
  }
  return viewedCutscenes.has(key);
}

function markCutsceneViewed(levelId) {
  if (!runSave || game.customLevel) return;
  const key = campaignMode.cutsceneKey(levelId, campaignId, runSave.id);
  viewedCutscenes.add(key);
  try {
    localStorage.setItem(key, 'true');
  } catch (error) {
    reportCutsceneStorageError(error);
  }
}

function saveAttempt(action) {
  try {
    action();
    if (!pendingSaves.length) saveError('');
    return true;
  } catch (error) {
    console.error('Campaign save:', error);
    saveError(`${pendingSaves.length ? 'Progress has not been saved. Keep this page open and retry, or discard unsaved results in Save slots. ' : 'Save action failed. '}${error.message}`);
    return false;
  }
}

function saveProgress(slot) {
  const next = saves.resumeLevel(slot);
  if (next < 0) return 'Official campaign under construction. No levels are available yet.';
  return saves.mainLevelIds.every(id => slot.completed.includes(id))
    ? `Campaign complete! Continue at Level ${LEVELS[next].number} on the map.`
    : `${slot.completed.length} / ${LEVELS.length} levels completed. Continue at Level ${LEVELS[next].number} on the map.`;
}

function recentSave() {
  try {
    return saves.recent();
  } catch (error) {
    console.error('Campaign save:', error);
    return null;
  }
}

function updateStartButton() {
  const button = document.querySelector('#title-start'), recent = recentSave();
  const label = !LEVELS.length ? 'View official world map' : recent ? `Continue as ${recent.slot.owner}` : 'Start adventure';
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '→';
  button.replaceChildren(`${label} `, arrow);
}

function updateSaveProfile() {
  const text = activeSave
    ? `Save slot ${activeSave.index + 1}: ${activeSave.slot.owner}. ${saveProgress(activeSave.slot)}`
    : 'Guest play - progress is not saved.';
  document.querySelector('#save-profile').textContent = text;
  updateStartButton();
}

function flushSaves() {
  while (pendingSaves.length) {
    const pending = pendingSaves[0];
    const slot = pending.levelId
        ? saves.visit(pending.index, pending.id, pending.levelId)
        : saves.record(pending.index, pending.id, pending.attemptId, pending.result);
    pendingSaves.shift();
    if (activeSave?.slot.id === slot.id) activeSave.slot = slot;
  }
  updateSaveProfile();
}

function recordCatBlockFinds() {
  for (const source of game.catBlockEvents.splice(0)) {
    const levelId = game.level.id;
    const collected = runSave ? activeSave?.slot.catBlocks ?? [] : guestProfile.catBlocks;
    if (!game.customLevel && collected.includes(levelId)) continue;
    toast.textContent = CAT_BLOCK_MESSAGES[source];
    if (!game.customLevel) toast.textContent += ' Complete the level to keep it!';
    toastUntil = performance.now() + 3500;
  }
}

function attemptResult(outcome) {
  return {
    levelId: game.level.id, outcome, time: game.elapsed, food: game.score, enemy: game.enemies,
    goals: game.goals ?? 0, moves: game.moves,
    damageFree: outcome === 'won' && !game.tookDamage,
    ...(outcome === 'won' && game.catBlockCollected ? { catBlock: true } : {}),
  };
}

function storeAttempt(result) {
  if (!runSave) {
    guestProfile.results[attemptId] = result;
    if (result.outcome === 'won' && !guestProfile.completed.includes(game.level.id)) guestProfile.completed.push(game.level.id);
    if (result.catBlock && !(guestProfile.catBlocks ?? []).includes(result.levelId)) {
      guestProfile.catBlocks ??= [];
      guestProfile.catBlocks.push(result.levelId);
    }
    return;
  }
  pendingSaves.push({ ...runSave, attemptId, result });
  saveAttempt(flushSaves);
}

function checkpointAttempt() {
  if (!game || tutorial || game.customLevel || recordedAttempts.has(game)) return;
  if (['won', 'lost'].includes(game.state)) { saveResult(); return; }
  if (!['playing', 'paused'].includes(game.state)) return;
  // Persist before shutdown; mobile app termination may not fire an unload event.
  storeAttempt({ ...attemptResult('quit'), inProgress: true });
}

function saveResult() {
  if (!game || tutorial || game.customLevel || recordedAttempts.has(game)) return;
  if (!['playing', 'paused', 'won', 'lost'].includes(game.state)) return;
  recordedAttempts.add(game);
  const result = attemptResult(['won', 'lost'].includes(game.state) ? game.state : 'quit');
  const results = runSave ? activeSave?.slot.results : guestProfile.results;
  const previousStats = levelStats(Object.fromEntries(Object.entries(results ?? {}).filter(([id]) => id !== attemptId)), game.level.id);
  const summary = {
    result,
    newCatBlock: result.catBlock === true && !game.catBlockPreviouslyCollected,
    previousStats,
    newRecords: {
      time: result.outcome === 'won' && (previousStats.bestTime === null || result.time < previousStats.bestTime),
      food: result.outcome === 'won' && (previousStats.mostFood === null || result.food > previousStats.mostFood),
      enemy: result.outcome === 'won' && (previousStats.mostEnemies === null || result.enemy > previousStats.mostEnemies),
      goals: result.outcome === 'won' && (previousStats.mostGoals === null || result.goals > previousStats.mostGoals),
      moves: result.outcome === 'won'
        && (previousStats.fewestMoves === null || result.moves < previousStats.fewestMoves),
    },
  };
  storeAttempt(result);
  return summary;
}

function continueSave(index, id, fresh = false) {
  const slots = saves.load(), slot = saves.slot(slots, index, id);
  saves.markRecent(index, id);
  activeSave = { index, slot };
  updateSaveProfile();
  openLevelPicker({ insideWorld: !fresh, level: fresh ? 0 : saves.resumeLevel(slot) });
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
    heading.append(collectibleTotals(slot, LEVELS, document));
    section.append(heading);
    if (slot) {
      const actions = document.createElement('div');
      actions.className = 'save-actions';
      const resume = document.createElement('button'), remove = document.createElement('button');
      resume.type = remove.type = 'button';
      resume.className = remove.className = 'title-secondary';
      resume.textContent = 'Continue';
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
      section.append(actions);
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
          continueSave(index, created.id, true);
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
  saveDialog.close();
  openLevelPicker({ level: 0 });
});
for (const id of ['#save-retry', '#save-title-retry', '#save-menu-retry']) {
  document.querySelector(id).addEventListener('click', () => {
    if (saveAttempt(flushSaves) && saveDialog.open) saveAttempt(renderSaveSlots);
  });
}
document.querySelector('#save-discard').addEventListener('click', () => {
  if (!confirm('Discard all results that could not be saved? They cannot be recovered. Existing saved progress will not change.')) return;
  pendingSaves.length = 0;
  saveError('');
});

function boardPoint(event) {
  const bounds = board.getBoundingClientRect(), camera = game.camera();
  return {
    x: camera.x + (event.clientX - bounds.left - board.clientLeft) / board.clientWidth * camera.width,
    y: camera.y + (event.clientY - bounds.top - board.clientTop) / board.clientHeight * camera.height,
  };
}

function brickClickPoint(event, brick) {
  if (event.detail !== 0) return boardPoint(event);
  const camera = game.camera();
  return {
    x: Math.max(camera.x, Math.min(camera.x + camera.width, brick.x + brick.w / 2)),
    y: Math.max(camera.y, Math.min(camera.y + camera.height, brick.y + brick.h / 2)),
  };
}

function makeBrickButtons() {
  const container = document.querySelector('#bricks');
  for (const effect of game.brickDestructions) {
    if (destructionVisuals.has(effect)) continue;
    const item = buttons.find(item => item.brick.id === effect.id);
    if (!item) continue;
    const ghost = document.createElement('div');
    ghost.className = 'brick-destruction-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    for (const node of new Set([item.button, item.spring, item.conveyor, item.spikes, item.special?.cloud, item.special?.info].filter(Boolean))) {
      const clone = node.cloneNode(true);
      clone.removeAttribute('data-id');
      ghost.append(clone);
    }
    destructionVisuals.set(effect, ghost);
  }
  for (const [effect, ghost] of destructionVisuals) {
    if (!game.brickDestructions.includes(effect)) {
      ghost.remove();
      destructionVisuals.delete(effect);
    }
  }
  container.replaceChildren();
  brickRevision = game.brickRevision;
  const parts = game.brickParts();
  buttons = game.bricks.filter(brick => brick.absorbedBy === null).map(brick => {
    const members = parts.filter(part => part.id === brick.id);
    const merged = members.length > 1;
    const outlined = merged || brick.crumbler || brick.slimed || brick.springs || brick.spikes;
    const part = outlined ? brickShape(members, Boolean(brick.crumbler)) : members[0];
    const body = brick.spikes ? brickSpikes(members, game.width, game.height, Boolean(brick.crumbler)).body : part;
    const recharge = brickRecharge(members, game.bricks, game.perimeter, game.width, game.height);
    const button = document.createElement('button');
    button.className = 'brick';
    button.classList.toggle('cinder', brick.kind === 'cinder');
    button.classList.toggle('goal', brick.kind === 'goal');
    button.disabled = brick.kind === 'cinder' || brick.kind === 'goal';
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
    if (brick.spikes) button.style.clipPath = body.roundedClipPath;
    if (outlined) {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.classList.add('brick-outline');
      svg.setAttribute('viewBox', '0 0 1 1');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', body.roundedPath);
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
      if (!game.brickVisible(brick)) return;
      if (game.activeTurret) {
        if (event.detail !== 0) return;
        const { x, y } = brickClickPoint(event, brick);
        game.fireTurretAt(x, y);
        syncUI();
        return;
      }
      if (game.state !== 'playing' || brick.kind === 'goal' || brick.kind === 'cinder') return;
      const { x, y } = brickClickPoint(event, brick);
      // Include clicks on the button border despite fractional CSS pixel rounding.
      const steering = tutorial ?? game;
      if (!steering.steer(brick.id, Math.max(part.x, Math.min(part.x + part.w, x)), Math.max(part.y, Math.min(part.y + part.h, y)))) {
        toast.textContent = game.stuckUntil > game.elapsed + 1e-9 ? ''
          : !game.sunglassesActive && !brickEnabled(brick) ? `That toggle needs ${brick.toggleRemaining} more successful clicks of other bricks.`
          : !game.sunglassesActive && brick.usesLeft === 0 ? 'That Crumbler is permanently deactivated. Pick another!'
          : !game.sunglassesActive && brick.readyAt > game.elapsed + 1e-9 ? 'That brick is recharging. Pick another!'
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
    const special = decorateBrick(button, brick, members, game.width, game.height,
      brick.turret || brick.portal || brick.hazard ? game.groupSource(brick) : null,
      brick.portal ? game.portalExit(brick) : null);
    exposePortalCloud(special, container);
    exposeBrickInfo(special, container, brick, game.width, game.height);
    return { brick, button, members, spring, conveyor, special, spikes: container.querySelector(`.brick-spikes[data-id="${brick.id}"]`), usesLeft: null };
  });
  for (const ghost of destructionVisuals.values()) container.append(ghost);
}

board.addEventListener('click', event => {
  if (event.detail === 0 || game.state !== 'playing' || !game.activeTurret) return;
  const { x, y } = boardPoint(event);
  const fired = game.fireTurretAt(x, y);
  event.preventDefault();
  event.stopImmediatePropagation();
  if (fired) syncUI();
}, true);

function syncBrickDestructions() {
  for (const [effect, ghost] of destructionVisuals) {
    const item = buttons.find(item => item.brick.id === effect.id);
    if (!game.brickDestructions.includes(effect)) {
      ghost.remove(); destructionVisuals.delete(effect);
      if (item) item.button.style.transform = '';
      continue;
    }
    const progress = Math.min(1, effect.age);
    const fade = progress * progress * (3 - 2 * progress);
    const amplitude = 2 * (1 - progress);
    const x = Math.sin(effect.age * Math.PI * 2 * 34) * amplitude;
    const y = Math.cos(effect.age * Math.PI * 2 * 41) * amplitude;
    const transform = `translate(calc(${x}px * var(--board-scale-x)), calc(${y}px * var(--board-scale-y)))`;
    ghost.style.opacity = String(1 - fade);
    ghost.style.transform = transform;
    if (item) item.button.style.transform = transform;
  }
}

function levelBriefingText(level) {
  const lines = ['VICTORY CONDITIONS:'];
  if (level.bossLevel) lines.push('Defeat Tom the Toaster with 6 Boost hits while he is dizzy. No time limit.');
  else if (level.survive) lines.push(`🕒 Survive Time: ${level.duration}`);
  else {
    if (level.goal > 0) lines.push(`🍗 Target: ${level.goal}`);
    if (level.killGoal > 0) lines.push(`👾 Target: ${level.killGoal}`);
    if (level.goalsGoal > 0) lines.push(`⚽ Target: ${level.goalsGoal}`);
  }
  return lines.join('\n');
}

function renderLevelBriefing(container, level, catBlockCollected = false) {
  const conditions = document.createElement('div');
  conditions.className = 'briefing-conditions';
  const heading = document.createElement('p');
  heading.textContent = 'VICTORY CONDITIONS:';
  conditions.append(heading);
  const { objectiveTargets, collectibleHint, hintActivator } = globalThis.KoshiWorldMap;
  const targets = objectiveTargets(level);
  const activateHint = hintActivator();
  const lines = levelBriefingText(level).split('\n').slice(1);
  const briefingTargets = level.survive ? targets.slice(0, 1)
    : level.bossLevel ? targets.filter(target => target.value === 'BOSS') : targets.slice(1);
  for (const [index, target] of briefingTargets.entries()) {
    const row = document.createElement('div');
    row.className = 'briefing-objective';
    const button = document.createElement('button');
    button.className = 'briefing-objective-button';
    button.textContent = lines[index];
    button.setAttribute('aria-label', target.label);
    row.append(button, collectibleHint(button, `briefing-objective-description-${index}`, target.label, activateHint));
    conditions.append(row);
  }
  container.replaceChildren(conditions);
  if (level.catBlock && !catBlockCollected) {
    const section = document.createElement('div');
    section.className = 'briefing-cat-block';
    const image = document.createElement('img');
    image.src = './icons/cat-building-block.png';
    image.alt = 'Cat Block';
    const hint = document.createElement('p');
    hint.textContent = globalThis.KoshiGame.catBlockObjective(level);
    section.append(image, hint);
    container.append(section);
  }
}

function showDialog(kicker, title, text, label, icon) {
  overlay.classList.toggle('level-briefing', game.state === 'ready');
  document.querySelector('#dialog-kicker').textContent = kicker;
  document.querySelector('#dialog-title').textContent = title;
  const content = document.querySelector('#dialog-text');
  if (game.state === 'ready')   renderLevelBriefing(content, game.level, game.catBlockPreviouslyCollected);
  else content.textContent = text;
  document.querySelector('#dialog-icon').textContent = icon;
  play.textContent = label;
  overlay.hidden = false;
  play.focus({ preventScroll: true });
}

function showCompletionResults(summary) {
  const dialog = document.querySelector('#level-results');
  const heading = document.querySelector('#level-results-heading');
  const star = document.querySelector('#level-results-star');
  const previousStar = document.querySelector('#level-results-star-prior');
  const rows = document.querySelector('#level-results-rows tbody');
  const recordLegend = document.querySelector('#level-results-record-legend');
  heading.textContent = `Level ${game.level.number ?? game.level.id} complete`;
  star.hidden = !summary.result.damageFree;
  previousStar.hidden = !summary.result.damageFree || !summary.previousStats.goldStar;
  document.querySelector('#level-results-cat-block').hidden = !summary.newCatBlock;
  rows.replaceChildren();
  const metrics = [
    { key: 'time', label: '🕒', labelText: 'Completion time', current: summary.result.time.toFixed(2),
      record: summary.previousStats.bestTime, format: value => value.toFixed(2) },
    { key: 'food', label: '🍗', labelText: 'Food points', current: summary.result.food,
      record: summary.previousStats.mostFood, format: value => value },
    { key: 'enemy', label: '👾', labelText: 'Enemy points', current: summary.result.enemy,
      record: summary.previousStats.mostEnemies, format: value => value },
    { key: 'goals', label: '⚽', labelText: 'Soccer goals', current: summary.result.goals,
      record: summary.previousStats.mostGoals, format: value => value },
    { key: 'moves', label: '👣', labelText: 'Moves', current: summary.result.moves,
      record: summary.previousStats.fewestMoves, format: value => value },
  ];
  let hasNewRecord = false;
  for (const metric of metrics) {
    const row = document.createElement('tr'), label = document.createElement('th');
    const current = document.createElement('td'), record = document.createElement('td');
    const isNewRecord = summary.newRecords[metric.key];
    row.className = `level-result-row${isNewRecord ? ' new-record' : ''}`;
    label.scope = 'row';
    label.setAttribute('aria-label', metric.labelText);
    label.textContent = metric.label;
    const colon = document.createElement('span');
    colon.className = 'level-results-label-colon';
    colon.textContent = ':';
    label.append(colon);
    current.textContent = metric.current;
    record.textContent = metric.record === null ? '—' : metric.format(metric.record);
    if (isNewRecord) {
      hasNewRecord = true;
      const marker = document.createElement('span');
      marker.className = 'new-record-marker';
      marker.textContent = '😺';
      marker.setAttribute('aria-label', 'New record');
      const target = summary.newRecords[metric.key] ? current : record;
      target.insertBefore(marker, target.firstChild);
    }
    row.append(label, current, record);
    rows.append(row);
  }
  recordLegend.hidden = !hasNewRecord;
  overlay.hidden = true;
  dialog.showModal();
  document.querySelector('#level-results-continue').focus({ preventScroll: true });
}

function syncLevelRewards() {
  if (levelRewardGame !== game) {
    levelRewardGame = game;
    const profile = activeSave ? activeSave.slot : guestProfile;
    previousLevelRewardResults = Object.fromEntries(Object.entries(profile.results ?? {}).filter(([id, result]) =>
      id !== attemptId && result.levelId === game.level.id));
    for (const pending of pendingSaves) {
      if (pending.result?.levelId === game.level.id && pending.id === runSave?.id && pending.attemptId !== attemptId) {
        previousLevelRewardResults[pending.attemptId] = pending.result;
      }
    }
    previousLevelRewardResults = Object.fromEntries(Object.entries(previousLevelRewardResults)
      .filter(([, result]) => result.outcome === 'won' && result.damageFree === true).slice(0, 1));
  }
  const states = levelRewardStates(game, previousLevelRewardResults, attemptId);
  const signature = JSON.stringify(states);
  if (displayedLevelRewards === signature) return;
  displayedLevelRewards = signature;
  const badges = [];
  for (const [kind, label, state, icon] of [
    ['star', 'Gold star', states.star, goldStarIcon],
    ['cat-block', 'Cat Block', states.catBlock, catBlockIcon],
  ]) {
    if (!state) continue;
    const badge = document.createElement('span');
    badge.className = `level-reward level-reward-${kind} level-reward-${state}`;
    const description = `${label}: ${state === 'owned' ? 'already collected' : state === 'pending'
      ? 'not yet collected; win this level to earn it' : 'not collected'}`;
    badge.setAttribute('role', 'img');
    badge.setAttribute('aria-label', description);
    badge.title = description;
    badge.append(icon(state === 'owned', document, 'currentColor', state === 'pending' ? 6 : 3));
    badges.push(badge);
  }
  document.querySelector('#level-rewards').replaceChildren(...badges);
}

function syncUI() {
  syncLevelRewards();
  levelInfoReplay.hidden = game.state !== 'ready' || !game.level.levelInfo;
  const stuck = game.stuckUntil > game.elapsed + 1e-9;
  if (stuck !== displayedStuck) {
    displayedStuck = stuck;
    if (game.state === 'playing') {
      toast.textContent = stuck ? '' : 'Free of the slime! Pick a brick to move.';
      toastUntil = performance.now() + 1800;
      status.textContent = stuck ? '' : toast.textContent;
    }
  }
  const { goal: GOAL, killGoal = 0, goalsGoal = 0, survive = false } = game.level;
  const DURATION = game.timeLimit;
  const foodTarget = !game.level.bossLevel && !survive && GOAL > 0 && Number.isFinite(GOAL);
  const enemyTarget = !game.level.bossLevel && !survive && killGoal > 0 && Number.isFinite(killGoal);
  const soccerGoalTarget = !game.level.bossLevel && !survive && goalsGoal > 0 && Number.isFinite(goalsGoal);
  const soccerGoals = game.goals ?? 0;
  const fraction = game.level.bossLevel ? 1 - (game.boss?.health ?? 6) / 6 : survive ? Math.min(1, game.elapsed / DURATION)
    : Math.min(1, GOAL > 0 ? game.score / GOAL : 1, killGoal > 0 ? game.enemies / killGoal : 1,
      goalsGoal > 0 ? soccerGoals / goalsGoal : 1);
  timer.innerHTML = Number.isFinite(DURATION) ? `🕒 ${Math.ceil(Math.max(0, DURATION - game.elapsed - 1e-9))}<span>s</span>` : '🕒 ∞';
  timer.setAttribute('aria-label', Number.isFinite(DURATION)
    ? `${Math.ceil(Math.max(0, DURATION - game.elapsed - 1e-9))} seconds remaining` : 'Unlimited time');
  foodCount.innerHTML = `🍗 ${game.score}${foodTarget ? ` <span>/ ${GOAL}</span>` : ''}`;
  timer.classList.toggle('win-target', survive);
  foodCount.classList.toggle('win-target', foodTarget);
  foodCount.setAttribute('aria-label', foodTarget ? `${game.score} of ${GOAL} food collected` : `${game.score} food collected`);
  hearts.textContent = '♥ '.repeat(game.hearts).trim() + ' ♡'.repeat(3 - game.hearts);
  const activationStatus = game.activationsRemaining == null
    ? '' : `; ${game.activationsRemaining} Boom Helmet activations remaining`;
  hearts.setAttribute('aria-label', `${game.hearts} of 3 hearts${activationStatus}`);
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
  document.querySelector('#level-number').textContent = game.level.number ?? game.level.id;
  document.querySelector('.level-badge strong').textContent = game.level.number ?? game.level.id;
  const world = WORLDS.find(world => world.id === game.level.worldId);
  const gameShell = document.querySelector('.game-shell');
  if (gameShell?.dataset) {
    if (world?.theme === 'official' && world.color) {
      gameShell.dataset.worldTheme = 'official';
      gameShell.style.setProperty('--level-world-color', world.color);
    } else delete gameShell.dataset.worldTheme;
  }
  document.querySelector('.intro .eyebrow').textContent = world
    ? `WORLD ${world.id} / ${world.name.toUpperCase()}` : 'CUSTOM / YOUR ADVENTURE';
  document.querySelector('.level-badge span').textContent = game.customLevel ? 'CUSTOM LEVEL' : game.level.name?.toUpperCase() ?? (game.levelIndex ? 'ROBO TROUBLE' : 'FIRST STEPS');
  document.querySelector('.objective strong').textContent = levelObjective(game.level);
  const enemyCount = document.querySelector('#enemy-count');
  enemyCount.textContent = `👾 ${game.enemies}${enemyTarget ? ` / ${killGoal}` : ''}`;
  enemyCount.classList.toggle('win-target', enemyTarget);
  enemyCount.setAttribute('aria-label', enemyTarget ? `${game.enemies} of ${killGoal} enemy points earned` : `${game.enemies} enemy points earned`);
  const goalCount = document.querySelector('#goal-count');
  goalCount.textContent = `⚽ ${soccerGoals}${soccerGoalTarget ? ` / ${goalsGoal}` : ''}`;
  goalCount.classList.toggle('win-target', soccerGoalTarget);
  goalCount.setAttribute('aria-label', soccerGoalTarget
    ? `${soccerGoals} of ${goalsGoal} goals scored` : `${soccerGoals} goals scored`);
  const weaponCount = game.weapon ? game.weapon.uses : null;
  const weaponLabel = game.weapon
    ? `Weapon: ${WEAPONS[game.weapon.type].name}, ${weaponCount} hit${weaponCount === 1 ? '' : 's'} remaining`
    : 'Weapon: none equipped';
  if (weaponStatus.textContent !== weaponLabel) weaponStatus.textContent = weaponLabel;
  const shieldLabel = game.catShield
    ? `Cat Shield: ${game.catShield}, ${CAT_SHIELDS[game.catShield].hits} hit${CAT_SHIELDS[game.catShield].hits === 1 ? '' : 's'} remaining`
    : 'Cat Shield: none';
  if (shieldStatus.textContent !== shieldLabel) shieldStatus.textContent = shieldLabel;
  const batteryLabel = `Batteries: ${game.batteries}`;
  document.querySelector('#battery-count').textContent = `🔋 ${game.batteries}`;
  document.querySelector('#battery-status').setAttribute('aria-label', batteryLabel);
  document.querySelector('#key-count').textContent = `🗝️ ${game.keys}`;
  document.querySelector('#key-status').setAttribute('aria-label', `Keys: ${game.keys}`);
  document.querySelector('#boss-health').hidden = !game.level.bossLevel;
  if (game.level.bossLevel) {
    const health = game.boss?.health ?? 6, maximum = game.boss?.maxHealth ?? 6;
    document.querySelector('#boss-health-label').textContent = `${game.boss?.name ?? CHARACTERS.boss}'s Health: `;
    document.querySelector('#boss-health-meter').setAttribute('aria-valuenow', health);
    document.querySelector('#boss-health-meter').setAttribute('aria-valuemax', maximum);
    document.querySelector('#boss-health-fill').style.width = `${health / maximum * 100}%`;
  }
  const gameCanvas = document.querySelector('#canvas');
  const turret = game.activeTurret;
  const wasInTurret = displayedTurret;
  displayedTurret = Boolean(turret);
  if (!turret && wasInTurret && game.state === 'playing' && !stuck) {
    document.querySelector('#game-status').textContent = 'Click a brick to move. Change course anytime.';
  }
  if (turret) {
    const color = turret.type === 'laser' ? 'blue' : 'red';
    document.querySelector('#game-status').textContent = `Tap or click a point to aim and fire. Watch the ${color} arc on the turret.`;
    gameCanvas.setAttribute('aria-label', `Inside ${turret.type} turret. ${turret.shotsRemaining} shots remain; the ${color} arc shows time remaining. Click or tap a point to aim and fire.`);
  } else {
    gameCanvas.setAttribute('aria-label', 'Game board. Click a colored boundary brick to steer Koshi. Keyboard users can Tab to a brick and press Enter to aim at its center. In a turret, click or tap to aim and fire.');
  }
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
  syncBrickDestructions();
  for (const item of buttons) {
    const { brick, button, members } = item;
    const visible = !game.level.autoscroll || game.brickVisible(brick, members);
    if (item.visible !== visible) {
      item.visible = visible;
      button.hidden = !visible;
      for (const artwork of [item.spring, item.spikes, item.conveyor, item.special?.info, item.special?.cloud]) {
        if (artwork) artwork.style.visibility = visible ? '' : 'hidden';
      }
    }
    if (!visible) continue;
    button.dataset.sunglassesGlow = String(game.sunglassesActive);
    button.style.setProperty('--sunglasses-color', `hsl(${game.elapsed * 140 % 360}, 85%, 70%)`);
    if (brick.crumbler && item.usesLeft !== brick.usesLeft) {
      item.usesLeft = brick.usesLeft;
      const wear = 1 - brick.usesLeft / brick.crumbler;
      const shape = brick.spikes ? brickSpikes(members, game.width, game.height, true, wear).body : brickShape(members, true, wear);
      button.style.clipPath = shape.clipPath;
      button.style.setProperty('--crumbler-wear', wear);
      for (const path of button.querySelectorAll('.brick-outline path')) path.setAttribute('d', shape.roundedPath);
      button.querySelector('.brick-cracks path').setAttribute('d', shape.cracks);
    }
    const remaining = Math.max(0, brick.readyAt - Math.max(game.elapsed, game.snailCooldownFreezeUntil));
    const warpSeconds = brick.warpUntil === null || brick.usesLeft === 0 ? null : Math.max(0, Math.ceil(brick.warpUntil - game.elapsed - 1e-9));
    const immutableGoal = brick.kind === 'goal';
    button.setAttribute('aria-disabled', String(immutableGoal || stuck || !game.brickSelectable(brick)));
    if (item.special) updateBrick(item.special, brick, game.elapsed, game.sunglassesActive && !['cinder', 'goal'].includes(brick.kind));
    if (item.special?.symbol) item.special.symbol.style.animationPlayState = game.state === 'playing' ? 'running' : 'paused';
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
    button.dataset.deactivated = String(brick.kind !== 'goal' && !game.sunglassesActive && brick.usesLeft === 0);
    const label = `${brick.kind} brick ${brick.id + 1}, ${immutableGoal ? 'scoring goal, cannot be activated or changed, and cannot be absorbed' : brick.kind === 'cinder' ? 'solid, cannot activate or be absorbed' : `${COOLDOWNS[brick.kind]} second cooldown`}${brick.crumbler ? `, Crumbler: ${brick.usesLeft} selections left${brick.usesLeft === 0 ? ', permanently deactivated' : ''}` : ''}${brick.warped ? `, Warped: ${brick.usesLeft === 0 ? 'frozen until restart or absorption' : warpSeconds === null ? `${brick.warped} second duration` : `${warpSeconds} seconds until restoration`}` : ''}${brick.slimed ? `, ${brick.slimeColor ?? 'green'} slime: sticks for ${SLIMES[brick.slimeColor ?? 'green'].duration} seconds` : ''}${brick.springs ? ', Springs: reflects Koshi' : ''}${brick.spikes ? ', Spikes: loses one heart on contact' : ''}${brick.conveyor ? `, Conveyor: carries Koshi ${brick.conveyorDirection ?? 'clockwise'}` : ''}${specialLabel(brick)}${game.sunglassesActive && !['cinder', 'goal'].includes(brick.kind) ? ', Magical Sunglasses: cooldown and selection locks temporarily bypassed' : ''}${tutorial?.target.id === brick.id ? ', suggested tutorial target' : ''}`;
    if (button.getAttribute('aria-label') !== label) {
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    button.tabIndex = game.state === 'playing' && !['cinder', 'goal'].includes(brick.kind) ? 0 : -1;
    button.classList.toggle('tutorial-target', Boolean(tutorial && tutorial.target.id === brick.id));
    button.style.setProperty('--cooldown-fill', `${['cinder', 'goal'].includes(brick.kind) || game.sunglassesActive ? 100 : brick.usesLeft === 0 ? 0 : Math.max(0, 1 - remaining / COOLDOWNS[brick.kind]) * 100}%`);
  }
  if (ending?.game !== game || ending?.state !== game.state) ending = null;
  if (['won', 'lost'].includes(game.state) && !ending) {
    ending = { game, state: game.state, elapsed: 0, duration: game.state === 'won' ? 2.4 : 1.8 };
    if (!tutorial) ending.summary = saveResult();
    overlay.hidden = true;
    toast.textContent = '';
    status.textContent = game.state === 'won' ? 'Level complete! Koshi is celebrating.' : 'Koshi needs another try.';
  }
  if (ending && !endingMotion.matches && ending.elapsed < ending.duration) return;
  if (ending?.resultsShown && !ending.mapReturned) return;
  if (game.state === 'won' && !tutorial && !game.customLevel && !ending.resultsShown) {
    ending.resultsShown = true;
    displayedState = game.state;
    status.textContent = 'Level complete! Review your results, then continue to the map.';
    toast.textContent = 'Level complete!';
    showCompletionResults(ending.summary);
    return;
  }
  if (displayedState === game.state) return;
  displayedState = game.state;
  if (game.state === 'ready') {
    const description = levelBriefingText(game.level);
    showDialog(`LEVEL ${game.level.number ?? game.level.id}`, 'Ready for this level?', description, 'Start', '🐾');
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
    const next = game.customLevel ? -1 : nextLevelIndex(game.levelIndex);
    const hasNext = next !== -1;
    showDialog(`LEVEL ${game.level.number ?? game.level.id} COMPLETE`, 'One well-fed hero.', survive
      ? `You survived all ${DURATION} seconds! You gathered ${game.score} food and earned ${game.enemies} enemy points.`
      : `You gathered ${game.score} food and earned ${game.enemies} enemy points with ${Math.ceil(DURATION - game.elapsed)} seconds to spare.`, game.customLevel ? 'Play again →' : hasNext ? 'Choose next level →' : 'Choose a level →', '🏆');
    status.textContent = hasNext ? `Level complete! Level ${LEVELS[next].number} is next.` : 'Level complete! Replay or choose a level.';
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
  if (!LEVELS.length && levelSelect.value !== 'custom') { openLevelPicker(); return; }
  phaseTransition.run(() => {
    saveResult();
    for (const dialog of [titleScreen, saveDialog, levelPicker]) if (dialog.open) dialog.close();
    game = createGame();
    attemptId = makeAttemptId();
    runSave = activeSave && !game.customLevel ? { index: activeSave.index, id: activeSave.slot.id } : null;
    updateSaveProfile();
    makeBrickButtons();
    displayedState = null;
    trail = [];
    toast.textContent = '';
    lastTime = null;
    resize();
    syncUI();
    showLevelIntroduction();
  });
}

function startLevel() {
  if (runSave && !tutorial && !game.customLevel) {
    pendingSaves.push({ ...runSave, levelId: game.level.id });
    saveAttempt(flushSaves);
  }
  game.start();
  checkpointAttempt();
  lastTime = null;
  syncUI();
  pause.focus({ preventScroll: true });
}

function showLevelBriefing() {
  displayedState = null;
  levelInfoReplay.hidden = !game.level.levelInfo;
  syncUI();
}

function showLevelIntroduction() {
  if (game.level.cutscene && (game.customLevel || !runSave
    || !isCutsceneViewed(game.level.id, runSave.id) || !skipCutscene.checked)) {
    overlay.hidden = true;
    cutscene.open(game.level.cutscene, game.level.number ?? game.level.id);
  } else showLevelInformation();
}

function showLevelInformation(replay = false) {
  if (!game.level.levelInfo) { showLevelBriefing(); return; }
  const info = validateLevelInfo(game.level.levelInfo);
  const signature = JSON.stringify(info);
  const key = !game.customLevel && runSave
    ? campaignMode.levelInfoKey(game.level.id, campaignId, runSave.id) : null;
  let viewed = key !== null && viewedLevelInfo.get(key) === signature;
  if (key && !viewed) {
    try {
      viewed = localStorage.getItem(key) === signature;
    } catch (error) { reportLevelInfoError(error); }
  }
  if (viewed && !replay && !game.customLevel) { showLevelBriefing(); return; }
  infoPages = info.pages;
  infoPage = 0;
  overlay.hidden = true;
  levelInfoDialog.showModal();
  renderLevelInfoPage();
}

function reportLevelInfoError(error) {
  console.error('Level information preferences:', error);
  const message = document.querySelector('#level-info-error');
  message.textContent = `Level information preferences could not be saved or restored: ${error.message}`;
  message.hidden = false;
  const levelError = document.querySelector('#level-error');
  levelError.textContent = message.textContent;
  levelError.hidden = false;
}

function renderLevelInfoPage() {
  const page = infoPages[infoPage];
  const title = document.querySelector('#level-info-title');
  title.textContent = page.title;
  document.querySelector('#level-info-text').textContent = page.text;
  const graphics = page.graphics.map(id => {
    const figure = document.createElement('figure'), caption = document.createElement('figcaption');
    if (['brick:slow', 'brick:normal', 'brick:fast'].includes(id)) {
      const [name, details] = INFO_GRAPHICS[id].split(' (');
      caption.append(name, document.createElement('br'), `(${details}`);
    } else caption.textContent = INFO_GRAPHICS[id];
    figure.append(guidePicture(id, INFO_GRAPHICS[id]), caption);
    return figure;
  });
  document.querySelector('#level-info-graphics').replaceChildren(...graphics);
  document.querySelector('#level-info-page').textContent = `${infoPage + 1} / ${infoPages.length}`;
  document.querySelector('#level-info-back').disabled = infoPage === 0;
  document.querySelector('#level-info-next').disabled = infoPage === infoPages.length - 1;
  document.querySelector('.level-info-content').scrollTop = 0;
  title.focus({ preventScroll: true });
}

function finishLevelInformation() {
  if (!levelInfoDialog.open) return;
  const signature = JSON.stringify({ pages: infoPages });
  if (!game.customLevel && runSave) {
    const key = campaignMode.levelInfoKey(game.level.id, campaignId, runSave.id);
    viewedLevelInfo.set(key, signature);
    try {
      localStorage.setItem(key, signature);
    } catch (error) { reportLevelInfoError(error); }
  }
  levelInfoDialog.close();
  infoPages = null;
  lastTime = null;
  showLevelBriefing();
  play.focus({ preventScroll: true });
}

levelInfoReplay.addEventListener('click', () => showLevelInformation(true));
document.querySelector('#level-info-back').addEventListener('click', () => {
  if (infoPage > 0) { infoPage--; renderLevelInfoPage(); }
});
document.querySelector('#level-info-next').addEventListener('click', () => {
  if (infoPage + 1 < infoPages.length) { infoPage++; renderLevelInfoPage(); }
});
document.querySelector('#level-info-close').addEventListener('click', finishLevelInformation);
levelInfoDialog.addEventListener('cancel', event => { event.preventDefault(); finishLevelInformation(); });
levelInfoDialog.addEventListener('keydown', event => {
  event.stopPropagation();
  if (event.key === 'Escape') { event.preventDefault(); finishLevelInformation(); }
});

play.addEventListener('click', () => {
  if (game.state === 'paused') {
    game.resume();
    lastTime = null;
    syncUI();
    pause.focus({ preventScroll: true });
  } else if (game.state === 'ready') {
    startLevel();
  } else {
    if (game.state === 'won' && !game.customLevel) {
      openLevelPicker({ insideWorld: true, level: game.levelIndex, advance: true });
      return;
    }
    begin();
  }
});
restart.addEventListener('click', begin);
document.querySelector('#title-start').addEventListener('click', () => {
  const recent = recentSave();
  if (recent) saveAttempt(() => continueSave(recent.index, recent.slot.id));
  else openLevelPicker();
});
function openLevelPicker({ insideWorld = false, level = null, advance = false } = {}) {
  autoPause();
  levelBeforePicker = levelSelect.value;
  if (level !== null) levelSelect.value = String(level);
  for (const dialog of [titleScreen, saveDialog]) if (dialog.open) dialog.close();
  levelPicker.showModal();
  worldMap.open();
  if (advance) worldMap.advanceFrom(Number(levelSelect.value));
  else if (insideWorld && worldMap.world) worldMap.showWorld(worldMap.world);
  else (document.querySelector('.map-node[aria-pressed="true"]') ?? document.querySelector('#level-picker-close')).focus();
}
const levelPicker = document.querySelector('#level-picker');
let levelBeforePicker = levelSelect.value;
function closeLevelPicker() {
  if (worldMap.layout.dataset.view !== 'worlds') {
    worldMap.open();
    (worldMap.map.querySelector('[aria-pressed="true"]') ?? document.querySelector('#level-picker-close')).focus({ preventScroll: true });
    return;
  }
  levelSelect.value = levelBeforePicker;
  levelPicker.close();
  titleScreen.showModal();
  document.querySelector('#title-start').focus({ preventScroll: true });
}
document.querySelector('#level-picker-close').addEventListener('click', closeLevelPicker);
levelPicker.addEventListener('cancel', event => { event.preventDefault(); closeLevelPicker(); });
levelPicker.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeLevelPicker(); }
});
document.querySelector('#level-picker-play').addEventListener('click', () => {
  if (worldMap.townLocation) {
    worldMap.openTownLocation(worldMap.townLocation.id);
    return;
  }
  begin();
});
const worldMap = new globalThis.KoshiWorldMap({
  selection: levelSelect,
  profile: () => activeSave ? activeSave.slot : guestProfile,
  picture: guidePicture,
  custom: () => customLevel,
  cutsceneViewed: isCutsceneViewed,
  openTownLocation: locationId => catTown.open(locationId),
});
const catTown = new globalThis.KoshiCatTown.CatTown({
  profile: () => activeSave ? activeSave.slot : guestProfile,
  levels: LEVELS,
  worlds: WORLDS,
  drawKoshi: drawCutsceneCharacter,
  saveProfile: state => {
    if (!activeSave) {
      guestProfile.catTown = state;
      return guestProfile;
    }
    let updated;
    if (!saveAttempt(() => { updated = saves.updateCatTown(activeSave.index, activeSave.slot.id, state); })) return null;
    activeSave.slot = updated;
    updateSaveProfile();
    return updated;
  },
  onReturn: () => worldMap.map.querySelector(`[data-node="${worldMap.townLocation?.id}"]`)?.focus({ preventScroll: true }),
});
const levelResultsDialog = document.querySelector('#level-results');
levelResultsDialog.addEventListener('cancel', event => event.preventDefault());
function continueFromCompletion() {
  levelResultsDialog.close();
  if (ending?.game === game) ending.mapReturned = true;
  openLevelPicker({ insideWorld: true, level: game.levelIndex, advance: true });
}
document.querySelector('#level-results-continue').addEventListener('click', continueFromCompletion);
function dismissTitle() {
  if (!game || !game.customLevel) {
    openLevelPicker();
    return;
  }
  phaseTransition.run(() => {
    titleScreen.close();
    play.focus({ preventScroll: true });
  });
}
titleScreen.addEventListener('cancel', event => {
  event.preventDefault();
  dismissTitle();
});
function resetBoard() {
  game = createGame();
  updateBoardVisibility();
  if (!game) return;
  makeBrickButtons();
  displayedState = null;
  displayedStuck = false;
  toast.textContent = '';
  trail = [];
  resize();
  syncUI();
}
function leaveTutorial() {
  tutorial = null;
  runSave = null;
  document.body.classList.remove('tutorial-active');
  document.querySelector('#tutorial-panel').hidden = true;
}
function showTitle() {
  autoPause();
  phaseTransition.run(() => {
    if (tutorial) {
      leaveTutorial();
      resetBoard();
    }
    if (!titleScreen.open) titleScreen.showModal();
    updateSaveProfile();
    document.querySelector('#title-tutorial').focus({ preventScroll: true });
  });
}
document.querySelector('#tutorial-exit').addEventListener('click', showTitle);
const exitConfirm = document.querySelector('#exit-confirm');
function closeExitConfirm() {
  exitConfirm.close();
  document.querySelector('#exit-level').focus({ preventScroll: true });
}
document.querySelector('#exit-level').addEventListener('click', () => {
  autoPause();
  exitConfirm.showModal();
  document.querySelector('#exit-confirm-cancel').focus({ preventScroll: true });
});
document.querySelector('#exit-confirm-cancel').addEventListener('click', closeExitConfirm);
exitConfirm.addEventListener('cancel', event => { event.preventDefault(); closeExitConfirm(); });
exitConfirm.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeExitConfirm(); }
});
document.querySelector('#exit-confirm-end').addEventListener('click', () => {
  exitConfirm.close();
  phaseTransition.run(() => {
    saveResult();
    if (tutorial) leaveTutorial();
    resetBoard();
    openLevelPicker({ insideWorld: true, level: levelSelect.value === 'custom' ? null : game?.levelIndex ?? null });
  });
});

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
  updateBoardVisibility();
  document.querySelector('#tutorial-step').value = String(index);
  document.querySelector('#tutorial-instruction').textContent = tutorial.lesson.instruction;
  document.querySelector('#tutorial-prev').disabled = index === 0;
  document.querySelector('#tutorial-next').textContent = index === LESSONS.length - 1 ? 'Finish tutorial' : 'Next';
  document.querySelector('#tutorial-sword-label').hidden = ![
    'mouse', 'wheel', 'goalie', 'robo-snail', 'robo-cow', 'robo-unicorn', 'robo-koshi',
    'ram', 'bucket', 'ball', 'jackolantern', 'snake', 'objectives',
  ].includes(tutorial.lesson.id);
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
    saveResult();
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

function guidePicture(picture, title, fillBrick = false) {
  if (picture === 'special:cat-block') {
    const image = document.createElement('img');
    image.className = 'guide-picture'; image.src = './icons/cat-building-block.png'; image.alt = title;
    return image;
  }
  if (picture === 'special:boom-helmet') {
    const image = document.createElement('canvas');
    image.className = 'guide-picture'; image.width = 320; image.height = 160;
    image.setAttribute('role', 'img'); image.setAttribute('aria-label', title);
    const previous = ctx;
    ctx = image.getContext('2d'); ctx.scale(2, 2);
    drawBoomHelmetArtwork(80, 82, 5);
    ctx = previous;
    return image;
  }
  if (picture.startsWith('special:')) {
    const type = picture.slice(8), image = document.createElement('div');
    image.className = 'guide-special-brick';
    image.setAttribute('role', 'img'); image.setAttribute('aria-label', title);
    const brick = { x: 0, y: 0, w: 160, h: 70,
      kind: type === 'goal' || type === 'cinder' ? type : 'normal',
      portal: type === 'portal' ? 'purple' : null, toggle: type === 'toggle' ? 4 : null,
      toggleRemaining: type === 'toggle' ? 4 : 0, boost: type === 'boost',
      barrier: type === 'barrier',
      power: type === 'power',
      turret: type === 'turret' ? 'laser' : null,
      hazard: type === 'hazard' ? { type: 'flame' } : null,
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
  if (kind === 'object' && type === 'soccer-ball') {
    drawSoccerBall(ctx, { x: 80, y: 42, radius: 16, vx: 0, vy: 0, angle: 0 });
  } else if (kind === 'object' && OBJECTS[type]?.bumper) {
    drawBumper(ctx, { x: 80, y: 42, type, radius: 22 }, 0);
  } else if (kind === 'object' && OBJECTS[type]?.bubble) {
    drawBubble({ x: 80, y: 42, color: OBJECTS[type].bubbleColor, radius: 24 });
  } else if (kind === 'object' && OBJECTS[type]?.catCircle) {
    drawCatCircle(ctx, { x: 80, y: 42, radius: 24 });
  } else if (kind === 'object' && OBJECTS[type]?.obstruction) {
    drawObstruction(ctx, { x: 80, y: 40, type, radius: 32 });
  } else if (kind === 'brick' || kind === 'slime') {
    const crumbler = type.includes('crumbler');
    const warped = type.includes('warped');
    const brickColor = type === 'spikes' ? '#59656a' : colors[type] ?? colors.normal;
    const brick = fillBrick
      ? { id: 0, x: 0, y: 0, w: 160, h: 80, region: { edge: 'top', start: 0, end: 1 } }
      : { id: 0, x: 18, y: 22, w: 124, h: 28, region: { edge: 'top', start: 0, end: 1 } };
    const shape = type === 'spikes' ? brickSpikes([brick], 600, 960).body : brickShape([brick], crumbler, crumbler ? .4 : 0);
    if (fillBrick) {
      ctx.fillStyle = brickColor;
      ctx.fillRect(0, 0, 160, 80);
    }
    ctx.save(); ctx.translate(brick.x, brick.y); ctx.scale(brick.w, brick.h);
    ctx.fillStyle = brickColor;
    ctx.fill(new Path2D(shape.path));
    ctx.restore();
    if (warped) {
      for (const x of [40, 120]) {
        ctx.beginPath();
        for (let i = 0; i <= 108; i++) {
          const angle = i / 108 * Math.PI * 5, radius = 2 + 29 * i / 108;
          const px = x + Math.cos(angle) * radius, py = 35 + Math.sin(angle) * radius;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.strokeStyle = '#17232cdd'; ctx.lineWidth = 2.8; ctx.stroke();
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
      surface(conveyor.belt, null, '#303840', 12);
      surface(conveyor.belt, null, '#8e969d', 7);
      surface(conveyor.teeth, '#adb4ba', '#303840', 2);
      surface(conveyor.arrows, '#303840');
    }
    if (type === 'springs') {
      const spring = brickSpring([brick], 600, 960, 0, 1.8);
      surface(spring.platform, '#a77a52', '#302015');
      surface(spring.grain, null, '#684128', .8);
      surface(spring.highlight, null, '#dfb47d', 1);
    }
    if (!fillBrick && (crumbler || warped)) {
      ctx.fillStyle = '#111d25'; ctx.fillRect(45, 28, 70, 17);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      ctx.fillText([crumbler ? 'C:3' : '', warped ? 'W:12' : ''].filter(Boolean).join(' '), 80, 41);
    }
  } else if (kind === 'enemy') {
    drawRobot({ type, x: 80, y: 42, distance: 0 });
  } else if (kind === 'weapon') {
    ctx.save(); ctx.translate(80, 40); ctx.scale(1.25, 1.25);
    drawWeapon(0, 0, type); ctx.restore();
  } else if (kind === 'item') {
    drawGameItem({ x: 80, y: 42, type });
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
  const id = GUIDE[guideIndex].practice;
  startTutorial(LESSONS.findIndex(lesson => lesson.id === id));
});
function togglePause() {
  if (!game) return;
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
  if (game?.state === 'playing') { game.pause(); syncUI(); }
  lastTime = null;
}
const installButton = document.getElementById('install-button');
if (installButton) installButton.addEventListener('click', autoPause);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { autoPause(); checkpointAttempt(); }
});
window.addEventListener('pagehide', checkpointAttempt);
window.addEventListener('blur', () => {
  // Android's gesture UI can blur a visible installed app without leaving it.
  if (!isInstalledApp() || document.hidden) autoPause();
});

function installBackNavigation() {
  if (!isInstalledApp() || customLevel) return;
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
  const playerCharacter = typeof game !== 'undefined' && game?.cat?.x === x && game?.cat?.y === y;
  if (expression === null && typeof game !== 'undefined' && game?.cat?.x === x && game?.cat?.y === y) {
    expression = game.cookieActive ? 'eating' : game.cookieLickUntil > game.elapsed ? 'licking' : null;
  }
  const healthExpression = playerCharacter && expression === null && game.hearts <= 2 ? game.hearts : null;
  ctx.save();
  ctx.translate(x, y);
  const hurt = damageProgress !== null;
  const darkRed = hurt && Math.floor(damageProgress * 4) % 2 === 0;
  const fur = hurt ? darkRed ? '#dc626b' : '#f2a0a5' : '#abb5bd';
  const stripes = hurt ? '#923c49' : '#596571';
  ctx.shadowColor = '#0008'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
  ctx.fillStyle = fur;
  const sawAge = game.sawStartedAt == null || game.cat.x !== x || game.cat.y !== y ? null : now - game.sawStartedAt;
  const sawGrowth = sawAge === null ? 0 : 1;
  if (sawAge !== null) {
    ctx.save();
    ctx.rotate(-Math.PI / 2 + Math.max(0, sawAge) * 36);
    traceSawBlade(ctx, 23, sawGrowth);
    ctx.fillStyle = fur; ctx.strokeStyle = '#53616d'; ctx.lineWidth = 1.5;
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  const bodyScale = game.cat.radius / 23;
  ctx.scale(bodyScale, bodyScale);
  ctx.save(); ctx.globalAlpha *= 1 - sawGrowth;
  ctx.beginPath();
  ctx.moveTo(-20, -8); ctx.lineTo(-22, -32); ctx.lineTo(-6, -21);
  ctx.lineTo(7, -21); ctx.lineTo(23, -32); ctx.lineTo(21, -7);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = fur;
  ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.save(); ctx.globalAlpha *= 1 - sawGrowth;
  ctx.fillStyle = hurt ? '#f6b3b8' : '#d6a4a4';
  ctx.beginPath(); ctx.moveTo(-18, -15); ctx.lineTo(-19, -25); ctx.lineTo(-11, -19); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13, -19); ctx.lineTo(20, -25); ctx.lineTo(18, -14); ctx.fill();
  ctx.restore();
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
  if (healthExpression === 1) {
    line([[-12, 1], [-9, 3], [-6, 1]], '#596571', 1.5);
    line([[6, 1], [9, 3], [12, 1]], '#596571', 1.5);
  }
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
  } else if (expression === 'eating') {
    ctx.fillStyle = '#572b35';
    ctx.beginPath(); ctx.ellipse(0, 15, 11, 12 + Math.sin(now * 18) * 1.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f18b9d';
    ctx.beginPath(); ctx.ellipse(0, 21, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  } else if (hurt || expression === 'lost') {
    ctx.moveTo(-8, 16); ctx.quadraticCurveTo(0, 7, 8, 16);
  } else if (healthExpression === 2) {
    ctx.moveTo(-8, 12); ctx.lineTo(8, 12);
  } else if (healthExpression === 1) {
    ctx.moveTo(-8, 12); ctx.quadraticCurveTo(0, 5, 8, 12);
  } else if (expression === 'licking') {
    ctx.moveTo(-8, 12); ctx.quadraticCurveTo(0, 19, 8, 12);
    ctx.stroke();
    const tip = 23 + Math.sin(now * 12) * 2;
    ctx.fillStyle = '#e84b58';
    ctx.beginPath(); ctx.moveTo(-1, 16);
    ctx.bezierCurveTo(-2, tip, 3, tip + 2, 5, 18);
    ctx.quadraticCurveTo(6, 15, 3, 16); ctx.closePath(); ctx.fill();
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

function drawCatShield(x, y, color, scale = 1, fillOpacity = 1) {
  const shades = {
    '#ed5555': ['#ffc2b8', '#ed5555', '#a82f3b'],
    '#63d877': ['#d3ffb0', '#63d877', '#287b4b'],
    '#519eff': ['#c5e8ff', '#519eff', '#2958a2'],
  }[color];
  const strokeLine = (points, width) => {
    ctx.beginPath();
    points.forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(-25, -34); ctx.lineTo(-14, -20); ctx.quadraticCurveTo(-9, -17, -6, -17);
  ctx.lineTo(0, -29); ctx.lineTo(6, -17); ctx.quadraticCurveTo(9, -17, 14, -20);
  ctx.lineTo(25, -34); ctx.lineTo(25, 13);
  ctx.quadraticCurveTo(24, 30, 8, 32); ctx.quadraticCurveTo(2, 34, 0, 42);
  ctx.quadraticCurveTo(-2, 34, -8, 32); ctx.quadraticCurveTo(-24, 30, -25, 13);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(-22, -30, 22, 36);
  gradient.addColorStop(0, shades[0]); gradient.addColorStop(.52, shades[1]); gradient.addColorStop(1, shades[2]);
  ctx.save(); ctx.globalAlpha *= fillOpacity; ctx.fillStyle = gradient; ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#17212a'; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#17212a';
  for (const sign of [-1, 1]) {
    ctx.strokeStyle = '#17212a';
    strokeLine([[sign * 12, -5], [sign * 8, -10], [sign * 3, -5]], 2);
    strokeLine([[sign * 11, 2], [sign * 21, -3]], 1.7);
    strokeLine([[sign * 16, 8], [sign * 23, 8]], 1.7);
    strokeLine([[sign * 15, 14], [sign * 21, 19]], 1.7);
  }
  ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(3, 2); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#17212a'; ctx.lineWidth = 1.7;
  ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, 11);
  ctx.quadraticCurveTo(-7, 19, -12, 12); ctx.moveTo(0, 11);
  ctx.quadraticCurveTo(7, 19, 12, 12); ctx.stroke();
  ctx.restore();
}

function drawEquippedCatShield(x, y, radius, color) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.save(); ctx.fillStyle = color; ctx.globalAlpha *= .1; ctx.fill(); ctx.restore();
  ctx.shadowColor = color; ctx.shadowBlur = 12;
  ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.stroke();
  ctx.shadowBlur = 0; ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffffb0'; ctx.stroke();
  ctx.restore();
}

function updateEnding(seconds) {
  if (!ending || ending.game !== game || document.hidden || document.querySelector('dialog[open]')) return;
  ending.elapsed = Math.min(ending.duration, ending.elapsed + Math.max(0, Math.min(seconds, .1)));
}

function endingPose(sequence, width, height) {
  const progress = Math.min(1, sequence.elapsed / sequence.duration);
  const cat = sequence.game.cat;
  const insideX = Math.max(40, Math.min(width - 40, cat.x));
  const insideY = Math.max(40, Math.min(height - 40, cat.y));
  const approach = Math.min(1, progress / .6);
  const slide = approach * approach * (3 - 2 * approach);
  const startX = sequence.offscreenDeath ? cat.x + (insideX - cat.x) * slide : insideX;
  const startY = sequence.offscreenDeath ? cat.y + (insideY - cat.y) * slide : insideY;
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

function drawGoalSpark(ctx, effect) {
  const progress = Math.max(0, Math.min(1, effect.age / effect.duration));
  const radius = 8 + progress * 34;
  ctx.save();
  ctx.globalAlpha *= 1 - progress;
  ctx.translate(effect.x, effect.y);
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5;
    const inner = radius * (i % 2 ? .4 : .22);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    ctx.strokeStyle = i % 2 ? '#ff9f43' : '#fff1a8';
    ctx.lineWidth = i % 2 ? 3 : 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnding() {
  const camera = game.camera();
  const pose = endingPose({ ...ending, offscreenDeath: game.offscreenDeath,
    game: { cat: { x: game.cat.x - camera.x, y: game.cat.y - camera.y } } }, camera.width, camera.height);
  pose.x += camera.x; pose.y += camera.y;
  ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(pose.rotation); ctx.scale(pose.scale, pose.scale);
  drawWornCape(game, 0, 0);
  drawCat(0, 0, ending.elapsed, null, false, ending.state);
  if (game.maskPickup) drawWornMask({ ...game, cat: { x: 0, y: 0 }, maskPickup: { ...game.maskPickup, x: 0, y: 0 } });
  if (game.sunglassesPickup) drawWornSunglasses({ ...game, cat: { x: 0, y: 0 },
    sunglassesPickup: { ...game.sunglassesPickup, x: 0, y: 0 } });
  if (game.boomHelmet && !game.boomHelmet.exploded) drawBoomHelmet(game, 0, 0);
  ctx.restore();
  if (game.boomHelmet?.exploded) drawBoomHelmet(game);
}

function powerupStreamRows(game) {
  const ended = ['won', 'lost'].includes(game.state);
  const active = [
    ['music', game.musicStreamStart, game.musicStreamUntil, game.musicPickup],
    ['sunglasses', game.sunglassesStart, game.sunglassesUntil, game.sunglassesPickup],
    ['cape', game.capeStart, game.capeUntil, game.capePickup],
    ['mask', game.maskUntil - 10, game.maskUntil, game.maskPickup],
    ['snail', game.snailStreamStart, game.snailStreamUntil, null],
  ].filter(([type, start, until, pickup]) => start != null && until > start
    && (ended ? (type === 'snail' ? game.snailStreamAge : pickup?.age) < until - start - 1e-9 : game.elapsed < until - 1e-9));
  return Object.fromEntries(active.map(([type], index) =>
    [type, Math.min(game.width, game.height) / 2 + (index - (active.length - 1) / 2) * 64]));
}

function robotDrawOrder(robots) {
  const goalies = robots.filter(enemy => enemy.type === 'goalie').sort((a, b) => a.y - b.y);
  let index = 0;
  return robots.map(enemy => enemy.type === 'goalie' ? goalies[index++] : enemy);
}

function turretDomeRotation(turret) {
  return Math.atan2(turret.direction.y, turret.direction.x) - Math.PI / 2;
}

function drawTurretBase(context, turret, opacity = 1) {
  context.save();
  context.globalAlpha *= opacity;
  const radius = turret.domeRadius;
  const rotation = turretDomeRotation(turret);
  context.translate(turret.anchor.x, turret.anchor.y);
  context.rotate(rotation);
  context.fillStyle = 'rgba(61, 150, 214, .42)';
  context.strokeStyle = '#a8dcf4';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(radius, 0);
  context.arc(0, 0, radius, 0, Math.PI);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();

  const barrelBase = {
    x: turret.anchor.x + turret.direction.x * radius,
    y: turret.anchor.y + turret.direction.y * radius,
  };
  const barrelEnd = {
    x: barrelBase.x + turret.aim.x * 36,
    y: barrelBase.y + turret.aim.y * 36,
  };
  context.save();
  context.globalAlpha *= opacity;
  context.lineCap = 'round';
  context.strokeStyle = '#29343b';
  context.lineWidth = 17;
  context.beginPath(); context.moveTo(barrelBase.x, barrelBase.y); context.lineTo(barrelEnd.x, barrelEnd.y); context.stroke();
  context.strokeStyle = '#8b969d';
  context.lineWidth = 10;
  context.beginPath(); context.moveTo(barrelBase.x, barrelBase.y); context.lineTo(barrelEnd.x, barrelEnd.y); context.stroke();
  context.fillStyle = '#c4cbd0';
  context.beginPath(); context.arc(barrelEnd.x, barrelEnd.y, 5, 0, Math.PI * 2); context.fill();
  context.restore();
}

function drawTurretReadout(context, turret, opacity = 1) {
  const side = { x: turret.direction.y, y: -turret.direction.x };
  const x = turret.anchor.x + turret.direction.x * 26 + side.x * 16;
  const y = turret.anchor.y + turret.direction.y * 26 + side.y * 16;
  context.save();
  context.globalAlpha *= opacity;
  context.fillStyle = '#142532dd';
  context.strokeStyle = '#c6e8f7';
  context.lineWidth = 2;
  context.beginPath(); context.arc(x, y, 13, 0, Math.PI * 2); context.fill(); context.stroke();
  context.fillStyle = '#fff';
  context.font = 'bold 15px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(turret.shotsRemaining), x, y + .5);
  context.restore();
}

function drawTurretTimer(context, turret, opacity = 1) {
  const fraction = Math.max(0, Math.min(1, turret.remaining / 10));
  if (!fraction) return;
  context.save();
  context.globalAlpha *= opacity;
  context.translate(turret.anchor.x, turret.anchor.y);
  context.rotate(turretDomeRotation(turret));
  context.beginPath();
  context.moveTo(turret.domeRadius, 0);
  context.arc(0, 0, turret.domeRadius, 0, Math.PI * fraction);
  context.strokeStyle = turret.type === 'laser' ? '#3b82f6' : '#ff4545';
  context.lineWidth = 6;
  context.lineCap = 'round';
  context.shadowColor = turret.type === 'laser' ? '#60a5fa' : '#ff3030';
  context.shadowBlur = 9;
  context.stroke();
  context.restore();
}

function drawTurretOnscreenCounter(context, turret, opacity = 1) {
  drawTurretReadout(context, turret, opacity);
  drawTurretTimer(context, turret, opacity);
}

function drawClippedToTurret(context, turret, draw) {
  context.save();
  const rotation = turretDomeRotation(turret);
  context.translate(turret.anchor.x, turret.anchor.y);
  context.rotate(rotation);
  context.beginPath();
  context.moveTo(turret.domeRadius, 0);
  context.arc(0, 0, turret.domeRadius, 0, Math.PI);
  context.closePath();
  context.clip();
  context.rotate(-rotation);
  context.translate(-turret.anchor.x, -turret.anchor.y);
  draw();
  context.restore();
}

function drawTurretRim(context, turret, opacity = 1) {
  context.save();
  context.globalAlpha *= opacity;
  context.translate(turret.anchor.x, turret.anchor.y);
  context.rotate(turretDomeRotation(turret));
  context.beginPath();
  context.moveTo(turret.domeRadius, 0);
  context.arc(0, 0, turret.domeRadius, 0, Math.PI);
  context.closePath();
  context.strokeStyle = '#d1d8dc';
  context.lineWidth = 3;
  context.stroke();
  context.restore();
}

function drawLaserBeam(context, beam, hazard = false) {
  context.lineCap = 'round';
  context.shadowColor = hazard ? '#ff4545' : '#7dd3fc'; context.shadowBlur = 20;
  context.strokeStyle = context.shadowColor; context.lineWidth = 10;
  context.beginPath(); context.moveTo(beam.start.x, beam.start.y); context.lineTo(beam.end.x, beam.end.y); context.stroke();
  context.shadowBlur = 0;
  context.strokeStyle = hazard ? '#ffd1c7' : '#e0f2fe'; context.lineWidth = 3;
  context.beginPath(); context.moveTo(beam.start.x, beam.start.y); context.lineTo(beam.end.x, beam.end.y); context.stroke();
}

function drawHazards(context, camera = null) {
  const visible = (x, y, w = 0, h = 0, margin = 32) => !camera || cameraBoundsVisible(camera, x, y, w, h, margin);
  for (const beam of game.hazardBeams) {
    if (!visible(Math.min(beam.start.x, beam.end.x), Math.min(beam.start.y, beam.end.y),
      Math.abs(beam.end.x - beam.start.x), Math.abs(beam.end.y - beam.start.y))) continue;
    context.save(); drawLaserBeam(context, beam, true); context.restore();
  }
  for (const part of game.hazardFlames) {
    if (!visible(part.x, part.y, part.w, part.h)) continue;
    context.save();
    context.strokeStyle = '#ff7928'; context.lineWidth = 10;
    context.shadowColor = '#ff7928'; context.shadowBlur = 12;
    context.strokeRect(part.x, part.y, part.w, part.h);
    context.shadowBlur = 0; context.strokeStyle = '#ffe15a'; context.lineWidth = 3;
    context.strokeRect(part.x, part.y, part.w, part.h);
    const geometry = globalThis.KoshiGame.turretGeometry(part, game.width, game.height);
    const vertical = geometry.direction.x !== 0, length = vertical ? part.h : part.w;
    for (let along = 6; along < length; along += 13) {
      const x = vertical ? geometry.anchor.x : part.x + along;
      const y = vertical ? part.y + along : geometry.anchor.y;
      const reach = 7 + Math.sin(game.elapsed * 12 + along) * 2;
      context.beginPath(); context.moveTo(x - (vertical ? 0 : 5), y - (vertical ? 5 : 0));
      context.lineTo(x + geometry.direction.x * reach, y + geometry.direction.y * reach);
      context.lineTo(x + (vertical ? 0 : 5), y + (vertical ? 5 : 0)); context.closePath();
      context.fillStyle = '#ffb52e'; context.fill();
    }
    context.restore();
  }
  for (const missile of game.hazardMissiles) {
    if (!visible(missile.x, missile.y)) continue;
    context.save(); context.translate(missile.x, missile.y); context.rotate(missile.angle);
    context.fillStyle = '#ffb52e';
    context.beginPath(); context.moveTo(-12, -4); context.lineTo(-22 - Math.sin(game.elapsed * 30) * 3, 0); context.lineTo(-12, 4); context.closePath(); context.fill();
    context.fillStyle = '#df4141'; context.strokeStyle = '#17212a'; context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(-10, -4); context.lineTo(-15, -11); context.lineTo(0, -6);
    context.lineTo(0, 6); context.lineTo(-15, 11); context.lineTo(-10, 4); context.closePath(); context.fill(); context.stroke();
    context.fillStyle = '#aeb7bd';
    context.beginPath(); context.moveTo(-12, -5); context.lineTo(5, -5);
    context.quadraticCurveTo(18, 0, 5, 5); context.lineTo(-12, 5); context.closePath(); context.fill(); context.stroke();
    context.restore();
  }
  for (const effect of game.hazardExplosions) {
    if (!visible(effect.x, effect.y, 0, 0, 100)) continue;
    const progress = effect.age / .42;
    context.save(); context.globalAlpha *= 1 - progress;
    context.fillStyle = '#ff693c55'; context.strokeStyle = '#ffb35a'; context.lineWidth = 3 * (1 - progress);
    context.beginPath(); context.arc(effect.x, effect.y, 12 + progress * 50, 0, Math.PI * 2); context.fill(); context.stroke();
    context.restore();
  }
}

function drawTurretEffects(context, camera = null) {
  for (const projectile of game.turretProjectiles) {
    if (camera && !cameraBoundsVisible(camera, projectile.x, projectile.y, 0, 0, 32)) continue;
    context.save();
    context.shadowColor = '#ff453a';
    context.shadowBlur = 18;
    context.fillStyle = '#ff5142';
    context.beginPath(); context.arc(projectile.x, projectile.y, 7, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#ffd27d';
    context.beginPath(); context.arc(projectile.x - 2, projectile.y - 2, 2.5, 0, Math.PI * 2); context.fill();
    context.restore();
  }
  for (const effect of game.turretEffects) {
    if (camera) {
      const visible = effect.type === 'laser'
        ? cameraBoundsVisible(camera, Math.min(effect.start.x, effect.end.x), Math.min(effect.start.y, effect.end.y),
          Math.abs(effect.end.x - effect.start.x), Math.abs(effect.end.y - effect.start.y), 32)
        : cameraBoundsVisible(camera, effect.x, effect.y, 0, 0, 100);
      if (!visible) continue;
    }
    const progress = effect.age / (effect.type === 'laser' ? .18 : .42);
    context.save();
    context.globalAlpha *= 1 - progress;
    if (effect.type === 'laser') {
      drawLaserBeam(context, effect);
    } else {
      const radius = 12 + progress * 75;
      context.fillStyle = '#ff693c55';
      context.beginPath(); context.arc(effect.x, effect.y, radius, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#ffb35a'; context.lineWidth = 3 * (1 - progress);
      context.beginPath(); context.arc(effect.x, effect.y, radius * .7, 0, Math.PI * 2); context.stroke();
    }
    context.restore();
  }
}

function cameraBoundsVisible(camera, x, y, width = 0, height = 0, margin = 0) {
  return x + width >= camera.x - margin && x <= camera.x + camera.width + margin
    && y + height >= camera.y - margin && y <= camera.y + camera.height + margin;
}

function render(now) {
  const WIDTH = game.width, HEIGHT = game.height;
  const camera = game.camera();
  const visible = (entity, margin = 96) => !game.level.autoscroll
    || cameraBoundsVisible(camera, entity.x, entity.y, 0, 0,
      margin + Math.max(entity.radius ?? 0, entity.width ?? 0, entity.height ?? 0));
  const visibleRobot = enemy => visible(enemy, enemy.type === 'snake' ? 240 : 96);
  const visibleRobots = game.robots.filter(visibleRobot);
  const ratioX = canvas.width / camera.width, ratioY = canvas.height / camera.height;
  for (const context of [boardCtx, actorCtx]) {
    context.setTransform(ratioX, 0, 0, ratioY, -camera.x * ratioX, -camera.y * ratioY);
  }
  const bricks = document.querySelector('#bricks');
  bricks.style.width = `${WIDTH / camera.width * 100}%`;
  bricks.style.height = `${HEIGHT / camera.height * 100}%`;
  bricks.style.transform = `translate(${-camera.x / camera.width * board.clientWidth}px, ${-camera.y / camera.height * board.clientHeight}px)`;
  for (const { brick, button, members } of buttons) button.inert = !game.brickVisible(brick, members);
  ctx = boardCtx;
  ctx.clearRect(camera.x, camera.y, camera.width, camera.height);
  for (const fence of game.barrierSegments()) {
    const endX = fence.x + fence.nx * fence.length, endY = fence.y + fence.ny * fence.length;
    if (!game.level.autoscroll || cameraBoundsVisible(camera, Math.min(fence.x, endX), Math.min(fence.y, endY),
      Math.abs(endX - fence.x), Math.abs(endY - fence.y), 32)) drawBarrier(ctx, fence);
  }
  ctx.fillStyle = '#273941';
  for (let x = 60 + Math.max(0, Math.floor((camera.x - 60) / 30)) * 30; x < Math.min(WIDTH, camera.x + camera.width); x += 30) for (let y = 60 + Math.max(0, Math.floor((camera.y - 60) / 30)) * 30; y < Math.min(HEIGHT, camera.y + camera.height); y += 30) {
    ctx.beginPath(); ctx.arc(x, y, .8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#9dbb9e09'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, 112, 0, Math.PI * 2); ctx.stroke();
  for (const circle of game.catCircles) if (visible(circle)) drawCatCircle(ctx, circle);
  for (const obstruction of game.obstructions) if (visible(obstruction)) {
    drawEmergingShot(obstruction, obstruction.color ?? OBJECTS[obstruction.type].color, shot => drawObstruction(ctx, shot));
  }
  for (const effect of game.obstructionDestructions) if (visible(effect, 160)) drawObstructionDestruction(ctx, effect);
  const streamRows = powerupStreamRows(game);
  drawMusicStream(game, streamRows.music);
  drawSunglassesStream(game, streamRows.sunglasses);
  drawCapeStream(game, streamRows.cape);
  drawMaskStream(game, streamRows.mask);
  if (game.snailStreamStart != null) drawSnailStream(game, streamRows.snail);
  ctx.font = '10px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#79918d44';
  ctx.fillText('K O S H I ’ S   Q U E S T', WIDTH / 2, HEIGHT - 67);
  const trajectory = game.trajectory();
  if (trajectory.length) {
    ctx.setLineDash([5, 7]);
    line(trajectory, '#d3ef8b26', 2.5);
    ctx.setLineDash([]);
  }
  for (const toast of game.bossProjectiles) {
    if (!visible(toast)) continue;
    ctx.save(); ctx.translate(toast.x, toast.y); ctx.rotate(toast.angle);
    ctx.fillStyle = toast.blue ? '#397bd4' : toast.burnt ? '#201919' : '#d39648';
    ctx.strokeStyle = toast.blue ? '#214679' : toast.burnt ? '#5f3c2d' : '#7a4726'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-11, -12, 22, 24, [7, 7, 2, 2]); ctx.fill(); ctx.stroke();
    ctx.fillStyle = toast.blue ? '#83b9ff' : toast.burnt ? '#090909' : '#f0c77e'; ctx.fillRect(-7, -7, 14, 15);
    ctx.restore();
  }
  if (game.state === 'playing' && (game.cat.vx || game.cat.vy)) {
    trail.push({ x: game.cat.x, y: game.cat.y, born: now });
  }
  trail = trail.filter(point => now - point.born < .22);
  for (const cue of game.spawnCues) if (visible(cue)) drawSpawnCue(cue);
  for (const food of game.food) {
    if (!visible(food)) continue;
    const left = Math.max(0, (food.expires - game.elapsed) / food.lifetime);
    ctx.save(); ctx.translate(food.x, food.y);
    ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(0, 17, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
    drawFoodBadge(food.type);
    ctx.fillStyle = '#10191f'; ctx.fillRect(-16, -28, 32, 5);
    ctx.fillStyle = left < .25 ? '#ff5a4a' : '#b8ff3c'; ctx.fillRect(-15, -27, 30 * left, 3);
    ctx.restore();
  }
  for (const item of game.items) {
    if (!visible(item)) continue;
    drawGameItem(item);
    drawObjectLifetime(item);
  }
  for (const bubble of game.bubbles) if (visible(bubble)) drawEmergingShot(bubble, SLIMES[bubble.color].color, drawBubble);
  for (const heart of game.healing) {
    if (!visible(heart)) continue;
    ctx.fillStyle = '#ef9d9d'; ctx.font = '30px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('♥', heart.x, heart.y + 10);
  }
  for (const item of game.weapons) {
    if (!visible(item)) continue;
    drawWeapon(item.x, item.y, item.type);
    drawObjectLifetime(item);
  }
  for (const enemy of game.robots) {
    for (const wave of enemy.waves ?? []) {
      if (!visible(wave, 16)) continue;
      const segments = game.fireWaveSegments(wave).filter(({ from, to }) => !game.level.autoscroll
        || cameraBoundsVisible(camera, Math.min(from[0], to[0]), Math.min(from[1], to[1]),
          Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]), 16));
      if (segments.length) drawFireWave(segments, wave.radius);
    }
  }
  for (const enemy of robotDrawOrder(visibleRobots)) {
    drawRobot(enemy, null, game.enemyDamageProgress(enemy));
    if (enemy.carriesCatBlock) drawCatBlockBadge(enemy.x + enemy.radius, enemy.y - enemy.radius - 10, 20);
    if (enemy.carriesKey) {
      ctx.save(); ctx.translate(enemy.x - enemy.radius, enemy.y - enemy.radius - 10);
      ctx.scale(.6, .6); drawKey(); ctx.restore();
    }
    if (enemy.asleep) {
      ctx.save(); ctx.fillStyle = '#d7c3ff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Z z', enemy.x + 19, enemy.y - enemy.radius - 6); ctx.restore();
    }
  }
  for (const enemy of robotDrawOrder(game.enemyDeaths.filter(visibleRobot))) drawEnemyDeath(enemy);
  for (const enemy of game.robots) for (const bomb of enemy.bombs ?? []) {
    if (visible(bomb, Math.max(96, bomb.blastRadius ?? 0))) drawBomb(bomb);
  }
  for (const pickup of game.pickups.filter(pickup => pickup.kind === 'food')) {
    if (!visible(pickup)) continue;
    const age = pickup.age;
    ctx.fillStyle = `rgba(211,239,139,${1 - age / .8})`;
    ctx.font = 'bold 19px "Space Grotesk", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`+${pickup.value}`, pickup.x, pickup.y - 20 - age * 45);
  }
  ctx = actorCtx;
  ctx.clearRect(camera.x, camera.y, camera.width, camera.height);
  for (const enemy of visibleRobots) if (enemy.type === 'robo-cow') drawCowGrass(enemy);
  const goalBricks = game.bricks.filter(brick => brick.kind === 'goal' && brick.absorbedBy === null);
  if (goalBricks.length) {
    const parts = game.brickParts();
    for (const brick of goalBricks) {
      const members = parts.filter(part => part.id === brick.id);
      if (game.level.autoscroll && !members.some(part => cameraBoundsVisible(camera, part.x, part.y, part.w, part.h, 32))) continue;
      drawGoal(ctx, members,
        game.sunglassesActive ? `hsl(${game.elapsed * 140 % 360}, 85%, 70%)` : null);
    }
  }
  for (const ball of game.soccerBalls ?? []) if (visible(ball)) drawSoccerBall(ctx, ball);
  for (const bumper of game.bumpers ?? []) if (visible(bumper)) {
    drawEmergingShot(bumper, OBJECTS[bumper.type]?.color ?? '#ffffff', shot => drawBumper(ctx, shot, game.elapsed));
  }
  for (const effect of game.goalEffects ?? []) if (visible(effect)) drawGoalSpark(ctx, effect);
  for (const effect of game.brickDestructions) {
    if (!game.level.autoscroll || effect.members.some(part => cameraBoundsVisible(camera, part.x, part.y, part.w, part.h, 40))) drawBrickDestructionSmoke(effect);
  }
  for (const pickup of game.pickups) if (visible(pickup, 160)) drawPickupPop(pickup);
  if (ending?.game === game && ending.state === game.state && !endingMotion.matches) {
    for (const effect of game.brickStamps ?? []) drawBrickStamp(effect, game);
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
  drawWornCape(game, game.cat.x, game.cat.y);
  if (game.catShield) drawEquippedCatShield(game.cat.x, game.cat.y, game.cat.radius + 9, CAT_SHIELDS[game.catShield].color);
  for (const turret of game.turretFades) {
    const opacity = Math.max(0, 1 - turret.age / .4);
    drawTurretBase(ctx, turret, opacity);
    drawTurretRim(ctx, turret, opacity);
    drawTurretOnscreenCounter(ctx, turret, opacity);
  }
  if (game.activeTurret) drawTurretBase(ctx, game.activeTurret);
  if (game.activeTurret) {
    const drawSeatedKoshi = () => {
      drawCat(game.cat.x, game.cat.y, game.elapsed, game.damageProgress, game.boostReady);
    };
    if (game.activeTurret.entry) drawSeatedKoshi();
    else drawClippedToTurret(ctx, game.activeTurret, drawSeatedKoshi);
  } else {
    drawCat(game.cat.x, game.cat.y, game.elapsed, game.damageProgress, game.boostReady);
  }
  if (game.bubbleTrap) drawBubble({ ...game.bubbleTrap, x: game.cat.x, y: game.cat.y, radius: 24 }, true);
  for (const pop of game.bubblePops) drawBubblePop(pop);
  if (game.activeTurret) drawTurretRim(ctx, game.activeTurret);
  if (game.activeTurret) drawTurretOnscreenCounter(ctx, game.activeTurret);
  if (game.maskPickup) drawWornMask(game);
  if (game.sunglassesPickup) drawWornSunglasses(game);
  if (game.boomHelmet) drawBoomHelmet(game);
  for (const effect of game.brickStamps ?? []) drawBrickStamp(effect, game);
  if (game.dittoStamp && !game.brickStamps.some(effect => effect.capturing)) {
    ctx.save();
    ctx.translate(game.cat.x + 33, game.cat.y - 22 + Math.sin(game.elapsed * 3) * 3);
    ctx.scale(.65, .65); ctx.rotate(-.2);
    drawDittoStamp(colors[game.dittoSource?.kind] ?? '#696879');
    ctx.restore();
  }
  if (game.paintBrush) {
    ctx.save();
    ctx.translate(game.cat.x - 34, game.cat.y - 18 + Math.sin(game.elapsed * 3) * 3);
    ctx.save(); ctx.scale(.7, .7); ctx.rotate(-.3);
    drawPaintbrush(ctx, ITEMS[game.paintBrush.type]); ctx.restore();
    ctx.fillStyle = '#fff8e6'; ctx.strokeStyle = '#17212a'; ctx.lineWidth = 3;
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.strokeText(String(game.paintBrush.uses), 0, 29);
    ctx.fillText(String(game.paintBrush.uses), 0, 29);
    ctx.restore();
  }
  if (game.batteries > 0) {
    const angle = game.elapsed * 1.8;
    const x = game.cat.x + Math.cos(angle) * 34, y = game.cat.y + Math.sin(angle) * 28;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = '#ffe34a'; ctx.strokeStyle = '#593f0a'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(-5, 1); ctx.lineTo(0, 1); ctx.lineTo(-2, 10); ctx.lineTo(6, -2); ctx.lineTo(1, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
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
  const swing = [...game.weaponAttacks].reverse().find(attack => attack.age < .18);
  if (game.weapon || swing) {
    const type = game.weapon?.type ?? swing.type;
    const age = swing && swing.type === type ? swing.age : null;
    const swingAngle = age === null ? 0 : Math.sin(age / .18 * Math.PI) * Math.PI / 4;
    ctx.save(); ctx.translate(game.cat.x + 30, game.cat.y - 20); ctx.rotate(swingAngle);
    drawWeapon(0, 0, type, game.weapon?.type === type ? String(game.weapon.uses) : undefined);
    ctx.restore();
  }
  for (const attack of game.weaponAttacks) {
    const age = attack.age;
    if (age >= 0 && age < .55 && visible(attack, 64)) drawAttackPop(attack, age);
  }
  drawTurretEffects(ctx, game.level.autoscroll ? camera : null);
  drawHazards(ctx, game.level.autoscroll ? camera : null);
  ctx = boardCtx;
}

function drawFoodBadge(type) {
  ctx.fillStyle = '#fff8e6'; ctx.strokeStyle = FOOD_COLORS[type]; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#000'; ctx.filter = 'saturate(1.8) brightness(1.15) contrast(1.1)';
  ctx.font = '25px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(FOODS[type].icon, 0, 1);
  ctx.filter = 'none';
}

function drawWornSunglasses(game) {
  const pickup = game.sunglassesPickup;
  const progress = Math.min(1, pickup.age / .25);
  const eased = progress * progress * (3 - 2 * progress);
  const duration = game.sunglassesUntil - game.sunglassesStart;
  const opacity = Math.max(0, Math.min(1, (duration + .5 - pickup.age) / .5));
  ctx.save(); ctx.globalAlpha *= opacity;
  ctx.translate(pickup.x + (game.cat.x - pickup.x) * eased, pickup.y + (game.cat.y - 4 - pickup.y) * eased);
  const scale = 1 - eased * .15;
  ctx.scale(scale, scale);
  drawMagicSunglasses(game.elapsed, progress < 1);
  ctx.restore();
}

function drawDittoStamp(ink = '#929399') {
  ctx.save(); ctx.scale(.8, .8);
  ctx.strokeStyle = '#6c2814'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
  ctx.fillStyle = ink; ctx.strokeStyle = '#49494e';
  ctx.beginPath(); ctx.rect(-20, 16, 40, 7); ctx.fill(); ctx.stroke();
  const wood = ctx.createLinearGradient(-18, -28, 18, 16);
  wood.addColorStop(0, '#ffc181'); wood.addColorStop(.5, '#ff9a4f'); wood.addColorStop(1, '#e26c2e');
  ctx.fillStyle = wood; ctx.strokeStyle = '#6c2814'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.roundRect(-22, 3, 44, 13, 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-5, -9);
  ctx.bezierCurveTo(-18, -14, -15, -32, 0, -32);
  ctx.bezierCurveTo(15, -32, 18, -14, 5, -9);
  ctx.lineTo(8, 3); ctx.quadraticCurveTo(0, 6, -8, 3);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.clip(); ctx.strokeStyle = '#e67e39'; ctx.lineWidth = .9;
  ctx.beginPath(); ctx.moveTo(-10, -25); ctx.bezierCurveTo(-2, -29, 3, -19, 12, -23);
  ctx.moveTo(-12, -18); ctx.bezierCurveTo(-3, -23, 4, -13, 11, -17);
  ctx.moveTo(0, -8); ctx.bezierCurveTo(4, -5, -3, -2, 1, 3); ctx.stroke();
  ctx.strokeStyle = '#ffdcaa'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-10, -21); ctx.bezierCurveTo(-11, -27, -4, -30, 1, -29);
  ctx.moveTo(-3, -7); ctx.lineTo(-5, 1); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#d46a30'; ctx.lineWidth = .9;
  ctx.beginPath(); ctx.moveTo(-18, 9); ctx.bezierCurveTo(-7, 5, 3, 13, 18, 8);
  ctx.moveTo(-15, 13); ctx.bezierCurveTo(-6, 10, 5, 15, 14, 12); ctx.stroke();
  ctx.strokeStyle = '#ffd095'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-19, 6); ctx.lineTo(19, 6); ctx.stroke();
  ctx.restore();
}

function drawSpookyMask() {
  ctx.save();
  ctx.strokeStyle = '#5b1727'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.fillStyle = '#ffe9b0';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * 9, -15);
    ctx.bezierCurveTo(side * 27, -15, side * 25, -26, side * 20, -31);
    ctx.quadraticCurveTo(side * 21, -20, side * 14, -21); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  const red = ctx.createLinearGradient(-20, -20, 20, 22);
  red.addColorStop(0, '#ff7771'); red.addColorStop(.4, '#de3641'); red.addColorStop(1, '#851c32');
  ctx.fillStyle = red;
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side, 1);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(16, -8); ctx.lineTo(24, -12);
    ctx.quadraticCurveTo(25, 0, 19, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8f2138';
    ctx.beginPath(); ctx.moveTo(19, -6); ctx.lineTo(22, -8); ctx.lineTo(20, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(-17, -11); ctx.quadraticCurveTo(-23, -5, -20, 4);
  ctx.quadraticCurveTo(-15, 19, 0, 24); ctx.quadraticCurveTo(15, 19, 22, 4);
  ctx.quadraticCurveTo(23, -5, 17, -11); ctx.quadraticCurveTo(0, -27, -17, -11); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side, 1);
    ctx.fillStyle = '#ffde42'; ctx.beginPath(); ctx.moveTo(3, -5); ctx.lineTo(16, -10);
    ctx.quadraticCurveTo(17, 2, 5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#271b18'; ctx.beginPath(); ctx.ellipse(11, -5, 1, 4, .2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#721526'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(3, -7); ctx.lineTo(17, -13); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#ff665a'; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-4, 7); ctx.lineTo(5, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#381221'; ctx.beginPath(); ctx.moveTo(-15, 8);
  ctx.quadraticCurveTo(0, 12, 15, 8); ctx.quadraticCurveTo(10, 21, 0, 20);
  ctx.quadraticCurveTo(-10, 21, -15, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff4cd';
  for (let i = 0; i < 7; i++) {
    const x = -12 + i * 4, y = 9 + Math.sin(i / 6 * Math.PI) * 2;
    ctx.beginPath(); ctx.moveTo(x - 1.8, y); ctx.lineTo(x + 1.8, y); ctx.lineTo(x, y + 5); ctx.closePath(); ctx.fill();
    if (i > 0 && i < 6) {
      ctx.beginPath(); ctx.moveTo(x - 1.8, 19); ctx.lineTo(x + 1.8, 19); ctx.lineTo(x, 15); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

function drawWornMask(game) {
  const pickup = game.maskPickup;
  const progress = Math.min(1, pickup.age / .25);
  const eased = progress * progress * (3 - 2 * progress);
  ctx.save(); ctx.globalAlpha *= Math.max(0, Math.min(1, (10.5 - pickup.age) / .5));
  ctx.translate(pickup.x + (game.cat.x - pickup.x) * eased, pickup.y + (game.cat.y - 2 - pickup.y) * eased);
  ctx.scale(1 - eased * .18, 1 - eased * .18);
  drawSpookyMask(); ctx.restore();
}

function drawBoomHelmetArtwork(x, y, remaining, fallOffset = 0) {
  ctx.save(); ctx.translate(x, y + fallOffset);
  ctx.fillStyle = '#287dcc'; ctx.strokeStyle = '#17212a'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-22, -11);
  ctx.quadraticCurveTo(-24, -31, -12, -39);
  ctx.quadraticCurveTo(0, -48, 12, -39);
  ctx.quadraticCurveTo(24, -31, 22, -11);
  ctx.lineTo(17, -7); ctx.lineTo(-17, -7); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#70b5f2'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(-1, -28, 12, Math.PI * 1.12, Math.PI * 1.86); ctx.stroke();
  ctx.fillStyle = '#8a6953'; ctx.strokeStyle = '#17212a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-4, -48, 8, 7, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f1f3f4'; ctx.beginPath(); ctx.arc(0, -22, 9.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#111820'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#111820'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(remaining), 0, -21.5);
  ctx.restore();
}

function drawBoomHelmetExplosion(x, y, age) {
  const progress = Math.max(0, Math.min(1, age / .9));
  if (progress >= 1) return;
  ctx.save(); ctx.translate(x, y - 22); ctx.globalAlpha *= 1 - progress;
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const distance = 16 + progress * 48;
    ctx.fillStyle = ['#d93620', '#f05a20', '#ff8c28'][i % 3];
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, 12 + progress * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    ctx.strokeStyle = i % 2 ? '#ff8c28' : '#ed4020';
    const angle = i * Math.PI / 6 + Math.PI / 12;
    const inner = 18 + progress * 38, outer = inner + 20 * (1 - progress);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(0, 0, 18 * (1 - progress), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBoomHelmet(game, x = game.cat.x, y = game.cat.y) {
  const helmet = game.boomHelmet;
  if (helmet.exploded) {
    drawBoomHelmetExplosion(x, y, helmet.age);
    return;
  }
  const progress = Math.max(0, Math.min(1, helmet.age / .7));
  const eased = progress * progress * (3 - 2 * progress);
  drawBoomHelmetArtwork(x, y, game.activationsRemaining, -96 * (1 - eased));
}

function drawBrickStamp(effect, game) {
  const press = Math.max(0, Math.min(1, (effect.age - .18) / .47));
  ctx.save();
  ctx.globalAlpha = (1 - press) * .65;
  ctx.fillStyle = colors[effect.kind];
  for (const part of effect.members) {
    ctx.save(); ctx.beginPath(); ctx.rect(part.x, part.y, part.w, part.h); ctx.clip();
    const radius = Math.hypot(Math.max(Math.abs(part.x - effect.x), Math.abs(part.x + part.w - effect.x)),
      Math.max(Math.abs(part.y - effect.y), Math.abs(part.y + part.h - effect.y)));
    ctx.beginPath(); ctx.arc(effect.x, effect.y, press * radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff1c9'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  }
  const arriving = Math.min(1, effect.age / .18);
  const returning = Math.max(0, Math.min(1, (effect.age - .3) / .35));
  const homeX = game ? game.cat.x + 33 : effect.fromX ?? effect.x;
  const homeY = game ? game.cat.y - 22 : effect.fromY ?? effect.y - 40;
  const squash = Math.sin(Math.min(1, Math.max(0, (effect.age - .18) / .12)) * Math.PI) * .18;
  const scale = .65 + arriving * .35 - (effect.capturing ? returning * .35 : 0);
  const angle = -.2 + ((effect.angle ?? 0) + .2) * arriving * (effect.capturing ? 1 - returning : 1);
  const offset = 23 * .8 * scale * (1 - squash);
  const contactX = effect.x + Math.sin(angle) * offset;
  const contactY = effect.y - Math.cos(angle) * offset;
  let x = (effect.fromX ?? effect.x) * (1 - arriving) + contactX * arriving;
  let y = (effect.fromY ?? effect.y - 40) * (1 - arriving) + contactY * arriving;
  if (effect.capturing) {
    x += (homeX - x) * returning; y += (homeY - y) * returning;
  } else y -= returning * 35;
  ctx.globalAlpha = effect.capturing ? 1 : 1 - returning;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale * (1 + squash), scale * (1 - squash));
  drawDittoStamp(colors[effect.kind]);
  ctx.restore();
}

function drawBrickDestructionSmoke(effect) {
  const progress = Math.min(1, effect.age);
  if (progress >= 1) return;
  ctx.save();
  ctx.globalAlpha = Math.sin(Math.PI * progress) * .65;
  for (const part of effect.members) {
    const count = Math.max(2, Math.ceil(Math.max(part.w, part.h) / 14));
    for (let i = 0; i < count; i++) {
      const fraction = (i + .5) / count;
      const vertical = part.h > part.w;
      const x = part.x + part.w * (vertical ? .5 : fraction) + Math.sin(i * 2.4) * progress * 7;
      const y = part.y + part.h * (vertical ? fraction : .5) - progress * (8 + i % 3 * 4);
      ctx.fillStyle = i % 2 ? '#a7acb0' : '#737b82';
      ctx.beginPath(); ctx.arc(x, y, 4 + progress * 10, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawPickupPop(pickup) {
  if (['magic-sunglasses', 'spooky-mask', 'ditto-stamp'].includes(pickup.type)) return;
  if (pickup.type === 'treasure-chest') {
    const opening = Math.min(1, pickup.age / .35);
    ctx.save(); ctx.translate(pickup.x, pickup.y);
    ctx.globalAlpha *= Math.max(0, 1 - Math.max(0, pickup.age - .9) / .55);
    drawTreasureChest(opening);
    ctx.restore();
    if (pickup.age < .9) {
      const rise = Math.max(0, Math.min(1, (pickup.age - .2) / .7));
      if (rise > 0) drawCatBlockArt(pickup.x, pickup.y - 46 * rise, 50 * rise);
    } else {
      drawPickupPop({ ...pickup, type: 'cat-block', y: pickup.y - 46, age: pickup.age - .9 });
    }
    return;
  }
  const progress = Math.min(1, pickup.age / .55);
  if (progress >= 1) return;
  ctx.save(); ctx.translate(pickup.x, pickup.y);
  ctx.globalAlpha = 1 - progress;
  const scale = progress < .22 ? 1 + progress / .22 * .25 : 1.25 * (1 - (progress - .22) / .78);
  ctx.save(); ctx.scale(scale, scale);
  if (pickup.kind === 'weapon') drawWeapon(0, 0, pickup.type);
  else if (pickup.kind === 'item') drawGameItem({ x: 0, y: 0, type: pickup.type });
  else drawFoodBadge(pickup.type);
  ctx.restore();
  ctx.fillStyle = '#fff0b0';
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4, radius = 16 + progress * 28, size = 3 * (1 - progress);
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawBubble(bubble, trapped = false) {
  const radius = bubble.radius ?? 24;
  const color = SLIMES[bubble.color].color;
  ctx.save(); ctx.translate(bubble.x, bubble.y);
  ctx.globalAlpha *= trapped ? .58 : .78;
  ctx.shadowColor = color; ctx.shadowBlur = trapped ? 15 : 9;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha *= .48;
  ctx.fillStyle = '#d7faff';
  ctx.beginPath(); ctx.arc(-radius * .2, -radius * .2, radius * .77, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = trapped ? .92 : .8;
  ctx.strokeStyle = '#f3ffff'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, radius - 1, -.4, Math.PI * 1.65); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(-radius * .36, -radius * .4, radius * .13, radius * .24, -.55, 0, Math.PI * 2); ctx.fill();
  if (trapped) {
    const remaining = Math.max(0, Math.min(1, 1 - bubble.age / (bubble.transition + bubble.duration)));
    if (remaining > 0) {
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(0, 0, radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
      ctx.strokeStyle = '#123c50'; ctx.lineWidth = 3.5; ctx.stroke();
      ctx.strokeStyle = '#d7faff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
  ctx.restore();
}

const SHOT_EMERGE = .5;
// Gun shots slide out from behind the brick face while a muzzle ring flares at the opening.
function drawEmergingShot(shot, color, draw) {
  const age = shot.emerge?.age ?? Infinity;
  if (!(age < SHOT_EMERGE)) { draw(shot); return; }
  const { x, y, dx, dy } = shot.emerge, angle = Math.atan2(dy, dx);
  const t = Math.max(0, age / SHOT_EMERGE), ease = t * t * (3 - 2 * t);
  const lag = (shot.radius * 2 + .1) * (1 - ease), scale = .6 + .4 * ease;
  const cx = shot.x - dx * lag, cy = shot.y - dy * lag;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath(); ctx.rect(0, -shot.radius * 3, shot.radius * 6, shot.radius * 6); ctx.clip();
  ctx.rotate(-angle); ctx.translate(cx - x, cy - y); ctx.scale(scale, scale);
  draw({ ...shot, x: 0, y: 0 });
  ctx.restore();
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.globalAlpha *= 1 - t;
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(2 + t * 6, 0, 3 + t * 7, shot.radius * (.9 + t * .35), 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (const side of [-1, 1]) for (const step of [.55, 1]) {
    ctx.beginPath(); ctx.arc(3 + t * 14 * step, side * shot.radius * (.75 + t * .5) * step, 2.5 * (1 - t), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBubblePop(pop) {
  const progress = Math.min(1, pop.age / .55);
  if (progress >= 1) return;
  ctx.save(); ctx.translate(pop.x, pop.y);
  ctx.globalAlpha = 1 - progress;
  ctx.strokeStyle = '#d7faff'; ctx.lineWidth = 2 * (1 - progress);
  const radius = 24 + progress * 22;
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    ctx.beginPath(); ctx.arc(0, 0, radius, angle + progress * .3, angle + .55); ctx.stroke();
    const distance = 24 + progress * (i % 2 ? 48 : 36);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance + progress * progress * 22;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = SLIMES[pop.color].color;
    ctx.beginPath(); ctx.ellipse(0, 0, 2.5 * (1 - progress), 5 * (1 - progress), 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawObjectLifetime(item) {
  if (item.lifetime == null) return;
  const left = Math.max(0, Math.min(1, (item.expires - game.elapsed) / item.lifetime));
  ctx.save(); ctx.translate(item.x, item.y);
  ctx.fillStyle = '#10191f'; ctx.fillRect(-16, -30, 32, 5);
  ctx.fillStyle = left < .25 ? '#ff5a4a' : '#b8ff3c'; ctx.fillRect(-15, -29, 30 * left, 3);
  ctx.restore();
}

function drawSpawnCue({ kind, x, y, progress, obstruction, bumper }) {
  ctx.save();
  if (obstruction || bumper) {
    const { radius, width, height } = bumper ?? globalThis.KoshiGame.obstructionGeometry(obstruction);
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = '#f1f3f2'; ctx.lineWidth = 2;
    ctx.setLineDash([3, 5]); ctx.beginPath();
    const shape = bumper ? 'circle' : globalThis.KoshiGame.OBJECTS[obstruction.type].obstruction;
    if (shape === 'circle') ctx.arc(0, 0, radius, 0, Math.PI * 2);
    else if (shape === 'rectangle') ctx.rect(-width / 2, -height / 2, width, height);
    else {
      ctx.moveTo(0, -radius); ctx.lineTo(radius, 0); ctx.lineTo(0, radius); ctx.lineTo(-radius, 0); ctx.closePath();
    }
    ctx.stroke();
    if (bumper) {
      for (const fraction of [.72, .43, .14]) {
        ctx.beginPath(); ctx.arc(0, 0, radius * fraction, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  }
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

function drawSword(x, y, color, label) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(.5);
  ctx.fillStyle = color; ctx.strokeStyle = '#17212a'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(6, -14); ctx.lineTo(4, 10); ctx.lineTo(-4, 10); ctx.lineTo(-6, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
  line([[0, 12], [0, 22]], '#17212a', 7);
  line([[0, 12], [0, 22]], '#8a6953', 5);
  line([[-10, 10], [10, 10]], '#17212a', 6);
  line([[-10, 10], [10, 10]], color, 4);
  if (label !== undefined) {
    const [red, green, blue] = color.slice(1).match(/../g).map(component => {
      const value = parseInt(component, 16) / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    const luminance = .2126 * red + .7152 * green + .0722 * blue;
    ctx.fillStyle = (luminance + .05) / .05 >= 1.05 / (luminance + .05) ? '#000000' : '#ffffff';
    ctx.translate(0, -5);
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0, 9);
  }
  ctx.restore();
}

function drawHammer(x, y, color, label) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(.5);
  line([[0, -3], [0, 27]], '#17212a', 7);
  line([[0, -3], [0, 27]], '#8a6953', 5);
  ctx.fillStyle = color; ctx.strokeStyle = '#17212a'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-13, -19); ctx.lineTo(13, -19); ctx.lineTo(17, -15); ctx.lineTo(17, -4);
  ctx.lineTo(13, 0); ctx.lineTo(5, 0); ctx.lineTo(3, 3); ctx.lineTo(-3, 3);
  ctx.lineTo(-5, 0); ctx.lineTo(-13, 0); ctx.lineTo(-17, -4); ctx.lineTo(-17, -15);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (label !== undefined) {
    const [red, green, blue] = color.slice(1).match(/../g).map(component => {
      const value = parseInt(component, 16) / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    const luminance = .2126 * red + .7152 * green + .0722 * blue;
    ctx.fillStyle = (luminance + .05) / .05 >= 1.05 / (luminance + .05) ? '#000000' : '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, -9, 28);
  }
  ctx.restore();
}

function drawWeapon(x, y, type, label) {
  const weapon = WEAPONS[type];
  if (weapon.hammer) drawHammer(x, y, weapon.color, label);
  else drawSword(x, y, weapon.color, label);
}

function drawAttackPop(attack, age) {
  const progress = Math.min(1, age / .55);
  const scale = .55 + progress * .65;
  ctx.save(); ctx.translate(attack.x, attack.y - progress * 18);
  ctx.rotate(-.16 + progress * .32); ctx.scale(scale, scale);
  ctx.globalAlpha = 1 - progress;
  ctx.beginPath();
  for (let point = 0; point < 24; point++) {
    const angle = point / 24 * Math.PI * 2 - Math.PI / 2;
    const radius = point % 2 ? 19 : 29;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (point) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffe45c'; ctx.strokeStyle = '#a8322b'; ctx.lineWidth = 4;
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#fff6bd'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.font = 'bold 17px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.strokeStyle = '#fff8df'; ctx.strokeText('POW!', 0, 1);
  ctx.fillStyle = '#8f251e'; ctx.fillText('POW!', 0, 1);
  ctx.restore();
}

function drawGameItem(item) {
  ctx.save(); ctx.translate(item.x, item.y);
  if (item.type === 'cat-block') {
    drawCatBlockArt(0, 0, 50);
  } else if (item.type === 'key') {
    drawKey();
  } else if (item.type === 'treasure-chest') {
    const required = item.keysRequired ?? 1;
    drawTreasureChest();
    ctx.fillStyle = '#fff8e6'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = '#442a1d'; ctx.lineWidth = 2; ctx.strokeText(String(required), 0, 28);
    ctx.fillText(String(required), 0, 28);
  } else if (ITEMS[item.type]?.brush) {
    drawPaintbrush(ctx, ITEMS[item.type]);
  } else if (ITEMS[item.type]?.catShield) {
    drawCatShield(0, 0, ITEMS[item.type].color, .7);
  } else if (item.type === 'smiley-cookie') {
    ctx.fillStyle = '#c78d50'; ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff8ec'; ctx.beginPath(); ctx.arc(0, 0, 15.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c84a54';
    for (const eye of [-5, 5]) { ctx.beginPath(); ctx.arc(eye, -4, 1.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = '#c84a54'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, -1, 8, .2, Math.PI - .2); ctx.stroke();
  } else if (item.type.startsWith('boom-time-')) {
    const boomTime = ITEMS[item.type];
    ctx.fillStyle = boomTime.color; ctx.strokeStyle = '#17212a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 1, 19, 19, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-5, -21, 10, 7, 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#17212a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.quadraticCurveTo(-8, -23, -5, -29); ctx.stroke();
    ctx.strokeStyle = '#e0a04c'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ff7928'; ctx.beginPath();
    ctx.moveTo(-5, -28); ctx.quadraticCurveTo(-11, -34, -4, -39);
    ctx.quadraticCurveTo(-3, -34, 1, -35); ctx.quadraticCurveTo(3, -29, -5, -28);
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#17212a'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.moveTo(-4, -30);
    ctx.quadraticCurveTo(-7, -34, -4, -36); ctx.quadraticCurveTo(-3, -33, -1, -32);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff7df'; ctx.beginPath(); ctx.arc(0, 1, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#17212a'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = '#17212a'; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -7); ctx.moveTo(0, 0); ctx.lineTo(6, -2); ctx.stroke();
    ctx.fillStyle = '#111820'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`+${boomTime.counts}`, 0, 10);
  } else if (['stopwatch', 'stopwatch-green', 'stopwatch-blue'].includes(item.type)) {
    const stopwatch = ITEMS[item.type];
    ctx.fillStyle = stopwatch.color; ctx.beginPath(); ctx.roundRect(-5, -25, 10, 7, 2); ctx.fill();
    ctx.fillRect(-15, -20, 7, 5); ctx.fillRect(8, -20, 7, 5);
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff7df'; ctx.beginPath(); ctx.arc(0, 0, 14.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#433b36'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -9); ctx.moveTo(0, 0); ctx.lineTo(6, 3); ctx.stroke();
    ctx.fillStyle = stopwatch.color; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`+${stopwatch.seconds}s`, 0, 9);
  } else if (item.type === 'battery') {
    const yellow = ctx.createLinearGradient(-11, 0, 11, 0);
    yellow.addColorStop(0, '#927317'); yellow.addColorStop(.3, '#ffe66b');
    yellow.addColorStop(.6, '#e6c52d'); yellow.addColorStop(1, '#806112');
    const dark = ctx.createLinearGradient(-11, 0, 11, 0);
    dark.addColorStop(0, '#101216'); dark.addColorStop(.3, '#50545b');
    dark.addColorStop(.6, '#272a30'); dark.addColorStop(1, '#080a0d');
    ctx.save(); ctx.beginPath(); ctx.roundRect(-11, -18, 22, 36, 4); ctx.clip();
    ctx.fillStyle = yellow; ctx.fillRect(-11, -18, 22, 12);
    ctx.fillStyle = dark; ctx.fillRect(-11, -6, 22, 24);
    ctx.restore();
    ctx.strokeStyle = '#25282d'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-11, -18, 22, 36, 4); ctx.stroke();
    ctx.fillStyle = '#a6abb2'; ctx.strokeStyle = '#555b63'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -18, 10, 2.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const terminal = ctx.createLinearGradient(-5, 0, 5, 0);
    terminal.addColorStop(0, '#737982'); terminal.addColorStop(.35, '#e1e4e8'); terminal.addColorStop(1, '#858b94');
    ctx.fillStyle = terminal; ctx.beginPath(); ctx.roundRect(-5, -23, 10, 5, 1.5); ctx.fill(); ctx.stroke();
  } else if (item.type === 'saw-blade') {
    const metal = ctx.createLinearGradient(-20, -20, 20, 20);
    metal.addColorStop(0, '#687784'); metal.addColorStop(.35, '#eef3f6');
    metal.addColorStop(.6, '#b1bec8'); metal.addColorStop(1, '#566470');
    traceSawBlade(ctx, 16);
    ctx.fillStyle = metal; ctx.strokeStyle = '#46515b'; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#273941'; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#7c8c99'; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke();
  } else if (item.type === 'magic-sunglasses') {
    drawMagicSunglasses(game?.elapsed ?? 0);
  } else if (item.type === 'kitty-cape') {
    drawKittyCape(game?.elapsed ?? 0);
  } else if (item.type === 'ditto-stamp') {
    drawDittoStamp();
  } else if (item.type === 'spooky-mask') {
    drawSpookyMask();
  } else if (item.type === 'music-box') {
    ctx.fillStyle = '#613951'; ctx.strokeStyle = '#40283c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-19, -9, 38, 29, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#955779'; ctx.beginPath();
    ctx.moveTo(11, -7); ctx.lineTo(18, -11); ctx.lineTo(18, 15); ctx.lineTo(11, 19); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d989b8'; ctx.fillRect(-16, -6, 27, 24);
    ctx.fillStyle = '#e9a9cc'; ctx.beginPath();
    ctx.moveTo(-16, -6); ctx.lineTo(-9, -11); ctx.lineTo(18, -11); ctx.lineTo(11, -6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#633c55'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(19, 2); ctx.lineTo(26, 2); ctx.stroke();
    ctx.fillStyle = '#edc7dc'; ctx.beginPath(); ctx.arc(27, 2, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff0b0'; ctx.strokeStyle = '#603452'; ctx.lineWidth = 1;
    ctx.font = 'bold 23px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText('♪', -2, 6); ctx.fillText('♪', -2, 6);
  } else if (item.type === 'eggplant') {
    ctx.fillStyle = '#40814c'; ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(-13, -19); ctx.lineTo(-2, -16); ctx.lineTo(3, -23); ctx.lineTo(5, -15); ctx.lineTo(14, -17); ctx.lineTo(8, -9); ctx.closePath(); ctx.fill();
    const skin = ctx.createLinearGradient(-16, -8, 17, 13);
    skin.addColorStop(0, '#b993d1'); skin.addColorStop(.3, '#8956aa');
    skin.addColorStop(.65, '#653582'); skin.addColorStop(1, '#321b48');
    ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(-5, -14); ctx.bezierCurveTo(12, -22, 22, -7, 13, 8); ctx.bezierCurveTo(4, 24, -18, 17, -17, 3); ctx.bezierCurveTo(-17, -5, -12, -11, -5, -14); ctx.fill();
    ctx.strokeStyle = '#d6b7e5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, -7); ctx.quadraticCurveTo(-15, 2, -9, 8); ctx.stroke();
    ctx.fillStyle = '#316039'; ctx.beginPath(); ctx.moveTo(-5, -14); ctx.lineTo(5, -16); ctx.lineTo(10, -11); ctx.lineTo(2, -12); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawKey() {
  ctx.save();
  ctx.strokeStyle = '#a86b00'; ctx.fillStyle = '#ffdf00'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-2, -3); ctx.lineTo(5, -3); ctx.lineTo(5, 6);
  ctx.lineTo(13, 6); ctx.lineTo(13, 12); ctx.lineTo(5, 12);
  ctx.lineTo(5, 19); ctx.lineTo(-2, 19); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(1.5, -10, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#fff59a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(1.5, -10, 5, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawTreasureChest(opening = 0) {
  ctx.save();
  ctx.fillStyle = '#7b4727'; ctx.strokeStyle = '#442a1d'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-20, -8, 40, 23, 5); ctx.fill(); ctx.stroke();
  if (opening > 0) {
    ctx.fillStyle = '#2c1a13'; ctx.fillRect(-17, -7, 34, 8);
  }
  ctx.save(); ctx.translate(-20, -8); ctx.rotate(-opening * Math.PI / 3);
  ctx.fillStyle = '#d59b43'; ctx.beginPath(); ctx.roundRect(0, -5, 40, 12, 4); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#f6d46f'; ctx.fillRect(-3, -6, 6, 12);
  ctx.restore();
}

function drawCatBlockArt(x, y, size) {
  const image = globalThis.koshiCatBlockArt;
  if (image?.complete && image.naturalWidth) {
    ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
  } else {
    ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🐱', x, y);
  }
}

function drawCatBlockBadge(x, y, size) {
  ctx.save();
  drawCatBlockArt(x, y, size);
  ctx.restore();
}

function drawKittyCape(time) {
  ctx.save();
  const sway = Math.sin(time * 8) * 2;
  const fabric = ctx.createLinearGradient(-18, -18, 20, 22);
  fabric.addColorStop(0, '#b5d77c'); fabric.addColorStop(1, '#45634d');
  ctx.fillStyle = fabric; ctx.strokeStyle = '#273d37'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-10, -18); ctx.quadraticCurveTo(0, -12, 10, -18);
  ctx.lineTo(23 + sway, 20); ctx.quadraticCurveTo(10, 15, sway, 22);
  ctx.quadraticCurveTo(-10, 15, -23 + sway, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10, -18); ctx.quadraticCurveTo(0, -28, 10, -18); ctx.stroke();
  ctx.strokeStyle = '#d3ef8b80';
  ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(-13 + sway, 12);
  ctx.moveTo(6, -10); ctx.lineTo(13 + sway, 12); ctx.stroke();
  ctx.fillStyle = '#ead182'; ctx.beginPath(); ctx.arc(0, -15, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawWornCape(game, x, y) {
  if (!game.capePickup) return;
  ctx.save(); ctx.translate(x, y + 19);
  drawKittyCape(game.capePickup.age);
  ctx.restore();
}

function ribbonTransform(game, progress, across) {
  const length = Math.max(game.width, game.height);
  if (game.height > game.width) {
    ctx.translate(across, 0); ctx.rotate(Math.PI / 2);
    ctx.translate(-progress * (length + 36), 0);
  } else ctx.translate(-progress * (length + 36), across);
  return length;
}

function drawCapeStream(game, y = Math.min(game.width, game.height) / 2) {
  const elapsed = ['won', 'lost'].includes(game.state)
    ? game.capeStart + (game.capePickup?.age ?? (game.capeUntil - game.capeStart)) : game.elapsed;
  if (game.capeStart === null || elapsed >= game.capeUntil - 1e-9) return;
  const duration = game.capeUntil - game.capeStart;
  if (duration <= 0) return;
  const progress = Math.max(0, Math.min(1, (elapsed - game.capeStart) / duration));
  ctx.save(); ctx.globalAlpha = .25;
  const length = ribbonTransform(game, progress, y);
  ctx.strokeStyle = '#b5d77c'; ctx.fillStyle = '#eadd87'; ctx.lineWidth = 1.4;
  ctx.strokeRect(-18, -26, length + 36, 52);
  for (let index = 0, x = 20; x < length + 20; index++, x += 48) {
    ctx.save(); ctx.translate(x, 0);
    if (index % 2 === 0) {
      ctx.beginPath(); ctx.moveTo(-11, -4); ctx.lineTo(-12, -17); ctx.lineTo(-3, -10);
      ctx.lineTo(3, -10); ctx.lineTo(12, -17); ctx.lineTo(11, -4);
      ctx.arc(0, 0, 12, -.35, Math.PI + .35); ctx.closePath(); ctx.stroke();
      for (const eye of [-5, 5]) {
        ctx.beginPath(); ctx.arc(eye, -2, 1.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(-5, 3); ctx.quadraticCurveTo(0, 10, 5, 3); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(3, -19); ctx.lineTo(-10, 2); ctx.lineTo(-1, 2);
      ctx.lineTo(-5, 19); ctx.lineTo(11, -5); ctx.lineTo(2, -5);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawMagicSunglasses(time, sparkles = true) {
  ctx.save();
  ctx.fillStyle = '#152530'; ctx.strokeStyle = `hsl(${time * 140 % 360}, 85%, 70%)`; ctx.lineWidth = 3;
  for (const sign of [-1, 1]) {
    ctx.beginPath(); ctx.roundRect(sign < 0 ? -22 : 3, -7, 19, 13, [3, 3, 7, 7]); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ffffff80'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sign * 8, -4); ctx.lineTo(sign * 15, 1); ctx.stroke();
    ctx.strokeStyle = `hsl(${time * 140 % 360}, 85%, 70%)`; ctx.lineWidth = 3;
  }
  ctx.beginPath(); ctx.moveTo(-3, -3); ctx.quadraticCurveTo(0, -6, 3, -3);
  ctx.moveTo(-22, -5); ctx.lineTo(-26, -9); ctx.moveTo(22, -5); ctx.lineTo(26, -9); ctx.stroke();
  if (sparkles) {
    ctx.fillStyle = '#fff4c5';
    for (let i = 0; i < 5; i++) {
      const phase = (time * 1.4 + i / 5) % 1;
      const size = Math.sin(phase * Math.PI) * 3;
      const x = Math.cos(i * 2.4) * 29, y = Math.sin(i * 2.4) * 16;
      ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size, y);
      ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

function drawSunglassesStream(game, y = Math.min(game.width, game.height) / 2) {
  const elapsed = ['won', 'lost'].includes(game.state)
    ? game.sunglassesStart + (game.sunglassesPickup?.age ?? (game.sunglassesUntil - game.sunglassesStart)) : game.elapsed;
  if (game.sunglassesStart === null || elapsed >= game.sunglassesUntil) return;
  const duration = game.sunglassesUntil - game.sunglassesStart;
  if (duration <= 0) return;
  const progress = Math.max(0, Math.min(1, (elapsed - game.sunglassesStart) / duration));
  ctx.save(); ctx.globalAlpha = .25;
  const length = ribbonTransform(game, progress, y);
  ctx.strokeStyle = `hsl(${game.elapsed * 70 % 360}, 80%, 80%)`;
  ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.4;
  ctx.strokeRect(-18, -26, length + 36, 52);
  for (let index = 0, x = 20; x < length + 20; index++, x += 48) {
    ctx.save(); ctx.translate(x, 0);
    if (index % 2 === 0) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? 5 : 12;
        if (i === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-11, -4); ctx.lineTo(-12, -17); ctx.lineTo(-3, -10);
      ctx.lineTo(3, -10); ctx.lineTo(12, -17); ctx.lineTo(11, -4);
      ctx.arc(0, 0, 12, -.35, Math.PI + .35); ctx.closePath(); ctx.stroke();
      for (const eye of [-5, 5]) {
        ctx.beginPath(); ctx.arc(eye, -2, 1.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(-5, 3); ctx.quadraticCurveTo(0, 10, 5, 3); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawMaskStream(game, y = Math.min(game.width, game.height) / 2) {
  if (!game.maskPickup) return;
  const duration = 10;
  const age = ['won', 'lost'].includes(game.state) ? game.maskPickup.age : game.elapsed - (game.maskUntil - duration);
  if (age >= duration - 1e-9) return;
  const progress = Math.max(0, Math.min(1, age / duration));
  ctx.save(); ctx.globalAlpha = .25;
  const length = ribbonTransform(game, progress, y);
  ctx.strokeStyle = '#f3b5c5'; ctx.fillStyle = '#f3b5c5'; ctx.lineWidth = 1.4;
  ctx.strokeRect(-18, -26, length + 36, 52);
  for (let index = 0, x = 20; x < length + 20; index++, x += 48) {
    ctx.save(); ctx.translate(x, 0);
    ctx.beginPath();
    if (index % 2 === 0) {
      ctx.moveTo(-12, 17); ctx.lineTo(-12, -3);
      ctx.arc(0, -3, 12, Math.PI, 0); ctx.lineTo(12, 17);
      ctx.lineTo(6, 12); ctx.lineTo(0, 17); ctx.lineTo(-6, 12); ctx.closePath(); ctx.stroke();
      for (const eye of [-4, 4]) {
        ctx.beginPath(); ctx.ellipse(eye, -3, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.ellipse(0, 7, 3, 4, 0, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.moveTo(-11, -5); ctx.lineTo(-14, -20); ctx.lineTo(-4, -12);
      ctx.quadraticCurveTo(0, -15, 4, -12); ctx.lineTo(14, -20); ctx.lineTo(11, -5);
      ctx.quadraticCurveTo(15, 11, 0, 19); ctx.quadraticCurveTo(-15, 11, -11, -5);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(-3, -1);
      ctx.moveTo(9, -4); ctx.lineTo(3, -1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(-4, 12); ctx.lineTo(0, 7);
      ctx.lineTo(4, 12); ctx.lineTo(8, 6); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawSnailStream(game, y = Math.min(game.width, game.height) / 2) {
  const ended = ['won', 'lost'].includes(game.state);
  if (game.snailStreamStart === null) return;
  const duration = game.snailStreamUntil - game.snailStreamStart;
  if (duration <= 0) return;
  const elapsed = ended ? game.snailStreamStart + game.snailStreamAge : game.elapsed;
  if (elapsed >= game.snailStreamUntil - 1e-9) return;
  const progress = Math.max(0, Math.min(1, (elapsed - game.snailStreamStart) / duration));
  ctx.save(); ctx.globalAlpha = .25;
  const length = ribbonTransform(game, progress, y);
  ctx.strokeStyle = '#b7d88e'; ctx.fillStyle = '#b7d88e'; ctx.lineWidth = 1.5;
  ctx.strokeRect(-18, -26, length + 36, 52);
  for (let index = 0, x = 20; x < length + 20; index++, x += 48) {
    ctx.save(); ctx.translate(x, 0);
    if (index % 2 === 0) {
      ctx.beginPath(); ctx.ellipse(0, 7, 15, 5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, 6); ctx.lineTo(-8, -8); ctx.lineTo(-3, -3);
      ctx.moveTo(-4, 6); ctx.lineTo(-2, -10); ctx.lineTo(3, -4); ctx.stroke();
      ctx.fillRect(-10, -9, 2, 2); ctx.fillRect(-3, -11, 2, 2);
    } else {
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
      ctx.moveTo(-9, -5); ctx.lineTo(-15, -12); ctx.moveTo(9, -5); ctx.lineTo(15, -12);
      ctx.moveTo(-9, 5); ctx.lineTo(-15, 12); ctx.moveTo(9, 5); ctx.lineTo(15, 12);
      ctx.moveTo(12, 1); ctx.lineTo(18, 1); ctx.stroke();
      ctx.beginPath(); ctx.arc(19, -1, 1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawMusicStream(game, y = Math.min(game.width, game.height) / 2) {
  const elapsed = ['won', 'lost'].includes(game.state)
    ? game.musicStreamStart + (game.musicPickup?.age ?? (game.musicStreamUntil - game.musicStreamStart)) : game.elapsed;
  if (game.musicStreamStart === null || elapsed >= game.musicStreamUntil - 1e-9) return;
  const duration = game.musicStreamUntil - game.musicStreamStart;
  if (duration <= 0) return;
  const progress = Math.max(0, Math.min(1, (elapsed - game.musicStreamStart) / duration));
  ctx.save();
  ctx.globalAlpha = .25;
  const length = ribbonTransform(game, progress, y);
  ctx.strokeStyle = '#e6e3ff';
  ctx.fillStyle = '#e6e3ff';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(-18, -26, length + 36, 52);
  for (let lineIndex = -2; lineIndex <= 2; lineIndex++) {
    const y = lineIndex * 7;
    ctx.beginPath(); ctx.moveTo(-18, y); ctx.lineTo(length + 18, y); ctx.stroke();
  }
  const rhythm = ['whole', 'half', 'quarter', 'eighth', 'restWhole', 'restHalf', 'restQuarter',
    'restEighth', 'measure', 'eighthPair', 'quarter', 'half', 'restQuarter', 'eighth'];
  for (let index = 0, x = 20; x < length + 20; index++, x += 48) {
    const y = [-5, 2, -2, 5, 0, -4, 4, -1][index % 8];
    const symbol = rhythm[index % rhythm.length];
    if (symbol === 'measure') {
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(x, -19); ctx.lineTo(x, 19); ctx.stroke();
      ctx.lineWidth = 1.4;
    } else if (symbol.startsWith('rest')) {
      ctx.beginPath();
      if (symbol === 'restWhole') ctx.rect(x - 5, -8, 10, 4);
      else if (symbol === 'restHalf') ctx.rect(x - 5, 4, 10, 4);
      else if (symbol === 'restQuarter') {
        ctx.moveTo(x + 2, y - 10); ctx.lineTo(x - 2, y - 3); ctx.lineTo(x + 3, y + 1);
        ctx.lineTo(x - 2, y + 8); ctx.lineTo(x + 1, y + 12);
      } else {
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.moveTo(x - 4, y - 3); ctx.lineTo(x + 4, y + 3);
      }
      if (symbol !== 'restWhole' && symbol !== 'restHalf') ctx.stroke();
      else ctx.fill();
    } else {
      const whole = symbol === 'whole', filled = !['whole', 'half'].includes(symbol);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-.25);
      ctx.beginPath(); ctx.ellipse(0, 0, 5.2, 3.5, 0, 0, Math.PI * 2);
      if (filled) ctx.fill(); else ctx.stroke();
      if (!whole) {
        ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(4, -19); ctx.stroke();
        if (symbol === 'eighth') {
          ctx.beginPath(); ctx.moveTo(4, -19); ctx.quadraticCurveTo(13, -16, 9, -10); ctx.stroke();
        }
      }
      ctx.restore();
      if (symbol === 'eighthPair') {
        ctx.beginPath(); ctx.ellipse(x + 10, y, 5.2, 3.5, -.25, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 14, y); ctx.lineTo(x + 14, y - 19);
        ctx.moveTo(x + 4, y - 19); ctx.lineTo(x + 14, y - 19);
        ctx.moveTo(x + 4, y - 15); ctx.lineTo(x + 14, y - 15); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawScaredFace() {
  ctx.save(); ctx.strokeStyle = '#26323b'; ctx.lineWidth = 1.5;
  for (const x of [-8, 8]) {
    ctx.fillStyle = '#fff8d9'; ctx.beginPath(); ctx.ellipse(x, -3, 5, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#26323b'; ctx.beginPath(); ctx.ellipse(x, -2, 1.4, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 4, -11); ctx.quadraticCurveTo(x, -15, x + 4, -11); ctx.stroke();
  }
  ctx.fillStyle = '#26323b'; ctx.beginPath(); ctx.ellipse(0, 11, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e89da0'; ctx.beginPath(); ctx.ellipse(0, 14, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const fearSweatDrops = new WeakMap();

function drawFearSweat(enemy) {
  const cycle = Math.floor(enemy.age * 2);
  const progress = (enemy.age * 2 - cycle) / .8;
  if (progress >= 1) return;
  let drop = fearSweatDrops.get(enemy);
  if (!drop || drop.cycle !== cycle) {
    drop = { cycle, direction: Math.random() * Math.PI * 2 };
    fearSweatDrops.set(enemy, drop);
  }
  ctx.save(); ctx.translate(enemy.x, enemy.y);
  const direction = drop.direction;
  const distance = (enemy.radius ?? 19) + 3 + progress * 24;
  ctx.translate(Math.cos(direction) * distance, Math.sin(direction) * distance);
  ctx.rotate(direction + Math.PI / 2); ctx.globalAlpha *= 1 - progress;
  ctx.fillStyle = '#8edcff'; ctx.strokeStyle = '#367eaa'; ctx.lineWidth = .5;
  ctx.beginPath(); ctx.moveTo(0, -2.5);
  ctx.bezierCurveTo(-2.5, 0, -2, 2.5, 0, 2.5); ctx.bezierCurveTo(2, 2.5, 2.5, 0, 0, -2.5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function snakeSegmentsForDrawing(enemy) {
  if (Array.isArray(enemy.segments) && enemy.segments.length) return enemy.segments;
  if (game?.robots?.includes(enemy) && typeof game.snakeSegments === 'function') {
    const segments = game.snakeSegments(enemy);
    if (Array.isArray(segments) && segments.length) return segments;
  }
  return Array.from({ length: 4 }, (_, index) => ({
    x: enemy.x - index * 38, y: enemy.y, radius: 19, angle: 0, index,
  }));
}

function drawSnakeSpikes(radius) {
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const inner = radius - 3, outer = radius + 9;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle - .25) * inner, Math.sin(angle - .25) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.lineTo(Math.cos(angle + .25) * inner, Math.sin(angle + .25) * inner);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

function drawSnakeTongue(x, y, angle, length = 13, spin = 0, alpha = 1, travel = 0) {
  ctx.save(); ctx.translate(x + Math.cos(angle) * travel, y + Math.sin(angle) * travel);
  ctx.rotate(angle + spin); ctx.globalAlpha *= alpha;
  ctx.strokeStyle = '#e83d49'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(11 + length, 0);
  ctx.moveTo(11 + length, 0); ctx.lineTo(15 + length, -4);
  ctx.moveTo(11 + length, 0); ctx.lineTo(15 + length, 4); ctx.stroke();
  ctx.restore();
}

function drawSnakeSegment(segment, enemy, deathProgress, damageColor) {
  const radius = segment.radius ?? 19;
  let x = segment.x, y = segment.y, spin = 0, scale = 1, alpha = 1;
  if (deathProgress !== null) {
    const index = segment.index ?? 0;
    const angle = (segment.angle ?? 0) + index * 2.27 + .65;
    x += Math.cos(angle) * deathProgress * 27;
    y += Math.sin(angle) * deathProgress * 24 + deathProgress * deathProgress * 48;
    spin = deathProgress * (index % 2 ? -4 : 4);
    scale = Math.max(.05, 1 - deathProgress * .55);
    alpha = Math.max(0, 1 - deathProgress * .92);
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate((segment.angle ?? 0) + spin);
  ctx.globalAlpha *= alpha; ctx.scale(scale, scale);
  if (segment.index !== 0) drawSnakeSpikes(radius);
  ctx.fillStyle = damageColor ?? '#9ba6ac'; ctx.strokeStyle = '#303d46'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = damageColor ? '#ffd4d6' : '#c7ced1';
  ctx.beginPath(); ctx.arc(0, 0, radius - 4, -.95, .95); ctx.strokeStyle = '#697780'; ctx.lineWidth = 1.4; ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#59666f';
    ctx.beginPath(); ctx.moveTo(-11, side * 9); ctx.lineTo(11, side * 9);
    ctx.lineTo(7, side * 14); ctx.lineTo(-7, side * 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#bd3944';
    ctx.fillRect(-7, side < 0 ? -13 : 10, 14, 3);
  }
  if (segment.index === 0) {
    ctx.fillStyle = damageColor ?? '#9ba6ac';
    ctx.beginPath(); ctx.moveTo(-2, -15); ctx.quadraticCurveTo(9, -19, 17, -10);
    ctx.lineTo(17, 10); ctx.quadraticCurveTo(8, 18, -2, 15); ctx.closePath(); ctx.fill(); ctx.stroke();
    const scared = enemy.afraid && deathProgress === null;
    for (const eyeY of [-7, 7]) {
      ctx.fillStyle = scared ? '#fff8d9' : deathProgress === null ? '#f4d447' : '#657078';
      ctx.strokeStyle = '#202b32'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(7, eyeY, 4.5, scared ? 4.5 : 3.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#202b32';
      ctx.beginPath(); ctx.ellipse(8, eyeY + (scared ? -1 : 0), scared ? 1.4 : 1, scared ? 2 : 2.4, 0, 0, Math.PI * 2); ctx.fill();
      if (scared) {
        ctx.beginPath(); ctx.moveTo(3, eyeY - 5); ctx.quadraticCurveTo(7, eyeY - 8, 11, eyeY - 5); ctx.stroke();
      }
    }
  } else if (segment.index === 1) {
    ctx.fillStyle = '#66737b';
    ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(3, -9); ctx.lineTo(3, -3);
    ctx.lineTo(9, -3); ctx.lineTo(9, 3); ctx.lineTo(3, 3); ctx.lineTo(3, 9);
    ctx.lineTo(-3, 9); ctx.lineTo(-3, 3); ctx.lineTo(-9, 3); ctx.lineTo(-9, -3);
    ctx.lineTo(-3, -3); ctx.closePath(); ctx.fill();
  } else if (segment.index === 2) {
    ctx.fillStyle = '#343e45'; ctx.strokeStyle = '#d1d6d7'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(-8.5, 0, 5.5, 2.5, -.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(8.5, 0, 5.5, 2.5, -.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    for (const x of [-7, 7]) {
      ctx.fillStyle = '#d82f3d'; ctx.strokeStyle = '#79202a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawSnakeRobot(enemy, deathProgress = null, damageColor = null) {
  const segments = [...snakeSegmentsForDrawing(enemy)].sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
  const head = segments.find(segment => segment.index === 0) ?? segments[segments.length - 1];
  if (!head) return;
  if (deathProgress !== null) {
    if (deathProgress > .06) {
      const progress = Math.max(0, Math.min(1, (deathProgress - .06) / .86));
      drawSnakeTongue(head.x, head.y, head.angle ?? 0, 15 + progress * 18,
        progress * 12, 1 - progress, progress * 50);
    }
  } else if (!enemy.afraid && !enemy.asleep && enemy.age % 2.2 > 1.82) {
    const flick = (enemy.age % 2.2 - 1.82) / .38;
    drawSnakeTongue(head.x, head.y, head.angle ?? 0, 7 + Math.sin(flick * Math.PI) * 7);
  }
  for (const segment of segments) drawSnakeSegment(segment, enemy, deathProgress, damageColor);
}

function drawRobot(enemy, deathProgress = null, damageProgress = null) {
  ctx.save();
  const damageColor = damageProgress === null ? null : Math.floor(damageProgress * 4) % 2 === 0 ? '#dc626b' : '#f2a0a5';
  drawRobotBody(enemy, deathProgress, damageColor);
  if (enemy.afraid && enemy.fleeMoving && !enemy.asleep && deathProgress === null) drawFearSweat(enemy);
  if (enemy.shield && deathProgress === null) {
    ctx.strokeStyle = SHIELDS[enemy.shield].color;
    ctx.lineWidth = 3;
    ctx.globalAlpha *= .8;
    ctx.beginPath(); ctx.arc(enemy.x, enemy.y, (enemy.radius ?? 19) + 9, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawRoboKoshi(enemy, deathProgress = null, damageColor = null) {
  const progress = deathProgress ?? 0;
  ctx.save();
  if (deathProgress !== null) {
    ctx.globalAlpha *= Math.max(0, 1 - progress);
    ctx.translate(progress * 12, progress * progress * 18);
    ctx.rotate(progress * 1.4);
    ctx.scale(Math.max(.01, 1 - progress * .65), Math.max(.01, 1 - progress * .8));
  }
  ctx.fillStyle = damageColor ?? '#454d52'; ctx.strokeStyle = '#b3bec3'; ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * 7, -13); ctx.lineTo(side * 22, -30);
    ctx.lineTo(side * 19, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#aab4b9'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -31); ctx.stroke();
  ctx.fillStyle = '#69747a'; ctx.fillRect(-4, -34, 8, 4);
  ctx.fillStyle = deathProgress !== null && progress > .6 ? '#733b3e' : '#f02f39';
  ctx.shadowColor = '#ff1d2b'; ctx.shadowBlur = deathProgress === null ? 8 : 0;
  for (const x of [-10, 10]) ctx.fillRect(x - 3.5, -6, 7, 7);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#aab4b9';
  ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(5, 5); ctx.lineTo(0, 9); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#242a2d'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-7, 12); ctx.lineTo(7, 12); ctx.stroke();
  ctx.restore();
}

function drawSnailShell() {
  ctx.beginPath();
  ctx.moveTo(-19, -15); ctx.lineTo(-9, -27); ctx.lineTo(11, -27);
  ctx.lineTo(21, -14); ctx.lineTo(21, 10); ctx.lineTo(9, 22);
  ctx.lineTo(-8, 22); ctx.lineTo(-19, 10);
  ctx.closePath();
  ctx.fillStyle = '#777f80'; ctx.strokeStyle = '#303d3f'; ctx.lineWidth = 2;
  ctx.fill(); ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#826345';
  ctx.fillRect(-19, -27, 8, 49);
  ctx.fillStyle = '#a17a4c';
  ctx.fillRect(-11, -27, 32, 5);
  ctx.restore();
  ctx.strokeStyle = '#394446'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-13, 11); ctx.lineTo(-13, -8); ctx.lineTo(-7, -17);
  ctx.lineTo(4, -17); ctx.lineTo(13, -8); ctx.lineTo(13, 6);
  ctx.lineTo(4, 16); ctx.lineTo(-5, 16); ctx.lineTo(-10, 11);
  ctx.moveTo(-5, 16); ctx.lineTo(0, 8); ctx.lineTo(5, 1);
  ctx.lineTo(5, -5); ctx.lineTo(1, -8); ctx.lineTo(-3, -5);
  ctx.lineTo(-3, 1); ctx.lineTo(0, 4); ctx.stroke();
}

function drawRoboSnail(enemy, deathProgress = null, damageColor = null) {
  const progress = deathProgress ?? 0;
  const age = enemy.age ?? 0;
  const mouthOpen = deathProgress === null ? .15 + .85 * (Math.sin(age * 5) + 1) / 2 : 1;
  if (deathProgress === null || progress < .52) {
    ctx.save(); ctx.translate(8, 2); drawSnailShell(); ctx.restore();
  } else {
    const split = Math.min(1, (progress - .52) / .48);
    ctx.save(); ctx.globalAlpha *= 1 - split;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(8 + side * split * 14, 2 + split * 3);
      ctx.rotate(side * split * .32);
      ctx.beginPath();
      ctx.rect(side < 0 ? -30 : 0, -30, 30, 60);
      ctx.clip();
      drawSnailShell();
      ctx.restore();
    }
    ctx.restore();
  }
  const retreat = deathProgress === null ? 0 : Math.max(0, Math.min(1, (progress - .24) / .28));
  if (retreat < 1) {
    ctx.save();
    ctx.translate(retreat * 7, -retreat * 3);
    ctx.scale(Math.max(.01, 1 - retreat), Math.max(.01, 1 - retreat));
    ctx.globalAlpha *= 1 - retreat;
    ctx.fillStyle = damageColor ?? '#79c96c'; ctx.strokeStyle = '#355a43'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-27, 23); ctx.lineTo(-27, 4);
    ctx.quadraticCurveTo(-27, -5, -17, -5); ctx.quadraticCurveTo(-6, -5, -6, 5);
    ctx.lineTo(-6, 20); ctx.lineTo(19, 20); ctx.lineTo(13, 24);
    ctx.lineTo(-27, 24); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(-17, 12); ctx.scale(1, mouthOpen); ctx.translate(17, -12);
    ctx.fillStyle = '#26353d';
    ctx.beginPath(); ctx.moveTo(-22, 12); ctx.lineTo(-22, 9);
    ctx.bezierCurveTo(-22, 0, -12, 0, -12, 9);
    ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#edf2e8'; ctx.fillRect(-21, 8, 8, 4);
    ctx.strokeStyle = '#384044'; ctx.lineWidth = 1;
    ctx.strokeRect(-21, 8, 8, 4);
    ctx.beginPath(); ctx.moveTo(-18.5, 8); ctx.lineTo(-18.5, 12);
    ctx.moveTo(-15.5, 8); ctx.lineTo(-15.5, 12); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  const antennaScale = deathProgress === null ? 1 : Math.max(0, 1 - progress / .24);
  if (antennaScale > 0) {
    ctx.save(); ctx.translate(-17, -4); ctx.scale(antennaScale, antennaScale);
    ctx.fillStyle = damageColor ?? '#79c96c'; ctx.strokeStyle = '#355a43'; ctx.lineWidth = 1.5;
    for (const x of [-6, 6]) {
      const bounce = deathProgress === null ? Math.sin(age * 6 + (x < 0 ? 0 : .8)) * 1.5 : 0;
      ctx.fillRect(x - 1.5, -14 + bounce, 3, 14 - bounce); ctx.strokeRect(x - 1.5, -14 + bounce, 3, 14 - bounce);
      ctx.save(); ctx.translate(0, bounce);
      ctx.beginPath(); ctx.ellipse(x, -15, 5.5, 2.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ed3139'; ctx.fillRect(x - 3.5, -16, 7, 2);
      ctx.strokeStyle = '#384044'; ctx.lineWidth = .7;
      ctx.strokeRect(x - 3.5, -16, 7, 2);
      ctx.beginPath(); ctx.moveTo(x - 1, -16); ctx.lineTo(x - 1, -14);
      ctx.moveTo(x + 1, -16); ctx.lineTo(x + 1, -14); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = damageColor ?? '#79c96c'; ctx.strokeStyle = '#355a43'; ctx.lineWidth = 1.5;
    }
    ctx.restore();
  }
}

function drawCowGrass(enemy) {
  if (enemy.type !== 'robo-cow' || !enemy.cowEating) return;
  const brick = game.bricks[game.perimeter[enemy.cowTargetIndex]];
  const owner = brick && game.bricks[brick.absorbedBy ?? brick.id];
  if (!owner || ['cinder', 'goal'].includes(owner.kind)) return;
  const progress = Math.max(0, Math.min(1, enemy.cowEatTime / COW_EAT_DURATION));
  if (progress >= 1) return;
  const edge = brickRegions(game.bricks, game.width, game.height).get(brick.id).edge;
  const horizontal = edge === 'top' || edge === 'bottom';
  const length = horizontal ? brick.w : brick.h, depth = 6;
  const [x, y, angle] = {
    top: [brick.x, brick.y + brick.h, 0],
    right: [brick.x, brick.y, Math.PI / 2],
    bottom: [brick.x + brick.w, brick.y, Math.PI],
    left: [brick.x + brick.w, brick.y + brick.h, -Math.PI / 2],
  }[edge];
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.globalAlpha *= Math.min(1, enemy.cowEatTime / .2);
  ctx.beginPath(); ctx.roundRect(0, 0, length, depth, 3); ctx.clip();
  ctx.beginPath(); ctx.rect(length * progress, 0, length * (1 - progress), depth); ctx.clip();
  ctx.fillStyle = '#34963b'; ctx.fillRect(0, 0, length, depth);
  ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  for (let row = 0; row < depth; row += 7) {
    for (let column = 3 + (row % 2) * 3; column < length; column += 9) {
      ctx.strokeStyle = (column + row) % 3 ? '#8bd34e' : '#226f32';
      ctx.beginPath();
      ctx.moveTo(column - 2, row + 2); ctx.lineTo(column, row + 6);
      ctx.lineTo(column + 2, row + 1);
      ctx.moveTo(column, row + 6); ctx.lineTo(column + 4, row + 3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRoboCow(enemy, deathProgress = null, damageColor = null) {
  const progress = deathProgress ?? 0, age = enemy.age ?? 0;
  const eatingBob = deathProgress === null && enemy.cowEating
    ? 5 + Math.sin(age * 11) * 2 : 0;
  ctx.save();
  ctx.rotate(enemy.facingAngle ?? 0);
  ctx.scale((enemy.afraid ? enemy.fleeDirection ?? 1 : enemy.cowDirection ?? 1) < 0 ? 1 : -1, 1);
  const collapse = deathProgress === null ? 0 : Math.max(0, (progress - .3) / .7);
  const bodyDrop = collapse * collapse * 48;
  const bodyAlpha = Math.max(0, 1 - collapse / .88);
  ctx.save(); ctx.translate(0, bodyDrop); ctx.globalAlpha *= bodyAlpha;
  ctx.fillStyle = damageColor ?? '#9451bd'; ctx.strokeStyle = '#382849'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(-1, 2, 24, 18, -.08, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#12151a';
  for (const [x, y, rx, ry] of [[-13, -5, 6, 5], [6, 7, 8, 6], [12, -9, 4, 3]]) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -.35, 0, Math.PI * 2); ctx.fill();
  }
  for (const [index, x] of [-16, 13].entries()) for (const side of [-1, 1]) {
    const legProgress = deathProgress === null ? 0 : Math.max(0, (progress - .32) / .48);
    const stride = deathProgress === null && !enemy.asleep && (!enemy.cowEating || enemy.afraid)
      ? Math.sin((enemy.distance ?? 0) / 12 + index * Math.PI) * side : 0;
    ctx.save();
    ctx.translate(x + side * legProgress * (21 + index * 5), 14 + legProgress * legProgress * 38 - Math.max(0, stride) * 3);
    ctx.rotate(side * legProgress * 4 + stride * .45);
    ctx.fillStyle = damageColor ?? '#673b8e'; ctx.strokeStyle = '#382849'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-4, -2, 8, 13, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#343039'; ctx.fillRect(-5, 8, 10, 5);
    ctx.restore();
  }
  ctx.restore();
  const headDetached = deathProgress !== null && progress > .02;
  const headFly = headDetached ? Math.min(1, (progress - .02) / .62) : 0;
  if (!headDetached || progress < .72) {
    ctx.save();
    if (headDetached) {
      ctx.translate(13 + headFly * 25, -13 - Math.sin(headFly * Math.PI) * 31 + headFly * headFly * 39);
      ctx.rotate(headFly * 5);
      ctx.globalAlpha *= Math.max(0, 1 - Math.max(0, progress - .5) / .35);
    } else ctx.translate(11, -11 + eatingBob);
    ctx.fillStyle = damageColor ?? '#a663cc'; ctx.strokeStyle = '#382849'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#723b94'; ctx.beginPath();
    ctx.ellipse(-10, -9, 5, 3, -.7, 0, Math.PI * 2); ctx.ellipse(9, -9, 5, 3, .7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8d8a2'; ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(-8, -18); ctx.lineTo(-1, -12);
    ctx.moveTo(5, -10); ctx.lineTo(9, -18); ctx.lineTo(10, -9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#16191d'; ctx.beginPath(); ctx.ellipse(0, 6, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dfa9bd'; ctx.beginPath(); ctx.ellipse(0, 4, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd92f'; ctx.strokeStyle = '#45381d'; ctx.lineWidth = 1.3;
    for (const x of [-5, 5]) {
      ctx.beginPath(); ctx.roundRect(x - 2.5, -6, 5, 7, 1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#352b1a'; ctx.fillRect(x - 1, -4, 2, 4); ctx.fillStyle = '#ffd92f';
    }
    ctx.restore();
  }
  if (deathProgress !== null && progress > .04 && progress < .82) {
    const pop = Math.min(1, (progress - .04) / .18);
    ctx.save(); ctx.translate(8, -10 - pop * 24); ctx.globalAlpha *= Math.min(1, (progress - .04) / .08);
    ctx.strokeStyle = '#d7e2e4'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const x = Math.sin(i * Math.PI / 2) * 4, y = i * 4;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

function drawRoboUnicorn(enemy, deathProgress = null, damageColor = null) {
  const progress = deathProgress ?? 0;
  const colors = ['#fa596f', '#ffad42', '#ffe65a', '#69d58e', '#53b9f1', '#a77bf0'];
  const drawHead = (dying = false) => {
    ctx.fillStyle = damageColor ?? (enemy.angry ? '#e64b58' : '#f5b5d3');
    ctx.strokeStyle = '#71364f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-20, 27);
    ctx.bezierCurveTo(-3, 15, -12, 4, -17, -7);
    ctx.bezierCurveTo(-27, -26, -8, -31, 8, -21);
    ctx.bezierCurveTo(16, -16, 15, -7, 24, 1);
    ctx.bezierCurveTo(35, 10, 25, 21, 17, 15);
    ctx.bezierCurveTo(11, 9, 8, 8, 4, 12);
    ctx.bezierCurveTo(2, 20, -8, 27, -20, 27);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = enemy.angry ? '#b9344c' : '#d875aa'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-18, 23); ctx.bezierCurveTo(0, 15, -8, 2, -10, -5); ctx.stroke();
    for (const [index, color] of colors.entries()) {
      const x = -29 + index * 4;
      ctx.fillStyle = color; ctx.strokeStyle = '#71364f'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(x + 7, -25 + index * .8);
      ctx.bezierCurveTo(x - 8, -22, x - 8, 6, x - 2, 23 - index * 1.5);
      ctx.lineTo(x + 3, 20 - index * 1.5);
      ctx.bezierCurveTo(x - 3, 3, x - 3, -20, x + 11, -23 + index * .8);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = damageColor ?? (enemy.angry ? '#e64b58' : '#f5b5d3');
    ctx.strokeStyle = '#71364f'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-9, -18); ctx.quadraticCurveTo(-18, -23, -10, -36);
    ctx.quadraticCurveTo(1, -28, -1, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d875aa'; ctx.beginPath(); ctx.moveTo(-9, -23); ctx.lineTo(-10, -31); ctx.lineTo(-5, -24); ctx.fill();
    if (!dying) {
      ctx.fillStyle = '#ffd92f'; ctx.strokeStyle = '#97631c'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(5, -21); ctx.lineTo(24, -40); ctx.lineTo(13, -16); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(11, -25); ctx.lineTo(16, -23); ctx.moveTo(15, -29); ctx.lineTo(19, -28); ctx.stroke();
    }
    ctx.fillStyle = '#ffd92f'; ctx.strokeStyle = '#71364f'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(1, -14); ctx.quadraticCurveTo(7, -19, 12, -12);
    ctx.quadraticCurveTo(7, -6, 2, -9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#45381d'; ctx.fillRect(6, -14, 2, 6);
    ctx.fillStyle = '#71364f'; ctx.beginPath(); ctx.ellipse(23, 3, 2, 1.5, .5, 0, Math.PI * 2); ctx.fill();
    const gape = !dying && enemy.resting ? Math.min(1, (enemy.unicornStateTime ?? 1) / .25) : 0;
    const open = !dying && (enemy.mouthOpen || gape > 0);
    const width = 7 + gape * 6;
    const height = open ? 8 + gape * 8 : 3.5;
    ctx.save(); ctx.translate(22 + gape * 3, 12 + gape * 5); ctx.rotate(-.35);
    ctx.fillStyle = '#535d66'; ctx.strokeStyle = '#384149'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, width, height, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (gape > 0) {
      ctx.fillStyle = '#2b3036';
      ctx.beginPath(); ctx.ellipse(0, 1, width * .7, height * .62, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#c4cdd5';
    const toothSpacing = 4 + gape * 2;
    for (const x of [-toothSpacing, 0, toothSpacing]) {
      ctx.fillRect(x - 1.5, open ? 2 - height : -2, 3, 3 + gape);
      if (open) ctx.fillRect(x - 1.5, height - 5 - gape, 3, 3 + gape);
    }
    ctx.restore();
  };
  const drawRainbow = (sweep = Math.PI) => {
    if (sweep <= .001) return;
    for (const [index, color] of colors.entries()) {
      ctx.strokeStyle = color; ctx.lineWidth = 5.2;
      ctx.beginPath(); ctx.arc(0, 9, 29 - index * 4.2, Math.PI, Math.PI + sweep); ctx.stroke();
    }
  };
  if (deathProgress !== null) {
    if (progress < .48) {
      ctx.save(); ctx.globalAlpha *= Math.max(0, 1 - progress / .48);
      ctx.rotate(enemy.facingAngle ?? enemy.phase ?? 0);
      drawHead(true);
      ctx.restore();
    }
    if (progress > .18) {
      const morph = Math.min(1, (progress - .18) / .35);
      const sweep = progress < .5 ? Math.PI : Math.PI * Math.max(0, 1 - (progress - .5) / .48);
      ctx.save(); ctx.translate(-2, 0);
      ctx.globalAlpha *= Math.min(1, morph * 1.6);
      drawRainbow(sweep);
      ctx.restore();
    }
    if (progress < .6) {
      const launch = Math.min(1, progress / .4);
      ctx.save(); ctx.translate(9 + launch * 50, -20 - launch * 36 + launch * launch * 33);
      ctx.rotate(launch * 5); ctx.globalAlpha *= Math.max(0, 1 - launch);
      ctx.fillStyle = '#ffd92f'; ctx.strokeStyle = '#97631c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-4, -1); ctx.lineTo(15, -20); ctx.lineTo(4, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    return;
  }
  ctx.save(); ctx.rotate(enemy.facingAngle ?? enemy.phase ?? 0);
  drawHead();
  ctx.restore();
}

function drawToasterBoss(enemy, deathProgress = null, damageColor = null) {
  const progress = deathProgress ?? 0, dizzy = enemy.state === 'dizzy' && deathProgress === null;
  ctx.save(); ctx.translate(enemy.x, enemy.y);
  ctx.rotate(deathProgress !== null ? Math.sin(progress * 28) * .18 + progress * .7
    : dizzy ? Math.sin((enemy.age ?? 0) * 3) * .08 : enemy.angle ?? 0);
  if (deathProgress !== null) {
    ctx.globalAlpha *= Math.max(0, 1 - Math.max(0, progress - .55) / .45);
    ctx.translate(0, progress * progress * 30);
  }
  const charge = enemy.state === 'burn-charge' && deathProgress === null;
  if (charge) { ctx.shadowColor = '#ff803f'; ctx.shadowBlur = 8 + enemy.stateTime * 12; }
  ctx.fillStyle = damageColor ?? '#747d86'; ctx.strokeStyle = '#323c44'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-42, -38, 87, 73, [25, 27, 6, 6]); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = damageColor ?? '#aeb6bd';
  ctx.beginPath(); ctx.roundRect(-46, -32, 72, 70, [24, 23, 6, 6]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d2d8dc';
  ctx.beginPath(); ctx.ellipse(-3, -33, 30, 8, -.06, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#22292e';
  for (const y of [-37, -30]) {
    ctx.beginPath(); ctx.ellipse(-3, y, 22, 2.5, -.06, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#364149'; ctx.fillRect(35, -15, 4, 39);
  ctx.fillStyle = '#e44749'; ctx.strokeStyle = '#823237';
  ctx.beginPath(); ctx.roundRect(30, 5, 18, 8, 2); ctx.fill(); ctx.stroke();
  const glyphs = {
    E: ['111', '100', '110', '100', '111'], R: ['110', '101', '110', '101', '101'],
    O: ['111', '101', '101', '101', '111'], '!': ['010', '010', '010', '000', '010'],
  };
  for (const [index, x] of [-34, -3].entries()) {
    ctx.fillStyle = '#080e0e'; ctx.fillRect(x, -15, 24, 15);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 1, -14, 22, 13); ctx.clip();
    if (dizzy) {
      const offset = Math.floor(enemy.stateTime * 12) % 42;
      ctx.fillStyle = '#ff363e';
      for (let column = 0; column < 16; column++) {
        const source = (column + index * 16 + offset) % 42;
        const letter = 'ERROR!    '[Math.floor(source / 4)];
        const glyph = glyphs[letter];
        if (!glyph || source % 4 === 3) continue;
        for (let row = 0; row < 5; row++) {
          if (glyph[row][source % 4] === '1') ctx.fillRect(x + 1 + column * 1.5, -12 + row * 2, 1.2, 1.7);
        }
      }
    } else {
      for (let col = 0; col < 7; col++) for (let row = 0; row < 4; row++) {
        ctx.fillStyle = deathProgress !== null ? '#34483e' : col === 3 ? '#1c783e' : '#66f37d';
        ctx.fillRect(x + 2 + col * 3, -13 + row * 3, 2, 2);
      }
    }
    ctx.restore();
  }
  ctx.fillStyle = '#20282e'; ctx.strokeStyle = '#20282e'; ctx.lineWidth = 3;
  if (enemy.state === 'hurt' || deathProgress !== null || (enemy.speaking && Math.sin((enemy.age ?? 0) * 10) > 0)) {
    ctx.beginPath(); ctx.ellipse(-7, 20, 17, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f47b82'; ctx.beginPath(); ctx.ellipse(-7, 27, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  } else line([[-32, 20], [-32, 15], [16, 15], [16, 20]], '#20282e', 3);
  if (deathProgress !== null) {
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? '#d4d9dc' : '#6c777f';
      ctx.beginPath(); ctx.arc(-22 + i * 8 + Math.sin(i * 2) * progress * 20,
        -32 - progress * (45 + i * 8), 3 + progress * 10, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawRobotBody(enemy, deathProgress = null, damageColor = null) {
  if (enemy.type === 'boss') {
    drawToasterBoss(enemy, deathProgress, damageColor);
    return;
  }
  if (enemy.type === 'snake') {
    drawSnakeRobot(enemy, deathProgress, damageColor);
    return;
  }
  ctx.save(); ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = damageColor ?? '#8898a7'; ctx.strokeStyle = '#d1dce4'; ctx.lineWidth = 2;
  if (enemy.type === 'goalie') {
    drawRoboGoalie(enemy, deathProgress, damageColor);
    ctx.restore(); return;
  }
  if (enemy.type === 'robo-koshi') {
    drawRoboKoshi(enemy, deathProgress, damageColor);
    ctx.restore(); return;
  }
  if (enemy.type === 'robo-snail') {
    drawRoboSnail(enemy, deathProgress, damageColor);
    ctx.restore(); return;
  }
  if (enemy.type === 'robo-cow') {
    drawRoboCow(enemy, deathProgress, damageColor);
    ctx.restore(); return;
  }
  if (enemy.type === 'robo-unicorn') {
    drawRoboUnicorn(enemy, deathProgress, damageColor);
    ctx.restore(); return;
  }
  if (enemy.type === 'jackolantern') {
    drawRoboJackolantern(enemy, deathProgress, damageColor);
    ctx.restore(); return;
  }
  if (enemy.type === 'ball') {
    drawRoboBall(enemy, deathProgress, damageColor);
    ctx.restore(); return;
  }
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
  if (enemy.afraid && deathProgress === null) {
    drawScaredFace();
    ctx.restore(); return;
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

function drawRoboGoalie(enemy, deathProgress = null, damageColor = null) {
  const progress = deathProgress ?? 0;
  const embarrassed = deathProgress !== null && progress >= .35;
  const burst = deathProgress === null ? 0 : Math.max(0, (progress - .65) / .35);
  ctx.save(); ctx.globalAlpha *= 1 - Math.min(1, burst * 2);
  const shell = ctx.createLinearGradient(-18, -24, 19, 24);
  shell.addColorStop(0, damageColor ?? (embarrassed ? '#ffc0d8' : '#e1e8ed'));
  shell.addColorStop(1, damageColor ?? (embarrassed ? '#e85c9c' : '#8496a6'));
  const egg = () => {
    ctx.beginPath(); ctx.moveTo(0, -27);
    ctx.bezierCurveTo(19, -27, 26, 0, 19, 18);
    ctx.bezierCurveTo(12, 36, -12, 36, -19, 18);
    ctx.bezierCurveTo(-26, 0, -19, -27, 0, -27); ctx.closePath();
  };
  ctx.fillStyle = shell; ctx.strokeStyle = '#354651'; ctx.lineWidth = 1.5;
  egg(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#576c7b'; ctx.lineWidth = 1.5;
  for (const x of [-9, 0, 9]) {
    ctx.beginPath(); ctx.moveTo(x * .6, -26); ctx.lineTo(x * 1.3, -37 - (x === 0 ? 2 : 0)); ctx.stroke();
    ctx.fillStyle = embarrassed ? '#ff95c5' : '#e8c561';
    ctx.beginPath(); ctx.arc(x * 1.3, -37 - (x === 0 ? 2 : 0), 1.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#647c8d'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(-10, 7, 20, 13, 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4, 12); ctx.lineTo(4, 12);
  ctx.moveTo(-4, 16); ctx.lineTo(4, 16); ctx.stroke();
  for (const x of [-14, 14]) {
    ctx.beginPath(); ctx.arc(x, 4, 1.5, 0, Math.PI * 2); ctx.stroke();
  }
  const shirtFall = deathProgress === null ? 0 : Math.min(1, progress / .35);
  ctx.save(); ctx.translate(0, shirtFall * 48);
  ctx.globalAlpha *= Math.max(0, 1 - Math.max(0, (progress - .2) / .2));
  ctx.save(); egg(); ctx.clip();
  ctx.fillStyle = '#27a6b0'; ctx.fillRect(-25, -1, 50, 35);
  for (const x of [-18, -6, 6, 18]) {
    ctx.fillStyle = '#f5cf5c'; ctx.fillRect(x, -1, 5, 35);
    ctx.fillStyle = '#de5275'; ctx.fillRect(x + 5, -1, 4, 35);
  }
  ctx.fillStyle = '#263b61'; ctx.fillRect(-25, -1, 50, 5);
  ctx.fillStyle = '#fff0af'; ctx.strokeStyle = '#263b61'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(11, 9, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#263b61';
  ctx.beginPath(); ctx.moveTo(11, 5.5); ctx.lineTo(13, 8); ctx.lineTo(12, 11);
  ctx.lineTo(9, 11); ctx.lineTo(8, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff0af';
  ctx.beginPath(); ctx.moveTo(-15, 10); ctx.lineTo(-11, 5); ctx.lineTo(-7, 10); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#26353d';
  for (const x of [-8, 8]) {
    if (embarrassed) {
      ctx.strokeStyle = '#26353d'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(x - 3, -10); ctx.lineTo(x, -7); ctx.lineTo(x + 3, -10); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(x, -11, 2.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (enemy.afraid && deathProgress === null) {
    ctx.strokeStyle = '#26353d'; ctx.beginPath(); ctx.arc(0, 19, 3, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = shell; ctx.strokeStyle = '#354651'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-3, -9); ctx.bezierCurveTo(-4, -4, -9, 7, -5, 11);
  ctx.quadraticCurveTo(0, 16, 6, 10); ctx.bezierCurveTo(9, 6, 3, -4, 3, -9);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (embarrassed) {
    ctx.fillStyle = '#f02d8780';
    for (const x of [-13, 13]) {
      ctx.beginPath(); ctx.ellipse(x, -1, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  if (burst > 0) {
    ctx.save(); ctx.globalAlpha *= 1 - burst;
    for (const [color, size] of [['#e95c4e', 1], ['#ffb55c', .7], ['#fff2b9', .4]]) {
      ctx.fillStyle = color; ctx.beginPath();
      ctx.arc(0, 0, (8 + Math.sin(burst * Math.PI) * 32) * size, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5;
      ctx.save(); ctx.translate(Math.cos(angle) * burst * 58, Math.sin(angle) * burst * 58);
      ctx.rotate(angle + burst * 4); ctx.fillStyle = i % 2 ? '#b7c7d1' : '#ff8fc1';
      ctx.fillRect(-3, -2, 6, 4); ctx.restore();
    }
    ctx.restore();
  }
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
  if (enemy.afraid && deathProgress === null) {
    ctx.save(); ctx.translate(0, 3); ctx.scale(.85, .85); drawScaredFace(); ctx.restore();
    ctx.restore(); ctx.restore(); return;
  }
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
  if (enemy.afraid && deathProgress === null) {
    ctx.save(); ctx.translate(0, -3); ctx.scale(.85, .85); drawScaredFace(); ctx.restore();
    ctx.restore(); return;
  }
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

function drawFireWave(segments, radius) {
  ctx.save(); ctx.lineCap = 'butt';
  for (const [color, width] of [['#bc3824aa', 10], ['#fa762deb', 6], ['#ffe28e', 2]]) {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath();
    for (const { from, to } of segments) { ctx.moveTo(...from); ctx.lineTo(...to); }
    ctx.stroke();
  }
  ctx.fillStyle = '#ffb744';
  for (const { from, to } of segments) {
    const dx = to[0] - from[0], dy = to[1] - from[1], length = Math.hypot(dx, dy);
    if (!length) continue;
    for (let distance = 6; distance < length; distance += 14) {
      const x = from[0] + dx * distance / length, y = from[1] + dy * distance / length;
      const height = 4 + Math.sin(radius * .2 + distance) * 2;
      ctx.beginPath(); ctx.moveTo(x - dy / length * 3, y + dx / length * 3);
      ctx.lineTo(x + dy / length * height, y - dx / length * height);
      ctx.lineTo(x + dx / length * 4, y + dy / length * 4); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

function drawRoboJackolantern(enemy, deathProgress = null, damageColor = null) {
  const progress = deathProgress ?? 0;
  ctx.save();
  const warning = deathProgress === null && !enemy.afraid && !enemy.asleep
    && enemy.stompTimer <= .5;
  const stomp = deathProgress === null && !enemy.afraid && enemy.stompAge !== null
    && enemy.stompAge !== undefined ? Math.sin(enemy.stompAge / .35 * Math.PI) : 0;
  ctx.translate(0, warning ? -Math.sin((.5 - enemy.stompTimer) * Math.PI) * 6 : stomp * 3);
  ctx.scale(1 + stomp * .12, 1 - stomp * .15);
  if (deathProgress !== null && progress >= .3) {
    const burst = (progress - .3) / .7;
    for (let i = 0; i < 9; i++) {
      const angle = i * Math.PI * 2 / 9;
      ctx.save(); ctx.translate(Math.cos(angle) * burst * 60,
        Math.sin(angle) * burst * 40 - burst * 25 + burst * burst * 50);
      ctx.rotate(angle + burst * (i % 2 ? 5 : -5));
      ctx.fillStyle = i % 3 === 0 ? '#8c989e' : i % 2 ? '#f39838' : '#c55920';
      ctx.strokeStyle = '#63361e'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-6, -7); ctx.lineTo(7, -4); ctx.lineTo(5, 8);
      ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.restore(); return;
  }
  const pumpkin = ctx.createRadialGradient(-7, -9, 1, 0, 0, 26);
  pumpkin.addColorStop(0, '#ffb45a'); pumpkin.addColorStop(.5, '#ed852e'); pumpkin.addColorStop(1, '#aa421b');
  ctx.fillStyle = damageColor ?? pumpkin; ctx.strokeStyle = '#75351b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -18);
  ctx.bezierCurveTo(-29, -28, -28, 23, 0, 20);
  ctx.bezierCurveTo(28, 23, 29, -28, 0, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#b95621'; ctx.lineWidth = 1.3;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * 9, -16); ctx.bezierCurveTo(side * 18, -8, side * 18, 10, side * 9, 18); ctx.stroke();
  }
  ctx.strokeStyle = '#9ca7ad'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, -25); ctx.stroke();
  ctx.save();
  if (deathProgress !== null) { ctx.translate(progress * 30, progress * 15); ctx.rotate(progress * 4); }
  ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(0, -33); ctx.stroke();
  ctx.fillStyle = '#c3cbd0'; ctx.beginPath(); ctx.arc(0, -34, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  if (enemy.afraid && deathProgress === null) drawScaredFace();
  else {
    ctx.fillStyle = '#adb7bc'; ctx.strokeStyle = '#39454c'; ctx.lineWidth = 1.5;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.roundRect(side * 9 - 5, -9, 10, 8, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#505e66'; ctx.fillRect(side * 9 - 2, -7, 3, 4); ctx.fillStyle = '#adb7bc';
    }
    ctx.fillStyle = deathProgress === null ? '#ffdf60' : '#626970';
    ctx.strokeStyle = '#75351b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(-4, 5); ctx.lineTo(4, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-14, 7); ctx.lineTo(-8, 10); ctx.lineTo(-5, 7);
    ctx.lineTo(0, 11); ctx.lineTo(5, 7); ctx.lineTo(8, 10); ctx.lineTo(14, 7);
    ctx.lineTo(9, 16); ctx.lineTo(4, 13); ctx.lineTo(0, 17); ctx.lineTo(-4, 13);
    ctx.lineTo(-9, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawRoboBall(enemy, deathProgress = null, damageColor = null) {
  const progress = deathProgress ?? 0;
  ctx.save();
  const shrivel = Math.min(1, progress / .55);
  ctx.translate(0, shrivel * 14);
  ctx.scale(1 - shrivel * .55, 1 - shrivel * .85);
  const orange = ctx.createRadialGradient(-7, -9, 1, 0, 0, 23);
  orange.addColorStop(0, '#ffbf65'); orange.addColorStop(.55, '#ed852e'); orange.addColorStop(1, '#b94e19');
  ctx.fillStyle = damageColor ?? orange; ctx.strokeStyle = '#383d40'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.clip(); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-19, 0); ctx.lineTo(19, 0);
  ctx.moveTo(0, -19); ctx.lineTo(0, 19);
  ctx.moveTo(-15, -19); ctx.bezierCurveTo(5, -9, 5, 9, -15, 19);
  ctx.moveTo(15, -19); ctx.bezierCurveTo(-5, -9, -5, 9, 15, 19); ctx.stroke();
  ctx.restore();
  if (enemy.afraid && deathProgress === null) drawScaredFace();
  else {
    ctx.fillStyle = '#252b2d'; ctx.fillRect(-10, 5, 20, 9);
    ctx.strokeStyle = '#9ba4a7'; ctx.lineWidth = 1.2;
    ctx.strokeRect(-9, 6, 18, 7);
    ctx.beginPath(); ctx.moveTo(-9, 9.5); ctx.lineTo(9, 9.5);
    for (let x = -6; x <= 6; x += 4) { ctx.moveTo(x, 6); ctx.lineTo(x, 13); }
    ctx.stroke();
    if (deathProgress === null) {
      for (const x of [-7, 7]) {
        ctx.fillStyle = '#c82029'; ctx.beginPath(); ctx.arc(x, -6, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff8580'; ctx.beginPath(); ctx.arc(x - .7, -7, .8, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
  if (deathProgress !== null) {
    for (const side of [-1, 1]) {
      const x = side * (7 + progress * 17), y = -6 - Math.sin(Math.PI * Math.min(1, progress / .85)) * 40;
      ctx.fillStyle = '#c82029'; ctx.strokeStyle = '#383d40'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
}

function drawEnemyDeath(enemy) {
  const progress = enemy.deathProgress;
  ctx.save();
  if (enemy.type === 'boss') {
    drawRobot(enemy, progress);
  } else if (enemy.type === 'robo-koshi') {
    drawRobot(enemy, progress);
    if (progress > .12) {
      const smoke = Math.min(1, (progress - .12) / .88);
      ctx.save(); ctx.translate(enemy.x, enemy.y);
      ctx.globalAlpha = Math.sin(Math.PI * smoke) * .85;
      for (let i = 0; i < 9; i++) {
        const angle = i * Math.PI * 2 / 9;
        const drift = smoke * (24 + i % 3 * 7);
        ctx.fillStyle = i % 2 ? '#7f898e' : '#c1c9cc';
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * drift, Math.sin(angle) * drift - smoke * 13,
          4 + smoke * (5 + i % 3 * 2), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  } else if (enemy.type === 'robo-snail') {
    drawRobot(enemy, progress);
  } else if (enemy.type === 'robo-unicorn') {
    drawRobot(enemy, progress);
  } else if (enemy.type === 'goalie') {
    drawRobot(enemy, progress);
  } else if (enemy.type === 'snake') {
    ctx.globalAlpha *= Math.max(0, 1 - progress);
    drawRobot(enemy, progress);
  } else if (enemy.type === 'jackolantern') {
    ctx.globalAlpha *= Math.max(0, Math.min(1, (1 - progress) / .4));
    drawRobot(enemy, progress);
  } else if (enemy.type === 'ball') {
    ctx.globalAlpha *= Math.max(0, Math.min(1, (1 - progress) / .4));
    drawRobot(enemy, progress);
  } else if (enemy.type === 'mouse') {
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
    if (enemy.type === 'robo-cow') {
      drawRobot({ ...enemy, x: 0, y: 0 }, progress);
    } else if (progress < .35) {
      const size = Math.max(.01, 1 - progress / .35);
      ctx.save(); ctx.scale(size, size);
      drawRobot({ ...enemy, x: 0, y: 0 }, progress);
      ctx.restore();
    }
    const blastStart = enemy.type === 'robo-cow' ? .65 : .25;
    if (progress >= blastStart) {
      const blast = (progress - blastStart) / (1 - blastStart);
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
  if (!game) return;
  board.style.setProperty('--board-scale-x', board.clientWidth / game.viewportWidth);
  board.style.setProperty('--board-scale-y', board.clientHeight / game.viewportHeight);
  const ratio = window.devicePixelRatio || 1;
  for (const layer of [canvas, actorCanvas]) {
    layer.width = Math.round(board.clientWidth * ratio);
    layer.height = Math.round(board.clientHeight * ratio);
    layer.getContext('2d').setTransform(layer.width / game.viewportWidth, 0, 0, layer.height / game.viewportHeight, 0, 0);
  }
  render(performance.now() / 1000);
}

function frame(timestamp) {
  if (!game || levelPicker.open || levelInfoDialog.open) {
    lastTime = null;
    requestAnimationFrame(frame);
    return;
  }
  const seconds = lastTime === null ? 0 : (timestamp - lastTime) / 1000;
  if (!phaseTransition.busy) {
    if (cutscene.active) cutscene.update(seconds);
    else {
      const previousElapsed = game.elapsed;
      game.update(seconds);
      if (game.state === 'playing' && previousElapsed <= 5 && game.elapsed > 5) checkpointAttempt();
    }
    updateEnding(seconds);
  }
  recordCatBlockFinds();
  lastTime = timestamp;
  syncUI();
  render(timestamp / 1000);
  if (timestamp > toastUntil && game.state === 'playing') toast.textContent = '';
  requestAnimationFrame(frame);
}

function updateBoardVisibility() {
  document.querySelector('.intro').hidden = !game;
  document.querySelector('.game-shell').hidden = !game;
}

function reportCampaignError(error) {
  for (const message of document.querySelectorAll('[data-campaign-error]')) {
    message.textContent = `Game or map selection could not be saved or restored: ${error.message}`;
    message.hidden = false;
  }
}

campaignMode.setup({
  reportError: reportCampaignError,
  beforeSwitch: () => {
    if ((tutorial || game && ['playing', 'paused'].includes(game.state))
      && !confirm('Switch games and end this run? An unfinished campaign attempt counts as a quit after more than 5 seconds.')) return false;
    if (!saveAttempt(flushSaves)) return false;
    try {
      const selected = LEVELS[Number(levelSelect.value)];
      if (selected) localStorage.setItem(campaignMode.storageKey('selection', campaignId), selected.id);
    } catch (error) {
      console.error('Map selection could not be saved:', error);
      reportCampaignError(error);
      return false;
    }
    return true;
  },
  onSwitch: () => {
    saveResult();
    return saveAttempt(flushSaves);
  },
});
document.querySelector('#campaign-empty').hidden = campaignId !== 'official';
game = createGame();
updateBoardVisibility();
saveAttempt(renderSaveSlots);
if (game) {
  makeBrickButtons();
  syncUI();
}
if (!game || !location.hash.startsWith('#level=') && !location.hash.startsWith('#campaign=') && location.hash !== '#install') titleScreen.showModal();
if (game && (game.level.cutscene || game.level.levelInfo)
  && (location.hash.startsWith('#level=') || location.hash.startsWith('#campaign='))) showLevelIntroduction();
document.body.classList.remove('game-loading');
installBackNavigation();
new ResizeObserver(resize).observe(board);
requestAnimationFrame(frame);
})();
