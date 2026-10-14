const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const client = require('../service/client');
const root = path.resolve(__dirname, '../app');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/page') {
    client.load(url.searchParams.get('path'), (error, html) => {
      res.writeHead(error ? 502 : 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(error ? { returnValue: false, errorText: error.message } : { returnValue: true, html }));
    });
    return;
  }
  let requested;
  try { requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, content) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(content);
  });
}).listen(8080, '127.0.0.1', () => console.log('Vista local: http://127.0.0.1:8080'));
