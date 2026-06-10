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


async def concurrent_page_lang_check_retry(
    text_regions: List,
    config,
    ctx,
    *,
    min_regions: int,
    min_ratio: float,
    check_ratio: Callable[..., Awaitable[bool]],
    batch_translate: Callable[..., Awaitable[List]],
) -> None:
    """Concurrent driver's phase-2 page-level target-language check + retry.

    Lifted byte-for-byte from the per-image concurrent path. min_ratio (0.3) and
    min_regions (>=6) are L6 parameters; the retry **filters** empty-text regions
    and reassigns via a running `text_idx` (the divergence from the single
    driver's pad-with-empty + enumerate). The retry re-translate drops page/batch
    index (L8). Mutates `text_regions` in place."""
    # 单页目标语言检查（如果启用）
    if not (config.translator.enable_post_translation_check and text_regions
            and len(text_regions) >= min_regions):
        return
    page_lang_check_result = await check_ratio(
        text_regions,
        config.translator.target_lang,
        min_ratio  # 对单页使用更宽松的阈值
    )

    if not page_lang_check_result:
        logger.warning(f"Page-level target language check failed for single image")

        # 单页重试逻辑
        max_retry = config.translator.post_check_max_retry_attempts
        retry_count = 0

        while retry_count < max_retry and not page_lang_check_result:
            retry_count += 1
            logger.info(f"Retrying single image translation {retry_count}/{max_retry}")

            # 重新翻译
            original_texts = [region.text for region in text_regions if hasattr(region, 'text') and region.text]
            if original_texts:
                try:
                    new_translations = await batch_translate(original_texts, config, ctx)

                    # 更新翻译结果
                    text_idx = 0
                    for region in text_regions:
                        if hasattr(region, 'text') and region.text and text_idx < len(new_translations):
                            old_translation = region.translation
                            region.translation = new_translations[text_idx]
                            logger.debug(f"Region translation updated: '{old_translation}' -> '{new_translations[text_idx]}'")
                            text_idx += 1

                    # 重新检查
                    page_lang_check_result = await check_ratio(
                        text_regions,
                        config.translator.target_lang,
                        min_ratio
                    )

                    if page_lang_check_result:
                        logger.info(f"Single image target language check passed after retry {retry_count}")
                        break

                except Exception as e:
                    logger.error(f"Error during single image retry {retry_count}: {e}")
                    break
            else:
                break

        if not page_lang_check_result:
            logger.warning(f"Single image target language check failed after all {max_retry} retries")
