"""Translation side-channel file I/O (#187 seam S10).

The `--load-text` / `--save-text` JSON read/write inside `_run_text_translation` extracted
to `translation_store` so the byte-identical serialisation (indent=4, ensure_ascii=False)
is tested with temp files. The `print(...)` + bare `exit(-1)` (L2) and the
`input_files[0]` filename derivation are intentionally **left inline** at the call site —
the exit is a process-control landmine clearer when visible, and no IndexError guard is
added (that would change behaviour).
"""
from manga_translator.translation_store import read_translations, write_translations


def test_write_then_read_round_trips(tmp_path):
    p = tmp_path / "x_translations.txt"
    write_translations(str(p), ["a", "b", "c"])
    assert read_translations(str(p)) == ["a", "b", "c"]


def test_write_uses_indent4_json_array(tmp_path):
    p = tmp_path / "x_translations.txt"
    write_translations(str(p), ["a", "bb"])
    # byte-identical to json.dump(..., indent=4) — 4-space indent, one element per line
    assert p.read_text() == '[\n    "a",\n    "bb"\n]'


def test_write_keeps_non_ascii_unescaped_ensure_ascii_false(tmp_path):
    # ensure_ascii=False -> a non-ASCII char is written literally, NOT as a \uXXXX
    # escape. Use 'é' (encodable in both cp1252 and utf-8) so the default-encoding
    # open() succeeds regardless of platform; assert the bytes carry no \u escape.
    p = tmp_path / "x_translations.txt"
    write_translations(str(p), ["é"])
    raw = p.read_bytes()
    assert b"\\u00e9" not in raw  # not escaped (ensure_ascii=False preserved)
