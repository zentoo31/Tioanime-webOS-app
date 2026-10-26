(function (root) {
  'use strict';
  var key = 'tioanime.recent.v1';
  function create(storage) {
    var entries = [];
    function valid(entry) {
      return entry && /^(?:\/anime\/[a-z0-9-]+|\/(?:jk|hi)\/anime\/[a-z0-9-]+)$/.test(entry.animePath) &&
        /^(?:\/ver\/[a-z0-9-]+|\/(?:jk|hi)\/ver\/[a-z0-9-]+\/\d+)$/.test(entry.path) && typeof entry.title === 'string' && typeof entry.episodeTitle === 'string';
    }
    try { var saved = JSON.parse(storage.getItem(key) || '[]'); if (Array.isArray(saved)) entries = saved.filter(valid).slice(0, 50); } catch (e) {}
    function persist() {
      try { storage.setItem(key, JSON.stringify(entries)); return true; } catch (e) { return false; }
    }
    return {
      list: function () { return entries.slice(); },
      save: function (entry) {
        if (!valid(entry)) return false;
        var previous = entries.filter(function (item) { return item.animePath === entry.animePath && item.path === entry.path; })[0];
        if (previous) { entry.position = previous.position; entry.duration = previous.duration; entry.completed = previous.completed; }
        entries = entries.filter(function (previous) { return previous.animePath !== entry.animePath; });
        entries.unshift(entry); entries = entries.slice(0, 50);
        return persist();
      },
      progress: function (animePath, path, position, duration) {
        if (!isFinite(position) || position < 0 || !isFinite(duration) || duration <= 0) return false;
        var entry = entries.filter(function (item) { return item.animePath === animePath && item.path === path; })[0];
        if (!entry) return false;
        entry.position = Math.min(position, duration); entry.duration = duration;
        entry.completed = duration > 30 && position >= duration - 20;
        entry.updatedAt = Date.now();
        return persist();
      },
      remove: function (animePath) {
        entries = entries.filter(function (entry) { return entry.animePath !== animePath; });
        return persist();
      },
      clear: function () { entries = []; return persist(); }
    };
  }
  function favorites(storage) {
    var items = [], favoriteKey = 'tioanime.favorites.v1';
    function valid(item) { return item && /^(?:\/anime\/[a-z0-9-]+|\/(?:jk|hi)\/anime\/[a-z0-9-]+)$/.test(item.path) && typeof item.title === 'string'; }
    try { var saved = JSON.parse(storage.getItem(favoriteKey) || '[]'); if (Array.isArray(saved)) items = saved.filter(valid).slice(0, 200); } catch (e) {}
    return {
      list: function () { return items.slice(); },
      has: function (path) { return items.some(function (item) { return item.path === path; }); },
      toggle: function (item) {
        if (!valid(item)) return false;
        var exists = items.some(function (entry) { return entry.path === item.path; });
        items = items.filter(function (entry) { return entry.path !== item.path; });
        if (!exists) items.unshift(item); items = items.slice(0, 200);
        try { storage.setItem(favoriteKey, JSON.stringify(items)); return true; } catch (e) { return false; }
      }
    };
  }
  root.TioHistory = { create: create, favorites: favorites };
}(typeof module !== 'undefined' ? module.exports : window));
