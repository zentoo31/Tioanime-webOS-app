const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs');
const { parseHTML, DOMParser } = require('linkedom');
const { TioCatalog } = require('../app/catalog'), { TioHistory } = require('../app/history');
function setup() {
  const { window, document } = parseHTML(fs.readFileSync('app/index.html', 'utf8'));
  const $ = id => document.getElementById(id), values = {}, pending = [], timers = new Map();
  let focused, timerId = 0, plays = 0, restoredScroll = -1;
  window.HTMLElement.prototype.focus = function () {
    if (focused === this) return;
    const before = focused; focused = this;
    if (before) before.dispatchEvent(new window.Event('blur'));
    this.dispatchEvent(new window.Event('focusin', { bubbles: true }));
  };
  window.HTMLElement.prototype.blur = function () { if (focused === this) { focused = document.body; this.dispatchEvent(new window.Event('blur')); } };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.HTMLElement.prototype.getClientRects = function () { for (let n = this; n; n = n.parentNode) if (n.hidden) return []; return [{}]; };
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const index = /^item-/.test(this.id) ? Number(this.id.slice(5)) : -1;
    return { top: index >= 0 ? 350 + Math.floor(index / 3) * 180 : this.id === 'query' ? 100 : 0, left: index >= 0 ? index % 3 * 240 : 0, width: 200, height: 80 };
  };
  Object.defineProperty(document, 'activeElement', { get: () => focused || document.body });
  window.localStorage = { getItem: key => values[key], setItem: (key, value) => { values[key] = value; } };
  window.scrollTo = (x, y) => { restoredScroll = y; }; window.pageYOffset = 0;
  const video = $('native-video'); video.paused = true; video.currentTime = 0; video.duration = NaN;
  video.pause = () => { video.paused = true; video.dispatchEvent(new window.Event('pause')); };
  video.play = () => { plays++; video.paused = false; return Promise.resolve(); };
  video.load = () => {};
  const webOS = { service: { request: (uri, options) => {
    if (options.method === 'holdPlayback') return { cancel() {} };
    pending.push(options);
  } }, platformBack() {} };
  window.PalmSystem = {}; window.webOS = webOS;
  vm.runInNewContext(fs.readFileSync('app/main.js', 'utf8'), {
    window, document, webOS, DOMParser, TioCatalog, TioHistory, URL, Error,
    setTimeout: (callback, ms) => { const id = ++timerId; timers.set(id, { callback, ms }); return id; }, clearTimeout: id => timers.delete(id)
  });
  const key = code => { const event = new window.Event('keydown', { cancelable: true }); event.keyCode = code; document.dispatchEvent(event); };
  return { window, document, $, video, pending, values, key, timers, plays: () => plays, scroll: () => restoredScroll, answer: html => pending.shift().onSuccess({ html }), focus: () => focused };
}
const home = Array.from({ length: 6 }, (_, i) => '<article class="episode"><a href="/ver/demo-' + (i + 1) + '"><h3>Demo ' + (i + 1) + '</h3></a></article>').join('');
const episode = '<h1 class="anime-title">Demo 1</h1><div class="episodes-nav"><a href="/anime/demo">Listado</a><a href="/ver/demo-2">Episodio siguiente</a></div><script>var videos = [["YourUpload","https://www.yourupload.com/embed/abc123"]];</script>';
const detail = '<article class="anime-single"><h1 class="title">Demo</h1></article><script>var anime_info = ["10","demo","Demo"]; var episodes = [2,1];</script>';
const result = { result: { statusCode: 200, streamUrl: 'http://127.0.0.1:45678/media/' + 'a'.repeat(48) } };

