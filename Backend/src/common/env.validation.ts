import { plainToInstance } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUrl, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Provision = 'provision',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment;

  @IsNumber()
  @IsOptional()
  PORT: number;

  @IsString()
  SUPABASE_URL: string;

  @IsString()
  @IsOptional()
  SUPABASE_ANON_KEY: string;

  @IsString()
  SUPABASE_SERVICE_ROLE_KEY: string;

  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;

  @IsOptional()
  @IsIn(['gemini', 'openai', 'custom'])
  LLM_PROVIDER?: string;

  @IsOptional()
  @IsString()
  LLM_API_KEY?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  LLM_BASE_URL?: string;

  @IsOptional()
  @IsString()
  LLM_DESCRIPTION_MODEL?: string;

  @IsOptional()
  @IsString()
  LLM_MANGA_MODEL?: string;

  @IsString()
  @IsOptional()
  MANGA_TRANSLATOR_URL: string;

  @IsString()
  @IsOptional()
  MIT_WEBHOOK_SECRET: string;

  @IsString()
  @IsOptional()
  WORKER_URL: string;

  @IsString()
  @IsOptional()
  WORKER_SECRET: string;
}

export function validate(config: Record<string, any>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  const provider = validatedConfig.LLM_PROVIDER ?? 'gemini';
  if (provider !== 'gemini' && !validatedConfig.LLM_API_KEY) {
    throw new Error(
      'LLM_API_KEY is required when LLM_PROVIDER is "openai" or "custom"',
    );
  }
  if (provider === 'custom' && !validatedConfig.LLM_BASE_URL) {
    throw new Error('LLM_BASE_URL is required when LLM_PROVIDER is "custom"');
  }

  return validatedConfig;
}
