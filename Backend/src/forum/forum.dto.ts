import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { ForumCategory } from './forum.types';

const FORUM_CATEGORIES = [
  'general',
  'announcement',
  'spoiler',
  'manga_update',
] as const;

export class CreatePostDto {
  @IsString()
  @MinLength(1, { message: 'Title must not be empty' })
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(1, { message: 'Content must not be empty' })
  @MaxLength(10_000)
  content: string;

  @IsIn(FORUM_CATEGORIES)
  category: ForumCategory;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetMangaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetMangaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  targetMangaCover?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  imageUrls?: string[];
}

export class CreateCommentDto {
  @IsUUID()
  postId: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsString()
  @MinLength(1, { message: 'Content must not be empty' })
  @MaxLength(5_000)
  content: string;
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  content?: string;
}

export class UpdateCommentDto {
  @IsString()
  @MinLength(1, { message: 'Content must not be empty' })
  @MaxLength(5_000)
  content: string;
}

export class VoteDto {
  @IsIn(['post', 'comment'])
  targetType: 'post' | 'comment';

  @IsUUID()
  targetId: string;

  @IsIn([1, -1])
  voteValue: 1 | -1;
}

export class UpdateBannerPositionDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @Type(() => Number)
  position: number;
}
