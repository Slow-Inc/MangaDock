"""Static check: does a driver gate the SFX rescue on PROVENANCE (#278) or not (#679)?

Pure `ast` — importing this must never import torch, since it runs in the torch-free gate.

The behaviour under guard is "#278: the SFX rescue is gated on where the region came from, not
on how short its text is". Two implementations of that behaviour exist in the tree and either
satisfies it; which one a branch calls is a separate decision, recorded in an ADR rather than
frozen into this check.
"""

import ast

#: Call names that establish provenance gating. Both read a det_sfx provenance flag:
#: ``ocr_vlm.should_rescue_sfx`` (main/#278, on ``from_sfx_detection`` + a size gate) and
#: ``sfx_merge.should_sfx_rescue`` (landing/#626, on ``region.is_sfx`` + a size gate).
PROVENANCE_GATES = ('should_rescue_sfx', 'should_sfx_rescue')


def called_names(source: str) -> set:
    """Every function/attribute name invoked as a Call anywhere in `source`."""
    names = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Name):
                names.add(func.id)
            elif isinstance(func, ast.Attribute):
                names.add(func.attr)
    return names


def sfx_rescue_gate(source: str):
    """The provenance gate this driver calls, or None if it gates on nothing."""
    called = called_names(source)
    for gate in PROVENANCE_GATES:
        if gate in called:
            return gate
    return None


#: Calls that apply ADR 026's Addendum guard — a clean ASCII line-OCR read means the OCR
#: succeeded on real text, so the region is dialogue or a det_sfx false-positive, never a
#: dropped stylized glyph. ``ocr_vlm.should_rescue_sfx`` applies it internally; a driver may
#: also call ``ocr_read_real_text`` itself. ``sfx_merge.should_sfx_rescue`` does NOT — it is
#: provenance only — so a driver using it must carry the guard at the call site.
REAL_TEXT_GUARDS = ('ocr_read_real_text', 'should_rescue_sfx')


def rescue_has_real_text_guard(source: str) -> bool:
    """Does this driver keep a real-text read out of the vision rescue? (ADR 026 Addendum)

    Without it, det_sfx false-positives sitting on speech bubbles reach the gateway and come
    back as a hallucinated target-language onomatopoeia rendered over the real dialogue.
    """
    called = called_names(source)
    return any(guard in called for guard in REAL_TEXT_GUARDS)
