import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const VALID_TYPES = ['post', 'manga', 'translation'] as const;
export const VALID_REASONS = [
  'spam',
  'inappropriate',
  'misinformation',
  'copyright',
  'other',
] as const;

export type ReportContentType = (typeof VALID_TYPES)[number];
export type ReportReason = (typeof VALID_REASONS)[number];

/**
 * `details`/`contentId` had no length cap, so a single authenticated user could
 * store arbitrarily large report rows (#659).
 */
export class SubmitReportDto {
  @IsIn(VALID_TYPES)
  contentType: ReportContentType;

  @IsString()
  @MinLength(1, { message: 'contentId required' })
  @MaxLength(200)
  contentId: string;

  @IsIn(VALID_REASONS)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}
