import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthGuard, USER_KEY } from '../src/auth/auth.guard';
import { ContentReportsController } from '../src/content-reports/content-reports.controller';
import { ContentReportsService } from '../src/content-reports/content-reports.service';
import { ReaderCommentsController } from '../src/reader-comments/reader-comments.controller';
import { ReaderCommentsService } from '../src/reader-comments/reader-comments.service';
import { ReviewsController } from '../src/reviews/reviews.controller';
import { ReviewsService } from '../src/reviews/reviews.service';
import { TranslationFeedbackController } from '../src/translation-feedback/translation-feedback.controller';
import { TranslationFeedbackService } from '../src/translation-feedback/translation-feedback.service';

/**
 * #654 — the new feature controllers took raw object literals, so the global
 * ValidationPipe never engaged and bad input reached PostgREST (NaN page → 500,
 * `vote: 999`, `rating: 3.7`, uncapped report bodies).
 *
 * Unit-testing the DTOs proves the rules; this suite proves the *wiring*: the
 * controllers are mounted behind the same
 * `ValidationPipe({ whitelist: true, transform: true })` as `main.ts`, with the
 * services mocked, so a 400 here is the 400 a real client gets.
 */
describe('New-feature endpoints — input validation (e2e)', () => {
  let app: INestApplication;

  const reviews = {
    upsertReview: jest.fn().mockResolvedValue(undefined),
    getReviews: jest.fn().mockResolvedValue([]),
    getReviewSummary: jest.fn().mockResolvedValue({ averageRating: 0, count: 0 }),
    getMyReview: jest.fn().mockResolvedValue(null),
    deleteReview: jest.fn().mockResolvedValue(undefined),
  };
  const readerComments = {
    getComments: jest.fn().mockResolvedValue([]),
    addComment: jest.fn().mockResolvedValue({}),
    deleteComment: jest.fn().mockResolvedValue(undefined),
  };
  const feedback = {
    submitVote: jest.fn().mockResolvedValue(undefined),
    deleteVote: jest.fn().mockResolvedValue(undefined),
    getChapterSummary: jest.fn().mockResolvedValue([]),
    getMyVote: jest.fn().mockResolvedValue(null),
  };
  const reports = { submitReport: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [
        ReviewsController,
        ReaderCommentsController,
        TranslationFeedbackController,
        ContentReportsController,
      ],
      providers: [
        { provide: ReviewsService, useValue: reviews },
        { provide: ReaderCommentsService, useValue: readerComments },
        { provide: TranslationFeedbackService, useValue: feedback },
        { provide: ContentReportsService, useValue: reports },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (ctx: {
          switchToHttp: () => { getRequest: () => Record<string, unknown> };
        }) => {
          ctx.switchToHttp().getRequest()[USER_KEY] = { uid: 'test-uid' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    // Identical to main.ts:93 — the pipe under test.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(() => jest.clearAllMocks());
  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('POST /reviews/:mangaId (#656)', () => {
    it('accepts an integer rating', async () => {
      await http().post('/reviews/m1').send({ rating: 5, body: 'great' }).expect(201);
      expect(reviews.upsertReview).toHaveBeenCalled();
    });

    it('rejects a fractional rating with 400 instead of storing 3.7 stars', async () => {
      await http().post('/reviews/m1').send({ rating: 3.7 }).expect(400);
      expect(reviews.upsertReview).not.toHaveBeenCalled();
    });

    it('rejects a null/omitted rating with 400', async () => {
      await http().post('/reviews/m1').send({ rating: null }).expect(400);
      await http().post('/reviews/m1').send({}).expect(400);
      expect(reviews.upsertReview).not.toHaveBeenCalled();
    });

    it('strips properties the DTO does not declare (whitelist)', async () => {
      await http()
        .post('/reviews/m1')
        .send({ rating: 4, body: 'ok', uid: 'someone-else', isAdmin: true })
        .expect(201);
      const [, , body] = reviews.upsertReview.mock.calls[0] as [
        string,
        string,
        Record<string, unknown>,
      ];
      expect(body).toEqual({ rating: 4, body: 'ok' });
    });
  });

  describe('GET /reviews/:mangaId pagination (#657)', () => {
    it('falls back instead of passing NaN/negatives through', async () => {
      await http().get('/reviews/m1?limit=abc&offset=-10').expect(200);
      expect(reviews.getReviews).toHaveBeenCalledWith('m1', 20, 0);
    });

    it('caps limit at 50', async () => {
      await http().get('/reviews/m1?limit=9999').expect(200);
      expect(reviews.getReviews).toHaveBeenCalledWith('m1', 50, 0);
    });
  });

  describe('GET /reader-comments (#658)', () => {
    it('returns 400 — not 500 — when page is missing', async () => {
      await http().get('/reader-comments?mangaId=m1&chapterId=c1').expect(400);
      expect(readerComments.getComments).not.toHaveBeenCalled();
    });

    it('returns 400 when page is not a number', async () => {
      await http().get('/reader-comments?mangaId=m1&chapterId=c1&page=x').expect(400);
      expect(readerComments.getComments).not.toHaveBeenCalled();
    });

    it('passes a coerced number through on the happy path', async () => {
      await http().get('/reader-comments?mangaId=m1&chapterId=c1&page=3').expect(200);
      expect(readerComments.getComments).toHaveBeenCalledWith('m1', 'c1', 3);
    });
  });

  describe('POST /translation-feedback (#655)', () => {
    const base = { mangaId: 'm1', chapterId: 'c1', pageNumber: 0 };

    it('accepts ±1', async () => {
      await http().post('/translation-feedback').send({ ...base, vote: 1 }).expect(201);
      await http().post('/translation-feedback').send({ ...base, vote: -1 }).expect(201);
    });

    it('rejects an out-of-domain vote that would skew the summary', async () => {
      await http().post('/translation-feedback').send({ ...base, vote: 999 }).expect(400);
      await http().post('/translation-feedback').send({ ...base, vote: 0 }).expect(400);
      expect(feedback.submitVote).not.toHaveBeenCalled();
    });
  });

  describe('POST /content-reports (#659)', () => {
    const base = { contentType: 'post', contentId: 'p1', reason: 'spam' };

    it('accepts a well-formed report', async () => {
      await http().post('/content-reports').send(base).expect(201);
      expect(reports.submitReport).toHaveBeenCalled();
    });

    it('rejects an oversized details field', async () => {
      await http()
        .post('/content-reports')
        .send({ ...base, details: 'x'.repeat(2001) })
        .expect(400);
      expect(reports.submitReport).not.toHaveBeenCalled();
    });

    it('rejects an unknown content type or reason', async () => {
      await http().post('/content-reports').send({ ...base, contentType: 'user' }).expect(400);
      await http().post('/content-reports').send({ ...base, reason: 'because' }).expect(400);
      expect(reports.submitReport).not.toHaveBeenCalled();
    });
  });
});
