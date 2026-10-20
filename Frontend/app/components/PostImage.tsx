"use client";

/**
 * A forum post image (#806): the URL goes through the CLAUDE.md scheme guard, and a blocked URL or a load
 * error shows a quiet designed fallback instead of the browser's broken glyph and alt text. Fills its
 * positioned parent like `<Image fill>`, so callers keep their boxes.
 */
import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { safeImageSrc } from "../lib/safeUrl";

export default function PostImage({ url, alt, className = "", priority = false }: { url: string; alt: string; className?: string; priority?: boolean }) {
  const src = safeImageSrc(url);
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    return (
      <div role="img" aria-label={`${alt} (โหลดไม่ได้)`} className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-fill text-ink-3">
        <ImageOff aria-hidden className="h-6 w-6" strokeWidth={1.5} />
        <span className="text-xs">โหลดรูปไม่ได้</span>
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      loading={priority ? undefined : "lazy"}
      priority={priority}
      unoptimized
      className={`object-cover ${className}`}
      onError={() => setFailed(src)}
    />
  );
}
