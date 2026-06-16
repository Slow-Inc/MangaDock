# PRD — Account-linking conflict resolution ("choose which account to link")

> Status: Draft (2026-06-15; updated 2026-06-16). Source research: `docs/research/oauth-account-linking-conflict.md`
> (verify-first workflow, validated against live `mangadock` build + GoTrue source). Relates to ADR 017.
> **2026-06-16 decision (verified by feasibility workflow):** the email ownership proof = **OTP code, not magic-link**
> (see *Decision* below). The supported `linkIdentity`-while-signed-in path is GoTrue-source-confirmed; the
> `service_role` INSERT fallback is **not** needed for the happy path.
> EN + ไทย (ไทยแปลเต็ม).

## Problem Statement

A social login (GitHub) returns **verified emails that map to more than one existing MangaDock account**, so
GoTrue aborts with a hard **HTTP 500** ("Multiple accounts with the same email address in the same linking domain
detected") and the user cannot link or sign in. This is not a one-off: any user whose social account lists multiple
verified emails that exist as separate MangaDock accounts will hit it. Today there is no graceful resolution — the
user is stuck.

**(ไทย)** การ login ด้วย social (GitHub) คืน **email ที่ verified หลายตัว ซึ่งตรงกับบัญชี MangaDock มากกว่า 1 บัญชี**
ทำให้ GoTrue หยุดด้วย **HTTP 500** ("Multiple accounts…") และ user link/login ไม่ได้ ไม่ใช่เคสครั้งเดียว — user คนไหนก็ตาม
ที่ social account มีหลาย verified email ที่เป็นคนละบัญชีใน MangaDock จะเจอเหมือนกัน ตอนนี้ไม่มีทางแก้ที่ graceful เลย

## Solution

When the collision is detected, show the user the **candidate accounts** the social emails match, let them **choose
which account to link the social identity to**, prove ownership by **authenticating into that account** (re-auth =
the security gate), then attach the social identity via GoTrue's supported signed-in `linkIdentity` path (which
bypasses the multi-account check). No account is ever linked to a session the user can't authenticate into.

**(ไทย)** เมื่อเจอ collision: แสดง **บัญชีที่ตรงกัน** ให้ user **เลือกบัญชีที่จะ link social identity เข้าไป** พิสูจน์ความเป็นเจ้าของด้วย
การ **login เข้าบัญชีนั้น** (re-auth = ด่านความปลอดภัย) แล้วค่อย attach ผ่าน path `linkIdentity` ตอน signed-in (ที่ข้าม
multi-account check) — ไม่มีการ link เข้า session ที่ user login ไม่ได้

## Why this design (the constraint)

