"use client";

/**
 * A lean ECharts area chart for Studio (Epic C #788): one line per series with a soft fill under it. Shared plumbing
 * (on-demand echarts, token colours, theme rebuild, reduced motion, dispose) lives in `useStudioChart`.
 * Hover shows one tooltip for the day.
 */
import { useCallback, useRef } from "react";
import { useStudioChart, type ChartKit, type Register } from "./useStudioChart";

export type AreaSeries = { name: string; values: number[]; token: "--accent" | "--coin" | "--ok" };

const register: Register = (charts, components) => [charts.LineChart, components.GridComponent, components.TooltipComponent];

export default function StudioAreaChart({
  labels,
  series,
  height = 240,
  ariaLabel,
  valueFormatter,
}: {
  labels: string[];
  series: AreaSeries[];
  height?: number;
  ariaLabel: string;
  valueFormatter?: (value: number) => string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const build = useCallback(
    (kit: ChartKit) => ({
      ...kit.base("axis"),
      grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: labels, ...kit.axisStyle() },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: kit.splitLine(),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: kit.color("--ink-3"), fontSize: 11, formatter: valueFormatter },
      },
      series: series.map((s) => {
        const color = kit.color(s.token);
        return {
          name: s.name,
          type: "line",
          smooth: 0.35,
          symbol: "none",
          data: s.values,
          lineStyle: { width: 2, color },
          itemStyle: { color },
          tooltip: valueFormatter ? { valueFormatter } : undefined,
          areaStyle: {
            color: new kit.echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: kit.withAlpha(color, 0.28) },
              { offset: 1, color: kit.withAlpha(color, 0) },
            ]),
          },
        };
      }),
    }),
    [labels, series, valueFormatter],
  );
  useStudioChart(el, register, build);

  return <div ref={el} role="img" aria-label={ariaLabel} style={{ height }} className="w-full" />;
}
