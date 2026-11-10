'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { releasePlan, waitForDeployment, publishOfficialLevels } = require('../tools/publish-official-levels.js');

const entry = { file: 'world-1/1.json', worldId: '1', number: '1', id: 'official-1-1' };
const manifest = { version: 1, levels: [entry] };

function fixture(t) {
  t.mock.method(console, 'log', () => {});
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'koshi-publish-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'work'), remote = path.join(directory, 'origin.git');
  fs.mkdirSync(root);
  const git = (...args) => execFileSync('git', ['--no-pager', ...args], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
  const write = (file, value) => {
    const target = path.join(root, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  git('init', '--initial-branch=main');
  git('config', 'user.name', 'Release Test');
  git('config', 'user.email', 'release@example.invalid');
  git('config', 'core.autocrlf', 'false');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.hooksPath', path.join(directory, 'no-hooks'));
  git('init', '--bare', remote);
  git('remote', 'add', 'origin', remote);
  write('levels/official/campaign.json', manifest);
  write(`levels/official/${entry.file}`, { id: 'Breakfast', goal: 20 });
  write('src/official-levels.generated.js', 'initial bundle\n');
  write('src/engine.js', 'unchanged engine\n');
  git('add', '.');
  git('commit', '-m', 'Initial fixture');
  git('push', '-u', 'origin', 'main');
  const start = git('rev-parse', 'HEAD');
  const calls = [];
  let onTest = () => write('src/official-levels.generated.js', 'validated bundle\n');
  const options = {
    root,
    run(file, args) {
      calls.push([file, ...args]);
      if (file !== 'git') { onTest(); return ''; }
      if (args.slice(1).join(' ') === 'remote get-url origin') return 'https://github.com/ry-man/koshi.git\n';
      if (args.slice(1).join(' ') === 'remote get-url --push --all origin') return 'https://github.com/ry-man/koshi.git\n';
      return git(...args.slice(1));
    },
    smoke: async ids => { assert.deepEqual(ids, ['official-1-1']); },
    deployment: async sha => {
      assert.equal(git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0], sha);
      return 'https://github.com/ry-man/koshi/actions/runs/123';
    },
  };
  const edit = () => write(`levels/official/${entry.file}`, { id: 'Breakfast', goal: 25 });
  const lockExists = () => fs.existsSync(path.join(root, '.git', 'official-publish.lock'));
  return { root, git, write, start, calls, options, edit, lockExists, setTest: fn => { onTest = fn; } };
}

test('release summary uses permanent IDs, campaign order, moves, and semantic content', () => {
  const second = { ...entry, file: 'second.json', number: '2', id: 'official-1-2' };
  const renamed = { ...entry, file: 'renamed.json', worldId: '2', number: '4' };
  const plan = releasePlan(manifest, { levels: [second, renamed] }, () => ({ goal: 1 }), () => ({ goal: 2 }));
  assert.equal(plan.subject, 'Adding levels 1-2, updating levels 1-1 -> 2-4 in official campaign');
  assert.deepEqual(plan.ids, [second.id, entry.id]);
  assert.deepEqual(releasePlan(manifest, manifest, () => ({ goal: 1 }), () => ({ goal: 1 })).ids, []);
  assert.throws(() => releasePlan(manifest, { levels: [] }, () => ({}), () => ({})), /permanent IDs/);
});

test('publisher validates once, commits only release paths, pushes exact SHA, and leaves drafts', async t => {
  const f = fixture(t);
  f.edit();
  f.write('levels/official/draft.json', '{invalid draft');
  const result = await publishOfficialLevels(f.options);
  assert.equal(result.subject, 'Adding levels none, updating levels 1-1 in official campaign');
  assert.equal(f.calls.filter(call => call[0] !== 'git').length, 1, 'one npm test invocation');
  assert.deepEqual(result.paths, ['levels/official/world-1/1.json', 'src/official-levels.generated.js']);
  assert.match(f.git('status', '--short'), /\?\? levels\/official\/draft.json/);
  assert.match(f.git('log', '-1', '--format=%B'), /Co-authored-by: Copilot/);
  assert.equal(f.lockExists(), false);
});

test('check mode runs gates without fetching, committing, or pushing', async t => {
  const f = fixture(t); f.edit();
  const result = await publishOfficialLevels({ ...f.options, check: true });
  assert.equal(result.checked, true);
  assert.equal(f.git('rev-parse', 'HEAD'), f.start);
  assert.equal(f.calls.some(call => call.includes('fetch') || call.includes('commit') || call.includes('push')), false);
});

test('already current campaign does not commit or push', async t => {
  const f = fixture(t);
  f.setTest(() => {});
  const result = await publishOfficialLevels({ ...f.options, smoke: async () => {} });
  assert.equal(result.unchanged, true);
  assert.equal(f.git('rev-parse', 'HEAD'), f.start);
});

test('publisher rejects unsafe starting states without running tests', async t => {
  for (const [name, prepare, message] of [
    ['branch', f => f.git('switch', '-c', 'other'), /requires main/],
    ['merge in progress', f => f.write('.git/MERGE_HEAD', `${f.start}\n`), /Git operation is in progress/],
    ['staged changes', f => { f.edit(); f.git('add', '.'); }, /staged changes/],
    ['unrelated changes', f => f.write('src/engine.js', 'unrelated\n'), /Unrelated changes/],
    ['unpushed commits', f => { f.edit(); f.git('add', '.'); f.git('commit', '-m', 'Unpublished'); }, /HEAD must match/],
    ['behind remote', f => {
      const commit = f.git('commit-tree', f.git('rev-parse', 'HEAD^{tree}'), '-p', f.start, '-m', 'Remote advance');
      f.git('push', 'origin', `${commit}:refs/heads/main`);
    }, /HEAD must match/],
  ]) {
    await t.test(name, async t => {
      const f = fixture(t); prepare(f);
      await assert.rejects(publishOfficialLevels(f.options), message);
      assert.equal(f.calls.some(call => call[0] !== 'git'), false);
      assert.equal(f.lockExists(), false);
    });
  }
});

test('a different push URL is rejected before validation', async t => {
  const f = fixture(t);
  const run = f.options.run;
  await assert.rejects(publishOfficialLevels({
    ...f.options, run(file, args, ...rest) {
      if (file === 'git' && args.slice(1).join(' ') === 'remote get-url --push --all origin') return 'https://github.com/other/repo.git\n';
      return run(file, args, ...rest);
    },
  }), /push only to ry-man\/koshi/);
  assert.equal(f.calls.some(call => call[0] !== 'git'), false);
});

test('failed tests or browser checks block commit and push', async t => {
  for (const gate of ['test', 'smoke']) {
    await t.test(gate, async t => {
      const f = fixture(t); f.edit();
      if (gate === 'test') f.setTest(() => { throw new Error('test failed'); });
      else f.options.smoke = async () => { throw new Error('smoke failed'); };
      await assert.rejects(publishOfficialLevels(f.options), new RegExp(`${gate} failed`));
      assert.equal(f.git('rev-parse', 'HEAD'), f.start);
      assert.equal(f.calls.some(call => call.includes('push')), false);
      assert.equal(f.lockExists(), false);
    });
  }
});

test('concurrent input edits and index changes block release', async t => {
  for (const change of [
    f => f.write(`levels/official/${entry.file}`, { id: 'During smoke', goal: 26 }),
    f => f.write('src/engine.js', 'edited during smoke\n'),
    f => f.git('add', '.'),
    f => f.git('switch', '-c', 'other-during-smoke'),
  ]) {
    const f = fixture(t); f.edit();
    await assert.rejects(publishOfficialLevels({ ...f.options, smoke: async () => change(f) }), /changed during validation/);
    assert.equal(f.git('rev-parse', 'HEAD'), f.start);
  }
});

test('a concurrent publisher cannot acquire the release lock', async t => {
  const f = fixture(t);
  const lock = path.join(f.root, '.git', 'official-publish.lock');
  fs.writeFileSync(lock, '');
  await assert.rejects(publishOfficialLevels(f.options), /Another Official publisher/);
  assert.equal(fs.existsSync(lock), true, 'does not remove another publisher lock');
});

test('moving a source preserves its ID and commits the exact move', async t => {
  const f = fixture(t);
  f.write('levels/official/campaign.json', { version: 1, levels: [{ ...entry, file: 'world-1/renamed.json' }] });
  fs.renameSync(path.join(f.root, 'levels', 'official', 'world-1', '1.json'),
    path.join(f.root, 'levels', 'official', 'world-1', 'renamed.json'));
  const result = await publishOfficialLevels(f.options);
  assert.deepEqual(result.paths, [
    'levels/official/campaign.json', 'levels/official/world-1/1.json',
    'levels/official/world-1/renamed.json', 'src/official-levels.generated.js',
  ]);
  assert.equal(result.subject, 'Adding levels none, updating levels 1-1 in official campaign');
});

test('remote advancing during smoke blocks staging and commit', async t => {
  const f = fixture(t); f.edit();
  await assert.rejects(publishOfficialLevels({
    ...f.options, smoke: async () => {
      const commit = f.git('commit-tree', f.git('rev-parse', 'HEAD^{tree}'), '-p', f.start, '-m', 'Remote advance');
      f.git('push', 'origin', `${commit}:refs/heads/main`);
    },
  }), /origin\/main advanced/);
  assert.equal(f.git('rev-parse', 'HEAD'), f.start);
  assert.equal(f.git('diff', '--cached', '--name-only'), '');
});

test('changes made by a commit hook prevent pushing', async t => {
  const f = fixture(t); f.edit();
  const run = f.options.run;
  await assert.rejects(publishOfficialLevels({
    ...f.options, run(file, args, ...rest) {
      const output = run(file, args, ...rest);
      if (file === 'git' && args[1] === 'commit') f.write('src/engine.js', 'hook modification\n');
      return output;
    },
  }), /possibly in a hook.*not pushing/i);
  assert.notEqual(f.git('rev-parse', 'HEAD'), f.start, 'the local commit is left for review');
  assert.equal(f.calls.some(call => call[1] === '--no-pager' && call[2] === 'push'), false);
});

test('deployment failure clearly reports that push succeeded but production is unverified', async t => {
  const f = fixture(t); f.edit();
  await assert.rejects(publishOfficialLevels({
    ...f.options, deployment: async () => { throw new Error('deployment failed'); },
  }), /deployment failed\nPush succeeded; production deployment is NOT verified/);
});

test('failed push reports unknown remote state rather than claiming no push occurred', async t => {
  const f = fixture(t); f.edit();
  const run = f.options.run;
  await assert.rejects(publishOfficialLevels({
    ...f.options, run(file, args, ...rest) {
      if (file === 'git' && args[1] === 'push') throw new Error('Connection lost');
      return run(file, args, ...rest);
    },
  }), /remote state is unknown/);
});

test('deployment waits for exact SHA and requires successful test and deploy jobs', async () => {
  let polls = 0;
  const run = { id: 123, head_sha: 'abc', head_branch: 'main', html_url: 'https://example.invalid/run', status: 'completed', conclusion: 'success' };
  const jobs = ['test', 'deploy'].map(name => ({ name, status: 'completed', conclusion: 'success' }));
  const api = async endpoint => {
    if (endpoint.includes('/jobs')) return { jobs };
    assert.match(endpoint, /head_sha=abc&event=push/);
    return { workflow_runs: ++polls === 1 ? [{ ...run, head_sha: 'wrong' }] : [run] };
  };
  assert.equal(await waitForDeployment('abc', { api, sleep: async () => {} }), run.html_url);
  jobs[1].conclusion = 'skipped';
  await assert.rejects(waitForDeployment('abc', { api }), /deploy job did not succeed/);
  await assert.rejects(waitForDeployment('abc', {
    api: async () => ({ workflow_runs: [{ ...run, conclusion: 'failure' }] }),
  }), /workflow failure/);
  await assert.rejects(waitForDeployment('abc', { timeout: 0 }), /timed out/);
});
