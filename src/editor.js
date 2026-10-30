(function () {
'use strict';

const { Game, FOODS, SWORDS, COOLDOWNS, SLIMES, CHARACTERS, validateCustomLevel, snapWheel, brickRegions, brickEditRegions, brickShape, brickSlime } = globalThis.KoshiGame;
const $ = selector => document.querySelector(selector);
const board = $('#editor-board');
const form = $('#event-form');
const storageKey = 'koshi-level-editor-v1';
const blank = () => ({ version: 1, id: 'My level', duration: 60, goal: 20, heartCost: null, brickSet: 1, events: [] });
let level = blank();
let selectedEvents = new Set();
let selectedBricks = new Set();
let placing = true;
let previewGame;
let gesture = null;
let touched = new Set();
let dirty = false;
let committed = JSON.stringify(level);
const MIXED = '';

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
  dirty = JSON.stringify(level) !== committed;
  updatePlaytest();
}

function updatePlaytest() {
  $('#playtest').href = `./index.html#level=${encodeURIComponent(JSON.stringify(level))}`;
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
    : [['mouse', 'Robo Mouse'], ['wheel', 'Robo Wheel']];
  $('#event-type').replaceChildren(...types.map(([value, name]) => {
    const option = document.createElement('option');
    option.value = value; option.textContent = name;
    return option;
  }));
  if (kind === MIXED || type === MIXED) mixedOption($('#event-type'));
  else if (type) $('#event-type').value = type;
  const lifetime = showLifetime ?? kind === 'food';
  $('#lifetime-label').hidden = !lifetime;
  $('#event-lifetime').disabled = !lifetime;
}

function description(event) {
  return event.kind === 'food' ? `${FOODS[event.type].icon} ${FOODS[event.type].name}` : event.kind === 'weapon' ? SWORDS[event.type].name : event.type === 'mouse' ? 'Robo Mouse' : 'Robo Wheel';
}

function icon(event) {
  return event.kind === 'food' ? FOODS[event.type].icon : event.kind === 'weapon' ? '⚔' : event.type === 'mouse' ? '🐭' : '⚙';
}

function readEvent() {
  const event = {
    time: Number($('#event-time').value), kind: $('#event-kind').value, type: $('#event-type').value,
    x: Number($('#event-x').value) / 100, y: Number($('#event-y').value) / 100,
  };
  if (event.kind === 'food') event.lifetime = Number($('#event-lifetime').value);
  if (event.kind === 'enemy' && event.type === 'wheel') Object.assign(event, snapWheel(event.x, event.y));
  return event;
}

// Multi-event edits show shared values and mark differing fields as "Mixed".
function populateEventForm() {
  const indices = selectedList(), items = indices.map(index => level.events[index]);
  const multi = items.length > 1;
  const numbers = { '#event-time': 0, '#event-lifetime': 5, '#event-x': 50, '#event-y': 50 };
  touched.clear();
  $('#event-kind').querySelector('option[value=""]')?.remove();
  for (const id of Object.keys(numbers)) { $(id).required = !multi; $(id).placeholder = ''; }
  if (items.length) {
    const setNumber = (id, values, factor = 1) => {
      const value = common(values);
      $(id).value = value === MIXED ? '' : value * factor;
      $(id).placeholder = value === MIXED ? 'Mixed' : '';
    };
    const kind = common(items.map(event => event.kind));
    const foods = items.filter(event => event.kind === 'food');
    if (kind === MIXED) mixedOption($('#event-kind')); else $('#event-kind').value = kind;
    typeOptions(kind === MIXED ? MIXED : common(items.map(event => event.type)), foods.length > 0);
    setNumber('#event-time', items.map(event => event.time));
    setNumber('#event-x', items.map(event => event.x), 100);
    setNumber('#event-y', items.map(event => event.y), 100);
    if (foods.length) setNumber('#event-lifetime', foods.map(event => event.lifetime));
    if (common(items.map(event => event.time)) !== MIXED) $('#timeline').value = items[0].time;
  } else {
    typeOptions($('#event-type').value || undefined);
  }
  if (!multi) for (const [id, fallback] of Object.entries(numbers)) if ($(id).value === '') $(id).value = fallback;
  $('#inspector-heading').textContent = !items.length ? 'NEW PLACEMENT' : multi ? `EDITING ${items.length} EVENTS` : `EDITING EVENT ${indices[0] + 1}`;
  $('#apply-event').textContent = !items.length ? 'Add event' : multi ? `Apply to ${items.length} events` : 'Apply event changes';
  $('#duplicate-event').disabled = !items.length;
  $('#delete-event').disabled = !items.length;
  $('#duplicate-event').textContent = multi ? `Duplicate ${items.length}` : 'Duplicate';
  $('#delete-event').textContent = multi ? `Delete ${items.length}` : 'Delete';
  $('#multi-event-help').hidden = !multi;
}

function setSelection(events = selectedEvents, bricks = selectedBricks) {
  selectedEvents = new Set(events);
  selectedBricks = new Set(bricks);
  if (selectedEvents.size) placing = false;
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
  setSelection(level.events.map((_, index) => index), [...brickEditRegions(previewGame.bricks).values()].map(regionKey));
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
    location.textContent = `X ${(event.x * 100).toFixed(1)}% · Y ${(event.y * 100).toFixed(1)}%${event.kind === 'food' ? ` · lasts ${event.lifetime}s` : ''} · #${index + 1}`;
    button.append(time, description(event), location);
    button.addEventListener('click', click => choose('event', index, isAdditive(click)));
    li.append(button); list.append(li);
  });
}

