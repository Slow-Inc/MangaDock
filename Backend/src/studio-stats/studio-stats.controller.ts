import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import type { SupabaseAuthUser } from '../auth/auth.types';
import { StudioStatsService } from './studio-stats.service';

/** GET /studio/stats?days=30 — the signed-in creator's own unlocks, revenue, earnings and uploads per day. */
@Controller('studio')
@UseGuards(AuthGuard)
export class StudioStatsController {
  constructor(private readonly stats: StudioStatsService) {}

  @Get('stats')
  getStats(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Query('days') days?: string,
  ) {
    return this.stats.getStats(req[USER_KEY].uid, Number(days ?? 30));
  }
}
