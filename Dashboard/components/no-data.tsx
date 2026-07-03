// The shared "No Data" primitive for the live-native Dashboard (#304 / I1 #305) — one
// place every panel renders when `isNoData(value)` (lib/panel-source) is true, so the
// console never fakes data. `<NoData>` fills a panel/chart area; `<NoDataPage>` is the
// page-level variant for surfaces with no live source at all (Frontend/Backend → #282/#283).
// Minimal default styling here; the final visual is owned by the I2 design system (#306).

export function NoData({ label = "No Data", minHeight = 88, className = "" }: { label?: string; minHeight?: number; className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ minHeight, color: "var(--ink-3)" }}>
      <span className="text-[12px]">{label}</span>
    </div>
  );
}

export function NoDataPage({ message }: { message: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-center" style={{ color: "var(--ink-3)" }}>
      <span className="text-[14px] font-medium" style={{ color: "var(--ink-2)" }}>No Data</span>
      <span className="text-[12px]">{message}</span>
    </div>
  );
}
