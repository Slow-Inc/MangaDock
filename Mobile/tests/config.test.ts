import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('native builds validate the Backend URL without requiring the old web frontend URL', () => {
  const result = spawnSync(process.execPath, ['scripts/validate-env.mjs'], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8',
    env: { ...process.env, EXPO_PUBLIC_WEB_URL: '', EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:4001', EXPO_PUBLIC_SUPABASE_URL: 'https://auth.example.test', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test-key' },
  });
  assert.equal(result.status, 0, result.stderr);
});
