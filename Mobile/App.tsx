import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NativeShellNavigator} from './src/navigation/NativeShellNavigator';
import {MangaDockWebViewScreen} from './src/screens/MangaDockWebViewScreen';
import {MobileDiagnosticsProvider} from './src/MobileDiagnosticsProvider';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <MobileDiagnosticsProvider>
        <NativeShellNavigator
          initialRouteName="WebView"
          WebViewComponent={MangaDockWebViewScreen}
        />
      </MobileDiagnosticsProvider>
    </SafeAreaProvider>
  );
}

export {MangaDockWebViewScreen};
export default App;
