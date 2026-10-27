(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var current = '/', stack = [], serial = 0, lastFocus = '', nextPath = '', previousPath = '';
  var activeSection = 'home', isTV = !!(window.PalmSystem || window.webOSSystem);
  var storage;
  try { storage = window.localStorage; } catch (e) {}
  var recent = TioHistory.create(storage);
  var favorites = TioHistory.favorites(storage);
  var controlsTimer, controlsHidden = false, resumePending = null, pendingSeek = null, savedProgressAt = 0, pageRestore = null;
  function clock(value) { value = isFinite(value) ? Math.max(0, Math.floor(value)) : 0; return Math.floor(value / 60) + ':' + ('0' + value % 60).slice(-2); }
  function scrollPosition() { return window.pageYOffset || document.documentElement.scrollTop || 0; }
  function focusControl(control) {
    if (!control) return;
    control.focus();
    // Evita scrollIntoView(options), interpretado como booleano en motores antiguos.
    var rect = control.getBoundingClientRect(), height = window.innerHeight || document.documentElement.clientHeight;
    if (!height || typeof window.scrollTo !== 'function') return;
    var offset = rect.top < 32 ? rect.top - 32 : rect.top + rect.height > height - 32 ? rect.top + rect.height - height + 32 : 0;
    if (offset) window.scrollTo(0, Math.max(0, scrollPosition() + offset));
  }
  function showControls() {
    clearTimeout(controlsTimer); controlsHidden = false; $('player').classList.remove('controls-hidden');
    if (!playerNative || $('native-video').paused || !$('video-more-panel').hidden || !$('resume-confirm').hidden || !$('player-notice').hidden) return;
    controlsTimer = setTimeout(function () {
      if (playerNative && !$('native-video').paused && $('video-more-panel').hidden && $('resume-confirm').hidden && $('player-notice').hidden) {
        controlsHidden = true; $('player').classList.add('controls-hidden');
      }
    }, 4500);
  }
  function closeMore() { $('video-more-panel').hidden = true; $('video-more').setAttribute('aria-expanded', 'false'); $('video-more').focus(); showControls(); }
  function saveProgress() {
    if (!playerNative || resumePending || pendingSeek !== null || !activeResult || activeResult.kind !== 'episode') return;
    var video = $('native-video');
    recent.progress(activeResult.animePath, current, Number(video.currentTime), Number(video.duration)); savedProgressAt = Date.now();
  }
  function resumeChoice(fromStart) {
    if (!resumePending) return;
    pendingSeek = fromStart ? 0 : resumePending.position; resumePending = null;
    $('resume-confirm').hidden = true;
    applyPendingSeek(); $('video-toggle').focus(); nativePlay(); showControls();
  }
  function applyPendingSeek() {
    if (pendingSeek === null || !isFinite($('native-video').duration) || $('native-video').duration <= 0) return;
    try { $('native-video').currentTime = Math.max(0, Math.min(pendingSeek, $('native-video').duration - 1)); pendingSeek = null; } catch (e) {}
  }
  function prepareResume() {
    var saved = recent.list().filter(function (entry) { return entry.path === current; })[0];
    if (saved && isFinite(saved.position) && saved.position >= 10 && !saved.completed) {
      if (silentResume) { pendingSeek = saved.position; silentResume = false; $('video-toggle').focus(); showControls(); return; }
      resumePending = saved; $('resume-confirm').hidden = false;
      $('resume-description').textContent = 'Retomar desde ' + clock(saved.position) + ' de ' + clock(saved.duration) + '.';
      $('resume-continue').focus();
    } else $('video-toggle').focus();
    silentResume = false;
    showControls();
  }
  var activeResult = null, knownImages = {};
  var playerItem = null, playerCompatible = false, playerSerial = 0, playerTimer, playerNative = false, playbackLease = null;
  var sandboxPolicy = 'allow-scripts allow-same-origin allow-forms allow-presentation';
  var expandedVideo = false, fullscreenBackGuard = 0, searchEditing = false, lastControl = null;
  var imageURLs = {}, networkLease = null, hlsEngine = null, hlsQueue = null;
  var enginePreference = null, playbackEngine = 'native', activeHLS = false, silentResume = false;
  function supportsMSE() {
    try { return !!(window.MediaSource && typeof window.MediaSource.isTypeSupported === 'function' && window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"') && window.MediaSource.isTypeSupported('audio/mp4; codecs="mp4a.40.2"')); } catch (e) { return false; }
  }
  function compatibilityProvider() { return playerItem && /^https:\/\/(?:jkanime\.net\/jkplayer\/|zokoanime\.video\/stream\/)/.test(playerItem.url); }
  function engineLabel() {
    $('video-engine').hidden = !activeHLS;
    buttonLabel($('video-engine'), supportsMSE() ? (playbackEngine === 'mse' ? 'Video: probar modo nativo' : 'Video negro: probar modo compatible') : 'Video negro: reiniciar video', 'refresh');
  }
  function altPath(path) { return /^\/(?:jk|hi)\//.test(path); }
  function isSearch(path) { return path.indexOf('/directorio?q=') === 0 || /^\/(?:jk|hi)\/search\?/.test(path); }
  function proxiedImage(value) { return /^https:\/\/(?:cdn\.jkdesa\.com|hianime\.at|cdn\.anipixcdn\.co|cdn\.myanimelist\.net)\//.test(value || ''); }
  function sourceKey(path) { return path.indexOf('/hi/') === 0 ? 'hi' : path.indexOf('/jk/') === 0 ? 'jk' : 'tio'; }
  function sourceLabel(path) { return sourceKey(path) === 'hi' ? 'HiAnime' : 'JKAnime'; }
  function imageSource(value) { return proxiedImage(value) ? imageURLs[value] || 'icons/library.svg' : value; }
  function setImage(image, value) { image.setAttribute('data-original', value); image.src = imageSource(value); }
  function holdNetwork(required) {
    if (!required && networkLease) { if (networkLease.cancel) networkLease.cancel(); networkLease = null; }
    if (required && !networkLease && isTV && window.webOS) networkLease = webOS.service.request('luna://com.tioanime.tv.catalog', { method: 'holdPlayback', subscribe: true, parameters: {}, onSuccess: function () {}, onFailure: function () {} });
  }
  function historyImages(token, items) {
    var urls = items.map(function (item) { return item.image; }).filter(function (value) { return proxiedImage(value); });
    if (!urls.length) return;
    function apply(response) {
      if (token !== serial) return;
      Object.keys(response.assets || {}).forEach(function (key) { imageURLs[key] = response.assets[key]; });
      Array.prototype.forEach.call(document.querySelectorAll('img[data-original]'), function (img) { var value = img.getAttribute('data-original'); if (imageURLs[value]) img.src = imageURLs[value]; });
    }
    if (isTV && window.webOS) webOS.service.request('luna://com.tioanime.tv.catalog', { method: 'images', parameters: { urls: urls }, onSuccess: apply, onFailure: function () {} });
    else { var xhr = new XMLHttpRequest(); xhr.open('POST', '/api/images'); xhr.setRequestHeader('Content-Type', 'application/json'); xhr.onload = function () { try { apply(JSON.parse(xhr.responseText)); } catch (e) {} }; xhr.send(JSON.stringify({ urls: urls })); }
  }
  function status(text) { $('status').textContent = text; }
  function request(path, callback) {
    var done = false;
    var timer = setTimeout(function () { finish(new Error('La consulta tardó demasiado. Revisa la conexión de la TV.')); }, 23000);
    function finish(error, html) { if (done) return; done = true; clearTimeout(timer); callback(error, html); }
    if (isTV && window.webOS) {
      webOS.service.request('luna://com.tioanime.tv.catalog', {
        method: 'page', parameters: { path: path },
        onSuccess: function (r) { finish(null, r.html); },
        onFailure: function (r) { finish(new Error(r.errorText || 'No se pudo conectar con el servicio del catálogo.')); }
      });
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/page?path=' + encodeURIComponent(path));
      xhr.onload = function () {
        try { var r = JSON.parse(xhr.responseText); if (!r.returnValue) throw new Error(r.errorText); finish(null, r.html); }
        catch (e) { finish(e); }
      };
      xhr.onerror = function () { finish(new Error('No se pudo conectar. Inicia npm run serve para la vista local.')); };
      xhr.send();
    }
  }
  function node(tag, text, className) {
    var n = document.createElement(tag); if (text) n.textContent = text; if (className) n.className = className; return n;
  }
  function icon(name) {
    var image = node('img', '', 'icon');
    image.src = 'icons/' + name + '.svg';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    return image;
  }
  function buttonLabel(button, label, name) { button.textContent = ''; button.appendChild(icon(name)); button.appendChild(node('span', label)); }
  function nativeProvider(url) {
    return /^(?:https:\/\/www\.yourupload\.com\/embed\/[a-zA-Z0-9]+|https:\/\/voe\.sx\/e\/[a-z0-9]+|https:\/\/ok\.ru\/videoembed\/\d+|https:\/\/jkanime\.net\/jkplayer\/(?:um|umv|jk)\?[^\s]+|https:\/\/zokoanime\.video\/stream\/mal\/\d+\/\d+\/(?:sub|dub))$/.test(url || '');
  }
  [['home', 'home'], ['directory', 'library'], ['recent', 'history'], ['back', 'back'], ['previous', 'back'], ['next', 'next'], ['retry', 'refresh'], ['close-player', 'close'], ['clear-history', 'trash'], ['accept-clear', 'trash'], ['video-fullscreen', 'fullscreen'], ['episode-list', 'library'], ['episode-next', 'next'], ['episode-previous', 'back'], ['video-episodes', 'library'], ['video-next', 'next'], ['video-previous', 'back'], ['embed-episodes', 'library'], ['embed-next', 'next'], ['embed-previous', 'back']].forEach(function (entry) {
    $(entry[0]).insertBefore(icon(entry[1]), $(entry[0]).firstChild);
  });
  var searchButton = $('search').querySelector('button');
  searchButton.insertBefore(icon('search'), searchButton.firstChild);
  [['favorites', 'favorite'], ['video-more', 'more'], ['video-rewind', 'rewind'], ['video-forward', 'forward'], ['video-toggle', 'play'], ['video-opening', 'forward'], ['video-server', 'server'], ['video-web', 'web'], ['video-more-close', 'back'], ['resume-continue', 'play'], ['resume-start', 'refresh']].forEach(function (entry) { $(entry[0]).insertBefore(icon(entry[1]), $(entry[0]).firstChild); });
  function editSearch() {
    if (searchEditing) return;
    // Volver a enfocar tras activar la edición despierta el teclado de webOS.
    $('query').blur(); searchEditing = true; $('query').removeAttribute('readonly'); $('query').focus();
  }
  function endSearch() { searchEditing = false; $('query').setAttribute('readonly', ''); }
  $('query').addEventListener('click', editSearch);
  $('query').addEventListener('blur', endSearch);
  // El teclado también desaparece temporalmente al iniciar el dictado.
  // Solo OK, Atrás, envío o un cambio real de foco finalizan la edición.
  function fullscreenElement() { return document.fullscreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement; }
  function isVideoFullscreen() {
    var element = fullscreenElement();
    return expandedVideo || $('native-video').webkitDisplayingFullscreen === true || !!(element && (element === $('player') || $('player').contains(element)));
  }
  function setExpanded(value) {
    expandedVideo = value; $('player').classList.toggle('video-expanded', value);
    $('fullscreen-label').textContent = value ? 'Reducir pantalla' : 'Pantalla completa';
    $('video-fullscreen').setAttribute('aria-pressed', value ? 'true' : 'false');
  }
  function leaveFullscreen() {
    setExpanded(false);
    var exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
    try {
      if (fullscreenElement() && exit) { var promise = exit.call(document); if (promise && promise.catch) promise.catch(function () {}); }
      else if ($('native-video').webkitDisplayingFullscreen && $('native-video').webkitExitFullscreen) $('native-video').webkitExitFullscreen();
    } catch (e) {}
    if (playerNative) $('video-more').focus();
  }
  $('video-fullscreen').onclick = function () {
    if (!playerNative) return;
    $('video-more-panel').hidden = true; $('video-more').setAttribute('aria-expanded', 'false'); $('video-more').focus();
    if (isVideoFullscreen()) { leaveFullscreen(); return; }
    setExpanded(true);
    controlsHidden = true; $('player').classList.add('controls-hidden');
    // En TV el contenedor ya ocupa la pantalla; no entregamos el foco al video.
    if (!isTV) {
      var request = $('player').requestFullscreen || $('player').webkitRequestFullscreen || $('player').webkitRequestFullScreen;
      try { if (request) { var promise = request.call($('player')); if (promise && promise.catch) promise.catch(function () {}); } } catch (e) {}
    }
  };
  function fullscreenChanged() {
    if (!fullscreenElement() && expandedVideo) {
      setExpanded(false); fullscreenBackGuard = Date.now() + 250;
      if (playerNative) $('video-more').focus();
    }
  }
  document.addEventListener('fullscreenchange', fullscreenChanged);
  document.addEventListener('webkitfullscreenchange', fullscreenChanged);
  $('native-video').addEventListener('webkitendfullscreen', function () { setExpanded(false); fullscreenBackGuard = Date.now() + 250; if (playerNative) $('video-more').focus(); });
  document.addEventListener('focusin', function (event) {
    if (event.target && /^(BUTTON|INPUT)$/.test(event.target.tagName)) lastControl = event.target;
  });
  function controlScope() {
    if (!$('compatibility-confirm').hidden) return $('compatibility-confirm');
    if (!$('resume-confirm').hidden) return $('resume-confirm');
    if (!$('video-more-panel').hidden) return $('video-more-panel');
    if (!$('player').hidden) return playerNative && $('player-notice').hidden ? $('native-controls') : $('player');
    return !$('confirm-clear').hidden ? $('confirm-clear') : document;
  }
  function visibleControl(control, scope) {
    return control && /^(BUTTON|INPUT)$/.test(control.tagName) && !control.disabled && scope.contains(control) && control.getClientRects().length;
  }
  function restoreControl() {
    var scope = controlScope();
    if (visibleControl(document.activeElement, scope)) return false;
    var target = visibleControl(lastControl, scope) ? lastControl : scope === $('compatibility-confirm') ? $('cancel-compatibility') : scope === $('resume-confirm') ? $('resume-continue') : scope === $('video-more-panel') ? $('video-opening') : scope === $('confirm-clear') ? $('cancel-clear') : !$('player').hidden ? (playerNative && $('player-notice').hidden ? $('video-toggle') : $('close-player')) : $('item-0') || $('home');
    target.focus(); return true;
  }
  document.addEventListener('cursorStateChange', function (event) {
    if (event.detail && event.detail.visibility === false && !searchEditing) restoreControl();
  });
  function render(result, focus) {
    activeResult = result;
    Object.keys(result.assets || {}).forEach(function (key) { imageURLs[key] = result.assets[key]; });
    $('source-switch').hidden = !isSearch(current);
    ['source-tio', 'source-jk', 'source-hi'].forEach(function (id) { var active = id === 'source-' + sourceKey(current); $(id).setAttribute('aria-pressed', active ? 'true' : 'false'); });
    if (isSearch(current)) $('query').value = new URL(current, 'https://tioanime.com').searchParams.get('q') || '';
    $('chronology-grid').textContent = '';
    $('chronology').hidden = result.kind !== 'detail' || !result.chronology || !result.chronology.length;
    if (!$('chronology').hidden) result.chronology.forEach(function (item, index) {
      if (item.image) knownImages[item.path] = item.image;
      var button = node('button', '', 'card poster');
      button.id = 'chronology-' + index;
      button.setAttribute('aria-label', 'Abrir ' + item.title + (item.year ? ', ' + item.year : ''));
      button.title = item.title;
      var cover = node('span', '', 'poster-cover' + (item.image ? '' : ' cover-placeholder'));
      if (item.image) { var image = node('img'); setImage(image, item.image); image.alt = ''; image.loading = 'lazy'; cover.appendChild(image); }
      else cover.appendChild(icon('library'));
      button.appendChild(cover);
      var caption = node('span', '', 'card-title');
      caption.appendChild(node('span', item.title, 'title-lines'));
      if (item.year) caption.appendChild(node('small', item.year, 'episode-label'));
      button.appendChild(caption);
      button.onclick = function () { button.focus(); load(item.path, true); };
      $('chronology-grid').appendChild(button);
    });
    $('episode-actions').hidden = result.kind !== 'episode';
    ['episode-next', 'video-next', 'embed-next'].forEach(function (id) {
      $(id).disabled = !result.nextEpisode;
      $(id).setAttribute('aria-label', result.nextEpisode ? 'Ir al siguiente episodio' : 'No hay un episodio siguiente disponible');
    });
    ['episode-previous', 'video-previous', 'embed-previous'].forEach(function (id) {
      $(id).disabled = !result.previousEpisode;
      $(id).setAttribute('aria-label', result.previousEpisode ? 'Ir al episodio anterior' : 'No hay un episodio anterior disponible');
    });
    $('history-actions').hidden = result.kind !== 'history' || !result.items.length;
    $('confirm-clear').hidden = true;
    $('clear-history').hidden = false;
    if (result.image) knownImages[current] = result.image;
    $('title').textContent = result.title;
    document.body.setAttribute('data-view', result.kind);
    $('heading').hidden = result.kind === 'detail';
    $('content-label').hidden = result.kind !== 'detail' && result.kind !== 'episode';
    $('content-label').textContent = result.kind === 'detail' ? 'Episodios · ' + (result.totalEpisodes || result.items.length) : 'Servidores disponibles';
    $('eyebrow').textContent = result.kind === 'history' ? 'TU ACTIVIDAD' : result.kind === 'episode' ? 'REPRODUCIR' : current === '/' ? 'DESCUBRE' : 'EXPLORA';
    if (altPath(current)) $('eyebrow').textContent += ' · ' + sourceLabel(current).toUpperCase();
    $('view-description').textContent = result.kind === 'history' ? 'Retoma el último episodio que abriste de cada anime.' : result.kind === 'episode' ? result.title : current === '/' ? 'Lo más reciente, listo para ver.' : result.items.length + ' animes en esta página';
    if (result.kind === 'episode') $('title').textContent = result.animeTitle || result.title;
    ['home', 'directory', 'recent', 'favorites'].forEach(function (id) {
      $(id).classList.toggle('is-active', id === activeSection);
      if (id === activeSection) $(id).setAttribute('aria-current', 'page'); else $(id).removeAttribute('aria-current');
    });
    $('grid').textContent = ''; $('detail').textContent = ''; $('detail').hidden = result.kind !== 'detail';
    nextPath = result.next || ''; $('next').hidden = false; $('next').disabled = !nextPath;
    previousPath = result.prev || ''; $('previous').hidden = false; $('previous').disabled = !previousPath;
    $('pagination').hidden = current.indexOf('/directorio') !== 0 && !/^\/(?:jk|hi)\/search\?/.test(current) && !(altPath(current) && result.kind === 'detail');
    var page = 1;
    try { page = Math.max(1, parseInt(new URL(current, 'https://tioanime.com').searchParams.get('p'), 10) || 1); } catch (e) {}
    $('page-label').textContent = 'Página ' + (result.page || page);
    if (result.kind === 'detail') {
      var animeBase = current.split('?')[0];
      if (result.image) { var image = node('img'); setImage(image, result.image); image.alt = ''; $('detail').appendChild(image); }
      var information = node('div', '', 'anime-information');
      information.appendChild(node('p', 'ACERCA DEL ANIME', 'eyebrow'));
      information.appendChild(node('h1', result.title, 'detail-title'));
      var metadata = node('dl', '', 'anime-metadata');
      function field(label, value, className) {
        if (!value) return;
        var entry = node('div', '', 'metadata-field' + (className ? ' ' + className : ''));
        entry.appendChild(node('dt', label)); entry.appendChild(node('dd', value)); metadata.appendChild(entry);
      }
      field('Estado', result.status, /emisi[oó]n/i.test(result.status || '') ? 'airing' : '');
      field('Estreno', result.year);
      field('Formato', result.format);
      if (metadata.childNodes.length) information.appendChild(metadata);
      if (result.genres && result.genres.length) {
        var genres = node('div', '', 'anime-genres');
        genres.setAttribute('aria-label', 'Géneros');
        result.genres.forEach(function (genre) { genres.appendChild(node('span', genre, 'genre')); });
        information.appendChild(genres);
      }
      information.appendChild(node('p', result.description));
      var favoriteButton = node('button', favorites.has(animeBase) ? 'Quitar de favoritos' : 'Guardar en favoritos', 'favorite-action');
      buttonLabel(favoriteButton, favoriteButton.textContent, favorites.has(animeBase) ? 'favorite-filled' : 'favorite');
      favoriteButton.id = 'favorite-anime'; favoriteButton.setAttribute('aria-pressed', favorites.has(animeBase) ? 'true' : 'false');
      favoriteButton.onclick = function () {
        var saved = favorites.toggle({ path: animeBase, title: result.title, image: result.image || '' });
        buttonLabel(favoriteButton, favorites.has(animeBase) ? 'Quitar de favoritos' : 'Guardar en favoritos', favorites.has(animeBase) ? 'favorite-filled' : 'favorite');
        favoriteButton.setAttribute('aria-pressed', favorites.has(animeBase) ? 'true' : 'false');
        status(saved ? (favorites.has(animeBase) ? 'Anime guardado en Favoritos.' : 'Se quitó de Favoritos.') : 'Cambio aplicado en esta sesión; no se pudo guardar en el dispositivo.');
      };
      information.appendChild(favoriteButton);
      var lastEpisode = recent.list().filter(function (entry) { return entry.animePath === animeBase; })[0];
      if (lastEpisode && (altPath(current) || result.items.some(function (episode) { return episode.path === lastEpisode.path; }))) {
        var continueButton = node('button', '', 'primary-action');
        continueButton.id = 'continue-anime';
        continueButton.appendChild(icon('play'));
        var lastNumber = sourceKey(current) === 'hi' ? null : lastEpisode.path.match(/[-\/](\d+)$/);
        continueButton.appendChild(node('span', 'Continuar · ' + (lastNumber ? 'Episodio ' + lastNumber[1] : lastEpisode.episodeTitle) + (lastEpisode.position >= 10 && !lastEpisode.completed ? ' · ' + clock(lastEpisode.position) : '')));
        continueButton.onclick = function () { load(lastEpisode.path, true); };
        information.appendChild(continueButton);
      }
      $('detail').appendChild(information);
    }
    result.items.forEach(function (item, i) {
      if (item.image && item.path) knownImages[item.path] = item.image;
      var button = node('button', '', 'card' + (result.kind === 'detail' ? ' episode' : result.kind === 'episode' ? ' server' : /^\/(?:(?:jk|hi)\/)?anime\//.test(item.path) ? ' poster' : ''));
      button.id = 'item-' + i;
      button.setAttribute('aria-label', item.episodeTitle ? item.title + ', último abierto: ' + item.episodeTitle : item.title);
      button.title = button.getAttribute('aria-label');
      if (item.image) {
        var img = node('img'); setImage(img, item.image); img.alt = ''; img.loading = 'lazy';
        var cover = node('span', '', button.classList.contains('poster') ? 'poster-cover' : 'thumbnail-cover');
        cover.appendChild(img); button.appendChild(cover);
      } else if (result.kind === 'history' || result.kind === 'list') {
        var placeholder = node('span', '', 'thumbnail-cover cover-placeholder');
        placeholder.appendChild(icon('library')); button.appendChild(placeholder);
      }
      var caption = node('span', '', 'card-title');
      if (!button.classList.contains('poster')) caption.appendChild(icon(item.url ? 'server' : 'play'));
      var number = item.path && item.path.match(/[-\/](\d+)$/);
      var separateEpisode = result.kind === 'list' && item.path.indexOf('/ver/') === 0 && number;
      caption.appendChild(node('span', separateEpisode ? item.title.replace(/\s+\d+$/, '') : item.title, 'title-lines'));
      if (separateEpisode) caption.appendChild(node('small', 'Episodio ' + number[1], 'episode-label'));
      if (item.episodeTitle) caption.appendChild(node('small', 'Último abierto · ' + (sourceKey(item.path) !== 'hi' && number ? 'Episodio ' + number[1] : item.episodeTitle), 'recent-episode'));
      if (item.duration > 0 && isFinite(item.position)) {
        caption.appendChild(node('small', item.completed ? 'Visto' : clock(item.position) + ' / ' + clock(item.duration), 'recent-progress-label'));
        var progress = node('span', '', 'recent-progress'), fill = node('span');
        fill.style.width = Math.max(0, Math.min(100, item.position / item.duration * 100)) + '%'; progress.appendChild(fill); caption.appendChild(progress);
      }
      if (result.kind === 'history' && altPath(item.path)) caption.appendChild(node('small', sourceLabel(item.path), 'source-label'));
      if (result.kind === 'episode') caption.appendChild(node('small', nativeProvider(item.url) ? 'App · Cloudflare' : 'Web externo · DNS de la TV', 'server-description'));
      if (result.kind === 'detail' && lastEpisode && item.path === lastEpisode.path) {
        button.classList.add('last-opened');
        caption.appendChild(node('small', 'Último abierto', 'episode-label'));
      }
      button.appendChild(caption);
      button.onclick = function () { if (item.url) play(item); else load(item.path, true); };
      if (result.kind === 'history') {
        var entry = node('article', '', 'recent-entry');
        entry.appendChild(button);
        var actions = node('div', '', 'recent-actions');
        var episodes = node('button', '', 'recent-catalog');
        episodes.id = 'recent-catalog-' + i;
        episodes.setAttribute('aria-label', 'Ver episodios de ' + item.title);
        episodes.appendChild(icon('library')); episodes.appendChild(node('span', 'Episodios'));
        episodes.onclick = function () { load(item.animePath, true); };
        actions.appendChild(episodes);
        var remove = node('button', '', 'remove-recent');
        remove.id = 'remove-' + i;
        remove.setAttribute('aria-label', 'Eliminar ' + item.title + ' de Recientes');
        remove.title = 'Eliminar ' + item.title;
        remove.appendChild(icon('trash'));
        remove.onclick = function () {
          var saved = recent.remove(item.animePath);
          var index = Math.max(0, Math.min(i, recent.list().length - 1));
          load('#recent', false, recent.list().length ? 'item-' + index : 'recent');
          if (!saved) status('Se quitó de esta sesión, pero no se pudo guardar el cambio en el dispositivo.');
        };
        actions.appendChild(remove); entry.appendChild(actions); $('grid').appendChild(entry);
      } else { $('grid').appendChild(button); }
    });
    status(result.kind === 'episode' ? 'Elige un servidor. Algunos controles requieren el puntero.' : result.items.length ? '' : 'No se encontraron resultados. Prueba con otro nombre.');
    if (result.kind === 'history') status(result.items.length ? '' : 'Aún no hay animes recientes. Abre un servidor para guardar tu primer episodio.');
    if (current === '#favorites') status(result.items.length ? '' : 'Guarda animes desde su ficha para encontrarlos aquí.');
    $('grid').classList.add('content-ready');
    var target = $(focus) || $('continue-anime') || $('item-0') || (result.kind === 'history' ? $('recent') : $('query')); target.focus();
    if (pageRestore) { if (typeof window.scrollTo === 'function') window.scrollTo(0, pageRestore.scroll || 0); pageRestore = null; }
  }
  function load(path, push, focus) {
    preferredColumn = null;
    if (push) stack.push({ path: current, focus: document.activeElement.id, section: activeSection, scroll: scrollPosition() });
    current = path; var token = ++serial;
    if (path === '/') activeSection = 'home';
    else if (path === '#recent') activeSection = 'recent';
    else if (path === '#favorites') activeSection = 'favorites';
    else if (path.indexOf('/directorio') === 0 || path.indexOf('/anime/') === 0 || altPath(path)) activeSection = 'directory';
    var historyItems = path === '#recent' ? recent.list() : path === '#favorites' ? favorites.list() : [];
    holdNetwork(altPath(path) || historyItems.some(function (entry) { return altPath(entry.path); }));
    $('grid').classList.remove('content-ready');
    $('retry').hidden = true; $('grid').textContent = ''; $('detail').hidden = true; $('next').hidden = true; $('previous').hidden = true;
    $('pagination').hidden = true; $('content-label').hidden = true;
    $('heading').hidden = false;
    $('view-description').textContent = '';
    $('title').textContent = path === '/' ? 'Últimos episodios' : path.indexOf('/ver/') === 0 ? 'Preparando episodio' : 'Cargando';
    activeResult = null;
    $('chronology').hidden = true; $('chronology-grid').textContent = '';
    $('episode-actions').hidden = true;
    $('history-actions').hidden = true;
    $('confirm-clear').hidden = true;
    if (path === '#recent' || path === '#favorites') {
      document.body.classList.remove('loading');
      render({ kind: path === '#recent' ? 'history' : 'list', title: path === '#recent' ? 'Vistos recientemente' : 'Tus favoritos', items: historyItems }, focus);
      historyImages(token, historyItems);
      return;
    }
    status('Cargando…'); document.body.classList.add('loading');
    request(path, function (error, html) {
      if (token !== serial) return;
      document.body.classList.remove('loading');
      if (error) { status(error.message); $('retry').hidden = false; $('retry').focus(); return; }
      try {
        var result = sourceKey(path) === 'hi' ? HiCatalog.parse(html, path, DOMParser) : altPath(path) ? JKCatalog.parse(html, path, DOMParser) : TioCatalog.parse(html, path, DOMParser);
        render(result, focus);
      }
      catch (e) { status('No se pudo interpretar el contenido del sitio.'); $('retry').hidden = false; $('retry').focus(); }
    });
  }
  function probeProvider(url, callback) {
    var finished = false;
    var timeout = setTimeout(function () { finish(new Error('No se pudo comprobar el enlace')); }, 9000);
    function finish(error, result) { if (finished) return; finished = true; clearTimeout(timeout); callback(error, result); }
    if (isTV && window.webOS) {
      webOS.service.request('luna://com.tioanime.tv.catalog', {
        method: 'probeProvider', parameters: { url: url },
        onSuccess: function (r) { finish(null, r.result); }, onFailure: function (r) { finish(new Error(r.errorText || 'No se pudo comprobar el enlace')); }
      });
    } else {
      var xhr = new XMLHttpRequest(); xhr.open('GET', '/api/provider?url=' + encodeURIComponent(url));
      xhr.onload = function () { try { var r = JSON.parse(xhr.responseText); if (!r.returnValue) throw new Error(r.errorText); finish(null, r.result); } catch (e) { finish(e); } };
      xhr.onerror = function () { finish(new Error('No se pudo comprobar el enlace')); }; xhr.send();
    }
  }
  function stopNative() {
    saveProgress(); clearTimeout(controlsTimer); controlsHidden = false; $('player').classList.remove('controls-hidden');
    resumePending = null; pendingSeek = null; $('resume-confirm').hidden = true; $('video-more-panel').hidden = true;
    $('video-more').setAttribute('aria-expanded', 'false'); $('player').classList.remove('native-player');
    activeHLS = false; $('video-engine').hidden = true;
    if (window.TioSubtitles) TioSubtitles.clear();
    if (isVideoFullscreen()) leaveFullscreen();
    playerNative = false;
    if (hlsEngine) { hlsEngine.destroy(); hlsEngine = null; }
    if (playbackLease && typeof playbackLease.cancel === 'function') playbackLease.cancel();
    playbackLease = null;
    var video = $('native-video');
    video.hidden = true; $('native-controls').hidden = true;
    if (typeof video.pause === 'function') video.pause();
    video.removeAttribute('src');
    if (typeof video.load === 'function') video.load();
  }
  function nativePlay() {
    if (resumePending || document.hidden || document.webkitHidden) return;
    var video = $('native-video');
    try {
      var promise = video.play();
      if (promise && promise.catch) promise.catch(function () {
        if (playerNative) $('player-status').textContent = 'Pulsa Reproducir para iniciar el video.';
      });
    } catch (e) { $('player-status').textContent = 'Pulsa Reproducir para iniciar el video.'; }
  }
  function startNative(source, hls, token) {
    var video = $('native-video');
    activeHLS = !!hls;
    var preferMSE = hls && supportsMSE() && (enginePreference === 'mse' || enginePreference !== 'native' && isTV && compatibilityProvider());
    function nativeSource(message) {
      if (token !== playerSerial || !playerNative) return;
      if (hlsEngine) { hlsEngine.destroy(); hlsEngine = null; }
      playbackEngine = 'native'; engineLabel(); video.setAttribute('src', source); nativePlay();
      if (message) $('player-status').textContent = message;
    }
    if (!hls || !preferMSE && (enginePreference === 'native' || isTV || (typeof video.canPlayType === 'function' && video.canPlayType('application/vnd.apple.mpegurl')))) {
      nativeSource(); return;
    }
    function ready(error) {
      if (token !== playerSerial || !playerNative) return;
      if (error || !window.Hls || !window.Hls.isSupported()) {
        if (isTV || video.canPlayType && video.canPlayType('application/vnd.apple.mpegurl')) nativeSource('Modo compatible no disponible; se usa el reproductor nativo.');
        else $('player-status').textContent = 'Este navegador no admite HLS. Prueba el reproductor web.';
        return;
      }
      playbackEngine = 'mse'; engineLabel();
      // Remultiplexa TS a MP4 en memoria. No cambia el códec ni recodifica video.
      hlsEngine = new window.Hls({ maxBufferLength: 20, maxMaxBufferLength: 40, enableWorker: false, capLevelToPlayerSize: true });
      hlsEngine.on(window.Hls.Events.MANIFEST_PARSED, function () { if (token === playerSerial) nativePlay(); });
      hlsEngine.on(window.Hls.Events.ERROR, function (event, data) {
        if (token !== playerSerial || !data.fatal) return;
        saveProgress(); showControls(); $('video-more-panel').hidden = false;
        $('player-status').textContent = 'El modo compatible no pudo reproducir este video. Prueba el modo nativo o cambia de servidor.';
        $('video-more').setAttribute('aria-expanded', 'true'); $('video-engine').focus();
      });
      hlsEngine.loadSource(source); hlsEngine.attachMedia(video);
    }
    if (window.Hls) { ready(); return; }
    if (hlsQueue) { hlsQueue.push(ready); return; }
    hlsQueue = [ready];
    var script = document.createElement('script'); script.src = 'vendor/hls.light.min.js';
    function finish(error) { var queue = hlsQueue || []; hlsQueue = null; queue.forEach(function (callback) { callback(error); }); }
    script.onload = function () { finish(); }; script.onerror = function () { finish(new Error('No se pudo cargar el reproductor HLS')); };
    document.head.appendChild(script);
  }
  function play(item, compatible, forceWeb, switchEngine) {
    var token = ++playerSerial;
    clearTimeout(playerTimer);
    stopNative();
    if (!switchEngine) enginePreference = null;
    silentResume = !!switchEngine;
    if ($('player').hidden) lastFocus = document.activeElement.id;
    playerItem = item; playerCompatible = compatible === true;
    $('compatibility-confirm').hidden = true;
    $('player-notice').hidden = true;
    $('embed-controls').hidden = true;
    $('player-mode').hidden = false; $('player-mode').disabled = false;
    $('player-mode').textContent = playerCompatible ? 'Volver al modo protegido' : 'Probar compatibilidad';
    var oldFrame = $('frame'), frame = oldFrame.cloneNode(false);
    frame.src = 'about:blank';
    frame.hidden = false;
    if (playerCompatible) {
      frame.removeAttribute('sandbox'); frame.setAttribute('allowfullscreen', '');
      frame.setAttribute('allow', 'autoplay; fullscreen; encrypted-media');
    } else {
      frame.setAttribute('sandbox', sandboxPolicy); frame.removeAttribute('allowfullscreen');
      frame.setAttribute('allow', 'autoplay; encrypted-media');
    }
    oldFrame.parentNode.replaceChild(frame, oldFrame);
    var persisted = true;
    if (activeResult && activeResult.kind === 'episode') {
      persisted = recent.save({
        animePath: activeResult.animePath, path: current,
        title: activeResult.animeTitle, episodeTitle: activeResult.title,
        image: knownImages[activeResult.animePath] || knownImages[current] || '', updatedAt: Date.now()
      });
    }
    $('player').hidden = false;
    $('player-title').textContent = activeResult ? activeResult.title : 'Reproductor';
    $('player-status').textContent = item.title + (playerCompatible ? ' · Sin protección contra redirecciones' : ' · Modo protegido') + ' · Rojo: cerrar';
    if (!persisted) $('player-status').textContent += ' No se pudo guardar el historial en este dispositivo.';
    $('close-player').focus();
    function openFrame() {
      if (token !== playerSerial) return;
      $('player-notice').hidden = true; frame.hidden = false; frame.src = item.url;
      $('embed-controls').hidden = false;
      $('player-mode').disabled = false;
      playerTimer = setTimeout(function () {
        if (token === playerSerial) $('player-status').textContent = item.title + ' · Si sigue negro o rechaza la protección, cierra y prueba otro servidor o el modo compatible.';
      }, 15000);
    }
    if (nativeProvider(item.url)) {
      frame.hidden = true; $('player-notice').hidden = false;
      $('player-notice-text').textContent = 'Preparando ' + item.title + '…';
      $('player-mode').disabled = true;
      probeProvider(item.url, function (error, result) {
        if (token !== playerSerial) return;
        if (!error && result && result.unavailable) {
          $('player-notice-text').textContent = result.message || item.title + ' respondió HTTP ' + result.statusCode + ': el enlace no está disponible. Elige otro servidor.';
          $('player-mode').hidden = true; $('choose-provider').focus();
        } else if (!error && result && (result.streamUrl || result.mediaUrl) && !compatible && !forceWeb) {
          var localSource = /^http:\/\/127\.0\.0\.1:\d{1,5}\/(?:media\/[a-f0-9]{48}|resource\/[a-f0-9]{48}\/\d+)$/.test(result.streamUrl || '');
          var voeSource = /^https:\/\/[a-z0-9-]+\.cloudwindow-route\.com\/[^\s<>"'\\#]*\.m3u8(?:\?[^\s<>"'\\#]*)?$/i.test(result.mediaUrl || '') && /^https:\/\/voe\.sx\/e\/[a-z0-9]+$/.test(item.url);
          var okruSource = /^https:\/\/[a-z0-9-]+\.okcdn\.ru\/\?[^\s<>"'\\#]+$/i.test(result.mediaUrl || '') && /^https:\/\/ok\.ru\/videoembed\/\d+$/.test(item.url);
          var supportsHLS = isTV || (typeof $('native-video').canPlayType === 'function' && $('native-video').canPlayType('application/vnd.apple.mpegurl'));
          if (!localSource && !okruSource && !(voeSource && supportsHLS)) { openFrame(); return; }
          playerNative = true;
          savedProgressAt = Date.now(); $('player').classList.add('native-player');
          if (localSource && isTV && window.webOS) playbackLease = webOS.service.request('luna://com.tioanime.tv.catalog', { method: 'holdPlayback', subscribe: true, parameters: {}, onSuccess: function () {}, onFailure: function () {
            if (token === playerSerial && playerNative) $('player-status').textContent = 'No se pudo mantener el servicio de video. Prueba el reproductor web.';
          } });
          frame.hidden = true; $('player-notice').hidden = true;
          $('native-video').hidden = false; $('native-controls').hidden = false;
          $('video-time').textContent = '0:00 / 0:00';
          $('player-mode').disabled = false; $('player-mode').textContent = 'Probar reproductor web';
          $('player-status').textContent = item.title + ' · Reproductor de la app · Rojo o Atrás: cerrar';
          playerTimer = setTimeout(function () {
            if (token === playerSerial && playerNative) $('player-status').textContent = 'Si no comienza, prueba Reproducir o el reproductor web. Puede fallar la conexión o el formato en esta TV.';
          }, 15000);
          if (window.TioSubtitles) TioSubtitles.set(result.subtitles || []);
          prepareResume();
          startNative(localSource ? result.streamUrl : result.mediaUrl, /mpegurl/i.test(result.mediaType || '') || voeSource, token);
        } else { openFrame(); }
      });
    } else { openFrame(); }
  }
  function closePlayer() {
    ++playerSerial; clearTimeout(playerTimer); playerItem = null;
    stopNative();
    $('compatibility-confirm').hidden = true; $('player-notice').hidden = true;
    $('frame').src = 'about:blank'; $('player').hidden = true;
    $('embed-controls').hidden = true;
    var button = $(lastFocus); if (button) button.focus();
  }
  function back() {
    if (!$('resume-confirm').hidden) { closePlayer(); return; }
    if (!$('video-more-panel').hidden) { closeMore(); return; }
    if (isVideoFullscreen()) { leaveFullscreen(); return; }
    if (Date.now() < fullscreenBackGuard) return;
    if (searchEditing) { endSearch(); $('query').blur(); $('query').focus(); return; }
    if (!$('compatibility-confirm').hidden) { cancelCompatibility(); return; }
    if (!$('confirm-clear').hidden) { cancelClear(); return; }
    if (!$('player').hidden) { closePlayer(); return; }
    if (stack.length) { var previous = stack.pop(); pageRestore = previous; activeSection = previous.section || 'home'; load(previous.path, false, previous.focus); }
    else if (window.webOS && isTV) webOS.platformBack();
  }
  $('close-player').onclick = closePlayer;
  $('choose-provider').onclick = closePlayer;
  function episodeNavigation(direction) {
    if (!activeResult || activeResult.kind !== 'episode') return;
    var path = direction === 'next' ? activeResult.nextEpisode : direction === 'previous' ? activeResult.previousEpisode : activeResult.animePath;
    if (!path) return;
    if (!$('player').hidden) closePlayer();
    load(path, true);
  }
  ['episode-list', 'video-episodes', 'embed-episodes'].forEach(function (id) { $(id).onclick = function () { episodeNavigation('list'); }; });
  ['episode-next', 'video-next', 'embed-next'].forEach(function (id) { $(id).onclick = function () { episodeNavigation('next'); }; });
  ['episode-previous', 'video-previous', 'embed-previous'].forEach(function (id) { $(id).onclick = function () { episodeNavigation('previous'); }; });
  function cancelCompatibility() {
    $('compatibility-confirm').hidden = true; $('frame').hidden = false; $('player-mode').focus();
  }
  $('player-mode').onclick = function () {
    if (!playerItem) return;
    if (playerNative) { play(playerItem, false, true); return; }
    if (playerCompatible) { play(playerItem, false); return; }
    $('compatibility-confirm').hidden = false; $('frame').hidden = true; $('cancel-compatibility').focus();
  };
  $('cancel-compatibility').onclick = cancelCompatibility;
  $('accept-compatibility').onclick = function () { if (playerItem) play(playerItem, true); };
  function seekVideo(seconds) {
    if (!playerNative) return;
    var video = $('native-video');
    try { video.currentTime = Math.max(0, Math.min(isFinite(video.duration) ? video.duration : Infinity, video.currentTime + seconds)); } catch (e) {}
  }
  $('video-toggle').onclick = function () {
    if (!playerNative) return;
    if ($('native-video').paused) nativePlay(); else $('native-video').pause();
  };
  $('video-rewind').onclick = function () { seekVideo(-10); };
  $('video-forward').onclick = function () { seekVideo(10); };
  $('video-opening').onclick = function () { seekVideo(85); };
  $('video-more').onclick = function () { $('video-more-panel').hidden = false; $('video-more').setAttribute('aria-expanded', 'true'); showControls(); $('video-opening').focus(); };
  $('video-more-close').onclick = closeMore;
  $('video-server').onclick = closePlayer;
  $('video-web').onclick = function () { if (playerItem) play(playerItem, false, true); };
  $('video-engine').onclick = function () {
    if (!playerItem || !activeHLS) return;
    enginePreference = playbackEngine === 'native' && supportsMSE() ? 'mse' : 'native';
    play(playerItem, false, false, true);
  };
  $('resume-continue').onclick = function () { resumeChoice(false); };
  $('resume-start').onclick = function () { resumeChoice(true); };
  $('video-seek').onclick = function () { showControls(); };
  $('native-video').addEventListener('loadedmetadata', applyPendingSeek);
  $('native-video').addEventListener('canplay', applyPendingSeek);
  $('native-video').addEventListener('pause', function () { buttonLabel($('video-toggle'), 'Reproducir', 'play'); saveProgress(); showControls(); });
  $('native-video').addEventListener('ended', function () { buttonLabel($('video-toggle'), 'Reproducir', 'play'); saveProgress(); showControls(); });
  $('player').addEventListener('mousemove', function () { if (playerNative) showControls(); });
  $('native-video').addEventListener('playing', function () {
    if (!playerNative) return;
    buttonLabel($('video-toggle'), 'Pausar', 'pause');
    clearTimeout(playerTimer); $('player-notice').hidden = true;
    $('player-status').textContent = (playerItem ? playerItem.title : 'Video') + ' · Reproduciendo · Rojo o Atrás: cerrar';
    showControls();
  });
  $('native-video').addEventListener('error', function () {
    if (!playerNative) return;
    showControls();
    if (isVideoFullscreen()) leaveFullscreen();
    clearTimeout(playerTimer);
    var code = $('native-video').error ? $('native-video').error.code : 0;
    var reason = code === 2 ? 'Error de red o conexión HTTPS.' : code === 3 ? 'La TV no pudo decodificar el video.' : code === 4 ? 'La fuente o el formato no es compatible con esta TV.' : 'No se pudo cargar el video.';
    $('player-notice').hidden = false;
    $('player-notice-text').textContent = reason + ' Puedes probar el reproductor web o elegir otro servidor.';
    (playerNative ? $('choose-provider') : $('player-mode')).focus();
  });
  $('native-video').addEventListener('timeupdate', function () {
    if (!playerNative) return;
    function format(value) { value = isFinite(value) ? Math.max(0, Math.floor(value)) : 0; return Math.floor(value / 60) + ':' + ('0' + value % 60).slice(-2); }
    $('video-time').textContent = format(this.currentTime) + ' / ' + format(this.duration);
    $('video-progress-fill').style.width = isFinite(this.duration) && this.duration > 0 ? Math.max(0, Math.min(100, this.currentTime / this.duration * 100)) + '%' : '0%';
    if (Date.now() - savedProgressAt >= 10000) saveProgress();
  });
  $('home').onclick = function () { load('/', true); };
  $('brand-home').onclick = function (event) { event.preventDefault(); load('/', current !== '/'); };
  $('directory').onclick = function () { load('/directorio', true); };
  $('recent').onclick = function () { load('#recent', true); };
  $('favorites').onclick = function () { load('#favorites', true); };
  function cancelClear() {
    $('confirm-clear').hidden = true; $('clear-history').hidden = false; $('clear-history').focus();
  }
  $('clear-history').onclick = function () {
    $('clear-history').hidden = true; $('confirm-clear').hidden = false; $('cancel-clear').focus();
  };
  $('cancel-clear').onclick = cancelClear;
  $('accept-clear').onclick = function () {
    var saved = recent.clear();
    load('#recent', false, 'recent');
    status(saved ? 'Se eliminaron todos los animes de Recientes.' : 'Se vació esta sesión, pero no se pudo guardar el cambio en el dispositivo.');
  };
  $('back').onclick = back;
  $('retry').onclick = function () { load(current, false); };
  $('next').onclick = function () { if (nextPath) load(nextPath, true); };
  $('previous').onclick = function () { if (previousPath) load(previousPath, true); };
  function searchIn(source) {
    var value = $('query').value.trim();
    if (!value) { $('query').focus(); return; }
    endSearch(); $('query').blur(); load((source === 'hi' ? '/hi/search?q=' : source === 'jk' ? '/jk/search?q=' : '/directorio?q=') + encodeURIComponent(value), true);
  }
  $('source-tio').onclick = function () { searchIn('tio'); };
  $('source-hi').onclick = function () { searchIn('hi'); };
  $('source-jk').onclick = function () { searchIn('jk'); };
  $('search').onsubmit = function (event) { event.preventDefault(); searchIn(isSearch(current) ? sourceKey(current) : 'tio'); };
  var preferredColumn = null;
  function navigate(key) {
    var scope = controlScope(), active = document.activeElement;
    var selectors = ['header nav', '#search', '#source-switch', '#detail', '#episode-actions', '#history-actions', '#grid', '#chronology-grid', '#pagination', '#retry'];
    var zones = scope === document ? selectors.map(function (selector) { return document.querySelector(selector); }).filter(Boolean) : [scope];
    var groups = zones.map(function (zone) {
      var buttons = zone.tagName === 'BUTTON' ? [zone] : Array.prototype.slice.call(zone.querySelectorAll('button,input'));
      return buttons.filter(function (button) { return visibleControl(button, scope); });
    }).filter(function (group) { return group.length; });
    var groupIndex = -1;
    groups.forEach(function (group, index) { if (group.indexOf(active) >= 0) groupIndex = index; });
    if (groupIndex < 0) { restoreControl(); return; }
    function rows(group) {
      var list = [], ordered = group.slice().sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.abs(ra.top - rb.top) > 16 ? ra.top - rb.top : ra.left - rb.left; });
      ordered.forEach(function (button) {
        var r = button.getBoundingClientRect(), last = list[list.length - 1];
        if (!last || Math.abs(last.top - r.top) > 16) { last = { top: r.top, items: [] }; list.push(last); }
        last.items.push(button);
      }); return list;
    }
    var currentRows = rows(groups[groupIndex]), rowIndex = 0, column = 0;
    currentRows.forEach(function (row, i) { var at = row.items.indexOf(active); if (at >= 0) { rowIndex = i; column = at; } });
    var target, r = active.getBoundingClientRect();
    if (key === 37 || key === 39) {
      target = currentRows[rowIndex].items[column + (key === 37 ? -1 : 1)];
      if (target) { var rect = target.getBoundingClientRect(); preferredColumn = rect.left + rect.width / 2; }
    } else {
      if (preferredColumn === null) preferredColumn = r.left + r.width / 2;
      var direction = key === 38 ? -1 : 1, nextRow = currentRows[rowIndex + direction];
      if (!nextRow && groups[groupIndex + direction]) { var nextRows = rows(groups[groupIndex + direction]); nextRow = direction > 0 ? nextRows[0] : nextRows[nextRows.length - 1]; }
      if (nextRow) { var closest = Infinity; nextRow.items.forEach(function (button) { var rect = button.getBoundingClientRect(), distance = Math.abs(rect.left + rect.width / 2 - preferredColumn); if (distance < closest) { closest = distance; target = button; } }); }
    }
    focusControl(target);
  }
  document.addEventListener('mouseover', function (event) {
    var target = event.target;
    while (target && target !== document && target.tagName !== 'BUTTON') target = target.parentNode;
    if (target && target.tagName === 'BUTTON' && visibleControl(target, controlScope())) { preferredColumn = null; target.focus(); }
  });
  function visibilityChanged() {
    if (document.hidden || document.webkitHidden) {
      saveProgress();
      if (playerNative && typeof $('native-video').pause === 'function') $('native-video').pause();
      clearTimeout(controlsTimer);
    } else if (playerNative) {
      showControls();
      $('player-status').textContent = 'Pulsa Reproducir para continuar.';
      if ($('resume-confirm').hidden) $('video-toggle').focus();
    } else restoreControl();
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  document.addEventListener('webkitvisibilitychange', visibilityChanged);
  window.addEventListener('pagehide', saveProgress);
  document.addEventListener('keydown', function (event) {
    var key = event.keyCode;
    if (playerNative) {
      var wasHidden = controlsHidden; showControls();
      if (wasHidden && (key === 13 || key >= 37 && key <= 40)) { event.preventDefault(); $('video-toggle').focus(); return; }
      if (document.activeElement === $('video-seek')) {
        if (key === 37 || key === 39) { event.preventDefault(); seekVideo(key === 37 ? -10 : 10); return; }
        if (key === 38 || key === 40 || key === 27 || key === 461) { event.preventDefault(); $('video-toggle').focus(); return; }
      }
    }
    if (key === 13 && document.activeElement === $('query') && !searchEditing) { event.preventDefault(); editSearch(); return; }
    if (key === 403) { if (!$('player').hidden) { event.preventDefault(); closePlayer(); } return; }
    if (key === 461 || key === 27) { event.preventDefault(); back(); return; }
    if (playerNative && key === 413) { event.preventDefault(); closePlayer(); return; }
    if (playerNative && $('resume-confirm').hidden && (key === 415 || key === 19 || key === 412 || key === 417)) {
      event.preventDefault();
      if (key === 415) nativePlay(); else if (key === 19) $('native-video').pause(); else seekVideo(key === 412 ? -10 : 10);
      return;
    }
    if (key < 37 || key > 40 || (document.activeElement === $('query') && searchEditing)) return;
    event.preventDefault();
    if (restoreControl()) return;
    navigate(key);
  }, true);
  load('/', false);
}());
