(function () {
'use strict';

const { Game, LEVELS, FOODS, ITEMS, OBJECTS, WEAPONS, CAT_BLOCK_TRIGGERS, CAT_BRICK_TYPES, catBlockDescription, COOLDOWNS, SLIMES, SHIELDS, CHARACTERS, PORTALS, CONTACT_SURFACES, obstructionGeometry, portalPairIssues, validateCustomLevel, snapWheel, brickRegions, brickEditRegions, brickShape, brickSlime, brickSpring, brickSpikes, brickConveyor } = globalThis.KoshiGame;
const { catBlockObjective } = globalThis.KoshiGame;
const { INFO_GRAPHICS } = globalThis.KoshiGame;
const { decorateBrick, exposePortalCloud, exposeBrickInfo, specialLabel, spawnSymbol, spawnColor, drawCatCircle, drawBumper, drawObstruction, FENCE } = globalThis.KoshiBrickVisuals;
const $ = selector => document.querySelector(selector);
const carriedItem = event => event.carriesItem ?? (event.carriesCatBlock ? 'cat-block' : event.carriesKey ? 'key' : '');
const board = $('#editor-board');
const form = $('#event-form');
const campaignMode = globalThis.KoshiCampaignMode;
const blank = () => ({ version: 1, id: 'My level', duration: 60, goal: 20, heartCost: null, brickSet: 1, events: [] });
const validateDraft = value => validateCustomLevel(value, { allowUnpairedPortals: true, allowIncompleteBoss: true });
const immutableBrick = kind => ['cinder', 'goal'].includes(kind);
const OBSTRUCTION_COLORS = [
  '#ffffff', '#eeeeee', '#cccccc', '#aaaaaa', '#888888', '#666666', '#444444', '#222222', '#111111', '#000000',
  '#fecaca', '#b77b7b', '#ef4444', '#b91c1c', '#450a0a',
  '#fed7aa', '#b78c70', '#f97316', '#c2410c', '#431407',
  '#fde68a', '#b7a170', '#f59e0b', '#b45309', '#451a03',
  '#fef08a', '#b7ae70', '#eab308', '#a16207', '#422006',
  '#d9f99d', '#a0b770', '#84cc16', '#4d7c0f', '#1a2e05',
  '#bbf7d0', '#7bb78b', '#22c55e', '#15803d', '#052e16',
  '#a7f3d0', '#70b79c', '#10b981', '#047857', '#022c22',
  '#99f6e4', '#70b7af', '#14b8a6', '#0f766e', '#042f2e',
  '#a5f3fc', '#70aab7', '#06b6d4', '#0e7490', '#083344',
  '#bae6fd', '#709ab7', '#0ea5e9', '#0369a1', '#082f49',
  '#bfdbfe', '#7b8fb7', '#3b82f6', '#1d4ed8', '#172554',
  '#c7d2fe', '#827bb7', '#6366f1', '#4338ca', '#1e1b4b',
  '#ddd6fe', '#967bb7', '#8b5cf6', '#6d28d9', '#2e1065',
  '#e9d5ff', '#a77bb7', '#a855f7', '#7e22ce', '#3b0764',
  '#f5d0fe', '#b770b1', '#d946ef', '#a21caf', '#4a044e',
  '#fbcfe8', '#b77096', '#ec4899', '#be185d', '#500724',
  '#fecdd3', '#b7707d', '#f43f5e', '#be123c', '#4c0519',
  '#ead8c5', '#a58b73', '#a66b36', '#704522', '#29190d',
];
for (const [kind, types] of Object.entries({ food: FOODS, weapon: WEAPONS, enemy: { mouse: { name: 'Robo Mouse' }, wheel: { name: 'Robo Wheel' }, ram: { name: 'Robo Ram' }, bucket: { name: 'Robo Bucket' }, ball: { name: 'Robo Ball' }, jackolantern: { name: 'Robo Jackolantern' }, snake: { name: 'Robo Snake' }, goalie: { name: 'Robo Goalie' }, 'robo-koshi': { name: 'Robo Koshi' }, 'robo-snail': { name: 'Robo Snail' }, 'robo-cow': { name: 'Robo Cow' }, 'robo-unicorn': { name: 'Robo Unicorn' }, 'robo-crab': { name: 'Robo Crab' }, 'robo-love-bug': { name: 'Robo Love Bug' } }, heart: { heart: { name: 'Heart' } }, item: ITEMS, object: OBJECTS })) {
  const group = document.createElement('optgroup');
  group.label = kind;
  for (const [type, item] of Object.entries(types)) {
    const option = document.createElement('option');
    option.value = `${kind}:${type}`; option.textContent = item.name;
    group.append(option);
  }
  $('#brick-spawn-item').append(group);
}
$('#event-carries-item').append(...Object.entries({ ...ITEMS, ...WEAPONS }).map(([value, item]) => {
  const option = document.createElement('option');
  option.value = value; option.textContent = item.name;
  return option;
}));
let level = blank();
let selectedEvents = new Set();
let selectedBricks = new Set();
let combineOwner = null;
let placing = true;
let activeCategory = 'food';
let previewGame;
let gesture = null;
let connectingSpawn = null;
let touched = new Set();
let dirty = false;
let committed = JSON.stringify(level);
let campaignIndex = null;
let customWorkspace = null;
let selectedTrackId = '';
let trackDrawing = false;
let trackDrawNodes = [];
let selectedTrackNode = -1;
let trackNodeGesture = null;
const readOnly = () => campaignIndex !== null;
const accessFields = ['#settings-access', '#cutscene-access', '#level-info-access', '#inspector-access', '#files-access', '#camera-access'];
const writeButtons = ['#place-mode', '#new-level'];
for (const [index, campaign] of LEVELS.entries()) {
  const option = document.createElement('option');
  option.value = String(index);
  option.textContent = `${campaign.number} - ${campaign.name} (read-only)`;
  $('#editor-level').append(option);
}

function campaignPreview(index) {
  let seed = index + 1;
  const game = new Game(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }, { level: index });
  const events = [...(game.level.events ?? [])];
  const bounds = game.bounds();
  const add = (kind, time, type, point, lifetime, shield) => events.push({
    kind, time, type, x: (point.x - bounds.left) / (bounds.right - bounds.left),
    y: (point.y - bounds.top) / (bounds.bottom - bounds.top),
    previewRandom: kind !== 'enemy' || type !== 'boss',
    ...(lifetime == null ? {} : { lifetime }), ...(shield == null ? {} : { shield }),
  });
  for (const entry of game.level.food) {
    for (const food of game.createFood(entry)) add('food', entry[0], entry[2], food, entry[3]);
  }
  for (const entry of game.level.enemies) {
    for (const enemy of game.createEnemies(entry)) {
      add('enemy', entry[0], entry[1], enemy, null, entry[3]);
      if (entry[1] === 'robo-crab' && entry[4]?.crabDirection) events.at(-1).crabDirection = entry[4].crabDirection;
      const item = enemy.carriesItem ?? (enemy.carriesCatBlock ? 'cat-block' : enemy.carriesKey ? 'key' : '');
      if (item) events.at(-1).carriesItem = item;
    }
  }
  for (const [kind, entries] of [['weapon', game.level.weapons], ['item', game.level.items]]) {
    for (const [time, type, lifetime] of entries) add(kind, time, type, game.createCollectible(time, type, lifetime), lifetime);
  }
  events.sort((a, b) => a.time - b.time);
  return { ...game.level, heartCost: Number.isFinite(game.level.heartCost) ? game.level.heartCost : null, events };
}

function syncAccess() {
  const locked = readOnly();
  for (const selector of accessFields) $(selector).disabled = locked;
  for (const selector of writeButtons) $(selector).disabled = locked;
  board.dataset.readOnly = String(locked);
  $('#editor-bricks').setAttribute('aria-label', locked ? 'Read-only boundary bricks' : 'Editable boundary bricks');
  $('#playtest').textContent = locked ? 'Play game level →' : 'Playtest →';
  $('#copy-official-level').disabled = !locked || campaignMode.active.id !== 'official';
}

function selectEditorLevel() {
  const value = $('#editor-level').value;
  if (value !== 'custom' && !readOnly()) {
    customWorkspace = { level, committed, dirty, placing, activeCategory, selectedEvents, selectedBricks,
      selectedTrackId, trackDrawing, trackDrawNodes,
      sceneLines: [...$('#scene-lines').childNodes],
      sceneFieldsDisabled: $('#scene-fields').disabled,
      infoPages: [...$('#info-pages').childNodes], infoFieldsDisabled: $('#info-fields').disabled,
      fields: [...document.querySelectorAll('input, select, textarea')].filter(node => node.id !== 'editor-level')
        .map(node => ({ node, value: node.value, checked: node.checked,
          selectedValues: node.multiple ? [...node.selectedOptions].map(option => option.value) : null })) };
  }
  if (value === 'custom') {
    if (!customWorkspace) return;
    campaignIndex = null;
    ({ level, committed, dirty, placing, activeCategory, selectedEvents, selectedBricks,
      selectedTrackId, trackDrawing, trackDrawNodes } = customWorkspace);
  } else {
    campaignIndex = Number(value);
    level = campaignPreview(campaignIndex);
    placing = false; selectedEvents = new Set(); selectedBricks = new Set();
    selectedTrackId = ''; populateTrackForm();
    $('#timeline').value = 0;
  }
  gesture = null; $('#selection-box').hidden = true;
  populateSettings(); populateCutscene(); populateLevelInfo(); populateEventForm(); updatePlaytest(); render();
  if (!readOnly()) {
    $('#scene-lines').replaceChildren(...customWorkspace.sceneLines);
    $('#scene-fields').disabled = customWorkspace.sceneFieldsDisabled;
    $('#info-pages').replaceChildren(...customWorkspace.infoPages);
    $('#info-fields').disabled = customWorkspace.infoFieldsDisabled;
    for (const { node, value: savedValue, checked, selectedValues } of customWorkspace.fields) {
      if (node.isConnected) {
        if (selectedValues) for (const option of node.options) option.selected = selectedValues.includes(option.value);
        else node.value = savedValue;
        node.checked = checked;
      }
    }
    updateWinCondition(); syncPalettes(); render();
    customWorkspace = null;
  }
  showCategory(activeCategory);
  syncAccess();
  message(readOnly()
    ? 'Game level opened read-only. Select your custom level to resume editing, or use Edit a copy for an Official level.'
    : 'Your custom workspace restored.');
}
$('#editor-level').addEventListener('change', () => { pausePreview(); attempt(selectEditorLevel); });

function copyOfficialLevel() {
  if (!readOnly() || campaignMode.active.id !== 'official') return;
  const campaign = LEVELS[campaignIndex];
  const authored = globalThis.KoshiOfficialLevels.find(entry => entry.id === campaign.id);
  const candidate = validateDraft(authored ? authored.level
    : { ...campaignPreview(campaignIndex), version: 1, id: campaign.name });
  if (customWorkspace?.dirty
    && !confirm('Replace your unsaved custom workspace with this Official level copy? Print JSON and save the text first to keep it.')) return;
  campaignIndex = null;
  customWorkspace = null;
  committed = '';
  $('#editor-level').value = 'custom';
  $('#timeline').value = 0;
  $('#level-json').value = '';
  syncAccess();
  replaceLevel(candidate);
  showCategory(activeCategory);
  message('Official level copied into your editable workspace. Edit and Print JSON; the built-in game level is unchanged.');
}
$('#copy-official-level').addEventListener('click', () => attempt(copyOfficialLevel));

for (const type of ['click', 'change', 'input', 'submit']) document.addEventListener(type, event => {
  if (!readOnly() || !event.target.closest('button, input, select, textarea, form')
    || !event.target.closest([...accessFields, ...writeButtons].join(', '))) return;
  event.preventDefault(); event.stopImmediatePropagation();
  message('Game levels are read-only. Select your custom level to make changes.', true);
}, true);
const MIXED = '';
const palettes = new Map();
const COLORS = { normal: '#83bca1', slow: '#7eacdb', fast: '#df8c81', ...PORTALS };
const SURFACE_ICONS = {
  plain: 'M-22 -12 H22 V12 H-22 Z',
  slimed: 'M-22 -10 H22 V2 Q16 16 10 2 Q3 23 -4 2 Q-15 18 -22 2 Z',
  springs: 'M-22 -12 H22 V-4 H-22 Z M-16 0 L-8 5 L-16 10 L-8 15 M8 0 L16 5 L8 10 L16 15',
  spikes: 'M-24 12 L-16 -12 L-8 12 L0 -12 L8 12 L16 -12 L24 12 Z',
  conveyor: 'M-15 -10 H15 A10 10 0 0 1 15 10 H-15 A10 10 0 0 1 -15 -10 Z M-18 0 H18 M8 -5 L18 0 L8 5',
  barrier: FENCE,
  crumbler: 'M-22 -12 H22 V12 H-22 Z M-4 -12 L2 -4 L-5 2 L5 12',
  warped: 'M-20 -4 C-24 -22 6 -22 7 -5 S-18 16 -8 1 S19 -12 21 8',
};

function picture(value, control) {
  const image = document.createElement('span');
  image.className = 'palette-picture';
  const item = control === 'event-kind' ? { kind: value, type: { food: 'S', enemy: 'mouse', weapon: 'wood', item: 'smiley-cookie', object: 'soccer-ball' }[value] }
    : control === 'event-type' ? { kind: $('#event-kind').value, type: value }
    : control === 'brick-spawn-item' ? { kind: value.split(':')[0], type: value.split(':')[1] } : null;
  if (value === 'koshi') {
    const artwork = document.createElement('img');
    artwork.src = './icons/koshi.svg'; artwork.alt = '';
    image.append(artwork);
  } else if (value === 'tracks') {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), path = document.createElementNS(ns, 'path');
    svg.setAttribute('viewBox', '-28 -18 56 36'); svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('d', 'M-22 10 L-8 -10 L8 8 L22 -8');
    path.setAttribute('stroke-dasharray', '1 5'); svg.append(path); image.append(svg);
  } else if (item?.kind === 'object' && OBJECTS[item.type]?.bumper) {
    const canvas = document.createElement('canvas');
    canvas.width = 56; canvas.height = 56; canvas.setAttribute('aria-hidden', 'true');
    drawBumper(canvas.getContext('2d'), { x: 28, y: 28, radius: 25, type: item.type });
    image.append(canvas);
  } else if (control === 'info-slime' || control === 'info-steering') {
    const brick = { x: 0, y: 0, w: 88, h: 52,
      kind: control === 'info-steering' ? value : 'normal',
      region: { edge: 'top', start: 0, end: 1 } };
    image.classList.add('palette-swatch');
    image.style.backgroundColor = COLORS[brick.kind];
    if (control === 'info-slime') {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg'), path = document.createElementNS(ns, 'path');
      svg.setAttribute('viewBox', '0 0 1 1'); svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      path.setAttribute('d', brickSlime([brick], 88, 200));
      path.style.fill = SLIMES[value].color; path.style.stroke = '#102619'; path.style.strokeWidth = '.02';
      svg.append(path); image.append(svg);
    }
  } else if (value === 'cat-block') {
    const artwork = document.createElement('img');
    artwork.src = './icons/cat-building-block.png'; artwork.alt = 'Cat Block';
    image.append(artwork);
  } else if (item && item.kind && item.type) {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), path = document.createElementNS(ns, 'path');
    svg.setAttribute('viewBox', item.type === 'robo-snail' ? '-32 -32 64 64'
      : item.type === 'robo-love-bug' ? '-32 -40 64 72' : item.type === 'robo-crab' ? '-42 -44 84 76' : item.type === 'robo-unicorn' ? '-38 -44 76 76'
        : item.type === 'robo-cow' ? '-35 -30 70 60' : '-28 -28 56 56'); svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('d', spawnSymbol(item));
    svg.append(path); image.append(svg);
    image.style.color = spawnColor(item);
    if (item.type === 'robo-love-bug') {
      path.setAttribute('stroke', '#522631');
      const detail = (d, color) => {
        const layer = document.createElementNS(ns, 'path');
        layer.setAttribute('d', d); layer.setAttribute('fill', color); layer.setAttribute('stroke', 'none'); svg.append(layer);
      };
      detail('M0 -9 C-30 -13 -30 25 0 25 C30 25 30 -13 0 -9 Z', '#f29ac2');
      detail('M0 19 C-31 2 -13 -9 0 2 C13 -9 31 2 0 19 Z', '#9346b2');
      detail('M-22 -7 C-22 -31 22 -31 22 -7 Z', '#485158');
      detail('M-12 -19 H-5 V-12 H-12 Z M5 -19 H12 V-12 H5 Z', '#ef3646');
    }
    if (item.type === 'robo-crab') {
      const detail = (d, color, fill = 'none') => {
        const layer = document.createElementNS(ns, 'path');
        layer.setAttribute('d', d); layer.setAttribute('stroke', color); layer.setAttribute('fill', fill); svg.append(layer);
      };
      detail('M-23 2 H-35 V-24 H-29 M23 2 H35 V-24 H29 M-36 -24 L-37 -38 L-22 -38 L-30 -28 L-23 -31 V-24 Z M36 -24 L37 -38 L22 -38 L30 -28 L23 -31 V-24 Z', '#d33c43');
      detail('M-17 -22 H-3 V-16 H-17 Z M3 -22 H17 V-16 H3 Z', '#343e44', '#343e44');
      detail('M-16 -20 H-4 M-16 -17 H-4 M4 -20 H16 M4 -17 H16', '#79f58a');
    }
    if (item.type === 'robo-unicorn') {
      path.setAttribute('fill', '#f5b5d3');
      const detail = (d, color) => {
        const layer = document.createElementNS(ns, 'path');
        layer.setAttribute('d', d); layer.setAttribute('fill', color); svg.append(layer);
      };
      for (const [index, color] of ['#fa596f', '#ffad42', '#ffe65a', '#69d58e', '#53b9f1', '#a77bf0'].entries()) {
        const x = -24 + index * 3;
        detail(`M${x} -25 Q${x - 14} -10 ${x - 5} 24 L${x} 20 Q${x - 8} -10 ${x + 4} -23 Z`, color);
      }
      detail('M5 -21 L24 -40 L13 -16 Z M1 -14 Q7 -19 12 -12 Q7 -6 2 -9 Z', '#ffd92f');
      detail('M6 -14 H8 V-8 H6 Z', '#45381d');
      detail('M18 10 H27 V15 H18 Z', '#c4cdd5');
    }
  } else if (value === 'boom-helmet') {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), path = document.createElementNS(ns, 'path');
    svg.setAttribute('viewBox', '-28 -28 56 56'); svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('d', 'M-22 16V-2A22 22 0 0 1 22 -2V16ZM0 -24V-28M-8 0H8V12H-8Z');
    path.setAttribute('fill', '#6c9bbd'); path.setAttribute('stroke', '#203342');
    svg.append(path); image.append(svg);
  } else if (['portal', 'toggle', 'power', 'spawner', 'boost', 'cinder', 'goal', 'turret', 'hazard'].includes(value) || control === 'brick-toggle-clicks' || control === 'brick-hazard-type') {
    const brick = { x: 0, y: 0, w: 88, h: 52 };
    if (value === 'portal') brick.portal = 'purple';
    if (value === 'toggle' || control === 'brick-toggle-clicks') { brick.toggle = control === 'brick-toggle-clicks' ? Number(value) : 1; brick.toggleRemaining = brick.toggle; }
    if (value === 'spawner') brick.spawner = { kind: 'heart', type: 'heart' };
    if (value === 'boost') brick.boost = true;
    if (value === 'power') brick.power = true;
    if (value === 'turret') brick.turret = $('#brick-turret-type').value || 'laser';
    if (value === 'hazard' || control === 'brick-hazard-type') brick.hazard = { type: control === 'brick-hazard-type' ? value : 'laser' };
    if (immutableBrick(value)) brick.kind = value;
    decorateBrick(image, brick, [brick]);
  } else if (SURFACE_ICONS[value]) {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), path = document.createElementNS(ns, 'path');
    svg.setAttribute('viewBox', '-28 -28 56 56'); svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('d', SURFACE_ICONS[value]); svg.append(path); image.append(svg);
    if (value === 'barrier') {
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#174f36');
      path.setAttribute('stroke-width', '4'); path.setAttribute('opacity', '.75');
    }
  } else if (COLORS[value]) {
    image.classList.add('palette-swatch'); image.style.backgroundColor = COLORS[value];
  } else {
    image.textContent = value === 'clockwise' ? '↻' : value === 'counterclockwise' ? '↺' : '?';
  }
  return image;
}

