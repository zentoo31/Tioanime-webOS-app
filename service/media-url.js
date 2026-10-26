'use strict';
module.exports = function (value) {
  if (typeof value !== 'string') return false;
  var allowed = value.match(/^https:\/\/(?:[a-z0-9-]+\.)*vidcache\.net(?::(\d{1,5}))?\/[^\s<>"'?#\\]*\.mp4(?:\?[^\s<>"'#\\]*)?$/i);
  return !!(allowed && (!allowed[1] || (Number(allowed[1]) > 0 && Number(allowed[1]) <= 65535)));
};
