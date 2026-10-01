import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as crypto from 'crypto';
import { fileTypeFromFile } from 'file-type';
import { ALLOWED_IMAGE_MIME, extForMime } from './image-mime';
import type { StorageProvider } from './storage-provider.interface';

export interface SaveValidatedImageOptions {
  /** Message for the BadRequestException thrown when magic bytes are not an allowed image. */
  rejectMessage?: string;
  /** Message for the InternalServerErrorException thrown when storage.put fails. */
  storageErrorMessage?: string;
  /**
   * When true, a storage.put failure throws a plain `Error` (NestJS hides its
   * message → generic 500 body), matching upload.addPage's original behavior.
   * When false/omitted, throws InternalServerErrorException (message surfaced),
   * matching forum's original behavior.
   */
  storageErrorAsPlainError?: boolean;
}

/**
 * Validate an uploaded temp file by MAGIC BYTES (not the client Content-Type),
 * stream it to storage under `${keyPrefix}/<uuid><ext>`, and remove the temp file.
 * Single source of truth for the security-sensitive image-upload path.
 *
 * Bad/undetectable image  -> deletes temp, throws BadRequestException.
 * storage.put failure      -> logs, deletes temp, throws InternalServerErrorException.
 */
export async function saveValidatedImage(
  storage: StorageProvider,
  tempFilePath: string,
  keyPrefix: string,
  opts: SaveValidatedImageOptions = {},
): Promise<{ url: string; key: string }> {
  const detected = await fileTypeFromFile(tempFilePath);
  if (!detected || !ALLOWED_IMAGE_MIME.has(detected.mime)) {
    await fsp.rm(tempFilePath, { force: true });
    throw new BadRequestException(
      opts.rejectMessage ?? 'Only JPEG, PNG, WebP and GIF are allowed',
    );
  }

  const ext = extForMime(detected.mime)!;
  const key = `${keyPrefix}/${crypto.randomUUID()}${ext}`;

  // Create the stream up front and guard it: if storage.put throws before it
  // consumes the stream (or never consumes it), the orphaned ReadStream would
  // otherwise emit an unhandled 'error' (e.g. ENOENT) and crash the process.
  // Real read errors still reject storage.put() and are handled in the catch below.
  const fileStream = fs.createReadStream(tempFilePath);
  fileStream.on('error', () => {});

  try {
    await storage.put(key, fileStream, {
      contentType: detected.mime,
    });
    await fsp.rm(tempFilePath, { force: true });
  } catch (err) {
    new Logger('saveValidatedImage').error(
      `Image storage put failed for ${key}: ${String(err)}`,
    );
    await fsp.rm(tempFilePath, { force: true });
    const message = opts.storageErrorMessage ?? 'Failed to save image';
    throw opts.storageErrorAsPlainError
      ? new Error(message)
      : new InternalServerErrorException(message);
  }

  return { url: `/${key}`, key };
}
