---
name: sync-official-levels
description: 'Use when asked to update, sync, refresh, import, or regenerate Official campaign levels from the latest JSON level files in the levels directory, including requests such as "update the levels according to the latest JSON files". Validate the manifest, preserve save IDs and authored content, regenerate the bundle, and run tests.'
---

# Sync Official levels

Update the Official campaign using exported JSON as the source of truth.
Run commands from the repository root. This workflow prepares local changes;
it does not publish them unless the user explicitly requests that.

## Scope and safeguards

- Follow the repository's level-preservation instructions.
- A request to sync the latest JSON authorizes importing its authored content,
  not editing or rebalancing that content. Leave Beta unchanged.
- Only files listed in `levels/official/campaign.json` are published.
  Unlisted JSON files remain drafts. Do not automatically add them.
- Preserve manifest `id` values: they are permanent save identities. JSON `id`
  values are level names, not replacements for the permanent IDs.
- Do not manually edit `src/official-levels.generated.js` or copy level data
  into `src/campaign.js`. Use the existing generator.
- Preserve unrelated working-tree changes. Do not reset or revert user edits.

## Procedure

1. Inspect `git --no-pager status --short`, the manifest, and the relevant JSON
   files. Read `package.json` and the Publishing Official levels section of
   `README.md` if the workflow may have changed.
2. Resolve scope:
   - For a general sync, regenerate all manifest-listed levels.
   - For a named level, locate its entry and source file. Explain that the
     generator rebuilds the whole bundle; report any other authored changes
     included rather than silently discarding them.
   - If the requested file is not listed, ask whether it should be published
     and confirm its world, display number, and permanent ID before adding it.
   - For a moved file, confirm the matching entry and update only its path,
     retaining identity and placement unless the user requested otherwise.
   - Paths in the manifest are relative to `levels/official/` and use `/`.
     A folder or filename alone does not authorize publication or placement.
3. Generate and validate:

   ```powershell
   npm.cmd run build
   ```

   On non-Windows systems, use `npm run build`. The generator checks JSON using
   the game/editor schema, validates worlds, and rejects duplicate names,
   permanent IDs, source files, and world/number pairs.
4. If generation fails, stop and report the offending file and reason.
   Do not alter gameplay to make validation pass, skip invalid published files,
   or claim the last successful bundle represents the latest JSON.
   Correct unambiguous manifest mistakes only within the authorized scope;
   ask before changing authored content or ambiguous identities/placements.
5. Run the deployment check:

   ```powershell
   npm.cmd test
   ```

   On non-Windows systems, use `npm test`. This regenerates the bundle through
   `pretest` and runs the full suite. Inspect failures; fix tightly coupled
   integration/test-fixture issues, but do not rewrite the source level to
   satisfy stale expectations. Do not claim readiness with failing tests.
6. Review `git --no-pager diff --check` and the relevant diff. Verify generated
   entries match validated JSON, manifest world/number assignments, and stable
   IDs. Check that source JSON and unrelated levels were not manually changed.
   Include newly created files in the review; ordinary git diff omits them.
7. Summarize imported changes, test results, and any remaining drafts or
   blockers. If no content changed, say the campaign was already current.
   Clearly distinguish a verified local update from a published deployment.

## Optional local preview and publication

- `npm.cmd start` serves the game at `http://127.0.0.1:4173`.
  It regenerates published JSON at startup and on game/editor page refresh.
  An old running server may need restarting after importer code changes.
  Prefer an existing responsive server; do not kill unrelated processes.
- For changed visible content, use a browser check when available: select
  Official, open the affected level, and verify the changed objectives, hints,
  cutscene, or editor preview. Keep temporary helpers bounded and clean them up.
- Commit only when requested, staging only authorized changes. Include the
  JSON, any authorized manifest edits, and generated bundle as applicable.
  Follow repository commit conventions.
- Push only when requested. GitHub Pages then regenerates, tests, and deploys.
  If asked to publish, verify workflow success before claiming the live game
  is updated; otherwise state that deployment is pending or unverified.

The build/test pipeline enforces validation independently of skill discovery.
This skill guides the agent's workflow; it is not an automatic publishing hook.
