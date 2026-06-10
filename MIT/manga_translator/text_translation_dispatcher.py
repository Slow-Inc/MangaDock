"""Unified ChatGPT/ChatGPT2Stage text-translation dispatch (#187 seam S17).

Collapses the chatgpt-translator handling that was duplicated in ``_dispatch_with_context``
(single) and ``_batch_translate_texts`` (batch). Two functions, because the **construction
order is load-bearing**: ``OpenAITranslator.__init__`` can emit a glossary warning, and the
single path constructs the translator *after* the context log while the batch path
constructs it *before* — so each caller invokes ``build_chatgpt_translator`` at its own
point (preserving order) and then ``dispatch_translate`` does the order-invariant rest.

The caller owns the **non-chatgpt** fallback and the context computation (``prev_ctx`` /
``pages_used`` / ``skipped``); single computes it unconditionally, batch only inside its
own chatgpt branch — that divergent placement is preserved.

Per-mode divergence is parameterised:
- ``result_path_callback`` — what chatgpt_2stage sets on ``ctx``: single passes the bound
  ``_result_path``; batch passes an image-context swap closure.
- ``on_2stage_batch_setup(ctx)`` — wires the multi-image ``batch_contexts`` callbacks
  (batch only; ``None`` for single).
"""
import logging

from .config import Translator

logger = logging.getLogger('manga_translator')


def build_chatgpt_translator(translator_kind):
    """Construct the chatgpt translator (lazy import, verbatim). Kept separate from
    ``dispatch_translate`` so each caller can construct it at the point that preserves its
    original ordering relative to the context log (the ctor can warn about the glossary)."""
    if translator_kind == Translator.chatgpt:
        from .translators.chatgpt import OpenAITranslator
        return OpenAITranslator()
    else:  # chatgpt_2stage
        from .translators.chatgpt_2stage import ChatGPT2StageTranslator
        return ChatGPT2StageTranslator()


async def dispatch_translate(translator, texts, config, ctx, prev_ctx, pages_used, skipped, *,
                             result_path_callback, on_2stage_batch_setup):
    """Run an already-constructed chatgpt / chatgpt_2stage ``translator``: parse args, set
    the previous context, log the carry/skip counts, and translate (chatgpt_2stage takes
    ``ctx`` + a ``result_path_callback``; plain chatgpt does not)."""
    translator.parse_args(config.translator)
    translator.set_prev_context(prev_ctx)

    if pages_used > 0:
        context_count = prev_ctx.count("<|")
        logger.info(f"Carrying {pages_used} pages of context, {context_count} sentences as translation reference")
    if skipped > 0:
        logger.warning(f"Skipped {skipped} pages with no sentences")

    if config.translator.translator == Translator.chatgpt_2stage:
        # ChatGPT2Stage 需要 ctx + result_path_callback（让 translator 保存 bboxes_fixed.png）
        ctx.result_path_callback = result_path_callback
        if on_2stage_batch_setup is not None:
            on_2stage_batch_setup(ctx)
        return await translator._translate(ctx.from_lang, config.translator.target_lang, texts, ctx)
    else:
        # 普通 ChatGPT 不需要 ctx 参数
        return await translator._translate(ctx.from_lang, config.translator.target_lang, texts)
