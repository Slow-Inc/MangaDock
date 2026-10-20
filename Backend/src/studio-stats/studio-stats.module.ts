import { Module } from '@nestjs/common';
import { StudioStatsController } from './studio-stats.controller';
import { StudioStatsService } from './studio-stats.service';

@Module({
  controllers: [StudioStatsController],
  providers: [StudioStatsService],
})
export class StudioStatsModule {}
