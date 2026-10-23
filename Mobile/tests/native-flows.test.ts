import test from "node:test";
import assert from "node:assert/strict";
import { native } from "./support/native.ts";
import React from "react";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import { fixture } from "./support/auth.ts";
import { createAuthManagement } from "../src/auth-management.ts";
import type { MobileRuntime } from "../src/runtime.ts";
import { createReader } from "../src/reader.ts";
import { createReadingSocial } from "../src/reading-social.ts";
import { createPushNotifications } from "../src/push-notifications.ts";
const { NativeSessionView } = await import("../src/NativeSessionView.tsx");
const { pickImages } = await import("../src/native-images.ts");
const { NativeReadingView } = await import("../src/NativeReadingView.tsx");
const { NativeReaderView } = await import("../src/NativeReaderView.tsx");
const { NativeReaderComments } = await import("../src/NativeReadingSocial.tsx");
const { NativeReviewSection } = await import("../src/NativeReadingSocial.tsx");
const { NativeAccountActivity } =
  await import("../src/NativeAccountActivity.tsx");
const { createAccountActivity } = await import("../src/account-activity.ts");
const { NativePushSettings } = await import("../src/NativePushSettings.tsx");
function setup(authOptions: Parameters<typeof fixture>[0] = {}) {
  const auth = fixture({
    externalFetch: async (input) =>
      Response.json(
        new URL(String(input)).pathname === "/books/landing"
          ? { hero: null, rows: [], updatedAt: "" }
          : [],
      ),
    ...authOptions,
  });
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
  return { auth, runtime };
}
function button(ui: ReactTestRenderer, label: string) {
  return ui.root
    .findAll((node) => String(node.type) === "Pressable")
    .find(
      (node) =>
        node.props.accessibilityLabel === label ||
        node
          .findAll((node) => String(node.type) === "Text")
          .some((text) => text.children.join("") === label),
    )!;
}

test("native push settings render permission, acknowledged-on, preview and off states through the real controller", async (t) => {
  const { auth, runtime } = setup({
    externalFetch: async (_input, init) =>
      init?.method === "DELETE"
        ? new Response(null, { status: 204 })
        : Response.json({ registered: true }),
  });
  await runtime.session.signIn("reader@example.test", "correct-test-password");
  let allowed = false,
    prompts = 0,
    previews = 0;
  const push = createPushNotifications({
    ...runtime,
    enabled: true,
    storage: { getItem: async () => null, setItem: async () => {} },
    platform: {
      permission: async () => {
        prompts++;
        return allowed;
      },
      token: async () => "fcm-test-token",
      unregister: async () => {},
      preview: async () => {
        previews++;
      },
    },
    navigate() {},
  });
  let ui!: ReactTestRenderer;
  t.after(async () => {
    await act(async () => ui?.unmount());
    push.dispose();
    runtime.dispose();
  });
  await act(async () => {
    ui = create(React.createElement(NativePushSettings, { push }));
  });
  assert.equal(prompts, 0);
  await act(async () => {
    await button(ui, "เปิดรับแจ้งเตือนบนเครื่อง").props.onPress();
  });
  assert.equal(push.snapshot().status, "blocked");
  assert.ok(button(ui, "เปิดการตั้งค่าเครื่อง"));
  allowed = true;
  await act(async () => {
    await push.enable();
  });
  assert.ok(button(ui, "ปิดแจ้งเตือนบนเครื่อง"));
  await act(async () => {
    button(ui, "ทดสอบแจ้งเตือนบนเครื่อง").props.onPress();
  });
  assert.equal(previews, 1);
  await act(async () => {
    await push.disable();
  });
  assert.ok(button(ui, "เปิดรับแจ้งเตือนบนเครื่อง"));
  assert.equal(auth.app.snapshot().status, "signedIn");
});
test("empty required review data renders a retryable error instead of crashing the review section", async (t) => {
  for (const emptyPart of ["summary", "list"]) {
    const { runtime } = setup({
      externalFetch: async (input) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/my")) return new Response(null);
        const isSummary = path.endsWith("/summary");
        if (isSummary === (emptyPart === "summary")) return new Response(null);
        return Response.json(isSummary ? { averageRating: 0, count: 0 } : []);
      },
    });
    await runtime.session.signIn(
      "reader@example.test",
      "correct-test-password",
    );
    const social = createReadingSocial(runtime);
    let ui!: ReactTestRenderer;
    t.after(async () => {
      await act(async () => ui?.unmount());
      social.dispose();
      runtime.dispose();
    });
    await act(async () => {
      ui = create(
        React.createElement(NativeReviewSection, {
          social,
          runtime,
          mangaId: "manga-1",
          title: "Test",
          onAccount() {},
        }),
      );
    });
    assert.match(social.snapshot().reviews.error ?? "", /ข้อมูล.*ไม่ถูกต้อง/);
    assert.ok(button(ui, "ลองใหม่"));
    assert.deepEqual(social.snapshot().reviews.items, []);
    assert.deepEqual(social.snapshot().reviews.summary, {
      averageRating: 0,
      count: 0,
    });
    await act(async () => ui.unmount());
  }
});

