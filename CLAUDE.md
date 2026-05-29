# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Memory (Team Shared)

Memory files live at `.claude/memory/` in this repo — committed so all team members and agents start with full context.

**At the start of every session, read all files in `.claude/memory/` before doing anything else.**

`MEMORY.md` is the index. Each linked file is a memory record (user, feedback, project, or reference type).

If you write new memories during a session, update both `.claude/memory/` (for the team) and your local `~/.claude/projects/.../memory/` (for your own continuity).

---

## Dual-AI Workflow (Project-Specific)

You are the **Deep Reasoning Agent** in a Gemini + Claude system.

| File | Created by | Read by |
|------|-----------|---------|
| `PLAN.md` | Gemini G-1 | You (reference only) |
| `CLAUDE_BRIEF.md` | Gemini G-4 | You (primary input) |
| `PR_REVIEW_GEMINI.md` | Gemini G-2 | You (C-3 security only) |
| `DONE.md` | You | Gemini (next pass) |

**Hard rules:**
- Always read `CLAUDE_BRIEF.md` before touching any code
- Never modify files outside the scope listed in the brief
- If `CLAUDE_BRIEF.md` does not exist → stop and tell the user to run Gemini G-4 first
- After every task, update `DONE.md` (files modified, what changed, what was intentionally left alone, anything for Gemini to re-review)

---

## Repository Structure

```
MangaDock/
├── Frontend/     # Next.js 16 + React 19 (port 4000)
├── Backend/      # NestJS 11 (port 3001 / 4001)
└── MIT/          # Python ML inference server (image translation)
```

---

## Commands

### Frontend (`Frontend/`)
```bash
bun dev          # Start dev server on port 4000 (0.0.0.0)
bun build        # Production build
bun lint         # ESLint
```

### Backend (`Backend/`)
```bash
npm run start:dev     # Watch mode dev server
npm run build         # Compile
npm run lint          # ESLint + Prettier fix
npm test              # Jest unit tests
npm run test:cov      # Coverage report
npm run test:e2e      # End-to-end tests

# Run a single test file
npx jest src/forum/forum.service.spec.ts --no-coverage
```

---

## Architecture

### Request Flow
All browser API calls are relative (`/api/proxy/...`) and go through a Next.js catch-all route handler at `Frontend/app/api/proxy/[...path]/route.ts`, which server-side proxies to the NestJS backend. This keeps auth tokens off the network edge and works from any host/IP.

Static assets (`/uploads/*`, `/img-cache/*`) are rewritten to the backend via `next.config.ts`.

### Auth
- **Provider**: Supabase Auth (Google OAuth, Facebook OAuth, email/password)
- **Frontend**: `AuthContext.tsx` exposes `AppUser` (mapped from Supabase user) and `showLoginPrompt()`. Always use `showLoginPrompt()` for unauthenticated UI flows — never `alert()`.
- **Backend**: `AuthGuard` validates Bearer JWT from Supabase. `TurnstileGuard` gates auth endpoints. `HardwareIdMiddleware` requires `X-Hardware-Id` header on chapter/upload routes (zero-trust asset protection).

### Frontend Caching (`Frontend/app/lib/apiCache.ts`)
In-memory LRU (500 entries) with stale-while-revalidate pattern. Forum data uses `TTL.SHORT` (60s), search `TTL.MEDIUM` (5 min), quasi-static `TTL.LONG` (30 min). Invalidate by key or tag. `clearAllApiCache()` is called on auth state change to prevent cross-user bleed.

### Real-Time (SSE)
`ForumEventsService` (backend) publishes events to RxJS Subjects + Redis pub/sub channels (`forum:events`, `forum:feed`). Frontend consumes via `useForumStream` / `useFeedStream` hooks which connect to `/api/proxy/forum/posts/:id/stream`. SSE uses exponential backoff retry.

### Smooth Scroll
`SmoothScrolling.tsx` wraps the entire app with a global Lenis `root` instance. It calls `lenis.scrollTo(0, { immediate: true })` on every `pathname` change to prevent scroll position carry-over in Next.js shared layouts. The community sidebar has its own local `ReactLenis` instance (not `root`).

### Community Forum Layout
`app/community/layout.tsx` is a persistent shared layout (survives page navigation). Navigation state (category filter, active manga) lives in URL query params, not component state — the sidebar reads `useSearchParams()` and `usePathname()` to stay in sync across pages. Mobile uses a drawer triggered by a custom `toggleMobileMenu` window event.

### Backend Modules (`Backend/src/`)
| Module | Responsibility |
|--------|---------------|
| `books` | Manga catalog, chapter pages, Google Books integration |
| `forum` | Posts, comments, votes, SSE streaming, trending, profiles |
| `upload` | Image uploads — MIME validated with `file-type` (magic bytes, not extension) |
| `wallet` | Coin balance and transactions |
| `unlock` | Chapter unlock (requires HWID + wallet debit, atomic) |
| `users` | Profile management |
| `versions` | App version delivery |
| `cache` | Redis service wrapper (`RedisService`) |
| `supabase` | Global `SupabaseService` singleton |
| `common/storage` | `StorageProvider` interface (local disk or S3-compatible) |

### Key Patterns & Gotchas

**Spoiler blur**: Use inline `style={{ filter: 'blur(4px)', transition: 'filter 0.5s ease' }}` — never Tailwind `blur-sm`/`blur-0`. Tailwind blur uses `--tw-blur` CSS custom properties which browsers don't transition reliably.

**Image XSS**: Before using a user-supplied URL in `<img src>` or `<a href>`, check:
```ts
const safe = /^\s*(javascript|data|vbscript|file):/i.test(url.trim()) ? '#' : url.trim();
```

**`<img>` vs `<Image>`**: Use Next.js `<Image>` for all images with known dimensions and domain allow-listed in `next.config.ts`. Use `<img>` only for dynamically-sized images where layout is handled by the container.

**Modal animation**: Use double `requestAnimationFrame` for enter (ensures DOM is painted before adding visible class), `setTimeout` for exit (waits for CSS transition before unmounting).

**DTOs with floats**: Use `@IsNumber({ maxDecimalPlaces: 2 })` + `@Type(() => Number)` instead of `@IsInt()` when drag/calculation inputs can produce floating-point values.

**Forum post images**: Stored as `image_urls TEXT[]` in Supabase `forum_posts` table. Apply schema changes via Supabase MCP `apply_migration` — the `supabase-migration.sql` file is reference-only.
