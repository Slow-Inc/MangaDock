import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {MOBILE_BETA_SESSION_ONBOARDING_ENABLED} from './src/config';
import {NativeShellNavigator} from './src/navigation/NativeShellNavigator';
import {getNativeShellInitialRoute} from './src/onboarding/mobileOnboarding';
import {MangaDockWebViewScreen} from './src/screens/MangaDockWebViewScreen';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NativeShellNavigator
        initialRouteName={getNativeShellInitialRoute({
          isBeta: MOBILE_BETA_SESSION_ONBOARDING_ENABLED,
          sessionCompleted: false,
          persistedCompleted: false,
        })}
        WebViewComponent={MangaDockWebViewScreen}
      />
    </SafeAreaProvider>
  );
}

export {MangaDockWebViewScreen};
export default App;
