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
      WebView: ({source}: {source: {uri: string}}) => (
        <View testID="mobile-shell-webview" source={source} />
      ),
    };
  },
  {virtual: true},
);

import App from '../App';

test('renders the Frontend inside the Mobile Shell WebView', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  const webview = renderer!.root.findByProps({
    testID: 'mobile-shell-webview',
  });

  expect(webview.props.source).toEqual({uri: 'http://10.0.2.2:4000'});
});
