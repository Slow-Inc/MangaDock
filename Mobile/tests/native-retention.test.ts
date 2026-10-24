import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { native } from "./support/native.ts";
import React from "react";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import { fixture } from "./support/auth.ts";
import { createAuthManagement } from "../src/auth-management.ts";
import { createPushNotifications } from "../src/push-notifications.ts";
import { createRetention } from "../src/retention.ts";
import type { MobileRuntime } from "../src/runtime.ts";
const { NativeCollectionsView, NativePersonalFeedView } =
  await import("../src/NativeRetentionView.tsx");
const { NativeReadingView } = await import("../src/NativeReadingView.tsx");
const { NativeSessionView } = await import("../src/NativeSessionView.tsx");
const id = "2f1f0c32-855b-4cd7-bb63-a13d4a7fb760";
const collection = {
  id,
  owner_uid: "reader-1",
  name: "วันหยุด",
  description: "อ่านต่อที่บ้าน",
  visibility: "private",
  created_at: "",
  updated_at: "",
  items: [],
};
const post = {
  id: "post-1",
  authorUid: "writer",
  authorName: "นักแปล",
  authorPhotoUrl: null,
  title: "ตอนใหม่",
  content: "เนื้อหาที่ซ่อนไว้",
  category: "spoiler",
  targetMangaId: null,
  targetMangaTitle: null,
  imageUrls: [],
  upvotes: 3,
  downvotes: 0,
  userVote: 0,
  commentCount: 0,
  createdAt: "",
};
function button(ui: ReactTestRenderer, label: string) {
  const found = ui.root
    .findAll((node) => String(node.type) === "Pressable")
    .find(
      (node) =>
        node.props.accessibilityLabel === label ||
        node
          .findAll((child) => String(child.type) === "Text")
          .some((text) => text.children.join("") === label),
    );
  assert.ok(found, `missing button ${label}`);
  return found;
}
const texts = (ui: ReactTestRenderer) =>
  ui.root
    .findAll((node) => String(node.type) === "Text")
    .map((node) => node.children.join(""))
    .join("\n");
