import { BadRequestException } from '@nestjs/common';
import { fileTypeFromFile } from 'file-type';
import { ForumService } from './forum.service';

const mockFileType = fileTypeFromFile as jest.Mock;

function buildMockChain(overrides: Record<string, jest.Mock> = {}) {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    match: jest.fn().mockReturnThis(),
    ...overrides,
  };
  return chain;
}

const mockForumEvents = {
  broadcastPostEvent: jest.fn().mockResolvedValue(undefined),
  broadcastFeedEvent: jest.fn().mockResolvedValue(undefined),
};

function makeService(fromImpl: (table: string) => any, rpcImpl?: jest.Mock) {
  const supabaseService = {
    client: {
      from: jest.fn().mockImplementation(fromImpl),
      rpc: rpcImpl ?? jest.fn().mockResolvedValue({ data: [{ upvotes: 0, downvotes: 0 }], error: null }),
    },
  } as any;
  return new ForumService(supabaseService, {} as any, mockForumEvents as any);
}

// ── vote ──────────────────────────────────────────────────────────────────────

describe('ForumService.vote', () => {
  let service: ForumService;
  let mockChain: ReturnType<typeof buildMockChain>;
  let mockRpc: jest.Mock;

  const dto = { targetType: 'post' as const, targetId: 'p1', voteValue: 1 as const };

  beforeEach(() => {
    mockChain = buildMockChain();
    mockRpc = jest.fn().mockResolvedValue({ data: [{ upvotes: 5, downvotes: 2 }], error: null });
    service = makeService(() => mockChain, mockRpc);
    mockForumEvents.broadcastPostEvent.mockClear();
  });

  it('casts the vote atomically via cast_vote_atomic without a read-then-write on forum_votes', async () => {
    const result = await service.vote('u1', dto);

    expect(mockRpc).toHaveBeenCalledWith('cast_vote_atomic', {
      p_uid: 'u1',
      p_target_type: 'post',
      p_target_id: 'p1',
      p_vote_value: 1,
    });
    // The race-prone select/insert/update/delete on forum_votes must be gone.
    expect(mockChain.insert).not.toHaveBeenCalled();
    expect(mockChain.update).not.toHaveBeenCalled();
    expect(mockChain.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ upvotes: 5, downvotes: 2 });
  });

  it('returns the upvote/downvote totals produced by the RPC', async () => {
    mockRpc.mockResolvedValue({ data: [{ upvotes: 10, downvotes: 3 }], error: null });

    const result = await service.vote('u1', dto);

    expect(result).toEqual({ upvotes: 10, downvotes: 3 });
  });

  it('coerces bigint totals returned as strings into numbers', async () => {
    // Postgres bigint can serialize as a string over PostgREST.
    mockRpc.mockResolvedValue({ data: [{ upvotes: '8', downvotes: '1' }], error: null });

    const result = await service.vote('u1', dto);

    expect(result).toEqual({ upvotes: 8, downvotes: 1 });
  });

  it('throws when the RPC returns an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'deadlock detected' } });

    await expect(service.vote('u1', dto)).rejects.toThrow('Vote failed');
  });

  it('broadcasts a post vote event with the new totals', async () => {
    await service.vote('u1', dto);

    expect(mockForumEvents.broadcastPostEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'vote',
        postId: 'p1',
        targetType: 'post',
        targetId: 'p1',
        upvotes: 5,
        downvotes: 2,
      }),
    );
  });

  it('resolves postId via a forum_comments lookup when voting on a comment', async () => {
    const commentDto = { targetType: 'comment' as const, targetId: 'c1', voteValue: 1 as const };
    mockChain.single.mockResolvedValue({ data: { post_id: 'p9' }, error: null });

    await service.vote('u1', commentDto);

    expect(mockRpc).toHaveBeenCalledWith(
      'cast_vote_atomic',
      expect.objectContaining({ p_target_type: 'comment', p_target_id: 'c1' }),
    );
    expect(mockForumEvents.broadcastPostEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'vote', postId: 'p9', targetType: 'comment', targetId: 'c1' }),
    );
  });
});

