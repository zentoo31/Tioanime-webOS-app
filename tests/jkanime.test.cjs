const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DOMParser } = require('linkedom');
const { JKCatalog } = require('../app/jkanime');
const jk = require('../service/jkanime');
const { TioHistory } = require('../app/history');
test('JKAnime has independent routes, details and paginated episodes', () => {
  const payload = { html: '<div class="anime_info"><h3>Demo</h3><p class="scroll">Historia</p></div><li>Estado: Concluido</li><li>Emitido: 2013</li><li>Generos: Acción, Drama</li>', episodes: { current_page: 2, last_page: 3, total: 40, data: [{ number: 17 }] } };
  const result = JKCatalog.parse(payload, '/jk/anime/demo?p=2', DOMParser);
  assert.equal(result.title, 'Demo');
  assert.equal(result.items[0].path, '/jk/ver/demo/17');
  assert.equal(result.prev, '/jk/anime/demo?p=1');
  assert.equal(result.next, '/jk/anime/demo?p=3');
  assert.equal(result.totalEpisodes, 40);
  assert.deepEqual(result.genres, ['Acción', 'Drama']);
  assert.equal(jk.validPath('/jk/search?q=one%20piece&p=2'), true);
  for (const path of ['/jk/search?q=a\r\nb', '/jk/anime/../admin', 'https://jkanime.net/', '/jk/ver/a/not-a-number']) assert.equal(jk.validPath(path), false);
});
test('JKAnime extracts playable links without executing scripts or mixing external detail routes', () => {
  const remote = Buffer.from('https://voe.sx/e/demo').toString('base64');
  const html = '<a href="https://jkanime.net/demo/">Demo</a><a href="https://jkanime.net/demo/2/">Siguiente</a><a href="https://evil.test/demo/3/">Siguiente</a><a id="btn-show-0">Desu</a><script>video[0] = \'<iframe src="https://jkanime.net/jkplayer/um?e=test"></iframe>\'; var servers = ' + JSON.stringify([{ server: 'VOE', remote }]) + ';</script>';
  const result = JKCatalog.parse({ html }, '/jk/ver/demo/1', DOMParser);
  assert.equal(result.animeTitle, 'Demo');
  assert.equal(result.animePath, '/jk/anime/demo');
  assert.equal(result.nextEpisode, '/jk/ver/demo/2');
  assert.equal(result.previousEpisode, '');
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every(item => item.managed));
});
test('history keeps identically named anime from both sources and preserves old records', () => {
  let saved = '';
  const storage = { getItem: () => saved, setItem: (key, value) => { saved = value; } };
  const history = TioHistory.create(storage);
  history.save({ animePath: '/anime/demo', path: '/ver/demo-1', title: 'Demo', episodeTitle: 'Demo 1' });
  history.save({ animePath: '/jk/anime/demo', path: '/jk/ver/demo/2', title: 'Demo', episodeTitle: 'Demo 2' });
  assert.equal(TioHistory.create(storage).list().length, 2);
  history.remove('/jk/anime/demo');
  assert.equal(history.list()[0].animePath, '/anime/demo');
});
