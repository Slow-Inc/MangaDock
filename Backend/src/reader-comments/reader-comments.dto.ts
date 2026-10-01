import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

/**
 * `page` used to be forwarded as `Number(page)`, so a missing or non-numeric
 * value reached PostgREST as `NaN` and 500'd with
 * `invalid input syntax for integer: NaN`. Validating it here turns that into a
 * 400 (#658).
 */
export class GetCommentsQueryDto {
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
  page: number;
}

export class AddCommentDto {
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

  @IsString()
  @MinLength(1, { message: 'Comment must not be empty' })
  @MaxLength(2000)
  body: string;
}
