import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { LangProvider } from "@/components/lang-provider";
import { AuthGate } from "@/components/auth-gate";
import type { Lang } from "@/lib/i18n";
import "./globals.css";

export const metadata = {
  title: "MIT Dashboard",
  description: "Standalone mission-control dashboard for the MIT pipeline (PRD #279, ADR 016)",
};

const NO_FLASH = `try{if(localStorage.theme==='light')document.documentElement.classList.add('light')}catch(e){}`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang: Lang = (await cookies()).get("lang")?.value === "th" ? "th" : "en";
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body>
        <LangProvider initial={lang}>
          <AuthGate>{children}</AuthGate>
        </LangProvider>
      </body>
    </html>
  );
}
