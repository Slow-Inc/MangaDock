import { reduce, initialState, type State } from "@/lib/snapshot";

// Mock snapshot until the live MIT `/status/stream` subscription lands — proves
// the reducer → UI path end to end. The values mirror the 2026-06-14 incident.
function mockSnapshot(): State {
  const now = 1000;
  let s = initialState();
  s = reduce(s, {
    type: "status",
    service: "mit",
    subsystem: "translator",
    status: "timeout",
    detail: "gateway /models OK but chat completion timed out — model not responding",
  }, now);
  s = reduce(s, {
    type: "metric",
    service: "mit",
    host: { cpu_pct: 42, ram_used_mb: 9800, ram_total_mb: 32000, disk_used_pct: 61 },
    gpus: [{ util_pct: 65, temp_c: 71, vram_used_mb: 5800, vram_total_mb: 12288 }],
  }, now);
  s = reduce(s, { type: "event", service: "mit", kind: "translate_triggered", detail: "Gal Yome no Himitsu ch1 p3" }, now);
  s = reduce(s, { type: "event", service: "mit", kind: "stage", detail: "ocr" }, now);
  return s;
}

const STATUS_DOT: Record<string, string> = { up: "#22c55e", stale: "#f59e0b", down: "#ef4444" };

export default function Page() {
  const snap = mockSnapshot();
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>🔧 MIT Dashboard</h1>
      <p style={{ color: "#9ca3af", fontSize: 13, marginTop: -6 }}>standalone · mock data (live /status/stream pending)</p>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14, color: "#9ca3af" }}>Services</h2>
        {Object.entries(snap.services).map(([name, svc]) => (
          <div key={name} style={{ border: "1px solid #262626", borderRadius: 8, padding: 14, marginTop: 8 }}>
            <strong>
              <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 9, marginRight: 8, background: STATUS_DOT[svc.status] ?? "#666" }} />
              {name} — {svc.status}
            </strong>
            {svc.subsystems && Object.entries(svc.subsystems).map(([sub, st]) => (
              <div key={sub} style={{ fontSize: 13, marginTop: 6 }}>
                ▸ {sub}: <b style={{ color: STATUS_DOT[st.status] ?? "#f59e0b" }}>{st.status}</b>
                {st.detail && <span style={{ color: "#9ca3af" }}> — {st.detail}</span>}
              </div>
            ))}
            {svc.metrics?.host && (
              <div style={{ fontSize: 13, marginTop: 6, color: "#d4d4d4" }}>
                CPU {svc.metrics.host.cpu_pct}% · RAM {svc.metrics.host.ram_used_mb}/{svc.metrics.host.ram_total_mb}MB · disk {svc.metrics.host.disk_used_pct}%
              </div>
            )}
            {svc.metrics?.gpus?.map((g, i) => (
              <div key={i} style={{ fontSize: 13, color: "#d4d4d4" }}>
                GPU{i} {g.util_pct}% · {g.temp_c}°C · VRAM {g.vram_used_mb}/{g.vram_total_mb}MB
              </div>
            ))}
          </div>
        ))}
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14, color: "#9ca3af" }}>Activity</h2>
        {snap.events.map((e, i) => {
          const ev = e as { kind: string; detail?: string };
          return (
            <div key={i} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid #1a1a1a" }}>
              <code style={{ color: "#60a5fa" }}>{ev.kind}</code> {ev.detail}
            </div>
          );
        })}
      </section>
    </main>
  );
}
