import test from "node:test";
import assert from "node:assert/strict";
import { createAccountApi } from "../src/backend.ts";
test("accepted backend account records its native device without making optional activity failures prevent login", async () => {
  for (const status of [200, 503]) {
    const requests: string[] = [];
    const api = createAccountApi({
      apiOrigin: "https://api.example.test",
      deviceId: "native-device",
      fetch: async (input, init) => {
        const path = new URL(String(input)).pathname;
        requests.push(path);
        assert.equal(
          new Headers(init?.headers).get("x-hardware-id"),
          "native-device",
        );
        if (path === "/users/me/record-device") {
          assert.equal(init?.method, "POST");
          return Response.json({ ok: true }, { status });
        }
        return Response.json(
          init?.method === "POST" ? { ok: true } : { uid: "reader-1" },
        );
      },
    });
    assert.equal((await api.loadAccount("token")).uid, "reader-1");
    assert.deepEqual(requests, [
      "/users/me",
      "/users/me",
      "/users/me/record-device",
    ]);
  }
});
