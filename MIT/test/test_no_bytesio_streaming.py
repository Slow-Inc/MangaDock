"""#1119: StreamingResponse only over a generator, never over an in-memory buffer or bytes.

Starlette iterates a BytesIO line by line (split on b'\\n'), so a 21.6 MB pickled Context went out as 84,489
chunks and took 30 s on localhost against 0.05 s as one Response (measured 2026-10-25); real pages lost
2.5-13 s per request between the worker finishing and the front receiving. A plain ``bytes`` body is worse:
iterating it yields ints. The rule is checked on the mechanism, not on variable names: the body passed to
StreamingResponse must be a call to a generator function defined in one of the scanned files. The file set is derived
(every .py under server/ and manga_translator/mode/), so a new endpoint is covered the day it lands.
"""
import ast
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]


def _sources():
    for folder in ("server", "manga_translator/mode"):
        yield from (ROOT / folder).rglob("*.py")


def _generator_names(tree):
    return {node.name for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            and any(isinstance(n, (ast.Yield, ast.YieldFrom)) for n in ast.walk(node))}


def _all_generator_names():
    return set().union(*(_generator_names(ast.parse(p.read_text(encoding="utf-8"))) for p in _sources()))


def _bad_streaming_bodies(path, root=ROOT, generators=None):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    generators = _generator_names(tree) | (generators or set())
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and getattr(node.func, "id", None) == "StreamingResponse"):
            continue
        body = node.args[0] if node.args else next((k.value for k in node.keywords if k.arg == "content"), None)
        if not (isinstance(body, ast.Call) and getattr(body.func, "id", None) in generators):
            yield f"{path.relative_to(root).as_posix()}:{node.lineno}"


def test_sources_found():
    assert {"share.py", "main.py"} <= {p.name for p in _sources()}


def test_streaming_response_bodies_are_generators():
    generators = _all_generator_names()
    hits = [hit for p in _sources() for hit in _bad_streaming_bodies(p, generators=generators)]
    assert hits == [], "use Response(content=...) for a ready buffer/bytes: " + ", ".join(hits)


def test_detector_flags_a_buffer_and_bytes_but_not_a_generator(tmp_path):
    # Positive control: the detector must see both shapes this test exists to forbid.
    src = tmp_path / "bad.py"
    src.write_text("def gen():\n    yield b''\n"
                   "a = StreamingResponse(io.BytesIO(b''))\n"
                   "b = StreamingResponse(content=x.to_bytes())\n"
                   "c = StreamingResponse(gen())\n", encoding="utf-8")
    assert list(_bad_streaming_bodies(src, tmp_path)) == ["bad.py:3", "bad.py:4"]
