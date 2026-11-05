# Koshi's Quest
This document describes the gameplay of a game called Koshi's Quest. The protagonist of the game is Koshi the cat, a grey tabby cat with a white stripe on his nose, in his quest to save the world from evil AI robots. The game is to be written in JavaScript and accessible as a web app hosted in GitHub pages.

## Gameplay

### Title Screen
The game opens on a title screen with original artwork of a heroic, sword-wielding Koshi facing a menacing Robo Mouse and Robo Wheel, with green, blue, and red bricks in the background. The green main button reads "Continue as [owner]" and resumes the most recently played save slot's level map when any save exists; with no saves it reads "Start adventure" and opens world selection for a new guest adventure (initially World 1). There is no separate level-select button on the title. Save slots' Play as guest opens world selection without saving. The main menu has no level dropdown. Back to menu or Escape cancels the popup without changing the current level. Escape on the title opens the map rather than skipping selection. Custom-level playtest and install-help links bypass the title.

### Worlds and level selection

Worlds group levels and may contain different numbers of levels. The demonstration
splits the existing campaign into **World 1: Garden Path** (10 levels, 1-1 to 1-10)
and **World 2: Clockwork Pantry** (24 levels, 2-1 to 2-24), without changing any
layouts, objectives, schedules or dialogue. **World 3: Robot Foundry** (14 levels,
3-1 to 3-14) follows them. **World 3S: Tom's Gauntlet** (12 levels, 3S-1 to
3S-12) is an optional challenge world that branches from World 2 below the
main path. Each world carries a graphical theme,
shown through map colors and leaf/gear/robot-head emblems; additional gameplay theming can
be added later.

The high-level map groups each world into a single clickable stop. Koshi's
marker shows the selected world. Click a different world to move him there;
click the world he is already on to zoom into its low-level map.
Only that world's individual level stops are shown, connected by a path.
Clicking a stop moves Koshi along the map and displays the level's number,
name, win objectives, time to beat, Boom Helmet moves to beat when applicable,
fastest winning time, fewest moves to win, highest food and enemy points, win/loss/quit counts and
win percentage (wins divided by all attempts, including quits; N/A before any attempts).
Win objectives use food, enemy and soccer-goal icons with numerical targets,
or just a clock for survival. Small labeled icons preview its enemies, blocks, items and
spawner contents. **Play Level** begins the selected level; **World Select**
returns to the high-level map. Maps support touch, keyboard and reduced motion.
The map window and its scrollable map/details panes keep the same size for a
given viewport regardless of how many levels or preview items are listed.
Level-number labels stay on one line. **Skip cutscene** replaces **Back to menu**
when a cutscene level is selected. Cutscenes play on first visits and default
to skipped after being viewed; restarting a level does not replay its cutscene.
Back to menu remains available in the world-selection view.
Level selection remains unrestricted.
World and level selection are required for new games; level selection is
required between campaign levels. Creating a save starts at world selection. Loading a save opens the
level map inside the last-played level's world, with that level selected.
The last-played field is saved when the briefing's Start is pressed, even
if the player later abandons the attempt, which counts as a quit rather than a win or loss.
Legacy saves without that field use their first unfinished level.
After a win's celebration, a results popup compares completion time, food,
enemy points, soccer goals and moves with previous records in a grid labeled
This Run and Record. Game-interface icons identify each metric. New records highlight
the value in gold with a smiling-cat marker and an explanatory legend. A
damage-free win awards a gold star, with an indicator if it was acquired on
an earlier run. Continue opens the level map and Koshi moves from the completed
level to the next stop. At world boundaries the next world's
map includes the completed level as an entry connector. At the final level
Koshi remains on the completed stop. Golden flags wave on completed levels
and fully completed worlds; reduced motion disables waving and movement.
Retries and restarts of the same level still open its briefing directly.
No campaign level starts from a new game or win without map selection.

The primary path traverses worlds numbered 1, 2, 3, etc. World definitions
provide explicit routes; optional Special Worlds use IDs such as S2 and
`special: true`. For example, World 1 can link to both 2 and S2, and S2 can
rejoin 2. Special branches are dashed; default next-level suggestions follow
the main path rather than requiring special-world completion. No additional
special-world levels are included in this two-world demonstration.

Every started attempt saves to the active campaign slot as a provisional quit.
A win or loss replaces that same entry, so closing or terminating the app still
records a quit even without a shutdown event. Quitting, leaving or restarting a
started level before a result counts as one quit. Briefings and cutscenes do not
count as attempts. Pausing and backgrounding checkpoint the same attempt without
ending it; resumed play can still replace the provisional quit with a win or loss.
Only wins contribute to fastest time; all outcomes contribute to highest food,
enemy and soccer-goal scores, using the latest saved checkpoint on app closure.
Guest results last for the current visit. Older saves preserve
completed levels, but have no historical times, scores or attempt counts;
unrecorded values are shown explicitly. Stable internal level IDs and existing
campaign links are retained, while displayed numbers reflect the new worlds.
Fewest moves records the smallest number of successful brick selections in a
winning attempt, including mid-flight redirects and Magical Sunglasses.
Rejected clicks, passive travel and brick contacts, Spring bounces and Portal
arrivals do not count. Losses and abandoned attempts cannot improve it.
Earlier results without move counts remain unrecorded until a new win.

