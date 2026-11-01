# Koshi's Quest
This document describes the gameplay of a game called Koshi's Quest. The protagonist of the game is Koshi the cat, a grey tabby cat with a white stripe on his nose, in his quest to save the world from evil AI robots. The game is to be written in JavaScript and accessible as a web app hosted in GitHub pages.

## Gameplay

### Title Screen
The game opens on a title screen with original artwork of a heroic, sword-wielding Koshi facing a menacing Robo Mouse and Robo Wheel, with green, blue, and red bricks in the background. Start adventure begins Level 1-1; Choose a level opens a popup with a level selector and Play level button without starting the clock. The main menu has no level dropdown. Back to menu or Escape cancels the popup without changing the current level. Escape dismisses the title to the ready screen. Custom-level playtest and install-help links bypass the title.

### Overview
Koshi is controlled by clicking locations on one of any of the "bricks" on the screen. Koshi then immediately begins traveling directly towards the specific location clicked on the brick. Bricks have a cooldown phase before Koshi can be triggered to move towards any point of the same brick once again. Koshi stops when he touches any brick. The player is able to redirect Koshi while he is still in movement by simply clicking another available brick before he stops due to touching a brick.

Koshi's aiming guide uses a subtle dotted trajectory at 15% opacity.
The exact clicked location is marked above the bricks by a small red circle
with a plus sign and a thin black outline.
When Koshi approaches a trampoline, the guide continues along his reflected
route until the following wall or trampoline. It predicts only the next bounce,
using Koshi's collision radius and the same reflection as actual movement.

The game is level-based, with multiple worlds split into individual levels. Most levels are defined to last a precise amount of time, with various events/triggers designed to occur at specific times. The objective to win each level varies. Conditions for victory in the level consist of:

1. Collecting enough food before time runs out
2. Destroying enough enemies before time runs out
3. Simply survive until the time runs out
4. Defeat the boss (no timer is used on bosses)

Playable levels choose survival OR a combination of food and/or enemy targets.
Survival wins at the exact time limit if Koshi is still alive on the board.
Score levels win as soon as all selected targets are reached; failing to reach
them before the time limit loses. The pre-level briefing states the objective.
Required food and enemy counters show "/ target" and are highlighted in gold.
Survival levels instead highlight the timer countdown in gold. The editor allows
these choices; zero disables a score target. Boss objectives are not implemented.

### Learning Menus

The title screen offers **How to play** and **Tutorial**.

How to play is a browsable, eight-topic rules walkthrough. Players can select
topics freely or move with Previous/Next. It describes movement and keyboard
controls, all cooldown and special bricks, all four robot enemies, every food,
heart healing, all four swords, spawn warnings, and current level goals.
Labeled pictures illustrate every cooldown brick, Crumbler, Warped and combined
brick, slime color, spring and spike surface, food, healing heart, enemy, and
weapon using the gameplay shapes. Story instructions are not part of this guide.
Each topic links to a related tutorial step. Escape or Back to title
closes the guide.

The interactive tutorial uses the actual game board and mechanics in 27 isolated
practice steps. It teaches aiming/stopping, redirection, food, recharge,
Crumblers, Warped restoration, red/green/blue slime, Springs, mouse combat and
swords, wheel interception, ram and bucket combat, healing, spawn previews, pause/resume, and combined
food/robot objectives, Portals, Toggles, Spawning, Boost launches, Spikes,
Conveyors, Cinder blocks, larger shared-cooldown bricks, and frozen Warped
Crumblers. An outlined brick provides a suggested target, and action
feedback marks a step complete only after the mechanic has been performed.

Players can freely choose any step, use Previous/Next, retry, or exit at any
time. Combat steps offer all sword types. Practice has no countdown or story
scenes and does not change campaign/editor data. Completion badges remain for
the current visit; retry refreshes the current action and arena. The objectives
challenge requires one food and one robot defeat. Menu reopens the title from
gameplay, pausing a normal attempt or discarding tutorial practice.

### Pre-level Story Cutscenes

