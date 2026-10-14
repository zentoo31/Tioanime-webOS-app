(function (root) {
  'use strict';
  function absolute(value, type) {
    try {
      var url = new URL(value, 'https://tioanime.com');
      if (url.protocol !== 'https:') return '';
      if (type !== 'video' && url.hostname !== 'tioanime.com') return '';
      if (type === 'page' && !/^\/(anime|ver)\/[a-z0-9-]+$/.test(url.pathname)) return '';
      return type === 'page' ? url.pathname : url.href;
    } catch (e) { return ''; }
  }
  function data(html, name) {
    var match = html.match(new RegExp('var\\s+' + name + '\\s*=\\s*(\\[[^;]*\\])\\s*;'));
    if (!match) return [];
    try { return JSON.parse(match[1]); } catch (e) { return []; }
  }
  function pageLink(doc, path, direction) {
    if (path.indexOf('/directorio') !== 0) return '';
    var link = doc.querySelector('a[rel="' + direction + '"]');
    if (!link) {
      Array.prototype.some.call(doc.querySelectorAll('.pagination a'), function (a) {
        if ((direction === 'prev' ? /anterior|«|‹/i : /siguiente|»|›/i).test(a.textContent)) { link = a; return true; }
        return false;
      });
    }
    if (!link || link.getAttribute('aria-disabled') === 'true' || (link.parentElement && link.parentElement.classList.contains('disabled'))) return '';
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) === '#') return '';
    try {
      var url = new URL(href, 'https://tioanime.com' + path);
      if (url.origin !== 'https://tioanime.com' || url.pathname !== '/directorio') return '';
      var current = new URL('https://tioanime.com' + path);
      if (current.searchParams.has('q')) url.searchParams.set('q', current.searchParams.get('q'));
      return url.pathname + url.search;
    } catch (e) { return ''; }
  }
  function parse(html, path, Parser) {
    var doc = new Parser().parseFromString(html, 'text/html');
    var items = [], seen = {};
    var kind = path.indexOf('/anime/') === 0 ? 'detail' : path.indexOf('/ver/') === 0 ? 'episode' : 'list';
    var title = doc.querySelector('h1.title') || doc.querySelector('h1.anime-title');
    var result = { kind: kind, title: title ? title.textContent.trim() : 'Últimos episodios', items: items };
    if (kind === 'list') {
      var nodes = doc.querySelectorAll(path === '/' ? 'article.episode' : 'article.anime');
      Array.prototype.forEach.call(nodes, function (node) {
        var link = node.querySelector('a[href]'), img = node.querySelector('img'), name = node.querySelector('h3');
        var href = link && absolute(link.getAttribute('href'), 'page');
        if (!href || !name || seen[href]) return;
        seen[href] = true;
        items.push({ path: href, title: name.textContent.trim(), image: img ? absolute(img.getAttribute('src'), 'image') : '' });
      });
      result.prev = pageLink(doc, path, 'prev');
      result.next = pageLink(doc, path, 'next');
    } else if (kind === 'detail') {
      var info = data(html, 'anime_info');
      var description = doc.querySelector('.anime-single .sinopsis') || doc.querySelector('.anime-single .description');
      result.description = description ? description.textContent.trim() : '';
      var single = doc.querySelector('.anime-single');
      function text(selector) {
        var element = single && single.querySelector(selector);
        return element ? element.textContent.replace(/\s+/g, ' ').trim() : '';
      }
      result.status = text('.status');
      result.year = text('.meta .year');
      result.format = text('.meta [class*="anime-type"]');
      result.genres = [];
      if (single) Array.prototype.forEach.call(single.querySelectorAll('.genres a'), function (link) {
        var genre = link.textContent.replace(/\s+/g, ' ').trim();
        if (genre && result.genres.indexOf(genre) === -1) result.genres.push(genre);
      });
      result.image = absolute('/uploads/portadas/' + info[0] + '.jpg', 'image');
      data(html, 'episodes').forEach(function (number) {
        if (typeof number !== 'number' || !/^[a-z0-9-]+$/.test(info[1])) return;
        items.push({ title: 'Episodio ' + number, path: '/ver/' + info[1] + '-' + number });
      });
    } else {
      var animeLink = doc.querySelector('.episodes-nav a[href^="/anime/"]');
      result.animePath = animeLink ? absolute(animeLink.getAttribute('href'), 'page') : path.replace(/^\/ver\//, '/anime/').replace(/-\d+$/, '');
      result.animeTitle = result.title.replace(/\s+\d+(?:\.\d+)?$/, '');
      data(html, 'videos').forEach(function (video) {
        if (!Array.isArray(video) || typeof video[0] !== 'string') return;
        var url = absolute(video[1], 'video');
        if (url) items.push({ title: video[0], url: url });
      });
    }
    return result;
  }
  root.TioCatalog = { parse: parse, absolute: absolute };
}(typeof module !== 'undefined' ? module.exports : window));
