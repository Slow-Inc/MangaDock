/**
 * A failed admin load (#819): says so and offers a retry, instead of an empty table that reads like
 * "no data". Admin copy is English like the rest of the panel.
 */
export default function AdminLoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3">
      <p className="text-sm text-ink-2">Couldn&apos;t load {what}.</p>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink smooth-hover-fast hover:bg-fill"
      >
        Retry
      </button>
    </div>
  );
}
