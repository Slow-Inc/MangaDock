const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { randomUUID } = require('node:crypto');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
let db;
async function query(sql, args = []) {
  return (await db.query(sql, args)).rows;
}
async function rpc(name, args = []) {
  return (
    await query(
      `SELECT ${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) AS value`,
      args,
    )
  )[0].value;
}
async function register(
  uid = B,
  device = 'device-1',
  token = 'ExpoPushToken[token_1]',
) {
  return rpc('phase5_push_register', [uid, device, token, 'android']);
}
async function notify(uid = B) {
  return (
    await query(
      "INSERT INTO notifications(uid,type,title,link) VALUES($1,'new_chapter','Update','/book/manga-1') RETURNING id",
      [uid],
    )
  )[0].id;
}
async function job() {
  return (await query('SELECT * FROM push_outbox ORDER BY created_at,id'))[0];
}
async function claim(id, lease = randomUUID()) {
  return { lease, data: await rpc('phase5_push_claim', [id, lease]) };
}
async function dueNow(id) {
  await query(
    "UPDATE push_outbox SET available_at = now() - interval '1 second', locked_until = now() - interval '1 second' WHERE id=$1",
    [id],
  );
}

before(async () => {
  db = new PGlite();
  await db.waitReady;
  await db.exec(readFileSync(join(__dirname, 'phase5-schema.sql'), 'utf8'));
  for (const file of [
    '2026-10-24-phase5-retention.sql',
    '2026-10-24-phase5-push.sql',
  ])
    await db.exec(readFileSync(join(__dirname, '../migrations', file), 'utf8'));
});
beforeEach(async () => {
  await db.exec('TRUNCATE profiles CASCADE');
  await query(
    "INSERT INTO profiles(uid,display_name) VALUES($1,'Reader'),($2,'Creator'),($3,'Other')",
    [A, B, C],
  );
});
after(async () => {
  await db?.close();
});

test('private collection read/write is owner-only; public read hides private items', async () => {
  const id = (
    await query(
      "INSERT INTO reader_collections(owner_uid,name) VALUES($1,'Weekend') RETURNING id",
      [A],
    )
  )[0].id;
  assert.equal(
    await rpc('phase5_collection_item', [B, id, 'manga-1', 'Secret', false]),
    false,
  );
  assert.equal(
    await rpc('phase5_collection_item', [A, id, 'manga-1', 'First', false]),
    true,
  );
  await rpc('phase5_collection_item', [A, id, 'manga-1', 'Renamed', false]);
  assert.equal(await rpc('phase5_collection', [id, null]), null);
  assert.equal(await rpc('phase5_collection', [id, B]), null);
  assert.equal((await rpc('phase5_collection', [id, A])).items.length, 1);
  await query("UPDATE reader_collections SET visibility='public' WHERE id=$1", [
    id,
  ]);
  assert.equal(
    (await rpc('phase5_collection', [id, null])).items[0].title,
    'Renamed',
  );
  await query(
    "UPDATE reader_collections SET visibility='private' WHERE id=$1",
    [id],
  );
  assert.equal(await rpc('phase5_collection', [id, null]), null);
  await query('DELETE FROM reader_collections WHERE id=$1', [id]);
  assert.equal(
    (await query('SELECT * FROM reader_collection_items')).length,
    0,
  );
});

test('collection quotas are enforced in PostgreSQL, including idempotent writes at the item limit', async () => {
  await query(
    "INSERT INTO reader_collections(owner_uid,name) SELECT $1,'List ' || n FROM generate_series(1,100) n",
    [A],
  );
  await assert.rejects(
    query("INSERT INTO reader_collections(owner_uid,name) VALUES($1,'Extra')", [
      A,
    ]),
    /limit reached/,
  );
  const id = (await query('SELECT id FROM reader_collections LIMIT 1'))[0].id;
  for (let i = 0; i < 200; i++)
    await rpc('phase5_collection_item', [A, id, `manga-${i}`, 'Manga', false]);
  await assert.rejects(
    rpc('phase5_collection_item', [A, id, 'manga-extra', 'Manga', false]),
    /limit reached/,
  );
  assert.equal(
    await rpc('phase5_collection_item', [A, id, 'manga-0', 'Updated', false]),
    true,
  );
  await rpc('phase5_collection_item', [A, id, 'manga-0', 'Updated', true]);
  assert.equal(
    await rpc('phase5_collection_item', [A, id, 'manga-extra', 'Manga', false]),
    true,
  );
});

