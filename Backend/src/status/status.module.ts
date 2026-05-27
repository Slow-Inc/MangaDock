import { Module } from '@nestjs/common';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { MetricsService } from './metrics.service';
import { ElectionService } from './election.service';

@Module({
  controllers: [StatusController],
  providers: [StatusService, MetricsService, ElectionService],
  exports: [StatusService, MetricsService, ElectionService],
})
export class StatusModule {}
