"""parse_and_validate_config — the single config-parse seam (#192).

Pins that the seam produces the same Config the scattered `Config.parse_raw`
calls did (so the dedup + the Pydantic-v2 `model_validate_json` migration is
behaviour-preserving) and that invalid input still raises.
"""
import warnings

import pytest

from manga_translator.config import Config, parse_and_validate_config

# a representative Backend buildMitConfig-shaped payload
_CFG = (
    '{"translator":{"translator":"gemini","target_lang":"THA","source_lang":"JPN"},'
    '"detector":{"detection_size":2048},'
    '"inpainter":{"inpainter":"lama_large","inpainting_size":1536}}'
)


def test_parses_a_representative_backend_config():
    conf = parse_and_validate_config(_CFG)
    assert conf.translator.target_lang == 'THA'
    assert conf.translator.source_lang == 'JPN'
    assert conf.detector.detection_size == 2048
    assert conf.inpainter.inpainting_size == 1536


def test_seam_is_identical_to_the_old_parse_raw():
    # the dozen call sites used Config.parse_raw; the seam must produce an equal Config
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')          # parse_raw is deprecated in Pydantic v2
        legacy = Config.parse_raw(_CFG)
    assert parse_and_validate_config(_CFG) == legacy


def test_invalid_json_raises():
    with pytest.raises(Exception):               # pydantic ValidationError / JSON decode error
        parse_and_validate_config('{not valid json')
