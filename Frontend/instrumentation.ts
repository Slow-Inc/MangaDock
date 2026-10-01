export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getRegistry } = await import('./app/lib/metrics-registry');
    getRegistry();
  }
}

export function onRequestError(
  _err: unknown,
  request: { path: string; method: string },
) {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    import('./app/lib/metrics-registry').then(({ getHttpRequestsTotal }) => {
      getHttpRequestsTotal().inc({
        method: request.method,
        status_code: '500',
        path: request.path,
      });
    });
  }
}