### Overview
Koshi is controlled by clicking locations on one of any of the "bricks" on the screen. Koshi then immediately begins traveling directly towards the specific location clicked on the brick. Bricks have a cooldown phase before Koshi can be triggered to move towards any point of the same brick once again. Koshi stops when he touches any brick. The player is able to redirect Koshi while he is still in movement by simply clicking another available brick before he stops due to touching a brick.

Koshi's aiming guide uses a subtle dotted trajectory at 15% opacity.
The exact clicked location is marked above the bricks by a small red circle
with a plus sign and a thin black outline.
When Koshi approaches a trampoline or bumper, the guide continues along his
reflected route until the following wall, trampoline or bumper. Springs and
bumpers count equally: it predicts only the next bounce,
using Koshi's collision radius and the same reflection as actual movement.

The game is level-based, with multiple worlds split into individual levels. Most levels are defined to last a precise amount of time, with various events/triggers designed to occur at specific times. The objective to win each level varies. Conditions for victory in the level consist of:

1. Collecting enough food before time runs out
2. Destroying enough enemies before time runs out
3. Simply survive until the time runs out
4. Defeat the boss (no timer is used on bosses)
5. Score enough soccer goals before time runs out

Playable levels choose survival OR a combination of food, enemy and/or soccer-goal targets.
Survival wins at the exact time limit if Koshi is still alive on the board.
Score levels win as soon as all selected targets are reached; failing to reach
them before the time limit loses. The pre-level briefing states the objective.
Required food, enemy and soccer-goal counters show "/ target" and are highlighted in gold.
Survival levels instead highlight the timer countdown in gold. The editor allows
these choices; zero disables a score target. Boss objectives are not implemented.

Each level opens with an objectives popup and a large **Start** button, including
restarts and campaign advances. Time does not advance until the player starts.
The top-left HUD shows **Time left** inset from the edge instead of the in-game
logo. The evenly spaced row below shows **Koshi's Health**, **Food**, **Enemies**,
**Batteries**, **Goals**. An equipped sword appears beside Koshi with its
remaining hit count. Combined progress follows the least-complete required target.

### Boom Helmet difficulty modifier

A level may optionally limit successful brick activations using
`activationLimit` (a whole number from 1 to 100000; blank, omitted or `null`
means unlimited). When Start is pressed, a round blue helmet with a bomb fuse
falls onto Koshi's head. A white circle contains the remaining count in black.
Every successful selection costs one charge, including mid-flight redirections
and selections with Magical Sunglasses. Failed clicks, blocked launches, and
physical brick contacts cost nothing.

At zero, the helmet explodes immediately and Koshi's death/loss animation plays.
The large red-orange blast stays at the detonation location, independent of
Koshi's rotating death animation.
No further movement is possible; hearts and invulnerability cannot prevent it.
The difficulty limit can accompany survival or combined food/enemy/soccer
objectives. Pause freezes the helmet animation and restart restores its count.

**Boom Time** is a bomb-shaped analog clock in three pickup colors:
red (`boom-time-red`) adds **1**, green (`boom-time-green`) adds **3**, and blue
(`boom-time-blue`) adds **8** helmet charges. The face shows the bonus.
These pickups do not add level-clock time. Without an equipped helmet they are
collected with no effect, and cannot revive an exploded helmet. All variants
are available in editor placements and item spawners, with optional lifetimes
and standard pickup effects. Level 2-24 introduces the helmet and all three
Boom Time colors; the original 19 levels stay unchanged.

**Kitty Cape** (`kitty-cape`) matches the green cape in the title artwork.
Pickup immediately doubles Koshi's movement speed for **10 seconds**, including
current flight and redirects. Spring bounces and portals preserve the faster
flight; Boost launches double it again, while conveyors keep their normal pace.
A translucent scrolling rectangle of cat heads and lightning bolts remains
behind gameplay throughout the effect and exits at expiry. Repeat pickups
refresh the ten seconds without stacking speed. Pause freezes the power and
animation; restart clears both. The cape supports custom-level placements,
optional ground lifetimes, and item spawners, without changing campaign levels.

Music Box sleep and its scrolling score last **10 seconds**; another pickup
refreshes the timer. Spooky Mask shows a scrolling banner of ghosts and demon
heads throughout its ten-second fear effect. Simultaneous timed power-up
banners use separate, vertically spaced rows, including Music Box, Magical
Sunglasses, Kitty Cape and Spooky Mask. Pause freezes all timers and graphics;
restart clears them. Magical Sunglasses make all bricks glow in the same
cycling colors as the frames, without changing cinder or goal selection rules.

