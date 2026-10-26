# ADR 034: Phase 5 keeps the hybrid web session and delegates only OS push

- Status: Accepted for this implementation branch; production rollout remains disabled.
- Date: 2026-10-26
- Baseline: `feat/mobile-hybrid-phase4-20261024` at `69badd5f`.

## Context

The owner requested Phase 5 on the pushed hybrid Phase 4 branch. The separate
Phase 5 native branch has reusable Backend/Frontend contracts, but replacing
`Mobile/` with that Expo native UI would discard the accepted WebView shell.

## Decision

- Reuse the Backend/Frontend feature paths from `b168975`: following/personalized
  feeds, private/public reading collections, owner-scoped push registrations,
  transactional PostgreSQL outbox and a separate Redis/Expo delivery worker.
- Keep CLI navigation, the existing WebView, OAuth, identity, layered Back,
  crash recovery and file sharing. Add Expo SDK 56 modules to the existing
  Android project for the supported notifications API; do not prebuild over it.
- Supabase bearer/refresh tokens stay in the web process. The web push controller
  calls the authenticated Next proxy. The trusted-origin RPC carries OS permission,
  Expo push tokens, presentation state, account UID and notification responses only.
- Request permission only from an explicit settings action. Both native push and
  server sending default off. Enabled Android builds require the existing EAS
  project UUID and Firebase client configuration matching `com.mobile`.
- Server acknowledgement determines the enabled UI state. Logout attempts server
  deletion and native token invalidation before disposing Auth. Persistent owner
  markers retry cleanup after interruption. Native reset disables Expo token mapping
  before invalidating FCM. Deduplicate repeated FCM token-read events.
- Tap payloads are versioned, recipient checked and routed through an allowlist;
  cold taps wait for the web controller and, if necessary, login. Existing product
  screens retain their own entitlement/role checks.

## Alternatives considered

- Replace the shell with native Phase 5 screens: conflicts with the requested base.
- Browser notifications inside WebView: does not provide the required Android OS
  integration and lifecycle behavior.
- Introduce a second direct FCM sender or hand-code the Expo registration endpoint:
  duplicates the reviewed delivery path and depends on a separate credential/API contract.
- Transfer Supabase sessions into native storage: unnecessary for an OS-only bridge.

## Consequences

Web features require deployment of the compatible Frontend/Backend and the two
reviewed database migrations. The APK requires rebuilding only for shell/native
changes. Installing a QA APK alone does not deploy Phase 5 to the public website.
Offline cleanup and already-submitted Expo deliveries cannot guarantee recall.
The inherited owner/device/token DELETE protocol retains its same-token ABA
limitation (ADR 033). New-chapter events currently cover locally published Studio
versions, not external MangaDex polling. iOS is outside this Android delivery.

ภาษาไทย: ต่อ Phase 5 จาก hybrid ที่ push แล้ว โดยใช้เว็บทำ Feed/Collections และ
ดูแล Auth ส่วน native ทำเฉพาะงาน OS Push ผ่าน Expo modules ภายใน CLI shell เดิม
ยังปิด rollout จนกว่าจะลง migration, ตั้งค่า provider และตรวจรับ Push บนเครื่องจริงครบ
