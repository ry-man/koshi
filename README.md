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
bottom bricks. Bricks and toolbar buttons have at least 44px touch targets
at the start of an attempt. The number of normal boundary bricks adapts to
the available space; Level 1–1 has one slow and one fast brick, and Level 1–2
has three of each. Food patterns stay
inside the playable area, and the level schedule, scoring, and cooldowns are
unchanged. Instructions remain below the game instead of pushing it offscreen.
Desktop play keeps the original landscape board. A restart picks the layout
for the current screen; resizing during an attempt preserves its game state.

Artwork is drawn locally;
system emoji represent food. Optional Google Fonts have local sans-serif
fallbacks; gameplay does not require an external service.

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

## Tests

```sh
npm test
```

Uses Node's built-in test runner with no packages to install. Tests cover
exact aiming, in-flight redirection, all cooldown durations, swept collision
and collection, all food values, scheduled spawns and expiry, pattern geometry,
pause, win/loss, and restart.

Level 1–2 uses the exact food, enemy, and weapon timelines from the description.
Movement speeds, automatic sword reach, persistent healing pickups, and
one-hit-per-continuous-contact damage are implementation choices where the
description does not specify those details. Bosses and additional objective
types are not playable yet because no such levels have been described.
