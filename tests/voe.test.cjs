const { test } = require('node:test');
const assert = require('node:assert/strict');
const voe = require('../service/voe');
const network = require('../service/network');
const { PassThrough } = require('node:stream');
const { EventEmitter } = require('node:events');
function page(data) {
  let value = Buffer.from(JSON.stringify(data)).toString('base64').split('').reverse().map(c => String.fromCharCode(c.charCodeAt(0) + 3)).join('');
  value = Buffer.from(value).toString('base64').replace(/[a-zA-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() <= 'm' ? 13 : -13)));
  value = value.replace(/(.{4})/g, '$1!!');
  return '<script type="application/json">' + JSON.stringify([value]) + '</script>';
}
test('VOE decodes only the declared HLS source, never executable scripts or download URLs', () => {
  const hls = 'https://ugc-cdn-test.cloudwindow-route.com/engine/master.m3u8?t=sample';
  assert.equal(voe.source(page({ source: hls, direct_access_allowed: false, direct_access_url: 'https://external.test/download.mp4' })), hls);
  assert.equal(voe.source(page({ source: 'https://evil.test/master.m3u8' })), '');
  assert.equal(voe.source('<script type="application/json">[alert(1)]</script>'), '');
  assert.equal(voe.source('<script>var source="https://sample.test/demo.mp4";</script>'), '');
  assert.equal(voe.valid('https://voe.sx/e/test123'), true);
  assert.equal(voe.valid('https://voe.sx.evil.test/e/test123'), false);
});

test('VOE follows the current verified mirror only for the same video ID', async t => {
  const original = network.get, calls = [];
  const hls = 'https://ugc-cdn-test.cloudwindow-route.com/video/master.m3u8';
  let redirect = 'https://ashleyhardat.com/e/test123';
  network.get = (url, callback) => {
    calls.push(url);
    const request = new EventEmitter(); request.destroy = () => {};
    process.nextTick(() => {
      const response = new PassThrough(); response.statusCode = 200;
      callback(response);
      response.end(url.startsWith('https://voe.sx/') ? 'window.location.href = "' + redirect + '";' : page({ source: hls }));
    });
    return request;
  };
  t.after(() => { network.get = original; });
  const probe = () => new Promise((ok, fail) => voe.probe('https://voe.sx/e/test123', (e, r) => e ? fail(e) : ok(r)));
  assert.equal((await probe()).mediaUrl, hls);
  assert.deepEqual(calls, ['https://voe.sx/e/test123', redirect]);
  for (const rejected of ['https://ashleyhardat.com/e/other123', 'https://ashleyhardat.com.evil.test/e/test123', 'https://unrelated.test/e/test123']) {
    calls.length = 0; redirect = rejected;
    assert.equal((await probe()).mediaUrl, '');
    assert.equal(calls.length, 1);
  }
});
