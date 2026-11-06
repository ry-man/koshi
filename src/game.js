(function () {
'use strict';

const WIDTH = 960;
const HEIGHT = 600;
const DURATION = 60;
const GOAL = 20;
const SPEED = 420;
const DAMAGE_DURATION = 1;
const MUSIC_STREAM_DURATION = 10;
const SUNGLASSES_DURATION = 10;
const CAPE_DURATION = 10;
const CAPE_SPEED_MULTIPLIER = 2;
const MASK_DURATION = 10;
const FEAR_SPEED = 64;
const COW_SPEED = 190;
const COW_EAT_DURATION = 5;
const OBSTRUCTION_RADIUS = 48;
const OBSTRUCTION_PATTERNS = ['solid', 'polka-dots', 'stripes', 'checkered'];
const DITTO_STAMP_RADIUS = 27;
const COOLDOWNS = { slow: 15, normal: 8, fast: 3 };
const SLIMES = { blue: { duration: 5, color: '#287dcc' }, green: { duration: 3, color: '#399d24' }, red: { duration: 1, color: '#cd4136' } };
const FOODS = {
  S: { icon: '🍓', value: 1, name: 'Strawberry' },
  P: { icon: '🥨', value: 2, name: 'Pretzel' },
  B: { icon: '🍌', value: 3, name: 'Banana' },
  C: { icon: '🧀', value: 4, name: 'Cheese' },
  L: { icon: '🍗', value: 5, name: 'Chicken leg' },
  F: { icon: '🐟', value: 6, name: 'Fish' },
  H: { icon: '🍔', value: 7, name: 'Hamburger' },
};
const ITEMS = {
  'smiley-cookie': { name: 'Smiley Cookie', icon: '🍪', color: '#fff2d6' },
  stopwatch: { name: 'Red Stopwatch (+10s)', icon: '⏱️', color: '#d94a4a', seconds: 10 },
  'stopwatch-green': { name: 'Green Stopwatch (+30s)', icon: '⏱️', color: '#399d4a', seconds: 30 },
  'stopwatch-blue': { name: 'Blue Stopwatch (+60s)', icon: '⏱️', color: '#287dcc', seconds: 60 },
  battery: { name: 'Battery', icon: '🔋', color: '#f0ce35' },
  'music-box': { name: 'Music Box', icon: '🎵', color: '#d989b8' },
  eggplant: { name: 'Eggplant (-10 food)', icon: '🍆', color: '#8956aa' },
  'saw-blade': { name: 'Saw Blade', icon: '⚙', color: '#c4cdd5' },
  'magic-sunglasses': { name: 'Magical Sunglasses', icon: '🕶', color: '#d989ff' },
  'kitty-cape': { name: 'Kitty Cape', icon: '⚡', color: '#b5d77c' },
  'ditto-stamp': { name: 'Ditto Stamp', icon: '▣', color: '#f59a50' },
  'spooky-mask': { name: 'Spooky Mask', icon: '👹', color: '#d73642' },
  'cat-block': { name: 'Cat Block', icon: '🐱', color: '#f5b52e' },
  key: { name: 'Key', icon: '🗝️', color: '#f0ce35' },
  'treasure-chest': { name: 'Treasure Chest', icon: '🧰', color: '#a66b36' },
  'boom-time-red': { name: 'Red Boom Time (+1)', icon: '💣', color: '#d94a4a', counts: 1 },
  'boom-time-green': { name: 'Green Boom Time (+3)', icon: '💣', color: '#399d4a', counts: 3 },
  'boom-time-blue': { name: 'Blue Boom Time (+8)', icon: '💣', color: '#287dcc', counts: 8 },
};
const CAT_BLOCK_MESSAGES = {
  item: 'Koshi found the Cat Block!',
  enemy: 'Koshi found a Cat Block carried by an enemy!',
  chest: 'Koshi opened the treasure chest and found the Cat Block!',
};
for (const [brush, name, paintUses] of [['pencil', 'Thin Paintbrush', 1], ['wide', 'Wide Paintbrush', 3], ['roller', 'Paint Roller', 5]]) {
  for (const [paintColor, paintKind, color] of [['red', 'fast', '#df8c81'], ['green', 'normal', '#83bca1'], ['blue', 'slow', '#7eacdb']]) {
    ITEMS[`paint-${brush}-${paintColor}`] = {
      name: `${paintColor[0].toUpperCase() + paintColor.slice(1)} ${name}`, icon: '🖌',
      color, brush, paintKind, paintUses,
    };
  }
}
const OBJECTS = {
  'soccer-ball': { name: 'Soccer Ball', icon: '⚽', color: '#f1f3f2' },
  'bumper-red': { name: 'Red Bumper', icon: '🔴', color: '#d94a4a', bumper: true, speedMultiplier: 1.25 },
  'bumper-green': { name: 'Green Bumper', icon: '🟢', color: '#399d4a', bumper: true, speedMultiplier: 1 },
  'bumper-blue': { name: 'Blue Bumper', icon: '🔵', color: '#287dcc', bumper: true, speedMultiplier: .75 },
  'bubble-blue': { name: 'Blue Bubble', icon: '🔵', color: '#287dcc', bubble: true, bubbleColor: 'blue' },
  'bubble-green': { name: 'Green Bubble', icon: '🟢', color: '#399d4a', bubble: true, bubbleColor: 'green' },
  'bubble-red': { name: 'Red Bubble', icon: '🔴', color: '#cd4136', bubble: true, bubbleColor: 'red' },
  'obstruction-circle': { name: 'Circle Obstruction', icon: '\u25cf', color: '#718596', obstruction: 'circle' },
  'obstruction-diamond': { name: 'Diamond Obstruction', icon: '\u25c6', color: '#718596', obstruction: 'diamond' },
  'obstruction-circle-large': { name: 'Large Circle Obstruction', icon: '\u25cf', color: '#718596', obstruction: 'circle', radius: 96 },
  'obstruction-diamond-large': { name: 'Large Diamond Obstruction', icon: '\u25c6', color: '#718596', obstruction: 'diamond', radius: 96 },
  'obstruction-rectangle-horizontal': { name: 'Horizontal Long Rectangle Obstruction', icon: '\u25ac', color: '#718596', obstruction: 'rectangle', radius: 96, width: 192, height: 48 },
  'obstruction-rectangle-vertical': { name: 'Vertical Long Rectangle Obstruction', icon: '\u25ae', color: '#718596', obstruction: 'rectangle', radius: 96, width: 48, height: 192 },
  'obstruction-rectangle-horizontal-large': { name: 'Large Horizontal Long Rectangle Obstruction', icon: '\u25ac', color: '#718596', obstruction: 'rectangle', radius: 192, width: 384, height: 96 },
  'obstruction-rectangle-vertical-large': { name: 'Large Vertical Long Rectangle Obstruction', icon: '\u25ae', color: '#718596', obstruction: 'rectangle', radius: 192, width: 96, height: 384 },
};
function needsBrickSpawnClearance(type) {
  return type === 'ditto-stamp' || type === 'saw-blade' || Boolean(ITEMS[type]?.paintUses);
}
const SOCCER_FRICTION = 100;
// Minimum distance between randomly placed pickups (food, weapons, items and hearts).
const SPAWN_SPACING = 80;
function nearestGap(point, others) {
  let gap = Infinity;
  for (const other of others) gap = Math.min(gap, Math.hypot(point.x - other.x, point.y - other.y));
  return gap;
}
const GOALIE_SPEED = 67.5;
const GOALIE_MAX_SPEED = 135;
const TURRET_DURATION = 10;
const TURRET_SHOTS = 3;
const TURRET_ENTRY_DURATION = .24;
const TURRET_FIREBALL_SPEED = 520;
const TURRET_BLAST_RADIUS = 117;
const TURRET_DOME_RADIUS = 56;
const SCHEDULE = [
  [3, 'L3', 'S', 18], [11, 'L3', 'P', 18], [19, 'C3', 'B', 20],
  [27, 'L3', 'C', 20], [35, 'C3', 'L', 20], [43, 'R3', 'F', 17],
  [51, 'S', 'H', 9],
];
const SWORDS = {
  wood: { name: 'Wood Sword', color: '#b88b60', uses: 1 },
  bronze: { name: 'Bronze Sword', color: '#4f8067', uses: 3 },
  silver: { name: 'Silver Sword', color: '#d5e0ec', uses: 5 },
  gold: { name: 'Gold Sword', color: '#f3d16b', seconds: 15 },
};
const SHIELDS = { red: { hits: 2, next: null, color: '#ed5555' }, green: { hits: 3, next: 'red', color: '#63d877' }, blue: { hits: 4, next: 'green', color: '#519eff' } };
const PORTALS = { red: '#ef655f', orange: '#ef9947', yellow: '#e8d25a', green: '#7dcc77', blue: '#55a7ee', purple: '#b18be5' };
const CONTACT_SURFACES = ['slimed', 'springs', 'spikes', 'conveyor', 'portal', 'spawner', 'boost', 'barrier', 'turret'];
const DITTO_PROPERTIES = ['kind', 'crumbler', 'warped', 'toggle', 'slimeColor', 'conveyorDirection', ...CONTACT_SURFACES];

function dittoProperties(brick) {
  return Object.fromEntries(DITTO_PROPERTIES.map(key => [key,
    brick[key] && typeof brick[key] === 'object' ? { ...brick[key] } : brick[key]]));
}

function brickEnabled(brick) { return !brick.toggle || brick.toggleRemaining === 0; }

function goalTiles(members) {
  const tiles = [];
  for (const part of members) {
    const merged = tiles.find(tile => tile.id === part.id && ((tile.y === part.y && tile.h === part.h
      && (tile.x + tile.w === part.x || part.x + part.w === tile.x))
      || (tile.x === part.x && tile.w === part.w && (tile.y + tile.h === part.y || part.y + part.h === tile.y))));
    if (!merged) tiles.push({ ...part });
    else {
      const right = Math.max(merged.x + merged.w, part.x + part.w), bottom = Math.max(merged.y + merged.h, part.y + part.h);
      merged.x = Math.min(merged.x, part.x); merged.y = Math.min(merged.y, part.y);
      merged.w = right - merged.x; merged.h = bottom - merged.y;
    }
  }
  // Gap fillers can arrive after both adjoining tiles; merge again until the whole mouth is continuous.
  return tiles.length < members.length ? goalTiles(tiles) : tiles;
}

function applyBrickTypes(bricks, entries = []) {
  const regions = brickEditRegions(bricks);
  for (const entry of entries) {
    const edgeBricks = bricks.filter(brick => regions.get(brick.id).edge === entry.edge);
    const center = brick => (regions.get(brick.id).start + regions.get(brick.id).end) / 2;
    const matching = edgeBricks.filter(brick => center(brick) >= entry.start && center(brick) < entry.end);
    if (!matching.length) matching.push(edgeBricks.reduce((best, brick) =>
      Math.abs(center(brick) - (entry.start + entry.end) / 2) < Math.abs(center(best) - (entry.start + entry.end) / 2) ? brick : best));
    for (const brick of matching) {
      brick.kind = entry.kind;
      if (['cinder', 'goal'].includes(brick.kind)) {
        for (const attribute of ['crumbler', 'warped', 'toggle']) brick[attribute] = null;
        for (const attribute of CONTACT_SURFACES) brick[attribute] = ['portal', 'spawner', 'turret'].includes(attribute) ? null : false;
        continue;
      }
      for (const attribute of ['crumbler', 'warped', 'slimeColor', 'conveyorDirection', 'toggle', ...CONTACT_SURFACES]) {
        if (entry[attribute] === undefined) continue;
        brick[attribute] = entry[attribute] && typeof entry[attribute] === 'object' ? { ...entry[attribute] } : entry[attribute];
        if (CONTACT_SURFACES.includes(attribute) && entry[attribute]) {
          for (const other of CONTACT_SURFACES) if (other !== attribute) brick[other] = ['portal', 'spawner', 'turret'].includes(other) ? null : false;
        }
      }
    }
  }
}
const CHARACTERS = { koshi: 'Koshi', mouse: 'Robo Mouse', wheel: 'Robo Wheel', ram: 'Robo Ram', bucket: 'Robo Bucket', ball: 'Robo Ball', jackolantern: 'Robo Jackolantern', snake: 'Robo Snake', goalie: 'Robo Goalie', 'robo-koshi': 'Robo Koshi', 'robo-snail': 'Robo Snail', 'robo-cow': 'Robo Cow', 'robo-unicorn': 'Robo Unicorn', tom: 'Tom the Duck' };
const SCENE_THEMES = ['garden', 'workshop', 'foundry'];

function validateCutscene(value) {
  const fail = message => { throw new TypeError(`Cutscene: ${message}`); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('expected an object.');
  if (!SCENE_THEMES.includes(value.theme)) fail('theme must be garden, workshop or foundry.');
  if (!Array.isArray(value.lines) || !value.lines.length || value.lines.length > 100) fail('provide 1–100 dialogue lines.');
  return {
    theme: value.theme,
    lines: value.lines.map((line, i) => {
      if (!line || typeof line.speaker !== 'string' || !Object.hasOwn(CHARACTERS, line.speaker)) fail(`line ${i + 1} has an unknown speaker.`);
      if (typeof line.text !== 'string' || !line.text.trim() || Array.from(line.text).length > 240) fail(`line ${i + 1} needs 1–240 characters of dialogue.`);
      if (!Array.isArray(line.actors) || !line.actors.length || line.actors.length > 6) fail(`line ${i + 1} needs 1–6 actors.`);
      const actors = line.actors.map(actor => {
        if (!actor || typeof actor.character !== 'string' || !Object.hasOwn(CHARACTERS, actor.character)) fail(`line ${i + 1} has an unknown actor.`);
        for (const axis of ['x', 'y']) {
          if (typeof actor[axis] !== 'number' || !Number.isFinite(actor[axis]) || actor[axis] < .1 || actor[axis] > .9) fail(`actor ${axis} must be between 0.1 and 0.9.`);
        }
        return { character: actor.character, x: actor.x, y: actor.y };
      });
      if (!actors.some(actor => actor.character === line.speaker)) fail(`line ${i + 1} must include the speaking character on stage.`);
      return { speaker: line.speaker, text: line.text.trim(), actors };
    }),
  };
}

class Cutscene {
  constructor(value, reducedMotion = false) {
    this.scene = validateCutscene(value);
    this.reducedMotion = reducedMotion;
    this.index = 0;
    this.elapsed = 0;
    this.revealed = false;
    this.finished = false;
  }
  get line() { return this.scene.lines[this.index]; }
  get characters() { return Array.from(this.line.text); }
  get visibleCount() { return this.reducedMotion || this.revealed ? this.characters.length : Math.min(this.characters.length, Math.floor(this.elapsed * 30)); }
  get text() { return this.characters.slice(0, this.visibleCount).join(''); }
  get typing() { return !this.finished && this.visibleCount < this.characters.length; }
  update(seconds) {
    if (!this.finished && Number.isFinite(seconds) && seconds > 0) this.elapsed += seconds;
  }
  advance() {
    if (this.finished) return;
    if (this.typing) this.revealed = true;
    else if (this.index + 1 < this.scene.lines.length) { this.index++; this.elapsed = 0; this.revealed = false; }
    else this.finished = true;
  }
  skip() { this.finished = true; }
}

const story = (theme, dialogue, enemies) => ({
  theme, lines: dialogue.map(([speaker, text]) => ({
    speaker, text, actors: ['koshi', 'tom', ...enemies].map((character, index, cast) => ({
      character, x: .16 + index * .68 / (cast.length - 1), y: character === speaker ? .7 : .65,
    })),
  })),
});
const campaignRegions = brickEditRegions(makeBricks());
const campaignBrick = (id, attributes) => ({ ...campaignRegions.get(id), kind: 'normal', ...attributes });
const BASE_LEVEL_DATA = [
  {
    id: '1-1', name: 'Breakfast rebellion', concept: 'normal bricks', duration: 60, goal: 20, food: SCHEDULE,
    enemies: [], weapons: [], bricks: [],
    dialogue: [
      ['tom', 'I am Tom the Duck! My robots will seize the world and lock every meal in my Clockwork Pantry.'],
      ['koshi', 'Not while I have whiskers! I will save the world, starting with strawberries, pretzels, and a very large breakfast.'],
      ['tom', 'Click a brick to travel? Blue recharges in 15 seconds, green in 8, red in 3. You cannot outrun my plans!'],
      ['koshi', 'I can aim at any spot on a ready brick and redirect in flight. I stop when I touch a brick. Collect 20 food points? Delicious.'],
    ],
  },
  {
    id: '1-2', name: 'Mouse at the market', concept: 'robo mouse', duration: 45, survive: true,
    enemies: [[8,'mouse',2],[22,'mouse',1],[35,'mouse',1]], weapons: [], bricks: [],
    dialogue: [
      ['tom', 'My Robo Mouse patrol has occupied the market. Hold out until the evacuation bell rings!'],
      ['mouse', 'We patrol in curves and sometimes stop to bare our two front teeth. Touch us without protection and lose a heart!'],
      ['koshi', 'I will dodge your patrol for 45 seconds so everyone can escape. A banana and cheese detour sounds good, too.'],
    ],
  },
  {
    id: '1-3', name: 'Cutlery uprising', concept: 'swords', duration: 90, killGoal: 5,
    enemies: [[10,'mouse',3],[28,'mouse',3],[48,'mouse',2],[68,'mouse',3]], bricks: [],
    weapons: [[20,'wood'],[38,'bronze'],[58,'silver'],[76,'gold']],
    dialogue: [
      ['tom', 'The market is closed! My mice guard the road to the farms.'],
      ['mouse', 'Swords! Wood has 1 attack, bronze 3, silver 5; gold lasts 15 seconds. Stay out of the cat\'s reach!'],
      ['koshi', 'First I dodge, then strike! Every sword I collect replaces the old one and resets its attacks, even a weaker sword. Five enemy points, then lunch!'],
    ],
  },
  {
    id: '1-4', name: 'A hearty harvest', concept: 'hearts and heart cost', duration: 100, goal: 30, killGoal: 4,
    enemies: [[12,'mouse',3,null,{ carriesKey: true }],[35,'mouse',3,null,{ carriesKey: true }],[62,'mouse',2]], bricks: [],
    items: [[20,'key']],
    events: [{ time: 50, kind: 'item', type: 'treasure-chest', x: .5, y: .5, keysRequired: 3 }],
    catBlock: { description: 'Open the treasure chest that appears in the center at 50 seconds with 3 keys. One key appears at a random location at 20 seconds; defeat the key-marked mouse in each patrol at 12 and 35 seconds for the other two. The chest stays until opened or the level ends.' },
    dialogue: [
      ['tom', 'I have stolen the farms\' harvest. My patrol will wear down your three hearts.'],
      ['koshi', 'Food now earns healing hearts! The Next heart meter shows the food cost; each full meter creates a heart after a pink cloud.'],
      ['mouse', 'He still has to collect it! Each heart restores one, up to three.'],
      ['koshi', 'I will gather 30 food points and earn 4 enemy points to free the farms. Chicken, fish, burgers: I love every course!'],
    ],
  },
  {
    id: '1-5', name: 'Cracker causeway', concept: 'crumblers', duration: 100, goal: 35,
    enemies: [[15,'mouse',3],[45,'mouse',3],[75,'mouse',2]],
    bricks: [[4,{ crumbler: 5 }],[9,{ crumbler: 5 }],[16,{ crumbler: 5 }]],
    dialogue: [
      ['tom', 'The old causeway is made of Crumblers. Every time you select one, its remaining uses fall!'],
      ['mouse', 'At zero uses, you cannot aim at it again. It still stops you, though.'],
      ['koshi', 'Five uses per crumbly brick: I will save them for useful routes and use plain bricks too. Recover 35 food points, not just cracker crumbs!'],
    ],
  },
  {
    id: '1-6', name: 'Sticky jam depot', concept: 'slime', duration: 100, goal: 30, killGoal: 5,
    enemies: [[12,'mouse',3],[38,'mouse',3],[68,'mouse',3]],
    bricks: [[4,{ slimed: true, slimeColor: 'green' }],[16,{ slimed: true, slimeColor: 'green' }],[9,{ crumbler: 5 }]],
    dialogue: [
      ['tom', 'My jam depot has slime-coated bricks. Land on one and you are stuck before you can steer again!'],
      ['mouse', 'Green slime holds for 3 seconds. Blue holds for 5, red for 1. Our green batch should spoil your lunch!'],
      ['koshi', 'I will plan around the sticky pauses, save the jam, and earn 5 enemy points plus 30 food points. Even sticky toast deserves freedom.'],
    ],
  },
  {
    id: '1-7', name: 'Tin-foil picnic', concept: 'enemy shields', duration: 110, killGoal: 8,
    enemies: [[10,'mouse',4],[28,'mouse',2,'red'],[45,'mouse',3],[64,'mouse',3,'red'],[82,'mouse',2]],
    bricks: [[16,{ slimed: true, slimeColor: 'red' }],[9,{ crumbler: 5 }]],
    dialogue: [
      ['tom', 'My shielded patrol starts here! Red needs 2 hits, green 3, blue 4. Expect more and stronger shields as you approach my pantry.'],
      ['mouse', 'Each hit weakens the shield. We blink with one second of protection between accepted hits!'],
      ['koshi', 'Only a defeat earns points: 1 without a shield, or the original shield\'s hit count. Eight enemy points will rescue this picnic!'],
    ],
  },
  {
    id: '1-8', name: 'Skewered supper', concept: 'spikes', duration: 60, survive: true,
    enemies: [[10,'mouse',3],[30,'mouse',2],[48,'mouse',3,'red']],
    bricks: [[4,{ spikes: true }],[9,{ spikes: true }],[16,{ slimed: true, slimeColor: 'red' }]],
    dialogue: [
      ['tom', 'White spikes guard the supper station. Touching them costs a heart and stops you, even with a sword!'],
      ['koshi', 'Then I will redirect before landing on spikes. One second of damage protection is not a reason to linger.'],
      ['mouse', 'The rescue train leaves in 60 seconds. Stay alive until then, if you can!'],
      ['koshi', 'I will keep the train safe, and collect a few snacks for the passengers.'],
    ],
  },
  {
    id: '1-9', name: 'Meals on wheels', concept: 'robo wheels', duration: 110, goal: 35, killGoal: 7,
    enemies: [[12,'wheel',2],[25,'mouse',3],[43,'wheel',3,'red'],[62,'mouse',3],[82,'wheel',2,'red']],
    bricks: [[16,{ spikes: true }],[9,{ crumbler: 5 }]],
    dialogue: [
      ['tom', 'Robo Wheels, patrol the inside boundary! Stop Koshi from reaching the city kitchens.'],
      ['wheel', 'WE ROLL AROUND THE EDGES. INTERCEPT WITH A SWORD OR STEER CLEAR OF OUR ROUTE.'],
      ['koshi', 'Seven enemy points and 35 food points will free the kitchens. Your delivery route ends here; mine ends with fish and pretzels!'],
    ],
  },
  {
    id: '1-10', name: 'Pancake trampoline', concept: 'springs', duration: 110, goal: 40,
    weapons: [[28,'silver']],
    enemies: [[14,'mouse',3],[35,'wheel',3,'red'],[62,'mouse',3],[85,'wheel',2,'red']],
    bricks: [[4,{ springs: true }],[9,{ springs: true }],[16,{ spikes: true }]],
    dialogue: [
      ['tom', 'Spring platforms protect my pancake store. Land on one and it bounces you away automatically!'],
      ['wheel', 'BOUNCE TRAJECTORY ACTIVE. REDIRECT IN FLIGHT TO AVOID THE SPIKES.'],
      ['koshi', 'That is a shortcut, not a setback! I will bounce toward 40 food points and return pancakes to the hungry city.'],
    ],
  },
  {
    id: '1-11', name: 'Sushi assembly line', concept: 'conveyers', duration: 120, goal: 35, killGoal: 8,
    enemies: [[12,'mouse',3],[30,'wheel',3],[50,'mouse',3,'red'],[72,'wheel',3,'red'],[95,'mouse',2]],
    bricks: [[19,{ conveyor: true }],[10,{ conveyor: true, conveyorDirection: 'counterclockwise' }],[4,{ springs: true }]],
    dialogue: [
      ['tom', 'Conveyor belts carry supplies into my workshop. Land on the inner edge and the belt carries you along its arrows.'],
      ['wheel', 'THE BELT STOPS AT ITS END. YOU MAY STEER AWAY WHILE RIDING.'],
      ['koshi', 'A moving sushi buffet! I will use the belts and springs to recover 35 food points and earn 8 enemy points.'],
    ],
  },
  {
    id: '1-12', name: 'The folding pantry', concept: 'warped bricks', duration: 120, killGoal: 10,
    enemies: [[12,'mouse',4],[32,'wheel',3,'red'],[52,'mouse',3,'green'],[74,'mouse',3],[97,'wheel',2,'red']],
    bricks: [[4,{ warped: 12 }],[19,{ warped: 12, conveyor: true }],[16,{ springs: true }]],
    dialogue: [
      ['tom', 'Warped bricks absorb a neighboring brick each time you select them. My pantry walls will change beneath your plans!'],
      ['wheel', 'THE GROWING GROUP USES ITS OWNER\'S STYLE. IT RESTORES AFTER ITS WARP TIMER EXPIRES.'],
      ['koshi', 'I can grow a conveyor route, then redirect before it shrinks. Ten enemy points will unlock the pantry; save me some cheese!'],
    ],
  },
  {
    id: '1-13', name: 'Ram through the granary', concept: 'robo rams', duration: 120, goal: 40, killGoal: 9,
    enemies: [[12,'ram',2],[28,'mouse',4],[46,'wheel',3,'red'],[65,'ram',2,'green'],[83,'mouse',2,'green'],[100,'wheel',2]],
    bricks: [[4,{ warped: 12 }],[19,{ conveyor: true }],[16,{ springs: true }]],
    dialogue: [
      ['tom', 'Robo Rams, defend the granary! Aim those glowing eyes at the cat.'],
      ['ram', 'I wander, pause to aim, then charge straight ahead. My charge bounces off bricks and slows with each bounce!'],
      ['koshi', 'Move after the aim locks, then counter with a sword. Nine enemy points and 40 food points will save the grain, and tomorrow\'s pretzels!'],
    ],
  },
  {
    id: '1-14', name: 'Fast-food rescue', concept: 'boost', duration: 140, killGoal: 12,
    weapons: [],
    enemies: [[12,'ram',2],[28,'mouse',4],[45,'wheel',3,'red'],[62,'mouse',3,'green'],[80,'ram',3,'green'],[98,'wheel',2]],
    bricks: [[4,{ boost: true }],[9,{ boost: true }],[19,{ conveyor: true }],[16,{ springs: true }]],
    dialogue: [
      ['tom', 'Boost bricks store launch power. Surely you will overshoot the burger depot!'],
      ['ram', 'Launch while resting on a Boost brick and you travel at double speed, defeating robots on contact without using a sword.'],
      ['koshi', 'No swords here: I must use Boost bricks! Shielded robots still need spaced hits. Redirecting ends my boost. Twelve enemy points, then burgers for everyone!'],
    ],
  },
  {
    id: '1-15', name: 'Snack dispensary', concept: 'spawners', duration: 120, goal: 45, killGoal: 10,
    enemies: [[12,'mouse',4],[30,'wheel',3,'red'],[50,'ram',2,'green'],[70,'mouse',3,'green'],[92,'wheel',2]],
    bricks: [[4,{ spawner: { kind: 'food', type: 'H', lifetime: 25 } }],[9,{ spawner: { kind: 'food', type: 'H', lifetime: 25 } }],[16,{ spawner: { kind: 'weapon', type: 'silver' } }],[19,{ boost: true }]],
    dialogue: [
      ['tom', 'These Spawning bricks hide supplies. Touch one to release its item at a random spot, only once per attempt!'],
      ['ram', 'The symbol shows what is inside: food, swords, hearts, or even robots. Watch where the item appears.'],
      ['koshi', 'These hold burgers and a silver sword! I will visit each dispenser and recover 45 food points plus 10 enemy points for the relief kitchens.'],
    ],
  },
  {
    id: '1-16', name: 'Buckets at the bakery', concept: 'robo buckets', duration: 75, survive: true,
    enemies: [[12,'bucket',1],[27,'mouse',3],[43,'wheel',2,'green'],[56,'ram',1,'red'],[65,'bucket',2,'green']],
    bricks: [[4,{ boost: true }],[9,{ springs: true }],[16,{ spawner: { kind: 'weapon', type: 'silver' } }]],
    dialogue: [
      ['tom', 'Robo Buckets, bombard the bakery! Keep the rescue ovens cold.'],
      ['bucket', 'I wander slowly and throw bouncing bombs. Blue turns red over a three-second fuse; the blast hurts, the flying bomb does not!'],
      ['koshi', 'I will leave room for the explosion and protect the bakers for 75 seconds. Fresh bread belongs to the world, not your army!'],
    ],
  },
  {
    id: '1-17', name: 'Cinder soup factory', concept: 'cinder', duration: 130, goal: 45, killGoal: 12,
    weapons: [[24,'silver'],[48,'silver'],[65,'silver'],[82,'silver'],[105,'silver']],
    enemies: [[12,'bucket',2],[28,'mouse',4,'red'],[45,'wheel',3,'green'],[63,'ram',2],[80,'mouse',3,'green'],[98,'bucket',2,'green'],[115,'wheel',3]],
    bricks: [[4,{ kind: 'cinder' }],[9,{ kind: 'cinder' }],[16,{ boost: true }],[19,{ springs: true }]],
    dialogue: [
      ['tom', 'Cinder bricks darken the soup factory walls. You cannot select them to steer, and they never recharge.'],
      ['bucket', 'They still stop you! Choose a colored brick to leave, and do not wait there for a button to wake up.'],
      ['koshi', 'I will use boosts and springs around the dead routes. Forty-five food points and 12 enemy points will return hot meals to the world.'],
    ],
  },
  {
    id: '1-18', name: 'Switchboard supper', concept: 'toggles', duration: 130, killGoal: 14,
    enemies: [[12,'mouse',4],[28,'wheel',3,'green'],[44,'ram',3,'green'],[61,'bucket',2],[78,'mouse',3,'blue'],[96,'wheel',3,'red'],[114,'mouse',4]],
    bricks: [[4,{ toggle: 2 }],[9,{ toggle: 2 }],[16,{ boost: true }],[19,{ conveyor: true }]],
    dialogue: [
      ['tom', 'Toggle bricks start disabled. Every successful selection of another ready brick counts down their switch!'],
      ['bucket', 'At zero, they become usable. The next successful selection disables them and starts their count again. These switches need two clicks!'],
      ['koshi', 'I will time my routes around the switches, earn 14 enemy points, and shut down your world-hunger machine. Supper is almost served!'],
    ],
  },
  {
    id: '1-19', name: 'A feast for the world', concept: 'portals', duration: 140, goal: 50, killGoal: 15,
    enemies: [[12,'mouse',7],[28,'wheel',5,'red'],[44,'ram',4,'green'],[60,'bucket',3],[77,'mouse',3,'blue'],[93,'wheel',3,'green'],[108,'mouse',3,'red'],[123,'bucket',3]],
    bricks: [[4,{ portal: 'purple' }],[3,{ portal: 'purple' }],[16,{ boost: true }],[19,{ toggle: 2 }]],
    dialogue: [
      ['tom', 'My last defense: paired Portals! Touch one and you appear at the matching color on the other side.'],
      ['bucket', 'Koshi emerges moving straight into the arena at his current speed. Portal trips do not count as selections or spend brick uses.'],
      ['koshi', 'Purple to purple or orange to orange, then steer onward! Fifty food points and 15 enemy points will break your final blockade.'],
      ['tom', 'My robots cannot hold every kitchen against a cat who refuses to give up...'],
      ['koshi', 'Then this is our route to victory. Strawberries, pretzels, bananas, cheese, chicken, fish, burgers: a feast for the whole world, not just me!'],
    ],
  },
  {
    id: '1-20', name: 'Bouncing breakfast', concept: 'robo ball', duration: 90, killGoal: 4,
    enemies: [[8,'ball',3],[26,'ball',3,'red'],[48,'ball',4]], weapons: [[22,'silver'],[52,'silver']],
    bricks: [[2,{ crumbler: 4 }],[12,{ crumbler: 4 }],[19,{ springs: true }]],
    dialogue: [
      ['tom', 'The feast was only the beginning! My Robo Balls guard the breakfast reserves deeper in the pantry.'],
      ['ball', 'I bounce in straight lines at 120 units per second, off walls and robots. No pauses: touching me costs a heart!'],
      ['koshi', 'I will intercept with a sword and earn 4 enemy points. A robot basketball is not a breakfast snack!'],
    ],
  },
  {
    id: '1-21', name: 'Cookie calling', concept: 'smiley cookie', duration: 75, goal: 35,
    enemies: [[6,'mouse',3],[26,'wheel',2],[48,'mouse',3,'red']], weapons: [[20,'bronze'],[44,'silver']],
    bricks: [[2,{ conveyor: true }],[12,{ slimed: true, slimeColor: 'green' }]],
    items: [[12,'smiley-cookie'],[36,'smiley-cookie'],[57,'smiley-cookie']],
    dialogue: [
      ['tom', 'My mice and wheels patrol the scattered food reserves. Ride the conveyor, but beware the sticky slime!'],
      ['koshi', 'A Smiley Cookie draws all food currently on the board toward me! I can keep moving while I eat, until that batch is gone.'],
      ['tom', 'It does not collect future food. Wait for a tasty batch before taking the cookie!'],
      ['koshi', 'Three cookies, plenty of snacks: I will recover 35 food points for the breakfast club.'],
    ],
  },
  {
    id: '1-22', name: 'Lunch against the clock', concept: 'stopwatches', duration: 18, goal: 35, killGoal: 3,
    food: [[2,'L3','B',18],[5,'L3','C',25],[8,'C3','L',30],[11,'L3','F',35],[14,'C3','H',40]],
    enemies: [[2,'mouse',4],[6,'mouse',3,'red'],[12,'mouse',3]], weapons: [[12,'silver'],[16,'silver']],
    bricks: [[2,{ crumbler: 4 }],[12,{ springs: true }]],
    events: [
      { time: 0, kind: 'item', type: 'stopwatch', x: .5, y: .5 },
      { time: 6, kind: 'item', type: 'stopwatch-green', x: .3, y: .5 },
      { time: 12, kind: 'item', type: 'stopwatch-blue', x: .7, y: .5 },
    ],
    dialogue: [
      ['tom', 'Only 18 seconds to rescue lunch and defeat my mice! Your timer is almost empty already.'],
      ['koshi', 'Stopwatches add time: red gives 10 seconds, green 30, blue 60. Their bonuses stack! The red one starts right beside me.'],
      ['mouse', 'The clock keeps counting down. Collect the other stopwatches before it runs out!'],
      ['koshi', 'With extra time I can gather 35 food points and earn 3 enemy points. Lunch will not be late!'],
    ],
  },
  {
    id: '1-23', name: 'Recharge the cutlery', concept: 'battery', duration: 120, killGoal: 12,
    enemies: [[0,'mouse',6],[30,'mouse',6,'red'],[55,'mouse',6],[80,'mouse',6,'red']], weapons: [],
    bricks: [[2,{ spawner: { kind: 'weapon', type: 'silver' } }],[12,{ slimed: true, slimeColor: 'green' }]],
    items: [[3,'battery'],[25,'battery'],[50,'battery']],
    dialogue: [
      ['tom', 'My mice are already on guard! Reach the silver-sword dispenser past the slime. Its first sword has only 5 attacks, but you need 12 enemy points!'],
      ['koshi', 'Batteries recharge a spent spawner when I touch it again. Each new visit spends one battery and immediately releases another sword.'],
      ['mouse', 'Staying on the dispenser does not recharge it again. Leave, collect the sword, then return with a battery!'],
      ['koshi', 'No loose swords or Boost shortcuts here. I must reuse that dispenser for more weapons and rescue our cutlery!'],
    ],
  },
  {
    id: '1-24', name: 'Pantry lullaby', concept: 'music box', duration: 90, goal: 30, killGoal: 4,
    enemies: [[8,'mouse',4],[24,'bucket',2],[44,'mouse',4,'red'],[64,'bucket',2]], weapons: [[22,'silver'],[50,'silver']],
    bricks: [[2,{ slimed: true, slimeColor: 'green' }],[12,{ conveyor: true }]],
    items: [[12,'music-box'],[32,'music-box'],[56,'music-box']],
    dialogue: [
      ['tom', 'My mice and bomb-throwing bucket will keep you away from the supper shelves!'],
      ['bucket', 'That Music Box puts robots to sleep for 5 seconds. Our movement and attacks pause while its notes play!'],
      ['koshi', 'I can use the quiet moment to collect food or strike with a sword. The music does not last forever, so I will plan my route first.'],
      ['tom', 'Recover 30 food points and earn 4 enemy points if you can stay awake through my pantry lullaby!'],
    ],
  },
  {
    id: '1-25', name: 'Eggplant mix-up', concept: 'eggplant', duration: 80, goal: 35,
    enemies: [[6,'mouse',3],[28,'wheel',3],[50,'mouse',3,'red']], weapons: [[20,'bronze'],[46,'silver']],
    bricks: [[2,{ spikes: true }],[12,{ warped: 10 }]],
    items: [[10,'eggplant'],[30,'eggplant'],[50,'eggplant']],
    dialogue: [
      ['tom', 'My mice and wheels guard Warped walls and spikes. I have mixed purple Eggplants into the food supply: each removes 10 food points!'],
      ['koshi', 'My food score cannot fall below zero, but losing a meal still delays the rescue. I will redirect around those purple traps.'],
      ['tom', 'You must finish with 35 food points, not merely collect that much before the Eggplants subtract it.'],
      ['koshi', 'There is enough good food even after a mistake. This time I will leave the Eggplants for you!'],
    ],
  },
  {
    id: '1-26', name: 'Saw through the blockade', concept: 'saw blade', duration: 110, killGoal: 6,
    enemies: [[8,'mouse',5],[32,'mouse',5,'red'],[60,'mouse',5]], weapons: [],
    bricks: [[2,{ boost: true }],[12,{ boost: true }],[19,{ boost: true }],[16,{ crumbler: 4 }]],
    items: [[5,'saw-blade'],[40,'saw-blade']],
    dialogue: [
      ['tom', 'Saw Blades can destroy your routes! Carry one into a brick and the whole brick turns into unclickable Cinder, including a larger group.'],
      ['koshi', 'Each saw works once. Goals are immune, but an ordinary or Boost brick is not. I must not cut away every useful launch point!'],
      ['mouse', 'There are no swords or weapon spawners. Only launches from the remaining Boost bricks can defeat us!'],
      ['koshi', 'I will spend the saw on a plain brick, preserve my Boost routes, and earn 6 enemy points to reopen the food road.'],
    ],
  },
  {
    id: '1-27', name: 'Snake at the snack rack', concept: 'robo snake', duration: 100, killGoal: 3,
    enemies: [[8,'snake',2],[32,'snake',2],[58,'snake',2,'red'],[78,'snake',1]],
    weapons: [[22,'silver'],[52,'silver']],
    bricks: [[2,{ springs: true }],[12,{ crumbler: 4 }]],
    dialogue: [
      ['tom', 'Robo Snakes, coil around the snack rack! Your four segments should block every hungry cat.'],
      ['snake', 'I follow the inner perimeter at 95 units per second. Only my head accepts sword or Boost hits!'],
      ['koshi', 'The three spiked body segments still hurt even during sleep or fear. I will intercept the head with a sword, not chase the tail.'],
      ['tom', 'Earn 3 enemy points to free the snack rack. My snakes will not make that easy!'],
    ],
  },
  {
    id: '1-28', name: 'A brighter buffet', concept: 'magical sunglasses', duration: 85, goal: 40,
    enemies: [[6,'wheel',3],[28,'mouse',3],[50,'wheel',3,'red']], weapons: [[20,'bronze'],[48,'silver']],
    bricks: [[2,{ crumbler: 2 }],[12,{ toggle: 2 }],[19,{ crumbler: 2 }]],
    items: [[8,'magic-sunglasses'],[30,'magic-sunglasses'],[55,'magic-sunglasses']],
    dialogue: [
      ['tom', 'My mice and wheels patrol the buffet. Short-lived Crumblers and disabled Toggle routes will slow you down!'],
      ['koshi', 'Magical Sunglasses let me select recharging bricks, exhausted Crumblers, and disabled Toggles for 10 seconds!'],
      ['tom', 'They do not make Cinder or Goal bricks selectable, and they do not remove dangerous contact effects.'],
      ['koshi', 'Another pair refreshes the effect. I will use those bright routes to recover 40 food points before the glasses fade!'],
    ],
  },
  {
    id: '1-29', name: 'Three-course kickoff', concept: 'soccer goals and balls', duration: 110, goalsGoal: 3,
    food: [], enemies: [[6,'mouse',3],[30,'wheel',2],[56,'mouse',3,'red']], weapons: [[20,'bronze'],[48,'silver']],
    bricks: [[2,{ kind: 'goal' }],[4,{ kind: 'goal' }],[12,{ kind: 'goal' }],[14,{ kind: 'goal' }],
      [19,{ kind: 'goal' }],[21,{ kind: 'goal' }],[23,{ kind: 'goal' }],
      [16,{ springs: true }],[18,{ conveyor: true }],[0,{}],[8,{}],[17,{}]],
    events: [0,18,36,54,72].map(time => ({ time, kind: 'object', type: 'soccer-ball', x: .5, y: .4 })),
    dialogue: [
      ['tom', 'My mice and wheels patrol the picnic grounds! Dodge them and score 3 goals before time runs out. Food and enemy points are not required.'],
      ['koshi', 'I kick a Soccer Ball by bumping it while moving. Off-center bumps change its direction; friction slows it until it stops.'],
      ['tom', 'The net faces the arena. Balls must enter between the posts; wide shots bounce. Goal bricks cannot be selected!'],
      ['koshi', 'Three wide goals, a Spring bounce and a conveyor route! I will aim through each ball and redirect before landing. Five balls give me two spare shots for our three-course picnic!'],
    ],
  },
  {
    id: '1-30', name: 'Stamp a snack shortcut', concept: 'ditto stamp', duration: 90, goal: 35,
    enemies: [[6,'mouse',3],[28,'ball',3],[52,'mouse',3,'red']], weapons: [[20,'bronze'],[48,'silver']],
    bricks: [[2,{ boost: true }],[12,{ conveyor: true }]],
    items: [[5,'ditto-stamp'],[35,'ditto-stamp']],
    dialogue: [
      ['tom', 'My mice and balls guard the snack delivery. One Boost route and a conveyor? You will never cover the whole pantry!'],
      ['koshi', 'A Ditto Stamp captures the properties of the first brick I stop on, then copies them onto my next landing brick. Its size stays the same!'],
      ['tom', 'Portals cannot supply or receive copies, Goals are immune, and Spring bounces cannot capture a source because you do not stop.'],
      ['koshi', 'I will land on the Boost brick first, then stamp a plain brick into another fast route. Recover 35 food points with my new shortcut!'],
    ],
  },
  {
    id: '1-31', name: 'Scare up some supper', concept: 'spooky mask', duration: 90, goal: 30, killGoal: 4,
    enemies: [[8,'mouse',4],[28,'ram',4],[50,'mouse',5,'red']],
    weapons: [[22,'silver'],[50,'silver']],
    bricks: [[2,{ spikes: true }],[12,{ springs: true }]],
    items: [[12,'spooky-mask'],[32,'spooky-mask'],[56,'spooky-mask']],
    dialogue: [
      ['tom', 'My mice and rams will stand firm between you and supper!'],
      ['ram', 'That Spooky Mask makes us flee slowly for 10 seconds. We cannot attack or hurt him while afraid!'],
      ['koshi', 'New arrivals are scared too, and another mask refreshes the effect. I can collect food or fight, but I must be ready when fear ends.'],
      ['tom', 'Thirty food points and 4 enemy points will free supper. Stop making frightening faces at my robots!'],
    ],
  },
  {
    id: '1-32', name: 'Fence the food depot', concept: 'barrier blocks', duration: 100, goal: 35, killGoal: 4,
    enemies: [[8,'bucket',3],[32,'ball',4,'red'],[58,'bucket',3]],
    weapons: [[22,'silver'],[52,'silver']],
    bricks: [[2,{ barrier: true }],[12,{ barrier: true }],[19,{ barrier: true }],
      [16,{ crumbler: 4 }],[18,{ springs: true }],[0,{}],[8,{}],[17,{}]],
    dialogue: [
      ['tom', 'Robo Balls and Buckets, guard the food depot! Bounce and bombard your way past Koshi.'],
      ['bucket', 'Selecting a Barrier brick grows a fence straight into the arena until it reaches a wall or another fence. Robots and flying bombs bounce off it!'],
      ['koshi', 'I pass through freely. Selecting its brick again after cooldown retracts the fence, so I can change the protected routes.'],
      ['tom', 'Use your fences to recover 35 food points and earn 4 enemy points. That depot is still mine!'],
    ],
  },
  {
    id: '1-33', name: 'Pumpkin pantry patrol', concept: 'robo jackolantern', duration: 100, killGoal: 4,
    enemies: [[8,'jackolantern',2],[30,'jackolantern',2],[52,'jackolantern',2,'red'],[74,'jackolantern',2]],
    weapons: [[22,'silver'],[52,'silver']],
    bricks: [[2,{ barrier: true }],[12,{ barrier: true }],[19,{ barrier: true }],[16,{ toggle: 2 }]],
    dialogue: [
      ['tom', 'Robo Jackolanterns, light up the pumpkin pantry! Let no cat approach the food reserves.'],
      ['jackolantern', 'I wander slowly, warn for half a second, then stomp every 4 seconds. A square ring of fire grows outward from each stomp!'],
      ['koshi', 'Bricks and Barrier fences stop the fire, but other robots do not. Defeating the pumpkin extinguishes its waves. I will set fences and strike with a sword.'],
      ['tom', 'Earn 4 enemy points to clear the pumpkin pantry. Watch for that warning before you cross the fire!'],
    ],
  },
  {
    id: '1-34', name: 'The final countdown feast', concept: 'boom helmet and boom times', duration: 100, goal: 35,
    activationLimit: 6, enemies: [[6,'mouse',3],[28,'wheel',3],[52,'mouse',4,'red']],
    weapons: [[20,'bronze'],[48,'silver']],
    bricks: [[2,{ warped: 10 }],[12,{ conveyor: true }]],
    events: [
      { time: 0, kind: 'item', type: 'boom-time-blue', x: .5, y: .5 },
      { time: 12, kind: 'item', type: 'boom-time-green', x: .3, y: .5 },
      { time: 24, kind: 'item', type: 'boom-time-red', x: .7, y: .5 },
      { time: 42, kind: 'item', type: 'boom-time-blue', x: .5, y: .3 },
    ],
    dialogue: [
      ['tom', 'My mice and wheels guard Warped conveyors! A Boom Helmet begins with 6 charges when you press Start. Every successful brick selection spends one, even a midair redirect!'],
      ['koshi', 'At zero it explodes immediately. Hearts cannot save me, so I must collect Boom Times before I spend my last charge!'],
      ['tom', 'Red adds 1 charge, green 3, blue 8. Those bomb clocks do not add level time. Failed clicks and physical brick contacts cost no charges.'],
      ['koshi', 'The first blue clock is beside me. I will plan each route, collect more charges, and recover 35 food points for the world\'s final countdown feast!'],
    ],
  },
].map((entry, index) => {
  const food = entry.food ?? Object.keys(FOODS).map((type, i) => [
    3 + Math.floor(i * (entry.duration - 12) / 6),
    ['L3', 'L3', 'C3', 'L3', 'C3', 'R3', 'S'][i], type, Math.min(25, entry.duration - (3 + Math.floor(i * (entry.duration - 12) / 6))),
  ]);
  const introduced = {
    crumblers: 'crumbler', slime: 'slimed', spikes: 'spikes', springs: 'springs',
    conveyers: 'conveyor', 'warped bricks': 'warped', boost: 'boost',
    spawners: 'spawner', cinder: 'kind', toggles: 'toggle', portals: 'portal',
  }[entry.concept];
  let placements = entry.bricks;
  if (introduced) {
    const newTypes = entry.bricks.filter(([, attributes]) => attributes[introduced]);
    const returning = entry.bricks.filter(([, attributes]) => !attributes[introduced]);
    // Three interior groups showcase the new feature; the fourth stays ordinary.
    placements = [2, 12, 19].map((id, i) => [id, { ...newTypes[i % newTypes.length][1] }]);
    const returningIds = [16, 18, 20, 22];
    if (introduced === 'portal') {
      placements = [[2, { portal: 'purple' }], [19, { portal: 'purple' }],
        [12, { portal: 'orange' }], [16, { portal: 'orange' }]];
      returningIds.shift();
      placements.push([returningIds[0], Object.assign({}, ...returning.map(([, attributes]) => attributes))]);
    } else {
      placements.push(...returning.map(([, attributes], i) => [returningIds[i], attributes]));
    }
  }
  const members = index >= 19 ? [[2,4],[12,14], index % 2 ? [19,21] : [19,21,23]]
    : introduced ? [[2,4],[12,14],[17,19,21],[3,5]]
    : index % 2 ? [[4,6],[3,1],[20,22],[11,13,15]] : [[0,2],[7,5],[12,14],[19,21,23]];
  const brickGroups = members.map(members => ({
    owner: introduced && members[0] === 17 ? 19 : index === 0 && members[0] === 0 ? 2 : members[0], members,
  }));
  if (introduced === 'kind') {
    for (const group of brickGroups.slice(0, 3)) {
      placements.push(...group.members.filter(id => id !== group.owner).map(id => [id, { kind: 'cinder' }]));
    }
  }
  const brickTypes = placements.map(([id, attributes]) => campaignBrick(id, attributes));
  const foodPoints = food.reduce((sum, [, method, type]) => sum + (method === 'S' ? 1 : Number(method.slice(1))) * FOODS[type].value, 0)
    + brickTypes.reduce((sum, brick) => sum + (brick.spawner?.kind === 'food' ? FOODS[brick.spawner.type].value : 0), 0);
  const cast = [...new Set([
    ...entry.dialogue.map(([speaker]) => speaker).filter(speaker => !['koshi', 'tom'].includes(speaker)),
    ...entry.enemies.map(([, type]) => type),
  ])].slice(0, 2);
  const shieldedObjective = entry.killGoal > 0 && entry.enemies.some(([, , , shield]) => shield);
  const unfinishedShieldHits = Math.max(0, ...entry.enemies.map(([, , , shield]) => (SHIELDS[shield]?.hits ?? 1) - 1));
  // Leave 50% spare attacks (at least one sword), plus damage sunk into an unfinished shield.
  const attackBudget = (entry.killGoal ?? 0) + Math.max(5, Math.ceil((entry.killGoal ?? 0) / 2)) + unfinishedShieldHits;
  const swordCount = Math.ceil(attackBudget / SWORDS.silver.uses);
  const bufferedWeapons = shieldedObjective ? Array.from({ length: swordCount }, (_, i) => [
    Math.round(entry.enemies[0][0] + 12 + i * (entry.duration - 25 - entry.enemies[0][0] - 12) / (swordCount - 1)), 'silver',
  ]) : null;
  const weapons = entry.weapons ?? bufferedWeapons ?? (entry.survive || !entry.killGoal
    ? [[entry.enemies[0][0] + 14, 'bronze']]
    : [[entry.enemies[0][0] + 12, 'silver'], [Math.floor(entry.duration * .6), 'silver'],
      ...(entry.killGoal > 10 ? [[entry.duration - 22, 'silver']] : [])]);
  if (index >= 10 && index < 19 && entry.killGoal > 0 && !brickTypes.some(brick => brick.boost)) {
    weapons.push([Math.floor(entry.duration / 3), 'bronze'], [Math.floor(entry.duration * 2 / 3), 'bronze']);
    weapons.sort((a, b) => a[0] - b[0]);
  }
  const catBlockCarrier = [2, 5, 8].includes(index);
  return {
    id: entry.id,
    name: entry.name, concept: entry.concept, duration: entry.duration,
    goal: entry.goal ?? 0, killGoal: entry.killGoal ?? 0, survive: entry.survive ?? false,
    heartCost: index < 3 || foodPoints === 0 ? Infinity : Math.ceil(foodPoints / 5),
    brickSet: index === 0 ? 1 : 3, brickTypes, brickGroups, food, enemies: entry.enemies, items: entry.items ?? [],
    ...(index < 10 ? {
      items: catBlockCarrier || entry.catBlock ? entry.items ?? []
        : [...(entry.items ?? []), [Math.floor(entry.duration / 2), 'cat-block']].sort((a, b) => a[0] - b[0]),
      ...(catBlockCarrier ? {
        enemies: entry.enemies.map((event, wave) => wave === 0
          ? [event[0], event[1], event[2], event[3], { carriesCatBlock: true }] : event),
      } : {}),
      catBlock: entry.catBlock ?? { description: catBlockCarrier
        ? 'An enemy in the first patrol carries the Cat Block. Defeat the marked enemy, then collect the block it drops.'
        : 'A Cat Block appears at a random location halfway through the level. Collect it to keep it.' },
    } : {}),
    weapons,
    ...(entry.events ? { events: entry.events } : {}),
    ...(entry.goalsGoal ? { goalsGoal: entry.goalsGoal } : {}),
    ...(entry.activationLimit ? { activationLimit: entry.activationLimit } : {}),
    cutscene: story(index < 10 ? 'garden' : 'workshop', entry.dialogue, cast),
  };
});

// World 3 (Robot Foundry) uses its own builder so the generated World 1-2 layouts stay unchanged.
const FOUNDRY_KINDS = { 0: 'slow', 8: 'slow', 17: 'slow', 4: 'fast', 13: 'fast', 21: 'fast' };
// Each layout has 21 starting blocks: three doubles (14%) and one triple (5%).
const FOUNDRY_LAYOUTS = {
  x: [[2, 4], [12, 14], [19, 21], [16, 18, 20]],
  y: [[3, 5], [13, 15], [18, 20], [2, 4, 6]],
  z: [[5, 7], [20, 22], [2, 4], [13, 15, 17]],
};
const FOUNDRY_FOOD_ORDER = ['S', 'P', 'B', 'C', 'L', 'F', 'H'];
// Fixed food spots stay clear of the quadrant objects and Koshi's starting point in every orientation.
const FOUNDRY_FOOD_SPOTS = [
  [[.35, .5], [.5, .35], [.65, .5]], [[.5, .2], [.15, .5], [.85, .5]], [[.5, .65], [.35, .5], [.5, .8]],
  [[.5, .35], [.85, .5], [.5, .8]], [[.15, .5], [.5, .2], [.65, .5]], [[.5, .65], [.5, .2], [.35, .5]],
];
const foundryTime = (duration, i) => 3 + Math.floor(i * (duration - 12) / 6);
const randomFood = duration => FOUNDRY_FOOD_ORDER.map((type, i) => [foundryTime(duration, i),
  ['L3', 'L3', 'C3', 'L3', 'C3', 'R3', 'S'][i], type, Math.min(25, duration - foundryTime(duration, i))]);
const placedFood = duration => FOUNDRY_FOOD_ORDER.flatMap((type, i) => {
  const time = foundryTime(duration, i);
  return (type === 'H' ? [[.5, .65]] : FOUNDRY_FOOD_SPOTS[i % FOUNDRY_FOOD_SPOTS.length]).map(([x, y]) =>
    ({ time, kind: 'food', type, x, y, lifetime: Math.min(25, duration - time) }));
});
const placed = (kind, entries) => entries.map(([time, type, x, y, extra]) => ({ time, kind, type, x, y, ...extra }));
const QUADRANTS = [[.22, .25], [.78, .25], [.22, .75], [.78, .75]];
const FOUNDRY_LEVEL_DATA = [
  {
    id: '1-35', name: 'Tom\'s foundry kickoff', concept: 'robo goalies', duration: 150, goalsGoal: 5, layout: 'x',
    enemies: [[1,'goalie',2],[20,'mouse',3],[40,'goalie',1],[60,'mouse',3],[80,'goalie',1,'red'],[100,'wheel',2]],
    weapons: [[16,'bronze'],[50,'silver'],[95,'bronze']],
    bricks: [[2,{ kind: 'goal' }],[12,{ kind: 'goal' }],[19,{ kind: 'goal' }],[16,{ springs: true }],[5,{ crumbler: 4 }]],
    items: [[30,'music-box'],[90,'music-box']],
    events: placed('object', [[6,'soccer-ball',.35,.35],[22,'soccer-ball',.65,.65],[38,'soccer-ball',.65,.35],
      [54,'soccer-ball',.35,.65],[70,'soccer-ball',.5,.25],[86,'soccer-ball',.5,.75],[102,'soccer-ball',.3,.5],[118,'soccer-ball',.7,.5]]),
    dialogue: [
      ['tom', 'Quack quack! Surprised, Koshi? I am Tom the Duck, master of the Robot Foundry. Every robot you have battled was built here, and soon my machines will rule the whole world!'],
      ['koshi', 'So you are behind it all! Your robots keep stealing the world\'s food. I will shut down your factory, save the world, and taste every snack you have hidden away.'],
      ['goalie', 'Robo Goalies guard the Goal bricks. We slide across each goal mouth to block soccer balls. We cannot hurt you, but we never stop defending!'],
      ['koshi', 'A sword can clear a goalie away, and a Music Box puts robots to sleep. I will score 5 goals before time runs out, then celebrate with a burger!'],
    ],
  },
  {
    id: '1-36', name: 'Painting the pancake path', concept: 'paint brushes', duration: 100, goal: 40, layout: 'y',
    enemies: [[6,'mouse',3],[26,'wheel',2],[48,'ram',2],[70,'mouse',1,'red']],
    weapons: [[20,'bronze'],[60,'bronze']],
    bricks: [[18,{ conveyor: true }],[23,{ crumbler: 3 }]],
    items: [[5,'paint-wide-blue'],[18,'paint-pencil-blue'],[32,'paint-roller-blue'],[40,'stopwatch'],
      [50,'paint-wide-red'],[64,'paint-pencil-red'],[80,'paint-roller-red']],
    dialogue: [
      ['tom', 'My Foundry painted these bricks for my robots! Robo Mice and Wheels, keep that hungry cat away from my pancake stash.'],
      ['koshi', 'I found Paintbrushes! The next bricks I touch change color: blue paint makes a brick Slow with a 15 second cooldown, and red paint makes it Fast at 3 seconds.'],
      ['tom', 'A thin brush paints 1 brick, a wide brush 3 and a roller 5. My workers are only delivering blue paint right now. Enjoy waiting, kitty!'],
      ['koshi', 'Then I will save blue for bricks I rarely need and grab the red brushes when they arrive later. Fast routes mean 40 food points of pancakes for me!'],
    ],
  },
  {
    id: '1-37', name: 'Caped cat cafe', concept: 'kitty cape', duration: 80, survive: true, layout: 'z',
    enemies: [[4,'mouse',4],[14,'wheel',3],[26,'ball',2],[36,'ram',2],[48,'mouse',3],[58,'snake',1],[62,'ball',1,'red']],
    weapons: [[18,'bronze'],[50,'silver']],
    bricks: [[20,{ springs: true }],[5,{ warped: 10 }]],
    items: [[8,'kitty-cape'],[22,'spooky-mask'],[30,'kitty-cape'],[40,'paint-roller-red'],[52,'kitty-cape'],[70,'kitty-cape']],
    dialogue: [
      ['tom', 'No more snacking! My robots will swarm this cafe until your ninth life runs out. Mice, wheels, balls and rams, attack!'],
      ['koshi', 'That is a lot of robots... but look, a Kitty Cape! Wearing it doubles my speed for 10 seconds, even while I am already flying across the arena.'],
      ['tom', 'Speed will not save you forever. Another cape only refreshes the 10 seconds. It never stacks!'],
      ['koshi', 'Then I will dash from cape to cape and dodge until the clock hits zero. Survive 80 seconds, then the cafe\'s cakes are all mine!'],
    ],
  },
  {
    id: '1-38', name: 'Laser light lunch', concept: 'laser turret', duration: 120, killGoal: 15, layout: 'x',
    enemies: [[4,'mouse',4],[12,'wheel',3],[24,'ram',3],[36,'ball',3],[50,'mouse',4],[62,'bucket',2],
      [74,'snake',2],[86,'mouse',3],[98,'ball',1,'red'],[104,'ram',1]],
    weapons: [[30,'bronze'],[80,'bronze']],
    bricks: [[2,{ turret: 'laser' }],[5,{ turret: 'laser' }],[22,{ turret: 'laser' }],[16,{ toggle: 2 }],
      [19,{ slimed: true, slimeColor: 'green' }]],
    items: [[20,'battery'],[45,'battery'],[55,'music-box'],[70,'battery'],[95,'battery']],
    dialogue: [
      ['tom', 'My assembly line never stops! Twenty-six robots will pour into the lunch hall. You cannot sword them all, Koshi.'],
      ['koshi', 'I do not need to. A blue Laser Turret brick puts me inside a protective dome. I click to aim, and the beam hits every robot along its line!'],
      ['tom', 'Each turret gives only 3 shots or 10 seconds, and it works once. Without a Battery, it stays empty!'],
      ['koshi', 'Batteries are rolling off your conveyor belts too. I will recharge the turrets, blast 15 enemy points of robots, then raid the lunch counter.'],
    ],
  },
  {
    id: '1-39', name: 'Blocked buffet', concept: 'obstructions', duration: 100, goal: 35, killGoal: 4, layout: 'y',
    enemies: [[6,'mouse',3],[20,'wheel',2],[40,'ball',2],[60,'mouse',2],[75,'ram',1,'red']],
    bricks: [[3,{ portal: 'purple' }],[18,{ portal: 'purple' }],[23,{ spikes: true }]],
    events: [
      ...placed('object', QUADRANTS.map(([x, y], i) => [0, i % 3 ? 'obstruction-diamond' : 'obstruction-circle', x, y])),
      ...placedFood(100),
      ...placed('weapon', [[14,'bronze',.5,.2],[50,'silver',.5,.8]]),
      ...placed('item', [[30,'kitty-cape',.15,.5],[70,'kitty-cape',.85,.5]]),
    ],
    dialogue: [
      ['tom', 'I have bolted steel Obstructions to the buffet floor. Nothing can break them! Let my mice and wheels corner you.'],
      ['koshi', 'Obstructions block me and the robots alike. When I hit one I slide along its edge, so I must aim around them to reach the food.'],
      ['tom', 'My wheels turn back when they bump into them too. Collect 35 food points and earn 4 enemy points... if you can find a path!'],
      ['koshi', 'A Kitty Cape will help me zip around the corners. Strawberries, cheese and fish, here I come!'],
    ],
  },
  {
    id: '1-40', name: 'Snail-paced soup', concept: 'robo snail', duration: 100, goal: 35, killGoal: 3, layout: 'z',
    enemies: [[4,'robo-snail',1],[10,'mouse',3],[30,'wheel',2],[40,'robo-snail',1],[55,'mouse',3],[70,'robo-snail',1]],
    weapons: [[22,'bronze'],[60,'bronze']],
    bricks: [[5,{ crumbler: 3 }],[20,{ conveyor: true }],[23,{ slimed: true, slimeColor: 'red' }]],
    items: [[35,'magic-sunglasses'],[75,'magic-sunglasses']],
    dialogue: [
      ['tom', 'Meet my slowest invention, the Robo Snail! Let it crawl around my soup kitchen while my mice guard the pots.'],
      ['robo-snail', 'Touch me and I hurt you. Defeat me and every brick cooldown freezes for 20 seconds. Bricks you use during the freeze wait until it ends to recharge!'],
      ['koshi', 'So beating a snail slows me down. I will earn 3 enemy points from the mice instead, and Magical Sunglasses let me select bricks even while they recharge.'],
      ['tom', 'You still need 35 food points of soup. Take your time... my snails certainly will!'],
    ],
  },
  {
    id: '1-41', name: 'Pinball pantry', concept: 'bumpers', duration: 100, goal: 40, layout: 'x',
    enemies: [[6,'mouse',3],[24,'ball',2],[44,'wheel',2],[60,'bucket',1],[75,'mouse',2],[85,'ball',1,'red']],
    bricks: [[16,{ springs: true }],[7,{ barrier: true }],[22,{ barrier: true }]],
    events: [
      ...placed('object', [[0,'bumper-red',.3,.3],[0,'bumper-blue',.7,.3],[0,'bumper-green',.3,.7],[0,'bumper-red',.7,.7]]),
      ...placedFood(100),
      ...placed('weapon', [[18,'bronze',.5,.2],[55,'silver',.5,.8]]),
      ...placed('item', [[35,'smiley-cookie',.15,.5],[72,'smiley-cookie',.85,.5]]),
    ],
    dialogue: [
      ['tom', 'Welcome to my pinball pantry! Bumpers are bolted across the floor, and my mice and balls are ready to play.'],
      ['koshi', 'When I hit a Bumper I bounce away. Red bumpers launch me 25% faster, green ones keep my speed, and blue ones slow me to 75%.'],
      ['tom', 'Bounce around wildly and you will never reach 40 food points of treats!'],
      ['koshi', 'Or I can plan bank shots and bounce straight into dinner. A Smiley Cookie will pull every snack on the board right to me.'],
    ],
  },
  {
    id: '1-42', name: 'Bubble tea trouble', concept: 'bubbles', duration: 110, goal: 25, killGoal: 5, layout: 'y',
    enemies: [[6,'mouse',3],[20,'ram',2],[36,'ball',2],[52,'mouse',3],[68,'wheel',2],[84,'ram',1,'green']],
    bricks: [[7,{ warped: 10 }],[18,{ boost: true }]],
    events: [
      ...placed('object', [[0,'bumper-green',.15,.25],[0,'bumper-green',.85,.75],[0,'bubble-green',.3,.3],
        [15,'bubble-blue',.7,.7],[30,'bubble-red',.7,.3],[50,'bubble-green',.3,.7],[70,'bubble-blue',.3,.3],[90,'bubble-red',.7,.7]]),
      ...placedFood(110),
      ...placed('weapon', [[16,'bronze',.5,.2],[45,'silver',.5,.8],[75,'bronze',.85,.5]]),
      ...placed('item', [[40,'music-box',.5,.65]]),
    ],
    dialogue: [
      ['tom', 'Bubbles float through my bottling plant! Trap that cat while my mice and rams close in.'],
      ['koshi', 'Touching a Bubble pulls me to its center and holds me: blue for 5 seconds, green for 3 and red for 1. Robots can still reach me, but I can still swing my sword.'],
      ['tom', 'Each bubble pops after one catch, and my Bumpers will bounce you right into them!'],
      ['koshi', 'Then I will pop them when the coast is clear. 25 food points and 5 enemy points, then bubble tea for everyone!'],
    ],
  },
  {
    id: '1-43', name: 'Fireball fry-up', concept: 'fireball turret', duration: 120, killGoal: 14, layout: 'z',
    enemies: [[4,'mouse',4],[14,'bucket',2],[26,'ram',3],[40,'ball',3],[54,'mouse',4],[66,'jackolantern',1],
      [78,'wheel',3],[90,'mouse',3],[100,'ram',1,'red']],
    weapons: [[25,'bronze'],[70,'bronze']],
    bricks: [[5,{ turret: 'fireball' }],[12,{ turret: 'fireball' }],[23,{ turret: 'fireball' }],[20,{ crumbler: 3 }],[3,{ springs: true }]],
    items: [[40,'battery'],[60,'spooky-mask'],[80,'battery']],
    dialogue: [
      ['tom', 'My mice and Robo Buckets are lining up for the grand assembly! Twenty-four robots, and nowhere for you to hide.'],
      ['koshi', 'A red Fireball Turret works like the laser dome: 3 shots or 10 seconds. Each fireball explodes and damages every robot near the blast.'],
      ['tom', 'Each turret fires once per attempt. Only a Battery recharges it, and I built just 2 of them!'],
      ['koshi', 'Then I will wait for crowds before I fire. 14 enemy points, then a fish fry-up for dinner!'],
    ],
  },
  {
    id: '1-44', name: 'Demolition dinner', concept: 'destructible obstructions', duration: 110, goal: 30, killGoal: 4, layout: 'x',
    enemies: [[6,'mouse',3],[18,'wheel',2],[34,'ball',2],[50,'mouse',3],[66,'ram',1,'red'],[80,'bucket',1]],
    bricks: [[7,{ turret: 'fireball' }],[2,{ toggle: 2 }],[16,{ slimed: true, slimeColor: 'green' }]],
    events: [
      ...placed('object', QUADRANTS.map(([x, y], i) => [0, i % 3 ? 'obstruction-diamond' : 'obstruction-circle', x, y,
        { destructible: i % 2 === 0 }])),
      ...placedFood(110),
      ...placed('weapon', [[16,'bronze',.5,.2],[55,'silver',.5,.8]]),
      ...placed('item', [[30,'battery',.15,.5],[45,'paint-wide-red',.5,.65],[70,'battery',.85,.5]]),
    ],
    dialogue: [
      ['tom', 'I rebuilt my dining hall walls! My mice and wheels will trap you between them.'],
      ['koshi', 'Some of these Obstructions are destructible. They carry a TNT sign, and any fireball blast that touches one breaks the whole wall instantly!'],
      ['tom', 'Walls without a TNT sign stay put. You have only 1 Fireball Turret, kitty, and just 2 Batteries will roll out!'],
      ['koshi', 'Then every shot must hit walls and robots together. 30 food points and 4 enemy points, and a red Paintbrush will speed up my routes!'],
    ],
  },
  {
    id: '1-45', name: 'Surprise wall supper', concept: 'appearing obstructions', duration: 90, survive: true, layout: 'y',
    enemies: [[4,'mouse',3],[14,'wheel',2],[30,'robo-snail',1],[40,'ram',2],[48,'ram',1,'blue'],[55,'ball',2],[70,'mouse',3]],
    bricks: [[13,{ springs: true }],[7,{ conveyor: true }]],
    events: [
      ...placed('object', [[10,'obstruction-circle',...QUADRANTS[0]],[25,'obstruction-diamond',...QUADRANTS[3]],
        [40,'obstruction-circle',...QUADRANTS[1]],[55,'obstruction-diamond',...QUADRANTS[2]]]),
      ...placedFood(90),
      ...placed('weapon', [[14,'bronze',.5,.2],[48,'silver',.5,.8]]),
      ...placed('item', [[30,'music-box',.5,.65],[60,'spooky-mask',.5,.35]]),
    ],
    dialogue: [
      ['tom', 'My crane can drop new Obstructions anywhere it likes! Stand underneath one and you are flattened instantly, hearts or not.'],
      ['koshi', 'A twinkling preview warns me 2 seconds before each wall lands. I just have to move out of the marked space in time!'],
      ['tom', 'Robots and snacks caught underneath are crushed too. Survive 90 seconds of my mice and wheels, if you can!'],
      ['koshi', 'Eyes open, paws moving. When the timer hits zero, supper is served!'],
    ],
  },
  {
    id: '1-46', name: 'Stampede steakhouse', concept: 'robo cows', duration: 120, killGoal: 8, layout: 'x',
    enemies: [[4,'robo-cow',1],[10,'mouse',2],[20,'robo-cow',1],[30,'ball',2],[45,'robo-cow',1,'red'],[55,'mouse',2],
      [70,'robo-cow',1],[85,'ball',1]],
    weapons: [[40,'wood']],
    bricks: [[2,{ boost: true }],[7,{ boost: true }],[22,{ boost: true }],[12,{ barrier: true }],[23,{ barrier: true }]],
    items: [[35,'music-box'],[60,'kitty-cape']],
    dialogue: [
      ['tom', 'Robo Cows, graze on Koshi\'s bricks! Every brick you munch turns to useless cinder.'],
      ['robo-cow', 'Moo. I walk the edge of the board, stop, and eat the brick under my hooves. After 5 seconds it becomes Cinder. Barrier fences turn me around!'],
      ['koshi', 'Only 1 wood sword here, so my 3 Boost bricks are my best weapons. A Boost launch smashes robots... if the cows do not eat those bricks first.'],
      ['tom', 'Earn 8 enemy points with your little rockets. My cows are hungry, and so am I!'],
    ],
  },
  {
    id: '1-47', name: 'Unicorn dessert dash', concept: 'robo unicorns', duration: 120, goal: 45, layout: 'z',
    enemies: [[2,'robo-unicorn',1],[12,'mouse',2],[30,'robo-unicorn',1],[55,'mouse',3],[62,'robo-unicorn',1,'green'],[80,'ball',2]],
    food: [5, 15, 25, 35, 45, 55, 65, 75, 85, 95].map((time, i) =>
      [time, i % 2 ? 'C3' : 'L3', ['S', 'P', 'B', 'C', 'L', 'F', 'H', 'L', 'C', 'F'][i], 20]),
    weapons: [[14,'bronze'],[50,'silver']],
    bricks: [[20,{ spawner: { kind: 'food', type: 'H', lifetime: 25 } }],[5,{ springs: true }],[23,{ crumbler: 4 }]],
    items: [[15,'eggplant'],[40,'eggplant'],[50,'smiley-cookie'],[65,'eggplant'],[90,'eggplant']],
    dialogue: [
      ['tom', 'Behold my finest invention, the Robo Unicorn! It eats every snack it can see. Your dessert will vanish before you can taste it!'],
      ['robo-unicorn', 'I pause to aim at the nearest food, then charge and gobble it up. When no food is left, I turn red and race around even faster!'],
      ['koshi', 'Hey, those desserts are mine! I must grab food before the unicorns do, and dodge the Eggplants. Each one takes away 10 food points.'],
      ['tom', 'Collect 45 food points if you can. My unicorns are already drooling!'],
      ['koshi', 'A Smiley Cookie pulls every snack on the board straight to me. Dessert first, then I save the world!'],
    ],
  },
  {
    id: '1-48', name: 'Copycat showdown', concept: 'robo koshi', duration: 110, goal: 30, killGoal: 4, layout: 'y',
    enemies: [[3,'robo-koshi',1],[10,'mouse',3],[25,'wheel',2],[40,'robo-koshi',1],[55,'mouse',1,'red'],[70,'ram',2],[85,'robo-koshi',1]],
    weapons: [[16,'bronze'],[50,'silver'],[80,'bronze']],
    bricks: [[3,{ portal: 'orange' }],[18,{ portal: 'orange' }],[13,{ springs: true }]],
    items: [[20,'kitty-cape'],[45,'music-box'],[65,'kitty-cape']],
    dialogue: [
      ['tom', 'You wrecked my whole foundry, Koshi! So I built my ultimate robot... a perfect copy of YOU!'],
      ['robo-koshi', 'Beep. I am Robo Koshi. One second after I arrive, I race to where you stood and then follow your exact path, a few seconds behind you. Touch me and you get hurt!'],
      ['koshi', 'A copycat that chases my own trail? Then I must never double back. Portals and Springs will send me somewhere new, and a Kitty Cape will pull me far ahead.'],
      ['tom', 'Collect 30 food points and earn 4 enemy points while your shadow hunts you down. Quack!'],
      ['koshi', 'A sword works on copies too. Once this foundry falls, the whole world gets a feast, and I get first helpings!'],
    ],
  },
].map(entry => {
  const groups = FOUNDRY_LAYOUTS[entry.layout];
  const brickTypes = entry.bricks.flatMap(([id, attributes]) =>
    (attributes.kind === 'goal' ? groups.find(group => group[0] === id) ?? [id] : [id])
      .map(member => campaignBrick(member, { kind: FOUNDRY_KINDS[member] ?? 'normal', ...attributes })));
  const events = entry.events ?? [];
  const food = entry.food ?? (events.some(event => event.kind === 'food') ? [] : randomFood(entry.duration));
  const foodPoints = food.reduce((sum, [, method, type]) => sum + (method === 'S' ? 1 : Number(method.slice(1))) * FOODS[type].value, 0)
    + events.reduce((sum, event) => sum + (event.kind === 'food' ? FOODS[event.type].value : 0), 0)
    + brickTypes.reduce((sum, brick) => sum + (brick.spawner?.kind === 'food' ? FOODS[brick.spawner.type].value : 0), 0);
  const cast = [...new Set([
    ...entry.dialogue.map(([speaker]) => speaker).filter(speaker => !['koshi', 'tom'].includes(speaker)),
    ...entry.enemies.map(([, type]) => type),
  ])].slice(0, 2);
  return {
    id: entry.id,
    name: entry.name, concept: entry.concept, duration: entry.duration,
    goal: entry.goal ?? 0, killGoal: entry.killGoal ?? 0, survive: entry.survive ?? false,
    // At most five hearts even if every food point is collected.
    heartCost: Math.ceil(foodPoints / 5),
    brickSet: 3, brickTypes, brickGroups: groups.map(members => ({ owner: members[0], members })),
    food, enemies: entry.enemies, items: entry.items ?? [], weapons: entry.weapons ?? [],
    ...(events.length ? { events } : {}),
    ...(entry.goalsGoal ? { goalsGoal: entry.goalsGoal } : {}),
    cutscene: story('foundry', entry.dialogue, cast),
  };
});

// World 3S (Tom's Gauntlet) is an optional challenge branch from World 2. Each level declares its own
// brick groups and slow/fast colors; static objects sit on QUADRANTS so placed spawns stay reachable.
const CHALLENGE_SPOTS = [[.5, .2], [.85, .5], [.5, .8], [.15, .5], [.5, .35], [.5, .65]];
const SOCCER_SPOTS = [[.35, .35], [.65, .65], [.65, .35], [.35, .65], [.5, .25], [.5, .75], [.3, .5], [.7, .5]];
const spread = (kind, entries, start = 0) => placed(kind, entries.map(([time, type], i) =>
  [time, type, ...CHALLENGE_SPOTS[(i + start) % CHALLENGE_SPOTS.length]]));
const soccerBalls = times => placed('object', times.map((time, i) => [time, 'soccer-ball', ...SOCCER_SPOTS[i % SOCCER_SPOTS.length]]));
const atQuadrants = entries => placed('object', entries.map(([time, type, quadrant, extra]) => [time, type, ...QUADRANTS[quadrant], extra]));
const CHALLENGE_LEVEL_DATA = [
  {
    id: '1-49', name: 'Goalie gauntlet', concept: 'goalie gauntlet', duration: 150, goalsGoal: 6,
    groups: [[18, 16, 14], [15, 17], [2, 4], [7, 5], [10, 0]],
    kinds: { 24: 'slow', 7: 'slow', 23: 'slow', 2: 'fast', 12: 'fast', 21: 'fast' },
    bricks: [[18,{ kind: 'goal' }],[15,{ kind: 'goal' }],[10,{ springs: true }],[2,{ conveyor: true, conveyorDirection: 'clockwise' }],[23,{ crumbler: 3 }]],
    enemies: [[1,'goalie',2],[3,'robo-cow',1],[12,'mouse',3],[30,'goalie',1,'red'],[45,'robo-cow',1],[60,'mouse',3],
      [80,'goalie',1],[95,'robo-cow',1,'green'],[110,'mouse',2]],
    events: [
      ...atQuadrants([[0,'bumper-red',1],[0,'bumper-blue',2]]),
      ...soccerBalls([6, 20, 34, 48, 62, 76, 90, 104, 118]),
      ...placedFood(150),
      ...spread('weapon', [[20,'bronze'],[45,'wood'],[70,'silver'],[95,'silver'],[115,'bronze']]),
      ...spread('item', [[35,'kitty-cape'],[90,'kitty-cape']], 3),
    ],
    dialogue: [
      ['tom', 'Quack! So you found my secret Gauntlet. I am Tom the Duck, ruler of every robot in the world, and no cat has ever left here with a single snack!'],
      ['koshi', 'Your robots have been stealing food all over the world. I took the hard road to stop you, so bring on your toughest machines!'],
      ['goalie', 'Robo Goalies guard both goal mouths, and Robo Cows graze the edges, turning bricks into cinder. Goal bricks never burn, so we defend forever!'],
      ['koshi', 'The red Bumper flings balls faster and the blue one slows them. I will bank shots off them, score 6 goals, then grab a hamburger!'],
    ],
  },
  {
    id: '1-50', name: 'Unicorn smorgasbord', concept: 'unicorn buffet', duration: 110, goal: 60,
    groups: [[22, 20], [0, 2, 4], [13, 15], [9, 7], [3, 1]],
    kinds: { 22: 'slow', 14: 'slow', 9: 'slow', 0: 'fast', 17: 'fast', 3: 'fast' },
    bricks: [[12,{ spawner: { kind: 'food', type: 'H', lifetime: 20 } }],[0,{ portal: 'blue' }],[19,{ portal: 'blue' }],[9,{ warped: 8 }],
      [24,{ slimed: true, slimeColor: 'green' }]],
    enemies: [[1,'robo-unicorn',1],[2,'snake',1],[15,'ball',2],[35,'robo-unicorn',1,'red'],[55,'ball',1],[70,'robo-unicorn',1],[85,'snake',1,'green']],
    food: [[3,'L3','P',18],[9,'C3','B',18],[15,'L3','C',18],[21,'R3','L',18],[27,'L3','F',18],[33,'S','H',12],[42,'C3','C',18],
      [51,'L3','L',18],[60,'R3','B',18],[69,'C3','F',18],[78,'L3','C',18],[87,'S','H',12],[94,'C3','L',15]],
    weapons: [[10,'bronze'],[30,'wood'],[50,'silver'],[75,'bronze'],[95,'silver']],
    items: [[8,'eggplant'],[22,'smiley-cookie'],[40,'eggplant'],[60,'stopwatch'],[75,'eggplant'],[95,'smiley-cookie']],
    dialogue: [
      ['tom', 'Welcome to my secret buffet, Koshi! My Robo Unicorns have fasted all week, and my Robo Snakes slither between the tables.'],
      ['robo-unicorn', 'I aim at the nearest snack, then charge and gobble it up. The snakes block your path, and Eggplants spoil your plate by 10 food points!'],
      ['koshi', 'Blue Portals zip me across the hall, and the Spawner brick serves a fresh hamburger. A Smiley Cookie pulls every snack to me before the unicorns bite.'],
      ['tom', 'Sixty food points, kitty, and Warped bricks will scramble your routes. Bon appetit... quack!'],
    ],
  },
  {
    id: '1-51', name: 'Laser lockdown', concept: 'turret crossfire', duration: 130, killGoal: 22,
    groups: [[16, 14, 12, 10], [8, 11], [19, 21], [5, 3]],
    kinds: { 16: 'slow', 13: 'slow', 22: 'slow', 6: 'fast', 23: 'fast', 1: 'fast' },
    bricks: [[16,{ turret: 'laser' }],[8,{ turret: 'fireball' }],[19,{ turret: 'laser' }],[2,{ toggle: 2 }],[25,{ spikes: true }],[5,{ toggle: 1 }]],
    enemies: [[1,'robo-snail',1],[3,'mouse',4],[10,'bucket',2],[20,'ram',3],[32,'mouse',4],[44,'robo-snail',1],[52,'ram',2,'red'],
      [64,'bucket',2],[76,'mouse',4],[88,'ram',2],[100,'bucket',1,'green'],[110,'mouse',3]],
    weapons: [[8,'wood'],[24,'bronze'],[50,'silver'],[80,'bronze'],[105,'bronze']],
    items: [[15,'battery'],[40,'music-box'],[60,'battery'],[90,'battery']],
    dialogue: [
      ['tom', 'This is my locked armory! Robo Snails, Mice, Buckets and Rams will flood in while my Toggle switches keep you guessing.'],
      ['robo-snail', 'Defeat me and every brick cooldown freezes for 20 seconds. Spikes wait on the bottom wall, and Toggles only wake after enough selections!'],
      ['koshi', 'Two Laser Turrets and a Fireball Turret are built into the walls. Each fires once until a Battery recharges it, so I will only shoot into a crowd.'],
      ['tom', 'Earn 22 enemy points before the clock runs out. A Music Box will not save you forever!'],
    ],
  },
  {
    id: '1-52', name: 'Bubble bend-it', concept: 'bubble bank shots', duration: 140, goal: 30, goalsGoal: 4,
    groups: [[2, 4, 6], [24, 22], [17, 19], [7, 5]],
    kinds: { 24: 'fast', 13: 'fast', 0: 'fast', 17: 'slow', 9: 'slow', 12: 'slow' },
    bricks: [[2,{ kind: 'goal' }],[24,{ boost: true }],[17,{ slimed: true, slimeColor: 'red' }],[7,{ warped: 10 }],[3,{ barrier: true }]],
    enemies: [[1,'jackolantern',1],[4,'wheel',2],[20,'mouse',3],[40,'jackolantern',1,'red'],[60,'wheel',2],[80,'mouse',3],[100,'jackolantern',1]],
    events: [
      ...atQuadrants([[0,'bumper-green',0],[0,'bumper-red',3],[0,'bubble-green',1],[20,'bubble-blue',2],[45,'bubble-red',1],
        [70,'bubble-green',2],[100,'bubble-blue',1]]),
      ...soccerBalls([6, 22, 38, 54, 70, 86, 102]),
      ...placedFood(140),
      ...spread('weapon', [[15,'bronze'],[35,'wood'],[60,'silver'],[85,'silver'],[105,'bronze']]),
      ...spread('item', [[30,'kitty-cape'],[85,'kitty-cape']], 2),
    ],
    dialogue: [
      ['tom', 'Bubbles drift beside my goal and Bumpers guard the corners. My Robo Jackolanterns and Wheels will make sure you never score!'],
      ['jackolantern', 'I stomp every 4 seconds, and a square ring of fire grows from each stomp. Get stuck in a Bubble and you cannot dodge it!'],
      ['koshi', 'A Barrier fence on the left wall stops their fire but lets me through. A Boost brick and a Kitty Cape help me score 4 goals on the side wall and gather 30 food points too.'],
      ['tom', 'Red Slime holds you for a second. Warped bricks grow and shrink. Every second counts, quack!'],
    ],
  },
  {
    id: '1-53', name: 'Copycat penalty kicks', concept: 'copycat penalties', duration: 130, killGoal: 8, goalsGoal: 4,
    groups: [[20, 18], [12, 10], [11, 13], [23, 25], [5, 3, 1]],
    kinds: { 22: 'slow', 23: 'slow', 4: 'slow', 12: 'fast', 5: 'fast', 15: 'fast' },
    bricks: [[20,{ kind: 'goal' }],[11,{ kind: 'goal' }],[12,{ portal: 'green' }],[23,{ portal: 'green' }],[5,{ crumbler: 3 }],[6,{ spikes: true }]],
    enemies: [[1,'goalie',2],[3,'robo-koshi',1],[14,'mouse',3],[28,'goalie',1],[40,'robo-koshi',1,'red'],[55,'mouse',3],[70,'wheel',2],
      [85,'robo-koshi',1],[100,'mouse',2]],
    weapons: [[16,'bronze'],[30,'wood'],[45,'silver'],[70,'silver'],[90,'bronze'],[110,'bronze']],
    items: [[25,'spooky-mask'],[35,'ditto-stamp'],[75,'spooky-mask']],
    events: soccerBalls([5, 20, 35, 50, 65, 80, 95]),
    dialogue: [
      ['tom', 'Penalty time! Two goal mouths, Robo Goalies in both, and my Robo Koshi copying every step you take.'],
      ['robo-koshi', 'Beep. I follow your exact path a few seconds behind you. Chase a ball, double back, and you run straight into me.'],
      ['koshi', 'Green Portals let me shoot from the far side. A Spooky Mask scares robots away, and a Ditto Stamp copies a brick, like a portal, onto another.'],
      ['tom', 'Score 4 goals AND earn 8 enemy points. My goalies never get tired, quack!'],
    ],
  },
  {
    id: '1-54', name: 'Cinder stampede', concept: 'cinder stampede', duration: 120, goal: 35, killGoal: 8,
    groups: [[24, 22, 20], [0, 2], [15, 17], [21, 23], [9, 7]],
    kinds: { 24: 'slow', 0: 'slow', 13: 'slow', 18: 'fast', 4: 'fast', 21: 'fast', 3: 'fast' },
    bricks: [[14,{ boost: true }],[21,{ boost: true }],[0,{ barrier: true }],[9,{ barrier: true }],[16,{ crumbler: 3 }],[5,{ springs: true }]],
    enemies: [[1,'robo-cow',2],[6,'mouse',3],[18,'bucket',1],[30,'robo-cow',1],[42,'mouse',3],[55,'bucket',1,'red'],[68,'robo-cow',1,'green'],
      [80,'mouse',3],[95,'bucket',1]],
    weapons: [[20,'wood'],[40,'wood'],[60,'bronze'],[85,'bronze']],
    items: [[12,'saw-blade'],[30,'paint-roller-red'],[70,'paint-wide-red']],
    dialogue: [
      ['tom', 'Stampede! My Robo Cows will chew your Boost bricks into cinder while my mice and Buckets keep you busy.'],
      ['robo-cow', 'Moo. We eat the brick beneath our hooves until it turns to Cinder. Barrier fences turn us around, and a Saw Blade makes cinder even faster!'],
      ['koshi', 'Only wood and bronze swords this time, so my two Boost bricks must do the heavy lifting. Red Paint will turn my favorite bricks Fast again.'],
      ['tom', 'Earn 8 enemy points and 35 food points before my herd finishes lunch!'],
    ],
  },
  {
    id: '1-55', name: 'Obstacle cup', concept: 'obstacle course', duration: 140, goalsGoal: 5,
    groups: [[14, 12], [4, 6, 8], [19, 21], [25, 9]],
    kinds: { 14: 'slow', 3: 'slow', 17: 'slow', 19: 'fast', 0: 'fast', 24: 'fast' },
    bricks: [[4,{ kind: 'goal' }],[25,{ turret: 'fireball' }],[19,{ toggle: 2 }],[1,{ conveyor: true, conveyorDirection: 'counterclockwise' }]],
    enemies: [[1,'goalie',1],[2,'wheel',2],[10,'snake',1],[25,'goalie',1,'red'],[35,'wheel',2],[50,'snake',1],[70,'mouse',3],
      [90,'goalie',1],[105,'wheel',2]],
    events: [
      ...atQuadrants([[0,'obstruction-diamond',0,{ destructible: true }],[0,'obstruction-circle',2],
        [40,'obstruction-circle',1,{ destructible: true }],[75,'obstruction-diamond',3,{ destructible: true }]]),
      ...soccerBalls([6, 20, 34, 48, 62, 76, 90, 104]),
      ...placedFood(140),
      ...spread('weapon', [[18,'bronze'],[40,'wood'],[65,'silver'],[90,'bronze'],[120,'silver']]),
      ...spread('item', [[15,'battery'],[55,'battery'],[95,'battery']], 2),
    ],
    dialogue: [
      ['tom', 'Welcome to the Obstacle Cup! Walls are bolted to my pitch, and my crane drops more mid-match. Robo Goalies and Wheels are warming up.'],
      ['snake', 'Hsss. I slither along the inner perimeter, and only my head takes hits. Walls with a TNT sign break in a fireball blast.'],
      ['koshi', 'The Fireball Turret clears those walls, and three Batteries will let me fire again. Then I need clean shots at the side goal.'],
      ['tom', 'Score 5 goals, and watch for the twinkle before a wall lands on you. Quack!'],
    ],
  },
  {
    id: '1-56', name: 'Boom helmet bakery', concept: 'boom bakery', duration: 120, goal: 50, activationLimit: 8,
    groups: [[22, 20, 18], [2, 4], [17, 19], [7, 5], [23, 25]],
    kinds: { 22: 'slow', 7: 'slow', 23: 'slow', 2: 'fast', 15: 'fast', 12: 'fast' },
    bricks: [[16,{ conveyor: true, conveyorDirection: 'clockwise' }],[2,{ springs: true }],[17,{ warped: 8 }],[7,{ toggle: 4 }],
      [12,{ spawner: { kind: 'food', type: 'L', lifetime: 20 } }]],
    enemies: [[1,'robo-snail',1],[3,'ram',2],[15,'ball',2],[35,'robo-snail',1],[45,'ram',1,'red'],[60,'ball',2],[80,'ram',2],[95,'robo-snail',1]],
    weapons: [[12,'bronze'],[35,'wood'],[60,'silver'],[85,'bronze'],[105,'silver']],
    items: [[30,'magic-sunglasses'],[70,'magic-sunglasses']],
    events: spread('item', [[4,'boom-time-blue'],[25,'boom-time-green'],[40,'boom-time-red'],[55,'boom-time-blue'],
      [75,'boom-time-green'],[95,'boom-time-red']], 4),
    dialogue: [
      ['tom', 'My bakery runs on Boom Helmets! You start with only 8 charges, and every brick selection spends one. At zero... kaboom!'],
      ['robo-snail', 'Defeat me and every cooldown freezes. Lucky for you, Magical Sunglasses let you select bricks while they recharge.'],
      ['koshi', 'Boom Times add charges, and Conveyors and Springs carry me without a click. The Spawner brick bakes chicken legs too.'],
      ['tom', 'Collect 50 food points while my Rams and Robo Balls crash through the ovens. Do not waste a click!'],
    ],
  },
  {
    id: '1-57', name: 'Jackolantern junkyard', concept: 'fire and fences', duration: 120, killGoal: 14,
    groups: [[18, 16], [0, 2, 4], [13, 15], [19, 21, 23], [3, 1]],
    kinds: { 18: 'slow', 11: 'slow', 7: 'slow', 12: 'fast', 0: 'fast', 25: 'fast' },
    bricks: [[18,{ spikes: true }],[0,{ portal: 'yellow' }],[19,{ portal: 'yellow' }],[7,{ slimed: true, slimeColor: 'blue' }],[10,{ barrier: true }],
      [5,{ barrier: true }]],
    enemies: [[1,'jackolantern',2],[5,'mouse',3],[18,'ball',2],[30,'jackolantern',1,'red'],[42,'mouse',3],[55,'ball',2],[68,'jackolantern',2],
      [80,'mouse',3],[92,'ball',1,'blue'],[102,'jackolantern',1]],
    events: [
      ...atQuadrants([[0,'obstruction-diamond-large',0],[0,'obstruction-circle-large',3]]),
      ...placedFood(120),
      ...spread('weapon', [[14,'gold'],[30,'wood'],[50,'bronze'],[85,'silver'],[105,'bronze']]),
      ...spread('item', [[25,'saw-blade'],[60,'stopwatch']], 3),
    ],
    dialogue: [
      ['tom', 'My junkyard is piled with giant scrap. Robo Jackolanterns will fill every gap with fire while my mice and Robo Balls close in!'],
      ['jackolantern', 'Each stomp sends a square ring of fire outward. Only bricks, Barrier fences and Obstructions stop the flames!'],
      ['koshi', 'Then I will build fences, warp through Yellow Portals, and keep clear of the Blue Slime. A Gold Sword strikes everything for 15 seconds!'],
      ['tom', 'Earn 14 enemy points. Watch for the Saw Blade, though. It turns bricks into cinder!'],
    ],
  },
  {
    id: '1-58', name: 'Grand slam', concept: 'triple threat', duration: 150, goal: 30, killGoal: 6, goalsGoal: 3,
    groups: [[24, 22], [12, 10], [2, 4], [15, 17, 19], [9, 7]],
    kinds: { 12: 'slow', 21: 'slow', 3: 'slow', 24: 'fast', 6: 'fast', 9: 'fast' },
    bricks: [[15,{ kind: 'goal' }],[2,{ spawner: { kind: 'weapon', type: 'bronze' } }],[24,{ springs: true }],
      [9,{ conveyor: true, conveyorDirection: 'counterclockwise' }]],
    enemies: [[1,'robo-unicorn',1],[2,'goalie',1],[8,'robo-koshi',1],[15,'mouse',3],[35,'robo-unicorn',1,'red'],[50,'mouse',3],[65,'goalie',1],
      [80,'robo-koshi',1],[95,'mouse',3],[110,'robo-unicorn',1]],
    events: [
      ...atQuadrants([[0,'bubble-red',0],[30,'bubble-green',3],[60,'bubble-red',1],[90,'bubble-blue',2]]),
      ...soccerBalls([5, 25, 45, 65, 85, 105]),
      ...placedFood(150),
      ...spread('weapon', [[18,'bronze'],[40,'wood'],[70,'silver'],[95,'silver'],[125,'bronze']]),
      ...spread('item', [[25,'kitty-cape'],[45,'smiley-cookie'],[100,'kitty-cape']], 2),
    ],
    dialogue: [
      ['tom', 'The Grand Slam! Food, robots AND goals. My Robo Unicorns eat, my Robo Goalies defend, and my Robo Koshi hunts you down.'],
      ['robo-unicorn', 'Every snack on this board is mine. Red bubbles hold you for one second, blue ones for five!'],
      ['koshi', 'The Weapon Spawner brick hands me a Bronze Sword. A Smiley Cookie pulls food out of the unicorns\' reach, and a Kitty Cape keeps me ahead of my copy.'],
      ['tom', 'Score 3 goals, earn 6 enemy points and collect 30 food points. All three, kitty!'],
    ],
  },
  {
    id: '1-59', name: 'Turret derby', concept: 'turret derby', duration: 140, killGoal: 12, goalsGoal: 4,
    groups: [[20, 18, 16], [0, 2], [6, 8], [11, 13], [21, 23, 25]],
    kinds: { 0: 'slow', 11: 'slow', 5: 'slow', 14: 'fast', 6: 'fast', 9: 'fast' },
    bricks: [[20,{ kind: 'goal' }],[0,{ turret: 'laser' }],[21,{ turret: 'laser' }],[6,{ toggle: 2 }],[11,{ toggle: 1 }],
      [7,{ slimed: true, slimeColor: 'green' }]],
    enemies: [[1,'robo-cow',1],[2,'goalie',2],[6,'mouse',4],[18,'ram',2],[30,'robo-cow',1,'red'],[42,'mouse',4],[55,'ram',2],
      [70,'goalie',1,'green'],[80,'mouse',4],[95,'robo-cow',1],[105,'ram',2]],
    events: [
      ...atQuadrants([[0,'bumper-red',2],[0,'bumper-blue',3]]),
      ...soccerBalls([5, 20, 35, 50, 65, 80, 95]),
      ...placedFood(140),
      ...spread('weapon', [[8,'wood'],[20,'bronze'],[45,'silver'],[75,'bronze'],[100,'silver'],[120,'bronze']]),
      ...spread('item', [[12,'battery'],[40,'spooky-mask'],[60,'battery'],[100,'battery']], 1),
    ],
    dialogue: [
      ['tom', 'Welcome to the derby! My Robo Cows graze the walls, my Robo Goalies guard the top goal, and my mice and rams swarm the pitch.'],
      ['robo-cow', 'Moo. Those Laser Turret bricks look tasty. Once I chew one into cinder, it never fires again!'],
      ['koshi', 'Then I fire before they arrive. Lasers blast robots in a line, and Batteries recharge them. The Toggle bricks need a few selections first.'],
      ['tom', 'Score 4 goals and earn 12 enemy points. Bumpers bounce the balls everywhere, quack quack!'],
    ],
  },
  {
    id: '1-60', name: 'The duck\'s last stand', concept: 'last stand', duration: 160, goal: 40, goalsGoal: 4,
    groups: [[22, 20], [14, 12, 10, 0], [4, 6], [13, 15, 17], [25, 9], [3, 1]],
    kinds: { 14: 'slow', 8: 'slow', 25: 'slow', 22: 'fast', 2: 'fast', 21: 'fast', 5: 'fast' },
    bricks: [[13,{ kind: 'goal' }],[14,{ boost: true }],[4,{ portal: 'red' }],[25,{ portal: 'red' }],[19,{ spikes: true }],
      [3,{ conveyor: true, conveyorDirection: 'clockwise' }],[16,{ barrier: true }]],
    enemies: [[1,'robo-koshi',1],[2,'robo-unicorn',1],[6,'jackolantern',1],[20,'robo-koshi',1],[35,'robo-unicorn',1,'green'],
      [50,'jackolantern',1,'red'],[65,'robo-koshi',1],[85,'robo-unicorn',1],[100,'jackolantern',1],[120,'robo-koshi',1,'red']],
    events: [
      ...atQuadrants([[0,'bubble-blue',0],[30,'obstruction-circle',1],[60,'bubble-red',0],[70,'obstruction-diamond',3],
        [110,'obstruction-circle',2]]),
      ...soccerBalls([5, 22, 39, 56, 73, 90, 107, 124]),
      ...placedFood(160),
      ...spread('weapon', [[15,'bronze'],[35,'wood'],[55,'silver'],[80,'silver'],[100,'bronze'],[130,'bronze']]),
      ...spread('item', [[10,'eggplant'],[25,'kitty-cape'],[40,'magic-sunglasses'],[60,'eggplant'],[90,'kitty-cape'],[115,'eggplant']], 3),
    ],
    dialogue: [
      ['tom', 'Enough! This is my last stand. My Robo Koshi, Robo Unicorns and Robo Jackolanterns will defend my gauntlet together!'],
      ['robo-koshi', 'Beep. I follow your path. The unicorns eat your food, and Tom\'s crane drops walls wherever it likes.'],
      ['koshi', 'Red Portals and a giant Boost brick get me across the field, and a Barrier fence blocks the jackolantern fire. Magical Sunglasses let me select bricks even while they recharge.'],
      ['tom', 'Collect 40 food points and score 4 goals in the bottom net. Dodge my Eggplants too!'],
      ['koshi', 'When this gauntlet falls, the whole world gets a feast, and I get the first bite!'],
    ],
  },
].map(entry => {
  const attributes = new Map([...campaignRegions.keys()].map(id => [id, { kind: entry.kinds[id] ?? 'normal' }]));
  for (const [id, brick] of entry.bricks) {
    for (const member of brick.kind === 'goal' ? entry.groups.find(group => group[0] === id) ?? [id] : [id]) {
      Object.assign(attributes.get(member), brick);
    }
  }
  const brickTypes = [...attributes].map(([id, brick]) => campaignBrick(id, brick));
  const events = entry.events ?? [];
  const food = entry.food ?? (events.some(event => event.kind === 'food') ? [] : randomFood(entry.duration));
  const foodPoints = food.reduce((sum, [, method, type]) => sum + (method === 'S' ? 1 : Number(method.slice(1))) * FOODS[type].value, 0)
    + events.reduce((sum, event) => sum + (event.kind === 'food' ? FOODS[event.type].value : 0), 0)
    + brickTypes.reduce((sum, brick) => sum + (brick.spawner?.kind === 'food' ? FOODS[brick.spawner.type].value : 0), 0);
  const cast = [...new Set([
    ...entry.dialogue.map(([speaker]) => speaker).filter(speaker => !['koshi', 'tom'].includes(speaker)),
    ...entry.enemies.map(([, type]) => type),
  ])].slice(0, 2);
  return {
    id: entry.id,
    name: entry.name, concept: entry.concept, duration: entry.duration,
    goal: entry.goal ?? 0, killGoal: entry.killGoal ?? 0, survive: false,
    // Challenge levels allow at most four hearts even if every food point is collected.
    heartCost: Math.ceil(foodPoints / 4),
    brickSet: 3, brickTypes, brickGroups: entry.groups.map(members => ({ owner: members[0], members })),
    food, enemies: entry.enemies, items: entry.items ?? [], weapons: entry.weapons ?? [],
    ...(events.length ? { events } : {}),
    ...(entry.goalsGoal ? { goalsGoal: entry.goalsGoal } : {}),
    ...(entry.activationLimit ? { activationLimit: entry.activationLimit } : {}),
    cutscene: story('foundry', entry.dialogue, cast),
  };
});
const LEVEL_DATA = {};
for (const level of [...BASE_LEVEL_DATA, ...FOUNDRY_LEVEL_DATA, ...CHALLENGE_LEVEL_DATA]) {
  if (Object.hasOwn(LEVEL_DATA, level.name)) throw new Error(`Duplicate level name: ${level.name}`);
  LEVEL_DATA[level.name] = level;
}
const campaign = typeof module !== 'undefined' && module.exports ? require('./campaign.js') : globalThis.KoshiCampaign;
const LEVELS = campaign.assembleCampaign(LEVEL_DATA);

function portalPairIssues(bricks) {
  return Object.keys(PORTALS).flatMap(color => {
    const count = bricks.filter(brick => brick.portal === color && brick.absorbedBy == null).length;
    return count === 0 || count === 2 ? [] : [`${color} portals: ${count} brick${count === 1 ? '' : 's'}; exactly two required.`];
  });
}

function validateCustomLevel(value, { allowUnpairedPortals = false } = {}) {
  const fail = message => { throw new TypeError(message); };
  const number = (v, min, max, name) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(`${name} must be a number from ${min} to ${max}.`);
    return v;
  };
  const shield = (item, result, name) => {
    if (item.shield === undefined) return;
    if (item.kind !== 'enemy' || (item.shield !== null && !Object.hasOwn(SHIELDS, item.shield))) fail(`${name} has an invalid enemy shield.`);
    result.shield = item.shield;
  };
  const obstructionAppearance = (item, result, name) => {
    const obstruction = item.kind === 'object' && OBJECTS[item.type]?.obstruction;
    for (const field of ['color', 'patternColor', 'pattern']) {
      if (item[field] === undefined) continue;
      if (!obstruction) fail(`${name}: ${field} is only supported for obstructions.`);
      if (field === 'pattern' ? !OBSTRUCTION_PATTERNS.includes(item[field])
        : typeof item[field] !== 'string' || !/^#[0-9a-f]{6}$/i.test(item[field])) {
        fail(`${name} has an invalid obstruction ${field}.`);
      }
      result[field] = item[field];
    }
    for (const field of ['width', 'height', 'destructible']) {
      if (item[field] === undefined) continue;
      if (!obstruction) fail(`${name}: ${field} is only supported for obstructions.`);
      if (field === 'destructible' ? typeof item[field] !== 'boolean'
        : !Number.isFinite(item[field]) || item[field] < 1 || item[field] > 10000) {
        fail(`${name} has an invalid obstruction ${field}.`);
      }
      result[field] = item[field];
    }
    if (obstruction && OBJECTS[item.type].obstruction !== 'rectangle'
      && item.width !== undefined && item.height !== undefined && item.width !== item.height) {
      fail(`${name}: circles and diamonds require equal width and height.`);
    }
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Level must be a JSON object.');
  if (value.version !== 1) fail('Unsupported level version. Expected version 1.');
  if (typeof value.id !== 'string' || !value.id.trim() || value.id.length > 60) fail('Level name must contain 1–60 characters.');
  const duration = number(value.duration, 1, 3600, 'Duration');
  const goal = number(value.goal, 0, 100000, 'Food goal');
  if (!Number.isInteger(goal)) fail('Food goal must be a whole number.');
  const killGoal = value.killGoal === undefined ? 0 : number(value.killGoal, 0, 100000, 'Enemy goal');
  if (!Number.isInteger(killGoal)) fail('Enemy goal must be a whole number.');
  const goalsGoal = value.goalsGoal === undefined ? 0 : number(value.goalsGoal, 0, 100000, 'Goals required');
  if (!Number.isInteger(goalsGoal)) fail('Goals required must be a whole number.');
  if (value.activationLimit != null) {
    number(value.activationLimit, 1, 100000, 'Activation limit');
    if (!Number.isInteger(value.activationLimit)) fail('Activation limit must be a whole number.');
  }
  if (value.survive !== undefined && typeof value.survive !== 'boolean') fail('Survive must be a boolean.');
  if (value.survive && (goal || killGoal || goalsGoal)) fail('Survival cannot be combined with food, enemy or soccer goals.');
  if (!value.survive && !goal && !killGoal && !goalsGoal) fail('Food goal, enemy goal or soccer goals must be positive unless survival is selected.');
  const heartCost = value.heartCost === null ? null : number(value.heartCost, 1, 100000, 'Heart cost');
  if (heartCost !== null && !Number.isInteger(heartCost)) fail('Heart cost must be a whole number or null.');
  if (![1, 3].includes(value.brickSet)) fail('Brick set must be 1 or 3 (slow and fast bricks each).');
  if (!Array.isArray(value.events) || value.events.length > 2000) fail('Events must be an array of at most 2000 placements.');
  const events = value.events.map((event, i) => {
    const name = `Event ${i + 1}`;
    if (!event || typeof event !== 'object' || Array.isArray(event)) fail(`${name} must be an object.`);
    const time = number(event.time, 0, duration, `${name} time`);
    if (time >= duration) fail(`${name} must appear before the level ends.`);
    const x = number(event.x, 0, 1, `${name} X`), y = number(event.y, 0, 1, `${name} Y`);
    const types = { food: FOODS, enemy: { mouse: true, wheel: true, ram: true, bucket: true, ball: true, jackolantern: true, snake: true, goalie: true, 'robo-koshi': true, 'robo-snail': true, 'robo-cow': true, 'robo-unicorn': true }, weapon: SWORDS, item: ITEMS, object: OBJECTS };
    if (!Object.hasOwn(types, event.kind) || !Object.hasOwn(types[event.kind], event.type)) fail(`${name} has an unknown category or type.`);
    if (event.kind === 'enemy' && event.type === 'wheel' && x !== 0 && x !== 1 && y !== 0 && y !== 1) fail(`${name}: wheels must start on an edge of the playable area.`);
    if (event.kind === 'enemy' && event.type === 'snake' && x !== 0 && x !== 1 && y !== 0 && y !== 1) fail(`${name}: snakes must start on an edge of the playable area.`);
    if (event.kind === 'enemy' && event.type === 'robo-cow' && x !== 0 && x !== 1 && y !== 0 && y !== 1) fail(`${name}: Robo Cows must start on an edge of the playable area.`);
    const result = { time, kind: event.kind, type: event.type, x, y };
    shield(event, result, name);
    obstructionAppearance(event, result, name);
    if (event.carriesCatBlock !== undefined) {
      if (event.kind !== 'enemy' || typeof event.carriesCatBlock !== 'boolean') fail(`${name} has an invalid Cat Block carrier setting.`);
      if (event.carriesCatBlock) result.carriesCatBlock = true;
    }
    if (event.carriesKey !== undefined) {
      if (event.kind !== 'enemy' || typeof event.carriesKey !== 'boolean') fail(`${name} has an invalid key carrier setting.`);
      if (event.carriesKey) result.carriesKey = true;
    }
    if (event.keysRequired !== undefined && (event.kind !== 'item' || event.type !== 'treasure-chest')) {
      fail(`${name}: keysRequired is only supported for treasure chests.`);
    }
    if (event.kind === 'item' && event.type === 'treasure-chest') {
      const keysRequired = number(event.keysRequired ?? 1, 1, 100000, `${name} required keys`);
      if (!Number.isInteger(keysRequired)) fail(`${name} required keys must be a whole number.`);
      result.keysRequired = keysRequired;
    }
    if (event.kind === 'object' && event.lifetime != null) fail(`${name}: objects cannot have a lifetime; soccer balls persist until scored and other objects until used or the level ends.`);
    if (event.kind === 'food') result.lifetime = number(event.lifetime, .1, 3600, `${name} food lifetime`);
    else if (['item', 'weapon'].includes(event.kind) && event.lifetime != null) {
      result.lifetime = number(event.lifetime, .1, 3600, `${name} object lifetime`);
    }
    return result;
  });
  const result = { version: 1, id: value.id.trim(), duration, goal, heartCost, brickSet: value.brickSet, events };
  if (value.killGoal !== undefined) result.killGoal = killGoal;
  if (value.goalsGoal !== undefined) result.goalsGoal = goalsGoal;
  if (value.activationLimit !== undefined) result.activationLimit = value.activationLimit;
  if (value.survive !== undefined) result.survive = value.survive;
  if (value.catBlock !== undefined) {
    const catBlock = value.catBlock;
    if (!catBlock || typeof catBlock !== 'object' || Array.isArray(catBlock)
      || typeof catBlock.description !== 'string' || !catBlock.description.trim() || catBlock.description.length > 500) {
      fail('Cat Block description must contain 1–500 characters.');
    }
    const messages = {};
    for (const source of Object.keys(CAT_BLOCK_MESSAGES)) {
      const message = catBlock.messages?.[source] ?? CAT_BLOCK_MESSAGES[source];
      if (typeof message !== 'string' || !message.trim() || message.length > 200) {
        fail(`Cat Block ${source} message must contain 1–200 characters.`);
      }
      messages[source] = message.trim();
    }
    result.catBlock = { description: catBlock.description.trim(), messages };
  }
  if (value.cutscene !== undefined) result.cutscene = validateCutscene(value.cutscene);
  if (value.brickTypes !== undefined) {
    if (!Array.isArray(value.brickTypes) || value.brickTypes.length > 2000) fail('Brick types must be an array of at most 2000 edge overrides.');
    result.brickTypes = value.brickTypes.map((entry, i) => {
      if (!entry || !['top', 'bottom', 'left', 'right'].includes(entry.edge) || !(['cinder', 'goal'].includes(entry.kind) || Object.hasOwn(COOLDOWNS, entry.kind))) fail(`Brick override ${i + 1} has an unknown edge or type.`);
      const start = number(entry.start, 0, 1, `Brick override ${i + 1} start`);
      const end = number(entry.end, 0, 1, `Brick override ${i + 1} end`);
      if (end <= start) fail(`Brick override ${i + 1} must have an end greater than its start.`);
      const override = { edge: entry.edge, start, end, kind: entry.kind };
      if (entry.crumbler !== undefined) {
        override.crumbler = entry.crumbler === null ? null : number(entry.crumbler, 1, 100000, `Brick override ${i + 1} selections`);
        if (override.crumbler !== null && !Number.isInteger(override.crumbler)) fail(`Brick override ${i + 1} selections must be a whole number.`);
      }
      if (entry.warped !== undefined) override.warped = entry.warped === null ? null : number(entry.warped, .1, 3600, `Brick override ${i + 1} warp duration`);
      if (entry.slimeColor !== undefined) {
        if (typeof entry.slimeColor !== 'string' || !Object.hasOwn(SLIMES, entry.slimeColor)) fail(`Brick override ${i + 1} has an unknown slime color.`);
        override.slimeColor = entry.slimeColor;
      }
      if (entry.conveyorDirection !== undefined) {
        if (!['clockwise', 'counterclockwise'].includes(entry.conveyorDirection)) fail(`Brick override ${i + 1} has an unknown conveyor direction.`);
        override.conveyorDirection = entry.conveyorDirection;
      }
      for (const attribute of ['slimed', 'springs', 'spikes', 'conveyor', 'barrier']) {
        if (entry[attribute] === undefined) continue;
        if (typeof entry[attribute] !== 'boolean') fail(`Brick override ${i + 1} ${attribute} must be a boolean.`);
        override[attribute] = entry[attribute];
      }
      if (entry.portal !== undefined) {
        if (entry.portal !== null && (typeof entry.portal !== 'string' || !Object.hasOwn(PORTALS, entry.portal))) fail(`Brick override ${i + 1} has an unknown portal color.`);
        override.portal = entry.portal;
      }
      if (entry.turret !== undefined) {
        if (entry.turret !== null && !['fireball', 'laser'].includes(entry.turret)) fail(`Brick override ${i + 1} has an unknown turret type.`);
        override.turret = entry.turret;
      }
      if (entry.toggle !== undefined) {
        if (entry.toggle !== null && ![1, 2, 4].includes(entry.toggle)) fail(`Brick override ${i + 1} toggle must require 1, 2, or 4 clicks.`);
        override.toggle = entry.toggle;
      }
      if (entry.boost !== undefined) {
        if (typeof entry.boost !== 'boolean') fail(`Brick override ${i + 1} boost must be a boolean.`);
        override.boost = entry.boost;
      }
      if (entry.spawner !== undefined) {
        if (entry.spawner === null) override.spawner = null;
        else {
          const spawn = entry.spawner, types = { food: FOODS, weapon: SWORDS, enemy: { mouse: true, wheel: true, ram: true, bucket: true, ball: true, jackolantern: true, snake: true, goalie: true, 'robo-koshi': true, 'robo-snail': true, 'robo-cow': true, 'robo-unicorn': true }, heart: { heart: true }, item: ITEMS, object: OBJECTS };
          if (!spawn || !Object.hasOwn(types, spawn.kind) || !Object.hasOwn(types[spawn.kind], spawn.type)) fail(`Brick override ${i + 1} has an unknown spawning item.`);
          override.spawner = { kind: spawn.kind, type: spawn.type };
          if (spawn.x !== undefined || spawn.y !== undefined) {
            override.spawner.x = number(spawn.x, 0, 1, `Brick override ${i + 1} spawn X`);
            override.spawner.y = number(spawn.y, 0, 1, `Brick override ${i + 1} spawn Y`);
            if (spawn.kind === 'enemy' && ['wheel', 'snake', 'robo-cow'].includes(spawn.type)) {
              Object.assign(override.spawner, snapWheel(override.spawner.x, override.spawner.y));
            }
          }
          shield(spawn, override.spawner, `Brick override ${i + 1}`);
          obstructionAppearance(spawn, override.spawner, `Brick override ${i + 1}`);
          if (spawn.kind === 'object' && spawn.lifetime != null) fail(`Brick override ${i + 1}: objects cannot have a lifetime.`);
          if (spawn.kind === 'food') override.spawner.lifetime = number(spawn.lifetime, .1, 3600, `Brick override ${i + 1} spawn food lifetime`);
          else if (['item', 'weapon'].includes(spawn.kind) && spawn.lifetime != null) {
            override.spawner.lifetime = number(spawn.lifetime, .1, 3600, `Brick override ${i + 1} spawn object lifetime`);
          }
        }
      }
      if (override.slimed && override.springs) fail(`Brick override ${i + 1} cannot be both Slimed and Springs.`);
      if (override.spikes && (override.slimed || override.springs)) fail(`Brick override ${i + 1} cannot combine Spikes with Slimed or Springs.`);
      if (override.conveyor && (override.slimed || override.springs || override.spikes)) fail(`Brick override ${i + 1} cannot combine Conveyor with another surface.`);
      if (CONTACT_SURFACES.filter(attribute => override[attribute]).length > 1) fail(`Brick override ${i + 1} cannot combine contact surfaces.`);
      if (override.kind === 'cinder' && ['crumbler', 'warped', 'toggle', ...CONTACT_SURFACES].some(attribute => override[attribute])) fail(`Brick override ${i + 1}: Cinder bricks cannot have modifiers or contact surfaces.`);
      if (override.kind === 'goal' && ['crumbler', 'warped', 'toggle', ...CONTACT_SURFACES].some(attribute => override[attribute])) fail(`Brick override ${i + 1}: Goal bricks cannot have modifiers or contact surfaces.`);
      return override;
    });
  }
  const bricks = makeBricks();
  applyBrickTypes(bricks, result.brickTypes);
  if (value.brickGroups !== undefined) {
    if (!Array.isArray(value.brickGroups) || value.brickGroups.length > bricks.length / 2) fail('Brick groups must be an array of at most 13 groups.');
    const used = new Set(), perimeter = brickPerimeter(bricks, WIDTH, HEIGHT);
    result.brickGroups = value.brickGroups.map((group, i) => {
      const name = `Brick group ${i + 1}`;
      if (!group || !Array.isArray(group.members) || group.members.length < 2 || group.members.length > bricks.length) fail(`${name} needs 2–26 brick IDs.`);
      const members = group.members.map(id => {
        if (!Number.isInteger(id) || id < 0 || id >= bricks.length || used.has(id)) fail(`${name} has an invalid, duplicate, or overlapping brick ID.`);
        used.add(id); return id;
      });
      if (!Number.isInteger(group.owner) || !members.includes(group.owner)) fail(`${name} owner must be one of its members.`);
      const selected = new Set(members);
      const starts = perimeter.filter((id, index) => selected.has(id) && !selected.has(perimeter[(index + perimeter.length - 1) % perimeter.length]));
      if (members.length !== bricks.length && starts.length !== 1) fail(`${name} members must be adjacent along the perimeter.`);
      if (members.some(id => bricks[id].kind === 'cinder') && members.some(id => bricks[id].kind !== 'cinder')) fail(`${name} can combine Cinder only with other Cinder bricks.`);
      if (members.some(id => bricks[id].kind === 'goal') && members.some(id => bricks[id].kind !== 'goal')) fail(`${name} can combine Goal only with other Goal bricks.`);
      return { owner: group.owner, members };
    });
  }
  applyBrickGroups(bricks, result.brickGroups);
  const hasCatBlockSource = result.events.some(event =>
    event.kind === 'item' && ['cat-block', 'treasure-chest'].includes(event.type)
    || event.kind === 'enemy' && event.carriesCatBlock)
    || result.brickTypes?.some(brick => brick.spawner?.kind === 'item' && brick.spawner.type === 'cat-block');
  if (hasCatBlockSource && !result.catBlock) fail('Enable Cat Block in level settings and add its collection description.');
  const issues = portalPairIssues(bricks);
  if (!allowUnpairedPortals && issues.length) fail(issues.join(' '));
  return result;
}

function applyBrickGroups(bricks, groups = []) {
  for (const group of groups) {
    for (const id of group.members) {
      bricks[id].initialOwner = id === group.owner ? null : group.owner;
      bricks[id].absorbedBy = bricks[id].initialOwner;
    }
  }
}

function brickPerimeter(bricks, width, height) {
  const regions = brickRegions(bricks, width, height);
  return ['top', 'right', 'bottom', 'left'].flatMap(edge => {
    const group = bricks.filter(brick => regions.get(brick.id).edge === edge)
      .sort((a, b) => regions.get(a.id).start - regions.get(b.id).start);
    return (edge === 'bottom' || edge === 'left' ? group.reverse() : group).map(brick => brick.id);
  });
}

function brickRegions(bricks, width, height) {
  const groups = { top: [], bottom: [], left: [], right: [] };
  for (const brick of bricks) {
    if (brick.region) {
      const edge = width > height
        ? { top: 'right', right: 'bottom', bottom: 'left', left: 'top' }[brick.region.edge]
        : brick.region.edge;
      groups[edge].push(brick);
      continue;
    }
    const distances = [brick.y, height - brick.y - brick.h, brick.x, width - brick.x - brick.w].map(distance => Math.round(distance * 1e6) / 1e6);
    groups[Object.keys(groups)[distances.indexOf(Math.min(...distances))]].push(brick);
  }
  const regions = new Map();
  for (const [edge, group] of Object.entries(groups)) {
    group.sort((a, b) => edge === 'top' || edge === 'bottom' ? a.x - b.x : a.y - b.y);
    group.forEach((brick, i) => regions.set(brick.id, { edge, start: i / group.length, end: (i + 1) / group.length }));
  }
  return regions;
}

function snapWheel(x, y) {
  const distances = [x, 1 - x, y, 1 - y];
  const edge = distances.indexOf(Math.min(...distances));
  return { x: edge === 0 ? 0 : edge === 1 ? 1 : x, y: edge === 2 ? 0 : edge === 3 ? 1 : y };
}

function turretGeometry(brick, width, height, catRadius = 21) {
  const edge = brickRegions([brick], width, height).get(brick.id).edge;
  const direction = { top: { x: 0, y: 1 }, right: { x: -1, y: 0 },
    bottom: { x: 0, y: -1 }, left: { x: 1, y: 0 } }[edge];
  const anchor = edge === 'top' ? { x: brick.x + brick.w / 2, y: brick.y + brick.h }
    : edge === 'bottom' ? { x: brick.x + brick.w / 2, y: brick.y }
      : edge === 'left' ? { x: brick.x + brick.w, y: brick.y + brick.h / 2 }
        : { x: brick.x, y: brick.y + brick.h / 2 };
  const center = { x: anchor.x + direction.x * catRadius, y: anchor.y + direction.y * catRadius };
  return { edge, anchor, center, direction, domeRadius: TURRET_DOME_RADIUS };
}

function middleBrickInGroup(owner, bricks, perimeter) {
  const ids = new Set(bricks.filter(brick => brick.id === owner.id || brick.absorbedBy === owner.id).map(brick => brick.id));
  if (ids.size < 2) return owner;
  const n = perimeter.length;
  const first = perimeter.findIndex((id, i) => ids.has(id) && !ids.has(perimeter[(i + n - 1) % n]));
  const start = first < 0 ? perimeter.indexOf(owner.id) : first;
  const chain = Array.from({ length: n }, (_, k) => perimeter[(start + k) % n]).filter(id => ids.has(id));
  // The perimeter runs clockwise, so even-sized groups use the clockwise middle sub-brick.
  return bricks[chain[Math.floor(chain.length / 2)]];
}

function brickEditRegions(bricks) {
  return new Map(bricks.map(brick => [brick.id, brick.region]));
}

function brickShape(parts, crumbly = false, wear = 0, bounds = null) {
  wear = crumbly ? Math.max(0, Math.min(1, wear)) : 0;
  const coordinates = axis => [...new Set(parts.flatMap(part =>
    [part[axis], part[axis] + part[axis === 'x' ? 'w' : 'h']].map(value => Math.round(value * 1e6) / 1e6)))].sort((a, b) => a - b);
  const xs = coordinates('x'), ys = coordinates('y');
  const x = bounds?.x ?? xs[0], y = bounds?.y ?? ys[0];
  const w = bounds?.w ?? xs.at(-1) - x, h = bounds?.h ?? ys.at(-1) - y;
  const edges = new Map();
  const edge = (a, b) => {
    const reverse = `${b}:${a}`;
    if (edges.has(reverse)) edges.delete(reverse);
    else edges.set(`${a}:${b}`, { a, b });
  };
  // Cancel shared cell edges so the outline contains no seams between absorbed bricks.
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      if (!parts.some(part => cx >= part.x && cx <= part.x + part.w && cy >= part.y && cy <= part.y + part.h)) continue;
      const a = `${i},${j}`, b = `${i + 1},${j}`, c = `${i + 1},${j + 1}`, d = `${i},${j + 1}`;
      edge(a, b); edge(b, c); edge(c, d); edge(d, a);
    }
  }
  const outgoing = new Map([...edges.values()].map(item => [item.a, item.b]));
  const point = key => {
    const [i, j] = key.split(',').map(Number);
    return [xs[i] - x, ys[j] - y];
  };
  let path = '';
  const polygon = [];
  const loops = [];
  const normalized = ([px, py]) => `${px / w} ${py / h}`;
  while (outgoing.size) {
    const start = outgoing.keys().next().value;
    let current = start;
    const loop = [point(start)];
    do {
      const next = outgoing.get(current);
      outgoing.delete(current);
      if (crumbly) {
        const [ax, ay] = point(current), [bx, by] = point(next);
        const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
        const mx = x + (ax + bx) / 2 - dy / length * .001;
        const my = y + (ay + by) / 2 + dx / length * .001;
        // A merged perimeter can be large while its solid rim stays thin.
        const thickness = Math.min(w, h, Math.max(...parts.filter(part =>
          mx >= part.x && mx <= part.x + part.w && my >= part.y && my <= part.y + part.h)
          .map(part => dx === 0 ? part.w : part.h)));
        const cuts = Math.max(1, Math.floor(length / 12));
        for (let i = 0; i < cuts; i++) {
          const variation = (Math.round(ax * 3 + ay * 5 + bx + by * 7) + i * 17) % 23;
          const depth = Math.min(
            (3.5 + variation % 7 * .85) * (1 + wear * (1.2 + variation % 4 * .6))
              + wear * thickness * (.12 + variation % 4 * .03),
            length / cuts * .48 + wear * thickness * .25,
            thickness * (.3 + wear * .14));
          const start = .04 + variation % 5 * .035;
          const tip = .3 + variation % 6 * .045;
          const end = .78 + variation % 4 * .05;
          const shoulder = depth * wear * (variation % 3) * .12;
          for (const [offset, inset] of [[start, shoulder], [tip, depth], [tip + .16, depth * (.2 + variation % 3 * .2)], [end, shoulder]]) {
            const t = (i + offset) / cuts;
            loop.push([ax + dx * t - dy / length * inset, ay + dy * t + dx / length * inset]);
          }
        }
      }
      loop.push(point(next));
      current = next;
    } while (current !== start);
    path += `M${loop.map(normalized).join('L')}Z`;
    loops.push(loop);
    // Double back along the bridge so even-odd clipping preserves holes in a full perimeter.
    if (polygon.length) polygon.push(loop[0]);
    polygon.push(...loop);
    if (polygon.length) polygon.push(polygon[0]);
  }
  let cracks = '';
  if (wear > 0) {
    for (const part of parts) {
      const vertical = part.h > part.w;
      const seed = Math.round(part.x * 3 + part.y * 7) % 11;
      const local = (along, across) => normalized([
        part.x - x + part.w * (vertical ? across : along),
        part.y - y + part.h * (vertical ? along : across),
      ]);
      for (let i = 0; i < 3; i++) {
        const along = Math.min(.73, .18 + i * .29 + seed * .003);
        const flip = i % 2 ? -1 : 1;
        const across = i % 2 ? 1 : 0;
        cracks += `M${local(along, across)}L${local(along - .06 * wear, across + flip * .28 * wear)}L${local(along + .07 * wear, across + flip * .54 * wear)}L${local(along - .03 * wear, across + flip * .92 * wear)}`;
        cracks += `M${local(along + .07 * wear, across + flip * .54 * wear)}L${local(along + .2 * wear, across + flip * .45 * wear)}L${local(along + .23 * wear, across + flip * .68 * wear)}`;
      }
    }
  }
  const clipPath = `polygon(evenodd, ${polygon.map(([px, py]) => `${px / w * 100}% ${py / h * 100}%`).join(', ')})`;
  let roundedPath = path, roundedClipPath = clipPath;
  if (!crumbly) {
    const roundedLoops = loops.map(loop => {
      const vertices = loop.slice(0, -1).filter((point, i, all) => {
        const previous = all[(i + all.length - 1) % all.length], next = all[(i + 1) % all.length];
        return (point[0] - previous[0]) * (next[1] - point[1]) !== (point[1] - previous[1]) * (next[0] - point[0]);
      });
      const radius = Math.min(6, Math.max(...parts.map(part => Math.min(part.w, part.h) / 4)));
      return vertices.flatMap((point, i) => {
        const previous = vertices[(i + vertices.length - 1) % vertices.length], next = vertices[(i + 1) % vertices.length];
        const before = Math.hypot(previous[0] - point[0], previous[1] - point[1]);
        const after = Math.hypot(next[0] - point[0], next[1] - point[1]);
        const r = Math.min(radius, before / 2, after / 2);
        const a = point.map((value, axis) => value + (previous[axis] - value) * r / before);
        const b = point.map((value, axis) => value + (next[axis] - value) * r / after);
        return Array.from({ length: 5 }, (_, step) => {
          const t = step / 4;
          return point.map((value, axis) => (1 - t) ** 2 * a[axis] + 2 * t * (1 - t) * value + t ** 2 * b[axis]);
        });
      });
    });
    roundedPath = roundedLoops.map(loop => `M${loop.map(normalized).join('L')}Z`).join('');
    const points = [];
    for (const loop of roundedLoops) {
      if (points.length) points.push(loop[0]);
      points.push(...loop, loop[0]);
      if (points.length) points.push(points[0]);
    }
    roundedClipPath = `polygon(evenodd, ${points.map(([px, py]) => `${px / w * 100}% ${py / h * 100}%`).join(', ')})`;
  }
  return { x, y, w, h, path, clipPath, roundedPath, roundedClipPath, cracks };
}

function brickInnerEdges(parts, width, height) {
  const shape = brickShape(parts);
  const { x, y, w, h } = shape;
  const edges = [];
  for (const loop of shape.path.split('M').slice(1)) {
    const vertices = loop.replace('Z', '').split('L').map(pair => pair.split(' ').map(Number))
      .map(([px, py]) => [px * w, py * h]);
    for (let i = 0; i < vertices.length - 1; i++) {
      const [ax, ay] = vertices[i], [bx, by] = vertices[i + 1];
      const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
      if (!length) continue;
      const mx = x + (ax + bx) / 2 - dy / length * .001;
      const my = y + (ay + by) / 2 + dx / length * .001;
      const touching = parts.filter(part =>
        mx >= part.x - 1e-6 && mx <= part.x + part.w + 1e-6 && my >= part.y - 1e-6 && my <= part.y + part.h + 1e-6);
      const inner = touching.some(part => {
        const edge = brickRegions([part], width, height).get(part.id).edge;
        return { top: dx < 0 && dy === 0, bottom: dx > 0 && dy === 0,
          left: dy > 0 && dx === 0, right: dy < 0 && dx === 0 }[edge];
      });
      if (!inner) continue;
      const thickness = Math.max(...touching.map(part => dx === 0 ? part.w : part.h));
      edges.push({ ax, ay, dx, dy, length, thickness });
    }
  }
  return { ...shape, edges };
}

function brickSlime(parts, width, height) {
  const { x, y, w, h, edges } = brickInnerEdges(parts, width, height);
  const point = (px, py) => `${px / w} ${py / h}`;
  let path = '';
  for (const { ax, ay, dx, dy, length, thickness } of edges) {
    const at = (t, inset) => point(ax + dx * t - dy / length * inset, ay + dy * t + dx / length * inset);
    const lobes = Math.max(1, Math.round(length / 28));
    const band = thickness * .08;
    path += `M${at(0, 0)}L${at(1, 0)}L${at(1, band)}`;
    for (let j = lobes - 1; j >= 0; j--) {
      const variation = (Math.round(x + ax + y + ay) + j * 7) % 5;
      const depth = Math.min(thickness * (.22 + variation * .05), length / lobes * .9);
      path += `Q${at((j + .78) / lobes, band)} ${at((j + .65) / lobes, depth)}`;
      path += `Q${at((j + .38) / lobes, depth * 1.15)} ${at((j + .24) / lobes, band)}`;
      path += `Q${at((j + .12) / lobes, band * .6)} ${at(j / lobes, band)}`;
    }
    path += 'Z';
  }
  return path;
}

function brickSpring(parts, width, height, compression = 0, depthScale = 1) {
  const { w, h, edges } = brickInnerEdges(parts, width, height);
  let platform = '', coils = '', grain = '', highlight = '';
  for (const { ax, ay, dx, dy, length, thickness } of edges) {
    const depth = Math.min(10, thickness * .32) * depthScale;
    const overhang = 3;
    const travel = Math.min(5, thickness * .18) * compression;
    const at = (t, inset) => `${(ax + dx * t - dy / length * inset) / w} ${(ay + dy * t + dx / length * inset) / h}`;
    const face = travel - overhang;
    platform += `M${at(0, face)}L${at(1, face)}L${at(1, face + depth)}L${at(0, face + depth)}Z`;
    highlight += `M${at(.01, face + 1)}L${at(.99, face + 1)}`;
    const segments = Math.max(1, Math.round(length / 38));
    for (let i = 0; i < segments; i++) {
      for (const row of [.38, .72]) {
        const inset = face + depth * row;
        grain += `M${at((i + .08) / segments, inset)}Q${at((i + .32) / segments, inset - depth * .13)} ${at((i + .52) / segments, inset)}`;
        grain += `T${at((i + .92) / segments, inset)}`;
      }
    }
    if (compression <= 0) continue;
    const count = Math.max(1, Math.round(length / 16));
    for (let i = 0; i < count; i++) {
      const center = (i + .5) / count;
      coils += `M${at(center, 0)}`;
      for (let j = 1; j <= 6; j++) {
        const offset = j === 6 ? 0 : (j % 2 ? 2 : -2) / length;
        coils += `L${at(center + offset, travel * j / 6)}`;
      }
    }
  }
  return { platform, coils, grain, highlight };
}

function spikeBrickBody(part, width, height) {
  const edge = brickRegions([part], width, height).get(part.id).edge;
  const depth = Math.min(14, (['top', 'bottom'].includes(edge) ? part.h : part.w) * .6);
  const body = { ...part };
  if (edge === 'top') body.h -= depth;
  if (edge === 'bottom') { body.y += depth; body.h -= depth; }
  if (edge === 'left') body.w -= depth;
  if (edge === 'right') { body.x += depth; body.w -= depth; }
  return body;
}

function mergeCollinearEdges(edges) {
  const merged = [];
  const joins = (a, b) => {
    const connected = Math.hypot(a.ax + a.dx - b.ax, a.ay + a.dy - b.ay) < 1e-6;
    const parallel = Math.abs(a.dx * b.dy - a.dy * b.dx) < 1e-6;
    const sameDirection = a.dx * b.dx + a.dy * b.dy > 0;
    return connected && parallel && sameDirection && Math.abs(a.thickness - b.thickness) < 1e-6;
  };
  const extend = (a, b) => {
    const previousLength = a.length;
    a.dx += b.dx;
    a.dy += b.dy;
    a.length = Math.hypot(a.dx, a.dy);
    a.spikeAnchors.push(...b.spikeAnchors.map(anchor => previousLength + anchor));
  };
  for (const edge of edges) {
    const current = { ...edge, spikeAnchors: edge.length < 16 ? [edge.length / 2] : [] };
    if (merged.length && joins(merged.at(-1), current)) extend(merged.at(-1), current);
    else merged.push(current);
  }
  if (merged.length > 1 && joins(merged.at(-1), merged[0])) {
    const last = merged.pop();
    extend(last, merged[0]);
    merged[0] = last;
  }
  return merged;
}

function brickSpikes(parts, width, height, crumbly = false, wear = 0) {
  const { x, y, w, h, edges } = brickInnerEdges(parts, width, height);
  const triangles = [];
  for (const { ax, ay, dx, dy, length, thickness, spikeAnchors } of mergeCollinearEdges(edges)) {
    const count = Math.floor(length / 16);
    if (!count) continue;
    const depth = Math.min(14, thickness * .6);
    const at = (t, offset) => [x + ax + dx * t + dy / length * offset, y + ay + dy * t - dx / length * offset];
    const margin = (length - count * 16) / 2;
    const candidates = spikeAnchors.length
      ? [...new Set(spikeAnchors.flatMap(anchor => {
        const first = Math.ceil((8 - anchor) / 16);
        const last = Math.floor((length - 8 - anchor) / 16);
        return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => anchor + (first + index) * 16);
      }))].sort((a, b) => a - b)
      : Array.from({ length: count }, (_, index) => margin + 8 + index * 16);
    const centers = [];
    for (const center of candidates) {
      if (!centers.length || center - centers.at(-1) >= 16 - 1e-6) centers.push(center);
    }
    for (const center of centers) {
      const start = (center - 8) / length;
      const end = (center + 8) / length;
      triangles.push([at(start, -depth), at(center / length, 0), at(end, -depth)]);
    }
  }
  const path = triangles.map(triangle => `M${triangle.map(([px, py]) => `${(px - x) / w} ${(py - y) / h}`).join('L')}Z`).join('');
  const body = brickShape(parts.map(part => spikeBrickBody(part, width, height)), crumbly, wear, { x, y, w, h });
  return { path, triangles, body };
}

const CONVEYOR_SPEED = 85;

function conveyorSurface(parts, width, height) {
  const shape = brickInnerEdges(parts, width, height);
  const rim = [];
  // Keep corner steps between arena-facing edges, but never connect through the outer rim.
  for (const loop of shape.path.split('M').slice(1)) {
    const vertices = loop.replace('Z', '').split('L').map(pair => pair.split(' ').map(Number))
      .map(([x, y]) => [x * shape.w, y * shape.h]);
    const contour = vertices.slice(0, -1).map(([ax, ay], i) => {
      const [bx, by] = vertices[i + 1], dx = bx - ax, dy = by - ay;
      const length = Math.hypot(dx, dy);
      const inner = shape.edges.some(edge => Math.abs(edge.ax - ax) < 1e-6 && Math.abs(edge.ay - ay) < 1e-6);
      const outer = parts.some(part => {
        if (!part.region) return false;
        const x = shape.x + (ax + bx) / 2, y = shape.y + (ay + by) / 2;
        return { top: dy === 0 && dx > 0 && Math.abs(y - part.y) < 1e-6,
          bottom: dy === 0 && dx < 0 && Math.abs(y - part.y - part.h) < 1e-6,
          left: dx === 0 && dy < 0 && Math.abs(x - part.x) < 1e-6,
          right: dx === 0 && dy > 0 && Math.abs(x - part.x - part.w) < 1e-6 }[brickRegions([part], width, height).get(part.id).edge];
      });
      return { ax, ay, dx, dy, length, thickness: Math.max(...parts.map(part => Math.min(part.w, part.h))), inner, outer };
    });
    for (let i = 0; i < contour.length; i++) {
      const edge = contour[i];
      if (edge.inner) { rim.push(edge); continue; }
      if (edge.outer) continue;
      const reachesInner = sign => {
        for (let step = 1; step < contour.length; step++) {
          const next = contour[(i + sign * step + contour.length) % contour.length];
          if (next.outer) return false;
          if (next.inner) return true;
        }
        return false;
      };
      if (reachesInner(-1) && reachesInner(1)) rim.push(edge);
    }
  }
  const edges = [];
  const joins = (a, b) => Math.abs(a.ax + a.dx - b.ax) < 1e-6 && Math.abs(a.ay + a.dy - b.ay) < 1e-6
    && a.dx / a.length === b.dx / b.length && a.dy / a.length === b.dy / b.length;
  const extend = (a, b) => {
    a.dx += b.dx; a.dy += b.dy; a.length += b.length;
    a.thickness = Math.max(a.thickness, b.thickness);
  };
  // Union outlines retain collinear vertices at absorbed brick/gap boundaries.
  for (const edge of rim) {
    if (edges.length && joins(edges.at(-1), edge)) extend(edges.at(-1), edge);
    else edges.push({ ...edge });
  }
  if (edges.length > 1 && joins(edges.at(-1), edges[0])) {
    const last = edges.pop();
    extend(last, edges[0]);
    edges[0] = last;
  }
  return { ...shape, edges };
}

function brickConveyor(parts, width, height, travel = 0, direction = 'clockwise') {
  const shape = conveyorSurface(parts, width, height);
  const { w, h, edges } = shape;
  const sign = direction === 'counterclockwise' ? -1 : 1;
  const point = (x, y) => `${x / w} ${y / h}`;
  let teeth = '', arrows = '';
  for (const loop of shape.path.split('M').slice(1)) {
    const vertices = loop.replace('Z', '').split('L').map(pair => pair.split(' ').map(Number))
      .map(([x, y]) => [x * w, y * h]);
    const segments = vertices.slice(0, -1).map(([x, y], i) => {
      const [bx, by] = vertices[i + 1];
      return { x, y, dx: bx - x, dy: by - y, length: Math.hypot(bx - x, by - y) };
    });
    const perimeter = segments.reduce((sum, edge) => sum + edge.length, 0);
    const count = Math.max(1, Math.round(perimeter / 7)), pitch = perimeter / count;
    for (let i = 0; i < count; i++) {
      let distance = ((i * pitch + sign * travel) % perimeter + perimeter) % perimeter;
      const edge = segments.find(edge => {
        if (distance < edge.length) return true;
        distance -= edge.length;
        return false;
      }) ?? segments.at(-1);
      const { x, y, dx, dy, length } = edge;
      const at = (along, inset) => point(x + dx / length * (distance + along) - dy / length * inset,
        y + dy / length * (distance + along) + dx / length * inset);
      teeth += `M${at(-1.5, -2)}L${at(1.5, -2)}L${at(1.5, 3)}L${at(-1.5, 3)}Z`;
    }
  }
  const arrowEdge = edges.reduce((longest, edge) => !longest || edge.length > longest.length ? edge : longest, null)
    ?? { dx: 1, dy: 0, length: 1, thickness: Math.min(w, h) };
  const centerX = w / 2, centerY = h / 2;
  const arrowLength = Math.min(Math.min(w, h) * .9, arrowEdge.thickness * .9, arrowEdge.length * .75);
  const arrowHead = arrowLength * .36;
  const shaft = arrowLength * .14, head = arrowLength * .34;
  const directionX = arrowEdge.dx / arrowEdge.length * sign;
  const directionY = arrowEdge.dy / arrowEdge.length * sign;
  const arrowPoints = [[-arrowLength / 2, -shaft], [arrowLength / 2 - arrowHead, -shaft],
    [arrowLength / 2 - arrowHead, -head], [arrowLength / 2, 0],
    [arrowLength / 2 - arrowHead, head], [arrowLength / 2 - arrowHead, shaft],
    [-arrowLength / 2, shaft]];
  arrows = `M${arrowPoints.map(([along, across]) => point(
    centerX + directionX * along - directionY * across,
    centerY + directionY * along + directionX * across,
  )).join('L')}Z`;
  return { belt: shape.path, teeth, arrows };
}

function brickRecharge(parts, bricks, perimeter, width, height) {
  const regions = brickRegions(bricks, width, height);
  const ids = new Set(parts.filter(part => part.sourceId !== undefined).map(part => part.sourceId));
  const first = perimeter.findIndex((id, i) => ids.has(id) && !ids.has(perimeter[(i + perimeter.length - 1) % perimeter.length]));
  const start = first < 0 ? 0 : first;
  const position = part => {
    const index = perimeter.indexOf(part.sourceId ?? part.afterId);
    return (index - start + perimeter.length) % perimeter.length + (part.sourceId === undefined ? .5 : 0);
  };
  const segments = [...parts].sort((a, b) => position(a) - position(b)).map(part => {
    let edge;
    if (part.sourceId !== undefined) edge = regions.get(part.sourceId).edge;
    else {
      const before = bricks.find(brick => brick.id === part.afterId);
      // Corner connectors run along the side after a horizontal brick, or before it.
      const vertical = part.x >= before.x && part.x + part.w <= before.x + before.w + 1e-6;
      edge = vertical ? (part.x < width / 2 ? 'left' : 'right') : (part.y < height / 2 ? 'top' : 'bottom');
    }
    return { part, direction: { top: 'right', right: 'bottom', bottom: 'left', left: 'top' }[edge],
      length: edge === 'top' || edge === 'bottom' ? part.w : part.h };
  });
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  let distance = 0;
  return segments.map(({ part, direction, length }) => {
    const segment = { part, direction, start: distance / total * 100, scale: total / length };
    distance += length;
    return segment;
  });
}

function makeBricks(portrait = false, scale = 1) {
  const bricks = [];
  const add = (x, y, w, h, kind = 'normal') =>
    bricks.push({ id: bricks.length, x, y, w, h, kind, readyAt: 0 });
  const width = HEIGHT, height = WIDTH;
  const inset = 8, gap = 8, thickness = portrait ? 45 / scale : 45;
  const columns = 5, rows = 8;
  const sideStart = inset + thickness + gap;
  const horizontal = (width - inset * 2 - gap * (columns - 1)) / columns;
  const vertical = (height - sideStart * 2 - gap * (rows - 1)) / rows;
  for (let i = 0; i < columns; i++) {
    add(inset + i * (horizontal + gap), inset, horizontal, thickness, i === 1 ? 'slow' : 'normal');
    add(inset + i * (horizontal + gap), height - inset - thickness, horizontal, thickness);
  }
  for (let i = 0; i < rows; i++) {
    add(inset, sideStart + i * (vertical + gap), thickness, vertical);
    add(width - inset - thickness, sideStart + i * (vertical + gap), thickness, vertical, i === 4 ? 'fast' : 'normal');
  }
  const regions = brickRegions(bricks, width, height);
  for (const brick of bricks) {
    brick.region = regions.get(brick.id);
    if (!portrait) {
      const { x, y, w, h } = brick;
      brick.x = height - y - h;
      brick.y = x;
      brick.w = h;
      brick.h = w;
    }
  }
  return bricks;
}

// Exact swept circle/rectangle contact, including rounded corner contacts.
function clipFirePolygon(polygon, signedDistance) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const da = signedDistance(a), db = signedDistance(b);
    if (da >= -1e-9) result.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

function firePoint(wave, side, radius, along) {
  const [nx, ny] = [[1, 0], [0, 1], [-1, 0], [0, -1]][side];
  return [wave.x + radius * (nx - ny * along), wave.y + radius * (ny + nx * along)];
}

function fireIntervals(wave, side) {
  let start = -1;
  const live = [];
  for (const [left, right] of wave.blocked[side]) {
    if (left > start + 1e-9) live.push([start, left]);
    start = Math.max(start, right);
  }
  if (start < 1 - 1e-9) live.push([start, 1]);
  return live;
}

function blockFireWave(wave, parts, previousRadius = 0, obstructions = []) {
  const polygons = parts.map(part => [[part.x, part.y], [part.x + part.w, part.y],
    [part.x + part.w, part.y + part.h], [part.x, part.y + part.h]]);
  for (const obstruction of obstructions) {
    const shape = OBJECTS[obstruction.type].obstruction;
    const { x, y, radius, width, height } = obstruction;
    if (shape === 'circle') {
      polygons.push(Array.from({ length: 128 }, (_, i) => {
        const angle = i * Math.PI / 64;
        return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
      }));
    } else if (shape === 'diamond') {
      polygons.push([[x, y - radius], [x + radius, y], [x, y + radius], [x - radius, y]]);
    } else {
      polygons.push([[x - width / 2, y - height / 2], [x + width / 2, y - height / 2],
        [x + width / 2, y + height / 2], [x - width / 2, y + height / 2]]);
    }
  }
  for (let side = 0; side < 4; side++) {
    const [nx, ny] = [[1, 0], [0, 1], [-1, 0], [0, -1]][side];
    const intervals = [...wave.blocked[side]];
    for (const points of polygons) {
      let polygon = points.map(([x, y]) => [(x - wave.x) * nx + (y - wave.y) * ny,
          -(x - wave.x) * ny + (y - wave.y) * nx]);
      for (const plane of [p => p[0] - p[1], p => p[0] + p[1],
        p => wave.radius + 3 - p[0], p => p[0] - Math.max(0, previousRadius - 3)]) {
        polygon = clipFirePolygon(polygon, plane);
      }
      if (!polygon.length) continue;
      if (polygon.some(([out, along]) => Math.abs(out) < 1e-9 && Math.abs(along) < 1e-9)) {
        intervals.push([-1, 1]); continue;
      }
      const angles = polygon.filter(([out]) => out > 1e-9).map(([out, along]) => along / out);
      if (angles.length) intervals.push([Math.max(-1, Math.min(...angles)), Math.min(1, Math.max(...angles))]);
    }
    const merged = [];
    for (const interval of intervals.sort((a, b) => a[0] - b[0])) {
      const last = merged[merged.length - 1];
      if (last && interval[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], interval[1]);
      else merged.push([...interval]);
    }
    wave.blocked[side] = merged;
  }
}

function fireTouchesCat(wave, previousRadius, cat, startX, startY) {
  for (let side = 0; side < 4; side++) {
    for (const [left, right] of fireIntervals(wave, side)) {
      const inner = Math.max(0, previousRadius - 3), outer = wave.radius + 3;
      const polygon = [firePoint(wave, side, inner, left), firePoint(wave, side, outer, left),
        firePoint(wave, side, outer, right), firePoint(wave, side, inner, right)];
      for (const triangle of [[polygon[0], polygon[1], polygon[2]], [polygon[0], polygon[2], polygon[3]]]) {
        const cross = triangle.map(([x, y], i) => {
          const [endX, endY] = triangle[(i + 1) % 3];
          return (endX - x) * (cat.y - y) - (endY - y) * (cat.x - x);
        });
        const area = (triangle[1][0] - triangle[0][0]) * (triangle[2][1] - triangle[0][1])
          - (triangle[1][1] - triangle[0][1]) * (triangle[2][0] - triangle[0][0]);
        if (Math.abs(area) > 1e-9 && (cross.every(n => n >= 0) || cross.every(n => n <= 0))) return true;
        if (triangle.some(([x, y], i) => distanceToSegment(cat.x, cat.y, x, y,
          ...triangle[(i + 1) % 3]) <= cat.radius)) return true;
        if (Math.abs(area) > 1e-9 && spikeContact(startX, startY, cat.x - startX,
          cat.y - startY, cat.radius, triangle) <= 1) return true;
      }
    }
  }
  return false;
}

function brickContact(x, y, dx, dy, radius, brick) {
  const { x: left, y: top, w, h } = brick.collisionBody ?? brick;
  const right = left + w, bottom = top + h;
  const hits = [];
  const side = (t, position, min, max) => {
    if (t >= -1e-9 && t <= 1 && position >= min && position <= max) hits.push(Math.max(0, t));
  };
  if (dx > 0) { const t = (left - radius - x) / dx; side(t, y + dy * t, top, bottom); }
  if (dx < 0) { const t = (right + radius - x) / dx; side(t, y + dy * t, top, bottom); }
  if (dy > 0) { const t = (top - radius - y) / dy; side(t, x + dx * t, left, right); }
  if (dy < 0) { const t = (bottom + radius - y) / dy; side(t, x + dx * t, left, right); }
  const a = dx * dx + dy * dy;
  if (a > 0) {
    for (const [cx, cy, sx, sy] of [[left, top, -1, -1], [right, top, 1, -1], [left, bottom, -1, 1], [right, bottom, 1, 1]]) {
      const ox = x - cx, oy = y - cy;
      const b = 2 * (ox * dx + oy * dy);
      const c = ox * ox + oy * oy - radius * radius;
      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0 || b >= 0) continue;
      const t = (-b - Math.sqrt(discriminant)) / (2 * a);
      if (t >= -1e-9 && t <= 1 && (x + dx * t - cx) * sx >= -1e-9 && (y + dy * t - cy) * sy >= -1e-9) {
        hits.push(Math.max(0, t));
      }
    }
  }
  return hits.length ? Math.min(...hits) : Infinity;
}

function circleTouchesBrick(x, y, radius, brick) {
  const body = brick.collisionBody ?? brick;
  const closestX = Math.max(body.x, Math.min(body.x + body.w, x));
  const closestY = Math.max(body.y, Math.min(body.y + body.h, y));
  return Math.hypot(x - closestX, y - closestY) <= radius + 1e-6;
}

function distanceToSegment(px, py, x, y, endX, endY) {
  const dx = endX - x, dy = endY - y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((px - x) * dx + (py - y) * dy) / length)) : 0;
  return Math.hypot(px - x - t * dx, py - y - t * dy);
}

function circleContact(x, y, dx, dy, radius) {
  const speedSquared = dx * dx + dy * dy;
  if (speedSquared < 1e-18) return Infinity;
  if (x * x + y * y < 1e-18) return 0;
  const approaching = x * dx + y * dy;
  if (approaching >= -1e-9) return Infinity;
  const gap = x * x + y * y - radius * radius;
  if (gap <= 1e-9) return 0;
  const discriminant = approaching * approaching - speedSquared * gap;
  return discriminant < 0 ? Infinity : (-approaching - Math.sqrt(discriminant)) / speedSquared;
}

function obstructionGeometry(obstruction) {
  const definition = OBJECTS[obstruction.type];
  if (definition.obstruction !== 'rectangle' && (obstruction.width !== undefined || obstruction.height !== undefined)) {
    const size = obstruction.width ?? obstruction.height;
    return { radius: size / 2, width: size, height: size };
  }
  const radius = obstruction.radius ?? definition.radius ?? OBSTRUCTION_RADIUS;
  const scale = radius / (definition.radius ?? OBSTRUCTION_RADIUS);
  return { radius, width: obstruction.width ?? (definition.width ? definition.width * scale : radius * 2),
    height: obstruction.height ?? (definition.height ? definition.height * scale : radius * 2) };
}

function obstructionSurface(x, y, obstruction) {
  let dx = x - obstruction.x, dy = y - obstruction.y;
  if (OBJECTS[obstruction.type].obstruction === 'circle') {
    const distance = Math.hypot(dx, dy);
    return { gap: distance - obstruction.radius, nx: distance ? dx / distance : -1, ny: distance ? dy / distance : 0 };
  }
  const diamond = OBJECTS[obstruction.type].obstruction === 'diamond';
  const u = diamond ? (dx + dy) / Math.SQRT2 : dx, v = diamond ? (dy - dx) / Math.SQRT2 : dy;
  const halfW = diamond ? obstruction.radius / Math.SQRT2 : obstruction.width / 2;
  const halfH = diamond ? halfW : obstruction.height / 2;
  dx = u - Math.max(-halfW, Math.min(halfW, u));
  dy = v - Math.max(-halfH, Math.min(halfH, v));
  let gap = Math.hypot(dx, dy), nx, ny;
  if (gap) { nx = dx / gap; ny = dy / gap; }
  else if (Math.abs(u) - halfW >= Math.abs(v) - halfH) { gap = Math.abs(u) - halfW; nx = Math.sign(u) || -1; ny = 0; }
  else { gap = Math.abs(v) - halfH; nx = 0; ny = Math.sign(v) || -1; }
  return diamond ? { gap, nx: (nx - ny) / Math.SQRT2, ny: (nx + ny) / Math.SQRT2 } : { gap, nx, ny };
}

function obstructionContact(x, y, dx, dy, radius, obstruction) {
  if (OBJECTS[obstruction.type].obstruction === 'circle') {
    return circleContact(x - obstruction.x, y - obstruction.y, dx, dy, radius + obstruction.radius);
  }
  if (OBJECTS[obstruction.type].obstruction === 'rectangle') {
    return brickContact(x, y, dx, dy, radius, { x: obstruction.x - obstruction.width / 2,
      y: obstruction.y - obstruction.height / 2, w: obstruction.width, h: obstruction.height });
  }
  const half = obstruction.radius / Math.SQRT2;
  return brickContact((x - obstruction.x + y - obstruction.y) / Math.SQRT2,
    (y - obstruction.y - x + obstruction.x) / Math.SQRT2,
    (dx + dy) / Math.SQRT2, (dy - dx) / Math.SQRT2, radius,
    { x: -half, y: -half, w: half * 2, h: half * 2 });
}

function spikeContact(x, y, dx, dy, radius, triangle) {
  let contact = Infinity;
  const orientation = Math.sign(triangle.reduce((sum, [ax, ay], i) => {
    const [bx, by] = triangle[(i + 1) % 3];
    return sum + ax * by - ay * bx;
  }, 0));
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = triangle[i], [bx, by] = triangle[(i + 1) % 3];
    const ex = bx - ax, ey = by - ay, length = Math.hypot(ex, ey);
    const nx = orientation * ey / length, ny = -orientation * ex / length;
    const speed = dx * nx + dy * ny;
    if (speed < 0) {
      const t = (radius - ((x - ax) * nx + (y - ay) * ny)) / speed;
      const along = ((x + dx * t - ax) * ex + (y + dy * t - ay) * ey) / length;
      if (t >= -1e-9 && t <= 1 && along >= 0 && along <= length) contact = Math.min(contact, Math.max(0, t));
    }
    const a = dx * dx + dy * dy, ox = x - ax, oy = y - ay;
    const b = 2 * (ox * dx + oy * dy), c = ox * ox + oy * oy - radius * radius;
    const discriminant = b * b - 4 * a * c;
    // Grazing a tip along the normal brick boundary must not stop movement.
    if (a > 0 && b < 0 && discriminant > a * 1e-7) {
      const t = (-b - Math.sqrt(discriminant)) / (2 * a);
      if (t >= -1e-9 && t <= 1) contact = Math.min(contact, Math.max(0, t));
    }
  }
  return contact;
}

function brickNormal(x, y, brick) {
  const dx = x - Math.max(brick.x, Math.min(brick.x + brick.w, x));
  const dy = y - Math.max(brick.y, Math.min(brick.y + brick.h, y));
  const distance = Math.hypot(dx, dy);
  return distance ? { x: dx / distance, y: dy / distance } : null;
}

function reflectVelocity(vx, vy, normal) {
  const incoming = vx * normal.x + vy * normal.y;
  return incoming < 0 ? { vx: vx - 2 * incoming * normal.x, vy: vy - 2 * incoming * normal.y } : { vx, vy };
}

function levelObjective(level) {
  const limit = level.activationLimit == null ? '' : `. Boom Helmet: ${level.activationLimit} activations; reaching zero is fatal`;
  if (level.survive) return `Survive for ${level.duration} seconds until the timer reaches zero${limit}`;
  const targets = [];
  if (level.goal > 0) targets.push(`Collect ${level.goal} food`);
  if (level.killGoal > 0) targets.push(`${targets.length ? 'earn' : 'Earn'} ${level.killGoal} enemy points`);
  if (level.goalsGoal > 0) targets.push(`${targets.length ? 'score' : 'Score'} ${level.goalsGoal} soccer goal${level.goalsGoal === 1 ? '' : 's'}`);
  return `${targets.join(' and ')} before time runs out (${level.duration} seconds)${limit}`;
}

function rotateToward(angle, target, maximum) {
  const difference = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
  return angle + Math.max(-maximum, Math.min(maximum, difference));
}

class Game {
  constructor(random = Math.random, { portrait = false, scale = 1, level = 0, customLevel = null, editorPreview = false, catBlockCollected = false } = {}) {
    if (customLevel) {
      this.customLevel = validateCustomLevel(customLevel, { allowUnpairedPortals: editorPreview });
      this.levelIndex = -1;
      this.level = { ...this.customLevel, heartCost: this.customLevel.heartCost ?? Infinity, food: [], enemies: [], weapons: [], items: [] };
      this.customEvents = [...this.customLevel.events].sort((a, b) => a.time - b.time);
    } else {
      if (!LEVELS[level]) throw new RangeError(`Unknown level: ${level}`);
      this.levelIndex = level;
      this.level = LEVELS[level];
      this.customEvents = [...(this.level.events ?? [])].sort((a, b) => a.time - b.time);
    }
    this.random = random;
    this.catBlockPreviouslyCollected = catBlockCollected;
    this.portrait = portrait;
    this.scale = scale;
    this.width = portrait ? HEIGHT : WIDTH;
    this.height = portrait ? WIDTH : HEIGHT;
    this.reset();
  }

  reset() {
    this.state = 'ready';
    this.elapsed = 0;
    this.timeBonus = 0;
    this.moves = 0;
    this.score = 0;
    this.enemies = 0;
    this.goals = 0;
    this.soccerBalls = [];
    this.bubbles = [];
    this.bubblePops = [];
    this.bumpers = [];
    this.obstructions = [];
    this.obstructionDestructions = [];
    this.goalEffects = [];
    this.activationsRemaining = this.level.activationLimit ?? null;
    this.boomHelmet = null;
    this.hearts = 3;
    this.keys = 0;
    this.catBlockCollected = this.catBlockPreviouslyCollected;
    this.catBlockEvents = [];
    this.tookDamage = false;
    this.invulnerableUntil = 0;
    this.nextEvent = 0;
    this.food = [];
    this.items = [];
    this.bricks = makeBricks(this.portrait, this.scale);
    this.brickRevision = 0;
    this.cat = { x: this.width / 2, y: this.height / 2, radius: 21, vx: 0, vy: 0 };
    this.catHistory = [{ time: 0, x: this.cat.x, y: this.cat.y }];
    this.tickStart = null;
    this.target = null;
    this.stuckUntil = 0;
    this.stuckColor = 'green';
    this.releasedAt = null;
    this.bubbleTrap = null;
    this.pickups = [];
    this.foodId = 0;
    this.robots = [];
    this.enemyDeaths = [];
    this.weapons = [];
    this.batteries = 0;
    this.sawStartedAt = null;
    this.brickDestructions = [];
    this.dittoStamp = false;
    this.dittoSource = null;
    this.brickStamps = [];
    this.paintBrush = null;
    this.paintTouching = new Set();
    this.barriers = [];
    this.spawnerTouching = new Set();
    this.activeTurret = null;
    this.turretFades = [];
    this.turretProjectiles = [];
    this.turretEffects = [];
    this.cookieActive = false;
    this.cookieLickUntil = 0;
    this.enemiesSleepUntil = 0;
    this.musicStreamStart = null;
    this.musicStreamUntil = 0;
    this.musicPickup = null;
    this.snailCooldownFreezeUntil = 0;
    this.snailStreamStart = null;
    this.snailStreamUntil = 0;
    this.snailStreamAge = 0;
    this.sunglassesStart = null;
    this.sunglassesUntil = 0;
    this.sunglassesPickup = null;
    this.capeStart = null;
    this.capeUntil = 0;
    this.capePickup = null;
    this.capeFlightMultiplier = 1;
    this.maskUntil = 0;
    this.maskPickup = null;
    this.healing = [];
    this.spikeTouching = new Set();
    this.conveyorRide = null;
    this.boosted = false;
    this.portalUntil = 0;
    this.portalArrival = null;
    this.portalTrips = 0;
    this.weapon = null;
    this.nextEnemy = 0;
    this.nextWeapon = 0;
    this.nextItem = 0;
    this.nextCustom = 0;
    this.pendingSpawns = new Map();
    this.nextHeart = this.level.heartCost;
    if (this.level.brickSet === 3) {
      for (const brick of this.bricks) brick.kind = 'normal';
      for (let i = 0; i < 3; i++) {
        this.bricks[Math.floor(i * this.bricks.length / 3)].kind = 'slow';
        this.bricks[Math.floor((i + .5) * this.bricks.length / 3)].kind = 'fast';
      }
    }
    applyBrickTypes(this.bricks, this.level.brickTypes);
    for (const brick of this.bricks) {
      brick.usesLeft = brick.crumbler ?? null;
      brick.absorbedBy = null;
      brick.initialOwner = null;
      brick.warpUntil = null;
      brick.hitAt = null;
      brick.hitNormal = null;
      brick.hitPoint = null;
      brick.toggleRemaining = brick.toggle ?? 0;
      brick.spawned = false;
    }
    applyBrickGroups(this.bricks, this.level.brickGroups);
    this.perimeter = brickPerimeter(this.bricks, this.width, this.height);
  }

  start() {
    if (this.state === 'ready') {
      this.state = 'playing';
      if (this.activationsRemaining !== null) this.boomHelmet = { age: 0, exploded: false };
      this.prepareSpawns();
      this.spawnCustomEvents();
    }
  }
  pause() { if (this.state === 'playing') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'playing'; }

  get invulnerable() { return this.invulnerableUntil > this.elapsed + 1e-9; }
  get timeLimit() { return this.level.duration + this.timeBonus; }
  get sunglassesActive() { return this.sunglassesStart !== null && this.elapsed < this.sunglassesUntil - 1e-9; }
  get maskActive() { return this.maskPickup !== null && this.elapsed < this.maskUntil - 1e-9; }
  get capeActive() { return this.capeStart !== null && this.elapsed < this.capeUntil - 1e-9; }

  setCapeSpeed(multiplier) {
    if (this.conveyorRide) {
      this.capeFlightMultiplier = 1;
      return;
    }
    const ratio = multiplier / this.capeFlightMultiplier;
    this.cat.vx *= ratio;
    this.cat.vy *= ratio;
    this.capeFlightMultiplier = multiplier;
  }

  brickSelectable(brick) {
    return !['cinder', 'goal'].includes(brick.kind) && brick.absorbedBy === null
      && (this.sunglassesActive || (brickEnabled(brick) && brick.usesLeft !== 0 && brick.readyAt <= this.elapsed + 1e-9));
  }

  get damageProgress() {
    return this.invulnerable ? 1 - (this.invulnerableUntil - this.elapsed) / DAMAGE_DURATION : null;
  }

  takeDamage() {
    if (this.state !== 'playing' || this.hearts <= 0 || this.invulnerable || this.activeTurret) return false;
    this.hearts--;
    this.tookDamage = true;
    this.invulnerableUntil = this.elapsed + DAMAGE_DURATION;
    return true;
  }

  get boostReady() {
    return ['playing', 'paused'].includes(this.state) && !this.cat.vx && !this.cat.vy
      && this.brickParts().some(part =>
        this.bricks[part.id].boost && this.touchingPart(part));
  }

  steer(id, x, y) {
    const brick = this.bricks.find(item => item.id === id);
    if (this.state !== 'playing' || this.activeTurret || this.bubbleTrap
      || this.stuckUntil > this.elapsed + 1e-9 || !brick || !this.brickSelectable(brick)) return false;
    const parts = this.brickParts();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !parts.some(part =>
      part.id === id && x >= part.x && x <= part.x + part.w && y >= part.y && y <= part.y + part.h)) return false;
    const dx = x - this.cat.x, dy = y - this.cat.y;
    const distance = Math.hypot(dx, dy);
    if (!distance) return false;
    const boost = this.boostReady;
    const speed = SPEED * (boost ? 2 : 1) * (this.capeActive ? CAPE_SPEED_MULTIPLIER : 1);
    const vx = dx / distance * speed, vy = dy / distance * speed;
    if (parts.some(part => brickContact(this.cat.x, this.cat.y, vx / 120, vy / 120, this.cat.radius, part) <= 1e-9)) return false;
    if (this.spikeParts(parts).some(({ triangle }) =>
      spikeContact(this.cat.x, this.cat.y, vx / 120, vy / 120, this.cat.radius, triangle) <= 1e-9)) return false;
    if (!this.sunglassesActive) {
      brick.readyAt = this.elapsed + COOLDOWNS[brick.kind]
        + Math.max(0, this.snailCooldownFreezeUntil - this.elapsed);
      if (brick.usesLeft !== null) brick.usesLeft--;
    }
    if (brick.warped) this.absorbNeighbor(brick);
    if (brick.barrier) {
      const fence = this.barriers.find(fence => fence.id === brick.id);
      if (fence) fence.extending = !fence.extending;
      else this.barriers.push({ id: brick.id, length: 0, extending: true });
    }
    for (const other of this.bricks) {
      if (!this.sunglassesActive && other.toggle && other.absorbedBy === null && (other.usesLeft !== 0 || other.id === id)) {
        other.toggleRemaining = other.toggleRemaining === 0 ? other.toggle : other.toggleRemaining - 1;
      }
    }
    this.boosted = boost;
    this.cat.vx = vx;
    this.cat.vy = vy;
    this.capeFlightMultiplier = this.capeActive ? CAPE_SPEED_MULTIPLIER : 1;
    this.conveyorRide = null;
    this.target = { x, y };
    this.moves++;
    if (this.activationsRemaining !== null && --this.activationsRemaining === 0) {
      this.boomHelmet.exploded = true;
      this.boomHelmet.age = 0;
      this.hearts = 0;
      this.cat.vx = 0; this.cat.vy = 0;
      this.boosted = false; this.target = null;
      this.state = 'lost';
    }
    return true;
  }

  brickParts() {
    const owner = brick => brick.absorbedBy ?? brick.id;
    const parts = this.bricks.map(brick => ({ x: brick.x, y: brick.y, w: brick.w, h: brick.h, id: owner(brick), sourceId: brick.id, region: brick.region }));
    for (let i = 0; i < this.perimeter.length; i++) {
      const a = this.bricks[this.perimeter[i]], b = this.bricks[this.perimeter[(i + 1) % this.perimeter.length]];
      if (owner(a) !== owner(b)) continue;
      const left = Math.max(a.x, b.x), right = Math.min(a.x + a.w, b.x + b.w);
      const top = Math.max(a.y, b.y), bottom = Math.min(a.y + a.h, b.y + b.h);
      // Fill only the perimeter gap, preserving an L-shaped union around corners.
      if (right > left) parts.push({ id: owner(a), afterId: a.id, x: left, y: Math.min(a.y + a.h, b.y + b.h), w: right - left, h: top - Math.min(a.y + a.h, b.y + b.h) });
      else if (bottom > top) parts.push({ id: owner(a), afterId: a.id, x: Math.min(a.x + a.w, b.x + b.w), y: top, w: left - Math.min(a.x + a.w, b.x + b.w), h: bottom - top });
    }
    return parts.map(part => this.bricks[part.id].spikes
      ? { ...part, collisionBody: spikeBrickBody(part, this.width, this.height) } : part);
  }

  touchingPart(part) {
    return circleTouchesBrick(this.cat.x, this.cat.y, this.cat.radius, part);
  }

  trajectory() {
    const { x, y, vx, vy, radius } = this.cat;
    const speed = Math.hypot(vx, vy);
    if (!speed || this.conveyorRide) return this.target ? [[x, y], [this.target.x, this.target.y]] : [];
    const parts = this.brickParts(), spikes = this.spikeParts(parts);
    if (this.obstructions.length) return this.obstructionTrajectory(parts, spikes);
    const distance = Math.hypot(this.width, this.height) * 2;
    const cast = (x, y, vx, vy) => {
      const length = Math.hypot(vx, vy);
      const dx = vx / length * distance, dy = vy / length * distance;
      let contact = Math.min(1,
        dx > 0 ? (this.width - radius - x) / dx : dx < 0 ? (radius - x) / dx : Infinity,
        dy > 0 ? (this.height - radius - y) / dy : dy < 0 ? (radius - y) / dy : Infinity);
      let contacts = [], bumpers = [];
      for (const part of parts) {
        const t = brickContact(x, y, dx, dy, radius, part);
        if (t < contact - 1e-9) { contact = t; contacts = [part]; }
        else if (t <= contact + 1e-9) contacts.push(part);
      }
      for (const spike of spikes) {
        const t = spikeContact(x, y, dx, dy, radius, spike.triangle);
        if (t < contact - 1e-9) { contact = t; contacts = [spike]; }
        else if (t <= contact + 1e-9) contacts.push(spike);
      }
      for (const bumper of this.bumpers) {
        const t = circleContact(x - bumper.x, y - bumper.y, dx, dy, radius + bumper.radius);
        if (t < contact - 1e-9) { contact = t; contacts = []; bumpers = [bumper]; }
        else if (t <= contact + 1e-9) bumpers.push(bumper);
      }
      return { x: x + dx * contact, y: y + dy * contact, contacts, bumpers };
    };
    const hit = cast(x, y, vx, vy);
    const points = [[x, y], [hit.x, hit.y]];
    // Springs and bumpers count equally: forecast only the first bounce from either.
    if ((!hit.contacts.length && !hit.bumpers.length)
      || !hit.contacts.every(part => this.bricks[part.id].springs)) {
      return this.target ? [[x, y], [this.target.x, this.target.y]] : points;
    }
    let reflected = { vx, vy }, start = { x: hit.x, y: hit.y };
    for (const part of hit.contacts) {
      const normal = brickNormal(hit.x, hit.y, part);
      if (normal) reflected = reflectVelocity(reflected.vx, reflected.vy, normal);
    }
    for (const bumper of hit.bumpers) {
      const gap = Math.hypot(start.x - bumper.x, start.y - bumper.y), length = Math.hypot(reflected.vx, reflected.vy);
      const normal = gap ? { x: (start.x - bumper.x) / gap, y: (start.y - bumper.y) / gap }
        : { x: -reflected.vx / length, y: -reflected.vy / length };
      if (reflected.vx * normal.x + reflected.vy * normal.y >= -1e-9) continue;
      reflected = reflectVelocity(reflected.vx, reflected.vy, normal);
      start = { x: bumper.x + normal.x * (radius + bumper.radius + .01), y: bumper.y + normal.y * (radius + bumper.radius + .01) };
    }
    if (start.x !== hit.x || start.y !== hit.y) points.push([start.x, start.y]);
    const end = cast(start.x, start.y, reflected.vx, reflected.vy);
    points.push([end.x, end.y]);
    return points;
  }

  obstructionTrajectory(parts, spikes) {
    const actor = { ...this.cat }, points = [[actor.x, actor.y]];
    const maxDistance = Math.hypot(this.width, this.height) * 2;
    let traveled = 0, reflections = 0;
    const append = () => {
      const point = [actor.x, actor.y], last = points.at(-1), before = points.at(-2);
      if (Math.hypot(point[0] - last[0], point[1] - last[1]) < 1e-5) return;
      if (before) {
        const ax = last[0] - before[0], ay = last[1] - before[1];
        const bx = point[0] - last[0], by = point[1] - last[1];
        if (ax * bx + ay * by > 0 && Math.abs(ax * by - ay * bx) < 1e-8) {
          points[points.length - 1] = point;
          return;
        }
      }
      points.push(point);
    };
    // Match gameplay's fixed substeps and position-only sliding, without ticking the live game.
    for (let step = 0; step < 4096 && traveled < maxDistance; step++) {
      const old = { x: actor.x, y: actor.y };
      const speed = Math.hypot(actor.vx, actor.vy);
      if (!speed) break;
      const dt = Math.min(1 / 120, (maxDistance - traveled) / speed);
      actor.x += actor.vx * dt; actor.y += actor.vy * dt;
      this.moveAroundObstructions(actor, old, true);
      const dx = actor.x - old.x, dy = actor.y - old.y;
      let contact = Math.min(1,
        dx > 0 ? (this.width - actor.radius - old.x) / dx : dx < 0 ? (actor.radius - old.x) / dx : Infinity,
        dy > 0 ? (this.height - actor.radius - old.y) / dy : dy < 0 ? (actor.radius - old.y) / dy : Infinity);
      let contacts = [], bumpers = [];
      const left = Math.min(old.x, actor.x) - actor.radius - 1e-7;
      const right = Math.max(old.x, actor.x) + actor.radius + 1e-7;
      const top = Math.min(old.y, actor.y) - actor.radius - 1e-7;
      const bottom = Math.max(old.y, actor.y) + actor.radius + 1e-7;
      for (const part of parts) {
        const body = part.collisionBody ?? part;
        if (body.x > right || body.x + body.w < left || body.y > bottom || body.y + body.h < top) continue;
        const time = brickContact(old.x, old.y, dx, dy, actor.radius, part);
        if (time < contact - 1e-9) { contact = time; contacts = [part]; }
        else if (time <= contact + 1e-9 && time <= 1) contacts.push(part);
      }
      for (const spike of spikes) {
        const time = spikeContact(old.x, old.y, dx, dy, actor.radius, spike.triangle);
        if (time < contact - 1e-9) { contact = time; contacts = [spike]; }
        else if (time <= contact + 1e-9 && time <= 1) contacts.push(spike);
      }
      for (const bumper of this.bumpers) {
        const time = circleContact(old.x - bumper.x, old.y - bumper.y, dx, dy, actor.radius + bumper.radius);
        if (time < contact - 1e-9) { contact = time; contacts = []; bumpers = [bumper]; }
        else if (time <= contact + 1e-9 && time <= 1) bumpers.push(bumper);
      }
      actor.x = old.x + dx * contact; actor.y = old.y + dy * contact;
      traveled += speed * dt;
      append();
      if (contacts.length) {
        if (reflections++ || !contacts.every(part => this.bricks[part.id].springs)) break;
        for (const part of contacts) {
          const normal = brickNormal(actor.x, actor.y, part);
          if (normal && actor.vx * normal.x + actor.vy * normal.y < 0) {
            Object.assign(actor, reflectVelocity(actor.vx, actor.vy, normal));
          }
        }
      } else if (bumpers.length) {
        if (reflections++) break;
        for (const bumper of bumpers) {
          const distance = Math.hypot(actor.x - bumper.x, actor.y - bumper.y);
          const normal = distance ? { x: (actor.x - bumper.x) / distance, y: (actor.y - bumper.y) / distance }
            : { x: -actor.vx / speed, y: -actor.vy / speed };
          if (actor.vx * normal.x + actor.vy * normal.y >= -1e-9) continue;
          Object.assign(actor, reflectVelocity(actor.vx, actor.vy, normal));
          actor.vx *= OBJECTS[bumper.type].speedMultiplier;
          actor.vy *= OBJECTS[bumper.type].speedMultiplier;
          actor.x = bumper.x + normal.x * (actor.radius + bumper.radius + .01);
          actor.y = bumper.y + normal.y * (actor.radius + bumper.radius + .01);
        }
        append();
      } else if (contact < 1 || Math.hypot(actor.x - old.x, actor.y - old.y) < 1e-5) break;
    }
    return points;
  }

  spawnFromBrick(brick) {
    const spawn = brick.spawner;
    brick.spawned = true;
    if (this.catBlockCollected && spawn.kind === 'item' && this.isCatBlockSource(spawn)) return;
    if (spawn.x !== undefined && spawn.y !== undefined) {
      const items = spawn.kind === 'heart' ? [this.campaignEventPoint(spawn.x, spawn.y)]
        : this.createCustomSpawn({ ...spawn, time: this.elapsed });
      if (spawn.kind === 'object' && OBJECTS[spawn.type].obstruction) {
        this.pendingSpawns.set({}, { kind: 'obstruction', time: this.elapsed + 2, duration: 2, items });
      } else {
        const target = spawn.kind === 'enemy' ? this.robots : spawn.kind === 'food' ? this.food
          : spawn.kind === 'weapon' ? this.weapons : spawn.kind === 'item' ? this.items : spawn.kind === 'heart' ? this.healing
            : OBJECTS[spawn.type].bumper ? this.bumpers : OBJECTS[spawn.type].bubble ? this.bubbles : this.soccerBalls;
        target.push(...items);
      }
      return;
    }
    if (spawn.kind === 'enemy') {
      const enemies = this.createEnemies([this.elapsed, spawn.type, 1, spawn.shield]);
      for (const enemy of enemies) this.initializeRoboKoshi(enemy, this.elapsed, this.cat);
      this.robots.push(...enemies);
    }
    else if (spawn.kind === 'heart') this.healing.push(this.randomPickupPoint());
    else if (spawn.kind === 'weapon') this.weapons.push(this.createCollectible(this.elapsed, spawn.type, spawn.lifetime));
    else if (spawn.kind === 'item') this.items.push(this.createCollectible(this.elapsed, spawn.type, spawn.lifetime));
    else if (spawn.kind === 'object') {
      const point = this.randomPoint();
      if (OBJECTS[spawn.type].bumper) this.bumpers.push(this.createBumper(point, spawn.type));
      else if (OBJECTS[spawn.type].bubble) this.bubbles.push(this.createBubble(point, spawn.type));
      else if (OBJECTS[spawn.type].obstruction) {
        const obstruction = this.createObstruction(point, spawn);
        this.pendingSpawns.set({}, { kind: 'obstruction', time: this.elapsed + 2, duration: 2, items: [obstruction] });
      }
      else this.soccerBalls.push(this.createSoccerBall(point));
    }
    else this.food.push({ ...this.randomPickupPoint(), id: this.foodId++, type: spawn.type,
      born: this.elapsed, lifetime: spawn.lifetime, expires: this.elapsed + spawn.lifetime });
  }

  touchSpawner(brick) {
    if (this.spawnerTouching.has(brick.id)) return;
    this.spawnerTouching.add(brick.id);
    if (brick.spawned && this.batteries > 0) {
      brick.spawned = false;
      this.batteries--;
    }
    if (!brick.spawned) this.spawnFromBrick(brick);
  }

  touchTurret(brick) {
    if (this.activeTurret || this.spawnerTouching.has(brick.id)) return;
    this.spawnerTouching.add(brick.id);
    if (brick.spawned && this.batteries > 0) {
      brick.spawned = false;
      this.batteries--;
    }
    if (brick.spawned) return;
    brick.spawned = true;
    const geometry = turretGeometry(middleBrickInGroup(brick, this.bricks, this.perimeter), this.width, this.height, this.cat.radius);
    this.activeTurret = {
      brickId: brick.id, type: brick.turret, ...geometry,
      aim: geometry.direction, remaining: TURRET_DURATION, shotsRemaining: TURRET_SHOTS,
      entry: { from: { x: this.cat.x, y: this.cat.y }, elapsed: 0 },
    };
    this.cat.vx = 0;
    this.cat.vy = 0;
    this.target = null;
    this.boosted = false;
    this.conveyorRide = null;
  }

  exitTurret() {
    if (!this.activeTurret) return;
    const turret = this.activeTurret;
    this.turretFades.push({ ...turret, age: 0 });
    this.cat.vx = 0;
    this.cat.vy = 0;
    this.target = null;
    this.activeTurret = null;
    for (const enemy of this.robots) enemy.touching = false;
  }

  fireTurretAt(x, y) {
    const turret = this.activeTurret;
    if (this.state !== 'playing' || !turret || !Number.isFinite(x) || !Number.isFinite(y)
      || turret.entry || turret.shotsRemaining <= 0) return false;
    const pivot = {
      x: turret.anchor.x + turret.direction.x * turret.domeRadius,
      y: turret.anchor.y + turret.direction.y * turret.domeRadius,
    };
    const dx = x - pivot.x, dy = y - pivot.y, distance = Math.hypot(dx, dy);
    const direction = distance > 1e-9 ? { x: dx / distance, y: dy / distance } : turret.direction;
    turret.aim = direction;
    turret.shotsRemaining--;
    const start = {
      x: pivot.x + direction.x * Math.min(34, distance),
      y: pivot.y + direction.y * Math.min(34, distance),
    };
    if (turret.type === 'laser') {
      const distances = [
        direction.x > 0 ? (this.width - start.x) / direction.x : direction.x < 0 ? -start.x / direction.x : Infinity,
        direction.y > 0 ? (this.height - start.y) / direction.y : direction.y < 0 ? -start.y / direction.y : Infinity,
      ];
      const range = Math.max(0, Math.min(...distances));
      const end = { x: start.x + direction.x * range, y: start.y + direction.y * range };
      for (const enemy of [...this.robots]) {
        if (distanceToSegment(enemy.x, enemy.y, start.x, start.y, end.x, end.y) <= enemy.radius + 3) {
          this.damageTurretEnemy(enemy);
        }
      }
      this.turretEffects.push({ type: 'laser', start, end, age: 0 });
    } else {
      const target = { x, y };
      const travel = Math.hypot(target.x - start.x, target.y - start.y);
      if (travel < 1e-9) this.detonateTurretFireball(start);
      else this.turretProjectiles.push({ x: start.x, y: start.y, target,
        direction, remaining: travel, age: 0 });
    }
    if (turret.shotsRemaining === 0) this.exitTurret();
    return true;
  }

  damageTurretEnemy(enemy) {
    if (this.enemyDamageProgress(enemy) !== null || !this.robots.includes(enemy)) return;
    if (enemy.shield) {
      enemy.shield = SHIELDS[enemy.shield].next;
      enemy.invulnerableUntil = this.elapsed + DAMAGE_DURATION;
    } else {
      this.defeatEnemy(enemy);
      this.robots = this.robots.filter(candidate => candidate !== enemy);
    }
  }

  detonateTurretFireball(point) {
    this.turretEffects.push({ type: 'fireball', x: point.x, y: point.y, age: 0 });
    for (const enemy of [...this.robots]) {
      if (Math.hypot(enemy.x - point.x, enemy.y - point.y) <= TURRET_BLAST_RADIUS + enemy.radius) {
        this.damageTurretEnemy(enemy);
      }
    }
    this.obstructions = this.obstructions.filter(obstruction => {
      if (!obstruction.destructible || obstructionSurface(point.x, point.y, obstruction).gap > TURRET_BLAST_RADIUS + 1e-9) return true;
      this.obstructionDestructions.push({ ...obstruction, age: 0, duration: 1.2 });
      return false;
    });
  }

  updateObstructionDestructions(seconds) {
    this.obstructionDestructions = this.obstructionDestructions.filter(effect => {
      effect.age += seconds;
      return effect.age < effect.duration - 1e-9;
    });
  }

  updateTurrets(seconds) {
    this.turretFades = this.turretFades.filter(turret => {
      turret.age += seconds;
      return turret.age < .4;
    });
    this.turretEffects = this.turretEffects.filter(effect => {
      effect.age += seconds;
      return effect.age < (effect.type === 'laser' ? .18 : .42);
    });
    this.turretProjectiles = this.turretProjectiles.filter(projectile => {
      projectile.age += seconds;
      const distance = Math.min(projectile.remaining, TURRET_FIREBALL_SPEED * seconds);
      const end = { x: projectile.x + projectile.direction.x * distance,
        y: projectile.y + projectile.direction.y * distance };
      let hit = null, hitDistance = Infinity;
      for (const enemy of this.robots) {
        if (distanceToSegment(enemy.x, enemy.y, projectile.x, projectile.y, end.x, end.y) > enemy.radius + 6) continue;
        const along = Math.max(0, (enemy.x - projectile.x) * projectile.direction.x
          + (enemy.y - projectile.y) * projectile.direction.y);
        if (along < hitDistance) { hit = enemy; hitDistance = along; }
      }
      if (hit) {
        const impact = { x: projectile.x + projectile.direction.x * Math.min(distance, hitDistance),
          y: projectile.y + projectile.direction.y * Math.min(distance, hitDistance) };
        this.detonateTurretFireball(impact);
        return false;
      }
      projectile.x = end.x;
      projectile.y = end.y;
      projectile.remaining -= distance;
      if (projectile.remaining <= 1e-9) {
        this.detonateTurretFireball(projectile.target);
        return false;
      }
      return true;
    });
    if (this.activeTurret) {
      const turret = this.activeTurret;
      let activeSeconds = seconds;
      if (turret.entry) {
        const remainingEntry = TURRET_ENTRY_DURATION - turret.entry.elapsed;
        const entryStep = Math.min(seconds, remainingEntry);
        turret.entry.elapsed += entryStep;
        const progress = Math.min(1, turret.entry.elapsed / TURRET_ENTRY_DURATION);
        this.cat.x = turret.entry.from.x + (turret.center.x - turret.entry.from.x) * progress;
        this.cat.y = turret.entry.from.y + (turret.center.y - turret.entry.from.y) * progress;
        activeSeconds -= entryStep;
        if (progress >= 1) delete turret.entry;
      }
      if (!turret.entry) turret.remaining = Math.max(0, turret.remaining - activeSeconds);
      if (!turret.entry && turret.remaining <= 1e-9) this.exitTurret();
    }
  }

  portalExit(brick, parts = this.brickParts()) {
    const exitBrick = middleBrickInGroup(brick, this.bricks, this.perimeter);
    const edge = brickRegions(this.bricks, this.width, this.height).get(exitBrick.id).edge;
    const direction = { top: [0, 1], right: [-1, 0], bottom: [0, -1], left: [1, 0] }[edge];
    const markerX = exitBrick.x + exitBrick.w / 2;
    const markerY = exitBrick.y + exitBrick.h / 2;
    const normalOffset = (direction[0] ? exitBrick.w : exitBrick.h) / 2 + this.cat.radius + .01;
    const exit = {
      x: markerX + direction[0] * normalOffset,
      y: markerY + direction[1] * normalOffset,
      nx: direction[0], ny: direction[1], markerX, markerY,
    };
    const tangent = direction[0] ? { x: 0, y: Math.sign(this.height / 2 - markerY) }
      : { x: Math.sign(this.width / 2 - markerX), y: 0 };
    const maxDistance = Math.abs(tangent.x ? this.width / 2 - markerX : this.height / 2 - markerY);
    const blocked = distance => parts.some(part => circleTouchesBrick(
      exit.x + tangent.x * distance, exit.y + tangent.y * distance, this.cat.radius, part));
    if (!blocked(0) || !maxDistance) return exit;
    let clearDistance = null;
    for (let distance = 1; distance <= maxDistance; distance++) {
      if (!blocked(distance)) { clearDistance = distance; break; }
    }
    if (clearDistance === null) return exit;
    let low = clearDistance - 1, high = clearDistance;
    for (let i = 0; i < 20; i++) {
      const middle = (low + high) / 2;
      if (blocked(middle)) low = middle;
      else high = middle;
    }
    const offset = high + .001;
    exit.x += tangent.x * offset;
    exit.y += tangent.y * offset;
    exit.markerX += tangent.x * offset;
    exit.markerY += tangent.y * offset;
    return exit;
  }

  travelPortal(brick, parts) {
    if (this.elapsed < this.portalUntil || this.portalArrival === brick.id) return false;
    const destination = this.bricks.find(other => other.id !== brick.id && other.portal === brick.portal && other.absorbedBy === null);
    if (!destination) return false;
    const exit = this.portalExit(destination, parts);
    const speed = Math.hypot(this.cat.vx, this.cat.vy) || SPEED * this.capeFlightMultiplier;
    this.cat.x = exit.x; this.cat.y = exit.y;
    this.cat.vx = exit.nx * speed;
    this.cat.vy = exit.ny * speed;
    this.portalUntil = this.elapsed + .2;
    this.portalArrival = destination.id;
    this.portalTrips++;
    this.conveyorRide = null;
    this.setCapeSpeed(this.capeActive ? CAPE_SPEED_MULTIPLIER : 1);
    this.target = null;
    return true;
  }

  spikeParts(parts) {
    return this.bricks.filter(brick => brick.spikes && brick.absorbedBy === null).flatMap(brick =>
      brickSpikes(parts.filter(part => part.id === brick.id), this.width, this.height).triangles
        .map(triangle => ({ id: brick.id, triangle })));
  }

  conveyorEdge(id, parts) {
    const brick = this.bricks[id];
    if (!brick?.conveyor || brick.absorbedBy !== null) return null;
    const members = parts.filter(part => part.id === id);
    const radius = this.cat.radius;
    // Offset the union before tracing it so concave corners and unequal brick thicknesses stay clear.
    const shape = conveyorSurface(members.map(part => ({ ...part, x: part.x - radius, y: part.y - radius,
      w: part.w + radius * 2, h: part.h + radius * 2 })), this.width, this.height);
    const sign = brick.conveyorDirection === 'counterclockwise' ? -1 : 1;
    const connected = (a, b) => Math.abs(a.ax + a.dx - b.ax) < 1e-5 && Math.abs(a.ay + a.dy - b.ay) < 1e-5;
    for (const edge of shape.edges) {
      const tx = edge.dx / edge.length, ty = edge.dy / edge.length;
      const start = shape.edges.some(other => other !== edge && connected(other, edge)) ? 0 : radius;
      const end = shape.edges.some(other => other !== edge && connected(edge, other)) ? edge.length : edge.length - radius;
      const ax = shape.x + edge.ax + tx * start, ay = shape.y + edge.ay + ty * start;
      const length = end - start;
      const along = (this.cat.x - ax) * tx + (this.cat.y - ay) * ty;
      const outside = (this.cat.x - ax) * ty - (this.cat.y - ay) * tx;
      if (Math.abs(outside) < 1e-5 && along >= -1e-6 && along <= length + 1e-6
        && (sign > 0 ? length - along : along) > 1e-6) {
        return { ax, ay, tx, ty, length, along };
      }
    }
    return null;
  }

  absorbNeighbor(brick) {
    const candidates = new Set();
    for (let i = 0; i < this.perimeter.length; i++) {
      const member = this.bricks[this.perimeter[i]];
      if (member.id !== brick.id && member.absorbedBy !== brick.id) continue;
      for (const offset of [-1, 1]) {
        const neighbor = this.bricks[this.perimeter[(i + offset + this.perimeter.length) % this.perimeter.length]];
        const owner = neighbor.absorbedBy ?? neighbor.id;
        if (owner !== brick.id && !['cinder', 'goal'].includes(this.bricks[owner].kind)) candidates.add(owner);
      }
    }
    if (!candidates.size) return;
    const ids = [...candidates];
    const neighbor = this.bricks[ids[Math.floor(this.random() * ids.length)]];
    for (const member of this.bricks) {
      if (member.id === neighbor.id || member.absorbedBy === neighbor.id) member.absorbedBy = brick.id;
    }
    neighbor.warpUntil = null;
    if (brick.warpUntil === null) brick.warpUntil = this.elapsed + brick.warped;
    this.brickRevision++;
  }

  restoreWarps() {
    for (const brick of this.bricks) {
      if (brick.usesLeft === 0 || brick.warpUntil === null || brick.warpUntil > this.elapsed + 1e-9) continue;
      for (const member of this.bricks) if (member.absorbedBy === brick.id) member.absorbedBy = member.initialOwner ?? null;
      brick.warpUntil = null;
      this.brickRevision++;
    }
  }

  prepareSpawns() {
    const prepare = (events, index, kind, create, timeOf = event => event[0]) => {
      for (let i = index; i < events.length; i++) {
        const event = events[i], time = timeOf(event);
        if (time > this.elapsed + 2 + 1e-9) break;
        const duration = event.kind === 'object' && OBJECTS[event.type]?.obstruction ? 2 : 1;
        if (time > this.elapsed + duration + 1e-9) continue;
        if (!this.pendingSpawns.has(event)) this.pendingSpawns.set(event, { kind: kind ?? event.kind, time, duration, items: this.availableSpawns(create(event)) });
      }
    };
    prepare(this.customEvents, this.nextCustom, null, event => this.createCustomSpawn(event), event => event.time);
    prepare(this.level.food, this.nextEvent, 'food', event => this.createFood(event));
    prepare(this.level.enemies, this.nextEnemy, 'enemy', event => this.createEnemies(event));
    prepare(this.level.weapons, this.nextWeapon, 'weapon', ([time, type, lifetime]) => [this.createCollectible(time, type, lifetime)]);
    prepare(this.level.items ?? [], this.nextItem, 'item', ([time, type, lifetime]) => [this.createCollectible(time, type, lifetime)]);
  }

  get spawnCues() {
    return [...this.pendingSpawns.values()].flatMap(({ kind, time, duration = 1, items }) => {
      if (time <= this.elapsed + 1e-9) return [];
      const progress = Math.max(0, Math.min(1, (this.elapsed - (time - duration)) / duration));
      return items.map(item => ({ kind, x: item.x, y: item.y, progress,
        ...(OBJECTS[item.type]?.obstruction ? { obstruction: item } : {}) }));
    });
  }

  takeSpawn(event, create) {
    const pending = this.pendingSpawns.get(event);
    this.pendingSpawns.delete(event);
    const items = this.availableSpawns(pending ? pending.items : create(event));
    if (Array.isArray(event)) {
      for (const item of items) {
        if (needsBrickSpawnClearance(item.type) && !this.stampSpawnClear(item)) {
          Object.assign(item, this.randomStampPoint());
        }
      }
    }
    return items;
  }

  spawn(event) {
    this.food.push(...this.takeSpawn(event, entry => this.createFood(entry)));
  }

  createFood([time, method, type, lifetime]) {
    const count = method === 'S' ? 1 : Number(method.slice(1));
    const margin = 8 + 45 / this.scale + 35;
    const crowd = this.collectiblePoints();
    if (method === 'S' || method.startsWith('R')) {
      const points = [];
      const bounds = { left: margin, top: margin, right: this.width - margin, bottom: this.height - margin };
      for (let i = 0; i < count; i++) {
        points.push(this.findRandomSpawnPoint(bounds, [...crowd, ...points], SPAWN_SPACING));
      }
      return points.map(point => ({ ...point, id: this.foodId++, type, born: time, expires: time + lifetime, lifetime }));
    }
    // Line and circle patterns stay whole within the wider fallback area.
    const reach = method.startsWith('L') ? (count - 1) / 2 * 55 : method.startsWith('C') ? 88 : 0;
    const layout = wide => {
      const angle = this.random() * Math.PI * 2;
      const b = this.bounds();
      const center = wide
        ? { x: b.left + reach + this.random() * Math.max(0, b.right - b.left - 2 * reach),
          y: b.top + reach + this.random() * Math.max(0, b.bottom - b.top - 2 * reach) }
        : this.portrait
          ? { x: margin + 88 + this.random() * (this.width - 2 * (margin + 88)), y: margin + 88 + this.random() * (this.height - 2 * (margin + 88)) }
          : { x: 240 + this.random() * 480, y: 205 + this.random() * 190 };
      const points = [];
      for (let i = 0; i < count; i++) {
        let x = center.x, y = center.y;
        if (method.startsWith('L')) {
          const offset = (i - (count - 1) / 2) * 55;
          x += Math.cos(angle) * offset;
          y += Math.sin(angle) * offset;
        } else if (method.startsWith('C')) {
          const theta = angle + i * Math.PI * 2 / count;
          x += Math.cos(theta) * 88;
          y += Math.sin(theta) * 88;
        }
        points.push({ x, y });
      }
      return points;
    };
    // Patterned food keeps its shape but moves the whole pattern away from other pickups,
    // widening from the central zone to the full play area when the center is crowded.
    let points = null, bestGap = -Infinity;
    for (let attempt = 0; attempt < 160; attempt++) {
      const candidate = layout(attempt >= 32);
      const gap = Math.min(...candidate.map(point => nearestGap(point, crowd)));
      if (gap > bestGap) { points = candidate; bestGap = gap; }
      if (gap >= SPAWN_SPACING) break;
    }
    return points.map(({ x, y }) => ({ id: this.foodId++, x, y, type, born: time, expires: time + lifetime, lifetime }));
  }

  // Live and queued pickups that new random pickup spawns keep their distance from.
  collectiblePoints() {
    const pending = [...this.pendingSpawns.values()]
      .filter(spawn => ['food', 'item', 'weapon', 'heart'].includes(spawn.kind)).flatMap(spawn => spawn.items);
    return [...this.food, ...this.items, ...this.weapons, ...this.healing, ...pending];
  }

  bounds() {
    const inset = 8 + 45 / this.scale + 25;
    return {
      left: inset, top: inset, right: this.width - inset, bottom: this.height - inset,
    };
  }

  randomPoint(isSafe = null, spacing = 0) {
    return this.findRandomSpawnPoint(this.bounds(), spacing ? this.collectiblePoints() : [], spacing, isSafe);
  }

  findRandomSpawnPoint(b, crowd, spacing, isSafe = null) {
    let best = null, bestGap = -Infinity;
    const consider = point => {
      if (isSafe && !isSafe(point)) return false;
      const gap = nearestGap(point, crowd);
      if (best === null || gap > bestGap) { best = point; bestGap = gap; }
      return gap >= spacing;
    };
    for (let attempt = 0; attempt < (spacing ? 160 : 64); attempt++) {
      const point = { x: b.left + this.random() * (b.right - b.left), y: b.top + this.random() * (b.bottom - b.top) };
      if (consider(point)) return point;
    }
    // Search the whole area before accepting reduced spacing, even with repeated random values.
    const columns = Math.max(1, Math.ceil((b.right - b.left) / 8));
    const rows = Math.max(1, Math.ceil((b.bottom - b.top) / 8));
    for (let row = 0; row <= rows; row++) {
      for (let column = 0; column <= columns; column++) {
        const point = { x: b.left + column / columns * (b.right - b.left),
          y: b.top + row / rows * (b.bottom - b.top) };
        if (consider(point)) return point;
      }
    }
    if (best) {
      // Refine the roomiest grid candidate rather than stacking on a failed random sample.
      for (let step = 4; step >= .125; step /= 2) {
        const center = best;
        for (const dx of [-step, 0, step]) for (const dy of [-step, 0, step]) {
          consider({ x: Math.max(b.left, Math.min(b.right, center.x + dx)),
            y: Math.max(b.top, Math.min(b.bottom, center.y + dy)) });
        }
      }
      return best;
    }
    throw new RangeError('No safe random spawn location is available.');
  }

  stampSpawnClear(point, parts = this.brickParts()) {
    const clearance = DITTO_STAMP_RADIUS + this.cat.radius * 4;
    return parts.every(part => Math.hypot(
      point.x - Math.max(part.x, Math.min(part.x + part.w, point.x)),
      point.y - Math.max(part.y, Math.min(part.y + part.h, point.y))) >= clearance);
  }

  randomStampPoint(spacing = SPAWN_SPACING) {
    const parts = this.brickParts();
    return this.randomPoint(point => this.stampSpawnClear(point, parts), spacing);
  }

  randomPickupPoint() {
    return this.randomPoint(null, SPAWN_SPACING);
  }

  pointFromRelative(x, y) {
    const b = this.bounds();
    return { x: b.left + x * (b.right - b.left), y: b.top + y * (b.bottom - b.top) };
  }

  campaignEventCoordinates(x, y) {
    return this.levelIndex >= 0 && !this.portrait ? { x: 1 - y, y: x } : { x, y };
  }

  campaignEventPoint(x, y) {
    const position = this.campaignEventCoordinates(x, y);
    return this.pointFromRelative(position.x, position.y);
  }

  spawnCustomEvents() {
    const appearing = [];
    while (this.nextCustom < this.customEvents.length && this.customEvents[this.nextCustom].time <= this.elapsed + 1e-9) {
      const event = this.customEvents[this.nextCustom++];
      const target = event.kind === 'food' ? this.food : event.kind === 'weapon' ? this.weapons : event.kind === 'item' ? this.items
        : event.kind === 'object' ? OBJECTS[event.type].bumper ? this.bumpers
          : OBJECTS[event.type].bubble ? this.bubbles : OBJECTS[event.type].obstruction ? this.obstructions : this.soccerBalls : this.robots;
      const items = this.takeSpawn(event, entry => this.createCustomSpawn(entry));
      if (event.kind === 'enemy') {
        const spawn = this.tickStart ?? { time: this.elapsed, x: this.cat.x, y: this.cat.y };
        for (const enemy of items) this.initializeRoboKoshi(enemy, spawn.time, spawn);
      }
      target.push(...items);
      if (target === this.obstructions) appearing.push(...items);
    }
    for (const obstruction of appearing) this.clearAppearingObstruction(obstruction);
  }

  createCustomSpawn(event) {
    if (this.catBlockCollected && event.kind === 'item' && this.isCatBlockSource(event)) return [];
    let { x, y } = this.campaignEventCoordinates(event.x, event.y);
    if (event.kind === 'enemy' && ['wheel', 'snake', 'robo-cow'].includes(event.type)) ({ x, y } = snapWheel(x, y));
    const point = this.pointFromRelative(x, y);
    if (event.kind === 'food') return [{ ...point, id: this.foodId++, type: event.type, born: event.time, expires: event.time + event.lifetime, lifetime: event.lifetime }];
    if (event.kind === 'weapon' || event.kind === 'item') {
      const collectible = this.createCollectible(event.time, event.type, event.lifetime, point);
      if (event.type === 'treasure-chest') collectible.keysRequired = event.keysRequired ?? 1;
      return [collectible];
    }
    if (event.kind === 'object') return [OBJECTS[event.type].bumper
      ? this.createBumper(point, event.type) : OBJECTS[event.type].bubble
        ? this.createBubble(point, event.type) : OBJECTS[event.type].obstruction
          ? this.createObstruction(point, event) : this.createSoccerBall(point)];
    const enemy = { ...point, type: event.type, radius: event.type === 'robo-cow' ? 26 : 19,
      carriesCatBlock: !this.catBlockCollected && event.carriesCatBlock === true,
      ...(event.carriesKey ? { carriesKey: true } : {}),
      phase: this.random() * Math.PI * 2, age: 0, touching: false, distance: 0 };
    this.initializeShield(enemy, event.shield);
    this.initializeRoboKoshi(enemy, this.elapsed, this.cat);
    if (event.type === 'ram') this.initializeRam(enemy);
    if (event.type === 'bucket') this.initializeBucket(enemy);
    if (event.type === 'jackolantern') this.initializeJackolantern(enemy);
    if (event.type === 'goalie') this.initializeGoalie(enemy);
    if (['wheel', 'snake', 'robo-cow'].includes(event.type)) {
      const b = this.bounds(), w = b.right - b.left, h = b.bottom - b.top;
      if (event.type === 'robo-cow') enemy.distance = this.perimeterPosition(point);
      else if (y === 0) enemy.distance = x * w;
      else if (x === 1) enemy.distance = w + y * h;
      else if (y === 1) enemy.distance = w + h + (1 - x) * w;
      else enemy.distance = 2 * w + h + (1 - y) * h;
      this.placeWheel(enemy);
    }
    if (event.type === 'robo-cow') this.initializeRoboCow(enemy);
    if (event.type === 'robo-unicorn') this.initializeRoboUnicorn(enemy);
    return [enemy];
  }

  createCollectible(time, type, lifetime, point = needsBrickSpawnClearance(type) ? this.randomStampPoint() : this.randomPickupPoint()) {
    return { ...point, type, ...(lifetime == null ? {} : { born: time, lifetime, expires: time + lifetime }) };
  }

  createSoccerBall(point) {
    return { ...point, type: 'soccer-ball', radius: 16, vx: 0, vy: 0, angle: 0 };
  }

  createBubble(point, type) {
    return { ...point, type, color: OBJECTS[type].bubbleColor, radius: 24 };
  }

  createBumper(point, type) {
    return { ...point, type, radius: 48, hitAt: -Infinity, hitNormal: null };
  }

  createObstruction(point, appearance) {
    return { ...point, type: appearance.type, ...obstructionGeometry(appearance),
      color: appearance.color ?? OBJECTS[appearance.type].color,
      pattern: appearance.pattern ?? 'solid', patternColor: appearance.patternColor ?? '#dbe6ed',
      destructible: appearance.destructible ?? false };
  }

  clearAppearingObstruction(obstruction) {
    const overlaps = (actor, radius = actor.radius ?? 14) =>
      obstructionSurface(actor.x, actor.y, obstruction).gap < radius - 1e-7;
    if (overlaps(this.cat)) {
      this.hearts = 0;
      this.tookDamage = true;
      this.cat.vx = 0; this.cat.vy = 0;
      this.boosted = false; this.target = null;
      this.state = 'lost';
    }
    this.robots = this.robots.filter(enemy => {
      if (enemy.type === 'robo-koshi') return true;
      const parts = enemy.type === 'snake' ? this.snakeSegments(enemy) : [enemy];
      if (!parts.some(part => overlaps(part, part.radius + (part.index ? 5 : 0)))) return true;
      this.defeatEnemy(enemy, false);
      return false;
    });
    for (const field of ['food', 'items', 'weapons', 'healing', 'soccerBalls', 'bubbles', 'bumpers']) {
      this[field] = this[field].filter(item => !overlaps(item));
    }
  }

  moveAroundObstructions(actor, old, singleSegment = false) {
    if (!this.obstructions.length) return;
    let x = old.x, y = old.y, dx = actor.x - x, dy = actor.y - y;
    // Scheduled obstructions may appear underneath an actor.
    for (let pass = 0; pass < 8; pass++) {
      let overlap = false;
      for (const obstruction of this.obstructions) {
        const { gap, nx, ny } = obstructionSurface(x, y, obstruction);
        const depth = actor.radius - gap;
        if (depth <= 1e-7) continue;
        x += nx * (depth + 1e-6); y += ny * (depth + 1e-6);
        overlap = true;
      }
      if (!overlap) break;
    }
    for (let pass = 0; pass < 8 && Math.hypot(dx, dy) > 1e-9; pass++) {
      let time = 1, hit = null;
      for (const obstruction of this.obstructions) {
        const contact = obstructionContact(x, y, dx, dy, actor.radius, obstruction);
        if (contact <= time) { time = contact; hit = obstruction; }
      }
      x += dx * time; y += dy * time;
      if (!hit || (singleSegment && time > 1e-5)) break;
      const { nx, ny } = obstructionSurface(x, y, hit);
      x += nx * 1e-6; y += ny * 1e-6;
      dx *= 1 - time; dy *= 1 - time;
      const incoming = Math.min(0, dx * nx + dy * ny);
      dx -= incoming * nx; dy -= incoming * ny;
    }
    actor.x = x; actor.y = y;
  }

  blockEnemyWithObstructions(enemy, old) {
    if (!this.obstructions.length) return;
    if (['wheel', 'snake', 'robo-cow'].includes(enemy.type)) {
      const bounds = this.bounds(), perimeter = 2 * (bounds.right - bounds.left + bounds.bottom - bounds.top);
      const segmentsAt = distance => {
        if (enemy.type === 'snake') return this.snakeSegments({ ...enemy, distance });
        const segment = { distance, radius: enemy.radius };
        this.placeWheel(segment);
        return [segment];
      };
      const clear = distance => segmentsAt(distance).every((segment, index) => this.obstructions.every(obstruction =>
        obstructionSurface(segment.x, segment.y, obstruction).gap >= segment.radius + (index ? 5 : 0) - 1e-7));
      if (!clear(old.distance)) {
        // Keep the entire robot on its route if a new solid appears underneath it.
        for (let offset = 8; offset <= perimeter / 2 + 8; offset += 8) for (const sign of [1, -1]) {
          if (!clear(old.distance + sign * offset)) continue;
          let low = offset - 8, high = offset;
          for (let iteration = 0; iteration < 16; iteration++) {
            const middle = (low + high) / 2;
            if (clear(old.distance + sign * middle)) high = middle; else low = middle;
          }
          enemy.distance = old.distance + sign * high;
          this.placeWheel(enemy);
          return;
        }
        enemy.distance = old.distance;
        this.placeWheel(enemy);
        return;
      }
      const before = enemy.type === 'snake' ? this.snakeSegments({ ...enemy, distance: old.distance }) : [{ ...old, radius: enemy.radius }];
      const after = enemy.type === 'snake' ? this.snakeSegments(enemy) : [enemy];
      let contact = 1;
      for (const [index, segment] of before.entries()) {
        for (const obstruction of this.obstructions) {
          const radius = segment.radius + (index ? 5 : 0);
          contact = Math.min(contact, obstructionContact(segment.x, segment.y,
            after[index].x - segment.x, after[index].y - segment.y, radius, obstruction));
        }
      }
      const travel = ((enemy.distance - old.distance + perimeter / 2) % perimeter + perimeter) % perimeter - perimeter / 2;
      enemy.distance = old.distance + travel * contact;
      this.placeWheel(enemy);
      const direction = enemy.afraid ? enemy.fleeDirection ?? 1
        : enemy.type === 'robo-cow' ? enemy.cowDirection : enemy.barrierDirection ?? 1;
      // Collision passes can revisit the same step after it has already reversed.
      if (contact < 1 - 1e-9 && Math.sign(travel) === direction) {
        if (enemy.type === 'robo-cow') enemy.cowDirection = -direction;
        else enemy.barrierDirection = -direction;
        enemy.fleeDirection = -direction;
      }
    } else {
      this.moveAroundObstructions(enemy, old);
    }
  }

  goalEntry(ball, dx, dy, part, edge) {
    const vertical = edge === 'left' || edge === 'right';
    const outward = edge === 'left' || edge === 'top' ? -1 : 1;
    const position = vertical ? ball.x : ball.y, delta = vertical ? dx : dy;
    const face = vertical ? part.x + (outward < 0 ? part.w : 0) : part.y + (outward < 0 ? part.h : 0);
    if (delta * outward <= 1e-9 || (position - face) * outward > 1e-6) return Infinity;
    const time = (face - position) / delta;
    const along = vertical ? ball.y + dy * time : ball.x + dx * time;
    const start = vertical ? part.y : part.x, length = vertical ? part.h : part.w;
    return time >= -1e-9 && along >= start + ball.radius && along <= start + length - ball.radius
      ? Math.max(0, time) : Infinity;
  }

  updateSoccerBalls(dt, startX, startY, previousEnemies) {
    if (!this.soccerBalls.length || dt <= 0) return;
    const fences = this.barrierParts(), parts = this.brickParts();
    const bricks = [...parts.filter(part => this.bricks[part.id].kind !== 'goal'),
      ...goalTiles(parts.filter(part => this.bricks[part.id].kind === 'goal'))];
    const regions = brickRegions(this.bricks, this.width, this.height);
    const faces = { left: 0, right: this.width, top: 0, bottom: this.height };
    for (const part of parts) {
      const edge = regions.get(part.sourceId ?? part.afterId ?? part.id).edge;
      if (edge === 'left') faces.left = Math.max(faces.left, part.x + part.w);
      if (edge === 'right') faces.right = Math.min(faces.right, part.x);
      if (edge === 'top') faces.top = Math.max(faces.top, part.y + part.h);
      if (edge === 'bottom') faces.bottom = Math.min(faces.bottom, part.y);
    }
    const walls = [
      { edge: 'left', x: faces.left - 1, y: 0, w: 1, h: this.height },
      { edge: 'right', x: faces.right, y: 0, w: 1, h: this.height },
      { edge: 'top', x: 0, y: faces.top - 1, w: this.width, h: 1 },
      { edge: 'bottom', x: 0, y: faces.bottom, w: this.width, h: 1 },
    ];
    const goals = bricks.filter(part => this.bricks[part.id].kind === 'goal');
    const goalEdge = part => regions.get(part.sourceId ?? part.afterId ?? part.id).edge;
    const contain = ball => {
      const limits = { left: faces.left + ball.radius, right: faces.right - ball.radius,
        top: faces.top + ball.radius, bottom: faces.bottom - ball.radius };
      for (const part of goals) {
        const edge = goalEdge(part), vertical = edge === 'left' || edge === 'right';
        const along = vertical ? ball.y : ball.x, start = vertical ? part.y : part.x;
        const length = vertical ? part.h : part.w;
        if (along >= start + ball.radius && along <= start + length - ball.radius) limits[edge] = faces[edge];
      }
      if (ball.x < limits.left) { ball.x = limits.left; ball.vx = Math.abs(ball.vx); }
      if (ball.x > limits.right) { ball.x = limits.right; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < limits.top) { ball.y = limits.top; ball.vy = Math.abs(ball.vy); }
      if (ball.y > limits.bottom) { ball.y = limits.bottom; ball.vy = -Math.abs(ball.vy); }
      return limits;
    };
    const actors = [{ ...this.cat, oldX: startX, oldY: startY, kick: true },
      ...this.robots.filter(enemy => enemy.type !== 'robo-koshi').flatMap(enemy => {
        const old = previousEnemies.get(enemy);
        if (enemy.type !== 'snake') return [{ ...enemy, oldX: old?.x ?? enemy.x, oldY: old?.y ?? enemy.y }];
        const before = this.snakeSegments({ ...enemy, distance: old?.distance ?? enemy.distance });
        return this.snakeSegments(enemy).map((segment, index) => ({
          ...segment, radius: segment.radius + (index ? 5 : 0), oldX: before[index].x, oldY: before[index].y,
        }));
      })];
    const scored = new Set();
    const solids = ball => [
      ...this.obstructions.map(target => ({ kind: 'obstruction', target })),
      ...this.bumpers.map(target => ({ kind: 'bumper', target })),
      ...this.bubbles.map(target => ({ kind: 'bubble', target })),
      ...this.soccerBalls.filter(other => other !== ball && !scored.has(other)).map(target => ({ kind: 'ball', target })),
    ];
    const surface = (ball, { kind, target }) => {
      if (kind === 'obstruction') {
        const { gap, nx, ny } = obstructionSurface(ball.x, ball.y, target);
        return { gap: gap - ball.radius, normal: { x: nx, y: ny } };
      }
      const distance = Math.hypot(ball.x - target.x, ball.y - target.y);
      return { gap: distance - ball.radius - target.radius,
        normal: distance > 1e-9 ? { x: (ball.x - target.x) / distance, y: (ball.y - target.y) / distance } : { x: 1, y: 0 } };
    };
    this.soccerBalls = this.soccerBalls.filter(ball => {
      contain(ball);
      // Growing fences move a ball clear before its next swept movement.
      this.clearBarrierOverlap(ball, fences);
      // Spawned or nudged balls never start a step inside an object or another ball.
      for (let pass = 0; pass < 4; pass++) {
        let overlap = false;
        for (const solid of solids(ball)) {
          const { gap, normal } = surface(ball, solid);
          if (gap >= -1e-7) continue;
          ball.x -= normal.x * (gap - .01); ball.y -= normal.y * (gap - .01);
          overlap = true;
        }
        if (!overlap) break;
      }
      contain(ball);
      let remaining = dt;
      for (let bounce = 0; remaining > 1e-9 && bounce < 12; bounce++) {
        const speed = Math.hypot(ball.vx, ball.vy);
        const movingTime = Math.min(remaining, speed / SOCCER_FRICTION);
        const travel = Math.max(0, speed * movingTime - SOCCER_FRICTION * movingTime * movingTime / 2);
        const dx = speed ? ball.vx / speed * travel : 0, dy = speed ? ball.vy / speed * travel : 0;
        let contact = 1, obstacle = null, actorHit = null, objectHit = null, goal = false;
        const closedWalls = walls.filter(wall => !goals.some(part => goalEdge(part) === wall.edge
          && Number.isFinite(this.goalEntry(ball, dx, dy, part, wall.edge))));
        for (const part of [...bricks, ...fences, ...closedWalls]) {
          const edge = regions.get(part.sourceId ?? part.afterId ?? part.id)?.edge;
          const isGoal = this.bricks[part.id]?.kind === 'goal';
          const entry = isGoal ? this.goalEntry(ball, dx, dy, part, edge) : Infinity;
          if (Number.isFinite(entry) && entry > 1) continue;
          // An open mouth admits the ball's center instead of reflecting its outer edge.
          const time = Number.isFinite(entry) ? entry : brickContact(ball.x, ball.y, dx, dy, ball.radius, part);
          if (time <= contact) { contact = time; obstacle = part; actorHit = null; goal = Number.isFinite(entry); }
        }
        for (const solid of solids(ball)) {
          const { kind, target } = solid;
          const time = kind === 'obstruction' ? obstructionContact(ball.x, ball.y, dx, dy, ball.radius, target)
            : circleContact(ball.x - target.x, ball.y - target.y, dx, dy, ball.radius + target.radius);
          if (time < contact) { contact = time; objectHit = solid; obstacle = null; goal = false; }
        }
        const elapsed = dt - remaining;
        for (const actor of actors) {
          const avx = (actor.x - actor.oldX) / dt, avy = (actor.y - actor.oldY) / dt;
          const ax = actor.oldX + avx * elapsed, ay = actor.oldY + avy * elapsed;
          const time = circleContact(ball.x - ax, ball.y - ay, dx - avx * remaining,
            dy - avy * remaining, ball.radius + actor.radius);
          if (time < contact) { contact = time; actorHit = { actor, ax, ay, avx, avy }; obstacle = null; objectHit = null; goal = false; }
        }
        ball.x += dx * contact; ball.y += dy * contact;
        ball.angle += travel * contact / ball.radius;
        const spent = remaining * contact;
        const nextSpeed = Math.max(0, speed - SOCCER_FRICTION * spent);
        if (speed) { ball.vx *= nextSpeed / speed; ball.vy *= nextSpeed / speed; }
        remaining -= spent;
        if (goal) {
          this.goals++;
          this.goalEffects.push({ x: ball.x, y: ball.y, age: 0, duration: .65 });
          scored.add(ball);
          return false;
        }
        if (!obstacle && !actorHit && !objectHit) break;
        let normal;
        if (objectHit) {
          const { kind, target } = objectHit;
          ({ normal } = surface(ball, objectHit));
          if (kind === 'ball') {
            // Equal-mass balls exchange most of their speed along the line of impact.
            const incoming = (ball.vx - target.vx) * normal.x + (ball.vy - target.vy) * normal.y;
            if (incoming < 0) {
              const impulse = -(1 + .9) * incoming / 2;
              ball.vx += impulse * normal.x; ball.vy += impulse * normal.y;
              target.vx -= impulse * normal.x; target.vy -= impulse * normal.y;
            }
          } else {
            Object.assign(ball, reflectVelocity(ball.vx, ball.vy, normal));
            if (kind === 'bumper') {
              ball.vx *= OBJECTS[target.type].speedMultiplier; ball.vy *= OBJECTS[target.type].speedMultiplier;
              target.hitAt = this.elapsed;
              target.hitNormal = normal;
            }
          }
          for (const moving of kind === 'ball' ? [ball, target] : [ball]) {
            const limit = Math.hypot(moving.vx, moving.vy);
            if (limit > 650) { moving.vx *= 650 / limit; moving.vy *= 650 / limit; }
          }
        } else if (actorHit) {
          const { actor, ax, ay, avx, avy } = actorHit;
          const x = ax + avx * spent, y = ay + avy * spent;
          const distance = Math.hypot(ball.x - x, ball.y - y);
          const relativeSpeed = Math.hypot(avx - ball.vx, avy - ball.vy);
          normal = distance > 1e-9 ? { x: (ball.x - x) / distance, y: (ball.y - y) / distance }
            : relativeSpeed > 1e-9 ? { x: (avx - ball.vx) / relativeSpeed, y: (avy - ball.vy) / relativeSpeed }
              : { x: 1, y: 0 };
          const incoming = (ball.vx - avx) * normal.x + (ball.vy - avy) * normal.y;
          if (incoming < 0) {
            const restitution = actor.kick ? .5 : .8;
            ball.vx -= (1 + restitution) * incoming * normal.x;
            ball.vy -= (1 + restitution) * incoming * normal.y;
            if (actor.kick) {
              const limits = contain(ball);
              const nx = limits.left > faces.left && ball.x - limits.left <= actor.radius ? 1
                : limits.right < faces.right && limits.right - ball.x <= actor.radius ? -1 : 0;
              const ny = limits.top > faces.top && ball.y - limits.top <= actor.radius ? 1
                : limits.bottom < faces.bottom && limits.bottom - ball.y <= actor.radius ? -1 : 0;
              // Koshi's larger radius cannot get behind a ball wedged between two walls.
              if (nx && ny) {
                ball.vx = nx * Math.abs(ball.vx); ball.vy = ny * Math.abs(ball.vy);
                normal = { x: nx * Math.abs(normal.x), y: ny * Math.abs(normal.y) };
              }
            }
          }
          const limit = Math.hypot(ball.vx, ball.vy);
          if (limit > 650) { ball.vx *= 650 / limit; ball.vy *= 650 / limit; }
          const overlap = Math.max(0, ball.radius + actor.radius - distance);
          ball.x += normal.x * overlap; ball.y += normal.y * overlap;
        } else {
          normal = brickNormal(ball.x, ball.y, obstacle);
          if (!normal) break;
          Object.assign(ball, reflectVelocity(ball.vx, ball.vy, normal));
        }
        ball.x += normal.x * .01; ball.y += normal.y * .01;
        contain(ball);
      }
      contain(ball);
      return true;
    });
  }

  updateGoalEffects(seconds) {
    this.goalEffects = this.goalEffects.filter(effect => {
      effect.age += seconds;
      return effect.age < effect.duration - 1e-9;
    });
  }

  spawnEnemies(event) {
    const enemies = this.takeSpawn(event, entry => this.createEnemies(entry));
    for (const enemy of enemies) {
      const perimeterDistance = enemy.distance;
      this.ensureEnemySpawnClear(enemy);
      if (enemy.type === 'robo-cow' && enemy.distance !== perimeterDistance) this.initializeRoboCow(enemy);
      const spawn = this.tickStart ?? { time: this.elapsed, x: this.cat.x, y: this.cat.y };
      this.initializeRoboKoshi(enemy, spawn.time, spawn);
    }
    this.robots.push(...enemies);
  }

  enemySpawnClear(enemy) {
    const parts = enemy.type === 'snake' ? this.snakeSegments(enemy) : [enemy];
    return parts.every(part => Math.hypot(part.x - this.cat.x, part.y - this.cat.y)
      > this.cat.radius + part.radius + (part.index ? 5 : 0));
  }

  ensureEnemySpawnClear(enemy) {
    if (this.enemySpawnClear(enemy)) return;
    if (!['wheel', 'snake', 'robo-cow'].includes(enemy.type)) {
      Object.assign(enemy, this.randomPoint(point => this.enemySpawnClear({ ...enemy, ...point })));
      if (enemy.type === 'goalie') enemy.goaliePushPriority = enemy.y;
      return;
    }
    const b = this.bounds(), perimeter = 2 * (b.right - b.left + b.bottom - b.top);
    for (let attempt = 0; attempt < 128; attempt++) {
      enemy.distance = (attempt < 64 ? this.random() : (attempt - 64) / 64) * perimeter;
      this.placeWheel(enemy);
      if (this.enemySpawnClear(enemy)) return;
    }
    throw new RangeError('No safe perimeter enemy spawn location is available.');
  }

  createEnemies([, type, count, shield, options]) {
    const items = [];
    const b = this.bounds(), w = b.right - b.left, h = b.bottom - b.top;
    for (let i = 0; i < count; i++) {
      const enemy = { ...this.randomPoint(), type, radius: type === 'robo-cow' ? 26 : 19,
        ...(!this.catBlockCollected && options?.carriesCatBlock && i === 0 ? { carriesCatBlock: true } : {}),
        ...(options?.carriesKey && i === 0 ? { carriesKey: true } : {}),
        phase: this.random() * Math.PI * 2, age: 0, touching: false, distance: this.random() * 2 * (w + h) };
      this.initializeShield(enemy, shield);
      if (type === 'ram') this.initializeRam(enemy);
      if (type === 'bucket') this.initializeBucket(enemy);
      if (type === 'jackolantern') this.initializeJackolantern(enemy);
      if (type === 'goalie') this.initializeGoalie(enemy);
      if (['wheel', 'snake', 'robo-cow'].includes(type)) this.placeWheel(enemy);
      this.ensureEnemySpawnClear(enemy);
      if (type === 'robo-cow') this.initializeRoboCow(enemy);
      if (type === 'robo-unicorn') this.initializeRoboUnicorn(enemy);
      this.initializeRoboKoshi(enemy, this.elapsed, this.cat);
      items.push(enemy);
    }
    return items;
  }

  initializeRoboKoshi(enemy, time, point) {
    if (enemy.type !== 'robo-koshi') return;
    enemy.roboSpawnTime = time;
    enemy.roboOrigin = { x: point.x, y: point.y };
    enemy.roboPhase = 'waiting';
    enemy.roboDelay = null;
    enemy.roboPathTarget = null;
  }

  catPositionAt(time) {
    const history = this.catHistory;
    if (time <= history[0].time) return history[0];
    for (let i = 1; i < history.length; i++) {
      const after = history[i];
      if (time > after.time) continue;
      const before = history[i - 1], span = after.time - before.time;
      const progress = span ? (time - before.time) / span : 1;
      return {
        x: before.x + (after.x - before.x) * progress,
        y: before.y + (after.y - before.y) * progress,
      };
    }
    return history[history.length - 1];
  }

  recordCatPosition() {
    const latest = this.catHistory[this.catHistory.length - 1];
    if (latest.time === this.elapsed) Object.assign(latest, { x: this.cat.x, y: this.cat.y });
    else this.catHistory.push({ time: this.elapsed, x: this.cat.x, y: this.cat.y });
    const needed = this.robots.filter(enemy => enemy.type === 'robo-koshi').map(enemy =>
      enemy.roboPhase === 'following' ? this.elapsed - enemy.roboDelay : enemy.roboSpawnTime);
    const cutoff = needed.length ? Math.min(...needed) : this.elapsed - 10;
    while (this.catHistory.length > 2 && this.catHistory[1].time < cutoff) this.catHistory.shift();
  }

  moveRoboKoshi(enemy, dt) {
    const now = this.elapsed, stepStart = now - dt, waitUntil = enemy.roboSpawnTime + 1;
    if (now < waitUntil - 1e-9) return;
    const movementStart = Math.max(stepStart, waitUntil);
    const movementTime = Math.max(0, now - movementStart);
    if (enemy.roboPhase !== 'following') {
      const dx = enemy.roboOrigin.x - enemy.x, dy = enemy.roboOrigin.y - enemy.y;
      const distance = Math.hypot(dx, dy), travel = SPEED * movementTime;
      if (distance > travel + 1e-9) {
        if (distance) {
          enemy.x += dx / distance * travel;
          enemy.y += dy / distance * travel;
        }
        enemy.roboPhase = 'approaching';
        return;
      }
      enemy.x = enemy.roboOrigin.x;
      enemy.y = enemy.roboOrigin.y;
      enemy.roboPhase = 'following';
      enemy.roboDelay = movementStart + (distance ? distance / SPEED : 0) - enemy.roboSpawnTime;
    }
    const target = this.catPositionAt(now - enemy.roboDelay);
    enemy.x = target.x;
    enemy.y = target.y;
    enemy.roboPathTarget = { x: target.x, y: target.y };
  }

  initializeShield(enemy, shield) {
    enemy.shield = shield ?? null;
    enemy.defeatPoints = shield ? SHIELDS[shield].hits : 1;
    enemy.invulnerableUntil = 0;
  }

  goalieArea(enemy) {
    const regions = brickRegions(this.bricks, this.width, this.height);
    const goals = goalTiles(this.brickParts().filter(part => this.bricks[part.id].kind === 'goal'));
    const areas = goals.map(part => {
      const edge = regions.get(part.sourceId ?? part.afterId ?? part.id).edge;
      const vertical = edge === 'left' || edge === 'right';
      const inward = edge === 'left' || edge === 'top' ? 1 : -1;
      const face = vertical ? part.x + (inward > 0 ? part.w : 0) : part.y + (inward > 0 ? part.h : 0);
      const start = vertical ? part.y : part.x, length = vertical ? part.h : part.w;
      const margin = Math.min(enemy.radius, length / 2);
      return { id: part.id, vertical, inward, face, normal: face + inward * (enemy.radius + 3),
        start: start + margin, end: start + length - margin };
    });
    const distance = area => {
      const along = Math.max(area.start, Math.min(area.end, area.vertical ? enemy.y : enemy.x));
      return Math.hypot(enemy.x - (area.vertical ? area.normal : along),
        enemy.y - (area.vertical ? along : area.normal));
    };
    return areas.find(area => area.id === enemy.goalId)
      ?? areas.reduce((best, area) => !best || distance(area) < distance(best) ? area : best, null);
  }

  placeGoalie(enemy, area, along) {
    along = Math.max(area.start, Math.min(area.end, along));
    enemy.goalId = area.id;
    enemy.x = area.vertical ? area.normal : along;
    enemy.y = area.vertical ? along : area.normal;
  }

  initializeGoalie(enemy) {
    enemy.radius = 23;
    enemy.goaliePushPriority = enemy.y;
  }

  moveGoalie(enemy, dt) {
    const area = this.goalieArea(enemy);
    if (!area) return;
    const along = area.vertical ? enemy.y : enemy.x;
    let target = (area.start + area.end) / 2, earliest = Infinity;
    let nearbyTarget = target, nearest = 240;
    for (const ball of this.soccerBalls) {
      const ballAlong = area.vertical ? ball.y : ball.x;
      const ballNormal = area.vertical ? ball.x : ball.y;
      const distance = Math.hypot(ballNormal - area.normal,
        ballAlong - Math.max(area.start, Math.min(area.end, ballAlong)));
      if (distance < nearest && (ballNormal - area.face) * area.inward >= 0) {
        const speed = Math.hypot(ball.vx, ball.vy);
        const lookahead = Math.min(.6, speed / SOCCER_FRICTION);
        const travelTime = speed ? lookahead - SOCCER_FRICTION * lookahead * lookahead / (2 * speed) : 0;
        nearbyTarget = ballAlong + (area.vertical ? ball.vy : ball.vx) * travelTime;
        nearest = distance;
      }
      const velocity = area.vertical ? ball.vx : ball.vy;
      if (velocity * area.inward >= -1e-9) continue;
      const normal = area.vertical ? ball.x : ball.y;
      const time = (area.normal - normal) / velocity;
      const stoppingTime = Math.hypot(ball.vx, ball.vy) / SOCCER_FRICTION;
      const intercept = (area.vertical ? ball.y : ball.x) + (area.vertical ? ball.vy : ball.vx) * time;
      if (time < 0 || time > stoppingTime / 2 || time >= earliest
        || intercept < area.start - enemy.radius || intercept > area.end + enemy.radius) continue;
      target = Math.max(area.start, Math.min(area.end, intercept));
      earliest = time;
    }
    if (earliest === Infinity && nearest < 240) target = nearbyTarget;
    if (enemy.afraid) {
      const catAlong = area.vertical ? this.cat.y : this.cat.x;
      target = catAlong <= along ? area.end : area.start;
    }
    const sway = Math.min(5, (area.end - area.start) / 2);
    target = Math.max(area.start + sway, Math.min(area.end - sway, target))
      + Math.sin((enemy.age + dt) * 3) * sway;
    const speed = enemy.afraid ? FEAR_SPEED : GOALIE_SPEED;
    const targetX = area.vertical ? area.normal : target;
    const targetY = area.vertical ? target : area.normal;
    const dx = targetX - enemy.x, dy = targetY - enemy.y;
    const distance = Math.hypot(dx, dy);
    const step = distance ? Math.min(1, speed * dt / distance) : 0;
    enemy.goalId = area.id;
    enemy.x += dx * step;
    enemy.y += dy * step;
  }

  defeatEnemy(enemy, awardPoints = true) {
    if (awardPoints) this.enemies += enemy.defeatPoints ?? 1;
    if (enemy.carriesKey) {
      this.items.push(this.createCollectible(this.elapsed, 'key', null, { x: enemy.x, y: enemy.y }));
      enemy.carriesKey = false;
    }
    if (enemy.carriesCatBlock && !this.catBlockCollected) {
      this.items.push({ ...this.createCollectible(this.elapsed, 'cat-block', null, { x: enemy.x, y: enemy.y }), source: 'enemy' });
      enemy.carriesCatBlock = false;
    }
    this.enemyDeaths.push({ ...enemy, ...(enemy.type === 'snake' ? { segments: this.snakeSegments(enemy) } : {}),
      bombs: enemy.bombs?.map(bomb => ({ ...bomb })) ?? [], deathProgress: 0 });
    if (enemy.type === 'robo-snail') this.freezeBrickCooldowns();
  }

  freezeBrickCooldowns() {
    const freezeUntil = Math.max(this.elapsed, this.snailCooldownFreezeUntil) + 20;
    for (const brick of this.bricks) {
      if (brick.readyAt > this.elapsed + 1e-9) brick.readyAt += 20;
    }
    this.snailCooldownFreezeUntil = freezeUntil;
    this.snailStreamStart = this.elapsed;
    this.snailStreamUntil = freezeUntil;
    this.snailStreamAge = 0;
  }

  enemyDamageProgress(enemy) {
    return enemy.invulnerableUntil > this.elapsed + 1e-9
      ? 1 - (enemy.invulnerableUntil - this.elapsed) / DAMAGE_DURATION : null;
  }

  initializeRam(enemy) {
    enemy.state = 'wander';
    enemy.stateTime = 0;
    enemy.wanderDuration = 2.5 + this.random() * 1.5;
    enemy.turnTime = .6 + this.random() * 1.4;
    enemy.angle = this.random() * Math.PI * 2;
    enemy.facingAngle = enemy.angle - Math.PI / 2;
    enemy.speed = 520;
  }

  nextBucketShot() {
    return Math.max(.25, -2 * Math.log(1 - Math.min(this.random(), 1 - Number.EPSILON)));
  }

  initializeJackolantern(enemy) {
    enemy.stompTimer = 4;
    enemy.stompAge = null;
    enemy.waves = [];
  }

  updateJackolantern(enemy, seconds, parts, startX, startY) {
    enemy.waves = enemy.waves.filter(wave => {
      const previousRadius = wave.radius;
      wave.radius += 120 * seconds;
      blockFireWave(wave, parts, previousRadius, this.obstructions);
      if (!enemy.afraid && fireTouchesCat(wave, previousRadius, this.cat, startX, startY)) this.takeDamage();
      return wave.radius <= Math.hypot(this.width, this.height)
        && wave.blocked.some((_, side) => fireIntervals(wave, side).length);
    });
    if (enemy.afraid) return;
    if (enemy.stompAge !== null) {
      enemy.stompAge += seconds;
      if (enemy.stompAge >= .35) enemy.stompAge = null;
    }
    const movingTime = Math.min(seconds, Math.max(0, enemy.stompTimer - .5));
    if (movingTime > 0) {
      enemy.phase += Math.sin(enemy.age * 1.7 + enemy.phase) * movingTime;
      const bounds = this.bounds();
      enemy.x += Math.cos(enemy.phase) * 32 * movingTime;
      enemy.y += Math.sin(enemy.phase) * 32 * movingTime;
      if (enemy.x < bounds.left || enemy.x > bounds.right) enemy.phase = Math.PI - enemy.phase;
      if (enemy.y < bounds.top || enemy.y > bounds.bottom) enemy.phase = -enemy.phase;
      enemy.x = Math.max(bounds.left, Math.min(bounds.right, enemy.x));
      enemy.y = Math.max(bounds.top, Math.min(bounds.bottom, enemy.y));
    }
    enemy.stompTimer -= seconds;
  }

  releaseJackolanternStomp(enemy, parts) {
    if (enemy.asleep || enemy.afraid || enemy.stompTimer > 1e-9) return;
    const wave = { x: enemy.x, y: enemy.y, radius: 0, blocked: [[], [], [], []] };
    blockFireWave(wave, parts, 0, this.obstructions);
    enemy.waves.push(wave);
    enemy.stompTimer += 4;
    enemy.stompAge = 0;
  }

  fireWaveSegments(wave) {
    return wave.blocked.flatMap((_, side) => fireIntervals(wave, side).map(([left, right]) => ({
      from: firePoint(wave, side, wave.radius, left), to: firePoint(wave, side, wave.radius, right),
    })));
  }

  initializeBucket(enemy) {
    enemy.bombs = [];
    enemy.shotTimer = this.nextBucketShot();
  }

  fireBucketBomb(enemy) {
    const angle = this.random() * Math.PI * 2;
    enemy.bombs.push({
      x: enemy.x, y: enemy.y + 13, vx: Math.cos(angle) * 150, vy: Math.sin(angle) * 150,
      radius: 8, fuse: 3, state: 'flying', blastAge: 0, blastRadius: 0, touching: false,
    });
  }

  updateBucket(enemy, seconds, parts) {
    if (!enemy.afraid) {
      enemy.phase += Math.sin(enemy.age * 1.7 + enemy.phase) * seconds;
      enemy.x += Math.cos(enemy.phase) * 32 * seconds;
      enemy.y += Math.sin(enemy.phase) * 32 * seconds;
      const bounds = this.bounds();
      if (enemy.x < bounds.left || enemy.x > bounds.right) {
        enemy.x = Math.max(bounds.left, Math.min(bounds.right, enemy.x));
        enemy.phase = Math.PI - enemy.phase;
      }
      if (enemy.y < bounds.top || enemy.y > bounds.bottom) {
        enemy.y = Math.max(bounds.top, Math.min(bounds.bottom, enemy.y));
        enemy.phase = -enemy.phase;
      }
    }
    if (!enemy.afraid) {
      enemy.shotTimer -= seconds;
      if (enemy.shotTimer <= 1e-9) {
        this.fireBucketBomb(enemy);
        enemy.shotTimer += this.nextBucketShot();
      }
    }
    enemy.bombs = enemy.bombs.filter(bomb => {
      if (bomb.state === 'flying') {
        this.clearBarrierOverlap(bomb, parts.filter(part => part.barrier));
        let remaining = seconds, bounces = 0;
        while (remaining > 1e-9 && bounces < 4) {
          const dx = bomb.vx * remaining, dy = bomb.vy * remaining;
          let contact = Infinity, obstacle = null;
          for (const part of parts) {
            const time = brickContact(bomb.x, bomb.y, dx, dy, bomb.radius, part);
            if (time < contact) { contact = time; obstacle = part; }
          }
          if (!obstacle || contact > 1) {
            bomb.x += dx; bomb.y += dy;
            break;
          }
          bomb.x += dx * contact; bomb.y += dy * contact;
          const normal = brickNormal(bomb.x, bomb.y, obstacle);
          if (!normal) break;
          bomb.x += normal.x * .01; bomb.y += normal.y * .01;
          const incoming = bomb.vx * normal.x + bomb.vy * normal.y;
          bomb.vx = (bomb.vx - 2 * incoming * normal.x) * .88;
          bomb.vy = (bomb.vy - 2 * incoming * normal.y) * .88;
          remaining *= 1 - contact;
          bounces++;
        }
        bomb.fuse -= seconds;
        if (bomb.fuse <= 1e-9) {
          bomb.state = 'exploding';
          bomb.blastAge = 0;
          bomb.blastRadius = 0;
        }
      } else {
        bomb.blastAge += seconds;
        bomb.blastRadius = 58 * Math.min(1, bomb.blastAge / .45);
        const touching = Math.hypot(this.cat.x - bomb.x, this.cat.y - bomb.y) <= this.cat.radius + bomb.blastRadius;
        if (!enemy.afraid && touching && !bomb.touching && this.enemyDamageProgress(enemy) === null) this.takeDamage();
        bomb.touching = touching;
        if (bomb.blastAge >= .9) return false;
      }
      return true;
    });
  }

  placeWheel(enemy) {
    const b = this.bounds(), w = b.right - b.left, h = b.bottom - b.top;
    const perimeter = 2 * (w + h);
    const d = ((enemy.distance % perimeter) + perimeter) % perimeter;
    if (d < w) { enemy.x = b.left + d; enemy.y = b.top; }
    else if (d < w + h) { enemy.x = b.right; enemy.y = b.top + d - w; }
    else if (d < 2 * w + h) { enemy.x = b.right - (d - w - h); enemy.y = b.bottom; }
    else { enemy.x = b.left; enemy.y = b.bottom - (d - 2 * w - h); }
  }

  perimeterPosition(point) {
    const b = this.bounds(), w = b.right - b.left, h = b.bottom - b.top;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const sides = [point.x - b.left, b.right - point.x, point.y - b.top, b.bottom - point.y];
    const side = sides.indexOf(Math.min(...sides));
    if (side === 0) return 2 * w + h + b.bottom - clamp(point.y, b.top, b.bottom);
    if (side === 1) return w + clamp(point.y - b.top, 0, h);
    if (side === 2) return clamp(point.x - b.left, 0, w);
    return w + h + b.right - clamp(point.x, b.left, b.right);
  }

  perimeterBrickDistance(id) {
    const brick = this.bricks[id], edge = brickRegions(this.bricks, this.width, this.height).get(id).edge;
    const b = this.bounds(), w = b.right - b.left, h = b.bottom - b.top;
    if (edge === 'top') return Math.max(0, Math.min(w, brick.x + brick.w / 2 - b.left));
    if (edge === 'right') return w + Math.max(0, Math.min(h, brick.y + brick.h / 2 - b.top));
    if (edge === 'bottom') return w + h + b.right - Math.max(b.left, Math.min(b.right, brick.x + brick.w / 2));
    return 2 * w + h + b.bottom - Math.max(b.top, Math.min(b.bottom, brick.y + brick.h / 2));
  }

  initializeRoboCow(enemy) {
    enemy.cowDirection = 1;
    enemy.cowEating = false;
    enemy.cowEatTime = 0;
    this.chooseCowWalkDistance(enemy);
    this.placeWheel(enemy);
    this.updateRoboCowFacing(enemy);
  }

  updateRoboCowFacing(enemy, seconds) {
    const b = this.bounds(), w = b.right - b.left, h = b.bottom - b.top;
    const perimeter = 2 * (w + h), d = ((enemy.distance % perimeter) + perimeter) % perimeter;
    const target = d < w ? Math.PI : d < w + h ? -Math.PI / 2 : d < 2 * w + h ? 0 : Math.PI / 2;
    if (seconds === undefined || !Number.isFinite(enemy.facingAngle)) {
      enemy.facingAngle = target;
      return;
    }
    const delta = Math.atan2(Math.sin(target - enemy.facingAngle), Math.cos(target - enemy.facingAngle));
    const step = Math.PI / 2 / .12 * seconds;
    enemy.facingAngle += Math.max(-step, Math.min(step, delta));
  }

  chooseCowWalkDistance(enemy) {
    const stepsByRoll = [2, 3, 3, 4, 4, 4, 4, 5, 5, 6];
    const steps = stepsByRoll[Math.min(9, Math.floor(this.random() * stepsByRoll.length))];
    const b = this.bounds(), perimeter = 2 * (b.right - b.left + b.bottom - b.top);
    enemy.cowWalkRemaining = steps * perimeter / this.perimeter.length;
    enemy.cowTargetIndex = null;
    enemy.cowTargetId = null;
  }

  updateRoboCowFear(enemy) {
    const afraid = this.maskActive;
    if (afraid && !enemy.afraid) {
      enemy.cowEating = false;
      enemy.cowEatTime = 0;
      enemy.cowTargetIndex = null;
      enemy.cowTargetId = null;
      enemy.cowWalkRemaining = 0;
    } else if (!afraid && enemy.afraid) {
      this.chooseCowWalkDistance(enemy);
    }
    enemy.afraid = afraid;
  }

  updateRoboCow(enemy, seconds) {
    if (enemy.cowEating) {
      enemy.cowEatTime += seconds;
      if (enemy.cowEatTime >= COW_EAT_DURATION - 1e-9) {
        const brick = this.bricks[enemy.cowTargetId];
        if (brick && !['cinder', 'goal'].includes(brick.kind)) this.convertBrickToCinder(brick, this.brickParts());
        enemy.cowEating = false;
        enemy.cowEatTime = 0;
        this.chooseCowWalkDistance(enemy);
      }
      this.placeWheel(enemy);
      return;
    }
    const b = this.bounds(), w = b.right - b.left, h = b.bottom - b.top, perimeter = 2 * (w + h);
    const corners = [0, w, w + h, 2 * w + h];
    const fences = this.barrierParts();
    const centers = this.perimeter.map(id => this.perimeterBrickDistance(id));
    let remaining = COW_SPEED * seconds;
    this.placeWheel(enemy);
    while (remaining > 1e-9) {
      const direction = enemy.cowDirection;
      const d = ((enemy.distance % perimeter) + perimeter) % perimeter;
      const cornerDistance = Math.min(...corners.map(corner => {
        const gap = ((corner - d) * direction % perimeter + perimeter) % perimeter;
        return gap > 1e-9 ? gap : perimeter;
      }));
      const centerDistance = enemy.cowWalkRemaining > 1e-9 ? Infinity : Math.min(...centers.map(center => {
        const gap = ((center - d) * direction % perimeter + perimeter) % perimeter;
        return Math.min(gap, perimeter - gap) < 1e-9 ? 0 : gap;
      }));
      if (centerDistance === 0) break;
      const step = Math.min(remaining, cornerDistance,
        enemy.cowWalkRemaining > 1e-9 ? enemy.cowWalkRemaining : centerDistance);
      const old = { x: enemy.x, y: enemy.y, distance: enemy.distance };
      enemy.distance += direction * step;
      this.placeWheel(enemy);
      this.blockEnemyWithBarriers(enemy, old, fences);
      if (enemy.type !== 'robo-koshi') this.blockEnemyWithObstructions(enemy, old);
      const traveled = Math.min(step, Math.max(0, direction * (enemy.distance - old.distance)));
      enemy.cowWalkRemaining = Math.max(0, enemy.cowWalkRemaining - traveled);
      remaining -= traveled;
      if (enemy.cowDirection !== direction || traveled < step - 1e-9) break;
      if (step === centerDistance) break;
    }
    if (enemy.cowWalkRemaining > 1e-9) return;
    const d = ((enemy.distance % perimeter) + perimeter) % perimeter;
    const index = centers.findIndex(center => {
      const gap = Math.abs(center - d);
      return Math.min(gap, perimeter - gap) < 1e-9;
    });
    if (index === -1) return;
    const section = this.bricks[this.perimeter[index]];
    const brick = this.bricks[section.absorbedBy ?? section.id];
    if (['cinder', 'goal'].includes(brick.kind)) this.chooseCowWalkDistance(enemy);
    else {
      enemy.cowTargetIndex = index;
      enemy.cowTargetId = brick.id;
      enemy.cowEating = true;
      enemy.cowEatTime = 0;
    }
  }

  initializeRoboUnicorn(enemy) {
    enemy.unicornState = 'roam';
    enemy.unicornStateTime = 0;
    enemy.nextRestAt = enemy.age + 2 + this.random() * 2;
    enemy.angry = false;
    enemy.mouthOpen = false;
    enemy.facingAngle = enemy.phase ?? 0;
  }

  nearestFood(enemy) {
    return this.food.reduce((nearest, food) => !nearest
      || Math.hypot(food.x - enemy.x, food.y - enemy.y) < Math.hypot(nearest.x - enemy.x, nearest.y - enemy.y) ? food : nearest, null);
  }

  updateRoboUnicorn(enemy, seconds, bounds) {
    this.moveRoboUnicorn(enemy, seconds, bounds);
    enemy.facingAngle = rotateToward(enemy.facingAngle ?? enemy.phase ?? 0, enemy.phase ?? 0, 10 * seconds);
  }

  moveRoboUnicorn(enemy, seconds, bounds) {
    enemy.angry = this.food.length === 0;
    enemy.resting = false;
    enemy.mouthOpen = false;
    if (enemy.angry) {
      enemy.unicornState = 'roam';
      enemy.unicornStateTime = 0;
    } else if (enemy.unicornState === 'rest') {
      enemy.resting = true;
      enemy.unicornStateTime += seconds;
      const target = this.nearestFood(enemy);
      if (target) enemy.phase = rotateToward(enemy.phase, Math.atan2(target.y - enemy.y, target.x - enemy.x), 6 * seconds);
      if (enemy.unicornStateTime >= 1) {
        enemy.unicornState = 'charge';
        enemy.unicornStateTime = 0;
      }
    }
    if (!enemy.angry && enemy.unicornState === 'roam' && enemy.age >= enemy.nextRestAt) {
      enemy.unicornState = 'rest';
      enemy.unicornStateTime = 0;
      enemy.resting = true;
    }
    if (!enemy.resting) {
      let speed = enemy.angry ? 150 : 95;
      if (!enemy.angry && enemy.unicornState === 'charge') {
        const target = this.nearestFood(enemy);
        if (target) {
          enemy.mouthOpen = true;
          const heading = Math.atan2(target.y - enemy.y, target.x - enemy.x);
          enemy.phase = rotateToward(enemy.phase, heading, 9 * seconds);
          // Ease off while the food is well off-heading so the turning circle cannot orbit it.
          const offHeading = Math.abs(Math.atan2(Math.sin(heading - enemy.phase), Math.cos(heading - enemy.phase)));
          speed = 230 * Math.max(.3, Math.cos(Math.min(Math.PI / 2, offHeading)));
        } else {
          enemy.unicornState = 'roam';
          enemy.nextRestAt = enemy.age + 2 + this.random() * 2;
        }
      }
      if (!enemy.angry && enemy.unicornState !== 'charge') enemy.phase += Math.sin(enemy.age * 1.7 + enemy.phase) * seconds;
      enemy.x += Math.cos(enemy.phase) * speed * seconds;
      enemy.y += Math.sin(enemy.phase) * speed * seconds;
      if (enemy.x < bounds.left || enemy.x > bounds.right) enemy.phase = Math.PI - enemy.phase;
      if (enemy.y < bounds.top || enemy.y > bounds.bottom) enemy.phase = -enemy.phase;
      enemy.x = Math.max(bounds.left, Math.min(bounds.right, enemy.x));
      enemy.y = Math.max(bounds.top, Math.min(bounds.bottom, enemy.y));
    }
  }

  snakeSegments(enemy) {
    if (!Number.isFinite(enemy.distance)) return Array.from({ length: 4 }, (_, index) => ({
      x: enemy.x - index * 38, y: enemy.y, radius: 19, angle: 0, index,
    }));
    return Array.from({ length: 4 }, (_, index) => {
      const segment = { distance: enemy.distance - index * 38, radius: 19, index };
      this.placeWheel(segment);
      const ahead = { distance: segment.distance + (enemy.afraid ? enemy.fleeDirection ?? 1 : enemy.barrierDirection ?? 1) };
      this.placeWheel(ahead);
      segment.angle = Math.atan2(ahead.y - segment.y, ahead.x - segment.x);
      return segment;
    });
  }

  blockSnakeWithBarriers(enemy, old, fences) {
    if (!fences.length) return;
    const before = this.snakeSegments({ ...enemy, distance: old.distance });
    const after = this.snakeSegments(enemy);
    if (after.some((segment, index) => fences.some(part => brickContact(before[index].x, before[index].y,
      segment.x - before[index].x, segment.y - before[index].y, segment.radius + (index ? 5 : 0), part) <= 1))) {
      enemy.distance = old.distance;
      enemy.barrierDirection = -(enemy.barrierDirection ?? 1);
      enemy.fleeDirection = -(enemy.fleeDirection ?? 1);
      this.placeWheel(enemy);
    }
    const clear = distance => this.snakeSegments({ ...enemy, distance }).every(segment => fences.every(part => {
      const x = Math.max(part.x, Math.min(part.x + part.w, segment.x));
      const y = Math.max(part.y, Math.min(part.y + part.h, segment.y));
      return Math.hypot(segment.x - x, segment.y - y) >= segment.radius + (segment.index ? 5 : 0) - 1e-7;
    }));
    if (clear(enemy.distance)) return;
    // Find the nearest free placement of the entire body along the perimeter.
    const bounds = this.bounds(), w = bounds.right - bounds.left, h = bounds.bottom - bounds.top;
    const perimeter = 2 * (w + h), candidates = [];
    for (let index = 0; index < 4; index++) {
      const radius = 19 + (index ? 5 : 0), offset = index * 38;
      for (const part of fences) {
        const edges = [
          { fixed: bounds.top, min: bounds.left, max: bounds.right, start: 0, sign: 1, horizontal: true },
          { fixed: bounds.right, min: bounds.top, max: bounds.bottom, start: w, sign: 1, horizontal: false },
          { fixed: bounds.bottom, min: bounds.left, max: bounds.right, start: w + h, sign: -1, horizontal: true },
          { fixed: bounds.left, min: bounds.top, max: bounds.bottom, start: 2 * w + h, sign: -1, horizontal: false },
        ];
        for (const edge of edges) {
          const near = edge.horizontal ? part.y : part.x, far = near + (edge.horizontal ? part.h : part.w);
          const separation = Math.abs(edge.fixed - Math.max(near, Math.min(far, edge.fixed)));
          if (separation >= radius) continue;
          const extent = Math.sqrt(radius * radius - separation * separation);
          const low = (edge.horizontal ? part.x : part.y) - extent;
          const high = (edge.horizontal ? part.x + part.w : part.y + part.h) + extent;
          if (high < edge.min || low > edge.max) continue;
          for (const point of [Math.max(edge.min, low), Math.min(edge.max, high)]) {
            const distance = edge.start + (edge.sign > 0 ? point - edge.min : edge.max - point) + offset;
            candidates.push(distance - .01, distance + .01);
          }
        }
      }
    }
    const shifts = candidates.map(distance => ((distance - enemy.distance + perimeter / 2) % perimeter + perimeter) % perimeter - perimeter / 2)
      .sort((a, b) => Math.abs(a) - Math.abs(b));
    const shift = shifts.find(delta => clear(enemy.distance + delta));
    if (shift !== undefined) { enemy.distance += shift; this.placeWheel(enemy); }
  }

  moveBall(enemy, seconds, parts) {
    let remaining = seconds;
    const bounds = this.bounds();
    const obstacles = [...parts,
      { x: bounds.left - enemy.radius - 1, y: 0, w: 1, h: this.height },
      { x: bounds.right + enemy.radius, y: 0, w: 1, h: this.height },
      { x: 0, y: bounds.top - enemy.radius - 1, w: this.width, h: 1 },
      { x: 0, y: bounds.bottom + enemy.radius, w: this.width, h: 1 }];
    for (let bounce = 0; remaining > 1e-9 && bounce < 8; bounce++) {
      const dx = Math.cos(enemy.phase) * 120 * remaining, dy = Math.sin(enemy.phase) * 120 * remaining;
      let contact = Infinity, obstacle = null;
      for (const part of obstacles) {
        const time = brickContact(enemy.x, enemy.y, dx, dy, enemy.radius, part);
        if (time < contact) { contact = time; obstacle = part; }
      }
      if (!obstacle || contact > 1) { enemy.x += dx; enemy.y += dy; break; }
      enemy.x += dx * contact; enemy.y += dy * contact;
      const normal = brickNormal(enemy.x, enemy.y, obstacle);
      if (!normal) break;
      this.turnEnemyFromContact(enemy, normal.x, normal.y);
      enemy.x += normal.x * .01; enemy.y += normal.y * .01;
      remaining *= 1 - contact;
    }
    enemy.x = Math.max(bounds.left, Math.min(bounds.right, enemy.x));
    enemy.y = Math.max(bounds.top, Math.min(bounds.bottom, enemy.y));
  }

  moveAfraidEnemy(enemy, seconds) {
    const bounds = this.bounds();
    const angle = Math.hypot(enemy.x - this.cat.x, enemy.y - this.cat.y) < 1e-9
      ? enemy.phase : Math.atan2(enemy.y - this.cat.y, enemy.x - this.cat.x);
    enemy.phase = angle;
    enemy.x = Math.max(bounds.left, Math.min(bounds.right, enemy.x + Math.cos(angle) * FEAR_SPEED * seconds));
    enemy.y = Math.max(bounds.top, Math.min(bounds.bottom, enemy.y + Math.sin(angle) * FEAR_SPEED * seconds));
    if (enemy.type === 'ram') enemy.facingAngle = rotateToward(enemy.facingAngle, angle - Math.PI / 2, 4.5 * seconds);
  }

  moveAfraidWheel(enemy, seconds) {
    const distance = enemy.distance;
    const candidates = [-1, 1].map(direction => {
      const probe = { ...enemy, distance: distance + direction * FEAR_SPEED * Math.max(seconds, .05) };
      this.placeWheel(probe);
      return { direction, separation: Math.hypot(probe.x - this.cat.x, probe.y - this.cat.y) };
    });
    if (Math.abs(candidates[0].separation - candidates[1].separation) > 1e-6) {
      enemy.fleeDirection = candidates[0].separation > candidates[1].separation ? -1 : 1;
    }
    enemy.distance += (enemy.fleeDirection ?? 1) * FEAR_SPEED * seconds;
    this.placeWheel(enemy);
  }

  moveRam(enemy, seconds, parts) {
    let remaining = seconds, bounces = 0;
    while (remaining > 1e-9 && bounces < 4) {
      const dx = Math.cos(enemy.angle) * enemy.speed * remaining;
      const dy = Math.sin(enemy.angle) * enemy.speed * remaining;
      let contact = Infinity, obstacle = null;
      for (const part of parts) {
        const time = brickContact(enemy.x, enemy.y, dx, dy, enemy.radius, part);
        if (time < contact) { contact = time; obstacle = part; }
      }

      if (!obstacle || contact > 1) {
        enemy.x += dx; enemy.y += dy;
        break;
      }
      enemy.x += dx * contact;
      enemy.y += dy * contact;
      const normal = brickNormal(enemy.x, enemy.y, obstacle);
      if (!normal) break;
      enemy.x += normal.x * .01;
      enemy.y += normal.y * .01;
      const vx = Math.cos(enemy.angle), vy = Math.sin(enemy.angle);
      const incoming = vx * normal.x + vy * normal.y;
      enemy.angle = Math.atan2(vy - 2 * incoming * normal.y, vx - 2 * incoming * normal.x);
      enemy.speed *= .78;
      remaining *= 1 - contact;
      bounces++;
    }
  }

  barrierSegments() {
    if (!this.barriers.length) return [];
    const parts = this.brickParts();
    const regions = brickRegions(this.bricks, this.width, this.height);
    return this.barriers.filter(fence => this.bricks[fence.id].barrier
      && this.bricks[fence.id].absorbedBy === null).map(fence => {
      const members = parts.filter(part => part.id === fence.id);
      const left = Math.min(...members.map(part => part.x)), right = Math.max(...members.map(part => part.x + part.w));
      const top = Math.min(...members.map(part => part.y)), bottom = Math.max(...members.map(part => part.y + part.h));
      const edge = regions.get(fence.id).edge;
      const nx = edge === 'left' ? 1 : edge === 'right' ? -1 : 0;
      const ny = edge === 'top' ? 1 : edge === 'bottom' ? -1 : 0;
      const x = nx ? nx > 0 ? right : left : (left + right) / 2;
      const y = ny ? ny > 0 ? bottom : top : (top + bottom) / 2;
      return { ...fence, x, y, nx, ny, endX: x + nx * fence.length, endY: y + ny * fence.length };
    });
  }

  barrierParts() {
    return this.barrierSegments().filter(fence => fence.length > 1e-9).map(fence => ({
      id: fence.id, barrier: true,
      x: Math.min(fence.x, fence.endX) - (fence.ny ? 2 : 0),
      y: Math.min(fence.y, fence.endY) - (fence.nx ? 2 : 0),
      w: fence.nx ? fence.length : 4, h: fence.ny ? fence.length : 4,
    }));
  }

  updateBarriers(seconds) {
    if (!this.barriers.length) return;
    this.barriers = this.barriers.filter(fence => this.bricks[fence.id].barrier
      && this.bricks[fence.id].absorbedBy === null);
    const parts = this.brickParts();
    for (const fence of this.barriers) {
      if (!fence.extending) { fence.length = Math.max(0, fence.length - 180 * seconds); continue; }
      const segment = this.barrierSegments().find(segment => segment.id === fence.id);
      const distance = Math.hypot(this.width, this.height);
      let limit = distance;
      for (const part of [...parts, ...this.barrierParts()]) {
        if (part.id === fence.id) continue;
        if (segment.x >= part.x && segment.x <= part.x + part.w
          && segment.y >= part.y && segment.y <= part.y + part.h) {
          limit = 0;
          continue;
        }
        const contact = brickContact(segment.x, segment.y, segment.nx * distance,
          segment.ny * distance, 0, part);
        if (contact <= 1) limit = Math.min(limit, contact * distance);
      }
      fence.length = Math.min(limit, fence.length + 180 * seconds);
    }
  }

  blockEnemyWithBarriers(enemy, old, parts) {
    const dx = enemy.x - old.x, dy = enemy.y - old.y;
    if (!dx && !dy) return;
    let contact = Infinity, obstacle = null;
    for (const part of parts) {
      const time = brickContact(old.x, old.y, dx, dy, enemy.radius, part);
      if (time < contact) { contact = time; obstacle = part; }
    }

    if (!obstacle || contact > 1) return;
    enemy.x = old.x + dx * contact; enemy.y = old.y + dy * contact;
    const normal = brickNormal(enemy.x, enemy.y, obstacle);
    if (!normal) return;
    enemy.x += normal.x * .01; enemy.y += normal.y * .01;
    const angle = Math.atan2(dy, dx);
    const incoming = Math.cos(angle) * normal.x + Math.sin(angle) * normal.y;
    const reflected = Math.atan2(Math.sin(angle) - 2 * incoming * normal.y,
      Math.cos(angle) - 2 * incoming * normal.x);
    if (enemy.type === 'robo-cow') {
      enemy.distance = old.distance + (enemy.distance - old.distance) * contact;
      enemy.cowDirection = -(enemy.cowDirection ?? 1);
      enemy.fleeDirection = -(enemy.fleeDirection ?? 1);
      this.placeWheel(enemy);
    } else if (enemy.type === 'wheel') {
      enemy.distance = old.distance;
      this.placeWheel(enemy);
      enemy.barrierDirection = -(enemy.barrierDirection ?? 1);
      enemy.fleeDirection = -(enemy.fleeDirection ?? 1);
    } else if (enemy.type === 'ram' && !enemy.afraid) enemy.angle = reflected;
    else enemy.phase = reflected;
  }

  blockEnemyWithBumpers(enemy, old) {
    const dx = enemy.x - old.x, dy = enemy.y - old.y;
    if (!dx && !dy) return;
    let contact = Infinity, bumper = null;
    for (const obstacle of this.bumpers) {
      const time = circleContact(old.x - obstacle.x, old.y - obstacle.y, dx, dy,
        enemy.radius + obstacle.radius);
      if (time < contact) { contact = time; bumper = obstacle; }
    }
    if (!bumper || contact > 1) return;
    const x = old.x + dx * contact, y = old.y + dy * contact;
    const distance = Math.hypot(x - bumper.x, y - bumper.y);
    const normal = distance > 1e-9 ? { x: (x - bumper.x) / distance, y: (y - bumper.y) / distance }
      : { x: -dx / Math.hypot(dx, dy), y: -dy / Math.hypot(dx, dy) };
    const angle = enemy.type === 'ram' && !enemy.afraid ? enemy.angle : enemy.phase;
    const incoming = Math.cos(angle) * normal.x + Math.sin(angle) * normal.y;
    if (incoming >= -1e-9) return;
    enemy.x = bumper.x + normal.x * (enemy.radius + bumper.radius + .01);
    enemy.y = bumper.y + normal.y * (enemy.radius + bumper.radius + .01);
    const reflected = Math.atan2(Math.sin(angle) - 2 * incoming * normal.y,
      Math.cos(angle) - 2 * incoming * normal.x);
    if (enemy.type === 'ram' && !enemy.afraid) enemy.angle = reflected;
    else enemy.phase = reflected;
  }

  clearBarrierOverlap(actor, parts) {
    const bounds = actor.type && !Object.hasOwn(OBJECTS, actor.type) && parts.length ? this.bounds() : null;
    for (const part of parts) {
      const x = Math.max(part.x, Math.min(part.x + part.w, actor.x));
      const y = Math.max(part.y, Math.min(part.y + part.h, actor.y));
      const dx = actor.x - x, dy = actor.y - y, distance = Math.hypot(dx, dy);
      if (distance >= actor.radius) continue;
      let nx, ny, depth;
      if (distance > 1e-9 && (!bounds
        || (actor.x + dx / distance * (actor.radius - distance + .01) >= bounds.left
          && actor.x + dx / distance * (actor.radius - distance + .01) <= bounds.right
          && actor.y + dy / distance * (actor.radius - distance + .01) >= bounds.top
          && actor.y + dy / distance * (actor.radius - distance + .01) <= bounds.bottom))) {
        nx = dx / distance; ny = dy / distance; depth = actor.radius - distance;
      } else {
        const sides = [
          { nx: -1, ny: 0, depth: actor.x - part.x + actor.radius },
          { nx: 1, ny: 0, depth: part.x + part.w - actor.x + actor.radius },
          { nx: 0, ny: -1, depth: actor.y - part.y + actor.radius },
          { nx: 0, ny: 1, depth: part.y + part.h - actor.y + actor.radius },
        ].filter(side => !bounds
          || (actor.x + side.nx * (side.depth + .01) >= bounds.left
            && actor.x + side.nx * (side.depth + .01) <= bounds.right
            && actor.y + side.ny * (side.depth + .01) >= bounds.top
            && actor.y + side.ny * (side.depth + .01) <= bounds.bottom))
          .sort((a, b) => a.depth - b.depth);
        // In a fully enclosed pocket, containment takes priority over separation.
        if (!sides.length) continue;
        ({ nx, ny, depth } = sides[0]);
      }
      actor.x += nx * (depth + .01); actor.y += ny * (depth + .01);
      if (['wheel', 'robo-cow'].includes(actor.type)) {
        const bounds = this.bounds(), w = bounds.right - bounds.left, h = bounds.bottom - bounds.top;
        if (Math.abs(nx) > Math.abs(ny)) {
          actor.x = Math.max(bounds.left, Math.min(bounds.right, actor.x));
          const top = Math.abs(actor.y - bounds.top) < Math.abs(actor.y - bounds.bottom);
          actor.distance = top ? actor.x - bounds.left : w + h + bounds.right - actor.x;
        } else {
          actor.y = Math.max(bounds.top, Math.min(bounds.bottom, actor.y));
          const left = Math.abs(actor.x - bounds.left) < Math.abs(actor.x - bounds.right);
          actor.distance = left ? 2 * w + h + bounds.bottom - actor.y : w + actor.y - bounds.top;
        }
        this.placeWheel(actor);
      }
      if (Number.isFinite(actor.vx) && Number.isFinite(actor.vy)) {
        const incoming = actor.vx * nx + actor.vy * ny;
        if (incoming < 0) { actor.vx -= 2 * incoming * nx; actor.vy -= 2 * incoming * ny; }
      }
    }
    if (bounds) {
      actor.x = Math.max(bounds.left, Math.min(bounds.right, actor.x));
      actor.y = Math.max(bounds.top, Math.min(bounds.bottom, actor.y));
    }
  }

  updateRam(enemy, seconds, parts) {
    if (enemy.state === 'targeting') {
      enemy.stateTime += seconds;
      enemy.facingAngle = rotateToward(enemy.facingAngle, enemy.angle - Math.PI / 2, 4.5 * seconds);
      if (enemy.stateTime >= 1.05) {
        enemy.state = 'charging';
        enemy.stateTime = 0;
        enemy.speed = 520;
      }
      return;
    }
    if (enemy.state === 'charging') {
      const chargeTime = Math.min(seconds, Math.max(0, 1.5 - enemy.stateTime));
      this.moveRam(enemy, chargeTime, parts);
      enemy.facingAngle = rotateToward(enemy.facingAngle, enemy.angle - Math.PI / 2, 4.5 * seconds);
      enemy.stateTime += seconds;
      if (enemy.stateTime >= 1.5) {
        enemy.state = 'wander';
        enemy.stateTime = 0;
        enemy.wanderDuration = 2.5 + this.random() * 1.5;
        enemy.turnTime = .6 + this.random() * 1.4;
      }
      return;
    }
    enemy.stateTime += seconds;
    enemy.turnTime -= seconds;
    if (enemy.turnTime <= 0) {
      enemy.angle += (this.random() - .5) * Math.PI;
      enemy.turnTime = .7 + this.random() * 1.3;
    }
    enemy.angle += Math.sin(enemy.age * 1.7 + enemy.phase) * .2 * seconds;
    const bounds = this.bounds(), speed = 42;
    enemy.x += Math.cos(enemy.angle) * speed * seconds;
    enemy.y += Math.sin(enemy.angle) * speed * seconds;
    if (enemy.x < bounds.left || enemy.x > bounds.right) {
      enemy.x = Math.max(bounds.left, Math.min(bounds.right, enemy.x));
      enemy.angle = Math.PI - enemy.angle;
    }
    if (enemy.y < bounds.top || enemy.y > bounds.bottom) {
      enemy.y = Math.max(bounds.top, Math.min(bounds.bottom, enemy.y));
      enemy.angle = -enemy.angle;
    }
    if (enemy.stateTime >= enemy.wanderDuration) {
      enemy.state = 'targeting';
      enemy.stateTime = 0;
      enemy.targetX = this.cat.x;
      enemy.targetY = this.cat.y;
      enemy.angle = Math.atan2(enemy.targetY - enemy.y, enemy.targetX - enemy.x);
    }
    enemy.facingAngle = rotateToward(enemy.facingAngle, enemy.angle - Math.PI / 2, 4.5 * seconds);
  }

  turnEnemyFromContact(enemy, nx, ny) {
    if (['wheel', 'snake', 'robo-cow'].includes(enemy.type) || (enemy.type === 'mouse' && enemy.resting)
      || (!enemy.afraid && enemy.type === 'ram' && enemy.state === 'targeting')) return;
    const angle = enemy.type === 'ram' && !enemy.afraid ? enemy.angle : enemy.phase;
    const vx = Math.cos(angle), vy = Math.sin(angle);
    const incoming = vx * nx + vy * ny;
    if (incoming >= -1e-9) return;
    const reflected = Math.atan2(vy - 2 * incoming * ny, vx - 2 * incoming * nx);
    if (enemy.type === 'ram' && !enemy.afraid) {
      enemy.angle = reflected;
      if (enemy.state === 'charging') enemy.speed *= .78;
    } else enemy.phase = reflected;
  }

  separateEnemyPair(a, b, nx, ny, overlap) {
    const bounds = this.bounds();
    const clamp = enemy => {
      enemy.x = Math.max(bounds.left, Math.min(bounds.right, enemy.x));
      enemy.y = Math.max(bounds.top, Math.min(bounds.bottom, enemy.y));
    };
    const aPerimeter = ['wheel', 'snake', 'robo-cow'].includes(a.type), bPerimeter = ['wheel', 'snake', 'robo-cow'].includes(b.type);
    const aEating = a.type === 'robo-cow' && a.cowEating, bEating = b.type === 'robo-cow' && b.cowEating;
    if (aEating && bEating) return;
    if ((aEating || bEating) && !(aPerimeter && bPerimeter)) {
      const other = aEating ? b : a, sign = aEating ? -1 : 1;
      other.x += sign * nx * overlap; other.y += sign * ny * overlap;
      clamp(other);
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius) {
        const radius = a.radius + b.radius + 1e-7;
        other.x = Math.max(bounds.left + radius, Math.min(bounds.right - radius, other.x));
        other.y = Math.max(bounds.top + radius, Math.min(bounds.bottom - radius, other.y));
      }
      return;
    }
    if (a.type === 'goalie' && b.type === 'goalie') {
      const leader = (a.goaliePushPriority ?? a.y) >= (b.goaliePushPriority ?? b.y) ? a : b;
      const yielding = leader === a ? b : a;
      const sign = yielding === a ? 1 : -1;
      yielding.x += nx * overlap * sign;
      yielding.y += ny * overlap * sign;
      clamp(yielding);
      const radius = a.radius + b.radius + 1e-7;
      if (Math.hypot(a.x - b.x, a.y - b.y) < radius) {
        const area = this.goalieArea(yielding);
        if (area) {
          const tangent = area.vertical ? yielding.y - leader.y : yielding.x - leader.x;
          const clearance = Math.sqrt(Math.max(0, radius * radius - tangent * tangent));
          if (area.vertical) yielding.x = leader.x + area.inward * clearance;
          else yielding.y = leader.y + area.inward * clearance;
          clamp(yielding);
        }
      }
      return;
    } else if (aPerimeter && bPerimeter) {
      const perimeter = 2 * (bounds.right - bounds.left + bounds.bottom - bounds.top);
      const ahead = ((b.distance - a.distance) % perimeter + perimeter) % perimeter;
      const behind = aEating ? b : bEating ? a : ahead > 0 && ahead < perimeter / 2 ? a : b;
      const distance = behind.distance;
      if (a.type === 'snake' || b.type === 'snake' || a.owner?.type === 'snake' || b.owner?.type === 'snake') {
        const other = behind === a ? b : a, radius = a.radius + b.radius + 1e-7;
        const w = bounds.right - bounds.left, h = bounds.bottom - bounds.top;
        // Solve separation along each straight edge instead of probing the route forty times.
        for (let edge = 0; edge < 5; edge++) {
          const d = ((behind.distance % perimeter) + perimeter) % perimeter;
          let tx, ty, remaining;
          if (d > 2 * w + h || d === 0) { tx = 0; ty = 1; remaining = d === 0 ? h : d - 2 * w - h; }
          else if (d > w + h) { tx = 1; ty = 0; remaining = d - w - h; }
          else if (d > w) { tx = 0; ty = -1; remaining = d - w; }
          else { tx = -1; ty = 0; remaining = d; }
          const x = behind.x - other.x, y = behind.y - other.y;
          const projection = x * tx + y * ty;
          const exit = -projection + Math.sqrt(Math.max(0, projection * projection - (x * x + y * y - radius * radius)));
          const offset = Math.min(remaining, Math.max(0, exit));
          behind.distance -= offset;
          this.placeWheel(behind);
          if (exit <= remaining) return;
        }
        return;
      }
      let low = 0, high = (a.radius + b.radius) * 2;
      for (let i = 0; i < 40; i++) {
        const offset = (low + high) / 2;
        behind.distance = distance - offset;
        this.placeWheel(behind);
        if (Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius + 1e-7) low = offset;
        else high = offset;
      }
      behind.distance = distance - high;
      this.placeWheel(behind);
      return;
    }
    if (aPerimeter || bPerimeter) {
      const wheel = aPerimeter ? a : b, other = wheel === a ? b : a;
      const radius = a.radius + b.radius + 1e-7;
      // Nudge inward, rather than trapping a roaming enemy between wheels at a corner.
      other.x = Math.max(bounds.left + radius, Math.min(bounds.right - radius, other.x));
      other.y = Math.max(bounds.top + radius, Math.min(bounds.bottom - radius, other.y));
    } else {
      a.x += nx * overlap / 2; a.y += ny * overlap / 2;
      b.x -= nx * overlap / 2; b.y -= ny * overlap / 2;
      clamp(a); clamp(b);
      const remaining = a.radius + b.radius - Math.hypot(a.x - b.x, a.y - b.y);
      if (remaining > 0) {
        a.x += nx * remaining; a.y += ny * remaining; clamp(a);
        const residual = a.radius + b.radius - Math.hypot(a.x - b.x, a.y - b.y);
        if (residual > 0) { b.x -= nx * residual; b.y -= ny * residual; clamp(b); }
      }
    }
  }

  resolveEnemyCollisions(previous) {
    const reacted = new Set();
    const react = (a, b, nx, ny, key) => {
      if (reacted.has(key)) return;
      reacted.add(key);
      this.turnEnemyFromContact(a, nx, ny);
      this.turnEnemyFromContact(b, -nx, -ny);
    };
    for (let i = 0; i < this.robots.length; i++) {
      for (let j = i + 1; j < this.robots.length; j++) {
        const a = this.robots[i], b = this.robots[j], oldA = previous.get(a), oldB = previous.get(b);
        if (a.type === 'robo-koshi' || b.type === 'robo-koshi') continue;
        // Goalie priority preserves the leader's full step; overlap resolution moves only the yielding guard.
        if (a.type === 'goalie' && b.type === 'goalie') continue;
        const x = oldA.x - oldB.x, y = oldA.y - oldB.y, radius = a.radius + b.radius;
        const dx = a.x - b.x - x, dy = a.y - b.y - y;
        const length = dx * dx + dy * dy, incoming = x * dx + y * dy;
        const gap = x * x + y * y - radius * radius;
        const discriminant = incoming * incoming - length * gap;
        if (gap < -1e-7 || length < 1e-12 || incoming >= 0 || discriminant < 0) continue;
        const contact = (-incoming - Math.sqrt(discriminant)) / length;
        if (contact < -1e-9 || contact > 1) continue;
        const time = Math.max(0, contact);
        const nx = (x + dx * time) / radius, ny = (y + dy * time) / radius;
        react(a, b, nx, ny, i * this.robots.length + j);
        for (const [enemy, old] of [[a, oldA], [b, oldB]]) {
          if (['wheel', 'snake', 'robo-cow'].includes(enemy.type)) continue;
          enemy.x = old.x + (enemy.x - old.x) * time;
          enemy.y = old.y + (enemy.y - old.y) * time;
        }
      }
    }
    // Repeat separation so nudges also settle chains and coincident spawns.
    for (let pass = 0; pass < Math.max(64, this.robots.length * 32); pass++) {
      let overlaps = false;
      for (let i = 0; i < this.robots.length; i++) {
        for (let j = i + 1; j < this.robots.length; j++) {
          const a = this.robots[i], b = this.robots[j];
          if (a.type === 'robo-koshi' || b.type === 'robo-koshi') continue;
          const x = a.x - b.x, y = a.y - b.y, distance = Math.hypot(x, y);
          const overlap = a.radius + b.radius - distance;
          if (overlap <= 1e-7) continue;
          overlaps = true;
          const angle = (i + j * this.robots.length) * 2.399963229728653;
          const nx = distance > 1e-9 ? x / distance : Math.cos(angle);
          const ny = distance > 1e-9 ? y / distance : Math.sin(angle);
          react(a, b, nx, ny, i * this.robots.length + j);
          this.separateEnemyPair(a, b, nx, ny, overlap + 1e-7);
        }
      }
      if (!overlaps) break;
    }
  }

  resolveSnakeBodyCollisions(previous) {
    const snakes = this.robots.filter(enemy => enemy.type === 'snake');
    if (!snakes.length || this.robots.length < 2) return;
    const geometry = new Map();
    const segmentsFor = enemy => {
      const cached = geometry.get(enemy);
      if (cached?.distance === enemy.distance) return cached.segments;
      if (cached) {
        for (const part of cached.segments) {
          part.distance = enemy.distance - part.index * 38;
          this.placeWheel(part);
        }
        cached.distance = enemy.distance;
        return cached.segments;
      }
      const segments = this.snakeSegments(enemy);
      for (const part of segments) {
        part.radius += part.index ? 5 : 0;
        part.type = 'wheel';
        part.owner = enemy;
      }
      geometry.set(enemy, { distance: enemy.distance, segments });
      return segments;
    };
    const nearby = (snake, other) => {
      const reach = 114 + 24 + (other.type === 'snake' ? 114 + 24 : other.radius);
      return (snake.x - other.x) ** 2 + (snake.y - other.y) ** 2 <= reach * reach;
    };
    const roaming = this.robots.filter(enemy => !['wheel', 'snake', 'robo-koshi'].includes(enemy.type));
    for (const snake of snakes) {
      if (!roaming.length) break;
      const before = this.snakeSegments({ ...snake, distance: previous.get(snake).distance });
      for (const segment of segmentsFor(snake).slice(1)) {
        for (const other of roaming) {
          if (other.type === 'robo-cow' && other.cowEating) continue;
          const old = previous.get(other), oldSegment = before[segment.index];
          const x = old.x - oldSegment.x, y = old.y - oldSegment.y;
          const dx = other.x - segment.x - x, dy = other.y - segment.y - y;
          const radius = other.radius + segment.radius, contact = circleContact(x, y, dx, dy, radius);
          if (contact > 1) continue;
          const nx = (x + dx * contact) / radius, ny = (y + dy * contact) / radius;
          this.turnEnemyFromContact(other, nx, ny);
          other.x = old.x + (other.x - old.x) * contact;
          other.y = old.y + (other.y - old.y) * contact;
        }
      }
    }
    for (let pass = 0; pass < 8; pass++) {
      let overlaps = false;
      for (const snake of snakes) {
        const others = this.robots.filter(enemy => enemy !== snake && enemy.type !== 'robo-koshi' && nearby(snake, enemy));
        if (!others.length) continue;
        for (const segment of segmentsFor(snake).slice(1)) {
          for (const actor of others) for (const other of actor.type === 'snake' ? segmentsFor(actor) : [actor]) {
            const x = segment.x - other.x, y = segment.y - other.y, distance = Math.hypot(x, y);
            const radius = segment.radius, overlap = radius + other.radius - distance;
            if (overlap <= 1e-7) continue;
            overlaps = true;
            const nx = distance > 1e-9 ? x / distance : Math.cos(segment.angle + Math.PI / 2);
            const ny = distance > 1e-9 ? y / distance : Math.sin(segment.angle + Math.PI / 2);
            const probe = { ...segment, radius, type: 'wheel' };
            this.turnEnemyFromContact(other, -nx, -ny);
            this.separateEnemyPair(probe, other, nx, ny, overlap);
            snake.distance += probe.distance - segment.distance;
            this.placeWheel(snake);
            if (other.owner) {
              other.owner.distance = other.distance + other.index * 38;
              this.placeWheel(other.owner);
            }
          }
        }
      }
      if (!overlaps) break;
    }
  }

  combat(dt, startX, startY) {
    if (this.weapon && this.weapon.expires <= this.elapsed + 1e-9) this.weapon = null;
    const collected = [];
    const dx = this.cat.x - startX, dy = this.cat.y - startY, length = Math.hypot(dx, dy);
    const reach = this.cat.radius + 14;
    this.weapons = this.weapons.filter(item => {
      if (item.expires != null && item.expires <= this.elapsed + 1e-9) return false;
      if (distanceToSegment(item.x, item.y, startX, startY, this.cat.x, this.cat.y) > reach) return true;
      const x = item.x - startX, y = item.y - startY;
      const along = length ? (x * dx + y * dy) / length : 0;
      const across = length ? (x * dy - y * dx) / length : 0;
      collected.push({ item, entry: Math.max(0, along - Math.sqrt(Math.max(0, reach ** 2 - across ** 2))) });
      return false;
    });
    // Swept pickups replace the sword in encounter order, not spawn-array order.
    for (const { item } of collected.sort((a, b) => a.entry - b.entry)) {
      const sword = SWORDS[item.type];
      this.weapon = { type: item.type, uses: sword.uses, expires: sword.seconds ? this.elapsed + sword.seconds : Infinity };
      this.recordPickup(item, 'weapon');
    }
    const collectedItems = [];
    this.items = this.items.filter(item => {
      if (item.expires != null && item.expires <= this.elapsed + 1e-9) return false;
      if (distanceToSegment(item.x, item.y, startX, startY, this.cat.x, this.cat.y) > reach) return true;
      if (item.type === 'treasure-chest' && this.keys < (item.keysRequired ?? 1)) return true;
      const x = item.x - startX, y = item.y - startY;
      const along = length ? (x * dx + y * dy) / length : 0;
      const across = length ? (x * dy - y * dx) / length : 0;
      collectedItems.push({ item, entry: Math.max(0, along - Math.sqrt(Math.max(0, reach ** 2 - across ** 2))) });
      return false;
    });
    for (const { item } of collectedItems.sort((a, b) => a.entry - b.entry)) {
      if (this.catBlockCollected && this.isCatBlockSource(item)) continue;
      this.collectItem(item);
      this.recordPickup(item, 'item');
    }
    this.robots = this.robots.filter(enemy => {
      if (enemy.type !== 'goalie' || this.goalieArea(enemy)) return true;
      this.defeatEnemy(enemy, false);
      return false;
    });
    const fences = this.barrierParts();
    const bounds = this.bounds(), parts = this.robots.some(enemy => ['ram', 'bucket', 'ball', 'jackolantern'].includes(enemy.type))
      ? [...this.brickParts(), ...fences] : [];
    const previous = new Map(this.robots.map(enemy => [enemy, { x: enemy.x, y: enemy.y, distance: enemy.distance }]));
    for (const enemy of this.robots) {
      if (enemy.type !== 'snake' && enemy.type !== 'robo-koshi') this.clearBarrierOverlap(enemy, fences);
      if (enemy.type !== 'goalie') previous.set(enemy, { x: enemy.x, y: enemy.y, distance: enemy.distance });
    }
    for (const enemy of this.robots) {
      enemy.age += dt;
      enemy.asleep = this.enemiesSleepUntil > this.elapsed + 1e-9;
      if (enemy.type === 'robo-cow') this.updateRoboCowFear(enemy);
      enemy.afraid = this.maskActive;
      enemy.fleeMoving = false;
      if (enemy.asleep) { enemy.touching = false; continue; }
      if (enemy.type === 'robo-koshi') {
        this.moveRoboKoshi(enemy, dt);
      } else if (enemy.type === 'goalie') {
        this.moveGoalie(enemy, dt);
      } else if (enemy.afraid) {
        enemy.resting = false;
        if (['wheel', 'snake', 'robo-cow'].includes(enemy.type)) this.moveAfraidWheel(enemy, dt);
        else this.moveAfraidEnemy(enemy, dt);
        if (enemy.type === 'bucket') this.updateBucket(enemy, dt, parts);
        if (enemy.type === 'jackolantern') this.updateJackolantern(enemy, dt, parts, startX, startY);
      } else if (['wheel', 'snake'].includes(enemy.type)) {
        enemy.distance += (enemy.barrierDirection ?? 1) * 95 * dt; this.placeWheel(enemy);
      } else if (enemy.type === 'robo-cow') {
        this.updateRoboCow(enemy, dt);
      } else if (enemy.type === 'robo-unicorn') {
        this.updateRoboUnicorn(enemy, dt, bounds);
      } else if (enemy.type === 'ram') {
        this.updateRam(enemy, dt, parts);
      } else if (enemy.type === 'bucket') {
        this.updateBucket(enemy, dt, parts);
      } else if (enemy.type === 'ball') {
        this.moveBall(enemy, dt, parts);
      } else if (enemy.type === 'jackolantern') {
        this.updateJackolantern(enemy, dt, parts, startX, startY);
      } else if (enemy.type === 'robo-snail') {
        enemy.resting = false;
        enemy.phase += Math.sin(enemy.age * 1.7 + enemy.phase) * dt;
        enemy.x += Math.cos(enemy.phase) * 85 * dt;
        enemy.y += Math.sin(enemy.phase) * 85 * dt;
        if (enemy.x < bounds.left || enemy.x > bounds.right) enemy.phase = Math.PI - enemy.phase;
        if (enemy.y < bounds.top || enemy.y > bounds.bottom) enemy.phase = -enemy.phase;
        enemy.x = Math.max(bounds.left, Math.min(bounds.right, enemy.x));
        enemy.y = Math.max(bounds.top, Math.min(bounds.bottom, enemy.y));
      } else {
        enemy.resting = enemy.age % 6 >= 4.5;
        if (!enemy.resting) {
          enemy.phase += Math.sin(enemy.age * 1.7 + enemy.phase) * dt;
          enemy.x += Math.cos(enemy.phase) * 75 * dt;
          enemy.y += Math.sin(enemy.phase) * 75 * dt;
          if (enemy.x < bounds.left || enemy.x > bounds.right) enemy.phase = Math.PI - enemy.phase;
          if (enemy.y < bounds.top || enemy.y > bounds.bottom) enemy.phase = -enemy.phase;
          enemy.x = Math.max(bounds.left, Math.min(bounds.right, enemy.x));
          enemy.y = Math.max(bounds.top, Math.min(bounds.bottom, enemy.y));
        }
      }
    }
    for (const enemy of this.robots) {
      if (enemy.type !== 'robo-koshi') this.blockEnemyWithObstructions(enemy, previous.get(enemy));
    }
    this.resolveEnemyCollisions(previous);
    this.resolveSnakeBodyCollisions(previous);
    for (const enemy of this.robots) {
      if (enemy.type === 'robo-koshi') continue;
      if (enemy.type === 'snake') this.blockSnakeWithBarriers(enemy, previous.get(enemy), fences);
      else {
        if (enemy.type !== 'robo-cow' || enemy.afraid) this.blockEnemyWithBarriers(enemy, previous.get(enemy), fences);
        this.clearBarrierOverlap(enemy, fences);
      }
      if (enemy.type === 'jackolantern') this.releaseJackolanternStomp(enemy, parts);
    }
    for (const enemy of this.robots) {
      const old = previous.get(enemy);
      if (enemy.roboPathTarget) {
        enemy.x = enemy.roboPathTarget.x;
        enemy.y = enemy.roboPathTarget.y;
      }
      if (enemy.type === 'goalie') {
        const dx = enemy.x - old.x, dy = enemy.y - old.y;
        const distance = Math.hypot(dx, dy);
        const limit = enemy.asleep ? 0 : GOALIE_MAX_SPEED * dt;
        // Bound the complete step, including every collision and barrier push-out.
        if (distance > limit) {
          enemy.x = old.x + dx * limit / distance;
          enemy.y = old.y + dy * limit / distance;
        }
      }
      if (enemy.type !== 'robo-koshi') this.blockEnemyWithBumpers(enemy, old);
      enemy.fleeMoving = enemy.afraid && !enemy.asleep && Math.hypot(enemy.x - old.x, enemy.y - old.y) > 1e-8;
      if (enemy.fleeMoving) enemy.fleeTrailAngle = Math.atan2(old.y - enemy.y, old.x - enemy.x);
      if (enemy.type === 'robo-cow') {
        this.placeWheel(enemy);
        if (!enemy.asleep) this.updateRoboCowFacing(enemy, dt);
      }
      if (enemy.type !== 'robo-koshi') this.blockEnemyWithObstructions(enemy, old);
      if (enemy.type === 'robo-unicorn' && enemy.unicornState === 'charge' && enemy.mouthOpen) {
        let ateFood = false;
        this.food = this.food.filter(food => {
          if (distanceToSegment(food.x, food.y, old.x, old.y, enemy.x, enemy.y) > enemy.radius + 12) return true;
          ateFood = true;
          return false;
        });
        if (ateFood) {
          enemy.unicornState = 'roam';
          enemy.unicornStateTime = 0;
          enemy.nextRestAt = enemy.age + 2 + this.random() * 2;
          enemy.mouthOpen = false;
        }
      }
    }
    this.updateSoccerBalls(dt, startX, startY, previous);
    this.robots = this.robots.filter(enemy => {
      const old = previous.get(enemy);
      if (enemy.type === 'snake') {
        const oldSegments = this.snakeSegments({ ...enemy, distance: old.distance });
        const segments = this.snakeSegments(enemy);
        for (let index = 1; index < 4; index++) {
          if (distanceToSegment(0, 0, startX - oldSegments[index].x, startY - oldSegments[index].y,
            this.cat.x - segments[index].x, this.cat.y - segments[index].y) <= this.cat.radius + segments[index].radius + 5) this.takeDamage();
        }
      }
      const distance = distanceToSegment(0, 0, startX - old.x, startY - old.y, this.cat.x - enemy.x, this.cat.y - enemy.y);
      if (!this.activeTurret && (this.weapon || this.boosted) && distance <= this.cat.radius + enemy.radius + 18) {
        if (this.enemyDamageProgress(enemy) === null) {
          if (!this.boosted && Number.isFinite(this.weapon.uses) && --this.weapon.uses === 0) this.weapon = null;
          if (enemy.shield) {
            enemy.shield = SHIELDS[enemy.shield].next;
            enemy.invulnerableUntil = this.elapsed + DAMAGE_DURATION;
          } else {
            this.defeatEnemy(enemy);
            return false;
          }
        }
        enemy.touching = Math.hypot(this.cat.x - enemy.x, this.cat.y - enemy.y) <= this.cat.radius + enemy.radius;
        return true;
      }
      if (enemy.type !== 'goalie' && !enemy.asleep && !enemy.afraid && distance <= this.cat.radius + enemy.radius
        && (!enemy.touching || enemy.type === 'robo-koshi') && this.enemyDamageProgress(enemy) === null) this.takeDamage();
      enemy.touching = Math.hypot(this.cat.x - enemy.x, this.cat.y - enemy.y) <= this.cat.radius + enemy.radius;
      return true;
    });
    if (this.hearts <= 0) return;
    this.healing = this.healing.filter(item => {
      if (distanceToSegment(item.x, item.y, startX, startY, this.cat.x, this.cat.y) > this.cat.radius + 13) return true;
      this.hearts = Math.min(3, this.hearts + 1);
      return false;
    });
  }

  isCatBlockSource(item) {
    return item.type === 'cat-block' || item.type === 'treasure-chest';
  }

  availableSpawns(items) {
    if (!this.catBlockCollected) return items;
    return items.filter(item => {
      if (item.carriesCatBlock) item.carriesCatBlock = false;
      return !this.isCatBlockSource(item);
    });
  }

  collectCatBlock(source) {
    if (this.catBlockCollected) return;
    this.catBlockCollected = true;
    this.catBlockEvents.push(source);
    this.items = this.availableSpawns(this.items);
    for (const enemy of this.robots) enemy.carriesCatBlock = false;
    for (const pending of this.pendingSpawns.values()) pending.items = this.availableSpawns(pending.items);
  }

  collectItem(item) {
    if (item.type === 'cat-block') {
      this.collectCatBlock(item.source ?? 'item');
    } else if (item.type === 'key') this.keys++;
    else if (item.type === 'treasure-chest') {
      if (this.catBlockCollected) return false;
      const keysRequired = item.keysRequired ?? 1;
      if (this.keys < keysRequired) return false;
      this.keys -= keysRequired;
      this.collectCatBlock('chest');
    } else if (ITEMS[item.type]?.paintUses) {
      this.paintBrush = { type: item.type, uses: ITEMS[item.type].paintUses };
    } else if (item.type === 'smiley-cookie') {
      this.cookieActive = true;
      this.cookieLickUntil = 0;
    } else if (ITEMS[item.type]?.seconds) this.timeBonus += ITEMS[item.type].seconds;
    else if (ITEMS[item.type]?.counts && this.activationsRemaining !== null && this.state === 'playing') {
      this.activationsRemaining += ITEMS[item.type].counts;
    }
    else if (item.type === 'battery') this.batteries++;
    else if (item.type === 'music-box') {
      this.musicStreamStart = this.elapsed;
      this.musicStreamUntil = this.elapsed + MUSIC_STREAM_DURATION;
      this.musicPickup = { age: 0 };
      this.enemiesSleepUntil = this.musicStreamUntil;
    }
    else if (item.type === 'eggplant') this.score = Math.max(0, this.score - 10);
    else if (item.type === 'saw-blade' && this.sawStartedAt === null) this.sawStartedAt = this.elapsed;
    else if (item.type === 'ditto-stamp' && !this.dittoStamp) {
      this.dittoStamp = true;
      this.dittoSource = null;
    }
    else if (item.type === 'spooky-mask') {
      this.maskUntil = this.elapsed + MASK_DURATION;
      this.maskPickup = { x: item.x ?? this.cat.x, y: item.y ?? this.cat.y, age: 0 };
      for (const enemy of this.robots) if (enemy.type === 'robo-cow') this.updateRoboCowFear(enemy);
    }
    else if (item.type === 'magic-sunglasses') {
      this.sunglassesStart = this.elapsed;
      this.sunglassesUntil = this.elapsed + SUNGLASSES_DURATION;
      this.sunglassesPickup = { x: item.x ?? this.cat.x, y: item.y ?? this.cat.y, age: 0 };
    }
    else if (item.type === 'kitty-cape') {
      this.setCapeSpeed(CAPE_SPEED_MULTIPLIER);
      this.capeStart = this.elapsed;
      this.capeUntil = this.elapsed + CAPE_DURATION;
      this.capePickup = { age: 0 };
    }
  }

  sawBrick(brick, parts) {
    if (this.sawStartedAt === null || ['cinder', 'goal'].includes(brick.kind)) return false;
    this.convertBrickToCinder(brick, parts);
    this.sawStartedAt = null;
    return true;
  }

  convertBrickToCinder(brick, parts) {
    if (!brick || ['cinder', 'goal'].includes(brick.kind)) return false;
    const members = parts.filter(part => part.id === brick.id).map(part => ({ ...part }));
    this.brickDestructions.push({ id: brick.id, members, age: 0 });
    const portal = brick.portal;
    for (const member of this.bricks) {
      if (member.id === brick.id || member.absorbedBy === brick.id) {
        member.kind = 'cinder';
        member.crumbler = null; member.warped = null; member.warpUntil = null;
        member.usesLeft = null; member.readyAt = 0;
        member.toggle = null; member.toggleRemaining = 0;
        member.slimed = false; member.springs = false; member.spikes = false;
        member.conveyor = false; member.portal = null; member.spawner = null; member.boost = false; member.barrier = false;
        member.hitAt = null; member.hitNormal = null; member.hitPoint = null;
        member.initialOwner = member.id === brick.id ? null : brick.id;
        member.absorbedBy = member.initialOwner;
      } else if (portal && member.portal === portal) member.portal = null;
    }
    this.brickRevision++;
    return true;
  }

  paintBricks(contacts, sawed) {
    for (const id of new Set(contacts.map(part => part.id))) {
      if (this.paintTouching.has(id)) continue;
      this.paintTouching.add(id);
      const brick = this.bricks[id];
      if (!this.paintBrush || sawed || ['cinder', 'goal'].includes(brick.kind)) continue;
      const paint = ITEMS[this.paintBrush.type];
      if (brick.kind === paint.paintKind) continue;
      for (const member of this.bricks) {
        if (member.id !== id && member.absorbedBy !== id) continue;
        member.kind = paint.paintKind;
        member.readyAt = 0;
      }
      this.brickRevision++;
      if (--this.paintBrush.uses === 0) this.paintBrush = null;
    }
  }

  stampBrick(brick, parts) {
    if (!this.dittoStamp || brick.portal || brick.kind === 'goal') return false;
    const capturing = !this.dittoSource;
    if (capturing && brick.springs) return false;
    const members = parts.filter(part => part.id === brick.id).map(part => ({ ...part }));
    const left = Math.min(...members.map(part => part.x));
    const right = Math.max(...members.map(part => part.x + part.w));
    const top = Math.min(...members.map(part => part.y));
    const bottom = Math.max(...members.map(part => part.y + part.h));
    const edge = brickRegions(this.bricks, this.width, this.height).get(brick.id).edge;
    if (capturing) this.dittoSource = dittoProperties(brick);
    const properties = this.dittoSource;
    if (!capturing) this.brickStamps = this.brickStamps.filter(effect => !effect.capturing);
    this.brickStamps.push({ id: brick.id, members, kind: properties.kind, capturing,
      x: (left + right) / 2, y: (top + bottom) / 2,
      angle: { top: Math.PI, bottom: 0, left: Math.PI / 2, right: -Math.PI / 2 }[edge],
      fromX: this.cat.x + 33, fromY: this.cat.y - 22, age: 0 });
    if (capturing) return true;
    this.barriers = this.barriers.filter(fence => fence.id !== brick.id);
    for (const member of this.bricks) {
      if (member.id !== brick.id && member.absorbedBy !== brick.id) continue;
      Object.assign(member, dittoProperties(properties));
      member.readyAt = 0;
      member.usesLeft = member.crumbler ?? null;
      member.toggleRemaining = member.toggle ?? 0;
      member.spawned = false;
      member.warpUntil = null;
      member.hitAt = null; member.hitNormal = null; member.hitPoint = null;
      // Keep the current union, even if its former warp would have split it later.
      member.initialOwner = member.id === brick.id ? null : brick.id;
      member.absorbedBy = member.initialOwner;
    }
    this.spawnerTouching.delete(brick.id);
    this.spikeTouching.delete(brick.id);
    this.dittoStamp = false;
    this.dittoSource = null;
    this.brickRevision++;
    return true;
  }

  updateBrickDestructions(seconds) {
    this.brickDestructions = this.brickDestructions.filter(effect => {
      effect.age += seconds;
      return effect.age < 1 - 1e-9;
    });
    this.brickStamps = this.brickStamps.filter(effect => {
      effect.age += seconds;
      return effect.age < .65 - 1e-9;
    });
  }

  attractFoodToCat(seconds, x, y) {
    if (!this.cookieActive) return;
    const speed = 520;
    for (const food of this.food) {
      const dx = x - food.x, dy = y - food.y, distance = Math.hypot(dx, dy);
      if (distance <= speed * seconds) {
        food.x = x; food.y = y;
      } else {
        food.x += dx / distance * speed * seconds;
        food.y += dy / distance * speed * seconds;
      }
    }
    if (!this.food.length) {
      this.cookieActive = false;
      this.cookieLickUntil = this.elapsed + 1.2;
    }
  }

  updateEnemyDeaths(seconds) {
    this.enemyDeaths = this.enemyDeaths.filter(enemy => {
      enemy.deathProgress += seconds / (enemy.type === 'robo-cow' ? 2.1 : enemy.type === 'robo-unicorn' ? 2 : enemy.type === 'goalie' ? 1.8 : ['jackolantern', 'snake'].includes(enemy.type) ? 1.2 : ['ball', 'mouse', 'robo-koshi'].includes(enemy.type) ? 1.1 : ['ram', 'bucket', 'robo-snail'].includes(enemy.type) ? .9 : .7);
      return enemy.deathProgress < 1 - 1e-9;
    });
  }

  recordPickup(item, kind, value = null) {
    this.pickups.push({ x: item.x, y: item.y, type: item.type, kind, value, time: this.elapsed, age: 0 });
  }

  updatePickups(seconds) {
    if (this.snailStreamStart !== null) this.snailStreamAge += seconds;
    if (this.musicPickup) {
      this.musicPickup.age += seconds;
      if (this.musicPickup.age >= MUSIC_STREAM_DURATION - 1e-9) this.musicPickup = null;
    }
    if (this.boomHelmet) this.boomHelmet.age += seconds;
    if (this.maskPickup) {
      this.maskPickup.age += seconds;
      if (this.maskPickup.age >= MASK_DURATION + .5 - 1e-9) this.maskPickup = null;
    }
    if (this.sunglassesPickup) {
      this.sunglassesPickup.age += seconds;
      if (this.sunglassesPickup.age >= SUNGLASSES_DURATION + .5) this.sunglassesPickup = null;
    }
    if (this.capePickup) {
      this.capePickup.age += seconds;
      if (this.capePickup.age >= CAPE_DURATION - 1e-9) this.capePickup = null;
    }
    this.pickups = this.pickups.filter(pickup => {
      pickup.age += seconds;
      return pickup.age < (pickup.type === 'treasure-chest' ? 1.6 : .8) - 1e-9;
    });
  }

  updateBubbleTrap(seconds) {
    const trap = this.bubbleTrap;
    if (!trap) return;
    trap.age += seconds;
    if (trap.age >= trap.transition + trap.duration - 1e-9) {
      this.cat.x = trap.x;
      this.cat.y = trap.y;
      this.bubblePops.push({ x: trap.x, y: trap.y, color: trap.color, age: 0 });
      this.bubbleTrap = null;
      return;
    }
    const progress = Math.min(1, trap.age / trap.transition);
    const smooth = progress * progress * (3 - 2 * progress);
    this.cat.x = trap.fromX + (trap.x - trap.fromX) * smooth;
    this.cat.y = trap.fromY + (trap.y - trap.fromY) * smooth;
  }

  updateBubblePops(seconds) {
    this.bubblePops = this.bubblePops.filter(pop => {
      pop.age += seconds;
      return pop.age < .55 - 1e-9;
    });
  }

  update(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    if (this.state === 'won' || this.state === 'lost') {
      this.updateEnemyDeaths(seconds);
      this.updateGoalEffects(seconds);
      this.updatePickups(seconds);
      this.updateBrickDestructions(seconds);
      this.updateObstructionDestructions(seconds);
      this.updateBubblePops(seconds);
    }
    if (this.state !== 'playing') return;
    let remaining = Math.min(seconds, this.timeLimit - this.elapsed);
    while (remaining > 1e-9 && this.state === 'playing') {
      let dt = Math.min(remaining, 1 / 120);
      if (this.conveyorRide) {
        const edge = this.conveyorEdge(this.conveyorRide.id, this.brickParts());
        if (edge) {
          const sign = this.bricks[this.conveyorRide.id].conveyorDirection === 'counterclockwise' ? -1 : 1;
          dt = Math.min(dt, Math.max(0, sign > 0 ? edge.length - edge.along : edge.along) / CONVEYOR_SPEED);
        }
      }
      this.tick(dt);
      remaining -= dt;
    }
  }

  tick(dt) {
    this.tickStart = { time: this.elapsed, x: this.cat.x, y: this.cat.y };
    this.updateEnemyDeaths(dt);
    this.updateGoalEffects(dt);
    this.updatePickups(dt);
    this.updateBrickDestructions(dt);
    this.updateObstructionDestructions(dt);
    this.updateBubblePops(dt);
    const sunglassesWereActive = this.sunglassesActive;
    const capeWasActive = this.capeActive;
    this.elapsed = Math.min(this.timeLimit, this.elapsed + dt);
    if (capeWasActive && !this.capeActive) this.setCapeSpeed(1);
    if (sunglassesWereActive && !this.sunglassesActive) {
      if (this.snailCooldownFreezeUntil <= this.elapsed + 1e-9) {
        for (const brick of this.bricks) brick.readyAt = Math.min(brick.readyAt, this.sunglassesUntil);
      }
    }
    if (this.stuckUntil && this.stuckUntil <= this.elapsed + 1e-9) {
      this.releasedAt = this.stuckUntil;
      this.stuckUntil = 0;
    }
    this.updateBubbleTrap(dt);
    this.restoreWarps();
    this.updateBarriers(dt);
    this.prepareSpawns();
    this.spawnCustomEvents();
    if (this.state !== 'playing') { this.tickStart = null; return; }
    while (this.nextEvent < this.level.food.length && this.level.food[this.nextEvent][0] <= this.elapsed + 1e-9) {
      this.spawn(this.level.food[this.nextEvent++]);
    }
    while (this.nextEnemy < this.level.enemies.length && this.level.enemies[this.nextEnemy][0] <= this.elapsed + 1e-9) this.spawnEnemies(this.level.enemies[this.nextEnemy++]);
    while (this.nextWeapon < this.level.weapons.length && this.level.weapons[this.nextWeapon][0] <= this.elapsed + 1e-9) {
      const event = this.level.weapons[this.nextWeapon++];
      this.weapons.push(...this.takeSpawn(event, ([time, type, lifetime]) => [this.createCollectible(time, type, lifetime)]));
    }
    const itemEvents = this.level.items ?? [];
    while (this.nextItem < itemEvents.length && itemEvents[this.nextItem][0] <= this.elapsed + 1e-9) {
      const event = itemEvents[this.nextItem++];
      this.items.push(...this.takeSpawn(event, ([time, type, lifetime]) => [this.createCollectible(time, type, lifetime)]));
    }
    for (const [event, pending] of this.pendingSpawns) {
      if (pending.kind === 'heart' && pending.time <= this.elapsed + 1e-9) {
        this.healing.push(...pending.items);
        this.pendingSpawns.delete(event);
      }
      if (pending.kind === 'obstruction' && pending.time <= this.elapsed + 1e-9) {
        this.obstructions.push(...pending.items);
        for (const obstruction of pending.items) this.clearAppearingObstruction(obstruction);
        this.pendingSpawns.delete(event);
      }
    }
    if (this.state !== 'playing') { this.tickStart = null; return; }
    this.food = this.food.filter(item => this.cookieActive || item.expires > this.elapsed + 1e-9);
    const cat = this.cat;
    const parts = this.brickParts();
    if (this.portalArrival !== null && !parts.some(part => part.id === this.portalArrival && this.touchingPart(part))) this.portalArrival = null;
    for (const id of this.spawnerTouching) {
      if (!parts.some(part => part.id === id && this.touchingPart(part))) this.spawnerTouching.delete(id);
    }
    for (const brick of this.bricks) {
      if (brick.spawner && brick.absorbedBy === null
        && parts.some(part => part.id === brick.id && this.touchingPart(part))) this.touchSpawner(brick);
      if (brick.turret && brick.absorbedBy === null
        && parts.some(part => part.id === brick.id && this.touchingPart(part))) this.touchTurret(brick);
    }
    const ride = this.conveyorRide;
    let rideEnd = false;
    if (ride) {
      const edge = this.conveyorEdge(ride.id, parts);
      if (!edge) {
        this.conveyorRide = null;
        cat.vx = 0; cat.vy = 0;
      } else {
        const sign = this.bricks[ride.id].conveyorDirection === 'counterclockwise' ? -1 : 1;
        const remaining = Math.max(0, sign > 0 ? edge.length - edge.along : edge.along);
        const speed = Math.min(CONVEYOR_SPEED, remaining / dt);
        cat.vx = edge.tx * sign * speed; cat.vy = edge.ty * sign * speed;
        this.capeFlightMultiplier = 1;
        rideEnd = remaining <= CONVEYOR_SPEED * dt + 1e-9;
      }
    }
    let dx = this.bubbleTrap ? 0 : cat.vx * dt, dy = this.bubbleTrap ? 0 : cat.vy * dt;
    if (this.obstructions.length) {
      const motion = { x: cat.x + dx, y: cat.y + dy, radius: cat.radius };
      this.moveAroundObstructions(motion, cat, true);
      dx = motion.x - cat.x; dy = motion.y - cat.y;
    }
    for (const id of this.paintTouching) {
      if (!parts.some(part => part.id === id && Math.hypot(
        cat.x - Math.max(part.x, Math.min(part.x + part.w, cat.x)),
        cat.y - Math.max(part.y, Math.min(part.y + part.h, cat.y))) <= cat.radius + 1e-6)) {
        this.paintTouching.delete(id);
      }
    }
    const originalSpikes = this.sawStartedAt === null && (dx || dy || this.spikeTouching.size) ? this.spikeParts(parts) : [];
    const stampAvailable = Boolean(this.dittoSource && this.dittoStamp);
    let spikes = originalSpikes;
    if (stampAvailable && this.sawStartedAt === null) {
      const margin = cat.radius + 14;
      spikes = this.bricks.filter(brick => brick.absorbedBy === null
        && (brick.portal ? brick.spikes : this.dittoSource.spikes)
        && parts.some(part => part.id === brick.id
          && part.x <= Math.max(cat.x, cat.x + dx) + margin && part.x + part.w >= Math.min(cat.x, cat.x + dx) - margin
          && part.y <= Math.max(cat.y, cat.y + dy) + margin && part.y + part.h >= Math.min(cat.y, cat.y + dy) - margin))
        .flatMap(brick => brickSpikes(parts.filter(part => part.id === brick.id), this.width, this.height).triangles
          .map(triangle => ({ id: brick.id, triangle })));
    }
    for (const id of this.spikeTouching) {
      const touching = parts.some(part => part.id === id &&
        Math.hypot(cat.x - Math.max(part.x, Math.min(part.x + part.w, cat.x)),
          cat.y - Math.max(part.y, Math.min(part.y + part.h, cat.y))) <= cat.radius + 1e-6)
        || spikes.some(spike => spike.id === id && spike.triangle.some(([x, y], i, triangle) =>
          distanceToSegment(cat.x, cat.y, x, y, ...triangle[(i + 1) % 3]) <= cat.radius + 1e-6));
      if (!touching) this.spikeTouching.delete(id);
    }
    let contact = 1;
    let contacts = [];
    let bumperContacts = [];
    let collectingSaw = false;
    let bumperTime = Infinity;
    let bubbleHit = null, bubbleTime = Infinity;
    if (dx || dy) {
      for (const brick of parts) {
        if (this.conveyorRide?.id === brick.id) {
          // The center follows the union's radius-expanded rim, including corner clearance.
          continue;
        }
        const effectiveSpikes = this.sawStartedAt === null && (stampAvailable && !this.bricks[brick.id].portal
          ? this.dittoSource.spikes : this.bricks[brick.id].spikes);
        const body = effectiveSpikes ? spikeBrickBody(brick, this.width, this.height) : brick;
        const t = brickContact(cat.x, cat.y, dx, dy, cat.radius, { ...brick, collisionBody: body });
        if (t < contact - 1e-9) { contact = t; contacts = [brick]; }
        else if (t <= contact + 1e-9 && t <= 1) contacts.push(brick);
      }
      for (const spike of spikes) {
        const t = spikeContact(cat.x, cat.y, dx, dy, cat.radius, spike.triangle);
        if (t < contact - 1e-9) { contact = t; contacts = [spike]; }
        else if (t <= contact + 1e-9 && t <= 1) contacts.push(spike);
      }
      bumperTime = Infinity;
      for (const bumper of this.bumpers) {
        const time = circleContact(cat.x - bumper.x, cat.y - bumper.y, dx, dy, cat.radius + bumper.radius);
        if (time < bumperTime) bumperTime = time;
      }
      if (bumperTime < contact - 1e-9) { contact = bumperTime; contacts = []; }
      if (bumperTime <= contact + 1e-9 && bumperTime <= 1) {
        bumperContacts = this.bumpers.filter(bumper =>
          Math.abs(circleContact(cat.x - bumper.x, cat.y - bumper.y, dx, dy, cat.radius + bumper.radius) - bumperTime) <= 1e-9);
      }
      collectingSaw = this.items.some(item => item.type === 'saw-blade'
        && (item.expires == null || item.expires > this.elapsed + 1e-9)
        && distanceToSegment(item.x, item.y, cat.x, cat.y, cat.x + dx * contact, cat.y + dy * contact) <= cat.radius + 14);
      if (collectingSaw) {
        contact = 1;
        contacts = [];
        for (const brick of parts) {
          if (this.conveyorRide?.id === brick.id) continue;
          const t = brickContact(cat.x, cat.y, dx, dy, cat.radius, { ...brick, collisionBody: null });
          if (t < contact - 1e-9) { contact = t; contacts = [brick]; }
          else if (t <= contact + 1e-9 && t <= 1) contacts.push(brick);
        }
      }
      if (collectingSaw || bumperTime < contact - 1e-9) {
        bumperContacts = [];
        bumperTime = Infinity;
        for (const bumper of this.bumpers) {
          const time = circleContact(cat.x - bumper.x, cat.y - bumper.y, dx, dy, cat.radius + bumper.radius);
          if (time < bumperTime) bumperTime = time;
        }
        if (bumperTime < contact - 1e-9) { contact = bumperTime; contacts = []; }
        if (bumperTime <= contact + 1e-9 && bumperTime <= 1) {
          bumperContacts = this.bumpers.filter(bumper =>
            Math.abs(circleContact(cat.x - bumper.x, cat.y - bumper.y, dx, dy, cat.radius + bumper.radius) - bumperTime) <= 1e-9);
        }
      }
    }
    if (!this.bubbleTrap) for (const bubble of this.bubbles) {
      const time = dx || dy
        ? circleContact(cat.x - bubble.x, cat.y - bubble.y, dx, dy, cat.radius + bubble.radius)
        : Math.hypot(cat.x - bubble.x, cat.y - bubble.y) <= cat.radius + bubble.radius ? 0 : Infinity;
      if (time < bubbleTime) { bubbleTime = time; bubbleHit = bubble; }
    }
    if (bubbleHit && bubbleTime <= contact + 1e-9 && bubbleTime <= 1
      && bubbleTime <= bumperTime + 1e-9) {
      contact = bubbleTime;
      contacts = [];
      bumperContacts = [];
      bumperTime = Infinity;
    }
    const endX = cat.x + dx * contact, endY = cat.y + dy * contact;
    this.attractFoodToCat(dt * contact, endX, endY);
    this.food = this.food.filter(item => {
      if (distanceToSegment(item.x, item.y, cat.x, cat.y, endX, endY) > cat.radius + 12) return true;
      const value = FOODS[item.type].value;
      this.score += value;
      this.recordPickup(item, 'food', value);
      return false;
    });
    while (this.score >= this.nextHeart) {
      const event = { time: this.elapsed + 1 };
      this.pendingSpawns.set(event, { kind: 'heart', time: event.time, items: [this.randomPickupPoint()] });
      this.nextHeart += this.level.heartCost;
    }
    const startX = cat.x, startY = cat.y;
    cat.x = endX; cat.y = endY;
    if (bubbleHit && bubbleTime <= contact + 1e-9 && bubbleTime <= 1) {
      this.bubbles = this.bubbles.filter(bubble => bubble !== bubbleHit);
      cat.vx = 0; cat.vy = 0;
      this.bubbleTrap = { color: bubbleHit.color, fromX: endX, fromY: endY,
        x: bubbleHit.x, y: bubbleHit.y, age: 0, transition: .18, duration: SLIMES[bubbleHit.color].duration };
    }
    const spikeIds = new Set(contacts.filter(part => this.bricks[part.id].spikes).map(part => part.id));
    const sawing = this.sawStartedAt !== null || collectingSaw;
    const stamping = stampAvailable && contacts.some(part => !this.bricks[part.id].portal);
    if (!sawing && !stamping) {
      if ([...spikeIds].some(id => !this.spikeTouching.has(id))) this.takeDamage();
      for (const id of spikeIds) this.spikeTouching.add(id);
    }
    this.combat(dt, startX, startY);
    this.updateTurrets(dt);
    const sawTarget = contacts.map(part => this.bricks[part.id]).find(brick => !['cinder', 'goal'].includes(brick.kind));
    const sawed = sawTarget && this.sawBrick(sawTarget, parts);
    if (!sawed) {
      const stampTarget = contacts.map(part => this.bricks[part.id]).find(brick => !brick.portal && brick.kind !== 'goal');
      if (stampTarget) this.stampBrick(stampTarget, parts);
    }
    this.paintBricks(contacts, sawed);
    if (sawing || stamping) {
      for (const part of contacts) if (this.bricks[part.id].spikes) spikeIds.add(part.id);
      for (const id of spikeIds) if (!this.bricks[id].spikes) spikeIds.delete(id);
      if ([...spikeIds].some(id => !this.spikeTouching.has(id))) this.takeDamage();
      for (const id of spikeIds) this.spikeTouching.add(id);
    }
    for (const id of new Set(contacts.map(part => part.id))) {
      const brick = this.bricks[id];
      if (brick.spawner) this.touchSpawner(brick);
      if (brick.turret) this.touchTurret(brick);
    }
    const portal = contacts.map(part => this.bricks[part.id]).find(brick => brick.portal);
    const teleported = portal && this.travelPortal(portal, parts);
    if (contacts.length && !teleported) {
      this.conveyorRide = null;
      const solid = contacts.filter(part => !this.bricks[part.id].springs);
      if (solid.length || ride) {
        cat.vx = 0; cat.vy = 0;
        const slimes = solid.map(part => this.bricks[part.id]).filter(brick => brick.slimed)
          .sort((a, b) => SLIMES[b.slimeColor ?? 'green'].duration - SLIMES[a.slimeColor ?? 'green'].duration);
        if (slimes.length) {
          this.stuckColor = slimes[0].slimeColor ?? 'green';
          this.stuckUntil = this.elapsed - dt + dt * contact + SLIMES[this.stuckColor].duration;
          this.releasedAt = null;
        } else if (!ride && !spikeIds.size) {
          const conveyor = solid.find(part => this.conveyorEdge(part.id, parts));
          if (conveyor && contacts.every(part => part.id === conveyor.id)) this.conveyorRide = { id: conveyor.id };
        }
      } else {
        for (const part of contacts) {
          const brick = this.bricks[part.id];
          const normal = brickNormal(cat.x, cat.y, part);
          if (!normal) continue;
          if (cat.vx * normal.x + cat.vy * normal.y >= 0) continue;
          Object.assign(cat, reflectVelocity(cat.vx, cat.vy, normal));
          brick.hitAt = this.elapsed;
          brick.hitNormal = normal;
          brick.hitPoint = { x: cat.x - normal.x * cat.radius, y: cat.y - normal.y * cat.radius };
        }
      }
      this.target = null;
    }
    if (bumperContacts.length && !teleported) {
      for (const bumper of bumperContacts) {
        let nx = cat.x - bumper.x, ny = cat.y - bumper.y;
        let distance = Math.hypot(nx, ny);
        if (distance < 1e-9) {
          const speed = Math.hypot(cat.vx, cat.vy) || 1;
          nx = -cat.vx / speed; ny = -cat.vy / speed;
          distance = 1;
        }
        nx /= distance; ny /= distance;
        const incoming = cat.vx * nx + cat.vy * ny;
        if (incoming >= -1e-9) continue;
        Object.assign(cat, reflectVelocity(cat.vx, cat.vy, { x: nx, y: ny }));
        const multiplier = OBJECTS[bumper.type].speedMultiplier;
        cat.vx *= multiplier; cat.vy *= multiplier;
        cat.x = bumper.x + nx * (cat.radius + bumper.radius + .01);
        cat.y = bumper.y + ny * (cat.radius + bumper.radius + .01);
        bumper.hitAt = this.elapsed;
        bumper.hitNormal = { x: nx, y: ny };
        this.target = null;
      }
    }
    if (rideEnd && !this.conveyorEdge(ride.id, parts)) {
      this.conveyorRide = null;
      cat.vx = 0; cat.vy = 0;
    }
    if (!cat.vx && !cat.vy) this.boosted = false;
    if (cat.x - cat.radius < 0 || cat.x + cat.radius > this.width || cat.y - cat.radius < 0 || cat.y + cat.radius > this.height || this.hearts <= 0) {
      this.state = 'lost';
    } else if (!this.level.survive && this.score >= this.level.goal && this.enemies >= (this.level.killGoal ?? 0)
      && this.goals >= (this.level.goalsGoal ?? 0)) {
      this.state = 'won';
    } else if (this.elapsed >= this.timeLimit - 1e-9) {
      this.elapsed = this.timeLimit;
      this.state = this.level.survive ? 'won' : 'lost';
    }
    this.recordCatPosition();
    this.tickStart = null;
  }
}

// Classic scripts work over file:// as well as HTTP; Node uses the same engine.
const api = { Game, Cutscene, CHARACTERS, SCENE_THEMES, validateCutscene, levelObjective, WIDTH, HEIGHT, DURATION, GOAL, SPEED, CONVEYOR_SPEED, SOCCER_FRICTION, SPAWN_SPACING, COW_SPEED, COW_EAT_DURATION, OBSTRUCTION_RADIUS, OBSTRUCTION_PATTERNS, obstructionGeometry, COOLDOWNS, SLIMES, SHIELDS, FOODS, ITEMS, CAT_BLOCK_MESSAGES, OBJECTS, SCHEDULE, LEVEL_DATA, LEVELS, SWORDS, PORTALS, CONTACT_SURFACES, brickEnabled, goalTiles, portalPairIssues, makeBricks, brickContact, validateCustomLevel, snapWheel, turretGeometry, middleBrickInGroup, brickRegions, brickEditRegions, brickShape, brickRecharge, brickSlime, brickSpring, brickSpikes, brickConveyor };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
} else {
  globalThis.KoshiGame = api;
}
})();
