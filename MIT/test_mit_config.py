"""
Tests for MIT config defaults — runs without GPU.
Imports the real manga_translator.config (omegaconf + pydantic only, no torch).
Run: python -m unittest test_mit_config -v
"""
import os
import sys
import pathlib
import unittest

# Add MIT root to path so 'manga_translator' is importable
sys.path.insert(0, str(pathlib.Path(__file__).parent))

import manga_translator.config as mit_config


class TestDefaultTranslatorEnvVar(unittest.TestCase):
    """
    M4 + M5 — TranslatorConfig.translator default reads from DEFAULT_TRANSLATOR env var.
    MIT decides which translator to use; Backend does not dictate it.
    """

    _ENV_KEYS = ('DEFAULT_TRANSLATOR', 'TRANSLATOR_TYPE', 'DEFAULT_API_TRANSLATOR', 'DEFAULT_LOCAL_TRANSLATOR')

    def setUp(self):
        for k in self._ENV_KEYS:
            os.environ.pop(k, None)
        import importlib
        importlib.reload(mit_config)

    def tearDown(self):
        for k in self._ENV_KEYS:
            os.environ.pop(k, None)
        import importlib
        importlib.reload(mit_config)

    # M4 — DEFAULT_TRANSLATOR not set → default is gemini
    def test_default_translator_is_gemini_when_env_not_set(self):
        cfg = mit_config.TranslatorConfig()
        self.assertEqual(str(cfg.translator), 'gemini')

    # M5 — DEFAULT_TRANSLATOR=qwen3 → TranslatorConfig uses qwen3
    def test_default_translator_reads_qwen3_from_env(self):
        os.environ['DEFAULT_TRANSLATOR'] = 'qwen3'
        import importlib
        importlib.reload(mit_config)
        cfg = mit_config.TranslatorConfig()
        self.assertEqual(str(cfg.translator), 'qwen3')

    # M6 — TRANSLATOR_TYPE=local, no model → default 'qwen3'
    def test_local_type_defaults_to_qwen3(self):
        os.environ['TRANSLATOR_TYPE'] = 'local'
        import importlib
        importlib.reload(mit_config)
        cfg = mit_config.TranslatorConfig()
        self.assertEqual(str(cfg.translator), 'qwen3')

    # M7 — TRANSLATOR_TYPE=local + DEFAULT_LOCAL_TRANSLATOR=nllb → 'nllb'
    def test_local_type_with_explicit_model(self):
        os.environ['TRANSLATOR_TYPE'] = 'local'
        os.environ['DEFAULT_LOCAL_TRANSLATOR'] = 'nllb'
        import importlib
        importlib.reload(mit_config)
        cfg = mit_config.TranslatorConfig()
        self.assertEqual(str(cfg.translator), 'nllb')

    # M8 — TRANSLATOR_TYPE=api + DEFAULT_API_TRANSLATOR=deepseek → 'deepseek'
    def test_api_type_with_explicit_model(self):
        os.environ['TRANSLATOR_TYPE'] = 'api'
        os.environ['DEFAULT_API_TRANSLATOR'] = 'deepseek'
        import importlib
        importlib.reload(mit_config)
        cfg = mit_config.TranslatorConfig()
        self.assertEqual(str(cfg.translator), 'deepseek')

    # M9 — TRANSLATOR_TYPE=api, no model → default 'gemini'
    def test_api_type_defaults_to_gemini(self):
        os.environ['TRANSLATOR_TYPE'] = 'api'
        import importlib
        importlib.reload(mit_config)
        cfg = mit_config.TranslatorConfig()
        self.assertEqual(str(cfg.translator), 'gemini')


if __name__ == '__main__':
    unittest.main()
