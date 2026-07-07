"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Default modal exit animation duration (ms) before unmount. */
export const DEFAULT_MODAL_EXIT_MS = 300;

/**
 * Schedulers + state-setters for the modal transition, injected so the lifecycle
 * is unit-testable without a React renderer (the repo has no renderHook infra).
 * The hook passes the real requestAnimationFrame/setTimeout/React setters.
 */
export interface ModalSchedulers {
  raf: (cb: () => void) => number;
  cancelRaf: (id: number) => void;
  timeout: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer: (id: ReturnType<typeof setTimeout>) => void;
  setVisible: (v: boolean) => void;
  setMounted: (m: boolean) => void;
}

/**
 * Framework-agnostic core of the modal enter/exit lifecycle.
 * enter(): double-rAF — paint once at visible=false, then flip visible=true next frame
 *          (the CLAUDE.md-documented pattern; avoids the transition being skipped).
 * close(): visible=false immediately, then after `duration` ms set mounted=false and
 *          fire onClosed (parent unmount / state reset).
 * cleanup(): cancel any pending frames/timer (call on unmount).
 */
export function createModalTransition(
  s: ModalSchedulers,
  duration: number,
  onClosed?: () => void,
) {
  let raf1 = 0;
  let raf2 = 0;
  let exitTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    enter() {
      raf1 = s.raf(() => {
        raf2 = s.raf(() => s.setVisible(true));
      });
    },
    close() {
      s.setVisible(false);
      if (exitTimer) s.clearTimer(exitTimer);
      exitTimer = s.timeout(() => {
        s.setMounted(false);
        onClosed?.();
      }, duration);
    },
    cleanup() {
      s.cancelRaf(raf1);
      s.cancelRaf(raf2);
      if (exitTimer) s.clearTimer(exitTimer);
    },
  };
}

/**
 * Shared modal enter/exit lifecycle. Returns:
 *  - `mounted`: gate the portal/DOM on this (true while open or animating out).
 *  - `visible`: toggle the CSS transition class on this (opacity/scale/translate).
 *  - `close()`: begin the exit animation; unmount + `onClosed` fire after `duration`.
 *
 * When `isOpen` flips true → mount + double-rAF enter. When it flips false → exit.
 * `duration` (default 300ms) must match each modal's CSS transition so the unmount
 * timing is preserved per modal.
 */
export function useModalTransition(
  isOpen: boolean,
  opts: { duration?: number; onClosed?: () => void } = {},
): { mounted: boolean; visible: boolean; close: () => void } {
  const { duration = DEFAULT_MODAL_EXIT_MS, onClosed } = opts;
  const [mounted, setMounted] = useState(isOpen);
  const [visible, setVisible] = useState(false);

  // Keep the latest onClosed without retriggering the effect.
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  // Hold the core across renders so close()/cleanup share one instance.
  const coreRef = useRef<ReturnType<typeof createModalTransition> | null>(null);

  useEffect(() => {
    const core = createModalTransition(
      {
        raf: (cb) => requestAnimationFrame(cb),
        cancelRaf: (id) => cancelAnimationFrame(id),
        timeout: (cb, ms) => setTimeout(cb, ms),
        clearTimer: (id) => clearTimeout(id),
        setVisible,
        setMounted,
      },
      duration,
      () => onClosedRef.current?.(),
    );
    coreRef.current = core;

    if (isOpen) {
      setMounted(true);
      core.enter();
    } else if (mounted) {
      core.close();
    }

    return () => core.cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, duration]);

  const close = useCallback(() => {
    coreRef.current?.close();
  }, []);

  return { mounted, visible, close };
}
