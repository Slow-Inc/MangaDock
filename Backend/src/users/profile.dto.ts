import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/*
 * Profile bodies, typed and bounded (#1025): the JSON limit is 50 MB, and display_name / photo_url are joined into
 * every forum feed. Limits sit above anything the current UI sends.
 */

/** PATCH /users/me */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  photoURL?: string;
}

/** POST /users/me/become-translator and PATCH /users/me/translator-profile */
export class TranslatorProfileDto {
  /** The service already keeps 500; longer is refused instead of cut silently. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  /** The studio offers 13; the service keeps the first 10. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(35, { each: true })
  translatorLanguages?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(35)
  preferredLanguage?: string;
}

/** POST /users/me/photo-history */
export class PhotoHistoryDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  photos!: string[];
}
