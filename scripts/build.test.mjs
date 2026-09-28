import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dpg-build-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts'));
  for (const file of ['build.mjs', 'verify.mjs']) fs.copyFileSync(path.join(import.meta.dirname, file), path.join(root, 'scripts', file));
  fs.mkdirSync(path.join(root, 'site')); fs.writeFileSync(path.join(root, 'site/index.html'), '<!doctype html><title>Fixture</title>');
  fs.mkdirSync(path.join(root, 'docs')); fs.writeFileSync(path.join(root, 'docs/private-fixture.txt'), 'must not be shipped');
  fs.writeFileSync(path.join(root, 'tools.json'), '{"published":[]}');
  const tool = (id, status) => {
    const dir = path.join(root, 'tools', id); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), '<title>Fixture tool</title>');
    fs.writeFileSync(path.join(dir, 'tool.json'), JSON.stringify({ id, name: id, description: 'Fixture', tags: [], entry: 'index.html', version: '1.0.0', created: '2026-09-28', updated: '2026-09-28', status, privateNote: 'must not ship' }));
  };
  const build = () => spawnSync(process.execPath, [path.join(root, 'scripts/build.mjs'), '--structure-only'], { encoding: 'utf8' });
  return { root, tool, build };
}
test('build preserves catalog order and excludes drafts, docs and private metadata', t => {
  const { root, tool, build } = fixture(t);
  tool('second', 'published'); tool('first', 'published'); tool('draft', 'draft');
  fs.writeFileSync(path.join(root, 'tools.json'), '{"published":["second","first"]}');
  assert.equal(build().status, 0);
  const output = path.join(root, 'dist');
  const catalog = JSON.parse(fs.readFileSync(path.join(output, 'catalog.json')));
  assert.deepEqual(catalog.tools.map(x => x.id), ['second', 'first']);
  assert.equal('privateNote' in catalog.tools[0], false);
  for (const name of ['docs', 'scripts', 'tools/draft', 'tools/first/tool.json']) assert.equal(fs.existsSync(path.join(output, name)), false);
  assert.equal(fs.existsSync(path.join(output, '.nojekyll')), true);
});
test('unpublishing a tool removes stale output on rebuild', t => {
  const { root, tool, build } = fixture(t); tool('demo', 'published');
  fs.writeFileSync(path.join(root, 'tools.json'), '{"published":["demo"]}'); assert.equal(build().status, 0);
  tool('demo', 'ready'); fs.writeFileSync(path.join(root, 'tools.json'), '{"published":[]}');
  assert.equal(build().status, 0); assert.equal(fs.existsSync(path.join(root, 'dist/tools/demo')), false);
});
test('inconsistent publication is blocked', t => {
  const { root, tool, build } = fixture(t); tool('demo', 'draft');
  fs.writeFileSync(path.join(root, 'tools.json'), '{"published":["demo"]}'); assert.notEqual(build().status, 0);
});
test('unknown archive and symlink assets are blocked', t => {
  const { root, build } = fixture(t);
  const asset = path.join(root, 'site/source.zip'); fs.writeFileSync(asset, 'not a runtime file'); assert.notEqual(build().status, 0);
  fs.unlinkSync(asset); fs.symlinkSync(path.join(root, 'docs/private-fixture.txt'), path.join(root, 'site/reference.txt')); assert.notEqual(build().status, 0);
});
