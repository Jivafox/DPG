import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const ignored = new Set(['.git', 'node_modules', 'dist', '.DS_Store']);
const structureOnly = process.argv.includes('--structure-only');
const errors = [];
// Diagnostics deliberately omit paths, values and source excerpts.
const fail = (_location, reason) => errors.push(reason);
let rules = [];
const args = process.argv.slice(2);
if (args.some(arg => !['--structure-only', '--history', '--dist'].includes(arg)) ||
    (structureOnly && args.includes('--history'))) {
  console.error('✕ 检查参数无效');
  process.exit(1);
}
if (!structureOnly) {
  try {
    const configuredPath = process.env.DPG_GUARD_FILE ?? path.join(os.homedir(), '.config', 'dpg', 'guard.txt');
    const guardPath = fs.realpathSync(configuredPath);
    const relative = path.relative(fs.realpathSync(root), guardPath);
    if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) throw new Error();
    if (!fs.statSync(guardPath).isFile()) throw new Error();
    rules = fs.readFileSync(guardPath, 'utf8').split(/\r?\n/)
      .map(value => value.trim()).filter(Boolean).map(value => Buffer.from(value));
    if (!rules.length) throw new Error();
  } catch {
    console.error('✕ 私有规则未就绪：必须使用仓库外可读取的非空规则文件；完整检查未通过');
    process.exit(1);
  }
}

function hasRule(bytes) {
  const lowered = Buffer.from(bytes).map(x => x >= 65 && x <= 90 ? x + 32 : x);
  const views = [lowered];
  // Typical UTF-16 text is checked in addition to raw bytes.
  if (lowered.length > 1) {
    views.push(Buffer.from(lowered.filter((_, index) => index % 2 === 0)));
    views.push(Buffer.from(lowered.filter((_, index) => index % 2 === 1)));
  }
  return rules.some(rule => views.some(view => view.includes(Buffer.from(rule).map(x => x >= 65 && x <= 90 ? x + 32 : x))));
}

function scan(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (dir === root && ignored.has(item.name)) continue;
    const absolute = path.join(dir, item.name);
    const relative = path.relative(root, absolute);
    if (hasRule(Buffer.from(relative))) fail(relative, '路径命中内容规则');
    if (item.isSymbolicLink()) { fail(relative, '不允许符号链接'); continue; }
    if (item.isDirectory()) { scan(absolute); continue; }
    if (!item.isFile()) { fail(relative, '未知文件类型'); continue; }
    try { if (hasRule(fs.readFileSync(absolute))) fail(relative, '内容命中规则'); }
    catch (error) { fail(relative, `无法读取：${error.code ?? 'unknown'}`); }
  }
}

function readJson(relative) {
  try { return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')); }
  catch { fail(relative, '缺失或 JSON 无效'); return null; }
}

function checkTools() {
  const index = readJson('tools.json');
  if (!index || !Array.isArray(index.published) || Object.keys(index).join() !== 'published') {
    fail('tools.json', '应仅包含 published 数组'); return;
  }
  const slugs = index.published;
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (new Set(slugs).size !== slugs.length) fail('tools.json', '重复登记');
  const toolsDir = path.join(root, 'tools');
  if (!fs.existsSync(toolsDir)) {
    if (slugs.length) fail('tools/', '登记了不存在的目录');
    return;
  }
  for (const dirent of fs.readdirSync(toolsDir, { withFileTypes: true })) {
    const slug = dirent.name;
    if (!dirent.isDirectory() || !slugPattern.test(slug)) { fail(`tools/${slug}`, '目录名无效'); continue; }
    const meta = readJson(`tools/${slug}/tool.json`);
    const entry = path.join(toolsDir, slug, 'index.html');
    if (!fs.existsSync(entry)) fail(`tools/${slug}`, '缺少 index.html');
    if (!meta) continue;
    for (const key of ['id', 'name', 'description', 'entry', 'version', 'created', 'updated', 'status']) {
      if (typeof meta[key] !== 'string' || !meta[key].trim()) fail(`tools/${slug}/tool.json`, `缺少 ${key}`);
    }
    if (meta.id !== slug || meta.entry !== 'index.html') fail(`tools/${slug}/tool.json`, 'id/entry 不符');
    if (!Array.isArray(meta.tags) || meta.tags.some(tag => typeof tag !== 'string')) fail(`tools/${slug}/tool.json`, 'tags 无效');
    if (!['draft', 'review', 'ready', 'published'].includes(meta.status)) fail(`tools/${slug}/tool.json`, 'status 无效');
    if (!/^\d+\.\d+\.\d+$/.test(meta.version ?? '')) fail(`tools/${slug}/tool.json`, 'version 无效');
    for (const key of ['created', 'updated']) if (!/^\d{4}-\d{2}-\d{2}$/.test(meta[key] ?? '') || Number.isNaN(Date.parse(meta[key]))) fail(`tools/${slug}/tool.json`, `${key} 无效`);
    if (meta.status === 'published' !== slugs.includes(slug)) fail(`tools/${slug}/tool.json`, '发布状态与索引不一致');
    if (meta.cover && (typeof meta.cover !== 'string' || meta.cover.startsWith('/') || meta.cover.includes('..') || !fs.existsSync(path.join(toolsDir, slug, meta.cover)))) fail(`tools/${slug}/tool.json`, 'cover 路径无效');
  }
  for (const slug of slugs) if (typeof slug !== 'string' || !slugPattern.test(slug) || !fs.existsSync(path.join(toolsDir, slug, 'tool.json'))) fail('tools.json', '索引包含不存在的工具');
}

function checkHistory() {
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'buffer', maxBuffer: 128 * 1024 * 1024 });
  const inside = git('rev-parse', '--is-inside-work-tree');
  if (inside.status !== 0) { fail('history', '无法读取 Git 历史'); return; }
  const objects = git('rev-list', '--objects', '--all');
  if (objects.status !== 0) { fail('history', '无法列出 Git 对象'); return; }
  for (const line of objects.stdout.toString('utf8').split('\n').filter(Boolean)) {
    const oid = line.slice(0, 40);
    if (hasRule(Buffer.from(line.slice(41)))) fail(`history:${oid.slice(0, 12)}`, '历史路径命中规则');
    const type = git('cat-file', '-t', oid);
    if (type.status !== 0) { fail('history', '无法读取对象类型'); continue; }
    if (!['blob', 'commit', 'tag'].includes(type.stdout.toString('utf8').trim())) continue;
    const content = git('cat-file', '-p', oid);
    if (content.status !== 0) { fail(`history:${oid.slice(0, 12)}`, '无法读取对象'); continue; }
    if (hasRule(content.stdout)) fail(`history:${oid.slice(0, 12)}`, '历史内容命中规则');
  }
}

try {
  scan(root);
  checkTools();
  if (process.argv.includes('--history')) checkHistory();
  if (process.argv.includes('--dist')) {
    const output = path.join(root, 'dist');
    if (!fs.existsSync(output) || fs.lstatSync(output).isSymbolicLink() || !fs.existsSync(path.join(output, 'index.html'))) fail('dist', '构建产物缺失或无效');
    else scan(output);
  }
} catch {
  fail('check', '检查无法完成；请在本地私有环境排查，不公开原始异常');
}
if (errors.length) {
  for (const error of errors) console.error(`✕ ${error}`);
  process.exitCode = 1;
} else console.log(structureOnly
  ? '✓ 通用结构检查通过；未执行私有内容检查，不可作为推送或发布依据'
  : '✓ 私有内容与工具结构检查通过；仍需人工复核');
