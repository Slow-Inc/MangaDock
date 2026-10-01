"""Unit tests for the Dev-console auth path (PRD #279, ADR 016 §Decision 4).

The dashboard forwards the dev's Supabase JWT; MIT verifies it INDEPENDENTLY by
asking Supabase (`GET /auth/v1/user`) — mirroring the Backend's `auth.getUser`,
so MIT needs no JWT secret and a leaked dashboard config holds nothing reusable.
Import-light (httpx only, faked here — no network), so it imports in <1s, same
pattern as test_diagnostics.py. The async entry point runs under asyncio.run so
no pytest-asyncio is needed.
"""
import asyncio

import httpx

from server import auth


class FakeResponse:
    def __init__(self, status_code, json_body=None):
        self.status_code = status_code
        self._json = json_body or {}

    def json(self):
        return self._json


class FakeClient:
    """Async-context client stub replaying one scripted GET outcome (a
    FakeResponse, or an Exception to raise). Records the URL + headers seen."""

    def __init__(self, outcome):
        self._outcome = outcome
        self.seen = {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, headers=None):
        self.seen = {"url": url, "headers": headers or {}}
        if isinstance(self._outcome, Exception):
            raise self._outcome
        return self._outcome


def _patch_client(monkeypatch, outcome):
    holder = {}

    def factory(*a, **k):
        holder["client"] = FakeClient(outcome)
        return holder["client"]

    monkeypatch.setattr(auth.httpx, "AsyncClient", factory)
    return holder


def test_valid_token_returns_the_user(monkeypatch):
    user = {"id": "uid-123", "email": "dev@x.io", "app_metadata": {}}
    holder = _patch_client(monkeypatch, FakeResponse(200, user))
    out = asyncio.run(auth.verify_supabase_token("tok", supabase_url="https://p.supabase.co/", anon_key="anon"))
    assert out == user
    # Forwards the dev's bearer + the public anon apikey to the right endpoint.
    assert holder["client"].seen["url"] == "https://p.supabase.co/auth/v1/user"
    assert holder["client"].seen["headers"]["Authorization"] == "Bearer tok"
    assert holder["client"].seen["headers"]["apikey"] == "anon"


def test_rejected_token_returns_none(monkeypatch):
    _patch_client(monkeypatch, FakeResponse(401, {"msg": "invalid"}))
    out = asyncio.run(auth.verify_supabase_token("bad", supabase_url="https://p.supabase.co", anon_key="anon"))
    assert out is None


def test_network_error_returns_none(monkeypatch):
    _patch_client(monkeypatch, httpx.ConnectError("boom"))
    out = asyncio.run(auth.verify_supabase_token("tok", supabase_url="https://p.supabase.co", anon_key="anon"))
    assert out is None


# ── is_staff: allowlist now, staffLevel claim later ──────────────────────────

def test_user_id_in_allowlist_is_staff():
    user = {"id": "dev-uuid", "app_metadata": {}}
    assert auth.is_staff(user, allow_ids={"dev-uuid"}) is True


def test_stafflevel_claim_grants_even_without_allowlist():
    user = {"id": "someone", "app_metadata": {"staffLevel": "dev"}}
    assert auth.is_staff(user, allow_ids=set()) is True


def test_insufficient_stafflevel_and_not_allowlisted_is_rejected():
    user = {"id": "mod", "app_metadata": {"staffLevel": "moderator"}}
    assert auth.is_staff(user, allow_ids=set()) is False


def test_plain_user_not_allowlisted_is_rejected():
    user = {"id": "rando", "app_metadata": {}}
    assert auth.is_staff(user, allow_ids={"other"}) is False


def test_none_user_is_not_staff():
    assert auth.is_staff(None, allow_ids={"x"}) is False


# ── provider enforcement: dev access requires a GitHub identity ───────────────

def test_dev_requires_github_allows_github_identity():
    user = {"id": "dev-uuid", "app_metadata": {"provider": "github", "providers": ["github"]}}
    assert auth.is_staff(user, allow_ids={"dev-uuid"}, require_provider="github") is True


def test_dev_requires_github_rejects_google_identity():
    # Allowlisted, but signed in with Google → denied dev access when GitHub is enforced.
    user = {"id": "dev-uuid", "app_metadata": {"provider": "google", "providers": ["google"]}}
    assert auth.is_staff(user, allow_ids={"dev-uuid"}, require_provider="github") is False


def test_github_linked_among_providers_satisfies_enforcement():
    user = {"id": "x", "app_metadata": {"provider": "google", "providers": ["google", "github"], "staffLevel": "dev"}}
    assert auth.is_staff(user, allow_ids=set(), require_provider="github") is True


def test_no_provider_requirement_skips_the_check():
    user = {"id": "dev-uuid", "app_metadata": {"provider": "google", "providers": ["google"]}}
    assert auth.is_staff(user, allow_ids={"dev-uuid"}, require_provider=None) is True
