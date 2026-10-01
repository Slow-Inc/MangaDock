import {
  Controller,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as path from 'path';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import type { StorageProvider } from './storage-provider.interface';
import { ImageTokenGuard } from '../../books/image-token.guard';

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

/**
 * Serves all /img-cache/** assets via StorageProvider so both disk and R2
 * modes use the same URL scheme. Replaces express.static for img-cache/.
 */
@Controller('img-cache')
export class ImgCacheController {
  private readonly logger = new Logger(ImgCacheController.name);

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  @UseGuards(ImageTokenGuard)
  @Get('*')
  async serve(@Req() req: Request, @Res() res: Response): Promise<void> {
    const filePath = req.path.replace(/^\/img-cache\//, '');
    if (!filePath || filePath === req.path) throw new NotFoundException();
    const key = `img-cache/${filePath}`;
    const imgCacheRoot = path.resolve(process.cwd(), 'img-cache');
    const resolved = path.resolve(process.cwd(), key);
    if (
      resolved !== imgCacheRoot &&
      !resolved.startsWith(imgCacheRoot + path.sep)
    ) {
      throw new NotFoundException();
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream';
    try {
      if (this.storage.getStream) {
        const stream = await this.storage.getStream(key);
        res.setHeader('content-type', contentType);
        res.setHeader(
          'cache-control',
          'public, max-age=3600, stale-while-revalidate=86400',
        );
        stream.on('error', (err) => {
          this.logger.error(
            `img-cache stream failed mid-download for ${key}`,
            err instanceof Error ? err.stack : String(err),
          );
          if (res.headersSent) res.destroy();
          else res.status(500).end();
        });
        res.on('close', () => stream.destroy());
        stream.pipe(res);
        return;
      }
      const buf = await this.storage.get(key);
      res.setHeader('content-type', contentType);
      res.setHeader(
        'cache-control',
        'public, max-age=3600, stale-while-revalidate=86400',
      );
      res.send(buf);
    } catch {
      throw new NotFoundException(`not found: ${key}`);
    }
  }
}
