const { test } = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const relay = require('../service/media-relay');
test('local video relay forwards ranges and referrer, restricts redirects and requires a token', async t => {
  const original = https.request;
  const calls = [];
  let unsafeRedirect = false;
  https.request = (options, callback) => {
    calls.push(options);
    const request = new EventEmitter();
    request.destroy = () => {};
    request.setTimeout = () => {};
    request.end = () => process.nextTick(() => {
      const response = new PassThrough();
      if (options.path === '/video.mp4') {
        response.statusCode = 302;
        response.headers = { location: unsafeRedirect ? 'https://evil.test/video.mp4' : 'https://s1.vidcache.net:8166/next/video.mp4' };
        callback(response);
      } else {
        response.statusCode = 206;
        response.headers = { 'content-length': '4', 'content-range': 'bytes 0-3/100', 'accept-ranges': 'bytes' };
        callback(response); response.end(Buffer.from('test'));
      }
    });
    return request;
  };
  t.after(async () => { https.request = original; await new Promise(ok => relay.close(ok)); });
  const local = await new Promise((ok, fail) => relay.issue('https://vidcache.net/video.mp4', 'https://www.yourupload.com/embed/test', (e, url) => e ? fail(e) : ok(url)));
  const response = await fetch(local, { headers: { Range: 'bytes=0-3' } });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-type'), 'video/mp4');
  assert.equal(await response.text(), 'test');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers.Range, 'bytes=0-3');
  assert.equal(calls[1].headers.Referer, 'https://www.yourupload.com/embed/test');
  assert.notEqual(calls[1].rejectUnauthorized, false);
  assert.equal((await fetch(local.replace(/media\/.*$/, 'media/unknown'))).status, 404);
  unsafeRedirect = true;
  const blocked = await fetch(local);
  assert.equal(blocked.status, 502);
  await blocked.text();
  assert.equal(calls.some(call => call.hostname === 'evil.test'), false);
});
