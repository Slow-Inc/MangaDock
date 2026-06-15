/** Bandwidth rollup: total → per-service → per-node (Backend). Pure — unit-tested in bandwidth.test.ts. */

export interface BwUnit {
  down: number; // Mbps
  up: number;
}
export interface BwService extends BwUnit {
  id: string;
  name: string;
  color: string;
}
export interface BwNode extends BwUnit {
  nodeId: string;
}

export interface BwServiceResult extends BwService {
  total: number;
  pct: number; // share of overall traffic
}
export interface BwNodeResult extends BwNode {
  total: number;
  pct: number; // share within the Backend
}

export interface BandwidthSummary {
  totalDown: number;
  totalUp: number;
  total: number;
  services: BwServiceResult[];
  backendDown: number;
  backendUp: number;
  nodes: BwNodeResult[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarizeBandwidth(services: BwService[], nodes: BwNode[]): BandwidthSummary {
  const totalDown = services.reduce((t, s) => t + s.down, 0);
  const totalUp = services.reduce((t, s) => t + s.up, 0);
  const total = totalDown + totalUp;

  const svc = services.map((s) => {
    const st = s.down + s.up;
    return { ...s, total: st, pct: total === 0 ? 0 : round1((st / total) * 100) };
  });

  const backendDown = nodes.reduce((t, n) => t + n.down, 0);
  const backendUp = nodes.reduce((t, n) => t + n.up, 0);
  const backendTotal = backendDown + backendUp;

  const nd = nodes.map((n) => {
    const nt = n.down + n.up;
    return { ...n, total: nt, pct: backendTotal === 0 ? 0 : round1((nt / backendTotal) * 100) };
  });

  return { totalDown, totalUp, total, services: svc, backendDown, backendUp, nodes: nd };
}