Any level may define an optional cutscene before gameplay. The top two-thirds
of the screen show the cast interacting against a background matching the
level's world: a garden path for Levels 1-1 through 1-10 and the Clockwork Pantry
workshop for Levels 1-11 through 1-19. The bottom third is a retro RPG dialogue box,
with the speaking character's animated pixel-art head on the left and typed
dialogue in the locally bundled Pixelify Sans pixel font on the right.
Speaker names, scene headings, and controls use the same blocky retro font.
Koshi, Robo Mouse, Robo Wheel, Robo Ram, Robo Bucket, and Tom the Duck each have a distinct pixel
portrait. Gameplay characters reuse their actual drawings; Tom has a dedicated
full-body robot-duck drawing based on the supplied sketch.

Dialogue appears at 30 characters per second. Players may reveal the current
line, continue to the next, begin the level after the last line, or skip the
scene with Skip scene or Escape. Enter and Space activate the focused control.
The level stays ready with its timer at zero and no spawns until the scene
finishes or is skipped. Restart and level selection replay the scene; a level
without one begins immediately. Switching away suspends cutscene animation,
and reduced-motion preferences disable animation and show whole dialogue lines.

Tom the Duck is the main antagonist: a robot duck with a tall metal body,
radio antenna, narrow horizontal visor, long bill, plated wings, and webbed
metal feet. His antenna lights and bill animate while he speaks. He appears
in every campaign cutscene, commands the robot patrols,
and hoards the world's food in his Clockwork Pantry. Koshi rescues farms,
kitchens, and bakeries on his way to freeing the world, enthusiastically
eating every kind of food. Each scene teaches exactly that level's new
concept; robot cast members must be introduced by that point and present
in the corresponding level. Tom is a story antagonist, not a combat enemy or boss.
The level editor supports optional scenes with either background, ordered
dialogue lines, a speaker, and an on-stage cast. Saved JSON can additionally
set each actor's normalized position per line. Tom is available as a speaker
and cast member using the character ID `tom`, alongside `koshi`, `mouse`,
`wheel`, `ram`, and `bucket`. Older custom scenes remain supported.

### Koshi
Koshi is a circular cat head who is grey with dark grey stripes, a white stripe on his nose, and two pointy ears. He is smiling and has 4 large whiskers poking out from either side of his face.

### Level Layout
The key object of each level are the brick which for most levels make up the boundary of the rectangular grid of the level and sometimes some bricks are placed in the center of the level board as well.

The top of the screen holds locations for the following information:

1. Timer - a clock icon followed by a countdown of seconds remaining in the level. If no timer is used in the level, an infinity symbol is used
2. Level number - Each level has an identifier of the form "1-1", "2-3", etc. for "World 1 Level 1" and "World 2 Level 3", respectively
3. Food count - a chicken leg icon followed by a counter of how much food Koshi has consumed in this level
4. Enemy count - an evil face icone followed by a counter of how many enemies Koshi has destroyed this level
5. Objective - level objective
6. Life Meter - Koshi has 3 hearts. If he touches an enemy, a heart is lost.

### Spawn Previews

One second before a scheduled appearance, its exact location displays a visual
cue: a cloudy purple skull materializes for an enemy, a golden swirling pattern
grows from a point and dissipates to reveal a weapon, and a pinpoint of light
grows into a bright twinkling star then fades before food appears. Each object
in a food pattern or enemy wave gets its own cue. Wheels preview their actual
inner-perimeter starting position. Cues are visual only and pause with the game;
they never trigger damage or pickups. They apply to built-in and custom levels.
Spawn times and food lifetimes are unchanged: events before one second have
shortened previews, and events at zero appear immediately with no preview.

### Food
Food randomly appears throughout the level. Food often appears in groups and placed along straight lines so that Koshi may grab them all if he travels along that line. Different foods give Koshi different counts towards his food counters, according to the following table (note the abbreviations for the food will be used in outlining the levels):

|Food       | Counter   | Abbreviation|
|-----------|-----------|-------------|
|Strawberry | 1         | S           |
|Pretzel    | 2         | P           |
|Banana     | 3         | B           |
|Cheese     | 4         | C           |
|Chicken Leg| 5         | L           |
|Fish       | 6         | F           |
|Hamburger  | 7         | H           |

Food can appear in the following methods (note the abbreviations for the method will be used in outlining the levels):

| Method                | Description                                                | Abbrevation |
|-----------------------|------------------------------------------------------------|-------------|
| Solo                  | Appears by itself                                          | S           |
| Line of X             | Appears in straight line with X food                       | LX          |
| Circle of X           | Appears equally spaced along boundary of circle with X food| CX          |
| Random X              | Appears randomly across game board with X food             | RX          |