test("long chapter lists remain bounded like web, show existing page counts and open the final chapter", async (t) => {
  const opened: string[] = [];
  const chapters = Array.from({ length: 83 }, (_, i) => ({
    id: `chapter-${i + 1}`,
    chapterNumber: String(i + 1),
    title: `Chapter ${i + 1}`,
    translatedLanguage: "en",
    pageCount: i + 10,
  }));
  const { runtime } = setup({
    externalFetch: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/books/landing")
        return Response.json({ hero: null, rows: [], updatedAt: "" });
      if (path.endsWith("/summary"))
        return Response.json({ averageRating: 0, count: 0 });
      if (path === "/books/manga/manga-1")
        return Response.json({
          id: "manga-1",
          title: "Title",
          authors: [],
          genres: [],
          covers: [],
        });
      if (path.endsWith("/chapters")) return Response.json(chapters);
      if (path.includes("/books/chapters/") && path.endsWith("/pages")) {
        opened.push(path);
        return Response.json({ pages: ["/one.png"] });
      }
      return Response.json([]);
    },
  });
  let ui!: ReactTestRenderer;
  t.after(async () => {
    await act(async () => ui?.unmount());
    runtime.dispose();
  });
  await act(async () => {
    ui = create(
      React.createElement(NativeReadingView, {
        runtime,
        onAccount() {},
        accountLabel: "Account",
        initialDestination: { kind: "book", id: "manga-1" },
      }),
    );
  });
  const list = ui.root.findAll(
    (node) =>
      String(node.type) === "ScrollView" &&
      node.props.accessibilityLabel === "รายการตอน",
  )[0];
  assert.ok(list, "chapter rows should have their own scrolling viewport");
  assert.equal(list.props.nestedScrollEnabled, true);
  const style = Object.assign({}, ...[list.props.style].flat(Infinity));
  assert.ok(style.maxHeight > 0 && style.maxHeight <= 844 / 2);
  const texts = () =>
    ui.root
      .findAll((node) => String(node.type) === "Text")
      .map((node) => node.children.join(""));
  assert.ok(texts().includes("ตอนทั้งหมด (83)"));
  assert.ok(texts().includes("10 หน้า"));
  assert.ok(texts().includes("92 หน้า"));
  assert.equal(
    list.findAll((node) => String(node.type) === "Pressable").length,
    83,
    "all chapters stay available inside the bounded list",
  );
  assert.equal(
    list.findAll(
      (node) =>
        String(node.type) === "Text" &&
        node.children.join("").includes("รีวิว"),
    ).length,
    0,
    "reviews must stay outside the chapter viewport",
  );
  const last = list
    .findAll((node) => String(node.type) === "Pressable")
    .at(-1)!;
  await act(async () => last.props.onPress());
  assert.deepEqual(opened, ["/books/chapters/chapter-83/pages"]);
});
test("native selection returns the OS file without unsupported React Native binary Blob construction", async () => {
  const original = globalThis.Blob;
  const file = new original(["image-bytes"], { type: "image/png" });
  native.files.set("file:///photo.png", file);
  native.images = {
    canceled: false,
    assets: [
      {
        uri: "file:///photo.png",
        mimeType: "image/png",
        fileName: "photo.png",
      },
    ],
  };
  globalThis.Blob = class extends original {
    constructor(parts: BlobPart[] = [], options?: BlobPropertyBag) {
      if (
        parts.some(
          (part) => ArrayBuffer.isView(part) || part instanceof ArrayBuffer,
        )
      )
        throw new Error(
          "Creating blobs from ArrayBuffer and ArrayBufferView are not supported",
        );
      super(parts, options);
    }
  };
  try {
    const images = await pickImages();
    assert.equal(images[0].blob, file);
    assert.equal(images[0].blob.type, "image/png");
    assert.equal(images[0].name, "photo.png");
  } finally {
    globalThis.Blob = original;
    native.images = { canceled: true, assets: [] };
  }
});
test("the published Studio read button opens the selected version in native Reader", async (t) => {
  const version = {
    versionId: "version-1",
    titleId: "manga-1",
    titleName: "Title",
    chapterNumber: "1",
    chapterTitle: "Chapter",
    language: "en",
    translatorUid: "reader-1",
    translatorName: "Creator",
    status: "published",
    pages: ["/one.png"],
    priceCoins: 0,
  };
  const { auth, runtime } = setup({
    loadAccount: async () =>
      Response.json({
        uid: "reader-1",
        email: "reader@example.test",
        displayName: "Creator",
        role: 1,
      }),
    externalFetch: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/books/landing")
        return Response.json({ hero: null, rows: [], updatedAt: "" });
      if (path === "/wallet/balance") return Response.json({ balance: 0 });
      if (path.endsWith("/summary"))
        return Response.json({ averageRating: 0, count: 0 });
      if (path.endsWith("/my")) return Response.json(null);
      if (path === "/wallet/earnings")
        return Response.json({
          totalEarned: 0,
          totalSales: 0,
          uniqueBuyers: 0,
          titlesSold: 0,
        });
      if (path === "/books/manga/manga-1")
        return Response.json({
          id: "manga-1",
          title: "Title",
          authors: [],
          genres: [],
          covers: [],
        });
      if (path === "/versions/version-1") return Response.json(version);
      if (path.startsWith("/versions/")) return Response.json([version]);
      return Response.json([]);
    },
  });
  await auth.app.signIn("reader@example.test", "correct-test-password");
  let ui!: ReactTestRenderer;
  t.after(async () => {
    await act(async () => ui?.unmount());
    runtime.dispose();
  });
  await act(async () => {
    ui = create(
      React.createElement(NativeReadingView, {
        runtime,
        onAccount() {},
        accountLabel: "Account",
        initialDestination: { kind: "studio" },
      }),
    );
  });
  await act(async () => button(ui, "จัดการผลงาน").props.onPress());
  await act(async () => button(ui, "Title").props.onPress());
  await act(async () => button(ui, "ตอน 1 · Chapter").props.onPress());
  await act(async () => button(ui, "อ่านตอนที่เผยแพร่").props.onPress());
  assert.ok(
    button(ui, "ตอนถัดไป"),
    "Reader chapter controls should be visible after reading a Studio version",
  );
  await act(async () => ui.unmount());
  runtime.dispose();
});
test("Android Back from the native sign-in screen returns to guest Home", async () => {
  const { runtime } = setup();
  let ui!: ReactTestRenderer;
  await act(async () => {
    ui = create(React.createElement(NativeSessionView, { runtime }));
  });
  await act(async () => {
    button(ui, "เข้าสู่ระบบ").props.onPress();
  });
  assert.ok(
    ui.root
      .findAll((node) => String(node.type) === "TextInput")
      .some((node) => node.props.accessibilityLabel === "อีเมล"),
  );
  let handled = false;
  await act(async () => {
    handled = native.pressBack();
  });
  assert.equal(handled, true);
  assert.ok(button(ui, "เข้าสู่ระบบ"));
  assert.equal(
    ui.root
      .findAll((node) => String(node.type) === "TextInput")
      .some((node) => node.props.accessibilityLabel === "อีเมล"),
    false,
  );
  await act(async () => ui.unmount());
  runtime.dispose();
});
test("native Reader next and previous keep the chosen chapter language", async (t) => {
  const { runtime } = setup({
    externalFetch: async () =>
      Response.json({ pages: ["/one.png"], dataSaverPages: [] }),
  });
  const chapters = [
    { id: "en-1", chapterNumber: "1", title: "One", translatedLanguage: "en" },
    { id: "th-1", chapterNumber: "1", title: "One", translatedLanguage: "th" },
    { id: "en-2", chapterNumber: "2", title: "Two", translatedLanguage: "en" },
  ];
  const reader = createReader(runtime),
    social = createReadingSocial(runtime);
  await reader.open("manga-1", chapters[0]);
  let ui!: ReactTestRenderer;
  t.after(async () => {
    await act(async () => ui?.unmount());
    social.dispose();
    reader.close();
    runtime.dispose();
  });
  await act(async () => {
    ui = create(
      React.createElement(NativeReaderView, {
        runtime,
        reader,
        social,
        chapters,
        onAccount() {},
        onChapter(chapter) {
          void reader.open("manga-1", chapter);
        },
      }),
    );
  });
  await act(async () => button(ui, "ตอนถัดไป").props.onPress());
  assert.equal(reader.snapshot().chapter?.id, "en-2");
  await act(async () => button(ui, "ตอนก่อน").props.onPress());
  assert.equal(reader.snapshot().chapter?.id, "en-1");
});

