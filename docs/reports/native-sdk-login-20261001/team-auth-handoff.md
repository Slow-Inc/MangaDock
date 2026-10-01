# Native SDK authentication: implementation and team handoff

## Scope and delivery state

Google investigation is paused at the user's request. Facebook SDK integration is prepared as far as available public provider configuration permits. Neither provider has passed real-account session acceptance. This is a draft for review and configuration, not a merge-ready authentication claim. PR #713 remains closed and unmerged.

## Implemented

- Google Credential Manager and Meta Android SDK module, request-bound Supabase ID-token exchange, session handoff to deployed WebView, trusted origin checks, stale result rejection, cancellation and deadlines.
- Native provider logout after successful Supabase logout except scope=others.
- Google SDK cancellation wording now covers technical failure and dismissal instead of always claiming user cancellation.
- Numeric Google Play services availability logging and credential-acquired stage marker; no raw provider tokens or session data logged.
- Facebook uses LoginBehavior.WEB_ONLY and explicitly requests public_profile, email, openid. This follows Supabase's Android OIDC guidance; the SDK owns its web/custom-tab authentication flow. It is not a claim that Facebook authenticates wholly through the installed Facebook app.
- Facebook only accepts AuthenticationToken with nonce equal to the active request; Graph access tokens are rejected. No privileged custom token minting was added.
- Missing Facebook App ID/Client Token returns a specific actionable error before SDK launch.

## Verified

- 72 tests / 14 Jest suites; ESLint and TypeScript pass.
- Native Kotlin release QA build and install on emulator-5554 pass.
- Facebook missing-config error observed on emulator; a second button press starts a fresh request and reports the error again.
- Google opens Google's account selector. Caller verification and account-list retrieval succeed; reauthentication fails with SERVICE_DISABLED / Account reauth failed, surfaced as TYPE_USER_CANCELED.
- Google Play services availability API returns 0 (SUCCESS). The user reports native Drive works. The entire Google account or Google Play services package has not been proven broken.
- Temporary Google bottom-sheet experiment returned NO_CREDENTIAL and was reverted. It did not fix login.
- Failure occurs before a Google ID token is obtained; Supabase exchange is not reached. No successful Google/Facebook session is claimed.

## Team request: Google Cloud Console

Please have the owner of the existing OAuth project verify:

1. Web Client ID configured in Supabase and the APK:
   677328285522-rgi73dscll55dn6r1fm3icadlnfghuqv.apps.googleusercontent.com
2. In that same project, Android OAuth client package: com.mobile.
3. QA APK signing SHA-1:
   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
4. Consent/audience settings and test-account access; Supabase accepted ID-token audience.
5. Add/correct the Android client if absent/mismatched, then retry this APK and trace whether credential-acquired is reached.

The current user's Google Console project picker shows no accessible project. Android registration and consent settings remain unverified; missing registration is a hypothesis, not an established root cause. Do not create a replacement project or alter working web OAuth settings speculatively. If settings are correct, compare the same APK/account on a current Google Play emulator image or physical device and collect the internal reauth failure.

## Team request: Meta for Developers

Existing App ID: 4272858096366584.

- Owner should access https://developers.facebook.com/apps/ and supply the public SDK Client Token from Settings → Advanced for that exact app.
- Add MANGADOCK_FACEBOOK_CLIENT_TOKEN to an external local Gradle properties file (or authorized CI configuration), then rebuild the APK. Do not commit App Secret, service-role keys or personal credentials.
- Android package: com.mobile; activity: com.mobile.MainActivity.
- QA signing Key Hash: Xo8WBi6jzSxKDVR4drqm84yr9iU=
- Verify Facebook Login setup, Android platform/key hash, allowed app roles/test-user access, openid and email behavior, and App ID consistency with Supabase Facebook provider.
- Test SDK UI, consent/cancel, AuthenticationToken issuance, matching nonce, Supabase session exchange, signed-in WebView profile, restart persistence, logout and another-account login.

Release/Play signing requires the actual release certificate registration; these values describe the current debug-signed QA APK only.

## Reproduce and build

External local file used here (not committed):
C:/Users/woral/AppData/Local/Temp/mangadock-native-auth-public.properties

Required public SDK build values:
MANGADOCK_SUPABASE_URL
MANGADOCK_SUPABASE_PUBLIC_KEY
MANGADOCK_GOOGLE_WEB_CLIENT_ID
MANGADOCK_FACEBOOK_APP_ID
MANGADOCK_FACEBOOK_CLIENT_TOKEN

```powershell
cd Mobile/android
./gradlew.bat assembleRelease -PmangadockQaSigning=true -PreactNativeArchitectures=arm64-v8a,x86_64 -PmangadockNativeAuthProperties=C:/path/to/native-auth-public.properties
```

Local QA APK: mangadock-beta3-facebook-sdk-20261001.apk
Version: 1.0.1-beta.3 / code 4; com.mobile; arm64-v8a and x86_64; QA debug signing.
SHA256: 64AD10CB1405AAE134CA1FEA3E17F915840ED6F0DDD9759CBBBB3AC190556E89
This APK still lacks Facebook Client Token and is not an end-to-end acceptance artifact.

## Reference

- https://github.com/supabase/supabase-flutter/blob/main/packages/supabase_flutter/README.md#native-facebook-sign-in
- https://github.com/facebook/facebook-android-sdk/blob/main/facebook-common/src/main/java/com/facebook/login/LoginConfiguration.kt
- https://developer.android.com/identity/sign-in/credential-manager-troubleshooting-guide