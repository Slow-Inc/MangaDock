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
import { isServablePatchKey } from './patch-store';

/**
 * Serves patch PNGs via StorageProvider at `/r2-patches/{key}`. PatchStore itself now returns `{origin}/uploads/...`
 * URLs, so this route is kept only for anything (e.g. a deployed Worker) still addressing patches this way. It is
 * public, so it serves keys in the patch store's layout and nothing else (#1009).
 */
@Controller('r2-patches')
export class PatchesController {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  @Get('*')
  async serve(@Req() req: Request, @Res() res: Response): Promise<void> {
    const r2Key = req.path.replace(/^\/r2-patches\//, '');
    // Public route: serve patches and nothing else the storage provider can read (#1009)
    if (!r2Key || r2Key === req.path || !isServablePatchKey(r2Key)) {
      throw new NotFoundException();
    }
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
