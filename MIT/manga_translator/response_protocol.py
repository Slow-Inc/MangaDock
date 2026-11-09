"""OpenAI Responses protocol for the ``custom_openai`` translator (#1143 model sweep), pure and torch-free.

OpenCode Go serves ``gpt-6-luna`` only on ``/v1/responses`` — the same model on ``/chat/completions` answers
`400 ModelProtocolUnsupported`. This module maps the translator's chat-style messages onto the Responses API and
maps the answer back onto the fields ``custom_openai`` already reads, exactly like ``anthropic_messages`` does for
the Messages protocol.
"""
import os
from types import SimpleNamespace

ENV_RESPONSES_MODEL = "CUSTOM_OPENAI_RESPONSES_MODEL"
ENV_RESPONSES_BASE = "CUSTOM_OPENAI_RESPONSES_BASE"
# The gateway sits behind Cloudflare, which answers a bare HTTP client with "error code: 1010"; the OpenAI SDK's
# own user agent is what every other request in the pipeline sends, so send the same one.
USER_AGENT = "OpenAI/Python 1.99.1"


def responses_model(default: str, env=None) -> str:
    """The translator's model on the Responses path: CUSTOM_OPENAI_RESPONSES_MODEL, else ``default``."""
    env = env if env is not None else os.environ
    return str(env.get(ENV_RESPONSES_MODEL, "") or "").strip() or default


def responses_endpoint(openai_base: str, env=None) -> str:
    """The /responses URL: CUSTOM_OPENAI_RESPONSES_BASE, else the OpenAI base + '/responses'."""
    env = env if env is not None else os.environ
    base = str(env.get(ENV_RESPONSES_BASE, "") or "").strip()
    if not base:
        base = (openai_base or "").rstrip("/") + "/responses"
    return base


def _content_items(content):
    """OpenAI chat content -> Responses input items (text, image)."""
    if isinstance(content, str):
        return [{"type": "input_text", "text": content}]
    items = []
    for block in content or []:
        kind = block.get("type") if isinstance(block, dict) else None
        if kind == "text":
            items.append({"type": "input_text", "text": block.get("text", "")})
        elif kind == "image_url":
            url = (block.get("image_url") or {}).get("url", "")
            items.append({"type": "input_image", "image_url": url})
        elif kind == "input_text":            # already in Responses shape
            items.append({"type": "input_text", "text": block.get("text", "")})
        elif kind == "input_image":
            items.append(block)
        else:
            items.append({"type": "input_text", "text": str(block.get("text", block))})
    return items


def to_responses_payload(messages, model: str, max_tokens: int) -> dict:
    """Chat messages -> a Responses request. System text becomes ``instructions``; chat samples stay as input
    messages (assistant content is passed as plain text, which the API accepts). Temperature is left out on
    purpose: the current reasoning models reject it."""
    system = "\n".join(m["content"] for m in messages
                       if m["role"] == "system" and isinstance(m.get("content"), str))
    items = []
    for m in messages:
        if m["role"] == "system":
            continue
        role = "assistant" if m["role"] == "assistant" else "user"
        content = m.get("content")
        if role == "assistant" and isinstance(content, str):
            items.append({"role": role, "content": content})
        else:
            items.append({"role": role, "content": _content_items(content)})
    payload = {"model": model, "max_output_tokens": int(max_tokens), "input": items}
    if system:
        payload["instructions"] = system
    return payload


def from_responses(data: dict):
    """The OpenAI-shaped fields ``custom_openai`` reads: choices[0].message.content / finish_reason and usage."""
    text = ""
    for item in data.get("output") or []:
        if item.get("type") != "message":
            continue
        for part in item.get("content") or []:
            if part.get("type") in ("output_text", "text"):
                text += part.get("text", "")
    reason = "stop"
    if data.get("status") == "incomplete":
        reason = (data.get("incomplete_details") or {}).get("reason") or "incomplete"
    usage = data.get("usage") or {}
    prompt = int(usage.get("input_tokens") or 0)
    completion = int(usage.get("output_tokens") or 0)
    choice = SimpleNamespace(message=SimpleNamespace(content=text or None), finish_reason=reason)
    return SimpleNamespace(choices=[choice],
                           usage=SimpleNamespace(prompt_tokens=prompt, completion_tokens=completion,
                                                 total_tokens=prompt + completion, completion_tokens_details=None))


async def post_responses(client, url: str, headers: dict, payload: dict):
    """POST one Responses request; failures map onto the translator's existing retry paths (same policy as the
    Anthropic path): 429 -> RateLimitError, any other non-200 / non-JSON 200 -> APIError, transport -> connection."""
    import httpx
    import openai
    try:
        r = await client.post(url, headers={**headers, "User-Agent": USER_AGENT}, json=payload)
    except httpx.HTTPError as e:
        raise openai.APIConnectionError(message=f"Responses endpoint unreachable: {e!r}", request=e.request) from e
    if r.status_code == 429:
        raise openai.RateLimitError(f"Responses endpoint 429: {r.text[:300]}", response=r, body=None)
    if r.status_code != 200:
        raise openai.APIError(f"Responses endpoint {r.status_code}: {r.text[:300]}", request=r.request, body=None)
    try:
        data = r.json()
    except ValueError as e:
        raise openai.APIError(f"Responses endpoint returned non-JSON: {r.text[:120]!r}", request=r.request, body=None) from e
    return from_responses(data)
