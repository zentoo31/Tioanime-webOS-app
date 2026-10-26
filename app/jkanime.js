(function (root) {
  'use strict';
  function url(value) { try { var u = new URL(value, 'https://jkanime.net/'); return u.protocol === 'https:' && u.hostname === 'jkanime.net' ? u : null; } catch (e) { return null; } }
  function animePath(value) { var u = url(value); return u && /^\/[a-z0-9-]+\/$/.test(u.pathname) ? '/jk/anime/' + u.pathname.split('/')[1] : ''; }
  function episodePath(value, slug) { var u = url(value); return u && u.pathname.indexOf('/' + slug + '/') === 0 && /^\/[a-z0-9-]+\/\d+\/$/.test(u.pathname) ? '/jk/ver/' + u.pathname.slice(1, -1) : ''; }
  function text(node) { return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function image(value) { return /^https:\/\/cdn\.jkdesa\.com\/assets\/images\/animes\/image\/[a-z0-9_.-]+\.(jpg|jpeg|png|webp)$/i.test(value || '') ? value : ''; }
  function parse(payload, path, Parser) {
    var doc = new Parser().parseFromString(payload.html, 'text/html'), seen = {};
    var kind = path.indexOf('/jk/anime/') === 0 ? 'detail' : path.indexOf('/jk/ver/') === 0 ? 'episode' : 'list';
    var result = { source: 'jkanime', kind: kind, title: '', items: [], chronology: [], page: payload.page || 1, assets: payload.assets || {} };
    if (kind === 'list') {
      var query = new URL(path, 'https://jkanime.net').searchParams.get('q') || '';
      result.title = 'Resultados de: ' + query;
      Array.prototype.forEach.call(doc.querySelectorAll('.anime__item'), function (card) {
        var title = card.querySelector('h5 a'), pic = card.querySelector('[data-setbg]');
        var target = title && animePath(title.getAttribute('href'));
        if (!target || seen[target]) return; seen[target] = true;
        result.items.push({ path: target, title: text(title), image: pic ? image(pic.getAttribute('data-setbg')) : '' });
      });
      Array.prototype.forEach.call(doc.querySelectorAll('.pagination a,.product__pagination a'), function (link) {
        var u = url(link.getAttribute('href')); if (!u || u.pathname.indexOf('/buscar/') !== 0) return;
        var number = Number(u.pathname.replace(/\/$/, '').split('/').pop());
        if (number === result.page + 1) result.next = '/jk/search?q=' + encodeURIComponent(query) + '&p=' + number;
        if (number === result.page - 1) result.prev = '/jk/search?q=' + encodeURIComponent(query) + '&p=' + number;
      });
    } else if (kind === 'detail') {
      var slug = path.split('/')[3].split('?')[0];
      result.title = text(doc.querySelector('.anime_info h3')) || slug;
      result.description = text(doc.querySelector('.anime_info p.scroll'));
      result.image = image('https://cdn.jkdesa.com/assets/images/animes/image/' + slug + '.jpg');
      result.genres = [];
      Array.prototype.forEach.call(doc.querySelectorAll('li'), function (li) {
        var value = text(li);
        if (/^Estado:/.test(value)) result.status = value.replace(/^Estado:\s*/, '');
        if (/^Tipo:/.test(value)) result.format = value.replace(/^Tipo:\s*/, '');
        if (/^Emitido:/.test(value)) result.year = (value.match(/\b(?:19|20)\d{2}\b/) || [''])[0];
        if (/^Generos:/.test(value) && !result.genres.length) result.genres = value.replace(/^Generos:\s*/, '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      });
      var episodes = payload.episodes || { data: [] }; result.totalEpisodes = episodes.total;
      episodes.data.forEach(function (entry) { if (/^\d+$/.test(String(entry.number))) result.items.push({ title: 'Episodio ' + entry.number, path: '/jk/ver/' + slug + '/' + entry.number }); });
      var page = Number(episodes.current_page) || result.page; result.page = page;
      if (page > 1) result.prev = '/jk/anime/' + slug + '?p=' + (page - 1);
      if (page < Number(episodes.last_page)) result.next = '/jk/anime/' + slug + '?p=' + (page + 1);
    } else {
      var chunks = path.split('/'), slug = chunks[3], number = chunks[4];
      var name = '';
      Array.prototype.some.call(doc.querySelectorAll('a[href]'), function (link) {
        var target = url(link.getAttribute('href')), value = text(link);
        if (target && target.pathname === '/' + slug + '/' && value && !/^(ver|lista|inicio|detalles)\b/i.test(value)) { name = value; return true; } return false;
      });
      result.animeTitle = name || slug.replace(/-/g, ' ');
      result.title = result.animeTitle + ' ' + number;
      result.animePath = '/jk/anime/' + slug;
      result.image = image('https://cdn.jkdesa.com/assets/images/animes/image/' + slug + '.jpg');
      result.nextEpisode = ''; result.previousEpisode = '';
      Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (link) {
        var target = episodePath(link.getAttribute('href'), slug);
        if (target && /siguiente/i.test(text(link))) result.nextEpisode = target;
        if (target && /anterior/i.test(text(link))) result.previousEpisode = target;
      });
      var pattern = /video\[(\d+)\]\s*=\s*'[^\n]*?src="(https:\/\/jkanime\.net\/jkplayer\/[^"\s]+)"/g, match;
      while ((match = pattern.exec(payload.html))) {
        var anchor = doc.querySelector('#btn-show-' + match[1]);
        result.items.push({ title: text(anchor) || 'JKAnime ' + (Number(match[1]) + 1), url: match[2], managed: true }); seen[match[2]] = true;
      }
      var servers = payload.html.match(/var\s+servers\s*=\s*(\[[\s\S]*?\]);/);
      if (servers) {
        try { JSON.parse(servers[1]).forEach(function (server) {
          if (/mediafire/i.test(server.server)) return;
          var remote = atob(server.remote).trim(), u;
          try { u = new URL(remote); } catch (e) { return; }
          if (u.protocol !== 'https:' || /\/(?:embed|e)\/$/.test(u.pathname) || seen[u.href]) return;
          seen[u.href] = true;
          result.items.push({ title: server.server, url: u.href, managed: /^https:\/\/voe\.sx\/e\/[a-z0-9]+$/.test(u.href) });
        }); } catch (e) {}
      }
    }
    return result;
  }
  root.JKCatalog = { parse: parse, image: image };
}(typeof module !== 'undefined' ? module.exports : window));
