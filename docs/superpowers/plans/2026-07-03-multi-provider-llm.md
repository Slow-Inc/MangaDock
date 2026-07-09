# Multi-Provider LLM Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OpenAI and OpenAI-compatible (custom endpoint) provider support to Backend translation, alongside existing Gemini, switched via `LLM_PROVIDER` ENV var — no DB changes, no MIT folder changes.

**Architecture:** A new `LlmService` (`@Injectable`) wraps `@google/generative-ai` and `openai` SDKs behind a single `complete(prompt, model): Promise<string>` interface. `landing.service.ts` calls `LlmService.complete()` instead of the Gemini SDK directly. `mit-config.ts` injects provider-specific translator fields into the JSON payload sent to MIT. Provider selection is fixed at startup via `LLM_PROVIDER` env var.

**Tech Stack:** NestJS 11, TypeScript, `@google/generative-ai` (existing), `openai` ^4 (new), `class-validator`, Jest

## Global Constraints

- All changes in `Backend/src/` only — zero changes to `MIT/` folder
- `LLM_PROVIDER` values: `gemini` | `openai` | `custom` (default: `gemini`)
- `GEMINI_API_KEY` becomes optional — required only when `LLM_PROVIDER=gemini`
- Patch cache key format unchanged: model name in key + `renderConfigHash` auto-separates caches per provider
- `openai` npm package version ^4

---

## File Map

| File | Action |
|---|---|
| `Backend/package.json` | Add `openai` dependency |
| `src/common/env.validation.ts` | `GEMINI_API_KEY` → optional; add `LLM_*` vars + cross-field validation |
| `src/common/env.validation.spec.ts` | New — validates each provider scenario |
| `src/books/llm.service.ts` | New — provider-switching `complete()` + model helpers |
| `src/books/llm.service.spec.ts` | New — unit tests for both SDK branches |
| `src/books/landing.service.ts` | Replace direct `GoogleGenerativeAI` calls with `LlmService.complete()` |
| `src/books/landing.service.spec.ts` | Add provider tests |
| `src/books/mit-config.ts` | `renderConfigHash` includes `LLM_*`; `buildMitConfig` adds non-Gemini translator fields |
| `src/books/mit-config.spec.ts` | New or extend — hash + translator config tests |
| `src/books/books.module.ts` | Add `LlmService` to providers |
| `src/books/books.service.ts` | Inject `LlmService`; `getDescriptionModels`/`getMangaModels` provider branch |
| `Backend/.env.example` | Document `LLM_*` vars |

---

### Task 1: Install `openai` package + update `env.validation.ts`

**Files:**
- Modify: `Backend/package.json` (via npm install)
- Modify: `Backend/src/common/env.validation.ts`
- Create: `Backend/src/common/env.validation.spec.ts`

**Interfaces:**
- Produces: `validate(config)` accepts/rejects LLM_* vars; `GEMINI_API_KEY` is optional

- [ ] **Step 1: Install the openai package**

```bash
cd Backend
npm install openai
```

Expected: `"openai": "^4.x.x"` appears in `package.json` dependencies, no peer dep errors.

- [ ] **Step 2: Write failing tests**

Create `Backend/src/common/env.validation.spec.ts`:

```typescript
import { validate } from './env.validation';

const BASE = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'svc-key',
};

describe('validate()', () => {
  describe('gemini provider (default)', () => {
    it('accepts gemini with GEMINI_API_KEY', () => {
      expect(() => validate({ ...BASE, GEMINI_API_KEY: 'key' })).not.toThrow();
    });

    it('accepts explicit LLM_PROVIDER=gemini with GEMINI_API_KEY', () => {
      expect(() => validate({ ...BASE, LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'key' })).not.toThrow();
    });

    it('allows GEMINI_API_KEY to be absent (no longer required)', () => {
      expect(() => validate({ ...BASE })).not.toThrow();
    });
  });

  describe('openai provider', () => {
    it('accepts openai with LLM_API_KEY', () => {
      expect(() =>
        validate({ ...BASE, LLM_PROVIDER: 'openai', LLM_API_KEY: 'sk-test' }),
      ).not.toThrow();
    });

    it('rejects openai without LLM_API_KEY', () => {
      expect(() => validate({ ...BASE, LLM_PROVIDER: 'openai' })).toThrow(
        'LLM_API_KEY is required',
      );
    });
  });

  describe('custom provider', () => {
    it('accepts custom with LLM_API_KEY and LLM_BASE_URL', () => {
      expect(() =>
        validate({
          ...BASE,
          LLM_PROVIDER: 'custom',
          LLM_API_KEY: 'sk-test',
          LLM_BASE_URL: 'http://localhost:11434/v1',
        }),
      ).not.toThrow();
    });

    it('rejects custom without LLM_API_KEY', () => {
      expect(() =>
        validate({ ...BASE, LLM_PROVIDER: 'custom', LLM_BASE_URL: 'http://x/v1' }),
      ).toThrow('LLM_API_KEY is required');
    });

    it('rejects custom without LLM_BASE_URL', () => {
      expect(() =>
        validate({ ...BASE, LLM_PROVIDER: 'custom', LLM_API_KEY: 'sk-test' }),
      ).toThrow('LLM_BASE_URL is required');
    });
  });

  it('rejects unknown LLM_PROVIDER value', () => {
    expect(() =>
      validate({ ...BASE, LLM_PROVIDER: 'anthropic', GEMINI_API_KEY: 'key' }),
    ).toThrow();
  });
});
```

