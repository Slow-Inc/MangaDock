"""Quality audit for a translated chapter (#1143 Track D): the numbers we keep asking by hand.

Pure and torch-free, so the CI logic gate can test it and a tool can run it over the JSON a bench run or a
patches response already produced. Three things the audit answers on a real chapter:

- completeness: how many real dialogue lines reach the reader in the target language, and which do not;
- residue: dialogue lines that came back with no target-language text (English left on the page);
- name drift: for each source name that appears on two or more lines, how many different Thai spellings the
  chapter used - the defect class the name glossary exists to remove.

The heuristics are deliberately conservative and stated in the report; they are meant to be stable enough to
compare two runs, not to be a ground truth.
"""
import re

from .name_glossary import candidate_names

_LATIN = re.compile(r"[A-Za-z]")
_THAI = re.compile("[\u0E00-\u0E7F]")


def _thai_fraction(text: str) -> float:
    letters = [c for c in (text or "") if c.isalpha()]
    if not letters:
        return 0.0
    return sum(1 for c in letters if _THAI.match(c)) / len(letters)


def looks_like_dialogue(src: str) -> bool:
    """A source line worth translating: at least two words, mostly Latin (pure)."""
    src = (src or "").strip()
    if len(src.split()) < 2:
        return False
    letters = [c for c in src if c.isalpha()]
    if len(letters) < 8:
        return False
    return sum(1 for c in letters if _LATIN.match(c)) / len(letters) >= 0.7


def pairs_from_payload(payload) -> list:
    """(page, src, dst) triples from a bench JSON, a patches response, or a plain list (pure).

    Bench JSON: {"arrivals": {"<page>": {"regions": [[src, dst], ...]}}}. Patches response:
    {"regions": [{"src": ..., "dst": ...}]}. A list of dicts is accepted too."""
    out = []
    if isinstance(payload, dict) and isinstance(payload.get("arrivals"), dict):
        for page, info in payload["arrivals"].items():
            for item in (info or {}).get("regions") or []:
                if isinstance(item, (list, tuple)) and len(item) >= 2:
                    out.append((int(page), item[0] or "", item[1] or ""))
                elif isinstance(item, dict):
                    out.append((int(page), item.get("src") or "", item.get("dst") or ""))
        return out
    regions = payload.get("regions") if isinstance(payload, dict) else payload
    for item in regions or []:
        if isinstance(item, dict):
            out.append((0, item.get("src") or "", item.get("dst") or ""))
    return out


def name_drift(pairs, names) -> dict:
    """Which of the GIVEN names the chapter spelled more than one way (pure).

    Only names the caller asks about are checked: an automatic pass over every capitalised token flags ordinary
    words and brands (measured: COIN / PAYPAL / MAD came back as "drift"). The check learns the chapter's own
    spelling with the same machinery the glossary uses, then counts how many name-bearing lines used something
    close to it instead."""
    from .name_glossary import _find_near_spelling, learn_spellings
    learned = learn_spellings([{"src": s, "dst": d} for _, s, d in pairs])
    out = {}
    for name in names or []:
        canonical = learned.get(name)
        counts = {}
        for _, src, dst in pairs:
            if name not in candidate_names([src]):
                continue
            if canonical and canonical in dst:
                counts[canonical] = counts.get(canonical, 0) + 1
                continue
            matched, _ratio = _find_near_spelling(dst, canonical) if canonical else (None, 0.0)
            if matched:
                counts[matched] = counts.get(matched, 0) + 1
        if len(counts) > 1:
            out[name] = {"spellings": sorted(counts), "lines": sum(counts.values())}
    return out


def audit(pairs, names=()) -> dict:
    """The audit numbers for one chapter (pure); names are the ones to check for spelling drift."""
    dialogue = [(p, s, d) for p, s, d in pairs if looks_like_dialogue(s)]
    translated = [(p, s, d) for p, s, d in dialogue if _thai_fraction(d) >= 0.3]
    residue = [(p, s, d) for p, s, d in dialogue if _thai_fraction(d) < 0.3]
    names_report = name_drift(pairs, names)
    return {
        "lines": len(pairs),
        "dialogue": len(dialogue),
        "translated": len(translated),
        "residue": [{"page": p, "src": s, "dst": d} for p, s, d in residue],
        "name_drift": names_report,
    }


def summary_line(report) -> str:
    """One line for a log or a report header (pure)."""
    return ("%d regions, %d dialogue lines, %d translated (%.0f%%), %d without Thai output, %d names drifting"
            % (report["lines"], report["dialogue"], report["translated"],
               100.0 * report["translated"] / report["dialogue"] if report["dialogue"] else 0.0,
               len(report["residue"]), len(report["name_drift"])))
