import { NextResponse } from "next/server";

type ServiceStatus = "up" | "degraded" | "down";
interface StatusCheck { id: string; status: ServiceStatus; latencyMs: number | null; detail?: string }

export async function GET() {
  const t0 = Date.now();
  const checks: StatusCheck[] = [];
  let worst: ServiceStatus = "up";

  const hasSupabase =
    !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!hasSupabase) {
    checks.push({
      id: "supabase-env",
      status: "degraded",
      latencyMs: null,
      detail: "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set",
    });
    worst = "degraded";
  } else {
    checks.push({ id: "supabase-env", status: "up", latencyMs: null });
  }

  const reason =
    worst === "up" ? "all checks passed" : checks.find((c) => c.status !== "up")?.detail ?? "check failed";

  return NextResponse.json(
    {
      schemaVersion: 1,
      service: "frontend",
      status: worst,
      reason,
      checks,
      uptimeSec: Math.floor(process.uptime()),
      durationMs: Date.now() - t0,
      checkedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
