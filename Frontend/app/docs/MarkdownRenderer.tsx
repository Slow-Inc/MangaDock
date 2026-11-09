'use client';

import React, { useMemo, useState } from 'react';
import { isShell, stripPrompts, tokenize, type TokenType } from './highlight';
import { ArrowUpRight, ImageIcon, ImageOff, Maximize2 } from 'lucide-react';
import { useLang } from './lang-context';
import { filterLangBlocks, makeSlugger } from './markdown';
import { useDocContext, type DocContextValue } from './docContext';
import { githubBlobUrl, resolveImage, resolveLink } from './resolveHref';
import { viewToPath } from './routes';
import MermaidRenderer from './MermaidRenderer';
import CopyButton from '../components/ui/CopyButton';
import CoverLightbox from '../components/CoverLightbox';
import GradientHeading from '../components/ui/GradientHeading';

// The Markdown reader, on Strata tokens. Code and diagrams are always-dark islands (`theme-dark`,
// DESIGN.md §2 — the same device the reader uses), so a snippet looks the same in every theme.

const LINK =
  'text-accent underline decoration-accent/40 underline-offset-[0.2em] transition-colors duration-[var(--t1)] hover:decoration-accent';

const NO_DOCS: ReadonlySet<string> = new Set();
const EXTERNAL_ICON = <ArrowUpRight aria-hidden size={12} className="ml-0.5 inline align-[-0.1em] opacity-70" />;

/** A link the way GitHub reads it: inside the page, another document of the site, or out to GitHub / the web. */
function DocAnchor({ href, ctx, children }: { href: string; ctx: DocContextValue | null; children: React.ReactNode }) {
  const r = resolveLink(href, ctx?.file ?? '', ctx?.docPaths ?? NO_DOCS);
  const cls = `${LINK} [overflow-wrap:anywhere]`;
  if (r.kind === 'unsafe') return <>{children}</>;
  if (r.kind === 'hash') {
    return (
      <a
        href={`#${r.id}`}
        className={cls}
        onClick={e => {
          // The heading may be in a piece of the document that is not on the page yet: render it, then go.
          if (!ctx?.reveal || document.getElementById(r.id)) return;
          e.preventDefault();
          void ctx.reveal(r.id).then(() => { document.getElementById(r.id)?.scrollIntoView({ block: 'start' }); window.history.replaceState(null, '', `#${r.id}`); });
        }}
      >
        {children}
      </a>
    );
  }
  if (r.kind === 'doc' && ctx) {
    const to = viewToPath({ type: 'doc', file: r.file }) + r.hash;
    return (
      <a
        href={to}
        className={cls}
        onClick={e => {
          if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          ctx.navigate({ type: 'doc', file: r.file });
          if (r.hash) window.history.replaceState(null, '', to); // the document scrolls to it once it has rendered
        }}
      >
        {children}
      </a>
    );
  }
  // Left: the web, a repository file, or a document with no site to open it in (an issue body): GitHub.
  const url = r.kind === 'doc' ? githubBlobUrl(r.file, r.hash) : r.url;
  return <a href={url} className={cls} target="_blank" rel="noreferrer">{children}{EXTERNAL_ICON}</a>;
}

