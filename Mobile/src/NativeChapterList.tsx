import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { Chapter } from "./catalog.ts";
import { design } from "./design.ts";

export function NativeChapterList({
  chapters,
  busy,
  onSelect,
}: {
  chapters: Chapter[];
  busy: boolean;
  onSelect(chapter: Chapter): void;
}) {
  const { height } = useWindowDimensions();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        ตอนทั้งหมด ({chapters.length})
      </Text>
      {chapters.length ? (
        <ScrollView
          accessibilityLabel="รายการตอน"
          nestedScrollEnabled
          persistentScrollbar
          style={{ maxHeight: Math.min(height * 0.5, 320), flexGrow: 0 }}
          contentContainerStyle={styles.list}
        >
          {chapters.map((chapter) => {
            const title = `ตอนที่ ${chapter.chapterNumber || "พิเศษ"}${chapter.title ? ` · ${chapter.title}` : ""}`;
            const language =
              chapter.translatedLanguage === "th"
                ? "ภาษาไทย"
                : chapter.translatedLanguage.toUpperCase();
            const source =
              chapter.source === "studio"
                ? `Studio · ${chapter.translatorName || "นักแปล"}`
                : "MangaDex";
            const paid = (chapter.priceCoins ?? 0) > 0;
            const pageCount = chapter.pageCount ?? 0;
            const status = paid
              ? `${chapter.priceCoins} เหรียญ`
              : Number.isInteger(pageCount) && pageCount > 0
                ? `${pageCount} หน้า`
                : "พร้อมอ่าน";
            return (
              <Pressable
                key={chapter.id}
                accessibilityRole="button"
                accessibilityLabel={`${title}, ${language}, ${source}, ${status}`}
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() => {
                  if (!busy) onSelect(chapter);
                }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.pressed,
                  busy && styles.disabled,
                ]}
              >
                <View style={styles.info}>
                  <Text numberOfLines={2} style={styles.title}>
                    {title}
                  </Text>
                  <View style={styles.metadata}>
                    <Text style={styles.language}>{language}</Text>
                    <Text numberOfLines={1} style={styles.source}>
                      {source}
                    </Text>
                  </View>
                </View>
                <View style={[styles.badge, paid && styles.paidBadge]}>
                  <Text style={[styles.status, paid && styles.price]}>
                    {status}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={styles.source}>ไม่พบตอนที่อ่านได้</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { color: design.foreground, fontSize: 16, fontWeight: "700" },
  list: { gap: 6, paddingRight: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 64,
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 8,
  },
  pressed: { backgroundColor: design.tint },
  disabled: { opacity: 0.5 },
  info: { flex: 1, minWidth: 0, gap: 6 },
  title: {
    color: design.foreground,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
  },
  metadata: { flexDirection: "row", alignItems: "center", gap: 8 },
  language: {
    color: design.foreground,
    backgroundColor: design.tint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  source: { color: design.muted, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  badge: {
    maxWidth: "40%",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: design.tint,
    borderRadius: 4,
  },
  paidBadge: { backgroundColor: design.amberTint },
  status: { color: design.success, fontSize: 12, lineHeight: 18 },
  price: { color: design.amberText },
});
