# MangaDock Mobile Shell

Android-first React Native CLI shell for MangaDock. The native layer is intentionally thin: it opens the existing MangaDock web app inside `react-native-webview`.

## Current Scope

- Android only.
- Uses React Native CLI, not Expo.
- Loads the production Frontend by default: `https://hayateotsu.space`.
- Keeps Supabase auth, routing, reader UI, and content rendering inside the web app.
- Includes `react-native-webview` and `react-native-safe-area-context`.
- Generates an app-scoped persistent Mobile Hardware ID.
- Injects `x-hardware-id` and `x-manga-dock-client` into the initial WebView request.
- Seeds the same Mobile Hardware ID into the web app's `mangadock_device_id` localStorage key.
- Wraps WebView `fetch` calls to attach Mobile Shell headers to MangaDock API requests.
- Includes a beta diagnostics overlay and `MangaDockMobile` logcat events for QA triage.
- Bridges web `window.onerror`, `window.onunhandledrejection`, and `console.error` events back into native diagnostics.
- Does not include iOS artifacts.

Follow-up issue ownership:

- Issue #91: persistent Mobile Hardware ID and Mobile Header Injection. Implemented in the Mobile Shell.
- Issue #92: protected content flow verification from the Mobile Shell. Verified with deterministic bridge tests and production proxy smoke; full user-auth protected reader QA remains a manual QA path.

## App URL Config

The default URL lives in:

```text
Mobile/src/config.ts
```

Current default:

```ts
const DEFAULT_MOBILE_SHELL_URL = 'https://hayateotsu.space';
```

Tests that assert this default:

```text
Mobile/__tests__/config.test.ts
Mobile/__tests__/App.test.tsx
```

Mobile identity and header modules:

```text
Mobile/src/mobileIdentity.ts
Mobile/src/mobileHeaders.ts
Mobile/src/mobileDiagnostics.ts
Mobile/src/webViewBridge.ts
```

Tests:

```text
Mobile/__tests__/mobileIdentity.test.ts
Mobile/__tests__/mobileHeaders.test.ts
Mobile/__tests__/mobileDiagnostics.test.ts
Mobile/__tests__/webViewBridge.test.ts
```

For local emulator development, the historical URL is:

```text
http://10.0.2.2:4000
```

`10.0.2.2` is the Android emulator alias for the host machine. Use it only when running `Frontend/` locally on port `4000`.

## Prerequisites

- Node.js `>= 22.11.0`
- Java from Android Studio JBR:

```text
C:\Program Files\Android\Android Studio\jbr
```

- Android SDK, including:

```text
platform-tools
platforms;android-36
build-tools;36.0.0
ndk;27.1.12297006
```

- Local Android SDK config:

```text
Mobile/android/local.properties
```

Example:

```properties
sdk.dir=C\:\\Users\\Cable\\AppData\\Local\\Android\\Sdk
```

`Mobile/android/local.properties` is ignored by git.

## Install

From `Mobile/`:

```powershell
npm install
```

`postinstall` runs `patch-package`. This applies:

```text
Mobile/patches/@react-native+gradle-plugin+0.85.3.patch
```

The patch updates `org.gradle.toolchains.foojay-resolver-convention` from `0.5.0` to `1.0.0` for compatibility with `gradle-9.3.1-bin.zip`.

Without the patch, Android builds can fail with:

```text
Class org.gradle.jvm.toolchain.JvmVendorSpec does not have member field 'org.gradle.jvm.toolchain.JvmVendorSpec IBM_SEMERU'
```

## Common Commands

From `Mobile/`:

```powershell
npm start
npm run android
npm test -- --runInBand
npm run lint
npx tsc --noEmit
```

From `Mobile/android`:

```powershell
.\gradlew.bat assembleDebug
.\gradlew.bat assembleRelease
```

