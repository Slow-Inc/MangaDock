import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type {
  createReadingSocial,
  CommentContext,
  ContentReport,
} from "./reading-social.ts";
import type { MobileRuntime } from "./runtime.ts";
import { design } from "./design.ts";

type Social = ReturnType<typeof createReadingSocial>;
const action = (label: string, run: () => void, disabled = false) => (
  <Pressable
    accessibilityRole="button"
    disabled={disabled}
    onPress={run}
    style={[styles.button, disabled && { opacity: 0.45 }]}
  >
    <Text style={styles.text}>{label}</Text>
  </Pressable>
);
function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const active = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function run(work: () => Promise<unknown>) {
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
  return { busy, error, run };
}
export function NativeReviewSection({
  social,
  runtime,
  mangaId,
  title,
  onAccount,
}: {
  social: Social;
  runtime: MobileRuntime;
  mangaId: string;
  title: string;
  onAccount(): void;
}) {
  const { reviews } = useSyncExternalStore(social.subscribe, social.snapshot);
  const session = useSyncExternalStore(
    runtime.session.subscribe,
    runtime.session.snapshot,
  );
  const [rating, setRating] = useState(0),
    [body, setBody] = useState(""),
    [page, setPage] = useState(0);
  const task = useAction();
  useEffect(() => {
    void social.reviews(mangaId, page * 20);
  }, [social, mangaId, page, session.account?.uid]);
  useEffect(() => {
    setRating(reviews.mine?.rating ?? 0);
    setBody(reviews.mine?.body ?? "");
  }, [reviews.mine]);
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>รีวิวจากผู้อ่าน</Text>
      <Text style={styles.text}>
        ★ {reviews.summary.averageRating.toFixed(1)} · {reviews.summary.count}{" "}
        รีวิว
      </Text>
      {session.status === "signedIn" ? (
        <View style={styles.section}>
          <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityLabel={`${value} ดาว`}
                onPress={() => setRating(value)}
                disabled={task.busy}
              >
                <Text style={{ color: design.amber, fontSize: 30 }}>
                  {rating >= value ? "★" : "☆"}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            multiline
            placeholder="เขียนรีวิวของคุณ"
            placeholderTextColor={design.muted}
            value={body}
            onChangeText={setBody}
            editable={!task.busy}
          />
          <View style={styles.row}>
            {action(
              reviews.mine ? "บันทึกรีวิว" : "ส่งรีวิว",
              () => void task.run(() => social.saveReview(title, rating, body)),
              task.busy || !rating || !body.trim() || reviews.loading,
            )}
            {reviews.mine &&
              action(
                "ลบรีวิว",
                () => void task.run(() => social.deleteReview()),
                task.busy,
              )}
          </View>
        </View>
      ) : (
        action("เข้าสู่ระบบเพื่อเขียนรีวิว", onAccount)
      )}
      {task.error && <Text style={styles.error}>{task.error}</Text>}
      {reviews.loading && <ActivityIndicator color={design.primary} />}
      {reviews.error ? (
        <View>
          <Text style={styles.error}>{reviews.error}</Text>
          {action("ลองใหม่", () => void social.reviews(mangaId, page * 20))}
        </View>
      ) : (
        reviews.items.map((review) => (
          <View key={review.id} style={styles.card}>
            <Text style={styles.text}>
              {review.displayName ?? "ผู้อ่าน"} · {"★".repeat(review.rating)}
            </Text>
            <Text style={styles.text}>{review.body}</Text>
            <Text style={styles.muted}>
              {new Date(review.createdAt).toLocaleDateString("th-TH")}
            </Text>
          </View>
        ))
      )}
      {!reviews.loading && !reviews.error && reviews.summary.count === 0 && (
        <Text style={styles.muted}>ยังไม่มีรีวิว</Text>
      )}
      <View style={styles.row}>
        {page > 0 &&
          action("ก่อนหน้า", () => setPage(page - 1), reviews.loading)}
        {(page + 1) * 20 < reviews.summary.count &&
          action("ถัดไป", () => setPage(page + 1), reviews.loading)}
      </View>
    </View>
  );
}
export function NativeReaderComments({
  social,
  runtime,
  context,
  onAccount,
  onClose,
}: {
  social: Social;
  runtime: MobileRuntime;
  context: CommentContext;
  onAccount(): void;
  onClose(): void;
}) {
  const insets = useSafeAreaInsets();
  const { comments } = useSyncExternalStore(social.subscribe, social.snapshot);
  const session = useSyncExternalStore(
    runtime.session.subscribe,
    runtime.session.snapshot,
  );
  const [body, setBody] = useState("");
  const task = useAction();
  useEffect(() => {
    setBody("");
    void social.comments(context);
  }, [social, context.mangaId, context.chapterId, context.pageNumber]);
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: 20 + insets.bottom,
              paddingLeft: 20 + insets.left,
              paddingRight: 20 + insets.right,
            },
          ]}
        >
          <View style={styles.row}>
            <Text style={styles.heading}>
              ความคิดเห็น · หน้า {context.pageNumber}
            </Text>
            {action("ปิด", onClose)}
          </View>
          <ScrollView
            contentContainerStyle={styles.section}
            keyboardShouldPersistTaps="handled"
          >
            {comments.loading && <ActivityIndicator color={design.primary} />}
            {comments.error && (
              <View>
                <Text style={styles.error}>{comments.error}</Text>
                {action("ลองใหม่", () => void social.comments(context))}
              </View>
            )}
            {comments.items.map((comment) => (
              <View key={comment.id} style={styles.card}>
                <Text style={styles.text}>
                  {comment.displayName ?? "ผู้อ่าน"}
                </Text>
                <Text style={styles.text}>{comment.body}</Text>
                {comment.uid === session.account?.uid &&
                  action(
                    "ลบ",
                    () => void task.run(() => social.deleteComment(comment.id)),
                    task.busy,
                  )}
              </View>
            ))}
            {!comments.loading && !comments.error && !comments.items.length && (
              <Text style={styles.muted}>ยังไม่มีความคิดเห็นในหน้านี้</Text>
            )}
          </ScrollView>
          {task.error && <Text style={styles.error}>{task.error}</Text>}
          {session.status === "signedIn" ? (
            <>
              <TextInput
                style={styles.input}
                value={body}
                multiline
                onChangeText={setBody}
                placeholder="แสดงความคิดเห็น"
                placeholderTextColor={design.muted}
                editable={!task.busy}
              />
              {action(
                "ส่งความคิดเห็น",
                () =>
                  void task.run(async () => {
                    if (await social.addComment(body)) setBody("");
                  }),
                task.busy || comments.loading || !body.trim(),
              )}
            </>
          ) : (
            action("เข้าสู่ระบบเพื่อแสดงความคิดเห็น", () => {
              onClose();
              onAccount();
            })
          )}
        </View>
      </View>
    </Modal>
  );
}
const reasons: [ContentReport["reason"], string][] = [
  ["spam", "สแปม"],
  ["inappropriate", "เนื้อหาไม่เหมาะสม"],
  ["misinformation", "ข้อมูลเท็จ"],
  ["copyright", "ละเมิดลิขสิทธิ์"],
  ["other", "อื่น ๆ"],
];
export function NativeReportButton({
  social,
  runtime,
  target,
  onAccount,
}: {
  social: Social;
  runtime: MobileRuntime;
  target: Pick<ContentReport, "contentType" | "contentId">;
  onAccount(): void;
}) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState<ContentReport["reason"]>("spam"),
    [details, setDetails] = useState(""),
    [done, setDone] = useState(false);
  const session = useSyncExternalStore(
    runtime.session.subscribe,
    runtime.session.snapshot,
  );
  const task = useAction();
  return (
    <>
      {action("รายงานเนื้อหา", () => {
        setDone(false);
        setOpen(true);
      })}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!task.busy) setOpen(false);
        }}
      >
        <View style={[styles.scrim, { justifyContent: "center", padding: 24 }]}>
          <View style={[styles.sheet, { borderRadius: 20 }]}>
            <Text style={styles.heading}>รายงานเนื้อหา</Text>
            {done ? (
              <Text style={styles.text}>
                ส่งรายงานแล้ว ขอบคุณสำหรับการแจ้งปัญหา
              </Text>
            ) : session.status !== "signedIn" ? (
              action("เข้าสู่ระบบเพื่อส่งรายงาน", () => {
                setOpen(false);
                onAccount();
              })
            ) : (
              <>
                {reasons.map(([value, label]) => (
                  <Pressable
                    key={value}
                    style={styles.button}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: reason === value }}
                    onPress={() => setReason(value)}
                    disabled={task.busy}
                  >
                    <Text style={styles.text}>
                      {reason === value ? "●" : "○"} {label}
                    </Text>
                  </Pressable>
                ))}
                <TextInput
                  style={styles.input}
                  multiline
                  value={details}
                  onChangeText={setDetails}
                  placeholder="รายละเอียดเพิ่มเติม"
                  placeholderTextColor={design.muted}
                  editable={!task.busy}
                />
                {task.error && <Text style={styles.error}>{task.error}</Text>}
                {action(
                  "ส่งรายงาน",
                  () =>
                    void task.run(async () => {
                      if (await social.report({ ...target, reason, details }))
                        setDone(true);
                    }),
                  task.busy,
                )}
              </>
            )}
            {action(done ? "ปิด" : "ยกเลิก", () => setOpen(false), task.busy)}
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  section: { gap: 12 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  heading: { color: design.foreground, fontSize: 18, fontWeight: "700" },
  text: { color: design.foreground },
  muted: { color: design.muted },
  error: { color: design.error },
  button: {
    backgroundColor: design.tint,
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: {
    color: design.foreground,
    backgroundColor: design.background,
    borderColor: design.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 70,
    textAlignVertical: "top",
  },
  card: { gap: 8, backgroundColor: design.tint, borderRadius: 14, padding: 14 },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: design.sheet,
    padding: 20,
    gap: 12,
    maxHeight: "85%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
