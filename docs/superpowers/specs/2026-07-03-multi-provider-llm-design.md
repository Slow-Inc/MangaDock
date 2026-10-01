# Design: Multi-Provider LLM Translation (Backend)

**Date:** 2026-07-03  
**Scope:** `Backend/src/` only — MIT/ folder untouched  
**Approach:** A (Thin ENV Switch)

---

## Problem

Backend translation uses Gemini exclusively, hard-coded via `@google/generative-ai` SDK in `landing.service.ts` and raw `fetch()` in `gemini-model-catalog.ts`. Supporting ChatGPT or a custom OpenAI-compatible endpoint requires abstracting the provider behind a single service.

---

## Architecture

```
ENV: LLM_PROVIDER=gemini|openai|custom
          │
          ▼
     LlmService  (new — Backend/src/books/llm.service.ts)
    ┌────────────────────────────────────────────────────┐
    │  complete(prompt): Promise<string>                  │
    │  getDescriptionModel(): string                      │
    │  getMangaModel(): string                            │
    └────────────┬───────────────────────────────────────┘
                 │ provider switch (constructor-time)
         ┌───────┴────────┐
    GoogleGenerativeAI   OpenAI (baseURL configurable)
    (existing SDK)       (new dependency: openai npm pkg)

landing.service.ts  ──► replaces direct SDK calls with LlmService.complete()
gemini-model-catalog.ts ──► becomes optional (Gemini-only model discovery)
mit-config.ts ──► buildMitConfig() reads LLM_PROVIDER to set translator type
env.validation.ts ──► new LLM_* vars, GEMINI_API_KEY → optional
books.module.ts ──► adds LlmService to providers
```

---

## ENV Variables

### New vars

| Variable | Required when | Default | Description |
|---|---|---|---|
| `LLM_PROVIDER` | always | `gemini` | `gemini` \| `openai` \| `custom` |
| `LLM_API_KEY` | `LLM_PROVIDER != gemini` | — | OpenAI API key or custom endpoint key |
| `LLM_BASE_URL` | `LLM_PROVIDER = custom` | — | OpenAI-compatible base URL (e.g. `http://localhost:11434/v1`) |
| `LLM_DESCRIPTION_MODEL` | optional | provider default | Model for description/synopsis translation |
| `LLM_MANGA_MODEL` | optional | provider default | Model for manga text (sent to MIT as translator model) |

### Provider defaults

| Provider | Description default | Manga default |
|---|---|---|
| `gemini` | `gemini-2.5-flash` (via `GEMINI_DESCRIPTION_MODEL` → fallback chain) | `gemini-2.5-flash-lite` (via `GEMINI_MANGA_MODEL`) |
| `openai` | `gpt-4o-mini` | `gpt-4o-mini` |
| `custom` | `LLM_DESCRIPTION_MODEL` (required) | `LLM_MANGA_MODEL` (required) |

### Changed vars

| Variable | Before | After |
|---|---|---|
| `GEMINI_API_KEY` | `@IsString()` Required | `@IsOptional() @IsString()` — still used when `LLM_PROVIDER=gemini` |

---

## New File: `llm.service.ts`

**Path:** `Backend/src/books/llm.service.ts`

```ts
@Injectable()
export class LlmService {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async complete(prompt: string): Promise<string>
  getDescriptionModel(): string
  getMangaModel(): string
}
```

**Internal logic:**

- **`gemini`**: `new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({ model }).generateContent(...)` — mirrors existing `landing.service.ts` call pattern exactly (`role: 'user'`, `thinkingBudget: 0`)
- **`openai` / `custom`**: `new OpenAI({ apiKey: LLM_API_KEY, baseURL: LLM_BASE_URL }).chat.completions.create({ model, messages: [{ role: 'user', content: prompt }] })` — OpenAI-compatible chat format
- **Model selection**: `LLM_DESCRIPTION_MODEL` / `LLM_MANGA_MODEL` → provider defaults → no fallback chain (simplified: custom/openai have no model discovery API to hit)
- **No fallback loop** for non-Gemini providers (Gemini fallback loop stays inside Gemini branch)

---

## Changes: `landing.service.ts`

**Path:** `Backend/src/books/landing.service.ts`

Two methods change:

### `translateDescription()`
- Before: `new GoogleGenerativeAI(apiKey).getGenerativeModel({ model }).generateContent(...)`
- After: `this.llmService.complete(prompt)` — prompt string unchanged
- Remove: per-method model selection loop, `apiKey` extraction from env, `GoogleGenerativeAI` import

### `translateMangaEpisode()`
- Same pattern as above
- Prompt format unchanged (numbered lines + JSON output instruction)
- Remove: `modelCandidates` fallback loop (model selection moves to `LlmService`)

