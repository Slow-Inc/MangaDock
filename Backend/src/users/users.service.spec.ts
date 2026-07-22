import { Test, TestingModule } from '@nestjs/testing';
import { UsersService, isSocialCdnUrl } from './users.service';
import { SupabaseService } from '../supabase/supabase.service';
import { STORAGE_PROVIDER } from '../common/storage/storage-provider.interface';

describe('isSocialCdnUrl', () => {
  it('returns true for Google photo URL', () => {
    expect(
      isSocialCdnUrl('https://lh3.googleusercontent.com/a/abc=s96-c'),
    ).toBe(true);
  });

  it('returns true for fbcdn URL (scontent-region.fbcdn.net)', () => {
    expect(
      isSocialCdnUrl('https://scontent-bkk1-1.fbcdn.net/v/photo.jpg'),
    ).toBe(true);
  });

  it('returns true for fbsbx URL', () => {
    expect(
      isSocialCdnUrl('https://platform-lookaside.fbsbx.com/photo.jpg'),
    ).toBe(true);
  });

  it('returns true for graph.facebook.com URL', () => {
    expect(isSocialCdnUrl('https://graph.facebook.com/1234/picture')).toBe(
      true,
    );
  });

  it('returns false for uploaded avatar path', () => {
    expect(isSocialCdnUrl('/uploads/avatars/uid_abc123.jpg')).toBe(false);
  });

  it('returns false for full uploaded avatar URL', () => {
    expect(
      isSocialCdnUrl(
        'https://api.hayateotsu.space/uploads/avatars/uid_abc123.jpg',
      ),
    ).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSocialCdnUrl('')).toBe(false);
  });
});

describe('upsertUser – photo_url refresh', () => {
  const GOOGLE_URL = 'https://lh3.googleusercontent.com/a/abc=s96-c';
  const UPLOADED_URL = '/uploads/avatars/uid_abc.jpg';

  function makeUpsertServiceWith(existingPhotoUrl: string | null) {
    // Track whether a photo_url update was attempted
    let photoUpdateAttempted = false;

    const makeChain = () => {
      // Two-phase init: declare first so callbacks can close over `chain`.
      const chain: Record<string, jest.Mock> = {} as Record<string, jest.Mock>;
      chain.upsert = jest.fn().mockResolvedValue({ error: null });
      chain.update = jest
        .fn()
        .mockImplementation((data: Record<string, unknown>) => {
          if ('photo_url' in data) photoUpdateAttempted = true;
          return chain;
        });
      chain.select = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockImplementation(() => {
        // Make eq() resolve as a promise (terminal) AND support further chaining
        const p = Promise.resolve({ error: null });
        Object.assign(p, chain);
        return p;
      });
      chain.is = jest.fn().mockResolvedValue({ error: null });
      chain.maybeSingle = jest.fn().mockResolvedValue({
        data: { photo_url: existingPhotoUrl },
        error: null,
      });
      return chain;
    };

    const chain = makeChain();
    const supabaseMock = { client: { from: jest.fn().mockReturnValue(chain) } };

    return {
      supabaseMock,
      getPhotoUpdateAttempted: () => photoUpdateAttempted,
    };
  }

  async function buildService(existingPhotoUrl: string | null) {
    const { supabaseMock, getPhotoUpdateAttempted } =
      makeUpsertServiceWith(existingPhotoUrl);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: STORAGE_PROVIDER, useValue: {} },
      ],
    }).compile();
    return { service: module.get(UsersService), getPhotoUpdateAttempted };
  }

  it('writes photo_url when incoming is social CDN and stored is null', async () => {
    const { service, getPhotoUpdateAttempted } = await buildService(null);
    await service.upsertUser('uid-1', {
      email: 'a@b.com',
      displayName: 'A',
      photoURL: GOOGLE_URL,
    });
    expect(getPhotoUpdateAttempted()).toBe(true);
  });

  it('writes photo_url when incoming is social CDN and stored is also social CDN', async () => {
    const { service, getPhotoUpdateAttempted } = await buildService(GOOGLE_URL);
    await service.upsertUser('uid-1', {
      email: 'a@b.com',
      displayName: 'A',
      photoURL: GOOGLE_URL,
    });
    expect(getPhotoUpdateAttempted()).toBe(true);
  });

  it('does NOT write photo_url when incoming is social CDN and stored is an uploaded avatar', async () => {
    const { service, getPhotoUpdateAttempted } =
      await buildService(UPLOADED_URL);
    await service.upsertUser('uid-1', {
      email: 'a@b.com',
      displayName: 'A',
      photoURL: GOOGLE_URL,
    });
    expect(getPhotoUpdateAttempted()).toBe(false);
  });
});

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
    await build([
      { title: 'One Punch Man', subtitle: 'Chapter 180', last_read_at: ts },
    ]);
    const csv = await service.exportHistory('uid-1');
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      `"One Punch Man","Chapter 180","${new Date(ts).toISOString()}"`,
    );
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
    await expect(service.exportHistory('uid-1')).rejects.toThrow(
      'Failed to export history',
    );
  });

  // ── FR-24: CSV-injection guard (prefix formula-triggering fields) ────────
  it.each(['=', '+', '-', '@'])(
    'prefixes a title starting with %s with a single quote',
    async (ch) => {
      await build([
        { title: `${ch}HYPERLINK`, subtitle: `${ch}cmd`, last_read_at: 0 },
      ]);
      const csv = await service.exportHistory('uid-1');
      const [, row] = csv.split('\r\n');
      expect(row).toBe(
        `"'${ch}HYPERLINK","'${ch}cmd","${new Date(0).toISOString()}"`,
      );
    },
  );

  it('leaves a normal title unchanged (no spurious prefix)', async () => {
    await build([
      { title: 'One Punch Man', subtitle: 'Chapter 180', last_read_at: 0 },
    ]);
    const csv = await service.exportHistory('uid-1');
    const [, row] = csv.split('\r\n');
    expect(row).toBe(
      `"One Punch Man","Chapter 180","${new Date(0).toISOString()}"`,
    );
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
      await expect(service.upsertHistoryItem('u1', baseItem)).rejects.toThrow(
        'Failed to upsert history item',
      );
    });
  });

  // ── getHistory ─────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('maps last_page and last_chapter_id from DB row to camelCase', async () => {
      mockChain.limit = jest.fn().mockResolvedValue({
        data: [
          {
            manga_id: 'manga-1',
            title: 'One Piece',
            subtitle: '',
            thumbnail: 'https://example.com/cover.jpg',
            authors: [],
            description: '',
            published_date: '',
            categories: [],
            average_rating: 0,
            ratings_count: 0,
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
            manga_id: 'manga-1',
            title: 'One Piece',
            subtitle: '',
            thumbnail: 'https://example.com/cover.jpg',
            authors: [],
            description: '',
            published_date: '',
            categories: [],
            average_rating: 0,
            ratings_count: 0,
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
        data: null,
        error: { message: 'DB error' },
      });
      await expect(service.getHistory('u1')).rejects.toThrow(
        'Failed to fetch history',
      );
    });
  });
});

