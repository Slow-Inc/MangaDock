import { config } from "./config";
import { serviceUp, serviceDegraded, serviceLatency } from "./metrics";

const TIMEOUT_MS = 5000;

export interface ProbeResult {
  up: boolean;
  degraded: boolean;
  latencyMs: number;
}

export async function probeStatusEndpoint(url: string): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { up: false, degraded: false, latencyMs: -1 };
    const body = (await res.json()) as { status?: string };
    const s = body.status;
    return {
      up: s === "up",
      degraded: s === "degraded",
      latencyMs,
    };
  } catch {
    return { up: false, degraded: false, latencyMs: -1 };
  }
}

export async function probeSupabase(): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(config.SUPABASE_HEALTH_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { apikey: config.SUPABASE_ANON_KEY },
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { up: false, degraded: false, latencyMs: -1 };
    const text = await res.text();
    return { up: text.trim() === "Healthy", degraded: false, latencyMs };
  } catch {
    return { up: false, degraded: false, latencyMs: -1 };
  }
}

export async function probeCfWorker(): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const res = await fetch("https://assets.2552667.xyz/health", {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const latencyMs = Date.now() - t0;
    return { up: res.status < 500, degraded: false, latencyMs };
  } catch {
    return { up: false, degraded: false, latencyMs: -1 };
  }
}

export function probeMock(): () => Promise<ProbeResult> {
  return async () => ({ up: true, degraded: false, latencyMs: 0 });
}

const SERVICES: Array<{ name: string; probe: () => Promise<ProbeResult> }> = [
  { name: "frontend",   probe: () => probeStatusEndpoint(`${config.FRONTEND_STATUS_URL}/status`) },
  { name: "backend",    probe: () => probeStatusEndpoint(`${config.BACKEND_STATUS_URL}/status`) },
  { name: "supabase",   probe: probeSupabase },
  { name: "cf-worker",  probe: probeCfWorker },
  // TODO: replace with real probe when AI gateway / MIT health endpoints are available
  { name: "ai-gateway", probe: probeMock() },
  { name: "mit",        probe: probeMock() },
];

export function startProbeLoop(): void {
  async function tick() {
    await Promise.allSettled(
      SERVICES.map(async ({ name, probe }) => {
        const r = await probe();
        serviceUp.set({ service: name }, r.up ? 1 : 0);
        serviceDegraded.set({ service: name }, r.degraded ? 1 : 0);
        serviceLatency.set({ service: name }, r.latencyMs);
      }),
    );
  }
  tick();
  setInterval(tick, 15_000);
}
