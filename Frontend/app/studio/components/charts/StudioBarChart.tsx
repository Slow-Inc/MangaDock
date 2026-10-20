"use client";

/** Income beside spending per period, as grouped ECharts bars (#789). Shared plumbing lives in `useStudioChart`. */
import { useCallback, useRef } from "react";
import type { StackedChartPoint } from "../../lib/dashboardAnalytics";
import { formatCompactNumber } from "../../lib/dashboardAnalytics";
import ChartEmpty from "./ChartEmpty";
import { hasValues } from "./chartMath";
import { useStudioChart, type ChartKit, type Register } from "./useStudioChart";

const register: Register = (charts, components) => [
  charts.BarChart,
  components.GridComponent,
  components.TooltipComponent,
  components.LegendComponent,
];

function Bars({ points, valueFormatter, ariaLabel }: { points: StackedChartPoint[]; valueFormatter: (v: number) => string; ariaLabel: string }) {
  const el = useRef<HTMLDivElement>(null);
  const build = useCallback(
    (kit: ChartKit) => {
      const ink3 = kit.color("--ink-3");
      const bar = (name: string, token: string, data: number[]) => ({
        name,
        type: "bar",
        data,
        barMaxWidth: 16,
        barGap: "20%",
        itemStyle: { color: kit.color(token), borderRadius: [4, 4, 0, 0] },
        tooltip: { valueFormatter },
      });
      return {
        ...kit.base("axis"),
        legend: { bottom: 0, left: 0, icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: ink3, fontSize: 12 } },
        grid: { left: 8, right: 8, top: 16, bottom: 36, containLabel: true },
        xAxis: { type: "category", data: points.map((p) => p.label), ...kit.axisStyle() },
        yAxis: { type: "value", splitLine: kit.splitLine(), axisLabel: { color: ink3, fontSize: 11, formatter: valueFormatter } },
        series: [
          bar("รายรับ", "--accent", points.map((p) => p.income)),
          bar("รายจ่าย", "--danger", points.map((p) => p.spending)),
        ],
      };
    },
    [points, valueFormatter],
  );
  useStudioChart(el, register, build);
  return <div ref={el} role="img" aria-label={ariaLabel} style={{ height: 256 }} className="w-full" />;
}

export default function StudioBarChart({
  points,
  valueFormatter = formatCompactNumber,
  ariaLabel,
}: {
  points: StackedChartPoint[];
  valueFormatter?: (value: number) => string;
  ariaLabel: string;
}) {
  if (!hasValues(points.flatMap((p) => [p.income, p.spending]))) {
    return <ChartEmpty label="ยังไม่มีข้อมูลธุรกรรมในช่วงเวลานี้" height={256} />;
  }
  return <Bars points={points} valueFormatter={valueFormatter} ariaLabel={ariaLabel} />;
}
