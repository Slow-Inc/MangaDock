// Run only after the user opens the localhost status page in Chrome on the
// connected phone. CDP attaches to that tab; it does not launch an application,
// inspect personal tabs, change device metrics, or use real account credentials.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const assert = require("node:assert/strict");
const { token, A, B } = require("../Backend/test/phase5-fixture.cjs");
const WEB = "http://localhost:4016";
const API = "http://127.0.0.1:4015";
const output = join(__dirname, "../docs/reports/phase5-zflip4-2026-10-24");
mkdirSync(output, { recursive: true });
const results = [],
  requests = [],
  errors = [];
const user = (uid) => ({
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "phase5@example.test",
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {
    display_name: uid === A ? "Z Flip4 QA" : "Other QA account",
  },
  identities: [],
});
const session = (uid) => ({
  access_token: token(uid),
  token_type: "bearer",
  refresh_token: "phase5-fixture",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: user(uid),
});

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9225");
  const context = browser.contexts()[0];
  const page = context
    .pages()
    .find(
      (p) =>
        p.url().startsWith("http://localhost:4001") || p.url().startsWith(WEB),
    );
  if (!page)
    throw new Error(
      "User-opened local QA tab not found; do not create or inspect other tabs",
    );
  const visible = (locator) =>
    locator.waitFor({ state: "visible", timeout: 15000 });
  const capture = async (name) => {
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.screenshot({ path: join(output, name), fullPage: false });
  };
  let failFeed = false;
  try {
    page.on("pageerror", (error) => errors.push(error.message));
    await context.addInitScript(
      ({ web, first, second }) => {
        if (location.origin !== web) return;
        localStorage.setItem(
          "mangadock_checkin_date",
          new Date().toISOString().slice(0, 10),
        );
        const mode = localStorage.getItem("phase5_device_qa_mode") || "owner";
        if (mode === "guest") localStorage.removeItem("sb-phase5-auth-token");
        else
          localStorage.setItem(
            "sb-phase5-auth-token",
            JSON.stringify(mode === "other" ? second : first),
          );
      },
      { web: WEB, first: session(A), second: session(B) },
    );
    await context.route("https://phase5.supabase.co/**", (route) =>
      route.fulfill({
        json: route.request().url().includes("/auth/v1/user") ? user(A) : [],
      }),
    );
    await context.route(`${WEB}/api/proxy/**`, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace("/api/proxy/", "");
      if (
        path === "feed" ||
        path.startsWith("collections") ||
        path.startsWith("notifications/push-")
      ) {
        if (path === "feed" && failFeed) {
          failFeed = false;
          return route.fulfill({
            status: 503,
            json: { message: "QA temporary failure" },
          });
        }
        const response = await fetch(`${API}/${path}${url.search}`, {
          method: request.method(),
          headers: {
            "Content-Type": "application/json",
            ...(request.headers().authorization
              ? { Authorization: request.headers().authorization }
              : {}),
          },
          body: ["GET", "HEAD"].includes(request.method())
            ? undefined
            : request.postData(),
        });
        requests.push({
          path,
          method: request.method(),
          status: response.status,
        });
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
          ? { uid: A, displayName: "Z Flip4 QA", role: 0 }
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
    await page.goto(`${WEB}/feed`);
    await visible(page.getByText("ตอนใหม่มาแล้ว", { exact: true }));
    const device = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      width: innerWidth,
      height: innerHeight,
      dpr: devicePixelRatio,
      touchPoints: navigator.maxTouchPoints,
    }));
    assert.ok(device.userAgent.includes("Android") && device.touchPoints > 0);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    results.push({ feature: "Following Feed", result: "pass", device });
    await page.getByRole("button", { name: "สำหรับคุณ", exact: true }).click();
    await visible(
      page.getByText(
        "โพสต์แนะนำจากเรื่องที่คุณอ่านหรือบันทึก คนที่ติดตาม ความใหม่ และการมีส่วนร่วม",
        { exact: true },
      ),
    );
    await visible(page.getByText("ตอนใหม่มาแล้ว", { exact: true }));
    await capture("feed-device.png");
    results.push({ feature: "Personalized Feed", result: "pass" });
    failFeed = true;
    await page.reload();
    await visible(page.getByText("โหลดฟีดไม่สำเร็จ", { exact: true }));
    await page.getByRole("button", { name: "ลองใหม่", exact: true }).click();
    await visible(page.getByText("ตอนใหม่มาแล้ว", { exact: true }));
    results.push({ feature: "Feed failure/retry", result: "pass" });

    await page.goto(`${WEB}/collections`);
    await page
      .getByRole("button", { name: "คอลเลกชันใหม่", exact: true })
      .click();
    const name = `Z Flip4 QA ${Date.now().toString().slice(-5)}`;
    await page.getByLabel("ชื่อคอลเลกชัน", { exact: true }).fill(name);
    await page
      .getByLabel("คำอธิบาย", { exact: true })
      .fill("บัญชีและฐานข้อมูลทดสอบ Phase 5");
    await page
      .getByRole("button", { name: "สร้างคอลเลกชัน", exact: true })
      .click();
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await page.waitForURL(/\/collections\/[0-9a-f-]{36}$/);
    await visible(page.getByRole("heading", { name, exact: true }));
    const collectionURL = page.url(),
      id = collectionURL.split("/").at(-1);
    assert.equal((await fetch(`${API}/collections/public/${id}`)).status, 404);
    await page.getByRole("combobox").fill("manga");
    await page
      .getByText("เรื่องที่อยากอ่านต่อ", { exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "เพิ่มเข้าคอลเลกชัน", exact: true })
      .click();
    await visible(
      page.getByRole("link", { name: "เรื่องที่อยากอ่านต่อ", exact: true }),
    );
    results.push({
      feature: "Private collection create + manga add",
      result: "pass",
    });
    await page
      .getByRole("button", { name: "แก้ไขคอลเลกชัน", exact: true })
      .click();
    await page.getByLabel("การมองเห็น", { exact: true }).selectOption("public");
    await page
      .getByRole("button", { name: "บันทึกการแก้ไข", exact: true })
      .click();
    await visible(
      page.getByRole("button", { name: "คัดลอกลิงก์แชร์", exact: true }),
    );
    await page
      .getByRole("button", { name: "คัดลอกลิงก์แชร์", exact: true })
      .click();
    await visible(page.getByText("คัดลอกลิงก์แล้ว", { exact: true }));
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await capture("collection-owner-device.png");
    results.push({
      feature: "Collection edit/public/share clipboard",
      result: "pass",
    });

    const mode = async (value) => {
      await page.evaluate(
        (value) => localStorage.setItem("phase5_device_qa_mode", value),
        value,
      );
      await page.reload();
    };
    await mode("guest");
    await visible(page.getByRole("heading", { name, exact: true }));
    assert.equal(
      await page
        .getByRole("button", { name: "แก้ไขคอลเลกชัน", exact: true })
        .count(),
      0,
    );
    await capture("collection-guest-device.png");
    results.push({
      feature: "Guest public read / no edit controls",
      result: "pass",
    });
    await mode("owner");
    await page
      .getByRole("button", { name: "แก้ไขคอลเลกชัน", exact: true })
      .click();
    await page
      .getByLabel("การมองเห็น", { exact: true })
      .selectOption("private");
    await page
      .getByRole("button", { name: "บันทึกการแก้ไข", exact: true })
      .click();
    await visible(page.getByText(/คอลเลกชันส่วนตัว · 1 เรื่อง/));
    await mode("guest");
    await visible(
      page.getByRole("heading", {
        name: "ไม่พบคอลเลกชัน หรือเป็นคอลเลกชันส่วนตัว",
        exact: true,
      }),
    );
    await capture("private-denied-device.png");
    await mode("other");
    await visible(
      page.getByRole("heading", {
        name: "ไม่พบคอลเลกชัน หรือเป็นคอลเลกชันส่วนตัว",
        exact: true,
      }),
    );
    results.push({
      feature: "Privacy revocation / guest and other-account denial",
      result: "pass",
    });
    await mode("owner");
    await page
      .getByRole("button", { name: "นำ เรื่องที่อยากอ่านต่อ ออก", exact: true })
      .click();
    await visible(
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
      page.getByRole("button", { name: "คอลเลกชันใหม่", exact: true }),
    );
    results.push({
      feature: "Manga removal + collection deletion",
      result: "pass",
    });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({ results, requestCount: requests.length }, null, 2),
    );
  } catch (error) {
    results.push({ result: "fail", message: error.message });
    await page
      .screenshot({ path: join(output, "failure-device.png"), fullPage: true })
      .catch(() => {});
    throw error;
  } finally {
    writeFileSync(
      join(output, "device-results.json"),
      JSON.stringify(
        {
          results,
          requests,
          errors,
          boundary:
            "Physical Z Flip4 Chrome, no emulation; feature HTTP -> real Nest -> isolated PGlite; synthetic auth/catalog and controlled transport; live production-schema acceptance not claimed",
        },
        null,
        2,
      ) + "\n",
    );
    await context.unrouteAll({ behavior: "wait" });
    await page.goto("http://localhost:4001/status").catch(() => {});
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
