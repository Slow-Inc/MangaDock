import { Injectable, Optional } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

type LlmProvider = 'gemini' | 'openai' | 'custom';

@Injectable()
export class LlmService {
  private readonly provider: LlmProvider;
  private readonly openAiClient: OpenAI | undefined;

  constructor(@Optional() private readonly env: NodeJS.ProcessEnv = process.env) {
    this.provider = (env.LLM_PROVIDER as LlmProvider) ?? 'gemini';
    if (this.provider !== 'gemini') {
      this.openAiClient = new OpenAI({
        apiKey: env.LLM_API_KEY!,
        ...(env.LLM_BASE_URL ? { baseURL: env.LLM_BASE_URL } : {}),
      });
    }
  }

  isConfigured(): boolean {
    return this.provider === 'gemini'
      ? !!this.env.GEMINI_API_KEY
      : !!this.env.LLM_API_KEY;
  }

  getDescriptionModel(): string {
    if (this.provider === 'gemini') {
      return (
        this.env.GEMINI_DESCRIPTION_MODEL ??
        this.env.GEMINI_DESCRIPTION_FALLBACK_MODEL ??
        'gemini-2.5-flash'
      );
    }
    return this.env.LLM_DESCRIPTION_MODEL ?? 'gpt-4o-mini';
  }

  getMangaModel(): string {
    if (this.provider === 'gemini') {
      return (
        this.env.GEMINI_MANGA_MODEL ??
        this.env.GEMINI_MANGA_FALLBACK_MODEL ??
        'gemini-2.5-flash-lite'
      );
    }
    return this.env.LLM_MANGA_MODEL ?? 'gpt-4o-mini';
  }

  async complete(prompt: string, model: string): Promise<string> {
    return this.provider === 'gemini'
      ? this.geminiComplete(prompt, model)
      : this.openAiComplete(prompt, model);
  }

  private async geminiComplete(prompt: string, model: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(this.env.GEMINI_API_KEY!);
    const geminiModel = genAI.getGenerativeModel({ model });
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
