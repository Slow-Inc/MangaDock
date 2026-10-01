/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {transformSync} = require('next/dist/build/swc');

// Execute the real component effects with controlled auth and network boundaries.
function loadComponent(relativePath, {auth, window, fetch} = {}) {
  const effects = [];
  const stateUpdates = [];
  const contextValues = [];
  const timers = [];
  const react = {
    createContext: () => ({Provider: 'provider'}),
    createElement: (_type, props) => {if (props?.value) contextValues.push(props.value); return null;},
    useCallback: fn => fn,
    useContext: () => ({}),
    useEffect: fn => effects.push(fn),
    useRef: value => ({current: value}),
    useState: value => [value, next => stateUpdates.push(next)],
  };
  const noop = () => {};
  const filename = path.join(__dirname, '..', relativePath);
  const {code} = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    jsc: {parser: {syntax: 'typescript', tsx: true}, transform: {react: {runtime: 'classic'}}},
    module: {type: 'commonjs'},
  });
  const testModule = {exports: {}};
  vm.runInNewContext(code, {
    module: testModule, exports: testModule.exports, console, URL, URLSearchParams, crypto: require("node:crypto").webcrypto, React: react,
    process: {env: {}}, window,
    fetch: fetch ?? (() => Promise.resolve({ok: true, json: async () => ({})})),
    setTimeout: fn => {timers.push(fn); return timers.length;},
    clearTimeout: id => {timers[id - 1] = null;},
    require: name => {
      if (name === 'react') return react;
      if (name === 'next/link') return () => null;
      if (name.endsWith('/supabase')) return {supabase: {auth}};
      if (name.endsWith('/ToastContext')) return {useToast: () => ({showToast: noop, dismissToast: noop})};
      if (name.endsWith('/emailValidation')) return {};
      if (name.endsWith('/userCache')) return {setTokenSupplier: noop, clearUserCache: noop, loadUserData: noop};
      if (name.endsWith('/readingHistory')) return {setHistoryTokenSupplier: noop, clearHistory: noop, loadHistoryData: noop};
      if (name.endsWith('/apiCache')) return {clearAllApiCache: noop};
      throw Error(`Unexpected import: ${name}`);
    },
  }, {filename});
  return {exports: testModule.exports, effects, stateUpdates, timers, contextValues};
}

const session = {
  access_token: 'test-access', refresh_token: 'test-refresh',
  user: {id: 'qa-user', email: 'qa@example.test', user_metadata: {}, app_metadata: {}, identities: []},
};
const callbackWindow = () => ({
  location: {search: '', hash: '', origin: 'https://example.test'},
  opener: {postMessage() {}}, close() {},
});

test('auth event returns before a stalled backend request completes', () => {
  let listener;
  let requests = 0;
  const component = loadComponent('app/contexts/AuthContext.tsx', {
    auth: {onAuthStateChange: fn => {listener = fn; return {data: {subscription: {unsubscribe() {}}}};}},
    fetch: () => {requests++; return new Promise(() => {});},
  });
  component.exports.AuthProvider({children: null});
  component.effects.forEach(fn => fn());
  const returned = listener('SIGNED_IN', session);
  assert.equal(returned, undefined, 'listener must release Supabase auth lock synchronously');
  assert.equal(requests, 0, 'backend hydration must start outside the auth notification');
});

test('callback completes only once when INITIAL_SESSION and getSession both resolve', async () => {
  let listener;
  const messages = [];
  const window = callbackWindow();
  window.opener.postMessage = payload => messages.push(payload);
  const component = loadComponent('app/auth/callback/page.tsx', {
    window,
    auth: {
      onAuthStateChange: fn => {listener = fn; return {data: {subscription: {unsubscribe() {}}}};},
      getSession: async () => ({data: {session}, error: null}),
    },
  });
  component.exports.default();
  component.effects.forEach(fn => fn());
  listener('INITIAL_SESSION', session);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].access_token, 'test-access');
});

test('deferred hydration is cancelled when the user signs out before it starts', () => {
  let listener;
  let requests = 0;
  const component = loadComponent('app/contexts/AuthContext.tsx', {
    auth: {onAuthStateChange: fn => {listener = fn; return {data: {subscription: {unsubscribe() {}}}};}},
    fetch: () => {requests++; return Promise.resolve({ok: true, json: async () => ({})});},
  });
  component.exports.AuthProvider({children: null});
  component.effects.forEach(fn => fn());
  listener('SIGNED_IN', session);
  listener('SIGNED_OUT', null);
  component.timers.filter(Boolean).forEach(fn => fn());
  assert.equal(requests, 0);
});

