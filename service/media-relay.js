'use strict';
var http = require('http'), https = require('https'), crypto = require('crypto');
var validMedia = require('./media-url');
var server, port, pending = [], streams = {};
function serve(req, res) {
  var match = (req.url || '').match(/^\/media\/([a-f0-9]{48})$/);
  var stream = match && streams[match[1]];
  if (!stream || stream.expires < Date.now()) { res.writeHead(404); res.end(); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  stream.expires = Date.now() + 30 * 60 * 1000;
  var headers = { Referer: stream.referer, Accept: 'video/mp4', 'User-Agent': 'Mozilla/5.0' };
  if (req.headers.range) {
    if (!/^bytes=\d*-\d*$/.test(req.headers.range)) { res.writeHead(416); res.end(); return; }
    headers.Range = req.headers.range;
  }
  var upstream;
  function fail() { if (!res.headersSent) { res.writeHead(502); res.end(); } else res.destroy(); }
  function connect(url, redirects) {
    if (!validMedia(url)) { fail(); return; }
    var parts = url.match(/^https:\/\/([^/:]+)(?::(\d+))?(\/.*)$/);
    try {
    upstream = https.request({ hostname: parts[1], servername: parts[1], port: parts[2] || 443, path: parts[3], method: req.method, headers: headers, family: 4, lookup: require('./cloudflare-dns').lookup }, function (response) {
      if ([301, 302, 303, 307, 308].indexOf(response.statusCode) !== -1 && redirects < 3 && validMedia(response.headers.location)) {
        var next = response.headers.location;
        response.destroy(); connect(next, redirects + 1); return;
      }
      if ([200, 206, 416].indexOf(response.statusCode) === -1) { response.destroy(); fail(); return; }
      var output = { 'Content-Type': 'video/mp4', 'Cache-Control': 'no-store' };
      ['content-length', 'content-range', 'accept-ranges'].forEach(function (name) { if (response.headers[name]) output[name] = response.headers[name]; });
      res.writeHead(response.statusCode, output);
      response.on('error', fail);
      response.on('aborted', fail);
      response.pipe(res);
    });
    upstream.setTimeout(15000, function () { upstream.destroy(); fail(); });
    upstream.on('error', fail);
    upstream.end();
    } catch (error) { fail(); }
  }
  res.on('close', function () { if (upstream) upstream.destroy(); });
  connect(stream.url, 0);
}
function issue(url, referer, callback) {
  if (!validMedia(url) || !/^https:\/\/www\.yourupload\.com\/embed\/[a-zA-Z0-9]+$/.test(referer)) { callback(new Error('Fuente de video no permitida')); return; }
  function ready(error) {
    if (error) { callback(error); return; }
    Object.keys(streams).forEach(function (key) { if (streams[key].expires < Date.now()) delete streams[key]; });
    var keys = Object.keys(streams);
    if (keys.length >= 8) delete streams[keys[0]];
    var token = crypto.randomBytes(24).toString('hex');
    streams[token] = { url: url, referer: referer, expires: Date.now() + 30 * 60 * 1000 };
    callback(null, 'http://127.0.0.1:' + port + '/media/' + token);
  }
  if (port) { ready(); return; }
  pending.push(ready);
  if (server) return;
  server = http.createServer(serve);
  server.on('error', function (error) { var callbacks = pending; pending = []; server = null; port = null; callbacks.forEach(function (cb) { cb(error); }); });
  server.listen(0, '127.0.0.1', function () {
    port = server.address().port;
    var callbacks = pending; pending = []; callbacks.forEach(function (cb) { cb(); });
  });
}
exports.issue = issue;
exports.close = function (callback) {
  streams = {};
  var active = server; server = null; port = null;
  if (active) active.close(callback); else if (callback) callback();
};
