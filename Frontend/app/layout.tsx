import type { Metadata, Viewport } from "next";
import { Anuphan, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "./contexts/ToastContext";
import { AuthProvider } from "./contexts/AuthContext";
import SupabaseGuard from "./components/SupabaseGuard";
import DevImageCacheToggle from "./components/DevImageCacheToggle";
import SmoothScrolling from "./components/SmoothScrolling";
import SkipLink from "./components/SkipLink";
import DailyCheckinModal from "./components/DailyCheckinModal";
import ContentLevelSync from "./components/ContentLevelSync";
import { themeBootScript } from "./lib/theme";
import { SITE_TITLE } from "./lib/siteTitle";

// Strata type system (system-design ch. 02 §2.4): Inter for Latin, Anuphan for Thai glyphs,
// JetBrains Mono for labels and numbers, Instrument Serif for at most one statement word per page.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const anuphan = Anuphan({ variable: "--font-anuphan", subsets: ["thai", "latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: "แพลตฟอร์ม E-Book สไตล์ Netflix ด้วย MangaDex API",
};

// The browser bar matches the default (dark) theme, not the OS preference: MangaDock opens dark.
export const viewport: Viewport = { themeColor: "#0b0b0d" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme and the `js` class are written by the boot script before first paint.
    <html lang="th" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${inter.variable} ${anuphan.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} antialiased`}>
        <SkipLink />
        <SmoothScrolling>
          <ToastProvider>
            <AuthProvider>
              <SupabaseGuard />
              {children}
              <DailyCheckinModal />
              <ContentLevelSync />
              <DevImageCacheToggle />
            </AuthProvider>
          </ToastProvider>
        </SmoothScrolling>
      </body>
    </html>
  );
}