test('standalone browser callback explains that the session was not returned to the app', async () => {
  const window = callbackWindow();
  window.opener = null;
  const component = loadComponent('app/auth/callback/page.tsx', {
    window,
    auth: {
      onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}}),
      getSession: async () => ({data: {session}, error: null}),
    },
  });
  component.exports.default();
  component.effects.forEach(fn => fn());
  await new Promise(resolve => setImmediate(resolve));
  const success = component.stateUpdates.find(value => value?.status === 'success');
  assert.ok(success);
  assert.match(success.message, /ยังส่งผลกลับไปยังแอปไม่ได้/);
});

test('callback reads a session established before its listener was mounted', async () => {
  const messages = [];
  const window = callbackWindow();
  window.opener.postMessage = payload => messages.push(payload);
  const component = loadComponent('app/auth/callback/page.tsx', {
    window,
    auth: {
      onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}}),
      getSession: async () => ({data: {session}, error: null}),
    },
  });
  component.exports.default();
  component.effects.forEach(fn => fn());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(messages.length, 1);
});

test('a callback without a session ends with an error instead of an endless spinner', () => {
  const component = loadComponent('app/auth/callback/page.tsx', {
    window: callbackWindow(),
    auth: {
      onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}}),
      getSession: async () => ({data: {session: null}, error: null}),
    },
  });
  component.exports.default();
  component.effects.forEach(fn => fn());
  component.timers.filter(Boolean).forEach(fn => fn());
  assert.ok(component.stateUpdates.some(value => value?.status === 'error'));
});

function nativeAuthFixture() {
  const callbacks = new Map();
  const exchanged = [];
  const messages = [];
  let requestedUrl;
  const component = loadComponent('app/contexts/AuthContext.tsx', {
    window: {
      location: {origin: 'https://example.test'},
      ReactNativeWebView: {postMessage: value => messages.push(JSON.parse(value))},
      __MANGA_DOCK_CLIENT__: 'android-mobile-shell',
      __MANGA_DOCK_NATIVE_AUTH__: {startOAuth: (_provider, url) => {requestedUrl = url;}},
      addEventListener: (name, callback) => callbacks.set(name, callback),
      removeEventListener: name => callbacks.delete(name),
    },
    auth: {
      signInWithOAuth: async ({options}) => ({data: {url: `https://example.supabase.co/auth/v1/authorize?redirect_to=${encodeURIComponent(options.redirectTo)}`}, error: null}),
      exchangeCodeForSession: async code => {exchanged.push(code); return {error: null};},
      setSession: () => {throw Error('Native OAuth must never accept arbitrary bearer tokens');},
    },
  });
  component.exports.AuthProvider({children: null});
  return {component, callbacks, exchanged, messages, getRequestId: () => new URL(new URL(requestedUrl).searchParams.get('redirect_to')).searchParams.get('request_id')};
}

test('native OAuth ignores stale callbacks and exchanges only its bound authorization code', async () => {
  const fixture = nativeAuthFixture();
  const login = fixture.component.contextValues[0].signInWithGoogle();
  await new Promise(resolve => setImmediate(resolve));
  const callback = fixture.callbacks.get('mangadock:native-oauth-callback');
  await callback({detail: {request_id: 'wrong-request', code: 'attacker-code'}});
  assert.equal(fixture.exchanged.length, 0);
  await callback({detail: {request_id: fixture.getRequestId(), code: 'bound-code'}});
  await login;
  assert.deepEqual(fixture.exchanged, ['bound-code']);
  assert.equal(fixture.messages[0].type, 'oauth_callback_consumed');
});

test('native OAuth rejects bearer-token callbacks even when the request id matches', async () => {
  const fixture = nativeAuthFixture();
  const login = fixture.component.contextValues[0].signInWithGoogle();
  const rejected = assert.rejects(login, {code: 'auth/native-invalid-callback'});
  await new Promise(resolve => setImmediate(resolve));
  await fixture.callbacks.get('mangadock:native-oauth-callback')({detail: {request_id: fixture.getRequestId(), access_token: 'attacker-access', refresh_token: 'attacker-refresh'}});
  await rejected;
  assert.equal(fixture.exchanged.length, 0);
});
