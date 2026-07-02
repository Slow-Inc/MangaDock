export type ServiceStatus = "up" | "degraded" | "down";

export interface StatusCheck {
  id: string;
  status: ServiceStatus;
  latencyMs: number | null;
  detail?: string;
}

export interface ServiceSnapshot {
  schemaVersion: 1;
  service: string;
  status: ServiceStatus;
  reason: string;
  checks: StatusCheck[];
  uptimeSec: number;
  durationMs: number;
  checkedAt: string;
}

export interface ServiceStatusMap {
  frontend: ServiceSnapshot | null;
  backend: ServiceSnapshot | null;
}

function fallback(service: string, reason: string): ServiceSnapshot {
  return {
    schemaVersion: 1,
    service,
    status: "down",
    reason,
    checks: [],
    uptimeSec: 0,
    durationMs: 0,
    checkedAt: new Date().toISOString(),
  };
}

export async function probeService(url: string, service: string): Promise<ServiceSnapshot> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return fallback(service, `HTTP ${res.status}`);
    return (await res.json()) as ServiceSnapshot;
  } catch (e) {
    return fallback(service, e instanceof Error ? e.message : "unreachable");
  }
}
