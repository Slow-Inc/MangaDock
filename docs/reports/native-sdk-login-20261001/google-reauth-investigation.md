# Google SDK reauthentication investigation — 2026-10-01

## Reproduced evidence

- User can use the native Google Drive app on this emulator. General Google account failure is not established.
- Google SDK button flow verifies the caller and reads the account list, then fails REAUTH_ACCOUNT with internal status SERVICE_DISABLED. Credential Manager exposes TYPE_USER_CANCELED.
- Runtime GoogleApiAvailabilityLight check returns 0 (SUCCESS). Google Play services is installed and enabled. SERVICE_DISABLED from the inner reauth flow must not be equated with the entire package being disabled.
- A temporary diagnostic APK changed only GetSignInWithGoogleOption to GetGoogleIdOption, keeping client ID and hashed nonce. It returned TYPE_NO_CREDENTIAL before token acquisition. This experiment was reverted; it did not fix login.
- Latest reproduction at 09:12:26 UTC still fails before Google ID-token acquisition; Supabase exchange is not reached.
- VERIFY_CALLER success does not establish that all OAuth client/package/certificate/consent settings are correct. Google Cloud Console registration is still unverified.

## Implemented diagnostic/message fix

- SDK cancellation for Google now uses neutral wording covering interrupted Google login and UI dismissal. Explicit app cancellation still says cancelled.
- No automatic retry after cancellation. No credential/token/error detail is logged to JS.
- Native logs only numeric Google Play services availability and a credential-acquired stage marker.
- Added direct play-services-base 18.5.0 dependency for the availability API.
- Regression ran RED then GREEN; 71 tests / 14 suites, ESLint and TypeScript pass. Release QA build/install succeed.
- APK SHA256: 57871762F661C68532E2E02989CD4A1CD15955541581F43F42589B6C044F701D

## Pending root cause / external verification

- User is opening Google Auth Platform → Clients in the existing project. Check Android client package com.mobile, SHA-1 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25, same project as Web client 677328285522-rgi73dscll55dn6r1fm3icadlnfghuqv.apps.googleusercontent.com.
- No Google Cloud management connector or authenticated browser automation session is available to inspect/change that registration.
- Do not create a replacement Cloud project or change Supabase client IDs on speculation.
- Real Google login is NOT verified or fixed yet. Full ID-token exchange, WebView identity and persistence must still be tested after identifying the root configuration/service failure.

## References

- https://developer.android.com/identity/sign-in/credential-manager-troubleshooting-guide (cancellation may represent technical authorization failure)
- https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation (button versus bottom-sheet account flows)