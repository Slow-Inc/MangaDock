// Per-node debug data for the heatmap popup (#304). Groups a node's telemetry into categories; a
// field the node doesn't report comes through as null so the popup renders <NoData> for it (honest
// mock→real: today MIT emits only ip/port/pid/busy/uptime + machine-wide GPU/host, so most per-node
// fields are No Data until MIT telemetry is extended per-node, #279 follow-up). Pure + unit-tested.

export interface NodeFull {
  id: string;
  online: boolean;
  spec?: string;
  gpuUsage?: number | null;
  cpuUsage?: number | null;
  gpuClockMhz?: number | null;
  cpuClockMhz?: number | null;
  vramUsedGb?: number | null;
  vramTotalGb?: number | null;
  ramUsedGb?: number | null;
  ramTotalGb?: number | null;
  gpuTempC?: number | null;
  cpuTempC?: number | null;
  fanPct?: number | null;
  powerW?: number | null;
  bandwidthMbps?: number | null;
  errors?: string[];
  logs?: string[];
  console?: string[]; // per-node read-only console transcript (prompt + output lines), shown in the popup
}

export interface NodeMetric { label: string; value: number | string | null; unit?: string }
export interface NodeSection { title: string; metrics: NodeMetric[] }

const pair = (a?: number | null, b?: number | null): string | null =>
  a != null && b != null ? `${a} / ${b}` : null;

export function buildNodeDebug(n: NodeFull): NodeSection[] {
  return [
    { title: "Compute", metrics: [
      { label: "GPU usage", value: n.gpuUsage ?? null, unit: "%" },
      { label: "CPU usage", value: n.cpuUsage ?? null, unit: "%" },
      { label: "GPU clock", value: n.gpuClockMhz ?? null, unit: "MHz" },
      { label: "CPU clock", value: n.cpuClockMhz ?? null, unit: "MHz" },
    ] },
    { title: "Memory", metrics: [
      { label: "VRAM", value: pair(n.vramUsedGb, n.vramTotalGb), unit: "GB" },
      { label: "RAM", value: pair(n.ramUsedGb, n.ramTotalGb), unit: "GB" },
    ] },
    { title: "Thermal", metrics: [
      { label: "GPU temp", value: n.gpuTempC ?? null, unit: "°C" },
      { label: "CPU temp", value: n.cpuTempC ?? null, unit: "°C" },
      { label: "Fan", value: n.fanPct ?? null, unit: "%" },
    ] },
    { title: "Power", metrics: [{ label: "Power draw", value: n.powerW ?? null, unit: "W" }] },
    { title: "Network", metrics: [{ label: "Bandwidth", value: n.bandwidthMbps ?? null, unit: "Mbps" }] },
  ];
}
