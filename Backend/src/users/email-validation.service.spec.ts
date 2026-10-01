import { EmailValidationService } from './email-validation.service';
import { CacheOrchestratorService } from '../cache/cache-orchestrator.service';
import { SupabaseService } from '../supabase/supabase.service';

const ENV_KEYS = [
  'EMAIL_VALIDATION_PROVIDER',
  'EMAIL_VALIDATION_API_KEY',
  'EMAIL_VALIDATION_FAIL_OPEN',
  'EMAIL_VALIDATION_TIMEOUT_MS',
  'EMAIL_VALIDATION_CACHE_TTL_SEC',
] as const;

function makeCache(): jest.Mocked<
  Pick<CacheOrchestratorService, 'get' | 'set'>
> {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<Pick<CacheOrchestratorService, 'get' | 'set'>>;
}

function makeSupabase(existingRows: unknown[] = []): { client: any } {
  const limit = jest
    .fn()
    .mockResolvedValue({ data: existingRows, error: null });
  const eq = jest.fn().mockReturnValue({ limit });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ select });
  return { client: { from } };
}

function enableProvider() {
  process.env.EMAIL_VALIDATION_PROVIDER = 'abstract';
  process.env.EMAIL_VALIDATION_API_KEY = 'test-key';
}

function mockFetchResolved(payload: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(payload),
  }) as unknown as typeof fetch;
}

