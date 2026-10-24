import { Injectable, Optional } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI, { type ClientOptions } from 'openai';
import { randomUUID } from 'node:crypto';

type LlmProvider = 'gemini' | 'openai' | 'custom';

@Injectable()
export class LlmService {
  private readonly provider: LlmProvider;
  private readonly openAiClient: OpenAI | undefined;
  private readonly genAI: GoogleGenerativeAI | undefined;

  constructor(
    @Optional() private readonly env: NodeJS.ProcessEnv = process.env,
  ) {
    this.provider = (env.LLM_PROVIDER as LlmProvider) ?? 'gemini';
    if (this.provider === 'gemini') {
      const key = env.LLM_API_KEY ?? env.GEMINI_API_KEY;
      if (env.GEMINI_API_KEY && !env.LLM_API_KEY) {
        console.warn(
          '[LlmService] GEMINI_API_KEY is deprecated — rename to LLM_API_KEY in your .env',
        );
      }
      if (key) this.genAI = new GoogleGenerativeAI(key);
    } else {
      this.openAiClient = new OpenAI({
        apiKey: env.LLM_API_KEY!,
        // The SDK bundles node-fetch@2, which fails with "Premature close" on Node 26.
        fetch: globalThis.fetch as unknown as ClientOptions['fetch'],
        ...(env.LLM_BASE_URL ? { baseURL: env.LLM_BASE_URL } : {}),
        // OpenCode (Zen/Go) answers 400 MissingSessionID without a stable session id.
        ...(env.LLM_BASE_URL?.includes('opencode.ai')
          ? { defaultHeaders: { 'x-opencode-session': randomUUID() } }
          : {}),
      });
    }
  }

  isConfigured(): boolean {
    return !!(this.env.LLM_API_KEY ?? this.env.GEMINI_API_KEY);
  }

  getDescriptionModel(): string {
    return (
      this.env.LLM_DESCRIPTION_MODEL ||
      (this.provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini')
    );
  }

  getMangaModel(): string {
    return (
      this.env.LLM_MANGA_MODEL ||
      (this.provider === 'gemini' ? 'gemini-2.5-flash-lite' : 'gpt-4o-mini')
    );
  }

  async complete(prompt: string, model: string): Promise<string> {
    return this.provider === 'gemini'
      ? this.geminiComplete(prompt, model)
      : this.openAiComplete(prompt, model);
  }

  private async geminiComplete(prompt: string, model: string): Promise<string> {
    const geminiModel = this.genAI!.getGenerativeModel({ model });
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as any,
    });
    return result.response.text();
  }

  private async openAiComplete(prompt: string, model: string): Promise<string> {
    const response = await this.openAiClient!.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0]?.message.content ?? '';
  }
}
