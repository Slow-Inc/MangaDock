import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class DiskStorageProvider implements StorageProvider {
  private readonly logger = new Logger(DiskStorageProvider.name);
  private readonly rootDir = process.cwd();

  private getAbsPath(key: string): string {
    // If it's already an absolute path and within rootDir, use it.
    // Otherwise, join with rootDir.
    return path.isAbsolute(key) ? key : path.join(this.rootDir, key);
  }

  async put(
    key: string,
    data: Buffer | string | Readable,
    options?: { contentType?: string },
  ): Promise<void> {
    const absPath = this.getAbsPath(key);
    const dir = path.dirname(absPath);

    // mkdir is idempotent with recursive:true — no need for a separate existsSync.
    await fsp.mkdir(dir, { recursive: true });

    if (data instanceof Readable) {
      const writeStream = fs.createWriteStream(absPath);
      return new Promise((resolve, reject) => {
        data.pipe(writeStream);
        data.on('error', reject);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }

    await fsp.writeFile(absPath, data);
  }

  async get(key: string): Promise<Buffer> {
    const absPath = this.getAbsPath(key);
    return fsp.readFile(absPath);
  }

  async delete(key: string): Promise<void> {
    const absPath = this.getAbsPath(key);
    // force:true makes this a no-op when the file is absent (no throw).
    await fsp.rm(absPath, { force: true });
  }

  async deleteDir(prefix: string): Promise<void> {
    const absPath = this.getAbsPath(prefix);
    await fsp.rm(absPath, { recursive: true, force: true });
  }

  async exists(key: string): Promise<boolean> {
    const absPath = this.getAbsPath(key);
    try {
      await fsp.access(absPath);
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const absPath = this.getAbsPath(prefix);
    try {
      return await fsp.readdir(absPath);
    } catch {
      return [];
    }
  }

  async ensureDir(dirPath: string): Promise<void> {
    const absPath = this.getAbsPath(dirPath);
    await fsp.mkdir(absPath, { recursive: true });
  }
}
