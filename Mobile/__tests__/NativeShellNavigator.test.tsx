import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {NativeShellNavigator} from '../src/navigation/NativeShellNavigator';
import {mobileTheme} from '../src/theme/mobileTheme';

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

  it('uses the MangaDock native theme on placeholder screens', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <NativeShellNavigator initialRouteName="Home" />,
      );
    });

    const screen = renderer!.root
      .findAllByProps({testID: 'native-shell-home-screen'})
      .find(node => node.props.style);

    expect(screen?.props.style).toEqual(
      expect.objectContaining({
        backgroundColor: mobileTheme.colors.background,
        padding: mobileTheme.spacing.safeScreenPadding,
      }),
    );
  });

  it('routes from Native Onboarding to Native Shell Home when onboarding is completed', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <NativeShellNavigator initialRouteName="Onboarding" />,
      );
    });

    const startButton = renderer!.root.findByProps({
      testID: 'native-onboarding-start-button',
    });

    await ReactTestRenderer.act(async () => {
      startButton.props.onPress();
    });

    expect(
      renderer!.root.findByProps({testID: 'native-shell-home-screen'}),
    ).toBeTruthy();
  });

  it('launches MangaDock WebView from Native Shell Home', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <NativeShellNavigator initialRouteName="Home" />,
      );
    });

    const openButton = renderer!.root.findByProps({
      testID: 'native-home-open-mangadock-button',
    });

    await ReactTestRenderer.act(async () => {
      openButton.props.onPress();
    });

    expect(
      renderer!.root.findByProps({testID: 'mangadock-webview-screen'}),
    ).toBeTruthy();
    expect(
      renderer!.root.findAll(node => node.children.includes('/')).length,
    ).toBeGreaterThan(0);
  });

  it.each([
    ['native-home-search-button', '/search'],
    ['native-home-library-button', '/mylist'],
    ['native-home-studio-button', '/studio'],
    ['native-home-community-button', '/community'],
  ] as const)('launches %s to %s', async (buttonTestID, expectedPath) => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <NativeShellNavigator initialRouteName="Home" />,
      );
    });

    const button = renderer!.root.findByProps({testID: buttonTestID});

    await ReactTestRenderer.act(async () => {
      button.props.onPress();
    });

    expect(
      renderer!.root.findAll(node => node.children.includes(expectedPath))
        .length,
    ).toBeGreaterThan(0);
  });

  it('launches Continue reading with Last Known Reader Path', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <NativeShellNavigator
          initialRouteName="Home"
          lastKnownReaderPath="/book/demo/chapter/1"
        />,
      );
    });

    const button = renderer!.root.findByProps({
      testID: 'native-home-continue-reading-button',
    });

    await ReactTestRenderer.act(async () => {
      button.props.onPress();
    });

    expect(
      renderer!.root.findAll(node =>
        node.children.includes('/book/demo/chapter/1'),
      ).length,
    ).toBeGreaterThan(0);
  });
});
