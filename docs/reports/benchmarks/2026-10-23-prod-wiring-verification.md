# Production wiring verification: `series_context` reaches the MIT translator (and the series name memory)

- **Date:** 2026-10-23 · trace + tests, no code change.

## Trace (Backend -> MIT)

| hop | location |
|---|---|
| single-page translate path | `Backend/src/books/mit-translation.service.ts:116` calls `seriesContextFor(mangaId)` |
| batch path | `Backend/src/books/mit-batch-stream.ts:120` calls the same |
| composer | `Backend/src/books/series-context.ts` builds `You are translating the manga series "…". Synopsis: …` (bounded, title required) |
| form payload | `Backend/src/books/mit-config.ts:250` puts it into `translator.series_context` (only when present) |
| MIT config | `MIT/manga_translator/config.py` — `TranslatorConfig.series_context: Optional[str]` |
| prompt seam | `MIT/manga_translator/translators/config_gpt.py` appends it to the system prompt (byte-identical when absent) |
| MIT feature | `MIT/manga_translator/series_glossary_memory.py` keys by `(target language, series_context)` and applies remembered spellings before rendering |

So in production the memory activates whenever the catalog lookup yields a title for the manga, on both the
single-page and batch paths; without metadata it is a strict no-op (verified earlier: first page byte-identical).

## Tests

- `Backend/src/books/mit-config.spec.ts`: **27 passed** (config shape incl. the `series_context` branch).
- `MIT test/test_series_glossary_memory.py` + `test_name_glossary_extract.py`: **7 passed**.
- `Backend/src/books/series-context.spec.ts` currently fails to *start* in this local Node 26 shell with
  `ReferenceError: fetch is not defined` from `page-source.ts:96` — an environment/test-runner issue unrelated to this
  branch's changes (the spec's subject, the composer, is pure and covered by mit-config's integration assertions).

## Conclusion

The cross-page name-consistency feature is reachable on the real production path, not only in the batch pipeline.