import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { fileTypeFromFile } from 'file-type';
import { saveValidatedImage } from './save-validated-image';
import type { StorageProvider } from './storage-provider.interface';

const mockFileType = fileTypeFromFile as jest.Mock;

function makeStorage(overrides: Partial<StorageProvider> = {}): StorageProvider {
  return {
    isRemote: false,
    put: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    delete: jest.fn(),
    deleteDir: jest.fn(),
    exists: jest.fn(),
    list: jest.fn(),
    ...overrides,
  };
}

describe('saveValidatedImage', () => {
  let tempFilePath: string;

  beforeEach(() => {
    tempFilePath = path.join(os.tmpdir(), `save-validated-image-${Date.now()}-${Math.random()}.tmp`);
    fs.writeFileSync(tempFilePath, 'fake-image-bytes');
    mockFileType.mockReset();
  });

  afterEach(() => {
    if (fs.existsSync(tempFilePath)) fs.rmSync(tempFilePath, { force: true });
  });

  it('rejects a disguised/disallowed mime and deletes the temp file without calling storage.put', async () => {
    mockFileType.mockResolvedValueOnce({ mime: 'text/html', ext: 'html' });
    const storage = makeStorage();

    await expect(
      saveValidatedImage(storage, tempFilePath, 'uploads'),
    ).rejects.toThrow(BadRequestException);

    expect(fs.existsSync(tempFilePath)).toBe(false);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('rejects an undetectable file and deletes the temp file without calling storage.put', async () => {
    mockFileType.mockResolvedValueOnce(undefined);
    const storage = makeStorage();

    await expect(
      saveValidatedImage(storage, tempFilePath, 'uploads'),
    ).rejects.toThrow(BadRequestException);

    expect(fs.existsSync(tempFilePath)).toBe(false);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('streams to storage under keyPrefix/<uuid>.<ext derived from detected mime> and deletes the temp file on success', async () => {
    // Hint says jpg but the DETECTED mime is webp — the ext must come from the detected mime.
    mockFileType.mockResolvedValueOnce({ mime: 'image/webp', ext: 'jpg' });
    const storage = makeStorage();

    const result = await saveValidatedImage(storage, tempFilePath, 'uploads/covers');

    expect(storage.put).toHaveBeenCalledTimes(1);
    const [key, data, options] = (storage.put as jest.Mock).mock.calls[0];
    expect(key).toMatch(/^uploads\/covers\/[0-9a-f-]{36}\.webp$/);
    expect(data).toEqual(expect.any(Readable));
    expect(options).toEqual({ contentType: 'image/webp' });

    expect(result.key).toBe(key);
    expect(result.url).toBe(`/${key}`);
    expect(fs.existsSync(tempFilePath)).toBe(false);
  });

  it('throws InternalServerErrorException, logs, and deletes the temp file when storage.put rejects', async () => {
    mockFileType.mockResolvedValueOnce({ mime: 'image/png', ext: 'png' });
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const storage = makeStorage({ put: jest.fn().mockRejectedValue(new Error('disk full')) });

    await expect(
      saveValidatedImage(storage, tempFilePath, 'uploads'),
    ).rejects.toThrow(InternalServerErrorException);

    expect(fs.existsSync(tempFilePath)).toBe(false);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('uses opts.rejectMessage to override the default BadRequestException message', async () => {
    mockFileType.mockResolvedValueOnce({ mime: 'text/html', ext: 'html' });
    const storage = makeStorage();

    await expect(
      saveValidatedImage(storage, tempFilePath, 'uploads', { rejectMessage: 'nope' }),
    ).rejects.toThrow('nope');
  });

  it('uses opts.storageErrorMessage to override the default InternalServerErrorException message', async () => {
    mockFileType.mockResolvedValueOnce({ mime: 'image/gif', ext: 'gif' });
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const storage = makeStorage({ put: jest.fn().mockRejectedValue(new Error('boom')) });

    await expect(
      saveValidatedImage(storage, tempFilePath, 'uploads', { storageErrorMessage: 'custom failure' }),
    ).rejects.toThrow('custom failure');

    errorSpy.mockRestore();
  });
});
