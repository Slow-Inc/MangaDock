import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertReviewDto } from '../reviews/review.dto';
import { AddReaderCommentDto } from '../reader-comments/reader-comment.dto';
import { SubmitReportDto } from '../content-reports/content-report.dto';
import { SubmitFeedbackDto } from '../translation-feedback/translation-feedback.dto';

/**
 * #1015: these write bodies were plain objects, so the global ValidationPipe checked nothing and a wrong type became
 * a 500 (or a wrong write). Validated here with the app's pipe options (whitelist, transform).
 */
async function errorsFor<T extends object>(
  cls: new () => T,
  body: Record<string, unknown>,
) {
  const errors = await validate(plainToInstance(cls, body), {
    whitelist: true,
  });
  return errors.map((e) => e.property).sort();
}

describe('write DTOs (#1015)', () => {
  describe('UpsertReviewDto', () => {
    const ok = { mangaTitle: 'A', rating: 4, body: 'good' };
    it('accepts a review, with or without a body', async () => {
      expect(await errorsFor(UpsertReviewDto, ok)).toEqual([]);
      expect(await errorsFor(UpsertReviewDto, { rating: 5 })).toEqual([]);
    });
    it.each([
      ['a string rating', { ...ok, rating: 'x' }, ['rating']],
      ['a missing rating', { mangaTitle: 'A', body: 'b' }, ['rating']],
      ['a rating of 6', { ...ok, rating: 6 }, ['rating']],
      ['a fractional rating', { ...ok, rating: 3.5 }, ['rating']],
      ['a numeric body', { ...ok, body: 1 }, ['body']],
      ['a body over 5,000', { ...ok, body: 'x'.repeat(5001) }, ['body']],
      [
        'a title over 500',
        { ...ok, mangaTitle: 'x'.repeat(501) },
        ['mangaTitle'],
      ],
    ])('rejects %s', async (_l, body, props) => {
      expect(await errorsFor(UpsertReviewDto, body)).toEqual(props);
    });
  });

  describe('AddReaderCommentDto', () => {
    const ok = {
      mangaId: 'm1',
      chapterId: 'ver:abc',
      pageNumber: 3,
      body: 'hi',
    };
    it('accepts a comment', async () => {
      expect(await errorsFor(AddReaderCommentDto, ok)).toEqual([]);
    });
    it.each([
      ['a numeric body', { ...ok, body: 1 }, ['body']],
      ['a string page', { ...ok, pageNumber: 'x' }, ['pageNumber']],
      ['a negative page', { ...ok, pageNumber: -1 }, ['pageNumber']],
      [
        'a missing chapter',
        { mangaId: 'm1', pageNumber: 0, body: 'hi' },
        ['chapterId'],
      ],
      ['a body over 5,000', { ...ok, body: 'x'.repeat(5001) }, ['body']],
    ])('rejects %s', async (_l, body, props) => {
      expect(await errorsFor(AddReaderCommentDto, body)).toEqual(props);
    });
  });

  describe('SubmitReportDto', () => {
    const ok = { contentType: 'post', contentId: 'p1', reason: 'spam' };
    it('accepts a report, with optional details', async () => {
      expect(await errorsFor(SubmitReportDto, ok)).toEqual([]);
      expect(
        await errorsFor(SubmitReportDto, { ...ok, details: 'why' }),
      ).toEqual([]);
    });
    it.each([
      ['a numeric content id', { ...ok, contentId: 1 }, ['contentId']],
      ['numeric details', { ...ok, details: 1 }, ['details']],
      ['details over 1,000', { ...ok, details: 'x'.repeat(1001) }, ['details']],
    ])('rejects %s', async (_l, body, props) => {
      expect(await errorsFor(SubmitReportDto, body)).toEqual(props);
    });
  });

  describe('SubmitFeedbackDto', () => {
    const ok = { mangaId: 'm1', chapterId: 'c1', pageNumber: 0, vote: 1 };
    it('accepts an up or down vote', async () => {
      expect(await errorsFor(SubmitFeedbackDto, ok)).toEqual([]);
      expect(await errorsFor(SubmitFeedbackDto, { ...ok, vote: -1 })).toEqual(
        [],
      );
    });
    it.each([
      ['a vote of 0', { ...ok, vote: 0 }, ['vote']],
      ['a vote of 5', { ...ok, vote: 5 }, ['vote']],
      ['a string page', { ...ok, pageNumber: 'x' }, ['pageNumber']],
    ])('rejects %s', async (_l, body, props) => {
      expect(await errorsFor(SubmitFeedbackDto, body)).toEqual(props);
    });
  });
});
