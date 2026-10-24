"use client";

/** One horizontal ECharts bar per item, in the order given (#789). Shared plumbing lives in `useStudioChart`. */
import { useCallback, useRef } from "react";
import type { BreakdownDatum } from "../../lib/dashboardAnalytics";
import { formatCompactNumber } from "../../lib/dashboardAnalytics";
import ChartEmpty from "./ChartEmpty";
import { breakdownChartHeight } from "./chartMath";
import { useStudioChart, type ChartKit, type Register } from "./useStudioChart";

const register: Register = (charts, components) => [charts.BarChart, components.GridComponent, components.TooltipComponent];

function Bars({ data, formatter, ariaLabel }: { data: BreakdownDatum[]; formatter: (v: number) => string; ariaLabel: string }) {
  const el = useRef<HTMLDivElement>(null);
  const build = useCallback(
    (kit: ChartKit) => ({
      ...kit.base("item"),
      // A fixed label column: containLabel measures the untruncated title and cut long ones at the left edge.
      grid: { left: 152, right: 40, top: 8, bottom: 8 },
      xAxis: { type: "value", show: false },
      yAxis: {
        type: "category",
        inverse: true,
        data: data.map((d) => d.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: kit.color("--ink-2"), fontSize: 12, width: 140, overflow: "truncate", ellipsis: "…", margin: 12 },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 10,
          showBackground: true,
          backgroundStyle: { color: kit.color("--fill"), borderRadius: 999 },
          data: data.map((d) => ({ name: d.label, value: d.value, itemStyle: { color: kit.tone(), borderRadius: 999 } })), // one series, one hue
          label: { show: true, position: "right", color: kit.color("--ink"), fontSize: 12, formatter: (p: { value: number }) => formatter(p.value) },
          tooltip: { valueFormatter: formatter },
        },
      ],
    }),
    [data, formatter],
  );
  useStudioChart(el, register, build);
  return <div ref={el} role="img" aria-label={ariaLabel} style={{ height: breakdownChartHeight(data.length) }} className="w-full" />;
}

export default function StudioBreakdownChart({
  data,
  formatter = formatCompactNumber,
  ariaLabel,
}: {
  data: BreakdownDatum[];
  formatter?: (value: number) => string;
  ariaLabel: string;
}) {
  if (data.length === 0) return <ChartEmpty label="ยังไม่มีข้อมูลสำหรับเปรียบเทียบ" height={120} />;
  return <Bars data={data} formatter={formatter} ariaLabel={ariaLabel} />;
}
