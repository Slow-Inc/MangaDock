import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { MobileRuntime } from "./runtime.ts";
import { NativeBrand } from "./NativeDesign.tsx";
import { design } from "./design.ts";
export function NativeAuthCallbackView({
  runtime,
}: {
  runtime: MobileRuntime;
}) {
  const state = useSyncExternalStore(
    runtime.auth.subscribe,
    runtime.auth.snapshot,
  );
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  function cancel() {
    if (pending.current) return;
    setPassword("");
    setConfirmation("");
    if (state.recoveryReady)
      void runtime.auth
        .cancelRecovery()
        .catch((failure) =>
          setError(
            failure instanceof Error ? failure.message : "ออกจากคำขอไม่สำเร็จ",
          ),
        );
    else runtime.auth.dismissError();
  }
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      cancel();
      return true;
    });
    return () => listener.remove();
  }, [state.recoveryReady, runtime]);
  async function save() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (password !== confirmation) throw new Error("รหัสผ่านไม่ตรงกัน");
      await runtime.auth.resetPassword(password);
      setPassword("");
      setConfirmation("");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <NativeBrand />
        <View style={styles.card}>
          <Text style={styles.heading}>
            {state.recoveryReady
              ? "ตั้งรหัสผ่านใหม่"
              : "เปิดลิงก์ยืนยันไม่สำเร็จ"}
          </Text>
          {state.recoveryReady && (
            <>
              <Text style={styles.muted}>{state.recoveryEmail}</Text>
              <TextInput
                accessibilityLabel="รหัสผ่านใหม่"
                placeholder="รหัสผ่านใหม่ อย่างน้อย 6 ตัวอักษร"
                placeholderTextColor={design.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                editable={!busy}
                style={styles.input}
              />
              <TextInput
                accessibilityLabel="ยืนยันรหัสผ่านใหม่"
                placeholder="ยืนยันรหัสผ่านใหม่"
                placeholderTextColor={design.muted}
                value={confirmation}
                onChangeText={setConfirmation}
                secureTextEntry
                autoComplete="new-password"
                editable={!busy}
                style={styles.input}
              />
              <Pressable
                disabled={
                  busy || password.length < 6 || password !== confirmation
                }
                onPress={() => void save()}
                style={[
                  styles.button,
                  (busy ||
                    password.length < 6 ||
                    password !== confirmation) && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.text}>บันทึกรหัสผ่านใหม่</Text>
              </Pressable>
            </>
          )}
          {(error || state.error) && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error || state.error}
            </Text>
          )}
          {busy && <ActivityIndicator color={design.primary} />}
          <Pressable disabled={busy} onPress={cancel} style={styles.secondary}>
            <Text style={styles.text}>
              {state.recoveryReady ? "ยกเลิก" : "กลับ"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: design.background },
  content: { padding: 24, gap: 30, justifyContent: "center", flexGrow: 1 },
  card: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: design.sheet,
    borderWidth: 1,
    borderColor: design.border,
    gap: 16,
  },
  heading: { color: design.foreground, fontSize: 24, fontWeight: "700" },
  muted: { color: design.muted },
  text: { color: design.foreground, textAlign: "center" },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: design.border,
    padding: 14,
    color: design.foreground,
    backgroundColor: design.surface,
  },
  button: { borderRadius: 12, padding: 14, backgroundColor: design.primary },
  secondary: { borderRadius: 12, padding: 14, backgroundColor: design.tint },
  error: { color: design.error },
});
