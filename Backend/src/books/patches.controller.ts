import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { STORAGE_PROVIDER } from '../common/storage/storage-provider.interface';
import type { StorageProvider } from '../common/storage/storage-provider.interface';

/**
 * Serves R2-stored patch PNGs via StorageProvider.
 * Only reachable when Worker routing is active (WORKER_URL set) — patch URLs
 * are constructed as `{backendOrigin}/r2-patches/{r2Key}` in that path.
 * Disk mode continues to serve patches via express.static (/uploads/).
 */
@Controller('r2-patches')
export class PatchesController {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  @Get('*')
  async serve(@Req() req: Request, @Res() res: Response): Promise<void> {
    const r2Key = req.path.replace(/^\/r2-patches\//, '');
    if (!r2Key || r2Key === req.path) throw new NotFoundException();
    try {
      const buf = await this.storage.get(r2Key);
      res.setHeader('content-type', 'image/png');
      res.setHeader('cache-control', 'public, max-age=31536000, immutable');
      res.send(buf);
    } catch {
      throw new NotFoundException(`patch not found: ${r2Key}`);
    }
  }
}
