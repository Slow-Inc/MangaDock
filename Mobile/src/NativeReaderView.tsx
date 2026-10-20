import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { NativeTranslationFeedback } from "./NativeTranslationFeedback.tsx";
import {
  AppState,
  BackHandler,
  FlatList,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import type { createReader } from "./reader.ts";
import type { Chapter } from "./catalog.ts";
import {
  createTranslation,
  translationProgress,
  type Patch,
} from "./translation.ts";
import { createViewer } from "./viewer.ts";
import { createApi } from "./api.ts";
import { imageUri } from "./assets.ts";
import type { MobileRuntime } from "./runtime.ts";
import { design } from "./design.ts";
import type { createReadingSocial } from "./reading-social.ts";
import {
  NativeReaderComments,
  NativeReportButton,
} from "./NativeReadingSocial.tsx";

type Viewer = ReturnType<typeof createViewer>;
// RN 0.85 Image.android.js exposes request IDs; its .d.ts omits the callback overload.
const prefetchAndroid = Image.prefetch as (
  uri: string,
  callback: (requestId: number) => void,
) => Promise<boolean>;
function Page({
  uri,
  width,
  patches,
  runtime,
  viewer,
  ratio,
  onRatio,
}: {
  uri: string;
  width: number;
  patches: Patch[];
  runtime: MobileRuntime;
  viewer: Viewer;
  ratio: number;
  onRatio(ratio: number): void;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const height = width * ratio;
  return (
    <Pressable
      accessibilityLabel="แตะสองครั้งเพื่อซูมภาพ"
      onPress={() => viewer.tap(Date.now())}
      style={{ width, height }}
    >
      <Image
        key={attempt}
        accessibilityLabel="หน้ามังงะ"
        source={{ uri: imageUri(uri, runtime.apiOrigin) }}
        style={{ width, height }}
        resizeMode="contain"
        onLoad={({ nativeEvent }) => {
          if (nativeEvent.source.width > 0 && nativeEvent.source.height > 0)
            onRatio(nativeEvent.source.height / nativeEvent.source.width);
          setFailed(false);
        }}
        onError={() => setFailed(true)}
      />
      {patches.map((patch, index) => (
        <View
          key={`${index}:${patch.url}`}
          pointerEvents="none"
          style={{
            position: "absolute",
            ...viewer.patchRect(patch, width, height),
          }}
        >
          <Image
            accessibilityLabel="ภาพแปล"
            source={{ uri: imageUri(patch.url, runtime.apiOrigin) }}
            resizeMode="stretch"
            style={{ width: "100%", height: "100%" }}
          />
        </View>
      ))}
      {failed && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
          style={{
            position: "absolute",
            top: 20,
            left: 10,
            padding: 16,
            backgroundColor: "#333",
          }}
        >
          <Text style={{ color: "#fff" }}>โหลดภาพอีกครั้ง</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

export function NativeReaderView({
  runtime,
  reader,
  chapters,
  onChapter,
  social,
  onAccount,
}: {
  runtime: MobileRuntime;
  reader: ReturnType<typeof createReader>;
  chapters: Chapter[];
  onChapter(chapter: Chapter): void;
  social: ReturnType<typeof createReadingSocial>;
  onAccount(): void;
}) {
  const reading = useSyncExternalStore(reader.subscribe, reader.snapshot);
  const [showComments, setShowComments] = useState(false);
  const [viewer] = useState(() =>
    createViewer(reading.pages.length, reading.position),
  );
  const position = useSyncExternalStore(viewer.subscribe, viewer.snapshot);
  const [translation] = useState(() =>
    createTranslation({
      reader,
      apiOrigin: runtime.apiOrigin,
      deviceId: runtime.deviceId,
      fetch: runtime.fetch,
      autoConnect: false,
    }),
  );
  const translated = useSyncExternalStore(
    translation.subscribe,
    translation.snapshot,
  );
  const [target, setTarget] = useState(
    reading.chapter?.translatedLanguage === "th" ? "en" : "th",
  );
  const [model, setModel] = useState<string | undefined>();
  const [models, setModels] = useState<string[]>([]);
  const [modelEnabled, setModelEnabled] = useState(false);
  const [original, setOriginal] = useState(false);
  const [picker, setPicker] = useState(false);
  const [pageText, setPageText] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<string>>(null);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  // The list and the images share geometry, including rows not mounted yet.
  const layouts = useMemo(() => {
    let offset = 0;
    return reading.pages.map((uri, index) => {
      const length = width * position.zoom * (ratios[uri] ?? 1.4);
      const layout = { index, offset, length };
      offset += length;
      return layout;
    });
  }, [reading.pages, ratios, width, position.zoom]);
  const viewport = useRef({ offset: 0, height: 0 });
  function observe() {
    viewer.observeViewport(
      layouts.map(({ index, offset, length }) => ({
        index,
        top: offset,
        height: length,
      })),
      viewport.current.offset,
      viewport.current.height,
    );
  }
  function restoreScroll() {
    const index = viewer.scrollRequest();
    if (
      index == null ||
      viewer.snapshot().mode !== "strip" ||
      !reading.pages.length
    )
      return;
    list.current?.scrollToOffset({
      offset: layouts[index].offset,
      animated: false,
    });
  }
  const panStart = useRef({ distance: 1, zoom: 1 });
  const pinching = useRef(false);
  const pinch = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) =>
          event.nativeEvent.touches.length === 2,
        onMoveShouldSetPanResponder: (event, gesture) =>
          event.nativeEvent.touches.length === 2 ||
          (event.nativeEvent.touches.length === 1 &&
            viewer.snapshot().mode !== "strip" &&
            viewer.snapshot().zoom === 1 &&
            Math.abs(gesture.dx) >= 20 &&
            Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5),
        onPanResponderGrant: (event) => {
          const [a, b] = event.nativeEvent.touches;
          pinching.current = !!b;
          if (a && b)
            panStart.current = {
              distance: Math.max(
                1,
                Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY),
              ),
              zoom: viewer.snapshot().zoom,
            };
        },
        onPanResponderMove: (event) => {
          const [a, b] = event.nativeEvent.touches;
          if (a && b) {
            if (!pinching.current)
              panStart.current = {
                distance: Math.max(
                  1,
                  Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY),
                ),
                zoom: viewer.snapshot().zoom,
              };
            pinching.current = true;
            viewer.setZoom(
              (panStart.current.zoom *
                Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)) /
                panStart.current.distance,
            );
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          if (!pinching.current) viewer.swipe(gesture.dx, gesture.dy);
          pinching.current = false;
        },
        onPanResponderTerminate: () => {
          pinching.current = false;
        },
      }),
    [viewer],
  );
  useEffect(() => {
    translation.activate();
    translation.setForeground(AppState.currentState === "active");
    const listener = AppState.addEventListener("change", (next) =>
      translation.setForeground(next === "active"),
    );
    return () => {
      listener.remove();
      translation.deactivate();
    };
  }, [translation]);
  useEffect(() => {
    let mounted = true;
    void createApi(runtime)
      .json<{ models?: string[]; imageTranslator?: string | null }>(
        "books/models",
      )
      .then((info) => {
        if (!mounted) return;
        setModels(
          (info.models ?? []).filter((entry) => typeof entry === "string"),
        );
        setModelEnabled(
          info.imageTranslator == null ||
            info.imageTranslator.startsWith("gemini"),
        );
      })
      .catch(() => {
        if (mounted)
          setError("ยังโหลดรายชื่อโมเดลไม่ได้ ใช้ค่าเริ่มต้นของบริการได้");
      });
    return () => {
      mounted = false;
    };
  }, [runtime]);
  const effectiveModel = modelEnabled ? model : undefined;
  useEffect(() => {
    translation.configure(target, effectiveModel);
  }, [translation, target, effectiveModel]);
  useEffect(() => {
    setPageText(String(position.pageIndex + 1));
  }, [position.pageIndex]);
  useEffect(() => {
    reader.setPosition(position);
  }, [reader, position]);
  useEffect(() => {
    const requestIds: number[] = [];
    let mounted = true;
    for (const source of reading.pages.slice(
      position.pageIndex + 1,
      position.pageIndex + 3,
    )) {
      void prefetchAndroid(imageUri(source, runtime.apiOrigin), (id) => {
        if (mounted) requestIds.push(id);
        else Image.abortPrefetch?.(id);
      }).catch(() => {});
    }
    return () => {
      mounted = false;
      requestIds.forEach((id) => Image.abortPrefetch?.(id));
    };
  }, [reading.pages, position.pageIndex, runtime.apiOrigin]);
  useEffect(() => {
    const frame = requestAnimationFrame(restoreScroll);
    return () => cancelAnimationFrame(frame);
  }, [position.mode, layouts]);
  useEffect(() => {
    if (!picker) return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      setPicker(false);
      return true;
    });
    return () => listener.remove();
  }, [picker]);
  async function run(action: () => void | Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "ทำรายการไม่สำเร็จ",
      );
    }
  }
  const [showSettings, setShowSettings] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const button = (
    label: string,
    action: () => void,
    selected = false,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      onPress={action}
      disabled={disabled}
      style={{
        padding: 10,
        minHeight: 44,
        backgroundColor: selected ? design.foreground : design.tint,
        borderColor: design.border,
        borderWidth: 1,
        borderRadius: 12,
        margin: 3,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          color: selected ? design.background : design.foreground,
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  function goTo(index: number) {
    viewer.goTo(index);
    restoreScroll();
  }
  const page = (index: number, pageWidth: number) => (
    <Page
      key={`${index}:${reading.pages[index]}`}
      uri={reading.pages[index]}
      width={pageWidth}
      patches={original ? [] : (translated.patches[index] ?? [])}
      runtime={runtime}
      viewer={viewer}
      ratio={ratios[reading.pages[index]] ?? 1.4}
      onRatio={(ratio) => {
        const uri = reading.pages[index];
        setRatios((current) =>
          current[uri] === ratio ? current : { ...current, [uri]: ratio },
        );
      }}
    />
  );
  const sameLanguage = chapters.filter(
    (chapter) =>
      chapter.translatedLanguage === reading.chapter?.translatedLanguage,
  );
  const currentChapter = sameLanguage.findIndex(
    (chapter) => chapter.id === reading.chapter?.id,
  );
  const progress = translationProgress(translated);
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 8,
          borderBottomWidth: 1,
          borderBottomColor: design.border,
        }}
      >
        <Text style={{ color: design.foreground, fontSize: 12, flex: 1 }}>
          ตอน {reading.chapter?.chapterNumber} · {position.pageIndex + 1}/
          {reading.pages.length}
        </Text>
        {button(
          "ตั้งค่าการอ่าน",
          () => setShowSettings(!showSettings),
          showSettings,
        )}
        {button(
          "แปลภาพ",
          () => setShowTranslation(!showTranslation),
          showTranslation,
        )}
        {button("ความคิดเห็น", () => setShowComments(true), showComments)}
      </View>
      {showComments && reading.mangaId && reading.chapter && (
        <NativeReaderComments
          key={`${reading.chapter.id}:${position.pageIndex}`}
          social={social}
          runtime={runtime}
          context={{
            mangaId: reading.mangaId,
            chapterId: reading.chapter.id,
            pageNumber: position.pageIndex + 1,
          }}
          onAccount={onAccount}
          onClose={() => setShowComments(false)}
        />
      )}
      {showSettings && reading.mangaId && (
        <NativeReportButton
          social={social}
          runtime={runtime}
          target={{ contentType: "manga", contentId: reading.mangaId }}
          onAccount={onAccount}
        />
      )}
      {showSettings && (
        <ScrollView horizontal style={{ flexGrow: 0 }}>
          {button(
            "เลื่อนยาว",
            () => viewer.setMode("strip"),
            position.mode === "strip",
          )}
          {button(
            "หน้าเดียว",
            () => viewer.setMode("single"),
            position.mode === "single",
          )}
          {button(
            "สองหน้า",
            () => viewer.setMode("double"),
            position.mode === "double",
          )}
          {button(
            position.direction === "ltr" ? "ซ้าย → ขวา" : "ขวา → ซ้าย",
            () =>
              viewer.setDirection(position.direction === "ltr" ? "rtl" : "ltr"),
          )}
          {button(
            "HD",
            () => void run(() => reader.setDerivative("hd")),
            reading.derivative === "hd",
          )}
          {button(
            "ประหยัดข้อมูล",
            () => void run(() => reader.setDerivative("saver")),
            reading.derivative === "saver",
          )}
          {button("−", () => viewer.setZoom(position.zoom - 0.25))}
          {button(`${Math.round(position.zoom * 100)}%`, () =>
            viewer.setZoom(1),
          )}
          {button("+", () => viewer.setZoom(position.zoom + 0.25))}
        </ScrollView>
      )}
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}
      >
        {button(
          "ตอนก่อน",
          () => onChapter(sameLanguage[currentChapter - 1]),
          false,
          currentChapter < 1,
        )}
        {button("เลือกตอน", () => setPicker(!picker))}
        {button(
          "ตอนถัดไป",
          () => onChapter(sameLanguage[currentChapter + 1]),
          false,
          currentChapter < 0 || currentChapter >= sameLanguage.length - 1,
        )}
        {button(
          "หน้าก่อน",
          () => {
            viewer.previous();
            goTo(viewer.snapshot().pageIndex);
          },
          false,
          position.pageIndex === 0,
        )}
        <TextInput
          accessibilityLabel="เลขหน้าที่อ่าน"
          value={pageText}
          onChangeText={setPageText}
          keyboardType="number-pad"
          style={{ color: "#fff", minWidth: 48, padding: 8 }}
          onSubmitEditing={() => goTo(Number(pageText) - 1)}
        />
        {button("ไปหน้า", () => goTo(Number(pageText) - 1))}
        {button(
          "หน้าถัดไป",
          () => {
            viewer.next();
            goTo(viewer.snapshot().pageIndex);
          },
          false,
          position.pageIndex >= reading.pages.length - 1,
        )}
      </View>
      {picker && (
        <ScrollView style={{ maxHeight: 180 }}>
          {chapters.map((chapter) => (
            <View key={chapter.id}>
              {button(
                `${chapter.chapterNumber} · ${chapter.title} · ${chapter.translatedLanguage} · ${chapter.source === "studio" ? `Studio · ${chapter.translatorName || "นักแปล"}` : "MangaDex"}`,
                () => {
                  setPicker(false);
                  onChapter(chapter);
                },
                chapter.id === reading.chapter?.id,
              )}
            </View>
          ))}
        </ScrollView>
      )}
      {showTranslation && (
        <ScrollView horizontal style={{ flexGrow: 0 }}>
          {["th", "en", "zh", "ja", "ko"]
            .filter((lang) => lang !== reading.chapter?.translatedLanguage)
            .map((lang) => (
              <View key={lang}>
                {button(
                  lang.toUpperCase(),
                  () => setTarget(lang),
                  target === lang,
                )}
              </View>
            ))}
          {button("โมเดลบริการ", () => setModel(undefined), !model)}
          {modelEnabled &&
            models.map((entry) => (
              <View key={entry}>
                {button(entry, () => setModel(entry), model === entry)}
              </View>
            ))}
        </ScrollView>
      )}
      {showTranslation && (
        <ScrollView horizontal style={{ flexGrow: 0 }}>
          {button(
            "แปลหน้านี้",
            () =>
              void run(() =>
                translation.translatePage(
                  position.pageIndex,
                  target,
                  effectiveModel,
                ),
              ),
            false,
            translated.status === "running",
          )}
          {button(
            "แปลทั้งตอน",
            () =>
              void run(() =>
                translation.translateChapter(target, effectiveModel),
              ),
            false,
            translated.status === "running",
          )}
          {button(
            original ? "ดูภาพแปล" : "ดูต้นฉบับ",
            () => setOriginal(!original),
            original,
          )}
          {translated.status === "running" &&
            button("หยุดแปล", translation.cancel)}
        </ScrollView>
      )}
      {(error || translated.error) && (
        <Text
          accessibilityRole="alert"
          style={{ color: "#fda4af", padding: 8 }}
        >
          {error || translated.error}
        </Text>
      )}
      {["running", "failed", "completed"].includes(translated.status) && (
        <Text style={{ color: "#a78bfa", padding: 8 }}>
          แปลแล้ว {progress.completed}/{progress.total} · ไม่สำเร็จ{" "}
          {progress.failed} · รอผล {progress.pending} หน้า{" "}
          {translated.stage
            ? `· หน้า ${translated.stage.pageIndex + 1} ${translated.stage.stage}`
            : ""}
        </Text>
      )}
      {translated.status === "interrupted" && (
        <Text style={{ color: "#aaa", padding: 8 }}>
          หยุดรับผลแล้ว กรุณากดแปลใหม่เมื่อพร้อม
          งานฝั่งบริการอาจหยุดเมื่อจบหน้าปัจจุบัน
        </Text>
      )}
      {!original &&
        reading.mangaId &&
        reading.chapter &&
        translated.patches[position.pageIndex] !== undefined && (
          <NativeTranslationFeedback
            key={`${reading.mangaId}:${reading.chapter.id}:${position.pageIndex}`}
            runtime={runtime}
            context={{
              mangaId: reading.mangaId,
              chapterId: reading.chapter.id,
              pageNumber: position.pageIndex + 1,
            }}
            onAccount={onAccount}
          />
        )}
      <View style={{ flex: 1 }} {...pinch.panHandlers}>
        <FlatList
          ref={list}
          style={{ display: position.mode === "strip" ? "flex" : "none" }}
          data={reading.pages}
          extraData={layouts}
          getItemLayout={(_data, index) => layouts[index]}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          keyExtractor={(uri, index) => `${index}:${uri}`}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={5}
          scrollEventThrottle={32}
          onLayout={(event) => {
            viewport.current.height = event.nativeEvent.layout.height;
            restoreScroll();
          }}
          onContentSizeChange={restoreScroll}
          onScroll={(event) => {
            viewport.current = {
              offset: event.nativeEvent.contentOffset.y,
              height: event.nativeEvent.layoutMeasurement.height,
            };
            observe();
          }}
          onScrollBeginDrag={() => viewer.cancelScrollRequest()}
          renderItem={({ index }) => (
            <ScrollView
              horizontal
              scrollEnabled={position.zoom > 1}
              style={{ height: layouts[index].length, flexGrow: 0 }}
              contentContainerStyle={{ minWidth: width }}
            >
              {page(index, width * position.zoom)}
            </ScrollView>
          )}
          ListEmptyComponent={
            <Text style={{ color: "#aaa" }}>ไม่มีหน้าที่อ่านได้</Text>
          }
        />
        {position.mode !== "strip" && (
          <ScrollView>
            <ScrollView
              horizontal
              scrollEnabled={position.zoom > 1}
              contentContainerStyle={{
                minWidth: width,
                flexDirection: "row",
                alignItems: "flex-start",
              }}
            >
              {viewer
                .visiblePages()
                .map((index) =>
                  page(
                    index,
                    (width * position.zoom) /
                      (position.mode === "double" ? 2 : 1),
                  ),
                )}
            </ScrollView>
          </ScrollView>
        )}
      </View>
    </View>
  );
}
