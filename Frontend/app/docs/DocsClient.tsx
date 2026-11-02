'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  ExternalLink, GitBranch, GitPullRequest, Menu,
  CheckCircle2, Circle, GitMerge, XCircle, ChevronLeft, ChevronRight, MessageCircle, Lock,
} from 'lucide-react';
import Pill from '../components/ui/Pill';
import Badge from '../components/ui/Badge';
import Button, { buttonClass } from '../components/ui/Button';
import Card from '../components/ui/Card';
import LoadError from '../components/ui/LoadError';
import ThemeToggle from '../components/ThemeToggle';
import { LangContext, useLang, type Lang } from './lang-context';
import OverviewView from './OverviewView';
import TechStackView from './TechStackView';
import SimulationsView from './simulations/SimulationsView';
import { MarkdownRenderer } from './MarkdownRenderer';
import DocsNav, { DocsSheet } from './DocsNav';
import DocOutline, { ReadingProgress } from './DocOutline';
import TranslationNotice, { TranslationProgressCard } from './TranslationNotice';
import { useDocTranslation } from './useDocTranslation';
import { DocContext } from './docContext';
import DocBody, { INITIAL_UNITS } from './DocBody';
import { DocLink, DotCorner, LoadingRows, PageHeader, SheetOpenContext } from './DocsParts';
import { filterLangBlocks, headingsOfUnits, readingMinutes, splitParts } from './markdown';
import { pathToView, viewToPath, viewTitle, DOCS_BASE, type ViewState } from './routes';
import { githubBlobUrl, REPO_URL } from './resolveHref';
import { relativeDate, labelFg } from './utils';
import { cacheOrFetch, TTL } from '../lib/apiCache';

// Kept for the existing tests and for anything that imported the renderer from here.
export { MarkdownRenderer };

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MdFile {
  relativePath: string;
  name: string;
  category: string;
  content: string;
}

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

type Navigate = (v: ViewState) => void;

// ─── Utilities ─────────────────────────────────────────────────────────────

