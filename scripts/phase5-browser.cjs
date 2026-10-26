// npm install --no-save --package-lock=false playwright in a separate tools dir,
// then set PLAYWRIGHT_MODULE to that module directory. Never uses a real session.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const assert = require("node:assert/strict");
const { token, A } = require("../Backend/test/phase5-fixture.cjs");
const WEB = process.env.PHASE5_WEB_URL || "http://127.0.0.1:4016";
const API = process.env.PHASE5_API_URL || "http://127.0.0.1:4015";
if ([WEB, API].some((url) => new URL(url).hostname !== "127.0.0.1"))
  throw new Error("Phase 5 test only permits loopback origins");
const output = process.env.PHASE5_QA_OUTPUT || join(__dirname, "../docs/reports/phase5-2026-10-24");
mkdirSync(output, { recursive: true });
const results = [];
const fakeUser = {
  id: A,
  aud: "authenticated",
  role: "authenticated",
  email: "phase5@example.test",
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { display_name: "Reader" },
  identities: [],
};
async function context(browser, width, signedIn = true, hybrid = false) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await context.addInitScript(
    ({ session, signedIn, webOrigin }) => {
      if (location.origin !== webOrigin) return;
      localStorage.setItem(
        "mangadock_checkin_date",
        new Date().toISOString().slice(0, 10),
      );
      if (signedIn)
        localStorage.setItem("sb-phase5-auth-token", JSON.stringify(session));
    },
    {
      webOrigin: WEB,
      signedIn,
      session: {
        access_token: token(),
        token_type: "bearer",
        refresh_token: "phase5-fake",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: fakeUser,
      },
    },
  );
  await context.route("https://phase5.supabase.co/**", (route) =>
    route.fulfill({
      json: route.request().url().includes("/auth/v1/user") ? fakeUser : [],
    }),
  );
  const errors = [];
  if (hybrid) await context.addInitScript(() => {
    window.__MANGA_DOCK_PUSH_ENABLED__ = true;
    const qa = window.__pushQA = {commands: [], allowed: false, token: "ExponentPushToken[hybrid-qa]", owner: null};
    window.ReactNativeWebView = {postMessage(serialized) {
      const message = JSON.parse(serialized);
      if (message.type !== "push_request") return;
      qa.commands.push(message.action);
      if (message.action === "session") qa.owner = message.uid;
      const result = message.action === "connect" ? {deviceId: "hybrid-qa-device"} : message.action === "permission" ? qa.allowed : message.action === "token" ? qa.token : null;
      queueMicrotask(() => window.dispatchEvent(new CustomEvent("mangadock:push", {detail: {id: message.id, ok: true, result}})));
    }};
  });
  context.on("page", (page) =>
    page.on("pageerror", (error) => errors.push(error.message)),
  );
  await context.route(`${WEB}/api/proxy/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/proxy/", "");
    if (
      path === "feed" ||
      path.startsWith("collections") ||
      path.startsWith("notifications/push-")
    ) {
      if (process.env.PHASE5_USE_PROXY === "true") return route.continue();
      const response = await fetch(
        `${API}/${path}${new URL(request.url()).search}`,
        {
          method: request.method(),
          headers: {
            "Content-Type": "application/json",
            ...(request.headers()["x-hardware-id"] ? {"x-hardware-id": request.headers()["x-hardware-id"]} : {}),
            ...(request.headers()["x-manga-dock-client"] ? {"x-manga-dock-client": request.headers()["x-manga-dock-client"]} : {}),
            ...(request.headers().authorization
              ? { Authorization: request.headers().authorization }
              : {}),
          },
          body: ["GET", "HEAD"].includes(request.method())
            ? undefined
            : request.postData(),
        },
      );
      if (path.startsWith("notifications/push-") && !response.ok)
        console.error("Push API QA", request.method(), path, response.status, await response.clone().text());
      return route.fulfill({
        status: response.status,
        body: await response.text(),
        headers: { "Content-Type": "application/json" },
      });
    }
    if (path === "books/search")
      return route.fulfill({
        json: {
          items: [
            {
              id: "manga-1",
              title: "เรื่องที่อยากอ่านต่อ",
              thumbnail: "/api/phase5-cover",
              authors: ["Creator"],
            },
          ],
          total: 1,
        },
      });
    const json =
      path === "users/me"
        ? { uid: A, displayName: "Reader", role: 0 }
        : path === "wallet/balance"
          ? { balance: 0 }
          : path === "notifications/unread-count"
            ? { count: 0 }
            : path === "checkin/status"
              ? { checkedInToday: true }
              : [];
    return route.fulfill({ json });
  });
  await context.route(`${WEB}/_next/image*`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120"><rect width="80" height="120" fill="#333"/></svg>',
    }),
  );
  return { context, errors };
}
async function visible(page, locator) {
  try { await locator.waitFor({ state: "visible", timeout: 15000 }); }
  catch (error) {
    await page.screenshot({path: join(output, 'qa-failure.png'), fullPage: true});
    console.error(JSON.stringify(await page.evaluate(() => ({url: location.pathname, text: document.body.innerText.slice(-1800), commands: window.__pushQA?.commands})), null, 2));
    throw error;
  }
}
async function noOverflow(page) {
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    `horizontal overflow at ${page.url()}`,
  );
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const width of [390, 1280]) {
      const { context: ctx, errors } = await context(browser, width);
      const page = await ctx.newPage();
      await page.goto(`${WEB}/feed`);
      await visible(page, page.getByText("ตอนใหม่มาแล้ว", { exact: true }));
      await noOverflow(page);
      await page
        .getByRole("button", { name: "สำหรับคุณ", exact: true })
        .click();
      await visible(
        page,
        page.getByText(
          "โพสต์แนะนำจากเรื่องที่คุณอ่านหรือบันทึก คนที่ติดตาม ความใหม่ และการมีส่วนร่วม",
          { exact: true },
        ),
      );
      await visible(page, page.getByText("ตอนใหม่มาแล้ว", { exact: true }));
      await page.screenshot({
        path: join(output, `feed-${width}.png`),
        fullPage: true,
      });
      await page.goto(`${WEB}/collections`);
      await visible(
        page,
        page.getByRole("button", { name: "คอลเลกชันใหม่", exact: true }),
      );
      await page
        .getByRole("button", { name: "คอลเลกชันใหม่", exact: true })
        .click();
      const name = `อ่านวันหยุด ${width} · ${Date.now().toString().slice(-5)}`;
      await page.getByLabel("ชื่อคอลเลกชัน", { exact: true }).fill(name);
      await page
        .getByLabel("คำอธิบาย", { exact: true })
        .fill("เรื่องที่อยากแบ่งปันให้เพื่อน");
      await page
        .getByRole("button", { name: "สร้างคอลเลกชัน", exact: true })
        .click();
      await page.getByRole("link", { name: new RegExp(name) }).click();
      await page.waitForURL(/\/collections\/[0-9a-f-]{36}$/);
      await visible(page, page.getByRole("heading", { name, exact: true }));
      const collectionURL = page.url();
      // Private list must remain inaccessible to anonymous clients at the API boundary.
      const id = collectionURL.split("/").at(-1);
      assert.equal(
        (await fetch(`${API}/collections/public/${id}`)).status,
        404,
      );
      await page.getByRole("combobox").fill("manga");
      await page
        .getByText("เรื่องที่อยากอ่านต่อ", { exact: true })
        .first()
        .click();
      await page
        .getByRole("button", { name: "เพิ่มเข้าคอลเลกชัน", exact: true })
        .click();
      await visible(
        page,
        page.getByRole("link", { name: "เรื่องที่อยากอ่านต่อ", exact: true }),
      );
      await page
        .getByRole("button", { name: "แก้ไขคอลเลกชัน", exact: true })
        .click();
      await page.getByLabel("การมองเห็น").selectOption("public");
      await page
        .getByRole("button", { name: "บันทึกการแก้ไข", exact: true })
        .click();
      await visible(
        page,
        page.getByRole("button", { name: "คัดลอกลิงก์แชร์", exact: true }),
      );
      await noOverflow(page);
      await page.screenshot({
        path: join(output, `collection-${width}.png`),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "คัดลอกลิงก์แชร์", exact: true })
        .click();
      await visible(page, page.getByText("คัดลอกลิงก์แล้ว", { exact: true }));
      const { context: guest, errors: guestErrors } = await context(
        browser,
        width,
        false,
      );
      const publicPage = await guest.newPage();
      await publicPage.goto(collectionURL);
      await visible(
        publicPage,
        publicPage.getByRole("heading", { name, exact: true }),
      );
      assert.equal(
        await publicPage
          .getByRole("button", { name: "แก้ไขคอลเลกชัน", exact: true })
          .count(),
        0,
      );
      await visible(
        publicPage,
        publicPage.getByRole("link", {
          name: "เรื่องที่อยากอ่านต่อ",
          exact: true,
        }),
      );
      await noOverflow(publicPage);
      await page
        .getByRole("button", { name: "แก้ไขคอลเลกชัน", exact: true })
        .click();
      await page.getByLabel("การมองเห็น").selectOption("private");
      await page
        .getByRole("button", { name: "บันทึกการแก้ไข", exact: true })
        .click();
      await visible(page, page.getByText(/คอลเลกชันส่วนตัว · 1 เรื่อง/));
      await publicPage.reload();
      await visible(
        publicPage,
        publicPage.getByRole("heading", {
          name: "ไม่พบคอลเลกชัน หรือเป็นคอลเลกชันส่วนตัว",
          exact: true,
        }),
      );
      await page
        .getByRole("button", {
          name: "นำ เรื่องที่อยากอ่านต่อ ออก",
          exact: true,
        })
        .click();
      await visible(
        page,
        page.getByText("ค้นหามังงะด้านบนเพื่อเพิ่มเรื่องแรก", { exact: true }),
      );
      await page
        .getByRole("button", { name: "ลบคอลเลกชัน", exact: true })
        .click();
      await page
        .getByRole("button", { name: "ยืนยันการลบ", exact: true })
        .click();
      await page.waitForURL(`${WEB}/collections`);
      await visible(
        page,
        page.getByRole("button", { name: "คอลเลกชันใหม่", exact: true }),
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(guestErrors, []);
      results.push({
        width,
        flow: "feed + collection CRUD + share + guest read + privacy revocation + item removal",
        result: "pass",
      });
      await guest.close();
      await ctx.close();
    }
    const { context: ctx, errors } = await context(browser, 390);
    const page = await ctx.newPage();
    let fail = true;
    await page.route(`${WEB}/api/proxy/feed*`, async (route) => {
      if (fail) {
        fail = false;
        return route.fulfill({
          status: 503,
          json: { message: "Temporary outage" },
        });
      }
      return route.fallback();
    });
    await page.goto(`${WEB}/feed`);
    await visible(page, page.getByText("โหลดฟีดไม่สำเร็จ", { exact: true }));
    await page.getByRole("button", { name: "ลองใหม่", exact: true }).click();
    await visible(page, page.getByText("ตอนใหม่มาแล้ว", { exact: true }));
    assert.deepEqual(errors, []);
    results.push({ flow: "failed feed load and retry", result: "pass" });
    await ctx.close();
    // Real web session, controller and feature API; substitute only the Android OS boundary.
    for (const width of [390, 1280]) {
      const {context: hybrid, errors: pushErrors} = await context(browser, width, true, true);
      const page = await hybrid.newPage();
      await page.goto(`${WEB}/settings/notifications`);
      await visible(page, page.getByRole("status").filter({hasText: "ปิดรับแจ้งเตือนอยู่"}));
      assert.equal(await page.evaluate(() => window.__pushQA.commands.includes("permission")), false);
      await page.getByRole("button", {name: "เปิดรับแจ้งเตือน", exact: true}).click();
      await visible(page, page.getByText(/ยังไม่ได้รับอนุญาต/));
      await page.evaluate(() => {window.__pushQA.allowed = true;});
      await page.getByRole("button", {name: "เปิดรับแจ้งเตือน", exact: true}).click();
      await visible(page, page.getByText("เปิดรับแจ้งเตือนแล้ว", {exact: true}));
      await noOverflow(page);
      await page.screenshot({path: join(output, `push-settings-${width}.png`), fullPage: true});
      await page.getByRole("button", {name: "ทดสอบบนอุปกรณ์", exact: true}).click();
      await visible(page, page.getByText("ส่งแจ้งเตือนทดสอบบนอุปกรณ์แล้ว", {exact: true}));
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("mangadock:push", {detail: {event: "open", responseId: "other-account", data: {version: "1", recipientUid: "another-reader", notificationId: "qa-other", link: "/feed"}}})));
      assert.equal(new URL(page.url()).pathname, "/settings/notifications");
      await page.evaluate(uid => window.dispatchEvent(new CustomEvent("mangadock:push", {detail: {event: "open", responseId: "qa-tap", data: {version: "1", recipientUid: uid, notificationId: "qa-notification", link: "/feed"}}})), A);
      await page.waitForURL(`${WEB}/feed`);
      await visible(page, page.getByText("ตอนใหม่มาแล้ว", {exact: true}));
      // App-router navigation keeps the controller; opt out must remove the binding.
      await page.goto(`${WEB}/settings/notifications`);
      await page.evaluate(() => {window.__pushQA.allowed = true; window.dispatchEvent(new CustomEvent("mangadock:push", {detail: {event: "refresh"}}));});
      await visible(page, page.getByText("เปิดรับแจ้งเตือนแล้ว", {exact: true}));
      await page.getByRole("button", {name: "ปิดรับแจ้งเตือน", exact: true}).click();
      await visible(page, page.getByText("ปิดรับแจ้งเตือนอยู่", {exact: true}));
      assert.ok(await page.evaluate(() => window.__pushQA.commands.includes("reset")));
      await page.getByRole("button", {name: "เปิดรับแจ้งเตือน", exact: true}).click();
      await visible(page, page.getByText("เปิดรับแจ้งเตือนแล้ว", {exact: true}));
      const logoutOrder = [];
      page.on("request", request => {
        if (request.url().includes("/notifications/push-devices") && request.method() === "DELETE") logoutOrder.push("remove-device");
        if (request.url().includes("/auth/v1/logout")) logoutOrder.push("auth-logout");
      });
      await page.locator('button[aria-controls="account-menu"]').click();
      await page.getByRole("button", {name: "ออกจากระบบ", exact: true}).click();
      await page.waitForURL(`${WEB}/`);
      assert.deepEqual(logoutOrder, ["remove-device", "auth-logout"]);
      assert.deepEqual(pushErrors, []);
      results.push({width, flow: "hybrid push: no startup prompt, denial, durable opt-in, local preview, recipient-scoped tap, reload, opt-out", result: "pass", osBoundary: "substituted; no remote push sent"});
      await hybrid.close();
    }
    writeFileSync(
      join(output, "browser-results.json"),
      JSON.stringify(results, null, 2) + "\n",
    );
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