- [ ] **Step 3: Run tests — expect fail**

```bash
npx jest src/common/env.validation.spec.ts --no-coverage
```

Expected: FAIL — tests for LLM_PROVIDER throw because validation doesn't know about these vars yet; GEMINI_API_KEY test fails because it's still required.

- [ ] **Step 4: Update `env.validation.ts`**

**4a — Change `GEMINI_API_KEY` from required to optional.** Find:

```typescript
  @IsString()
  GEMINI_API_KEY: string;
```

Replace with:

```typescript
  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;
```

**4b — Add `LLM_*` properties** to `EnvironmentVariables` class, after `GEMINI_API_KEY`. Add `@IsIn` to the `class-validator` import list, then insert:

```typescript
  @IsOptional()
  @IsIn(['gemini', 'openai', 'custom'])
  LLM_PROVIDER?: string;

  @IsOptional()
  @IsString()
  LLM_API_KEY?: string;

  @IsOptional()
  @IsString()
  LLM_BASE_URL?: string;

  @IsOptional()
  @IsString()
  LLM_DESCRIPTION_MODEL?: string;

  @IsOptional()
  @IsString()
  LLM_MANGA_MODEL?: string;
```

**4c — Add cross-field validation** in the `validate()` function, after `validateSync` check and before `return validated`:

```typescript
  const provider = validated.LLM_PROVIDER ?? 'gemini';
  if (provider !== 'gemini' && !validated.LLM_API_KEY) {
    throw new Error(
      'LLM_API_KEY is required when LLM_PROVIDER is "openai" or "custom"',
    );
  }
  if (provider === 'custom' && !validated.LLM_BASE_URL) {
    throw new Error('LLM_BASE_URL is required when LLM_PROVIDER is "custom"');
  }
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npx jest src/common/env.validation.spec.ts --no-coverage
```

Expected: 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add Backend/package.json Backend/package-lock.json Backend/src/common/env.validation.ts Backend/src/common/env.validation.spec.ts
git commit -m "feat(llm): add openai package and multi-provider env validation"
```

---

### Task 2: Create `LlmService`

**Files:**
- Create: `Backend/src/books/llm.service.ts`
- Create: `Backend/src/books/llm.service.spec.ts`

**Interfaces:**
- Produces:
  ```typescript
  class LlmService {
    constructor(env?: NodeJS.ProcessEnv)
    isConfigured(): boolean
    getDescriptionModel(): string
    getMangaModel(): string
    complete(prompt: string, model: string): Promise<string>
  }
  ```

- [ ] **Step 1: Write failing tests**

Create `Backend/src/books/llm.service.spec.ts`:

```typescript
import { LlmService } from './llm.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

jest.mock('@google/generative-ai');
jest.mock('openai');

function make(env: Partial<NodeJS.ProcessEnv>): LlmService {
  return new LlmService(env as NodeJS.ProcessEnv);
}

