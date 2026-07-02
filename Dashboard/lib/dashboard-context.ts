/** Assembles the entire live dashboard state into a compact text snapshot that is sent to the
 *  LLM (9arm qwen3.6) as grounding context, so it can answer ANY question about the system —
 *  not just pre-canned topics. Pure data → text; unit-tested in dashboard-context.test.ts. */

import {
  SERVICES, NODE_LOGS, NODE_META, SUBSYSTEMS, BANDWIDTH_SERVICES, BANDWIDTH_NODES, USERS,
  MIT_VRAM_MODELS, MIT_HOST_VRAM_TOTAL_GB, CACHE_TIERS, BACKEND_NODES, CLUSTER_NOW,
  STAGE_TIMINGS, GATEWAY_PROBE, STREAMS, QUEUE_JOBS,
} from "./services";
import { summarizeCluster } from "./cluster";
import { summarizeVram } from "./vram";
import { summarizeBandwidth } from "./bandwidth";
import { assessTiming } from "./timing";
import { summarizeQueue } from "./queue";
import { diagnoseGateway } from "./gateway";

const mb = (b: number) => `${Math.round(b / 1e6)}MB`;

export function buildDashboardContext(now: number = CLUSTER_NOW): string {
  const L: string[] = ["# MIT Dashboard — current live state"];

  // services + their logs
  for (const s of SERVICES) {
    L.push(`\n## ${s.name} (${s.tech}) — status ${s.status} · ${s.metric} · ${s.detail} · ${s.errors} error(s)`);
    for (const l of s.logs) L.push(`  [${l.t}] ${l.level.toUpperCase()} ${l.src}: ${l.msg}`);
  }

  // translate gateway diagnosis
  const g = diagnoseGateway(GATEWAY_PROBE);
  L.push(`\n## Translate gateway: ${g.plane} fault — ${g.cause}. ${g.hint}`);

  // queue
  const q = summarizeQueue(QUEUE_JOBS, now);
  L.push(`\n## Translate queue: ${q.running} running, ${q.queued} queued, ${q.stuckCount} stuck (oldest wait ${Math.round(q.oldestWaitMs / 1000)}s)`);
  for (const j of q.jobs) L.push(`  ${j.id} ${j.state}${j.stage ? "/" + j.stage : ""} user=${j.user} ${j.manga} ${j.chapter} p${j.page}${j.stuck ? " STUCK" : ""}`);

  // stage timing
  const tm = assessTiming(STAGE_TIMINGS);
  L.push(`\n## Stage timing vs baseline (${tm.regressedCount} regressed):`);
  for (const st of tm.stages) L.push(`  ${st.label}: ${(st.liveMs / 1000).toFixed(1)}s vs ${(st.baselineMs / 1000).toFixed(1)}s baseline (${st.deltaPct >= 0 ? "+" : ""}${st.deltaPct}%)${st.regressed ? " REGRESSED" : ""}`);

  // VRAM per model
  const v = summarizeVram(MIT_VRAM_MODELS, MIT_HOST_VRAM_TOTAL_GB);
  L.push(`\n## VRAM by model: ${v.usedGb}/${v.totalGb} GB used (${v.usedPct}%), ${v.freeGb} GB free`);
  for (const r of v.rows) L.push(`  ${r.label} (${r.sublabel}): ${r.remote ? "remote, 0 local VRAM" : r.gb + " GB"}`);

  // backend cluster + per-node logs
  const c = summarizeCluster(BACKEND_NODES, now);
  L.push(`\n## Backend cluster: ${c.live}/${c.total} live, health ${c.health}, leader ${c.leaderId}`);
  for (const n of c.nodes) {
    const m = NODE_META[n.id];
    L.push(`  ${n.id} ${n.isLeader ? "LEADER" : "follower"} ${n.status} heartbeat ${(n.ageMs / 1000).toFixed(1)}s L1=${n.l1Entries}${n.dirtyQueue != null ? " dirty=" + n.dirtyQueue : ""}${m ? ` uptime=${m.uptime} p50=${m.p50}ms err=${m.errorRate}` : ""}`);
    for (const l of NODE_LOGS[n.id] ?? []) L.push(`    [${l.t}] ${l.level.toUpperCase()} ${l.src}: ${l.msg}`);
  }

  // cache tiers
  L.push(`\n## Cache tiers: L2 Redis (shared) ${CACHE_TIERS.l2.entries} entries`);
  for (const n of CACHE_TIERS.nodes) L.push(`  ${n.nodeId}: L1 ${n.l1.entries}/${mb(n.l1.bytes)}, L3 ${n.l3.files} files/${mb(n.l3.bytes)}, dirty ${n.l3.dirtyPending}`);

  // subsystems
  L.push(`\n## Subsystems:`);
  for (const s of SUBSYSTEMS) L.push(`  ${s.label}: ${s.health}${s.detail ? ` (${s.detail})` : ""}${s.latencyMs ? ` ${s.latencyMs}ms` : ""}`);

  // traffic + users
  const b = summarizeBandwidth(BANDWIDTH_SERVICES, BANDWIDTH_NODES);
  L.push(`\n## Traffic: ${USERS.active} active users / ${USERS.total} total. Bandwidth down ${b.totalDown} / up ${b.totalUp} Mbps`);
  for (const s of b.services) L.push(`  ${s.name}: down ${s.down} up ${s.up} (${s.pct}% of total)`);
  for (const n of b.nodes) L.push(`  node ${n.nodeId}: down ${n.down} up ${n.up} (${n.pct}% of backend)`);

  // streams
  L.push(`\n## Status streams: ${STREAMS.map((s) => `${s.service}=${s.state}`).join(", ")}`);

  return L.join("\n");
}
