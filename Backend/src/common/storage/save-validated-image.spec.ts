import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import {
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { fileTypeFromFile } from 'file-type';
import { saveValidatedImage } from './save-validated-image';
import type { StorageProvider } from './storage-provider.interface';

const mockFileType = fileTypeFromFile as jest.Mock;

function makeStorage(
  overrides: Partial<StorageProvider> = {},
): StorageProvider {
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
    tempFilePath = path.join(
      os.tmpdir(),
      `save-validated-image-${Date.now()}-${Math.random()}.tmp`,
    );
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

    const result = await saveValidatedImage(
      storage,
      tempFilePath,
      'uploads/covers',
    );

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
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const storage = makeStorage({
      put: jest.fn().mockRejectedValue(new Error('disk full')),
    });

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
      saveValidatedImage(storage, tempFilePath, 'uploads', {
        rejectMessage: 'nope',
      }),
    ).rejects.toThrow('nope');
  });

  it('uses opts.storageErrorMessage to override the default InternalServerErrorException message', async () => {
    mockFileType.mockResolvedValueOnce({ mime: 'image/gif', ext: 'gif' });
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const storage = makeStorage({
      put: jest.fn().mockRejectedValue(new Error('boom')),
    });

    await expect(
      saveValidatedImage(storage, tempFilePath, 'uploads', {
        storageErrorMessage: 'custom failure',
      }),
    ).rejects.toThrow('custom failure');

    errorSpy.mockRestore();
  });

  it('throws a plain Error (not InternalServerErrorException) when storageErrorAsPlainError is true, and still deletes the temp file', async () => {
    mockFileType.mockResolvedValueOnce({ mime: 'image/png', ext: 'png' });
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const storage = makeStorage({
      put: jest.fn().mockRejectedValue(new Error('disk full')),
    });

    let caught: unknown;
    try {
      await saveValidatedImage(storage, tempFilePath, 'uploads', {
        storageErrorAsPlainError: true,
        storageErrorMessage: 'boom',
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).not.toBeInstanceOf(InternalServerErrorException);
    expect((caught as Error).constructor).toBe(Error);
    expect((caught as Error).message).toBe('boom');
    expect(fs.existsSync(tempFilePath)).toBe(false);

    errorSpy.mockRestore();
  });

  it('guards the orphaned read stream when storage.put throws synchronously without consuming it (missing temp path never crashes the process)', async () => {
    mockFileType.mockResolvedValueOnce({ mime: 'image/png', ext: 'png' });
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    // storage.put throws BEFORE consuming its stream argument, simulating a provider
    // that never attaches its own error handler to the (now orphaned) ReadStream.
    const storage = makeStorage({
      put: jest.fn(() => {
        throw new Error('no put');
      }),
    });
    // Non-existent path: fs.createReadStream(...) will asynchronously emit ENOENT
    // on the orphaned stream. Without the guard this is an unhandled 'error' event
    // that crashes the test process.
    const missingPath = path.join(
      os.tmpdir(),
      `save-validated-image-missing-${Date.now()}-${Math.random()}.tmp`,
    );

    await expect(
      saveValidatedImage(storage, missingPath, 'uploads'),
    ).rejects.toThrow(InternalServerErrorException);

    // Give the orphaned stream's async 'error' event a chance to fire; the guard
    // must have swallowed it (no unhandled error crashes this test run).
    await new Promise((resolve) => setImmediate(resolve));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