describe('EmailValidationService', () => {
  const realFetch = global.fetch;
  let savedEnv: Record<string, string | undefined>;
  let cache: jest.Mocked<Pick<CacheOrchestratorService, 'get' | 'set'>>;
  let supabase: { client: any };
  let service: EmailValidationService;

  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    cache = makeCache();
    supabase = makeSupabase([]);
    service = new EmailValidationService(
      cache as unknown as CacheOrchestratorService,
      supabase as unknown as SupabaseService,
    );
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  // ─── validateForSignup: existing user ────────────────────────────────────

  it('blocks with database source when the email already exists in profiles', async () => {
    supabase = makeSupabase([{ uid: 'user-1' }]);
    service = new EmailValidationService(
      cache as unknown as CacheOrchestratorService,
      supabase as unknown as SupabaseService,
    );
    global.fetch = jest.fn() as unknown as typeof fetch;

    const result = await service.validateForSignup('  Test@Example.com  ');

    expect(result).toMatchObject({
      ok: false,
      decision: 'block',
      normalizedEmail: 'test@example.com',
      source: 'database',
      provider: 'supabase',
      reason: 'email_already_in_use',
    });
    expect(result.checks).toEqual({
      status: null,
      statusDetail: null,
      formatValid: null,
      mxValid: null,
      smtpValid: null,
      disposable: null,
      role: null,
      catchAll: null,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ─── validateForSignup: provider disabled ────────────────────────────────

  it('allows with source provider-disabled when EMAIL_VALIDATION_PROVIDER is unset', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    const result = await service.validateForSignup('user@example.com');

    expect(result).toMatchObject({
      ok: true,
      decision: 'allow',
      source: 'provider-disabled',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('allows with source provider-disabled when EMAIL_VALIDATION_PROVIDER is "none"', async () => {
    process.env.EMAIL_VALIDATION_PROVIDER = 'none';
    process.env.EMAIL_VALIDATION_API_KEY = 'test-key';
    global.fetch = jest.fn() as unknown as typeof fetch;

    const result = await service.validateForSignup('user@example.com');

    expect(result).toMatchObject({
      ok: true,
      decision: 'allow',
      source: 'provider-disabled',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('allows with source provider-disabled when provider is set but API key is missing', async () => {
    process.env.EMAIL_VALIDATION_PROVIDER = 'abstract';
    global.fetch = jest.fn() as unknown as typeof fetch;

    const result = await service.validateForSignup('user@example.com');

    expect(result).toMatchObject({
      ok: true,
      decision: 'allow',
      source: 'provider-disabled',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ─── validateForSignup: cache ─────────────────────────────────────────────

  it('returns cached result with source overridden to "cache" on a cache hit, without calling fetch', async () => {
    enableProvider();
    const cachedResult = {
      ok: true,
      decision: 'allow' as const,
      normalizedEmail: 'user@example.com',
      source: 'abstract' as const,
      provider: 'abstract',
      reason: null,
      message: null,
      warning: null,
      checks: {
        status: 'deliverable',
        statusDetail: null,
        formatValid: true,
        mxValid: true,
        smtpValid: true,
        disposable: false,
        role: false,
        catchAll: false,
      },
    };
    cache.get.mockResolvedValue({ data: cachedResult, source: 'redis' });
    global.fetch = jest.fn() as unknown as typeof fetch;

    const result = await service.validateForSignup('user@example.com');

    expect(result).toEqual({ ...cachedResult, source: 'cache' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('on cache miss, calls the provider and caches the result under the email-validation:v1 key', async () => {
    enableProvider();
    mockFetchResolved({
      email_deliverability: {
        status: 'deliverable',
        is_format_valid: true,
        is_smtp_valid: true,
        is_mx_valid: true,
      },
      email_quality: {
        is_disposable: false,
        is_role: false,
        is_catchall: false,
      },
    });

    const result = await service.validateForSignup('user@example.com');

    expect(result).toMatchObject({
      ok: true,
      decision: 'allow',
      source: 'abstract',
    });
    expect(cache.set).toHaveBeenCalledTimes(1);
    const [cacheKey, cachedValue, ttlMs] = cache.set.mock.calls[0];
    expect(cacheKey).toBe('email-validation:v1:user@example.com');
    expect(cachedValue).toMatchObject({ ok: true, decision: 'allow' });
    expect(ttlMs).toBe(21600 * 1000); // default EMAIL_VALIDATION_CACHE_TTL_SEC
  });

  // ─── validateForSignup: provider error ───────────────────────────────────

  it('fails open (allow, source provider-error, Thai warning) by default when the provider rejects', async () => {
    enableProvider();
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const result = await service.validateForSignup('user@example.com');

    expect(result).toMatchObject({
      ok: true,
      decision: 'allow',
      source: 'provider-error',
    });
    expect(result.warning).toBe(
      'ขณะนี้ระบบตรวจสอบอีเมลภายนอกไม่พร้อมใช้งาน ระบบจะข้ามขั้นตอนนี้ชั่วคราว',
    );
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('fails open on a non-ok HTTP response from the provider too', async () => {
    enableProvider();
    mockFetchResolved({}, false);

    const result = await service.validateForSignup('user@example.com');

    expect(result).toMatchObject({
      ok: true,
      decision: 'allow',
      source: 'provider-error',
    });
  });

  it('blocks when the provider errors and EMAIL_VALIDATION_FAIL_OPEN=false', async () => {
    enableProvider();
    process.env.EMAIL_VALIDATION_FAIL_OPEN = 'false';
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const result = await service.validateForSignup('user@example.com');

    expect(result).toMatchObject({
      ok: false,
      decision: 'block',
      source: 'provider-error',
      reason: 'validation_service_unavailable',
    });
  });

  // ─── normalizeEmail ───────────────────────────────────────────────────────

  it('trims and lowercases the email before returning it as normalizedEmail', async () => {
    const result = await service.validateForSignup(
      '  MiXeD.Case@EXAMPLE.com  ',
    );
    expect(result.normalizedEmail).toBe('mixed.case@example.com');
  });

  // ─── toPolicyResult decision tree (via provider enabled + mocked fetch) ──

  describe('provider policy decision tree', () => {
    const cleanDeliverability = {
      status: 'deliverable',
      is_format_valid: true,
      is_smtp_valid: true,
      is_mx_valid: true,
    };
    const cleanQuality = {
      is_disposable: false,
      is_role: false,
      is_catchall: false,
    };

    beforeEach(() => {
      enableProvider();
    });

    it('blocks invalid_format when is_format_valid is false', async () => {
      mockFetchResolved({
        email_deliverability: {
          ...cleanDeliverability,
          is_format_valid: false,
        },
        email_quality: cleanQuality,
      });

      const result = await service.validateForSignup('user@example.com');

      expect(result).toMatchObject({
        ok: false,
        decision: 'block',
        reason: 'invalid_format',
      });
    });

    it('blocks disposable_email when is_disposable is true', async () => {
      mockFetchResolved({
        email_deliverability: cleanDeliverability,
        email_quality: { ...cleanQuality, is_disposable: true },
      });

      const result = await service.validateForSignup('user@example.com');

      expect(result).toMatchObject({
        ok: false,
        decision: 'block',
        reason: 'disposable_email',
      });
    });

    it('blocks no_mx_records when is_mx_valid is false', async () => {
      mockFetchResolved({
        email_deliverability: { ...cleanDeliverability, is_mx_valid: false },
        email_quality: cleanQuality,
      });

      const result = await service.validateForSignup('user@example.com');

      expect(result).toMatchObject({
        ok: false,
        decision: 'block',
        reason: 'no_mx_records',
      });
    });

    it('blocks undeliverable when status is "undeliverable"', async () => {
      mockFetchResolved({
        email_deliverability: {
          ...cleanDeliverability,
          status: 'undeliverable',
        },
        email_quality: cleanQuality,
      });

      const result = await service.validateForSignup('user@example.com');

      expect(result).toMatchObject({
        ok: false,
        decision: 'block',
        reason: 'undeliverable',
      });
    });

    it('blocks undeliverable when is_smtp_valid is false (status otherwise deliverable)', async () => {
      mockFetchResolved({
        email_deliverability: { ...cleanDeliverability, is_smtp_valid: false },
        email_quality: cleanQuality,
      });

      const result = await service.validateForSignup('user@example.com');

      expect(result).toMatchObject({
        ok: false,
        decision: 'block',
        reason: 'undeliverable',
      });
    });

    it('warns role_email when is_role is true', async () => {
      mockFetchResolved({
        email_deliverability: cleanDeliverability,
        email_quality: { ...cleanQuality, is_role: true },
      });

      const result = await service.validateForSignup('user@example.com');

      expect(result).toMatchObject({
        ok: true,
        decision: 'warn',
        reason: 'role_email',
      });
    });

    it('warns risky_or_unknown when is_catchall is true', async () => {
      mockFetchResolved({
        email_deliverability: cleanDeliverability,
        email_quality: { ...cleanQuality, is_catchall: true },
      });

      const result = await service.validateForSignup('user@example.com');

      expect(result).toMatchObject({
        ok: true,
        decision: 'warn',
        reason: 'risky_or_unknown',
      });
    });

    it('warns risky_or_unknown when status is "risky"', async () => {
      mockFetchResolved({
        email_deliverability: { ...cleanDeliverability, status: 'risky' },
        email_quality: cleanQuality,
      });

      const result = await service.validateForSignup('user@example.com');

      expect(result).toMatchObject({
        ok: true,
        decision: 'warn',
        reason: 'risky_or_unknown',
      });
    });

    it('warns risky_or_unknown when status is "unknown"', async () => {
      mockFetchResolved({
        email_deliverability: { ...cleanDeliverability, status: 'unknown' },
        email_quality: cleanQuality,
      });

      const result = await service.validateForSignup('user@example.com');

      expect(result).toMatchObject({
        ok: true,
        decision: 'warn',
        reason: 'risky_or_unknown',
      });
    });

    it('allows with source abstract and reason null for an all-clean deliverable payload', async () => {
      mockFetchResolved({
        email_deliverability: cleanDeliverability,
        email_quality: cleanQuality,
      });

      const result = await service.validateForSignup('user@example.com');

      expect(result).toMatchObject({
        ok: true,
        decision: 'allow',
        source: 'abstract',
        reason: null,
      });
    });

    it('precedence: invalid_format wins over disposable when both are true', async () => {
      mockFetchResolved({
        email_deliverability: {
          ...cleanDeliverability,
          is_format_valid: false,
        },
        email_quality: { ...cleanQuality, is_disposable: true },
      });

      const result = await service.validateForSignup('user@example.com');

      expect(result).toMatchObject({
        ok: false,
        decision: 'block',
        reason: 'invalid_format',
      });
    });

    it('coerces missing fields to null and still allows when nothing trips the policy', async () => {
      mockFetchResolved({});

      const result = await service.validateForSignup('user@example.com');

      expect(result.checks).toEqual({
        status: null,
        statusDetail: null,
        formatValid: null,
        mxValid: null,
        smtpValid: null,
        disposable: null,
        role: null,
        catchAll: null,
      });
      expect(result).toMatchObject({
        ok: true,
        decision: 'allow',
        reason: null,
      });
    });
  });
});