/** An image the document refers to. Repository images load from GitHub raw (see assetUrl); one that fails says so instead of leaving a hole. */
function DocImage({ src, alt, repoPath, block, zoomable = true }: { src: string; alt: string; repoPath?: string; block: boolean; zoomable?: boolean }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  // A server-rendered image can settle before React attaches onLoad/onError: read the outcome off the element.
  const settled = (el: HTMLImageElement | null) => {
    if (el?.complete) setState(s => (s !== 'loading' ? s : el.naturalWidth > 0 ? 'ok' : 'error'));
  };

  if (state === 'error') {
    const shown = repoPath ?? src;
    return (
      <span className={`${block ? 'my-6 flex' : 'inline-flex'} items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3 text-ink-3`}>
        <ImageOff aria-hidden size={18} className="shrink-0" />
        <span className="min-w-0">
          <span className="block text-[0.8125rem] text-ink-2">{lang === 'th' ? 'ไม่พบรูปภาพ' : 'Image not found'}</span>
          <span className="block font-mono text-[11px] [overflow-wrap:anywhere]">{shown}</span>
        </span>
        {repoPath && (
          <a href={githubBlobUrl(repoPath)} target="_blank" rel="noreferrer" className={`${LINK} ml-auto shrink-0 text-[0.8125rem]`}>GitHub</a>
        )}
      </span>
    );
  }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- repository/remote images have no known size; the container lays them out
    <img
      ref={settled}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setState('ok')}
      onError={() => setState('error')}
      className={block ? 'mx-auto block h-auto max-w-full' : 'inline-block h-auto max-w-full align-middle'}
    />
  );

  // A click enlarges it in the same lightbox the book popup uses for a cover. An image that is itself a link
  // (a badge) keeps being a link instead.
  const name = alt || repoPath?.split('/').pop() || '';
  const enlarge = lang === 'th' ? 'ขยายรูป' : 'Enlarge image';
  const lightbox = open && <CoverLightbox src={src} alt={name} label={`${enlarge}: ${name}`} onClose={() => setOpen(false)} />;
  if (!zoomable) return img;
  if (!block) {
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} aria-label={`${enlarge}: ${name}`} className="inline-block cursor-zoom-in align-middle">{img}</button>
        {lightbox}
      </>
    );
  }
  return (
    <figure className="my-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${enlarge}: ${name}`}
        className={`group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-line bg-surface p-2 sm:p-3 ${state === 'loading' ? 'min-h-32 animate-pulse bg-fill' : ''}`}
      >
        {img}
        <span aria-hidden className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-bg/80 text-ink-2 opacity-0 transition-opacity duration-[var(--t1)] group-hover:opacity-100 group-focus-visible:opacity-100 max-md:opacity-100">
          <Maximize2 size={14} />
        </span>
      </button>
      {alt && <figcaption className="mt-2 px-1 font-mono text-[11px] leading-snug text-ink-3">{alt}</figcaption>}
      {lightbox}
    </figure>
  );
}

/** `![alt](src "title")` -> parts, or null when `text` is not exactly one image. */
function parseImage(text: string): { alt: string; src: string } | null {
  const m = text.trim().match(/^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"[^"]*")?\s*\)$/);
  return m ? { alt: m[1], src: m[2] } : null;
}

function renderImage(text: string, ctx: DocContextValue | null, block: boolean, key: number, zoomable = true): React.ReactNode {
  const img = parseImage(text);
  if (!img) return <React.Fragment key={key}>{text}</React.Fragment>;
  const r = resolveImage(img.src, ctx?.file ?? '');
  const label = img.alt || 'image';
  // Text that is not from the repository never makes the reader's browser fetch from another host.
  if (r.kind === 'unsafe' || (r.kind === 'remote' && !ctx)) {
    const href = r.kind === 'remote' ? r.src : undefined;
    return href ? (
      <a key={key} href={href} target="_blank" rel="noreferrer" className={LINK}><ImageIcon aria-hidden size={13} className="mr-1 inline align-[-0.15em]" />{label}</a>
    ) : <React.Fragment key={key}>{label}</React.Fragment>;
  }
  return <DocImage key={key} src={r.src} alt={img.alt} repoPath={r.kind === 'asset' ? r.path : undefined} block={block} zoomable={zoomable} />;
}

function renderInline(text: string, ctx: DocContextValue | null): React.ReactNode {
  const regex = /(\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)|!\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  return text.split(regex).map((part, i) => {
    const linked = part.match(/^\[(!\[[^\]]*\]\([^)]+\))\]\(([^)]+)\)$/);
    if (linked) return <DocAnchor key={i} href={linked[2]} ctx={ctx}>{renderImage(linked[1], ctx, false, 0, false)}</DocAnchor>;
    if (part.startsWith('![')) return renderImage(part, ctx, false, i);
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    if (/^\*[^*].*\*$/.test(part) || /^\*.\*$/.test(part))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return (
        <code key={i} className="rounded-md border border-line bg-fill px-1.5 py-0.5 font-mono text-[0.85em] text-ink [overflow-wrap:break-word]">
          {part.slice(1, -1)}
        </code>
      );
    const lm = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (lm) return <DocAnchor key={i} href={lm[2]} ctx={ctx}>{lm[1]}</DocAnchor>;
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/** The dot motif as a divider (DESIGN.md §1): three faint dots instead of a rule. */
function DotRule() {
  return (
    <div role="separator" className="my-10 flex items-center justify-center gap-2">
      {[0, 1, 2].map(n => <span key={n} aria-hidden className="h-1 w-1 rounded-full bg-ink-3" />)}
    </div>
  );
}

