"""
Tests for build_load_kwargs(precision) — runs without GPU (torch mocked).
Run: python -m unittest test_precision -v
"""
import sys
import types
import unittest
from unittest.mock import MagicMock

# ── Mock torch before any import ──────────────────────────────────────────
_torch = types.ModuleType('torch')
_torch.float8_e4m3fn = 'MOCK_FP8'
_torch.bfloat16       = 'MOCK_BF16'
_torch.float16        = 'MOCK_FP16'
sys.modules['torch'] = _torch

# Mock bitsandbytes
_bnb = types.ModuleType('bitsandbytes')
sys.modules['bitsandbytes'] = _bnb

_bnb_nn = types.ModuleType('bitsandbytes.nn')
sys.modules['bitsandbytes.nn'] = _bnb_nn

class _FakeBnBConfig:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

# Mock transformers so BitsAndBytesConfig is importable
_transformers = types.ModuleType('transformers')
_transformers.BitsAndBytesConfig = _FakeBnBConfig
_transformers.AutoModelForCausalLM = MagicMock()
_transformers.AutoTokenizer = MagicMock()
sys.modules['transformers'] = _transformers

# ── Now import the module under test ──────────────────────────────────────
import importlib.util, pathlib

def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod  = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod

_HERE = pathlib.Path(__file__).parent

# Stub MIT package structure needed by qwen3/qwen2
import types as _t

def _stub(n):
    m = _t.ModuleType(n); sys.modules[n] = m; return m

_stub('omegaconf')
_common = _stub('manga_translator.translators.common')
class _FakeOT:
    _MODEL_DIR = '/tmp'; _MODEL_SUB_DIR = 'tr'
    def __init__(self): pass
_common.OfflineTranslator = _FakeOT
_cgpt = _stub('manga_translator.translators.config_gpt')
class _FakeCGPT:
    chat_system_template = '{to_lang}'; chat_sample = {}
    logger = _t.SimpleNamespace(debug=lambda *a: None)
    def __init__(self, **kw): pass
_cgpt.ConfigGPT = _FakeCGPT
_cfg = _stub('manga_translator.config'); _cfg.TranslatorConfig = object
_stub('manga_translator'); _stub('manga_translator.translators')

_qwen3 = _load(
    'manga_translator.translators.qwen3',
    _HERE / 'manga_translator' / 'translators' / 'qwen3.py',
)
build_load_kwargs = _qwen3.build_load_kwargs


class TestBuildLoadKwargs(unittest.TestCase):

    # P1 — fp8 → torch.float8_e4m3fn, no quantization_config
    def test_fp8_sets_float8_dtype(self):
        kwargs = build_load_kwargs('fp8')
        self.assertEqual(kwargs['dtype'], 'MOCK_FP8')
        self.assertNotIn('quantization_config', kwargs)

    # P2 — bf16 → torch.bfloat16, no quantization_config
    def test_bf16_sets_bfloat16_dtype(self):
        kwargs = build_load_kwargs('bf16')
        self.assertEqual(kwargs['dtype'], 'MOCK_BF16')
        self.assertNotIn('quantization_config', kwargs)

    # P3 — fp16 → torch.float16, no quantization_config
    def test_fp16_sets_float16_dtype(self):
        kwargs = build_load_kwargs('fp16')
        self.assertEqual(kwargs['dtype'], 'MOCK_FP16')
        self.assertNotIn('quantization_config', kwargs)

    # P4 — int8 → BitsAndBytesConfig(load_in_8bit=True)
    def test_int8_sets_bnb_8bit_config(self):
        kwargs = build_load_kwargs('int8')
        cfg = kwargs.get('quantization_config')
        self.assertIsNotNone(cfg)
        self.assertTrue(getattr(cfg, 'load_in_8bit', False))

    # P5 — int4 → BitsAndBytesConfig(load_in_4bit=True)
    def test_int4_sets_bnb_4bit_config(self):
        kwargs = build_load_kwargs('int4')
        cfg = kwargs.get('quantization_config')
        self.assertIsNotNone(cfg)
        self.assertTrue(getattr(cfg, 'load_in_4bit', False))

    # P6 — unknown → fallback bf16, no crash
    def test_unknown_precision_falls_back_to_bf16(self):
        kwargs = build_load_kwargs('fp64_super_mode')
        self.assertEqual(kwargs['dtype'], 'MOCK_BF16')
        self.assertNotIn('quantization_config', kwargs)


if __name__ == '__main__':
    unittest.main()
