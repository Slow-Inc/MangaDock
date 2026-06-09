'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LangContext, useLang, type Lang } from './lang-context';
import {
  Search, ExternalLink, GitBranch, GitPullRequest, AlertCircle,
  FileText, Menu, X, CheckCircle2, Circle, GitMerge, XCircle,
  ChevronLeft, ChevronRight, MessageCircle, Lock, ArrowLeft,
  Tag, BookOpen, Layers, Cpu,
  LayoutDashboard, Zap,
} from 'lucide-react';
import OverviewView from './OverviewView';
import TechStackView from './TechStackView';
import SimulationsView from './simulations/SimulationsView';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MdFile {
  relativePath: string;
  name: string;
  category: string;
  content: string;
}

type ViewState =
  | { type: 'overview' }
  | { type: 'techstack' }
  | { type: 'simulations' }
  | { type: 'doc'; file: string }
  | { type: 'gh-issues'; state: 'open' | 'closed' | 'all'; page: number }
  | { type: 'gh-issue'; number: number }
  | { type: 'gh-pulls'; state: 'open' | 'closed' | 'all'; page: number }
  | { type: 'gh-pull'; number: number }
  | { type: 'gh-branches' };

interface GHLabel { name: string; color: string }
interface GHUser { login: string; avatar_url: string }

interface GHIssue {
  number: number;
  title: string;
  state: string;
  body: string | null;
  labels: GHLabel[];
  user: GHUser;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request?: object;
  comments: number;
}

interface GHPull {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  merged_at: string | null;
  body: string | null;
  labels: GHLabel[];
  user: GHUser;
  created_at: string;
  updated_at: string;
  html_url: string;
  head: { ref: string };
  base: { ref: string };
  additions?: number;
  deletions?: number;
  changed_files?: number;
}

interface GHBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

interface GHComment {
  id: number;
  body: string;
  user: GHUser;
  created_at: string;
}

// ─── Utilities ─────────────────────────────────────────────────────────────

import { relativeDate, labelFg } from './utils';

