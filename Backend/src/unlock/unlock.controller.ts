import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import { UnlockService } from './unlock.service';
import type { SupabaseAuthUser } from '../auth/auth.types';

@Controller('unlock')
export class UnlockController {
  constructor(private readonly unlock: UnlockService) {}

  @Get('check/:versionId')
  @UseGuards(AuthGuard)
  async check(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('versionId') versionId: string,
  ) {
    const unlocked = await this.unlock.isUnlocked(req[USER_KEY].uid, versionId);
    return { unlocked };
  }

  @Get('title/:titleId')
  @UseGuards(AuthGuard)
  async getUnlocksForTitle(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('titleId') titleId: string,
  ) {
    return this.unlock.getUnlockedVersions(req[USER_KEY].uid, titleId);
  }

  @Post(':versionId')
  @UseGuards(AuthGuard)
  async purchase(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('versionId') versionId: string,
  ) {
    return this.unlock.purchaseUnlock(req[USER_KEY].uid, versionId);
  }
}
