import { Injectable, Logger } from '@nestjs/common';
import { CacheOrchestratorService } from '../cache/cache-orchestrator.service';
import { SupabaseService } from '../supabase/supabase.service';

export type EmailValidationDecision = 'allow' | 'block' | 'warn';
export type EmailValidationSource =
  | 'abstract'
  | 'firebase'
  | 'cache'
  | 'provider-disabled'
  | 'provider-error';

export type EmailValidationResult = {
  ok: boolean;
  decision: EmailValidationDecision;
  normalizedEmail: string;
  source: EmailValidationSource;
  provider: string | null;
  reason: string | null;
  message: string | null;
  warning: string | null;
  checks: {
    status: string | null;
    statusDetail: string | null;
    formatValid: boolean | null;
    mxValid: boolean | null;
    smtpValid: boolean | null;
    disposable: boolean | null;
    role: boolean | null;
    catchAll: boolean | null;
  };
};

type AbstractEmailReputationResponse = {
  email_deliverability?: {
    status?: string;
    status_detail?: string;
    is_format_valid?: boolean;
    is_smtp_valid?: boolean;
    is_mx_valid?: boolean;
  };
  email_quality?: {
    is_disposable?: boolean;
    is_role?: boolean;
    is_catchall?: boolean;
  };
};

@Injectable()
export class EmailValidationService {
  private readonly logger = new Logger(EmailValidationService.name);

  constructor(
    private readonly cache: CacheOrchestratorService,
    private readonly supabase: SupabaseService,
  ) {}