function choiceButton(value, name, control, action) {
  const button = document.createElement('button'), caption = document.createElement('span');
  button.type = 'button'; button.title = name; button.setAttribute('aria-label', name);
  caption.className = 'palette-caption';
  caption.textContent = control === 'brick-toggle-clicks' ? `${value} clicks` : name.split(' · ')[0];
  button.append(picture(value, control), caption);
  button.addEventListener('click', event => {
    if (readOnly()) return;
    placing = true;
    action(event);
    syncTool();
  });
  return button;
}

function setupPalettes() {
  for (const [category, name] of [['koshi', 'Koshi'], ['brick', 'Bricks'], ['food', 'Food'], ['enemy', 'Enemies'], ['item', 'Items'], ['object', 'Objects'], ['tracks', 'Tracks'], ['weapon', 'Weapons']]) {
    const button = choiceButton(category === 'brick' ? 'normal' : category, name, category === 'brick' ? 'brick-kind' : 'event-kind', () => {
      if (category === 'brick') {
        selectedEvents = new Set();
        showCategory(category);
        populateEventForm(); render();
      } else if (category === 'koshi') {
        showCategory(category); setSelection([], []);
      } else if (category === 'tracks') {
        showCategory(category); render();
      } else {
        $('#event-kind').value = category;
        $('#event-kind').dispatchEvent(new Event('change'));
      }
    });
    button.dataset.category = category;
    button.setAttribute('aria-controls', category === 'brick' ? 'brick-panel' : category === 'tracks' ? 'track-panel' : category === 'koshi' ? 'koshi-panel' : 'event-panel');
    $('#category-palette').append(button);
  }
  showCategory(activeCategory);
  for (const id of ['brick-kind', 'brick-slime-color', 'brick-conveyor-direction', 'brick-portal-color', 'brick-toggle-clicks', 'brick-spawn-item', 'brick-hazard-type', 'event-type']) {
    const select = $(`#${id}`), palette = document.createElement('div');
    select.hidden = true;
    palette.className = 'visual-palette'; palette.setAttribute('role', 'group');
    palette.setAttribute('aria-label', select.parentElement.textContent.trim().split('\n')[0].split(select.options[0]?.textContent ?? '\n')[0].trim() || id);
    select.parentElement.after(palette);
    palettes.set(id, { select, palette, signature: null, buttons: [] });
  }
  for (const [container, attributes] of [['surface-palette', ['plain', ...CONTACT_SURFACES]], ['attribute-palette', ['crumbler', 'warped', 'toggle', 'power']]]) {
    for (const attribute of attributes) {
      const name = { plain: 'Plain', slimed: 'Slime', spawner: 'Spawner', turret: 'Turret' }[attribute] ?? attribute[0].toUpperCase() + attribute.slice(1);
      const button = choiceButton(attribute, name, 'surface', () => {
        if (attribute === 'plain') {
          saveBrick({ target: { id: 'brick-plain' } });
        } else {
          const box = $(`#brick-${attribute}`);
          box.checked = box.indeterminate || !box.checked; box.dispatchEvent(new Event('change'));
        }
      });
      button.dataset.attribute = attribute;
      $(`#${container}`).append(button);
    }
  }
}

function showCategory(category) {
  activeCategory = category;
  $('#brick-panel').hidden = category !== 'brick';
  $('#event-panel').hidden = category === 'brick' || category === 'tracks' || category === 'koshi';
  $('#koshi-panel').hidden = category !== 'koshi';
  $('#track-panel').hidden = category !== 'tracks';
  $('#cat-tracks').dataset.editable = String(category === 'tracks' && !readOnly());
  for (const button of $('#category-palette').children) {
    button.setAttribute('aria-pressed', String(button.dataset.category === category));
  }
}

function syncPalettes() {
  for (const [id, entry] of palettes) {
    const { select, palette } = entry, options = [...select.options];
    const signature = JSON.stringify(options.map(option => [option.value, option.textContent])) + (id === 'event-type' ? $('#event-kind').value : '');
    if (signature !== entry.signature) {
      entry.buttons = options.filter(option => option.value !== MIXED).map(option => {
        const button = choiceButton(option.value, option.textContent, id, () => {
          select.value = option.value; select.dispatchEvent(new Event('change'));
          syncPalettes();
        });
        button.dataset.value = option.value;
        return button;
      });
      palette.replaceChildren(...entry.buttons);
      if (id === 'event-type' && $('#event-kind').value === 'enemy') {
        const bosses = entry.buttons.filter(button => button.dataset.value === 'boss');
        if (bosses.length) {
          const section = document.createElement('section'), heading = document.createElement('h3');
          section.className = 'boss-palette-section';
          section.setAttribute('aria-label', 'Bosses');
          heading.textContent = 'Bosses';
          const choices = document.createElement('div');
          choices.className = 'visual-palette';
          choices.append(...bosses);
          section.append(heading, choices);
          palette.append(section);
        }
      }
      entry.signature = signature;
    }
    const inactive = id.startsWith('brick-') && id !== 'brick-kind' && select.disabled;
    select.parentElement.hidden = inactive; palette.hidden = inactive;
    for (const button of entry.buttons) {
      button.disabled = select.disabled;
      button.setAttribute('aria-pressed', String(select.value === button.dataset.value));
    }
  }
  for (const button of document.querySelectorAll('[data-attribute]')) {
    const attribute = button.dataset.attribute, box = attribute === 'plain' ? $('#brick-portal') : $(`#brick-${attribute}`);
    button.disabled = box.disabled;
    const plain = CONTACT_SURFACES.every(surface => !$(`#brick-${surface}`).checked && !$(`#brick-${surface}`).indeterminate);
    button.setAttribute('aria-pressed', attribute === 'plain' ? String(plain) : box.indeterminate ? 'mixed' : String(box.checked));
  }
  for (const id of ['brick-uses', 'brick-warp-seconds', 'brick-spawn-lifetime', 'brick-spawn-shield', 'brick-spawn-crab-direction']) $(`#${id}`).parentElement.hidden = $(`#${id}`).disabled;
}

function message(text, error = false) {
  $('#editor-message').textContent = text;
  $('#editor-message').dataset.error = String(error);
}

function attempt(action, onError) {
  try { action(); }
  catch (error) {
    console.error('Level editor:', error);
    message(error.message, true);
    if (onError) onError();
  }
}

function markChanged() {
  if (readOnly()) return;
  dirty = JSON.stringify(level) !== committed;
  updatePlaytest();
}

