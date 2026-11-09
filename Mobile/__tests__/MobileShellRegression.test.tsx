/**
 * @format
 */

import React from 'react';
import { BackHandler, Linking, NativeModules } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { getMobileHardwareId } from '../src/mobileIdentity';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock(
  'react-native-webview',
  () => {
    const { View } = require('react-native');

    return {
      WebView: require('react').forwardRef(
        (
          props: {
            source: { uri: string; headers?: Record<string, string> };
            injectedJavaScriptBeforeContentLoaded?: string;
          },
          ref: React.Ref<unknown>,
        ) => {
          require('react').useImperativeHandle(ref, () => ({
            goBack: mockGoBack,
            injectJavaScript: mockInjectJavaScript,
            reload: mockReload,
          }));
          require('react').useEffect(() => {
            mockWebViewMounts();
          }, []);
          return <View testID="mobile-shell-webview" {...props} />;
        },
      ),
    };
  },
  { virtual: true },
);

jest.mock('../src/mobileIdentity', () => ({
  getMobileHardwareId: jest
    .fn()
    .mockResolvedValue('11111111-2222-4333-8444-555555555555'),
}));

import { MangaDockWebViewScreen as App } from '../src/screens/MangaDockWebViewScreen';

const mockGoBack = jest.fn();
const mockInjectJavaScript = jest.fn();
const mockReload = jest.fn();
const mockWebViewMounts = jest.fn();
const mockShareFile = jest.fn();

beforeEach(() => {
  mockGoBack.mockClear();
  mockInjectJavaScript.mockClear();
  mockReload.mockClear();
  mockWebViewMounts.mockClear();
  mockShareFile.mockReset().mockResolvedValue(true);
  NativeModules.MangaDockFileShare = {shareFile: mockShareFile};
  jest.spyOn(Linking, 'addEventListener').mockReturnValue({
    remove: jest.fn(),
  } as unknown as ReturnType<typeof Linking.addEventListener>);
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});

