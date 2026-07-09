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
    # #278: the SFX rescue must gate on det_sfx provenance (should_rescue_sfx / from_sfx_detection),
    # NOT the old bare "len <= 4" heuristic that misreads short dialogue as SFX.
    called = _called_names()
    assert 'should_rescue_sfx' in called, \
        'the driver reverted to the pre-#278 <=4-char SFX heuristic (should_rescue_sfx not called)'
    src = open(_DRIVER, encoding='utf-8').read()
    assert 'from_sfx_detection' in src, '#278 det_sfx provenance gating is missing from the driver'
