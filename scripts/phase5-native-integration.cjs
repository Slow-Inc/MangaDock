// Node 26; real Mobile session/controller -> HTTP -> Nest -> migration SQL.
// Only Auth/catalog infrastructure and external providers are QA boundaries.
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { join } = require("node:path");
const { preview } = require("./phase5-native-preview.cjs");
async function main() {
  const mobileRequire = createRequire(
    join(__dirname, "../Mobile/package.json"),
  );
  const { createClient } = mobileRequire("@supabase/supabase-js");
  const { createMobileSession } = await import("../Mobile/src/session.ts");
  const { createRetention } = await import("../Mobile/src/retention.ts");
  const run = await preview(0);
  const make = () => {
    const supabase = createClient(run.origin, "native-qa-public-key", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const options = {
      apiOrigin: run.origin,
      deviceId: "native-retention-qa",
      fetch,
      supabase,
    };
    const session = createMobileSession(options);
    return { session, retention: createRetention({ ...options, session }) };
  };
  const owner = make(),
    guest = make();
  try {
    await owner.session.signIn(
      "native-qa@example.test",
      "synthetic-qa-password",
    );
    assert.equal(owner.session.snapshot().status, "signedIn");
    await owner.retention.list();
    assert.equal(owner.retention.snapshot().collections[0].id, run.publicId);
    assert.equal(
      await owner.retention.save({
        name: "Native integration",
        description: "isolated QA",
        visibility: "private",
      }),
      true,
    );
    const id = owner.retention.snapshot().id;
    await guest.retention.open(id);
    assert.equal(guest.retention.snapshot().detail, null);
    assert.ok(guest.retention.snapshot().detailError);
    await owner.retention.search("manga");
    const book = owner.retention.snapshot().results[0];
    assert.equal(await owner.retention.item(book), true);
    assert.equal(
      await owner.retention.save(
        { name: "Native public", description: "", visibility: "public" },
        id,
      ),
      true,
    );
    await guest.retention.open(id);
    assert.equal(
      guest.retention.snapshot().detail.items[0].manga_id,
      "manga-1",
    );
    await owner.retention.open(id);
    assert.equal(owner.retention.snapshot().detail.items.length, 1);
    await owner.retention.feed("following");
    assert.equal(
      owner.retention.snapshot().feed.items[0].title,
      "ตอนใหม่มาแล้ว",
    );
    await owner.retention.feed("personalized");
    assert.equal(owner.retention.snapshot().feed.items.length, 1);
    await owner.retention.save(
      { name: "Native private", description: "", visibility: "private" },
      id,
    );
    await guest.retention.open(id);
    assert.equal(guest.retention.snapshot().detail, null);
    await owner.retention.item(book, true);
    assert.equal(owner.retention.snapshot().detail.items.length, 0);
    await owner.retention.remove();
    const check = await run.db.query(
      "SELECT count(*)::int AS count FROM reader_collections WHERE id=$1",
      [id],
    );
    assert.equal(check.rows[0].count, 0);
    await owner.session.signOut();
    assert.equal(owner.retention.snapshot().collections.length, 0);
    assert.equal(owner.retention.snapshot().feed.items.length, 0);
    console.log(
      "PASS: Native session, collections CRUD/items/search, guest privacy/revocation, both feeds and logout through real HTTP/Nest/PostgreSQL.",
    );
  } finally {
    for (const client of [owner, guest]) {
      client.retention.dispose();
      client.session.dispose();
    }
    await run.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
