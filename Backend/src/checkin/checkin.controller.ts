import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import type { SupabaseAuthUser } from '../auth/auth.types';
import { CheckinService } from './checkin.service';

@Controller('checkin')
@UseGuards(AuthGuard)
export class CheckinController {
  constructor(private readonly svc: CheckinService) {}

  @Get('status')
  status(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.svc.getStatus(req[USER_KEY].uid);
  }

  @Post()
  claim(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.svc.claimCheckin(req[USER_KEY].uid);
  }
}
