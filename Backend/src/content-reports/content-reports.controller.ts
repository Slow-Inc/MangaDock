import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, USER_KEY } from '../auth/auth.guard';
import type { SupabaseAuthUser } from '../auth/auth.types';
import { SubmitReportDto } from './content-reports.dto';
import { ContentReportsService } from './content-reports.service';

@Controller('content-reports')
@UseGuards(AuthGuard)
export class ContentReportsController {
  constructor(private readonly svc: ContentReportsService) {}

  @Post()
  submit(
    @Req() req: Request & { [USER_KEY]: SupabaseAuthUser },
    @Body() body: SubmitReportDto,
  ) {
    return this.svc.submitReport(req[USER_KEY].uid, body);
  }
}
