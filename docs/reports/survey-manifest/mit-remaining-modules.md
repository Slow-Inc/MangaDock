# MIT Remaining Modules — Deep Survey

Survey date: 2026-07-04. Branch read: `perf/mit-layout-fit-and-merge` (compared against `origin/main` @ `3d808d42e7756f799a6c165a73820ab4177d4816` where noted). Many of the "modified" files below carry **uncommitted working-tree edits** on top of their last commit — each entry notes this explicitly where it applies, since `git log -1` only reports the last *committed* touch.

The single most technically interesting finding is the font-size fitting algorithm in `MIT/manga_translator/font_fit.py`: a deliberately dependency-light, ~35-line integer **binary search** (`fit_font_size`, lines 23-57) that calls a caller-injected `measure(size) -> (w, h)` closure and accepts the largest font size whose measured wrapped-text block still fits the balloon box under a `margin` factor (e.g. 0.92) — the margin exists specifically because rounding/glyph ascent-descent slack was found to clip text in benchmark renders. This binary search is wired to the *real* text wrapper (`text_render.calc_horizontal`) as its measure function, so the search's prediction is exactly what gets rendered — no separate approximation model. Layered on top of it, `text_render.py`'s Thai/CJK handling pre-segments spaceless scripts into pseudo-words (via `pythainlp`/`jieba`, optional imports) before a pluggable line-breaker (`GreedyLineBreaker` default, `KnuthPlassLineBreaker` behind a flag) packs lines, and a `_safe_char_split` last-resort splitter refuses to ever start a new line with a Thai non-spacing combining mark (tone/vowel signs `0x0E31`, `0x0E34-0x0E3A`, `0x0E47-0x0E4E`), preventing corrupted glyph rendering — while the newer Knuth-Plass DP in `line_break.py` itself has no grapheme awareness at all and is "safe by omission" (it never force-splits a token, so an unsegmented Thai run would overflow a line rather than corrupt it).

---

## OCR

