"""Supabase JWT verification for the Dev console (PRD #279, ADR 016 §Decision 4).

The dashboard forwards the dev's Supabase access token; MIT verifies it
INDEPENDENTLY rather than trusting the dashboard. It asks Supabase to validate
the token (`GET /auth/v1/user`) — the same mechanism the Backend uses
(`SupabaseService.verifyAccessToken` → `auth.getUser`). Consequences:

- MIT needs **no JWT secret** and no crypto/JWKS handling (zero new dependency —
  httpx only, same as server.diagnostics / server.webhook). One fewer secret to
  distribute is one fewer to leak.
- Verification is per-service and independent: a leaked dashboard config carries
  nothing reusable (ADR 016: no shared secret); the forwarded token is the dev's
  own short-lived session, which Supabase itself can revoke/expire.

Staff gating (`is_staff`) accepts EITHER a sufficient signed `staffLevel` claim
(once the Supabase Custom Access Token Hook lands — ADR 016 §Decision 1) OR, for
v1, the user id on an env allowlist, so the dev's own account works today.
"""
import httpx

_LEVELS = {"none": 0, "moderator": 1, "admin": 2, "dev": 3}


async def verify_supabase_token(token: str, *, supabase_url: str, anon_key: str, timeout: float = 5.0) -> dict | None:
    """Validate a Supabase access token; return the user dict or None.

    None means "not verifiable" (rejected, expired, or Supabase unreachable) and
    the caller must deny access — so a transient Supabase outage fails closed.
    """
    if not token:
        return None
    base = supabase_url.rstrip("/")
    headers = {"Authorization": f"Bearer {token}", "apikey": anon_key}
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(f"{base}/auth/v1/user", headers=headers)
    except httpx.HTTPError:
        return None
    if resp.status_code != 200:
        return None
    return resp.json()


def staff_level(user: dict | None) -> str:
    """The signed staffLevel claim from `app_metadata` (authoritative, not the
    user-editable `user_metadata`); 'none' when absent or unrecognised."""
    meta = (user or {}).get("app_metadata") or {}
    level = meta.get("staffLevel") or meta.get("staff_level")
    return level if level in _LEVELS else "none"


def auth_providers(user: dict | None) -> set:
    """The OAuth providers backing this identity (current + linked), e.g.
    {'github'} or {'google', 'github'}, from Supabase `app_metadata`."""
    meta = (user or {}).get("app_metadata") or {}
    provs = {p for p in (meta.get("providers") or []) if isinstance(p, str)}
    if isinstance(meta.get("provider"), str):
        provs.add(meta["provider"])
    return provs


def is_staff(user: dict | None, *, allow_ids, min_level: str = "dev", require_provider: str | None = None) -> bool:
    """True if the verified user may read the Dev console.

    Level: a sufficient `staffLevel` claim, OR (v1, until the claim hook lands)
    an allowlisted id. When `require_provider` is set (e.g. 'github'), the user
    must ALSO carry that identity — so dev-tier access can be forced onto GitHub
    even for an allowlisted/claimed Google account.
    """
    if not user:
        return False
    granted = _LEVELS.get(staff_level(user), 0) >= _LEVELS.get(min_level, 3)
    if not granted:
        uid = user.get("id") or user.get("sub")
        granted = bool(uid) and uid in allow_ids
    if not granted:
        return False
    if require_provider and require_provider not in auth_providers(user):
        return False
    return True
