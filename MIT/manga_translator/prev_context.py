"""Previous-context string builder (#187 seam S6).

Pure extraction of ``MangaTranslator._build_prev_context``: the per-mode index policy
(single → all done pages; ``current_page_index`` → slice before that page; concurrent
``batch_index`` → done pages plus the already-processed pages of the current batch)
becomes explicit arguments instead of implicit ``self`` state.

Landmines preserved verbatim:
- **L7** the concurrent ``available_pages.index(page)`` is a **first-match** lookup when
  mapping a translated page back to its original — duplicate-content pages resolve to the
  earliest index, by design.
- the ``pages_used == 0`` and ``not available_pages`` short-circuits both return ``""``.
"""


def build_prev_context(all_page_translations, original_page_texts, context_size,
                       *, use_original_text=False, current_page_index=None,
                       batch_index=None, batch_original_texts=None) -> str:
    """Build the ``<|n|>sentence`` reference block from prior pages. Returns ``""`` when
    context is disabled or there is nothing to carry."""
    if context_size <= 0:
        return ""

    # 在并发模式下，需要特殊处理上下文范围 / concurrent mode: special context range
    if batch_index is not None and batch_original_texts is not None:
        available_pages = all_page_translations.copy()
        # 添加当前批次中在当前页面之前的页面 / add this batch's pages before the current one
        for i in range(batch_index):
            if i < len(batch_original_texts) and batch_original_texts[i]:
                if use_original_text:
                    available_pages.append(batch_original_texts[i])
                else:
                    # 不使用原文时跳过本批次页面（尚未翻译完成）
                    pass
    elif current_page_index is not None:
        available_pages = all_page_translations[:current_page_index] if all_page_translations else []
    else:
        available_pages = all_page_translations or []

    if not available_pages:
        return ""

    # 筛选出有句子的页面 / keep only pages that have sentences
    non_empty_pages = [
        page for page in available_pages
        if any(sent.strip() for sent in page.values())
    ]
    pages_used = min(context_size, len(non_empty_pages))
    if pages_used == 0:
        return ""
    tail = non_empty_pages[-pages_used:]

    # 拼接 - 根据参数决定使用原文还是译文 / join — original vs translated per the flag
    lines = []
    for page in tail:
        for sent in page.values():
            if sent.strip():
                lines.append(sent.strip())

    # 如果使用原文，需要从原始数据中获取 / when using originals, pull from the parallel store
    if use_original_text and original_page_texts is not None:
        original_lines = []
        for i, page in enumerate(tail):
            page_idx = available_pages.index(page)  # L7: first-match by content
            if page_idx < len(original_page_texts):
                original_page = original_page_texts[page_idx]
                for sent in original_page.values():
                    if sent.strip():
                        original_lines.append(sent.strip())
        if original_lines:
            lines = original_lines

    numbered = [f"<|{i+1}|>{s}" for i, s in enumerate(lines)]
    context_type = "original text" if use_original_text else "translation results"
    return f"Here are the previous {context_type} for reference:\n" + "\n".join(numbered)
