import 'reflect-metadata';
import { validate } from './env.validation';

const BASE = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'svc-key',
};

describe('validate()', () => {
  describe('gemini provider (default)', () => {
    it('accepts gemini with GEMINI_API_KEY', () => {
      expect(() => validate({ ...BASE, GEMINI_API_KEY: 'key' })).not.toThrow();
    });

    it('accepts explicit LLM_PROVIDER=gemini with GEMINI_API_KEY', () => {
      expect(() => validate({ ...BASE, LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'key' })).not.toThrow();
    });

    it('allows GEMINI_API_KEY to be absent (no longer required)', () => {
      expect(() => validate({ ...BASE })).not.toThrow();
    });
  });

  describe('openai provider', () => {
    it('accepts openai with LLM_API_KEY', () => {
      expect(() =>
        validate({ ...BASE, LLM_PROVIDER: 'openai', LLM_API_KEY: 'sk-test' }),
      ).not.toThrow();
    });

    it('rejects openai without LLM_API_KEY', () => {
      expect(() => validate({ ...BASE, LLM_PROVIDER: 'openai' })).toThrow(
        'LLM_API_KEY is required',
      );
    });
  });

  describe('custom provider', () => {
    it('accepts custom with LLM_API_KEY and LLM_BASE_URL', () => {
      expect(() =>
        validate({
          ...BASE,
          LLM_PROVIDER: 'custom',
          LLM_API_KEY: 'sk-test',
          LLM_BASE_URL: 'http://localhost:11434/v1',
        }),
      ).not.toThrow();
    });

    it('rejects custom without LLM_API_KEY', () => {
      expect(() =>
        validate({ ...BASE, LLM_PROVIDER: 'custom', LLM_BASE_URL: 'http://x/v1' }),
      ).toThrow('LLM_API_KEY is required');
    });

    it('rejects custom without LLM_BASE_URL', () => {
      expect(() =>
        validate({ ...BASE, LLM_PROVIDER: 'custom', LLM_API_KEY: 'sk-test' }),
      ).toThrow('LLM_BASE_URL is required');
    });
  });

  it('rejects unknown LLM_PROVIDER value', () => {
    expect(() =>
      validate({ ...BASE, LLM_PROVIDER: 'anthropic', GEMINI_API_KEY: 'key' }),
    ).toThrow();
  });
});
