/**
 * @format
 */

import React from 'react';
import { BackHandler, Linking } from 'react-native';
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
          }));
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

beforeEach(() => {
  mockGoBack.mockClear();
  mockInjectJavaScript.mockClear();
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
