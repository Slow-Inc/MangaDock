const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { application, token, A, B } = require('./phase5-fixture.cjs');
let fixture, origin;
async function request(
  path,
  { uid = A, method = 'GET', body, headers = {} } = {},
) {
  return fetch(`${origin}/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(uid ? { Authorization: `Bearer ${token(uid)}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
before(async () => {
  fixture = await application();
  await fixture.app.listen(0, '127.0.0.1');
  origin = await fixture.app.getUrl();
});
after(async () => {
  await fixture?.app.close();
  await fixture?.db.close();
});

test('authenticated routes reject missing auth and malformed paging without reaching the database', async () => {
  assert.equal((await request('feed', { uid: null })).status, 401);
  const start = fixture.requests.length;
  for (const query of [
    'mode=unknown',
    'limit=NaN',
    'offset=-1',
    'limit=1000000',
  ])
    assert.equal((await request(`feed?${query}`)).status, 400);
  assert.equal(fixture.requests.length, start);
});
test('HTTP collection lifecycle preserves ownership, visibility and DTO validation', async () => {
  assert.equal(
    (
      await request('collections', {
        method: 'POST',
        body: { name: ' ', visibility: 'public' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('collections', {
        method: 'POST',
        body: { name: 'Okay', visibility: null },
      })
    ).status,
    400,
  );
  const response = await request('collections', {
    method: 'POST',
    body: { name: 'Weekend', owner_uid: B },
  });
  assert.equal(response.status, 201);
  const collection = await response.json();
  assert.equal(collection.owner_uid, A);
  assert.equal(
    (await request(`collections/public/${collection.id}`, { uid: null }))
      .status,
    404,
  );
  assert.equal(
    (await request(`collections/${collection.id}`, { uid: B })).status,
    404,
  );
  assert.equal(
    (
      await request(`collections/${collection.id}`, {
        uid: B,
        method: 'PUT',
        body: { name: 'Hijacked' },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`collections/${collection.id}/items`, {
        method: 'PUT',
        body: { mangaId: '../unsafe', title: 'Unsafe' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`collections/${collection.id}/items`, {
        method: 'PUT',
        body: { mangaId: 'manga-1', title: 'One' },
      })
    ).status,
    204,
  );
  assert.equal(
    (
      await request(`collections/${collection.id}`, {
        method: 'PUT',
        body: {
          name: 'Shared',
          description: 'For friends',
          visibility: 'public',
        },
      })
    ).status,
    200,
  );
  const shared = await request(`collections/public/${collection.id}`, {
    uid: null,
  });
  assert.equal(shared.status, 200);
  assert.equal(shared.headers.get('cache-control'), 'no-store');
  assert.equal((await shared.json()).items[0].title, 'One');
  await request(`collections/${collection.id}`, { uid: B, method: 'DELETE' });
  assert.equal(
    (await request(`collections/public/${collection.id}`, { uid: null }))
      .status,
    200,
  );
  await request(`collections/${collection.id}`, { method: 'DELETE' });
  assert.equal(
    (await request(`collections/public/${collection.id}`, { uid: null }))
      .status,
    404,
  );
});
test('mobile registration contract returns durable acknowledgement and scopes late cleanup', async () => {
  const body = {
    deviceId: 'native-1',
    provider: 'expo',
    platform: 'android',
    token: 'ExponentPushToken[token-1]',
  };
  assert.equal(
    (await request('notifications/push-devices', { method: 'PUT', body }))
      .status,
    400,
  );
  const registered = await request('notifications/push-devices', {
    method: 'PUT',
    body,
    headers: { 'x-hardware-id': 'native-1' },
  });
  assert.deepEqual(await registered.json(), { registered: true });
  await request('notifications/push-devices', {
    uid: B,
    method: 'PUT',
    body,
    headers: { 'x-hardware-id': 'native-1' },
  });
  assert.equal(
    (await request('notifications/push-devices', { method: 'DELETE', body }))
      .status,
    204,
  );
  assert.equal(
    (await fixture.db.query('SELECT uid FROM push_devices')).rows[0].uid,
    B,
  );
  fixture.fail();
  assert.equal(
    (
      await request('notifications/push-devices', {
        method: 'PUT',
        body,
        headers: { 'x-hardware-id': 'native-1' },
      })
    ).status,
    500,
  );
});
