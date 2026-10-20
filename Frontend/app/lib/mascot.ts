/**
 * Mascots from `bot-avatars` (MIT, Jakub Antalik — https://libraries.dev/bots.html).
 * The cast gives each area one character; users can dress their own (redesign spec, Epic D).
 * Allow-lists are kept here (type-checked against the library's own types) so a config that renders on
 * another user's screen can only ever hold known values.
 */
import type { BotAvatarFace, BotAvatarGlasses, BotAvatarHat, BotAvatarType } from "bot-avatars";

export const MASCOT_TYPES = [
  "clover", "flower", "triangle", "square", "blob", "ghost", "circle", "drop", "star",
  "droid", "mech", "alien", "hexagon", "cat", "cloud", "pill", "pebble", "puddle",
] as const satisfies readonly BotAvatarType[];
export const MASCOT_FACES = ["eyes", "mouth"] as const satisfies readonly BotAvatarFace[];
export const MASCOT_HATS = ["none", "beret", "beanie", "party", "crown"] as const satisfies readonly BotAvatarHat[];
export const MASCOT_GLASSES = ["none", "round", "square", "shades"] as const satisfies readonly BotAvatarGlasses[];

export type MascotConfig = {
  type: BotAvatarType;
  face: BotAvatarFace;
  hat: BotAvatarHat;
  glasses: BotAvatarGlasses;
  headphones: boolean;
  bowTie: boolean;
  /** Body colour; the type's own colour when left out. */
  color?: string;
  accessoryColor?: string;
};

export type MascotArea = "reader" | "search" | "community" | "studio" | "wallet" | "login" | "error";

const look = (type: BotAvatarType, rest: Partial<MascotConfig> = {}): MascotConfig => ({
  type,
  face: "eyes",
  hat: "none",
  glasses: "none",
  headphones: false,
  bowTie: false,
  ...rest,
});

/** One character per area, so people learn "this one lives here". */
export const CAST: Record<MascotArea, MascotConfig> = {
  reader: look("droid", { headphones: true, glasses: "round" }),
  search: look("ghost", { glasses: "shades" }),
  community: look("cat", { hat: "party", face: "mouth" }),
  studio: look("mech", { hat: "beret", glasses: "square" }),
  wallet: look("star", { hat: "crown" }),
  login: look("clover", { bowTie: true }),
  error: look("pebble"),
};

/** FNV-1a — small, stable across runtimes; only used to pick a default look, never for security. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** A stable mascot for a user who never dressed one. */
export function mascotFromUid(uid: string): MascotConfig {
  const h = hash(uid);
  const pick = <T,>(list: readonly T[], shift: number) => list[(h >>> shift) % list.length];
  return look(pick(MASCOT_TYPES, 0), {
    face: pick(MASCOT_FACES, 5),
    hat: pick(MASCOT_HATS, 9),
    glasses: pick(MASCOT_GLASSES, 13),
    headphones: ((h >>> 17) & 3) === 0,
    bowTie: ((h >>> 20) & 3) === 0,
  });
}

const HEX = /^#[0-9a-f]{6}$/i;
const isIn = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);

/** Returns a clean config or null. Unknown keys are dropped; any bad value rejects the whole config. */
export function sanitizeMascot(input: unknown): MascotConfig | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (!isIn(MASCOT_TYPES, o.type) || !isIn(MASCOT_FACES, o.face) || !isIn(MASCOT_HATS, o.hat) || !isIn(MASCOT_GLASSES, o.glasses)) return null;
  if (typeof o.headphones !== "boolean" || typeof o.bowTie !== "boolean") return null;
  for (const k of ["color", "accessoryColor"] as const) {
    if (o[k] !== undefined && (typeof o[k] !== "string" || !HEX.test(o[k] as string))) return null;
  }
  const out: MascotConfig = { type: o.type, face: o.face, hat: o.hat, glasses: o.glasses, headphones: o.headphones, bowTie: o.bowTie };
  if (o.color !== undefined) out.color = o.color as string;
  if (o.accessoryColor !== undefined) out.accessoryColor = o.accessoryColor as string;
  return out;
}
