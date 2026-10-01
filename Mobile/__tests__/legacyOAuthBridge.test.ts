const vm = require('node:vm');
const {webcrypto, createHash} = require('node:crypto');
const {TextEncoder} = require('node:util');
const {Buffer} = require('node:buffer');
import {createLegacyOAuthInjectionScript} from '../src/legacyOAuthBridge';

test('serializes native module constants even when they are non-enumerable getters', () => {
  const config = Object.defineProperties({}, {
    url: {get: () => 'https://qa.supabase.co'},
    publicKey: {get: () => 'qa-public'},
  });
  const script = createLegacyOAuthInjectionScript(config as {url: string; publicKey: string});
  expect(script).toContain('"url":"https://qa.supabase.co","publicKey":"qa-public"');
});

function setup(fetchResponse?: () => Promise<unknown>) {
  const posts: Array<Record<string, string>> = [];
  const results: Array<Record<string, string>> = [];
  const requests: Array<{url: string; body: {auth_code: string; code_verifier: string}}> = [];
  const window = {
    ReactNativeWebView: {postMessage: (raw: string) => posts.push(JSON.parse(raw))},
    dispatchEvent: (event: {data: Record<string, string>}) => results.push(event.data),
  };
  const context = vm.createContext({
    window, crypto: webcrypto, URL, Uint8Array, TextEncoder, AbortController,
    btoa: (text: string) => Buffer.from(text, 'binary').toString('base64'),
    MessageEvent: class {data: unknown; constructor(_type: string, init: {data: unknown}) {this.data = init.data;}},
    setTimeout: () => 1, clearTimeout() {},
    fetch: async (url: string, options: {body: string}) => {
      requests.push({url, body: JSON.parse(options.body)});
      return {ok: true, json: fetchResponse ?? (async () => ({access_token: 'qa-access', refresh_token: 'qa-refresh'}))};
    },
  });
  vm.runInContext(createLegacyOAuthInjectionScript({url: 'https://qa.supabase.co', publicKey: 'qa-public'}), context);
  const bridge = vm.runInContext('window.__MANGA_DOCK_LEGACY_AUTH__', context);
  return {bridge, posts, results, requests};
}

test('legacy web command produces a bound S256 browser URL and returns the expected session message', async () => {
  const h = setup();
  await h.bridge.start('google', 'qa-request');
  const start = h.posts.find(message => message.type === 'oauth_start')!;
  expect(start.protocol).toBe('expo');
  const authorize = new URL(start.url);
  expect(authorize.origin).toBe('https://qa.supabase.co');
  expect(authorize.searchParams.get('provider')).toBe('google');
  expect(authorize.searchParams.get('code_challenge_method')).toBe('s256');
  expect(new URL(authorize.searchParams.get('redirect_to')!).searchParams.get('request_id')).toBe('qa-request');
  await h.bridge.receive({request_id: 'stale', code: 'bad-code'});
  expect(h.requests).toHaveLength(0);
  await h.bridge.receive({request_id: 'qa-request', code: 'qa-code'});
  expect(h.requests[0].body.auth_code).toBe('qa-code');
  const challenge = createHash('sha256').update(h.requests[0].body.code_verifier).digest('base64url');
  expect(authorize.searchParams.get('code_challenge')).toBe(challenge);
  expect(h.results).toEqual([{type: 'mangadock:native-auth:session', requestId: 'qa-request', access_token: 'qa-access', refresh_token: 'qa-refresh'}]);
  expect(h.posts.some(message => message.type === 'oauth_callback_consumed')).toBe(true);
});

test('legacy cancellation rejects the web request and discards a late exchange response', async () => {
  let complete: ((value: unknown) => void) | undefined;
  const h = setup(() => new Promise(resolve => {complete = resolve;}));
  await h.bridge.start('facebook', 'qa-request');
  const receiving = h.bridge.receive({request_id: 'qa-request', code: 'qa-code'});
  await new Promise<void>(resolve => setImmediate(resolve));
  await h.bridge.receive({request_id: 'qa-request', error_code: 'auth/cancelled-popup-request'});
  complete!({access_token: 'late-access', refresh_token: 'late-refresh'});
  await receiving;
  expect(h.results).toHaveLength(1);
  expect(h.results[0].error).toBeTruthy();
  expect(h.results[0].access_token).toBeUndefined();
});

test('legacy callback never accepts bearer tokens directly from a deep link', async () => {
  const h = setup();
  await h.bridge.start('google', 'qa-request');
  await h.bridge.receive({request_id: 'qa-request', access_token: 'untrusted', refresh_token: 'untrusted'});
  expect(h.requests).toHaveLength(0);
  expect(h.results[0].error).toBeTruthy();
});
