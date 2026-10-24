import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** POST /reader-comments — typed and bounded so a wrong type is a 400, not a 500 (#1015). */
export class AddReaderCommentDto {
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

  @IsString()
  @MaxLength(5_000)
  body!: string;
}
