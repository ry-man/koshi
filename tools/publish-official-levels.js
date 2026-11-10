'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { requireChromium, smokeOfficialLevels } = require('./smoke-official-levels.js');

const MANIFEST = 'levels/official/campaign.json';
const BUNDLE = 'src/official-levels.generated.js';
const REPOSITORY = 'ry-man/koshi';

function command(file, args, root, inherit = false) {
  return execFileSync(file, args, {
    cwd: root, encoding: 'utf8', stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024, windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }) ?? '';
}

function releasePlan(before, after, readBefore, readAfter) {
  const old = new Map(before.levels.map(entry => [entry.id, entry]));
  const current = new Map(after.levels.map(entry => [entry.id, entry]));
  const removed = before.levels.filter(entry => !current.has(entry.id));
  if (removed.length) throw new Error(`Removed or replaced permanent IDs: ${removed.map(entry => entry.id).join(', ')}. Review these manually.`);
  const label = entry => `${entry.worldId}-${entry.number}`;
  const added = [], updated = [], ids = [];
  const { OFFICIAL_WORLDS } = require('../src/campaign.js');
  const worldOrder = new Map(OFFICIAL_WORLDS.map((world, index) => [world.id, index]));
  const ordered = [...after.levels].sort((a, b) => worldOrder.get(a.worldId) - worldOrder.get(b.worldId)
    || (/^\d+$/.test(a.number) && /^\d+$/.test(b.number) ? Number(a.number) - Number(b.number)
      : /^\d+$/.test(a.number) ? -1 : /^\d+$/.test(b.number) ? 1 : 0));
  for (const entry of ordered) {
    const previous = old.get(entry.id);
    if (!previous) {
      added.push(label(entry)); ids.push(entry.id);
    } else if (!isDeepStrictEqual(previous, entry)
      || !isDeepStrictEqual(readBefore(previous.file), readAfter(entry.file))) {
      updated.push(label(previous) === label(entry) ? label(entry) : `${label(previous)} -> ${label(entry)}`);
      ids.push(entry.id);
    }
  }
  return {
    ids,
    subject: `Adding levels ${added.join(', ') || 'none'}, updating levels ${updated.join(', ') || 'none'} in official campaign`,
  };
}

