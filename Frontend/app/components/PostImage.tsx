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

export default function PostImage({ url, alt, className = "", priority = false, sizes }: { url: string; alt: string; className?: string; priority?: boolean; sizes?: string }) {
  const src = safeImageSrc(url);
  // Resize only our own /uploads files, and only where the caller knows the box (`sizes`); remote hosts
  // outside next.config's remotePatterns would make the optimizer refuse them.
  const optimize = !!sizes && !!src?.startsWith("/");
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    return (
      <div role="img" aria-label={`${alt} (โหลดไม่ได้)`} className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-fill text-ink-2">
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
      sizes={sizes}
      unoptimized={!optimize}
      className={`object-cover ${className}`}
      onError={() => setFailed(src)}
    />
  );
}
