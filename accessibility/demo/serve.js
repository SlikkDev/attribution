/**
 * Zero-dependency local server for the Accessibility Kit demo.
 *
 * Serves demo/index.html plus the widget file, and mocks the report endpoint
 * (POST /api/a11y-report → log + 200 { ok: true }) so the full submit flow
 * works with nothing installed and nothing emailed.
 *
 * Usage:  node demo/serve.js        (PORT env optional, default 4173)
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Explicit route map — nothing outside these two files is ever served.
const FILES = {
  '/': path.join(here, 'index.html'),
  '/index.html': path.join(here, 'index.html'),
  '/slikk-a11y.webcomponent.js': path.join(here, '..', 'slikk-a11y.webcomponent.js'),
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const MAX_BODY = 64 * 1024;

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'POST' && pathname === '/api/a11y-report') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) req.destroy();
    });
    req.on('end', () => {
      console.log('[mock a11y-report]', body);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  const file = FILES[pathname];
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] });
    res.end(data);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  }
});

const port = Number(process.env.PORT || 4173);
server.listen(port, () => {
  console.log(`Accessibility Kit demo → http://localhost:${port}`);
});
