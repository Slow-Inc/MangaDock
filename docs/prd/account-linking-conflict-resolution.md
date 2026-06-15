# PRD — Account-linking conflict resolution ("choose which account to link")

> Status: Draft (2026-06-15). Source research: `docs/research/oauth-account-linking-conflict.md`
> (verify-first workflow, validated against live `mangadock` build + GoTrue source). Relates to ADR 017.
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
  3. **Ownership proof:** require an active session as that exact user (`signInWithPassword` / `signInWithOAuth`); optional extra `auth.admin.generateLink` magic-link/OTP to the chosen email.
  4. With that session, `linkIdentity({provider:'github'})` → `linkIdentityToUser`, no 500. Handle 422 `identity_already_exists` explicitly.
- **Gated fallback (only if a live repro proves the supported path broken on our build):** Backend custom GitHub
  OAuth captures the numeric `sub`; after the ownership re-auth, a single-txn `service_role` INSERT into `auth.identities`
  (`ON CONFLICT (provider_id,provider) DO NOTHING`, do not set the generated `email`) + merge `'github'` into
  `raw_app_meta_data->'providers'`; derive the target uid only from the validated session JWT; audit-log; add a startup
  schema-assertion guard (`UNIQUE(provider_id,provider)` + generated `email`) so a GoTrue migration fails loudly.
- **Security (non-negotiable):** attach target = the re-authenticated session user, always. Candidates masked. Only
  offer candidates whose email is in the social provider's **verified** set.

## Testing Decisions

- Pure: candidate-masking + "is email in verified set" + the providers-array merge → unit-tested.
- Integration: the supported-`linkIdentity`-while-signed-in path (the decisive Step-0 repro becomes a documented test).
- Negative/security: a user who cannot authenticate into a candidate is never offered the attach; 422 path surfaces a clear message.
- Prior art for tests: the Frontend's existing `LinkAccountModal` single-provider conflict flow.

## Out of Scope

- **Account merge** (collapsing two real accounts into one) — separate, larger, irreversible; not the default for a routine social link.
- Changing the app's existing Google/Facebook/email flows.

## Further Notes

- Decisive **Step 0** (no code): signed in as the target user, `linkIdentity({provider:'github', options:{skipBrowserRedirect:true}})`, inspect the callback. If it returns a github identity, the whole happy path needs **zero `auth.*` writes**.
- Backend is being refactored by akkanop-x — the happy path adds exactly **one read-only route**; coordinate before merge. The fallback's `service_role` write is conditional and must be flagged.
