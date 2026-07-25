import { Module } from '@nestjs/common';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';

@Module({
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckinModule {}
