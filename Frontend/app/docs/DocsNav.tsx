'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import {
  AlertCircle, BookOpen, ChevronDown, Cpu, ExternalLink, FileText, GitBranch, GitPullRequest,
  LayoutDashboard, Layers, Search, X, Zap,
} from 'lucide-react';
import Pill from '../components/ui/Pill';
import Input from '../components/ui/Input';
import ThemeToggle from '../components/ThemeToggle';
import Mascot from '../components/mascot/Mascot';
import { useReducedMotion, scrollBehavior } from '../hooks/reducedMotion';
import { useModalDialog } from '../hooks/useDialogFocus';
import { isTypingTarget } from '../lib/typingTarget';
import { lockPageScroll } from '../lib/scrollLock';
import { useLang, type Lang } from './lang-context';
import { DocLink } from './DocsParts';
import { REPO_URL } from './resolveHref';
import Collapse from './Collapse';
import type { MdFile } from './DocsClient';
import type { ViewState } from './routes';

// The navigation, shared by the desktop sidebar and the phone's bottom sheet (same component, so
// the two can never drift apart). Every item is a real link — see DocLink.

const CATEGORY_ICONS: Record<string, typeof FileText> = { 'หลัก': FileText, 'เอกสาร': BookOpen, 'Agent Guides': Layers };

const OV_SECTIONS = [
  { id: 'ov-hero', th: 'ภาพรวม', en: 'Overview' },
  { id: 'ov-frontend', th: 'Frontend', en: 'Frontend' },
  { id: 'ov-backend', th: 'Backend', en: 'Backend' },
  { id: 'ov-mit', th: 'MIT', en: 'MIT' },
  { id: 'ov-supabase', th: 'Supabase', en: 'Supabase' },
  { id: 'ov-t4', th: 'T4-STANDARD', en: 'T4-STANDARD' },
];

const ITEM = 'relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[0.875rem] transition-colors duration-[var(--t1)] lg:min-h-9 lg:text-[0.8125rem]';
const itemClass = (active: boolean) =>
  `${ITEM} ${active ? 'bg-fill font-medium text-ink' : 'text-ink-2 hover:bg-fill hover:text-ink'}`;

function isActive(target: ViewState, view: ViewState): boolean {
  if (target.type === 'doc') return view.type === 'doc' && view.file === target.file;
  if (target.type === 'gh-issues') return view.type === 'gh-issues' || view.type === 'gh-issue';
  if (target.type === 'gh-pulls') return view.type === 'gh-pulls' || view.type === 'gh-pull';
  return view.type === target.type;
}

function jumpToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const offset = window.matchMedia('(min-width: 1024px)').matches ? 24 : 72;
  window.scrollTo({
    top: el.getBoundingClientRect().top + window.scrollY - offset,
    behavior: scrollBehavior(),
  });
}

function useSectionSpy(enabled: boolean) {
  const [active, setActive] = useState(OV_SECTIONS[0].id);
  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      let cur = OV_SECTIONS[0].id;
      for (const s of OV_SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 140) cur = s.id;
      }
      setActive(cur);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [enabled]);
  return active;
}

function GroupLabel({ icon, children, count }: { icon?: ReactNode; children: ReactNode; count?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-ink-3">
      {icon}
      <span className="truncate">{children}</span>
      {count !== undefined && <span className="tabular-nums">· {count}</span>}
    </span>
  );
}

/** Lowercased text of every document, built once per document list and shared by every menu that searches it. */
const loweredCache = new WeakMap<MdFile[], string[]>();
function lowered(mdFiles: MdFile[]): string[] {
  let v = loweredCache.get(mdFiles);
  if (!v) { v = mdFiles.map(f => `${f.name}\n${f.content}`.toLowerCase()); loweredCache.set(mdFiles, v); }
  return v;
}

