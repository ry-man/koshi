(function () {
'use strict';

const engine = typeof module !== 'undefined' && module.exports ? require('./game.js') : globalThis.KoshiGame;
const { Game, COOLDOWNS, SLIMES, FOODS, ITEMS, SWORDS, LEVELS, brickRegions, levelObjective } = engine;

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
    title: 'Power-ups & risky items',
    sections: [
      [ITEMS['smiley-cookie'].name, 'Koshi opens wide and vacuums every food item on the board toward his moving mouth. He keeps moving normally, scores each snack, then licks his lips.', 'item:smiley-cookie'],
      ...Object.entries(ITEMS).filter(([, item]) => item.counts).map(([type, item]) => [
        item.name, `A bomb-shaped clock adds ${item.counts} activation${item.counts === 1 ? '' : 's'} to an equipped Boom Helmet. It does not add time to the level clock. Without a helmet it is collected with no effect.`, `item:${type}`,
      ]),
      ...Object.entries(ITEMS).filter(([, item]) => item.seconds).map(([type, item]) => [
        item.name, `Adds ${item.seconds} seconds to the level clock. The +${item.seconds}s is printed on its face. Stopwatch bonuses add together.`, `item:${type}`,
      ]),
      [ITEMS.battery.name, 'Adds one charge to the battery stockpile. The swirling lightning bolt shows how many you hold. Touch a used spawning brick to make it produce its item again; each new touch spends one battery.', 'item:battery'],
      [ITEMS['music-box'].name, 'Puts every enemy to sleep for ten seconds. Sleeping robots cannot hurt Koshi. A scrolling musical score lasts for the whole effect; another box refreshes ten seconds. Simultaneous timed power-up banners occupy separate rows. Pause freezes the effect and animation.', 'item:music-box'],
      [ITEMS['kitty-cape'].name, 'A green cape like Koshi’s title-screen cape doubles his movement speed for ten seconds, including his current flight. Boost launches double that speed again; conveyors keep their normal pace. A translucent banner of cat heads and lightning bolts scrolls behind the arena for the whole effect. Another cape refreshes ten seconds without stacking. Pause freezes the power and animation; restart clears both. Available for custom-level placements and spawners.', 'item:kitty-cape'],
      [ITEMS.eggplant.name, 'A harmful pickup: subtracts 10 food points, but never lowers your score below zero.', 'item:eggplant'],
      [ITEMS['saw-blade'].name, 'Koshi instantly grows a ring of ears shaped into rapidly spinning saw teeth. His next non-cinder brick contact permanently turns the entire current brick shape into cinder, overriding its contact effects. It shakes, smokes, and fades into concrete, then Koshi returns to normal. Existing cinder blocks do not use the saw; extra saw pickups do not stack. Cracker Causeway introduces it.', 'item:saw-blade'],
      [ITEMS['ditto-stamp'].name, 'An orange wooden stamp follows Koshi without sparkles. His first stop after pickup captures that brick’s properties with a press onto its center. The stamp returns beside him with matching ink, then presses onto his next landing brick’s center to copy the properties before contact effects run, preserving destination size and merged shape. Cooldown, Crumbler uses, Toggle counter, spawner and warp timers start fresh. Portals never act as sources or consume the stamp; merging Warped bricks can be copied. Spring bounces do not capture a source because Koshi does not stop. Pickup while resting waits for a new landing. Midair redirects keep the captured copy. Extra stamps do not stack. A colored ripple marks the change. A held Saw Blade takes priority and leaves the stamp unused.', 'item:ditto-stamp'],
      ...Object.entries(ITEMS).filter(([, item]) => item.paintUses).map(([type, item]) => [
        item.name, `${{ pencil: 'A thin pencil-like brush with a painted tip', wide: 'A wide brush with dripping paint', roller: 'A soaked paint roller with drips' }[item.brush]} paints the next ${item.paintUses} eligible brick contact${item.paintUses === 1 ? '' : 's'} ${item.name.split(' ')[0].toLowerCase()}. This changes its cooldown to ${COOLDOWNS[item.paintKind]} seconds and makes it ready, preserving its other attributes and merged shape. Matching-color bricks do not activate the brush, spend paint, or refresh cooldowns. Goal and Cinder bricks do not spend paint. Spring and Portal contacts count; remaining against a brick does not spend more uses. Another brush replaces the held brush and its uses. The brush floats beside Koshi with its remaining count. A Saw Blade takes priority; Ditto Stamp acts before paint. Random spawns use Ditto Stamp clearance, while explicit editor placements keep their markers. Pause freezes play; restart clears paint. Available for custom levels and spawners only.`, `item:${type}`,
      ]),
      [ITEMS['magic-sunglasses'].name, 'Sparkling rainbow frames fly onto Koshi’s face for ten seconds. All bricks glow in the same cycling colors as the frames. All non-cinder bricks are selectable despite cooldowns, Toggle locks, or exhausted Crumblers; clicks do not add cooldowns, spend Crumbler uses, or change Toggle counters. Slime and other contact effects still apply. A translucent rectangle of stars and smiling cats slides behind the arena on a separate row from other active power-up banners; the power ends when it exits, then the glasses fade away. All brick cooldowns finish at expiry; Toggle locks and exhausted Crumblers resume their stored state. Another pair restarts the ten seconds; pause freezes the effect. Switchboard Supper introduces them.', 'item:magic-sunglasses'],
      ['On-screen lifetimes', 'Items and weapons can have an optional lifetime in seconds, starting when they appear. Leave it blank in the editor to keep them until the level ends. Timed objects show a lifetime bar; pause freezes expiry. Pickup does not shorten an equipped sword or power-up effect.'],
      [ITEMS['spooky-mask'].name, 'A red devil mask with yellow snake eyes, small outlined ears, horns and sharp teeth flies onto Koshi’s head for ten seconds. A translucent banner of ghosts and demon heads scrolls behind gameplay throughout the fear effect, on a separate row from other active power-up banners. Enemies look scared and shed flying sweat drops while moving away at a constant slow pace of 32 units per second. Mice do not rest and Rams do not target or charge while afraid. Wheels stay on the perimeter; Buckets pause their bomb-throwing timer. Scared enemies cannot hurt Koshi on contact or throw new bombs. Existing bombs keep animating but cannot damage him during fear. Movement bounds and shields stay unchanged. Sleep overrides fleeing. Normal movement, attacks and damage resume at expiry. Newly spawned enemies are also afraid. Another mask restarts ten seconds; pause freezes the effect, and the mask fades after expiry.', 'item:spooky-mask'],
      ['Pickup sparkle', 'Collected food, items, and swords briefly pop larger, then shrink and fade into a burst of sparkles. Food also shows the points earned.'],
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
      ['Soccer goals', 'A goal replaces a boundary brick with white netting and a silver metal frame seen from above. It cannot be selected or changed by power-ups, and cannot be absorbed. Koshi still stops against it. Kick a soccer ball through its board-facing opening to score: the ball disappears in a sparking cloud.', 'special:goal'],
      ['Soccer Ball', 'A normal black-and-white soccer ball is a neutral object, not a pickup or enemy. Bump it while moving to kick it; off-center contact changes its direction. It rolls, bounces off bricks, enemies and Barrier fences, and gradually slows to a complete stop. Swords, sleep and fear do not affect it.', 'object:soccer-ball'],
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
      ['Conveyor', 'A thin grey, finely toothed belt rotates around the brick. Landing on the arena-facing edge carries Koshi in the arrow direction until the belt ends or another brick blocks him. Warped conveyors carry him around connected corners without stopping. Select another brick to steer away while riding. The editor offers clockwise and counterclockwise belts; Level 2-1 introduces them.', 'brick:conveyor'],
      ['Portal pairs', 'Misty colored smoke marks paired portals: red, orange, yellow, green, blue, or purple. Touch one to emerge at the other brick center, heading straight into the arena perpendicular to its surface. A short lockout prevents immediate return loops. If its partner is absorbed, the entrance acts as a solid landing. Cooling, exhausted, and Toggle-disabled portals still transport. Portal is separate from the neighbor-absorbing Warped attribute.', 'special:portal'],
      ['Toggle switches', 'The switch resembles a colored pill with a white sliding button and a countdown inside. Red starts at 1, green at 2, blue at 4. Every successful brick activation counts, including the Toggle itself. Initially disabled; at zero it enables. The next successful activation disables it and resets its countdown. Clicking a disabled or cooling brick does not count. Toggle only controls selection: disabled toggles cannot be selected, but their contact surfaces still work.', 'special:toggle'],
      ['Spawning bricks', 'An item-colored icon with a thin dark outline and dark rainbow glow indicates food, a sword, a robot, a heart, or a power-up. Sword colors distinguish brown wood, green patinated bronze, silver, and gold. Touch the brick to spawn exactly one item at a random safe location; clicking alone does nothing. A held Battery can recharge a used spawner on a new touch. Wheels spawn on the inner perimeter. Restart restores spent spawners. Food lifetime is configured in the editor.', 'special:spawner'],
      ['Boost launches', 'When Koshi rests physically against a Boost brick, his wide-open mouth and eyes glow red to signal that his next successful launch travels at twice normal speed. A fireball overlays him and hits robots like a sword without spending equipped sword charges; shielded robots still require multiple hits. The boost ends when he stops or another brick is successfully selected. Failed selections do not cancel it; Spring bounces and Portal travel preserve it. Level 2-4 has no swords: use Boost to fight.', 'special:boost'],
      ['Barrier fences', 'Successfully selecting a Barrier brick extends a dark green translucent fence from its center, perpendicular to its surface. It grows until it reaches a brick or another fence. Select it again once ready to retract it. Fences block all enemies and Bucket bombs, but Koshi passes through freely. Available for custom levels; the campaign is unchanged.', 'special:barrier'],
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
      ['Robo Ball', 'An orange robot basketball with dark grey seams, beady red eyes and a rectangular grey tooth grate. It travels in straight lines at 120 board units per second, bouncing off bricks, fences and other enemies. On defeat it shrivels, pops its eyes into the air and fades. Sleep and fear affect it like other robots. Available for custom levels.', 'enemy:ball'],
      ['Robo Jackolantern', 'An orange pumpkin robot with grey mechanical eyes and an antenna instead of a stem. It wanders slowly, pauses for a half-second warning, and stomps every four seconds. A square fire ring expands from the stomp location at 120 board units per second. Touching it costs one heart. Bricks and barriers extinguish only the blocked portions; the rest keeps growing. Fear prevents stomps and fire damage; sleep freezes it. On defeat its yellow nose and mouth dim grey, its antenna snaps, and the pumpkin bursts into pieces. Available for custom levels.', 'enemy:jackolantern'],
      ['Robo Snake', 'A long grey robot follows the inner perimeter at the same pace as a Wheel. It has four segments: a yellow-eyed head with black slit pupils and a flicking forked tongue emerging beneath its shell, then spiked panels with a grey plus sign, thin oval buttons and unlettered red circular buttons. Large symmetric grey shapes and red stripes decorate the segments. Only its head can be attacked with a sword or Boost; body contacts hurt Koshi even while the snake is asleep or afraid, respecting normal damage invulnerability. Fear makes it flee slowly along the border; sleep stops it. On defeat its segments fall apart and fade, and its tongue spins away. Available for custom levels.', 'enemy:snake'],
      ['Robo Goalie', 'An egg-shaped robot with three antenna hairs, a long metal nose, and a colorful striped soccer jersey with badges. He spawns at a normal enemy location or custom marker, then moves slowly toward the nearest Goal brick to guard it. If his goal is removed, he travels to the nearest remaining one. Once there, he moves across its mouth to intercept incoming soccer balls. He gently sways around his defensive target, proactively tracking nearby balls and anticipating their rolling motion; incoming scoring threats take priority. Overlapping goalies draw with the lowest on screen in front. He cannot hurt Koshi, but swords and Boost can destroy him; shields work normally. Music Box freezes him, and Spooky Mask makes him retreat along the goal mouth rather than leaving it. On defeat his jersey falls, revealing a plain mechanical shell; he blushes pink, then explodes. Without any Goal brick he immediately plays that defeat animation without awarding points. Available in custom levels and enemy spawners; campaign levels are unchanged.', 'enemy:goalie'],
      ['Damage & defeats', 'Unarmed contact with hostile robots costs one heart; Robo Goalie is harmless. After damage, Koshi looks upset and blinks red for exactly one second of protection from robots and spikes. When his normal face and colors return he can take damage again. Further contacts do not extend protection; pause freezes it. Staying overlapped does not repeatedly hurt, but separating and colliding again can. At zero hearts the level ends. Collect a sword, then approach a robot to strike automatically.'],
      ...Object.entries(SWORDS).map(([type, sword]) => [
        sword.name,
        type === 'gold' ? `${sword.seconds} seconds of unlimited attacks from pickup; pause freezes the timer.` : `${sword.uses} attack${sword.uses === 1 ? '' : 's'} before breaking. Shield hits also spend an attack. Works on every enemy type.`,
        `weapon:${type}`,
      ]),
      ['One sword at a time', 'Every collected sword replaces your current sword and resets its attack count or timer. A weaker sword can reduce your remaining attacks. Uncollected swords remain until their optional on-screen lifetime expires, or until the level ends.'],
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
      ['Campaign win conditions', 'The 34 campaign levels introduce one concept each. Some require food points, enemy points, soccer goals, combined targets, or survival until time runs out. The briefing and gold HUD counters show the targets; combined progress follows the least-complete objective.'],
      ['Custom win conditions', 'Choose any combination of food, enemy and soccer-goal targets, or survive until the timer reaches zero. Every level starts with an objectives popup and a Start button. Required score counters show / target in gold; survival highlights the countdown in gold. All required scores must be reached.'],
      ['Boom Helmet activation limit', 'An optional level difficulty limit equips a round blue helmet with a bomb fuse when you press Start. It falls onto Koshi’s head and shows remaining activations in black inside a white circle. Each successful brick selection spends one, including redirections and sunglasses selections. Failed clicks and physical brick contacts spend nothing. At zero it explodes immediately and Koshi dies, even while invulnerable. Boom Time pickups add charges before that happens. Pause freezes the helmet; restart restores the limit. Survival and combined score objectives can both use a helmet.', 'special:boom-helmet'],
      ['Enemy shields & score', 'Blue shields take 4 hits, green 3, red 2, and unshielded enemies 1. Hits downgrade blue to green to red to none. After a hit, enemies blink between red shades and are protected for the same one second as Koshi. Destroying an enemy awards its original hit count in enemy points; partial hits earn nothing.'],
      ...LEVELS.map(level => [
        `Level ${level.number}`,
        `${levelObjective(level)}.`,
      ]),
      ['Losing & retrying', 'Running out of time without meeting score targets, losing all hearts, or leaving the board ends an attempt. Reaching the time limit alive wins a survival level. Restart restores bricks, hearts, objects, and timers. Boss objectives are not implemented yet.'],
      ['Make your own', 'The level editor creates portable levels with timed food, robots, weapons, power-ups, and brick attributes. Playtest links work without a server.'],
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
  { id: 'ball', title: 'Robo Ball', instruction: 'Collect a sword and intercept the bouncing basketball robot. It rebounds off walls and other enemies; defeat it to see it shrivel and pop its eyes into the air.' },
  { id: 'jackolantern', title: 'Robo Jackolantern', instruction: 'Collect a sword and intercept the pumpkin robot. Watch its half-second stomp warning: square fire waves grow until blocked by bricks or fences.' },
  { id: 'snake', title: 'Robo Snake', instruction: 'Collect a sword and intercept the snake’s head at the inner perimeter. Avoid its three spiked body panels: they cannot be attacked and remain dangerous even during sleep or fear.' },
  { id: 'soccer', title: 'Soccer balls & goals', instruction: 'Select the outlined brick to bump the soccer ball off-center and kick it into the neighboring silver goal. Balls are not collected; watch the Goals counter and scoring spark cloud.' },
  { id: 'healing', title: 'Heal with food', instruction: 'You have two hearts and 9 food. Collect the strawberry to reach 10, then head back along your route to collect the healing heart.' },
  { id: 'warnings', title: 'Spawn warnings', instruction: 'Wait for the skull, swirl, and star at 2 seconds. They reveal objects at 3 seconds. Then aim at the outlined brick to collect the snack.' },
  { id: 'pause', title: 'Pause & resume', instruction: 'Press Pause (or Escape), then Resume. The clock, movement, previews, and all brick timers freeze while paused.' },
  { id: 'objectives', title: 'Two goals to win', instruction: 'Aim at the outlined brick to collect a sword, one food, and defeat one robot. BOTH goals are required to complete this practice challenge.' },
  { id: 'portal', title: 'Portal pairs', instruction: 'Aim at the outlined purple Portal. Koshi emerges from its partner at the center, heading straight into the arena. Matching smoke colors identify pairs.' },
  { id: 'toggle', title: 'Toggle switches', instruction: 'The outlined red Toggle starts at 1. Successfully activate another brick to reach zero and enable it. The next successful activation, including the Toggle itself, disables it again.' },
  { id: 'spawner', title: 'Spawning bricks', instruction: 'Aim at the outlined spawning brick and physically touch it. Its rainbow-glowing heart outline turns dark grey as one healing heart appears at a random safe location. Merely clicking is not enough.' },
  { id: 'boost', title: 'Boost launches', instruction: 'Koshi rests against the outlined Boost. Select a brick across the board to launch at double speed in a fireball, defeating the robot on the way. Another successful selection ends the boost.' },
  { id: 'barrier', title: 'Barrier fences', instruction: 'Select the outlined fence brick to extend its barrier. Koshi passes through, but enemies and bombs cannot. Select it again after its cooldown to retract the fence.' },
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
    if (id === 'soccer') {
      const goal = game.bricks.filter(brick => regions.get(brick.id).edge === 'right' && brick.id !== this.target.id)
        .sort((a, b) => Math.abs(a.y + a.h / 2 - start.y) - Math.abs(b.y + b.h / 2 - start.y))[0];
      goal.kind = 'goal';
      game.cat.x = goal.x - 200;
      const difference = goal.y + goal.h / 2 - game.cat.y;
      const reach = game.cat.radius + 16;
      let low = 0, high = reach - .01;
      for (let i = 0; i < 40; i++) {
        const offset = (low + high) / 2;
        if (offset / Math.sqrt(reach * reach - offset * offset) < (Math.abs(difference) - offset) / 110) low = offset;
        else high = offset;
      }
      game.soccerBalls.push(game.createSoccerBall({ x: goal.x - 110, y: game.cat.y + Math.sign(difference) * (low + high) / 2 }));
      this.origin = { x: game.cat.x, y: game.cat.y };
      game.level.goal = 0; game.level.goalsGoal = 1;
    }
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
    if (id === 'barrier') this.target.barrier = true;
    if (id === 'boost') {
      this.target.boost = true;
      game.cat.x = this.target.x - game.cat.radius;
      game.robots.push({ ...along(.5), type: 'mouse', radius: 19, phase: 0, age: 4.5, touching: false });
    }
    if (['mouse', 'wheel', 'ram', 'bucket', 'ball', 'jackolantern', 'snake', 'objectives'].includes(id)) {
      addSword();
      if (['wheel', 'snake'].includes(id)) {
        const bounds = game.bounds();
        const enemy = game.createCustomSpawn({ kind: 'enemy', type: id, x: 1, y: (start.y - bounds.top) / (bounds.bottom - bounds.top) })[0];
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
      } else if (id === 'ball') {
        game.robots.push({ ...along(.8), type: 'ball', radius: 19, phase: Math.PI,
          age: 0, touching: false });
      } else if (id === 'jackolantern') {
        const enemy = { ...along(.8), type: 'jackolantern', radius: 19, phase: Math.PI,
          age: 0, touching: false };
        game.initializeJackolantern(enemy); game.robots.push(enemy);
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
      ball: game.enemies >= 1,
      jackolantern: game.enemies >= 1,
      snake: game.enemies >= 1,
      soccer: game.goals >= 1,
      healing: game.hearts === 3 && game.score >= 10,
      warnings: this.previewSeen && game.score > 0,
      pause: this.paused && game.state === 'playing',
      objectives: game.state === 'won',
      portal: game.portalTrips > 0,
      toggle: this.target.toggleRemaining === 0,
      spawner: this.target.spawned,
      boost: game.enemies >= 1 && this.actions > 0,
      barrier: game.barriers.some(fence => fence.id === this.target.id && fence.length > 20),
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
