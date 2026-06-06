'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, ExternalLink, GitBranch, GitPullRequest, AlertCircle,
  FileText, Menu, X, CheckCircle2, Circle, GitMerge, XCircle,
  ChevronLeft, ChevronRight, MessageCircle, Lock, ArrowLeft,
  Hash, Tag, Clock, Eye, Code2, BookOpen, Layers, Cpu, Server,
  LayoutDashboard,
} from 'lucide-react';
import OverviewView from './OverviewView';
import TechStackView from './TechStackView';

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
      return <strong key={i} className="font-semibold text-[#f8f9fb]">{part.slice(2, -2)}</strong>;
    if (/^\*[^*].*\*$/.test(part) || /^\*.\*$/.test(part))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return <code key={i} className="px-1.5 py-0.5 rounded text-[0.85em] font-mono bg-white/[0.08] text-indigo-300 border border-white/[0.12]">{part.slice(1, -1)}</code>;
    const lm = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (lm) {
      const ext = lm[2].startsWith('http');
      return <a key={i} href={lm[2]} className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300 transition-colors duration-150" target={ext ? '_blank' : undefined} rel={ext ? 'noreferrer' : undefined}>{lm[1]}</a>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
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
        <div key={k++} className="my-5 rounded-xl overflow-hidden border border-white/[0.1] bg-[#0f1118]">
          {lang !== 'text' && (
            <div className="px-4 py-2 border-b border-white/[0.08] bg-white/[0.02]">
              <span className="text-[11px] font-mono text-white/30">{lang}</span>
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
        <div key={k++} className="my-5 overflow-x-auto rounded-xl border border-white/[0.1]">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {rows.map((row, ri) => {
                const cells = row.split('|').slice(1, -1);
                const CellEl = ri === 0 ? 'th' : 'td';
                return (
                  <tr key={ri} className={ri % 2 === 1 ? 'bg-white/[0.02]' : ''}>
                    {cells.map((cell, ci) => (
                      <CellEl key={ci} className={`px-4 py-2.5 text-left border-b border-white/[0.06] ${ri === 0 ? 'text-[11px] font-semibold text-white/70 bg-white/[0.04]' : 'text-[rgba(248,249,251,0.7)]'}`}>
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
        'text-[28px] font-bold text-[#f8f9fb] mt-10 mb-4 tracking-tight leading-tight',
        'text-[22px] font-semibold text-[#f8f9fb] mt-8 mb-3 tracking-tight',
        'text-[17px] font-semibold text-[rgba(248,249,251,0.9)] mt-6 mb-2',
        'text-[15px] font-medium text-[rgba(248,249,251,0.8)] mt-4 mb-1.5',
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
        <div key={k++} className="my-4 px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.1] italic text-[rgba(248,249,251,0.6)] leading-7">
          {ql.map((l, li) => <p key={li}>{renderInline(l)}</p>)}
        </div>
      );
      continue;
    }

    // HR
    if (['---', '***', '___'].includes(line.trim())) {
      nodes.push(<hr key={k++} className="my-8 border-white/[0.1]" />);
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
            <li key={li} className="flex gap-3 text-[rgba(248,249,251,0.7)] leading-7 text-[15px]">
              <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-indigo-500/50 shrink-0" />
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
            <li key={li} className="flex gap-3 text-[rgba(248,249,251,0.7)] leading-7 text-[15px]">
              <span className="text-[12px] font-mono text-indigo-400/50 shrink-0 mt-1 min-w-[20px] text-right">{li + 1}.</span>
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
        <p key={k++} className="my-3 text-[rgba(248,249,251,0.7)] leading-7 text-[15px]">{renderInline(pl.join(' '))}</p>
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
  if (state === 'closed') return <CheckCircle2 size={14} className="text-white/40 shrink-0" />;
  return <Circle size={14} className="text-green-400 shrink-0" />;
}

function PRStateIcon({ state, draft, merged }: { state: string; draft: boolean; merged: boolean }) {
  if (merged || state === 'merged') return <GitMerge size={14} className="text-indigo-400 shrink-0" />;
  if (state === 'closed') return <XCircle size={14} className="text-red-400 shrink-0" />;
  if (draft) return <GitPullRequest size={14} className="text-white/30 shrink-0" />;
  return <GitPullRequest size={14} className="text-green-400 shrink-0" />;
}

function StateBadge({ state, draft, merged }: { state: string; draft?: boolean; merged?: boolean }) {
  if (merged) return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/20 text-indigo-300">ผสานแล้ว</span>;
  if (state === 'closed' && !merged) return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/20 text-red-300">ปิดแล้ว</span>;
  if (draft) return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-white/10 text-white/40">ร่าง</span>;
  return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-green-500/15 text-green-400">เปิดอยู่</span>;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.06] rounded ${className}`} />;
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

  if (!doc) return (
    <div className="py-20 text-center text-white/30">
      <AlertCircle size={32} className="mx-auto mb-4 opacity-30" />
      <p>ไม่พบเอกสาร</p>
    </div>
  );

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-white/[0.08]">
        <div className="flex items-center gap-1.5 text-[12px] text-white/30 mb-4">
          <span>เอกสาร</span>
          <ChevronRight size={12} />
          <span className="text-white/40">{doc.category}</span>
          <ChevronRight size={12} />
          <span className="text-indigo-400">{doc.name}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[12px] font-mono text-white/20">{doc.relativePath}</span>
          <a
            href={`https://github.com/Slow-Inc/MangaDock/blob/main/${doc.relativePath}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[12px] text-white/30 hover:text-indigo-400 transition-colors"
          >
            <ExternalLink size={12} />
            GitHub
          </a>
        </div>
      </div>

      <MarkdownRenderer content={doc.content} />

      <div className="mt-16 pt-8 border-t border-white/[0.08] flex items-stretch gap-4">
        {prev ? (
          <button
            onClick={() => onNavigate(prev.relativePath)}
            className="flex-1 flex items-center gap-3 px-5 py-4 rounded-xl border border-white/[0.08] hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all text-left group"
          >
            <ChevronLeft size={16} className="text-white/30 group-hover:text-indigo-400 shrink-0 transition-colors" />
            <div>
              <div className="text-[11px] text-white/30 mb-0.5">ก่อนหน้า</div>
              <div className="text-[14px] font-medium text-white/70 group-hover:text-[#f8f9fb] transition-colors">{prev.name}</div>
            </div>
          </button>
        ) : <div className="flex-1" />}
        {next ? (
          <button
            onClick={() => onNavigate(next.relativePath)}
            className="flex-1 flex items-center justify-end gap-3 px-5 py-4 rounded-xl border border-white/[0.08] hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all text-right group"
          >
            <div>
              <div className="text-[11px] text-white/30 mb-0.5">ถัดไป</div>
              <div className="text-[14px] font-medium text-white/70 group-hover:text-[#f8f9fb] transition-colors">{next.name}</div>
            </div>
            <ChevronRight size={16} className="text-white/30 group-hover:text-indigo-400 shrink-0 transition-colors" />
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

  const STATES = [
    { key: 'open', label: 'เปิดอยู่' },
    { key: 'closed', label: 'ปิดแล้ว' },
    { key: 'all', label: 'ทั้งหมด' },
  ] as const;

  return (
    <div>
      <div className="mb-6 pb-6 border-b border-white/[0.08]">
        <div className="flex items-center gap-1.5 text-[12px] text-white/30 mb-3">
          <span>GitHub</span>
          <ChevronRight size={12} />
          <span className="text-indigo-400">Issues</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-semibold text-[#f8f9fb]">รายการปัญหา</h1>
          <div className="flex rounded-lg border border-white/[0.1] overflow-hidden">
            {STATES.map(s => (
              <button
                key={s.key}
                onClick={() => { setActiveState(s.key); onPage(1); }}
                className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${activeState === s.key ? 'bg-indigo-600 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <LoadingSkeleton />}
      {error && (
        <div className="py-8 text-center text-white/40 text-[14px]">
          <AlertCircle size={24} className="mx-auto mb-3 opacity-40" />
          <p>ไม่สามารถโหลดข้อมูลได้: {error}</p>
          <p className="text-[12px] mt-1 text-white/25">อาจถึงขีดจำกัด GitHub API หรือ repository เป็น private</p>
        </div>
      )}
      {!loading && !error && issues.length === 0 && (
        <div className="py-12 text-center text-white/30 text-[14px]">ไม่มี issue ในสถานะนี้</div>
      )}

      {!loading && !error && (
        <div className="space-y-1">
          {issues.map(issue => (
            <button
              key={issue.number}
              onClick={() => onIssue(issue.number)}
              className="w-full flex items-start gap-4 px-4 py-4 rounded-xl hover:bg-white/[0.04] transition-colors text-left group"
            >
              <IssueStateIcon state={issue.state} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-[15px] text-[rgba(248,249,251,0.85)] group-hover:text-[#f8f9fb] transition-colors font-medium leading-snug">
                    {issue.title}
                  </span>
                  {issue.labels.map(l => <LabelBadge key={l.name} label={l} />)}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[12px] text-white/30">
                  <span>#{issue.number}</span>
                  <span>{relativeDate(issue.created_at)}</span>
                  <span>โดย {issue.user.login}</span>
                  {issue.comments > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageCircle size={11} />
                      {issue.comments}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={14} className="text-white/20 group-hover:text-indigo-400 shrink-0 mt-0.5 transition-colors" />
            </button>
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.08]">
          <button
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.04] transition-all"
          >
            <ChevronLeft size={14} /> ก่อนหน้า
          </button>
          <span className="text-[12px] text-white/30">หน้า {page}</span>
          <button
            disabled={issues.length < 20}
            onClick={() => onPage(page + 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.04] transition-all"
          >
            ถัดไป <ChevronRight size={14} />
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
        className="flex items-center gap-1.5 text-[13px] text-white/40 hover:text-indigo-400 transition-colors mb-6"
      >
        <ArrowLeft size={14} /> กลับไปรายการ
      </button>

      {loading && <LoadingSkeleton />}
      {error && (
        <div className="py-8 text-center text-white/40 text-[14px]">
          <AlertCircle size={24} className="mx-auto mb-3 opacity-40" />
          <p>โหลดไม่ได้: {error}</p>
        </div>
      )}

      {!loading && !error && issue && (
        <>
          <div className="mb-6 pb-6 border-b border-white/[0.08]">
            <div className="flex items-center gap-1.5 text-[12px] text-white/30 mb-3">
              <span>GitHub</span>
              <ChevronRight size={12} />
              <button onClick={onBack} className="hover:text-white/50 transition-colors">Issues</button>
              <ChevronRight size={12} />
              <span className="text-indigo-400">#{issue.number}</span>
            </div>
            <h1 className="text-[22px] font-semibold text-[#f8f9fb] mb-3 leading-snug">{issue.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <StateBadge state={issue.state} />
              {issue.labels.map(l => <LabelBadge key={l.name} label={l} />)}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[12px] text-white/30">
              <span className="flex items-center gap-1.5">
                <img src={issue.user.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                {issue.user.login}
              </span>
              <span>เปิดเมื่อ {relativeDate(issue.created_at)}</span>
              <span>อัปเดต {relativeDate(issue.updated_at)}</span>
              <a href={issue.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
                <ExternalLink size={11} /> GitHub
              </a>
            </div>
          </div>

          {issue.body ? (
            <div className="mb-8 pb-8 border-b border-white/[0.06]">
              <MarkdownRenderer content={issue.body} />
            </div>
          ) : (
            <p className="text-white/25 italic text-[14px] mb-8">ไม่มีรายละเอียดเพิ่มเติม</p>
          )}

          {comments.length > 0 && (
            <div>
              <h2 className="text-[16px] font-semibold text-[rgba(248,249,251,0.8)] mb-4">
                ความคิดเห็น ({comments.length})
              </h2>
              <div className="space-y-4">
                {comments.map(c => (
                  <div key={c.id} className="rounded-xl border border-white/[0.08] overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
                      <img src={c.user.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                      <span className="text-[13px] font-medium text-white/70">{c.user.login}</span>
                      <span className="text-[12px] text-white/30 ml-auto">{relativeDate(c.created_at)}</span>
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

  useEffect(() => {
    setLoading(true);
    setError('');
    ghFetch<GHPull[]>('pulls', { state: activeState, page, per_page: 20 })
      .then(data => setPulls(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeState, page]);

  const STATES = [
    { key: 'open', label: 'เปิดอยู่' },
    { key: 'closed', label: 'ปิดแล้ว' },
    { key: 'all', label: 'ทั้งหมด' },
  ] as const;

  return (
    <div>
      <div className="mb-6 pb-6 border-b border-white/[0.08]">
        <div className="flex items-center gap-1.5 text-[12px] text-white/30 mb-3">
          <span>GitHub</span>
          <ChevronRight size={12} />
          <span className="text-indigo-400">Pull Requests</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-semibold text-[#f8f9fb]">Pull Requests</h1>
          <div className="flex rounded-lg border border-white/[0.1] overflow-hidden">
            {STATES.map(s => (
              <button
                key={s.key}
                onClick={() => { setActiveState(s.key); onPage(1); }}
                className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${activeState === s.key ? 'bg-indigo-600 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <LoadingSkeleton />}
      {error && (
        <div className="py-8 text-center text-white/40 text-[14px]">
          <AlertCircle size={24} className="mx-auto mb-3 opacity-40" />
          <p>ไม่สามารถโหลดข้อมูลได้: {error}</p>
        </div>
      )}
      {!loading && !error && pulls.length === 0 && (
        <div className="py-12 text-center text-white/30 text-[14px]">ไม่มี pull request ในสถานะนี้</div>
      )}

      {!loading && !error && (
        <div className="space-y-1">
          {pulls.map(pr => (
            <button
              key={pr.number}
              onClick={() => onPull(pr.number)}
              className="w-full flex items-start gap-4 px-4 py-4 rounded-xl hover:bg-white/[0.04] transition-colors text-left group"
            >
              <PRStateIcon state={pr.state} draft={pr.draft} merged={!!pr.merged_at} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-[15px] text-[rgba(248,249,251,0.85)] group-hover:text-[#f8f9fb] transition-colors font-medium leading-snug">
                    {pr.title}
                  </span>
                  {pr.draft && <span className="px-1.5 py-0.5 rounded text-[11px] bg-white/[0.08] text-white/30">draft</span>}
                  {pr.labels.map(l => <LabelBadge key={l.name} label={l} />)}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[12px] text-white/30">
                  <span>#{pr.number}</span>
                  <span className="font-mono text-[11px]">{pr.head.ref} → {pr.base.ref}</span>
                  <span>{relativeDate(pr.created_at)}</span>
                  <span>โดย {pr.user.login}</span>
                </div>
              </div>
              <ChevronRight size={14} className="text-white/20 group-hover:text-indigo-400 shrink-0 mt-0.5 transition-colors" />
            </button>
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.08]">
          <button
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.04] transition-all"
          >
            <ChevronLeft size={14} /> ก่อนหน้า
          </button>
          <span className="text-[12px] text-white/30">หน้า {page}</span>
          <button
            disabled={pulls.length < 20}
            onClick={() => onPage(page + 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.04] transition-all"
          >
            ถัดไป <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── GitHub PR Detail ───────────────────────────────────────────────────────

function PullDetailView({ number, onBack }: { number: number; onBack: () => void }) {
  const [pr, setPr] = useState<GHPull | null>(null);
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
        className="flex items-center gap-1.5 text-[13px] text-white/40 hover:text-indigo-400 transition-colors mb-6"
      >
        <ArrowLeft size={14} /> กลับไปรายการ
      </button>

      {loading && <LoadingSkeleton />}
      {error && (
        <div className="py-8 text-center text-white/40 text-[14px]">
          <AlertCircle size={24} className="mx-auto mb-3 opacity-40" />
          <p>โหลดไม่ได้: {error}</p>
        </div>
      )}

      {!loading && !error && pr && (
        <>
          <div className="mb-6 pb-6 border-b border-white/[0.08]">
            <div className="flex items-center gap-1.5 text-[12px] text-white/30 mb-3">
              <span>GitHub</span>
              <ChevronRight size={12} />
              <button onClick={onBack} className="hover:text-white/50 transition-colors">Pull Requests</button>
              <ChevronRight size={12} />
              <span className="text-indigo-400">#{pr.number}</span>
            </div>
            <h1 className="text-[22px] font-semibold text-[#f8f9fb] mb-3 leading-snug">{pr.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <StateBadge state={pr.state} draft={pr.draft} merged={!!pr.merged_at} />
              {pr.labels.map(l => <LabelBadge key={l.name} label={l} />)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-white/30">
              <span className="flex items-center gap-1.5">
                <img src={pr.user.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                {pr.user.login}
              </span>
              <span className="font-mono text-[11px] bg-white/[0.04] px-2 py-0.5 rounded">{pr.head.ref} → {pr.base.ref}</span>
              <span>{relativeDate(pr.created_at)}</span>
              {pr.merged_at && <span>ผสานเมื่อ {relativeDate(pr.merged_at)}</span>}
            </div>
            {(pr.additions !== undefined || pr.changed_files !== undefined) && (
              <div className="mt-3 flex items-center gap-4 text-[12px]">
                {pr.additions !== undefined && (
                  <span className="text-green-400 font-mono">+{pr.additions}</span>
                )}
                {pr.deletions !== undefined && (
                  <span className="text-red-400 font-mono">-{pr.deletions}</span>
                )}
                {pr.changed_files !== undefined && (
                  <span className="text-white/30">{pr.changed_files} ไฟล์ที่เปลี่ยนแปลง</span>
                )}
              </div>
            )}
            <a href={pr.html_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-white/30 hover:text-indigo-400 transition-colors">
              <ExternalLink size={11} /> ดูใน GitHub
            </a>
          </div>

          {pr.body ? (
            <MarkdownRenderer content={pr.body} />
          ) : (
            <p className="text-white/25 italic text-[14px]">ไม่มีรายละเอียดเพิ่มเติม</p>
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

  useEffect(() => {
    ghFetch<GHBranch[]>('branches')
      .then(data => setBranches(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6 pb-6 border-b border-white/[0.08]">
        <div className="flex items-center gap-1.5 text-[12px] text-white/30 mb-3">
          <span>GitHub</span>
          <ChevronRight size={12} />
          <span className="text-indigo-400">สาขา</span>
        </div>
        <h1 className="text-[22px] font-semibold text-[#f8f9fb]">สาขาทั้งหมด</h1>
      </div>

      {loading && <LoadingSkeleton />}
      {error && (
        <div className="py-8 text-center text-white/40 text-[14px]">
          <AlertCircle size={24} className="mx-auto mb-3 opacity-40" />
          <p>โหลดไม่ได้: {error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-1">
          {branches.map(b => (
            <div
              key={b.name}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-white/[0.03] transition-colors"
            >
              <GitBranch size={14} className={b.name === 'main' ? 'text-indigo-400' : 'text-white/30'} />
              <div className="flex-1 min-w-0">
                <span className={`font-mono text-[13px] ${b.name === 'main' ? 'text-indigo-300' : 'text-[rgba(248,249,251,0.75)]'}`}>
                  {b.name}
                </span>
                {b.protected && (
                  <span className="ml-2 text-[11px] text-white/30 inline-flex items-center gap-1">
                    <Lock size={10} /> ป้องกัน
                  </span>
                )}
              </div>
              <span className="font-mono text-[11px] text-white/20">{b.commit.sha.slice(0, 7)}</span>
              <a
                href={`https://github.com/Slow-Inc/MangaDock/tree/${b.name}`}
                target="_blank"
                rel="noreferrer"
                className="text-white/20 hover:text-indigo-400 transition-colors"
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
  { id: 'ov-hero',     label: 'ภาพรวม',      dot: 'bg-white/40' },
  { id: 'ov-frontend', label: 'Frontend',     dot: 'bg-indigo-400' },
  { id: 'ov-backend',  label: 'Backend',      dot: 'bg-amber-400' },
  { id: 'ov-mit',      label: 'MIT',          dot: 'bg-emerald-400' },
  { id: 'ov-supabase', label: 'Supabase',     dot: 'bg-sky-400' },
  { id: 'ov-t4',       label: 'T4-STANDARD',  dot: 'bg-white/40' },
] as const;

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
  close,
}: {
  mdFiles: MdFile[];
  view: ViewState;
  search: string;
  setSearch: (s: string) => void;
  navigate: (v: ViewState) => void;
  close?: () => void;
}) {
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

  const activeFile = view.type === 'doc' ? view.file : null;
  const activeGH = view.type.startsWith('gh-') ? view.type : null;

  function navItem(label: string, v: ViewState, icon: React.ReactNode) {
    const isActive = (() => {
      if (v.type === 'overview') return view.type === 'overview';
      if (v.type === 'techstack') return view.type === 'techstack';
      if (v.type === 'gh-issues') return view.type === 'gh-issues' || view.type === 'gh-issue';
      if (v.type === 'gh-pulls') return view.type === 'gh-pulls' || view.type === 'gh-pull';
      if (v.type === 'gh-branches') return view.type === 'gh-branches';
      if (v.type === 'doc' && view.type === 'doc') return v.file === view.file;
      return false;
    })();
    return (
      <button
        key={label}
        onClick={() => { navigate(v); close?.(); }}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors text-left ${
          isActive
            ? 'bg-indigo-600/20 text-indigo-300'
            : 'text-white/45 hover:text-white/75 hover:bg-white/[0.04]'
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
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.07] shrink-0">
        <Link href="/" className="flex items-center gap-2.5 text-white/60 hover:text-white/90 transition-colors mb-4">
          <ArrowLeft size={14} />
          <span className="text-[13px]">กลับสู่แอป</span>
        </Link>
        <p className="text-[16px] font-semibold text-[#f8f9fb]">เอกสาร & ประวัติ</p>
        <p className="text-[12px] text-white/30 mt-0.5">MangaDock Engineering Hub</p>
      </div>

      {/* Search */}
      <div className="px-4 py-3 shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            type="search"
            placeholder="ค้นหาเอกสาร..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white/70 placeholder:text-white/20 outline-none focus:border-indigo-500/40 focus:bg-white/[0.06] transition-all"
          />
        </div>
      </div>

      {/* Nav content */}
      <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>

        {/* Overview + Tech Stack */}
        <div className="pt-1 space-y-0.5">
          {navItem('ภาพรวมระบบ', { type: 'overview' }, <LayoutDashboard size={13} className="shrink-0" />)}
          {view.type === 'overview' && (
            <div className="ml-[22px] mt-0.5 pl-3 border-l border-white/[0.07] space-y-0.5">
              {OV_SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => { scrollToSection(s.id); close?.(); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition-colors text-left ${
                    activeSection === s.id
                      ? 'text-white/80 bg-white/[0.05]'
                      : 'text-white/35 hover:text-white/60'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-opacity ${s.dot} ${activeSection === s.id ? 'opacity-100' : 'opacity-30'}`} />
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {navItem('Tech Stack', { type: 'techstack' }, <Cpu size={13} className="shrink-0" />)}
        </div>

        {/* Document sections */}
        {Array.from(filtered.entries()).map(([cat, files]) => {
          const Icon = DOC_CATEGORY_ICONS[cat] ?? FileText;
          return (
            <div key={cat}>
              <p className="flex items-center gap-2 px-3 mb-1.5 text-[11px] font-medium text-white/25">
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
          <p className="flex items-center gap-2 px-3 mb-1.5 text-[11px] font-medium text-white/25">
            <GitBranch size={11} />
            GitHub
          </p>
          <div className="space-y-0.5">
            {navItem('Issues', { type: 'gh-issues', state: 'open', page: 1 }, <AlertCircle size={13} className="shrink-0" />)}
            {navItem('Pull Requests', { type: 'gh-pulls', state: 'all', page: 1 }, <GitPullRequest size={13} className="shrink-0" />)}
            {navItem('สาขา (Branches)', { type: 'gh-branches' }, <GitBranch size={13} className="shrink-0" />)}
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/[0.06] shrink-0">
        <a
          href="https://github.com/Slow-Inc/MangaDock"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-[12px] text-white/25 hover:text-indigo-400 transition-colors"
        >
          <ExternalLink size={12} />
          Slow-Inc/MangaDock
        </a>
      </div>
    </nav>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DocsClient({ mdFiles }: { mdFiles: MdFile[] }) {
  const [view, setView] = useState<ViewState>({ type: 'overview' });
  const [search, setSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

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
        return <OverviewView />;
      case 'techstack':
        return <TechStackView />;
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
    <div className="h-screen bg-[#08090d] text-[#f8f9fb] flex flex-col overflow-hidden">

      {/* Mobile header */}
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] bg-[#0a0b10] lg:hidden shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
            aria-expanded={mobileOpen}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <span className="text-[15px] font-semibold text-[#f8f9fb]">เอกสาร</span>
        </div>
        <a
          href="https://github.com/Slow-Inc/MangaDock"
          target="_blank"
          rel="noreferrer"
          aria-label="เปิด GitHub repository"
          className="p-2 rounded-lg text-white/30 hover:text-indigo-400 transition-colors"
        >
          <ExternalLink size={16} />
        </a>
      </header>

      <div className="flex flex-1 overflow-hidden relative">

        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex w-[260px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0a0b10]">
          <Sidebar
            mdFiles={mdFiles}
            view={view}
            search={search}
            setSearch={setSearch}
            navigate={navigate}
          />
        </aside>

        {/* Sidebar — mobile overlay */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 w-[280px] z-50 bg-[#0a0b10] border-r border-white/[0.07] lg:hidden">
              <Sidebar
                mdFiles={mdFiles}
                view={view}
                search={search}
                setSearch={setSearch}
                navigate={navigate}
                close={() => setMobileOpen(false)}
              />
            </aside>
          </>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
          <div className="max-w-[760px] mx-auto px-6 md:px-12 py-10">
            <div
              key={view.type === 'doc' ? view.file : view.type}
              style={{ animation: 'fadeIn 150ms ease' }}
            >
              {renderContent()}
            </div>
          </div>
        </main>

      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        }
      `}</style>
    </div>
  );
}
