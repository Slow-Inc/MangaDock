"use client";

/**
 * A mascot from `bot-avatars` (MIT, Jakub Antalik). Canvas 2-D, no WebGL; the library pauses off-screen,
 * respects reduced motion and sets role="img" — we pass a Thai label for it.
 */
import { BotAvatar, type BotAvatarState } from "bot-avatars";
import { CAST, type MascotArea, type MascotConfig } from "../../lib/mascot";

const LABEL: Record<BotAvatarState, string> = {
  default: "มาสคอต",
  working: "มาสคอตกำลังทำงาน",
  sleeping: "มาสคอตกำลังพัก",
};

export default function Mascot({
  area,
  config,
  state = "default",
  size = 64,
  paused = false,
  seed,
  interactive = true,
  label,
  className = "",
}: {
  /** The area's own character (CAST); ignored when `config` is given. */
  area?: MascotArea;
  config?: MascotConfig;
  state?: BotAvatarState;
  size?: number;
  /** Long lists render it still. */
  paused?: boolean;
  /** 0–1 offset so a row of mascots does not blink in unison. */
  seed?: number;
  interactive?: boolean;
  label?: string;
  className?: string;
}) {
  const look = config ?? CAST[area ?? "error"];
  return (
    <BotAvatar
      {...look}
      state={state}
      size={size}
      paused={paused}
      seed={seed}
      interactive={interactive}
      theme="auto"
      aria-label={label ?? LABEL[state]}
      className={className}
    />
  );
}
