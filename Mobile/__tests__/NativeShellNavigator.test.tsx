import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {NativeShellNavigator} from '../src/navigation/NativeShellNavigator';

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

describe('Native Shell Router', () => {
  it.each([
    ['Onboarding', 'native-onboarding-screen'],
    ['Home', 'native-shell-home-screen'],
    ['WebView', 'mangadock-webview-screen'],
    ['Diagnostics', 'native-diagnostics-screen'],
    ['Settings', 'native-settings-screen'],
  ] as const)('routes to the %s placeholder', async (routeName, testID) => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <NativeShellNavigator initialRouteName={routeName} />,
      );
    });

    expect(renderer!.root.findByProps({testID})).toBeTruthy();
  });
});
