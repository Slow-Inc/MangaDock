import { IsBoolean, IsIn, IsOptional, Matches } from 'class-validator';

/**
 * A user's mascot (bot-avatars config, Frontend `lib/mascot.ts`). It renders on other users' screens,
 * so every field is allow-listed — keep these lists in step with the Frontend's MASCOT_* lists.
 */
export const MASCOT_TYPES = [
  'clover',
  'flower',
  'triangle',
  'square',
  'blob',
  'ghost',
  'circle',
  'drop',
  'star',
  'droid',
  'mech',
  'alien',
  'hexagon',
  'cat',
  'cloud',
  'pill',
  'pebble',
  'puddle',
] as const;
export const MASCOT_FACES = ['eyes', 'mouth'] as const;
export const MASCOT_HATS = [
  'none',
  'beret',
  'beanie',
  'party',
  'crown',
] as const;
export const MASCOT_GLASSES = ['none', 'round', 'square', 'shades'] as const;

const HEX = /^#[0-9a-f]{6}$/i;

export class MascotDto {
  @IsIn(MASCOT_TYPES)
  type!: (typeof MASCOT_TYPES)[number];

  @IsIn(MASCOT_FACES)
  face!: (typeof MASCOT_FACES)[number];

  @IsIn(MASCOT_HATS)
  hat!: (typeof MASCOT_HATS)[number];

  @IsIn(MASCOT_GLASSES)
  glasses!: (typeof MASCOT_GLASSES)[number];

  @IsBoolean()
  headphones!: boolean;

  @IsBoolean()
  bowTie!: boolean;

  @IsOptional()
  @Matches(HEX)
  color?: string;

  @IsOptional()
  @Matches(HEX)
  accessoryColor?: string;
}
