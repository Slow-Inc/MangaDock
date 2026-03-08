import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // Serve cached images from .cache/images/ under /img-cache/
  app.useStaticAssets(path.resolve(process.cwd(), '.cache', 'images'), {
    prefix: '/img-cache/',
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
