import React, { useEffect, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { createCommunity, ForumPost } from "./community.ts";
import { NativeForumDetail } from "./NativeForumDetail.tsx";
import { NativePostComposer } from "./NativePostComposer.tsx";
import type { MobileRuntime } from "./runtime.ts";
import { design } from "./design.ts";
import { imageUri } from "./assets.ts";
const categories = [
  ["general", "ทั่วไป"],
  ["announcement", "ประกาศ"],
  ["spoiler", "สปอยล์"],
  ["manga_update", "อัปเดต"],
] as const;
function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: design.foreground }]}
    >
      <Text style={[styles.caption, selected && { color: design.background }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function NativeFeedPost({
  post,
  apiOrigin,
  detail,
  onOpen,
  onManga,
  onProfile,
}: {
  post: ForumPost;
  apiOrigin: string;
  detail?: boolean;
  onOpen(): void;
  onManga(id: string): void;
  onProfile(uid: string): void;
}) {
  const [revealed, setRevealed] = useState(false);
  const hidden = post.category === "spoiler" && !revealed;
  return (
    <View style={styles.card}>
      <View style={styles.meta}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onProfile(post.authorUid)}
        >
          <Text style={styles.author}>{post.authorName || "นักอ่าน"}</Text>
        </Pressable>
        <Text style={styles.caption}>
          {categories.find(([category]) => category === post.category)?.[1]}
        </Text>
      </View>
      {detail ? (
        <Text style={styles.title}>{post.title}</Text>
      ) : (
        <Pressable accessibilityRole="button" onPress={onOpen}>
          <Text style={styles.title}>{post.title}</Text>
        </Pressable>
      )}
      {post.targetMangaId && (
        <Chip
          label={post.targetMangaTitle || "ดูมังงะ"}
          onPress={() => onManga(post.targetMangaId!)}
        />
      )}
      {hidden ? (
        <Chip
          label="มีสปอยล์ · แตะเพื่อดูเนื้อหา"
          onPress={() => setRevealed(true)}
        />
      ) : (
        <>
          <Text numberOfLines={detail ? undefined : 4} style={styles.body}>
            {post.content}
          </Text>
          {post.imageUrls.map((url) => {
            let uri = "";
            try {
              uri = imageUri(url, apiOrigin);
            } catch {}
            return uri ? (
              <Image
                key={url}
                accessibilityLabel="รูปประกอบโพสต์"
                source={{ uri }}
                resizeMode="contain"
                style={{ width: "100%", aspectRatio: 1, borderRadius: 12 }}
              />
            ) : null;
          })}
        </>
      )}
      <Text style={styles.caption}>
        ↑ {post.upvotes} · ↓ {post.downvotes} · {post.commentCount} ความคิดเห็น
      </Text>
      {!detail && <Chip label="อ่านโพสต์" onPress={onOpen} />}
    </View>
  );
}
export function NativeCommunityView({
  community,
  apiOrigin,
  onManga,
  onProfile,
  runtime,
  onAccount,
  onPersonalFeed,
}: {
  runtime: MobileRuntime;
  onAccount(): void;
  onPersonalFeed?(): void;
  community: ReturnType<typeof createCommunity>;
  apiOrigin: string;
  onManga(id: string): void;
  onProfile(uid: string): void;
}) {
  const state = useSyncExternalStore(community.subscribe, community.snapshot);
  const [composing, setComposing] = useState(false);
  useEffect(() => {
    if (state.postId || composing) {
      community.stopWatching();
      return;
    }
    void community.loadTrending();
    const watch = () => {
      if (AppState.currentState === "active")
        void community.watchFeed().catch(() => {});
    };
    watch();
    const timer = setInterval(watch, 10000);
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void community.load(community.snapshot().filter);
        void community.loadTrending();
        watch();
      } else community.stopWatching();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
      community.stopWatching();
    };
  }, [community, state.postId, composing]);
  const session = useSyncExternalStore(
    runtime.session.subscribe,
    runtime.session.snapshot,
  );
  const mangaFeed = (id: string) => {
    community.back();
    void community.load({ sort: "new", mangaId: id });
  };
  if (state.postId)
    return (
      <NativeForumDetail
        key={state.postId}
        runtime={runtime}
        id={state.postId}
        onBack={() => {
          community.back();
          void community.load(state.filter);
        }}
        onAccount={onAccount}
        onManga={mangaFeed}
        onProfile={onProfile}
      />
    );
  return (
    <>
      <FlatList
        refreshing={state.loading}
        onRefresh={() => void community.load(state.filter)}
        data={state.items}
        keyExtractor={(post) => post.id}
        style={styles.root}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 12 }}>
            <Chip
              label="+ สร้างโพสต์"
              onPress={() =>
                session.status === "signedIn" ? setComposing(true) : onAccount()
              }
            />
            {state.newPosts > 0 && (
              <Chip
                label="มีโพสต์ใหม่ในคอมมูนิตี้ · แตะเพื่อโหลด"
                onPress={() => void community.load(state.filter)}
              />
            )}
            {state.trendingError && (
              <View>
                <Text style={styles.error}>{state.trendingError}</Text>
                <Chip
                  label="โหลดเรื่องยอดนิยมใหม่"
                  onPress={() => void community.loadTrending()}
                />
              </View>
            )}
            {state.trending.length > 0 && (
              <View style={{ gap: 12 }}>
                <Text style={styles.title}>มังงะที่กำลังพูดถึง</Text>
                <View style={styles.meta}>
                  {state.trending.map((item) => (
                    <Pressable
                      key={item.mangaId}
                      accessibilityRole="button"
                      onPress={() => mangaFeed(item.mangaId)}
                      style={{ width: "47%", gap: 6 }}
                    >
                      {item.mangaCover && (
                        <Image
                          source={{ uri: imageUri(item.mangaCover, apiOrigin) }}
                          style={{
                            width: "100%",
                            aspectRatio: 2 / 3,
                            borderRadius: 12,
                          }}
                        />
                      )}
                      <Text style={styles.author} numberOfLines={2}>
                        {item.mangaTitle}
                      </Text>
                      <Text style={styles.caption}>{item.postCount} โพสต์</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            <Text style={styles.pageTitle}>คอมมูนิตี้</Text>
            {onPersonalFeed && (
              <Chip label="ฟีดของฉัน" onPress={onPersonalFeed} />
            )}
            <View style={styles.meta}>
              <Chip
                label="ใหม่ล่าสุด"
                selected={state.filter.sort !== "hot"}
                onPress={() =>
                  void community.load({ ...state.filter, sort: "new" })
                }
              />
              <Chip
                label="ยอดนิยม"
                selected={state.filter.sort === "hot"}
                onPress={() =>
                  void community.load({ ...state.filter, sort: "hot" })
                }
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              <Chip
                label="ทั้งหมด"
                selected={!state.filter.category}
                onPress={() =>
                  void community.load({ ...state.filter, category: undefined })
                }
              />
              {categories.map(([category, label]) => (
                <Chip
                  key={category}
                  label={label}
                  selected={state.filter.category === category}
                  onPress={() =>
                    void community.load({ ...state.filter, category })
                  }
                />
              ))}
            </ScrollView>
            {state.filter.mangaId && (
              <Chip
                label="กลับไปทุกเรื่อง"
                onPress={() =>
                  void community.load({ ...state.filter, mangaId: undefined })
                }
              />
            )}
            {state.loading && (
              <ActivityIndicator
                accessibilityLabel="กำลังโหลดคอมมูนิตี้"
                color={design.primary}
              />
            )}
            {state.error && (
              <View style={{ gap: 12 }}>
                <Text accessibilityRole="alert" style={styles.error}>
                  {state.error}
                </Text>
                <Chip
                  label="ลองอีกครั้ง"
                  onPress={() => void community.load(state.filter)}
                />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !state.loading && !state.error ? (
            <Text style={styles.caption}>ยังไม่มีโพสต์ในหมวดนี้</Text>
          ) : null
        }
        ListFooterComponent={
          state.items.length < state.total && !state.loading ? (
            <Chip
              label="โหลดโพสต์เพิ่มเติม"
              onPress={() => void community.more()}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <NativeFeedPost
            post={item}
            apiOrigin={apiOrigin}
            onOpen={() => void community.open(item.id)}
            onManga={mangaFeed}
            onProfile={onProfile}
          />
        )}
      />
      {composing && (
        <NativePostComposer
          runtime={runtime}
          onClose={() => setComposing(false)}
          onCreated={(id) => {
            setComposing(false);
            void community.open(id);
          }}
        />
      )}
    </>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: design.background },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 16,
    backgroundColor: design.tint,
    gap: 12,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  author: { color: design.foreground, fontSize: 12, fontWeight: "600" },
  title: { color: design.foreground, fontSize: 16, fontWeight: "700" },
  pageTitle: { color: design.foreground, fontSize: 24, fontWeight: "800" },
  body: { color: design.foreground, fontSize: 14, lineHeight: 24 },
  caption: { color: design.muted, fontSize: 12, lineHeight: 20 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: design.tint,
    justifyContent: "center",
  },
  error: { color: design.error, lineHeight: 22 },
});