GoTrue's 500 fires only on the **sign-in / create-account path** (`createAccountFromExternalIdentity`, `targetUser==nil`).
A **signed-in `linkIdentity`** sets `auth.flow_state.linking_target_id` → routes to `linkIdentityToUser`, which links
by social `sub` and **never runs the multi-account check**. So the attach MUST be bound to a session for the chosen
account — which is also the only thing preventing account-takeover (linking a social factor onto a victim whose email
the attacker's social account happens to list). The `linking_target_id` column is confirmed present on our build.

## User Stories

1. As a user whose GitHub matches multiple MangaDock accounts, I want to see which accounts match, so I understand the conflict.
2. As that user, I want to choose which account to attach GitHub to, so I control where my login goes.
3. As that user, I must prove I own the chosen account (sign in / OTP), so nobody can hijack an account they don't own.
4. As that user, once linked, I want future GitHub logins to go straight to the chosen account, so I never see the conflict again.
5. As an attacker, I must NOT be able to attach my GitHub to a victim's account just because my GitHub lists the victim's email.
6. As a dev/staff member, this flow must work in both the app Frontend and the standalone Dev console.
7. As an operator, every link/attach must be audit-logged.

## Implementation Decisions

- **Modules:** a read-only **Backend candidate-resolver** (NestJS, `service_role`) + a reusable **Chooser UI**
  (extend the Frontend's `LinkAccountModal`) + the existing `AuthContext` link/re-auth seams. Dashboard reuses the same.
- **Happy path (supported, no `auth.*` writes):**
  1. On a caught "Multiple accounts" error (or a "Link GitHub" click), Backend resolves candidates:
     `SELECT u.id,u.email,i.provider FROM auth.users u JOIN auth.identities i ON i.user_id=u.id WHERE i.identity_data->>'email' = ANY($1) AND u.is_sso_user=false;` — return **masked** identifiers only (anti-enumeration).
  2. Chooser UI lists masked candidates; user picks one.
  3. **Ownership proof** (an active session as that exact user — the security gate): `signInWithPassword` for a password account, `signInWithOAuth` to an already-linked provider, or the universal **email OTP** — `signInWithOtp({ email, options:{ shouldCreateUser:false } })` then `verifyOtp({ email, token, type:'email' })`. For the email path use an **OTP code, not a magic-link** (see *Decision* below). `shouldCreateUser:false` is mandatory — fail closed, a mistyped email must not silently create a new account.
  4. With that session, `linkIdentity({provider:'github'})` → `linkIdentityToUser`, no 500. Handle 422 `identity_already_exists` explicitly.
- **Gated fallback (only if a live repro proves the supported path broken on our build):** Backend custom GitHub
  OAuth captures the numeric `sub`; after the ownership re-auth, a single-txn `service_role` INSERT into `auth.identities`
  (`ON CONFLICT (provider_id,provider) DO NOTHING`, do not set the generated `email`) + merge `'github'` into
  `raw_app_meta_data->'providers'`; derive the target uid only from the validated session JWT; audit-log; add a startup
  schema-assertion guard (`UNIQUE(provider_id,provider)` + generated `email`) so a GoTrue migration fails loudly.
- **Security (non-negotiable):** attach target = the re-authenticated session user, always. Candidates masked. Only
  offer candidates whose email is in the social provider's **verified** set.

## Decision (2026-06-16): email ownership proof = OTP code, not magic-link

For the email-based ownership proof (the universal method when the account isn't reachable by password / an
already-linked OAuth provider), send a **6-digit OTP code**, not a magic-link. Both use the same `signInWithOtp`
API — the **email template** chooses what's shown (`{{ .Token }}` = code, `{{ .ConfirmationURL }}` = link) — so this
is a template setting, not a code change.

Why OTP wins **for this flow specifically** (verified against Supabase/GoTrue, feasibility workflow 2026-06-16):
1. **Chained orchestration.** The flow doesn't end at sign-in — it must immediately chain into `linkIdentity({github})`.
   A magic-link opens a **new tab / navigation**, so the "pending: link GitHub" state in the originating tab is lost and
   the chain breaks. An OTP is entered in the **same tab**, so `verifyOtp` → `linkIdentity` runs in one continuous context.
2. **PKCE same-browser.** A magic-link's code-verifier lives in the browser that started the flow; clicked from an email
   client (esp. a mobile in-app webview) it often lands in a different browser → the code exchange fails. OTP has no
   redirect and no verifier dependency.
3. **Proof strength.** An OTP typed into the tab that started the flow proves the same actor controls the email; a
   magic-link can be clicked anywhere.
4. Users here are dev/staff → typing a 6-digit code is not meaningful friction.

Magic-link would be preferable only for a single-destination sign-in (no follow-up step) — not our case.

**Client sequence:** `signInWithOtp({ email, options:{ shouldCreateUser:false } })` → user enters code →
`verifyOtp({ email, token, type:'email' })` → on that session `linkIdentity({ provider:'github', options:{ redirectTo: callbackUrl() } })`.

**Operational:** customize the Supabase "Magic Link" email template to surface `{{ .Token }}` (optionally drop the link
to avoid confusion); handle OTP expiry (~1h default) + resend; rely on Supabase's built-in attempt limiting and add a UI
lockout after repeated failures.

**(ไทย)** สำหรับการพิสูจน์ความเป็นเจ้าของผ่าน email (วิธีสากลเมื่อเข้าบัญชีด้วย password หรือ OAuth ที่ link ไว้แล้วไม่ได้)
ให้ส่ง **OTP code 6 หลัก ไม่ใช่ magic-link** ทั้งสองใช้ API `signInWithOtp` ตัวเดียวกัน ต่างที่ **email template**
(`{{ .Token }}` = code, `{{ .ConfirmationURL }}` = link) จึงเป็นแค่การตั้ง template ไม่ใช่แก้โค้ด

ทำไม OTP ดีกว่า **เฉพาะ flow นี้** (verified กับ Supabase/GoTrue, feasibility workflow 2026-06-16):
1. **Chained orchestration** — flow ไม่จบที่ sign-in ต้อง chain ไป `linkIdentity({github})` ต่อทันที magic-link เปิด
   **tab/หน้าใหม่** → state "pending: link GitHub" ใน tab เดิมหาย → chain พัง OTP กรอกใน **tab เดิม** →
   `verifyOtp` → `linkIdentity` รันต่อใน context เดียวกัน
2. **PKCE same-browser** — code-verifier ของ magic-link อยู่ใน browser ที่เริ่ม flow คลิกจาก email app
   (โดยเฉพาะ in-app webview มือถือ) มักเด้งไป browser อื่น → code exchange fail OTP ไม่มี redirect ไม่พึ่ง verifier
3. **ความแข็งแรงของ proof** — OTP กรอกใน tab ที่เริ่ม flow = คนเดียวกันคุม email magic-link คลิกที่ไหนก็ได้
4. ผู้ใช้คือ dev/staff → กรอก 6 หลักไม่เป็นภาระ

magic-link เหมาะกว่าเฉพาะ sign-in ปลายทางเดียวที่ไม่มี step ต่อ — ไม่ใช่กรณีเรา

**ลำดับ client:** `signInWithOtp({ email, options:{ shouldCreateUser:false } })` → user กรอก code →
`verifyOtp({ email, token, type:'email' })` → บน session นั้น `linkIdentity({ provider:'github', options:{ redirectTo: callbackUrl() } })`

**Operational:** แก้ template "Magic Link" ใน Supabase ให้โชว์ `{{ .Token }}` (จะเอาลิงก์ออกด้วยก็ได้ กันสับสน)
จัดการ OTP หมดอายุ (~1 ชม. default) + resend อาศัย attempt-limit ของ Supabase + เพิ่ม UI lockout หลังพลาดหลายครั้ง

## Testing Decisions

- Pure: candidate-masking + "is email in verified set" + the providers-array merge → unit-tested.
- Integration: the supported-`linkIdentity`-while-signed-in path (the decisive Step-0 repro becomes a documented test).
- Negative/security: a user who cannot authenticate into a candidate is never offered the attach; 422 path surfaces a clear message.
- Prior art for tests: the Frontend's existing `LinkAccountModal` single-provider conflict flow.

## Out of Scope

- **Account merge** (collapsing two real accounts into one) — separate, larger, irreversible; not the default for a routine social link.
- Changing the app's existing Google/Facebook/email flows.

## Further Notes

- **Step 0 — RESOLVED (2026-06-16):** the feasibility workflow (GoTrue-source-verified) + the production `GithubAutoLink` (which already runs signed-in `linkIdentity({github})`) confirm the happy path needs **zero `auth.*` writes** — `linkIdentityToUser` never runs the multi-account check. The gated `service_role` INSERT fallback is therefore **not required** for the happy path; keep it only as a documented break-glass.
- Backend is being refactored by akkanop-x — the happy path adds exactly **one read-only route**; coordinate before merge. The fallback's `service_role` write is conditional and must be flagged.