test('anonymous/authenticated database clients cannot read private tables or invoke server RPCs', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    try {
      await assert.rejects(
        query('SELECT * FROM reader_collections'),
        /permission denied/,
      );
      await assert.rejects(
        query('SELECT * FROM push_devices'),
        /permission denied/,
      );
      await assert.rejects(
        rpc('phase5_feed', [A, 'personalized', 20, 0]),
        /permission denied/,
      );
      await assert.rejects(
        rpc('phase5_push_register', [A, 'd', 'ExpoPushToken[x]', 'android']),
        /permission denied/,
      );
    } finally {
      await db.exec('RESET ROLE');
    }
  }
});

test('following is chronological, excludes strangers/deleted posts, and keeps vote/comment context', async () => {
  await query(
    'INSERT INTO user_follows(follower_uid,following_uid) VALUES($1,$2)',
    [A, B],
  );
  const old = (
    await query(
      "INSERT INTO forum_posts(author_uid,title,created_at,upvotes) VALUES($1,'Old',now()-interval '1 day',100) RETURNING id",
      [B],
    )
  )[0].id;
  const recent = (
    await query(
      "INSERT INTO forum_posts(author_uid,title) VALUES($1,'Recent') RETURNING id",
      [B],
    )
  )[0].id;
  await query(
    "INSERT INTO forum_posts(author_uid,title,deleted_at) VALUES($1,'Deleted',now())",
    [B],
  );
  await query(
    "INSERT INTO forum_posts(author_uid,title) VALUES($1,'Stranger')",
    [C],
  );
  await query("INSERT INTO forum_votes VALUES($1,'post',$2,1)", [A, recent]);
  await query(
    'INSERT INTO forum_comments(post_id,deleted_at) VALUES($1,null),($1,now())',
    [recent],
  );
  const result = await rpc('phase5_feed', [A, 'following', 20, 0]);
  assert.equal(result.total, 2);
  assert.deepEqual(
    result.items.map((item) => item.id),
    [recent, old],
  );
  assert.equal(result.items[0].commentCount, 1);
  assert.equal(result.items[0].userVote, 1);
  await query('DELETE FROM user_follows WHERE follower_uid=$1', [A]);
  assert.equal((await rpc('phase5_feed', [A, 'following', 20, 0])).total, 0);
});

test('personalized ranks across the whole dataset before paging and uses only the caller interests', async () => {
  await query("INSERT INTO user_history VALUES($1,'interesting')", [A]);
  await query("INSERT INTO user_favorites VALUES($1,'unrelated')", [B]);
  await query(
    "INSERT INTO forum_posts(author_uid,title,target_manga_id,created_at) VALUES($1,'Your interest','interesting',now()-interval '1 hour'),($1,'Others interest','unrelated',now())",
    [C],
  );
  const first = await rpc('phase5_feed', [A, 'personalized', 1, 0]);
  const second = await rpc('phase5_feed', [A, 'personalized', 1, 1]);
  assert.equal(first.total, 2);
  assert.equal(first.items[0].title, 'Your interest');
  assert.equal(second.items[0].title, 'Others interest');
  assert.equal(
    (await rpc('phase5_feed', [B, 'personalized', 1, 0])).items[0].title,
    'Others interest',
  );
});

test('device swaps are unique and stale owner/token cleanup cannot remove a new binding', async () => {
  await register(A);
  const old = (await query('SELECT * FROM push_devices'))[0];
  await register(A);
  assert.equal(
    (await query('SELECT * FROM push_devices'))[0].binding_id,
    old.binding_id,
  );
  await register(B);
  await query(
    'DELETE FROM push_devices WHERE device_id=$1 AND uid=$2 AND token=$3',
    ['device-1', A, old.token],
  );
  assert.equal((await query('SELECT * FROM push_devices'))[0].uid, B);
  await register(B, 'device-2');
  assert.equal((await query('SELECT * FROM push_devices')).length, 1);
});