describe('LlmService — gemini provider', () => {
  const env = { LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'gkey' };

  afterEach(() => jest.resetAllMocks());

  it('isConfigured() true when GEMINI_API_KEY present', () => {
    expect(make(env).isConfigured()).toBe(true);
  });

  it('isConfigured() false when GEMINI_API_KEY absent', () => {
    expect(make({ LLM_PROVIDER: 'gemini' }).isConfigured()).toBe(false);
  });

  it('getDescriptionModel() returns GEMINI_DESCRIPTION_MODEL when set', () => {
    expect(make({ ...env, GEMINI_DESCRIPTION_MODEL: 'gemini-custom' }).getDescriptionModel()).toBe('gemini-custom');
  });

  it('getDescriptionModel() falls back to GEMINI_DESCRIPTION_FALLBACK_MODEL', () => {
    expect(make({ ...env, GEMINI_DESCRIPTION_FALLBACK_MODEL: 'fb' }).getDescriptionModel()).toBe('fb');
  });

  it('getDescriptionModel() falls back to gemini-2.5-flash', () => {
    expect(make(env).getDescriptionModel()).toBe('gemini-2.5-flash');
  });

  it('getMangaModel() returns GEMINI_MANGA_MODEL when set', () => {
    expect(make({ ...env, GEMINI_MANGA_MODEL: 'gemini-lite' }).getMangaModel()).toBe('gemini-lite');
  });

  it('getMangaModel() falls back to gemini-2.5-flash-lite', () => {
    expect(make(env).getMangaModel()).toBe('gemini-2.5-flash-lite');
  });

  it('complete() calls GoogleGenerativeAI.generateContent and returns text', async () => {
    const mockGenContent = jest.fn().mockResolvedValue({ response: { text: () => 'แปลแล้ว' } });
    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({ generateContent: mockGenContent }),
    }));

    const result = await make(env).complete('Hello', 'gemini-2.5-flash');

    expect(GoogleGenerativeAI).toHaveBeenCalledWith('gkey');
    expect(mockGenContent).toHaveBeenCalledWith({
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    });
    expect(result).toBe('แปลแล้ว');
  });
});

describe('LlmService — openai provider', () => {
  const env = { LLM_PROVIDER: 'openai', LLM_API_KEY: 'sk-test' };

  afterEach(() => jest.resetAllMocks());

  it('isConfigured() true when LLM_API_KEY present', () => {
    expect(make(env).isConfigured()).toBe(true);
  });

  it('isConfigured() false when LLM_API_KEY absent', () => {
    expect(make({ LLM_PROVIDER: 'openai' }).isConfigured()).toBe(false);
  });

  it('getDescriptionModel() returns LLM_DESCRIPTION_MODEL when set', () => {
    expect(make({ ...env, LLM_DESCRIPTION_MODEL: 'gpt-4o' }).getDescriptionModel()).toBe('gpt-4o');
  });

  it('getDescriptionModel() falls back to gpt-4o-mini', () => {
    expect(make(env).getDescriptionModel()).toBe('gpt-4o-mini');
  });

  it('getMangaModel() returns LLM_MANGA_MODEL when set', () => {
    expect(make({ ...env, LLM_MANGA_MODEL: 'gpt-4.1-mini' }).getMangaModel()).toBe('gpt-4.1-mini');
  });

  it('getMangaModel() falls back to gpt-4o-mini', () => {
    expect(make(env).getMangaModel()).toBe('gpt-4o-mini');
  });

  it('complete() calls OpenAI without baseURL for openai provider', async () => {
    const mockCreate = jest.fn().mockResolvedValue({ choices: [{ message: { content: 'แปลแล้ว' } }] });
    (OpenAI as jest.Mock).mockImplementation(() => ({ chat: { completions: { create: mockCreate } } }));

    const result = await make(env).complete('Hello', 'gpt-4o-mini');

    expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'sk-test' });
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(result).toBe('แปลแล้ว');
  });
});