**Robo Goalie** (`goalie`) is an egg-shaped mechanical robot with three hair
antennas, a long metal nose, and a colorful striped soccer jersey with badges.
He spawns at a normal enemy location or his custom placement marker and moves
toward the nearest Goal brick at 67.5 units/second. If that goal is removed, he
travels toward the nearest remaining goal without teleporting. Once in position,
he slides across its mouth, trying to intercept incoming soccer balls.
Overlapping goalies and their defeat animations are drawn in ascending screen
height order, with the lowest on screen in front. Crowded guards use stable
spawn-height push priority (lower on screen first, spawn order breaks ties):
the leading guard keeps moving and pushes other goalies aside. A guard blocked
by the boundary yields inward instead of trapping the leader. Total movement,
including all collision pushes, is capped at 135 units/second, so overlaps resolve
gradually rather than jumping in one frame. Sleeping goalies remain stationary.
He proactively tracks
nearby balls within 240 units and predicts up to 0.6 seconds of rolling motion,
accounting for friction. He gently oscillates five units around his defensive
target, or around the goal center when no balls are nearby. Incoming scoring
threats take priority over nearby balls. He never damages Koshi, but swords and Boost
can defeat him, with normal optional shields and enemy-point awards. Music Box
stops him; Spooky Mask makes him retreat along the goal at 64 units/second.
His jersey falls down, revealing a plain mechanical shell; he turns pink with
embarrassment and explodes, over 1.8 seconds. Pause freezes the animation.
Without a Goal brick he immediately dies with no enemy-point award. He supports
custom placements, enemy spawners, editor icons and custom cutscene actors.
Built-in level content and schedules are unchanged.

### Learning Menus

The title screen offers **How to play** and **Tutorial**.

How to play is a browsable, nine-topic rules walkthrough. Players can select
topics freely or move with Previous/Next. It describes movement and keyboard
controls, all cooldown and special bricks, robot enemies, soccer balls and goals, every food,
heart healing, all four swords, spawn warnings, and current level goals.
Labeled pictures illustrate every cooldown brick, Crumbler, Warped and combined
brick, slime color, spring and spike surface, food, healing heart, enemy, and
weapon using the gameplay shapes. Story instructions are not part of this guide.
Each topic links to a related tutorial step. Escape or Back to title
closes the guide.

The interactive tutorial uses the actual game board and mechanics in 32 isolated
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
challenge requires one food and one robot defeat. The open-doorway **Exit level**
button in the game toolbar pauses play and asks whether to quit and return to
the world map; **End Level** discards the attempt (or tutorial practice) and
opens the map, while **Cancel** or Escape returns to the paused game.

### Pre-level Story Cutscenes

Any level may define an optional cutscene before gameplay. The top two-thirds
of the screen show the cast interacting against a background matching the
level's world: a garden path for Levels 1-1 through 1-10, the Clockwork Pantry
workshop for Levels 2-1 through 2-24, and the smoky Robot Foundry, with chimneys
and gears, for Levels 3-1 through 3-14. The bottom third is a retro RPG dialogue box,
with the speaking character's animated pixel-art head on the left and typed
dialogue in the locally bundled Space Grotesk font on the right. Speaker names,
scene headings, and controls use the same clear, rounded font.
Koshi, all eight robot types, and Tom the Duck each have a distinct pixel
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
`wheel`, `ram`, `bucket`, `ball`, `snake`, `jackolantern`, and `goalie`. Older custom scenes remain supported.
The editor's Level library also offers every built-in campaign level for
read-only inspection of bricks, scheduled events, cutscenes, and preview timing.
Campaign spawn coordinates are representative randomized examples. Editing and
draft/import/export actions are disabled; switching back restores custom work.
The play link launches the original campaign level rather than a custom copy.

Spooky Mask is a red devil face with yellow snake eyes, pointed ears and nose,
horns and sharp teeth. It moves onto Koshi's head for ten seconds. Enemies show
scared faces and small sweat drops flying in random directions at two drops per
second per moving enemy while fleeing his current position at a
constant pace of 64 game units per second within movement bounds. Mice
do not pause and Rams do not target or charge while afraid. Wheels stay on
the perimeter and Buckets pause their bomb-throwing timer. Normal movement resumes at expiry.
The mask has smaller, distinctly outlined ears with dark inner-ear shading.
Scared enemies do not attack or hurt Koshi on contact. Existing bombs keep
animating but cannot damage him during fear; attacks and damage resume at expiry.
Sleep overrides fleeing.
New enemies are affected too. Another pickup refreshes the duration, pause
freezes it, and the mask fades after expiry. The editor and spawners support it.

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
Many triangular white spikes line the arena-facing edge. The brick body is recessed by the spike depth, so the body and spikes together occupy the same thickness as a non-spike brick; their tips do not extend farther into the arena. This also applies to merged bricks. Touching their tips or sides stops Koshi and costs one heart, even while armed. Staying against them does not repeatedly damage him; separating and touching them again can. Losing the last heart ends the attempt. The editor previews the same spikes used for collision in play.

