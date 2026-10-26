// Solo este proceso: todos los dominios deben pasar por DoH, sin cambiar el DNS del equipo.
const assert = require('node:assert/strict');
const dns = require('node:dns');
dns.lookup = (host, options, callback) => {
  if (host === '127.0.0.1') { (typeof options === 'function' ? options : callback)(null, host, 4); return; }
  throw new Error('DNS del sistema prohibido: ' + host);
};
const { DOMParser } = require('linkedom');
const jk = require('../service/jkanime');
const relay = require('../service/resources');
const { JKCatalog } = require('../app/jkanime');
const load = path => new Promise((ok, fail) => jk.load(path, (e, data) => e ? fail(e) : ok(JKCatalog.parse(data, path, DOMParser))));
const probe = url => new Promise((ok, fail) => jk.probe(url, (e, result) => e ? fail(e) : ok(result)));
(async () => {
  const search = await load('/jk/search?q=shingeki');
  assert(search.items.some(item => item.path === '/jk/anime/shingeki-no-kyojin'));
  const detail = await load('/jk/anime/shingeki-no-kyojin');
  assert.equal(detail.totalEpisodes, 25); assert(detail.next);
  const page2 = await load(detail.next);
  assert(page2.items.some(item => item.path === '/jk/ver/shingeki-no-kyojin/25'));
  const poster = await fetch(detail.assets[detail.image]);
  assert.equal(poster.status, 200); assert.match(poster.headers.get('content-type'), /image/); await poster.arrayBuffer();
  const episode = await load('/jk/ver/shingeki-no-kyojin/1');
  assert.match(episode.animeTitle, /Shingeki no Kyojin/i);
  assert.equal(episode.nextEpisode, '/jk/ver/shingeki-no-kyojin/2');
  const native = episode.items.filter(item => jk.playerURL(item.url));
  assert(native.length >= 2);
  for (const source of native) {
    const result = await probe(source.url); assert(result.streamUrl);
    const playlist = await fetch(result.streamUrl); assert.equal(playlist.status, 200);
    const text = await playlist.text(); assert.match(text, /^#EXTM3U/);
    const segmentURL = text.split(/\r?\n/).find(line => line && line[0] !== '#');
    assert.match(segmentURL, /^http:\/\/127\.0\.0\.1:/);
    const segment = await fetch(segmentURL, { headers: { Range: 'bytes=0-1023' } });
    assert.equal(segment.status, 206);
    const bytes = new Uint8Array(await segment.arrayBuffer());
    assert.equal(bytes.length, 1024); assert.equal(bytes[0], 0x47);
    console.log('OK: ' + source.title + ': HLS 200, segmento MPEG-TS 206 (1024 bytes), DNS Cloudflare.');
  }
  console.log('OK: búsqueda, ficha, ambas páginas de episodios, portada y navegación del ejemplo.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => relay.close());
