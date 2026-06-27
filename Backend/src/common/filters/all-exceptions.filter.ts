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

    const isHttpException = exception instanceof HttpException;
    const httpStatus = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Raw detail — used for server-side logging and Supabase detection only;
    // it must never reach the client unless it is an intentional HttpException.
    const message = (exception as any)?.message || 'Internal server error';
    const stack = (exception as any)?.stack;

    // T4-STANDARD Pillar 6: Observability Standard
    // Detect Supabase connection issues (paused project). Only applies to
    // UNEXPECTED (non-HttpException) errors — an intentional HttpException
    // whose message merely mentions Supabase must keep its own status/code.
    const isSupabaseError =
      !isHttpException &&
      (message.includes('fetch failed') ||
        message.includes('ECONNREFUSED') ||
        message.includes('getaddrinfo ENOTFOUND') ||
        message.includes('Supabase'));

    // Client-facing message: the crafted Supabase signal, the intentional
    // HttpException message, or a generic string for any other (unexpected)
    // error — so internal detail (queries, stack, secrets) is never leaked.
    const clientMessage = isSupabaseError
      ? 'SUPABASE_CONNECTION_ERROR: The database is currently unreachable. Please ensure the Supabase project is active.'
      : isHttpException
        ? message
        : 'Internal server error';

    const responseBody = {
      statusCode: isSupabaseError ? HttpStatus.SERVICE_UNAVAILABLE : httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      message: clientMessage,
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
