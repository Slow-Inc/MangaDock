import {useCallback, useEffect, useRef, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import {
  getMobileShellUrl,
  MOBILE_BETA_VERSION_CODE,
  MOBILE_BETA_VERSION_NAME,
  MOBILE_DIAGNOSTICS_ENABLED,
} from './src/config';
import {
  appendMobileDiagnosticsEvent,
  createMobileDiagnosticsEvent,
  formatMobileDiagnosticsLog,
  type MobileDiagnosticsEvent,
} from './src/mobileDiagnostics';
import {createMobileShellHeaders} from './src/mobileHeaders';
import {getMobileHardwareId} from './src/mobileIdentity';
import {NativeShellNavigator} from './src/navigation/NativeShellNavigator';
import {createMobileShellInjectionScript} from './src/webViewBridge';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NativeShellNavigator WebViewComponent={AppContent} />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [hardwareId, setHardwareId] = useState<string | null>(null);
  const [diagnosticsEvents, setDiagnosticsEvents] = useState<
    MobileDiagnosticsEvent[]
  >([]);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const recordDiagnostics = useCallback(
    (input: {type: string; url?: string; statusCode?: number; message?: string}) => {
      if (!MOBILE_DIAGNOSTICS_ENABLED) {
        return;
      }

      const event = createMobileDiagnosticsEvent({
        ...input,
        hardwareId: hardwareId ?? undefined,
      });

      console.log(formatMobileDiagnosticsLog(event));
      setDiagnosticsEvents(events =>
        appendMobileDiagnosticsEvent(events, event),
      );
    },
    [hardwareId],
  );
  const handleWebViewMessage = useCallback(
    ({nativeEvent}: {nativeEvent: {data?: string}}) => {
      if (!nativeEvent.data) {
        return;
      }

      try {
        const message = JSON.parse(nativeEvent.data);

        if (message.source !== 'mangadock-web') {
          return;
        }

        const eventTypeByBridgeType: Record<string, string> = {
          console_error: 'web_console_error',
          js_error: 'web_js_error',
          unhandled_rejection: 'web_unhandled_rejection',
        };
        const type = eventTypeByBridgeType[message.type];

        if (!type) {
          return;
        }

        recordDiagnostics({
          type,
          message: message.message,
        });
      } catch {}
    },
    [recordDiagnostics],
  );

  useEffect(() => {
    let isMounted = true;

    getMobileHardwareId().then(nextHardwareId => {
      if (isMounted) {
        setHardwareId(nextHardwareId);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!hardwareId) {
    return <View testID="mobile-shell-loading" style={styles.container} />;
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: safeAreaInsets.top,
          paddingBottom: safeAreaInsets.bottom,
        },
      ]}
    >
      <WebView
        ref={webViewRef}
        source={{
          uri: getMobileShellUrl(),
          headers: createMobileShellHeaders(hardwareId),
        }}
        injectedJavaScriptBeforeContentLoaded={createMobileShellInjectionScript(
          hardwareId,
        )}
        onLoadStart={({nativeEvent}) =>
          recordDiagnostics({
            type: 'webview_load_start',
            url: nativeEvent.url,
          })
        }
        onLoadEnd={({nativeEvent}) =>
          recordDiagnostics({
            type: 'webview_load_end',
            url: nativeEvent.url,
          })
        }
        onError={({nativeEvent}) =>
          recordDiagnostics({
            type: 'webview_error',
            url: nativeEvent.url,
            message: nativeEvent.description,
          })
        }
        onHttpError={({nativeEvent}) =>
          recordDiagnostics({
            type: 'webview_http_error',
            url: nativeEvent.url,
            statusCode: nativeEvent.statusCode,
          })
        }
        onMessage={handleWebViewMessage}
      />
      {MOBILE_DIAGNOSTICS_ENABLED ? (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsDiagnosticsOpen(isOpen => !isOpen)}
            style={styles.diagnosticsButton}
            testID="mobile-diagnostics-button"
          >
            <Text style={styles.diagnosticsButtonText}>[diag]</Text>
          </Pressable>
          {isDiagnosticsOpen ? (
            <View style={styles.diagnosticsPanel}>
              <View style={styles.diagnosticsPanelHeader}>
                <Text style={styles.diagnosticsTitle}>
                  {MOBILE_BETA_VERSION_NAME} ({MOBILE_BETA_VERSION_CODE})
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    recordDiagnostics({type: 'webview_reload_requested'});
                    webViewRef.current?.reload();
                  }}
                  style={styles.reloadButton}
                  testID="mobile-diagnostics-reload-button"
                >
                  <Text style={styles.reloadButtonText}>Reload WebView</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.diagnosticsEvents}>
                {diagnosticsEvents.map((event, index) => (
                  <Text
                    key={`${event.at}-${index}`}
                    style={styles.diagnosticsEventText}
                  >
                    {event.type}
                    {event.statusCode ? ` ${event.statusCode}` : ''}
                    {event.url ? ` ${event.url}` : ''}
                    {event.message ? ` ${event.message}` : ''}
                  </Text>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  diagnosticsButton: {
    position: 'absolute',
    right: 12,
    bottom: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 6,
  },
  diagnosticsButtonText: {
    color: '#ffffff',
    fontSize: 12,
  },
  diagnosticsPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 56,
    maxHeight: 240,
    padding: 10,
    backgroundColor: 'rgba(16, 16, 16, 0.92)',
    borderRadius: 6,
  },
  diagnosticsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  diagnosticsTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  reloadButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#ffffff',
    borderRadius: 4,
  },
  reloadButtonText: {
    color: '#111111',
    fontSize: 12,
  },
  diagnosticsEvents: {
    maxHeight: 180,
  },
  diagnosticsEventText: {
    color: '#d8d8d8',
    fontSize: 11,
    marginBottom: 4,
  },
});

export default App;
