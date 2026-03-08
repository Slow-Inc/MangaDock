import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { GoogleBooksService } from './google-books.service';
import { MangaDexService } from './mangadex.service';
import { StatusModule } from '../status/status.module';

@Module({
  imports: [StatusModule],
  controllers: [BooksController],
  providers: [BooksService, GoogleBooksService, MangaDexService],
  exports: [BooksService],
})
export class BooksModule {}
