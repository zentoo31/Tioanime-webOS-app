const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TioHistory } = require('../app/history');
function entry(anime, episode) {
  return { animePath: '/anime/' + anime, path: '/ver/' + anime + '-' + episode, title: anime, episodeTitle: 'Episodio ' + episode, image: '', updatedAt: Date.now() };
}
test('recent history persists, groups by anime and orders by last opening', () => {
  const values = {};
  const storage = { getItem: key => values[key], setItem: (key, value) => { values[key] = value; } };
  const history = TioHistory.create(storage);
  assert.equal(history.save(entry('demo', 1)), true);
  history.save(entry('other', 3));
  history.save(entry('demo', 2));
  const restored = TioHistory.create(storage).list();
  assert.equal(restored.length, 2);
  assert.equal(restored[0].path, '/ver/demo-2');
  assert.equal(restored[1].animePath, '/anime/other');
  assert.equal(history.remove('/anime/demo'), true);
  assert.deepEqual(TioHistory.create(storage).list().map(x => x.animePath), ['/anime/other']);
  assert.equal(history.clear(), true);
  assert.deepEqual(TioHistory.create(storage).list(), []);
});
test('history tolerates unavailable or corrupt storage and caps entries', () => {
  const corrupt = { getItem: () => '{invalid', setItem: () => { throw new Error('Full'); } };
  const history = TioHistory.create(corrupt);
  assert.deepEqual(history.list(), []);
  assert.equal(history.save(entry('demo', 1)), false);
  assert.equal(history.list().length, 1);
  for (let i = 0; i < 60; i++) history.save(entry('anime-' + i, 1));
  assert.equal(history.list().length, 50);
  assert.equal(history.save({ title: 'invalid', path: 'https://example.com' }), false);
});
