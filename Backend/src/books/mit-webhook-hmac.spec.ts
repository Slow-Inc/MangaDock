import * as crypto from 'crypto';
import { MitWebhookController } from './mit-webhook.controller';

function makeController() {
  const booksService = { handleMitCallback: jest.fn().mockResolvedValue(undefined) } as any;
  return { ctrl: new MitWebhookController(booksService), booksService };
}

function signCompact(payload: object, secret: string): string {
  const data = JSON.stringify(payload); // compact, no spaces — matches Python separators=(',',':') ensure_ascii=False
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

describe('MitWebhookController — HMAC verification', () => {
  const SECRET = 'test-webhook-secret';

  beforeEach(() => {
    process.env.MIT_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.MIT_WEBHOOK_SECRET;
    jest.restoreAllMocks();
  });

  // Cycle 14 — #75: compact JSON signature passes NestJS verification
  it('accepts webhook signed with compact JSON (no spaces after : or ,)', async () => {
    const { ctrl } = makeController();
    const body = { taskId: 'job1:ANY:THA', pageIndex: 0, result: { patches: [] }, error: null };
    const signature = signCompact(body, SECRET);

    await expect(ctrl.handleCallback(signature, body)).resolves.toEqual({ ok: true });
  });

  // Cycle 15 — #75: wrong-length signature returns 401, not 500
  it('returns 401 when signature length does not match digest length', async () => {
    const { ctrl } = makeController();
    const body = { taskId: 'job1:ANY:THA', pageIndex: 0, result: { patches: [] }, error: null };

    await expect(ctrl.handleCallback('tooshort', body)).rejects.toMatchObject({ status: 401 });
  });

  // Cycle 16 — #75: non-ASCII manga title in payload does not break HMAC
  it('accepts webhook with non-ASCII characters (e.g. Japanese manga title) in payload', async () => {
    const { ctrl } = makeController();
    const body = { taskId: 'job2:ANY:THA', pageIndex: 0, result: { title: '呪術廻戦', patches: [] }, error: null };
    const signature = signCompact(body, SECRET);

    await expect(ctrl.handleCallback(signature, body)).resolves.toEqual({ ok: true });
  });

  // #95 S1: HMAC must be verified over the raw request bytes, not a re-serialized body.
  // MIT signs its exact serialized payload; re-stringifying the parsed object can differ
  // byte-for-byte (e.g. Python json.dumps emits 1.0 where JSON.stringify emits 1).
  it('accepts a signature computed over raw bytes that JSON.stringify would not reproduce', async () => {
    const { ctrl } = makeController();
    const raw = Buffer.from(
      '{"taskId":"job5:ANY:THA","pageIndex":0,"imgWidth":1280.0,"imgHeight":1808.0,"patches":[],"error":null}',
    );
    const signature = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
    const body = JSON.parse(raw.toString('utf8'));
    const req = { rawBody: raw } as any;

    await expect(ctrl.handleCallback(signature, body, req)).resolves.toEqual({ ok: true });
  });

  // #95 S2 (resolved 2026-06-05): the secret is enforced only in production.
  // Local dev runs MIT without a secret on purpose (decision 2026-06-04); a
  // production deployment without MIT_WEBHOOK_SECRET is a misconfiguration and
  // must not accept unauthenticated results.
  describe('when MIT_WEBHOOK_SECRET is not configured', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    afterEach(() => {
      (process.env as any).NODE_ENV = prevNodeEnv;
    });

    it('returns 401 in production', async () => {
      delete process.env.MIT_WEBHOOK_SECRET;
      (process.env as any).NODE_ENV = 'production';
      const { ctrl } = makeController();
      const body = { taskId: 'job3:ANY:THA', pageIndex: 0, result: { patches: [] }, error: null };

      await expect(ctrl.handleCallback('any-signature', body)).rejects.toMatchObject({ status: 401 });
    });

    it('returns 401 in production even when the signature header is missing', async () => {
      delete process.env.MIT_WEBHOOK_SECRET;
      (process.env as any).NODE_ENV = 'production';
      const { ctrl } = makeController();
      const body = { taskId: 'job3:ANY:THA', pageIndex: 0, result: { patches: [] }, error: null };

      await expect(ctrl.handleCallback(undefined as any, body)).rejects.toMatchObject({ status: 401 });
    });

    it('accepts unauthenticated webhooks outside production (local dev without a secret)', async () => {
      delete process.env.MIT_WEBHOOK_SECRET;
      const { ctrl } = makeController();
      const body = { taskId: 'job3:ANY:THA', pageIndex: 0, patches: [], error: null };

      await expect(ctrl.handleCallback(undefined as any, body)).resolves.toEqual({ ok: true });
    });
  });
});

/** Text layer (#158): MIT's per-page payload now carries
 *  `regions: [{src, dst}]`. The Backend accepts the field (persistence is a
 *  later slice, #160) and payloads without it keep working. */
describe('MitWebhookController — text layer payloads (#158)', () => {
  afterEach(() => {
    delete process.env.MIT_WEBHOOK_SECRET;
    jest.restoreAllMocks();
  });

  it('accepts a payload carrying regions and still delivers the page result', async () => {
    const booksService = { handleMitCallback: jest.fn().mockResolvedValue(undefined) } as any;
    const ctrl = new MitWebhookController(booksService);
    const body = {
      taskId: 'job1:ANY:THA',
      pageIndex: 0,
      imgWidth: 100,
      imgHeight: 200,
      patches: [],
      regions: [{ src: 'Huh?', dst: 'หา?' }],
      error: null,
    };

    await expect(ctrl.handleCallback(undefined as any, body)).resolves.toEqual({ ok: true });
    expect(booksService.handleMitCallback).toHaveBeenCalledWith(
      'job1:ANY:THA',
      0,
      expect.objectContaining({ patches: [] }),
      null,
    );
  });

  it('still accepts the old payload shape without regions', async () => {
    const booksService = { handleMitCallback: jest.fn().mockResolvedValue(undefined) } as any;
    const ctrl = new MitWebhookController(booksService);
    const body = { taskId: 'job1:ANY:THA', pageIndex: 1, imgWidth: 100, imgHeight: 200, patches: [], error: null };

    await expect(ctrl.handleCallback(undefined as any, body)).resolves.toEqual({ ok: true });
    expect(booksService.handleMitCallback).toHaveBeenCalled();
  });
});
