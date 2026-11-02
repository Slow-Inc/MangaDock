import { promises as fs } from 'fs';
import path from 'path';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import DocsClient, { MdFile } from '../DocsClient';
import { CATEGORY_LABELS } from '../utils';
import { pathToView, viewTitle } from '../routes';

// `cache`: the page and its metadata both ask for the list in one request; read the ~3 MB once.
const collectMdFiles = cache(async (): Promise<MdFile[]> => {
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

  // readdir order is the file system's; the sidebar and the previous/next links must not depend on it.
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
});

type Params = { slug?: string[] };

// Pre-render every page that can be enumerated at build time. Issue/PR numbers come from the
// GitHub API at runtime and are rendered on first request (dynamicParams default = true).
// Documents are deliberately NOT pre-rendered: every page carries the whole document list (the sidebar and its
// full-text search need it), ~3 MB, so building one page per document would write ~1 GB. A document is
// rendered on its first request and kept by Next's cache from then on.
export function generateStaticParams(): Params[] {
  return [{ slug: [] }, { slug: ['techstack'] }, { slug: ['simulations'] }, { slug: ['branches'] }, { slug: ['issues'] }, { slug: ['pulls'] }];
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug = [] } = await params;
  const mdFiles = await collectMdFiles();
  const view = pathToView(slug, mdFiles.map(f => f.relativePath));
  return { title: view ? viewTitle(view, mdFiles) : 'เอกสาร — MangaDock' };
}

export default async function DocsPage({ params }: { params: Promise<Params> }) {
  const { slug = [] } = await params;
  const mdFiles = await collectMdFiles();
  const initialView = pathToView(slug, mdFiles.map(f => f.relativePath));
  if (!initialView) notFound();
  return <DocsClient mdFiles={mdFiles} initialView={initialView} />;
}
