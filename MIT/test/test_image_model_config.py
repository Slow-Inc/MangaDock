"""Contract test for the per-request translator model override (Issue #87).

The Backend sends `translator.model` in the request config JSON. MIT's Pydantic
`Config` must surface it so `GeminiTranslator.parse_args` can read it per
request; absent means "use the GEMINI_MODEL env default".
"""
import json

from manga_translator.config import Config

BACKEND_CONFIG = {
    "translator": {"target_lang": "THA", "model": "gemini-2.5-pro"},
    "inpainter": {"inpainter": "lama_large"},
    "render": {"direction": "auto", "rtl": False},
}


def test_translator_model_is_parsed_from_request_config():
    conf = Config.parse_raw(json.dumps(BACKEND_CONFIG))
    assert conf.translator.model == "gemini-2.5-pro"


def test_translator_model_defaults_to_none_when_absent():
    payload = {"translator": {"target_lang": "THA"}}
    conf = Config.parse_raw(json.dumps(payload))
    assert conf.translator.model is None
