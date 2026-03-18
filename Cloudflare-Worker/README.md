# MangaDock Cloudflare Worker

Cloudflare Worker compute service for image flow:
Frontend -> Backend -> Worker -> R2 -> Worker -> Backend -> Frontend

## What This Worker Does
- Securely accepts requests from Backend only.
- Connects to R2 bucket through binding MANGA_IMAGES.
- Supports object existence check, get, put, and delete.
- Supports translate flow with cache strategy:
- check translated image in R2
- if missing, call MIT Server
- store processed output in R2
- return processed image
- Optimizes bandwidth with ETag + 304 Not Modified + Cache-Control + edge cache.

## Endpoints
- GET /health
- GET /v1/exists?key=<objectKey>
- GET /v1/object?key=<objectKey>
- PUT /v1/object?key=<objectKey> with binary body
- DELETE /v1/object?key=<objectKey>
- POST /v1/translate with JSON body:
  {
    "originalKey": "manga/1/chapter/2/page-1.jpg",
    "translatedKey": "manga/1/chapter/2/page-1.en.webp",
    "sourceLang": "ja",
    "targetLang": "en",
    "qualityProfile": "balanced"
  }

## Security
All routes except /health require header:
- x-worker-secret: value must match BACKEND_SHARED_SECRET

## Required Environment
Create .dev.vars from .dev.vars.example and set:
- BACKEND_SHARED_SECRET
- MIT_PROCESS_URL (from MIT service, for example http://localhost:5003/translate/with-form/image)
- MIT_API_KEY (optional)
- IMAGE_QUALITY_PROFILE (quality | balanced | bandwidth)

## R2 Binding
Worker expects this binding in wrangler.toml:
- binding: MANGA_IMAGES
- bucket_name: mangadock-images

Adjust bucket_name for your real Cloudflare R2 bucket.

## Local Development
1. Install dependencies:
- npm install
2. Run local worker:
- npm run dev

## Deploy
1. Authenticate Wrangler:
- npx wrangler login
2. Deploy worker:
- npm run deploy

## Backend Integration Notes
- Backend should send x-worker-secret on every Worker request.
- Backend can use /v1/object for original image storage/retrieval.
- Backend can use /v1/translate for translated image flow with MIT fallback.
- Response headers x-cache-hit and x-r2-key can be used for observability.

## Image Quality Profiles
- `quality`: uses MIT endpoint as configured in `MIT_PROCESS_URL` for best output fidelity.
- `balanced`: if `MIT_PROCESS_URL` ends with `/translate/with-form/image`, Worker will use `/translate/with-form/image/stream`.
- `bandwidth`: if `MIT_PROCESS_URL` ends with `/translate/with-form/image`, Worker will use `/translate/with-form/image/stream/web`.
- You can set default profile with `IMAGE_QUALITY_PROFILE` and override per request via `qualityProfile`.

## Bandwidth Optimization Behavior
- GET /v1/object now returns:
- etag
- cache-control
- x-edge-cache (HIT or MISS)
- If request includes If-None-Match with the same etag, Worker returns 304 without image body.
- Fingerprinted file names (hash-like names) are cached with long TTL and immutable.

## Quick Verification (PowerShell)
1. First request and capture headers:
- Invoke-WebRequest -Uri "http://127.0.0.1:8787/v1/object?key=3201fb86bdb21f47b22b47a2a41583da.webp" -Headers @{ "x-worker-secret" = "YOUR_SECRET" }
2. Repeat request with If-None-Match from previous etag:
- Invoke-WebRequest -Uri "http://127.0.0.1:8787/v1/object?key=3201fb86bdb21f47b22b47a2a41583da.webp" -Headers @{ "x-worker-secret" = "YOUR_SECRET"; "If-None-Match" = "<etag-from-first-response>" }
3. Expected second response:
- HTTP 304 Not Modified
- no image body transferred
