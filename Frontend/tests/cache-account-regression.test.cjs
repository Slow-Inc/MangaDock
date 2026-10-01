/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {transformSync} = require('next/dist/build/swc');

function loadCache(name, fetch) {
  const storage = new Map();
  const timers = new Map();
  let nextTimer = 0;
  const environment = {
    console, Event, fetch,
    window: {dispatchEvent() {}},
    localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
    setTimeout: callback => {timers.set(++nextTimer, callback); return nextTimer;},
    clearTimeout: id => timers.delete(id),
  };
  const load = name => {
    const filename = path.join(__dirname, '../app/lib', `${name}.ts`);
    const {code} = transformSync(fs.readFileSync(filename, 'utf8'), {filename, jsc: {parser: {syntax: 'typescript'}}, module: {type: 'commonjs'}});
    const testModule = {exports: {}};
    vm.runInNewContext(code, {...environment, module: testModule, exports: testModule.exports, require: name => {
      if (name === './apiUtils') return {createAuthHeaders: token => ({Authorization: `Bearer ${token}`})};
      if (name === './apiFetch') return {apiFetch: fetch};
      if (name === './safeJson') return load('safeJson');
      throw Error(`Unexpected import: ${name}`);
    }}, {filename});
    return testModule.exports;
  };
  return {cache: load(name), storage, timers};
}

const response = data => ({ok: true, json: async () => data});

test('a cleared favorites cache rejects a late response from the previous account', async () => {
  const pending = [];
  const {cache, storage} = loadCache('userCache', (_url, options) => {
    if (options.headers.Authorization.endsWith('account-a')) return new Promise(resolve => pending.push(resolve));
    return Promise.resolve(response(_url.endsWith('/favorites') ? [{id: 'book-b'}] : []));
  });
  const oldLoad = cache.loadUserData('account-a');
  cache.clearUserCache();
  await cache.loadUserData('account-b');
  pending[0](response([{id: 'book-a'}]));
  pending[1](response(['book-a']));
  await oldLoad;
  assert.equal(cache.isFavorited('book-a'), false);
  assert.equal(cache.isFavorited('book-b'), true);
  assert.ok(![...storage.values()].join(' ').includes('book-a'));
});

test('a cleared history cache rejects a late response from the previous account', async () => {
  let resolveOld;
  const {cache, storage} = loadCache('readingHistory', (_url, options) => {
    if (options.headers.Authorization.endsWith('account-a')) return new Promise(resolve => {resolveOld = resolve;});
    return Promise.resolve(response([{id: 'book-b', lastReadAt: 2}]));
  });
  const oldLoad = cache.loadHistoryData('account-a');
  cache.clearHistory({syncRemote: false});
  await cache.loadHistoryData('account-b');
  resolveOld(response([{id: 'book-a', lastReadAt: 1}]));
  await oldLoad;
  assert.deepEqual(Array.from(cache.getHistory(), book => book.id), ['book-b']);
  assert.ok(![...storage.values()].join(' ').includes('book-a'));
});

test('auth cache clearing never schedules deletion using the next account token', async () => {
  const calls = [];
  const {cache, timers} = loadCache('readingHistory', (_url, options) => {
    calls.push(options.method ?? 'GET');
    return Promise.resolve(response([{id: 'book-a', lastReadAt: 1}]));
  });
  await cache.loadHistoryData('account-a');
  cache.setHistoryTokenSupplier(async () => 'account-b');
  cache.clearHistory({syncRemote: false});
  for (const callback of timers.values()) await callback();
  assert.deepEqual(calls, ['GET']);
});

test('a previous-account history flush cannot mark the next account pending books as synced', async () => {
  let resolvePost;
  const calls = [];
  const {cache, timers} = loadCache('readingHistory', (_url, options) => {
    calls.push(options.method ?? 'GET');
    if (options.method === 'POST') return new Promise(resolve => {resolvePost = resolve;});
    return Promise.resolve(response([]));
  });
  cache.setHistoryTokenSupplier(async () => 'account-a');
  cache.addToHistory({id: 'new-a'});
  const oldFlush = cache.flushHistoryNow();
  await new Promise(resolve => setImmediate(resolve));
  cache.clearHistory({syncRemote: false});
  cache.setHistoryTokenSupplier(async () => 'account-b');
  cache.addToHistory({id: 'new-b'});
  resolvePost(response([]));
  await oldFlush;
  cache.clearHistory();
  for (const callback of timers.values()) await callback();
  assert.deepEqual(calls, ['POST']);
});
