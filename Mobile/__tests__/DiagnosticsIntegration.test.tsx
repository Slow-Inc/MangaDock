import React from 'react';
import { Linking, StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => {
  const ReactMock = require('react');

  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaInsetsContext: ReactMock.createContext({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    }),
    SafeAreaFrameContext: ReactMock.createContext({
      x: 0,
      y: 0,
      width: 390,
      height: 844,
    }),
    useSafeAreaInsets: () => mockSafeAreaInsets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

jest.mock(
  'react-native-webview',
  () => {
    const ReactMock = require('react');
    const { View } = require('react-native');

    return {
      WebView: ReactMock.forwardRef(
        (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
          ReactMock.useImperativeHandle(
            ref,
            () => ({
              reload: mockReload,
              goBack: jest.fn(),
              injectJavaScript: jest.fn(),
            }),
            [],
          );
          ReactMock.useEffect(() => {
            mockWebViewMounted();
            return () => mockWebViewUnmounted();
          }, []);
          return <View testID="integration-webview" {...props} />;
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

import App from '../App';
import { MangaDockWebViewScreen } from '../src/screens/MangaDockWebViewScreen';

const mockReload = jest.fn();
const mockWebViewMounted = jest.fn();
const mockWebViewUnmounted = jest.fn();
let mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const pageUrl = 'https://hayateotsu.space/';
const fixedTime = '2026-10-19T09:45:17.893Z';
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

function renderedText(node: ReactTestRenderer.ReactTestInstance): string {
  return node.children
    .map(child => (typeof child === 'string' ? child : renderedText(child)))
    .join(' ');
}

function diagnostics() {
  return renderer!.root.findByProps({ testID: 'native-diagnostics-screen' });
}

function webView() {
  return renderer!.root.findByProps({ testID: 'integration-webview' });
}

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    renderer!.root.findByProps({ testID }).props.onPress();
  });
}

async function openDiagnostics() {
  await press('mobile-diagnostics-button');
}

async function backToWebView() {
  await ReactTestRenderer.act(async () => {
    renderer!.root.findByType(MangaDockWebViewScreen).props.navigation.goBack();
  });
}

beforeEach(async () => {
  mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  mockReload.mockClear();
  mockWebViewMounted.mockClear();
  mockWebViewUnmounted.mockClear();
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedTime);
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  jest
    .spyOn(Linking, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as unknown as ReturnType<
      typeof Linking.addEventListener
    >);

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
});

afterEach(async () => {
  await ReactTestRenderer.act(async () => renderer?.unmount());
  renderer = undefined;
  jest.restoreAllMocks();
});

test('shows real preexisting events and masked identity, then updates the open screen without remounting', async () => {
  const mountedWebView = webView();
  await ReactTestRenderer.act(async () => {
    mountedWebView.props.onLoadStart({ nativeEvent: { url: pageUrl } });
  });
  await openDiagnostics();
  const mountedDiagnostics = diagnostics();
  expect(renderedText(mountedDiagnostics)).toContain('webview_load_start');
  expect(renderedText(mountedDiagnostics)).toContain('11111111...5555');
  expect(renderedText(mountedDiagnostics)).not.toContain(
    '11111111-2222-4333-8444-555555555555',
  );

  await ReactTestRenderer.act(async () => {
    webView().props.onHttpError({
      nativeEvent: { url: pageUrl, statusCode: 530 },
    });
  });
  expect(diagnostics()).toBe(mountedDiagnostics);
  expect(webView()).toBe(mountedWebView);
  const eventText = diagnostics()
    .findAllByProps({ testID: 'native-diagnostics-event' })
    .map(renderedText)
    .join(' ');
  expect(eventText).toContain('webview_http_error');
  expect(eventText).toContain('530');
  expect(eventText).toContain(fixedTime);
  expect(mockWebViewMounted).toHaveBeenCalledTimes(1);
  expect(mockWebViewUnmounted).not.toHaveBeenCalled();
});

test.each(['start-before-error', 'error-before-start'])(
  'keeps HTTP 530 health after load end with %s event ordering',
  async order => {
    await ReactTestRenderer.act(async () => {
      const start = () =>
        webView().props.onLoadStart({ nativeEvent: { url: pageUrl } });
      const fail = () =>
        webView().props.onHttpError({
          nativeEvent: { url: pageUrl, statusCode: 530 },
        });
      if (order === 'error-before-start') {
        fail();
        start();
      } else {
        start();
        fail();
      }
      webView().props.onLoadEnd({ nativeEvent: { url: pageUrl } });
    });
    await openDiagnostics();
    expect(renderedText(diagnostics())).toContain('HTTP error 530');
    expect(renderedText(diagnostics())).not.toMatch(/\bLoaded\b/);
  },
);

test('Reload commands the existing mounted WebView and receives its next load events', async () => {
  const mountedWebView = webView();
  await openDiagnostics();
  const mountedDiagnostics = diagnostics();
  await press('native-diagnostics-reload-button');
  expect(mockReload).toHaveBeenCalledTimes(1);
  expect(webView()).toBe(mountedWebView);
  expect(diagnostics()).toBe(mountedDiagnostics);
  expect(mockWebViewMounted).toHaveBeenCalledTimes(1);
  expect(mockWebViewUnmounted).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    webView().props.onLoadStart({ nativeEvent: { url: pageUrl } });
    webView().props.onLoadEnd({ nativeEvent: { url: pageUrl } });
  });
  expect(renderedText(diagnostics())).toContain('webview_reload_requested');
  expect(renderedText(diagnostics())).toContain('webview_load_end');
});

test('Clear removes shared history across Back and reopen while retaining newly arriving events', async () => {
  await ReactTestRenderer.act(async () => {
    webView().props.onHttpError({
      nativeEvent: { url: pageUrl, statusCode: 530 },
    });
  });
  await openDiagnostics();
  expect(renderedText(diagnostics())).toContain('webview_http_error');
  await press('native-diagnostics-clear-button');
  expect(
    diagnostics().findAllByProps({ testID: 'native-diagnostics-event' }),
  ).toHaveLength(0);
  expect(renderedText(diagnostics())).toContain('HTTP error 530');
  await backToWebView();
  await openDiagnostics();
  expect(
    diagnostics().findAllByProps({ testID: 'native-diagnostics-event' }),
  ).toHaveLength(0);

  await ReactTestRenderer.act(async () => {
    webView().props.onLoadEnd({ nativeEvent: { url: pageUrl } });
  });
  expect(renderedText(diagnostics())).toContain('webview_load_end');
  expect(renderedText(diagnostics())).not.toContain('webview_http_error');
  expect(mockWebViewMounted).toHaveBeenCalledTimes(1);
});

test.each([
  ['portrait', { top: 24, right: 0, bottom: 48, left: 0 }],
  ['landscape', { top: 0, right: 48, bottom: 0, left: 24 }],
] as const)(
  'keeps the diagnostics touch target inside the %s safe area',
  async (_orientation, insets) => {
    await ReactTestRenderer.act(async () => {
      renderer!.unmount();
    });
    await ReactTestRenderer.act(async () => {
      mockSafeAreaInsets = { ...insets };
      renderer = ReactTestRenderer.create(<App />);
    });
    const button = renderer!.root.findByProps({
      testID: 'mobile-diagnostics-button',
    });
    const style = StyleSheet.flatten(button.props.style);
    expect(style.bottom).toBeGreaterThanOrEqual(insets.bottom + 16);
    // Left side: the website's floating create-post button owns the bottom-right corner.
    expect(style.left).toBeGreaterThanOrEqual(insets.left + 12);
    expect(style.right).toBeUndefined();
    expect(
      Math.max(style.minHeight ?? 0, style.height ?? 0),
    ).toBeGreaterThanOrEqual(44);
    expect(
      Math.max(style.minWidth ?? 0, style.width ?? 0),
    ).toBeGreaterThanOrEqual(44);
  },
);
