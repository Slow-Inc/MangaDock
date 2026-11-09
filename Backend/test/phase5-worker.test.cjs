const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, A, B } = require('./phase5-fixture.cjs');
const { PushWorker } = require('../dist/src/notifications/push.worker');
let data, originalFetch;
before(async () => {
  data = await fixture();
  originalFetch = global.fetch;
});
after(async () => {
  global.fetch = originalFetch;
  await data?.db.close();
});
beforeEach(async () => {
  await data.db.exec(
    'TRUNCATE notifications CASCADE; DELETE FROM push_devices',
  );
  await data.db.query(
    "SELECT phase5_push_register($1,'device-1','ExpoPushToken[token_1]','android')",
    [B],
  );
  await data.db.query(
    "INSERT INTO notifications(uid,type,title,link) VALUES($1,'new_chapter','Update','/book/manga-1')",
    [B],
  );
});
function queue() {
  const ready = new Map(),
    dead = [];
  return {
    async zadd(_key, _nx, ...pairs) {
      for (let i = 0; i < pairs.length; i += 2)
        if (!ready.has(pairs[i + 1])) ready.set(pairs[i + 1], pairs[i]);
    },
    async zpopmin() {
      const first = ready.entries().next().value;
      if (!first) return [];
      ready.delete(first[0]);
      return [first[0], String(first[1])];
    },
    async lpush(_key, id) {
      dead.unshift(id);
    },
    async ltrim() {},
    dead,
  };
}
function worker(redis) {
  return new PushWorker(data.supabase, {
    async getClient() {
      return redis;
    },
  });
}
test('two dispatch workers use real database leases and send one ticket, then check its receipt', async () => {
  const redis = queue();
  const sent = [];
  global.fetch = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body) });
    return Response.json({
      data: url.endsWith('/send')
        ? { status: 'ok', id: 'ticket-1' }
        : { 'ticket-1': { status: 'ok' } },
    });
  };
  await Promise.all([worker(redis).tick(), worker(redis).tick()]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.data.recipientUid, B);
  assert.equal(sent[0].body.data.version, '1');
  assert.equal(sent[0].body.channelId, 'mangadock-updates');
  assert.equal(
    (await data.db.query('SELECT phase FROM push_outbox')).rows[0].phase,
    'receipt',
  );
  await data.db.exec(
    "UPDATE push_outbox SET available_at=now()-interval '1 second'",
  );
  await worker(redis).tick();
  assert.equal(sent.length, 2);
  assert.ok(sent[1].url.endsWith('/getReceipts'));
  assert.equal(
    (await data.db.query('SELECT state FROM push_outbox')).rows[0].state,
    'delivered',
  );
});
test('transient Expo failure persists a retry, and Redis loss reconstructs dispatch from outbox', async () => {
  global.fetch = async () => new Response('', { status: 429 });
  await worker(queue()).tick();
  let row = (await data.db.query('SELECT * FROM push_outbox')).rows[0];
  assert.equal(row.state, 'ready');
  assert.equal(row.attempts, 1);
  await data.db.exec(
    "UPDATE push_outbox SET available_at=now()-interval '1 second'",
  );
  global.fetch = async () =>
    Response.json({ data: { status: 'ok', id: 'after-redis-loss' } });
  await worker(queue()).tick();
  row = (await data.db.query('SELECT * FROM push_outbox')).rows[0];
  assert.equal(row.ticket_id, 'after-redis-loss');
});
test('invalid Expo receipt revokes only the exact binding and records a dead letter', async () => {
  const redis = queue();
  global.fetch = async () =>
    Response.json({ data: { status: 'ok', id: 'ticket-2' } });
  await worker(redis).tick();
  await data.db.exec(
    "UPDATE push_outbox SET available_at=now()-interval '1 second'",
  );
  global.fetch = async () =>
    Response.json({
      data: {
        'ticket-2': {
          status: 'error',
          details: { error: 'DeviceNotRegistered' },
        },
      },
    });
  await worker(redis).tick();
  assert.equal(
    (await data.db.query('SELECT * FROM push_devices')).rows.length,
    0,
  );
  assert.equal(redis.dead.length, 1);
});
test('an account swap between enqueue and dispatch prevents sending to the former recipient', async () => {
  let sends = 0;
  global.fetch = async () => {
    sends++;
    throw new Error('Must not send');
  };
  await data.db.query(
    "SELECT phase5_push_register($1,'device-1','ExpoPushToken[token_1]','android')",
    [A],
  );
  await worker(queue()).tick();
  assert.equal(sends, 0);
  assert.equal(
    (await data.db.query('SELECT state FROM push_outbox')).rows[0].state,
    'skipped',
  );
});