### Brick Attributes - Conveyor

A thin grey, finely toothed conveyor belt rotates around the entire brick perimeter. The editor offers clockwise and counterclockwise directions (clockwise by default); a large centered arrow indicates the direction of travel. Landing on the arena-facing edge carries Koshi at 85 game units per second until the belt ends or another brick blocks him. He stops at the end without launching and can steer away while riding. Warped conveyors carry him continuously across absorbed bricks, connecting gaps, and corners, with clearance for his body even at stepped phone-layout corners. Items and enemy contact work during the ride. Restoration stops a ride if its supporting surface is no longer owned by the conveyor. Pause freezes carrying and belt rotation; restart clears the ride. Campaign conveyors first appear in Level 2-1. Desktop rotates their directions with the bricks.

Slimed, Springs, Spikes, Conveyor, Portal, Spawning, and Boost are mutually exclusive: choosing one in the custom-level editor replaces the others. All seven can combine with any cooldown color, Toggle, Crumbler, and Warped. Contact effects work even during cooldown, after Crumbler exhaustion, or while Toggle-disabled; touching a brick does not activate its cooldown or consume a selection. A warped group uses its owner's contact attribute across the entire merged shape, including connecting gaps. Slime starts in Level 1-6, Spikes in 1-8, Springs in 1-10, and Conveyors in 2-1. Restart clears spike contacts and restores health.

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
Ditto Stamp is an orange wooden stamp shown straight-on from the side, with a
round knob, wood grain and an even, flat grey rubber pad beneath the wooden base.
It has no sparkles, background or cast shadow.
Random Ditto Stamp spawns leave at least two Koshi diameters of empty space
between the stamp's edge and every brick, including merged brick surfaces.
Explicit editor placements keep their chosen positions.
Random Saw Blade spawns and spawners use the same clearance as Ditto Stamps
and paintbrushes. Reserved random positions are rechecked at appearance and
rerolled only if unsafe; explicit Saw Blade placements keep their markers.
Random enemy spawns never overlap Koshi, including perimeter enemies and the
full Robo-Snake body. Reserved random enemy previews are rechecked when the
enemy appears; only an unsafe position is rerolled. Enemy spawners use the same
rule, while explicit editor enemy placements keep their chosen positions.
Random food, item, weapon and heart spawns (including spawner bricks) stay at
least 80 pixels from other pickups already on the board or queued to appear.
A spot that is too close is rerolled; if the board is too crowded, the roomiest
spot found is used. Food patterns keep their shape and move as a whole, while
random scatter food spaces each piece. Explicit editor placements are unchanged.
After pickup it follows Koshi until his first stop on a non-Portal brick, then
presses onto that brick's center to capture its properties and returns beside
him with matching ink. His next landing presses onto the destination's center
and copies the captured properties before contact
effects, preserving destination size and merged shape and refreshing cooldowns,
Crumbler uses, Toggle counters, spawners and warp timers. Portals do not supply
or consume copies; merging Warped bricks can be copied. Both presses travel to
the center and squash against it; a colored ripple shows the transformation.
Pickup while resting waits for a new landing, and Spring bounces cannot capture
a source because Koshi does not stop. Midair redirects retain the captured copy. Duplicate
pickups do not stack, and a held saw takes priority without consuming the stamp.
Smiley Cookie, all Stopwatches, Battery, Music Box, Eggplant, Saw Blade,
Magical Sunglasses, Ditto Stamp and Spooky Mask are available in the editor for
custom levels and introduced individually in Levels 2-11 through 2-21.
Paintbrushes come in red, green and blue, in three shapes: a thin pencil-like
brush with paint on its tip (1 brick contact), a wide brush with angled bristles
and painted tips, with a small downward drip only from the longest bristles,
leaving the bristles near the handle clean (3 contacts),
and a soaked, dripping paint roller (5 contacts). Their item IDs are
`paint-pencil-{color}`, `paint-wide-{color}`, and `paint-roller-{color}`.
They change the next eligible brick contacts to the matching cooldown:
red/Fast (3s), green/Normal (8s), blue/Slow (15s), making the brick ready while
preserving other attributes, spent state, and merged geometry.
Matching-color contacts neither activate the brush nor spend uses or refresh
cooldowns. Goal and Cinder contacts do not spend uses. Springs and Portals count, but
continuous contact does not. New brush pickups replace the held brush and uses.
The brush floats beside Koshi with its remaining count. Saw Blade takes priority;
Ditto Stamp acts before paint. Random and reserved spawns and item spawners
use Ditto Stamp's clearance from all brick parts; explicit editor placements
keep their markers. Optional lifetimes are supported. Pause freezes gameplay,
and restart clears paint and restores bricks. All nine are available for custom
levels and spawners without changing the built-in campaign.

