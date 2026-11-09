import test from "node:test";
import assert from "node:assert/strict";
import { retryPushHandshake } from "./hybridPushTransport";

test("a transient handshake failure retries using the current account", async () => {
  let owner = "reader-a";
  let calls = 0;
  const result = await retryPushHandshake(async () => {
    calls++;
    if (calls === 1) {
      owner = "reader-b";
      throw new Error("Document changed during connect");
    }
    return owner;
  }, () => false);
  assert.equal(result, "reader-b");
  assert.equal(calls, 2);
});

test("persistent handshake failure stops after three attempts", async () => {
  let calls = 0;
  const failure = new Error("Native host unavailable");
  await assert.rejects(retryPushHandshake(async () => {
    calls++;
    throw failure;
  }, () => false), failure);
  assert.equal(calls, 3);
});

test("disposing during handshake backoff prevents further native requests", async () => {
  let disposed = false;
  let calls = 0;
  const closing = setTimeout(() => { disposed = true; }, 5);
  try {
    await assert.rejects(retryPushHandshake(async () => {
      calls++;
      throw new Error("Document is loading");
    }, () => disposed));
    assert.equal(calls, 1);
  } finally {
    clearTimeout(closing);
  }
});
