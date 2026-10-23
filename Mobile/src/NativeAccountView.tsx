import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { createAccountSettings } from "./account-settings.ts";
import { createAccountActivity } from "./account-activity.ts";
import { createPersonal } from "./personal.ts";
import {
  NativeAccountActivity,
  type ActivityScreen,
} from "./NativeAccountActivity.tsx";
import type { NotificationDestination } from "./notification-links.ts";
import type { MobileRuntime } from "./runtime.ts";
import { NativeTopBar } from "./NativeDesign.tsx";
import { imageUri } from "./assets.ts";
import { readingStats } from "./reading-stats.ts";
import { NativeSecurityView } from "./NativeSecurityView.tsx";
import { pickImages } from "./native-images.ts";
import { design } from "./design.ts";
import { NativePushSettings } from "./NativePushSettings.tsx";
const languages = [
  "th",
  "en",
  "ja",
  "ko",
  "zh",
  "vi",
  "id",
  "ms",
  "fr",
  "de",
  "es",
  "pt",
  "ru",
];
export function NativeAccountView({
  runtime,
  onBack,
  onNavigate,
}: {
  runtime: MobileRuntime;
  onBack(): void;
  onNavigate(destination: NotificationDestination): void;
}) {
  const [settings] = useState(() => createAccountSettings(runtime));
  const [activity] = useState(() => createAccountActivity(runtime));
  const [personal] = useState(() => createPersonal(runtime));
  const account = useSyncExternalStore(settings.subscribe, settings.snapshot);
  const history = useSyncExternalStore(personal.subscribe, personal.snapshot);
  const [tab, setTab] = useState("profile"),
    [screen, setScreen] = useState<ActivityScreen | null>(null);
  const [name, setName] = useState(""),
    [bio, setBio] = useState(""),
    [country, setCountry] = useState(""),
    [preferredLanguage, setPreferredLanguage] = useState(""),
    [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [success, setSuccess] = useState<string | null>(null);
  const pending = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    settings.activate();
    activity.activate();
    personal.activate();
    void settings.load();
    return () => {
      active.current = false;
      settings.dispose();
      activity.dispose();
      personal.dispose();
    };
  }, [settings, activity, personal]);
  useEffect(() => {
    if (account.profile) {
      setName(account.profile.displayName ?? "");
      setBio(account.profile.bio ?? "");
      setCountry(account.profile.country ?? "");
      setPreferredLanguage(account.profile.preferredLanguage ?? "");
      setSelectedLanguages(account.profile.translatorLanguages ?? []);
    }
  }, [account.profile]);
  useEffect(() => {
    if (tab === "stats") void personal.load("history");
  }, [tab, personal]);
  async function run(work: () => Promise<unknown>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await work();
      if (result !== false && active.current) setSuccess("บันทึกแล้ว");
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
      onPress={work}
      disabled={disabled}
      style={[styles.button, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
  const input = (
    label: string,
    value: string,
    change: (value: string) => void,
    multiline = false,
  ) => (
    <View style={styles.section}>
      <Text style={styles.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        editable={!busy}
        multiline={multiline}
        style={styles.input}
      />
    </View>
  );
  const stats = readingStats(history.history);
  const profile = account.profile;
  return (
    <View style={styles.root}>
      <NativeTopBar onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>ตั้งค่าบัญชี</Text>
        <View style={styles.row}>
          {button(tab === "profile" ? "● โปรไฟล์" : "โปรไฟล์", () =>
            setTab("profile"),
          )}
          {button(tab === "stats" ? "● สถิติ" : "สถิติการอ่าน", () =>
            setTab("stats"),
          )}
          {button("ความปลอดภัย", () => setTab("security"))}
        </View>
        {tab === "security" && <NativeSecurityView runtime={runtime} />}
        {account.loading && <ActivityIndicator color={design.primary} />}
        {account.error && (
          <>
            <Text style={styles.error}>{account.error}</Text>
            {button("ลองใหม่", () => void settings.load())}
          </>
        )}
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {success && <Text style={styles.success}>{success}</Text>}
        {tab === "profile" && profile && (
          <>
            {profile.photoURL && (
              <Image
                source={{ uri: imageUri(profile.photoURL, runtime.apiOrigin) }}
                style={styles.avatar}
              />
            )}
            {button(
              "เปลี่ยนรูปโปรไฟล์",
              () =>
                void run(async () => {
                  const images = await pickImages();
                  if (!images.length || !active.current) return false;
                  await settings.loadPhotos();
                  if (!active.current) return false;
                  return settings.uploadAvatar(images[0]);
                }),
              busy,
            )}
            {button(
              "รูปโปรไฟล์ที่เคยใช้",
              () =>
                void run(async () => {
                  await settings.loadPhotos();
                  return false;
                }),
              busy,
            )}
            <View style={styles.row}>
              {account.photos.map((photo) => (
                <Pressable
                  key={photo}
                  accessibilityLabel="ใช้รูปโปรไฟล์นี้"
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() =>
                    void run(() => settings.saveProfile({ photoURL: photo }))
                  }
                >
                  <Image
                    source={{ uri: imageUri(photo, runtime.apiOrigin) }}
                    style={styles.avatar}
                  />
                </Pressable>
              ))}
            </View>
            {input("ชื่อที่แสดง", name, setName)}
            <Text style={styles.muted}>อีเมล</Text>
            <Text style={styles.text}>{profile.email}</Text>
            {button(
              "บันทึกโปรไฟล์",
              () => void run(() => settings.saveProfile({ displayName: name })),
              busy || !name.trim() || name.trim() === profile.displayName,
            )}
            {Number(profile.role) > 0 && (
              <View style={styles.card}>
                <Text style={styles.heading}>โปรไฟล์นักแปล / ผู้สร้าง</Text>
                {input("แนะนำตัว", bio, setBio, true)}
                <Text style={styles.muted}>
                  ภาษาที่แปล ({selectedLanguages.length}/10)
                </Text>
                <View style={styles.row}>
                  {languages.map((language) =>
                    button(
                      `${selectedLanguages.includes(language) ? "● " : ""}${language}`,
                      () =>
                        setSelectedLanguages((current) =>
                          current.includes(language)
                            ? current.filter((item) => item !== language)
                            : [...current, language],
                        ),
                      busy ||
                        (!selectedLanguages.includes(language) &&
                          selectedLanguages.length >= 10),
                    ),
                  )}
                </View>
                {input("ประเทศ", country, setCountry)}
                {input(
                  "ภาษาที่ต้องการ",
                  preferredLanguage,
                  setPreferredLanguage,
                )}
                {button(
                  "บันทึกข้อมูลนักแปล",
                  () =>
                    void run(() =>
                      settings.saveTranslatorProfile({
                        bio,
                        translatorLanguages: selectedLanguages,
                        country,
                        preferredLanguage,
                      }),
                    ),
                  busy,
                )}
              </View>
            )}
            <View style={styles.card}>
              <Text style={styles.heading}>บัญชีของคุณ</Text>
              <View style={styles.section}>
                {button("เช็กอินรายวัน", () => setScreen("checkin"))}
                {button("การแจ้งเตือน", () => setScreen("notifications"))}
                <NativePushSettings push={runtime.push} />
                {button("ประวัติเหรียญ", () => setScreen("wallet"))}
                {Number(profile.role) >= 8 &&
                  button("หน้าทีมงาน", () => onNavigate({ kind: "staff" }))}
                {[0, 1, 2, 8].includes(Number(profile.role)) &&
                  button(
                    Number(profile.role) === 0
                      ? "เริ่มเป็นนักแปล"
                      : "เปิด Studio",
                    () => onNavigate({ kind: "studio" }),
                  )}
                {button(
                  "ออกจากระบบ",
                  () =>
                    void run(async () => {
                      await runtime.session.signOut();
                      onBack();
                      return false;
                    }),
                )}
              </View>
            </View>
          </>
        )}
        {tab === "stats" && (
          <>
            <Text style={styles.muted}>
              ข้อมูลจากประวัติการอ่านล่าสุดสูงสุด 30 เรื่อง
            </Text>
            {history.loading && <ActivityIndicator color={design.primary} />}
            {history.error && (
              <>
                <Text style={styles.error}>{history.error}</Text>
                {button("โหลดประวัติใหม่", () => void personal.load("history"))}
              </>
            )}
            <View style={styles.row}>
              {[
                ["เรื่องที่อ่าน", stats.totalSeries],
                ["อ่านสัปดาห์นี้", stats.recentCount],
                ["วันติดต่อกัน", stats.streak],
              ].map(([label, count]) => (
                <View key={label} style={styles.card}>
                  <Text style={styles.muted}>{label}</Text>
                  <Text style={styles.number}>{count}</Text>
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.heading}>กิจกรรมรายวัน</Text>
              <View style={[styles.row, { alignItems: "flex-end" }]}>
                {stats.activity.map((count, index) => (
                  <View
                    key={index}
                    style={{ flex: 1, gap: 6, alignItems: "center" }}
                  >
                    <View
                      style={{
                        width: "100%",
                        height: Math.max(
                          4,
                          (count / Math.max(...stats.activity, 1)) * 80,
                        ),
                        backgroundColor: design.primary,
                        borderRadius: 4,
                      }}
                    />
                    <Text style={styles.muted}>
                      {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"][index]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            {stats.genres.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.heading}>แนวที่ชอบ</Text>
                {stats.genres.map((genre) => (
                  <View key={genre.genre} style={styles.section}>
                    <Text style={styles.text}>
                      {genre.genre} · {genre.count}
                    </Text>
                    <View
                      style={{
                        height: 5,
                        backgroundColor: design.primary,
                        borderRadius: 3,
                        width: `${(genre.count / stats.genres[0].count) * 100}%`,
                      }}
                    />
                  </View>
                ))}
              </View>
            )}
            {!history.loading && !history.error && !stats.totalSeries && (
              <Text style={styles.muted}>
                ยังไม่มีประวัติการอ่าน เริ่มอ่านมังงะเพื่อดูสถิติของคุณ
              </Text>
            )}
          </>
        )}
      </ScrollView>
      {screen && (
        <NativeAccountActivity
          key={screen}
          activity={activity}
          screen={screen}
          onClose={() => setScreen(null)}
          onDestination={(destination) => {
            onNavigate(destination);
            return true;
          }}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: design.background },
  content: { padding: 16, gap: 18, paddingBottom: 32 },
  section: { gap: 10 },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  card: {
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 18,
    padding: 16,
    gap: 16,
    backgroundColor: design.tint,
  },
  heading: { color: design.foreground, fontSize: 18, fontWeight: "700" },
  text: { color: design.foreground },
  muted: { color: design.muted },
  error: { color: design.error },
  success: { color: design.success },
  number: { fontSize: 28, color: design.primary, fontWeight: "800" },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: design.border,
    backgroundColor: design.surface,
    padding: 12,
    color: design.foreground,
  },
  button: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: design.border,
    padding: 12,
    backgroundColor: design.tint,
  },
  avatar: { width: 80, height: 80, borderRadius: 40 },
});
