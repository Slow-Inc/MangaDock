'use client';

import React, { useEffect, useRef, useState } from 'react';

let mermaidIdCounter = 0;
let mermaidInitialized = false;

async function getMermaid() {
  const mermaid = (await import('mermaid')).default;
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'strict',
      themeVariables: {
        background: 'transparent',
      }
    });
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
        setSvg(result.svg);
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
      <pre className="p-4 overflow-x-auto text-[13px] font-mono text-[rgba(248,249,251,0.8)] bg-[#0f1118] leading-relaxed whitespace-pre rounded-lg border border-black/[0.08]">
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="my-6 p-4 flex justify-center bg-white/[0.02] border border-black/[0.06] rounded-xl overflow-x-auto"
      data-mermaid-chart={chart}
      dangerouslySetInnerHTML={{ __html: svg || '<span class="text-xs text-[#86868b] font-medium">กำลังวาดแผนผัง... / Rendering diagram...</span>' }}
    />
  );
}
