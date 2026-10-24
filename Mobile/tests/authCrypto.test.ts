import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { installAuthCrypto } from '../src/authCrypto.ts';

test('native OAuth uses a secure S256 PKCE challenge even without browser WebCrypto', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
  try {
    installAuthCrypto({
      getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
      randomUUID: webcrypto.randomUUID.bind(webcrypto),
      digest: (data) => webcrypto.subtle.digest('SHA-256', data),
    });
    const storage = new Map<string, string>();
    const supabase = createClient('https://auth.example.test', 'public-test-key', { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false, flowType: 'pkce', storage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: (key) => { storage.delete(key); } } } });
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'mangadock://auth/callback', skipBrowserRedirect: true } });
    assert.equal(error, null);
    const url = new URL(data.url!);
    assert.equal(url.searchParams.get('code_challenge_method'), 's256');
    assert.equal(url.searchParams.get('code_challenge')?.length, 43);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
  }
});
