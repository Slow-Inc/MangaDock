import test from "node:test";
import assert from "node:assert/strict";
import "./support/native.ts";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { Chapter } from "../src/catalog.ts";
const { NativeChapterList } = await import("../src/NativeChapterList.tsx");

test("chapter rows distinguish known page counts, unknown counts and paid Studio versions without losing their identity", async (t) => {
  const chapters: Chapter[] = [
    {
      id: "original",
      chapterNumber: "1",
      title: "Original",
      translatedLanguage: "en",
      pageCount: 24,
    },
    {
      id: "unknown",
      chapterNumber: null,
      title: null,
      translatedLanguage: "ja",
    },
    {
      id: "ver:paid",
      chapterNumber: "1",
      title: "แปลไทย",
      translatedLanguage: "th",
      source: "studio",
      translatorName: "Creator",
      pageCount: 30,
      priceCoins: 5,
    },
  ];
  const selected: Chapter[] = [];
  let ui!: ReactTestRenderer;
  t.after(async () => {
    await act(async () => ui?.unmount());
  });
  await act(async () => {
    ui = create(
      React.createElement(NativeChapterList, {
        chapters,
        busy: false,
        onSelect: (chapter) => selected.push(chapter),
      }),
    );
  });
  const texts = ui.root
    .findAll((node) => String(node.type) === "Text")
    .map((node) => node.children.join(""));
  assert.ok(texts.includes("24 หน้า"));
  assert.ok(texts.includes("พร้อมอ่าน"));
  assert.ok(texts.includes("5 เหรียญ"));
  assert.ok(texts.includes("ภาษาไทย"));
  assert.ok(texts.includes("Studio · Creator"));
  assert.ok(!texts.includes("0 หน้า"));
  const rows = ui.root.findAll((node) => String(node.type) === "Pressable");
  await act(async () => rows[2].props.onPress());
  assert.deepEqual(selected, [chapters[2]]);
  await act(async () =>
    ui.update(
      React.createElement(NativeChapterList, {
        chapters,
        busy: true,
        onSelect: (chapter) => selected.push(chapter),
      }),
    ),
  );
  const busyRow = ui.root.findAll(
    (node) => String(node.type) === "Pressable",
  )[2];
  assert.equal(busyRow.props.disabled, true);
  await act(async () => busyRow.props.onPress());
  assert.deepEqual(
    selected,
    [chapters[2]],
    "busy rows must not enqueue another open request",
  );
});

test("an empty chapter list has no empty scrolling viewport or selectable row", async (t) => {
  let ui!: ReactTestRenderer;
  t.after(async () => {
    await act(async () => ui?.unmount());
  });
  await act(async () => {
    ui = create(
      React.createElement(NativeChapterList, {
        chapters: [],
        busy: false,
        onSelect() {
          assert.fail("empty list selection");
        },
      }),
    );
  });
  assert.ok(
    ui.root
      .findAll((node) => String(node.type) === "Text")
      .some((node) => node.children.join("") === "ไม่พบตอนที่อ่านได้"),
  );
  assert.equal(
    ui.root.findAll(
      (node) =>
        String(node.type) === "Pressable" || String(node.type) === "ScrollView",
    ).length,
    0,
  );
});
