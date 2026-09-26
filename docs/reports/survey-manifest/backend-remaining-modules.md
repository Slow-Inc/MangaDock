# Backend Survey — Remaining Modules

Survey scope: `Backend/src/books/`, `Backend/src/forum/`, `Backend/src/users/`, `Backend/src/versions/`, `Backend/src/common/storage/`, `Backend/src/status/`, `Backend/src/supabase/`, and the `AuthGuard`/`OptionalAuthGuard`/`TurnstileGuard`/`HardwareIdMiddleware` implementations. Read against `origin/main`. Test files (`*.spec.ts`) were not deep-read — only source files that define behavior.

## What's genuinely presentation-worthy

The strongest thesis material is the **books↔MIT integration layer** — a decomposed pipeline (`mit-client.ts`, `mit-config.ts`, `mit-batch-orchestrator.service.ts`, `mit-batch-stream.ts`, `mit-webhook.controller.ts`) that solves real distributed-systems problems: async job orchestration across an SSE-to-webhook boundary with idempotent completion tracking, a `renderConfigHash` that automatically busts cached patches on any pipeline-knob change, HMAC-signed webhooks verified over raw request bytes (not re-serialized JSON, to dodge float-formatting drift between Python and JS), and hard-won operational constraints like never sending an abort signal on the MIT batch POST because killing it mid-flight crashes MIT's Fortran/BLAS runtime. Close behind is the **forum module's real-time layer**: dual local-RxJS + Redis-pub/sub fan-out with self-echo suppression via a per-instance ID, atomic voting and trending computed by Postgres RPCs (replacing earlier select-then-write and in-Node-tally approaches that had real correctness bugs), and in-memory (non-recursive-CTE) comment-tree assembly capped at 500 flat comments/post. The **auth security topology** is also notable: `AuthGuard`/`OptionalAuthGuard` delegate JWT validation to Supabase's own `getUser` with a SHA-256-token-keyed, single-flight, 60-second cache; `TurnstileGuard` is *not* a live Cloudflare round-trip per request but a locally verified HMAC "clearance token" cryptographically bound to the caller's hardware ID; `HardwareIdMiddleware` by contrast is a cheap format-only presence check (no cryptographic binding) layered in front of the real guards for defense-in-depth. Rounding out the set: `ElectionService` implements genuine Redis-based leader election (SET NX PX + Lua compare-and-delete/renew) for a horizontally-scaled NestJS deployment, and the `StorageProvider` abstraction cleanly swaps disk vs. Cloudflare R2 (via a custom Worker HTTP protocol) behind one interface, chosen by env-var auto-detection with an explicit-override escape hatch.

---

## Books

