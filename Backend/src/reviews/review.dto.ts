import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** POST /reviews/:mangaId — typed and bounded so a wrong type is a 400, not a 500 (#1015). */
export class UpsertReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mangaTitle?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  body?: string;
}
