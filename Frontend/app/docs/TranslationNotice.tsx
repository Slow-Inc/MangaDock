'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Badge from '../components/ui/Badge';
import Pill from '../components/ui/Pill';
import TranslateProgress from '../components/reader/TranslateProgress';
import type { SegmentState } from '../lib/translationStages';
import { useLang } from './lang-context';
import { useSheetOpen } from './DocsParts';
import type { TranslationStatus } from './useDocTranslation';

/**
 * Sits above a document that is being shown in a language it was not written in: says so (it is a machine
 * translation) and lets the reader switch back to what was written. The wait itself is shown at the bottom
 * of the screen by TranslationProgressCard, the same card the reader uses for an MIT translation.
 */
export default function TranslationNotice({ status, failed, showOriginal, onToggle, onRetry }: {
  status: TranslationStatus;
  failed: number;
  showOriginal: boolean;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const lang = useLang();
  if (status === 'off') return null;
  const th = lang === 'th';
  const from = th ? 'อังกฤษ' : 'Thai';

  let message: string;
  if (showOriginal) message = th ? `กำลังแสดงต้นฉบับ (ภาษา${from})` : `Showing the original (${from})`;
  else if (status === 'translating') message = th ? `กำลังแปลจากภาษา${from}` : `Translating from ${from}`;
  else if (status === 'failed') message = th ? 'แปลไม่สำเร็จ แสดงต้นฉบับแทน' : 'Could not translate; showing the original';
  else if (status === 'partial') message = th ? `แปลแล้ว แต่ ${failed} ส่วนแปลไม่สำเร็จ (แสดงต้นฉบับในส่วนนั้น)` : `Translated, except ${failed} part${failed === 1 ? '' : 's'} (shown as written)`;
  else message = th ? `แปลจากภาษา${from} โดย AI อาจมีความคลาดเคลื่อน` : `Translated from ${from} by AI; it may contain mistakes`;

  return (
    <div role="status" aria-live="polite" className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-fill px-4 py-3">
      <Badge tone={status === 'failed' ? 'danger' : 'accent'}>AI</Badge>
      <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug text-ink-2">{message}</p>
      <div className="flex shrink-0 gap-2">
        {(status === 'failed' || status === 'partial') && !showOriginal && (
          <Pill size="sm" onClick={onRetry} className="!min-h-11 sm:!min-h-9">{th ? 'ลองใหม่' : 'Retry'}</Pill>
        )}
        {status !== 'failed' && (
          <Pill size="sm" selected={showOriginal} onClick={onToggle} className="!min-h-11 sm:!min-h-9">
            {showOriginal ? (th ? 'ดูฉบับแปล' : 'Show translation') : (th ? 'ดูต้นฉบับ' : 'Show original')}
          </Pill>
        )}
      </div>
    </div>
  );
}

const SEGMENTS = 12;

/** One segment per slice of the document (at most 12): done, the one in flight, the rest still to do. */
function segmentsFor(finished: number, total: number): SegmentState[] {
  const n = Math.min(SEGMENTS, Math.max(total, 1));
  const done = Math.floor((finished / Math.max(total, 1)) * n);
  return Array.from({ length: n }, (_, i): SegmentState => (i < done ? 'done' : i === done ? 'active' : 'todo'));
}

/** Seconds since `running` became true (0 when it is not running). */
function useElapsed(running: boolean): number {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    const id = setInterval(() => setSec(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => { clearInterval(id); setSec(0); };
  }, [running]);
  return running ? sec : 0;
}

/**
 * The status of a running document translation, at the bottom of the screen like the reader's "translating
 * from MIT" card (same component): the droid at work, a segmented bar, the running clock. Shown only while
 * parts are still arriving, and never over the original.
 */
export function TranslationProgressCard({ status, finished, total, failed, waiting, showOriginal }: {
  status: TranslationStatus;
  finished: number;
  total: number;
  failed: number;
  /** The backend's per-minute limit was hit; the next part is waiting its turn. */
  waiting: boolean;
  showOriginal: boolean;
}) {
  const lang = useLang();
  const th = lang === 'th';
  const running = status === 'translating' && !showOriginal;
  const elapsed = useElapsed(running);
  const menuOpen = useSheetOpen();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  // The navigation sheet covers the bottom of the screen: the card waits (and keeps counting) until it closes.
  if (!running || menuOpen || !mounted) return null;

  // Portalled to <body>: the page content animates in with a transform, and a `fixed` element inside a
  // transformed box is positioned against that box, not the screen.
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
      <TranslateProgress
        title={th ? `แปลไปแล้ว ${finished}/${total} ส่วน` : `Translated ${finished} of ${total} parts`}
        stage={{ text: th ? 'แปลด้วย AI' : 'Translating with AI', step: finished, total }}
        segments={segmentsFor(finished, total)}
        elapsedSec={elapsed}
        subline={waiting ? (th ? 'ถึงขีดจำกัดการแปลต่อนาที รอสักครู่…' : 'Per-minute translation limit reached, waiting…') : null}
        failed={failed}
      />
    </div>,
    document.body,
  );
}
