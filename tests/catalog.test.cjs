const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DOMParser } = require('linkedom');
const catalog = require('../app/catalog').TioCatalog;
const { validPath } = require('../service/client');
test('pagination goes both ways, keeps search and hides disabled previous links', () => {
  const html = '<ul class="pagination"><li><a rel="prev" href="/directorio?p=1">«</a></li><li><a rel="next" href="/directorio?p=3">»</a></li></ul>';
  const result = catalog.parse(html, '/directorio?q=one%20piece&p=2', DOMParser);
  assert.equal(result.prev, '/directorio?p=1&q=one+piece');
  assert.equal(result.next, '/directorio?p=3&q=one+piece');
  assert.ok(validPath(result.prev));
  assert.equal(catalog.parse('<li class="disabled"><a rel="prev" href="#">«</a></li>', '/directorio', DOMParser).prev, '');
  assert.equal(catalog.parse('<a rel="prev" href="https://external.test/directorio?p=1">«</a>', '/directorio?p=2', DOMParser).prev, '');
});
test('catalog uses text and permits only site page links', () => {
  const html = '<article class="episode"><a href="/ver/demo-1"><img src="/uploads/a.jpg"><h3>A &amp; B</h3></a></article><article class="episode"><a href="https://evil.example/ver/demo"><h3>External</h3></a></article>';
  const result = catalog.parse(html, '/', DOMParser);
  assert.deepEqual(result.items, [{ path: '/ver/demo-1', title: 'A & B', image: 'https://tioanime.com/uploads/a.jpg' }]);
});
test('detail reads only JSON and produces valid episode routes', () => {
  const html = '<h1 class="title">Demo</h1><script>var anime_info = ["10","demo","Demo"]; var episodes = [2,1];</script>';
  assert.deepEqual(catalog.parse(html, '/anime/demo', DOMParser).items.map(x => x.path), ['/ver/demo-2', '/ver/demo-1']);
  assert.equal(catalog.parse(html.replace('[2,1]', '[alert(1)]'), '/anime/demo', DOMParser).items.length, 0);
});
test('detail extracts metadata only from the main anime and tolerates missing fields', () => {
  const html = '<article class="anime-single"><a class="status"> En Emisión </a><div class="meta"><span class="anime-type-peli">TV</span><span class="year">2026</span></div><p class="genres"><a>Acci&oacute;n</a><a>Fantasía</a><a>Acci&oacute;n</a></p></article><aside><span class="year">1999</span><div class="genres"><a>Otro</a></div></aside>';
  const result = catalog.parse(html, '/anime/demo', DOMParser);
  assert.equal(result.status, 'En Emisión');
  assert.equal(result.year, '2026');
  assert.equal(result.format, 'TV');
  assert.deepEqual(result.genres, ['Acción', 'Fantasía']);
  const empty = catalog.parse('<h1>Demo</h1>', '/anime/demo', DOMParser);
  assert.equal(empty.status, '');
  assert.equal(empty.year, '');
  assert.deepEqual(empty.genres, []);
});
test('player rejects executable and insecure URLs', () => {
  const html = '<script>var videos = [["bad","javascript:alert(1)"],["http","http://external.test/a"],["ok","https://external.test/embed/a"]];</script>';
  assert.deepEqual(catalog.parse(html, '/ver/demo-1', DOMParser).items, [{ title: 'ok', url: 'https://external.test/embed/a' }]);
});
test('service cannot request arbitrary URLs or unrelated paths', () => {
  for (const p of ['/', '/directorio', '/directorio?q=one%20piece', '/directorio?p=2', '/directorio?q=naruto&p=2', '/anime/demo', '/ver/demo-1']) assert.ok(validPath(p), p);
  for (const p of [null, 'https://evil.test', '//evil.test', '/admin', '/ver/../admin', '/directorio?q=a\r\nX:b']) assert.equal(validPath(p), false, p);
});