async function setup(
  t: TestContext,
  fetch: typeof globalThis.fetch,
  signedIn = true,
) {
  const auth = fixture({ externalFetch: fetch });
  if (signedIn)
    await auth.app.signIn("reader@example.test", "correct-test-password");
  const options = {
    apiOrigin: "https://api.example.test",
    deviceId: "mdock_native_test",
    fetch: auth.fetch,
    session: auth.app,
    supabase: auth.supabase,
  };
  const management = createAuthManagement(options);
  const push = createPushNotifications({
    ...options,
    enabled: false,
    storage: { getItem: async () => null, setItem: async () => {} },
    platform: {
      permission: async () => false,
      token: async () => "",
      unregister: async () => {},
      preview: async () => {},
    },
    navigate() {},
  });
  const runtime: MobileRuntime = {
    ...options,
    auth: management,
    push,
    destination: {
      snapshot: () => null,
      subscribe: () => () => {},
      consume() {},
    },
    initialize: async () => {},
    dispose() {
      push.dispose();
      management.dispose();
      auth.app.dispose();
    },
  };
  const retention = createRetention(runtime);
  t.after(() => {
    retention.dispose();
    runtime.dispose();
    native.alerts.length = 0;
    native.shares.length = 0;
  });
  return { runtime, retention };
}
test("native owner creates private collection, searches/adds manga, edits visibility, shares and confirms deletion", async (t) => {
  let detail = {
    ...collection,
    items: [] as Array<{ manga_id: string; title: string; added_at: string }>,
  };
  const { runtime, retention } = await setup(t, async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    if (url.pathname === "/books/search")
      return Response.json({ items: [{ id: "manga-1", title: "เรื่องแรก" }] });
    if (url.pathname.endsWith("/items"))
      return new Response(null, { status: 204 });
    if (method === "POST" || method === "PUT") {
      detail = { ...detail, ...JSON.parse(String(init?.body)) };
      return Response.json(detail);
    }
    if (method === "DELETE") return new Response(null, { status: 204 });
    return Response.json(url.pathname === "/collections" ? [] : detail);
  });
  let ui!: ReactTestRenderer;
  t.after(async () => {
    await act(async () => ui?.unmount());
  });
  await act(async () => {
    ui = create(
      React.createElement(NativeCollectionsView, {
        runtime,
        retention,
        onAccount() {},
        onBook() {},
      }),
    );
  });
  await act(async () => button(ui, "สร้างคอลเลกชัน").props.onPress());
  const name = ui.root
    .findAll((node) => String(node.type) === "TextInput")
    .find((node) => node.props.accessibilityLabel === "ชื่อคอลเลกชัน")!;
  await act(async () => name.props.onChangeText("วันหยุด"));
  await act(async () => button(ui, "บันทึกคอลเลกชัน").props.onPress());
  assert.equal(retention.snapshot().detail?.visibility, "private");
  assert.ok(!texts(ui).includes("แชร์ลิงก์เปิดในแอป"));
  const query = ui.root
    .findAll((node) => String(node.type) === "TextInput")
    .find(
      (node) => node.props.accessibilityLabel === "ค้นหามังงะสำหรับคอลเลกชัน",
    )!;
  await act(async () => query.props.onChangeText("เรื่อง"));
  await act(async () => button(ui, "ค้นหาเรื่องเพื่อเพิ่ม").props.onPress());
  await act(async () => button(ui, "เพิ่มเรื่อง: เรื่องแรก").props.onPress());
  assert.equal(retention.snapshot().detail?.items[0].manga_id, "manga-1");
  await act(async () => button(ui, "แก้ไขคอลเลกชัน").props.onPress());
  await act(async () => button(ui, "สาธารณะ").props.onPress());
  await act(async () => button(ui, "บันทึกคอลเลกชัน").props.onPress());
  await act(async () => button(ui, "แชร์ลิงก์เปิดในแอป").props.onPress());
  assert.match(
    native.shares.at(-1)!.message,
    new RegExp(`mangadock://collections/${id}`),
  );
  await act(async () => button(ui, "นำออก: เรื่องแรก").props.onPress());
  await act(async () =>
    native.alerts.at(-1)!.buttons.find((entry) => entry.text === "นำเรื่องออก")!
      .onPress!(),
  );
  assert.equal(retention.snapshot().detail?.items.length, 0);
  await act(async () => button(ui, "ลบคอลเลกชัน").props.onPress());
  await act(async () =>
    native.alerts.at(-1)!.buttons.find((entry) => entry.text === "ลบคอลเลกชัน")!
      .onPress!(),
  );
  assert.equal(retention.snapshot().id, null);
  assert.match(texts(ui), /คอลเลกชันของฉัน/);
});

test("guest public collection has no mutation controls and private denial stays retryable", async (t) => {
  let allowed = true;
  const { runtime, retention } = await setup(
    t,
    async () =>
      allowed
        ? Response.json({ ...collection, visibility: "public" })
        : Response.json({ message: "not found" }, { status: 404 }),
    false,
  );
  await retention.open(id);
  let ui!: ReactTestRenderer;
  t.after(async () => {
    await act(async () => ui?.unmount());
  });
  await act(async () => {
    ui = create(
      React.createElement(NativeCollectionsView, {
        runtime,
        retention,
        onAccount() {},
        onBook() {},
      }),
    );
  });
  assert.match(texts(ui), /วันหยุด/);
  assert.ok(!texts(ui).includes("แก้ไขคอลเลกชัน"));
  assert.ok(!texts(ui).includes("ลบคอลเลกชัน"));
  allowed = false;
  await act(async () => retention.open(id));
  assert.ok(!texts(ui).includes("อ่านต่อที่บ้าน"));
  assert.ok(button(ui, "ลองอีกครั้ง"));
});

test("native personal feed preserves spoiler gating, routes posts and switches mode", async (t) => {
  const { runtime, retention } = await setup(t, async () =>
    Response.json({ items: [post], total: 1 }),
  );
  let ui!: ReactTestRenderer;
  let opened = "";
  t.after(async () => {
    await act(async () => ui?.unmount());
  });
  await act(async () => {
    ui = create(
      React.createElement(NativePersonalFeedView, {
        runtime,
        retention,
        onAccount() {},
        onPost(id) {
          opened = id;
        },
        onManga() {},
        onProfile() {},
      }),
    );
  });
  assert.ok(!texts(ui).includes("เนื้อหาที่ซ่อนไว้"));
  await act(async () =>
    button(ui, "มีสปอยล์ · แตะเพื่อดูเนื้อหา").props.onPress(),
  );
  assert.match(texts(ui), /เนื้อหาที่ซ่อนไว้/);
  await act(async () => button(ui, "อ่านโพสต์").props.onPress());
  assert.equal(opened, "post-1");
  await act(async () => button(ui, "สำหรับคุณ").props.onPress());
  assert.equal(retention.snapshot().feed.mode, "personalized");
  assert.ok(!texts(ui).includes("เนื้อหาที่ซ่อนไว้"));
});

