# ADR 011 — Three-tier translation-patch cache (L1 in-memory / L2 Redis source-of-truth / L3 disk) with render-config-hash key and selective namespace reset

- **Status:** Accepted (2026-06-14) — implemented. All three layers, the v7 render-config-hash key, and the selective `cache:reset` exist in the tree and are unit-tested.
- **Area:** Backend (`Backend/src/cache/*`, `Backend/src/books/books.service.ts`)
- **Related:** ADR 003 (Flux Klein inpainter) depends on the render-config-hash to bust patches when `MIT_INPAINTER` switches; the `cache:reset` script is documented in the root + Backend READMEs.

## Context

Translated manga pages are expensive to produce: every cache **miss** re-invokes the MIT ML
inference server (detection + OCR + LLM translation + inpaint + render), which costs GPU VRAM and
seconds-to-minutes of latency per page. The cached unit is the per-page **patch** — the text-region
overlays composited onto the original art. Three forces shape the design:

1. **Latency / VRAM.** A read must be served from the fastest layer that has the data; a write must
   never block the request on disk or a slow downstream. A wrong key or a missed invalidation
   silently replays a stale render and wastes a re-translate.
2. **Multi-instance consistency.** The backend can run as more than one node (there is a leader
   election and a Redis pub/sub bus), so a single in-process map cannot be the source of truth — a
   write on one node must be visible to, or at least not contradicted by, another.
3. **Render-knob correctness.** The patch image depends on MIT render/pipeline knobs (font,
   anti-overlap, sizes, SFX, inpainter, detection/inpaint resolution — all `MIT_*` envs). Before the
   key folded these in, toggling a knob replayed the previously-rendered patches because the key only
   distinguished chapter/page/langs/model — the stale-render gotcha.
4. **Debuggable reset.** When iterating on MIT render quality, the developer must wipe *only* the
   translated patches and force a clean re-translate — without clobbering the unrelated
   `forum:*` / `search:*` / `mangadex:*` caches that share the same Redis/disk/L1.

## Decision

Translation patches use a **write-behind, read-through three-layer cache**, with the cache key
versioned to `v7` and folding in a hash of every `MIT_*` env, and a reset path scoped to a single
namespace prefix across all three layers plus the on-disk PatchStore PNGs.

### Three layers

- **L1 — in-process LRU** (`json-cache.service.ts`). `LRUCache` capped at **10 000 entries / 50 MB**
  (`L1_MAX_ENTRIES`, `L1_MAX_SIZE_BYTES`), sized by `key.length + JSON.stringify(value.data).length`.
  Fastest read; in-process only. Hydrated from L3 on boot (`onModuleInit` → `l3.readAll()`).
- **L2 — Redis** — the **runtime source of truth** (`cache-orchestrator.service.ts`). `get()` tries
  L1 first, falls back to Redis, and **back-fills L1** with the TTL remaining
  (`ttlMs - (Date.now() - updatedAt)` for a finite TTL; a permanent entry with `ttlMs <= 0`
  is passed through unchanged). When `redis.available` is false, `get()` serves L1 only and
  `set()` records the key via `l3.appendDirtyFallback(key)` instead of marking it dirty in Redis.