function renderBrickInspector(bricks) {
  const regions = brickEditRegions(previewGame.bricks);
  const displayedRegions = brickRegions(previewGame.bricks, previewGame.width, previewGame.height);
  const chosen = bricks.filter(brick => selectedBricks.has(regionKey(regions.get(brick.id))));
  $('#brick-kind').querySelector('option[value=""]')?.remove();
  $('#brick-slime-color').querySelector('option[value=""]')?.remove();
  $('#brick-slime-color').disabled = !chosen.some(brick => brick.slimed);
  if (chosen.length) {
    const color = common(chosen.map(brick => brick.slimeColor ?? 'green'));
    if (color === MIXED) mixedOption($('#brick-slime-color')); else $('#brick-slime-color').value = color;
  }
  if (!chosen.length) {
    for (const selector of ['#brick-kind', '#brick-crumbler', '#brick-uses', '#brick-warped', '#brick-warp-seconds', '#brick-slimed', '#brick-springs']) $(selector).disabled = true;
    for (const selector of ['#brick-crumbler', '#brick-warped', '#brick-slimed', '#brick-springs']) $(selector).indeterminate = false;
    $('#brick-selection').textContent = 'Select one or more boundary bricks to change their attributes.';
    return;
  }
  const kind = common(chosen.map(brick => brick.kind));
  $('#brick-kind').disabled = false;
  if (kind === MIXED) mixedOption($('#brick-kind')); else $('#brick-kind').value = kind;
  const flag = (box, input, values, fallback) => {
    const on = values.filter(Boolean), value = on.length ? common(on) : fallback;
    $(box).disabled = false;
    $(box).checked = on.length === values.length;
    $(box).indeterminate = on.length > 0 && on.length < values.length;
    $(input).disabled = !on.length;
    $(input).value = value === MIXED ? '' : value;
    $(input).placeholder = value === MIXED ? 'Mixed' : '';
  };
  flag('#brick-crumbler', '#brick-uses', chosen.map(brick => brick.crumbler), 5);
  flag('#brick-warped', '#brick-warp-seconds', chosen.map(brick => brick.warped), 15);
  for (const attribute of ['slimed', 'springs']) {
    const box = $(`#brick-${attribute}`), count = chosen.filter(brick => brick[attribute]).length;
    box.disabled = false;
    box.checked = count === chosen.length;
    box.indeterminate = count > 0 && count < chosen.length;
  }
  if (chosen.length === 1) {
    const [brick] = chosen;
    $('#brick-selection').textContent = `${displayedRegions.get(brick.id).edge} edge · brick ${brick.id + 1} · ${brick.kind} (${COOLDOWNS[brick.kind]}s)`;
  } else {
    const edges = [...new Set(chosen.map(brick => displayedRegions.get(brick.id).edge))].join(', ');
    $('#brick-selection').textContent = `${chosen.length} bricks selected · ${edges} · ${kind === MIXED ? 'mixed types' : `all ${kind} (${COOLDOWNS[kind]}s)`}`;
  }
}

