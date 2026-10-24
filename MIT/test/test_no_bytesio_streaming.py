"""#1119: never wrap an in-memory buffer in StreamingResponse.

Starlette iterates a BytesIO line by line (split on b'\n'), so a 21.6 MB pickled Context went out as 84,489
chunks and took 30 s on localhost against 0.05 s as one Response (measured 2026-10-25); real pages lost
2.5-13 s per request between the worker finishing and the front receiving. The set of files is derived
(every .py under server/ and manga_translator/mode/), so a new endpoint is covered the day it lands.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
# StreamingResponse whose first argument is an in-memory buffer: io.BytesIO(...) or a *_byte_arr/BytesIO variable.
_BAD = re.compile(r"StreamingResponse\(\s*(io\.BytesIO\(|img_byte_arr\b|BytesIO\()")


def _sources():
    for folder in ("server", "manga_translator/mode"):
        yield from (ROOT / folder).rglob("*.py")


def test_sources_found():
    assert any(p.name == "share.py" for p in _sources()) and any(p.name == "main.py" for p in _sources())


def test_no_streaming_response_over_an_in_memory_buffer():
    hits = [f"{p.relative_to(ROOT)}:{text[:m.start()].count(chr(10)) + 1}"
            for p in _sources() for text in [p.read_text(encoding="utf-8")] for m in _BAD.finditer(text)]
    assert hits == [], "use Response(content=...) instead: " + ", ".join(hits)
