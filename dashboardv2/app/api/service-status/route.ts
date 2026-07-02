import { NextResponse } from "next/server";
import { probeService } from "@/lib/service-status";

export const runtime = "nodejs";

export async function GET() {
  const [frontend, backend] = await Promise.all([
    probeService(
      process.env.FRONTEND_STATUS_URL ?? "http://localhost:4000/status",
      "frontend",
    ),
    probeService(
      process.env.BACKEND_STATUS_URL ?? "http://localhost:3001/status",
      "backend",
    ),
  ]);
  return NextResponse.json(
    { frontend, backend },
    { headers: { "Cache-Control": "no-store" } },
  );
}
