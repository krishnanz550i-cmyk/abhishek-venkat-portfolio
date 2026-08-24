/** Minimal static server for testing the built site. Mirrors how a real static
 *  host resolves /path -> /path/index.html. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.woff2':'font/woff2',
  '.xml':'application/xml', '.txt':'text/plain' };

export function serve(root, port = 4321, base = '') {
  const server = createServer(async (req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    // Mimic a host that serves the site under a sub-path, the way GitHub Pages
    // serves a project site at /repo-name/.
    if (base && (p === base || p.startsWith(base + '/'))) p = p.slice(base.length) || '/';
    else if (base) { res.writeHead(404); res.end('outside base'); return; }
    let file = join(root, p);
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    } catch {
      try { await stat(file + '/index.html'); file = file + '/index.html'; }
      catch { file = join(root, '404.html'); }
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}
