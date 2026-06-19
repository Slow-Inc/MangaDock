import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { SupabaseService } from '../supabase/supabase.service';
import { STORAGE_PROVIDER } from '../common/storage/storage-provider.interface';

function makeSupabaseMock(rows: unknown[], error: unknown = null) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: rows, error }),
    limit: jest.fn().mockResolvedValue({ data: rows, error }),
  };
  return {
    client: { from: jest.fn().mockReturnValue(chain) },
    _chain: chain,
  };
}

describe('UsersService.exportHistory', () => {
  let service: UsersService;
  let supabaseMock: ReturnType<typeof makeSupabaseMock>;

  async function build(rows: unknown[], error: unknown = null) {
    supabaseMock = makeSupabaseMock(rows, error);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: STORAGE_PROVIDER, useValue: {} },
      ],
    }).compile();
    service = module.get(UsersService);
  }

  it('returns header row when history is empty', async () => {
    await build([]);
    const csv = await service.exportHistory('uid-1');
    expect(csv).toBe('title,lastChapter,lastReadAt');
  });

  it('header row is first line', async () => {
    await build([{ title: 'A', subtitle: 'Ch 1', last_read_at: 1000 }]);
    const csv = await service.exportHistory('uid-1');
    const [header] = csv.split('\r\n');
    expect(header).toBe('title,lastChapter,lastReadAt');
  });

  it('row contains correct title, chapter, and ISO date', async () => {
    const ts = 1718000000000;
    await build([{ title: 'One Punch Man', subtitle: 'Chapter 180', last_read_at: ts }]);
    const csv = await service.exportHistory('uid-1');
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(`"One Punch Man","Chapter 180","${new Date(ts).toISOString()}"`);
  });

  it('escapes double-quotes in title', async () => {
    await build([{ title: 'He said "Hi"', subtitle: '', last_read_at: 0 }]);
    const csv = await service.exportHistory('uid-1');
    const [, row] = csv.split('\r\n');
    expect(row).toContain('"He said ""Hi"""');
  });

  it('multiple rows sorted by DB order (no re-sort in service)', async () => {
    await build([
      { title: 'A', subtitle: 'Ch 2', last_read_at: 2000 },
      { title: 'B', subtitle: 'Ch 1', last_read_at: 1000 },
    ]);
    const csv = await service.exportHistory('uid-1');
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"A"');
    expect(lines[2]).toContain('"B"');
  });

  it('throws when Supabase returns an error', async () => {
    await build([], { message: 'db error' });
    await expect(service.exportHistory('uid-1')).rejects.toThrow('Failed to export history');
  });
});

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
