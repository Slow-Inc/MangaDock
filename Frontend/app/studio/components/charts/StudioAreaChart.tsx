"use client";

/**
 * A lean ECharts area chart for Studio (Epic C #788). echarts is imported on demand (Studio routes only),
 * tree-shaken from `echarts/core`; the renderer registration comes from the vendored evilcharts core
 * (`./echarts-chart.tsx`). Colours come from the design tokens at render time, so the chart follows the theme.
 * Hover shows one tooltip for the day; reduced motion disables the entrance animation.
 */
import { useEffect, useRef } from "react";

export type AreaSeries = { name: string; values: number[]; token: "--accent" | "--coin" | "--ok" };

export default function StudioAreaChart({ labels, series, height = 240, ariaLabel }: { labels: string[]; series: AreaSeries[]; height?: number; ariaLabel: string }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let disposed = false;
    let chart: { setOption: (o: unknown) => void; resize: () => void; dispose: () => void } | null = null;
    let ro: ResizeObserver | null = null;

    (async () => {
      const [echarts, charts, components, core] = await Promise.all([
        import("echarts/core"),
        import("echarts/charts"),
        import("echarts/components"),
        import("./echarts-chart"), // registers the canvas + svg renderers; withAlpha for the fill
      ]);
      if (disposed) return;
      echarts.use([charts.LineChart, components.GridComponent, components.TooltipComponent]);

      const css = getComputedStyle(node);
      // Tokens are hex or color-mix(); normalise to rgba so ECharts (and withAlpha) can use them.
      const v = (name: string) => core.normalizeColor(css.getPropertyValue(name));
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      chart = echarts.init(node, null, { renderer: "svg" });
      chart.setOption({
        animation: !reduce,
        animationDuration: 600,
        grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
        tooltip: {
          trigger: "axis",
          backgroundColor: v("--surface"),
          borderColor: v("--ink-3"),
          textStyle: { color: v("--ink"), fontFamily: "var(--font-inter), var(--font-anuphan), system-ui" },
          axisPointer: { type: "line", lineStyle: { color: v("--ink-3") } },
        },
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: labels,
          axisLine: { lineStyle: { color: v("--ink-3") } },
          axisTick: { show: false },
          axisLabel: { color: v("--ink-3"), fontSize: 11, hideOverlap: true },
        },
        yAxis: {
          type: "value",
          minInterval: 1,
          splitLine: { lineStyle: { color: v("--ink-3"), opacity: 0.25 } },
          axisLabel: { color: v("--ink-3"), fontSize: 11 },
        },
        series: series.map((s) => {
          const color = v(s.token);
          return {
            name: s.name,
            type: "line",
            smooth: 0.35,
            symbol: "none",
            data: s.values,
            lineStyle: { width: 2, color },
            itemStyle: { color },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: core.withAlpha(color, 0.28) },
                { offset: 1, color: core.withAlpha(color, 0) },
              ]),
            },
          };
        }),
      });
      ro = new ResizeObserver(() => chart?.resize());
      ro.observe(node);
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      chart?.dispose();
    };
  }, [labels, series]);

  return <div ref={el} role="img" aria-label={ariaLabel} style={{ height }} className="w-full" />;
}
