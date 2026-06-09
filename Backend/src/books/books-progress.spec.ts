/**
 * Live translation progress (UX): MIT posts per-stage progress webhooks;
 * the Backend forwards them to batch listeners as informational events —
 * they must never count as completed pages or resolve the job.
 */
import { BooksService } from './books.service';
import { MitWebhookController } from './mit-webhook.controller';

function seedJob(
  service: BooksService,
  jobKey: string,
  overrides: Partial<any> = {},
) {
  const job = {
    completedPages: new Map(),
    processingPages: new Set<number>(),
    listeners: new Set<any>(),
    activeCallerCount: 1,
    expectedCount: 2,
    resolve: jest.fn(),
    reject: jest.fn(),
    cancelController: new AbortController(),
    ...overrides,
  };
  (service as any).activeBatchJobs.set(jobKey, job);
  return job;
}

function makeService() {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const storage = {
    put: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const service = new BooksService(
    {} as any,
    cache as any,
    { enabled: false } as any,
    {} as any,
    storage as any,
  );
  return { service, cache };
}

describe('BooksService — batch progress events', () => {
  it('delivers a progress event to listeners without completing the page', () => {
    const { service } = makeService();
    const jobKey = 'ch1:ANY:THA:default:hd';
    const received: any[] = [];
    const job = seedJob(service, jobKey, {
      originalListener: (pageIndex: number, result: any) =>
        received.push({ pageIndex, ...result }),
    });

    service.notifyBatchProgress(jobKey, 3, 'translating');

    expect(received).toEqual([
      { pageIndex: 3, patches: [], stage: 'translating', progress: true },
    ]);
    expect(job.completedPages.size).toBe(0);
    expect(job.resolve).not.toHaveBeenCalled();
  });

  it('fans progress out to latecomer listeners too', () => {
    const { service } = makeService();
    const jobKey = 'ch1:ANY:THA:default:hd';
    const late: any[] = [];
    const job = seedJob(service, jobKey);
    job.listeners.add((pageIndex: number, result: any) =>
      late.push({ pageIndex, stage: result.stage }),
    );

    service.notifyBatchProgress(jobKey, 0, 'inpainting');

    expect(late).toEqual([{ pageIndex: 0, stage: 'inpainting' }]);
  });

  it('ignores progress for unknown jobs without throwing', () => {
    const { service } = makeService();
    expect(() =>
      service.notifyBatchProgress('nope:ANY:THA:default:hd', 0, 'ocr'),
    ).not.toThrow();
  });
});

describe('MitWebhookController — progress payload routing', () => {
  it('routes a stage payload to notifyBatchProgress, never handleMitCallback', async () => {
    delete process.env.MIT_WEBHOOK_SECRET;

    const svc = {
      notifyBatchProgress: jest.fn(),
      handleMitCallback: jest.fn(),
    };
    const ctrl = new MitWebhookController(svc as any);

    const result = await ctrl.handleCallback(
      '',
      { taskId: 'ch1:ANY:THA:default:hd', pageIndex: 2, stage: 'ocr' },
      undefined,
    );

    expect(result).toEqual({ ok: true });
    expect(svc.notifyBatchProgress).toHaveBeenCalledWith(
      'ch1:ANY:THA:default:hd',
      2,
      'ocr',
    );
    expect(svc.handleMitCallback).not.toHaveBeenCalled();
  });

  it('still treats completion payloads (patches present) as completions', async () => {
    delete process.env.MIT_WEBHOOK_SECRET;

    const svc = {
      notifyBatchProgress: jest.fn(),
      handleMitCallback: jest.fn(),
    };
    const ctrl = new MitWebhookController(svc as any);

    await ctrl.handleCallback(
      '',
      {
        taskId: 'k',
        pageIndex: 0,
        imgWidth: 1,
        imgHeight: 1,
        patches: [],
        error: null,
      },
      undefined,
    );

    expect(svc.handleMitCallback).toHaveBeenCalled();
    expect(svc.notifyBatchProgress).not.toHaveBeenCalled();
  });
});
