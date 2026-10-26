# Translator model sweep — gpt-6-luna on the Responses protocol vs claude-haiku-5-5

**Question:** the PRD's blind spot (its Out of Scope) is the translator model itself, and the earlier ad-hoc test
put gpt-6-luna at 4.7/5 against claude-haiku-5-5's 3.6/5. Under the quality-first direction the model is the
largest lever we can pull without touching the pipeline, so it was tested through the real pipeline.

**Gateway findings (OpenCode Go)**
- The gateway sits behind Cloudflare: a request with a bare HTTP-client user agent gets `403 error code: 1010`.
  Every request must carry an SDK-like user agent (the OpenAI SDK's is what the pipeline already sends).
- Model and protocol are 1:1, not interchangeable:
  - `claude-haiku-5-5` → Anthropic `/anthropic/v1/messages` only (chat/completions answers `400
    ModelProtocolUnsupported`);
  - `gpt-6-luna` → Responses `/openai/v1/responses` only (chat/completions answers the same 400);
  - `deepseek-v4.1-flash` → chat/completions (its empty-content failure mode is the reasoning budget, unchanged).
- `GET /models` answers 403 for this key, so candidates have to be tried by name.

**What was added:** `manga_translator/response_protocol.py` maps MIT's chat-shaped request onto the Responses API
(system → `instructions`, text/image blocks → `input_text`/`input_image`, no temperature — current reasoning models
reject it) and maps the answer back onto the fields the translator reads. `CUSTOM_OPENAI_PROTOCOL=responses`
selects it; `CUSTOM_OPENAI_RESPONSES_MODEL` names the model.

**Same pages, same OCR/rescue, only the translator differs** (ch. 6 p10–11):

| source | gpt-6-luna | claude-haiku-5-5 |
|---|---|---|
| `Fu ABOUT YESTERDAY, …` | ฟุฟุ เรื่องเมื่อวานเป็นอุบัติเหตุน่ะ … | เรื่องเมื่อวานน่ะ … (**dropped the chuckle**) |
| `Th- thats..! Th- thats not it!!` | มะ- ไม่ใช่นะ!! มะ- ไม่ใช่แบบนั้น!! | ไม่... ไม่ใช่แบบนั้นนะ!! (**lost the stutter**) |
| `.....I WA WORRIED THE WHOLE TIME...` | .....ฉันกังวลมาตลอดเลย... (**keeps the ellipsis**) | …ฉันกังวลมาตลอดเลยนะ… |
| `I'm glad.` | ดีจังเลย | ดีใจด้วยนะ |
| `JUST WHEN WED FINALLY GOTTEN CLOSER...` | ทั้งที่ในที่สุดเราก็สนิทกันขึ้นแล้วแท้ๆ... | ก็เพิ่งจะสนิทกันขึ้นแท้ ๆ… |
| `バッ` | พรึ่บ | ฟับ |

**Blind judge (same #1141 method, text only):** 13 differing segments, A/B order shuffled, judged by
deepseek-v4.1-flash on naturalness and faithfulness: **Luna 9, haiku 3, tie 1** (sign test p ≈ 0.07).

Luna keeps the voice: interjections, stutters and the source punctuation. Haiku is cleaner but flattens those,
which is exactly the "machine-made" tell this work is meant to remove.

**Cost, measured on the same 14-page chapter**

| | haiku (Anthropic) | **gpt-6-luna (Responses)** |
|---|---|---|
| chapter wall, 2 runs | 24.7 / 19.0 s | **33.8 / 26.7 s** |
| translation stage p50 | 3.1 s | 7.8 s |
| pages | 14/14 | 14/14 |

Quality-first direction: adopted. `MIT/.env` now runs `CUSTOM_OPENAI_PROTOCOL=responses` +
`CUSTOM_OPENAI_RESPONSES_MODEL=gpt-6-luna`; the previous file is kept beside it as `.env.haiku-backup`, and
`CUSTOM_OPENAI_PROTOCOL=anthropic` + `CUSTOM_OPENAI_ANTHROPIC_MODEL=claude-haiku-5-5` restores the old stack.

**Limits**
- Three pages read by eye plus the two defect lines; no blind human A/B yet (the #1141 judge method is the next
  step if a model tie needs settling).
- Luna is ~2.5× slower per translation call; that is accepted under the quality-first direction and will be
  revisited when performance is back on the table.

## Follow-up found while running it

The local Hayai OCR rescue (previous report) captured a CUDA graph on its first generate. When that first
generate happened *inside* a page, it could run while another stage was issuing CUDA work — once
`ultralytics`'s bubble detector failed with `CUDA error: operation not permitted when stream is capturing`.
The adapter now warms up at load time and the worker preloads it at boot, so the capture never happens during a
page; a chapter run after it shows no traceback and `textline_merge` p50 646 ms.