function updatePlaytest() {
  $('#playtest').href = campaignMode.gameURL('./index.html', readOnly()
    ? `#campaign=${encodeURIComponent(level.id)}`
    : `#level=${encodeURIComponent(JSON.stringify(level))}`);
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const common = values => values.every(value => value === values[0]) ? values[0] : MIXED;
const regionKey = region => `${region.edge}:${region.start}:${region.end}`;
const selectedList = () => [...selectedEvents].sort((a, b) => a - b);
const isAdditive = event => event.shiftKey || event.ctrlKey || event.metaKey || $('#additive-select').checked;

function mixedOption(select) {
  const option = document.createElement('option');
  option.value = MIXED; option.textContent = 'Mixed';
  select.prepend(option); select.value = MIXED;
}

function typeOptions(type, showLifetime) {
  const kind = $('#event-kind').value;
  const types = kind === MIXED ? [] : kind === 'food' ? Object.entries(FOODS).map(([key, food]) => [key, `${food.icon} ${food.name} (+${food.value})`])
    : kind === 'weapon' ? Object.entries(WEAPONS).map(([key, weapon]) => [key, weapon.name])
      : kind === 'item' ? Object.entries(ITEMS).map(([key, item]) => [key, item.name])
        : kind === 'object' ? Object.entries(OBJECTS).map(([key, item]) => [key, item.name])
        : Object.entries(CHARACTERS).filter(([key]) => !['koshi', 'tom'].includes(key));
  $('#event-type').replaceChildren(...types.map(([value, name]) => {
    const option = document.createElement('option');
    option.value = value; option.textContent = name;
    return option;
  }));
  if (kind === MIXED || type === MIXED) mixedOption($('#event-type'));
  else if (type) $('#event-type').value = type;
  const lifetime = showLifetime ?? ['food', 'item', 'weapon'].includes(kind);
  $('#lifetime-label').hidden = !lifetime;
  $('#event-lifetime').disabled = !lifetime;
  $('#event-lifetime').required = kind === 'food' && selectedEvents.size <= 1;
  $('#event-lifetime').placeholder = kind === 'food' ? '' : 'Until level ends';
  $('#event-lifetime').dataset.kind = kind;
  $('#shield-label').hidden = kind !== 'enemy' && kind !== MIXED;
  $('#event-shield').disabled = kind !== 'enemy' && kind !== MIXED;
  const crab = kind === 'enemy' && ($('#event-type').value === 'robo-crab'
    || (type === MIXED && [...selectedEvents].some(index => level.events[index].kind === 'enemy' && level.events[index].type === 'robo-crab')));
  $('#crab-direction-label').hidden = !crab;
  $('#event-crab-direction').disabled = !crab;
  $('#event-carrier-label').hidden = kind !== 'enemy' && kind !== MIXED;
  $('#event-carries-item').disabled = kind !== 'enemy' && kind !== MIXED;
  const chest = kind === 'item' && $('#event-type').value === 'treasure-chest';
  $('#chest-keys-label').hidden = !chest;
  $('#event-keys-required').disabled = !chest;
  const obstruction = kind === 'object' && OBJECTS[$('#event-type').value]?.obstruction;
  $('#event-obstruction').hidden = !obstruction;
  $('#event-obstruction').disabled = !obstruction;
  if (obstruction) syncObstructionSize('event', { type: $('#event-type').value });
}

function syncObstructionSize(prefix, item) {
  const rectangle = OBJECTS[item.type]?.obstruction === 'rectangle';
  const geometry = obstructionGeometry({ type: item.type });
  $(`#${prefix}-width`).placeholder = String(geometry.width);
  $(`#${prefix}-height`).placeholder = String(geometry.height);
  $(`#${prefix}-height`).parentElement.hidden = !rectangle;
}

function resetObstructionSize(prefix) {
  for (const field of ['width', 'height']) $(`#${prefix}-${field}`).value = '';
}

function populateObstructionFields(prefix, items) {
  for (const [field, fallback] of [['color', '#718596'], ['pattern', 'solid'], ['patternColor', '#dbe6ed']]) {
    const input = $(`#${prefix}-${field}`);
    const value = common(items.map(item => item[field] ?? fallback));
    input.title = value === MIXED ? 'Mixed: changing this field applies it to selected obstructions.' : '';
    if (field === 'pattern') {
      input.querySelector('option[value=""]')?.remove();
      if (value === MIXED) { mixedOption(input); continue; }
    }
    input.value = value === MIXED ? fallback : value;
  }
  for (const field of ['width', 'height']) {
    const input = $(`#${prefix}-${field}`);
    const value = common(items.map(item => item[field] ?? (field === 'width' && OBJECTS[item.type].obstruction !== 'rectangle' ? item.height : undefined) ?? ''));
    input.value = value === MIXED ? '' : value;
  }
  for (const field of ['destructible', 'spiked']) {
    const input = $(`#${prefix}-${field}`);
    input.checked = items.every(item => item[field]);
    input.indeterminate = items.some(item => item[field]) && !input.checked;
  }
  syncObstructionSize(prefix, items[0]);
}

function readObstructionFields(prefix) {
  const fields = Object.fromEntries(['color', 'pattern', 'patternColor'].map(field => [field, $(`#${prefix}-${field}`).value]));
  for (const field of ['width', 'height']) {
    const value = $(`#${prefix}-${field}`).value;
    if (value !== '') fields[field] = Number(value);
  }
  const type = prefix === 'event' ? $('#event-type').value : $('#brick-spawn-item').value.split(':')[1];
  if (OBJECTS[type]?.obstruction !== 'rectangle') {
    if (fields.width !== undefined) fields.height = fields.width;
    else delete fields.height;
  }
  for (const field of ['destructible', 'spiked']) {
    if ($(`#${prefix}-${field}`).checked) fields[field] = true;
  }
  return fields;
}

function setupObstructionColors() {
  for (const prefix of ['event', 'brick-spawn', 'brick-hazard']) for (const field of ['color', 'patternColor']) {
    const input = $(`#${prefix}-${field}`);
    const details = document.createElement('details'), summary = document.createElement('summary');
    summary.textContent = `100 ${field === 'color' ? 'base' : 'pattern'} color presets`;
    const palette = document.createElement('div');
    palette.className = 'obstruction-colors';
    palette.setAttribute('role', 'group');
    palette.setAttribute('aria-label', summary.textContent);
    for (const [index, color] of OBSTRUCTION_COLORS.entries()) {
      const button = document.createElement('button');
      button.type = 'button'; button.style.backgroundColor = color;
      button.title = `Color ${index + 1}: ${color}`;
      button.setAttribute('aria-label', button.title);
      button.addEventListener('click', () => {
        input.value = color;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      palette.append(button);
    }
    details.append(summary, palette);
    input.parentElement.after(details);
  }
}

function description(event) {
  return event.kind === 'food' ? `${FOODS[event.type].icon} ${FOODS[event.type].name}`
    : event.kind === 'weapon' ? WEAPONS[event.type].name
      : event.kind === 'item' ? ITEMS[event.type].name
        : event.kind === 'object' ? OBJECTS[event.type].name
        : `${CHARACTERS[event.type]}${event.shield ? ` · ${event.shield} shield (${SHIELDS[event.shield].hits} points)` : ''}${carriedItem(event) ? ` · carries ${ITEMS[carriedItem(event)]?.name ?? WEAPONS[carriedItem(event)]?.name ?? carriedItem(event)}` : ''}`;
}

function icon(event) {
  if (event.kind === 'enemy' && ['robo-snail', 'robo-cow', 'robo-unicorn', 'robo-crab', 'robo-love-bug', 'boss'].includes(event.type)) return picture(`enemy:${event.type}`, 'brick-spawn-item');
  return event.kind === 'food' ? FOODS[event.type].icon
    : event.kind === 'weapon' ? '⚔'
      : event.kind === 'item' ? ITEMS[event.type].icon
        : event.kind === 'heart' ? '♥'
        : event.kind === 'object' ? OBJECTS[event.type].icon
        : ({ mouse: '🐭', wheel: '⚙', ram: '🐏', bucket: '🪣', ball: '🏀', jackolantern: '🎃', snake: '🐍', goalie: '⚽', 'robo-koshi': '🤖' })[event.type];
}

function readEvent() {
  const event = {
    time: Number($('#event-time').value), kind: $('#event-kind').value, type: $('#event-type').value,
    x: Number($('#event-x').value) / 100, y: Number($('#event-y').value) / 100,
  };
  if (event.kind === 'food') event.lifetime = Number($('#event-lifetime').value);
  else if (['item', 'weapon'].includes(event.kind) && $('#event-lifetime').value !== '') {
    event.lifetime = Number($('#event-lifetime').value);
  }
  if (event.kind === 'enemy') event.shield = $('#event-shield').value === 'none' ? null : $('#event-shield').value;
  if (event.kind === 'enemy' && event.type === 'robo-crab'
    && ['horizontal', 'vertical'].includes($('#event-crab-direction').value)) event.crabDirection = $('#event-crab-direction').value;
  if (event.kind === 'enemy' && $('#event-carries-item').value) event.carriesItem = $('#event-carries-item').value;
  if (event.kind === 'item' && event.type === 'treasure-chest') {
    event.keysRequired = Number($('#event-keys-required').value || $('#event-keys-required').placeholder || 1);
  }
  if (event.kind === 'object' && OBJECTS[event.type]?.obstruction) Object.assign(event, readObstructionFields('event'));
  if ($('#event-location').value === 'random') {
    event.random = true; delete event.x; delete event.y;
  }
  if ($('#event-formation').value !== 'single') {
    event.group = { shape: $('#event-formation').value, count: Number($('#event-count-input').value) };
    if ($('#event-group-size').value !== '') event.group.size = Number($('#event-group-size').value) / 100;
    if (event.group.shape === 'line') event.group.angle = Number($('#event-group-angle').value);
  }
  if (event.random && !event.group
    && Number($('#event-random-count').value) > 1) event.randomCount = Number($('#event-random-count').value);
  if (!event.random && !event.group && event.kind === 'enemy' && ['wheel', 'snake', 'robo-cow'].includes(event.type)) Object.assign(event, snapWheel(event.x, event.y));
  return event;
}

function updateEventPlacement() {
  const shape = $('#event-formation').value;
  const grouped = shape === 'line' || shape === 'circle';
  $('#event-group-options').hidden = !grouped;
  for (const id of ['#event-count-input', '#event-group-size']) $(id).disabled = !grouped;
  $('#event-count-input').required = grouped;
  $('#event-angle-label').hidden = shape !== 'line';
  $('#event-group-angle').disabled = shape !== 'line';
  $('#event-group-angle').required = shape === 'line';
  $('#event-size-label').textContent = shape === 'circle' ? 'Diameter (%)' : 'Length (%)';
  const random = $('#event-location').value === 'random';
  $('#event-position').hidden = random;
  const randomCountEnabled = random && shape === 'single';
  $('#event-random-count-label').hidden = !randomCountEnabled;
  $('#event-random-count').disabled = !randomCountEnabled;
  for (const id of ['#event-x', '#event-y']) {
    $(id).disabled = random;
    $(id).required = !random && selectedEvents.size <= 1;
  }
}

// Multi-event edits show shared values and mark differing fields as "Mixed".
function populateEventForm() {
  const indices = selectedList(), items = indices.map(index => level.events[index]);
  const multi = items.length > 1;
  const numbers = { '#event-time': 0, '#event-lifetime': 5, '#event-x': 50, '#event-y': 50 };
  touched.clear();
  $('#event-shield').querySelector('option[value=""]')?.remove();
  const shields = items.filter(event => event.kind === 'enemy').map(event => event.shield ?? 'none');
  if (shields.length && common(shields) === MIXED) mixedOption($('#event-shield'));
  else $('#event-shield').value = shields[0] ?? 'none';
  const directions = items.filter(event => event.kind === 'enemy' && event.type === 'robo-crab').map(event => event.crabDirection ?? 'random');
  $('#event-crab-direction').querySelector('option[value=""]')?.remove();
  if (directions.length && common(directions) === MIXED) mixedOption($('#event-crab-direction'));
  else $('#event-crab-direction').value = directions[0] ?? 'random';
  const carriers = items.filter(event => event.kind === 'enemy')
    .map(event => event.carriesItem ?? (event.carriesCatBlock ? 'cat-block' : event.carriesKey ? 'key' : ''));
  const carrierMixed = carriers.some(item => item !== carriers[0]);
  $('#event-carries-item').querySelector('option[value="__mixed-carried-item__"]')?.remove();
  if (carrierMixed) {
    const option = document.createElement('option');
    option.value = '__mixed-carried-item__'; option.textContent = 'Mixed';
    $('#event-carries-item').prepend(option);
    $('#event-carries-item').value = '__mixed-carried-item__';
  }
  else $('#event-carries-item').value = carriers[0] ?? '';
  const chestRequirements = items.filter(event => event.kind === 'item' && event.type === 'treasure-chest')
    .map(event => event.keysRequired ?? 1);
  $('#event-keys-required').value = chestRequirements.length && common(chestRequirements) !== MIXED
    ? common(chestRequirements) : 1;
  $('#event-keys-required').placeholder = chestRequirements.length && common(chestRequirements) === MIXED ? 'Mixed' : '';
  $('#event-kind').querySelector('option[value=""]')?.remove();
  for (const id of Object.keys(numbers)) { $(id).required = !multi; $(id).placeholder = ''; }
  if (items.length) {
    const setNumber = (id, values, factor = 1) => {
      const value = common(values);
      $(id).value = value === MIXED ? '' : value * factor;
      $(id).placeholder = value === MIXED ? 'Mixed' : '';
    };
    const kind = common(items.map(event => event.kind));
    const collectibles = items.filter(event => ['food', 'item', 'weapon'].includes(event.kind));
    if (kind === MIXED) mixedOption($('#event-kind')); else $('#event-kind').value = kind;
    typeOptions(kind === MIXED ? MIXED : common(items.map(event => event.type)), collectibles.length > 0);
    setNumber('#event-time', items.map(event => event.time));
    setNumber('#event-x', items.map(event => event.x ?? .5), 100);
    setNumber('#event-y', items.map(event => event.y ?? .5), 100);
    if (collectibles.length) {
      const lifetime = common(collectibles.map(event => event.lifetime ?? ''));
      $('#event-lifetime').value = lifetime === MIXED ? '' : lifetime;
      $('#event-lifetime').placeholder = lifetime === MIXED && collectibles.some(event => event.lifetime != null) ? 'Mixed' : kind === 'food' ? '' : 'Until level ends';
    }
    if (common(items.map(event => event.time)) !== MIXED) $('#timeline').value = items[0].time;
  } else {
    typeOptions($('#event-type').value || undefined);
  }
  const obstructions = items.filter(event => event.kind === 'object' && OBJECTS[event.type]?.obstruction);
  if (obstructions.length) {
    $('#event-obstruction').hidden = false;
    $('#event-obstruction').disabled = false;
    populateObstructionFields('event', obstructions);
  }
  if (!multi) for (const [id, fallback] of Object.entries(numbers)) {
    if ($(id).value === '' && (id !== '#event-lifetime' || $('#event-kind').value === 'food')) $(id).value = fallback;
  }
  for (const [id, values] of [
    ['#event-location', items.map(event => event.random ? 'random' : 'fixed')],
    ['#event-formation', items.map(event => event.group?.shape ?? 'single')],
  ]) {
    $(id).querySelector('option[value=""]')?.remove();
    const value = items.length ? common(values) : $(id).value || (id === '#event-location' ? 'fixed' : 'single');
    if (value === MIXED) mixedOption($(id)); else $(id).value = value;
  }
  for (const [id, values, fallback] of [
    ['#event-count-input', items.map(event => event.group?.count ?? 5), 5],
    ['#event-group-size', items.map(event => event.group?.size === undefined ? '' : event.group.size * 100), ''],
    ['#event-group-angle', items.map(event => event.group?.angle ?? 0), 0],
    ['#event-random-count', items.map(event => event.randomCount ?? 1), 1],
  ]) {
    const value = items.length ? common(values) : $(id).value || fallback;
    $(id).value = value === MIXED ? '' : value;
    $(id).placeholder = value === MIXED ? 'Mixed' : id === '#event-group-size' ? 'Auto' : '';
  }
  updateEventPlacement();
  $('#inspector-heading').textContent = readOnly() ? !items.length ? 'READ-ONLY GAME LEVEL'
    : multi ? `VIEWING ${items.length} EVENTS` : `VIEWING EVENT ${indices[0] + 1}`
    : !items.length ? 'NEW PLACEMENT' : multi ? `EDITING ${items.length} EVENTS` : `EDITING EVENT ${indices[0] + 1}`;
  $('#duplicate-event').disabled = !items.length;
  $('#delete-event').disabled = !items.length;
  $('#duplicate-event').textContent = multi ? `Duplicate ${items.length}` : 'Duplicate';
  $('#delete-event').textContent = multi ? `Delete ${items.length}` : 'Delete';
  syncPalettes();
}

function setSelection(events = selectedEvents, bricks = selectedBricks) {
  selectedEvents = new Set(events);
  selectedBricks = new Set(bricks);
  if (selectedEvents.size) placing = false;
  if (selectedBricks.size && !selectedEvents.size) showCategory('brick');
  else if (selectedEvents.size) showCategory(common(selectedList().map(index => level.events[index].kind)));
  populateEventForm(); render();
}

function toggled(set, value) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

function choose(kind, value, additive) {
  if (kind === 'event') setSelection(additive ? toggled(selectedEvents, value) : [value], additive ? selectedBricks : []);
  else setSelection(additive ? selectedEvents : [], additive ? toggled(selectedBricks, value) : [value]);
}

function selectAll() {
  setSelection(level.events.map((_, index) => index), previewGame.bricks.filter(brick => brick.absorbedBy === null).map(brick => regionKey(brick.region)));
}

function renderList() {
  const list = $('#event-list');
  list.replaceChildren();
  $('#event-count').textContent = plural(level.events.length, 'event');
  if (!level.events.length) {
    const li = document.createElement('li'); li.className = 'empty-state';
    li.textContent = 'No events yet. Place your first object on the board.'; list.append(li);
  }
  level.events.map((event, index) => ({ event, index })).sort((a, b) => a.event.time - b.event.time).forEach(({ event, index }) => {
    const li = document.createElement('li'), button = document.createElement('button');
    button.type = 'button'; button.setAttribute('aria-pressed', String(selectedEvents.has(index)));
    button.dataset.kind = event.kind;
    const time = document.createElement('span'); time.className = 'event-time'; time.textContent = `${event.time}s`;
    const location = document.createElement('span'); location.className = 'event-location';
    location.textContent = `${event.random ? 'Random location' : `X ${(event.x * 100).toFixed(1)}% · Y ${(event.y * 100).toFixed(1)}%`}${event.randomCount ? ` · ${event.randomCount} independent placements` : ''}${event.group ? ` · ${event.group.count} in ${event.group.shape}${event.group.size === undefined ? '' : ` · ${event.group.size * 100}%`}${event.group.shape === 'line' ? ` · ${event.group.angle ?? 0} degrees` : ''}` : ''}${['food', 'item', 'weapon'].includes(event.kind) ? event.lifetime == null ? ' · until level ends' : ` · lasts ${event.lifetime}s` : event.kind === 'object' ? OBJECTS[event.type].obstruction ? ` · fixed, ${event.pattern ?? 'solid'}` : event.type === 'soccer-ball' ? ' · persistent, kickable' : ' · persistent' : ''} · #${index + 1}`;
    const category = document.createElement('span'); category.className = 'event-category';
    category.textContent = event.kind;
    button.append(time, category);
    if (event.kind !== 'food') {
      const artwork = picture(`${event.kind}:${event.type}`, 'brick-spawn-item');
      artwork.classList.add('event-icon');
      artwork.setAttribute('aria-hidden', 'true');
      button.append(artwork);
    }
    button.append(description(event), location);
    if (['food', 'enemy', 'weapon'].includes(event.kind)) {
      const totals = pointReference([event], []);
      const amount = event.kind === 'weapon' ? totals.weaponHits : totals[event.kind];
      const label = event.kind === 'weapon' && WEAPONS[event.type].ropeDart ? 'weapon shots'
        : { food: 'food points', enemy: 'enemy points', weapon: 'weapon strikes' }[event.kind];
      const badge = document.createElement('span');
      badge.className = 'event-points';
      const strikes = amount === Infinity ? 'Unlimited (timed)' : String(amount);
      badge.textContent = strikes;
      badge.setAttribute('aria-label', `${strikes} ${label}`);
      badge.title = `${strikes} ${label}`;
      button.append(badge);
    }
    button.addEventListener('click', click => choose('event', index, isAdditive(click)));
    li.append(button); list.append(li);
  });
}

function renderBrickInspector(bricks) {
  const regions = brickEditRegions(previewGame.bricks);
  const displayedRegions = brickRegions(previewGame.bricks, previewGame.width, previewGame.height);
  const chosen = bricks.filter(brick => brick.absorbedBy === null && selectedBricks.has(regionKey(regions.get(brick.id))));
  $('#combine-bricks').disabled = chosen.length < 2 || (chosen.some(brick => immutableBrick(brick.kind)) && common(chosen.map(brick => brick.kind)) === MIXED);
  $('#split-bricks').disabled = !chosen.some(brick => (level.brickGroups ?? []).some(group => group.owner === brick.id));
  $('#combine-owner-panel').hidden = chosen.length < 2;
  if (!chosen.some(brick => brick.id === combineOwner)) combineOwner = chosen[0]?.id ?? null;
  $('#combine-owner-options').replaceChildren(...chosen.map(brick => {
    const button = choiceButton(brick.kind, `Brick ${brick.id + 1} · ${brick.kind}`, 'brick-kind', () => {
      combineOwner = brick.id; renderBrickInspector(previewGame.bricks);
    });
    button.setAttribute('aria-pressed', String(combineOwner === brick.id));
    button.title = `Brick ${brick.id + 1}: ${brick.kind}${specialLabel(brick)}`;
    return button;
  }));
  const inert = chosen.some(brick => immutableBrick(brick.kind));
  const spawns = chosen.map(brick => brick.spawner).filter(Boolean);
  $('#brick-spawn-position').disabled = inert || !spawns.length;
  const fixed = spawns.filter(spawn => spawn.x !== undefined);
  $('#brick-spawn-fixed').checked = !!spawns.length && fixed.length === spawns.length;
  $('#brick-spawn-fixed').indeterminate = !!fixed.length && fixed.length !== spawns.length;
  for (const field of ['x', 'y']) {
    const input = $(`#brick-spawn-${field}`);
    const value = common(fixed.map(spawn => spawn[field]));
    input.value = fixed.length ? value === MIXED ? '' : value * 100 : 50;
    input.placeholder = fixed.length && value === MIXED ? 'Mixed' : '';
    input.disabled = inert || !fixed.length;
  }
  $('#connect-spawn').disabled = inert || chosen.length !== 1 || !spawns.length;
  if (!chosen.some(brick => regionKey(regions.get(brick.id)) === connectingSpawn)) connectingSpawn = null;
  $('#connect-spawn').setAttribute('aria-pressed', String(connectingSpawn !== null));
  $('#connect-spawn').textContent = connectingSpawn === null ? 'Connect placed object' : 'Cancel connection';
  for (const [selector, enabled, values, fallback] of [
    ['#brick-portal-color', chosen.some(brick => brick.portal), chosen.map(brick => brick.portal).filter(Boolean), 'red'],
    ['#brick-toggle-clicks', chosen.some(brick => brick.toggle), chosen.map(brick => brick.toggle).filter(Boolean).map(String), '1'],
    ['#brick-spawn-item', chosen.some(brick => brick.spawner), chosen.filter(brick => brick.spawner).map(brick => `${brick.spawner.kind}:${brick.spawner.type}`), 'food:S'],
  ]) {
    const input = $(selector);
    input.querySelector('option[value=""]')?.remove();
    input.disabled = inert || !enabled;
    const value = values.length ? common(values) : fallback;
    if (value === MIXED) mixedOption(input); else input.value = value;
  }
  const lifetimes = chosen.filter(brick => ['food', 'item', 'weapon'].includes(brick.spawner?.kind)).map(brick => brick.spawner.lifetime ?? '');
  $('#brick-spawn-lifetime').disabled = inert || !lifetimes.length;
  $('#brick-spawn-lifetime').value = lifetimes.length && common(lifetimes) === MIXED ? '' : lifetimes[0] ?? '';
  $('#brick-spawn-lifetime').placeholder = lifetimes.length && common(lifetimes) === MIXED && lifetimes.some(value => value !== '') ? 'Mixed' : 'Until level ends';
  const shields = chosen.filter(brick => brick.spawner?.kind === 'enemy').map(brick => brick.spawner.shield ?? 'none');
  $('#brick-spawn-shield').querySelector('option[value=""]')?.remove();
  $('#brick-spawn-shield').disabled = inert || !shields.length;
  if (shields.length && common(shields) === MIXED) mixedOption($('#brick-spawn-shield'));
  else $('#brick-spawn-shield').value = shields[0] ?? 'none';
  const directions = chosen.filter(brick => brick.spawner?.kind === 'enemy' && brick.spawner.type === 'robo-crab')
    .map(brick => brick.spawner.crabDirection ?? 'random');
  $('#brick-spawn-crab-direction').querySelector('option[value=""]')?.remove();
  $('#brick-spawn-crab-direction').disabled = inert || !directions.length;
  if (directions.length && common(directions) === MIXED) mixedOption($('#brick-spawn-crab-direction'));
  else $('#brick-spawn-crab-direction').value = directions[0] ?? 'random';
  const obstructions = chosen.map(brick => brick.spawner).filter(spawn => spawn?.kind === 'object' && OBJECTS[spawn.type]?.obstruction);
  $('#brick-spawn-obstruction').hidden = inert || !obstructions.length;
  $('#brick-spawn-obstruction').disabled = inert || !obstructions.length;
  if (obstructions.length) populateObstructionFields('brick-spawn', obstructions);
  const turrets = chosen.map(brick => brick.turret).filter(Boolean);
  $('#brick-turret-type').disabled = inert || !turrets.length;
  $('#brick-turret-type').value = turrets.length && common(turrets) === MIXED ? '' : turrets[0] ?? 'laser';
  if ($('#brick-turret-type').parentElement) $('#brick-turret-type').parentElement.hidden = !turrets.length || inert;
  const hazards = chosen.map(brick => brick.hazard).filter(Boolean);
  for (const [selector, values, fallback] of [
    ['#brick-hazard-type', hazards.map(hazard => hazard.type), 'laser'],
    ['#brick-hazard-power', hazards.map(hazard => hazard.power ?? 'none'), 'none'],
  ]) {
    const input = $(selector);
    input.querySelector('option[value=""]')?.remove();
    input.disabled = inert || !hazards.length;
    if (values.length && common(values) === MIXED) mixedOption(input);
    else input.value = values[0] ?? fallback;
    input.parentElement.hidden = inert || !hazards.length;
  }
  const intervals = hazards.filter(hazard => globalThis.KoshiGame.HAZARDS[hazard.type].interval)
    .map(hazard => hazard.interval ?? globalThis.KoshiGame.HAZARDS[hazard.type].interval);
  $('#brick-hazard-interval').disabled = inert || !intervals.length;
  $('#brick-hazard-interval').value = intervals.length && common(intervals) === MIXED ? '' : intervals[0] ?? 10;
  $('#brick-hazard-interval').placeholder = intervals.length && common(intervals) === MIXED ? 'Mixed' : '';
  $('#brick-hazard-interval').parentElement.hidden = inert || !intervals.length;
  const obstructors = hazards.filter(hazard => globalThis.KoshiGame.HAZARDS[hazard.type].appearance);
  $('#brick-hazard-obstruction').hidden = inert || !obstructors.length;
  $('#brick-hazard-obstruction').disabled = inert || !obstructors.length;
  for (const [field, fallback] of [['color', '#718596'], ['pattern', 'solid'], ['patternColor', '#dbe6ed']]) {
    if (!obstructors.length) break;
    const input = $(`#brick-hazard-${field}`), value = common(obstructors.map(hazard => hazard[field] ?? fallback));
    input.title = value === MIXED ? 'Mixed: changing this field applies it to every selected Obstructor Gun.' : '';
    if (field === 'pattern') {
      input.querySelector('option[value=""]')?.remove();
      if (value === MIXED) { mixedOption(input); continue; }
    }
    input.value = value === MIXED ? fallback : value;
  }
  $('#brick-kind').querySelector('option[value=""]')?.remove();
  $('#brick-slime-color').querySelector('option[value=""]')?.remove();
  $('#brick-slime-color').disabled = inert || !chosen.some(brick => brick.slimed);
  $('#brick-conveyor-direction').querySelector('option[value=""]')?.remove();
  $('#brick-conveyor-direction').disabled = inert || !chosen.some(brick => brick.conveyor);
  if (chosen.length) {
    const direction = common(chosen.map(brick => brick.conveyorDirection ?? 'clockwise'));
    if (direction === MIXED) mixedOption($('#brick-conveyor-direction')); else $('#brick-conveyor-direction').value = direction;
  }
  if (chosen.length) {
    const color = common(chosen.map(brick => brick.slimeColor ?? 'green'));
    if (color === MIXED) mixedOption($('#brick-slime-color')); else $('#brick-slime-color').value = color;
  }
  if (!chosen.length) {
    for (const selector of ['#brick-kind', '#brick-crumbler', '#brick-uses', '#brick-warped', '#brick-warp-seconds', '#brick-slimed', '#brick-springs', '#brick-spikes', '#brick-conveyor', '#brick-portal', '#brick-spawner', '#brick-boost', '#brick-barrier', '#brick-turret', '#brick-turret-type', '#brick-toggle', '#brick-power', '#brick-hazard']) $(selector).disabled = true;
    for (const selector of ['#brick-crumbler', '#brick-warped', '#brick-slimed', '#brick-springs', '#brick-spikes', '#brick-conveyor', '#brick-portal', '#brick-spawner', '#brick-boost', '#brick-barrier', '#brick-turret', '#brick-toggle', '#brick-power']) $(selector).indeterminate = false;
    $('#brick-selection').textContent = '';
    return;
  }
  const kind = common(chosen.map(brick => brick.kind));
  $('#brick-kind').disabled = false;
  if (kind === MIXED) mixedOption($('#brick-kind')); else $('#brick-kind').value = kind;
  const flag = (box, input, values, fallback) => {
    const on = values.filter(Boolean), value = on.length ? common(on) : fallback;
    $(box).disabled = inert;
    $(box).checked = on.length === values.length;
    $(box).indeterminate = on.length > 0 && on.length < values.length;
    $(input).disabled = inert || !on.length;
    $(input).value = value === MIXED ? '' : value;
    $(input).placeholder = value === MIXED ? 'Mixed' : '';
  };
  flag('#brick-crumbler', '#brick-uses', chosen.map(brick => brick.crumbler), 5);
  flag('#brick-warped', '#brick-warp-seconds', chosen.map(brick => brick.warped), 15);
  for (const attribute of [...CONTACT_SURFACES, 'toggle', 'power']) {
    const box = $(`#brick-${attribute}`), count = chosen.filter(brick => brick[attribute]).length;
    box.disabled = inert;
    box.checked = count === chosen.length;
    box.indeterminate = count > 0 && count < chosen.length;
  }
  if (chosen.length === 1) {
    const [brick] = chosen;
    $('#brick-selection').textContent = `${displayedRegions.get(brick.id).edge} edge · brick ${brick.id + 1} · ${brick.kind} (${immutableBrick(brick.kind) ? 'solid, cannot activate' : `${COOLDOWNS[brick.kind]}s`})`;
  } else {
    const edges = [...new Set(chosen.map(brick => displayedRegions.get(brick.id).edge))].join(', ');
    $('#brick-selection').textContent = `${chosen.length} bricks selected · ${edges} · ${kind === MIXED ? 'mixed types' : `all ${kind} (${immutableBrick(kind) ? 'solid, cannot activate' : `${COOLDOWNS[kind]}s`})`}`;
  }
}

function renderBoard() {
  const portrait = $('#orientation').value === 'portrait';
  board.dataset.orientation = portrait ? 'portrait' : 'landscape';
  board.dataset.fullGrid = String($('#full-grid').checked);
  $('#editor-board-scroll').dataset.orientation = board.dataset.orientation;
  const availableWidth = $('#editor-board-scroll').clientWidth;
  const screenWidth = portrait ? Math.min(availableWidth, 340) : availableWidth;
  const screenHeight = screenWidth * (portrait ? 8 / 5 : 5 / 8);
  syncTool();
  previewGame = new Game(Math.random, { portrait, scale: portrait ? screenWidth / 600 : 1,
    ...(readOnly() ? { level: campaignIndex } : { customLevel: level }), editorPreview: true });
  renderPointReference(level.events, previewGame.bricks);
  board.style.width = `${screenWidth * previewGame.width / previewGame.viewportWidth}px`;
  board.style.height = `${screenHeight * previewGame.height / previewGame.viewportHeight}px`;
  board.style.aspectRatio = 'auto';
  const issues = portalPairIssues(previewGame.bricks);
  $('#portal-warning').hidden = !issues.length;
  $('#portal-warning').textContent = issues.length ? `Unfinished portals: ${issues.join(' ')} You can keep editing; fix these before printing JSON or playtesting.` : '';
  $('#playtest').setAttribute('aria-disabled', String(Boolean(issues.length)));
  const bricks = $('#editor-bricks');
  const regions = brickEditRegions(previewGame.bricks);
  const displayedRegions = brickRegions(previewGame.bricks, previewGame.width, previewGame.height);
  const parts = previewGame.brickParts();
  bricks.replaceChildren(...previewGame.bricks.filter(brick => brick.absorbedBy === null).map(brick => {
    const members = parts.filter(part => part.id === brick.id);
    const merged = members.length > 1;
    const shape = brickShape(members, Boolean(brick.crumbler));
    const body = brick.spikes ? brickSpikes(members, previewGame.width, previewGame.height, Boolean(brick.crumbler)).body : shape;
    const element = document.createElement('button');
    const key = regionKey(regions.get(brick.id));
    const displayedEdge = displayedRegions.get(brick.id).edge;
    element.type = 'button';
    element.className = 'editor-brick';
    element.classList.toggle('crumbler', Boolean(brick.crumbler));
    element.classList.toggle('warped', Boolean(brick.warped));
    element.classList.toggle('slimed', Boolean(brick.slimed));
    element.classList.toggle('springs', Boolean(brick.springs));
    element.dataset.id = brick.id;
    element.dataset.region = key;
    element.setAttribute('aria-label', `${displayedEdge} brick ${brick.id + 1}: ${brick.kind}, ${immutableBrick(brick.kind) ? 'solid, cannot activate' : `${COOLDOWNS[brick.kind]} second cooldown`}${brick.crumbler ? `, Crumbler ${brick.crumbler} selections` : ''}${brick.warped ? `, Warped ${brick.warped} seconds` : ''}${brick.slimed ? `, ${brick.slimeColor ?? 'green'} slime: sticks for ${SLIMES[brick.slimeColor ?? 'green'].duration} seconds` : ''}${brick.springs ? ', Springs: reflects Koshi' : ''}${brick.spikes ? ', Spikes: loses one heart on contact' : ''}${brick.conveyor ? `, Conveyor: carries Koshi ${brick.conveyorDirection ?? 'clockwise'}` : ''}`);
    element.setAttribute('aria-pressed', String(selectedBricks.has(key)));
    element.setAttribute('aria-label', element.getAttribute('aria-label') + specialLabel(brick));
    // Pointer clicks are handled by the board gesture; detail 0 means keyboard activation.
    element.addEventListener('click', event => {
      event.stopPropagation();
      if (event.detail !== 0) return;
      choose('brick', key, isAdditive(event));
      focusBrick(key);
    });
    element.style.cssText = `left:${shape.x / previewGame.width * 100}%;top:${shape.y / previewGame.height * 100}%;width:${shape.w / previewGame.width * 100}%;height:${shape.h / previewGame.height * 100}%;--brick-color:${{ normal: '#83bca1', slow: '#7eacdb', fast: '#df8c81', cinder: '#969b99', goal: '#f1f3f2' }[brick.kind]};background-color:var(--brick-fill, var(--brick-color))`;
    if (brick.crumbler || merged) element.style.clipPath = shape.roundedClipPath;
    if (merged) element.classList.add('editor-brick-merged');
    if (brick.spikes) element.style.clipPath = body.roundedClipPath;
    const special = decorateBrick(element, brick, members, previewGame.width, previewGame.height,
      brick.turret || brick.portal || brick.hazard ? previewGame.groupSource(brick) : null,
      brick.portal ? previewGame.portalExit(brick, parts) : null);
    if (brick.slimed || brick.springs || brick.spikes || merged) {
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
      element.append(svg);
      if (brick.springs) {
        const spring = svg.cloneNode(false);
        spring.setAttribute('class', 'brick-spring');
        const platform = path.cloneNode();
        platform.setAttribute('class', 'spring-platform');
        const geometry = brickSpring(members, previewGame.width, previewGame.height);
        platform.setAttribute('d', geometry.platform);
        spring.append(platform);
        for (const detail of ['grain', 'highlight']) {
          const texture = path.cloneNode();
          texture.setAttribute('class', `spring-${detail}`);
          texture.setAttribute('d', geometry[detail]);
          spring.append(texture);
        }
        element.append(spring);
      }
      if (brick.slimed) {
        const slime = svg.cloneNode(false);
        slime.setAttribute('class', 'brick-slime');
        slime.style.setProperty('--slime-color', SLIMES[brick.slimeColor ?? 'green'].color);
        const icing = path.cloneNode();
        icing.setAttribute('d', brickSlime(members, previewGame.width, previewGame.height));
        slime.append(icing);
        element.append(slime);
      }
    }
    const spring = element.querySelector('.brick-spring');
    if (spring) {
      spring.style.cssText = `left:${shape.x / previewGame.width * 100}%;top:${shape.y / previewGame.height * 100}%;width:${shape.w / previewGame.width * 100}%;height:${shape.h / previewGame.height * 100}%;`;
      const fragment = document.createDocumentFragment();
      fragment.append(element, spring);
      exposeBrickInfo(special, fragment, brick, previewGame.width, previewGame.height);
      return fragment;
    }
    if (brick.spikes) {
      const ns = 'http://www.w3.org/2000/svg';
      const spikes = document.createElementNS(ns, 'svg');
      spikes.setAttribute('class', 'brick-spikes');
      spikes.setAttribute('viewBox', '0 0 1 1');
      spikes.setAttribute('preserveAspectRatio', 'none');
      spikes.setAttribute('aria-hidden', 'true');
      spikes.style.cssText = `left:${shape.x / previewGame.width * 100}%;top:${shape.y / previewGame.height * 100}%;width:${shape.w / previewGame.width * 100}%;height:${shape.h / previewGame.height * 100}%;`;
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', brickSpikes(members, previewGame.width, previewGame.height).path);
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      spikes.append(path);
      const fragment = document.createDocumentFragment();
      fragment.append(element, spikes);
      exposeBrickInfo(special, fragment, brick, previewGame.width, previewGame.height);
      return fragment;
    }
    if (brick.conveyor) {
      const ns = 'http://www.w3.org/2000/svg';
      const conveyor = document.createElementNS(ns, 'svg');
      conveyor.setAttribute('class', 'brick-conveyor');
      conveyor.setAttribute('viewBox', '0 0 1 1');
      conveyor.setAttribute('preserveAspectRatio', 'none');
      conveyor.setAttribute('aria-hidden', 'true');
      conveyor.style.cssText = `left:${shape.x / previewGame.width * 100}%;top:${shape.y / previewGame.height * 100}%;width:${shape.w / previewGame.width * 100}%;height:${shape.h / previewGame.height * 100}%;`;
      const geometry = brickConveyor(members, previewGame.width, previewGame.height, 0, brick.conveyorDirection);
      for (const detail of ['belt', 'teeth', 'arrows']) {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('class', `conveyor-${detail}`);
        path.setAttribute('d', geometry[detail]);
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        conveyor.append(path);
      }
      const fragment = document.createDocumentFragment();
      fragment.append(element, conveyor);
      exposeBrickInfo(special, fragment, brick, previewGame.width, previewGame.height);
      return fragment;
    }
    if (special.cloud || special.info) {
      const fragment = document.createDocumentFragment();
      fragment.append(element);
      exposePortalCloud(special, fragment);
      exposeBrickInfo(special, fragment, brick, previewGame.width, previewGame.height);
      return fragment;
    }
    return element;
  }));
  renderBrickInspector(previewGame.bricks);
  syncPalettes();
  const b = previewGame.bounds();
  renderKoshiStart();
  $('#playable-area').style.cssText = `left:${b.left / previewGame.width * 100}%;top:${b.top / previewGame.height * 100}%;width:${(b.right - b.left) / previewGame.width * 100}%;height:${(b.bottom - b.top) / previewGame.height * 100}%`;
  const alignmentGuides = $('#alignment-guides');
  alignmentGuides.setAttribute('viewBox', `0 0 ${previewGame.width} ${previewGame.height}`);
  alignmentGuides.replaceChildren();
  const movingPoints = gesture?.type === 'marker' && gesture.moved
    ? selectedList().flatMap(index => previewGame.customEventPoints(level.events[index], { preview: true })) : [];
  if ($('#full-grid').checked && movingPoints.length) {
    const coordinates = new Set();
    const addGuide = (axis, coordinate) => {
      const key = `${axis}:${coordinate.toFixed(2)}`;
      if (coordinates.has(key)) return;
      coordinates.add(key);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      if (axis === 'vertical') {
        line.setAttribute('x1', coordinate); line.setAttribute('x2', coordinate);
        line.setAttribute('y1', b.top); line.setAttribute('y2', b.bottom);
      } else {
        line.setAttribute('x1', b.left); line.setAttribute('x2', b.right);
        line.setAttribute('y1', coordinate); line.setAttribute('y2', coordinate);
      }
      alignmentGuides.append(line);
    };
    for (const point of movingPoints) {
      addGuide('vertical', point.x);
      addGuide('horizontal', point.y);
    }
  }
  const summary = [selectedBricks.size && plural(selectedBricks.size, 'brick'), selectedEvents.size && plural(selectedEvents.size, 'event')].filter(Boolean);
  $('#selection-summary').textContent = summary.length ? `${summary.join(' + ')} selected` : 'Nothing selected';
  $('#clear-selection').disabled = !summary.length;
  const markers = $('#markers'); markers.replaceChildren();
  renderCatTracks();
  const templates = spawnTemplates();
  renderSpawnLinks(templates);
  [...level.events.map((event, index) => ({ event, index })), ...templates]
    .filter(({ event }) => $('#show-random').checked || !(event.random || event.previewRandom))
    .flatMap(entry => previewGame.customEventPoints(entry.event, { preview: true }).map(point => ({ ...entry, point })))
    .forEach(({ event, index, spawnKey, point }) => {
    const marker = document.createElement('button');
    marker.className = spawnKey ? 'marker spawn-template' : 'marker';
    marker.type = 'button'; marker.dataset.kind = event.kind;
    if (spawnKey) marker.dataset.spawnKey = spawnKey;
    else {
      marker.dataset.index = index;
      marker.dataset.previewStart = event.time;
      if (event.lifetime != null) marker.dataset.previewEnd = event.time + event.lifetime;
    }
    marker.style.left = `${point.x / previewGame.width * 100}%`; marker.style.top = `${point.y / previewGame.height * 100}%`;
    marker.style.color = event.kind === 'weapon' ? WEAPONS[event.type].color : '';
    if (event.shield) marker.style.boxShadow = `0 0 0 3px ${SHIELDS[event.shield].color}`;
    const selected = spawnKey ? selectedBricks.has(spawnKey) : selectedEvents.has(index);
    if (!selected && movingPoints.length) {
      const axes = alignmentAxes(point, movingPoints, 3 * previewGame.width / board.clientWidth,
        3 * previewGame.height / board.clientHeight);
      marker.classList.toggle('alignment-highlight', axes.vertical || axes.horizontal);
    }
    marker.setAttribute('aria-label', spawnKey ? `Spawn template: ${event.kind === 'heart' ? 'Heart' : description(event)}` : `Event ${index + 1}: ${description(event)} at ${event.time}s`);
    marker.setAttribute('aria-pressed', String(selected));
    const label = document.createElement('small'); label.textContent = spawnKey ? 'Spawn only' : `${event.time}s${event.random || event.previewRandom ? ' · random' : ''}`;
    if (event.kind === 'object' && OBJECTS[event.type].bumper) {
      const bumper = previewGame.createBumper(point, event.type);
      const frameSize = bumper.radius * 2 + 4;
      marker.classList.add('bumper-marker');
      marker.style.width = `${frameSize / previewGame.width * 100}%`;
      marker.style.height = `${frameSize / previewGame.height * 100}%`;
      const image = document.createElement('canvas');
      image.width = frameSize; image.height = frameSize;
      image.setAttribute('aria-hidden', 'true');
      drawBumper(image.getContext('2d'), { ...bumper, x: frameSize / 2, y: frameSize / 2 });
      marker.append(image, label);
    } else if (event.kind === 'object' && OBJECTS[event.type].catCircle) {
      const diameter = OBJECTS[event.type].radius * 2;
      const frameSize = diameter + 12;
      marker.classList.add('cat-circle-marker');
      marker.style.width = `${frameSize / previewGame.width * 100}%`;
      marker.style.height = `${frameSize / previewGame.height * 100}%`;
      const image = document.createElement('canvas');
      image.width = frameSize; image.height = frameSize;
      image.setAttribute('aria-hidden', 'true');
      drawCatCircle(image.getContext('2d'), { x: frameSize / 2, y: frameSize / 2, radius: OBJECTS[event.type].radius });
      marker.append(image, label);
    } else if (event.kind === 'object' && OBJECTS[event.type].obstruction) {
      const { width, height } = obstructionGeometry(event);
      const padding = event.spiked ? 32 : 4;
      const frameWidth = Math.max(width + padding, event.destructible ? 40 : 0);
      const frameHeight = Math.max(height + padding, event.destructible ? 30 : 0);
      marker.classList.add('obstruction-marker');
      marker.style.width = `${frameWidth / previewGame.width * 100}%`;
      marker.style.height = `${frameHeight / previewGame.height * 100}%`;
      const image = document.createElement('canvas');
      const scale = Math.min(1, 2048 / frameWidth, 2048 / frameHeight);
      image.width = Math.ceil(frameWidth * scale); image.height = Math.ceil(frameHeight * scale);
      image.setAttribute('aria-hidden', 'true');
      const context = image.getContext('2d');
      context.scale(image.width / frameWidth, image.height / frameHeight);
      drawObstruction(context, { ...event, x: frameWidth / 2, y: frameHeight / 2 });
      marker.append(image, label);
      if (selected && !readOnly() && connectingSpawn === null && !event.random && !event.group) {
        const outline = document.createElement('span');
        outline.className = 'obstruction-resize-box';
        outline.style.cssText = `width:${width / frameWidth * 100}%;height:${height / frameHeight * 100}%`;
        for (const handle of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
          const grip = document.createElement('span');
          grip.className = `obstruction-resize-handle resize-${handle}`;
          grip.dataset.handle = handle;
          grip.setAttribute('aria-hidden', 'true');
          grip.addEventListener('pointerdown', down => {
            if (readOnly() || down.button !== 0 || gesture) return;
            down.preventDefault(); down.stopPropagation();
            startGesture(down, { type: 'resize', index, spawnKey, handle });
          });
          outline.append(grip);
        }
        marker.append(outline);
      }
    } else marker.append(icon(event), label);
    marker.addEventListener('click', click => {
      click.stopPropagation();
      if (click.detail !== 0 && !readOnly()) return;
      if (!readOnly() && connectingSpawn !== null && !spawnKey) { attempt(() => connectSpawn(index)); return; }
      if (spawnKey) { choose('brick', spawnKey, isAdditive(click)); focusSpawnTemplate(spawnKey); return; }
      choose('event', index, isAdditive(click));
      focusMarker(index);
    });
    marker.addEventListener('pointerdown', down => {
      if (readOnly()) { down.stopPropagation(); return; }
      if (down.button !== 0 || gesture) return;
      down.preventDefault(); down.stopPropagation();
      if (connectingSpawn !== null && !spawnKey) { attempt(() => connectSpawn(index)); return; }
      startGesture(down, spawnKey ? { type: 'spawn-template', spawnKey } : { type: 'marker', index });
    });
    marker.addEventListener('keydown', key => {
      if (readOnly()) return;
      const direction = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] }[key.key];
      if (!direction) return;
      key.preventDefault();
      const grid = placementGrid();
      const stepX = grid ? grid.spacing / grid.width : .01;
      const stepY = grid ? grid.spacing / grid.height : .01;
      if (spawnKey) {
        attempt(() => saveSpawnTemplate(spawnKey, { ...event, ...placementPosition(
          event.x + direction[0] * stepX, event.y + direction[1] * stepY) }));
        setSelection([], [spawnKey]); focusSpawnTemplate(spawnKey); return;
      }
      if (!selectedEvents.has(index)) { selectedEvents = new Set([index]); selectedBricks = new Set(); }
      for (const item of selectedList()) moveEvent(item, (level.events[item].x ?? .5) + direction[0] * stepX, (level.events[item].y ?? .5) + direction[1] * stepY);
      markChanged(); setSelection();
      focusMarker(index);
    });
    markers.append(marker);
  });
  renderPreviewTime();
  syncAccess();
}

function renderPreviewTime(time = Number($('#timeline').value), followTime = false) {
  time = Math.max(0, Math.min(level.duration, time));
  $('#timeline').value = time;
  $('#time-label').textContent = `${time.toFixed(1)}s`;
  if (followTime) $('#event-time').value = Math.min(time, Number($('#event-time').max));
  $('#preview-speed-label').textContent = `${$('#preview-speed').value}x`;
  const camera = previewGame.camera(time), outline = $('#camera-outline');
  outline.hidden = !level.autoscroll;
  outline.style.cssText = `left:${camera.x / previewGame.width * 100}%;top:${camera.y / previewGame.height * 100}%;width:${camera.width / previewGame.width * 100}%;height:${camera.height / previewGame.height * 100}%`;
  updateCameraView(camera);
  for (const marker of $('#markers').querySelectorAll('.marker[data-index]')) {
    marker.hidden = connectingSpawn === null && !$('#show-all').checked
      && (Number(marker.dataset.previewStart) > time
        || (marker.dataset.previewEnd !== undefined && Number(marker.dataset.previewEnd) <= time));
    const event = level.events[Number(marker.dataset.index)];
    if (event.track) {
      const point = previewGame.trackEventPoint(event, time);
      marker.style.left = `${point.x / previewGame.width * 100}%`;
      marker.style.top = `${point.y / previewGame.height * 100}%`;
    }
  }
  if (time >= level.duration) pausePreview();
  $('#preview-play').disabled = time >= level.duration;
}

function alignmentAxes(point, references, toleranceX, toleranceY) {
  return {
    vertical: references.some(reference => Math.abs(point.x - reference.x) <= toleranceX),
    horizontal: references.some(reference => Math.abs(point.y - reference.y) <= toleranceY),
  };
}

function updateCameraView(camera) {
  const toggle = $('#dynamic-view'), viewport = $('#editor-board-scroll');
  toggle.disabled = !level.autoscroll;
  const dynamic = Boolean(level.autoscroll && toggle.checked);
  viewport.dataset.dynamicView = String(dynamic);
  viewport.style.height = dynamic ? `${camera.height / previewGame.height * board.clientHeight}px` : '';
  if (!dynamic) return;
  const boardRect = board.getBoundingClientRect(), viewportRect = viewport.getBoundingClientRect();
  const left = boardRect.left - viewportRect.left - viewport.clientLeft + viewport.scrollLeft + board.clientLeft;
  const top = boardRect.top - viewportRect.top - viewport.clientTop + viewport.scrollTop + board.clientTop;
  viewport.scrollLeft = left + camera.x / previewGame.width * board.clientWidth;
  viewport.scrollTop = top + camera.y / previewGame.height * board.clientHeight;
}

function pointReference(events, bricks) {
  const spawns = bricks.filter(brick => brick.absorbedBy === null && brick.spawner).map(brick => brick.spawner);
  const totals = { food: 0, enemy: 0, soccer: 0, weapons: 0, weaponHits: 0,
    weaponEnemyPoints: 0, specialEnemies: 0,
    shields: { none: 0, red: 0, green: 0, blue: 0 },
    weaponSources: { scheduled: { count: 0, hits: 0 }, spawner: { count: 0, hits: 0 }, drop: { count: 0, hits: 0 } } };
  const addWeapon = (type, count, origin) => {
    const hits = WEAPONS[type].seconds ? Infinity : WEAPONS[type].uses * count;
    totals.weapons += count; totals.weaponHits += hits;
    totals.weaponSources[origin].count += count; totals.weaponSources[origin].hits += hits;
  };
  for (const [source, origin] of [...events.map(event => [event, 'scheduled']), ...spawns.map(spawn => [spawn, 'spawner'])]) {
    const count = source.group?.count ?? source.randomCount ?? 1;
    if (source.kind === 'food') totals.food += FOODS[source.type].value * count;
    if (source.kind === 'enemy') {
      const points = (source.shield ? SHIELDS[source.shield].hits : 1) * count;
      totals.enemy += points;
      totals.shields[source.shield ?? 'none'] += count;
      if (['boss', 'robo-love-bug'].includes(source.type)) totals.specialEnemies += count;
      else totals.weaponEnemyPoints += points;
      if (Object.hasOwn(WEAPONS, source.carriesItem ?? '')) addWeapon(source.carriesItem, count, 'drop');
    }
    if (source.kind === 'weapon') addWeapon(source.type, count, origin);
    if (source.kind === 'object' && source.type === 'soccer-ball') totals.soccer += count;
  }
  const scoringSpawner = spawns.some(source => ['food', 'enemy', 'weapon'].includes(source.kind)
    || (source.kind === 'object' && source.type === 'soccer-ball'));
  const extra = scoringSpawner && [...events, ...spawns].some(source =>
    (source.kind === 'item' && ['battery', 'ditto-stamp'].includes(source.type))
    || (source.kind === 'enemy' && ['battery', 'ditto-stamp'].includes(source.carriesItem)));
  return { ...totals, extra };
}

function renderPointReference(events, bricks) {
  const totals = pointReference(events, bricks);
  for (const kind of ['food', 'enemy', 'soccer']) {
    const output = $(`#available-${kind}`), value = String(totals[kind]);
    if (output.textContent !== value) output.textContent = value;
  }
  $('#available-weapons').textContent = String(totals.weapons);
  $('#available-weapon-hits').textContent = totals.weaponHits === Infinity ? 'Unlimited (timed)' : String(totals.weaponHits);
}

function render() {
  renderBoard(); renderList();
}

function renderKoshiStart() {
  const cat = previewGame.cat, bounds = previewGame.bounds();
  const marker = $('#koshi-start-marker');
  marker.style.left = `${cat.x / previewGame.width * 100}%`;
  marker.style.top = `${cat.y / previewGame.height * 100}%`;
  marker.setAttribute('aria-pressed', String(activeCategory === 'koshi'));
  marker.querySelector('small').textContent = level.koshiStart ? 'Start' : 'Start (default)';
  $('#koshi-x').value = (cat.x - bounds.left) / (bounds.right - bounds.left) * 100;
  $('#koshi-y').value = (cat.y - bounds.top) / (bounds.bottom - bounds.top) * 100;
  $('#koshi-reset').disabled = !level.koshiStart;
  $('#koshi-start-status').textContent = level.koshiStart ? 'Custom starting point placed.' : 'No custom starting point. Using the level default.';
}

function saveKoshiStart(point) {
  if (readOnly()) return;
  const draft = { ...level };
  if (point === undefined) delete draft.koshiStart;
  else draft.koshiStart = point;
  level = validateDraft(draft);
  markChanged(); render();
  message(point === undefined ? 'Koshi starting point reset to the level default.' : 'Koshi starting point saved.');
}

$('#koshi-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  attempt(() => saveKoshiStart({ x: Number($('#koshi-x').value) / 100, y: Number($('#koshi-y').value) / 100 }));
});
$('#koshi-form').addEventListener('change', event => {
  if (!event.currentTarget.reportValidity()) { message('Enter valid starting coordinates from 0 to 100.', true); return; }
  attempt(() => saveKoshiStart({ x: Number($('#koshi-x').value) / 100, y: Number($('#koshi-y').value) / 100 }));
});
$('#koshi-reset').addEventListener('click', () => attempt(() => saveKoshiStart()));
$('#koshi-start-marker').addEventListener('click', event => {
  event.stopPropagation();
  if (event.detail !== 0 && !readOnly()) return;
  showCategory('koshi'); setSelection([], []);
});
$('#koshi-start-marker').addEventListener('pointerdown', event => {
  event.stopPropagation();
  if (readOnly() || event.button !== 0 || gesture) return;
  event.preventDefault();
  showCategory('koshi'); setSelection([], []);
  startGesture(event, { type: 'koshi' });
});
$('#koshi-start-marker').addEventListener('keydown', event => {
  if (readOnly()) return;
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault(); event.stopPropagation();
    attempt(() => saveKoshiStart()); return;
  }
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (!direction) return;
  event.preventDefault(); event.stopPropagation();
  const grid = placementGrid();
  attempt(() => saveKoshiStart(placementPosition(
    Number($('#koshi-x').value) / 100 + direction[0] * (grid ? grid.spacing / grid.width : .01),
    Number($('#koshi-y').value) / 100 + direction[1] * (grid ? grid.spacing / grid.height : .01))));
});

