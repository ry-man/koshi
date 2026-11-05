(function () {
'use strict';

const { Game, LEVELS, FOODS, ITEMS, OBJECTS, SWORDS, COOLDOWNS, SLIMES, SHIELDS, CHARACTERS, PORTALS, CONTACT_SURFACES, obstructionGeometry, portalPairIssues, validateCustomLevel, snapWheel, brickRegions, brickEditRegions, brickShape, brickSlime, brickSpring, brickSpikes, brickConveyor } = globalThis.KoshiGame;
const { decorateBrick, exposePortalCloud, exposeBrickInfo, specialLabel, spawnSymbol, spawnColor, drawObstruction, FENCE } = globalThis.KoshiBrickVisuals;
const $ = selector => document.querySelector(selector);
const board = $('#editor-board');
const form = $('#event-form');
const storageKey = 'koshi-level-editor-v1';
const blank = () => ({ version: 1, id: 'My level', duration: 60, goal: 20, heartCost: null, brickSet: 1, events: [] });
const validateDraft = value => validateCustomLevel(value, { allowUnpairedPortals: true });
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
for (const [kind, types] of Object.entries({ food: FOODS, weapon: SWORDS, enemy: { mouse: { name: 'Robo Mouse' }, wheel: { name: 'Robo Wheel' }, ram: { name: 'Robo Ram' }, bucket: { name: 'Robo Bucket' }, ball: { name: 'Robo Ball' }, jackolantern: { name: 'Robo Jackolantern' }, snake: { name: 'Robo Snake' }, goalie: { name: 'Robo Goalie' }, 'robo-koshi': { name: 'Robo Koshi' }, 'robo-snail': { name: 'Robo Snail' }, 'robo-cow': { name: 'Robo Cow' }, 'robo-unicorn': { name: 'Robo Unicorn' } }, heart: { heart: { name: 'Heart' } }, item: ITEMS, object: OBJECTS })) {
  const group = document.createElement('optgroup');
  group.label = kind;
  for (const [type, item] of Object.entries(types)) {
    const option = document.createElement('option');
    option.value = `${kind}:${type}`; option.textContent = item.name;
    group.append(option);
  }
  $('#brick-spawn-item').append(group);
}
let level = blank();
let selectedEvents = new Set();
let selectedBricks = new Set();
let combineOwner = null;
let placing = true;
let previewGame;
let gesture = null;
let touched = new Set();
let dirty = false;
let committed = JSON.stringify(level);
let campaignIndex = null;
let customWorkspace = null;
const readOnly = () => campaignIndex !== null;
const accessFields = ['#settings-access', '#cutscene-access', '#inspector-access', '#files-access'];
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
    ...(lifetime == null ? {} : { lifetime }), ...(shield == null ? {} : { shield }),
  });
  for (const entry of game.level.food) {
    for (const food of game.createFood(entry)) add('food', entry[0], entry[2], food, entry[3]);
  }
  for (const entry of game.level.enemies) {
    for (const enemy of game.createEnemies(entry)) add('enemy', entry[0], entry[1], enemy, null, entry[3]);
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
  $('#level-access').textContent = locked
    ? `${level.number} - ${level.name}: read-only game level. Inspect bricks, events, cutscenes and timing; editing, import, export and draft saving are disabled. Your custom work is preserved. Spawn positions are representative; the game randomizes them each run.`
    : 'Custom levels are editable. Game levels are available for read-only inspection.';
  $('#board-hint').hidden = locked;
  $('#playtest').textContent = locked ? 'Play game level →' : 'Playtest →';
}

function selectEditorLevel() {
  const value = $('#editor-level').value;
  if (value !== 'custom' && !readOnly()) {
    customWorkspace = { level, committed, dirty, placing, selectedEvents, selectedBricks,
      sceneLines: [...$('#scene-lines').childNodes],
      sceneFieldsDisabled: $('#scene-fields').disabled,
      fields: [...document.querySelectorAll('input, select, textarea')].filter(node => node.id !== 'editor-level')
        .map(node => ({ node, value: node.value, checked: node.checked })) };
  }
  if (value === 'custom') {
    if (!customWorkspace) return;
    campaignIndex = null;
    ({ level, committed, dirty, placing, selectedEvents, selectedBricks } = customWorkspace);
  } else {
    campaignIndex = Number(value);
    level = campaignPreview(campaignIndex);
    placing = false; selectedEvents = new Set(); selectedBricks = new Set();
    $('#timeline').value = 0;
  }
  gesture = null; $('#selection-box').hidden = true;
  populateSettings(); populateCutscene(); populateEventForm(); updatePlaytest(); render();
  if (!readOnly()) {
    $('#scene-lines').replaceChildren(...customWorkspace.sceneLines);
    $('#scene-fields').disabled = customWorkspace.sceneFieldsDisabled;
    for (const { node, value: savedValue, checked } of customWorkspace.fields) {
      if (node.isConnected) { node.value = savedValue; node.checked = checked; }
    }
    updateWinCondition(); syncPalettes(); render();
    customWorkspace = null;
  }
  syncAccess();
  message(readOnly() ? 'Game level opened read-only. Select your custom level to resume editing.' : 'Your custom workspace restored.');
}
$('#editor-level').addEventListener('change', () => attempt(selectEditorLevel));
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
  turret: 'M-22 13 A22 22 0 0 1 22 13 M-3 0 H19 V-7 H5 M23 -7 H29',
  crumbler: 'M-22 -12 H22 V12 H-22 Z M-4 -12 L2 -4 L-5 2 L5 12',
  warped: 'M-20 -4 C-24 -22 6 -22 7 -5 S-18 16 -8 1 S19 -12 21 8',
};