export default function DocsNav({ mdFiles, view, navigate, setLang, onDone, autoFocusShortcut }: {
  mdFiles: MdFile[];
  view: ViewState;
  navigate: (v: ViewState) => void;
  setLang: (l: Lang) => void;
  onDone?: () => void;
  /** Desktop only: "/" focuses the search box. */
  autoFocusShortcut?: boolean;
}) {
  const lang = useLang();
  const th = lang === 'th';
  const searchRef = useRef<HTMLInputElement>(null);
  // Typing here must not re-render the document behind the menu, so the text lives in the menu itself.
  const [search, setSearch] = useState('');
  const spy = useSectionSpy(view.type === 'overview');
  const go = (v: ViewState) => { navigate(v); onDone?.(); };

  useEffect(() => {
    if (!autoFocusShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [autoFocusShortcut]);

  const categories = useMemo(() => {
    const map = new Map<string, MdFile[]>();
    for (const f of mdFiles) {
      if (!map.has(f.category)) map.set(f.category, []);
      map.get(f.category)!.push(f);
    }
    return map;
  }, [mdFiles]);

  // The scan over every document runs a beat behind the keystroke, so the field itself never lags.
  const q = useDeferredValue(search).trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return categories;
    const text = lowered(mdFiles);
    const at = new Map(mdFiles.map((f, i) => [f, i] as const));
    const result = new Map<string, MdFile[]>();
    for (const [cat, files] of categories) {
      const hit = files.filter(f => text[at.get(f)!].includes(q));
      if (hit.length) result.set(cat, hit);
    }
    return result;
  }, [categories, mdFiles, q]);
  const resultCount = useMemo(() => [...filtered.values()].reduce((n, f) => n + f.length, 0), [filtered]);

  // The category holding the open document is expanded; the rest stay folded until opened (or searched).
  const activeCategory = view.type === 'doc' ? mdFiles.find(f => f.relativePath === view.file)?.category : undefined;
  const [opened, setOpened] = useState<Set<string>>(() => new Set(activeCategory ? [activeCategory] : []));
  // Moving to a document in another category opens that category (state adjusted during render, not in an effect).
  const [shownCategory, setShownCategory] = useState(activeCategory);
  if (activeCategory !== shownCategory) {
    setShownCategory(activeCategory);
    if (activeCategory) setOpened(prev => (prev.has(activeCategory) ? prev : new Set(prev).add(activeCategory)));
  }
  const toggle = (cat: string) => setOpened(prev => { const n = new Set(prev); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; });

  function item(label: string, v: ViewState, icon: ReactNode) {
    const active = isActive(v, view);
    return (
      <DocLink key={label} view={v} navigate={go} aria-current={active ? 'page' : undefined} className={itemClass(active)}>
        {active && <span aria-hidden className="absolute inset-y-2.5 left-0 w-0.5 rounded-full bg-accent" />}
        {icon}
        <span className="min-w-0 truncate">{label}</span>
      </DocLink>
    );
  }
  const ic = 'h-[15px] w-[15px] shrink-0';

  return (
    <nav aria-label={th ? 'เมนูเอกสาร' : 'Docs menu'} className="flex h-full flex-col">
      {/* Brand */}
      <div className="shrink-0 px-5 pb-4 pt-6 lg:pt-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-ink-3">Engineering Hub</p>
            <p className="mt-1 font-serif text-[2.25rem] leading-none text-ink">Docs</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <div className="flex gap-1" role="group" aria-label={th ? 'ภาษา' : 'Language'}>
              {(['th', 'en'] as const).map(l => (
                <Pill key={l} size="sm" selected={lang === l} onClick={() => setLang(l)} className="!min-h-11 !px-3 font-mono uppercase lg:!min-h-8">{l}</Pill>
              ))}
            </div>
            <ThemeToggle className="!h-11 !w-11 lg:!h-8 lg:!w-8" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 px-4 pb-3">
        <div className="relative">
          <Search aria-hidden size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
          <Input
            ref={searchRef}
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); e.currentTarget.blur(); } }}
            placeholder={th ? 'ค้นหาเอกสาร' : 'Search docs'}
            aria-label={th ? 'ค้นหาเอกสาร' : 'Search documentation'}
            enterKeyHint="search"
            className="!min-h-11 pl-10 pr-10 text-base lg:!min-h-10 lg:text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {search ? (
            <button type="button" onClick={() => { setSearch(''); searchRef.current?.focus(); }} aria-label={th ? 'ล้างคำค้นหา' : 'Clear search'}
              className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 transition-colors hover:text-ink">
              <X size={15} />
            </button>
          ) : autoFocusShortcut ? (
            <kbd aria-hidden className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-line px-1.5 font-mono text-[10px] text-ink-3 lg:block">/</kbd>
          ) : null}
        </div>
        {q && <p role="status" className="mt-2 px-1 font-mono text-[11px] text-ink-3">{th ? `พบ ${resultCount} เอกสาร` : `${resultCount} result${resultCount === 1 ? '' : 's'}`}</p>}
      </div>

      {/* Items */}
      <div data-lenis-prevent className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] [scrollbar-width:thin]">
        {!q && (
          <div className="space-y-0.5">
            {item(th ? 'ภาพรวมระบบ' : 'System Overview', { type: 'overview' }, <LayoutDashboard className={ic} />)}
            <Collapse open={view.type === 'overview'}>
              <ul className="my-1 ml-[1.35rem] space-y-px border-l border-line pl-2">
                {OV_SECTIONS.map(s => (
                  <li key={s.id}>
                    <button type="button" onClick={() => { jumpToSection(s.id); onDone?.(); }} aria-current={spy === s.id ? 'location' : undefined}
                      className={`flex min-h-11 w-full items-center rounded-lg px-2.5 text-left text-[0.8125rem] transition-colors duration-[var(--t1)] lg:min-h-8 lg:text-xs ${spy === s.id ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}>
                      {th ? s.th : s.en}
                    </button>
                  </li>
                ))}
              </ul>
            </Collapse>
            {item('Tech Stack', { type: 'techstack' }, <Cpu className={ic} />)}
            {item('Simulations', { type: 'simulations' }, <Zap className={ic} />)}
          </div>
        )}

        {Array.from(filtered.entries()).map(([cat, files]) => {
          const Icon = CATEGORY_ICONS[cat] ?? FileText;
          const open = !!q || opened.has(cat);
          return (
            <div key={cat} data-open={open} className="group/cat">
              <button type="button" aria-expanded={open} onClick={() => !q && toggle(cat)}
                className="flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 transition-colors duration-[var(--t1)] hover:bg-fill">
                <GroupLabel icon={<Icon aria-hidden size={12} className="shrink-0" />} count={files.length}>{cat}</GroupLabel>
                <ChevronDown aria-hidden size={14} className={`shrink-0 text-ink-3 transition-transform duration-[var(--t2)] ease-[var(--ease)] ${open ? '' : '-rotate-90'}`} />
              </button>
              <Collapse open={open}>
                <div className="space-y-0.5 pt-0.5">
                    {/* Opening: the rows settle in one after another (Strata stagger). The box itself grows at
                        once, and a long list would otherwise reveal its visible part in a blink. Closing: no delay. */}
                    {files.map((f, i) => (
                      <div
                        key={f.relativePath}
                        className="-translate-y-1.5 opacity-0 transition-[opacity,translate] duration-[var(--t2)] ease-[var(--ease)] group-data-[open=true]/cat:translate-y-0 group-data-[open=true]/cat:opacity-100"
                        style={{ transitionDelay: open ? `${Math.min(i, 12) * 28}ms` : '0ms' }}
                      >
                        {item(f.name, { type: 'doc', file: f.relativePath }, <FileText className={ic} />)}
                      </div>
                    ))}
                </div>
              </Collapse>
            </div>
          );
        })}

        {q && filtered.size === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <Mascot area="search" size={72} />
            <p className="text-sm font-medium text-ink">{th ? 'ไม่พบเอกสารที่ตรงกัน' : 'Nothing matches'}</p>
            <p className="text-xs text-ink-3">{th ? 'ลองคำอื่น หรือสั้นลงอีกนิด' : 'Try another word, or a shorter one.'}</p>
          </div>
        )}

        {!q && (
          <div>
            <p className="px-3 pb-1"><GroupLabel icon={<GitBranch aria-hidden size={12} />}>GitHub</GroupLabel></p>
            <div className="space-y-0.5">
              {item('Issues', { type: 'gh-issues', state: 'open', page: 1 }, <AlertCircle className={ic} />)}
              {item('Pull Requests', { type: 'gh-pulls', state: 'all', page: 1 }, <GitPullRequest className={ic} />)}
              {item(th ? 'สาขา (Branches)' : 'Branches', { type: 'gh-branches' }, <GitBranch className={ic} />)}
            </div>
          </div>
        )}

        <a href={REPO_URL} target="_blank" rel="noreferrer"
          className="flex min-h-11 items-center gap-2 rounded-xl px-3 font-mono text-[11px] text-ink-3 transition-colors duration-[var(--t1)] hover:text-ink">
          <ExternalLink aria-hidden size={12} /> Slow-Inc/MangaDock
        </a>
      </div>
    </nav>
  );
}

/**
 * The phone's navigation: a bottom sheet (thumb reach), not a side drawer. Drag the handle down, tap the scrim
 * or press Esc to close. The page behind it stops scrolling while it is open.
 */
export function DocsSheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const lang = useLang();
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const panel = useRef<HTMLDivElement>(null);

  // The app's own dialog behaviour: focus goes in and back out, Tab stays inside, Esc closes one layer, and the
  // page lock is shared with the reader and the book popup (so closing this over them cannot unlock the page).
  useModalDialog(panel, onClose, open);
  useEffect(() => (open ? lockPageScroll() : undefined), [open]);

  const t = reduce ? { duration: 0 } : { duration: 0.42, ease: [0.23, 1, 0.32, 1] as const };
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-scrim/80"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.25 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 flex h-[86dvh] flex-col rounded-t-[var(--r-card)] border border-b-0 border-line bg-surface outline-none"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={t}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} dragListener={false} dragControls={controls}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) onClose(); }}
          >
            <div className="flex shrink-0 items-center justify-center pt-2.5" style={{ touchAction: 'none' }} onPointerDown={e => controls.start(e)}>
              <button type="button" onClick={onClose} aria-label={lang === 'th' ? 'ปิดเมนู' : 'Close menu'} className="flex h-11 w-24 items-center justify-center">
                <span aria-hidden className="h-1 w-10 rounded-full bg-ink-3/60" />
              </button>
            </div>
            <div className="min-h-0 flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
