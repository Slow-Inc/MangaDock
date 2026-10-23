// Local-only preview backend. It uses actual Nest controllers/services and the
// isolated PostgreSQL fixture. Never exposes developer credentials or sends push.
const { application, A, B } = require('./phase5-fixture.cjs');
(async () => {
  const data = await application();
  await data.db.query(
    'INSERT INTO user_follows(follower_uid,following_uid) VALUES($1,$2)',
    [A, B],
  );
  await data.db.query("INSERT INTO user_history VALUES($1,'manga-1')", [A]);
  await data.db.query(
    "INSERT INTO forum_posts(author_uid,title,content,target_manga_id,target_manga_title) VALUES($1,'ตอนใหม่มาแล้ว','กลับมาพบกันอีกครั้งในตอนล่าสุด','manga-1','เรื่องที่อยากอ่านต่อ')",
    [B],
  );
  await data.app.listen(4015, '127.0.0.1');
  console.log('Phase 5 isolated preview ready on 127.0.0.1:4015');
  const close = async () => {
    await data.app.close();
    await data.db.close();
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
})();
