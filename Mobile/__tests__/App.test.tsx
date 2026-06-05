/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => {
  const ReactMock = require('react');

  return {
    SafeAreaProvider: ({children}: {children: React.ReactNode}) => children,
    SafeAreaView: ({children}: {children: React.ReactNode}) => children,
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
    useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
    useSafeAreaFrame: () => ({x: 0, y: 0, width: 390, height: 844}),
  };
});

jest.mock(
  'react-native-webview',
  () => {
    const {View} = require('react-native');

    return {
      WebView: (props: {
        source: {uri: string; headers?: Record<string, string>};
        injectedJavaScriptBeforeContentLoaded?: string;
      }) => (
        <View
          testID="mobile-shell-webview"
          {...props}
        />
      ),
    };
  },
  {virtual: true},
);

jest.mock('../src/mobileIdentity', () => ({
  getMobileHardwareId: jest
    .fn()
    .mockResolvedValue('11111111-2222-4333-8444-555555555555'),
}));

import App from '../App';
import {MangaDockWebViewScreen} from '../src/screens/MangaDockWebViewScreen';

test('starts beta sessions at Native Onboarding inside the Native Shell Router', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(
    renderer!.root.findByProps({testID: 'native-shell-router'}),
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({testID: 'native-onboarding-screen'}),
  ).toBeTruthy();
});

test('renders the Frontend inside the Mobile Shell WebView with Mobile Shell headers', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<MangaDockWebViewScreen />);
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

test('renders a launched MangaDock web path inside the Mobile Shell WebView', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MangaDockWebViewScreen
        route={{
          key: 'WebView',
          name: 'WebView',
          params: {initialPath: '/search'},
        }}
      />,
    );
  });

  const webview = renderer!.root.findByProps({
    testID: 'mobile-shell-webview',
  });

  expect(webview.props.source.uri).toBe('https://hayateotsu.space/search');
});

test('exposes beta diagnostics and logs WebView load events for QA', async () => {
  const consoleLog = jest.spyOn(console, 'log').mockImplementation();
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<MangaDockWebViewScreen />);
  });

  expect(
    renderer!.root.findByProps({testID: 'mobile-diagnostics-button'}),
  ).toBeTruthy();

  const webview = renderer!.root.findByProps({
    testID: 'mobile-shell-webview',
  });

  ReactTestRenderer.act(() => {
    webview.props.onLoadStart({
      nativeEvent: {url: 'https://hayateotsu.space/library'},
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

test('opens Native Diagnostics from the beta WebView diagnostics shortcut', async () => {
  const navigate = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <MangaDockWebViewScreen navigation={{navigate} as never} />,
    );
  });

  const diagnosticsButton = renderer!.root.findByProps({
    testID: 'mobile-diagnostics-button',
  });

  await ReactTestRenderer.act(async () => {
    diagnosticsButton.props.onPress();
  });

  expect(navigate).toHaveBeenCalledWith('Diagnostics');
  expect(
    renderer!.root.findAllByProps({
      testID: 'mobile-diagnostics-reload-button',
    }),
  ).toHaveLength(0);
});

test('records bridged web JavaScript errors from the WebView', async () => {
  const consoleLog = jest.spyOn(console, 'log').mockImplementation();
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<MangaDockWebViewScreen />);
  });

  const webview = renderer!.root.findByProps({
    testID: 'mobile-shell-webview',
  });

  ReactTestRenderer.act(() => {
    webview.props.onMessage({
      nativeEvent: {
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
