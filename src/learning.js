(function () {
'use strict';

const engine = typeof module !== 'undefined' && module.exports ? require('./game.js') : globalThis.KoshiGame;
const { Game, COOLDOWNS, SLIMES, FOODS, SWORDS, LEVELS, brickRegions } = engine;

const GUIDE = [
  {
    title: 'Movement & controls',
    sections: [
      ['Aim at bricks, not objects', 'Click or tap a boundary brick. Koshi travels toward that exact spot, collecting anything along his path. He stops at the first solid brick he touches. Pick another brick to leave it.'],
      ['Change course', 'Select a different available brick while Koshi is moving to redirect him immediately. A blocked or invalid selection does not use a cooldown or a Crumbler selection.'],
      ['Keyboard & pause', 'Tab to a brick and press Enter or Space to aim at its center. Escape or Space outside a control pauses/resumes the game. Pause also freezes cooldowns, slime holds, weapons, previews, and Warped timers. Switching away pauses automatically; resume explicitly.'],
      ['A fresh attempt', 'Restart resets the current level. Menu returns to the title screen. Choose a level starts that level; Next level advances after a win.'],
    ],
  },
  {
    title: 'Cooldown bricks',
    sections: [
      ...Object.entries(COOLDOWNS).map(([kind, seconds]) => [
        `${kind[0].toUpperCase() + kind.slice(1)} / ${{ slow: 'blue', normal: 'green', fast: 'red' }[kind]}`,
        `Wait ${seconds} seconds after selecting this brick before selecting it again. Its entire surface refills with color along the board boundary. Empty means recharging; fully colored means ready.`,
        `brick:${kind}`,
      ]),
      ['Keep moving', 'Cooling bricks stay solid. Use other bricks while one recharges. Brick cooldown color is independent of its slime color.'],
    ],
  },
  {
    title: 'Crumblers & Warped',
    sections: [
      ['Crumblers / C counter', 'Jagged Crumblers have limited selections. Each successful selection deepens their chips and cracks and reduces C by one. At C:0 the brick stays solid, but cannot be selected until restart. Its cooldown animation stops.', 'brick:crumbler'],
      ['Warped / W counter', 'Swirl-patterned Warped bricks absorb one neighboring brick or entire group each successful selection, including around corners. The enlarged surface acts as one brick with the selected owner’s cooldown and attributes. The first absorption starts W; further selections do not restart it.', 'brick:warped'],
      ['Restoration & combinations', 'When W expires, absorbed bricks regain their own attributes and remaining uses. A combined Warped Crumbler that reaches C:0 freezes enlarged with W:X until restart or absorption by another Warped owner.', 'brick:warped-crumbler'],
    ],
  },
  {
    title: 'Slime, Springs & Spikes',
    sections: [
      ...Object.entries(SLIMES).map(([color, { duration }]) => [
        `${color[0].toUpperCase() + color.slice(1)} slime / ${duration} second${duration === 1 ? '' : 's'}`,
        'Drippy icing covers only the edge facing the play area. Touching it freezes Koshi. A matching-color ring drains with the remaining hold; FREE! signals release. Select a brick to move again.',
        `slime:${color}`,
      ]),
      ['Springs', 'A wooden platform with grain and a dark outline covers only the arena-facing edge. It reflects Koshi immediately instead of stopping him. Little springs underneath are hidden at rest and appear only while the platform compresses and rebounds on contact. Redirect him mid-bounce to take control.', 'brick:springs'],
      ['Spikes', 'Many white triangular spikes protrude toward the arena. Touching them costs one heart and stops Koshi. Resting against them does not cause more damage; leaving and touching them again does. Swords do not protect against spikes. Levels 1-3 through 1-5 introduce them.', 'brick:spikes'],
      ['Contact is not a selection', 'Slime, Springs, and Spikes work even on cooling or exhausted bricks. Contact does not consume cooldowns or C uses. They replace one another, but can combine with Crumbler and Warped attributes.'],
    ],
  },
  {
    title: 'Food & healing',
    sections: [
      ...Object.entries(FOODS).map(([type, food]) => [`${food.icon} ${food.name} / +${food.value}`, `Adds ${food.value} food point${food.value === 1 ? '' : 's'} when touched. Food may appear alone, in lines, in circles, or scattered around the arena.`, `food:${type}`]),
      ['Food expires', 'The small bar above food shows its remaining lifetime. Expired snacks disappear; pause freezes their lifetime.'],
      ['Hearts', 'Koshi starts with three hearts. From campaign Level 1-2 onward, every 10 food points creates a pink, sparkling cloud, followed one second later by a healing heart at the same spot. Touch the heart to restore one heart, capped at three. Hearts remain until collected. Custom levels can change or disable this threshold.', 'heart'],
    ],
  },
  {
    title: 'Robots & swords',
    sections: [
      ['Robo Mouse', 'Mice wander in curved paths and periodically stop to lick their hands. They do not chase or shoot.', 'enemy:mouse'],
      ['Robo Wheel', 'Wheels roll along the inner perimeter. Intercept them near a wall while armed.', 'enemy:wheel'],
      ['Damage & defeats', 'Unarmed contact costs one heart. After damage, Koshi looks upset and blinks red for exactly one second of protection from robots and spikes. When his normal face and colors return he can take damage again. Further contacts do not extend protection; pause freezes it. Staying overlapped does not repeatedly hurt, but separating and colliding again can. At zero hearts the level ends. Collect a sword, then approach a robot to strike automatically.'],
      ...Object.entries(SWORDS).map(([type, sword]) => [
        sword.name,
        type === 'gold' ? `${sword.seconds} seconds of unlimited defeats from pickup; pause freezes the timer.` : `Defeats ${sword.uses} robot${sword.uses === 1 ? '' : 's'} before breaking. Works on both enemy types.`,
        `weapon:${type}`,
      ]),
      ['One sword at a time', 'You cannot swap while equipped. Uncollected swords remain on the board until you can pick them up.'],
    ],
  },
  {
    title: 'Spawn warnings',
    sections: [
      ['Purple cloudy skull / enemy', 'Materializes at each robot’s starting location one second before it appears. Wheel warnings sit on the inner perimeter. Keep clear unless armed.'],
      ['Golden swirl / weapon', 'Grows from a point and dissipates over one second to reveal a sword at the same location.'],
      ['Twinkling star / food', 'A bright pinpoint grows into a star and fades over one second before food appears. Each snack in a pattern gets its own warning.'],
      ['Pink sparkling cloud / heart', 'Appears when food reaches the healing threshold. One second later, a healing heart appears at the same location.'],
      ['Safe previews', 'Warnings cannot hurt or be collected. They freeze with pause and do not alter spawn times. Spawns within the first second have shortened warnings; time-zero objects appear immediately.'],
    ],
  },
  {
    title: 'Objectives',
    sections: [
      ['Win before time runs out', 'Levels 1-1 and 1-2 require 20 food. Levels 1-3 through 1-5 require BOTH food and robot defeats. The HUD shows each target; progress follows the less-complete objective.'],
      ...LEVELS.map(level => [
        `Level ${level.id}`,
        `${level.duration} seconds. Collect ${level.goal} food${level.killGoal ? ` AND defeat ${level.killGoal} robots` : ''}.`,
      ]),
      ['Losing & retrying', 'Running out of time, losing all hearts, or leaving the board ends an attempt. Restart restores bricks, hearts, objects, and timers. Survival-only and boss objectives are not implemented yet.'],
      ['Make your own', 'The level editor creates portable levels with timed food, robots, weapons, and brick attributes. Playtest links work without a server.'],
    ],
  },
];

const LESSONS = [
  { id: 'aim', title: 'Aim & stop', instruction: 'Tap the outlined brick. Koshi travels to it and stops. Objects are collected along the way, not by tapping them.' },
  { id: 'redirect', title: 'Redirect in flight', instruction: 'Tap any brick, then quickly tap a DIFFERENT brick before Koshi stops. You can change course mid-flight.' },
  { id: 'food', title: 'Collect food', instruction: 'Tap the outlined brick to travel through all three strawberries. Watch the food counter rise.' },
  { id: 'cooldown', title: 'Brick recharge', instruction: 'Use the outlined fast brick, then wait for its 3-second full-surface refill. Other bricks remain available.' },
  { id: 'crumbler', title: 'Crumblers', instruction: 'Use the outlined Crumbler twice: go to it, go to the opposite brick, then return after it recharges. C:0 is solid but permanently unselectable.' },
  { id: 'warped', title: 'Warped bricks', instruction: 'Select the outlined Warped brick. Watch it absorb a neighbor, then wait 8 seconds for the group to restore.' },
  ...['red', 'green', 'blue'].map(color => ({
    id: `slime-${color}`, title: `${color[0].toUpperCase() + color.slice(1)} slime`,
    instruction: `Touch the outlined slime brick. Steering locks for ${SLIMES[color].duration} second${color === 'red' ? '' : 's'} while the ring drains. Wait for FREE!, then pick a brick to leave.`,
  })),
  { id: 'springs', title: 'Springs', instruction: 'Aim at the outlined brown Spring. Koshi bounces instead of stopping. Try redirecting him during the bounce.' },
  { id: 'mouse', title: 'Swords & Robo Mouse', instruction: 'Choose a sword below, then aim at the outlined brick. Pick up the sword before reaching the mouse; attacks are automatic. Try each sword with Retry.' },
  { id: 'wheel', title: 'Robo Wheel', instruction: 'Aim at the outlined brick to collect a sword and intercept a wheel at the inner perimeter. Unlike a mouse, it keeps rolling along the wall.' },
  { id: 'healing', title: 'Heal with food', instruction: 'You have two hearts and 9 food. Collect the strawberry to reach 10, then head back along your route to collect the healing heart.' },
  { id: 'warnings', title: 'Spawn warnings', instruction: 'Wait for the skull, swirl, and star at 2 seconds. They reveal objects at 3 seconds. Then aim at the outlined brick to collect the snack.' },
  { id: 'pause', title: 'Pause & resume', instruction: 'Press Pause (or Escape), then Resume. The clock, movement, previews, and all brick timers freeze while paused.' },
  { id: 'objectives', title: 'Two goals to win', instruction: 'Aim at the outlined brick to collect a sword, one food, and defeat one robot. BOTH goals are required to complete this practice challenge.' },
];

class Tutorial {
  constructor() {
    this.completed = new Set();
    this.sword = 'silver';
    this.index = 0;
  }
  get lesson() { return LESSONS[this.index]; }
  select(index, options = {}) {
    if (!Number.isInteger(index) || !LESSONS[index]) throw new RangeError(`Unknown tutorial step: ${index}`);
    this.index = index;
    this.actions = 0;
    this.lastBrick = undefined;
    this.redirected = false;
    this.warpSeen = false;
    this.held = false;
    this.paused = false;
    this.previewSeen = false;
    this.currentComplete = false;
    const level = { version: 1, id: `Practice ${index + 1}`, duration: 3600, goal: 1000, heartCost: 10, brickSet: 1, events: [] };
    const game = new Game(() => .5, { ...options, customLevel: level });
    // Practice has no time limit; the final lesson alone uses normal victory rules.
    game.level.duration = Infinity;
    game.level.goal = this.lesson.id === 'objectives' ? 1 : Infinity;
    if (this.lesson.id === 'objectives') game.level.killGoal = 1;
    const regions = brickRegions(game.bricks, game.width, game.height);
    this.target = game.bricks.filter(brick => regions.get(brick.id).edge === 'right')
      .sort((a, b) => Math.abs(a.y + a.h / 2 - game.height / 2) - Math.abs(b.y + b.h / 2 - game.height / 2))[0];
    this.target.kind = 'fast';
    game.cat.y = this.target.y + this.target.h / 2;
    const start = { x: game.cat.x, y: game.cat.y };
    this.origin = start;
    const along = fraction => ({ x: start.x + (this.target.x - game.cat.radius - start.x) * fraction, y: start.y });
    const addFood = (fraction, value = 'S') => {
      game.food.push({ ...along(fraction), id: game.foodId++, type: value, born: 0, expires: 3600, lifetime: 3600 });
    };
    const addSword = () => game.weapons.push({ ...along(.22), type: this.sword });
    const id = this.lesson.id;
    if (id === 'food') for (const fraction of [.25, .5, .75]) addFood(fraction);
    if (id === 'crumbler') { this.target.crumbler = 2; this.target.usesLeft = 2; }
    if (id === 'warped') this.target.warped = 8;
    if (id.startsWith('slime-')) { this.target.slimed = true; this.target.slimeColor = id.slice(6); }
    if (id === 'springs') this.target.springs = true;
    if (['mouse', 'wheel', 'objectives'].includes(id)) {
      addSword();
      if (id === 'wheel') {
        const bounds = game.bounds();
        const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'wheel', x: 1, y: (start.y - bounds.top) / (bounds.bottom - bounds.top) })[0];
        // Start upstream so the moving wheel meets the launch path near arrival.
        enemy.distance -= 95 * (bounds.right - start.x) / engine.SPEED;
        game.placeWheel(enemy);
        game.robots.push(enemy);
      } else {
        game.robots.push({ ...along(.8), type: 'mouse', radius: 19, phase: 0, age: 4.5, touching: false });
      }
    }
    if (id === 'objectives') addFood(.55);
    if (id === 'healing') {
      game.hearts = 2; game.score = 9; addFood(.55);
      const bounds = game.bounds();
      game.random = () => (start.y - bounds.top) / (bounds.bottom - bounds.top);
    }
    if (id === 'warnings') {
      const bounds = game.bounds(), food = along(.6);
      game.customEvents = [
        { time: 3, kind: 'food', type: 'S', x: (food.x - bounds.left) / (bounds.right - bounds.left), y: (food.y - bounds.top) / (bounds.bottom - bounds.top), lifetime: 3600 },
        { time: 3, kind: 'weapon', type: 'gold', x: .25, y: .25 },
        { time: 3, kind: 'enemy', type: 'mouse', x: .75, y: .25 },
      ];
    }
    game.brickRevision++;
    game.start();
    this.game = game;
    return game;
  }
  steer(id, x, y) {
    const moving = Boolean(this.game.cat.vx || this.game.cat.vy);
    const previous = this.lastBrick;
    const accepted = this.game.steer(id, x, y);
    if (accepted) {
      this.actions++;
      this.lastBrick = id;
      if (moving && previous !== undefined && id !== previous) this.redirected = true;
    }
    return accepted;
  }
  observe() {
    const game = this.game, id = this.lesson.id;
    if (game.state === 'paused') this.paused = true;
    if (this.target.warpUntil !== null) this.warpSeen = true;
    if (game.stuckUntil > game.elapsed + 1e-9) this.held = true;
    if (game.spawnCues.length) this.previewSeen = true;
    const success = {
      aim: this.actions > 0 && !game.cat.vx && !game.cat.vy && Math.hypot(game.cat.x - this.origin.x, game.cat.y - this.origin.y) > 10,
      redirect: this.redirected,
      food: game.score >= 3,
      cooldown: this.target.readyAt > 0 && game.elapsed >= this.target.readyAt - 1e-9,
      crumbler: this.target.usesLeft === 0,
      warped: this.warpSeen && this.target.warpUntil === null,
      springs: this.target.hitAt !== null,
      mouse: game.enemies >= 1,
      wheel: game.enemies >= 1,
      healing: game.hearts === 3 && game.score >= 10,
      warnings: this.previewSeen && game.score > 0,
      pause: this.paused && game.state === 'playing',
      objectives: game.state === 'won',
    }[id] ?? (id.startsWith('slime-') && this.held && game.stuckUntil === 0);
    if (success) { this.completed.add(id); this.currentComplete = true; }
    return this.currentComplete;
  }
}

const api = { GUIDE, LESSONS, Tutorial };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.KoshiLearning = api;
})();
