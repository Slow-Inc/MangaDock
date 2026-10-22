import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import type { SupabaseAuthUser } from '../auth/auth.types';
import { ReaderCommentsService } from './reader-comments.service';
import { AddReaderCommentDto } from './reader-comment.dto';

@Controller('reader-comments')
export class ReaderCommentsController {
  constructor(private readonly svc: ReaderCommentsService) {}

  @Get()
  getComments(
    @Query('mangaId') mangaId: string,
    @Query('chapterId') chapterId: string,
    @Query('page') page: string,
  ) {
    return this.svc.getComments(mangaId, chapterId, Number(page));
  }

  @Post()
  @UseGuards(AuthGuard)
  addComment(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body() body: AddReaderCommentDto,
  ) {
    return this.svc.addComment(
      req[USER_KEY].uid,
      body.mangaId,
      body.chapterId,
      body.pageNumber,
      body.body,
    );
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  deleteComment(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('id') id: string,
  ) {
    return this.svc.deleteComment(req[USER_KEY].uid, id);
  }
}
