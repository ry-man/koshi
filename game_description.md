# Koshi's Quest
This document describes the gameplay of a game called Koshi's Quest. The protagonist of the game is Koshi the cat, a grey tabby cat with a white stripe on his nose, in his quest to save the world from evil AI robots. The game is to be written in JavaScript and accessible as a web app hosted in GitHub pages.

## Gameplay

### Title Screen
The game opens on a title screen with original artwork of a heroic, sword-wielding Koshi facing a menacing Robo Mouse and Robo Wheel, with green, blue, and red bricks in the background. Start adventure begins Level 1-1; Choose a level opens the level selector without starting the clock. Escape dismisses the title to the ready screen. Custom-level playtest and install-help links bypass the title.

### Overview
Koshi is controlled by clicking locations on one of any of the "bricks" on the screen. Koshi then immediately begins traveling directly towards the specific location clicked on the brick. Bricks have a cooldown phase before Koshi can be triggered to move towards any point of the same brick once again. Koshi stops when he touches any brick. The player is able to redirect Koshi while he is still in movement by simply clicking another available brick before he stops due to touching a brick.

The game is level-based, with multiple worlds split into individual levels. Most levels are defined to last a precise amount of time, with various events/triggers designed to occur at specific times. The objective to win each level varies. Conditions for victory in the level consist of:

1. Collecting enough food before time runs out
2. Destroying enough enemies before time runs out
3. Simply survive until the time runs out
4. Defeat the boss (no timer is used on bosses)

### Learning Menus

The title screen offers **How to play** and **Tutorial**.

How to play is a browsable, eight-topic rules walkthrough. Players can select
topics freely or move with Previous/Next. It describes movement and keyboard
controls, all cooldown and special bricks, both robot enemies, every food,
heart healing, all four swords, spawn warnings, and current level goals.
Labeled pictures illustrate every cooldown brick, Crumbler, Warped and combined
brick, slime color, spring and spike surface, food, healing heart, enemy, and
weapon using the gameplay shapes. Story instructions are not part of this guide.
Each topic links to a related tutorial step. Escape or Back to title
closes the guide.

The interactive tutorial uses the actual game board and mechanics in 16 isolated
practice steps. It teaches aiming/stopping, redirection, food, recharge,
Crumblers, Warped restoration, red/green/blue slime, Springs, mouse combat and
swords, wheel interception, healing, spawn previews, pause/resume, and combined
food/robot objectives. An outlined brick provides a suggested target, and action
feedback marks a step complete only after the mechanic has been performed.

Players can freely choose any step, use Previous/Next, retry, or exit at any
time. Combat steps offer all sword types. Practice has no countdown or story
scenes and does not change campaign/editor data. Completion badges remain for
the current visit; retry refreshes the current action and arena. The final
challenge requires one food and one robot defeat. Menu reopens the title from
gameplay, pausing a normal attempt or discarding tutorial practice.

### Pre-level Story Cutscenes

Any level may define an optional cutscene before gameplay. The top two-thirds
of the screen show the cast interacting against a background matching the
level's world: a garden path for Levels 1-1 through 1-3 and the Clockwork Pantry
workshop for Levels 1-4 and 1-5. The bottom third is a retro RPG dialogue box,
with the speaking character's animated pixel-art head on the left and typed
dialogue in the locally bundled Pixelify Sans pixel font on the right.
Speaker names, scene headings, and controls use the same blocky retro font.
Koshi, Robo Mouse, and Robo Wheel each have a
distinct pixel portrait; stage characters reuse their actual gameplay drawings.

Dialogue appears at 30 characters per second. Players may reveal the current
line, continue to the next, begin the level after the last line, or skip the
scene with Skip scene or Escape. Enter and Space activate the focused control.
The level stays ready with its timer at zero and no spawns until the scene
finishes or is skipped. Restart and level selection replay the scene; a level
without one begins immediately. Switching away suspends cutscene animation,
and reduced-motion preferences disable animation and show whole dialogue lines.

All five campaign levels include sample story dialogue: the robots claim the
garden's snacks, Koshi follows the shipment through a crumbling garden gate,
and then confronts the slime security and warped vault walls of their pantry.
The level editor supports optional scenes with either background, ordered
dialogue lines, a speaker, and an on-stage cast. Saved JSON can additionally
set each actor's normalized position per line.

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

Slimed, Springs, and Spikes are mutually exclusive: choosing one in the custom-level editor replaces the others. All three can combine with any cooldown color, Crumbler, and Warped. Contact effects work even during cooldown or after Crumbler exhaustion; touching a brick does not activate its cooldown or consume a selection. A warped group uses its owner's contact attribute across the entire merged shape, including connecting gaps. Built-in Levels 1-3 through 1-5 introduce these attributes. Spikes occupy phone-layout bottom 20–40% in Level 1-3, top 40–60% in Level 1-4, and top 40–60% plus right 50–62.5% in Level 1-5; desktop rotates these slots with their bricks. The opening two levels stay unchanged. Restart clears spike contacts and restores health.