### MIT/manga_translator/ocr_vlm.py
- **last_commit:** c31ff81e6696da51edd525447e0433bf980bcf4e (branch `perf/mit-layout-fit-and-merge`) — **plus an uncommitted working-tree diff on top** (file shows `M` in `git status`)
- **lines_covered:** 1-190 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Not a general OCR engine — a narrow **vision-LLM rescue path** for stylized SFX glyphs the classical 48px line-OCR drops as sub-threshold garbage (docstring lines 1-14; feature #168/PRD #172, hardened by #278).
  - `vlm_localize_sfx` (lines 149-190) POSTs to an **OpenAI-compatible chat-completions endpoint** (`api_base.rstrip('/') + "/chat/completions"`, line 180) with `api_base`/`api_key`/`model` all passed in by the caller — no hardcoded Gemini/Qwen SDK; docstring (line 6) names the gateway as "custom_openai"/"9arm", the same gateway the translator layer uses.
  - `_to_data_url` (lines 101-105): PIL-encodes an HWC RGB crop to a base64 `data:image/png;base64,...` URL for the vision request.
  - `build_sfx_prompt` (lines 47-61): per-target-language instruction — base template (lines 56-59) asks for "ONLY the {name} onomatopoeia... 1-3 words... no explanation"; `UPPERCASE` only injected for Latin-script targets (`_LATIN_SFX_LANGS`, lines 29-32); explicit script hint per target (`_SFX_SCRIPT_HINT`, lines 39-44, e.g. THA → "Write it in Thai script only.") added because qwen-VL was observed echoing Japanese kana for CJK/Thai targets (comment lines 37-38). Request uses `max_tokens: 24, temperature: 0` (lines 172-173) for deterministic short completions.
  - `sanitize_sfx` (lines 108-135): takes first non-empty line (116); Latin targets regex-strip to letters/space/`!`/`-`, uppercase, reject refusal strings `NONE/N A/NA/EMPTY` (118-120); non-Latin targets keep Unicode categories `L*`/`M*` (letters + combining marks — explicitly needed for Thai tone/vowel marks, comment 123-124); result capped to 24 chars (135).
  - `should_rescue_sfx` (lines 76-98, pure, no network): requires `vlm_rescue` flag; skips if line-OCR already read real ASCII (`ocr_read_real_text`, 64-73, regex `[A-Za-z0-9]`); length gate ≤4 chars if provenance is `det_sfx` (`from_sfx_detection=True`) else tighter ≤2 chars (93-95, the #278 fix replacing an earlier "any ≤4-char region" heuristic that mis-rescued short dialogue like "HUH?"); size gate: area ≥3600px², min side ≥24px (96-97).
  - Error handling: single `try/except Exception` around the whole network+parse call (166-190); any failure logs a warning with `exc_info=True` and returns `''` (pipeline degrades to pre-feature behavior). No retry. `post_fn` is dependency-injected (default `requests.post`) purely so tests can fake the HTTP call (comment lines 11-13).
  - No caching in this file. `restore_sfx_translations` (138-146) runs post-translate: for regions flagged `region.sfx_rescued`, copies `region.text` back into `region.translation` — needed because the translator stage blanks an already-target-language single word, which would otherwise be dropped by `filter_translated_regions` before render.
  - Only caller in the codebase is `manga_translator.py` (grep-confirmed).

### MIT/manga_translator/ocr/common.py
- **last_commit:** eb68e5658d5d8eeffb78c87c11394e25b8135644 (branch `perf/mit-layout-fit-and-merge`)
- **lines_covered:** 1-61 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `CommonOCR(InfererModule)` (line 11) defines the interface: `_generate_text_direction` (12-39, non-abstract) groups `TextBlock`/`Quadrilateral` inputs by direction — for raw quads it builds a merge-graph (networkx) via `quadrilateral_can_merge_region`, takes connected components, majority-votes `h`/`v` per component (18-39).
  - Public entry `async recognize(image, textlines, config: OcrConfig, verbose=False)` (41-46) delegates to abstract `async _recognize(...)` (48-50) that concrete engines implement.
  - `OfflineOCR(CommonOCR, ModelWrapper)` (53): `_MODEL_SUB_DIR = 'ocr'` (54); implements `_recognize` as `await self.infer(...)` (56-57), requiring subclasses instead implement `abstractmethod async _infer(image, textlines, args: OcrConfig, verbose=False)` (59-61).
  - Legacy classical-OCR engines in `MIT/manga_translator/ocr/`, checked for live wiring (grep against `ocr/__init__.py`'s `Ocr` registry): `model_32px.py` (693 lines, `Ocr.ocr32px`) — **active**; `model_48px.py` (855 lines, `Ocr.ocr48px`, the "48px line-OCR" `ocr_vlm.py`'s docstring references) — **active**; `model_48px_ctc.py` (554 lines, `Ocr.ocr48px_ctc`) — **active**; `model_manga_ocr.py` (295 lines, `Ocr.mocr`) — **active**; `model_ocr_large.py` (559 lines, defines `ResNet`/`PositionalEncoding`/etc.) — **not referenced anywhere else in the codebase; vestigial, unreachable via the `Ocr` dispatch enum**; `xpos_relative_position.py` (103 lines) — active only as an internal import of `model_48px.py`, not registry-facing.

---

## Translators

### MIT/manga_translator/translators/common_gpt.py
- **last_commit:** 6faefe679b9886dbad19045207973a69791441d9 (branch `perf/mit-layout-fit-and-merge`)
- **lines_covered:** 1-506 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `CommonGPTTranslator(ConfigGPT, CommonTranslator)` (line 13) is the shared base for all chat/LLM translators (Gemini, Qwen3, ChatGPT, DeepSeek, Sakura all descend from this or `common_gpt`'s helpers).
  - `withinTokenLimit` (102-125) short-circuits on utf-8 byte length ≤ `_MAX_TOKENS_IN` before invoking the real (possibly expensive) token counter.
  - `fallback_fewShot` (133-162) builds a manual `<EXAMPLE>` block from `get_sample(to_lang)` for models lacking native chat-turn few-shot examples.
  - `_assemble_prompts` (164-225, generator) batches queries into `<|N|>text`-tagged prompts, splitting into multiple chunks only when the assembled prompt would exceed `_MAX_TOKENS_IN` (checked at line 195), using a per-query token estimate plus an ID-tag buffer (198-216).
  - `_assemble_request` (227-246) builds the chat `messages`: system prompt (`chat_system_template.format(to_lang=)`, 228) + optional one-shot user/assistant pair from `self.chat_sample[to_lang]` (230-232) + batched prompt; request kwargs include `model`, `max_tokens=_MAX_TOKENS//2`, `temperature`, `top_p`, `timeout=_TIMEOUT`.
  - `_parse_response` (249-263) splits on `<\|\d+\|>`, strips, raises `Warning` (retry signal) if a single-query response is missing its ID prefix.
  - `_ratelimit_sleep` (265-276): plain non-bucketed throttle, `60/_MAX_REQUESTS_PER_MINUTE` sleep gated on `_last_request_ts`.
  - `_CommonGPTTranslator_JSON` (280-507, composition not inheritance) is a parallel structured-output path: builds `TranslationList`/`TextValue` pydantic objects (311-359); attaches `response_format=TranslationList` or appends the JSON schema text to the system message when unsupported (396-403); validates and reassembles by ID with fallback to original text if an ID is missing (419, 452).
  - No glossary/dictionary injection anywhere in this file — only chat-sample few-shot.

### MIT/manga_translator/translators/gemini.py
- **last_commit:** 48840f38729c37c61f27eeb8575884850b4363c8 (branch `perf/mit-layout-fit-and-merge`)
- **lines_covered:** 1-616 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `GeminiTranslator(CommonGPTTranslator)` (line 19), uses `google.genai` SDK; model resolved from env `GEMINI_MODEL` with a per-request override `_model_override` (feature #87, set in `parse_args` from `args.model`, lines 104-105, 253-270), falling back via `_model()` (267-270).
  - Constructor validates `GEMINI_MODEL` against `client.models.list()` (118-146), raising `ValueError` if not found.
  - Safety settings hard-set to `BLOCK_NONE` for all 4 harm categories (197-210), citing Google's cookbook for fiction/manga content.
  - **Gemini-specific context caching**: `_MIN_CACHE_TOKENS=4096`, `_CACHE_TTL=3600`s (82-86); `useCache` property (215-251) checks model capability and recreates the cache near expiry via `_createContext`/`_needRecache` (318-333); caching is bypassed when a per-request model override differs from `GEMINI_MODEL` since a cache is bound to its creating model (232-233).
  - Non-streaming only: `_request_translation` (446-508) calls `client.aio.models.generate_content` once per prompt, reads `response.text` — no `stream=True` path.
  - Retry/error handling in `_translate` (335-439): `_RETRY_ATTEMPTS=3` per batch; distinguishes `genai.errors.APIError` (server-error counter, 394-401) from generic `Exception` (402-406); on exhaustion, recursively **bisects the batch** up to `MAX_SPLIT_ATTEMPTS=5` (409-424) — a fallback not present in `common_gpt`.
  - JSON mode variant `_GeminiTranslator_json` (512-617) sets `response_mime_type='application/json'` + `response_schema=TranslationList` (555-556) instead of tagged-text parsing.
  - Thai handling: only an ordinary language-map entry (`'th': 'Thai'`), and it is inside a **commented-out/dead docstring block** (lines 39-80) — no active Thai-specific branch in this file.

### MIT/manga_translator/translators/qwen3.py
- **last_commit:** 3337e58e7535f6b775607ef5e3049229afcbd747 (branch `perf/mit-layout-fit-and-merge`)
- **lines_covered:** 1-176 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `Qwen3Translator(OfflineTranslator, ConfigGPT)` (line 40) — **local/self-hosted** HF `AutoModelForCausalLM` (`_load`, 79-90), model id from env `QWEN3_MODEL` (default `Qwen/Qwen3.5-4B`, line 69), `device_map='auto'`. Not an API call, unlike Gemini.
  - Quantization via `build_load_kwargs` (15-37): fp8/bf16/fp16 dtype or bitsandbytes int8/int4 `BitsAndBytesConfig`.
  - **Thinking-mode handling present**: `tokenize()` calls `apply_chat_template(..., enable_thinking=False)` (141-146, requires transformers ≥4.51.0 per comment) to suppress Qwen3's reasoning trace; `_strip_think_tags` (10-12) is a regex safety net stripping any leftover `<think>...</think>` for older transformers versions.
  - Context window: `truncation=True, max_length=self.tokenizer.model_max_length` (line 156).
  - `_infer` (96-124) does a single `model.generate` call — **no retry/batch-split logic**, unlike Gemini — and manually reimplements the `<|N|>` tag-split parsing (113-124) rather than reusing `common_gpt`'s shared methods.
  - `Qwen3BigTranslator` (161-177) is an 8B variant reading `QWEN3_BIG_MODEL`/`QWEN3_BIG_PRECISION` env vars.
  - Thai handling: only an ordinary language-map entry `'THA': 'Thai'` (line 65) — no special-cased logic.

### MIT/manga_translator/translators/selective.py
- **last_commit:** eb68e5658d5d8eeffb78c87c11394e25b8135644 (branch `perf/mit-layout-fit-and-merge`)
- **lines_covered:** 1-75 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Only routes among **offline non-LLM** translators (M2M100/Sugoi), not Gemini/Qwen3/GPT: `SelectiveOfflineTranslator.select_translator` (32-37) picks Sugoi first if the language pair is supported, else falls back to `m2m100_big`; `langid`-based auto source-language detection (40-43).

### MIT/manga_translator/translator_chain.py
- **last_commit:** 33cec2956183386a1f241c2f54cdede423c796cc (branch `perf/mit-layout-fit-and-merge`)
- **lines_covered:** 1-32 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `parse_translator_chain` (14-32) parses a `'trans1:lang1;trans2:lang2'` config string into ordered `(translator, lang)` tuples — the actual **config-driven per-language-pair routing/chaining mechanism**; validates each token against `valid_translators`/`valid_languages`, raising `ValueError`/`KeyError` on bad input.

### MIT/manga_translator/text_translation_dispatcher.py
- **last_commit:** aa918cbc9d8b9587060ebbb4be04b289ad205fe2 (branch `perf/mit-layout-fit-and-merge`)
- **lines_covered:** 1-61 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Handles only `chatgpt`/`chatgpt_2stage` (not gemini/qwen3 directly): `build_chatgpt_translator` (27-36) lazy-imports+constructs; `dispatch_translate` (39-61) calls `parse_args`+`set_prev_context`, branches on `Translator.chatgpt_2stage` for context-carry bbox handling (53-58) vs plain single-shot (59-61). No cross-translator fallback-on-failure logic here (lives in `manga_translator.py`, out of this survey's scope).

### MIT/manga_translator/dispatch_registry.py
- **last_commit:** 495302c4750cee495f5622fac31b72af701e48e1 (branch `perf/mit-layout-fit-and-merge`)
- **lines_covered:** 1-33 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Generic lazy-instantiate-and-cache registry (`DispatchRegistry.get`, 24-30), shared across detector/OCR/inpainter/upscaler/translator registries — not translator-specific; raises `ValueError` listing valid keys if the requested key is absent (26).
  - **Thai-specific handling across the whole translator group**: none found beyond ordinary language-name map entries (`gemini.py` dead docstring, `qwen3.py` line 65) — no Thai-only prompt wording or code path in any of these 7 files.

---

## Rendering

### MIT/manga_translator/font_fit.py
- **last_commit:** bc6902cf88163ca1877449942215a716adceec04 (branch `perf/mit-layout-fit-and-merge`)
- **lines_covered:** 1-57 (full)
- **read_date:** 2026-07-04
- **findings:**
  - **Headline algorithm.** Deliberately dependency-light — no ML/PIL imports (lines 1-8).
  - `font_high_cap(h_box, max_box_ratio, floor=8)` (12-20): not a search, a formula — `max(floor, int(h_box * max_box_ratio))` — caps the search ceiling so a short line in a tall balloon can't render oversized (`max_box_ratio` default 0.5, PRD #175).
  - `fit_font_size(box_wh, measure, low=8, high=64, margin=1.0)` (23-57): standard **integer binary search**, `mid=(lo+hi)//2` (50), calling caller-supplied `measure(size) -> (block_w, block_h)`. Fits when `block_w <= w_box*margin AND block_h <= h_box*margin` (46, 52); on fit records `best=mid`, searches higher (`lo=mid+1`), else `hi=mid-1` (52-56); if even `low` overflows, returns `low` (a too-tight floor beats invisible text, per docstring line 44).
  - `margin` (#175, e.g. 0.92) exists specifically to stop rounding/glyph ascent-descent slack from pushing text past the balloon edge — documented (lines 37-40) as the cause of clipped benchmark renders.
  - `measure` is injected so the search stays pure/testable; production wires it to the real wrapper `text_render.calc_horizontal`, so the search's prediction equals what actually renders.

### MIT/manga_translator/rendering/text_render.py
- **last_commit:** 851a1280eacb2e26426cd747dda31aa897028ce3 (branch `perf/mit-layout-fit-and-merge`) — **plus uncommitted working-tree edits** (`M` in git status)
- **lines_covered:** 1-1309 (full)
- **read_date:** 2026-07-04
- **findings:**
  - **Vertical (tategaki) layout**: `calc_vertical`/`_calc_vertical_impl` (374-424) walk glyphs top-to-bottom accumulating `vertAdvance`, breaking columns at `max_height`; `CJK_Compatibility_Forms_translate` (192, tables 96-187) swaps horizontal punctuation glyphs for vertical presentation forms. `put_char_vertical`/`put_text_vertical` (475-636) place glyphs column-by-column right-to-left (`pen_orig[0] -= spacing_x + font_size`, 629).
  - **Thai grapheme-safety**: `_THAI_COMBINING` (56-60) is a frozenset of Thai non-spacing marks (MAI HAN-AKAT `0x0E31`, SARA I..U+PHINTHU `0x0E34-0x0E3A`, tone marks `0x0E47-0x0E4E`) that must never start a line. `_safe_char_split()` (63-74) is the last-resort break unit: walks char-by-char, appends a combining mark to the *previous* cluster instead of emitting it standalone (docstring 53-55: guards against "orphaning the mark and corrupting the rendered glyph"). Used wherever a syllable/word must be forcibly split (`_split_into_syllables`, 719, 726).
  - **Word-boundary insertion for spaceless scripts**: `_insert_thai_word_breaks` (77-87, via optional `pythainlp.word_tokenize`) inserts zero-width spaces at Thai word boundaries so `calc_horizontal`'s regex tokenizer (`_split_words_and_widths`, 696, splits on `[\s​]+`) wraps on real words rather than arbitrary characters; `_insert_cjk_word_breaks` (40-50, via optional `jieba`) is the Chinese analogue.
  - `calc_horizontal` (905-1117): pre-segments Thai/CJK (914-915), auto-grows the box via `np.sqrt` multiplier if text can't fit even at max lines (928-941), splits into hyphenator syllables (945), then packs lines via a pluggable `LineBreaker` `Protocol` (795): default `GreedyLineBreaker` (819, byte-identical to legacy greedy packing `_greedy_pack`, 733) or `KnuthPlassLineBreaker` (832, wraps the DP in `line_break.py`) — selected behind `render.bubble_area_fit`, **off by default so production stays byte-identical** (845-847). Backward hyphenation across line boundaries and single-char-syllable merging only run for greedy output (`breaker.greedy_postprocess` gate, 988).
  - **No font-fit search lives here** — this file is purely the `measure()` target called by `font_fit.fit_font_size` via `rendering/__init__.py`'s closures.
  - Hyphenation: `select_hyphenator` (line 638) picks a `hyphen.Hyphenator` per BCP-47 tag, with a French tag remap (`fr`→`fr_FR`, 90-94).
  - **Stroke/outline**: `_render_glyph_stroke()` (426-445) uses `freetype.Stroker` (round join/cap, radius `64*max(int(0.07*font_size),1)` in 1/64px units, line 437) — shared by horizontal and vertical placement.
  - **Branch diff vs origin/main**: `git diff origin/main...HEAD` shows exactly **+24/-0 lines**: adding `@functools.lru_cache(maxsize=None)` to `select_hyphenator` (line 638) — a perf fix (measured ~163-372ms per uncached call × ~68 calls/page ≈ 22s/page) with a documented tradeoff: a failed `Hyphenator` construction (e.g. Thai, no dictionary) is cached as a sticky `None` until worker restart (see also project memory "select_hyphenator lru_cache failure-caching tradeoff").

### MIT/manga_translator/rendering/__init__.py
- **last_commit:** a116b41c3e8d9460b50925b333df96d9016adf2a (branch `perf/mit-layout-fit-and-merge`) — **plus uncommitted working-tree edits**
- **lines_covered:** 1-817 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Orchestration entry: `dispatch()` (582) → `resize_regions_to_font_size()` (279, the layout-fit driver) → per-region `render()` (679, rasterization).
  - `_bubble_fit_layout()` (93-162) is the binary-search caller: builds a `measure(size)` closure (124-132) invoking `text_render.calc_horizontal`, rejecting sizes that force-break a single word wider than the column (pre-segmented for CJK/Thai via `_insert_cjk_word_breaks`/`_insert_thai_word_breaks`, 110-115). Bounds from `bubble_fit_bounds(h_box, font_size_minimum)` (137), then `fit_font_size(...)` (140). After font-fit, `squeeze_width()` (154) narrows the wrap column so the block fills the balloon's height with more lines rather than a few wide lines with dead space below — floored at the longest token's width so squeezing can never force a word split (146).
  - `resize_regions_to_font_size()` (279) branches per-region into four paths tried in order: (1) bubble-fit sole occupant (354); (2) bubble-fit shared occupant (385, #436 — multiple regions in one over-merged balloon, each fit to its own detection box); (3) clean-layout (416, narration/captions at a small absolute font, `_clean_layout_dst` 224, SFX exempted); (4) legacy fallback (440, original min-rect scaling by translation/source length ratio, `_LEN_RATIO_FONT_GAIN` etc. 68-74). All four funnel into `dst_points_list`, warped via `cv2.findHomography`/`warpPerspective` in `render()` (777-781).
  - **Supersampling** (`render()`, 679-797): `ss = max(1, int(supersampling))` (690); glyph canvas rendered at `region.font_size * ss` (718, 732) then downscaled with `cv2.INTER_AREA` (746-751) for antialiasing; `ss=1` is explicitly documented as byte-identical to no supersampling (comment 689).
  - Per-language branching: `target_lang`/`lang` threaded through (103, 262, 467) into `calc_horizontal`'s Thai/CJK pre-segmentation; direction (`region.horizontal`/`.vertical` or explicit override, 703-712) selects `put_text_horizontal` vs `put_text_vertical`.

### MIT/manga_translator/patch_renderer.py
- **last_commit:** c31ff81e6696da51edd525447e0433bf980bcf4e (branch `perf/mit-layout-fit-and-merge`)
- **lines_covered:** 1-298 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `PatchRenderer.process_group()` (73-298) is the per-region-group pipeline: padded crop box (optionally grown to cover the whole balloon when `bubble_area_fit`, 98-109) → local `Context` → mask refinement (CRF-refined ∪ text-only fallback, 143-150) → optional mask-tighten (#268) → inpaint (sliced from a full-page inpaint, or per-crop with optional wider-context padding, 123-195) → luminance re-ground / optional Poisson seamless-clone (#268, 217-244) → `driver._run_text_rendering` (call into `rendering/__init__.py`, line 250) → optional edge feathering (`feather_alpha`, #173, 263-271) → PNG-encode off the event loop (`compress_level=1`, ~10x faster than `optimize=True`, 273-283) → returns byte-stable `{x, y, w, h, img_png}` dict (the HTTP contract, line 12).

### MIT/manga_translator/line_break.py
- **last_commit:** 9739b9d6b861c23a4ca3fd59175159952f5caab9 (branch `perf/mit-layout-fit-and-merge`)
- **lines_covered:** 1-63 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `find_optimal_line_breaks(tokens, max_width, word_width, ...)` (14-63): classic O(n²) Knuth-Plass-style DP — `cost[i]` = min total badness to break the first `i` tokens; `badness = max(0, max_width-line_width)**badness_exponent` plus a `hyphen_penalty` (1000.0) if the line's last token ends in `-` (49-52). Ported from MangaTranslator upstream `core/text/text_processing.py:489-579` (comment line 7).
  - **Thai-safety verdict: NOT grapheme-aware at this layer.** Operates strictly at whole-token granularity — never splits a token — so it inherits whatever tokenization the caller supplies; does not itself reference `_THAI_COMBINING` or grapheme clusters. If fed raw unsegmented Thai (bypassing `text_render._insert_thai_word_breaks`), the entire spaceless string would be one "token", and the DP's fallback ("a single token wider than max_width is still allowed on its own line", line 27) means it would **not** split it — resulting in an overflow line, not corruption. Net: safe by omission, not by an explicit guard; the actual grapheme-safety guarantee lives in `text_render.py`'s `_safe_char_split`/`_insert_thai_word_breaks`.

### MIT/manga_translator/sfx_merge.py
- **last_commit:** bc6902cf88163ca1877449942215a716adceec04 (branch `perf/mit-layout-fit-and-merge`)
- **lines_covered:** 1-33 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Pure-geometry IoA (intersection-over-candidate-area) dedup for the AnimeText YOLO SFX second pass (#168): an SFX candidate box is dropped if ≥0.2 of its own area is already covered by an existing DBNet textline box, preventing SFX detection from duplicating dialogue.

### MIT/manga_translator/text_layer.py
- **last_commit:** f1f238e355ad389de32282580443530aa92b336a (branch `perf/mit-layout-fit-and-merge`)
- **lines_covered:** 1-21 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Trivial stdlib-only payload builder: `regions_payload(regions)` returns `[{src, dst}]` per rendered region in render order, duck-typed off `.text`/`.translation`, feeding downstream rolling-context/translation-memory consumers without re-OCR.

---

## Config/Utils

### MIT/manga_translator/config.py
- **last_commit:** c31ff81e6696da51edd525447e0433bf980bcf4e (branch `perf/mit-layout-fit-and-merge`) — **plus uncommitted working-tree edits**; committed diff vs `origin/main` is empty (changes are all in the working tree)
- **lines_covered:** 1-483 (full)
- **read_date:** 2026-07-04
- **findings:**
  - All config groups are `pydantic.BaseModel`s. **`RenderConfig`** (148-247): `font_size_minimum: int = -1` (157, "default image_sides_sum/200"); `bubble_area_fit: bool = False` (159, #166, size font to balloon area instead of source column); `en_comic_font`/`en_font` (163-169, #176); `supersampling: int = 1` (170-172, #181); `font_max_box_ratio: float = 0.5` (173-177, caps #166 bubble-fit font); `font_size_max: int = 0` (178-182, caps non-SFX render font, SFX exempt); `anti_overlap: bool = False` (183-186); `clean_layout: bool = False` (187-192); `patch_feather_radius: int = 0` (193-197, #173); **`patch_content_alpha: bool = False`** (198-204, **branch-new/uncommitted, #436**: makes each patch opaque only over changed pixels so overlapping balloons don't erase each other's text).
  - **`UpscaleConfig`** (249-255), **`TranslatorConfig`** (271-349: `translator`, `target_lang: str = 'ENG'`, `series_context` #157, `prev_context` #159, post-translation-check knobs), **`DetectorConfig`** (352-379: `detection_size: int = 2560`, `det_bubble_seg: bool = False` #170, `det_sfx: bool = False` #168), **`InpainterConfig`** (381-412: `inpainter: Inpainter = Inpainter.lama_large`, `inpaint_context_pad` #249, `lama_lum_reground`/`mask_tighten`/`seamless_clone` #268), **`ColorizerConfig`** (414-420), **`OcrConfig`** (422-436, `vlm_rescue: bool` #168/#172), top-level **`Config`** (438-469), `parse_and_validate_config()` (472-483, #192).
  - No Thai-specific config field exists (Thai is handled via presets in `textblock.py`, not here). **Branch-new:** only `patch_content_alpha` (#436), currently uncommitted.

### MIT/manga_translator/utils/textblock.py
- **last_commit:** ddff30c7f662395b1cf36e612eddb1fe2d9c07e4 (branch `perf/mit-layout-fit-and-merge`) — **plus uncommitted working-tree edits**; committed diff vs `origin/main` is empty
- **lines_covered:** 1-490 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `TextBlock.__init__` (45-124) fields: `lines`, **`from_sfx_detection: bool = False`** (73/78, **branch-new/uncommitted, #278** — provenance flag so SFX rescue gates on origin instead of a bare ≤4-char heuristic), `language`, `font_size`, `angle`, `_direction`, `texts`/`text` (CJK-aware join, 87-94), `prob`, `translation`, `fg_colors`/`bg_colors`, `font_family`, style flags (`bold`/`underline`/`italic`), `rich_text`, `line_spacing`/`letter_spacing`, `_alignment`, `_source_lang`/`target_lang`, `_bounding_rect`, `default_stroke_width`, `font_weight`, `adjust_bg_color`, `opacity`, `shadow_*`.
  - Computed properties: `xyxy`/`xywh`/`center` (126-142), `unrotated_polygons`/`unrotated_min_rect`/`min_rect` (144-171, angle-aware), `polygon_aspect_ratio`/`aspect_ratio`/`unrotated_size` (173-193), `area`/`real_area` (195-207), `source_lang` (langid-based, 290-294), `direction` (374-414, language-preset lookup then largest-line-aspect-ratio fallback), `vertical`/`horizontal` (416-422), `alignment` (424-461), `stroke_width` (463-468), `is_bulleted_list` (325-346). Methods: `get_transformed_region` (perspective warp, 228-288), `get_translation_for_rendering` (RTL reordering, 296-323), `set_font_colors`/`update_font_colors`/`get_font_colors`. Module-level `rotate_polygons` helper (471-489).
  - **Branch-new:** only `from_sfx_detection` (#278), currently uncommitted; the rest of the file predates the branch (empty committed diff vs main).

### MIT/manga_translator/utils/generic.py
- **last_commit:** d88a8f745a2bfc5872f17f5513854ef4b8271c06 (branch `perf/mit-layout-fit-and-merge`) — **has both a committed diff vs origin/main AND further uncommitted edits**
- **lines_covered:** 1-1045 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Categories present: image ops (`load_image`/`dump_image` 223-250, `resize_keep_aspect`/`image_resize`/`resize_polygon` 251-293, `square_pad_resize` 886, `det_rearrange_forward` + nested `_unrearrange`/`_patch2batches` 913-1035); text/string ops (`atoi`/`natural_sort` 79-84, `repeating_sequence`/`count_valuable_text` 85-95, `replace_prefix`/`chunks` 96-104); hashing/IO (`get_digest`/`get_image_md5` 106-141, `get_filename_from_url`/`download_url_with_progressbar`/`prompt_yes_no` 142-205); color (`rgb2hex`/`hex2rgb`/`get_color_name` 867-885); geometry/math (`sort_pnts` 324-355, `distance_point_point`/`distance_point_lineseg` 619-660, `findNextPowerOf2` 753, a GJK collision-distance suite 760-866); classes `Context(dict)` (28-77), `AvgMeter` (206-221), `BBox` (294-322), `Quadrilateral` (356-618: textline geometry helper with `structure`, `valid`, `fg_colors`/`bg_colors`, `aspect_ratio`, `font_size`, `xyxy`, `clip`, `aabb`, `get_transformed_region`, `is_axis_aligned`, `angle`, `centroid`, `distance`/`poly_distance`, `copy`).
  - **Branch-new, committed (`origin/main...HEAD` diff)**: `_QCMR_CALLS` counter dict + `reset_qcmr_calls()`/`get_qcmr_calls()` (661-668, logging-only call counter sizing the merge-region hot path); `quadrilateral_can_merge_region` (669-736) gained an **AABB pre-reject gate** (squared-distance gap check against `aabb`) hoisted before the exact `shapely.Polygon.distance` computation, plus reordering cheap scalar gates (font-size-ratio/aspect-ratio) ahead of the exact geometry test — a byte-identical-on-accept, early-reject perf optimization for the textline-merge hot path (matches the branch name "layout-fit-and-merge").
  - **Branch-new, uncommitted (working tree)**: `Quadrilateral.__init__` (360) gained an `is_sfx: bool = False` param, stored as `self.is_sfx` (363) — the same #278 provenance tagging as `TextBlock.from_sfx_detection`, set by the SFX-detection second pass (`merge_sfx_detections`).
  - `quadrilateral_can_merge_region_coarse` (737-752) predates the branch, unchanged.

---

## Detection/Geometry (modified on this branch)

**Note on branch state**: `git diff origin/main...HEAD` (merge-base diff) is **empty for all four files below** — no committed changes on this branch touch them yet, consistent with the known main↔perf divergence (see project memory `project_mp2_deploy_blocked_branch_divergence`). All diffs described below are `git diff HEAD` (working tree vs last commit) — the real, currently in-progress work, matching `git status`'s `M` flag on each.

### MIT/manga_translator/detection_postproc.py
- **last_commit:** 21d9da61640ff83f93e4758b06da371d05cfcc01 (branch `perf/mit-layout-fit-and-merge`) — plus 1 uncommitted line
- **lines_covered:** 1-37 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `merge_sfx_detections` (22-37): SFX second-pass merge — runs the AnimeText SFX detector over the page (27), dedupes candidates against existing textline AABBs (30-31, IoA dedup delegated to `sfx_merge.dedup_sfx_boxes`), appends survivors as empty-text `Quadrilateral` textlines (32-34) so stylized SFX flows through OCR→translate→render like ordinary dialogue.
  - Uncommitted diff: line 34 only — added `is_sfx=True` kwarg to the appended `Quadrilateral` (previously untagged), tagging provenance of detector-added SFX textlines (#278).

### MIT/manga_translator/safe_area.py
- **last_commit:** bc6902cf88163ca1877449942215a716adceec04 (branch `perf/mit-layout-fit-and-merge`) — plus an uncommitted instrumentation diff (93 → 113 lines)
- **lines_covered:** 1-93 committed (full) + uncommitted additions reviewed
- **read_date:** 2026-07-04
- **findings:**
  - `safe_area_box()` (49-93) computes the largest centered axis-aligned interior box of a bubble mask via distance-transform + pole-of-inaccessibility, ported from MangaTranslator `image_utils.py:173-348`. Defaults `padding=5`, `pole_threshold=0.70` (49-50).
  - `cv2.distanceTransform(inside, DIST_L2, 5)` (68); centroid of the `dist >= padding` region via `cv2.moments` (72-78) is the anchor unless it sits in a narrow neck — `dist[centroid] < 0.70 * max_dist` (82) — in which case it falls back to `argmax(dist)` (83-84).
  - Box extent via 4-direction ray casting (`_ray_len`, 34-46): `width = 2*min(left,right)-1`, `height = 2*min(up,down)-1` (91-92).
  - Uncommitted diff: pure instrumentation, no behavior change — new `_SAFE_AREA_STATS` dict + `reset/get_safe_area_stats()` + `time.perf_counter()` timers around the distance transform and `_ray_len`'s while-loop (tracks `dt_s`, `ray_s`, `ray_steps`, `mask_px`) — part of a "#speed-study Phase 0" profiling `_ray_len`'s pure-Python per-pixel loop as a suspected hotspot behind the `bubble_fit_sole` branch's reported 6-9s/region cost.

### MIT/manga_translator/patch_geometry.py
- **last_commit:** c31ff81e6696da51edd525447e0433bf980bcf4e (branch `perf/mit-layout-fit-and-merge`) — committed portion unchanged vs main; plus one uncommitted addition
- **lines_covered:** 1-373 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Pure numpy/cv2 geometry for the per-region patch path (#187 seam S24a): `build_local_region` (17-42) shifts a region + its `bubble_box`/`bubble_polygon` into crop-local coords; `create_text_only_mask` (45-73) rasterizes text regions with an adaptive dilate/close kernel sized 3-9px from avg font size (`round(avg_font/10)*2+1`, line 57); `crop_mask_for_patch` (76-129) crops/rescales the raw detection mask with nearest-neighbor (`INTER_NEAREST`, 126, chosen over linear to avoid mask-edge "halo" over-erasing in LaMa); `union_refined_with_fallback` (132-157) merges the CRF-refined mask with `text_only_mask` per connected component.
  - `page_scaled_font_min` floor = `round((h+w)/200)` (161-169); `expand_inpaint_crop` (172-187) pads the render rect for LaMa's global receptive field; `feather_alpha` (190-209) is a distance-transform alpha ramp; `seamless_blend_inpaint` (Poisson clone, `erode=2`); `tighten_text_mask` (`contrast=18.0`, `min_frac=0.02`) keeps only ink pixels differing from local background; `reground_inpaint_luminance` (`radius_frac=0.06`, `max_delta=40.0`) per-channel re-grounds LaMa luminance to local surround.
  - Uncommitted addition: `content_alpha_inner()` (212-239, `threshold=12`, `dilate=8` defaults) — content-footprint alpha for #436, so only a patch's own new glyphs (`|rendered-inpainted| > threshold`) unioned with its own erase mask, dilated, is kept opaque — preventing an overlapping neighbor's patch from blanking the neighbor's text.

### MIT/manga_translator/render_overlap.py
- **last_commit:** 30cb398da5c1f49118de7342181f2a8327181f93 (branch `perf/mit-layout-fit-and-merge`) — only the first 85 lines existed at this commit; ~137 more lines are uncommitted
- **lines_covered:** 1-221 (full, incl. uncommitted tail)
- **read_date:** 2026-07-04
- **findings:**
  - `clamp_box_to_neighbors` (49-84, committed): resolves render-box overlap between neighboring regions (dialogue↔dialogue or dialogue↔caption) before font-fitting — for each overlapping neighbor, separates along the axis of least penetration and pulls only the facing edge (margin default 0); a box squeezed past itself collapses to its centerline (80-83) rather than inverting.
  - Uncommitted (lines 87-222, ~137 new lines): `squeeze_width` (#183, `factor=0.9`, narrows wrap column stepwise trading width for height); `box_containment` (#436 dedup geometry); `fills_bubble_width` (#175, `threshold=0.72` — measured dialogue rw/bw ≈0.88-0.90 vs narration ≈0.40-0.59); `bubble_fit_bounds` (#175, `abs_max=200`, low floor at `font_size_minimum`); `display_sfx` (#431, free-floating-only gate); `processing_scale` (`sqrt(megapixels)` clamped `[0.5, 4.0]`, mirrors MangaTranslator `pipeline.py:694`); `font_bounds` (dialogue `[8,16]`, display/SFX `[10,64]`, scaled by `processing_scale`, mirrors MangaTranslator `config.py:102-103,147-148`); `clean_layout_font_size` (base `(h+w)/130`); `clean_layout_target_fs` (`abs_cap=120`); `region_territory_box` (#436).
  - `fills_bubble_width`/`bubble_fit_bounds`/`region_territory_box` are the geometry the `MIT_BUBBLE_AREA_FIT` env flag actually consumes — the gate itself lives in `patch_renderer.py`/`config.py`/`stages.py`, not in this file.
