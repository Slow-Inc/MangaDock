import type { SimDomain } from '../engine';
import { cacheReadScenarios, cacheWriteScenarios, translateScenarios } from './cache';
import { authScenarios } from './auth';
import { unlockScenarios } from './unlock';
import { sseScenarios } from './sse';
import { assetScenarios } from './assets';
import { uploadScenarios } from './upload';
import { mitScenarios } from './mit';

export const ALL_DOMAINS: SimDomain[] = [
  {
    id: 'cache-read',
    labelEN: 'Cache — Read',
    labelTH: 'Cache อ่านข้อมูล',
    color: 'amber',
    scenarios: cacheReadScenarios,
  },
  {
    id: 'cache-write',
    labelEN: 'Cache — Write',
    labelTH: 'Cache เขียนข้อมูล',
    color: 'amber',
    scenarios: cacheWriteScenarios,
  },
  {
    id: 'translate',
    labelEN: 'Translation',
    labelTH: 'แปลมังงะ',
    color: 'emerald',
    scenarios: translateScenarios,
  },
  {
    id: 'auth',
    labelEN: 'Authentication',
    labelTH: 'การยืนยันตัวตน',
    color: 'indigo',
    scenarios: authScenarios,
  },
  {
    id: 'unlock',
    labelEN: 'Chapter Unlock',
    labelTH: 'ปลดล็อก Chapter',
    color: 'rose',
    scenarios: unlockScenarios,
  },
  {
    id: 'sse',
    labelEN: 'Real-Time (SSE)',
    labelTH: 'Real-Time (SSE)',
    color: 'sky',
    scenarios: sseScenarios,
  },
  {
    id: 'assets',
    labelEN: 'Asset Serving',
    labelTH: 'การส่งรูปภาพ',
    color: 'slate',
    scenarios: assetScenarios,
  },
  {
    id: 'upload',
    labelEN: 'Upload',
    labelTH: 'อัปโหลดไฟล์',
    color: 'violet',
    scenarios: uploadScenarios,
  },
  {
    id: 'mit',
    labelEN: 'MIT — ML Pipeline',
    labelTH: 'MIT ML Pipeline',
    color: 'orange',
    scenarios: mitScenarios,
  },
];

export function findScenarioById(id: string) {
  for (const domain of ALL_DOMAINS) {
    const scenario = domain.scenarios.find(s => s.id === id);
    if (scenario) return { scenario, domain };
  }
  return null;
}
