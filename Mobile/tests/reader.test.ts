import test from "node:test";
import assert from "node:assert/strict";
import { createReader } from "../src/reader.ts";
import { fixture } from "./support/auth.ts";

const chapter = {
  id: "chapter-1",
  chapterNumber: "1",
  title: "เริ่มต้น",
  translatedLanguage: "ja",
};
test("chapter navigation preserves reading mode direction and zoom while resetting page position", async () => {
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "native-test",
    fetch: async () =>
      Response.json({ pages: ["/one.png", "/two.png"], dataSaverPages: [] }),
  });
  await reader.open("manga-1", chapter);
  reader.setPosition({
    mode: "single",
    direction: "rtl",
    zoom: 1.5,
    pageIndex: 1,
  });
  reader.close();
  await reader.open("manga-1", {
    ...chapter,
    id: "chapter-2",
    chapterNumber: "2",
  });
  assert.deepEqual(reader.snapshot().position, {
    mode: "single",
    direction: "rtl",
    zoom: 1.5,
    pageIndex: 0,
  });
});

test("a reader opens a MangaDex chapter using the existing Backend pages contract", async () => {
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (
      url.pathname === "/books/chapters/chapter-1/pages" &&
      url.searchParams.get("mangaId") === "manga-1" &&
      new Headers(init?.headers).get("x-hardware-id") === "mdock_native_test"
    )
      return Response.json({
        pages: [
          "https://images.example.test/1.jpg",
          "https://images.example.test/2.jpg",
        ],
        dataSaverPages: [],
      });
    return Response.json({}, { status: 404 });
  };
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch,
  });
  await reader.open("manga-1", chapter);
  assert.equal(reader.snapshot().status, "ready");
  assert.deepEqual(reader.snapshot().pages, [
    "https://images.example.test/1.jpg",
    "https://images.example.test/2.jpg",
  ]);
});

test("a chapter with no page images cannot become a ready Reader", async () => {
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: async () => Response.json({ pages: [], dataSaverPages: [] }),
  });

  await assert.rejects(reader.open("manga-1", chapter), Error);
  assert.notEqual(reader.snapshot().status, "ready");
  assert.deepEqual(reader.snapshot().pages, []);
});

test("a published Studio chapter with no page images cannot become a ready Reader", async () => {
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: async () => Response.json({ pages: [], priceCoins: 0 }),
  });

  await assert.rejects(
    reader.open("manga-1", { ...chapter, id: "ver:version-1" }),
    Error,
  );
  assert.notEqual(reader.snapshot().status, "ready");
  assert.deepEqual(reader.snapshot().pages, []);
});

test("a protected chapter returns the reader to the captcha gate instead of exposing pages", async () => {
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: async () =>
      Response.json(
        { message: "Captcha clearance token is missing." },
        { status: 401 },
      ),
  });
  await reader.open("manga-1", chapter);
  assert.deepEqual(reader.snapshot(), {
    status: "captchaRequired",
    chapter,
    mangaId: "manga-1",
    pages: [],
  });
});

test("browser captcha returns to its native callback and the Backend clearance opens the chapter", async () => {
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (
      url.pathname === "/books/verify-captcha" &&
      JSON.parse(String(init?.body)).token === "turnstile-test-token"
    )
      return Response.json({ clearanceToken: "server-clearance" });
    if (
      new Headers(init?.headers).get("x-captcha-clearance") !==
      "server-clearance"
    )
      return Response.json({}, { status: 401 });
    return Response.json({
      pages: ["https://images.example.test/1.jpg"],
      dataSaverPages: [],
    });
  };
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch,
    captcha: {
      url: "https://captcha.example.test/native.html",
      randomState: () => "request-1",
      open: async (url, redirect) => {
        assert.equal(new URL(url).searchParams.get("state"), "request-1");
        assert.equal(redirect, "mangadock://captcha/callback");
        return {
          type: "success",
          url: `${redirect}?state=request-1&token=turnstile-test-token`,
        };
      },
    },
  });
  await reader.open("manga-1", chapter);
  await reader.verifyCaptcha();
  assert.equal(reader.snapshot().status, "ready");
  assert.deepEqual(reader.snapshot().pages, [
    "https://images.example.test/1.jpg",
  ]);
});

test("captcha rejects a browser result belonging to another native request", async () => {
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: async (input) =>
      String(input).includes("verify-captcha")
        ? Response.json({ clearanceToken: "badly-accepted" })
        : Response.json({}, { status: 401 }),
    captcha: {
      url: "https://captcha.example.test/native.html",
      randomState: () => "current-request",
      open: async () => ({
        type: "success",
        url: "mangadock://captcha/callback?state=old-request&token=stale-token",
      }),
    },
  });
  await reader.open("manga-1", chapter);
  await assert.rejects(reader.verifyCaptcha(), /คำขอ|callback/);
  assert.equal(reader.snapshot().status, "captchaRequired");
});

