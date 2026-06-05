import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {createMobileDiagnosticsEvent} from '../src/mobileDiagnostics';
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

  it('shows Native Diagnostics with masked identity, WebView health, and latest events', async () => {
    const reloadWebView = jest.fn();
    const diagnosticsEvents = Array.from({length: 25}, (_, index) =>
      createMobileDiagnosticsEvent(
        {
          type: 'webview_load_end',
          sequence: index + 1,
          url: `https://hayateotsu.space/page-${String(index + 1).padStart(2, '0')}`,
        },
        () => `2026-06-05T00:00:${String(index).padStart(2, '0')}.000Z`,
      ),
    );
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <NativeShellNavigator
          diagnosticsEvents={diagnosticsEvents}
          diagnosticsHardwareId="11111111-2222-4333-8444-555555555555"
          endpointMode="Production"
          initialRouteName="Diagnostics"
          onReloadWebView={reloadWebView}
          webViewHealth="Loaded"
        />,
      );
    });

    expect(
      renderer!.root.findByProps({testID: 'native-diagnostics-screen'}),
    ).toBeTruthy();
    expect(renderer!.root.findAll(node => node.children.includes('1.0.1-beta.3')).length).toBeGreaterThan(0);
    expect(renderer!.root.findAll(node => node.children.includes('Production')).length).toBeGreaterThan(0);
    expect(renderer!.root.findAll(node => node.children.includes('Loaded')).length).toBeGreaterThan(0);
    expect(renderer!.root.findAll(node => node.children.includes('11111111...5555')).length).toBeGreaterThan(0);
    expect(
      renderer!.root.findAll(node =>
        node.children.some(child => String(child).includes('page-25')),
      ).length,
    ).toBeGreaterThan(0);
    expect(
      renderer!.root.findAll(node =>
        node.children.some(child => String(child).includes('page-01')),
      ).length,
    ).toBe(0);

    await ReactTestRenderer.act(async () => {
      renderer!.root
        .findByProps({testID: 'native-diagnostics-reload-button'})
        .props.onPress();
    });
    expect(reloadWebView).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(async () => {
      renderer!.root
        .findByProps({testID: 'native-diagnostics-clear-button'})
        .props.onPress();
    });
    expect(
      renderer!.root.findAll(node =>
        node.children.some(child => String(child).includes('page-25')),
      ).length,
    ).toBe(0);
  });

  it('lets QA switch beta endpoint mode and reset to production from Native Settings', async () => {
    const resetOnboarding = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <NativeShellNavigator
          initialRouteName="Settings"
          onResetOnboarding={resetOnboarding}
        />,
      );
    });

    expect(
      renderer!.root.findByProps({testID: 'native-settings-screen'}),
    ).toBeTruthy();
    expect(renderer!.root.findAll(node => node.children.includes('1.0.1-beta.3')).length).toBeGreaterThan(0);
    expect(renderer!.root.findAll(node => node.children.includes('production')).length).toBeGreaterThan(0);
    expect(renderer!.root.findAll(node => node.children.includes('https://hayateotsu.space')).length).toBeGreaterThan(0);

    await ReactTestRenderer.act(async () => {
      renderer!.root
        .findByProps({testID: 'native-settings-endpoint-local-button'})
        .props.onPress();
    });

    expect(renderer!.root.findAll(node => node.children.includes('localEmulator')).length).toBeGreaterThan(0);
    expect(renderer!.root.findAll(node => node.children.includes('http://10.0.2.2:4000')).length).toBeGreaterThan(0);
    expect(
      renderer!.root.findAll(node =>
        node.children.some(child =>
          String(child).includes('non-production endpoint'),
        ),
      ).length,
    ).toBeGreaterThan(0);

    await ReactTestRenderer.act(async () => {
      renderer!.root
        .findByProps({testID: 'native-settings-reset-production-button'})
        .props.onPress();
    });

    expect(renderer!.root.findAll(node => node.children.includes('production')).length).toBeGreaterThan(0);
    expect(renderer!.root.findAll(node => node.children.includes('https://hayateotsu.space')).length).toBeGreaterThan(0);

    await ReactTestRenderer.act(async () => {
      renderer!.root
        .findByProps({testID: 'native-settings-view-onboarding-button'})
        .props.onPress();
    });

    expect(
      renderer!.root.findByProps({testID: 'native-onboarding-screen'}),
    ).toBeTruthy();

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <NativeShellNavigator
          initialRouteName="Settings"
          onResetOnboarding={resetOnboarding}
        />,
      );
    });

    await ReactTestRenderer.act(async () => {
      renderer!.root
        .findByProps({testID: 'native-settings-reset-onboarding-button'})
        .props.onPress();
    });

    expect(resetOnboarding).toHaveBeenCalledTimes(1);
  });

  it('locks Native Settings endpoint controls outside beta builds', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <NativeShellNavigator
          initialRouteName="Settings"
          isBetaEndpointModeEnabled={false}
        />,
      );
    });

    expect(renderer!.root.findAll(node => node.children.includes('production')).length).toBeGreaterThan(0);
    expect(renderer!.root.findAll(node => node.children.includes('Endpoint locked to production')).length).toBeGreaterThan(0);
    expect(
      renderer!.root.findAllByProps({
        testID: 'native-settings-endpoint-local-button',
      }),
    ).toHaveLength(0);
  });
});
