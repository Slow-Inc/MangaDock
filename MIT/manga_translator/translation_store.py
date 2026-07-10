"""Translation side-channel file I/O (#187 seam S10).

Isolates the ``--load-text`` / ``--save-text`` JSON read/write from
``_run_text_translation``. The serialisation is byte-identical to the inline code
(``indent=4``, ``ensure_ascii=False``). The ``print(...)`` + bare ``exit(-1)`` (L2) and
the ``input_files[0]`` filename derivation stay at the call site — the exit is a
process-control landmine kept visible, and no IndexError guard is added here.
"""
import json


def read_translations(path):
    """Load the saved translations JSON (the ``--load-text`` path)."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_translations(path, sentences) -> None:
    """Persist ``sentences`` as JSON with ``indent=4, ensure_ascii=False`` (the
    ``--save-text`` side channel). ``encoding="utf-8"`` is pinned so Thai/CJK
    translations do not raise ``UnicodeEncodeError`` on a cp1252-default host (#542)."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sentences, f, indent=4, ensure_ascii=False)
