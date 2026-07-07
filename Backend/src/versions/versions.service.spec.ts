import { VersionsService } from './versions.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { StorageProvider } from '../common/storage/storage-provider.interface';

/**
 * backendAvailable check (#149): every list endpoint maps each version row and
 * verifies the uploaded page files exist on this node. That check must cost
 * ONE storage.list() per version (readdir of the version's directory), not one
 * storage.exists() per page — N stats per row is tolerable on local disk but
 * catastrophic on the planned R2 adapter (~100ms per round-trip).
 */
function row(versionId: string, pages: string[]) {
  return {
    version_id: versionId,
    title_id: 't1',
    title_name: 'Title',
    chapter_id: 'ch1',
    chapter_number: '1',
    chapter_title: 'One',
    language: 'th',
    translator_uid: 'u1',
    translator_name: 'TL',
    status: 'published',
    pages,
    price_coins: 0,
    quality_score: 1,
    is_default: true,
    description: null,
    created_at: null,
    updated_at: null,
  };
}

/** Thenable query chain: every builder method returns itself; awaiting it
 *  yields { data, error } — mirrors the supabase-js fluent API. */
function fakeDb(data: unknown[]) {
  const chain: any = {};
  for (const m of ['from', 'select', 'eq', 'order', 'is', 'in']) chain[m] = jest.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error: null });
  return { client: chain } as unknown as SupabaseService;
}

function fakeStorage(filesByDir: Record<string, string[]>, isRemote = false) {
  return {
    isRemote,
    put: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    deleteDir: jest.fn(),
    exists: jest.fn().mockResolvedValue(true),
    // Mirrors DiskStorageProvider.list = readdir: one level, basenames; throws on missing dir
    list: jest.fn().mockImplementation((dir: string) => {
      const names = filesByDir[dir];
      if (!names) return Promise.reject(new Error('ENOENT'));
      return Promise.resolve(names);
    }),
  } as unknown as StorageProvider & { list: jest.Mock; exists: jest.Mock };
}

const pageUrl = (ver: string, n: number) => `/uploads/chapters/${ver}/page-${n}.png`;

describe('VersionsService — backendAvailable via one list() per version (#149)', () => {
  it('checks all pages with a single storage.list call — never per-page exists()', async () => {
    const storage = fakeStorage({ 'uploads/chapters/v1': ['page-1.png', 'page-2.png', 'page-3.png'] });
    const svc = new VersionsService(fakeDb([row('v1', [1, 2, 3].map((n) => pageUrl('v1', n)))]) , storage);

    const versions = await svc.listVersionsByChapter('ch1');

    expect(versions[0].backendAvailable).toBe(true);
    expect(storage.list).toHaveBeenCalledTimes(1);
    expect(storage.list).toHaveBeenCalledWith('uploads/chapters/v1');
    expect(storage.exists).not.toHaveBeenCalled();
  });

  it('a missing page file makes the version unavailable', async () => {
    const storage = fakeStorage({ 'uploads/chapters/v1': ['page-1.png'] }); // page-2 missing
    const svc = new VersionsService(fakeDb([row('v1', [1, 2].map((n) => pageUrl('v1', n)))]), storage);

    const versions = await svc.listVersionsByChapter('ch1');

    expect(versions[0].backendAvailable).toBe(false);
  });

  it('a version whose directory does not exist is unavailable, not an exception', async () => {
    const storage = fakeStorage({}); // list() rejects for any dir
    const svc = new VersionsService(fakeDb([row('v1', [pageUrl('v1', 1)])]), storage);

    const versions = await svc.listVersionsByChapter('ch1');

    expect(versions[0].backendAvailable).toBe(false);
  });

  it('non-local page URLs (future R2 flow) are treated as available without touching storage', async () => {
    const storage = fakeStorage({});
    const svc = new VersionsService(
      fakeDb([row('v1', ['https://cdn.example.com/r2/page-1.png'])]),
      storage,
    );

    const versions = await svc.listVersionsByChapter('ch1');

    expect(versions[0].backendAvailable).toBe(true);
    expect(storage.list).not.toHaveBeenCalled();
  });

  it('a version with no pages is available', async () => {
    const storage = fakeStorage({});
    const svc = new VersionsService(fakeDb([row('v1', [])]), storage);

    const versions = await svc.listVersionsByChapter('ch1');

    expect(versions[0].backendAvailable).toBe(true);
    expect(storage.list).not.toHaveBeenCalled();
  });
});

describe('VersionsService — backendAvailable short-circuits on remote storage (FR-6)', () => {
  it('remote provider (isRemote: true): backendAvailable is true and storage.list is never called', async () => {
    // With remote/R2 storage, files are globally available — the local-presence
    // check is pointless and would cost ~100ms per network round-trip.
    const storage = fakeStorage({ 'uploads/chapters/v1': ['page-1.png'] }, true);
    const svc = new VersionsService(
      fakeDb([row('v1', [pageUrl('v1', 1)])]),
      storage,
    );

    const versions = await svc.listVersionsByChapter('ch1');

    expect(versions[0].backendAvailable).toBe(true);
    expect(storage.list).not.toHaveBeenCalled();
  });

  it('local provider (isRemote: false): storage.list IS called and result determines availability', async () => {
    const storage = fakeStorage({ 'uploads/chapters/v1': ['page-1.png'] }, false);
    const svc = new VersionsService(
      fakeDb([row('v1', [pageUrl('v1', 1)])]),
      storage,
    );

    const versions = await svc.listVersionsByChapter('ch1');

    expect(versions[0].backendAvailable).toBe(true);
    expect(storage.list).toHaveBeenCalledTimes(1);
    expect(storage.list).toHaveBeenCalledWith('uploads/chapters/v1');
  });
});
