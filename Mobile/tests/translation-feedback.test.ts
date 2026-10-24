import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createTranslationFeedback } from "../src/translation-feedback.ts";
test("native translation quality votes use one-based pages and toggle off only after acknowledged server deletion", async () => {
  let vote: number | null = null,
    denied = false;
  const bodies: unknown[] = [];
  const auth = fixture({
    externalFetch: async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        bodies.push(body);
        vote = body.vote;
        return new Response(null, { status: 204 });
      }
      assert.equal(url.searchParams.get("page"), "3");
      if (init?.method === "DELETE") {
        if (denied) return Response.json({}, { status: 403 });
        vote = null;
        return new Response(null, { status: 204 });
      }
      return Response.json(vote === null ? null : { pageNumber: 3, vote });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const feedback = createTranslationFeedback({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: auth.fetch,
    session: auth.app,
  });
  await feedback.select({
    mangaId: "manga-1",
    chapterId: "chapter-1",
    pageNumber: 3,
  });
  await feedback.vote(1);
  assert.equal(feedback.snapshot().vote, 1);
  assert.deepEqual(bodies, [
    { mangaId: "manga-1", chapterId: "chapter-1", pageNumber: 3, vote: 1 },
  ]);
  denied = true;
  await assert.rejects(feedback.vote(1));
  assert.equal(feedback.snapshot().vote, 1);
  denied = false;
  await feedback.vote(1);
  assert.equal(feedback.snapshot().vote, null);
  feedback.dispose();
});
