const assert = require('node:assert/strict');
const dns = require('node:dns');
dns.lookup = (host, options, callback) => {
  if (host === '127.0.0.1') { (typeof options === 'function' ? options : callback)(null, host, 4); return; }
  throw new Error('DNS del sistema prohibido: ' + host);
};
const { DOMParser } = require('linkedom');
const { TioCatalog } = require('../app/catalog');
const { JKCatalog } = require('../app/jkanime');
const client = require('../service/client');
const provider = require('../service/provider');
const resources = require('../service/resources');
const call = (fn, value) => new Promise((ok, fail) => fn(value, (e, r) => e ? fail(e) : ok(r)));
(async () => {
  for (const [name, path, parser] of [
    ['TioAnime', '/ver/dark-summoner-to-dekiteiru-4', TioCatalog],
    ['JKAnime', '/jk/ver/shingeki-no-kyojin/1', JKCatalog]
  ]) {
    const page = parser.parse(await call(client.load, path), path, DOMParser);
    const source = page.items.find(item => /^https:\/\/voe\.sx\/e\//.test(item.url));
    assert(source, name + ': enlace VOE publicado');
    const result = await call(provider.probe, source.url);
    assert(result.streamUrl, name + ': fuente nativa VOE');
    let url = result.streamUrl;
    for (let level = 0; level < 3; level++) {
      const response = await fetch(url); assert.equal(response.status, 200);
      const text = await response.text(); assert.match(text, /^#EXTM3U/);
      url = text.split(/\r?\n/).find(line => line && line[0] !== '#');
      assert.match(url, /^http:\/\/127\.0\.0\.1:/);
      if (!text.includes('#EXT-X-STREAM-INF')) break;
    }
    const segment = await fetch(url, { headers: { Range: 'bytes=0-1023' } });
    assert.equal(segment.status, 206);
    const bytes = new Uint8Array(await segment.arrayBuffer());
    assert.equal(bytes.length, 1024); assert.equal(bytes[0], 0x47);
    console.log('OK: ' + name + ' VOE: listas HLS 200 y segmento MPEG-TS 206 por Cloudflare.');
  }
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => resources.close());
