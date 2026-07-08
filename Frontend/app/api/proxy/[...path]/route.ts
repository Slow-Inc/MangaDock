import { type NextRequest, NextResponse } from "next/server";
import { errMessage } from "@/lib/errMessage";
import { proxyRequestsTotal, proxyRequestDuration } from "@/lib/metrics";

// Server-to-server: prefer the internal URL (localhost) to avoid routing through
// Cloudflare Tunnel twice when deployed behind a public domain.
const BACKEND = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

/**
 * Catch-all proxy: forwards every /api/proxy/<path>?<qs> to the NestJS backend.
 * This keeps all browser requests as relative URLs so they work from any host/IP.
 */
async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const targetPath = path.join("/");

  // Forward original query string
  const qs = req.nextUrl.search; // includes leading "?" or ""
  const url = `${BACKEND}/${targetPath}${qs}`;

  // Forward headers (especially Authorization)
  const headers = new Headers();
  // Headers that must not be forwarded in a server-to-server proxy request:
  //   origin / referer — would trigger CORS checks on the backend for the
  //                      browser's public IP which is not in the allowed list;
  //                      safe to drop because this hop is already server-side.
  //   host / connection / transfer-encoding — standard hop-by-hop headers.
  const SKIP = new Set(["host", "connection", "transfer-encoding", "origin", "referer"]);
  for (const [key, value] of req.headers.entries()) {
    if (SKIP.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }

  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : req.body;

  const t0 = Date.now();
  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body,
      // Forward the client's abort to the backend. Without this, a browser
      // that aborts a streaming request (e.g. cancelling a batch translate)
      // leaves the upstream connection open, so the backend never fires its
      // `res.on('close')` handler and never propagates the cancel downstream
      // (the SSE job — and MIT's GPU work — keeps running). See #cancel-propagation.
      signal: req.signal,
      // @ts-expect-error Node 18+ fetch supports duplex
      duplex: body ? "half" : undefined,
    });

    proxyRequestsTotal.inc({
      service: "frontend",
      method: req.method,
      status_code: String(upstream.status),
    });
    proxyRequestDuration.observe({ service: "frontend", method: req.method }, Date.now() - t0);

    const resHeaders = new Headers();
    for (const [key, value] of upstream.headers.entries()) {
      if (["transfer-encoding", "connection"].includes(key.toLowerCase())) continue;
      resHeaders.set(key, value);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (err: unknown) {
    proxyRequestsTotal.inc({ service: "frontend", method: req.method, status_code: "502" });
    console.error(`[ProxyError] Failed to fetch from backend: ${url}`, err);
    return NextResponse.json(
      { ok: false, error: "Backend unreachable", details: errMessage(err) },
      { status: 502 },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
