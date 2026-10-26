'use strict';
var http = require('http'), https = require('https'), crypto = require('crypto'), resolveURL = require('url').resolve;
var network = require('./network');
var server, port, queue = [], entries = {};
function allowed(url) {
  return typeof url === 'string' && /^https:\/\/(?:hianime\.at|cdn\.anipixcdn\.co|cdn\.myanimelist\.net|hls\.dramahot\.top|hls[0-9]+\.drama1\.cfd|cdn\.jkdesa\.com|[a-z0-9-]+\.playmudos\.com|cdn[0-9]+\.ducvomes\.com|[a-z0-9-]+\.cloudwindow-route\.com|[a-z0-9-]+\.okcdn\.ru)\/[^\s<>"'\\#]*$/i.test(url);
}
function child(entry, url) {
  if (!allowed(url)) throw new Error('Recurso fuera de la fuente permitida');
  if (entry.urls.length >= 5000) throw new Error('Demasiados recursos');
  var index = entry.urls.indexOf(url);
  if (index < 0) { index = entry.urls.length; entry.urls.push(url); }
  return 'http://127.0.0.1:' + port + '/resource/' + entry.token + '/' + index;
}
function playlist(text, base, register) {
  return text.split(/\r?\n/).map(function (line) {
    if (!line.trim()) return line;
    if (line.charAt(0) !== '#') return register(resolveURL(base, line.trim()));
    return line.replace(/URI="([^"]+)"/g, function (all, value) { return 'URI="' + register(resolveURL(base, value)) + '"'; });
  }).join('\n');
}
function serve(req, res) {
  var match = (req.url || '').match(/^\/resource\/([a-f0-9]{48})\/(\d+)$/);
  var entry = match && entries[match[1]], url = entry && entry.urls[Number(match[2])];
  if (!entry || !url || entry.expires < Date.now()) { res.writeHead(404); res.end(); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  entry.expires = Date.now() + 30 * 60 * 1000;
  var upstream;
  function fail(error) { if (!res.headersSent) { res.writeHead(502); res.end('No se pudo cargar el recurso'); } else res.destroy(); }
  function connect(target, redirects) {
    if (!allowed(target)) { fail(); return; }
    var options = network.parts(target); options.method = req.method;
    options.headers = { Accept: '*/*', 'Accept-Encoding': 'identity', Referer: entry.referer || 'https://jkanime.net/' };
    if (req.headers.range && /^bytes=\d*-\d*$/.test(req.headers.range)) options.headers.Range = req.headers.range;
    try {
      upstream = https.request(options, function (response) {
        if ([301, 302, 303, 307, 308].indexOf(response.statusCode) >= 0 && response.headers.location && redirects < 3) { var next = resolveURL(target, response.headers.location); response.destroy(); connect(next, redirects + 1); return; }
        if ([200, 206, 416].indexOf(response.statusCode) < 0) { response.destroy(); fail(); return; }
        var type = response.headers['content-type'] || 'application/octet-stream';
        if (/\.ts\.jpg(?:\?|$)/i.test(target) && /\.drama1\.cfd\//i.test(target)) type = 'video/mp2t';
        if (/\.vtt(?:\?|$)/i.test(target)) type = 'text/vtt; charset=utf-8';
        var isList = /\.m3u8(?:\?|$)/i.test(target) || /mpegurl/i.test(type);
        if (isList && req.method !== 'HEAD') {
          var chunks = [], size = 0;
          response.on('data', function (data) { size += data.length; if (size > 1024 * 1024) { response.destroy(); fail(); return; } chunks.push(data); });
          response.on('end', function () {
            try {
              var content = playlist(Buffer.concat(chunks).toString('utf8'), target, function (value) { return child(entry, value); });
              res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(content);
            } catch (e) { fail(e); }
          });
        } else {
          var headers = { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
          ['content-length', 'content-range', 'accept-ranges'].forEach(function (key) { if (response.headers[key]) headers[key] = response.headers[key]; });
          res.writeHead(response.statusCode, headers); response.pipe(res);
        }
        response.on('error', fail); response.on('aborted', fail);
      });
      upstream.on('error', fail); upstream.setTimeout(20000, function () { upstream.destroy(); fail(); }); upstream.end();
    } catch (e) { fail(e); }
  }
  res.on('close', function () { if (upstream) upstream.destroy(); }); connect(url, 0);
}
function issue(url, referer, callback) {
  if (!allowed(url)) { callback(new Error('Recurso no permitido')); return; }
  function ready(error) {
    if (error) { callback(error); return; }
    Object.keys(entries).forEach(function (key) { if (entries[key].expires < Date.now()) delete entries[key]; });
    var keys = Object.keys(entries); if (keys.length >= 256) delete entries[keys[0]];
    var token = crypto.randomBytes(24).toString('hex');
    var entry = entries[token] = { token: token, urls: [], referer: referer, expires: Date.now() + 30 * 60 * 1000 };
    callback(null, child(entry, url));
  }
  if (port) { ready(); return; }
  queue.push(ready); if (server) return;
  server = http.createServer(serve);
  server.on('error', function (error) { var pending = queue; queue = []; server = null; port = null; pending.forEach(function (cb) { cb(error); }); });
  server.listen(0, '127.0.0.1', function () { port = server.address().port; var pending = queue; queue = []; pending.forEach(function (cb) { cb(); }); });
}
exports.issue = issue; exports.allowed = allowed; exports.playlist = playlist;
exports.close = function (callback) { entries = {}; var active = server; server = null; port = null; if (active) active.close(callback); else if (callback) callback(); };