test("restoring page 40 uses exact rendered row geometry after a preceding image changes height", async (t) => {
  const { runtime } = setup({
    externalFetch: async () =>
      Response.json({
        pages: Array.from({ length: 50 }, (_, i) => `/page-${i}.png`),
      }),
  });
  const reader = createReader(runtime),
    social = createReadingSocial(runtime);
  const chapter = {
    id: "chapter-1",
    chapterNumber: "1",
    title: "One",
    translatedLanguage: "en",
  };
  await reader.open("manga-1", chapter, {
    pageIndex: 39,
    mode: "strip",
    direction: "ltr",
    zoom: 1,
  });
  let ui!: ReactTestRenderer;
  t.after(async () => {
    await act(async () => ui?.unmount());
    social.dispose();
    reader.close();
    runtime.dispose();
  });
  await act(async () => {
    ui = create(
      React.createElement(NativeReaderView, {
        runtime,
        reader,
        social,
        chapters: [chapter],
        onAccount() {},
        onChapter() {},
      }),
    );
  });
  const list = () => ui.root.find((node) => String(node.type) === "FlatList");
  assert.equal(
    typeof list().props.getItemLayout,
    "function",
    "unmeasured pages must not use averageItemLength to restore history",
  );
  let expectedOffset = 0;
  for (let i = 0; i < 39; i++)
    expectedOffset += list().props.getItemLayout(null, i).length;
  assert.equal(list().props.getItemLayout(null, 39).offset, expectedOffset);
  await act(async () => {
    ui.root
      .findAll(
        (node) =>
          String(node.type) === "Image" &&
          node.props.accessibilityLabel === "หน้ามังงะ",
      )[0]
      .props.onLoad({ nativeEvent: { source: { width: 100, height: 800 } } });
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  assert.equal(list().props.getItemLayout(null, 0).length, 390 * 8);
  assert.equal(reader.snapshot().position?.pageIndex, 39);
  assert.ok(
    native.scrolls.some(
      (scroll) => scroll.offset === list().props.getItemLayout(null, 39).offset,
    ),
  );
});

test("comments and notifications reserve device safe-area space inside their modal sheets", async (t) => {
  const { runtime } = setup();
  const social = createReadingSocial(runtime),
    activity = createAccountActivity(runtime);
  native.insets = { top: 0, bottom: 48, left: 12, right: 8 };
  let ui!: ReactTestRenderer;
  t.after(async () => {
    await act(async () => ui?.unmount());
    native.insets = { top: 0, bottom: 0, left: 0, right: 0 };
    social.dispose();
    activity.dispose();
    runtime.dispose();
  });
  const elements = [
    React.createElement(NativeReaderComments, {
      social,
      runtime,
      context: { mangaId: "A", chapterId: "one", pageNumber: 1 },
      onAccount() {},
      onClose() {},
    }),
    React.createElement(NativeAccountActivity, {
      activity,
      screen: "notifications",
      onClose() {},
      onDestination: () => false,
    }),
  ];
  for (const element of elements) {
    await act(async () => {
      ui = create(element);
    });
    const sheet = ui.root
      .find((node) => String(node.type) === "Modal")
      .findAll((node) => String(node.type) === "View")[1];
    const style = Object.assign({}, ...[sheet.props.style].flat(Infinity));
    assert.equal(style.paddingBottom, 68);
    assert.equal(style.paddingLeft, 32);
    assert.equal(style.paddingRight, 28);
    await act(async () => ui.unmount());
  }
});

test("Reader wires horizontal page swipes and Android Back closes the chapter picker first", async (t) => {
  const { runtime } = setup({
    externalFetch: async () =>
      Response.json({ pages: ["/one.png", "/two.png"] }),
  });
  const reader = createReader(runtime),
    social = createReadingSocial(runtime);
  const chapter = {
    id: "chapter-1",
    chapterNumber: "1",
    title: "One",
    translatedLanguage: "en",
  };
  await reader.open("manga-1", chapter);
  let ui!: ReactTestRenderer;
  t.after(async () => {
    await act(async () => ui?.unmount());
    social.dispose();
    reader.close();
    runtime.dispose();
  });
  await act(async () => {
    ui = create(
      React.createElement(NativeReaderView, {
        runtime,
        reader,
        social,
        chapters: [chapter],
        onAccount() {},
        onChapter() {},
      }),
    );
  });
  await act(async () => button(ui, "ตั้งค่าการอ่าน").props.onPress());
  await act(async () => button(ui, "หน้าเดียว").props.onPress());
  const imageScrolls = () =>
    ui.root.findAll(
      (node) =>
        String(node.type) === "ScrollView" &&
        node.props.horizontal &&
        node.props.contentContainerStyle?.minWidth === 390,
    );
  assert.equal(
    imageScrolls().at(-1)!.props.scrollEnabled,
    false,
    "native scrolling must not intercept unzoomed page swipes",
  );
  const gesture = ui.root.findAll(
    (node) => String(node.type) === "View" && node.props.onPanResponderRelease,
  )[0];
  assert.ok(gesture, "the rendered reader must handle swipe releases");
  await act(async () =>
    gesture.props.onPanResponderRelease({}, { dx: -100, dy: 2 }),
  );
  assert.equal(reader.snapshot().position?.pageIndex, 1);
  // A two-finger gesture whose centroid moves sideways is still only a pinch.
  await act(async () => {
    gesture.props.onPanResponderGrant({
      nativeEvent: {
        touches: [
          { pageX: 0, pageY: 0 },
          { pageX: 100, pageY: 0 },
        ],
      },
    });
    gesture.props.onPanResponderMove({
      nativeEvent: {
        touches: [
          { pageX: 0, pageY: 0 },
          { pageX: 200, pageY: 0 },
        ],
      },
    });
  });
  assert.equal(reader.snapshot().position?.zoom, 2);
  assert.equal(imageScrolls().at(-1)!.props.scrollEnabled, true);
  // Both move events and touch lifecycle events must rebase a replaced second finger.
  for (const [lift, rejoin] of [
    ["onPanResponderMove", "onPanResponderMove"],
    ["onPanResponderEnd", "onPanResponderStart"],
  ]) {
    await act(async () => {
      gesture.props[lift]({
        nativeEvent: { touches: [{ pageX: 0, pageY: 0 }] },
      });
      gesture.props[rejoin]({
        nativeEvent: {
          touches: [
            { pageX: 0, pageY: 0 },
            { pageX: 100, pageY: 0 },
          ],
        },
      });
    });
    assert.equal(
      reader.snapshot().position?.zoom,
      2,
      "rejoining must not jump zoom",
    );
    await act(async () => {
      gesture.props.onPanResponderMove({
        nativeEvent: {
          touches: [
            { pageX: 0, pageY: 0 },
            { pageX: 150, pageY: 0 },
          ],
        },
      });
    });
    assert.equal(reader.snapshot().position?.zoom, 3);
    await act(async () => {
      gesture.props.onPanResponderMove({
        nativeEvent: {
          touches: [
            { pageX: 0, pageY: 0 },
            { pageX: 100, pageY: 0 },
          ],
        },
      });
    });
    assert.equal(reader.snapshot().position?.zoom, 2);
  }
  await act(async () => {
    gesture.props.onPanResponderGrant({
      nativeEvent: {
        touches: [
          { pageX: 0, pageY: 0 },
          { pageX: 200, pageY: 0 },
        ],
      },
    });
    gesture.props.onPanResponderMove({
      nativeEvent: {
        touches: [
          { pageX: -140, pageY: 0 },
          { pageX: -40, pageY: 0 },
        ],
      },
    });
    gesture.props.onPanResponderRelease({}, { dx: -90, dy: 0 });
  });
  assert.equal(reader.snapshot().position?.zoom, 1);
  assert.equal(
    reader.snapshot().position?.pageIndex,
    1,
    "finishing a pinch must not turn the page",
  );
  await act(async () => {
    gesture.props.onPanResponderGrant({
      nativeEvent: { touches: [{ pageX: 0, pageY: 0 }] },
    });
    gesture.props.onPanResponderMove({
      nativeEvent: {
        touches: [
          { pageX: 0, pageY: 0 },
          { pageX: 150, pageY: 0 },
        ],
      },
    });
  });
  assert.equal(
    reader.snapshot().position?.zoom,
    1,
    "adding a second finger must initialize pinch geometry without jumping zoom",
  );
  for (const label of ["หน้าก่อน", "หน้าถัดไป", "ไปหน้า"])
    assert.equal(
      button(ui, label).parent?.props.horizontal,
      undefined,
      `${label} must not live in a horizontally scrolling toolbar`,
    );
  await act(async () => button(ui, "เลือกตอน").props.onPress());
  let handled = false;
  await act(async () => {
    handled = native.pressBack();
  });
  assert.equal(handled, true);
  assert.equal(button(ui, "1 · One · en · MangaDex"), undefined);
  assert.equal(reader.snapshot().status, "ready");
});
