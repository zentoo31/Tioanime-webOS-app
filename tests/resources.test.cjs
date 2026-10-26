const { test } = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const relay = require('../service/resources');
const dns = require('../service/cloudflare-dns');

test('HLS relay rewrites playlists and keys, forwards ranges and blocks unapproved destinations', async t => {
  const original = https.request, calls = [];
  let unsafe = false;
  https.request = (options, callback) => {
    calls.push(options);
    const request = new EventEmitter();
    request.destroy = () => {}; request.setTimeout = () => {};
    request.end = () => process.nextTick(() => {
      const response = new PassThrough();
      if (options.path === '/show/master.m3u8') {
        response.statusCode = 200;
        response.headers = { 'content-type': 'application/vnd.apple.mpegurl' };
        callback(response);
        response.end('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n' + (unsafe ? 'https://evil.test/segment.ts' : 'https://cdn1.ducvomes.com/video/segment.ts'));
      } else {
        response.statusCode = 206;
        response.headers = { 'content-type': 'video/mp2t', 'content-range': 'bytes 0-3/100', 'content-length': '4' };
        callback(response); response.end('test');
      }
    });
    return request;
  };
  t.after(async () => { https.request = original; await new Promise(ok => relay.close(ok)); });
  const local = await new Promise((ok, fail) => relay.issue('https://nika.playmudos.com/show/master.m3u8', 'https://jkanime.net/', (e, url) => e ? fail(e) : ok(url)));
  const response = await fetch(local), body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.match(body, /URI="http:\/\/127\.0\.0\.1:\d+\/resource\/[a-f0-9]{48}\/1"/);
  const segment = await fetch(body.split('\n').pop(), { headers: { Range: 'bytes=0-3' } });
  assert.equal(segment.status, 206); assert.equal(await segment.text(), 'test');
  assert.equal(calls[1].hostname, 'cdn1.ducvomes.com');
  assert.equal(calls[1].lookup, dns.lookup);
  assert.equal(calls[1].headers.Range, 'bytes=0-3');
  assert.equal(calls[1].headers.Referer, 'https://jkanime.net/');
  assert.equal((await fetch(local.replace(/resource\/.*$/, 'resource/invalid/0'))).status, 404);
  unsafe = true;
  const blocked = await fetch(local); assert.equal(blocked.status, 502); await blocked.text();
  assert.equal(calls.some(call => call.hostname === 'evil.test'), false);
  assert.equal(relay.allowed('https://cdn1.ducvomes.com.evil.test/a.ts'), false);
});
