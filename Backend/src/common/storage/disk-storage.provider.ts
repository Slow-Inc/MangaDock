import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
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

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (data instanceof Readable) {
      const writeStream = fs.createWriteStream(absPath);
      return new Promise((resolve, reject) => {
        data.pipe(writeStream);
        data.on('error', reject);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }

    fs.writeFileSync(absPath, data);
  }

  async get(key: string): Promise<Buffer> {
    const absPath = this.getAbsPath(key);
    return fs.readFileSync(absPath);
  }

  async delete(key: string): Promise<void> {
    const absPath = this.getAbsPath(key);
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
  }

  async deleteDir(prefix: string): Promise<void> {
    const absPath = this.getAbsPath(prefix);
    if (fs.existsSync(absPath)) {
      fs.rmSync(absPath, { recursive: true, force: true });
    }
  }

  async exists(key: string): Promise<boolean> {
    const absPath = this.getAbsPath(key);
    return fs.existsSync(absPath);
  }

  async list(prefix: string): Promise<string[]> {
    const absPath = this.getAbsPath(prefix);
    if (!fs.existsSync(absPath)) return [];
    try {
      return fs.readdirSync(absPath);
    } catch {
      return [];
    }
  }

  async ensureDir(dirPath: string): Promise<void> {
    const absPath = this.getAbsPath(dirPath);
    if (!fs.existsSync(absPath)) {
      fs.mkdirSync(absPath, { recursive: true });
    }
  }
}
