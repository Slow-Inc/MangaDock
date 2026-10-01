/** Bound the SDK user lookup during CLI session commit, including response-body reads. */
export async function fetchCliAuthWithDeadline(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!new URL(url).pathname.startsWith("/auth/v1/")) return fetch(input, init);
  const controller = new AbortController();
  const upstream = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort();
  upstream?.addEventListener("abort", abort, {once: true});
  if (upstream?.aborted) abort();
  const timer = setTimeout(abort, 20_000);
  try {
    const response = await fetch(input, {...init, signal: controller.signal});
    const body = await response.text();
    if (controller.signal.aborted) throw new Error("Native auth request timed out");
    return new Response(body || null, {status: response.status, statusText: response.statusText, headers: response.headers});
  } finally {
    clearTimeout(timer);
    upstream?.removeEventListener("abort", abort);
  }
}
