"""Call-graph guard: the Stage C render-quality wiring + #278 SFX provenance gate must be
CALLED by the driver, not merely present as helper functions in other modules.

Background: PR #553 (071b0e8e) branched off a stale base and silently reverted the call sites in
`manga_translator.py` — the helpers (`assemble_fullpage_erase_mask`, `protect_figure_ink`, …) still
existed in `patch_geometry.py`/`detection_postproc.py`, so every helper unit test + the fake-driver
patch-render test kept passing while the pipeline had actually stopped invoking them (Stage C
silently OFF, #278 reverted to the old ≤4-char heuristic). This test closes that blind spot by
asserting the driver's own source actually *calls* the wiring — torch-free + deterministic, so it
runs in the logic gate. It FAILS on the clobbered driver and PASSES once the call sites are restored.
"""
import ast
import os

from sfx_gate_scan import rescue_has_real_text_guard, sfx_rescue_gate

_DRIVER = os.path.join(os.path.dirname(__file__), '..', 'manga_translator', 'manga_translator.py')


def _called_names():
    """Every function/attribute name invoked as a Call anywhere in the driver module."""
    tree = ast.parse(open(_DRIVER, encoding='utf-8').read())
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            f = node.func
            if isinstance(f, ast.Name):
                names.add(f.id)
            elif isinstance(f, ast.Attribute):
                names.add(f.attr)
    return names


def test_stage_c_mask_quality_wiring_is_called_by_the_driver():
    # The full-page-inpaint path must invoke the landing/#548 mask-quality stack, not the old
    # union_refined_with_fallback. #553 reverted exactly these calls.
    called = _called_names()
    for fn in ('assemble_fullpage_erase_mask', 'protect_figure_ink',
               'adaptive_dilate_mask', 'flatten_white_captions'):
        assert fn in called, f'Stage C wiring lost: the driver no longer calls {fn}() (#553 clobber regression)'


def test_278_sfx_provenance_gate_is_called_by_the_driver():
    # #278: the SFX rescue must gate on det_sfx PROVENANCE, not the old bare "len <= 4" heuristic
    # that misreads short dialogue in a big bubble as SFX and overwrites it with an onomatopoeia.
    #
    # #679: this used to assert the literal symbol `should_rescue_sfx`. Two implementations of the
    # same gate exist — `ocr_vlm.should_rescue_sfx` (main, on `from_sfx_detection`) and
    # `sfx_merge.should_sfx_rescue` (landing, on `region.is_sfx`) — so pinning one name made the
    # guard fire on a deliberate, benchmarked swap (7e78341e) and accuse the driver of a revert
    # that had not happened. Which implementation is canonical is an ADR 026 decision, not
    # something this guard should freeze; what it must keep catching is a driver gating on nothing.
    with open(_DRIVER, encoding='utf-8') as fh:
        gate = sfx_rescue_gate(fh.read())
    assert gate is not None, (
        'the driver does not gate the SFX rescue on det_sfx provenance at all — short dialogue '
        'in a large bubble will be sent to the vision gateway and overwritten (#278 reverted)'
    )


def test_026_addendum_real_text_guard_is_on_the_rescue_path():
    # ADR 026's Addendum, which is a SEPARATE requirement from its Decision: provenance alone
    # was measured insufficient because det_sfx itself false-positives on speech bubbles. Without
    # a real-text guard the gateway is handed a dialogue fragment, told it is an SFX, and returns
    # a phantom onomatopoeia that renders over the real line ('W' -> 'ปาร์ตี้', 'THE' -> 'เสียง
    # ดังสนั่นหวั่นไหว' — benchmarked across 5 pages, 2026-06-30).
    #
    # A driver can satisfy the provenance test above and still ship this defect: a bare
    # `is_sfx` gate has no view of what the line-OCR actually read.
    with open(_DRIVER, encoding='utf-8') as fh:
        guarded = rescue_has_real_text_guard(fh.read())
    assert guarded, (
        'the SFX rescue path never consults the line-OCR read (ocr_read_real_text, directly or '
        'via ocr_vlm.should_rescue_sfx) — a det_sfx false-positive on a speech bubble will be '
        'sent to the vision gateway and its hallucinated onomatopoeia rendered over real '
        'dialogue. See ADR 026 Addendum; if this is a deliberate trade-off, amend the ADR.'
    )
