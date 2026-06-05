# Hybrid Mobile Shell Native Surfaces

MangaDock will evolve the Phase 3 Mobile Shell from a WebView-only shell into a Hybrid Mobile Shell.

The Hybrid Mobile Shell uses a Native Shell Router as the app-level navigation owner. The first hybrid milestone routes between:

- `OnboardingScreen`
- `HomeScreen`
- `WebViewScreen`
- `DiagnosticsScreen`
- `SettingsScreen`

`WebViewScreen` remains responsible for loading the existing MangaDock web app and preserving WebView-owned workflows: WebView Auth, reader content, library, community, studio, and translation UI. The native app does not rewrite these flows in the first hybrid milestone.

Native-owned surfaces cover mobile app concerns that should work even when the WebView cannot load:

- Native Onboarding
- Native Shell Home
- Native Diagnostics
- Native Settings
- endpoint mode
- app version visibility
- masked Mobile Hardware ID visibility
- WebView reload controls
- QA diagnostics events
- future OS permission flows

`Frontend/` is the Frontend Visual Source of Truth for native mobile surfaces. Native screens should adapt MangaDock's existing dark product UI, typography, spacing density, and interaction tone instead of inventing a separate React Native theme.

Beta builds may use beta-only behavior:

- Beta Session Onboarding: show Native Onboarding once per fresh app session.
- Beta Endpoint Mode: allow production, local emulator, or custom frontend URL with warnings.
- Beta Diagnostics Shortcut: show `[diag]` in WebView as a shortcut to Native Diagnostics only.

Production builds should differ:

- onboarding is first-run per install
- endpoint is locked to production
- no production diagnostics badge

This decision keeps MangaDock from drifting into either extreme: a WebView-only app with native overlays piled on top, or a full native rewrite that duplicates the existing web product and auth surface.
