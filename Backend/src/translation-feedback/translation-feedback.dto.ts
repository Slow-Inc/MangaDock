import {
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** POST /translation-feedback — a vote is exactly 1 or -1; 0 or 5 used to be stored (#1015). */
export class SubmitFeedbackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  mangaId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  chapterId!: string;

  @IsInt()
  @Min(0)
  @Max(10_000)
  pageNumber!: number;

  @IsIn([1, -1])
  vote!: 1 | -1;
}
