import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
  useWindowDimensions,
} from "react-native";
import type { Book } from "./catalog.ts";
import type {
  BrowseSelection,
  createDiscovery,
  ReleaseTab,
} from "./discovery.ts";
import { imageUri } from "./assets.ts";
import { design } from "./design.ts";
import { NativeIcon } from "./NativeDesign.tsx";

export const genres = [
  ["action", "แอคชัน"],
  ["adventure", "ผจญภัย"],
  ["comedy", "ตลก"],
  ["romance", "โรแมนติก"],
  ["fantasy", "แฟนตาซี"],
  ["drama", "ดราม่า"],
  ["horror", "สยองขวัญ"],
  ["sci-fi", "ไซไฟ"],
  ["slice-of-life", "ชีวิตประจำวัน"],
  ["sports", "กีฬา"],
  ["mystery", "ลึกลับ"],
  ["psychological", "จิตวิทยา"],
  ["supernatural", "เหนือธรรมชาติ"],
  ["historical", "ประวัติศาสตร์"],
  ["isekai", "อิเซไค"],
  ["mecha", "หุ่นยนต์"],
  ["school-life", "ชีวิตนักเรียน"],
  ["thriller", "ระทึกขวัญ"],
] as const;
const tabs: Array<[ReleaseTab, string]> = [
  ["new", "มังงะมาใหม่"],
  ["latest", "อัปเดตล่าสุด"],
  ["popular", "มังงะยอดนิยม"],
  ["top-rated", "มังงะเรตติ้งสูง"],
];
export type DiscoveryScreen = "home" | "new" | "categories";
type Discovery = ReturnType<typeof createDiscovery>;
type CardProps = {
  book: Book;
  apiOrigin: string;
  onBook(id: string): void;
  width?: number;
};

export function NativeBookCard({
  book,
  apiOrigin,
  onBook,
  width = 120,
}: CardProps) {
  const [failed, setFailed] = useState(false);
  useEffect(
    () => setFailed(false),
    [book.id, book.thumbnailLocal, book.thumbnail],
  );
  let uri = "";
  try {
    uri = imageUri(book.thumbnailLocal || book.thumbnail, apiOrigin);
  } catch {}
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`ดูรายละเอียด ${book.title}`}
      onPress={() => onBook(book.id)}
      style={{ width, gap: 8 }}
    >
      {uri && !failed && book.thumbnailCached !== false ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          style={styles.cover}
        />
      ) : (
        <View style={[styles.cover, styles.emptyCover]}>
          <NativeIcon name="book" color={design.muted} size={28} />
        </View>
      )}
      <Text numberOfLines={2} style={styles.bookTitle}>
        {book.title}
      </Text>
      {book.authors?.[0] && (
        <Text numberOfLines={1} style={styles.caption}>
          {book.authors[0]}
        </Text>
      )}
      {book.categories?.[0] && (
        <Text numberOfLines={1} style={styles.genre}>
          {book.categories[0]}
        </Text>
      )}
    </Pressable>
  );
}

