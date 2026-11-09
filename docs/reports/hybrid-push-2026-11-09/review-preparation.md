# Draft PR preparation — 2026-11-09

The owner requested a Draft PR for team review before any merge/deployment.
The review branch is `review/hybrid-phase45-push-20261109`, in a separate worktree
`C:/Users/woral/md-hybrid-push-pr-20261109`. It retains the previously unmerged
hybrid commits `69badd5f`, `ae6d2289`, `7fb8fc79`, and incorporates `origin/main`
`888e3f0b` through merge `9870dfae`. That merge was clean. No main branch was
updated. This is a review of the hybrid Phase 4–5 implementation plus the current
Push fixes, not only a Firebase metadata change.

## Scope and preserved local work

Copied only the current task's Push controller/provider/transport/Native host
changes and tests, public Expo/EAS metadata, beta.4/code11 + Gradle Firebase task
fix, resume documentation, and the November 9 evidence reports. Appended only this
task's DONE records to the merged DONE file. Existing unrelated dirty files in the
original worktree were fingerprinted and left in place.

Did not import pre-existing dirty changes to Backend pagination/fixtures, Navbar,
Collections, native configuration, auth-preparation guards/scripts/tests, prior
October evidence or unrelated roadmap/Obsidian/root documentation. In particular,
the original local worktree's additional live-auth Gradle guard is not part of
this task's patch. The clean branch retains the hybrid baseline's signing guard.
No APK, client-properties file, Firebase client JSON, private service-account key,
access token, build output or local dependency junction is included in the PR.
The baseline's tracked standard Android debug keystore remains a QA/test key;
production signing is an open release gate.
Report-local Git attributes preserve captured evidence bytes (including original
CRLF text) so the recorded SHA-256 values survive checkout on other systems.

## Fresh checks on the isolated review branch

- Mobile: **96/96 tests, 17 suites**, strict TypeScript pass, ESLint 0 errors
  (one pre-existing inline-style warning).
- Frontend Push: **20/20** with Bun; Auth/cache regressions **12/12**.
- Backend: TypeScript build and Phase 5 SQL/HTTP/worker contracts **18/18**.
  An initial direct test invocation before compilation failed
  `Cannot find module '../dist/src/supabase/supabase.service'` and the worker
  equivalent. Building first, as `npm run test:phase5` specifies, resolved it.
- Frontend: production webpack build, including TypeScript and static generation,
  passed with synthetic public QA environment values; focused Push ESLint passed.
  The existing multiple-lockfiles workspace-root warning remains.

These counts describe the PR source. The original APK/phone reports describe the
earlier local worktree, which also contained the excluded pre-existing changes.
Its Mobile 99/18 suites includes three additional local QA-preparation tests;
its Backend 19 includes an additional local pagination test. Historical phone
evidence is not relabeled as a fresh build or physical acceptance of this merged
review branch. No new Android build, phone installation or remote notification
was performed while preparing this PR.

## Review and rollout boundaries

Review the intentional Mobile runtime change from the Expo native screens in
main to the React Native CLI WebView shell. Review account/document cancellation,
recipient-scoped cleanup/taps, Phase 5 RPC authorization and the two new SQL
migrations, public project linkage and release signing separately. Main's later
Frontend/Backend/MIT/docs changes were merged into this branch rather than
overwritten. Payment implementation is excluded.

Existing physical evidence covers real owner-device Expo/FCM delivery/tap/receipt
and reload/opt-out; production account/outbox/Redis and remaining role/security/
release gates are still open. Supabase remains Auth/data. No production schema,
frontend/API deployment or production-sending enablement was performed here.
`PUSH_DELIVERY_ENABLED` defaults off in reviewed source. CI status is independent
of these local results; keep the PR draft pending team review.

## Backup and rollback

The original worktree and APKs remain intact; source and IAM backups are recorded
in [the configuration report](README.md). Before merge, close the Draft PR to
cancel the proposal. A future merged change can be reverted through a reviewed PR;
do not reset main or automatically undo live SQL/IAM. Native code11 Push-off APK
is available locally for data-preserving rollback with the existing certificate.
