"use client";

import { Turnstile } from "@marsidev/react-turnstile";

export interface ReaderCaptchaGateProps {
  passed: boolean;
  exiting: boolean;
  siteKey: string;
  /** Chapter label shown in the "verifying" copy — same text as the reader's top bar. */
  chapterLabel: string;
  onVerify: (token: string) => void;
  children: React.ReactNode;
}

/**
 * Cloudflare Turnstile modal / bottom sheet gating the reader body. Extracted
 * from MangaReader (#582) — verbatim JSX, same class names/animation structure.
 */
export default function ReaderCaptchaGate({ passed, exiting, siteKey, chapterLabel, onVerify, children }: ReaderCaptchaGateProps) {
  return (
    <>
      {(!passed || exiting) && siteKey && (
        <div className={`absolute inset-0 z-[400] flex items-end sm:items-center justify-center sm:pt-16 bg-black/10 backdrop-blur-[2px] transition-opacity duration-300 ${exiting ? "opacity-0" : "opacity-100"}`}>
          <style>{`
            @keyframes mobileSlideUp {
              0% { transform: translateY(100%); opacity: 0; }
              100% { transform: translateY(0); opacity: 1; }
            }
            @keyframes mobileSlideDown {
              0% { transform: translateY(0); opacity: 1; }
              100% { transform: translateY(100%); opacity: 0; }
            }
            @keyframes desktopScaleIn {
              0% { transform: scale(0.95); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes desktopScaleOut {
              0% { transform: scale(1); opacity: 1; }
              100% { transform: scale(0.95); opacity: 0; }
            }
            .animate-captcha-in {
              animation: mobileSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .animate-captcha-out {
              animation: mobileSlideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            }
            @media (min-width: 640px) {
              .animate-captcha-in {
                animation: desktopScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              }
              .animate-captcha-out {
                animation: desktopScaleOut 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
              }
            }
          `}</style>

          <div
            className={`relative flex w-full sm:max-w-sm flex-col items-center overflow-hidden rounded-t-[2rem] sm:rounded-3xl border-t sm:border border-white/10 bg-zinc-950/95 sm:bg-zinc-900 shadow-[0_-10px_60px_-15px_rgba(0,0,0,0.7)] sm:shadow-2xl backdrop-blur-2xl p-6 pb-12 sm:p-8 ${exiting ? "animate-captcha-out" : "animate-captcha-in"}`}
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mb-6 sm:hidden"></div>

            <div className="mb-6 text-center">
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">ยืนยันตัวตน</h3>
              <p className="text-[13px] sm:text-sm text-white/50 px-2 leading-relaxed">
                กำลังตรวจสอบความปลอดภัย<br />
                {chapterLabel}
              </p>
            </div>

            <div className="flex justify-center w-full overflow-hidden rounded-xl border border-white/5 bg-black/50 p-2">
              <Turnstile
                siteKey={siteKey}
                onSuccess={onVerify}
                options={{ theme: "dark" }}
              />
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
