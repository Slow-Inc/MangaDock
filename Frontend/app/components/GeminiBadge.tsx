// Gemini "Translated by AI" badge
export default function GeminiBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      title="แปลโดย Gemini AI"
      className={`inline-flex items-center gap-1 rounded-full border border-[#4285f4]/30 bg-[#4285f4]/10 font-medium text-[#8ab4f8] ${
        small ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      {/* Gemini star icon (simplified) */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={small ? "h-2.5 w-2.5" : "h-3 w-3"}
        aria-hidden
      >
        <path d="M12 2C6.29 9.5 2 10.5 2 12c0 1.5 4.29 2.5 10 10 5.71-7.5 10-8.5 10-10 0-1.5-4.29-2.5-10-10z" />
      </svg>
      Gemini
    </span>
  );
}