function populateTrackForm() {
  trackDrawing = false;
  selectedTrackNode = -1;
  trackNodeGesture = null;
  const track = (level.tracks ?? []).find(track => track.id === selectedTrackId);
  $('#track-speed').value = track?.speed ?? 60;
  $('#track-power').value = track?.power ?? 'none';
  $('#track-closed').checked = track?.closed ?? false;
  trackDrawNodes = (track?.nodes ?? []).map(node => ({ ...node }));
}

function renderCatTracks() {
  const tracks = level.tracks ?? [], choice = $('#track-choice');
  if (selectedTrackId && !tracks.some(track => track.id === selectedTrackId)) {
    selectedTrackId = ''; populateTrackForm();
  }
  choice.replaceChildren(...[['', 'New track'], ...tracks.map(track => [track.id, track.id])].map(([value, name]) => {
    const option = document.createElement('option');
    option.value = value; option.textContent = name;
    return option;
  }));
  choice.value = selectedTrackId;
  $('#tracks-access').disabled = readOnly();
  $('#track-delete').disabled = !selectedTrackId;
  $('#track-attach').disabled = !selectedTrackId || !selectedEvents.size;
  $('#track-detach').disabled = !selectedList().some(index => level.events[index].track);
  $('#track-draw').setAttribute('aria-pressed', String(trackDrawing));
  $('#track-draw').textContent = trackDrawing ? 'Done drawing nodes' : 'Draw replacement nodes';
  const attached = selectedList().filter(index => level.events[index].track)
    .map(index => `Event ${index + 1}: ${level.events[index].track}`);
  $('#track-attachments').textContent = attached.join('; ');
  const svg = $('#cat-tracks'), ns = 'http://www.w3.org/2000/svg';
  svg.dataset.editable = String(activeCategory === 'tracks' && !readOnly());
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${previewGame.width} ${previewGame.height}`);
  const draw = (track, nodes) => {
    const path = document.createElementNS(ns, 'polyline');
    const points = track.closed && nodes.length > 2 ? [...nodes, nodes[0]] : nodes;
    path.setAttribute('points', points.map(node => `${node.x},${node.y}`).join(' '));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', track.power === 'yellow' ? '#d5b83f' : track.power === 'black' ? '#41464b' : '#174f36');
    path.setAttribute('stroke-width', '3'); path.setAttribute('stroke-dasharray', '1 8');
    path.setAttribute('stroke-linecap', 'round'); path.setAttribute('opacity', '.65');
    path.setAttribute('class', 'track-path');
    path.addEventListener('pointerdown', event => {
      if (readOnly() || activeCategory !== 'tracks' || trackDrawing || !track.id || event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      selectedTrackId = track.id; populateTrackForm(); renderBoard();
    });
    svg.append(path);
    if (track.id === selectedTrackId || trackDrawing && track.id === '') nodes.forEach((node, i) => {
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', node.x); circle.setAttribute('cy', node.y); circle.setAttribute('r', '5');
      circle.setAttribute('fill', i ? '#d5b99c' : '#f4d885');
      circle.setAttribute('class', 'track-node');
      circle.setAttribute('data-node', String(i));
      circle.setAttribute('role', 'button');
      circle.setAttribute('aria-label', `${track.id || 'New track'} node ${i + 1}`);
      circle.setAttribute('aria-pressed', String(selectedTrackNode === i));
      if (!readOnly() && activeCategory === 'tracks') circle.setAttribute('tabindex', '0');
      circle.addEventListener('pointerdown', event => startTrackNodeDrag(event, i));
      circle.addEventListener('keydown', event => moveTrackNodeWithKeyboard(event, i));
      svg.append(circle);
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', node.x + 8); label.setAttribute('y', node.y - 8);
      label.setAttribute('fill', '#f4d885'); label.setAttribute('font-size', '12');
      label.textContent = String(i + 1); svg.append(label);
    });
  };
  for (const track of previewGame.catTracks) {
    const nodes = track.id === selectedTrackId ? trackNodeGesture?.nodes ?? trackDrawNodes : null;
    draw(track, nodes ? nodes.map(node => previewGame.pointFromRelative(node.x, node.y)) : track.path.nodes);
  }
  if (!selectedTrackId && trackDrawNodes.length) draw({ id: '', closed: $('#track-closed').checked, power: $('#track-power').value },
    (trackNodeGesture?.nodes ?? trackDrawNodes).map(node => previewGame.pointFromRelative(node.x, node.y)));
}

function saveTrackNodeMove(index, point) {
  const nodes = trackDrawNodes.map((node, i) => i === index ? point : node);
  if (selectedTrackId && !trackDrawing) {
    const tracks = level.tracks.map(track => track.id === selectedTrackId ? { ...track, nodes } : track);
    level = validateDraft({ ...level, tracks });
    markChanged();
  }
  trackDrawNodes = nodes;
}

function focusTrackNode(index) {
  $('#cat-tracks').querySelector(`[data-node="${index}"]`)?.focus({ preventScroll: true });
}

function startTrackNodeDrag(event, index) {
  if (readOnly() || activeCategory !== 'tracks' || event.button !== 0 || gesture || trackNodeGesture) return;
  event.preventDefault(); event.stopPropagation();
  pausePreview();
  selectedTrackNode = index;
  trackNodeGesture = { index, pointerId: event.pointerId, nodes: trackDrawNodes.map(node => ({ ...node })) };
  board.setPointerCapture(event.pointerId);
  renderCatTracks();
}

function moveTrackNodeWithKeyboard(event, index) {
  if (readOnly() || activeCategory !== 'tracks') return;
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (!direction) return;
  event.preventDefault(); event.stopPropagation();
  pausePreview();
  selectedTrackNode = index;
  attempt(() => {
    const node = trackDrawNodes[index], grid = placementGrid();
    saveTrackNodeMove(index, placementPosition(node.x + direction[0] * (grid ? grid.spacing / grid.width : .01),
      node.y + direction[1] * (grid ? grid.spacing / grid.height : .01)));
  });
  renderBoard(); focusTrackNode(index);
}

function dragTrackNode(event) {
  if (!trackNodeGesture || trackNodeGesture.pointerId !== event.pointerId) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const point = pointerPosition(event);
  trackNodeGesture.nodes[trackNodeGesture.index] = placementPosition(point.x, point.y);
  renderCatTracks();
}

function finishTrackNodeDrag(event) {
  if (!trackNodeGesture || trackNodeGesture.pointerId !== event.pointerId) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const current = trackNodeGesture;
  trackNodeGesture = null;
  if (board.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId);
  if (event.type !== 'pointercancel') attempt(() => {
    saveTrackNodeMove(current.index, current.nodes[current.index]);
  });
  renderBoard(); focusTrackNode(current.index);
}

$('#track-choice').addEventListener('change', () => {
  selectedTrackId = $('#track-choice').value;
  populateTrackForm(); renderBoard();
});
$('#track-reset').addEventListener('click', () => { populateTrackForm(); renderBoard(); });
$('#track-draw').addEventListener('click', () => {
  if (readOnly()) return;
  if (!trackDrawing) { trackDrawNodes = []; selectedTrackNode = -1; }
  trackDrawing = !trackDrawing;
  renderBoard();
  message(trackDrawing ? 'Click the board to add Cat Track nodes, then Apply track to save.' : 'Drawing stopped. Apply track to save, or Cancel edits.');
});
function addTrackNode(event) {
  if (!trackDrawing || activeCategory !== 'tracks' || readOnly() || event.button !== 0 || event.target.closest('.track-node')) return;
  event.preventDefault(); event.stopImmediatePropagation();
  attempt(() => {
    const point = pointerPosition(event);
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) throw new Error('Place Cat Track nodes inside the playable area.');
    trackDrawNodes = [...trackDrawNodes, placementPosition(point.x, point.y)];
    renderBoard();
  });
}
$('#track-form').addEventListener('submit', event => {
  event.preventDefault();
  if (readOnly()) return;
  attempt(() => {
    let id = selectedTrackId;
    if (!id) {
      let next = 1;
      while ((level.tracks ?? []).some(track => track.id === `track-${next}`)) next++;
      id = `track-${next}`;
    }
    const power = $('#track-power').value;
    const track = { id, nodes: trackDrawNodes, closed: $('#track-closed').checked,
      speed: Number($('#track-speed').value), ...(power === 'none' ? {} : { power }) };
    const tracks = [...(level.tracks ?? []).filter(track => track.id !== id), track];
    level = validateDraft({ ...level, tracks });
    selectedTrackId = id; populateTrackForm(); markChanged(); render();
    message(`Applied ${id}. Select obstructions or bumpers, then Attach selected objects.`);
  });
});
$('#track-delete').addEventListener('click', () => {
  if (readOnly() || !selectedTrackId) return;
  attempt(() => {
    const events = level.events.map(event => {
      if (event.track !== selectedTrackId) return event;
      const { track, ...detached } = event;
      return detached;
    });
    level = validateDraft({ ...level, events, tracks: level.tracks.filter(track => track.id !== selectedTrackId) });
    selectedTrackId = ''; populateTrackForm(); markChanged(); render();
    message('Cat Track deleted; its objects are now stationary.');
  });
});
for (const attach of [true, false]) $(`#track-${attach ? 'attach' : 'detach'}`).addEventListener('click', () => {
  if (readOnly()) return;
  attempt(() => {
    if (attach && !selectedTrackId) throw new Error('Apply or select a Cat Track first.');
    const events = level.events.map((event, index) => {
      if (!selectedEvents.has(index)) return event;
      const { track, ...detached } = event;
      return attach ? { ...detached, track: selectedTrackId } : detached;
    });
    level = validateDraft({ ...level, events });
    markChanged(); populateEventForm(); render();
    message(attach ? 'Selected objects attached at their nearest track points.' : 'Selected objects detached.');
  });
});

