# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout: Single-context

This is a single-context repo. One `CONTEXT.md` at the root covers all sub-projects (Frontend, Backend, MIT).

```
/
├── CONTEXT.md          ← domain glossary for the whole codebase
├── docs/adr/           ← architectural decision records
└── src/
```

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — authoritative domain glossary (L1/L2/L3 Cache, Dirty Key, Dirty Queue, Leader, Write-behind, Flush Frequency, etc.)
- **`docs/adr/`** — read ADRs that touch the area you're about to work in before proposing alternatives

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

Key avoid-list (from CONTEXT.md):
- Say **L1 Cache** not "local cache", "memory cache", or "JSON cache"
- Say **L2 Cache** not "Redis cache", "distributed cache", or "remote cache"
- Say **L3 Cache** not "JSON cache", "disk cache", "file cache", or "L1 disk"
- Say **Dirty Key** not "stale key", "unsynced key", or "pending key"
- Say **Dirty Queue** not "sync queue", "work queue", or "flush queue"
- Say **Leader** not "master", "primary", or "coordinator"
- Say **Write-behind** not "write-through", "async write", or "lazy persist"
- Say **Flush Frequency** not "batch interval", "sync rate", or "TTL"

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (L3 written by periodic batch only) — but worth reopening because…_
