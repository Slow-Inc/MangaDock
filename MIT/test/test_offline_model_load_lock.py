"""#1123 review: two concurrent first-time loads of one model (worker slots) must load it once."""
import asyncio
import tempfile

from manga_translator.utils.inference import ModelWrapper


class _Model(ModelWrapper):
    _MODEL_MAPPING = {}

    @property
    def model_dir(self):          # keep the test out of the real models/ folder
        return tempfile.gettempdir()

    async def _infer(self, *args, **kwargs):
        return None

    def __init__(self):
        super().__init__()
        self.loads = 0

    def is_downloaded(self):
        return True

    async def _load(self, device, *args, **kwargs):
        self.loads += 1
        await asyncio.sleep(0.02)     # a real load yields (download checks, to_thread, ...)

    async def _unload(self):
        pass


def test_concurrent_loads_load_once():
    async def main():
        m = _Model()
        await asyncio.gather(*(m.load("cpu") for _ in range(4)))
        return m.loads
    assert asyncio.run(main()) == 1
