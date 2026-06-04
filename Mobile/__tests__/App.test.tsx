/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: {children: React.ReactNode}) => children,
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
}));

jest.mock(
  'react-native-webview',
  () => {
    const {View} = require('react-native');

    return {
      WebView: ({
        source,
        injectedJavaScriptBeforeContentLoaded,
      }: {
        source: {uri: string; headers?: Record<string, string>};
        injectedJavaScriptBeforeContentLoaded?: string;
      }) => (
        <View
          testID="mobile-shell-webview"
          source={source}
          injectedJavaScriptBeforeContentLoaded={
            injectedJavaScriptBeforeContentLoaded
          }
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
