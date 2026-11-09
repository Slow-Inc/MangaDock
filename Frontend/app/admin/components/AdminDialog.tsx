'use client';
import { useRef, type ReactNode } from 'react';
import { useModalDialog } from '../../hooks/useDialogFocus';

/**
 * An admin overlay — a detail slide-over (`side`) or a centred confirm — as an aria-modal dialog (#1069): focus moves
 * in and Tab stays inside, Escape or a click on the scrim closes it, and focus goes back to the control that opened it.
 */
export default function AdminDialog({ label, onClose, side = false, children }: {
  label: string; onClose: () => void; side?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalDialog(ref, onClose);

  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label}
      className={`fixed inset-0 z-50 flex outline-none ${side ? 'justify-end' : 'items-center justify-center'}`}>
      <div className="absolute inset-0 bg-scrim/80" onClick={onClose} />
      {children}
    </div>
  );
}
