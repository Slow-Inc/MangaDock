import { Counter, Histogram, register } from "prom-client";

export const proxyRequestsTotal = new Counter({
  name: "mangadock_http_requests_total",
  help: "Total HTTP requests proxied by Frontend",
  labelNames: ["service", "method", "route", "status_code"] as const,
});

export const proxyRequestDuration = new Histogram({
  name: "mangadock_http_request_duration_ms",
  help: "HTTP proxy request duration in ms",
  labelNames: ["service", "method", "route"] as const,
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

export { register };
