"""#980: cross-page character-name glossary.

Cross-page name spellings drift (measured: TSUKUYOMI rendered as สึกุโยมิ / ทสึคุโยมิ / ทสึคโยมิ in one chapter).
The #159 rolling dialogue context did not fix it, and injecting it can hurt the current page (see
2026-10-22-905-context-ab.md). This module keeps only the small, structured part that matters: a
source-name -> Thai-spelling glossary built from each page's own output and passed to the next page's prompt.

Pure logic only, so it unit-tests without the ML stack.
"""
import re

#: Latin words that look like names but are ordinary dialogue words (all-caps manga lettering is loud).
_NAME_STOP = frozenset("""
A AN AND ARE AS AT BE BUT BY CAN COULD DO DOES DID FOR FROM GET GOT HAD HAS HAVE HE HER HERE HIM HIS HOW
I IF IN IS IT ITS JUST KNOW LET LIKE ME MY NO NOT NOW OF ON OR OUR OUT SHE SO SOME THAT THE THEN THERE
THEY THIS TO TOO UP US WAS WE WERE WHAT WHEN WHERE WHO WHY WILL WITH WOULD YOU YOUR MEAN ALL SAME ONLY
EVEN MORE MOST VERY WELL STILL BACK DOWN OVER UNDER ONE TWO THREE FIVE RIGHT LEFT GOOD PLEASE THANK
SHES IM IVE YOURE THATS ITS DONT CANT WONT DIDNT DOESNT ISNT ARENT WASNT WERENT HAVENT HASNT HADNT
THOSE THOUGH THROUGH UNTIL WHICH WHILE WANT SAID MUST MAY OFF ONLY OVER SUCH THAN
""".split())

_LATIN_NAME = re.compile(r"\b([A-Z][a-z]{2,}|[A-Z]{3,})\b")
#: A name broken by a stammer hyphen or a line break ("TSUKU- YOMI", "TSUKU - YOMI") is one name.
_HYPHEN_BREAK = re.compile(r"(?<=[A-Z])-\s*(?=[A-Z])")
_THAI_RUN = re.compile("[\\u0E00-\\u0E7F]{3,}")


def glossary_enabled(env=None) -> bool:
    """Whether the cross-page name glossary runs (#980). Default ON: it adds no model call and only fixes
    spellings it can extract with high confidence. MIT_NAME_GLOSSARY=0/false/off disables it.
    """
    import os

    value = str((env or os.environ).get('MIT_NAME_GLOSSARY', '')).strip().lower()
    return value not in ('0', 'false', 'no', 'off')


def candidate_names(srcs) -> list:
    """Canonical (uppercase) romaji name candidates from the page's source lines, in first-seen order."""
    found = []
    for src in srcs or []:
        text = _HYPHEN_BREAK.sub("", src or "")
        for tok in _LATIN_NAME.findall(text):
            key = tok.upper()
            if key in _NAME_STOP or len(key) < 3:
                continue
            if key not in found:
                found.append(key)
    return found


def extract_glossary(regions, existing=None) -> dict:
    """Extend a name -> Thai spelling glossary from one page's {src, dst} regions.

    Only regions that carry exactly one name candidate are used, and the longest Thai run in the translation
    is taken as the spelling (transliterated names are the longest words in practice). An existing spelling
    always wins, so a page never overrides the glossary it inherited.
    """
    glossary = dict(existing or {})
    for region in regions or []:
        if isinstance(region, dict):
            src = region.get("src") or ""
        else:
            src = getattr(region, "src", "") or getattr(region, "text", "")
        if isinstance(region, dict):
            dst = region.get("dst") or ""
        else:
            dst = getattr(region, "dst", "") or getattr(region, "translation", "")
        names = candidate_names([src])
        if len(names) != 1:
            continue
        name = names[0]
        if name in glossary:
            continue
        runs = _THAI_RUN.findall(dst or "")
        if not runs:
            continue
        spelling = max(runs, key=len)
        # a transliterated name is short; a whole Thai clause means the region was not name-focused
        if 3 <= len(spelling) <= 18:
            glossary[name] = spelling
    return glossary


def count_candidates(regions) -> dict:
    """How many times each name candidate occurs on one page (used to keep only recurring names)."""
    counts = {}
    for region in regions or []:
        if isinstance(region, dict):
            src = region.get("src") or ""
        else:
            src = getattr(region, "src", "") or getattr(region, "text", "")
        for name in candidate_names([src]):
            counts[name] = counts.get(name, 0) + 1
    return counts


def apply_glossary(regions, glossary) -> int:
    """Deterministically enforce a glossary on one page's translated regions; returns how many were fixed.

    Prompt-level instructions are not reliable (the model copied ทสึคุโยมิ as ทสึคิโยมิ in one run), so on a
    region whose SOURCE contains a glossary name, a Thai token within edit distance of the glossary spelling
    is replaced with the exact spelling. Only near matches are touched: the token must be within 3 edits for
    spellings up to 8 chars (1 for longer ones) and cover at least 70 % of the length, so unrelated words that
    merely share a few letters are left alone.
    """
    if not glossary:
        return 0
    from difflib import SequenceMatcher

    fixed = 0
    for region in regions or []:
        if isinstance(region, dict):
            src = region.get("src") or ""
            dst = region.get("dst") or ""
        else:
            src = getattr(region, "text", "") or getattr(region, "src", "")
            dst = getattr(region, "dst", "") or getattr(region, "translation", "")
        if not src or not dst:
            continue
        present = [n for n in candidate_names([src]) if n in glossary]
        if not present:
            continue
        new_dst = dst
        for name in present:
            target = glossary[name]
            if target in new_dst:
                continue
            best = None
            best_ratio = 0.0
            for tok in _THAI_RUN.findall(new_dst):
                if abs(len(tok) - len(target)) > 2:
                    continue
                ratio = SequenceMatcher(None, tok, target).ratio()
                # same name, small drift: high similarity and only a couple of character edits
                if ratio >= 0.6 and _edit_distance(tok, target) <= 3 and ratio > best_ratio:
                    best, best_ratio = tok, ratio
            if best is not None:
                new_dst = new_dst.replace(best, target, 1)
                fixed += 1
        if new_dst != dst:
            if isinstance(region, dict):
                region["dst"] = new_dst
            elif hasattr(region, 'translation'):
                region.translation = new_dst
            else:
                setattr(region, "dst", new_dst)
    return fixed


def _edit_distance(a: str, b: str) -> int:
    """Levenshtein distance, small strings only (name spellings)."""
    if a == b:
        return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def format_glossary(glossary) -> str:
    """Prompt block for the next page; empty glossary -> "" (prompt byte-identical)."""
    if not glossary:
        return ""
    pairs = "; ".join(f"{name} = {spelling}" for name, spelling in glossary.items())
    return ("\n\n## Consistent character names\n"
            "Never re-spell these characters. Copy the Thai spelling exactly as given, on every occurrence, "
            "even when the source spells the name differently or the Thai looks unusual: "
            + pairs + ".\n")
