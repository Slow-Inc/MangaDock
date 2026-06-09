"""Punctuation correction for translated text (#187).

Translators often swap source-language quotation/bracket marks for the target
language's. This restores them, comparing one region's source text against its
translation. Pure string logic, extracted verbatim from the TWO identical copies
that lived inside the MangaTranslator god object (the per-region loop in the
translate + batch paths) so it can be unit-tested and reused from one place.
"""
import re
from typing import List

# Each row: [canonical, *variants]. If the source uses `canonical` a consistent
# number of times and the translation expresses that count via the variants, the
# variants are normalised back to the canonical mark.
_CHECK_ITEMS: List[List[str]] = [
    ["(", "（", "「", "【"],
    ["（", "(", "「", "【"],
    [")", "）", "」", "】"],
    ["）", ")", "」", "】"],
    ["[", "［", "【", "「"],
    ["［", "[", "【", "「"],
    ["]", "］", "】", "」"],
    ["］", "]", "】", "」"],
    ["「", "“", "‘", "『", "【"],
    ["」", "”", "’", "』", "】"],
    ["『", "“", "‘", "「", "【"],
    ["』", "”", "’", "」", "】"],
    ["【", "(", "（", "「", "『", "["],
    ["】", ")", "）", "」", "』", "]"],
]

# Unconditional [variant -> canonical] forced replacements.
_REPLACE_ITEMS: List[List[str]] = [
    ["「", "“"],
    ["「", "‘"],
    ["」", "”"],
    ["」", "’"],
    ["【", "["],
    ["】", "]"],
]


def correct_punctuation(source_text: str, translation: str) -> str:
    """Return ``translation`` with quotation/bracket punctuation restored to the
    source's style. Pure; verbatim from the god object's per-region correction."""
    if '『' in source_text and '』' in source_text:
        quote_type = '『』'
    elif '「' in source_text and '」' in source_text:
        quote_type = '「」'
    elif '【' in source_text and '】' in source_text:
        quote_type = '【】'
    else:
        quote_type = None

    if quote_type:
        src_quote_count = source_text.count(quote_type[0])
        dst_dquote_count = translation.count('"')
        dst_fwquote_count = translation.count('＂')

        if (src_quote_count > 0 and
                (src_quote_count == dst_dquote_count or src_quote_count == dst_fwquote_count) and
                not translation.isascii()):

            if quote_type == '「」':
                translation = re.sub(r'"([^"]*)"', r'「\1」', translation)
            elif quote_type == '『』':
                translation = re.sub(r'"([^"]*)"', r'『\1』', translation)
            elif quote_type == '【】':
                translation = re.sub(r'"([^"]*)"', r'【\1】', translation)

    for v in _CHECK_ITEMS:
        num_src_std = source_text.count(v[0])
        num_src_var = sum(source_text.count(t) for t in v[1:])
        num_dst_std = translation.count(v[0])
        num_dst_var = sum(translation.count(t) for t in v[1:])

        if (num_src_std > 0 and
                num_src_std != num_src_var and
                num_src_std == num_dst_std + num_dst_var):
            for t in v[1:]:
                translation = translation.replace(t, v[0])

    for v in _REPLACE_ITEMS:
        translation = translation.replace(v[1], v[0])

    return translation
