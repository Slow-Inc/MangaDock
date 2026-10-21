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
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { createStudio, type ChapterVersion } from "./studio.ts";
import { createApi } from "./api.ts";
import type { Book, BookDetail } from "./catalog.ts";
import type { MobileRuntime } from "./runtime.ts";
import type { NotificationDestination } from "./notification-links.ts";
import { NativeAccountView } from "./NativeAccountView.tsx";
import { NativeAccountActivity } from "./NativeAccountActivity.tsx";
import { createAccountActivity } from "./account-activity.ts";
import { pickImages } from "./native-images.ts";
import { imageUri } from "./assets.ts";
import { NativeIcon } from "./NativeDesign.tsx";
import { design } from "./design.ts";
const labels = {
  draft: "ฉบับร่าง",
  pending_moderation: "รอตรวจ",
  published: "เผยแพร่แล้ว",
  rejected: "ไม่ผ่านการตรวจ",
};
const languages = ["th", "en", "ja", "ko", "zh", "vi", "id", "fr", "es", "pt"];
function StudioCover({ runtime, id }: { runtime: MobileRuntime; id: string }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void createApi(runtime)
      .json<BookDetail>(`books/manga/${encodeURIComponent(id)}`, {
        signal: controller.signal,
      })
      .then((book) => {
        if (active && book.covers[0]?.url)
          setUri(imageUri(book.covers[0].url, runtime.apiOrigin));
      })
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, runtime]);
  return uri ? (
    <Image source={{ uri }} style={styles.cover} />
  ) : (
    <View
      style={[
        styles.cover,
        {
          backgroundColor: design.tint,
          justifyContent: "center",
          alignItems: "center",
        },
      ]}
    >
      <NativeIcon name="book" color={design.muted} />
    </View>
  );
}
export function NativeStudioView({
  runtime,
  onBack,
  onNavigate,
  onRead,
}: {
  runtime: MobileRuntime;
  onBack(): void;
  onNavigate(destination: NotificationDestination): void;
  onRead(version: ChapterVersion): void;
}) {
  const [studio] = useState(() => createStudio(runtime)),
    [activity] = useState(() => createAccountActivity(runtime));
  const state = useSyncExternalStore(studio.subscribe, studio.snapshot),
    session = useSyncExternalStore(
      runtime.session.subscribe,
      runtime.session.snapshot,
    );
  const [tab, setTab] = useState<"overview" | "works" | "wallet" | "account">(
      "overview",
    ),
    [editor, setEditor] = useState(false),
    [titleId, setTitleId] = useState<string | null>(null),
    [grid, setGrid] = useState(false);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [filterLanguage, setFilterLanguage] = useState("all");
  const [search, setSearch] = useState(""),
    [books, setBooks] = useState<Book[]>([]),
    [book, setBook] = useState<Book | null>(null);
  const [chapterNumber, setChapterNumber] = useState("1"),
    [chapterTitle, setChapterTitle] = useState(""),
    [language, setLanguage] = useState("th"),
    [description, setDescription] = useState(""),
    [price, setPrice] = useState("0");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [walletOpen, setWalletOpen] = useState(false);
  const active = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (pending.current) return true;
      if (editor) {
        setEditor(false);
        return true;
      }
      if (titleId) {
        setTitleId(null);
        return true;
      }
      if (tab !== "overview") {
        setTab("overview");
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [editor, titleId, tab]);
  useEffect(() => {
    active.current = true;
    studio.activate();
    activity.activate();
    if (Number(session.account?.role) !== 0) {
      void studio.load();
      void studio.loadEarnings();
    }
    const listener = AppState.addEventListener("change", (next) => {
      if (
        next === "active" &&
        !studio.snapshot().uploading &&
        Number(runtime.session.snapshot().account?.role) !== 0
      ) {
        void studio.load();
        void studio.loadEarnings();
      }
    });
    return () => {
      active.current = false;
      listener.remove();
      studio.dispose();
      activity.dispose();
    };
  }, [studio, activity, runtime]);
  useEffect(() => {
    const version = state.version;
    if (version) {
      setChapterNumber(version.chapterNumber);
      setChapterTitle(version.chapterTitle);
      setLanguage(version.language);
      setDescription(version.description ?? "");
      setPrice(String(version.priceCoins));
    }
  }, [state.version]);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setBooks([]);
    const timer = setTimeout(() => {
      if (search.trim().length < 2 || state.version) return;
      void createApi(runtime)
        .json<{ items: Book[] }>(
          `books/search?q=${encodeURIComponent(search.trim())}&limit=20&offset=0`,
          { signal: controller.signal },
        )
        .then((result) => {
          if (current) setBooks(result.items);
        })
        .catch((failure) => {
          if (current && !controller.signal.aborted)
            setError(
              failure instanceof Error ? failure.message : "ค้นหาไม่สำเร็จ",
            );
        });
    }, 400);
    return () => {
      current = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [search, runtime, state.version]);
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
      disabled={busy || state.uploading || disabled}
      style={[
        styles.button,
        (busy || disabled || state.uploading) && { opacity: 0.5 },
      ]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
  const input = (
    label: string,
    value: string,
    change: (value: string) => void,
    disabled = false,
    multiline = false,
  ) => (
    <View style={{ gap: 6 }}>
      <Text style={styles.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        editable={!busy && !disabled && !state.uploading}
        multiline={multiline}
        style={[
          styles.input,
          multiline && { minHeight: 90, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
  function newVersion() {
    studio.beginNew();
    setEditor(true);
    setBook(null);
    setSearch("");
    setChapterNumber("1");
    setChapterTitle("");
    setLanguage("th");
    setPrice("0");
    setDescription("");
    setError(null);
  }
  function editVersion(version: ChapterVersion) {
    setEditor(true);
    void run(() => studio.open(version.versionId));
  }
  function leaveEditor() {
    setEditor(false);
    studio.beginNew();
    void studio.load();
  }
  const allowed = [1, 2, 8].includes(Number(session.account?.role));
  if (tab === "account" && allowed)
    return (
      <NativeAccountView
        runtime={runtime}
        onBack={() => setTab("overview")}
        onNavigate={onNavigate}
      />
    );
  const filtered = state.versions.filter(
    (version) =>
      (!query.trim() ||
        `${version.titleName} ${version.titleAltName ?? ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())) &&
      (status === "all" || version.status === status) &&
      (filterLanguage === "all" || version.language === filterLanguage),
  );
  const groups = [...new Set(filtered.map((version) => version.titleId))].map(
    (id) => ({
      id,
      versions: filtered.filter((version) => version.titleId === id),
    }),
  );
  const version = state.version,
    editable = !version || ["draft", "published"].includes(version.status),
    amount = Number(price);
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {button("‹", () =>
          editor ? leaveEditor() : titleId ? setTitleId(null) : onBack(),
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>MangaDock Studio</Text>
          <Text style={styles.muted}>
            {editor ? "อัปโหลดและจัดการตอน" : "พื้นที่นักแปลและผู้สร้าง"}
          </Text>
        </View>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {(busy || state.loading) && (
          <ActivityIndicator color={design.primary} />
        )}
        {(error || state.error) && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error || state.error}
          </Text>
        )}
        {state.error && button("โหลดผลงานใหม่", () => void studio.load())}
        {!allowed ? (
          <View style={styles.hero}>
            <Text style={styles.title}>เริ่มเส้นทางนักแปล</Text>
            <Text style={styles.muted}>
              ใช้บัญชี MangaDock เดิมเพื่อสร้างผลงานและจัดการตอนแปล
            </Text>
            {Number(session.account?.role) === 0 ? (
              button(
                "สมัครเป็นนักแปล",
                () => void run(() => studio.becomeCreator()),
              )
            ) : (
              <Text style={styles.error}>
                บัญชีนี้ไม่มีสิทธิ์เปิด Studio ตามกติกาปัจจุบัน
              </Text>
            )}
          </View>
        ) : editor ? (
          <>
            <Text style={styles.title}>
              {version
                ? `${version.titleName} · ${labels[version.status]}`
                : "สร้างฉบับร่างใหม่"}
            </Text>
            {state.creationUncertain && (
              <View style={styles.card}>
                <Text style={styles.error}>
                  ยังไม่ทราบผลสร้าง draft ให้กลับไปตรวจผลงานเดิมก่อนสร้างซ้ำ
                </Text>
                {button("ตรวจผลงานเดิม", leaveEditor)}
              </View>
            )}
            {!version && !state.creationUncertain && (
              <>
                {book ? (
                  button(`✓ ${book.title} · เปลี่ยนเรื่อง`, () => setBook(null))
                ) : (
                  <>
                    {input(
                      "ค้นหามังงะ (อย่างน้อย 2 ตัวอักษร)",
                      search,
                      setSearch,
                    )}
                    {books.map((item) =>
                      button(item.title, () => {
                        setBook(item);
                        setSearch("");
                      }),
                    )}
                  </>
                )}
              </>
            )}
            {input("เลขตอน", chapterNumber, setChapterNumber, !!version)}
            {input("ชื่อตอน", chapterTitle, setChapterTitle, !!version)}
            <Text style={styles.muted}>ภาษา</Text>
            <View style={styles.row}>
              {languages.map((value) =>
                button(
                  `${language === value ? "● " : ""}${value}`,
                  () => setLanguage(value),
                  !!version,
                ),
              )}
            </View>
            {input(
              "หมายเหตุ (ไม่เกิน 1000 ตัวอักษร)",
              description,
              setDescription,
              !editable,
              true,
            )}
            {input("ราคาเหรียญ (0 = ฟรี)", price, setPrice, !editable)}
            {version &&
              editable &&
              button(
                "บันทึกข้อมูลตอน",
                () =>
                  void run(() =>
                    studio.saveMetadata({ description, priceCoins: amount }),
                  ),
                !Number.isInteger(amount) ||
                  amount < 0 ||
                  description.length > 1000,
              )}
            {editable &&
              !state.creationUncertain &&
              button(
                "เลือกรูปและอัปโหลดหน้ามังงะ",
                () =>
                  void run(async () => {
                    const images = await pickImages(30);
                    if (!active.current || !images.length) return;
                    await studio.queuePages(
                      images,
                      version
                        ? undefined
                        : {
                            titleId: book!.id,
                            titleName: book!.title,
                            chapterNumber,
                            chapterTitle,
                            language,
                            description,
                            priceCoins: amount,
                          },
                    );
                  }),
                !version &&
                  (!book ||
                    !chapterNumber.trim() ||
                    !Number.isInteger(amount) ||
                    amount < 0 ||
                    description.length > 1000),
              )}
            {state.uploads.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.heading}>
                  อัปโหลดแล้ว{" "}
                  {
                    state.uploads.filter(
                      (upload) => upload.status === "uploaded",
                    ).length
                  }
                  /{state.uploads.length}
                </Text>
                {state.uploads.map((upload, index) => (
                  <View key={index} style={{ gap: 5 }}>
                    <Text style={styles.text}>
                      {index + 1}. {upload.image.name} ·{" "}
                      {
                        {
                          pending: "รอส่ง",
                          sending: "กำลังอัปโหลด",
                          uploaded: "บันทึกแล้ว",
                          error: "ไม่สำเร็จ",
                          uncertain: "รอตรวจผล server",
                        }[upload.status]
                      }
                    </Text>
                    {upload.error && (
                      <Text style={styles.error}>{upload.error}</Text>
                    )}
                  </View>
                ))}
                {state.uploads.some(
                  (upload) =>
                    upload.status === "error" || upload.status === "pending",
                ) &&
                  button(
                    "ลองอัปโหลดหน้าที่เหลือ",
                    () => void run(() => studio.retryPages()),
                  )}
                {state.uploads.some(
                  (upload) => upload.status === "uncertain",
                ) &&
                  button("ตรวจแล้ว ต้องการส่งหน้าที่ไม่ทราบผลซ้ำ", () =>
                    Alert.alert(
                      "ตรวจ pages ที่บันทึกแล้วก่อนส่งซ้ำ",
                      "หาก server รับรูปไปแล้วแต่คำตอบหาย การส่งซ้ำอาจเพิ่มหน้าซ้ำ ให้ตรวจภาพด้านล่างก่อน",
                      [
                        { text: "ยกเลิก" },
                        {
                          text: "ยืนยันส่งซ้ำ",
                          onPress: () =>
                            void run(() => studio.retryPages(true)),
                        },
                      ],
                    ),
                  )}
              </View>
            )}
            {version && (
              <>
                <Text style={styles.heading}>
                  หน้าที่ server บันทึก ({version.pages.length})
                </Text>
                <View style={styles.row}>
                  {version.pages.map((page, index) => (
                    <View key={`${index}:${page}`} style={styles.page}>
                      <Image
                        source={{ uri: imageUri(page, runtime.apiOrigin) }}
                        resizeMode="contain"
                        style={{ width: "100%", aspectRatio: 2 / 3 }}
                      />
                      <Text style={styles.muted}>หน้า {index + 1}</Text>
                      {editable && (
                        <>
                          {button(
                            "↑",
                            () =>
                              void run(() => {
                                const pages = [...version.pages];
                                [pages[index - 1], pages[index]] = [
                                  pages[index],
                                  pages[index - 1],
                                ];
                                return studio.reorderPages(pages);
                              }),
                            index === 0,
                          )}
                          {button(
                            "↓",
                            () =>
                              void run(() => {
                                const pages = [...version.pages];
                                [pages[index + 1], pages[index]] = [
                                  pages[index],
                                  pages[index + 1],
                                ];
                                return studio.reorderPages(pages);
                              }),
                            index === version.pages.length - 1,
                          )}
                          {button("ลบหน้า", () =>
                            Alert.alert("ลบหน้านี้?", "ลบรูปจากตอนนี้", [
                              { text: "ยกเลิก" },
                              {
                                text: "ลบ",
                                style: "destructive",
                                onPress: () =>
                                  void run(() => studio.deletePage(page)),
                              },
                            ]),
                          )}
                        </>
                      )}
                    </View>
                  ))}
                </View>
                {version.status === "draft" && (
                  <>
                    {button(
                      "เผยแพร่ตอน",
                      () =>
                        Alert.alert(
                          "เผยแพร่ตอน?",
                          "ตอนนี้จะอ่านได้ตามภาษาและราคาเหรียญที่บันทึกไว้",
                          [
                            { text: "ยกเลิก" },
                            {
                              text: "เผยแพร่",
                              onPress: () =>
                                void run(() => studio.status("published")),
                            },
                          ],
                        ),
                      !version.pages.length,
                    )}
                    {button(
                      "ส่งเข้าตรวจ",
                      () => void run(() => studio.status("pending_moderation")),
                      !version.pages.length,
                    )}
                  </>
                )}
                {["published", "rejected"].includes(version.status) &&
                  button(
                    "กลับเป็นฉบับร่าง",
                    () => void run(() => studio.status("draft")),
                  )}
                {version.status === "pending_moderation" && (
                  <Text style={styles.muted}>
                    รอตรวจตามระบบเดิม
                    ยังไม่มีคำสั่งอนุมัติหรือเปลี่ยนออกจากสถานะนี้ใน API
                    ปัจจุบัน
                  </Text>
                )}
                {version.status === "published" &&
                  button(
                    "อ่านตอนที่เผยแพร่",
                    () => onRead(version),
                    version.backendAvailable === false,
                  )}
                {button("ลบเวอร์ชันนี้", () =>
                  Alert.alert("ลบเวอร์ชันและ pages?", "ข้อมูลนี้จะถูกลบถาวร", [
                    { text: "ยกเลิก" },
                    {
                      text: "ลบ",
                      style: "destructive",
                      onPress: () =>
                        void run(async () => {
                          if (await studio.deleteVersion()) leaveEditor();
                        }),
                    },
                  ]),
                )}
              </>
            )}
          </>
        ) : tab === "works" ? (
          <>
            <View style={styles.row}>
              {button("+ อัปโหลดตอนใหม่", newVersion)}
              {button(grid ? "แสดงรายการ" : "แสดงกริด", () => setGrid(!grid))}
            </View>
            {input("ค้นหาในผลงาน", query, setQuery)}
            <ScrollView horizontal>
              <View style={styles.row}>
                {(
                  [
                    "all",
                    "draft",
                    "pending_moderation",
                    "published",
                    "rejected",
                  ] as const
                ).map((value) =>
                  button(
                    `${status === value ? "● " : ""}${value === "all" ? "ทุกสถานะ" : labels[value]}`,
                    () => setStatus(value),
                  ),
                )}
              </View>
            </ScrollView>
            <ScrollView horizontal>
              <View style={styles.row}>
                {[
                  "all",
                  ...new Set(state.versions.map((item) => item.language)),
                ].map((value) =>
                  button(
                    `${filterLanguage === value ? "● " : ""}${value === "all" ? "ทุกภาษา" : value}`,
                    () => setFilterLanguage(value),
                  ),
                )}
              </View>
            </ScrollView>
            <Text style={styles.muted}>ผลงานล่าสุดสูงสุด 50 เวอร์ชัน</Text>
            {titleId ? (
              <>
                {button("‹ กลับรายการมังงะ", () => setTitleId(null))}
                {filtered
                  .filter((item) => item.titleId === titleId)
                  .sort(
                    (a, b) =>
                      (parseFloat(a.chapterNumber) || 0) -
                      (parseFloat(b.chapterNumber) || 0),
                  )
                  .map((item) => (
                    <Pressable
                      key={item.versionId}
                      onPress={() => editVersion(item)}
                      style={styles.card}
                    >
                      <Text style={styles.heading}>
                        ตอน {item.chapterNumber} · {item.chapterTitle}
                      </Text>
                      <Text style={styles.muted}>
                        {item.language} · {labels[item.status]} ·{" "}
                        {item.pages.length} หน้า · {item.priceCoins} เหรียญ
                      </Text>
                    </Pressable>
                  ))}
              </>
            ) : (
              <View style={grid ? styles.row : { gap: 12 }}>
                {groups.map((group) => (
                  <Pressable
                    key={group.id}
                    accessibilityRole="button"
                    onPress={() => setTitleId(group.id)}
                    style={[styles.card, grid ? { width: "47%" } : styles.row]}
                  >
                    <StudioCover runtime={runtime} id={group.id} />
                    <View style={{ flex: 1, gap: 8 }}>
                      <Text style={styles.heading}>
                        {group.versions[0].titleName}
                      </Text>
                      <Text style={styles.muted}>
                        {group.versions.length} เวอร์ชัน ·{" "}
                        {[
                          ...new Set(
                            group.versions.map((item) => item.language),
                          ),
                        ].join(" · ")}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
            {!state.loading && !filtered.length && (
              <Text style={styles.muted}>ยังไม่มีผลงานที่ตรงกับตัวกรอง</Text>
            )}
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.muted}>CREATOR STUDIO</Text>
              <Text style={styles.title}>
                {tab === "wallet"
                  ? "กระเป๋าเงินนักแปล"
                  : `สวัสดี ${session.account?.displayName ?? "นักแปล"}`}
              </Text>
              <Text style={styles.muted}>
                จัดการผลงาน ตอนแปล และรายได้จากระบบเดิม
              </Text>
            </View>
            {state.earningsLoading && (
              <ActivityIndicator color={design.primary} />
            )}
            {state.earningsError && (
              <>
                <Text style={styles.error}>{state.earningsError}</Text>
                {button("โหลดรายได้ใหม่", () => void studio.loadEarnings())}
              </>
            )}
            {state.earnings && (
              <View style={styles.row}>
                {[
                  ["รายได้ทั้งหมด", state.earnings.totalEarned],
                  ["ยอดขาย", state.earnings.totalSales],
                  ["เรื่องที่ขาย", state.earnings.titlesSold],
                  ["ผู้ซื้อ", state.earnings.uniqueBuyers],
                ].map(([label, value]) => (
                  <View key={label} style={[styles.card, { width: "47%" }]}>
                    <Text style={styles.muted}>{label}</Text>
                    <Text style={styles.number}>{value}</Text>
                  </View>
                ))}
              </View>
            )}
            {button("จัดการผลงาน", () => setTab("works"))}
            {button("อัปโหลดตอนใหม่", () => {
              setTab("works");
              newVersion();
            })}
            {button("ประวัติเหรียญและกิจกรรม", () => setWalletOpen(true))}
            {button("ข้อมูลนักแปลและบัญชี", () => setTab("account"))}
            <View style={styles.card}>
              <Text style={styles.heading}>สถานะผลงานล่าสุด</Text>
              {(
                [
                  "draft",
                  "pending_moderation",
                  "published",
                  "rejected",
                ] as const
              ).map((value) => (
                <Text key={value} style={styles.text}>
                  {labels[value]} ·{" "}
                  {
                    state.versions.filter((item) => item.status === value)
                      .length
                  }
                </Text>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      {!editor && allowed && (
        <View style={styles.tabs}>
          {(["overview", "works", "wallet", "account"] as const).map(
            (value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === value }}
                onPress={() => {
                  setTab(value);
                  if (value === "works") void studio.load();
                  if (value === "wallet") void studio.loadEarnings();
                }}
                style={styles.tab}
              >
                <Text
                  style={{
                    color: tab === value ? design.primary : design.muted,
                  }}
                >
                  {
                    {
                      overview: "ภาพรวม",
                      works: "ผลงาน",
                      wallet: "กระเป๋าเงิน",
                      account: "บัญชี",
                    }[value]
                  }
                </Text>
              </Pressable>
            ),
          )}
        </View>
      )}
      {walletOpen && (
        <NativeAccountActivity
          activity={activity}
          screen="wallet"
          onClose={() => setWalletOpen(false)}
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
  header: {
    backgroundColor: "#141414",
    borderBottomWidth: 1,
    borderColor: design.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  hero: {
    borderWidth: 1,
    borderColor: "rgba(129,140,248,.2)",
    borderRadius: 28,
    padding: 20,
    gap: 12,
    backgroundColor: "rgba(99,102,241,.1)",
  },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 22,
    backgroundColor: design.tint,
    gap: 12,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  heading: { fontSize: 16, color: design.foreground, fontWeight: "700" },
  title: { fontSize: 26, color: design.foreground, fontWeight: "700" },
  text: { color: design.foreground },
  muted: { color: design.muted, fontSize: 12, lineHeight: 20 },
  error: { color: design.error },
  number: { fontSize: 26, color: design.primary, fontWeight: "700" },
  button: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: design.tint,
    borderWidth: 1,
    borderColor: design.border,
  },
  input: {
    color: design.foreground,
    backgroundColor: design.surface,
    padding: 14,
    borderWidth: 1,
    borderColor: design.border,
    borderRadius: 12,
  },
  cover: { width: 64, height: 96, borderRadius: 10 },
  page: { width: "30%", gap: 5 },
  tabs: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: design.border,
    paddingVertical: 14,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8 },
});