test("the OAuth callback cannot deliver a captcha result even with the correct request state", async () => {
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: async (input) =>
      String(input).includes("verify-captcha")
        ? Response.json({ clearanceToken: "badly-accepted" })
        : Response.json({}, { status: 401 }),
    captcha: {
      url: "https://captcha.example.test/native.html",
      randomState: () => "current-request",
      open: async () => ({
        type: "success",
        url: "mangadock://auth/callback?state=current-request&token=bad-token",
      }),
    },
  });
  await reader.open("manga-1", chapter);
  await assert.rejects(reader.verifyCaptcha(), /callback/);
  assert.equal(reader.snapshot().status, "captchaRequired");
});

test("a captcha result expires while the browser is open and cannot grant clearance", async () => {
  let time = 1000;
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: async (input) =>
      String(input).includes("verify-captcha")
        ? Response.json({ clearanceToken: "badly-accepted" })
        : Response.json({}, { status: 401 }),
    captcha: {
      url: "https://captcha.example.test/native.html",
      randomState: () => "current-request",
      now: () => time,
      open: async () => {
        time += 300001;
        return {
          type: "success",
          url: "mangadock://captcha/callback?state=current-request&token=expired-token",
        };
      },
    },
  });
  await reader.open("manga-1", chapter);
  await assert.rejects(reader.verifyCaptcha(), /หมดอายุ/);
  assert.equal(reader.snapshot().status, "captchaRequired");
});

test("closing the Reader before a slow page response prevents it reopening", async () => {
  let release!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: async () => response,
  });
  const open = reader.open("manga-1", chapter);
  reader.close();
  release(Response.json({ pages: ["https://images.example.test/1.jpg"] }));
  await open;
  assert.deepEqual(reader.snapshot(), {
    status: "closed",
    chapter: null,
    mangaId: null,
    pages: [],
  });
});

test("native Reader navigation observes chapter load and return to details", async () => {
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: async () =>
      Response.json({ pages: ["https://images.example.test/1.jpg"] }),
  });
  const statuses: string[] = [];
  const unsubscribe = reader.subscribe(() =>
    statuses.push(reader.snapshot().status),
  );
  await reader.open("manga-1", chapter);
  reader.close();
  unsubscribe();
  assert.deepEqual(statuses, ["ready", "closed"]);
});

test("a captcha host must use HTTPS before the native app opens it", async () => {
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: async () => Response.json({}, { status: 401 }),
    captcha: {
      url: "http://captcha.example.test/native.html",
      randomState: () => "current-request",
      open: async () => ({
        type: "success",
        url: "mangadock://captcha/callback?state=current-request&token=token",
      }),
    },
  });
  await reader.open("manga-1", chapter);
  await assert.rejects(reader.verifyCaptcha(), /HTTPS/);
});

test("a published free Studio version opens through the existing version pages API", async () => {
  const versionChapter = {
    id: "ver:version-1",
    chapterNumber: "1",
    title: "ฉบับแปล",
    translatedLanguage: "th",
    priceCoins: 0,
  };
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: async (input) => {
      if (new URL(String(input)).pathname === "/versions/version-1")
        return Response.json({
          versionId: "version-1",
          status: "published",
          priceCoins: 0,
          pages: ["/uploads/chapters/version-1/1.jpg"],
        });
      return Response.json({}, { status: 404 });
    },
  });
  await reader.open("manga-1", versionChapter);
  assert.equal(reader.snapshot().status, "ready");
  assert.deepEqual(reader.snapshot().pages, [
    "/uploads/chapters/version-1/1.jpg",
  ]);
});

test("a paid Studio version keeps pages behind the native unlock gate", async () => {
  const versionChapter = {
    id: "ver:paid-version",
    chapterNumber: "1",
    title: "ฉบับแปล",
    translatedLanguage: "th",
    priceCoins: 0,
  };
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: async () =>
      Response.json({
        versionId: "paid-version",
        status: "published",
        priceCoins: 7,
        pages: ["/uploads/chapters/paid-version/1.jpg"],
      }),
  });
  await reader.open("manga-1", versionChapter);
  assert.equal(reader.snapshot().status, "unlockRequired");
  assert.equal(reader.snapshot().chapter?.priceCoins, 7);
  assert.deepEqual(reader.snapshot().pages, []);
});

