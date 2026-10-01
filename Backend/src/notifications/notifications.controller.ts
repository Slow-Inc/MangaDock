import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import type { SupabaseAuthUser } from '../auth/auth.types';
import { clampInt } from '../common/query-params';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifs: NotificationsService) {}

  @Get()
  getNotifications(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Query('limit') limit?: string,
  ) {
    return this.notifs.getNotifications(
      req[USER_KEY].uid,
      clampInt(limit, 30, 1, 50),
    );
  }

  @Get('unread-count')
  getUnreadCount(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.notifs
      .getUnreadCount(req[USER_KEY].uid)
      .then((count) => ({ count }));
  }

  @Patch('read-all')
  markAllRead(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.notifs.markAllRead(req[USER_KEY].uid);
  }

  @Patch(':id/read')
  markRead(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Param('id') id: string,
  ) {
    return this.notifs.markRead(req[USER_KEY].uid, id);
  }
}