function focusMarker(index) { board.querySelector(`.marker[data-index="${index}"]`)?.focus({ preventScroll: true }); }
function focusBrick(key) { board.querySelector(`.editor-brick[data-region="${key}"]`)?.focus({ preventScroll: true }); }
function focusSpawnTemplate(key) { board.querySelector(`.spawn-template[data-spawn-key="${key}"]`)?.focus({ preventScroll: true }); }

function spawnTemplates() {
  const regions = brickEditRegions(previewGame.bricks);
  return previewGame.bricks.filter(brick => brick.absorbedBy === null && brick.spawner?.x !== undefined)
    .map(brick => ({ event: { ...brick.spawner }, spawnKey: regionKey(regions.get(brick.id)), brick }));
}

function renderSpawnLinks(templates) {
  const svg = $('#spawn-links');
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${previewGame.width} ${previewGame.height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  for (const { event, spawnKey, brick } of templates) {
    if (!selectedBricks.has(spawnKey)) continue;
    const point = previewGame.campaignEventPoint(event.x, event.y);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    for (const [name, value] of Object.entries({ x1: brick.x + brick.w / 2, y1: brick.y + brick.h / 2, x2: point.x, y2: point.y })) line.setAttribute(name, value);
    svg.append(line);
  }
}

function spawnTemplate(key) {
  const template = spawnTemplates().find(item => item.spawnKey === key);
  if (!template) throw new Error('Select a spawning brick with a fixed location.');
  return template;
}

function saveSpawnTemplate(key, spawn, removeIndex = null) {
  if (readOnly()) return;
  const regions = brickEditRegions(previewGame.bricks);
  const brick = previewGame.bricks.find(item => item.absorbedBy === null && regionKey(regions.get(item.id)) === key);
  if (!brick?.spawner || immutableBrick(brick.kind)) throw new Error('Select one editable spawning brick first.');
  const entries = previewGame.bricks.filter(member => member.id === brick.id || member.initialOwner === brick.id)
    .map(member => ({ ...brickEntry(brick, regions.get(member.id)), spawner: { ...spawn } }));
  const keys = new Set(entries.map(regionKey));
  const events = removeIndex === null ? level.events : level.events.filter((_, index) => index !== removeIndex);
  level = validateDraft({ ...level, events,
    brickTypes: [...(level.brickTypes ?? []).filter(entry => !keys.has(regionKey(entry))), ...entries] });
  markChanged();
}

function updateSpawnTemplateDraft(key, spawn) {
  const regions = brickEditRegions(previewGame.bricks);
  const { brick } = spawnTemplate(key);
  const entries = previewGame.bricks.filter(member => member.id === brick.id || member.initialOwner === brick.id)
    .map(member => ({ ...brickEntry(brick, regions.get(member.id)), spawner: { ...spawn } }));
  const keys = new Set(entries.map(regionKey));
  level.brickTypes = [...(level.brickTypes ?? []).filter(entry => !keys.has(regionKey(entry))), ...entries];
}

function connectSpawn(index) {
  const event = level.events[index];
  if (!event || connectingSpawn === null) throw new Error('Choose a placed object to connect.');
  if (event.track) throw new Error('Detach the object from its Cat Track before connecting it to a spawning brick.');
  if (event.random || event.group) throw new Error('Connect requires a single object at a fixed location.');
  const key = connectingSpawn, { time, ...spawn } = event;
  saveSpawnTemplate(key, spawn, index);
  connectingSpawn = null;
  setSelection([], [key]);
  message('Object connected as a spawn-only template. It no longer appears on its old schedule.');
}

function placementGrid() {
  if (!$('#discretize-xy').checked) return null;
  const area = $('#playable-area'), rect = area.getBoundingClientRect();
  const spacing = parseFloat(getComputedStyle(area).backgroundSize);
  return { width: rect.width, height: rect.height, left: area.clientLeft, top: area.clientTop, spacing };
}

function placementPosition(x, y) {
  const grid = placementGrid();
  const snap = (value, length, border) => {
    const first = border + grid.spacing / 2;
    const last = Math.max(0, Math.floor((length - border - first) / grid.spacing));
    const index = Math.max(0, Math.min(last, Math.round((value * length - first) / grid.spacing)));
    return (first + index * grid.spacing) / length;
  };
  return grid ? { x: snap(x, grid.width, grid.left), y: snap(y, grid.height, grid.top) }
    : { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
}

function moveEvent(index, x, y) {
  if (readOnly()) return;
  const event = level.events[index];
  let point = placementPosition(x, y);
  if (!event.group && event.kind === 'enemy' && ['wheel', 'snake', 'robo-cow'].includes(event.type)) point = snapWheel(point.x, point.y);
  delete event.random;
  delete event.randomCount;
  Object.assign(event, point);
}

function pointerPosition(event) {
  const rect = board.getBoundingClientRect(), b = previewGame.bounds();
  const x = (event.clientX - rect.left - board.clientLeft) / board.clientWidth * previewGame.width;
  const y = (event.clientY - rect.top - board.clientTop) / board.clientHeight * previewGame.height;
  return { x: (x - b.left) / (b.right - b.left), y: (y - b.top) / (b.bottom - b.top) };
}

function resizedObstruction(origin, handle, dx, dy, bounds) {
  const geometry = obstructionGeometry(origin);
  const west = handle.includes('w'), east = handle.includes('e');
  const north = handle.includes('n'), south = handle.includes('s');
  let width = Math.max(1, Math.min(10000, geometry.width + (west ? -dx : east ? dx : 0)));
  let height = Math.max(1, Math.min(10000, geometry.height + (north ? -dy : south ? dy : 0)));
  if (OBJECTS[origin.type].obstruction !== 'rectangle') {
    const horizontal = west || east, vertical = north || south;
    const changeX = width - geometry.width, changeY = height - geometry.height;
    const size = horizontal && (!vertical || Math.abs(changeX) >= Math.abs(changeY)) ? width : height;
    width = height = size;
  }
  const offsetX = (east ? 1 : west ? -1 : 0) * (width - geometry.width) / 2;
  const offsetY = (south ? 1 : north ? -1 : 0) * (height - geometry.height) / 2;
  return { ...origin, width, height,
    x: Math.max(0, Math.min(1, origin.x + offsetX / (bounds.right - bounds.left))),
    y: Math.max(0, Math.min(1, origin.y + offsetY / (bounds.bottom - bounds.top))) };
}

function startGesture(event, target) {
  if (readOnly() && ['marker', 'resize', 'spawn-template', 'koshi'].includes(target.type)) return;
  gesture = { ...target, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, additive: isAdditive(event), moved: false };
  if (target.type === 'marker') {
    // Pressing an unselected marker adds it (or replaces the selection) so the drag moves it with the group.
    if (!selectedEvents.has(target.index)) {
      gesture.added = true;
      if (gesture.additive) selectedEvents = new Set([...selectedEvents, target.index]);
      else { selectedEvents = new Set([target.index]); selectedBricks = new Set(); }
    }
    gesture.start = pointerPosition(event);
    gesture.origins = new Map(selectedList().map(index => [index, { ...level.events[index] }]));
  }
  if (target.type === 'koshi') {
    gesture.start = pointerPosition(event);
    gesture.origin = level.koshiStart;
    gesture.point = { x: Number($('#koshi-x').value) / 100, y: Number($('#koshi-y').value) / 100 };
  }
  if (target.type === 'resize') {
    gesture.start = pointerPosition(event);
    gesture.origin = target.spawnKey ? spawnTemplate(target.spawnKey).event : { ...level.events[target.index] };
    if (target.spawnKey) gesture.baseLevel = { ...level };
  }
  if (target.type === 'spawn-template') {
    selectedEvents = new Set(); selectedBricks = new Set([target.spawnKey]);
    gesture.start = pointerPosition(event);
    gesture.origin = spawnTemplate(target.spawnKey).event;
    gesture.baseLevel = { ...level };
  }
  board.setPointerCapture(event.pointerId);
}

function boxBounds(event) {
  return {
    left: Math.min(gesture.startX, event.clientX), right: Math.max(gesture.startX, event.clientX),
    top: Math.min(gesture.startY, event.clientY), bottom: Math.max(gesture.startY, event.clientY),
  };
}

function drawBox(event) {
  const box = boxBounds(event), rect = board.getBoundingClientRect();
  const style = $('#selection-box').style;
  style.left = `${box.left - rect.left - board.clientLeft}px`; style.top = `${box.top - rect.top - board.clientTop}px`;
  style.width = `${box.right - box.left}px`; style.height = `${box.bottom - box.top}px`;
  $('#selection-box').hidden = false;
}

function boxSelect(event) {
  const box = boxBounds(event);
  const boardBounds = board.getBoundingClientRect();
  const selectedParts = new Set(previewGame.brickParts().filter(part => {
    const left = boardBounds.left + board.clientLeft + part.x / previewGame.width * board.clientWidth;
    const top = boardBounds.top + board.clientTop + part.y / previewGame.height * board.clientHeight;
    return left < box.right && left + part.w / previewGame.width * board.clientWidth > box.left
      && top < box.bottom && top + part.h / previewGame.height * board.clientHeight > box.top;
  }).map(part => part.id));
  const bricks = [...board.querySelectorAll('.editor-brick')].filter(element => {
    return selectedParts.has(Number(element.dataset.id));
  }).map(element => element.dataset.region);
  const events = [...board.querySelectorAll('.marker[data-index]')].filter(element => {
    if (element.hidden) return false;
    const r = element.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }).map(element => Number(element.dataset.index));
  if (gesture.additive) setSelection([...selectedEvents, ...events], [...selectedBricks, ...bricks]);
  else setSelection(events, bricks);
}

function placeAt(event) {
  if (readOnly()) return;
  if (activeCategory === 'tracks') {
    message('Choose Draw replacement nodes to place a track, or drag an existing track node.');
    return;
  }
  if (activeCategory === 'brick') {
    message('Select a boundary brick to edit it, or choose another category to place objects.');
    return;
  }
  const point = pointerPosition(event);
  if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
    message('Place objects inside the dotted playable area, not on bricks.', true); return;
  }
  if (activeCategory === 'koshi') {
    attempt(() => saveKoshiStart(placementPosition(point.x, point.y)));
    return;
  }
  if (!form.reportValidity()) return;
  attempt(() => {
    const item = { ...readEvent(), time: discretePreviewTime(Number($('#timeline').value)),
      ...placementPosition(point.x, point.y) };
    if (!item.random && !item.group && item.kind === 'enemy' && ['wheel', 'snake', 'robo-cow'].includes(item.type)) Object.assign(item, snapWheel(item.x, item.y));
    level = validateDraft({ ...level, events: [...level.events, item] });
    markChanged(); setSelection([level.events.length - 1], []);
    message(`Placed ${description(item)} at ${item.time}s. Edit it in the inspector, or choose Place to add another.`);
  });
}

board.addEventListener('pointerdown', event => {
  if (event.button !== 0 || gesture) return;
  const brick = event.target.closest('.editor-brick');
  startGesture(event, brick ? { type: 'brick', key: brick.dataset.region } : { type: 'board' });
});
board.addEventListener('pointermove', event => {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  if (!gesture.moved && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 5) return;
  gesture.moved = true;
  if (gesture.type === 'koshi') {
    const point = pointerPosition(event);
    level = { ...level, koshiStart: placementPosition(
      gesture.point.x + point.x - gesture.start.x, gesture.point.y + point.y - gesture.start.y) };
    renderBoard();
  } else if (gesture.type === 'resize') {
    const point = pointerPosition(event), bounds = previewGame.bounds();
    const resized = resizedObstruction(gesture.origin, gesture.handle,
      (point.x - gesture.start.x) * (bounds.right - bounds.left),
      (point.y - gesture.start.y) * (bounds.bottom - bounds.top), bounds);
    if (gesture.spawnKey) {
      gesture.draft = resized;
      updateSpawnTemplateDraft(gesture.spawnKey, resized);
    } else level.events[gesture.index] = resized;
    renderBoard();
  } else if (gesture.type === 'spawn-template') {
    const point = pointerPosition(event);
    const spawn = { ...gesture.origin, ...placementPosition(
      gesture.origin.x + point.x - gesture.start.x, gesture.origin.y + point.y - gesture.start.y) };
    if (spawn.kind === 'enemy' && ['wheel', 'snake', 'robo-cow'].includes(spawn.type)) Object.assign(spawn, snapWheel(spawn.x, spawn.y));
    gesture.draft = spawn;
    updateSpawnTemplateDraft(gesture.spawnKey, spawn);
    renderBoard();
  } else if (gesture.type === 'marker') {
    const point = pointerPosition(event);
    for (const [index, origin] of gesture.origins) moveEvent(index, (origin.x ?? .5) + point.x - gesture.start.x, (origin.y ?? .5) + point.y - gesture.start.y);
    renderBoard();
  } else drawBox(event);
});
board.addEventListener('pointerup', event => {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  if (board.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId);
  $('#selection-box').hidden = true;
  const current = gesture;
  if (current.type === 'koshi') {
    gesture = null;
    if (current.moved) attempt(() => saveKoshiStart(level.koshiStart));
    else render();
    $('#koshi-start-marker').focus({ preventScroll: true });
    return;
  }
  if (current.spawnKey) {
    gesture = null;
    level = current.baseLevel;
    attempt(() => {
      if (current.moved) saveSpawnTemplate(current.spawnKey, current.draft);
    });
    setSelection([], [current.spawnKey]); focusSpawnTemplate(current.spawnKey);
    return;
  }
  if (current.type === 'resize') {
    gesture = null;
    attempt(() => {
      try { level = validateDraft(level); }
      catch (error) { level.events[current.index] = current.origin; throw error; }
      if (current.moved) markChanged();
      message('Obstruction resized. Numeric dimensions are available in the inspector.');
    });
    setSelection(); focusMarker(current.index);
    return;
  }
  if (current.type === 'marker') {
    gesture = null;
    if (current.moved) { markChanged(); setSelection(); message(`Moved ${plural(current.origins.size, 'event')}.`); }
    else if (current.added || !current.additive) setSelection(current.additive ? selectedEvents : [current.index], current.additive ? selectedBricks : []);
    else setSelection(toggled(selectedEvents, current.index));
    focusMarker(current.index);
    return;
  }
  if (current.moved) boxSelect(event);
  gesture = null;
  if (current.moved) { board.focus({ preventScroll: true }); return; }
  if (current.type === 'brick') { choose('brick', current.key, current.additive); focusBrick(current.key); }
  else if (placing && !current.additive) placeAt(event);
  else { if (!current.additive) setSelection([], []); board.focus({ preventScroll: true }); }
});
board.addEventListener('pointercancel', () => {
  if (gesture?.type === 'koshi') {
    if (gesture.origin === undefined) delete level.koshiStart;
    else level.koshiStart = gesture.origin;
    gesture = null; render(); return;
  }
  if (gesture?.spawnKey) {
    level = gesture.baseLevel;
    gesture = null; render(); return;
  }
  if (gesture?.type === 'resize') {
    level.events[gesture.index] = gesture.origin;
    gesture = null; render();
    return;
  }
  if (gesture?.origins) for (const [index, origin] of gesture.origins) level.events[index] = origin;
  gesture = null; $('#selection-box').hidden = true; markChanged(); render();
});
board.addEventListener('keydown', event => {
  if (event.key === 'Escape') { connectingSpawn = null; setSelection([], []); board.focus({ preventScroll: true }); }
  else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelected(); board.focus({ preventScroll: true }); }
  else if (event.key.toLowerCase() === 'a' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); selectAll(); }
});
function startPlacement() {
  if (readOnly()) return;
  placing = true; setSelection([], []);
}
function syncTool() {
  board.dataset.tool = placing ? 'place' : 'select';
  $('#place-mode').setAttribute('aria-pressed', String(placing));
  $('#select-mode').setAttribute('aria-pressed', String(!placing));
}
$('#inspector-access').addEventListener('change', () => {
  if (readOnly()) return;
  if (selectedEvents.size) return;
  placing = true;
  syncTool();
}, true);
$('#place-mode').addEventListener('click', startPlacement);
$('#select-mode').addEventListener('click', () => { placing = false; render(); });
$('#select-all').addEventListener('click', selectAll);
$('#clear-selection').addEventListener('click', () => setSelection([], []));
function brickEntry(brick, region) {
  if (immutableBrick(brick.kind)) return { ...region, kind: brick.kind };
  return { ...region, kind: brick.kind, crumbler: brick.crumbler ?? null, warped: brick.warped ?? null,
    slimed: Boolean(brick.slimed), slimeColor: brick.slimeColor ?? 'green', springs: Boolean(brick.springs),
    spikes: Boolean(brick.spikes), conveyor: Boolean(brick.conveyor), conveyorDirection: brick.conveyorDirection ?? 'clockwise',
    portal: brick.portal ?? null, toggle: brick.toggle ?? null, power: Boolean(brick.power), spawner: brick.spawner ? { ...brick.spawner } : null, boost: Boolean(brick.boost), turret: brick.turret ?? null, hazard: brick.hazard ? { ...brick.hazard } : null };
}
function saveBrick(event) {
  attempt(() => {
    if (event.target.id === 'brick-spawn-item') resetObstructionSize('brick-spawn');
    const regions = brickEditRegions(previewGame.bricks);
    const targets = previewGame.bricks.map(brick => ({ brick, region: regions.get(brick.id) })).filter(({ brick, region }) => brick.absorbedBy === null && selectedBricks.has(regionKey(region)));
    if (!targets.length) throw new Error('Select a brick before changing its attributes.');
    const id = event.target.id;
    const number = selector => $(selector).value === '' ? null : Number($(selector).value);
    // Only the changed control is applied, so mixed values in other controls are preserved.
    const entries = targets.flatMap(({ brick, region }) => {
      const entry = brickEntry(brick, region);
      if (immutableBrick(brick.kind) && id !== 'brick-kind') throw new Error('Cinder and Goal bricks cannot have modifiers or contact surfaces. Change the brick type first.');
      if (id === 'brick-plain') for (const attribute of CONTACT_SURFACES) entry[attribute] = ['portal', 'spawner', 'turret', 'hazard'].includes(attribute) ? null : false;
      if (id === 'brick-conveyor-direction' && $('#brick-conveyor-direction').value !== MIXED) entry.conveyorDirection = $('#brick-conveyor-direction').value;
      if (id === 'brick-slime-color' && $('#brick-slime-color').value !== MIXED) entry.slimeColor = $('#brick-slime-color').value;
      if (id === 'brick-kind' && $('#brick-kind').value !== MIXED) entry.kind = $('#brick-kind').value;
      if (id === 'brick-turret-type' && $('#brick-turret-type').value !== MIXED && $('#brick-turret-type').value) entry.turret = $('#brick-turret-type').value;
      if (id === 'brick-hazard-type' && $('#brick-hazard-type').value !== MIXED) {
        const type = $('#brick-hazard-type').value;
        entry.hazard = { ...entry.hazard, type };
        if (!globalThis.KoshiGame.HAZARDS[type].interval) delete entry.hazard.interval;
        if (!globalThis.KoshiGame.HAZARDS[type].appearance) for (const field of ['color', 'pattern', 'patternColor']) delete entry.hazard[field];
      }
      for (const field of ['color', 'pattern', 'patternColor']) {
        if (id === `brick-hazard-${field}` && entry.hazard && globalThis.KoshiGame.HAZARDS[entry.hazard.type].appearance
          && $(`#${id}`).value !== MIXED) entry.hazard[field] = $(`#${id}`).value;
      }
      if (id === 'brick-hazard-power' && entry.hazard && $('#brick-hazard-power').value !== MIXED) {
        entry.hazard.power = $('#brick-hazard-power').value === 'none' ? null : $('#brick-hazard-power').value;
      }
      if (id === 'brick-hazard-interval' && entry.hazard && globalThis.KoshiGame.HAZARDS[entry.hazard.type].interval) {
        if (number('#brick-hazard-interval') === null) throw new Error('Enter a hazard shot interval in seconds.');
        entry.hazard.interval = number('#brick-hazard-interval');
      }
      if (id === 'brick-crumbler') entry.crumbler = $('#brick-crumbler').checked ? entry.crumbler ?? number('#brick-uses') ?? 5 : null;
      if (id === 'brick-uses' && entry.crumbler && number('#brick-uses') !== null) entry.crumbler = number('#brick-uses');
      if (id === 'brick-warped') entry.warped = $('#brick-warped').checked ? entry.warped ?? number('#brick-warp-seconds') ?? 15 : null;
      if (id === 'brick-warp-seconds' && entry.warped && number('#brick-warp-seconds') !== null) entry.warped = number('#brick-warp-seconds');
      if (id === 'brick-toggle') entry.toggle = $('#brick-toggle').checked ? Number($('#brick-toggle-clicks').value || 1) : null;
      if (id === 'brick-power') entry.power = $('#brick-power').checked;
      if (id === 'brick-toggle-clicks' && $('#brick-toggle-clicks').value !== MIXED) entry.toggle = Number($('#brick-toggle-clicks').value);
      if (id === 'brick-portal-color' && $('#brick-portal-color').value !== MIXED) entry.portal = $('#brick-portal-color').value;
      if (id === 'brick-spawn-item' && $('#brick-spawn-item').value !== MIXED) {
        const [kind, type] = $('#brick-spawn-item').value.split(':');
        const position = entry.spawner?.x === undefined ? {} : { x: entry.spawner.x, y: entry.spawner.y };
        entry.spawner = { kind, type, ...position };
        if (kind === 'food') entry.spawner.lifetime = number('#brick-spawn-lifetime') ?? 15;
        else if (['item', 'weapon'].includes(kind) && number('#brick-spawn-lifetime') !== null) entry.spawner.lifetime = number('#brick-spawn-lifetime');
        if (kind === 'enemy') entry.spawner.shield = $('#brick-spawn-shield').value === 'none' || !$('#brick-spawn-shield').value ? null : $('#brick-spawn-shield').value;
      }
      if (id === 'brick-spawn-shield' && entry.spawner?.kind === 'enemy' && $('#brick-spawn-shield').value !== MIXED) entry.spawner.shield = $('#brick-spawn-shield').value === 'none' ? null : $('#brick-spawn-shield').value;
      if (id === 'brick-spawn-crab-direction' && entry.spawner?.kind === 'enemy' && entry.spawner.type === 'robo-crab'
        && $('#brick-spawn-crab-direction').value !== MIXED) {
        if ($('#brick-spawn-crab-direction').value === 'random') delete entry.spawner.crabDirection;
        else entry.spawner.crabDirection = $('#brick-spawn-crab-direction').value;
      }
      if (id === 'brick-spawn-lifetime' && ['food', 'item', 'weapon'].includes(entry.spawner?.kind)) {
        const lifetime = number('#brick-spawn-lifetime');
        if (lifetime !== null) entry.spawner.lifetime = lifetime;
        else if (entry.spawner.kind === 'food') throw new Error('Food needs a lifetime in seconds.');
        else delete entry.spawner.lifetime;
      }
      if (entry.spawner && ['brick-spawn-fixed', 'brick-spawn-x', 'brick-spawn-y'].includes(id)) {
        if (id === 'brick-spawn-fixed' && !$('#brick-spawn-fixed').checked) {
          delete entry.spawner.x; delete entry.spawner.y;
        } else {
          for (const field of id === 'brick-spawn-fixed' ? ['x', 'y'] : [id.slice(12)]) {
            if ($(`#brick-spawn-${field}`).value === '') throw new Error('Enter both spawn coordinates.');
          }
          if (id === 'brick-spawn-fixed') {
            entry.spawner.x = Number($('#brick-spawn-x').value) / 100;
            entry.spawner.y = Number($('#brick-spawn-y').value) / 100;
          } else entry.spawner[id.slice(12)] = Number($(`#${id}`).value) / 100;
        }
      }
      const editedSurface = id === 'brick-portal-color' ? 'portal' : id === 'brick-spawn-item' ? 'spawner'
        : id === 'brick-turret-type' ? 'turret' : id === 'brick-hazard-type' ? 'hazard' : null;
      if (editedSurface && entry[editedSurface]) {
        for (const other of CONTACT_SURFACES) if (other !== editedSurface) entry[other] = ['portal', 'spawner', 'turret', 'hazard'].includes(other) ? null : false;
      }
      if (CONTACT_SURFACES.map(attribute => `brick-${attribute}`).includes(id)) {
        const attribute = id.slice(6);
        if (attribute === 'portal') entry.portal = $('#brick-portal').checked ? $('#brick-portal-color').value || 'red' : null;
        else if (attribute === 'spawner') {
          const [kind, type] = $('#brick-spawn-item').value.split(':');
          entry.spawner = $('#brick-spawner').checked ? { kind, type, ...(kind === 'food' ? { lifetime: number('#brick-spawn-lifetime') ?? 15 } : {}) } : null;
          if (entry.spawner && ['item', 'weapon'].includes(kind) && number('#brick-spawn-lifetime') !== null) entry.spawner.lifetime = number('#brick-spawn-lifetime');
          if (entry.spawner?.kind === 'enemy') entry.spawner.shield = $('#brick-spawn-shield').value === 'none' || !$('#brick-spawn-shield').value ? null : $('#brick-spawn-shield').value;
        } else if (attribute === 'turret') entry.turret = $(`#${id}`).checked ? $('#brick-turret-type').value || 'laser' : null;
        else if (attribute === 'hazard') entry.hazard = $('#brick-hazard').checked ? { type: $('#brick-hazard-type').value || 'laser' } : null;
        else entry[attribute] = $(`#${id}`).checked;
        if (entry[attribute]) {
          for (const other of CONTACT_SURFACES) if (other !== attribute) entry[other] = ['portal', 'spawner', 'turret', 'hazard'].includes(other) ? null : false;
        }
      }
      if (['brick-spawn-item', 'brick-spawner'].includes(id) && entry.spawner?.kind === 'enemy' && entry.spawner.type === 'robo-crab'
        && ['horizontal', 'vertical'].includes($('#brick-spawn-crab-direction').value)) {
        entry.spawner.crabDirection = $('#brick-spawn-crab-direction').value;
      }
      if (entry.spawner?.kind === 'object' && OBJECTS[entry.spawner.type]?.obstruction) {
        if (id === 'brick-spawn-item' || id === 'brick-spawner') Object.assign(entry.spawner, readObstructionFields('brick-spawn'));
        for (const field of ['color', 'pattern', 'patternColor']) {
          if (id === `brick-spawn-${field}` && $(`#${id}`).value !== MIXED) entry.spawner[field] = $(`#${id}`).value;
        }
        for (const field of ['width', 'height']) if (id === `brick-spawn-${field}`) {
          const fields = OBJECTS[entry.spawner.type].obstruction === 'rectangle' ? [field] : ['width', 'height'];
          for (const dimension of fields) {
            if ($(`#${id}`).value === '') delete entry.spawner[dimension];
            else entry.spawner[dimension] = Number($(`#${id}`).value);
          }
        }
        for (const field of ['destructible', 'spiked']) {
          if (id === `brick-spawn-${field}`) entry.spawner[field] = $(`#${id}`).checked;
        }
      }
      if (immutableBrick(entry.kind)) for (const attribute of Object.keys(entry)) if (!['edge', 'start', 'end', 'kind'].includes(attribute)) delete entry[attribute];
      return previewGame.bricks.filter(member => member.id === brick.id || member.initialOwner === brick.id)
        .map(member => ({ ...entry, ...regions.get(member.id) }));
    });
    const keys = new Set(entries.map(regionKey));
    const overrides = (level.brickTypes ?? []).filter(entry => !keys.has(regionKey(entry)));
    level = validateDraft({ ...level, brickTypes: [...overrides, ...entries] });
    markChanged();
    message(`${entries.length === 1 ? 'Brick attributes' : `Attributes for ${entries.length} bricks`} saved. Export or playtest to use them.`);
  });
  // Re-render on success and failure so the inspector always reflects the saved level.
  renderBoard();
}
function combineBricks() {
  attempt(() => {
    const owners = previewGame.bricks.filter(brick => brick.absorbedBy === null && selectedBricks.has(regionKey(brick.region)));
    if (owners.length < 2) throw new Error('Select at least two adjacent bricks to combine.');
    const owner = owners.find(brick => brick.id === combineOwner);
    if (!owner) throw new Error('Choose a selected brick whose attributes the group inherits.');
    const ids = new Set(owners.map(brick => brick.id));
    const members = previewGame.bricks.filter(brick => ids.has(brick.id) || ids.has(brick.initialOwner)).map(brick => brick.id);
    const groups = (level.brickGroups ?? []).filter(group => !ids.has(group.owner));
    const entries = members.map(id => brickEntry(owner, previewGame.bricks[id].region));
    const keys = new Set(entries.map(regionKey));
    const candidate = { ...level, brickGroups: [...groups, { owner: owner.id, members }],
      brickTypes: [...(level.brickTypes ?? []).filter(entry => !keys.has(regionKey(entry))), ...entries] };
    if (owners.some(brick => immutableBrick(brick.kind)) && common(owners.map(brick => brick.kind)) === MIXED) throw new Error('Cinder and Goal blocks can combine only with blocks of the same kind.');
    level = validateDraft(candidate);
    markChanged(); setSelection([], [regionKey(owner.region)]);
    message(`Combined ${members.length} bricks using brick ${owner.id + 1}'s attributes.`);
  });
}

