import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  createRetention,
  CollectionInput,
  FeedMode,
} from "./retention.ts";
import type { MobileRuntime } from "./runtime.ts";
import { NativeFeedPost } from "./NativeCommunityView.tsx";
import { design } from "./design.ts";

type Retention = ReturnType<typeof createRetention>;
function Action({
  label,
  onPress,
  disabled = false,
  selected = false,
  danger = false,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  selected?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.actionText,
          selected && styles.selectedText,
          danger && styles.danger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function Failure({ error, retry }: { error: string | null; retry?(): void }) {
  return error ? (
    <View style={styles.section}>
      <Text accessibilityRole="alert" style={styles.danger}>
        {error}
      </Text>
      {retry && <Action label="ลองอีกครั้ง" onPress={retry} />}
    </View>
  ) : null;
}
function Loading({ label }: { label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={styles.section}
    >
      <Text accessibilityLiveRegion="polite" style={styles.caption}>
        {label}
      </Text>
      {[72, 100, 84].map((width) => (
        <View key={width} style={[styles.skeleton, { width: `${width}%` }]} />
      ))}
    </View>
  );
}

export function NativeCollectionsView({
  retention,
  runtime,
  onAccount,
  onBook,
}: {
  retention: Retention;
  runtime: MobileRuntime;
  onAccount(): void;
  onBook(id: string): void;
}) {
  const { top } = useSafeAreaInsets();
  const state = useSyncExternalStore(retention.subscribe, retention.snapshot);
  const session = useSyncExternalStore(
    runtime.session.subscribe,
    runtime.session.snapshot,
  );
  const uid = session.status === "signedIn" ? session.account?.uid : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CollectionInput>({
    name: "",
    description: "",
    visibility: "private",
  });
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const active = useRef(true);
  const detail = state.detail;
  const owned = !!uid && detail?.owner_uid === uid;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    setEditing(false);
    setQuery("");
    setSearched(false);
    setShareError(null);
  }, [state.id, uid]);
  useEffect(() => {
    if (!state.id && uid) void retention.list();
  }, [retention, state.id, uid]);
  async function share() {
    if (!detail || detail.visibility !== "public" || sharing) return;
    setSharing(true);
    setShareError(null);
    try {
      await Share.share({
        title: detail.name,
        message: `${detail.name}\nmangadock://collections/${detail.id}`,
      });
    } catch {
      if (active.current)
        setShareError("แชร์คอลเลกชันไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      if (active.current) setSharing(false);
    }
  }
  function edit(create = false) {
    setDraft(
      create || !detail
        ? { name: "", description: "", visibility: "private" }
        : {
            name: detail.name,
            description: detail.description,
            visibility: detail.visibility,
          },
    );
    setEditing(true);
  }
  const form = editing && uid && (!detail || owned) && (
    <View style={styles.section}>
      <Text style={styles.heading}>
        {detail ? "แก้ไขคอลเลกชัน" : "สร้างคอลเลกชัน"}
      </Text>
      <Text style={styles.caption}>ชื่อคอลเลกชัน</Text>
      <TextInput
        accessibilityLabel="ชื่อคอลเลกชัน"
        value={draft.name}
        maxLength={100}
        editable={!state.saving}
        onChangeText={(name) => setDraft({ ...draft, name })}
        style={styles.input}
        placeholder="เช่น เรื่องที่อยากอ่าน"
        placeholderTextColor={design.muted}
      />
      <Text style={styles.caption}>คำอธิบาย</Text>
      <TextInput
        accessibilityLabel="คำอธิบายคอลเลกชัน"
        value={draft.description}
        maxLength={1000}
        multiline
        editable={!state.saving}
        onChangeText={(description) => setDraft({ ...draft, description })}
        style={[styles.input, styles.description]}
      />
      <View style={styles.row}>
        {(
          [
            ["private", "ส่วนตัว"],
            ["public", "สาธารณะ"],
          ] as const
        ).map(([visibility, label]) => (
          <Action
            key={visibility}
            label={label}
            selected={draft.visibility === visibility}
            disabled={state.saving}
            onPress={() => setDraft({ ...draft, visibility })}
          />
        ))}
      </View>
      <Text style={styles.caption}>
        {draft.visibility === "private"
          ? "คุณเท่านั้นที่เปิดดูคอลเลกชันนี้ได้"
          : "ทุกคนที่มีลิงก์เปิดดูรายชื่อมังงะและคำอธิบายได้"}
      </Text>
      <View style={styles.row}>
        <Action
          label={state.saving ? "กำลังบันทึก…" : "บันทึกคอลเลกชัน"}
          selected
          disabled={state.saving || !draft.name.trim()}
          onPress={() => {
            void retention.save(draft, detail?.id).then((saved) => {
              if (saved && active.current) setEditing(false);
            });
          }}
        />
        <Action
          label="ยกเลิกการแก้ไข"
          disabled={state.saving}
          onPress={() => setEditing(false)}
        />
      </View>
    </View>
  );
  if (state.id)
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? top : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Text style={styles.title}>คอลเลกชัน</Text>
          {state.detailLoading && <Loading label="กำลังโหลดคอลเลกชัน" />}
          <Failure
            error={state.detailError}
            retry={() => void retention.open(state.id!)}
          />
          {detail && (
            <>
              <Text style={styles.title}>{detail.name}</Text>
              <Text style={styles.caption}>
                {detail.visibility === "public" ? "สาธารณะ" : "ส่วนตัว"} ·{" "}
                {detail.items.length} เรื่อง
              </Text>
              {!!detail.description && (
                <Text style={styles.body}>{detail.description}</Text>
              )}
              <View style={styles.row}>
                {detail.visibility === "public" && (
                  <Action
                    label="แชร์ลิงก์เปิดในแอป"
                    disabled={sharing || state.saving}
                    onPress={() => void share()}
                  />
                )}
                {owned && (
                  <Action
                    label="แก้ไขคอลเลกชัน"
                    disabled={state.saving}
                    onPress={() => edit()}
                  />
                )}
              </View>
              <Failure error={shareError} />
              {form}
              <Failure error={state.mutationError} />
              {owned && !editing && (
                <View style={styles.section}>
                  <Text style={styles.heading}>เพิ่มมังงะ</Text>
                  <TextInput
                    accessibilityLabel="ค้นหามังงะสำหรับคอลเลกชัน"
                    value={query}
                    onChangeText={setQuery}
                    style={styles.input}
                    placeholder="ชื่อเรื่อง"
                    placeholderTextColor={design.muted}
                    returnKeyType="search"
                    onSubmitEditing={() => {
                      if (query.trim()) {
                        setSearched(true);
                        void retention.search(query);
                      }
                    }}
                  />
                  <Action
                    label="ค้นหาเรื่องเพื่อเพิ่ม"
                    disabled={!query.trim() || state.searching || state.saving}
                    onPress={() => {
                      setSearched(true);
                      void retention.search(query);
                    }}
                  />
                  {state.searching && <Loading label="กำลังค้นหามังงะ" />}
                  <Failure error={state.searchError} />
                  {searched &&
                    !state.searching &&
                    !state.searchError &&
                    !state.results.length && (
                      <Text style={styles.caption}>
                        ไม่พบเรื่องที่ค้นหา ลองใช้ชื่ออื่น
                      </Text>
                    )}
                  {state.results.map((book) => {
                    const added = detail.items.some(
                      (item) => item.manga_id === book.id,
                    );
                    return (
                      <View key={book.id} style={styles.item}>
                        <Text style={styles.body}>{book.title}</Text>
                        <Action
                          label={
                            added
                              ? `เพิ่มแล้ว: ${book.title}`
                              : `เพิ่มเรื่อง: ${book.title}`
                          }
                          disabled={added || state.saving}
                          onPress={() => void retention.item(book)}
                        />
                      </View>
                    );
                  })}
                </View>
              )}
              <Text style={styles.heading}>มังงะในคอลเลกชัน</Text>
              {!detail.items.length && (
                <Text style={styles.caption}>
                  {owned
                    ? "ค้นหาชื่อมังงะด้านบนเพื่อเริ่มจัดคอลเลกชัน"
                    : "คอลเลกชันนี้ยังไม่มีมังงะ"}
                </Text>
              )}
              {detail.items.map((book) => (
                <View key={book.manga_id} style={styles.item}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`เปิดเรื่อง: ${book.title}`}
                    onPress={() => onBook(book.manga_id)}
                    style={styles.bookLink}
                  >
                    <Text style={styles.heading}>{book.title}</Text>
                    <Text style={styles.caption}>ดูรายละเอียดเรื่อง</Text>
                  </Pressable>
                  {owned && (
                    <Action
                      label={`นำออก: ${book.title}`}
                      disabled={state.saving}
                      danger
                      onPress={() =>
                        Alert.alert("นำเรื่องออกจากคอลเลกชัน?", book.title, [
                          { text: "ยกเลิก", style: "cancel" },
                          {
                            text: "นำเรื่องออก",
                            style: "destructive",
                            onPress: () =>
                              void retention.item(
                                { id: book.manga_id, title: book.title },
                                true,
                              ),
                          },
                        ])
                      }
                    />
                  )}
                </View>
              ))}
              {owned && (
                <Action
                  label="ลบคอลเลกชัน"
                  disabled={state.saving}
                  danger
                  onPress={() =>
                    Alert.alert(
                      "ลบคอลเลกชันนี้?",
                      "รายชื่อในคอลเลกชันจะถูกลบ การอ่านและรายการโปรดของคุณยังอยู่",
                      [
                        { text: "ยกเลิก", style: "cancel" },
                        {
                          text: "ลบคอลเลกชัน",
                          style: "destructive",
                          onPress: () => void retention.remove(),
                        },
                      ],
                    )
                  }
                />
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "android" ? top : 0}
    >
      <FlatList
        data={state.collections}
        keyExtractor={(item) => item.id}
        refreshing={state.listLoading}
        onRefresh={() => {
          if (uid) void retention.list();
        }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.section}>
            <Text style={styles.title}>คอลเลกชันของฉัน</Text>
            <Text style={styles.caption}>
              จัดมังงะเป็นชุด แล้วเลือกเก็บส่วนตัวหรือแชร์ให้เพื่อน
            </Text>
            {uid ? (
              <Action
                label="สร้างคอลเลกชัน"
                selected
                disabled={state.saving}
                onPress={() => edit(true)}
              />
            ) : (
              <Action
                label="เข้าสู่ระบบเพื่อจัดคอลเลกชัน"
                selected
                onPress={onAccount}
              />
            )}
            {form}
            <Failure error={state.mutationError} />
            <Failure
              error={state.listError}
              retry={() => void retention.list()}
            />
            {state.listLoading && <Loading label="กำลังโหลดคอลเลกชันของฉัน" />}
          </View>
        }
        ListEmptyComponent={
          uid && !state.listLoading && !state.listError ? (
            <Text style={styles.caption}>
              ยังไม่มีคอลเลกชัน ลองสร้างชุดแรกสำหรับเรื่องที่อยากอ่าน
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`เปิดคอลเลกชัน: ${item.name}`}
            style={styles.item}
            onPress={() => void retention.open(item.id)}
          >
            <Text style={styles.heading}>{item.name}</Text>
            <Text style={styles.caption}>
              {item.visibility === "public" ? "สาธารณะ" : "ส่วนตัว"}
            </Text>
            {!!item.description && (
              <Text numberOfLines={2} style={styles.body}>
                {item.description}
              </Text>
            )}
          </Pressable>
        )}
      />
    </KeyboardAvoidingView>
  );
}

