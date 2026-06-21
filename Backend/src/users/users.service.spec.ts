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