Use this environment in the current PowerShell session when Gradle cannot find Java or Android SDK:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\Cable\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT='C:\Users\Cable\AppData\Local\Android\Sdk'
$env:PATH="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:PATH"
```

## Run on Android Emulator

Start an existing emulator:

```powershell
C:\Users\Cable\AppData\Local\Android\Sdk\emulator\emulator.exe -avd MangaDock_API_36
```

Confirm it is connected:

```powershell
C:\Users\Cable\AppData\Local\Android\Sdk\platform-tools\adb.exe devices
```

Expected:

```text
emulator-5554	device
```

Run the app with Metro:

```powershell
cd C:\Users\Cable\Documents\code\MangaDock\Mobile
npm start
```

In another PowerShell:

```powershell
cd C:\Users\Cable\Documents\code\MangaDock\Mobile
npx react-native run-android --no-packager --port 8081
```

Expected result:

```text
BUILD SUCCESSFUL
Installed on 1 device.
Starting: Intent { act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] cmp=com.mobile/.MainActivity }
```

## QA Beta APK

Current QA beta version:

```text
versionCode 3
versionName 1.0.1-beta.2
```

For initial QA, build a release APK that bundles JS:

```powershell
cd C:\Users\Cable\Documents\code\MangaDock\Mobile\android

$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\Cable\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT='C:\Users\Cable\AppData\Local\Android\Sdk'
$env:PATH="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:PATH"

.\gradlew.bat assembleRelease
```

Release APK output:

```text
Mobile/android/app/build/outputs/apk/release/app-release.apk
```

QA copy used in this repo:

```text
Mobile/build/qa/mangadock-beta-release-prod-domain.apk
```

Install QA APK on a connected Android device/emulator:

```powershell
C:\Users\Cable\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r C:\Users\Cable\Documents\code\MangaDock\Mobile\build\qa\mangadock-beta-release-prod-domain.apk
```

Launch:

```powershell
C:\Users\Cable\AppData\Local\Android\Sdk\platform-tools\adb.exe shell am start -n com.mobile/.MainActivity
```

This beta APK is signed with the scaffold release signing config, which currently uses the debug keystore. It is suitable for direct QA install, not Play Store distribution.

## QA Diagnostics

Diagnostics are enabled in the beta build through:

```text
Mobile/src/config.ts
```

Current flags:

```ts
export const MOBILE_DIAGNOSTICS_ENABLED = true;
export const MOBILE_BETA_VERSION_CODE = 3;
export const MOBILE_BETA_VERSION_NAME = '1.0.1-beta.2';
```

The app shows a small `[diag]` button over the WebView. Tap it to open the diagnostics panel.

The panel shows:

- Current beta version.
- Latest in-memory diagnostics events, capped at 20.
- `Reload WebView`, which reloads only the WebView. It does not clear app data, cookies, cache, or login state.

Native logcat output uses this prefix:

```text
MangaDockMobile
```

Capture diagnostics while reproducing a bug:

```powershell
C:\Users\Cable\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat -c
C:\Users\Cable\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat | Select-String -Pattern 'MangaDockMobile|ReactNativeJS|chromium|ERR_|FATAL|Exception'
```

After reproducing, save the recent buffer:

```powershell
C:\Users\Cable\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat -d -t 1000 | Select-String -Pattern 'MangaDockMobile|ReactNativeJS|chromium|ERR_|FATAL|Exception'
```

Diagnostics events mask the full Mobile Hardware ID. Example:

```text
"hardwareId":"11111111...5555"
```

Expected diagnostics event examples:

```text
webview_load_start
webview_load_end
webview_http_error
webview_error
web_console_error
web_js_error
web_unhandled_rejection
webview_reload_requested
```

## QA Bug Report Template

Use this template when reporting beta APK bugs:

```text
Title:

APK:
versionCode 3
versionName 1.0.1-beta.2

Device:
Android version:
Emulator or physical device:
Network: Wi-Fi / mobile data / VPN / proxy:

Account state:
Logged in: yes/no
QA account:

Steps to reproduce:
1.
2.
3.

Expected result:

Actual result:

Frequency:
Always / sometimes / once

Diagnostics overlay:
Last visible event:
HTTP status code, if shown:
Tapped Reload WebView: yes/no
Result after Reload WebView:

Logcat:
Paste lines containing MangaDockMobile, ReactNativeJS, chromium, ERR_, FATAL, or Exception.

Screenshots or screen recording:

