import { LlmService } from './llm.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

jest.mock('@google/generative-ai');
jest.mock('openai');

function make(env: Partial<NodeJS.ProcessEnv>): LlmService {
  return new LlmService(env as NodeJS.ProcessEnv);
}

describe('LlmService — gemini provider', () => {
  const env = { LLM_PROVIDER: 'gemini', LLM_API_KEY: 'gkey' };

  afterEach(() => jest.resetAllMocks());

  it('isConfigured() true when LLM_API_KEY present', () => {
    expect(make(env).isConfigured()).toBe(true);
  });

  it('isConfigured() false when LLM_API_KEY absent', () => {
    expect(make({ LLM_PROVIDER: 'gemini' }).isConfigured()).toBe(false);
  });

  it('getDescriptionModel() returns LLM_DESCRIPTION_MODEL when set', () => {
    expect(make({ ...env, LLM_DESCRIPTION_MODEL: 'gemini-custom' }).getDescriptionModel()).toBe('gemini-custom');
  });

  it('getDescriptionModel() falls back to gemini-2.5-flash', () => {
    expect(make(env).getDescriptionModel()).toBe('gemini-2.5-flash');
  });

  it('getMangaModel() returns LLM_MANGA_MODEL when set', () => {
    expect(make({ ...env, LLM_MANGA_MODEL: 'gemini-lite' }).getMangaModel()).toBe('gemini-lite');
  });

  it('getMangaModel() falls back to gemini-2.5-flash-lite', () => {
    expect(make(env).getMangaModel()).toBe('gemini-2.5-flash-lite');
  });

  it('complete() calls GoogleGenerativeAI.generateContent and returns text', async () => {
    const mockGenContent = jest.fn().mockResolvedValue({ response: { text: () => 'แปลแล้ว' } });
    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({ generateContent: mockGenContent }),
    }));

    const result = await make(env).complete('Hello', 'gemini-2.5-flash');

    expect(GoogleGenerativeAI).toHaveBeenCalledWith('gkey');
    expect(mockGenContent).toHaveBeenCalledWith({
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    });
    expect(result).toBe('แปลแล้ว');
  });
});

describe('LlmService — openai provider', () => {
  const env = { LLM_PROVIDER: 'openai', LLM_API_KEY: 'sk-test' };

  afterEach(() => jest.resetAllMocks());

  it('isConfigured() true when LLM_API_KEY present', () => {
    expect(make(env).isConfigured()).toBe(true);
  });

  it('isConfigured() false when LLM_API_KEY absent', () => {
    expect(make({ LLM_PROVIDER: 'openai' }).isConfigured()).toBe(false);
  });

  it('getDescriptionModel() returns LLM_DESCRIPTION_MODEL when set', () => {
    expect(make({ ...env, LLM_DESCRIPTION_MODEL: 'gpt-4o' }).getDescriptionModel()).toBe('gpt-4o');
  });

  it('getDescriptionModel() falls back to gpt-4o-mini', () => {
    expect(make(env).getDescriptionModel()).toBe('gpt-4o-mini');
  });

  it('getMangaModel() returns LLM_MANGA_MODEL when set', () => {
    expect(make({ ...env, LLM_MANGA_MODEL: 'gpt-4.1-mini' }).getMangaModel()).toBe('gpt-4.1-mini');
  });

  it('getMangaModel() falls back to gpt-4o-mini', () => {
    expect(make(env).getMangaModel()).toBe('gpt-4o-mini');
  });

  it('complete() calls OpenAI without baseURL for openai provider', async () => {
    const mockCreate = jest.fn().mockResolvedValue({ choices: [{ message: { content: 'แปลแล้ว' } }] });
    (OpenAI as jest.Mock).mockImplementation(() => ({ chat: { completions: { create: mockCreate } } }));

    const result = await make(env).complete('Hello', 'gpt-4o-mini');

    expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'sk-test' });
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(result).toBe('แปลแล้ว');
  });
});

describe('LlmService — custom provider', () => {
  afterEach(() => jest.resetAllMocks());

  it('complete() passes baseURL to OpenAI constructor', async () => {
    const mockCreate = jest.fn().mockResolvedValue({ choices: [{ message: { content: 'x' } }] });
    (OpenAI as jest.Mock).mockImplementation(() => ({ chat: { completions: { create: mockCreate } } }));

    await make({
      LLM_PROVIDER: 'custom',
      LLM_API_KEY: 'sk-local',
      LLM_BASE_URL: 'http://localhost:11434/v1',
    }).complete('Hi', 'llama3');

    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: 'sk-local',
      baseURL: 'http://localhost:11434/v1',
    });
  });
});