function splitBricks() {
  attempt(() => {
    const groups = (level.brickGroups ?? []).filter(group => selectedBricks.has(regionKey(previewGame.bricks[group.owner].region)));
    if (!groups.length) throw new Error('Select a combined brick to split.');
    const entries = groups.flatMap(group => group.members.map(id => brickEntry(previewGame.bricks[group.owner], previewGame.bricks[id].region)));
    const keys = new Set(entries.map(regionKey));
    level = validateDraft({ ...level, brickGroups: level.brickGroups.filter(group => !groups.includes(group)),
      brickTypes: [...(level.brickTypes ?? []).filter(entry => !keys.has(regionKey(entry))), ...entries] });
    markChanged(); setSelection([], entries.map(regionKey));
    message('Combined bricks split. Each retains the group\'s current attributes.');
  });
}
for (const selector of ['#brick-kind', '#brick-crumbler', '#brick-uses', '#brick-warped', '#brick-warp-seconds', '#brick-slimed', '#brick-slime-color', '#brick-springs', '#brick-spikes', '#brick-conveyor', '#brick-conveyor-direction', '#brick-portal', '#brick-portal-color', '#brick-toggle', '#brick-toggle-clicks', '#brick-power', '#brick-spawner', '#brick-spawn-item', '#brick-spawn-lifetime', '#brick-boost', '#brick-barrier', '#brick-turret', '#brick-turret-type', '#brick-hazard', '#brick-hazard-type', '#brick-hazard-power', '#brick-hazard-interval', '#brick-hazard-color', '#brick-hazard-pattern', '#brick-hazard-patternColor']) {
  $(selector).addEventListener('change', saveBrick);
}
for (const selector of ['#brick-spawn-fixed', '#brick-spawn-x', '#brick-spawn-y']) $(selector).addEventListener('change', saveBrick);
$('#connect-spawn').addEventListener('click', () => attempt(() => {
  if (readOnly()) return;
  if (connectingSpawn !== null) {
    connectingSpawn = null; render(); message('Connection cancelled.'); return;
  }
  const regions = brickEditRegions(previewGame.bricks);
  const chosen = previewGame.bricks.filter(brick => brick.absorbedBy === null && selectedBricks.has(regionKey(regions.get(brick.id))));
  if (chosen.length !== 1 || !chosen[0].spawner) throw new Error('Select one spawning brick first.');
  connectingSpawn = regionKey(regions.get(chosen[0].id));
  placing = false; render();
  message('Click a placed object in the play area to convert it to this brick\'s spawn-only template. Escape cancels.');
}));
$('#combine-bricks').addEventListener('click', combineBricks);
$('#split-bricks').addEventListener('click', splitBricks);
$('#event-kind').addEventListener('change', () => {
  resetObstructionSize('event');
  const previousKind = $('#event-lifetime').dataset.kind;
  typeOptions();
  if (previousKind !== $('#event-kind').value) $('#event-lifetime').value = $('#event-kind').value === 'food' ? 5 : '';
  touched.add('#event-kind'); touched.add('#event-type');
  showCategory($('#event-kind').value);
  startPlacement();
});
$('#event-type').addEventListener('change', () => {
  resetObstructionSize('event');
  typeOptions($('#event-type').value);
  touched.add('#event-type');
  showCategory($('#event-kind').value);
  startPlacement();
});
for (const field of ['color', 'pattern', 'patternColor']) {
  $(`#event-${field}`).addEventListener('input', () => touched.add(`#event-${field}`));
  $(`#brick-spawn-${field}`).addEventListener('change', event => attempt(() => saveBrick(event)));
}
for (const field of ['width', 'height', 'destructible', 'spiked']) {
  $(`#event-${field}`).addEventListener('input', () => touched.add(`#event-${field}`));
  $(`#brick-spawn-${field}`).addEventListener('change', saveBrick);
}
$('#brick-spawn-shield').addEventListener('change', event => attempt(() => saveBrick(event)));
$('#brick-spawn-crab-direction').addEventListener('change', event => attempt(() => saveBrick(event)));
$('#event-shield').addEventListener('change', () => touched.add('#event-shield'));
$('#event-crab-direction').addEventListener('change', () => touched.add('#event-crab-direction'));
$('#event-carries-item').addEventListener('change', () => touched.add('#event-carries-item'));
for (const selector of ['#event-time', '#event-lifetime', '#event-x', '#event-y', '#event-keys-required']) {
  $(selector).addEventListener('input', () => touched.add(selector));
}
for (const selector of ['#event-location', '#event-formation']) {
  $(selector).addEventListener('change', () => { touched.add(selector); updateEventPlacement(); });
}
for (const selector of ['#event-count-input', '#event-group-size', '#event-group-angle', '#event-random-count']) {
  $(selector).addEventListener('input', () => touched.add(selector));
}

