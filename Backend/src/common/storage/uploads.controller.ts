import { Controller, Get, Inject, Logger, NotFoundException, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as path from 'path';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import type { StorageProvider } from './storage-provider.interface';

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.json': 'application/json',
};

/**
 * Serves all /uploads/** assets via StorageProvider so both disk and R2 modes
 * use the same URL scheme. Replaces express.static for the uploads/ directory.
 */
@Controller('uploads')
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  @Get('*')
  async serve(@Req() req: Request, @Res() res: Response): Promise<void> {
    const filePath = req.path.replace(/^\/uploads\//, '');
    if (!filePath || filePath === req.path) throw new NotFoundException();
    const key = `uploads/${filePath}`;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream';
    try {
      // Prefer streaming (remote R2) so a large object is piped straight to the
      // response instead of being buffered whole in memory. getStream checks the
      // upstream status before returning, so a missing key throws here — before
      // any bytes are written — and still surfaces as a 404.
      if (this.storage.getStream) {
        const stream = await this.storage.getStream(key);
        res.setHeader('content-type', contentType);
        res.setHeader('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
        // getStream's pre-check only guards the initial response status, so a
        // missing key already threw above. But the R2/undici body can still
        // error MID-download (worker connection drops after a 200); that emits
        // 'error' AFTER pipe() — outside this try/catch. Without a listener Node
        // throws it as unhandled and can crash the process, so handle it here.
        stream.on('error', (err) => {
          this.logger.error(`uploads stream failed mid-download for ${key}`, err instanceof Error ? err.stack : String(err));
          // Headers may already be flushed once bytes flow — we can't change the
          // status then, only tear the response down (destroy() with no error so
          // we don't re-emit onto the response socket; we've already logged). If
          // nothing was sent yet, surface a clean 500.
          if (res.headersSent) res.destroy();
          else res.status(500).end();
        });
        // Client aborted/closed early — stop pulling from the undici stream so
        // it doesn't leak the underlying connection.
        res.on('close', () => stream.destroy());
        stream.pipe(res);
        return;
      }
      const buf = await this.storage.get(key);
      res.setHeader('content-type', contentType);
      res.setHeader('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.send(buf);
    } catch {
      throw new NotFoundException(`not found: ${key}`);
    }
  }
}
