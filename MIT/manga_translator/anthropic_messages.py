"""Anthropic Messages protocol for the custom_openai translator (#1119), pure and torch-free.

OpenCode Go serves ``claude-haiku-5-5`` only on ``/anthropic/v1/messages``. On MIT's real translator request bodies a
blind A/B against ``deepseek-v4.1-flash`` (reasoning_effort=low) judged haiku better 87:73 (24 ties) at ~2.3-4 s per
page instead of 1.7-36 s, with no reasoning runaway. ``CUSTOM_OPENAI_PROTOCOL=anthropic`` switches the transport;
the prompt, parsing and guards stay the same, so this module only maps the request and the response.
"""
import os
from types import SimpleNamespace

ENV_PROTOCOL = "CUSTOM_OPENAI_PROTOCOL"
ENV_ANTHROPIC_BASE = "CUSTOM_OPENAI_ANTHROPIC_BASE"


def protocol_from_env(env=None) -> str:
    env = env if env is not None else os.environ
    value = str(env.get(ENV_PROTOCOL, "") or "").strip().lower()
    return "anthropic" if value == "anthropic" else "openai"


def anthropic_endpoint(openai_base: str, env=None) -> str:
    """The /messages URL: CUSTOM_OPENAI_ANTHROPIC_BASE, else the OpenAI base with /openai/ replaced by /anthropic/."""
    env = env if env is not None else os.environ
    base = str(env.get(ENV_ANTHROPIC_BASE, "") or "").strip()
    if not base:
        if "/openai/" not in (openai_base or "").rstrip("/") + "/":
            raise ValueError(f"set {ENV_ANTHROPIC_BASE}: cannot derive the Anthropic endpoint from {openai_base!r}")
        base = (openai_base.rstrip("/") + "/").replace("/openai/", "/anthropic/")
    return base.rstrip("/") + "/messages"


def to_anthropic_payload(messages, model: str, max_tokens: int) -> dict:
    """System prompt as the top-level field; temperature/top_p are left out (rejected by current Claude models)."""
    system = "\n".join(m["content"] for m in messages if m["role"] == "system")
    payload = {"model": model, "max_tokens": int(max_tokens), "system": system,
               "messages": [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] != "system"]}
    if not system:
        del payload["system"]
    return payload


def from_anthropic_response(data: dict):
    """The OpenAI-shaped fields custom_openai reads: choices[0].message.content / finish_reason and usage."""
    text = "".join(block.get("text", "") for block in data.get("content") or [] if block.get("type") == "text")
    usage = data.get("usage") or {}
    prompt, completion = int(usage.get("input_tokens") or 0), int(usage.get("output_tokens") or 0)
    choice = SimpleNamespace(message=SimpleNamespace(content=text or None), finish_reason=data.get("stop_reason"))
    return SimpleNamespace(choices=[choice],
                           usage=SimpleNamespace(prompt_tokens=prompt, completion_tokens=completion,
                                                 total_tokens=prompt + completion, completion_tokens_details=None))


async def post_messages(client, url: str, headers: dict, payload: dict):
    """POST one Messages request; failures map onto the translator's existing retry paths.

    429 -> openai.RateLimitError, any other non-200 or a non-JSON 200 -> openai.APIError, a transport failure
    (connect/read/protocol) -> openai.APIConnectionError, so the custom_openai retry loop treats them exactly as it
    treats the OpenAI SDK's own errors. Timeouts are left to the translator's outer watchdog.
    """
    import httpx
    import openai
    try:
        r = await client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as e:
        raise openai.APIConnectionError(message=f"Anthropic endpoint unreachable: {e!r}", request=e.request) from e
    if r.status_code == 429:
        raise openai.RateLimitError(f"Anthropic endpoint 429: {r.text[:300]}", response=r, body=None)
    if r.status_code != 200:
        raise openai.APIError(f"Anthropic endpoint {r.status_code}: {r.text[:300]}", request=r.request, body=None)
    try:
        data = r.json()
    except ValueError as e:
        raise openai.APIError(f"Anthropic endpoint returned non-JSON: {r.text[:120]!r}", request=r.request, body=None) from e
    return from_anthropic_response(data)
