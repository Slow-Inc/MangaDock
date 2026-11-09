import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeShellStackParamList } from '../navigation/NativeShellNavigator';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Linking,
  NativeModules,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { URL, URLSearchParams } from 'react-native-url-polyfill';
import { getMobileShellUrl, MOBILE_DIAGNOSTICS_ENABLED } from '../config';
import {
  createMobileDiagnosticsEvent,
  formatMobileDiagnosticsLog,
} from '../mobileDiagnostics';
import {useMobileDiagnosticsActions} from '../MobileDiagnosticsProvider';
import { createMobileShellHeaders } from '../mobileHeaders';
import { getMobileHardwareId } from '../mobileIdentity';
import { createMobileShellInjectionScript } from '../webViewBridge';
import {productLinkPath} from '../navigation/productLinks';
import {parseFileDownloadMessage} from '../fileShare';
import {mobileTheme} from '../theme/mobileTheme';
import {createHybridPushHost, hybridPushEnabled, parsePushRequest} from '../hybridPush';

const EXPORT_FAILED_NOTICE = 'ส่งออกไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง';
const OAUTH_INTERRUPTED_NOTICE = 'การเข้าสู่ระบบถูกขัดจังหวะ กรุณาเข้าสู่ระบบอีกครั้ง';

type NativeOAuthRequest = {
  requestId: string;
  provider: 'google' | 'facebook';
  protocol?: 'expo';
};

