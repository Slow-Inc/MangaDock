import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { CONTENT_LEVELS, type ContentLevel } from '../common/content-rating';

/** PUT /users/me/content-settings (#1101). The gate itself lives in applyLevelChange. */
export class ContentSettingsDto {
  @IsIn(CONTENT_LEVELS)
  level!: ContentLevel;

  @IsOptional()
  @IsBoolean()
  confirmAge?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptTos?: boolean;
}
