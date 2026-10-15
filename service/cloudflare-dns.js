'use strict';
var https = require('https');
var net = require('net');

function create(get, now) {
  get = get || https.get;
  now = now || Date.now;
  var cached = null, waiting = [];
  function resolve(hostname, callback) {
    if (hostname !== 'tioanime.com') { callback(new Error('Dominio DNS no permitido')); return; }
    if (cached && cached.expires > now()) { callback(null, cached.address); return; }
    waiting.push(callback);
    if (waiting.length > 1) return;
    function finish(error, address, ttl) {
      if (!error) cached = { address: address, expires: now() + Math.max(0, Math.min(ttl, 300)) * 1000 };
      var callbacks = waiting; waiting = [];
      callbacks.forEach(function (cb) { cb(error, address); });
    }
    function attempt(index) {
      var settled = false, request, timer;
      function done(error, address, ttl) {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (error && index === 0) { attempt(1); return; }
        finish(error, address, ttl);
      }
      timer = setTimeout(function () {
        done(new Error('Cloudflare DNS no respondió'));
        if (request) request.destroy();
      }, 3000);
      try {
        request = get({
          hostname: 'cloudflare-dns.com', servername: 'cloudflare-dns.com',
          family: 4, agent: false,
          // Arranque por IP fija: ni siquiera Cloudflare usa el DNS del sistema.
          lookup: function (host, options, cb) { cb(null, index === 0 ? '1.1.1.1' : '1.0.0.1', 4); },
          path: '/dns-query?name=tioanime.com&type=A',
          headers: { Accept: 'application/dns-json' }
        }, function (response) {
          if (response.statusCode !== 200) { response.resume(); done(new Error('Cloudflare DNS HTTP ' + response.statusCode)); return; }
          var size = 0, chunks = [];
          response.on('data', function (chunk) {
            size += chunk.length;
            if (size > 65536) { done(new Error('Respuesta DNS demasiado grande')); request.destroy(); return; }
            chunks.push(chunk);
          });
          response.on('end', function () {
            try {
              var answer = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              if (answer.Status !== 0 || !Array.isArray(answer.Answer)) throw new Error('Cloudflare no pudo resolver TioAnime');
              var records = answer.Answer.filter(function (record) { return record.type === 1 && net.isIP(record.data) === 4; });
              if (!records.length) throw new Error('Cloudflare no devolvió una dirección IPv4');
              var ttl = records.reduce(function (min, record) { return Math.min(min, Number(record.TTL) || 0); }, 300);
              done(null, records[0].data, ttl);
            } catch (error) { done(error); }
          });
          response.on('error', done);
          response.on('aborted', function () { done(new Error('Respuesta DNS interrumpida')); });
        });
        request.on('error', function (error) { done(new Error('No se pudo conectar con Cloudflare DNS: ' + error.message)); });
      } catch (error) { done(error); }
    }
    attempt(0);
  }
  return { resolve: resolve };
}
exports.create = create;
exports.resolve = create().resolve;
