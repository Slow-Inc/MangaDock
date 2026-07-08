export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { collectDefaultMetrics } = await import("prom-client");
    collectDefaultMetrics({ prefix: "mangadock_frontend_" });
  }
}