test("native collection deep link opens the real screen and hardware Back returns to list then library", async (t) => {
  const { runtime } = await setup(
    t,
    async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/books/landing")
        return Response.json({ hero: null, rows: [], updatedAt: "" });
      if (path === `/collections/public/${id}`)
        return Response.json({ ...collection, visibility: "public" });
      return Response.json([]);
    },
    false,
  );
  let ui!: ReactTestRenderer;
  t.after(async () => {
    await act(async () => ui?.unmount());
  });
  await act(async () => {
    ui = create(
      React.createElement(NativeReadingView, {
        runtime,
        accountLabel: "เข้าสู่ระบบ",
        onAccount() {},
        initialDestination: { kind: "collection", id },
      }),
    );
  });
  assert.match(texts(ui), /วันหยุด/);
  await act(async () => {
    assert.equal(native.pressBack(), true);
  });
  assert.match(texts(ui), /คอลเลกชันของฉัน/);
  await act(async () => {
    assert.equal(native.pressBack(), true);
  });
  assert.match(texts(ui), /รายการของฉัน/);
});

test("native feed post Back restores the selected feed without reloading its pages", async (t) => {
  let feedReads = 0;
  const { runtime } = await setup(t, async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/books/landing")
      return Response.json({ hero: null, rows: [], updatedAt: "" });
    if (path === "/feed") {
      feedReads++;
      return Response.json({ items: [post], total: 1 });
    }
    if (path === "/forum/posts/post-1") return Response.json(post);
    if (path === "/forum/posts") return Response.json({ items: [], total: 0 });
    return Response.json([]);
  });
  let ui!: ReactTestRenderer;
  t.after(async () => {
    await act(async () => ui?.unmount());
  });
  await act(async () => {
    ui = create(
      React.createElement(NativeReadingView, {
        runtime,
        accountLabel: "บัญชีของฉัน",
        onAccount() {},
        initialDestination: { kind: "feed" },
      }),
    );
  });
  await act(async () => button(ui, "สำหรับคุณ").props.onPress());
  await act(async () => button(ui, "อ่านโพสต์").props.onPress());
  await act(async () => {
    assert.equal(native.pressBack(), true);
  });
  assert.match(texts(ui), /ฟีดของฉัน/);
  assert.equal(button(ui, "สำหรับคุณ").props.accessibilityState.selected, true);
  assert.equal(feedReads, 2);
});

test("guest feed login preserves the requested destination across the account remount", async (t) => {
  const { runtime } = await setup(
    t,
    async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/books/landing")
        return Response.json({ hero: null, rows: [], updatedAt: "" });
      if (path === "/feed") return Response.json({ items: [post], total: 1 });
      return Response.json([]);
    },
    false,
  );
  let incoming: { kind: "feed" } | null = { kind: "feed" };
  const listeners = new Set<() => void>();
  runtime.destination = {
    snapshot: () => incoming,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    consume() {
      incoming = null;
      listeners.forEach((listener) => listener());
    },
  };
  let ui!: ReactTestRenderer;
  t.after(async () => {
    await act(async () => ui?.unmount());
  });
  await act(async () => {
    ui = create(React.createElement(NativeSessionView, { runtime }));
  });
  await act(async () =>
    button(ui, "เข้าสู่ระบบเพื่อดูฟีดของฉัน").props.onPress(),
  );
  await act(async () => {
    ui.root
      .findAll((node) => String(node.type) === "TextInput")
      .find((node) => node.props.accessibilityLabel === "อีเมล")!
      .props.onChangeText("reader@example.test");
    ui.root
      .findAll((node) => String(node.type) === "TextInput")
      .find((node) => node.props.accessibilityLabel === "รหัสผ่าน")!
      .props.onChangeText("correct-test-password");
  });
  await act(async () => button(ui, "เข้าสู่ระบบ").props.onPress());
  assert.match(texts(ui), /ฟีดของฉัน/);
  assert.match(texts(ui), /ตอนใหม่/);
});
