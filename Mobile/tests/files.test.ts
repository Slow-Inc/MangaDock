import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./support/auth.ts";
import { createPersonal } from "../src/personal.ts";
import { shareHistoryCSV } from "../src/files.ts";

test("native history export writes the authenticated server CSV to an app file and opens the OS sharing surface", async () => {
  const csv = "title,last_page\nbook,7\n";
  const auth = fixture({ externalFetch: async () => new Response(csv) });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: auth.fetch,
    session: auth.app,
  });
  const written: string[] = [];
  const shared: string[] = [];
  const result = await shareHistoryCSV({
    personal,
    isCurrent: () => true,
    createFile: async (text) => {
      written.push(text);
      return { uri: "file:///app/cache/history.csv", remove() {} };
    },
    share: async (uri) => {
      shared.push(uri);
    },
  });
  assert.equal(result, true);
  assert.deepEqual(written, [csv]);
  assert.deepEqual(shared, ["file:///app/cache/history.csv"]);
});

test("leaving the owner screen during native file creation removes that file and prevents a late share sheet", async () => {
  const auth = fixture({
    externalFetch: async () => new Response("private-history"),
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: auth.fetch,
    session: auth.app,
  });
  let active = true;
  let release!: () => void;
  let removed = false;
  let shared = false;
  const exporting = shareHistoryCSV({
    personal,
    isCurrent: () => active,
    createFile: async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return {
        uri: "file:///app/cache/history.csv",
        remove() {
          removed = true;
        },
      };
    },
    share: async () => {
      shared = true;
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  active = false;
  release();
  assert.equal(await exporting, false);
  assert.equal(shared, false);
  assert.equal(removed, true);
});

test("an OS sharing failure removes the unused private CSV file and remains a visible failure", async () => {
  const auth = fixture({
    externalFetch: async () => new Response("private-history"),
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const personal = createPersonal({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: auth.fetch,
    session: auth.app,
  });
  let removed = false;
  await assert.rejects(
    shareHistoryCSV({
      personal,
      isCurrent: () => true,
      createFile: async () => ({
        uri: "file:///app/cache/history.csv",
        remove() {
          removed = true;
        },
      }),
      share: async () => {
        throw new Error("OS sharing unavailable");
      },
    }),
    /OS sharing unavailable/,
  );
  assert.equal(removed, true);
});
