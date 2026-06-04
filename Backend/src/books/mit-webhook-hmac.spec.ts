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

  // Cycle 17 — #90 S2: reject webhook when MIT_WEBHOOK_SECRET is not set
  it('returns 401 when MIT_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.MIT_WEBHOOK_SECRET;
    const { ctrl } = makeController();
    const body = { taskId: 'job3:ANY:THA', pageIndex: 0, result: { patches: [] }, error: null };

    await expect(ctrl.handleCallback('any-signature', body)).rejects.toMatchObject({ status: 401 });
  });

  // Cycle 18 — #90 S2: no secret + no signature still returns 401 (not 400)
  it('returns 401 (not silent pass-through) when secret unset and signature missing', async () => {
    delete process.env.MIT_WEBHOOK_SECRET;
    const { ctrl } = makeController();
    const body = { taskId: 'job3:ANY:THA', pageIndex: 0, result: { patches: [] }, error: null };

    await expect(ctrl.handleCallback(undefined as any, body)).rejects.toMatchObject({ status: 401 });
  });
});