export function NativeBookRow({
  title,
  books,
  apiOrigin,
  onBook,
  onMore,
  ranked = false,
}: {
  title: string;
  books: Book[];
  apiOrigin: string;
  onBook(id: string): void;
  onMore?: () => void;
  ranked?: boolean;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.heading}>{title}</Text>
        {onMore && (
          <Pressable
            accessibilityRole="button"
            onPress={onMore}
            style={styles.more}
          >
            <Text style={styles.caption}>ดูทั้งหมด ›</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={books}
        keyExtractor={(book) => book.id}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
        renderItem={({ item, index }) =>
          ranked ? (
            <View style={styles.ranked}>
              <Text style={styles.rank}>{index + 1}</Text>
              <NativeBookCard
                book={item}
                apiOrigin={apiOrigin}
                onBook={onBook}
                width={96}
              />
            </View>
          ) : (
            <NativeBookCard book={item} apiOrigin={apiOrigin} onBook={onBook} />
          )
        }
      />
    </View>
  );
}

function Hero({
  books,
  apiOrigin,
  onBook,
}: {
  books: Book[];
  apiOrigin: string;
  onBook(id: string): void;
}) {
  const [index, setIndex] = useState(0);
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<Book>>(null);
  const active = useRef(AppState.currentState === "active");
  const pageWidth = width - 32;
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      active.current = state === "active";
    });
    if (books.length < 2) return () => listener.remove();
    const interval = setInterval(() => {
      if (!active.current) return;
      setIndex((previous) => {
        const next = (previous + 1) % books.length;
        list.current?.scrollToOffset({
          offset: next * pageWidth,
          animated: true,
        });
        return next;
      });
    }, 5000);
    return () => {
      clearInterval(interval);
      listener.remove();
    };
  }, [books.length, pageWidth]);
  const current = books[Math.min(index, books.length - 1)];
  return (
    <View style={styles.heroSection}>
      <FlatList
        ref={list}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={books}
        keyExtractor={(book) => book.id}
        onMomentumScrollEnd={(event) =>
          setIndex(
            Math.max(
              0,
              Math.min(
                books.length - 1,
                Math.round(event.nativeEvent.contentOffset.x / pageWidth),
              ),
            ),
          )
        }
        renderItem={({ item }) => {
          let uri = "";
          try {
            uri = imageUri(item.thumbnailLocal || item.thumbnail, apiOrigin);
          } catch {}
          return (
            <View style={{ width: pageWidth, alignItems: "center" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`ดูรายละเอียด ${item.title}`}
                onPress={() => onBook(item.id)}
                style={[styles.hero, { width: pageWidth * 0.88 }]}
              >
                {uri && item.thumbnailCached !== false && (
                  <Image
                    source={{ uri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                )}
                <View pointerEvents="none" style={styles.heroShade}>
                  {Array.from({ length: 20 }, (_, step) => (
                    <View
                      key={step}
                      style={{
                        flex: 1,
                        backgroundColor: `rgba(0,0,0,${step * 0.045})`,
                      }}
                    />
                  ))}
                </View>
                <Text numberOfLines={3} style={styles.heroTitle}>
                  {item.title}
                </Text>
              </Pressable>
            </View>
          );
        }}
      />
      <Text style={[styles.caption, { textAlign: "center", marginTop: 12 }]}>
        {current?.categories?.slice(0, 4).join(" • ") || "E-Book"}
      </Text>
      {books.length > 1 && (
        <View style={styles.dots}>
          {books.map((book, position) => (
            <Pressable
              key={book.id}
              accessibilityRole="button"
              accessibilityLabel={`สลับไปรายการที่ ${position + 1}`}
              onPress={() => {
                setIndex(position);
                list.current?.scrollToOffset({
                  offset: position * pageWidth,
                  animated: true,
                });
              }}
              style={styles.dotTouch}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      position === index ? design.foreground : design.border,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.activeChip]}
    >
      <Text style={[styles.caption, selected && { color: design.background }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function NativeDiscoveryView({
  discovery,
  screen,
  apiOrigin,
  onBook,
  onBrowse,
  selection: routeSelection,
  continueReading,
}: {
  discovery: Discovery;
  screen: DiscoveryScreen;
  apiOrigin: string;
  onBook(id: string): void;
  onBrowse(selection: BrowseSelection): void;
  selection: BrowseSelection | null;
  continueReading?: React.ReactNode;
}) {
  const snapshot = useSyncExternalStore(
    discovery.subscribe,
    discovery.snapshot,
  );
  const state =
    screen === "home" || snapshot.selection === routeSelection
      ? snapshot
      : {
          ...snapshot,
          selection: routeSelection,
          items: [],
          total: 0,
          error: null,
          loading: !!routeSelection,
        };
  const { width } = useWindowDimensions();
  const columns = width >= 640 ? 3 : 2;
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    if (
      state.selection?.kind === "new" &&
      (!state.selection.tag || state.selection.tag === "all") &&
      !state.loading &&
      !state.error
    )
      setCategories((previous) => [
        ...new Set([
          ...previous,
          ...state.items.flatMap((book) => book.categories ?? []),
        ]),
      ]);
  }, [state.items, state.loading, state.error, state.selection]);
  if (screen === "home") {
    const rows = state.landing?.rows.filter((row) => row.items.length) ?? [];
    const top = rows[0]?.items.slice(0, 10) ?? [];
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {state.homeLoading && (
          <ActivityIndicator
            accessibilityLabel="กำลังโหลดหน้าหลัก"
            color={design.primary}
            style={styles.loading}
          />
        )}
        {(state.homeError ||
          state.landing?.apiOffline ||
          state.landing?.fromStaleCache) && (
          <View style={styles.notice}>
            <Text
              accessibilityRole={state.homeError ? "alert" : undefined}
              style={styles.caption}
            >
              {state.homeError ||
                (state.landing?.apiOffline
                  ? "บริการต้นทางไม่พร้อม กำลังแสดงข้อมูลที่บันทึกไว้"
                  : `ข้อมูลที่บันทึกไว้ล่าสุด ${state.landing?.staleUpdatedAt || state.landing?.updatedAt}`)}
            </Text>
            {state.homeError && (
              <Chip
                label="ลองอีกครั้ง"
                selected={false}
                onPress={() => void discovery.home()}
              />
            )}
          </View>
        )}
        {top.length > 0 && (
          <Hero books={top} apiOrigin={apiOrigin} onBook={onBook} />
        )}
        {continueReading}
        {top.length > 0 && (
          <NativeBookRow
            title="Top 10 หนังสือที่น่าอ่านวันนี้"
            books={top}
            apiOrigin={apiOrigin}
            onBook={onBook}
            ranked
          />
        )}
        {rows.map((row) => (
          <NativeBookRow
            key={row.id}
            title={row.title}
            books={row.items}
            apiOrigin={apiOrigin}
            onBook={onBook}
            onMore={() =>
              onBrowse({
                kind: "new",
                tab: tabs.some(([tab]) => tab === row.id)
                  ? (row.id as ReleaseTab)
                  : "new",
              })
            }
          />
        ))}
        {!rows.length && !state.homeLoading && !state.homeError && (
          <Text style={styles.notice}>ยังไม่มีรายการหนังสือ</Text>
        )}
      </ScrollView>
    );
  }
  const selection = state.selection;
  const genreLabel =
    selection?.kind === "genre"
      ? (genres.find(([slug]) => slug === selection.slug)?.[1] ??
        selection.slug)
      : "หมวดหมู่";
  const page = selection?.page ?? 1;
  const pages = Math.max(1, Math.ceil(state.total / 28));
  const header = (
    <View style={{ gap: 16, marginBottom: 16 }}>
      <Text style={styles.heading}>
        {screen === "new" ? "หนังสือทั้งหมด" : genreLabel}
      </Text>
      {screen === "new" ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {tabs.map(([tab, label]) => (
              <Chip
                key={tab}
                label={label}
                selected={selection?.kind === "new" && selection.tab === tab}
                onPress={() => onBrowse({ kind: "new", tab })}
              />
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {["all", ...categories].map((tag) => (
              <Chip
                key={tag}
                label={tag === "all" ? "ทั้งหมด" : tag}
                selected={
                  selection?.kind === "new" && (selection.tag ?? "all") === tag
                }
                onPress={() =>
                  onBrowse({
                    kind: "new",
                    tab: selection?.kind === "new" ? selection.tab : "new",
                    tag,
                  })
                }
              />
            ))}
          </ScrollView>
        </>
      ) : (
        <View style={styles.genres}>
          {genres.map(([slug, label]) => (
            <Chip
              key={slug}
              label={label}
              selected={selection?.kind === "genre" && selection.slug === slug}
              onPress={() => onBrowse({ kind: "genre", slug })}
            />
          ))}
        </View>
      )}
      {state.loading && (
        <ActivityIndicator
          accessibilityLabel="กำลังโหลดรายการ"
          color={design.primary}
        />
      )}
      {state.error && (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="alert" style={styles.error}>
            {state.error}
          </Text>
          <Chip
            label="ลองอีกครั้ง"
            selected={false}
            onPress={() => selection && onBrowse(selection)}
          />
        </View>
      )}
      {selection && !state.loading && !state.error && (
        <Text style={styles.caption}>
          {state.total.toLocaleString("th-TH")} เรื่อง · หน้า {page}/{pages}
        </Text>
      )}
    </View>
  );
  return (
    <FlatList
      key={columns}
      data={
        screen === "categories" && selection?.kind !== "genre"
          ? []
          : state.items
      }
      style={styles.root}
      numColumns={columns}
      keyExtractor={(book) => book.id}
      contentContainerStyle={{ padding: 16, gap: 24 }}
      columnWrapperStyle={{ gap: 12 }}
      ListHeaderComponent={header}
      ListEmptyComponent={
        !state.loading &&
        !state.error &&
        selection &&
        (screen !== "categories" || selection.kind === "genre") ? (
          <Text style={styles.caption}>ไม่พบเรื่องในรายการนี้</Text>
        ) : null
      }
      renderItem={({ item }) => (
        <NativeBookCard
          book={item}
          apiOrigin={apiOrigin}
          onBook={onBook}
          width={(width - 32 - (columns - 1) * 12) / columns}
        />
      )}
      ListFooterComponent={
        selection && pages > 1 && !state.error ? (
          <View style={styles.pagination}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: page <= 1 || state.loading }}
              disabled={page <= 1 || state.loading}
              onPress={() => onBrowse({ ...selection, page: page - 1 })}
              style={styles.chip}
            >
              <Text style={styles.caption}>‹ ก่อนหน้า</Text>
            </Pressable>
            <Text style={styles.caption}>
              {page} / {pages}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: page >= pages || state.loading }}
              disabled={page >= pages || state.loading}
              onPress={() => onBrowse({ ...selection, page: page + 1 })}
              style={styles.chip}
            >
              <Text style={styles.caption}>ถัดไป ›</Text>
            </Pressable>
          </View>
        ) : null
      }
    />
  );
}
export function NativeRelatedView({
  discovery,
  mangaId,
  apiOrigin,
  onBook,
}: {
  discovery: Discovery;
  mangaId: string;
  apiOrigin: string;
  onBook(id: string): void;
}) {
  const { related } = useSyncExternalStore(
    discovery.subscribe,
    discovery.snapshot,
  );
  useEffect(() => {
    void discovery.related(mangaId);
  }, [discovery, mangaId]);
  if (related.mangaId !== mangaId) return null;
  if (related.loading)
    return (
      <ActivityIndicator
        accessibilityLabel="กำลังโหลดมังงะที่คล้ายกัน"
        color={design.primary}
      />
    );
  if (related.error)
    return (
      <View style={{ gap: 8 }}>
        <Text style={styles.caption}>{related.error}</Text>
        <Chip
          label="ลองอีกครั้ง"
          selected={false}
          onPress={() => void discovery.related(mangaId)}
        />
      </View>
    );
  return related.items.length ? (
    <NativeBookRow
      title="มังงะที่คล้ายกัน"
      books={related.items}
      apiOrigin={apiOrigin}
      onBook={onBook}
    />
  ) : null;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: design.background },
  cover: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: design.border,
    backgroundColor: design.tint,
  },
  emptyCover: { alignItems: "center", justifyContent: "center" },
  bookTitle: {
    color: design.foreground,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  caption: { color: design.muted, fontSize: 12, lineHeight: 20 },
  genre: { color: design.primary, fontSize: 11 },
  section: { marginTop: 24, gap: 12 },
  sectionHeader: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heading: {
    color: design.foreground,
    fontSize: 18,
    fontWeight: "800",
    flexShrink: 1,
  },
  more: { minHeight: 44, justifyContent: "center" },
  ranked: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  rank: {
    color: "#ffffff33",
    fontSize: 60,
    fontWeight: "900",
    marginBottom: 55,
  },
  heroSection: { paddingHorizontal: 16, paddingTop: 16 },
  hero: {
    aspectRatio: 2 / 3,
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: design.surface,
    justifyContent: "flex-end",
  },
  heroShade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "40%",
  },
  heroTitle: {
    color: design.foreground,
    padding: 20,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 29,
  },
  dots: { flexDirection: "row", justifyContent: "center" },
  dotTouch: {
    minWidth: 26,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  notice: { color: design.muted, padding: 16, gap: 8 },
  loading: { padding: 16 },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: design.tint,
  },
  activeChip: { backgroundColor: design.foreground },
  genres: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  error: { color: design.error, lineHeight: 22 },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    gap: 8,
  },
});
