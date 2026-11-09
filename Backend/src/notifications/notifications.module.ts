import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { PushWorker } from './push.worker';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService, PushWorker],
  exports: [NotificationsService],
})
export class NotificationsModule {}
