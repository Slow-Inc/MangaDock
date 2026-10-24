import type { ReactNode } from "react";
import Navbar from "../Navbar";
import GradientHeading from "./GradientHeading";
import Mascot from "../mascot/Mascot";
import type { MascotArea } from "../../lib/mascot";

/** Shared shell for not-found / error screens: mono label, neutral headline, lede, actions. */
export default function StatusPage({
  label,
  labelTone = "muted",
  title,
  children,
  actions,
  mascot,
  mascotState = "default",
}: {
  label: string;
  labelTone?: "muted" | "danger";
  title: string;
  children: ReactNode;
  actions: ReactNode;
  /** The area character shown above the label (Epic D). */
  mascot?: MascotArea;
  mascotState?: "default" | "working" | "sleeping";
}) {
  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto flex min-h-[80vh] w-full max-w-[var(--max)] flex-col justify-center px-[var(--gutter)] py-24">
        {mascot ? <Mascot area={mascot} state={mascotState} size={88} className="mb-6 -ml-2" /> : null}
        <p className={`font-mono text-xs uppercase tracking-[0.1em] ${labelTone === "danger" ? "text-danger" : "text-ink-3"}`}>{label}</p>
        <GradientHeading className="mt-4 text-display">{title}</GradientHeading>
        <div className="mt-4 max-w-[34rem] text-lede text-ink-2">{children}</div>
        <div className="mt-9 flex flex-wrap gap-3">{actions}</div>
      </main>
    </>
  );
}
