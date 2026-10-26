(function (root) {
  'use strict';
  function time(value) {
    var parts = value.replace(',', '.').split(':'), total = 0;
    if (parts.length < 2 || parts.length > 3) return NaN;
    parts.forEach(function (part) { total = total * 60 + Number(part); }); return total;
  }
  function parse(value) {
    if (!/^\uFEFF?WEBVTT/.test(value) || value.length > 2 * 1024 * 1024) return [];
    var cues = [];
    value.replace(/\r/g, '').split(/\n\s*\n/).forEach(function (block) {
      var lines = block.split('\n'), at = lines[0].indexOf('-->') >= 0 ? 0 : 1;
      var match = (lines[at] || '').match(/^(\S+)\s+-->\s+(\S+)/);
      if (!match) return;
      var start = time(match[1]), end = time(match[2]);
      var text = lines.slice(at + 1).join('\n').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
      if (isFinite(start) && end > start && text) cues.push({ start: start, end: end, text: text });
    });
    return cues.sort(function (a, b) { return a.start - b.start; });
  }
  root.TioSubtitles = { parse: parse };
  if (!root.document) return;
  var document = root.document, tracks = [], chosen = -1, cues = [], serial = 0, xhr;
  var video = document.getElementById('native-video'), caption = document.getElementById('video-captions'), button = document.getElementById('video-subtitles');
  function label(value) {
    button.textContent = '';
    var image = document.createElement('img'); image.src = 'icons/subtitles.svg'; image.className = 'icon'; image.alt = ''; image.setAttribute('aria-hidden', 'true');
    button.appendChild(image); button.appendChild(document.createTextNode(value));
  }
  function draw() {
    var now = video.currentTime || 0, lines = [];
    // Binary search followed by a small backwards scan supports overlapping captions.
    var low = 0, high = cues.length;
    while (low < high) { var mid = (low + high) >> 1; if (cues[mid].start <= now) low = mid + 1; else high = mid; }
    for (var i = Math.max(0, low - 20); i < low; i++) if (now < cues[i].end) lines.push(cues[i].text);
    caption.textContent = lines.join('\n'); caption.hidden = !lines.length;
  }
  function choose(index) {
    var token = ++serial; if (xhr) xhr.abort(); xhr = null;
    chosen = index; cues = []; draw();
    label(index < 0 ? 'Subs: desactivados' : 'Subs: ' + tracks[index].label);
    if (index < 0) return;
    var request = xhr = new XMLHttpRequest(); request.open('GET', tracks[index].url); request.timeout = 15000;
    function fail() { if (token === serial) label('Subs: error · cambiar'); }
    request.onload = function () {
      if (token !== serial) return;
      if (request.status !== 200) { fail(); return; }
      cues = parse(request.responseText); if (!cues.length) fail(); draw();
    };
    request.onerror = fail; request.ontimeout = fail; request.send();
  }
  button.onclick = function () { choose(chosen + 1 >= tracks.length ? -1 : chosen + 1); };
  video.addEventListener('timeupdate', draw); video.addEventListener('seeked', draw);
  root.TioSubtitles.clear = function () { choose(-1); tracks = []; button.hidden = true; };
  root.TioSubtitles.set = function (list) {
    root.TioSubtitles.clear();
    tracks = list.filter(function (track) { return track && typeof track.label === 'string' && /^http:\/\/127\.0\.0\.1:\d{1,5}\/resource\/[a-f0-9]{48}\/\d+$/.test(track.url); });
    if (!tracks.length) return;
    button.hidden = false;
    var best = 0;
    tracks.some(function (track, index) { if (/spanish|espa[nñ]ol/i.test(track.label)) { best = index; return true; } if (track.default) best = index; return false; });
    choose(best);
  };
}(typeof module !== 'undefined' ? module.exports : window));
