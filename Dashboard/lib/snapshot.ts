// Pure reducer that folds the per-service `/status/stream` messages into one
// live snapshot the dashboard UI renders. Pure (takes `now`) so staleness is
// testable without the clock. PRD #279 / ADR 016.

export type ServiceStatus = "up" | "down" | "stale";

export interface Metrics {
  host?: Record<string, number>;
  gpus?: Array<Record<string, number | null>>;
}

export interface SubsystemStatus {
  status: string;
  detail?: string;
}

export interface ServiceState {
  status: ServiceStatus;
  lastSeen: number;
  metrics?: Metrics;
  subsystems?: Record<string, SubsystemStatus>;
}

export interface State {
  services: Record<string, ServiceState>;
  events: unknown[];
}

export interface MetricMessage {
  type: "metric";
  service: string;
  host?: Record<string, number>;
  gpus?: Array<Record<string, number | null>>;
}

export interface EventMessage {
  type: "event";
  service: string;
  kind: "translate_triggered" | "stage" | "log" | "error";
  detail?: string;
}

export interface StatusMessage {
  type: "status";
  service: string;
  subsystem: string;
  status: string;
  detail?: string;
}

export type Message = MetricMessage | EventMessage | StatusMessage;

/** A service silent for longer than this is considered out of contact. */
export const STALE_MS = 10_000;

export function initialState(): State {
  return { services: {}, events: [] };
}

/** Re-evaluate liveness: a service not seen within STALE_MS is marked stale.
 * Call this on a timer so a dropped `/status/stream` surfaces as down. */
export function markStale(state: State, now: number): State {
  const services: Record<string, ServiceState> = {};
  for (const [name, svc] of Object.entries(state.services)) {
    services[name] = now - svc.lastSeen > STALE_MS ? { ...svc, status: "stale" } : svc;
  }
  return { ...state, services };
}

export function reduce(state: State, msg: Message, now: number): State {
  if (msg.type === "metric") {
    return {
      ...state,
      services: {
        ...state.services,
        [msg.service]: {
          status: "up",
          lastSeen: now,
          metrics: { host: msg.host, gpus: msg.gpus },
        },
      },
    };
  }
  if (msg.type === "event") {
    return { ...state, events: [msg, ...state.events] };
  }
  if (msg.type === "status") {
    const prev = state.services[msg.service];
    return {
      ...state,
      services: {
        ...state.services,
        [msg.service]: {
          status: "up",
          lastSeen: now,
          metrics: prev?.metrics,
          subsystems: {
            ...prev?.subsystems,
            [msg.subsystem]: { status: msg.status, detail: msg.detail },
          },
        },
      },
    };
  }
  return state;
}
