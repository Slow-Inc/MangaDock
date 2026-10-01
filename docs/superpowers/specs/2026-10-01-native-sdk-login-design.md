# Android native SDK login — design for review

Status: user approved; SDK implementation compiled and installed for QA. Real
provider session acceptance remains pending account/provider configuration.

## Outcome

Keep the existing direct WebView Android app and its Supabase account identity.
Google and Facebook buttons invoke provider SDKs through the Android shell, then
return a request-bound Supabase session to the deployed web session handler.
PR #713 remains closed. No Vercel frontend or custom browser PKCE adapter is
required for the native ID-token path.

Scope is the current React Native CLI `com.mobile` APK and emulator. iOS, Expo,
account linking and provider-specific migration of existing users are outside
this implementation. Existing web login stays available for ordinary browsers.

## Options

1. Recommended: implement provider calls in Kotlin behind a React Native module.
   Android already has custom modules; this avoids introducing an Expo shell or
   a second JavaScript auth owner. Use Google Credential Manager and Meta Login SDK.
2. React Native provider wrappers: less Kotlin but adds wrapper compatibility and
   release coordination on top of SDK dependencies.
3. Browser OAuth: existing alternative, but does not meet the native SDK request.

## Request and session ownership

- Only messages from the configured frontend origin may invoke login.
- Accept deployed `mangadock:oauth:start` messages with a supported provider and
  bounded nonempty request ID. Retain at most one active operation.
- Native creates its own nonce; frontend cannot supply an arbitrary audience,
  token endpoint or provider token for native verification.
- Provider tokens are exchanged against the configured Supabase project using
  the public client key and the `id_token` grant. Supabase validates provider
  identity and audience; the app never creates a Supabase JWT itself.
- Native returns access/refresh tokens only for the still-active request.
- Deliver the existing `mangadock:native-auth:session` message with matching
  requestId to the trusted WebView. Existing web AuthContext commits its session,
  including existing MFA/account hydration behavior.
- WebView remains the owner of persisted Supabase session and refresh. Native
  does not add a second persisted Supabase token store.
- Navigation away from the trusted origin, cancellation, timeout and destruction
  invalidate the operation. Late SDK/network completions cannot inject sessions.
- Provider HTTP exchange has a bounded deadline; all errors settle the web
  request with a readable message. Never log provider tokens or session secrets.

## Google

Use Android Credential Manager's explicit Sign in with Google button flow and
Google ID token credential. Generate a fresh random nonce and pass its SHA-256
hex digest to the provider; submit the original nonce to Supabase's ID-token
exchange. Retain nonce verification. Handle user cancellation, absent accounts,
Play Services failure and invalid credential types.

Public Web Client ID was discovered from the existing configured authorize URL.
The same Google Cloud project must register `com.mobile` with the QA signing
certificate SHA-1; Supabase must accept the requested Web Client ID audience.
Production signing will require its corresponding Android registration.

## Facebook

Use Meta SDK LoginConfiguration with an explicit nonce and OIDC/openid request.
Accept its AuthenticationToken ID token only after checking the returned nonce
matches this request. Supabase's Facebook ID-token grant requires an OIDC ID
token; a regular Graph access token is not interchangeable with it.

Actual Android SDK/provider issuance and Supabase acceptance must be verified.
If the SDK returns only an access token, return a clear unsupported-result error;
do not fabricate an ID token, create an unrelated account, or silently bypass
Supabase identity validation. A server-assisted access-token design, if needed,
requires a separately reviewed identity/session exchange.

Configure Meta App ID and public SDK Client Token outside the checkout. Register
Android package, activity and QA key hash in Meta. Do not put App Secret in APK.
Disable optional automatic SDK analytics/advertiser collection for this login
integration. SDK may use its own web fallback when Facebook is not installed;
native SDK does not guarantee every provider UI is an Android account picker.

## Configuration and build

Extend the existing external native auth properties mechanism with public Google
Web Client ID, Facebook App ID and Facebook Client Token. Pin SDK dependency
versions. Missing provider configuration reports an error rather than hanging.
Use existing QA signing, preserve app data, and produce a distinctly named APK.

## Verification

1. Regression coverage for trusted origin, request binding, cancellation, SDK
   failures, timeout, stale completion, missing configuration and session payload.
2. Kotlin compile, Mobile typecheck/lint and existing regressions.
3. APK installation on emulator; Google SDK account UI and cancellation smoke.
4. User completes real Google sign-in; verify WebView signed-in identity, reopen
   persistence, logout and another-account login.
5. Facebook SDK login and real session acceptance, recording whether Meta app or
   SDK web fallback was used. Do not claim both providers passed from mock tests.

## Current dependencies

- Emulator has Google Play Services; Facebook app is not installed.
- Public Google Web Client ID and Facebook App ID are discoverable from existing
  Supabase provider redirects. Facebook SDK Client Token is not in reviewed files.
- Google/Meta Android package and signing registration is not yet verified.
- User approved the written design before SDK implementation.

## Sources

- https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation
- https://raw.githubusercontent.com/facebook/facebook-android-sdk/main/facebook-common/src/main/java/com/facebook/login/LoginConfiguration.kt
- https://raw.githubusercontent.com/facebook/facebook-android-sdk/main/facebook-common/src/main/java/com/facebook/login/LoginManager.kt
- https://raw.githubusercontent.com/supabase/auth/master/internal/api/token_oidc.go
