"""Post-translation verdicts (#187).

Pure checks pulled off the `MangaTranslator` god object, where they lived as
`async` methods that awaited nothing. Keeping them here — small, dependency-light,
unit-tested — gives a **seam** for new validators to attach (per
feedback_core_boundary) instead of growing the 3,200-line orchestrator. Logic is
verbatim from the originals so behaviour is byte-identical.
"""
import logging
import re

logger = logging.getLogger('manga_translator')


def check_repetition_hallucination(text: str, threshold: int = 5, silent: bool = False) -> bool:
    """True if ``text`` shows model-hallucination repetition (a run of repeated
    characters, segments, or phrases at or above ``threshold``)."""
    if not text or len(text.strip()) < threshold:
        return False

    # Character-level repetition
    consecutive_count = 1
    prev_char = None
    for char in text:
        if char == prev_char:
            consecutive_count += 1
            if consecutive_count >= threshold:
                if not silent:
                    logger.warning(f'Detected character repetition hallucination: "{text}" - repeated character: "{char}", consecutive count: {consecutive_count}')
                return True
        else:
            consecutive_count = 1
        prev_char = char

    # Segment-level repetition (CJK by character, others by whitespace token)
    segments = re.findall(r'[一-鿿]|\S+', text)
    if len(segments) >= threshold:
        consecutive_segments = 1
        prev_segment = None
        for segment in segments:
            if segment == prev_segment:
                consecutive_segments += 1
                if consecutive_segments >= threshold:
                    if not silent:
                        logger.warning(f'Detected word repetition hallucination: "{text}" - repeated segment: "{segment}", consecutive count: {consecutive_segments}')
                    return True
            else:
                consecutive_segments = 1
            prev_segment = segment

    # Phrase-level repetition
    words = text.split()
    if len(words) >= threshold * 2:
        for i in range(len(words) - threshold + 1):
            phrase = ' '.join(words[i:i + threshold // 2])
            remaining_text = ' '.join(words[i + threshold // 2:])
            if phrase in remaining_text:
                phrase_count = text.count(phrase)
                if phrase_count >= 3:
                    if not silent:
                        logger.warning(f'Detected phrase repetition hallucination: "{text}" - repeated phrase: "{phrase}", occurrence count: {phrase_count}')
                    return True

    return False
