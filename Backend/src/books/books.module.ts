import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { MitWebhookController } from './mit-webhook.controller';
import { BooksService } from './books.service';
import { MangaDexService } from './mangadex.service';
import { StatusModule } from '../status/status.module';

@Module({
  imports: [StatusModule],
  controllers: [BooksController, MitWebhookController],
  providers: [BooksService, MangaDexService],
  exports: [BooksService],
})
export class BooksModule {}