export function NativePersonalFeedView({
  retention,
  runtime,
  onAccount,
  onPost,
  onManga,
  onProfile,
}: {
  retention: Retention;
  runtime: MobileRuntime;
  onAccount(): void;
  onPost(id: string): void;
  onManga(id: string): void;
  onProfile(id: string): void;
}) {
  const { feed } = useSyncExternalStore(
    retention.subscribe,
    retention.snapshot,
  );
  const session = useSyncExternalStore(
    runtime.session.subscribe,
    runtime.session.snapshot,
  );
  const uid = session.status === "signedIn" ? session.account?.uid : null;
  useEffect(() => {
    if (
      uid &&
      !retention.snapshot().feed.items.length &&
      !retention.snapshot().feed.error
    )
      void retention.feed();
  }, [retention, uid]);
  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      data={feed.items}
      keyExtractor={(post) => post.id}
      refreshing={feed.loading}
      onRefresh={() => {
        if (uid) void retention.feed(feed.mode);
      }}
      ListHeaderComponent={
        <View style={styles.section}>
          <Text style={styles.title}>ฟีดของฉัน</Text>
          <View style={styles.row}>
            {(
              [
                ["following", "กำลังติดตาม"],
                ["personalized", "สำหรับคุณ"],
              ] as Array<[FeedMode, string]>
            ).map(([mode, label]) => (
              <Action
                key={mode}
                label={label}
                selected={mode === feed.mode}
                disabled={!uid}
                onPress={() => void retention.feed(mode)}
              />
            ))}
          </View>
          {!uid && (
            <Action
              label="เข้าสู่ระบบเพื่อดูฟีดของฉัน"
              selected
              onPress={onAccount}
            />
          )}
          <Failure
            error={feed.error}
            retry={() => void retention.feed(feed.mode, feed.offset > 0)}
          />
          {feed.loading && <Loading label="กำลังโหลดฟีดของฉัน" />}
        </View>
      }
      ListEmptyComponent={
        uid && !feed.loading && !feed.error ? (
          <Text style={styles.caption}>
            {feed.mode === "following"
              ? "ติดตามนักอ่านหรือนักแปลจากหน้าโปรไฟล์ แล้วกลับมาดูโพสต์ของพวกเขาที่นี่"
              : "ยังไม่มีโพสต์สำหรับคุณ ลองกลับมาดูใหม่ภายหลัง"}
          </Text>
        ) : null
      }
      ListFooterComponent={
        uid && feed.offset < feed.total ? (
          <Action
            label="โหลดโพสต์เพิ่มเติม"
            disabled={feed.loading}
            onPress={() => void retention.feed(feed.mode, true)}
          />
        ) : null
      }
      renderItem={({ item }) => (
        <NativeFeedPost
          key={`${feed.mode}:${item.id}`}
          post={item}
          apiOrigin={runtime.apiOrigin}
          onOpen={() => onPost(item.id)}
          onManga={onManga}
          onProfile={onProfile}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 20,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  section: { gap: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  title: {
    color: design.foreground,
    fontSize: 26,
    fontWeight: "600",
    lineHeight: 36,
  },
  heading: {
    color: design.foreground,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 28,
  },
  body: {
    color: design.foreground,
    fontSize: 16,
    lineHeight: 26,
    flexShrink: 1,
  },
  caption: { color: design.muted, fontSize: 14, lineHeight: 23 },
  action: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 12,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  actionText: {
    color: design.foreground,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    flexShrink: 1,
  },
  selected: { backgroundColor: design.foreground },
  selectedText: { color: design.background },
  disabled: { opacity: 0.5 },
  danger: { color: design.error, fontSize: 14, lineHeight: 23 },
  input: {
    color: design.foreground,
    backgroundColor: design.surface,
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 12,
    minHeight: 48,
    padding: 12,
    fontSize: 16,
  },
  description: { minHeight: 96, textAlignVertical: "top" },
  item: {
    gap: 8,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: design.border,
  },
  bookLink: { minHeight: 48, justifyContent: "center", gap: 4 },
  skeleton: { height: 14, borderRadius: 4, backgroundColor: design.tint },
});
