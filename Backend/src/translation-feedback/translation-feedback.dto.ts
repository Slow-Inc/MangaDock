import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SummaryQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  mangaId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  chapterId: string;
}

/** `page` reached PostgREST as `NaN` when missing/non-numeric → 500 (#658). */
export class PageQueryDto extends SummaryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page: number;
}

export class SubmitVoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  mangaId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  chapterId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  pageNumber: number;

  /**
   * `getChapterSummary` buckets votes as `vote > 0 ? up : down`, so any value
   * other than ±1 skews the public translation-quality stats (#655).
   */
  @Type(() => Number)
  @IsIn([1, -1])
  vote: 1 | -1;
}
