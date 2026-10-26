const { test } = require('node:test');
const assert = require('node:assert/strict');
const okru = require('../service/okru');
function page(metadata) {
  const options = JSON.stringify({ flashvars: { metadata } }).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return '<div data-options="' + options + '"></div>';
}
test('Okru reads public metadata and selects an allowed rendition', () => {
  const metadata = { videos: [
    { name: 'low', url: 'https://vd1.okcdn.ru/?id=low' },
    { name: 'sd', url: 'https://vd1.okcdn.ru/?id=sd&a=1' },
    { name: 'hd', url: 'https://vd1.okcdn.ru/?id=hd', disallowed: true },
    { name: 'hd', url: 'https://evil.test/?id=hd' }
  ] };
  assert.equal(okru.extract(page(metadata)).mediaUrl, 'https://vd1.okcdn.ru/?id=sd&a=1');
  assert.equal(okru.extract(page(JSON.stringify(metadata))).mediaUrl, 'https://vd1.okcdn.ru/?id=sd&a=1');
  assert.equal(okru.valid('https://ok.ru/videoembed/123'), true);
  assert.equal(okru.valid('https://ok.ru.evil.test/videoembed/123'), false);
  assert.equal(okru.validSource('https://vd1.okcdn.ru.evil.test/?id=test'), false);
});
test('Okru respects restricted videos and malformed metadata', () => {
  const blocked = "OK.VideoPlayer && OK.VideoPlayer.yandexError('copyrightsRestricted');";
  assert.equal(okru.extract(blocked).unavailable, true);
  assert.match(okru.extract(blocked).message, /copyrightsRestricted/);
  assert.equal(okru.extract('<div data-options="invalid"></div>').mediaUrl, '');
});
