import { Injectable, Logger } from '@nestjs/common';
import type { LandingBook } from './books.types';

type GoogleBooksResponse = {
  items?: Array<{
    id?: string;
    volumeInfo?: {
      title?: string;
      subtitle?: string;
      authors?: string[];
      description?: string;
      publishedDate?: string;
      categories?: string[];
      averageRating?: number;
      ratingsCount?: number;
      imageLinks?: {
        smallThumbnail?: string;
        thumbnail?: string;
        small?: string;
        medium?: string;
        large?: string;
        extraLarge?: string;
      };
    };
  }>;
};

@Injectable()
export class GoogleBooksService {
  private readonly logger = new Logger(GoogleBooksService.name);

  readonly bookRowDefs: Array<{ id: string; title: string; query: string }> = [
    { id: 'trending', title: 'หนังสือยอดนิยมประจำสัปดาห์', query: 'subject:fiction bestseller' },
    { id: 'business', title: 'ธุรกิจและการเงินที่ห้ามพลาด', query: 'subject:business investing leadership' },
    { id: 'self-help', title: 'พัฒนาตัวเองและจิตวิทยา', query: 'subject:self-help psychology habit' },
    { id: 'technology', title: 'เทคโนโลยีและอนาคตดิจิทัล', query: 'subject:technology ai software' },
  ];

  async fetchBooksForQuery(query: string, limit = 40, offset = 0): Promise<{ items: LandingBook[]; total: number }> {
    const params = new URLSearchParams({
      q: query,
      langRestrict: 'en',
      maxResults: String(Math.min(limit, 40)), // Google Books API max is 40
      startIndex: String(offset),
      orderBy: 'relevance',
      printType: 'books',
    });

    const hasApiKey = !!process.env.GOOGLE_BOOKS_API_KEY;
    if (hasApiKey) {
      params.set('key', process.env.GOOGLE_BOOKS_API_KEY!);
    }

    this.logger.log(`[Google Books] Fetching: "${query}" | apiKey=${hasApiKey} | offset=${offset}`);

    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
        { headers: { Accept: 'application/json' }, cache: 'no-store' },
      );

      this.logger.log(`[Google Books] ${response.status} ${response.statusText} | "${query}"`);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.error(`[Google Books] Error: ${text.substring(0, 200)}`);
        return { items: [], total: 0 };
      }

      const data = (await response.json()) as GoogleBooksResponse & { totalItems?: number };
      const items = this.mapBooks(data);
      const total: number = (data as any).totalItems ?? items.length;
      this.logger.log(`[Google Books] Found ${items.length}/${total} books for "${query}"`);
      return { items, total };
    } catch (err) {
      this.logger.error(`[Google Books] Fetch error: ${String(err)}`);
      return { items: [], total: 0 };
    }
  }

  private mapBooks(data: GoogleBooksResponse): LandingBook[] {
    return (
      data.items
        ?.map((item) => {
          const info = item.volumeInfo;
          const image =
            info?.imageLinks?.extraLarge ??
            info?.imageLinks?.large ??
            info?.imageLinks?.medium ??
            info?.imageLinks?.small ??
            info?.imageLinks?.thumbnail ??
            info?.imageLinks?.smallThumbnail;

          if (!item.id || !info?.title || !image) return null;

          // Upgrade Google Books thumbnail to highest resolution:
          // zoom=0 = full size, remove edge=curl (page-curl effect), force https
          const thumbnail = image
            .replace('http://', 'https://')
            .replace(/&edge=curl/g, '')
            .replace(/([?&]zoom)=\d+/, '$1=0');

          return {
            id: item.id,
            title: info.title,
            subtitle: info.subtitle ?? '',
            authors: info.authors ?? [],
            description: info.description ?? '',
            thumbnail,
            publishedDate: info.publishedDate ?? '',
            categories: info.categories ?? [],
            averageRating: info.averageRating ?? 0,
            ratingsCount: info.ratingsCount ?? 0,
          } satisfies LandingBook;
        })
        .filter((b): b is LandingBook => b !== null) ?? []
    );
  }
}
