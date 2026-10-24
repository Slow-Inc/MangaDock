"""Extra HTTP headers for OpenAI-compatible gateways (pure, torch-free)."""


def parse_extra_headers(raw):
    """Parse a JSON-object string from CUSTOM_OPENAI_EXTRA_HEADERS into a str->str dict.

    OpenCode Go answers 400 MissingSessionID unless the request carries x-opencode-session, so an
    OpenAI-compatible client needs a way to add headers. Invalid input is ignored (empty dict): a
    broken optional header must never stop translation.
    """
    import json

    if not raw or not str(raw).strip():
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:
        return {}
    if not isinstance(parsed, dict):
        return {}
    return {str(k): str(v) for k, v in parsed.items()}
