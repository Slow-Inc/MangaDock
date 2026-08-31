"""The guard that checks the driver gates SFX rescue on provenance, tested itself (#679).

`test_stage_c_wiring.py` asserted the literal symbol `should_rescue_sfx` appeared as a call in
`manga_translator.py`. That pins an implementation, not the behaviour it exists to protect — so
when the SFX seam was deliberately swapped to landing's equivalent gate (`sfx_merge.
should_sfx_rescue`, commit 7e78341e, measured against the baseline), the guard fired and its
message accused the driver of reverting to the pre-#278 `len(text) <= 4` heuristic, which was
never true there.

A guard nobody can test is a guard nobody can trust. The rule moves into a pure function over
driver source so it can be exercised against synthetic drivers — including the one failure mode
it actually exists to catch, which no real file in the tree exhibits.
"""

from sfx_gate_scan import rescue_has_real_text_guard, sfx_rescue_gate


def test_a_driver_with_only_a_length_heuristic_has_no_provenance_gate():
    """The #553-class regression this guard exists for: gating on text length alone."""
    src = (
        "def process(region):\n"
        "    if len(region.text.strip()) <= 4:\n"
        "        rescue(region)\n"
    )
    assert sfx_rescue_gate(src) is None


# The three below pin the accepted shapes rather than drive new code — the scanner above
# already satisfies them. They exist so a later "simplification" of the scanner cannot
# quietly narrow it back to one implementation, which is exactly how #679 happened.

def test_landings_gate_counts():
    src = (
        "from .sfx_merge import should_sfx_rescue\n"
        "if config.ocr.vlm_rescue and should_sfx_rescue(region):\n"
        "    rescue(region)\n"
    )
    assert sfx_rescue_gate(src) == 'should_sfx_rescue'


def test_mains_gate_counts():
    src = (
        "from .ocr_vlm import should_rescue_sfx\n"
        "if should_rescue_sfx(region.text, region.from_sfx_detection, w, h):\n"
        "    rescue(region)\n"
    )
    assert sfx_rescue_gate(src) == 'should_rescue_sfx'


def test_importing_a_gate_without_calling_it_is_not_gating():
    """The #553 clobber left the helpers importable while the driver stopped invoking them."""
    src = "from .sfx_merge import should_sfx_rescue\n\ndef process(region):\n    rescue(region)\n"
    assert sfx_rescue_gate(src) is None


# ADR 026 has TWO parts and they fail differently. The Decision is "gate on provenance"
# (above). The Addendum is "provenance alone was insufficient" — det_sfx itself
# false-positives on speech bubbles, and without a real-text guard the vision gateway
# hallucinates a phantom target-language SFX over real dialogue ('W' -> 'ปาร์ตี้').
# A driver can satisfy the first and still ship the defect the second exists to stop.

def test_a_rescue_that_never_consults_the_ocr_read_is_unguarded():
    src = (
        "from .sfx_merge import should_sfx_rescue\n"
        "if should_sfx_rescue(region):\n"
        "    vlm_localize_sfx(crop)\n"
    )
    assert rescue_has_real_text_guard(src) is False


def test_calling_the_guard_directly_counts():
    src = (
        "from .ocr_vlm import ocr_read_real_text\n"
        "if not ocr_read_real_text(region.text):\n"
        "    vlm_localize_sfx(crop)\n"
    )
    assert rescue_has_real_text_guard(src) is True


def test_a_gate_that_consults_it_internally_counts():
    """`ocr_vlm.should_rescue_sfx` applies the real-text guard inside itself."""
    src = (
        "from .ocr_vlm import should_rescue_sfx\n"
        "if should_rescue_sfx(region.text, region.from_sfx_detection, w, h, True):\n"
        "    vlm_localize_sfx(crop)\n"
    )
    assert rescue_has_real_text_guard(src) is True