async function ghFetch<T>(type: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams({ type, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  // Cache read-only GitHub GETs by their full query string (F7) — the qs encodes
  // type + all params, so distinct requests get distinct keys. TTL.MEDIUM keeps
  // us off GitHub's rate limit while staying fresh enough for docs/issue lists.
  // cacheOrFetch never caches a throw, so the !ok error path is unchanged.
  return cacheOrFetch<T>(
    `docs:${qs.toString()}`,
    async () => {
      const res = await fetch(`/api/docs/github?${qs}`);
      if (!res.ok) throw new Error(`GitHub ${res.status}`);
      return res.json() as Promise<T>;
    },
    TTL.MEDIUM,
  );
}

/** Loads `load()` whenever `deps` change; `retry()` runs it again (for LoadError). */
function useGh<T>(load: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    load()
      .then(d => { if (live) setData(d); })
      .catch(e => { if (live) setError(e.message || 'error'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);
  return { data, loading, error, retry: () => setAttempt(a => a + 1) };
}

const th = (lang: Lang, a: string, b: string) => (lang === 'th' ? a : b);

// ─── Small Components ───────────────────────────────────────────────────────

/** GitHub label: the colour is the label's own data, so it stays inline rather than a token. */
function LabelBadge({ label }: { label: GHLabel }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full px-2 py-px text-[11px] font-medium" style={{ backgroundColor: `#${label.color}`, color: labelFg(label.color) }}>
      {label.name}
    </span>
  );
}

function IssueStateIcon({ state }: { state: string }) {
  if (state === 'closed') return <CheckCircle2 aria-hidden size={16} className="shrink-0 text-ink-3" />;
  return <Circle aria-hidden size={16} className="shrink-0 text-ok" />;
}

function PRStateIcon({ state, draft, merged }: { state: string; draft: boolean; merged: boolean }) {
  if (merged || state === 'merged') return <GitMerge aria-hidden size={16} className="shrink-0 text-accent" />;
  if (state === 'closed') return <XCircle aria-hidden size={16} className="shrink-0 text-danger" />;
  if (draft) return <GitPullRequest aria-hidden size={16} className="shrink-0 text-ink-3" />;
  return <GitPullRequest aria-hidden size={16} className="shrink-0 text-ok" />;
}

function StateBadge({ state, draft, merged }: { state: string; draft?: boolean; merged?: boolean }) {
  const lang = useLang();
  if (merged) return <Badge tone="accent">{th(lang, 'ผสานแล้ว', 'Merged')}</Badge>;
  if (state === 'closed') return <Badge tone="danger">{th(lang, 'ปิดแล้ว', 'Closed')}</Badge>;
  if (draft) return <Badge>{th(lang, 'ร่าง', 'Draft')}</Badge>;
  return <Badge tone="ok">{th(lang, 'เปิดอยู่', 'Open')}</Badge>;
}

function Meta({ children }: { children: React.ReactNode }) {
  return <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-3">{children}</div>;
}

function StateFilter({ value, onChange }: { value: 'open' | 'closed' | 'all'; onChange: (s: 'open' | 'closed' | 'all') => void }) {
  const lang = useLang();
  const states = [
    { key: 'open' as const, label: th(lang, 'เปิดอยู่', 'Open') },
    { key: 'closed' as const, label: th(lang, 'ปิดแล้ว', 'Closed') },
    { key: 'all' as const, label: th(lang, 'ทั้งหมด', 'All') },
  ];
  return (
    <div role="group" aria-label={th(lang, 'กรองสถานะ', 'Filter by state')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {states.map(s => <Pill key={s.key} selected={value === s.key} onClick={() => onChange(s.key)}>{s.label}</Pill>)}
    </div>
  );
}

function Pager({ page, hasNext, onPage }: { page: number; hasNext: boolean; onPage: (p: number) => void }) {
  const lang = useLang();
  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
      <Button size="md" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft aria-hidden size={15} /> {th(lang, 'ก่อนหน้า', 'Previous')}</Button>
      <span className="font-mono text-xs tabular-nums text-ink-3">{th(lang, `หน้า ${page}`, `Page ${page}`)}</span>
      <Button size="md" disabled={!hasNext} onClick={() => onPage(page + 1)}>{th(lang, 'ถัดไป', 'Next')} <ChevronRight aria-hidden size={15} /></Button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line py-14 text-center text-sm text-ink-3">{children}</div>;
}

const ROW = 'group -mx-3 flex items-start gap-3 rounded-2xl px-3 py-3.5 transition-colors duration-[var(--t1)] hover:bg-fill active:bg-fill';

function Author({ user, size = 16 }: { user: GHUser; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Image src={user.avatar_url} alt="" width={size} height={size} className="rounded-full" style={{ width: size, height: size }} />
      {user.login}
    </span>
  );
}

// ─── Doc View ───────────────────────────────────────────────────────────────

function DocView({ file, mdFiles, navigate }: { file: string; mdFiles: MdFile[]; navigate: Navigate }) {
  const lang = useLang();
  const idx = mdFiles.findIndex(f => f.relativePath === file);
  const doc = mdFiles[idx];
  const prev = idx > 0 ? mdFiles[idx - 1] : null;
  const next = idx >= 0 && idx < mdFiles.length - 1 ? mdFiles[idx + 1] : null;

  // A document written in one language only is translated when the other is chosen; the reader can
  // flip back to what was written. Everything below (outline, reading time, body) follows what is shown.
  const tr = useDocTranslation(file, doc?.content ?? '', lang);
  const [showOriginal, setShowOriginal] = useState(false);

  // The document is shown in pieces (see DocBody): the written text, or the translated one while it arrives.
  const translated = !showOriginal && tr.units !== null;
  const written = useMemo(
    () => (translated ? [] : splitParts(doc ? filterLangBlocks(doc.content, lang) : '').map(p => p.original)),
    [doc, lang, translated],
  );
  const units = translated ? tr.units! : written;
  const { headings, ids } = useMemo(() => headingsOfUnits(units), [units]);
  const minutes = useMemo(() => readingMinutes(units.join('\n\n')), [units]);
  const [mounted, setMounted] = useState(INITIAL_UNITS);

  // A heading inside a piece that is not on the page yet (outline click, `#link`, shared URL): render up to it first.
  // `reveal` reads the map through a ref so its identity never changes: it sits in a context every rendered piece
  // reads, and a new function each time a translation piece arrives would re-render all of them.
  const unitOf = useMemo(() => new Map(ids.flatMap((list, i) => list.map((id): [string, number] => [id, i]))), [ids]);
  const unitOfRef = useRef(unitOf);
  useEffect(() => { unitOfRef.current = unitOf; }, [unitOf]);
  const reveal = useCallback(async (id: string) => {
    const i = unitOfRef.current.get(id);
    if (i === undefined) return;
    setMounted(n => Math.max(n, i + 2));
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  }, []);

  // Lets the Markdown resolve relative links and images the way GitHub does, and keeps a link to another
  // document inside the site.
  const docPaths = useMemo(() => new Set(mdFiles.map(f => f.relativePath)), [mdFiles]);
  const docContext = useMemo(() => ({ file, docPaths, navigate, reveal }), [file, docPaths, navigate, reveal]);

  // Arriving on `#section` (from a link, or a shared URL): scroll to it once the document has rendered.
  useEffect(() => {
    let id = window.location.hash.slice(1);
    try { id = decodeURIComponent(id); } catch { /* use it as written */ }
    if (!id) return;
    const t = setTimeout(() => { void reveal(id).then(() => document.getElementById(id)?.scrollIntoView({ block: 'start' })); }, 120);
    return () => clearTimeout(t);
    // Only on arrival: a translation piece landing later must not scroll the reader back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  if (!doc) return <Empty>{th(lang, 'ไม่พบเอกสาร', 'Document not found')}</Empty>;

  const hasTitle = units.slice(0, 2).some(u => /^# /m.test(u));
  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,44rem)_13rem] xl:gap-10">
      <article className="min-w-0">
        <header className="relative mb-6 sm:mb-8">
          <DotCorner />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 pt-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-ink-3">
                <span>{th(lang, 'เอกสาร', 'Docs')}</span>
                <ChevronRight aria-hidden size={11} />
                <span className="min-w-0 truncate">{doc.category}</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{th(lang, `อ่าน ~${minutes} นาที`, `~${minutes} min read`)}</span>
              </div>
              <p className="mt-2 hidden truncate font-mono text-[11px] text-ink-3 sm:block">{doc.relativePath}</p>
            </div>
            <a
              href={githubBlobUrl(doc.relativePath)}
              target="_blank"
              rel="noreferrer"
              aria-label={th(lang, 'แก้ไขบน GitHub', 'Edit on GitHub')}
              className={buttonClass('ghost', 'sm', '-mr-2 shrink-0 max-sm:!h-11 max-sm:!w-11 max-sm:!min-h-11 max-sm:!px-0')}
            >
              <ExternalLink aria-hidden size={14} />
              <span className="max-sm:sr-only">{th(lang, 'แก้ไขบน GitHub', 'Edit on GitHub')}</span>
            </a>
          </div>
        </header>

        <DocOutline headings={headings} variant="inline" reveal={reveal} />
        {!hasTitle && <h1 className="mb-6 text-[clamp(1.75rem,5.4vw,2.6rem)] font-semibold leading-[1.2] text-ink">{doc.name}</h1>}
        <TranslationNotice status={tr.status} failed={tr.failed} showOriginal={showOriginal} onToggle={() => setShowOriginal(v => !v)} onRetry={tr.retry} />
        <TranslationProgressCard status={tr.status} finished={tr.finished} total={tr.total} failed={tr.failed} waiting={tr.waiting} showOriginal={showOriginal} />
        <DocContext.Provider value={docContext}>
          <DocBody units={units} ids={ids} mounted={mounted} setMounted={setMounted} />
        </DocContext.Provider>

        <nav aria-label={th(lang, 'เอกสารก่อนหน้า/ถัดไป', 'Previous and next document')} className="mt-16 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
          {prev ? (
            <DocLink view={{ type: 'doc', file: prev.relativePath }} navigate={navigate} className="group">
              <Card interactive className="flex h-full items-center gap-3 px-5 py-4">
                <ChevronLeft aria-hidden size={16} className="shrink-0 text-ink-3 transition-transform duration-[var(--t2)] ease-[var(--ease)] group-hover:-translate-x-1" />
                <span className="min-w-0">
                  <span className="block font-mono text-[11px] text-ink-3">{th(lang, 'ก่อนหน้า', 'Previous')}</span>
                  <span className="mt-0.5 block truncate text-sm font-medium text-ink">{prev.name}</span>
                </span>
              </Card>
            </DocLink>
          ) : <span />}
          {next ? (
            <DocLink view={{ type: 'doc', file: next.relativePath }} navigate={navigate} className="group">
              <Card interactive className="flex h-full items-center justify-end gap-3 px-5 py-4 text-right">
                <span className="min-w-0">
                  <span className="block font-mono text-[11px] text-ink-3">{th(lang, 'ถัดไป', 'Next')}</span>
                  <span className="mt-0.5 block truncate text-sm font-medium text-ink">{next.name}</span>
                </span>
                <ChevronRight aria-hidden size={16} className="shrink-0 text-ink-3 transition-transform duration-[var(--t2)] ease-[var(--ease)] group-hover:translate-x-1" />
              </Card>
            </DocLink>
          ) : <span />}
        </nav>
      </article>
      <DocOutline headings={headings} variant="rail" reveal={reveal} />
    </div>
  );
}

// ─── GitHub Issues ──────────────────────────────────────────────────────────

function IssuesListView({ page, onPage, navigate }: { page: number; onPage: (p: number) => void; navigate: Navigate }) {
  const lang = useLang();
  const [activeState, setActiveState] = useState<'open' | 'closed' | 'all'>('open');
  const { data, loading, error, retry } = useGh(
    // The issues endpoint also returns pull requests: drop them, but remember the raw page size —
    // "is there a next page" is about what GitHub sent, not what is left after filtering.
    () => ghFetch<GHIssue[]>('issues', { state: activeState, page, per_page: 20 }).then(d => {
      const all = Array.isArray(d) ? d : [];
      return { raw: all.length, items: all.filter(i => !i.pull_request) };
    }),
    [activeState, page],
  );
  const issues = data?.items ?? [];

  return (
    <div>
      <PageHeader navigate={navigate} crumbs={[{ label: 'GitHub' }, { label: 'Issues' }]} title={th(lang, 'รายการปัญหา', 'Issues')}>
        <StateFilter value={activeState} onChange={s => { setActiveState(s); onPage(1); }} />
      </PageHeader>

      {loading && <LoadingRows />}
      {error && <LoadError what="Issues" onRetry={retry} />}
      {!loading && !error && issues.length === 0 && <Empty>{th(lang, 'ไม่มี issue ในสถานะนี้', 'No issues in this state.')}</Empty>}

      {!loading && !error && issues.length > 0 && (
        <ul>
          {issues.map(issue => (
            <li key={issue.number}>
              <DocLink view={{ type: 'gh-issue', number: issue.number }} navigate={navigate} className={ROW}>
                <span className="mt-[0.2rem]"><IssueStateIcon state={issue.state} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span className="text-[0.9375rem] font-medium leading-snug text-ink [overflow-wrap:anywhere]">{issue.title}</span>
                    {issue.labels.map(l => <LabelBadge key={l.name} label={l} />)}
                  </span>
                  <Meta>
                    <span>#{issue.number}</span>
                    <span>{relativeDate(issue.created_at)}</span>
                    <span>{th(lang, `โดย ${issue.user.login}`, `by ${issue.user.login}`)}</span>
                    {issue.comments > 0 && <span className="inline-flex items-center gap-1"><MessageCircle aria-hidden size={11} />{issue.comments}</span>}
                  </Meta>
                </span>
                <ChevronRight aria-hidden size={15} className="mt-1 shrink-0 text-ink-3 transition-transform duration-[var(--t2)] ease-[var(--ease)] group-hover:translate-x-0.5 group-hover:text-ink" />
              </DocLink>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && <Pager page={page} hasNext={(data?.raw ?? 0) >= 20} onPage={onPage} />}
    </div>
  );
}

function IssueDetailView({ number, navigate }: { number: number; navigate: Navigate }) {
  const lang = useLang();
  const { data, loading, error, retry } = useGh(
    () => Promise.all([ghFetch<GHIssue>('issue', { number }), ghFetch<GHComment[]>('issue_comments', { number })]),
    [number],
  );
  const issue = data?.[0];
  const comments = Array.isArray(data?.[1]) ? data![1] : [];
  const list: ViewState = { type: 'gh-issues', state: 'open', page: 1 };

  return (
    <div>
      {loading && <LoadingRows rows={4} />}
      {error && <LoadError what={`Issue #${number}`} onRetry={retry} />}

      {!loading && !error && issue && (
        <>
          <PageHeader navigate={navigate} crumbs={[{ label: 'GitHub' }, { label: 'Issues', view: list }, { label: `#${issue.number}` }]} title={issue.title}>
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge state={issue.state} />
              {issue.labels.map(l => <LabelBadge key={l.name} label={l} />)}
            </div>
            <Meta>
              <Author user={issue.user} />
              <span>{th(lang, `เปิดเมื่อ ${relativeDate(issue.created_at)}`, `Opened ${relativeDate(issue.created_at)}`)}</span>
              <span>{th(lang, `อัปเดต ${relativeDate(issue.updated_at)}`, `Updated ${relativeDate(issue.updated_at)}`)}</span>
              <a href={issue.html_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 sm:min-h-8 items-center gap-1 text-accent hover:underline"><ExternalLink aria-hidden size={11} /> GitHub</a>
            </Meta>
          </PageHeader>

          {issue.body ? (
            <div className="mb-10 border-b border-line pb-8"><MarkdownRenderer content={issue.body} /></div>
          ) : (
            <p className="mb-8 text-sm text-ink-3">{th(lang, 'ไม่มีรายละเอียดเพิ่มเติม', 'No description provided.')}</p>
          )}

          {comments.length > 0 && (
            <section aria-labelledby="comments-h">
              <h2 id="comments-h" className="mb-4 font-mono text-xs text-ink-3">{th(lang, `ความคิดเห็น · ${comments.length}`, `Comments · ${comments.length}`)}</h2>
              <div className="space-y-4">
                {comments.map(c => (
                  <Card key={c.id} className="overflow-hidden !rounded-2xl">
                    <div className="flex items-center gap-3 border-b border-line bg-raised px-4 py-3 text-[13px] font-medium text-ink">
                      <Author user={c.user} size={20} />
                      <span className="ml-auto font-mono text-[11px] font-normal text-ink-3">{relativeDate(c.created_at)}</span>
                    </div>
                    <div className="px-4 py-2"><MarkdownRenderer content={c.body} /></div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ─── GitHub Pull Requests ───────────────────────────────────────────────────

function PullsListView({ page, onPage, navigate }: { page: number; onPage: (p: number) => void; navigate: Navigate }) {
  const lang = useLang();
  const [activeState, setActiveState] = useState<'open' | 'closed' | 'all'>('all');
  const { data, loading, error, retry } = useGh(
    () => ghFetch<GHPull[]>('pulls', { state: activeState, page, per_page: 20 }).then(d => (Array.isArray(d) ? d : [])),
    [activeState, page],
  );
  const pulls = data ?? [];

  return (
    <div>
      <PageHeader navigate={navigate} crumbs={[{ label: 'GitHub' }, { label: 'Pull Requests' }]} title="Pull Requests">
        <StateFilter value={activeState} onChange={s => { setActiveState(s); onPage(1); }} />
      </PageHeader>

      {loading && <LoadingRows />}
      {error && <LoadError what="Pull Requests" onRetry={retry} />}
      {!loading && !error && pulls.length === 0 && <Empty>{th(lang, 'ไม่มี pull request ในสถานะนี้', 'No pull requests in this state.')}</Empty>}

      {!loading && !error && pulls.length > 0 && (
        <ul>
          {pulls.map(pr => (
            <li key={pr.number}>
              <DocLink view={{ type: 'gh-pull', number: pr.number }} navigate={navigate} className={ROW}>
                <span className="mt-[0.2rem]"><PRStateIcon state={pr.state} draft={pr.draft} merged={!!pr.merged_at} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span className="text-[0.9375rem] font-medium leading-snug text-ink [overflow-wrap:anywhere]">{pr.title}</span>
                    {pr.draft && <Badge>draft</Badge>}
                    {pr.labels.map(l => <LabelBadge key={l.name} label={l} />)}
                  </span>
                  <Meta>
                    <span>#{pr.number}</span>
                    <span className="[overflow-wrap:anywhere]">{pr.head.ref} → {pr.base.ref}</span>
                    <span>{relativeDate(pr.created_at)}</span>
                    <span>{th(lang, `โดย ${pr.user.login}`, `by ${pr.user.login}`)}</span>
                  </Meta>
                </span>
                <ChevronRight aria-hidden size={15} className="mt-1 shrink-0 text-ink-3 transition-transform duration-[var(--t2)] ease-[var(--ease)] group-hover:translate-x-0.5 group-hover:text-ink" />
              </DocLink>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && <Pager page={page} hasNext={pulls.length >= 20} onPage={onPage} />}
    </div>
  );
}

function PullDetailView({ number, navigate }: { number: number; navigate: Navigate }) {
  const lang = useLang();
  const { data: pr, loading, error, retry } = useGh(() => ghFetch<GHPull>('pull', { number }), [number]);
  const list: ViewState = { type: 'gh-pulls', state: 'all', page: 1 };

  return (
    <div>
      {loading && <LoadingRows rows={4} />}
      {error && <LoadError what={`PR #${number}`} onRetry={retry} />}

      {!loading && !error && pr && (
        <>
          <PageHeader navigate={navigate} crumbs={[{ label: 'GitHub' }, { label: 'Pull Requests', view: list }, { label: `#${pr.number}` }]} title={pr.title}>
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge state={pr.state} draft={pr.draft} merged={!!pr.merged_at} />
              {pr.labels.map(l => <LabelBadge key={l.name} label={l} />)}
            </div>
            <Meta>
              <Author user={pr.user} />
              <span className="rounded-md bg-fill px-2 py-0.5 text-ink-2 [overflow-wrap:anywhere]">{pr.head.ref} → {pr.base.ref}</span>
              <span>{relativeDate(pr.created_at)}</span>
              {pr.merged_at && <span>{th(lang, `ผสานเมื่อ ${relativeDate(pr.merged_at)}`, `Merged ${relativeDate(pr.merged_at)}`)}</span>}
            </Meta>
            {(pr.additions !== undefined || pr.changed_files !== undefined) && (
              <Meta>
                {pr.additions !== undefined && <span className="text-ok">+{pr.additions}</span>}
                {pr.deletions !== undefined && <span className="text-danger">−{pr.deletions}</span>}
                {pr.changed_files !== undefined && <span>{th(lang, `${pr.changed_files} ไฟล์ที่เปลี่ยนแปลง`, `${pr.changed_files} files changed`)}</span>}
              </Meta>
            )}
            <a href={pr.html_url} target="_blank" rel="noreferrer" className={buttonClass('secondary', 'sm', 'mt-4')}>
              <ExternalLink aria-hidden size={13} /> {th(lang, 'ดูใน GitHub', 'View on GitHub')}
            </a>
          </PageHeader>

          {pr.body ? <MarkdownRenderer content={pr.body} /> : <p className="text-sm text-ink-3">{th(lang, 'ไม่มีรายละเอียดเพิ่มเติม', 'No description provided.')}</p>}
        </>
      )}
    </div>
  );
}

// ─── GitHub Branches ────────────────────────────────────────────────────────

function BranchesView({ navigate }: { navigate: Navigate }) {
  const lang = useLang();
  const { data, loading, error, retry } = useGh(() => ghFetch<GHBranch[]>('branches').then(d => (Array.isArray(d) ? d : [])), []);
  const branches = data ?? [];

  return (
    <div>
      <PageHeader navigate={navigate} crumbs={[{ label: 'GitHub' }, { label: th(lang, 'สาขา', 'Branches') }]} title={th(lang, 'สาขาทั้งหมด', 'All Branches')} />

      {loading && <LoadingRows />}
      {error && <LoadError what={th(lang, 'สาขา', 'Branches')} onRetry={retry} />}

      {!loading && !error && (
        <ul>
          {branches.map(b => (
            <li key={b.name} className="-mx-3 flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors duration-[var(--t1)] hover:bg-fill">
              <GitBranch aria-hidden size={15} className={`shrink-0 ${b.name === 'main' ? 'text-accent' : 'text-ink-3'}`} />
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`font-mono text-[13px] [overflow-wrap:anywhere] ${b.name === 'main' ? 'text-accent' : 'text-ink'}`}>{b.name}</span>
                {b.name === 'main' && <Badge tone="accent">default</Badge>}
                {b.protected && <Badge><Lock aria-hidden size={10} className="mr-1" />{th(lang, 'ป้องกัน', 'protected')}</Badge>}
              </span>
              <span className="font-mono text-[11px] text-ink-3">{b.commit.sha.slice(0, 7)}</span>
              <a
                href={`${REPO_URL}/tree/${b.name}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`${b.name} on GitHub`}
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors duration-[var(--t1)] hover:text-ink"
              >
                <ExternalLink aria-hidden size={14} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

function viewKey(v: ViewState): string {
  if (v.type === 'doc') return `doc:${v.file}`;
  if (v.type === 'gh-issue') return `gh-issue:${v.number}`;
  if (v.type === 'gh-pull') return `gh-pull:${v.number}`;
  return v.type;
}

/** Short label for the phone's app bar: where you are, in two lines (kind · title). */
function barLabel(v: ViewState, mdFiles: MdFile[], lang: Lang): { kind: string; title: string } {
  switch (v.type) {
    case 'overview': return { kind: 'Docs', title: th(lang, 'ภาพรวมระบบ', 'System Overview') };
    case 'techstack': return { kind: 'Docs', title: 'Tech Stack' };
    case 'simulations': return { kind: 'Docs', title: 'Simulations' };
    case 'doc': { const f = mdFiles.find(m => m.relativePath === v.file); return { kind: f?.category ?? 'Docs', title: f?.name ?? '' }; }
    case 'gh-issues': return { kind: 'GitHub', title: 'Issues' };
    case 'gh-issue': return { kind: 'GitHub · Issues', title: `#${v.number}` };
    case 'gh-pulls': return { kind: 'GitHub', title: 'Pull Requests' };
    case 'gh-pull': return { kind: 'GitHub · PRs', title: `#${v.number}` };
    case 'gh-branches': return { kind: 'GitHub', title: th(lang, 'สาขา', 'Branches') };
  }
}

export default function DocsClient({ mdFiles, initialView }: { mdFiles: MdFile[]; initialView: ViewState }) {
  const [view, setView] = useState<ViewState>(initialView);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lang, setLang] = useState<Lang>('th');

  // Each view has its own URL (see routes.ts). We push history entries ourselves instead of
  // re-rendering the server page, so sidebar state and language survive navigation.
  const navigate = useCallback((v: ViewState) => {
    setView(v);
    setSheetOpen(false);
    const path = viewToPath(v);
    if (path !== window.location.pathname) window.history.pushState(null, '', path);
    window.scrollTo({ top: 0 });
  }, []);

  // pushState does not re-run the server's metadata, so the tab title follows the view here.
  useEffect(() => { document.title = viewTitle(view, mdFiles); }, [view, mdFiles]);

  // Back/forward: rebuild the view from the URL.
  useEffect(() => {
    const docPaths = mdFiles.map(f => f.relativePath);
    const onPop = () => {
      const segments = window.location.pathname.slice(DOCS_BASE.length).split('/').filter(Boolean);
      const v = pathToView(segments, docPaths);
      if (v) { setView(v); setSheetOpen(false); } else window.location.reload();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [mdFiles]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const bar = barLabel(view, mdFiles, lang);
  const isDoc = view.type === 'doc';
  const nav = (extra: { onDone?: () => void; desktop?: boolean }) => (
    <DocsNav mdFiles={mdFiles} view={view} navigate={navigate} setLang={setLang}
      onDone={extra.onDone} autoFocusShortcut={extra.desktop} />
  );

  function renderContent() {
    switch (view.type) {
      case 'overview':
        return <OverviewView onOpenSimulations={() => navigate({ type: 'simulations' })} />;
      case 'techstack':
        return <TechStackView />;
      case 'simulations':
        return null;
      case 'doc':
        return <DocView file={view.file} mdFiles={mdFiles} navigate={navigate} />;
      case 'gh-issues':
        return <IssuesListView page={view.page} navigate={navigate} onPage={p => setView(v => (v.type === 'gh-issues' ? { ...v, page: p } : v))} />;
      case 'gh-issue':
        return <IssueDetailView number={view.number} navigate={navigate} />;
      case 'gh-pulls':
        return <PullsListView page={view.page} navigate={navigate} onPage={p => setView(v => (v.type === 'gh-pulls' ? { ...v, page: p } : v))} />;
      case 'gh-pull':
        return <PullDetailView number={view.number} navigate={navigate} />;
      case 'gh-branches':
        return <BranchesView navigate={navigate} />;
    }
  }

  return (
    <LangContext.Provider value={lang}>
      <SheetOpenContext.Provider value={sheetOpen}>
      <div className="min-h-dvh bg-bg text-ink lg:flex">
        {isDoc && <ReadingProgress />}

        {/* Sidebar — desktop */}
        <aside className="hidden w-[17.5rem] shrink-0 border-r border-line lg:block">
          <div className="sticky top-0 h-dvh">{nav({ desktop: true })}</div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* App bar — phone: where you are + the menu, always in reach */}
          <header className="sticky top-0 z-30 border-b border-line bg-bg pt-[env(safe-area-inset-top)] lg:hidden">
            <div className="flex h-14 items-center gap-1 px-2">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label={th(lang, 'เปิดเมนูเอกสาร', 'Open docs menu')}
                aria-expanded={sheetOpen}
                aria-haspopup="dialog"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors duration-[var(--t1)] hover:bg-fill hover:text-ink active:translate-y-px"
              >
                <Menu aria-hidden size={20} />
              </button>
              <div className="min-w-0 flex-1 px-1">
                <p className="truncate font-mono text-[10.5px] leading-tight text-ink-3">{bar.kind}</p>
                <p className="truncate text-[0.9375rem] font-medium leading-tight text-ink">{bar.title}</p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center"><ThemeToggle /></div>
            </div>
          </header>

          {view.type === 'simulations' ? (
            <main id="main" tabIndex={-1} className="h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] overflow-hidden lg:h-dvh">
              <SimulationsView />
            </main>
          ) : (
            <main id="main" tabIndex={-1} className="px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-7 sm:px-8 lg:pb-24 lg:pt-14">
              <div key={viewKey(view)} className={`tab-fade-in mx-auto w-full ${isDoc ? 'max-w-[44rem] xl:max-w-[62rem]' : 'max-w-[44rem]'}`}>
                {renderContent()}
              </div>
            </main>
          )}
        </div>

        {/* Navigation sheet — phone */}
        <DocsSheet open={sheetOpen} onClose={closeSheet} label={th(lang, 'เมนูเอกสาร', 'Docs menu')}>
          {nav({ onDone: closeSheet })}
        </DocsSheet>
      </div>
      </SheetOpenContext.Provider>
    </LangContext.Provider>
  );
}