// ── FR-21: upsertUser atomic upsert (no read-then-write race) ────────────────
describe('UsersService.upsertUser — atomic upsert', () => {
  const okResult = { error: null };
  let upsertMock: jest.Mock;
  let updateMock: jest.Mock;
  let selectMock: jest.Mock;
  let isMock: jest.Mock;
  let maybeSingleMock: jest.Mock;
  let insertMock: jest.Mock;
  let from: jest.Mock;
  let service: UsersService;

  function buildChain() {
    upsertMock = jest.fn().mockResolvedValue(okResult);
    updateMock = jest.fn().mockReturnThis();
    selectMock = jest.fn().mockReturnThis();
    isMock = jest.fn().mockResolvedValue(okResult);
    maybeSingleMock = jest.fn().mockResolvedValue({ data: null, error: null });
    insertMock = jest.fn().mockResolvedValue(okResult);
    // eq() must be awaitable (email refresh path) AND expose .is / .maybeSingle (backfill / legacy paths).
    const eqReturn: any = Object.assign(Promise.resolve(okResult), {
      is: isMock,
      maybeSingle: maybeSingleMock,
    });
    const chain: any = {
      upsert: upsertMock,
      update: updateMock,
      select: selectMock,
      insert: insertMock,
      eq: jest.fn(() => eqReturn),
    };
    from = jest.fn(() => chain);
    service = new UsersService({ client: { from } } as any, {} as any);
  }

  beforeEach(buildChain);

  it('creates via atomic upsert on conflict uid with ignoreDuplicates (no existence read)', async () => {
    await service.upsertUser('u1', {
      email: 'e@x.com',
      displayName: 'Neo',
      photoURL: 'http://p/a.png',
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'u1', email: 'e@x.com' }),
      { onConflict: 'uid', ignoreDuplicates: true },
    );
    // No read-then-write existence check.
    expect(selectMock).not.toHaveBeenCalled();
    expect(maybeSingleMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('refreshes email on every login', async () => {
    await service.upsertUser('u1', { email: 'new@x.com' });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@x.com' }),
    );
  });

  it('backfills display_name / photo_url only when still null', async () => {
    await service.upsertUser('u1', {
      email: 'e@x.com',
      displayName: 'Neo',
      photoURL: 'http://p/a.png',
    });
    expect(isMock).toHaveBeenCalledWith('display_name', null);
    expect(isMock).toHaveBeenCalledWith('photo_url', null);
  });

  it('does not attempt a display_name backfill when none is provided', async () => {
    await service.upsertUser('u1', { email: 'e@x.com' });
    expect(isMock).not.toHaveBeenCalled();
  });

  it('throws when the atomic create fails', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'dup' } });
    await expect(
      service.upsertUser('u1', { email: 'e@x.com' }),
    ).rejects.toThrow('Failed to create user profile');
  });
});

