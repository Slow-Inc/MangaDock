'use client';

import React from 'react';
import type { SimScenario, NodeState } from './engine';
import { useLang } from '../lang-context';

// ─── State → CSS classes ────────────────────────────────────────────────────

export function nsClass(s: NodeState): string {
  if (s === 'active') return 'border-amber-400/60 bg-amber-500/[0.12] text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.10)]';
  if (s === 'ok')     return 'border-emerald-400/50 bg-emerald-500/[0.10] text-emerald-200';
  if (s === 'err')    return 'border-red-400/50 bg-red-500/[0.10] text-red-300';
  if (s === 'skip')   return 'border-white/[0.05] bg-transparent text-white/15';
  if (s === 'write')  return 'border-indigo-400/50 bg-indigo-500/[0.10] text-indigo-200';
  return 'border-white/10 bg-white/[0.04] text-white/40';
}

// ─── CNode ──────────────────────────────────────────────────────────────────

function CNode({
  label,
  sub,
  state,
  reducedMotion,
}: {
  label: string;
  sub?: string;
  state: NodeState;
  reducedMotion: boolean;
}) {
  const transition = reducedMotion
    ? 'none'
    : 'background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease';

  return (
    <div
      className={`px-3 py-2 rounded-lg border text-center shrink-0 ${nsClass(state)}`}
      style={{ transition }}
      role="img"
      aria-label={`${label} — ${state}`}
    >
      <div className="text-[12px] font-semibold leading-tight">{label}</div>
      {sub && <div className="text-[10px] opacity-50 mt-0.5">{sub}</div>}
      <div className="text-[9px] mt-1 h-3 leading-none">
        {state === 'active' && <span className="text-amber-300">● active</span>}
        {state === 'ok'     && <span className="text-emerald-400">✓ ok</span>}
        {state === 'err'    && <span className="text-red-400">✗ fail</span>}
        {state === 'write'  && <span className="text-indigo-300">↑ writing</span>}
        {state === 'skip'   && <span className="text-white/20">— skip</span>}
      </div>
    </div>
  );
}

// ─── Arrow ──────────────────────────────────────────────────────────────────

function Arrow({
  dim,
  reducedMotion,
}: {
  dim?: boolean;
  reducedMotion: boolean;
}) {
  const transition = reducedMotion ? 'none' : 'color 0.3s ease';
  return (
    <span
      className="text-xl self-center shrink-0 leading-none"
      aria-hidden="true"
      style={{
        color: dim ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.18)',
        transition,
      }}
    >
      →
    </span>
  );
}

// ─── Linear layout (horizontal row) ─────────────────────────────────────────

function LinearLayout({
  scenario,
  nodeStates,
  reducedMotion,
}: {
  scenario: SimScenario;
  nodeStates: Record<string, NodeState>;
  reducedMotion: boolean;
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-start gap-2 min-w-max py-2">
        {scenario.nodes.map((node, i) => {
          const next = scenario.nodes[i + 1];
          return (
            <React.Fragment key={node.id}>
              <CNode
                label={node.label}
                sub={node.sub}
                state={nodeStates[node.id] ?? 'idle'}
                reducedMotion={reducedMotion}
              />
              {next && (
                <Arrow
                  dim={(nodeStates[next.id] ?? 'idle') === 'skip'}
                  reducedMotion={reducedMotion}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Write path layout (3-row layout for cache write scenarios) ──────────────

function WriteLayout({
  nodeStates,
  reducedMotion,
}: {
  nodeStates: Record<string, NodeState>;
  reducedMotion: boolean;
}) {
  const lang = useLang();
  const ns = (id: string): NodeState => nodeStates[id] ?? 'idle';
  const dimFn = (id: string) => ns(id) === 'skip';

  return (
    <div className="space-y-3 py-2">
      {/* Row 1: sync write chain */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <CNode label="set(key,data)" state={ns('input')} reducedMotion={reducedMotion} />
          <Arrow dim={dimFn('wl1')} reducedMotion={reducedMotion} />
          <CNode label="L1 Memory" sub="sync write" state={ns('wl1')} reducedMotion={reducedMotion} />
          <span className="text-white/15 text-sm shrink-0 px-0.5" aria-hidden="true">+</span>
          <CNode label="L2 Redis" sub="sync write" state={ns('wl2')} reducedMotion={reducedMotion} />
          <Arrow dim={dimFn('dirty')} reducedMotion={reducedMotion} />
          <CNode label="Dirty Queue" sub="cache:dirty FIFO" state={ns('dirty')} reducedMotion={reducedMotion} />
        </div>
      </div>

      {/* Down connector */}
      <div className="flex items-center gap-2 pl-2">
        <div className="w-px h-4 bg-white/10" aria-hidden="true" />
        <span className="text-[10px] font-mono text-white/20">{lang === 'th' ? 'Leader เท่านั้น flush ได้' : 'Leader-only flush'}</span>
      </div>

      {/* Row 2: nodes compete for lock */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <div className="flex gap-1.5">
            <CNode label="Node A" sub="candidate" state={ns('nA')} reducedMotion={reducedMotion} />
            <CNode label="Node B" sub="candidate" state={ns('nB')} reducedMotion={reducedMotion} />
          </div>
          <div className="flex flex-col items-center shrink-0" aria-hidden="true">
            <span className="text-[9px] font-mono text-white/20">SET NX</span>
            <span className="text-white/20 text-lg leading-none">→</span>
          </div>
          <CNode label="Leader ★" sub="SET NX PX 37500" state={ns('leader')} reducedMotion={reducedMotion} />
        </div>
      </div>

      {/* Down connector */}
      <div className="flex items-center gap-2 pl-2">
        <div className="w-px h-4 bg-white/10" aria-hidden="true" />
        <span className="text-[10px] font-mono text-white/20">async flush</span>
      </div>

      {/* Row 3: flush to persistence */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <CNode label="L3 Disk" sub="async flush" state={ns('fl3')} reducedMotion={reducedMotion} />
          <Arrow dim={dimFn('fdb')} reducedMotion={reducedMotion} />
          <CNode label="Supabase" sub="long-term persist" state={ns('fdb')} reducedMotion={reducedMotion} />
        </div>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function FlowDiagram({
  scenario,
  nodeStates,
  reducedMotion,
}: {
  scenario: SimScenario;
  nodeStates: Record<string, NodeState>;
  reducedMotion: boolean;
}) {
  if (scenario.layout === 'cache-write') {
    return <WriteLayout nodeStates={nodeStates} reducedMotion={reducedMotion} />;
  }
  return (
    <LinearLayout
      scenario={scenario}
      nodeStates={nodeStates}
      reducedMotion={reducedMotion}
    />
  );
}
