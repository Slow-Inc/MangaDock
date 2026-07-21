import * as crypto from 'crypto';
import { ExecutionContext } from '@nestjs/common';

const TEST_SECRET = 'test-secret-key';

const makeCtx = (
  query: Record<string, string> = {},
  headers: Record<string, string> = {},
): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ query, headers }) }),
  }) as unknown as ExecutionContext;

const makeToken = (
  chapterId: string,
  hwid: string,
  offsetSeconds = 1800,
): string => {
  const expiresAt = Math.floor(Date.now() / 1000) + offsetSeconds;
  const hwidEncoded = Buffer.from(hwid).toString('base64url');
  const hmac = crypto
    .createHmac('sha256', TEST_SECRET)
    .update(`${chapterId}:${expiresAt}:${hwid}`)
    .digest('hex');
  return `${expiresAt}.${hwidEncoded}.${hmac}`;
};

describe('ImageTokenGuard — Sec-Fetch-Mode (no SECRET)', () => {
  let guard: { canActivate: (ctx: ExecutionContext) => boolean };
  beforeAll(() => {
    delete process.env.IMAGE_TOKEN_SECRET;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ImageTokenGuard } = require('./image-token.guard');
    guard = new ImageTokenGuard();
  });

  it('blocks Sec-Fetch-Mode: navigate', () => {
    expect(
      guard.canActivate(makeCtx({}, { 'sec-fetch-mode': 'navigate' })),
    ).toBe(false);
  });

  it('passes Sec-Fetch-Mode: no-cors (no secret → passthrough)', () => {
    expect(
      guard.canActivate(makeCtx({}, { 'sec-fetch-mode': 'no-cors' })),
    ).toBe(true);
  });

  it('passes absent Sec-Fetch-Mode header (no secret → passthrough)', () => {
    expect(guard.canActivate(makeCtx({}))).toBe(true);
  });
});

describe('ImageTokenGuard — HMAC validation (with SECRET)', () => {
  let guard: { canActivate: (ctx: ExecutionContext) => boolean };
  beforeAll(() => {
    process.env.IMAGE_TOKEN_SECRET = TEST_SECRET;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ImageTokenGuard } = require('./image-token.guard');
    guard = new ImageTokenGuard();
  });

  afterAll(() => {
    delete process.env.IMAGE_TOKEN_SECRET;
  });

  it('passes valid token with no-cors', () => {
    const token = makeToken('ch-1', 'hwid-abc');
    expect(
      guard.canActivate(
        makeCtx({ t: token, cid: 'ch-1' }, { 'sec-fetch-mode': 'no-cors' }),
      ),
    ).toBe(true);
  });

  it('passes valid token with absent Sec-Fetch-Mode (server/curl)', () => {
    const token = makeToken('ch-1', 'hwid-abc');
    expect(guard.canActivate(makeCtx({ t: token, cid: 'ch-1' }))).toBe(true);
  });

  it('blocks navigate even with valid token', () => {
    const token = makeToken('ch-1', 'hwid-abc');
    expect(
      guard.canActivate(
        makeCtx({ t: token, cid: 'ch-1' }, { 'sec-fetch-mode': 'navigate' }),
      ),
    ).toBe(false);
  });

  it('blocks expired token', () => {
    const token = makeToken('ch-1', 'hwid-abc', -1);
    expect(guard.canActivate(makeCtx({ t: token, cid: 'ch-1' }))).toBe(false);
  });

  it('blocks missing token', () => {
    expect(guard.canActivate(makeCtx({ cid: 'ch-1' }))).toBe(false);
  });

  it('blocks wrong HMAC', () => {
    const token = makeToken('ch-1', 'hwid-abc').replace(
      /\.[^.]+$/,
      '.badhmacooo000000000000000000000000000000000000000000000000000000',
    );
    expect(guard.canActivate(makeCtx({ t: token, cid: 'ch-1' }))).toBe(false);
  });
});
