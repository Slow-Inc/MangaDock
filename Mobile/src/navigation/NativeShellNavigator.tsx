import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {
  MOBILE_BETA_VERSION_CODE,
  MOBILE_BETA_VERSION_NAME,
} from '../config';
import {
  appendMobileDiagnosticsEvent,
  createMobileDiagnosticsEvent,
  maskMobileHardwareId,
  type MobileDiagnosticsEvent,
} from '../mobileDiagnostics';
import {getViewOnboardingRoute} from '../onboarding/mobileOnboarding';
import {
  createEndpointModeState,
  getEndpointWarning,
  resetEndpointModeToProduction,
} from '../settings/mobileSettings';
import {mobileTheme} from '../theme/mobileTheme';
import {
  createWebViewRouteLaunch,
  getContinueReadingPath,
  type WebViewQuickAction,
} from './webViewRouteLaunch';

export type NativeShellRouteName =
  | 'Onboarding'
  | 'Home'
  | 'WebView'
  | 'Diagnostics'
  | 'Settings';

export type NativeShellStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  WebView: {initialPath?: string} | undefined;
  Diagnostics: undefined;
  Settings: undefined;
};

type NativeShellNavigatorProps = {
  diagnosticsEvents?: MobileDiagnosticsEvent[];
  diagnosticsHardwareId?: string;
  endpointMode?: string;
  initialRouteName?: NativeShellRouteName;
  isBetaEndpointModeEnabled?: boolean;
  lastKnownReaderPath?: string;
  onReloadWebView?: () => void;
  onResetOnboarding?: () => void;
  webViewHealth?: string;
  WebViewComponent?: React.ComponentType<
    NativeStackScreenProps<NativeShellStackParamList, 'WebView'>
  >;
};

const Stack = createNativeStackNavigator<NativeShellStackParamList>();

function OnboardingScreen({
  navigation,
}: NativeStackScreenProps<NativeShellStackParamList, 'Onboarding'>) {
  return (
    <View style={styles.screenThemed} testID="native-onboarding-screen">
      <Text style={styles.title}>Native Onboarding</Text>
      <Text style={styles.body}>
        MangaDock beta keeps web reading inside WebView and native controls in
        the shell.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.replace('Home')}
        style={styles.primaryButton}
        testID="native-onboarding-start-button"
      >
        <Text style={styles.primaryButtonText}>Start reading</Text>
      </Pressable>
    </View>
  );
}

