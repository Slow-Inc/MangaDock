"""Role-aware emphasis for rendered lettering (#1143 Track A1).

The page analyst already classifies every line (dialogue / thought / narration / sfx / annotation) and gives a
one-or-two-word emotion. Nothing used that for the *look* of the page, so a shouted line and an inner monologue
were typeset identically. This module decides, purely, which lines deserve a heavier face.

Deliberately narrow: only shouts/impact lines go bold; everything else keeps the lighter body face the product
already uses (Prompt-Regular — the developer's preference over the heavier Team default). Opt-in through
MIT_ROLE_FONTS=1 until the look is measured.
"""
import os

#: Emotion words the analyst uses for raised voices. Exact matches on the words of the emotion field, so
#: "angry" and "furious" count but "angrily confused" does not raise the voice on its own.
_LOUD_EMOTIONS = frozenset("""
angry anger furious rage enraged shouting shout yelling yell screaming scream
excited excitement pumped ecstatic loud roaring fierce desperate shock shocked
panic panicked urgent
""".split())

_LOUD_ROLES = frozenset(('sfx',))

_BOLD_FILE = 'Prompt-Bold.ttf'


def _emotion_words(emotion) -> set:
    return {w.strip('.,!?~-').lower() for w in str(emotion or '').split() if w.strip()}


def wants_bold(role, emotion) -> bool:
    """Whether a line should be typeset with the heavier face (pure).

    An sfx role or a raised-voice emotion word. Everything else - dialogue, thought, narration, annotation -
    stays in the body face."""
    return str(role or '').strip().lower() in _LOUD_ROLES or bool(_emotion_words(emotion) & _LOUD_EMOTIONS)


def role_fonts_enabled(env=None) -> bool:
    """MIT_ROLE_FONTS=1 turns the emphasis on; unset/0 keeps every line in the body face."""
    value = str((env if env is not None else os.environ).get('MIT_ROLE_FONTS', '')).strip().lower()
    return value in ('1', 'true', 'yes', 'on')


def bold_font_path(fonts_dir) -> str:
    """The heavier face beside the body face; empty when the file is missing (pure, no side effects)."""
    path = os.path.join(str(fonts_dir), _BOLD_FILE)
    return path if os.path.isfile(path) else ''


def font_for_region(region, base_font: str, loud_font: str, enabled: bool = True) -> str:
    """The font path to use for one region (pure): the loud face for emphasised lines, else the base face."""
    if not enabled:
        return base_font
    if loud_font and getattr(region, 'emphasis', False):
        return loud_font
    return base_font
