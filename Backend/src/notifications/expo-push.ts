export type PushResult = {
  status: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
};

// Fixed provider URLs, generic lock-screen copy, bounded request time. No tokens
// or provider response bodies are logged. HTTP 429/5xx/network errors are retried.
export async function expoPush(
  path: 'send' | 'getReceipts',
  body: unknown,
): Promise<unknown> {
  const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.EXPO_ACCESS_TOKEN
        ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 429 || response.status >= 500)
      throw new Error('Provider temporarily unavailable');
    return {
      data: { status: 'error', details: { error: 'ProviderRejected' } },
    };
  }
  return response.json();
}

export function pushResult(value: unknown): PushResult | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as PushResult;
  return item.status === 'ok' || item.status === 'error' ? item : null;
}
