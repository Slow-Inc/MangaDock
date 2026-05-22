import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class StructuredLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Observability');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.url;
    const taskId = req.headers['x-task-id'] || (req as any).hardwareId || 'none';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - now;
          this.log(method, url, duration, taskId, 'success');
        },
        error: (err) => {
          const duration = Date.now() - now;
          this.log(method, url, duration, taskId, 'error', err.message);
        },
      }),
    );
  }

  private log(
    method: string,
    url: string,
    duration: number,
    taskId: string,
    status: string,
    errorMessage?: string,
  ) {
    // T4-STANDARD Pillar 6: Structured Logging
    const logData = {
      timestamp: new Date().toISOString(),
      service: 'backend',
      task_id: taskId,
      event: `${method} ${url}`,
      duration_ms: duration,
      status: status,
      ...(errorMessage && { error: errorMessage }),
    };

    // In a real T4 environment, this would be sent to a log aggregator.
    // For now, we print it as a JSON string to stdout.
    console.log(JSON.stringify(logData));
  }
}
