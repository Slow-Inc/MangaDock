# MangaDock Mobile

Hybrid mobile shell for MangaDock. The app renders the existing Next.js frontend in `react-native-webview`, while Google/Facebook login runs through the native auth session instead of inside the WebView.

## Bridge Contract

The web app asks native to start OAuth:

```json
{ "type": "mangadock:oauth:start", "provider": "google" }
```

After OAuth completes, native injects the Supabase session back into the WebView:

```json
{
  "type": "mangadock:native-auth:session",
  "access_token": "...",
  "refresh_token": "..."
}
```

The shell also writes the native device id into WebView localStorage as `mangadock_device_id`, so the existing frontend zero-trust header flow can reuse the stable mobile device identity.

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
