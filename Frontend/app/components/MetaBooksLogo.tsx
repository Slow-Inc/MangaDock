interface LogoProps {
  className?: string;
  showText?: boolean;
}

export default function MetaBooksLogo({ className = "h-10", showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* ---- Icon: Full Symmetrical Infinity ---- */}
      <svg
        viewBox="0 0 100 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto aspect-2/1"
      >
        <defs>
          <linearGradient id="meta-infinity-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1E3A8A" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>

          <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="
                0 0 0 0 0.117647
                0 0 0 0 0.227451
                0 0 0 0 0.541176
                0 0 0 0.3 0"
              result="glowColor"
            />
            <feMerge>
              <feMergeNode in="glowColor" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d="M 20 25 C 20 5, 45 5, 50 25 C 55 45, 80 45, 80 25 C 80 5, 55 5, 50 25 C 45 45, 20 45, 20 25 Z"
          stroke="url(#meta-infinity-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#soft-glow)"
        />
      </svg>

      {/* ---- Text ---- */}
      {showText && (
        <span className="text-lg font-extrabold leading-none tracking-tight text-white sm:text-xl md:text-2xl">
          Meta<span className="font-medium text-blue-400">Books</span>
        </span>
      )}
    </div>
  );
}
