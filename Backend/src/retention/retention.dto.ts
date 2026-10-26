import { Type, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class FeedQuery {
  @IsIn(['following', 'personalized'])
  @IsOptional()
  mode: 'following' | 'personalized' = 'following';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  @IsOptional()
  offset = 0;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit = 20;
}

export class CollectionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(1000)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  description = '';

  @IsIn(['public', 'private'])
  @ValidateIf((_object, value: unknown) => value !== undefined)
  visibility: 'public' | 'private' = 'private';
}

export class CollectionItemDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,200}$/)
  mangaId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;
}
