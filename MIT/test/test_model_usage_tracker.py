"""Model-usage TTL bookkeeping (#187 seam S3 / #188 starts here).

`ModelUsageTracker` wraps the bare `_model_usage_timestamps` dict that MangaTranslator
stamped from eight inline sites and swept in `_detector_cleanup_job`. It records when
each `(tool, model)` was last used and reports which have expired, using an **injected
clock** so the TTL sweep is testable without the ML stack.

It deliberately does **not** normalise the keys — the L1 key-drift landmine
(`'colorizer'` never matching `_unload_model`'s `case 'colorization'`;
`'textline_merge'` / `'rendering'` having no case) is preserved verbatim by the call
sites; this golden pins those exact tuples so S4 ModelUnloader can freeze the routing.
"""
from manga_translator.model_usage_tracker import ModelUsageTracker


def test_expired_reports_keys_past_ttl():
    t = ModelUsageTracker()
    t.touch('detection', 'default', now=0)
    # at now=12 with ttl=7, a key last used at 0 is expired (12-0 > 7)
    assert t.expired(ttl=7, now=12) == [('detection', 'default')]


def test_fresh_key_within_ttl_is_not_expired():
    t = ModelUsageTracker()
    t.touch('detection', 'default', now=10)
    # 12-10 = 2, not > 7
    assert t.expired(ttl=7, now=12) == []


def test_expired_is_strict_greater_than_not_equal():
    # boundary: now - last_used == ttl is NOT expired (mirrors `> self.models_ttl`)
    t = ModelUsageTracker()
    t.touch('detection', 'd', now=0)
    assert t.expired(ttl=12, now=12) == []          # 12-0 == 12, not > 12
    assert t.expired(ttl=11, now=12) == [('detection', 'd')]


def test_expired_keeps_insertion_order():
    # touch at t=0/4/10; at now=12 ttl=7 only the first two (12-0=12, 12-4=8 > 7)
    # expire, returned in insertion order — mirrors list(_model_usage_timestamps.items())
    t = ModelUsageTracker()
    t.touch('detection', 'd', now=0)
    t.touch('ocr', 'o', now=4)
    t.touch('inpainting', 'i', now=10)
    assert t.expired(ttl=7, now=12) == [('detection', 'd'), ('ocr', 'o')]


def test_forget_removes_a_key():
    t = ModelUsageTracker()
    t.touch('detection', 'd', now=0)
    t.touch('ocr', 'o', now=0)
    t.forget('detection', 'd')
    assert t.expired(ttl=0, now=100) == [('ocr', 'o')]


def test_forget_during_iteration_of_expired_is_safe():
    # the cleanup loop forgets each key while iterating expired()'s result; because
    # expired() snapshots via list(...), this must not raise (L13 invariant preserved)
    t = ModelUsageTracker()
    t.touch('detection', 'd', now=0)
    t.touch('ocr', 'o', now=0)
    for tool, model in t.expired(ttl=0, now=100):
        t.forget(tool, model)
    assert t.expired(ttl=0, now=100) == []


def test_touch_updates_last_used_so_a_refresh_clears_expiry():
    t = ModelUsageTracker()
    t.touch('detection', 'd', now=0)
    t.touch('detection', 'd', now=10)  # re-used → newer timestamp wins
    assert t.expired(ttl=7, now=12) == []  # 12-10 = 2, not > 7
