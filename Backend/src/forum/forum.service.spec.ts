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

  const dto = { targetType: 'post' as const, targetId: 'p1', voteValue: 1 as const };

  beforeEach(() => {
    mockChain = buildMockChain();
    service = makeService(() => mockChain);
    jest.spyOn(service as any, 'recalculateVotes').mockResolvedValue({ upvotes: 1, downvotes: 0 });
  });

  it('toggle off: deletes existing vote when user votes the same value again', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: { uid: 'u1', vote_value: 1 }, error: null });

    await service.vote('u1', dto);

    expect(mockChain.delete).toHaveBeenCalled();
    expect(mockChain.match).toHaveBeenCalledWith(expect.objectContaining({ uid: 'u1' }));
    expect(mockChain.insert).not.toHaveBeenCalled();
  });

  it('new vote: inserts row when no existing vote is found', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    await service.vote('u1', dto);

    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'u1', target_id: 'p1', vote_value: 1 }),
    );
    expect(mockChain.delete).not.toHaveBeenCalled();
    expect(mockChain.update).not.toHaveBeenCalled();
  });

  it('switch vote: updates row when existing vote is in the opposite direction', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: { uid: 'u1', vote_value: -1 }, error: null });

    await service.vote('u1', dto); // dto.voteValue = 1, existing = -1

    expect(mockChain.update).toHaveBeenCalledWith({ vote_value: 1 });
    expect(mockChain.delete).not.toHaveBeenCalled();
    expect(mockChain.insert).not.toHaveBeenCalled();
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
  const makePost = (mangaId: string, title: string) => ({
    target_manga_id: mangaId,
    target_manga_title: title,
    target_manga_cover: `${mangaId}.jpg`,
  });

  it('groups posts by manga and sorts by postCount descending', async () => {
    const posts = [
      makePost('m1', 'Manga A'),
      makePost('m2', 'Manga B'),
      makePost('m1', 'Manga A'),
      makePost('m2', 'Manga B'),
      makePost('m2', 'Manga B'),
    ];
    const chain = buildMockChain({
      limit: jest.fn().mockResolvedValue({ data: posts, error: null }),
    });
    const service = makeService(() => chain);

    const result = await service.getTrendingManga(5);

    expect(result[0].mangaId).toBe('m2');
    expect(result[0].postCount).toBe(3);
    expect(result[1].mangaId).toBe('m1');
    expect(result[1].postCount).toBe(2);
  });

  it('respects the limit parameter', async () => {
    const posts = Array.from({ length: 10 }, (_, i) => makePost(`m${i}`, `Manga ${i}`));
    const chain = buildMockChain({
      limit: jest.fn().mockResolvedValue({ data: posts, error: null }),
    });
    const service = makeService(() => chain);

    const result = await service.getTrendingManga(3);

    expect(result).toHaveLength(3);
  });

  it('returns empty array on Supabase error without throwing', async () => {
    const chain = buildMockChain({
      limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB failure' } }),
    });
    const service = makeService(() => chain);

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
