/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {transformSync} = require('next/dist/build/swc');

// Execute the real component effects with controlled auth and network boundaries.
function loadComponent(relativePath, {auth, window, fetch, cliExchange} = {}) {
  const effects = [];
  const stateUpdates = [];
  const contextValues = [];
  const timers = [];
  const react = {
    createContext: () => ({Provider: 'provider'}),
    createElement: (_type, props) => {if (props?.value) contextValues.push(props.value); return null;},
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
    module: testModule, exports: testModule.exports, console, URL, URLSearchParams, crypto: require('node:crypto').webcrypto, React: react,
    process: {env: {}}, window: window ?? {addEventListener() {}, removeEventListener() {}},
    fetch: fetch ?? (() => Promise.resolve({ok: true, json: async () => ({})})),
    setTimeout: fn => {timers.push(fn); return timers.length;},
    clearTimeout: id => {timers[id - 1] = null;},
    require: name => {
      if (name === 'react') return react;
      if (name === 'next/link') return () => null;
      if (name.endsWith('/supabase')) return {supabase: {auth}};
      if (name.endsWith('/cliPkceExchange')) return {exchangeCliPkceCode: cliExchange};
      if (name.endsWith('/cliNativeAuth')) {
        const helperFilename = path.join(__dirname, '../app/lib/cliNativeAuth.ts');
        const helperCode = transformSync(fs.readFileSync(helperFilename, 'utf8'), {
          filename: helperFilename, jsc: {parser: {syntax: 'typescript'}}, module: {type: 'commonjs'},
        }).code;
        const helperModule = {exports: {}};
        vm.runInNewContext(helperCode, {
          module: helperModule, exports: helperModule.exports, window, URL, AbortController, crypto: require('node:crypto').webcrypto,
          setTimeout: fn => {timers.push(fn); return timers.length;},
          clearTimeout: id => {timers[id - 1] = null;},
        });
        return helperModule.exports;
      }
      if (name.endsWith('/ToastContext')) return {useToast: () => ({showToast: noop, dismissToast: noop})};
      if (name.endsWith('/emailValidation')) return {};
      if (name.endsWith('/userCache')) return {setTokenSupplier: noop, clearUserCache: noop, loadUserData: noop};
      if (name.endsWith('/readingHistory')) return {setHistoryTokenSupplier: noop, clearHistory: noop, loadHistoryData: noop};
      if (name.endsWith('/useSeriesFollow')) return {clearFollowCache: noop};
      if (name.endsWith('/browserActions')) return {reloadPage: noop, redirectToHome: noop};
      if (name.endsWith('/fingerprint')) return {getHardwareId: () => null};
      if (name.endsWith('/avatarUpload')) return {resolveAvatarUrl: value => value};
      if (name.endsWith('/types/user')) return {ROLE: {USER: 0, TRANSLATOR: 1, CREATOR: 2, ADMIN: 8, DEV: 9}};
      if (name === '@mangadock/mobile-bridge') {
        const bridgeFilename = path.join(__dirname, '../app/lib/mobileBridge.ts');
        const bridgeCode = transformSync(fs.readFileSync(bridgeFilename, 'utf8'), {
          filename: bridgeFilename, jsc: {parser: {syntax: 'typescript'}}, module: {type: 'commonjs'},
        }).code;
        const bridgeModule = {exports: {}};
        vm.runInNewContext(bridgeCode, {module: bridgeModule, exports: bridgeModule.exports, URL});
        return bridgeModule.exports;
      }
      if (name.endsWith('/oauthCallback')) return {postOAuthCallbackMessage: (opener, payload, origin) => opener.postMessage({type: 'supabase:oauth:callback', ...payload}, origin)};
      if (name.endsWith('/apiCache')) return {clearAllApiCache: noop};
      throw Error(`Unexpected import: ${name}`);
    },
  }, {filename});
  return {exports: testModule.exports, effects, stateUpdates, timers, contextValues};
}

