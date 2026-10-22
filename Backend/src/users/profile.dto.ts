import {
  ArrayMaxSize,
  IsArray,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/*
 * Profile bodies, typed and bounded (#1025): the JSON limit is 50 MB, and display_name / photo_url are joined into
 * every forum feed. Limits sit above anything the current UI sends. A field may be absent but not null: the service
 * stores it or calls a string method on it.
 */

/** Shared with UsersService.upsertUser, which takes the same two fields from the login token. */
export const PROFILE_LIMITS = { displayName: 100, photoURL: 2048 } as const;

const unlessAbsent = ValidateIf((_, v) => v !== undefined);

/** PATCH /users/me */
export class UpdateProfileDto {
  @unlessAbsent
  @IsString()
  @MaxLength(PROFILE_LIMITS.displayName)
  displayName?: string;

  @unlessAbsent
  @IsString()
  @MaxLength(PROFILE_LIMITS.photoURL)
  photoURL?: string;
}

/** POST /users/me/become-translator and PATCH /users/me/translator-profile */
export class TranslatorProfileDto {
  /** The service already keeps 500; longer is refused instead of cut silently. */
  @unlessAbsent
  @IsString()
  @MaxLength(500)
  bio?: string;

  /** The studio offers 13; the service keeps the first 10. */
  @unlessAbsent
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(35, { each: true })
  translatorLanguages?: string[];

  @unlessAbsent
  @IsString()
  @MaxLength(100)
  country?: string;

  @unlessAbsent
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
