(function () {
'use strict';

const { LEVELS, catBlockObjective } = globalThis.KoshiGame;
const { WORLDS, worldLevels, levelFeatures, nextLevelIndex } = globalThis.KoshiWorlds;
const { levelStats } = globalThis.KoshiSaves;
const { catBlockIcon, goldStarIcon, collectibleTotals } = globalThis.KoshiCollectibles;
const { LOCATIONS } = globalThis.KoshiCatTown;

const OFFICIAL_EMBLEMS = {
  C: 'M6 8H10V4H14V8H18V12H30V8H34V4H38V8H42V28H38V32H34V36H14V32H10V28H6ZM14 18V22H18V18ZM30 18V22H34V18ZM22 26V30H26V26Z',
  1: 'M20 2H28V6H32V10H36V14H32V18H40V26H28V38H20V26H8V18H16V14H12V10H16V6H20Z',
  2: 'M14 12H18V8H30V12H34V16H38V12H44V28H38V24H34V28H30V32H18V28H14V24H6V16H14ZM18 16V20H22V16Z',
  3: 'M22 2H26V6H30V14H34V18H38V30H34V34H30V38H18V34H14V30H10V18H14V14H18V6H22ZM14 22V30H18V22Z',
  4: 'M20 4H28V20H32V12H40V24H36V28H28V36H32V40H16V36H20V24H12V20H8V8H16V16H20Z',
  5: 'M22 0H26V8H30V4H34V8H30V12H26V16H30V12H34V16H38V12H42V16H38V20H48V24H38V28H42V32H38V28H34V32H30V28H26V32H30V36H34V40H30V36H26V40H22V32H18V36H14V32H18V28H22V24H18V28H14V24H10V28H6V24H10V20H0V16H10V12H6V8H10V12H14V8H18V12H22V8H18V4H14V0H18V4H22Z',
  6: 'M20 2H32V6H24V10H20V26H24V30H32V34H40V30H44V34H40V38H20V34H12V30H8V10H12V6H20Z',
  7: 'M14 8H34V12H42V16H46V28H42V32H34V36H14V32H6V28H2V16H6V12H14ZM24 18V36H34V32H30V28H28V24Z',
  8: 'M18 14H30V18H34V26H38V30H42V34H46V38H2V34H6V30H10V26H14V18H18ZM18 14H22V22H26V14ZM20 2H24V6H28V10H24V14H20V10H16V6H20ZM32 6H36V10H32ZM8 8H12V12H8Z',
  9: 'M22 2H26V6H30V10H38V14H42V30H38V34H10V30H6V14H10V10H22ZM14 18V24H20V18ZM28 18V24H34V18ZM18 28V30H30V28Z',
};

function collectibleHint(button, id, text, activate) {
  const description = document.createElement('p');
  description.id = id;
  description.className = 'map-collectible-description';
  description.setAttribute('role', 'tooltip');
  description.textContent = text;
  description.hidden = true;
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', id);
  button.setAttribute('aria-describedby', id);
  let pinned = false;
  const reveal = visible => {
    if (visible) activate(dismiss);
    description.hidden = !visible;
    button.setAttribute('aria-expanded', String(visible));
  };
  const dismiss = () => { pinned = false; reveal(false); };
  button.addEventListener('mouseenter', () => reveal(true));
  button.addEventListener('mouseleave', () => reveal(pinned));
  button.addEventListener('focus', () => reveal(true));
  button.addEventListener('blur', () => { pinned = false; reveal(false); });
  button.addEventListener('click', () => { pinned = !pinned; reveal(pinned); });
  button.addEventListener('keydown', event => {
    if (event.key === 'Escape') { pinned = false; reveal(false); }
  });
  return description;
}

function hintActivator() {
  let hideHint;
  return hide => { if (hideHint !== hide) hideHint?.(); hideHint = hide; };
}

class MapNavigation {
  constructor(map, layout) {
    this.map = map;
    this.layout = layout;
    this.viewport = document.querySelector('.map-viewport');
    this.surface = document.querySelector('#map-surface');
    this.controls = document.querySelector('#map-controls');
    this.phone = matchMedia('(max-width: 760px), (pointer: coarse)');
    this.pointers = new Map();
    this.scale = 1;
    this.suppressClickUntil = 0;
    this.phone.addEventListener('change', () => this.resize(true));
    new ResizeObserver(() => this.resize()).observe(this.viewport);
    this.viewport.addEventListener('pointerdown', event => this.pointerDown(event));
    this.viewport.addEventListener('pointermove', event => this.pointerMove(event));
    this.viewport.addEventListener('wheel', event => {
      if (this.layout.dataset.view !== 'worlds' || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.viewport.clientHeight : 1);
      this.zoom(this.scale * Math.exp(-delta * .01), this.point(event));
    }, { passive: false });
    for (const type of ['pointerup', 'pointercancel']) {
      this.viewport.addEventListener(type, event => this.pointerEnd(event));
    }
    this.viewport.addEventListener('lostpointercapture', event => {
      // Descendants lose implicit touch capture when a drag transfers it to the viewport.
      if (event.target === this.viewport) this.pointerEnd(event);
    });
    this.viewport.addEventListener('click', event => {
      if (Date.now() < this.suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
    }, true);
    document.querySelector('#map-zoom-in').addEventListener('click', () => this.zoom(this.scale * 1.25));
    document.querySelector('#map-zoom-out').addEventListener('click', () => this.zoom(this.scale / 1.25));
    document.querySelector('#map-zoom-fit').addEventListener('click', () => this.zoom(this.minimum));
  }
  reset(height) {
    this.height = height;
    this.pointers.clear();
    this.gesture = null;
    this.suppressClickUntil = 0;
    this.resize(true);
  }
  resize(reset = false) {
    const overview = this.layout.dataset.view === 'worlds';
    this.controls.hidden = !overview;
    this.layout.dataset.mapTouch = String(this.phone.matches);
    if (!overview) {
      this.map.style.transform = '';
      this.map.style.width = '';
      this.surface.style.width = '';
      this.surface.style.height = '';
      return;
    }
    const width = this.viewport.clientWidth, height = this.viewport.clientHeight;
    if (!width || !height || !this.height) return;
    this.width = this.map.classList.contains('official-world-map') ? 900 : Math.max(760, width);
    this.contentHeight = this.height === 900 ? 900 : Math.max(this.height, height);
    this.minimum = Math.min(1, width / this.width, height / this.contentHeight);
    const previous = this.scale;
    this.scale = Math.max(this.minimum, Math.min(2.5, reset ? (this.phone.matches ? 1 : this.minimum) : this.scale));
    this.map.style.width = `${this.width}px`;
    this.map.style.height = `${this.contentHeight}px`;
    this.apply();
    if (reset || previous !== this.scale) {
      this.viewport.scrollLeft = Math.max(0, (this.width * this.scale - width) / 2);
      this.viewport.scrollTop = Math.max(0, (this.contentHeight * this.scale - height) / 2);
    }
  }
  apply() {
    const width = this.width * this.scale, height = this.contentHeight * this.scale;
    const x = Math.max(0, (this.viewport.clientWidth - width) / 2);
    const y = Math.max(0, (this.viewport.clientHeight - height) / 2);
    this.map.style.transform = `translate(${x}px, ${y}px) scale(${this.scale})`;
    this.surface.style.width = `${Math.max(width, this.viewport.clientWidth)}px`;
    this.surface.style.height = `${Math.max(height, this.viewport.clientHeight)}px`;
    document.querySelector('#map-zoom-out').disabled = this.scale <= this.minimum;
    document.querySelector('#map-zoom-in').disabled = this.scale >= 2.5;
  }
  zoom(scale, anchor = { x: this.viewport.clientWidth / 2, y: this.viewport.clientHeight / 2 }) {
    if (this.layout.dataset.view !== 'worlds' || !this.width) return;
    const x = (this.viewport.scrollLeft + anchor.x - Math.max(0, (this.viewport.clientWidth - this.width * this.scale) / 2)) / this.scale;
    const y = (this.viewport.scrollTop + anchor.y - Math.max(0, (this.viewport.clientHeight - this.contentHeight * this.scale) / 2)) / this.scale;
    this.scale = Math.max(this.minimum, Math.min(2.5, scale));
    this.apply();
    this.viewport.scrollLeft = Math.max(0, x * this.scale - anchor.x);
    this.viewport.scrollTop = Math.max(0, y * this.scale - anchor.y);
  }
  point(event) {
    const rect = this.viewport.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  startGesture() {
    const points = [...this.pointers.values()];
    this.gesture = {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      distance: points.length > 1 ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : 0,
      scale: this.scale, left: this.viewport.scrollLeft, top: this.viewport.scrollTop,
      moved: points.length > 1,
    };
  }
  pointerDown(event) {
    if (this.layout.dataset.view !== 'worlds' || event.button !== 0 || this.pointers.size >= 2) return;
    this.pointers.set(event.pointerId, this.point(event));
    this.startGesture();
    if (this.pointers.size > 1) {
      for (const id of this.pointers.keys()) this.viewport.setPointerCapture(id);
      event.preventDefault();
    }
  }
  pointerMove(event) {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, this.point(event));
    const points = [...this.pointers.values()], gesture = this.gesture;
    const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    if (!gesture.moved && Math.hypot(x - gesture.x, y - gesture.y) < 6) return;
    gesture.moved = true;
    this.suppressClickUntil = Date.now() + 400;
    this.viewport.setPointerCapture(event.pointerId);
    event.preventDefault();
    if (points.length > 1 && gesture.distance > 0) {
      this.scale = Math.max(this.minimum, Math.min(2.5,
        gesture.scale * Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) / gesture.distance));
      this.apply();
      const offsetX = Math.max(0, (this.viewport.clientWidth - this.width * gesture.scale) / 2);
      const offsetY = Math.max(0, (this.viewport.clientHeight - this.contentHeight * gesture.scale) / 2);
      this.viewport.scrollLeft = Math.max(0, (gesture.left + gesture.x - offsetX) * this.scale / gesture.scale - x);
      this.viewport.scrollTop = Math.max(0, (gesture.top + gesture.y - offsetY) * this.scale / gesture.scale - y);
    } else {
      this.viewport.scrollLeft = gesture.left + gesture.x - x;
      this.viewport.scrollTop = gesture.top + gesture.y - y;
    }
  }
  pointerEnd(event) {
    if (!this.pointers.has(event.pointerId)) return;
    if (this.gesture?.moved) this.suppressClickUntil = Date.now() + 400;
    this.pointers.delete(event.pointerId);
    if (this.pointers.size) this.startGesture();
    else this.gesture = null;
  }
}

class WorldMap {
  constructor({ selection, profile, picture, custom, cutsceneViewed = () => false, openTownLocation = () => {} }) {
    this.selection = selection;
    this.profile = profile;
    this.picture = picture;
    this.custom = custom;
    this.map = document.querySelector('#world-map');
    this.layout = document.querySelector('#map-layout');
    this.navigation = new MapNavigation(this.map, this.layout);
    this.details = document.querySelector('#map-details');
    this.heading = document.querySelector('#level-picker-heading');
    this.totals = document.querySelector('#map-collection-totals');
    this.back = document.querySelector('#world-map-back');
    this.play = document.querySelector('#level-picker-play');
    this.close = document.querySelector('#level-picker-close');
    this.skipCutscene = document.querySelector('#skip-cutscene');
    this.skipCutsceneOption = document.querySelector('#skip-cutscene-option');
    this.cutsceneViewed = cutsceneViewed;
    this.openTownLocation = openTownLocation;
    this.back.addEventListener('click', () => {
      this.open();
      this.map.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
    });
  }
  open() {
    this.view = 'worlds';
    this.townLocation = null;
    this.play.textContent = 'Play Level';
    this.map.classList.remove('cat-town-map');
    this.layout.dataset.view = 'worlds';
    this.details.hidden = true;
    this.setCutsceneOption(null);
    const level = LEVELS[Number(this.selection.value)];
    this.world = WORLDS.find(world => world.id === level?.worldId) ?? WORLDS[0];
    this.heading.textContent = 'World Map';
    this.totals.replaceChildren(collectibleTotals(this.profile(), LEVELS, document));
    this.back.hidden = true;
    this.play.hidden = true;
    this.map.classList.remove('map-zoom');
    const official = WORLDS.some(world => world.mapPosition);
    if (official) this.map.classList.add('official-world-map');
    else this.map.classList.remove('official-world-map');
    if (!WORLDS.length) {
      this.heading.textContent = 'Official World Map';
      const message = document.createElement('p');
      message.className = 'campaign-empty-message';
      message.textContent = 'Official campaign under construction. No worlds or levels have been added yet. Switch to Beta to play the existing campaign.';
      this.map.replaceChildren(message);
      const custom = this.custom();
      if (custom) {
        this.details.replaceChildren(this.objectives(custom));
        this.details.hidden = false;
        this.selection.value = 'custom';
        this.play.hidden = false;
        this.setCutsceneOption(custom);
      }
      return;
    }
    const main = WORLDS.filter(world => !world.special);
    const columns = Math.max(1, main.length - 1 + (WORLDS.some(world => world.special
      && main.at(-1).next.includes(world.id)) ? .5 : 0));
    const nodes = WORLDS.map(world => {
      const parent = WORLDS.find(entry => entry.next.includes(world.id));
      const column = world.special ? Math.max(0, main.indexOf(parent)) + .5 : main.indexOf(world);
      const levels = worldLevels(world);
      const profile = this.profile();
      const catBlockLevels = levels.filter(level => level.catBlock);
      const foundCatBlocks = new Set(profile?.catBlocks ?? []);
      const goldStars = levels.filter(level => levelStats(profile?.results, level.id).goldStar).length;
      const catBlocks = catBlockLevels.filter(level => foundCatBlocks.has(level.id)).length;
      return { id: world.id, label: `World ${world.id}`, subtitle: world.name,
        x: world.mapPosition?.x ?? 15 + column * 70 / columns,
        y: world.mapPosition?.y ?? (world.special ? 73 : 30),
        theme: world.theme, color: world.color, special: world.special, completed: this.completed(world),
        goldStar: levels.length > 0 && goldStars === levels.length,
        catBlockFound: catBlockLevels.length > 0 && catBlocks === catBlockLevels.length,
        worldProgress: { goldStars, totalGoldStars: levels.length, catBlocks, totalCatBlocks: catBlockLevels.length },
        action: () => {
          if (this.world === world && !this.map.querySelector('.map-koshi').hidden) this.showWorld(world);
          else this.selectWorld(world);
        } };
    });
    this.draw(nodes, WORLDS.flatMap(world => world.next.map(id => [world.id, id])), official ? 900 : 300);
    this.selectWorld(this.world);
    const custom = this.custom();
    if (custom) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = `Editor - ${custom.id}`;
      button.className = 'title-secondary';
      button.addEventListener('click', () => {
        this.selection.value = 'custom';
        this.details.replaceChildren(this.objectives(custom));
        this.layout.dataset.view = 'levels';
        this.back.hidden = false;
        this.navigation.resize();
        this.details.hidden = false;
        this.play.hidden = false;
        this.setCutsceneOption(custom);
        for (const node of this.map.querySelectorAll('.map-node')) node.setAttribute('aria-pressed', 'false');
        this.map.querySelector('.map-koshi').hidden = true;
      });
      this.map.append(button);
    }
  }
  completed(world) {
    const levels = worldLevels(world), completed = this.profile()?.completed ?? [];
    return levels.length > 0 && levels.every(level => completed.includes(level.id));
  }
  selectWorld(world) {
    this.world = world;
    this.mark(world.id);
    this.play.hidden = true;
    this.setCutsceneOption(null);
    this.details.replaceChildren();
    this.details.hidden = true;
  }
  showWorld(world, departure = null) {
    if (world.id === 'C') {
      this.showCatTown(world);
      return;
    }
    if (!worldLevels(world).length) {
      this.selectWorld(world);
      this.heading.textContent = `World ${world.id} - ${world.name}`;
      const message = document.createElement('p');
      message.className = 'campaign-empty-message';
      message.textContent = `${world.special ? 'Optional bonus and challenge world. ' : ''}No levels have been added to this world yet.`;
      this.details.replaceChildren(message);
      this.details.hidden = false;
      this.layout.dataset.view = 'levels';
      this.setCutsceneOption(null);
      this.navigation.resize();
      this.back.hidden = false;
      return;
    }
    this.view = 'levels';
    this.layout.dataset.view = 'levels';
    this.details.hidden = false;
    this.world = world;
    this.heading.textContent = `World ${world.id} - ${world.name}`;
    this.back.hidden = false; this.play.hidden = false;
    const levels = [...(departure ? [departure] : []), ...worldLevels(world)];
    const rows = Math.ceil(levels.length / 4);
    const height = rows * 100 + 50;
    const profile = this.profile();
    const nodes = levels.map((level, i) => {
      const row = Math.floor(i / 4), column = row % 2 ? 3 - i % 4 : i % 4;
      return { id: level.id, label: level.number, x: 12 + column * 25,
        y: (row * 100 + 80) / height * 100, theme: world.theme,
        boss: level.bossLevel,
        subtitle: level === departure ? `From World ${level.worldId}` : null,
        completed: profile?.completed.includes(level.id),
        goldStar: levelStats(profile?.results, level.id).goldStar,
        catBlock: level.catBlock ?? null,
        catBlockFound: (profile?.catBlocks ?? []).includes(level.id),
        action: () => {
          if (level === departure) {
            this.selection.value = String(LEVELS.indexOf(level));
            this.showWorld(WORLDS.find(entry => entry.id === level.worldId));
          } else this.selectLevel(level);
        } };
    });
    this.draw(nodes, levels.slice(1).map((level, i) => [levels[i].id, level.id]), height);
    this.map.classList.add('map-zoom');
    const current = levels.find(level => LEVELS.indexOf(level) === Number(this.selection.value));
    this.selectLevel(current ?? levels.find(level => !this.profile()?.completed.includes(level.id)) ?? levels[0]);
    this.map.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
  }
  showCatTown(world) {
    this.view = 'town';
    this.world = world;
    this.layout.dataset.view = 'levels';
    this.heading.textContent = 'Cat Town';
    this.back.hidden = false;
    this.play.hidden = false;
    this.play.textContent = 'Visit Location';
    this.map.classList.remove('official-world-map');
    this.map.classList.add('cat-town-map');
    this.setCutsceneOption(null);
    this.details.hidden = true;
    const nodes = LOCATIONS.map(location => ({
      id: location.id, label: location.name, x: location.x, y: location.y,
      theme: world.theme, color: world.color, location: true,
      action: () => this.selectTownLocation(location),
    }));
    this.draw(nodes, nodes.map((location, index) => [location.id, nodes[(index + 1) % nodes.length].id]), 900);
    this.map.classList.remove('map-zoom');
    this.selectTownLocation(LOCATIONS[0]);
  }
  selectTownLocation(location) {
    this.townLocation = location;
    this.mark(location.id);
    this.play.hidden = false;
    this.play.textContent = 'Visit Location';
    this.details.hidden = false;
    const descriptions = {
      mall: 'Meet Whiskers, browse a few prizes, and exchange unspent gold stars for decorations.',
      house: 'Visit Koshi’s home to arrange and inspect everything he has brought back from the mall.',
      tree: 'Bruiser welcomes Koshi as collected Cat Blocks build the growing cat tree.',
      tank: 'Eugene looks after the aquarium and the Fabled Fish from completed special worlds.',
    };
    const description = document.createElement('p');
    description.textContent = descriptions[location.id];
    this.details.replaceChildren(description);
    this.setCutsceneOption(null);
  }
  advanceFrom(index) {
    const completed = LEVELS[index], next = nextLevelIndex(index);
    const destination = next === -1 ? completed : LEVELS[next];
    this.selection.value = String(index);
    this.showWorld(WORLDS.find(world => world.id === destination.worldId),
      completed.worldId === destination.worldId ? null : completed);
    this.map.classList.remove('map-zoom');
    if (next !== -1) this.selectLevel(destination);
    this.map.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
  }
  objectives(level, activateHint = hintActivator()) {
    const objective = document.createElement('div'), row = document.createElement('div');
    objective.className = 'map-objectives-container';
    row.className = 'map-objectives';
    objective.setAttribute('role', 'group');
    objective.setAttribute('aria-label', 'Time limit and win objectives');
    const timeLabel = level.bossLevel ? 'No time limit' : level.survive
      ? `Survive for ${level.duration} seconds` : `Achieve win objective(s) in ${level.duration} seconds`;
    const targets = [
      { symbol: '🕒', value: level.bossLevel ? '∞' : `${level.duration}s`, label: timeLabel },
      ...(level.bossLevel ? [{ symbol: '👾', value: 'BOSS', label: 'Defeat the boss' }] : []),
      ...(level.survive ? [] : [
        { symbol: '🍗', target: level.goal, name: 'food points' },
        { symbol: '👾', target: level.killGoal, name: 'enemy points' },
        { symbol: '⚽', target: level.goalsGoal, name: 'soccer goals' },
      ].filter(({ target }) => target > 0).map(({ symbol, target, name }) => ({
        symbol, value: String(target), label: `Get ${target} ${name}`,
      }))),
    ];
    objective.append(row);
    for (const [index, { symbol, value, label }] of targets.entries()) {
      const badge = document.createElement('button'), icon = document.createElement('span');
      badge.className = 'map-objective';
      badge.setAttribute('aria-label', label);
      icon.textContent = symbol;
      icon.setAttribute('aria-hidden', 'true');
      badge.append(icon);
      const count = document.createElement('strong');
      count.textContent = value;
      badge.append(count);
      row.append(badge);
      objective.append(collectibleHint(badge, `map-objective-description-${index}`, label, activateHint));
    }
    return objective;
  }
  selectLevel(level) {
    this.selection.value = String(LEVELS.indexOf(level));
    this.mark(level.id);
    this.setCutsceneOption(level);
    this.details.replaceChildren();
    this.details.scrollTop = 0;
    const activateHint = hintActivator();
    const heading = document.createElement('header'), title = document.createElement('h3');
    const objective = this.objectives(level, activateHint), stats = document.createElement('dl');
    heading.className = 'map-level-heading';
    title.textContent = `Level ${level.number} - ${level.name}`;
    const profile = this.profile(), result = levelStats(profile?.results, level.id);
    const star = document.createElement('button');
    star.className = `map-star${result.goldStar ? ' map-star-earned' : ''}`;
    star.append(goldStarIcon(result.goldStar, document));
    star.title = result.goldStar ? 'Gold star earned: completed without taking damage' : 'Gold star not earned: complete without taking damage';
    star.setAttribute('aria-label', star.title);
    const starDescription = collectibleHint(star, 'map-star-description',
      'Earn the gold star by completing this level without taking any damage.', activateHint);
    heading.append(title, star);
    let catBlockDescription;
    if (level.catBlock) {
      const description = catBlockObjective(level);
      const catBlock = document.createElement('button');
      catBlock.className = 'map-cat-block';
      catBlock.title = description;
      const catBlockFound = (profile?.catBlocks ?? []).includes(level.id);
      catBlock.setAttribute('aria-label', `Cat Block${catBlockFound ? ' found' : ''}: ${description}`);
      catBlock.append(catBlockIcon(catBlockFound, document));
      if (catBlockFound) catBlock.classList.add('map-cat-block-found');
      catBlockDescription = collectibleHint(catBlock, 'map-cat-block-description',
        description, activateHint);
      heading.append(catBlock);
    }
    const fields = [
      ...(level.activationLimit == null ? [] : [['Moves to beat', `${level.activationLimit} activations`]]),
      ['Best (fastest) win', result.bestTime === null ? 'Not recorded' : `${result.bestTime.toFixed(2)} seconds`],
      ['Fewest moves', result.fewestMoves ?? 'Not recorded'],
      ['Most food points', result.mostFood ?? 'Not recorded'],
      ['Most enemy points', result.mostEnemies ?? 'Not recorded'],
      ['Wins / losses / quits', `${result.wins} / ${result.losses} / ${result.quits}`],
      ['Win percentage', result.winPercent === null ? 'N/A' : `${result.winPercent.toFixed(1)}%`],
    ];
    for (const [name, value] of fields) {
      const term = document.createElement('dt'), description = document.createElement('dd');
      term.textContent = name; description.textContent = value;
      if (name === 'Moves to beat') term.title = 'Zero activations is fatal.';
      stats.append(term, description);
    }
    const featureHeading = document.createElement('h4');
    featureHeading.className = 'map-features-heading';
    featureHeading.textContent = 'Level Features';
    const featureGroups = document.createElement('div');
    featureGroups.className = 'map-feature-groups';
    featureGroups.setAttribute('aria-label', 'Level features by type');
    const groups = [
      { id: 'bricks', label: 'Bricks', className: 'map-feature-bricks' },
      { id: 'enemies', label: 'Enemies', className: 'map-feature-enemies' },
      { id: 'food', label: 'Food', className: 'map-feature-food' },
      { id: 'items', label: 'Items / Objects', className: 'map-feature-items' },
    ];
    const features = levelFeatures(level);
    const groupFor = feature => {
      const [kind, type] = feature.picture.split(':');
      if (kind === 'enemy') return 'enemies';
      if (kind === 'food') return 'food';
      if (['item', 'weapon', 'object', 'heart'].includes(kind) || (kind === 'special' && type === 'boom-helmet')) return 'items';
      return 'bricks';
    };
    for (const group of groups) {
      const section = document.createElement('section'), heading = document.createElement('h5');
      section.className = `map-feature-group ${group.className}`;
      heading.textContent = group.label;
      const icons = document.createElement('div');
      icons.className = 'map-features';
      for (const feature of features.filter(feature => groupFor(feature) === group.id)) {
        const icon = document.createElement('span');
        icon.className = 'map-feature'; icon.title = feature.name;
        const label = document.createElement('span');
        label.textContent = feature.name;
        icon.append(this.picture(feature.picture, feature.name, group.id === 'bricks'), label);
        icons.append(icon);
      }
      if (!icons.children.length) {
        const empty = document.createElement('p');
        empty.className = 'map-feature-empty';
        empty.textContent = 'None';
        icons.append(empty);
      }
      section.append(heading, icons);
      featureGroups.append(section);
    }
    const featureSection = document.createElement('section');
    featureSection.className = 'map-feature-section';
    featureSection.append(featureHeading, featureGroups);
    if (catBlockDescription) heading.append(catBlockDescription);
    heading.append(starDescription);
    this.details.append(heading);
    this.details.append(objective, stats);
    this.details.append(featureSection);
  }
  setCutsceneOption(level) {
    const hasCutscene = Boolean(level?.cutscene);
    this.skipCutsceneOption.hidden = !hasCutscene;
    this.skipCutscene.checked = hasCutscene && this.cutsceneViewed(level.id);
    this.close.hidden = this.layout.dataset.view !== 'worlds';
  }
  draw(nodes, edges, height) {
    this.map.classList.remove('official-world-map');
    if (this.view === 'worlds' && WORLDS.some(world => world.mapPosition)) {
      this.map.classList.add('official-world-map');
    }
    this.map.replaceChildren();
    this.map.style.height = `${height}px`;
    this.navigation.reset(height);
    this.map.dataset.view = this.view;
    this.map.dataset.theme = this.world.theme;
    if (this.world.color) this.map.style.setProperty('--world-color', this.world.color);
    const ns = 'http://www.w3.org/2000/svg', lines = document.createElementNS(ns, 'svg');
    lines.setAttribute('viewBox', '0 0 100 100'); lines.setAttribute('preserveAspectRatio', 'none');
    lines.setAttribute('aria-hidden', 'true'); lines.classList.add('map-paths');
    for (const [from, to] of edges) {
      const a = nodes.find(node => node.id === from), b = nodes.find(node => node.id === to);
      if (!a || !b) throw new Error(`Invalid map route: ${from} to ${to}`);
      const path = document.createElementNS(ns, 'line');
      for (const [key, value] of Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })) path.setAttribute(key, value);
      if (a.special || b.special) path.classList.add('special-route');
      lines.append(path);
    }
    this.map.append(lines);
    for (const node of nodes) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'map-node';
      if (node.boss) button.classList.add('map-node-boss');
      button.dataset.node = node.id; button.dataset.theme = node.theme;
      if (node.color) button.style.setProperty('--world-color', node.color);
      if (node.special) button.classList.add('map-node-special');
      button.style.left = `${node.x}%`; button.style.top = `${node.y}%`;
      button.setAttribute('aria-pressed', 'false');
      const worldNode = this.view === 'worlds';
      const worldStatus = worldNode ? `, ${node.completed ? 'all levels completed' : 'not all levels completed'}, ${
        node.worldProgress.goldStars} of ${node.worldProgress.totalGoldStars} gold stars earned, ${
        node.worldProgress.catBlocks} of ${node.worldProgress.totalCatBlocks} Cat Blocks found` : '';
      button.setAttribute('aria-label', `${node.label}${node.subtitle ? ` - ${node.subtitle}` : ''}${
        worldNode ? worldStatus : `${node.boss ? ', boss level' : ''}${node.completed ? ', completed' : ''}${node.goldStar ? ', gold star earned' : ''}${
          node.catBlock ? `, Cat Block available${node.catBlockFound ? ', found' : ''}` : ''}`}`);
      if (node.boss) {
        const skull = document.createElementNS(ns, 'svg');
        skull.setAttribute('viewBox', '0 0 80 76'); skull.setAttribute('aria-hidden', 'true');
        skull.classList.add('map-boss-skull');
        const outline = document.createElementNS(ns, 'path');
        outline.setAttribute('d', 'M40 3C20 3 8 15 8 31C8 36 9 40 10 43C6 49 6 55 10 58C13 61 17 61 21 62C24 63 23 68 25 70C27 73 32 73 34 70C36 74 41 74 43 70C45 74 50 74 52 70C55 73 60 73 62 70C64 68 63 63 66 62C70 61 74 61 76 58C80 54 78 48 74 43C76 39 76 35 76 31C76 15 62 3 40 3Z');
        const eyes = document.createElementNS(ns, 'path');
        eyes.setAttribute('d', 'M16 48C16 44 19 42 23 42C27 42 29 45 29 49C29 53 26 55 22 55C18 55 16 52 16 48ZM51 49C51 45 53 42 57 42C61 42 64 44 64 48C64 52 62 55 58 55C54 55 51 53 51 49Z');
        eyes.classList.add('map-boss-eyes');
        const nose = document.createElementNS(ns, 'path');
        nose.setAttribute('d', 'M40 54C38 54 35 59 35 61C35 63 38 63 40 62C42 63 45 63 45 61C45 59 42 54 40 54Z');
        nose.classList.add('map-boss-eyes');
        skull.append(outline, eyes, nose); button.append(skull);
      }
      const name = document.createElement('strong'); name.textContent = node.label;
      button.append(name);
      if (node.subtitle && this.view === 'worlds') {
        const emblem = document.createElementNS(ns, 'svg');
        emblem.setAttribute('viewBox', '0 0 48 40'); emblem.setAttribute('aria-hidden', 'true');
        emblem.classList.add('world-emblem');
        const shape = document.createElementNS(ns, 'path');
        if (node.theme === 'official') {
          const id = node.id.replace(/^S/, '');
          if (!Object.hasOwn(OFFICIAL_EMBLEMS, id)) throw new Error(`Unknown official world emblem: ${node.id}`);
          shape.setAttribute('d', OFFICIAL_EMBLEMS[id]);
          emblem.classList.add('world-emblem-pixel');
        } else shape.setAttribute('d', node.theme === 'garden'
          ? 'M24 36V18 M24 26C2 28 4 6 4 6S26 5 24 26 M24 19C43 21 44 2 44 2S22 0 24 19'
          : node.theme === 'foundry'
            ? 'M22 2H26V10H38V36H10V10H22Z M16 16V24H22V16Z M26 16V24H32V16Z M17 28V31H31V28Z'
            : 'M15 4H33V10H39V16H45V26H39V32H33V38H15V32H9V26H3V16H9V10H15Z M24 13A8 8 0 1 0 24 29A8 8 0 1 0 24 13');
        shape.setAttribute('fill-rule', 'evenodd');
        emblem.append(shape); button.prepend(emblem);
        const subtitle = document.createElement('small'); subtitle.textContent = node.subtitle; button.append(subtitle);
      }
      if (node.subtitle && this.view === 'levels') {
        const subtitle = document.createElement('small'); subtitle.textContent = node.subtitle; button.append(subtitle);
      }
      if (node.completed || worldNode) {
        if (node.completed) button.classList.add('completed');
        const flag = document.createElement('span'), cloth = document.createElement('span');
        flag.className = `completion-flag${node.completed ? ' completion-flag-earned' : ''}`;
        flag.setAttribute('aria-hidden', 'true');
        cloth.className = 'flag-cloth'; flag.append(cloth); button.append(flag);
      }
      if ((this.view === 'levels' && !node.location) || worldNode) {
        const star = document.createElement('span');
        star.className = `map-node-star${node.goldStar ? ' map-node-star-earned' : ''}`;
        star.append(goldStarIcon(node.goldStar, document));
        star.setAttribute('aria-hidden', 'true');
        button.append(star);
      }
      if (node.catBlock || worldNode) {
        const catBlock = document.createElement('span');
        catBlock.className = `map-node-cat-block${node.catBlockFound ? ' map-node-cat-block-found' : ''}`;
        catBlock.title = worldNode
          ? `${node.worldProgress.catBlocks} of ${node.worldProgress.totalCatBlocks} Cat Blocks found`
          : `Cat Block: ${catBlockObjective(LEVELS.find(level => level.id === node.id))}`;
        catBlock.setAttribute('aria-hidden', 'true');
        catBlock.append(catBlockIcon(node.catBlockFound, document));
        button.append(catBlock);
      }
      button.addEventListener('click', node.action); this.map.append(button);
    }
    const koshi = document.createElement('img');
    koshi.src = './icons/koshi.svg'; koshi.alt = ''; koshi.className = 'map-koshi';
    this.map.append(koshi);
  }
  mark(id) {
    const nodes = [...this.map.querySelectorAll('.map-node')];
    const previous = nodes.find(node => node.getAttribute('aria-pressed') === 'true');
    let selected;
    for (const node of nodes) {
      const active = node.dataset.node === id;
      node.setAttribute('aria-pressed', String(active));
      if (active) selected = node;
    }
    const koshi = this.map.querySelector('.map-koshi');
    const coordinate = (value, size) => parseFloat(value) * (value.endsWith('%') ? size / 100 : 1);
    const width = this.map.clientWidth, height = this.map.clientHeight;
    const start = koshi.getBoundingClientRect();
    const bounds = this.map.getBoundingClientRect();
    koshi.getAnimations().forEach(animation => animation.cancel());
    koshi.hidden = false; koshi.style.left = selected.style.left; koshi.style.top = selected.style.top;
    if (previous && previous !== selected && !globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const destination = { x: coordinate(selected.style.left, width), y: coordinate(selected.style.top, height) };
      const end = koshi.getBoundingClientRect();
      const transform = globalThis.getComputedStyle(koshi).transform;
      const route = this.view === 'levels';
      const from = nodes.indexOf(previous), to = nodes.indexOf(selected), direction = Math.sign(to - from);
      const stops = route
        ? Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => nodes[from + i * direction])
        : [previous, selected];
      const points = stops.map(node => ({ x: coordinate(node.style.left, width), y: coordinate(node.style.top, height) }));
      points[0] = { x: destination.x + (start.left - end.left) * width / bounds.width,
        y: destination.y + (start.top - end.top) * height / bounds.height };
      const frames = points.map(point => ({
        transform: `translate(${point.x - destination.x}px, ${point.y - destination.y}px) ${transform}`,
      }));
      koshi.animate(frames, {
        duration: route ? Math.max(600, Math.min(1500, (frames.length - 1) * 160)) : 350,
        easing: route ? 'linear' : 'ease',
      });
    }
    selected.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

globalThis.KoshiWorldMap = WorldMap;
})();
