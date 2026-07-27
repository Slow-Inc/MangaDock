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
import { TranslationFeedbackService } from './translation-feedback.service';

@Controller('translation-feedback')
export class TranslationFeedbackController {
  constructor(private readonly svc: TranslationFeedbackService) {}

  @Get('summary')
  getSummary(
    @Query('mangaId') mangaId: string,
    @Query('chapterId') chapterId: string,
  ) {
    return this.svc.getChapterSummary(mangaId, chapterId);
  }

  @Get('my')
  @UseGuards(AuthGuard)
  getMyVote(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Query('mangaId') mangaId: string,
    @Query('chapterId') chapterId: string,
    @Query('page') page: string,
  ) {
    return this.svc.getMyVote(req[USER_KEY].uid, mangaId, chapterId, Number(page));
  }

  @Post()
  @UseGuards(AuthGuard)
  submitVote(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body() body: { mangaId: string; chapterId: string; pageNumber: number; vote: 1 | -1 },
  ) {
    return this.svc.submitVote(
      req[USER_KEY].uid,
      body.mangaId,
      body.chapterId,
      body.pageNumber,
      body.vote,
    );
  }

  @Delete()
  @UseGuards(AuthGuard)
  deleteVote(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Query('mangaId') mangaId: string,
    @Query('chapterId') chapterId: string,
    @Query('page') page: string,
  ) {
    return this.svc.deleteVote(req[USER_KEY].uid, mangaId, chapterId, Number(page));
  }
}
