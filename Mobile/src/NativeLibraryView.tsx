import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { createPersonal, HistoryBook, LibraryTab } from "./personal.ts";
import { NativeBookCard } from "./NativeDiscoveryView.tsx";
import { design } from "./design.ts";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";
import { shareHistoryCSV } from "./files.ts";
const tabs: Array<[LibraryTab, string]> = [
  ["favorites", "รายการโปรด"],
  ["follows", "ติดตาม"],
  ["liked", "ถูกใจ"],
  ["history", "อ่านต่อ"],
];
export function NativeLibraryView({
  personal,
  apiOrigin,
  onBook,
  onAccount,
  onContinue,
}: {
  personal: ReturnType<typeof createPersonal>;
  apiOrigin: string;
  onBook(id: string): void;
  onAccount(): void;
  onContinue(item: HistoryBook): void;
}) {
  const state = useSyncExternalStore(personal.subscribe, personal.snapshot);
  const { width } = useWindowDimensions();
  const columns = width >= 640 ? 3 : 2;
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const active = useRef(true);
  const running = useRef(false);
  const files = useRef(new Set<File>());
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      files.current.forEach((file) => {
        if (file.exists) file.delete();
      });
      files.current.clear();
    };
  }, []);
  useEffect(() => {
    setCategory("all");
    setPage(1);
    setActionError(null);
  }, [state.tab]);
  const categories = [
    ...new Set(state.items.flatMap((book) => book.categories ?? [])),
  ].sort();
  const filtered =
    category === "all"
      ? state.items
      : state.items.filter((book) => book.categories?.includes(category));
  const pages = Math.max(1, Math.ceil(filtered.length / 28));
  const currentPage = Math.min(page, pages);
  async function run(action: () => Promise<unknown>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (failure) {
      if (active.current)
        setActionError(
          failure instanceof Error
            ? failure.message
            : "ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง",
        );
    } finally {
      running.current = false;
      if (active.current) setBusy(false);
    }
  }
  function exportCSV() {
    void run(async () => {
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("อุปกรณ์นี้ยังไม่พร้อมสำหรับส่งออกไฟล์");
      await shareHistoryCSV({
        personal,
        isCurrent: () => active.current,
        createFile: async (csv) => {
          const file = new File(
            Paths.cache,
            `reading-history-${Crypto.randomUUID()}.csv`,
          );
          file.create();
          file.write(csv);
          files.current.add(file);
          return {
            uri: file.uri,
            remove() {
              if (file.exists) file.delete();
              files.current.delete(file);
            },
          };
        },
        share: (uri) =>
          Sharing.shareAsync(uri, {
            mimeType: "text/csv",
            dialogTitle: "ส่งออกประวัติการอ่าน",
            UTI: "public.comma-separated-values-text",
          }),
      });
    });
  }
  return (
    <FlatList
      key={columns}
      numColumns={columns}
      data={filtered.slice((currentPage - 1) * 28, currentPage * 28)}
      refreshing={state.loading}
      onRefresh={() => void personal.load(state.tab)}
      keyExtractor={(book) => book.id}
      style={styles.root}
      contentContainerStyle={{ padding: 16, gap: 24 }}
      columnWrapperStyle={{ gap: 12 }}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <Text style={styles.title}>รายการของฉัน</Text>
          {!state.loginRequired && state.tab === "history" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                style={styles.chip}
                onPress={exportCSV}
              >
                <Text style={styles.caption}>ส่งออก CSV</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy || !state.history.length}
                style={styles.chip}
                onPress={() =>
                  Alert.alert(
                    "ล้างประวัติทั้งหมด?",
                    "ประวัติการอ่านของบัญชีนี้จะถูกลบจากระบบเดิม",
                    [
                      { text: "ยกเลิก", style: "cancel" },
                      {
                        text: "ล้างประวัติ",
                        style: "destructive",
                        onPress: () => void run(() => personal.removeHistory()),
                      },
                    ],
                  )
                }
              >
                <Text style={styles.error}>ล้างประวัติ</Text>
              </Pressable>
            </View>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {tabs.map(([tab, label]) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: state.tab === tab }}
                key={tab}
                onPress={() => void personal.load(tab)}
                style={[styles.chip, state.tab === tab && styles.selected]}
              >
                <Text
                  style={[
                    styles.caption,
                    state.tab === tab && { color: design.background },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {categories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {["all", ...categories].map((value) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === value }}
                  key={value}
                  onPress={() => {
                    setCategory(value);
                    setPage(1);
                  }}
                  style={[styles.chip, category === value && styles.selected]}
                >
                  <Text
                    style={[
                      styles.caption,
                      category === value && { color: design.background },
                    ]}
                  >
                    {value === "all" ? "ทั้งหมด" : value}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {!state.loginRequired && !state.loading && !state.error && (
            <Text style={styles.caption}>
              {filtered.length.toLocaleString("th-TH")} เรื่อง
            </Text>
          )}
          {actionError && (
            <Text accessibilityRole="alert" style={styles.error}>
              {actionError}
            </Text>
          )}
          {busy && (
            <ActivityIndicator
              accessibilityLabel="กำลังทำรายการ"
              color={design.primary}
            />
          )}
          {state.loading && (
            <ActivityIndicator
              accessibilityLabel="กำลังโหลดรายการของฉัน"
              color={design.primary}
            />
          )}
          {state.loginRequired && (
            <View style={styles.notice}>
              <Text style={styles.caption}>เข้าสู่ระบบเพื่อดูรายการของคุณ</Text>
              <Pressable
                accessibilityRole="button"
                onPress={onAccount}
                style={styles.chip}
              >
                <Text style={styles.caption}>เข้าสู่ระบบ</Text>
              </Pressable>
            </View>
          )}
          {state.error && (
            <View style={styles.notice}>
              <Text accessibilityRole="alert" style={styles.error}>
                {state.error}
              </Text>
              <Pressable
                accessibilityRole="button"
                style={styles.chip}
                onPress={() => void personal.load(state.tab)}
              >
                <Text style={styles.caption}>ลองอีกครั้ง</Text>
              </Pressable>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        !state.loading && !state.loginRequired && !state.error ? (
          <Text style={styles.caption}>ยังไม่มีเรื่องในรายการนี้</Text>
        ) : null
      }
      renderItem={({ item }) => (
        <View
          style={{ width: (width - 32 - (columns - 1) * 12) / columns, gap: 8 }}
        >
          <NativeBookCard
            book={item}
            apiOrigin={apiOrigin}
            onBook={
              state.tab === "history"
                ? (id) => {
                    const entry = state.history.find((book) => book.id === id);
                    if (entry) onContinue(entry);
                  }
                : onBook
            }
            width={(width - 32 - (columns - 1) * 12) / columns}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            style={styles.chip}
            onPress={() =>
              void run(() =>
                state.tab === "history"
                  ? personal.removeHistory(item.id)
                  : personal.setCollection(state.tab, item, false),
              )
            }
          >
            <Text style={styles.caption}>
              {state.tab === "history"
                ? "นำออกจากประวัติ"
                : state.tab === "follows"
                  ? "เลิกติดตาม"
                  : state.tab === "liked"
                    ? "เลิกถูกใจ"
                    : "นำออกจากรายการ"}
            </Text>
          </Pressable>
        </View>
      )}
      ListFooterComponent={
        pages > 1 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              accessibilityRole="button"
              disabled={currentPage === 1}
              style={styles.chip}
              onPress={() => setPage(currentPage - 1)}
            >
              <Text style={styles.caption}>‹ ก่อนหน้า</Text>
            </Pressable>
            <Text style={styles.caption}>
              {currentPage} / {pages}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={currentPage === pages}
              style={styles.chip}
              onPress={() => setPage(currentPage + 1)}
            >
              <Text style={styles.caption}>ถัดไป ›</Text>
            </Pressable>
          </View>
        ) : null
      }
    />
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: design.background },
  title: { color: design.foreground, fontSize: 24, fontWeight: "800" },
  caption: { color: design.muted, fontSize: 12, lineHeight: 20 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: design.tint,
    justifyContent: "center",
  },
  selected: { backgroundColor: design.foreground },
  notice: { gap: 12 },
  error: { color: design.error, lineHeight: 22 },
});
