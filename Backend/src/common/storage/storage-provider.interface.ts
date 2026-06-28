import { Readable } from 'stream';

export interface StorageProvider {
  /**
   * True when the storage backend is remote/shared (e.g. Cloudflare R2).
   * Remote storage makes files globally available — per-node presence checks
   * are meaningless and would cost a network round-trip per call.
   */
  readonly isRemote: boolean;

  /**
   * Save a file to the storage.
   * @param key The path/name of the file.
   * @param data The content to save.
   * @param options Metadata like contentType.
   */
  put(
    key: string,
    data: Buffer | string | Readable,
    options?: { contentType?: string },
  ): Promise<void>;

  /**
   * Retrieve a file from storage.
   */
  get(key: string): Promise<Buffer>;

  /**
   * Delete a file from storage.
   */
  delete(key: string): Promise<void>;

  /**
   * Delete a directory or prefix (recursively).
   */
  deleteDir(prefix: string): Promise<void>;

  /**
   * Check if a file exists.
   */
  exists(key: string): Promise<boolean>;

  /**
   * List files in storage with a given prefix.
   */
  list(prefix: string): Promise<string[]>;

  /**
   * Ensure a directory/prefix exists (mainly for disk storage).
   */
  ensureDir?(path: string): Promise<void>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
