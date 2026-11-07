(function () {
'use strict';

const WORLDS = [
  {
    id: '1', name: 'Garden Path', theme: 'garden', special: false, next: ['2'],
    levels: {
      '1-1': 'Breakfast rebellion',
      '1-2': 'Mouse at the market',
      '1-3': 'Cutlery uprising',
      '1-4': 'A hearty harvest',
      '1-5': 'Cracker causeway',
      '1-6': 'Sticky jam depot',
      '1-7': 'Tin-foil picnic',
      '1-8': 'Skewered supper',
      '1-9': 'Meals on wheels',
      '1-10': 'Pancake trampoline',
    },
  },
  {
    id: '2', name: 'Clockwork Pantry', theme: 'workshop', special: false, next: ['3', '3S'],
    levels: {
      '2-1': 'Sushi assembly line',
      '2-2': 'The folding pantry',
      '2-3': 'Ram through the granary',
      '2-4': 'Fast-food rescue',
      '2-5': 'Snack dispensary',
      '2-6': 'Buckets at the bakery',
      '2-7': 'Cinder soup factory',
      '2-8': 'Switchboard supper',
      '2-9': 'A feast for the world',
      '2-10': 'Bouncing breakfast',
      '2-11': 'Cookie calling',
      '2-12': 'Lunch against the clock',
      '2-13': 'Recharge the cutlery',
      '2-14': 'Pantry lullaby',
      '2-15': 'Eggplant mix-up',
      '2-16': 'Saw through the blockade',
      '2-17': 'Snake at the snack rack',
      '2-18': 'A brighter buffet',
      '2-19': 'Three-course kickoff',
      '2-20': 'Stamp a snack shortcut',
      '2-21': 'Scare up some supper',
      '2-22': 'Fence the food depot',
      '2-23': 'Pumpkin pantry patrol',
      '2-24': 'The final countdown feast',
      '2-25': 'Tom the Toaster',
    },
  },
  {
    id: '3', name: 'Robot Foundry', theme: 'foundry', special: false, next: ['4'],
    levels: {
      '3-1': 'Tom\'s foundry kickoff',
      '3-2': 'Painting the pancake path',
      '3-3': 'Caped cat cafe',
      '3-4': 'Laser light lunch',
      '3-5': 'Blocked buffet',
      '3-6': 'Snail-paced soup',
      '3-7': 'Pinball pantry',
      '3-8': 'Bubble tea trouble',
      '3-9': 'Fireball fry-up',
      '3-10': 'Demolition dinner',
      '3-11': 'Surprise wall supper',
      '3-12': 'Stampede steakhouse',
      '3-13': 'Unicorn dessert dash',
      '3-14': 'Copycat showdown',
    },
  },
  {
    id: '3S', name: 'Tom\'s Gauntlet', theme: 'foundry', special: true, next: [],
    levels: {
      '3S-1': 'Goalie gauntlet',
      '3S-2': 'Unicorn smorgasbord',
      '3S-3': 'Laser lockdown',
      '3S-4': 'Bubble bend-it',
      '3S-5': 'Copycat penalty kicks',
      '3S-6': 'Cinder stampede',
      '3S-7': 'Obstacle cup',
      '3S-8': 'Boom helmet bakery',
      '3S-9': 'Jackolantern junkyard',
      '3S-10': 'Grand slam',
      '3S-11': 'Turret derby',
      '3S-12': 'The duck\'s last stand',
    },
  },
  {
    id: '4', name: 'Rolling Road', theme: 'workshop', special: false, next: [],
    levels: {
      '4-1': 'The rolling buffet',
    },
  },
];

const BETA_WORLDS = WORLDS;
const officialThemes = [
  ['Happy Meadows', '#76c96a'], ['Catnip Beach', '#f1d65c'],
  ['Fuzzy Falls', '#68a9ee'], ['Mouser Mesa', '#eea052'],
  ['Alpine Litterbox', '#eeeeee'], ['Yarnball Moon', '#b08ae3'],
  ['Hairball Swamp', '#b58a65'], ['Meownt Vesuvius', '#e66c68'],
];
const OFFICIAL_WORLDS = officialThemes.flatMap(([name, color], index) => {
  const id = String(index + 1), angle = Math.PI + index * Math.PI / 4;
  const specialAngle = angle + Math.PI / 8;
  return [
    {
      id, name, theme: 'official', color, special: false,
      next: [index === 7 ? '9' : String(index + 2), `S${id}`, ...(index === 0 ? ['C'] : [])],
      mapPosition: { x: 56 + 27 * Math.cos(angle), y: 50 + 27 * Math.sin(angle) },
      levels: {},
    },
    {
      id: `S${id}`, name: `Special ${name}`, theme: 'official', color,
      special: true, next: [],
      mapPosition: { x: 56 + 36 * Math.cos(specialAngle), y: 50 + 36 * Math.sin(specialAngle) },
      levels: {},
    },
  ];
});
OFFICIAL_WORLDS.push(
  { id: '9', name: 'Robot HQ', theme: 'official', color: '#ed9bc3', special: false, next: [],
    mapPosition: { x: 56, y: 50 }, levels: {} },
  { id: 'C', name: 'Cat Town', theme: 'official', color: '#a5aab1', special: false, next: [],
    mapPosition: { x: 10, y: 50 }, mapOnly: true, levels: {} },
);
const OFFICIAL_LEVEL_DATA = {};
const officialSceneThemes = ['happy-meadows', 'catnip-beach', 'fuzzy-falls', 'mouser-mesa',
  'alpine-litterbox', 'yarnball-moon', 'hairball-swamp', 'meownt-vesuvius', 'robot-hq'];
// Cat Town is a scene hub; unauthored Official worlds use temporary starters.
for (const world of OFFICIAL_WORLDS.filter(entry => entry.id !== 'C')) {
  if (world.id === '1') continue;
  const name = `${world.name} Starter`;
  world.levels = { '1': name };
  OFFICIAL_LEVEL_DATA[name] = {
    id: `official-${world.id}-1`, name, duration: 10, goal: 0, killGoal: 0, survive: true,
    heartCost: Infinity, brickSet: 1, brickTypes: [], food: [], enemies: [], weapons: [],
    items: [[0, 'cat-block']],
    catBlock: { description: 'Collect the Cat Block waiting at the start of the level.' },
    ...(officialSceneThemes[Number(world.id) - 1] ? { cutscene: {
      theme: officialSceneThemes[Number(world.id) - 1],
      lines: [{ speaker: 'koshi', text: 'Hello world!', actors: [{ character: 'koshi', x: .5, y: .8 }] }],
    } } : {}),
  };
}
// Authored from levels/official/world-1/1-1.json; keep the campaign ID stable for existing saves.
const breakfastName = "Beginner's Breakfast";
OFFICIAL_WORLDS[0].levels = { '1': breakfastName };
OFFICIAL_LEVEL_DATA[breakfastName] = {
  version: 1, id: 'official-1-1', name: breakfastName,
  duration: 50, goal: 20, heartCost: Infinity, brickSet: 1,
  bossLevel: false, killGoal: 0, survive: false,
  food: [], enemies: [], weapons: [], items: [],
  events: [
    { time: 5, kind: 'food', type: 'S', random: true,
      group: { shape: 'line', count: 3, size: .25, angle: 30 }, lifetime: 10 },
    { time: 12, kind: 'food', type: 'S', random: true,
      group: { shape: 'line', count: 4, size: .25, angle: 90 }, lifetime: 10 },
    { time: 19, kind: 'food', type: 'S', random: true,
      group: { shape: 'line', count: 4, size: .4, angle: 175 }, lifetime: 10 },
    { time: 15, kind: 'item', type: 'cat-block', random: true },
    { time: 25, kind: 'food', type: 'P', random: true,
      group: { shape: 'circle', count: 4, size: .32 }, lifetime: 10 },
    { time: 35, kind: 'food', type: 'P', random: true,
      group: { shape: 'line', count: 4, size: .5, angle: 66 }, lifetime: 10 },
    { time: 40, kind: 'food', type: 'S', random: true,
      group: { shape: 'line', count: 3, size: .25, angle: 90 }, lifetime: 10 },
  ],
  catBlock: {
    description: 'To earn Cat Brick: Find during gameplay when it spawns.',
    messages: {
      item: 'Koshi found the Cat Block!',
      enemy: 'Koshi found a Cat Block carried by an enemy!',
      chest: 'Koshi opened the treasure chest and found the Cat Block!',
      achievement: 'Koshi earned the Cat Brick!',
    },
    trigger: { type: 'spawn' },
  },
  cutscene: {
    theme: 'happy-meadows',
    lines: [
      ['tom', 'I am Tom the Duck, leader of the evil robot alliance. I am here to destroy all living creatures on this planet. Surrender, silly kitty, and we may spare your life!'],
      ['koshi', "Whoa there, quackers! You ain't talking to no ordinary cat! I'm Koshi, the warrior of legends, eater of many foods! You can't scare me!"],
      ['tom', "Oh yeah? Eater of many foods? You're just a little tiny furball! I bet you couldn't even eat this giant pile of food I have planned to materialize right in front of us from thin air in the near future!"],
      ['koshi', 'Challenge accepted, bub! I have an appetite which is unmatched. Bring it on!'],
    ].map(([speaker, text]) => ({
      speaker, text, actors: [{ character: 'koshi', x: .28, y: .65 }, { character: 'tom', x: .5, y: .65 }],
    })),
  },
  levelInfo: {
    pages: [{
      title: 'Steering Bricks',
      text: 'Touch bricks to have Koshi move directly towards them. Careful, bricks must recharge before you can touch them again! Also, blue bricks take longer to cooldown, while red bricks take less time to cooldown.',
      graphics: ['brick:slow', 'brick:normal', 'brick:fast'],
    }, {
      title: 'Food',
      text: 'Collect strawberries and pretzels for food points. Strawberries are worth 1 point and pretzels are worth 2 points. Use these to increase your food score!',
      graphics: ['food:S', 'food:P'],
    }],
  },
  brickTypes: [
    ['bottom', .2, .4, 'slow'],
    ['top', .6, .8, 'slow'],
    ['right', .125, .25, 'slow'],
    ['left', .25, .375, 'slow'],
    ['left', .625, .75, 'slow'],
    ['top', .4, .6, 'fast'],
    ['bottom', .4, .6, 'fast'],
    ['left', .125, .25, 'fast'],
    ['left', .75, .875, 'fast'],
    ['right', .875, 1, 'fast'],
  ].map(([edge, start, end, kind]) => ({
    edge, start, end, kind, crumbler: null, warped: null,
    slimeColor: 'green', conveyorDirection: 'clockwise',
    slimed: false, springs: false, spikes: false, conveyor: false,
    portal: null, turret: null, toggle: null, boost: false, spawner: null,
  })),
};
const activeWorlds = globalThis.KoshiCampaignMode?.active.id === 'official' ? OFFICIAL_WORLDS : BETA_WORLDS;

function assembleCampaign(levelData, worlds = activeWorlds) {
  const worldIds = new Set(), numbers = new Set(), assigned = new Set();
  for (const world of worlds) {
    if (typeof world.id !== 'string' || !world.id || worldIds.has(world.id)) {
      throw new Error(`Invalid or duplicate world ID: ${world.id}`);
    }
    worldIds.add(world.id);
  }
  return worlds.flatMap(world => {
    if (!world.levels || typeof world.levels !== 'object' || Array.isArray(world.levels)) {
      throw new Error(`World ${world.id} must map level numbers to level names.`);
    }
    for (const id of world.next) {
      if (!worldIds.has(id)) throw new Error(`Invalid world destination: ${id}`);
    }
    return Object.entries(world.levels).map(([number, name]) => {
      const numberKey = `${world.id}\u0000${number}`;
      if (!number.trim() || numbers.has(numberKey)) throw new Error(`Invalid or duplicate level number: ${number}`);
      if (!Object.hasOwn(levelData, name)) throw new Error(`Unknown level data: ${name}`);
      const data = levelData[name];
      if (typeof data.id !== 'string' || !data.id || data.name !== name) {
        throw new Error(`Invalid named level data: ${name}`);
      }
      if (assigned.has(data.id)) throw new Error(`Level is assigned more than once: ${name}`);
      numbers.add(numberKey);
      assigned.add(data.id);
      return { ...data, worldId: world.id, number };
    });
  });
}

const api = { WORLDS: activeWorlds, BETA_WORLDS, OFFICIAL_WORLDS, OFFICIAL_LEVEL_DATA, assembleCampaign };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.KoshiCampaign = api;
})();