Note that food can only appear in locations where Koshi has access. Food does not appear on top of bricks.

Food will only remain on the screen for a limited amount of time. A timer bar will appear above the food when it appears and will decrease to indicate how long until the food disappears.

Every level has a "heart cost". This is the amount of food points required to have a heart be randomly placed into the game board.

### Hearts
Hearts appear on the screen when triggered by enough food (the heart cost for the level) being gathered by Koshi. These fill one heart in his health meter. Hearts may also appear in other ways (Ex: through bosses or other enemies dropping them - see enemy descriptions)

## Bricks
Bricks are colored based on their classification and can be clicked to move Koshi towards the precise location clicked on the brick. At this time, the brick becomes temporarily unclickable and turns a darker shade of color. The bricks have a cooldown time before they are once again clickable. A meter appears along the length of the brick which indicates how much longer the cooldown period is to last. Once the cooldown period is over, the brick returns to its original shade and is once again clickable.

### Brick Attribute - Cooldown
The bricks have the following classifications based on their cooldown time:

| Classification        | Cooldown Time (seconds) | Color |
|-----------------------|-------------------------|-------|
| Slow                  | 15                      | Blue  |
| Normal                | 8                       | Green |
| Fast                  | 3                       | Red   |

### Brick Attribute - Crumbler
Some bricks are "Crumblers". These bricks can only be selected a certain number of times before they are permanently de-activated for the rest of the level. These crumbler bricks have chipped, non-uniform boundaries rather than a crack texture and also have a numerical counter on them which indicates how many times the brick may be selected before it permanently de-activates. This number counts down by one each time it is selected.

### Brick Attribute - Warped
Some bricks are "Warped". These bricks, upon selecting, absorb an adjacent brick and form a larger brick. The specific brick selected is randomly chosen from the two adjacent bricks. Once the warped brick first absorbs an adjacent brick, it then kicks off a timer on the warped brick which counts down each second. Once this timer reaches zero, the warped brick returns to its original size and shape and all absorbed bricks return to their original state.

### Brick Attribute - Slimed
Some bricks have oozy slime only on the center-facing edge which Koshi touches, not around the other sides. It looks like bold cake icing with rounded, uneven goopy drips and a very dark border. Slime color is independent of brick cooldown color: blue holds Koshi for 5 seconds, green for 3 seconds, and red for 1 second. Unspecified slime color defaults to green. Warped groups use their owner's slime color along their exposed inner rim. This sticky slime holds Koshi stationary and blocks steering until he is released; simultaneous slime contacts use the longest hold. A matching-color countdown ring starts as a full circle and drains proportionally to the remaining hold time, without stuck text or duration messages. An expanding ring and FREE! label announce release. Koshi remains stationary until another valid brick is selected. Pause freezes the hold and countdown ring.

### Brick Attributes - Springs
Some bricks have a brown wooden platform with grain, a highlighted edge, and a clear dark outline only on the arena-facing edge, like slime, including the inner rim of warped groups. The platform is slightly thick and overhangs the brick toward the arena. The editor uses the same graphic. When Koshi lands on this brick, he bounces off immediately, reflecting his incoming direction about the contact surface without changing speed (including rounded corners). The platform compresses and rebounds slightly, revealing tiny springs underneath only during the bounce. At rest no coils are visible.

### Brick Attribute - Spikes
Many triangular white spikes protrude from the arena-facing edge. Touching their tips or sides stops Koshi and costs one heart, even while armed. Staying against them does not repeatedly damage him; separating and touching them again can. Losing the last heart ends the attempt. The editor previews the same spikes used for collision in play.

### Brick Attributes - Conveyor

A thin grey, finely toothed conveyor belt rotates around the entire brick perimeter. The editor offers clockwise and counterclockwise directions (clockwise by default); arrows show the direction on the arena-facing edge. Landing on that edge carries Koshi at 85 game units per second until the belt ends or another brick blocks him. He stops at the end without launching and can steer away while riding. Warped conveyors carry him continuously across absorbed bricks, connecting gaps, and corners, with clearance for his body even at stepped phone-layout corners. Items and enemy contact work during the ride. Restoration stops a ride if its supporting surface is no longer owned by the conveyor. Pause freezes carrying and belt rotation; restart clears the ride. Campaign conveyors first appear in Level 1-11. Desktop rotates their directions with the bricks.

