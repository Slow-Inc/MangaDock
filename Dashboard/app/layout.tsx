import type { ReactNode } from "react";

export const metadata = {
  title: "MIT Dashboard",
  description: "Standalone Dev monitoring dashboard (PRD #279, ADR 016)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#e5e5e5" }}>
        {children}
      </body>
    </html>
  );
}
