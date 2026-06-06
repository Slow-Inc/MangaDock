import { promises as fs } from 'fs';
import path from 'path';
import DocsClient, { MdFile } from './DocsClient';
import { CATEGORY_LABELS } from './utils';

async function collectMdFiles(): Promise<MdFile[]> {
  const root = path.join(process.cwd(), '..');
  const files: MdFile[] = [];

  // Root-level MD files
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.md') || e.name.startsWith('.') || e.name === 'MEMORY.md') continue;
      const content = await fs.readFile(path.join(root, e.name), 'utf-8').catch(() => '');
      files.push({
        relativePath: e.name,
        name: e.name.replace(/\.md$/, ''),
        category: 'หลัก',
        content,
      });
    }
  } catch {}

  // Recursive scan of docs/ directory
  async function scanDir(absDir: string, relBase: string) {
    try {
      const entries = await fs.readdir(absDir, { withFileTypes: true });
      for (const e of entries) {
        const childRel = `${relBase}/${e.name}`;
        if (e.isDirectory()) {
          await scanDir(path.join(absDir, e.name), childRel);
        } else if (e.name.endsWith('.md') && e.name !== 'MEMORY.md') {
          const content = await fs.readFile(path.join(absDir, e.name), 'utf-8').catch(() => '');
          files.push({
            relativePath: childRel,
            name: e.name.replace(/\.md$/, ''),
            category: CATEGORY_LABELS[relBase] ?? relBase,
            content,
          });
        }
      }
    } catch {}
  }

  await scanDir(path.join(root, 'docs'), 'docs');

  return files;
}

export const metadata = { title: 'เอกสาร — MangaDock' };

export default async function DocsPage() {
  const mdFiles = await collectMdFiles();
  return <DocsClient mdFiles={mdFiles} />;
}