Slimed, Springs, Spikes, Conveyor, Portal, Spawning, and Boost are mutually exclusive: choosing one in the custom-level editor replaces the others. All seven can combine with any cooldown color, Toggle, Crumbler, and Warped. Contact effects work even during cooldown, after Crumbler exhaustion, or while Toggle-disabled; touching a brick does not activate its cooldown or consume a selection. A warped group uses its owner's contact attribute across the entire merged shape, including connecting gaps. Slime starts in Level 1-6, Spikes in 1-8, Springs in 1-10, and Conveyors in 1-11. Restart clears spike contacts and restores health.

### Brick Attributes - Portal, Toggle, Spawning, and Boost

Cinder is a separate inert brick type, drawn as a grey concrete block with two
recessed holes. Koshi stops on contact and can leave by aiming at another brick.
Cinder cannot be activated, has no cooldown, modifiers, or contact effects,
does not advance Toggle counters, and cannot be absorbed by Warped bricks.
Choose Cinder in the editor's brick-type palette; it remains selectable for
editing. Converting a brick to Cinder clears its existing attributes.

The editor can also combine adjacent selected bricks into a larger starting
brick, including around corners. Choose an owner to inherit its type and
attributes; the full combined surface has one cooldown, Crumbler count,
Toggle cycle, and contact effect. Cinder groups contain only Cinder blocks.
Split returns them to individual sizes with the group's current attributes.
Starting groups persist in drafts, exports, playtests, and restart. Warped
bricks can absorb entire groups; restoration returns every group to its
starting combined shape instead of splitting it. A grouped Portal is one
endpoint. Portal exits remain anchored to the chosen owner; graphics center on the group.

Crumbler counts, Warped timer counts, and Toggle switches form a centered strip
along the original brick's long axis. They can appear in any combination.
The strip retains its original size but centers on the full starting or grown
brick, staying on the solid rim around corners rather than in empty arena.
It remains readable outside Crumbler's chipped outline. Larger non-Crumbler
bricks retain slightly rounded corners, including around turns.
`C:` identifies remaining uses, `W:` identifies seconds, and `W:X` means frozen.

Portal pairs have matching red, orange, yellow, green, blue, or purple smoky
borders. Touching one transports Koshi to its partner's center line, moving
straight into the arena perpendicular to that partner's edge at his existing
speed. A merged Warped portal retains its original owner's center line.
Absorbed partners cannot receive him; Toggle-disabled partners still can. A short arrival lock prevents
immediate loops. The editor allows individual or group portal edits, warning
about unfinished pairs. Exactly two endpoints per used color are required
before export or playtest, not during editing or draft saves. Changing an
endpoint leaves its partner unchanged. Compact visual palettes replace the
brick and item dropdowns; inactive settings are hidden and inspector sections
collapse when selecting a different kind of object.

Toggle switches start disabled and count all successful brick activations,
including their own: red starts at 1, green at 2, and blue at 4.
A dark border encloses the enlarged switch,
and its white knob displays the remaining count in large bold type.
At zero the brick enables; the next successful activation disables
it and resets its count. Toggle state only controls whether the brick can be
selected; all contact effects remain active, including Boost launches.

Spawning bricks show a prominent item-colored icon with a thin dark outline
and a dark rainbow glow for their configured
food, sword, robot, or heart. Physical contact spawns one item at a random safe
location, immediately and once per attempt; clicking alone does not spawn.
Wheels appear on the inner perimeter. Physical spawning changes the outline to
contrasting dark grey without a glow; clicking alone does not change it. Restart
restores it. Food lifetime is required in the editor; item and sword on-screen
lifetimes are optional, with blank meaning they remain until the level ends.
The timer starts at the actual spawn and freezes on pause, independently of any
collected power-up or equipped sword duration. Collected food, items, and swords
briefly enlarge, then shrink and fade with sparkles; expired objects do not.
Sword icons share the
weapon colors: brown wood, dark green patinated bronze, silver, and gold.
Gameplay swords also have thin dark outlines around the blade, guard, and handle.

Boost bricks display an orange-filled fireball with a dark outline and a
red-orange ember glow. Resting against a Boost brick makes Koshi's next successful launch twice as
fast. A fireball surrounds him and defeats robots without spending equipped
sword charges. Stopping or successfully selecting another brick ends the
boost; rejected selections, Spring bounces, and Portal travel do not.

