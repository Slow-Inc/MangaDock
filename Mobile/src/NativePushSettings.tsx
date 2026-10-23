import React, { useState, useSyncExternalStore } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { design } from "./design.ts";
import type { PushNotifications } from "./push-notifications.ts";

export function NativePushSettings({ push }: { push: PushNotifications }) {
  const state = useSyncExternalStore(push.subscribe, push.snapshot);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  if (state.status === "unavailable" || state.status === "signedOut")
    return null;
  const labels = {
    off: "ปิดการแจ้งเตือนบนเครื่องอยู่",
    blocked: "ยังไม่ได้อนุญาตแจ้งเตือน กรุณาเปิดสิทธิ์ในการตั้งค่าเครื่อง",
    on: "เปิดรับแจ้งเตือนบนเครื่องแล้ว",
    error: "ยังตั้งค่าแจ้งเตือนไม่สำเร็จ",
  };
  async function preview() {
    if (testing) return;
    setTesting(true);
    setError(null);
    try {
      await push.preview();
    } catch {
      setError("ส่งแจ้งเตือนทดสอบไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setTesting(false);
    }
  }
  const disabled = state.busy || testing;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>แจ้งเตือนบนเครื่อง</Text>
      <Text accessibilityLiveRegion="polite" style={styles.caption}>
        {state.busy ? "กำลังตั้งค่าแจ้งเตือน…" : labels[state.status]}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: state.busy }}
        disabled={disabled}
        style={[styles.button, disabled && styles.disabled]}
        onPress={() => {
          setError(null);
          void (state.status === "on" ? push.disable() : push.enable());
        }}
      >
        <Text style={styles.text}>
          {state.status === "on"
            ? "ปิดแจ้งเตือนบนเครื่อง"
            : "เปิดรับแจ้งเตือนบนเครื่อง"}
        </Text>
      </Pressable>
      {state.status === "blocked" && (
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => {
            void Linking.openSettings().catch(() =>
              setError("เปิดการตั้งค่าเครื่องไม่สำเร็จ"),
            );
          }}
        >
          <Text style={styles.text}>เปิดการตั้งค่าเครื่อง</Text>
        </Pressable>
      )}
      {(state.status === "blocked" || state.status === "error") && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          style={[styles.button, disabled && styles.disabled]}
          onPress={() => {
            void push.disable();
          }}
        >
          <Text style={styles.text}>ปิดแจ้งเตือนบนเครื่อง</Text>
        </Pressable>
      )}
      {state.status === "on" && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          style={[styles.button, disabled && styles.disabled]}
          onPress={() => void preview()}
        >
          <Text style={styles.text}>ทดสอบแจ้งเตือนบนเครื่อง</Text>
        </Pressable>
      )}
      {(state.error || error) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {state.error || error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { color: design.foreground, fontSize: 16, fontWeight: "600" },
  caption: { color: design.muted, fontSize: 14, lineHeight: 22 },
  text: { color: design.foreground, fontSize: 14 },
  button: {
    minHeight: 48,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 12,
    padding: 12,
  },
  disabled: { opacity: 0.5 },
  error: { color: design.error, lineHeight: 22 },
});
