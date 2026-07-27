import { NextResponse } from 'next/server';
import { getRegistry } from '../lib/metrics-registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const registry = getRegistry();
  const metrics = await registry.metrics();
  return new NextResponse(metrics, {
    headers: { 'Content-Type': registry.contentType },
  });
}
