"""Post-translation processing (#187 seam S18).

`apply_post_translation_processing` is the punctuation + post-dictionary +
phase-1 repetition-hallucination retry block, lifted byte-for-byte from
`MangaTranslator._apply_post_translation_processing` (the shared helper that the
batch and concurrent drivers call). `correct_punctuation` (pure) and
`apply_post_dictionary` (#187 S8) already live in their own modules; the two
self-bound async steps — repetition check and per-region retry — arrive as
`check_repetition` / `retry_region` callbacks so this orchestration is unit
testable without the ML stack.

The per-scope **page-level** ratio-check + retry loops (single/batch/concurrent)
are intentionally NOT moved here: their min_ratio (0.5 vs 0.3), region count
thresholds (>=6 vs >10) and collect/reassign strategies are load-bearing
(landmines L6/L8) — folding them into one function would change behaviour, so
they remain as separate scope code in the driver.
"""
import logging
from typing import Awaitable, Callable, List

from .punctuation import correct_punctuation
from .dictionary import apply_post_dictionary

logger = logging.getLogger('manga_translator')


async def apply_post_translation_processing(
    text_regions: List,
    config,
    post_dict,
    *,
    check_repetition: Callable[..., Awaitable[bool]],
    retry_region: Callable[..., Awaitable[str]],
) -> List:
    """Punctuation correction + post-dictionary + phase-1 per-region repetition
    retry. Mirrors `_apply_post_translation_processing`; returns `text_regions`
    (or `[]` when empty), mutating each region's `.translation` in place."""
    # 检查text_regions是否为None或空
    if not text_regions:
        return []

    for region in text_regions:
        if region.text and region.translation:
            region.translation = correct_punctuation(region.text, region.translation)

    # 注意：翻译结果的保存移动到了translate方法的最后，确保保存的是最终结果

    # 应用后字典
    apply_post_dictionary(text_regions, post_dict)

    # 单个region幻觉检测
    failed_regions = []
    if config.translator.enable_post_translation_check:
        logger.info("Starting post-translation check...")

        # 单个region级别的幻觉检测
        for region in text_regions:
            if region.translation and region.translation.strip():
                # 只检查重复内容幻觉
                if await check_repetition(
                    region.translation,
                    config.translator.post_check_repetition_threshold,
                    silent=False
                ):
                    failed_regions.append(region)

        # 对失败的区域进行重试
        if failed_regions:
            logger.warning(f"Found {len(failed_regions)} regions that failed repetition check, starting retry...")
            for region in failed_regions:
                try:
                    logger.info(f"Retrying translation for region with text: '{region.text}'")
                    new_translation = await retry_region(region, config)
                    if new_translation:
                        old_translation = region.translation
                        region.translation = new_translation
                        logger.info(f"Region retry successful: '{old_translation}' -> '{new_translation}'")
                    else:
                        logger.warning(f"Region retry failed, keeping original: '{region.translation}'")
                except Exception as e:
                    logger.error(f"Error during region retry: {e}")

    return text_regions
