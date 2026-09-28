import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const tag = process.env.GITHUB_REF_NAME;
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
try {
  if (!/^v\d+\.\d+\.\d+$/.test(tag || '')) throw new Error();
  if (git('cat-file', '-t', `refs/tags/${tag}`) !== 'tag') throw new Error();
  const commit = git('rev-parse', `refs/tags/${tag}^{commit}`);
  if (commit !== git('rev-parse', 'HEAD')) throw new Error();
  git('merge-base', '--is-ancestor', commit, 'origin/main');
  const record = fs.readFileSync(path.join(root, 'docs/releases', `${tag}.md`), 'utf8');
  if (!record.split(/\r?\n/).includes(`Version: ${tag}`)) throw new Error();
  const type = record.match(/^Release-Type: (site|spec)$/m)?.[1];
  if (!type) throw new Error();
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${type === 'site'}\n`);
  console.log(type === 'site' ? 'Site release metadata and ancestry verified.' : 'Specification version: deployment skipped.');
} catch { console.error('Release blocked: verify annotated version tag, checked-out commit, main ancestry and version record.'); process.exitCode = 1; }
