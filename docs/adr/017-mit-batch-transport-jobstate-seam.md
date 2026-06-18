# ADR 017 — MIT batch path split: transport/stream (`MitBatchStream`) vs job-state (`MitBatchOrchestrator`)

- **Status:** Accepted (2026-06-18) — implemented. `Backend/src/books/mit-batch-stream.ts`
  (transport + NDJSON read loop), `mit-batch-ndjson.ts` (pure decoder),
  `mit-batch-orchestrator.service.ts` (job-state machine), `mit-batch-types.ts` (shared types).
- **Context:** #294 (tech-debt) · parent #292 · applies the decomposition method of
  [[008-mit-god-object-characterization-byte-identical-seams]] to the backend batch path; the
  transport speaks to MIT across [[012-mit-integration-security-boundary]] (HMAC webhook + taskId).
- **Scope:** the full-chapter batch-translate path only (`startOrAttachBatchJob` → MIT submit →
  NDJSON stream / webhook callbacks). The single-page translate path and `handleMitCallback`'s
  wire contract are untouched.

## Context

`mit-batch-orchestrator.service.ts` was **1010 LOC** — the largest backend file — and the
live-translation hot path. One class mixed four concerns:

1. **Job-state lifecycle** — `startOrAttachBatchJob`, `finalize`, `maybeComplete`.
2. **Listener fan-out** — `deliver`, `removeBatchListener`, `notifyBatchProgress`.
3. **Transport + NDJSON stream** — `_runMitBatch` (image fetch → multipart POST → NDJSON read loop →
   per-page persist → retry-missing), a deeply nested state machine that was the riskiest, hardest
   to read, and **had zero direct test coverage**.
4. **Webhook callback** — `handleMitCallback`.

Any change risked the whole batch pipeline, and the stream-read loop could only be exercised by
constructing the whole service. A silent failure there (e.g. an all-error stream from a dead MIT
worker reading as "fully completed", the 2026-06-06 incident) is hard to catch without isolation.

## Decision

Cut along the seam between **transport/stream-decode** and the **job-state machine**, following the
characterization-first, byte-identical, one-seam-per-commit playbook of ADR 008.

- **`parseNdjsonChunk(chunk, carry) → { events, carry }`** (`mit-batch-ndjson.ts`) — a pure,
  Nest-free decoder turning a decoded text chunk (+ prior partial line) into ordered typed events
  (`page | error | done | malformed`). Unit-tested with hand-crafted strings.
- **`MitBatchStream`** (`mit-batch-stream.ts`) — owns the HTTP submit + the NDJSON read loop
  (`run`) and the per-page retry fallback (`_retryMissingPagesIndividually`), constructed with the
  `(MitClient, MitBatchDeps)` the orchestrator already holds. The `mitCallbackOrigin` and the
  `buildMitConfig`/`patchCacheKey`/`imageModelKey` call sites move with it.
- **`MitBatchOrchestrator`** stays the job-state machine (lifecycle + fan-out + `handleMitCallback`)
  and delegates transport via `this.stream.run(...)`. Dependency stays one-way:
  `BooksService → MitBatchOrchestrator → MitBatchStream`.

Three sub-decisions were confirmed with the developer before implementing:

1. **Persistence stays inside the stream loop as an injected dep**, not yielded back as raw events.
   The loop is lifted wholesale and calls `deps.persistPage` in place; the stream reports each page
   through the `notify` callback the orchestrator passes in (where job state is mutated). This keeps
   the loop byte-identical and the diff smallest, at the cost of the stream module knowing
   persistence exists.
2. **Stop at the stream + decoder split** (orchestrator 1010 → 557 LOC). The listener/job-registry
   split is deferred to a follow-up if the orchestrator is still unwieldy.
3. **Callback (`notify`) interface, not an async generator** — avoids restructuring the abort /
   `break outer` / count-based termination logic.

## Alternatives considered

- **Stream yields raw page events; the orchestrator persists.** Purer transport, but it moves the
  persist call out of the most dangerous ~150 lines and restructures the loop — rejected for a
  byte-identical pass; can be revisited once the seam is proven.
- **Also carve listener fan-out + job registry into their own unit now.** More single-responsibility,
  but more blast radius in one PR on the hot path — deferred, not rejected.
- **Async-generator event interface (`for await … of`).** Cleaner consumer, but it reshapes abort
  handling and the count-based `break outer`; the callback keeps behaviour identical.
- **Keep the `buildMitConfig`/`imageModelKey` delegators on the orchestrator.** They become unused by
  production once transport moves; keeping them solely so tests can reach them is test-driven dead
  code — rejected. The config tests were repointed to the pure `buildMitConfig(process.env, …)` in
  `mit-config.ts` (their correct home).

## Consequences

- **Positive:** the NDJSON chunk-boundary state machine is unit-testable with plain strings, no Nest
  runtime; `MitBatchStream` is testable in isolation; the orchestrator shrinks to a focused
  job-state machine (1010 → 557 LOC). A 12-case characterization net (added first, against the
  pre-split code) proves the extraction byte-identical and stays green through every commit.
- **Negative / limits:** the stream module is coupled to persistence by design (sub-decision 1); one
  cosmetic delta — transport logs now carry the `MitBatchStream` logger context (the `[BatchPatches]`
  message strings are unchanged). Tests that reached private methods (`_runMitBatch`,
  `_retryMissingPagesIndividually`, `buildMitConfig`) were repointed to the new locations.
- **Preserved landmines (verbatim):** the deliberate `deliver` catches ("caller may be gone"), the
  shared "NDJSON parse failed" log for both a malformed line and a persist throw, the dead-worker
  guard in `maybeComplete`, the no-signal-on-submitBatch note (MIT forrtl crash), and
  persist-fail-as-error in `handleMitCallback`.
- **Follow-up:** split the listener/job registry if the orchestrator stays large; and `readWithTimeout`
  in the stream loop never `clearTimeout`s its race-loser timer (a pre-existing dangling-timer left
  verbatim here) — worth fixing behind a behaviour-change flag, out of scope for this byte-identical pass.
