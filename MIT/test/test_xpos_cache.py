"""#822: XPOS recomputed its sin/cos/scale tables (CPU arange + host->device copy) on every call —
every beam-search step of every decoder layer. The tables depend only on (length, offset,
downscale, dtype, device); a cached forward must be bit-identical to the uncached one."""
import torch

from manga_translator.ocr.xpos_relative_position import XPOS, apply_rotary_pos_emb, fixed_pos_embedding


def _reference(xpos, x, offset=0, downscale=False):
    length = x.shape[1]
    min_pos = -(length + offset) // 2
    max_pos = length + offset + min_pos
    scale = xpos.scale ** torch.arange(min_pos, max_pos, 1).to(xpos.scale).div(xpos.scale_base)[:, None]
    sin, cos = fixed_pos_embedding(scale)
    if scale.shape[0] > length:
        scale, sin, cos = scale[-length:], sin[-length:], cos[-length:]
    if downscale:
        scale = 1 / scale
    return apply_rotary_pos_emb(x, sin, cos, scale)


def test_cached_xpos_is_bit_identical():
    torch.manual_seed(0)
    xpos = XPOS(32)
    for length, offset, down in [(1, 0, False), (1, 7, True), (12, 0, False), (12, 3, True), (40, 0, False)]:
        for _ in range(2):                      # second pass hits the cache
            x = torch.randn(4, length, 32)
            assert torch.equal(xpos(x, offset=offset, downscale=down), _reference(xpos, x, offset, down))
    assert len(getattr(xpos, '_tables', {})) > 0
