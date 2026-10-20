import React, { useEffect, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Book } from "./catalog.ts";
import type { createPersonal, LibraryTab } from "./personal.ts";
import { design } from "./design.ts";

const actions: Array<[Exclude<LibraryTab, "history">, string, string]> = [
  ["favorites", "บันทึก", "บันทึกแล้ว"],
  ["follows", "ติดตาม", "กำลังติดตาม"],
  ["liked", "ถูกใจ", "ถูกใจแล้ว"],
];
export function NativeCollectionActions({
  personal,
  book,
  onAccount,
}: {
  personal: ReturnType<typeof createPersonal>;
  book: Book;
  onAccount(): void;
}) {
  const { membership, loginRequired } = useSyncExternalStore(
    personal.subscribe,
    personal.snapshot,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void personal.loadMembership(book.id);
  }, [personal, book.id]);
  if (loginRequired)
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onAccount}
        style={styles.button}
      >
        <Text style={styles.label}>
          เข้าสู่ระบบเพื่อบันทึก ติดตาม หรือถูกใจ
        </Text>
      </Pressable>
    );
  return (
    <View style={{ gap: 8 }}>
      {membership.loading && (
        <ActivityIndicator
          accessibilityLabel="กำลังโหลดสถานะรายการ"
          color={design.primary}
        />
      )}
      <View style={styles.row}>
        {actions.map(([tab, label, selectedLabel]) => (
          <Pressable
            key={tab}
            accessibilityRole="button"
            accessibilityState={{
              selected: membership[tab],
              disabled:
                busy ||
                membership.loading ||
                !!membership.error ||
                membership.id !== book.id,
            }}
            disabled={
              busy ||
              membership.loading ||
              !!membership.error ||
              membership.id !== book.id
            }
            style={[styles.button, membership[tab] && styles.selected]}
            onPress={() => {
              setBusy(true);
              setError(null);
              void personal
                .setCollection(tab, book, !membership[tab])
                .catch((failure) =>
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "บันทึกรายการไม่สำเร็จ",
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            <Text
              style={[
                styles.label,
                membership[tab] && { color: design.primary },
              ]}
            >
              {membership[tab] ? selectedLabel : label}
            </Text>
          </Pressable>
        ))}
      </View>
      {(error || membership.error) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error || membership.error}
        </Text>
      )}
      {membership.error && (
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => void personal.loadMembership(book.id)}
        >
          <Text style={styles.label}>ลองอีกครั้ง</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  button: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: design.tint,
    borderWidth: 1,
    borderColor: design.border,
  },
  selected: { borderColor: design.primary },
  label: { color: design.foreground, fontSize: 12, textAlign: "center" },
  error: { color: design.error, lineHeight: 22, textAlign: "center" },
});
