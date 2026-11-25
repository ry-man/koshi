---
name: sync-official-levels-fast
description: 'Use for explicitly requested quick or incremental Official JSON level updates for testing on the live site. Validate the entire campaign, test and browser-check only added or changed levels locally, commit and push level-only changes, and require the full GitHub test suite and Pages deployment to succeed. Do not use for code changes or ordinary full production releases.'
---

# Fast Official level sync for live testing

This is an opt-in, lean alternative to `sync-official-levels`. It skips the full
local regression suite, not the independent full GitHub suite. Updates go to the
same live Official campaign, not a staging site. A request to run this skill
authorizes committing and pushing the incremental level updates. Creating,
editing or explaining the skill does not authorize running a release.

## Run once

From the repository root on Windows:

```powershell
npm.cmd run publish:official:incremental
```

Outside Windows use `npm run publish:official:incremental`. In VS Code, the
**Publish Official Levels (incremental testing)** task runs the same command.
Do not additionally run `npm test` or the standalone all-level smoke command.
Wait for the command to finish and inspect its exit status.

The command:

1. Requires `main` to match `origin/main`, a clear index and level-only edits.
   All normal publisher locking, concurrent-edit, commit and push guards apply.
2. Validates every manifest-listed JSON against the existing schema and checks
   campaign-wide names, world/number assignments and permanent IDs. Regenerates
   the bundle once explicitly, without running the full local suite.
3. Compares manifest entries and authored JSON with starting HEAD by permanent
   ID and semantic content, not modification times. Runs placement/orientation
   tests only for added or changed levels, across desktop and phone scales.
4. Runs Chromium smoke checks only for those same levels. With no semantic
   changes, skips placement and browser checks entirely. An unchanged campaign
   produces no empty commit or push.
5. Stages only the validated level JSON, approved manifest changes and generated
   bundle. Commits the level summary with the Copilot co-author trailer, pushes
   the exact checked commit and waits for that commit's full GitHub tests and
   Pages deployment to succeed. Prints validation, test, browser, deployment
   and total timings.

CI queues and deployment still take time. Do not claim the site is updated until
the full test and deploy jobs succeed. A failed GitHub run means the push may
have succeeded but production is unverified; report it and do not bypass CI.

## Safeguards and overrides

- Preserve authored content and permanent manifest IDs. Do not rebalance levels,
  change Beta, hand-edit the generated bundle or rewrite levels to pass checks.
- Only manifest-listed JSON is published. Do not add unlisted drafts without
  explicit authorization and confirmed world, number and permanent ID.
- This command includes all changed manifest-listed levels. For a named-level
  request, inspect the scope first; if other published levels are edited, stop
  and clarify instead of silently publishing them.
- Unrelated code, test, configuration or skill edits block publication. Never
  stash, revert, unstage, switch branches, rebase, amend or force-push to proceed.
  For code changes or a full release, use the original full-sync workflow.
- Every check is a gate. Report invalid JSON, missing Chromium, failed tests,
  concurrent edits, divergent history, hooks, rejected pushes or API failures.
  Never retry a failed push without explicitly resolving the reported state.
- For "local only", "do not commit" or "do not push", use
  `npm.cmd run publish:official:incremental:check`. It can regenerate the bundle,
  but does not fetch, commit or push. Do not use the live command to test this
  skill or publisher.
- Dependencies and Chromium are one-time setup: `npm.cmd ci`, then
  `npm.cmd run setup:publish`. Do not reinstall them on every update. Keep any
  `GH_TOKEN`/`GITHUB_TOKEN` outside repository files.

Report added/updated level labels, targeted check results, timings, commit,
push destination, exact-commit deployment status and remaining unpublished
drafts. State clearly that local checks were incremental, not a full suite.
