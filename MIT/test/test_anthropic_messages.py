"""#1119: Anthropic-protocol adapter for the custom_openai translator (OpenCode Go serves claude-haiku only on /v1/messages)."""
import pytest

from manga_translator.anthropic_messages import (anthropic_endpoint, protocol_from_env, to_anthropic_payload,
                                                 from_anthropic_response)


def test_protocol_defaults_to_openai():
    assert protocol_from_env({}) == "openai"
    assert protocol_from_env({"CUSTOM_OPENAI_PROTOCOL": " Anthropic "}) == "anthropic"
    assert protocol_from_env({"CUSTOM_OPENAI_PROTOCOL": "carrier-pigeon"}) == "openai"


def test_endpoint_is_derived_from_the_openai_base_or_overridden():
    assert anthropic_endpoint("https://opencode.ai/inference/go/openai/v1", {}) == "https://opencode.ai/inference/go/anthropic/v1/messages"
    assert anthropic_endpoint("https://x/openai/v1/", {}) == "https://x/anthropic/v1/messages"
    assert anthropic_endpoint("https://x/v1", {"CUSTOM_OPENAI_ANTHROPIC_BASE": "https://y/anthropic/v1/"}) == "https://y/anthropic/v1/messages"
    with pytest.raises(ValueError):
        anthropic_endpoint("https://x/v1", {})


def test_payload_moves_system_out_and_drops_sampling_knobs():
    msgs = [{"role": "system", "content": "S1"}, {"role": "user", "content": "u1"}, {"role": "assistant", "content": "a1"},
            {"role": "user", "content": "u2"}]
    p = to_anthropic_payload(msgs, "claude-haiku-5-5", 2048)
    assert p == {"model": "claude-haiku-5-5", "max_tokens": 2048, "system": "S1",
                 "messages": [{"role": "user", "content": "u1"}, {"role": "assistant", "content": "a1"}, {"role": "user", "content": "u2"}]}


def test_response_is_shaped_like_the_openai_fields_the_translator_reads():
    r = from_anthropic_response({"content": [{"type": "text", "text": "<|1|>a"}, {"type": "text", "text": "\n<|2|>b"}],
                                 "stop_reason": "end_turn", "usage": {"input_tokens": 900, "output_tokens": 210}})
    assert r.choices[0].message.content == "<|1|>a\n<|2|>b"
    assert r.choices[0].finish_reason == "end_turn"
    assert (r.usage.prompt_tokens, r.usage.completion_tokens, r.usage.total_tokens) == (900, 210, 1110)
    assert r.usage.completion_tokens_details is None


def test_response_without_text_has_none_content():
    r = from_anthropic_response({"content": [], "stop_reason": "max_tokens", "usage": {}})
    assert r.choices[0].message.content is None and r.usage.total_tokens == 0
