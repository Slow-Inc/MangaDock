import { UsersService } from './users.service';

describe('UsersService — reading history', () => {
  let service: UsersService;
  let mockChain: any;
  let mockUpsert: jest.Mock;

  const baseItem = {
    id: 'manga-1',
    title: 'One Piece',
    thumbnail: 'https://example.com/cover.jpg',
    lastReadAt: 1700000000000,
  };

  beforeEach(() => {
    mockUpsert = jest.fn().mockResolvedValue({ error: null });
    mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      upsert: mockUpsert,
    };

    const supabaseService = {
      client: { from: jest.fn().mockReturnValue(mockChain) },
    } as any;

    service = new UsersService(supabaseService, {} as any);
  });

  // ── upsertHistoryItem ──────────────────────────────────────────────────

  describe('upsertHistoryItem', () => {
    it('writes lastPage and lastChapterId to the DB when provided', async () => {
      await service.upsertHistoryItem('u1', {
        ...baseItem,
        lastPage: 7,
        lastChapterId: 'ch-42',
      });
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ last_page: 7, last_chapter_id: 'ch-42' }),
        expect.anything(),
      );
    });

    it('writes null for lastPage and lastChapterId when omitted (backward-compat)', async () => {
      await service.upsertHistoryItem('u1', baseItem);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ last_page: null, last_chapter_id: null }),
        expect.anything(),
      );
    });

    it('throws when Supabase returns an error', async () => {
      mockUpsert.mockResolvedValue({ error: { message: 'DB error' } });
      await expect(
        service.upsertHistoryItem('u1', baseItem),
      ).rejects.toThrow('Failed to upsert history item');
    });
  });

  // ── getHistory ─────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('maps last_page and last_chapter_id from DB row to camelCase', async () => {
      mockChain.limit = jest.fn().mockResolvedValue({
        data: [
          {
            manga_id: 'manga-1', title: 'One Piece', subtitle: '',
            thumbnail: 'https://example.com/cover.jpg',
            authors: [], description: '', published_date: '',
            categories: [], average_rating: 0, ratings_count: 0,
            last_read_at: 1700000000000,
            last_page: 7,
            last_chapter_id: 'ch-42',
          },
        ],
        error: null,
      });

      const result = await service.getHistory('u1');
      expect(result[0].lastPage).toBe(7);
      expect(result[0].lastChapterId).toBe('ch-42');
    });

    it('returns null for lastPage and lastChapterId when DB columns are null', async () => {
      mockChain.limit = jest.fn().mockResolvedValue({
        data: [
          {
            manga_id: 'manga-1', title: 'One Piece', subtitle: '',
            thumbnail: 'https://example.com/cover.jpg',
            authors: [], description: '', published_date: '',
            categories: [], average_rating: 0, ratings_count: 0,
            last_read_at: 1700000000000,
            last_page: null,
            last_chapter_id: null,
          },
        ],
        error: null,
      });

      const result = await service.getHistory('u1');
      expect(result[0].lastPage).toBeNull();
      expect(result[0].lastChapterId).toBeNull();
    });

    it('throws when Supabase returns an error', async () => {
      mockChain.limit = jest.fn().mockResolvedValue({
        data: null, error: { message: 'DB error' },
      });
      await expect(service.getHistory('u1')).rejects.toThrow('Failed to fetch history');
    });
  });
});
