"""Drift guard for conftest's `_HEAVY_TESTS` (#643).

The torch-free logic gate skips heavy test modules via a hand-maintained list in conftest.py.
The list is only corrected when a collection error fires in CI — so a branch that never ran CI
(`integrate/render-reconcile`) carried four unlisted heavy tests for weeks. These tests turn
that after-the-fact CI signal into a local, torch-free one.
"""

from pathlib import Path

import conftest
from heavy_imports import find_unlisted_heavy_tests, module_level_imports

TEST_DIR = Path(__file__).parent


def test_from_import_records_the_module_it_comes_from():
    src = "from manga_translator.translators.custom_openai import parse_numbered_translations\n"
    assert module_level_imports(src) == {"manga_translator.translators.custom_openai"}


def test_an_import_inside_a_function_does_not_count():
    """Only module-level imports abort collection — a deferred import just fails at call time.

    `test_custom_openai_none_content.py` has both kinds; conflating them would over-list.
    """
    src = "def t():\n    from manga_translator.manga_translator import MangaTranslator\n"
    assert module_level_imports(src) == set()


def test_a_test_importing_a_heavy_package_must_be_listed():
    sources = {
        "test_pure_logic.py": "from manga_translator.font_fit import fit\n",
        "test_offender.py": "from manga_translator.translators.custom_openai import parse\n",
    }
    assert find_unlisted_heavy_tests(sources, listed=[]) == ["test_offender.py"]


def test_this_repos_heavy_tests_are_all_listed_in_conftest():
    """The real guard: every heavy test module in test/ is in conftest's `_HEAVY_TESTS`.

    Without this the only signal is a collection error in the CI logic job — which never fires
    on a branch whose CI never runs. That is exactly how #643 went unnoticed.
    """
    sources = {
        p.name: p.read_text(encoding="utf-8") for p in sorted(TEST_DIR.glob("test_*.py"))
    }
    unlisted = find_unlisted_heavy_tests(sources, conftest._HEAVY_TESTS)
    assert unlisted == [], (
        f"these test modules import the ML stack but are not in conftest._HEAVY_TESTS, "
        f"so they will abort collection in the torch-free gate: {unlisted}"
    )