function createHomeScreen(lastKnownReaderPath?: string) {
  function HomeScreen({
    navigation,
  }: NativeStackScreenProps<NativeShellStackParamList, 'Home'>) {
    const launchWebView = (action: WebViewQuickAction) => {
      const launch = createWebViewRouteLaunch(action);

      navigation.navigate(launch.screen, launch.params);
    };
    const continueReading = () => {
      navigation.navigate('WebView', {
        initialPath: getContinueReadingPath(lastKnownReaderPath),
      });
    };

    return (
      <View style={styles.screenThemed} testID="native-shell-home-screen">
        <Text style={styles.title}>Native Shell Home</Text>
        <Text style={styles.body}>1.0.1-beta.2 · Production</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => launchWebView('openMangaDock')}
          style={styles.primaryButton}
          testID="native-home-open-mangadock-button"
        >
          <Text style={styles.primaryButtonText}>Open MangaDock</Text>
        </Pressable>
        <View style={styles.quickActions}>
          <Pressable
            accessibilityRole="button"
            onPress={continueReading}
            style={styles.secondaryButton}
            testID="native-home-continue-reading-button"
          >
            <Text style={styles.secondaryButtonText}>Continue reading</Text>
          </Pressable>
          {[
            ['search', 'Search', 'native-home-search-button'],
            ['library', 'Library', 'native-home-library-button'],
            ['studio', 'Studio', 'native-home-studio-button'],
            ['community', 'Community', 'native-home-community-button'],
          ].map(([action, label, testID]) => (
            <Pressable
              accessibilityRole="button"
              key={action}
              onPress={() => launchWebView(action as WebViewQuickAction)}
              style={styles.secondaryButton}
              testID={testID}
            >
              <Text style={styles.secondaryButtonText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return HomeScreen;
}

function PlaceholderWebViewScreen({
  route,
}: NativeStackScreenProps<NativeShellStackParamList, 'WebView'>) {
  return (
    <View style={styles.screenThemed} testID="mangadock-webview-screen">
      <Text style={styles.title}>MangaDock WebView Screen</Text>
      <Text style={styles.body}>{route.params?.initialPath ?? '/'}</Text>
    </View>
  );
}

function createDiagnosticsScreen({
  diagnosticsEvents = [],
  diagnosticsHardwareId,
  endpointMode = 'Production',
  onReloadWebView,
  webViewHealth = 'Unknown',
}: Pick<
  NativeShellNavigatorProps,
  | 'diagnosticsEvents'
  | 'diagnosticsHardwareId'
  | 'endpointMode'
  | 'onReloadWebView'
  | 'webViewHealth'
>) {
  function DiagnosticsScreen() {
    const [events, setEvents] = React.useState(() =>
      diagnosticsEvents.reduce(
        (nextEvents, event) => appendMobileDiagnosticsEvent(nextEvents, event),
        [] as MobileDiagnosticsEvent[],
      ),
    );
    const reloadWebView = () => {
      setEvents(currentEvents =>
        appendMobileDiagnosticsEvent(
          currentEvents,
          createMobileDiagnosticsEvent({
            hardwareId: diagnosticsHardwareId,
            type: 'webview_reload_requested',
          }),
        ),
      );
      onReloadWebView?.();
    };

    return (
      <View
        style={[styles.screenThemed, styles.screenStretch]}
        testID="native-diagnostics-screen"
      >
        <Text style={styles.title}>Native Diagnostics</Text>
        <Text style={styles.body}>{MOBILE_BETA_VERSION_NAME}</Text>
        <Text style={styles.body}>versionCode {MOBILE_BETA_VERSION_CODE}</Text>
        <Text style={styles.body}>{endpointMode}</Text>
        <Text style={styles.body}>{webViewHealth}</Text>
        <Text style={styles.body}>
          {maskMobileHardwareId(diagnosticsHardwareId) ?? 'unknown hardware ID'}
        </Text>
        <View style={styles.quickActions}>
          <Pressable
            accessibilityRole="button"
            onPress={reloadWebView}
            style={styles.primaryButton}
            testID="native-diagnostics-reload-button"
          >
            <Text style={styles.primaryButtonText}>Reload WebView</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setEvents([])}
            style={styles.secondaryButton}
            testID="native-diagnostics-clear-button"
          >
            <Text style={styles.secondaryButtonText}>
              Clear diagnostics events
            </Text>
          </Pressable>
        </View>
        <View style={styles.eventList}>
          {events.map((event, index) => (
            <Text
              key={`${event.at}-${index}`}
              style={styles.eventText}
              testID="native-diagnostics-event"
            >
              {event.type}
              {event.sequence ? ` #${event.sequence}` : ''}
              {event.url ? ` ${event.url}` : ''}
              {event.message ? ` ${event.message}` : ''}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  return DiagnosticsScreen;
}

function createSettingsScreen({
  isBetaEndpointModeEnabled = true,
  onResetOnboarding,
}: Pick<
  NativeShellNavigatorProps,
  'isBetaEndpointModeEnabled' | 'onResetOnboarding'
>) {
  function SettingsScreen({
    navigation,
  }: NativeStackScreenProps<NativeShellStackParamList, 'Settings'>) {
    const [endpointState, setEndpointState] = React.useState(() =>
      createEndpointModeState({
        isBeta: isBetaEndpointModeEnabled,
        mode: 'production',
      }),
    );
    const warning = getEndpointWarning(endpointState);
    const updateEndpointMode = (
      mode: 'production' | 'localEmulator' | 'custom',
    ) => {
      setEndpointState(
        createEndpointModeState({
          customUrl: 'http://192.168.1.25:4000',
          isBeta: isBetaEndpointModeEnabled,
          mode,
        }),
      );
    };

    return (
      <View
        style={[styles.screenThemed, styles.screenStretch]}
        testID="native-settings-screen"
      >
        <Text style={styles.title}>Native Settings</Text>
        <Text style={styles.body}>{MOBILE_BETA_VERSION_NAME}</Text>
        <Text style={styles.body}>versionCode {MOBILE_BETA_VERSION_CODE}</Text>
        <Text style={styles.body}>{endpointState.mode}</Text>
        <Text style={styles.body}>{endpointState.url}</Text>
        {!endpointState.editable ? (
          <Text style={styles.warningText}>Endpoint locked to production</Text>
        ) : null}
        {warning ? <Text style={styles.warningText}>{warning}</Text> : null}
        {endpointState.editable ? (
          <View style={styles.quickActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => updateEndpointMode('production')}
              style={styles.secondaryButton}
              testID="native-settings-endpoint-production-button"
            >
              <Text style={styles.secondaryButtonText}>Production endpoint</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => updateEndpointMode('localEmulator')}
              style={styles.secondaryButton}
              testID="native-settings-endpoint-local-button"
            >
              <Text style={styles.secondaryButtonText}>Local emulator endpoint</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => updateEndpointMode('custom')}
              style={styles.secondaryButton}
              testID="native-settings-endpoint-custom-button"
            >
              <Text style={styles.secondaryButtonText}>Custom LAN endpoint</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setEndpointState(resetEndpointModeToProduction())}
              style={styles.primaryButton}
              testID="native-settings-reset-production-button"
            >
              <Text style={styles.primaryButtonText}>Reset production endpoint</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.quickActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate(getViewOnboardingRoute())}
            style={styles.secondaryButton}
            testID="native-settings-view-onboarding-button"
          >
            <Text style={styles.secondaryButtonText}>View onboarding</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onResetOnboarding}
            style={styles.secondaryButton}
            testID="native-settings-reset-onboarding-button"
          >
            <Text style={styles.secondaryButtonText}>Reset onboarding</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return SettingsScreen;
}

export function NativeShellNavigator({
  diagnosticsEvents,
  diagnosticsHardwareId,
  endpointMode,
  initialRouteName = 'WebView',
  isBetaEndpointModeEnabled,
  lastKnownReaderPath,
  onReloadWebView,
  onResetOnboarding,
  webViewHealth,
  WebViewComponent = PlaceholderWebViewScreen,
}: NativeShellNavigatorProps) {
  const HomeComponent = React.useMemo(
    () => createHomeScreen(lastKnownReaderPath),
    [lastKnownReaderPath],
  );
  const DiagnosticsComponent = React.useMemo(
    () =>
      createDiagnosticsScreen({
        diagnosticsEvents,
        diagnosticsHardwareId,
        endpointMode,
        onReloadWebView,
        webViewHealth,
      }),
    [
      diagnosticsEvents,
      diagnosticsHardwareId,
      endpointMode,
      onReloadWebView,
      webViewHealth,
    ],
  );
  const SettingsComponent = React.useMemo(
    () =>
      createSettingsScreen({
        isBetaEndpointModeEnabled,
        onResetOnboarding,
      }),
    [isBetaEndpointModeEnabled, onResetOnboarding],
  );

  return (
    <View style={styles.container} testID="native-shell-router">
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRouteName}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Home" component={HomeComponent} />
          <Stack.Screen name="WebView" component={WebViewComponent} />
          <Stack.Screen name="Diagnostics" component={DiagnosticsComponent} />
          <Stack.Screen name="Settings" component={SettingsComponent} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenThemed: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mobileTheme.colors.background,
    padding: mobileTheme.spacing.safeScreenPadding,
  },
  screenStretch: {
    alignItems: 'stretch',
  },
  title: {
    color: mobileTheme.colors.foreground,
    fontSize: mobileTheme.typography.titleSize,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    marginTop: mobileTheme.spacing.sm,
    color: mobileTheme.colors.foregroundMuted,
    fontSize: mobileTheme.typography.bodySize,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: mobileTheme.touchTarget.minHeight,
    marginTop: mobileTheme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mobileTheme.radius.md,
    backgroundColor: mobileTheme.colors.primary,
    paddingHorizontal: mobileTheme.spacing.lg,
  },
  primaryButtonText: {
    color: mobileTheme.colors.foreground,
    fontSize: mobileTheme.typography.bodySize,
    fontWeight: '700',
  },
  quickActions: {
    width: '100%',
    gap: mobileTheme.spacing.sm,
    marginTop: mobileTheme.spacing.md,
  },
  secondaryButton: {
    minHeight: mobileTheme.touchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    borderRadius: mobileTheme.radius.md,
    backgroundColor: mobileTheme.colors.surface,
    paddingHorizontal: mobileTheme.spacing.md,
  },
  secondaryButtonText: {
    color: mobileTheme.colors.foreground,
    fontSize: mobileTheme.typography.bodySize,
    fontWeight: '600',
  },
  eventList: {
    gap: mobileTheme.spacing.xs,
    marginTop: mobileTheme.spacing.md,
  },
  eventText: {
    color: mobileTheme.colors.foregroundMuted,
    fontSize: mobileTheme.typography.labelSize,
  },
  warningText: {
    marginTop: mobileTheme.spacing.sm,
    color: mobileTheme.colors.secondary,
    fontSize: mobileTheme.typography.bodySize,
    lineHeight: 20,
    textAlign: 'center',
  },
});
