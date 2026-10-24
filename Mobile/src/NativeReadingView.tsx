import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { createCatalog } from "./catalog.ts";
import { createReader } from "./reader.ts";
import type { MobileRuntime } from "./runtime.ts";
import { NativeReaderView } from "./NativeReaderView.tsx";
import { NativeChapterList } from "./NativeChapterList.tsx";
import { NativeWalletView } from "./NativeWalletView.tsx";
import { createWallet } from "./wallet.ts";
import { imageUri } from "./assets.ts";
import { recoverPaymentReading, resumeHistoryReading } from "./recovery.ts";
import { design } from "./design.ts";
import { NativeIcon, NativeTopBar } from "./NativeDesign.tsx";
import { createDiscovery, type BrowseSelection } from "./discovery.ts";
import {
  NativeBookRow,
  NativeDiscoveryView,
  NativeRelatedView,
} from "./NativeDiscoveryView.tsx";
import { createNativeNavigation, type NativeTab } from "./navigation.ts";
import { NativeBottomNavigation } from "./NativeBottomNavigation.tsx";
import { createPersonal, type HistoryBook } from "./personal.ts";
import { createReadingSocial } from "./reading-social.ts";
import { createAccountActivity } from "./account-activity.ts";
import {
  NativeAccountActivity,
  type ActivityScreen,
} from "./NativeAccountActivity.tsx";
import { createProfiles } from "./profiles.ts";
import { NativeProfileView } from "./NativeProfileView.tsx";
import {
  NativeReviewSection,
  NativeReportButton,
} from "./NativeReadingSocial.tsx";
import { NativeLibraryView } from "./NativeLibraryView.tsx";
import { NativeCollectionActions } from "./NativeCollectionActions.tsx";
import { createCommunity } from "./community.ts";
import { NativeCommunityView } from "./NativeCommunityView.tsx";
import { NativeStudioView } from "./NativeStudioView.tsx";
import { NativeStaffView } from "./NativeStaffView.tsx";
import type { NotificationDestination } from "./notification-links.ts";

