import { fileTypeFromBuffer } from 'file-type';
import { ALLOWED_IMAGE_MIME, extForMime } from './image-mime';

/**
 * The image type of an in-memory upload, read from its MAGIC BYTES (never the client's Content-Type
 * or file name), or null when it is not an allowed image. The buffer counterpart of saveValidatedImage.
 */
export async function detectAllowedImage(
  buffer: Buffer,
): Promise<{ mime: string; ext: string } | null> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_IMAGE_MIME.has(detected.mime)) return null;
  return { mime: detected.mime, ext: extForMime(detected.mime)! };
}