## Enemies
Whenever Koshi loses a heart to an enemy or spikes, he becomes invulnerable to both for one second of game time. For exactly that interval he has an upset face and blinks between red shades. The animation uses the same timer as invulnerability: it ends precisely when he can take damage again. Blocked hits do not extend the timer. Pause freezes both; restart clears both. Contact tracking still requires separation before another hit from the same continuous contact. Protected Koshi can still move, collect items, attack, and be stopped by spikes; falling off the board still ends the attempt.

Enemies come in multiple types of movement and attack of patterns and must be attacked in different ways.

### Robo Mouse
Appearance: Robotic mouse head with grated texture over its eyeballs.
Movement: Mouse moves in random, curving patterns and periodically stops in place to lick its hands
Attack: Does not fire projectiles nor directy chase Koshi. Only damages Koshi if they collide.
Defeat: Mouse is defeated by any weapon.

### Robo Wheel
Appearance: Robotic wheel with "Mr. Yuck" like face on it.
Movement: Rolls along the boundary of the game board
Attack: Does not fire projectiles nor directy chase Koshi. Only damages Koshi if they collide.
Defeat: Wheel is defeated by any weapon.

## Weapons

### Swords
Swords randomly appear and do not ever disappear unless Koshi picks them up. When Koshi touches a sword, he then holds it and can use it to defeat enemies. Koshi cannot hold more than one weapon. If he already has a weapon, he cannot pick up another one until the weapon he is holding is broken. Swords either have a limit on the number of enemies or the time in which they are available. The swords come in the following colors/types:

| Sword Type            | Description                                                                 |
|-----------------------|-----------------------------------------------------------------------------|
| Wood Sword            | Destroys 1 enemy then is broken                                             |
| Bronze Sword          | Destroys 3 enemies then is broken                                           |
| Silver Sword          | Destroys 10 enemies then is broken                                          |
| Gold Sword            | Destroys all enemies touches for 15 seconds, then is broken                 |


## Death
Koshi dies if he either runs out of hearts or if he runs off of the edge of the screen.

### World 1

#### Level 1-1
This level has the following:

1. Level time length: 60 seconds
2. Level objective: Gather 20 food
3. Level setup: Bricks along just boundary of screen. Most bricks are Normal speed but one each of Slow and Fast are included.

The food will appear at the following times ("Appear Time") in the following methods using the abbreviations defined above and only stay on screen for the following time in seconds ("Life Time"):
| Appear Time  | Method | Food | Life Time |
|--------------|--------|------|-----------|
| 2            | S      |S     | 5         |
| 4            | S      |S     | 5         |
| 6            | S      |S     | 5         |
| 10           | L3     |S     | 5         |
| 15           | L3     |S     | 5         |
| 20           | L3     |S     | 5         |
| 25           | C3     |S     | 5         |
| 30           | C4     |S     | 5         |
| 35           | C5     |S     | 5         |
| 35           | R5     |P     | 3         |
| 45           | R5     |P     | 3         |
| 55           | R5     |P     | 3         |


#### Level 1-1
This level has the following:

1. Level time length: 60 seconds
2. Level objective: Gather 20 food
3. Level setup: Bricks along just boundary of screen. Most bricks are Normal speed but one each of Slow and Fast are included.
4. Heart Cost: Infinity (no hearts)

The food will appear at the following times ("Appear Time") in the following methods using the abbreviations defined above and only stay on screen for the following time in seconds ("Life Time"):
| Appear Time  | Method | Food | Life Time |
|--------------|--------|------|-----------|
| 2            | S      |S     | 5         |
| 4            | S      |S     | 5         |
| 6            | S      |S     | 5         |
| 10           | L3     |S     | 5         |
| 15           | L3     |S     | 5         |
| 20           | L3     |S     | 5         |
| 25           | C3     |S     | 5         |
| 30           | C4     |S     | 5         |
| 35           | C5     |S     | 5         |
| 35           | R5     |P     | 3         |
| 45           | R5     |P     | 3         |
| 55           | R5     |P     | 3         |


#### Level 1-2
This level has the following:

1. Level time length: 120 seconds
2. Level objective: Gather 20 food
3. Level setup: Bricks along just boundary of screen. Most bricks are Normal speed but three each of Slow and Fast are included.
4. Heart cost: 10

The food will appear at the following times ("Appear Time") in the following methods using the abbreviations defined above and only stay on screen for the following time in seconds ("Life Time"):
| Appear Time  | Method | Food | Life Time |
|--------------|--------|------|-----------|
| 5            | S      |S     | 10        |
| 10           | S      |S     | 10        |
| 15           | S      |S     | 10        |
| 20           | L3     |S     | 10        |
| 25           | L3     |S     | 10        |
| 30           | L3     |S     | 10        |
| 35           | C3     |S     | 10        |
| 40           | C4     |S     | 10        |
| 50           | C5     |S     | 10        |
| 60           | R5     |P     | 15        |
| 80           | R5     |P     | 15        |
| 100          | R5     |P     | 15        |