test('Android Back returns through WebView history and allows exit at the root', async () => {
  const backSubscription = jest.spyOn(BackHandler, 'addEventListener');
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(backSubscription).toHaveBeenCalledWith(
    'hardwareBackPress',
    expect.any(Function),
  );
  const onBack = backSubscription.mock.calls.at(-1)![1];
  expect(onBack()).toBe(false);
  const webview = renderer!.root.findByProps({
    testID: 'mobile-shell-webview',
  });
  ReactTestRenderer.act(() => {
    webview.props.onNavigationStateChange({ canGoBack: true });
  });
  expect(onBack()).toBe(true);
  expect(mockGoBack).toHaveBeenCalledTimes(1);
  ReactTestRenderer.act(() => {
    webview.props.onNavigationStateChange({ canGoBack: false });
  });
  expect(onBack()).toBe(false);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('malformed frame URLs cannot crash the OAuth message handler', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {renderer = ReactTestRenderer.create(<App />);});
  const webview = renderer!.root.findByProps({testID: 'mobile-shell-webview'});
  expect(() => webview.props.onMessage({nativeEvent: {url: 'invalid-url', data: '{}'}})).not.toThrow();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('OAuth callback delivery checks the current document origin', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {renderer = ReactTestRenderer.create(<App />);});
  const webview = renderer!.root.findByProps({testID: 'mobile-shell-webview'});
  ReactTestRenderer.act(() => {
    webview.props.onLoadEnd({nativeEvent: {url: 'https://hayateotsu.space'}});
    webview.props.onMessage({nativeEvent: {url: 'https://hayateotsu.space', data: JSON.stringify({
      source: 'mangadock-web', type: 'oauth_start', provider: 'google',
      url: 'https://supabase.example/auth/v1/authorize?redirect_to=mangadock%3A%2F%2Fauth%2Fcallback%3Frequest_id%3Dqa-origin',
    })}});
    jest.mocked(Linking.addEventListener).mock.calls.at(-1)![1]({url: 'mangadock://auth/callback?request_id=qa-origin&code=private-code'});
  });
  const delivered: unknown[] = [];
  const vm = require('node:vm');
  vm.runInNewContext(mockInjectJavaScript.mock.calls.at(-1)![0], {
    window: {location: {origin: 'https://foreign.example'}, dispatchEvent: (event: unknown) => delivered.push(event)},
    CustomEvent: class {constructor(_name: string, _options: unknown) {}},
  });
  expect(delivered).toHaveLength(0);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('a superseded browser launch failure cannot fail the current login', async () => {
  let rejectFirst: (error: Error) => void = () => {};
  jest.mocked(Linking.openURL).mockImplementationOnce(() => new Promise((_resolve, reject) => {rejectFirst = reject;}));
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {renderer = ReactTestRenderer.create(<App />);});
  const webview = renderer!.root.findByProps({testID: 'mobile-shell-webview'});
  ReactTestRenderer.act(() => {
    webview.props.onLoadEnd({nativeEvent: {url: 'https://hayateotsu.space'}});
    for (const requestId of ['old-login', 'new-login']) {
      webview.props.onMessage({nativeEvent: {url: 'https://hayateotsu.space', data: JSON.stringify({
        source: 'mangadock-web', type: 'oauth_start', provider: 'google',
        url: 'https://supabase.example/auth/v1/authorize?redirect_to=' + encodeURIComponent('mangadock://auth/callback?request_id=' + requestId),
      })}});
    }
  });
  mockInjectJavaScript.mockClear();
  await ReactTestRenderer.act(async () => rejectFirst(new Error('old browser failure')));
  expect(renderer!.root.findAllByProps({testID: 'native-oauth-pending'}).length).toBeGreaterThan(0);
  expect(mockInjectJavaScript).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('the modern web command accepts the exact allowlisted PKCE callback without query metadata', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {renderer = ReactTestRenderer.create(<App />);});
  const webview = renderer!.root.findByProps({testID: 'mobile-shell-webview'});
  ReactTestRenderer.act(() => {
    webview.props.onLoadEnd({nativeEvent: {url: 'https://hayateotsu.space'}});
    webview.props.onMessage({nativeEvent: {url: 'https://hayateotsu.space', data: JSON.stringify({
      type: 'mangadock:oauth:start', provider: 'google', requestId: 'exact-callback-request',
    })}});
    webview.props.onMessage({nativeEvent: {url: 'https://hayateotsu.space', data: JSON.stringify({
      source: 'mangadock-web', type: 'oauth_start', protocol: 'expo', provider: 'google', request_id: 'exact-callback-request',
      url: 'https://supabase.example/auth/v1/authorize?redirect_to=mangadock%3A%2F%2Fauth%2Fcallback',
    })}});
  });
  expect(Linking.openURL).toHaveBeenCalled();
  mockInjectJavaScript.mockClear();
  ReactTestRenderer.act(() => {
    jest.mocked(Linking.addEventListener).mock.calls.at(-1)![1]({url: 'mangadock://auth/callback?code=bound-pkce-code'});
  });
  expect(mockInjectJavaScript).toHaveBeenCalledWith(expect.stringContaining('exact-callback-request'));
  expect(mockInjectJavaScript).toHaveBeenCalledWith(expect.stringContaining('bound-pkce-code'));
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('renders the Frontend inside the Mobile Shell WebView with Mobile Shell headers', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  const webview = renderer!.root.findByProps({
    testID: 'mobile-shell-webview',
  });

  expect(webview.props.source).toEqual({
    uri: 'https://hayateotsu.space',
    headers: {
      'x-hardware-id': '11111111-2222-4333-8444-555555555555',
      'x-manga-dock-client': 'android-mobile-shell',
    },
  });
  expect(webview.props.injectedJavaScriptBeforeContentLoaded).toContain(
    'mangadock_device_id',
  );
  expect(webview.props.injectedJavaScriptBeforeContentLoaded).toContain(
    '11111111-2222-4333-8444-555555555555',
  );
});

test('offers retry when Mobile Hardware ID storage fails', async () => {
  const mockedGetMobileHardwareId = jest.mocked(getMobileHardwareId);
  mockedGetMobileHardwareId
    .mockRejectedValueOnce(new Error('storage unavailable'))
    .mockResolvedValueOnce('11111111-2222-4333-8444-555555555555');
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(
    renderer!.root.findByProps({ testID: 'mobile-shell-identity-error' }),
  ).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ testID: 'mobile-shell-identity-retry' })
      .props.onPress();
  });

  expect(
    renderer!.root.findByProps({ testID: 'mobile-shell-webview' }),
  ).toBeTruthy();
});

