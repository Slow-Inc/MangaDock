interface R2StoredObject {
  body: ReadableStream;
  httpEtag: string;
  httpMetadata?: {
    contentType?: string;
  };
  writeHttpMetadata: (headers: Headers) => void;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

interface R2PutResult {
  httpEtag?: string;
  version?: string;
}

interface R2BucketLike {
  head: (key: string) => Promise<unknown | null>;
  get: (key: string) => Promise<R2StoredObject | null>;
  put: (
    key: string,
    value: ReadableStream | ArrayBuffer,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
      customMetadata?: Record<string, string>;
    },
  ) => Promise<R2PutResult>;
  delete: (key: string) => Promise<void>;
}

interface Env {
  MANGA_IMAGES: R2BucketLike;
  BACKEND_SHARED_SECRET: string;
  MIT_PROCESS_URL?: string;
  MIT_API_KEY?: string;
  IMAGE_QUALITY_PROFILE?: string;
}

type ImageQualityProfile = "quality" | "balanced" | "bandwidth";

type TranslateRequest = {
  originalKey: string;
  translatedKey: string;
  sourceLang?: string;
  targetLang?: string;
  qualityProfile?: ImageQualityProfile;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function unauthorized(): Response {
  return json({ ok: false, error: "unauthorized" }, 401);
}

function badRequest(message: string): Response {
  return json({ ok: false, error: message }, 400);
}

function notFound(message: string): Response {
  return json({ ok: false, error: message }, 404);
}

function getRequiredKey(url: URL): string | null {
  const key = url.searchParams.get("key");
  if (!key || !key.trim()) return null;
  return key;
}

function getCacheControlForKey(key: string): string {
  const fileName = key.split("/").pop() ?? key;
  const fingerprinted = /^[a-f0-9]{24,}\.[a-z0-9]+$/i.test(fileName);
  if (fingerprinted) {
    // Hash-like filenames can be cached aggressively.
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=3600, stale-while-revalidate=86400";
}

function normalizeQualityProfile(value: string | null | undefined): ImageQualityProfile {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "quality" || normalized === "balanced" || normalized === "bandwidth") {
    return normalized;
  }
  return "balanced";
}

function resolveMitProcessUrl(baseUrl: string, profile: ImageQualityProfile): string {
  const normalizedBase = baseUrl.trim();
  if (profile === "quality") return normalizedBase;

  if (normalizedBase.endsWith("/translate/with-form/image")) {
    if (profile === "bandwidth") {
      return normalizedBase.replace(/\/translate\/with-form\/image$/, "/translate/with-form/image/stream/web");
    }
    return normalizedBase.replace(/\/translate\/with-form\/image$/, "/translate/with-form/image/stream");
  }

  return normalizedBase;
}

function parseIfNoneMatch(headerValue: string | null): string[] {
  if (!headerValue) return [];
  return headerValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("W/") ? tag.slice(2) : tag))
    .map((tag) => tag.replace(/^"|"$/g, ""));
}

function normalizeEtag(etag: string | null): string | null {
  if (!etag) return null;
  const trimmed = etag.trim();
  const withoutWeak = trimmed.startsWith("W/") ? trimmed.slice(2) : trimmed;
  return withoutWeak.replace(/^"|"$/g, "");
}

function isNotModified(request: Request, etag: string | null): boolean {
  const normalizedEtag = normalizeEtag(etag);
  if (!normalizedEtag) return false;
  const candidates = parseIfNoneMatch(request.headers.get("if-none-match"));
  if (candidates.includes("*")) return true;
  return candidates.includes(normalizedEtag);
}

function notModifiedResponse(baseHeaders: Headers, key: string): Response {
  const headers = new Headers();
  const etag = baseHeaders.get("etag");
  const cacheControl = baseHeaders.get("cache-control") ?? getCacheControlForKey(key);
  if (etag) headers.set("etag", etag);
  headers.set("cache-control", cacheControl);
  headers.set("x-r2-key", key);
  return new Response(null, { status: 304, headers });
}

function getEdgeCache(): Cache {
  return (globalThis as unknown as { caches: { default: Cache } }).caches.default;
}

function isAuthorized(request: Request, env: Env): boolean {
  const secret = request.headers.get("x-worker-secret");
  return Boolean(secret) && secret === env.BACKEND_SHARED_SECRET;
}

async function streamObject(object: R2StoredObject, key: string): Promise<Response> {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", headers.get("cache-control") ?? getCacheControlForKey(key));
  headers.set("x-r2-key", key);
  return new Response(object.body, { status: 200, headers });
}

async function handleExists(requestUrl: URL, env: Env): Promise<Response> {
  const key = getRequiredKey(requestUrl);
  if (!key) return badRequest("query parameter 'key' is required");

  const head = await env.MANGA_IMAGES.head(key);
  return json({ ok: true, key, exists: Boolean(head) });
}

