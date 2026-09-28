import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--structure-only')) throw new Error('Unsupported build option');
const check = spawnSync(process.execPath, [path.join(root, 'scripts/verify.mjs'), ...args], { stdio: 'inherit' });
if (check.status !== 0) process.exit(1);
const output = path.join(root, 'dist');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'dpg-build-'));
const allowed = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.avif', '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm', '.mp3', '.wav', '.ogg', '.glb', '.gltf']);
function copyRuntime(source, target, { tool = false } = {}) {
  fs.mkdirSync(target, { recursive: true });
  for (const item of fs.readdirSync(source, { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw new Error('Symbolic links are not allowed in build inputs');
    if (tool && item.name === 'tool.json') continue;
    if (item.name.startsWith('.') || ['node_modules', 'docs', 'dist', 'scripts'].includes(item.name)) throw new Error('Non-runtime file in build inputs');
    const from = path.join(source, item.name); const to = path.join(target, item.name);
    if (item.isDirectory()) copyRuntime(from, to);
    else if (item.isFile() && (allowed.has(path.extname(item.name).toLowerCase()) || /^(LICENSE|NOTICE)(\.txt)?$/i.test(item.name))) fs.copyFileSync(from, to);
    else throw new Error('Unsupported runtime asset; review its purpose before adding it');
  }
}
try {
  const published = JSON.parse(fs.readFileSync(path.join(root, 'tools.json'), 'utf8')).published;
  copyRuntime(path.join(root, 'site'), stage);
  if (!fs.existsSync(path.join(stage, 'index.html'))) throw new Error('Site entry is missing');
  for (const name of ['tools', 'catalog.json', '.nojekyll']) if (fs.existsSync(path.join(stage, name))) throw new Error('Reserved build output name');
  const catalog = [];
  for (const slug of published) {
    const source = path.join(root, 'tools', slug);
    const meta = JSON.parse(fs.readFileSync(path.join(source, 'tool.json'), 'utf8'));
    if (meta.status !== 'published') throw new Error('Only published tools can be built');
    copyRuntime(source, path.join(stage, 'tools', slug), { tool: true });
    const item = {};
    for (const key of ['id', 'name', 'description', 'tags', 'entry', 'version', 'created', 'updated']) item[key] = meta[key];
    catalog.push(item);
  }
  fs.writeFileSync(path.join(stage, 'catalog.json'), `${JSON.stringify({ tools: catalog }, null, 2)}\n`);
  fs.writeFileSync(path.join(stage, '.nojekyll'), '');
  if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('Build output must not be a symbolic link');
  fs.rmSync(output, { recursive: true, force: true });
  fs.cpSync(stage, output, { recursive: true });
  const outputCheck = spawnSync(process.execPath, [path.join(root, 'scripts/verify.mjs'), ...args, '--dist'], { stdio: 'inherit' });
  if (outputCheck.status !== 0) { fs.rmSync(output, { recursive: true, force: true }); throw new Error('Output checks failed'); }
  console.log(`Built ${catalog.length} published tool(s) into dist.`);
} catch {
  console.error('Build failed: check runtime assets and publication metadata. Existing output may be stale; do not publish it.');
  process.exitCode = 1;
} finally { fs.rmSync(stage, { recursive: true, force: true }); }
