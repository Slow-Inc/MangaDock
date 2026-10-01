import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeShellStackParamList } from '../navigation/NativeShellNavigator';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { getMobileShellUrl, MOBILE_DIAGNOSTICS_ENABLED } from '../config';
import {
  appendMobileDiagnosticsEvent,
  createMobileDiagnosticsEvent,
  formatMobileDiagnosticsLog,
  type MobileDiagnosticsEvent,
} from '../mobileDiagnostics';
import { createMobileShellHeaders } from '../mobileHeaders';
import { getMobileHardwareId } from '../mobileIdentity';
import { createMobileShellInjectionScript } from '../webViewBridge';

type NativeOAuthRequest = {
  requestId: string;
  provider: 'google' | 'facebook';
};

export function MangaDockWebViewScreen(
  props: Partial<
    NativeStackScreenProps<NativeShellStackParamList, 'WebView'>
  > = {},
) {
  const safeAreaInsets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const webViewReadyRef = useRef(false);
  const nativeOAuthRequestRef = useRef<NativeOAuthRequest | null>(null);
  const screenFocusedRef = useRef(true);
  const pendingNativeOAuthPayloadRef = useRef<Record<
    string,
    string | undefined
  > | null>(null);
  const [hardwareId, setHardwareId] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState(false);
  const [identityAttempt, setIdentityAttempt] = useState(0);
  const [, setDiagnosticsEvents] = useState<MobileDiagnosticsEvent[]>([]);
  const [nativeOAuthRequest, setNativeOAuthRequest] =
    useState<NativeOAuthRequest | null>(null);

  useEffect(() => {
    const removeFocus = props.navigation?.addListener?.('focus', () => {
      screenFocusedRef.current = true;
    });
    const removeBlur = props.navigation?.addListener?.('blur', () => {
      screenFocusedRef.current = false;
    });
    return () => {
      removeFocus?.();
      removeBlur?.();
    };
  }, [props.navigation]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (
          !screenFocusedRef.current ||
          !canGoBackRef.current ||
          !webViewRef.current
        ) {
          return false;
        }
        webViewRef.current.goBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, []);

  const recordDiagnostics = useCallback(
    (input: {
      type: string;
      url?: string;
      statusCode?: number;
      message?: string;
    }) => {
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

  const injectNativeOAuthResultToWeb = useCallback(
    (payload: Record<string, string | undefined>) => {
      const serializedPayload = JSON.stringify(payload);
      webViewRef.current?.injectJavaScript(`
        (function () {
          window.dispatchEvent(new CustomEvent('mangadock:native-oauth-callback', {
            detail: ${serializedPayload}
          }));
        })();
        true;
      `);
    },
    [],
  );

  const sendNativeOAuthResultToWeb = useCallback(
    (payload: Record<string, string | undefined>) => {
      pendingNativeOAuthPayloadRef.current = payload;
      if (webViewRef.current && webViewReadyRef.current)
        injectNativeOAuthResultToWeb(payload);
    },
    [injectNativeOAuthResultToWeb],
  );

  const flushPendingNativeOAuthResult = useCallback(() => {
    if (!pendingNativeOAuthPayloadRef.current) {
      return;
    }

    const payload = pendingNativeOAuthPayloadRef.current;
    injectNativeOAuthResultToWeb(payload);
  }, [injectNativeOAuthResultToWeb]);

  const handleWebViewMessage = useCallback(
    ({ nativeEvent }: { nativeEvent: { data?: string; url?: string } }) => {
      if (
        !nativeEvent.data ||
        !nativeEvent.url ||
        new URL(nativeEvent.url).origin !== new URL(getMobileShellUrl()).origin
      ) {
        return;
      }

      try {
        const message = JSON.parse(nativeEvent.data);

        if (
          message.type === 'oauth_callback_consumed' &&
          message.source === 'mangadock-web' &&
          message.request_id === nativeOAuthRequestRef.current?.requestId
        ) {
          pendingNativeOAuthPayloadRef.current = null;
          nativeOAuthRequestRef.current = null;
          setNativeOAuthRequest(null);
          return;
        }
        if (message.source !== 'mangadock-web') {
          return;
        }

        const eventTypeByBridgeType: Record<string, string> = {
          console_error: 'web_console_error',
          js_error: 'web_js_error',
          oauth_start: 'native_oauth_start',
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

        if (
          message.type === 'oauth_start' &&
          (message.provider === 'google' || message.provider === 'facebook') &&
          typeof message.url === 'string'
        ) {
          const authorize = new URL(message.url);
          const redirect = new URL(
            authorize.searchParams.get('redirect_to') ?? '',
          );
          const requestId = redirect.searchParams.get('request_id');
          if (
            authorize.protocol !== 'https:' ||
            redirect.protocol !== 'mangadock:' ||
            redirect.hostname !== 'auth' ||
            redirect.pathname !== '/callback' ||
            !requestId
          )
            return;
          const request = { provider: message.provider, requestId };
          nativeOAuthRequestRef.current = request;
          pendingNativeOAuthPayloadRef.current = null;
          setNativeOAuthRequest(request);
          Linking.openURL(message.url).catch(error => {
            setNativeOAuthRequest(null);
            recordDiagnostics({
              type: 'native_oauth_open_error',
              message: error instanceof Error ? error.message : String(error),
            });
            sendNativeOAuthResultToWeb({
              error: 'Cannot open the system browser for OAuth',
              request_id: nativeOAuthRequestRef.current?.requestId,
            });
          });
        }
      } catch {}
    },
    [recordDiagnostics, sendNativeOAuthResultToWeb],
  );

  const handleNativeOAuthUrl = useCallback(
    (url: string) => {
      const payload = parseNativeOAuthCallbackUrl(url);
      const pending = nativeOAuthRequestRef.current;
      if (
        !pending ||
        payload.request_id !== pending.requestId ||
        (!payload.code && !payload.error && !payload.error_code)
      )
        return;
      recordDiagnostics({
        type:
          payload.error || payload.error_code
            ? 'native_oauth_error'
            : 'native_oauth_callback_received',
        message: payload.error || payload.error_code,
      });
      sendNativeOAuthResultToWeb(payload);
    },
    [recordDiagnostics, sendNativeOAuthResultToWeb],
  );

  useEffect(() => {
    Linking.getInitialURL().then(url => {
      if (url) {
        handleNativeOAuthUrl(url);
      }
    });

    const subscription = Linking.addEventListener('url', event => {
      handleNativeOAuthUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleNativeOAuthUrl]);

  const cancelNativeOAuth = useCallback(() => {
    recordDiagnostics({
      type: 'native_oauth_cancelled',
      message: nativeOAuthRequest?.provider,
    });
    setNativeOAuthRequest(null);
    sendNativeOAuthResultToWeb({
      error_code: 'auth/cancelled-popup-request',
      request_id: nativeOAuthRequestRef.current?.requestId,
    });
    nativeOAuthRequestRef.current = null;
    pendingNativeOAuthPayloadRef.current = null;
  }, [
    nativeOAuthRequest?.provider,
    recordDiagnostics,
    sendNativeOAuthResultToWeb,
  ]);

  useEffect(() => {
    let isMounted = true;

    getMobileHardwareId()
      .then(nextHardwareId => {
        if (isMounted) {
          setHardwareId(nextHardwareId);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIdentityError(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [identityAttempt]);

  if (!hardwareId) {
    if (identityError) {
      return (
        <View
          style={styles.identityErrorContainer}
          testID="mobile-shell-identity-error"
        >
          <Text style={styles.identityErrorText}>
            เปิดแอปไม่สำเร็จ กรุณาลองอีกครั้ง
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setIdentityError(false);
              setIdentityAttempt(attempt => attempt + 1);
            }}
            testID="mobile-shell-identity-retry"
          >
            <Text style={styles.identityRetryText}>ลองอีกครั้ง</Text>
          </Pressable>
        </View>
      );
    }
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
        onNavigationStateChange={navigation => {
          canGoBackRef.current = navigation.canGoBack;
        }}
        source={{
          uri: mobileShellUrl,
          headers: createMobileShellHeaders(hardwareId),
        }}
        injectedJavaScriptBeforeContentLoaded={createMobileShellInjectionScript(
          hardwareId,
        )}
        onLoadStart={({ nativeEvent }) => {
          webViewReadyRef.current = false;
          recordDiagnostics({
            type: 'webview_load_start',
            url: nativeEvent.url,
          });
        }}
        onLoadEnd={({ nativeEvent }) => {
          webViewReadyRef.current = true;
          recordDiagnostics({
            type: 'webview_load_end',
            url: nativeEvent.url,
          });
          flushPendingNativeOAuthResult();
        }}
        onError={({ nativeEvent }) =>
          recordDiagnostics({
            type: 'webview_error',
            url: nativeEvent.url,
            message: nativeEvent.description,
          })
        }
        onHttpError={({ nativeEvent }) =>
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
      {nativeOAuthRequest ? (
        <View style={styles.oauthPendingPanel} testID="native-oauth-pending">
          <View>
            <Text style={styles.oauthEyebrow}>MangaDock</Text>
            <Text style={styles.oauthTitle}>
              เข้าสู่ระบบด้วย{' '}
              {nativeOAuthRequest.provider === 'google' ? 'Google' : 'Facebook'}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="ยกเลิกการเข้าสู่ระบบ"
            accessibilityRole="button"
            onPress={cancelNativeOAuth}
            style={styles.oauthCloseButton}
            testID="native-oauth-cancel-button"
          >
            <Text style={styles.oauthCloseButtonText}>ยกเลิก</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function parseNativeOAuthCallbackUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.protocol !== 'mangadock:' ||
      parsedUrl.hostname !== 'auth' ||
      parsedUrl.pathname !== '/callback'
    )
      return {};
    const search = new URLSearchParams(parsedUrl.search);
    const hash = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
    const read = (key: string) => search.get(key) ?? hash.get(key) ?? undefined;

    return {
      request_id: read('request_id'),
      code: read('code'),
      error: read('error_description') ?? read('error'),
      error_code: read('error_code'),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Invalid OAuth callback',
    };
  }
}

const styles = StyleSheet.create({
  identityErrorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#ffffff',
  },
  identityErrorText: {
    color: '#111116',
    fontSize: 16,
    textAlign: 'center',
  },
  identityRetryText: {
    color: '#0957c3',
    fontSize: 16,
    fontWeight: '600',
  },
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
  oauthPendingPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 56,
    zIndex: 70,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111116',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  oauthEyebrow: {
    color: 'rgba(248, 249, 251, 0.45)',
    fontSize: 11,
    fontWeight: '700',
  },
  oauthTitle: {
    color: '#f8f9fb',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  oauthCloseButton: {
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
  },
  oauthCloseButtonText: {
    color: '#f8f9fb',
    fontSize: 13,
    fontWeight: '700',
  },
});
