import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { fetchProxiedImage, MAX_PROXY_BYTES } from './img-proxy.helper';
import type { Request, Response } from 'express';
import { BooksService } from './books.service';
import { StatsIncrementService } from '../cache/stats-increment.service';
import {
  TurnstileGuard,
  generateClearanceToken,
} from '../auth/turnstile.guard';
import { resolveTurnstileConfig } from '../auth/turnstile.config';

@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly statsIncrement: StatsIncrementService,
  ) {}

  @Post('verify-captcha')
  async verifyCaptcha(@Req() req: any, @Body() body: { token: string }) {
    if (!body.token) {
      throw new HttpException('Token is required', HttpStatus.BAD_REQUEST);
    }
    // Fail-closed config: production rejects a missing/test secret at boot (#224).
    const { enabled, secret } = resolveTurnstileConfig(process.env);
    const hwid = req.headers['x-hardware-id'] as string;

    if (!hwid) {
      throw new HttpException(
        'Hardware ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Skip verification only when disabled outside production.
    if (!enabled) {
      return { clearanceToken: generateClearanceToken(secret, hwid) };
    }

    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', body.token);

    try {
      const result = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body: formData,
        },
      );
      const outcome = await result.json();

      if (outcome.success) {
        return { clearanceToken: generateClearanceToken(secret, hwid) };
      }

      console.error('Turnstile verification failed:', outcome['error-codes']);
    } catch (e) {
      console.error('Turnstile API request failed:', e);
    }

    throw new HttpException('Invalid Captcha token', HttpStatus.UNAUTHORIZED);
  }

  @Get('landing')
  getLandingBooks(@Query('forceLocal') forceLocal?: string) {
    return this.booksService.getLandingBooks(forceLocal === 'true');
  }

  @Get('new-releases')
  getNewReleases(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tag') tag?: string,
  ) {
    return this.booksService.getNewReleases(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 35,
      tag,
    );
  }

  @Get('genre/:slug')
  getGenreManga(
    @Param('slug') slug: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.booksService.getGenreManga(
      slug,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 28,
    );
  }

  @Get('manga/:id')
  getMangaDetail(
    @Param('id') id: string,
    @Query('forceLocal') forceLocal?: string,
  ) {
    return this.booksService.getMangaDetail(id, forceLocal === 'true');
  }

  @Get('manga/:id/preview')
  getMangaPreview(@Param('id') id: string) {
    return this.booksService.getMangaPreview(id);
  }

  @Get('manga/:id/cover')
  async getMangaCover(@Param('id') id: string, @Res() res: Response) {
    try {
      const detail = await this.booksService.getMangaDetail(id, false);
      const cover = detail.covers[0]?.url;
      if (!cover) {
        return res.status(404).send('Cover not found');
      }
      // Pass directly to the internal proxy handling
      return this.proxyImage(cover, res);
    } catch {
      return res.status(404).send('Cover not found');
    }
  }

  @Get('manga/:id/chapters')
  getMangaChapters(
    @Param('id') id: string,
    @Query('forceLocal') forceLocal?: string,
  ) {
    return this.booksService.getMangaChapters(id, forceLocal === 'true');
  }

  @UseGuards(TurnstileGuard)
  @Get('chapters/:chapterId/pages')
  async getMangaChapterPages(
    @Param('chapterId') chapterId: string,
    @Query('mangaId') mangaId?: string,
    @Req() req?: Request,
    @Query('forceLocal') forceLocal?: string,
  ) {
    const result = await this.booksService.getMangaChapterPages(
      chapterId,
      forceLocal === 'true',
    );
    if (!result) throw new NotFoundException('Chapter pages not found');
    const uid = (req?.headers?.['x-hardware-id'] as string) || 'anon';
    const date = new Date().toISOString().slice(0, 10);
    void this.statsIncrement.recordChapterView(
      chapterId,
      mangaId ?? '',
      uid,
      date,
    );
    return result;
  }

  @Get('translate')
  translateDescription(@Query('text') text: string) {
    return this.booksService.translateDescription(text ?? '');
  }

  @UseGuards(TurnstileGuard)
  @Post('translate/manga')
  translateMangaEpisode(
    @Body()
    body: {
      lines?: string[];
      contextHint?: string;
      chapterId?: string;
      page?: number;
      model?: string;
      targetLang?: string;
    },
  ) {
    return this.booksService.translateMangaEpisode(body ?? {});
  }

  @Get('translate/mit-health')
  checkMitHealth() {
    return this.booksService.checkMitHealth();
  }

  /** Gemini model catalog + the translator MIT actually runs (#133, PRD #131).
   *  Unauthenticated, same posture as mit-health. */
  @Get('models')
  getModels() {
    return this.booksService.getMangaModelsInfo();
  }

  @UseGuards(TurnstileGuard)
  @Post('chapters/:chapterId/pages/:pageIndex/translate-patches')
  async translateMangaPagePatches(
    @Param('chapterId') chapterId: string,
    @Param('pageIndex') pageIndex: string,
    @Body()
    body: {
      pageUrl?: string;
      sourceLang?: string;
      targetLang?: string;
      imageModel?: string;
      derivative?: 'hd' | 'saver';
      mangaId?: string;
    },
  ) {
    try {
      return await this.booksService.translateMangaPagePatches(
        chapterId,
        parseInt(pageIndex, 10),
        body?.pageUrl ?? '',
        body?.sourceLang,
        body?.targetLang,
        {
          imageModel: body?.imageModel,
          derivative: body?.derivative === 'saver' ? 'saver' : 'hd',
          mangaId: body?.mangaId,
        },
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Log the real MIT/internal error server-side; return a generic message
      // so internal detail never leaks to the client (#226).
      console.error(
        `translate-patches failed (chapter ${chapterId} page ${pageIndex}):`,
        message,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Translation failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Batch-translate all pages of a chapter.
   * Accepts a JSON body `{ pages: [{pageIndex, pageUrl}, ...] }` where `pages`
   * is ordered by desired processing priority (e.g. current page first).
   *
   * Streams Server-Sent Events back to the client — one `data:` event per page:
   *   `data: {"pageIndex":N,"patches":[{xPct,yPct,wPct,hPct,url}],"error":null}`
   *
   * If the client disconnects mid-stream, the backend continues processing in the
   * background and caches each page result. A reconnecting client attaches to the
   * running job and receives already-completed pages immediately.
   */
  @UseGuards(TurnstileGuard)
  @Post('chapters/:chapterId/batch-translate-patches')
  async batchTranslateMangaPatches(
    @Param('chapterId') chapterId: string,
    @Body()
    body: {
      pages?: Array<{ pageIndex: number; pageUrl: string }>;
      sourceLang?: string;
      targetLang?: string;
      imageModel?: string;
      derivative?: 'hd' | 'saver';
      mangaId?: string;
    },
    @Res() res: import('express').Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Start the response body immediately with an SSE comment. This forces any
    // intermediary proxy (Cloudflare Tunnel) into streaming mode so it does not
    // apply a "time to first byte" timeout (HTTP 524) while MIT processes page 1.
    res.write(': connected\n\n');

    // Periodic heartbeat keeps the connection alive through long gaps between pages.
    // A single complex page (or cold model load) can take >100s; Cloudflare idle-
    // times-out at ~100s. SSE comment lines (leading ':') are ignored by the client
    // reader, which only parses lines starting with "data: ".
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': ping\n\n');
    }, 15_000);

    const { sourceLang, targetLang, imageModel } = body ?? {};
    const derivative = body?.derivative === 'saver' ? 'saver' : 'hd';

    const listener = (
      pageIndex: number,
      result: {
        patches: unknown[];
        error?: string;
        stage?: string;
        progress?: boolean;
      },
    ) => {
      if (res.writableEnded) return;
      if (result.progress) {
        // Live MIT stage update — informational event, distinct shape from
        // page completions so old clients (no `type` handling) skip it.
        res.write(
          `data: ${JSON.stringify({ type: 'progress', pageIndex, stage: result.stage })}\n\n`,
        );
        return;
      }
      res.write(
        `data: ${JSON.stringify({ pageIndex, patches: result.patches, error: result.error ?? null })}\n\n`,
      );
    };

    // Remove listener on client disconnect — job continues in background
    res.on('close', () => {
      clearInterval(heartbeat);
      this.booksService.removeBatchListener(
        chapterId,
        sourceLang,
        targetLang,
        listener,
        imageModel,
        derivative,
      );
    });

    try {
      await this.booksService.startOrAttachBatchJob(
        chapterId,
        body?.pages ?? [],
        listener,
        sourceLang,
        targetLang,
        imageModel,
        derivative,
        body?.mangaId,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Log the real error server-side; emit a generic error to the SSE client
      // so internal detail never leaks (#226).
      console.error(
        `batch-translate-patches failed (chapter ${chapterId}):`,
        message,
      );
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({ error: 'Translation failed', pageIndex: -1, patches: [] })}\n\n`,
        );
      }
    }

    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }

  @Get('search')
  searchBooks(
    @Query('q') query: string,
    @Query('lang') lang?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.booksService.searchBooks(
      query ?? '',
      lang,
      limit ? Math.min(parseInt(limit, 10), 100) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /** Proxy external images (e.g. MangaDex CDN) to avoid hotlink blocking. */
  @Get('img-proxy')
  async proxyImage(@Query('url') url: string, @Res() res: Response) {
    const result = await fetchProxiedImage(url);
    if (!result.ok) return res.status(result.httpStatus).send(result.message);

    const headers: Record<string, string | number> = {
      'Content-Type': result.contentType,
      // MangaDex URLs are content-addressed (hash in path) — safe to cache 1 year
      'Cache-Control': 'public, max-age=31536000, immutable',
    };
    if (result.contentLength !== null)
      headers['Content-Length'] = result.contentLength;
    res.writeHead(result.httpStatus, headers);

    // Stream bytes directly — never buffer the whole image into RAM
    const reader = result.body.getReader();
    let received = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_PROXY_BYTES) {
          // Headers already sent; abort connection to signal incomplete response
          reader.cancel().catch(() => {});
          res.destroy();
          return;
        }
        res.write(Buffer.from(value));
      }
      res.end();
    } catch {
      res.destroy();
    }
  }
}