// ── null-safe comment count (FR-10) ─────────────────────────────────────────────

describe('ForumService.listPosts / getPost — null-safe comment count', () => {
  const baseRow = {
    id: 'p1',
    author_uid: 'u1',
    title: 'T',
    content: 'C',
    category: 'general',
    target_manga_id: null,
    target_manga_title: null,
    target_manga_cover: null,
    image_urls: null,
    upvotes: 0,
    downvotes: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    author: { display_name: 'A', photo_url: null, role: 'user' },
    comments: null as Array<{ count: number }> | null, // null embed — the bug trigger
  };

  it('listPosts returns commentCount 0 when the comments embed is null', async () => {
    const chain = buildMockChain({
      range: jest.fn().mockResolvedValue({ data: [baseRow], count: 1, error: null }),
    });
    const service = makeService(() => chain);

    const result = await service.listPosts();

    expect(result.items[0].commentCount).toBe(0);
  });

  it('listPosts reads the count from a populated comments embed', async () => {
    const chain = buildMockChain({
      range: jest.fn().mockResolvedValue({
        data: [{ ...baseRow, comments: [{ count: 7 }] }],
        count: 1,
        error: null,
      }),
    });
    const service = makeService(() => chain);

    const result = await service.listPosts();

    expect(result.items[0].commentCount).toBe(7);
  });

  it('getPost returns commentCount 0 when the comments embed is null', async () => {
    const chain = buildMockChain({
      single: jest.fn().mockResolvedValue({ data: baseRow, error: null }),
    });
    const service = makeService(() => chain);

    const result = await service.getPost('p1');

    expect(result.commentCount).toBe(0);
  });

  it('getPost reads the count from a populated comments embed', async () => {
    const chain = buildMockChain({
      single: jest.fn().mockResolvedValue({ data: { ...baseRow, comments: [{ count: 5 }] }, error: null }),
    });
    const service = makeService(() => chain);

    const result = await service.getPost('p1');

    expect(result.commentCount).toBe(5);
  });
});

// ── embedded comment count excludes soft-deleted rows (FR-17) ──────────────────
// The embedded `comments:forum_comments(count)` must count only rows with
// deleted_at IS NULL, so the number shown next to a post matches what
// listComments (which already filters deleted_at) returns to a reader.

describe('ForumService — embedded comment count excludes soft-deleted rows (FR-17)', () => {
  const baseRow = {
    id: 'p1',
    author_uid: 'u1',
    title: 'T',
    content: 'C',
    category: 'general',
    target_manga_id: null,
    target_manga_title: null,
    target_manga_cover: null,
    image_urls: null,
    upvotes: 0,
    downvotes: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    author: { display_name: 'A', photo_url: null, role: 'user' },
    comments: [{ count: 3 }] as Array<{ count: number }>,
  };

  it('listPosts filters the embedded comment count on deleted_at IS NULL', async () => {
    const chain = buildMockChain({
      range: jest.fn().mockResolvedValue({ data: [baseRow], count: 1, error: null }),
    });
    const service = makeService(() => chain);

    await service.listPosts();

    expect(chain.is).toHaveBeenCalledWith('comments.deleted_at', null);
  });

  it('getPost filters the embedded comment count on deleted_at IS NULL', async () => {
    const chain = buildMockChain({
      single: jest.fn().mockResolvedValue({ data: baseRow, error: null }),
    });
    const service = makeService(() => chain);

    await service.getPost('p1');

    expect(chain.is).toHaveBeenCalledWith('comments.deleted_at', null);
  });

  it('getPublicProfile filters embedded comment counts for both authored and liked posts', async () => {
    // Two forum_posts queries run: authored posts (ends with .limit) and liked
    // posts (ends with .is). Route each to its own chain so both can be asserted.
    const authoredChain = buildMockChain({
      limit: jest.fn().mockResolvedValue({ data: [baseRow], error: null }),
    });
    const likedChain = buildMockChain(); // ends on .is → returns the chain object
    const forumPostsChains = [authoredChain, likedChain];

    const fromImpl = (table: string) => {
      switch (table) {
        case 'profiles':
          return buildMockChain({
            single: jest.fn().mockResolvedValue({
              data: { uid: 'u1', role: 'user', display_name: 'A' },
              error: null,
            }),
          });
        case 'forum_posts':
          return forumPostsChains.shift();
        case 'forum_comments':
          return buildMockChain({ limit: jest.fn().mockResolvedValue({ data: [], error: null }) });
        case 'forum_votes':
          // One liked post id so the liked-posts query (site 253) runs.
          return buildMockChain({
            limit: jest.fn().mockResolvedValue({
              data: [{ target_id: 'p2', created_at: '2024-01-01T00:00:00Z' }],
              error: null,
            }),
          });
        case 'chapter_versions':
          return buildMockChain({ in: jest.fn().mockResolvedValue({ data: [], error: null }) });
        default:
          return buildMockChain();
      }
    };
    const service = makeService(fromImpl);

    await service.getPublicProfile('u1');

    expect(authoredChain.is).toHaveBeenCalledWith('comments.deleted_at', null);
    expect(likedChain.is).toHaveBeenCalledWith('comments.deleted_at', null);
  });
});

