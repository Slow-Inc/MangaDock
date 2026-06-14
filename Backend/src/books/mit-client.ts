import { Injectable } from '@nestjs/common';

/**
 * The single HTTP boundary to the manga-image-translator (MIT) server (#230).
 *
 * Every call BooksService makes to MIT — health/readiness probe, single-page
 * submit, batch submit, and job cancel — goes through here, and the base URL is
 * resolved in ONE place instead of the five inline `process.env.MANGA_TRANSLATOR_URL`
 * reads it replaced. Methods return the raw `Response` so callers keep their exact
 * status/JSON/error handling; behaviour is byte-identical to the inline `fetch`es.
 *
 * This is the fakeable seam that finally makes the translation subsystem
 * unit-testable: a test injects a fake MitClient (or fakes global.fetch).
 */
@Injectable()
export class MitClient {
  /** MIT base URL, resolved here (the one place) on every call so a per-test or
   *  per-deploy `MANGA_TRANSLATOR_URL` override takes effect exactly as the old
   *  inline reads did. */
  get baseUrl(): string {
    return process.env.MANGA_TRANSLATOR_URL ?? 'http://localhost:5003';
  }

  /** GET /ready — health probe + translator-family readiness (#132). The caller
   *  picks the timeout (3s for the family probe, 5s for the health check). */
  ready(timeoutMs: number): Promise<Response> {
    return fetch(`${this.baseUrl}/ready`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  /** POST /translate/with-form/patches — single-page patch translation. */
  submitSinglePage(form: FormData, timeoutMs: number): Promise<Response> {
    return fetch(`${this.baseUrl}/translate/with-form/patches`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  /** POST /translate/with-form/patches/batch — full-chapter batch submit.
   *  Deliberately NO abort signal: once MIT accepts the job it processes
   *  asynchronously and webhooks back even if the SSE caller disconnects;
   *  killing the POST mid-flight crashes MIT's BLAS/Fortran runtime
   *  (forrtl error 200: window-CLOSE event). */
  submitBatch(form: FormData): Promise<Response> {
    return fetch(`${this.baseUrl}/translate/with-form/patches/batch`, {
      method: 'POST',
      body: form,
    });
  }

  /** POST /cancel/:jobKey — best-effort cancel of an in-flight batch. MIT no-ops
   *  an unknown/finished id; callers fire-and-forget. */
  cancel(jobKey: string): Promise<Response> {
    return fetch(`${this.baseUrl}/cancel/${encodeURIComponent(jobKey)}`, {
      method: 'POST',
    });
  }
}