Sword icons share the
weapon colors: brown wood, dark green patinated bronze, silver, and gold.
Gameplay swords also have thin dark outlines around the blade, guard, and handle.

Boost bricks display an orange-filled fireball with a dark outline and a
red-orange ember glow. Resting against a Boost brick makes Koshi's next successful launch twice as
fast. A fireball surrounds him and defeats robots without spending equipped
sword charges. Stopping or successfully selecting another brick ends the
boost; rejected selections, Spring bounces, and Portal travel do not.

## Soccer

A **Soccer Ball** is an ordinary black-and-white ball with pentagonal patches.
It is a neutral object, not an enemy or pickup. Koshi kicks it by bumping into
it while moving; an off-center bump changes the kick direction. The ball rolls
and bounces off bricks, enemies, Barrier fences, obstructions, bumpers (which
change its speed like Koshi's), bubbles (without popping them) and other soccer
balls. Boundary gaps and collision
push-outs cannot send a ball behind the enclosing bricks; escaped balls are
returned inside. Goal openings still admit scoring shots.
When Koshi kicks a ball wedged near two corner walls, the kick and separation
are directed inward so he can push it back into play without getting behind it.
Stationary balls do not move on their own, and goal openings remain unaffected.
Friction reduces its
speed by 100 game units/second each second until it comes to a complete stop. Kicks
are capped at 650 units/second; rebounds from enemies preserve 80% of the
normal relative speed. Balls do not damage enemies or Koshi. Swords, Boost,
sleep and fear do not affect them.

A **Goal** is an unclickable, immutable boundary brick, like Cinder, drawn as a
top-down soccer goal with white netting and a silver frame. Its opening faces
the board. Koshi and enemies still collide with it. It cannot have modifiers
or surfaces, cannot be absorbed by Warped bricks, and cannot be changed or
copied by Saw Blade or Ditto Stamp. It may combine only with other Goal bricks.
When a ball's center enters through the opening with clearance from both posts,
the ball disappears in a sparking cloud and adds one to **Goals**. Wide shots
reflect from the frame.

Custom levels can set `goalsGoal` to the number of scores required, alone or with
food (`goal`) and enemy (`killGoal`) targets. All positive targets must be met
before time runs out. Survival remains exclusive. The editor supports Goals
and scheduled soccer balls (`kind: "object", type: "soccer-ball"`), including
ball spawners. Balls have no lifetime or shield. The editor also supports
stationary red, green and blue bumpers as objects and brick spawners. Bumpers
bounce Koshi and enemies without moving; red increases Koshi's speed by 25%,
green preserves it, and blue reduces it by 25%. Their concentric white rings
compress and shake briefly when hit. Pause freezes rolling/scoring effects;
restart clears scores and restores placements. The guide and tutorial include
soccer. Level 2-19 requires three goals and supplies five balls; the original
19 levels remain unchanged.

## Enemies

**Robo Jackolantern** (`jackolantern`) is an orange pumpkin robot with grey
mechanical eyes, a yellow carved nose and mouth, and an antenna instead of a
stem. It wanders at 32 game units/second, pauses for a 0.5-second warning, and
stomps every four seconds. A square ring of fire grows continuously from that
fixed stomp location at 120 game units/second. Fire contact costs Koshi one
heart, respecting normal invulnerability. Only bricks and Barrier fences stop
the waves: intercepted portions disappear permanently, while other portions
keep expanding. Enemies do not block fire. Sleep freezes the attack and waves;
fear suppresses stomps and fire damage while it flees. Defeat extinguishes its
waves. Its nose and mouth dim grey, its antenna breaks in half, then it bursts
into pieces and fades over 1.2 seconds. It supports shields, swords, Boost,
editor placements/spawners, custom cutscenes and guide practice. Level 2-23
introduces it with Barrier fences; the original 19 levels are unchanged.

**Robo Snake** (`snake`) follows the inner perimeter like a Wheel at 95 game
units/second. Its four grey segments consist of a yellow-eyed head with black slit
pupils and a periodically
extended red forked tongue, followed by panels with large white spikes outlined
in black. The panels also feature a simple grey plus, thin oval buttons and
unlettered red circular buttons. Large symmetric grey shapes and red stripes
decorate the segments. The tongue is drawn underneath the head shell so it
emerges from beneath the top of the head.
Only the head accepts sword or Boost hits and shield downgrades. The three body
segments always damage Koshi on contact, even during sleep, fear or the snake's
shield invulnerability; Koshi's usual one-second damage immunity still applies.
Sleep freezes movement; fear sets perimeter movement to 64 game units/second.
Every segment blocks other enemies and soccer balls and stays inside the bricks,
with Barrier fences blocking the entire snake. On defeat the four segments fall
apart and fade over 1.2 seconds while the detached tongue spins away.
Custom placements snap to the perimeter; editor spawners, portraits, the guide
and an interactive head-interception lesson support it. Level 2-17 introduces
head interception; the original 19 levels stay unchanged.

**Robo Snail** (`robo-snail`) wanders continuously at 85 game units/second,
slightly faster than Robo Mouse, without the Mouse's resting pauses. Its green
body has two robotic antennae ending in red square eyes and a rigid frown, with
a blocky grey-and-brown spiral shell. When defeated, the antennae shrink first,
the body retreats into the shell, then the shell splits and fades over 0.9
seconds. Defeating it freezes every brick's cooldown for 20 seconds and shows a
scrolling slug-and-turtle ribbon. Cooldowns already counting down resume after
the freeze; bricks hit during it start their cooldowns when the freeze ends.
It supports custom placements, spawn bricks and cutscenes; built-in campaign
levels and schedules remain unchanged.

**Robo Ball** (`ball`) is an orange robot basketball with dark grey stripes,
two beady red eyes and a rectangular mouth whose grey grate resembles teeth.
It bounces around in straight lines at 120 game units per second, rebounding
from bricks, barriers and other enemies while remaining inside the arena.
It has no pauses, targeting or attacks beyond standard contact damage.
Shields, swords, Boost, Music Box sleep and Spooky Mask fear work as for other
robots. When defeated, it shrivels up, its eyes pop into the air, and it fades
away over 1.1 seconds. Pause freezes this animation. Robo Ball is available in
the editor, enemy spawn bricks, cutscenes and guide practice. Level 2-10 introduces
its bouncing movement; the original 19 levels are unchanged.

Barrier bricks are an exclusive brick surface introduced in Level 2-22 and
available for custom levels.
Successfully selecting one extends a dark green semi-transparent fence at
180 game units per second from the center of its arena-facing surface,
perpendicular to that surface, until it touches another brick or barrier.
Selecting it again after its normal cooldown retracts the fence at the same
speed. Koshi moves through freely; enemies and flying Bucket bombs bounce or
reverse, and Wheels stay on their boundary route. A matching fence icon marks
the brick. Growing fences push enemies toward safe positions inside the
enclosing bricks, never outside the arena, including at endpoints and corners.
Pause freezes extension/retraction; restart clears fences. A fence
disappears when its owner loses the surface, is destroyed, or is absorbed;
merged owners use their current combined surface center. Level 2-23 also uses
fences to block Jackolantern fire.
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

### Campaign: The food rescue

The old five levels were replaced by 19 lessons, then extended to 34 and then 48, plus
12 optional challenge levels in World 3S (60 in total). The complete level names,
concept order, durations, and victory targets are listed in the
[campaign table](./README.md#how-to-play-and-interactive-tutorial).
Food-only, enemy-only, combined, and survival missions all use the same engine rules.

Each level introduces one concept in this order: normal red/blue/green bricks,
Robo Mouse, swords, hearts and heart cost, Crumblers, slime, enemy shields,
Spikes, Robo Wheels, Springs, Conveyors, Warped bricks, Robo Rams, Boost,
Spawners, Robo Buckets, Cinder, Toggles, Portals. The appended lessons introduce
Robo Ball, Smiley Cookie, Stopwatches, Battery, Music Box, Eggplant, Saw Blade,
Robo Snake, Magical Sunglasses, Soccer Goal and Ball, Ditto Stamp, Spooky Mask,
Barrier blocks, Robo Jackolantern, and Boom Helmet with Boom Times.
Returning mechanics are
chosen for useful combinations rather than including every earlier brick style.
The original layouts have at most six distinct styles and always retain ordinary steering
bricks. Their 26 boundary segments form 21 starting blocks: 17 standard, three
double (14.3%), and one triple (4.8%). Desktop and portrait use the same groups.

The original 19 missions include all seven foods. Food patterns use three-item lines,
circles, and scattered groups, plus a single hamburger. Level 1-1 has appearances
at 3, 11, 19, 27, 35, 43, and 51 seconds; later levels distribute their seven
appearances from 3 seconds through nine seconds before the time limit.
The total scheduled food value is 70 points. Level 2-5 also has two single-use
hamburger-spawning bricks, bringing its possible food value to 84.
Hearts are disabled before 1-4. Thereafter the heart cost is
`ceil(total possible food points / 5)`: 14 normally, 17 in 2-5.
Even collecting all scheduled and brick-spawned food generates at most five hearts.

Swords first appear in 1-3, after its first enemies: wood at 20 seconds,
bronze at 38, silver at 58, and gold at 76. Later unshielded combat levels supply
silver 12 seconds after their first enemies and at 60% of the time limit.
Shielded enemy-goal missions budget the target plus 50% spare attacks (at least
five), plus the strongest shield's possible unfinished damage, rounded up to
whole silver swords. They arrive evenly from 12 seconds after the first enemies
until 25 seconds before timeout. Levels 2-1 and 2-2 supply three and four
silvers respectively, leaving room for shield hits that have not yet earned points.
Food-only and survival levels provide just one bronze, 14 seconds after their
first enemies, except 1-10, which provides a silver at 28 seconds.
Level 2-7 provides five silvers at 24/48/65/82/105 seconds for 25 attacks.
Main sword supplies are separated by at least 16 seconds. Enemy-goal levels after
1-10 without Boost bricks add two spare bronze swords at one-third and two-thirds
of the time limit (40/80 seconds in 2-1, 2-2, and 2-3), preserving their silver schedules.
The Boost introduction in 2-4 is the exception: no weapons are supplied;
its 12-enemy-point target must be met using Boost launches, with an extended
140-second limit.
Special-brick introductions provide at least three separate instances away from
corner segments. Three of four larger starting blocks (75%) use the introduced
feature: two doubles and one triple; the fourth larger block stays ordinary.
Returning features remain on separate bricks. Level 2-9 uses four portals
in purple and orange pairs, with three endpoints on larger blocks. All exits
are clear of walls in desktop and portrait play.
Enemy waves are larger after the enemy-free first level. Shielded enemies start
in 1-7, with roughly 35-63% of scheduled robots shielded from then onward.
Red shields start in 1-7, green in 2-2, and blue in 2-8. Later missions use
more shields and stronger colors. Defeat targets count enemy points, not raw
robot counts; targets, sword supply, and spawn timing are unchanged.

All levels begin with story cutscenes about Koshi saving the world and its meals
from Tom's robots. The first scene introduces Tom the Duck without showing any
combat robot. Each campaign scene includes Koshi and at most three enemies
including Tom; speaking robots take priority in the smaller cast. Each later
scene uses only enemy types actually in that level, never future enemies.
Level 2-9 pairs purple Portals with Boost and Toggle routes to reclaim a feast,
before Tom reveals the deeper pantry reserves in the new lessons.
Levels 2-10 through 2-24 each explain their new element in a cutscene and use at
most five distinct brick styles. Each has three larger blocks: either three
size-2 bricks or two size-2 bricks and one size-3 brick. Desktop and portrait
share the same groups. No absent robots appear in the cutscene cast.
Each added lesson includes two previously introduced special brick mechanics,
chosen for that challenge rather than accumulating every earlier feature.
The returning types, enemy counts and sword times are listed in the
[campaign difficulty table](./README.md#controls-and-rules).
All added lessons now include robot patrols; existing waves are at least 50%
larger and include red shields. Food-only and soccer objectives remain unchanged.
Scheduled swords appear at least ten seconds after the first enemy wave.
Enemy-score lessons supply the target plus 50% spare attacks (at least five),
plus one unfinished red-shield hit, rounded up to silver swords.
The Battery and Saw challenges keep their required dispenser and Boost routes
instead of adding loose weapons.

The Goal and Barrier introductions have three independent copies, all away
from corner segments, with large copies among them. These two lessons use only
green/red plain cooldown bricks so the new type and two returning styles still
fit the five-style cap. Other new lessons retain blue/green/red plain bricks.

Level 2-12 begins with just 18 seconds and requires 35 food plus 3 enemy points.
Red, green and blue Stopwatches add 10, 30 and 60 seconds; red starts beside Koshi.
Level 2-13 requires 12 enemy points with one silver-sword spawner (5 attacks
per weapon), three Batteries and no other swords or Boost bricks. Its 24 mice
start arriving at time zero, before the first sword can be reached. Leaving
and revisiting the spent dispenser with a battery is required to win; four
total swords offer 20 attacks, including a reserve for shield mistakes.
Level 2-15 requires 35 food points; three Eggplants can subtract 10 each, with
enough food remaining to recover from all three mistakes.
Level 2-16 supplies Saw Blades and three Boost bricks, but no weapons or weapon
spawners. Preserve Boost routes and use boosted launches to earn 6 enemy points.
Level 2-19 is food-free: dodge eight mice/wheels and score 3 soccer goals using
five balls and three wide goals (two size-2 and one size-3), with Spring and
Conveyor routes. Enemy defeats are optional; defensive swords appear later.
Level 2-24 starts with 6 helmet charges and requires
35 food points. Its first blue Boom Time is beside Koshi; red, green and another
blue appear later. Charges must be collected before the helmet reaches zero.
Campaign progress uses a new save key; old five-level saves remain untouched
and cannot skip these new lessons. Existing 19-level saves retain all their
completed levels and resume at 2-10, using the same current save key.

### World 3: Robot Foundry

Tom the Duck opens World 3 in Level 3-1 by revealing himself as the master of the
Robot Foundry, where every robot is built. Koshi vows to shut the factory down,
save the world, and taste every snack along the way. Each level introduces one
concept in this order: Robo Goalies, Paintbrushes, Kitty Cape, Laser Turret,
Obstructions, Robo Snail, Bumpers, Bubbles, Fireball Turret, destructible
Obstructions, appearing Obstructions, Robo Cows, Robo Unicorns, and Robo Koshi. Every
cutscene explains its new concept within that story and shows only Koshi, Tom,
and robots that are both already introduced and present in that level.

- 3-1 requires 5 soccer goals; Robo Goalies spawn before the first ball.
- 3-2 delivers blue (Slow) brushes first and red (Fast) brushes later.
- 3-4 has 26 robots, Laser Turrets and four Batteries.
- 3-10 has exactly one Fireball Turret, two Batteries, and two TNT obstructions.
- 3-11 is the first level whose obstructions appear during play.
- 3-12 supplies one wood sword; three Boost bricks earn its enemy target.
- 3-13 has a food target, spawns unicorns before food, and adds Eggplants.
- 3-14 introduces Robo Koshi, which spawns first and retraces Koshi's path, so the
  player must avoid doubling back while collecting 30 food and 4 enemy points.

Objectives vary among food, enemy and soccer-goal targets (alone or combined) and
survival. Each layout has 21 starting blocks: three doubles (14%), one triple (5%)
and 17 standard blocks, with slow and fast steering bricks mixed in. Shields are
rare: ten red, two green and one blue shielded spawn across the world. Heart
cost is `ceil(total possible food points / 5)`, so at most five hearts appear.
Each level reuses one to four earlier brick types and one or two earlier items
or objects. Placed food, weapons and items stay clear of the obstruction spots
in desktop and portrait play.

### World 3S: Tom's Gauntlet (optional challenge)

World 3S branches from World 2 (`next: ['3', '3S']`) for advanced players; the
main path still continues to World 3, and save-slot **Continue** never requires
World 3S. Level 3S-1 introduces Tom the Duck for players who arrive before
World 3. The 12 levels combine any existing elements, and every level uses a
distinct mix of robots, bricks, items and objects. Every cutscene shows only
Koshi, Tom and robots in that level, and explains the level's combination.

- Difficulty: robots always arrive before the first weapon or power-up, though
  every level then supplies four to six swords. Shields
  are more common than in World 3 (red, then green, then rarest blue). Heart
  cost is `ceil(total possible food points / 4)`, so at most four hearts appear.
- Objectives are balanced: soccer goals in seven levels, food in six and enemy
  points in six (single, paired and one triple target, 3S-10). There are no
  survival levels.
- Each level declares its own groups of standard, double, triple and quadruple
  blocks (some forming corner L-shapes), plus its own slow/fast colors.
- Soccer balls appear only in levels with a goal objective. Every level with
  Robo Jackolanterns (3S-4, 3S-9, 3S-12) has at least one Barrier brick.
- Levels with static bumpers, bubbles or obstructions place those objects on the
  four quadrant spots and place all food, weapons and items elsewhere.

| Level | Name | Objective | Featured combination |
|-------|------|-----------|----------------------|
| 3S-1 | Goalie gauntlet | 6 goals | Goalies and Robo Cows, two goal mouths, bumpers |
| 3S-2 | Unicorn smorgasbord | 60 food | Robo Unicorns, snakes, Eggplants, hamburger spawner, portals |
| 3S-3 | Laser lockdown | 22 enemy | Two Laser Turrets and a Fireball Turret, Robo Snails, toggles |
| 3S-4 | Bubble bend-it | 4 goals, 30 food | Bubbles and bumpers around a side goal, Jackolanterns, a Barrier |
| 3S-5 | Copycat penalty kicks | 4 goals, 8 enemy | Robo Koshi, goalies, portals, Ditto Stamp |
| 3S-6 | Cinder stampede | 35 food, 8 enemy | Robo Cows eating two Boost bricks, barriers, Saw Blade |
| 3S-7 | Obstacle cup | 5 goals | Fixed, TNT and appearing obstructions, Fireball Turret |
| 3S-8 | Boom helmet bakery | 50 food | 8-charge Boom Helmet, Boom Times, Robo Snails, Sunglasses |
| 3S-9 | Jackolantern junkyard | 14 enemy | Jackolanterns, barriers, large obstructions, gold sword |
| 3S-10 | Grand slam | 3 goals, 6 enemy, 30 food | Unicorns, goalies, Robo Koshi, sword spawner, bubbles |
| 3S-11 | Turret derby | 4 goals, 12 enemy | Robo Cows threatening Laser Turrets, goalies, bumpers |
| 3S-12 | The duck's last stand | 4 goals, 40 food | Robo Koshi, unicorns, Jackolanterns, a Barrier, appearing walls |
