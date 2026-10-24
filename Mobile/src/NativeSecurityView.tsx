import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { createSecurity } from "./security.ts";
import type { MobileRuntime } from "./runtime.ts";
import { NativeQr } from "./NativeQr.tsx";
import { design } from "./design.ts";
export function NativeSecurityView({ runtime }: { runtime: MobileRuntime }) {
  const [security] = useState(() =>
    createSecurity({
      ...runtime,
      openAuthSession: (url, redirectTo) =>
        WebBrowser.openAuthSessionAsync(url, redirectTo),
    }),
  );
  const state = useSyncExternalStore(security.subscribe, security.snapshot);
  const [password, setPassword] = useState(""),
    [nextPassword, setNextPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [code, setCode] = useState(""),
    [deleteText, setDeleteText] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null);
  const pending = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    security.activate();
    void security.load();
    return () => {
      active.current = false;
      security.dispose();
    };
  }, [security]);
  async function run(work: () => Promise<unknown>, success: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await work();
      if (active.current && result !== false) {
        setMessage(success);
        setPassword("");
        setNextPassword("");
        setConfirmation("");
        setCode("");
      }
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
      disabled={busy || state.loading || disabled}
      onPress={work}
      style={[styles.button, (busy || disabled) && { opacity: 0.5 }]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
  const input = (
    label: string,
    value: string,
    change: (value: string) => void,
    secret = false,
  ) => (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      placeholderTextColor={design.muted}
      value={value}
      onChangeText={change}
      secureTextEntry={secret}
      autoCapitalize="none"
      editable={!busy}
      style={styles.input}
    />
  );
  const identities = state.user?.identities ?? [],
    hasPassword = identities.some((identity) => identity.provider === "email");
  const verified = state.factors.filter(
    (factor) => factor.factor_type === "totp" && factor.status === "verified",
  );
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>ความปลอดภัยและวิธีเข้าสู่ระบบ</Text>
      {state.loading && <ActivityIndicator color={design.primary} />}
      {(error || state.error) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error || state.error}
        </Text>
      )}
      {state.error && button("ลองโหลดใหม่", () => void security.load())}
      {message && <Text style={styles.success}>{message}</Text>}
      {state.user && (
        <>
          <View style={styles.card}>
            <Text style={styles.heading}>บัญชีที่เชื่อมต่อ</Text>
            <Text style={styles.muted}>{state.user.email}</Text>
            {(["google", "facebook"] as const).map((provider) => (
              <View key={provider} style={styles.row}>
                <Text style={styles.text}>
                  {provider === "google" ? "Google" : "Facebook"} ·{" "}
                  {identities.some((identity) => identity.provider === provider)
                    ? "เชื่อมแล้ว"
                    : "ยังไม่เชื่อม"}
                </Text>
                {identities.some((identity) => identity.provider === provider)
                  ? button(
                      `ยกเลิกเชื่อม ${provider}`,
                      () =>
                        Alert.alert(
                          "ยกเลิกการเชื่อมบัญชี",
                          "ยังต้องมีวิธีเข้าสู่ระบบอื่นอย่างน้อยหนึ่งวิธี",
                          [
                            { text: "ยกเลิก" },
                            {
                              text: "ยืนยัน",
                              onPress: () =>
                                void run(
                                  () => security.unlink(provider),
                                  "ยกเลิกการเชื่อมแล้ว",
                                ),
                            },
                          ],
                        ),
                      identities.length < 2,
                    )
                  : button(
                      `เชื่อม ${provider}`,
                      () =>
                        void run(
                          () => security.link(provider),
                          "เชื่อมบัญชีแล้ว",
                        ),
                    )}
              </View>
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.heading}>
              {hasPassword ? "เปลี่ยนรหัสผ่าน" : "เพิ่มรหัสผ่าน"}
            </Text>
            {hasPassword &&
              input("รหัสผ่านปัจจุบัน", password, setPassword, true)}
            {input("รหัสผ่านใหม่", nextPassword, setNextPassword, true)}
            {input("ยืนยันรหัสผ่านใหม่", confirmation, setConfirmation, true)}
            {verified.length > 0 &&
              input("รหัส Authenticator 6 หลัก", code, setCode)}
            {button(
              hasPassword ? "เปลี่ยนรหัสผ่าน" : "เพิ่มรหัสผ่าน",
              () =>
                void run(
                  () =>
                    hasPassword
                      ? security.changePassword(password, nextPassword, code)
                      : security.addPassword(nextPassword),
                  "บันทึกรหัสผ่านแล้ว",
                ),
              nextPassword.length < 6 ||
                nextPassword !== confirmation ||
                (hasPassword && !password),
            )}
          </View>
          <View style={styles.card}>
            <Text style={styles.heading}>ยืนยันตัวตนก่อนทำรายการ</Text>
            <Text style={styles.muted}>
              ใช้ได้ 5 นาทีสำหรับปิด MFA ออกจากอุปกรณ์อื่น และลบข้อมูลบัญชี
            </Text>
            {hasPassword &&
              input("รหัสผ่านสำหรับยืนยัน", password, setPassword, true)}
            {verified.length > 0 && input("รหัส Authenticator", code, setCode)}
            {hasPassword &&
              button(
                "ยืนยันด้วยรหัสผ่าน",
                () =>
                  void run(
                    () => security.reauthenticate(password, code),
                    "ยืนยันตัวตนแล้ว",
                  ),
                !password,
              )}
            {(["google", "facebook"] as const)
              .filter((provider) =>
                identities.some((identity) => identity.provider === provider),
              )
              .map((provider) =>
                button(
                  `ยืนยันด้วย ${provider}`,
                  () =>
                    void run(
                      () => security.reauthenticateOAuth(provider, code),
                      "ยืนยันตัวตนแล้ว",
                    ),
                ),
              )}
          </View>
          <View style={styles.card}>
            <Text style={styles.heading}>Authenticator (MFA)</Text>
            <Text style={styles.muted}>
              {verified.length ? "เปิดใช้งานแล้ว" : "ยังไม่เปิดใช้งาน"}
            </Text>
            {!verified.length &&
              !state.enrollment &&
              button(
                "ตั้งค่า Authenticator",
                () =>
                  void run(
                    () => security.startTotp(),
                    "สแกน QR แล้วกรอกรหัสเพื่อเปิด MFA",
                  ),
                !hasPassword,
              )}
            {!hasPassword && (
              <Text style={styles.muted}>เพิ่มรหัสผ่านก่อนเปิด MFA</Text>
            )}
            {state.enrollment && (
              <>
                <NativeQr
                  payload={state.enrollment.uri}
                  label="QR ตั้งค่า Authenticator"
                />
                <Text selectable style={styles.text}>
                  {state.enrollment.secret}
                </Text>
                {input("รหัสยืนยัน 6 หลัก", code, setCode)}
                {button(
                  "ยืนยันและเปิด MFA",
                  () =>
                    void run(() => security.finishTotp(code), "เปิด MFA แล้ว"),
                  !/^\d{6}$/.test(code),
                )}
                {button(
                  "ยกเลิกการตั้งค่า",
                  () =>
                    void run(
                      () => security.cancelTotp(),
                      "ยกเลิกการตั้งค่าแล้ว",
                    ),
                )}
              </>
            )}
            {verified.map((factor) =>
              button(`ปิด ${factor.friendly_name ?? "Authenticator"}`, () =>
                Alert.alert("ปิด MFA", "ยืนยันตัวตนก่อนปิด Authenticator", [
                  { text: "ยกเลิก" },
                  {
                    text: "ปิด MFA",
                    onPress: () =>
                      void run(
                        () => security.removeTotp(factor.id),
                        "ปิด MFA แล้ว",
                      ),
                  },
                ]),
              ),
            )}
          </View>
          <View style={styles.card}>
            <Text style={styles.heading}>อุปกรณ์ที่เคยใช้งาน</Text>
            <Text style={styles.muted}>
              ประวัติอุปกรณ์จากบัญชีเดิม ไม่ใช่รายการเซสชันที่ออนไลน์อยู่
            </Text>
            {state.devices.map((device) => (
              <View key={device.id} style={styles.root}>
                <Text style={styles.text}>
                  {device.user_agent ?? "ไม่ทราบอุปกรณ์"}
                </Text>
                <Text style={styles.muted}>
                  ล่าสุด {new Date(device.last_seen).toLocaleString("th-TH")}
                </Text>
              </View>
            ))}
            {!state.devices.length && (
              <Text style={styles.muted}>ยังไม่มีประวัติอุปกรณ์</Text>
            )}
            {button(
              "ออกจากระบบบนอุปกรณ์อื่น",
              () =>
                void run(
                  () => security.signOutOthers(),
                  "ออกจากอุปกรณ์อื่นแล้ว",
                ),
            )}
          </View>
          <View style={styles.card}>
            <Text style={[styles.heading, styles.error]}>
              ลบข้อมูลบัญชี MangaDock
            </Text>
            <Text style={styles.muted}>
              ลบโปรไฟล์และข้อมูลที่ระบบเดิมรองรับ บัญชีเข้าสู่ระบบ Supabase
              ยังไม่ได้ถูกลบ รายการนี้ย้อนกลับไม่ได้
            </Text>
            {input("พิมพ์ ลบบัญชี เพื่อยืนยัน", deleteText, setDeleteText)}
            {button(
              "ลบข้อมูลบัญชี",
              () =>
                Alert.alert(
                  "ลบข้อมูลบัญชี MangaDock?",
                  "โปรไฟล์และข้อมูลส่วนตัวที่ระบบรองรับจะถูกลบถาวร",
                  [
                    { text: "ยกเลิก" },
                    {
                      text: "ลบข้อมูล",
                      style: "destructive",
                      onPress: () =>
                        void run(
                          () => security.deleteProductData(deleteText),
                          "ลบข้อมูลแล้ว",
                        ),
                    },
                  ],
                ),
              deleteText !== "ลบบัญชี",
            )}
          </View>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { gap: 14 },
  card: {
    borderWidth: 1,
    borderColor: design.border,
    padding: 16,
    gap: 14,
    borderRadius: 18,
    backgroundColor: design.tint,
  },
  row: { gap: 10 },
  heading: { color: design.foreground, fontWeight: "700", fontSize: 18 },
  text: { color: design.foreground },
  muted: { color: design.muted },
  error: { color: design.error },
  success: { color: design.success },
  input: {
    padding: 12,
    color: design.foreground,
    backgroundColor: design.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: design.border,
  },
  button: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: design.border,
    backgroundColor: design.surface,
  },
});
