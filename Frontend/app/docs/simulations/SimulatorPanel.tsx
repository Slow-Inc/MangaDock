'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Play, Pause } from 'lucide-react';
import { FlowDiagram } from './FlowDiagram';
import { resolveStep, DOMAIN_COLORS } from './engine';
import type { SimScenario, DomainColor, NodeState } from './engine';
import { useLang } from '../lang-context';

// ─── Reduced motion hook ─────────────────────────────────────────────────────

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// ─── Legend ──────────────────────────────────────────────────────────────────

const LEGEND: { state: NodeState; cls: string; labelEN: string; labelTH: string }[] = [
  { state: 'active', cls: 'bg-amber-400',   labelEN: 'Processing', labelTH: 'กำลังทำงาน' },
  { state: 'ok',     cls: 'bg-emerald-400', labelEN: 'Success',    labelTH: 'สำเร็จ' },
  { state: 'err',    cls: 'bg-red-400',     labelEN: 'Error',      labelTH: 'ล้มเหลว' },
  { state: 'write',  cls: 'bg-indigo-400',  labelEN: 'Writing',    labelTH: 'เขียน' },
  { state: 'skip',   cls: 'bg-white/20',    labelEN: 'Skipped',    labelTH: 'ข้ามไป' },
  { state: 'idle',   cls: 'bg-white/30',    labelEN: 'Idle',       labelTH: 'รอ' },
];

// ─── SimulatorPanel ──────────────────────────────────────────────────────────

