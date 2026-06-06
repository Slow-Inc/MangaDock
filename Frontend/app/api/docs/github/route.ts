import { NextRequest, NextResponse } from 'next/server';

const OWNER = 'Slow-Inc';
const REPO = 'MangaDock';
const BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;

const GH_HEADERS: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'MangaDock-Docs/1.0',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const type = p.get('type') ?? '';
  const state = p.get('state') ?? 'all';
  const page = p.get('page') ?? '1';
  const per_page = p.get('per_page') ?? '30';
  const number = p.get('number') ?? '';

  const urls: Record<string, string> = {
    issues: `${BASE}/issues?state=${state}&page=${page}&per_page=${per_page}`,
    issue: `${BASE}/issues/${number}`,
    issue_comments: `${BASE}/issues/${number}/comments`,
    pulls: `${BASE}/pulls?state=${state}&page=${page}&per_page=${per_page}`,
    pull: `${BASE}/pulls/${number}`,
    pull_files: `${BASE}/pulls/${number}/files`,
    branches: `${BASE}/branches?per_page=100`,
    commits: `${BASE}/commits?per_page=${per_page}&page=${page}`,
  };

  const url = urls[type];
  if (!url) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: GH_HEADERS,
      next: { revalidate: 300 },
    });
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json({ error: 'GitHub request failed' }, { status: 500 });
  }
}
