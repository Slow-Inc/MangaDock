import 'reflect-metadata'; // decorator metadata is normally installed by the Nest bootstrap
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SubmitReportDto } from '../content-reports/content-reports.dto';
import {
  AddCommentDto,
  GetCommentsQueryDto,
} from '../reader-comments/reader-comments.dto';
import { UpsertReviewDto } from '../reviews/reviews.dto';
import { SubmitVoteDto } from '../translation-feedback/translation-feedback.dto';

/**
 * The global ValidationPipe (`main.ts`) runs `plainToInstance` + `validate` with
 * `{ whitelist: true, transform: true }`. These specs exercise the DTOs through
 * the same path, so a failing rule here is a 400 at runtime (#654).
 */
function errorsFor<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
): string[] {
  const instance = plainToInstance(cls, payload);
  return validateSync(instance, { whitelist: true }).map((e) => e.property);
}

describe('UpsertReviewDto (#656)', () => {
  it('accepts an integer rating in 1..5', () => {
    expect(errorsFor(UpsertReviewDto, { rating: 4, body: 'good' })).toEqual([]);
  });

  it('rejects a fractional rating', () => {
    // Regression: `3.7 < 1 || 3.7 > 5` was false, so 3.7-star reviews were stored.
    expect(errorsFor(UpsertReviewDto, { rating: 3.7 })).toContain('rating');
  });

  it('rejects a missing or null rating', () => {
    // Regression: `undefined < 1` and `undefined > 5` are both false.
    expect(errorsFor(UpsertReviewDto, {})).toContain('rating');
    expect(errorsFor(UpsertReviewDto, { rating: null })).toContain('rating');
  });

  it('rejects out-of-range ratings', () => {
    expect(errorsFor(UpsertReviewDto, { rating: 0 })).toContain('rating');
    expect(errorsFor(UpsertReviewDto, { rating: 6 })).toContain('rating');
  });

  it('rejects an oversized body', () => {
    expect(
      errorsFor(UpsertReviewDto, { rating: 5, body: 'x'.repeat(5001) }),
    ).toContain('body');
  });
});

describe('SubmitVoteDto (#655)', () => {
  const base = { mangaId: 'm1', chapterId: 'c1', pageNumber: 0 };

  it('accepts ±1', () => {
    expect(errorsFor(SubmitVoteDto, { ...base, vote: 1 })).toEqual([]);
    expect(errorsFor(SubmitVoteDto, { ...base, vote: -1 })).toEqual([]);
  });

  it('rejects an out-of-domain vote', () => {
    // Regression: `{vote:999}` was stored and counted as a single "up".
    expect(errorsFor(SubmitVoteDto, { ...base, vote: 999 })).toContain('vote');
  });

  it('rejects 0, which used to be bucketed as a down-vote', () => {
    expect(errorsFor(SubmitVoteDto, { ...base, vote: 0 })).toContain('vote');
  });

  it('rejects a negative page number', () => {
    expect(
      errorsFor(SubmitVoteDto, { ...base, pageNumber: -1, vote: 1 }),
    ).toContain('pageNumber');
  });
});

describe('GetCommentsQueryDto (#658)', () => {
  it('coerces a numeric page string', () => {
    expect(
      errorsFor(GetCommentsQueryDto, {
        mangaId: 'm',
        chapterId: 'c',
        page: '3',
      }),
    ).toEqual([]);
  });

  it('rejects a missing page instead of forwarding NaN', () => {
    // Regression: `Number(undefined)` → NaN → PostgREST
    // `invalid input syntax for integer: NaN` → 500.
    expect(
      errorsFor(GetCommentsQueryDto, { mangaId: 'm', chapterId: 'c' }),
    ).toContain('page');
  });

  it('rejects a non-numeric page', () => {
    expect(
      errorsFor(GetCommentsQueryDto, {
        mangaId: 'm',
        chapterId: 'c',
        page: 'x',
      }),
    ).toContain('page');
  });

  it('rejects a blank mangaId', () => {
    expect(
      errorsFor(GetCommentsQueryDto, {
        mangaId: '',
        chapterId: 'c',
        page: '1',
      }),
    ).toContain('mangaId');
  });
});

describe('AddCommentDto', () => {
  const base = { mangaId: 'm', chapterId: 'c', pageNumber: 1 };

  it('accepts a normal comment', () => {
    expect(errorsFor(AddCommentDto, { ...base, body: 'nice page' })).toEqual(
      [],
    );
  });

  it('rejects an empty body', () => {
    expect(errorsFor(AddCommentDto, { ...base, body: '' })).toContain('body');
  });

  it('rejects an oversized body', () => {
    expect(
      errorsFor(AddCommentDto, { ...base, body: 'x'.repeat(2001) }),
    ).toContain('body');
  });
});

describe('SubmitReportDto (#659)', () => {
  const base = { contentType: 'post', contentId: 'abc', reason: 'spam' };

  it('accepts a valid report', () => {
    expect(errorsFor(SubmitReportDto, base)).toEqual([]);
  });

  it('rejects an unknown content type or reason', () => {
    expect(
      errorsFor(SubmitReportDto, { ...base, contentType: 'user' }),
    ).toContain('contentType');
    expect(
      errorsFor(SubmitReportDto, { ...base, reason: 'because' }),
    ).toContain('reason');
  });

  it('caps contentId and details length', () => {
    // Regression: neither field had a cap, so one user could store huge rows.
    expect(
      errorsFor(SubmitReportDto, { ...base, contentId: 'x'.repeat(201) }),
    ).toContain('contentId');
    expect(
      errorsFor(SubmitReportDto, { ...base, details: 'x'.repeat(2001) }),
    ).toContain('details');
  });
});