### Backend/src/books/books.controller.ts
- **last_commit:** c77fcc2e86ab6f7021879e74b5714f4308831e52
- **lines_covered:** 1-429 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `POST /books/verify-captcha` implements a fail-closed Turnstile gate (#224): production rejects a missing/test secret at boot via `resolveTurnstileConfig`; outside production, verification is skipped and a clearance token is minted directly via `generateClearanceToken(secret, hwid)`. Requires `X-Hardware-Id` header — 400 if absent.
  - `POST /chapters/:chapterId/batch-translate-patches` is the SSE endpoint for whole-chapter translation: sets `Content-Type: text/event-stream`, `X-Accel-Buffering: no`, writes an immediate `: connected\n\n` comment specifically to defeat Cloudflare Tunnel's "time to first byte" timeout (HTTP 524), then a 15-second heartbeat (`: ping\n\n`) via `setInterval` to survive gaps up to and beyond 100s (a cold model load or complex page can exceed Cloudflare's ~100s idle timeout).
  - Event shape distinguishes `{type:'progress', pageIndex, stage}` (live MIT stage updates) from page-completion events `{pageIndex, patches, error}` — old clients that don't handle `type` simply ignore progress events.
  - On client disconnect (`res.on('close')`) the listener is removed via `removeBatchListener`, but the batch job itself continues server-side (documented in the JSDoc above the handler) — a reconnecting client re-attaches and replays already-completed pages.
  - Error handling policy (#226): both `translateMangaPagePatches` and the batch SSE handler log the real internal error server-side via `console.error`/logger, then return a generic `"Translation failed"` message to the client — internal detail (stack traces, MIT error bodies) never leaks over the wire.
  - `GET /books/img-proxy` streams bytes directly from the upstream `ReadableStream` reader to the Express response without buffering the whole image into RAM, aborting (`res.destroy()`) if `MAX_PROXY_BYTES` (15 MB, from img-proxy.helper.ts) is exceeded mid-stream (headers already sent, so it can't downgrade to an error response — connection is simply cut).
  - `GET /books/manga/:id/cover` resolves the manga's first cover then internally reuses `proxyImage()` rather than issuing a redirect — keeps the Cache-Control / streaming logic in one place.
  - Query-string coercions are manual (`parseInt`, ternaries) rather than DTOs/class-validator on GET endpoints — contrasts with the DTO-validated forum POST/PATCH bodies.
  - `/models` endpoint (#133/PRD #131) is explicitly documented as unauthenticated, "same posture as mit-health" — deliberate low-sensitivity classification for catalog metadata.

### Backend/src/books/books.module.ts
- **last_commit:** 754df6b75d18c9d7d40b95421f27673a20dc54c6
- **lines_covered:** 1-17 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Trivial wiring file: imports `StatusModule` and `CacheModule`, registers three controllers (`BooksController`, `MitWebhookController`, `PatchesController`) and three providers (`BooksService`, `MangaDexService`, `MitClient`), exports only `BooksService`.
  - Confirms `MitClient` (the single HTTP boundary to MIT, #230) is a real Nest-DI-managed singleton in production, while `BooksService`'s constructor gives it a `new MitClient()` default purely so old unit tests that construct `BooksService` manually keep working.

### Backend/src/books/books.service.ts
- **last_commit:** c77fcc2e86ab6f7021879e74b5714f4308831e52
- **lines_covered:** 1-379 (full)
- **read_date:** 2026-07-04
- **findings:**
  - This is the God-object-turned-facade after the #231/#232/#233/#234 decomposition series: `BooksService` now composes six extracted collaborators (`GeminiModelCatalog`, `MangaCatalogService`, `LandingService`, `PatchStore`, `TranslationMemoryRepository`, `MitTranslationService`, `MitBatchOrchestrator`) and is mostly thin delegators, explicitly documented as kept "byte-identical" to the pre-refactor inline version so existing spy-based tests still pass.
  - `toPatchEntries()` (lines 46-59) is the single source of truth for px→percent geometry conversion — replaced a previously-triplicated calculation across single-page/batch-stream/webhook paths (#232). Note: `url` is matched to `rects[i]` positionally, so callers must keep `PatchStore.put()` output order aligned with `rects`.
  - `persistPage()` (lines 155-191) is the shared per-page persistence pipeline used by all three translation paths (single-page, batch-stream, webhook): PatchStore write → `toPatchEntries` → cache set (either `plain7d` = flat 7-day TTL, or `tiered` via `setMangaCacheWithTiers`) → optional translation-memory save. Supports a `recoverIfEmpty` callback so the batch path can retry with `source_lang_only` fallback before the single cache write (avoids caching an empty result).
  - Translation-memory persistence is deliberately fire-and-forget (`void this.translationMemory.savePageText(...)`) — the repository swallows its own errors so persistence latency/failure never blocks page delivery ("local-first" principle stated explicitly in the comment).
  - `onModuleInit()` triggers `PatchStore.startSweeping()` to clean the pre-#137 randomly-named legacy patch backlog on boot and then daily.
  - `seriesContextFor(mangaId)` (#157) resolves MangaDex catalog metadata into a translator prompt-context string; catalog failure degrades to `undefined` rather than breaking translation (again, local-first).
  - Dependency direction is strictly one-way: `MitTranslationService` and `MitBatchOrchestrator` are constructed with injected callback objects (`persistPage`, `seriesContextFor`, and for the batch orchestrator also `translateSinglePage`, late-bound as an arrow function so a spy on `translateMangaPagePatches` is still observed by the batch retry path) — avoids circular DI while sharing state.

### Backend/src/books/books.types.ts
- **last_commit:** 27363c05d3855ee9449a0061b99c90596428b2d7
- **lines_covered:** 1-98 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Pure type-only file (`CACHE_TTL_MS = 20 minutes`) plus `MangaCover`, `MangaDetail`, `MangaPreview`, `MangaChapter`, `MangaChapterPages`, `LandingBook`, `LandingRow`, `LandingPayload`.
  - Several fields exist purely to signal cache/offline state to the frontend: `MangaChapter.isOfflineFallback`, `MangaChapterPages.localCacheAvailable` (tri-state: `undefined`/`true`/`false`, only meaningful under forceLocal), `LandingPayload.fromStaleCache`/`staleUpdatedAt`/`apiOffline` — a documented pattern of "serve stale + flag it" instead of a hard failure when MangaDex is down.
  - `MangaDetail.title` is explicitly optional and commented as "anchors the translator's series context (#157)" — cached entries written before that field existed simply lack it until TTL expiry (no migration needed).

### Backend/src/books/gemini-model-catalog.ts
- **last_commit:** 15e483777af8e8130b6ef0b9db4a410d884d6276
- **lines_covered:** 1-162 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `GeminiModelCatalog` carved out of BooksService (#231/PRD#228 step 6). Three-tier lookup for the available-models catalog: in-memory (`geminiModelsCatalog`/`geminiModelsCatalogExpiresAt`) → `CacheOrchestratorService` (`GEMINI_MODELS_CACHE_KEY = 'gemini:models:v1'`) → live Gemini API call (`GET https://generativelanguage.googleapis.com/v1beta/models`, 8s `AbortSignal.timeout`). TTL is 1 hour (`GEMINI_MODELS_CACHE_TTL_MS`).
  - `env` and `now` clock are constructor-injected (defaulting to `process.env`/`Date.now`) specifically to make model selection unit-testable without touching globals.
  - `filterAvailableGeminiModels()` implements graceful degradation: if the availability catalog is empty (API never fetched / key missing), it trusts the raw configured candidates; if the catalog is populated but none of the configured candidates match, it warns and falls back to the raw candidates anyway rather than returning empty — availability filtering can only narrow, never fully block translation.
  - Two purpose-specific candidate chains: `getDescriptionModels()` = `[GEMINI_DESCRIPTION_MODEL, GEMINI_DESCRIPTION_FALLBACK_MODEL, 'gemini-2.5-flash', 'gemini-2.5-flash-lite']`; `getMangaModels(requested?)` prepends a per-request override before the same env/default chain.

### Backend/src/books/img-proxy.helper.ts
- **last_commit:** 27d2974ca4ad0f373935fab1f958baf66a245e73
- **lines_covered:** 1-98 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `MAX_PROXY_BYTES = 15 MiB`, `PROXY_TIMEOUT_MS = 10_000`. Pure function `fetchProxiedImage()` is dependency-injectable (`fetchFn` param) for unit testing.
  - Spoofs a product `User-Agent: MangaDock/1.0 (+https://2552667.xyz)` + `Referer: https://mangadex.org/` because MangaDex's uploads CDN 400s a bot-shaped `Mozilla/5.0 (compatible; ...)` UA.
  - Only accepts `https://` URLs (regex-gated, 400 otherwise) — SSRF-style guard against proxying arbitrary schemes.
  - Defense-in-depth content-type check: even a 2xx upstream response must have `content-type` starting with `image/` (missing header tolerated, defaulted to `image/jpeg`) — explicitly called out as preventing MangaDex's 400+HTML-error-page from masquerading as a "successful" image and defeating the client's `onError` fallback.
  - Distinguishes timeout (`AbortError`/`TimeoutError` → 504 Gateway Timeout) from other failures (502 Bad Gateway) in the catch block.
  - `Content-Length` enforced pre-stream via header check (413 if `> maxBytes`) in addition to the streaming byte-count check enforced by the controller.

### Backend/src/books/landing.service.ts
- **last_commit:** aab8d14d64e70219d1c90f124561cb0ac1bd9549
- **lines_covered:** 1-390 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Carved out of BooksService (#231). Owns three responsibilities: landing-page assembly, description translation, and per-line manga dialogue translation, all via Gemini (`@google/generative-ai`).
  - `translateMangaEpisode()`: dedupes identical dialogue lines via a `Map<string, number[]>` before translation so repeated lines (e.g. "..." or a stock phrase) are translated/cached once; caches per unique-line SHA-1 hash (`createHash('sha1').update(line|cacheScope).slice(0,24)`) scoped by chapter/page/targetLang/contextHint, keyed `translate:manga:v1:{modelName}:{hash}`; tries model fallbacks in order for cache lookups first (parallel `Promise.all`), then for generation.
  - Model output parsing is defensive: strips ```json fences, `JSON.parse`s an array; on parse failure falls back to splitting by newline and stripping leading `N. ` numbering — a two-tier recovery for a model that ignores the "output ONLY JSON" instruction.
  - `generationConfig: { thinkingConfig: { thinkingBudget: 0 } }` disables Gemini's extended-thinking mode for both manga-line and description translation (cast `as any` since it's not yet in the SDK's public types) — a deliberate low-latency choice for these bulk small-string calls.
  - `translateDescription()`: skips translation entirely if the source text is already >25% Thai characters (`฀-๿` regex) — avoids double-translating already-localized descriptions. Post-generation, if the model still emits a "THOUGHTS:" reasoning block (fallback despite the no-thinking config), it filters to lines that are >20% Thai-character-dense as a heuristic strip.
  - `getLandingBooks()` fetches all `mangaRowDefs` rows concurrently via `Promise.all` (order preserved) rather than sequentially (#397 — previously all-or-nothing sequential fetch); `serveStale()` (lines 291-305) is the single shared stale-cache fallback used by both the API-fetch-exception path and the "zero rows returned" path, replacing duplicated inline logic.
  - `enhanceLanding()`/`patchLandingCacheIfNeeded()`: re-verifies a cached `thumbnailLocal` path still exists on disk (`imageCache.localPathExists`) before trusting it, since a Redis-cached path can point to a file wiped by a cache reset — self-heals by re-triggering a download via `localThumbnailPath` if missing, and separately patches the landing cache in the background (fire-and-forget `.catch()`) if new local thumbnails were resolved.

### Backend/src/books/manga-catalog.service.ts
- **last_commit:** c77fcc2e86ab6f7021879e74b5714f4308831e52
- **lines_covered:** 1-142 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Carved out of BooksService (#231). Mostly thin delegators to `MangaDexService` for chapters/detail/preview/new-releases/genre, plus two non-trivial pieces: `getRelated()` and `searchBooks()`.
  - `getRelated(id, limit)`: looks up the target manga's first genre tag, resolves it to a MangaDex tag UUID via `getMangaTagId`, fetches `limit+1` manga ordered by `rating` filtered by that tag, then excludes the source manga itself and slices to `limit` — a simple single-genre "more like this" without any collaborative-filtering.
  - `searchBooks()` enhancement: after the primary MangaDex search, it independently queries the Supabase `chapter_versions` table for user-uploaded alt-name matches (`findTitleIdsByAltName`, `title_name.ilike.%q%` OR `title_alt_name.ilike.%q%`, filtered `status='published'`), fetches those extra manga by ID via `fetchMangaByIds`, and merges them into the result (deduped against existing IDs) — lets community-translated titles surface in search even if MangaDex's own title match misses them. Year-range filtering (`yearFrom`/`yearTo`) is applied post-fetch by parsing `publishedDate` as an integer.
  - Search results are cached under `books:query:{normalized-query}:{lang}:{status}:{yearFrom}:{yearTo}:{offset}:{limit}` with `CACHE_TTL_MS` (20 min).

### Backend/src/books/mangadex.service.ts
- **last_commit:** 88da6976042b1314bc1304d5d5e5ba821c87255c
- **lines_covered:** 1-778 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Largest books file. Direct integration with `api.mangadex.org` (chapters/feed, at-home/server, cover, manga search, tags) plus the local image-cache enhancement layer.
  - `MANGA_GENRE_TAGS`: a hardcoded slug→UUID map of 18 MangaDex tag IDs (action, adventure, comedy, romance, fantasy, drama, horror, sci-fi, slice-of-life, sports, mystery, psychological, supernatural, historical, isekai, mecha, school-life, thriller) — used by `getGenreManga()`.
  - `getMangaChapters()` paginates the MangaDex `/manga/:id/feed` endpoint at `PAGE_SIZE = 500` per request (MangaDex's own max), looping with `offset` until `total` is reached or a short page signals end-of-list — needed to support decimal sub-chapters (13.1, 13.2) and full chapter counts beyond the old single-page cap (v3 cache key bump documents this).
  - Content rating is always restricted to `safe` + `suggestive` (never `erotica`/`pornographic`) across chapter/genre/row fetches — a consistent content-policy filter; the one exception is `fetchMangaByIds()` which also allows `erotica` (used for alt-name search hits where the caller already knows the specific IDs).
  - Every fetch method follows the same three-tier resilience pattern: live cache hit → API call → on failure/empty, fall back to `cache.getStale()` (explicitly logged as serving stale data) → only then an empty/null/offline result. This same pattern repeats for chapters, chapter-pages, and manga-detail (each independently, not shared via a helper — an opportunity for future dedup noted by pattern repetition, though the individual differences, like re-running `enhanceX` before returning stale data, make sharing non-trivial).
  - `mangadexFetch()` spoofs `User-Agent: MangaDock/1.0` and passes `cache: 'no-store'` to bypass any HTTP-level caching (the app manages its own cache tiering).
  - `fetchMangaWithParamsPaged()` also drives `StatusService.broadcastStatus('mangadex', ...)` — detects a MangaDex maintenance page by sniffing the response body for `href="/maintenance-"` and reports `'maintenance'` vs generic `'offline'`/`'online'` — feeds a live status indicator elsewhere in the app.
  - Image-cache "patch if needed" pattern appears three times (chapter-pages, manga-detail, landing via LandingService) — re-verify existence, re-resolve local paths, and only if the local-cache count increased, asynchronously re-persist the cache entry (fire-and-forget `.catch()` logging only).
  - `attachLocalStatus()` contains a deliberate cost-avoidance comment: `readerAvailable` is only computed (a Cloudflare Worker `GET /v1/list` R2 call per chapter) when the response will actually be under `forceLocal` or `isOfflineFallback` — otherwise every chapter gets `readerAvailable: false` without hitting R2, to avoid "N Class-A R2 list ops on EVERY chapter-list load."
  - `pickLocalized()` is the single localization-fallback helper: `value[lang] ?? value.en ?? Object.values(value)[0] ?? ''`.

### Backend/src/books/mit-batch-ndjson.ts
- **last_commit:** cad8073e1cd9908a85ec51024f1e1f1e6f64a69c
- **lines_covered:** 1-115 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Pure NDJSON decoder (#294), carved out of `MitBatchOrchestrator._runMitBatch` specifically so the chunk-boundary state machine can be unit tested with hand-crafted strings, no Nest runtime.
  - `parseNdjsonChunk(chunk, carry)` handles TCP chunk boundaries mid-line via a carried-over partial line (`carry + chunk`, split on `\n`, last element becomes the new carry).
  - Sentinel handling: `{done: true}` immediately returns a `'done'` event and stops processing the REST of the current chunk (mirrors an original `break outer`), discarding any events that would follow in the same chunk.
  - Malformed JSON lines become a `'malformed'` event rather than throwing; a non-numeric/NaN `pageIndex` is silently skipped (no event at all).
  - `patches` is passed through as-is (not defaulted to `[]`) — deliberately so a page missing its `patches` array still throws downstream in the consumer's persist step and gets logged + retried like any other line-level failure, matching original behavior byte-for-byte.

### Backend/src/books/mit-batch-orchestrator.service.ts
- **last_commit:** 503c1aabb16fdaa5321d0a6b829dcf60ec4db48a
- **lines_covered:** 1-579 (full)
- **read_date:** 2026-07-04
- **findings:**
  - This is the batch job state machine (#234), the most architecturally dense file in the module. In-memory `Map<jobKey, BatchJobState>` registry (`activeBatchJobs`) tracks: `completedPages`, `processingPages` (in-flight lock set), `listeners` (Set of SSE fan-out callbacks), `originalListener` (guaranteed-direct-delivery reference), `activeCallerCount`, a job-lifetime `promise`/`resolve`/`reject`, a `cancelController: AbortController`, and `expectedCount`.
  - `deliver()` (lines 139-156) is the single fan-out sink: delivers to `originalListener` then every attached `listener`, each wrapped in its own try/catch so one dead SSE connection never blocks delivery to the rest.
  - `maybeComplete()` (lines 163-174) is the single terminal-state decision, shared between the webhook path and the stream-completion path: only resolves the job once `completedPages.size >= expectedCount`, and explicitly logs (rather than silently succeeding) when the completed set contains error pages — documented as fixing a real 2026-06-06 incident where an all-error batch silently read as "fully completed," hiding a dead MIT worker.
  - `handleMitCallback()` (webhook path) enforces idempotency by synchronously checking+locking `processingPages`/`completedPages` before any `await` — prevents duplicate concurrent webhook deliveries for the same page. Persistence failures are caught and converted into a page-level error result (`pageResult = {patches: [], error: ...}`) rather than thrown — comment notes a prior latent bug (caught in review on PR #144) where a throw here skipped `processingPages.delete`, permanently locking that page against retries.
  - Per-patch size bound enforced in the webhook path: any patch with `img_b64.length > 5_000_000` (5 MB base64) is dropped with a warning before being handed to PatchStore (#95 S3).
  - `startOrAttachBatchJob()` (lines 355-545) implements a TOCTOU-safe "register a placeholder job before any await" pattern: the placeholder is inserted into `activeBatchJobs` synchronously before the cache pre-check `await`, so concurrent callers for the same jobKey attach as latecomers instead of racing to create a second job.
  - Rolling cross-page context gotcha (#524, lines 441-470): when `MIT_CONTEXT_PAGES > 0`, per-page translation is not independent — page N depends on pages < N via MIT's `RollingContext`. If the batch isn't 100% cache-hit, the code deliberately does NOT pre-serve any per-page cache hits and instead sends the WHOLE ordered chapter to MIT so the rolling context is built from a complete page set — otherwise a partial-cache batch would silently produce and cache a context-free result under a context-on cache key. `renderConfigHash` (from mit-config.ts) already namespaces context-on vs context-off patches separately, so this only matters mid-transition.
  - Cancellation flow: `removeBatchListener()` decrements `activeCallerCount`; at zero, aborts the `cancelController` (which the stream-transport checks between reads) AND fire-and-forgets `mitClient.cancel(jobKey)` (`POST /cancel/:jobKey`) so MIT itself stops burning GPU on an abandoned job.
  - Every job has a 15-minute hard timeout (`setTimeout` rejecting the job promise) as a leak-safety net independent of the abort/complete paths, guaranteeing `activeBatchJobs` never accumulates zombie entries. `finalize()` is the single teardown point called from `finally` on both resolve and reject paths.
  - Deprecated `translateMangaChapterBatchPatches()` kept only as a backward-compat shim delegating to `startOrAttachBatchJob`.

### Backend/src/books/mit-batch-stream.ts
- **last_commit:** ccdaebc52deb23d8daa072e51de1af6337ce4113
- **lines_covered:** 1-441 (full)
- **read_date:** 2026-07-04
- **findings:**
  - The actual HTTP transport + NDJSON stream reader (#294), carved out of the orchestrator so job-state logic and wire-protocol logic don't live in the same file. Knows nothing about jobs/listeners/registry — reports everything through an injected `notify` callback.
  - `mitCallbackOrigin` resolution order: `MIT_CALLBACK_ORIGIN` → `BACKEND_PUBLIC_ORIGIN` → `http://localhost:{PORT}` — lets a same-machine MIT deployment call back via localhost instead of round-tripping through the public Cloudflare Tunnel URL.
  - Batch submit deliberately sends NO abort signal on the POST to `/translate/with-form/patches/batch` (comment explains: once MIT accepts, it processes async and webhooks back even after SSE disconnect; killing the POST mid-flight crashes MIT's BLAS/Fortran runtime with `forrtl error 200: window-CLOSE event`) — a hard-won operational constraint.
  - Handles MIT's async-acceptance contract: HTTP 202 (or 200 with `content-type: application/json` and `{status:'accepted'}`) means "the webhook will handle the rest" and the function returns immediately without reading a body stream.
  - Stream read has its own timeout independent of the overall job timeout: `Math.max(30_000, MIT_BATCH_STREAM_READ_TIMEOUT_MS ?? 90_000)` per `reader.read()` call via `Promise.race` against a rejecting timer — guards against MIT going silent mid-stream without closing the connection.
  - Per-page persistence inside the stream loop supports a `recoverIfEmpty` callback: if `srcMIT !== 'ANY'` and a page's initial patch set is empty, it retries via `deps.translateSinglePage(..., sourceLang: undefined, ...)` — i.e., re-translates that one page with `source_lang_only` filtering disabled, before the first cache write, so a bad first pass never gets cached as empty.
  - `_retryMissingPagesIndividually()` runs a bounded worker pool (`POOL_SIZE = 4`) over pages the stream never delivered (dropped/skipped/failed), each worker checking `signal?.aborted` before pulling its next page from a shared `cursor` — an abort mid-recovery stops the whole pool immediately rather than only the next serial iteration (comment: JS is single-threaded so no locking is needed for `cursor++`).
  - Distinguishes three failure classes when reading the stream: `signal.aborted` → user-cancelled, skip retry, cache retained; any other read exception → `streamFailedError` set, falls through to per-page recovery; a malformed NDJSON line is logged and skipped without aborting the whole read loop.

### Backend/src/books/mit-batch-types.ts
- **last_commit:** cad8073e1cd9908a85ec51024f1e1f1e6f64a69c
- **lines_covered:** 1-61 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Shared type module extracted purely to break a circular-dependency risk between `mit-batch-orchestrator.service.ts` and `mit-batch-stream.ts` (orchestrator imports the stream class at runtime).
  - Defines `PatchEntry`, `PageResult`, `BatchPageListener`, and the `MitBatchDeps` interface — the dependency-injection contract (`persistPage`, `seriesContextFor`, `translateSinglePage`) that keeps `BooksService` as the sole owner of `PatchStore`/`TranslationMemoryRepository`/`MangaDexService`/`MitTranslationService`, preserving a strict one-way dependency graph.

### Backend/src/books/mit-client.ts
- **last_commit:** 754df6b75d18c9d7d40b95421f27673a20dc54c6
- **lines_covered:** 1-60 (full)
- **read_date:** 2026-07-04
- **findings:**
  - The single HTTP boundary to MIT (#230) — base URL resolved once (`process.env.MANGA_TRANSLATOR_URL ?? 'http://localhost:5003'`) rather than the five separate inline reads it replaced, so an env override or test injection is guaranteed consistent.
  - Four endpoints wrapped: `ready(timeoutMs)` → `GET /ready`; `submitSinglePage(form, timeoutMs)` → `POST /translate/with-form/patches`; `submitBatch(form)` → `POST /translate/with-form/patches/batch` (no abort signal, same crash-avoidance reasoning as mit-batch-stream.ts); `cancel(jobKey)` → `POST /cancel/:jobKey` (best-effort, MIT no-ops unknown/finished jobs).
  - Explicitly the "fakeable seam" comment states this class is what finally made the translation subsystem unit-testable — a test can inject a fake `MitClient` instead of mocking global `fetch`.

### Backend/src/books/mit-config.ts
- **last_commit:** 503c1aabb16fdaa5321d0a6b829dcf60ec4db48a
- **lines_covered:** 1-353 (full)
- **read_date:** 2026-07-04
- **findings:**
  - This is the single source of truth for every MIT-facing key/config builder (#229), pulled together specifically because drift here silently breaks cancellation or cache hits.
  - `parseJobKey()` splits `chapterId:srcMIT:tgtMIT:model:derivative` from the RIGHT (pops the last 4 fixed segments) specifically because a user-uploaded chapter id can be `ver:<uuid>` which itself contains a colon — a left-split would misparse `chapterId` as `"ver"`.
  - `mitLangPair()` / `buildJobKey()` / `patchCacheKey()` are all env-parametrized pure functions — the comment states a mismatch between the jobKey builder and cache-key builder "silently breaks cancellation (the cancel path looks up a jobKey the start path never registered)," which is exactly why these are centralized.
  - `renderConfigHash(env)`: SHA-1 (first 10 hex chars) over every sorted `MIT_*` env var — folded into the patch cache key (v7) so that ANY render/pipeline knob change (font, anti-overlap, sizing, SFX toggle, etc.) automatically busts cached patches instead of silently serving stale renders under a changed pipeline. This directly implements the "renderConfigHash" concept referenced in the project's own memory notes.
  - `buildMitConfig()` (lines 175-353) constructs the actual JSON config body sent to MIT, gated behind ~20 individual `MIT_*` env flags, each with an extensive inline comment documenting the underlying rendering/inpainting rationale and issue number: e.g. `MIT_DETECTION_SIZE` default 2560 (matches MIT's own tuned default; 2048 was found to silently drop ~36% of small/faint glyphs below DBNet's threshold, #247), `MIT_INPAINTING_SIZE` default 2048 (1536 caused blurrier plate/screentone smear), `MIT_INPAINTER` default `lama_large`, `MIT_BUBBLE_AREA_FIT`, `MIT_ANTI_OVERLAP`, `MIT_CLEAN_LAYOUT`/`MIT_REFERENCE_LAYOUT` (binary-search font-fit for narration/caption boxes, #178), `MIT_KNUTH_PLASS` (Knuth-Plass line-breaking vs greedy packer, #180), `MIT_PATCH_CONTENT_ALPHA` (#436 — shapes patch alpha to actual glyph+erase-mask footprint instead of a full opaque rectangle, specifically so two overlapping speech balloons stop erasing each other's clean background; explicitly distinguished from a rolled-back #266 luminance-band attempt that reused the same flag name).
  - Every flag defaults to "off/absent = byte-identical to prior behavior" — a strict backward-compatibility discipline enforced by comment convention throughout the file.
  - `mitLangPair()` supports disabling source-language hinting entirely via `MIT_SEND_SOURCE_LANG=false/0/no/off`, letting MIT auto-detect the source language (`srcMIT = 'ANY'`).

### Backend/src/books/mit-lang-map.ts
- **last_commit:** 4a155d7f018cb4c6aed62b43b061883a3ca8cd38
- **lines_covered:** 1-28 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `MIT_LANG_MAP`: ISO code → MIT `VALID_LANGUAGES` code (e.g. `th → THA`, `ja → JPN`, `zh-hk → CHT`, `pt-br → PTB`). Comment states every value must exist in `MIT/manga_translator/translators/common.py`'s `VALID_LANGUAGES`, and references a real historical bug (#165) where `es`/`pt`/`vi` had drifted to codes MIT rejected — now pinned by a spec test (`mit-lang-map.spec.ts`).
  - `mitLangCode()` falls back to `isoLang.toUpperCase()` for any code not in the map (best-effort forward compatibility rather than throwing).

### Backend/src/books/mit-translation.service.ts
- **last_commit:** 4a155d7f018cb4c6aed62b43b061883a3ca8cd38
- **lines_covered:** 1-257 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Single-page MIT translation path carved out of BooksService (#233). Flow: cache check (`patchCacheKey`) → `loadPageBytes()` (disk-first for `/img-cache` and `/uploads` paths, byte-identical to what the Reader displays — see page-source.ts) → `buildMitConfig()` → submit with startup retry.
  - Startup-retry loop (lines 125-169): up to `opts?.maxStartupRetries ?? 30` attempts, each waiting `startupRetryDelayMs = 5_000` ms, ONLY retrying on HTTP 500 (any other status throws immediately) — models MIT's cold-start window (worker booting a model can 500 for a while before becoming ready). Total worst-case wait ≈ 150 seconds (30×5s) plus per-attempt request time (each capped at `300_000` ms = 5 min via `submitSinglePage(form, 300_000)`).
  - Distinguishes connection-refused/fetch-failed errors (`"manga-image-translator service unavailable"`) from abort/timeout errors (`"...timed out after 5 minutes"`) via string matching on the caught error message.
  - `getImageTranslator()` caches the translator-family probe result (from `/ready`, #132) for 60 seconds in-memory (`imageTranslatorCache.expiresAt`); on MIT-down or any exception it degrades to `null` rather than throwing — comment: consumers treat `null` as "unknown" and the Reader "fails open" (PRD #131).
  - `checkMitHealth()` uses a 5-second timeout on `/ready` vs. 3 seconds for the translator-family probe — the two callers intentionally use different timeout budgets.

### Backend/src/books/mit-webhook.controller.ts
- **last_commit:** bc6902cf88163ca1877449942215a716adceec04
- **lines_covered:** 1-115 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `POST /webhooks/mit/callback` — the receiving end of MIT's async batch callback (#95 S1/S2, resolved 2026-06-05). HMAC-SHA256 policy with three explicit branches: secret configured → verify every request over raw bytes; no secret + `NODE_ENV=production` → hard reject (401, "Webhook secret not configured") — an unauthenticated results endpoint in production would let anyone inject arbitrary "translations"; no secret + non-production → accept unauthenticated (documented as an intentional local-dev convenience, decision dated 2026-06-04).
  - HMAC is verified over `req.rawBody` (captured by a JSON-body verify hook in `main.ts`), NOT a re-serialization of the parsed body — comment explains re-stringifying can differ byte-for-byte from what MIT actually signed (middleware key-order transforms, or Python `json.dumps` float formatting `"1.0"` vs JS `JSON.stringify` `"1"`). Falls back to `Buffer.from(JSON.stringify(body))` only for callers without an Express request object (e.g. direct unit test invocation).
  - Uses `crypto.timingSafeEqual` for signature comparison (constant-time, avoids timing side-channel), with an explicit length check first (`timingSafeEqual` throws on mismatched buffer lengths otherwise).
  - Explicitly documents itself as an anti-corruption layer: MIT sends a flat payload (`{taskId, pageIndex, imgWidth, imgHeight, patches, error}`), which this controller reshapes into the structured `result` object `handleMitCallback` expects.
  - Handles a separate "informational progress" webhook shape: `{taskId, pageIndex, stage}` with no `patches`/`error` — routed to `notifyBatchProgress()` and NOT logged per-event (comment: "one event per stage per page" would be noisy) nor recorded as a completed page.

### Backend/src/books/page-source.ts
- **last_commit:** 27d2974ca4ad0f373935fab1f958baf66a245e73
- **lines_covered:** 1-88 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `loadPageBytes()` (#156) is the single decision point for how to read a source page for translation: `/img-cache/...` paths and `/uploads/...` (or `/api/proxy/uploads/...`) paths are read straight from local disk; anything else is fetched over HTTP with a spoofed UA/Referer and a 30s timeout.
  - `readLocalPage()` is a path-traversal-hardened disk reader: decodes percent-encoding first (`decodeURIComponent`, throwing "invalid path" on failure), normalizes backslashes to forward slashes, then resolves against the root and checks the RELATIVE path doesn't start with `..` or become absolute — guards against both encoded (`..%2e`) and backslash (`..\\`) traversal attempts, explicitly called out in the comment as handling both attack vectors before path resolution.
  - Rationale documented for reading from disk rather than re-fetching relative URLs: `/api/proxy/uploads/...` has no origin to resolve against (previously threw "Failed to parse URL"), and re-fetching could yield a different image encode than what the Reader actually displayed, reintroducing a visible tone mismatch around translated patches.
  - `fetchImpl` and `signal` are both injectable/optional — the external-fetch path supports cancellation via `AbortSignal.any([opts.signal, timeout])` when a job-level abort signal is passed in (used by the batch stream path).

### Backend/src/books/patch-store.ts
- **last_commit:** cb9fcd5fc15b827dc67a968f8af904044bcd4ae0
- **lines_covered:** 1-154 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `PatchStore` is the single owner of Patch Set files on storage (#137). Deterministic filenames (`{src}__{tgt}__{model}__p{page}__r{region}.png` under `uploads/patches/{chapterId}`) mean a re-translate overwrites in place instead of growing the disk forever with random-suffixed orphans (the pre-#137 behavior).
  - `toPathSegment()` maps `:` → `_` specifically because user-uploaded "version" chapters are addressed as `ver:<uuid>` and `:` is a valid ID-scheme separator but not a legal path character; every OTHER unsafe character still trips `assertSafeSegment` afterward, so the traversal guard is preserved.
  - `assertSafeSegment()` enforces `/^[\w.-]+$/` plus an explicit `.includes('..')` check on every path segment (chapterId, srcMIT, tgtMIT, model) — same character-class discipline as `imageModelKey` in mit-config.ts.
  - `OWNED_NAME = /__p\d+__r\d+\.png$/` is used by `sweepLegacy()` to distinguish PatchStore-owned files (never swept — bounded by overwrite) from the pre-#137 random-named backlog (removed). Comment explains WHY the match is on this specific tail rather than segment-wise: model IDs may legally contain `_` (per `imageModelKey`'s `\w` allowance), so a segment-wise match would misclassify some owned files as legacy and delete real, current patches — a data-loss bug caught in code review before shipping.
  - `put()` writes region PNGs concurrently (`Promise.all`, not `allSettled` — deliberately preserves an "all-or-nothing" contract: any single write failing rejects the whole `put()` and skips the stale-cleanup step, matching the previous sequential for-await behavior) and appends a content-hash query param (`?v={sha1(png).slice(0,12)}`) to each returned URL so a re-translate with identical bytes stays cache-hit (`max-age=14400`ish) while changed bytes bust the cache via a new URL.
  - After writing the new region set, it lists the directory and deletes any of ITS OWN prefix's files whose region index is `>= pngs.length` — cleans up a page that shrank (fewer regions on re-translate) so a stale region PNG never lingers.
  - `startSweeping()` runs the legacy sweep once immediately then every 24 hours via `setInterval(...).unref()` (doesn't keep the Node process alive) — failures surface via an `onError` callback so a silently-dead sweeper (letting the legacy backlog regrow) isn't invisible.

### Backend/src/books/patches.controller.ts
- **last_commit:** 0e91bb4364e75c4f2c4b122a831ea06ce191d16c
- **lines_covered:** 1-31 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `GET /r2-patches/*` — a wildcard route serving R2-stored (or generically `StorageProvider`-backed) patch PNGs, only reachable when Worker routing / R2 mode is active (`WORKER_URL` set); disk mode continues to serve patches via Express static `/uploads/` instead.
  - Sets `Cache-Control: public, max-age=31536000, immutable` (1 year) — safe because patch keys are content-versioned via PatchStore's `?v=` hash query param, so an immutable cache header on the underlying path is fine even though the PNG bytes can change on re-translate (the URL changes, not the cached path's content).
  - Path handling: strips the `/r2-patches/` prefix manually from `req.path` rather than using a Nest wildcard param; guards against an empty/unchanged key (would mean the prefix didn't match) with `NotFoundException`.

### Backend/src/books/series-context.ts
- **last_commit:** 3fa2b89419102918a3da71b1ecd27b6c934cba36
- **lines_covered:** 1-31 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Tiny pure function module (#157): `composeSeriesContext({title, description})` turns already-fetched MangaDex catalog metadata into a translator-facing prompt-context string, e.g. `You are translating the manga series "X". Synopsis: Y.` Returns `undefined` (not an empty string) when there's no title, so the caller's translate path stays byte-identical to context-free behavior — explicit "local-first" design.
  - `SYNOPSIS_MAX_CHARS = 500` bounds the description length fed into the prompt, explicitly to avoid a runaway catalog synopsis eating token budget that should go to the actual text being translated.
  - `collapse()` helper: `.replace(/\s+/g, ' ').trim()` collapses markdown line breaks from catalog descriptions into a single space before slicing to the max length.

### Backend/src/books/translation-memory.repository.ts
- **last_commit:** bc6902cf88163ca1877449942215a716adceec04
- **lines_covered:** 1-97 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `TranslationMemoryRepository` (#160, PRD #155 P3) is a best-effort wrapper over two Supabase tables: `chapter_page_texts` (upsert on conflict `chapter_id,page_index,target_lang`, storing a `regions: TextLayerRegion[]` JSON array of `{src, dst}` pairs plus an optional `model`) and `manga_glossaries` (upsert on conflict `manga_id,target_lang`, storing a `glossary: Record<string,string>` plus a `source: 'auto'|'edited'` and `updated_at`).
  - Every method is wrapped in try/catch and returns a `boolean` rather than throwing or rejecting — the class comment states explicitly this is so a persistence failure never propagates to break translation (local-first rule), consistent with how `BooksService.persistPage()` calls it fire-and-forget (`void ...`).
  - `upsertGlossary()` implements simple curation protection: an `'auto'` write first checks whether the existing stored row has `source='edited'` (human-curated) and skips the write entirely if so — an automated glossary extraction is never allowed to clobber a human edit; an explicit `'edited'` write always wins unconditionally.

---

## Forum

### Backend/src/forum/forum-events.service.ts
- **last_commit:** f994c47c905735146aad8042339b77290fab8274
- **lines_covered:** 1-103 (full)
- **read_date:** 2026-07-04
- **findings:**
  - The real-time bridge: local RxJS `Subject`s (`postSubject`, `feedSubject`) fan out to SSE consumers within one Node process; Redis pub/sub (`forum:events`, `forum:feed` channels via `RedisService.subscribe`/`publish`) fans events out ACROSS multiple backend instances/processes.
  - Self-echo prevention: every published Redis message is tagged with `_src: this.instanceId` (`${Date.now()}-${Math.random().toString(36).slice(2)}`, unique per process); the subscriber callback checks `data._src === this.instanceId` and drops the message if so — prevents an instance from re-delivering its own event to its own local SSE clients a second time via the Redis round-trip (local delivery already happened synchronously in `broadcastPostEvent`/`broadcastFeedEvent` before the Redis publish).
  - Dual-delivery-always pattern: `broadcastPostEvent()`/`broadcastFeedEvent()` ALWAYS push to the local `Subject` first (`if (!this.postSubject.closed) this.postSubject.next(event)`), then separately attempts a Redis publish only `if (this.redis.available)`, wrapped in try/catch that only logs a warning — comment: "Redis may silently fail" and local delivery must never depend on Redis being healthy (single-instance deployments keep working with zero cross-process fan-out).
  - `ForumSSEEvent` union: `vote` (postId/targetType/targetId/upvotes/downvotes), `comment` (postId + full `ForumComment`), `post_edited` (postId/title/content/updatedAt), `post_deleted` (postId), `comment_deleted` (postId/commentId) — a closed discriminated union covering every real-time mutation type.
  - `getPostStream(postId)` filters the shared `postSubject` down to events matching that specific `postId` — meaning ALL forum events flow through one process-wide Subject and are filtered per-subscriber, rather than maintaining one Subject per post.
  - Cleanup on `OnModuleDestroy`: unsubscribes both Redis channel listeners and calls `.complete()` on both Subjects — proper resource teardown on Nest module shutdown.

### Backend/src/forum/forum.controller.ts
- **last_commit:** c7352625768b786275e364ff68bc3a5cc03eec85
- **lines_covered:** 1-204 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `@Sse('posts/:id/stream')` and `@Sse('feed/stream')` both use Nest's native `@Sse()` decorator (returns an `Observable<{data: object}>`) rather than manual `res.write()` like the books batch-translate SSE endpoint — a different SSE implementation style within the same codebase (Nest built-in vs. raw Express response streaming).
  - Both SSE streams are `merge()`d with a 25-second heartbeat (`interval(25_000).pipe(map(() => ({data: {type: 'heartbeat'}})))`) — same idle-timeout-avoidance concern as the books batch endpoint's 15s ping, but implemented via RxJS operators instead of `setInterval`.
  - Auth pattern split cleanly by mutating vs. read endpoints: `AuthGuard` (hard-required) on create/update/delete/vote/upload actions; `OptionalAuthGuard` on read endpoints (`listPosts`, `getPost`, `listComments`, `getPublicProfile`) — read endpoints still receive `req.uid` when a token IS present (to compute `userVote`), but don't require one.
  - File-upload endpoints (`profile/banner`, `upload-image`) both use `FileInterceptor` with `limits: {fileSize: 5 * 1024 * 1024}` (5 MB) and a `fileFilter` restricted to `ALLOWED_IMAGE_TYPES = {image/jpeg, image/png, image/webp, image/gif}` at the Multer layer (Content-Type header check) — but note the actual magic-byte validation happens downstream in `ForumService` via `file-type` (defense in depth: Multer's check is a fast/cheap first filter on the client-declared MIME, the service's `fileTypeFromFile` check is authoritative).
  - Uploads are written to `os.tmpdir()` via `diskStorage`, with filenames randomized via `crypto.randomUUID()` (`banner_${uuid}` / `forum_img_${uuid}`) to avoid path collisions/guessable names; the temp file is always cleaned up in a `finally` block (`fs.unlink(file.path, () => undefined)` — errors silently ignored) regardless of upload success/failure.
  - `listPosts` clamps `limit` to a max of 100 (`Math.min(100, ...)`) server-side regardless of client-requested value; sort defaults to `'hot'` at the controller default-param level (note: `ForumService.listPosts`'s own default is `'new'`, but the controller's decorator default `sort: 'new'|'hot' = 'hot'` always wins since the controller passes an explicit value — the service default is effectively dead code for this call path).
  - `deletePost`/`deleteComment` return `HttpCode(204)` with no body — REST-conventional for a delete op that returns nothing.

### Backend/src/forum/forum.dto.ts
- **last_commit:** b62f9ec2e34a9493f87f85df23c8cdab86dae7bd
- **lines_covered:** 1-106 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `class-validator`/`class-transformer` DTOs, contrasting with the manual `parseInt`/ternary query-param handling in `books.controller.ts` — forum's POST/PATCH bodies are strictly typed and validated at the framework boundary (implies a global `ValidationPipe` is registered, not shown in this file but implied by the decorators being meaningful).
  - `CreatePostDto`: `title` 1-200 chars, `content` 1-10,000 chars, `category` restricted to `IsIn(['general','announcement','spoiler','manga_update'])`, optional `targetMangaId`/`targetMangaTitle`/`targetMangaCover` (100/200/500 char caps respectively), optional `imageUrls?: string[]` capped per-element at 500 chars (no explicit array-length cap — relies on `forum_posts.image_urls TEXT[]` and app-level convention per CLAUDE.md).
  - `CreateCommentDto`: `postId`/`parentId` are `@IsUUID()` — validated as real UUIDs, not free strings; `content` 1-5,000 chars (half the post-content cap).
  - `VoteDto`: `targetType` restricted to `'post'|'comment'`, `targetId` UUID, `voteValue` restricted to the literal set `[1, -1]` — no abstain/zero vote is representable at the DTO level (matches the "toggle" semantics implemented server-side in `cast_vote_atomic`).
  - `UpdateBannerPositionDto.position` uses `@IsNumber({maxDecimalPlaces: 2}) @Min(0) @Max(100) @Type(() => Number)` — exactly the float-DTO pattern documented in the project's own CLAUDE.md guidance ("Use `@IsNumber({maxDecimalPlaces:2})` + `@Type(()=>Number)` instead of `@IsInt()` when drag/calculation inputs can produce floating-point values"), confirming this file is where that convention is actually applied.

### Backend/src/forum/forum.module.ts
- **last_commit:** b429175979b03429d327bba4e1a2a9e8e653f693
- **lines_covered:** 1-13 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Trivial wiring file: imports `SupabaseModule`; registers `ForumController`; provides + exports both `ForumService` and `ForumEventsService` (exporting the events service lets other modules, e.g. a future notifications module, subscribe to forum real-time events without re-instantiating the Subject/Redis bridge).

### Backend/src/forum/forum.service.ts
- **last_commit:** 23316b2dd0876a4919408e0ac4f75e907b3b0a53
- **lines_covered:** 1-727 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Data model (inferred from Supabase queries): `forum_posts` (`id, author_uid, title, content, category, target_manga_id, target_manga_title, target_manga_cover, image_urls TEXT[], upvotes, downvotes, created_at, updated_at, deleted_at`), `forum_comments` (`id, post_id, parent_id, author_uid, content, upvotes, downvotes, created_at, updated_at, deleted_at`), `forum_votes` (`uid, target_type, target_id, vote_value, created_at`), `profiles` (`uid, display_name, photo_url, banner_url, banner_position, role, bio, country, translator_languages, rating_avg, rating_count, created_at`), `chapter_versions` (`title_id, title_name, language, status, translator_uid`), `translator_earnings` (`translator_uid, total_sales, total_earned, titles_sold, unique_buyers`).
  - Soft deletes throughout: both posts and comments use `deleted_at IS NULL` filtering rather than hard deletes (`update({deleted_at: new Date().toISOString()})`); every list/get query filters `.is('deleted_at', null)` AND, for post-with-comment-count joins, also `.is('comments.deleted_at', null)` so a soft-deleted comment doesn't inflate the visible `commentCount`.
  - **Voting is fully server-side atomic via a Postgres RPC**: `vote()` calls `this.db.rpc('cast_vote_atomic', {p_uid, p_target_type, p_target_id, p_vote_value})` rather than a client-side select-then-write. Comment explicitly states this replaced an older select-then-write pattern that could 500 on a primary-key conflict or interleave delete/update/insert into an inconsistent state under concurrent votes (FR-9) — the atomicity (toggle logic, recalculation of `upvotes`/`downvotes`) lives entirely in the DB function, not in this file. Bigint counts arriving as strings over PostgREST are explicitly coerced via `Number(...)`.
  - **Trending is also a Postgres RPC**: `getTrendingManga()` calls `get_trending_manga(p_limit)` rather than pulling a row sample into Node and tallying client-side. Comment explains the OLD approach pulled a 200-row sample and tallied in Node, which "undercounted/mis-ranked once a manga's within-window posts spilled past the sample" — the RPC reproduces the same filter semantics (non-null id, non-empty title, created within the last 7 days) but counts/orders across the FULL table server-side (FR-16). On any Supabase error or unexpected exception, both RPC-backed methods fail soft (return `[]`) rather than throwing/500ing to the client.
  - **Comment nesting** is built entirely in application memory, not via a recursive CTE: `listComments()` fetches up to 500 flat comments per post (`order('created_at', asc).limit(500)`), builds a `Map<id, ForumComment>` with each comment pre-seeded with `replies: []`, then a second pass either pushes a comment into its `parentId`'s `replies` array (if the parent exists in the map) or treats it as a root comment — meaning a comment whose parent is missing (e.g. hard-deleted, or parent belongs to a different post — validated at creation time, see below) silently becomes a root-level comment rather than being dropped or erroring. The 500-comment cap is a hard, silent truncation ceiling per post with no pagination.
  - `createComment()` validates `parentId` cross-post integrity explicitly: if a `parentId` is given, it fetches that parent comment and throws `BadRequestException('Parent comment must belong to the same post')` if `parentComment.post_id !== dto.postId` — prevents a client from nesting a reply under a comment belonging to an unrelated post.
  - Upload validation is defense-in-depth, matching CLAUDE.md's documented pattern: `uploadBanner()`/`uploadImage()` both re-validate the uploaded temp file's actual magic bytes via `fileTypeFromFile()` (the `file-type` package) against `ALLOWED_IMAGE_MIME`, independent of the Multer-layer Content-Type filter already applied in the controller — rejects and deletes the temp file if the real bytes don't match an allowed image type, regardless of what Multer/the client claimed.
  - Storage keys are randomized and content-addressed by UUID, not user input: `${crypto.randomUUID()}${MIME_TO_EXT[mimeType]}` under `uploads/banners/` or `uploads/forum/` — the extension is derived from the DETECTED mime type (not client filename), so a mismatched extension can't smuggle a different content type past static-file serving.
  - `getPublicProfile()` fires five Supabase queries concurrently via `Promise.all` (profile, own posts, own comments, liked-post votes, translated chapter_versions) then does a SIXTH sequential fetch for the actual liked-post rows (by the IDs harvested from the votes query) — can't be parallelized with the first batch since it depends on `likedVotesRes`'s output. `earnings` is only populated when `role IN ('translator','creator')` AND the viewer IS the profile owner (`viewerUid === uid`) — a privacy/business-data gate baked directly into the service rather than left to the frontend.
  - Every mutating action that has real-time consequences (`createPost`, `createComment`, `vote`, `updatePost`, `deletePost`, `deleteComment`) fires its `ForumEventsService.broadcastPostEvent`/`broadcastFeedEvent` call as fire-and-forget (`.catch(err => this.logger.warn(...))`), never awaited into the response — an SSE broadcast failure never delays or fails the HTTP response to the actor who performed the action.
  - `vote()` resolves the `postId` needed for the broadcast differently depending on target type: direct passthrough for `targetType==='post'`, but an extra `forum_comments` lookup (`select('post_id').eq('id', targetId).single()`) for `targetType==='comment'` — comment votes require this indirection since the SSE channel is keyed by post, not comment.

### Backend/src/forum/forum.types.ts
- **last_commit:** b429175979b03429d327bba4e1a2a9e8e653f693
- **lines_covered:** 1-129 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Pure type-only file. `ForumCategory` is the same 4-value union enforced by `forum.dto.ts`'s `@IsIn`. `ForumComment.replies?: ForumComment[]` is the recursive self-reference used by `forum.service.ts`'s in-memory nesting builder.
  - `userVote: number` is documented inline as `// 1, -1, or 0` on both `ForumPost` and `ForumComment` — a plain number rather than a `1 | -1 | 0` literal union or nullable boolean, presumably for simplicity/JSON-transport uniformity with the vote RPC's return shape.
  - `PublicUserProfile`/`UserProfileResponse`/`UserProfileEarnings`/`TranslatedTitle`/`ProfileComment`/`TrendingManga` are the response DTOs assembled by `getPublicProfile()`/`getTrendingManga()` — `UserProfileResponse.earnings: UserProfileEarnings | null` reflects the conditional-visibility business rule (only populated for the profile owner's own creator/translator earnings) enforced in the service.

---

## Users

### Backend/src/users/email-validation.service.ts
- **last_commit:** 91421149f51aa3a3612a434e5cd3432d000cbf45
- **lines_covered:** 1-332 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Implements a signup-time email quality gate against **AbstractAPI's Email Reputation** endpoint (`https://emailreputation.abstractapi.com/v1/`), fully env-driven: `EMAIL_VALIDATION_PROVIDER`, `EMAIL_VALIDATION_API_KEY`, `EMAIL_VALIDATION_TIMEOUT_MS` (default 5000ms, floor 1000ms), `EMAIL_VALIDATION_CACHE_TTL_SEC` (default 21600s = 6h, floor 60s), `EMAIL_VALIDATION_FAIL_OPEN` (defaults `true`).
  - Decision model is a tri-state (`allow` / `warn` / `block`) rather than boolean — e.g. `role` emails (support@, admin@) and `catchAll`/`risky`/`unknown` deliverability produce a `warn` (still allowed) rather than a hard block; only `invalid_format`, `disposable_email`, `no_mx_records`, and `undeliverable` hard-block.
  - **Fail-open by default**: if the external provider call throws (timeout, HTTP error), and `EMAIL_VALIDATION_FAIL_OPEN` is not explicitly `'false'`, signup is still allowed with a Thai-language warning surfaced to the user — a deliberate availability-over-strictness tradeoff so a third-party outage cannot block new signups.
  - Uses `AbortController` + `setTimeout` for a hard request timeout, and a cache layer (`CacheOrchestratorService`) keyed `email-validation:v1:<normalizedEmail>` to avoid re-querying AbstractAPI for the same address within the TTL.
  - Pre-checks Supabase `profiles` table for an existing row with the same normalized (trim+lowercase) email before calling the external API at all — returns a `block`/`email_already_in_use` decision with a Thai message, skipping the paid API call entirely for known duplicates.
  - PII hygiene: `maskEmail()` truncates the local-part before logging (e.g. `ab***@domain.com`) — raw emails are never logged verbatim.
  - All user-facing `message`/`warning` strings are Thai-language (product is Thai-market-first).

### Backend/src/users/users-public.controller.ts
- **last_commit:** a78f1e623deaa16497f40fb36019e72e5d11e9c0
- **lines_covered:** 1-28 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Two unauthenticated routes: `POST /users/validate-email` (thin wrapper delegating to `EmailValidationService.validateForSignup`, with a `BadRequestException` guard for empty/whitespace email) and `GET /users/:uid/translator` (public translator profile lookup, delegates authorization/filtering entirely to `UsersService.getPublicTranslatorProfile`).
  - No `@UseGuards` on the controller — intentionally public, mirrored by role filtering happening service-side (see `users.service.ts` `getPublicTranslatorProfile`, which 404s unless role is translator/creator/admin).

### Backend/src/users/users.controller.ts
- **last_commit:** 107af58aec628d53072d546b74a3e6a8729fb1e3
- **lines_covered:** 1-246 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Class-level `@UseGuards(AuthGuard)` — every route requires a valid Supabase Bearer JWT; `req[USER_KEY]` (a `SupabaseAuthUser`) is the sole source of identity for all mutations (no client-supplied uid is ever trusted).
  - Deliberate split between `POST /users/me` (`upsertMe`, called post-login, **never overwrites** existing `displayName`/`photoURL`) and `PATCH /users/me` (`updateMyProfile`, **always overwrites** those fields when explicitly provided) — comment explicitly documents this asymmetry.
  - Avatar delete (`DELETE /users/me/avatar`) enforces an ownership check by filename convention: `filename` must start with `${uid}_` or it throws `BadRequestException('Invalid filename')` — prevents a user from deleting another user's avatar file by guessing/supplying an arbitrary filename.
  - Avatar upload (`POST /users/me/avatar`) uses `FileInterceptor` with `memoryStorage()`, a 5MB size limit, and a `fileFilter` that rejects any non-`image/*` mimetype before it reaches the handler — file is then handed to the injected `StorageProvider` (`STORAGE_PROVIDER` token) rather than touching disk directly, keeping the controller storage-backend-agnostic.
  - `POST /users/me/mark-email-verified` has a security-relevant gate: it only marks the account's email verified if the Supabase JWT records `providers` including `'google'` or `'facebook'` — i.e. only OAuth-guaranteed emails can be self-marked-verified; pure email/password accounts get `{ ok: false, reason: 'no_social_provider' }`. This prevents users from self-declaring an unverified password-signup email as verified.
  - CSV export route (`GET /users/me/history/export`) streams `text/csv` with `Content-Disposition: attachment` directly via injected `Response` (bypasses Nest's normal JSON serialization).
  - Translator upgrade routes (`me/become-translator`, `me/translator-profile`) are thin pass-throughs to `UsersService`; role-transition and authorization logic lives entirely in the service (see below).

### Backend/src/users/users.module.ts
- **last_commit:** 94a10fb14d1800266acf143ad859d58756632d48
- **lines_covered:** boilerplate, skimmed only
- **read_date:** 2026-07-04
- **findings:**
  - Standard NestJS module wiring: registers `UsersController` + `UsersPublicController`, provides `UsersService` + `EmailValidationService`, exports `UsersService` for cross-module use (e.g. by other modules needing profile lookups).

### Backend/src/users/users.service.ts
- **last_commit:** d98c9bfbea5b1f1caf7200a555a96a8254404aec
- **lines_covered:** 1-659 (full)
- **read_date:** 2026-07-04
- **findings:**
  - **Data model**: Supabase Postgres tables `profiles` (1:1 per uid; snake_case columns `display_name`, `photo_url`, `trust_score`, `rating_avg`, `rating_count`, `translator_languages: string[]`, `photo_history: string[]`, `role: 'user'|'translator'|'creator'|'admin'`, `plan: 'free'|'premium'|'pro'`), plus child tables `user_favorites`, `user_liked`, `user_history` (all FK'd on `uid`), each mapped camelCase in TS via explicit `mapProfile`/`mapFavorite` functions — no ORM, raw Supabase query builder calls throughout, errors surfaced by re-throwing with contextual messages.
  - `upsertUser` (login path) is written to be race-safe: it does an atomic `upsert(... , { onConflict: 'uid', ignoreDuplicates: true })` (INSERT-only-if-missing) to eliminate a prior read-then-write race between concurrent logins, followed by an idempotent unconditional email refresh, then two conditional backfills of `display_name`/`photo_url` guarded with `.is(col, null)` so an existing user value is **never** clobbered by a fresh OAuth profile fetch. Comments explicitly document the rationale (this reads like a fixed historical race-condition bug).
  - `deleteUserAccount` performs cascading deletion: parallel `Promise.all` deletes across `user_favorites`/`user_liked`/`user_history` (independent of each other), *then* deletes the `profiles` row (FK-dependency ordering respected), then walks the injected `StorageProvider` to delete every avatar file whose name starts with `${uid}_`.
  - `exportHistory` (CSV) has an explicit **CSV-injection (formula-injection) guard**: any cell value starting with `=`, `+`, `-`, or `@` gets a leading single-quote prepended before quote-escaping, so a malicious "title" value could not become a live formula when opened in Excel/Sheets — a specific, named security control worth citing in a thesis on injection defenses beyond SQL/XSS.
  - `updatePhotoHistory` distinguishes "social CDN" photo URLs (Google `lh3.googleusercontent.com`, Facebook `fbcdn.net`/`fbsbx.com`) from self-uploaded ones: social URLs are always kept, uploaded URLs are capped to the 6 most recent (`.slice(0, 6)`), preventing unbounded growth of the `photo_history` array from repeat uploads while never dropping OAuth avatar history. It then fires an async, best-effort orphan-avatar GC (`gcAvatars`) that is NOT awaited by the caller (`.catch()`-only) — deliberately non-blocking cleanup.
  - `gcAvatars` reconciles the *referenced* set (photo_history ∪ current `photo_url`) against the physical files under `uploads/avatars/` (via `storage.list`) and deletes any file prefixed `${uid}_` that isn't referenced — a private, best-effort garbage collector for orphaned avatar blobs.
  - **Role/authorization logic**: `becomeTranslator` is a one-way ratchet — if current role is `'user'`, it flips to `'translator'`; any other existing role (translator/creator/admin) is left untouched (`currentRole === 'user' ? 'translator' : currentRole`), so a user can never "downgrade" role via this path. `updateTranslatorProfile` explicitly throws `ForbiddenException` if `currentRole === 'user'` — i.e. plain users cannot set bio/languages/country meant for translators; this is a genuine authorization check based on server-fetched role (not client-supplied), preventing a privilege-check bypass.
  - `getPublicTranslatorProfile` (used by the public controller) 404s (`NotFoundException('Translator not found')`) if role is not one of `translator`/`creator`/`admin` even though the profile row exists — hides non-translator profiles from the public translator-lookup endpoint while still allowing translator/creator/admin to be found, and strips private fields (no email, no plan) from the returned shape.
  - `bio` fields are consistently trimmed and truncated (`.trim().slice(0, 500)`), `translatorLanguages` capped at 10 entries — basic bounded-input hygiene against oversized payloads.

---

## Versions

**Note on module naming**: despite the directory name "versions," this module implements **manga chapter translation versions** (competing community-submitted translations of the same chapter — draft → pending_moderation → published/rejected workflow), NOT app binary/build version delivery. There is no force-update or app-build-version logic here.

### Backend/src/versions/versions.controller.ts
- **last_commit:** 148446ae6d0672702d37f35f498bb6f86ca06db2
- **lines_covered:** 1-133 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Public (no-auth) read routes: `GET /versions/chapter/:chapterId`, `GET /versions/title/:titleId`, `GET /versions/translator/:uid` — all delegate to service methods that filter to `status === 'published'` only.
  - `GET /versions/:versionId` uses `OptionalAuthGuard` (auth attempted but not required) and implements **ownership-gated visibility**: if the fetched version's `status !== 'published'`, an unauthenticated caller gets `NotFoundException` (hides existence of drafts from the public), and an authenticated caller who isn't the owning translator (`caller.uid !== version.translatorUid`) gets `ForbiddenException`. This is a deliberate anti-enumeration design — draft/pending/rejected versions are invisible to everyone except their author, and the 404-vs-403 split leaks no information to anonymous callers about whether a non-published version even exists.
  - Authenticated routes (`@UseGuards(AuthGuard)`): `GET /versions/me/versions` (list own, including drafts), `POST /versions` (create draft), `PATCH /versions/:versionId` (metadata), `PATCH /versions/:versionId/status` (status transition), `DELETE /versions/:versionId`. All identity comes from `req[USER_KEY].uid`, never from the request body — ownership enforcement happens service-side by comparing against `translatorUid`.

### Backend/src/versions/versions.module.ts
- **last_commit:** a78f1e623deaa16497f40fb36019e72e5d11e9c0
- **lines_covered:** boilerplate, skimmed only
- **read_date:** 2026-07-04
- **findings:**
  - Standard module registration: `VersionsController`, provides/exports `VersionsService`.

### Backend/src/versions/versions.service.ts
- **last_commit:** 24017acf96475a6a943b48da59d18e9849f8fb12
- **lines_covered:** 1-355 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Data model: Supabase table `chapter_versions`, one row per (title × chapter × translator × language) submission, with `status: 'draft'|'pending_moderation'|'published'|'rejected'`, `pages: string[]` (URLs), `price_coins`, `quality_score`, `is_default`, and translator identity fields — mapped to camelCase `ChapterVersion` via `mapRow`.
  - **Status state machine** is explicit and whitelisted in `updateStatus`: `allowedTransitions = { draft: ['pending_moderation', 'published'], rejected: ['draft'], published: ['draft'] }`; any other from→to pair throws `BadRequestException`. Additionally, transitioning to `pending_moderation` is blocked if `pages.length === 0` (can't submit an empty chapter for moderation). Note there's no `pending_moderation → published` transition listed, nor a `pending_moderation → rejected` one exposed via this method — suggesting moderation approval/rejection happens through a different (likely admin-only/out-of-scope) code path not present in this file.
  - Ownership check pattern repeats across every mutating method (`setPages`, `updateStatus`, `updateMetadata`, `deleteVersion`): fetch the version, compare `version.translatorUid !== translatorUid` (from the authenticated caller), throw `BadRequestException('You do not own this chapter version')` otherwise — note this uses `BadRequestException` (400) rather than `ForbiddenException` (403) for an ownership violation, arguably a minor REST-semantics inconsistency worth flagging in a thesis critique (the controller layer elsewhere uses 403 for the read-path ownership check, but the service layer here uses 400 for write-path ownership).
  - **Multi-machine dev environment awareness**: `isVersionAvailableOnBackend` checks whether all page files are actually present on *this* backend node, because in local dev, DB rows (shared) can exist on one machine while uploaded page files (local disk) exist only on the machine that received the upload. It short-circuits to `true` immediately when `storage.isRemote` (R2), since remote storage is globally available and the check would just cost an extra network round-trip per row for no benefit. For local disk, it does **one `readdir` per version** (via `storage.list`) rather than one `stat`-equivalent per page — the code comments explicitly reference issue **#149** and reason about the cost multiplying "since every list endpoint maps every row." This is presented to callers as `backendAvailable: boolean` on each returned `ChapterVersion`.
  - `createVersion` auto-generates `chapterId` via `crypto.randomUUID()` if the caller doesn't supply one; validates `titleId`, `language`, `translatorUid` as required.
  - `deleteVersion` deletes the entire uploaded-pages directory (`storage.deleteDir`) before deleting the DB row — storage cleanup happens first, so a crash mid-delete leaves an orphaned DB row (safer than the reverse, which would leave orphaned files with no DB reference... though it does mean a transient window where the DB row still exists but files are gone).
  - `listPublishedVersionsByTranslator` explicitly strips the `pages` array from each returned object (`const { pages: _pages, ...rest } = version`) — a deliberate response-shrinking optimization for a translator's public list view where per-page URLs aren't needed.
  - Price/metadata updates guard against negative `priceCoins` (`BadRequestException`) and floor to integer coins.

### Backend/src/versions/versions.types.ts
- **last_commit:** 644465899dda5ff676dfd3c7f2e25403072b5c1b
- **lines_covered:** 1-24 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Pure type-only file: `VersionStatus` union and the `ChapterVersion` shape (camelCase, mirrors `ChapterVersionRow` in the service file). `backendAvailable?: boolean` is documented inline as "True when this backend can serve the uploaded chapter pages from local storage."

---

## Storage

### Backend/src/common/storage/storage-provider.interface.ts
- **last_commit:** e9ec61ba1daced27ac17bdcea15b55a5b5f4ab0a
- **lines_covered:** 1-64 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Defines the `StorageProvider` interface — the core abstraction the whole storage subsystem is built on: `readonly isRemote: boolean`; `put(key, data: Buffer|string|Readable, options?: {contentType?})`; `get(key): Promise<Buffer>`; optional `getStream?(key): Promise<Readable>` (streaming path, avoids full in-memory buffering, only implemented where the backend supports it); `delete(key)`; `deleteDir(prefix)` (recursive); `exists(key)`; `list(prefix): Promise<string[]>`; optional `ensureDir?(path)` (disk-specific convenience, not meaningful for object storage).
  - `isRemote` is the interface's key "am I local disk vs distributed object store" discriminator, consumed by callers like `versions.service.ts`'s `isVersionAvailableOnBackend` to skip a meaningless local-presence check when storage is remote.
  - Exports `STORAGE_PROVIDER` as a plain string constant used as the NestJS DI token (`@Inject(STORAGE_PROVIDER)`) — classic interface-based DI so consumers depend only on the abstraction, never on `DiskStorageProvider`/`CloudflareR2StorageProvider` concretes directly.

### Backend/src/common/storage/disk-storage.provider.ts
- **last_commit:** 24017acf96475a6a943b48da59d18e9849f8fb12
- **lines_covered:** 1-90 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `isRemote = false`. Root directory is `process.cwd()`; `getAbsPath` joins relative keys under it (or passes through if already absolute) — **no path-traversal sanitization happens inside this provider itself** (e.g. no rejection of `..` segments); that guard is instead implemented one layer up, in `uploads.controller.ts`, meaning the provider alone is not safe against traversal if any other caller passes an unsanitized key.
  - `put()` special-cases a `Readable` source: pipes it into a `fs.createWriteStream`, and explicitly destroys the write stream and rejects if the source stream errors — comment notes this prevents leaking the file descriptor or leaving a partial file, since the "source is now always a temp-file ReadStream on the upload hot path." Buffer/string paths go through a plain `fsp.writeFile`.
  - `delete()` uses `fsp.rm(path, { force: true })` (no-op if missing, no throw) and `deleteDir()` uses `{ recursive: true, force: true }` — both idempotent by design.
  - `list()` and `exists()` swallow `ENOENT`-style errors into `[]`/`false` respectively via try/catch.
  - No `getStream` implementation — disk reads always go through the buffering `get()` (only R2 implements true streaming reads).

### Backend/src/common/storage/cloudflare-r2.provider.ts
- **last_commit:** e9ec61ba1daced27ac17bdcea15b55a5b5f4ab0a
- **lines_covered:** 1-98 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `isRemote = true`. This is **not** a direct AWS-S3-SDK/R2-SDK client — it's an HTTP client against a custom Cloudflare Worker (`workerUrl`), authenticated via a shared-secret header `x-worker-secret: <workerSecret>` on every request (`workerFetch`). Both `workerUrl`/`workerSecret` are constructor-injected (see `storage.module.ts` for where they come from).
  - Implements the full `StorageProvider` contract over a small custom protocol: `PUT /v1/object?key=`, `GET /v1/object?key=`, `DELETE /v1/object?key=`, `GET /v1/list?prefix=&recursive=` (used for `deleteDir`, fetching all keys under a prefix and deleting them in parallel via `Promise.all`), `GET /v1/exists?key=`.
  - `put()` avoids double-buffering: if `data instanceof Readable`, it's handed straight to `fetch`'s `body` and streamed to the worker (never drained into a Buffer first); the code explicitly sets `duplex: 'half'` when streaming, noting this is required by Node/undici for streamed request bodies but isn't yet reflected in the lib-dom `RequestInit` TypeScript type (hence the type-widening comment).
  - `getStream()` streams the worker's response body straight through via `Readable.fromWeb(res.body)` rather than buffering — this is the provider that actually implements the interface's optional `getStream`, letting `uploads.controller.ts` pipe large objects to the HTTP client without ever holding them fully in memory.
  - `delete()` treats HTTP 404 from the worker as success (not an error) — deleting an already-absent key is a no-op, matching disk provider's idempotent semantics.

### Backend/src/common/storage/storage.module.ts
- **last_commit:** e9083ec3ea5936ec9c1d5a2f64bf3a010cd1b7b1
- **lines_covered:** 1-71 (full)
- **read_date:** 2026-07-04
- **findings:**
  - This is where the abstraction is **wired at runtime**. `createStorageProvider(env, logger)` is a pure, exported function (deliberately env-injectable rather than reading `process.env` inline) so the selection logic is unit-testable in isolation without booting Nest.
  - Selection precedence, fully env-var driven:
    1. `STORAGE_DRIVER` (explicit override) wins if set: `'disk'|'local'` → `DiskStorageProvider`; `'r2'|'cloudflare'` → `CloudflareR2StorageProvider`; any other non-empty value throws `Error('Unknown STORAGE_DRIVER=...')`.
    2. If `STORAGE_DRIVER` is unset/empty: **auto-detect** — use R2 only if both `WORKER_URL` and `WORKER_SECRET` are present, else fall back to disk. Comment states this preserves prior deployments "byte-for-byte unchanged" (i.e. this explicit-override behavior was added later on top of a pre-existing auto-detect-only scheme — a backward-compatibility-conscious refactor).
    3. If `STORAGE_DRIVER=r2`/`cloudflare` is explicitly requested but the R2 creds are missing, it throws rather than silently falling back to disk — fail loud on explicit misconfiguration.
  - `@Global() @Module` — registers `UploadsController` and provides `STORAGE_PROVIDER` via `useFactory: () => createStorageProvider()` (using real `process.env` at runtime), exporting the token so any other module's DI container can `@Inject(STORAGE_PROVIDER)` without re-importing this module.

### Backend/src/common/storage/uploads.controller.ts
- **last_commit:** 7579eb2ab8180e0e33786c1401395a6c581d2d50
- **lines_covered:** 1-83 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Replaces Express's `express.static` for `/uploads/**` so both disk and R2 storage modes are served through the identical `/uploads/...` URL scheme regardless of backend — the abstraction is invisible to clients.
  - **Explicit path-traversal guard** (comment cites "FR-23"): builds the candidate key, resolves both `uploadsRoot = path.resolve(cwd, 'uploads')` and the candidate `resolved = path.resolve(cwd, key)` to absolute paths, and rejects (404) unless `resolved === uploadsRoot` or `resolved.startsWith(uploadsRoot + path.sep)`. The comment explicitly notes a naive string-prefix check on the raw (unresolved) input would be bypassable — this is the traversal defense that `DiskStorageProvider` itself lacks, confirming defense is centralized at this one call site rather than in the provider.
  - Content-type is derived from a small static extension map (`EXT_TO_MIME`) rather than trusting any client-supplied header, with `application/octet-stream` fallback for unknown extensions.
  - Prefers `storage.getStream()` when the active provider implements it (streams straight to the HTTP response instead of buffering); falls back to buffered `storage.get()` otherwise. All served objects get `cache-control: public, max-age=3600, stale-while-revalidate=86400`.
  - **Mid-stream error handling** is unusually careful and explicitly documented: since `getStream`'s upstream-status pre-check only guards the *initial* response, an R2/undici connection can still fail *after* `pipe()` begins (i.e. after headers/some bytes may already be sent) — an `'error'` listener is attached to destroy the response cleanly (`res.destroy()` if headers already sent, else a clean `res.status(500).end()`) specifically to avoid an unhandled stream error crashing the Node process. It also listens for `res.on('close')` to `stream.destroy()` the upstream connection if the client aborts early, preventing a leaked undici connection.

---

## Supabase

### Backend/src/supabase/supabase.module.ts
- **last_commit:** 91421149f51aa3a3612a434e5cd3432d000cbf45
- **lines_covered:** boilerplate, skimmed only
- **read_date:** 2026-07-04
- **findings:**
  - `@Global() @Module({ providers: [SupabaseService], exports: [SupabaseService] })` — makes `SupabaseService` available application-wide as a singleton without every consuming module needing to import `SupabaseModule` explicitly.

### Backend/src/supabase/supabase.service.ts
- **last_commit:** 6e885176ec2a5a469cce90eae635fe6602a37843
- **lines_covered:** 1-156 (full)
- **read_date:** 2026-07-04
- **findings:**
  - **Client construction**: `onModuleInit()` (not the constructor) creates the client via `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })`. It **hard-fails at boot** (`throw new Error(...)`) if either env var is missing/empty — no silent degraded mode. Uses the **service-role key**, not the anon/publishable key — meaning this backend-side client has admin-level DB access (bypasses Row Level Security), consistent with it later calling `auth.admin.updateUserById`. `autoRefreshToken`/`persistSession` are both disabled because this is a stateless server client (no browser session to persist/refresh).
  - **JWT verification via `getUser`**: `verifyAccessToken(accessToken)` calls Supabase's own `auth.getUser(token)` (confirmed in `fetchUser`) rather than manually verifying the JWT signature/claims with a library like `jsonwebtoken`/PyJWT — delegates trust entirely to Supabase's own validation. Any failure (network error, invalid/expired token, no user) is normalized to a single generic `Error('Invalid or expired token')` so callers never see provider-specific error details leak through.
  - **Two-tier caching to avoid an auth round-trip per request**: (1) a `tokenCache: Map<sha256(token), {user, expiresAt}>` — critically, **raw tokens are never stored or logged, only their SHA-256 hash** (explicit comment: "Raw tokens are NEVER stored; only their hash"), bounded to `VERIFY_CACHE_MAX = 5_000` entries with FIFO-ish eviction (`Map` preserves insertion order; oldest key deleted when full) and `VERIFY_CACHE_TTL_MS = 60_000` (60s) as a ceiling; (2) an `inFlight: Map<hash, Promise>` single-flight registry so N concurrent requests carrying the same not-yet-cached token coalesce into exactly one `getUser` call rather than firing N redundant network round-trips — classic thundering-herd mitigation.
  - Cache TTL is **the minimum of the 60s ceiling and the token's own remaining JWT lifetime** (`tokenExpMsRemaining`, which base64url-decodes the JWT payload segment to read the `exp` claim **without verifying the signature** — the comment is explicit that this is safe here because the token was *already* validated by the preceding `getUser()` call; the decode is only used to *bound the cache TTL*, not for authorization). Falls back to the 60s TTL if `exp` parsing fails.
  - Failed verifications are **never cached** — the promise inside the single-flight block only populates `tokenCache` "on success only," so a bad/expired token can't get spuriously cached as valid, and repeated bad-token requests all re-hit Supabase (arguably a minor DoS-amplification consideration worth a thesis footnote, though intentional given correctness priorities).
  - `fetchUser` maps Supabase's raw user object into the app's `SupabaseAuthUser` shape: `uid` (Supabase `user.id`), `email`, `name` (prefers `user_metadata.full_name`, falls back to `.name`), `picture` (prefers `avatar_url`, falls back to `.picture`), and `providers: string[]` derived from `user.identities[].provider` (this is exactly what `users.controller.ts`'s `markEmailVerified` gate checks for `'google'`/`'facebook'`).
  - `markEmailVerified(uid)` is an **admin-only operation**: `this.supabaseClient.auth.admin.updateUserById(uid, { email_confirm: true })` — only possible because the client was constructed with the service-role key; this is the concrete point where that elevated privilege is exercised.

---

## Status

*(Bonus — in scope per task framing "Backend/src/status/ (if exists)".)*

### Backend/src/status/election.service.ts
- **last_commit:** 07a5c77029f3debc5c668c4bf83df6cbe40ea46e
- **lines_covered:** 1-104 (full)
- **read_date:** 2026-07-04
- **findings:**
  - This **is** a leader-election mechanism for multi-instance coordination, implemented entirely on top of Redis (via the shared `RedisService`) — no Raft/Paxos library, no ZooKeeper/etcd; it's a lightweight lease/lock pattern.
  - Mechanism: a single Redis key `cache:leader` acts as the lock. Each node runs `runElection()` on a fixed timer (`ELECTION_INTERVAL_MS = 5_000`, every 5s). A non-leader node attempts `SET cache:leader <nodeId> NX PX <LEADER_TTL_MS>` — Redis's atomic "set-if-not-exists with expiry" — and becomes leader iff that returns `'OK'`. `nodeId` comes from `MetricsService.nodeId` (constructed as `node-${process.pid}-${randomUUID()}` — process-unique, so even two processes on the same host can't collide as the same "identity").
  - `LEADER_TTL_MS = ELECTION_INTERVAL_MS * 2.5 = 12_500ms` — the lease is set to survive exactly one missed renewal cycle (comment: "survives one missed renewal") before another node can legitimately take over; this is the tuning knob balancing failover speed against tolerance for a single slow/GC-paused tick.
  - **Renewal and release both use Lua scripts for atomic compare-and-X**, avoiding classic distributed-lock races:
    - `RENEW_SCRIPT`: `if GET(key) == myNodeId then SET(key, myNodeId, PX=ttl) else nil` — a leader only extends its own lease if it *still* owns the key (guards the classic "I paused past my TTL, someone else took over, then I blindly re-extend and steal it back" split-brain scenario).
    - `DELETE_SCRIPT`: `if GET(key) == myNodeId then DEL(key) else 0` — on graceful shutdown (`onModuleDestroy`), the node only deletes the lock if it still owns it; if a GC pause let the TTL lapse and another node already took over, this correctly refuses to delete the *new* leader's lock. The comment explicitly names this scenario.
  - `onBecomeLeader(cb)` is a simple pub/sub-free callback registry (`Array<() => void>`) — any consumer can register a callback that fires exactly on the state transition into leadership (not on every renewal), letting leader-only background jobs (e.g. scheduled cache maintenance elsewhere in the codebase) hook in without polling `isLeader` themselves. `isLeader` is also exposed as a plain getter for polling-style consumers.
  - Fails safe/quiet if Redis is unreachable: `runElection()` and `onModuleDestroy()` both early-return `if (!client)` (no client obtained), and the `onModuleInit` timer wraps calls in `.catch(err => logger.warn(...))` so a transient Redis blip never crashes the process or throws unhandled — the tradeoff is that during a Redis outage, no node can be leader (leader-dependent background jobs silently stop firing) rather than any node falsely assuming leadership.
  - Genuinely notable distributed-systems engineering for a thesis to highlight: a real (if small-scale) single-active-leader pattern gating leader-only responsibilities in a horizontally-scaled NestJS deployment, built from Redis primitives rather than a dedicated coordination service.

### Backend/src/status/metrics.service.ts
- **last_commit:** 30582ae10f68c67585e1397f5eac2789134441a8
- **lines_covered:** 1-95 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Companion to `ElectionService` — publishes each node's own health/load snapshot to Redis every `HEARTBEAT_INTERVAL_MS = 10_000` (10s) under key `cluster_metrics:${nodeId}` with a `METRICS_TTL_SEC = 30` self-expiring TTL (stale nodes simply age out of Redis rather than needing explicit deregistration on crash).
  - `gatherMetrics()` collects `cpu` (0-1 ratio, sampled by diffing `os.cpus()[].times` idle/total across a 500ms window — a manual, dependency-free CPU-load sampler), `freeMem` (`os.freemem()`), and `latency` (a `HEAD` request to `${SUPABASE_URL}/rest/v1/` with a 3s `AbortSignal.timeout`, used as a rough external-dependency health proxy; a failed/timed-out ping still counts elapsed wall-clock time as the latency value rather than erroring, so timeouts show up as high-latency rather than missing data).
  - `publishing` boolean re-entrancy guard prevents overlapping publishes if a previous heartbeat is still in flight when the next timer tick fires (debug-logs and skips rather than queuing).
  - `nodeId = node-${process.pid}-${randomUUID()}` is the same identity used by `ElectionService`'s Redis `SET NX` value — this file is effectively the identity/heartbeat provider the election mechanism depends on.

### Backend/src/status/status.controller.ts
- **last_commit:** a6980f00e4dc7308b446630f32925df1b1b53154
- **lines_covered:** 1-89 (full)
- **read_date:** 2026-07-04
- **findings:**
  - `GET /status` (public) is a synthetic health-check aggregator distinct from `ElectionService`/`MetricsService`: it only checks Redis (via `CacheHealthService.getHealth()`), classifying `up`/`degraded` (>200ms latency threshold)/`down` (exception thrown), and returns a versioned (`schemaVersion: 1`) JSON snapshot with `uptimeSec` (`process.uptime()`), `durationMs` of the check itself, and `checkedAt` ISO timestamp.
  - `GET /status/stream` is an SSE endpoint (`@Sse('stream')`) that maps `StatusService.getStatusStream()` (an RxJS `Observable<SystemStatusEvent>`) into the `{data: event}` shape Nest's SSE decorator expects.
  - `GET /status/cache` is gated by `@UseGuards(AuthGuard)` (unlike the other two routes) and returns the raw `CacheHealthService.getHealth()` payload — presumably richer/more sensitive cache diagnostics reserved for authenticated (likely staff) callers, versus the coarser public `/status` summary.

### Backend/src/status/status.module.ts
- **last_commit:** cba7283130cd3793fd9bb512713c9b307e6b204a
- **lines_covered:** boilerplate, skimmed only
- **read_date:** 2026-07-04
- **findings:**
  - Registers `StatusController`; provides and exports all three services (`StatusService`, `MetricsService`, `ElectionService`) so other modules can depend on the election/metrics machinery without re-declaring providers.

### Backend/src/status/status.service.ts
- **last_commit:** 94a10fb14d1800266acf143ad859d58756632d48
- **lines_covered:** 1-35 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Minimal RxJS `Subject`-based pub/sub: `broadcastStatus(service, status: 'online'|'offline'|'maintenance')` pushes a timestamped `SystemStatusEvent` onto an internal `Subject`, exposed read-only via `getStatusStream(): Observable`. This is the piece `StatusController`'s `/status/stream` SSE route subscribes to; nothing else in the surveyed files appears to call `broadcastStatus` (its producer/caller — e.g. `mangadex.service.ts`'s maintenance-page detector — lives elsewhere) — noted as boilerplate/thin but flagged since it's the SSE data source, not purely inert scaffolding.

---

## Auth Guards

### Backend/src/auth/auth.guard.ts
- **last_commit:** f994c47c905735146aad8042339b77290fab8274
- **lines_covered:** 1-34 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Exports two module-level string constants used as request-property keys: `UID_KEY = 'uid'`, `USER_KEY = 'supabaseUser'`.
  - `AuthGuard.canActivate` reads `req.headers['authorization']`; if it doesn't start with `'Bearer '` it throws `UnauthorizedException('Missing or invalid Authorization header')` — fails closed with no header at all.
  - Strips the first 7 chars (`'Bearer '`) to get the raw token, then calls `this.supabase.verifyAccessToken(idToken)` (injected `SupabaseService`) — the guard itself does **not** talk to Supabase directly, it delegates to the service.
  - On success: `req[USER_KEY] = decoded` (a `SupabaseAuthUser`) and `req[UID_KEY] = decoded.uid` are attached to the raw Express request object.
  - On any thrown error from `verifyAccessToken` (invalid signature, expired, Supabase API error, etc.) the guard catches it (discarding the original error/details) and always re-throws a generic `UnauthorizedException('Invalid or expired token')` — the caller never sees Supabase's raw error message (defense against info leakage).
  - No caching lives in the guard itself; caching is the actual mechanism, implemented in `SupabaseService.verifyAccessToken`, keyed by SHA-256 hash of the raw token.

### Backend/src/auth/auth.types.ts
- **last_commit:** 91421149f51aa3a3612a434e5cd3432d000cbf45
- **lines_covered:** 1-6 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Defines `SupabaseAuthUser` type: `{ uid: string; email: string | null; name: string | null; picture: string | null; providers: string[] }`.
  - `uid` maps 1:1 to Supabase's `data.user.id`; `email` from `data.user.email`; `name` from `user_metadata.full_name` or `.name`; `picture` from `user_metadata.avatar_url` or `.picture`; `providers` is the list of linked-identity provider names (e.g. `google`, `facebook`, `email`) derived from `data.user.identities`.

### Backend/src/auth/authenticated-request.ts
- **last_commit:** c7352625768b786275e364ff68bc3a5cc03eec85
- **lines_covered:** 1-14 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Two request interfaces extending Express's `Request`: `AuthenticatedRequest` (guaranteed `supabaseUser: SupabaseAuthUser` and `uid: string` — used behind `AuthGuard`) and `MaybeAuthenticatedRequest` (both optional — used behind `OptionalAuthGuard`).
  - Purely a typing convenience over the properties `AuthGuard`/`OptionalAuthGuard` mutate onto the raw request at runtime; there is no runtime validation tying the type to the guard.

### Backend/src/auth/optional-auth.guard.ts
- **last_commit:** 148446ae6d0672702d37f35f498bb6f86ca06db2
- **lines_covered:** 1-22 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Structurally near-identical to `AuthGuard` but always returns `true` — it never blocks the request.
  - If no `Bearer` header is present, it returns `true` immediately with no user attached at all (public/anonymous path).
  - If a `Bearer` header IS present, it attempts `this.supabase.verifyAccessToken(idToken)` the same way as `AuthGuard`; on success it attaches `USER_KEY`/`UID_KEY`; on failure it silently swallows the error (`/* ignore */`) and still returns `true` — an invalid/expired token on an optional-auth route degrades to "anonymous," it does not 401.
  - Net effect: "identify-if-possible, never reject" — used for endpoints that personalize behavior for logged-in users but must also serve logged-out visitors.

### Backend/src/auth/turnstile.config.ts
- **last_commit:** 9cf3b33e0ef45748762b10c91734d8427e99cad8
- **lines_covered:** 1-58 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Exports `TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA'` — Cloudflare's public, universally-known Turnstile test secret; the file's own doc comment flags that using it in prod is equivalent to "no secret at all."
  - `resolveTurnstileConfig(env, logger?)` is a pure function (env injectable for testability) returning `{ enabled: boolean; secret: string }`.
  - **Fail-closed in production** (`NODE_ENV === 'production'`): if `TURNSTILE_SECRET_KEY` is unset/blank OR equals the public test secret, it **throws at boot** — crashes the app rather than silently running an always-pass captcha. If `TURNSTILE_ENABLED=false` is set in prod, it's ignored (captcha stays enforced) and logged as an error via the optional `logger` param.
  - Outside production: the public test key and `TURNSTILE_ENABLED=false` bypass are both allowed, so local/dev environments aren't blocked.
  - Referenced in comments as tied to issue #224 — the fail-closed boot guarantee is what lets `TurnstileGuard` assume `secret` is always real in prod without re-checking.

### Backend/src/auth/turnstile.guard.ts
- **last_commit:** 9cf3b33e0ef45748762b10c91734d8427e99cad8
- **lines_covered:** 1-65 (full)
- **read_date:** 2026-07-04
- **findings:**
  - **Not a live Cloudflare `siteverify` call at request time.** The guard never calls Cloudflare's API per-request; it verifies a locally-issued **HMAC "clearance token"** minted earlier (via the exported `generateClearanceToken` helper, invoked from `books.controller.ts`'s `/books/verify-captcha`) once a captcha challenge was solved.
  - `generateClearanceToken(secret, hwid)`: builds `data = "${expiresAt}:${hwid}"` with `expiresAt` = now + 1 hour, signs `data` with HMAC-SHA256 using `secret`, returns `"${data}.${hmac}"`.
  - `verifyClearanceToken(token, secret, currentHwid)`: splits on `.` into `data`/`signature`, then splits `data` on `:` into `expiresAtStr`/`tokenHwid`. Checks in order: (1) expiry, (2) **hardware-ID binding** — `tokenHwid !== currentHwid` → reject (a clearance token minted for one device cannot be replayed from another), (3) HMAC signature recomputed and compared via `crypto.timingSafeEqual` (constant-time), wrapped in try/catch since mismatched buffer lengths throw.
  - `TurnstileGuard.canActivate`: reads `x-hardware-id` header, resolves config via `resolveTurnstileConfig(process.env)`. If `!enabled` → allow. Else: missing hwid → 401 `'Hardware ID is missing.'`; missing `x-captcha-clearance` header → 401 `'Captcha clearance token is missing.'`; otherwise verifies and either passes or throws 401 `'Captcha clearance token is invalid, expired, or bound to another device.'`.
  - The guard's request-time job is cheap local HMAC verification, not a Cloudflare round-trip — the expensive Cloudflare `siteverify` call happens once at token-issuance (in the `/books/verify-captcha` flow), decoupled from this guard.

### Backend/src/common/middleware/hardware-id.middleware.ts
- **last_commit:** 8e3d3cd8ca22959278e44fe9e5de46a68e310b46
- **lines_covered:** 1-45 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Comment header explicitly labels this "T4-STANDARD Pillar 5: Zero-Trust Asset Protection" and notes auth/forum/wallet/user endpoints are guarded by `AuthGuard` instead — this middleware is specifically for **unauthenticated but device-scoped** asset routes.
  - `HWID_REQUIRED`: an array of regexes, only these path shapes are enforced: `/^\/books\/chapters\/[^/]+\/pages/`, `/^\/books\/chapters\/[^/]+\/[^/]+-translate/`, `/^\/books\/translate\/mit-health/`, `/^\/versions\/[^/]+(\/|$)/`, `/^\/upload\//`. Any other path short-circuits with `next()` immediately — a no-op on all non-matching routes even though it's wired globally.
  - Validation is a **presence + format check only, not a signature/cryptographic check**: `isValidHardwareId(value)` requires `typeof value === 'string'` and matches `HWID_PATTERN = /^[A-Za-z0-9_+/=-]{8,128}$/` — base64/URL-safe charset, length 8-128. There is no HMAC, no server-issued token, no session binding — it purely rejects malformed/missing values. Code comment confirms: "X-Hardware-Id is a client-generated device fingerprint" generated by `Frontend/app/lib/fingerprint.ts` as `mdock_` + up to 32 base64 chars (~38 chars total); bound generously 8-128 to tolerate a future FingerprintJS swap.
  - On failure: logs a warning (logger name `'ZeroTrust'`) with method+path, then directly writes `res.status(401).json({ statusCode: 401, message: 'Missing or malformed hardware ID' })` and returns (does not call `next()`).
  - On success: attaches `(req as any).hardwareId = hwId`, logs a truncated debug line (first 8 chars + `...`), then calls `next()`.
  - "Zero-trust asset protection" here means these specific content-serving routes require *some* plausibly-real device fingerprint header, functioning as lightweight bot/scraper friction and per-device rate/usage attribution — not authentication and not a signed/verifiable credential (contrast with `TurnstileGuard`'s HMAC-bound clearance token, which *does* cryptographically bind to the hwid).

### Wiring / topology

**Middleware (global, path-filtered internally):**
- `Backend/src/app.module.ts:40` — `consumer.apply(HardwareIdMiddleware).exclude({ path: 'wallet/xendit/webhook', method: RequestMethod.POST }).forRoutes('*')`. Applied to **every route** in the app except the Xendit webhook, but the middleware body's `HWID_REQUIRED` regex list only actually enforces on the 5 path patterns above; all other routes pass through as a no-op.

**AuthGuard (`Backend/src/auth/auth.guard.ts`)** — required Bearer JWT, 401 on missing/invalid:
- `Backend/src/forum/forum.controller.ts`: `POST forum/profile/banner` (81), `PATCH forum/profile/banner-position` (107), `POST forum/posts` (130), `DELETE forum/posts/:id` (136), `DELETE forum/comments/:id` (143), `PATCH forum/posts/:id` (150), `PATCH forum/comments/:id` (156), `POST forum/comments` (168), `POST forum/vote` (174), `POST forum/upload-image` (180).
- `Backend/src/status/status.controller.ts`: guarded route at line 84 (`GET /status/cache`).
- `Backend/src/unlock/unlock.controller.ts`: all 3 routes (18, 28, 37).
- `Backend/src/upload/upload.controller.ts`: controller-level `@UseGuards(AuthGuard)` at line 31.
- `Backend/src/users/users.controller.ts`: controller-level `@UseGuards(AuthGuard)` at line 27.
- `Backend/src/versions/versions.controller.ts`: lines 71, 78, 104, 115, 126 (write routes); line 42 uses `OptionalAuthGuard` instead.
- `Backend/src/wallet/wallet.controller.ts`: lines 32, 41, 53 (`@UseGuards(AuthGuard, TopupThrottleGuard)` — stacked with a throttle guard), 62, 71, 112, 121, 140, 146 — essentially every wallet route.

**OptionalAuthGuard (`Backend/src/auth/optional-auth.guard.ts`)** — identify-if-present, never blocks:
- `forum.controller.ts`: `GET forum/posts` (61), `GET forum/profile/:uid` (113), `GET forum/posts/:id` (124), `GET forum/posts/:id/comments` (162).
- `versions.controller.ts`: line 42.

**TurnstileGuard (`Backend/src/auth/turnstile.guard.ts`)** — HWID + HMAC clearance token required:
- `Backend/src/books/books.controller.ts`: `GET books/chapters/:chapterId/pages` (146), `POST books/translate/manga` (175), `POST books/chapters/:chapterId/pages/:pageIndex/translate-patches` (203), `POST books/chapters/:chapterId/batch-translate-patches` (261). `GET books/translate/mit-health` and `GET books/models` explicitly left unguarded (comment: "same posture as mit-health").

**Composition note:** `HardwareIdMiddleware`'s enforced-path regex list overlaps directly with where `TurnstileGuard`/`AuthGuard` are also applied (e.g. `books/chapters/:id/pages` is gated by both HWID middleware *and* `TurnstileGuard`; `upload/*` is gated by both HWID middleware and `AuthGuard`) — a documented "defense in depth" layering: HWID middleware runs first (Express-level, before Nest's guard pipeline) as a cheap format-only filter, then the Nest guard does the real identity/clearance check.

**Underlying identity verification** (load-bearing for `AuthGuard`/`OptionalAuthGuard`): `Backend/src/supabase/supabase.service.ts` (`verifyAccessToken`) calls `supabaseClient.auth.getUser(token)` and layers a token-hash-keyed cache (SHA-256 of the raw token, never the raw token itself) with a max-60s TTL, a 5,000-entry cap with oldest-first eviction, and a single-flight `inFlight` map so concurrent requests bearing the same token coalesce into one Supabase round-trip. Failures are never cached.
