"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen } from "lucide-react";

interface CoverImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSize?: number; // fallback icon size in px, default 32
}

export function CoverImage({ src, alt, className = "", fallbackSize = 32 }: CoverImageProps) {
  const [imgError, setImgError] = useState(false);

  if (imgError || !src) {
    return (
      <div className={`flex items-center justify-center bg-fill ${className}`}>
        <BookOpen aria-hidden className="text-ink-3" style={{ width: fallbackSize, height: fallbackSize }} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        onError={() => setImgError(true)}
        sizes="(max-width: 768px) 100vw, 200px"
      />
    </div>
  );
}
