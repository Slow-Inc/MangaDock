import {
  IsBoolean,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PushDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[A-Za-z0-9_-]+$/)
  deviceId!: string;

  @IsIn(['expo']) provider!: 'expo';
  @IsIn(['android', 'ios']) platform!: 'android' | 'ios';

  @IsString()
  @Matches(/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{1,200}\]$/)
  token!: string;
}

export class PushPreferencesDto {
  @IsBoolean() newChapter!: boolean;
  @IsBoolean() newFollower!: boolean;
}