function cliLoginHarness(provider, exchange = async () => ({access_token: 'qa-access', refresh_token: 'qa-refresh'}), operation = 'login') {
  const listeners = new Map();
  const messages = [];
  const starts = [];
  const authorizeCalls = [];
  const commits = [];
  const window = {
    location: {origin: 'https://example.test'},
    __MANGA_DOCK_CLIENT__: 'android-mobile-shell',
    ReactNativeWebView: {postMessage: raw => messages.push(JSON.parse(raw))},
    __MANGA_DOCK_NATIVE_AUTH__: {startOAuth: (provider, url, requestId) => starts.push({provider, url, requestId})},
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type),
  };
  const component = loadComponent('app/contexts/AuthContext.tsx', {
    window,
    cliExchange: exchange,
    auth: {
      signInWithOAuth: async options => {
        authorizeCalls.push(options);
        const url = new URL('https://auth.example.test/auth/v1/authorize');
        url.searchParams.set('provider', options.provider);
        url.searchParams.set('redirect_to', options.options.redirectTo);
        return {data: {url: url.href}, error: null};
      },
      linkIdentity: async options => {
        authorizeCalls.push(options);
        return {data: {url: provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth?state=qa' : 'https://www.facebook.com/v20.0/dialog/oauth?state=qa'}, error: null};
      },
      exchangeCodeForSession: () => {throw new Error('Shared SDK exchange would mutate sessions after a stale result');},
      setSession: async session => {commits.push(session); return {error: null};},
    },
  });
  component.exports.AuthProvider({children: null});
  const method = operation === 'link'
    ? (provider === 'google' ? 'linkGoogleAccount' : 'linkFacebookAccount')
    : (provider === 'google' ? 'signInWithGoogle' : 'signInWithFacebook');
  const login = component.contextValues[0][method]();
  login.catch(() => {});
  return {component, listeners, messages, starts, authorizeCalls, commits, login};
}

for (const provider of ['google', 'facebook']) {
  test(`CLI ${provider} login starts the installed APK bridge and exchanges a bound PKCE callback`, async () => {
    const exchanges = [];
    const h = cliLoginHarness(provider, async code => {exchanges.push(code); return {access_token: 'qa-access', refresh_token: 'qa-refresh'};});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.authorizeCalls.length, 1, 'CLI must generate an authorize URL instead of emitting an Expo-only command');
    assert.equal(h.starts.length, 1);
    assert.equal(h.starts[0].provider, provider);
    const redirect = new URL(h.authorizeCalls[0].options.redirectTo);
    assert.equal(redirect.origin, 'null');
    assert.equal(redirect.protocol, 'mangadock:');
    assert.equal(redirect.hostname, 'auth');
    assert.equal(redirect.pathname, '/callback');
    const requestId = redirect.searchParams.get('request_id');
    assert.ok(requestId);
    const callback = h.listeners.get('mangadock:native-oauth-callback');
    await callback({detail: {request_id: 'unrelated-request', code: 'stale-code'}});
    assert.equal(exchanges.length, 0);
    await callback({detail: {request_id: requestId, code: 'qa-code'}});
    await h.login;
    assert.deepEqual(exchanges, ['qa-code']);
    assert.equal(h.commits.length, 1);
    assert.ok(h.messages.some(m => m.type === 'oauth_callback_consumed' && m.request_id === requestId));
    assert.equal(h.listeners.has('mangadock:native-oauth-callback'), false);
  });
}

test('CLI cancellation rejects promptly and cleans up its listener', async () => {
  const h = cliLoginHarness('google');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.starts.length, 1);
  const requestId = new URL(h.authorizeCalls[0].options.redirectTo).searchParams.get('request_id');
  await h.listeners.get('mangadock:native-oauth-callback')({detail: {
    request_id: requestId, error: 'cancelled', error_code: 'auth/cancelled-popup-request',
  }});
  await assert.rejects(h.login, {code: 'auth/cancelled-popup-request'});
  assert.equal(h.listeners.has('mangadock:native-oauth-callback'), false);
});

test('CLI token-only callback is rejected instead of accepting an unrelated bearer session', async () => {
  const h = cliLoginHarness('google');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.starts.length, 1);
  const requestId = new URL(h.authorizeCalls[0].options.redirectTo).searchParams.get('request_id');
  await h.listeners.get('mangadock:native-oauth-callback')({detail: {
    request_id: requestId, access_token: 'untrusted-access', refresh_token: 'untrusted-refresh',
  }});
  await assert.rejects(h.login, {code: 'auth/native-invalid-callback'});
});

test('CLI timeout also terminates a stalled code exchange', async () => {
  let complete;
  let signal;
  const h = cliLoginHarness('google', (_code, pendingSignal) => {
    signal = pendingSignal;
    return new Promise(resolve => {complete = resolve;});
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.starts.length, 1);
  const requestId = new URL(h.authorizeCalls[0].options.redirectTo).searchParams.get('request_id');
  void h.listeners.get('mangadock:native-oauth-callback')({detail: {request_id: requestId, code: 'qa-code'}});
  h.component.timers.filter(Boolean).forEach(fn => fn());
  await assert.rejects(h.login, {code: 'auth/native-timeout'});
  assert.equal(signal.aborted, true);
  complete({access_token: 'stale-access', refresh_token: 'stale-refresh'});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.commits.length, 0, 'late exchange must never mutate the shared session');
});

for (const provider of ['google', 'facebook']) {
  test(`CLI ${provider} account linking carries callback metadata for provider URLs`, async () => {
    const h = cliLoginHarness(provider, undefined, 'link');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.starts.length, 1);
    const requestId = new URL(h.authorizeCalls[0].options.redirectTo).searchParams.get('request_id');
    assert.equal(h.starts[0].requestId, requestId);
    assert.equal(new URL(h.starts[0].url).searchParams.has('redirect_to'), false);
    await h.listeners.get('mangadock:native-oauth-callback')({detail: {request_id: requestId, code: 'qa-link-code'}});
    await h.login;
    assert.equal(h.commits.length, 1);
  });
}