test('exposes beta diagnostics and logs WebView load events for QA', async () => {
  const consoleLog = jest.spyOn(console, 'log').mockImplementation();
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(
    renderer!.root.findByProps({ testID: 'mobile-diagnostics-button' }),
  ).toBeTruthy();

  const webview = renderer!.root.findByProps({
    testID: 'mobile-shell-webview',
  });

  ReactTestRenderer.act(() => {
    webview.props.onLoadStart({
      nativeEvent: { url: 'https://hayateotsu.space/library' },
    });
  });

  expect(consoleLog).toHaveBeenCalledWith(
    expect.stringContaining('MangaDockMobile '),
  );
  expect(consoleLog).toHaveBeenCalledWith(
    expect.stringContaining('"type":"webview_load_start"'),
  );
  expect(consoleLog).toHaveBeenCalledWith(
    expect.stringContaining('"hardwareId":"11111111...5555"'),
  );

  consoleLog.mockRestore();
});

test('records bridged web JavaScript errors from the WebView', async () => {
  const consoleLog = jest.spyOn(console, 'log').mockImplementation();
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  const webview = renderer!.root.findByProps({
    testID: 'mobile-shell-webview',
  });

  ReactTestRenderer.act(() => {
    webview.props.onMessage({
      nativeEvent: {
        url: 'https://hayateotsu.space',
        data: JSON.stringify({
          source: 'mangadock-web',
          type: 'console_error',
          message: 'bad request {"status":500}',
        }),
      },
    });
  });

  expect(consoleLog).toHaveBeenCalledWith(
    expect.stringContaining('"type":"web_console_error"'),
  );
  expect(consoleLog).toHaveBeenCalledWith(
    expect.stringContaining('bad request'),
  );

  consoleLog.mockRestore();
});

test('opens the system browser when the web app requests mobile social login', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  const webview = renderer!.root.findByProps({
    testID: 'mobile-shell-webview',
  });

  ReactTestRenderer.act(() => {
    webview.props.onMessage({
      nativeEvent: {
        url: 'https://hayateotsu.space',
        data: JSON.stringify({
          source: 'mangadock-web',
          type: 'oauth_start',
          provider: 'google',
          url: 'https://supabase.example/auth/v1/authorize?redirect_to=mangadock%3A%2F%2Fauth%2Fcallback%3Frequest_id%3Dqa-request',
        }),
      },
    });
  });

  expect(Linking.openURL).toHaveBeenCalledWith(
    'https://supabase.example/auth/v1/authorize?redirect_to=mangadock%3A%2F%2Fauth%2Fcallback%3Frequest_id%3Dqa-request',
  );
  expect(
    renderer!.root.findByProps({ testID: 'native-oauth-pending' }),
  ).toBeTruthy();
});