// Monokai Classic: token type -> colour (the --mk-* variables are set by .code-monokai in globals.css).
const TOKEN_CLASS: Record<TokenType, string> = {
  comment: 'text-[var(--mk-comment)]',
  string: 'text-[var(--mk-string)]',
  number: 'text-[var(--mk-number)]',
  literal: 'text-[var(--mk-number)]',
  keyword: 'text-[var(--mk-keyword)]',
  operator: 'text-[var(--mk-keyword)]',
  storage: 'italic text-[var(--mk-type)]',
  function: 'text-[var(--mk-func)]',
  type: 'text-[var(--mk-type)]',
  flag: 'text-[var(--mk-type)]',
  variable: 'text-[var(--mk-param)]',
  prompt: 'select-none text-[var(--mk-comment)]',
};

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const tokens = useMemo(() => tokenize(code, lang), [code, lang]);
  // What gets copied is what gets run: the `$ ` that only marks a command for the reader is left out.
  const copy = isShell(lang) ? stripPrompts(code) : code;
  return (
    <div className="code-monokai theme-dark my-6 overflow-hidden rounded-2xl border border-line bg-[var(--mk-bg)] text-[var(--mk-fg)]">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--mk-fg)_10%,transparent)] pl-4 pr-1.5">
        <span className="font-mono text-[11px] text-[var(--mk-comment)]">{lang === 'text' ? 'code' : lang}</span>
        <CopyButton value={copy} label="Copy" className="!min-h-11 sm:!min-h-8 !border-transparent !bg-transparent !px-3 !text-xs" />
      </div>
      <pre tabIndex={0} aria-label={`${lang} code`} className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.7] whitespace-pre sm:text-[13px]">
        <code>
          {tokens.map((t, i) => (t.type ? <span key={i} className={TOKEN_CLASS[t.type]}>{t.text}</span> : t.text))}
        </code>
      </pre>
    </div>
  );
}

function Heading({ level, id, children }: { level: 1 | 2 | 3 | 4; id: string; children: React.ReactNode }) {
  if (level === 1) {
    return (
      <GradientHeading as="h1" className="mb-6 text-[clamp(1.75rem,5.4vw,2.6rem)] leading-[1.2]">
        {children}
      </GradientHeading>
    );
  }
  const Tag = `h${level}` as 'h2' | 'h3' | 'h4';
  const cls = {
    2: 'mt-14 mb-4 border-t border-line pt-8 text-[1.375rem] sm:text-2xl',
    3: 'mt-9 mb-3 text-lg sm:text-xl',
    4: 'mt-6 mb-2 text-base',
  }[level];
  return (
    <Tag id={id} className={`group relative scroll-mt-20 font-semibold text-ink [text-wrap:balance] lg:scroll-mt-8 ${cls}`}>
      {children}
      <a
        href={`#${id}`}
        aria-label="ลิงก์ไปหัวข้อนี้"
        className="ml-2 inline-block font-mono text-ink-3 opacity-0 transition-opacity duration-[var(--t1)] hover:text-accent focus-visible:opacity-100 group-hover:opacity-100 max-md:hidden"
      >
        #
      </a>
    </Tag>
  );
}

const UL = /^[ \t]*[-*+] /;
const OL = /^\d+\. /;
const RULES = ['---', '***', '___'];
/** A line that opens a new block (so it cannot continue the paragraph or list item above it). */
const startsBlock = (l: string) =>
  l.trim() === '' || /^#{1,4} /.test(l) || l.startsWith('```') || l.startsWith('|') || l.startsWith('> ') || UL.test(l) || OL.test(l) || RULES.includes(l.trim());

/**
 * `headingIds`: when the document is shown in pieces, the ids of this piece's headings, worked out over the
 * whole document (see headingsOfUnits). Without it the ids come from this text alone.
 */