test('Luna preserves grid columns and scroll, keeps dictation focus and exposes favorites', () => {
  const t = setup(), { $, key, window, document } = t;
  t.answer(home);
  $('item-1').focus(); key(40); assert.equal(t.focus().id, 'item-4');
  key(39); assert.equal(t.focus().id, 'item-5'); key(38); assert.equal(t.focus().id, 'item-2');
  $('item-0').focus(); key(37); assert.equal(t.focus().id, 'item-0');
  $('query').click();
  const event = new window.Event('keyboardStateChange'); event.detail = { visibility: false }; document.dispatchEvent(event);
  assert.equal(t.focus().id, 'query'); assert(!$('query').hasAttribute('readonly'));
  key(461); assert($('query').hasAttribute('readonly'));
  $('item-5').focus(); window.pageYOffset = 888; $('item-5').click(); t.answer(episode);
  key(461); t.answer(home); assert.equal(t.focus().id, 'item-5'); assert.equal(t.scroll(), 888);
  $('item-0').click(); t.answer(episode); $('episode-list').click(); t.answer(detail);
  assert.match($('favorite-anime').querySelector('img').getAttribute('src'), /favorite.svg/);
  $('favorite-anime').click(); assert.equal($('favorite-anime').getAttribute('aria-pressed'), 'true');
  assert.match($('favorite-anime').querySelector('img').getAttribute('src'), /favorite-filled.svg/);
  $('favorites').click(); assert.match($('title').textContent, /favoritos/); assert.equal($('item-0').title, 'Demo');
  $('item-0').click(); t.answer(detail); $('favorite-anime').click(); $('favorites').click();
  assert.equal($('item-0'), null); assert.match($('status').textContent, /Guarda animes/);
});

test('Luna hides controls, pauses in background, saves progress, resumes and handles Stop', () => {
  const t = setup(), { $, video, key, document, window } = t;
  t.answer(home); $('item-0').click(); t.answer(episode); $('item-0').click(); t.pending.shift().onSuccess(result);
  assert.match($('item-0').querySelector('.server-description').textContent, /App/);
  assert.match($('video-rewind').querySelector('img').getAttribute('src'), /rewind.svg/);
  assert.equal(t.plays(), 1); video.duration = 1200; video.currentTime = 123;
  video.dispatchEvent(new window.Event('playing'));
  const hide = [...t.timers.values()].find(timer => timer.ms === 4500); assert(hide); hide.callback();
  assert($('player').classList.contains('controls-hidden'));
  key(39); assert(!$('player').classList.contains('controls-hidden')); assert.equal(t.focus().id, 'video-toggle'); assert.equal(video.currentTime, 123);
  $('video-more').click(); assert.equal($('video-more-panel').hidden, false);
  key(461); assert.equal($('video-more-panel').hidden, true); assert.equal($('player').hidden, false);
  $('video-more').click(); $('video-fullscreen').click(); assert($('player').classList.contains('video-expanded'));
  key(461); assert(!$('player').classList.contains('video-expanded')); assert.equal($('player').hidden, false);
  document.hidden = true; document.dispatchEvent(new window.Event('visibilitychange'));
  assert(video.paused); assert.equal(JSON.parse(t.values['tioanime.recent.v1'])[0].position, 123);
  document.hidden = false; document.dispatchEvent(new window.Event('visibilitychange')); assert.equal(t.plays(), 1);
  key(413); assert.equal($('player').hidden, true);
  $('item-0').click(); t.pending.shift().onSuccess(result);
  assert.equal($('resume-confirm').hidden, false); assert.equal(t.plays(), 1);
  video.duration = NaN; video.currentTime = 0; $('resume-continue').click();
  assert.equal($('resume-confirm').hidden, true); video.duration = 1200; video.dispatchEvent(new window.Event('loadedmetadata'));
  assert.equal(video.currentTime, 123);
  $('video-seek').focus(); key(39); assert.equal(video.currentTime, 133);
  for (const code of [38, 40, 27, 461]) {
    $('video-seek').focus(); key(code);
    assert.equal(t.focus().id, 'video-toggle'); assert.equal($('player').hidden, false);
  }
  key(413); assert.equal(JSON.parse(t.values['tioanime.recent.v1'])[0].position, 133);
  $('item-0').click(); t.pending.shift().onSuccess(result); $('resume-start').click(); assert.equal(video.currentTime, 0);
  video.currentTime = 1190; video.dispatchEvent(new window.Event('ended')); key(413);
  $('recent').click(); assert.match($('item-0').textContent, /Visto/);
});

test('TioAnime server cards distinguish native adapters from external web players', () => {
  const t = setup(); t.answer(home); t.$('item-0').click();
  t.answer('<h1 class="anime-title">Demo 1</h1><script>var videos = [["VOE","https://voe.sx/e/example"],["Mega","https://mega.nz/embed/example"],["YourUpload","https://www.yourupload.com/embed/abc123"],["Okru","https://ok.ru/videoembed/123"]];</script>');
  assert.match(t.$('item-0').textContent, /App/); assert.match(t.$('item-1').textContent, /Web externo/);
  assert.match(t.$('item-2').textContent, /App/); assert.match(t.$('item-3').textContent, /App/);
});
