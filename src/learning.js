(function () {
'use strict';

const engine = typeof module !== 'undefined' && module.exports ? require('./game.js') : globalThis.KoshiGame;
const { Game, COOLDOWNS, SLIMES, FOODS, SWORDS, LEVELS, brickRegions, levelObjective } = engine;

const GUIDE = [
  {
    title: 'Movement & controls',
    sections: [
      ['Aim at bricks, not objects', 'Click or tap a boundary brick. Koshi travels toward that exact spot, collecting anything along his path. He stops at the first solid brick he touches. Pick another brick to leave it.'],
      ['Change course', 'Select a different available brick while Koshi is moving to redirect him immediately. A blocked or invalid selection does not use a cooldown or a Crumbler selection.'],
      ['Keyboard & pause', 'Tab to a brick and press Enter or Space to aim at its center. Use Pause in the toolbar, or Escape or Space outside a control, to pause/resume. Pause freezes cooldowns, slime holds, weapons, previews, and Warped timers. In the installed app, intercepted Back gestures are ignored rather than pausing. Switching away pauses automatically; resume explicitly.'],
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
      ['Cinder blocks', 'Grey concrete blocks with two recessed holes are permanently solid. Koshi stops when he runs into one, but you cannot click it to aim. They have no modifiers or contact effects, do not advance Toggle counters, and cannot be absorbed by Warped bricks.', 'special:cinder'],
    ],
  },
  {
    title: 'Crumblers & Warped',
    sections: [
      ['Crumblers / C counter', 'Jagged Crumblers have limited selections. Each successful selection deepens their chips and cracks and reduces C by one. At C:0 the brick stays solid, but cannot be selected until restart. Its cooldown animation stops.', 'brick:crumbler'],
      ['Warped / W counter', 'Swirl-patterned Warped bricks absorb one neighboring brick or entire group each successful selection, including around corners. The enlarged surface acts as one brick with the selected owner’s cooldown and attributes. The first absorption starts W; further selections do not restart it.', 'brick:warped'],
      ['Restoration & combinations', 'When W expires, absorbed bricks regain their own attributes and remaining uses. A combined Warped Crumbler that reaches C:0 freezes enlarged with W:X until restart or absorption by another Warped owner.', 'brick:warped-crumbler'],
      ['Larger starting bricks', 'Double and triple bricks appear in the campaign. Aim anywhere on their surface: the whole group shares one owner’s cooldown, selection count, and attributes. In the editor, select adjacent bricks and choose an owner before Combine. Groups can cross corners; Cinder combines only with Cinder. Split retains current attributes. Warped timer restoration and restart preserve saved starting groups. A Portal group counts as one endpoint.'],
    ],
  },
  {
    title: 'Brick surfaces',
    sections: [
      ...Object.entries(SLIMES).map(([color, { duration }]) => [
        `${color[0].toUpperCase() + color.slice(1)} slime / ${duration} second${duration === 1 ? '' : 's'}`,
        'Drippy icing covers only the edge facing the play area. Touching it freezes Koshi. A matching-color ring drains with the remaining hold; FREE! signals release. Select a brick to move again.',
        `slime:${color}`,
      ]),
      ['Springs', 'A wooden platform with grain and a dark outline covers only the arena-facing edge. It reflects Koshi immediately instead of stopping him. Little springs underneath are hidden at rest and appear only while the platform compresses and rebounds on contact. Redirect him mid-bounce to take control.', 'brick:springs'],
      ['Spikes', 'Many white triangular spikes protrude toward the arena. Touching them costs one heart and stops Koshi. Resting against them does not cause more damage; leaving and touching them again does. Swords do not protect against spikes. Level 1-8 introduces them.', 'brick:spikes'],
      ['Conveyor', 'A thin grey, finely toothed belt rotates around the brick. Landing on the arena-facing edge carries Koshi in the arrow direction until the belt ends or another brick blocks him. Warped conveyors carry him around connected corners without stopping. Select another brick to steer away while riding. The editor offers clockwise and counterclockwise belts; Level 1-11 introduces them.', 'brick:conveyor'],
      ['Portal pairs', 'Misty colored smoke marks paired portals: red, orange, yellow, green, blue, or purple. Touch one to emerge at the other brick center, heading straight into the arena perpendicular to its surface. A short lockout prevents immediate return loops. If its partner is absorbed, the entrance acts as a solid landing. Cooling, exhausted, and Toggle-disabled portals still transport. Portal is separate from the neighbor-absorbing Warped attribute.', 'special:portal'],
      ['Toggle switches', 'The switch resembles a colored pill with a white sliding button and a countdown inside. Red starts at 1, green at 2, blue at 4. Every successful brick activation counts, including the Toggle itself. Initially disabled; at zero it enables. The next successful activation disables it and resets its countdown. Clicking a disabled or cooling brick does not count. Toggle only controls selection: disabled toggles cannot be selected, but their contact surfaces still work.', 'special:toggle'],
      ['Spawning bricks', 'An item-colored icon with a thin dark outline and dark rainbow glow indicates a food, sword, robot, or heart. Sword colors distinguish brown wood, green patinated bronze, silver, and gold. Touch the brick to spawn exactly one of that item at a random safe location; clicking alone does nothing. Wheels spawn on the inner perimeter. The icon turns dark grey without a glow when used; restart restores it. Food lifetime is configured in the editor.', 'special:spawner'],
      ['Boost launches', 'When Koshi rests physically against a Boost brick, his wide-open mouth and eyes glow red to signal that his next successful launch travels at twice normal speed. A fireball overlays him and hits robots like a sword without spending equipped sword charges; shielded robots still require multiple hits. The boost ends when he stops or another brick is successfully selected. Failed selections do not cancel it; Spring bounces and Portal travel preserve it. Level 1-14 has no swords: use Boost to fight.', 'special:boost'],
      ['Contact is not a selection', 'Slime, Springs, Spikes, Conveyor, Portal, Spawning, and Boost work even on cooling, exhausted, or Toggle-disabled bricks. Contact does not consume cooldowns or C uses. These surfaces replace one another, but can combine with Toggle, Crumbler, and Warped attributes.'],
    ],
  },
  {
    title: 'Food & healing',
    sections: [
      ...Object.entries(FOODS).map(([type, food]) => [`${food.icon} ${food.name} / +${food.value}`, `Adds ${food.value} food point${food.value === 1 ? '' : 's'} when touched. Food may appear alone, in lines, in circles, or scattered around the arena.`, `food:${type}`]),
      ['Food expires', 'The small bar above food shows its remaining lifetime. Expired snacks disappear; pause freezes their lifetime.'],
      ['Hearts', 'Koshi starts with three hearts. From campaign Level 1-4 onward, filling the Next: earned/cost food meter creates a pink cloud, then a healing heart one second later. The level sets its heart cost so all available food generates at most five hearts. Touch a heart to restore one, capped at three. Custom levels can change or disable this cost.', 'heart'],
    ],
  },
  {
    title: 'Robots & swords',
    sections: [
      ['Robo Mouse', 'Mice patrol at 75 board units per second in curved paths and periodically stop to bare their two large front teeth. They do not chase or shoot.', 'enemy:mouse'],
      ['Robo Wheel', 'Wheels roll along the inner perimeter. Intercept them near a wall while armed.', 'enemy:wheel'],
      ['Robo Ram', 'Sleek metal robots with pale curling horns, tiny nostrils, and a red eye-and-mouth display wander slowly, then pause as their eyes sparkle and aim at Koshi. They line up and charge quickly in a straight line. Dodge the rush or catch it with a sword. A ram ricochets off bricks and loses some speed with each bounce.', 'enemy:ram'],
      ['Robo Bucket', 'Buckets wander slowly with waving arms and randomly shoot blue bombs from their mouths. Bombs bounce off bricks and explode after three seconds; only their growing red flame circles can hurt Koshi. Defeat a bucket to squish it flat and pop its bombs.', 'enemy:bucket'],
      ['Damage & defeats', 'Unarmed contact costs one heart. After damage, Koshi looks upset and blinks red for exactly one second of protection from robots and spikes. When his normal face and colors return he can take damage again. Further contacts do not extend protection; pause freezes it. Staying overlapped does not repeatedly hurt, but separating and colliding again can. At zero hearts the level ends. Collect a sword, then approach a robot to strike automatically.'],
      ...Object.entries(SWORDS).map(([type, sword]) => [
        sword.name,
        type === 'gold' ? `${sword.seconds} seconds of unlimited attacks from pickup; pause freezes the timer.` : `${sword.uses} attack${sword.uses === 1 ? '' : 's'} before breaking. Shield hits also spend an attack. Works on every enemy type.`,
        `weapon:${type}`,
      ]),
      ['One sword at a time', 'Every collected sword replaces your current sword and resets its attack count or timer. A weaker sword can reduce your remaining attacks. Uncollected swords remain on the board.'],
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
      ['Campaign win conditions', 'The 19 campaign levels introduce one concept each. Some require food points, some enemy points, some BOTH, and others survival until time runs out. The briefing and gold HUD counters show the targets; combined progress follows the less-complete objective.'],
      ['Custom win conditions', 'Choose food and/or enemy targets, or survive until the timer reaches zero. The briefing states what you must do. Required score counters show / target in gold; survival highlights the countdown in gold.'],
      ['Enemy shields & score', 'Blue shields take 4 hits, green 3, red 2, and unshielded enemies 1. Hits downgrade blue to green to red to none. After a hit, enemies blink between red shades and are protected for the same one second as Koshi. Destroying an enemy awards its original hit count in enemy points; partial hits earn nothing.'],
      ...LEVELS.map(level => [
        `Level ${level.id}`,
        `${levelObjective(level)}.`,
      ]),
      ['Losing & retrying', 'Running out of time without meeting score targets, losing all hearts, or leaving the board ends an attempt. Reaching the time limit alive wins a survival level. Restart restores bricks, hearts, objects, and timers. Boss objectives are not implemented yet.'],
      ['Make your own', 'The level editor creates portable levels with timed food, robots, weapons, and brick attributes. Playtest links work without a server.'],
    ],
  },
];

const LESSONS = [
  { id: 'aim', title: 'Aim & stop', instruction: 'Tap the outlined brick. Koshi travels to it and stops. Objects are collected along the way, not by tapping them.' },
  { id: 'redirect', title: 'Redirect in flight', instruction: 'Tap any brick, then quickly tap a DIFFERENT brick before Koshi stops. You can change course mid-flight.' },
  { id: 'food', title: 'Collect food', instruction: 'Tap the outlined brick to travel through all three strawberries. Watch the food counter rise.' },
  { id: 'cooldown', title: 'Brick recharge', instruction: `Use the outlined red fast brick, then wait for its ${COOLDOWNS.fast}-second full-surface refill. Green normal bricks take ${COOLDOWNS.normal} seconds and blue slow bricks take ${COOLDOWNS.slow} seconds. Other ready bricks remain available while one recharges.` },
  { id: 'crumbler', title: 'Crumblers', instruction: 'Use the outlined Crumbler twice: go to it, go to the opposite brick, then return after it recharges. C:0 is solid but permanently unselectable.' },
  { id: 'warped', title: 'Warped bricks', instruction: 'Select the outlined Warped brick. Watch it absorb a neighbor, then wait 8 seconds for the group to restore.' },
  ...['red', 'green', 'blue'].map(color => ({
    id: `slime-${color}`, title: `${color[0].toUpperCase() + color.slice(1)} slime`,
    instruction: `Touch the outlined slime brick. Steering locks for ${SLIMES[color].duration} second${color === 'red' ? '' : 's'} while the ring drains. Wait for FREE!, then pick a brick to leave.`,
  })),
  { id: 'springs', title: 'Springs', instruction: 'Aim at the outlined brown Spring. Koshi bounces instead of stopping. Try redirecting him during the bounce.' },
  { id: 'mouse', title: 'Swords & Robo Mouse', instruction: 'Choose a sword below, then aim at the outlined brick. Pick up the sword before reaching the mouse; attacks are automatic. Try each sword with Retry.' },
  { id: 'wheel', title: 'Robo Wheel', instruction: 'Aim at the outlined brick to collect a sword and intercept a wheel at the inner perimeter. Unlike a mouse, it keeps rolling along the wall.' },
  { id: 'ram', title: 'Robo Ram', instruction: 'Collect the sword, then watch the ram pause as its eyes sparkle and it aims at Koshi. It lines up before a fast straight charge. Avoid the rush or intercept it while armed; bricks make it ricochet and slow down.' },
  { id: 'bucket', title: 'Robo Bucket', instruction: 'Collect a sword and intercept the bucket. Its blue bombs bounce harmlessly for three seconds before their expanding red flames can hurt you.' },
  { id: 'healing', title: 'Heal with food', instruction: 'You have two hearts and 9 food. Collect the strawberry to reach 10, then head back along your route to collect the healing heart.' },
  { id: 'warnings', title: 'Spawn warnings', instruction: 'Wait for the skull, swirl, and star at 2 seconds. They reveal objects at 3 seconds. Then aim at the outlined brick to collect the snack.' },
  { id: 'pause', title: 'Pause & resume', instruction: 'Press Pause (or Escape), then Resume. The clock, movement, previews, and all brick timers freeze while paused.' },
  { id: 'objectives', title: 'Two goals to win', instruction: 'Aim at the outlined brick to collect a sword, one food, and defeat one robot. BOTH goals are required to complete this practice challenge.' },
  { id: 'portal', title: 'Portal pairs', instruction: 'Aim at the outlined purple Portal. Koshi emerges from its partner at the center, heading straight into the arena. Matching smoke colors identify pairs.' },
  { id: 'toggle', title: 'Toggle switches', instruction: 'The outlined red Toggle starts at 1. Successfully activate another brick to reach zero and enable it. The next successful activation, including the Toggle itself, disables it again.' },
  { id: 'spawner', title: 'Spawning bricks', instruction: 'Aim at the outlined spawning brick and physically touch it. Its rainbow-glowing heart outline turns dark grey as one healing heart appears at a random safe location. Merely clicking is not enough.' },
  { id: 'boost', title: 'Boost launches', instruction: 'Koshi rests against the outlined Boost. Select a brick across the board to launch at double speed in a fireball, defeating the robot on the way. Another successful selection ends the boost.' },
  { id: 'spikes', title: 'Spikes', instruction: 'Touch the outlined white Spikes. You lose one heart and stop, even with a sword. Wait against them: they cannot hurt again until you leave and touch them again. Then select another brick to leave.' },
  { id: 'conveyor', title: 'Conveyor belts', instruction: 'Touch the outlined grey Conveyor and watch Koshi ride along its arrows. Then select another brick to move away; you can redirect even while riding. Belts can run clockwise or counterclockwise; larger Warped belts can carry him around corners.' },
  { id: 'cinder', title: 'Cinder blocks', instruction: 'Koshi starts stopped against a grey Cinder block. It is solid but cannot be selected or absorbed, and has no special effects. Tap the outlined brick across the board to leave the Cinder and land safely.' },
  { id: 'larger', title: 'Larger bricks', instruction: 'Aim anywhere on the outlined double brick. Both segments share one cooldown and the owner’s attributes; they are not separate targets. Land on it and watch the entire surface recharge together.' },
  { id: 'warped-crumbler', title: 'Warped Crumblers', instruction: 'Select the outlined Warped Crumbler once. It absorbs a neighbor but uses its last selection. C:0 and W:X mean it stays solid and enlarged even after its 8-second timer; only restart or absorption can restore it.' },
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
    this.rideSeen = false;
    this.currentComplete = false;
    const level = { version: 1, id: `Practice ${index + 1}`, duration: 3600, goal: 1000, heartCost: 10, brickSet: 1, events: [] };
    const game = new Game(() => .5, { ...options, customLevel: level });
    // Only the objectives lesson uses normal victory rules.
    game.level.duration = Infinity;
    game.level.goal = this.lesson.id === 'objectives' ? 1 : Infinity;
    if (this.lesson.id === 'objectives') game.level.killGoal = 1;
    const regions = brickRegions(game.bricks, game.width, game.height);
    this.target = game.bricks.filter(brick => regions.get(brick.id).edge === 'right')
      .sort((a, b) => Math.abs(a.y + a.h / 2 - game.height / 2) - Math.abs(b.y + b.h / 2 - game.height / 2))[0];
    if (this.lesson.id === 'larger') {
      const targetId = this.target.id, region = regions.get(targetId);
      const neighbor = game.bricks.find(brick => {
        const other = regions.get(brick.id);
        return other.edge === region.edge && other.start === region.end;
      });
      game.level.brickGroups = [{ owner: targetId, members: [targetId, neighbor.id] }];
      game.reset();
      this.target = game.bricks[targetId];
    }
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
    if (id === 'warped-crumbler') {
      this.target.warped = 8;
      this.target.crumbler = 1;
      this.target.usesLeft = 1;
    }
    if (id.startsWith('slime-')) { this.target.slimed = true; this.target.slimeColor = id.slice(6); }
    if (id === 'springs') this.target.springs = true;
    if (id === 'spikes') { this.target.spikes = true; addSword(); }
    if (id === 'conveyor') this.target.conveyor = true;
    if (id === 'cinder') {
      this.target.kind = 'cinder';
      game.cat.x = this.target.x - game.cat.radius;
      this.origin = { x: game.cat.x, y: game.cat.y };
      this.target = game.bricks.filter(brick => regions.get(brick.id).edge === 'left')
        .sort((a, b) => Math.abs(a.y + a.h / 2 - start.y) - Math.abs(b.y + b.h / 2 - start.y))[0];
      this.target.kind = 'fast';
    }
    if (id === 'portal') {
      this.target.portal = 'purple';
      const partner = game.bricks.filter(brick => regions.get(brick.id).edge === 'left')
        .sort((a, b) => Math.abs(a.y + a.h / 2 - start.y) - Math.abs(b.y + b.h / 2 - start.y))[0];
      partner.portal = 'purple';
    }
    if (id === 'toggle') { this.target.toggle = 1; this.target.toggleRemaining = 1; }
    if (id === 'spawner') this.target.spawner = { kind: 'heart', type: 'heart' };
    if (id === 'boost') {
      this.target.boost = true;
      game.cat.x = this.target.x - game.cat.radius;
      game.robots.push({ ...along(.5), type: 'mouse', radius: 19, phase: 0, age: 4.5, touching: false });
    }
    if (['mouse', 'wheel', 'ram', 'bucket', 'objectives'].includes(id)) {
      addSword();
      if (id === 'wheel') {
        const bounds = game.bounds();
        const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'wheel', x: 1, y: (start.y - bounds.top) / (bounds.bottom - bounds.top) })[0];
        // Start upstream so the moving wheel meets the launch path near arrival.
        enemy.distance -= 95 * (bounds.right - start.x) / engine.SPEED;
        game.placeWheel(enemy);
        game.robots.push(enemy);
      } else if (id === 'ram') {
        const enemy = game.createCustomSpawn({ kind: 'enemy', type: 'ram', x: .72, y: .5 })[0];
        game.robots.push(enemy);
      } else if (id === 'bucket') {
        const enemy = { ...along(.8), type: 'bucket', radius: 19, phase: 0, age: 0, touching: false };
        game.initializeBucket(enemy);
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
    if (game.conveyorRide?.id === this.target.id) this.rideSeen = true;
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
      ram: game.enemies >= 1,
      bucket: game.enemies >= 1,
      healing: game.hearts === 3 && game.score >= 10,
      warnings: this.previewSeen && game.score > 0,
      pause: this.paused && game.state === 'playing',
      objectives: game.state === 'won',
      portal: game.portalTrips > 0,
      toggle: this.target.toggleRemaining === 0,
      spawner: this.target.spawned,
      boost: game.enemies >= 1 && this.actions > 0,
      spikes: game.hearts === 2 && this.actions > 0 && !game.cat.vx && !game.cat.vy,
      conveyor: this.rideSeen && this.actions >= 2 && this.lastBrick !== this.target.id,
      cinder: this.actions > 0 && !game.cat.vx && !game.cat.vy && Math.hypot(game.cat.x - this.origin.x, game.cat.y - this.origin.y) > 10,
      larger: this.target.readyAt > 0 && !game.cat.vx && !game.cat.vy,
      'warped-crumbler': this.warpSeen && this.target.usesLeft === 0 && game.elapsed >= this.target.warpUntil,
    }[id] ?? (id.startsWith('slime-') && this.held && game.stuckUntil === 0);
    if (success) { this.completed.add(id); this.currentComplete = true; }
    return this.currentComplete;
  }
}

const api = { GUIDE, LESSONS, Tutorial };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.KoshiLearning = api;
})();