function applyToSelected() {
  const value = selector => $(selector).value;
  const number = selector => touched.has(selector) && value(selector) !== '' ? Number(value(selector)) : null;
  const kind = touched.has('#event-kind') && value('#event-kind') !== MIXED ? value('#event-kind') : null;
  const type = touched.has('#event-type') && value('#event-type') !== MIXED ? value('#event-type') : null;
  const time = number('#event-time'), x = number('#event-x'), y = number('#event-y'), lifetime = number('#event-lifetime');
  const lifetimeChanged = touched.has('#event-lifetime') && !$('#event-lifetime').disabled;
  const shieldChanged = touched.has('#event-shield') && value('#event-shield') !== MIXED;
  const directionChanged = touched.has('#event-crab-direction') && value('#event-crab-direction') !== MIXED;
  const carrierChanged = touched.has('#event-carries-item') && value('#event-carries-item') !== '__mixed-carried-item__';
  const keysChanged = touched.has('#event-keys-required') && !$('#event-keys-required').disabled;
  const textureFields = ['color', 'pattern', 'patternColor'].filter(field => touched.has(`#event-${field}`) && value(`#event-${field}`) !== MIXED);
  const sizeFields = ['width', 'height'].filter(field => touched.has(`#event-${field}`));
  const destructibleChanged = touched.has('#event-destructible');
  const spikedChanged = touched.has('#event-spiked');
  const placementChanged = ['#event-location', '#event-formation', '#event-count-input', '#event-group-size', '#event-group-angle', '#event-random-count'].some(selector => touched.has(selector));
  if (!kind && !type && !shieldChanged && !directionChanged && !carrierChanged && !keysChanged && !lifetimeChanged && !textureFields.length && !sizeFields.length && !destructibleChanged && !spikedChanged && !placementChanged && [time, x, y].every(item => item === null)) throw new Error('Change at least one field to update the selected events.');
  const events = level.events.map((event, index) => {
    if (!selectedEvents.has(index)) return event;
    const next = { ...event };
    if (kind) next.kind = kind;
    if (type) next.type = type;
    if (time !== null) next.time = time;
    if (x !== null) next.x = x / 100;
    if (y !== null) next.y = y / 100;
    if (touched.has('#event-location') && value('#event-location') !== MIXED) {
      if (value('#event-location') === 'random') { next.random = true; delete next.x; delete next.y; }
      else { delete next.random; delete next.randomCount; next.x ??= .5; next.y ??= .5; }
    }
    if (touched.has('#event-formation') && value('#event-formation') !== MIXED) {
      if (value('#event-formation') === 'single') delete next.group;
      else {
        delete next.randomCount;
        next.group = { shape: value('#event-formation'), count: next.group?.count ?? Number(value('#event-count-input')),
          ...(next.group?.size !== undefined ? { size: next.group.size } : {}),
          ...(value('#event-formation') === 'line' ? { angle: Number(value('#event-group-angle')) } : {}) };
      }
    }
    if (touched.has('#event-random-count') && next.random && !next.group) {
      const count = Number(value('#event-random-count'));
      if (count > 1) next.randomCount = count;
      else delete next.randomCount;
    }
    if (next.group) {
      next.group = { ...next.group };
      if (touched.has('#event-count-input')) next.group.count = Number(value('#event-count-input'));
      if (touched.has('#event-group-size')) {
        if (value('#event-group-size') === '') delete next.group.size;
        else next.group.size = Number(value('#event-group-size')) / 100;
      }
      if (touched.has('#event-group-angle') && next.group.shape === 'line') next.group.angle = Number(value('#event-group-angle'));
    }
    if (next.kind === 'food') {
      if (lifetimeChanged && lifetime === null) throw new Error('Food needs a lifetime in seconds.');
      next.lifetime = lifetime ?? next.lifetime ?? 5;
    } else if (['item', 'weapon'].includes(next.kind)) {
      if (lifetimeChanged && lifetime !== null) next.lifetime = lifetime;
      else if (lifetimeChanged || (kind && event.kind !== kind)) delete next.lifetime;
    } else delete next.lifetime;
    if (next.kind !== 'enemy') delete next.shield;
    else if (shieldChanged) next.shield = value('#event-shield') === 'none' ? null : value('#event-shield');
    if (next.kind !== 'enemy' || next.type !== 'robo-crab') delete next.crabDirection;
    else if (directionChanged) {
      if (value('#event-crab-direction') === 'random') delete next.crabDirection;
      else next.crabDirection = value('#event-crab-direction');
    }
    if (next.kind !== 'enemy') {
      delete next.carriesItem; delete next.carriesCatBlock; delete next.carriesKey;
    } else if (carrierChanged) {
      delete next.carriesCatBlock; delete next.carriesKey;
      if (value('#event-carries-item')) next.carriesItem = value('#event-carries-item');
      else delete next.carriesItem;
    }
    if (next.kind !== 'item' || next.type !== 'treasure-chest') delete next.keysRequired;
    else if (keysChanged) next.keysRequired = Number(value('#event-keys-required'));
    if (!next.random || next.group) delete next.randomCount;
    for (const field of ['color', 'pattern', 'patternColor']) {
      if (next.kind !== 'object' || !OBJECTS[next.type]?.obstruction) delete next[field];
      else if (textureFields.includes(field)) next[field] = value(`#event-${field}`);
    }
    if (next.kind !== 'object' || !OBJECTS[next.type]?.obstruction) {
      for (const field of ['width', 'height', 'destructible', 'spiked']) delete next[field];
    } else {
      for (const field of sizeFields) {
        const dimensions = OBJECTS[next.type].obstruction === 'rectangle' ? [field] : ['width', 'height'];
        for (const dimension of dimensions) {
          if (value(`#event-${field}`) === '') delete next[dimension];
          else next[dimension] = Number(value(`#event-${field}`));
        }
      }
      if (destructibleChanged) next.destructible = $('#event-destructible').checked;
      if (spikedChanged) next.spiked = $('#event-spiked').checked;
      if (type && OBJECTS[next.type].obstruction !== 'rectangle') {
        const size = next.width ?? next.height;
        if (size !== undefined) next.width = next.height = size;
      }
    }
    if (!next.random && !next.group && next.kind === 'enemy' && ['wheel', 'snake', 'robo-cow'].includes(next.type)) Object.assign(next, snapWheel(next.x, next.y));
    return next;
  });
  level = validateDraft({ ...level, events });
  markChanged(); setSelection(); message(`Updated ${plural(selectedEvents.size, 'event')}.`);
}

function applyEventChanges() {
  if (readOnly() || !selectedEvents.size || !touched.size) return;
  attempt(() => {
    if (!form.checkValidity()) {
      form.reportValidity();
      throw new Error('Event settings contain an invalid value. Correct the highlighted field to apply your changes.');
    }
    applyToSelected();
  });
}
form.addEventListener('change', applyEventChanges);
form.addEventListener('submit', event => {
  event.preventDefault();
  applyEventChanges();
});
$('#new-event').addEventListener('click', () => {
  startPlacement();
  message('Placement mode is on. Click the playable area or enter coordinates and add an event.');
});
$('#duplicate-event').addEventListener('click', () => attempt(() => {
  const copies = selectedList().map(index => ({ ...level.events[index] }));
  level = validateDraft({ ...level, events: [...level.events, ...copies] });
  const first = level.events.length - copies.length;
  markChanged(); setSelection(copies.map((_, offset) => first + offset));
  message(`${copies.length === 1 ? 'Event' : `${copies.length} events`} duplicated at the same location and time. Drag the selection or edit its fields.`);
}));
function deleteSelected() {
  if (readOnly()) return;
  const count = selectedEvents.size;
  if (!count) return;
  level.events = level.events.filter((_, index) => !selectedEvents.has(index));
  markChanged(); setSelection([]); message(`${plural(count, 'event')} deleted.`);
}
$('#delete-event').addEventListener('click', deleteSelected);
for (const [selector, entries] of [
  ['#cat-block-trigger', Object.entries({
    spawn: 'Spawned pickup', carrier: 'Enemy carrier', chest: 'Treasure chest',
    time: 'Completion time', food: 'Minimum food points', enemyPoints: 'Minimum enemy points',
    goals: 'Minimum soccer goals', moves: 'Maximum moves', enemyMin: 'Minimum defeats by type',
    enemyMax: 'Maximum defeats by type', enemiesMax: 'Maximum total defeats',
    noSwords: 'No sword pickups', noHearts: 'No heart pickups',
    bricksMin: 'Minimum distinct bricks', bricksMax: 'Maximum distinct bricks',
    noSelect: 'Never select brick type', noTouch: 'Never touch brick type',
  })],
  ['#cat-block-enemy-type', Object.entries(CHARACTERS).filter(([type]) => !['koshi', 'tom'].includes(type))],
  ['#cat-block-brick-type', Object.entries(CAT_BRICK_TYPES)],
]) {
  for (const [value, text] of entries) {
    const option = document.createElement('option');
    option.value = value; option.textContent = text; $(selector).append(option);
  }
}
$('#settings-form').addEventListener('change', applyLevelSettings);
$('#settings-form').addEventListener('submit', event => {
  event.preventDefault();
  applyLevelSettings();
});
function applyLevelSettings() {
  if (readOnly()) return;
  attempt(() => {
    const form = $('#settings-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      throw new TypeError('Level settings contain an invalid value. Correct the highlighted field to apply your changes.');
    }
    const length = $('#autoscroll-enabled').checked ? Number($('#scroll-length').value) : 8;
    if (length !== (level.autoscroll?.length ?? 8) && level.brickGroups?.length) {
      throw new TypeError('Split combined bricks before changing the board length.');
    }
    const candidate = validateDraft({
      ...level, id: $('#level-name').value, duration: Number($('#duration').value),
      autoscroll: $('#autoscroll-enabled').checked ? {
        length, speed: Number($('#scroll-speed').value), events: level.autoscroll?.events ?? [],
      } : undefined,
      bossLevel: $('#boss-level-enabled').checked,
      survive: !$('#boss-level-enabled').checked && $('#win-condition').value === 'survive',
      catBlock: $('#cat-block-enabled').checked ? {
        description: readCatBlockTrigger() ? catBlockDescription(readCatBlockTrigger()) : level.catBlock.description,
        ...(readCatBlockTrigger() ? { trigger: readCatBlockTrigger() } : {}),
      } : undefined,
      goal: $('#boss-level-enabled').checked || $('#win-condition').value === 'survive' ? 0 : Number($('#goal').value),
      killGoal: $('#boss-level-enabled').checked || $('#win-condition').value === 'survive' ? 0 : Number($('#kill-goal').value),
      ...(Number($('#goals-goal').value) !== 0 || level.goalsGoal !== undefined ? {
        goalsGoal: $('#boss-level-enabled').checked || $('#win-condition').value === 'survive' ? 0 : Number($('#goals-goal').value),
      } : {}),
      ...($('#activation-limit').value !== '' || level.activationLimit !== undefined ? {
        activationLimit: $('#activation-limit').value === '' ? null : Number($('#activation-limit').value),
      } : {}),
      heartCost: $('#heart-cost').value === '' ? null : Number($('#heart-cost').value),
      ...($('#power-start').value === 'on' || level.powerOn !== undefined ? {
        powerOn: $('#power-start').value === 'on',
      } : {}),
    });
    level = candidate; markChanged(); populateSettings(); render(); message('Level settings applied.');
  });
}
function populateSettings() {
  $('#autoscroll-enabled').checked = Boolean(level.autoscroll);
  $('#scroll-length').value = level.autoscroll?.length ?? 16;
  $('#scroll-speed').value = level.autoscroll?.speed ?? .25;
  updateAutoscrollSettings();
  renderCameraTimeline();
  $('#level-name').value = level.number ?? level.id; $('#duration').value = level.duration; $('#goal').value = level.goal;
  $('#kill-goal').value = level.killGoal ?? 0;
  $('#goals-goal').value = level.goalsGoal ?? 0;
  $('#activation-limit').value = level.activationLimit ?? '';
  $('#power-start').value = level.powerOn ? 'on' : 'off';
  $('#win-condition').value = level.survive ? 'survive' : 'scores';
  $('#boss-level-enabled').checked = Boolean(level.bossLevel);
  updateWinCondition();
  $('#heart-cost').value = level.heartCost ?? '';
  $('#cat-block-enabled').checked = Boolean(level.catBlock);
  $('#cat-block-settings').disabled = !level.catBlock;
  $('#cat-block-settings').hidden = !level.catBlock;
  const trigger = level.catBlock?.trigger;
  // Keep old free-form hints intact until an author explicitly selects a trigger.
  $('#cat-block-trigger').value = trigger?.type ?? (level.catBlock ? '' : 'spawn');
  $('#cat-block-amount').value = trigger?.amount ?? 1;
  $('#cat-block-enemy-type').value = trigger?.enemyType ?? 'mouse';
  $('#cat-block-brick-type').value = trigger?.brickType ?? 'normal';
  updateCatBlockTrigger();
  $('#timeline').max = level.duration;
  $('#event-time').max = level.duration;
}
function updateAutoscrollSettings() {
  const enabled = $('#autoscroll-enabled').checked;
  $('#autoscroll-settings').disabled = !enabled;
  $('#autoscroll-settings').hidden = !enabled;
}
$('#autoscroll-enabled').addEventListener('change', updateAutoscrollSettings);

