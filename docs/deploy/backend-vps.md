# Backend deploy — VPS via Docker

The NestJS backend is a **persistent containerized server**, not a serverless
function. It needs a long-running process, a Redis connection, local disk for
uploads/patches, and outbound calls to the MIT GPU server. It therefore runs on
the **VPS tier** (per ADR 021), *not* on Vercel. Only the Next.js frontend lives
on Vercel — it proxies `/api/proxy/*` to this backend.

```
Browser ──HTTPS──> Vercel (Next.js frontend)
                        │  INTERNAL_API_URL = https://api.<domain>
                        ▼
                 VPS: backend (4001) + redis        ──HTTP──> MIT (GPU cloud, :5003)
                         └ volumes: uploads, .cache
```

## What ships in the image

`Backend/Dockerfile` is a 3-stage build (verified to build + boot, ~336 MB):

1. **build** (`oven/bun`) — `bun install --frozen-lockfile` (uses `bun.lock`,
   the maintained lockfile; `package-lock.json` is stale and `npm ci` fails on it)
   then `bun run build` → `dist/`.
2. **deps** (`oven/bun`) — production-only `node_modules`.
3. **runner** (`node:22-alpine`) — `dist/` + prod deps, `CMD node dist/src/main`.

`Backend/.dockerignore` keeps host `node_modules`, the real `.env`, `.git`, logs
and `uploads/` out of the build context.

## Prerequisites on the VPS

- Docker + Docker Compose v2
- The repo checked out (or just `docker-compose.yml` + `Backend/`)
- A public hostname for the backend (a subdomain like `api.<domain>`), exposed
  via **Cloudflare Tunnel** (recommended — no inbound ports, free TLS) or an
  nginx/Caddy reverse proxy with a cert.

## 1. Configure env

```bash
cp Backend/.env.example Backend/.env
```

Edit `Backend/.env` for production — the deltas from the example that matter:

| Var | Production value |
|-----|------------------|
| `PORT` | `4001` (compose publishes this) |
| `REDIS_HOST` | leave as-is — **compose overrides it to `redis`** |
| `FRONTEND_ORIGIN` | the Vercel URL, e.g. `https://mangadockfrontend.vercel.app` (CORS) |
| `BACKEND_PUBLIC_ORIGIN` | the backend public URL, e.g. `https://api.<domain>` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | real project creds |
| `GEMINI_API_KEY` | real key (or the 9arm/Qwen gateway you use) |
| `MANGA_TRANSLATOR_URL` | the MIT GPU host, e.g. `https://mit.<domain>` |
| `MIT_CALLBACK_ORIGIN` | **leave unset in prod** when MIT is on a separate host (falls back to `BACKEND_PUBLIC_ORIGIN`) |
| `MIT_WEBHOOK_SECRET` | shared HMAC secret, must match MIT |
| `STORAGE_DRIVER` | `disk` (local volume) or `r2` (set `WORKER_URL` + `WORKER_SECRET`) |
| `TURNSTILE_SECRET_KEY` | real Cloudflare Turnstile secret |

`Backend/.env` is gitignored and is **never** baked into the image — compose
mounts it at runtime via `env_file`.

## 2. Bring it up

From the repo root (where `docker-compose.yml` is):

```bash
docker compose up -d --build        # builds backend, starts redis + backend
docker compose ps                   # both healthy/running
docker compose logs -f backend      # watch the Nest bootstrap
```

`backend` waits for `redis` to be healthy (`depends_on: condition`). Uploads and
the image cache persist in the named volumes `backend_uploads` / `backend_cache`.

## 3. Verify

```bash
curl -s http://localhost:4001/status/cache        # backend up
curl -s http://localhost:4001/books/landing | head # data path works
```

Then expose `:4001` publicly (Cloudflare Tunnel → `api.<domain>` → `localhost:4001`)
and confirm `https://api.<domain>/books/landing` answers.

## 4. Point the Vercel frontend at it

The frontend proxy resolves the backend as
`INTERNAL_API_URL ?? NEXT_PUBLIC_API_BASE_URL ?? http://localhost:3001`
(`Frontend/app/api/proxy/[...path]/route.ts`).

In **Vercel → mangadock_frontend → Settings → Environment Variables** add (Production):

```
INTERNAL_API_URL = https://api.<domain>
```

Redeploy the frontend. Browser calls stay relative (`/api/proxy/...`) and Vercel
proxies them server-side to the VPS backend. Make sure `FRONTEND_ORIGIN` in the
backend `.env` matches the Vercel origin or CORS will reject.

## 5. MIT (GPU) wiring

MIT is the only GPU piece — it runs on the GPU-cloud tier, not the VPS. The
backend reaches it via `MANGA_TRANSLATOR_URL`; MIT calls back via the webhook to
`BACKEND_PUBLIC_ORIGIN` (HMAC-signed with `MIT_WEBHOOK_SECRET`). For an alpha
without a GPU host, catalog/forum/auth work fine — only live translation is dark.

## Update / rollback

```bash
git pull                            # or copy new build artifacts
docker compose up -d --build        # rebuild + recreate changed services
docker compose down                 # stop (volumes survive)
docker image prune -f               # reclaim old layers
```

## Notes / gotchas

- **Framework note for the frontend** (separate issue): the Vercel project had
  `framework: null` → 404 on every route. Fix is Framework Preset = Next.js (or
  `Frontend/vercel.json` `{ "framework": "nextjs" }`).
- `start:prod` and the Docker `CMD` both point at `dist/src/main` — `nest build`
  nests output under `dist/src/` because the repo also compiles `scripts/`.
- Do not run two backends against one Redis with different `translate:` configs;
  use `npm run cache:reset` between pipeline changes (see CLAUDE.md).
