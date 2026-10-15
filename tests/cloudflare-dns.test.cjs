const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { create } = require('../service/cloudflare-dns');
const resolve = resolver => new Promise((ok, fail) => resolver.resolve('tioanime.com', (e, ip) => e ? fail(e) : ok(ip)));
function transport(replies, calls) {
  return (options, callback) => {
    calls.push(options);
    const request = new EventEmitter(); request.destroy = () => {};
    process.nextTick(() => {
      const reply = replies.shift();
      if (reply instanceof Error) { request.emit('error', reply); return; }
      const response = new EventEmitter(); response.statusCode = 200; response.resume = () => {};
      callback(response);
      response.emit('data', Buffer.from(JSON.stringify(reply)));
      response.emit('end');
    });
    return request;
  };
}
const answer = { Status: 0, Answer: [{ type: 1, TTL: 60, data: '104.21.1.2' }] };
test('Cloudflare bootstraps with a fixed IP, keeps TLS identity and caches by TTL', async () => {
  const calls = []; let time = 0;
  const resolver = create(transport([answer, answer], calls), () => time);
  assert.equal(await resolve(resolver), '104.21.1.2');
  assert.equal(await resolve(resolver), '104.21.1.2');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].hostname, 'cloudflare-dns.com');
  assert.equal(calls[0].servername, 'cloudflare-dns.com');
  assert.notEqual(calls[0].rejectUnauthorized, false);
  calls[0].lookup('cloudflare-dns.com', {}, (e, ip) => assert.equal(ip, '1.1.1.1'));
  time = 61000;
  await resolve(resolver);
  assert.equal(calls.length, 2);
});
test('resolver retries the secondary Cloudflare IP and coalesces concurrent requests', async () => {
  const calls = [];
  const resolver = create(transport([new Error('Unreachable'), answer], calls));
  const values = await Promise.all([resolve(resolver), resolve(resolver)]);
  assert.deepEqual(values, ['104.21.1.2', '104.21.1.2']);
  assert.equal(calls.length, 2);
  calls[1].lookup('cloudflare-dns.com', {}, (e, ip) => assert.equal(ip, '1.0.0.1'));
});
test('invalid DNS answers fail without falling back to system DNS', async () => {
  const calls = [];
  const resolver = create(transport([{ Status: 3 }, { Status: 0, Answer: [{ type: 1, data: 'invalid' }] }], calls));
  await assert.rejects(resolve(resolver), /IPv4/);
  assert.equal(calls.length, 2);
  await new Promise(ok => resolver.resolve('unrelated.test', e => { assert.match(e.message, /no permitido/); ok(); }));
  assert.equal(calls.length, 2);
});