function picture(value, control) {
  const image = document.createElement('span');
  image.className = 'palette-picture';
  const item = control === 'event-kind' ? { kind: value, type: { food: 'S', enemy: 'mouse', weapon: 'wood', item: 'smiley-cookie', object: 'soccer-ball' }[value] }
    : control === 'event-type' ? { kind: $('#event-kind').value, type: value }
    : control === 'brick-spawn-item' ? { kind: value.split(':')[0], type: value.split(':')[1] } : null;
  if (item && item.kind && item.type) {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), path = document.createElementNS(ns, 'path');
    svg.setAttribute('viewBox', item.type === 'robo-snail' ? '-32 -32 64 64'
      : item.type === 'robo-unicorn' ? '-38 -44 76 76'
        : item.type === 'robo-cow' ? '-35 -30 70 60' : '-28 -28 56 56'); svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('d', spawnSymbol(item));
    svg.append(path); image.append(svg);
    image.style.color = spawnColor(item);
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
  } else if (['portal', 'toggle', 'spawner', 'boost', 'cinder', 'goal'].includes(value) || control === 'brick-toggle-clicks') {
    const brick = { x: 0, y: 0, w: 88, h: 52 };
    if (value === 'portal') brick.portal = 'purple';
    if (value === 'toggle' || control === 'brick-toggle-clicks') { brick.toggle = control === 'brick-toggle-clicks' ? Number(value) : 1; brick.toggleRemaining = brick.toggle; }
    if (value === 'spawner') brick.spawner = { kind: 'heart', type: 'heart' };
    if (value === 'boost') brick.boost = true;
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
  button.addEventListener('click', action);
  return button;
}

