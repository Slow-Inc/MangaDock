"use client";

/**
 * One avatar for every user surface (Epic D #781): the user's photo, or — with no photo, a blocked URL,
 * or a photo that fails to load — their stable uid mascot instead of an empty circle or initials.
 * A plain <img>: avatar hosts are arbitrary (OAuth CDNs, our uploads), so next/image's allow-list does
 * not fit (CLAUDE.md "<img> vs <Image>"). The mascot is still (lists hold many of these).
 */
import { useState } from "react";
import { UidMascot } from "../mascot/Mascot";
import { avatarSource } from "../../lib/avatarSource";

export default function UserAvatar({
  uid,
  photoUrl,
  size,
  className = "",
}: {
  uid: string;
  photoUrl?: string | null;
  size: number;
  className?: string;
}) {
  const src = avatarSource(photoUrl);
  const [failed, setFailed] = useState<string | null>(null);
  const box = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-fill ${className}`;
  return (
    <span className={box} style={{ width: size, height: size }}>
      {src && failed !== src ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary avatar hosts; see the header
        <img src={src} alt="" width={size} height={size} loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(src)} />
      ) : (
        <UidMascot uid={uid} size={Math.round(size * 0.92)} />
      )}
    </span>
  );
}