test('adapts the deployed web command to browser preparation and routes its bound callback', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {renderer = ReactTestRenderer.create(<App />);});
  const webview = renderer!.root.findByProps({testID: 'mobile-shell-webview'});
  ReactTestRenderer.act(() => {
    webview.props.onLoadEnd({nativeEvent: {url: 'https://hayateotsu.space'}});
    webview.props.onMessage({nativeEvent: {url: 'https://hayateotsu.space', data: JSON.stringify({
      type: 'mangadock:oauth:start', provider: 'google', requestId: 'qa-legacy-request',
    })}});
  });
  expect(mockInjectJavaScript).toHaveBeenCalledWith(expect.stringContaining('__MANGA_DOCK_LEGACY_AUTH__?.start("google", "qa-legacy-request")'));
  ReactTestRenderer.act(() => {
    const listener = jest.mocked(Linking.addEventListener).mock.calls.at(-1)![1];
    listener({url: 'mangadock://auth/callback?request_id=qa-legacy-request&code=qa-code'});
  });
  expect(mockInjectJavaScript).toHaveBeenCalledWith(expect.stringContaining('__MANGA_DOCK_LEGACY_AUTH__?.receive'));
  expect(renderer!.root.findByProps({testID: 'native-oauth-pending'})).toBeTruthy();
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('opens account linking provider URLs only with trusted origin and explicit request metadata', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const webview = renderer!.root.findByProps({testID: 'mobile-shell-webview'});
  ReactTestRenderer.act(() => {
    webview.props.onMessage({nativeEvent: {
      url: 'https://hayateotsu.space',
      data: JSON.stringify({source: 'mangadock-web', type: 'oauth_start', provider: 'google',
        request_id: 'qa-link-request', url: 'https://accounts.google.com/o/oauth2/v2/auth?state=qa'}),
    }});
  });
  expect(Linking.openURL).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=qa');
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('returns a bound PKCE callback to the ready WebView without logging codes', async () => {
  const log = jest.spyOn(console, 'log').mockImplementation();
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const webview = renderer!.root.findByProps({
    testID: 'mobile-shell-webview',
  });
  ReactTestRenderer.act(() => {
    webview.props.onLoadEnd({
      nativeEvent: { url: 'https://hayateotsu.space' },
    });
    webview.props.onMessage({
      nativeEvent: {
        url: 'https://hayateotsu.space',
        data: JSON.stringify({
          source: 'mangadock-web',
          type: 'oauth_start',
          provider: 'google',
          url: 'https://supabase.example/auth/v1/authorize?redirect_to=mangadock%3A%2F%2Fauth%2Fcallback%3Frequest_id%3Dqa-request',
        }),
      },
    });
  });
  const listener = jest.mocked(Linking.addEventListener).mock.calls.at(-1)![1];
  ReactTestRenderer.act(() => {
    listener({
      url: 'mangadock://auth/callback?request_id=qa-request&code=qa-code',
    });
  });
  expect(mockInjectJavaScript).toHaveBeenCalledWith(
    expect.stringContaining('mangadock:native-oauth-callback'),
  );
  expect(mockInjectJavaScript).toHaveBeenCalledWith(
    expect.stringContaining('qa-code'),
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain('qa-code');
  expect(JSON.stringify(log.mock.calls)).not.toContain('qa-refresh');
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('cancel clears pending OAuth and sends an error back to the web app', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const webview = renderer!.root.findByProps({
    testID: 'mobile-shell-webview',
  });
  ReactTestRenderer.act(() => {
    webview.props.onLoadEnd({
      nativeEvent: { url: 'https://hayateotsu.space' },
    });
  });
  ReactTestRenderer.act(() => {
    webview.props.onMessage({
      nativeEvent: {
        url: 'https://hayateotsu.space',
        data: JSON.stringify({
          source: 'mangadock-web',
          type: 'oauth_start',
          provider: 'facebook',
          url: 'https://supabase.example/auth/v1/authorize?redirect_to=mangadock%3A%2F%2Fauth%2Fcallback%3Frequest_id%3Dqa-request',
        }),
      },
    });
  });
  ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ testID: 'native-oauth-cancel-button' })
      .props.onPress();
  });
  expect(mockInjectJavaScript).toHaveBeenCalledWith(
    expect.stringContaining('auth/cancelled-popup-request'),
  );
  expect(
    renderer!.root.findAllByProps({ testID: 'native-oauth-pending' }),
  ).toHaveLength(0);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('WebView Back stops intercepting hardware Back after a native screen takes focus', async () => {
  const back = jest.spyOn(BackHandler, 'addEventListener');
  const listeners: Record<string, () => void> = {};
  const navigation = {
    addListener: jest.fn((event: string, callback: () => void) => {
      listeners[event] = callback;
      return jest.fn();
    }),
  };
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <App navigation={navigation as never} />,
    );
  });
  const webview = renderer!.root.findByProps({
    testID: 'mobile-shell-webview',
  });
  ReactTestRenderer.act(() => {
    webview.props.onNavigationStateChange({ canGoBack: true });
  });
  const onBack = back.mock.calls.at(-1)![1];
  expect(onBack()).toBe(true);
  listeners.blur();
  expect(onBack()).toBe(false);
  listeners.focus();
  expect(onBack()).toBe(true);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('ignores unsolicited, stale, wrong-path and bearer-token deep links', async () => {
  const log = jest.spyOn(console, 'log').mockImplementation();
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const listener = jest.mocked(Linking.addEventListener).mock.calls.at(-1)![1];
  const webview = renderer!.root.findByProps({
    testID: 'mobile-shell-webview',
  });
  ReactTestRenderer.act(() => {
    webview.props.onLoadEnd({
      nativeEvent: { url: 'https://hayateotsu.space' },
    });
    listener({
      url: 'mangadock://auth/callback?request_id=qa-request&code=unsolicited',
    });
    webview.props.onMessage({
      nativeEvent: {
        url: 'https://hayateotsu.space',
        data: JSON.stringify({
          source: 'mangadock-web',
          type: 'oauth_start',
          provider: 'google',
          url: 'https://supabase.example/auth/v1/authorize?redirect_to=mangadock%3A%2F%2Fauth%2Fcallback%3Frequest_id%3Dqa-request',
        }),
      },
    });
    listener({
      url: 'mangadock://auth/callback?request_id=old-request&code=stale',
    });
    listener({
      url: 'mangadock://auth/callbackevil?request_id=qa-request&code=wrong-path',
    });
    listener({
      url: 'mangadock://auth/callback?request_id=qa-request#access_token=attacker&refresh_token=attacker',
    });
  });
  expect(mockInjectJavaScript).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => renderer!.unmount());
  log.mockRestore();
});