export function MarkdownRenderer({ content, headingIds }: { content: string; headingIds?: readonly string[] }) {
  const lang = useLang();
  const ctx = useDocContext();
  const inline = (t: string): React.ReactNode => renderInline(t, ctx);
  const lines = filterLangBlocks(content, lang).split('\n');
  const slug = makeSlugger();
  let h = 0;
  const idFor = (text: string) => (headingIds ? (headingIds[h++] ?? slug(text)) : slug(text));
  const nodes: React.ReactNode[] = [];
  let i = 0, k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const codeLang = line.slice(3).trim().split(/\s+/)[0].toLowerCase() || 'text';
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++; }
      i++;
      nodes.push(codeLang === 'mermaid'
        ? <MermaidRenderer key={k++} chart={code.join('\n')} />
        : <CodeBlock key={k++} lang={codeLang} code={code.join('\n')} />);
      continue;
    }

    // Table — scrolls inside its own box, so a wide one never widens the page
    if (line.startsWith('|')) {
      const tLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) { tLines.push(lines[i]); i++; }
      const rows = tLines.filter(l => !l.match(/^\|[\s:|-]+\|/));
      if (rows.length === 0) continue;
      nodes.push(
        <div key={k++} tabIndex={0} role="region" aria-label="table" className="my-6 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {rows.map((row, ri) => {
                const CellEl = ri === 0 ? 'th' : 'td';
                return (
                  <tr key={ri} className={ri === 0 ? 'bg-raised' : 'transition-colors duration-[var(--t1)] hover:bg-fill'}>
                    {row.split('|').slice(1, -1).map((cell, ci) => (
                      <CellEl
                        key={ci}
                        className={`min-w-[7.5rem] px-4 py-3 text-left align-top leading-6 ${ri === 0 ? 'font-mono text-[11px] font-medium text-ink-3' : 'border-t border-line text-ink'}`}
                      >
                        {inline(cell.trim())}
                      </CellEl>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    const hm = line.match(/^(#{1,4}) (.+)/);
    if (hm) {
      const level = hm[1].length as 1 | 2 | 3 | 4;
      nodes.push(<Heading key={k++} level={level} id={idFor(hm[2])}>{inline(hm[2])}</Heading>);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const ql: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) { ql.push(lines[i].slice(2)); i++; }
      nodes.push(
        <blockquote key={k++} className="my-6 rounded-r-2xl border-l-2 border-accent bg-fill py-3 pl-4 pr-4 leading-7 text-ink-2">
          {ql.map((l, li) => <p key={li}>{inline(l)}</p>)}
        </blockquote>
      );
      continue;
    }

    // HR
    if (RULES.includes(line.trim())) {
      nodes.push(<DotRule key={k++} />);
      i++; continue;
    }

    // Unordered list — a wrapped line under an item belongs to that item
    if (UL.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL.test(lines[i])) {
        let item = lines[i].replace(UL, '');
        i++;
        while (i < lines.length && !startsBlock(lines[i])) { item += ' ' + lines[i].trim(); i++; }
        items.push(item);
      }
      nodes.push(
        <ul key={k++} className="my-4 space-y-2.5">
          {items.map((item, li) => (
            <li key={li} className="flex gap-3 text-[0.9375rem] leading-7 text-ink sm:text-base">
              <span aria-hidden className="mt-[0.7rem] h-1 w-1 shrink-0 rounded-full bg-ink-3" />
              <span className="min-w-0">{inline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list — numbers come from the source, so a list that resumes keeps counting
    if (OL.test(line)) {
      const items: { n: number; text: string }[] = [];
      while (i < lines.length && OL.test(lines[i])) {
        const n = parseInt(lines[i], 10);
        let text = lines[i].replace(OL, '');
        i++;
        while (i < lines.length && !startsBlock(lines[i])) { text += ' ' + lines[i].trim(); i++; }
        items.push({ n, text });
      }
      nodes.push(
        <ol key={k++} className="my-4 space-y-2.5">
          {items.map((item, li) => (
            <li key={li} className="flex gap-3 text-[0.9375rem] leading-7 text-ink sm:text-base">
              <span className="mt-[0.2rem] w-6 shrink-0 text-right font-mono text-xs tabular-nums leading-7 text-ink-3">{String(item.n).padStart(2, '0')}</span>
              <span className="min-w-0">{inline(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') { i++; continue; }

    // Paragraph
    const pl: string[] = [];
    while (i < lines.length && !startsBlock(lines[i])) {
      pl.push(lines[i]);
      i++;
    }
    if (pl.length > 0 && parseImage(pl.join(' ')) && !/^!\[[^\]]*\]\([^)]+\)\s*!\[/.test(pl.join(' ').trim())) {
      nodes.push(renderImage(pl.join(' '), ctx, true, k++));
    } else if (pl.length > 0) {
      nodes.push(<p key={k++} className="my-4 text-[0.9375rem] leading-7 text-ink sm:text-base [overflow-wrap:anywhere]">{inline(pl.join(' '))}</p>);
    }
  }

  return <div className="min-w-0">{nodes}</div>;
}