## Enemies
Whenever Koshi loses a heart to an enemy or spikes, he becomes invulnerable to both for one second of game time. For exactly that interval he has an upset face and blinks between red shades. The animation uses the same timer as invulnerability: it ends precisely when he can take damage again. Blocked hits do not extend the timer. Pause freezes both; restart clears both. Contact tracking still requires separation before another hit from the same continuous contact. Protected Koshi can still move, collect items, attack, and be stopped by spikes; falling off the board still ends the attempt.

Enemies come in multiple types of movement and attack of patterns and must be attacked in different ways.

Live enemies cannot overlap or pass through each other. Roaming enemies turn away
on contact, while charging Rams reflect and lose speed, as they do against bricks.
Wheels never leave their boundary path: they queue behind other wheels and nudge
other enemies inward. Collisions do not reset Mouse resting periods or Ram attack
timers, and a targeting Ram keeps its locked aim even if nudged. Bombs and defeated
enemies do not block live enemies.

Enemy shields appear as colored rings and add hits before destruction. Blue shields
become green, green become red, and red disappear; an unshielded enemy dies on its
next hit. Each accepted hit grants the same one-second protection as Koshi and a
blinking red color changes, without blurred hit effects or changes to the enemy's normal shape or movement rules.
Sword hits consume one use per accepted hit; protected contacts do not consume uses.
During that one-second window, the attacked enemy cannot damage Koshi through
contact or its bombs, even after his last sword use is spent. Other enemies and
spikes can still hurt him.
Boost attacks also respect this protection. Defeating an enemy awards its original
required hit count: unshielded 1, red 2, green 3, blue 4. Points are awarded only on
destruction and count toward the enemy-score objective. Shields are selectable for
enemy placements and enemy-spawning bricks in the editor.

### Robo Mouse
Appearance: Robotic mouse head with grated texture over its eyeballs.
Movement: Mouse moves at 75 board units per second in random, curving patterns
and periodically stops in place to open its mouth and bare two large front teeth.
The same teeth display appears while speaking in cutscenes and pixel portraits;
Robo Wheels do not inherit this animation.
Attack: Does not fire projectiles nor directy chase Koshi. Only damages Koshi if they collide.
Defeat: Mouse is defeated by any weapon.

### Robo Wheel
Appearance: Robotic wheel with "Mr. Yuck" like face on it.
Movement: Rolls along the boundary of the game board
Attack: Does not fire projectiles nor directy chase Koshi. Only damages Koshi if they collide.
Defeat: Wheel is defeated by any weapon.

### Robo Ram
Appearance: Sleek, metallic grey robotic head with large light-grey curling horns, tiny nostrils, and a red eye-and-mouth display.
Movement: Wanders slowly, then pauses with brilliant sparkling eyes while aiming at Koshi's current position. It smoothly lines up the top of its head, then charges very quickly along that locked direction, reflecting off bricks and losing speed on each bounce, before returning to its wandering pattern.
Attack: The charge can collide with Koshi and cause damage.
Defeat: Any weapon defeats the ram. Its horns swing inward as its eyes fade, its head implodes, and a puff of smoke quickly dissipates.

### Robo Bucket
Appearance: Smiling faded-yellow bucket robot with a grey handle and waving grey arms, round eyes, and a red nose.
Movement: Wanders slowly and randomly shoots a blue bomb from its mouth about once every two seconds on average. Bombs fly in straight lines, bounce off bricks with reflected angles, and lose a little speed. Their color gradually changes from blue to red as the three-second fuse runs down.
Attack: A bomb is harmless while traveling. After a three-second fuse, it creates a growing red circle of flame that damages Koshi briefly.
Defeat: Any weapon defeats the bucket. It frowns, its arms fall away, and it melts away with a puff of smoke behind it. Its bombs vanish in tiny explosions.

## Weapons

### Swords
Swords randomly appear and do not ever disappear unless Koshi picks them up. Koshi holds one sword at a time. Every sword he touches replaces his current sword and resets its attack count or timer, even when the replacement is weaker. Shield hits also consume an attack. The swords come in the following colors/types:

