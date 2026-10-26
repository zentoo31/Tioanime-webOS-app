'use strict';
var network = require('./network'), resources = require('./resources'), query = require('querystring');
function validPath(path) { return typeof path === 'string' && path.length < 800 && /^\/jk\/(?:search\?(?:q=[^&#\s]*&p=\d+|q=[^&#\s]*|p=\d+&q=[^&#\s]*)|anime\/[a-z0-9-]+(?:\?p=\d+)?|ver\/[a-z0-9-]+\/\d+)$/.test(path); }
function imageURL(url) { return typeof url === 'string' && /^https:\/\/cdn\.jkdesa\.com\/assets\/images\/animes\/image\/[a-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(url); }
function assets(urls, callback) {
  if (urls.some(function (url) { return require('./hianime').imageURL(url); })) {
    var jk = urls.filter(imageURL), hi = urls.filter(require('./hianime').imageURL);
    require('./hianime').assets(hi, function (error, map) {
      if (error) { callback(error); return; }
      assets(jk, function (e, other) { Object.keys(other || {}).forEach(function (key) { map[key] = other[key]; }); callback(e, map); });
    }); return;
  }
  var unique = urls.filter(function (url, index) { return imageURL(url) && urls.indexOf(url) === index; }).slice(0, 80);
  var map = {}, pending = unique.length;
  if (!pending) { callback(null, map); return; }
  unique.forEach(function (url) { resources.issue(url, 'https://jkanime.net/', function (error, local) { if (!error) map[url] = local; if (--pending === 0) callback(null, map); }); });
}
function load(path, callback) {
  if (!validPath(path)) { callback(new Error('Ruta JKAnime no permitida')); return; }
  var slug, page = 1, remote;
  if (path.indexOf('/jk/search?') === 0) {
    var params = query.parse(path.split('?')[1]);
    if (typeof params.q !== 'string' || !params.q.trim() || params.q.length > 100) { callback(new Error('Escribe un nombre de anime')); return; }
    page = Number(params.p) || 1;
    remote = 'https://jkanime.net/buscar/' + encodeURIComponent(params.q.trim()) + (page > 1 ? '/' + page : '');
  } else if (path.indexOf('/jk/anime/') === 0) {
    slug = path.split('/')[3].split('?')[0]; page = Number(query.parse(path.split('?')[1] || '').p) || 1;
    remote = 'https://jkanime.net/' + slug + '/';
  } else { remote = 'https://jkanime.net/' + path.slice('/jk/ver/'.length) + '/'; }
  network.read(remote, { session: true }, function (error, response) {
    if (error) { callback(error); return; }
    if (response.status !== 200) { callback(new Error('JKAnime respondió HTTP ' + response.status)); return; }
    var payload = { source: 'jkanime', html: response.text, page: page, episodes: null, assets: {} };
    function finish() {
      var images = response.text.match(/https:\/\/cdn\.jkdesa\.com\/assets\/images\/animes\/image\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp)/g) || [];
      assets(images, function (e, map) { payload.assets = map; callback(e, payload); });
    }
    if (!slug) { finish(); return; }
    var id = response.text.match(/https:\/\/jkanime\.net\/ajax\/episodes\/(\d+)\//);
    var token = response.text.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
    if (!id || !token) { callback(new Error('No se encontró la lista de episodios de JKAnime')); return; }
    network.read('https://jkanime.net/ajax/episodes/' + id[1] + '/' + page, {
      session: true, method: 'POST', body: '_token=' + encodeURIComponent(token[1]),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Referer: remote }
    }, function (e, api) {
      if (e) { callback(e); return; }
      try { if (api.status !== 200) throw new Error('Episodios JKAnime HTTP ' + api.status); payload.episodes = JSON.parse(api.text); if (!Array.isArray(payload.episodes.data)) throw new Error('Lista de episodios no válida'); finish(); } catch (err) { callback(err); }
    });
  });
}
function playerURL(url) { return typeof url === 'string' && url.length < 4096 && /^https:\/\/jkanime\.net\/jkplayer\/(?:um|umv|jk)\?[^\s<>"'\\#]+$/.test(url); }
function probe(url, callback) {
  if (!playerURL(url)) { callback(new Error('Reproductor JKAnime no permitido')); return; }
  network.read(url, { session: true }, function (error, response) {
    if (error) { callback(error); return; }
    var source = response.text.match(/https:\/\/[a-z0-9-]+\.playmudos\.com\/[^\s<>"'\\#]+\.m3u8(?:\?[^\s<>"'\\#]*)?/i);
    var result = { provider: 'JKAnime', statusCode: response.status, unavailable: response.status === 404 || response.status === 410, mediaType: 'application/vnd.apple.mpegurl' };
    if (response.status !== 200 || !source) { callback(null, result); return; }
    resources.issue(source[0].replace(/&amp;/g, '&'), url, function (e, local) { if (e) callback(e); else { result.streamUrl = local; callback(null, result); } });
  });
}
exports.load = load; exports.validPath = validPath; exports.assets = assets; exports.playerURL = playerURL; exports.probe = probe;