function renderCameraTimeline() {
  $('#camera-timeline').hidden = !level.autoscroll;
  $('#camera-access').disabled = readOnly();
  $('#camera-events').replaceChildren(...(level.autoscroll?.events ?? []).map((event, index) => {
    const row = document.createElement('div');
    row.className = 'camera-event';
    for (const [field, title, max] of [['time', 'Time (seconds)', level.duration], ['speed', 'Speed (bricks / second)', 100]]) {
      const label = document.createElement('label'), input = document.createElement('input');
      label.textContent = title;
      input.type = 'number'; input.min = 0; input.max = max; input.step = 'any';
      input.value = event[field];
      input.addEventListener('change', () => attempt(() => {
        if (readOnly()) return;
        const events = level.autoscroll.events.map((entry, i) => i === index ? { ...entry, [field]: input.value === '' ? NaN : Number(input.value) } : entry);
        level = validateDraft({ ...level, autoscroll: { ...level.autoscroll, events } });
        markChanged(); renderCameraTimeline(); renderBoard();
        message('Camera speed change updated.');
      }, () => { input.value = event[field]; }));
      label.append(input); row.append(label);
    }
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => attempt(() => {
      if (readOnly()) return;
      level = validateDraft({ ...level, autoscroll: { ...level.autoscroll,
        events: level.autoscroll.events.filter((_, i) => i !== index) } });
      markChanged(); renderCameraTimeline(); renderBoard(); message('Camera speed change removed.');
    }));
    row.append(remove);
    return row;
  }));
}
$('#add-camera-event').addEventListener('click', () => attempt(() => {
  if (readOnly()) return;
  const time = Number($('#timeline').value);
  const events = [...level.autoscroll.events, { time, speed: previewGame.camera(time).speed }];
  level = validateDraft({ ...level, autoscroll: { ...level.autoscroll, events } });
  markChanged(); renderCameraTimeline(); renderBoard(); message('Camera speed change added. Edit its speed below.');
}));
function updateWinCondition() {
  const boss = $('#boss-level-enabled').checked;
  $('#win-condition').disabled = boss;
  const survive = boss || $('#win-condition').value === 'survive';
  $('#goal').disabled = survive;
  $('#kill-goal').disabled = survive;
  $('#goals-goal').disabled = survive;
}
$('#win-condition').addEventListener('change', updateWinCondition);
$('#boss-level-enabled').addEventListener('change', updateWinCondition);
$('#cat-block-enabled').addEventListener('change', () => {
  $('#cat-block-settings').disabled = !$('#cat-block-enabled').checked;
  $('#cat-block-settings').hidden = !$('#cat-block-enabled').checked;
});
function readCatBlockTrigger() {
  const type = $('#cat-block-trigger').value;
  if (!type) return null;
  const definition = CAT_BLOCK_TRIGGERS[type];
  return {
    type,
    ...(definition.amount ? { amount: $('#cat-block-amount').value === '' ? NaN : Number($('#cat-block-amount').value) } : {}),
    ...(definition.enemy ? { enemyType: $('#cat-block-enemy-type').value } : {}),
    ...(definition.brick ? { brickType: $('#cat-block-brick-type').value } : {}),
  };
}
function updateCatBlockTrigger() {
  const trigger = readCatBlockTrigger();
  const definition = trigger ? CAT_BLOCK_TRIGGERS[trigger.type] : {};
  for (const [field, enabled] of [['amount', definition.amount], ['enemy', definition.enemy], ['brick', definition.brick]]) {
    $(`#cat-block-${field}-label`).hidden = !enabled;
    const input = $(field === 'amount' ? '#cat-block-amount' : `#cat-block-${field}-type`);
    input.disabled = !enabled;
  }
  $('#cat-block-amount').min = trigger?.type === 'time' ? '.001' : '0';
  $('#cat-block-amount').step = trigger?.type === 'time' ? 'any' : '1';
  $('#cat-block-amount').required = Boolean(definition.amount);
  $('#cat-block-objective').textContent = trigger ? catBlockDescription(trigger) : catBlockObjective(level);
}
for (const selector of ['#cat-block-trigger', '#cat-block-amount', '#cat-block-enemy-type', '#cat-block-brick-type']) {
  $(selector).addEventListener(selector === '#cat-block-amount' ? 'input' : 'change', updateCatBlockTrigger);
}
let cutsceneError = null;
function readSceneLine(row) {
  return {
    speaker: row.querySelector('.scene-speaker').value,
    text: row.querySelector('.scene-text').value,
    actors: [...row.querySelectorAll('.scene-cast input:checked')].flatMap(checkbox => {
      const existing = row.sceneActors.filter(actor => actor.character === checkbox.value);
      return existing.length ? existing : [{ character: checkbox.value, x: { koshi: .28, mouse: .67, wheel: .82, tom: .5, ram: .12, bucket: .9, ball: .5, jackolantern: .5, snake: .56, goalie: .5 }[checkbox.value], y: .65 }];
    }),
  };
}
function addSceneLine(line = { speaker: 'koshi', text: '', actors: [{ character: 'koshi', x: .28, y: .65 }, { character: 'mouse', x: .67, y: .65 }, { character: 'wheel', x: .82, y: .7 }] }) {
  const row = document.createElement('div');
  row.className = 'scene-line';
  const speakerLabel = document.createElement('label');
  speakerLabel.textContent = 'Speaker';
  const speaker = document.createElement('select');
  speaker.className = 'scene-speaker';
  for (const [value, name] of Object.entries(CHARACTERS)) {
    const option = document.createElement('option');
    option.value = value; option.textContent = name; speaker.append(option);
  }
  speaker.value = line.speaker; speakerLabel.append(speaker);
  const textLabel = document.createElement('label');
  textLabel.textContent = 'Dialogue (up to 240 characters)';
  const text = document.createElement('textarea');
  text.className = 'scene-text'; text.rows = 3; text.value = line.text;
  textLabel.append(text);
  const cast = document.createElement('div'); cast.className = 'scene-cast';
  for (const [character, name] of Object.entries(CHARACTERS)) {
    const label = document.createElement('label'), checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.value = character;
    checkbox.checked = line.actors.some(actor => actor.character === character);
    label.append(checkbox, `${name} on stage`); cast.append(label);
  }
  const updateSpeaker = () => {
    for (const checkbox of cast.querySelectorAll('input')) {
      checkbox.disabled = checkbox.value === speaker.value;
      if (checkbox.disabled) checkbox.checked = true;
    }
  };
  speaker.addEventListener('change', updateSpeaker); updateSpeaker();
  const remove = document.createElement('button');
  remove.type = 'button'; remove.textContent = 'Remove line';
  remove.addEventListener('click', () => {
    if (readOnly()) return;
    row.remove();
    applyCutscene();
  });
  row.sceneActors = line.actors.map(actor => ({ ...actor }));
  row.append(speakerLabel, textLabel, cast, remove);
  $('#scene-lines').append(row);
}
function populateCutscene() {
  cutsceneError = null;
  $('#scene-enabled').checked = Boolean(level.cutscene);
  $('#scene-fields').disabled = !level.cutscene;
  $('#scene-theme').value = level.cutscene?.theme ?? 'garden';
  $('#scene-lines').replaceChildren();
  if (level.cutscene) level.cutscene.lines.forEach(addSceneLine);
  else addSceneLine();
}
$('#scene-enabled').addEventListener('change', () => { $('#scene-fields').disabled = !$('#scene-enabled').checked; });
$('#scene-add-line').addEventListener('click', () => {
  if (readOnly()) return;
  if ($('#scene-lines').children.length >= 100) { message('Cutscenes support at most 100 dialogue lines.', true); return; }
  const previous = $('#scene-lines').lastElementChild;
  addSceneLine(previous ? { ...readSceneLine(previous), text: '' } : undefined);
  applyCutscene();
});
function applyCutscene() {
  if (readOnly()) return;
  attempt(() => {
    const candidate = { ...level };
    if ($('#scene-enabled').checked) {
      candidate.cutscene = {
        theme: $('#scene-theme').value,
        lines: [...$('#scene-lines').children].map(readSceneLine),
      };
    } else delete candidate.cutscene;
    level = validateDraft(candidate);
    cutsceneError = null;
    markChanged(); message('Cutscene updated. Playtest to watch it before the level starts.');
  }, () => {
    cutsceneError = new Error($('#editor-message').textContent);
    dirty = true;
  });
}
for (const type of ['input', 'change']) $('#cutscene-form').addEventListener(type, applyCutscene);
$('#cutscene-form').addEventListener('submit', event => {
  event.preventDefault();
  applyCutscene();
});
function addInfoPage(page = { title: 'New concept', text: '', graphics: [] }) {
  const row = document.createElement('fieldset');
  row.className = 'info-page';
  const legend = document.createElement('legend'); legend.textContent = 'Information page';
  const titleLabel = document.createElement('label'); titleLabel.textContent = 'Title';
  const title = document.createElement('input');
  title.className = 'info-title'; title.maxLength = 80; title.required = true; title.value = page.title;
  titleLabel.append(title);
  const textLabel = document.createElement('label'); textLabel.textContent = 'Explanation';
  const text = document.createElement('textarea');
  text.className = 'info-text'; text.maxLength = 2000; text.required = true; text.rows = 5; text.value = page.text;
  textLabel.append(text);
  const graphicsLabel = document.createElement('label'); graphicsLabel.textContent = 'Component graphics (up to six; select multiple)';
  const graphics = document.createElement('select'); graphics.className = 'info-graphics-select'; graphics.multiple = true; graphics.size = 8;
  for (const [id, name] of Object.entries(INFO_GRAPHICS)) {
    const option = document.createElement('option'); option.value = id; option.textContent = `${id.split(':')[0]} - ${name}`;
    option.selected = page.graphics.includes(id); graphics.append(option);
  }
  graphicsLabel.append(graphics);
  const preview = document.createElement('div'); preview.className = 'info-graphics-preview';
  const updatePreview = () => {
    preview.replaceChildren(...[...graphics.selectedOptions].map(option => {
      const [kind, type] = option.value.split(':');
      const control = kind === 'slime' ? 'info-slime'
        : kind === 'brick' && Object.hasOwn(COOLDOWNS, type) ? 'info-steering'
          : ['brick', 'special'].includes(kind) ? 'brick-kind' : 'brick-spawn-item';
      const image = picture(['brick', 'slime', 'special'].includes(kind) ? type : option.value, control);
      image.title = option.textContent;
      return image;
    }));
  };
  graphics.addEventListener('change', updatePreview); updatePreview();
  const actions = document.createElement('div'); actions.className = 'file-actions';
  for (const [label, action] of [
    ['Move up', () => { if (row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling); }],
    ['Move down', () => { if (row.nextElementSibling) row.parentElement.insertBefore(row.nextElementSibling, row); }],
    ['Remove page', () => row.remove()],
  ]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.addEventListener('click', action); actions.append(button);
  }
  row.append(legend, titleLabel, textLabel, graphicsLabel, preview, actions);
  $('#info-pages').append(row);
}

function populateLevelInfo() {
  $('#info-enabled').checked = Boolean(level.levelInfo);
  $('#info-fields').disabled = !level.levelInfo;
  $('#info-pages').replaceChildren();
  (level.levelInfo?.pages ?? [{ title: 'New concept', text: '', graphics: [] }]).forEach(addInfoPage);
}
$('#info-enabled').addEventListener('change', () => { $('#info-fields').disabled = !$('#info-enabled').checked; });
$('#info-add-page').addEventListener('click', () => {
  if (readOnly()) return;
  if ($('#info-pages').children.length >= 20) { message('Level information supports at most 20 pages.', true); return; }
  addInfoPage();
});
$('#level-info-form').addEventListener('submit', event => {
  event.preventDefault();
  if (readOnly()) return;
  attempt(() => {
    const candidate = { ...level };
    if ($('#info-enabled').checked) {
      candidate.levelInfo = { pages: [...$('#info-pages').children].map(row => ({
        title: row.querySelector('.info-title').value,
        text: row.querySelector('.info-text').value,
        graphics: [...row.querySelector('.info-graphics-select').selectedOptions].map(option => option.value),
      })) };
    } else delete candidate.levelInfo;
    level = validateDraft(candidate);
    markChanged(); populateLevelInfo(); message('Level information applied. Playtest to view it before the objectives.');
  });
});

function replaceLevel(value) {
  const candidate = validateDraft(value);
  pausePreview();
  level = candidate; selectedTrackId = ''; populateTrackForm();
  placing = true; markChanged(); populateSettings(); populateCutscene(); populateLevelInfo(); setSelection([], []);
}
let previewPlayback = null;

function pausePreview() {
  if (previewPlayback) cancelAnimationFrame(previewPlayback.frame);
  previewPlayback = null;
  $('#preview-play').textContent = 'Play';
  $('#preview-play').setAttribute('aria-pressed', 'false');
}

function previewFrame(timestamp) {
  if (!previewPlayback) return;
  const time = previewPlayback.time + Math.max(0, timestamp - previewPlayback.timestamp) / 1000 * previewPlayback.speed;
  renderPreviewTime(time, true);
  if (previewPlayback) previewPlayback.frame = requestAnimationFrame(previewFrame);
}

$('#preview-play').addEventListener('click', () => {
  if (previewPlayback) { pausePreview(); return; }
  const time = Number($('#timeline').value);
  if (time >= level.duration) return;
  previewPlayback = { time, timestamp: performance.now(), speed: Number($('#preview-speed').value) };
  $('#preview-play').textContent = 'Pause';
  $('#preview-play').setAttribute('aria-pressed', 'true');
  previewPlayback.frame = requestAnimationFrame(previewFrame);
});
$('#preview-speed').addEventListener('input', () => {
  if (previewPlayback) {
    const timestamp = performance.now();
    const time = previewPlayback.time + (timestamp - previewPlayback.timestamp) / 1000 * previewPlayback.speed;
    renderPreviewTime(time, true);
    if (previewPlayback) Object.assign(previewPlayback, { time, timestamp, speed: Number($('#preview-speed').value) });
  }
  $('#preview-speed-label').textContent = `${$('#preview-speed').value}x`;
});
$('#timeline').addEventListener('input', () => {
  pausePreview();
  renderPreviewTime(discretePreviewTime(Number($('#timeline').value)), true);
});
function discretePreviewTime(time) {
  const step = Number($('#timeline-discretization').value);
  if (!step) return time;
  return Math.max(0, Math.min(Math.floor(level.duration / step), Math.round(time / step))) * step;
}
$('#timeline').addEventListener('keydown', event => {
  const step = Number($('#timeline-discretization').value);
  if (!step) return;
  const direction = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[event.key];
  if (!direction && !['Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  pausePreview();
  const time = Number($('#timeline').value);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? level.duration
    : ((direction > 0 ? Math.floor(time / step) : Math.ceil(time / step)) + direction) * step;
  renderPreviewTime(discretePreviewTime(next), true);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pausePreview(); });
window.addEventListener('pagehide', pausePreview);
for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, event => {
  if (event.target.closest('#editor-board, #event-list, #inspector-access')) pausePreview();
}, true);
$('#show-all').addEventListener('change', renderBoard);
$('#show-random').addEventListener('change', renderBoard);
$('#dynamic-view').addEventListener('change', () => renderPreviewTime());
$('#orientation').addEventListener('change', renderBoard);
$('#full-grid').addEventListener('change', renderBoard);
new ResizeObserver(renderBoard).observe($('#editor-board-scroll'));
function validateSavedLevel() {
  if (trackDrawing) throw new Error('Apply the Cat Track or Cancel edits before printing JSON or playtesting.');
  if (cutsceneError) throw cutsceneError;
  if (selectedEvents.size && touched.size) throw new Error('Finish or correct the selected event changes before printing JSON or playtesting.');
  return validateCustomLevel(level, { requireCatBlockConsistency: true });
}
$('#generate-json').addEventListener('click', () => attempt(() => {
  const valid = validateSavedLevel();
  $('#level-json').value = JSON.stringify(valid, null, 2); message('Full JSON printed from the current level settings and events.');
}));
$('#import-json').addEventListener('click', () => attempt(() => {
  replaceLevel(JSON.parse($('#level-json').value)); message('JSON loaded. Review the placements or playtest the level.');
}));
$('#import-file-button').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async () => {
  const input = $('#import-file');
  const file = input.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    replaceLevel(JSON.parse(text));
    $('#level-json').value = text;
    message(`${file.name} loaded. Review the placements or playtest the level.`);
  } catch (error) {
    console.error('Level editor:', error);
    message(`Could not load ${file.name}: ${error.message}`, true);
  } finally {
    input.value = '';
  }
});
$('#new-level').addEventListener('click', () => {
  if (dirty && !confirm('Discard this unsaved level and start a new one?')) return;
  replaceLevel(blank()); message('New level created.');
});
$('#playtest').addEventListener('click', event => {
  event.preventDefault();
  attempt(() => {
    if (readOnly()) { location.href = $('#playtest').href; return; }
    validateSavedLevel();
    // The fragment carries the snapshot without requiring storage access or a server.
    history.replaceState(history.state, '', `#level=${encodeURIComponent(JSON.stringify(level))}`);
    committed = JSON.stringify(level); dirty = false;
    location.href = $('#playtest').href;
  });
});
window.addEventListener('beforeunload', event => {
  if (readOnly() ? customWorkspace?.dirty : dirty) { event.preventDefault(); event.returnValue = ''; }
});

board.addEventListener('pointerdown', addTrackNode, true);
board.addEventListener('pointermove', dragTrackNode, true);
board.addEventListener('pointerup', finishTrackNodeDrag, true);
board.addEventListener('pointercancel', finishTrackNodeDrag, true);
setupPalettes();
setupObstructionColors();
typeOptions();
if (location.hash.startsWith('#level=')) {
  attempt(() => {
    level = validateDraft(JSON.parse(decodeURIComponent(location.hash.slice(7))));
    committed = JSON.stringify(level); message('Playtest snapshot restored. Continue editing or import a different level.');
  });
}
populateSettings(); populateCutscene(); populateLevelInfo(); updatePlaytest(); populateEventForm(); render();
campaignMode.setup({
  reportError: error => message(`Game selection could not be saved or restored: ${error.message}`, true),
  beforeSwitch: () => !(readOnly() ? customWorkspace?.dirty : dirty)
    || confirm('Discard this unsaved editor level and switch games? Print JSON and save the text first to keep it.'),
  onSwitch: () => {
    dirty = false;
    if (customWorkspace) customWorkspace.dirty = false;
  },
});
})();
