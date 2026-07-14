import { verifyTurnstileToken } from './turnstile.verify';

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

describe('verifyTurnstileToken', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('returns success on a confirmed token and posts secret+response to siteverify', async () => {
    fetchMock = jest
      .fn()
      .mockResolvedValue({ json: async () => ({ success: true }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await verifyTurnstileToken('the-token', 'the-secret');

    expect(result).toEqual({ success: true, errorCodes: undefined });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    const body = init.body as URLSearchParams;
    expect(body.get('secret')).toBe('the-secret');
    expect(body.get('response')).toBe('the-token');
  });

  it('returns failure with error-codes for a rejected token', async () => {
    fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        success: false,
        'error-codes': ['invalid-input-response'],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await verifyTurnstileToken('bad-token', 'the-secret');

    expect(result).toEqual({
      success: false,
      errorCodes: ['invalid-input-response'],
    });
  });

  it('treats a missing success field as failure, never truthy by accident', async () => {
    fetchMock = jest.fn().mockResolvedValue({ json: async () => ({}) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await verifyTurnstileToken('token', 'secret');

    expect(result).toEqual({ success: false, errorCodes: undefined });
  });

  it('rejects when the network request fails', async () => {
    fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(verifyTurnstileToken('token', 'secret')).rejects.toThrow(
      'network down',
    );
  });

  it('rejects when the response body is malformed JSON', async () => {
    fetchMock = jest.fn().mockResolvedValue({
      json: async () => {
        throw new Error('malformed JSON');
      },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(verifyTurnstileToken('token', 'secret')).rejects.toThrow(
      'malformed JSON',
    );
  });

  it('appends remoteip only when provided', async () => {
    fetchMock = jest
      .fn()
      .mockResolvedValue({ json: async () => ({ success: true }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await verifyTurnstileToken('token', 'secret', '203.0.113.5');
    let body = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      .body as URLSearchParams;
    expect(body.get('remoteip')).toBe('203.0.113.5');

    fetchMock.mockClear();
    await verifyTurnstileToken('token', 'secret');
    body = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      .body as URLSearchParams;
    expect(body.has('remoteip')).toBe(false);
  });
});
