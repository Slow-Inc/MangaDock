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
import { AddCommentDto, GetCommentsQueryDto } from './reader-comments.dto';
import { ReaderCommentsService } from './reader-comments.service';

@Controller('reader-comments')
export class ReaderCommentsController {
  constructor(private readonly svc: ReaderCommentsService) {}

  @Get()
  getComments(@Query() query: GetCommentsQueryDto) {
    return this.svc.getComments(query.mangaId, query.chapterId, query.page);
  }

  @Post()
  @UseGuards(AuthGuard)
  addComment(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body() body: AddCommentDto,
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