- **L3 — disk** (`l3-disk.service.ts` + `l3-batch-writer.ts`). One compact `.json` file per key
  (key sanitised with `key.replace(/[:\\/*?"<>|]/g, '_')`). The `L3BatchWriter` flushes L1→L3 (reading
  current values from L2 via one `MGET`) on a **per-prefix interval**: `FLUSH_CONFIG` =
  `wallet: 2 000 ms`, `stats: 5 000 ms`, everything-else `60 000 ms` (the `''` bucket is "all keys not
  matched above"). Two efficiency guards: **`updatedAt` change-detection** — `lastWritten.get(key) ===
  entry.updatedAt` skips an unchanged disk write (#147); and the `lastWritten` high-water-mark **map is
  pruned** for keys evicted from L1 so it doesn't grow forever under chapter churn.

### Write path and durability

`set()` writes **L1 + L2 synchronously**, publishes `cache:invalidate {key, nodeId}` so peer nodes
drop their now-stale L1 copy (a node ignores its own `nodeId`), and calls `batchSync.markDirty(key)`.
A separate `BatchSyncWorker` (leader-only, 5 s timer) drains the dirty queue and persists each entry
to L3 **and** to Supabase via the `upsert_cache_entry` RPC, with retry/dead-letter. Crash recovery is
**atomic**: on becoming leader the worker runs `RECOVER_SCRIPT` — a Lua script that `LRANGE`s the
processing queue, `DEL`s it, and `RPUSH`es every orphan back to the dirty queue in one round-trip,
closing the DEL→RPUSH window where a crash would silently drop keys.

Manga patches specifically use `setMangaCacheWithTiers()`: **permanent in L1** (`ttlMs = -1`,
never expires) and **bounded in L2** (1-day Redis TTL by default), with **no** `markDirty` — the
patch is already the source of truth on disk via the normal flush, so it keeps Redis lean.

### Render-config-hash key (v7)

`BooksService.patchCacheKey()` builds the single canonical key:

```
translate:manga-patches:v7:{chapterId}:{pageIndex}:{srcMIT}:{tgtMIT}:{model}:{derivative}:{renderConfigHash()}
```

`renderConfigHash()` reads `process.env`, keeps keys starting with `MIT_`, **sorts** them, joins
`KEY=value` lines, and returns `createHash('sha1').update(knobs).digest('hex').slice(0, 10)` — a
**10-char SHA1 slice over the sorted `MIT_*` envs**. Because the hash is part of the key, changing any
render knob (font, anti-overlap, SFX, **`MIT_INPAINTER`**, detection/inpaint size, precision, …) yields
a different key, so the next translate is a miss and re-renders instead of replaying stale patches.
The `v7` prefix is the version segment; `v4`/`v5`/`v6` history is recorded in the method's doc comment
(model segment, display derivative, series context respectively).

### Selective namespace reset

`translation-cache-reset.ts` defines `TRANSLATED_PATCH_PREFIX = 'translate:manga-patches:'` and
`isTranslatedPatchCacheKey()` (a `startsWith` test). `resetTranslationCache(ports)` sweeps **only** keys
under that prefix across **all three layers** — filtered Redis `DEL`, per-key L3 file delete — and then
removes the **PatchStore PNG** directories (`uploads/patches/<chapterId>`). Adjacent namespaces
(`forum:*`, `search:*`, `mangadex:*`, and even the sibling `translate:glossary:*`) are deliberately
**not** swept. The selection is pure and unit-tested with in-memory fakes
(`translation-cache-reset.spec.ts`): one test asserts only the patch key is matched, another asserts
unrelated Redis/L3 entries are left fully intact, and the chapter sweep is best-effort (one failing
chapter is skipped, the sweep continues).

## Alternatives considered

| Option | Verdict |
|---|---|
| **L3 (disk) as the runtime source of truth** | Rejected — Redis is faster for the hot read path; disk is the *durable* backstop, and on a Redis outage `get()`/`set()` fall back to **L1 + an L3 dirty-fallback file**, so disk-as-truth would penalise every normal read for a failure mode that is already handled. |
| **Global cache flush on reset** (`FLUSHDB` / clear-all) | Rejected — it clobbers `forum:*` / `search:*` / `mangadex:*` and the `translate:glossary:*` sibling, which are unrelated and costly to rebuild. The namespace-scoped sweep is the surgical equivalent and is unit-tested to prove it touches nothing else. |
| **Key on `imageModel` only (pre-v7)** | Rejected — the pre-v7 key distinguished model/langs/derivative/context but **not** render knobs, so toggling any `MIT_*` env replayed stale patches (the stale-render gotcha). Folding `renderConfigHash()` into the key is the fix. |
| **Write every L1 entry to disk on every flush** | Rejected — the `wallet`/`stats`/other timers fire every 2 s / 5 s / 60 s forever; rewriting unchanged entries is redundant I/O. The `updatedAt` change-detection (#147) writes a file only when the value actually changed. |

## Consequences

- **Positive.** Reads are served from the fastest layer that has the data and L1 is back-filled from
  Redis on a hit; writes never block the request on disk (write-behind via `BatchSyncWorker` + the
  per-prefix `L3BatchWriter`); multi-node L1 stays coherent via `cache:invalidate` pub/sub; crash
  recovery is atomic (`RECOVER_SCRIPT`); a render-knob change is automatically visible on the next
  translate; and the developer can wipe *only* the translated patches without harming forum/search.
- **Load-bearing / coupling.** This is one subsystem with a tight triad: **`renderConfigHash()`**,
  **`patchCacheKey()` (the `v7` prefix)**, and the **reset prefix `translate:manga-patches:`** must move
  together — bumping the key version or changing the prefix in one place without the others either
  orphans live patches or makes the reset miss them. ADR 003's inpainter swap relies on this hash to
  bust patches, so the two ADRs are coupled.
- **Negative / limits.** L3 disk grows **unbounded** — `L3DiskService` writes one file per key and has
  no file-eviction/TTL-prune (the only pruning is the in-memory `lastWritten` high-water-mark map, not
  the disk files); a long-lived deployment accumulates patch JSON until something external trims
  `.cache/`. Manga patches are `ttlMs = -1` (permanent in L1), so they only leave L1 via LRU
  size/count eviction, never by expiry. The `BatchSyncWorker` flush and crash recovery are
  **leader-only**, so Supabase/L3 persistence depends on a healthy election. The spec fixture key
  (`translation-cache-reset.spec.ts`) is illustrative and still reads `v6`; only the prefix is
  load-bearing for the selection, so the version drift in the fixture is cosmetic, but a reader should
  not mistake it for the live key version (`v7`).
- **Follow-ups.** Add an L3 disk-size cap / TTL prune if patch accumulation becomes a problem; align
  the spec fixture's version segment with the live `v7` to avoid confusion; consider a single shared
  constant for the cache-key version so `patchCacheKey()` and any future readers cannot drift.
