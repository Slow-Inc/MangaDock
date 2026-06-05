# MIT ↔ Backend — Wire Contract

> The exact request/response/webhook shapes exchanged between the NestJS **Backend** and the **MIT** web
> server. This boundary has already broken twice (payload-too-large; a `result`-wrapper mismatch). Treat this
> file as the source of truth for the contract — when you change a shape on one side, update the other side
> **and** this file in the same change.
>
> Authoritative code: MIT `server/main.py` (producer) · Backend `src/books/books.service.ts` +
> `src/books/mit-webhook.controller.ts` (consumer).

---

## 0. ⚠️ Casing footgun — read this first

Field names are **not consistent** across the two patch surfaces:

| Surface | image dims keys | example |
|---------|-----------------|---------|
| **Single-page** response (`/translate/with-form/patches`) | **snake_case** | `img_width`, `img_height` |
| **Batch** webhook / NDJSON payload | **camelCase** | `imgWidth`, `imgHeight` |

Patch-item keys (`x`, `y`, `w`, `h`, `img_b64`) are the same on both. A consumer that assumes one casing on the
other surface gets `undefined`/`0`. Do not "fix" one side casually — fix both sides + this doc together.

---

## 1. The `config` object (Backend → MIT)

Sent as a `config` **form field** containing a JSON string, on every patch request. Shape the Backend builds:

```json
{
  "translator": {
    "target_lang": "THA",
    "source_lang": "JPN",          // omitted when source is ANY
    "source_lang_only": true,      // omitted when source is ANY
    "model": "gemini-2.5-pro"      // optional per-request Gemini model (#87);
                                    // omitted → MIT's GEMINI_MODEL env default
  },
  "inpainter": { "inpainter": "lama_large" },
  "render":    { "direction": "auto", "rtl": false }
}
```

A per-request `model` bypasses Gemini context caching for that request (a cached template is bound to
the model it was created with). The Backend partitions its patch cache and batch jobKey by model, so
different model selections never share results.

MIT parses this into its Pydantic `Config` (`manga_translator/config.py`). Unknown keys are ignored.

---

## 2. Single-page translation

**Request** — `POST /translate/with-form/patches` (multipart/form-data)

| field | type | notes |
|-------|------|-------|
| `image` | file | the page image |
| `config` | string | JSON, see §1 |

**Response** — `200 OK`, JSON (**snake_case**):

```json
{
  "img_width": 1280,
  "img_height": 1808,
  "patches": [
    { "x": 120, "y": 64, "w": 300, "h": 90, "img_b64": "<base64 PNG>" }
  ]
}
```

Coordinates are **pixels** relative to the source image. The Backend converts them to normalized fractions
(`xPct = x / img_width`, etc.) before sending to the Frontend.

---

## 3. Batch translation

**Request** — `POST /translate/with-form/patches/batch` (multipart/form-data)

| field | type | notes |
|-------|------|-------|
| `images` | file[] | the pages |
| `config` | string | JSON, see §1 |
| `page_indices` | string | CSV of page indexes aligned to `images`, e.g. `0,1,2` |
| `taskId` | string | the **Job Key** `chapterId:srcMIT:tgtMIT` |
| `callback_url` | string | Backend webhook endpoint; **if present → webhook mode** |
| `callback_secret` | string | HMAC secret (optional) |

MIT chooses a mode by whether `callback_url` is set:

### 3a. Webhook mode (production)

- MIT immediately returns **`202 Accepted`**: `{ "status": "accepted", "taskId": "<taskId>" }`
- Then, **per page**, MIT POSTs to `callback_url`:

```json
{
  "taskId": "ch:ANY:THA",
  "pageIndex": 0,
  "imgWidth": 1280,
  "imgHeight": 1808,
  "patches": [ { "x": 120, "y": 64, "w": 300, "h": 90, "img_b64": "<base64 PNG>" } ],
  "error": null
}
```

- On a per-page failure: same envelope with `patches: []` and `error: "<message>"` (a string).
- **Header** `x-mit-signature` = HMAC-SHA256 hex of the **raw JSON body**, present only when
  `callback_secret` was provided.
- Delivery is **retried** on transient failure (5xx / 429 / connection error) with backoff; non-retryable 4xx
  and exhausted retries are dead-lettered (logged). See `server/webhook.py` + Issue #100.

**Cancellation** — `POST /cancel/{taskId}` tells MIT to stop a running batch. The Backend calls it when its
last SSE listener for the job leaves. Best-effort and idempotent: a no-op for an unknown/finished taskId. MIT
stops before its next page and drops a page that finished after the cancel arrived. Because taskIds are
deterministic (`chapterId:src:tgt`), a **new batch submission clears any stale cancel flag** for its taskId —
a cancel that arrived after the previous run finished cannot poison the next run (#128).

### 3b. NDJSON streaming mode (no `callback_url`)

`200 OK`, `application/x-ndjson` — one JSON object per line, **same flat camelCase shape** as the webhook
payload (minus `taskId`), terminated by a sentinel:

```
{"pageIndex":0,"imgWidth":1280,"imgHeight":1808,"patches":[...],"error":null}
{"pageIndex":1,"imgWidth":1280,"imgHeight":1808,"patches":[...],"error":null}
{"done":true}
```

---

## 4. Invariants & limits

- **Idempotency:** the Backend de-duplicates webhooks by `pageIndex`. Re-sending a webhook (e.g. after a lost
  response) is safe — it will not double-apply. MIT relies on this when retrying.
- **No reconciliation:** a permanently-undelivered page stays missing until the **whole batch** is
  re-triggered. There is no single-page re-request path.
- **Body size:** webhook bodies carry base64 PNGs and can be **1–3 MB+**. The Backend must accept large bodies
  (currently `json({ limit: '50mb' })`). A `413` from the Backend is treated by MIT as non-retryable.
- **Per-patch bound:** the Backend rejects any single `img_b64` over **5 MB** (Issue #95 S3).
- **`error` is a string or `null`** — never an object.

---

## 5. Known contract hazards (open)

- **Casing split (§0):** snake_case (single) vs camelCase (batch) — the most likely source of a silent
  `undefined`/`0` on the consumer side.

Resolved hazards: HMAC is now verified over the **raw request bytes** captured by the Backend's
`json()` verify hook (#95 S1) — re-serializing the parsed body was not byte-stable
(key-order transforms; Python `json.dumps` `1.0` vs `JSON.stringify` `1`).
