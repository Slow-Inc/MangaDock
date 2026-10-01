import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Without a decorated DTO the global ValidationPipe is a no-op, so `rating` was
 * only guarded by `rating < 1 || rating > 5` — which `undefined`/`null` and
 * floats both slip past (#654, #656).
 */
export class UpsertReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  mangaTitle?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;
}
