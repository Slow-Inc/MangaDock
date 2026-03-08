import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "./contexts/ToastContext";
import { AuthProvider } from "./contexts/AuthContext";
import DevImageCacheToggle from "./components/DevImageCacheToggle";
import SmoothScrolling from "./components/SmoothScrolling";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "MetaBooks by Hayate | Manga Streaming Platform",
  description: "แพลตฟอร์ม E-Book สไตล์ Netflix ด้วย MangaDex API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${notoSansThai.variable} antialiased`}>
        <SmoothScrolling>
          <ToastProvider>
            <AuthProvider>
              {children}
              <DevImageCacheToggle />
            </AuthProvider>
          </ToastProvider>
        </SmoothScrolling>
      </body>
    </html>
  );
}
