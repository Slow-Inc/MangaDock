"use client";

/**
 * Shared plumbing for the Studio ECharts components (#788, #789). echarts is imported on demand (Studio routes
 * only), tree-shaken from `echarts/core`; the renderer comes from the vendored evilcharts core (`./echarts-chart`).
 * The chart is built only once its box is near the viewport, reads its colours from the design tokens (and is rebuilt
 * when the theme changes), follows its box size, turns animation off under reduced motion, and is disposed on unmount.
 */
import { useEffect, useState, type RefObject } from "react";
import { TONE_COLOR, type Tone } from "./chartMath";

type EChartsCore = typeof import("echarts/core");
type Charts = typeof import("echarts/charts");
type Components = typeof import("echarts/components");

export type ChartKit = {
  echarts: EChartsCore;
  /** A design token (e.g. "--accent") as an rgba string ECharts can use. */
  color: (token: string) => string;
  withAlpha: (color: string, alpha: number) => string;
  /** A data tone (see TONE_COLOR) as an rgba string; no tone means the accent. */
  tone: (tone?: Tone) => string;
  /** Option pieces every Studio chart shares: animation, font, tooltip and axis styling. */
  base: (trigger: "axis" | "item") => Record<string, unknown>;
  axisStyle: () => Record<string, unknown>;
  splitLine: () => Record<string, unknown>;
};

/** Which chart and component modules a chart needs; keep it a module-level constant so it is stable. */
export type Register = (charts: Charts, components: Components) => Parameters<EChartsCore["use"]>[0];

function useTheme(): string | null {
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    // "System" mode drops data-theme and follows the OS, so an OS flip must rebuild too.
    const os = window.matchMedia("(prefers-color-scheme: dark)");
    const read = () => setTheme(`${root.getAttribute("data-theme") ?? "system"}:${os.matches ? "dark" : "light"}`);
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    os.addEventListener("change", read);
    return () => {
      mo.disconnect();
      os.removeEventListener("change", read);
    };
  }, []);
  return theme;
}

/** True once the element has come within 200 px of the viewport (stays true). */
function useNear(ref: RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: "200px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [ref, near]);
  return near;
}

/** `build` must be memoised by the caller (useCallback over its data), since a new function rebuilds the chart. */
export function useStudioChart(ref: RefObject<HTMLDivElement | null>, register: Register, build: (kit: ChartKit) => unknown) {
  const theme = useTheme();
  const near = useNear(ref);

  useEffect(() => {
    const node = ref.current;
    if (!node || !near) return;
    let disposed = false;
    let chart: { setOption: (o: unknown) => void; resize: () => void; dispose: () => void } | null = null;
    let ro: ResizeObserver | null = null;

    (async () => {
      const [echarts, charts, components, core] = await Promise.all([
        import("echarts/core"),
        import("echarts/charts"),
        import("echarts/components"),
        import("./echarts-chart"), // registers the svg renderer; colour helpers
      ]);
      if (disposed) return;
      echarts.use(register(charts, components));

      const css = getComputedStyle(node);
      // Tokens are hex or color-mix(); normalise to rgba so ECharts (and withAlpha) can use them.
      const color = (token: string) => core.normalizeColor(css.getPropertyValue(token));
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const ink3 = color("--ink-3");
      const kit: ChartKit = {
        echarts,
        color,
        withAlpha: core.withAlpha,
        tone: (t) => {
          const { token, alpha } = TONE_COLOR[t ?? "indigo"];
          return core.withAlpha(color(token), alpha);
        },
        base: (trigger) => ({
          animation: !reduce,
          animationDuration: 600,
          textStyle: { fontFamily: "var(--font-inter), var(--font-anuphan), system-ui" },
          tooltip: {
            trigger,
            backgroundColor: color("--surface"),
            borderColor: ink3,
            textStyle: { color: color("--ink"), fontFamily: "var(--font-inter), var(--font-anuphan), system-ui" },
            axisPointer: { type: trigger === "axis" ? "line" : "none", lineStyle: { color: ink3 } },
          },
        }),
        axisStyle: () => ({
          axisLine: { lineStyle: { color: ink3 } },
          axisTick: { show: false },
          axisLabel: { color: ink3, fontSize: 11, hideOverlap: true },
        }),
        splitLine: () => ({ lineStyle: { color: ink3, opacity: 0.25 } }),
      };

      chart = echarts.init(node, null, { renderer: "svg" });
      chart.setOption(build(kit));
      ro = new ResizeObserver(() => chart?.resize());
      ro.observe(node);
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      chart?.dispose();
    };
  }, [ref, near, register, build, theme]);
}
