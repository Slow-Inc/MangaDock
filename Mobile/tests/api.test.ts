import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../src/api.ts";
test("successful empty and whitespace bodies represent an absent optional resource", async () => {
  for (const response of [
    new Response(null),
    new Response("  \n"),
    new Response(null, { status: 204 }),
  ]) {
    const api = createApi({
      apiOrigin: "https://api.example.test",
      deviceId: "native",
      fetch: async () => response,
    });
    assert.equal(await api.json("reviews/book/my"), null);
  }
});
test("a malformed nonempty success is still an actionable error rather than an absent review", async () => {
  const api = createApi({
    apiOrigin: "https://api.example.test",
    deviceId: "native",
    fetch: async () => new Response("{broken"),
  });
  await assert.rejects(api.json("reviews/book/my"), /ข้อมูล.*ไม่ถูกต้อง/);
});
test("multipart uploads leave boundary generation to fetch while JSON and explicit content types retain their headers", async () => {
  const types: (string | null)[] = [];
  const api = createApi({
    apiOrigin: "https://api.example.test",
    deviceId: "native",
    fetch: async (input, init) => {
      types.push(new Headers(init?.headers).get("content-type"));
      return Response.json({ ok: true });
    },
  });
  const multipart = new FormData();
  multipart.append(
    "file",
    new Blob(["image"], { type: "image/png" }),
    "image.png",
  );
  await api.request("forum/upload-image", { method: "POST", body: multipart });
  await api.request("forum/posts", {
    method: "POST",
    body: JSON.stringify({ title: "Title" }),
  });
  await api.request("file", {
    method: "POST",
    body: new Blob(["file"]),
    headers: { "content-type": "image/png" },
  });
  assert.deepEqual(types, [null, "application/json", "image/png"]);
});
