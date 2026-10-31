(function () {
'use strict';

const WIDTH = 960;
const HEIGHT = 600;
const DURATION = 60;
const GOAL = 20;
const SPEED = 420;
const DAMAGE_DURATION = 1;
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
const PORTALS = { red: '#ef655f', orange: '#ef9947', yellow: '#e8d25a', green: '#7dcc77', blue: '#55a7ee', purple: '#b18be5' };
const CONTACT_SURFACES = ['slimed', 'springs', 'spikes', 'conveyor', 'portal', 'spawner', 'boost'];

function brickEnabled(brick) { return !brick.toggle || brick.toggleRemaining === 0; }

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
      if (brick.kind === 'cinder') {
        for (const attribute of ['crumbler', 'warped', 'toggle']) brick[attribute] = null;
        for (const attribute of CONTACT_SURFACES) brick[attribute] = ['portal', 'spawner'].includes(attribute) ? null : false;
        continue;
      }
      for (const attribute of ['crumbler', 'warped', 'slimeColor', 'conveyorDirection', 'toggle', ...CONTACT_SURFACES]) {
        if (entry[attribute] === undefined) continue;
        brick[attribute] = entry[attribute] && typeof entry[attribute] === 'object' ? { ...entry[attribute] } : entry[attribute];
        if (CONTACT_SURFACES.includes(attribute) && entry[attribute]) {
          for (const other of CONTACT_SURFACES) if (other !== attribute) brick[other] = ['portal', 'spawner'].includes(other) ? null : false;
        }
      }
    }
  }
}
const CHARACTERS = { koshi: 'Koshi', mouse: 'Robo Mouse', wheel: 'Robo Wheel', ram: 'Robo Ram', bucket: 'Robo Bucket', tom: 'Tom the Duck' };
const SCENE_THEMES = ['garden', 'workshop'];

