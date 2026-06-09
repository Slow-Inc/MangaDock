"""Concurrent gather + per-exception placeholder (#187 seam S19).

Runs the concurrent translate tasks with ``return_exceptions=True`` and reconciles the
results index-aligned with ``contexts_with_configs``: a task that raised re-raises the
original exception unless ``ignore_errors``, otherwise it is replaced by a keep-original
placeholder (``apply_original_as_translation`` on that ctx's regions). Verbatim the
inline block from the concurrent driver.
"""
import asyncio
import logging

from .region_apply import apply_original_as_translation

logger = logging.getLogger('manga_translator')


async def gather_per_context(tasks, contexts_with_configs, ignore_errors):
    """Await ``tasks`` and return the per-context results in order. For each that
    raised: re-raise unless ``ignore_errors``, else substitute ``(ctx, config)`` with the
    region translations set to their source text."""
    # 等待所有任务完成 / await all tasks
    try:
        results = await asyncio.gather(*tasks, return_exceptions=True)
    except Exception as e:
        logger.error(f"Error in concurrent translation gather: {e}")
        raise

    # 处理结果，检查是否有异常 / reconcile results, substituting placeholders on failure
    final_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"Image {i+1} concurrent translation failed: {result}")
            if not ignore_errors:
                raise result
            # 创建失败的占位符 / keep-original placeholder
            ctx, config = contexts_with_configs[i]
            if ctx.text_regions:
                apply_original_as_translation(ctx.text_regions, config)
            final_results.append((ctx, config))
        else:
            final_results.append(result)
    return final_results