// ── listComments tree assembly ─────────────────────────────────────────────────

describe('ForumService.listComments — tree assembly', () => {
  const makeComment = (id: string, parentId: string | null) => ({
    id,
    post_id: 'p1',
    parent_id: parentId,
    author_uid: 'u1',
    content: `comment ${id}`,
    upvotes: 0,
    downvotes: 0,
    author: { display_name: 'Alice', photo_url: null, role: 'user' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  });

  it('nests child comments under their parent and returns only roots', async () => {
    const flatComments = [makeComment('c1', null), makeComment('c2', 'c1')];
    const chain = buildMockChain({
      limit: jest.fn().mockResolvedValue({ data: flatComments, error: null }),
    });
    const service = makeService(() => chain);

    const result = await service.listComments('p1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
    expect(result[0].replies).toHaveLength(1);
    expect(result[0].replies![0].id).toBe('c2');
  });

  it('returns all comments as roots when none have a parent', async () => {
    const flatComments = [makeComment('c1', null), makeComment('c2', null)];
    const chain = buildMockChain({
      limit: jest.fn().mockResolvedValue({ data: flatComments, error: null }),
    });
    const service = makeService(() => chain);

    const result = await service.listComments('p1');

    expect(result).toHaveLength(2);
    expect(result.every(c => c.replies?.length === 0)).toBe(true);
  });

  it('handles deep nesting (grandchild comment)', async () => {
    const flatComments = [
      makeComment('c1', null),
      makeComment('c2', 'c1'),
      makeComment('c3', 'c2'),
    ];
    const chain = buildMockChain({
      limit: jest.fn().mockResolvedValue({ data: flatComments, error: null }),
    });
    const service = makeService(() => chain);

    const result = await service.listComments('p1');

    expect(result).toHaveLength(1);
    expect(result[0].replies![0].replies![0].id).toBe('c3');
  });

  it('returns empty array when there are no comments', async () => {
    const chain = buildMockChain({
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    const service = makeService(() => chain);

    const result = await service.listComments('p1');

    expect(result).toEqual([]);
  });
});

// ── getTrendingManga ───────────────────────────────────────────────────────────

describe('ForumService.getTrendingManga', () => {
  // The RPC returns rows already grouped + ranked by Postgres (snake_case columns,
  // post_count arrives as a bigint string over PostgREST).
  const makeRow = (mangaId: string, postCount: number) => ({
    manga_id: mangaId,
    manga_title: `Manga ${mangaId}`,
    manga_cover: `${mangaId}.jpg`,
    post_count: String(postCount),
  });

  it('computes trending via the get_trending_manga RPC, not an in-Node tally of a row sample', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [makeRow('m2', 3), makeRow('m1', 2)],
      error: null,
    });
    // from() must not be used for trending — a table-scan-then-tally is the bug we removed.
    const from = jest.fn(() => {
      throw new Error('forum_posts should not be scanned for trending');
    });
    const service = makeService(from, rpc);

    const result = await service.getTrendingManga(5);

    expect(rpc).toHaveBeenCalledWith('get_trending_manga', { p_limit: 5 });
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual([
      { mangaId: 'm2', mangaTitle: 'Manga m2', mangaCover: 'm2.jpg', postCount: 3 },
      { mangaId: 'm1', mangaTitle: 'Manga m1', mangaCover: 'm1.jpg', postCount: 2 },
    ]);
  });

  it('preserves the DB ranking (correct beyond a 200-row sample) and coerces bigint counts', async () => {
    // A manga with more within-window activity outranks one Postgres ordered lower —
    // the service must trust the DB order, not re-sample/re-sort locally.
    const rpc = jest.fn().mockResolvedValue({
      data: [makeRow('hot', 5000), makeRow('warm', 4999), makeRow('cool', 10)],
      error: null,
    });
    const service = makeService(() => ({}), rpc);

    const result = await service.getTrendingManga(5);

    expect(result.map(r => r.mangaId)).toEqual(['hot', 'warm', 'cool']);
    expect(result.map(r => r.postCount)).toEqual([5000, 4999, 10]);
    expect(typeof result[0].postCount).toBe('number');
  });

  it('passes the limit through to the RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
    const service = makeService(() => ({}), rpc);

    await service.getTrendingManga(3);

    expect(rpc).toHaveBeenCalledWith('get_trending_manga', { p_limit: 3 });
  });

  it('returns empty array on Supabase error without throwing', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'DB failure' } });
    const service = makeService(() => ({}), rpc);

    await expect(service.getTrendingManga()).resolves.toEqual([]);
  });
});

