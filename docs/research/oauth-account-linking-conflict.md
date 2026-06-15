# Research — OAuth account-linking on email collision ("Multiple accounts in linking domain" 500)

> Produced by a verify-first research workflow (2026-06-15, `wf_9500d487-778`, 11 agents, ~947k tokens).
> All facts verified against the **live `mangadock` Supabase build** + **GoTrue master source**. For the
> Dev console GitHub-linking problem ([[project-dashboard-mit-live]], ADR 017).

## Root cause (verified)

When a social provider (GitHub) returns **verified emails mapping to >1 existing Supabase user**, GoTrue's
`models.DetermineAccountLinking` runs `email = any(<verified emails>) and is_sso_user = false`, finds **2 users**,
returns the `MultipleAccounts` decision → hard **HTTP 500** *"Multiple accounts with the same email address in the
same linking domain detected: default"*. Verified on the live DB: `xenodev2004@gmail.com → 9c7f7717` and
`gamingshort01@gmail.com → a5a1a09c` (both google, `is_sso_user=false`, email-confirmed); GitHub returns both
verified → count = 2 → abort. The 500 fires **before** any github identity row is created and **before** the github
`sub`/token is exposed to our app. That string is in **exactly one place** in GoTrue: `createAccountFromExternalIdentity`,
which runs **only when `targetUser == nil`** (the sign-in / create-account path).

**Key insight:** a **signed-in `linkIdentity`** sets `auth.flow_state.linking_target_id` → the callback routes to
`linkIdentityToUser`, which **never calls `DetermineAccountLinking`** and links purely by github `sub`. The
multi-account check **cannot fire on this path**. The `auth.flow_state.linking_target_id` column **exists on our
deployed build**, so the mechanism is wired here. (Caveat: our earlier ground-truth said a signed-in `linkIdentity`
*also* 500'd, which source says is impossible — likely conflated with the fresh `signInWithOAuth` attempt, or ran
without a valid session for the chosen user. **Settle with one live repro.**)

Other verified schema facts: `auth.identities` UNIQUE is `(provider_id, provider)`, FK `ON DELETE CASCADE`, `email`
is a GENERATED column. `ProvidersWithOwnLinkingDomain` is a GoTrue env var **not exposed in the hosted dashboard**
(not a lever here).

## Designs — what actually works

| Design | Verdict | Why |
|---|---|---|
| **A — sign into chosen account, then `linkIdentity`** | works (prove live) | routes to `linkIdentityToUser`, bypasses the multi-account check; column wired on our build |
| **B — backend custom GitHub OAuth + `service_role` INSERT `auth.identities`** | works, heavy/unsupported | no admin API attaches an OAuth identity → raw insert is the only graft; next native login hits `AccountExists` (matched on `provider+sub` before the email check) → chosen user. Unsupported `auth.*` write. |
| **C — hybrid: backend chooser (read-only) + supported `linkIdentity`, SQL insert as gated fallback** | **recommended** | the only approach giving the "show candidates → pick → confirm → link" UX while staying on supported APIs for the happy path |
| **D — account-merge (delete duplicate, then link)** | auth half works, merge dangerous | FK cascade frees the email, but ~10 user-keyed tables to migrate, 7 unique-constraint collisions, irreversible. Wrong default for a routine social-link. |

**Security headline (non-negotiable):** the *attach target must always be the re-authenticated session user* — you
can only link to an account you can authenticate into. Letting a user pick **any** candidate and linking without
re-auth is an account-takeover primitive (anyone whose GitHub lists a victim's verified email could graft a login
factor onto the victim). Designs A/C honor this.

## Recommended — Design C (thin variant)

Backend = **collision detector + account chooser only**; the actual attach goes through GoTrue's **supported**
`linkIdentity` (re-authenticated as the chosen account). `service_role` insert held in reserve.

- **Step 0 (do first, ~30 min, no code):** signed in as the target user, `linkIdentity({provider:'github', options:{skipBrowserRedirect:true}})`, follow `data.url`, inspect the callback. New github identity → supported path works (ship Steps 1–4, no SQL). 500/error → check `auth.flow_state.linking_target_id`; if null, wire the Step-5 fallback.
- **Step 1 — detect + enumerate (Backend, read-only `service_role`):** `SELECT u.id,u.email,i.provider FROM auth.users u JOIN auth.identities i ON i.user_id=u.id WHERE i.identity_data->>'email' = ANY($1) AND u.is_sso_user=false;` → return **masked** candidates only (avoid enumeration).
- **Step 2 — chooser UI:** reuse `LinkAccountModal`: "this GitHub matches N accounts — pick the one to link; you'll sign into it to confirm."
- **Step 3 — ownership proof = re-auth into the chosen account** (`signInWithPassword` / `signInWithOAuth`). Optional extra: `auth.admin.generateLink` magic-link/OTP to the chosen address, gate the Link button on it.
- **Step 4 — attach (supported):** with the chosen session active, `linkIdentity({provider:'github'})` → `linkIdentityToUser`, no 500. Handle **422 `identity_already_exists`** explicitly.
- **Step 5 — fallback (only if Step 0 fails):** backend custom GitHub OAuth captures `sub`; after Step-3 re-auth, single-txn `INSERT INTO auth.identities (...) ON CONFLICT (provider_id,provider) DO NOTHING` (do NOT set the generated `email` column) + merge `'github'` into `raw_app_meta_data->'providers'`; derive `chosen_uid` only from the session JWT; audit-log; startup schema assertion.

## Interim unblock for the dev

1. **Run Step 0.** If supported `linkIdentity` works on our build (source says it should; column proves it's wired) → dev unblocked **today, zero backend** (sign in as `9c7f7717`, `linkIdentity({provider:'github'})`). Our earlier muddy tests were confounded by dev-server cache/HMR churn.
2. If Step 0 fails → one-off audited Step-5 insert for `9c7f7717` only (get the github numeric id from `api.github.com/users/<login>`), gated by the dev demonstrably owning both.

Do **not** ship Design D as interim — irreversible, migration code doesn't exist.

## Effort + Backend footprint (akkanop-x owns Backend now)

| Path | Effort | Backend |
|---|---|---|
| Step 0 repro | ~30 min | none |
| Happy path (Steps 1–4) | small–medium | **one read-only** route (candidate enumeration); attach is client-side; no `auth.*` writes |
| Chooser UI | small | Frontend only (reuse `LinkAccountModal` + `AuthContext` seams) |
| Fallback (Step 5) | large, conditional | custom GitHub OAuth app + scoped `service_role` insert + schema-assertion guard — only if Step 0 fails |

Coordinate the one read-only route (+ any `service_role` auth-write) with akkanop-x before merging.
