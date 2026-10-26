const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DOMParser } = require('linkedom');
const { HiCatalog } = require('../app/hianime');
const hi = require('../service/hianime');
const { TioSubtitles } = require('../app/subtitles');
const { TioHistory } = require('../app/history');
test('HiAnime separates sub/dub and episode IDs from episode numbers and other sources', () => {
  const episodes = [1, 2].map(n => '<a class="ep-item" data-number="' + n + '" data-id="' + (4401 + n) + '" title="Title"></a>').join('');
  const servers = ['sub', 'dub'].map(type => '<div class="server-item" data-type="' + type + '" data-hash="' + Buffer.from('https://zokoanime.video/stream/mal/16498/1/' + type).toString('base64') + '">ZokoAnime</div>').join('');
  const episode = HiCatalog.parse({ html: '<h2 class="film-name">Attack on Titan</h2>', episodes, servers }, '/hi/ver/attack-on-titan-240/4402', DOMParser);
  assert.equal(episode.episodeNumber, '1'); assert.equal(episode.previousEpisode, '');
  assert.equal(episode.nextEpisode, '/hi/ver/attack-on-titan-240/4403');
  assert.match(episode.items[0].title, /SUB/); assert.match(episode.items[1].title, /DUB/);
  assert(episode.items.every(item => item.managed));
  const history = TioHistory.create({ getItem: () => '[]', setItem: () => {} });
  assert(history.save({ animePath: episode.animePath, path: '/hi/ver/attack-on-titan-240/4402', title: episode.animeTitle, episodeTitle: episode.title }));
  assert.match(history.list()[0].episodeTitle, /Episodio 1/);
  assert(hi.validPath('/hi/search?q=Titan&p=2')); assert(!hi.validPath('/hi/ver/../../secret'));
  assert(!hi.playerURL('https://zokoanime.video.evil.test/stream/mal/16498/1/sub'));
});
test('HiAnime extracts only public media and validated subtitle data without executing scripts', () => {
  const encode = data => { const bytes = Buffer.from(JSON.stringify(data)), key = 'otaku-embed-v1'; for (let i = 0; i < bytes.length; i++) bytes[i] ^= key.charCodeAt(i % key.length); return '<script>window.__P="' + bytes.toString('base64') + '"</script>'; };
  const src = 'https://hls.dramahot.top/p/video/master.m3u8';
  const data = hi.source(encode({ src, subtitles: [{ label: 'Spanish', src: 'https://hls.dramahot.top/v/video/es.vtt' }, { label: 'Bad', src: 'https://evil.test/a.vtt' }] }));
  assert.equal(data.src, src); assert.equal(data.subtitles.length, 1);
  assert.equal(hi.source(encode({ src: 'https://evil.test/master.m3u8' })), null);
  assert.equal(hi.source('<script>window.__P = alert(1)</script>'), null);
});
test('WebVTT parses multilingual cues, timings, settings and safe plain text', () => {
  const cues = TioSubtitles.parse('WEBVTT\n\nfirst\n00:00:01.000 --> 00:00:03.500 align:start\n<i>Hola &amp; hello</i>\nsegunda línea\n\n00:04.000 --> 00:05.000\n<b>Fin</b>\n\n00:07.000 --> 00:06.000\nInvalid');
  assert.equal(cues.length, 2); assert.equal(cues[0].start, 1); assert.equal(cues[0].end, 3.5);
  assert.equal(cues[0].text, 'Hola & hello\nsegunda línea'); assert.equal(cues[1].text, 'Fin');
  assert.deepEqual(TioSubtitles.parse('<script>bad()</script>'), []);
});
