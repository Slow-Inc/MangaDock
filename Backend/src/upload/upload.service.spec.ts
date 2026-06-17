import { BadRequestException } from '@nestjs/common';
import { fileTypeFromFile } from 'file-type';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { UploadService } from './upload.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { VersionsService } from '../versions/versions.service';
import type { StorageProvider } from '../common/storage/storage-provider.interface';

// file-type is mocked globally (src/__mocks__/file-type.js via moduleNameMapper).
// Each test sets what the magic-byte detector "sees", independent of the client mime.
const mockFileType = fileTypeFromFile as jest.Mock;

// Supabase query chain for addPage's append path. The read does
// .select().eq().maybeSingle(); the write awaits .update()...select() directly,
// so the chain is thenable and resolves one applied row (the loop then returns).
type Chain = {
  select: jest.Mock;
  eq: jest.Mock;
  update: jest.Mock;
  maybeSingle: jest.Mock;
  then: (resolve: (v: { data: unknown; error: null }) => void) => void;
};

function makeService(overrides: { put?: jest.Mock } = {}) {
  const storage = {
    put: overrides.put ?? jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const chain = {} as Chain;
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.maybeSingle = jest.fn().mockResolvedValue({
    data: {
      translator_uid: 'owner',
      status: 'draft',
      pages: [],
      updated_at: null,
    },
    error: null,
  });
  chain.then = (resolve) =>
    resolve({ data: [{ version_id: 'v1' }], error: null });

  const supabase = {
    client: { from: jest.fn().mockReturnValue(chain) },
  } as unknown as SupabaseService;

  const service = new UploadService(
    supabase,
    {} as VersionsService,
    storage as unknown as StorageProvider,
  );
  return { service, storage };
}

/** Write a real temp file with the given bytes and return its path. */
function writeTempFile(bytes: Buffer): string {
  const p = path.join(os.tmpdir(), `uploadspec_${crypto.randomUUID()}`);
  fs.writeFileSync(p, bytes);
  return p;
}

describe('UploadService.addPage - magic-byte MIME validation (#303)', () => {
  afterEach(() => {
    mockFileType.mockReset();
  });

  it('rejects a disguised file: magic bytes are not an image even though the client mime says image/png', async () => {
    const { service, storage } = makeService();
    // Attacker sends <script> with Content-Type: image/png. Magic bytes -> text/html.
    mockFileType.mockResolvedValueOnce({ mime: 'text/html', ext: 'html' });

    await expect(
      service.addPage('v1', 'owner', '/tmp/does-not-matter'),
    ).rejects.toThrow(BadRequestException);
    // The disguised payload never reaches storage.
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('rejects an empty/truncated/undetectable file (fileTypeFromFile -> undefined)', async () => {
    const { service, storage } = makeService();
    mockFileType.mockResolvedValueOnce(undefined);

    await expect(
      service.addPage('v1', 'owner', '/tmp/does-not-matter'),
    ).rejects.toThrow(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('deletes the temp file on a rejected (non-image) upload', async () => {
    const { service } = makeService();
    const tmp = writeTempFile(Buffer.from('<script>alert(1)</script>'));
    mockFileType.mockResolvedValueOnce({ mime: 'text/html', ext: 'html' });

    await expect(service.addPage('v1', 'owner', tmp)).rejects.toThrow(
      BadRequestException,
    );
    expect(fs.existsSync(tmp)).toBe(false);
  });

  it.each([['image/jpeg'], ['image/png'], ['image/webp'], ['image/gif']])(
    'accepts a genuine %s (passes the magic-byte gate -> reaches storage)',
    async (mime) => {
      const put = jest.fn().mockResolvedValue(undefined);
      const { service, storage } = makeService({ put });
      const tmp = writeTempFile(Buffer.from([0x01, 0x02, 0x03]));
      mockFileType.mockResolvedValueOnce({ mime, ext: mime.split('/')[1] });

      const result = await service.addPage('v1', 'owner', tmp);

      expect(storage.put).toHaveBeenCalledTimes(1);
      expect(typeof result.pageUrl).toBe('string');
      expect(result.pageIndex).toBe(0);
    },
  );

  it('derives the stored extension from the DETECTED mime, not the client-supplied one', async () => {
    const put = jest.fn().mockResolvedValue(undefined);
    const { service } = makeService({ put });
    const tmp = writeTempFile(Buffer.from([0x01, 0x02, 0x03]));
    // Client lies (image/png) but the bytes are really WebP.
    mockFileType.mockResolvedValueOnce({ mime: 'image/webp', ext: 'webp' });

    const { pageUrl } = await service.addPage('v1', 'owner', tmp);

    expect(pageUrl).toMatch(/\.webp$/);
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/\.webp$/),
      expect.anything(),
      {
        contentType: 'image/webp',
      },
    );
  });
});
