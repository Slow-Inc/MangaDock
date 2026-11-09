import { describe, expect, test } from 'bun:test';
import { parseGithubParams } from './githubParams';

const q = (s: string) => new URLSearchParams(s);

describe('parseGithubParams', () => {
  test('ordinary values pass through', () => {
    expect(parseGithubParams(q('type=issues&state=closed&page=3&per_page=20'))).toEqual({ type: 'issues', state: 'closed', page: '3', per_page: '20', number: '' });
    expect(parseGithubParams(q('type=issue&number=1180'))?.number).toBe('1180');
  });

  test('defaults when a list parameter is missing or nonsense', () => {
    expect(parseGithubParams(q('type=pulls'))).toEqual({ type: 'pulls', state: 'all', page: '1', per_page: '30', number: '' });
    expect(parseGithubParams(q('type=issues&state=../x&page=-1&per_page=abc'))).toMatchObject({ state: 'all', page: '1', per_page: '30' });
  });

  test('page sizes are capped', () => {
    expect(parseGithubParams(q('type=issues&per_page=100000&page=99999'))).toMatchObject({ per_page: '100', page: '1000' });
  });

  test('a number that is not plain digits is refused, so the URL cannot leave the repository path', () => {
    for (const n of ['../../../../rate_limit', '1/comments', '1?x=1', '12abc', '', ' 5', '1e3', '-1', '99999999']) {
      expect(parseGithubParams(q(`type=issue&number=${encodeURIComponent(n)}`))).toBeNull();
    }
    expect(parseGithubParams(q('type=issue_comments'))).toBeNull();
    expect(parseGithubParams(q('type=pull_files&number=x'))).toBeNull();
  });

  test('types that take no number do not need one', () => {
    expect(parseGithubParams(q('type=branches'))).not.toBeNull();
  });
});
