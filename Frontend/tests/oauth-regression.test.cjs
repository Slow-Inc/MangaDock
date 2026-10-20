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
  const timers = [];
  const react = {
    createContext: () => ({Provider: 'provider'}),
    createElement: () => null,
    useCallback: fn => fn,
    useMemo: fn => fn(),
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
    module: testModule, exports: testModule.exports, console, URLSearchParams, React: react,
    process: {env: {}}, window: window ?? {addEventListener() {}, removeEventListener() {}},
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
      if (name.endsWith('/useSeriesFollow')) return {clearFollowCache: noop};
      if (name.endsWith('/browserActions')) return {reloadPage: noop, redirectToHome: noop};
      if (name.endsWith('/fingerprint')) return {getHardwareId: () => null};
      if (name.endsWith('/avatarUpload')) return {resolveAvatarUrl: value => value};
      if (name.endsWith('/types/user')) return {ROLE: {USER: 0, TRANSLATOR: 1, CREATOR: 2, ADMIN: 8, DEV: 9}};
      if (name === '@mangadock/mobile-bridge') return {};
      if (name.endsWith('/oauthCallback')) return {postOAuthCallbackMessage: (opener, payload, origin) => opener.postMessage({type: 'supabase:oauth:callback', ...payload}, origin)};
      if (name.endsWith('/apiCache')) return {clearAllApiCache: noop};
      throw Error(`Unexpected import: ${name}`);
    },
  }, {filename});
  return {exports: testModule.exports, effects, stateUpdates, timers};
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

test('session restore still requires MFA when a same-user token refresh arrives during the check', async () => {
  let listener;
  let resolveAal;
  let requests = 0;
  const component = loadComponent('app/contexts/AuthContext.tsx', {
    auth: {
      onAuthStateChange: fn => {listener = fn; return {data: {subscription: {unsubscribe() {}}}};},
      mfa: {
        getAuthenticatorAssuranceLevel: () => new Promise(resolve => {resolveAal = resolve;}),
        listFactors: async () => ({data: {totp: [{id: 'verified-factor', status: 'verified'}]}}),
      },
    },
    fetch: () => {requests++; return Promise.resolve({ok: true, json: async () => ({})});},
  });
  component.exports.AuthProvider({children: null});
  component.effects.forEach(fn => fn());
  assert.equal(listener('INITIAL_SESSION', session), undefined);
  component.timers.filter(Boolean).forEach(fn => fn());
  listener('TOKEN_REFRESHED', session);
  resolveAal({data: {currentLevel: 'aal1', nextLevel: 'aal2'}});
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(component.stateUpdates.includes('verified-factor'));
  assert.ok(component.stateUpdates.includes(true));
  assert.equal(requests, 0, 'MFA must halt profile/cache hydration');
});

test('signing out while MFA assurance is pending cancels the previous user result', async () => {
  let listener;
  let resolveAal;
  let factorsCalls = 0;
  const component = loadComponent('app/contexts/AuthContext.tsx', {
    auth: {
      onAuthStateChange: fn => {listener = fn; return {data: {subscription: {unsubscribe() {}}}};},
      mfa: {
        getAuthenticatorAssuranceLevel: () => new Promise(resolve => {resolveAal = resolve;}),
        listFactors: async () => {factorsCalls++; return {data: {totp: []}};},
      },
    },
  });
  component.exports.AuthProvider({children: null});
  component.effects.forEach(fn => fn());
  listener('INITIAL_SESSION', session);
  component.timers.filter(Boolean).forEach(fn => fn());
  listener('SIGNED_OUT', null);
  resolveAal({data: {currentLevel: 'aal1', nextLevel: 'aal2'}});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(factorsCalls, 0);
});
