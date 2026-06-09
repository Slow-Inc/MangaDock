'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { SimulatorPanel } from './SimulatorPanel';
import { DOMAIN_COLORS } from './engine';
import { ALL_DOMAINS, findScenarioById } from './data/index';
import type { SimDomain, SimScenario } from './engine';
import { useLang } from '../lang-context';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitialScenarioId(): string {
  if (typeof window === 'undefined') return ALL_DOMAINS[0].scenarios[0].id;
  const param = new URLSearchParams(window.location.search).get('sim');
  if (param && findScenarioById(param)) return param;
  return ALL_DOMAINS[0].scenarios[0].id;
}

function setSimParam(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('sim', id);
  history.replaceState(null, '', url.toString());
}

// ─── Domain accordion item ───────────────────────────────────────────────────

function DomainAccordionItem({
  domain,
  isOpen,
  activeScenarioId,
  onToggle,
  onSelectScenario,
}: {
  domain: SimDomain;
  isOpen: boolean;
  activeScenarioId: string;
  onToggle: () => void;
  onSelectScenario: (s: SimScenario) => void;
}) {
  const colors = DOMAIN_COLORS[domain.color];
  const lang = useLang();

  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-black/[0.04] transition-colors rounded-lg"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-[#1d1d1f] truncate">
            {lang === 'th' ? domain.labelTH : domain.labelEN}
          </div>
          {lang === 'th' && (
            <div className="text-[11px] text-[#6e6e73] truncate">{domain.labelEN}</div>
          )}
        </div>
        <ChevronRight
          size={13}
          className="shrink-0 text-[#86868b] transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
      </button>

      {isOpen && (
        <div className="ml-[22px] pl-3 border-l border-black/[0.08] space-y-0.5 pb-1">
          {domain.scenarios.map(scenario => {
            const isActive = scenario.id === activeScenarioId;
            return (
              <button
                key={scenario.id}
                onClick={() => onSelectScenario(scenario)}
                aria-pressed={isActive}
                className={`w-full text-left flex items-center gap-2 px-2 py-2 rounded-md text-[12px] transition-colors ${
                  isActive
                    ? 'bg-[#0071e3]/[0.08] text-[#0071e3] font-medium'
                    : 'text-[#374151] hover:bg-black/[0.04] hover:text-[#1d1d1f]'
                }`}
              >
                <span
                  className={`shrink-0 inline-flex items-center justify-center rounded text-[9px] font-mono font-semibold tabular-nums leading-none transition-colors ${
                    isActive
                      ? 'bg-[#0071e3]/[0.12] text-[#0071e3]'
                      : 'bg-black/[0.06] text-[#86868b]'
                  }`}
                  style={{ minWidth: '24px', height: '16px', padding: '0 3px' }}
                >
                  {scenario.badge}
                </span>
                <span className="truncate">
                  {lang === 'th' ? scenario.labelTH : scenario.labelEN}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Mobile chip pickers ─────────────────────────────────────────────────────

function MobileChipPicker({
  activeScenarioId,
  onSelect,
}: {
  activeScenarioId: string;
  onSelect: (s: SimScenario) => void;
}) {
  const { domain: activeDomain } = useMemo(
    () => findScenarioById(activeScenarioId) ?? { domain: ALL_DOMAINS[0], scenario: ALL_DOMAINS[0].scenarios[0] },
    [activeScenarioId],
  );

  const [selectedDomainId, setSelectedDomainId] = useState(activeDomain?.id ?? ALL_DOMAINS[0].id);

  const currentDomain = ALL_DOMAINS.find(d => d.id === selectedDomainId) ?? ALL_DOMAINS[0];

  return (
    <div className="md:hidden border-b border-black/[0.08]">
      {/* Domain chips */}
      <div className="overflow-x-auto px-4 pt-3 pb-0 flex gap-2 min-w-0" style={{ scrollbarWidth: 'none' }}>
        {ALL_DOMAINS.map(d => {
          const dc = DOMAIN_COLORS[d.color];
          const isSelected = d.id === selectedDomainId;
          return (
            <button
              key={d.id}
              onClick={() => {
                setSelectedDomainId(d.id);
                onSelect(d.scenarios[0]);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 transition-all ${
                isSelected
                  ? `${dc.badge} ${dc.badgeFg} shadow-sm`
                  : 'bg-black/[0.04] text-[#6e6e73] hover:bg-black/[0.07]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dc.dot}`} aria-hidden="true" />
              {d.labelEN}
            </button>
          );
        })}
      </div>

      {/* Scenario chips for selected domain */}
      <div className="overflow-x-auto px-4 py-2 flex gap-2" style={{ scrollbarWidth: 'none' }}>
        {currentDomain.scenarios.map(s => {
          const isActive = s.id === activeScenarioId;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              aria-pressed={isActive}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] whitespace-nowrap shrink-0 transition-all ${
                isActive
                  ? 'bg-[#1d1d1f] text-white'
                  : 'bg-black/[0.04] text-[#374151] hover:bg-black/[0.07]'
              }`}
            >
              <span className="font-mono text-[9px] font-semibold opacity-60 tabular-nums">{s.badge}</span>
              {s.labelEN}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main SimulationsView ─────────────────────────────────────────────────────

export default function SimulationsView() {
  const lang = useLang();
  const [activeId, setActiveId] = useState<string>(getInitialScenarioId);
  const [openDomains, setOpenDomains] = useState<Set<string>>(new Set([ALL_DOMAINS[0].id]));

  const { scenario: activeScenario, domain: activeDomain } = useMemo(
    () => findScenarioById(activeId) ?? { scenario: ALL_DOMAINS[0].scenarios[0], domain: ALL_DOMAINS[0] },
    [activeId],
  );

  function selectScenario(s: SimScenario, domain?: SimDomain) {
    setActiveId(s.id);
    setSimParam(s.id);
    if (domain) {
      setOpenDomains(prev => new Set([...prev, domain.id]));
    }
  }

  function toggleDomain(id: string) {
    setOpenDomains(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Open the active scenario's domain on mount
  useEffect(() => {
    if (activeDomain) {
      setOpenDomains(prev => new Set([...prev, activeDomain.id]));
    }
  }, []);

  return (
    <div className="flex h-full overflow-hidden">

      {/* Desktop: domain accordion sidebar */}
      <aside
        className="hidden md:flex w-[220px] shrink-0 flex-col border-r border-black/[0.08] bg-[#f5f5f7] overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.08) transparent' }}
        aria-label="Simulation domains"
      >
        <div className="px-3 pt-5 pb-3">
          <p className="px-3 mb-3 text-[11px] font-medium text-[#6e6e73] tracking-wide uppercase">
            Scenarios
          </p>
          <div className="space-y-0.5">
            {ALL_DOMAINS.map(domain => (
              <DomainAccordionItem
                key={domain.id}
                domain={domain}
                isOpen={openDomains.has(domain.id)}
                activeScenarioId={activeId}
                onToggle={() => toggleDomain(domain.id)}
                onSelectScenario={s => selectScenario(s, domain)}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* Mobile: chip picker + content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileChipPicker
          activeScenarioId={activeId}
          onSelect={s => selectScenario(s)}
        />

        {/* Simulator content area */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.08) transparent' }}
        >
          <div className="max-w-[840px] mx-auto px-4 md:px-8 py-6">
            {/* Page heading */}
            <div className="mb-6">
              <h1 className="text-[22px] font-semibold text-[#1d1d1f]">
                {lang === 'th' ? 'จำลองการทำงานของระบบ' : 'Interactive Simulations'}
              </h1>
              <p className="text-[14px] text-[#6e6e73] mt-1">
                {lang === 'th'
                  ? <>กดปุ่ม <kbd className="px-1.5 py-0.5 rounded text-[11px] bg-black/[0.06] font-mono">›</kbd> หรือ Play เพื่อดำเนินต่อ</>
                  : <>Step through how MangaDock&rsquo;s systems work — press <kbd className="px-1.5 py-0.5 rounded text-[11px] bg-black/[0.06] font-mono">›</kbd> or Play to advance</>
                }
              </p>
            </div>

            {/* Simulator panel */}
            {activeScenario && activeDomain && (
              <SimulatorPanel
                key={activeScenario.id}
                scenario={activeScenario}
                domainColor={activeDomain.color}
                domainLabel={lang === 'th' ? activeDomain.labelTH : activeDomain.labelEN}
              />
            )}

            {/* Domain summary strip */}
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ALL_DOMAINS.map(domain => {
                const colors = DOMAIN_COLORS[domain.color];
                const isActive = activeDomain?.id === domain.id;
                return (
                  <button
                    key={domain.id}
                    onClick={() => {
                      const first = domain.scenarios[0];
                      if (first) selectScenario(first, domain);
                    }}
                    className={`text-left px-3 py-2.5 rounded-xl border transition-all ${
                      isActive
                        ? `${colors.bg} ${colors.border}`
                        : 'border-black/[0.08] hover:border-black/[0.15] hover:bg-black/[0.02]'
                    }`}
                  >
                    <div className={`text-[12px] font-semibold ${isActive ? colors.text : 'text-[#1d1d1f]'}`}>
                      {domain.labelEN}
                    </div>
                    <div className="text-[11px] text-[#86868b] mt-0.5">
                      {domain.scenarios.length} scenario{domain.scenarios.length !== 1 ? 's' : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
