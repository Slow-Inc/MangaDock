"""Role-aware emphasis (#1143 Track A1), torch-free.

Only raised-voice lines get the heavier face; everything else keeps the body face. These tests pin the decision and
the flag, which is all the renderer consults.
"""
from manga_translator.role_fonts import (bold_font_path, font_for_region, role_fonts_enabled, wants_bold)


def test_an_sfx_role_is_loud():
    assert wants_bold("sfx", "") is True
    assert wants_bold("SFX", "neutral") is True


def test_a_raised_voice_emotion_is_loud():
    for emotion in ("angry", "shouting", "furious!", "screaming", "excited"):
        assert wants_bold("dialogue", emotion) is True, emotion


def test_normal_dialogue_and_inner_voice_stay_body_face():
    for role, emotion in (("dialogue", "calm"), ("thought", "sad"), ("narration", ""),
                          ("annotation", "note"), ("dialogue", "shy")):
        assert wants_bold(role, emotion) is False, (role, emotion)


def test_role_fonts_are_opt_in(monkeypatch):
    monkeypatch.delenv("MIT_ROLE_FONTS", raising=False)
    assert role_fonts_enabled() is False
    for on in ("1", "true", "YES", "on"):
        monkeypatch.setenv("MIT_ROLE_FONTS", on)
        assert role_fonts_enabled() is True, on
    monkeypatch.setenv("MIT_ROLE_FONTS", "0")
    assert role_fonts_enabled() is False


class _Region:
    def __init__(self, emphasis):
        self.emphasis = emphasis


def test_font_selection_per_region():
    base, loud = "base.ttf", "loud.ttf"
    assert font_for_region(_Region(True), base, loud, enabled=True) == loud
    assert font_for_region(_Region(False), base, loud, enabled=True) == base
    assert font_for_region(_Region(True), base, loud, enabled=False) == base
    assert font_for_region(_Region(True), base, "", enabled=True) == base   # no loud face shipped


def test_a_missing_bold_face_is_reported_empty(tmp_path):
    assert bold_font_path(tmp_path) == ""
    (tmp_path / "Prompt-Bold.ttf").write_bytes(b"x")
    assert bold_font_path(tmp_path).endswith("Prompt-Bold.ttf")
