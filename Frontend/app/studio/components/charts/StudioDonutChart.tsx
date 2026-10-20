"use client";

/**
 * Shares of a whole as an ECharts donut (#789), with the total in the hole and an HTML legend beside it that lists
 * each value and its percentage (readable without hovering). Shared plumbing lives in `useStudioChart`.
 */
import { useCallback, useMemo, useRef } from "react";
import type { BreakdownDatum } from "../../lib/dashboardAnalytics";
import { formatCompactNumber } from "../../lib/dashboardAnalytics";
import ChartEmpty from "./ChartEmpty";
import { percentages, toneCss } from "./chartMath";
import { useStudioChart, type ChartKit, type Register } from "./useStudioChart";

const register: Register = (charts, components) => [charts.PieChart, components.TooltipComponent];

function Donut({ data, formatter, ariaLabel }: { data: BreakdownDatum[]; formatter: (v: number) => string; ariaLabel: string }) {
  const el = useRef<HTMLDivElement>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const shares = useMemo(() => percentages(data.map((d) => d.value)), [data]);
  const build = useCallback(
    (kit: ChartKit) => ({
      ...kit.base("item"),
      series: [
        {
          type: "pie",
          radius: ["68%", "88%"],
          padAngle: 2,
          itemStyle: { borderRadius: 4 },
          label: { show: false },
          emphasis: { scale: false },
          data: data.map((d) => ({ name: d.label, value: d.value, itemStyle: { color: kit.tone(d.tone) } })),
          tooltip: { valueFormatter: formatter },
        },
      ],
    }),
    [data, formatter],
  );
  useStudioChart(el, register, build);

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-center">
      <div className="relative h-[170px] w-[170px] shrink-0 self-center">
        <div ref={el} role="img" aria-label={ariaLabel} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[11px] text-ink-3">รวมทั้งหมด</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{formatter(total)}</p>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {data.map((item, i) => (
          <li key={item.label} className="flex items-center justify-between gap-3 rounded-[var(--r2)] border border-line px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: toneCss(item.tone) }} />
              <p className="truncate text-sm text-ink-2">{item.label}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium tabular-nums text-ink">{formatter(item.value)}</p>
              <p className="text-[11px] tabular-nums text-ink-3">{shares[i]}%</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function StudioDonutChart({
  data,
  formatter = formatCompactNumber,
  ariaLabel,
}: {
  data: BreakdownDatum[];
  formatter?: (value: number) => string;
  ariaLabel: string;
}) {
  if (data.length === 0) return <ChartEmpty label="ยังไม่มีข้อมูลสัดส่วน" />;
  return <Donut data={data} formatter={formatter} ariaLabel={ariaLabel} />;
}