  async validateForSignup(email: string): Promise<EmailValidationResult> {
    const normalizedEmail = this.normalizeEmail(email);
    const provider = this.provider;

    const existingUser = await this.findUserByEmail(normalizedEmail);
    if (existingUser) {
      this.logger.log(`Email already exists: ${this.maskEmail(normalizedEmail)}`);
      return {
        ok: false,
        decision: 'block',
        normalizedEmail,
        source: 'firebase',
        provider: 'supabase',
        reason: 'email_already_in_use',
        message: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบแทนการสมัครใหม่',
        warning: null,
        checks: this.emptyChecks(),
      };
    }

    if (!provider || provider === 'none' || !this.apiKey) {
      return this.allowResult(normalizedEmail, 'provider-disabled');
    }

    const cacheKey = `email-validation:v1:${normalizedEmail}`;
    const cached = await this.cache.get<EmailValidationResult>(cacheKey);
    if (cached) {
      return { ...cached.data, source: 'cache' };
    }

    try {
      const result = await this.validateWithAbstract(normalizedEmail);
      await this.cache.set(cacheKey, result, this.cacheTtlMs);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Email validation provider error for ${this.maskEmail(normalizedEmail)}: ${message}`);

      if (this.failOpen) {
        return {
          ...this.allowResult(normalizedEmail, 'provider-error'),
          warning: 'ขณะนี้ระบบตรวจสอบอีเมลภายนอกไม่พร้อมใช้งาน ระบบจะข้ามขั้นตอนนี้ชั่วคราว',
        };
      }

      return {
        ok: false,
        decision: 'block',
        normalizedEmail,
        source: 'provider-error',
        provider,
        reason: 'validation_service_unavailable',
        message: 'ไม่สามารถตรวจสอบอีเมลได้ในขณะนี้ กรุณาลองใหม่อีกครั้งภายหลัง',
        warning: null,
        checks: this.emptyChecks(),
      };
    }
  }

  private async validateWithAbstract(normalizedEmail: string): Promise<EmailValidationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = new URL('https://emailreputation.abstractapi.com/v1/');
      url.searchParams.set('api_key', this.apiKey!);
      url.searchParams.set('email', normalizedEmail);
      url.searchParams.set('auto_correct', 'false');

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`provider_http_${response.status}`);
      }

      const data = (await response.json()) as AbstractEmailReputationResponse;
      return this.toPolicyResult(normalizedEmail, data);
    } finally {
      clearTimeout(timeout);
    }
  }

  private toPolicyResult(
    normalizedEmail: string,
    data: AbstractEmailReputationResponse,
  ): EmailValidationResult {
    const deliverability = data.email_deliverability ?? {};
    const quality = data.email_quality ?? {};

    const status = this.toNullableString(deliverability.status);
    const statusDetail = this.toNullableString(deliverability.status_detail);
    const formatValid = this.toNullableBoolean(deliverability.is_format_valid);
    const mxValid = this.toNullableBoolean(deliverability.is_mx_valid);
    const smtpValid = this.toNullableBoolean(deliverability.is_smtp_valid);
    const disposable = this.toNullableBoolean(quality.is_disposable);
    const role = this.toNullableBoolean(quality.is_role);
    const catchAll = this.toNullableBoolean(quality.is_catchall);

    const checks = {
      status,
      statusDetail,
      formatValid,
      mxValid,
      smtpValid,
      disposable,
      role,
      catchAll,
    };

    if (formatValid === false) {
      return this.blockResult(normalizedEmail, checks, 'invalid_format', 'รูปแบบอีเมลไม่ถูกต้อง');
    }

    if (disposable === true) {
      return this.blockResult(normalizedEmail, checks, 'disposable_email', 'ไม่อนุญาตให้ใช้อีเมลชั่วคราวหรืออีเมลปลอมในการสมัครสมาชิก');
    }

    if (mxValid === false) {
      return this.blockResult(normalizedEmail, checks, 'no_mx_records', 'โดเมนอีเมลนี้ไม่พร้อมรับอีเมลจริง');
    }

    if (status === 'undeliverable' || smtpValid === false) {
      return this.blockResult(normalizedEmail, checks, 'undeliverable', 'อีเมลนี้ไม่สามารถรับข้อความได้ กรุณาใช้อีเมลอื่น');
    }

    if (role === true) {
      return this.warnResult(normalizedEmail, checks, 'role_email', 'อีเมลนี้เป็นอีเมลแบบกลุ่ม/องค์กร เช่น support@ หรือ admin@ แต่ยังสามารถใช้งานได้');
    }

    if (catchAll === true || status === 'risky' || status === 'unknown') {
      return this.warnResult(normalizedEmail, checks, 'risky_or_unknown', 'อีเมลนี้ตรวจสอบได้ไม่สมบูรณ์ แต่ระบบยังอนุญาตให้สมัครได้');
    }

    return {
      ok: true,
      decision: 'allow',
      normalizedEmail,
      source: 'abstract',
      provider: this.provider,
      reason: null,
      message: null,
      warning: null,
      checks,
    };
  }

  private allowResult(
    normalizedEmail: string,
    source: EmailValidationSource,
  ): EmailValidationResult {
    return {
      ok: true,
      decision: 'allow',
      normalizedEmail,
      source,
      provider: this.provider,
      reason: null,
      message: null,
      warning: null,
      checks: this.emptyChecks(),
    };
  }

  private warnResult(
    normalizedEmail: string,
    checks: EmailValidationResult['checks'],
    reason: string,
    warning: string,
  ): EmailValidationResult {
    return {
      ok: true,
      decision: 'warn',
      normalizedEmail,
      source: 'abstract',
      provider: this.provider,
      reason,
      message: null,
      warning,
      checks,
    };
  }

  private blockResult(
    normalizedEmail: string,
    checks: EmailValidationResult['checks'],
    reason: string,
    message: string,
  ): EmailValidationResult {
    return {
      ok: false,
      decision: 'block',
      normalizedEmail,
      source: 'abstract',
      provider: this.provider,
      reason,
      message,
      warning: null,
      checks,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private get provider(): string | null {
    const value = (process.env.EMAIL_VALIDATION_PROVIDER ?? '').trim().toLowerCase();
    return value || null;
  }

  private get apiKey(): string | null {
    const value = (process.env.EMAIL_VALIDATION_API_KEY ?? '').trim();
    return value || null;
  }

  private get timeoutMs(): number {
    return Math.max(1000, Number(process.env.EMAIL_VALIDATION_TIMEOUT_MS ?? 5000));
  }

  private get cacheTtlMs(): number {
    return Math.max(60, Number(process.env.EMAIL_VALIDATION_CACHE_TTL_SEC ?? 21600)) * 1000;
  }

  private get failOpen(): boolean {
    return (process.env.EMAIL_VALIDATION_FAIL_OPEN ?? 'true').trim().toLowerCase() !== 'false';
  }

  private emptyChecks(): EmailValidationResult['checks'] {
    return {
      status: null,
      statusDetail: null,
      formatValid: null,
      mxValid: null,
      smtpValid: null,
      disposable: null,
      role: null,
      catchAll: null,
    };
  }

  private toNullableString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
  }

  private toNullableBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return 'invalid-email';
    const maskedLocal = localPart.length <= 2
      ? `${localPart[0] ?? '*'}*`
      : `${localPart.slice(0, 2)}***`;
    return `${maskedLocal}@${domain}`;
  }

  private async findUserByEmail(email: string) {
    try {
      return await this.supabase.getUserByEmail(email);
    } catch {
      return null;
    }
  }
}
