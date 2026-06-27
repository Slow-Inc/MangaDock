import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { MitWebhookController } from './mit-webhook.controller';
import { PatchesController } from './patches.controller';
import { BooksService } from './books.service';
import { MangaDexService } from './mangadex.service';
import { MitClient } from './mit-client';
import { StatusModule } from '../status/status.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [StatusModule, CacheModule],
  controllers: [BooksController, MitWebhookController, PatchesController],
  providers: [BooksService, MangaDexService, MitClient],
  exports: [BooksService],
})
export class BooksModule {}
