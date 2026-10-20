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
const { NativeSessionView } = await import("../src/NativeSessionView.tsx");
const { pickImages } = await import("../src/native-images.ts");
const { NativeReadingView } = await import("../src/NativeReadingView.tsx");
const { NativeReaderView } = await import("../src/NativeReaderView.tsx");
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
  const runtime: MobileRuntime = {
    ...options,
    auth: management,
    destination: {
      snapshot: () => null,
      subscribe: () => () => {},
      consume() {},
    },
    initialize: async () => {},
    dispose() {
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
