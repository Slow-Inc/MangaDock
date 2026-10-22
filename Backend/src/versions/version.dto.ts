import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** The price column is an int4: beyond this an insert fails (a 500). A database bound, not a product limit. */
const INT4_MAX = 2_147_483_647;

/** POST /versions — the same price rule as PATCH (no negatives, whole coins) and typed, bounded strings (#1017). */
export class CreateVersionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  titleId!: string;

  @IsString()
  @MaxLength(500)
  titleName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  titleAltName?: string;

  /** Optional: the service mints one when absent (the studio's CreateVersionInput leaves it out). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  chapterId?: string;

  @IsString()
  @MaxLength(20)
  chapterNumber!: string;

  @IsString()
  @MaxLength(500)
  chapterTitle!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  language!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  priceCoins?: number;
}

/** PATCH /versions/:versionId — same bounds as create (#1017). */
export class UpdateVersionMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  priceCoins?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  titleAltName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  chapterTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  chapterNumber?: string;
}
