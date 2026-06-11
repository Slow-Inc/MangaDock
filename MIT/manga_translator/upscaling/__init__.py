from typing import List
from PIL import Image

from .common import CommonUpscaler, OfflineUpscaler
from .waifu2x import Waifu2xUpscaler
from .esrgan import ESRGANUpscaler
from .esrgan_pytorch import ESRGANUpscalerPytorch
from ..config import Upscaler
from ..dispatch_registry import DispatchRegistry

UPSCALERS = {
    Upscaler.waifu2x: Waifu2xUpscaler,
    Upscaler.esrgan: ESRGANUpscaler,
    Upscaler.upscler4xultrasharp: ESRGANUpscalerPytorch,
}
_registry = DispatchRegistry(UPSCALERS, 'upscaler')

def get_upscaler(key: Upscaler, *args, **kwargs) -> CommonUpscaler:
    return _registry.get(key, *args, **kwargs)

async def prepare(upscaler_key: Upscaler):
    upscaler = get_upscaler(upscaler_key)
    if isinstance(upscaler, OfflineUpscaler):
        await upscaler.download()

async def dispatch(upscaler_key: Upscaler, image_batch: List[Image.Image], upscale_ratio: int, device: str = 'cpu') -> List[Image.Image]:
    if upscale_ratio == 1:
        return image_batch
    upscaler = get_upscaler(upscaler_key)
    if isinstance(upscaler, OfflineUpscaler):
        await upscaler.load(device)
    return await upscaler.upscale(image_batch, upscale_ratio)

unload = _registry.unload
