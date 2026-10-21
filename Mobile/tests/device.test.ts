import test from 'node:test';
import assert from 'node:assert/strict';
import { getDeviceId } from '../src/device.ts';

test('the installed native app keeps its previous hardware identity across relaunch', async () => {
  const storage = { getItem: async () => 'mdock_native_previous', setItem: async () => {} };
  const id = await getDeviceId(storage, async () => 'new-platform-value');
  assert.equal(id, 'mdock_native_previous');
});

test('a new installation saves its platform identity and reuses it on relaunch', async () => {
  const values = new Map<string, string>();
  const storage = { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); } };
  assert.equal(await getDeviceId(storage, async () => 'android-test-id'), 'mdock_native_android-test-id');
  assert.equal(await getDeviceId(storage, async () => 'different-id'), 'mdock_native_android-test-id');
});
