# Koshi's Quest

A browser arcade game starring Koshi, a grey tabby with a big appetite.
Built with vanilla JavaScript, HTML, and Canvas. No runtime dependencies are
required; Official JSON levels are bundled using Node.js. The initial implementation follows
[the game description](./game_description.md), with 49 main campaign levels across three worlds,
12 optional challenge levels in World 3S, and 14 levels in World 4.

## Play locally

Double-click [index.html](./index.html) to open the game directly in your browser.
No server or installation is required to play the checked-in generated campaign.
After changing Official JSON levels, use the local server below or run
`npm run build` before opening the files directly.

Alternatively, install Node.js 24 or newer, then run:

```sh
npm start
```

Open <http://127.0.0.1:4173>. On Windows, use `npm.cmd start` if PowerShell
blocks the npm script. Both direct `file://` access and HTTP hosting are supported.
The server regenerates the Official bundle at startup and on game/editor page
refresh, so edits to published JSON files appear without restarting it.

## Publishing Official levels

1. Export a level from the editor to `levels/official/`, usually under its world
   folder, for example `world-1/1-2.json`.
2. Add an entry to [campaign.json](./levels/official/campaign.json):

   ```json
   {
     "file": "world-1/1-2.json",
     "worldId": "1",
     "number": "2",
     "id": "official-1-2"
   }
   ```

3. Refresh the game or editor served by `npm start`. Existing manifest entries
   need no changes when you edit their JSON content.
4. Run `npm test`, then commit and push the JSON, manifest, and regenerated
   bundle to publish. GitHub Pages runs generation and validation before testing
   and deploying, including the bundle in the offline cache.

Only manifest-listed files are published; other JSON exports remain drafts.
Paths are relative to `levels/official/` and use `/` separators. `worldId` must
identify a playable Official world (for example `1`, `S1`, or `9`).
`number` is the displayed level number within that world, stored as a string.
The JSON's `id` is the editor's level name; the manifest's `id` is the permanent
save identity. Keep that permanent ID unchanged when renaming or moving a level,
and update only `file` when moving its JSON. Level names, permanent IDs, source
files, and world/number pairs must be unique. Numeric level numbers sort
numerically within a world; other number strings follow manifest order.

The first published level in a world replaces that world's temporary starter;
worlds without authored levels retain their existing starters. Preserve a
starter's `official-<worldId>-1` ID when replacing its first level to retain
progress. Cat Town remains a scene hub and cannot receive level entries.
Beta content is unaffected.

`npm run build` validates all listed files using the editor/game schema and
generates [official-levels.generated.js](./src/official-levels.generated.js).
Do not edit that bundle manually. It is checked in to support direct `file://`
play; the JSON and manifest are the sources of truth. Invalid JSON, missing
files, duplicate identities/numbers/names, and invalid worlds stop generation
with a file-specific error and leave the last generated bundle intact. The
local server reports the error instead of serving a successful stale refresh.
On Windows, use `npm.cmd run build` and `npm.cmd test` if needed.

You can also ask Copilot to "update the Official levels from the latest JSON
files" or invoke `/sync-official-levels` where skill slash commands are supported.
The repository's [sync-official-levels skill](./.github/skills/sync-official-levels/SKILL.md)
guides validation, regeneration, the full test suite, and review, then commits
with an automatically generated `Adding levels X, updating levels Y in official campaign`
message and pushes to production (`origin/main`). Every required check must
pass before committing or pushing; the workflow verifies the matching GitHub
Pages deployment before claiming the live game is updated. Use "local only",
"do not commit", or "do not push" to override those steps. Unlisted files remain
drafts unless explicitly approved for publication, and unrelated changes or
unpushed commits are not silently included. Skills must be enabled and discovered by the
Copilot environment; the build/test validation does not depend on skill loading.

## Beta and Official games

Only the title screen offers a **Beta / Official** selector. The world map and
editor retain the selected game without offering a separate switch.
Both campaigns share the gameplay engine, graphics, mechanics, and tutorial.
**Beta** contains all existing worlds and levels, unchanged. **Official** has
18 map destinations and 17 playable worlds. Official **1-1**, **Beginner's
Breakfast**, uses the authored source in `levels/official/world-1/1-1.json`:
collect 20 food points in 50 seconds, with a Cat Block spawning at 15 seconds,
the opening dialogue, Steering Bricks hints, and authored brick colors.
Its manifest entry preserves the `official-1-1` save ID; JSON changes are
automatically bundled for local refreshes and deployment.
The other 16 playable worlds retain temporary level 1 starters;
Cat Town remains a scene hub rather than a traditional level. Each starter has
one Cat Block at time zero and a 10-second survival objective, ready to be
overwritten as the Official levels are authored. The remaining eight numbered-world
starters each open with Koshi saying "Hello world!" against that world's
cutscene background; the special-world starters are unchanged. Official levels use the color
of their world for the game's console-style framing. World and named level
definitions live in `src/campaign.js` as `OFFICIAL_WORLDS` and
`OFFICIAL_LEVEL_DATA`, separately from Beta's content.

Official worlds 1-8 form a regular octagon, numbered clockwise from the left
vertex, with routes 1-2 through 7-8. Optional bonus/challenge worlds S1-S8 sit
outside each side's midpoint, each connected only to its matching primary
world, using a darker version of its color. World 8 connects to World 9,
Robot HQ, at the center. Cat Town (C) is outside the octagon to the left,
collinear with Worlds 1 and 9, and connected only to World 1.
The map keeps a square canvas so the octagon remains regular at every screen
size; desktop overviews fit the available space, while phones support panning
and zooming. Cat Town opens its four-location scene hub. Any
other world without levels shows its name and a no-levels notice, with Play
unavailable. Empty worlds never count as completed.
Official world emblems are pixel silhouettes: tree (1), fish (2), water drop (3),
cactus (4), snowflake (5), crescent moon (6), lily pad (7), volcano (8), robot
head (9), and cat head (C). Each S world uses its primary world's emblem.
In both campaigns, flag, star, and Cat Block totals stay at the top right of the
map dialog, aligned with the World Map heading, outside the scrolling map.
Beta and Official level selection use the same renderer, responsive map/details
layout, level-node sizing, and textured block styling. Both world and level
selection fill the browser viewport with an opaque background, hiding prior
gameplay while the map is open. The Official square-map
settings apply only to the world overview, not to the levels inside a world.
Official level maps tint their background, textured nodes, and routes with the
associated world's color. Gameplay uses bolder world-colored outer framing and
menu-edge accents while keeping text areas subdued and the board artwork and
steering-brick colors unchanged.
The opaque console accents use a darker shade of each world color. Cat Town
keeps its full-screen backgrounds but moves actors inside the visible stage
when phone or wide-screen cropping would otherwise hide them.

Switching reloads the same page in the selected game.
The title recommends Beta for playtesting while Official is selected and reserves
the same notice space in both modes so its controls do not jump when switching.
Startup hides the gameplay surface until the menu is ready;
supporting browsers use a brief cross-document transition (disabled for reduced motion).
Each game remembers its
own save slots, statistics, collectibles, cutscene preferences,
and map selection when switching. Guest progress remains session-only.
Existing saves, draft storage, and stable level IDs continue to belong to Beta;
Official uses separate browser storage, even if future levels use matching IDs.
Unsaved campaign results block switching until saved or explicitly discarded.
An active run requires confirmation before it is ended by a switch. Editor
switching warns about unsaved levels; print JSON and save it manually before switching to keep it.

Use `index.html?game=beta` or `index.html?game=official` for explicit game links;
the same query works on `editor.html`. Without a query, the game always opens
in Beta, regardless of the previous selection. Old `#campaign=...` links without a game query always open
Beta. Editor playtest and return links include the selected game automatically.
Custom playtests and tutorial attempts do not contribute to campaign progress.

## Controls and rules

The title screen features original artwork of a sword-wielding Koshi facing
Robo Mouse and Robo Wheel among green, blue, and red bricks. The green main
button reads **Continue as [owner]** when a campaign save exists and resumes the
most recently played slot (opening its level map as **Continue** does). With no
saves it reads **Start adventure** and opens world selection for a guest
adventure (initially World 1). The title has no separate level-select button.
New Official saves and the first Official guest adventure in each session play a
three-scene narrated prologue: a sunny town, Tom's ruined city under green rain,
and Koshi asleep in his bed. The screen fades to black, pauses, and fades into
the prologue, then repeats the transition into world selection. Use Continue
to reveal text or advance, or Skip scene/Escape to go to the map. Reduced-motion
preferences remove the fades and scene animation. Continuing an existing save,
Beta adventures, tutorials, and custom-level playtests do not play this prologue.
Escape on the title opens the map rather
than bypassing selection. Custom-level playtest links and the
`#install` troubleshooting link bypass the title. The artwork is bundled for
offline and direct-file play.
Every level opens with a clear objectives popup and a large **Start** button;
the level clock and objects remain frozen until Start is pressed. The HUD puts
**Time left** centered above **Koshi's Health**, replacing the in-game logo. The evenly
spaced tracker row is **Koshi's Health**, **Food**, **Enemies**, **Batteries**,
**Goals**. An equipped sword appears beside Koshi with its remaining hit count.
Beside the level number, Gold Star and Cat Block outlines remind players of
uncollected rewards; rewards earned on previous winning runs are filled.
An unowned star glows while the current run remains damage-free, and an unowned
Cat Block glows after collection or whenever its achievement condition would
be satisfied if the level ended now. The glow updates as conditions change,
including score thresholds, move/time limits, pickups, and the current brick
layout; these remain provisional until victory. This indicator does not award
the block early or change the existing inclusive move limit.
Losing removes the provisional glow. Levels without a Cat Block omit its icon.
Both provisional rewards use the same gold glow; the Cat Block's brighter,
thicker outline matches the star's glow.
The opening objectives omit Cat Block instructions and artwork when already owned.
Moving between the main menu, story scenes, and gameplay uses a horizontal
black sawtooth wipe: cover the old phase, change screens while fully black,
then sweep onward to reveal the new phase. Tutorial entry/exit uses the same
transition. Input and gameplay clocks are frozen during the 2.1-second wipe.
Reduced-motion mode changes screens immediately.

### Optional level information

The editor's **Optional level information / tutorial** section lets authors
enable an introduction, add/remove/reorder pages, and choose existing game
component artwork. Each page has a title, explanation, and up to six graphics.
The component list includes blue (Slow), green (Normal), and red (Fast)
**Steering Bricks**, plus separate colors of slime, bubbles, and each paintbrush
type. Select multiple variants to show them together on a page.
Steering-brick captions break after "Brick" so each color's cooldown details
start on the second line. The focused page heading has no browser-default outline;
navigation buttons retain their keyboard focus indicators.
Click **Apply information** before saving, exporting JSON, or playtesting.
Disabling the section and applying removes the information from the level.
Campaign levels remain read-only in the editor; use custom levels for authoring.

Information appears after any opening cutscene and before the objectives.
Small left/right arrows beside the page counter browse pages; **Close** or
Escape proceeds to objectives. Nothing moves
and the level clock stays frozen until the objectives' **Start** is pressed.
Campaign information appears automatically on the first visit for the selected
save slot in this browser; closing marks it viewed for that save only.
Beta and Official keep separate viewed records, and changing the information
shows it again. Replacing a deleted save does not inherit its viewed records.
Unsaved play always treats information as unseen, including on restart.
Old browser-wide viewed records are ignored. **Tips & Hints**
on the objectives allows replay. Custom playtests always show it for testing.
No existing campaign levels have been given information pages automatically.

Version 1 level JSON optionally includes:

```json
"levelInfo": {
  "pages": [
    {
      "title": "Meet the spring brick",
      "text": "Spring bricks launch Koshi farther. Plan your landing!",
      "graphics": ["brick:springs", "food:S"]
    }
  ]
}
```

Use 1-20 pages, nonblank titles up to 80 characters and explanations up to
2,000 characters. Graphic identifiers come from the editor's component list
(`KoshiGame.INFO_GRAPHICS`); graphics may be omitted for text-only pages.
Information survives JSON printing/loading and playtest links.

### Worlds and the map

World 1, **Garden Path**, contains 10 levels (1–1 through 1–10). World 2,
**Clockwork Pantry**, contains 25 (2–1 through the boss fight at 2–25). World 3, **Robot
Foundry**, contains 14 (3–1 through 3–14). Their leaf, gear and robot-head
emblems and map colors establish their graphical themes; gameplay graphics
and all existing level content are unchanged. World 3S, **Tom's Gauntlet**, is
an optional challenge world for advanced players. It branches from World 2 on a
dashed route below the main path and contains 12 levels (3S–1 through 3S–12).
World 4, **Rolling Road**, connects directly from World 3 and starts with
**4-1, The rolling buffet**, a three-minute autoscrolling survival level,
followed by 13 new mechanic lessons through **4-14**.

Only the world overview offers **Back to menu**. Escape from level selection
returns to the world overview first.
The high-level map shows one stop per world. Click a world to move Koshi's
marker; clicking the world Koshi is already on zooms into its individual level stops.
World stops show a flag, star and Cat Block icon. The flag fills when all levels
are completed, the star when all gold stars are earned, and the Cat Block when
all available Cat Blocks in that world are found. The overview omits the world
detail panel and centers the map.
Click a level to move Koshi and see its number, name, objectives, time limit,
Boom Helmet activation limit when applicable, fastest winning time, fewest moves, highest food
and enemy points, win/loss/quit totals, and win percentage (wins divided by all
counted attempts, including quits after more than five seconds of play; N/A before any counted attempts).
Boss levels have skull-shaped stops. Objectives use food, enemy and soccer-goal icons
with their numerical targets, or just a clock for survival. Select an objective icon
to see its explanation. Small labeled illustrations
show the enemies, blocks, foods, weapons and items actually included, including
spawner contents. These features are grouped into Bricks, Enemies, Food and
Items / Objects; each group's rows fit as many illustrations as the available
panel width allows, with two per row on typical phones and more on wider screens.
Each level detail shows a gold star at the top right when any
win was completed without taking damage; otherwise it shows the empty outline.
The star remains earned when the level is replayed, and earned stars also appear
at the bottom-left of their level stops on the zoomed-in map. **Play Level**
starts that selection; **World Select** returns to world selection.
Levels that offer a Cat Block show its icon beside the star. These detail icons
stay in fixed positions as levels change, independently of title length.
Hover or focus the star or Cat Block icon for its collection hint,
or click/tap the icon to keep the hint open. Hints float above the details content
without moving the objectives or statistics. Only one hint opens at a time.
Press Escape to dismiss it.
The pre-level mission briefing lists only
active victory targets with emojis. Each target supports click, touch, hover,
and keyboard focus to show the same explanation as the level-selection map;
Explanations appear beside their associated item, constrained horizontally to
the containing frame, and follow scrolling. Escape dismisses the explanation.
Where applicable, a centered Cat Block image
appears below them with the same `To earn Cat Brick: ...` objective as the editor
and map, including when the Cat Brick has already been acquired.
Uncollected stars and Cat Blocks use outlines with the same shape, size and
position as their collected artwork, both beside map stops and in level details.
Cat Block outlines follow the artwork's alpha silhouette. Cat Blocks are omitted
from Level Features because their availability is already shown beside the star.
Each World 1 level offers one Cat Block. In **1-3 (Cutlery uprising)**,
**1-6 (Sticky jam depot)** and **1-9 (Meals on wheels)**, defeat the marked enemy
in the first patrol and collect its dropped block. In **1-4 (A hearty harvest)**,
open the center chest (appearing at 50 seconds) with three keys: one spawns at
20 seconds and one mouse in each existing 12- and 35-second patrol carries a key.
Defeat the key-marked mice and collect their drops. The chest has no expiry and
stays until opened or the level ends. In the other six levels,
it appears at a random location halfway through the level.
Save slots remember collected Cat Blocks by level. The world-selection map and
each save slot show icon-only completion-flag, gold-star and Cat Block counts against the totals
available across the campaign.
Cat Blocks are kept only when collected during a run that ends in victory.
Opening a chest animates its lid and lifts the Cat Block before the normal
pickup pop. Keys and enemy key badges use bright opaque yellow artwork.
Victory results show a centered Cat Block reward when newly collected that run.
Losing, restarting or leaving before victory forfeits the block; damage alone
does not forfeit it. Blocks and completion results save together.
Each Cat Block can be kept only once per profile: replays omit its pickup,
carrier badge and treasure chest after collection. Guest discoveries last for
the current visit; editor playtests remain independent. Carried blocks track
their enemy at a fixed offset without bobbing, using the same unframed artwork
as collected map icons and the in-game pickup.
The world-selection overview fills most of the desktop screen and fits the
complete map inside its pane. On phones it fills the screen: drag with one finger
to pan from the map background or a world stop and pinch with two fingers to zoom,
without visible scrollbars. **Zoom in**,
**Zoom out**, and **Fit map** buttons control the overview on phones and desktops.
On desktops, Ctrl+mouse wheel (or a trackpad pinch) zooms only the map, not the
browser page; ordinary wheel scrolling and drag panning remain available.
The zoom buttons show a plus or minus inside a magnifying glass. Zoom is
limited between fitting the whole map and 2.5 times its original size; dragging
does not select a world. These controls apply to both Beta and Official.
The level map and details retain their viewport-relative panes; longer content
scrolls inside its pane. Both phone map views are centered.
Cat Town's location map fills its viewport independently of the overview zoom container.
While the world or level map is open, the hidden game's simulation, HUD updates,
and continuous canvas rendering are suspended. Koshi's map movement uses
transform animations, including intermediate level stops, without per-frame layout.
Level numbers stay on one line. **World Select** and
**Skip cutscene** share the bottom action bar with **Play Level** when a level
is selected; **Back to menu** appears there on the world-selection view.
When a level with a cutscene is selected, **Skip cutscene** replaces **Back to
menu**. Cutscenes play on first visits for the selected save slot and default
to skipped after being viewed by that save; restarting a saved level does not
replay its cutscene unless skipping is disabled. Viewing is isolated by save
identity and game (Beta or Official), including after a save is deleted and
replaced. Unsaved play and custom playtests always treat cutscenes as unseen
and show them again on restart, regardless of the skip checkbox.
Back to menu or Escape cancels without changing the current gameplay level.
Mouse, touch and keyboard activation are supported, with reduced-motion support.
Level selection remains unrestricted for practice.
New games must select a world and then a level before gameplay. After the
victory celebration, a results popup compares completion time, food, enemy
points, soccer goals and moves with the previous records.
New records highlight the value in gold with a smiling-cat marker; a legend
explains the marker. A damage-free win awards the gold star. Continue opens the level map, and Koshi
walks from the completed stop to the next level. Crossing a world
boundary shows the previous world's completed stop as an entry connector on
the next world's map. Play still requires **Play Level** and the briefing's
**Start**. After the final level, Koshi stays on that completed stop. Retrying
a loss or restarting the same level still opens its briefing directly.
Completed levels and fully completed worlds display waving golden flags;
reduced motion keeps flags and Koshi still.

