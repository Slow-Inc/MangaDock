/** What a Studio chart shows when there is nothing to draw. */
export default function ChartEmpty({ label, height = 240 }: { label: string; height?: number }) {
  return (
    <div style={{ height }} className="flex items-center justify-center rounded-[var(--r2)] border border-dashed border-line text-sm text-ink-3">
      {label}
    </div>
  );
}
