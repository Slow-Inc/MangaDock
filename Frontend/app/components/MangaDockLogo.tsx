import Image from "next/image";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export default function MangaDockLogo({ className = "h-10" }: LogoProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/MangaDock.svg"
        alt="MangaDock"
        className="h-full w-auto object-contain"
      />
    </div>
  );
}
