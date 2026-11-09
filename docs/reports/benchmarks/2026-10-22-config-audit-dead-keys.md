# Config audit: two dead Backend→MIT keys fixed (#893), and two MIT features the Backend cannot reach (#894)

- **Date:** 2026-10-22 · **Method:** every key `Backend/src/books/mit-config.ts` can emit, checked against the
  MIT Pydantic models (`config.py`); fields parsed from AST, keys read from the emitter.

## Backend → MIT: dead keys

| Key | Effect before | Fix |
|---|---|---|
| `translator.concise_bubbles` | Pydantic dropped it; `MIT_CONCISE_BUBBLES` did nothing (#892) | field + `chatgpt_config` carriage |
| `translator.api_key` / `api_url` | Pydantic dropped them; a non-gemini deployment's endpoint/key never reached MIT — wrong endpoint or a construction-time `MissingAPIKeyException` | fields + `OpenAITranslator` rebuilds its client from the request |
| detector / ocr / inpainter / render keys | all present in the MIT models | — |

## #893 fix detail

- `TranslatorConfig.api_key` / `api_url` added (per-request credentials).
- `OpenAITranslator`: the client is now built from `.env` only when a key exists; `parse_args` rebuilds it from
  the request when credentials arrive; a request with no client and no env key raises
  `MissingAPIKeyException` at request time with a message naming both sources.
- Env-only setups are unchanged (same client, same behaviour) — pinned by a test.

| verification | result |
|---|---|
| config keeps both fields | ✓ test |
| request credentials repoint the client (`base_url` + `api_key`) | ✓ test |
| env-only client untouched by a credential-less request | ✓ test |
| gate | **849 passed** (the new file is in `_HEAVY_TESTS` — it imports the torch-holding translators package) |

## The other direction (#894)

Two MIT features have no way in from the Backend: `detector.det_bubble_synth` (#170/#178) and
`render.fit_below_floor` (#883's overlap opt-in). Proposal there: mirror the existing `flagEnv(...)` pattern so
operators can enable what MIT shipped.
