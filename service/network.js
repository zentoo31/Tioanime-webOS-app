'use strict';
var https = require('https'), zlib = require('zlib'), dns = require('./cloudflare-dns');
function parts(url) {
  var match = typeof url === 'string' && url.match(/^https:\/\/([a-z0-9.-]+)(?::(\d+))?(\/[^\s#]*)$/i);
  if (!match || !dns.allowed(match[1]) || (match[2] && Number(match[2]) > 65535)) throw new Error('Destino de red no permitido');
  return { hostname: match[1], servername: match[1], port: match[2] || 443, path: match[3], family: 4, agent: false, lookup: dns.lookup };
}
function get(url, callback) { return https.get(parts(url), callback); }
var jars = {};
function read(url, options, callback, redirects) {
  options = options || {}; redirects = redirects || 0;
  var request, settings;
  try { settings = parts(url); } catch (e) { callback(e); return; }
  settings.method = options.method || 'GET';
  settings.headers = { 'User-Agent': 'TioAnimeTV/0.3', Accept: '*/*', 'Accept-Encoding': 'identity' };
  Object.keys(options.headers || {}).forEach(function (key) { settings.headers[key] = options.headers[key]; });
  if (options.session && jars[settings.hostname]) settings.headers.Cookie = Object.keys(jars[settings.hostname]).map(function (name) { return name + '=' + jars[settings.hostname][name]; }).join('; ');
  if (options.body) settings.headers['Content-Length'] = Buffer.byteLength(options.body);
  var finished = false;
  var timer = setTimeout(function () { done(new Error('Tiempo de red agotado')); if (request) request.destroy(); }, 18000);
  function done(error, result) { if (!finished) { finished = true; clearTimeout(timer); callback(error, result); } }
  try {
    request = https.request(settings, function (response) {
      if (options.session && response.headers['set-cookie']) {
        var jar = jars[settings.hostname] || (jars[settings.hostname] = {});
        response.headers['set-cookie'].forEach(function (cookie) { var pair = cookie.split(';')[0], pos = pair.indexOf('='); if (pos > 0) jar[pair.slice(0, pos)] = pair.slice(pos + 1); });
      }
      if ([301, 302, 303, 307, 308].indexOf(response.statusCode) >= 0 && response.headers.location && redirects < 3) {
        var next = require('url').resolve(url, response.headers.location);
        response.resume(); finished = true; clearTimeout(timer); read(next, { session: options.session }, callback, redirects + 1); return;
      }
      var chunks = [], size = 0;
      response.on('data', function (chunk) { size += chunk.length; if (size > (options.limit || 3 * 1024 * 1024)) { done(new Error('Respuesta demasiado grande')); response.destroy(); return; } chunks.push(chunk); });
      response.on('end', function () {
        var body = Buffer.concat(chunks), encoding = response.headers['content-encoding'];
        function complete(error, data) { if (error) done(error); else if (data.length > (options.limit || 3 * 1024 * 1024)) done(new Error('Respuesta demasiado grande')); else done(null, { status: response.statusCode, headers: response.headers, body: data, text: data.toString('utf8'), url: url }); }
        if (encoding === 'gzip') zlib.gunzip(body, complete); else if (encoding === 'deflate') zlib.inflate(body, complete); else complete(null, body);
      });
      response.on('error', done); response.on('aborted', function () { done(new Error('Respuesta interrumpida')); });
    });
    request.on('error', done); request.end(options.body);
  } catch (e) { done(e); }
}
exports.parts = parts; exports.get = get; exports.read = read;