export function NativeReadingView({
  runtime,
  onAccount,
  accountLabel,
  initialDestination,
  onDestinationHandled,
}: {
  runtime: MobileRuntime;
  onAccount(): void;
  accountLabel: string;
  initialDestination?: NotificationDestination | null;
  onDestinationHandled?(): void;
}) {
  const { width } = useWindowDimensions();
  const columns = width >= 640 ? 3 : 2;
  const coverWidth = (width - 32 - (columns - 1) * 12) / columns;
  const [catalog] = useState(() =>
    createCatalog({
      apiOrigin: runtime.apiOrigin,
      deviceId: runtime.deviceId,
      fetch: runtime.fetch,
    }),
  );
  const [reader] = useState(() =>
    createReader({
      apiOrigin: runtime.apiOrigin,
      deviceId: runtime.deviceId,
      fetch: runtime.fetch,
      session: runtime.session,
      captcha: {
        url: process.env.EXPO_PUBLIC_CAPTCHA_URL ?? "",
        randomState: Crypto.randomUUID,
        open: (url, redirect) => WebBrowser.openAuthSessionAsync(url, redirect),
      },
    }),
  );
  const [wallet] = useState(() =>
    runtime.session.snapshot().status === "signedIn"
      ? createWallet({ ...runtime, storage: AsyncStorage })
      : null,
  );
  const [showWallet, setShowWallet] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const [showStaff, setShowStaff] = useState(false);
  const [discovery] = useState(() => createDiscovery(runtime));
  const [tabs] = useState(createNativeNavigation);
  const [personal] = useState(() => createPersonal(runtime));
  const [social] = useState(() => createReadingSocial(runtime));
  const [activity] = useState(() => createAccountActivity(runtime));
  const activityState = useSyncExternalStore(
    activity.subscribe,
    activity.snapshot,
  );
  const [activityScreen, setActivityScreen] = useState<ActivityScreen | null>(
    null,
  );
  const [profiles] = useState(() => createProfiles(runtime));
  const profileState = useSyncExternalStore(
    profiles.subscribe,
    profiles.snapshot,
  );
  const personalState = useSyncExternalStore(
    personal.subscribe,
    personal.snapshot,
  );
  const [community] = useState(() => createCommunity(runtime));
  const forum = useSyncExternalStore(community.subscribe, community.snapshot);
  useEffect(() => {
    personal.activate();
    social.activate();
    profiles.activate();
    activity.activate();
    community.activate();
    void personal.load("history");
    return () => {
      personal.dispose();
      social.dispose();
      profiles.dispose();
      activity.dispose();
      community.dispose();
    };
  }, [personal, community, social, profiles, activity]);
  useEffect(() => {
    if (runtime.session.snapshot().status !== "signedIn") return;
    const refresh = () => {
      if (AppState.currentState === "active")
        void activity.unreadCount().catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [activity, runtime]);
  const { tab, selection } = useSyncExternalStore(
    tabs.subscribe,
    tabs.snapshot,
  );
  useEffect(() => {
    void discovery.home();
    return () => discovery.cancel();
  }, [discovery]);
  useEffect(() => {
    if (selection) void discovery.browse(selection);
  }, [selection, discovery]);
  function browse(selection: BrowseSelection) {
    navigation.current++;
    if (tabs.snapshot().selection === selection)
      void discovery.browse(selection);
    else tabs.browse(selection);
  }
  function selectTab(next: NativeTab) {
    navigation.current++;
    catalog.closeBook();
    reader.close();
    setError(null);
    tabs.select(next);
    if (next === "home") void discovery.home();
    if (next === "library") void personal.load("favorites");
    if (next === "community") void community.load(community.snapshot().filter);
    if (next === tab && selection) void discovery.browse(selection);
  }
  const [balance, setBalance] = useState<number | null>(null);
  const library = useSyncExternalStore(catalog.subscribe, catalog.snapshot);
  const reading = useSyncExternalStore(reader.subscribe, reader.snapshot);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useRef(0);
  const queuedProgress = useRef("");
  const progressErrorItem = useRef<HistoryBook | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  function persistProgress() {
    const current = reader.snapshot();
    const book = catalog.snapshot().book;
    if (
      current.status !== "ready" ||
      !current.chapter ||
      !book ||
      book.id !== current.mangaId
    )
      return;
    const page = (current.position?.pageIndex ?? 0) + 1;
    const key = `${book.id}/${current.chapter.id}/${page}`;
    if (key === queuedProgress.current) return;
    queuedProgress.current = key;
    const item: HistoryBook = {
      id: book.id,
      title: book.title ?? "",
      thumbnail: book.covers[0]?.url ?? "",
      authors: book.authors,
      categories: book.genres,
      description: book.description,
      lastReadAt: Date.now(),
      lastChapterId: current.chapter.id,
      lastPage: page,
    };
    progressErrorItem.current = item;
    void personal
      .recordProgress(item)
      .then((saved) => {
        if (saved && key === queuedProgress.current) {
          setProgressError(null);
          progressErrorItem.current = null;
        }
      })
      .catch(() => {
        if (key === queuedProgress.current) {
          queuedProgress.current = "";
          setProgressError("บันทึกตำแหน่งอ่านไม่สำเร็จ");
        }
      });
  }
  useEffect(() => {
    if (reading.status !== "ready") return;
    const timer = setTimeout(persistProgress, 750);
    return () => clearTimeout(timer);
  }, [
    reading.status,
    reading.mangaId,
    reading.chapter?.id,
    reading.position?.pageIndex,
  ]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") persistProgress();
    });
    return () => listener.remove();
  }, [reader, catalog, personal]);
  function continueReading(item: HistoryBook) {
    void run(async () => {
      const current = navigation.current;
      await resumeHistoryReading({
        item,
        catalog,
        reader,
        isCurrent: () => current === navigation.current,
      });
    });
  }
  const asset = (url: string) => imageUri(url, runtime.apiOrigin);
  function back() {
    navigation.current++;
    setError(null);
    if (showStudio) {
      setShowStudio(false);
      return;
    }
    if (showStaff) {
      setShowStaff(false);
      return;
    }
    if (showWallet) {
      setShowWallet(false);
      return;
    }
    const wasClosed = reading.status === "closed";
    persistProgress();
    reader.close();
    if (wasClosed) {
      if (library.book) catalog.backBook();
      else if (tab === "community" && community.back()) return;
      else tabs.back();
    }
  }
  useEffect(() => {
    if (!wallet) return;
    let mounted = true;
    const current = navigation.current;
    const unsubscribe = wallet.subscribe(() =>
      setBalance(wallet.snapshot().balance),
    );
    void recoverPaymentReading({
      wallet,
      reader,
      catalog,
      isCurrent: () => mounted && current === navigation.current,
    })
      .then((pending) => {
        if (mounted && current === navigation.current && pending)
          setShowWallet(true);
      })
      .catch((failure) => {
        if (mounted && current === navigation.current)
          setError(
            failure instanceof Error
              ? failure.message
              : "กลับไปยังตอนเดิมไม่สำเร็จ",
          );
      });
    void wallet.refresh().catch(() => {});
    return () => {
      mounted = false;
      unsubscribe();
      wallet.stopWatching();
    };
  }, [wallet]);
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (
        !showWallet &&
        !showStudio &&
        !showStaff &&
        reading.status === "closed" &&
        !library.book
      ) {
        navigation.current++;
        return (tab === "community" && community.back()) || tabs.back();
      }
      back();
      return true;
    });
    return () => handler.remove();
  }, [
    reading.status,
    library.book,
    showWallet,
    showStudio,
    showStaff,
    tab,
    forum.postId,
  ]);
  useEffect(
    () => () => {
      reader.close();
      catalog.closeBook();
    },
    [catalog, reader],
  );
  async function run(action: () => Promise<void>) {
    if (busy) return;
    navigation.current++;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      const message =
        failure instanceof Error ? failure.message : "ไม่สามารถโหลดข้อมูลได้";
      setError(
        /fetch failed|network request failed|ConnectException/i.test(message)
          ? "เชื่อมต่อ MangaDock ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง"
          : message,
      );
    } finally {
      setBusy(false);
    }
  }
  const button = (label: string, action: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={action}
      style={[styles.button, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
  function navigate(destination: NotificationDestination) {
    navigation.current++;
    persistProgress();
    reader.close();
    profiles.close();
    catalog.closeBook();
    setActivityScreen(null);
    setError(null);
    if (destination.kind === "post") {
      selectTab("community");
      void community.open(destination.id);
    } else if (destination.kind === "profile")
      void profiles.open(destination.id);
    else if (destination.kind === "book")
      void run(() => catalog.openBook(destination.id));
    else if (destination.kind === "forumManga") {
      selectTab("community");
      void community.load({ mangaId: destination.id, sort: "new" });
    } else if (destination.kind === "home") selectTab("home");
    else if (destination.kind === "account") onAccount();
    else if (destination.kind === "wallet" && wallet) setShowWallet(true);
    else if (destination.kind === "studio") {
      if (runtime.session.snapshot().status !== "signedIn") onAccount();
      else setShowStudio(true);
    } else if (destination.kind === "staff") setShowStaff(true);
    else return false;
    if (destination.kind !== "wallet") setShowWallet(false);
    if (destination.kind !== "studio") setShowStudio(false);
    if (destination.kind !== "staff") setShowStaff(false);
    return true;
  }
  const handledDestination = useRef<NotificationDestination | null>(null);
  useEffect(() => {
    if (
      !initialDestination ||
      handledDestination.current === initialDestination
    )
      return;
    handledDestination.current = initialDestination;
    if (!navigate(initialDestination)) setError("หน้านี้ยังไม่รองรับในแอป");
    onDestinationHandled?.();
  }, [initialDestination, onDestinationHandled]);
  const activityModal = activityScreen && (
    <NativeAccountActivity
      key={activityScreen}
      activity={activity}
      screen={activityScreen}
      onClose={() => setActivityScreen(null)}
      onBalanceChanged={() => {
        void wallet?.refresh().catch(() => {});
      }}
      onDestination={navigate}
    />
  );
  if (showStaff)
    return (
      <NativeStaffView
        runtime={runtime}
        onBack={() => setShowStaff(false)}
        onNavigate={navigate}
      />
    );
  if (showStudio)
    return (
      <NativeStudioView
        runtime={runtime}
        onBack={() => setShowStudio(false)}
        onNavigate={navigate}
        onRead={(version) => {
          setShowStudio(false);
          void run(async () => {
            const current = navigation.current;
            await catalog.openBook(version.titleId);
            if (current !== navigation.current) return;
            const chapter = catalog
              .snapshot()
              .chapters.find((item) => item.id === `ver:${version.versionId}`);
            if (!chapter) throw new Error("ยังไม่พบตอนที่เผยแพร่");
            await reader.open(version.titleId, chapter);
          });
        }}
      />
    );
  if (showWallet && wallet)
    return (
      <View style={styles.root}>
        <NativeWalletView
          wallet={wallet}
          onHistory={() => setActivityScreen("wallet")}
          context={
            reading.mangaId && reading.chapter
              ? {
                  mangaId: reading.mangaId,
                  chapter: reading.chapter,
                  position: reading.position,
                  derivative: reading.derivative ?? "hd",
                }
              : undefined
          }
          onBack={() => {
            navigation.current++;
            setShowWallet(false);
            void wallet.refresh().catch(() => {});
          }}
        />
        {activityModal}
      </View>
    );
  return (
    <View style={styles.root}>
      <NativeTopBar
        onBack={
          library.book || reading.status !== "closed" || tab !== "home"
            ? back
            : undefined
        }
        onAccount={() => {
          navigation.current++;
          persistProgress();
          reader.close();
          onAccount();
        }}
        accountLabel={accountLabel}
        onNotifications={
          wallet ? () => setActivityScreen("notifications") : undefined
        }
        unread={activityState.notifications.unread}
        onWallet={
          wallet
            ? () => {
                navigation.current++;
                setShowWallet(true);
              }
            : undefined
        }
        balance={balance}
      />
      {busy && (
        <ActivityIndicator
          accessibilityLabel="กำลังโหลด"
          color={design.primary}
          style={{ padding: 8 }}
        />
      )}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {progressError && (
        <View style={{ padding: 12, gap: 8 }}>
          <Text accessibilityRole="alert" style={styles.error}>
            {progressError}
          </Text>
          {button("ลองบันทึกอีกครั้ง", () => {
            const item = progressErrorItem.current;
            if (item)
              void personal
                .recordProgress(item)
                .then((saved) => {
                  if (saved) {
                    setProgressError(null);
                    progressErrorItem.current = null;
                  }
                })
                .catch(() => {});
          })}
        </View>
      )}
      {reading.status === "captchaRequired" ? (
        <View style={styles.card}>
          <Text style={styles.title}>ยืนยันก่อนเริ่มอ่าน</Text>
          <Text style={styles.caption}>
            ตรวจสอบใน browser แล้วกลับมาอ่านต่อ
          </Text>
          {button(
            "เปิดการตรวจสอบ",
            () => void run(() => reader.verifyCaptcha()),
            busy,
          )}
        </View>
      ) : reading.status === "unlockRequired" ? (
        <View style={styles.card}>
          <Text style={styles.title}>
            ปลดล็อกตอนนี้ · {reading.chapter?.priceCoins} เหรียญ
          </Text>
          <Text style={styles.caption}>
            สิทธิ์การอ่านใช้บัญชีและยอดเงินเดิมของคุณ
          </Text>
          {wallet ? (
            <>
              {button(
                "ซื้อและเปิดอ่าน",
                () =>
                  void run(async () => {
                    await reader.unlock();
                    await wallet.refresh();
                  }),
                busy,
              )}
              {button("เติมเงิน", () => {
                navigation.current++;
                setShowWallet(true);
              })}
            </>
          ) : (
            button("เข้าสู่ระบบเพื่อปลดล็อก", onAccount)
          )}
        </View>
      ) : reading.status === "ready" ? (
        <NativeReaderView
          key={reading.chapter?.id}
          runtime={runtime}
          reader={reader}
          social={social}
          onAccount={onAccount}
          chapters={library.chapters}
          onChapter={(chapter) => {
            if (chapter && reading.mangaId) {
              const mangaId = reading.mangaId;
              persistProgress();
              reader.close();
              void run(() => reader.open(mangaId, chapter));
            }
          }}
        />
      ) : library.book ? (
        <ScrollView
          key={library.book.id}
          nestedScrollEnabled
          contentContainerStyle={styles.content}
        >
          <View style={styles.hero}>
            {library.book.covers[0]?.url && (
              <Image
                accessible={false}
                source={{ uri: asset(library.book.covers[0].url) }}
                blurRadius={24}
                style={styles.heroBackdrop}
              />
            )}
            {library.book.covers[0]?.url && (
              <Image
                accessibilityLabel={`ปก ${library.book.title}`}
                source={{ uri: asset(library.book.covers[0].url) }}
                style={styles.detailCover}
              />
            )}
            <Text style={styles.detailTitle}>
              {library.book.title || "รายละเอียดเรื่อง"}
            </Text>
            <Text style={[styles.caption, styles.center]}>
              {library.book.authors.join(", ")}
            </Text>
            <View style={styles.genres}>
              {library.book.genres.map((genre) => (
                <Text key={genre} style={styles.genre}>
                  {genre}
                </Text>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={busy || !library.chapters.length}
              accessibilityState={{
                disabled: busy || !library.chapters.length,
              }}
              style={[
                styles.readButton,
                (!library.chapters.length || busy) && { opacity: 0.5 },
              ]}
              onPress={() =>
                void run(() =>
                  reader.open(library.book!.id, library.chapters[0]),
                )
              }
            >
              <NativeIcon name="book" color="#08090d" />
              <Text style={styles.readText}>
                {library.chapters.length
                  ? `อ่านตอนที่ ${library.chapters[0].chapterNumber ?? "พิเศษ"}`
                  : "ไม่มีตอนให้อ่าน"}
              </Text>
            </Pressable>
          </View>
          <View style={styles.detailBody}>
            <NativeCollectionActions
              key={library.book.id}
              personal={personal}
              book={{
                id: library.book.id,
                title: library.book.title ?? "",
                thumbnail: library.book.covers[0]?.url ?? "",
                authors: library.book.authors,
                categories: library.book.genres,
                description: library.book.description,
              }}
              onAccount={onAccount}
            />
            <Text style={styles.sectionTitle}>เรื่องย่อ</Text>
            <Text style={styles.description}>
              {library.book.description || "ยังไม่มีเรื่องย่อ"}
            </Text>
            <NativeReportButton
              key={`report:${library.book.id}`}
              social={social}
              runtime={runtime}
              target={{ contentType: "manga", contentId: library.book.id }}
              onAccount={onAccount}
            />
            <NativeChapterList
              chapters={library.chapters}
              busy={busy}
              onSelect={(chapter) =>
                void run(() => reader.open(library.book!.id, chapter))
              }
            />
          </View>
          <NativeReviewSection
            key={`reviews:${library.book.id}`}
            social={social}
            runtime={runtime}
            mangaId={library.book.id}
            title={library.book.title ?? ""}
            onAccount={onAccount}
          />
          <NativeRelatedView
            discovery={discovery}
            mangaId={library.book.id}
            apiOrigin={runtime.apiOrigin}
            onBook={(id) => void run(() => catalog.openBook(id))}
          />
        </ScrollView>
      ) : tab === "home" || tab === "new" || tab === "categories" ? (
        <NativeDiscoveryView
          discovery={discovery}
          screen={tab}
          apiOrigin={runtime.apiOrigin}
          selection={selection}
          onBook={(id) => void run(() => catalog.openBook(id))}
          onBrowse={browse}
          continueReading={
            personalState.history.length ? (
              <NativeBookRow
                title={`อ่านต่อ · ${personalState.history.length} เรื่อง`}
                books={personalState.history.slice(0, 20)}
                apiOrigin={runtime.apiOrigin}
                onBook={(id) => {
                  const item = personalState.history.find(
                    (book) => book.id === id,
                  );
                  if (item) continueReading(item);
                }}
                onMore={() => {
                  selectTab("library");
                  void personal.load("history");
                }}
              />
            ) : undefined
          }
        />
      ) : tab === "library" ? (
        <NativeLibraryView
          personal={personal}
          apiOrigin={runtime.apiOrigin}
          onBook={(id) => void run(() => catalog.openBook(id))}
          onAccount={onAccount}
          onContinue={continueReading}
        />
      ) : tab === "community" ? (
        <NativeCommunityView
          runtime={runtime}
          onAccount={onAccount}
          community={community}
          apiOrigin={runtime.apiOrigin}
          onManga={(id) => void run(() => catalog.openBook(id))}
          onProfile={(uid) => void profiles.open(uid)}
        />
      ) : (
        <View style={styles.root}>
          <View style={styles.search}>
            <View style={styles.searchField}>
              <NativeIcon name="search" color={design.muted} />
              <TextInput
                accessibilityLabel="ค้นหามังงะ"
                value={query}
                onChangeText={setQuery}
                placeholder="ค้นหาหนังสือ, มังงะ..."
                placeholderTextColor={design.muted}
                style={styles.input}
                returnKeyType="search"
                onSubmitEditing={() => {
                  setSearched(true);
                  void run(() => catalog.search(query.trim()));
                }}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                setSearched(true);
                void run(() => catalog.search(query.trim()));
              }}
              style={[styles.readButton, busy && { opacity: 0.5 }]}
            >
              <Text style={styles.readText}>ค้นหา</Text>
            </Pressable>
          </View>
          <FlatList
            key={columns}
            numColumns={columns}
            columnWrapperStyle={styles.gridRow}
            data={library.results}
            keyExtractor={(book) => book.id}
            contentContainerStyle={styles.gridContent}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {searched ? "ผลการค้นหา" : "ค้นหามังงะ"}
                </Text>
                {searched && !error && !busy && (
                  <Text style={styles.caption}>
                    {library.total.toLocaleString("th-TH")} เรื่อง
                  </Text>
                )}
              </View>
            }
            ListFooterComponent={
              library.results.length < library.total
                ? button(
                    "โหลดเรื่องเพิ่มเติม",
                    () => void run(() => catalog.loadMore()),
                    busy,
                  )
                : null
            }
            ListEmptyComponent={
              <Text style={styles.caption}>
                {error
                  ? "ค้นหาอีกครั้งเมื่อเชื่อมต่อได้"
                  : busy
                    ? "กำลังค้นหา..."
                    : searched
                      ? "ไม่พบเรื่องที่ค้นหา ลองใช้คำอื่น"
                      : "ค้นหาเรื่องที่ชอบ แล้วเลือกตอนเพื่อเริ่มอ่าน"}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void run(() => catalog.openBook(item.id))}
                style={[styles.book, { maxWidth: coverWidth }]}
              >
                {item.thumbnail ? (
                  <Image
                    accessibilityLabel={`ปก ${item.title}`}
                    source={{ uri: asset(item.thumbnail) }}
                    style={styles.cover}
                  />
                ) : (
                  <View style={[styles.cover, styles.emptyCover]}>
                    <NativeIcon name="book" color={design.muted} size={32} />
                  </View>
                )}
                <Text numberOfLines={2} style={styles.bookTitle}>
                  {item.title}
                </Text>
                {item.authors?.[0] && (
                  <Text numberOfLines={1} style={styles.bookAuthor}>
                    {item.authors[0]}
                  </Text>
                )}
                {item.categories?.[0] && (
                  <Text numberOfLines={1} style={styles.bookGenre}>
                    {item.categories[0]}
                  </Text>
                )}
              </Pressable>
            )}
          />
        </View>
      )}
      {!library.book && reading.status === "closed" && (
        <NativeBottomNavigation tab={tab} onSelect={selectTab} />
      )}
      {profileState.uid && (
        <NativeProfileView
          key={profileState.uid}
          profiles={profiles}
          runtime={runtime}
          onAccount={onAccount}
          onPost={(id) => {
            profiles.close();
            selectTab("community");
            void community.open(id);
          }}
          onBook={(id) => {
            profiles.close();
            void run(() => catalog.openBook(id));
          }}
        />
      )}
      {activityModal}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: design.background },
  content: { paddingBottom: 24 },
  card: {
    margin: 16,
    borderWidth: 1,
    borderColor: design.border,
    backgroundColor: design.surface,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: { color: design.foreground, fontSize: 22, fontWeight: "800" },
  sectionTitle: { color: design.foreground, fontSize: 18, fontWeight: "700" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 8,
  },
  caption: { color: design.muted, fontSize: 12, lineHeight: 20 },
  description: { color: "#d4d4d8", fontSize: 14, lineHeight: 24 },
  button: {
    backgroundColor: design.tint,
    borderColor: design.border,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: { color: design.foreground, fontWeight: "600" },
  search: { padding: 16, gap: 12 },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    borderColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: design.tint,
  },
  input: {
    flex: 1,
    color: design.foreground,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  gridContent: { padding: 16, paddingTop: 8 },
  gridRow: { gap: 12, marginBottom: 24 },
  book: { flex: 1, maxWidth: "50%", gap: 6 },
  cover: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: design.border,
    backgroundColor: design.tint,
  },
  emptyCover: { justifyContent: "center", alignItems: "center" },
  bookTitle: {
    color: design.foreground,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  bookAuthor: { color: design.muted, fontSize: 12 },
  bookGenre: { color: "#a5b4fc", fontSize: 12 },
  hero: {
    backgroundColor: "#141414",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
  heroBackdrop: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0.18,
  },
  detailCover: {
    width: 144,
    aspectRatio: 2 / 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: design.border,
  },
  detailTitle: {
    color: design.foreground,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  center: { textAlign: "center" },
  genres: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  genre: {
    color: "#d4d4d8",
    fontSize: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  readButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: design.foreground,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  readText: { color: design.background, fontSize: 14, fontWeight: "700" },
  detailBody: { padding: 20, gap: 16 },
  error: { color: design.error, padding: 16, lineHeight: 22 },
});
