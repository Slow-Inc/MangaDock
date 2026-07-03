import { test, expect } from "bun:test";
import { triggerDownload, type DownloadDeps } from "./download";

// A fake browser env that records the sequence of DOM ops, so we can assert the
// download mechanics without a real document (bun:test has no DOM).
function fakeEnv() {
  const calls: string[] = [];
  let anchor: { href: string; download: string; click(): void } | null = null;
  let revoked: string | null = null;
  let deferred: (() => void) | null = null;
  const deps: DownloadDeps = {
    document: {
      createElement: () => {
        anchor = { href: "", download: "", click: () => calls.push("click") };
        return anchor;
      },
      body: {
        appendChild: () => calls.push("append"),
        removeChild: () => calls.push("remove"),
      },
    },
    url: {
      createObjectURL: () => "blob:fake-url",
      revokeObjectURL: (u: string) => { revoked = u; },
    },
    defer: (fn: () => void) => { deferred = fn; },
  };
  return { deps, calls, get anchor() { return anchor; }, get revoked() { return revoked; }, runDeferred: () => deferred?.() };
}

test("appends the anchor, clicks it, then removes it — with the right filename + object URL", () => {
  const env = fakeEnv();
  triggerDownload({ filename: "mit-snapshot-x.json", content: "{}" }, env.deps);
  expect(env.calls).toEqual(["append", "click", "remove"]);
  expect(env.anchor?.download).toBe("mit-snapshot-x.json");
  expect(env.anchor?.href).toBe("blob:fake-url");
});

test("revokes the object URL only on the deferred tick — never synchronously (the #353 fix)", () => {
  const env = fakeEnv();
  triggerDownload({ filename: "x.json", content: "{}" }, env.deps);
  expect(env.revoked).toBeNull(); // not revoked during the call → can't cancel the in-flight download
  env.runDeferred();
  expect(env.revoked).toBe("blob:fake-url"); // revoked after the download has had a chance to start
});
