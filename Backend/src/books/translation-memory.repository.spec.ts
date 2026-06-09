import { TranslationMemoryRepository } from './translation-memory.repository';

/**
 * Translation memory persistence (#160, PRD #155 P3).
 *
 * Server-only Supabase tables behind a best-effort repository: every call is
 * try/caught so a persistence failure is logged and never fails the
 * translation (local-first). Human-edited glossaries are never auto-overwritten.
 */
type UpsertCall = { table: string; row: any; opts: any };

function fakeSupabase(opts?: { glossarySource?: string | null; upsertError?: string }) {
  const calls: { upserts: UpsertCall[] } = { upserts: [] };
  const client = {
    from(table: string) {
      return {
        upsert: (row: any, o: any) => {
          calls.upserts.push({ table, row, opts: o });
          return Promise.resolve({ error: opts?.upsertError ? { message: opts.upsertError } : null });
        },
        select: () => {
          const chain: any = {
            eq: () => chain,
            maybeSingle: () =>
              Promise.resolve({ data: opts?.glossarySource !== undefined ? { source: opts.glossarySource } : null, error: null }),
          };
          return chain;
        },
      };
    },
  };
  return { service: { client } as any, calls };
}

describe('TranslationMemoryRepository', () => {
  it('upserts a page text layer into chapter_page_texts on the page key', async () => {
    const { service, calls } = fakeSupabase();
    const repo = new TranslationMemoryRepository(service);

    const ok = await repo.savePageText('ch1', 3, 'THA',
      [{ src: 'Hello', dst: 'สวัสดี' }], 'default');

    expect(ok).toBe(true);
    expect(calls.upserts).toHaveLength(1);
    expect(calls.upserts[0].table).toBe('chapter_page_texts');
    expect(calls.upserts[0].row).toMatchObject({
      chapter_id: 'ch1', page_index: 3, target_lang: 'THA',
      regions: [{ src: 'Hello', dst: 'สวัสดี' }], model: 'default',
    });
    expect(calls.upserts[0].opts.onConflict).toBe('chapter_id,page_index,target_lang');
  });

  it('returns false and never throws when the upsert errors (local-first)', async () => {
    const { service } = fakeSupabase({ upsertError: 'connection refused' });
    const repo = new TranslationMemoryRepository(service);

    await expect(
      repo.savePageText('ch1', 0, 'THA', [{ src: 'a', dst: 'ก' }]),
    ).resolves.toBe(false);
  });

  it('skips an auto glossary write when the stored row is human-edited', async () => {
    const { service, calls } = fakeSupabase({ glossarySource: 'edited' });
    const repo = new TranslationMemoryRepository(service);

    const ok = await repo.upsertGlossary('manga1', 'THA', { Vesta: 'เวสตา' }, 'auto');

    expect(ok).toBe(false);
    expect(calls.upserts).toHaveLength(0); // protected — no overwrite
  });

  it('writes an auto glossary when no edited row exists', async () => {
    const { service, calls } = fakeSupabase({ glossarySource: null });
    const repo = new TranslationMemoryRepository(service);

    const ok = await repo.upsertGlossary('manga1', 'THA', { Vesta: 'เวสตา' }, 'auto');

    expect(ok).toBe(true);
    expect(calls.upserts).toHaveLength(1);
    expect(calls.upserts[0].table).toBe('manga_glossaries');
    expect(calls.upserts[0].row).toMatchObject({ manga_id: 'manga1', target_lang: 'THA', source: 'auto' });
  });

  it('an explicit edited glossary always writes (human override)', async () => {
    const { service, calls } = fakeSupabase({ glossarySource: 'edited' });
    const repo = new TranslationMemoryRepository(service);

    const ok = await repo.upsertGlossary('manga1', 'THA', { Vesta: 'เวสต้า' }, 'edited');

    expect(ok).toBe(true);
    expect(calls.upserts[0].row.source).toBe('edited');
  });
});
