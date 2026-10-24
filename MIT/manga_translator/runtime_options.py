"""Runtime knobs resolved from the environment (pure, torch-free)."""

_ALLOWED_REASONING_EFFORTS = ("minimal", "low", "medium", "high")


def resolve_reasoning_effort(env=None):
    """Return a normalized reasoning-effort value, or "" when unset/invalid.

    Some OpenAI-compatible models accept `reasoning_effort` (OpenAI-style); OpenCode Go
    accepts it for its reasoning models (verified: low/medium/high all 200). An unknown
    value is ignored so a typo can never break translation.
    """
    import os

    env = env if env is not None else os.environ
    value = str(env.get("CUSTOM_OPENAI_REASONING_EFFORT", "")).strip().lower()
    return value if value in _ALLOWED_REASONING_EFFORTS else ""