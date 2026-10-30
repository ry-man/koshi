# Koshi's Quest

A browser arcade game starring Koshi, a grey tabby with a big appetite.
Built with vanilla JavaScript, HTML, and Canvas. No build step or runtime
dependencies are required. The initial implementation follows
[the game description](./game_description.md): World 1, Levels 1–1 and 1–2.

## Play locally

Double-click [index.html](./index.html) to open the game directly in your browser.
No server or installation is required.

Alternatively, install Node.js 24 or newer, then run:

```sh
npm start
```

Open <http://127.0.0.1:4173>. On Windows, use `npm.cmd start` if PowerShell
blocks the npm script. Both direct `file://` access and HTTP hosting are supported.

## Controls and rules

- Click or tap the **exact spot on a colored brick** you want Koshi to approach.
- Redirect him mid-flight by selecting another available brick. Koshi stops
  when his circular head first touches any brick, including recharging bricks.
- Blue bricks recharge in **15 seconds**, green in **8**, and red in **3**.
  Their meters show the remaining cooldown.
- Collect **20 food points** to win immediately: within **60 seconds** in
  Level 1–1 or **120 seconds** in Level 1–2.
  Strawberries give 1 point, pretzels give 2. Food patterns, appearance times,
  and lifetimes match the description exactly, including both events at 35s.
- Koshi starts at rest in the center with **3 hearts**. Leaving the board
  or running out of hearts loses the level. Level 1–1 remains enemy-free.
- In Level 1–2, Robo Mice wander in curves and periodically stop to lick their
  hands; Robo Wheels roll around the inside boundary. Neither fires or chases
  Koshi. Unarmed contact costs one heart per enemy contact; remaining overlapped
  does not repeatedly drain hearts. Separation and another collision can hurt again.
- Every **10 food points** in Level 1–2 spawns a heart in the playable area.
  Touch it to restore one heart, capped at three. No hearts spawn in Level 1–1.
- Collect a sword to automatically strike robots within its reach.
  **Wood** defeats 1 enemy, **bronze** 3, **silver** 10; **gold** lasts
  15 seconds from pickup and has unlimited defeats during that time.
  Koshi holds only one weapon. Other swords stay on the board until he can
  collect them; dropped swords and hearts do not expire. Pause freezes sword time.
- **Pause**, **Escape**, or **Space** pauses/resumes play. Switching tabs or
  leaving the window pauses automatically; resume explicitly when you return.
- **Tab** through the bricks and press **Enter** or **Space** to aim at a
  brick's center. Mouse/touch controls allow precise off-center aiming.
- **Restart** starts a fresh attempt of the selected level. After Level 1–1,
  **Next level** starts Level 1–2. The level selector can also start either
  level directly; changing it begins a fresh attempt.

On phones held upright, the board uses a **portrait 5:8 layout** with compact
stats and controls, sized to fit the visible screen without scrolling to the
bottom bricks. Both layouts always have **26 boundary bricks**. Phones have
**five on top/bottom and eight on each side**. Desktop bricks are rotated
**90 degrees clockwise** relative to the phone: **eight on top/bottom and
five on each side**. Phone top maps to desktop right, right to bottom,
bottom to left, and left to top. Brick IDs, cooldown types, Crumbler limits,
and Warped attributes follow each brick through the rotation. Brick dimensions adapt to the screen;
some bricks are narrower than 44px on small phones to keep the count fixed.
Toolbar buttons retain at least 44px touch targets.
Level 1–1 has one slow and one fast brick, and Level 1–2
has three of each. Food patterns stay
inside the playable area, and the level schedule, scoring, and cooldowns are
unchanged. Instructions remain below the game instead of pushing it offscreen.
Desktop play keeps the original landscape board. A restart picks the layout
for the current screen; resizing during an attempt preserves its game state.

Artwork is drawn locally;
system emoji represent food. The DM Sans and Space Grotesk fonts are bundled in
[fonts/](./fonts/) under the SIL Open Font License (license texts included), so
the game makes no requests to external services.

## Graphical level editor

Open [editor.html](./editor.html), or choose **Open level editor** in the game.
It is a separate page, works by double-clicking the file, and is included in
the GitHub Pages deployment at `/koshi/editor.html`. No server-side storage
or build tools are needed.

1. Set the level name, time limit, food goal, optional heart cost (blank disables
   food-triggered hearts), and boundary brick set. Choose **Apply settings**.
   Click/tap any boundary brick (or focus it and press Enter) to select it,
   then change **Selected brick type** in the brick inspector: slow/blue (15s),
   normal/green (8s), or fast/red (3s). Enable **Crumbler** and/or **Warped**
   independently, or choose **Slimed** or **Springs** for contact effects.
   Set the selection limit (default 5) or warp duration
   (default 15 seconds). Changes apply immediately. Each brick
   can have its own type, independent of the preset. **Reset brick types to
   preset** clears all individual edits. Applying a different boundary preset
   changes defaults but keeps individual overrides until reset.
2. Choose a food, enemy, or weapon in the inspector. Set its appearance time
   and, for food, lifetime. With the **Place** tool, click/tap the dotted
   playable area to add objects. Each click creates one timed placement;
   repeating clicks creates a group with the same timing.
3. Select a marker or event in the chronological list to edit it. Drag a marker,
   or enter X/Y percentages and choose **Apply event changes**. Markers also
   support arrow keys (1% steps). **Duplicate** copies an event at the same
   time and position; move it to create lines/circles. **Delete** removes it.
   **New event** returns to placement mode. Overlapping markers can always
   be selected separately from the event list.
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
5. Scrub **Preview time**. Disable **Show all spawn locations** to see which
   objects have appeared and when food expires. This is a placement preview,
   not an enemy-movement or collection simulation; **Playtest** runs the real
   game. Switch **Preview** to check phone portrait placement.