export function MangaDockWebViewScreen(
  props: Partial<
    NativeStackScreenProps<NativeShellStackParamList, 'WebView'>
  > = {},
) {
  const safeAreaInsets = useSafeAreaInsets();
  const diagnostics = useMobileDiagnosticsActions();
  const webViewRef = useRef<WebView>(null);
  const pushHostRef = useRef<ReturnType<typeof createHybridPushHost> | null>(null);
  useEffect(() => {
    if (!hybridPushEnabled) return;
    const host = createHybridPushHost(event => {
      webViewRef.current?.injectJavaScript(`
        if (window.location.origin === ${JSON.stringify(new URL(getMobileShellUrl()).origin)}) {
          window.dispatchEvent(new CustomEvent('mangadock:push', {detail: ${JSON.stringify(event)}}));
        }
        true;
      `);
    });
    pushHostRef.current = host;
    return () => { pushHostRef.current = null; host.dispose(); };
  }, []);
  const canGoBackRef = useRef(false);
  const webViewReadyRef = useRef(false);
  const webModalOpenRef = useRef(false);
  // Set when Back sent Escape; a quick second Back while nothing closed falls through.
  const escapeSentAtRef = useRef(0);
  const nativeOAuthRequestRef = useRef<NativeOAuthRequest | null>(null);
  const screenFocusedRef = useRef(true);
  const pendingNativeOAuthPayloadRef = useRef<Record<
    string,
    string | undefined
  > | null>(null);
  const pendingProtocolRef = useRef<NativeOAuthRequest['protocol']>(undefined);
  const [hardwareId, setHardwareId] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState(false);
  const [identityAttempt, setIdentityAttempt] = useState(0);
  const [linkedPath, setLinkedPath] = useState<string | null>(null);
  const [nativeOAuthRequest, setNativeOAuthRequest] =
    useState<NativeOAuthRequest | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // A new key remounts the WebView after Android kills its renderer.
  const [webViewKey, setWebViewKey] = useState(0);
  const currentUrlRef = useRef<string | null>(null);
  const [recoveryUrl, setRecoveryUrl] = useState<string | null>(null);
  const routeInitialPath = props.route?.params?.initialPath;
  // A new requested destination replaces the crash-recovery page.
  useEffect(() => setRecoveryUrl(null), [routeInitialPath]);

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
        if (screenFocusedRef.current && webViewRef.current && webModalOpenRef.current &&
            Date.now() - escapeSentAtRef.current > 1000) {
          escapeSentAtRef.current = Date.now();
          // The web layers (menus, Reader, book popup) each close on Escape, top-most first.
          webViewRef.current.injectJavaScript(`
            (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
            true;
          `);
          return true;
        }
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
      diagnostics?.appendEvent(event);
    },
    [hardwareId, diagnostics],
  );

  useEffect(() => {
    diagnostics?.setHardwareId(hardwareId ?? undefined);
  }, [diagnostics, hardwareId]);

  useEffect(() => diagnostics?.registerReload(() => {
    webViewRef.current?.reload();
  }), [diagnostics]);

  const injectNativeOAuthResultToWeb = useCallback(
    (payload: Record<string, string | undefined>) => {
      const serializedPayload = JSON.stringify(payload);
      webViewRef.current?.injectJavaScript(`
        (function () {
          if (window.location.origin !== ${JSON.stringify(new URL(getMobileShellUrl()).origin)}) return;
          if (${pendingProtocolRef.current === 'expo'}) {
            window.__MANGA_DOCK_LEGACY_AUTH__?.receive(${serializedPayload});
            return;
          }
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
      pendingProtocolRef.current = nativeOAuthRequestRef.current?.protocol;
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
      try {
        if (!nativeEvent.data || !nativeEvent.url ||
            new URL(nativeEvent.url).origin !== new URL(getMobileShellUrl()).origin) return;
        const message = JSON.parse(nativeEvent.data);
        if (message.type === 'push_request') {
          const request = parsePushRequest(message);
          if (request) pushHostRef.current?.handle(request);
          return;
        }

        if (message.type === 'mangadock:oauth:start' &&
            (message.provider === 'google' || message.provider === 'facebook') &&
            typeof message.requestId === 'string' && message.requestId && message.requestId.length <= 128) {
          const request: NativeOAuthRequest = {provider: message.provider, requestId: message.requestId, protocol: 'expo'};
          nativeOAuthRequestRef.current = request;
          pendingNativeOAuthPayloadRef.current = null;
          setNativeOAuthRequest(request);
          webViewRef.current?.injectJavaScript(`window.__MANGA_DOCK_LEGACY_AUTH__?.start(${JSON.stringify(message.provider)}, ${JSON.stringify(message.requestId)}); true;`);
          return;
        }

        if (
          message.type === 'oauth_callback_consumed' &&
          message.source === 'mangadock-web' &&
          message.request_id === (nativeOAuthRequestRef.current?.requestId ?? pendingNativeOAuthPayloadRef.current?.request_id)
        ) {
          pendingNativeOAuthPayloadRef.current = null;
          nativeOAuthRequestRef.current = null;
          setNativeOAuthRequest(null);
          return;
        }
        if (message.source !== 'mangadock-web') {
          return;
        }

        if (message.type === 'modal_state') {
          webModalOpenRef.current = message.open === true;
          escapeSentAtRef.current = 0;
          return;
        }

        if (message.type === 'file_download') {
          const file = parseFileDownloadMessage(message);
          const shareFile = NativeModules.MangaDockFileShare?.shareFile;
          if (!file || !shareFile) {
            setNotice(EXPORT_FAILED_NOTICE);
            return;
          }
          Promise.resolve(shareFile(file.filename, file.mimeType, file.base64))
            .catch(() => setNotice(EXPORT_FAILED_NOTICE));
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
          const authUrl = NativeModules.MangaDockAuthConfig?.url;
          if (authUrl && authorize.searchParams.has('redirect_to') &&
              (authorize.origin !== new URL(authUrl).origin || authorize.pathname !== '/auth/v1/authorize')) return;
          const redirectTo = authorize.searchParams.get('redirect_to');
          let requestId = typeof message.request_id === 'string' ? message.request_id : null;
          if (authorize.protocol !== 'https:') return;
          if (redirectTo) {
            const redirect = new URL(redirectTo);
            const redirectRequestId = redirect.searchParams.get('request_id');
            const exactPkceRedirect = message.protocol === 'expo' && redirect.href === 'mangadock://auth/callback';
            if (redirect.protocol !== 'mangadock:' || redirect.hostname !== 'auth' ||
                redirect.pathname !== '/callback' || (!redirectRequestId && !exactPkceRedirect) ||
                (requestId && redirectRequestId && requestId !== redirectRequestId)) return;
            requestId = redirectRequestId ?? requestId;
          } else {
            // linkIdentity returns the provider URL; callback binding is explicit.
            const allowedHost = message.provider === 'google'
              ? authorize.hostname === 'accounts.google.com'
              : ['www.facebook.com', 'm.facebook.com'].includes(authorize.hostname);
            if (!allowedHost) return;
          }
          if (!requestId) return;
          const pending = nativeOAuthRequestRef.current;
          if (message.protocol === 'expo' &&
              (!pending || pending.requestId !== requestId || pending.provider !== message.provider)) return;
          const request: NativeOAuthRequest = { provider: message.provider, requestId, protocol: message.protocol === 'expo' ? 'expo' : undefined };
          nativeOAuthRequestRef.current = request;
          pendingNativeOAuthPayloadRef.current = null;
          setNativeOAuthRequest(request);
          Linking.openURL(message.url).catch(() => {
            if (nativeOAuthRequestRef.current !== request) return;
            setNativeOAuthRequest(null);
            recordDiagnostics({
              type: 'native_oauth_open_error',
            });
            sendNativeOAuthResultToWeb({
              error: 'Cannot open the system browser for OAuth',
              request_id: request.requestId,
            });
          });
        }
      } catch {}
    },
    [recordDiagnostics, sendNativeOAuthResultToWeb],
  );

  const handleNativeOAuthUrl = useCallback(
    (url: string) => {
      const productPath = productLinkPath(url);
      if (productPath) {
        setRecoveryUrl(null);
        setLinkedPath(productPath);
        props.navigation?.navigate('WebView', {initialPath: productPath});
        return;
      }
      const payload = parseNativeOAuthCallbackUrl(url);
      const pending = nativeOAuthRequestRef.current;
      // Only our generated PKCE flow uses the exact registered callback.
      // The WebView-held verifier must still validate the code at Supabase.
      if (pending?.protocol === 'expo' && !payload.request_id) payload.request_id = pending.requestId;
      // The verifier lived in the previous process, so this code cannot be exchanged.
      if (!pending && (payload.code || payload.error || payload.error_code)) {
        setNotice(OAUTH_INTERRUPTED_NOTICE);
        return;
      }
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
    [recordDiagnostics, sendNativeOAuthResultToWeb, props.navigation],
  );

  useEffect(() => {
    let mounted = true;
    Linking.getInitialURL().then(url => {
      if (mounted && url) {
        handleNativeOAuthUrl(url);
      }
    }).catch(() => {});

    const subscription = Linking.addEventListener('url', event => {
      handleNativeOAuthUrl(event.url);
    });

    return () => {
      mounted = false;
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

  const initialPath = props.route?.params?.initialPath ?? linkedPath;
  const mobileShellUrl = recoveryUrl ?? (initialPath
    ? `${getMobileShellUrl().replace(/\/$/, '')}/${initialPath.replace(
        /^\//,
        '',
      )}`
    : getMobileShellUrl());

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: safeAreaInsets.top,
          paddingBottom: safeAreaInsets.bottom,
          paddingLeft: safeAreaInsets.left,
          paddingRight: safeAreaInsets.right,
        },
      ]}
    >
      <WebView
        key={webViewKey}
        webviewDebuggingEnabled={MOBILE_DIAGNOSTICS_ENABLED}
        ref={webViewRef}
        onNavigationStateChange={navigation => {
          canGoBackRef.current = navigation.canGoBack;
          try {
            if (new URL(navigation.url).origin === new URL(getMobileShellUrl()).origin) {
              currentUrlRef.current = navigation.url;
            }
          } catch {}
        }}
        onShouldStartLoadWithRequest={request => {
          try {
            if (request.url === 'about:blank') return true;
            const target = new URL(request.url);
            if (target.origin === new URL(getMobileShellUrl()).origin) return true;
            if (target.protocol === 'https:' || target.protocol === 'http:') {
              Linking.openURL(request.url).catch(() => {});
            }
          } catch {}
          return false;
        }}
        source={{
          uri: mobileShellUrl,
          headers: createMobileShellHeaders(hardwareId),
        }}
        injectedJavaScriptBeforeContentLoaded={createMobileShellInjectionScript(
          hardwareId,
          NativeModules.MangaDockAuthConfig,
          hybridPushEnabled,
        )}
        onLoadStart={({ nativeEvent }) => {
          pushHostRef.current?.suspend();
          webViewReadyRef.current = false;
          webModalOpenRef.current = false;
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
        renderError={(_domain, _code, description) => (
          <View style={styles.loadErrorContainer} testID="mobile-shell-load-error">
            <Text style={styles.loadErrorTitle}>เชื่อมต่อ MangaDock ไม่ได้</Text>
            <Text style={styles.loadErrorBody}>
              ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง
            </Text>
            {MOBILE_DIAGNOSTICS_ENABLED && description ? (
              <Text style={styles.loadErrorDetail}>{description}</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => webViewRef.current?.reload()}
              style={styles.loadErrorButton}
              testID="mobile-shell-load-error-retry"
            >
              <Text style={styles.loadErrorButtonText}>ลองอีกครั้ง</Text>
            </Pressable>
          </View>
        )}
        onRenderProcessGone={({nativeEvent}) => {
          recordDiagnostics({
            type: 'webview_render_process_gone',
            message: nativeEvent.didCrash ? 'crash' : 'killed',
          });
          // Reopen the page the reader was on, not the home screen.
          setRecoveryUrl(currentUrlRef.current);
          setWebViewKey(key => key + 1);
        }}
      />
      {MOBILE_DIAGNOSTICS_ENABLED ? (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => props.navigation?.navigate('Diagnostics')}
            style={[
              styles.diagnosticsButton,
              {bottom: safeAreaInsets.bottom + 80, left: safeAreaInsets.left + 12},
            ]}
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
      {notice && !nativeOAuthRequest ? (
        <View style={styles.oauthPendingPanel} testID="native-shell-notice">
          <Text style={styles.noticeText}>{notice}</Text>
          <Pressable
            accessibilityLabel="ปิดข้อความ"
            accessibilityRole="button"
            onPress={() => setNotice(null)}
            style={styles.oauthCloseButton}
          >
            <Text style={styles.oauthCloseButtonText}>ปิด</Text>
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
  } catch {
    return {};
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
    left: 12,
    bottom: 16,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  noticeText: {
    flex: 1,
    color: '#f8f9fb',
    fontSize: 14,
    fontWeight: '600',
  },
  loadErrorContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: mobileTheme.spacing.md,
    padding: mobileTheme.spacing.lg,
    backgroundColor: mobileTheme.colors.background,
  },
  loadErrorTitle: {
    color: mobileTheme.colors.foreground,
    fontSize: mobileTheme.typography.titleSize,
    fontWeight: '800',
    textAlign: 'center',
  },
  loadErrorBody: {
    color: mobileTheme.colors.foregroundMuted,
    fontSize: mobileTheme.typography.bodySize,
    textAlign: 'center',
  },
  loadErrorDetail: {
    color: mobileTheme.colors.foregroundMuted,
    fontSize: mobileTheme.typography.labelSize,
    textAlign: 'center',
  },
  loadErrorButton: {
    minHeight: mobileTheme.touchTarget.minHeight,
    justifyContent: 'center',
    paddingHorizontal: mobileTheme.spacing.lg,
    borderRadius: mobileTheme.radius.md,
    backgroundColor: mobileTheme.colors.primary,
  },
  loadErrorButtonText: {
    color: mobileTheme.colors.background,
    fontSize: mobileTheme.typography.bodySize,
    fontWeight: '700',
  },
  oauthCloseButtonText: {
    color: '#f8f9fb',
    fontSize: 13,
    fontWeight: '700',
  },
});
