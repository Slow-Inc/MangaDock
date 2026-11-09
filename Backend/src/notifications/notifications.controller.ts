import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import type { SupabaseAuthUser } from '../auth/auth.types';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { PushDeviceDto, PushPreferencesDto } from './push.dto';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifs: NotificationsService,
    private readonly push: PushService,
  ) {}

  @Put('push-devices')
  registerPush(
    @Req()
    req: Request & {
      [USER_KEY]: SupabaseAuthUser;
      headers: Record<string, string>;
    },
    @Body() dto: PushDeviceDto,
  ) {
    if (req.headers['x-hardware-id'] !== dto.deviceId)
      throw new BadRequestException('Device header mismatch');
    return this.push.register(req[USER_KEY].uid, dto);
  }

  @Delete('push-devices')
  @HttpCode(204)
  removePush(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body() dto: PushDeviceDto,
  ) {
    return this.push.remove(req[USER_KEY].uid, dto);
  }

  @Get('push-preferences')
  pushPreferences(@Req() req: Request & { [USER_KEY]: SupabaseAuthUser }) {
    return this.push.preferences(req[USER_KEY].uid);
  }

  @Put('push-preferences')
  savePushPreferences(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body() dto: PushPreferencesDto,
  ) {
    return this.push.savePreferences(req[USER_KEY].uid, dto);
  }

  @Get()
  getNotifications(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Query('limit') limit?: string,
  ) {
    return this.notifs.getNotifications(
      req[USER_KEY].uid,
      limit ? Math.min(Number(limit), 50) : 30,
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
