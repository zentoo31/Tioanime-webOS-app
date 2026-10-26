(function (root) {
  'use strict';
  function text(node) { return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function route(value) { try { var u = new URL(value, 'https://hianime.at'); return u.origin === 'https://hianime.at' && /^\/[a-z0-9-]+-\d+$/.test(u.pathname) ? '/hi/anime' + u.pathname : ''; } catch (e) { return ''; } }
  function parse(data, path, Parser) {
    var doc = new Parser().parseFromString(data.html, 'text/html'), pieces = path.split('/'), slug = pieces[3], episode = pieces[4];
    var result = { source: 'hianime', kind: path.indexOf('/hi/search?') === 0 ? 'list' : episode ? 'episode' : 'detail', title: '', items: [], chronology: [], assets: data.assets, page: data.page || 1 };
    if (result.kind === 'list') {
      var q = new URL(path, 'https://hianime.at').searchParams.get('q'), seen = {};
      result.title = 'Resultados de: ' + q;
      Array.prototype.forEach.call(doc.querySelectorAll('.flw-item'), function (card) {
        var a = card.querySelector('.film-name a'), target = a && route(a.getAttribute('href')), img = card.querySelector('.film-poster img');
        if (!target || seen[target]) return; seen[target] = true;
        result.items.push({ path: target, title: text(a), image: img ? img.getAttribute('data-src') || img.getAttribute('src') : '' });
      });
      Array.prototype.forEach.call(doc.querySelectorAll('.pagination a'), function (a) {
        var u; try { u = new URL(a.getAttribute('href'), 'https://hianime.at'); } catch (e) { return; }
        var page = Number(u.searchParams.get('page'));
        if (page === result.page + 1) result.next = '/hi/search?q=' + encodeURIComponent(q) + '&p=' + page;
        if (page === result.page - 1) result.prev = '/hi/search?q=' + encodeURIComponent(q) + '&p=' + page;
      });
      return result;
    }
    result.title = text(doc.querySelector('.anisc-detail .film-name,.film-name')) || slug;
    result.image = (doc.querySelector('.film-poster img') || { getAttribute: function () { return ''; } }).getAttribute('src');
    result.description = text(doc.querySelector('.film-description .text,.film-description'));
    result.genres = [];
    Array.prototype.forEach.call(doc.querySelectorAll('.item-title'), function (item) {
      var value = text(item);
      if (/^Status:/.test(value)) result.status = value.replace(/^Status:\s*/, '');
      if (/^Aired:/.test(value)) result.year = (value.match(/\b(?:19|20)\d{2}\b/) || [''])[0];
      if (/^Genres:/.test(value)) Array.prototype.forEach.call(item.querySelectorAll('a'), function (a) { result.genres.push(text(a)); });
    });
    var episodes = new Parser().parseFromString(data.episodes || '', 'text/html'), list = [];
    Array.prototype.forEach.call(episodes.querySelectorAll('.ep-item'), function (a) {
      var id = a.getAttribute('data-id'), number = a.getAttribute('data-number');
      if (/^\d+$/.test(id) && /^\d+$/.test(number)) list.push({ title: 'Episodio ' + number + ' · ' + (a.getAttribute('title') || ''), path: '/hi/ver/' + slug + '/' + id, number: number });
    });
    if (result.kind === 'detail') { result.items = list; result.totalEpisodes = list.length; return result; }
    result.animeTitle = result.title; result.animePath = '/hi/anime/' + slug;
    list.forEach(function (item, i) { if (item.path === path) { result.title += ' · Episodio ' + item.number; result.episodeNumber = item.number; result.previousEpisode = i ? list[i - 1].path : ''; result.nextEpisode = i + 1 < list.length ? list[i + 1].path : ''; } });
    var servers = new Parser().parseFromString(data.servers || '', 'text/html');
    Array.prototype.forEach.call(servers.querySelectorAll('.server-item'), function (item) {
      var remote; try { remote = atob(item.getAttribute('data-hash')); } catch (e) { return; }
      if (!/^https:\/\/(?:zokoanime\.video\/stream\/mal\/\d+\/\d+\/(?:sub|dub)|megaplay\.buzz\/stream\/s-2\/\d+\/(?:sub|dub)\?s=tcdn)$/.test(remote)) return;
      result.items.push({ title: text(item) + ' · ' + (item.getAttribute('data-type') === 'dub' ? 'DUB · Inglés' : 'SUB · Subtítulos'), url: remote, managed: remote.indexOf('https://zokoanime.video/') === 0 });
    });
    return result;
  }
  root.HiCatalog = { parse: parse };
}(typeof module !== 'undefined' ? module.exports : window));
