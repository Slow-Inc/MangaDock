import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createMedia } from "../src/media.ts";
test("native image uploads enforce the existing file limit and submit authenticated multipart without a JSON header", async () => {
  let requests = 0;
  const auth = fixture({
    externalFetch: async (input, init) => {
      assert.equal(new URL(String(input)).pathname, "/forum/upload-image");
      assert.ok(
        new Headers(init?.headers).get("authorization")?.startsWith("Bearer "),
      );
      assert.equal(new Headers(init?.headers).get("content-type"), null);
      assert.equal((init?.body as FormData).get("file") instanceof Blob, true);
      requests++;
      return Response.json({ imageUrl: "/uploads/post.png" });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const media = createMedia({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: auth.fetch,
    session: auth.app,
  });
  await assert.rejects(
    media.upload("forum/upload-image", {
      blob: new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], {
        type: "image/png",
      }),
      name: "large.png",
    }),
  );
  assert.equal(requests, 0);
  assert.deepEqual(
    await media.upload("forum/upload-image", {
      blob: new Blob(["image"], { type: "image/png" }),
      name: "post.png",
    }),
    { imageUrl: "/uploads/post.png" },
  );
  media.dispose();
});
