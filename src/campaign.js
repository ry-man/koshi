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

function assembleCampaign(levelData, worlds = WORLDS) {
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
      if (!number.trim() || numbers.has(number)) throw new Error(`Invalid or duplicate level number: ${number}`);
      if (!Object.hasOwn(levelData, name)) throw new Error(`Unknown level data: ${name}`);
      const data = levelData[name];
      if (typeof data.id !== 'string' || !data.id || data.name !== name) {
        throw new Error(`Invalid named level data: ${name}`);
      }
      if (assigned.has(data.id)) throw new Error(`Level is assigned more than once: ${name}`);
      numbers.add(number);
      assigned.add(data.id);
      return { ...data, worldId: world.id, number };
    });
  });
}

const api = { WORLDS, assembleCampaign };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.KoshiCampaign = api;
})();
