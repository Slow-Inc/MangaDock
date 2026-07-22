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
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get(':mangaId/summary')
  getSummary(@Param('mangaId') mangaId: string) {
    return this.reviews.getReviewSummary(mangaId);
  }

  @Get(':mangaId')
  getReviews(
    @Param('mangaId') mangaId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.reviews.getReviews(
      mangaId,
      limit ? Math.min(Number(limit), 50) : 20,
      offset ? Number(offset) : 0,
    );
  }

  @Get(':mangaId/my')
  @UseGuards(AuthGuard)
  getMyReview(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('mangaId') mangaId: string,
  ) {
    return this.reviews.getMyReview(req[USER_KEY].uid, mangaId);
  }

  @Post(':mangaId')
  @UseGuards(AuthGuard)
  upsertReview(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('mangaId') mangaId: string,
    @Body() body: { mangaTitle: string; rating: number; body: string },
  ) {
    return this.reviews.upsertReview(req[USER_KEY].uid, mangaId, body);
  }

  @Delete(':mangaId')
  @UseGuards(AuthGuard)
  deleteReview(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('mangaId') mangaId: string,
  ) {
    return this.reviews.deleteReview(req[USER_KEY].uid, mangaId);
  }
}
