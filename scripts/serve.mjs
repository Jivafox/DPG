import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../dist');
const flags = process.argv.slice(2);
let port = 4174; let base = '/';
for (let i = 0; i < flags.length; i++) {
  if (flags[i] === '--port') port = Number(flags[++i]);
  else if (flags[i] === '--base') base = flags[++i];
  else throw new Error('Unknown preview option');
}
if (!Number.isInteger(port) || port < 1 || port > 65535 || !/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('Invalid preview port or base path');
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Run npm run build first');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const url = new URL(req.url, 'http://localhost'); const pathname = decodeURIComponent(url.pathname);
    if (base !== '/' && pathname === base.slice(0, -1)) { res.writeHead(308, { Location: `${base}${url.search}` }); res.end(); return; }
    if (!pathname.startsWith(base)) { res.writeHead(404); res.end('Not found'); return; }
    const relative = pathname.slice(base.length);
    if (relative.split('/').some(part => part.startsWith('.') || part.includes('\\'))) { res.writeHead(404); res.end('Not found'); return; }
    let file = path.resolve(root, relative);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) throw new Error();
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    const real = fs.realpathSync(file);
    if (!real.startsWith(`${fs.realpathSync(root)}${path.sep}`) || !fs.statSync(real).isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(real).pipe(res);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', () => { console.error('Preview could not start. Check the port.'); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`DPG preview: http://127.0.0.1:${port}${base}`));
