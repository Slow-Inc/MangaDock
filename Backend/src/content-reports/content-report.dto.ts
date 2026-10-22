import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * POST /content-reports — typed and bounded so a wrong type is a 400, not a 500 (#1015). The type and reason
 * allow-lists stay in ContentReportsService.
 */
export class SubmitReportDto {
  @IsString()
  @MaxLength(50)
  contentType!: string;

  @IsString()
  @MaxLength(100)
  contentId!: string;

  @IsString()
  @MaxLength(50)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  details?: string;
}