function renderBoard() {
  const portrait = $('#orientation').value === 'portrait';
  board.dataset.orientation = portrait ? 'portrait' : 'landscape';
  board.dataset.tool = placing ? 'place' : 'select';
  previewGame = new Game(Math.random, { portrait, scale: portrait ? board.clientWidth / 600 : 1, customLevel: level });
  const bricks = $('#editor-bricks');
  const regions = brickEditRegions(previewGame.bricks);
  const displayedRegions = brickRegions(previewGame.bricks, previewGame.width, previewGame.height);
  bricks.replaceChildren(...previewGame.bricks.map(brick => {
    const element = document.createElement('button');
    const key = regionKey(regions.get(brick.id));
    const displayedEdge = displayedRegions.get(brick.id).edge;
    element.type = 'button';
    element.className = 'editor-brick';
    element.classList.toggle('crumbler', Boolean(brick.crumbler));
    element.classList.toggle('warped', Boolean(brick.warped));
    element.classList.toggle('slimed', Boolean(brick.slimed));
    element.classList.toggle('springs', Boolean(brick.springs));
    element.textContent = [brick.crumbler ? `C:${brick.crumbler}` : '', brick.warped ? `W:${brick.warped}s` : ''].filter(Boolean).join(' ');
    element.dataset.id = brick.id;
    element.dataset.region = key;
    element.setAttribute('aria-label', `${displayedEdge} brick ${brick.id + 1}: ${brick.kind}, ${COOLDOWNS[brick.kind]} second cooldown${brick.crumbler ? `, Crumbler ${brick.crumbler} selections` : ''}${brick.warped ? `, Warped ${brick.warped} seconds` : ''}${brick.slimed ? `, ${brick.slimeColor ?? 'green'} slime: sticks for ${SLIMES[brick.slimeColor ?? 'green'].duration} seconds` : ''}${brick.springs ? ', Springs: reflects Koshi' : ''}`);
    element.setAttribute('aria-pressed', String(selectedBricks.has(key)));
    // Pointer clicks are handled by the board gesture; detail 0 means keyboard activation.
    element.addEventListener('click', event => {
      event.stopPropagation();
      if (event.detail !== 0) return;
      choose('brick', key, isAdditive(event));
      focusBrick(key);
    });
    element.style.cssText = `left:${brick.x / previewGame.width * 100}%;top:${brick.y / previewGame.height * 100}%;width:${brick.w / previewGame.width * 100}%;height:${brick.h / previewGame.height * 100}%;background-color:${{ normal: '#83bca1', slow: '#7eacdb', fast: '#df8c81' }[brick.kind]}`;
    if (brick.crumbler) element.style.clipPath = brickShape([brick], true).clipPath;
    if (brick.slimed || brick.springs) {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.classList.add('brick-outline');
      svg.setAttribute('viewBox', '0 0 1 1');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', brickShape([brick], Boolean(brick.crumbler)).path);
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.append(path);
      element.append(svg);
      if (brick.slimed) {
        const slime = svg.cloneNode(false);
        slime.setAttribute('class', 'brick-slime');
        slime.style.setProperty('--slime-color', SLIMES[brick.slimeColor ?? 'green'].color);
        const icing = path.cloneNode();
        icing.setAttribute('d', brickSlime([brick], previewGame.width, previewGame.height));
        slime.append(icing);
        element.append(slime);
      }
    }
    return element;
  }));
  renderBrickInspector(previewGame.bricks);
  const b = previewGame.bounds();
  $('#playable-area').style.cssText = `left:${b.left / previewGame.width * 100}%;top:${b.top / previewGame.height * 100}%;width:${(b.right - b.left) / previewGame.width * 100}%;height:${(b.bottom - b.top) / previewGame.height * 100}%`;
  const time = Number($('#timeline').value);
  $('#time-label').textContent = `${time.toFixed(1)}s`;
  $('#place-mode').setAttribute('aria-pressed', String(placing));
  $('#select-mode').setAttribute('aria-pressed', String(!placing));
  const parts = [selectedBricks.size && plural(selectedBricks.size, 'brick'), selectedEvents.size && plural(selectedEvents.size, 'event')].filter(Boolean);
  $('#selection-summary').textContent = parts.length ? `${parts.join(' + ')} selected` : 'Nothing selected';
  $('#clear-selection').disabled = !parts.length;
  const markers = $('#markers'); markers.replaceChildren();
  level.events.forEach((event, index) => {
    if (!$('#show-all').checked && (event.time > time || (event.kind === 'food' && event.time + event.lifetime <= time))) return;
    const point = previewGame.pointFromRelative(event.x, event.y);
    const marker = document.createElement('button');
    marker.className = 'marker'; marker.type = 'button'; marker.dataset.kind = event.kind; marker.dataset.index = index;
    marker.style.left = `${point.x / previewGame.width * 100}%`; marker.style.top = `${point.y / previewGame.height * 100}%`;
    marker.style.color = event.kind === 'weapon' ? SWORDS[event.type].color : '';
    marker.setAttribute('aria-label', `Event ${index + 1}: ${description(event)} at ${event.time}s`);
    marker.setAttribute('aria-pressed', String(selectedEvents.has(index)));
    const label = document.createElement('small'); label.textContent = `${event.time}s`;
    marker.append(icon(event), label);
    marker.addEventListener('click', click => {
      click.stopPropagation();
      if (click.detail !== 0) return;
      choose('event', index, isAdditive(click));
      focusMarker(index);
    });
    marker.addEventListener('pointerdown', down => {
      if (down.button !== 0 || gesture) return;
      down.preventDefault(); down.stopPropagation();
      startGesture(down, { type: 'marker', index });
    });
    marker.addEventListener('keydown', key => {
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
}

function render() {
  renderBoard(); renderList();
}

function focusMarker(index) { board.querySelector(`.marker[data-index="${index}"]`)?.focus({ preventScroll: true }); }
function focusBrick(key) { board.querySelector(`.editor-brick[data-region="${key}"]`)?.focus({ preventScroll: true }); }

function moveEvent(index, x, y) {
  const event = level.events[index];
  let point = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  if (event.kind === 'enemy' && event.type === 'wheel') point = snapWheel(point.x, point.y);
  Object.assign(event, point);
}

function pointerPosition(event) {
  const rect = board.getBoundingClientRect(), b = previewGame.bounds();
  const x = (event.clientX - rect.left - board.clientLeft) / board.clientWidth * previewGame.width;
  const y = (event.clientY - rect.top - board.clientTop) / board.clientHeight * previewGame.height;
  return { x: (x - b.left) / (b.right - b.left), y: (y - b.top) / (b.bottom - b.top) };
}

function startGesture(event, target) {
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
  const bricks = [...board.querySelectorAll('.editor-brick')].filter(element => {
    const r = element.getBoundingClientRect();
    return r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top;
  }).map(element => element.dataset.region);
  const events = [...board.querySelectorAll('.marker')].filter(element => {
    const r = element.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }).map(element => Number(element.dataset.index));
  if (gesture.additive) setSelection([...selectedEvents, ...events], [...selectedBricks, ...bricks]);
  else setSelection(events, bricks);
}

function placeAt(event) {
  const point = pointerPosition(event);
  if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
    message('Place objects inside the dotted playable area, not on bricks.', true); return;
  }
  if (!form.reportValidity()) return;
  attempt(() => {
    const item = { ...readEvent(), x: point.x, y: point.y };
    if (item.kind === 'enemy' && item.type === 'wheel') Object.assign(item, snapWheel(item.x, item.y));
    level = validateCustomLevel({ ...level, events: [...level.events, item] });
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
$('#place-mode').addEventListener('click', () => { placing = true; setSelection([], selectedBricks); });
$('#select-mode').addEventListener('click', () => { placing = false; render(); });
$('#select-all').addEventListener('click', selectAll);
$('#clear-selection').addEventListener('click', () => setSelection([], []));
function saveBrick(event) {
  attempt(() => {
    const regions = brickEditRegions(previewGame.bricks);
    const targets = previewGame.bricks.map(brick => ({ brick, region: regions.get(brick.id) })).filter(({ region }) => selectedBricks.has(regionKey(region)));
    if (!targets.length) throw new Error('Select a brick before changing its attributes.');
    const id = event.target.id;
    const number = selector => $(selector).value === '' ? null : Number($(selector).value);
    // Only the changed control is applied, so mixed values in other controls are preserved.
    const entries = targets.map(({ brick, region }) => {
      const entry = { ...region, kind: brick.kind, crumbler: brick.crumbler ?? null, warped: brick.warped ?? null, slimed: Boolean(brick.slimed), slimeColor: brick.slimeColor ?? 'green', springs: Boolean(brick.springs) };
      if (id === 'brick-slime-color' && $('#brick-slime-color').value !== MIXED) entry.slimeColor = $('#brick-slime-color').value;
      if (id === 'brick-kind' && $('#brick-kind').value !== MIXED) entry.kind = $('#brick-kind').value;
      if (id === 'brick-crumbler') entry.crumbler = $('#brick-crumbler').checked ? entry.crumbler ?? number('#brick-uses') ?? 5 : null;
      if (id === 'brick-uses' && entry.crumbler && number('#brick-uses') !== null) entry.crumbler = number('#brick-uses');
      if (id === 'brick-warped') entry.warped = $('#brick-warped').checked ? entry.warped ?? number('#brick-warp-seconds') ?? 15 : null;
      if (id === 'brick-warp-seconds' && entry.warped && number('#brick-warp-seconds') !== null) entry.warped = number('#brick-warp-seconds');
      if (id === 'brick-slimed' || id === 'brick-springs') {
        const attribute = id.slice(6);
        entry[attribute] = $(`#${id}`).checked;
        if (entry[attribute]) entry[attribute === 'slimed' ? 'springs' : 'slimed'] = false;
      }
      return entry;
    });
    const keys = new Set(entries.map(regionKey));
    const overrides = (level.brickTypes ?? []).filter(entry => !keys.has(regionKey(entry)));
    level = validateCustomLevel({ ...level, brickTypes: [...overrides, ...entries] });
    markChanged();
    message(`${entries.length === 1 ? 'Brick attributes' : `Attributes for ${entries.length} bricks`} saved. Export or playtest to use them.`);
  });
  // Re-render on success and failure so the inspector always reflects the saved level.
  renderBoard();
}
for (const selector of ['#brick-kind', '#brick-crumbler', '#brick-uses', '#brick-warped', '#brick-warp-seconds', '#brick-slimed', '#brick-slime-color', '#brick-springs']) {
  $(selector).addEventListener('change', saveBrick);
}
$('#reset-brick-types').addEventListener('click', () => {
  delete level.brickTypes;
  markChanged(); renderBoard(); message('Individual brick edits cleared. Boundary preset restored.');
});
$('#event-kind').addEventListener('change', () => {
  typeOptions();
  touched.add('#event-kind'); touched.add('#event-type');
});
$('#event-type').addEventListener('change', () => touched.add('#event-type'));
for (const selector of ['#event-time', '#event-lifetime', '#event-x', '#event-y']) {
  $(selector).addEventListener('input', () => touched.add(selector));
}

function applyToSelected() {
  const value = selector => $(selector).value;
  const number = selector => touched.has(selector) && value(selector) !== '' ? Number(value(selector)) : null;
  const kind = touched.has('#event-kind') && value('#event-kind') !== MIXED ? value('#event-kind') : null;
  const type = touched.has('#event-type') && value('#event-type') !== MIXED ? value('#event-type') : null;
  const time = number('#event-time'), x = number('#event-x'), y = number('#event-y'), lifetime = number('#event-lifetime');
  if (!kind && !type && [time, x, y, lifetime].every(item => item === null)) throw new Error('Change at least one field to update the selected events.');
  const events = level.events.map((event, index) => {
    if (!selectedEvents.has(index)) return event;
    const next = { ...event };
    if (kind) next.kind = kind;
    if (type) next.type = type;
    if (time !== null) next.time = time;
    if (x !== null) next.x = x / 100;
    if (y !== null) next.y = y / 100;
    if (next.kind === 'food') next.lifetime = lifetime ?? next.lifetime ?? 5;
    else delete next.lifetime;
    if (next.kind === 'enemy' && next.type === 'wheel') Object.assign(next, snapWheel(next.x, next.y));
    return next;
  });
  level = validateCustomLevel({ ...level, events });
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
    level = validateCustomLevel({ ...level, events });
    markChanged(); setSelection([index]); message('Event saved. Select “New event” to place another object.');
  });
});
$('#new-event').addEventListener('click', () => {
  placing = true; setSelection([], selectedBricks);
  message('Placement mode is on. Click the playable area or enter coordinates and add an event.');
});
$('#duplicate-event').addEventListener('click', () => attempt(() => {
  const copies = selectedList().map(index => ({ ...level.events[index] }));
  level = validateCustomLevel({ ...level, events: [...level.events, ...copies] });
  const first = level.events.length - copies.length;
  markChanged(); setSelection(copies.map((_, offset) => first + offset));
  message(`${copies.length === 1 ? 'Event' : `${copies.length} events`} duplicated at the same location and time. Drag the selection or edit its fields.`);
}));
function deleteSelected() {
  const count = selectedEvents.size;
  if (!count) return;
  level.events = level.events.filter((_, index) => !selectedEvents.has(index));
  markChanged(); setSelection([]); message(`${plural(count, 'event')} deleted.`);
}
$('#delete-event').addEventListener('click', deleteSelected);
$('#settings-form').addEventListener('submit', event => {
  event.preventDefault();
  attempt(() => {
    const candidate = validateCustomLevel({
      ...level, id: $('#level-name').value, duration: Number($('#duration').value), goal: Number($('#goal').value),
      heartCost: $('#heart-cost').value === '' ? null : Number($('#heart-cost').value), brickSet: Number($('#brick-set').value),
    });
    level = candidate; markChanged(); populateSettings(); render(); message('Level settings applied.');
  });
});
function populateSettings() {
  $('#level-name').value = level.id; $('#duration').value = level.duration; $('#goal').value = level.goal;
  $('#heart-cost').value = level.heartCost ?? ''; $('#brick-set').value = level.brickSet;
  $('#timeline').max = level.duration;
  $('#event-time').max = level.duration;
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
            return existing.length ? existing : [{ character: checkbox.value, x: { koshi: .28, mouse: .67, wheel: .82 }[checkbox.value], y: .65 }];
          }),
        })),
      };
    } else delete candidate.cutscene;
    level = validateCustomLevel(candidate);
    markChanged(); populateCutscene(); message('Cutscene applied. Playtest to watch it before the level starts.');
  });
});
function replaceLevel(value) {
  const candidate = validateCustomLevel(value);
  level = candidate; placing = true; markChanged(); populateSettings(); populateCutscene(); setSelection([], []);
}
$('#timeline').addEventListener('input', () => {
  $('#event-time').value = Math.min(Number($('#timeline').value), Number($('#event-time').max));
  renderBoard();
});
$('#show-all').addEventListener('change', renderBoard);
$('#orientation').addEventListener('change', renderBoard);
new ResizeObserver(renderBoard).observe(board);
$('#generate-json').addEventListener('click', () => {
  $('#level-json').value = JSON.stringify(level, null, 2); message('JSON generated from the saved level settings and events.');
});
$('#import-json').addEventListener('click', () => attempt(() => {
  replaceLevel(JSON.parse($('#level-json').value)); message('JSON imported. Review the placements or playtest the level.');
}));
$('#download-json').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(level, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${level.id.replace(/[^a-z0-9_-]/gi, '-').slice(0, 60)}.json`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  message('JSON download requested. If your browser blocks downloads, use Generate JSON and save the text instead.');
});
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
  committed = JSON.stringify(level); dirty = false; message('Draft saved in this browser. Download JSON for a portable backup.');
}));
$('#load-draft').addEventListener('click', () => attempt(() => {
  const saved = localStorage.getItem(storageKey);
  if (!saved) throw new Error('No draft has been saved in this browser.');
  const candidate = validateCustomLevel(JSON.parse(saved));
  if (dirty && !confirm('Replace your unsaved level with the saved draft?')) return;
  replaceLevel(candidate);
  committed = JSON.stringify(level); dirty = false; message('Saved draft loaded.');
}));
$('#new-level').addEventListener('click', () => {
  if (dirty && !confirm('Discard this unsaved level and start a new one?')) return;
  replaceLevel(blank()); message('New level created.');
});
$('#playtest').addEventListener('click', () => {
  // The fragment carries the snapshot without requiring storage access or a server.
  committed = JSON.stringify(level); dirty = false;
});
window.addEventListener('beforeunload', event => {
  if (dirty) { event.preventDefault(); event.returnValue = ''; }
});

typeOptions();
if (location.hash.startsWith('#level=')) {
  attempt(() => {
    level = validateCustomLevel(JSON.parse(decodeURIComponent(location.hash.slice(7))));
    committed = JSON.stringify(level); message('Playtest snapshot restored. Continue editing or import a different level.');
  });
}
populateSettings(); populateCutscene(); updatePlaytest(); populateEventForm(); render();
})();