export function SimulatorPanel({
  scenario,
  domainColor,
  domainLabel,
}: {
  scenario: SimScenario;
  domainColor: DomainColor;
  domainLabel: string;
}) {
  const lang = useLang();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset step when scenario changes
  useEffect(() => {
    setStep(0);
    setPlaying(false);
    setTechOpen(false);
  }, [scenario.id]);

  // Play auto-advance (disabled when reducedMotion)
  useEffect(() => {
    if (!playing || reducedMotion) {
      if (playRef.current) { clearInterval(playRef.current); playRef.current = null; }
      return;
    }
    playRef.current = setInterval(() => {
      setStep(s => {
        if (s >= scenario.steps.length - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 1800);
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, reducedMotion, scenario.steps.length]);

  const cur = scenario.steps[step];
  const nodeStates = resolveStep(scenario, step);
  const colors = DOMAIN_COLORS[domainColor];
  const hasTech = Boolean(cur.techEN || cur.techTH);

  const prev = () => { setPlaying(false); setStep(s => Math.max(s - 1, 0)); };
  const next = () => { setPlaying(false); setStep(s => Math.min(s + 1, scenario.steps.length - 1)); };
  const togglePlay = () => setPlaying(p => !p);

  // Close tech panel when step changes
  useEffect(() => { setTechOpen(false); }, [step]);

  return (
    <div className="rounded-2xl overflow-hidden border border-black/[0.07]">
      {/* Header bar */}
      <div className="bg-[#1c1c1e] px-6 py-4 flex items-center gap-3 border-b border-white/[0.06]">
        <span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} aria-hidden="true" />
        <span className="text-[12px] font-mono text-white/40">{domainLabel}</span>
        <span className="text-white/15 text-[12px]">·</span>
        <span className="text-[13px] font-semibold text-white/80 truncate">
          {lang === 'th' ? scenario.labelTH : scenario.labelEN}
        </span>
        <span className="ml-auto shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${colors.badge} ${colors.badgeFg}`}>
            {scenario.labelEN}
          </span>
        </span>
      </div>

      {/* Diagram */}
      <div className="p-8 bg-[#1c1c1e] min-h-[120px]">
        <FlowDiagram
          scenario={scenario}
          nodeStates={nodeStates}
          reducedMotion={reducedMotion}
        />
      </div>

      {/* Description + navigation */}
      <div className="px-8 py-6 bg-[#1c1c1e] border-t border-white/[0.06]">
        <div className="flex items-start justify-between gap-4">
          {/* Animated step description */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${scenario.id}-${step}`}
              initial={reducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex-1 min-w-0"
              aria-live="polite"
            >
              <p className="text-[17px] font-semibold text-white/85 mb-1">
                {lang === 'th' ? cur.descTH : cur.descEN}
              </p>
              {lang === 'th' && (
                <p className="text-[14px] text-white/50 leading-6">{cur.descEN}</p>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation buttons — 44×44px per WCAG 2.5.5 */}
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            <button
              onClick={togglePlay}
              disabled={reducedMotion}
              aria-label={playing ? (lang === 'th' ? 'หยุดชั่วคราว' : 'Pause') : (lang === 'th' ? 'เล่นอัตโนมัติ' : 'Play')}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-[#1c1c1e] border border-white/10 text-white/50 hover:text-white/80 hover:border-white/25 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              {playing
                ? <Pause size={14} />
                : <Play size={14} />
              }
            </button>
            <button
              onClick={prev}
              disabled={step === 0}
              aria-label={lang === 'th' ? 'ขั้นตอนก่อนหน้า' : 'Previous step'}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-[#1c1c1e] border border-white/10 text-white/50 text-[18px] hover:text-white/80 hover:border-white/25 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              ‹
            </button>
            <span
              className="text-[13px] font-semibold text-white/40 w-12 text-center tabular-nums"
              aria-live="polite"
              aria-atomic="true"
            >
              {step + 1} / {scenario.steps.length}
            </span>
            <button
              onClick={next}
              disabled={step === scenario.steps.length - 1}
              aria-label={lang === 'th' ? 'ขั้นตอนถัดไป' : 'Next step'}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-[#1c1c1e] border border-white/10 text-white/50 text-[18px] hover:text-white/80 hover:border-white/25 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              ›
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 mt-4" role="group" aria-label={lang === 'th' ? 'ขั้นตอนทั้งหมด' : 'All steps'}>
          {scenario.steps.map((_, i) => (
            <button
              key={i}
              onClick={() => { setPlaying(false); setStep(i); }}
              aria-label={lang === 'th' ? `ขั้นตอน ${i + 1}` : `Step ${i + 1}`}
              aria-current={i === step ? 'step' : undefined}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === step ? `w-4 ${colors.dot}` : 'w-1.5 bg-white/15 hover:bg-white/25'
              }`}
            />
          ))}
        </div>

        {/* Technical detail expand — only shown when step has techEN or techTH */}
        {hasTech && (
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <button
              onClick={() => setTechOpen(o => !o)}
              className="flex items-center gap-2 text-[12px] text-white/35 hover:text-white/60 transition-colors"
              aria-expanded={techOpen}
            >
              <ChevronDown
                size={13}
                className="shrink-0 transition-transform duration-200"
                style={{ transform: techOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
              {lang === 'th' ? 'รายละเอียดเชิงเทคนิค' : 'Technical details'}
            </button>

            <AnimatePresence>
              {techOpen && (
                <motion.div
                  initial={reducedMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={reducedMotion ? undefined : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 p-4 rounded-xl bg-white/[0.04] border border-white/[0.07] space-y-2">
                    {lang === 'th' ? (
                      <>
                        {cur.techTH && <p className="text-[13px] text-white/75 leading-6">{cur.techTH}</p>}
                        {cur.techEN && <p className="text-[13px] text-white/35 leading-6 font-mono">{cur.techEN}</p>}
                      </>
                    ) : (
                      <>
                        {cur.techEN && <p className="text-[13px] text-white/75 leading-6 font-mono">{cur.techEN}</p>}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-8 py-3 bg-[#1c1c1e] border-t border-white/[0.04] flex items-center gap-4 flex-wrap">
        <span className="text-[10px] font-mono text-white/20 shrink-0">legend:</span>
        {LEGEND.map(({ state, cls, labelEN, labelTH }) => (
          <span key={state} className="flex items-center gap-1.5 text-[10px] text-white/30">
            <span className={`w-2 h-2 rounded-full shrink-0 ${cls}`} aria-hidden="true" />
            {lang === 'th' ? labelTH : labelEN}
          </span>
        ))}
      </div>
    </div>
  );
}
