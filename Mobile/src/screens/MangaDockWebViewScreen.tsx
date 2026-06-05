import {useCallback, useEffect, useRef, useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import {
  getMobileShellUrl,
  MOBILE_DIAGNOSTICS_ENABLED,
} from '../config';
import {
  appendMobileDiagnosticsEvent,
  createMobileDiagnosticsEvent,
  formatMobileDiagnosticsLog,
  type MobileDiagnosticsEvent,
} from '../mobileDiagnostics';
import {createMobileShellHeaders} from '../mobileHeaders';
import {getMobileHardwareId} from '../mobileIdentity';
import type {NativeShellStackParamList} from '../navigation/NativeShellNavigator';
import {createMobileShellInjectionScript} from '../webViewBridge';

export function MangaDockWebViewScreen(
  props: Partial<
    NativeStackScreenProps<NativeShellStackParamList, 'WebView'>
  > = {},
) {
  const safeAreaInsets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [hardwareId, setHardwareId] = useState<string | null>(null);
  const [, setDiagnosticsEvents] = useState<MobileDiagnosticsEvent[]>([]);

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

  const initialPath = props.route?.params?.initialPath;
  const mobileShellUrl = initialPath
    ? `${getMobileShellUrl().replace(/\/$/, '')}/${initialPath.replace(
        /^\//,
        '',
      )}`
    : getMobileShellUrl();

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
          uri: mobileShellUrl,
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
            onPress={() => props.navigation?.navigate('Diagnostics')}
            style={styles.diagnosticsButton}
            testID="mobile-diagnostics-button"
          >
            <Text style={styles.diagnosticsButtonText}>[diag]</Text>
          </Pressable>
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
});
