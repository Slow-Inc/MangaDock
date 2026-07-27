import { type NextRequest, NextResponse } from "next/server";

// Server-to-server: prefer the internal URL (localhost) to avoid routing through
// Cloudflare Tunnel twice when deployed behind a public domain.
const API_BASE = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

/**
 * GET /api/img-proxy?url=<encoded>
 *
 * Forwards to the backend image proxy so that browser requests always use
 * the same origin as the Next.js frontend — works correctly regardless of
 * the hostname the user is accessing from (localhost, LAN IP, tunnel, etc.)
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !/^https:\/\//.test(url)) {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  try {
    const t = req.nextUrl.searchParams.get('t');
    const cid = req.nextUrl.searchParams.get('cid');
    const extra = [t && `t=${t}`, cid && `cid=${cid}`].filter(Boolean).join('&');
    const upstream = await fetch(
      `${API_BASE}/books/img-proxy?url=${encodeURIComponent(url)}${extra ? `&${extra}` : ''}`,
      // MangaDex at-home CDN URLs contain a rotating token — do not cache
      // at the Next.js layer; the backend caches the raw bytes via img-proxy.
      { cache: 'no-store' },
    );

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";

    // Stream pass-through (#150): buffering via arrayBuffer() delayed the
    // first byte until the LAST byte arrived from the backend and held the
    // whole image (~2-3MB) in memory per concurrent request. Streaming lets
    // the browser paint progressively from the first chunk.
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        // MangaDex filenames are content-addressed (hash in URL) — safe to cache 1 year
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Bad Gateway", { status: 502 });
  }
}
