const assert = require('node:assert/strict');
const dns = require('node:dns');
dns.lookup = (host, options, cb) => { if (host === '127.0.0.1') { (typeof options === 'function' ? options : cb)(null, host, 4); return; } throw Error('DNS del sistema prohibido: ' + host); };
const { DOMParser } = require('linkedom');
const { HiCatalog } = require('../app/hianime');
const { TioSubtitles } = require('../app/subtitles');
const client = require('../service/client'), provider = require('../service/provider'), resources = require('../service/resources');
const call = (fn, value) => new Promise((ok, no) => fn(value, (e, r) => e ? no(e) : ok(r)));
const load = async path => HiCatalog.parse(await call(client.load, path), path, DOMParser);
(async () => {
  const search = await load('/hi/search?q=Attack%20on%20Titan');
  const card = search.items.find(item => item.path === '/hi/anime/attack-on-titan-240'); assert(card);
  const detail = await load(card.path); assert.equal(detail.items.length, 25);
  const image = await fetch(detail.assets[detail.image]); assert.equal(image.status, 200); await image.arrayBuffer();
  const episode = await load(detail.items[0].path); assert.equal(episode.episodeNumber, '1'); assert(episode.nextEpisode);
  const source = episode.items.find(item => item.managed && /\/sub$/.test(item.url)); assert(source);
  const result = await call(provider.probe, source.url); assert(result.streamUrl);
  let url = result.streamUrl;
  for (let i = 0; i < 3; i++) {
    const response = await fetch(url); assert.equal(response.status, 200); const body = await response.text(); assert.match(body, /^#EXTM3U/);
    url = body.split(/\r?\n/).find(line => line && line[0] !== '#'); assert.match(url, /^http:\/\/127\.0\.0\.1:/);
    if (!body.includes('#EXT-X-STREAM-INF')) break;
  }
  const segment = await fetch(url, { headers: { Range: 'bytes=0-1023' } });
  assert.equal(segment.status, 206); assert.match(segment.headers.get('content-type'), /video\/mp2t/i);
  const bytes = new Uint8Array(await segment.arrayBuffer()); assert.equal(bytes.length, 1024); assert.equal(bytes[0], 0x47);
  const track = result.subtitles.find(track => /Spanish/i.test(track.label)); assert(track);
  const subtitle = await fetch(track.url); assert.equal(subtitle.status, 200); assert(TioSubtitles.parse(await subtitle.text()).length > 100);
  console.log('OK: HiAnime: búsqueda, ficha, 25 episodios, portada, SUB/DUB y siguiente.');
  console.log('OK: ZokoAnime SUB: HLS 200, segmento TS 206, subtítulos Spanish WebVTT 200, todo por Cloudflare sin DNS del sistema.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => resources.close());
