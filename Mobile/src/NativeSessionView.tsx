import React, { useEffect, useState, useSyncExternalStore } from "react";
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
import { NativeReadingView } from "./NativeReadingView.tsx";
import { design } from "./design.ts";
import { NativeBrand } from "./NativeDesign.tsx";
import { NativeAccountView } from "./NativeAccountView.tsx";
import type { NotificationDestination } from "./notification-links.ts";
import { NativeAuthCallbackView } from "./NativeAuthCallbackView.tsx";

export function NativeSessionView({ runtime }: { runtime: MobileRuntime }) {
  const session = runtime.session;
  const state = useSyncExternalStore(session.subscribe, session.snapshot);
  const authState = useSyncExternalStore(
    runtime.auth.subscribe,
    runtime.auth.snapshot,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guest, setGuest] = useState(true);
  const [showAccount, setShowAccount] = useState(false);
  const [destination, setDestination] =
    useState<NotificationDestination | null>(null);
  const incoming = useSyncExternalStore(
    runtime.destination.subscribe,
    runtime.destination.snapshot,
  );
  useEffect(() => {
    if (!incoming) return;
    setDestination(incoming);
    setShowAccount(false);
    setGuest(true);
    runtime.destination.consume();
  }, [incoming, runtime]);
  useEffect(() => {
    if (authState.recoveryReady || authState.error) return;
    if (
      !showAccount &&
      (state.status === "signedIn" || guest) &&
      state.status !== "mfaRequired"
    )
      return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (busy) return true;
      if (state.status === "mfaRequired") void run(() => session.signOut());
      else if (mode !== "login" && state.status !== "signedIn") {
        setMode("login");
        setPassword("");
        setConfirmation("");
        setError(null);
      } else {
        setShowAccount(false);
        setGuest(true);
        setPassword("");
        setConfirmation("");
        setCode("");
      }
      return true;
    });
    return () => listener.remove();
  }, [
    authState.recoveryReady,
    authState.error,
    showAccount,
    state.status,
    guest,
    mode,
    busy,
    session,
  ]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setPassword("");
      setConfirmation("");
      setCode("");
      if (session.snapshot().status === "signedIn") setShowAccount(false);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "ไม่สามารถเชื่อมต่อได้ กรุณาลองอีกครั้ง",
      );
    } finally {
      setBusy(false);
    }
  }
  const button = (
    label: string,
    action: () => Promise<void>,
    secondary = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={() => void run(action)}
      style={[
        styles.button,
        secondary && styles.secondary,
        busy && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {label}
      </Text>
    </Pressable>
  );
  async function submit() {
    if (mode === "forgot") {
      await runtime.auth.requestRecovery(email);
      setMessage("ถ้าอีเมลนี้มีบัญชี กรุณาตรวจสอบอีเมลเพื่อกู้รหัสผ่าน");
    } else if (mode === "register") {
      if (password !== confirmation) throw new Error("รหัสผ่านไม่ตรงกัน");
      if (await runtime.auth.signUp(email, password, name))
        setMessage("กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี");
    } else await session.signIn(email.trim(), password);
  }
  if (authState.recoveryReady || authState.error)
    return <NativeAuthCallbackView runtime={runtime} />;
  if (
    (state.status === "signedIn" && !showAccount) ||
    (state.status === "signedOut" && guest)
  )
    return (
      <NativeReadingView
        key={state.account?.uid ?? "guest"}
        runtime={runtime}
        initialDestination={destination}
        onDestinationHandled={() => setDestination(null)}
        accountLabel={
          state.status === "signedIn" ? "บัญชีของฉัน" : "เข้าสู่ระบบ"
        }
        onAccount={() => {
          setGuest(false);
          setShowAccount(true);
        }}
        onAccountDestination={(next) => {
          setDestination(next);
          setGuest(false);
          setShowAccount(true);
        }}
      />
    );
  if (state.status === "signedIn")
    return (
      <NativeAccountView
        key={state.account.uid}
        runtime={runtime}
        onBack={() => {
          setShowAccount(false);
          setGuest(true);
        }}
        onNavigate={(next) => {
          setDestination(next);
          setShowAccount(false);
        }}
      />
    );
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <NativeBrand />
        </View>
        {state.status === "mfaRequired" ? (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>ยืนยันตัวตน</Text>
            <Text style={styles.title}>รหัสจากแอป Authenticator</Text>
            <Text style={styles.caption}>
              กรอกรหัส 6 หลักเพื่อเข้าสู่บัญชีของคุณ
            </Text>
            <TextInput
              accessibilityLabel="รหัสยืนยัน 6 หลัก"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
              style={styles.input}
              editable={!busy}
            />
            {button("ยืนยันรหัส", () => session.verifyTotp(code))}
            {button("กลับไปเข้าสู่ระบบ", () => session.signOut(), true)}
          </View>
        ) : (
          <View style={styles.card}>
            <View accessible={false} style={styles.handle} />
            <Text style={styles.title}>
              {mode === "register"
                ? "สมัครสมาชิก"
                : mode === "forgot"
                  ? "กู้รหัสผ่าน"
                  : "ยินดีต้อนรับ"}
            </Text>
            <Text style={styles.caption}>
              เข้าถึงฟีเจอร์ทั้งหมดของ MangaDock
            </Text>
            {mode === "login" &&
              button(
                "เข้าสู่ระบบด้วย Google",
                () => session.signInOAuth("google"),
                true,
              )}
            {mode === "login" &&
              button(
                "เข้าสู่ระบบด้วย Facebook",
                () => session.signInOAuth("facebook"),
                true,
              )}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.divider}>หรือเข้าสู่ระบบด้วยอีเมล</Text>
              <View style={styles.dividerLine} />
            </View>
            {mode === "register" && (
              <>
                <Text style={styles.label}>ชื่อที่แสดง</Text>
                <TextInput
                  accessibilityLabel="ชื่อที่แสดง"
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  editable={!busy}
                  autoComplete="name"
                />
              </>
            )}
            <Text style={styles.label}>อีเมล</Text>
            <TextInput
              accessibilityLabel="อีเมล"
              placeholder="you@example.com"
              placeholderTextColor={design.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="username"
              style={styles.input}
              editable={!busy}
            />
            {mode !== "forgot" && (
              <>
                <Text style={styles.label}>รหัสผ่าน</Text>
                <TextInput
                  accessibilityLabel="รหัสผ่าน"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  style={styles.input}
                  editable={!busy}
                  onSubmitEditing={() => mode === "login" && void run(submit)}
                />
              </>
            )}
            {mode === "register" && (
              <>
                <Text style={styles.label}>ยืนยันรหัสผ่าน</Text>
                <TextInput
                  accessibilityLabel="ยืนยันรหัสผ่าน"
                  value={confirmation}
                  onChangeText={setConfirmation}
                  secureTextEntry
                  autoComplete="new-password"
                  style={styles.input}
                  editable={!busy}
                />
              </>
            )}
            {button(
              mode === "register"
                ? "สมัครสมาชิก"
                : mode === "forgot"
                  ? "ส่งลิงก์กู้รหัสผ่าน"
                  : "เข้าสู่ระบบ",
              submit,
            )}
            {mode === "login" ? (
              <>
                {button(
                  "สมัครบัญชีใหม่",
                  async () => setMode("register"),
                  true,
                )}
                {button("ลืมรหัสผ่าน", async () => setMode("forgot"), true)}
              </>
            ) : (
              button("กลับไปเข้าสู่ระบบ", async () => setMode("login"), true)
            )}
            {message && <Text style={styles.caption}>{message}</Text>}
            {authState.verificationEmail &&
              button(
                "ส่งอีเมลยืนยันอีกครั้ง",
                async () => {
                  if (await runtime.auth.resendVerification())
                    setMessage("ส่งอีเมลยืนยันแล้ว กรุณาตรวจสอบกล่องจดหมาย");
                },
                true,
              )}
            {button(
              "กลับไปหน้าหลัก",
              async () => {
                setGuest(true);
                setShowAccount(false);
              },
              true,
            )}
          </View>
        )}
        {busy && (
          <ActivityIndicator
            accessibilityLabel="กำลังดำเนินการ"
            color={design.primary}
          />
        )}
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: design.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 16,
    justifyContent: "center",
  },
  brand: { alignItems: "center", marginBottom: 8 },
  card: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    backgroundColor: design.sheet,
    borderColor: design.border,
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    gap: 12,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 8,
  },
  eyebrow: { color: "#a5b4fc", fontSize: 12, fontWeight: "700" },
  title: { color: design.foreground, fontSize: 20, fontWeight: "900" },
  caption: { color: design.muted, fontSize: 12, lineHeight: 20 },
  label: {
    color: design.foreground,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 12,
    backgroundColor: design.tint,
    color: design.foreground,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 48,
  },
  button: {
    backgroundColor: design.auth,
    minHeight: 48,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: design.foreground, fontSize: 14, fontWeight: "600" },
  secondary: {
    backgroundColor: design.tint,
    borderColor: design.border,
    borderWidth: 1,
  },
  secondaryText: { color: design.foreground },
  disabled: { opacity: 0.55 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: design.border },
  divider: { color: design.muted, fontSize: 12, textAlign: "center" },
  error: { color: design.error, lineHeight: 22 },
});