| Sword Type            | Description                                                                 |
|-----------------------|-----------------------------------------------------------------------------|
| Wood Sword            | Destroys 1 enemy then is broken                                             |
| Bronze Sword          | Destroys 3 enemies then is broken                                           |
| Silver Sword          | Has 5 attacks then is broken                                                |
| Gold Sword            | Destroys all enemies touches for 15 seconds, then is broken                 |


## Death
Koshi dies if he either runs out of hearts or if he runs off of the edge of the screen.

### World 1: The food rescue

The old five levels are replaced by 19 lessons. The complete level names,
concept order, durations, and victory targets are listed in the
[campaign table](./README.md#how-to-play-and-interactive-tutorial).
Food-only, enemy-only, combined, and survival missions all use the same engine rules.

Each level introduces one concept in this order: normal red/blue/green bricks,
Robo Mouse, swords, hearts and heart cost, Crumblers, slime, enemy shields,
Spikes, Robo Wheels, Springs, Conveyors, Warped bricks, Robo Rams, Boost,
Spawners, Robo Buckets, Cinder, Toggles, Portals. Returning mechanics are
chosen for useful combinations rather than including every earlier brick style.
Each layout has at most six distinct styles and always retains ordinary steering
bricks. The 26 boundary segments form 21 starting blocks: 17 standard, three
double (14.3%), and one triple (4.8%). Desktop and portrait use the same groups.

All seven foods appear in each mission. Food patterns use three-item lines,
circles, and scattered groups, plus a single hamburger. Level 1-1 has appearances
at 3, 11, 19, 27, 35, 43, and 51 seconds; later levels distribute their seven
appearances from 3 seconds through nine seconds before the time limit.
The total scheduled food value is 70 points. Level 1-15 also has two single-use
hamburger-spawning bricks, bringing its possible food value to 84.
Hearts are disabled before 1-4. Thereafter the heart cost is
`ceil(total possible food points / 5)`: 14 normally, 17 in 1-15.
Even collecting all scheduled and brick-spawned food generates at most five hearts.

Swords first appear in 1-3, after its first enemies: wood at 20 seconds,
bronze at 38, silver at 58, and gold at 76. Later unshielded combat levels supply
silver 12 seconds after their first enemies and at 60% of the time limit.
Shielded enemy-goal missions budget the target plus 50% spare attacks (at least
five), plus the strongest shield's possible unfinished damage, rounded up to
whole silver swords. They arrive evenly from 12 seconds after the first enemies
until 25 seconds before timeout. Levels 1-11 and 1-12 supply three and four
silvers respectively, leaving room for shield hits that have not yet earned points.
Food-only and survival levels provide just one bronze, 14 seconds after their
first enemies, except 1-10, which provides a silver at 28 seconds.
Level 1-17 provides five silvers at 24/48/65/82/105 seconds for 25 attacks.
Main sword supplies are separated by at least 16 seconds. Enemy-goal levels after
1-10 without Boost bricks add two spare bronze swords at one-third and two-thirds
of the time limit (40/80 seconds in 1-11, 1-12, and 1-13), preserving their silver schedules.
The Boost introduction in 1-14 is the exception: no weapons are supplied;
its 12-enemy-point target must be met using Boost launches, with an extended
140-second limit.
Special-brick introductions provide at least three separate instances away from
corner segments. Three of four larger starting blocks (75%) use the introduced
feature: two doubles and one triple; the fourth larger block stays ordinary.
Returning features remain on separate bricks. The final level uses four portals
in purple and orange pairs, with three endpoints on larger blocks. All exits
are clear of walls in desktop and portrait play.
Enemy waves are larger after the enemy-free first level. Shielded enemies start
in 1-7, with roughly 35-63% of scheduled robots shielded from then onward.
Red shields start in 1-7, green in 1-12, and blue in 1-18. Later missions use
more shields and stronger colors. Defeat targets count enemy points, not raw
robot counts; targets, sword supply, and spawn timing are unchanged.

All levels begin with story cutscenes about Koshi saving the world and its meals
from Tom's robots. The first scene introduces Tom the Duck without showing any
combat robot. Each campaign scene includes Koshi and at most three enemies
including Tom; speaking robots take priority in the smaller cast. Each later
scene uses only enemy types actually in that level, never future enemies.
The final mission pairs purple Portals with Boost and
Toggle routes to break Tom's last blockade and reclaim a feast for the world.
Campaign progress uses a new save key; old five-level saves remain untouched
and cannot skip these new lessons.
