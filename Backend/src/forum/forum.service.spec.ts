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
