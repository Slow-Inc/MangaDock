"use client";

/**
 * A mascot from `bot-avatars` (MIT, Jakub Antalik). Canvas 2-D, no WebGL; the library pauses off-screen,
 * respects reduced motion and sets role="img" — we pass a Thai label for it.
 */
import { memo, useMemo, useState } from "react";
import { BotAvatar, type BotAvatarState } from "bot-avatars";
import { CAST, mascotFromUid, type MascotArea, type MascotConfig } from "../../lib/mascot";

const LABEL: Record<BotAvatarState, string> = {
  default: "มาสคอต",
  working: "มาสคอตกำลังทำงาน",
  sleeping: "มาสคอตกำลังพัก",
};

/**
 * Memoised: bot-avatars redraws even a paused avatar on every render of its parent, and avatars sit in
 * busy parents (the reader, the navbar). Pass a stable `config` (useMemo) for the memo to hold.
 */
const Mascot = memo(function Mascot({
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
});

export default Mascot;

/**
 * The stable mascot of a user who has no profile photo (Epic D: "users who never dressed one get a
 * stable mascot from their uid") — stands in for the initial-letter avatar. Still by default: avatars
 * sit in lists and chips, where a live canvas loop costs a frame budget each. `liveOnHover` (a profile
 * header) wakes it only while the pointer is over `className`'s box; a chip that owns its own hover
 * passes `paused` instead.
 */
export const UidMascot = memo(function UidMascot({
  uid,
  size,
  paused = true,
  liveOnHover = false,
  className,
}: {
  uid: string;
  size: number;
  paused?: boolean;
  liveOnHover?: boolean;
  /** The wrapper box (the hover area with `liveOnHover`). */
  className?: string;
}) {
  const config = useMemo(() => mascotFromUid(uid), [uid]);
  const [hover, setHover] = useState(false);
  return (
    <span
      className={className}
      onPointerEnter={liveOnHover ? () => setHover(true) : undefined}
      onPointerLeave={liveOnHover ? () => setHover(false) : undefined}
    >
      <Mascot config={config} size={size} paused={paused && !hover} interactive={false} label="มาสคอตประจำตัว" />
    </span>
  );
});
