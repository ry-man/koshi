# Koshi's Quest

A browser arcade game starring Koshi, a grey tabby with a big appetite.
Built with vanilla JavaScript, HTML, and Canvas. No build step or runtime
dependencies are required. The initial implementation follows
[the game description](./game_description.md): World 1, Level 1, with no enemies.

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
- Collect **20 food points within 60 seconds** to win immediately.
  Strawberries give 1 point, pretzels give 2. Food patterns, appearance times,
  and lifetimes match the description exactly, including both events at 35s.
- Koshi starts at rest in the center with **3 hearts**. There are no enemies
  in this version, so hearts are not currently consumed. Leaving the board
  or running out of hearts loses the level.
- **Pause**, **Escape**, or **Space** pauses/resumes play. Switching tabs or
  leaving the window pauses automatically; resume explicitly when you return.
- **Tab** through the bricks and press **Enter** or **Space** to aim at a
  brick's center. Mouse/touch controls allow precise off-center aiming.
- **Restart** starts a fresh attempt. Completing the level offers replay;
  no additional levels or enemy encounters have been invented.

The board scales to desktop and mobile screens. Artwork is drawn locally;
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
