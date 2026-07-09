function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  PORT: parseInt(process.env.PORT ?? "9091", 10),
  METRICS_BASIC_AUTH_USER: required("METRICS_BASIC_AUTH_USER"),
  METRICS_BASIC_AUTH_PASS: required("METRICS_BASIC_AUTH_PASS"),
  FRONTEND_STATUS_URL: process.env.FRONTEND_STATUS_URL ?? "http://localhost:4000",
  BACKEND_STATUS_URL: process.env.BACKEND_STATUS_URL ?? "http://localhost:3001",
  SUPABASE_HEALTH_URL: required("SUPABASE_HEALTH_URL"),
  SUPABASE_ANON_KEY: required("SUPABASE_ANON_KEY"),
  REDIS_EXPORTER_URL: process.env.REDIS_EXPORTER_URL ?? "http://redis-exporter:9121",
} as const;