async function githubAPI(endpoint) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/${endpoint}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}. Check API access/rate limits; GH_TOKEN is optional for public repositories.`);
  return response.json();
}

async function waitForDeployment(sha, { api = githubAPI, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), timeout = 15 * 60 * 1000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await api(`actions/workflows/pages.yml/runs?head_sha=${sha}&event=push&per_page=5`);
    const run = result.workflow_runs.find(candidate => candidate.head_sha === sha && candidate.head_branch === 'main');
    if (run?.status === 'completed') {
      if (run.conclusion !== 'success') throw new Error(`Pages workflow ${run.conclusion}: ${run.html_url}`);
      const { jobs } = await api(`actions/runs/${run.id}/jobs?per_page=100`);
      for (const name of ['test', 'deploy']) {
        if (!jobs.some(job => job.name === name && job.status === 'completed' && job.conclusion === 'success')) {
          throw new Error(`Pages ${name} job did not succeed: ${run.html_url}`);
        }
      }
      return run.html_url;
    }
    console.log(`Waiting for Pages deployment of ${sha.slice(0, 7)}...`);
    await sleep(20000);
  }
  throw new Error('Deployment verification timed out. Check Actions and any github-pages environment approval; deployment is unverified.');
}

async function publishOfficialLevels({
  root = path.resolve(__dirname, '..'), check = false, run = command,
  smoke = smokeOfficialLevels, deployment = waitForDeployment,
} = {}) {
  const git = (...args) => run('git', ['--no-pager', ...args], root).trimEnd();
  const files = (...args) => git(...args, '-z').split('\0').filter(Boolean);
  const read = file => fs.readFileSync(path.join(root, ...file.split('/')), 'utf8');
  const json = file => JSON.parse(read(file));
  const lockPath = path.resolve(root, git('rev-parse', '--git-path', 'official-publish.lock'));
  let lock;
  try {
    lock = fs.openSync(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Another Official publisher is running. If it crashed, remove the Git official-publish.lock file after verifying no publisher is active.');
    throw error;
  }
  let committed = false, pushAttempted = false, pushed = false;
  try {
    const assertNoOperation = () => {
      const markers = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_LOG'];
      if (markers.some(marker => fs.existsSync(path.join(path.dirname(lockPath), marker)))) {
        throw new Error('A Git operation is in progress. Finish or abort it manually before publishing.');
      }
    };
    assertNoOperation();
    if (git('branch', '--show-current') !== 'main') throw new Error('Publish requires main. Switch branches manually; no branch was changed.');
    const assertOrigin = () => {
      const expected = /^(?:https:\/\/github\.com\/ry-man\/koshi|git@github\.com:ry-man\/koshi)(?:\.git)?$/;
      const pushURLs = git('remote', 'get-url', '--push', '--all', 'origin').split(/\r?\n/);
      if (!expected.test(git('remote', 'get-url', 'origin')) || pushURLs.length !== 1 || !expected.test(pushURLs[0])) {
        throw new Error('origin must fetch from and push only to ry-man/koshi on GitHub.');
      }
    };
    assertOrigin();
    if (files('diff', '--cached', '--name-only').length) throw new Error('The index already has staged changes. Resolve them before publishing.');
    const start = git('rev-parse', 'HEAD');
    const before = JSON.parse(git('show', `${start}:${MANIFEST}`));
    const after = json(MANIFEST);
    if (after.version !== 1 || !Array.isArray(after.levels)) throw new Error('Invalid Official campaign manifest.');
    const allowed = new Set([MANIFEST, BUNDLE, ...after.levels.map(entry => `levels/official/${entry.file}`)]);
    const previousSources = new Set(before.levels.map(entry => `levels/official/${entry.file}`));
    for (const file of previousSources) {
      if (!fs.existsSync(path.join(root, ...file.split('/')))) allowed.add(file);
    }
    const draft = file => file.startsWith('levels/official/') && file.endsWith('.json') && !allowed.has(file);
    const changed = () => [...new Set([
      ...files('diff', 'HEAD', '--name-only', '--no-renames'),
      ...files('ls-files', '--others', '--exclude-standard'),
    ])];
    const assertScope = () => {
      const unrelated = changed().filter(file => !allowed.has(file) && !draft(file));
      if (unrelated.length) throw new Error(`Unrelated changes would affect release validation. Commit or set them aside manually:\n${unrelated.join('\n')}`);
    };
    assertScope();
    if (smoke === smokeOfficialLevels) requireChromium();
    // Include all tested inputs, not only release files, to catch edits during validation.
    const snapshot = () => new Map(files('ls-files', '--cached', '--others', '--exclude-standard')
      .filter(file => file !== BUNDLE && fs.existsSync(path.join(root, ...file.split('/')))).map(file => {
        const filename = path.join(root, ...file.split('/'));
        if (fs.lstatSync(filename).isSymbolicLink()) throw new Error(`Symlinks require manual review: ${file}`);
        return [file, createHash('sha256').update(fs.readFileSync(filename)).digest('hex')];
      }));
    const inputs = snapshot();
    if (!check) {
      git('fetch', 'origin', 'main');
      if (git('rev-parse', 'origin/main') !== start) throw new Error('HEAD must match origin/main. Resolve behind/ahead/diverged history manually.');
      // Check API access before spending time on tests or publishing a commit.
      if (deployment === waitForDeployment) await githubAPI('actions/workflows/pages.yml');
    }
    const oldJSON = file => JSON.parse(git('show', `${start}:levels/official/${file}`));
    // npm test's pretest is the one and only explicit generation step.
    if (process.env.npm_execpath) {
      run(process.execPath, [process.env.npm_execpath, 'test'], root, true);
    } else if (process.platform === 'win32') {
      run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd test'], root, true);
    } else {
      run('npm', ['test'], root, true);
    }
    const plan = releasePlan(before, after, oldJSON, file => json(`levels/official/${file}`));
    console.log(plan.subject);
    const bundle = read(BUNDLE);
    await smoke(plan.ids.length ? plan.ids : undefined, root);
    git('diff', '--check');
    if (!isDeepStrictEqual(inputs, snapshot()) || read(BUNDLE) !== bundle) throw new Error('Files changed during validation. No commit/push; rerun after edits finish.');
    if (git('rev-parse', 'HEAD') !== start || git('branch', '--show-current') !== 'main'
      || files('diff', '--cached', '--name-only').length) throw new Error('HEAD, branch, or index changed during validation.');
    assertScope();
    const paths = changed().filter(file => allowed.has(file)).sort();
    const drafts = changed().filter(draft);
    if (drafts.length) console.log(`Unpublished drafts left untouched:\n${drafts.join('\n')}`);
    if (check) {
      console.log('Local validation passed. No commit or push (--check).');
      return { checked: true, paths, ...plan };
    }
    if (!paths.length) {
      console.log('Official campaign is already current. No commit or push.');
      return { unchanged: true };
    }
    git('fetch', 'origin', 'main');
    if (git('rev-parse', 'origin/main') !== start) throw new Error('origin/main advanced during validation. Resolve manually and rerun.');
    if (!isDeepStrictEqual(inputs, snapshot()) || read(BUNDLE) !== bundle) throw new Error('Files changed before staging; rerun.');
    assertNoOperation();
    if (git('rev-parse', 'HEAD') !== start || git('branch', '--show-current') !== 'main'
      || files('diff', '--cached', '--name-only').length) throw new Error('HEAD, branch, or index changed before staging.');
    const expected = new Map(paths.map(file => [file, fs.existsSync(path.join(root, ...file.split('/'))) ? git('hash-object', '--', file) : null]));
    git('add', '--', ...paths.map(file => `:(literal)${file}`));
    git('diff', '--cached', '--check');
    const staged = files('diff', '--cached', '--name-only', '--no-renames').sort();
    if (!isDeepStrictEqual(staged, paths)) throw new Error('Staged paths differ from the validated release. Review the index manually.');
    for (const [file, hash] of expected) {
      if (hash !== null && git('rev-parse', `:${file}`) !== hash) throw new Error(`Staged content changed: ${file}`);
    }
    git('commit', '-m', `${plan.subject}\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`);
    committed = true;
    const sha = git('rev-parse', 'HEAD');
    if (!isDeepStrictEqual(git('rev-list', '--parents', '-n', '1', sha).split(/\s+/), [sha, start])
      || !isDeepStrictEqual(files('diff-tree', '--no-commit-id', '--name-only', '--no-renames', '-r', sha).sort(), paths)) {
      throw new Error('Commit scope changed, possibly in a hook. Review manually; not pushing.');
    }
    for (const [file, hash] of expected) {
      if (hash !== null && git('rev-parse', `${sha}:${file}`) !== hash) throw new Error(`Commit content changed, possibly in a hook: ${file}. Not pushing.`);
    }
    if (!isDeepStrictEqual(inputs, snapshot()) || read(BUNDLE) !== bundle || files('diff', '--cached', '--name-only').length) {
      throw new Error('Files or index changed, possibly in a hook. Review manually; not pushing.');
    }
    assertOrigin();
    if (git('branch', '--show-current') !== 'main' || git('rev-parse', 'HEAD') !== sha) throw new Error('HEAD or branch changed before push. Review manually; not pushing.');
    if (git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0] !== start) throw new Error('Remote main changed before push. Resolve manually; not pushing.');
    pushAttempted = true;
    git('push', 'origin', `${sha}:refs/heads/main`);
    pushed = true;
    if (git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0] !== sha) throw new Error('Remote main does not match the published commit.');
    const url = await deployment(sha);
    console.log(`Production deployed: ${sha}\n${url}`);
    return { sha, url, paths, ...plan };
  } catch (error) {
    const state = pushed ? 'Push succeeded; production deployment is NOT verified.'
      : pushAttempted ? 'Push did not complete successfully; remote state is unknown. Check origin/main before retrying.'
        : committed ? 'A local commit was created; it was NOT pushed.'
          : 'Release stopped before a verified commit/push. Generated files or the index may need review.';
    throw new Error(`${error.message}\n${state}`, { cause: error });
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(lockPath);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check')) {
    console.error('Usage: node tools/publish-official-levels.js [--check]');
    process.exitCode = 1;
  } else {
    publishOfficialLevels({ check: args.includes('--check') })
      .catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}

module.exports = { releasePlan, waitForDeployment, publishOfficialLevels };
