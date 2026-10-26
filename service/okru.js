'use strict';
var https = require('./network');
function valid(url) { return typeof url === 'string' && /^https:\/\/ok\.ru\/videoembed\/\d+$/.test(url); }
function validSource(url) { return typeof url === 'string' && /^https:\/\/[a-z0-9-]+\.okcdn\.ru\/\?[^\s<>"'\\#]+$/i.test(url); }
function entities(value) {
  return value.replace(/&(?:quot|amp|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, function (entity) {
    var named = { '&quot;': '"', '&amp;': '&', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    return String.fromCharCode(parseInt(entity.slice(2, -1).replace(/^x/i, ''), /^&#x/i.test(entity) ? 16 : 10));
  });
}
function extract(html) {
  var blocked = html.match(/OK\.VideoPlayer\s*&&\s*OK\.VideoPlayer\.yandexError\(['"]([^'"]+)['"]\)/);
  if (blocked) return { unavailable: true, message: 'Okru no permite reproducir este video (' + blocked[1] + '). Elige otro servidor.' };
  var pattern = /\bdata-options\s*=\s*(["'])([\s\S]*?)\1/g, match;
  while ((match = pattern.exec(html))) {
    try {
      var options = JSON.parse(entities(match[2]));
      var metadata = options.flashvars && options.flashvars.metadata;
      if (typeof metadata === 'string') metadata = JSON.parse(metadata);
      if (!metadata || !Array.isArray(metadata.videos)) continue;
      var names = ['hd', 'sd', 'low', 'lowest', 'mobile', 'full'];
      var videos = metadata.videos.filter(function (video) { return !video.disallowed && validSource(video.url); });
      function rank(video) { var index = names.indexOf(video.name); return index < 0 ? 99 : index; }
      videos.sort(function (a, b) { return rank(a) - rank(b); });
      if (videos.length) return { unavailable: false, mediaUrl: videos[0].url, mediaType: 'video/mp4', quality: videos[0].name, provider: 'Okru' };
    } catch (e) {}
  }
  return { unavailable: false, mediaUrl: '' };
}
function probe(url, callback) {
  if (!valid(url)) { callback(new Error('Enlace Okru no permitido')); return; }
  var request, finished = false;
  var timer = setTimeout(function () { done(new Error('Okru no respondió')); if (request) request.destroy(); }, 7500);
  function done(error, result) { if (!finished) { finished = true; clearTimeout(timer); callback(error, result); } }
  try {
    request = https.get(url, function (response) {
      if (response.statusCode !== 200) { done(null, { statusCode: response.statusCode, unavailable: response.statusCode === 404 || response.statusCode === 410 }); response.destroy(); return; }
      var chunks = [], size = 0;
      response.on('data', function (chunk) { size += chunk.length; if (size > 1024 * 1024) { done(new Error('Respuesta Okru demasiado grande')); response.destroy(); return; } chunks.push(chunk); });
      response.on('end', function () { var result = extract(Buffer.concat(chunks).toString('utf8')); result.statusCode = 200; done(null, result); });
      response.on('error', done);
      response.on('aborted', function () { done(new Error('Respuesta Okru interrumpida')); });
    });
    request.on('error', done);
  } catch (e) { done(e); }
}
exports.valid = valid;
exports.validSource = validSource;
exports.extract = extract;
exports.probe = probe;
