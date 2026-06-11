from PIL import Image

from .common import CommonColorizer, OfflineColorizer
from .manga_colorization_v2 import MangaColorizationV2
from ..config import Colorizer
from ..dispatch_registry import DispatchRegistry

COLORIZERS = {
    Colorizer.mc2: MangaColorizationV2,
}
_registry = DispatchRegistry(COLORIZERS, 'colorizer')

def get_colorizer(key: Colorizer, *args, **kwargs) -> CommonColorizer:
    return _registry.get(key, *args, **kwargs)

async def prepare(key: Colorizer):
    upscaler = get_colorizer(key)
    if isinstance(upscaler, OfflineColorizer):
        await upscaler.download()

async def dispatch(key: Colorizer, device: str = 'cpu', **kwargs) -> Image.Image:
    colorizer = get_colorizer(key)
    if isinstance(colorizer, OfflineColorizer):
        await colorizer.load(device)
    return await colorizer.colorize(**kwargs)

unload = _registry.unload