**Constructor**: inject `LlmService` — remove `GeminiModelCatalog` from this file if it's only used for model selection here.

---

## Changes: `gemini-model-catalog.ts`

**Path:** `Backend/src/books/gemini-model-catalog.ts`

- Keep as-is — used only when `LLM_PROVIDER=gemini`
- `BooksService.getDescriptionModels()` and `getMangaModels()` now check provider:
  - `gemini` → delegate to `GeminiModelCatalog` (existing behavior)
  - `openai` / `custom` → return `[llmService.getDescriptionModel()]` directly (no discovery API)

---

## Changes: `mit-config.ts`

**Path:** `Backend/src/books/mit-config.ts`

`buildMitConfig()` gains provider awareness:

```ts
// Current (Gemini only):
translator: { target_lang, source_lang, model: imageModel, series_context }

// New (provider-aware):
translator: {
  target_lang,
  source_lang,
  model: imageModel,          // LLM_MANGA_MODEL or GEMINI_MANGA_MODEL
  series_context,
  // Added only for non-Gemini (both openai and custom use OpenAI-compatible format):
  ...(provider !== 'gemini' && {
    translator: 'chatgpt',
    api_key: LLM_API_KEY,
    ...(LLM_BASE_URL && { api_url: LLM_BASE_URL }),
  }),
}
```

> **Note:** MIT server must already support `chatgpt` translator type with `api_key`/`api_url` fields. NestJS can only send config — if MIT's current version doesn't accept these fields, manga image translation stays on Gemini until MIT is updated.
>
> **Security:** `api_key` is sent in the HTTP request body to MIT server (`MANGA_TRANSLATOR_URL`). This is acceptable only because MIT is on a trusted internal network (e.g. `http://26.17.141.205:5003`). Do not use this design if MIT server is on a public endpoint.

**`renderConfigHash`**: extend to include `LLM_` prefix vars alongside `MIT_` vars (SHA-1 input: all keys starting with `MIT_` or `LLM_`, sorted). This ensures cache busts when switching providers.

---

## Changes: `env.validation.ts`

**Path:** `Backend/src/common/env.validation.ts`

Add to `EnvironmentVariables` class:

```ts
@IsOptional()
@IsEnum(['gemini', 'openai', 'custom'])
LLM_PROVIDER?: string;          // default 'gemini' in code

@IsOptional()
@IsString()
LLM_API_KEY?: string;

@IsOptional()
@IsString()
@IsUrl()
LLM_BASE_URL?: string;

@IsOptional()
@IsString()
LLM_DESCRIPTION_MODEL?: string;

@IsOptional()
@IsString()
LLM_MANGA_MODEL?: string;

// Change existing:
@IsOptional()   // was required
@IsString()
GEMINI_API_KEY?: string;
```

Cross-field validation (post-`validate()`): if `LLM_PROVIDER=openai|custom` and no `LLM_API_KEY` → throw `Error('LLM_API_KEY required when LLM_PROVIDER is openai or custom')`. If `LLM_PROVIDER=custom` and no `LLM_BASE_URL` → throw.

---

## Changes: `books.module.ts`

Add `LlmService` to `providers` array.

---

## Cache Key Impact

`patchCacheKey` format (v7) already includes `model` name:
```
translate:manga-patches:v7:{chapterId}:{pageIndex}:{srcMIT}:{tgtMIT}:{model}:{derivative}:{renderConfigHash}
```

- Switching model name (e.g. `gemini-2.5-flash-lite` → `gpt-4o-mini`) → automatic cache miss via model segment ✓
- Switching provider but same model name → caught by `renderConfigHash` (includes `LLM_*` vars after change) ✓
- **No cache version bump needed**

---

## New Dependency

Add to `Backend/package.json`:
```
"openai": "^4.x"
```

`@google/generative-ai` stays (still needed for Gemini provider).

---

## Files Changed Summary

| File | Change type |
|---|---|
| `src/books/llm.service.ts` | **New** |
| `src/books/landing.service.ts` | Modify — replace SDK calls with LlmService |
| `src/common/env.validation.ts` | Modify — add LLM_* vars, GEMINI_API_KEY optional |
| `src/books/mit-config.ts` | Modify — provider-aware translator config + extend renderConfigHash |
| `src/books/books.module.ts` | Modify — add LlmService to providers |
| `src/books/books.service.ts` | Modify — getDescriptionModels/getMangaModels provider branch |
| `src/books/gemini-model-catalog.ts` | No change (kept for Gemini path) |
| `.env.example` | Modify — add LLM_* section |

---

## Out of Scope

- MIT/ folder — zero changes
- Frontend — no changes needed (provider is server-side config)
- Database — no schema changes
- Per-user or per-request provider selection
