(function () {
'use strict';

const engine = typeof module !== 'undefined' && module.exports ? require('./game.js') : globalThis.KoshiGame;
const { Game, COOLDOWNS, SLIMES, FOODS, ITEMS, OBJECTS, WEAPONS, LEVELS, SPEED, COW_SPEED, brickRegions, levelObjective } = engine;

const GUIDE = [
  {
    title: 'Movement & controls',
    practice: 'aim',
    sections: [
      ['Aim at bricks, not objects', 'Click or tap a boundary brick. Koshi travels toward that exact spot, collecting anything along his path. He stops at the first solid brick he touches. Pick another brick to leave it.'],
      ['Change course', 'Select a different available brick while Koshi is moving to redirect him immediately. A blocked or invalid selection does not use a cooldown or a Crumbler selection.'],
      ['Keyboard & pause', 'Tab to a brick and press Enter or Space to aim at its center. Use Pause in the toolbar, or Escape or Space outside a control, to pause/resume. Pause freezes cooldowns, slime holds, weapons, previews, and Warped timers. In the installed app, intercepted Back gestures are ignored rather than pausing. Switching away pauses automatically; resume explicitly.'],
      ['A fresh attempt', 'Restart resets the current level. Menu returns to the title screen. Choose a level starts that level; Next level advances after a win.'],
    ],
  },
  {
    title: 'Power-ups & risky items',
    practice: 'cookie',
    sections: [
      [ITEMS['smiley-cookie'].name, 'Koshi opens wide and vacuums every food item on the board toward his moving mouth. He keeps moving normally, scores each snack, then licks his lips.', 'item:smiley-cookie'],
      ...['red', 'green', 'blue'].map((color, index) => {
        const type = `cat-shield-${color}`, hits = index + 1;
        return [ITEMS[type].name, `Absorbs ${hits} hit${hits === 1 ? '' : 's'} before Koshi loses a heart. Each hit weakens the shield and changes it to the next color; another Cat Shield replaces the current one, even if it is weaker.`, `item:${type}`];
      }),
      [ITEMS.key.name, 'Collect keys from pickups or defeated key-carrying enemies. The Keys counter shows your stock. Touch a treasure chest with enough keys to spend the required number and open it.', 'item:key'],
      [ITEMS['treasure-chest'].name, 'A chest is a locked Cat Block source, not a regular pickup. Collect the required keys first, then touch the chest to open it. A chest without enough keys stays in place.', 'item:treasure-chest'],
      [ITEMS['cat-block'].name, 'Collect the Cat Block from its pickup, a marked carrier, or an unlocked chest. In campaign play it is kept on a win; leaving or losing forfeits an unbanked block. Each level can award it only once per profile.', 'item:cat-block'],
      ...Object.entries(ITEMS).filter(([, item]) => item.counts).map(([type, item]) => [
        item.name, `A bomb-shaped clock adds ${item.counts} activation${item.counts === 1 ? '' : 's'} to an equipped Boom Helmet. It does not add time to the level clock. Without a helmet it is collected with no effect.`, `item:${type}`,
      ]),
      ...Object.entries(ITEMS).filter(([, item]) => item.seconds).map(([type, item]) => [
        item.name, `Adds ${item.seconds} seconds to the level clock. The +${item.seconds}s is printed on its face. Stopwatch bonuses add together.`, `item:${type}`,
      ]),
      [ITEMS.battery.name, 'Adds one charge to the battery stockpile. The swirling lightning bolt shows how many you hold. Touch a used spawning brick to make it produce its item again; each new touch spends one battery.', 'item:battery'],
      [ITEMS.anvil.name, 'A shaded black iron anvil with grey and blue highlights and a thin bright outline fully restores your held weapon: original strikes for swords and hammers, original shots for Rope Darts, or a fresh full timer for axes. It does not stack extra strikes, shots or time, replace the weapon, or affect the level clock. Collected with no effect when unarmed.', 'item:anvil'],
      [ITEMS['music-box'].name, 'Puts enemies to sleep for ten seconds. Most sleeping enemies cannot hurt Koshi, but Robo Snake’s spiked body remains dangerous. A scrolling musical score lasts for the whole effect; another box refreshes ten seconds. Simultaneous timed power-up banners occupy separate rows. Pause freezes the effect and animation.', 'item:music-box'],
      [ITEMS['kitty-cape'].name, 'A green cape like Koshi’s title-screen cape doubles his movement speed for ten seconds, including his current flight. Boost launches double that speed again; conveyors keep their normal pace. A translucent banner of cat heads and lightning bolts scrolls behind the arena for the whole effect. Another cape refreshes ten seconds without stacking. Pause freezes the power and animation; restart clears both. Available for custom-level placements and spawners.', 'item:kitty-cape'],
      [ITEMS.eggplant.name, 'A harmful pickup: subtracts 10 food points, but never lowers your score below zero.', 'item:eggplant'],
      [ITEMS['saw-blade'].name, 'Koshi instantly grows a ring of ears shaped into rapidly spinning saw teeth. His next brick contact other than Cinder or Goal permanently turns the entire current brick shape into Cinder, overriding its contact effects. It shakes, smokes, and fades into concrete, then Koshi returns to normal. Existing Cinder and Goal bricks do not use the saw; extra saw pickups do not stack. Cracker Causeway introduces it.', 'item:saw-blade'],
      [ITEMS['ditto-stamp'].name, 'An orange wooden stamp follows Koshi without sparkles. His first stop after pickup captures that brick’s properties with a press onto its center. The stamp returns beside him with matching ink, then presses onto his next landing brick’s center to copy the properties before contact effects run, preserving destination size and merged shape. Cooldown, Crumbler uses, Toggle counter, spawner and warp timers start fresh. Portals never act as sources or consume the stamp; merging Warped bricks can be copied. Spring bounces do not capture a source because Koshi does not stop. Pickup while resting waits for a new landing. Midair redirects keep the captured copy. Extra stamps do not stack. A colored ripple marks the change. A held Saw Blade takes priority and leaves the stamp unused.', 'item:ditto-stamp'],
      ...Object.entries(ITEMS).filter(([, item]) => item.paintUses).map(([type, item]) => [
        item.name, `${{ pencil: 'A thin pencil-like brush with a painted tip', wide: 'A wide brush with dripping paint', roller: 'A soaked paint roller with drips' }[item.brush]} paints the next ${item.paintUses} eligible brick contact${item.paintUses === 1 ? '' : 's'} ${item.name.split(' ')[0].toLowerCase()}. This changes its cooldown to ${COOLDOWNS[item.paintKind]} seconds and makes it ready, preserving its other attributes and merged shape. Matching-color bricks do not activate the brush, spend paint, or refresh cooldowns. Goal and Cinder bricks do not spend paint. Spring and Portal contacts count; remaining against a brick does not spend more uses. Another brush replaces the held brush and its uses. The brush floats beside Koshi with its remaining count. A Saw Blade takes priority; Ditto Stamp acts before paint. Random spawns use Ditto Stamp clearance, while explicit editor placements keep their markers. Pause freezes play; restart clears paint. Available for custom levels and spawners only.`, `item:${type}`,
      ]),
      [ITEMS['magic-sunglasses'].name, 'Sparkling rainbow frames fly onto Koshi’s face for ten seconds. All bricks glow in the same cycling colors as the frames. Every selectable brick can be selected despite cooldowns, Toggle locks, or exhausted Crumblers; Cinder and Goal remain unselectable. Clicks do not add cooldowns, spend Crumbler uses, or change Toggle counters. Slime and other contact effects still apply. A translucent rectangle of stars and smiling cats slides behind the arena on a separate row from other active power-up banners; the power ends when it exits, then the glasses fade away. All brick cooldowns finish at expiry; Toggle locks and exhausted Crumblers resume their stored state. Another pair restarts the ten seconds; pause freezes the effect. Switchboard Supper introduces them.', 'item:magic-sunglasses'],
      ['On-screen lifetimes', 'Items and weapons can have an optional lifetime in seconds, starting when they appear. Leave it blank in the editor to keep them until the level ends. Timed objects show a lifetime bar; pause freezes expiry. Pickup does not shorten an equipped sword or power-up effect.'],
      [ITEMS['spooky-mask'].name, 'A red devil mask with yellow snake eyes, small outlined ears, horns and sharp teeth flies onto Koshi’s head for ten seconds. A translucent banner of ghosts and demon heads scrolls behind gameplay throughout the fear effect, on a separate row from other active power-up banners. Enemies look scared and shed flying sweat drops while moving away at a constant pace of 64 units per second. Mice do not rest and Rams do not target or charge while afraid. Wheels stay on the perimeter; Buckets pause their bomb-throwing timer. Most enemies cannot hurt Koshi or launch new attacks while afraid, but Robo Snake’s body remains dangerous. Existing bombs keep animating but cannot damage him during fear. Movement bounds and shields stay unchanged. Sleep overrides fleeing. Normal movement, attacks and damage resume at expiry. Newly spawned enemies are also afraid. Another mask restarts ten seconds; pause freezes the effect, and the mask fades after expiry.', 'item:spooky-mask'],
      ['Pickup sparkle', 'Collected food, items, and swords briefly pop larger, then shrink and fade into a burst of sparkles. Food also shows the points earned.'],
    ],
  },
  {
    title: 'Cooldown bricks',
    practice: 'cooldown',
    sections: [
      ...Object.entries(COOLDOWNS).map(([kind, seconds]) => [
        `${kind[0].toUpperCase() + kind.slice(1)} / ${{ slow: 'blue', normal: 'green', fast: 'red' }[kind]}`,
        `Wait ${seconds} seconds after selecting this brick before selecting it again. Its entire surface refills with color along the board boundary. Empty means recharging; fully colored means ready.`,
        `brick:${kind}`,
      ]),
      ['Keep moving', 'Cooling bricks stay solid. Use other bricks while one recharges. Brick cooldown color is independent of its slime color.'],
      ['Cinder blocks', 'Grey concrete blocks with two recessed holes are permanently solid. Koshi stops when he runs into one, but you cannot click it to aim. They have no modifiers or contact effects, do not advance Toggle counters, and cannot be absorbed by Warped bricks.', 'special:cinder'],
      ['Soccer goals', 'A goal replaces a boundary brick with white netting and a silver metal frame seen from above. It cannot be selected or changed by power-ups, and cannot be absorbed. Koshi still stops against it. Kick a soccer ball through its board-facing opening to score: the ball disappears in a sparking cloud.', 'special:goal'],
      ['Soccer Ball', 'A normal black-and-white soccer ball is a neutral object, not a pickup or enemy. Bump it while moving to kick it; off-center contact changes its direction. It rolls, bounces off bricks, enemies, Barrier fences, obstructions, bumpers, bubbles and other soccer balls, and gradually slows to a complete stop. Swords, sleep and fear do not affect it.', 'object:soccer-ball'],
      ['Item Case', 'A square glass case holds an item or weapon. Koshi and enemies pass through it without collision. A sword, hammer or axe automatically strikes the glass in range, using one strike; a fired Rope Dart can also shatter it. The glass breaks into fading chunks and the released pickup can then be collected. Walking through unarmed or using Boost does not break it.', 'object:item-case'],
    ],
  },
  {
    title: 'Bumpers, bubbles & obstructions',
    practice: 'bumper',
    sections: [
      ...Object.entries(OBJECTS).filter(([, object]) => object.bumper).map(([type, object]) => [
        object.name,
        `A stationary bumper bounces Koshi and robots on contact. The ${type.slice(7)} bumper ${object.speedMultiplier === 1 ? 'keeps' : object.speedMultiplier > 1 ? 'increases' : 'reduces'} Koshi’s speed${object.speedMultiplier === 1 ? '' : ` by ${Math.round(Math.abs(object.speedMultiplier - 1) * 100)}%`}.`,
        `object:${type}`,
      ]),
      ...Object.entries(OBJECTS).filter(([, object]) => object.bubble).map(([type, object]) => [
        object.name,
        `A bubble captures Koshi and holds him at its center for ${SLIMES[object.bubbleColor].duration} seconds. He cannot steer while trapped; enemies can still hurt him. The bubble then bursts. Matching colors use the same durations as slime.`,
        `object:${type}`,
      ]),
      ...Object.entries(OBJECTS).filter(([, object]) => object.catCircle).map(([type, object]) => [
        object.name,
        'A Cat Circle pulls Koshi smoothly to its center, like a bubble, then lets you steer again immediately. The circle stays in place after use. Bricks and bumpers can keep him from reaching it.',
        `object:${type}`,
      ]),
      ...Object.entries(OBJECTS).filter(([, object]) => object.obstruction).map(([type]) => [
        OBJECTS[type].name,
        'A fixed obstruction blocks Koshi, enemies, soccer balls and Robo Jackolantern fire waves. Koshi slides along its edge when moving into it. Some campaign obstructions appear during play; custom levels can also set an obstruction to destructible, in which case a Fireball Turret can destroy it. The Spiked option covers its exterior with white spikes that damage Koshi once per contact, like Spikes Bricks.',
        `object:${type}`,
      ]),
    ],
  },
  {
    title: 'Crumblers & Warped',
    practice: 'crumbler',
    sections: [
      ['Crumblers / C counter', 'Jagged Crumblers have limited selections. Each successful selection deepens their chips and cracks and reduces C by one. At C:0 the brick stays solid, but cannot be selected until restart. Its cooldown animation stops.', 'brick:crumbler'],
      ['Warped / W counter', 'Swirl-patterned Warped bricks absorb one neighboring brick or entire group each successful selection, including around corners. The enlarged surface acts as one brick with the selected owner’s cooldown and attributes. The first absorption starts W; further selections do not restart it.', 'brick:warped'],
      ['Restoration & combinations', 'When W expires, absorbed bricks regain their own attributes and remaining uses. A combined Warped Crumbler that reaches C:0 freezes enlarged with W:X until restart or absorption by another Warped owner.', 'brick:warped-crumbler'],
      ['Larger starting bricks', 'Double and triple bricks appear in the campaign. Aim anywhere on their surface: the whole group shares one owner’s cooldown, selection count, and attributes. In the editor, select adjacent bricks and choose an owner before Combine. Groups can cross corners; Cinder combines only with Cinder. Split retains current attributes. Warped timer restoration and restart preserve saved starting groups. A Portal group counts as one endpoint.'],
    ],
  },
  {
    title: 'Brick surfaces',
    practice: 'slime-red',
    sections: [
      ...Object.entries(SLIMES).map(([color, { duration }]) => [
        `${color[0].toUpperCase() + color.slice(1)} slime / ${duration} second${duration === 1 ? '' : 's'}`,
        'Drippy icing covers only the edge facing the play area. Touching it freezes Koshi. A matching-color ring drains with the remaining hold; FREE! signals release. Select a brick to move again.',
        `slime:${color}`,
      ]),
      ['Springs', 'A wooden platform with grain and a dark outline covers only the arena-facing edge. It reflects Koshi immediately instead of stopping him. Little springs underneath are hidden at rest and appear only while the platform compresses and rebounds on contact. Redirect him mid-bounce to take control.', 'brick:springs'],
      ['Spikes', 'Many white triangular spikes protrude toward the arena. Touching them costs one heart and stops Koshi. Resting against them does not cause more damage; leaving and touching them again does. Swords do not protect against spikes. Level 1-8 introduces them.', 'brick:spikes'],
      ['Conveyor', 'A thin grey, finely toothed belt rotates around the brick. Landing on the arena-facing edge carries Koshi in the arrow direction until the belt ends or another brick blocks him. Warped conveyors carry him around connected corners without stopping. Select another brick to steer away while riding. The editor offers clockwise and counterclockwise belts; Level 2-1 introduces them.', 'brick:conveyor'],
      ['Portal pairs', 'Misty colored smoke and a matching glowing oval mark paired portals: red, orange, yellow, green, blue, or purple. Touch one to emerge just outside the other brick, moving perpendicular into the arena. If a corner exit overlaps the adjacent wall, the oval shifts along the brick to the first clear position, so Koshi launches straight out without sticking. A short lockout prevents immediate return loops. If its partner is absorbed, the entrance acts as a solid landing. Cooling, exhausted, and Toggle-disabled portals still transport. Portal is separate from the neighbor-absorbing Warped attribute.', 'special:portal'],
      ['Toggle switches', 'The switch resembles a colored pill with a white sliding button and a countdown inside. Red starts at 1, green at 2, blue at 4. Every successful brick activation counts, including the Toggle itself. Initially disabled; at zero it enables. The next successful activation disables it and resets its countdown. Clicking a disabled or cooling brick does not count. Toggle only controls selection: disabled toggles cannot be selected, but their contact surfaces still work.', 'special:toggle'],
      ['Power Blocks', 'A circular black-and-yellow power icon sits on a normal red, green, or blue steering brick. Selecting any Power Block successfully switches all Power Blocks together between a yellow circle with a black power symbol (off) and a black circle with a yellow symbol (on). The editor sets their shared starting color; restart restores it. Steering and recharge time stay unchanged. Contact and failed clicks do not switch power. Hazard Bricks with a yellow or black border operate only while Power Blocks match that color.', 'special:power'],
      ['Hazard Bricks', 'Hazards operate without contact and never damage enemies. Red lasers shine straight inward; Koshi can cross them but takes damage. Orange/yellow flames damage him on the brick surface. Missiles track him slowly enough to dodge into a brick, obstruction, or bumper, exploding on impact. Colored bubble guns trap him; all bubble guns pause firing until he escapes. Colored bumper guns bounce him with the normal color speed modifiers. Obstructor guns fire bumper-sized obstructions with an editable color and pattern; they shove him without damage but crush him if they pin him against a brick. Missile shots default to 10 seconds after appearing on screen; bubble, bumper, and obstructor guns default to 3 seconds. Each gun has its own editable interval. No border means always operating; a black or yellow border requires matching Power Blocks. Available for custom levels, without changes to the campaign.', 'special:hazard'],
      ['Spawning bricks', 'An item-colored icon with a thin dark outline and dark rainbow glow indicates food, a sword, a robot, a heart, or a power-up. Sword colors distinguish brown wood, green patinated bronze, silver, and gold. Touch the brick to spawn exactly one item at a random safe location; clicking alone does nothing. A held Battery can recharge a used spawner on a new touch. Wheels spawn on the inner perimeter. Restart restores spent spawners. Food lifetime is configured in the editor.', 'special:spawner'],
      ['Turret bricks', 'A grey dome icon shows whether the brick holds a Fireball or Laser turret. Touch it to enter the inward-facing, transparent blue dome, then click or tap a point to aim and fire. A counter on the turret shows shots remaining; a red arc around its boundary shrinks over 10 seconds. It allows three shots or 10 seconds, then fades and releases Koshi. Fireballs explode and damage nearby enemies; lasers hit every enemy along a straight line. Pickups are unaffected. A Battery recharges a used turret when Koshi touches it again. Turrets are available in custom levels; Levels 3-4 and 3-9 introduce Laser and Fireball turrets.', 'special:turret'],
      ['Boost launches', 'When Koshi rests physically against a Boost brick, his wide-open mouth and eyes glow red to signal that his next successful launch travels at twice normal speed. A fireball overlays him and hits robots like a sword without spending equipped sword charges; shielded robots still require multiple hits. The boost ends when he stops or another brick is successfully selected. Failed selections do not cancel it; Spring bounces and Portal travel preserve it. Level 2-4 has no swords: use Boost to fight.', 'special:boost'],
      ['Barrier fences', 'Successfully selecting a Barrier brick extends a dark green translucent fence from its center, perpendicular to its surface. It grows until it reaches a brick or another fence. Select it again once ready to retract it. Fences block all enemies and Bucket bombs, but Koshi passes through freely. Available for custom levels; the campaign is unchanged.', 'special:barrier'],
      ['Contact is not a selection', 'Slime, Springs, Spikes, Conveyor, Portal, Spawning, Boost, and Turret work even on cooling, exhausted, or Toggle-disabled bricks. Contact does not consume cooldowns or C uses. These surfaces replace one another, but can combine with Toggle, Crumbler, and Warped attributes.'],
    ],
  },
  {
    title: 'Food & healing',
    practice: 'food',
    sections: [
      ...Object.entries(FOODS).map(([type, food]) => [`${food.icon} ${food.name} / +${food.value}`, `Adds ${food.value} food point${food.value === 1 ? '' : 's'} when touched. Food may appear alone, in lines, in circles, or scattered around the arena.`, `food:${type}`]),
      ['Food expires', 'The small bar above food shows its remaining lifetime. Expired snacks disappear; pause freezes their lifetime.'],
      ['Hearts', 'Koshi starts with three hearts. From campaign Level 1-4 onward, filling the Next: earned/cost food meter creates a pink cloud, then a healing heart one second later. The level sets its heart cost so all available food generates at most five hearts. Touch a heart to restore one, capped at three. Custom levels can change or disable this cost.', 'heart'],
    ],
  },
  {
    title: 'Robots & swords',
    practice: 'snake',
    sections: [
      ['Robo Mouse', 'Mice patrol at 75 board units per second in curved paths and periodically stop to bare their two large front teeth. They do not chase or shoot.', 'enemy:mouse'],
      ['Robo Wheel', 'Wheels roll along the inner perimeter. Intercept them near a wall while armed.', 'enemy:wheel'],
      ['Robo Ram', 'Sleek metal robots with pale curling horns, tiny nostrils, and a red eye-and-mouth display wander slowly, then pause as their eyes sparkle and aim at Koshi. They line up and charge quickly in a straight line. Dodge the rush or catch it with a sword. A ram ricochets off bricks and loses some speed with each bounce.', 'enemy:ram'],
      ['Robo Bucket', 'Buckets wander slowly with waving arms and randomly shoot blue bombs from their mouths. Bombs bounce off bricks and explode after three seconds; only their growing red flame circles can hurt Koshi. Defeat a bucket to squish it flat and pop its bombs.', 'enemy:bucket'],
      ['Robo Ball', 'An orange robot basketball with dark grey seams, beady red eyes and a rectangular grey tooth grate. It travels in straight lines at 120 board units per second, bouncing off bricks, fences and other enemies. On defeat it shrivels, pops its eyes into the air and fades. Sleep and fear affect it like other robots. Available for custom levels.', 'enemy:ball'],
      ['Robo Jackolantern', 'An orange pumpkin robot with grey mechanical eyes and an antenna instead of a stem. It wanders slowly, pauses for a half-second warning, and stomps every four seconds. A square fire ring expands from the stomp location at 120 board units per second. Touching it costs one heart. Bricks, barriers and obstructions extinguish only the blocked portions; the rest keeps growing. Fear prevents stomps and fire damage; sleep freezes it. On defeat its yellow nose and mouth dim grey, its antenna snaps, and the pumpkin bursts into pieces. Available for custom levels.', 'enemy:jackolantern'],
      ['Robo Snake', 'A long grey robot follows the inner perimeter at the same pace as a Wheel. It has four segments: a yellow-eyed head with black slit pupils and a flicking forked tongue emerging beneath its shell, then spiked panels with a grey plus sign, thin oval buttons and unlettered red circular buttons. Large symmetric grey shapes and red stripes decorate the segments. Only its head can be attacked with a sword or Boost; body contacts hurt Koshi even while the snake is asleep or afraid, respecting normal damage invulnerability. Fear makes it flee slowly along the border; sleep stops it. On defeat its segments fall apart and fade, and its tongue spins away. Available for custom levels.', 'enemy:snake'],
      ['Robo Goalie', 'An egg-shaped robot with three antenna hairs, a long metal nose, and a colorful striped soccer jersey with badges. He spawns at a normal enemy location or custom marker, then moves slowly toward the nearest Goal brick to guard it. If his goal is removed, he travels to the nearest remaining one. Once there, he moves across its mouth to intercept incoming soccer balls. He gently sways around his defensive target, proactively tracking nearby balls and anticipating their rolling motion; incoming scoring threats take priority. Overlapping goalies draw with the lowest on screen in front. He cannot hurt Koshi, but swords and Boost can destroy him; shields work normally. Music Box freezes him, and Spooky Mask makes him retreat along the goal mouth rather than leaving it. On defeat his jersey falls, revealing a plain mechanical shell; he blushes pink, then explodes. Without any Goal brick he immediately plays that defeat animation without awarding points. Available in custom levels and enemy spawners; Level 3-1 introduces him.', 'enemy:goalie'],
      ['Robo Snail', 'The green, spiral-shelled Snail wanders continuously and does not pause like a Mouse. Defeating it freezes all brick cooldowns for 20 seconds; cooldowns already running resume afterward, and new ones wait until the freeze ends. Available in the campaign and custom levels.', 'enemy:robo-snail'],
      ['Robo Crab', 'A grey robot with red arms and pincers and blinking green pixel eyes. Each crab shuffles back and forth horizontally or vertically, alternating between 45 and 150 board units per second. Each speed lasts a random 3 to 15 seconds; a wide-open mouth warns during the final 0.65 seconds before either change. Defeat it with a sword or Boost: its eyes and pincers fly off, it opens a big frown, and a smoke puff fades away. Sleep and fear work normally. Available in custom levels and enemy spawners.', 'enemy:robo-crab'],
      ['Robo Love Bug', 'Pink wings form a purple heart beneath a dark grey head with square red eyes, dark red legs and antennae. Love Bugs shuffle and bounce like Robo Balls at 120 board units per second. Swords, hammers, Boost and turret attacks cannot damage them or their shields. Instead, isolate them with Barrier fences: a lone visible Love Bug, or the only bug in a closed barrier region, dies automatically. An open route around a fence still connects companions; other enemy types and spawn previews do not count. Its eyes swell with blue tears, then its head and two wings split apart before a Wheel-style explosion. Sleep and fear affect movement but do not prevent isolation. Available in custom levels, spawners and barrier practice.', 'enemy:robo-love-bug'],
      ['Robo Cow', 'The Cow walks only along the board perimeter. After walking past several brick lengths, it stops to eat a boundary brick; after five seconds, that brick and its merged group become Cinder. Cinder and Goal bricks cannot be eaten. A Spooky Mask cancels eating and makes it flee. It can be defeated with a sword or Boost.', 'enemy:robo-cow'],
      ['Robo Unicorn', 'The Unicorn pauses to aim, then charges toward the nearest food and eats it. With no food left, it turns red and moves faster. Protect your food and use a sword or Boost to defeat it.', 'enemy:robo-unicorn'],
      ['Robo Koshi', 'This robotic copy waits one second, rushes to the place Koshi stood when it spawned, then follows Koshi’s recorded path a short time behind. Keep moving or change direction to avoid meeting your own trail; a sword or Boost can defeat it.', 'enemy:robo-koshi'],
      ['Tom the Toaster', 'Boss levels have one boss and no time limit. Dodge Tom’s spinning toast and rapid straight-line ricochets with no warning path. His charged attack fires blue toast that turns a non-Cinder brick blue, then black toast that destroys a non-Boost brick. After one to four attacks, his eyes scroll ERROR! and he rocks gently. Launch from a Boost brick to hit him then. Six hits empty his health bar; his death animation finishes before Koshi celebrates.', 'enemy:boss'],
      ['Damage & defeats', 'Unarmed contact with hostile robots costs one heart; Robo Goalie is harmless. After damage, Koshi looks upset and blinks red for exactly one second of protection from robots and spikes. When his normal face and colors return he can take damage again. Further contacts do not extend protection; pause freezes it. Staying overlapped does not repeatedly hurt, but separating and colliding again can. At zero hearts the level ends. Collect a sword, then approach an attackable robot to strike automatically. Love Bugs require Barrier isolation instead and can hurt Koshi even while he holds a weapon.'],
      ...Object.entries(WEAPONS).map(([type, weapon]) => [
        weapon.name,
        weapon.ropeDart
          ? `${weapon.uses} shots. Select a brick while resting to fire along the selected line. One shot deals one hit to each enemy crossed. Koshi waits until the dart hits a brick, obstruction or bumper, then is pulled toward it to collect it. Normal surface effects still apply. Moving clicks steer without firing; no new shot until collection. No automatic melee damage. Cannot damage Love Bugs or Tom the Toaster.`
          : weapon.axe
          ? `Unlimited strikes for ${weapon.seconds} seconds after pickup. The entire brown shaft continuously turns white starting at the top end above the blade, then continuing toward the butt, becoming all white at expiry. An Anvil refills it to brown. Each contact deals one hit, including shield hits. Pause freezes the timer and handle meter. Cannot damage Love Bugs or Tom the Toaster.`
          : weapon.hammer
          ? `${weapon.uses} hammer hits. Each contact spends as many hits as possible to damage an enemy shield or defeat an unshielded enemy, using no more hits than needed. Cannot damage Love Bugs or Tom the Toaster.`
          : `${weapon.uses} sword hit${weapon.uses === 1 ? '' : 's'} before breaking. Shield hits also spend a hit. Cannot damage Love Bugs or Tom the Toaster.`,
        `weapon:${type}`,
      ]),
      ['One weapon at a time', 'Every collected weapon replaces your current weapon and resets its hit count, shots or timer. A weaker weapon can reduce your remaining capacity. Weapons stop working immediately when their strikes or time run out, then fade away over 0.55 seconds. The final Rope Dart shot finishes its pull before fading. Uncollected weapons remain until their optional on-screen lifetime expires, or until the level ends.'],
    ],
  },
  {
    title: 'Spawn warnings',
    practice: 'warnings',
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
    practice: 'objectives',
    sections: [
      ['Campaign win conditions', 'The first 48 main campaign levels introduce one concept each, optional World 3S adds 12 challenge levels that combine them, and World 4 opens with a two-minute autoscrolling demo. Some require food points, enemy points, soccer goals, combined targets, or survival until time runs out. The briefing and gold HUD counters show the targets; combined progress follows the least-complete objective.'],
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
  { id: 'mouse', title: 'Swords & Robo Mouse', instruction: 'Choose a weapon below, then aim at the outlined brick. Pick up the weapon before reaching the mouse; attacks are automatic. Try each sword, hammer or axe with Retry.' },
  { id: 'cat-shield', title: 'Cat Shields', instruction: 'Collect the blue Cat Shield, then touch the Robo Mouse. It absorbs three hits, changing blue to green to red before it breaks; your hearts stay full.' },
  { id: 'wheel', title: 'Robo Wheel', instruction: 'Aim at the outlined brick to collect a sword and intercept a wheel at the inner perimeter. Unlike a mouse, it keeps rolling along the wall.' },
  { id: 'goalie', title: 'Robo Goalie', instruction: 'Collect a sword and intercept the Goalie. It guards a Goal and cannot hurt Koshi, but it can block soccer shots.' },
  { id: 'robo-snail', title: 'Robo Snail', instruction: 'Collect a sword and defeat the continuously wandering Snail. Watch every brick cooldown freeze for 20 seconds after the defeat.' },
  { id: 'robo-crab', title: 'Robo Crab', instruction: 'Collect a sword and intercept the shuffling Crab. Its wide-open mouth warns before switching between slow and fast patrols.' },
  { id: 'robo-love-bug', title: 'Robo Love Bug', instruction: 'Select the outlined Barrier brick and let its fence cross the arena. Separate the two Love Bugs: attacks cannot defeat them, but each dies when isolated.' },
  { id: 'robo-cow', title: 'Robo Cow', instruction: 'Collect a sword and intercept the Cow on the perimeter. If left alone, it eats a boundary brick and turns it into Cinder after five seconds.' },
  { id: 'robo-unicorn', title: 'Robo Unicorn', instruction: 'Collect a sword and intercept the Unicorn. It aims at and eats food; with no food left it turns red and speeds up.' },
  { id: 'robo-koshi', title: 'Robo Koshi', instruction: 'Collect a sword, keep moving, and watch the robotic copy return to the place you stood before following your path.' },
  { id: 'boss', title: 'Tom the Toaster', instruction: 'Practice the boss fight. Dodge toast and rapid ricochets without warning paths. Blue toast turns bricks blue; black toast destroys them. Rest at a Boost brick, then launch through Tom when his eyes scroll ERROR! Six hits defeat him; swords cannot help.' },
  { id: 'ram', title: 'Robo Ram', instruction: 'Collect the sword, then watch the ram pause as its eyes sparkle and it aims at Koshi. It lines up before a fast straight charge. Avoid the rush or intercept it while armed; bricks make it ricochet and slow down.' },
  { id: 'bucket', title: 'Robo Bucket', instruction: 'Collect a sword and intercept the bucket. Its blue bombs bounce harmlessly for three seconds before their expanding red flames can hurt you.' },
  { id: 'ball', title: 'Robo Ball', instruction: 'Collect a sword and intercept the bouncing basketball robot. It rebounds off walls and other enemies; defeat it to see it shrivel and pop its eyes into the air.' },
  { id: 'jackolantern', title: 'Robo Jackolantern', instruction: 'Collect a sword and intercept the pumpkin robot. Watch its half-second stomp warning: square fire waves grow until blocked by bricks, fences or obstructions.' },
  { id: 'snake', title: 'Robo Snake', instruction: 'Collect a sword and intercept the snake’s head at the inner perimeter. Avoid its three spiked body panels: they cannot be attacked and remain dangerous even during sleep or fear.' },
  { id: 'soccer', title: 'Soccer balls & goals', instruction: 'Select the outlined brick to bump the soccer ball off-center and kick it into the neighboring silver goal. Balls are not collected; watch the Goals counter and scoring spark cloud.' },
  { id: 'cat-circle', title: 'Cat Circles', instruction: 'Steer into the Cat Circle. Koshi glides to its center, then you can immediately click another valid brick to leave. The circle stays in place; bricks and bumpers can block the way.' },
  { id: 'healing', title: 'Heal with food', instruction: 'You have two hearts and 9 food. Collect the strawberry to reach 10, then head back along your route to collect the healing heart.' },
  { id: 'warnings', title: 'Spawn warnings', instruction: 'Wait for the skull, swirl, and star at 2 seconds. They reveal objects at 3 seconds. Then aim at the outlined brick to collect the snack.' },
  { id: 'pause', title: 'Pause & resume', instruction: 'Press Pause (or Escape), then Resume. The clock, movement, previews, and all brick timers freeze while paused.' },
  { id: 'objectives', title: 'Two goals to win', instruction: 'Aim at the outlined brick to collect a sword, one food, and defeat one robot. BOTH goals are required to complete this practice challenge.' },
  { id: 'portal', title: 'Portal pairs', instruction: 'Aim at the outlined purple Portal. Koshi emerges just outside its partner and moves straight into the arena. At a corner, the glowing oval shifts along the brick until the exit clears the neighboring wall. Matching smoke identifies pairs.' },
  { id: 'toggle', title: 'Toggle switches', instruction: 'The outlined red Toggle starts at 1. Successfully activate another brick to reach zero and enable it. The next successful activation, including the Toggle itself, disables it again.' },
  { id: 'spawner', title: 'Spawning bricks', instruction: 'Aim at the outlined spawning brick and physically touch it. Its rainbow-glowing heart outline turns dark grey as one healing heart appears at a random safe location. Merely clicking is not enough.' },
  { id: 'turret', title: 'Turret bricks', instruction: 'Touch the outlined Laser Turret to enter its dome. After the entry animation, aim and fire at the robot; turrets have three shots or ten seconds before releasing Koshi.' },
  { id: 'hazard', title: 'Hazard Bricks', instruction: 'Touch the outlined Flame Hazard, then leave it quickly. Fire damages Koshi even when he rests against it. Hazard Bricks do not harm enemies; optional black or yellow borders make their operation depend on matching Power Blocks.' },
  { id: 'boost', title: 'Boost launches', instruction: 'Koshi rests against the outlined Boost. Select a brick across the board to launch at double speed in a fireball, defeating the robot on the way. Another successful selection ends the boost.' },
  { id: 'barrier', title: 'Barrier fences', instruction: 'Select the outlined fence brick to extend its barrier. Koshi passes through, but enemies and bombs cannot. Select it again after its cooldown to retract the fence.' },
  { id: 'spikes', title: 'Spikes', instruction: 'Touch the outlined white Spikes. You lose one heart and stop, even with a sword. Wait against them: they cannot hurt again until you leave and touch them again. Then select another brick to leave.' },
  { id: 'conveyor', title: 'Conveyor belts', instruction: 'Touch the outlined grey Conveyor and watch Koshi ride along its arrows. Then select another brick to move away; you can redirect even while riding. Belts can run clockwise or counterclockwise; larger Warped belts can carry him around corners.' },
  { id: 'cinder', title: 'Cinder blocks', instruction: 'Koshi starts stopped against a grey Cinder block. It is solid but cannot be selected or absorbed, and has no special effects. Tap the outlined brick across the board to leave the Cinder and land safely.' },
  { id: 'larger', title: 'Larger bricks', instruction: 'Aim anywhere on the outlined double brick. Both segments share one cooldown and the owner’s attributes; they are not separate targets. Land on it and watch the entire surface recharge together.' },
  { id: 'warped-crumbler', title: 'Warped Crumblers', instruction: 'Select the outlined Warped Crumbler once. It absorbs a neighbor but uses its last selection. C:0 and W:X mean it stays solid and enlarged even after its 8-second timer; only restart or absorption can restore it.' },
  { id: 'bumper', title: 'Bumpers', instruction: 'Aim through the red bumper. It bounces Koshi away and increases his speed; green preserves speed and blue reduces it.' },
  { id: 'bubble', title: 'Bubbles', instruction: 'Touch the blue bubble and wait until it releases Koshi. Bubbles hold for the matching slime duration: blue 5 seconds, green 3, red 1.' },
  { id: 'obstruction', title: 'Obstructions', instruction: 'Steer into the fixed circle, then choose another brick to route around it. Obstructions block Koshi, robots, and soccer balls.' },
  { id: 'cookie', title: 'Smiley Cookie', instruction: 'Collect the Smiley Cookie and travel through the strawberries. It attracts food across the board while Koshi keeps moving.' },
  { id: 'stopwatch', title: 'Stopwatches', instruction: 'Collect the red Stopwatch to add ten seconds to the level clock. Green adds 30 seconds; blue adds 60.' },
  { id: 'boom-time', title: 'Boom Times', instruction: 'Collect the blue Boom Time before steering. It adds eight activations to this practice helmet; red adds one and green adds three.' },
  { id: 'battery', title: 'Battery recharge', instruction: 'Collect the Battery, then touch the already-used heart spawner to spend it and make the spawner produce an item again.' },
  { id: 'music-box', title: 'Music Box', instruction: 'Collect the Music Box to put the nearby robot to sleep for ten seconds. Sleeping enemies are usually harmless; watch out for the Robo Snake’s body.' },
  { id: 'spooky-mask', title: 'Spooky Mask', instruction: 'Collect the mask to frighten the robot. Enemies flee and most attacks stop for ten seconds; the Robo Snake’s body remains dangerous.' },
  { id: 'kitty-cape', title: 'Kitty Cape', instruction: 'Collect the cape and steer. Your current movement and the next launches travel at double speed for ten seconds.' },
  { id: 'magic-sunglasses', title: 'Magical Sunglasses', instruction: 'Collect the glasses while traveling, then select the outlined recharging brick. Sunglasses bypass cooldowns, but Cinder and Goal bricks remain unselectable.' },
  { id: 'eggplant', title: 'Eggplant', instruction: 'Collect the Eggplant to see its penalty: it subtracts ten food points, but never takes your score below zero.' },
  { id: 'saw-blade', title: 'Saw Blade', instruction: 'Collect the Saw Blade, then touch the outlined brick. Its whole merged shape becomes permanent Cinder.' },
  { id: 'ditto-stamp', title: 'Ditto Stamp', instruction: 'Collect the stamp and land on one brick to copy its properties. Land on another to apply them; the destination keeps its shape.' },
  { id: 'paintbrush', title: 'Paintbrushes', instruction: 'Collect the green brush, then touch a different brick. It changes that brick to a ready Normal brick; red paints Fast and blue paints Slow.' },
  { id: 'keys', title: 'Keys, chests & Cat Blocks', instruction: 'Collect the key, then touch the chest to spend it and collect the Cat Block. Campaign Cat Blocks are kept only after a win.' },
  { id: 'anvil', title: 'Anvil', instruction: 'Choose a weapon, then collect the anvil. Your partially used weapon returns to its full strike count, shot count or full axe timer. Anvils do nothing when unarmed.' },
  { id: 'rope-dart', title: 'Rope Dart', instruction: 'While resting, select the outlined brick to fire the Silver Rope Dart through both robots. Koshi waits for the dart to stop, then follows the rope and collects it. One click spends one shot, even when it hits multiple enemies.' },
  { id: 'item-case', title: 'Item Case', instruction: 'Aim at the outlined brick to collect a sword, then strike the glass case automatically. Watch the glass chunks fade and collect the key released from inside.' },
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
    this.bubbleSeen = false;
    this.circleRestSeen = false;
    this.obstructionSeen = false;
    this.stampCaptured = false;
    this.currentComplete = false;
    if (this.lesson.id === 'boss') {
      const bossLevels = LEVELS.some(level => level.bossLevel) ? LEVELS : [engine.LEVEL_DATA['Tom the Toaster']];
      const game = new Game(() => .5, { ...options, levels: bossLevels, level: bossLevels.findIndex(level => level.bossLevel) });
      game.level = { ...game.level, cutscene: undefined };
      this.target = game.bricks.find(brick => brick.boost && brickRegions(game.bricks, game.width, game.height).get(brick.id).edge === 'right');
      this.origin = { x: game.cat.x, y: game.cat.y };
      game.start();
      this.game = game;
      return game;
    }
    const level = { version: 1, id: `Practice ${index + 1}`, duration: 3600, goal: 1000, heartCost: 10, brickSet: 1, events: [],
      ...(this.lesson.id === 'boom-time' ? { activationLimit: 2 } : {}) };
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
    const addSword = () => {
      if (WEAPONS[this.sword].ropeDart) {
        game.weapon = { type: this.sword, uses: WEAPONS[this.sword].uses, expires: Infinity };
      } else game.weapons.push({ ...along(.22), type: this.sword });
    };
    const id = this.lesson.id;
    if (id === 'robo-love-bug') {
      this.target.barrier = true;
      const bounds = game.bounds(), y = this.target.y + this.target.h / 2;
      const offset = Math.min(80, (y - bounds.top) / 2, (bounds.bottom - y) / 2);
      for (const side of [-1, 1]) {
        const enemy = game.createCustomSpawn({ kind: 'enemy', type: id, x: .7,
          y: (y + side * offset - bounds.top) / (bounds.bottom - bounds.top) })[0];
        enemy.phase = Math.PI;
        game.robots.push(enemy);
      }
    }
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
    if (id === 'battery') this.target.spawner = { kind: 'item', type: 'stopwatch' };
    if (id === 'battery') this.target.spawned = true;
    if (id === 'turret') this.target.turret = 'laser';
    if (id === 'hazard') this.target.hazard = { type: 'flame' };
    if (id === 'barrier') this.target.barrier = true;
    if (id === 'bumper') game.bumpers.push(game.createCustomSpawn({
      kind: 'object', type: 'bumper-red', x: (along(.52).x - game.bounds().left) / (game.bounds().right - game.bounds().left),
      y: (along(.52).y - game.bounds().top) / (game.bounds().bottom - game.bounds().top),
    })[0]);
    if (id === 'bubble') game.bubbles.push(game.createCustomSpawn({
      kind: 'object', type: 'bubble-blue', x: (along(.52).x - game.bounds().left) / (game.bounds().right - game.bounds().left),
      y: (along(.52).y - game.bounds().top) / (game.bounds().bottom - game.bounds().top),
    })[0]);
    if (id === 'cat-circle') game.catCircles.push(game.createCatCircle(along(.52), 'cat-circle'));
    if (id === 'item-case') {
      addSword();
      game.itemCases.push(game.createItemCase(along(.7), { containsItem: 'key' }));
    }
    if (id === 'obstruction') game.obstructions.push(game.createCustomSpawn({
      kind: 'object', type: 'obstruction-circle', x: (along(.58).x - game.bounds().left) / (game.bounds().right - game.bounds().left),
      y: (along(.58).y - game.bounds().top) / (game.bounds().bottom - game.bounds().top),
    })[0]);
    if (id === 'boost') {
      this.target.boost = true;
      game.cat.x = this.target.x - game.cat.radius;
      game.robots.push({ ...along(.5), type: 'mouse', radius: 19, phase: 0, age: 4.5, touching: false });
    }
    if (['mouse', 'wheel', 'goalie', 'robo-snail', 'robo-crab', 'robo-cow', 'robo-unicorn', 'robo-koshi',
      'ram', 'bucket', 'ball', 'jackolantern', 'snake', 'objectives'].includes(id)) {
      addSword();
      if (['wheel', 'snake', 'robo-cow'].includes(id)) {
        const bounds = game.bounds();
        const type = id;
        const cowMeetingTime = (bounds.right - start.x) / SPEED;
        const enemyY = id === 'robo-cow' ? start.y - COW_SPEED * cowMeetingTime : start.y;
        const enemy = game.createCustomSpawn({ kind: 'enemy', type, x: 1,
          y: (enemyY - bounds.top) / (bounds.bottom - bounds.top) })[0];
        if (id !== 'robo-cow') {
          // Start upstream so the moving perimeter enemy meets the launch path near arrival.
          enemy.distance -= 95 * (bounds.right - start.x) / SPEED;
          game.placeWheel(enemy);
        }
        game.robots.push(enemy);
      } else if (id === 'goalie') {
        const goal = game.bricks.find(brick => regions.get(brick.id).edge === 'left' && brick.absorbedBy === null);
        goal.kind = 'goal';
        game.brickRevision++;
        const bounds = game.bounds();
        const enemy = game.createCustomSpawn({ kind: 'enemy', type: id,
          x: (along(.8).x - bounds.left) / (bounds.right - bounds.left),
          y: (along(.8).y - bounds.top) / (bounds.bottom - bounds.top) })[0];
        game.robots.push(enemy);
        game.soccerBalls.push(game.createSoccerBall(along(.45)));
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
      } else if (id === 'mouse' || id === 'objectives') {
        game.robots.push({ ...along(.8), type: 'mouse', radius: 19, phase: 0, age: 4.5, touching: false });
      } else {
        const bounds = game.bounds(), point = along(.8);
        const enemy = game.createCustomSpawn({ kind: 'enemy', type: id,
          x: (point.x - bounds.left) / (bounds.right - bounds.left),
          y: (point.y - bounds.top) / (bounds.bottom - bounds.top) })[0];
        if (id === 'robo-crab') {
          enemy.crabAxis = 'x';
          enemy.phase = Math.PI;
        }
        game.robots.push(enemy);
      }
    }
    const addItem = (type, fraction = .2) => game.items.push(game.createCollectible(0, type, null, along(fraction)));
    if (id === 'cookie') {
      addItem('smiley-cookie');
      for (const fraction of [.45, .65, .85]) addFood(fraction);
    }
    if (id === 'stopwatch') addItem('stopwatch');
    if (id === 'boom-time') addItem('boom-time-blue');
    if (id === 'battery') addItem('battery');
    if (id === 'anvil') {
      const weapon = WEAPONS[this.sword];
      game.weapon = { type: this.sword, uses: weapon.uses ? 1 : undefined,
        expires: weapon.seconds ? game.elapsed + 2 : Infinity };
      addItem('anvil', .5);
    }
    if (id === 'rope-dart') {
      game.weapon = { type: 'rope-dart-silver', uses: WEAPONS['rope-dart-silver'].uses, expires: Infinity };
      for (const fraction of [.45, .8]) {
        game.robots.push({ ...along(fraction), type: 'mouse', radius: 19, phase: 0, age: 4.5, touching: false });
      }
      game.enemiesSleepUntil = Infinity;
    }
    if (id === 'cat-shield') {
      addItem('cat-shield-blue');
      game.robots.push({ ...along(.8), type: 'mouse', radius: 19, phase: 0, age: 4.5, touching: false });
    }
    if (id === 'music-box' || id === 'spooky-mask') addItem(id);
    if (id === 'kitty-cape') addItem(id);
    if (id === 'magic-sunglasses') {
      game.items.push(game.createCollectible(0, id, null, { x: game.cat.x - 50, y: game.cat.y }));
    }
    if (id === 'eggplant') { game.score = 10; addItem('eggplant'); }
    if (id === 'saw-blade' || id === 'ditto-stamp') addItem(id);
    if (id === 'paintbrush') addItem('paint-wide-green');
    if (id === 'keys') {
      addItem('key');
      const chest = game.createCollectible(0, 'treasure-chest', null, along(.8));
      chest.keysRequired = 1;
      game.items.push(chest);
    }
    if (['music-box', 'spooky-mask'].includes(id)) {
      game.robots.push({ ...along(.8), type: 'mouse', radius: 19, phase: 0, age: 4.5, touching: false });
    }
    if (id === 'objectives') addFood(.55);
    if (id === 'robo-unicorn') addFood(.55);
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
    if (id === 'magic-sunglasses') this.target.readyAt = 8;
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
    if (game.bubbleTrap) this.bubbleSeen = true;
    if (game.catCircleTrap || game.catCircleIgnore) this.circleRestSeen = true;
    if (game.obstructions.some(obstruction =>
      Math.hypot(game.cat.x - obstruction.x, game.cat.y - obstruction.y) <= game.cat.radius + obstruction.radius + .05)) {
      this.obstructionSeen = true;
    }
    if (game.dittoStamp && game.dittoSource) this.stampCaptured = true;
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
      goalie: game.enemies >= 1,
      'robo-snail': game.enemies >= 1 && game.snailStreamUntil > game.elapsed,
      'robo-crab': game.enemies >= 1,
      'robo-love-bug': game.enemies >= 2,
      'robo-cow': game.enemies >= 1,
      'robo-unicorn': game.enemies >= 1,
      'robo-koshi': game.enemies >= 1,
      boss: game.bossDefeated && game.state === 'won',
      ram: game.enemies >= 1,
      bucket: game.enemies >= 1,
      ball: game.enemies >= 1,
      jackolantern: game.enemies >= 1,
      snake: game.enemies >= 1,
      soccer: game.goals >= 1,
      'item-case': game.keys >= 1 && game.itemCases.length === 0,
      'cat-circle': this.circleRestSeen && this.actions > 1 && game.catCircleTrap === null && game.catCircleIgnore === null,
      healing: game.hearts === 3 && game.score >= 10,
      warnings: this.previewSeen && game.score > 0,
      pause: this.paused && game.state === 'playing',
      objectives: game.state === 'won',
      portal: game.portalTrips > 0,
      toggle: this.target.toggleRemaining === 0,
      spawner: this.target.spawned,
      turret: game.turretEffects.length > 0 || game.turretProjectiles.length > 0,
      hazard: game.tookDamage && this.actions >= 2 && this.lastBrick !== this.target.id,
      boost: game.enemies >= 1 && this.actions > 0,
      barrier: game.barriers.some(fence => fence.id === this.target.id && fence.length > 20),
      spikes: game.hearts === 2 && this.actions > 0 && !game.cat.vx && !game.cat.vy,
      conveyor: this.rideSeen && this.actions >= 2 && this.lastBrick !== this.target.id,
      cinder: this.actions > 0 && !game.cat.vx && !game.cat.vy && Math.hypot(game.cat.x - this.origin.x, game.cat.y - this.origin.y) > 10,
      larger: this.target.readyAt > 0 && !game.cat.vx && !game.cat.vy,
      'warped-crumbler': this.warpSeen && this.target.usesLeft === 0 && game.elapsed >= this.target.warpUntil,
      bumper: game.bumpers.some(bumper => bumper.hitAt > 0),
      bubble: this.bubbleSeen && game.bubbleTrap === null && this.actions > 0,
      obstruction: this.obstructionSeen && this.actions > 1 && this.lastBrick !== this.target.id,
      cookie: game.score >= 3 && !game.items.some(item => item.type === 'smiley-cookie'),
      stopwatch: game.timeBonus >= 10,
      'boom-time': game.activationsRemaining > 2,
      battery: game.batteries === 0 && this.target.spawned && game.items.some(item => item.type === 'stopwatch'),
      anvil: game.pickups.some(pickup => pickup.type === 'anvil') && game.weapon
        && (WEAPONS[game.weapon.type].seconds
          ? game.weapon.expires - game.elapsed > WEAPONS[game.weapon.type].seconds - 1
          : game.weapon.uses === WEAPONS[game.weapon.type].uses),
      'rope-dart': game.enemies >= 2 && !game.ropeDart && this.actions > 0,
      'cat-shield': game.catShield === 'green' && game.hearts === 3 && game.tookDamage,
      'music-box': game.musicStreamUntil > game.elapsed,
      'spooky-mask': game.maskActive && game.robots.some(enemy => enemy.afraid),
      'kitty-cape': game.capeActive,
      'magic-sunglasses': game.sunglassesActive && this.actions > 1 && this.lastBrick === this.target.id,
      eggplant: game.score === 0,
      'saw-blade': this.target.kind === 'cinder',
      'ditto-stamp': this.stampCaptured && this.actions > 1 && !game.dittoStamp && game.dittoSource === null,
      paintbrush: this.target.kind === 'normal',
      keys: game.catBlockCollected && game.catBlockEvents.includes('chest'),
    }[id] ?? (id.startsWith('slime-') && this.held && game.stuckUntil === 0);
    if (success) { this.completed.add(id); this.currentComplete = true; }
    return this.currentComplete;
  }
}

const api = { GUIDE, LESSONS, Tutorial };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.KoshiLearning = api;
})();
