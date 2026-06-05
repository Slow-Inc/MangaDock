import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {StyleSheet, Text, View} from 'react-native';
import {mobileTheme} from '../theme/mobileTheme';

export type NativeShellRouteName =
  | 'Onboarding'
  | 'Home'
  | 'WebView'
  | 'Diagnostics'
  | 'Settings';

export type NativeShellStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  WebView: undefined;
  Diagnostics: undefined;
  Settings: undefined;
};

type NativeShellNavigatorProps = {
  initialRouteName?: NativeShellRouteName;
  WebViewComponent?: React.ComponentType;
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

function OnboardingScreen() {
  return (
    <PlaceholderScreen
      label="Native Onboarding"
      testID="native-onboarding-screen"
    />
  );
}

function HomeScreen() {
  return (
    <PlaceholderScreen
      label="Native Shell Home"
      testID="native-shell-home-screen"
    />
  );
}

function PlaceholderWebViewScreen() {
  return (
    <PlaceholderScreen
      label="MangaDock WebView Screen"
      testID="mangadock-webview-screen"
    />
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
  WebViewComponent = PlaceholderWebViewScreen,
}: NativeShellNavigatorProps) {
  return (
    <View style={styles.container} testID="native-shell-router">
      <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRouteName}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
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
});
