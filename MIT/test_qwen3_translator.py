"""
Tests for Qwen3Translator — runs without GPU (all heavy imports mocked).
Run from MIT/ directory: python -m pytest test_qwen3_translator.py -v
"""
import os
import sys
import types
import unittest
import importlib.util
import pathlib

# ── Mock heavy dependencies before any MIT import ─────────────────────────

def _stub(name):
    mod = types.ModuleType(name)
    sys.modules[name] = mod
    return mod

_stub('omegaconf')

_common = _stub('manga_translator.translators.common')
class _FakeOfflineTranslator:
    _MODEL_DIR = '/tmp/models'
    _MODEL_SUB_DIR = 'translators'
    def __init__(self): pass
_common.OfflineTranslator = _FakeOfflineTranslator

_cfg_gpt = _stub('manga_translator.translators.config_gpt')
class _FakeConfigGPT:
    chat_system_template = 'Translate to {to_lang}.'
    chat_sample: dict = {}
    logger = types.SimpleNamespace(debug=lambda *a: None)
    def __init__(self, config_key=''): pass
_cfg_gpt.ConfigGPT = _FakeConfigGPT

_config = _stub('manga_translator.config')
_config.TranslatorConfig = object

_stub('manga_translator')
_stub('manga_translator.translators')

# ── Load qwen3 module under test ───────────────────────────────────────────

_HERE = pathlib.Path(__file__).parent
_QWEN3_PATH = _HERE / 'manga_translator' / 'translators' / 'qwen3.py'

def _load_qwen3():
    spec = importlib.util.spec_from_file_location('manga_translator.translators.qwen3', _QWEN3_PATH)
    mod = importlib.util.module_from_spec(spec)
    sys.modules['manga_translator.translators.qwen3'] = mod
    spec.loader.exec_module(mod)
    return mod

_mod = _load_qwen3()
Qwen3Translator = _mod.Qwen3Translator
_strip_think_tags = _mod._strip_think_tags


# ── M1: env var defaults ───────────────────────────────────────────────────

class TestQwen3EnvVars(unittest.TestCase):

    def setUp(self):
        os.environ.pop('QWEN3_MODEL', None)

    def tearDown(self):
        os.environ.pop('QWEN3_MODEL', None)

    def test_default_model_is_qwen3_4b(self):
        # _TRANSLATOR_MODEL default must match PRD spec
        self.assertEqual(Qwen3Translator._TRANSLATOR_MODEL, 'Qwen/Qwen3-4B-Instruct')


# ── M2: _strip_think_tags ─────────────────────────────────────────────────

class TestStripThinkTags(unittest.TestCase):

    def test_strips_simple_think_block(self):
        result = _strip_think_tags('<think>internal reasoning</think>Translation here')
        self.assertEqual(result, 'Translation here')

    def test_strips_multiline_think_block(self):
        result = _strip_think_tags('<think>\nmultiline\nthinking\n</think>Result')
        self.assertEqual(result, 'Result')

    def test_no_op_when_no_think_tags(self):
        result = _strip_think_tags('Plain translation output')
        self.assertEqual(result, 'Plain translation output')

    def test_strips_think_block_mid_string(self):
        result = _strip_think_tags('Before<think>hidden</think>After')
        self.assertEqual(result, 'BeforeAfter')


# ── M3: tokenize passes enable_thinking=False ─────────────────────────────

class TestQwen3TokenizeThinkingMode(unittest.TestCase):

    def test_apply_chat_template_called_with_enable_thinking_false(self):
        from unittest.mock import MagicMock

        translator = Qwen3Translator.__new__(Qwen3Translator)
        translator.chat_system_template = 'Translate to {to_lang}.'
        translator.chat_sample = {}
        translator.logger = types.SimpleNamespace(debug=lambda *a: None)

        mock_tokenizer = MagicMock()
        mock_tokenizer.pad_token = 'eos'
        mock_tokenizer.model_max_length = 2048
        mock_tokenizer.apply_chat_template.return_value = '<prompt>'
        mock_tokenizer.return_value = types.SimpleNamespace(
            input_ids=[[1, 2]], attention_mask=[[1, 1]]
        )
        mock_tokenizer.return_value.to = lambda d: mock_tokenizer.return_value
        translator.tokenizer = mock_tokenizer
        translator.device = 'cpu'

        translator.tokenize(['hello'], 'THA')

        call_kwargs = mock_tokenizer.apply_chat_template.call_args
        self.assertIn('enable_thinking', call_kwargs.kwargs)
        self.assertFalse(call_kwargs.kwargs['enable_thinking'])


if __name__ == '__main__':
    unittest.main()
