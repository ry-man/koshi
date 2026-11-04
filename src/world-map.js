(function () {
'use strict';

const { LEVELS, levelObjective } = globalThis.KoshiGame;
const { WORLDS, worldLevels, levelFeatures, nextLevelIndex } = globalThis.KoshiWorlds;
const { levelStats } = globalThis.KoshiSaves;

class WorldMap {
  constructor({ selection, profile, picture, custom, cutsceneViewed = () => false }) {
    this.selection = selection;
    this.profile = profile;
    this.picture = picture;
    this.custom = custom;
    this.map = document.querySelector('#world-map');
    this.details = document.querySelector('#map-details');
    this.heading = document.querySelector('#level-picker-heading');
    this.back = document.querySelector('#world-map-back');
    this.play = document.querySelector('#level-picker-play');
    this.close = document.querySelector('#level-picker-close');
    this.skipCutscene = document.querySelector('#skip-cutscene');
    this.skipCutsceneOption = document.querySelector('#skip-cutscene-option');
    this.cutsceneViewed = cutsceneViewed;
    this.back.addEventListener('click', () => {
      this.open();
      this.map.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
    });
  }
  open() {
    this.view = 'worlds';
    const level = LEVELS[Number(this.selection.value)];
    this.world = WORLDS.find(world => world.id === level?.worldId) ?? WORLDS[0];
    this.heading.textContent = 'World map';
    this.back.hidden = true;
    this.play.hidden = true;
    this.map.classList.remove('map-zoom');
    const main = WORLDS.filter(world => !world.special);
    const columns = Math.max(1, main.length - 1 + (WORLDS.some(world => world.special
      && main.at(-1).next.includes(world.id)) ? .5 : 0));
    const nodes = WORLDS.map(world => {
      const parent = WORLDS.find(entry => entry.next.includes(world.id));
      const column = world.special ? Math.max(0, main.indexOf(parent)) + .5 : main.indexOf(world);
      return { id: world.id, label: `World ${world.id}`, subtitle: world.name,
        x: 15 + column * 70 / columns, y: world.special ? 73 : 30,
        theme: world.theme, special: world.special, completed: this.completed(world),
        action: () => {
          if (this.world === world && !this.map.querySelector('.map-koshi').hidden) this.showWorld(world);
          else this.selectWorld(world);
        } };
    });
    this.draw(nodes, WORLDS.flatMap(world => world.next.map(id => [world.id, id])), 300);
    this.selectWorld(this.world);
    const custom = this.custom();
    if (custom) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = `Editor - ${custom.id}`;
      button.className = 'title-secondary';
      button.addEventListener('click', () => {
        this.selection.value = 'custom';
        this.details.replaceChildren(this.objectives(custom));
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
    return levels.every(level => completed.includes(level.id));
  }
  selectWorld(world) {
    this.world = world;
    this.mark(world.id);
    this.play.hidden = true;
    this.setCutsceneOption(null);
    const levels = worldLevels(world), completed = this.profile()?.completed ?? [];
    this.details.replaceChildren();
    const heading = document.createElement('h3'), text = document.createElement('p');
    heading.textContent = `World ${world.id} - ${world.name}`;
    text.textContent = `${levels.length} levels · ${levels.filter(level => completed.includes(level.id)).length} completed. ${
      world.special ? 'Optional extra difficulty.' : 'Main adventure path.'} Click this world again to zoom in.${
      world.next.length ? ` Routes to ${world.next.map(id => `World ${id}`).join(' or ')}.` : ''}`;
    this.details.append(heading, text);
  }
  showWorld(world, departure = null) {
    this.view = 'levels';
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
        subtitle: level === departure ? `From World ${level.worldId}` : null,
        completed: profile?.completed.includes(level.id),
        goldStar: levelStats(profile?.results, level.id).goldStar,
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
  objectives(level) {
    const objective = document.createElement('p');
    objective.className = 'map-objectives';
    objective.setAttribute('role', 'group');
    objective.setAttribute('aria-label', 'Time limit and win objectives');
    objective.title = levelObjective(level);
    const timeLabel = level.survive ? `Survive for ${level.duration}s` : `Time limit: ${level.duration}s`;
    const targets = [
      { symbol: '🕒', value: `${level.duration}s`, label: timeLabel },
      ...(level.survive ? [] : [
        { symbol: '🍗', target: level.goal, name: 'food points' },
        { symbol: '👾', target: level.killGoal, name: 'enemy points' },
        { symbol: '⚽', target: level.goalsGoal, name: 'soccer goals' },
      ].filter(({ target }) => target > 0).map(({ symbol, target, name }) => ({
        symbol, value: String(target), label: `${target} ${name}`,
      }))),
    ];
    for (const { symbol, value, label } of targets) {
      const badge = document.createElement('span'), icon = document.createElement('span');
      badge.className = 'map-objective';
      badge.title = label;
      badge.setAttribute('aria-label', badge.title);
      icon.textContent = symbol;
      icon.setAttribute('aria-hidden', 'true');
      badge.append(icon);
      const count = document.createElement('strong');
      count.textContent = value;
      badge.append(count);
      objective.append(badge);
    }
    return objective;
  }
  selectLevel(level) {
    this.selection.value = String(LEVELS.indexOf(level));
    this.mark(level.id);
    this.setCutsceneOption(level);
    this.details.replaceChildren();
    const heading = document.createElement('header'), title = document.createElement('h3');
    const objective = this.objectives(level), stats = document.createElement('dl');
    heading.className = 'map-level-heading';
    title.textContent = `Level ${level.number} - ${level.name}`;
    const profile = this.profile(), result = levelStats(profile?.results, level.id);
    const star = document.createElement('span');
    star.className = `map-star${result.goldStar ? ' map-star-earned' : ''}`;
    star.textContent = result.goldStar ? '★' : '☆';
    star.title = result.goldStar ? 'Gold star earned: completed without taking damage' : 'Gold star not earned: complete without taking damage';
    star.setAttribute('role', 'img');
    star.setAttribute('aria-label', star.title);
    heading.append(title, star);
    const fields = [
      ...(level.activationLimit == null ? [] : [['Moves to beat', `${level.activationLimit} activations`]]),
      ['Best (fastest) win', result.bestTime === null ? 'Not recorded' : `${result.bestTime.toFixed(2)} seconds`],
      ['Fewest moves', result.fewestMoves ?? 'Not recorded'],
      ['Most food points', result.mostFood ?? 'Not recorded'],
      ['Most enemy points', result.mostEnemies ?? 'Not recorded'],
      ['Wins / losses', `${result.wins} / ${result.losses}`],
      ['Win percentage', result.winPercent === null ? 'Not recorded' : `${result.winPercent.toFixed(1)}%`],
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
    const note = profile?.guest ? null : document.createElement('p');
    if (note) {
      note.className = 'map-note';
      note.textContent = 'Only finished attempts count. Earlier saved completions have no recorded statistics. Quitting does not count.';
    }
    this.details.append(heading, objective, stats);
    if (note) this.details.append(note);
    this.details.append(featureSection);
  }
  setCutsceneOption(level) {
    const hasCutscene = Boolean(level?.cutscene);
    this.skipCutsceneOption.hidden = !hasCutscene;
    this.skipCutscene.checked = hasCutscene && this.cutsceneViewed(level.id);
    this.close.hidden = hasCutscene;
  }
  draw(nodes, edges, height) {
    this.map.replaceChildren();
    this.map.style.height = `${height}px`;
    this.map.dataset.theme = this.world.theme;
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
      button.dataset.node = node.id; button.dataset.theme = node.theme;
      button.style.left = `${node.x}%`; button.style.top = `${node.y}%`;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `${node.label}${node.subtitle ? ` - ${node.subtitle}` : ''}${node.completed ? ', completed' : ''}${node.goldStar ? ', gold star earned' : ''}`);
      const name = document.createElement('strong'); name.textContent = node.label;
      button.append(name);
      if (node.subtitle && this.view === 'worlds') {
        const emblem = document.createElementNS(ns, 'svg');
        emblem.setAttribute('viewBox', '0 0 48 40'); emblem.setAttribute('aria-hidden', 'true');
        emblem.classList.add('world-emblem');
        const shape = document.createElementNS(ns, 'path');
        shape.setAttribute('d', node.theme === 'garden'
          ? 'M24 36V18 M24 26C2 28 4 6 4 6S26 5 24 26 M24 19C43 21 44 2 44 2S22 0 24 19'
          : 'M15 4H33V10H39V16H45V26H39V32H33V38H15V32H9V26H3V16H9V10H15Z M24 13A8 8 0 1 0 24 29A8 8 0 1 0 24 13');
        shape.setAttribute('fill-rule', 'evenodd');
        emblem.append(shape); button.prepend(emblem);
        const subtitle = document.createElement('small'); subtitle.textContent = node.subtitle; button.append(subtitle);
      }
      if (node.subtitle && this.view === 'levels') {
        const subtitle = document.createElement('small'); subtitle.textContent = node.subtitle; button.append(subtitle);
      }
      if (node.completed) {
        button.classList.add('completed');
        const flag = document.createElement('span'), cloth = document.createElement('span');
        flag.className = 'completion-flag'; flag.setAttribute('aria-hidden', 'true');
        cloth.className = 'flag-cloth'; flag.append(cloth); button.append(flag);
      }
      if (node.goldStar) {
        const star = document.createElement('span');
        star.className = 'map-node-star';
        star.textContent = '★';
        star.setAttribute('aria-hidden', 'true');
        button.append(star);
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
    const style = globalThis.getComputedStyle(koshi), start = { left: style.left, top: style.top };
    koshi.getAnimations().forEach(animation => animation.cancel());
    koshi.hidden = false; koshi.style.left = selected.style.left; koshi.style.top = selected.style.top;
    if (this.view === 'levels' && previous && previous !== selected
      && !globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const from = nodes.indexOf(previous), to = nodes.indexOf(selected), direction = Math.sign(to - from);
      const stops = Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => nodes[from + i * direction]);
      const frames = stops.map(node => ({ left: node.style.left, top: node.style.top }));
      frames[0] = start;
      koshi.animate(frames, { duration: Math.max(600, Math.min(1500, (frames.length - 1) * 160)), easing: 'linear' });
    }
    selected.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

globalThis.KoshiWorldMap = WorldMap;
})();