Notes:
```

## Verification Checklist

Before handing an APK to QA:

```powershell
cd C:\Users\Cable\Documents\code\MangaDock\Mobile
npm test -- --runInBand
npm run lint
npx tsc --noEmit
```

Expected test coverage:

```text
Mobile Hardware ID creates and persists an app-scoped UUID.
Mobile Hardware ID reuses the persisted UUID on later calls.
Mobile Header Injection prepares x-hardware-id and x-manga-dock-client.
Mobile Shell WebView bridge seeds mangadock_device_id and injects Mobile Shell headers into protected fetches.
Mobile diagnostics formats compact QA logs without exposing the full hardware ID.
Mobile diagnostics keeps only the latest 20 diagnostics events in memory.
Mobile Shell WebView bridge bridges web JavaScript errors to the Mobile Shell.
App renders the WebView with Mobile Shell headers.
App exposes beta diagnostics and logs WebView load events for QA.
App records bridged web JavaScript errors from the WebView.
```

Then:

```powershell
cd C:\Users\Cable\Documents\code\MangaDock\Mobile\android
.\gradlew.bat assembleRelease
```

Install the APK and verify:

- App launches as `com.mobile/.MainActivity`.
- WebView loads `https://hayateotsu.space`.
- `[diag]` button appears over the WebView.
- `[diag]` panel shows `1.0.1-beta.2 (3)`.
- `Reload WebView` reloads the WebView without clearing app data.
- WebView initial request includes `x-hardware-id`.
- WebView initial request includes `x-manga-dock-client`.
- WebView `fetch` requests to MangaDock API paths include `x-hardware-id`.
- WebView `fetch` requests to MangaDock API paths include `x-manga-dock-client`.
- MangaDock home page renders.
- Search opens.
- Login button opens web auth inside the WebView.
- Bottom navigation renders.
- No fatal errors appear in `adb logcat`.
- `MangaDockMobile` diagnostics events appear in `adb logcat`.

Useful smoke command:

```powershell
C:\Users\Cable\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat -d -t 500 | Select-String -Pattern 'hayateotsu|ReactNativeJS|chromium|ERR_|FATAL|Exception'
```

Expected evidence:

```text
source: https://hayateotsu.space/_next/static/chunks/...
```

Protected route smoke used during implementation:

```powershell
Invoke-WebRequest -Uri 'https://hayateotsu.space/api/proxy/books/translate/mit-health' -Headers @{ 'x-hardware-id'='11111111-2222-4333-8444-555555555555'; 'x-manga-dock-client'='android-mobile-shell' } -UseBasicParsing -TimeoutSec 20
```

Expected result from this route class:

```text
StatusCode=200
```

The same proxy route also returned `StatusCode=200` without explicit shell headers in the deployed environment, so this smoke proves the route no longer returns `Missing hardware ID`; the deterministic `webViewBridge` test proves Mobile Shell protected fetches carry the native headers.

## Local Frontend Development Mode

Use local mode when testing changes in `Frontend/` before deployment.

Start Frontend:

```powershell
cd C:\Users\Cable\Documents\code\MangaDock\Frontend
npm run dev
```

Frontend local URL:

```text
http://localhost:4000
```

Android emulator URL:

```text
http://10.0.2.2:4000
```

To use local mode, temporarily change `DEFAULT_MOBILE_SHELL_URL` in:

```text
Mobile/src/config.ts
```

from:

```ts
const DEFAULT_MOBILE_SHELL_URL = 'https://hayateotsu.space';
```

to:

```ts
const DEFAULT_MOBILE_SHELL_URL = 'http://10.0.2.2:4000';
```

Then update tests in:

```text
Mobile/__tests__/config.test.ts
Mobile/__tests__/App.test.tsx
```

Run:

```powershell
npm test -- --runInBand
npm run lint
npx tsc --noEmit
npx react-native run-android --no-packager --port 8081
```

## Known Limits

- The current beta is a WebView shell only.
- Protected content identity is native-aware through the Mobile Shell Hardware ID and WebView bridge.
- Full authenticated reader QA should still be repeated manually on a QA account.
- Production backend is expected at `https://api.hayateotsu.space` through the web app.
- Play Store-ready signing is not configured yet.
