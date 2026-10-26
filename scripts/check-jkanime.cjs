// Investigación aislada: no modifica la app ni la configuración DNS del equipo.
const https = require('node:https');
const dns = require('node:dns');
const { DOMParser } = require('linkedom');
const assert = require('node:assert/strict');
dns.lookup = () => { throw new Error('La prueba prohíbe el DNS del sistema'); };
const allowed = new Set(['jkanime.net', 'www.jkanime.net', 'cdn.jkdesa.com']);
const addresses = new Map();
const cookies = new Map();
function request(hostname, path, address, accept, options = {}) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error, result) => { if (finished) return; finished = true; clearTimeout(timer); error ? reject(error) : resolve(result); };
    const timer = setTimeout(() => { finish(new Error('Tiempo agotado: ' + hostname)); req.destroy(); }, 15000);
    const headers = { Accept: accept, 'User-Agent': 'TioAnimeTV/0.2.9', ...options.headers };
    if (cookies.has(hostname)) headers.Cookie = cookies.get(hostname);
    if (options.body) headers['Content-Length'] = Buffer.byteLength(options.body);
    const req = https.request({ hostname, servername: hostname, path, family: 4, agent: false, method: options.method || 'GET',
      lookup: (host, options, cb) => cb(null, address, 4),
      headers
    }, response => {
      const chunks = []; let length = 0;
      response.on('data', chunk => { length += chunk.length; if (length > 3 * 1024 * 1024) { finish(new Error('Respuesta demasiado grande')); req.destroy(); return; } chunks.push(chunk); });
      response.on('end', () => finish(null, { status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
      response.on('error', finish);
      response.on('aborted', () => finish(new Error('Respuesta interrumpida')));
    });
    req.on('error', finish);
    req.end(options.body);
  });
}
async function resolve(hostname) {
  if (!allowed.has(hostname)) throw new Error('Dominio fuera de esta prueba: ' + hostname);
  if (addresses.has(hostname)) return addresses.get(hostname);
  let error;
  for (const ip of ['1.1.1.1', '1.0.0.1']) {
    try {
      const response = await request('cloudflare-dns.com', '/dns-query?name=' + encodeURIComponent(hostname) + '&type=A', ip, 'application/dns-json');
      const data = JSON.parse(response.body.toString('utf8'));
      const answer = data.Status === 0 && (data.Answer || []).find(record => record.type === 1);
      if (response.status !== 200 || !answer) throw new Error('No se pudo resolver ' + hostname);
      addresses.set(hostname, answer.data); return answer.data;
    } catch (e) { error = e; }
  }
  throw error;
}
async function read(value, options = {}, redirects = 0) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.port || url.username || url.password) throw new Error('URL no permitida');
  const response = await request(url.hostname, url.pathname + url.search, await resolve(url.hostname), '*/*', options);
  if (response.headers['set-cookie']) cookies.set(url.hostname, response.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; '));
  if ([301, 302, 303, 307, 308].includes(response.status) && redirects < 3) return read(new URL(response.headers.location, url).href, {}, redirects + 1);
  return { ...response, url: url.href, text: response.body.toString('utf8') };
}
function document(response) { return new DOMParser().parseFromString(response.text, 'text/html'); }
async function main() {
  const home = await read('https://jkanime.net/');
  if (home.status !== 200) throw new Error('Inicio HTTP ' + home.status);
  const doc = document(home);
  const form = doc.querySelector('form[action*="buscar"]');
  console.log('Inicio:', home.status, 'CORS:', home.headers['access-control-allow-origin'] || 'no declarado');
  console.log('Búsqueda:', form && form.getAttribute('action'), form && Array.from(form.querySelectorAll('input')).map(input => ({ name: input.getAttribute('name'), type: input.getAttribute('type') })));
  const search = await read('https://jkanime.net/buscar?q=naruto');
  assert.equal(search.status, 200);
  const results = Array.from(document(search).querySelectorAll('.anime__item h5 a'));
  assert.ok(results.length > 0, 'Resultados de búsqueda');
  console.log('Resultados de Naruto:', results.length, 'URL final:', search.url);
  const naruto = results.find(link => link.getAttribute('href') === 'https://jkanime.net/naruto/');
  assert.ok(naruto, 'Ficha de Naruto encontrada desde la búsqueda');
  const detail = await read(naruto.getAttribute('href'));
  assert.equal(detail.status, 200);
  const detailDoc = document(detail);
  assert.equal(detailDoc.querySelector('.anime_info h3').textContent.trim(), 'Naruto');
  const apiMatch = detail.text.match(/https:\/\/jkanime\.net\/ajax\/episodes\/(\d+)\//);
  assert.ok(apiMatch, 'Identificador para el listado de episodios');
  const csrf = detailDoc.querySelector('meta[name="csrf-token"]').getAttribute('content');
  async function episodes(page) {
    const response = await read('https://jkanime.net/ajax/episodes/' + apiMatch[1] + '/' + page, {
      method: 'POST', body: new URLSearchParams({ _token: csrf }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Referer: detail.url }
    });
    assert.equal(response.status, 200, 'Listado de episodios');
    const json = JSON.parse(response.text);
    assert.ok(Array.isArray(json.data) && json.data.length > 0);
    return json;
  }
  const first = await episodes(1);
  const second = await episodes(2);
  assert.notEqual(first.data[0].number, second.data[0].number);
  console.log('Episodios:', JSON.stringify({ total: first.total, porPagina: first.data.length, pagina2: second.data.length, ultimo: first.last_page }));
  const imageNode = detailDoc.querySelector('img[src*="/animes/image/naruto.jpg"]');
  assert.ok(imageNode);
  const image = await read(imageNode.getAttribute('src'));
  assert.equal(image.status, 200);
  assert.match(image.headers['content-type'], /^image\//);
  console.log('Portada por DoH:', image.status, image.headers['content-type']);
  const episode = await read('https://jkanime.net/naruto/' + first.data[0].number + '/');
  assert.equal(episode.status, 200);
  const serversMatch = episode.text.match(/var\s+servers\s*=\s*(\[[\s\S]*?\]);/);
  assert.ok(serversMatch, 'Servidores del episodio');
  const servers = JSON.parse(serversMatch[1]);
  assert.ok(servers.length);
  const embedded = Array.from(episode.text.matchAll(/video\[\d+\]\s*=\s*'[^\n]*?src="(https:\/\/jkanime\.net\/jkplayer\/[^"\s]+)"/g));
  console.log('Página de episodio:', episode.status, 'reproductores propios:', embedded.length);
  console.log('Servidores publicados:', [...new Set(servers.map(server => server.server))].join(', '));
  if (embedded.length) {
    const player = await read(embedded[0][1]);
    console.log('Wrapper JKPlayer:', player.status, 'bytes:', player.body.length, 'reproducción no verificada');
  }
  console.log('Dominios resueltos por Cloudflare:', [...addresses.keys()].join(', '));
  console.log('OK: búsqueda, ficha, episodios paginados y portada accesibles sin DNS del sistema.');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { read, document, resolve };
