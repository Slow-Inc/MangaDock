import Image from "next/image";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export default function MangaDockLogo({ className = "h-10" }: LogoProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      {/* The artwork's "Manga" is near-white: on a light theme the ink variant shows instead (globals.css, #1048) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/MangaDock.svg"
        alt="MangaDock"
        className="md-logo-on-dark h-full w-auto object-contain"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/MangaDock-light.svg"
        alt="MangaDock"
        className="md-logo-on-light h-full w-auto object-contain"
      />
    </div>
  );
}