function validateCutscene(value) {
  const fail = message => { throw new TypeError(`Cutscene: ${message}`); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('expected an object.');
  if (!SCENE_THEMES.includes(value.theme)) fail('theme must be garden or workshop.');
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
const LEVELS = [
  {
    name: 'Breakfast rebellion', concept: 'normal bricks', duration: 60, goal: 20, food: SCHEDULE,
    enemies: [], weapons: [], bricks: [],
    dialogue: [
      ['tom', 'I am Tom the Duck! My robots will seize the world and lock every meal in my Clockwork Pantry.'],
      ['koshi', 'Not while I have whiskers! I will save the world, starting with strawberries, pretzels, and a very large breakfast.'],
      ['tom', 'Click a brick to travel? Blue recharges in 15 seconds, green in 8, red in 3. You cannot outrun my plans!'],
      ['koshi', 'I can aim at any spot on a ready brick and redirect in flight. I stop when I touch a brick. Collect 20 food points? Delicious.'],
    ],
  },
  {
    name: 'Mouse at the market', concept: 'robo mouse', duration: 45, survive: true,
    enemies: [[8,'mouse',1],[22,'mouse',1],[35,'mouse',1]], weapons: [], bricks: [],
    dialogue: [
      ['tom', 'My Robo Mouse patrol has occupied the market. Hold out until the evacuation bell rings!'],
      ['mouse', 'We wander in curves and sometimes stop to lick our hands. Touch us without protection and lose a heart!'],
      ['koshi', 'I will dodge your patrol for 45 seconds so everyone can escape. A banana and cheese detour sounds good, too.'],
    ],
  },
  {
    name: 'Cutlery uprising', concept: 'swords', duration: 90, killGoal: 5,
    enemies: [[10,'mouse',2],[28,'mouse',2],[48,'mouse',2],[68,'mouse',2]], bricks: [],
    weapons: [[20,'wood'],[38,'bronze'],[58,'silver'],[76,'gold']],
    dialogue: [
      ['tom', 'The market is closed! My mice guard the road to the farms.'],
      ['mouse', 'Swords! Wood has 1 attack, bronze 3, silver 5; gold lasts 15 seconds. Stay out of the cat\'s reach!'],
      ['koshi', 'First I dodge, then strike! Every sword I collect replaces the old one and resets its attacks, even a weaker sword. Five enemy points, then lunch!'],
    ],
  },
  {
    name: 'A hearty harvest', concept: 'hearts and heart cost', duration: 100, goal: 30, killGoal: 4,
    enemies: [[12,'mouse',2],[35,'mouse',2],[62,'mouse',2]], bricks: [],
    dialogue: [
      ['tom', 'I have stolen the farms\' harvest. My patrol will wear down your three hearts.'],
      ['koshi', 'Food now earns healing hearts! The Next heart meter shows the food cost; each full meter creates a heart after a pink cloud.'],
      ['mouse', 'He still has to collect it! Each heart restores one, up to three.'],
      ['koshi', 'I will gather 30 food points and earn 4 enemy points to free the farms. Chicken, fish, burgers: I love every course!'],
    ],
  },
  {
    name: 'Cracker causeway', concept: 'crumblers', duration: 100, goal: 35,
    enemies: [[15,'mouse',2],[45,'mouse',2],[75,'mouse',2]],
    bricks: [[4,{ crumbler: 5 }],[9,{ crumbler: 5 }],[16,{ crumbler: 5 }]],
    dialogue: [
      ['tom', 'The old causeway is made of Crumblers. Every time you select one, its remaining uses fall!'],
      ['mouse', 'At zero uses, you cannot aim at it again. It still stops you, though.'],
      ['koshi', 'Five uses per crumbly brick: I will save them for useful routes and use plain bricks too. Recover 35 food points, not just cracker crumbs!'],
    ],
  },
  {
    name: 'Sticky jam depot', concept: 'slime', duration: 100, goal: 30, killGoal: 5,
    enemies: [[12,'mouse',2],[38,'mouse',2],[68,'mouse',2]],
    bricks: [[4,{ slimed: true, slimeColor: 'green' }],[16,{ slimed: true, slimeColor: 'green' }],[9,{ crumbler: 5 }]],
    dialogue: [
      ['tom', 'My jam depot has slime-coated bricks. Land on one and you are stuck before you can steer again!'],
      ['mouse', 'Green slime holds for 3 seconds. Blue holds for 5, red for 1. Our green batch should spoil your lunch!'],
      ['koshi', 'I will plan around the sticky pauses, save the jam, and earn 5 enemy points plus 30 food points. Even sticky toast deserves freedom.'],
    ],
  },
  {
    name: 'Tin-foil picnic', concept: 'enemy shields', duration: 110, killGoal: 8,
    enemies: [[10,'mouse',3],[28,'mouse',1,'red'],[45,'mouse',3],[64,'mouse',1,'red'],[82,'mouse',2]],
    bricks: [[16,{ slimed: true, slimeColor: 'red' }],[9,{ crumbler: 5 }]],
    dialogue: [
      ['tom', 'A few elite robots now wear shields. Red needs 2 hits, green 3, blue 4; stronger shields are rarer.'],
      ['mouse', 'Each hit weakens the shield. We blink with one second of protection between accepted hits!'],
      ['koshi', 'Only a defeat earns points: 1 without a shield, or the original shield\'s hit count. Eight enemy points will rescue this picnic!'],
    ],
  },
  {
    name: 'Skewered supper', concept: 'spikes', duration: 60, survive: true,
    enemies: [[10,'mouse',2],[30,'mouse',2],[48,'mouse',1,'red']],
    bricks: [[4,{ spikes: true }],[9,{ spikes: true }],[16,{ slimed: true, slimeColor: 'red' }]],
    dialogue: [
      ['tom', 'White spikes guard the supper station. Touching them costs a heart and stops you, even with a sword!'],
      ['koshi', 'Then I will redirect before landing on spikes. One second of damage protection is not a reason to linger.'],
      ['mouse', 'The rescue train leaves in 60 seconds. Stay alive until then, if you can!'],
      ['koshi', 'I will keep the train safe, and collect a few snacks for the passengers.'],
    ],
  },
  {
    name: 'Meals on wheels', concept: 'robo wheels', duration: 110, goal: 35, killGoal: 7,
    enemies: [[12,'wheel',1],[25,'mouse',2],[43,'wheel',2],[62,'mouse',2],[82,'wheel',1,'red']],
    bricks: [[16,{ spikes: true }],[9,{ crumbler: 5 }]],
    dialogue: [
      ['tom', 'Robo Wheels, patrol the inside boundary! Stop Koshi from reaching the city kitchens.'],
      ['wheel', 'WE ROLL AROUND THE EDGES. INTERCEPT WITH A SWORD OR STEER CLEAR OF OUR ROUTE.'],
      ['koshi', 'Seven enemy points and 35 food points will free the kitchens. Your delivery route ends here; mine ends with fish and pretzels!'],
    ],
  },
  {
    name: 'Pancake trampoline', concept: 'springs', duration: 110, goal: 40,
    enemies: [[14,'mouse',2],[35,'wheel',2],[62,'mouse',2],[85,'wheel',1,'red']],
    bricks: [[4,{ springs: true }],[9,{ springs: true }],[16,{ spikes: true }]],
    dialogue: [
      ['tom', 'Spring platforms protect my pancake store. Land on one and it bounces you away automatically!'],
      ['wheel', 'BOUNCE TRAJECTORY ACTIVE. REDIRECT IN FLIGHT TO AVOID THE SPIKES.'],
      ['koshi', 'That is a shortcut, not a setback! I will bounce toward 40 food points and return pancakes to the hungry city.'],
    ],
  },
  {
    name: 'Sushi assembly line', concept: 'conveyers', duration: 120, goal: 35, killGoal: 8,
    enemies: [[12,'mouse',2],[30,'wheel',2],[50,'mouse',1,'red'],[72,'wheel',2],[95,'mouse',2]],
    bricks: [[19,{ conveyor: true }],[10,{ conveyor: true, conveyorDirection: 'counterclockwise' }],[4,{ springs: true }]],
    dialogue: [
      ['tom', 'Conveyor belts carry supplies into my workshop. Land on the inner edge and the belt carries you along its arrows.'],
      ['wheel', 'THE BELT STOPS AT ITS END. YOU MAY STEER AWAY WHILE RIDING.'],
      ['koshi', 'A moving sushi buffet! I will use the belts and springs to recover 35 food points and earn 8 enemy points.'],
    ],
  },
  {
    name: 'The folding pantry', concept: 'warped bricks', duration: 120, killGoal: 10,
    enemies: [[12,'mouse',3],[32,'wheel',2],[52,'mouse',1,'green'],[74,'mouse',3],[97,'wheel',1,'red']],
    bricks: [[4,{ warped: 12 }],[19,{ warped: 12, conveyor: true }],[16,{ springs: true }]],
    dialogue: [
      ['tom', 'Warped bricks absorb a neighboring brick each time you select them. My pantry walls will change beneath your plans!'],
      ['wheel', 'THE GROWING GROUP USES ITS OWNER\'S STYLE. IT RESTORES AFTER ITS WARP TIMER EXPIRES.'],
      ['koshi', 'I can grow a conveyor route, then redirect before it shrinks. Ten enemy points will unlock the pantry; save me some cheese!'],
    ],
  },
  {
    name: 'Ram through the granary', concept: 'robo rams', duration: 120, goal: 40, killGoal: 9,
    enemies: [[12,'ram',1],[28,'mouse',3],[46,'wheel',2],[65,'ram',1],[83,'mouse',1,'red'],[100,'wheel',2]],
    bricks: [[4,{ warped: 12 }],[19,{ conveyor: true }],[16,{ springs: true }]],
    dialogue: [
      ['tom', 'Robo Rams, defend the granary! Aim those glowing eyes at the cat.'],
      ['ram', 'I wander, pause to aim, then charge straight ahead. My charge bounces off bricks and slows with each bounce!'],
      ['koshi', 'Move after the aim locks, then counter with a sword. Nine enemy points and 40 food points will save the grain, and tomorrow\'s pretzels!'],
    ],
  },
  {
    name: 'Fast-food rescue', concept: 'boost', duration: 120, killGoal: 12,
    enemies: [[12,'ram',1],[28,'mouse',3],[45,'wheel',2],[62,'mouse',1,'green'],[80,'ram',2],[98,'wheel',2]],
    bricks: [[4,{ boost: true }],[9,{ boost: true }],[19,{ conveyor: true }],[16,{ springs: true }]],
    dialogue: [
      ['tom', 'Boost bricks store launch power. Surely you will overshoot the burger depot!'],
      ['ram', 'Launch while resting on a Boost brick and you travel at double speed, defeating robots on contact without using a sword.'],
      ['koshi', 'Shielded robots still need spaced hits. Redirecting ends my boost, so I will choose my line carefully. Twelve enemy points, then burgers for everyone!'],
    ],
  },
  {
    name: 'Snack dispensary', concept: 'spawners', duration: 120, goal: 45, killGoal: 10,
    enemies: [[12,'mouse',3],[30,'wheel',2],[50,'ram',1],[70,'mouse',1,'red'],[92,'wheel',2]],
    bricks: [[4,{ spawner: { kind: 'food', type: 'H', lifetime: 25 } }],[9,{ spawner: { kind: 'food', type: 'H', lifetime: 25 } }],[16,{ spawner: { kind: 'weapon', type: 'silver' } }],[19,{ boost: true }]],
    dialogue: [
      ['tom', 'These Spawning bricks hide supplies. Touch one to release its item at a random spot, only once per attempt!'],
      ['ram', 'The symbol shows what is inside: food, swords, hearts, or even robots. Watch where the item appears.'],
      ['koshi', 'These hold burgers and a silver sword! I will visit each dispenser and recover 45 food points plus 10 enemy points for the relief kitchens.'],
    ],
  },
  {
    name: 'Buckets at the bakery', concept: 'robo buckets', duration: 75, survive: true,
    enemies: [[12,'bucket',1],[27,'mouse',2],[43,'wheel',1],[56,'ram',1],[65,'bucket',1]],
    bricks: [[4,{ boost: true }],[9,{ springs: true }],[16,{ spawner: { kind: 'weapon', type: 'silver' } }]],
    dialogue: [
      ['tom', 'Robo Buckets, bombard the bakery! Keep the rescue ovens cold.'],
      ['bucket', 'I wander slowly and throw bouncing bombs. Blue turns red over a three-second fuse; the blast hurts, the flying bomb does not!'],
      ['koshi', 'I will leave room for the explosion and protect the bakers for 75 seconds. Fresh bread belongs to the world, not your army!'],
    ],
  },
  {
    name: 'Cinder soup factory', concept: 'cinder', duration: 130, goal: 45, killGoal: 12,
    enemies: [[12,'bucket',1],[28,'mouse',3],[45,'wheel',2],[63,'ram',1],[80,'mouse',1,'green'],[98,'bucket',1],[115,'wheel',2]],
    bricks: [[4,{ kind: 'cinder' }],[9,{ kind: 'cinder' }],[16,{ boost: true }],[19,{ springs: true }]],
    dialogue: [
      ['tom', 'Cinder bricks darken the soup factory walls. You cannot select them to steer, and they never recharge.'],
      ['bucket', 'They still stop you! Choose a colored brick to leave, and do not wait there for a button to wake up.'],
      ['koshi', 'I will use boosts and springs around the dead routes. Forty-five food points and 12 enemy points will return hot meals to the world.'],
    ],
  },
  {
    name: 'Switchboard supper', concept: 'toggles', duration: 130, killGoal: 14,
    enemies: [[12,'mouse',3],[28,'wheel',2],[44,'ram',2],[61,'bucket',1],[78,'mouse',1,'blue'],[96,'wheel',1,'red'],[114,'mouse',3]],
    bricks: [[4,{ toggle: 2 }],[9,{ toggle: 2 }],[16,{ boost: true }],[19,{ conveyor: true }]],
    dialogue: [
      ['tom', 'Toggle bricks start disabled. Every successful selection of another ready brick counts down their switch!'],
      ['bucket', 'At zero, they become usable. The next successful selection disables them and starts their count again. These switches need two clicks!'],
      ['koshi', 'I will time my routes around the switches, earn 14 enemy points, and shut down your world-hunger machine. Supper is almost served!'],
    ],
  },
  {
    name: 'A feast for the world', concept: 'portals', duration: 140, goal: 50, killGoal: 15,
    enemies: [[12,'mouse',6],[28,'wheel',4],[44,'ram',3],[60,'bucket',2],[77,'mouse',1,'blue'],[93,'wheel',1,'green'],[108,'mouse',2,'red'],[123,'bucket',2]],
    bricks: [[4,{ portal: 'purple' }],[3,{ portal: 'purple' }],[16,{ boost: true }],[19,{ toggle: 2 }]],
    dialogue: [
      ['tom', 'My last defense: paired Portals! Touch one and you appear at the matching color on the other side.'],
      ['bucket', 'Koshi emerges moving straight into the arena at his current speed. Portal trips do not count as selections or spend brick uses.'],
      ['koshi', 'Purple to purple, then steer onward! Fifty food points and 15 enemy points will break your final blockade.'],
      ['tom', 'My robots cannot hold every kitchen against a cat who refuses to give up...'],
      ['koshi', 'Then this is our route to victory. Strawberries, pretzels, bananas, cheese, chicken, fish, burgers: a feast for the whole world, not just me!'],
    ],
  },
].map((entry, index) => {
  const food = entry.food ?? Object.keys(FOODS).map((type, i) => [
    3 + Math.floor(i * (entry.duration - 12) / 6),
    ['L3', 'L3', 'C3', 'L3', 'C3', 'R3', 'S'][i], type, Math.min(25, entry.duration - (3 + Math.floor(i * (entry.duration - 12) / 6))),
  ]);
  const brickTypes = entry.bricks.map(([id, attributes]) => campaignBrick(id, attributes));
  const members = index % 2 ? [[4,6],[3,1],[20,22],[11,13,15]] : [[0,2],[7,5],[12,14],[19,21,23]];
  const brickGroups = members.map(members => ({ owner: index === 0 && members[0] === 0 ? 2 : members[0], members }));
  const foodPoints = food.reduce((sum, [, method, type]) => sum + (method === 'S' ? 1 : Number(method.slice(1))) * FOODS[type].value, 0)
    + brickTypes.reduce((sum, brick) => sum + (brick.spawner?.kind === 'food' ? FOODS[brick.spawner.type].value : 0), 0);
  const cast = [...new Set(entry.enemies.map(([, type]) => type))];
  return {
    id: `1-${index + 1}`, name: entry.name, concept: entry.concept, duration: entry.duration,
    goal: entry.goal ?? 0, killGoal: entry.killGoal ?? 0, survive: entry.survive ?? false,
    heartCost: index < 3 ? Infinity : Math.ceil(foodPoints / 5),
    brickSet: index === 0 ? 1 : 3, brickTypes, brickGroups, food, enemies: entry.enemies,
    weapons: entry.weapons ?? (entry.survive || !entry.killGoal
      ? [[entry.enemies[0][0] + 14, 'bronze']]
      : [[entry.enemies[0][0] + 12, 'silver'], [Math.floor(entry.duration * .6), 'silver'],
        ...(entry.killGoal > 10 ? [[entry.duration - 22, 'silver']] : [])]),
    cutscene: story(index < 10 ? 'garden' : 'workshop', entry.dialogue, cast),
  };
});

function portalPairIssues(bricks) {
  return Object.keys(PORTALS).flatMap(color => {
    const count = bricks.filter(brick => brick.portal === color && brick.absorbedBy == null).length;
    return count === 0 || count === 2 ? [] : [`${color} portals: ${count} brick${count === 1 ? '' : 's'}; exactly two required.`];
  });
}

const SHIELDS = { red: { hits: 2, next: null, color: '#ed5555' }, green: { hits: 3, next: 'red', color: '#63d877' }, blue: { hits: 4, next: 'green', color: '#519eff' } };

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
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Level must be a JSON object.');
  if (value.version !== 1) fail('Unsupported level version. Expected version 1.');
  if (typeof value.id !== 'string' || !value.id.trim() || value.id.length > 60) fail('Level name must contain 1–60 characters.');
  const duration = number(value.duration, 1, 3600, 'Duration');
  const goal = number(value.goal, 0, 100000, 'Food goal');
  if (!Number.isInteger(goal)) fail('Food goal must be a whole number.');
  const killGoal = value.killGoal === undefined ? 0 : number(value.killGoal, 0, 100000, 'Enemy goal');
  if (!Number.isInteger(killGoal)) fail('Enemy goal must be a whole number.');
  if (value.survive !== undefined && typeof value.survive !== 'boolean') fail('Survive must be a boolean.');
  if (value.survive && (goal || killGoal)) fail('Survival cannot be combined with food or enemy goals.');
  if (!value.survive && !goal && !killGoal) fail('Food goal or enemy goal must be positive unless survival is selected.');
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
    const types = { food: FOODS, enemy: { mouse: true, wheel: true, ram: true, bucket: true }, weapon: SWORDS };
    if (!Object.hasOwn(types, event.kind) || !Object.hasOwn(types[event.kind], event.type)) fail(`${name} has an unknown category or type.`);
    if (event.kind === 'enemy' && event.type === 'wheel' && x !== 0 && x !== 1 && y !== 0 && y !== 1) fail(`${name}: wheels must start on an edge of the playable area.`);
    const result = { time, kind: event.kind, type: event.type, x, y };
    shield(event, result, name);
    if (event.kind === 'food') result.lifetime = number(event.lifetime, .1, 3600, `${name} food lifetime`);
    return result;
  });
  const result = { version: 1, id: value.id.trim(), duration, goal, heartCost, brickSet: value.brickSet, events };
  if (value.killGoal !== undefined) result.killGoal = killGoal;
  if (value.survive !== undefined) result.survive = value.survive;
  if (value.cutscene !== undefined) result.cutscene = validateCutscene(value.cutscene);
  if (value.brickTypes !== undefined) {
    if (!Array.isArray(value.brickTypes) || value.brickTypes.length > 2000) fail('Brick types must be an array of at most 2000 edge overrides.');
    result.brickTypes = value.brickTypes.map((entry, i) => {
      if (!entry || !['top', 'bottom', 'left', 'right'].includes(entry.edge) || !(entry.kind === 'cinder' || Object.hasOwn(COOLDOWNS, entry.kind))) fail(`Brick override ${i + 1} has an unknown edge or type.`);
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
      for (const attribute of ['slimed', 'springs', 'spikes', 'conveyor']) {
        if (entry[attribute] === undefined) continue;
        if (typeof entry[attribute] !== 'boolean') fail(`Brick override ${i + 1} ${attribute} must be a boolean.`);
        override[attribute] = entry[attribute];
      }
      if (entry.portal !== undefined) {
        if (entry.portal !== null && (typeof entry.portal !== 'string' || !Object.hasOwn(PORTALS, entry.portal))) fail(`Brick override ${i + 1} has an unknown portal color.`);
        override.portal = entry.portal;
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
          const spawn = entry.spawner, types = { food: FOODS, weapon: SWORDS, enemy: { mouse: true, wheel: true, ram: true, bucket: true }, heart: { heart: true } };
          if (!spawn || !Object.hasOwn(types, spawn.kind) || !Object.hasOwn(types[spawn.kind], spawn.type)) fail(`Brick override ${i + 1} has an unknown spawning item.`);
          override.spawner = { kind: spawn.kind, type: spawn.type };
          shield(spawn, override.spawner, `Brick override ${i + 1}`);
          if (spawn.kind === 'food') override.spawner.lifetime = number(spawn.lifetime, .1, 3600, `Brick override ${i + 1} spawn food lifetime`);
        }
      }
      if (override.slimed && override.springs) fail(`Brick override ${i + 1} cannot be both Slimed and Springs.`);
      if (override.spikes && (override.slimed || override.springs)) fail(`Brick override ${i + 1} cannot combine Spikes with Slimed or Springs.`);
      if (override.conveyor && (override.slimed || override.springs || override.spikes)) fail(`Brick override ${i + 1} cannot combine Conveyor with another surface.`);
      if (CONTACT_SURFACES.filter(attribute => override[attribute]).length > 1) fail(`Brick override ${i + 1} cannot combine contact surfaces.`);
      if (override.kind === 'cinder' && ['crumbler', 'warped', 'toggle', ...CONTACT_SURFACES].some(attribute => override[attribute])) fail(`Brick override ${i + 1}: Cinder bricks cannot have modifiers or contact surfaces.`);
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
      return { owner: group.owner, members };
    });
  }
  applyBrickGroups(bricks, result.brickGroups);
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

