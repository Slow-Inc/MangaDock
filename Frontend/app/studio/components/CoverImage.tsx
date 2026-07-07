"use client";

import { useState } from "react";
import Image from "next/image";

interface CoverImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSize?: number; // emoji font-size in px, default 32
}

export function CoverImage({ src, alt, className = "", fallbackSize = 32 }: CoverImageProps) {
  const [imgError, setImgError] = useState(false);

  if (imgError || !src) {
    return (
      <div className={`flex items-center justify-center bg-white/5 ${className}`}>
        <span style={{ fontSize: fallbackSize }}>📚</span>
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
