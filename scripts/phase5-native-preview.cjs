// Isolated native QA: real retention controllers/migrations in PGlite, synthetic
// Auth/catalog boundaries. Loopback only; never uses developer service settings.
const http = require("node:http");
const {
  application,
  token,
  A,
  B,
} = require("../Backend/test/phase5-fixture.cjs");
async function preview(port = 4017) {
  const data = await application();
  await data.app.listen(0, "127.0.0.1");
  const origin = await data.app.getUrl();
  await data.db.query(
    "INSERT INTO user_follows(follower_uid,following_uid) VALUES($1,$2)",
    [A, B],
  );
  await data.db.query(
    "INSERT INTO forum_posts(author_uid,title,content,target_manga_id,target_manga_title) VALUES($1,'ตอนใหม่มาแล้ว','เรื่องที่ติดตามกลับมาอัปเดตแล้ว','manga-1','เรื่องที่อยากอ่านต่อ')",
    [B],
  );
  const seeded = await data.db.query(
    "INSERT INTO reader_collections(owner_uid,name,description,visibility) VALUES($1,'อ่านวันหยุด','รวมเรื่องที่อยากกลับมาอ่านต่อ','public') RETURNING id",
    [A],
  );
  const publicId = seeded.rows[0].id;
  await data.db.query(
    "INSERT INTO reader_collection_items(collection_id,manga_id,title) VALUES($1,'manga-1','เรื่องที่อยากอ่านต่อ')",
    [publicId],
  );
  const user = {
    id: A,
    aud: "authenticated",
    role: "authenticated",
    email: "native-qa@example.test",
    created_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { display_name: "Native QA" },
    factors: [],
    identities: [],
  };
  const account = {
    uid: A,
    email: user.email,
    displayName: "Native QA",
    photoURL: null,
    role: 0,
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    const json = (value, status = 200) => {
      res.statusCode = status;
      res.end(JSON.stringify(value));
    };
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    try {
      if (url.pathname === "/auth/v1/token")
        return json({
          access_token: token(A),
          refresh_token: "native-qa-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user,
        });
      if (url.pathname === "/auth/v1/user") return json(user);
      if (
        url.pathname === "/auth/v1/logout" ||
        url.pathname === "/users/me/record-device"
      )
        return json({ ok: true });
      if (url.pathname === "/users/me") return json(account);
      if (url.pathname === "/books/landing")
        return json({
          hero: [],
          top10: [],
          newReleases: [],
          rows: [],
          updatedAt: "",
        });
      if (url.pathname === "/books/search")
        return json({
          items: [
            {
              id: "manga-1",
              title: "เรื่องที่อยากอ่านต่อ",
              thumbnail: "",
              authors: [],
              categories: [],
            },
          ],
          total: 1,
        });
      if (url.pathname === "/books/manga/manga-1")
        return json({
          id: "manga-1",
          title: "เรื่องที่อยากอ่านต่อ",
          authors: [],
          genres: [],
          covers: [],
          description: "ข้อมูลมังงะสำหรับทดสอบ Native Collections",
        });
      if (/^\/forum\/posts\/[A-Za-z0-9-]+$/.test(url.pathname)) {
        const posts = await data.db.query(
          'SELECT id,title,content,author_uid AS "authorUid",target_manga_id AS "targetMangaId",target_manga_title AS "targetMangaTitle",category,upvotes,downvotes,created_at AS "createdAt" FROM forum_posts WHERE id=$1',
          [url.pathname.split("/").at(-1)],
        );
        return json({
          ...posts.rows[0],
          authorName: "Creator",
          imageUrls: [],
          userVote: 0,
          commentCount: 0,
        });
      }
      if (url.pathname === "/forum/posts") return json({ items: [], total: 0 });
      if (url.pathname.endsWith("/stream")) {
        res.setHeader("Content-Type", "text/event-stream");
        res.end();
        return;
      }
      if (url.pathname === "/feed" || url.pathname.startsWith("/collections")) {
        const response = await fetch(origin + url.pathname + url.search, {
          method: req.method,
          headers: {
            ...(req.headers.authorization
              ? { Authorization: req.headers.authorization }
              : {}),
            "Content-Type": "application/json",
          },
          ...(body.length ? { body } : {}),
        });
        res.statusCode = response.status;
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      if (url.pathname.includes("unread-count")) return json({ count: 0 });
      if (url.pathname.includes("wallet") || url.pathname.includes("balance"))
        return json({ balance: 0 });
      if (url.pathname.endsWith("/summary"))
        return json({ averageRating: 0, count: 0 });
      if (url.pathname.endsWith("/my")) {
        res.statusCode = 204;
        res.end();
        return;
      }
      return json([]);
    } catch {
      json({ message: "Isolated QA request failed" }, 500);
    }
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    ...data,
    publicId,
    origin: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await data.app.close();
      await data.db.close();
    },
  };
}
module.exports = { preview };
if (require.main === module)
  void preview().then((run) => {
    console.log(
      JSON.stringify({ origin: run.origin, publicCollection: run.publicId }),
    );
    for (const signal of ["SIGINT", "SIGTERM"])
      process.on(signal, async () => {
        await run.close();
        process.exit(0);
      });
  });
