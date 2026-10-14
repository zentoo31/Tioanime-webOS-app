'use strict';
var https = require('https');
function validPath(path) {
  return typeof path === 'string' && path.length < 600 && /^[\x21-\x7e]+$/.test(path) &&
    /^(\/|\/directorio(?:\?(?:q=[^&#]*|p=\d+)(?:&(?:q=[^&#]*|p=\d+))?)?|\/(?:anime|ver)\/[a-z0-9-]+)$/.test(path);
}
function load(path, callback) {
  if (!validPath(path)) { callback(new Error('Ruta no permitida')); return; }
  var finished = false;
  function done(error, html) { if (!finished) { finished = true; callback(error, html); } }
  var request = https.get({ hostname: 'tioanime.com', path: path, headers: { 'User-Agent': 'TioAnimeTV/0.2', Accept: 'text/html' } }, function (response) {
    if (response.statusCode !== 200) { response.resume(); done(new Error('TioAnime respondió HTTP ' + response.statusCode)); return; }
    var chunks = [], size = 0;
    response.on('data', function (chunk) {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) { request.destroy(); done(new Error('Respuesta demasiado grande')); return; }
      chunks.push(chunk);
    });
    response.on('end', function () { done(null, Buffer.concat(chunks).toString('utf8')); });
    response.on('error', done);
  });
  request.setTimeout(18000, function () { request.destroy(); done(new Error('Tiempo de conexión agotado')); });
  request.on('error', done);
}
exports.load = load;
exports.validPath = validPath;