test("an already purchased Studio version opens using the existing account entitlement", async () => {
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/versions/paid-version")
        return Response.json({
          versionId: "paid-version",
          status: "published",
          priceCoins: 7,
          pages: ["/uploads/chapters/paid-version/1.jpg"],
        });
      if (
        path === "/unlock/check/paid-version" &&
        new Headers(init?.headers).get("authorization")?.startsWith("Bearer ")
      )
        return Response.json({ unlocked: true });
      return Response.json({}, { status: 401 });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: auth.fetch,
    session: auth.app,
  });
  await reader.open("manga-1", {
    id: "ver:paid-version",
    chapterNumber: "1",
    title: "ฉบับแปล",
    translatedLanguage: "th",
  });
  assert.equal(reader.snapshot().status, "ready");
  assert.deepEqual(reader.snapshot().pages, [
    "/uploads/chapters/paid-version/1.jpg",
  ]);
});

test("a reader purchases a locked version and opens it after server entitlement confirmation", async () => {
  let unlocked = false;
  const auth = fixture({
    externalFetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/versions/paid-version")
        return Response.json({
          versionId: "paid-version",
          status: "published",
          priceCoins: 7,
          pages: ["/uploads/chapters/paid-version/1.jpg"],
        });
      if (
        !new Headers(init?.headers).get("authorization")?.startsWith("Bearer ")
      )
        return Response.json({}, { status: 401 });
      if (path === "/unlock/check/paid-version")
        return Response.json({ unlocked });
      if (path === "/unlock/paid-version" && init?.method === "POST") {
        unlocked = true;
        return Response.json({ unlocked: true, pricePaid: 7, balance: 13 });
      }
      return Response.json({}, { status: 404 });
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: auth.fetch,
    session: auth.app,
  });
  await reader.open("manga-1", {
    id: "ver:paid-version",
    chapterNumber: "1",
    title: "ฉบับแปล",
    translatedLanguage: "th",
  });
  await reader.unlock();
  assert.equal(reader.snapshot().status, "ready");
  assert.deepEqual(reader.snapshot().pages, [
    "/uploads/chapters/paid-version/1.jpg",
  ]);
});

test("HD and saver select matching cached byte sources without reloading the chapter", async () => {
  let requests = 0;
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: async () => {
      requests++;
      return Response.json({
        pages: ["https://remote/hd.jpg"],
        dataSaverPages: ["https://remote/saver.jpg"],
        localPages: ["/img-cache/hd.jpg"],
        localDataSaverPages: ["/img-cache/saver.jpg"],
      });
    },
  });
  await reader.open("manga-1", chapter);
  assert.deepEqual(reader.snapshot().pages, ["/img-cache/hd.jpg"]);
  reader.setDerivative("saver");
  assert.equal(reader.snapshot().derivative, "saver");
  assert.deepEqual(reader.snapshot().pages, ["/img-cache/saver.jpg"]);
  assert.equal(requests, 1);
});

test("repeated unlock taps purchase once and keep insufficient-balance errors actionable", async () => {
  let purchases = 0;
  const auth = fixture({
    externalFetch: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.startsWith("/versions/"))
        return Response.json({
          status: "published",
          priceCoins: 7,
          pages: ["/uploads/page.jpg"],
        });
      if (path.includes("/check/")) return Response.json({ unlocked: false });
      purchases++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return Response.json(
        { message: "Insufficient balance" },
        { status: 400 },
      );
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: auth.fetch,
    session: auth.app,
  });
  await reader.open("manga-1", { ...chapter, id: "ver:paid" });
  const results = await Promise.allSettled([reader.unlock(), reader.unlock()]);
  assert.equal(purchases, 1);
  assert.ok(
    results.every(
      (result) =>
        result.status === "rejected" &&
        /เหรียญไม่พอ/.test(result.reason.message),
    ),
  );
  assert.equal(reader.snapshot().status, "unlockRequired");
});

test("captcha recovery restores the same chapter page and image derivative", async () => {
  const reader = createReader({
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: async (input) =>
      String(input).includes("verify-captcha")
        ? Response.json({ clearanceToken: "new" })
        : Response.json({
            pages: ["hd1", "hd2"],
            dataSaverPages: ["saver1", "saver2"],
          }),
    captcha: {
      url: "https://captcha.example.test",
      randomState: () => "request",
      open: async () => ({
        type: "success",
        url: "mangadock://captcha/callback?state=request&token=test",
      }),
    },
  });
  await reader.open("manga-1", chapter);
  reader.setDerivative("saver");
  reader.setPosition({
    pageIndex: 1,
    mode: "double",
    direction: "rtl",
    zoom: 2,
  });
  reader.requireCaptcha();
  await reader.verifyCaptcha();
  assert.equal(reader.snapshot().position?.pageIndex, 1);
  assert.equal(reader.snapshot().position?.mode, "double");
  assert.equal(reader.snapshot().derivative, "saver");
  assert.deepEqual(reader.snapshot().pages, ["saver1", "saver2"]);
});
