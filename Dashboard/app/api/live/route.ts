// Authenticated SSE aggregator proxy (PRD #279, ADR 016 §Decision 2/4).
//
// The browser cannot set an Authorization header on an EventSource, and MIT's
// data is sensitive — so the browser opens a same-origin `fetch` stream to this
// route carrying the dev's Supabase token, and the route (server-to-server)
// forwards that token to MIT's `/status/stream`. MIT verifies it INDEPENDENTLY;
// this proxy holds no secret of its own, so a dashboard compromise leaks nothing
// reusable. On any MIT failure the route returns non-200 and the client falls
// back to the mock view.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response("unauthorized", { status: 401 });
  }
  const mit = process.env.MIT_STATUS_URL;
  if (!mit) {
    return new Response("mit-not-configured", { status: 503 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${mit.replace(/\/$/, "")}/status/stream`, {
      headers: { Authorization: auth, Accept: "text/event-stream" },
      signal: req.signal,
    });
  } catch {
    return new Response("mit-unreachable", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(detail || `mit-${upstream.status}`, { status: upstream.status || 502 });
  }

  // Stream MIT's SSE straight through to the browser. The client's disconnect
  // aborts `req.signal`, which cancels this fetch and frees MIT's subscriber.
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