test('retains a callback while WebView loads and clears it only after frontend acknowledgement', async () => {
  const log = jest.spyOn(console, 'log').mockImplementation();
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const listener = jest.mocked(Linking.addEventListener).mock.calls.at(-1)![1];
  const webview = renderer!.root.findByProps({
    testID: 'mobile-shell-webview',
  });
  ReactTestRenderer.act(() => {
    webview.props.onMessage({
      nativeEvent: {
        url: 'https://hayateotsu.space',
        data: JSON.stringify({
          source: 'mangadock-web',
          type: 'oauth_start',
          provider: 'google',
          url: 'https://supabase.example/auth/v1/authorize?redirect_to=mangadock%3A%2F%2Fauth%2Fcallback%3Frequest_id%3Dqa-request',
        }),
      },
    });
    listener({
      url: 'mangadock://auth/callback?request_id=qa-request&code=bound-code',
    });
  });
  expect(mockInjectJavaScript).not.toHaveBeenCalled();
  ReactTestRenderer.act(() => {
    webview.props.onLoadEnd({
      nativeEvent: { url: 'https://hayateotsu.space' },
    });
  });
  expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
  ReactTestRenderer.act(() => {
    webview.props.onLoadEnd({
      nativeEvent: { url: 'https://hayateotsu.space' },
    });
  });
  expect(mockInjectJavaScript).toHaveBeenCalledTimes(2);
  ReactTestRenderer.act(() => {
    webview.props.onMessage({
      nativeEvent: {
        url: 'https://hayateotsu.space',
        data: JSON.stringify({
          source: 'mangadock-web',
          type: 'oauth_callback_consumed',
          request_id: 'qa-request',
        }),
      },
    });
  });
  ReactTestRenderer.act(() => {
    webview.props.onLoadEnd({
      nativeEvent: { url: 'https://hayateotsu.space' },
    });
  });
  expect(mockInjectJavaScript).toHaveBeenCalledTimes(2);
  await ReactTestRenderer.act(async () => renderer!.unmount());
  log.mockRestore();
});

