export const runtime = "nodejs";

import { register } from "@/lib/metrics";

export async function GET() {
  return new Response(await register.metrics(), {
    headers: { "Content-Type": register.contentType },
  });
}
