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
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createStaff } from "./staff.ts";
import type { MobileRuntime } from "./runtime.ts";
import type { NotificationDestination } from "./notification-links.ts";
import { design } from "./design.ts";
export function NativeStaffView({
  runtime,
  onBack,
  onNavigate,
}: {
  runtime: MobileRuntime;
  onBack(): void;
  onNavigate(destination: NotificationDestination): void;
}) {
  const [staff] = useState(() => createStaff(runtime));
  const state = useSyncExternalStore(staff.subscribe, staff.snapshot),
    session = useSyncExternalStore(
      runtime.session.subscribe,
      runtime.session.snapshot,
    );
  const [tab, setTab] = useState<
    "overview" | "users" | "content" | "transactions" | "audit"
  >("overview");
  const [search, setSearch] = useState(""),
    [role, setRole] = useState<number | undefined>(),
    [plan, setPlan] = useState(""),
    [banned, setBanned] = useState(false);
  const [postSearch, setPostSearch] = useState(""),
    [category, setCategory] = useState(""),
    [author, setAuthor] = useState("");
  const [uid, setUid] = useState(""),
    [type, setType] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [auditAction, setAuditAction] = useState(""),
    [actor, setActor] = useState(""),
    [delta, setDelta] = useState(""),
    [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const active = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    active.current = true;
    staff.activate();
    void runtime.session
      .refreshAccount()
      .then(() => staff.loadStats())
      .catch((failure) => {
        if (active.current)
          setError(
            failure instanceof Error
              ? failure.message
              : "โหลดสิทธิ์ทีมงานไม่สำเร็จ",
          );
      });
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active")
        void runtime.session.refreshAccount().catch(() => {});
    });
    return () => {
      active.current = false;
      listener.remove();
      staff.dispose();
    };
  }, [staff, runtime]);
  useEffect(() => {
    setDelta("");
    setReason("");
    setError(null);
  }, [state.userUid]);
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
  const button = (label: string, work: () => void, disabled = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={work}
      disabled={busy || disabled}
      style={[styles.button, (busy || disabled) && { opacity: 0.5 }]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
  const input = (
    label: string,
    value: string,
    change: (value: string) => void,
  ) => (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      placeholderTextColor={design.muted}
      value={value}
      onChangeText={change}
      editable={!busy}
      autoCapitalize="none"
      style={styles.input}
    />
  );
  const usersQuery = () => ({
    search: search.trim(),
    role,
    plan: plan.trim() || undefined,
    ...(banned ? { banned: true as const } : {}),
  });
  const postsQuery = () => ({
    search: postSearch.trim(),
    category: category || undefined,
    authorUid: author.trim() || undefined,
  });
  const txQuery = () => ({
    uid: uid.trim() || undefined,
    type: type || undefined,
    from: from.trim() || undefined,
    to: to.trim() || undefined,
  });
  const auditQuery = () => ({
    action: auditAction.trim() || undefined,
    actorUid: actor.trim() || undefined,
  });
  function select(value: typeof tab) {
    setTab(value);
    setError(null);
    if (value === "overview") void staff.loadStats();
    else if (value === "users") void staff.loadUsers(usersQuery());
    else if (value === "content") void staff.loadPosts(postsQuery());
    else if (value === "transactions") void staff.loadTransactions(txQuery());
    else void staff.loadAudit(auditQuery());
  }
  const pager = (
    page: number,
    total: number,
    work: (page: number) => void,
    loading: boolean,
  ) => (
    <View style={styles.row}>
      {button("‹ ก่อนหน้า", () => work(page - 1), page <= 1 || loading)}
      <Text style={styles.muted}>
        หน้า {page} · {total} รายการ
      </Text>
      {button("ถัดไป ›", () => work(page + 1), page * 20 >= total || loading)}
    </View>
  );
  const confirm = (
    title: string,
    message: string,
    work: () => Promise<unknown>,
    destructive = false,
  ) =>
    Alert.alert(title, message, [
      { text: "ยกเลิก" },
      {
        text: "ยืนยัน",
        style: destructive ? "destructive" : "default",
        onPress: () => void run(work),
      },
    ]);
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {button("‹ กลับ", onBack)}
        <Text style={styles.heading}>MangaDock · ทีมงาน</Text>
      </View>
      {Number(session.account?.role) >= 8 ? (
        <>
          <ScrollView
            horizontal
            style={{ maxHeight: 64 }}
            contentContainerStyle={styles.tabs}
          >
            {(
              ["overview", "users", "content", "transactions", "audit"] as const
            ).map((value) =>
              button(
                `${tab === value ? "● " : ""}${{ overview: "ภาพรวม", users: "ผู้ใช้", content: "เนื้อหา", transactions: "ธุรกรรม", audit: "ประวัติการจัดการ" }[value]}`,
                () => select(value),
              ),
            )}
          </ScrollView>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {busy && <ActivityIndicator color={design.primary} />}
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            {tab === "overview" && (
              <>
                {state.statsLoading && (
                  <ActivityIndicator color={design.primary} />
                )}
                {state.statsError && (
                  <>
                    <Text style={styles.error}>{state.statsError}</Text>
                    {button("ลองใหม่", () => void staff.loadStats())}
                  </>
                )}
                {state.stats && (
                  <>
                    <View style={styles.row}>
                      {[
                        ["ผู้ใช้ทั้งหมด", state.stats.totalUsers],
                        ["ผู้ใช้ใหม่วันนี้", state.stats.newUsersToday],
                        ["โพสต์ที่แสดง", state.stats.activePosts],
                        ["ธุรกรรมวันนี้", state.stats.transactionsToday.count],
                        ["เหรียญวันนี้", state.stats.transactionsToday.coinSum],
                      ].map(([label, count]) => (
                        <View
                          key={label}
                          style={[styles.card, { width: "47%" }]}
                        >
                          <Text style={styles.muted}>{label}</Text>
                          <Text style={styles.number}>{count}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.heading}>แบนล่าสุด</Text>
                    {state.stats.recentBans.map((user) => (
                      <Pressable
                        key={user.uid}
                        onPress={() => void staff.loadUser(user.uid)}
                        style={styles.card}
                      >
                        <Text style={styles.text}>{user.displayName}</Text>
                        <Text style={styles.muted}>
                          {new Date(user.bannedAt).toLocaleString("th-TH")}
                        </Text>
                      </Pressable>
                    ))}
                  </>
                )}
              </>
            )}
            {tab === "users" && (
              <>
                {input("ค้นหาชื่อหรืออีเมล", search, setSearch)}
                <View style={styles.row}>
                  {[undefined, 0, 1, 2, 8, 9].map((value) =>
                    button(
                      `${role === value ? "● " : ""}${value === undefined ? "ทุก role" : `role ${value}`}`,
                      () => setRole(value),
                    ),
                  )}
                </View>
                {input("แผนสมาชิก", plan, setPlan)}
                {button(
                  banned ? "● แสดงเฉพาะที่ถูกแบน" : "แสดงเฉพาะที่ถูกแบน",
                  () => setBanned(!banned),
                )}
                {button("ใช้ตัวกรอง", () => void staff.loadUsers(usersQuery()))}
                {state.users.loading && (
                  <ActivityIndicator color={design.primary} />
                )}
                {state.users.error && (
                  <>
                    <Text style={styles.error}>{state.users.error}</Text>
                    {button(
                      "ลองใหม่",
                      () =>
                        void staff.loadUsers(
                          state.users.query,
                          state.users.page,
                        ),
                    )}
                  </>
                )}
                {state.users.items.map((user) => (
                  <Pressable
                    key={user.uid}
                    accessibilityRole="button"
                    onPress={() => void staff.loadUser(user.uid)}
                    style={styles.card}
                  >
                    <Text style={styles.heading}>{user.displayName}</Text>
                    <Text style={styles.text}>{user.email}</Text>
                    <Text style={styles.muted}>
                      role {user.role} · {user.plan} ·{" "}
                      {user.banned ? "ถูกแบน" : "ใช้งานปกติ"} · trust{" "}
                      {user.trustScore}
                    </Text>
                  </Pressable>
                ))}
                {!state.users.loading &&
                  !state.users.error &&
                  !state.users.items.length && (
                    <Text style={styles.muted}>ไม่พบผู้ใช้</Text>
                  )}
                {pager(
                  state.users.page,
                  state.users.total,
                  (page) => void staff.loadUsers(state.users.query, page),
                  state.users.loading,
                )}
              </>
            )}
            {tab === "content" && (
              <>
                {input("ค้นหาหัวข้อโพสต์", postSearch, setPostSearch)}
                {input("UID ผู้เขียน", author, setAuthor)}
                <View style={styles.row}>
                  {[
                    "",
                    "general",
                    "announcement",
                    "spoiler",
                    "manga_update",
                  ].map((value) =>
                    button(
                      `${category === value ? "● " : ""}${value || "ทุกหมวด"}`,
                      () => setCategory(value),
                    ),
                  )}
                </View>
                {button("ใช้ตัวกรอง", () => void staff.loadPosts(postsQuery()))}
                {state.posts.loading && (
                  <ActivityIndicator color={design.primary} />
                )}
                {state.posts.error && (
                  <>
                    <Text style={styles.error}>{state.posts.error}</Text>
                    {button(
                      "ลองใหม่",
                      () =>
                        void staff.loadPosts(
                          state.posts.query,
                          state.posts.page,
                        ),
                    )}
                  </>
                )}
                {state.posts.items.map((post) => (
                  <View key={post.id} style={styles.card}>
                    <Text style={styles.heading}>{post.title}</Text>
                    <Text style={styles.muted}>
                      {post.authorName} · {post.category} · {post.commentCount}{" "}
                      ความคิดเห็น
                    </Text>
                    <View style={styles.row}>
                      {button("อ่านโพสต์", () =>
                        onNavigate({ kind: "post", id: post.id }),
                      )}
                      {button(post.pinned ? "ยกเลิก pin" : "Pin โพสต์", () =>
                        confirm(
                          post.pinned ? "ยกเลิก pin?" : "Pin โพสต์?",
                          post.title,
                          () => staff.pinPost(post.id, !post.pinned),
                        ),
                      )}
                      {button("ลบโพสต์", () =>
                        confirm(
                          "ลบโพสต์?",
                          post.title,
                          () => staff.deletePost(post.id),
                          true,
                        ),
                      )}
                    </View>
                  </View>
                ))}
                {!state.posts.loading &&
                  !state.posts.error &&
                  !state.posts.items.length && (
                    <Text style={styles.muted}>ไม่พบโพสต์</Text>
                  )}
                {pager(
                  state.posts.page,
                  state.posts.total,
                  (page) => void staff.loadPosts(state.posts.query, page),
                  state.posts.loading,
                )}
              </>
            )}
            {tab === "transactions" && (
              <>
                {input("UID เจ้าของธุรกรรม", uid, setUid)}
                <View style={styles.row}>
                  {["", "topup", "purchase", "refund", "reward"].map((value) =>
                    button(
                      `${type === value ? "● " : ""}${value || "ทุกประเภท"}`,
                      () => setType(value),
                    ),
                  )}
                </View>
                {input("ตั้งแต่วัน (YYYY-MM-DD)", from, setFrom)}
                {input("ถึงวัน (YYYY-MM-DD)", to, setTo)}
                {button(
                  "ใช้ตัวกรอง",
                  () => void staff.loadTransactions(txQuery()),
                )}
                {state.transactions.loading && (
                  <ActivityIndicator color={design.primary} />
                )}
                {state.transactions.error && (
                  <>
                    <Text style={styles.error}>{state.transactions.error}</Text>
                    {button(
                      "ลองใหม่",
                      () =>
                        void staff.loadTransactions(
                          state.transactions.query,
                          state.transactions.page,
                        ),
                    )}
                  </>
                )}
                {state.transactions.items.map((tx) => (
                  <Pressable
                    key={tx.id}
                    accessibilityRole="button"
                    onPress={() => void staff.loadTransaction(tx.id)}
                    style={styles.card}
                  >
                    <Text style={styles.heading}>
                      {tx.description || tx.type}
                    </Text>
                    <Text
                      style={{
                        color: tx.amount >= 0 ? design.success : design.error,
                      }}
                    >
                      {tx.amount >= 0 ? "+" : ""}
                      {tx.amount} เหรียญ · คงเหลือ {tx.balanceAfter}
                    </Text>
                    <Text style={styles.muted}>
                      {tx.uid} ·{" "}
                      {new Date(tx.createdAt).toLocaleString("th-TH")}
                    </Text>
                  </Pressable>
                ))}
                {!state.transactions.loading &&
                  !state.transactions.error &&
                  !state.transactions.items.length && (
                    <Text style={styles.muted}>ไม่พบธุรกรรม</Text>
                  )}
                {pager(
                  state.transactions.page,
                  state.transactions.total,
                  (page) =>
                    void staff.loadTransactions(state.transactions.query, page),
                  state.transactions.loading,
                )}
              </>
            )}
            {tab === "audit" && (
              <>
                {input("Action", auditAction, setAuditAction)}
                {input("UID ผู้ดำเนินการ", actor, setActor)}
                {button("ใช้ตัวกรอง", () => void staff.loadAudit(auditQuery()))}
                {state.audit.loading && (
                  <ActivityIndicator color={design.primary} />
                )}
                {state.audit.error && (
                  <>
                    <Text style={styles.error}>{state.audit.error}</Text>
                    {button(
                      "ลองใหม่",
                      () =>
                        void staff.loadAudit(
                          state.audit.query,
                          state.audit.offset,
                        ),
                    )}
                  </>
                )}
                {state.audit.items.map((log) => (
                  <View key={log.id} style={styles.card}>
                    <Text style={styles.heading}>{log.action}</Text>
                    <Text selectable style={styles.text}>
                      {log.actor_uid}
                    </Text>
                    <Text selectable style={styles.muted}>
                      {log.target_type} / {log.target_id}
                    </Text>
                    <Text style={styles.muted}>
                      {new Date(log.created_at).toLocaleString("th-TH")}
                    </Text>
                    {log.metadata && (
                      <Text selectable style={styles.muted}>
                        {JSON.stringify(log.metadata)}
                      </Text>
                    )}
                  </View>
                ))}
                {!state.audit.loading &&
                  !state.audit.error &&
                  !state.audit.items.length && (
                    <Text style={styles.muted}>ยังไม่มีประวัติการจัดการ</Text>
                  )}
                <View style={styles.row}>
                  {button(
                    "‹ ก่อนหน้า",
                    () =>
                      void staff.loadAudit(
                        state.audit.query,
                        Math.max(0, state.audit.offset - 50),
                      ),
                    state.audit.offset === 0 || state.audit.loading,
                  )}
                  {button(
                    "ถัดไป ›",
                    () =>
                      void staff.loadAudit(
                        state.audit.query,
                        state.audit.offset + 50,
                      ),
                    !state.audit.hasMore || state.audit.loading,
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </>
      ) : (
        <View style={styles.content}>
          <Text style={styles.error}>
            {error ?? "บัญชีนี้ไม่มีสิทธิ์เปิดหน้าทีมงาน"}
          </Text>
        </View>
      )}
      <Modal
        visible={!!state.userUid}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) staff.closeUser();
        }}
      >
        <SafeAreaView style={styles.root}>
          <View style={styles.header}>
            {button("ปิด", staff.closeUser)}
            <Text style={styles.heading}>รายละเอียดผู้ใช้</Text>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {state.userLoading && <ActivityIndicator color={design.primary} />}
            {(state.userError || error) && (
              <Text style={styles.error}>{error || state.userError}</Text>
            )}
            {state.userError &&
              button("ลองใหม่", () => void staff.loadUser(state.userUid!))}
            {state.user && (
              <>
                <View style={styles.card}>
                  <Text style={styles.heading}>{state.user.displayName}</Text>
                  <Text selectable style={styles.text}>
                    {state.user.uid}
                  </Text>
                  <Text style={styles.text}>{state.user.email}</Text>
                  <Text style={styles.muted}>
                    role {state.user.role} · {state.user.plan} · trust{" "}
                    {state.user.trustScore}
                  </Text>
                  <Text style={styles.text}>
                    เหรียญ {state.user.walletBalance} · โพสต์{" "}
                    {state.user.postCount} · rating {state.user.ratingAvg}
                  </Text>
                  <Text style={styles.muted}>
                    เข้าร่วม{" "}
                    {new Date(state.user.joinedAt).toLocaleDateString("th-TH")}
                  </Text>
                  {button("ดูโปรไฟล์", () =>
                    onNavigate({ kind: "profile", id: state.user!.uid }),
                  )}
                </View>
                <View style={styles.card}>
                  <Text style={styles.heading}>เปลี่ยน role</Text>
                  <View style={styles.row}>
                    {([0, 1, 2] as const).map((value) =>
                      button(
                        { 0: "นักอ่าน", 1: "นักแปล", 2: "ผู้สร้าง" }[value],
                        () =>
                          confirm(
                            "เปลี่ยน role?",
                            `${state.user!.displayName} → role ${value}`,
                            () => staff.changeRole(value),
                          ),
                        state.user!.role >= 8 || state.user!.role === value,
                      ),
                    )}
                  </View>
                  {button(
                    state.user.banned ? "ปลดแบน" : "แบนผู้ใช้",
                    () =>
                      confirm(
                        state.user!.banned ? "ปลดแบนผู้ใช้?" : "แบนผู้ใช้?",
                        state.user!.displayName,
                        () => staff.ban(!state.user!.banned),
                        !state.user!.banned,
                      ),
                    !state.user.banned && state.user.role >= 8,
                  )}
                </View>
                <View style={styles.card}>
                  <Text style={styles.heading}>ปรับเหรียญ</Text>
                  {input("จำนวนเพิ่ม/ลด เช่น 10 หรือ -10", delta, setDelta)}
                  {input("เหตุผล (จำเป็น)", reason, setReason)}
                  {button(
                    "ยืนยันปรับเหรียญ",
                    () =>
                      confirm(
                        "ปรับยอดเหรียญ?",
                        `${state.user!.displayName} ${Number(delta) >= 0 ? "+" : ""}${Number(delta)} เหรียญ\n${reason.trim()}`,
                        () => staff.adjustWallet(Number(delta), reason),
                      ),
                    !Number.isInteger(Number(delta)) ||
                      !Number(delta) ||
                      Math.abs(Number(delta)) > 1_000_000 ||
                      !reason.trim() ||
                      reason.trim().length > 200,
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!state.transactionId}
        animationType="slide"
        onRequestClose={staff.closeTransaction}
      >
        <SafeAreaView style={styles.root}>
          <View style={styles.header}>
            {button("ปิด", staff.closeTransaction)}
            <Text style={styles.heading}>รายละเอียดธุรกรรม</Text>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {state.transactionLoading && (
              <ActivityIndicator color={design.primary} />
            )}
            {state.transactionError && (
              <>
                <Text style={styles.error}>{state.transactionError}</Text>
                {button(
                  "ลองใหม่",
                  () => void staff.loadTransaction(state.transactionId!),
                )}
              </>
            )}
            {state.transaction && (
              <View style={styles.card}>
                <Text style={styles.heading}>
                  {state.transaction.description || state.transaction.type}
                </Text>
                <Text selectable style={styles.text}>
                  ID: {state.transaction.id}
                </Text>
                <Text selectable style={styles.text}>
                  UID: {state.transaction.uid}
                </Text>
                <Text style={styles.text}>
                  ประเภท: {state.transaction.type}
                </Text>
                <Text style={styles.number}>
                  {state.transaction.amount >= 0 ? "+" : ""}
                  {state.transaction.amount} เหรียญ
                </Text>
                <Text style={styles.text}>
                  ยอดหลังทำรายการ: {state.transaction.balanceAfter}
                </Text>
                <Text selectable style={styles.muted}>
                  อ้างอิง: {state.transaction.referenceId ?? "—"}
                </Text>
                <Text style={styles.muted}>
                  {new Date(state.transaction.createdAt).toLocaleString(
                    "th-TH",
                  )}
                </Text>
                {button("ดูเจ้าของบัญชี", () => {
                  const uid = state.transaction!.uid;
                  staff.closeTransaction();
                  void staff.loadUser(uid);
                })}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: design.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "#141414",
    borderBottomWidth: 1,
    borderColor: design.border,
  },
  tabs: { padding: 12, gap: 8 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  card: {
    backgroundColor: design.tint,
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  heading: { color: design.foreground, fontSize: 17, fontWeight: "700" },
  number: { fontSize: 28, color: design.primary, fontWeight: "700" },
  text: { color: design.foreground },
  muted: { color: design.muted, fontSize: 12, lineHeight: 20 },
  error: { color: design.error },
  button: {
    backgroundColor: design.tint,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: design.border,
  },
  input: {
    color: design.foreground,
    backgroundColor: design.surface,
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 12,
    padding: 14,
  },
});
