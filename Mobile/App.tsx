import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NativeShellNavigator} from './src/navigation/NativeShellNavigator';
import {MangaDockWebViewScreen} from './src/screens/MangaDockWebViewScreen';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NativeShellNavigator
        initialRouteName="WebView"
        WebViewComponent={MangaDockWebViewScreen}
      />
    </SafeAreaProvider>
  );
}

export {MangaDockWebViewScreen};
export default App;
