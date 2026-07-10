import { promises as fs } from 'fs';
import path from 'path';
import DocsClient, { MdFile } from './DocsClient';
import { CATEGORY_LABELS } from './utils';

// Agent-only / index files that should NOT be published to the public docs site.
// CLAUDE.md = agent instructions; README.md = repo/subtree indexes (agent-facing, no bilingual).
// Agent/dev-only files kept off the public docs site. DONE.md is a 258 KB raw changelog
// (biggest single payload item) — dev history, not a public doc; excluding it keeps the
// client bundle lean WITHOUT breaking client-side full-text search (which needs f.content).
const SITE_MD_DENYLIST = new Set(['CLAUDE.md', 'CLAUDE_BRIEF.md', 'DONE.md']);
function isSiteMdDenied(relativePath: string): boolean {
  const rel = relativePath.replaceAll('\\', '/');
  const base = rel.split('/').pop() ?? rel;
  return SITE_MD_DENYLIST.has(rel) || base === 'README.md';
}

async function collectMdFiles(): Promise<MdFile[]> {
  const root = path.join(process.cwd(), '..');
  const files: MdFile[] = [];

  // Root-level MD files
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.md') || e.name.startsWith('.') || e.name === 'MEMORY.md' || isSiteMdDenied(e.name)) continue;
      const content = await fs.readFile(path.join(root, e.name), 'utf-8').catch(() => '');
      files.push({
        relativePath: e.name,
        name: e.name.replace(/\.md$/, ''),
        category: 'หลัก',
        content,
      });
    }
  } catch (err) {
    console.error("Error reading root md files:", err);
  }

  // Recursive scan of docs/ directory
  async function scanDir(absDir: string, relBase: string) {
    try {
      const entries = await fs.readdir(absDir, { withFileTypes: true });
      for (const e of entries) {
        const childRel = `${relBase}/${e.name}`;
        if (e.isDirectory()) {
          await scanDir(path.join(absDir, e.name), childRel);
        } else if (e.name.endsWith('.md') && e.name !== 'MEMORY.md' && !isSiteMdDenied(childRel)) {
          const content = await fs.readFile(path.join(absDir, e.name), 'utf-8').catch(() => '');
          files.push({
            relativePath: childRel,
            name: e.name.replace(/\.md$/, ''),
            category: CATEGORY_LABELS[relBase] ?? relBase,
            content,
          });
        }
      }
    } catch (err) {
      console.error(`Error scanning dir ${absDir}:`, err);
    }
  }

  await scanDir(path.join(root, 'docs'), 'docs');

  // Deterministic order — sidebar grouping and prev/next nav must not depend on fs.readdir() order.
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return files;
}

export const metadata = { title: 'เอกสาร — MangaDock' };

export default async function DocsPage() {
  const mdFiles = await collectMdFiles();
  return <DocsClient mdFiles={mdFiles} />;
}
