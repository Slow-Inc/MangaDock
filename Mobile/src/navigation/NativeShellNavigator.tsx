import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Pressable, StyleSheet, Text, View} from 'react-native';
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
  initialRouteName?: NativeShellRouteName;
  lastKnownReaderPath?: string;
  WebViewComponent?: React.ComponentType<
    NativeStackScreenProps<NativeShellStackParamList, 'WebView'>
  >;
};

const Stack = createNativeStackNavigator<NativeShellStackParamList>();

function PlaceholderScreen({
  label,
  testID,
}: {
  label: string;
  testID: string;
}) {
  return (
    <View
      style={{
        ...styles.screen,
        backgroundColor: mobileTheme.colors.background,
        padding: mobileTheme.spacing.safeScreenPadding,
      }}
      testID={testID}
    >
      <Text style={styles.title}>{label}</Text>
    </View>
  );
}

function OnboardingScreen({
  navigation,
}: NativeStackScreenProps<NativeShellStackParamList, 'Onboarding'>) {
  return (
    <View
      style={{
        ...styles.screen,
        backgroundColor: mobileTheme.colors.background,
        padding: mobileTheme.spacing.safeScreenPadding,
      }}
      testID="native-onboarding-screen"
    >
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
    <View
      style={{
        ...styles.screen,
        backgroundColor: mobileTheme.colors.background,
        padding: mobileTheme.spacing.safeScreenPadding,
      }}
      testID="native-shell-home-screen"
    >
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
    <View
      style={{
        ...styles.screen,
        backgroundColor: mobileTheme.colors.background,
        padding: mobileTheme.spacing.safeScreenPadding,
      }}
      testID="mangadock-webview-screen"
    >
      <Text style={styles.title}>MangaDock WebView Screen</Text>
      <Text style={styles.body}>{route.params?.initialPath ?? '/'}</Text>
    </View>
  );
}

function DiagnosticsScreen() {
  return (
    <PlaceholderScreen
      label="Native Diagnostics"
      testID="native-diagnostics-screen"
    />
  );
}

function SettingsScreen() {
  return (
    <PlaceholderScreen
      label="Native Settings"
      testID="native-settings-screen"
    />
  );
}

export function NativeShellNavigator({
  initialRouteName = 'WebView',
  lastKnownReaderPath,
  WebViewComponent = PlaceholderWebViewScreen,
}: NativeShellNavigatorProps) {
  const HomeComponent = React.useMemo(
    () => createHomeScreen(lastKnownReaderPath),
    [lastKnownReaderPath],
  );

  return (
    <View style={styles.container} testID="native-shell-router">
      <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRouteName}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Home" component={HomeComponent} />
        <Stack.Screen name="WebView" component={WebViewComponent} />
        <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: mobileTheme.colors.foreground,
    fontSize: mobileTheme.typography.titleSize,
    fontWeight: '700',
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
});
