'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { MermaidConfig } from 'mermaid';

let mermaidIdCounter = 0;
let mermaidInitialized = false;

export const MERMAID_CONFIG = {
  startOnLoad: false,
  theme: 'dark',
  // SECURITY: 'strict' keeps mermaid's built-in DOMPurify sanitization on and
  // disables `click`/HTML-label directives. Diagram sources can come from
  // attacker-controlled GitHub issue/PR/comment bodies (see plan 2026-07-11
  // Vuln 2) — never 'loose'.
  securityLevel: 'strict' as const,
  flowchart: {
    curve: 'step',
    useMaxWidth: false,
  },
  themeVariables: {
    background: '#0f1118',
    mainBkg: '#1c1f2e',
    nodeBorder: '#4a90d9',
    clusterBkg: '#1a1d2b',
    clusterBorder: '#3a4060',
    titleColor: '#e8eaf6',
    edgeLabelBackground: '#1c1f2e',
    lineColor: '#6baed6',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    primaryColor: '#1c2a3e',
    primaryTextColor: '#e8eaf6',
    primaryBorderColor: '#4a90d9',
    secondaryColor: '#1a2030',
    tertiaryColor: '#141824',
    labelBackground: '#1c1f2e',
    textColor: '#c9d1e0',
    nodeTextColor: '#e8eaf6',
  },
} satisfies MermaidConfig;

async function getMermaid() {
  const mermaid = (await import('mermaid')).default;
  if (!mermaidInitialized) {
    mermaid.initialize(MERMAID_CONFIG);
    mermaidInitialized = true;
  }
  return mermaid;
}


export default function MermaidRenderer({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [id] = useState(() => `mermaid-diagram-${mermaidIdCounter++}`);

  useEffect(() => {
    let isMounted = true;

    getMermaid()
      .then((mermaid) => {
        if (!isMounted) return;
        return mermaid.render(id, chart);
      })
      .then((result) => {
        if (!isMounted || !result) return;
        // Force SVG to fill 100% width and remove hard-coded max-width
        const processedSvg = result.svg
          .replace(/(<svg[^>]*)\swidth="[^"]*"/, '$1 width="100%"')
          .replace(/(<svg[^>]*)\sstyle="[^"]*max-width:[^"]*"/, '$1');
        setSvg(processedSvg);
      })
      .catch((err) => {
        console.error('Mermaid render error:', err);
        if (isMounted) {
          setError(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [chart, id]);

  if (error) {
    return (
      <pre className="theme-dark my-6 overflow-x-auto rounded-2xl border border-line bg-surface p-4 font-mono text-[13px] leading-relaxed whitespace-pre text-ink">
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <div 
      ref={containerRef} 
      // An always-dark island that scrolls inside its own box: on a phone the diagram keeps a readable
      // width (min 560px) and pans, instead of shrinking to fit or widening the page.
      className="mermaid-wrapper theme-dark my-6 w-full overflow-x-auto rounded-2xl border border-line bg-surface p-4 md:p-6 [&_svg]:h-auto [&_svg]:min-w-[560px]"
      tabIndex={0}
      role="region"
      aria-label="diagram"
      data-mermaid-chart={chart}
      dangerouslySetInnerHTML={{ __html: svg || '<span class="font-mono text-xs text-ink-3">กำลังวาดแผนผัง... / Rendering diagram...</span>' }}
    />
  );
}

