import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { createProfiles } from "./profiles.ts";
import type { MobileRuntime } from "./runtime.ts";
import { design } from "./design.ts";
import { imageUri } from "./assets.ts";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeBanner } from "./NativeBanner.tsx";
import { pickImages } from "./native-images.ts";
export function NativeProfileView({
  profiles,
  runtime,
  onAccount,
  onPost,
  onBook,
}: {
  profiles: ReturnType<typeof createProfiles>;
  runtime: MobileRuntime;
  onAccount(): void;
  onPost(id: string): void;
  onBook(id: string): void;
}) {
  const state = useSyncExternalStore(profiles.subscribe, profiles.snapshot);
  const session = useSyncExternalStore(
    runtime.session.subscribe,
    runtime.session.snapshot,
  );
  const [tab, setTab] = useState("posts"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const data = state.data,
    own = state.uid === session.account?.uid;
  const pending = useRef(false);
  useEffect(() => {
    setError(null);
    setTab("posts");
  }, [state.uid]);
  async function run(work: () => Promise<unknown>) {
    if (pending.current) return;
    const uid = state.uid;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      if (profiles.snapshot().uid === uid)
        setError(
          failure instanceof Error ? failure.message : "ทำรายการไม่สำเร็จ",
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const button = (label: string, run: () => void, disabled = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={run}
      style={[styles.button, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
  async function follow() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await profiles.follow(!state.isFollowing);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "ติดตามไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      visible={!!state.uid}
      animationType="slide"
      onRequestClose={profiles.close}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          {button("กลับ", profiles.close)}
          <Text style={styles.heading}>โปรไฟล์</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {state.loading && <ActivityIndicator color={design.primary} />}
          {state.error && (
            <>
              <Text style={styles.error}>{state.error}</Text>
              {button("ลองใหม่", () => void profiles.open(state.uid!))}
            </>
          )}
          {data && (
            <>
              {data.profile.bannerUrl && (
                <NativeBanner
                  uri={imageUri(data.profile.bannerUrl, runtime.apiOrigin)}
                  position={data.profile.bannerPosition}
                />
              )}
              {own && (
                <View style={styles.row}>
                  {button(
                    "เปลี่ยนรูปปก",
                    () =>
                      void run(async () => {
                        const uid = state.uid,
                          images = await pickImages();
                        if (images.length && profiles.snapshot().uid === uid)
                          await profiles.uploadBanner(images[0]);
                      }),
                    busy,
                  )}
                  {data.profile.bannerUrl && (
                    <>
                      {button(
                        "เลื่อนปกขึ้น",
                        () =>
                          void run(() =>
                            profiles.positionBanner(
                              Math.max(0, data.profile.bannerPosition - 10),
                            ),
                          ),
                        busy || data.profile.bannerPosition <= 0,
                      )}
                      {button(
                        "เลื่อนปกลง",
                        () =>
                          void run(() =>
                            profiles.positionBanner(
                              Math.min(100, data.profile.bannerPosition + 10),
                            ),
                          ),
                        busy || data.profile.bannerPosition >= 100,
                      )}
                    </>
                  )}
                </View>
              )}
              {data.profile.photoUrl && (
                <Image
                  accessibilityLabel="รูปโปรไฟล์"
                  source={{
                    uri: imageUri(data.profile.photoUrl, runtime.apiOrigin),
                  }}
                  style={styles.avatar}
                />
              )}
              <Text style={styles.heading}>
                {data.profile.displayName ?? "นักอ่าน"}
              </Text>
              <Text style={styles.muted}>
                {Number(data.profile.role) >= 8
                  ? "ทีมงาน"
                  : Number(data.profile.role) >= 1
                    ? "นักแปล / ผู้สร้าง"
                    : "นักอ่าน"}
              </Text>
              {data.profile.bio && (
                <Text style={styles.text}>{data.profile.bio}</Text>
              )}
              <Text style={styles.muted}>
                {[
                  data.profile.country,
                  data.profile.translatorLanguages.join(" · "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Text style={styles.muted}>
                เข้าร่วม{" "}
                {new Date(data.profile.createdAt).toLocaleDateString("th-TH")}
              </Text>
              <View style={styles.row}>
                <Text style={styles.text}>
                  {state.counts.followers} ผู้ติดตาม
                </Text>
                <Text style={styles.text}>
                  {state.counts.following} กำลังติดตาม
                </Text>
                <Text style={styles.text}>
                  ★ {data.profile.ratingAvg.toFixed(1)} (
                  {data.profile.ratingCount})
                </Text>
              </View>
              {!own &&
                button(
                  state.isFollowing ? "เลิกติดตาม" : "ติดตาม",
                  session.status === "signedIn"
                    ? () => void follow()
                    : () => {
                        profiles.close();
                        onAccount();
                      },
                  busy || state.loading,
                )}
              {error && <Text style={styles.error}>{error}</Text>}
              {data.earnings && own && (
                <Text style={styles.text}>
                  ยอดขาย {data.earnings.totalSales} · รายได้{" "}
                  {data.earnings.totalEarned} เหรียญ
                </Text>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.row}>
                  {[
                    ["posts", "โพสต์"],
                    ["comments", "ความคิดเห็น"],
                    ["liked", "ถูกใจ"],
                    ["translated", "ผลงานแปล"],
                    ["following", "กำลังติดตาม"],
                    ["followers", "ผู้ติดตาม"],
                  ].map(([key, label]) => (
                    <Pressable
                      accessibilityRole="tab"
                      accessibilityState={{ selected: tab === key }}
                      key={key}
                      onPress={() => setTab(key)}
                      style={[
                        styles.button,
                        tab === key && { borderColor: design.primary },
                      ]}
                    >
                      <Text style={styles.text}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              {(tab === "posts" || tab === "liked") && (
                <>
                  {(tab === "posts" ? data.posts : data.likedPosts).map(
                    (post) =>
                      button(
                        `${post.title} · ${post.commentCount} ความคิดเห็น`,
                        () => onPost(post.id),
                      ),
                  )}
                  {!(tab === "posts" ? data.posts : data.likedPosts).length && (
                    <Text style={styles.muted}>ยังไม่มีโพสต์</Text>
                  )}
                  {tab === "posts" &&
                    state.hasMorePosts &&
                    button(
                      state.postsLoading ? "กำลังโหลด…" : "โหลดโพสต์เพิ่มเติม",
                      () => void profiles.morePosts(),
                      state.postsLoading,
                    )}
                </>
              )}
              {tab === "comments" && (
                <>
                  {data.comments.map((comment) => (
                    <Pressable
                      key={comment.id}
                      onPress={() => onPost(comment.postId)}
                      style={styles.button}
                    >
                      <Text style={styles.heading}>{comment.postTitle}</Text>
                      <Text style={styles.text}>{comment.content}</Text>
                    </Pressable>
                  ))}
                  {!data.comments.length && (
                    <Text style={styles.muted}>ยังไม่มีความคิดเห็น</Text>
                  )}
                </>
              )}
              {tab === "translated" && (
                <>
                  {data.translatedTitles.map((title) => (
                    <Pressable
                      key={`${title.titleId}:${title.language}`}
                      onPress={() => onBook(title.titleId)}
                      style={styles.button}
                    >
                      <Text style={styles.heading}>{title.titleName}</Text>
                      <Text style={styles.muted}>
                        {title.language} · {title.chapterCount} ตอน
                      </Text>
                    </Pressable>
                  ))}
                  {!data.translatedTitles.length && (
                    <Text style={styles.muted}>ยังไม่มีผลงานแปล</Text>
                  )}
                </>
              )}
              {(tab === "following" || tab === "followers") && (
                <>
                  {state[tab].map((profile) => (
                    <Pressable
                      key={profile.uid}
                      onPress={() => {
                        setTab("posts");
                        void profiles.open(profile.uid);
                      }}
                      style={styles.button}
                    >
                      <Text style={styles.text}>
                        {profile.displayName ?? "นักอ่าน"}
                      </Text>
                    </Pressable>
                  ))}
                  {!state[tab].length && (
                    <Text style={styles.muted}>ยังไม่มีรายการ</Text>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: design.background },
  header: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: design.border,
  },
  content: { padding: 16, gap: 14 },
  heading: { color: design.foreground, fontSize: 18, fontWeight: "700" },
  text: { color: design.foreground },
  muted: { color: design.muted },
  error: { color: design.error },
  row: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  button: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: design.border,
    padding: 12,
    backgroundColor: design.tint,
  },
  banner: { width: "100%", height: 150, borderRadius: 14 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
});
