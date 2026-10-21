import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { design } from "./design.ts";

const icons = {
  home: require("../assets/design/home.png"),
  community: require("../assets/design/community.png"),
  list: require("../assets/design/list.png"),
  bookmark: require("../assets/design/bookmark.png"),
  search: require("../assets/design/search.png"),
  back: require("../assets/design/back.png"),
  user: require("../assets/design/user.png"),
  book: require("../assets/design/book.png"),
  coins: require("../assets/design/coins.png"),
  bell: require("../assets/design/bell.png"),
};
export function NativeIcon({
  name,
  color = design.foreground,
  size = 20,
}: {
  name: keyof typeof icons;
  color?: string;
  size?: number;
}) {
  return (
    <Image
      accessible={false}
      source={icons[name]}
      style={{ width: size, height: size, tintColor: color }}
    />
  );
}
export function NativeBrand() {
  return (
    <Image
      accessibilityLabel="MangaDock"
      source={require("../assets/design/mangadock.png")}
      resizeMode="contain"
      style={{ width: 110, height: 36 }}
    />
  );
}
export function NativeTopBar({
  onBack,
  onAccount,
  accountLabel,
  onWallet,
  balance,
  onNotifications,
  unread = 0,
}: {
  onBack?: () => void;
  onAccount?: () => void;
  accountLabel?: string;
  onWallet?: () => void;
  balance?: number | null;
  onNotifications?: () => void;
  unread?: number;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        {onBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="กลับ"
            onPress={onBack}
            hitSlop={6}
            style={styles.iconButton}
          >
            <NativeIcon name="back" />
          </Pressable>
        )}
        <NativeBrand />
      </View>
      <View style={styles.row}>
        {onNotifications && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`การแจ้งเตือน ${unread} รายการยังไม่อ่าน`}
            onPress={onNotifications}
            style={styles.iconButton}
          >
            <NativeIcon name="bell" size={18} />
            {unread > 0 && (
              <Text style={{ color: design.primary, fontSize: 10 }}>
                {unread > 99 ? "99+" : unread}
              </Text>
            )}
          </Pressable>
        )}
        {onWallet && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`เติมเหรียญ ยอดปัจจุบัน ${balance ?? "กำลังโหลด"}`}
            onPress={onWallet}
            style={styles.coin}
          >
            <NativeIcon name="coins" color={design.amberText} size={16} />
            <Text style={styles.coinText}>
              {balance?.toLocaleString("th-TH") ?? "…"}
            </Text>
          </Pressable>
        )}
        {onAccount && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accountLabel}
            onPress={onAccount}
            style={styles.account}
          >
            <NativeIcon name="user" size={18} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: design.border,
    backgroundColor: design.background,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  account: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: design.tint,
    borderColor: design.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  coin: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: design.amberTint,
    borderColor: "rgba(245,158,11,0.3)",
    borderWidth: 1,
  },
  coinText: { color: design.amberText, fontSize: 12, fontWeight: "600" },
});