// ── FR-21: getProfile parallel queries ──────────────────────────────────────
describe('UsersService.getProfile — parallel queries', () => {
  it('dispatches profile and favorites queries in parallel (before either resolves)', async () => {
    let resolveProfile!: (v: unknown) => void;
    let resolveFav!: (v: unknown) => void;
    const profileP = new Promise((r) => (resolveProfile = r));
    const favP = new Promise((r) => (resolveFav = r));

    const profilesChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(() => profileP),
    };
    const favChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn(() => favP),
    };
    const from = jest.fn((t: string) =>
      t === 'profiles' ? profilesChain : favChain,
    );
    const service = new UsersService({ client: { from } } as any, {} as any);

    const promise = service.getProfile('u1');

    // Both queries are issued synchronously, before the profile query resolves.
    // Sequential code would not touch user_favorites until profiles resolved.
    expect(from).toHaveBeenCalledWith('profiles');
    expect(from).toHaveBeenCalledWith('user_favorites');
    expect(favChain.order).toHaveBeenCalled();

    resolveProfile({ data: { uid: 'u1', email: 'e@x.com' }, error: null });
    resolveFav({ data: [], error: null });

    const result = await promise;
    expect(result.uid).toBe('u1');
    expect(result.favorites).toEqual([]);
  });
});

// ── FR-21: deleteUserAccount parallel deletes ───────────────────────────────
describe('UsersService.deleteUserAccount — parallel deletes', () => {
  it('dispatches the four child-table deletes in parallel, profile only after', async () => {
    const resolvers: Record<string, (v: unknown) => void> = {};
    const childTables = ['user_favorites', 'user_liked', 'user_history', 'series_follows'];
    const childChains: Record<string, any> = {};
    for (const t of childTables) {
      childChains[t] = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn(() => new Promise((r) => (resolvers[t] = r))),
      };
    }
    const profileChain: any = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
    const from = jest.fn((t: string) => childChains[t] ?? profileChain);
    const storage = {
      list: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UsersService(
      { client: { from } } as any,
      storage as any,
    );

    const promise = service.deleteUserAccount('u1');

    // All four child deletes issued before any resolves; profile delete not yet reached.
    expect(from).toHaveBeenCalledWith('user_favorites');
    expect(from).toHaveBeenCalledWith('user_liked');
    expect(from).toHaveBeenCalledWith('user_history');
    expect(from).toHaveBeenCalledWith('series_follows');
    expect(profileChain.delete).not.toHaveBeenCalled();

    childTables.forEach((t) => resolvers[t]({ error: null }));
    await promise;

    expect(profileChain.delete).toHaveBeenCalled();
  });

  it("deletes only this user's avatar files, in parallel", async () => {
    const from = jest.fn(() => ({
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    }));
    const storage = {
      list: jest
        .fn()
        .mockResolvedValue(['u1_a.png', 'u1_b.png', 'other_c.png']),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UsersService(
      { client: { from } } as any,
      storage as any,
    );

    await service.deleteUserAccount('u1');

    expect(storage.delete).toHaveBeenCalledWith('uploads/avatars/u1_a.png');
    expect(storage.delete).toHaveBeenCalledWith('uploads/avatars/u1_b.png');
    expect(storage.delete).not.toHaveBeenCalledWith(
      'uploads/avatars/other_c.png',
    );
  });

  it('throws when a child-table delete fails', async () => {
    const from = jest.fn(() => ({
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: { message: 'boom' } }),
    }));
    const storage = {
      list: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    };
    const service = new UsersService(
      { client: { from } } as any,
      storage as any,
    );

    await expect(service.deleteUserAccount('u1')).rejects.toThrow(
      'Failed to delete',
    );
  });
});