test('new follow and chapter publish create inbox and outbox atomically; retries do not duplicate them', async () => {
  await register(B);
  await query(
    'INSERT INTO user_follows(follower_uid,following_uid) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [A, B],
  );
  await query(
    'INSERT INTO user_follows(follower_uid,following_uid) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [A, B],
  );
  assert.equal(
    (await query("SELECT * FROM notifications WHERE type='new_follower'"))
      .length,
    1,
  );
  await query("INSERT INTO series_follows VALUES($1,'manga-1')", [B]);
  const id = (
    await query(
      "INSERT INTO chapter_versions(title_id,translator_uid,status) VALUES('manga-1',$1,'draft') RETURNING version_id",
      [C],
    )
  )[0].version_id;
  await query(
    "UPDATE chapter_versions SET status='published' WHERE version_id=$1",
    [id],
  );
  await query(
    "UPDATE chapter_versions SET status='approved' WHERE version_id=$1",
    [id],
  );
  assert.equal(
    (await query("SELECT * FROM notifications WHERE type='new_chapter'"))
      .length,
    1,
  );
  assert.equal((await query('SELECT * FROM push_outbox')).length, 2);
  await db.exec('BEGIN');
  await notify();
  await db.exec('ROLLBACK');
  assert.equal((await query('SELECT * FROM push_outbox')).length, 2);
});

test('only one worker can claim; an expired lease is recoverable and stale acknowledgements are ignored', async () => {
  await register();
  await notify();
  const row = await job();
  const one = await claim(row.id);
  assert.ok(one.data);
  assert.equal((await claim(row.id)).data, null);
  await dueNow(row.id);
  const two = await claim(row.id);
  assert.ok(two.data);
  assert.equal(
    await rpc('phase5_push_finish', [row.id, one.lease, 'delivered', null]),
    'stale',
  );
  assert.equal(
    await rpc('phase5_push_finish', [row.id, two.lease, 'delivered', null]),
    'delivered',
  );
});

test('account swaps and preferences are rechecked after queueing', async () => {
  await register();
  await notify();
  let row = await job();
  await register(C);
  assert.equal((await claim(row.id)).data, null);
  assert.equal((await job()).state, 'skipped');
  await register();
  await notify();
  row = (await query("SELECT * FROM push_outbox WHERE state='ready'"))[0];
  await query('INSERT INTO push_preferences VALUES($1,false,true)', [B]);
  assert.equal((await claim(row.id)).data, null);
  assert.equal(
    (await query("SELECT * FROM push_outbox WHERE state='ready'")).length,
    0,
  );
});

test('retry budget ends in dead-letter, tickets schedule receipts and invalid tokens are removed', async () => {
  await register();
  await notify();
  let row = await job();
  for (let i = 0; i < 5; i++) {
    const claimed = await claim(row.id);
    assert.ok(claimed.data);
    assert.equal(
      await rpc('phase5_push_finish', [row.id, claimed.lease, 'retry', null]),
      i === 4 ? 'dead' : 'ready',
    );
    await dueNow(row.id);
  }
  await notify();
  row = (await query("SELECT * FROM push_outbox WHERE state='ready'"))[0];
  const sent = await claim(row.id);
  await rpc('phase5_push_finish', [row.id, sent.lease, 'ticket', 'receipt-1']);
  assert.equal((await claim(row.id)).data, null);
  await dueNow(row.id);
  const receipt = await claim(row.id);
  assert.equal(receipt.data.phase, 'receipt');
  assert.equal(receipt.data.ticket_id, 'receipt-1');
  await rpc('phase5_push_finish', [row.id, receipt.lease, 'invalid', null]);
  assert.equal((await query('SELECT * FROM push_devices')).length, 0);
});

test('an old receipt cannot revoke a token belonging to a newer account', async () => {
  await register();
  await notify();
  const row = await job();
  const sent = await claim(row.id);
  await register(C);
  await rpc('phase5_push_finish', [row.id, sent.lease, 'invalid', null]);
  assert.equal((await query('SELECT * FROM push_devices'))[0].uid, C);
});
