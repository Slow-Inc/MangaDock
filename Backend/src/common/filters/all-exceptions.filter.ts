import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = (exception as any)?.message || 'Internal server error';
    const stack = (exception as any)?.stack;

    // T4-STANDARD Pillar 6: Observability Standard
    // Detect Supabase connection issues (paused project)
    const isSupabaseError = 
      message.includes('fetch failed') || 
      message.includes('ECONNREFUSED') || 
      message.includes('getaddrinfo ENOTFOUND') ||
      message.includes('Supabase');

    const responseBody = {
      statusCode: isSupabaseError ? HttpStatus.SERVICE_UNAVAILABLE : httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      message: isSupabaseError 
        ? 'SUPABASE_CONNECTION_ERROR: The database is currently unreachable. Please ensure the Supabase project is active.' 
        : message,
      code: isSupabaseError ? 'SUPABASE_OFFLINE' : 'INTERNAL_ERROR',
    };

    if (isSupabaseError) {
      this.logger.error(`CRITICAL: Supabase connection failed! ${message}`);
    } else if (httpStatus >= 500) {
      this.logger.error(`Unhandled Exception: ${message}`, stack);
    }

    httpAdapter.reply(
      ctx.getResponse(),
      responseBody,
      isSupabaseError ? HttpStatus.SERVICE_UNAVAILABLE : httpStatus,
    );
  }
}
