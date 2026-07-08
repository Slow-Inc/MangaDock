import { collectDefaultMetrics, Counter, Histogram, register } from 'prom-client';

collectDefaultMetrics({ prefix: 'mangadock_' });

export const httpRequestsTotal = new Counter({
  name: 'mangadock_http_requests_total',
  help: 'Total HTTP requests to Backend',
  labelNames: ['service', 'method', 'route', 'status_code'] as const,
});

export const httpRequestDuration = new Histogram({
  name: 'mangadock_http_request_duration_ms',
  help: 'HTTP request duration in ms',
  labelNames: ['service', 'method', 'route'] as const,
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

export { register };