describe('LlmService — custom provider', () => {
  afterEach(() => jest.resetAllMocks());

  it('complete() passes baseURL to OpenAI constructor', async () => {
    const mockCreate = jest.fn().mockResolvedValue({ choices: [{ message: { content: 'x' } }] });
    (OpenAI as jest.Mock).mockImplementation(() => ({ chat: { completions: { create: mockCreate } } }));

    await make({
      LLM_PROVIDER: 'custom',
      LLM_API_KEY: 'sk-local',
      LLM_BASE_URL: 'http://localhost:11434/v1',
    }).complete('Hi', 'llama3');

    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: 'sk-local',
      baseURL: 'http://localhost:11434/v1',
    });
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npx jest src/books/llm.service.spec.ts --no-coverage
```

Expected: FAIL — "Cannot find module './llm.service'".

- [ ] **Step 3: Create `llm.service.ts`**

Create `Backend/src/books/llm.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

type LlmProvider = 'gemini' | 'openai' | 'custom';

@Injectable()
export class LlmService {
  private readonly provider: LlmProvider;
  private readonly openAiClient: OpenAI | undefined;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {
    this.provider = (env.LLM_PROVIDER as LlmProvider) ?? 'gemini';
    if (this.provider !== 'gemini') {
      this.openAiClient = new OpenAI({
        apiKey: env.LLM_API_KEY!,
        ...(env.LLM_BASE_URL ? { baseURL: env.LLM_BASE_URL } : {}),
      });
    }
  }

  isConfigured(): boolean {
    return this.provider === 'gemini'
      ? !!this.env.GEMINI_API_KEY
      : !!this.env.LLM_API_KEY;
  }

  getDescriptionModel(): string {
    if (this.provider === 'gemini') {
      return (
        this.env.GEMINI_DESCRIPTION_MODEL ??
        this.env.GEMINI_DESCRIPTION_FALLBACK_MODEL ??
        'gemini-2.5-flash'
      );
    }
    return this.env.LLM_DESCRIPTION_MODEL ?? 'gpt-4o-mini';
  }

  getMangaModel(): string {
    if (this.provider === 'gemini') {
      return (
        this.env.GEMINI_MANGA_MODEL ??
        this.env.GEMINI_MANGA_FALLBACK_MODEL ??
        'gemini-2.5-flash-lite'
      );
    }
    return this.env.LLM_MANGA_MODEL ?? 'gpt-4o-mini';
  }

  async complete(prompt: string, model: string): Promise<string> {
    return this.provider === 'gemini'
      ? this.geminiComplete(prompt, model)
      : this.openAiComplete(prompt, model);
  }

  private async geminiComplete(prompt: string, model: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(this.env.GEMINI_API_KEY!);
    const geminiModel = genAI.getGenerativeModel({ model });
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return result.response.text();
  }

  private async openAiComplete(prompt: string, model: string): Promise<string> {
    const response = await this.openAiClient!.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0]?.message.content ?? '';
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest src/books/llm.service.spec.ts --no-coverage
```

Expected: 17 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add Backend/src/books/llm.service.ts Backend/src/books/llm.service.spec.ts
git commit -m "feat(llm): add LlmService with gemini/openai/custom provider support"
```

---

### Task 3: Update `landing.service.ts`

**Files:**
- Modify: `Backend/src/books/landing.service.ts`
- Modify: `Backend/src/books/landing.service.spec.ts`

**Interfaces:**
- Consumes: `LlmService.complete(prompt, model)`, `LlmService.isConfigured()`, `LlmService.getDescriptionModel()`, `LlmService.getMangaModel()`

- [ ] **Step 1: Add failing tests to `landing.service.spec.ts`**

Read the existing `makeDeps()` factory in the file. It instantiates `LandingService` directly with mocked dependencies. You will update it to also pass a mock `LlmService` once the constructor is updated in Step 3. For now, add these test cases at the bottom of the `describe` block:

```typescript
// Add import at top:
import { LlmService } from './llm.service';

// Add these tests inside the existing describe block:

describe('translateDescription() — openai provider', () => {
  it('returns translated when llmService.complete resolves', async () => {
    // After Step 3 updates makeDeps, construct with mock llmService
    const mockLlm = {
      isConfigured: jest.fn().mockReturnValue(true),
      getDescriptionModel: jest.fn().mockReturnValue('gpt-4o-mini'),
      getMangaModel: jest.fn().mockReturnValue('gpt-4o-mini'),
      complete: jest.fn().mockResolvedValue('คำแปลภาษาไทย'),
    } as unknown as LlmService;

    // Construct LandingService with mockLlm as last arg (after Step 3 adds it)
    // svc = new LandingService(cache, imageCache, mangaDex, geminiCatalog, backendOrigin, env, mockLlm)
    // For now, this test will fail at import level — that's expected.
    expect(true).toBe(false); // placeholder fail — replace after Step 3
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npx jest src/books/landing.service.spec.ts --no-coverage
```

Expected: 1 new test FAILS (placeholder `expect(true).toBe(false)`), all 7 existing tests PASS.

- [ ] **Step 3: Update `landing.service.ts`**

**3a — Add import:**

```typescript
import { LlmService } from './llm.service';
```

**3b — Remove this import** (no longer used in this file):

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
```

**3c — Add `llmService` to constructor** (after `env` param):

```typescript
constructor(
  private readonly cache: CacheOrchestratorService,
  private readonly imageCache: ImageCacheService,
  private readonly mangaDex: MangaDexService,
  private readonly geminiCatalog: GeminiModelCatalog,
  private readonly backendOrigin: () => string,
  private readonly env: NodeJS.ProcessEnv = process.env,
  private readonly llmService: LlmService = new LlmService(env),
) {}
```

**3d — Update `translateDescription()`.** Make these two targeted replacements:

*Replace the API key guard:*
```typescript
// OLD — find and replace:
  const apiKey = this.env.GEMINI_API_KEY;
  if (!apiKey) return { translatedText: text, translated: false };

// NEW:
  if (!this.llmService.isConfigured()) return { translatedText: text, translated: false };
```

*Replace model selection + `GoogleGenerativeAI` instantiation:*
```typescript
// OLD:
  const models = await this.geminiCatalog.getDescriptionModels();
  // ...
  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as any,
      });
      let translatedText = result.response.text().trim();

// NEW (keep everything between prompt build and inner try — only change model source + API call):
  const provider = this.env.LLM_PROVIDER ?? 'gemini';
  const models =
    provider === 'gemini'
      ? await this.geminiCatalog.getDescriptionModels()
      : [this.llmService.getDescriptionModel()];

  for (const modelName of models) {
    try {
      let translatedText = (await this.llmService.complete(prompt, modelName)).trim();
```

*Update the logger warn message:*
```typescript
// OLD:
      this.logger.warn(`[Gemini] Description translation failed on ${modelName}: ${String(err)}`);
// NEW:
      this.logger.warn(`[LLM] Description translation failed on ${modelName}: ${String(err)}`);
```

**3e — Update `translateMangaEpisode()`.** Make these two targeted replacements:

*Replace the API key guard:*
```typescript
// OLD:
  const apiKey = this.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { translatedLines: lines, translated: false, model: preferredModel, fromCache: 0, generated: 0 };
  }

// NEW:
  if (!this.llmService.isConfigured()) {
    return { translatedLines: lines, translated: false, model: preferredModel, fromCache: 0, generated: 0 };
  }
```

*Replace `GoogleGenerativeAI` instantiation + `generateContent` call inside the for loop:*
```typescript
// OLD (find block starting after the prompt is built):
    const genAI = new GoogleGenerativeAI(apiKey);

    for (const modelName of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as any,
        });

        const raw = result.response.text().trim();

// NEW:
    for (const modelName of modelCandidates) {
      try {
        const raw = (await this.llmService.complete(prompt, modelName)).trim();
```

*Update the logger warn:*
```typescript
// OLD:
        this.logger.warn(`[Gemini] Manga translation failed on ${modelName}: ${String(err)}`);
// NEW:
        this.logger.warn(`[LLM] Manga translation failed on ${modelName}: ${String(err)}`);
```

- [ ] **Step 4: Fix the placeholder test in `landing.service.spec.ts`**

Replace the placeholder test with a real one using the updated constructor signature:

```typescript
describe('translateDescription() — openai provider', () => {
  it('returns translated when llmService.complete resolves', async () => {
    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      setMangaCacheWithTiers: jest.fn().mockResolvedValue(undefined),
    };
    const mockLlm = {
      isConfigured: jest.fn().mockReturnValue(true),
      getDescriptionModel: jest.fn().mockReturnValue('gpt-4o-mini'),
      getMangaModel: jest.fn().mockReturnValue('gpt-4o-mini'),
      complete: jest.fn().mockResolvedValue('คำแปลภาษาไทย'),
    } as unknown as LlmService;

    const svc = new LandingService(
      mockCache as any,
      { enabled: false } as any,
      {} as any,
      {} as any,
      () => 'http://localhost',
      { LLM_PROVIDER: 'openai', LLM_API_KEY: 'sk-test' } as NodeJS.ProcessEnv,
      mockLlm,
    );

    const result = await svc.translateDescription('Some English description here and more text');
    expect(result.translated).toBe(true);
    expect(result.translatedText).toBe('คำแปลภาษาไทย');
    expect(mockLlm.complete).toHaveBeenCalledWith(
      expect.stringContaining('Some English description'),
      'gpt-4o-mini',
    );
  });

  it('returns untranslated when llmService.isConfigured() is false', async () => {
    const mockLlm = {
      isConfigured: jest.fn().mockReturnValue(false),
      complete: jest.fn(),
    } as unknown as LlmService;

    const svc = new LandingService(
      {} as any, {} as any, {} as any, {} as any,
      () => 'http://localhost',
      { LLM_PROVIDER: 'openai' } as NodeJS.ProcessEnv,
      mockLlm,
    );

    const result = await svc.translateDescription('Some text');
    expect(result.translated).toBe(false);
    expect(mockLlm.complete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run all landing.service tests — expect pass**

```bash
npx jest src/books/landing.service.spec.ts --no-coverage
```

Expected: all 9 tests PASS (7 existing + 2 new).

- [ ] **Step 6: Commit**

```bash
git add Backend/src/books/landing.service.ts Backend/src/books/landing.service.spec.ts
git commit -m "feat(llm): route landing.service translation calls through LlmService"
```

---

### Task 4: Update `mit-config.ts` — extend `renderConfigHash` + provider-aware `buildMitConfig`

**Files:**
- Modify: `Backend/src/books/mit-config.ts`
- Create: `Backend/src/books/mit-config.spec.ts` (or extend existing)

**Interfaces:**
- Produces:
  - `renderConfigHash(env)` — hashes `MIT_*` and `LLM_*` vars
  - `buildMitConfig()` — translator object gains `translator`/`api_key`/`api_url` for non-Gemini

- [ ] **Step 1: Write failing tests**

Create `Backend/src/books/mit-config.spec.ts`:

```typescript
import { renderConfigHash, buildMitConfig } from './mit-config';

const MIT_BASE = { MIT_SEND_SOURCE_LANG: 'false' } as NodeJS.ProcessEnv;

describe('renderConfigHash()', () => {
  it('changes when LLM_PROVIDER changes', () => {
    const h1 = renderConfigHash({ LLM_PROVIDER: 'gemini' } as NodeJS.ProcessEnv);
    const h2 = renderConfigHash({ LLM_PROVIDER: 'openai' } as NodeJS.ProcessEnv);
    expect(h1).not.toBe(h2);
  });

  it('changes when LLM_MANGA_MODEL changes', () => {
    const h1 = renderConfigHash({ LLM_MANGA_MODEL: 'gpt-4o-mini' } as NodeJS.ProcessEnv);
    const h2 = renderConfigHash({ LLM_MANGA_MODEL: 'gpt-4o' } as NodeJS.ProcessEnv);
    expect(h1).not.toBe(h2);
  });

  it('is stable for same LLM_* values', () => {
    const env = { MIT_OCR_PROB: '0.03', LLM_PROVIDER: 'openai' } as NodeJS.ProcessEnv;
    expect(renderConfigHash(env)).toBe(renderConfigHash(env));
  });

  it('is unaffected by non-MIT_ non-LLM_ keys', () => {
    const h1 = renderConfigHash({ SUPABASE_URL: 'https://a.supabase.co' } as NodeJS.ProcessEnv);
    const h2 = renderConfigHash({ SUPABASE_URL: 'https://b.supabase.co' } as NodeJS.ProcessEnv);
    expect(h1).toBe(h2);
  });
});

describe('buildMitConfig() — provider-aware translator section', () => {
  it('gemini (default): no translator/api_key fields', () => {
    const cfg = JSON.parse(buildMitConfig(
      { ...MIT_BASE, LLM_PROVIDER: 'gemini' } as NodeJS.ProcessEnv,
      'JPN', 'THA', 'ja', 'gemini-2.5-flash-lite',
    ));
    expect(cfg.translator.translator).toBeUndefined();
    expect(cfg.translator.api_key).toBeUndefined();
    expect(cfg.translator.model).toBe('gemini-2.5-flash-lite');
  });

  it('omitted LLM_PROVIDER defaults to gemini behavior', () => {
    const cfg = JSON.parse(buildMitConfig(MIT_BASE, 'JPN', 'THA', 'ja', 'gemini-2.5-flash-lite'));
    expect(cfg.translator.translator).toBeUndefined();
  });

  it('openai: adds translator=chatgpt and api_key, no api_url', () => {
    const cfg = JSON.parse(buildMitConfig(
      { ...MIT_BASE, LLM_PROVIDER: 'openai', LLM_API_KEY: 'sk-test' } as NodeJS.ProcessEnv,
      'JPN', 'THA', 'ja', 'gpt-4o-mini',
    ));
    expect(cfg.translator.translator).toBe('chatgpt');
    expect(cfg.translator.api_key).toBe('sk-test');
    expect(cfg.translator.api_url).toBeUndefined();
  });

  it('custom: adds translator=chatgpt, api_key, and api_url', () => {
    const cfg = JSON.parse(buildMitConfig(
      {
        ...MIT_BASE,
        LLM_PROVIDER: 'custom',
        LLM_API_KEY: 'sk-local',
        LLM_BASE_URL: 'http://localhost:11434/v1',
      } as NodeJS.ProcessEnv,
      'JPN', 'THA', 'ja', 'llama3',
    ));
    expect(cfg.translator.translator).toBe('chatgpt');
    expect(cfg.translator.api_key).toBe('sk-local');
    expect(cfg.translator.api_url).toBe('http://localhost:11434/v1');
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

```bash
npx jest src/books/mit-config.spec.ts --no-coverage
```

Expected: `renderConfigHash` LLM tests FAIL (filter only `MIT_*`); `buildMitConfig` provider tests FAIL (no translator field).

- [ ] **Step 3: Update `renderConfigHash()` in `mit-config.ts`**

Current code at lines 99–106:
```typescript
export function renderConfigHash(env: NodeJS.ProcessEnv): string {
  const knobs = Object.keys(env)
    .filter((k) => k.startsWith('MIT_'))
    .sort()
    .map((k) => `${k}=${env[k] ?? ''}`)
    .join('\n');
  return createHash('sha1').update(knobs).digest('hex').slice(0, 10);
}
```

Replace with:
```typescript
export function renderConfigHash(env: NodeJS.ProcessEnv): string {
  const knobs = Object.keys(env)
    .filter((k) => k.startsWith('MIT_') || k.startsWith('LLM_'))
    .sort()
    .map((k) => `${k}=${env[k] ?? ''}`)
    .join('\n');
  return createHash('sha1').update(knobs).digest('hex').slice(0, 10);
}
```

- [ ] **Step 4: Update `buildMitConfig()` translator block in `mit-config.ts`**

Find the `return JSON.stringify({` at line 216. The translator object currently is:
```typescript
      translator: {
        target_lang: tgtMIT,
        ...(srcMIT !== 'ANY'
          ? { source_lang: srcMIT, source_lang_only: true }
          : {}),
        ...(model ? { model } : {}),
        ...(seriesContext ? { series_context: seriesContext } : {}),
      },
```

Add the `provider` const before `return JSON.stringify`, then spread provider fields at the end of the translator object:

```typescript
    const provider = env.LLM_PROVIDER ?? 'gemini';
    return JSON.stringify({
      translator: {
        target_lang: tgtMIT,
        ...(srcMIT !== 'ANY'
          ? { source_lang: srcMIT, source_lang_only: true }
          : {}),
        ...(model ? { model } : {}),
        ...(seriesContext ? { series_context: seriesContext } : {}),
        ...(provider !== 'gemini'
          ? {
              translator: 'chatgpt',
              api_key: env.LLM_API_KEY,
              ...(env.LLM_BASE_URL ? { api_url: env.LLM_BASE_URL } : {}),
            }
          : {}),
      },
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npx jest src/books/mit-config.spec.ts --no-coverage
```

Expected: 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add Backend/src/books/mit-config.ts Backend/src/books/mit-config.spec.ts
git commit -m "feat(llm): extend renderConfigHash to LLM_ vars; add provider fields to buildMitConfig"
```

---

### Task 5: Wire `BooksModule` + update `BooksService`

**Files:**
- Modify: `Backend/src/books/books.module.ts`
- Modify: `Backend/src/books/books.service.ts`

**Interfaces:**
- Consumes: `LlmService` (Task 2)
- Produces: `BooksService.getDescriptionModels()` and `getMangaModels()` return `string[]` for all providers

- [ ] **Step 1: Update `books.module.ts`**

Add `LlmService` to the providers array:

```typescript
import { LlmService } from './llm.service';

@Module({
  imports:     [StatusModule, CacheModule],
  controllers: [BooksController, MitWebhookController, PatchesController],
  providers:   [BooksService, MangaDexService, MitClient, LlmService],
  exports:     [BooksService],
})
export class BooksModule {}
```

- [ ] **Step 2: Inject `LlmService` into `BooksService`**

Read the current `BooksService` constructor (around line 68–110). It constructs `LandingService` manually. Make these changes:

**2a — Add constructor parameter** (NestJS will inject it since `LlmService` is in module providers):

```typescript
constructor(
  // ... existing injected params (cache, imageCache, mangaDex, mitClient, etc.) ...
  private readonly llmService: LlmService,
) {
  // existing constructor body
}
```

**2b — Pass `llmService` when constructing `LandingService`** (find the `new LandingService(...)` call, add `this.llmService` as the last argument, matching the constructor signature from Task 3):

```typescript
this.landing = new LandingService(
  this.cache,
  this.imageCache,
  this.mangaDex,
  this.geminiCatalog,
  () => this.backendOrigin(),   // or however backendOrigin is currently passed
  this.env,
  this.llmService,              // ← add this
);
```

- [ ] **Step 3: Update `getDescriptionModels()` and `getMangaModels()`**

Find these two methods (currently around lines 206–212):

```typescript
// Before:
getDescriptionModels(): Promise<GeminiModel[]> {
  return this.geminiCatalog.getDescriptionModels();
}

getMangaModels(requested?: string): Promise<GeminiModel[]> {
  return this.geminiCatalog.getMangaModels(requested);
}

// After:
async getDescriptionModels(): Promise<string[]> {
  const provider = this.env.LLM_PROVIDER ?? 'gemini';
  if (provider === 'gemini') return this.geminiCatalog.getDescriptionModels();
  return [this.llmService.getDescriptionModel()];
}

async getMangaModels(requested?: string): Promise<string[]> {
  const provider = this.env.LLM_PROVIDER ?? 'gemini';
  if (provider === 'gemini') return this.geminiCatalog.getMangaModels(requested);
  return [this.llmService.getMangaModel()];
}
```

Note: `BooksService` must have access to `this.env` — check if it already has `private readonly env: NodeJS.ProcessEnv = process.env` in its constructor; add it if not.

- [ ] **Step 4: Run the full Backend test suite**

```bash
npm test -- --no-coverage
```

Expected: all tests PASS. If any existing test breaks due to `BooksService` constructor arity change, update that test's mock to pass a mock `LlmService` (e.g., `{} as LlmService`).

- [ ] **Step 5: Commit**

```bash
git add Backend/src/books/books.module.ts Backend/src/books/books.service.ts
git commit -m "feat(llm): wire LlmService into BooksModule and BooksService"
```

---

### Task 6: Update `.env.example`

**Files:**
- Modify: `Backend/.env.example`

- [ ] **Step 1: Add LLM provider section**

Read the current `.env.example`. Find the `GEMINI_API_KEY` line and add a comment marking it as conditional:

```bash
# Required when LLM_PROVIDER=gemini (default). Omit when using openai or custom.
GEMINI_API_KEY=
```

Add a new section after the existing Gemini block:

```bash
# ── Multi-Provider LLM (translation) ─────────────────────────────────────────
# Provider: gemini (default) | openai | custom
# LLM_PROVIDER=gemini

# Required when LLM_PROVIDER=openai or custom
# LLM_API_KEY=sk-...

# Required when LLM_PROVIDER=custom (any OpenAI-compatible base URL)
# LLM_BASE_URL=http://localhost:11434/v1

# Optional: override default model per use-case
# Default for openai/custom: gpt-4o-mini
# LLM_DESCRIPTION_MODEL=gpt-4o-mini
# LLM_MANGA_MODEL=gpt-4o-mini
```

- [ ] **Step 2: Commit**

```bash
git add Backend/.env.example
git commit -m "docs: document multi-provider LLM env vars in .env.example"
```

---

## Self-Review

| Spec requirement | Task |
|---|---|
| `LLM_PROVIDER` env var with `gemini`/`openai`/`custom` | 1 |
| `GEMINI_API_KEY` → optional | 1 |
| Cross-field validation (`LLM_API_KEY` required when non-gemini; `LLM_BASE_URL` required for custom) | 1 |
| `openai` npm package | 1 |
| `LlmService` with `complete()`, `isConfigured()`, `getDescriptionModel()`, `getMangaModel()` | 2 |
| Gemini SDK path (existing behavior preserved) | 2 |
| OpenAI/custom SDK path with configurable `baseURL` | 2 |
| Replace direct `GoogleGenerativeAI` calls in `landing.service.ts` | 3 |
| `translateDescription()` routes to `LlmService` | 3 |
| `translateMangaEpisode()` routes to `LlmService` | 3 |
| `renderConfigHash()` includes `LLM_*` vars → patch cache busts on provider change | 4 |
| `buildMitConfig()` adds `translator`/`api_key`/`api_url` for non-Gemini | 4 |
| Security note: `api_key` only sent to internal MIT endpoint | Design spec |
| `books.module.ts` registers `LlmService` | 5 |
| `BooksService.getDescriptionModels()` and `getMangaModels()` provider branch | 5 |
| `.env.example` updated | 6 |

No gaps. No placeholders. `LlmService.complete(prompt: string, model: string): Promise<string>` is consistent across Tasks 2, 3, and 4 (model arg passed by caller). Return type `string[]` for `getDescriptionModels`/`getMangaModels` is consistent (was `Promise<GeminiModel[]>` = `Promise<string[]>`).
