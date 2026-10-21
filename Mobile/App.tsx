import "react-native-url-polyfill/auto";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { createRuntime, type MobileRuntime } from "./src/runtime.ts";
import { NativeSessionView } from "./src/NativeSessionView.tsx";
import { design } from "./src/design.ts";
import { NativeBrand } from "./src/NativeDesign.tsx";

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [runtime, setRuntime] = useState<MobileRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    let current: MobileRuntime | undefined;
    setError(null);
    setRuntime(null);
    void (async () => {
      try {
        current = await createRuntime();
        if (!mounted) {
          current.dispose();
          return;
        }
        await current.initialize();
        if (mounted) setRuntime(current);
      } catch (failure) {
        current?.dispose();
        if (mounted)
          setError(
            failure instanceof Error
              ? failure.message
              : "ไม่สามารถเชื่อมต่อ MangaDock ได้",
          );
      }
    })();
    return () => {
      mounted = false;
      current?.dispose();
    };
  }, [attempt]);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        {runtime ? (
          <NativeSessionView runtime={runtime} />
        ) : (
          <View style={styles.center}>
            <NativeBrand />
            {error ? (
              <>
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={styles.retry}
                  onPress={() => setAttempt((value) => value + 1)}
                >
                  <Text style={styles.retryText}>ลองอีกครั้ง</Text>
                </Pressable>
              </>
            ) : (
              <ActivityIndicator
                accessibilityLabel="กำลังเปิด MangaDock"
                color={design.primary}
              />
            )}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: design.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 24,
  },
  error: { color: design.error, textAlign: "center", lineHeight: 22 },
  retry: { backgroundColor: design.primary, borderRadius: 12, padding: 16 },
  retryText: { color: design.foreground, fontWeight: "700" },
});
