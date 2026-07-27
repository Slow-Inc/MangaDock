import { Module } from '@nestjs/common';
import { ContentReportsController } from './content-reports.controller';
import { ContentReportsService } from './content-reports.service';

@Module({
  controllers: [ContentReportsController],
  providers: [ContentReportsService],
})
export class ContentReportsModule {}
