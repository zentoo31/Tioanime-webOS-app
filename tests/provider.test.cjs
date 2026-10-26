const { test } = require('node:test');
const assert = require('node:assert/strict');
const { valid, probe, mediaURL } = require('../service/provider');
test('local relay refuses arbitrary sources and referrers', async () => {
  const relay = require('../service/media-relay');
  await new Promise(ok => relay.issue('https://evil.test/video.mp4', 'https://www.yourupload.com/embed/test', error => { assert.ok(error); ok(); }));
  await new Promise(ok => relay.issue('https://vidcache.net/video.mp4', 'https://evil.test', error => { assert.ok(error); ok(); }));
});
test('YourUpload adapter reads only the public HTTPS MP4 metadata', () => {
  assert.equal(mediaURL('<meta property="og:video" content="https://vidcache.net:8161/demo/video.mp4?a=1&amp;b=2">'), 'https://vidcache.net:8161/demo/video.mp4?a=1&b=2');
  for (const value of ['http://vidcache.net/video.mp4', 'https://evil.test/video.mp4', 'https://vidcache.net.evil.test/video.mp4', 'https://user:password@vidcache.net/video.mp4', 'javascript:alert(1)', 'https://[invalid']) {
    assert.equal(mediaURL('<meta property="og:video" content="' + value + '">'), '');
  }
});
test('provider check only accepts exact YourUpload embed URLs', async () => {
  assert.equal(valid('https://www.yourupload.com/embed/8mhcs57QhUDb'), true);
  for (const url of ['http://www.yourupload.com/embed/test', 'https://www.yourupload.com.evil.test/embed/test', 'https://www.yourupload.com/embed/../admin', 'https://example.com', null]) {
    assert.equal(valid(url), false);
  }
  await new Promise(ok => probe('https://example.com', error => { assert.match(error.message, /YourUpload/); ok(); }));
});
