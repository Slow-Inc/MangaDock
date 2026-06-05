"""Target-language script ratio (Issue #109).

Measures how much of a translated text is actually written in the target
language's script. Used by the post-translation check to decide whether a page
was really translated — robustly, so a few deliberately-untranslated tokens
(sound effects, scanlation credits like "SETSU SCANS") don't flip the verdict the
way a single `langid` classification of the merged text could.
"""

# Codepoint ranges of each target language's primary script (keyed by MIT lang
# code). Targets not listed are treated as Latin-script (English, French, German,
# Spanish, Italian, Portuguese, Vietnamese, Indonesian, Filipino, ...).
_SCRIPT_RANGES = {
    "THA": ((0x0E00, 0x0E7F),),
    "JPN": ((0x3040, 0x30FF), (0x4E00, 0x9FFF)),
    "KOR": ((0xAC00, 0xD7A3), (0x1100, 0x11FF)),
    "CHS": ((0x4E00, 0x9FFF),),
    "CHT": ((0x4E00, 0x9FFF),),
    "ARA": ((0x0600, 0x06FF),),
    "RUS": ((0x0400, 0x04FF),),
    "UKR": ((0x0400, 0x04FF),),
    "SRP": ((0x0400, 0x04FF),),
    "CNR": ((0x0400, 0x04FF),),
}

# Latin letter blocks: Basic Latin + Latin-1 + Extended-A/B/IPA, plus Latin
# Extended Additional (Vietnamese diacritics).
_LATIN_RANGES = ((0x0041, 0x024F), (0x1E00, 0x1EFF))


def _in_ranges(cp: int, ranges) -> bool:
    return any(lo <= cp <= hi for lo, hi in ranges)


def target_script_ratio(text: str, target_lang: str) -> float:
    """Fraction of the *letters* in `text` written in the target language's script.

    Punctuation, digits and whitespace are ignored. Empty letter content returns
    1.0 (nothing to judge — do not reject).
    """
    ranges = _SCRIPT_RANGES.get((target_lang or "").upper(), _LATIN_RANGES)
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 1.0
    hits = sum(1 for c in letters if _in_ranges(ord(c), ranges))
    return hits / len(letters)