6. **Save draft / Load draft** stores one level in this browser. Storage errors
   are reported; browser storage is not a portable backup, especially on
   `file://`. **Generate JSON** fills the text area; **Download JSON** saves a
   portable file. Paste JSON and choose **Import JSON**, or use **Import file**.
   Invalid imports leave the existing level unchanged.
7. **Playtest** opens a snapshot in the game, including its settings, exact spawn
   times, and placements. The game’s editor link returns the snapshot for more
   edits. Restart replays that custom level; built-in levels remain selectable.
   The snapshot is encoded in the URL fragment (not sent to a server), so an
   HTTP/Pages playtest URL can be shared. Download JSON for long-term storage.

Apply form edits before exporting or playtesting. Neither export nor playtest
changes the built-in levels. Closing the editor with unsaved level changes
prompts before leaving.

### Placement format

The versioned JSON contains individual placements, not random pattern commands.
Coordinates are fractions of the **safe playable area inside the boundary
bricks**, not raw screen pixels: `x: 0` is its left edge and `y: 1` is its
bottom. The same fractions map to each layout's safe area, so objects stay
accessible and off bricks on phones and desktops.

Robo Wheels must start on this area's perimeter (at least one coordinate is
0 or 1). The editor snaps them to the nearest edge; they then roll normally.
Mice begin at the specified point and wander; swords remain until collected.
Food lifetime begins at the scheduled appearance time. Simultaneous events
spawn in their original list order. Normal pickup/combat rules still apply,
including automatic collection of objects placed over Koshi's starting point.

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
`wheel`; weapon types are `wood`, `bronze`, `silver`, `gold`. `brickSet` is 1
or 3 slow/fast bricks each. `heartCost: null` disables heart spawning.
Duration is 1–3600 seconds, food goal/heart cost are positive integers up to
100000, and a level supports up to 2000 events. Appearance times must be
nonnegative and strictly before the time limit; food lifetimes are
0.1–3600 seconds. JSON files imported through the file picker have a 1 MB limit.
Only timed food-collection objectives and boundary-brick layouts are supported,
matching the game's current playable level types.

Individual brick edits are an optional `brickTypes` array, preserved in drafts,
JSON exports/imports, and playtest snapshots. Older levels without it use their
boundary preset unchanged. Each entry has an `edge` (`top`, `bottom`, `left`,
`right`), `start` and `end` fractions along that edge (left-to-right on top/bottom,
top-to-bottom on sides) in the **phone layout**, and `kind` (`slow`, `normal`,
`fast`). Desktop rotates these saved slots clockwise, including reversing
slot order when phone left/right edges become desktop top/bottom.
Optional
`crumbler` is an integer selection limit (1–100000); `warped` is a duration
in seconds (0.1–3600). Set either to `null` to explicitly remove that attribute.
Optional `slimed` and `springs` are booleans; `false` removes the attribute.
They are mutually exclusive: importing both as `true` in the same override is
an error, while enabling one in the editor replaces the other. A later
overlapping override enabling one also removes the other.
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
bricks at their rotated positions. Food, enemy, and weapon placement coordinates
are unchanged and are not rotated. Older exports from the variable-count
editor continue to use their saved edge segments and may affect more than
one current brick. Up to 2000 overrides are
supported. Base positions and counts remain unchanged; Warped bricks temporarily
merge during play.

### Crumbler and Warped behavior

- Both attributes work with every cooldown color and can be combined on one
  brick. The existing built-in level presets remain unchanged; use the editor
  to add these attributes to custom levels.
- Brick selections only activate when Koshi can actually move in the clicked
  direction. Blocked clicks leave cooldowns, Crumbler uses, and warps unchanged.
- Crumblers have chipped, uneven boundaries instead of a crack texture, plus a
  `C` counter. Merged Crumblers keep one continuous chipped outer edge without
  internal seams; editor previews use the same shape. These chips are visual
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

### Slimed and Springs behavior

- Both contact attributes are available in the custom-level brick inspector,
  work with every cooldown color, and can combine with Crumbler and Warped.
  Built-in levels are unchanged.
- Slimed bricks have an oozing green edge. Touching one holds Koshi stationary
  and blocks all steering for exactly one second of game time. A green ring
  and `STUCK` label indicate the hold; an expanding ring, `FREE!` label, and
  accessible message announce release. Release does not launch Koshi automatically.
- Springs have a thin brown metallic edge. Contact reflects the incoming
  velocity about the surface normal, including rounded corner contacts, without
  changing speed. The edge compresses and rebounds, revealing tiny springs.
  Koshi can still be redirected in flight after a bounce.
- Contact effects do not consume selections or trigger cooldowns; they work
  even on cooling-down or exhausted bricks. A merged group uses its owner's
  contact attribute over its entire shape, including connecting gaps. Absorbed
  bricks regain their own attributes on restoration.
- Pause freezes slime locks, release feedback, and spring compression. Restart
  clears all contact effects and animation state.

## GitHub Pages

1. Push this repository to GitHub with `main` as the deployment branch.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. The included [Pages workflow](./.github/workflows/pages.yml) runs tests
   and deploys on pushes to `main`. You can also run it manually from Actions.
4. Once deployment succeeds, play at <https://ry-man.github.io/koshi/>.

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

Tap **📲 Install app** at the top of the game page (or open
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
description does not specify those details. Bosses and additional objective
types are not playable yet because no such levels have been described.