async function ghFetch<T>(type: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams({ type, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const res = await fetch(`/api/docs/github?${qs}`);
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Markdown Renderer ─────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  return text.split(regex).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-[#1d1d1f]">{part.slice(2, -2)}</strong>;
    if (/^\*[^*].*\*$/.test(part) || /^\*.\*$/.test(part))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return <code key={i} className="px-1.5 py-0.5 rounded text-[0.85em] font-mono bg-[#f0f4ff] text-[#0071e3] border border-[#0071e3]/[0.15]">{part.slice(1, -1)}</code>;
    const lm = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (lm) {
      const ext = lm[2].startsWith('http');
      return <a key={i} href={lm[2]} className="text-[#0071e3] underline underline-offset-2 hover:text-[#0058b0] transition-colors duration-150" target={ext ? '_blank' : undefined} rel={ext ? 'noreferrer' : undefined}>{lm[1]}</a>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function filterLangBlocks(raw: string, lang: Lang): string {
  const out: string[] = [];
  let active: Lang | 'all' = 'all';
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (t === '<!-- lang:th -->') { active = 'th'; continue; }
    if (t === '<!-- lang:en -->') { active = 'en'; continue; }
    if (t === '<!-- lang:end -->') { active = 'all'; continue; }
    if (active === 'all' || active === lang) out.push(line);
  }
  return out.join('\n');
}

function MarkdownRenderer({ content }: { content: string }) {
  const lang = useLang();
  const filtered = filterLangBlocks(content, lang);
  const lines = filtered.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0, k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || 'text';
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++; }
      i++;
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

    // Table
    if (line.startsWith('|')) {
      const tLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) { tLines.push(lines[i]); i++; }
      const rows = tLines.filter(l => !l.match(/^\|[\s:|-]+\|/));
      if (rows.length === 0) continue;
      nodes.push(
        <div key={k++} className="my-5 overflow-x-auto rounded-xl border border-black/[0.08]">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {rows.map((row, ri) => {
                const cells = row.split('|').slice(1, -1);
                const CellEl = ri === 0 ? 'th' : 'td';
                return (
                  <tr key={ri} className={ri % 2 === 1 ? 'bg-[#fafafa]' : ''}>
                    {cells.map((cell, ci) => (
                      <CellEl key={ci} className={`px-4 py-2.5 text-left border-b border-black/[0.06] ${ri === 0 ? 'text-[11px] font-semibold text-[#6e6e73] bg-[#f5f5f7]' : 'text-[#374151]'}`}>
                        {renderInline(cell.trim())}
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
      const lvl = hm[1].length;
      const cls = [
        'text-[28px] font-bold text-[#1d1d1f] mt-10 mb-4 tracking-tight leading-tight',
        'text-[22px] font-semibold text-[#1d1d1f] mt-8 mb-3 tracking-tight',
        'text-[17px] font-semibold text-[#1d1d1f] mt-6 mb-2',
        'text-[15px] font-medium text-[#1d1d1f] mt-4 mb-1.5',
      ][lvl - 1];
      const Tag = `h${lvl}` as 'h1' | 'h2' | 'h3' | 'h4';
      nodes.push(<Tag key={k++} className={cls}>{renderInline(hm[2])}</Tag>);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const ql: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) { ql.push(lines[i].slice(2)); i++; }
      nodes.push(
        <div key={k++} className="my-4 px-4 py-3 rounded-lg bg-[#f5f5f7] border border-black/[0.08] italic text-[#6e6e73] leading-7">
          {ql.map((l, li) => <p key={li}>{renderInline(l)}</p>)}
        </div>
      );
      continue;
    }

    // HR
    if (['---', '***', '___'].includes(line.trim())) {
      nodes.push(<hr key={k++} className="my-8 border-black/[0.08]" />);
      i++; continue;
    }

    // Unordered list
    if (line.match(/^[ \t]*[-*+] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[ \t]*[-*+] /)) {
        items.push(lines[i].replace(/^[ \t]*[-*+] /, ''));
        i++;
      }
      nodes.push(
        <ul key={k++} className="my-3 space-y-2">
          {items.map((item, li) => (
            <li key={li} className="flex gap-3 text-[#374151] leading-7 text-[15px]">
              <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-[#6e6e73] shrink-0" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      nodes.push(
        <ol key={k++} className="my-3 space-y-2">
          {items.map((item, li) => (
            <li key={li} className="flex gap-3 text-[#374151] leading-7 text-[15px]">
              <span className="text-[12px] font-mono text-[#6e6e73] shrink-0 mt-1 min-w-[20px] text-right">{li + 1}.</span>
              <span>{renderInline(item)}</span>
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
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^#{1,4} /) &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('|') &&
      !lines[i].startsWith('> ') &&
      !lines[i].match(/^[ \t]*[-*+] /) &&
      !lines[i].match(/^\d+\. /) &&
      !['---', '***', '___'].includes(lines[i].trim())
    ) {
      pl.push(lines[i]);
      i++;
    }
    if (pl.length > 0) {
      nodes.push(
        <p key={k++} className="my-3 text-[#374151] leading-7 text-[15px]">{renderInline(pl.join(' '))}</p>
      );
    }
  }

  return <div>{nodes}</div>;
}

// ─── Small Components ───────────────────────────────────────────────────────

function LabelBadge({ label }: { label: GHLabel }) {
  const bg = `#${label.color}`;
  const color = labelFg(label.color);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium shrink-0" style={{ backgroundColor: bg, color }}>
      {label.name}
    </span>
  );
}

function IssueStateIcon({ state }: { state: string }) {
  if (state === 'closed') return <CheckCircle2 size={14} className="text-black/30 shrink-0" />;
  return <Circle size={14} className="text-green-600 shrink-0" />;
}

function PRStateIcon({ state, draft, merged }: { state: string; draft: boolean; merged: boolean }) {
  if (merged || state === 'merged') return <GitMerge size={14} className="text-[#0071e3] shrink-0" />;
  if (state === 'closed') return <XCircle size={14} className="text-red-500 shrink-0" />;
  if (draft) return <GitPullRequest size={14} className="text-black/30 shrink-0" />;
  return <GitPullRequest size={14} className="text-green-600 shrink-0" />;
}

function StateBadge({ state, draft, merged }: { state: string; draft?: boolean; merged?: boolean }) {
  const lang = useLang();
  if (merged) return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#0071e3]/10 text-[#0071e3]">{lang === 'th' ? 'ผสานแล้ว' : 'Merged'}</span>;
  if (state === 'closed') return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-600">{lang === 'th' ? 'ปิดแล้ว' : 'Closed'}</span>;
  if (draft) return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-black/[0.05] text-[#6e6e73]">{lang === 'th' ? 'ร่าง' : 'Draft'}</span>;
  return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-green-50 text-green-700">{lang === 'th' ? 'เปิดอยู่' : 'Open'}</span>;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-black/[0.06] rounded ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 py-6">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

// ─── Doc View ───────────────────────────────────────────────────────────────

function DocView({ file, mdFiles, onNavigate }: {
  file: string;
  mdFiles: MdFile[];
  onNavigate: (f: string) => void;
}) {
  const doc = mdFiles.find(f => f.relativePath === file);
  const idx = mdFiles.findIndex(f => f.relativePath === file);
  const prev = idx > 0 ? mdFiles[idx - 1] : null;
  const next = idx < mdFiles.length - 1 ? mdFiles[idx + 1] : null;

  const lang = useLang();

  if (!doc) return (
    <div className="py-20 text-center text-[#6e6e73]">
      <AlertCircle size={32} className="mx-auto mb-4 opacity-30" />
      <p>{lang === 'th' ? 'ไม่พบเอกสาร' : 'Document not found'}</p>
    </div>
  );

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-black/[0.08]">
        <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] mb-4">
          <span>{lang === 'th' ? 'เอกสาร' : 'Docs'}</span>
          <ChevronRight size={12} />
          <span className="text-[#86868b]">{doc.category}</span>
          <ChevronRight size={12} />
          <span className="text-[#0071e3]">{doc.name}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[12px] font-mono text-[#86868b]">{doc.relativePath}</span>
          <a
            href={`https://github.com/Slow-Inc/MangaDock/blob/main/${doc.relativePath}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] hover:text-[#0071e3] transition-colors"
          >
            <ExternalLink size={12} />
            GitHub
          </a>
        </div>
      </div>

      <MarkdownRenderer content={doc.content} />

      <div className="mt-16 pt-8 border-t border-black/[0.08] flex items-stretch gap-4">
        {prev ? (
          <button
            onClick={() => onNavigate(prev.relativePath)}
            className="flex-1 flex items-center gap-3 px-5 py-4 rounded-xl border border-black/[0.08] hover:border-[#0071e3]/30 hover:bg-[#0071e3]/[0.04] transition-all text-left group"
          >
            <ChevronLeft size={16} className="text-[#6e6e73] group-hover:text-[#0071e3] shrink-0 transition-colors" />
            <div>
              <div className="text-[11px] text-[#86868b] mb-0.5">{lang === 'th' ? 'ก่อนหน้า' : 'Previous'}</div>
              <div className="text-[14px] font-medium text-[#1d1d1f] group-hover:text-[#0071e3] transition-colors">{prev.name}</div>
            </div>
          </button>
        ) : <div className="flex-1" />}
        {next ? (
          <button
            onClick={() => onNavigate(next.relativePath)}
            className="flex-1 flex items-center justify-end gap-3 px-5 py-4 rounded-xl border border-black/[0.08] hover:border-[#0071e3]/30 hover:bg-[#0071e3]/[0.04] transition-all text-right group"
          >
            <div>
              <div className="text-[11px] text-[#86868b] mb-0.5">{lang === 'th' ? 'ถัดไป' : 'Next'}</div>
              <div className="text-[14px] font-medium text-[#1d1d1f] group-hover:text-[#0071e3] transition-colors">{next.name}</div>
            </div>
            <ChevronRight size={16} className="text-[#6e6e73] group-hover:text-[#0071e3] shrink-0 transition-colors" />
          </button>
        ) : <div className="flex-1" />}
      </div>
    </div>
  );
}

// ─── GitHub Issues List ─────────────────────────────────────────────────────

function IssuesListView({ page, onIssue, onPage }: {
  page: number;
  onIssue: (n: number) => void;
  onPage: (p: number) => void;
}) {
  const [issues, setIssues] = useState<GHIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeState, setActiveState] = useState<'open' | 'closed' | 'all'>('open');
  const lang = useLang();

  useEffect(() => {
    setLoading(true);
    setError('');
    ghFetch<GHIssue[]>('issues', { state: activeState, page, per_page: 20 })
      .then(data => {
        // Exclude pull requests from issues endpoint
        const issuesOnly = Array.isArray(data) ? data.filter(i => !i.pull_request) : [];
        setIssues(issuesOnly);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeState, page]);

  const STATES: { key: 'open' | 'closed' | 'all'; label: string }[] = [
    { key: 'open',   label: lang === 'th' ? 'เปิดอยู่' : 'Open' },
    { key: 'closed', label: lang === 'th' ? 'ปิดแล้ว' : 'Closed' },
    { key: 'all',    label: lang === 'th' ? 'ทั้งหมด' : 'All' },
  ];

  return (
    <div>
      <div className="mb-6 pb-6 border-b border-black/[0.08]">
        <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] mb-3">
          <span>GitHub</span>
          <ChevronRight size={12} />
          <span className="text-[#0071e3]">Issues</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-semibold text-[#1d1d1f]">{lang === 'th' ? 'รายการปัญหา' : 'Issues'}</h1>
          <div className="flex rounded-lg border border-black/[0.08] overflow-hidden">
            {STATES.map(s => (
              <button
                key={s.key}
                onClick={() => { setActiveState(s.key); onPage(1); }}
                className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${activeState === s.key ? 'bg-[#0071e3] text-white' : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <LoadingSkeleton />}
      {error && (
        <div className="py-8 text-center text-[#6e6e73] text-[14px]">
          <AlertCircle size={24} className="mx-auto mb-3 opacity-40" />
          <p>{lang === 'th' ? `ไม่สามารถโหลดข้อมูลได้: ${error}` : `Failed to load: ${error}`}</p>
          <p className="text-[12px] mt-1 text-[#86868b]">{lang === 'th' ? 'อาจถึงขีดจำกัด GitHub API หรือ repository เป็น private' : 'GitHub API rate limit reached, or repository is private.'}</p>
        </div>
      )}
      {!loading && !error && issues.length === 0 && (
        <div className="py-12 text-center text-[#6e6e73] text-[14px]">{lang === 'th' ? 'ไม่มี issue ในสถานะนี้' : 'No issues in this state.'}</div>
      )}

      {!loading && !error && (
        <div className="space-y-1">
          {issues.map(issue => (
            <button
              key={issue.number}
              onClick={() => onIssue(issue.number)}
              className="w-full flex items-start gap-4 px-4 py-4 rounded-xl hover:bg-black/[0.04] transition-colors text-left group"
            >
              <IssueStateIcon state={issue.state} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-[15px] text-[#1d1d1f] group-hover:text-[#0071e3] transition-colors font-medium leading-snug">
                    {issue.title}
                  </span>
                  {issue.labels.map(l => <LabelBadge key={l.name} label={l} />)}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[12px] text-[#6e6e73]">
                  <span>#{issue.number}</span>
                  <span>{relativeDate(issue.created_at)}</span>
                  <span>{lang === 'th' ? `โดย ${issue.user.login}` : `by ${issue.user.login}`}</span>
                  {issue.comments > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageCircle size={11} />
                      {issue.comments}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={14} className="text-black/20 group-hover:text-[#0071e3] shrink-0 mt-0.5 transition-colors" />
            </button>
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-black/[0.08]">
          <button
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-[#6e6e73] hover:text-[#1d1d1f] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/[0.04] transition-all"
          >
            <ChevronLeft size={14} /> {lang === 'th' ? 'ก่อนหน้า' : 'Previous'}
          </button>
          <span className="text-[12px] text-[#6e6e73]">{lang === 'th' ? `หน้า ${page}` : `Page ${page}`}</span>
          <button
            disabled={issues.length < 20}
            onClick={() => onPage(page + 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-[#6e6e73] hover:text-[#1d1d1f] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/[0.04] transition-all"
          >
            {lang === 'th' ? 'ถัดไป' : 'Next'} <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── GitHub Issue Detail ────────────────────────────────────────────────────

function IssueDetailView({ number, onBack }: { number: number; onBack: () => void }) {
  const [issue, setIssue] = useState<GHIssue | null>(null);
  const [comments, setComments] = useState<GHComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const lang = useLang();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      ghFetch<GHIssue>('issue', { number }),
      ghFetch<GHComment[]>('issue_comments', { number }),
    ])
      .then(([iss, cmts]) => { setIssue(iss); setComments(Array.isArray(cmts) ? cmts : []); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [number]);

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] text-[#6e6e73] hover:text-[#0071e3] transition-colors mb-6"
      >
        <ArrowLeft size={14} /> {lang === 'th' ? 'กลับไปรายการ' : 'Back to list'}
      </button>

      {loading && <LoadingSkeleton />}
      {error && (
        <div className="py-8 text-center text-[#6e6e73] text-[14px]">
          <AlertCircle size={24} className="mx-auto mb-3 opacity-40" />
          <p>{lang === 'th' ? `โหลดไม่ได้: ${error}` : `Failed to load: ${error}`}</p>
        </div>
      )}

      {!loading && !error && issue && (
        <>
          <div className="mb-6 pb-6 border-b border-black/[0.08]">
            <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] mb-3">
              <span>GitHub</span>
              <ChevronRight size={12} />
              <button onClick={onBack} className="hover:text-[#1d1d1f] transition-colors">Issues</button>
              <ChevronRight size={12} />
              <span className="text-[#0071e3]">#{issue.number}</span>
            </div>
            <h1 className="text-[22px] font-semibold text-[#1d1d1f] mb-3 leading-snug">{issue.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <StateBadge state={issue.state} />
              {issue.labels.map(l => <LabelBadge key={l.name} label={l} />)}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[12px] text-[#6e6e73]">
              <span className="flex items-center gap-1.5">
                <img src={issue.user.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                {issue.user.login}
              </span>
              <span>{lang === 'th' ? `เปิดเมื่อ ${relativeDate(issue.created_at)}` : `Opened ${relativeDate(issue.created_at)}`}</span>
              <span>{lang === 'th' ? `อัปเดต ${relativeDate(issue.updated_at)}` : `Updated ${relativeDate(issue.updated_at)}`}</span>
              <a href={issue.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[#0071e3] transition-colors">
                <ExternalLink size={11} /> GitHub
              </a>
            </div>
          </div>

          {issue.body ? (
            <div className="mb-8 pb-8 border-b border-black/[0.06]">
              <MarkdownRenderer content={issue.body} />
            </div>
          ) : (
            <p className="text-[#86868b] italic text-[14px] mb-8">{lang === 'th' ? 'ไม่มีรายละเอียดเพิ่มเติม' : 'No description provided.'}</p>
          )}

          {comments.length > 0 && (
            <div>
              <h2 className="text-[16px] font-semibold text-[#1d1d1f] mb-4">
                {lang === 'th' ? `ความคิดเห็น (${comments.length})` : `Comments (${comments.length})`}
              </h2>
              <div className="space-y-4">
                {comments.map(c => (
                  <div key={c.id} className="rounded-xl border border-black/[0.08] overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-[#f5f5f7] border-b border-black/[0.06]">
                      <img src={c.user.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                      <span className="text-[13px] font-medium text-[#1d1d1f]">{c.user.login}</span>
                      <span className="text-[12px] text-[#6e6e73] ml-auto">{relativeDate(c.created_at)}</span>
                    </div>
                    <div className="px-4 py-4">
                      <MarkdownRenderer content={c.body} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── GitHub Pull Requests List ──────────────────────────────────────────────

function PullsListView({ page, onPull, onPage }: {
  page: number;
  onPull: (n: number) => void;
  onPage: (p: number) => void;
}) {
  const [pulls, setPulls] = useState<GHPull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeState, setActiveState] = useState<'open' | 'closed' | 'all'>('all');
  const lang = useLang();

  useEffect(() => {
    setLoading(true);
    setError('');
    ghFetch<GHPull[]>('pulls', { state: activeState, page, per_page: 20 })
      .then(data => setPulls(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeState, page]);

  const STATES: { key: 'open' | 'closed' | 'all'; label: string }[] = [
    { key: 'open',   label: lang === 'th' ? 'เปิดอยู่' : 'Open' },
    { key: 'closed', label: lang === 'th' ? 'ปิดแล้ว' : 'Closed' },
    { key: 'all',    label: lang === 'th' ? 'ทั้งหมด' : 'All' },
  ];

  return (
    <div>
      <div className="mb-6 pb-6 border-b border-black/[0.08]">
        <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] mb-3">
          <span>GitHub</span>
          <ChevronRight size={12} />
          <span className="text-[#0071e3]">Pull Requests</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-semibold text-[#1d1d1f]">Pull Requests</h1>
          <div className="flex rounded-lg border border-black/[0.08] overflow-hidden">
            {STATES.map(s => (
              <button
                key={s.key}
                onClick={() => { setActiveState(s.key); onPage(1); }}
                className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${activeState === s.key ? 'bg-[#0071e3] text-white' : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <LoadingSkeleton />}
      {error && (
        <div className="py-8 text-center text-[#6e6e73] text-[14px]">
          <AlertCircle size={24} className="mx-auto mb-3 opacity-40" />
          <p>{lang === 'th' ? `ไม่สามารถโหลดข้อมูลได้: ${error}` : `Failed to load: ${error}`}</p>
        </div>
      )}
      {!loading && !error && pulls.length === 0 && (
        <div className="py-12 text-center text-[#6e6e73] text-[14px]">{lang === 'th' ? 'ไม่มี pull request ในสถานะนี้' : 'No pull requests in this state.'}</div>
      )}

      {!loading && !error && (
        <div className="space-y-1">
          {pulls.map(pr => (
            <button
              key={pr.number}
              onClick={() => onPull(pr.number)}
              className="w-full flex items-start gap-4 px-4 py-4 rounded-xl hover:bg-black/[0.04] transition-colors text-left group"
            >
              <PRStateIcon state={pr.state} draft={pr.draft} merged={!!pr.merged_at} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-[15px] text-[#1d1d1f] group-hover:text-[#0071e3] transition-colors font-medium leading-snug">
                    {pr.title}
                  </span>
                  {pr.draft && <span className="px-1.5 py-0.5 rounded text-[11px] bg-black/[0.05] text-[#6e6e73]">draft</span>}
                  {pr.labels.map(l => <LabelBadge key={l.name} label={l} />)}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[12px] text-[#6e6e73]">
                  <span>#{pr.number}</span>
                  <span className="font-mono text-[11px]">{pr.head.ref} → {pr.base.ref}</span>
                  <span>{relativeDate(pr.created_at)}</span>
                  <span>{lang === 'th' ? `โดย ${pr.user.login}` : `by ${pr.user.login}`}</span>
                </div>
              </div>
              <ChevronRight size={14} className="text-black/20 group-hover:text-[#0071e3] shrink-0 mt-0.5 transition-colors" />
            </button>
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-black/[0.08]">
          <button
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-[#6e6e73] hover:text-[#1d1d1f] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/[0.04] transition-all"
          >
            <ChevronLeft size={14} /> {lang === 'th' ? 'ก่อนหน้า' : 'Previous'}
          </button>
          <span className="text-[12px] text-[#6e6e73]">{lang === 'th' ? `หน้า ${page}` : `Page ${page}`}</span>
          <button
            disabled={pulls.length < 20}
            onClick={() => onPage(page + 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-[#6e6e73] hover:text-[#1d1d1f] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/[0.04] transition-all"
          >
            {lang === 'th' ? 'ถัดไป' : 'Next'} <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── GitHub PR Detail ───────────────────────────────────────────────────────

function PullDetailView({ number, onBack }: { number: number; onBack: () => void }) {
  const [pr, setPr] = useState<GHPull | null>(null);
  const lang = useLang();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    ghFetch<GHPull>('pull', { number })
      .then(data => setPr(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [number]);

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] text-[#6e6e73] hover:text-[#0071e3] transition-colors mb-6"
      >
        <ArrowLeft size={14} /> {lang === 'th' ? 'กลับไปรายการ' : 'Back to list'}
      </button>

      {loading && <LoadingSkeleton />}
      {error && (
        <div className="py-8 text-center text-[#6e6e73] text-[14px]">
          <AlertCircle size={24} className="mx-auto mb-3 opacity-40" />
          <p>{lang === 'th' ? `โหลดไม่ได้: ${error}` : `Failed to load: ${error}`}</p>
        </div>
      )}

      {!loading && !error && pr && (
        <>
          <div className="mb-6 pb-6 border-b border-black/[0.08]">
            <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] mb-3">
              <span>GitHub</span>
              <ChevronRight size={12} />
              <button onClick={onBack} className="hover:text-[#1d1d1f] transition-colors">Pull Requests</button>
              <ChevronRight size={12} />
              <span className="text-[#0071e3]">#{pr.number}</span>
            </div>
            <h1 className="text-[22px] font-semibold text-[#1d1d1f] mb-3 leading-snug">{pr.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <StateBadge state={pr.state} draft={pr.draft} merged={!!pr.merged_at} />
              {pr.labels.map(l => <LabelBadge key={l.name} label={l} />)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-[#6e6e73]">
              <span className="flex items-center gap-1.5">
                <img src={pr.user.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                {pr.user.login}
              </span>
              <span className="font-mono text-[11px] bg-black/[0.04] px-2 py-0.5 rounded">{pr.head.ref} → {pr.base.ref}</span>
              <span>{relativeDate(pr.created_at)}</span>
              {pr.merged_at && <span>{lang === 'th' ? `ผสานเมื่อ ${relativeDate(pr.merged_at)}` : `Merged ${relativeDate(pr.merged_at)}`}</span>}
            </div>
            {(pr.additions !== undefined || pr.changed_files !== undefined) && (
              <div className="mt-3 flex items-center gap-4 text-[12px]">
                {pr.additions !== undefined && (
                  <span className="text-green-600 font-mono">+{pr.additions}</span>
                )}
                {pr.deletions !== undefined && (
                  <span className="text-red-500 font-mono">-{pr.deletions}</span>
                )}
                {pr.changed_files !== undefined && (
                  <span className="text-[#6e6e73]">{lang === 'th' ? `${pr.changed_files} ไฟล์ที่เปลี่ยนแปลง` : `${pr.changed_files} files changed`}</span>
                )}
              </div>
            )}
            <a href={pr.html_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[#0071e3] hover:text-[#0058b0] transition-colors">
              <ExternalLink size={11} /> {lang === 'th' ? 'ดูใน GitHub' : 'View on GitHub'}
            </a>
          </div>

          {pr.body ? (
            <MarkdownRenderer content={pr.body} />
          ) : (
            <p className="text-[#86868b] italic text-[14px]">{lang === 'th' ? 'ไม่มีรายละเอียดเพิ่มเติม' : 'No description provided.'}</p>
          )}
        </>
      )}
    </div>
  );
}

// ─── GitHub Branches ────────────────────────────────────────────────────────

function BranchesView() {
  const [branches, setBranches] = useState<GHBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const lang = useLang();

  useEffect(() => {
    ghFetch<GHBranch[]>('branches')
      .then(data => setBranches(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6 pb-6 border-b border-black/[0.08]">
        <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] mb-3">
          <span>GitHub</span>
          <ChevronRight size={12} />
          <span className="text-[#0071e3]">{lang === 'th' ? 'สาขา' : 'Branches'}</span>
        </div>
        <h1 className="text-[22px] font-semibold text-[#1d1d1f]">{lang === 'th' ? 'สาขาทั้งหมด' : 'All Branches'}</h1>
      </div>

      {loading && <LoadingSkeleton />}
      {error && (
        <div className="py-8 text-center text-[#6e6e73] text-[14px]">
          <AlertCircle size={24} className="mx-auto mb-3 opacity-40" />
          <p>{lang === 'th' ? `โหลดไม่ได้: ${error}` : `Failed to load: ${error}`}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-1">
          {branches.map(b => (
            <div
              key={b.name}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-black/[0.03] transition-colors"
            >
              <GitBranch size={14} className={b.name === 'main' ? 'text-[#0071e3]' : 'text-[#6e6e73]'} />
              <div className="flex-1 min-w-0">
                <span className={`font-mono text-[13px] ${b.name === 'main' ? 'text-[#0071e3]' : 'text-[#1d1d1f]'}`}>
                  {b.name}
                </span>
                {b.protected && (
                  <span className="ml-2 text-[11px] text-[#6e6e73] inline-flex items-center gap-1">
                    <Lock size={10} /> {lang === 'th' ? 'ป้องกัน' : 'protected'}
                  </span>
                )}
              </div>
              <span className="font-mono text-[11px] text-[#86868b]">{b.commit.sha.slice(0, 7)}</span>
              <a
                href={`https://github.com/Slow-Inc/MangaDock/tree/${b.name}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#86868b] hover:text-[#0071e3] transition-colors"
              >
                <ExternalLink size={12} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────

const DOC_CATEGORY_ICONS: Record<string, typeof FileText> = {
  'หลัก': FileText,
  'เอกสาร': BookOpen,
  'Agent Guides': Layers,
};

const OV_SECTIONS = [
  { id: 'ov-hero',     labelTH: 'ภาพรวม',     labelEN: 'Overview',    dot: 'bg-[#6e6e73]' },
  { id: 'ov-frontend', labelTH: 'Frontend',    labelEN: 'Frontend',    dot: 'bg-[#0071e3]' },
  { id: 'ov-backend',  labelTH: 'Backend',     labelEN: 'Backend',     dot: 'bg-amber-500' },
  { id: 'ov-mit',      labelTH: 'MIT',         labelEN: 'MIT',         dot: 'bg-emerald-500' },
  { id: 'ov-supabase', labelTH: 'Supabase',    labelEN: 'Supabase',    dot: 'bg-sky-500' },
  { id: 'ov-t4',       labelTH: 'T4-STANDARD', labelEN: 'T4-STANDARD', dot: 'bg-[#6e6e73]' },
];

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  const main = document.querySelector('main');
  if (el && main) {
    main.scrollTo({ top: el.offsetTop - 48, behavior: 'smooth' });
  }
}

function Sidebar({
  mdFiles,
  view,
  search,
  setSearch,
  navigate,
  setLang,
  close,
}: {
  mdFiles: MdFile[];
  view: ViewState;
  search: string;
  setSearch: (s: string) => void;
  navigate: (v: ViewState) => void;
  setLang: (l: Lang) => void;
  close?: () => void;
}) {
  const lang = useLang();
  const [activeSection, setActiveSection] = useState('ov-hero');

  useEffect(() => {
    if (view.type !== 'overview') return;
    const main = document.querySelector('main');
    if (!main) return;
    const ids = OV_SECTIONS.map(s => s.id);
    const onScroll = () => {
      const scrollTop = main.scrollTop + 120;
      for (let i = ids.length - 1; i >= 0; i--) {
        const el = document.getElementById(ids[i]);
        if (el && el.offsetTop <= scrollTop) { setActiveSection(ids[i]); break; }
      }
    };
    main.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => main.removeEventListener('scroll', onScroll);
  }, [view.type]);

  const categories = useMemo(() => {
    const map = new Map<string, MdFile[]>();
    for (const f of mdFiles) {
      if (!map.has(f.category)) map.set(f.category, []);
      map.get(f.category)!.push(f);
    }
    return map;
  }, [mdFiles]);

  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    const result = new Map<string, MdFile[]>();
    for (const [cat, files] of categories) {
      const matched = files.filter(f => f.name.toLowerCase().includes(q) || f.content.toLowerCase().includes(q));
      if (matched.length > 0) result.set(cat, matched);
    }
    return result;
  }, [categories, search]);

  function navItem(label: string, v: ViewState, icon: React.ReactNode, prominent?: boolean) {
    const isActive = (() => {
      if (v.type === 'overview') return view.type === 'overview';
      if (v.type === 'techstack') return view.type === 'techstack';
      if (v.type === 'simulations') return view.type === 'simulations';
      if (v.type === 'gh-issues') return view.type === 'gh-issues' || view.type === 'gh-issue';
      if (v.type === 'gh-pulls') return view.type === 'gh-pulls' || view.type === 'gh-pull';
      if (v.type === 'gh-branches') return view.type === 'gh-branches';
      if (v.type === 'doc' && view.type === 'doc') return v.file === view.file;
      return false;
    })();

    // Simulations (overview) gets special prominent treatment
    if (prominent) {
      return (
        <button
          key={label}
          onClick={() => { navigate(v); close?.(); }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors text-left ${
            isActive
              ? 'bg-[#0071e3] text-white shadow-sm'
              : 'bg-[#0071e3]/[0.08] text-[#0071e3] hover:bg-[#0071e3]/[0.14]'
          }`}
        >
          {icon}
          <span className="truncate">{label}</span>
        </button>
      );
    }

    return (
      <button
        key={label}
        onClick={() => { navigate(v); close?.(); }}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors text-left ${
          isActive
            ? 'bg-white shadow-sm text-[#0071e3]'
            : 'text-[#1d1d1f] hover:bg-black/[0.04]'
        }`}
      >
        {icon}
        <span className="truncate">{label}</span>
      </button>
    );
  }

  return (
    <nav className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-black/[0.08] shrink-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <p className="text-[16px] font-semibold text-[#1d1d1f] leading-snug">{lang === 'th' ? 'เอกสาร & ประวัติ' : 'Docs & History'}</p>
          {/* Language toggle */}
          <div className="flex items-center shrink-0 rounded-lg border border-black/[0.08] overflow-hidden mt-0.5">
            {(['th', 'en'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 text-[11px] font-mono font-semibold uppercase transition-colors ${
                  lang === l
                    ? 'bg-[#0071e3] text-white'
                    : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[12px] text-[#6e6e73]">MangaDock Engineering Hub</p>
      </div>

      {/* Search */}
      <div className="px-4 py-3 shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]" />
          <input
            type="search"
            placeholder={lang === 'th' ? 'ค้นหาเอกสาร...' : 'Search docs...'}
            aria-label={lang === 'th' ? 'ค้นหาเอกสาร' : 'Search documentation'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-white border border-black/[0.12] text-[13px] text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:ring-1 focus:ring-[#0071e3]/30 focus:border-[#0071e3]/40 transition-all"
          />
        </div>
      </div>

      {/* Nav content */}
      <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.08) transparent' }}>

        {/* Overview + Tech Stack */}
        <div className="pt-1 space-y-0.5">
          {navItem(lang === 'th' ? 'ภาพรวมระบบ' : 'System Overview', { type: 'overview' }, <LayoutDashboard size={13} className="shrink-0" />, true)}
          {view.type === 'overview' && (
            <div className="ml-[22px] mt-0.5 pl-3 border-l border-black/[0.08] space-y-0.5">
              {OV_SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => { scrollToSection(s.id); close?.(); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition-colors text-left ${
                    activeSection === s.id
                      ? 'text-[#1d1d1f] bg-black/[0.04]'
                      : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-opacity ${s.dot} ${activeSection === s.id ? 'opacity-100' : 'opacity-40'}`} />
                  {lang === 'th' ? s.labelTH : s.labelEN}
                </button>
              ))}
            </div>
          )}
          {navItem('Tech Stack', { type: 'techstack' }, <Cpu size={13} className="shrink-0" />)}
          {navItem('Simulations', { type: 'simulations' }, <Zap size={13} className="shrink-0" />)}
        </div>

        {/* Document sections */}
        {Array.from(filtered.entries()).map(([cat, files]) => {
          const Icon = DOC_CATEGORY_ICONS[cat] ?? FileText;
          return (
            <div key={cat}>
              <p className="flex items-center gap-2 px-3 mb-1.5 text-[11px] font-medium text-[#6e6e73] tracking-wide">
                <Icon size={11} />
                {cat}
              </p>
              <div className="space-y-0.5">
                {files.map(f => navItem(f.name, { type: 'doc', file: f.relativePath }, <FileText size={13} className="shrink-0" />))}
              </div>
            </div>
          );
        })}

        {/* GitHub section */}
        <div>
          <p className="flex items-center gap-2 px-3 mb-1.5 text-[11px] font-medium text-[#6e6e73] tracking-wide">
            <GitBranch size={11} />
            GitHub
          </p>
          <div className="space-y-0.5">
            {navItem('Issues', { type: 'gh-issues', state: 'open', page: 1 }, <AlertCircle size={13} className="shrink-0" />)}
            {navItem('Pull Requests', { type: 'gh-pulls', state: 'all', page: 1 }, <GitPullRequest size={13} className="shrink-0" />)}
            {navItem(lang === 'th' ? 'สาขา (Branches)' : 'Branches', { type: 'gh-branches' }, <GitBranch size={13} className="shrink-0" />)}
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-black/[0.08] shrink-0">
        <a
          href="https://github.com/Slow-Inc/MangaDock"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-[12px] text-[#6e6e73] hover:text-[#0071e3] transition-colors"
        >
          <ExternalLink size={12} />
          Slow-Inc/MangaDock
        </a>
      </div>
    </nav>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

function viewKey(v: ViewState): string {
  if (v.type === 'doc') return `doc:${v.file}`;
  if (v.type === 'gh-issue') return `gh-issue:${v.number}`;
  if (v.type === 'gh-pull') return `gh-pull:${v.number}`;
  if (v.type === 'gh-issues') return `gh-issues`;
  if (v.type === 'gh-pulls') return `gh-pulls`;
  return v.type;
}

export default function DocsClient({ mdFiles }: { mdFiles: MdFile[] }) {
  const [view, setView] = useState<ViewState>({ type: 'overview' });
  const [search, setSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lang, setLang] = useState<Lang>('th');

  const navigate = useCallback((v: ViewState) => {
    setView(v);
    setMobileOpen(false);
  }, []);

  // Resolve page for GitHub list views
  const ghIssuePage = view.type === 'gh-issues' ? view.page : 1;
  const ghPullPage = view.type === 'gh-pulls' ? view.page : 1;

  function renderContent() {
    switch (view.type) {
      case 'overview':
        return <OverviewView onOpenSimulations={() => navigate({ type: 'simulations' })} />;
      case 'techstack':
        return <TechStackView />;
      case 'simulations':
        return null;
      case 'doc':
        return (
          <DocView
            file={view.file}
            mdFiles={mdFiles}
            onNavigate={file => navigate({ type: 'doc', file })}
          />
        );
      case 'gh-issues':
        return (
          <IssuesListView
            page={ghIssuePage}
            onIssue={n => navigate({ type: 'gh-issue', number: n })}
            onPage={p => setView(v => v.type === 'gh-issues' ? { ...v, page: p } : v)}
          />
        );
      case 'gh-issue':
        return (
          <IssueDetailView
            number={view.number}
            onBack={() => navigate({ type: 'gh-issues', state: 'open', page: 1 })}
          />
        );
      case 'gh-pulls':
        return (
          <PullsListView
            page={ghPullPage}
            onPull={n => navigate({ type: 'gh-pull', number: n })}
            onPage={p => setView(v => v.type === 'gh-pulls' ? { ...v, page: p } : v)}
          />
        );
      case 'gh-pull':
        return (
          <PullDetailView
            number={view.number}
            onBack={() => navigate({ type: 'gh-pulls', state: 'all', page: 1 })}
          />
        );
      case 'gh-branches':
        return <BranchesView />;
      default:
        return null;
    }
  }

  return (
    <LangContext.Provider value={lang}>
    <div className="h-screen bg-white text-[#1d1d1f] flex flex-col overflow-hidden">

      {/* Mobile header */}
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-black/[0.08] bg-[#f5f5f7] lg:hidden shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? (lang === 'th' ? 'ปิดเมนู' : 'Close menu') : (lang === 'th' ? 'เปิดเมนู' : 'Open menu')}
            aria-expanded={mobileOpen}
            className="p-2 rounded-lg text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.06] transition-all"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <span className="text-[15px] font-semibold text-[#1d1d1f]">{lang === 'th' ? 'เอกสาร' : 'Docs'}</span>
        </div>
        <a
          href="https://github.com/Slow-Inc/MangaDock"
          target="_blank"
          rel="noreferrer"
          aria-label="เปิด GitHub repository"
          className="p-2 rounded-lg text-[#6e6e73] hover:text-[#0071e3] transition-colors"
        >
          <ExternalLink size={16} />
        </a>
      </header>

      <div className="flex flex-1 overflow-hidden relative">

        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex w-[260px] shrink-0 flex-col border-r border-black/[0.08] bg-[#f5f5f7]">
          <Sidebar
            mdFiles={mdFiles}
            view={view}
            search={search}
            setSearch={setSearch}
            navigate={navigate}
            setLang={setLang}
          />
        </aside>

        {/* Sidebar — mobile overlay */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 w-[280px] z-50 bg-[#f5f5f7] border-r border-black/[0.08] lg:hidden">
              <Sidebar
                mdFiles={mdFiles}
                view={view}
                search={search}
                setSearch={setSearch}
                navigate={navigate}
                setLang={setLang}
                close={() => setMobileOpen(false)}
              />
            </aside>
          </>
        )}

        {/* Main content */}
        {view.type === 'simulations' ? (
          <main className="flex-1 overflow-hidden bg-white">
            <AnimatePresence mode="wait">
              <motion.div
                key="simulations"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                className="h-full"
              >
                <SimulationsView />
              </motion.div>
            </AnimatePresence>
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto bg-white" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.08) transparent' }}>
            <div className="max-w-[760px] mx-auto px-6 md:px-12 py-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={viewKey(view)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        )}

      </div>
    </div>
    </LangContext.Provider>
  );
}
