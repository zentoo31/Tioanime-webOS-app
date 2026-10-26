'use strict';
var https = require('./network');
var validMedia = require('./media-url');
var relay = require('./media-relay');
var resources = require('./resources');
var voe = require('./voe');
var okru = require('./okru');
function mediaURL(html) {
  var tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (var i = 0; i < tags.length; i++) {
    if (!/\bproperty\s*=\s*["']og:video["']/i.test(tags[i])) continue;
    var match = tags[i].match(/\bcontent\s*=\s*["']([^"']+)["']/i);
    if (!match) continue;
    var value = match[1].replace(/&amp;/g, '&');
    if (validMedia(value)) return value;
  }
  return '';
}
function valid(url) { return typeof url === 'string' && /^https:\/\/www\.yourupload\.com\/embed\/[a-zA-Z0-9]+$/.test(url); }
function probe(url, callback) {
  if (require('./hianime').playerURL(url)) { require('./hianime').probe(url, callback); return; }
  if (require('./jkanime').playerURL(url)) { require('./jkanime').probe(url, callback); return; }
  if (voe.valid(url) || okru.valid(url)) {
    (voe.valid(url) ? voe : okru).probe(url, function (error, result) {
      if (error || !result.mediaUrl) { callback(error, result); return; }
      resources.issue(result.mediaUrl, url, function (e, local) { if (!e) result.streamUrl = local; callback(e, result); });
    }); return;
  }
  if (!valid(url)) { callback(new Error('Solo se pueden comprobar enlaces de YourUpload')); return; }
  var request, finished = false;
  var timer = setTimeout(function () { done(new Error('No se pudo comprobar YourUpload')); if (request) request.destroy(); }, 7000);
  function done(error, result) { if (!finished) { finished = true; clearTimeout(timer); callback(error, result); } }
  try {
    request = https.get(url, function (response) {
      var result = { statusCode: response.statusCode, unavailable: response.statusCode === 404 || response.statusCode === 410 };
      if (response.statusCode !== 200) { done(null, result); response.destroy(); return; }
      var chunks = [], size = 0;
      response.on('data', function (chunk) {
        size += chunk.length;
        if (size > 512 * 1024) { done(new Error('Respuesta de YourUpload demasiado grande')); response.destroy(); return; }
        chunks.push(chunk);
      });
      response.on('end', function () {
        result.mediaUrl = mediaURL(Buffer.concat(chunks).toString('utf8'));
        if (!result.mediaUrl) { done(null, result); return; }
        relay.issue(result.mediaUrl, url, function (error, streamUrl) {
          if (error) result.mediaUrl = ''; else result.streamUrl = streamUrl;
          done(null, result);
        });
      });
      response.on('error', done);
      response.on('aborted', function () { done(new Error('Respuesta de YourUpload interrumpida')); });
    });
    request.on('error', function (error) { done(error); });
  } catch (error) { done(error); }
}
exports.probe = probe;
exports.valid = valid;
exports.mediaURL = mediaURL;
