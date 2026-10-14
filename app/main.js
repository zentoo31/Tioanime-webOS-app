(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var current = '/', stack = [], serial = 0, lastFocus = '', nextPath = '', previousPath = '';
  var activeSection = 'home';
  var storage;
  try { storage = window.localStorage; } catch (e) {}
  var recent = TioHistory.create(storage);
  var activeResult = null, knownImages = {};
  var playerSandbox = $('frame').getAttribute('sandbox');
  function status(text) { $('status').textContent = text; }
  function request(path, callback) {
    var done = false;
    var timer = setTimeout(function () { finish(new Error('La consulta tardó demasiado. Revisa la conexión de la TV.')); }, 23000);
    function finish(error, html) { if (done) return; done = true; clearTimeout(timer); callback(error, html); }
    if (window.PalmSystem && window.webOS) {
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
  [['home', 'home'], ['directory', 'library'], ['recent', 'history'], ['back', 'back'], ['previous', 'back'], ['next', 'next'], ['retry', 'refresh'], ['close-player', 'close'], ['clear-history', 'trash'], ['accept-clear', 'trash']].forEach(function (entry) {
    $(entry[0]).insertBefore(icon(entry[1]), $(entry[0]).firstChild);
  });
  var searchButton = $('search').querySelector('button');
  searchButton.insertBefore(icon('search'), searchButton.firstChild);
  function render(result, focus) {
    activeResult = result;
    $('history-actions').hidden = result.kind !== 'history' || !result.items.length;
    $('confirm-clear').hidden = true;
    $('clear-history').hidden = false;
    if (result.image) knownImages[current] = result.image;
    $('title').textContent = result.title;
    document.body.setAttribute('data-view', result.kind);
    $('heading').hidden = result.kind === 'detail';
    $('content-label').hidden = result.kind !== 'detail' && result.kind !== 'episode';
    $('content-label').textContent = result.kind === 'detail' ? 'Episodios · ' + result.items.length : 'Servidores disponibles';
    $('eyebrow').textContent = result.kind === 'history' ? 'TU ACTIVIDAD' : result.kind === 'episode' ? 'REPRODUCIR' : current === '/' ? 'DESCUBRE' : 'EXPLORA';
    $('view-description').textContent = result.kind === 'history' ? 'Retoma el último episodio que abriste de cada anime.' : result.kind === 'episode' ? result.title : current === '/' ? 'Lo más reciente, listo para ver.' : result.items.length + ' animes en esta página';
    if (result.kind === 'episode') $('title').textContent = result.animeTitle || result.title;
    ['home', 'directory', 'recent'].forEach(function (id) {
      $(id).classList.toggle('is-active', id === activeSection);
      if (id === activeSection) $(id).setAttribute('aria-current', 'page'); else $(id).removeAttribute('aria-current');
    });
    $('grid').textContent = ''; $('detail').textContent = ''; $('detail').hidden = result.kind !== 'detail';
    nextPath = result.next || ''; $('next').hidden = false; $('next').disabled = !nextPath;
    previousPath = result.prev || ''; $('previous').hidden = false; $('previous').disabled = !previousPath;
    $('pagination').hidden = current.indexOf('/directorio') !== 0;
    var page = 1;
    try { page = Math.max(1, parseInt(new URL(current, 'https://tioanime.com').searchParams.get('p'), 10) || 1); } catch (e) {}
    $('page-label').textContent = 'Página ' + page;
    if (result.kind === 'detail') {
      if (result.image) { var image = node('img'); image.src = result.image; image.alt = ''; $('detail').appendChild(image); }
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
      var lastEpisode = recent.list().filter(function (entry) { return entry.animePath === current; })[0];
      if (lastEpisode && result.items.some(function (episode) { return episode.path === lastEpisode.path; })) {
        var continueButton = node('button', '', 'primary-action');
        continueButton.id = 'continue-anime';
        continueButton.appendChild(icon('play'));
        var lastNumber = lastEpisode.path.match(/-(\d+)$/);
        continueButton.appendChild(node('span', 'Continuar · ' + (lastNumber ? 'Episodio ' + lastNumber[1] : lastEpisode.episodeTitle)));
        continueButton.onclick = function () { load(lastEpisode.path, true); };
        information.appendChild(continueButton);
      }
      $('detail').appendChild(information);
    }
    result.items.forEach(function (item, i) {
      if (item.image && item.path) knownImages[item.path] = item.image;
      var button = node('button', '', 'card' + (result.kind === 'detail' ? ' episode' : result.kind === 'episode' ? ' server' : item.path.indexOf('/anime/') === 0 ? ' poster' : ''));
      button.id = 'item-' + i;
      button.setAttribute('aria-label', item.episodeTitle ? item.title + ', último abierto: ' + item.episodeTitle : item.title);
      button.title = button.getAttribute('aria-label');
      if (item.image) {
        var img = node('img'); img.src = item.image; img.alt = ''; img.loading = 'lazy';
        var cover = node('span', '', button.classList.contains('poster') ? 'poster-cover' : 'thumbnail-cover');
        cover.appendChild(img); button.appendChild(cover);
      } else if (result.kind === 'history' || result.kind === 'list') {
        var placeholder = node('span', '', 'thumbnail-cover cover-placeholder');
        placeholder.appendChild(icon('library')); button.appendChild(placeholder);
      }
      var caption = node('span', '', 'card-title');
      if (!button.classList.contains('poster')) caption.appendChild(icon(item.url ? 'server' : 'play'));
      var number = item.path && item.path.match(/-(\d+)$/);
      var separateEpisode = result.kind === 'list' && item.path.indexOf('/ver/') === 0 && number;
      caption.appendChild(node('span', separateEpisode ? item.title.replace(/\s+\d+$/, '') : item.title, 'title-lines'));
      if (separateEpisode) caption.appendChild(node('small', 'Episodio ' + number[1], 'episode-label'));
      if (item.episodeTitle) caption.appendChild(node('small', 'Último abierto · ' + (number ? 'Episodio ' + number[1] : item.episodeTitle), 'recent-episode'));
      if (result.kind === 'episode') caption.appendChild(node('small', 'Opción ' + (i + 1) + ' · Abrir reproductor', 'server-description'));
      if (result.kind === 'detail' && lastEpisode && item.path === lastEpisode.path) {
        button.classList.add('last-opened');
        caption.appendChild(node('small', 'Último abierto', 'episode-label'));
      }
      button.appendChild(caption);
      button.onclick = function () { if (item.url) play(item); else load(item.path, true); };
      if (result.kind === 'history') {
        var entry = node('article', '', 'recent-entry');
        entry.appendChild(button);
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
        entry.appendChild(remove); $('grid').appendChild(entry);
      } else { $('grid').appendChild(button); }
    });
    status(result.kind === 'episode' ? 'Elige un servidor. Algunos controles requieren el puntero.' : result.items.length ? '' : 'No se encontraron resultados. Prueba con otro nombre.');
    if (result.kind === 'history') status(result.items.length ? '' : 'Aún no hay animes recientes. Abre un servidor para guardar tu primer episodio.');
    $('grid').classList.add('content-ready');
    var target = $(focus) || $('continue-anime') || $('item-0') || (result.kind === 'history' ? $('recent') : $('query')); target.focus();
  }
  function load(path, push, focus) {
    if (push) stack.push({ path: current, focus: document.activeElement.id, section: activeSection });
    current = path; var token = ++serial;
    if (path === '/') activeSection = 'home';
    else if (path === '#recent') activeSection = 'recent';
    else if (path.indexOf('/directorio') === 0 || path.indexOf('/anime/') === 0) activeSection = 'directory';
    $('grid').classList.remove('content-ready');
    $('retry').hidden = true; $('grid').textContent = ''; $('detail').hidden = true; $('next').hidden = true; $('previous').hidden = true;
    $('pagination').hidden = true; $('content-label').hidden = true;
    $('heading').hidden = false;
    $('view-description').textContent = '';
    $('title').textContent = path === '/' ? 'Últimos episodios' : path.indexOf('/ver/') === 0 ? 'Preparando episodio' : 'Cargando';
    activeResult = null;
    $('history-actions').hidden = true;
    $('confirm-clear').hidden = true;
    if (path === '#recent') {
      document.body.classList.remove('loading');
      render({ kind: 'history', title: 'Vistos recientemente', items: recent.list() }, focus);
      return;
    }
    status('Cargando…'); document.body.classList.add('loading');
    request(path, function (error, html) {
      if (token !== serial) return;
      document.body.classList.remove('loading');
      if (error) { status(error.message); $('retry').hidden = false; $('retry').focus(); return; }
      try { render(TioCatalog.parse(html, path, DOMParser), focus); }
      catch (e) { status('No se pudo interpretar el contenido del sitio.'); $('retry').hidden = false; $('retry').focus(); }
    });
  }
  function play(item) {
    // Netu modifica document.domain: esa operación falla incluso con
    // allow-same-origin si el iframe conserva cualquier sandbox.
    var netuCompatibility = false;
    try {
      var providerURL = new URL(item.url);
      netuCompatibility = /^netu$/i.test(item.title) && providerURL.protocol === 'https:' && providerURL.hostname === 'hqq.tv';
    } catch (e) {}
    // Un contexto nuevo evita heredar restricciones del servidor anterior.
    var oldFrame = $('frame'), frame = oldFrame.cloneNode(false);
    frame.src = 'about:blank';
    if (netuCompatibility) frame.removeAttribute('sandbox');
    else frame.setAttribute('sandbox', playerSandbox);
    oldFrame.parentNode.replaceChild(frame, oldFrame);
    var persisted = true;
    if (activeResult && activeResult.kind === 'episode') {
      persisted = recent.save({
        animePath: activeResult.animePath, path: current,
        title: activeResult.animeTitle, episodeTitle: activeResult.title,
        image: knownImages[activeResult.animePath] || knownImages[current] || '', updatedAt: Date.now()
      });
    }
    lastFocus = document.activeElement.id;
    $('player').hidden = false;
    $('player-title').textContent = activeResult ? activeResult.title : 'Reproductor';
    $('frame').src = item.url;
    $('player-status').textContent = item.title + ' · Si no carga, cierra y elige otro servidor. Botón rojo: cerrar.';
    if (netuCompatibility) $('player-status').textContent = 'Netu · Modo compatible: puede abrir publicidad. Botón rojo: cerrar.';
    if (!persisted) $('player-status').textContent += ' No se pudo guardar el historial en este dispositivo.';
    $('close-player').focus();
  }
  function closePlayer() {
    $('frame').src = 'about:blank'; $('player').hidden = true;
    $('frame').setAttribute('sandbox', playerSandbox);
    var button = $(lastFocus); if (button) button.focus();
  }
  function back() {
    if (!$('confirm-clear').hidden) { cancelClear(); return; }
    if (!$('player').hidden) { closePlayer(); return; }
    if (stack.length) { var previous = stack.pop(); activeSection = previous.section || 'home'; load(previous.path, false, previous.focus); }
    else if (window.webOS && window.PalmSystem) webOS.platformBack();
  }
  $('close-player').onclick = closePlayer;
  $('home').onclick = function () { load('/', true); };
  $('brand-home').onclick = function (event) { event.preventDefault(); load('/', current !== '/'); };
  $('directory').onclick = function () { load('/directorio', true); };
  $('recent').onclick = function () { load('#recent', true); };
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
  $('search').onsubmit = function (event) { event.preventDefault(); load('/directorio?q=' + encodeURIComponent($('query').value.trim()), true); };
  document.addEventListener('keydown', function (event) {
    var key = event.keyCode;
    if (key === 403) { if (!$('player').hidden) { event.preventDefault(); closePlayer(); } return; }
    if (key === 461 || key === 27) { event.preventDefault(); back(); return; }
    if (key < 37 || key > 40 || (document.activeElement.tagName === 'INPUT' && (key === 37 || key === 39))) return;
    event.preventDefault();
    var active = document.activeElement, rect = active.getBoundingClientRect(), best, distance = Infinity;
    var scope = $('player').hidden ? document : $('player');
    Array.prototype.forEach.call(scope.querySelectorAll('button,input'), function (candidate) {
      if (candidate === active || candidate.disabled || !candidate.getClientRects().length) return;
      var r = candidate.getBoundingClientRect(), dx = r.left + r.width / 2 - rect.left - rect.width / 2, dy = r.top + r.height / 2 - rect.top - rect.height / 2;
      var primary = key === 37 ? -dx : key === 39 ? dx : key === 38 ? -dy : dy;
      var cross = key === 37 || key === 39 ? Math.abs(dy) : Math.abs(dx);
      var score = primary + cross * 3;
      if (primary > 5 && score < distance) { best = candidate; distance = score; }
    });
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); }
  });
  load('/', false);
}());
