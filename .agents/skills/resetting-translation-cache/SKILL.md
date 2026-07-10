---
name: resetting-translation-cache
description: Use when resetting translation caches, clearing L1 L2 L3 caches, or debugging manga page translation caching issues in MangaDock.
---

# Resetting Translation Cache

## Overview
MangaDock uses a three-tier write-behind cache (L1 in-memory, L2 Redis, L3 JSON disk). When modifying rendering configurations or verifying code changes, stale caches can result in outdated translations being served. This skill guides the systematic clearing of all cache layers to ensure clean testing.

## When to Use
* Debugging manga page translation issues.
* Verification of E2E translation changes (original vs translated layouts).
* Resetting caches prior to running integration/E2E test suites.
* Stale rendering configs or cache bleed between different users.

## Cache Clear Protocol (Ordered Sequence)

To prevent L1 in-memory cache from flushing dirty keys back to L2/L3 on backend shutdown or active heartbeat, follow this exact sequence:

1. **Stop the Backend Process**: Terminate the NestJS backend completely.
2. **Run Cache Reset Command**: Clear L2 Redis and L3 JSON disk layers.
3. **Restart the Backend**: Relaunch NestJS to initialize a fresh in-memory L1 cache.

| Layer | Type | Reset Action |
|---|---|---|
| **L1 (In-Process)** | Memory | Kill & restart the NestJS backend process |
| **L2 (Redis)** | Cache | `npm run cache:reset` (removes `translate:manga-patches:*`) |
| **L3 (Local Disk)** | JSON Disk | Handled automatically by `npm run cache:reset` |

## Quick Reference Commands

Run these commands in the `Backend/` directory:

```bash
# Dry run: view what cache items would be deleted without executing
npm run cache:reset -- --dry-run

# Execute real reset: wipe Redis keys and L3 JSON disk caches
npm run cache:reset
```

## Common Mistakes
* **Running reset while backend is active**: The active L1 memory cache will re-flush stale entries back into L2 and L3. Always kill the backend process first.
* **Not reloading the browser**: Web pages may cache translated overlays in client-side memory or local storage. Always force reload (Ctrl+F5) the browser after resetting.
