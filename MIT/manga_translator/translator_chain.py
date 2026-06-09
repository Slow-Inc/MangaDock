"""Translator-chain parsing (#192).

Pure parse of a ``'trans1:lang1;trans2:lang2'`` chain string, extracted from
config.py's ``TranslatorChain`` (which carried a ``# TODO: Refactor``). The name
resolver and the validity sets are injected so this has **no** heavy imports and
unit-tests in isolation; ``TranslatorChain.__init__`` calls it with the real
``Translator`` enum + ``TRANSLATORS`` / ``VALID_LANGUAGES``. Behaviour is verbatim:
empty input → ``Exception``; an unknown translator *name* propagates the resolver's
``KeyError``; a known-but-disabled translator or unknown language → ``ValueError``.
"""
from typing import Any, Callable, Collection, List, Tuple


def parse_translator_chain(
    string: str,
    resolve_translator: Callable[[str], Any],
    valid_translators: Collection[Any],
    valid_languages: Collection[str],
) -> List[Tuple[Any, str]]:
    """Parse ``string`` into an ordered ``[(translator, lang), ...]`` chain."""
    if not string:
        raise Exception('Invalid translator chain')
    chain: List[Tuple[Any, str]] = []
    for g in string.split(';'):
        trans, lang = g.split(':')
        translator = resolve_translator(trans)
        if translator not in valid_translators:
            raise ValueError('Invalid choice: %s (choose from %s)' % (trans, ', '.join(map(repr, valid_translators))))
        if lang not in valid_languages:
            raise ValueError('Invalid choice: %s (choose from %s)' % (lang, ', '.join(map(repr, valid_languages))))
        chain.append((translator, lang))
    return chain
