# Test PR #713 locally on Android

This frontend and its CLI OAuth bridge do not require Vercel. Run the PR branch
on the development computer and point the QA APK at that server. Vercel's
automatic deployment may still exist, but it is not used by this procedure.

## 1. Start the matching frontend

Check out `fix/cli-native-auth-compat-20261001`, then in `Frontend`:

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
```

If `.env.local` already exists, edit it rather than overwriting it. Set
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the same project
used by the app. Use a public anon/publishable client key, never a service-role
key. For profile/API QA against the existing remote backend, set:

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://api.hayateotsu.space
INTERNAL_API_URL=https://api.hayateotsu.space
```

Alternatively start the matching local backend on port 4001 and retain the
localhost backend values from the example. Backend availability is separate
from the direct Supabase OAuth code exchange.

```powershell
npm.cmd run dev
```

The existing dev command listens on port 4000. Keep this terminal running.

## 2. Connect the emulator to the server

In another PowerShell terminal:

```powershell
$adb = "$env:LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
& $adb -s emulator-5554 reverse tcp:4000 tcp:4000
& $adb -s emulator-5554 reverse --list
```

Use **`http://localhost:4000` in the QA APK**. Loopback is treated as a secure
context, allowing the Web Crypto APIs used by PKCE. Plain HTTP on `10.0.2.2` or
a LAN IP may load the page but does not provide the same secure-context guarantee.
ADB reverse must be recreated after device/emulator restarts.

## 3. Use the correct mobile shell

The installed `com.mobile` APK is the React Native CLI shell from companion
PR #711, not the Expo `Mobile` directory in the main/frontend branch.

In that CLI checkout, set `DEFAULT_MOBILE_SHELL_URL` in `Mobile/src/config.ts`
to `http://localhost:4000` for this QA build, then build/install the QA APK.
Keep the normal production URL in committed source and restore it after building.
Verify the QA manifest permits local HTTP traffic.

The CLI native OAuth handler must use a URL parser that supports custom schemes
(`mangadock://auth/callback`), such as the explicit URL ponyfill correction in
PR #711. Installing the old APK alone does not fix its custom-scheme parsing.

If separately testing the Expo shell, set `EXPO_PUBLIC_WEB_URL` in `Mobile/.env`
to `http://localhost:4000`, supply its public Supabase configuration and rebuild
that app. This exercises Expo's existing protocol rather than the CLI adapter.

## 4. Allow the callback in Supabase

In the app's Supabase project, Authentication → URL Configuration → Redirect
URLs must accept `mangadock://auth/callback**` including its changing request ID.
The CLI callback remains this deep link even when the frontend runs locally.
Do not replace the mobile callback with a localhost web callback.

The observed project is `eqgcnoljbiwosecydjqd`. Earlier cancellation probes for
Google and Facebook returned localhost instead of the requested deep link;
verify this setting before claiming successful callback QA.

## 5. Acceptance checks

- The WebView loads this PR's frontend from localhost, without a Vercel login gate.
- In WebView development tools, verify `window.isSecureContext`,
  `typeof crypto.randomUUID === 'function'`, and that `crypto.subtle` exists.
- Google/Facebook clicks call the CLI `startOAuth` bridge and open the browser.
- Provider completion returns to the intended app with the matching request ID.
- The WebView finishes login, loads the account and retains the session on reopen.
- Cancel, deny permission and retry: the waiting state clears and late callbacks
  do not sign in a cancelled request.

Two apps currently claim the callback scheme on the emulator. Choose `Mobile`
for CLI QA if Android shows a chooser. Avoid editing frontend files during a
login: HMR/full reload can discard the in-memory pending request.

Local serving removes the Vercel access gate; it does not replace native callback
fixes, Supabase configuration or real provider acceptance testing.

References: [Supabase redirects](https://supabase.com/docs/guides/auth/redirect-urls)
and [secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).
