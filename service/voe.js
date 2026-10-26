'use strict';
var https = require('./network');
function valid(url) { return /^https:\/\/voe\.sx\/e\/[a-z0-9]+$/.test(url || ''); }
function validSource(url) { return typeof url === 'string' && /^https:\/\/[a-z0-9-]+\.cloudwindow-route\.com\/[^\s<>"'\\#]*\.m3u8(?:\?[^\s<>"'\\#]*)?$/i.test(url); }
function source(html) {
  var match = html.match(/<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match || match[1].length > 512 * 1024) return '';
  try {
    var value = JSON.parse(match[1])[0];
    if (typeof value !== 'string') return '';
    // Decodificación de datos; nunca se evalúan los scripts del proveedor.
    value = value.replace(/[a-zA-Z]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() <= 'm' ? 13 : -13)); });
    value = value.replace(/@\$|\^\^|~@|%\?|!!|#&|\*~/g, '');
    value = Buffer.from(value, 'base64').toString('utf8').split('').map(function (c) { return String.fromCharCode(c.charCodeAt(0) - 3); }).reverse().join('');
    var data = JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
    return validSource(data.source) ? data.source : '';
  } catch (e) { return ''; }
}
function probe(url, callback) {
  if (!valid(url)) { callback(new Error('Enlace VOE no permitido')); return; }
  var finished = false, request;
  var timer = setTimeout(function () { done(new Error('No se pudo consultar VOE')); if (request) request.destroy(); }, 7500);
  function done(error, result) { if (finished) return; finished = true; clearTimeout(timer); callback(error, result); }
  function read(target, mirror) {
    try {
      request = https.get(target, function (response) {
        if (response.statusCode !== 200) { response.destroy(); done(null, { statusCode: response.statusCode, unavailable: response.statusCode === 404 || response.statusCode === 410 }); return; }
        var chunks = [], size = 0;
        response.on('data', function (chunk) { size += chunk.length; if (size > 1024 * 1024) { response.destroy(); done(new Error('Respuesta VOE demasiado grande')); return; } chunks.push(chunk); });
        response.on('error', done);
        response.on('aborted', function () { done(new Error('Respuesta VOE interrumpida')); });
        response.on('end', function () {
          if (finished) return;
          var html = Buffer.concat(chunks).toString('utf8');
          var redirect = html.match(/window\.location\.href\s*=\s*['"](https:\/\/(?:megankiddifference\.com|ashleyhardat\.com)\/e\/[a-z0-9]+)['"]/);
          if (!mirror && redirect && redirect[1].split('/').pop() === url.split('/').pop()) { read(redirect[1], true); return; }
          done(null, { statusCode: 200, unavailable: false, mediaUrl: source(html), mediaType: 'application/vnd.apple.mpegurl', provider: 'VOE' });
        });
      });
      request.on('error', done);
    } catch (e) { done(e); }
  }
  read(url, false);
}
exports.valid = valid;
exports.validSource = validSource;
exports.source = source;
exports.probe = probe;