World definitions in [src/campaign.js](./src/campaign.js) give each world a theme,
explicit `next` routes, and an ordered `levels` mapping from displayed numbers to
named level data. For example, `'1-10': 'Pancake trampoline'` assigns that named
level to that stop. Move or rename a stop by editing these mappings, not the
level's gameplay data. Mapping insertion order defines the path through a world;
the world array defines campaign order.

The engine exports `LEVEL_DATA`, a catalog keyed by level name, without world
membership or displayed numbers. Its fixed `id` values are legacy save identities,
not level positions: never change them when moving or renumbering a level.
`assembleCampaign` resolves the mappings into the runtime `LEVELS` array, adding
`worldId` and `number` without changing the catalog or its layouts, schedules,
objectives, dialogue or cutscene themes. Unknown names, duplicate assignments,
duplicate numbers and invalid world routes are rejected at startup.
[src/worlds.js](./src/worlds.js) provides navigation and feature helpers for this
assembled campaign. Both the game and editor load the same definitions, and the
editor's campaign play links use fixed IDs so they survive reassignment.

Main worlds are numbered 1, 2, 3, etc. Optional worlds can use IDs such as
`S2`, `special: true`, and a branch from World 1 with `next: ['2', 'S2']`.
Add named levels to that world's `levels` mapping to make the branch playable. Dashed routes
distinguish special branches. Default next-level suggestions follow the main
path; completing a special world's levels can rejoin a main world through its
`next` route. World 3S uses `special: true`, and World 2 lists
`next: ['3', '3S']`, so finishing World 2 still suggests 3–1. World 3S has no
onward route: after 3S–12, Koshi stays on that completed stop.

Stable internal IDs and existing campaign URLs are retained for saves and editor
links: old Level 1–11 is displayed as 2–1, and old 1–34 as 2–24. World 3
continues the same internal sequence: internal 1–35 through 1–48 are displayed
as 3–1 through 3–14, and internal 1–49 through 1–60 as 3S–1 through 3S–12.
All player-facing level selectors, briefings, HUD labels and new editor play links
use the new numbers; both old and new campaign URLs are accepted.

### Campaign saves

Open **Save slots** from the title screen. There are **three
slots**, each with an owner name (1-32 characters). **Create & play** starts a
new campaign at world selection. **Continue** opens the level map inside the
world of the last level actually started, with that level selected, including
if it was lost, replayed or abandoned. No level starts until **Play Level**
and the briefing's **Start** are pressed; attempts always start fresh.
After finishing all 49 main-world levels, the slot shows **Campaign complete** and still
offers **Continue** to revisit the map. Optional World 3S levels count toward
the slot's "completed / 62" total but are not required, and **Continue** never
suggests them.

Every started attempt autosaves to the selected slot as a provisional quit,
replaced by a win or loss when play finishes; only wins mark levels complete.
The checkpoint counts as a quit only after more than five seconds of play, even if
the app is closed or terminated without an exit event.
Replaying an earlier
level never removes progress; choosing levels out of order still records each
completed level separately. Failed attempts and restarting do not erase wins.
**Save name** renames the owner without resetting progress. **Delete save**
requires confirmation and erases only that slot. **Play as guest** disables
saving for the current session and opens world selection. The most recently
continued or created slot is remembered for the title's **Continue as**
button; if that slot was deleted (or older saves have no record), the first
occupied slot is used instead. Custom levels and tutorials never change
campaign saves. Quitting, restarting or leaving a started level before a result
counts as one quit, not a loss, only after more than five seconds of play.
This rule also applies to previously recorded attempts. Briefings and cutscenes do not start an attempt.
Pausing or temporarily backgrounding the app does not end an attempt; resumed
play replaces the same provisional quit. Guest statistics are kept only for the current page visit.
All records use successful completions only: fastest time, highest food,
enemy and soccer-goal scores, and fewest moves. Losses and quits still count
toward attempt statistics but never establish or improve records.
**Fewest moves** is the smallest successful brick-selection count in a win,
including mid-flight redirects and Magical Sunglasses selections. Failed clicks,
passive travel, Spring bounces, Portal arrivals and physical brick contacts
do not add moves. Old results without move counts show **Not recorded** until
a new win records one; quitting and losses cannot improve this record.

The replacement campaign uses a separate save key, `koshi-campaign-saves-v2`.
Old five-level saves remain untouched but do not mark the new lessons complete.
Create a new slot to save progress through this campaign.
Older saves without a last-played field open at their first unfinished level
(for example, 19 completed levels resume on the map at Level 2–10).
Older completions have no historical attempt statistics; the map shows unrecorded
values rather than inventing times, scores or win/loss counts.

Saves use browser local storage, including offline play. Select a slot again
after reopening the game. Saves are specific to this browser and site; they
do not transfer between devices or between direct-file and hosted play.
Clearing site data removes them, and private browsing may not retain them.
Storage failures are shown explicitly; unsaved results can be retried with
**Retry saving progress** while the page remains open. Invalid stored data is
not silently reset or overwritten. If a slot was removed elsewhere or saving
remains unavailable, **Discard unsaved results** in **Save slots** clears pending
writes after confirmation without changing previously saved progress.

### How to play and interactive tutorial

The title screen includes two learning paths:

- **How to play** opens a ten-topic walkthrough of movement and controls,
  cooldown and special bricks, larger groups and Crumblers/Warped combinations,
  all contact surfaces, every food and item (including keys, chests and Cat
  Blocks), all 12 robots and swords, soccer balls, bumpers, bubbles, obstructions,
  spawn warnings, and objectives. Labeled pictures illustrate every brick,
  enemy, item, object, and sword.
  Choose any topic directly or use Previous/Next. **Try it in the tutorial**
  opens a related practice step. Back to title or Escape returns to the title.
- **Tutorial** opens 56 interactive practice steps on the real game board. It
  includes hands-on combat with every robot, practice for each item mechanic,
  the contact surfaces and special bricks, and bumper, bubble, and obstruction
  interactions, alongside movement, food, healing, spawn warnings, and objectives.
  An outlined brick suggests where to aim; keyboard labels identify it too.
  Completion is earned by performing the mechanic, not just visiting the page.

The tutorial selector can jump to **any step at any time**, without unlocking
earlier lessons. Previous/Next, Retry step, and Exit tutorial remain available;
the combat steps also let players try swords and hammers.
Completed-topic badges last for the current tutorial visit. Retrying resets the
arena and current action feedback while keeping those badges. Practice has no
time limit or story scenes, and a failed attempt can be retried or skipped.
The objectives practice challenge uses real victory rules: collect one food and
defeat one robot. Finish tutorial returns to the title.

The open-doorway **Exit level** button in the game toolbar pauses play and asks
whether to quit and return to the world map. **End Level** counts a quit after more than five seconds of play
and opens the world map; **Cancel** (or Escape) returns to the paused game.
Leaving a tutorial discards its practice arena and restores the selected normal
or custom level to a fresh ready state. Practice never modifies campaign levels
or editor data. The guide and tutorial work offline and through direct-file
launch. On short landscape screens and desktops, practice instructions sit beside
the board; phones keep compact controls above it without scrolling away from play.

- Click or tap the **exact spot on a colored brick** you want Koshi to approach.
- Redirect him mid-flight by selecting another available brick. Koshi stops
  when his circular head first touches any brick, including recharging bricks.
- Blue bricks recharge in **15 seconds**, green in **8**, and red in **3**.
  Their whole surface refills with color clockwise along the board boundary during cooldown:
  empty immediately after activation, fully colored when ready. Pause freezes
  the refill. Warped groups refill sequentially along their connected perimeter,
  switching between horizontal and vertical at corners rather than sweeping
  across their bounding rectangle. Exhausted Crumblers stay static with no cooldown refill.
- Each level introduces one new concept. Win conditions alternate between
  food points, enemy points, both targets, and survival until the timer reaches
  zero. The briefing and highlighted HUD counters show the required objectives.
  Food ranges from strawberries (1 point) to hamburgers (7 points).
- Most scheduled appearances have a **one-second preview at their exact spawn
  location**: a cloudy purple skull for each enemy, an expanding golden spiral
  for each sword, and a bright growing/fading star for each food item.
  Food patterns and robot waves preview every individual object; wheel previews
  sit on the inner perimeter. Previews cannot be collected or cause damage.
  Pause freezes the effects, and restart clears them. Built-in and editor levels
  use the same effects without changing spawn times or food lifetimes. Spawns
  within the first second have shortened previews; time-zero spawns remain instant.
  Obstructions and bumpers preview for **two seconds**, with the same twinkling star plus a
  dotted outline of their full shape. Bumpers also preview their three concentric
  rings as dotted circles. Scheduled times remain unchanged; early
  warnings are shortened. Obstruction- and bumper-spawning bricks reserve their location on
  contact and wait two seconds before becoming solid. On arrival, overlapping
  food, items, weapons, hearts, enemies and other loose objects are destroyed.
  Any overlap with a snake segment destroys the whole snake. These environmental
  enemy deaths award no enemy points. Koshi immediately loses all hearts and the
  level, even with invulnerability or turret protection. Non-overlapping objects
  are unaffected; existing solids retain their normal movement-blocking behavior.
- Randomly placed food, items, weapons and hearts stay at least **80 pixels** from
  other pickups on the board or queued to appear, rerolling crowded spots (the
  roomiest spot is used if the board is full). Food patterns keep their shape;
  editor-placed spawns keep their exact positions.