function brickEditRegions(bricks) {
  return new Map(bricks.map(brick => [brick.id, brick.region]));
}

function brickShape(parts, crumbly = false, wear = 0) {
  wear = crumbly ? Math.max(0, Math.min(1, wear)) : 0;
  const coordinates = axis => [...new Set(parts.flatMap(part =>
    [part[axis], part[axis] + part[axis === 'x' ? 'w' : 'h']].map(value => Math.round(value * 1e6) / 1e6)))].sort((a, b) => a - b);
  const xs = coordinates('x'), ys = coordinates('y');
  const x = xs[0], y = ys[0], w = xs.at(-1) - x, h = ys.at(-1) - y;
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
        const along = .18 + i * .29 + seed * .003;
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

function brickSpring(parts, width, height, compression = 0) {
  const { w, h, edges } = brickInnerEdges(parts, width, height);
  let platform = '', coils = '', grain = '', highlight = '';
  for (const { ax, ay, dx, dy, length, thickness } of edges) {
    const depth = Math.min(10, thickness * .32);
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

function brickSpikes(parts, width, height) {
  const { x, y, w, h, edges } = brickInnerEdges(parts, width, height);
  const triangles = [];
  for (const { ax, ay, dx, dy, length, thickness } of edges) {
    const count = Math.max(1, Math.round(length / 16));
    const depth = Math.min(14, thickness * .6);
    const at = (t, offset) => [x + ax + dx * t + dy / length * offset, y + ay + dy * t - dx / length * offset];
    for (let i = 0; i < count; i++) {
      triangles.push([at(i / count, 0), at((i + .5) / count, depth), at((i + 1) / count, 0)]);
    }
  }
  const path = triangles.map(triangle => `M${triangle.map(([px, py]) => `${(px - x) / w} ${(py - y) / h}`).join('L')}Z`).join('');
  return { path, triangles };
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
  for (const { ax, ay, dx, dy, length } of edges) {
    const at = (along, inset) => point(ax + dx * .5 + dx / length * along - dy / length * inset,
      ay + dy * .5 + dy / length * along + dx / length * inset);
    arrows += `M${at(sign * 5, 9)}L${at(-sign * 3, 5)}L${at(-sign * 3, 13)}Z`;
  }
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
  const inset = portrait ? 8 : 20, gap = 8, thickness = portrait ? 45 / scale : 22;
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
function brickContact(x, y, dx, dy, radius, brick) {
  const { x: left, y: top, w, h } = brick;
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

function distanceToSegment(px, py, x, y, endX, endY) {
  const dx = endX - x, dy = endY - y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((px - x) * dx + (py - y) * dy) / length)) : 0;
  return Math.hypot(px - x - t * dx, py - y - t * dy);
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
    if (a > 0 && b < 0 && discriminant >= 0) {
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
  if (level.survive) return `Survive for ${level.duration} seconds until the timer reaches zero`;
  const targets = [];
  if (level.goal > 0) targets.push(`Collect ${level.goal} food`);
  if (level.killGoal > 0) targets.push(`${targets.length ? 'earn' : 'Earn'} ${level.killGoal} enemy points`);
  return `${targets.join(' and ')} before time runs out (${level.duration} seconds)`;
}

function rotateToward(angle, target, maximum) {
  const difference = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
  return angle + Math.max(-maximum, Math.min(maximum, difference));
}

class Game {
  constructor(random = Math.random, { portrait = false, scale = 1, level = 0, customLevel = null, editorPreview = false } = {}) {
    if (customLevel) {
      this.customLevel = validateCustomLevel(customLevel, { allowUnpairedPortals: editorPreview });
      this.levelIndex = -1;
      this.level = { ...this.customLevel, heartCost: this.customLevel.heartCost ?? Infinity, food: [], enemies: [], weapons: [] };
      this.customEvents = [...this.customLevel.events].sort((a, b) => a.time - b.time);
    } else {
      if (!LEVELS[level]) throw new RangeError(`Unknown level: ${level}`);
      this.levelIndex = level;
      this.level = LEVELS[level];
      this.customEvents = [];
    }
    this.random = random;
    this.portrait = portrait;
    this.scale = scale;
    this.width = portrait ? HEIGHT : WIDTH;
    this.height = portrait ? WIDTH : HEIGHT;
    this.reset();
  }

  reset() {
    this.state = 'ready';
    this.elapsed = 0;
    this.score = 0;
    this.enemies = 0;
    this.hearts = 3;
    this.invulnerableUntil = 0;
    this.nextEvent = 0;
    this.food = [];
    this.bricks = makeBricks(this.portrait, this.scale);
    this.brickRevision = 0;
    this.cat = { x: this.width / 2, y: this.height / 2, radius: 21, vx: 0, vy: 0 };
    this.target = null;
    this.stuckUntil = 0;
    this.stuckColor = 'green';
    this.releasedAt = null;
    this.pickups = [];
    this.foodId = 0;
    this.robots = [];
    this.enemyDeaths = [];
    this.weapons = [];
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
      this.prepareSpawns();
      this.spawnCustomEvents();
    }
  }
  pause() { if (this.state === 'playing') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'playing'; }

  get invulnerable() { return this.invulnerableUntil > this.elapsed + 1e-9; }

  get damageProgress() {
    return this.invulnerable ? 1 - (this.invulnerableUntil - this.elapsed) / DAMAGE_DURATION : null;
  }

  takeDamage() {
    if (this.state !== 'playing' || this.hearts <= 0 || this.invulnerable) return false;
    this.hearts--;
    this.invulnerableUntil = this.elapsed + DAMAGE_DURATION;
    return true;
  }

  steer(id, x, y) {
    const brick = this.bricks.find(item => item.id === id);
    if (this.state !== 'playing' || this.stuckUntil > this.elapsed + 1e-9 || !brick || brick.kind === 'cinder' || !brickEnabled(brick) || brick.absorbedBy !== null || brick.usesLeft === 0 || brick.readyAt > this.elapsed + 1e-9) return false;
    const parts = this.brickParts();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !parts.some(part =>
      part.id === id && x >= part.x && x <= part.x + part.w && y >= part.y && y <= part.y + part.h)) return false;
    const dx = x - this.cat.x, dy = y - this.cat.y;
    const distance = Math.hypot(dx, dy);
    if (!distance) return false;
    const boost = !this.cat.vx && !this.cat.vy && parts.some(part =>
      this.bricks[part.id].boost && brickEnabled(this.bricks[part.id]) && this.touchingPart(part));
    const speed = SPEED * (boost ? 2 : 1);
    const vx = dx / distance * speed, vy = dy / distance * speed;
    if (parts.some(part => brickContact(this.cat.x, this.cat.y, vx / 120, vy / 120, this.cat.radius, part) <= 1e-9)) return false;
    if (this.spikeParts(parts).some(({ triangle }) =>
      spikeContact(this.cat.x, this.cat.y, vx / 120, vy / 120, this.cat.radius, triangle) <= 1e-9)) return false;
    brick.readyAt = this.elapsed + COOLDOWNS[brick.kind];
    if (brick.usesLeft !== null) brick.usesLeft--;
    if (brick.warped) this.absorbNeighbor(brick);
    for (const other of this.bricks) {
      if (other.toggle && other.absorbedBy === null && (other.usesLeft !== 0 || other.id === id)) {
        other.toggleRemaining = other.toggleRemaining === 0 ? other.toggle : other.toggleRemaining - 1;
      }
    }
    this.boosted = boost;
    this.cat.vx = vx;
    this.cat.vy = vy;
    this.conveyorRide = null;
    this.target = { x, y };
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
    return parts;
  }

  touchingPart(part) {
    return Math.hypot(this.cat.x - Math.max(part.x, Math.min(part.x + part.w, this.cat.x)),
      this.cat.y - Math.max(part.y, Math.min(part.y + part.h, this.cat.y))) <= this.cat.radius + 1e-6;
  }

  trajectory() {
    const { x, y, vx, vy, radius } = this.cat;
    const speed = Math.hypot(vx, vy);
    if (!speed || this.conveyorRide) return this.target ? [[x, y], [this.target.x, this.target.y]] : [];
    const parts = this.brickParts(), spikes = this.spikeParts(parts);
    const distance = Math.hypot(this.width, this.height) * 2;
    const cast = (x, y, vx, vy) => {
      const dx = vx / speed * distance, dy = vy / speed * distance;
      let contact = Math.min(1,
        dx > 0 ? (this.width - radius - x) / dx : dx < 0 ? (radius - x) / dx : Infinity,
        dy > 0 ? (this.height - radius - y) / dy : dy < 0 ? (radius - y) / dy : Infinity);
      let contacts = [];
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
      return { x: x + dx * contact, y: y + dy * contact, contacts };
    };
    const hit = cast(x, y, vx, vy);
    const points = [[x, y], [hit.x, hit.y]];
    if (!hit.contacts.length || !hit.contacts.every(part => this.bricks[part.id].springs && brickEnabled(this.bricks[part.id]))) {
      return this.target ? [[x, y], [this.target.x, this.target.y]] : points;
    }
    let reflected = { vx, vy };
    for (const part of hit.contacts) {
      const normal = brickNormal(hit.x, hit.y, part);
      if (normal) reflected = reflectVelocity(reflected.vx, reflected.vy, normal);
    }
    const end = cast(hit.x, hit.y, reflected.vx, reflected.vy);
    points.push([end.x, end.y]);
    return points;
  }

  spawnFromBrick(brick) {
    const spawn = brick.spawner;
    brick.spawned = true;
    if (spawn.kind === 'enemy') this.robots.push(...this.createEnemies([this.elapsed, spawn.type, 1, spawn.shield]));
    else if (spawn.kind === 'heart') this.healing.push(this.randomPoint());
    else if (spawn.kind === 'weapon') this.weapons.push({ ...this.randomPoint(), type: spawn.type });
    else this.food.push({ ...this.randomPoint(), id: this.foodId++, type: spawn.type,
      born: this.elapsed, lifetime: spawn.lifetime, expires: this.elapsed + spawn.lifetime });
  }

  portalExit(brick, parts = this.brickParts()) {
    const edge = brickRegions(this.bricks, this.width, this.height).get(brick.id).edge;
    const direction = { top: [0, 1], right: [-1, 0], bottom: [0, -1], left: [1, 0] }[edge];
    let x = brick.x + brick.w / 2, y = brick.y + brick.h / 2;
    const members = parts.filter(part => part.id === brick.id);
    if (direction[0]) {
      const crossing = members.filter(part => y >= part.y && y <= part.y + part.h);
      x = direction[0] > 0 ? Math.max(...crossing.map(part => part.x + part.w)) : Math.min(...crossing.map(part => part.x));
    } else {
      const crossing = members.filter(part => x >= part.x && x <= part.x + part.w);
      y = direction[1] > 0 ? Math.max(...crossing.map(part => part.y + part.h)) : Math.min(...crossing.map(part => part.y));
    }
    return { x: x + direction[0] * (this.cat.radius + .01), y: y + direction[1] * (this.cat.radius + .01), nx: direction[0], ny: direction[1] };
  }

  travelPortal(brick, parts) {
    if (this.elapsed < this.portalUntil || this.portalArrival === brick.id) return false;
    const destination = this.bricks.find(other => other.id !== brick.id && other.portal === brick.portal && other.absorbedBy === null && brickEnabled(other));
    if (!destination) return false;
    const exit = this.portalExit(destination, parts);
    const speed = Math.hypot(this.cat.vx, this.cat.vy) || SPEED;
    this.cat.x = exit.x; this.cat.y = exit.y;
    this.cat.vx = exit.nx * speed; this.cat.vy = exit.ny * speed;
    this.portalUntil = this.elapsed + .2;
    this.portalArrival = destination.id;
    this.portalTrips++;
    this.conveyorRide = null;
    this.target = null;
    return true;
  }

  spikeParts(parts) {
    return this.bricks.filter(brick => brick.spikes && brickEnabled(brick) && brick.absorbedBy === null).flatMap(brick =>
      brickSpikes(parts.filter(part => part.id === brick.id), this.width, this.height).triangles
        .map(triangle => ({ id: brick.id, triangle })));
  }

  conveyorEdge(id, parts) {
    const brick = this.bricks[id];
    if (!brick?.conveyor || !brickEnabled(brick) || brick.absorbedBy !== null) return null;
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
        if (owner !== brick.id && this.bricks[owner].kind !== 'cinder') candidates.add(owner);
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
        if (time > this.elapsed + 1 + 1e-9) break;
        if (!this.pendingSpawns.has(event)) this.pendingSpawns.set(event, { kind: kind ?? event.kind, time, items: create(event) });
      }
    };
    prepare(this.customEvents, this.nextCustom, null, event => this.createCustomSpawn(event), event => event.time);
    prepare(this.level.food, this.nextEvent, 'food', event => this.createFood(event));
    prepare(this.level.enemies, this.nextEnemy, 'enemy', event => this.createEnemies(event));
    prepare(this.level.weapons, this.nextWeapon, 'weapon', ([, type]) => [{ ...this.randomPoint(), type }]);
  }

  get spawnCues() {
    return [...this.pendingSpawns.values()].flatMap(({ kind, time, items }) => {
      if (time <= this.elapsed + 1e-9) return [];
      const progress = Math.max(0, Math.min(1, this.elapsed - (time - 1)));
      return items.map(({ x, y }) => ({ kind, x, y, progress }));
    });
  }

  takeSpawn(event, create) {
    const pending = this.pendingSpawns.get(event);
    this.pendingSpawns.delete(event);
    return pending ? pending.items : create(event);
  }

  spawn(event) {
    this.food.push(...this.takeSpawn(event, entry => this.createFood(entry)));
  }

  createFood([time, method, type, lifetime]) {
    const items = [];
    const count = method === 'S' ? 1 : Number(method.slice(1));
    const angle = this.random() * Math.PI * 2;
    const margin = this.portrait ? 8 + 45 / this.scale + 35 : 95;
    const center = this.portrait
      ? { x: margin + 88 + this.random() * (this.width - 2 * (margin + 88)), y: margin + 88 + this.random() * (this.height - 2 * (margin + 88)) }
      : { x: 240 + this.random() * 480, y: 205 + this.random() * 190 };
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
      } else if (method.startsWith('R')) {
        x = margin + this.random() * (this.width - margin * 2);
        y = margin + this.random() * (this.height - margin * 2);
      }
      items.push({ id: this.foodId++, x, y, type, born: time, expires: time + lifetime, lifetime });
    }
    return items;
  }

  bounds() {
    const inset = (this.portrait ? 8 + 45 / this.scale : 42) + 25;
    return {
      left: inset, top: inset, right: this.width - inset, bottom: this.height - inset,
    };
  }

  randomPoint() {
    const b = this.bounds();
    return { x: b.left + this.random() * (b.right - b.left), y: b.top + this.random() * (b.bottom - b.top) };
  }

  pointFromRelative(x, y) {
    const b = this.bounds();
    return { x: b.left + x * (b.right - b.left), y: b.top + y * (b.bottom - b.top) };
  }

  spawnCustomEvents() {
    while (this.nextCustom < this.customEvents.length && this.customEvents[this.nextCustom].time <= this.elapsed + 1e-9) {
      const event = this.customEvents[this.nextCustom++];
      const target = event.kind === 'food' ? this.food : event.kind === 'weapon' ? this.weapons : this.robots;
      target.push(...this.takeSpawn(event, entry => this.createCustomSpawn(entry)));
    }
  }

  createCustomSpawn(event) {
    const point = this.pointFromRelative(event.x, event.y);
    if (event.kind === 'food') return [{ ...point, id: this.foodId++, type: event.type, born: event.time, expires: event.time + event.lifetime, lifetime: event.lifetime }];
    if (event.kind === 'weapon') return [{ ...point, type: event.type }];
    const enemy = { ...point, type: event.type, radius: 19, phase: this.random() * Math.PI * 2, age: 0, touching: false, distance: 0 };
    this.initializeShield(enemy, event.shield);
    if (event.type === 'ram') this.initializeRam(enemy);
    if (event.type === 'bucket') this.initializeBucket(enemy);
    if (event.type === 'wheel') {
      const b = this.bounds(), w = b.right - b.left, h = b.bottom - b.top;
      if (event.y === 0) enemy.distance = event.x * w;
      else if (event.x === 1) enemy.distance = w + event.y * h;
      else if (event.y === 1) enemy.distance = w + h + (1 - event.x) * w;
      else enemy.distance = 2 * w + h + (1 - event.y) * h;
      this.placeWheel(enemy);
    }
    return [enemy];
  }

  spawnEnemies(event) {
    this.robots.push(...this.takeSpawn(event, entry => this.createEnemies(entry)));
  }

  createEnemies([, type, count, shield]) {
    const items = [];
    const b = this.bounds(), w = b.right - b.left, h = b.bottom - b.top;
    for (let i = 0; i < count; i++) {
      const enemy = { ...this.randomPoint(), type, radius: 19, phase: this.random() * Math.PI * 2, age: 0, touching: false, distance: this.random() * 2 * (w + h) };
      this.initializeShield(enemy, shield);
      if (type === 'ram') this.initializeRam(enemy);
      if (type === 'bucket') this.initializeBucket(enemy);
      if (type === 'wheel') this.placeWheel(enemy);
      items.push(enemy);
    }
    return items;
  }

  initializeShield(enemy, shield) {
    enemy.shield = shield ?? null;
    enemy.defeatPoints = shield ? SHIELDS[shield].hits : 1;
    enemy.invulnerableUntil = 0;
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
    return Math.max(.25, -4 * Math.log(1 - Math.min(this.random(), 1 - Number.EPSILON)));
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
    enemy.shotTimer -= seconds;
    if (enemy.shotTimer <= 1e-9) {
      this.fireBucketBomb(enemy);
      enemy.shotTimer += this.nextBucketShot();
    }
    enemy.bombs = enemy.bombs.filter(bomb => {
      if (bomb.state === 'flying') {
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
        if (touching && !bomb.touching) this.takeDamage();
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
    if (enemy.type === 'wheel' || (enemy.type === 'mouse' && enemy.resting)
      || (enemy.type === 'ram' && enemy.state === 'targeting')) return;
    const angle = enemy.type === 'ram' ? enemy.angle : enemy.phase;
    const vx = Math.cos(angle), vy = Math.sin(angle);
    const incoming = vx * nx + vy * ny;
    if (incoming >= -1e-9) return;
    const reflected = Math.atan2(vy - 2 * incoming * ny, vx - 2 * incoming * nx);
    if (enemy.type === 'ram') {
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
    if (a.type === 'wheel' && b.type === 'wheel') {
      const perimeter = 2 * (bounds.right - bounds.left + bounds.bottom - bounds.top);
      const ahead = ((b.distance - a.distance) % perimeter + perimeter) % perimeter;
      const behind = ahead > 0 && ahead < perimeter / 2 ? a : b;
      const distance = behind.distance;
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
    if (a.type === 'wheel' || b.type === 'wheel') {
      const wheel = a.type === 'wheel' ? a : b, other = wheel === a ? b : a;
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
          if (enemy.type === 'wheel') continue;
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

  combat(dt, startX, startY) {
    if (this.weapon && this.weapon.expires <= this.elapsed + 1e-9) this.weapon = null;
    const collected = [];
    const dx = this.cat.x - startX, dy = this.cat.y - startY, length = Math.hypot(dx, dy);
    const reach = this.cat.radius + 14;
    this.weapons = this.weapons.filter(item => {
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
    }
    const bounds = this.bounds(), parts = this.robots.some(enemy => ['ram', 'bucket'].includes(enemy.type)) ? this.brickParts() : [];
    const previous = new Map(this.robots.map(enemy => [enemy, { x: enemy.x, y: enemy.y }]));
    for (const enemy of this.robots) {
      enemy.age += dt;
      if (enemy.type === 'wheel') {
        enemy.distance += 95 * dt;
        this.placeWheel(enemy);
      } else if (enemy.type === 'ram') {
        this.updateRam(enemy, dt, parts);
      } else if (enemy.type === 'bucket') {
        this.updateBucket(enemy, dt, parts);
      } else {
        enemy.resting = enemy.age % 6 >= 4.5;
        if (!enemy.resting) {
          enemy.phase += Math.sin(enemy.age * 1.7 + enemy.phase) * dt;
          enemy.x += Math.cos(enemy.phase) * 65 * dt;
          enemy.y += Math.sin(enemy.phase) * 65 * dt;
          if (enemy.x < bounds.left || enemy.x > bounds.right) enemy.phase = Math.PI - enemy.phase;
          if (enemy.y < bounds.top || enemy.y > bounds.bottom) enemy.phase = -enemy.phase;
          enemy.x = Math.max(bounds.left, Math.min(bounds.right, enemy.x));
          enemy.y = Math.max(bounds.top, Math.min(bounds.bottom, enemy.y));
        }
      }
    }
    this.resolveEnemyCollisions(previous);
    this.robots = this.robots.filter(enemy => {
      const old = previous.get(enemy);
      const distance = distanceToSegment(0, 0, startX - old.x, startY - old.y, this.cat.x - enemy.x, this.cat.y - enemy.y);
      if ((this.weapon || this.boosted) && distance <= this.cat.radius + enemy.radius + 18) {
        if (this.enemyDamageProgress(enemy) === null) {
          if (!this.boosted && Number.isFinite(this.weapon.uses) && --this.weapon.uses === 0) this.weapon = null;
          if (enemy.shield) {
            enemy.shield = SHIELDS[enemy.shield].next;
            enemy.invulnerableUntil = this.elapsed + DAMAGE_DURATION;
          } else {
            this.enemies += enemy.defeatPoints ?? 1;
            this.enemyDeaths.push({ ...enemy, bombs: enemy.bombs?.map(bomb => ({ ...bomb })) ?? [], deathProgress: 0 });
            return false;
          }
        }
        enemy.touching = Math.hypot(this.cat.x - enemy.x, this.cat.y - enemy.y) <= this.cat.radius + enemy.radius;
        return true;
      }
      if (distance <= this.cat.radius + enemy.radius && !enemy.touching) this.takeDamage();
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

  updateEnemyDeaths(seconds) {
    this.enemyDeaths = this.enemyDeaths.filter(enemy => {
      enemy.deathProgress += seconds / (enemy.type === 'mouse' ? 1.1 : enemy.type === 'ram' ? .9 : enemy.type === 'bucket' ? .9 : .7);
      return enemy.deathProgress < 1 - 1e-9;
    });
  }

  update(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    if (this.state === 'won' || this.state === 'lost') this.updateEnemyDeaths(seconds);
    if (this.state !== 'playing') return;
    let remaining = Math.min(seconds, this.level.duration - this.elapsed);
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
    this.updateEnemyDeaths(dt);
    this.elapsed = Math.min(this.level.duration, this.elapsed + dt);
    if (this.stuckUntil && this.stuckUntil <= this.elapsed + 1e-9) {
      this.releasedAt = this.stuckUntil;
      this.stuckUntil = 0;
    }
    this.restoreWarps();
    this.prepareSpawns();
    this.spawnCustomEvents();
    while (this.nextEvent < this.level.food.length && this.level.food[this.nextEvent][0] <= this.elapsed + 1e-9) {
      this.spawn(this.level.food[this.nextEvent++]);
    }
    while (this.nextEnemy < this.level.enemies.length && this.level.enemies[this.nextEnemy][0] <= this.elapsed + 1e-9) this.spawnEnemies(this.level.enemies[this.nextEnemy++]);
    while (this.nextWeapon < this.level.weapons.length && this.level.weapons[this.nextWeapon][0] <= this.elapsed + 1e-9) {
      const event = this.level.weapons[this.nextWeapon++];
      this.weapons.push(...this.takeSpawn(event, ([, type]) => [{ ...this.randomPoint(), type }]));
    }
    for (const [event, pending] of this.pendingSpawns) {
      if (pending.kind === 'heart' && pending.time <= this.elapsed + 1e-9) {
        this.healing.push(...pending.items);
        this.pendingSpawns.delete(event);
      }
    }
    this.food = this.food.filter(item => item.expires > this.elapsed + 1e-9);
    const cat = this.cat;
    const parts = this.brickParts();
    if (this.portalArrival !== null && !parts.some(part => part.id === this.portalArrival && this.touchingPart(part))) this.portalArrival = null;
    for (const brick of this.bricks) {
      if (brick.spawner && !brick.spawned && brickEnabled(brick) && brick.absorbedBy === null
        && parts.some(part => part.id === brick.id && this.touchingPart(part))) this.spawnFromBrick(brick);
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
        rideEnd = remaining <= CONVEYOR_SPEED * dt + 1e-9;
      }
    }
    const dx = cat.vx * dt, dy = cat.vy * dt;
    const spikes = dx || dy || this.spikeTouching.size ? this.spikeParts(parts) : [];
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
    if (dx || dy) {
      for (const brick of parts) {
        if (this.conveyorRide?.id === brick.id) {
          // The center follows the union's radius-expanded rim, including corner clearance.
          continue;
        }
        const t = brickContact(cat.x, cat.y, dx, dy, cat.radius, brick);
        if (t < contact - 1e-9) { contact = t; contacts = [brick]; }
        else if (t <= contact + 1e-9 && t <= 1) contacts.push(brick);
      }
      for (const spike of spikes) {
        const t = spikeContact(cat.x, cat.y, dx, dy, cat.radius, spike.triangle);
        if (t < contact - 1e-9) { contact = t; contacts = [spike]; }
        else if (t <= contact + 1e-9 && t <= 1) contacts.push(spike);
      }
    }
    const endX = cat.x + dx * contact, endY = cat.y + dy * contact;
    this.food = this.food.filter(item => {
      if (distanceToSegment(item.x, item.y, cat.x, cat.y, endX, endY) > cat.radius + 12) return true;
      const value = FOODS[item.type].value;
      this.score += value;
      this.pickups.push({ x: item.x, y: item.y, value, time: this.elapsed });
      return false;
    });
    while (this.score >= this.nextHeart) {
      const event = { time: this.elapsed + 1 };
      this.pendingSpawns.set(event, { kind: 'heart', time: event.time, items: [this.randomPoint()] });
      this.nextHeart += this.level.heartCost;
    }
    const startX = cat.x, startY = cat.y;
    cat.x = endX; cat.y = endY;
    const spikeIds = new Set(contacts.filter(part => this.bricks[part.id].spikes && brickEnabled(this.bricks[part.id])).map(part => part.id));
    if ([...spikeIds].some(id => !this.spikeTouching.has(id))) this.takeDamage();
    for (const id of spikeIds) this.spikeTouching.add(id);
    this.combat(dt, startX, startY);
    for (const id of new Set(contacts.map(part => part.id))) {
      const brick = this.bricks[id];
      if (brick.spawner && !brick.spawned && brickEnabled(brick)) this.spawnFromBrick(brick);
    }
    const portal = contacts.map(part => this.bricks[part.id]).find(brick => brick.portal && brickEnabled(brick));
    const teleported = portal && this.travelPortal(portal, parts);
    if (contacts.length && !teleported) {
      this.conveyorRide = null;
      const solid = contacts.filter(part => !this.bricks[part.id].springs || !brickEnabled(this.bricks[part.id]));
      if (solid.length || ride) {
        cat.vx = 0; cat.vy = 0;
        const slimes = solid.map(part => this.bricks[part.id]).filter(brick => brick.slimed && brickEnabled(brick))
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
    if (rideEnd && !this.conveyorEdge(ride.id, parts)) {
      this.conveyorRide = null;
      cat.vx = 0; cat.vy = 0;
    }
    if (!cat.vx && !cat.vy) this.boosted = false;
    this.pickups = this.pickups.filter(item => this.elapsed - item.time < .8);
    if (cat.x - cat.radius < 0 || cat.x + cat.radius > this.width || cat.y - cat.radius < 0 || cat.y + cat.radius > this.height || this.hearts <= 0) {
      this.state = 'lost';
    } else if (!this.level.survive && this.score >= this.level.goal && this.enemies >= (this.level.killGoal ?? 0)) {
      this.state = 'won';
    } else if (this.elapsed >= this.level.duration - 1e-9) {
      this.elapsed = this.level.duration;
      this.state = this.level.survive ? 'won' : 'lost';
    }
  }
}

// Classic scripts work over file:// as well as HTTP; Node uses the same engine.
const api = { Game, Cutscene, CHARACTERS, SCENE_THEMES, validateCutscene, levelObjective, WIDTH, HEIGHT, DURATION, GOAL, SPEED, CONVEYOR_SPEED, COOLDOWNS, SLIMES, SHIELDS, FOODS, SCHEDULE, LEVELS, SWORDS, PORTALS, CONTACT_SURFACES, brickEnabled, portalPairIssues, makeBricks, brickContact, validateCustomLevel, snapWheel, brickRegions, brickEditRegions, brickShape, brickRecharge, brickSlime, brickSpring, brickSpikes, brickConveyor };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
} else {
  globalThis.KoshiGame = api;
}
})();
