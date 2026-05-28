import { Body, Controller, Get, HttpException, HttpStatus, NotFoundException, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BooksService } from './books.service';
import { StatsIncrementService } from '../cache/stats-increment.service';
import { TurnstileGuard, generateClearanceToken } from '../auth/turnstile.guard';

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
    const secretKey = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';
    const hwid = req.headers['x-hardware-id'] as string;

    if (!hwid) {
      throw new HttpException('Hardware ID is required', HttpStatus.BAD_REQUEST);
    }
    
    // Ignore verification if disabled
    if (process.env.TURNSTILE_ENABLED === 'false') {
      return { clearanceToken: generateClearanceToken(secretKey, hwid) };
    }

    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', body.token);

    try {
      const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
      });
      const outcome = await result.json();

      if (outcome.success) {
        return { clearanceToken: generateClearanceToken(secretKey, hwid) };
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
    const result = await this.booksService.getMangaChapterPages(chapterId, forceLocal === 'true');
    if (!result) throw new NotFoundException('Chapter pages not found');
    const uid = (req?.headers?.['x-hardware-id'] as string) || 'anon';
    const date = new Date().toISOString().slice(0, 10);
    void this.statsIncrement.recordChapterView(chapterId, mangaId ?? '', uid, date);
    return result;
  }

  @Get('translate')
  translateDescription(@Query('text') text: string) {
    return this.booksService.translateDescription(text ?? '');
  }

  @Post('translate/manga')
  translateMangaEpisode(
    @Body()
    body: {
      lines?: string[];
      contextHint?: string;
      chapterId?: string;
      page?: number;
      model?: 'gemini-2.5-flash' | 'gemini-2.5-flash-lite';
    },
  ) {
    return this.booksService.translateMangaEpisode(body ?? {});
  }

  @Get('translate/mit-health')
  checkMitHealth() {
    return this.booksService.checkMitHealth();
  }

  @Post('chapters/:chapterId/pages/:pageIndex/translate')
  async translateMangaPage(
    @Param('chapterId') chapterId: string,
    @Param('pageIndex') pageIndex: string,
    @Body() body: { pageUrl?: string },
  ) {
    try {
      return await this.booksService.translateMangaPage(
        chapterId,
        parseInt(pageIndex, 10),
        body?.pageUrl ?? '',
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(
        { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('chapters/:chapterId/pages/:pageIndex/translate-patches')
  async translateMangaPagePatches(
    @Param('chapterId') chapterId: string,
    @Param('pageIndex') pageIndex: string,
    @Body() body: { pageUrl?: string; sourceLang?: string; targetLang?: string },
  ) {
    try {
      return await this.booksService.translateMangaPagePatches(
        chapterId,
        parseInt(pageIndex, 10),
        body?.pageUrl ?? '',
        body?.sourceLang,
        body?.targetLang,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(
        { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message },
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
  @Post('chapters/:chapterId/batch-translate-patches')
  async batchTranslateMangaPatches(
    @Param('chapterId') chapterId: string,
    @Body() body: { pages?: Array<{ pageIndex: number; pageUrl: string }>; sourceLang?: string; targetLang?: string },
    @Res() res: import('express').Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const { sourceLang, targetLang } = body ?? {};

    const listener = (pageIndex: number, result: { patches: unknown[]; error?: string }) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ pageIndex, patches: result.patches, error: result.error ?? null })}\n\n`);
      }
    };

    // Remove listener on client disconnect — job continues in background
    res.on('close', () => {
      this.booksService.removeBatchListener(chapterId, sourceLang, targetLang, listener);
    });

    try {
      await this.booksService.startOrAttachBatchJob(chapterId, body?.pages ?? [], listener, sourceLang, targetLang);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: message, pageIndex: -1, patches: [] })}\n\n`);
      }
    }

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
    if (!url || !/^https:\/\//.test(url)) {
      return res.status(400).send('Invalid URL');
    }
    try {
      const upstream = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MangaDock/1.0)',
          'Accept': 'image/webp,image/avif,image/*,*/*',
          // MangaDex CDN blocks requests whose Referer is not mangadex.org
          'Referer': 'https://mangadex.org/',
        },
      });
      const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const buf = await upstream.arrayBuffer();
      return res.send(Buffer.from(buf));
    } catch {
      return res.status(502).send('Bad Gateway');
    }
  }
}
