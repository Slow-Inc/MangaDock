import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Pressable, Text, View } from "react-native";
import { createTranslationFeedback } from "./translation-feedback.ts";
import type { CommentContext } from "./reading-social.ts";
import type { MobileRuntime } from "./runtime.ts";
import { design } from "./design.ts";
export function NativeTranslationFeedback({
  runtime,
  context,
  onAccount,
}: {
  runtime: MobileRuntime;
  context: CommentContext;
  onAccount(): void;
}) {
  const [feedback] = useState(() => createTranslationFeedback(runtime));
  const state = useSyncExternalStore(feedback.subscribe, feedback.snapshot),
    session = useSyncExternalStore(
      runtime.session.subscribe,
      runtime.session.snapshot,
    );
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    feedback.activate();
    void feedback.select(context);
    return () => {
      active.current = false;
      feedback.dispose();
    };
  }, [feedback, context.mangaId, context.chapterId, context.pageNumber]);
  async function vote(value: 1 | -1) {
    if (session.status !== "signedIn") {
      onAccount();
      return;
    }
    setError(null);
    try {
      await feedback.vote(value);
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error ? failure.message : "ส่งโหวตไม่สำเร็จ",
        );
    }
  }
  return (
    <View style={{ gap: 6, padding: 8, backgroundColor: design.sheet }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <Text style={{ color: design.muted }}>
          คุณภาพแปล · หน้า {context.pageNumber}
        </Text>
        {([1, -1] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: state.vote === value }}
            disabled={state.busy || state.loading}
            onPress={() => void vote(value)}
            style={{
              padding: 12,
              borderRadius: 20,
              backgroundColor:
                state.vote === value ? design.tint : "transparent",
            }}
          >
            <Text
              style={{
                color:
                  state.vote === value
                    ? value === 1
                      ? design.success
                      : design.error
                    : design.muted,
              }}
            >
              {value === 1 ? "↑ แปลได้ดี" : "↓ แปลไม่ดี"}
            </Text>
          </Pressable>
        ))}
      </View>
      {(error || state.error) && (
        <Text
          accessibilityRole="alert"
          style={{ color: design.error, textAlign: "center" }}
        >
          {error || state.error}
        </Text>
      )}
      {state.error && (
        <Pressable onPress={() => void feedback.select(context)}>
          <Text style={{ color: design.primary, textAlign: "center" }}>
            ลองโหลดโหวตใหม่
          </Text>
        </Pressable>
      )}
    </View>
  );
}
