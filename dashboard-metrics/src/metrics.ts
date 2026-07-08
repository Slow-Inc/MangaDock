import { Registry, Gauge } from "prom-client";

export const registry = new Registry();

export const serviceUp = new Gauge({
  name: "mangadock_service_up",
  help: "1 if service is up, 0 if down or degraded",
  labelNames: ["service"] as const,
  registers: [registry],
});

export const serviceDegraded = new Gauge({
  name: "mangadock_service_degraded",
  help: "1 if service is degraded (partial failure), 0 otherwise",
  labelNames: ["service"] as const,
  registers: [registry],
});

export const serviceLatency = new Gauge({
  name: "mangadock_service_latency_ms",
  help: "Last probe latency in ms; -1 if unreachable",
  labelNames: ["service"] as const,
  registers: [registry],
});

// Initialise all services to 0 so Grafana sees the series immediately
const SERVICES = ["frontend", "backend", "supabase", "cf-worker", "ai-gateway", "mit"] as const;
for (const s of SERVICES) {
  serviceUp.set({ service: s }, 0);
  serviceDegraded.set({ service: s }, 0);
  serviceLatency.set({ service: s }, -1);
}
