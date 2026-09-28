import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
function fixture(t, type = 'site') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dpg-release-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts')); fs.mkdirSync(path.join(root, 'docs/releases'), { recursive: true });
  fs.copyFileSync(path.join(import.meta.dirname, 'release-check.mjs'), path.join(root, 'scripts/release-check.mjs'));
  fs.writeFileSync(path.join(root, 'docs/releases/v0.1.0.md'), `Version: v0.1.0\nRelease-Type: ${type}\n`);
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  git('init', '-q', '-b', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'commit.gpgsign', 'false'); git('config', 'tag.gpgsign', 'false');
  git('add', '.'); git('commit', '-qm', 'fixture'); git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  const run = () => spawnSync(process.execPath, [path.join(root, 'scripts/release-check.mjs')], { env: { ...process.env, GITHUB_REF_NAME: 'v0.1.0', GITHUB_OUTPUT: path.join(root, 'result') }, encoding: 'utf8' });
  return { root, git, run };
}
test('annotated site version on main is eligible', t => { const { git, run, root } = fixture(t); git('tag', '-a', 'v0.1.0', '-m', 'fixture'); assert.equal(run().status, 0); assert.match(fs.readFileSync(path.join(root, 'result'), 'utf8'), /deploy=true/); });
test('specification version does not deploy', t => { const { git, run, root } = fixture(t, 'spec'); git('tag', '-a', 'v0.1.0', '-m', 'fixture'); assert.equal(run().status, 0); assert.match(fs.readFileSync(path.join(root, 'result'), 'utf8'), /deploy=false/); });
test('lightweight tag is rejected', t => { const { git, run } = fixture(t); git('tag', 'v0.1.0'); assert.notEqual(run().status, 0); });
test('version not in remote main is rejected', t => { const { git, run } = fixture(t); git('commit', '--allow-empty', '-qm', 'unreviewed'); git('tag', '-a', 'v0.1.0', '-m', 'fixture'); assert.notEqual(run().status, 0); });
