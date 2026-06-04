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

    def setUp(self):
        os.environ.pop('DEFAULT_TRANSLATOR', None)
        # Reload so class-level default re-evaluates env var
        import importlib
        importlib.reload(mit_config)

    def tearDown(self):
        os.environ.pop('DEFAULT_TRANSLATOR', None)
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


if __name__ == '__main__':
    unittest.main()
