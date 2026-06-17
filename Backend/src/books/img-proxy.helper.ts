export const MAX_PROXY_BYTES = 15 * 1024 * 1024;
export const PROXY_TIMEOUT_MS = 10_000;

const UPSTREAM_HEADERS = {
  // MangaDex's uploads CDN returns 400 + an HTML error page for the bot-shaped
  // UA "Mozilla/5.0 (compatible; …)". A plain product UA (matching the
  // image-cache downloader and the #293 MangaDex API client) is not blocked.
  'User-Agent': 'MangaDock/1.0 (+https://hayateotsu.space)',
  Accept: 'image/webp,image/avif,image/*,*/*',
  Referer: 'https://mangadex.org/',
};

export type ImgProxyOk = {
  ok: true;
  httpStatus: number;
  contentType: string;
  contentLength: number | null;
  body: ReadableStream<Uint8Array>;
};

export type ImgProxyErr = {
  ok: false;
  httpStatus: number;
  message: string;
};

export type ImgProxyResult = ImgProxyOk | ImgProxyErr;

export async function fetchProxiedImage(
  url: string,
  maxBytes = MAX_PROXY_BYTES,
  timeoutMs = PROXY_TIMEOUT_MS,
  fetchFn: typeof fetch = fetch,
): Promise<ImgProxyResult> {
  if (!url || !/^https:\/\//.test(url)) {
    return { ok: false, httpStatus: 400, message: 'Invalid URL' };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const upstream = await fetchFn(url, {
      signal: ac.signal,
      headers: UPSTREAM_HEADERS,
    });
    clearTimeout(timer);

    // Reject upstream failures rather than forwarding them as a "successful"
    // image. MangaDex answers blocked/hotlinked requests with 400 + an HTML
    // page; passing that through made next/image render
    // "The requested resource isn't a valid image" and defeated the client's
    // onError fallback (it saw a 200). A non-2xx here surfaces as a clean error.
    if (upstream.status < 200 || upstream.status >= 300) {
      return { ok: false, httpStatus: 502, message: 'Upstream error' };
    }

    // Defence in depth: even a 200 must actually carry image bytes. A missing
    // content-type is tolerated (some CDNs omit it) and defaulted to image/jpeg.
    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return {
        ok: false,
        httpStatus: 502,
        message: 'Upstream returned non-image content',
      };
    }

    const cl = upstream.headers.get('content-length');
    const contentLength = cl !== null ? Number(cl) : null;

    if (contentLength !== null && contentLength > maxBytes) {
      return { ok: false, httpStatus: 413, message: 'Image too large' };
    }

    if (!upstream.body) {
      return { ok: false, httpStatus: 502, message: 'Bad Gateway' };
    }

    return {
      ok: true,
      httpStatus: upstream.status,
      contentType,
      contentLength,
      body: upstream.body as ReadableStream<Uint8Array>,
    };
  } catch (e) {
    clearTimeout(timer);
    const isTimeout =
      e instanceof Error &&
      (e.name === 'AbortError' || e.name === 'TimeoutError');
    return {
      ok: false,
      httpStatus: isTimeout ? 504 : 502,
      message: isTimeout ? 'Gateway Timeout' : 'Bad Gateway',
    };
  }
}
