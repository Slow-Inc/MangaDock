import { Registry, Counter, collectDefaultMetrics } from 'prom-client';

const g = globalThis as typeof globalThis & {
  _metricsRegistry?: Registry;
  _httpRequestsTotal?: Counter;
};

export function getRegistry(): Registry {
  if (!g._metricsRegistry) {
    const reg = new Registry();
    collectDefaultMetrics({ register: reg, prefix: 'mangadock_frontend_' });
    g._metricsRegistry = reg;
    g._httpRequestsTotal = new Counter({
      name: 'mangadock_http_requests_total',
      help: 'HTTP requests received by the Frontend service',
      labelNames: ['method', 'status_code', 'path'] as const,
      registers: [reg],
    });
  }
  return g._metricsRegistry;
}

export function getHttpRequestsTotal(): Counter {
  if (!g._httpRequestsTotal) getRegistry();
  return g._httpRequestsTotal!;
}
