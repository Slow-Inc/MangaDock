"use client";

import { Fragment, type ReactNode } from "react";
import { tokenizeInline } from "@/lib/markdown";

function Inline({ text }: { text: string }) {
  return (
    <>
      {tokenizeInline(text).map((t, i) => {
        if (t.type === "bold") return <strong key={i} className="font-semibold" style={{ color: "var(--panel-ink)" }}>{t.value}</strong>;
        if (t.type === "italic") return <em key={i}>{t.value}</em>;
        if (t.type === "code") return <code key={i} className="tnum rounded px-1 py-px text-[10.5px]" style={{ background: "var(--panel)", border: "1px solid var(--panel-hairline)" }}>{t.value}</code>;
        return <Fragment key={i}>{t.value}</Fragment>;
      })}
    </>
  );
}

const indentPx = (spaces: string) => 4 + Math.min(spaces.length, 8) * 5;

/** Renders the subset of markdown the LLM emits: headings, bullet + numbered lists (nested via
 *  indentation), and inline bold / code / italic. Line-based so it never throws on partial input. */
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];

  lines.forEach((line, i) => {
    if (line.trim() === "") {
      out.push(<div key={i} className="h-1.5" />);
      return;
    }
    let m: RegExpMatchArray | null;

    if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
      out.push(
        <div key={i} className="pt-1 text-[12.5px] font-semibold" style={{ color: "var(--panel-ink)" }}>
          <Inline text={m[2]} />
        </div>,
      );
    } else if ((m = line.match(/^(\s*)[*-]\s+(.*)/))) {
      out.push(
        <div key={i} className="flex gap-1.5" style={{ paddingLeft: indentPx(m[1]) }}>
          <span style={{ color: "var(--panel-ink-3)" }}>•</span>
          <span className="flex-1"><Inline text={m[2]} /></span>
        </div>,
      );
    } else if ((m = line.match(/^(\s*)(\d+)\.\s+(.*)/))) {
      out.push(
        <div key={i} className="flex gap-1.5" style={{ paddingLeft: indentPx(m[1]) }}>
          <span className="tnum shrink-0" style={{ color: "var(--panel-ink-3)" }}>{m[2]}.</span>
          <span className="flex-1"><Inline text={m[3]} /></span>
        </div>,
      );
    } else {
      out.push(<div key={i}><Inline text={line} /></div>);
    }
  });

  return <div className="space-y-1">{out}</div>;
}