test('Expo login still uses its native session protocol', async () => {
  const listeners = new Map();
  const messages = [];
  const sessions = [];
  const component = loadComponent('app/contexts/AuthContext.tsx', {
    window: {
      ReactNativeWebView: {postMessage: raw => messages.push(JSON.parse(raw))},
      addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: type => listeners.delete(type),
    },
    auth: {
      onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}}),
      setSession: async tokens => {sessions.push(tokens); return {error: null};},
      signInWithOAuth: () => {throw new Error('Expo OAuth is started by native');},
    },
  });
  component.exports.AuthProvider({children: null});
  component.effects.forEach(fn => fn());
  const login = component.contextValues[0].signInWithGoogle();
  assert.equal(messages[0].type, 'mangadock:oauth:start');
  await listeners.get('message')({data: {
    type: 'mangadock:native-auth:session', requestId: messages[0].requestId,
    access_token: 'qa-expo-access', refresh_token: 'qa-expo-refresh',
  }});
  await login;
  assert.equal(sessions.length, 1);
});

test('only the CLI capability selects PKCE; Expo and ordinary browsers retain implicit auth', () => {
  const filename = path.join(__dirname, '../app/lib/supabase.ts');
  const code = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, jsc: {parser: {syntax: 'typescript'}}, module: {type: 'commonjs'},
  }).code;
  for (const cli of [false, true]) {
    let options;
    const testModule = {exports: {}};
    vm.runInNewContext(code, {
      module: testModule, exports: testModule.exports,
      process: {env: {NEXT_PUBLIC_SUPABASE_URL: 'https://qa.example.test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'qa-public'}},
      require: name => name === '@supabase/supabase-js'
        ? {createClient: (_url, _key, opts) => {options = opts; return {};}}
        : name.endsWith('/cliAuthFetch') ? {fetchCliAuthWithDeadline: () => {}} : {isCliNativeShell: () => cli},
    });
    assert.equal(options.auth.flowType, cli ? 'pkce' : 'implicit');
    assert.equal(!!options.global?.fetch, cli);
  }
});

test('PKCE HTTP exchange preserves shared session storage and rejects a late aborted response', async () => {
  const filename = path.join(__dirname, '../app/lib/cliPkceExchange.ts');
  const code = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, jsc: {parser: {syntax: 'typescript'}}, module: {type: 'commonjs'},
  }).code;
  const storage = new Map([
    ['sb-qa-auth-token-code-verifier', JSON.stringify('qa-verifier')],
    ['sb-qa-auth-token', 'existing-session'],
  ]);
  const requests = [];
  let complete;
  const testModule = {exports: {}};
  vm.runInNewContext(code, {
    module: testModule, exports: testModule.exports, URL,
    process: {env: {NEXT_PUBLIC_SUPABASE_URL: 'https://qa.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'qa-public-key'}},
    window: {localStorage: {getItem: key => storage.get(key) ?? null, removeItem: key => storage.delete(key)}},
    fetch: async (url, options) => {
      requests.push({url, options});
      return {ok: true, json: () => new Promise(resolve => {complete = resolve;})};
    },
  });
  const controller = new AbortController();
  const exchange = testModule.exports.exchangeCliPkceCode('qa-code', controller.signal);
  exchange.catch(() => {});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests[0].url, 'https://qa.supabase.co/auth/v1/token?grant_type=pkce');
  assert.deepEqual(JSON.parse(requests[0].options.body), {auth_code: 'qa-code', code_verifier: 'qa-verifier'});
  controller.abort();
  complete({access_token: 'late-access', refresh_token: 'late-refresh'});
  await assert.rejects(exchange, /cancelled/);
  assert.equal(storage.get('sb-qa-auth-token'), 'existing-session');
  assert.equal(storage.get('sb-qa-auth-token-code-verifier'), JSON.stringify('qa-verifier'));
});

test('CLI SDK auth deadline aborts a stalled response body during session commit', async () => {
  const filename = path.join(__dirname, '../app/lib/cliAuthFetch.ts');
  const code = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, jsc: {parser: {syntax: 'typescript'}}, module: {type: 'commonjs'},
  }).code;
  const testModule = {exports: {}};
  let deadline;
  vm.runInNewContext(code, {
    module: testModule, exports: testModule.exports, URL, Request, Response, AbortController,
    setTimeout: fn => {deadline = fn; return 1;}, clearTimeout() {},
    fetch: async (_input, options) => ({
      text: () => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))),
    }),
  });
  const request = testModule.exports.fetchCliAuthWithDeadline('https://qa.supabase.co/auth/v1/user');
  request.catch(() => {});
  await new Promise(resolve => setImmediate(resolve));
  deadline();
  await assert.rejects(request, /aborted/);
});

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
