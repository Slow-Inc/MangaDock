import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createForum, type ForumComment } from "./forum.ts";
import { createReadingSocial } from "./reading-social.ts";
import { NativeReportButton } from "./NativeReadingSocial.tsx";
import type { MobileRuntime } from "./runtime.ts";
import { imageUri } from "./assets.ts";
import { design } from "./design.ts";
function flatten(
  comments: ForumComment[],
  depth = 0,
): { comment: ForumComment; depth: number }[] {
  return comments.flatMap((comment) => [
    { comment, depth },
    ...flatten(comment.replies ?? [], depth + 1),
  ]);
}
export function NativeForumDetail({
  runtime,
  id,
  onBack,
  onAccount,
  onManga,
  onProfile,
}: {
  runtime: MobileRuntime;
  id: string;
  onBack(): void;
  onAccount(): void;
  onManga(id: string): void;
  onProfile(uid: string): void;
}) {
  const [forum] = useState(() => createForum(runtime)),
    [social] = useState(() => createReadingSocial(runtime));
  const state = useSyncExternalStore(forum.subscribe, forum.snapshot),
    session = useSyncExternalStore(
      runtime.session.subscribe,
      runtime.session.snapshot,
    );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [content, setContent] = useState(""),
    [reply, setReply] = useState<ForumComment | null>(null),
    [edit, setEdit] = useState<{
      id: string;
      title?: string;
      content: string;
    } | null>(null),
    [image, setImage] = useState<string | null>(null),
    [revealed, setRevealed] = useState(false);
  const pending = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    forum.activate();
    social.activate();
    const watch = () => {
      if (AppState.currentState === "active")
        void forum.watch().catch(() => {});
    };
    void forum.open(id).then(watch);
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active") watch();
      else forum.stopWatching();
    });
    const timer = setInterval(watch, 10000);
    return () => {
      active.current = false;
      listener.remove();
      clearInterval(timer);
      forum.dispose();
      social.dispose();
    };
  }, [forum, social, id]);
  async function run(work: () => Promise<unknown>) {
    if (session.status !== "signedIn") {
      onAccount();
      return;
    }
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
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
      disabled={disabled || busy}
      style={[styles.button, (busy || disabled) && { opacity: 0.5 }]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
  const post = state.post,
    own = post?.authorUid === session.account?.uid;
  const votes = (
    target: "post" | "comment",
    item: { id: string; upvotes: number; downvotes: number; userVote: number },
  ) => (
    <View style={styles.row}>
      {button(
        `${item.userVote === 1 ? "● " : ""}↑ ${item.upvotes}`,
        () => void run(() => forum.vote(target, item.id, 1)),
      )}
      {button(
        `${item.userVote === -1 ? "● " : ""}↓ ${item.downvotes}`,
        () => void run(() => forum.vote(target, item.id, -1)),
      )}
    </View>
  );
  const deleteComment = (comment: ForumComment) =>
    Alert.alert("ลบความคิดเห็น?", "คำตอบที่ยังอยู่จะคงไว้ตามระบบเดิม", [
      { text: "ยกเลิก" },
      {
        text: "ลบ",
        style: "destructive",
        onPress: () => void run(() => forum.deleteComment(comment.id)),
      },
    ]);
  return (
    <ScrollView
      style={styles.root}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      {button("‹ กลับคอมมูนิตี้", onBack)}
      {state.loading && <ActivityIndicator color={design.primary} />}
      {(state.error || error) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error || state.error}
        </Text>
      )}
      {state.error && button("ลองโหลดใหม่", () => void forum.reload())}
      {post && (
        <>
          <View style={styles.card}>
            {button(post.authorName ?? "นักอ่าน", () =>
              onProfile(post.authorUid),
            )}
            <Text style={styles.heading}>{post.title}</Text>
            <Text style={styles.muted}>
              {new Date(post.createdAt).toLocaleString("th-TH")} ·{" "}
              {state.connected ? "เชื่อมต่อสด" : "อัปเดตเมื่อเชื่อมต่อใหม่"}
            </Text>
            {post.targetMangaId &&
              button(post.targetMangaTitle ?? "ชุมชนมังงะ", () =>
                onManga(post.targetMangaId!),
              )}
            {post.category === "spoiler" && !revealed ? (
              button("มีสปอยล์ · แตะเพื่อดู", () => setRevealed(true))
            ) : (
              <>
                <Text selectable style={styles.body}>
                  {post.content}
                </Text>
                <View style={styles.row}>
                  {post.imageUrls.map((url) => (
                    <Pressable
                      key={url}
                      accessibilityLabel="ขยายรูปประกอบ"
                      onPress={() => setImage(url)}
                      style={{
                        width: post.imageUrls.length === 1 ? "100%" : "47%",
                      }}
                    >
                      <Image
                        source={{ uri: imageUri(url, runtime.apiOrigin) }}
                        style={{
                          width: "100%",
                          aspectRatio: 1,
                          borderRadius: 12,
                        }}
                      />
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {votes("post", post)}
            {own && (
              <View style={styles.row}>
                {button("แก้ไขโพสต์", () =>
                  setEdit({
                    id: post.id,
                    title: post.title,
                    content: post.content,
                  }),
                )}
                {button("ลบโพสต์", () =>
                  Alert.alert("ลบโพสต์?", "โพสต์นี้จะไม่แสดงในคอมมูนิตี้", [
                    { text: "ยกเลิก" },
                    {
                      text: "ลบ",
                      style: "destructive",
                      onPress: () =>
                        void run(async () => {
                          if (await forum.deletePost()) onBack();
                        }),
                    },
                  ]),
                )}
              </View>
            )}
            <NativeReportButton
              runtime={runtime}
              social={social}
              target={{ contentType: "post", contentId: post.id }}
              onAccount={onAccount}
            />
          </View>
          <Text style={styles.heading}>ความคิดเห็น ({post.commentCount})</Text>
          {flatten(state.comments).map(({ comment, depth }) => (
            <Pressable
              key={comment.id}
              onLongPress={() =>
                Alert.alert("ความคิดเห็น", comment.content, [
                  { text: "ตอบกลับ", onPress: () => setReply(comment) },
                  ...(comment.authorUid === session.account?.uid
                    ? [
                        {
                          text: "แก้ไข",
                          onPress: () =>
                            setEdit({
                              id: comment.id,
                              content: comment.content,
                            }),
                        },
                        { text: "ลบ", onPress: () => deleteComment(comment) },
                      ]
                    : []),
                  { text: "ปิด" },
                ])
              }
              style={[styles.card, { marginLeft: Math.min(depth, 4) * 12 }]}
            >
              {button(comment.authorName ?? "นักอ่าน", () =>
                onProfile(comment.authorUid),
              )}
              <Text selectable style={styles.body}>
                {comment.content}
              </Text>
              {votes("comment", comment)}
              <View style={styles.row}>
                {button("ตอบกลับ", () => setReply(comment))}
                {comment.authorUid === session.account?.uid && (
                  <>
                    {button("แก้ไข", () =>
                      setEdit({ id: comment.id, content: comment.content }),
                    )}
                    {button("ลบ", () => deleteComment(comment))}
                  </>
                )}
              </View>
            </Pressable>
          ))}
          {reply &&
            button(`ตอบกลับ ${reply.authorName ?? "นักอ่าน"} · ยกเลิก`, () =>
              setReply(null),
            )}
          <TextInput
            accessibilityLabel="ความคิดเห็น"
            placeholder="เขียนความคิดเห็น"
            placeholderTextColor={design.muted}
            value={content}
            onChangeText={setContent}
            maxLength={5000}
            multiline
            editable={!busy}
            style={styles.input}
          />
          {button(
            session.status === "signedIn"
              ? "ส่งความคิดเห็น"
              : "เข้าสู่ระบบเพื่อแสดงความคิดเห็น",
            () =>
              void run(async () => {
                if (
                  (await forum.comment(content.trim(), reply?.id)) &&
                  active.current
                ) {
                  setContent("");
                  setReply(null);
                }
              }),
            session.status === "signedIn" && !content.trim(),
          )}
        </>
      )}
      <Modal
        visible={!!edit}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setEdit(null);
        }}
      >
        <View style={styles.scrim}>
          <View style={styles.sheet}>
            <Text style={styles.heading}>แก้ไข</Text>
            {edit?.title !== undefined && (
              <TextInput
                accessibilityLabel="แก้หัวข้อ"
                value={edit.title}
                onChangeText={(title) =>
                  setEdit((current) => current && { ...current, title })
                }
                maxLength={200}
                editable={!busy}
                style={styles.input}
              />
            )}
            <TextInput
              accessibilityLabel="แก้เนื้อหา"
              value={edit?.content ?? ""}
              onChangeText={(content) =>
                setEdit((current) => current && { ...current, content })
              }
              multiline
              maxLength={edit?.title !== undefined ? 10000 : 5000}
              editable={!busy}
              style={styles.input}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            {button(
              "บันทึก",
              () =>
                void run(async () => {
                  if (!edit) return;
                  const result =
                    edit.title !== undefined
                      ? await forum.editPost({
                          title: edit.title,
                          content: edit.content,
                        })
                      : await forum.editComment(edit.id, edit.content);
                  if (result && active.current) setEdit(null);
                }),
              !edit?.content.trim(),
            )}
            {button("ยกเลิก", () => setEdit(null))}
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!image}
        onRequestClose={() => setImage(null)}
        animationType="fade"
      >
        <SafeAreaView style={styles.root}>
          {button("ปิดรูป", () => setImage(null))}
          {image && (
            <Image
              source={{ uri: imageUri(image, runtime.apiOrigin) }}
              resizeMode="contain"
              style={{ flex: 1 }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: design.background },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  card: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: design.border,
    backgroundColor: design.tint,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heading: { color: design.foreground, fontSize: 19, fontWeight: "700" },
  body: { color: design.foreground, fontSize: 14, lineHeight: 24 },
  text: { color: design.foreground },
  muted: { color: design.muted, fontSize: 12 },
  error: { color: design.error },
  button: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: design.tint,
    borderWidth: 1,
    borderColor: design.border,
  },
  input: {
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 12,
    padding: 14,
    color: design.foreground,
    backgroundColor: design.surface,
    minHeight: 70,
    textAlignVertical: "top",
  },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: design.sheet,
    padding: 20,
    gap: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