test('hands a same-origin blob export to the native share sheet and reports failures', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {renderer = ReactTestRenderer.create(<App />);});
  const webview = renderer!.root.findByProps({testID: 'mobile-shell-webview'});
  const data = Buffer.from('title\nOne\n').toString('base64');
  const message = JSON.stringify({source: 'mangadock-web', type: 'file_download', filename: 'reading-history.csv', mimeType: 'text/csv; charset=utf-8', data});
  await ReactTestRenderer.act(async () => {
    webview.props.onMessage({nativeEvent: {url: 'https://hayateotsu.space.evil.test/', data: message}});
  });
  expect(mockShareFile).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => {
    webview.props.onMessage({nativeEvent: {url: 'https://hayateotsu.space/mylist', data: message}});
  });
  expect(mockShareFile).toHaveBeenCalledWith('reading-history.csv', 'text/csv', data);
  expect(renderer!.root.findAllByProps({testID: 'native-shell-notice'})).toHaveLength(0);

  mockShareFile.mockRejectedValueOnce(new Error('no activity'));
  await ReactTestRenderer.act(async () => {
    webview.props.onMessage({nativeEvent: {url: 'https://hayateotsu.space/mylist', data: message}});
  });
  expect(renderer!.root.findAllByProps({testID: 'native-shell-notice'}).length).toBeGreaterThan(0);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('shows a native retry screen when the page cannot load and recovers a crashed renderer', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {renderer = ReactTestRenderer.create(<App />);});
  const webview = renderer!.root.findByProps({testID: 'mobile-shell-webview'});
  expect(webview.props.renderError).toEqual(expect.any(Function));
  let errorView: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    errorView = ReactTestRenderer.create(webview.props.renderError('net', -2, 'net::ERR_INTERNET_DISCONNECTED'));
  });
  ReactTestRenderer.act(() => {
    errorView!.root.findByProps({testID: 'mobile-shell-load-error-retry'}).props.onPress();
  });
  expect(mockReload).toHaveBeenCalledTimes(1);

  expect(mockWebViewMounts).toHaveBeenCalledTimes(1);
  ReactTestRenderer.act(() => {
    webview.props.onNavigationStateChange({canGoBack: true, url: 'https://hayateotsu.space/book/abc?chapter=2'});
    webview.props.onNavigationStateChange({canGoBack: true, url: 'https://foreign.example/elsewhere'});
  });
  await ReactTestRenderer.act(async () => {
    renderer!.root.findByProps({testID: 'mobile-shell-webview'}).props.onRenderProcessGone({nativeEvent: {didCrash: true}});
  });
  expect(mockWebViewMounts).toHaveBeenCalledTimes(2);
  expect(renderer!.root.findByProps({testID: 'mobile-shell-webview'}).props.source.uri)
    .toBe('https://hayateotsu.space/book/abc?chapter=2');
  // A later product link still wins over the crash-recovery page.
  await ReactTestRenderer.act(async () => {
    jest.mocked(Linking.addEventListener).mock.calls.at(-1)![1]({url: 'mangadock://community'});
  });
  expect(renderer!.root.findByProps({testID: 'mobile-shell-webview'}).props.source.uri)
    .toBe('https://hayateotsu.space/community');
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('explains an OAuth callback that arrives after the app process was restarted', async () => {
  jest.mocked(Linking.getInitialURL).mockResolvedValueOnce('mangadock://auth/callback?code=orphaned-code');
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {renderer = ReactTestRenderer.create(<App />);});
  const notice = renderer!.root.findAllByProps({testID: 'native-shell-notice'});
  expect(notice.length).toBeGreaterThan(0);
  expect(mockInjectJavaScript).not.toHaveBeenCalledWith(expect.stringContaining('orphaned-code'));
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

test('Android Back dismisses the open web dialog layer before leaving the page', async () => {
  const backSubscription = jest.spyOn(BackHandler, 'addEventListener');
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {renderer = ReactTestRenderer.create(<App />);});
  const onBack = backSubscription.mock.calls.at(-1)![1];
  const webview = renderer!.root.findByProps({testID: 'mobile-shell-webview'});
  const modal = (open: boolean, url = 'https://hayateotsu.space/book/1') => ReactTestRenderer.act(() => {
    webview.props.onMessage({nativeEvent: {url, data: JSON.stringify({source: 'mangadock-web', type: 'modal_state', open})}});
  });

  modal(true, 'https://foreign.example/');
  expect(onBack()).toBe(false);

  modal(true);
  expect(onBack()).toBe(true);
  expect(mockInjectJavaScript).toHaveBeenLastCalledWith(expect.stringContaining("key: 'Escape'"));
  expect(mockGoBack).not.toHaveBeenCalled();
  // Escape closed nothing and the reader pressed Back again at once: leave normally.
  ReactTestRenderer.act(() => {webview.props.onNavigationStateChange({canGoBack: true, url: 'https://hayateotsu.space/book/1'});});
  expect(onBack()).toBe(true);
  expect(mockGoBack).toHaveBeenCalledTimes(1);

  modal(false);
  ReactTestRenderer.act(() => {webview.props.onNavigationStateChange({canGoBack: false, url: 'https://hayateotsu.space/'});});
  expect(onBack()).toBe(false);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});
