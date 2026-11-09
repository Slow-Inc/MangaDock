// The query parameters of /api/docs/github, checked before they are put into a GitHub URL. They used to be
// pasted in as received, so `number=../../../../rate_limit` normalised out of the repository path and the
// server's token was spent on any GitHub API endpoint the caller named. Only these shapes get through.

export interface GithubParams {
  type: string;
  state: 'open' | 'closed' | 'all';
  page: string;
  per_page: string;
  number: string;
}

const STATES = ['open', 'closed', 'all'] as const;
const NEEDS_NUMBER = new Set(['issue', 'issue_comments', 'pull', 'pull_files']);

const digits = (v: string | null, max: number, fallback: string) => (v !== null && /^\d{1,7}$/.test(v) && Number(v) >= 1 ? String(Math.min(Number(v), max)) : fallback);

/** Normalised parameters, or null when a required one (the issue/PR number) is missing or malformed. */
export function parseGithubParams(p: URLSearchParams): GithubParams | null {
  const type = p.get('type') ?? '';
  const state = STATES.find(s => s === p.get('state')) ?? 'all';
  const raw = p.get('number');
  const number = raw !== null && /^\d{1,7}$/.test(raw) ? String(Number(raw)) : '';
  if (NEEDS_NUMBER.has(type) && !number) return null;
  return { type, state, page: digits(p.get('page'), 1000, '1'), per_page: digits(p.get('per_page'), 100, '30'), number };
}
