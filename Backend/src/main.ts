import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import * as path from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { StructuredLoggingInterceptor } from './common/interceptors/structured-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
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