// ── uploadImage MIME guard ─────────────────────────────────────────────────────
// The service validates by magic bytes (fileTypeFromFile), not the _clientMime param.
// Tests must mock fileTypeFromFile to control what MIME the service sees.

describe('ForumService.uploadImage — MIME validation', () => {
  const service = makeService(() => ({}));

  it.each([
    ['image/svg+xml'],
    ['image/bmp'],
    ['application/pdf'],
    ['text/html'],
  ])('rejects disallowed MIME type detected by magic bytes: %s', async (mime) => {
    mockFileType.mockResolvedValueOnce({ mime, ext: mime.split('/')[1] });
    await expect(service.uploadImage('u1', '/tmp/nonexistent', 'ignored'))
      .rejects.toThrow(BadRequestException);
  });

  it.each([
    ['image/jpeg'],
    ['image/png'],
    ['image/webp'],
    ['image/gif'],
  ])('passes MIME check for allowed type: %s (storage will fail — not a MIME rejection)', async (mime) => {
    mockFileType.mockResolvedValueOnce({ mime, ext: mime.split('/')[1] });
    // BadRequestException should NOT be thrown — any other error (ENOENT) is acceptable
    await expect(service.uploadImage('u1', '/tmp/nonexistent', 'ignored'))
      .rejects.not.toThrow(BadRequestException);
  });
});

describe('ForumService.getPublicProfile', () => {
  it('logs a warning when a secondary query returns an error instead of masking it', async () => {
    // A query builder that is both chainable and awaitable, resolving to {data, error}.
    // getPublicProfile awaits the `profiles` builder via `.single()` and the other
    // four builders directly (they end at `.limit()`/`.in()`), so both paths are covered.
    const thenableChain = (result: { data: unknown; error: unknown }) => {
      const chain: any = {};
      for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      chain.single = jest.fn().mockResolvedValue(result);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(res, rej);
      return chain;
    };

    const service = makeService((table: string) => {
      switch (table) {
        case 'profiles':
          return thenableChain({ data: { uid: 'u1', role: 'user' }, error: null });
        case 'forum_posts':
          return thenableChain({ data: null, error: { message: 'boom' } }); // failing secondary
        default:
          return thenableChain({ data: [], error: null });
      }
    });

    const warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);

    await service.getPublicProfile('u1', 'viewer1');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('posts'));
  });
});
