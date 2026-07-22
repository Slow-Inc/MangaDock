import { Module } from '@nestjs/common';
import { ReaderCommentsController } from './reader-comments.controller';
import { ReaderCommentsService } from './reader-comments.service';

@Module({
  controllers: [ReaderCommentsController],
  providers: [ReaderCommentsService],
})
export class ReaderCommentsModule {}