Enemies will appear at the following times
| Appear Time | Enemy               | Count |
|-------------|---------------------|-------|
| 10          | Robo Mouse          | 3     |
| 20          | Robo Wheel          | 1     |
| 30          | Robo Mouse          | 3     |
| 40          | Robo Wheel          | 1     |
| 50          | Robo Wheel          | 1     |
| 60          | Robo Mouse          | 3     |
| 70          | Robo Mouse          | 3     |
| 80          | Robo Wheel          | 1     |
| 90          | Robo Wheel          | 1     |
| 100         | Robo Mouse          | 3     |

Weapons will appear at the following times:
| Appear Time | Weapon              |
|-------------|---------------------|
| 5           | Wood Sword          |
| 15          | Bronze Sword        |
| 30          | Silver Sword        |
| 50          | Gold Sword          |
| 70          | Silver Sword        |
| 80          | Gold Sword          |

#### Levels 1-3 through 1-5

These levels require both objectives before the timer expires. The enemy HUD
shows the defeat target, and progress tracks the less-complete objective.
All have a heart cost of 10 and retain ordinary unlimited-use steering bricks.
Brick segments below use portrait coordinates; desktop rotates them clockwise
with the rest of the board.

| Level | Name | Time | Food goal | Robot defeats | Brick setup |
|-------|------|------|-----------|---------------|-------------|
| 1-3 | Crumb patrol | 120s | 20 | 4 | Five-use fast Crumblers at top 20–40% and bottom 60–80%; red slime at left 25–37.5%; Springs at right 62.5–75%; Spikes at bottom 20–40%. |
| 1-4 | Slime circuit | 150s | 25 | 8 | Fast Warped (12s) at top 80–100%; four-use fast Crumbler at bottom 0–20%; blue slime at left 12.5–25%, red at left 50–62.5%, green at right 25–37.5%; Springs at right 75–87.5%; Spikes at top 40–60%. |
| 1-5 | Warped showdown | 180s | 30 | 12 | Four-use fast Warped Crumbler (15s) at top 80–100%; fast Warped (10s) at bottom 0–20%; three-use Crumblers at top 20–40% and bottom 60–80%; blue slime at left 12.5–25%, green at right 25–37.5%, red at left 62.5–75%; Springs at right 75–87.5% and bottom 40–60%; Spikes at top 40–60% and right 50–62.5%. |

The base cooldown mix is three slow and three fast bricks, with remaining bricks
normal, before the overrides above. Green and red slime in 1-5, and red slime
in 1-4, have fast cooldowns; other slime and Springs have normal cooldowns.

Food timelines use `(time, method, food, lifetime)` in seconds:

- **1-3:** `(3,L3,S,15)`, `(15,C4,S,20)`, `(30,R5,P,25)`,
  `(50,L3,C,25)`, `(75,R5,P,30)`, `(100,C4,P,20)`.
- **1-4:** `(3,C4,S,20)`, `(18,L3,P,20)`, `(35,R5,P,25)`,
  `(55,C4,C,25)`, `(80,R5,P,30)`, `(110,L3,C,30)`, `(135,C4,P,15)`.
- **1-5:** `(3,L3,P,20)`, `(20,C4,P,25)`, `(40,R5,P,25)`,
  `(60,L3,C,30)`, `(85,C5,P,30)`, `(115,R5,C,30)`,
  `(145,C4,P,30)`, `(165,L3,C,15)`.

Robot timelines use `(time, type, count)`:

- **1-3:** `(10,mouse,2)`, `(25,mouse,2)`, `(45,wheel,1)`,
  `(65,mouse,2)`, `(90,wheel,1)`.
- **1-4:** `(10,mouse,3)`, `(25,wheel,1)`, `(40,mouse,3)`,
  `(60,wheel,2)`, `(85,mouse,3)`, `(110,wheel,2)`, `(130,mouse,2)`.
- **1-5:** `(10,mouse,3)`, `(25,wheel,2)`, `(40,mouse,3)`,
  `(60,wheel,2)`, `(80,mouse,4)`, `(105,wheel,2)`,
  `(130,mouse,4)`, `(155,wheel,2)`.

Sword timelines use `(time, type)`; uncollected swords persist:

- **1-3:** `(2,bronze)`, `(20,silver)`, `(50,bronze)`, `(80,silver)`.
- **1-4:** `(2,silver)`, `(30,bronze)`, `(55,gold)`, `(85,silver)`,
  `(115,silver)`.
- **1-5:** `(2,silver)`, `(30,silver)`, `(55,gold)`, `(80,silver)`,
  `(105,gold)`, `(135,silver)`, `(155,gold)`.
