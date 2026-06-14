"""FluxKleinInpainter registration + guarded smoke (Flux Klein optional inpainter, ADR 003 / #274).

The registry/enum wiring is pure (no GPU, no diffusers) and guards against a typo silently falling
back to LaMa. The real 4-step Klein edit is heavy + non-deterministic, so it is a GUARDED smoke that
skips unless the Q4 model + diffusers/gguf are present locally — CI never depends on a ~10 GB download.
"""
import importlib

import numpy as np
import pytest

from manga_translator.config import Inpainter, InpainterConfig
from manga_translator.inpainting import INPAINTERS, get_inpainter
from manga_translator.inpainting.inpainting_flux_klein import FluxKleinInpainter


def test_enum_has_flux_klein():
    assert Inpainter.flux_klein.value == "flux_klein"


def test_registry_resolves_flux_klein_not_lama():
    assert INPAINTERS[Inpainter.flux_klein] is FluxKleinInpainter      # guards silent fallback-to-LaMa
    inpainter = get_inpainter(Inpainter.flux_klein)
    assert isinstance(inpainter, FluxKleinInpainter)


def test_importing_the_module_does_not_require_diffusers():
    # the module must import with only light deps; the heavy ML stack is imported lazily inside _load,
    # so an environment without diffusers/gguf can still load the registry and run the default LaMa path.
    mod = importlib.import_module("manga_translator.inpainting.inpainting_flux_klein")
    src = importlib.util.find_spec(mod.__name__).origin
    with open(src, "r", encoding="utf-8") as f:
        head = "".join(f.readline() for _ in range(40))
    assert "import diffusers" not in head and "from diffusers" not in head


def test_load_without_diffusers_fails_loudly(monkeypatch):
    # With diffusers absent the inpainter must raise a clear, actionable error (pointing back to the
    # default LaMa path) — never silently degrade. Simulate the missing dep via sys.modules.
    import asyncio
    import sys

    monkeypatch.setitem(sys.modules, "diffusers", None)
    inp = FluxKleinInpainter()
    with pytest.raises(RuntimeError, match=r"diffusers"):
        asyncio.run(inp._load("cpu"))


def _model_available() -> bool:
    try:
        import diffusers  # noqa: F401
        import gguf  # noqa: F401
        from huggingface_hub import try_to_load_from_cache
    except ImportError:
        return False
    hit = try_to_load_from_cache(FluxKleinInpainter._GGUF_REPO, FluxKleinInpainter._GGUF_FILE)
    return isinstance(hit, str)


@pytest.mark.skipif(not _model_available(), reason="Flux Klein Q4 model / diffusers not present locally")
def test_smoke_infer_returns_same_size_and_preserves_outside_mask():
    import asyncio

    rng = np.random.RandomState(0)
    image = rng.randint(0, 256, (256, 192, 3), dtype=np.uint8)
    mask = np.zeros((256, 192), dtype=np.uint8)
    mask[80:140, 40:120] = 255                                        # erase a central box only

    inp = FluxKleinInpainter()
    out = asyncio.run(_run(inp, image, mask))

    assert out.shape == image.shape and out.dtype == np.uint8
    outside = mask < 127
    np.testing.assert_array_equal(out[outside], image[outside])       # outside the mask = byte-identical


async def _run(inp, image, mask):
    await inp.load("cuda")
    try:
        return await inp.inpaint(image, mask, InpainterConfig())
    finally:
        await inp.unload()
