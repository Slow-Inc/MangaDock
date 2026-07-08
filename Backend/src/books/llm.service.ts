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
    return !!this.env.LLM_API_KEY;
  }

  getDescriptionModel(): string {
    return (
      this.env.LLM_DESCRIPTION_MODEL ??
      (this.provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini')
    );
  }

  getMangaModel(): string {
    return (
      this.env.LLM_MANGA_MODEL ??
      (this.provider === 'gemini' ? 'gemini-2.5-flash-lite' : 'gpt-4o-mini')
    );
  }

  async complete(prompt: string, model: string): Promise<string> {
    return this.provider === 'gemini'
      ? this.geminiComplete(prompt, model)
      : this.openAiComplete(prompt, model);
  }

  private async geminiComplete(prompt: string, model: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(this.env.LLM_API_KEY!);
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
