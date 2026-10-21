import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { NativeIcon } from "./NativeDesign.tsx";
import { design } from "./design.ts";
import type { NativeTab } from "./navigation.ts";

const destinations = [
  ["home", "หน้าหลัก", "home"],
  ["new", "ทั้งหมด", "book"],
  ["community", "คอมมูนิตี้", "community"],
  ["search", "ค้นหา", "search"],
  ["categories", "หมวดหมู่", "list"],
  ["library", "ของฉัน", "bookmark"],
] as const;
export function NativeBottomNavigation({
  tab,
  onSelect,
}: {
  tab: NativeTab;
  onSelect(tab: NativeTab): void;
}) {
  return (
    <View style={styles.root}>
      {destinations.map(([destination, label, icon]) => (
        <Pressable
          key={destination}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === destination }}
          accessibilityLabel={label}
          onPress={() => onSelect(destination)}
          style={styles.tab}
        >
          <NativeIcon
            name={icon}
            color={tab === destination ? design.foreground : "#ffffff73"}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              tab === destination && { color: design.foreground },
            ]}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  root: {
    height: 64,
    backgroundColor: design.background,
    borderTopWidth: 1,
    borderTopColor: design.border,
    flexDirection: "row",
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
  label: { fontSize: 11, color: "#ffffff73" },
});
