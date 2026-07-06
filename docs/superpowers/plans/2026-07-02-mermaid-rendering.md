# Mermaid Diagram Rendering Implementation Plan (Consensus-Approved)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable rendering of interactive Mermaid diagrams in the Markdown document viewer of the MangaDock Docs hub (`/docs`), changing raw mermaid code blocks into visual flow diagrams.

**Architecture:** 
1. Install `mermaid` on the frontend.
2. Create a Client Component `MermaidRenderer.tsx` that dynamically imports the `mermaid` library to prevent Server-Side Rendering (SSR) issues, using a singleton initialization pattern, and renders the chart text into an SVG container safely on the client side with a try-catch fallback.
3. Export and update `MarkdownRenderer` in `DocsClient.tsx` to detect `mermaid` code blocks and route them to `<MermaidRenderer />` wrapped in standard code block styles.
4. Implement using Test-Driven Development (TDD) using a non-JSX test file `MarkdownRenderer.test.ts` using `React.createElement` to prevent Next.js compilation issues.

**Tech Stack:** React 19, Next.js 16, Bun Test, Mermaid.js

## Global Constraints
- **TDD:** No production code without a failing test first.
- **Surgical changes:** Match existing style, touch only what is necessary, and remove any created orphans.
- **Zero-Emoji Policy:** Do not use emojis in source code, comments, or log messages.

---

### Task 1: Scaffolding and Failing Test (RED)

**Files:**
- Modify: `Frontend/app/docs/DocsClient.tsx:131` (Export `MarkdownRenderer`)
- Create: `Frontend/app/docs/__tests__/MarkdownRenderer.test.ts`

- [ ] **Step 1: Export MarkdownRenderer in DocsClient.tsx**
Change `function MarkdownRenderer` to `export function MarkdownRenderer` to make it accessible to tests.

- [ ] **Step 2: Write the failing test**
Create `Frontend/app/docs/__tests__/MarkdownRenderer.test.ts` with a test that asserts a `mermaid` fenced code block is parsed and maps to a specific HTML structure/tag instead of raw code. Use `React.createElement` instead of JSX to avoid typescript compilation during build.

Code to write:
```typescript
import { expect, test, describe, mock } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";

// Mock lang context to prevent crashes
mock.module("../lang-context", () => ({
  useLang: () => "en",
}));

import { MarkdownRenderer } from "../DocsClient";

describe("MarkdownRenderer - Mermaid Parsing", () => {
  test("renders normal code blocks as pre/code blocks", () => {
    const md = "```javascript\nconsole.log('test');\n```";
    const element = React.createElement(MarkdownRenderer, { content: md });
    const html = renderToString(element);
    expect(html).toContain("<pre");
    expect(html).toContain("console.log('test');");
  });

  test("renders mermaid code blocks using a specific class container and not standard pre/code", () => {
    const md = "```mermaid\ngraph TD\nA --> B\n```";
    const element = React.createElement(MarkdownRenderer, { content: md });
    const html = renderToString(element);
    
    // We expect it to be handled by a MermaidRenderer rather than standard pre block
    expect(html).not.toContain("<pre");
    expect(html).toContain('data-mermaid-chart="graph TD\nA --&gt; B"');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**
Run: `bun test app/docs/__tests__/MarkdownRenderer.test.ts` in `Frontend/` folder.
Expected: The first test passes, but the second test fails because the mermaid block is still rendered inside a `<pre>` block.

---

### Task 2: Install dependencies and implement MermaidRenderer

**Files:**
- Modify: `Frontend/package.json`
- Create: `Frontend/app/docs/MermaidRenderer.tsx`

- [ ] **Step 1: Add mermaid dependency in package.json**
Add `"mermaid": "^11.4.0"` to the `dependencies` block of `Frontend/package.json`.

- [ ] **Step 2: Install dependencies**
Run: `bun install` in `Frontend/` folder.

- [ ] **Step 3: Create MermaidRenderer.tsx**
Create a Next.js `use client` component that wraps the `mermaid` library, handles the singleton initialization pattern, error fallback (renders raw code block if rendering fails), unmount check, and safely renders SVG diagrams.

Code to write:
```tsx
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
```

---

### Task 3: Wire MermaidRenderer into DocsClient and make tests pass (GREEN)

**Files:**
- Modify: `Frontend/app/docs/DocsClient.tsx`

- [ ] **Step 1: Update DocsClient.tsx to use MermaidRenderer**
Import `MermaidRenderer` inside `Frontend/app/docs/DocsClient.tsx` and map `mermaid` blocks to it.

Code changes in `DocsClient.tsx`:
```tsx
// At top of DocsClient.tsx
import MermaidRenderer from './MermaidRenderer';

// Inside MarkdownRenderer loop (near line 142):
    // Fenced code block
    if (line.startsWith('```')) {
      const info = line.slice(3).trim();
      const codeLang = info.split(/\s+/)[0].toLowerCase() || 'text';
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++; }
      i++;
      
      if (codeLang === 'mermaid') {
        nodes.push(
          <div key={k++} className="my-5 rounded-xl overflow-hidden border border-black/[0.08] bg-[#0f1118]">
            <div className="px-4 py-2 border-b border-black/[0.08] bg-white/[0.02]">
              <span className="text-[11px] font-mono text-[#86868b]">mermaid</span>
            </div>
            <MermaidRenderer chart={code.join('\n')} />
          </div>
        );
        continue;
      }
      
      nodes.push(
        <div key={k++} className="my-5 rounded-xl overflow-hidden border border-black/[0.08] bg-[#0f1118]">
          {lang !== 'text' && (
            <div className="px-4 py-2 border-b border-black/[0.08] bg-white/[0.02]">
              <span className="text-[11px] font-mono text-[#86868b]">{lang}</span>
            </div>
          )}
          <pre className="p-4 overflow-x-auto text-[13px] font-mono text-[rgba(248,249,251,0.8)] leading-relaxed whitespace-pre">
            <code>{code.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }
```

- [ ] **Step 2: Run test to verify it passes**
Run: `bun test app/docs/__tests__/MarkdownRenderer.test.ts` in `Frontend/` folder.
Expected: Both tests PASS.

- [ ] **Step 3: Run the entire test suite to prevent regressions**
Run: `bun test` in `Frontend/` folder.
Expected: 140 PASS, 0 FAIL.

- [ ] **Step 4: Commit changes**
Run git add and commit.

---

## Verification Plan

### Automated Verification
- Run: `bun test`
- Verify that `app/docs/__tests__/MarkdownRenderer.test.ts` passes and all other 138 tests are still green.

### Manual Verification
- Deploy and open `http://localhost:4000/docs?sim=agentic-workflow-presentation`
- Confirm that the Mermaid diagram renders correctly and dynamically inside the simulated slides page without any console errors.