function setupPalettes() {
  for (const id of ['brick-kind', 'brick-slime-color', 'brick-conveyor-direction', 'brick-portal-color', 'brick-toggle-clicks', 'brick-spawn-item', 'event-kind', 'event-type']) {
    const select = $(`#${id}`), palette = document.createElement('div');
    select.hidden = true;
    palette.className = 'visual-palette'; palette.setAttribute('role', 'group');
    palette.setAttribute('aria-label', select.parentElement.textContent.trim().split('\n')[0].split(select.options[0]?.textContent ?? '\n')[0].trim() || id);
    select.parentElement.after(palette);
    palettes.set(id, { select, palette, signature: null, buttons: [] });
  }
  for (const [container, attributes] of [['surface-palette', ['plain', ...CONTACT_SURFACES]], ['attribute-palette', ['crumbler', 'warped', 'toggle']]]) {
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
      palette.replaceChildren(...entry.buttons); entry.signature = signature;
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
  for (const id of ['brick-uses', 'brick-warp-seconds', 'brick-spawn-lifetime', 'brick-spawn-shield']) $(`#${id}`).parentElement.hidden = $(`#${id}`).disabled;
}

function message(text, error = false) {
  $('#editor-message').textContent = text;
  $('#editor-message').dataset.error = String(error);
}

function attempt(action) {
  try { action(); }
  catch (error) {
    console.error('Level editor:', error);
    message(error.message, true);
  }
}

function markChanged() {
  if (readOnly()) return;
  dirty = JSON.stringify(level) !== committed;
  updatePlaytest();
}

function updatePlaytest() {
  $('#playtest').href = readOnly() ? `./index.html#campaign=${encodeURIComponent(level.number)}`
    : `./index.html#level=${encodeURIComponent(JSON.stringify(level))}`;
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
    : kind === 'weapon' ? Object.entries(SWORDS).map(([key, sword]) => [key, sword.name])
      : kind === 'item' ? Object.entries(ITEMS).map(([key, item]) => [key, item.name])
        : kind === 'object' ? Object.entries(OBJECTS).map(([key, item]) => [key, item.name])
        : [['mouse', 'Robo Mouse'], ['wheel', 'Robo Wheel'], ['ram', 'Robo Ram'], ['bucket', 'Robo Bucket'], ['ball', 'Robo Ball'], ['jackolantern', 'Robo Jackolantern'], ['snake', 'Robo Snake'], ['goalie', 'Robo Goalie'], ['robo-koshi', 'Robo Koshi'], ['robo-snail', 'Robo Snail'], ['robo-cow', 'Robo Cow'], ['robo-unicorn', 'Robo Unicorn']];
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
  const obstruction = kind === 'object' && OBJECTS[$('#event-type').value]?.obstruction;
  $('#event-obstruction').hidden = !obstruction;
  $('#event-obstruction').disabled = !obstruction;
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
}

function readObstructionFields(prefix) {
  return Object.fromEntries(['color', 'pattern', 'patternColor'].map(field => [field, $(`#${prefix}-${field}`).value]));
}

function setupObstructionColors() {
  for (const prefix of ['event', 'brick-spawn']) for (const field of ['color', 'patternColor']) {
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
    : event.kind === 'weapon' ? SWORDS[event.type].name
      : event.kind === 'item' ? ITEMS[event.type].name
        : event.kind === 'object' ? OBJECTS[event.type].name
        : `${CHARACTERS[event.type]}${event.shield ? ` · ${event.shield} shield (${SHIELDS[event.shield].hits} points)` : ''}`;
}

function icon(event) {
  if (event.kind === 'enemy' && ['robo-snail', 'robo-cow', 'robo-unicorn'].includes(event.type)) return picture(`enemy:${event.type}`, 'brick-spawn-item');
  return event.kind === 'food' ? FOODS[event.type].icon
    : event.kind === 'weapon' ? '⚔'
      : event.kind === 'item' ? ITEMS[event.type].icon
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
  if (event.kind === 'object' && OBJECTS[event.type]?.obstruction) Object.assign(event, readObstructionFields('event'));
  if (event.kind === 'enemy' && ['wheel', 'snake', 'robo-cow'].includes(event.type)) Object.assign(event, snapWheel(event.x, event.y));
  return event;
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
    setNumber('#event-x', items.map(event => event.x), 100);
    setNumber('#event-y', items.map(event => event.y), 100);
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
  $('#inspector-heading').textContent = readOnly() ? !items.length ? 'READ-ONLY GAME LEVEL'
    : multi ? `VIEWING ${items.length} EVENTS` : `VIEWING EVENT ${indices[0] + 1}`
    : !items.length ? 'NEW PLACEMENT' : multi ? `EDITING ${items.length} EVENTS` : `EDITING EVENT ${indices[0] + 1}`;
  $('#apply-event').textContent = !items.length ? 'Add event' : multi ? `Apply to ${items.length} events` : 'Apply event changes';
  $('#duplicate-event').disabled = !items.length;
  $('#delete-event').disabled = !items.length;
  $('#duplicate-event').textContent = multi ? `Duplicate ${items.length}` : 'Duplicate';
  $('#delete-event').textContent = multi ? `Delete ${items.length}` : 'Delete';
  $('#multi-event-help').hidden = !multi;
  syncPalettes();
}

function setSelection(events = selectedEvents, bricks = selectedBricks) {
  selectedEvents = new Set(events);
  selectedBricks = new Set(bricks);
  if (selectedEvents.size) placing = false;
  $('#brick-panel').open = Boolean(selectedBricks.size);
  $('#event-panel').open = Boolean(selectedEvents.size) || !selectedBricks.size;
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
    const time = document.createElement('span'); time.className = 'event-time'; time.textContent = `${event.time}s`;
    const location = document.createElement('span'); location.className = 'event-location';
    location.textContent = `X ${(event.x * 100).toFixed(1)}% · Y ${(event.y * 100).toFixed(1)}%${['food', 'item', 'weapon'].includes(event.kind) ? event.lifetime == null ? ' · until level ends' : ` · lasts ${event.lifetime}s` : event.kind === 'object' ? OBJECTS[event.type].obstruction ? ` · fixed, ${event.pattern ?? 'solid'}` : event.type === 'soccer-ball' ? ' · persistent, kickable' : ' · persistent' : ''} · #${index + 1}`;
    button.append(time, description(event), location);
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
  const obstructions = chosen.map(brick => brick.spawner).filter(spawn => spawn?.kind === 'object' && OBJECTS[spawn.type]?.obstruction);
  $('#brick-spawn-obstruction').hidden = inert || !obstructions.length;
  $('#brick-spawn-obstruction').disabled = inert || !obstructions.length;
  if (obstructions.length) populateObstructionFields('brick-spawn', obstructions);
  const turrets = chosen.map(brick => brick.turret).filter(Boolean);
  $('#brick-turret-type').disabled = inert || !turrets.length;
  $('#brick-turret-type').value = turrets.length && common(turrets) === MIXED ? '' : turrets[0] ?? 'laser';
  if ($('#brick-turret-type').parentElement) $('#brick-turret-type').parentElement.hidden = !turrets.length || inert;
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
    for (const selector of ['#brick-kind', '#brick-crumbler', '#brick-uses', '#brick-warped', '#brick-warp-seconds', '#brick-slimed', '#brick-springs', '#brick-spikes', '#brick-conveyor', '#brick-portal', '#brick-spawner', '#brick-boost', '#brick-barrier', '#brick-turret', '#brick-turret-type', '#brick-toggle']) $(selector).disabled = true;
    for (const selector of ['#brick-crumbler', '#brick-warped', '#brick-slimed', '#brick-springs', '#brick-spikes', '#brick-conveyor', '#brick-portal', '#brick-spawner', '#brick-boost', '#brick-barrier', '#brick-turret', '#brick-toggle']) $(selector).indeterminate = false;
    $('#brick-selection').textContent = 'Select one or more boundary bricks to change their attributes.';
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
  for (const attribute of [...CONTACT_SURFACES, 'toggle']) {
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
  board.dataset.tool = placing ? 'place' : 'select';
  previewGame = new Game(Math.random, { portrait, scale: portrait ? board.clientWidth / 600 : 1,
    ...(readOnly() ? { level: campaignIndex } : { customLevel: level }), editorPreview: true });
  const issues = portalPairIssues(previewGame.bricks);
  $('#portal-warning').hidden = !issues.length;
  $('#portal-warning').textContent = issues.length ? `Unfinished portals: ${issues.join(' ')} You can keep editing and save a draft; fix these before export or playtest.` : '';
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
    const special = decorateBrick(element, brick, members);
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
  $('#playable-area').style.cssText = `left:${b.left / previewGame.width * 100}%;top:${b.top / previewGame.height * 100}%;width:${(b.right - b.left) / previewGame.width * 100}%;height:${(b.bottom - b.top) / previewGame.height * 100}%`;
  const time = Number($('#timeline').value);
  $('#time-label').textContent = `${time.toFixed(1)}s`;
  $('#place-mode').setAttribute('aria-pressed', String(placing));
  $('#select-mode').setAttribute('aria-pressed', String(!placing));
  const summary = [selectedBricks.size && plural(selectedBricks.size, 'brick'), selectedEvents.size && plural(selectedEvents.size, 'event')].filter(Boolean);
  $('#selection-summary').textContent = summary.length ? `${summary.join(' + ')} selected` : 'Nothing selected';
  $('#clear-selection').disabled = !summary.length;
  const markers = $('#markers'); markers.replaceChildren();
  level.events.forEach((event, index) => {
    if (!$('#show-all').checked && (event.time > time || (event.lifetime != null && event.time + event.lifetime <= time))) return;
    const point = previewGame.pointFromRelative(event.x, event.y);
    const marker = document.createElement('button');
    marker.className = 'marker'; marker.type = 'button'; marker.dataset.kind = event.kind; marker.dataset.index = index;
    marker.style.left = `${point.x / previewGame.width * 100}%`; marker.style.top = `${point.y / previewGame.height * 100}%`;
    marker.style.color = event.kind === 'weapon' ? SWORDS[event.type].color : '';
    if (event.shield) marker.style.boxShadow = `0 0 0 3px ${SHIELDS[event.shield].color}`;
    marker.setAttribute('aria-label', `Event ${index + 1}: ${description(event)} at ${event.time}s`);
    marker.setAttribute('aria-pressed', String(selectedEvents.has(index)));
    const label = document.createElement('small'); label.textContent = `${event.time}s`;
    if (event.kind === 'object' && OBJECTS[event.type].obstruction) {
      const { width, height } = obstructionGeometry(event);
      marker.classList.add('obstruction-marker');
      marker.style.width = `${(width + 4) / previewGame.width * 100}%`;
      marker.style.height = `${(height + 4) / previewGame.height * 100}%`;
      const image = document.createElement('canvas');
      image.width = width + 4; image.height = height + 4;
      image.setAttribute('aria-hidden', 'true');
      drawObstruction(image.getContext('2d'), { ...event, x: image.width / 2, y: image.height / 2 });
      marker.append(image, label);
    } else marker.append(icon(event), label);
    marker.addEventListener('click', click => {
      click.stopPropagation();
      if (click.detail !== 0 && !readOnly()) return;
      choose('event', index, isAdditive(click));
      focusMarker(index);
    });
    marker.addEventListener('pointerdown', down => {
      if (readOnly()) { down.stopPropagation(); return; }
      if (down.button !== 0 || gesture) return;
      down.preventDefault(); down.stopPropagation();
      startGesture(down, { type: 'marker', index });
    });
    marker.addEventListener('keydown', key => {
      if (readOnly()) return;
      const direction = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] }[key.key];
      if (!direction) return;
      key.preventDefault();
      if (!selectedEvents.has(index)) { selectedEvents = new Set([index]); selectedBricks = new Set(); }
      for (const item of selectedList()) moveEvent(item, level.events[item].x + direction[0] * .01, level.events[item].y + direction[1] * .01);
      markChanged(); setSelection();
      focusMarker(index);
    });
    markers.append(marker);
  });
  syncAccess();
}

function render() {
  renderBoard(); renderList();
}

function focusMarker(index) { board.querySelector(`.marker[data-index="${index}"]`)?.focus({ preventScroll: true }); }
function focusBrick(key) { board.querySelector(`.editor-brick[data-region="${key}"]`)?.focus({ preventScroll: true }); }

function moveEvent(index, x, y) {
  if (readOnly()) return;
  const event = level.events[index];
  let point = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  if (event.kind === 'enemy' && ['wheel', 'snake', 'robo-cow'].includes(event.type)) point = snapWheel(point.x, point.y);
  Object.assign(event, point);
}

function pointerPosition(event) {
  const rect = board.getBoundingClientRect(), b = previewGame.bounds();
  const x = (event.clientX - rect.left - board.clientLeft) / board.clientWidth * previewGame.width;
  const y = (event.clientY - rect.top - board.clientTop) / board.clientHeight * previewGame.height;
  return { x: (x - b.left) / (b.right - b.left), y: (y - b.top) / (b.bottom - b.top) };
}

function startGesture(event, target) {
  if (readOnly() && target.type === 'marker') return;
  gesture = { ...target, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, additive: isAdditive(event), moved: false };
  if (target.type === 'marker') {
    // Pressing an unselected marker adds it (or replaces the selection) so the drag moves it with the group.
    if (!selectedEvents.has(target.index)) {
      gesture.added = true;
      if (gesture.additive) selectedEvents = new Set([...selectedEvents, target.index]);
      else { selectedEvents = new Set([target.index]); selectedBricks = new Set(); }
    }
    gesture.start = pointerPosition(event);
    gesture.origins = new Map(selectedList().map(index => [index, { x: level.events[index].x, y: level.events[index].y }]));
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
  const events = [...board.querySelectorAll('.marker')].filter(element => {
    const r = element.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }).map(element => Number(element.dataset.index));
  if (gesture.additive) setSelection([...selectedEvents, ...events], [...selectedBricks, ...bricks]);
  else setSelection(events, bricks);
}

function placeAt(event) {
  if (readOnly()) return;
  const point = pointerPosition(event);
  if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
    message('Place objects inside the dotted playable area, not on bricks.', true); return;
  }
  if (!form.reportValidity()) return;
  attempt(() => {
    const item = { ...readEvent(), x: point.x, y: point.y };
    if (item.kind === 'enemy' && ['wheel', 'snake', 'robo-cow'].includes(item.type)) Object.assign(item, snapWheel(item.x, item.y));
    level = validateDraft({ ...level, events: [...level.events, item] });
    markChanged(); render();
    message(`Placed ${description(item)} at ${item.time}s. Keep clicking to place more, or use Select to choose markers.`);
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
  if (gesture.type === 'marker') {
    const point = pointerPosition(event);
    for (const [index, origin] of gesture.origins) moveEvent(index, origin.x + point.x - gesture.start.x, origin.y + point.y - gesture.start.y);
    renderBoard();
  } else drawBox(event);
});
board.addEventListener('pointerup', event => {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  if (board.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId);
  $('#selection-box').hidden = true;
  const current = gesture;
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
  if (gesture?.origins) for (const [index, origin] of gesture.origins) Object.assign(level.events[index], origin);
  gesture = null; $('#selection-box').hidden = true; markChanged(); render();
});
board.addEventListener('keydown', event => {
  if (event.key === 'Escape') { setSelection([], []); board.focus({ preventScroll: true }); }
  else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelected(); board.focus({ preventScroll: true }); }
  else if (event.key.toLowerCase() === 'a' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); selectAll(); }
});
function startPlacement() {
  if (readOnly()) return;
  placing = true; setSelection([], []);
  $('#event-panel').open = true;
  $('#brick-panel').open = false;
}
$('#place-mode').addEventListener('click', startPlacement);
$('#select-mode').addEventListener('click', () => { placing = false; render(); });
$('#select-all').addEventListener('click', selectAll);
$('#clear-selection').addEventListener('click', () => setSelection([], []));
function brickEntry(brick, region) {
  if (immutableBrick(brick.kind)) return { ...region, kind: brick.kind };
  return { ...region, kind: brick.kind, crumbler: brick.crumbler ?? null, warped: brick.warped ?? null,
    slimed: Boolean(brick.slimed), slimeColor: brick.slimeColor ?? 'green', springs: Boolean(brick.springs),
    spikes: Boolean(brick.spikes), conveyor: Boolean(brick.conveyor), conveyorDirection: brick.conveyorDirection ?? 'clockwise',
    portal: brick.portal ?? null, toggle: brick.toggle ?? null, spawner: brick.spawner ? { ...brick.spawner } : null, boost: Boolean(brick.boost), turret: brick.turret ?? null };
}
function saveBrick(event) {
  attempt(() => {
    const regions = brickEditRegions(previewGame.bricks);
    const targets = previewGame.bricks.map(brick => ({ brick, region: regions.get(brick.id) })).filter(({ brick, region }) => brick.absorbedBy === null && selectedBricks.has(regionKey(region)));
    if (!targets.length) throw new Error('Select a brick before changing its attributes.');
    const id = event.target.id;
    const number = selector => $(selector).value === '' ? null : Number($(selector).value);
    // Only the changed control is applied, so mixed values in other controls are preserved.
    const entries = targets.flatMap(({ brick, region }) => {
      const entry = brickEntry(brick, region);
      if (immutableBrick(brick.kind) && id !== 'brick-kind') throw new Error('Cinder and Goal bricks cannot have modifiers or contact surfaces. Change the brick type first.');
      if (id === 'brick-plain') for (const attribute of CONTACT_SURFACES) entry[attribute] = ['portal', 'spawner', 'turret'].includes(attribute) ? null : false;
      if (id === 'brick-conveyor-direction' && $('#brick-conveyor-direction').value !== MIXED) entry.conveyorDirection = $('#brick-conveyor-direction').value;
      if (id === 'brick-slime-color' && $('#brick-slime-color').value !== MIXED) entry.slimeColor = $('#brick-slime-color').value;
      if (id === 'brick-kind' && $('#brick-kind').value !== MIXED) entry.kind = $('#brick-kind').value;
      if (id === 'brick-turret-type' && $('#brick-turret-type').value !== MIXED && $('#brick-turret-type').value) entry.turret = $('#brick-turret-type').value;
      if (id === 'brick-crumbler') entry.crumbler = $('#brick-crumbler').checked ? entry.crumbler ?? number('#brick-uses') ?? 5 : null;
      if (id === 'brick-uses' && entry.crumbler && number('#brick-uses') !== null) entry.crumbler = number('#brick-uses');
      if (id === 'brick-warped') entry.warped = $('#brick-warped').checked ? entry.warped ?? number('#brick-warp-seconds') ?? 15 : null;
      if (id === 'brick-warp-seconds' && entry.warped && number('#brick-warp-seconds') !== null) entry.warped = number('#brick-warp-seconds');
      if (id === 'brick-toggle') entry.toggle = $('#brick-toggle').checked ? Number($('#brick-toggle-clicks').value || 1) : null;
      if (id === 'brick-toggle-clicks' && $('#brick-toggle-clicks').value !== MIXED) entry.toggle = Number($('#brick-toggle-clicks').value);
      if (id === 'brick-portal-color' && $('#brick-portal-color').value !== MIXED) entry.portal = $('#brick-portal-color').value;
      if (id === 'brick-spawn-item' && $('#brick-spawn-item').value !== MIXED) {
        const [kind, type] = $('#brick-spawn-item').value.split(':');
        entry.spawner = { kind, type };
        if (kind === 'food') entry.spawner.lifetime = number('#brick-spawn-lifetime') ?? 15;
        else if (['item', 'weapon'].includes(kind) && number('#brick-spawn-lifetime') !== null) entry.spawner.lifetime = number('#brick-spawn-lifetime');
        if (kind === 'enemy') entry.spawner.shield = $('#brick-spawn-shield').value === 'none' || !$('#brick-spawn-shield').value ? null : $('#brick-spawn-shield').value;
      }
      if (id === 'brick-spawn-shield' && entry.spawner?.kind === 'enemy' && $('#brick-spawn-shield').value !== MIXED) entry.spawner.shield = $('#brick-spawn-shield').value === 'none' ? null : $('#brick-spawn-shield').value;
      if (id === 'brick-spawn-lifetime' && ['food', 'item', 'weapon'].includes(entry.spawner?.kind)) {
        const lifetime = number('#brick-spawn-lifetime');
        if (lifetime !== null) entry.spawner.lifetime = lifetime;
        else if (entry.spawner.kind === 'food') throw new Error('Food needs a lifetime in seconds.');
        else delete entry.spawner.lifetime;
      }
      const editedSurface = id === 'brick-portal-color' ? 'portal' : id === 'brick-spawn-item' ? 'spawner'
        : id === 'brick-turret-type' ? 'turret' : null;
      if (editedSurface && entry[editedSurface]) {
        for (const other of CONTACT_SURFACES) if (other !== editedSurface) entry[other] = ['portal', 'spawner', 'turret'].includes(other) ? null : false;
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
        else entry[attribute] = $(`#${id}`).checked;
        if (entry[attribute]) {
          for (const other of CONTACT_SURFACES) if (other !== attribute) entry[other] = ['portal', 'spawner', 'turret'].includes(other) ? null : false;
        }
      }
      if (entry.spawner?.kind === 'object' && OBJECTS[entry.spawner.type]?.obstruction) {
        if (id === 'brick-spawn-item' || id === 'brick-spawner') Object.assign(entry.spawner, readObstructionFields('brick-spawn'));
        for (const field of ['color', 'pattern', 'patternColor']) {
          if (id === `brick-spawn-${field}` && $(`#${id}`).value !== MIXED) entry.spawner[field] = $(`#${id}`).value;
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
for (const selector of ['#brick-kind', '#brick-crumbler', '#brick-uses', '#brick-warped', '#brick-warp-seconds', '#brick-slimed', '#brick-slime-color', '#brick-springs', '#brick-spikes', '#brick-conveyor', '#brick-conveyor-direction', '#brick-portal', '#brick-portal-color', '#brick-toggle', '#brick-toggle-clicks', '#brick-spawner', '#brick-spawn-item', '#brick-spawn-lifetime', '#brick-boost', '#brick-barrier', '#brick-turret', '#brick-turret-type']) {
  $(selector).addEventListener('change', saveBrick);
}
$('#combine-bricks').addEventListener('click', combineBricks);
$('#split-bricks').addEventListener('click', splitBricks);
$('#reset-brick-types').addEventListener('click', () => {
  delete level.brickTypes;
  delete level.brickGroups;
  selectedBricks = new Set();
  markChanged(); renderBoard(); message('Individual brick edits cleared. Boundary preset restored.');
});
$('#event-kind').addEventListener('change', () => {
  const previousKind = $('#event-lifetime').dataset.kind;
  typeOptions();
  if (previousKind !== $('#event-kind').value) $('#event-lifetime').value = $('#event-kind').value === 'food' ? 5 : '';
  touched.add('#event-kind'); touched.add('#event-type');
});
$('#event-type').addEventListener('change', () => {
  typeOptions($('#event-type').value);
  touched.add('#event-type');
});
for (const field of ['color', 'pattern', 'patternColor']) {
  $(`#event-${field}`).addEventListener('input', () => touched.add(`#event-${field}`));
  $(`#brick-spawn-${field}`).addEventListener('change', event => attempt(() => saveBrick(event)));
}
$('#brick-spawn-shield').addEventListener('change', event => attempt(() => saveBrick(event)));
$('#event-shield').addEventListener('change', () => touched.add('#event-shield'));
for (const selector of ['#event-time', '#event-lifetime', '#event-x', '#event-y']) {
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
  const textureFields = ['color', 'pattern', 'patternColor'].filter(field => touched.has(`#event-${field}`) && value(`#event-${field}`) !== MIXED);
  if (!kind && !type && !shieldChanged && !lifetimeChanged && !textureFields.length && [time, x, y].every(item => item === null)) throw new Error('Change at least one field to update the selected events.');
  const events = level.events.map((event, index) => {
    if (!selectedEvents.has(index)) return event;
    const next = { ...event };
    if (kind) next.kind = kind;
    if (type) next.type = type;
    if (time !== null) next.time = time;
    if (x !== null) next.x = x / 100;
    if (y !== null) next.y = y / 100;
    if (next.kind === 'food') {
      if (lifetimeChanged && lifetime === null) throw new Error('Food needs a lifetime in seconds.');
      next.lifetime = lifetime ?? next.lifetime ?? 5;
    } else if (['item', 'weapon'].includes(next.kind)) {
      if (lifetimeChanged && lifetime !== null) next.lifetime = lifetime;
      else if (lifetimeChanged || (kind && event.kind !== kind)) delete next.lifetime;
    } else delete next.lifetime;
    if (next.kind !== 'enemy') delete next.shield;
    else if (shieldChanged) next.shield = value('#event-shield') === 'none' ? null : value('#event-shield');
    for (const field of ['color', 'pattern', 'patternColor']) {
      if (next.kind !== 'object' || !OBJECTS[next.type]?.obstruction) delete next[field];
      else if (textureFields.includes(field)) next[field] = value(`#event-${field}`);
    }
    if (next.kind === 'enemy' && ['wheel', 'snake', 'robo-cow'].includes(next.type)) Object.assign(next, snapWheel(next.x, next.y));
    return next;
  });
  level = validateDraft({ ...level, events });
  markChanged(); setSelection(); message(`Updated ${plural(selectedEvents.size, 'event')}.`);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  attempt(() => {
    const indices = selectedList();
    if (indices.length > 1) { applyToSelected(); return; }
    const events = [...level.events], item = readEvent();
    const index = indices.length ? indices[0] : events.length;
    events[index] = item;
    level = validateDraft({ ...level, events });
    markChanged(); setSelection([index]); message('Event saved. Select “New event” to place another object.');
  });
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
$('#settings-form').addEventListener('submit', event => {
  event.preventDefault();
  attempt(() => {
    const candidate = validateDraft({
      ...level, id: $('#level-name').value, duration: Number($('#duration').value),
      survive: $('#win-condition').value === 'survive',
      goal: $('#win-condition').value === 'survive' ? 0 : Number($('#goal').value),
      killGoal: $('#win-condition').value === 'survive' ? 0 : Number($('#kill-goal').value),
      ...(Number($('#goals-goal').value) !== 0 || level.goalsGoal !== undefined ? {
        goalsGoal: $('#win-condition').value === 'survive' ? 0 : Number($('#goals-goal').value),
      } : {}),
      ...($('#activation-limit').value !== '' || level.activationLimit !== undefined ? {
        activationLimit: $('#activation-limit').value === '' ? null : Number($('#activation-limit').value),
      } : {}),
      heartCost: $('#heart-cost').value === '' ? null : Number($('#heart-cost').value), brickSet: Number($('#brick-set').value),
    });
    level = candidate; markChanged(); populateSettings(); render(); message('Level settings applied.');
  });
});
function populateSettings() {
  $('#level-name').value = level.number ?? level.id; $('#duration').value = level.duration; $('#goal').value = level.goal;
  $('#kill-goal').value = level.killGoal ?? 0;
  $('#goals-goal').value = level.goalsGoal ?? 0;
  $('#activation-limit').value = level.activationLimit ?? '';
  $('#win-condition').value = level.survive ? 'survive' : 'scores';
  updateWinCondition();
  $('#heart-cost').value = level.heartCost ?? ''; $('#brick-set').value = level.brickSet;
  $('#timeline').max = level.duration;
  $('#event-time').max = level.duration;
}
function updateWinCondition() {
  const survive = $('#win-condition').value === 'survive';
  $('#goal').disabled = survive;
  $('#kill-goal').disabled = survive;
  $('#goals-goal').disabled = survive;
}
$('#win-condition').addEventListener('change', updateWinCondition);
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
  remove.addEventListener('click', () => row.remove());
  row.sceneActors = line.actors.map(actor => ({ ...actor }));
  row.append(speakerLabel, textLabel, cast, remove);
  $('#scene-lines').append(row);
}
function populateCutscene() {
  $('#scene-enabled').checked = Boolean(level.cutscene);
  $('#scene-fields').disabled = !level.cutscene;
  $('#scene-theme').value = level.cutscene?.theme ?? 'garden';
  $('#scene-lines').replaceChildren();
  if (level.cutscene) level.cutscene.lines.forEach(addSceneLine);
  else addSceneLine();
}
$('#scene-enabled').addEventListener('change', () => { $('#scene-fields').disabled = !$('#scene-enabled').checked; });
$('#scene-add-line').addEventListener('click', () => {
  if ($('#scene-lines').children.length >= 100) { message('Cutscenes support at most 100 dialogue lines.', true); return; }
  addSceneLine();
});
$('#cutscene-form').addEventListener('submit', event => {
  event.preventDefault();
  attempt(() => {
    const candidate = { ...level };
    if ($('#scene-enabled').checked) {
      candidate.cutscene = {
        theme: $('#scene-theme').value,
        lines: [...$('#scene-lines').children].map(row => ({
          speaker: row.querySelector('.scene-speaker').value,
          text: row.querySelector('.scene-text').value,
          actors: [...row.querySelectorAll('.scene-cast input:checked')].flatMap(checkbox => {
            const existing = row.sceneActors.filter(actor => actor.character === checkbox.value);
            return existing.length ? existing : [{ character: checkbox.value, x: { koshi: .28, mouse: .67, wheel: .82, tom: .5, ram: .12, bucket: .9, ball: .5, jackolantern: .5, snake: .56, goalie: .5 }[checkbox.value], y: .65 }];
          }),
        })),
      };
    } else delete candidate.cutscene;
    level = validateDraft(candidate);
    markChanged(); populateCutscene(); message('Cutscene applied. Playtest to watch it before the level starts.');
  });
});
function replaceLevel(value) {
  const candidate = validateDraft(value);
  level = candidate; placing = true; markChanged(); populateSettings(); populateCutscene(); setSelection([], []);
}
$('#timeline').addEventListener('input', () => {
  $('#event-time').value = Math.min(Number($('#timeline').value), Number($('#event-time').max));
  renderBoard();
});
$('#show-all').addEventListener('change', renderBoard);
$('#orientation').addEventListener('change', renderBoard);
new ResizeObserver(renderBoard).observe(board);
$('#generate-json').addEventListener('click', () => attempt(() => {
  const valid = validateCustomLevel(level);
  $('#level-json').value = JSON.stringify(valid, null, 2); message('JSON generated from the saved level settings and events.');
}));
$('#import-json').addEventListener('click', () => attempt(() => {
  replaceLevel(JSON.parse($('#level-json').value)); message('JSON imported. Review the placements or playtest the level.');
}));
$('#download-json').addEventListener('click', () => attempt(() => {
  const valid = validateCustomLevel(level);
  const url = URL.createObjectURL(new Blob([JSON.stringify(valid, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${level.id.replace(/[^a-z0-9_-]/gi, '-').slice(0, 60)}.json`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  message('JSON download requested. If your browser blocks downloads, use Generate JSON and save the text instead.');
}));
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 1000000) throw new Error('Level file is too large. Maximum size is 1 MB.');
    const text = await file.text();
    replaceLevel(JSON.parse(text));
    $('#level-json').value = JSON.stringify(level, null, 2);
    message(`Imported ${file.name}.`);
  } catch (error) { console.error('Level import:', error); message(error.message, true); }
  event.target.value = '';
});
$('#save-draft').addEventListener('click', () => attempt(() => {
  localStorage.setItem(storageKey, JSON.stringify(level));
  committed = JSON.stringify(level); dirty = false;
  message(portalPairIssues(previewGame.bricks).length ? 'Draft saved in this browser. Finish the portal pairs before exporting or playtesting.' : 'Draft saved in this browser. Download JSON for a portable backup.');
}));
$('#load-draft').addEventListener('click', () => attempt(() => {
  const saved = localStorage.getItem(storageKey);
  if (!saved) throw new Error('No draft has been saved in this browser.');
  const candidate = validateDraft(JSON.parse(saved));
  if (dirty && !confirm('Replace your unsaved level with the saved draft?')) return;
  replaceLevel(candidate);
  committed = JSON.stringify(level); dirty = false; message('Saved draft loaded.');
}));
$('#new-level').addEventListener('click', () => {
  if (dirty && !confirm('Discard this unsaved level and start a new one?')) return;
  replaceLevel(blank()); message('New level created.');
});
$('#playtest').addEventListener('click', event => {
  event.preventDefault();
  attempt(() => {
    if (readOnly()) { location.href = $('#playtest').href; return; }
    validateCustomLevel(level);
    // The fragment carries the snapshot without requiring storage access or a server.
    history.replaceState(history.state, '', `#level=${encodeURIComponent(JSON.stringify(level))}`);
    committed = JSON.stringify(level); dirty = false;
    location.href = $('#playtest').href;
  });
});
window.addEventListener('beforeunload', event => {
  if (readOnly() ? customWorkspace?.dirty : dirty) { event.preventDefault(); event.returnValue = ''; }
});

setupPalettes();
setupObstructionColors();
typeOptions();
if (location.hash.startsWith('#level=')) {
  attempt(() => {
    level = validateDraft(JSON.parse(decodeURIComponent(location.hash.slice(7))));
    committed = JSON.stringify(level); message('Playtest snapshot restored. Continue editing or import a different level.');
  });
}
populateSettings(); populateCutscene(); updatePlaytest(); populateEventForm(); render();
})();