- Soccer balls bounce off bricks, enemies, Barrier fences, obstructions, bumpers
  (with the bumper's speed change), bubbles and each other.
- Koshi starts at rest in the center with **3 hearts**. Leaving the board
  or running out of hearts loses the level. Level 1–1 remains enemy-free.
  Results now follow a brief ending animation: wins show Koshi cheering with
  two upper fangs (one long and pointed, one shorter and flat-tipped) and
  bouncing before growing toward the board center; every loss shows X-shaped
  eyes, a frown, and two spins. Gameplay is frozen throughout and completed attempts save
  immediately. Hidden pages and open menus freeze the sequence; restarting or
  switching levels cancels it. Reduced-motion mode shows results immediately.
- Robo Mice arrive in Level 1–2, patrolling curves at **75 board units/second**
  (about 15% faster than before) and periodically stopping to open their mouths
  and bare two large front teeth. Robo Wheels arrive in 1–9 and roll around the inside boundary. Robo Rams arrive in 2–3, wander, pause
  with glowing eyes as they aim at Koshi, then charge straight ahead. Their
  charges ricochet off bricks and slow down with each bounce. Unarmed contact
  costs one heart per enemy contact; remaining overlapped does not repeatedly
  drain hearts. Separation and another collision can hurt again.
- Robo Buckets arrive in 2–6, slowly wander and wave their arms, firing blue bombs at random
  intervals averaging about two seconds. Bombs bounce off bricks and are harmless
  until their three-second fuse expires. Their color gradually shifts from blue
  to red as detonation approaches; the growing red flame circle then
  damages Koshi for a brief time.
- Enemies collide instead of passing through one another. Roaming enemies
  turn away, and charging Rams ricochet and lose speed. Wheels stay on their
  boundary route, queue behind other wheels, and nudge roaming enemies inward.
  Mouse resting periods and Ram targeting/charge timers continue during collisions;
  targeting Rams retain their locked aim. Bombs and harmless wrecks do not block enemies.
- Enemy shields add hits: **blue → green → red → none → defeated**.
  Accepted hits use the same one-second protection timer as Koshi, with a blinking
  red color changes and unchanged enemy shapes, without blurred hit effects. Each accepted sword hit uses one attack;
  protected hits use none. Boost attacks respect shield protection without spending swords.
  Recently hit enemies cannot hurt Koshi through contact or their bombs during that
  same second, even if his last sword attack was used up. Other enemies and spikes remain dangerous.
  Destroyed enemies award their original required hit count: unshielded **1**,
  red **2**, green **3**, blue **4** enemy points. Partial hits award no points.
  In the editor, choose a shield for enemy placements or enemy-spawning bricks.
  JSON stores optional `shield: "red"`, `"green"`, `"blue"`, or `null` on those items.
- Taking damage grants **one second of invulnerability** against both robots and
  spikes. Koshi wears an upset face and blinks between red shades for exactly
  that same second; normal colors return when he can take damage again.
  Further contacts do not extend the timer. Pause freezes both protection and
  animation; restart clears them. Spikes still stop him while protected.
- From Level 1–4 onward, collecting the level's **heart cost** in food points spawns a heart in the playable area.
  A compact **Next: 0/14** food counter (using the level's actual cost) and pink progress meter beneath Koshi's health
  show progress toward the next spawn and reset at each threshold. The counter
  wraps after **Next:** when needed, keeping the numbers together. Custom levels
  use their configured heart cost; the meter is hidden when heart spawning is disabled.
  A **pink, sparkling cloud** marks its exact location for **one second** before
  the heart appears. The cloud cannot be collected and freezes while paused.
  Touch the heart to restore one heart, capped at three. No hearts spawn in Levels 1–1 through 1–3.
  Campaign costs are `ceil(all available food points / 5)`, including food-spawning
  bricks, so even collecting every food creates no more than five hearts.
- From Level 1–3, collect a weapon to automatically strike robots within its reach.
  **Wood** has 1 hit, **bronze** 3, **silver** 5, and **gold** 10.
  Swords spend one hit per enemy contact, including contacts that damage a shield.
  Bronze, silver, and gold hammers have 3, 5, and 10 hits; on each contact,
  a hammer spends only as many hits as needed to break the enemy's shield and
  defeat it, or all remaining hits if its charges run out first. Each collected
  weapon replaces the current weapon and resets its hit count, even if it is weaker.
  Uncollected weapons and hearts do not expire.
- The dotted aiming line is subtle and transparent (15% opacity). A small red circle
  with a plus sign and thin black outline marks the exact clicked location,
  drawn above the bricks so it stays visible.
  When heading toward a trampoline or bumper, the line previews the reflected
  route up to the next wall, trampoline or bumper. Springs and bumpers count
  equally: only one bounce is predicted, including corner contacts; the preview
  never traces a chain of bounces.
- Defeated Robo Mice drop their ears, lose their eye color, and fade into a puff
  of smoke. Robo Wheels implode into a mini fireball. Robo Rams fold their horns,
  implode, and fade into smoke. Robo Buckets frown, flatten, and pop their bombs
  in tiny explosions. Defeats count immediately and the wrecks cannot hurt Koshi.
  Pause freezes these animations; restart clears them.
- **Pause**, **Escape**, or **Space** pauses/resumes play. Switching tabs or
  leaving the window pauses automatically; resume explicitly when you return.
- **Tab** through the bricks and press **Enter** or **Space** to aim at a
  brick's center. Mouse/touch controls allow precise off-center aiming.
- **Restart** starts a fresh attempt of the selected level.
  Victory automatically returns to the level map and moves Koshi to the next
  stop through all three main worlds, ending at Level 3–14.
  The world map can also start any level directly; choose it and press **Play Level**.

| Level | Name | New concept | Time | Win condition |
|-------|------|-------------|------|---------------|
| 1–1 | Breakfast rebellion | Normal red/blue/green bricks | 60s | 20 food |
| 1–2 | Mouse at the market | Robo Mouse | 45s | Survive |
| 1–3 | Cutlery uprising | Swords | 90s | 5 enemy points |
| 1–4 | A hearty harvest | Hearts and heart cost | 100s | 30 food + 4 enemy points |
| 1–5 | Cracker causeway | Crumblers | 100s | 35 food |
| 1–6 | Sticky jam depot | Slime | 100s | 30 food + 5 enemy points |
| 1–7 | Tin-foil picnic | Enemy shields | 110s | 8 enemy points |
| 1–8 | Skewered supper | Spikes | 60s | Survive |
| 1–9 | Meals on wheels | Robo Wheels | 110s | 35 food + 7 enemy points |
| 1–10 | Pancake trampoline | Springs | 110s | 40 food |
| 2–1 | Sushi assembly line | Conveyors | 120s | 35 food + 8 enemy points |
| 2–2 | The folding pantry | Warped bricks | 120s | 10 enemy points |
| 2–3 | Ram through the granary | Robo Rams | 120s | 40 food + 9 enemy points |
| 2–4 | Fast-food rescue | Boost | 140s | 12 enemy points |
| 2–5 | Snack dispensary | Spawners | 120s | 45 food + 10 enemy points |
| 2–6 | Buckets at the bakery | Robo Buckets | 75s | Survive |
| 2–7 | Cinder soup factory | Cinder | 130s | 45 food + 12 enemy points |
| 2–8 | Switchboard supper | Toggles | 130s | 14 enemy points |
| 2–9 | A feast for the world | Portals | 140s | 50 food + 15 enemy points |
| 2–10 | Bouncing breakfast | Robo Ball | 90s | 4 enemy points |
| 2–11 | Cookie calling | Smiley Cookie | 75s | 35 food |
| 2–12 | Lunch against the clock | Stopwatches (+10/+30/+60s) | 18s + pickups | 35 food + 3 enemy points |
| 2–13 | Recharge the cutlery | Battery | 120s | 12 enemy points |
| 2–14 | Pantry lullaby | Music Box | 90s | 30 food + 4 enemy points |
| 2–15 | Eggplant mix-up | Eggplant | 80s | 35 food |
| 2–16 | Saw through the blockade | Saw Blade | 110s | 6 enemy points using Boost |
| 2–17 | Snake at the snack rack | Robo Snake | 100s | 3 enemy points |
| 2–18 | A brighter buffet | Magical Sunglasses | 85s | 40 food |
| 2–19 | Three-course kickoff | Soccer Goal and Soccer Ball | 110s | 3 soccer goals |
| 2–20 | Stamp a snack shortcut | Ditto Stamp | 90s | 35 food |
| 2–21 | Scare up some supper | Spooky Mask | 90s | 30 food + 4 enemy points |
| 2–22 | Fence the food depot | Barrier blocks | 100s | 35 food + 4 enemy points |
| 2–23 | Pumpkin pantry patrol | Robo Jackolantern | 100s | 4 enemy points |
| 2–24 | The final countdown feast | Boom Helmet and Boom Times | 100s | 35 food; starts with 6 activations |
| 2–25 | Tom the Toaster | Boss fight | Unlimited | 6 Boost hits while dizzy |
| 3–1 | Tom's foundry kickoff | Robo Goalie | 150s | 5 soccer goals |
| 3–2 | Painting the pancake path | Paintbrushes | 100s | 40 food |
| 3–3 | Caped cat cafe | Kitty Cape | 80s | Survive |
| 3–4 | Laser light lunch | Laser Turret | 120s | 15 enemy points |
| 3–5 | Blocked buffet | Obstructions | 100s | 35 food + 4 enemy points |
| 3–6 | Snail-paced soup | Robo Snail | 100s | 35 food + 3 enemy points |
| 3–7 | Pinball pantry | Bumpers | 100s | 40 food |
| 3–8 | Bubble tea trouble | Bubbles | 110s | 25 food + 5 enemy points |
| 3–9 | Fireball fry-up | Fireball Turret | 120s | 14 enemy points |
| 3–10 | Demolition dinner | Destructible obstructions | 110s | 30 food + 4 enemy points |
| 3–11 | Surprise wall supper | Appearing obstructions | 90s | Survive |
| 3–12 | Stampede steakhouse | Robo Cow | 120s | 8 enemy points |
| 3–13 | Unicorn dessert dash | Robo Unicorn | 120s | 45 food |
| 3–14 | Copycat showdown | Robo Koshi | 110s | 30 food + 4 enemy points |

The 15 added lessons explain one new element (or its related pair) per cutscene.
They use at most **five brick styles** and three larger blocks: either three
doubles or two doubles and a triple, identical in desktop and portrait layouts.
Scenes include only robots actually scheduled in that level, plus story antagonist Tom.
The battery mission has just one silver-sword spawner and no other weapons:
its five attacks cannot meet the 12-point target without battery-powered revisits.
The Saw Blade mission has no swords; preserve Boost bricks to win.
Soccer supplies five balls for three required goals and no food/enemy target.
The helmet mission supplies all three Boom Time colors, with a blue pickup
beside Koshi at Start. These add activations, not seconds.

These lessons now have larger enemy waves, including red shields, and **two
returning brick mechanics** each. Scheduled swords arrive at least ten seconds
after the first robots; later replacements leave time to use them. Enemy-score
missions supply their target plus 50% spare attacks (at least five), plus one
unfinished red-shield hit, rounded up to silver swords. The Battery mission
provides 20 attacks through the first dispenser use and three recharges; mice
are on guard from time zero, before the player can reach its first sword.
The Saw mission remains Boost-only. Food and soccer missions have delayed
bronze and silver swords for optional defense, without adding enemy-score targets.

| Level | Returning bricks | Robots | Sword arrivals |
|-------|------------------|--------|----------------|
| 2–10 | Crumblers, Springs | 10 | Silver at 22/52s |
| 2–11 | Conveyors, green slime | 8 | Bronze at 20s; silver at 44s |
| 2–12 | Crumblers, Springs | 10 | Silver at 12/16s; collect Stopwatches for extra time |
| 2–13 | Sword spawner, green slime | 24 | One dispenser; three Battery-powered revisits |
| 2–14 | Green slime, Conveyors | 12 | Silver at 22/50s |
| 2–15 | Spikes, Warped | 9 | Bronze at 20s; silver at 46s |
| 2–16 | Boost, Crumblers | 15 | None; use Boost |
| 2–17 | Springs, Crumblers | 7 | Silver at 22/52s |
| 2–18 | Crumblers, Toggles | 9 | Bronze at 20s; silver at 48s |
| 2–19 | Springs, Conveyors | 8 | Bronze at 20s; silver at 48s |
| 2–20 | Boost, Conveyors | 9 | Bronze at 20s; silver at 48s |
| 2–21 | Spikes, Springs | 13 | Silver at 22/50s |
| 2–22 | Crumblers, Springs | 10 | Silver at 22/52s |
| 2–23 | Barriers, Toggles | 8 | Silver at 22/52s |
| 2–24 | Warped, Conveyors | 10 | Bronze at 20s; silver at 48s |

The Goal and Barrier introductions each have **three independent, non-corner
copies**, including larger groups. Their plain bricks use green/red cooldowns
to keep the new type and two returning types within the five-style limit.
The other added lessons retain all three plain cooldown colors.

The original 19 lessons are unchanged. Only previously introduced mechanics return.

World 3 (**Robot Foundry**) opens with Tom the Duck revealing that he builds every
robot in his foundry. Each cutscene explains its new concept through Koshi's fight
to save the world (and eat its food), showing only robots that appear in that level.
Every layout has 17 standard, three double and one triple starting block. Shields
are rare: red appears most often, green twice and blue once. Heart cost allows
at most five hearts. Each level reuses one to four earlier brick types and one or
two earlier items or objects.

| Level | Returning bricks | Returning items/objects | Robots | Sword arrivals |
|-------|------------------|-------------------------|--------|----------------|
| 3–1 | Goals, Springs, Crumblers | Music Box | 12 | Bronze at 16/95s; silver at 50s |
| 3–2 | Conveyors, Crumblers | Stopwatch | 8 | Bronze at 20/60s |
| 3–3 | Springs, Warped | Spooky Mask, red Paintbrush | 16 | Bronze at 18s; silver at 50s |
| 3–4 | Toggles, green slime | Battery, Music Box | 26 | Bronze at 30/80s |
| 3–5 | Portals, Spikes | Kitty Cape | 10 | Bronze at 14s; silver at 50s |
| 3–6 | Crumblers, Conveyors, red slime | Magical Sunglasses | 11 | Bronze at 22/60s |
| 3–7 | Springs, Barriers | Smiley Cookie | 11 | Bronze at 18s; silver at 55s |
| 3–8 | Warped, Boost | green Bumpers, Music Box | 13 | Bronze at 16/75s; silver at 45s |
| 3–9 | Crumblers, Springs | Battery, Spooky Mask | 24 | Bronze at 25/70s |
| 3–10 | Fireball Turret, Toggles, green slime | Battery, red Paintbrush | 12 | Bronze at 16s; silver at 55s |
| 3–11 | Springs, Conveyors | Music Box, Spooky Mask | 14 | Bronze at 14s; silver at 48s |
| 3–12 | Boost, Barriers | Music Box, Kitty Cape | 11 | One wood sword at 40s; use Boost |
| 3–13 | Food spawner, Springs, Crumblers | Smiley Cookie | 10 | Bronze at 14s; silver at 50s |
| 3–14 | Portals, Springs | Kitty Cape, Music Box | 11 | Bronze at 16/80s; silver at 50s |

Level 3–1 spawns Robo Goalies before its first soccer ball. Level 3–2 delivers
blue brushes before red ones. Level 3–10 has exactly one Fireball Turret and two
Batteries. Level 3–11 is the first level whose obstructions appear mid-level.
Level 3–13 spawns unicorns before any food and adds Eggplants. Level 3–14 ends the
world with Robo Koshi, which spawns first and retraces Koshi's path.

World 3S (**Tom's Gauntlet**) is an optional challenge branch from World 2 for
advanced players. Level 3S–1 introduces Tom the Duck for players who arrive
before World 3. Each cutscene shows only Koshi, Tom and robots in that level, and
explains how that level's combination of mechanics works. Robots always arrive
before the first weapon or power-up, but every level then supplies four to six
swords over time. Soccer balls appear only in levels with a goal objective, and
every level with Robo Jackolanterns has at least one Barrier brick to wall off
their fire. Every level has its own brick
layout mixing standard, double, triple and quadruple blocks (including corner
L-shapes), and its own slow/fast colors. Shields are more common than in World 3,
but red still outnumbers green and green outnumbers blue. Heart cost allows at
most four hearts. Objectives are balanced: seven levels need soccer goals, six
need food and six need enemy points. Levels with static objects place every
food, weapon and item so nothing spawns inside a wall.

| Level | Name | Objective | Bricks | Robots | Items / objects |
|-------|------|-----------|--------|--------|-----------------|
| 3S–1 | Goalie gauntlet | 6 goals | Goal triple and double, corner Springs, Conveyor, Crumbler | Goalies, Robo Cows, mice | Bumpers, Kitty Capes |
| 3S–2 | Unicorn smorgasbord | 60 food | Hamburger spawner, Portals, Warped, green slime | Robo Unicorns, snakes, balls | Eggplants, Smiley Cookies, Stopwatch |
| 3S–3 | Laser lockdown | 22 enemy | Laser Turrets (one quadruple), corner Fireball Turret, Toggles, Spikes | Robo Snails, mice, buckets, rams | Batteries, Music Box |
| 3S–4 | Bubble bend-it | 4 goals + 30 food | Side goal triple, Boost, Barrier, red slime, Warped | Jackolanterns, wheels, mice | Bubbles, Bumpers, Kitty Capes |
| 3S–5 | Copycat penalty kicks | 4 goals + 8 enemy | Two goal doubles, Portals, Crumbler, Spikes | Goalies, Robo Koshi, mice, wheels | Spooky Masks, Ditto Stamp |
| 3S–6 | Cinder stampede | 35 food + 8 enemy | Two Boosts, Barriers, Crumbler, Springs | Robo Cows, mice, buckets | Saw Blade, red Paintbrushes; wood and bronze swords only |
| 3S–7 | Obstacle cup | 5 goals | Side goal triple, corner Fireball Turret, Toggle, Conveyor | Goalies, wheels, snakes, mice | Fixed, destructible and appearing obstructions, Batteries |
| 3S–8 | Boom helmet bakery | 50 food, 8-charge Boom Helmet | Conveyor, Springs, Warped, Toggle, chicken spawner | Robo Snails, rams, balls | Boom Times, Magical Sunglasses |
| 3S–9 | Jackolantern junkyard | 14 enemy | Spikes, Portals, blue slime, Barriers | Jackolanterns, mice, balls | Large obstructions, Saw Blade, Stopwatch, gold sword |
| 3S–10 | Grand slam | 3 goals + 6 enemy + 30 food | Goal triple, sword spawner, Springs, Conveyor | Robo Unicorns, goalies, Robo Koshi, mice | Bubbles, Kitty Capes, Smiley Cookie |
| 3S–11 | Turret derby | 4 goals + 12 enemy | Goal triple, two Laser Turrets, Toggles, green slime | Robo Cows, goalies, mice, rams | Bumpers, Batteries, Spooky Mask |
| 3S–12 | The duck's last stand | 4 goals + 40 food | Goal triple, quadruple corner Boost, Barrier, Portals, Spikes, Conveyor | Robo Koshi, Robo Unicorns, Jackolanterns | Bubbles, appearing obstructions, Eggplants, Kitty Capes, Magical Sunglasses |
Those levels use at most six distinct
brick styles, repeating useful combinations such as Warped conveyors or
Boost with Springs. Of 21 starting blocks, 17 are standard, three are double
(14.3%), and one is triple (4.8%). Enemy waves are larger throughout the campaign
after the enemy-free opening. From 1–7 onward, roughly 35–63% of scheduled
robots have shields. Red shields start in 1–7, green in 2–2, and blue in 2–8;
later missions field more shielded robots and more of the stronger colors.
Ordinary steering bricks remain available. Scheduled swords arrive at least ten
seconds after the first robots, requiring an initial dodging phase. Food-only
and survival missions provide just one bronze sword, except 1–10's silver
at 28 seconds to help with shielded wheels. Unshielded combat missions
generally provide two silver swords. Shielded enemy-goal missions supply enough
silver attacks for the target plus 50% spare attacks (at least one extra sword's
five attacks), plus the strongest shield's possible unfinished damage.
Replacement swords are spaced throughout the level, starting 12 seconds after
the first robots and ending 25 seconds before timeout. Level 2–1 supplies
three silvers at 24/60/95 seconds (15 attacks for 8 points); Level 2–2 supplies
four at 24/48/71/95 seconds (20 attacks for 10 points).
Enemy-goal levels after 1–10 with no Boost bricks also supply two spare bronze
swords at one-third and two-thirds of the time limit: 40/80 seconds in 2–1,
2–2, and 2–3, without changing their silver schedules.
**Level 2–4 (Boost introduction) supplies no weapons**: players must use
Boost launches to defeat robots and meet its 12-enemy-point goal, with a
140-second limit (20 seconds of extra practice time).
Level 2–7 has an additional reserve silver: five at 24/48/65/82/105 seconds,
providing 25 attacks for 12 enemy points. Nearby drops are shifted slightly
to retain at least 16 seconds between swords.
Special-brick introduction levels have at least three separate instances of
the new feature, all away from corner segments. Three of the four larger
starting blocks (75%) carry that feature: two doubles and one triple.
The remaining larger block stays ordinary. Returning features remain available
on separate bricks. The portal introduction uses four endpoints in two matching
pairs (purple and orange), with three endpoints on larger blocks.
When Koshi rests against a Boost brick, including a Toggle-disabled one, his next valid launch is
boost-ready: he opens his mouth wide and his eyes and mouth glow red-orange
like the brick's flame. The cue freezes on pause and clears when he moves
or no longer touches a Boost surface; cutscene faces are unchanged.
Combined-goal progress follows the less-complete target. The final level's
portal endpoints sit away from corners so Koshi emerges clear of every wall.

On phones held upright, the board uses portrait game coordinates with compact
stats and controls. The board fits the available play area in both
regular play and tutorials, with 20px of space above and below and no fixed
5:8 display ratio.
In the installed app, Back protection is armed by the first real tap or key
press. Intercepted Android Back gestures/buttons have no in-game effect:
when the Navigation API offers a cancelable same-document traversal, the game
cancels it before history, focus, or scroll changes, avoiding a back/forward
round trip. Otherwise it returns to the existing forward history entry without pausing gameplay,
tutorials, or story scenes. It never creates replacement entries during Back;
Chromium can mark those entries skippable after a traversal without fresh input.
Visible-window blur (including system gesture UI) does not pause the installed
game. Actually hiding the app still pauses it. Use the Pause button to pause,
and Home or the app switcher to leave.
This is browser-history protection, not a system-gesture override. Before the
first interaction, or if Android/browser bypasses page history, Back can still
close the app. Browser-controlled predictive gesture visuals may still appear,
especially when the traversal is not cancelable. Device testing is required; guaranteed OS-level blocking requires
a native Android app. Custom-level playtests do not enable Back protection, so
Back can return to editing. Normal browser tabs retain native Back and blur pausing.
The Koshi's Quest logo, level stat, and icon-only Menu, Pause, and Restart buttons
share one row above the stats. The level is centered in the space between the
logo and toolbar. Save-status text stays in the menu, not on the gameplay HUD;
save errors and retry controls remain visible. Time, weapon, food, enemies, and health are centered
in equally spaced columns. The world map's level selector and **Play Level**
button choose levels; **Back to menu** or Escape cancels without
changing the current level; no dropdown appears on the main menu itself.
Extra mission copy and footer
are hidden on phones so the page cannot scroll away from play. Landscape phones
also use the viewport-fitted layout. Both layouts use **26 boundary segments**, combined into **21 starting blocks** in the campaign. Phones have
**five on top/bottom and eight on each side**. Desktop bricks are rotated
**90 degrees clockwise** relative to the phone: **eight on top/bottom and
five on each side**. Phone top maps to desktop right, right to bottom,
bottom to left, and left to top. Brick IDs, cooldown types, Crumbler limits,
and Warped attributes follow each brick through the rotation. Brick dimensions adapt to the screen;
some bricks are narrower than 44px on small phones to keep the count fixed.
Toolbar buttons retain at least 44px touch targets.
An equipped sword appears beside Koshi with its remaining hit count. Timed
swords show remaining seconds as a number without a unit suffix. The count is printed on the sword blade with
its top toward the tip and bottom toward the handle, using larger text condensed
to fit the blade width. Black or white text is chosen for
the highest contrast with the blade color; no sword appears when none is equipped.
Level 1–1 has one slow and one fast segment; later levels start with three of
each before special-brick overrides and grouping. Food patterns stay
inside the playable area. Instructions are available through **Menu → How to play**.
Desktop play keeps the original landscape board. A restart picks the layout
for the current screen; resizing during an attempt preserves its game state.

Artwork is drawn locally;
system emoji represent food. The DM Sans, Space Grotesk, and Pixelify Sans fonts are bundled in
[fonts/](./fonts/) under the SIL Open Font License (license texts included), so
the game makes no requests to external services.

## World 4: Rolling Road

**4-1, The rolling buffet** is a 56-brick-long autoscroll demo, spanning more
than six screens. Survive for **180 seconds**; food and enemy points are
optional, and no stopwatches extend the trip. The camera follows this schedule:

| Time | Camera speed (bricks / second) |
|------|-------------------------------|
| 0–18s | Slow: 2/9 |
| 18–42s | Stopped: 0 |
| 42–60s | Fast: 2/3 |
| 60–78s | Slow: 2/9 |
| 78–102s | Stopped: 0 |
| 102–120s | Fast: 2/3 |
| 120–138s | Slow: 2/9 |
| 138–162s | Stopped: 0 |
| 162–180s | Fast: 2/3 |
| 180s | Stopped at the far end; survival complete |

The camera spends 40% of the trip stopped, 30% moving slowly and 30% moving
fast, covering exactly 48 bricks beyond the initial 8-brick screen.
The 122 boundary segments form 96 playable bricks: 22 double-size and two
triple-size bricks make exactly 25% enlarged. Green, blue and red steering
bricks each number 32; 32 bricks (one third) have extra mechanics.
These include Crumblers, Warped bricks, colored Slime, Springs, Spikes,
Conveyors, Boost, Toggle, Barrier, paired blue Portals, both turret types, and
food/sword spawners. Along the camera's route are 45 food placements covering
all seven foods, 18 enemies covering all twelve robot types, four swords, eight item pickups,
and nine bumpers, bubbles, obstructions and soccer-ball placements.
Food earns a healing heart every 40 points. Weapons and protective power-ups
are distributed across the trip, including the fast section.

World 3's **3-14** advances directly to **4-1**; World 3S remains optional and
still ends at **3S-12**. The demo can also be inspected read-only in the editor.
Timed scrolling campaign placements preserve forward progress in both desktop
and portrait layouts, rather than reversing the route when the board rotates.

### Rolling Road lessons

The Beta-only expansion preserves **4-1** and all earlier level content and save
identities. Complete 4-1 to continue through these lessons in order:

| Level | Name | New concept |
|-------|------|-------------|
| 4-2 | Flame-grilled freedom | Flame hazard bricks, without power |
| 4-3 | Missiles at the market | Missile hazard bricks, without power |
| 4-4 | Switch off the soup | Power bricks controlling flames and missiles |
| 4-5 | Shielded snack run | Cat Shields |
| 4-6 | Crab cake crossfire | Robo Crabs |
| 4-7 | Laser lunch lines | Powered Laser hazards |
| 4-8 | Circle of supper | Cat Circles |
| 4-9 | Love bugs at the banquet | Robo Love Bugs; at least three Barrier bricks, never scrolling |
| 4-10 | Bubble gun bistro | Powered Bubble Gun hazards |
| 4-11 | Hammer time hibachi | Hammers against many shielded robots |
| 4-12 | The bumper buffet loop | Moving bumpers on one large, unpowered Cat Track loop |
| 4-13 | Bumper gun brunch | Powered Bumper Gun hazards |
| 4-14 | The last rolling roast | Power-controlled Cat Tracks carrying spiked obstructions |

Each opening scene follows Koshi's battle against Tom the Duck's world-conquering
robots and his quest to taste every rescued meal. Scenes explain the lesson and
its objective, and only feature robots present in that level.
Lessons alternate food, enemy and soccer targets (including combinations) with
timed survival. They each last up to 110 seconds. Each uses a seeded selection of
1–4 returning brick mechanics and 1–2 returning pickup/object types alongside the
featured concept and objective equipment. Later concepts never appear early.
Every eligible lesson rolls a 25% autoscroll chance once in the seeded builder;
the checked-in seed selects **4-2, 4-5 and 4-10**. Reloading does not reroll levels.
The Love Bug lesson is always stationary.

Most bricks are standard-sized: approximately 12–14% are double-sized and 5–6%
are triple-sized. Shielded enemies are normally uncommon, with red more common
than green and blue rarest; the hammer lesson deliberately fields many shields
and supplies spare hammers. Food budgets set the heart cost so collecting every
scheduled food still generates no more than five healing hearts.

### Scrolling performance

Scrolling levels draw only artwork overlapping the camera, with padding for
large sprites and effects. Attacks are checked independently of their owner:
an offscreen robot can still have a visible bomb, fire wave, or beam.
Offscreen brick artwork and counters refresh when they enter view.
Full enemy movement and new attacks run within a buffer extending half a
screen behind the camera and one screen ahead. Farther enemies retain their
state without moving, attacking, or awarding defeat points; they resume without
catch-up when the camera reaches them. Existing bombs and fire waves continue
advancing independently. Scheduled spawns, pickup expiration, and global
power-up timers continue normally.
Fire-wave collision checks use nearby blocker geometry rather than clipping
against the entire board on every physics step. The physics timestep and
authored level content are unchanged.

## Graphical level editor

Open [editor.html](./editor.html), or choose **Open level editor** in the game.
Directly above the board is a live available-points reference for food, enemies and
soccer goals. It counts scheduled placements (including groups and enemy shield
values) and one spawn from each active spawning brick. Batteries and Ditto
Stamps can produce additional spawns, so the reference flags those possibilities
rather than claiming a fixed maximum. Actual scores depend on gameplay, and
scoring soccer balls requires goal bricks.
The **Level** library lists every built-in game level for read-only inspection.
Select bricks and scheduled events, scrub the timeline, switch layouts, or read
the cutscene. Spawn locations are deterministic examples of the game's randomized
placements, not fixed campaign coordinates. **Play game level** opens the original
campaign level, not an editable snapshot. Editing and JSON printing/loading
are disabled while viewing game levels. Select **Your custom level** to
restore your custom workspace and unsaved work; browsing never overwrites it.
It is a separate page, works by double-clicking the file, and is included in
the GitHub Pages deployment at `/koshi/editor.html`. No server-side storage
or build tools are needed.

Placed enemies use compact icon markers, including Robo Koshi and Robo Snail.
Robo Snail's marker shares its angular shell and eye-stalk drawing with its palette.
The enemy and spawn-brick palettes show their corresponding outlined graphics.
Cat Block artwork fits its palette icon without covering neighboring menu choices.

### Autoscrolling custom levels

Enable **Autoscrolling level** in level settings; changes apply automatically. Length
is the number of bricks along each long edge: 8 is a traditional single screen,
with up to 1000 supported. The board extends horizontally on desktop and
vertically in portrait without shrinking bricks or objects. With Dynamic View
off, the placement area fits the board's full height, including space for the
horizontal scrollbar, so it never needs its own vertical scrollbar. Scroll
horizontally on desktop, or scroll the page for a tall portrait board, to reach
the rest of the level; scrubbing **Preview time** moves a yellow
outline showing the gameplay camera.

Set an initial speed in **bricks / second**, then use **Add speed change at
preview time** in the camera timeline. Each row has editable time and speed and
a Remove button. Speed `0` pauses the camera; a later positive speed resumes it.
Changes must have distinct times before the level ends. The camera starts at
the left/top end, stops at the far end, and freezes with the gameplay clock
before Start, during Pause, and after the level ends. Koshi starts in the first
screen. Only visible bricks can be activated. If Koshi's entire body leaves
the camera view in any direction, he dies immediately, regardless of protection.
His normal spinning death animation gradually slides back into view; the camera
stays frozen at the death position.
Trajectory previews stop at the first screen exit rather than reflecting from
offscreen geometry. Random pickups and objects use the camera at their actual
spawn time and leave enough trailing-edge clearance to remain fully on screen
for at least one second, including camera speed changes during that second.
Authored positions are not moved. Impossible clearance at extreme speeds reports
an explicit placement error rather than silently placing an immediately lost item.
Power-up background ribbons run along the board's longer axis in both layouts.
Existing campaign levels are unchanged.

JSON stores this optional setting as
`"autoscroll": { "length": 24, "speed": 0.25, "events": [{ "time": 10, "speed": 0 }, { "time": 15, "speed": 0.5 }] }`.
Omit `autoscroll` for a traditional level. Placements use normalized coordinates
over the entire board, not the camera. Changing board length changes those
relative positions; split combined bricks before changing length.

### Optional story cutscenes

Each level can have an optional pre-level cutscene. All 62 campaign levels
include short story scenes following Koshi from the garden through the Clockwork
Pantry to the Robot Foundry, controlled by **Tom the Duck**, the main antagonist. Tom is a robot
duck who commands the robots and hoards the world's food.
He is introduced in the first scene and speaks in every campaign scene.
Koshi fights to save the world while celebrating every kind of food. Each scene
teaches its level's new mechanic through that story. Each campaign scene has
at most **three enemies including Tom**, plus Koshi. Robot actors appear only
once introduced, and only in levels containing that enemy; speaking robots
take priority when choosing the smaller cast. Mice show their front teeth
when talking, including in their pixel portraits. Wheels do not use the mouse's
mouth/teeth display. Ground shadows sit at each character's feet or base (lower
for Tom's long legs) and remain grounded while speakers bob. Mouse teeth extend
behind the animated mouth edge so their rectangular tops stay hidden.
Scenes replay when restarting or directly selecting a level. Levels
without a scene start immediately as before.

The upper two-thirds of the viewport show a garden, workshop or foundry stage, with
characters using the same drawings as gameplay. On phone-sized stages, the cast
is roughly evenly spaced in its authored left-to-right order, with 20% more
space beside Koshi. Larger casts scale down to fit; authored heights, desktop
positions, and saved level data remain unchanged. Speakers step forward and
animate while talking. The lower third holds an animated, 32-by-32 pixel
portrait on the left and readable Space Grotesk dialogue on the right. The same
font styles speaker names, scene headings, and controls. Koshi, Robo
Mouse, Robo Wheel, Robo Ram, Robo Bucket, and Tom the Duck each have their own portrait and stage
character. Tom's design follows the supplied sketch: a tall metal body, radio
antenna, slit visor, long duck bill, plated wings, and webbed metal feet.
His antenna lights and bill animate while speaking. Tom is a cutscene character,
not a new combat enemy or boss.
Dialogue reveals at **30 characters per second**, with full words laid out
before typing so letters never jump to the next row as a word appears.
**Reveal text** shows the
rest of a line; **Continue** advances; **Begin level** finishes the last line.
The focused button also accepts Enter or Space. **Skip scene** or Escape skips
directly to gameplay. No level time, cooldowns, movement, or spawn events advance
during a scene. Switching away suspends the scene animation and typewriter.
Reduced-motion mode shows each complete line immediately and disables animation.
Screen readers receive complete dialogue lines rather than individual letters.

In the editor, enable **Optional pre-level cutscene**, choose the world
background, and add dialogue lines with a speaker and on-stage cast.
Changes apply automatically, and each new dialogue line inherits the previous
line's speaker and checked on-stage characters. Enter dialogue for the new line;
invalid or unfinished edits report an error and block JSON printing and playtesting
until corrected. Unchecking the option removes the scene. The full JSON format
supports precise actor positions and repeated actors:

```json
"cutscene": {
  "theme": "garden",
  "lines": [
    {
      "speaker": "koshi",
      "text": "Those snacks belong to the garden!",
      "actors": [
        { "character": "koshi", "x": 0.3, "y": 0.65 },
        { "character": "mouse", "x": 0.7, "y": 0.65 }
      ]
    }
  ]
}
```

Add this optional property to a level object. The Beta themes are `garden`,
`workshop` and `foundry`. Official themes are `happy-meadows`, `catnip-beach`,
`fuzzy-falls`, `mouser-mesa`, `alpine-litterbox`, `yarnball-moon`,
`hairball-swamp`, `meownt-vesuvius`, and `robot-hq`. All are available in the
editor for custom levels.
Character IDs are `koshi`, `mouse`, `wheel`, `ram`, `bucket`, `ball`, `jackolantern`, `snake`, `goalie`,
`robo-snail`, `robo-cow`, `robo-unicorn`, `robo-crab`, `robo-love-bug`, and `tom`. Each is available as both
a speaker and an on-stage cast member in the editor. Each of 1–100 lines has
1–240 Unicode characters of nonblank text and 1–6 actors, including its speaker.
Actor coordinates are normalized stage positions between 0.1 and 0.9 on each
axis. Official backgrounds keep their ground line at the same relative stage
height in portrait and landscape; `y: 0.8` places Koshi on the foreground path.
Per-line positions animate between dialogue beats. Old level JSON without
`cutscene` remains compatible. Scenes are included in printed/loaded JSON,
playtest links, direct-file play, and the offline app.

### Level settings and placements

**Boss level** selects a boss fight instead of score or survival objectives.
Place exactly one **Tom the Toaster** enemy before saving, exporting, or
playtesting. Draft editing may temporarily omit the boss; duplicate bosses,
boss formations, shields, and boss brick spawners are not allowed. Other
enemies and their spawners remain available. Boss fights have no time limit;
the duration setting still defines the placement timeline.

World **2-25** introduces Tom at the end of Clockwork Pantry, with four green
slime blocks and four Boost blocks (one of each per side). His grey toaster
body has green pixel eyes and a red side handle. He randomly performs one to
four attacks before becoming dizzy: spinning toast fire, rapid straight-line
ricochets off arena bricks without warning indicators, or a charged pair of
toast shots. The first is blue, targets any non-Cinder brick (including Boost),
and turns the struck brick blue with the slow cooldown while preserving its
attributes. The second is black and turns a non-Boost brick into Cinder.
Only a Boost launch during his rocking, red **ERROR!** eye display damages
him. Six hits defeat him. The red, gold-bordered health bar below the counters
tracks his health; his death animation finishes before Koshi celebrates.

1. Set the level name, time limit, win condition, and optional heart cost (blank disables
   food-triggered hearts). Settings apply automatically when you change a selection
   or checkbox, or finish editing a field. Invalid settings are reported without
   replacing the last valid level. **Level settings & introductions** is collapsible
   and contains the optional cutscene and level information sections.
   Choose **Survive until time runs out**, or set food and/or enemy targets.
   A target of **0** disables that score requirement; at least one score target
   must be positive. Both positive targets must be met to win.
   The pre-level briefing states the objective. Required food and enemy counters
   show **/ target** in gold; survival levels highlight the countdown in gold.
   Click/tap any boundary brick (or focus it and press Enter) to select it,
   then change **Selected brick type** in the brick inspector: slow/blue (15s),
   normal/green (8s), or fast/red (3s). Enable **Crumbler** and/or **Warped**
   independently, or choose **Slimed**, **Springs**, **Spikes**, **Conveyor**,
   **Portal**, **Spawning**, or **Boost** for contact effects.
   Compact visual palettes select cooldowns, surfaces, colors, and modifiers.
   The wider desktop sidebar has one category picker for **Bricks**, **Food**,
   **Enemies**, **Items**, **Objects**, and **Weapons**. Click a category to
   open its menu. The **Enemies** menu separates bosses into a labeled **Bosses**
   subsection while keeping them in the enemy category.
   Only settings for enabled brick attributes are shown.
   Selecting a boundary brick opens its menu; selecting an event opens its category.
   Set Portal colors on individual bricks or any selected group. Incomplete
   or overfilled pairs show a warning but allow editing;
   each used color must have exactly two bricks before export or playtest.
   **Toggle** adds an independent 1-, 2-, or 4-activation cycle.
   **Power** adds a circular black-and-yellow power switch with a shaded,
   beveled face over any red, green,
   or blue steering brick. Selecting any Power Block successfully swaps all
   Power Blocks to the same color without changing steering or recharge time.
   It can coexist with other modifiers and a contact surface. Contact and failed
   clicks do not toggle power. **Power Blocks starting color** in Level settings
   selects the shared initial state: off (yellow circle, black symbol) or on
   (black circle, yellow symbol). Restart restores that choice; newly stamped
   Power Blocks use the current shared state. Hazard Bricks with a black or
   yellow border operate only when Power Blocks match that border.
   Set the selection limit (default 5) or warp duration
   (default 15 seconds). Changes apply immediately. Each brick
   can have its own type, independent of the preset. Applying a different boundary
   preset changes defaults but keeps individual overrides.
2. Choose **Koshi** to optionally place his starting point. Click the playable
   area to place or replace the single start marker, drag it, use its arrow keys,
   or enter exact **Starting X/Y (%)** coordinates. Board moves honor
   **Discretize X, Y**; numeric coordinates remain exact. **Use default starting
   point** (or Delete/Backspace on his marker) removes the placement. Ordinary
   levels default to the board center; scrolling levels retain their first-screen
   start and boss levels retain their existing offset. The marker is independent
   of timed events and remains visible throughout the timeline preview.
   JSON stores this optional placement as `"koshiStart": { "x": 0.25, "y": 0.75 }`,
   using the same normalized playable-area coordinates as other placements.
   Omit it to use the default. Playtests and restarts use the authored position;
   existing campaign levels are not changed.
   Click another category, then a food, enemy, weapon, item, or object picture in the
   inspector. Choosing a category or palette option automatically activates **Place**.
   Event category and object choices start a new placement instead of changing
   a selected event; brick options still apply immediately to selected boundary bricks.
   Set its appearance time
   and on-screen lifetime (required for food, optional for items and weapons).
   Leave an item or weapon lifetime blank to keep it until the level ends.
   With the **Place** tool, click/tap the dotted
   playable area to add an object. Each placement is automatically selected,
   switching to **Select** so inspector changes edit the object just placed.
   Choose **Place**, **New event**, or a palette option to place another object.
3. Select a marker or event in the chronological list to edit it. Drag a marker,
   or expand **Exact position** and enter X/Y percentages. Changes to selected
   events apply automatically when a control changes (numeric fields commit when
   you leave the field). Invalid values report an error without changing the level.
   With no selection, the inspector configures the next board placement. Markers also
   support arrow keys (1% steps). **Duplicate** copies an event at the same
   time and position; move it to create lines/circles. **Delete** removes it.
   **New event** returns to placement mode. Overlapping markers can always
   be selected separately from the event list.
   **Discretize X, Y** snaps board placements and marker moves to the visible
   dots, including spawn templates and arrow-key moves. It defaults to checked;
   uncheck it for free placement. New board placements use the current preview
   time, snapped to the selected time spacing (1 second by default).
   Toggling it does not move existing elements; numeric inspector
   coordinates and obstruction resizing remain exact. Perimeter enemies still
   snap to their required board edge.
4. **Multiselection** works for any mix of bricks and food/enemy/weapon markers:
   - Drag a selection box on the board (with either tool, or from a brick) to
     select every brick it touches and every marker whose center it contains.
   - Shift/Ctrl/⌘-click a brick, marker, or event-list row to toggle it;
     Shift/Ctrl/⌘-drag adds a box to the existing selection. On touch screens,
     enable **Add to selection** for the same behavior.
   - **Select all** (or Ctrl/⌘+A on the board), **Clear**, and Esc manage the
     selection; the summary shows how many bricks and events are selected.
   - Brick inspector changes apply to every selected brick. Only the changed
     control is applied, so differing values shown as “Mixed” (or an
     indeterminate checkbox) are preserved.
   - With several events selected, the event inspector applies only edited
     fields; “Mixed” fields keep each event’s value, and setting X or Y aligns
     the group. Drag any selected marker or use arrow keys to move the whole
     group; **Duplicate**/**Delete** (or the Delete key) act on all selected
     events.
5. Scrub **Preview time**. For autoscrolling levels, **Dynamic View** locks the
   board viewport to the game camera at that time, including during playback.
   Uncheck it to scroll the board independently of the time dial. It is disabled
   for non-autoscrolling levels.
   Disable **Show all spawn locations** to see which
   objects have appeared and when food expires. **Play** advances from the current
   preview time to the end of the level; **Pause** stops it at the current position.
   The speed dial runs from **0.25x** (quarter speed) to **4x** (quadruple speed),
   with **1x** matching real time. Speed changes take effect during playback.
   **Discretization** defaults to **1s**. Choose **None** for continuous slider movement, or
   **0.5s**, **1s**, **5s**, **10s**, or **30s** to round manual slider movement to
   the nearest multiple of that interval within the level duration. Arrow keys
   move one interval at a time. Playback remains continuous and can still reach
   the exact level end when its duration is not a multiple of the interval.
   Scrubbing, interacting with the board or event inspector, switching/importing
   levels, or hiding the editor tab pauses playback. Camera outlines follow the
   preview time in autoscrolling levels. This is a placement preview,
   not an enemy-movement or collection simulation. Disable **Show randomly
   positioned spawns** to hide random events (including random groups and campaign
   schedule examples) while retaining fixed placements. This preview-only toggle
   does not remove events or change available-point totals.
   **Playtest** runs the real
   game. Switch **Preview** to check phone portrait placement.
6. **Print JSON** displays the complete level JSON in the text box below the
   buttons. Copy this text and manually save it in a `.json` file for backup.
   To load a level, paste its JSON into the same text box and choose **Load JSON**.
   Invalid JSON or level data reports an error and leaves the existing level unchanged.
   There are no file pickers, directory settings, downloads, or browser draft controls.
7. **Playtest** opens a snapshot in the game, including its settings, exact spawn
   times, and placements. Any cutscene plays first, before level information and
   objectives; custom playtests replay it on every restart even if already viewed.
   **Back to editor** in the game toolbar returns the
   snapshot for more edits. Browser/Android Back also returns to the editor;
   the editor URL retains the playtest snapshot even if the page reloads.
   Restart replays that custom level; built-in levels remain selectable.
   The snapshot is encoded in the URL fragment (not sent to a server), so an
   HTTP/Pages playtest URL can be shared. Print JSON and save it manually for long-term storage.

Apply form edits before exporting or playtesting. Neither export nor playtest
changes the built-in levels. Closing the editor with unsaved level changes
prompts before leaving.

### Placement format

The versioned JSON contains individual placements, not random pattern commands.
Coordinates are fractions of the **safe playable area inside the boundary
bricks**, not raw screen pixels: `x: 0` is its left edge and `y: 1` is its
bottom. The same fractions map to each layout's safe area, so objects stay
accessible and off bricks on phones and desktops.

Robo Wheels and Robo Snakes must start on this area's perimeter (at least one coordinate is
0 or 1). The editor snaps them to the nearest edge; they then roll normally.
Robo Rams, Buckets, and Mice can start anywhere in the safe area; Mice wander
while Rams charge after a short aim. Buckets wander and shoot bombs. Items and
swords remain until collected or until their optional on-screen lifetime expires;
omitting `lifetime` keeps them until the level ends, including clock extensions.
Food, item, and weapon lifetimes begin at the scheduled appearance time, not the
one-second spawn warning. Expiry happens before collection; pause freezes timers.
Ground lifetime does not change an equipped sword's attacks or effect duration.
Food, items, and weapons pop larger, then shrink and fade with sparkles on pickup;
food also displays the points earned. Simultaneous events
spawn in their original list order. Normal pickup/combat rules still apply,
including automatic collection of objects placed over Koshi's starting point.

The event inspector's **Location** selector supports a fixed center or a random
location for food, enemies, weapons, items and objects. **Formation** selects a
single element, a straight line or an equally spaced circle. Groups contain
2–100 copies of the selected type and remain one timeline entry; selection,
duplication, deletion and dragging apply to the entire event. A level may spawn
at most 2000 elements across all events. All copies inherit the event's timing,
lifetime, shield, carrier flags and object attributes.

Lines accept an angle in degrees (0 is horizontal, 90 points downward). Optional
**Length (%)** / **Diameter (%)** uses the shorter playable dimension; blank
uses automatic sizing (55 units between line members, or a 176-unit circle
diameter, capped to fit). Fixed formations remain centered on their authored
point and shrink uniformly if necessary to fit near an edge. Their centers must
leave room on both sides along the formation's axes. Random groups
choose a center that keeps the whole formation inside the playable area.
Random Saw Blade, Ditto Stamp and Paintbrush formations also shrink as necessary
to preserve their required clearance from boundary bricks.
Wheel, Snake and Robo Cow members each snap to the nearest edge, which can
change the formation's shape. The editor shows representative random locations
at the center; actual random locations are selected once per spawn warning and
reused when the event appears. Dragging or nudging a random marker changes its
event to a fixed location. Only single fixed events can connect to brick spawners.

JSON represents random locations with `"random": true` instead of `x` and `y`.
Optional `group` holds `shape` (`"line"` or `"circle"`), `count`, optional
`size` (0.001–1 of the shorter playable dimension) and an optional line `angle`
(0–360 degrees). Omitting `group` preserves individual placement behavior:

```json
{ "time": 5, "kind": "food", "type": "S", "random": true, "lifetime": 10,
  "group": { "shape": "circle", "count": 8, "size": 0.6 } }
```

Random enemy and item events can use `randomCount` (2–100) to spawn that many
independent copies at the same time and with the same attributes. Each copy is
given a separate random position; it cannot be combined with a formation:

```json
{ "time": 5, "kind": "enemy", "type": "mouse", "random": true,
  "randomCount": 4, "shield": "green" }
```

Cat Brick consistency checks count every member of grouped or independently
randomized pickups, carriers and chests, so repeated placements cannot bypass
the one-Cat-Brick limit. Grouped keys and key carriers contribute their full
counts toward chest requirements.

```json
{
  "version": 1,
  "id": "My level",
  "duration": 60,
  "goal": 20,
  "heartCost": 10,
  "brickSet": 3,
  "events": [
    { "time": 0, "kind": "weapon", "type": "wood", "x": 0.5, "y": 0.5 },
    { "time": 2, "kind": "food", "type": "S", "x": 0.3, "y": 0.4, "lifetime": 5 },
    { "time": 5, "kind": "enemy", "type": "mouse", "x": 0.7, "y": 0.6 },
    { "time": 10, "kind": "enemy", "type": "wheel", "x": 1, "y": 0.3 }
  ]
}
```

Food types are `S`, `P`, `B`, `C`, `L`, `F`, `H`; enemy types are `mouse`,
`wheel`, `ram`, `bucket`, `ball`, `jackolantern`, `snake`, `goalie`,
`robo-koshi`, `robo-snail`, `robo-cow`, `robo-unicorn`, `robo-crab`, `robo-love-bug`; weapon types are `wood`,
`bronze`, `silver`, `gold`, `hammer-bronze`, `hammer-silver`, and `hammer-gold`.
Item types (`kind: "item"`) include `cat-block`, `key`, and `treasure-chest` as
well as the power-ups. Enemy events can carry any item by setting
`"carriesItem": "item-id"`; the editor's **Carried item** menu lists all item
types. Carried items drop at the enemy's position when it is defeated, and a
carried treasure chest requires one key. Cat Blocks can be placed directly,
carried by an enemy (`"carriesItem": "cat-block"`), or put in a chest.
Legacy `"carriesCatBlock": true` and `"carriesKey": true` enemy settings remain
supported.
Chest events accept `"keysRequired"` (a positive whole number, default 1);
collecting keys adds to the HUD counter, and opening a chest spends the required
keys. In the editor, enable Cat Block in level settings and choose its **Trigger
type**. Only the relevant amount, enemy type, and brick type options appear.
Hints are generated with the prefix `To earn Cat Brick: ` and shown in the game.
The editor shows a live, read-only objective reference with the chosen variables
filled in. This exact text is also used in the starting briefing and the Cat Brick
hint in level details, without extra text appended to the hint.
Campaign pickup, enemy-carrier, and treasure-chest rewards also use these standard
descriptions, without changing their placements, schedules, or requirements.
The collapsible **Cat Brick** section uses compact trigger names and shows only
the required parameter fields. Acquisition messages are built into the game,
not editable per level. Boundary brick presets are no longer selectable in the
editor; imported levels retain their existing preset and individual bricks remain
editable. The editor omits instructional helper paragraphs but retains validation
errors and action status.

The 17 triggers cover spawned pickups, carriers, chests, completion time, food
points, enemy points, soccer goals, moves, minimum/maximum defeats of a selected
enemy type, maximum total defeats, no swords, no hearts, minimum/maximum distinct
bricks of a selected type, and avoiding selecting/touching a selected brick type.
Pickup/carrier/chest triggers use authored events or spawners; configure chest
key requirements on the chest event. Achievement rewards are automatic: minimum
enemy defeats can earn the block during play; all other achievements are checked
at victory. All rewards require victory to keep.

Distinct bricks are the separate bricks remaining on the board at completion,
not visits or selections: a merged group counts as one. Brick types include
base types and modifiers (such as Spawning); selecting/touching restrictions
remember the types present at the time, even if a brick later changes.
Defeat counts count enemies, not their shield-dependent point values, and exclude
enemies removed without awarding defeat points. Picking up a heart counts even
at full health; swords count even if replaced or exhausted later.

Custom JSON stores `catBlock.trigger` as `{ "type": "food", "amount": 30 }`.
Trigger type IDs in the order above are `spawn`, `carrier`, `chest`, `time`,
`food`, `enemyPoints`, `goals`, `moves`, `enemyMin`, `enemyMax`, `enemiesMax`,
`noSwords`, `noHearts`, `bricksMin`, `bricksMax`, `noSelect`, `noTouch`.
Enemy-specific triggers also require `enemyType`; brick-specific triggers require
`brickType` (a base kind or modifier name). Amounts are nonnegative whole numbers,
except `time`, which accepts positive fractional seconds and uses a strict
less-than comparison. Descriptions are regenerated from validated triggers.
Legacy levels without a trigger keep their existing hints and pickup behavior.
Printing JSON and playtesting check that Cat Brick
sources agree with the selected trigger. Pickup, carrier, and chest triggers
require a matching source and reject conflicting source types; achievement
triggers reject physical Cat Block sources. Chests require enough potential keys
from placements, carriers, or active spawners (including Battery-powered repeats).
Each level may include at most one physical Cat Brick source across pickups,
enemy carriers, treasure chests and spawners, including legacy levels without a
trigger. Checks use the effective, merged board rather than superseded brick overrides.
Incomplete configurations can be edited and imported but cannot be saved until
consistent. Existing campaign data is unchanged.

`brickSet` is 1
or 3 slow/fast bricks each. `heartCost: null` disables heart spawning.
Enemy events can carry keys with `"carriesItem": "key"`. A carried item is
displayed beside the enemy in front of boundary bricks and drops at its position on defeat, remaining
collectible until the level ends. Omit a chest event's `lifetime` to
keep it available until opened or the level ends.
Random pickups keep 80 game units between their centers and live or queued
pickups when space permits. Failed random retries trigger a whole-board search
before spacing is relaxed; a crowded board uses the roomiest available location.
Scattered food also reserves space between pieces in the same batch.
Explicitly placed items retain their authored coordinates.

Objects use `kind: "object"` and have no lifetime or shield. Soccer balls
persist until scored or the level ends. Custom levels can also place red,
green, and blue bumpers (`bumper-red`, `bumper-green`, `bumper-blue`); they
have a 96-unit diameter, stay fixed unless attached to a Cat Track, and bounce Koshi and enemies away. Red increases Koshi's speed by
25%, green preserves it, and blue reduces it by 25%.
Bumpers block Robo Jackolantern fire in their circular shadow, like obstructions.
Placed bumpers and bumper spawn templates display at their actual 96-board-unit
diameter in the editor, including grouped placements and both preview orientations.
Their shaded colored faces and concentric white rings are fully opaque.
Their two-second appearance warnings and overlap clearing use the obstruction
rules, including lethal overlap with Koshi and unscored environmental enemy deaths.
A bounce off any bumper, fixed or fired by a bumper gun, that forces Koshi into a
brick kills him immediately, even while protected.
Standing at a bumper gun's muzzle is safe: if its new shot overlaps Koshi, it
launches him outward without damage, preserving his sideways offset. The launch
cannot pass through a blocking brick; an actual pinch still kills him.
Food, weapons, items and healing hearts cannot overlap bumpers or obstructions:
random pickups avoid them, and covered live or queued pickups are removed.
Custom levels can also place blue, green and red bubbles (`bubble-blue`,
`bubble-green`, `bubble-red`); they trap Koshi for the same 5-, 3- and
1-second durations as the corresponding slime colors.
Cat Circles (`cat-circle`) are dark-green, semi-transparent rest spots with a
cat-head icon, the same size as bubbles. Contact smoothly pulls Koshi to the
center, after which he can be redirected immediately. Cat Circles remain in
place after use; bricks and bumpers take priority if they block the route.
Circle and diamond obstructions (`obstruction-circle`, `obstruction-diamond`)
are fixed solids, each 96 units wide and tall (twice a bumper's diameter).
Their large variants (`obstruction-circle-large`, `obstruction-diamond-large`)
are 192 units wide and tall. Long rectangles come in four variants:
`obstruction-rectangle-horizontal` (192 by 48 units),
`obstruction-rectangle-vertical` (48 by 192),
`obstruction-rectangle-horizontal-large` (384 by 96), and
`obstruction-rectangle-vertical-large` (96 by 384).
All variants have shaded boundary bevels for depth, with a light upper-left
edge and dark lower-right edge, without changing their collision shapes.
Optional `width` and `height` resize obstructions in board units (1–10000).
Circles and diamonds keep equal dimensions; specifying either dimension sets
their diameter. Rectangles allow independent width and height. Omitted dimensions
retain the selected variant's defaults. The editor offers numeric size controls
for placements and obstruction-spawning bricks; blank fields restore defaults.
Choosing a normal/large shape starts with its fixed default size, never the
previously edited shape's dimensions. Select a placed obstruction to reveal
its tight bounding rectangle, then drag any corner or side handle to resize.
Rectangles resize independently; circles and diamonds stay square. The opposite
side/corner stays anchored until the center reaches the playable area's boundary.
Numeric controls and exported dimensions reflect the resulting size.
Optional `spiked: true` covers the entire exterior with white spikes like Spikes
Bricks. The editor's **Spiked** checkbox toggles this for placements and
obstruction-spawning bricks, including multi-selection. Touching a spike costs
Koshi one heart (or one shield layer), respecting normal damage invulnerability.
Remaining in contact does not deal repeated damage; leaving and touching again
can hurt him again. Spikes do not damage enemies or change the solid's movement
or destructibility. Omitted or false means no spikes. Existing levels are unchanged.
Optional `destructible: true` marks an obstruction with a centered black-on-white
`TNT` sign surrounded by a red rectangular border. The item-sized sign is always
36 by 26 board units (plus its border), regardless of obstruction size.
Its white face and red rim have directional shading, a highlighted bevel and a
small drop shadow for a raised appearance.
Defaults remain indestructible.
Any intersection with a fireball turret's 117-unit-radius damage zone destroys
the entire marked obstruction immediately, removing its collision shape.
It crumbles into fragments, grey dust and scattered small orange/red explosions
over 1.2 seconds. Lasers, other attacks, and destruction dust do not trigger it.
The animation freezes on pause, finishes after a win/loss, and clears on restart.
These options are available for custom levels. In the campaign, Levels 3-5,
3-10 and 3-11 introduce fixed, destructible and appearing obstructions.
They block Koshi and every enemy, including perimeter robots and every snake
segment. Robo Wheels, Robo Snakes, and Robo Cows turn around when an obstruction
blocks their boundary travel, as they do at Barrier fences. Cow walking quotas
keep counting actual distance in either direction. Obstruction contact changes
Koshi's position only: Koshi slides along the
surface or remains stuck when aimed directly into it, while his intended
velocity and steering target remain unchanged. Actual brick and bumper
collisions retain their usual effects.
When obstructions are present, the dotted trajectory forecasts Koshi's actual
no-click motion, curving along obstruction surfaces or ending where he becomes
stuck instead of continuing through the shape toward the original target.
The forecast uses gameplay's collision substeps without changing live state,
and still accounts for one spring reflection or bumper deflection.

The editor lists each shape, size and orientation once. Its **Obstruction texture**
controls offer the same fixed **100 color presets** for base and pattern colors
across all shapes and levels: ten greys from white to black, plus pale, muted,
bold, dark and deep shades spanning the color spectrum and browns.
Expand either preset palette to select a numbered hex swatch, or use the
color inputs to choose custom colors. The texture choices are **Solid**, **Polka dots**,
**Stripes**, or **Checkered**. These options also appear for obstruction
spawners; appearance has no effect on collision geometry. Optional JSON fields
`color` and `patternColor` accept six-digit hex colors; `pattern` accepts
`solid`, `polka-dots`, `stripes`, or `checkered`. Defaults are `#718596`,
`#dbe6ed`, and `solid`. For example:

```json
{ "time": 0, "kind": "object", "type": "obstruction-diamond",
  "x": 0.5, "y": 0.5, "color": "#7153b2",
  "pattern": "checkered", "patternColor": "#dfd6f4" }
```

Obstructions persist until the level ends and are available only for custom
placements and spawners; no campaign placements are added.

### Cat Tracks

Cat Tracks are fixed, translucent dotted paths, dark green like barrier fences by default. They are
not collision barriers. In the editor, choose **Tracks** in the right-hand
category menu to find **Cat Tracks**.
Choose **Draw replacement nodes**, then click the board to add connected straight
segments in order (respecting **Discretize X, Y**). Set its speed,
power color, and optional **Closed loop**, then choose **Apply track**.
Select an existing track from the menu or click its dotted path to show numbered
nodes. Drag individual nodes to reposition them, or focus a node and use the
arrow keys. Saved tracks update when a drag ends; invalid moves are reported and
reverted, and cancelled drags leave the track unchanged. Nodes are placed and
edited visually, without a coordinate-entry text box.
Open paths reverse at each endpoint; loops close automatically, so do not repeat
the first node. A track cannot intersect, touch, or overlap itself except at
adjacent segment endpoints. Different tracks may cross without joining.

Select one or more single, fixed obstructions or bumpers, choose an existing
track, then **Attach selected objects**. Each object's center starts at the
nearest track point and moves continuously at the track's speed, independent of
other attached objects. Its scheduled appearance time and existing attributes
remain intact. Random placements and formations must be changed to single fixed
placements before attachment. Detach objects before converting them to spawning
brick templates. **Detach selected objects** removes their track assignment;
deleting a track detaches all its objects. Neither action deletes the objects.

Yellow and dark grey tracks use the shared Power Brick switch: yellow moves while
Power Bricks show yellow (`powerOn: false`), dark grey moves while they show black
(`powerOn: true`). Inactive tracks pause objects in place, preserving direction
and progress until reactivated. Dark green tracks always move. Game pause freezes all
track motion; restarting restores initial positions. Moving bumpers retain their
usual bounce colors. Moving solids resolve Koshi's position against bumpers,
obstructions, and bricks together; an inescapable pinch crushes him rather than
leaving him wedged. Steering away from a bumper remains possible during contact,
including on stopped or power-paused tracks.
Timeline playback/scrubbing previews movement using the starting power
color, not simulated player switch activations.

Version 1 JSON optionally contains `tracks` (up to 100), each with a unique
`id`, `nodes` (2–100, at least 3 for loops), boolean `closed`, and `speed` from
0–1000 board pixels per second. Optional `power` is `"yellow"` or `"black"`;
omit it for dark green. An obstruction or bumper event's `track` references its ID:

```json
{
  "tracks": [{
    "id": "track-1",
    "nodes": [{"x": 0.2, "y": 0.2}, {"x": 0.8, "y": 0.2}, {"x": 0.8, "y": 0.8}],
    "closed": false,
    "speed": 60,
    "power": "yellow"
  }],
  "events": [{
    "time": 0, "kind": "object", "type": "bumper-red",
    "x": 0.2, "y": 0.2, "track": "track-1"
  }]
}
```

These are fields within a complete level, not a standalone level file. Tracks,
attachments, and nodes survive JSON printing/loading and playtest links in both
orientations, including scrolling levels. Existing campaign levels are unchanged.

Duration is 1–3600 seconds, food/enemy/soccer goals are whole numbers from 0 to 100000,
heart costs are positive integers up to
100000, and a level supports up to 2000 events. Appearance times must be
nonnegative and strictly before the time limit; food lifetimes are
0.1–3600 seconds. Items and weapons accept the same range for optional `lifetime`;
omit it (or use `null`) for full-level persistence. JSON files imported through the file picker have a 1 MB limit.

Stopwatches come in red (`stopwatch`, +10 seconds), green (`stopwatch-green`,
+30 seconds), and blue (`stopwatch-blue`, +60 seconds). Each shows its bonus on
its face; collected bonuses add together. Existing `stopwatch` placements
remain red and keep their original +10-second behavior. All three variants
are available in the editor for timed placements and spawn bricks.

The Saw Blade instantly grows curved teeth spinning at full speed around Koshi until his next
non-cinder brick contact. That brick's entire current merged shape permanently
becomes solid, unselectable cinder, with a one-second shake, grey smoke, and
smooth visual fade. Contact modifiers are removed before firing; destroying
a Portal also removes the other endpoint's Portal attribute. Already-cinder
contacts preserve the saw. Saw pickups do not stack, and restart clears the
power and restores the original bricks. Pause freezes the transformation and
destruction animation. The item also appears in Cracker Causeway.

Robo Goalie (`goalie`) is an egg-shaped robot with three hair antennas, a long
metal nose, and a colorful striped soccer jersey with badges. He spawns at normal
enemy locations (or the custom placement marker), then travels toward the nearest
Goal brick at 67.5 board units per second instead of teleporting into position.
If his goal is removed, he travels from his current position to the nearest
remaining goal. Once there, he moves across its mouth at the same speed,
intercepting incoming soccer balls rather than chasing Koshi. He also tracks
nearby balls within 240 units, anticipating up to 0.6 seconds of their rolling
motion. A gentle five-unit side-to-side sway keeps him moving around his
defensive target, or the goal center when no ball is nearby.
Overlapping goalies draw from top to bottom, so the lowest on screen is in front;
their defeat animations use the same ordering.
Crowded goalies yield instead of cancelling each other's movement. A stable
push priority uses their spawn screen height (lower on screen first, spawn order
breaks ties), so the leading goalie keeps moving while lower-priority guards are
pushed aside, or inward from the goal when the boundary blocks sideways yielding.
Total movement, including collision pushes, is capped at 135 board units per
second. Crowded or overlapping guards separate gradually instead of jumping;
sleeping goalies cannot be displaced.
He cannot hurt Koshi, but swords and Boost
defeat him; optional shields and enemy-point awards work normally.
Music Box stops him; Spooky Mask makes him retreat along his goal at 64 units
per second. His jersey falls off on defeat, exposing a plain robot shell,
then he blushes pink and explodes in a 1.8-second animation. Without any Goal
brick he immediately dies without awarding points. Goalies support custom
placements, spawn bricks, preview icons and cutscene actors. Campaign levels
and spawn schedules are unchanged.

Music Box (`music-box`) puts enemies to sleep for ten seconds, with a scrolling
musical score for the whole effect. Another pickup refreshes ten seconds.
Pause freezes the sleep and animation; restart clears both.
Simultaneous Music Box, Magical Sunglasses, Kitty Cape and Spooky Mask banners
occupy separate, vertically spaced rows so their graphics do not overlap.

Kitty Cape (`kitty-cape`) is a green cape matching Koshi's title-screen cape.
It doubles Koshi's movement speed immediately for ten seconds, including
current flight, redirects, spring bounces, and portal travel. Boost launches
double that speed again; conveyor rides retain their normal pace.
A translucent rectangle of cat heads and lightning bolts scrolls behind
gameplay and exits when the power ends. Another pickup refreshes ten seconds
without stacking speed. Pause freezes the effect and animation; restart clears
both. Available in custom-level placements and item spawners with optional
ground lifetimes. Level 3-3 introduces it in the campaign.

Cat Shields (`cat-shield-red`, `cat-shield-green`, `cat-shield-blue`) absorb
one, two, or three hits respectively before Koshi loses a heart. Each absorbed
hit weakens the shield from blue to green to red; collecting another shield
replaces the current one, even when it has fewer hits. A circular shield
surrounds Koshi in its current color. All three are available for
custom-level placements and item spawners; no campaign placements are added.

Magical Sunglasses (`magic-sunglasses`) have sparkling, color-cycling frames.
They fly onto Koshi's face and bypass cooldowns, Toggle locks, and exhausted
Crumblers for ten seconds; cinder and absorbed bricks remain unselectable.
When worn with Spooky Mask, the glasses stay on top during play and endings.
Clicks during the effect do not add cooldowns, consume Crumbler uses, or advance
Toggle counters. All brick cooldowns are completed when the effect ends;
Toggle locks and exhausted Crumblers resume their stored state.
Contact effects (including slime) still apply.
A translucent, rectangular star-and-smiling-cat banner slides behind gameplay,
using the same width and ten-second duration as the music-box score.
All bricks glow in the same cycling colors as the glasses, including cinder
and goals; their selection rules and contact properties remain unchanged.
The glasses fade from Koshi's face after expiry. Another pickup restarts the
ten seconds rather than stacking them; pause freezes the effect and visuals.
They are available in the editor and spawn bricks, and introduced in Level 2–18.

Ditto Stamp (`ditto-stamp`) is an orange wooden stamp with a round knob,
wood-grain lines, a straight-on side view and an even, flat grey rubber pad beneath
the wooden base, without sparkles,
a background or a cast shadow.
After pickup it floats beside Koshi until his first stop on a non-Portal brick.
It presses onto that brick's center to capture its properties, then returns
beside Koshi with matching ink. The next landing presses onto the destination's
center and copies all that source's properties before
contact effects run, but keeps its own position, size and current merged shape.
Cooldowns, Crumbler uses, Toggle counters, spawners and warp timers start fresh;
spawner settings are copied independently. Portals neither supply a copy nor
consume the stamp. Merging Warped bricks can be copied without copying their
geometry. Midair redirects and Portal travel retain the captured source.
Picking up a stamp while already resting waits for a new landing; Spring
bounces do not capture a source because Koshi does not stop. Extra pickups
do not stack; a held Saw Blade takes priority and preserves the stamp.
Both presses travel to the brick center and squash against it; a colored ripple
marks the destination transformation.
Pause freezes the animation; reset clears the item and restores level bricks.
Timed placements, optional lifetimes and spawn bricks are supported in the editor.

Paintbrushes are available in three shapes, each in red, green and blue:
`paint-pencil-{color}` (thin pencil-like brush with paint on its tip, 1 use),
`paint-wide-{color}` (angled bristles with painted tips and a small downward drip
from the longest bristles, 3 uses), and
`paint-roller-{color}` (soaked, dripping roller, 5 uses).
The next eligible brick contacts change the brick's cooldown type: red is Fast
(3 seconds), green is Normal (8 seconds), and blue is Slow (15 seconds).
Painting makes the brick ready but preserves all other attributes, spent
Crumbler/Toggle/spawner state, and merged geometry. Matching-color contacts
do not activate the brush, spend uses, or refresh the brick's cooldown.
Goal and Cinder contacts
do not spend paint. Spring bounces and Portal contacts count; staying against
a brick does not spend repeated uses. Another brush replaces the held brush
and remaining uses. A Saw Blade takes priority without using paint; Ditto Stamp
acts before paint. The held brush and remaining count appear beside Koshi.
Each successful recoloring swings the brush and bursts matching red, green,
or blue paint outward from the exact brick face Koshi touches. A large outlined
splat and highlighted droplets spread over 100 board units into the arena,
staying bold before fading over 1.4 seconds. The paint stain on the brick
is clipped to its actual members; the airborne spray is not clipped. The final
use still finishes its brush swing; pause freezes both animations.
Random placements, reserved spawns, and item spawners use the same brick
clearance as Ditto Stamp; explicit editor markers retain their positions.
Saw Blades use this same clearance for random spawns and spawners, including
rechecking reserved positions when they appear; explicit Saw Blade markers
also retain their positions.
Optional on-screen lifetimes are supported. Level 3-2 introduces brushes in
the campaign. Restart clears paint and restores
the original bricks.

Barrier bricks (`barrier: true`) extend a dark green translucent fence when
successfully selected, and retract it on the next successful selection. Normal
cooldowns and selection locks apply. The fence grows at 180 game units/second
from the center of the arena-facing surface, perpendicular to the brick, until
it reaches another brick, fence, or the level boundary. Gaps between boundary
bricks cannot let a fence extend outside the level; scrolling levels use the
full level boundary, not the current camera edge. Retraction uses the same speed. Koshi passes
through; all enemies and flying Bucket bombs are blocked and bounce or reverse.
Wheels remain on their perimeter route. Pause freezes fences and restart clears
them. Fence push-outs choose positions within the enclosing bricks, so enemies
cannot be pushed outside the arena at fence endpoints or corners.
Removing the Barrier surface, destroying the brick, or absorbing its owner
removes its fence; merged owners use their current combined surface center.
Barrier is an exclusive surface available in the editor, with matching fence
icons and guide practice. Level 2–22 introduces fences; 2–23 reuses them against fire.

Robo Ball (`ball`) is an orange robot basketball with dark grey seams, two beady
red eyes and a rectangular mouth with a grey tooth grate. It travels at 120
board units/second in straight lines, bouncing off enclosing bricks, barriers
and other enemies without pausing or charging. Music Box puts it to sleep;
Spooky Mask makes it flee harmlessly with a scared face and sweat.
Standard shields, contact damage, swords and Boost attacks apply. Its 1.1-second
death animation shrivels the ball, pops both eyes into the air, then fades away.
Pause freezes movement and death animation; restart clears it. Available as an
editor placement, spawn-brick enemy and cutscene actor, with guide practice.
Level 2–10 introduces Robo Ball; the original 19 levels are unchanged.

Robo Jackolantern (`jackolantern`) wanders at 32 game units/second, pauses for a
half-second warning, then stomps every four seconds. Each stomp creates a
square fire ring centered on the stomp location, expanding continuously at
120 game units/second. Fire contact costs one heart with normal damage
invulnerability. Bricks, Barrier fences, and obstructions permanently extinguish only the
portions they intercept; unblocked portions continue expanding. Other enemies
do not stop the fire. Sleep freezes stomps and waves; fear freezes the attack
timer and makes existing waves harmless while the pumpkin flees. Defeating
the owner extinguishes its waves. The orange pumpkin has grey robotic eyes,
a yellow carved nose and mouth, and a metal antenna in place of its stem.
During its 1.2-second defeat animation, the nose and mouth dim grey, the antenna
snaps in half, and the body bursts into fading pieces. Available in the editor,
spawn bricks, custom cutscenes and guide practice; Level 2–23 introduces the patrol.

Robo Snake (`snake`) follows the inner perimeter like a Wheel at 95 units/second.
Its grey head has yellow eyes with black slit pupils and a flicking forked tongue;
its three spiked body
panels show a grey plus sign, thin oval buttons and unlettered red circular
buttons, with large symmetric grey shapes and red stripes. The tongue emerges
from underneath the head shell. Only the head can be damaged.
Body contact hurts even during sleep or fear, with Koshi's normal damage immunity.
Every segment blocks enemies and soccer balls; fences block the entire snake.
On reversal, the head leads and each following segment turns at the same point
in sequence instead of flipping the whole body at once. Fear changes only the
eyes within their existing sockets and retains the sweat effect.
Its 1.2-second death scatters and fades the segments and spins the tongue away.
Available in custom placements, spawn bricks, cutscenes and tutorial practice;
Level 2–17 introduces head interception; the original 19 levels remain unchanged.

Robo Koshi (`robo-koshi`) is a dark-grey robotic copy of Koshi with red square
eyes and one antenna. It waits one second after spawning, then moves at Koshi's
420-unit/second base speed to the position Koshi occupied at spawn. After
arriving, it replays Koshi's recorded path, trailing by the one-second wait plus
the time it took to reach that position. Its 1.1-second death animation shrinks
and fades the head amid extra smoke puffs. Available in custom placements,
spawn bricks and cutscenes. Level 3–14 introduces it in the campaign.

Robo Love Bug (`robo-love-bug`) has square red eyes, a dark grey head, dark red
legs and antennae, and pink wings sharing a purple heart. It shuffles its tiny
legs and bounces like Robo Ball at 120 board units/second. Swords, hammers,
Boost and both turret attacks cannot damage it or strip its shields, and do
not spend weapon uses on it. It still hurts Koshi on normal contact.

Love Bugs die only when alone: a single visible bug dies automatically, as
does the only visible bug in a region closed off by Barrier fences. Any open
route around unfinished or retracted fences keeps companions connected;
straight-line visibility is not required. Only Barrier fences divide these
regions, not other enemies, bumpers or obstructions. Spawn previews and
offscreen bugs are not companions; offscreen bugs wait until they enter the
visible scrolling screen. Isolation ignores shields, sleep and fear, awards
normal enemy points, and drops carried items. Decisions use a simultaneous
snapshot so groups are not removed in array order. Sleep and fear affect
movement normally, and pause freezes everything.

Its 1.5-second death first swells blue tears over its eyes, then separates its
head and two wings, and ends with the same explosion as Robo Wheel. Available
in custom placements, spawners, editor graphics, guide, cutscenes and a Barrier
practice lesson. Existing campaign levels are unchanged.

Robo Crab (`robo-crab`) has a grey body, red arms and opening pincers, shuffling
mechanical legs, and blinking green pixel eyes on stalks. Each crab randomly
chooses a horizontal or vertical back-and-forth patrol at spawn by default.
The editor's **Crab direction** selector sets **Horizontal**, **Vertical**, or
**Random** for placements (including formations); crab spawners have the same
choice. Custom JSON uses `"crabDirection": "horizontal"` or `"vertical"` on
the enemy event or spawner; omit it for the existing random behavior. It alternates
between slow (45 board units/second) and fast (150 units/second), starting slow;
each interval independently lasts 3 to 15 seconds. Its mouth opens wide during
the final 0.65 seconds before either speed change, without stopping its patrol.
Walls, fences, solid obstructions, bumpers and robots turn it back without
changing its patrol axis. Normal collision separation may nudge its lane.
Music Box freezes its patrol and speed timer; Spooky Mask uses normal harmless
fleeing, suspending the speed timer until it resumes its chosen patrol axis.
Swords and Boost defeat it normally, with standard shield support. Over its
1.5-second death animation, its eyes and pincers fly off, its mouth opens into
a big frown, and a smoke puff expands and fades. Available in custom placements,
enemy spawners, the guide, tutorial practice and cutscenes; no existing campaign
levels are changed.

Robo Snail (`robo-snail`) is a green, continuously wandering enemy that moves
slightly faster than Robo Mouse. Its blocky grey-and-brown spiral shell sits
behind a tall green head with upright stalks, horizontal red eye grilles, and
an arched mouth with square teeth. The shell has a tall octagonal outline and
an angular inward spiral. Its mouth opens and closes and its eyes bounce gently
while alive. When defeated, this idle motion stops, its antennae shrink,
its body retreats into its shell, and the shell splits and fades
over 0.9 seconds. Defeating it freezes all brick cooldowns for 20 seconds and
shows a scrolling slug-and-turtle ribbon. Already-running cooldowns retain
their remaining time and displayed recharge progress for the entire effect;
bricks hit during the freeze begin
their cooldowns after the freeze ends. Available in custom placements, spawn
bricks and cutscenes. Level 3-6 introduces it in the campaign.Robo Cow (`robo-cow`) walks only along the board perimeter at twice Robo
Wheel's speed, initially clockwise, turning around when it reaches an active
Barrier fence. Its legs face the bricks and
alternate as it walks, stopping while it eats or sleeps, with quick, smooth
quarter-turns at the corners. It chooses a walking distance of two to six average
original perimeter-brick lengths, with four most likely (10%/20%/40%/20%/10%).
The average length is the playable perimeter divided by its original brick count.
All forward and backward walking counts toward that distance, so even a cow
confined to one brick eventually stops to eat. After meeting that distance quota,
it continues to the first original-sized brick center it reaches, keeping the
cow centered on its grass strip. Barrier turnarounds still apply while seeking
that center. It eats the brick under its feet; after bobbing its head for five seconds, it turns that brick
(including any merged members) into cinder. Cinder and Goal bricks are skipped
and a new walking distance is chosen without changing direction.
Once eating starts, enemy collisions cannot displace the cow from its grass
position, including contact with another perimeter enemy or any snake segment.
As eating begins, a thin, six-unit grass strip fades in just beside the inner
face of the original-sized brick section, at the cow's feet rather than over
the brick or its body. A straight edge wipes the grass away at a constant speed,
emptying exactly when the five-second eating timer destroys the brick.
Spooky Mask immediately cancels eating and removes the grass without changing
the brick. The cow flees instead (unless asleep). When fear ends, it chooses a
fresh two-to-six-brick walking distance from its current position; interrupted
eating never resumes.
Its 2.1-second death animation first pops off the head and releases the neck
spring while the body and legs remain still; only then do the legs detach,
the body drop, and the explosion begin. Robo Unicorn
(`robo-unicorn`) has a curved horse-head-and-neck silhouette inspired by
`unicorn.png`, with pink skin, a flowing rainbow mane, a yellow horn and eye,
and grey mechanical mouth and teeth. It floats faster than Robo Mouse, pausing for about a second
with its mouth gaping exaggeratedly wide while it aims, then charges at the nearest food with its
mouth open. While charging it turns sharply and eases off when the food is far off-heading, so it
cannot orbit food without reaching it. Its artwork rotates smoothly toward its travel direction
rather than snapping at wall bounces. It eats food
only while charging. When no food remains it turns red, moves continuously,
and speeds up. On death its horn launches away and its body becomes a 180-degree
rainbow arch whose angle shrinks to zero from one end. Both enemies are
available in custom placements, spawn bricks and cutscenes. Levels 3-12 and
3-13 introduce Robo Cow and Robo Unicorn in the campaign.

Blue, green and red Bubbles (`bubble-blue`, `bubble-green`, `bubble-red`) are
custom-level objects slightly larger than Koshi. Contact pulls Koshi smoothly
to the center, where he is held for the matching slime duration: 5, 3 or 1
seconds. Enemies can still hurt him, and he can still attack with his sword.
Cat Circles (`cat-circle`) are small, fixed, dark-green rest spots. Like a
bubble, contact pulls Koshi smoothly to the center; unlike a bubble, there is
no timed hold and the circle is never consumed. Koshi can be redirected as soon
as he reaches the center. Bricks and bumpers take priority when they block his
route.
A thin ring around Koshi steadily loses arc length from capture until release.
When it reaches zero, the bubble bursts into fading watery ripples and droplets.
Pause freezes the countdown and pop animation; restarting clears them.

Smiley Cookie, all Stopwatches, Battery, Music Box, Eggplant, Saw Blade,
Magical Sunglasses, Ditto Stamp and Spooky Mask remain available for custom
levels and receive dedicated introductions in Levels 2–11 through 2–21.

Spooky Mask also shows a translucent scrolling banner of ghosts and demon
heads for its ten-second fear effect, on a separate row from other active
power-up banners. Pause freezes it; it exits at expiry.

Spooky Mask (`spooky-mask`) is a shaded red devil face with yellow slit-pupil
eyes, pointed ears and nose, horns, and many sharp teeth. It flies onto Koshi's
head for ten seconds, then fades away. All enemies, including new spawns, become
scared and try to move away from Koshi, with widened eyes, open mouths and flying
small sweat drops flying in independently random directions while moving,
at two drops per second per enemy. All afraid enemies flee at a constant pace of
64 game units per second. Mice do not pause and Rams do not target or charge;
their normal cycles resume after fear ends. Wheels can reverse but stay on
their perimeter, and Buckets pause their bomb-throwing timer. The mask's small ears
have distinct dark outlines and inner-ear shading.
Scared enemies cannot hurt Koshi on contact or throw new bombs. Existing bombs
keep animating but cannot damage him during fear. Attacks and damage resume after
expiry. Shields, movement bounds and enemy collisions are unchanged.
Music Box sleep takes priority over fleeing. Repeat pickups restart the ten
seconds, pause freezes the effect and visuals, and reset clears it.
The item supports editor placements, optional ground lifetimes and spawners.

`goal` is the food target, optional `killGoal` is the enemy-defeat target, and
optional `goalsGoal` is the number of soccer goals required.
For score objectives, at least one must be positive; all positive targets must
be reached. For survival, set `survive: true`, `goal: 0`, `killGoal: 0`, and
`goalsGoal: 0` (or omit the optional fields). Survival cannot be combined with score objectives.
Older JSON without the new fields retains its original food-only objective.

### Boom Helmet and Boom Time

Set the optional custom-level `activationLimit` to a whole number from 1 to
100000, or leave the editor field blank (`null` or omitted) for unlimited play.
This difficulty modifier works alongside survival or any score objectives.
Pressing Start drops a round blue, fused Boom Helmet onto Koshi's head.
Its white circle displays the remaining successful brick activations in black.
Each accepted selection spends one, including mid-flight redirections and
selections made with Magical Sunglasses. Failed, cooling, disabled, invalid,
or blocked clicks and physical brick contacts do not spend charges.

Reaching **zero explodes immediately**, stops movement, and triggers Koshi's
normal loss/death animation regardless of hearts or invulnerability. Complete
the level before using the last charge. Pause freezes helmet motion and effects;
restart restores the original limit.

Boom Time is a bomb-shaped clock pickup, not a level-time bonus:

| Item ID | Color | Helmet charges |
|---|---|---|
| `boom-time-red` | Red | +1 |
| `boom-time-green` | Green | +3 |
| `boom-time-blue` | Blue | +8 |

They add charges only to an equipped, unexploded helmet; without a helmet,
pickup has no effect. They support normal item lifetimes and spawning bricks,
editor placement, pickup effects and guide illustrations. Activation limits and
Boom Time pickups are introduced together in Level 2–24.

### Soccer balls and goal bricks

Soccer balls are ordinary black-and-white balls, not enemies or pickups.
Moving Koshi kicks them on contact; an off-center bump sends the ball off at an
angle. Swords and Boost do not collect or damage them, and sleep/fear do not
affect them. They bounce from actual bricks, enemies, and Barrier fences.
Friction slows them by 100 game units/second each second until they stop.
Boundary gaps and collision push-outs cannot move balls behind the enclosing
bricks; escaped balls are returned inside without closing goal openings.
Koshi can push balls out of corners: kicks near two enclosing walls redirect
the ball inward, since his larger head cannot get behind a cornered ball.
Untouched balls remain stationary; ordinary wall rebounds and goal shots are unchanged.
Kicks are capped at 650 game units/second; enemy rebounds retain 80% of the
normal relative speed. Enemy movement and health are not changed by ball contact.
Balls may be scheduled placements or single-use spawning-brick objects.

A Goal (`kind: "goal"`) replaces a boundary brick with top-down white netting
and a silver metal frame, open toward the board. It remains solid to Koshi and
enemies, but is never selectable, even with sunglasses. Saw Blade and Ditto
Stamp cannot change or copy it, and Warped bricks cannot absorb it. Goal bricks
have no modifiers or contact surfaces and can combine only with other Goals.
A ball scores when its center crosses the board-facing opening with clearance
between the posts. Wide shots bounce off the frame. Each scored ball disappears
once in a sparking cloud, increments Goals, and is removed from physics.
Pause freezes balls and clouds; reset clears them. Level 2–19 introduces a
three-goal objective with five scheduled balls; the original 19 levels are unchanged.

Example custom-level additions (fractions use the phone-layout convention):

```json
{
  "goalsGoal": 2,
  "events": [
    { "time": 0, "kind": "object", "type": "soccer-ball", "x": 0.5, "y": 0.5 }
  ],
  "brickTypes": [
    { "edge": "right", "start": 0.3, "end": 0.5, "kind": "goal" }
  ]
}
```

Individual brick edits are an optional `brickTypes` array, preserved in drafts,
JSON exports/imports, and playtest snapshots. Older levels without it use their
boundary preset unchanged. Each entry has an `edge` (`top`, `bottom`, `left`,
`right`), `start` and `end` fractions along that edge (left-to-right on top/bottom,
top-to-bottom on sides) in the **phone layout**, and `kind` (`slow`, `normal`,
`fast`, `cinder`, `goal`). Desktop rotates these saved slots clockwise, including reversing
slot order when phone left/right edges become desktop top/bottom.
Optional
`crumbler` is an integer selection limit (1–100000); `warped` is a duration
in seconds (0.1–3600). Set either to `null` to explicitly remove that attribute.
Optional `power` is a boolean; `true` adds a Power Block switch and `false`
removes it. Level-wide `powerOn` is an optional boolean specifying the shared
starting state (default `false`, yellow face). Gameplay changes to this state
are not exported; all Power Blocks switch together.
Optional `hazard` is `null` (remove the surface) or an object with `type`:
`laser`, `flame`, `missile`, `bubble-red`, `bubble-green`, `bubble-blue`,
`bumper-red`, `bumper-green`, `bumper-blue`, or `obstructor`. In the editor, select the
**Hazard** contact surface, then its type. Hazards operate continuously without
being touched or selected, and never damage enemies. Lasers fire inward through
Koshi, damaging him without blocking his movement, and stop at solid obstacles.
Flames cover the brick surface and damage Koshi on contact. Merged Flame hazards
draw fire only along the combined shape's exterior, never along internal seams.
Missiles fly at
150 board units/second and turn at no more than 0.65 radians/second, allowing
Koshi to dodge them into bricks, obstructions, or bumpers; impacts explode
without destroying obstacles or harming enemies. Bubble and bumper guns fire
straight inward at 120 board units/second, using the existing colored bubbles
and bumpers. Obstructor guns fire circular obstructions (radius 48, the bumper size) at the same speed; optional `hazard.color`/`hazard.patternColor` (`#rrggbb`) and `hazard.pattern` (an obstruction pattern) set their look like standalone obstructions, and are rejected on other hazard types. Obstructor shots block enemies and objects like other obstructions without harming them, shove Koshi without damage, and kill him instantly if they pin him against a brick. Each shot visibly pushes out of the brick face behind a fading
muzzle ring during its first half second (render-only; its collision position
is unchanged). All bubble guns suspend firing while Koshi is trapped; bubbles
already fired that reach the trapped Koshi pop to prevent a pileup.
Gun bubbles pop with the trap-escape pop animation when they hit a solid
obstacle. Bumper and obstructor shots pass through bricks, obstructions, and
bumpers, disappearing only once wholly off the board (the simulation area on
autoscroll levels). Cooling, exhausted, or Toggle-disabled bricks still operate their hazards,
just like other contact surfaces.

Each gun's optional `interval` is 0.1–3600 seconds, edited with **Hazard shot
interval**. The default is 10 seconds for missiles and 3 seconds for bubble/
bumper/obstructor guns; the first shot waits that interval after the brick appears on
screen. Timers pause while power disables the hazard, reset when the
brick leaves the screen, and do not advance while the game is paused. Continuous
laser/flame hazards do not accept an interval. Optional `hazard.power` is
`null` (no border, always operating), `"black"` (black border, active when
`powerOn` is true), or `"yellow"` (yellow border, active when `powerOn` is
false). This is an attribute of the hazard, not another brick type. Borders
are beveled black or yellow frames with quarter-circle corner plates joined by
rectangular bars, and bordered icons shrink slightly to stay clear of them.
Turning power off stops emission, not projectiles already fired. Hazard settings
survive import/export, playtesting, combining/splitting bricks, and Ditto
stamping. Existing campaign levels are unchanged.
Optional `slimed`, `springs`, `spikes`, and `conveyor` are booleans; `false` removes the attribute.
They are mutually exclusive: importing more than one as `true` in the same
override is an error, while enabling one in the editor replaces the others.
A later overlapping override enabling one also removes the others.
Optional `conveyorDirection` is `"clockwise"` (the default) or `"counterclockwise"`,
independent of cooldown color and preserved when switching surfaces.
Optional `portal` is `"red"`, `"orange"`, `"yellow"`, `"green"`, `"blue"`, or
`"purple"`; `null` removes it. Each color must map to exactly two physical
bricks after applying all overrides. Optional `boost` is a boolean.
Optional `spawner` is an object with `kind` and `type`, or `null` to remove it:
Optional `x` and `y`, both fractions from 0 to 1, select a fixed location in the
playable area. Omit both to keep existing random spawning. For example,
`{ "kind": "item", "type": "smiley-cookie", "x": 0.7, "y": 0.4 }` always spawns
at that location, including after Battery reactivation. Fixed locations adapt to
both board layouts; wheels, snakes and cows snap to the nearest playable edge.
Lifetimes begin at brick activation, not when the template was placed.

In the editor, select a spawning brick and enable **Use a specific location**
to enter X/Y percentages. Alternatively, place an object first, select one
spawning brick, choose **Connect placed object**, then click the object's marker
(or focus it and press Enter). This removes its scheduled event and stores its
type, coordinates, lifetime, shield and obstruction attributes in the spawner.
It remains visible as a **Spawn only** template, never as a scheduled duplicate.
Selecting the brick shows a thin dotted link to its template. Drag the template
or use arrow keys to move its spawn location; obstruction templates also retain
corner/side resize handles. Editing the brick updates its template immediately.
Escape or the connection button cancels linking. Unchecking fixed location
returns to random spawning. All settings survive save/export/import/playtest.

Spawner types:
`food` uses any food code plus a `lifetime` of 0.1-3600 seconds; `weapon` uses
`wood`, `bronze`, `silver`, `gold`, `hammer-bronze`, `hammer-silver`, or
`hammer-gold`; `enemy` uses `mouse`, `wheel`, `ram`,
`bucket`, `ball`, `jackolantern`, `snake`, or `goalie`;
`item` uses one of the item types above; `heart` uses type `heart`.
Item and weapon spawners accept optional `lifetime` (0.1-3600 seconds),
counted from each actual spawn; omit it for full-level persistence.
Portal, Spawner, Boost, and Turret each replace any other contact surface,
including Slimed/Springs/Spikes/Conveyor.
Optional `turret` is `"fireball"`, `"laser"`, or `null`. A turret
brick is marked by a closed semicircle and a rectangular barrel at 45 degrees
to its flat base. A blue semicircle identifies a laser turret; a red semicircle
identifies a fireball turret, without interior symbols.
The icon rotates with the board edge so its flat base faces the brick's outer side.
On a merged turret brick, the icon and the dome sit on the middle sub-brick
along the perimeter; with an even number of sub-bricks, the clockwise middle
one is used. If that sub-brick spans a board corner so the perpendicular wall
covers its inward face, the nearest sub-brick with a clear face is used instead
(clockwise first). Merged portals (exit oval) and gun/laser/missile Hazard
Bricks (icon and launch point) use the same choice. On every level and layout,
if a gun or missile shot would still overlap a perpendicular wall at its launch
point (corner bricks, or the thicker bricks of small phone screens), it slides
along the face toward the board center until it fits, as portal exits do. Once the turret is used, its semicircle turns grey until a
Battery recharges it.
Touching the brick moves Koshi into its inward-facing, translucent blue protective dome;
click or tap a point to aim and fire. Both turret types aim from the barrel pivot
through the clicked point; close targets are not skipped by the muzzle offset.
Fireballs explode at the target unless they hit an enemy first.
The turret displays shots remaining, and
a blue arc for lasers or a red arc for fireballs shrinks over its 10-second duration. Keyboard players
can focus a boundary brick and press Enter to fire toward its center. A turret
allows three shots or 10 seconds, whichever comes first, then fades and releases
Koshi. Fireball turrets launch glowing explosive
shots that damage nearby enemies; laser turrets hit every enemy along a
straight light-blue beam with a pale-blue core. Neither turret affects pickups. Each brick works once per
attempt; touching it again with a Battery recharges it. Turrets replace other
contact surfaces and can combine with cooldown color, Crumbler, Warped and
Toggle attributes.
Robo Love Bugs are immune to both turret types.
Optional `toggle` is `1` (red), `2` (green), or `4` (blue), or `null` to remove it; it combines
with any contact surface, cooldown kind, Crumbler, and Warped.
Omitted attributes leave earlier overlapping attribute edits unchanged. For example:

```json
"brickTypes": [
  { "edge": "top", "start": 0, "end": 0.2, "kind": "fast", "crumbler": 5, "warped": 15 }
]
```

Edits map to bricks whose centers fall within the saved edge segment. If a
layout has fewer bricks and no center lies in that segment, the nearest brick
on the same edge receives the edit. Later overlapping entries take priority.
Edits map one-to-one between desktop and phone by stable brick IDs, not by
the currently displayed edge. The editor keeps the same brick selected when
switching previews and labels it with its displayed edge. Existing saved
edge overrides retain their phone placement; desktop now shows those same
bricks at their rotated positions. Fixed placements in built-in campaign levels
rotate with the desktop board; custom-level event coordinates remain relative
to the playable area in both orientations. Older exports from the variable-count
editor continue to use their saved edge segments and may affect more than
one current brick. Up to 2000 overrides are
supported. Base positions and counts remain unchanged; Warped bricks temporarily
merge during play.

### Crumbler and Warped behavior

- Both attributes work with every cooldown color and can be combined on one
  brick. Levels 1–3 through 1–5 introduce these attributes; the editor can
  also add them to custom levels. Levels 1–1 and 1–2 remain unchanged.
- Brick selections only activate when Koshi can actually move in the clicked
  direction. Blocked clicks leave cooldowns, Crumbler uses, and warps unchanged.
- Crumblers begin with chipped, uneven boundaries. Each successful selection
  deepens and distorts the chips and grows branching cracks in proportion to
  the selections used; at zero, their outline is heavily eroded and visibly
  fractured. Rejected selections and cooldowns do not add wear, and restarting
  restores the initial appearance. These changes are visual: exhausted bricks
  remain solid. Crumblers also show a `C` counter in an unclipped label above
  the damage, so every remaining-use count stays readable. Merged Crumblers keep one
  continuous chipped outer edge without internal seams; editor previews use
  the initial, unworn shape. These chips are visual
  only and do not change collision geometry. Only a successful selection consumes
  one use. At zero, the entire brick (including any absorbed area) remains
  solid but permanently unselectable until the level restarts.
- Warped bricks keep their cooldown color and normal solid border, with a
  repeating pattern of small swirly squiggles. Absorbed areas form one continuous
  patterned surface with no internal outlines or seams; the pattern stays the
  same size as the brick grows. Only the solid brick sections and connecting
  gaps are painted; the bounding rectangle has no background or pattern.
  Corner cutouts and the gameplay area remain clear without relying on clipping.
  Each successful selection absorbs
  one randomly chosen neighboring brick or group at either end of the merged perimeter
  group, wrapping around corners. The enlarged area can be clicked to select
  the owner and shares its cooldown, attributes, and selection limit. Connecting
  gaps become solid; corner merges stay L-shaped rather than filling the board.
- The first absorption starts the `W` countdown. Further absorptions do not
  restart it. Absorbed bricks cannot be selected separately. Neighbors can be
  absorbed even while cooling down, exhausted, or already warped. An existing
  warp group is absorbed in full, with its old timer replaced by the selected
  owner's countdown. Absorption only stops once the entire perimeter is owned.
- At expiry, all absorbed bricks regain their original geometry and attributes.
  Their original cooldown deadlines continue to elapse while absorbed; their
  remaining Crumbler selections are preserved. If the owner exhausts its
  Crumbler selections, the entire enlarged brick is frozen and deactivated,
  including its absorbed bricks; its own warp timer no longer restores it.
  Another Warped brick can still absorb this group; when that new owner restores
  it, exhausted bricks remain unselectable. The counter shows `W:X` for this state.
  Pause freezes cooldowns and warp timers. Restart restores
  every brick and replenishes Crumbler selections.

### Slimed, Springs, Spikes, and Conveyor behavior

- All four contact attributes are available in the custom-level brick inspector,
  work with every cooldown color, and can combine with Crumbler and Warped.
  The campaign introduces slime in 1–6, Spikes in 1–8, Springs in 1–10,
  and Conveyors in 2–1.
- Slimed bricks have bold, dark-outlined icing with rounded, uneven drips only along
  their center-facing contact edge, including the inner rim of warped groups.
  The editor uses the same graphic and lets slime color be chosen independently
  of brick cooldown: **blue holds for 5 seconds, green for 3, red for 1**.
  Existing levels without a slime color use green (now a 3-second hold).
  Touching one holds Koshi stationary and blocks steering for that duration.
  At simultaneous contacts, the longest slime hold wins. A matching-color
  countdown ring starts full and drains in proportion to the remaining hold,
  freezing while paused. No stuck text or duration message covers play;
  an expanding ring, `FREE!` label, and
  accessible message announce release. Release does not launch Koshi automatically.
- Springs have a brown wooden platform with grain, a highlighted edge, and a
  clear dark outline only on the
  arena-facing edge, including the inner rim of warped groups. The editor uses
  the same platform. The thicker platform slightly overhangs the brick toward
  the arena. Coils are hidden at rest and visible underneath only
  during the platform's bounce animation. Contact reflects the incoming
  velocity about the surface normal, including rounded corner contacts, without
  changing speed. The platform compresses and rebounds, revealing tiny springs.
  Koshi can still be redirected in flight after a bounce.
- Spikes are many white triangles protruding from the arena-facing edge.
  Their visible tips and sides stop Koshi and cost **one heart per contact**,
  even while armed. Resting against them does not repeatedly hurt; leaving and
  returning can hurt again, and losing the last heart ends the attempt.
  Spikes first appear in Level 1–8; desktop rotates their positions with the bricks.
- Conveyors have a thin grey, finely toothed belt rotating around the entire brick
  perimeter. Direction arrows mark the arena-facing edge. Landing on that edge
  carries Koshi at 85 game units per second in the belt's direction, until the
  belt ends or another brick blocks him. He stops rather than launching
  off the end. Warped conveyors carry him around connected corners with clearance
  for his body, including stepped corners on phone layouts.
  Steering to another brick cancels the ride;
  item collection and enemy contact still work while riding. Merged conveyors
  carry continuously across absorbed bricks, gaps, and corners. Restoration
  stops a ride if the supporting surface is no longer part of the conveyor.
  Level 2–1 introduces both belt directions; Level 2–2 combines a conveyor
  with Warped growth. Desktop rotates directions with the bricks.
- Contact effects do not consume selections or trigger cooldowns; they work
  even on cooling-down or exhausted bricks. A merged group uses its owner's
  contact attribute over its entire shape, including connecting gaps. Absorbed
  bricks regain their own attributes on restoration.

### Cinder bricks

Custom levels also support `kind: "cinder"`: an inert concrete block with two
recessed holes. It stops Koshi on contact but cannot be activated or absorbed by
Warped bricks. Cinder has no cooldown and cannot combine with any modifier or
contact surface. The editor's Cinder picture button clears existing attributes
when converting a brick; Cinder blocks remain selectable for editing.

### Larger starting bricks

Select adjacent bricks in the editor (Shift-click to add selections), choose
the owner picture button, and click **Combine**. The larger brick starts merged
and shares the chosen owner's type, modifiers, cooldown, and contact effects.
Groups may cross corners or cover the full perimeter. Cinder combines only
with Cinder. **Split** returns selected groups to individual sizes while
retaining the group's current attributes.

Drafts, JSON, and playtests preserve optional `brickGroups`, for example
`[{ "owner": 0, "members": [0, 2, 4] }]`. IDs are zero-based, stable across
phone/desktop layouts, and shown as one-based brick numbers in the editor.
Every group needs 2–26 unique adjacent IDs, including its owner; groups cannot
overlap. A Portal group counts as one endpoint. Warped growth can absorb
entire starting groups, but timer restoration and restart retain their saved
combined sizes. Existing levels without groups are unchanged.

### Portal, Toggle, spawning, and Boost behavior

These mechanics are available in the editor, guide, and dedicated tutorial
steps, alongside practice for every other current brick type.

Crumbler counts (`C:`), Warped seconds (`W:`), and Toggle switches share a
centered information strip, arranged along the original brick's long axis.
Any combination is supported, with item icons alongside when present. The strip
keeps its original size but centers on the full starting or grown group.
Around corners the entire strip fits on the solid rim near the group's center,
not merely its center point. Boost flames, spawner and Barrier icons use the
same bounded layout without growing to the group's bounding-box size.
It remains outside Crumbler clipping. Larger non-Crumbler groups have slightly
rounded exterior and interior corners, without seams between their segments.
`W:X` denotes a frozen, exhausted Warped Crumbler.

- **Portal pairs:** matching colored smoke encloses the boundaries, with fixed
  rounded puffs that gently breathe without flickering at the corners. A
  matching-color glowing oval with shaded concentric rings rippling outward
  marks the exit. Reduced-motion mode keeps the rings still. Physical contact transports Koshi
  just outside the partner, centered on its original brick's center line and
  moving perpendicular into the arena. If a corner exit overlaps the adjacent
  wall, the glowing oval shifts along the brick to the first clear position,
  so Koshi launches straight out without sticking. Travel retains incoming
  speed and Boost, but never collects or attacks along the teleport gap. A
  0.2-second lockout prevents immediate return loops.
  If the partner is absorbed, the entrance acts as a normal
  solid landing. Toggle state, cooldown, and exhausted Crumbler selections do not disable
  portal contact. Create/recolor any number of endpoints while editing; warnings
  identify colors without exactly two bricks. Draft saves allow unfinished
  pairs, but export and playtest validate them. Removing or recoloring an
  endpoint leaves its partner unchanged. Only one pair of each color is supported.
- **Toggle:** a pill-shaped switch modeled on the supplied reference has a
  dark outline and a large white sliding button with a bold countdown.
  Red starts at **1**, green **2**, and blue **4**. Every successful brick
  activation counts, including the Toggle itself. It starts disabled at N,
  enables at zero, then the next successful activation disables it and resets N.
  Invalid, blocked, cooling, or disabled selections do not count.
  Toggle state only controls selection: disabled toggles are unselectable, but
  all contact surfaces still work. Absorbed and exhausted toggle bricks do not advance their cycles.
- **Spawning:** the brick shows a prominent item-colored icon with a thin dark
  outline and a dark rainbow glow. Sword and hammer icons use the corresponding weapon colors.
  The icon represents its
  configured food, sword, robot, or heart. Touching it spawns **one** object at
  a random safe location, immediately, without a timed spawn warning. Wheels
  appear on the inner perimeter. Merely selecting the brick does not spawn it.
  Once physical contact spawns the item, its icon becomes contrasting dark grey
  without a glow, and it cannot spawn again until restart, even
  after leaving, returning, being absorbed, or restoring from a Warped group.
- Swords and hammers have thin dark outlines around their blades/heads and handles.
  Bronze uses a dark green patina, distinct from brown wood, silver, and gold.
  These colors are shared by gameplay weapons, editor palettes, and spawner icons.
- **Boost:** when Koshi is physically resting against a Boost surface, even if Toggle-disabled,
  his next successful launch travels at **840 game units/second**, twice his
  normal speed. A glowing fireball overlays him and defeats both robot types
  like a sword, without consuming equipped sword charges. The state ends on
  stopping or on another successful brick selection; failed clicks do not
  cancel it. Spring bounces and Portal travel preserve boosted speed. Spikes
  can still hurt him. Clicking a Boost brick from elsewhere is not a boost.
  Pause freezes movement and visuals; restart clears the state.

Example paired portals and two other special bricks (saved phone slots):

```json
"brickTypes": [
  { "edge": "top", "start": 0, "end": 0.2, "kind": "normal", "portal": "purple" },
  { "edge": "bottom", "start": 0, "end": 0.2, "kind": "normal", "portal": "purple" },
  { "edge": "top", "start": 0.4, "end": 0.6, "kind": "fast", "boost": true, "toggle": 2 },
  { "edge": "bottom", "start": 0.4, "end": 0.6, "kind": "normal", "spawner": { "kind": "weapon", "type": "hammer-silver" } }
]
```
- Pause freezes slime locks, release feedback, spring compression, belt rotation,
  and conveyor rides. Restart
  clears all contact effects, spike-contact tracking, and animation state.

## GitHub Pages

1. Push this repository to GitHub with `main` as the deployment branch.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. The included [Pages workflow](./.github/workflows/pages.yml) runs tests
   and deploys on pushes to `main`. You can also run it manually from Actions.
4. Once deployment succeeds, play at <https://ry-man.github.io/koshi/>.

The workflow uses Node.js 24 for tests and the checkout/setup actions.
A failed test blocks deployment; action deprecation warnings are separate
from test failures.

All site asset paths are relative, so repository subpaths work on Pages.
If you rename the default branch, update the workflow's branch filter.
Alternatively, deploy directly from the repository root using Pages'
**Deploy from a branch** option; `.nojekyll` is included for static hosting.
With branch deployment the service worker keeps its `koshi-dev` name and
always checks the network first, so it never serves stale files.

## Install on Android

The site is a Progressive Web App (PWA): it has a
[manifest](./manifest.webmanifest), Koshi-head [icons](./icons/), and an
offline [service worker](./sw.js).

1. Open <https://ry-man.github.io/koshi/> in Chrome on the phone.
2. Tap **Install app** when prompted, or open **⋮ → Add to Home screen →
   Install**.
3. Launch **Koshi** from the home screen. It opens full-window in portrait
   with no browser bar, and it works offline after the first visit.

### Troubleshooting installation

Open **Menu → 📲 Install app** (or open
`index.html#install`). The panel:

- installs directly when Chrome allows it;
- says whether Chrome already considers the app installed (via
  `related_applications` in the manifest);
- gives the next steps to try;
- lists diagnostics (browser, manifest, icons, offline cache) that **Copy
  report** puts on the clipboard to share.

If Chrome says the app is already installed but you can't find it:

- Look for an app named **Koshi** under **Settings → Apps → See all apps**.
- Some home screens don't add new apps automatically.
- To start over, uninstall Koshi there, or reset the site under
  **Chrome ⋮ → Settings → Site settings → All sites → ry-man.github.io**.
  Then reinstall it.

Each deploy stamps the service worker with the commit SHA. An installed app
downloads the new version in the background while online and uses it on the
next launch. The level editor is also cached and available as a long-press
shortcut on the app icon.

To test installation locally, run `npm start` and open
<http://127.0.0.1:4173>; service workers need `http(s)`, so they are skipped
when opening `index.html` directly from disk. Icons are PNG renders of
[koshi.svg](./icons/koshi.svg) and [koshi-maskable.svg](./icons/koshi-maskable.svg).
If you add any file the pages load, also add it to `ASSETS` in `sw.js`;
`npm test` checks this.

A Google Play listing is optional: wrap the Pages URL with
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) (a Trusted Web
Activity) and publish with a Play developer account.

## Tests

```sh
npm test
```

Uses Node's built-in test runner with no packages to install. Tests cover
exact aiming, in-flight redirection, all cooldown durations, swept collision
and collection, all food values, scheduled spawns and expiry, pattern geometry,
pause, win/loss, restart, custom-level validation, portable JSON round trips,
normalized placements in both layouts, wheel perimeter starts, and custom
event scheduling (including time-zero events).

Level 1–2 uses the exact food, enemy, and weapon timelines from the description.
Movement speeds, automatic sword reach, persistent healing pickups, and
one-hit-per-continuous-contact damage are implementation choices where the
description does not specify those details. Levels 1–3 through 1–5 add combined
food and robot-defeat objectives. Custom levels also support enemy-only and
survival objectives. Bosses are not playable yet.
