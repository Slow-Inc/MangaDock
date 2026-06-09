// Pure simulator engine — no React, no DOM
// resolveStep(scenario, stepIndex) → Record<nodeId, NodeState>

export type NodeState = 'idle' | 'active' | 'ok' | 'err' | 'skip' | 'write';
export type DomainColor = 'amber' | 'emerald' | 'indigo' | 'orange' | 'rose' | 'sky' | 'slate' | 'violet';

export interface SimNode {
  id: string;
  label: string;
  sub?: string;
}

export interface SimStep {
  descEN: string;
  descTH: string;
  techEN?: string;
  techTH?: string;
  states: Record<string, NodeState>;
}

export interface SimScenario {
  id: string;
  labelEN: string;
  labelTH: string;
  badge: string;
  layout: 'linear' | 'cache-write';
  nodes: SimNode[];
  steps: SimStep[];
}

export interface SimDomain {
  id: string;
  labelEN: string;
  labelTH: string;
  color: DomainColor;
  scenarios: SimScenario[];
}

export function resolveStep(
  scenario: SimScenario,
  stepIndex: number,
): Record<string, NodeState> {
  const idx = Math.max(0, Math.min(stepIndex, scenario.steps.length - 1));
  const step = scenario.steps[idx];
  const out: Record<string, NodeState> = {};
  for (const node of scenario.nodes) {
    out[node.id] = step.states[node.id] ?? 'idle';
  }
  return out;
}

export const DOMAIN_COLORS: Record<DomainColor, {
  dot: string; text: string; bg: string; border: string;
  badge: string; badgeFg: string; accent: string;
}> = {
  amber:   { dot: 'bg-amber-400',   text: 'text-amber-300',   bg: 'bg-amber-500/[0.08]',   border: 'border-amber-400/30',   badge: 'bg-amber-400/20',   badgeFg: 'text-amber-200',  accent: 'text-amber-300'   },
  emerald: { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/[0.08]', border: 'border-emerald-400/30', badge: 'bg-emerald-400/20', badgeFg: 'text-emerald-200',accent: 'text-emerald-300' },
  indigo:  { dot: 'bg-indigo-400',  text: 'text-indigo-300',  bg: 'bg-indigo-500/[0.08]',  border: 'border-indigo-400/30',  badge: 'bg-indigo-400/20',  badgeFg: 'text-indigo-200', accent: 'text-indigo-300'  },
  rose:    { dot: 'bg-rose-400',    text: 'text-rose-300',    bg: 'bg-rose-500/[0.08]',    border: 'border-rose-400/30',    badge: 'bg-rose-400/20',    badgeFg: 'text-rose-200',   accent: 'text-rose-300'    },
  sky:     { dot: 'bg-sky-400',     text: 'text-sky-300',     bg: 'bg-sky-500/[0.08]',     border: 'border-sky-400/30',     badge: 'bg-sky-400/20',     badgeFg: 'text-sky-200',    accent: 'text-sky-300'     },
  slate:   { dot: 'bg-slate-400',   text: 'text-slate-300',   bg: 'bg-slate-500/[0.08]',   border: 'border-slate-400/30',   badge: 'bg-slate-400/20',   badgeFg: 'text-slate-200',  accent: 'text-slate-300'   },
  orange:  { dot: 'bg-orange-400',  text: 'text-orange-300',  bg: 'bg-orange-500/[0.08]',  border: 'border-orange-400/30',  badge: 'bg-orange-400/20',  badgeFg: 'text-orange-200', accent: 'text-orange-300'  },
  violet:  { dot: 'bg-violet-400',  text: 'text-violet-300',  bg: 'bg-violet-500/[0.08]',  border: 'border-violet-400/30',  badge: 'bg-violet-400/20',  badgeFg: 'text-violet-200', accent: 'text-violet-300'  },
};
