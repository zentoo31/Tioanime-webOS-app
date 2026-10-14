(function (root) {
  'use strict';
  var key = 'tioanime.recent.v1';
  function create(storage) {
    var entries = [];
    function valid(entry) {
      return entry && /^\/anime\/[a-z0-9-]+$/.test(entry.animePath) &&
        /^\/ver\/[a-z0-9-]+$/.test(entry.path) && typeof entry.title === 'string' && typeof entry.episodeTitle === 'string';
    }
    try { var saved = JSON.parse(storage.getItem(key) || '[]'); if (Array.isArray(saved)) entries = saved.filter(valid).slice(0, 50); } catch (e) {}
    function persist() {
      try { storage.setItem(key, JSON.stringify(entries)); return true; } catch (e) { return false; }
    }
    return {
      list: function () { return entries.slice(); },
      save: function (entry) {
        if (!valid(entry)) return false;
        entries = entries.filter(function (previous) { return previous.animePath !== entry.animePath; });
        entries.unshift(entry); entries = entries.slice(0, 50);
        return persist();
      },
      remove: function (animePath) {
        entries = entries.filter(function (entry) { return entry.animePath !== animePath; });
        return persist();
      },
      clear: function () { entries = []; return persist(); }
    };
  }
  root.TioHistory = { create: create };
}(typeof module !== 'undefined' ? module.exports : window));
