import { NextRequest, NextResponse } from 'next/server';
import { createGithubCache } from './githubCache';
import { parseGithubParams } from './githubParams';

const OWNER = 'Slow-Inc';
const REPO = 'MangaDock';
const BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;

const GH_HEADERS: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'MangaDock-Docs/1.0',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

// One cache per server process. `cache: 'no-store'` keeps Next's own data cache out of the way —
// githubCache does the revalidating (ETag), and a second layer would answer before GitHub is asked.
const github = createGithubCache({
  fetchUpstream: (url, headers) => fetch(url, { headers: { ...GH_HEADERS, ...headers }, cache: 'no-store' }),
});

// What the browser (and any CDN) may keep: a fresh answer for 2 min, usable for 15 more while it
// revalidates in the background — so a reload or a second tab does not come back here at all.
const CACHE_CONTROL = {
  stale: 'public, max-age=30', // GitHub is failing: serve the old copy, ask again soon
  error: 'no-store', // never let an error be remembered
  fresh: 'public, max-age=120, s-maxage=300, stale-while-revalidate=900', // hit / revalidated / miss
} as const;

export async function GET(req: NextRequest) {
  const params = parseGithubParams(req.nextUrl.searchParams);
  if (!params) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  const { type, state, page, per_page, number } = params;

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

  const { status, body, cache } = await github.get(url);
  return new NextResponse(body, {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cache === 'stale' || cache === 'error' ? CACHE_CONTROL[cache] : CACHE_CONTROL.fresh, 'X-Docs-Cache': cache },
  });
}
