'use strict';
var network = require('./network'), resources = require('./resources'), query = require('querystring');
function validPath(path) { return typeof path === 'string' && path.length < 800 && /^\/hi\/(?:search\?q=[^&#\s]+(?:&p=\d+)?|anime\/[a-z0-9-]+-\d+|ver\/[a-z0-9-]+-\d+\/\d+)$/.test(path); }
function imageURL(url) { return /^https:\/\/(?:hianime\.at\/storage\/media\/|cdn\.anipixcdn\.co\/|cdn\.myanimelist\.net\/)[^\s<>"'\\#]+$/i.test(url || ''); }
function assets(urls, callback) {
  var list = urls.filter(function (url, i) { return imageURL(url) && urls.indexOf(url) === i; }).slice(0, 80), result = {}, pending = list.length;
  if (!pending) { callback(null, result); return; }
  list.forEach(function (url) { resources.issue(url, 'https://hianime.at/', function (e, local) { if (!e) result[url] = local; if (--pending === 0) callback(null, result); }); });
}
function load(path, callback) {
  if (!validPath(path)) { callback(new Error('Ruta HiAnime no permitida')); return; }
  var pieces = path.split('/'), slug = pieces[3], episode = pieces[4], params = query.parse(path.split('?')[1] || '');
  var remote = path.indexOf('/hi/search?') === 0 ? 'https://hianime.at/browse?keyword=' + encodeURIComponent(params.q) + '&page=' + (Number(params.p) || 1) : 'https://hianime.at/' + (episode ? 'watch/' : '') + slug + (episode ? '?ep=' + episode : '');
  network.read(remote, {}, function (error, response) {
    if (error) { callback(error); return; }
    if (response.status !== 200) { callback(new Error('HiAnime HTTP ' + response.status)); return; }
    var data = { source: 'hianime', html: response.text, episodes: '', servers: '', page: Number(params.p) || 1, assets: {} };
    function finish() {
      var images = response.text.match(/https:\/\/(?:hianime\.at\/storage\/media\/|cdn\.anipixcdn\.co\/|cdn\.myanimelist\.net\/)[^\s<>"'\\#]+/g) || [];
      assets(images, function (e, map) { data.assets = map; callback(e, data); });
    }
    if (!slug) { finish(); return; }
    var id = slug.match(/-(\d+)$/)[1];
    network.read('https://hianime.at/api/theme/episode/list/' + id, {}, function (e, r) {
      if (e) { callback(e); return; }
      try { var result = JSON.parse(r.text); if (!result.status || typeof result.html !== 'string') throw new Error('Episodios HiAnime no disponibles'); data.episodes = result.html; } catch (err) { callback(err); return; }
      if (!episode) { finish(); return; }
      network.read('https://hianime.at/api/theme/episode/servers?episodeId=' + episode, {}, function (err, servers) {
        if (err) { callback(err); return; }
        try { var parsed = JSON.parse(servers.text); if (!parsed.status || typeof parsed.html !== 'string') throw new Error('Servidores HiAnime no disponibles'); data.servers = parsed.html; finish(); } catch (ex) { callback(ex); }
      });
    });
  });
}
function playerURL(url) { return /^https:\/\/zokoanime\.video\/stream\/mal\/\d+\/\d+\/(?:sub|dub)$/.test(url || ''); }
function source(html) {
  var match = html.match(/window\.__P\s*=\s*"([A-Za-z0-9+/=]+)"/);
  if (!match || match[1].length > 512 * 1024) return null;
  try {
    var bytes = Buffer.from(match[1], 'base64'), key = 'otaku-embed-v1';
    for (var i = 0; i < bytes.length; i++) bytes[i] ^= key.charCodeAt(i % key.length);
    var data = JSON.parse(bytes.toString('utf8'));
    if (!/^https:\/\/hls\.dramahot\.top\/p\/[^\s<>"'\\#]+\.m3u8(?:\?[^\s<>"'\\#]*)?$/.test(data.src)) return null;
    return { src: data.src, subtitles: (Array.isArray(data.subtitles) ? data.subtitles : []).filter(function (track) { return track && /^https:\/\/hls\.dramahot\.top\/v\/[^\s<>"'\\#]+\.vtt(?:\?[^\s<>"'\\#]*)?$/.test(track.src) && typeof track.label === 'string'; }).slice(0, 30) };
  } catch (e) { return null; }
}
function probe(url, callback) {
  if (!playerURL(url)) { callback(new Error('Reproductor HiAnime no permitido')); return; }
  network.read(url, {}, function (error, response) {
    if (error) { callback(error); return; }
    var data = source(response.text), result = { provider: 'ZokoAnime', statusCode: response.status, unavailable: response.status === 404 || response.status === 410, mediaType: 'application/vnd.apple.mpegurl', subtitles: [] };
    if (response.status !== 200 || !data) { callback(null, result); return; }
    resources.issue(data.src, 'https://zokoanime.video/', function (e, local) {
      if (e) { callback(e); return; } result.streamUrl = local;
      var pending = data.subtitles.length;
      if (!pending) { callback(null, result); return; }
      data.subtitles.forEach(function (track, index) { resources.issue(track.src, 'https://zokoanime.video/', function (err, trackURL) {
        if (!err) result.subtitles[index] = { label: track.label.slice(0, 80), url: trackURL, default: !!track.default };
        if (--pending === 0) { result.subtitles = result.subtitles.filter(Boolean); callback(null, result); }
      }); });
    }, { legacyHLS: true });
  });
}
exports.validPath = validPath; exports.imageURL = imageURL; exports.assets = assets; exports.load = load; exports.playerURL = playerURL; exports.source = source; exports.probe = probe;
