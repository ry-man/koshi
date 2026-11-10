---
name: sync-official-levels
description: 'Use when asked to update, sync, refresh, import, or regenerate Official campaign levels from the latest JSON level files in the levels directory, including requests such as "update the levels according to the latest JSON files". Validate the manifest, preserve save IDs and authored content, regenerate the bundle, require passing tests, automatically commit a level summary, push to production, and verify deployment.'
---

# Sync Official levels

Update the Official campaign using exported JSON as the source of truth.
Run commands from the repository root. By default, a request to run this sync
workflow includes testing, committing, and pushing the authorized level changes
to production. Honor explicit overrides such as "local only", "do not commit",
or "do not push". Editing or reviewing this skill alone does not run the workflow.

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
- Each step is a gate: wait for completion and inspect its outcome before
  proceeding. Never commit or push while required checks are pending or failing.
- Never stage unrelated changes or use force-push, amend, or bypass hooks.

## Procedure

1. Inspect `git --no-pager status --short`, the manifest, and the relevant JSON
   files. Read `package.json` and the Publishing Official levels section of
   `README.md` if the workflow may have changed. Inspect the current branch,
   staged changes, remotes, and `.github/workflows/pages.yml`.
   Production currently deploys from `main` on `origin`.
   Before preparing a production commit, fetch `origin` and confirm the current
   branch is `main` and its HEAD matches `origin/main`. If the branch differs,
   fetch fails, histories diverge, or existing unpushed commits would also be
   published, stop and ask how to proceed. Do not silently switch branches,
   merge, rebase, or publish unrelated commits.
   Record the starting HEAD and existing changes so the release scope is clear.
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
   satisfy stale expectations. Require a zero exit status from the full suite
   before proceeding to review, commit, or push; do not rely on targeted tests
   alone. If a repair changes any code, fixtures, JSON, or generated output,
   rerun the full suite and wait for it to pass. Report unrelated failures as
   blockers rather than skipping them or publishing anyway.
6. Review `git --no-pager diff --check` and the relevant diff. Verify generated
   entries match validated JSON, manifest world/number assignments, and stable
   IDs. Check that source JSON and unrelated levels were not manually changed.
   Include newly created files in the review; ordinary git diff omits them.
   Require `git --no-pager diff --check` to pass. For visible changes, complete
   the applicable browser check below before committing.
7. Generate the commit message from the reviewed level changes relative to the
   recorded starting HEAD:
   - Compare manifest entries and validated authored content by permanent ID,
     not JSON names or file modification times.
   - `X` lists newly manifest-listed levels; `Y` lists previously published
     levels whose content or world/number placement changed. Do not count
     regenerated-but-identical entries as updates. A path-only move is an
     update to that level's source mapping. Use `none` for an empty list.
   - Label levels with their world and displayed number, such as `1-4` or
     `S1-1`, in campaign order. A moved level should show old and new labels.
     Report removed entries explicitly and ask before proceeding if removals
     were not authorized; do not hide them in an additions/updates summary.
   - Use this exact subject form:
     `Adding levels X, updating levels Y in official campaign`
     Example: `Adding levels 1-4, updating levels 1-1, 1-3 in official campaign`.
   - If there are no authorized changes to commit, report that the campaign
     is already current and do not create an empty commit or push.
8. Stage only the exact authorized paths: source JSON, approved manifest edits,
   generated bundle, and tightly coupled integration/test/documentation fixes.
   Inspect `git --no-pager diff --cached --check` and the complete staged diff.
   If unrelated changes are already staged, ask the user to resolve the index;
   do not unstage their work or include it in the commit. If a file mixes
   unrelated changes, stage only reviewed authorized hunks or ask for guidance.
   Commit with the generated subject and the required trailer:

   ```text
   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
   ```

   Require successful commit completion. Verify the resulting commit includes
   only reviewed changes. If hooks modify files or additional edits are needed,
   rerun the required checks and review before continuing.
9. Push the verified commit with `git push origin main`. If the remote advanced
   since the initial fetch or the push is rejected, stop and report the blocker;
   do not force-push or automatically resolve the history. Confirm the remote
   `main` points to the intended commit before reporting a successful push.
10. Check the GitHub Pages workflow for that exact commit, waiting for both
    test and deployment jobs to succeed before claiming production is updated.
    If workflow access is unavailable, state that the push succeeded but
    deployment is unverified. If a job fails, report its failure and do not
    claim success. Summarize added/updated levels, passing test results, commit,
    push destination, deployment status, remaining drafts, and any blockers.
    Distinguish local-only or no-push overrides from a production deployment.

## Browser checks and local preview

- `npm.cmd start` serves the game at `http://127.0.0.1:4173`.
  It regenerates published JSON at startup and on game/editor page refresh.
  An old running server may need restarting after importer code changes.
  Prefer an existing responsive server; do not kill unrelated processes.
- For changed visible content, use a browser check when available: select
  Official, open the affected level, and verify the changed objectives, hints,
  cutscene, or editor preview. Keep temporary helpers bounded and clean them up.

The build/test pipeline enforces validation independently of skill discovery.
This skill guides the agent's requested sync workflow; it is not a background
publishing hook and does not run just because JSON files changed.
