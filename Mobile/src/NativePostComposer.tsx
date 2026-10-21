import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MobileRuntime } from "./runtime.ts";
import { createForum } from "./forum.ts";
import { createMedia } from "./media.ts";
import { createApi } from "./api.ts";
import type { Book } from "./catalog.ts";
import { pickImages } from "./native-images.ts";
import { imageUri } from "./assets.ts";
import { design } from "./design.ts";
export function NativePostComposer({
  runtime,
  onClose,
  onCreated,
}: {
  runtime: MobileRuntime;
  onClose(): void;
  onCreated(id: string): void;
}) {
  const [forum] = useState(() => createForum(runtime)),
    [media] = useState(() => createMedia(runtime));
  const session = useSyncExternalStore(
    runtime.session.subscribe,
    runtime.session.snapshot,
  );
  const [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [category, setCategory] = useState<
      "general" | "announcement" | "spoiler" | "manga_update"
    >("general");
  const [query, setQuery] = useState(""),
    [books, setBooks] = useState<Book[]>([]),
    [book, setBook] = useState<Book | null>(null),
    [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const active = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    active.current = true;
    forum.activate();
    media.activate();
    return () => {
      active.current = false;
      forum.dispose();
      media.dispose();
    };
  }, [forum, media]);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setBooks([]);
    const timer = setTimeout(() => {
      if (query.trim().length < 2) return;
      void createApi(runtime)
        .json<{ items: Book[] }>(
          `books/search?q=${encodeURIComponent(query.trim())}&limit=5&offset=0`,
          { signal: controller.signal },
        )
        .then((result) => {
          if (current) setBooks(result.items);
        })
        .catch((failure) => {
          if (current && !controller.signal.aborted)
            setError(
              failure instanceof Error ? failure.message : "ค้นหาไม่สำเร็จ",
            );
        });
    }, 400);
    return () => {
      current = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, runtime]);
  async function run(work: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error ? failure.message : "ทำรายการไม่สำเร็จ",
        );
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }
  const button = (label: string, work: () => void, disabled = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={work}
      style={[styles.button, (busy || disabled) && { opacity: 0.5 }]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.heading}>สร้างโพสต์</Text>
          {button("ปิด", onClose)}
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.row}>
            {(["general", "spoiler", "manga_update", "announcement"] as const)
              .filter(
                (value) =>
                  value !== "announcement" ||
                  Number(session.account?.role) >= 8,
              )
              .filter(
                (value) =>
                  value !== "manga_update" ||
                  Number(session.account?.role) >= 1,
              )
              .map((value) =>
                button(
                  `${category === value ? "● " : ""}${{ general: "ทั่วไป", spoiler: "สปอยล์", manga_update: "อัปเดต", announcement: "ประกาศ" }[value]}`,
                  () => setCategory(value),
                ),
              )}
          </View>
          <TextInput
            accessibilityLabel="หัวข้อโพสต์"
            placeholder="หัวข้อ (ไม่เกิน 200 ตัวอักษร)"
            placeholderTextColor={design.muted}
            value={title}
            onChangeText={setTitle}
            maxLength={200}
            editable={!busy}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel="เนื้อหาโพสต์"
            placeholder="เล่าเรื่องที่อยากคุย"
            placeholderTextColor={design.muted}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={10000}
            editable={!busy}
            style={[styles.input, { minHeight: 180, textAlignVertical: "top" }]}
          />
          <Text style={styles.muted}>เชื่อมกับมังงะ (เลือกได้)</Text>
          {book ? (
            button(`✓ ${book.title} · ยกเลิก`, () => setBook(null))
          ) : (
            <>
              <TextInput
                accessibilityLabel="ค้นหามังงะที่เกี่ยวข้อง"
                placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร"
                placeholderTextColor={design.muted}
                value={query}
                onChangeText={setQuery}
                editable={!busy}
                style={styles.input}
              />
              {books.map((item) =>
                button(item.title, () => {
                  setBook(item);
                  setBooks([]);
                  setQuery("");
                }),
              )}
            </>
          )}
          <View style={styles.row}>
            {images.map((url) => (
              <View key={url} style={{ width: "45%", gap: 6 }}>
                <Image
                  source={{ uri: imageUri(url, runtime.apiOrigin) }}
                  style={{ width: "100%", aspectRatio: 1, borderRadius: 12 }}
                />
                {button("ลบรูป", () =>
                  setImages((current) =>
                    current.filter((image) => image !== url),
                  ),
                )}
              </View>
            ))}
          </View>
          {button(
            `เพิ่มรูป (${images.length}/4)`,
            () =>
              void run(async () => {
                const selected = await pickImages(4 - images.length);
                for (const image of selected) {
                  if (!active.current) return;
                  const result = await media.upload(
                    "forum/upload-image",
                    image,
                  );
                  if (result && active.current)
                    setImages((current) => [...current, result.imageUrl]);
                }
              }),
            images.length >= 4,
          )}
          {busy && <ActivityIndicator color={design.primary} />}
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {button(
            "เผยแพร่โพสต์",
            () =>
              void run(async () => {
                const result = await forum.createPost({
                  title: title.trim(),
                  content: content.trim(),
                  category,
                  imageUrls: images,
                  ...(book
                    ? {
                        targetMangaId: book.id,
                        targetMangaTitle: book.title,
                        targetMangaCover: book.thumbnail,
                      }
                    : {}),
                });
                if (result && active.current) onCreated(result.id);
              }),
            !title.trim() || !content.trim(),
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: design.background },
  header: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  content: { padding: 16, gap: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  heading: { color: design.foreground, fontSize: 20, fontWeight: "700" },
  text: { color: design.foreground },
  muted: { color: design.muted },
  error: { color: design.error },
  input: {
    color: design.foreground,
    backgroundColor: design.surface,
    borderColor: design.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  button: {
    backgroundColor: design.tint,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: design.border,
  },
});
