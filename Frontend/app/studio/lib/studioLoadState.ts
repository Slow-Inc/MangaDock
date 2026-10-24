/**
 * What a Studio page shows while its data loads (#828): a failed first load is an error with a retry, not a
 * set of zero metrics that read as "you have no works". Cached data stays on screen if a refresh fails.
 */
export function studioLoadState({ loading, failed, hasData }: { loading: boolean; failed: boolean; hasData: boolean }): "loading" | "error" | "ready" {
  if (hasData) return "ready";
  if (loading) return "loading";
  return failed ? "error" : "ready";
}
