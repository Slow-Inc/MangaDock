'use client';

import React, { useEffect, useRef, useState } from 'react';

let mermaidIdCounter = 0;
let mermaidInitialized = false;

async function getMermaid() {
  const mermaid = (await import('mermaid')).default;
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
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
      <pre className="p-4 overflow-x-auto text-[13px] font-mono text-[rgba(248,249,251,0.8)] bg-[#0f1118] leading-relaxed whitespace-pre rounded-lg border border-black/[0.08]">
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="mermaid-wrapper my-6 p-6 w-full bg-[#0d1117] border border-[#30363d] rounded-xl overflow-x-auto -mx-6 md:-mx-12 px-6 md:px-12"
      style={{ width: 'calc(100% + 3rem)' }}
      data-mermaid-chart={chart}
      dangerouslySetInnerHTML={{ __html: svg || '<span class="text-xs text-[#86868b] font-medium">กำลังวาดแผนผัง... / Rendering diagram...</span>' }}
    />
  );
}

