import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { StructuredLoggingInterceptor } from './common/interceptors/structured-logging.interceptor';

/**
 * Tee every byte written to stdout/stderr into a daily rotating log file.
 * Must be called before NestFactory.create so startup logs are captured.
 */
function setupFileLogging(): void {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const logsDir = path.resolve(process.cwd(), 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const logPath = path.join(logsDir, `backend-${date}.log`);
  const stream = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' });

  // Write session separator so multiple restarts are distinguishable in the file
  stream.write(`\n${'='.repeat(72)}\n[session start] ${new Date().toISOString()}\n${'='.repeat(72)}\n`);

  const stripAnsi = (s: string) => s.replace(/\x1b\[[\d;]*[A-Za-z]/g, '');

  for (const pipe of [process.stdout, process.stderr] as NodeJS.WriteStream[]) {
    const orig = pipe.write.bind(pipe);
    (pipe as any).write = (chunk: any, ...args: any[]): boolean => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      stream.write(stripAnsi(text));
      return orig(chunk, ...args);
    };
  }
}

async function bootstrap() {
  setupFileLogging();
  // Disable built-in 100KB body-parser limit; MIT webhook bodies contain base64 PNG patches (~1-3MB).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // verify hook captures the raw request bytes so the MIT webhook controller can
  // check the HMAC over exactly what MIT signed (#95 S1) — re-serializing the
  // parsed body is not byte-stable across JSON implementations.
  app.use(
    json({
      limit: '50mb',
      verify: (req, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));
  app.useGlobalInterceptors(new StructuredLoggingInterceptor());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:4000',
      'http://127.0.0.1:4000',
    ],
    credentials: true,
  });

  // Serve cached images from img-cache/ under /img-cache/
  app.useStaticAssets(path.resolve(process.cwd(), 'img-cache'), {
    prefix: '/img-cache/',
  });

  // Serve translated patch overlays from uploads/ under /uploads/
  app.useStaticAssets(path.resolve(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Enable graceful shutdown hooks (T4-STANDARD Pillar 3)
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 4001);
}
bootstrap();
