# Ubiquitous Language

Canonical term glossary for MangaDock. When a term appears in **bold**, use it exactly as written — in code identifiers, PR descriptions, issue titles, and team conversations.

---

## Manga Content

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Chapter** | A single installment of a manga title, identified by `chapterId` | Episode (use only in UI copy for Thai audiences), Volume |
| **Page** | A single image within a **Chapter**, addressed by zero-based `pageIndex` | Frame, panel (a panel is a sub-region of a page) |
| **Source Language** | The language of the original manga text (e.g. `JPN`, `ENG`) | Original language, input language |
| **Target Language** | The language the user wants the manga translated into (e.g. `THA`) | Output language, translation language |

---

## Image Translation

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **MIT** | The Python ML inference server (Manga Image Translator) that detects, OCRs, and redraws text in manga pages | Translator, ML server, Python server |
| **Patch** | A cropped PNG image of a translated text region, positioned over the original **Page** using percentage coordinates | Overlay, translated region, bubble |
| **Patch Set** | The collection of all **Patches** for a single **Page** translation result | Page result, translated page |
| **Single-Page Translation** | Translating one **Page** at a time; driven by `translateCurrentPage()` on the frontend | Per-page translation |
| **Batch Translation** | Translating all **Pages** of a **Chapter** in a single MIT job; driven by `startTranslate()` | Episode translation, bulk translation, full translation |
| **Translation Mode** | The frontend toggle (on/off) that controls whether **Patches** are rendered over the original **Pages** | Show translation, overlay mode |

---

## Batch Job Lifecycle

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Batch Job** | A running **Batch Translation** request tracked server-side via `BatchJobState`, keyed by **Job Key** | Translation job, async job |
| **Job Key** | A composite string `chapterId:srcMIT:tgtMIT` that uniquely identifies a **Batch Job** across its lifetime | Task ID (taskId is the same value; prefer Job Key in discussion) |
| **Primary Listener** | The SSE connection held by the caller who created the **Batch Job**; receives **Patch Sets** directly without going through Redis | Original listener, first caller |
| **Latecomer Listener** | Any SSE connection that joins an already-running **Batch Job**; receives cached results immediately plus future results via fan-out | Secondary listener, late joiner |
| **Completed Pages** | The set of **Pages** for which a **Patch Set** has been saved and cached within a **Batch Job** | Done pages, finished pages |

---

## Webhook Delivery

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **MIT Webhook** | The HTTP `POST /webhooks/mit/callback` call that MIT sends to the Backend after each **Page** translation completes | Callback, notification, MIT callback |
| **MIT Callback Origin** | The base URL the Backend advertises to MIT as the destination for **MIT Webhooks** (`MIT_CALLBACK_ORIGIN` env var) | Callback URL, backend origin (backend origin is the public URL; callback origin may differ) |
| **HMAC Signature** | A `sha256` hex digest in `x-mit-signature` header, computed by MIT over the webhook body using the shared `MIT_WEBHOOK_SECRET` | Token, auth header |

---

## Streaming

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **SSE** | Server-Sent Events — the unidirectional HTTP stream from Backend to Frontend that delivers **Patch Sets** as they complete | WebSocket (SSE is one-directional), long-poll |
| **SSE Listener** | A `BatchPageListener` callback registered by an active SSE connection to receive **Patch Sets** | Subscriber, handler |

---

## Infrastructure

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Backend** | The NestJS 11 server on port 4001; owns business logic, job registry, and webhook endpoint | API server, Node server |
| **Frontend** | The Next.js 16 application on port 4000; owns all user interaction and rendering | Client, React app |
| **Backend Public Origin** | The publicly reachable base URL of the Backend (`BACKEND_PUBLIC_ORIGIN`), used for image/patch URLs served to browsers | Backend URL (ambiguous — may mean internal or public) |
| **Cloudflare Tunnel** | The service that exposes the local dev Backend/Frontend at `*.hayateotsu.space` over the public internet | ngrok, reverse proxy |

---

## Relationships

- A **Chapter** contains one or more **Pages**.
- A **Batch Job** is identified by exactly one **Job Key** and processes all **Pages** of one **Chapter** in one **Source Language** → one **Target Language** pair.
- A **Batch Job** has exactly one **Primary Listener** (set at creation) and zero or more **Latecomer Listeners**.
- Each **Page** produces one **Patch Set** (even on failure — the set may be empty with an `error` flag).
- A **Patch Set** is delivered to the **Primary Listener** directly and to all **Latecomer Listeners** via fan-out.
- The Backend sends **MIT Webhooks** to the **MIT Callback Origin**, which must be reachable from MIT at runtime.

---

## Example dialogue

> **Dev:** "When a user triggers a **Batch Translation**, what does the Backend do first?"

> **Domain expert:** "It registers a **Batch Job** under the **Job Key**, stores the **Primary Listener**, and submits all page URLs to MIT with the **MIT Callback Origin** as the webhook destination."

> **Dev:** "So each time MIT finishes a **Page**, it posts a **MIT Webhook** back?"

> **Domain expert:** "Exactly. The Backend receives the webhook, saves the **Patch Set** to cache, and notifies the **Primary Listener** directly — no Redis hop. Any **Latecomer Listeners** get the same **Patch Set** via fan-out."

> **Dev:** "What if the user navigated away and reconnects mid-job?"

> **Domain expert:** "They open a new SSE connection and become a **Latecomer Listener**. The Backend immediately replays all **Completed Pages** from that session's **Batch Job**, then queues them for live fan-out as remaining **Pages** arrive."

> **Dev:** "And **Translation Mode** — when does that turn on?"

> **Domain expert:** "At the moment `startTranslate()` is called, before any **Patch Set** arrives. This ensures patches render as soon as the first one lands, even if the user had the toggle off before clicking 'translate all'."

---

## Flagged ambiguities

- **"Episode" vs "Chapter"**: The function `translateMangaEpisode` and the UI copy "แปลทั้งตอน" use "episode"; route params and database keys use `chapterId`. Canonical term is **Chapter** in all code and technical discussion. "Episode" is acceptable in Thai UI copy only.

- **"taskId" vs "Job Key"**: MIT receives `taskId` in the form payload (which equals the **Job Key**). Internally the Backend always uses `jobKey`. Both refer to the same value — prefer **Job Key** in discussion to avoid confusion with MIT's internal task IDs.

- **"MIT Callback Origin" vs "Backend Public Origin"**: `BACKEND_PUBLIC_ORIGIN` is the public-facing URL used for browser-accessible image/patch URLs. `MIT_CALLBACK_ORIGIN` is the URL MIT uses for **MIT Webhooks** — these can differ (e.g. `localhost:4001` when MIT is co-located). Never conflate them.

- **"Listener" vs "Subscriber"**: Redis pub/sub uses the subscriber pattern internally, but domain discussions should use **SSE Listener** for all SSE connection callbacks. "Subscriber" is an implementation detail of the Redis fan-out path.
