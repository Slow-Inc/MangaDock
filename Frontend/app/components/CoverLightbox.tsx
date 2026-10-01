"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useModalTransition } from "../hooks/useModalTransition";

interface Props {
  src: string;
  alt: string;
  onClose: () => void;
}

export default function CoverLightbox({ src, alt, onClose }: Props) {
  const { visible, close } = useModalTransition(true, { duration: 300, onClosed: onClose });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [close]);

  const content = (
    <div
      className={`fixed inset-0 z-300 flex items-center justify-center p-6 backdrop-blur-md transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={close}
    >
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/90" />

      {/* Close button */}
      <button
        onClick={close}
        title="ปิด"
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Cover image */}
      <div
        className={`relative z-10 transition-all duration-300 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-h-[88vh] max-w-[80vw] rounded-2xl object-contain shadow-2xl shadow-black/60 ring-1 ring-white/10"
        />
      </div>

      {/* Title caption */}
      <p
        className={`absolute bottom-5 left-0 right-0 text-center text-sm text-white/50 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {alt}
      </p>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