async function handleGetObject(request: Request, requestUrl: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  const key = getRequiredKey(requestUrl);
  if (!key) return badRequest("query parameter 'key' is required");

  const edgeCache = getEdgeCache();
  const cacheKey = new Request(requestUrl.toString(), { method: "GET" });

  const cached = await edgeCache.match(cacheKey);
  if (cached) {
    if (isNotModified(request, cached.headers.get("etag"))) {
      return notModifiedResponse(cached.headers, key);
    }
    const cachedResponse = new Response(cached.body, cached);
    cachedResponse.headers.set("x-edge-cache", "HIT");
    return cachedResponse;
  }

  const object = await env.MANGA_IMAGES.get(key);
  if (!object) return notFound("object not found");

  const response = await streamObject(object, key);
  response.headers.set("x-edge-cache", "MISS");

  if (isNotModified(request, response.headers.get("etag"))) {
    return notModifiedResponse(response.headers, key);
  }

  ctx.waitUntil(edgeCache.put(cacheKey, response.clone()));
  return response;
}

async function handlePutObject(request: Request, requestUrl: URL, env: Env): Promise<Response> {
  const key = getRequiredKey(requestUrl);
  if (!key) return badRequest("query parameter 'key' is required");

  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const body = request.body;
  if (!body) return badRequest("request body is required");

  const result = await env.MANGA_IMAGES.put(key, body, {
    httpMetadata: {
      contentType,
      cacheControl: getCacheControlForKey(key),
    },
  });

  return json({
    ok: true,
    key,
    etag: result.httpEtag,
    version: result.version,
  });
}

async function handleDeleteObject(requestUrl: URL, env: Env): Promise<Response> {
  const key = getRequiredKey(requestUrl);
  if (!key) return badRequest("query parameter 'key' is required");

  await env.MANGA_IMAGES.delete(key);
  return json({ ok: true, key });
}

async function fetchProcessedImage(
  originalObject: R2StoredObject,
  payload: TranslateRequest,
  qualityProfile: ImageQualityProfile,
  env: Env,
): Promise<Response> {
  if (!env.MIT_PROCESS_URL) {
    return json({ ok: false, error: "MIT_PROCESS_URL is not configured" }, 503);
  }

  const inputBytes = await originalObject.arrayBuffer();
  const inputType = originalObject.httpMetadata?.contentType || "image/png";
  const mitUrl = resolveMitProcessUrl(env.MIT_PROCESS_URL, qualityProfile);
  const mitHeaders = new Headers();
  if (env.MIT_API_KEY) mitHeaders.set("authorization", `Bearer ${env.MIT_API_KEY}`);

  const form = new FormData();
  form.append("image", new Blob([inputBytes], { type: inputType }), "source-image.png");
  form.append(
    "config",
    JSON.stringify({
      translator: {
        source_lang: payload.sourceLang || "auto",
        target_lang: payload.targetLang || "ENG",
      },
    }),
  );

  const mitResponse = await fetch(mitUrl, {
    method: "POST",
    headers: mitHeaders,
    body: form,
  });

  if (!mitResponse.ok) {
    return json(
      {
        ok: false,
        error: "MIT processing failed",
        status: mitResponse.status,
      },
      502,
    );
  }

  const outputBytes = await mitResponse.arrayBuffer();
  const outType = mitResponse.headers.get("content-type") || "image/webp";

  await env.MANGA_IMAGES.put(payload.translatedKey, outputBytes, {
    httpMetadata: {
      contentType: outType,
      cacheControl: getCacheControlForKey(payload.translatedKey),
    },
    customMetadata: {
      generatedBy: "mit-server",
      originalKey: payload.originalKey,
      qualityProfile,
    },
  });

  const headers = new Headers();
  headers.set("content-type", outType);
  headers.set("cache-control", getCacheControlForKey(payload.translatedKey));
  headers.set("x-cache-hit", "false");
  headers.set("x-quality-profile", qualityProfile);
  headers.set("x-r2-key", payload.translatedKey);
  return new Response(outputBytes, { status: 200, headers });
}

async function handleTranslate(request: Request, env: Env): Promise<Response> {
  let payload: TranslateRequest;
  try {
    payload = (await request.json()) as TranslateRequest;
  } catch {
    return badRequest("invalid JSON body");
  }

  if (!payload?.originalKey || !payload?.translatedKey) {
    return badRequest("originalKey and translatedKey are required");
  }

  const qualityProfile = normalizeQualityProfile(payload.qualityProfile ?? env.IMAGE_QUALITY_PROFILE);

  const cachedTranslated = await env.MANGA_IMAGES.get(payload.translatedKey);
  if (cachedTranslated) {
    const response = await streamObject(cachedTranslated, payload.translatedKey);
    response.headers.set("x-cache-hit", "true");
    response.headers.set("x-quality-profile", qualityProfile);
    return response;
  }

  const originalObject = await env.MANGA_IMAGES.get(payload.originalKey);
  if (!originalObject) {
    return notFound("original image not found in R2");
  }

  return fetchProcessedImage(originalObject, payload, qualityProfile, env);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "mangadock-worker" });
    }

    if (!isAuthorized(request, env)) {
      return unauthorized();
    }

    if (url.pathname === "/v1/exists" && request.method === "GET") {
      return handleExists(url, env);
    }

    if (url.pathname === "/v1/object" && request.method === "GET") {
      return handleGetObject(request, url, env, ctx);
    }

    if (url.pathname === "/v1/object" && request.method === "PUT") {
      return handlePutObject(request, url, env);
    }

    if (url.pathname === "/v1/object" && request.method === "DELETE") {
      return handleDeleteObject(url, env);
    }

    if (url.pathname === "/v1/translate" && request.method === "POST") {
      return handleTranslate(request, env);
    }

    return json({ ok: false, error: "route not found" }, 404);
  },
};
