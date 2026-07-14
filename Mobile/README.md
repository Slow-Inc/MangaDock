# MangaDock Mobile

Hybrid mobile shell for MangaDock. The app renders the existing Next.js frontend in `react-native-webview`, while Google/Facebook login runs through the native auth session instead of inside the WebView.

## Bridge Contract

The web app asks native to start OAuth:

```json
{ "type": "mangadock:oauth:start", "provider": "google", "requestId": "one-time-nonce" }
```

After OAuth completes, native injects the Supabase session back into the WebView:

```json
{
  "type": "mangadock:native-auth:session",
  "requestId": "one-time-nonce",
  "access_token": "...",
  "refresh_token": "..."
}
```

The shell also writes the native device id into WebView localStorage as `mangadock_device_id`, so the existing frontend zero-trust header flow can reuse the stable mobile device identity.

OAuth and permission messages are defined once in `Mobile/shared/mobileBridge.ts` and imported by both the frontend and mobile shell.

The web app can request photo-library access when an upload flow needs it:

```json
{
  "type": "mangadock:permission:request",
  "permission": "media-library",
  "requestId": "upload-1"
}
```

Native responds with `granted`, `denied`, or `blocked`. A blocked result also offers a shortcut to the system settings. Network access is declared at install time through Android's `INTERNET` permission and does not require a runtime prompt.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env`:

```bash
cp .env.example .env
```

3. Set the web URL:

```env
# Android emulator
EXPO_PUBLIC_WEB_URL=http://10.0.2.2:4000

# Physical device on the same Wi-Fi
EXPO_PUBLIC_WEB_URL=http://<your-lan-ip>:4000
```

4. Set Supabase:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

5. Add this redirect URL in Supabase Auth URL configuration:

```text
mangadock://auth/callback
```

6. Validate the build environment:

```bash
npm run validate:env
```

## Run

Start the web app first from `Frontend/`, then run:

```bash
npm run android
```

The custom `mangadock://` scheme requires a development build or native build. Expo Go is not enough for the final OAuth redirect test.

On Windows machines using a Thai/Buddhist-calendar locale, Gradle resource merging can fail while packing zip timestamps. Run Android builds with:

```powershell
$env:JAVA_TOOL_OPTIONS = "-Duser.language=en -Duser.country=US"
```

## EAS Build

Run `eas init` once to assign the Expo project ID, then store the three `EXPO_PUBLIC_*` values as EAS environment variables. Build an installable test APK with:

```bash
eas build --platform android --profile preview
```

The `production` profile creates an Android App Bundle (`.aab`) for Play Console submission. Signing credentials and provider secrets must remain in EAS/Expo or the platform consoles, never in this repository.

Before a release, verify Google and Facebook login on a physical Android device, including cancellation, expired-session recovery, logout, and app relaunch.
